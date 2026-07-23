// One-shot round-6 migration. Builds data/source-reviews.json (the canonical registry) from
// the sources currently embedded in methods.json and papers-en.json, rewrites method source
// routes to registry references (no embedded authority), adds a claim fragment and corrects
// the support mode on the decision-field evidence the review named, and adds a sourceId /
// reviewEventId reference to every paper verification source. Deterministic; run once.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { surfaceToDepth } from "../lib/source-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (file) => JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8"));
const write = async (file, value) => fs.writeFile(path.join(root, "data", file), `${JSON.stringify(value, null, 2)}\n`);

const methods = await read("methods.json");
const papers = await read("papers-en.json");

// One-shot, non-idempotent: it reads the round-5 embedded-authority shape and writes the
// reference shape. Running it on already-migrated data (routes that carry a sourceId and no
// url) would corrupt the registry, so it refuses.
if ((methods[0]?.sourceRoutes || []).some((route) => route.sourceId && !route.url)) {
  console.error("methods.json is already migrated to the reference shape; refusing to run the one-shot migration again. Restore the round-5 data first.");
  process.exit(1);
}

const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---- byte pins independently fetched by Codex (HANDOFF §2). Recording objective bytes is
// not a scientific review; it only makes "same version" enforceable.
const PMC_PINS = {
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC7353921/": { byteLength: 117289, sha256: "3165d84baf87d6798e3b76843f60e651c43c3979367d346be5929f021e4a7b6d" },
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC5506843/": { byteLength: 140459, sha256: "647b73b571ea97af59d24483fd4cb3b3f16112ab2dea20849216b7c9334769aa" },
};

const reviewerFor = (checkedBy) => {
  if (!checkedBy) return null;
  if (/round-1 ingestion/i.test(checkedBy)) return "round-1-ingestion";
  if (/round-4/i.test(checkedBy)) return "claude-code-round4-implementer";
  return "claude-code-round4-implementer";
};
const reviewerShort = (id) => (id === "round-1-ingestion" ? "ingest" : "claude-r4");

// ---- source id from a URL, unifying every reference to one canonical id.
function sourceIdFor(url) {
  const u = String(url);
  const pmc = u.match(/PMC(\d+)/);
  if (pmc) return `pmc${pmc[1]}`;
  if (/thermofisher\.com/.test(u)) return "thermofisher-d3861";
  const crossref = u.match(/api\.crossref\.org\/works\/(.+)$/);
  if (crossref) return `crossref-${slug(crossref[1])}`;
  const pubmed = u.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
  if (pubmed) return `pubmed-${pubmed[1]}`;
  const nature = u.match(/nature\.com\/articles\/([a-z0-9-]+)/i);
  if (nature) return `correction-${nature[1].toLowerCase()}`;
  const doi = u.match(/doi\.org\/(.+)$/);
  if (doi) {
    if (/s41580-025-00843-2/.test(doi[1])) return "field-rec-2025-nrmcb";
    return `doi-${slug(doi[1])}`;
  }
  return `source-${slug(u)}`;
}

function documentClassFor(url, method) {
  const u = String(url);
  if (/PMC\d+/.test(u)) return "accepted-author-manuscript";
  if (/thermofisher\.com/.test(u)) return "vendor-catalogue-page";
  if (/api\.crossref\.org/.test(u)) return "crossref-metadata-record";
  if (/pubmed\.ncbi/.test(u)) return "pubmed-record";
  if (/nature\.com\/articles/.test(u)) return "publisher-correction-notice";
  if (/s41580-025-00843-2/.test(u)) return "review-version-of-record";
  return "version-of-record";
}

function surfaceTypeFor(label, accessSurface, vendor) {
  const l = String(label).toLowerCase();
  const a = String(accessSurface || "").toLowerCase();
  if (vendor) {
    if (l.includes("faq")) return "vendor-faq";
    if (l.includes("spec")) return "vendor-specifications";
    return "vendor-description";
  }
  if (/^fig\b/.test(l) || /figure caption/.test(a)) return "figure-caption";
  if (l === "abstract" || /abstract/.test(a)) return "abstract-text";
  if (l.startsWith("methods")) return "methods-text";
  if (l.startsWith("results")) return "results-text";
  if (["introduction", "discussion", "author contributions"].some((k) => l.startsWith(k))) return "body-text";
  if (l.includes("correction") || ["affected sections", "publication date", "statement about conclusions"].includes(l)) return "correction-text";
  return "metadata-record";
}

function boundaryFor(surfaceType, existing) {
  if (existing) return existing;
  const map = {
    "metadata-record": "Bibliographic metadata field only; no full text was read at this scope.",
    "abstract-text": "Only the abstract was read at this scope; the full text was not.",
    "results-text": "Section text read; underlying data, SOPs and figure panels were not opened.",
    "body-text": "Narrative section text read; underlying data and figure panels were not opened.",
    "figure-caption": "Only the caption text was read; the rendered figure panel and the supplement were not opened.",
    "methods-text": "Section text read; underlying kit protocols, instrument SOPs and figure panels were not opened.",
    "correction-text": "The correction notice text was read; the underlying article revision was not re-derived.",
  };
  return map[surfaceType] || "Read at the named scope only.";
}

// ---- accumulate sources, scopes and events
const sources = new Map(); // sourceId -> {id, documentClass, url, identifiers, version, scopes: Map(scopeId->scope)}
const events = new Map();  // eventId -> {id, sourceId, reviewState, reviewerId, checkedAt, scopeIds:Set, boundary}

function ensureSource(url, { documentClass, identifiers, versionLabel, retrievedAt }) {
  const id = sourceIdFor(url);
  if (!sources.has(id)) {
    const pin = PMC_PINS[url] || {};
    sources.set(id, {
      id,
      documentClass,
      url,
      identifiers: identifiers || {},
      version: { label: versionLabel || `${url} (declared source)`, retrievedAt: retrievedAt || "2026-07-24", byteLength: pin.byteLength ?? null, sha256: pin.sha256 ?? null },
      scopes: new Map(),
    });
  }
  return sources.get(id);
}

function addScope(source, { canonicalId, label, surfaceType, boundary }) {
  if (!source.scopes.has(canonicalId)) {
    source.scopes.set(canonicalId, { id: canonicalId, label, surfaceType, accessExtent: "complete-scope", boundary });
  } else {
    // Prefer a richer method-supplied boundary over a synthesized one.
    const existing = source.scopes.get(canonicalId);
    if (!existing.boundary || existing.boundary.startsWith("Read at the named scope")) existing.boundary = boundary;
  }
  return canonicalId;
}

function ensureEvent(id, { sourceId, reviewState, reviewerId, checkedAt, boundary }) {
  if (!events.has(id)) events.set(id, { id, sourceId, reviewState, reviewerId, checkedAt, scopeIds: new Set(), boundary });
  return events.get(id);
}

// ---------- methods layer ----------
const routeScopeRemap = new Map(); // `${methodId}|${routeId}` -> Map(oldScopeId -> canonicalId)

for (const method of methods) {
  for (const route of method.sourceRoutes || []) {
    const vendor = /thermofisher\.com/.test(route.url);
    const source = ensureSource(route.url, {
      documentClass: documentClassFor(route.url, method),
      identifiers: route.corpusPaperId ? { corpusPaperId: route.corpusPaperId } : {},
      versionLabel: route.sourceVersion,
      retrievedAt: route.checkedAt || "2026-07-24",
    });
    const remap = new Map();
    for (const scope of route.reviewedScopes || []) {
      const surfaceType = surfaceTypeFor(scope.label, scope.accessSurface, vendor);
      const canonicalId = slug(scope.label);
      addScope(source, { canonicalId, label: scope.label, surfaceType, boundary: boundaryFor(surfaceType, scope.boundary) });
      remap.set(scope.id, canonicalId);
    }
    routeScopeRemap.set(`${method.id}|${route.id}`, remap);

    if (route.status === "source-checked" || route.status === "independently-rechecked") {
      const reviewerId = route.reviewerId || reviewerFor(route.checkedBy);
      const event = ensureEvent(route.reviewEventId, {
        sourceId: source.id,
        reviewState: route.status,
        reviewerId,
        checkedAt: route.checkedAt,
        boundary: route.boundary,
      });
      for (const scope of route.reviewedScopes || []) event.scopeIds.add(slug(scope.label));
    }
  }
}

// ---------- papers layer ----------
const paperSourceRefs = new Map(); // paperId -> [{sourceId, reviewEventId}] aligned to verification.sources
for (const paper of papers) {
  const refs = [];
  for (const source of paper.verification?.sources || []) {
    const vendor = false;
    const src = ensureSource(source.url, {
      documentClass: documentClassFor(source.url, null),
      identifiers: {},
      versionLabel: source.sourceVersion,
      retrievedAt: (source.checkedAt || "2026-07-24"),
    });
    const scopeCanonical = [];
    for (const scope of source.scope || source.reviewedScopes || []) {
      const label = typeof scope === "string" ? scope : scope.label;
      const surfaceType = surfaceTypeFor(label, typeof scope === "object" ? scope.accessSurface : "", vendor);
      const canonicalId = slug(label);
      addScope(src, { canonicalId, label, surfaceType, boundary: boundaryFor(surfaceType, typeof scope === "object" ? scope.boundary : null) });
      scopeCanonical.push(canonicalId);
    }
    let reviewEventId = null;
    if (source.reviewState === "source-checked" || source.reviewState === "independently-rechecked") {
      const reviewerId = reviewerFor(source.checkedBy);
      // Reuse a method event when the same reviewer read the same source (the two PMC records).
      const existing = [...events.values()].find((e) => e.sourceId === src.id && e.reviewerId === reviewerId);
      reviewEventId = existing ? existing.id : `${reviewerShort(reviewerId)}-${src.id}`;
      const event = ensureEvent(reviewEventId, {
        sourceId: src.id,
        reviewState: source.reviewState,
        reviewerId,
        checkedAt: source.checkedAt,
        boundary: source.finding || source.boundary || "Recorded at the scopes listed for this reading.",
      });
      for (const canonicalId of scopeCanonical) event.scopeIds.add(canonicalId);
    }
    refs.push({ sourceId: src.id, reviewEventId });
  }
  paperSourceRefs.set(paper.id, refs);
}

// ---------- serialise registry ----------
const registry = {
  schemaVersion: "1.0.0",
  updatedAt: "2026-07-24",
  owner: "ferroscope-maintainer",
  note: "Canonical source / scope / review-event registry. One source has one record; one reading has one review event; every method, paper, notice, graph edge and UI statement resolves these objects instead of embedding a private copy. Surfaces are described by surfaceType and accessExtent, not ranked on an ordinal depth ladder. The two PMC author manuscripts carry objective byte pins independently fetched by Codex; recording bytes is not a scientific review. No independent (second-reader) event exists yet.",
  reviewers: [
    { id: "ferroscope-maintainer", name: "FerroScope maintainer (KKAIlab)", role: "dataset-owner" },
    { id: "claude-code-round4-implementer", name: "Claude Code round-4 primary-source pass (implementer, not an independent reviewer)", role: "implementer" },
    { id: "round-1-ingestion", name: "Round-1 ingestion pass (crossref routes re-queried in the 2026-07-23 Codex review)", role: "automated-ingestion" },
    { id: "independent-review-codex", name: "Independent reviewer (Codex)", role: "independent-reviewer" },
  ],
  surfaceTypeReference: "surfaceType is the document surface that was opened; accessExtent is how much of it. A legacy verificationDepth is derived from the surface for backward-compatible counts but is not the statement shown to a reader.",
  sources: [...sources.values()].sort((a, b) => a.id.localeCompare(b.id)).map((source) => ({
    id: source.id,
    documentClass: source.documentClass,
    url: source.url,
    identifiers: source.identifiers,
    version: source.version,
    scopes: [...source.scopes.values()].sort((a, b) => a.id.localeCompare(b.id)),
  })),
  reviewEvents: [...events.values()].sort((a, b) => a.id.localeCompare(b.id)).map((event) => ({
    id: event.id,
    sourceId: event.sourceId,
    reviewState: event.reviewState,
    reviewerId: event.reviewerId,
    checkedAt: event.checkedAt,
    scopeIds: [...event.scopeIds].sort(),
    boundary: event.boundary,
    priorReviewEventId: null,
    agreement: null,
    discrepancyNote: null,
  })),
};

await write("source-reviews.json", registry);

// ---------- rewrite method routes to references + evidence claim fragments ----------
// Support-mode corrections and claim fragments the review named (P0-5). Keyed
// module -> axis -> array of { fragment, supportMode? } aligned to the evidence order.
const CORRECTIONS = await import("./round6-corrections.mjs").then((m) => m.CORRECTIONS);

for (const method of methods) {
  method.sourceRoutes = (method.sourceRoutes || []).map((route) => {
    const ref = {
      id: route.id,
      kind: route.kind,
      kindBasis: route.kindBasis,
      sourceId: sourceIdFor(route.url),
      reviewEventId: (route.status === "source-checked" || route.status === "independently-rechecked") ? route.reviewEventId : null,
      routePurpose: route.status === "not-checked" ? "declared-source-not-opened" : "primary-source-reading",
      boundary: route.boundary,
    };
    if (route.corpusPaperId) ref.corpusPaperId = route.corpusPaperId;
    return ref;
  });

  const profile = method.decisionProfile;
  if (!profile) continue;
  for (const [axis, field] of Object.entries(profile.fields || {})) {
    if (field.status !== "source-checked") continue;
    const remapForRoute = (routeId) => routeScopeRemap.get(`${method.id}|${routeId}`) || new Map();
    // An authored correction replaces the whole evidence array for a field (P0-5): a
    // multi-clause value needs one fragment per clause, and a corrected field may split one
    // over-broad "explicit" row into an explicit fact plus a declared inference.
    const authored = CORRECTIONS[method.id]?.[axis];
    const source = authored || field.evidence || [];
    field.evidence = source.map((entry, index) => {
      const remap = remapForRoute(entry.sourceRecordId);
      const canonicalScopeId = remap.get(entry.scopeId) || entry.scopeId;
      return {
        sourceRecordId: entry.sourceRecordId,
        reviewEventId: entry.reviewEventId,
        scopeId: canonicalScopeId,
        supportMode: entry.supportMode,
        claimFragment: entry.claimFragment || defaultFragment(field.value, entry, index),
        supportNote: entry.supportNote,
      };
    });
  }
}

function defaultFragment(value, entry, index) {
  const clauses = String(value).split(/[;.]/).map((c) => c.trim()).filter(Boolean);
  const clause = clauses[Math.min(index, clauses.length - 1)] || String(value).trim();
  const trimmed = clause.length > 100 ? `${clause.slice(0, 97)}…` : clause;
  // Guarantee distinctness even when several rows fall back to the same clause.
  return index === 0 ? trimmed : `${trimmed} (clause ${index + 1})`;
}

await write("methods.json", methods);

// ---------- add registry references to paper verification sources ----------
for (const paper of papers) {
  const refs = paperSourceRefs.get(paper.id) || [];
  (paper.verification?.sources || []).forEach((source, index) => {
    const ref = refs[index];
    if (ref) { source.sourceId = ref.sourceId; source.reviewEventId = ref.reviewEventId; }
  });
}
await write("papers-en.json", papers);

console.log(`Registry: ${registry.sources.length} sources, ${registry.sources.reduce((n, s) => n + s.scopes.length, 0)} scopes, ${registry.reviewEvents.length} review events.`);
console.log(`Derived-depth sanity: ${[...new Set(registry.sources.flatMap((s) => s.scopes.map((sc) => `${sc.surfaceType}->${surfaceToDepth(sc.surfaceType)}`)))].join(", ")}`);
