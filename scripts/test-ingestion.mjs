// Offline ingestion fixtures.
//
// Every case here is a defect the independent review found in a live dataset, frozen as
// a fixture so it fails loudly if the behaviour comes back. Nothing in this file touches
// the network: the fixtures are the shapes PubMed, Crossref and ClinicalTrials.gov
// actually return, so the pure layer can be exercised without a live query.
//
// Run under more than one timezone. `npm run check:ingestion` runs it under UTC,
// Asia/Tokyo and America/Los_Angeles, which is what proves the date parser is reading a
// calendar date rather than a local instant.

import assert from "node:assert/strict";
import {
  canonicalIdentity,
  classifyPubMedDocument,
  evidenceGradeFor,
  formatCalendarDate,
  mergeSignalLayers,
  parseCalendarDate,
  pubmedDates,
  retainOnFailure,
} from "../lib/records.mjs";

const timeZone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
const cases = [];
const test = (name, run) => {
  try {
    run();
    cases.push({ name, ok: true });
  } catch (error) {
    cases.push({ name, ok: false, message: error.message });
  }
};

// ---------------------------------------------------------------- document classes
//
// PubMed applies "Journal Article" to Spotlights and News & Views as well as to primary
// research, so it can never on its own promote a record to original research.

test("a PubMed Spotlight tagged Comment is classified as commentary, not research", () => {
  const spotlight = {
    uid: "42439891",
    title: "More gas, fewer brakes: Mitochondria withhold CoQ at the cost of ferroptosis defense.",
    fulljournalname: "The Journal of cell biology",
    pubtype: ["Journal Article", "Comment"],
    attributes: [],
  };
  const classified = classifyPubMedDocument(spotlight);
  assert.equal(classified.documentType, "commentary");
  assert.equal(classified.documentTypeBasis, "pubmed-publication-type");
  assert.ok(classified.signals.includes("no-abstract"), "a record with no abstract must carry that signal");
});

test("a bare Journal Article stays unknown rather than being promoted to research", () => {
  const bare = { uid: "42481294", pubtype: ["Journal Article"], attributes: ["Has Abstract"] };
  const classified = classifyPubMedDocument(bare);
  assert.equal(classified.documentType, "unknown");
  assert.ok(!classified.signals.includes("no-abstract"));
});

test("a record tagged both Comment and Published Erratum resolves to the more limiting class", () => {
  const both = { uid: "1", pubtype: ["Journal Article", "Comment", "Published Erratum"], attributes: [] };
  assert.equal(classifyPubMedDocument(both).documentType, "correction");
});

test("a review is classified as a review", () => {
  assert.equal(classifyPubMedDocument({ pubtype: ["Journal Article", "Review"], attributes: ["Has Abstract"] }).documentType, "review");
});

// PubMed indexes preprints. One arriving through a laboratory watch used to look like a
// peer-reviewed paper because the watch stream sets sourceType, not the classifier.
test("a preprint indexed in PubMed is classified as a preprint", () => {
  assert.equal(classifyPubMedDocument({ pubtype: ["Preprint"], attributes: ["Has Abstract"] }).documentType, "preprint");
  assert.equal(classifyPubMedDocument({ pubtype: ["Journal Article", "Preprint"], attributes: ["Has Abstract"] }).documentType, "preprint");
});

// ------------------------------------------------------------------ evidence grades

test("an automated record is unassessed, never evidence B", () => {
  const graded = evidenceGradeFor({ reviewStatus: "automated", declaredGrade: "B" });
  assert.equal(graded.evidenceGrade, null);
  assert.equal(graded.evidenceGradeBasis, "unassessed");
});

test("a commentary cannot be graded by the ingestion layer even if a grade is offered", () => {
  const graded = evidenceGradeFor({ reviewStatus: "automated", declaredGrade: "A", overlayGrade: undefined });
  assert.equal(graded.evidenceGrade, null);
});

test("a curated audit may assign a grade, and the basis records that it did", () => {
  const curated = evidenceGradeFor({ reviewStatus: "curated", declaredGrade: "B" });
  assert.equal(curated.evidenceGrade, "B");
  assert.equal(curated.evidenceGradeBasis, "curated-signal");
  const promoted = evidenceGradeFor({ reviewStatus: "automated", declaredGrade: "B", overlayGrade: "A" });
  assert.equal(promoted.evidenceGrade, "A");
  assert.equal(promoted.evidenceGradeBasis, "curated-audit");
});

test("an overlay cannot smuggle in a grade outside A to D", () => {
  assert.equal(evidenceGradeFor({ reviewStatus: "automated", overlayGrade: "S" }).evidenceGrade, null);
});

// ---------------------------------------------------------------- calendar dates
//
// PubMed reported the GPX4 fin-loop electronic date as 2025-12-04. Parsing it through
// `new Date()` and converting to UTC stored 2025-12-03 in Asia/Tokyo. The date is a
// calendar date in the publisher's own frame and is decomposed textually.

test(`"2025 Dec 4" is 2025-12-04 in ${timeZone}`, () => {
  assert.equal(parseCalendarDate("2025 Dec 4").date, "2025-12-04");
  assert.equal(parseCalendarDate("2025 Dec 4").precision, "day");
});

test("the regression case is reproduced end to end from a PubMed summary", () => {
  const item = { epubdate: "2025 Dec 4", pubdate: "2026 Jan 8", sortpubdate: "2025/12/04 00:00" };
  const dates = pubmedDates(item, "2026-07-23");
  assert.equal(dates.displayDate, "2025-12-04");
  assert.equal(dates.onlineDate, "2025-12-04");
  assert.equal(dates.issueDate, "2026-01-08");
});

test("month-only and year-only records keep their precision instead of pretending to a day", () => {
  assert.deepEqual(parseCalendarDate("2026 Jun"), { date: "2026-06-01", precision: "month" });
  assert.deepEqual(parseCalendarDate("2026"), { date: "2026-01-01", precision: "year" });
  assert.equal(pubmedDates({ pubdate: "2026 Jun" }, "2026-07-23").datePrecision, "month");
});

test("slash and dash formats parse to the same calendar date", () => {
  assert.equal(parseCalendarDate("2025/12/04").date, "2025-12-04");
  assert.equal(parseCalendarDate("2025-12-04").date, "2025-12-04");
  assert.equal(parseCalendarDate("2025-12-04 00:00").date, "2025-12-04");
});

test("a publisher date after today is clamped to today rather than published as news", () => {
  assert.equal(pubmedDates({ epubdate: "2030 Jan 1" }, "2026-07-23").displayDate, "2026-07-23");
});

test("an unparsable date yields null rather than a silently wrong day", () => {
  assert.equal(parseCalendarDate("no date at all"), null);
  assert.equal(pubmedDates({}, "2026-07-23").displayDate, null);
});

// P1-C: the parser validated numeric ranges loosely, so 31 February and 30 February slipped
// through as if real. A calendar date is validated against the actual month length and the
// actual leap year, without ever constructing a Date.
test("an impossible calendar date is rejected rather than stored as a plausible day", () => {
  assert.equal(parseCalendarDate("2025-02-31"), null, "31 February is not a date");
  assert.equal(parseCalendarDate("2025 Feb 30"), null);
  assert.equal(parseCalendarDate("2025/04/31"), null, "April has 30 days");
  assert.equal(parseCalendarDate("2025-13-01"), null, "there is no thirteenth month");
  assert.equal(parseCalendarDate("2025-00-10"), null, "there is no zeroth month");
  assert.equal(parseCalendarDate("2025-06-00"), null, "there is no zeroth day");
});

test("29 February is accepted only in a leap year", () => {
  assert.equal(parseCalendarDate("2024-02-29").date, "2024-02-29", "2024 is a leap year");
  assert.equal(parseCalendarDate("2000-02-29").date, "2000-02-29", "2000 is a leap year: divisible by 400");
  assert.equal(parseCalendarDate("2025-02-29"), null, "2025 is not a leap year");
  assert.equal(parseCalendarDate("1900-02-29"), null, "1900 is not a leap year: divisible by 100 but not 400");
});

test("the display formatter rejects the same impossible dates", () => {
  assert.equal(formatCalendarDate("2025-02-31"), null);
  assert.equal(formatCalendarDate("2025-02-29"), null, "not a leap year");
  assert.equal(formatCalendarDate("2024-02-29"), "29 Feb 2024", "leap year renders");
  assert.equal(formatCalendarDate("2025-12-04"), "04 Dec 2025");
});

test("a month-precision fallback is never invented from an impossible day", () => {
  // The malformed day must fail the whole parse, not silently drop to "2025-02-01".
  assert.equal(parseCalendarDate("2025-02-31"), null);
  assert.equal(pubmedDates({ epubdate: "2025 Feb 31" }, "2026-07-23").displayDate, null);
});

// A local-time round trip is what produced the original defect. Recording it here shows
// what the parser is protecting against in the timezone this run is using.
const naive = new Date("2025 Dec 4");
const naiveRoundTrip = Number.isNaN(naive.getTime()) ? "an invalid date" : naive.toISOString().slice(0, 10);

// --------------------------------------------------------------- canonical identity

test("a DOI, a Nature article URL and a doi.org link collapse onto one identity", () => {
  assert.equal(canonicalIdentity({ doi: "10.1038/s41586-025-08974-4" }).canonicalId, "doi:10.1038/s41586-025-08974-4");
  assert.equal(canonicalIdentity({ url: "https://doi.org/10.1038/s41586-025-08974-4" }).canonicalId, "doi:10.1038/s41586-025-08974-4");
  assert.equal(canonicalIdentity({ url: "https://www.nature.com/articles/s41586-025-08974-4" }).canonicalId, "doi:10.1038/s41586-025-08974-4");
});

test("a trial identity comes from the NCT number wherever it appears", () => {
  assert.equal(canonicalIdentity({ url: "https://clinicaltrials.gov/study/NCT07433283" }).canonicalId, "nct:NCT07433283");
  assert.equal(canonicalIdentity({ nctId: "nct07433283" }).canonicalId, "nct:NCT07433283");
});

test("a PubMed link without a DOI falls back to the PMID, not to a synthetic id", () => {
  const identity = canonicalIdentity({ id: "pubmed-42049018", url: "https://pubmed.ncbi.nlm.nih.gov/42049018/" });
  assert.equal(identity.canonicalId, "pmid:42049018");
  assert.equal(identity.canonicalIdKind, "pmid");
});

test("a versioned eLife DOI collapses onto the study it is a revision of", () => {
  assert.equal(canonicalIdentity({ url: "https://doi.org/10.7554/eLife.111544.1" }).canonicalId, "doi:10.7554/elife.111544");
  assert.equal(canonicalIdentity({ url: "https://doi.org/10.7554/eLife.111544" }).canonicalId, "doi:10.7554/elife.111544");
});

test("a version suffix is only stripped for registrants whose scheme is known", () => {
  // The trailing ".014" here is part of the Cell article identifier, not a version.
  assert.equal(canonicalIdentity({ doi: "10.1016/j.cell.2025.11.014" }).canonicalId, "doi:10.1016/j.cell.2025.11.014");
  assert.equal(canonicalIdentity({ doi: "10.1038/s41586-025-08974-4" }).canonicalId, "doi:10.1038/s41586-025-08974-4");
});

test("a published paper leads its own preprint in the merged record", () => {
  const merged = mergeSignalLayers([
    { id: "preprint-10.7554/elife.111544.1", reviewStatus: "automated", sourceType: "preprint", url: "https://doi.org/10.7554/elife.111544.1", title: "Cell size modulates ferroptosis susceptibility", caveat: "Not peer reviewed.", relevance: 54, date: "2026-05-15", sourceName: "Preprints / Crossref" },
    { id: "pubmed-42267631", reviewStatus: "automated", sourceType: "paper", url: "https://doi.org/10.7554/eLife.111544", title: "Cell size modulates ferroptosis susceptibility.", relevance: 62, date: "2026-06-20", sourceName: "PubMed" },
  ]);
  assert.equal(merged.length, 1, "a preprint and its published version are one study");
  assert.equal(merged[0].sourceType, "paper", "the published version leads");
  assert.equal(merged[0].sources.length, 2, "the preprint route stays visible");
});

test("a publisher URL with no derivable identifier stays a URL identity rather than inventing a DOI", () => {
  const identity = canonicalIdentity({ url: "https://www.sciencedirect.com/science/article/pii/S0092867426004599" });
  assert.equal(identity.canonicalIdKind, "url");
  assert.ok(identity.canonicalId.startsWith("url:https://sciencedirect.com/"));
});

// --------------------------------------------------------------------- layer merge

test("a curated card and its automated twin render once, keeping both routes", () => {
  const merged = mergeSignalLayers([
    {
      id: "cell-gpx4-fin-loop-2026", reviewStatus: "curated", url: "https://doi.org/10.1016/j.cell.2025.11.014",
      title: "A fin-loop-like structure in GPX4 underlies neuroprotection from ferroptosis",
      takeaway: "Curated interpretation.", evidence: "B", relevance: 99, date: "2026-01-08",
      topics: ["GPX4"], trackedLabIds: ["conrad-helmholtz"],
    },
    {
      id: "pubmed-41349546", reviewStatus: "automated", url: "https://doi.org/10.1016/j.cell.2025.11.014",
      title: "A fin-loop-like structure in GPX4 underlies neuroprotection from ferroptosis.",
      takeaway: "Cell · Laboratory watch match: Eikan Mishima.", relevance: 88, date: "2025-12-04",
      topics: ["GPX4"], trackedLabIds: ["mishima-tohoku"], sourceName: "Tracked labs / PubMed",
    },
  ]);
  assert.equal(merged.length, 1, "the same DOI must not render twice");
  const [record] = merged;
  assert.equal(record.takeaway, "Curated interpretation.", "curated narrative wins");
  assert.equal(record.evidence, "B", "the curated evidence decision survives the merge");
  assert.equal(record.reviewStatus, "curated");
  assert.equal(record.date, "2025-12-04", "the automated layer supplies the current date");
  assert.deepEqual([...record.trackedLabIds].sort(), ["conrad-helmholtz", "mishima-tohoku"], "laboratory matches are unioned, not overwritten");
  assert.equal(record.sources.length, 2, "both discovery routes stay visible");
  assert.ok(record.alsoDiscoveredAutomatically);
});

test("a curated trial and its registry twin merge on the NCT identifier", () => {
  const merged = mergeSignalLayers([
    { id: "curated-nct07433283", reviewStatus: "curated", url: "https://clinicaltrials.gov/study/NCT07433283", takeaway: "Curated read.", relevance: 70, date: "2026-02-01" },
    { id: "trial-NCT07433283", reviewStatus: "automated", url: "https://clinicaltrials.gov/study/NCT07433283", takeaway: "RECRUITING.", relevance: 58, date: "2026-05-01", sourceName: "ClinicalTrials.gov" },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].takeaway, "Curated read.");
  assert.equal(merged[0].date, "2026-05-01");
});

test("two automated routes returning the same PMID keep both laboratory matches", () => {
  const merged = mergeSignalLayers([
    { id: "pubmed-99", reviewStatus: "automated", url: "https://doi.org/10.1000/x", trackedLabIds: ["lab-a"], relevance: 80, sourceName: "Tracked labs / PubMed" },
    { id: "pubmed-99", reviewStatus: "automated", url: "https://doi.org/10.1000/x", trackedLabIds: ["lab-b"], relevance: 62, sourceName: "PubMed" },
  ]);
  assert.equal(merged.length, 1);
  assert.deepEqual([...merged[0].trackedLabIds].sort(), ["lab-a", "lab-b"]);
  assert.equal(merged[0].relevance, 80);
  assert.equal(merged[0].sources.length, 2);
});

test("unrelated records are not merged", () => {
  const merged = mergeSignalLayers([
    { id: "a", reviewStatus: "automated", url: "https://doi.org/10.1000/a" },
    { id: "b", reviewStatus: "automated", url: "https://doi.org/10.1000/b" },
  ]);
  assert.equal(merged.length, 2);
});

// ------------------------------------------------------------------ source failure
//
// A source that fails does not invalidate what it previously returned. It invalidates
// the claim that the data is current, and the site has to say so rather than quietly
// publishing a smaller dataset.

const previousItems = [
  { id: "pubmed-1", sourceName: "PubMed", title: "Retained record", stale: false },
  { id: "pubmed-2", sourceName: "PubMed", title: "Second retained record", stale: false },
  { id: "trial-1", sourceName: "ClinicalTrials.gov", title: "Unrelated source", stale: false },
];

test("a failed source retains only its own records and marks them stale", () => {
  const result = retainOnFailure({
    sourceName: "PubMed", previousItems,
    lastSuccessAt: "2026-07-20T00:00:00.000Z", attemptedAt: "2026-07-23T00:00:00.000Z",
    errorClass: "http-server-error",
  });
  assert.equal(result.items.length, 2, "records from other sources must not be claimed");
  assert.ok(result.items.every((item) => item.stale === true));
  assert.ok(result.items.every((item) => item.lastAttemptAt === "2026-07-23T00:00:00.000Z"));
  assert.equal(result.status.state, "degraded");
  assert.equal(result.status.ok, false);
  assert.equal(result.status.retainedItems, 2);
  assert.equal(result.status.retainedAgeDays, 3);
  assert.equal(result.status.errorClass, "http-server-error");
  assert.match(result.status.note, /retained and marked stale/);
});

test("retained data past its maximum age publishes nothing and reports failure", () => {
  const result = retainOnFailure({
    sourceName: "PubMed", previousItems,
    lastSuccessAt: "2026-06-01T00:00:00.000Z", attemptedAt: "2026-07-23T00:00:00.000Z",
    errorClass: "timeout",
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.status.state, "failed");
  assert.equal(result.status.retainedItems, 0);
  assert.match(result.status.note, /no retained records are within/);
});

test("a source that never succeeded cannot retain anything", () => {
  const result = retainOnFailure({ sourceName: "PubMed", previousItems, lastSuccessAt: null, attemptedAt: "2026-07-23T00:00:00.000Z", errorClass: "network-unreachable" });
  assert.equal(result.status.state, "failed");
  assert.equal(result.items.length, 0);
});

// P1-B: the cached route supplies the only success date. A merged record discovered through
// both a laboratory watch and the generic PubMed query keeps every route in `sources[]`, and
// when the secondary route fails the caller has no top-level lastSuccessAt for it. Deriving
// age from the argument alone treated the route as infinitely old and discarded a current
// record; the route's own lastSuccessAt is now used instead.
test("a cached route supplies the only success date and the record is retained", () => {
  const routedItems = [{
    id: "pubmed-merged", title: "Discovered by two routes",
    sources: [{ route: "PubMed", kind: "automated", stale: false, lastSuccessAt: "2026-07-20T00:00:00.000Z", lastAttemptAt: "2026-07-20T00:00:00.000Z", recordId: "pubmed-merged" }],
  }];
  const result = retainOnFailure({
    sourceName: "PubMed", previousItems: routedItems,
    lastSuccessAt: undefined, attemptedAt: "2026-07-23T00:00:00.000Z",
    errorClass: "timeout",
  });
  assert.equal(result.items.length, 1, "the route's own success date must keep the record alive");
  assert.equal(result.status.state, "degraded");
  assert.equal(result.status.retainedAgeDays, 3, "age must be measured from the cached route, not treated as infinite");
  assert.equal(result.status.lastSuccessAt, "2026-07-20T00:00:00.000Z");
  assert.ok(result.items[0].stale === true);
});

test("a cached route past the age limit still publishes nothing", () => {
  const routedItems = [{
    id: "pubmed-old", title: "Stale by the route's own date",
    sources: [{ route: "PubMed", kind: "automated", stale: false, lastSuccessAt: "2026-06-01T00:00:00.000Z", lastAttemptAt: "2026-06-01T00:00:00.000Z", recordId: "pubmed-old" }],
  }];
  const result = retainOnFailure({ sourceName: "PubMed", previousItems: routedItems, lastSuccessAt: undefined, attemptedAt: "2026-07-23T00:00:00.000Z", errorClass: "timeout" });
  assert.equal(result.items.length, 0, "the fallback date must still be subject to the maximum age");
  assert.equal(result.status.state, "failed");
});

test("a failing source leaves the other sources untouched", () => {
  const failed = retainOnFailure({ sourceName: "PubMed", previousItems, lastSuccessAt: "2026-07-22T00:00:00.000Z", attemptedAt: "2026-07-23T00:00:00.000Z", errorClass: "timeout" });
  const survivors = previousItems.filter((item) => item.sourceName !== "PubMed");
  const published = [...failed.items, ...survivors];
  assert.equal(published.length, 3);
  assert.equal(published.filter((item) => item.stale).length, 2);
});

// ------------------------------------------------- route-specific freshness (P0-B)
//
// A canonical record discovered through both a laboratory watch and the generic PubMed
// query stores every route in `sources[]` but has only one top-level `sourceName`.
// Selecting or summarising freshness by that single name loses the secondary route, and
// merging a retained copy with a fresh one used to be able to mark a current card stale.

const ATTEMPT = "2026-07-23T00:00:00.000Z";
const LAST_SUCCESS = "2026-07-20T00:00:00.000Z";

// One cached record, two discovery routes, and the top-level sourceName names the route
// that did not fail.
const mergedCachedRecord = {
  id: "pubmed-41349546",
  sourceName: "Tracked labs / PubMed",
  title: "A fin-loop-like structure in GPX4 underlies neuroprotection from ferroptosis.",
  url: "https://doi.org/10.1016/j.cell.2025.11.014",
  relevance: 88,
  date: "2025-12-04",
  stale: false,
  freshnessState: "current",
  sources: [
    { route: "Tracked labs / PubMed", kind: "automated", recordId: "pubmed-41349546", url: "https://doi.org/10.1016/j.cell.2025.11.014", stale: false, lastSuccessAt: LAST_SUCCESS, lastAttemptAt: LAST_SUCCESS },
    { route: "PubMed", kind: "automated", recordId: "pubmed-41349546-generic", url: "https://doi.org/10.1016/j.cell.2025.11.014", stale: false, lastSuccessAt: LAST_SUCCESS, lastAttemptAt: LAST_SUCCESS },
  ],
};

test("fixture 1: a failing secondary route still retains its own copy of a merged record", () => {
  const result = retainOnFailure({
    sourceName: "PubMed", previousItems: [mergedCachedRecord],
    lastSuccessAt: LAST_SUCCESS, attemptedAt: ATTEMPT, errorClass: "http-server-error",
  });
  assert.equal(result.items.length, 1, "matching only the top-level sourceName loses the secondary route");
  const [retained] = result.items;
  assert.equal(retained.sources.length, 1, "only the failed route is carried forward");
  assert.equal(retained.sources[0].route, "PubMed");
  assert.equal(retained.sources[0].stale, true);
  assert.equal(retained.sources[0].lastAttemptAt, ATTEMPT);
  assert.equal(retained.id, "pubmed-41349546-generic", "the retained copy keeps the failed route's own record id");
  assert.equal(retained.freshnessState, "stale");
});

test("fixture 2: one fresh and one stale route merge into a partially stale card", () => {
  const retained = retainOnFailure({
    sourceName: "PubMed", previousItems: [mergedCachedRecord],
    lastSuccessAt: LAST_SUCCESS, attemptedAt: ATTEMPT, errorClass: "timeout",
  }).items;
  const freshFromWatch = {
    id: "pubmed-41349546", reviewStatus: "automated", sourceName: "Tracked labs / PubMed",
    url: "https://doi.org/10.1016/j.cell.2025.11.014", relevance: 88, date: "2025-12-04",
    sources: [{ route: "Tracked labs / PubMed", kind: "automated", recordId: "pubmed-41349546", url: "https://doi.org/10.1016/j.cell.2025.11.014", stale: false, lastSuccessAt: ATTEMPT, lastAttemptAt: ATTEMPT }],
  };
  const [merged] = mergeSignalLayers([...retained, freshFromWatch]);
  assert.equal(merged.freshnessState, "partially-stale");
  assert.equal(merged.stale, false, "a card still backed by a route that succeeded is not published from retained bytes");
  assert.deepEqual(merged.staleSourceNames, ["PubMed"]);
  assert.deepEqual(merged.freshSourceNames, ["Tracked labs / PubMed"]);
  assert.equal(merged.sources.length, 2, "both routes stay visible with their own freshness");
  assert.equal(merged.lastSuccessAt, ATTEMPT, "the most recent success across routes is reported");
});

test("fixture 3: a card whose every automated route is stale is globally stale", () => {
  const [merged] = mergeSignalLayers([{
    id: "pubmed-41349546", reviewStatus: "automated", sourceName: "Tracked labs / PubMed",
    url: "https://doi.org/10.1016/j.cell.2025.11.014", relevance: 88, date: "2025-12-04",
    sources: [
      { route: "Tracked labs / PubMed", kind: "automated", recordId: "a", stale: true, lastSuccessAt: LAST_SUCCESS, lastAttemptAt: ATTEMPT },
      { route: "PubMed", kind: "automated", recordId: "b", stale: true, lastSuccessAt: LAST_SUCCESS, lastAttemptAt: ATTEMPT },
    ],
  }]);
  assert.equal(merged.freshnessState, "stale");
  assert.equal(merged.stale, true);
  assert.deepEqual([...merged.staleSourceNames].sort(), ["PubMed", "Tracked labs / PubMed"]);
  assert.deepEqual(merged.freshSourceNames, []);
});

test("fixture 4: a curated card with a stale automated route is degraded, not retained", () => {
  const [merged] = mergeSignalLayers([
    {
      id: "cell-gpx4-fin-loop-2026", reviewStatus: "curated", url: "https://doi.org/10.1016/j.cell.2025.11.014",
      title: "A fin-loop-like structure in GPX4 underlies neuroprotection from ferroptosis",
      takeaway: "Curated interpretation.", relevance: 99, date: "2026-01-08",
    },
    {
      id: "pubmed-41349546", reviewStatus: "automated", sourceName: "Tracked labs / PubMed",
      url: "https://doi.org/10.1016/j.cell.2025.11.014", relevance: 88, date: "2025-12-04",
      sources: [{ route: "Tracked labs / PubMed", kind: "automated", recordId: "pubmed-41349546", stale: true, lastSuccessAt: LAST_SUCCESS, lastAttemptAt: ATTEMPT }],
    },
  ]);
  assert.equal(merged.reviewStatus, "curated");
  assert.equal(merged.stale, false, "the curated layer supplies this card, so it is not published from retained bytes");
  assert.equal(merged.freshnessState, "partially-stale");
  assert.deepEqual(merged.staleSourceNames, ["Tracked labs / PubMed"]);
  assert.equal(merged.takeaway, "Curated interpretation.");
});

test("a curated-only card carries no automated freshness claim at all", () => {
  const [merged] = mergeSignalLayers([
    { id: "curated-only", reviewStatus: "curated", url: "https://doi.org/10.1000/curated", relevance: 70, date: "2026-02-01" },
  ]);
  assert.equal(merged.freshnessState, "curated-only");
  assert.equal(merged.stale, false);
  assert.deepEqual(merged.staleSourceNames, []);
});

test("a retained stale copy never overwrites the fresh copy of the same route", () => {
  const route = (stale, attemptedAt) => ({ route: "PubMed", kind: "automated", recordId: "pubmed-7", stale, lastSuccessAt: stale ? LAST_SUCCESS : attemptedAt, lastAttemptAt: attemptedAt });
  const [merged] = mergeSignalLayers([
    { id: "pubmed-7", reviewStatus: "automated", sourceName: "PubMed", url: "https://doi.org/10.1000/seven", sources: [route(true, ATTEMPT)] },
    { id: "pubmed-7", reviewStatus: "automated", sourceName: "PubMed", url: "https://doi.org/10.1000/seven", sources: [route(false, ATTEMPT)] },
  ]);
  assert.equal(merged.sources.length, 1, "the same route must not be listed twice");
  assert.equal(merged.sources[0].stale, false, "the attempt that succeeded wins");
  assert.equal(merged.freshnessState, "current");
});

// ----------------------------------------------------------------------- reporting

const failures = cases.filter((entry) => !entry.ok);
for (const failure of failures) console.error(`FAIL ${failure.name}\n      ${failure.message}`);
if (failures.length) {
  console.error(`\n${failures.length} of ${cases.length} ingestion fixtures failed under TZ=${timeZone}.`);
  process.exit(1);
}
console.log(
  `Ingestion fixtures passed under TZ=${timeZone}: ${cases.length} cases. ` +
    `A local-time round trip of "2025 Dec 4" would store ${naiveRoundTrip} in this timezone; the calendar parser stores 2025-12-04.`,
);
