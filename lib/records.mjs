// Shared record semantics for the ingestion pipeline and the public interface.
//
// scripts/update-data.mjs imports this in Node; app.js imports it in the browser and
// in the DOM test harness. It therefore stays free of Node built-ins and of any
// dependency on the ambient timezone: a calendar date is parsed as a calendar date
// and never round-tripped through `new Date()`.

// ------------------------------------------------------------------ calendar dates

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (value) => String(value).padStart(2, "0");

// PubMed and Crossref hand back "2025 Dec 4", "2025 Dec", "2025", "2025/12/04" and
// "2025-12-04 00:00". All of them describe a calendar date in the publisher's own
// frame, so they are decomposed textually. `new Date("2025 Dec 4")` would be read as
// local midnight and shifted by `toISOString()`, which loses a day east of UTC.
export function parseCalendarDate(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/);
  if (iso) {
    const [, year, month, day] = iso;
    if (Number(month) < 1 || Number(month) > 12) return null;
    if (day) return { date: `${year}-${pad(month)}-${pad(day)}`, precision: "day" };
    return { date: `${year}-${pad(month)}-01`, precision: "month" };
  }

  const named = text.match(/^(\d{4})\s+([A-Za-z]{3,})(?:\s+(\d{1,2}))?/);
  if (named) {
    const [, year, monthName, day] = named;
    const month = MONTHS[monthName.slice(0, 3).toLowerCase()];
    if (!month) return { date: `${year}-01-01`, precision: "year" };
    if (day) return { date: `${year}-${pad(month)}-${pad(day)}`, precision: "day" };
    return { date: `${year}-${pad(month)}-01`, precision: "month" };
  }

  const yearOnly = text.match(/^(\d{4})$/);
  if (yearOnly) return { date: `${yearOnly[1]}-01-01`, precision: "year" };

  return null;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Renders a stored calendar date for a reader. The ingestion parser is timezone-invariant,
// but a display layer can undo that in one line: `new Date("2025-12-04")` is UTC midnight,
// so a browser west of Greenwich formats it as 03 Dec. The components are therefore read
// out of the string and never turned into an instant.
//
// A full ISO timestamp is accepted and rendered as its UTC calendar day, which is the frame
// `generatedAt` was written in. Anything else returns null so the caller can decide, rather
// than being shown a date this function had to guess.
export function formatCalendarDate(value) {
  const match = String(value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/);
  if (!match) return null;
  const [, year, month, day] = match;
  const label = MONTH_LABELS[Number(month) - 1];
  if (!label || Number(day) < 1 || Number(day) > 31) return null;
  return `${day} ${label} ${year}`;
}

// Crossref returns date-parts as integers, which are already calendar components.
export function calendarDateFromParts(parts = []) {
  const [year, month, day] = parts;
  if (!year) return null;
  if (!month) return { date: `${year}-01-01`, precision: "year" };
  if (!day) return { date: `${year}-${pad(month)}-01`, precision: "month" };
  return { date: `${year}-${pad(month)}-${pad(day)}`, precision: "day" };
}

// PubMed carries an electronic date and an issue date that frequently disagree, and a
// record can carry only one of them. Both are kept so a later reader can tell which
// calendar the displayed date came from.
export function pubmedDates(item = {}, today = "") {
  const online = parseCalendarDate(item.epubdate);
  const issue = parseCalendarDate(item.pubdate);
  const sorted = parseCalendarDate(item.sortpubdate);
  const chosen = online || issue || sorted;
  if (!chosen) return { onlineDate: null, issueDate: null, displayDate: null, datePrecision: null };
  // A publisher-supplied date after today is a record-keeping artefact, not news.
  const displayDate = today && chosen.date > today ? today : chosen.date;
  return {
    onlineDate: online?.date || null,
    issueDate: issue?.date || null,
    displayDate,
    datePrecision: chosen.precision,
  };
}

// ---------------------------------------------------------------- document classes

export const DOCUMENT_TYPES = [
  "original-research",
  "review",
  "commentary",
  "protocol",
  "correction",
  "preprint",
  "trial-record",
  "unknown",
];

// PubMed publication types, lowercased. "Journal Article" is deliberately absent:
// PubMed applies it to Spotlights, News & Views and Perspectives as well as to
// original research, so on its own it proves nothing about the document class.
const PUBLICATION_TYPE_MAP = new Map([
  ["review", "review"],
  ["systematic review", "review"],
  ["meta-analysis", "review"],
  ["scoping review", "review"],
  ["comment", "commentary"],
  ["editorial", "commentary"],
  ["news", "commentary"],
  ["historical article", "commentary"],
  ["biography", "commentary"],
  ["introductory journal article", "commentary"],
  ["published erratum", "correction"],
  ["retraction of publication", "correction"],
  ["retracted publication", "correction"],
  ["expression of concern", "correction"],
  ["clinical trial protocol", "protocol"],
  ["preprint", "preprint"],
]);

// Ranked so that a record tagged both "Journal Article" and "Comment" resolves to the
// class that most limits how the record may be reused.
const TYPE_PRIORITY = ["correction", "commentary", "review", "protocol", "preprint"];

export const DOCUMENT_TYPE_LABELS = {
  "original-research": "Original research",
  review: "Review",
  commentary: "Commentary",
  protocol: "Protocol",
  correction: "Correction notice",
  preprint: "Preprint",
  "trial-record": "Trial registry record",
  unknown: "PubMed record",
};

// Classifies a PubMed esummary item without ever guessing upwards. The most an
// automated pass may conclude is "unknown", which the interface prints as
// "PubMed record". Promotion to original-research requires a curated overlay.
export function classifyPubMedDocument(item = {}) {
  const publicationTypes = (item.pubtype || []).map((value) => String(value).toLowerCase().trim());
  const mapped = publicationTypes.map((value) => PUBLICATION_TYPE_MAP.get(value)).filter(Boolean);
  const signals = [];

  const hasAbstract = (item.attributes || []).some((value) => /has abstract/i.test(String(value)));
  if (!hasAbstract) signals.push("no-abstract");
  if (publicationTypes.length) signals.push(`pubtype:${publicationTypes.join("+")}`);

  for (const candidate of TYPE_PRIORITY) {
    if (mapped.includes(candidate)) {
      return { documentType: candidate, documentTypeBasis: "pubmed-publication-type", signals };
    }
  }
  return { documentType: "unknown", documentTypeBasis: "pubmed-publication-type-unspecific", signals };
}

// ------------------------------------------------------------------ evidence grades

export const EVIDENCE_GRADES = ["A", "B", "C", "D"];

// An automated query proves that a record matched a search, nothing else. Evidence
// strength is a judgement about how far a result can be reused, so it stays unassessed
// until a curated audit records one.
export function evidenceGradeFor({ reviewStatus, declaredGrade, overlayGrade }) {
  if (overlayGrade && EVIDENCE_GRADES.includes(overlayGrade)) {
    return { evidenceGrade: overlayGrade, evidenceGradeBasis: "curated-audit" };
  }
  if (reviewStatus === "curated" && EVIDENCE_GRADES.includes(declaredGrade)) {
    return { evidenceGrade: declaredGrade, evidenceGradeBasis: "curated-signal" };
  }
  return { evidenceGrade: null, evidenceGradeBasis: "unassessed" };
}

// --------------------------------------------------------------- canonical identity

// Registrants that mint a versioned DOI for successive revisions of one study. The
// version is a revision, not a different paper, so it is normalised away — but only for
// registrants whose scheme is known, because a suffix like ".014" in a Cell DOI is part
// of the article identifier and stripping it would merge unrelated papers.
const DOI_VERSION_RULES = [
  // eLife: 10.7554/elife.<id>.<version>
  [/^(10\.7554\/elife\.\d+)\.\d+$/, 1],
  // bioRxiv and medRxiv: <prefix>/<yyyy.mm.dd.nnnnnn>v<version>. Anchored on the dated
  // article form rather than on a prefix, because these servers have changed prefix.
  [/^(10\.\d{4,9}\/\d{4}\.\d{2}\.\d{2}\.\d+)v\d+$/, 1],
];

export function normalizeDoi(value = "") {
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  let stripped = text
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .replace(/[).,;]+$/, "")
    .replace(/\/+$/, "");
  for (const [pattern, group] of DOI_VERSION_RULES) {
    const match = stripped.match(pattern);
    if (match) { stripped = match[group]; break; }
  }
  return /^10\.\d{4,9}\/\S+$/.test(stripped) ? stripped : null;
}

function normalizeUrl(value = "") {
  const text = String(value).trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.protocol = "https:";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch {
    return null;
  }
}

// Publisher URL shapes whose article identifier is the DOI suffix. Only registrants
// with a documented one-to-one mapping belong here; anything else falls through to a
// URL identity rather than inventing a DOI.
const DOI_FROM_URL = [
  [/^https?:\/\/(?:www\.)?nature\.com\/articles\/([a-z0-9-]+)/i, (match) => `10.1038/${match[1]}`],
  [/^https?:\/\/(?:www\.)?biorxiv\.org\/content\/(10\.\d{4,9}\/[^v?#]+)v\d+/i, (match) => match[1]],
  [/^https?:\/\/(?:www\.)?medrxiv\.org\/content\/(10\.\d{4,9}\/[^v?#]+)v\d+/i, (match) => match[1]],
];

export function pmidFromUrl(value = "") {
  const match = String(value).match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
  return match ? match[1] : null;
}

export function nctFromUrl(value = "") {
  const match = String(value).match(/\b(NCT\d{8})\b/i);
  return match ? match[1].toUpperCase() : null;
}

// One record can be discovered as a DOI, a PMID, an NCT identifier or a bare link.
// The identity order is fixed so that two discovery routes for the same study always
// collapse onto the same key, and a synthetic identifier is only the last resort.
export function canonicalIdentity(record = {}) {
  const doi = normalizeDoi(record.doi) || normalizeDoi(record.url);
  if (doi) return { canonicalId: `doi:${doi}`, canonicalIdKind: "doi" };

  for (const [pattern, build] of DOI_FROM_URL) {
    const match = String(record.url || "").match(pattern);
    if (match) {
      const derived = normalizeDoi(build(match));
      if (derived) return { canonicalId: `doi:${derived}`, canonicalIdKind: "doi-from-publisher-url" };
    }
  }

  const nct = record.nctId ? String(record.nctId).toUpperCase() : nctFromUrl(record.url) || nctFromUrl(record.id);
  if (nct) return { canonicalId: `nct:${nct}`, canonicalIdKind: "nct" };

  const pmid = record.pmid || pmidFromUrl(record.url) || (String(record.id || "").match(/^pubmed-(\d+)$/) || [])[1];
  if (pmid) return { canonicalId: `pmid:${pmid}`, canonicalIdKind: "pmid" };

  const url = normalizeUrl(record.url);
  if (url) return { canonicalId: `url:${url}`, canonicalIdKind: "url" };

  return { canonicalId: `record:${record.id || "unidentified"}`, canonicalIdKind: "synthetic" };
}

// -------------------------------------------------------------------- layer merging

const uniqueStrings = (values) => [...new Set(values.filter(Boolean))];

// The curated layer is hand-maintained rather than fetched, so it is a route with no
// freshness of its own. Only automated routes can go stale.
export const CURATED_ROUTE = "curated";

const latestIso = (values) => values.filter(Boolean).map(String).sort().at(-1) || null;

// Freshness belongs to a discovery route, not to a card. One study can arrive through a
// laboratory watch and through the generic PubMed query; those routes fail and recover
// independently, so each one carries its own stale flag, last success and last attempt.
function normalizeRoute(route = {}, record = {}) {
  const name = route.route || (record.reviewStatus === "curated" ? CURATED_ROUTE : record.sourceName || "automated");
  const curated = (route.kind || (name === CURATED_ROUTE ? "curated" : "automated")) === "curated";
  return {
    route: name,
    kind: curated ? "curated" : "automated",
    recordId: route.recordId ?? record.id ?? null,
    url: route.url ?? record.url ?? null,
    retrievedAt: route.retrievedAt ?? null,
    // A record written before routes carried freshness falls back to the record-level
    // flags, so an older live.json is read with the same semantics rather than silently
    // becoming fresh.
    stale: curated ? false : Boolean(route.stale ?? record.stale ?? false),
    lastSuccessAt: curated ? null : route.lastSuccessAt ?? record.lastSuccessAt ?? null,
    lastAttemptAt: curated ? null : route.lastAttemptAt ?? record.lastAttemptAt ?? null,
  };
}

export function sourceRoutesOf(record = {}) {
  const routes = record.sources?.length ? record.sources : [{}];
  return routes.map((route) => normalizeRoute(route, record));
}

function mergeSourceRoutes(records) {
  const seen = new Map();
  for (const record of records) {
    for (const route of sourceRoutesOf(record)) {
      const key = `${route.route}|${route.recordId}`;
      const existing = seen.get(key);
      // Two copies of the same route can reach the merge — a retained stale copy and a
      // fresh one. The fresher attempt wins, because the route really did succeed.
      if (!existing || (existing.stale && !route.stale)) seen.set(key, route);
    }
  }
  return [...seen.values()];
}

export const FRESHNESS_STATES = ["current", "partially-stale", "stale", "curated-only"];

// A card is published from retained bytes only when nothing current backs it: every
// automated discovery route is stale and no curated layer supplies the content. Anything
// in between is partial degradation, which is a different fact and is rendered as one.
export function freshnessOf(routes = []) {
  const automated = routes.filter((route) => route.kind !== "curated");
  const curated = routes.filter((route) => route.kind === "curated");
  const staleRoutes = automated.filter((route) => route.stale);
  const freshRoutes = automated.filter((route) => !route.stale);

  let freshnessState;
  if (!automated.length) freshnessState = "curated-only";
  else if (!staleRoutes.length) freshnessState = "current";
  else if (freshRoutes.length || curated.length) freshnessState = "partially-stale";
  else freshnessState = "stale";

  return {
    freshnessState,
    stale: freshnessState === "stale",
    staleSourceNames: uniqueStrings(staleRoutes.map((route) => route.route)),
    freshSourceNames: uniqueStrings(freshRoutes.map((route) => route.route)),
    lastSuccessAt: latestIso(automated.map((route) => route.lastSuccessAt)),
    lastAttemptAt: latestIso(automated.map((route) => route.lastAttemptAt)),
  };
}

// Curated interpretation is the reason the curated layer exists, so it wins on
// narrative and on evidence. The automated layer is the reason the site is current, so
// it wins on date and status. Laboratory matches are additive: a curated card must not
// discard the watch that also found the paper.
export function mergeCanonicalRecords(records) {
  if (records.length === 1) {
    const sources = mergeSourceRoutes(records);
    return { ...records[0], sources, ...freshnessOf(sources) };
  }

  const curated = records.filter((record) => record.reviewStatus === "curated");
  // When one study was found both as a preprint and as the published version, the
  // published version leads: a reader should not be shown "Not peer reviewed" for a
  // paper that has since appeared, and the preprint route stays visible in `sources`.
  const automated = records.filter((record) => record.reviewStatus !== "curated")
    .sort((a, b) => Number(b.sourceType !== "preprint") - Number(a.sourceType !== "preprint") || (Number(b.relevance) || 0) - (Number(a.relevance) || 0));
  const primary = curated[0] || automated[0];
  const freshest = [...records].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];

  const merged = { ...primary };
  merged.date = automated[0]?.date || freshest.date || primary.date;
  merged.onlineDate = automated[0]?.onlineDate || primary.onlineDate || null;
  merged.issueDate = automated[0]?.issueDate || primary.issueDate || null;
  merged.trackedLabIds = uniqueStrings(records.flatMap((record) => record.trackedLabIds || []));
  merged.topics = uniqueStrings([...(primary.topics || []), ...records.flatMap((record) => record.topics || [])]).slice(0, 6);
  merged.relevance = Math.max(...records.map((record) => Number(record.relevance) || 0));
  merged.sources = mergeSourceRoutes(records);
  // Freshness is recomputed from every route rather than inherited from whichever record
  // became primary. A stale retained copy merging with a fresh one used to be able to mark
  // the whole card stale, or to hide that one of its routes had failed.
  Object.assign(merged, freshnessOf(merged.sources));
  merged.mergedFrom = records.map((record) => record.id);
  merged.reviewStatus = curated.length ? "curated" : "automated";
  // A curated card that an automated watch also found is still curated interpretation,
  // but the reader is told the automated route exists.
  merged.alsoDiscoveredAutomatically = curated.length > 0 && automated.length > 0;
  if (!merged.documentType) merged.documentType = automated.find((record) => record.documentType)?.documentType || "unknown";
  return merged;
}

export function mergeSignalLayers(records) {
  const groups = new Map();
  for (const record of records) {
    const identity = record.canonicalId
      ? { canonicalId: record.canonicalId, canonicalIdKind: record.canonicalIdKind || "declared" }
      : canonicalIdentity(record);
    const enriched = { ...record, ...identity };
    const group = groups.get(identity.canonicalId) || [];
    group.push(enriched);
    groups.set(identity.canonicalId, group);
  }
  return [...groups.values()].map(mergeCanonicalRecords);
}

// ------------------------------------------------------------------ freshness state

// A source that fails does not invalidate what it previously returned; it invalidates
// the claim that the data is current. Retained records stay visible and are marked
// stale until they pass the maximum age, at which point the dataset really is unusable
// and validation has to fail.
export const STALE_MAX_AGE_DAYS = 14;

export function daysBetween(fromIsoDate, toIsoDate) {
  const from = Date.parse(`${String(fromIsoDate).slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${String(toIsoDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.POSITIVE_INFINITY;
  return Math.round((to - from) / 86_400_000);
}

// A cached record can hold several discovery routes. Selecting it by its top-level
// `sourceName` alone loses the retained copy whenever the failing source was the secondary
// route of a merged record, so the routes are searched instead — and only the failed route
// is carried forward. The other routes are republished by their own sources in the same
// run; copying them here would resurrect a stale duplicate of a record that is current.
export function retainOnFailure({ sourceName, previousItems = [], lastSuccessAt, attemptedAt, errorClass, maxAgeDays = STALE_MAX_AGE_DAYS }) {
  const retained = [];
  for (const item of previousItems) {
    const failedRoute = sourceRoutesOf(item).find((route) => route.route === sourceName);
    if (!failedRoute) continue;
    const routeSuccessAt = lastSuccessAt || failedRoute.lastSuccessAt || item.lastSuccessAt || null;
    const route = { ...failedRoute, stale: true, lastSuccessAt: routeSuccessAt, lastAttemptAt: attemptedAt };
    retained.push({
      ...item,
      sourceName,
      id: failedRoute.recordId || item.id,
      sources: [route],
      ...freshnessOf([route]),
    });
  }
  const ageDays = lastSuccessAt ? daysBetween(lastSuccessAt, attemptedAt) : Number.POSITIVE_INFINITY;
  const usable = retained.length > 0 && ageDays <= maxAgeDays;
  return {
    items: usable ? retained : [],
    status: {
      name: sourceName,
      ok: false,
      state: usable ? "degraded" : "failed",
      lastSuccessAt: lastSuccessAt || null,
      lastAttemptAt: attemptedAt,
      retainedItems: usable ? retained.length : 0,
      retainedAgeDays: Number.isFinite(ageDays) ? ageDays : null,
      maxAgeDays,
      errorClass: errorClass || "unknown-error",
      note: usable
        ? `This source failed on the last attempt (${errorClass}). The ${retained.length} records it returned on ${String(lastSuccessAt).slice(0, 10)} are retained and marked stale; they are ${ageDays} days old against a ${maxAgeDays}-day limit.`
        : `This source failed (${errorClass}) and no retained records are within the ${maxAgeDays}-day limit, so nothing from it is published.`,
    },
  };
}

export function successStatus({ sourceName, count, attemptedAt, note }) {
  return {
    name: sourceName,
    ok: true,
    state: "ok",
    lastSuccessAt: attemptedAt,
    lastAttemptAt: attemptedAt,
    retainedItems: 0,
    retainedAgeDays: null,
    maxAgeDays: STALE_MAX_AGE_DAYS,
    errorClass: null,
    note: note || `${count} ${count === 1 ? "record" : "records"} passed the quality filter in this run.`,
  };
}
