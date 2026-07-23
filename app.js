import { DOCUMENT_TYPE_LABELS, canonicalIdentity, evidenceGradeFor, formatCalendarDate, mergeSignalLayers } from "./lib/records.mjs";
import { buildGraph, isSourceChecked } from "./lib/graph.mjs";

export const state = {
  labs: [], methods: [], glossary: [], resources: [], signals: [], network: null, meta: null,
  researchProfiles: new Map(), researchCounts: null, watchedLabIds: new Set(),
  coverage: null, coverageByLab: new Map(), graph: null, bundles: null, manifest: null,
  papers: [], paperLinks: [], papersByDoi: new Map(), papersByCanonicalId: new Map(), linksByPaper: new Map(),
  recordOverlays: new Map(),
  source: "all", topic: "all", documentClass: "all", signalSort: "relevance", visibleSignals: 8,
  labCategory: "All", labSearch: "", methodGroup: "All", methodSearch: "",
  resourceType: "All", glossarySearch: "", visibleGlossary: 8, selectedMechanism: "lipid-peroxidation",
  paperTheme: "All", paperSearch: "",
};

const categoryLabels = { core: "Core mechanisms", methods: "Methods & chemistry", translational: "Disease & translation", adjacent: "Strategic adjacent fields" };
// The badge states the route a record arrived by. What kind of document it is comes from
// the separate document badge, because a PubMed hit can be original research, a Spotlight
// or an erratum and the route cannot tell them apart.
const sourceLabels = { paper: "Literature record", preprint: "Preprint", trial: "Clinical registry" };
const evidenceOrder = { A: 4, B: 3, C: 2, D: 1 };
const topicMap = {
  "脂质过氧化": "lipid peroxidation", "铁稳态": "iron homeostasis", "溶酶体": "lysosome", "线粒体": "mitochondria",
  "硒代谢": "selenium metabolism", "细胞器接触": "organelle contacts", "肿瘤转化": "cancer translation", "肾损伤": "kidney injury",
  "方法学": "methods", "临床试验": "clinical study", "膜锚定": "membrane anchoring", "结构生物学": "structural biology",
  "神经退行": "neurodegeneration", "多胺": "polyamines", "代谢": "metabolism", "机制": "mechanism", "药物发现": "drug discovery",
  "器官移植": "organ transplantation", "铁死亡抑制剂": "ferroptosis inhibitor", "离体灌流": "ex situ perfusion", "转化": "translation",
  "维生素B2": "vitamin B2", "蛋白质稳态": "protein quality control", "肺癌": "lung cancer", "体内模型": "in vivo models",
  "肿瘤转移": "metastasis", "微环境": "microenvironment", "黑色素瘤": "melanoma", "化学生物学": "chemical biology",
  "死亡传播": "death propagation", "异质性": "heterogeneity", "活细胞成像": "live-cell imaging", "细胞衰老": "senescence",
  "化学蛋白质组": "chemical proteomics", "药物筛选": "screening", "肿瘤微环境": "tumour microenvironment",
  "磷脂过氧化": "phospholipid peroxidation", "质膜": "plasma membrane", "光遗传": "optogenetics", "膜生物物理": "membrane biophysics",
  "雌二醇": "oestradiol", "醚脂质": "ether lipids", "氧化磷脂": "oxidized phospholipids", "可重复性": "reproducibility",
  "证据标准": "evidence standards", "癌症转化": "cancer translation", "负结果": "negative results", "研究诚信": "research integrity",
  "纳米铁": "iron-loaded nanoparticles", "实体瘤": "solid tumours", "胶质母细胞瘤": "glioblastoma", "药物再利用": "drug repurposing",
  "生物标志物": "biomarkers", "危重症": "critical illness", "观察研究": "observational study"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const hasCjk = (value = "") => /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(String(value));
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const safeUrl = (value = "") => { try { const url = new URL(value, location.href); return ["https:", "http:"].includes(url.protocol) ? url.href : "#"; } catch { return "#"; } };
const plain = (value, fallback = "") => value && !hasCjk(value) ? value : fallback;

async function readJson(path, fallback) {
  try { const response = await fetch(path, { cache: "no-store" }); if (!response.ok) throw new Error(`${response.status} ${response.statusText}`); return await response.json(); }
  catch (error) { console.error(`Could not read ${path}`, error); return fallback; }
}

// A stored date is a calendar date in the publisher's own frame. Formatting it through
// `new Date(date)` reads it as UTC midnight and renders the previous day in any negative
// UTC offset, which put the ingestion layer's timezone defect straight back into the
// browser. The components are read out of the string instead; see formatCalendarDate.
function formatDate(date) {
  if (!date) return "Date unavailable";
  return formatCalendarDate(date) || escapeHtml(date);
}

function timeAgo(date) {
  if (!date) return "not updated";
  const hours = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 3_600_000));
  if (hours < 1) return "within 1 hour"; if (hours < 24) return `${hours} hours ago`; return `${Math.floor(hours / 24)} days ago`;
}

function normalizeTopics(topics = []) { return topics.map((topic) => topicMap[topic] || plain(topic, "ferroptosis")); }

// What kind of document a record is, answered by whoever read the most. A curated audit
// outranks a published reading record, which outranks the ingestion classifier, which
// outranks the discovery route. The route on its own can only say that something matched
// a search, so its answer is "PubMed record", never "peer reviewed original research".
function documentClassOf(item) {
  const overlay = state.recordOverlays.get(item.canonicalId);
  if (overlay?.documentType) return { documentType: overlay.documentType, documentTypeBasis: overlay.documentTypeBasis || "curated-audit", documentSubtype: overlay.documentSubtype || "" };
  if (state.papersByCanonicalId.has(item.canonicalId)) return { documentType: "original-research", documentTypeBasis: "paper-layer-audit", documentSubtype: "" };
  if (item.documentType) return { documentType: item.documentType, documentTypeBasis: item.documentTypeBasis || "ingestion", documentSubtype: item.documentSubtype || "" };
  if (item.sourceType === "trial") return { documentType: "trial-record", documentTypeBasis: "discovery-route", documentSubtype: "" };
  if (item.sourceType === "preprint") return { documentType: "preprint", documentTypeBasis: "discovery-route", documentSubtype: "" };
  return { documentType: "unknown", documentTypeBasis: "discovery-route", documentSubtype: "" };
}

function normalizeSignal(item, briefMap, labMap) {
  const brief = briefMap.get(item.id) || {};
  const labs = (item.trackedLabIds || []).map((id) => labMap.get(id)?.pi).filter(Boolean);
  const fallback = item.reviewStatus === "automated"
    ? (labs.length ? `Primary-source alert matched by the laboratory watch: ${labs.join(", ")}.` : "Automatically captured from a source index; open the primary record before interpretation.")
    : "Open the primary source and the evidence card before reusing this claim.";
  const overlay = state.recordOverlays.get(item.canonicalId);
  return {
    ...item,
    ...documentClassOf(item),
    ...evidenceGradeFor({ reviewStatus: item.reviewStatus, declaredGrade: item.evidence || item.evidenceGrade, overlayGrade: overlay?.evidenceGrade }),
    title: plain(item.title, "Untitled source record"),
    topics: brief.topics || normalizeTopics(item.topics),
    takeaway: brief.takeaway || plain(item.takeaway, fallback),
    caveat: brief.caveat || plain(item.caveat, ""),
    trackedLabs: labs,
  };
}

// An unassessed record shows an empty meter rather than one filled bar, so "nobody has
// graded this" cannot be misread as "graded, and weak".
function meter(level, sourceType) {
  const value = evidenceOrder[level] || 0;
  return `<div class="meter ${sourceType === "preprint" ? "orange" : ""}${value ? "" : " unassessed"}">${[1,2,3,4].map((number) => `<i class="${number <= value ? "on" : ""}"></i>`).join("")}</div>`;
}

function renderFrontiers() {
  const items = state.signals.filter((item) => item.featured).sort((a,b) => (b.relevance || 0) - (a.relevance || 0)).slice(0,3);
  $("#frontierGrid").innerHTML = items.map((item, index) => `<a class="frontier-card" data-index="0${index + 1}" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer"><div class="frontier-top"><span class="tag">${escapeHtml(item.frontier || item.topics?.[0] || "FRONTIER")}</span><span class="date">${formatDate(item.date)}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.takeaway)}</p></a>`).join("");
}

function renderTopicOptions() {
  const topics = [...new Set(state.signals.flatMap((item) => item.topics || []))].sort((a,b) => a.localeCompare(b, "en"));
  $("#topicFilter").innerHTML = '<option value="all">All topics</option>' + topics.map((topic) => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join("");
}

// A commentary and an original research paper are not interchangeable, so the reader can
// separate them instead of having to recognise a Spotlight by its title.
function renderDocumentOptions() {
  const counts = new Map();
  for (const item of state.signals) counts.set(item.documentType, (counts.get(item.documentType) || 0) + 1);
  const types = [...counts.keys()].sort((a,b) => (DOCUMENT_TYPE_LABELS[a] || a).localeCompare(DOCUMENT_TYPE_LABELS[b] || b, "en"));
  $("#documentFilter").innerHTML = `<option value="all">All document types (${state.signals.length})</option>` + types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(DOCUMENT_TYPE_LABELS[type] || type)} (${counts.get(type)})</option>`).join("");
}

function filteredSignals() {
  const items = state.signals.filter((item) => (state.source === "all" || item.sourceType === state.source)
    && (state.topic === "all" || item.topics?.includes(state.topic))
    && (state.documentClass === "all" || item.documentType === state.documentClass));
  // An unassessed record sorts below every graded one instead of being treated as grade D.
  return items.sort((a,b) => state.signalSort === "date" ? String(b.date || "").localeCompare(String(a.date || "")) : state.signalSort === "evidence" ? (evidenceOrder[b.evidenceGrade] || 0) - (evidenceOrder[a.evidenceGrade] || 0) || (b.relevance || 0) - (a.relevance || 0) : (b.relevance || 0) - (a.relevance || 0) || String(b.date || "").localeCompare(String(a.date || "")));
}

function documentBadge(item) {
  // An unclassified automated hit says what it is: a record that matched a PubMed query.
  // An unclassified curated card says the type was never written down, which is a
  // different gap and should not be disguised as the same one.
  const label = item.documentType === "unknown"
    ? (item.reviewStatus === "curated" ? "Document type not recorded" : DOCUMENT_TYPE_LABELS.unknown)
    : (DOCUMENT_TYPE_LABELS[item.documentType] || "Document type not recorded");
  const detail = item.documentSubtype ? ` · ${item.documentSubtype}` : "";
  return `<span class="doc-badge ${escapeHtml(item.documentType || "unknown")}" title="Document class established by: ${escapeHtml(item.documentTypeBasis || "discovery-route")}">${escapeHtml(label + detail)}</span>`;
}

// Partial degradation and a wholly retained record are different facts. A card whose every
// automated route failed is being published from retained bytes; a card that lost one route
// of several is still backed by a source that succeeded, and saying "retained" about it
// would overstate the damage in one direction and hide it in the other.
function freshnessBadge(item) {
  const stale = item.staleSourceNames || [];
  if (item.freshnessState === "stale" || (!item.freshnessState && item.stale)) {
    const detail = stale.length ? `: ${stale.join(", ")}` : "";
    return `<span class="review-badge stale" title="Published from the records this source last returned${escapeHtml(detail)}.">retained · every source route last failed</span>`;
  }
  if (item.freshnessState === "partially-stale") {
    return `<span class="review-badge partial-stale" title="Still backed by a discovery route that succeeded in this run.">one route retained · ${escapeHtml(stale.join(", ") || "a secondary source")} last failed</span>`;
  }
  return "";
}

function evidenceBlock(item) {
  const graded = Boolean(item.evidenceGrade);
  const heading = graded ? `Evidence level ${escapeHtml(item.evidenceGrade)}` : "Evidence not assessed";
  const basis = graded ? "" : '<small class="evidence-basis">No curated audit has graded this record.</small>';
  return `<div class="evidence"><span>${heading}</span>${meter(item.evidenceGrade, item.sourceType)}${basis}<b class="relevance">Research fit ${Number(item.relevance || 0)}/100</b></div>`;
}

export function renderSignals() {
  const all = filteredSignals(), visible = all.slice(0, state.visibleSignals);
  $("#signalList").innerHTML = visible.length ? visible.map((item) => `<article class="signal-item"><div class="signal-source"><span class="source-badge ${escapeHtml(item.sourceType)}">${escapeHtml(sourceLabels[item.sourceType] || item.sourceType)}</span>${documentBadge(item)}<span class="review-badge ${escapeHtml(item.reviewStatus)}">${item.reviewStatus === "curated" ? "curated" : "automated alert"}</span>${item.alsoDiscoveredAutomatically ? '<span class="review-badge merged">also matched by the laboratory watch</span>' : ""}${freshnessBadge(item)}<time datetime="${escapeHtml(item.date || "")}">${formatDate(item.date)}</time></div><div class="signal-main"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.takeaway)}${item.caveat ? ` <span class="inline-caveat">Boundary: ${escapeHtml(item.caveat)}</span>` : ""}</p><div class="signal-tags">${(item.trackedLabs || []).slice(0,2).map((lab) => `<span class="chip lab-hit">LAB · ${escapeHtml(lab)}</span>`).join("")}${(item.topics || []).slice(0,4).map((topic) => `<span class="chip">${escapeHtml(topic)}</span>`).join("")}</div></div>${evidenceBlock(item)}<a class="signal-arrow" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer" aria-label="Open primary source">↗</a></article>`).join("") : '<div class="empty">No signals match the current filters.</div>';
  $("#loadMoreSignals").hidden = visible.length >= all.length;
}

function labMethods(labId) { return state.methods.filter((method) => method.distinctiveLabs?.includes(labId)); }

// No laboratory-site crawler exists, so a laboratory without an author watch is not
// "site watched" — it is read by a person. The badge says which of the two it is.
function coverageBadge(labId) {
  const row = state.coverageByLab.get(labId);
  if (row && row.authorWatch !== "none") {
    const pending = row.watchState === "pending-first-run";
    return `<span class="watch-state ${pending ? "pending" : "on"}">● ${pending ? "author watch · first run pending" : "author watch"}</span>`;
  }
  return '<span class="watch-state manual">● manual official link · not yet automated</span>';
}

function coverageSummary() {
  const rows = state.coverage?.labs || [];
  if (!rows.length) return "";
  const active = rows.filter((row) => row.authorWatch !== "none" && row.watchState === "active").length;
  const pendingRun = rows.filter((row) => row.authorWatch !== "none" && row.watchState === "pending-first-run").length;
  const manual = rows.filter((row) => row.authorWatch === "none").length;
  const siteMonitored = rows.filter((row) => row.siteMonitor && row.siteMonitor !== "none").length;
  return `Monitoring coverage: ${active}/${rows.length} laboratories have a running author watch; ${pendingRun} further author watches were added and have not run yet; ${manual} are manual-only; ${siteMonitored}/${rows.length} have an automated site monitor, because no laboratory-site crawler exists.`;
}
function renderLabCategories() {
  const categories = ["All", ...Object.values(categoryLabels)];
  $("#labCategories").innerHTML = categories.map((category) => `<button type="button" data-category="${escapeHtml(category)}" aria-pressed="${category === state.labCategory}" class="${category === state.labCategory ? "active" : ""}">${escapeHtml(category)}</button>`).join("");
  $$("#labCategories button").forEach((button) => button.addEventListener("click", () => { state.labCategory = button.dataset.category; renderLabCategories(); renderLabs(); }));
}

function renderLabs() {
  const term = state.labSearch.trim().toLowerCase();
  const labs = state.labs.filter((lab) => state.labCategory === "All" || categoryLabels[lab.category] === state.labCategory).filter((lab) => !term || [lab.pi, lab.institution, lab.region, lab.focus, lab.question, ...(lab.tags || []), ...(lab.aliases || []), ...labMethods(lab.id).map((method) => method.name)].join(" ").toLowerCase().includes(term)).sort((a,b) => (b.relevance || 0) - (a.relevance || 0));
  $("#labGrid").innerHTML = labs.length ? labs.map((lab, index) => { const profile = state.researchProfiles.get(lab.id); const audited = profile?.audit?.status !== "pending"; return `<article class="lab-card"><span class="lab-number">${String(index + 1).padStart(2,"0")} / ${String(labs.length).padStart(2,"0")}</span><span class="lab-class">${escapeHtml(categoryLabels[lab.category])}</span><span class="research-stage ${audited ? "audited" : "screened"}">${audited ? "evidence-audited archive" : "screened profile"}</span><h3>${escapeHtml(lab.pi)}</h3><div class="institution">${escapeHtml(lab.institution)}</div><p class="lab-question">${escapeHtml(lab.question || lab.focus)}</p><div class="lab-tags">${(lab.tags || []).slice(0,5).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div><div class="lab-bottom"><span class="region">${escapeHtml(lab.region)}</span>${coverageBadge(lab.id)}<button class="research-open" data-lab-id="${escapeHtml(lab.id)}" type="button">profile</button><a class="visit" href="${safeUrl(lab.website)}" target="_blank" rel="noreferrer">lab ↗</a></div></article>`; }).join("") : '<div class="empty">No laboratory matches this search.</div>';
}

export function renderResearchProfile(labId) {
  const lab = state.labs.find((item) => item.id === labId), profile = state.researchProfiles.get(labId); if (!lab) return;
  const methods = labMethods(labId); const studies = (profile?.majorStudies || []).map((study) => {
    const english = paperFor(study.url);
    const link = paperLabs(english?.id || "").find((entry) => entry.labId === labId);
    const status = english
      ? `${articleStageLabels[english.articleStage] || english.articleStage} · ${postPublicationLabels[english.postPublicationStatus] || english.postPublicationStatus}`
      : "publication state not yet verified in English";
    const released = english
      ? `<p class="study-released"><b>English reading record</b>${escapeHtml(depthBadge(english))}. Metadata re-checked against the DOI record on ${escapeHtml(english.verification?.checkedAt || "an unrecorded date")}${link ? `. This laboratory is recorded as ${escapeHtml(roleLabels[link.role] || link.role)}.` : "."}</p><div class="study-actions"><button type="button" class="paper-open" data-paper-id="${escapeHtml(english.id)}">Open reading record ↗</button><a href="${safeUrl(study.url)}" target="_blank" rel="noreferrer">Open original paper ↗</a></div>`
      : `<p class="study-limit"><b>English release status</b>The source and audit metadata are retained. The interpretive text remains unpublished until English translation is checked against the paper.</p><a href="${safeUrl(study.url)}" target="_blank" rel="noreferrer">Open original paper ↗</a>`;
    return `<article class="research-study"><div class="reading-layer-label"><span>Scale 1 · 60-second paper card</span><small>${english ? "Scale 2 · figure chain published in English" : "Legacy archive audit recorded, not yet published in English"} · ${escapeHtml(status)}</small></div><div class="study-meta">${escapeHtml(study.journal)} · ${escapeHtml(study.year)}</div><h5>${escapeHtml(study.title)}</h5>${released}</article>`;
  }).join("");
  $("#labResearchContent").innerHTML = `<p class="eyebrow">GLOBAL LAB PROFILE · ENGLISH VERIFIED LAYER</p><h3>${escapeHtml(lab.pi)}</h3><p class="research-institution">${escapeHtml(lab.institution)} · ${escapeHtml(lab.region)}</p><p class="reading-layer-kicker">Scale 3 · longitudinal laboratory synthesis</p><section class="research-question"><span>Persistent question</span><strong>${escapeHtml(lab.question)}</strong><p>${escapeHtml(lab.focus)}</p></section><section class="research-block"><h4>Distinctive method capability</h4><div class="research-chips">${methods.length ? methods.map((method) => `<span>${escapeHtml(method.name)}</span>`).join("") : '<span>Capability mapping in progress</span>'}</div></section><section class="research-block"><h4>Representative source records · paper-level evidence</h4>${studies || '<p class="research-pending">No representative paper has passed the source-attribution gate yet.</p>'}</section><section class="research-block audit-block"><h4>Language and evidence control</h4><p class="audit-good">✓ English PI, institution, focus and question are published.</p><p class="audit-open">? Chinese/Japanese names are search aliases, not parallel narrative copies.</p><p class="audit-fix">↺ Legacy Chinese figure notes remain offline until source-checked English migration.</p></section><div class="research-actions"><a href="${safeUrl(lab.website)}" target="_blank" rel="noreferrer">Lab website ↗</a></div>`;
  $("#labResearchDialog").showModal();
}

// Where a paper sits in the publishing pipeline and what happened to it afterwards are
// two different facts. A version of record that was once read as a corrected proof has
// no published correction; conflating the two invents a correction history.
const articleStageLabels = { "version-of-record": "version of record", "accepted-manuscript": "accepted manuscript", "corrected-proof": "corrected proof", preprint: "preprint" };
const postPublicationLabels = { none: "no post-publication notice", corrected: "carries a registered correction", "expression-of-concern": "expression of concern", "editor-note": "editor's note on the record", retracted: "retracted", contested: "formally contested" };
const readingDepthLabels = { metadata: "metadata record", abstract: "abstract-level reading", "figure-chain": "figure chain", longitudinal: "longitudinal synthesis" };
const verificationDepthLabels = { "not-read": "Not read", "curated-unverified": "Curated, unverified", "archive-derived": "Archive-derived", "metadata-only": "Metadata-only", "metadata-checked": "Metadata-checked", "abstract-checked": "Abstract-checked", "figures-legends-checked": "Figures and legends checked", "methods-checked": "Methods-checked", "supplement-checked": "Supplement-checked", "full-text-rechecked": "Full-text-rechecked", "raw-data-rechecked": "Raw-data-rechecked" };
const noticeTypeLabels = { "author-correction": "Author Correction", "publisher-correction": "Publisher Correction", "matters-arising": "Matters Arising", reply: "Reply", "editor-note": "Editor's Note", "expression-of-concern": "Expression of Concern", retraction: "Retraction", "article-stage-reclassification": "Article-stage reclassification" };
const conclusionImpactLabels = {
  "none-stated": "the notice states no conclusion change",
  "explicitly-none": "the notice states that conclusions are unaffected",
  "potentially-material": "the change could bear on the conclusions",
  material: "the conclusions are affected",
  unknown: "conclusion impact not established",
};
const roleLabels = { lead: "lead laboratory", "co-lead": "co-lead laboratory", "method collaborator": "method collaborator", "conceptual collaborator": "conceptual collaborator", "pre-independence": "first-author work before independent appointment", "contributing-author": "contributing author, role unverified" };

// The badge that appears on the card and at the top of the dialog, so the distance
// between "we re-read the figures" and "we rewrote an existing audit" is visible before
// the reader scrolls, not only in a footnote at the bottom of a long modal.
function depthBadge(paper) {
  const reading = readingDepthLabels[paper.readingDepth] || paper.readingDepth || "reading depth unrecorded";
  const verification = verificationDepthLabels[paper.verificationDepth] || paper.verificationDepth || "verification depth unrecorded";
  const sources = paper.verification?.sources || [];
  const parts = [`${verification} ${reading}`];
  if (sources.some((source) => source.kind === "pubmed" && source.status === "source-checked")) parts.push("abstract cross-checked");
  const fullText = sources.find((source) => source.kind === "publisher-full-text");
  if (!fullText || fullText.status !== "source-checked") parts.push("full figures pending");
  return parts.join(" · ");
}

function paperFor(url = "") { return state.papersByDoi.get(url.toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "").replace(/\/$/, "")); }
function paperLabs(paperId) { return (state.linksByPaper.get(paperId) || []).map((link) => ({ ...link, lab: state.labs.find((lab) => lab.id === link.labId) })).filter((entry) => entry.lab); }

function renderPaperThemes() {
  const themes = ["All", ...new Set(state.papers.map((paper) => paper.theme))];
  $("#paperThemes").innerHTML = themes.map((theme) => `<button type="button" data-paper-theme="${escapeHtml(theme)}" aria-pressed="${theme === state.paperTheme}" class="${theme === state.paperTheme ? "active" : ""}">${escapeHtml(theme)}</button>`).join("");
  $$("#paperThemes button").forEach((button) => button.addEventListener("click", () => { state.paperTheme = button.dataset.paperTheme; renderPaperThemes(); renderPapers(); }));
}

function renderPapers() {
  const term = state.paperSearch.trim().toLowerCase();
  const papers = state.papers
    .filter((paper) => state.paperTheme === "All" || paper.theme === state.paperTheme)
    .filter((paper) => !term || [paper.title, paper.journal, paper.theme, paper.sixtySecond?.story, paper.sixtySecond?.advance, ...paperLabs(paper.id).map((entry) => entry.lab.pi)].join(" ").toLowerCase().includes(term))
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, "en"));
  $("#paperGrid").innerHTML = papers.length ? papers.map((paper) => {
    const leads = paperLabs(paper.id).filter((entry) => ["lead", "co-lead", "pre-independence"].includes(entry.role));
    return `<article class="paper-card"><div class="paper-top"><span>${escapeHtml(paper.journal)} · ${escapeHtml(String(paper.year))}</span><b class="paper-status ${paper.postPublicationStatus && paper.postPublicationStatus !== "none" ? "flagged" : ""}">${escapeHtml(articleStageLabels[paper.articleStage] || paper.articleStage)}${paper.postPublicationStatus && paper.postPublicationStatus !== "none" ? ` · ${escapeHtml(postPublicationLabels[paper.postPublicationStatus] || paper.postPublicationStatus)}` : ""}</b></div><h3>${escapeHtml(paper.title)}</h3><p class="paper-depth">${escapeHtml(depthBadge(paper))}</p><p>${escapeHtml(paper.sixtySecond.advance)}</p><div class="paper-tags">${paper.contested ? '<span class="chip contested">formally contested</span>' : ""}${leads.slice(0, 2).map((entry) => `<span class="chip lab-hit">LAB · ${escapeHtml(entry.lab.pi)}</span>`).join("")}</div><div class="paper-bottom"><button type="button" class="paper-open" data-paper-id="${escapeHtml(paper.id)}">Open reading record ↗</button><a href="${safeUrl(paper.url)}" target="_blank" rel="noreferrer">Primary source ↗</a></div></article>`;
  }).join("") : '<div class="empty">No paper matches this filter.</div>';
}

export function renderPaperDetail(paperId) {
  const paper = state.papers.find((item) => item.id === paperId); if (!paper) return;
  const sixty = paper.sixtySecond, verification = paper.verification || {};
  const events = (paper.versionEvents || []).map((event) => {
    const read = (event.reviews || []).some((review) => review.reviewState === "source-checked");
    const readOn = (event.reviews || [])[0]?.checkedAt;
    return `<li><b>${escapeHtml(noticeTypeLabels[event.noticeType] || event.type)}</b> · ${escapeHtml(event.date)}${event.doi ? ` · <a href="${safeUrl(`https://doi.org/${event.doi}`)}" target="_blank" rel="noreferrer">${escapeHtml(event.doi)}</a>` : ""}${event.sourceUrl ? ` · <a href="${safeUrl(event.sourceUrl)}" target="_blank" rel="noreferrer">open the notice ↗</a>` : ""}<span class="event-domains">Affects: ${escapeHtml((event.affectedDomains || []).join(", ") || "domain not recorded")}</span><span class="event-impact">${escapeHtml(conclusionImpactLabels[event.conclusionImpact] || conclusionImpactLabels.unknown)}</span><span>${escapeHtml(event.note)}</span><small>${read ? `Notice text read in full on ${escapeHtml(readOn || "an unrecorded date")}` : `Classified from metadata on ${escapeHtml(event.classifiedAt || "an unrecorded date")}; notice text not opened`}</small></li>`;
  }).join("");
  const checkedSources = (verification.sources || []).filter((source) => source.status === "source-checked");
  const uncheckedSources = (verification.sources || []).filter((source) => source.status !== "source-checked");
  const sourceRows = (verification.sources || []).map((source) => `<li class="source-row ${escapeHtml(source.status || "unknown")}"><b>${escapeHtml(source.kind)}</b><span>${source.status === "source-checked" ? `${escapeHtml(verificationDepthLabels[source.verificationDepth] || source.verificationDepth || "checked")}${source.checkedAt ? ` on ${escapeHtml(source.checkedAt)}` : ""}` : "not checked in this pass"}</span><span>${escapeHtml((source.scope || []).join(", ") || "no field was read from this source")}</span>${source.url ? `<a href="${safeUrl(source.url)}" target="_blank" rel="noreferrer">open ↗</a>` : ""}</li>`).join("");
  // The one-line summary is generated from the structured source list, so it cannot
  // drift away from what the record actually says was checked.
  const verificationSummary = `Checked on ${verification.checkedAt || "an unrecorded date"} against ${checkedSources.map((source) => source.kind).join(", ") || "no source"}. Not opened in this pass: ${uncheckedSources.map((source) => source.kind).join(", ") || "nothing"}.`;
  const derivation = verification.derivation
    ? `<p class="audit-open">? This reading record was produced by ${escapeHtml(verification.derivation.type)} from ${escapeHtml(verification.derivation.sourceRecord || "an unrecorded record")}${verification.derivation.sourceCommit ? ` at repository commit ${escapeHtml(verification.derivation.sourceCommit)}` : ""}. It is not a fresh reading of the full text.</p>`
    : "";
  const figures = (paper.figureAudit || []).map((figure) => `<article class="figure-unit"><div class="figure-head"><b>${escapeHtml(figure.figure)}</b><small>${escapeHtml(figure.sourceScope)}</small></div><p class="figure-question">${escapeHtml(figure.question)}</p><dl><dt>Intervention</dt><dd>${escapeHtml(figure.intervention)}</dd><dt>Readout</dt><dd>${escapeHtml(figure.readout)}</dd><dt>Answer</dt><dd>${escapeHtml(figure.answer)}</dd></dl><p class="figure-boundary"><b>Cannot show</b>${escapeHtml(figure.boundary)}</p></article>`).join("");
  const attribution = paperLabs(paper.id).map((entry) => `<li><b>${escapeHtml(entry.lab.pi)}</b> · ${escapeHtml(roleLabels[entry.role] || entry.role)}<span>${escapeHtml(entry.roleBasis)}</span><span>${escapeHtml(entry.continuity)}</span></li>`).join("");
  $("#paperContent").innerHTML = `<p class="eyebrow">${escapeHtml(paper.journal)} · ${escapeHtml(String(paper.year))} · ${escapeHtml(articleStageLabels[paper.articleStage] || paper.articleStage)} · ${escapeHtml(postPublicationLabels[paper.postPublicationStatus] || paper.postPublicationStatus)}${paper.contested ? " · FORMALLY CONTESTED" : ""}</p><h3>${escapeHtml(paper.title)}</h3><p class="depth-banner">${escapeHtml(depthBadge(paper))}</p><p class="paper-citation">${escapeHtml(paper.citation || "")} · ${escapeHtml(paper.doi)}</p>
<section class="research-block"><p class="reading-layer-kicker">Scale 1 · 60-second question card</p><div class="sixty-grid"><div><span>What was open</span><p>${escapeHtml(sixty.story)}</p></div><div><span>What this adds</span><p>${escapeHtml(sixty.advance)}</p></div><div><span>Evidence anchor</span><p>${escapeHtml(sixty.evidenceAnchor)}</p></div><div><span>Scope limit</span><p>${escapeHtml(sixty.scope)}</p></div><div><span>Still open</span><p>${escapeHtml(sixty.openQuestion)}</p></div></div></section>
<section class="research-block"><h4>Condition vector</h4><p class="condition-vector">${escapeHtml(paper.conditionVector)}</p></section>
${events ? `<section class="research-block"><h4>Version and correction history</h4><ul class="version-events">${events}</ul></section>` : ""}
<section class="research-block"><p class="reading-layer-kicker">Scale 2 · Figure-level causal audit</p><div class="figure-chain">${figures}</div></section>
<section class="research-block"><h4>Laboratory attribution</h4><ul class="attribution-list">${attribution || "<li>No attribution record.</li>"}</ul></section>
<section class="research-block audit-block"><h4>What was verified, and when</h4><p class="audit-good">✓ ${escapeHtml(verificationSummary)}</p><ul class="verification-sources">${sourceRows || "<li>No structured source record.</li>"}</ul>${derivation}${(verification.unresolved || []).map((item) => `<p class="audit-fix">↺ ${escapeHtml(item)}</p>`).join("")}</section>
<div class="research-actions"><a href="${safeUrl(paper.url)}" target="_blank" rel="noreferrer">Open the primary source ↗</a></div>`;
  $("#paperDialog").showModal();
}

function renderMethodGroups() {
  const groups = ["All", ...new Set(state.methods.map((method) => method.group))];
  $("#methodGroups").innerHTML = groups.map((group) => `<button type="button" data-group="${escapeHtml(group)}" aria-pressed="${group === state.methodGroup}" class="${group === state.methodGroup ? "active" : ""}">${escapeHtml(group)}</button>`).join("");
  $$("#methodGroups button").forEach((button) => button.addEventListener("click", () => { state.methodGroup = button.dataset.group; renderMethodGroups(); renderMethods(); }));
}

function renderMethods() {
  const term = state.methodSearch.trim().toLowerCase();
  const methods = state.methods.filter((method) => state.methodGroup === "All" || method.group === state.methodGroup).filter((method) => !term || [method.name, method.group, method.evidenceRole, method.plainEnglish, method.measures, method.cannotProve, ...method.distinctiveLabs.map((id) => state.labs.find((lab) => lab.id === id)?.pi || "")].join(" ").toLowerCase().includes(term));
  $("#methodGrid").innerHTML = methods.length ? methods.map((method) => `<article class="method-card"><div class="method-top"><span>${escapeHtml(method.group)}</span><b>${escapeHtml(method.evidenceRole)}</b></div><h3>${escapeHtml(method.name)}</h3><p>${escapeHtml(method.plainEnglish)}</p><div class="method-boundary"><span>Cannot prove alone</span>${escapeHtml(method.cannotProve)}</div><div class="method-labs">${method.distinctiveLabs.slice(0,4).map((id) => state.labs.find((lab) => lab.id === id)?.pi).filter(Boolean).map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>${method.decisionProfile ? `<p class="method-schema-state">${Number(method.decisionProfile.sourceCheckedFields)} of ${Number(method.decisionProfile.sourceCheckedFields) + Number(method.decisionProfile.pendingFields)} decision fields source-checked</p>` : ""}<button type="button" class="method-open" data-method-id="${escapeHtml(method.id)}">Open evidence card ↗</button></article>`).join("") : '<div class="empty">No method matches this search.</div>';
}

const DECISION_AXIS_LABELS = {
  specimen: "Specimen or model", question: "Question it answers", perturbation: "What is changed",
  readout: "What is measured", quantificationUnit: "Quantification unit", instrument: "Instrument or platform",
  positiveControl: "Essential positive control", negativeControl: "Essential negative control", processControl: "Process control",
  orthogonalConfirmation: "Orthogonal confirmation", timing: "Timing constraint",
  compartmentResolution: "Compartment resolution", confounders: "Confounders",
};
const SOURCE_ROUTE_LABELS = {
  "vendor-protocol": "Vendor protocol", "field-recommendation": "Field recommendation",
  "original-research-demonstration": "Original research demonstration",
  "local-laboratory-capability": "Local laboratory capability", "unclassified-source": "Source not yet classified",
};

// The decision schema is only useful if the gaps are as visible as the answers. A field
// nobody has established renders as an unresolved question naming what has to be read,
// never as an empty row a reader can mistake for "not applicable".
function decisionProfileHtml(method) {
  const profile = method.decisionProfile;
  if (!profile) return "";
  const rows = Object.entries(DECISION_AXIS_LABELS).map(([axis, label]) => {
    const field = profile.fields?.[axis];
    if (!field) return "";
    const checked = field.status === "source-checked";
    const body = checked
      ? `<p>${escapeHtml(field.value)}</p><small class="field-source">${(field.evidence || []).map((entry) => `checked ${escapeHtml(entry.checkedAt)} by ${escapeHtml(entry.checkedBy)} · ${escapeHtml((entry.scope || []).join(", "))}`).join(" · ")}</small>`
      : `<p class="field-unresolved">${escapeHtml(field.unresolved)}</p>${field.curatedStatement ? `<small class="field-curated">The module itself states: ${escapeHtml(field.curatedStatement)} This has not been checked against a source.</small>` : ""}`;
    return `<div class="decision-row ${checked ? "checked" : "pending"}"><b>${escapeHtml(label)}</b><span class="field-status">${checked ? "source-checked" : "pending source review"}</span>${body}</div>`;
  }).join("");
  const banner = profile.reviewState === "pending-source-review"
    ? `<p class="provisional-banner"><b>Provisional module</b>${escapeHtml(profile.provisionalBecause)} ${profile.sourceCheckedFields} of ${profile.sourceCheckedFields + profile.pendingFields} decision fields are source-checked.</p>`
    : "";
  return `<section class="research-block"><h4>Decision fields</h4>${banner}<div class="decision-grid">${rows}</div></section>`;
}

function sourceRoutesHtml(method) {
  const routes = method.sourceRoutes || [];
  if (!routes.length) return "";
  return `<section class="research-block"><h4>Declared sources</h4><div class="source-routes">${routes.map((route) => `<article class="source-route ${escapeHtml(route.status)}"><div class="route-top"><span>${escapeHtml(SOURCE_ROUTE_LABELS[route.kind] || route.kind)}</span><b>${route.status === "source-checked" ? `read ${escapeHtml(route.checkedAt || "")}` : "not read"}</b></div><p>${escapeHtml(route.kindBasis)}</p><p class="route-boundary"><b>What declaring it does not prove</b>${escapeHtml(route.boundary)}</p><a href="${safeUrl(route.url)}" target="_blank" rel="noreferrer">Open source ↗</a></article>`).join("")}</div></section>`;
}

// distinctiveLabs is a curated shortlist, not evidence. A capability claim counts here only
// when a source-checked claim links a paper to this module and the attribution layer
// independently places the laboratory on that paper.
function capabilityHtml(method) {
  const attribution = method.capabilityAttribution;
  if (!attribution) return "";
  const name = (id) => state.labs.find((lab) => lab.id === id)?.pi || id;
  const demonstrated = (attribution.demonstrated || []).map((row) => `<article class="capability-row"><div class="capability-top"><b>${escapeHtml(name(row.labId))}</b><span>${escapeHtml(row.role)}${row.listedAsDistinctive ? "" : " · not on the curated shortlist"}</span></div><button type="button" class="paper-open" data-paper-id="${escapeHtml(row.paperId)}">${escapeHtml(state.papers.find((paper) => paper.id === row.paperId)?.title || row.paperId)}</button><small>${escapeHtml(row.figure)} · attribution checked ${escapeHtml(row.checkedAt)}</small><p class="capability-boundary">${escapeHtml(row.boundary)}</p></article>`).join("");
  const claimed = (attribution.claimedWithoutEvidence || []).map((row) => `<span title="${escapeHtml(row.reason)}">${escapeHtml(name(row.labId))}</span>`).join("");
  return `<section class="research-block"><h4>Laboratory capability</h4><p class="capability-note">${escapeHtml(attribution.note)}</p>${demonstrated ? `<div class="capability-list"><span class="capability-heading">Demonstrated through a source-checked claim (${(attribution.demonstrated || []).length})</span>${demonstrated}</div>` : '<p class="research-pending">No paper in this repository links a laboratory to this module through a source-checked claim.</p>'}${claimed ? `<div class="capability-claimed"><span class="capability-heading">Listed by curated judgement, no evidence recorded (${(attribution.claimedWithoutEvidence || []).length})</span><div class="research-chips muted">${claimed}</div></div>` : ""}</section>`;
}

// P1-D: a module built on a dataset that no independent party has read says so. The review
// fingerprint mechanism only protects content once someone has actually reviewed the bytes.
function datasetReviewHtml() {
  const entry = state.manifest?.files?.["methods.json"];
  if (!entry?.reviewPending) return "";
  return `<p class="dataset-review"><b>Underlying dataset awaiting review</b>This module is published from data/methods.json, which is owned but has no independent byte-level review recorded (reviewPending). Nothing on this card is pinned to reviewed bytes.</p>`;
}

export function renderMethodDetail(methodId) {
  const method = state.methods.find((item) => item.id === methodId); if (!method) return;
  // A method is answered as part of a decision, not as an item in a catalogue: what
  // question it belongs to, what has to accompany it, and what the result still cannot
  // support afterwards.
  const standalone = (state.bundles?.neverStandalone || []).find((entry) => entry.methodId === method.id);
  // A side-by-side box, shown on both methods it compares, so the difference between a probe
  // signal and a named oxidised species is visible on the assay page rather than only in prose.
  const comparisons = (state.bundles?.comparisons || []).filter((entry) => (entry.methodIds || []).includes(method.id));
  const comparisonHtml = comparisons.map((entry) => `<section class="research-block"><h4>${escapeHtml(entry.title)}</h4><p class="comparison-question">${escapeHtml(entry.question)}</p><div class="comparison-grid"><div class="comparison-head"><span></span><b>${escapeHtml(state.methods.find((m) => m.id === entry.methodIds[0])?.name || entry.methodIds[0])}</b><b>${escapeHtml(state.methods.find((m) => m.id === entry.methodIds[1])?.name || entry.methodIds[1])}</b></div>${(entry.rows || []).map((row) => `<div class="comparison-row"><span class="comparison-axis">${escapeHtml(row.axis)}</span><p>${escapeHtml(row.bodipy)}</p><p>${escapeHtml(row.lcms)}</p></div>`).join("")}</div><p class="comparison-bottom"><b>Bottom line</b>${escapeHtml(entry.bottomLine)}</p><p class="comparison-boundary">${escapeHtml(entry.boundary)}</p></section>`).join("");
  const inBundles = (state.bundles?.bundles || []).filter((bundle) => (bundle.minimumBundle || []).some((step) => step.methodId === method.id) || (bundle.optionalDepth || []).some((step) => step.methodId === method.id));
  const bundleHtml = inBundles.map((bundle) => {
    const step = (bundle.minimumBundle || []).find((entry) => entry.methodId === method.id);
    const optional = (bundle.optionalDepth || []).find((entry) => entry.methodId === method.id);
    const companions = (bundle.minimumBundle || []).filter((entry) => entry.methodId !== method.id).map((entry) => state.methods.find((item) => item.id === entry.methodId)?.name).filter(Boolean);
    return `<article class="bundle-card"><span class="bundle-model">${escapeHtml(bundle.model)}</span><b>${escapeHtml(bundle.question)}</b><p>${escapeHtml(step ? `Required in this bundle: ${step.why}` : `Optional depth: ${optional?.adds || ""}`)}</p><p class="bundle-companions"><b>Must be read together with</b>${escapeHtml(companions.join(" · ") || "no other measurement recorded")}</p><p class="bundle-boundary"><b>Still cannot support</b>${escapeHtml(bundle.interpretationBoundary)}</p></article>`;
  }).join("");
  $("#methodContent").innerHTML = `<p class="eyebrow">${escapeHtml(method.group)} · ${escapeHtml(method.evidenceRole)}</p><h3>${escapeHtml(method.name)}</h3><section class="research-question"><span>In simple English</span><strong>${escapeHtml(method.plainEnglish)}</strong><p><b>Measures:</b> ${escapeHtml(method.measures)}</p></section>${standalone ? `<p class="never-standalone"><b>Never a standalone answer</b>${escapeHtml(standalone.reason)}</p>` : ""}<section class="research-block"><h4>What it cannot prove alone</h4><p class="method-warning">${escapeHtml(method.cannotProve)}</p></section>${bundleHtml ? `<section class="research-block"><h4>Where this measurement sits in a decision</h4><div class="bundle-grid">${bundleHtml}</div></section>` : ""}${comparisonHtml}<section class="research-block two-columns"><div><h4>Better practice</h4><ol>${method.bestPractice.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div><div><h4>Common failure modes</h4><ol>${method.commonPitfalls.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div></section>${decisionProfileHtml(method)}${sourceRoutesHtml(method)}${capabilityHtml(method)}${datasetReviewHtml()}<div class="research-actions"><a href="${safeUrl(method.source)}" target="_blank" rel="noreferrer">Method source ↗</a></div>`;
  $("#methodDialog").showModal();
}

const networkPositions = { "iron-homeostasis":[12,23], "pufa-remodelling":[37,8], "lipid-peroxidation":[50,38], "gpx4-gsh":[78,12], "fsp1-coq":[88,38], "organelle-spatial":[23,56], "death-execution":[53,70], "tumour-ecology":[78,65], "tissue-injury":[34,90], "translation":[82,90] };
function renderNetwork() {
  const mechanisms = state.network?.mechanisms || [], edges = state.network?.mechanismEdges || [];
  const lines = edges.map((edge) => { const a = networkPositions[edge.source], b = networkPositions[edge.target]; if (!a || !b) return ""; const active = edge.source === state.selectedMechanism || edge.target === state.selectedMechanism; return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${active ? "active" : ""}" />`; }).join("");
  $("#networkMap").innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${mechanisms.map((node) => { const position = networkPositions[node.id]; if (!position) return ""; const [x,y] = position; return `<button type="button" role="listitem" data-mechanism-id="${escapeHtml(node.id)}" aria-pressed="${node.id === state.selectedMechanism}" class="network-node ${node.id === state.selectedMechanism ? "active" : ""}" style="left:${x}%;top:${y}%"><b>${escapeHtml(node.short)}</b><span>${escapeHtml(node.label)}</span></button>`; }).join("")}`;
  $$(".network-node").forEach((button) => button.addEventListener("click", () => { state.selectedMechanism = button.dataset.mechanismId; renderNetwork(); }));
  renderNetworkDetail();
}

export function renderNetworkDetail() {
  const node = state.network.mechanisms.find((item) => item.id === state.selectedMechanism); if (!node) return;
  const edges = state.network.mechanismEdges.filter((edge) => edge.source === node.id || edge.target === node.id);
  const methodIds = state.network.methodLinks.filter((link) => link.mechanisms.includes(node.id)).map((link) => link.method);
  const methods = state.methods.filter((method) => methodIds.includes(method.id));
  const labIds = [...new Set(methods.flatMap((method) => method.distinctiveLabs))];
  const labs = labIds.map((id) => state.labs.find((lab) => lab.id === id)).filter(Boolean).slice(0,8);
  // Evidence for a mechanism is shown as the individual paper claims that produced it,
  // with the figure, the conditions and the confidence attached. A supporting claim and
  // a claim that cannot separate two explanations are never averaged into one arrow.
  const mechanismNode = `mechanism:${node.id}`;
  const claimGroups = [
    ["Supports, within these conditions", "SUPPORTS_IN_CONTEXT"],
    ["Replicates in another setting", "REPLICATES"],
    ["Contradicts", "CONTRADICTS"],
    ["Cannot separate this from an alternative", "CANNOT_DISTINGUISH"],
  ];
  const paperEdges = (state.graph?.edges || []).filter((edge) => edge.to === mechanismNode && edge.paperId);
  const paperTitle = (paperId) => state.papers.find((paper) => paper.id === paperId)?.title || paperId;
  const claimHtml = claimGroups.map(([heading, relation]) => {
    const group = paperEdges.filter((edge) => edge.relation === relation);
    if (!group.length) return "";
    return `<section class="claim-group"><span>${escapeHtml(heading)}</span>${group.map((edge) => `<article class="claim-row"><button type="button" class="paper-open" data-paper-id="${escapeHtml(edge.paperId)}">${escapeHtml(paperTitle(edge.paperId))}</button><small>${escapeHtml(edge.figure || "figure not recorded")} · ${escapeHtml(edge.confidence)} · ${escapeHtml(edge.verificationDepth)}</small><p>${escapeHtml(edge.claimScope)}</p><small class="claim-conditions">${escapeHtml(Object.entries(edge.conditionVector || {}).map(([key, value]) => `${key}: ${value}`).join(" · ") || "conditions not recorded")}</small></article>`).join("")}</section>`;
  }).join("");
  // A curated assay-class boundary and a claim read out of an audited figure are different
  // kinds of statement. The boundary list therefore says, per entry, whether its declared
  // source has been read — it must not inherit the confidence of the paper claims above it.
  const boundaryEdges = (state.graph?.edges || []).filter((edge) => edge.relation === "CANNOT_DISTINGUISH" && edge.to === mechanismNode && edge.provenanceClass === "curated-method-module");
  const boundaryItems = [...new Map(boundaryEdges.map((edge) => [edge.claimScope, edge])).values()];
  const provisionalBoundaries = boundaryItems.filter((edge) => !isSourceChecked(edge.reviewState)).length;
  $("#networkDetail").innerHTML = `<p class="eyebrow">SELECTED MECHANISM</p><h3>${escapeHtml(node.label)}</h3><p>${escapeHtml(node.description)}</p><div class="network-relations">${edges.map((edge) => { const otherId = edge.source === node.id ? edge.target : edge.source; const other = state.network.mechanisms.find((item) => item.id === otherId); return `<section><span>${escapeHtml(edge.relation)}</span><b>${escapeHtml(other?.label || otherId)}</b><p>${escapeHtml(edge.label)}</p><small>${escapeHtml(edge.confidence)}</small></section>`; }).join("")}</div><h4>Paper-level evidence for this node</h4><div class="claim-groups">${claimHtml || '<p class="research-pending">No source-checked paper claim has been recorded against this node yet.</p>'}</div><h4>Methods that interrogate this node</h4><div class="research-chips">${methods.map((method) => `<span>${escapeHtml(method.name)}</span>`).join("")}</div>${boundaryItems.length ? `<div class="assay-boundaries"><span>What these assays cannot establish alone</span>${provisionalBoundaries ? `<p class="provisional-note">${provisionalBoundaries} of ${boundaryItems.length} of these boundaries are curated method-module statements whose declared source has not been read and dated. They are not paper claims and are shown as provisional.</p>` : ""}<ul>${boundaryItems.map((edge) => `<li>${escapeHtml(edge.claimScope)}${isSourceChecked(edge.reviewState) ? `<small class="edge-review">method source checked ${escapeHtml(edge.checkedAt || "")}</small>` : '<small class="edge-review pending">curated method module · awaiting source review</small>'}</li>`).join("")}</ul></div>` : ""}<h4>Laboratories connected through those methods</h4><div class="network-labs">${labs.map((lab) => `<button type="button" data-network-lab="${escapeHtml(lab.id)}">${escapeHtml(lab.pi)}</button>`).join("")}</div>`;
  $$("[data-network-lab]").forEach((button) => button.addEventListener("click", () => renderResearchProfile(button.dataset.networkLab)));
}

function renderGlossary() {
  const term = state.glossarySearch.trim().toLowerCase();
  const filtered = state.glossary.filter((item) => !term || [item.term, item.abbreviation, item.simpleEnglish, item.precisionNote, ...Object.values(item.aliases || {}).flat()].join(" ").toLowerCase().includes(term));
  const visible = filtered.slice(0, term ? filtered.length : state.visibleGlossary);
  $("#glossaryGrid").innerHTML = visible.length ? visible.map((item) => `<article class="glossary-card"><div class="glossary-term"><span>${escapeHtml(item.abbreviation || "TERM")}</span><h3>${escapeHtml(item.term)}</h3></div><p>${escapeHtml(item.simpleEnglish)}</p><div class="translations"><span><b>中文</b>${escapeHtml((item.aliases?.zh || []).join(" · "))}</span><span><b>日本語</b>${escapeHtml((item.aliases?.ja || []).join(" · "))}</span></div><div class="precision-note"><b>Precision note</b>${escapeHtml(item.precisionNote)}</div></article>`).join("") : '<div class="empty">No terminology entry matches this search.</div>';
  $("#loadMoreGlossary").hidden = Boolean(term) || visible.length >= filtered.length;
}

function renderResourceTypes() {
  const types = ["All", ...new Set(state.resources.map((item) => item.type))];
  $("#resourceTypes").innerHTML = types.map((type) => `<button type="button" data-resource-type="${escapeHtml(type)}" aria-pressed="${type === state.resourceType}" class="${type === state.resourceType ? "active" : ""}">${escapeHtml(type)}</button>`).join("");
  $$("#resourceTypes button").forEach((button) => button.addEventListener("click", () => { state.resourceType = button.dataset.resourceType; renderResourceTypes(); renderResources(); }));
}

function renderResources() {
  const resources = state.resources.filter((item) => state.resourceType === "All" || item.type === state.resourceType);
  $("#resourceGrid").innerHTML = resources.map((item) => `<article class="resource-card"><div class="resource-top"><span>${escapeHtml(item.type)}</span><b>${escapeHtml(item.authority)}</b></div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><div class="resource-caution"><b>Use boundary</b>${escapeHtml(item.caution)}</div><div class="resource-bottom"><span>${escapeHtml(item.language)} · checked ${escapeHtml(item.checkedAt)}</span><a href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">Open resource ↗</a></div></article>`).join("");
}

function renderFreshness() {
  const updated = state.meta?.generatedAt; $("#topUpdated").textContent = updated ? timeAgo(updated) : "offline data"; $("#footerUpdated").textContent = `Last aggregation: ${updated ? formatDate(updated) : "unknown"}`;
  $("#labCount").textContent = state.labs.length; $("#methodCount").textContent = state.methods.length; $("#trialCount").textContent = state.meta?.counts?.clinicalTrials ?? state.signals.filter((item) => item.sourceType === "trial").length;
  if (state.researchCounts) { $("#researchCoverage").textContent = `${state.researchCounts.audited} laboratory archives audited; ${state.researchCounts.figureAuditedStudies}/${state.researchCounts.studies} unique representative papers carry a figure chain in the legacy archive, which is the source the English records were rewritten from; ${state.researchCounts.studyRecords} lab–paper relationship records.`; $("#longitudinalLabCount").textContent = `${state.researchCounts.audited} lab syntheses`; }
  const figureChains = state.papers.filter((paper) => paper.readingDepth === "figure-chain").length;
  // Anything at figures-and-legends depth or deeper had a reviewer open the paper this round;
  // an archive-derived record did not, however recently its metadata was re-queried.
  const reReadDepths = new Set(["figures-legends-checked", "methods-checked", "supplement-checked", "full-text-rechecked", "raw-data-rechecked"]);
  const fullTextRechecked = state.papers.filter((paper) => reReadDepths.has(paper.verificationDepth)).length;
  $("#paperCount").textContent = state.papers.length;
  $("#quickStudyCount").textContent = `${state.papers.length} papers published in English${state.researchCounts ? ` of ${state.researchCounts.studies} indexed` : ""}`;
  $("#figureStudyCount").textContent = `${figureChains} archive-derived figure chains; ${fullTextRechecked} re-opened at figures/legends or deeper from a primary source`;
  $("#monitoringCoverage").textContent = coverageSummary();
  $("#freshnessList").innerHTML = (state.meta?.sources || []).map((row) => {
    const state_ = row.state || (row.ok ? "ok" : "failed");
    const attempted = row.lastAttemptAt || row.updatedAt;
    const detail = state_ === "degraded"
      ? `retained ${Number(row.retainedItems || 0)} stale records · last success ${timeAgo(row.lastSuccessAt)}`
      : state_ === "failed"
        ? `no usable retained data · last success ${timeAgo(row.lastSuccessAt)}`
        : `last attempt ${timeAgo(attempted)}`;
    return `<div class="freshness-row ${escapeHtml(state_)}"><b>${escapeHtml(row.name)}</b><span>${escapeHtml(state_)} · ${escapeHtml(detail)}</span><small>${escapeHtml(plain(row.note, "No status note was recorded for this source."))}</small></div>`;
  }).join("") || '<div class="empty">No update record is available.</div>';
}

function bindEvents() {
  $$("#sourceFilters button").forEach((button) => button.addEventListener("click", () => { state.source = button.dataset.source; state.visibleSignals = 8; $$("#sourceFilters button").forEach((item) => { item.classList.toggle("active", item === button); item.setAttribute?.("aria-pressed", String(item === button)); }); renderSignals(); }));
  $("#topicFilter").addEventListener("change", (event) => { state.topic = event.target.value; state.visibleSignals = 8; renderSignals(); });
  $("#documentFilter").addEventListener("change", (event) => { state.documentClass = event.target.value; state.visibleSignals = 8; renderSignals(); });
  $("#signalSort").addEventListener("change", (event) => { state.signalSort = event.target.value; renderSignals(); });
  $("#loadMoreSignals").addEventListener("click", () => { state.visibleSignals += 8; renderSignals(); });
  $("#labSearch").addEventListener("input", (event) => { state.labSearch = event.target.value; renderLabs(); });
  $("#labGrid").addEventListener("click", (event) => { const button = event.target.closest(".research-open"); if (button) renderResearchProfile(button.dataset.labId); });
  $("#paperSearch").addEventListener("input", (event) => { state.paperSearch = event.target.value; renderPapers(); });
  $("#paperGrid").addEventListener("click", (event) => { const button = event.target.closest(".paper-open"); if (button) renderPaperDetail(button.dataset.paperId); });
  $("#labResearchContent").addEventListener("click", (event) => { const button = event.target.closest(".paper-open"); if (button) { $("#labResearchDialog").close(); renderPaperDetail(button.dataset.paperId); } });
  $("#networkDetail").addEventListener("click", (event) => { const button = event.target.closest(".paper-open"); if (button) renderPaperDetail(button.dataset.paperId); });
  $("#methodSearch").addEventListener("input", (event) => { state.methodSearch = event.target.value; renderMethods(); });
  $("#methodGrid").addEventListener("click", (event) => { const button = event.target.closest(".method-open"); if (button) renderMethodDetail(button.dataset.methodId); });
  $("#glossarySearch").addEventListener("input", (event) => { state.glossarySearch = event.target.value; renderGlossary(); });
  $("#loadMoreGlossary").addEventListener("click", () => { state.visibleGlossary = state.glossary.length; renderGlossary(); });
  $("#freshnessButton").addEventListener("click", () => $("#freshnessDialog").showModal());
  for (const dialog of $$("dialog")) { dialog.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close()); dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }); }
}

async function init() {
  const [rawLabs, englishLabs, curated, live, meta, watchQueries, research, methods, glossary, network, resources, briefs, papers, paperLinks, recordOverlays, coverage, claims, bundles, manifest] = await Promise.all([
    readJson("data/labs.json", []), readJson("data/labs-en.json", []), readJson("data/intelligence-curated.json", []), readJson("data/live.json", []), readJson("data/meta.json", null), readJson("data/watch-queries.json", []), readJson("data/lab-research.json", { profiles: [], counts: null }), readJson("data/methods.json", []), readJson("data/glossary.json", []), readJson("data/knowledge-network.json", { mechanisms: [], mechanismEdges: [], methodLinks: [] }), readJson("data/resources.json", []), readJson("data/signal-briefs-en.json", []), readJson("data/papers-en.json", []), readJson("data/lab-paper-links.json", []), readJson("data/record-overlays.json", []), readJson("data/monitoring-coverage.json", { labs: [] }), readJson("data/paper-claims.json", { contexts: [], perturbations: [], claims: [] }), readJson("data/evidence-bundles.json", { bundles: [], neverStandalone: [] }), readJson("data/schema-versions.json", { files: {} })
  ]);
  const overlays = new Map(englishLabs.map((item) => [item.id, item]));
  state.labs = rawLabs.map((lab) => ({ ...lab, ...(overlays.get(lab.id) || {}) })).filter((lab) => overlays.has(lab.id));
  state.methods = methods; state.glossary = glossary; state.network = network; state.resources = resources; state.meta = meta;
  state.researchProfiles = new Map(research.profiles.map((profile) => [profile.labId, profile])); state.researchCounts = research.counts; state.watchedLabIds = new Set(watchQueries.map((item) => item.labId));
  state.coverage = coverage; state.coverageByLab = new Map((coverage.labs || []).map((row) => [row.labId, row])); state.bundles = bundles; state.manifest = manifest;
  state.recordOverlays = new Map(recordOverlays.map((row) => [row.canonicalId, row]));
  state.papers = papers; state.paperLinks = paperLinks;
  state.papersByDoi = new Map(papers.map((paper) => [paper.doi.toLowerCase(), paper]));
  state.papersByCanonicalId = new Map(papers.map((paper) => [canonicalIdentity(paper).canonicalId, paper]));
  state.linksByPaper = paperLinks.reduce((map, link) => map.set(link.paperId, [...(map.get(link.paperId) || []), link]), new Map());
  // The graph is derived here rather than shipped as a generated file, so it can never
  // describe a version of the records that is no longer on disk. A malformed input is
  // surfaced in the console and leaves the rest of the interface working.
  try {
    state.graph = buildGraph({ papers, labs: rawLabs, labsEn: englishLabs, links: paperLinks, methods, network, claims });
  } catch (error) {
    console.error("The provenance graph could not be built", error);
    state.graph = null;
  }
  const labMap = new Map(state.labs.map((lab) => [lab.id, lab])), briefMap = new Map(briefs.map((item) => [item.id, item]));
  // Curated and automated records for the same DOI, PMID or NCT identifier collapse onto
  // one canonical record before rendering, so a study registered in two layers appears
  // once and keeps both the curated card and the automated laboratory match.
  state.signals = mergeSignalLayers([
    ...curated.map((item) => ({ ...item, reviewStatus: "curated" })),
    ...live.map((item) => ({ ...item, reviewStatus: "automated" })),
  ]).map((item) => normalizeSignal(item, briefMap, labMap));
  renderFrontiers(); renderTopicOptions(); renderDocumentOptions(); renderSignals(); renderPaperThemes(); renderPapers(); renderMethodGroups(); renderMethods(); renderNetwork(); renderLabCategories(); renderLabs(); renderGlossary(); renderResourceTypes(); renderResources(); renderFreshness(); bindEvents();
}

export const ready = init();
