import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOCUMENT_TYPES, EVIDENCE_GRADES, canonicalIdentity, freshnessOf, sourceRoutesOf } from "../lib/records.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = ["labs.json", "intelligence-curated.json", "live.json", "meta.json", "watch-queries.json", "lab-research-audits.json", "lab-research.json", "monitoring-coverage.json", "record-overlays.json"];
const errors = [];

for (const file of files) {
  try { JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8")); }
  catch (error) { errors.push(`${file}: invalid JSON (${error.message})`); }
}

const read = async (file) => JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8"));
const labs = await read("labs.json");
const curated = await read("intelligence-curated.json");
const live = await read("live.json");
const watches = await read("watch-queries.json");
const meta = await read("meta.json");
const coverage = await read("monitoring-coverage.json");
const overlays = await read("record-overlays.json");
const allowedCategories = new Set(["core", "methods", "translational", "adjacent"]);
for (const [name, items] of [["labs", labs], ["curated", curated]]) {
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    if (!item.id) errors.push(`${name}[${index}] has no id`);
    if (ids.has(item.id)) errors.push(`${name} has a duplicate id: ${item.id}`);
    ids.add(item.id);
    if (!item.url && !item.website) errors.push(`${name}[${index}] has no primary-source link`);
  }
}

if (labs.length < 30) errors.push(`Laboratory coverage is too small: ${labs.length} records, minimum 30`);
for (const category of allowedCategories) {
  if (!labs.some((lab) => lab.category === category)) errors.push(`No laboratory carries the category: ${category}`);
}
const representedRegions = new Set(labs.map((lab) => lab.region.split("·")[0].trim()));
if (representedRegions.size < 8) errors.push(`Regional coverage is too narrow: ${representedRegions.size} country or region labels, minimum 8`);
for (const lab of labs) {
  if (!allowedCategories.has(lab.category)) errors.push(`Invalid laboratory category: ${lab.id} -> ${lab.category}`);
  if (!lab.website?.startsWith("https://")) errors.push(`Laboratory website is not HTTPS: ${lab.id}`);
  if (!lab.region || !lab.focus || !lab.institution) errors.push(`Incomplete laboratory record: ${lab.id}`);
}

// ------------------------------------------------------------------ freshness state
//
// A failing source no longer invalidates the whole dataset. It invalidates the claim
// that this source is current, so the run is allowed to publish a degraded state as
// long as the retained records are inside their declared maximum age. Validation fails
// when a source has no usable retained data, which is the only case in which the site
// would otherwise present a gap as if it were the field going quiet.

const requiredLiveSources = ["Tracked labs / PubMed", "PubMed", "Preprints / Crossref", "ClinicalTrials.gov"];
const degraded = [];
for (const sourceName of requiredLiveSources) {
  const source = meta.sources?.find((item) => item.name === sourceName);
  if (!source) { errors.push(`Live source is missing from meta.json: ${sourceName}`); continue; }
  if (!["ok", "degraded", "failed", "manual"].includes(source.state)) errors.push(`Live source ${sourceName} declares an unknown state: ${source.state}`);
  if (!source.lastAttemptAt || Number.isNaN(Date.parse(source.lastAttemptAt))) errors.push(`Live source ${sourceName} has no parsable lastAttemptAt timestamp`);
  if (source.state === "failed") errors.push(`Live source ${sourceName} failed with no retained data inside its maximum age (${source.errorClass || "no error class"}).`);
  if (source.state === "degraded") {
    degraded.push(`${sourceName} (${source.retainedItems || 0} retained records, ${source.retainedAgeDays ?? "unknown"} days old, ${source.errorClass || "no error class"})`);
    if (!source.lastSuccessAt) errors.push(`Live source ${sourceName} is degraded but records no lastSuccessAt`);
    if (Number(source.retainedItems || 0) < 1) errors.push(`Live source ${sourceName} is degraded but retained no records; that state must be "failed"`);
  }
  if (source.state === "ok" && !source.ok) errors.push(`Live source ${sourceName} is marked ok:false but declares state "ok"`);
}

// ------------------------------------------------------------- automated record gate
//
// An automated query proves only that a record matched a search. It cannot establish
// what kind of document the record is or how far the result can be reused, so no record
// written by the ingestion layer may carry an evidence grade of its own.

const seenCanonical = new Map();
for (const [index, item] of live.entries()) {
  const where = `live[${index}] ${item.id || "(no id)"}`;
  if ("evidence" in item) errors.push(`${where}: automated records must not carry an evidence grade; use evidenceGrade with a basis`);
  if (item.evidenceGrade !== null && item.evidenceGrade !== undefined) errors.push(`${where}: evidenceGrade must be null in the generated dataset; only a curated overlay may assign ${EVIDENCE_GRADES.join("/")}`);
  if (item.evidenceGradeBasis !== "unassessed") errors.push(`${where}: evidenceGradeBasis must be "unassessed" in the generated dataset`);
  if (!DOCUMENT_TYPES.includes(item.documentType)) errors.push(`${where}: unknown documentType ${item.documentType}`);
  if (item.documentType === "original-research") errors.push(`${where}: the ingestion layer may not promote a record to original-research; that requires a curated audit`);
  if (!item.documentTypeBasis) errors.push(`${where}: documentTypeBasis must record how the document class was decided`);
  if (!item.sourceName) errors.push(`${where}: sourceName must record which source produced this record, so a source failure can retain its own items`);
  if (typeof item.stale !== "boolean") errors.push(`${where}: stale must be a boolean`);

  // Freshness belongs to the discovery route. A record merged from two routes has one
  // top-level sourceName, so selecting or reporting freshness by that name alone loses the
  // secondary route — the defect this contract exists to prevent.
  if (!Array.isArray(item.sources) || item.sources.length === 0) {
    errors.push(`${where}: every record must list the discovery routes it arrived by`);
  } else {
    for (const [routeIndex, route] of item.sources.entries()) {
      const routeWhere = `${where} sources[${routeIndex}]`;
      if (!route.route) errors.push(`${routeWhere}: a route must name the source it came from`);
      if (!["automated", "curated"].includes(route.kind)) errors.push(`${routeWhere}: unknown route kind ${route.kind}`);
      if (typeof route.stale !== "boolean") errors.push(`${routeWhere}: a route must carry its own stale flag`);
      for (const field of ["lastSuccessAt", "lastAttemptAt"]) {
        if (route[field] !== null && Number.isNaN(Date.parse(route[field]))) errors.push(`${routeWhere}: ${field} must be an ISO timestamp or null`);
      }
      if (route.stale && !route.lastAttemptAt) errors.push(`${routeWhere}: a stale route must record the attempt that failed`);
    }
    const derived = freshnessOf(sourceRoutesOf(item));
    if (item.freshnessState !== derived.freshnessState) errors.push(`${where}: freshnessState is ${item.freshnessState} but the routes describe ${derived.freshnessState}`);
    if (item.stale !== derived.stale) errors.push(`${where}: stale is ${item.stale} but the routes describe ${derived.stale}; a record is retained only when every automated route failed`);
    for (const field of ["staleSourceNames", "freshSourceNames"]) {
      const stored = [...(item[field] || [])].sort().join("|");
      if (stored !== [...derived[field]].sort().join("|")) errors.push(`${where}: ${field} does not match the routes it is derived from`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date || "")) errors.push(`${where}: date must be an ISO calendar date, not a locale-parsed timestamp`);
  const { canonicalId } = canonicalIdentity(item);
  if (seenCanonical.has(canonicalId)) errors.push(`${where}: canonical identity ${canonicalId} is already used by ${seenCanonical.get(canonicalId)}; the ingestion merge did not collapse them`);
  else seenCanonical.set(canonicalId, item.id);
}

for (const [index, overlay] of overlays.entries()) {
  const where = `record-overlays[${index}]`;
  if (!/^(doi|pmid|nct|url|record):/.test(overlay.canonicalId || "")) errors.push(`${where}: canonicalId must be a canonical identity such as doi:10.xxxx/yyy`);
  if (!DOCUMENT_TYPES.includes(overlay.documentType)) errors.push(`${where}: unknown documentType ${overlay.documentType}`);
  if (overlay.evidenceGrade !== null && !EVIDENCE_GRADES.includes(overlay.evidenceGrade)) errors.push(`${where}: evidenceGrade must be null or one of ${EVIDENCE_GRADES.join(", ")}`);
  if (!overlay.checkedBy || !overlay.checkedAt) errors.push(`${where}: a curated overlay must name who classified the record and when`);
  if (!overlay.reason) errors.push(`${where}: a curated overlay must state why the record carries this class`);
}

// --------------------------------------------------------------- monitoring coverage
//
// Every laboratory publishes what is and is not watching it. A laboratory with no author
// watch is read by a person; it is never described as site-watched, because no
// laboratory-site crawler exists.

const labIds = new Set(labs.map((lab) => lab.id));
const coverageIds = new Set();
for (const [index, row] of (coverage.labs || []).entries()) {
  const where = `monitoring-coverage.labs[${index}] ${row.labId || "(no labId)"}`;
  if (!labIds.has(row.labId)) errors.push(`${where}: unknown laboratory`);
  if (coverageIds.has(row.labId)) errors.push(`${where}: duplicate coverage record`);
  coverageIds.add(row.labId);
  if (!["orcid-exact", "author-plus-affiliation", "none"].includes(row.authorWatch)) errors.push(`${where}: unknown authorWatch tier ${row.authorWatch}`);
  if (!["active", "pending-first-run", "manual-queue"].includes(row.watchState)) errors.push(`${where}: unknown watchState ${row.watchState}`);
  if (row.siteMonitor !== "none") errors.push(`${where}: no laboratory-site crawler exists, so siteMonitor must be "none"`);
  if (row.manualReview !== true) errors.push(`${where}: every laboratory is manually reviewed; manualReview must be true`);
  for (const field of ["lastCheckedAt", "nextReviewDue"]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row[field] || "")) errors.push(`${where}: ${field} must be an ISO date`);
  }
  if (row.lastCheckedAt && row.nextReviewDue && row.nextReviewDue <= row.lastCheckedAt) errors.push(`${where}: nextReviewDue must be after lastCheckedAt`);
  if (row.authorWatch === "orcid-exact" && !row.orcid) errors.push(`${where}: an ORCID-exact watch must record the ORCID it was proven against`);
}
for (const id of labIds) if (!coverageIds.has(id)) errors.push(`Laboratory has no monitoring-coverage record: ${id}`);

const watchedLabIds = new Set();
for (const watch of watches) {
  if (!labIds.has(watch.labId)) errors.push(`watch-queries points to an unknown laboratory: ${watch.labId}`);
  if (!watch.query?.includes("[Author]")) errors.push(`watch-queries has no author restriction: ${watch.labId}`);
  if (watchedLabIds.has(watch.labId)) errors.push(`watch-queries defines two watches for the same laboratory: ${watch.labId}`);
  watchedLabIds.add(watch.labId);
  const row = (coverage.labs || []).find((entry) => entry.labId === watch.labId);
  if (row && row.authorWatch === "none") errors.push(`${watch.labId} has an author watch but monitoring-coverage records it as manual-only`);
}
for (const row of coverage.labs || []) {
  if (row.authorWatch !== "none" && !watchedLabIds.has(row.labId)) errors.push(`${row.labId} claims an author watch but watch-queries defines none`);
}

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
const active = (coverage.labs || []).filter((row) => row.watchState === "active").length;
const pending = (coverage.labs || []).filter((row) => row.watchState === "pending-first-run").length;
const manual = (coverage.labs || []).filter((row) => row.authorWatch === "none").length;
if (degraded.length) console.warn(`Degraded but publishable sources: ${degraded.join("; ")}`);
const routeCount = live.reduce((total, item) => total + (item.sources?.length || 0), 0);
const multiRoute = live.filter((item) => (item.sources?.length || 0) > 1).length;
const byFreshness = (state) => live.filter((item) => item.freshnessState === state).length;
console.log(
  `Data check passed: ${labs.length} laboratories, ${representedRegions.size} country or region labels, ${curated.length} curated signals, ` +
    `${live.length} automated records with no self-assigned evidence grade, and monitoring coverage of ${active} running author watches, ` +
    `${pending} watches pending a first run, ${manual} manual-only laboratories and 0 automated site monitors.`,
);
console.log(
  `Route-level freshness: ${routeCount} discovery routes across ${live.length} records (${multiRoute} multi-route), ` +
    `${byFreshness("current")} current, ${byFreshness("partially-stale")} partially stale, ${byFreshness("stale")} wholly retained.`,
);
