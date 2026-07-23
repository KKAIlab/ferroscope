import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const now = new Date();
const generatedAt = now.toISOString();
const fromDate = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
const toDate = now.toISOString().slice(0, 10);

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

function pubmedDate(item) {
  const raw = item.epubdate || item.sortpubdate || item.pubdate || "";
  const parsed = new Date(raw.replaceAll("/", "-"));
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  if (parsed > now) return toDate;
  return parsed.toISOString().slice(0, 10);
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

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
    return {
      id: `pubmed-${pmid}`,
      title: (item.title || "Untitled").replace(/<[^>]+>/g, ""),
      date: pubmedDate(item),
      sourceType: "paper",
      evidence: "B",
      relevance: scoreFor(text, authors, journal),
      topics: topicsFor(text),
      takeaway: `${item.fulljournalname || "PubMed"} · ${authors || UNNAMED_AUTHORS}`,
      url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    };
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
    return {
      id: `pubmed-${pmid}`,
      title,
      date: pubmedDate(item),
      sourceType: "paper",
      evidence: "B",
      relevance: Math.max(60, Math.min(92, maxLabRelevance - 8 + Math.min(4, topicsFor(text).length) - (titleDirect ? 0 : 12))),
      topics: topicsFor(text),
      trackedLabIds: labs.map((lab) => lab.labId),
      takeaway: matchedNames.length
        ? `${journal} · Laboratory watch match: ${matchedNames.join(", ")}.`
        : `${journal} · Matched by a tracked laboratory author query.`,
      url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    };
  }).filter(Boolean)
    .filter((item) => !/correction|erratum|editorial|commentary|perspective|protocol/i.test(item.title))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
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
  return results.map((item) => {
    const title = Array.isArray(item.title) ? item.title[0] : item.title;
    const authors = (item.author || []).map((author) => [author.given, author.family].filter(Boolean).join(" ")).join(", ");
    const dateParts = item.published?.["date-parts"]?.[0] || [];
    const date = dateParts.length ? `${dateParts[0]}-${String(dateParts[1] || 1).padStart(2, "0")}-${String(dateParts[2] || 1).padStart(2, "0")}` : "";
    const text = `${title || ""} ${authors}`;
    return {
      id: `preprint-${item.DOI}`,
      title,
      date,
      sourceType: "preprint",
      evidence: "C",
      relevance: Math.min(92, scoreFor(text, authors) - 3),
      topics: topicsFor(text),
      takeaway: `${authors || UNNAMED_AUTHORS} · ${item.publisher || "Preprint server"}`,
      caveat: "Not peer reviewed.",
      url: `https://doi.org/${item.DOI}`,
    };
  }).filter((item) => /ferroptosis|ferroptotic/i.test(item.title || ""))
    .filter((item) => !/^(figure|fig\.?|table|data|dataset|supplement|supplementary|supporting information)\b/i.test(item.title || ""))
    .filter((item) => item.relevance >= 54).sort((a, b) => b.relevance - a.relevance).slice(0, 30);
}

async function fetchTrials() {
  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  url.search = new URLSearchParams({ "query.term": "ferroptosis", pageSize: "100", format: "json" });
  const data = await fetchJson(url);
  const statuses = { RECRUITING: 10, ACTIVE_NOT_RECRUITING: 8, NOT_YET_RECRUITING: 7, COMPLETED: 3, TERMINATED: -5, UNKNOWN: -8 };
  const trials = (data.studies || []).map(({ protocolSection }) => {
    const identification = protocolSection?.identificationModule || {};
    const status = protocolSection?.statusModule || {};
    const design = protocolSection?.designModule || {};
    const conditions = protocolSection?.conditionsModule || {};
    const arms = protocolSection?.armsInterventionsModule || {};
    const nctId = identification.nctId;
    const title = identification.briefTitle || identification.officialTitle || nctId;
    const interventions = (arms.interventions || []).map((item) => item.name).join(", ");
    const text = `${title} ${(conditions.conditions || []).join(" ")} ${interventions}`;
    const direct = /iron|ferropt|nanoparticle|ferrostatin|liproxstatin|GPX4|FSP1/i.test(interventions);
    const statusScore = statuses[status.overallStatus] || 0;
    return {
      id: `trial-${nctId}`,
      title,
      date: status.studyFirstPostDateStruct?.date || status.startDateStruct?.date || "",
      sourceType: "trial",
      evidence: direct && ["PHASE1", "PHASE2", "PHASE1|PHASE2"].includes((design.phases || []).join("|")) ? "C" : "D",
      relevance: Math.min(84, 38 + statusScore + (direct ? 18 : 0) + (design.studyType === "INTERVENTIONAL" ? 10 : 0)),
      topics: ["clinical study", ...(topicsFor(text).filter((topic) => topic !== "ferroptosis"))].slice(0, 5),
      takeaway: `${status.overallStatus || "Status not reported"} · ${design.studyType || "Study type not reported"}${interventions ? ` · ${interventions}` : ""}`,
      caveat: design.studyType === "OBSERVATIONAL"
        ? "An observational association cannot show that ferroptosis occurs in these patients."
        : "A clinical outcome does not by itself establish ferroptosis as the mechanism.",
      url: `https://clinicaltrials.gov/study/${nctId}`,
    };
  });
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

for (const [name, loader] of [["Tracked labs / PubMed", () => fetchTrackedLabs(watchConfigs, publicLabName)], ["PubMed", fetchPubMed], ["Preprints / Crossref", fetchPreprints], ["ClinicalTrials.gov", fetchTrials]]) {
  try {
    const result = await loader();
    if (name === "ClinicalTrials.gov") {
      trialTotal = result.total;
      collections.push(...result.items);
      statuses.push({ name, ok: true, updatedAt: generatedAt, note: `Retrieved ${result.total} registry records; the ${result.items.length} most relevant are published.` });
    } else {
      collections.push(...result);
      statuses.push({ name, ok: true, updatedAt: generatedAt, note: `${result.length} ${result.length === 1 ? "record" : "records"} passed the quality filter in this run.` });
    }
  } catch (error) {
    statuses.push({ name, ok: false, updatedAt: generatedAt, note: error.message });
    console.error(`${name} update failed:`, error.message);
  }
}

const live = [...new Map(collections.map((item) => [item.id, item])).values()]
  .sort((a, b) => b.relevance - a.relevance || new Date(b.date || 0) - new Date(a.date || 0));
const curated = await readJson(path.join(dataDir, "intelligence-curated.json"), []);
const previousMeta = await readJson(path.join(dataDir, "meta.json"), {});
// The laboratory-site row is maintained by the manual link check, so its timestamp is
// carried over. Its note is always rewritten in English: earlier runs stored it in Chinese.
const previousLabStatus = previousMeta.sources?.find((source) => source.name === "Lab / Network sites");
const labStatus = {
  name: "Lab / Network sites",
  ok: previousLabStatus?.ok ?? true,
  updatedAt: previousLabStatus?.updatedAt || generatedAt,
  note: "Official laboratory links are curated manually; heterogeneous laboratory sites are not automatically crawled.",
};

const meta = {
  generatedAt,
  version: "0.1.0",
  schemaVersion: "1.0.0",
  counts: { clinicalTrials: trialTotal || previousMeta.counts?.clinicalTrials || 0, curatedSignals: curated.length, liveSignals: live.length },
  sources: [...statuses, labStatus],
};

await fs.writeFile(path.join(dataDir, "live.json"), `${JSON.stringify(live, null, 2)}\n`);
await fs.writeFile(path.join(dataDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
console.log(`FerroScope refresh complete: ${live.length} automated signals; ClinicalTrials.gov reported ${meta.counts.clinicalTrials} matching records.`);
