// The canonical source / scope / review-event registry (round-6 P0-A … P0-D).
//
// Round 5 gave each method module stable-looking ids, but the same source record and the
// same review event were copied into several modules and into the paper layer. Each copy
// could carry a different scope set — or a forged version — and still pass validation,
// because nothing joined the copies. This module is the join.
//
//   One source has one source record.
//   One reading has one review event.
//   Every paper, method, notice, graph edge and UI statement resolves those same objects
//   instead of embedding a private authority copy.
//
// It also replaces the false "verification depth" ladder (which ranked a Results paragraph
// below a Methods paragraph as if one were a deeper reading of the other) with two
// independent facts: which document surface was opened (`surfaceType`) and how much of that
// surface (`accessExtent`). A legacy verification depth is still derived from the surface so
// the older counts keep working, but it is no longer the statement a reader is shown.
//
// scripts/*.mjs import this in Node; app.js imports it in the browser. It therefore uses no
// Node built-in and never constructs a Date.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS = /^https:\/\//;
const SHA256 = /^[0-9a-f]{64}$/;

// The controlled surface vocabulary. It covers at least the surfaces the round-6 handoff
// named, plus `body-text` for narrative sections (Introduction, Discussion) that are neither
// Methods nor Results. A surface is *what was opened*, never *how deep the reading was*.
export const SURFACE_TYPES = [
  "metadata-record",
  "abstract-text",
  "results-text",
  "body-text",
  "figure-caption",
  "figure-panel",
  "methods-text",
  "supplement-text",
  "supplement-data",
  "correction-text",
  "vendor-description",
  "vendor-specifications",
  "vendor-faq",
  "full-document",
  "raw-data",
];

export const ACCESS_EXTENTS = ["not-opened", "partial-scope", "complete-scope"];

export const REGISTRY_REVIEW_STATES = ["recorded-unverified", "archive-derived", "source-checked", "independently-rechecked"];
export const AGREEMENTS = ["agrees", "partly-agrees", "disagrees"];

// How the reader sees a surface. Deliberately descriptive, not ordinal: "Results section
// text" and "Methods section text" are siblings, not steps on a ladder.
export const SURFACE_TYPE_LABELS = {
  "metadata-record": "Metadata record",
  "abstract-text": "Abstract text",
  "results-text": "Results section text",
  "body-text": "Body section text",
  "figure-caption": "Figure caption",
  "figure-panel": "Rendered figure panel",
  "methods-text": "Methods section text",
  "supplement-text": "Supplement text",
  "supplement-data": "Supplement data",
  "correction-text": "Correction-notice text",
  "vendor-description": "Vendor product description",
  "vendor-specifications": "Vendor specifications",
  "vendor-faq": "Vendor FAQ",
  "full-document": "Full document",
  "raw-data": "Raw data",
};

export const ACCESS_EXTENT_LABELS = {
  "not-opened": "not opened",
  "partial-scope": "read in part",
  "complete-scope": "read in full",
};

// The legacy ordinal depth, derived from a surface so old counts and the graph's internal
// state ceiling keep working. It is not shown to a reader and it is not a ranking of one
// surface against another; two different surfaces can map to the same bucket.
const SURFACE_TO_DEPTH = {
  "metadata-record": "metadata-checked",
  "abstract-text": "abstract-checked",
  "results-text": "methods-checked",
  "body-text": "methods-checked",
  "figure-caption": "figures-legends-checked",
  "figure-panel": "figures-legends-checked",
  "methods-text": "methods-checked",
  "supplement-text": "supplement-checked",
  "supplement-data": "supplement-checked",
  "correction-text": "full-text-rechecked",
  "vendor-description": "full-text-rechecked",
  "vendor-specifications": "full-text-rechecked",
  "vendor-faq": "full-text-rechecked",
  "full-document": "full-text-rechecked",
  "raw-data": "raw-data-rechecked",
};

export const surfaceToDepth = (surfaceType) => SURFACE_TO_DEPTH[surfaceType] || "not-read";
export const isVendorSurface = (surfaceType) => surfaceType === "vendor-description" || surfaceType === "vendor-specifications" || surfaceType === "vendor-faq";

// An event with a prior event it reproduces is an independent recheck; otherwise it is a
// first reading. The distinction is structural, never a status string a caller can set.
export const isIndependentEvent = (event) => Boolean(event && event.priorReviewEventId);
export const isCheckedState = (state) => state === "source-checked" || state === "independently-rechecked";

// ---------------------------------------------------------------- structural validation

// Validates the whole registry: every source, every scope inside it, every review event and
// every independent-review chain. Returns a flat problem list; an empty list means the
// registry is internally consistent and every id resolves.
export function validateRegistry(registry, { owner = registry?.owner } = {}) {
  const problems = [];
  if (!registry || typeof registry !== "object") return ["source registry: no registry object was supplied"];

  const reviewerIds = new Set((registry.reviewers || []).map((reviewer) => reviewer.id));
  if (!reviewerIds.size) problems.push("source registry: declares no reviewers, so no event can name an accountable reader");
  if (!owner) problems.push("source registry: declares no owner, so an independent recheck cannot exclude the owner");

  // ---- sources and their scopes: globally unique source id, unique scope id within a source
  const sources = new Map();
  const scopeKeys = new Set();
  // "One source → one source record" has to hold on the bytes, not only on the id. Otherwise a
  // second record with the same URL and sha256 but a different identifiers.doi lets one document
  // masquerade as belonging to a second paper — the duplicate-bytes borrow the audit found. A
  // URL and a content hash each identify at most one source record.
  const sourcesByUrl = new Map();
  const sourcesBySha = new Map();
  for (const [index, source] of (registry.sources || []).entries()) {
    const where = `source[${index}] ${source.id || "(no id)"}`;
    if (!source.id) { problems.push(`${where}: a source needs a stable id`); continue; }
    if (sources.has(source.id)) {
      const other = sources.get(source.id);
      // The exact acceptance attack from the review: a second source with an existing id but
      // different bytes or URL must fail rather than silently shadow the first.
      problems.push(`${where}: duplicate source id ${source.id}` + (other.url !== source.url || other.version?.sha256 !== source.version?.sha256 ? " with a different URL or content hash — a forged second record for one id" : ""));
      continue;
    }
    sources.set(source.id, source);
    if (source.url) {
      if (sourcesByUrl.has(source.url)) problems.push(`${where}: shares its URL with source ${sourcesByUrl.get(source.url)}; one document is one source record, so a second record for the same URL is a forged duplicate`);
      else sourcesByUrl.set(source.url, source.id);
    }
    const sha = source.version?.sha256;
    if (sha) {
      if (sourcesBySha.has(sha)) problems.push(`${where}: shares its sha256 with source ${sourcesBySha.get(sha)}; identical bytes are one source record, so a second record for the same hash is a forged duplicate`);
      else sourcesBySha.set(sha, source.id);
    }

    if (!source.documentClass) problems.push(`${where}: a source needs a documentClass`);
    if (!HTTPS.test(source.url || "")) problems.push(`${where}: a source needs an HTTPS url`);
    const version = source.version || {};
    if (!version.label) problems.push(`${where}: a source must pin the version/retrieval it names`);
    if (!ISO_DATE.test(version.retrievedAt || "")) problems.push(`${where}: a source version needs an ISO retrievedAt date`);
    if ("sha256" in version && version.sha256 !== null && !SHA256.test(version.sha256)) problems.push(`${where}: a recorded sha256 must be 64 hex characters`);
    if ("byteLength" in version && version.byteLength !== null && !(Number.isInteger(version.byteLength) && version.byteLength >= 0)) problems.push(`${where}: byteLength must be a non-negative integer when recorded`);

    const localScopes = new Set();
    for (const [si, scope] of (source.scopes || []).entries()) {
      const sw = `${where} scope[${si}] ${scope.id || "(no id)"}`;
      if (!scope.id) { problems.push(`${sw}: a scope needs a stable id`); continue; }
      if (localScopes.has(scope.id)) { problems.push(`${sw}: duplicate scope id within ${source.id}`); continue; }
      localScopes.add(scope.id);
      scopeKeys.add(`${source.id}|${scope.id}`);
      if (!scope.label) problems.push(`${sw}: a scope needs a human-readable label`);
      if (!SURFACE_TYPES.includes(scope.surfaceType)) problems.push(`${sw}: surfaceType must be one of ${SURFACE_TYPES.join(", ")}`);
      if (!ACCESS_EXTENTS.includes(scope.accessExtent)) problems.push(`${sw}: accessExtent must be one of ${ACCESS_EXTENTS.join(", ")}`);
      if (!scope.boundary) problems.push(`${sw}: a scope must state what opening it did not establish`);
    }
  }

  // ---- review events: globally unique event id; source and scopes resolve; chains hold
  const events = new Map();
  for (const [index, event] of (registry.reviewEvents || []).entries()) {
    const where = `reviewEvent[${index}] ${event.id || "(no id)"}`;
    if (!event.id) { problems.push(`${where}: a review event needs a stable id`); continue; }
    if (events.has(event.id)) { problems.push(`${where}: duplicate review event id ${event.id}`); continue; }
    events.set(event.id, event);

    const source = sources.get(event.sourceId);
    if (!source) { problems.push(`${where}: names a source ${JSON.stringify(event.sourceId)} that is not in the registry`); continue; }
    if (!REGISTRY_REVIEW_STATES.includes(event.reviewState)) problems.push(`${where}: reviewState must be one of ${REGISTRY_REVIEW_STATES.join(", ")}`);
    if (!reviewerIds.has(event.reviewerId)) problems.push(`${where}: names a reviewer ${JSON.stringify(event.reviewerId)} not declared in registry.reviewers`);
    if (!ISO_DATE.test(event.checkedAt || "")) problems.push(`${where}: a review event needs an ISO checkedAt date`);
    if (!event.boundary) problems.push(`${where}: a review event must state what it did not cover`);

    const scopeById = new Map((source.scopes || []).map((scope) => [scope.id, scope]));
    const scopeIds = event.scopeIds || [];
    if (isCheckedState(event.reviewState) && !scopeIds.length) problems.push(`${where}: a checked event must name at least one reviewed scope`);
    for (const scopeId of scopeIds) {
      const scope = scopeById.get(scopeId);
      if (!scope) { problems.push(`${where}: names a scope ${JSON.stringify(scopeId)} that source ${source.id} does not declare`); continue; }
      // A reading cannot cover a surface nobody opened. A checked event citing a scope whose
      // accessExtent is "not-opened" is a reading of nothing, so it is rejected here rather
      // than allowed to promote an edge to source-checked.
      if (isCheckedState(event.reviewState) && scope.accessExtent === "not-opened") {
        problems.push(`${where}: cites scope ${JSON.stringify(scopeId)} whose accessExtent is "not-opened"; a checked reading cannot rest on an unopened surface`);
      }
    }

    // A review event is an independent recheck exactly when it names a prior event. The
    // reviewState and the structure must agree, so an ordinary reading cannot be dressed as a
    // second one and a recheck cannot hide as an ordinary reading.
    const declaresPrior = Boolean(event.priorReviewEventId);
    if (declaresPrior && event.reviewState !== "independently-rechecked") {
      problems.push(`${where}: names a prior review event but its reviewState is ${JSON.stringify(event.reviewState)}; an event that reproduces another must be "independently-rechecked"`);
    }
    if (!declaresPrior && event.reviewState === "independently-rechecked") {
      problems.push(`${where}: declares reviewState "independently-rechecked" but names no priorReviewEventId, so there is no first reading it reproduces`);
    }
  }

  // Independent chains need every prior id present, so they are validated after the id set is
  // known. A second reading names the same source, a later date, a different reader and an
  // overlapping, resolvable scope set — or it is rejected.
  for (const event of events.values()) {
    if (!isIndependentEvent(event)) continue;
    problems.push(...validateIndependentEvent(event, { registry, events, owner }));
  }

  return problems;
}

// Validates one independent-review event against the event it claims to reproduce. Exported so
// the method-review mutation tests can break each rule in isolation. `events` is an optional
// pre-built id→event map; when absent it is built from the registry.
export function validateIndependentEvent(event, { registry, events, owner = registry?.owner } = {}) {
  const problems = [];
  const where = `independent review ${event.id || "(no id)"}`;
  const eventMap = events || new Map((registry?.reviewEvents || []).map((entry) => [entry.id, entry]));
  const sourceMap = new Map((registry?.sources || []).map((entry) => [entry.id, entry]));

  if (!event.priorReviewEventId) { problems.push(`${where}: an independent recheck must name the prior review event it reproduces`); return problems; }
  const prior = eventMap.get(event.priorReviewEventId);
  if (!prior) { problems.push(`${where}: the prior review event ${JSON.stringify(event.priorReviewEventId)} does not resolve to a real event`); return problems; }

  if (!event.id) problems.push(`${where}: the recheck needs its own id`);
  else if (event.id === event.priorReviewEventId) problems.push(`${where}: the recheck id must differ from the prior event id`);

  // The chain must terminate at a genuine first reading, and it may not close on itself. Walk
  // it: a repeated id is a cycle (A reproduces B reproduces A), and a chain that never reaches
  // a first reading (an event with no prior) is a recheck of nothing. Both are rejected — the
  // acyclicity guarantee the earlier contract lacked.
  const seen = new Set([event.id]);
  for (let cursor = prior; cursor; cursor = eventMap.get(cursor.priorReviewEventId)) {
    if (seen.has(cursor.id)) { problems.push(`${where}: the recheck chain is circular at ${JSON.stringify(cursor.id)}; a second reading cannot reproduce a chain that leads back to itself`); break; }
    seen.add(cursor.id);
    if (!cursor.priorReviewEventId) break; // reached a genuine first reading
  }

  // The event it reproduces must itself be a real reading. Reproducing an unopened or
  // archive-derived record is not an independent recheck of a source.
  if (!isCheckedState(prior.reviewState)) {
    problems.push(`${where}: reproduces ${JSON.stringify(prior.id)}, which is ${JSON.stringify(prior.reviewState)}; an independent recheck must reproduce a checked reading, not an unopened or archive-derived record`);
  }

  // Byte identity is the whole claim of an independent recheck: two readers opened the same
  // bytes. Without a pinned sha256 on the shared source that claim is unprovable, so a recheck
  // may not resolve to an unhashed source.
  const recheckSource = sourceMap.get(event.sourceId);
  if (recheckSource && (!recheckSource.version || recheckSource.version.sha256 == null)) {
    problems.push(`${where}: source ${JSON.stringify(event.sourceId)} has no pinned sha256, so an independent recheck cannot prove the two readers opened the same bytes`);
  }

  if (event.sourceId !== prior.sourceId) problems.push(`${where}: an independent recheck must cover the same source as the event it reproduces (${prior.sourceId}), not ${JSON.stringify(event.sourceId)}`);
  // Bytes live on the source, so the same sourceId is the same pinned version. Making that
  // explicit means a recheck that points at a differently-hashed source is already rejected
  // above; there is no per-event version string a caller could forge.
  if (!event.reviewerId) problems.push(`${where}: an independent recheck must name its reviewer`);
  else {
    if (owner && event.reviewerId === owner) problems.push(`${where}: an independent recheck may not be signed by the dataset owner`);
    if (event.reviewerId === prior.reviewerId) problems.push(`${where}: an independent recheck must use a different reviewer from the prior event`);
  }
  if (!ISO_DATE.test(event.checkedAt || "")) problems.push(`${where}: an independent recheck needs an ISO checkedAt date`);
  else if (prior.checkedAt && event.checkedAt < prior.checkedAt) problems.push(`${where}: an independent recheck cannot predate the event it reproduces (${prior.checkedAt})`);

  const source = sourceMap.get(event.sourceId);
  const sourceScopeIds = new Set((source?.scopes || []).map((scope) => scope.id));
  const scopeIds = event.scopeIds || [];
  const priorScopeIds = new Set(prior.scopeIds || []);
  if (!scopeIds.length) problems.push(`${where}: an independent recheck must cover at least one scope`);
  for (const scopeId of scopeIds) if (!sourceScopeIds.has(scopeId)) problems.push(`${where}: names a scope ${JSON.stringify(scopeId)} that source ${event.sourceId} does not declare`);
  if (scopeIds.length && !scopeIds.some((scopeId) => priorScopeIds.has(scopeId))) problems.push(`${where}: the recheck's scopes do not overlap the prior event's reviewed scopes`);

  if (!AGREEMENTS.includes(event.agreement)) problems.push(`${where}: an independent recheck must record agreement as one of ${AGREEMENTS.join(", ")}`);
  else if (event.agreement !== "agrees" && !event.discrepancyNote) problems.push(`${where}: a recheck that does not fully agree must record a discrepancy note`);

  return problems;
}

// ------------------------------------------------------------------------- resolution

// A read-through view over the registry. Consumers hold only ids; the resolver turns an id
// into the one canonical record. Nothing here mutates the registry.
export function createResolver(registry) {
  const sources = new Map((registry?.sources || []).map((source) => [source.id, source]));
  const events = new Map((registry?.reviewEvents || []).map((event) => [event.id, event]));
  const reviewers = new Map((registry?.reviewers || []).map((reviewer) => [reviewer.id, reviewer]));

  const source = (sourceId) => sources.get(sourceId) || null;
  const event = (eventId) => events.get(eventId) || null;
  const reviewer = (reviewerId) => reviewers.get(reviewerId) || null;

  const scope = (sourceId, scopeId) => {
    const record = sources.get(sourceId);
    if (!record) return null;
    const entry = (record.scopes || []).find((item) => item.id === scopeId);
    if (!entry) return null;
    return { ...entry, verificationDepth: surfaceToDepth(entry.surfaceType) };
  };

  const reviewerName = (reviewerId) => reviewers.get(reviewerId)?.name || reviewerId || null;

  // The prior event of an independent recheck, or null for a first reading.
  const priorEvent = (eventId) => {
    const record = events.get(eventId);
    return record?.priorReviewEventId ? events.get(record.priorReviewEventId) || null : null;
  };

  return {
    registry,
    owner: registry?.owner || null,
    source,
    event,
    reviewer,
    reviewerName,
    scope,
    priorEvent,
    isIndependent: (eventId) => isIndependentEvent(events.get(eventId)),
    sourceIds: () => [...sources.keys()],
    eventIds: () => [...events.keys()],
  };
}
