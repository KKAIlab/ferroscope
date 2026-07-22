import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const now = new Date();
const generatedAt = now.toISOString();
const fromDate = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
const toDate = now.toISOString().slice(0, 10);

const topicRules = [
  ["脂质过氧化", /lipid peroxid|phospholipid|oxidized lipid|oxidised lipid|PUFA|polyunsaturated/i],
  ["FSP1", /\bFSP1\b|AIFM2/i],
  ["GPX4", /\bGPX4\b|glutathione peroxidase 4/i],
  ["铁稳态", /iron homeostasis|labile iron|ferritin|NCOA4|TFR1|transferrin|ferroportin/i],
  ["溶酶体", /lysosom|ferritinophagy/i],
  ["线粒体", /mitochond/i],
  ["硒代谢", /selenium|selenoprotein|PRDX6/i],
  ["细胞器接触", /organelle|contact site|endoplasmic reticulum/i],
  ["肿瘤转化", /cancer|tumou?r|metasta|leukemia|glioma/i],
  ["肾损伤", /kidney|renal|ischemia.reperfusion/i],
  ["方法学", /method|reproduc|screen|probe|imaging/i],
];

// 只自动匹配低歧义作者名。Wang F、Zhang Q、Jiang X 等常见缩写会制造大量假阳性，
// 这些团队通过人工精选层和单独作者查询维护，不在宽泛标题流中加权。
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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "FerroScope/0.1 (research intelligence dashboard)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
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
      takeaway: `${item.fulljournalname || "PubMed"} · ${authors || "作者信息见原文"}`,
      url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    };
  }).filter(Boolean).filter((item) => item.relevance >= 60).slice(0, 35);
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchTrackedLabs(configs) {
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
    await wait(360);
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
    return {
      id: `pubmed-${pmid}`,
      title,
      date: pubmedDate(item),
      sourceType: "paper",
      evidence: "B",
      relevance: Math.max(60, Math.min(92, maxLabRelevance - 8 + Math.min(4, topicsFor(text).length) - (titleDirect ? 0 : 12))),
      topics: topicsFor(text),
      trackedLabs: labs.map((lab) => lab.label),
      trackedLabIds: labs.map((lab) => lab.labId),
      takeaway: `${journal} · 定向命中：${labs.map((lab) => lab.label).join("、")}`,
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
      takeaway: `${authors || "作者信息见原文"} · ${item.publisher || "预印本平台"}`,
      caveat: "尚未同行评议。",
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
      topics: ["临床试验", ...(topicsFor(text).filter((topic) => topic !== "ferroptosis"))].slice(0, 5),
      takeaway: `${status.overallStatus || "状态未知"} · ${design.studyType || "研究类型未知"}${interventions ? ` · ${interventions}` : ""}`,
      caveat: design.studyType === "OBSERVATIONAL" ? "观察性关联不能证明患者体内发生 ferroptosis。" : "临床结局不能自动证明 ferroptosis 是作用机制。",
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

for (const [name, loader] of [["Tracked labs / PubMed", () => fetchTrackedLabs(watchConfigs)], ["PubMed", fetchPubMed], ["Preprints / Crossref", fetchPreprints], ["ClinicalTrials.gov", fetchTrials]]) {
  try {
    const result = await loader();
    if (name === "ClinicalTrials.gov") {
      trialTotal = result.total;
      collections.push(...result.items);
      statuses.push({ name, ok: true, updatedAt: generatedAt, note: `检索到 ${result.total} 条记录，前端保留相关度较高的 ${result.items.length} 条。` });
    } else {
      collections.push(...result);
      statuses.push({ name, ok: true, updatedAt: generatedAt, note: `本轮通过质量筛选 ${result.length} 条。` });
    }
  } catch (error) {
    statuses.push({ name, ok: false, updatedAt: generatedAt, note: error.message });
    console.error(`${name} 更新失败：`, error.message);
  }
}

const live = [...new Map(collections.map((item) => [item.id, item])).values()]
  .sort((a, b) => b.relevance - a.relevance || new Date(b.date || 0) - new Date(a.date || 0));
const curated = await readJson(path.join(dataDir, "intelligence-curated.json"), []);
const previousMeta = await readJson(path.join(dataDir, "meta.json"), {});
const labStatus = previousMeta.sources?.find((source) => source.name === "Lab / Network sites") || {
  name: "Lab / Network sites", ok: true, updatedAt: generatedAt, note: "官网链接由人工维护。",
};

const meta = {
  generatedAt,
  version: "0.1.0",
  counts: { clinicalTrials: trialTotal || previousMeta.counts?.clinicalTrials || 0, curatedSignals: curated.length, liveSignals: live.length },
  sources: [...statuses, labStatus],
};

await fs.writeFile(path.join(dataDir, "live.json"), `${JSON.stringify(live, null, 2)}\n`);
await fs.writeFile(path.join(dataDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
console.log(`FerroScope 更新完成：${live.length} 条自动信号，ClinicalTrials.gov 共 ${meta.counts.clinicalTrials} 条记录。`);
