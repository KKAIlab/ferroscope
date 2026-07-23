import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (file) => JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8"));
const [labs, labsEn, methods, glossary, network, resources, curated, briefs, bundles, paperClaims, paperLinks] = await Promise.all([
  read("labs.json"), read("labs-en.json"), read("methods.json"), read("glossary.json"), read("knowledge-network.json"), read("resources.json"), read("intelligence-curated.json"), read("signal-briefs-en.json"), read("evidence-bundles.json"), read("paper-claims.json"), read("lab-paper-links.json")
]);

const errors = [];
const cjk = /[㐀-鿿぀-ヿ가-힯]/u;
const unique = (items, name) => {
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    if (!item.id) errors.push(`${name}[${index}] has no id`);
    if (ids.has(item.id)) errors.push(`${name} has duplicate id: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
};

const labIds = unique(labs, "labs");
const englishLabIds = unique(labsEn, "labs-en");
const methodIds = unique(methods, "methods");
const glossaryIds = unique(glossary, "glossary");
unique(resources, "resources");
const curatedIds = unique(curated, "curated signals");
const briefIds = unique(briefs, "English signal briefs");
const mechanismIds = unique(network.mechanisms || [], "mechanisms");

for (const id of labIds) if (!englishLabIds.has(id)) errors.push(`Missing English lab overlay: ${id}`);
for (const id of englishLabIds) if (!labIds.has(id)) errors.push(`English lab overlay points to unknown lab: ${id}`);
for (const lab of labsEn) {
  for (const field of ["pi", "institution", "region", "focus", "question"]) {
    if (!lab[field]) errors.push(`English lab ${lab.id} is missing ${field}`);
    else if (cjk.test(lab[field])) errors.push(`English lab ${lab.id}.${field} contains CJK narrative text`);
  }
}
// ------------------------------------------------------------- method decision schema
//
// Every module answers the same thirteen questions a reader has to answer before reusing a
// result. A field is either source-checked, with a route that names who read what and when,
// or explicitly pending-source-review. There is no third state, because an absent field
// reads as "not applicable" when the truth is "nobody has established it".

const METHOD_DECISION_AXES = [
  "specimen", "question", "perturbation", "readout", "quantificationUnit", "instrument",
  "positiveControl", "negativeControl", "processControl", "orthogonalConfirmation",
  "timing", "compartmentResolution", "confounders",
];
const SOURCE_ROUTE_KINDS = ["vendor-protocol", "field-recommendation", "original-research-demonstration", "local-laboratory-capability", "unclassified-source"];
const FIELD_STATUSES = ["source-checked", "pending-source-review"];

let methodFieldsChecked = 0;
let methodFieldsPending = 0;
let capabilityDemonstrated = 0;
let capabilityClaimed = 0;
let capabilityUnlisted = 0;

for (const method of methods) {
  for (const field of ["name", "group", "evidenceRole", "plainEnglish", "measures", "cannotProve"]) if (!method[field]) errors.push(`Method ${method.id} is missing ${field}`);
  for (const id of method.distinctiveLabs || []) if (!labIds.has(id)) errors.push(`Method ${method.id} points to unknown lab ${id}`);

  const profile = method.decisionProfile;
  if (!profile) { errors.push(`Method ${method.id} has no decisionProfile; every module must answer the decision axes or say it cannot`); continue; }
  if (!FIELD_STATUSES.includes(profile.reviewState)) errors.push(`Method ${method.id}: decisionProfile.reviewState must be one of ${FIELD_STATUSES.join(", ")}`);

  let checked = 0;
  let pending = 0;
  for (const axis of METHOD_DECISION_AXES) {
    const field = profile.fields?.[axis];
    if (!field) { errors.push(`Method ${method.id} does not answer the ${axis} axis, not even to say it is unresolved`); continue; }
    if (!FIELD_STATUSES.includes(field.status)) { errors.push(`Method ${method.id}.${axis}: status must be one of ${FIELD_STATUSES.join(", ")}`); continue; }
    if (field.status === "source-checked") {
      checked += 1;
      if (!field.value) errors.push(`Method ${method.id}.${axis} is marked source-checked but records no value`);
      const evidence = field.evidence || [];
      if (!evidence.length) errors.push(`Method ${method.id}.${axis} is marked source-checked but names no source route that establishes it`);
      for (const entry of evidence) {
        if (!/^https:\/\//.test(entry.url || "")) errors.push(`Method ${method.id}.${axis}: a source-checked field must cite an HTTPS source`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.checkedAt || "")) errors.push(`Method ${method.id}.${axis}: a source-checked field must record when the source was read`);
        if (!entry.checkedBy) errors.push(`Method ${method.id}.${axis}: a source-checked field must record who read the source`);
        if (!(entry.scope || []).length) errors.push(`Method ${method.id}.${axis}: a source-checked field must state what part of the source it was read from`);
      }
    } else {
      pending += 1;
      if (field.value) errors.push(`Method ${method.id}.${axis} carries a value while declaring itself unverified; promote it with a source or leave it null`);
      if (!field.unresolved) errors.push(`Method ${method.id}.${axis} is pending but does not say what has to be read to resolve it`);
    }
  }
  if (profile.sourceCheckedFields !== checked) errors.push(`Method ${method.id}: decisionProfile.sourceCheckedFields says ${profile.sourceCheckedFields} but ${checked} fields are source-checked`);
  if (profile.pendingFields !== pending) errors.push(`Method ${method.id}: decisionProfile.pendingFields says ${profile.pendingFields} but ${pending} fields are pending`);
  // A module with any unresolved field cannot describe itself as reviewed.
  if (pending > 0 && profile.reviewState !== "pending-source-review") errors.push(`Method ${method.id} has ${pending} unresolved fields but does not declare itself provisional`);
  if (pending > 0 && !profile.provisionalBecause) errors.push(`Method ${method.id} is provisional but does not say why`);
  methodFieldsChecked += checked;
  methodFieldsPending += pending;

  const routes = method.sourceRoutes || [];
  if (!routes.length) errors.push(`Method ${method.id} declares no source route`);
  for (const [index, route] of routes.entries()) {
    const where = `Method ${method.id} sourceRoutes[${index}]`;
    if (!SOURCE_ROUTE_KINDS.includes(route.kind)) errors.push(`${where}: unknown route kind ${route.kind}`);
    if (!route.kindBasis) errors.push(`${where}: a route must say how its kind was decided`);
    if (!/^https:\/\//.test(route.url || "")) errors.push(`${where}: an HTTPS source URL is required`);
    // P0-B: the status that promotes an edge is spelled out, and it is the only one that
    // does. A route may not be promoted by acquiring a date somewhere else in the tree.
    if (!["source-checked", "not-checked", "unavailable"].includes(route.status)) errors.push(`${where}: unknown status ${route.status}`);
    if (!route.verificationDepth) errors.push(`${where}: a route must record how far it was read`);
    if (!route.boundary) errors.push(`${where}: a route must state what declaring it does not prove`);
    if (route.status === "source-checked") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(route.checkedAt || "")) errors.push(`${where}: a source-checked route must record an ISO check date`);
      if (!route.checkedBy) errors.push(`${where}: a source-checked route must record who read it`);
      if (!(route.scope || []).length) errors.push(`${where}: a source-checked route must state what was read`);
      // Sources move. Without a pinned version the reader cannot tell whether the thing
      // that was read is the thing they are now looking at.
      if (!route.sourceVersion) errors.push(`${where}: a source-checked route must pin the version, accession or retrieval it read`);
    } else {
      if (route.checkedAt) errors.push(`${where}: an unchecked route must not carry a check date`);
      if ((route.scope || []).length) errors.push(`${where}: an unchecked route must not claim a scope; "not read" cannot be dressed as partial coverage`);
    }
  }
  if (method.sourceRoutes?.[0]?.url !== method.source) errors.push(`Method ${method.id}: the first source route must be the module's declared source`);

  const attribution = method.capabilityAttribution;
  if (!attribution) { errors.push(`Method ${method.id} has no capabilityAttribution; distinctiveLabs alone is not evidence`); continue; }
  for (const row of attribution.demonstrated || []) {
    if (!labIds.has(row.labId)) errors.push(`Method ${method.id} demonstrates capability for unknown lab ${row.labId}`);
    for (const field of ["paperId", "figure", "role", "roleBasis", "claimId", "boundary"]) {
      if (!row[field]) errors.push(`Method ${method.id} capability row for ${row.labId} is missing ${field}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.checkedAt || "")) errors.push(`Method ${method.id} capability row for ${row.labId} records no check date`);
  }
  for (const row of attribution.claimedWithoutEvidence || []) {
    if (!labIds.has(row.labId)) errors.push(`Method ${method.id} claims capability for unknown lab ${row.labId}`);
    if (!row.reason) errors.push(`Method ${method.id} claims capability for ${row.labId} without saying why it is unevidenced`);
  }
  // The curated shortlist and the evidence are two different claims and are not forced to
  // agree. Every shortlisted laboratory must be accounted for as either demonstrated or
  // unevidenced; a laboratory the evidence supports but the shortlist omits is a real gap in
  // the curated layer and is reported rather than quietly added to the shortlist.
  const covered = new Set([...(attribution.demonstrated || []).map((row) => row.labId), ...(attribution.claimedWithoutEvidence || []).map((row) => row.labId)]);
  for (const id of method.distinctiveLabs || []) {
    if (!covered.has(id)) errors.push(`Method ${method.id} lists ${id} as distinctive but places it in neither the demonstrated nor the unevidenced group`);
  }
  for (const row of attribution.demonstrated || []) {
    if (row.listedAsDistinctive !== (method.distinctiveLabs || []).includes(row.labId)) {
      errors.push(`Method ${method.id} capability row for ${row.labId} misreports whether the curated shortlist lists it`);
    }
  }
  capabilityDemonstrated += (attribution.demonstrated || []).length;
  capabilityClaimed += (attribution.claimedWithoutEvidence || []).length;
  capabilityUnlisted += (attribution.demonstrated || []).filter((row) => !row.listedAsDistinctive).length;
}

// A demonstrated capability claim is derived, not written. It holds only where a
// source-checked USES_METHOD claim links a paper to the module and the attribution layer
// independently places the laboratory on that paper — so it is re-derived here and compared,
// and a hand-written capability claim cannot survive.
const derivedCapability = new Map();
for (const claim of (paperClaims.claims || []).filter((entry) => entry.relation === "USES_METHOD")) {
  for (const link of paperLinks.filter((entry) => entry.paperId === claim.paperId)) {
    const key = claim.object?.id;
    if (!derivedCapability.has(key)) derivedCapability.set(key, new Set());
    derivedCapability.get(key).add(`${link.labId}|${claim.paperId}|${claim.figure}|${link.role}|${claim.id}`);
  }
}
for (const method of methods) {
  const expected = derivedCapability.get(method.id) || new Set();
  const found = new Set((method.capabilityAttribution?.demonstrated || []).map((row) => `${row.labId}|${row.paperId}|${row.figure}|${row.role}|${row.claimId}`));
  for (const key of found) {
    if (!expected.has(key)) errors.push(`Method ${method.id} asserts a demonstrated capability that no source-checked claim supports: ${key}`);
  }
  for (const key of expected) {
    if (!found.has(key)) errors.push(`Method ${method.id} omits a demonstrated capability the evidence supports: ${key}`);
  }
}
for (const entry of glossary) {
  if (!entry.term || !entry.simpleEnglish || !entry.precisionNote) errors.push(`Glossary ${entry.id} is incomplete`);
  if (!entry.aliases?.en || !entry.aliases?.zh || !entry.aliases?.ja) errors.push(`Glossary ${entry.id} lacks a language alias set`);
  for (const related of entry.related || []) if (!glossaryIds.has(related)) errors.push(`Glossary ${entry.id} points to unknown term ${related}`);
}
for (const edge of network.mechanismEdges || []) {
  if (!mechanismIds.has(edge.source) || !mechanismIds.has(edge.target)) errors.push(`Unknown mechanism in edge ${edge.source} -> ${edge.target}`);
  if (!edge.relation || !edge.confidence) errors.push(`Untyped or unqualified mechanism edge ${edge.source} -> ${edge.target}`);
}
for (const link of network.methodLinks || []) {
  if (!methodIds.has(link.method)) errors.push(`Network points to unknown method ${link.method}`);
  for (const id of link.mechanisms || []) if (!mechanismIds.has(id)) errors.push(`Method link ${link.method} points to unknown mechanism ${id}`);
}
for (const resource of resources) {
  if (!resource.url?.startsWith("https://")) errors.push(`Resource is not HTTPS: ${resource.id}`);
  if (!resource.authority || !resource.caution || !resource.checkedAt) errors.push(`Resource ${resource.id} lacks authority, caution or checkedAt`);
}
for (const id of briefIds) if (!curatedIds.has(id)) errors.push(`English signal brief points to unknown curated signal: ${id}`);
for (const id of curatedIds) if (!briefIds.has(id)) errors.push(`Curated signal has no English brief: ${id}`);

// ------------------------------------------------------------------ evidence bundles
//
// A bundle is only useful if it is enforceable: every method it names has to exist, and
// an assay listed as never-standalone must never be the whole of a minimum bundle.

const bundleIds = new Set();
for (const entry of bundles.neverStandalone || []) {
  if (!methodIds.has(entry.methodId)) errors.push(`evidence-bundles neverStandalone points to unknown method ${entry.methodId}`);
  if (!entry.reason) errors.push(`evidence-bundles neverStandalone ${entry.methodId} gives no reason`);
}
const neverStandalone = new Set((bundles.neverStandalone || []).map((entry) => entry.methodId));
for (const [index, bundle] of (bundles.bundles || []).entries()) {
  const where = `evidence-bundles[${index}] ${bundle.id || "(no id)"}`;
  if (!bundle.id || bundleIds.has(bundle.id)) errors.push(`${where}: a unique id is required`);
  bundleIds.add(bundle.id);
  if (!["cell culture", "organoid", "animal", "human tissue"].includes(bundle.model)) errors.push(`${where}: unknown model scale ${bundle.model}`);
  if (!bundle.question) errors.push(`${where}: a bundle must start from a biological question`);
  if ((bundle.interpretationBoundary || "").length < 60) errors.push(`${where}: the interpretation boundary must state what the bundle still cannot support`);
  const steps = bundle.minimumBundle || [];
  if (steps.length < 3) errors.push(`${where}: a minimum bundle of fewer than three measurements cannot identify ferroptosis`);
  for (const step of steps) {
    if (!methodIds.has(step.methodId)) errors.push(`${where}: points to unknown method ${step.methodId}`);
    if (!step.why) errors.push(`${where}: step ${step.methodId} does not say what it contributes`);
  }
  for (const step of bundle.optionalDepth || []) {
    if (!methodIds.has(step.methodId)) errors.push(`${where}: optional depth points to unknown method ${step.methodId}`);
    if (!step.adds) errors.push(`${where}: optional step ${step.methodId} does not say what it adds`);
  }
  if (steps.length && steps.every((step) => neverStandalone.has(step.methodId))) {
    errors.push(`${where}: every measurement in this bundle is one that cannot stand alone, so the bundle asserts nothing`);
  }
}
if (!(bundles.bundles || []).some((bundle) => (bundle.minimumBundle || []).some((step) => step.methodId === "bodipy-c11-assay"))) {
  errors.push("No evidence bundle places BODIPY 581/591 C11 inside a larger bundle; the probe must never be reachable as a standalone answer.");
}

// Assay comparison boxes. Each row must contrast both methods, and the box must cite the
// sources its rows were read from, so a comparison cannot be asserted from general knowledge.
for (const [index, comparison] of (bundles.comparisons || []).entries()) {
  const where = `evidence-bundles comparisons[${index}] ${comparison.id || "(no id)"}`;
  if (!comparison.id || !comparison.title || !comparison.question) errors.push(`${where}: id, title and question are required`);
  if ((comparison.methodIds || []).length !== 2) errors.push(`${where}: a comparison must name exactly two methods`);
  for (const id of comparison.methodIds || []) if (!methodIds.has(id)) errors.push(`${where}: unknown method ${id}`);
  if ((comparison.rows || []).length < 3) errors.push(`${where}: a comparison needs at least three axes to be useful`);
  for (const row of comparison.rows || []) {
    if (!row.axis || !row.bodipy || !row.lcms) errors.push(`${where}: every row must name an axis and describe both methods`);
  }
  if ((comparison.bottomLine || "").length < 40) errors.push(`${where}: a comparison must state a bottom line`);
  if ((comparison.boundary || "").length < 40) errors.push(`${where}: a comparison must state what it is not claiming`);
  if (!(comparison.evidence || []).length) errors.push(`${where}: a comparison must cite the sources its rows were read from`);
  for (const entry of comparison.evidence || []) {
    if (!/^https:\/\//.test(entry.url || "")) errors.push(`${where}: each evidence entry needs an HTTPS source`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.checkedAt || "")) errors.push(`${where}: each evidence entry needs an ISO check date`);
    if (!entry.checkedBy || !(entry.scope || []).length) errors.push(`${where}: each evidence entry needs a reader and a read scope`);
  }
}
if (!(bundles.comparisons || []).some((entry) => (entry.methodIds || []).includes("bodipy-c11-assay") && (entry.methodIds || []).includes("oxidized-pl-lcms"))) {
  errors.push("The BODIPY C11 versus direct oxidised-phospholipid comparison box is required by the round-4 handoff and is missing.");
}

const html = await fs.readFile(path.join(root, "index.html"), "utf8");
if (!html.includes('<html lang="en">')) errors.push("index.html is not declared English");
for (const file of ["methods.json", "glossary.json", "knowledge-network.json", "resources.json", "labs-en.json", "signal-briefs-en.json"]) {
  // A missing file has to be reported, not thrown: an unhandled rejection here would kill
  // the process before the manifest and ownership gate below ever runs.
  const stat = await fs.stat(path.join(root, "data", file)).catch(() => null);
  if (!html.includes("app.js") || !stat?.isFile()) errors.push(`Missing v0.9 data file: ${file}`);
}

// ------------------------------------------------- manifest, ownership and review gate
//
// The manifest used to say a dataset could not enter without an owner while storing no
// owner at all, and a review date could stay fresh while the file underneath it changed.
// Both are now enforced: an owner is a required field, and a curated or archive dataset
// is pinned to a fingerprint of the exact bytes that were reviewed.

const today = new Date().toISOString().slice(0, 10);
const semver = /^\d+\.\d+\.\d+$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const sha256Hex = /^[0-9a-f]{64}$/;
const staleAfterDays = 400;
const daysSince = (date) => Math.floor((Date.parse(today) - Date.parse(date)) / 86_400_000);
const digestOf = async (file) => crypto.createHash("sha256").update(await fs.readFile(path.join(root, "data", file))).digest("hex");

const manifest = await read("schema-versions.json");
if (!semver.test(manifest.schemaVersion || "")) errors.push("schema-versions.json has no valid schemaVersion");
if (!isoDate.test(manifest.updatedAt || "")) errors.push("schema-versions.json has no valid updatedAt date");
if (manifest.fingerprint?.algorithm !== "sha256") errors.push("schema-versions.json must declare sha256 as the review fingerprint algorithm");
const knownOwners = new Set(Object.keys(manifest.owners || {}));
if (!knownOwners.size) errors.push("schema-versions.json declares no owners, so no dataset can name an accountable owner");

const onDisk = (await fs.readdir(path.join(root, "data"))).filter((file) => file.endsWith(".json")).sort();
const registered = Object.keys(manifest.files || {}).sort();
for (const file of onDisk) if (!registered.includes(file)) errors.push(`Unregistered data file: ${file}. Add it to data/schema-versions.json with an owner and a review date.`);
for (const file of registered) if (!onDisk.includes(file)) errors.push(`schema-versions.json registers a missing data file: ${file}`);

for (const [file, entry] of Object.entries(manifest.files || {})) {
  if (!semver.test(entry.schemaVersion || "")) errors.push(`${file} has no valid schemaVersion in the manifest`);
  if (!["array", "object"].includes(entry.shape)) errors.push(`${file} declares an unknown shape: ${entry.shape}`);
  if (!["curated", "generated", "archive"].includes(entry.maintenance)) errors.push(`${file} declares an unknown maintenance mode: ${entry.maintenance}`);
  if (!entry.purpose) errors.push(`${file} has no stated purpose in the manifest`);

  // Ownership applies to every dataset, generated or not: somebody is accountable for
  // what it publishes even when a script wrote the bytes.
  if (!entry.owner) errors.push(`${file} has no owner in the manifest; a dataset cannot enter the site without an accountable owner`);
  else if (!knownOwners.has(entry.owner)) errors.push(`${file} names an owner that is not declared in manifest.owners: ${entry.owner}`);

  if (entry.maintenance === "generated") {
    if (!entry.generator) errors.push(`${file} is generated but names no generator script`);
    else if (!(await fs.stat(path.join(root, entry.generator)).catch(() => null))) errors.push(`${file} names a generator that does not exist: ${entry.generator}`);
    if (!semver.test(entry.generatorVersion || "")) errors.push(`${file} is generated but declares no valid generatorVersion`);
    // A generated file must not borrow the credibility of a human review it never had.
    if ("reviewer" in entry || "reviewedAt" in entry || "reviewedContentSha256" in entry) {
      errors.push(`${file} is generated and must not claim a reviewer, a review date or a review fingerprint`);
    }
    if (!onDisk.includes(file)) continue;
    const contents = await read(file);
    const shape = Array.isArray(contents) ? "array" : "object";
    if (shape !== entry.shape) errors.push(`${file} is an ${shape} but the manifest declares ${entry.shape}`);
    if (!Array.isArray(contents) && contents.generatorVersion && contents.generatorVersion !== entry.generatorVersion) {
      errors.push(`${file} was written by generator version ${contents.generatorVersion} but the manifest declares ${entry.generatorVersion}`);
    }
    continue;
  }

  // Curated and archive datasets carry a named reviewer or an explicit pending flag.
  const reviewed = Boolean(entry.reviewer);
  if (!("reviewer" in entry)) errors.push(`${file} has no reviewer field; record a reviewer or set reviewer: null with reviewPending: true`);
  else if (entry.reviewer === null) {
    if (entry.reviewPending !== true) errors.push(`${file} has no reviewer and does not declare reviewPending: true`);
  } else if (!knownOwners.has(entry.reviewer)) errors.push(`${file} names a reviewer that is not declared in manifest.owners: ${entry.reviewer}`);
  else if (entry.reviewer === entry.owner) errors.push(`${file} lists the same party as owner and reviewer; a review has to be independent of the owner`);
  else if (entry.reviewPending === true) errors.push(`${file} names a reviewer and also declares reviewPending; a dataset is one or the other`);

  if (!isoDate.test(entry.reviewedAt || "")) { errors.push(`${file} has no valid reviewedAt date`); continue; }
  if (entry.reviewedAt > today) errors.push(`${file} carries a review date in the future: ${entry.reviewedAt}`);
  else if (daysSince(entry.reviewedAt) > staleAfterDays) errors.push(`${file} was last reviewed ${daysSince(entry.reviewedAt)} days ago; re-check it and update the manifest.`);
  if (!onDisk.includes(file)) continue;
  const contents = await read(file);
  const shape = Array.isArray(contents) ? "array" : "object";
  if (shape !== entry.shape) errors.push(`${file} is an ${shape} but the manifest declares ${entry.shape}`);

  // The manifest cannot fingerprint itself: writing the digest would change the bytes.
  if (entry.selfDescribing === true) continue;
  if (!("reviewedContentSha256" in entry)) {
    errors.push(`${file} declares no reviewedContentSha256, so its review date is not tied to any content`);
  } else if (!reviewed) {
    // Nothing was reviewed, so there are no reviewed bytes to pin. Recording a digest
    // here would manufacture exactly the false assurance this gate exists to prevent.
    if (entry.reviewedContentSha256 !== null) errors.push(`${file} is awaiting review but records a review fingerprint; a fingerprint asserts that somebody read these exact bytes`);
  } else if (entry.reviewedContentSha256 === null) {
    errors.push(`${file} names a reviewer but records no review fingerprint. Run "npm run seal -- --reviewer=${entry.reviewer} ${file}" to pin the reviewed bytes.`);
  } else if (!sha256Hex.test(entry.reviewedContentSha256)) {
    errors.push(`${file} has a malformed reviewedContentSha256: ${entry.reviewedContentSha256}`);
  } else {
    const actual = await digestOf(file);
    if (actual !== entry.reviewedContentSha256) {
      errors.push(`${file} changed since it was reviewed on ${entry.reviewedAt} (recorded ${entry.reviewedContentSha256.slice(0, 12)}…, found ${actual.slice(0, 12)}…). Re-review it and run "npm run seal -- --reviewer=${entry.reviewer} ${file}".`);
    }
  }
}

const archived = await read("lab-research.json");
if (archived.schemaVersion !== manifest.files["lab-research.json"].schemaVersion) errors.push("lab-research.json schemaVersion disagrees with the manifest");
const metaRecord = await read("meta.json");
if (!metaRecord.generatedAt || Number.isNaN(Date.parse(metaRecord.generatedAt))) errors.push("meta.json has no parsable generatedAt timestamp");
else if (Date.parse(metaRecord.generatedAt) > Date.now() + 86_400_000) errors.push(`meta.json generatedAt is in the future: ${metaRecord.generatedAt}`);
for (const source of metaRecord.sources || []) {
  if (!source.lastAttemptAt || Number.isNaN(Date.parse(source.lastAttemptAt))) errors.push(`Source status ${source.name} has no parsable lastAttemptAt timestamp`);
  if (source.lastSuccessAt && Number.isNaN(Date.parse(source.lastSuccessAt))) errors.push(`Source status ${source.name} has an unparsable lastSuccessAt timestamp`);
}
for (const resource of resources) {
  if (!isoDate.test(resource.checkedAt || "")) errors.push(`Resource ${resource.id} has a non-ISO checkedAt date: ${resource.checkedAt}`);
  else if (resource.checkedAt > today) errors.push(`Resource ${resource.id} carries a check date in the future: ${resource.checkedAt}`);
}

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
const sealed = Object.values(manifest.files).filter((entry) => sha256Hex.test(entry.reviewedContentSha256 || "")).length;
const pendingReview = Object.entries(manifest.files).filter(([, entry]) => entry.reviewPending === true).map(([file]) => file);
if (pendingReview.length) console.warn(`Datasets owned but awaiting independent review: ${pendingReview.join(", ")}`);
console.log(`FerroScope v0.9 validation passed: ${labsEn.length} English lab profiles, ${methods.length} methods, ${glossary.length} trilingual terms, ${network.mechanisms.length} mechanism nodes, ${resources.length} external resources, ${briefs.length} English curated briefs and ${sealed} sealed review fingerprints.`);
console.log(
  `Method decision schema: ${methodFieldsChecked} source-checked and ${methodFieldsPending} pending-source-review fields across ${methods.length} modules ` +
    `(${METHOD_DECISION_AXES.length} axes each); laboratory capability ${capabilityDemonstrated} demonstrated by a source-checked claim ` +
    `(${capabilityUnlisted} of them for laboratories the curated shortlist does not list), ${capabilityClaimed} curated claims without evidence.`,
);
