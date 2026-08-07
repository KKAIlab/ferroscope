import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalIdentity,
  classifyPubMedDocument,
  calendarDateFromParts,
  mergeSignalLayers,
  normalizeDoi,
  parseCalendarDate,
  partitionByUsableDate,
  pubmedDates,
  retainOnFailure,
  sourceRoutesOf,
  successStatus,
} from "../lib/records.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const now = new Date();
const generatedAt = now.toISOString();
const fromDate = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
// The UTC calendar day. Publisher dates are calendar dates, so they are compared as
// text against this value and never converted through the local timezone.
const toDate = generatedAt.slice(0, 10);

// Public topic labels are English at the point of ingestion. The interface no longer
// has to translate or suppress them, so a label change is visible in the raw dataset.
const topicRules = [
  ["lipid peroxidation", /lipid peroxid|phospholipid|oxidized lipid|oxidised lipid|PUFA|polyunsaturated/i],
  ["FSP1", /\bFSP1\b|AIFM2/i],
  ["GPX4", /\bGPX4\b|glutathione peroxidase 4/i],
  ["iron homeostasis", /iron homeostasis|labile iron|ferritin|NCOA4|TFR1|transferrin|ferroportin/i],
  ["lysosome", /lysosom|ferritinophagy/i],
  ["mitochondria", /mitochond/i],
  ["selenium metabolism", /selenium|selenoprotein|PRDX6/i],
  ["organelle contacts", /organelle|contact site|endoplasmic reticulum/i],
  ["cancer translation", /cancer|tumou?r|metasta|leukemia|glioma/i],
  ["kidney injury", /kidney|renal|ischemia.reperfusion/i],
  ["methods", /method|reproduc|screen|probe|imaging/i],
];

const UNNAMED_AUTHORS = "Authors listed in the primary record";

// Only low-ambiguity author names are matched automatically. Common abbreviated names
// such as Wang F, Zhang Q or Jiang X produce large numbers of false positives, so those
// laboratories are maintained through the curated layer and dedicated author queries
// instead of being weighted inside the broad title stream.
const trackedAuthors = /Stockwell BS|Brent Stockwell|Dixon SJ|Scott (J )?Dixon|Conrad M|Marcus Conrad|Friedmann Angeli|Olzmann JA|James Olzmann|Kagan VE|Valerian Kagan|Fedorova M|Maria Fedorova|Pratt DA|Derek Pratt|Rodriguez R|Rapha[eë]l Rodriguez|Mishima E|Eikan Mishima|Papagiannakopoulos T|Thales Papagiannakopoulos|Ubellacker J|Jessalyn Ubellacker|Linkermann A|Andreas Linkermann|Vanden Berghe T|Tom Vanden Berghe|Garcia-Saez A|Garc[ií]a-S[aá]ez A|Ana Garc/i;

function topicsFor(text) {
  const topics = topicRules.filter(([, regex]) => regex.test(text)).map(([topic]) => topic);
  return topics.length ? topics.slice(0, 5) : ["ferroptosis"];
}

function scoreFor(text, authors = "", journal = "") {
  let score = 35;
  const tracked = trackedAuthors.test(authors);
  const topJournal = /Nature|Cell|Science|Molecular Cell|Cancer Discovery|Cancer Cell|Nature Communications|EMBO|PNAS/i.test(journal);
  if (/lipid peroxid|phospholipid|oxidized lipid|oxidised lipid|PUFA|polyunsaturated/i.test(text)) score += 12;
  if (/\bFSP1\b|AIFM2/i.test(text)) score += 12;
  if (/\bGPX4\b|glutathione peroxidase 4/i.test(text)) score += 4;
  if (/iron homeostasis|labile iron|ferritin|NCOA4|TFR1|transferrin|ferroportin/i.test(text)) score += 10;
  if (/selenium|selenoprotein|PRDX6/i.test(text)) score += 10;
  if (/lysosom|organelle|contact site|endoplasmic reticulum/i.test(text)) score += 8;
  if (/cancer|tumou?r|metasta|leukemia|glioma/i.test(text)) score += 5;
  if (/in vivo|patient|organoid|mouse|mice|porcine|human/i.test(text)) score += 5;
  if (tracked) score += 22;
  if (topJournal) score += 12;
  if (/review|perspective|comment|editorial/i.test(text)) score -= 30;
  if (/nomogram|signature|bioinformatic|machine learning|bibliometric|network pharmacology|mendelian random/i.test(text)) score -= 28;
  if (/attenuat|alleviat|ameliorat|protects?|improv|repress|restores?|rescues?/i.test(text)) score -= 10;
  if (/nanozyme|nanoparticle|nanocomposite|hydrogel|exosome/i.test(text)) score -= 8;
  if (/via (the )?.{0,35}(NRF2|Nrf2|GPX4)|NRF2.{0,20}GPX4/i.test(text)) score -= 6;
  const ceiling = tracked ? 96 : 89;
  return Math.min(ceiling, Math.max(15, score));
}

// Every automated record states the route that found it and leaves evidence strength
// unassessed. An automated query proves that a record matched a search; it does not
// establish what kind of document it is or how far its result can be reused.
function automatedRecord({ sourceName, id, url, doi, nctId, pmid, classification, ...rest }) {
  const documentType = classification?.documentType || "unknown";
  // PubMed indexes preprints alongside journal articles. A record the classifier reads as
  // a preprint is presented as one, with the caveat attached, whichever query found it —
  // otherwise a bioRxiv posting arrives through the laboratory watch looking like a paper.
  const base = {
    id, url, doi, nctId, pmid, ...rest,
    sourceType: documentType === "preprint" ? "preprint" : rest.sourceType,
    caveat: documentType === "preprint" ? rest.caveat || "Not peer reviewed." : rest.caveat,
  };
  const identity = canonicalIdentity(base);
  return {
    ...base,
    ...identity,
    documentType,
    documentTypeBasis: classification?.documentTypeBasis || "not-classified",
    documentSignals: classification?.signals || [],
    evidenceGrade: null,
    evidenceGradeBasis: "unassessed",
    reviewStatus: "automated",
    sourceName,
    stale: false,
    freshnessState: "current",
    staleSourceNames: [],
    freshSourceNames: [sourceName],
    lastSuccessAt: generatedAt,
    lastAttemptAt: generatedAt,
    // Freshness is carried by the route, so a later merge can tell which of a record's
    // discovery routes is current and which is a retained copy of a failed one.
    sources: [{
      route: sourceName,
      kind: "automated",
      recordId: id,
      url,
      retrievedAt: generatedAt,
      stale: false,
      lastSuccessAt: generatedAt,
      lastAttemptAt: generatedAt,
    }],
  };
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// Network failures are classified so a retained dataset can say why it went stale.
function errorClassOf(error) {
  const message = String(error?.message || error || "");
  if (/empty-result/.test(message)) return "empty-result";
  if (/abort|timeout/i.test(message)) return "timeout";
  if (/^\s*4\d\d/.test(message) || /\b4\d\d\b/.test(message)) return "http-client-error";
  if (/^\s*5\d\d/.test(message) || /\b5\d\d\b/.test(message)) return "http-server-error";
  if (/fetch failed|ENOTFOUND|ECONN/i.test(message)) return "network-unreachable";
  if (/JSON|Unexpected token/i.test(message)) return "malformed-response";
  return "unknown-error";
}

async function fetchJson(url, maxAttempts = 4) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "FerroScope/0.1 (research intelligence dashboard)" },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return response.json();
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts - 1) throw new Error(`${response.status} ${response.statusText}`);
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1_000
        : 1_500 * (2 ** attempt);
      console.warn(`${new URL(url).hostname} returned ${response.status}; retrying in ${backoff} ms (attempt ${attempt + 2} of ${maxAttempts}).`);
      await delay(Math.min(backoff, 15_000));
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts - 1 || /^(4\d\d)/.test(error.message) && !error.message.startsWith("429")) throw error;
      const backoff = 1_500 * (2 ** attempt);
      console.warn(`${new URL(url).hostname} request failed; retrying in ${backoff} ms (attempt ${attempt + 2} of ${maxAttempts}): ${error.message}`);
      await delay(Math.min(backoff, 15_000));
    }
  }
  throw lastError || new Error("request failed");
}

const PUBMED_SOURCE = "PubMed";
const LAB_WATCH_SOURCE = "Tracked labs / PubMed";
const PREPRINT_SOURCE = "Preprints / Crossref";
const TRIAL_SOURCE = "ClinicalTrials.gov";

async function fetchPubMed() {
  const term = [
    "ferroptosis[Title/Abstract]",
    "NOT review[Publication Type]",
    `AND (\"${new Date(now.getFullYear() - 2, 0, 1).toISOString().slice(0, 10)}\"[Date - Publication] : \"3000\"[Date - Publication])`,
  ].join(" ");
  const search = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  search.search = new URLSearchParams({ db: "pubmed", term, retmode: "json", retmax: "100", sort: "date" });
  const searchData = await fetchJson(search);
  const ids = searchData.esearchresult?.idlist || [];
  if (!ids.length) return [];
  const summary = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  summary.search = new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "json" });
  const summaryData = await fetchJson(summary);
  return ids.map((pmid) => {
    const item = summaryData.result?.[pmid];
    if (!item) return null;
    const authors = (item.authors || []).map((author) => author.name).join(", ");
    const journal = item.fulljournalname || "";
    const text = `${item.title || ""} ${authors} ${journal}`;
    const doi = (item.articleids || []).find((identifier) => identifier.idtype === "doi")?.value;
    const dates = pubmedDates(item, toDate);
    return automatedRecord({
      sourceName: PUBMED_SOURCE,
      id: `pubmed-${pmid}`,
      pmid,
      doi,
      title: (item.title || "Untitled").replace(/<[^>]+>/g, ""),
      date: dates.displayDate,
      onlineDate: dates.onlineDate,
      issueDate: dates.issueDate,
      datePrecision: dates.datePrecision,
      sourceType: "paper",
      classification: classifyPubMedDocument(item),
      relevance: scoreFor(text, authors, journal),
      topics: topicsFor(text),
      takeaway: `${item.fulljournalname || "PubMed"} · ${authors || UNNAMED_AUTHORS}`,
      url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    });
  }).filter(Boolean).filter((item) => item.relevance >= 60).slice(0, 35);
}

async function fetchTrackedLabs(configs, publicLabName) {
  const idToLabs = new Map();
  const since = new Date(now.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  for (const config of configs) {
    const search = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
    const term = `ferroptosis[Title/Abstract] AND (${config.query}) AND (\"${since}\"[Date - Publication] : \"3000\"[Date - Publication]) NOT (Review[Publication Type] OR Editorial[Publication Type] OR Comment[Publication Type] OR Published Erratum[Publication Type])`;
    search.search = new URLSearchParams({ db: "pubmed", term, retmode: "json", retmax: "4", sort: "date" });
    const data = await fetchJson(search);
    for (const pmid of data.esearchresult?.idlist || []) {
      const labs = idToLabs.get(pmid) || [];
      labs.push(config);
      idToLabs.set(pmid, labs);
    }
    await delay(500);
  }
  const ids = [...idToLabs.keys()];
  if (!ids.length) return [];
  const summary = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  summary.search = new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "json" });
  const summaryData = await fetchJson(summary);
  return ids.map((pmid) => {
    const item = summaryData.result?.[pmid];
    if (!item) return null;
    const labs = idToLabs.get(pmid) || [];
    const authors = (item.authors || []).map((author) => author.name).join(", ");
    const journal = item.fulljournalname || "PubMed";
    const text = `${item.title || ""} ${authors} ${journal}`;
    const doi = (item.articleids || []).find((identifier) => identifier.idtype === "doi")?.value;
    const maxLabRelevance = Math.max(...labs.map((lab) => lab.relevance || 80));
    const title = (item.title || "Untitled").replace(/<[^>]+>/g, "");
    const titleDirect = /ferropt|lipid|iron|FSP1|GPX4|NCOA4|ACSL4|selen|ferritin|peroxid/i.test(title);
    // Display names come from the public English laboratory overlay, keyed by laboratory id,
    // so the watch query never becomes the published name of a laboratory.
    const matchedNames = labs.map((lab) => publicLabName.get(lab.labId)).filter(Boolean);
    const dates = pubmedDates(item, toDate);
    return automatedRecord({
      sourceName: LAB_WATCH_SOURCE,
      id: `pubmed-${pmid}`,
      pmid,
      doi,
      title,
      date: dates.displayDate,
      onlineDate: dates.onlineDate,
      issueDate: dates.issueDate,
      datePrecision: dates.datePrecision,
      sourceType: "paper",
      classification: classifyPubMedDocument(item),
      relevance: Math.max(60, Math.min(92, maxLabRelevance - 8 + Math.min(4, topicsFor(text).length) - (titleDirect ? 0 : 12))),
      topics: topicsFor(text),
      trackedLabIds: labs.map((lab) => lab.labId),
      takeaway: matchedNames.length
        ? `${journal} · Laboratory watch match: ${matchedNames.join(", ")}.`
        : `${journal} · Matched by a tracked laboratory author query.`,
      url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    });
  }).filter(Boolean)
    .filter((item) => !["commentary", "correction", "review", "protocol"].includes(item.documentType))
    .filter((item) => !/correction|erratum|editorial|commentary|perspective|protocol/i.test(item.title))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 35);
}

async function fetchPreprints() {
  const url = new URL("https://api.crossref.org/works");
  url.search = new URLSearchParams({
    "query.title": "ferroptosis",
    filter: `from-pub-date:${fromDate},type:posted-content`,
    rows: "100",
    select: "DOI,title,author,published,publisher",
  });
  const data = await fetchJson(url);
  const results = data.message?.items || [];
  let skippedWithoutDoi = 0;
  const records = results.map((item) => {
    // A posted-content item with no parseable DOI has no registry identity. Its URL
    // would be "https://doi.org/undefined", and every such item in a run shares that
    // URL — the canonical merge would then fuse unrelated studies into one card.
    if (!normalizeDoi(item.DOI)) { skippedWithoutDoi += 1; return null; }
    const title = Array.isArray(item.title) ? item.title[0] : item.title;
    const authors = (item.author || []).map((author) => [author.given, author.family].filter(Boolean).join(" ")).join(", ");
    const posted = calendarDateFromParts(item.published?.["date-parts"]?.[0] || []);
    const text = `${title || ""} ${authors}`;
    return automatedRecord({
      sourceName: PREPRINT_SOURCE,
      id: `preprint-${item.DOI}`,
      doi: item.DOI,
      title,
      // A deposit date after today is a record-keeping artefact, not news — the same
      // clamp pubmedDates applies; the unclamped date stays visible as onlineDate.
      date: posted && posted.date > toDate ? toDate : posted?.date || null,
      onlineDate: posted?.date || null,
      issueDate: null,
      datePrecision: posted?.precision || null,
      sourceType: "preprint",
      classification: { documentType: "preprint", documentTypeBasis: "crossref-posted-content", signals: [] },
      relevance: Math.min(92, scoreFor(text, authors) - 3),
      topics: topicsFor(text),
      takeaway: `${authors || UNNAMED_AUTHORS} · ${item.publisher || "Preprint server"}`,
      caveat: "Not peer reviewed.",
      url: `https://doi.org/${item.DOI}`,
    });
  }).filter(Boolean);
  if (skippedWithoutDoi) console.warn(`${PREPRINT_SOURCE}: skipped ${skippedWithoutDoi} posted-content item(s) with no parseable DOI.`);
  return records.filter((item) => /ferroptosis|ferroptotic/i.test(item.title || ""))
    .filter((item) => !/^(figure|fig\.?|table|data|dataset|supplement|supplementary|supporting information)\b/i.test(item.title || ""))
    .filter((item) => item.relevance >= 54).sort((a, b) => b.relevance - a.relevance).slice(0, 30);
}

async function fetchTrials() {
  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  url.search = new URLSearchParams({ "query.term": "ferroptosis", pageSize: "100", format: "json" });
  const data = await fetchJson(url);
  // Named apart from the module-level `statuses` array of per-source results, which this
  // function would otherwise shadow.
  const statusScores = { RECRUITING: 10, ACTIVE_NOT_RECRUITING: 8, NOT_YET_RECRUITING: 7, COMPLETED: 3, TERMINATED: -5, UNKNOWN: -8 };
  let skippedWithoutNct = 0;
  const trials = (data.studies || []).map(({ protocolSection }) => {
    const identification = protocolSection?.identificationModule || {};
    const status = protocolSection?.statusModule || {};
    const design = protocolSection?.designModule || {};
    const conditions = protocolSection?.conditionsModule || {};
    const arms = protocolSection?.armsInterventionsModule || {};
    const nctId = identification.nctId;
    // A study record without a real NCT number has no registry identity, and its URL
    // would be ".../study/undefined" — shared by every such record in the run, which
    // the canonical merge would fuse into one chimera card.
    if (!/^NCT\d{8}$/.test(nctId || "")) { skippedWithoutNct += 1; return null; }
    const title = identification.briefTitle || identification.officialTitle || nctId;
    const interventions = (arms.interventions || []).map((item) => item.name).join(", ");
    const text = `${title} ${(conditions.conditions || []).join(" ")} ${interventions}`;
    const direct = /iron|ferropt|nanoparticle|ferrostatin|liproxstatin|GPX4|FSP1/i.test(interventions);
    const statusScore = statusScores[status.overallStatus] || 0;
    // Registry dates can arrive at month precision ("2026-05"); parsed as calendar
    // dates so they normalise instead of failing the ISO contract, and clamped so a
    // future-posted study cannot pin the top of the date sort.
    const posted = parseCalendarDate(status.studyFirstPostDateStruct?.date || status.startDateStruct?.date || "");
    return automatedRecord({
      sourceName: TRIAL_SOURCE,
      id: `trial-${nctId}`,
      nctId,
      title,
      date: posted && posted.date > toDate ? toDate : posted?.date || null,
      datePrecision: posted?.precision || null,
      sourceType: "trial",
      classification: { documentType: "trial-record", documentTypeBasis: "clinicaltrials-registry", signals: [design.studyType || "study-type-unreported"] },
      relevance: Math.min(84, 38 + statusScore + (direct ? 18 : 0) + (design.studyType === "INTERVENTIONAL" ? 10 : 0)),
      topics: ["clinical study", ...(topicsFor(text).filter((topic) => topic !== "ferroptosis"))].slice(0, 5),
      takeaway: `${status.overallStatus || "Status not reported"} · ${design.studyType || "Study type not reported"}${interventions ? ` · ${interventions}` : ""}`,
      caveat: design.studyType === "OBSERVATIONAL"
        ? "An observational association cannot show that ferroptosis occurs in these patients."
        : "A clinical outcome does not by itself establish ferroptosis as the mechanism.",
      url: `https://clinicaltrials.gov/study/${nctId}`,
    });
  }).filter(Boolean);
  if (skippedWithoutNct) console.warn(`${TRIAL_SOURCE}: skipped ${skippedWithoutNct} registry record(s) with no usable NCT identifier.`);
  return { total: trials.length, items: trials.sort((a, b) => b.relevance - a.relevance).slice(0, 20) };
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; }
}

const statuses = [];
const collections = [];
let trialTotal = 0;
const watchConfigs = await readJson(path.join(dataDir, "watch-queries.json"), []);
const englishLabs = await readJson(path.join(dataDir, "labs-en.json"), []);
const publicLabName = new Map(englishLabs.map((lab) => [lab.id, lab.pi]));
// A previous dataset that parses but has the wrong shape (a truncated write, a hand
// edit) degrades to the empty fallback instead of reaching the retention path as a
// non-array, where it would crash the generator and freeze every source at once.
const previousLiveRaw = await readJson(path.join(dataDir, "live.json"), []);
const previousLive = Array.isArray(previousLiveRaw) ? previousLiveRaw : [];
const previousMetaRaw = await readJson(path.join(dataDir, "meta.json"), {});
const previousMeta = previousMetaRaw && typeof previousMetaRaw === "object" && !Array.isArray(previousMetaRaw) ? previousMetaRaw : {};
const previousStatusFor = (name) => (previousMeta.sources || []).find((source) => source.name === name);

const loaders = [
  [LAB_WATCH_SOURCE, () => fetchTrackedLabs(watchConfigs, publicLabName)],
  [PUBMED_SOURCE, fetchPubMed],
  [PREPRINT_SOURCE, fetchPreprints],
  [TRIAL_SOURCE, fetchTrials],
];

// How many records a source published in the previous run, counted by route so a
// record merged from several discovery routes still counts for each of them.
const previousPublishedCount = (name) =>
  previousLive.filter((item) => sourceRoutesOf(item).some((route) => route.route === name)).length;

for (const [name, loader] of loaders) {
  try {
    const result = await loader();
    const harvested = name === TRIAL_SOURCE ? result.items : result;
    // A record with no usable calendar date cannot satisfy the published data
    // contract, and one such record failing validation used to abort the whole
    // refresh. It is dropped here, and the drop is stated in the source's status
    // note so a mass drop is visible in meta.json rather than only in this log.
    const { dated, undated } = partitionByUsableDate(harvested);
    if (undated.length) console.warn(`${name}: dropped ${undated.length} record(s) with no usable calendar date: ${undated.map((item) => item.id).join(", ")}.`);
    // An API that changes response shape, a deprecated query syntax or a mass date
    // regression all arrive as a well-formed empty answer, not as a thrown error.
    // Publishing that emptiness as "ok" would silently clear the source's records.
    // A source that published records last run and returns none now is treated as
    // failed with class "empty-result", so its previous records are retained and
    // marked stale like any other failure. A source whose previous run also
    // published nothing keeps reporting ok: there is nothing to lose or retain.
    if (!dated.length && previousPublishedCount(name) > 0) {
      throw new Error("empty-result: the source answered but yielded no publishable records, while the previous run published some");
    }
    if (name === TRIAL_SOURCE) trialTotal = result.total;
    collections.push(...dated);
    const dropNote = undated.length ? ` ${undated.length} record(s) were dropped for carrying no usable calendar date.` : "";
    statuses.push(successStatus({
      sourceName: name,
      count: dated.length,
      attemptedAt: generatedAt,
      note: name === TRIAL_SOURCE
        ? `Retrieved ${result.total} registry records; the ${dated.length} most relevant are published.${dropNote}`
        : `${dated.length} records passed the quality filter in this run.${dropNote}`,
    }));
  } catch (error) {
    // A failed source keeps the records it last returned, marked stale, instead of
    // silently disappearing from a dataset that is then published as current.
    const previous = previousStatusFor(name);
    const retention = retainOnFailure({
      sourceName: name,
      previousItems: previousLive,
      lastSuccessAt: previous?.lastSuccessAt || (previous?.ok ? previous?.updatedAt : null),
      attemptedAt: generatedAt,
      errorClass: errorClassOf(error),
    });
    collections.push(...retention.items);
    statuses.push(retention.status);
    console.error(`${name} update failed (${retention.status.errorClass}); ${retention.status.retainedItems} retained records marked stale.`);
  }
}

// Two discovery routes for the same study collapse onto one canonical record and the
// union of their laboratory matches, instead of the later route overwriting the earlier.
const merged = mergeSignalLayers(collections);
// Backstop for the per-source partition above: the merge and the retention path can in
// principle reintroduce an undated record (a retained copy written before this contract
// existed). One such record failing validation would abort the whole refresh, so it is
// dropped here — logged, never silently.
const datedMerge = partitionByUsableDate(merged);
if (datedMerge.undated.length) {
  console.warn(`Dropped ${datedMerge.undated.length} merged record(s) with no usable calendar date so they cannot fail validation and freeze the refresh: ${datedMerge.undated.map((item) => item.id).join(", ")}.`);
}
const live = datedMerge.dated
  .sort((a, b) => b.relevance - a.relevance || String(b.date || "").localeCompare(String(a.date || "")));
const curated = await readJson(path.join(dataDir, "intelligence-curated.json"), []);
// The laboratory-site row is maintained by the manual link check, so its timestamp is
// carried over. No automated crawler exists for laboratory pages, and the row says so.
const previousLabStatus = previousStatusFor("Lab / Network sites");
const labStatus = {
  name: "Lab / Network sites",
  ok: previousLabStatus?.ok ?? true,
  state: previousLabStatus?.state || "manual",
  lastSuccessAt: previousLabStatus?.lastSuccessAt || previousLabStatus?.updatedAt || generatedAt,
  lastAttemptAt: previousLabStatus?.lastAttemptAt || previousLabStatus?.updatedAt || generatedAt,
  retainedItems: 0,
  retainedAgeDays: null,
  maxAgeDays: null,
  errorClass: null,
  note: "Official laboratory links are curated manually and checked by the scheduled link monitor. No automated crawler reads laboratory pages for new content.",
};

const meta = {
  generatedAt,
  version: "0.1.0",
  schemaVersion: "1.1.0",
  // Declared here and cross-checked against data/schema-versions.json, so a dataset
  // written by an older generator cannot be validated as if it carried the new fields.
  generator: "scripts/update-data.mjs",
  generatorVersion: "1.1.0",
  counts: {
    clinicalTrials: trialTotal || previousMeta.counts?.clinicalTrials || 0,
    curatedSignals: curated.length,
    liveSignals: live.length,
    // A record every one of whose routes failed, and a record still backed by a route that
    // succeeded, are different states and are counted separately.
    staleSignals: live.filter((item) => item.stale).length,
    partiallyStaleSignals: live.filter((item) => item.freshnessState === "partially-stale").length,
  },
  sources: [...statuses, labStatus],
};

await fs.writeFile(path.join(dataDir, "live.json"), `${JSON.stringify(live, null, 2)}\n`);
await fs.writeFile(path.join(dataDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
console.log(`FerroScope refresh complete: ${live.length} automated signals (${meta.counts.staleSignals} retained as stale, ${meta.counts.partiallyStaleSignals} still backed by a route that succeeded); ClinicalTrials.gov reported ${meta.counts.clinicalTrials} matching records.`);
