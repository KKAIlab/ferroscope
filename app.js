export const state = {
  labs: [], methods: [], glossary: [], resources: [], signals: [], network: null, meta: null,
  researchProfiles: new Map(), researchCounts: null, watchedLabIds: new Set(),
  papers: [], paperLinks: [], papersByDoi: new Map(), linksByPaper: new Map(),
  source: "all", topic: "all", signalSort: "relevance", visibleSignals: 8,
  labCategory: "All", labSearch: "", methodGroup: "All", methodSearch: "",
  resourceType: "All", glossarySearch: "", visibleGlossary: 8, selectedMechanism: "lipid-peroxidation",
  paperTheme: "All", paperSearch: "",
};

const categoryLabels = { core: "Core mechanisms", methods: "Methods & chemistry", translational: "Disease & translation", adjacent: "Strategic adjacent fields" };
const sourceLabels = { paper: "Peer reviewed", preprint: "Preprint", trial: "Clinical record" };
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

function formatDate(date) {
  if (!date) return "Date unavailable";
  const value = new Date(date); if (Number.isNaN(value.getTime())) return escapeHtml(date);
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit" }).format(value);
}

function timeAgo(date) {
  if (!date) return "not updated";
  const hours = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 3_600_000));
  if (hours < 1) return "within 1 hour"; if (hours < 24) return `${hours} hours ago`; return `${Math.floor(hours / 24)} days ago`;
}

function normalizeTopics(topics = []) { return topics.map((topic) => topicMap[topic] || plain(topic, "ferroptosis")); }
function uniqueSignals(items) {
  const seen = new Set();
  return items.filter((item) => { const key = String(item.id || item.title || item.url).toLowerCase().replace(/[^a-z0-9]+/g, ""); if (!key || seen.has(key)) return false; seen.add(key); return true; });
}

function normalizeSignal(item, briefMap, labMap) {
  const brief = briefMap.get(item.id) || {};
  const labs = (item.trackedLabIds || []).map((id) => labMap.get(id)?.pi).filter(Boolean);
  const fallback = item.reviewStatus === "auto"
    ? (labs.length ? `Primary-source alert matched by the laboratory watch: ${labs.join(", ")}.` : "Automatically captured from a source index; open the primary record before interpretation.")
    : "Open the primary source and the evidence card before reusing this claim.";
  return {
    ...item,
    title: plain(item.title, "Untitled source record"),
    topics: brief.topics || normalizeTopics(item.topics),
    takeaway: brief.takeaway || plain(item.takeaway, fallback),
    caveat: brief.caveat || plain(item.caveat, ""),
    trackedLabs: labs,
  };
}

function meter(level, sourceType) {
  const value = evidenceOrder[level] || 1;
  return `<div class="meter ${sourceType === "preprint" ? "orange" : ""}">${[1,2,3,4].map((number) => `<i class="${number <= value ? "on" : ""}"></i>`).join("")}</div>`;
}

function renderFrontiers() {
  const items = state.signals.filter((item) => item.featured).sort((a,b) => (b.relevance || 0) - (a.relevance || 0)).slice(0,3);
  $("#frontierGrid").innerHTML = items.map((item, index) => `<a class="frontier-card" data-index="0${index + 1}" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer"><div class="frontier-top"><span class="tag">${escapeHtml(item.frontier || item.topics?.[0] || "FRONTIER")}</span><span class="date">${formatDate(item.date)}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.takeaway)}</p></a>`).join("");
}

function renderTopicOptions() {
  const topics = [...new Set(state.signals.flatMap((item) => item.topics || []))].sort((a,b) => a.localeCompare(b, "en"));
  $("#topicFilter").innerHTML = '<option value="all">All topics</option>' + topics.map((topic) => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join("");
}

function filteredSignals() {
  const items = state.signals.filter((item) => (state.source === "all" || item.sourceType === state.source) && (state.topic === "all" || item.topics?.includes(state.topic)));
  return items.sort((a,b) => state.signalSort === "date" ? new Date(b.date || 0) - new Date(a.date || 0) : state.signalSort === "evidence" ? (evidenceOrder[b.evidence] || 0) - (evidenceOrder[a.evidence] || 0) : (b.relevance || 0) - (a.relevance || 0) || new Date(b.date || 0) - new Date(a.date || 0));
}

function renderSignals() {
  const all = filteredSignals(), visible = all.slice(0, state.visibleSignals);
  $("#signalList").innerHTML = visible.length ? visible.map((item) => `<article class="signal-item"><div class="signal-source"><span class="source-badge ${escapeHtml(item.sourceType)}">${escapeHtml(sourceLabels[item.sourceType] || item.sourceType)}</span><span class="review-badge ${escapeHtml(item.reviewStatus)}">${item.reviewStatus === "curated" ? "curated" : "automated alert"}</span><time datetime="${escapeHtml(item.date || "")}">${formatDate(item.date)}</time></div><div class="signal-main"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.takeaway)}${item.caveat ? ` <span class="inline-caveat">Boundary: ${escapeHtml(item.caveat)}</span>` : ""}</p><div class="signal-tags">${(item.trackedLabs || []).slice(0,2).map((lab) => `<span class="chip lab-hit">LAB · ${escapeHtml(lab)}</span>`).join("")}${(item.topics || []).slice(0,4).map((topic) => `<span class="chip">${escapeHtml(topic)}</span>`).join("")}</div></div><div class="evidence"><span>Evidence level ${escapeHtml(item.evidence || "D")}</span>${meter(item.evidence, item.sourceType)}<b class="relevance">Research fit ${Number(item.relevance || 0)}/100</b></div><a class="signal-arrow" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer" aria-label="Open primary source">↗</a></article>`).join("") : '<div class="empty">No signals match the current filters.</div>';
  $("#loadMoreSignals").hidden = visible.length >= all.length;
}

function labMethods(labId) { return state.methods.filter((method) => method.distinctiveLabs?.includes(labId)); }
function renderLabCategories() {
  const categories = ["All", ...Object.values(categoryLabels)];
  $("#labCategories").innerHTML = categories.map((category) => `<button type="button" data-category="${escapeHtml(category)}" class="${category === state.labCategory ? "active" : ""}">${escapeHtml(category)}</button>`).join("");
  $$("#labCategories button").forEach((button) => button.addEventListener("click", () => { state.labCategory = button.dataset.category; renderLabCategories(); renderLabs(); }));
}

function renderLabs() {
  const term = state.labSearch.trim().toLowerCase();
  const labs = state.labs.filter((lab) => state.labCategory === "All" || categoryLabels[lab.category] === state.labCategory).filter((lab) => !term || [lab.pi, lab.institution, lab.region, lab.focus, lab.question, ...(lab.tags || []), ...(lab.aliases || []), ...labMethods(lab.id).map((method) => method.name)].join(" ").toLowerCase().includes(term)).sort((a,b) => (b.relevance || 0) - (a.relevance || 0));
  $("#labGrid").innerHTML = labs.length ? labs.map((lab, index) => { const profile = state.researchProfiles.get(lab.id); const audited = profile?.audit?.status !== "pending"; return `<article class="lab-card"><span class="lab-number">${String(index + 1).padStart(2,"0")} / ${String(labs.length).padStart(2,"0")}</span><span class="lab-class">${escapeHtml(categoryLabels[lab.category])}</span><span class="research-stage ${audited ? "audited" : "screened"}">${audited ? "evidence-audited archive" : "screened profile"}</span><h3>${escapeHtml(lab.pi)}</h3><div class="institution">${escapeHtml(lab.institution)}</div><p class="lab-question">${escapeHtml(lab.question || lab.focus)}</p><div class="lab-tags">${(lab.tags || []).slice(0,5).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div><div class="lab-bottom"><span class="region">${escapeHtml(lab.region)}</span><span class="watch-state ${state.watchedLabIds.has(lab.id) ? "on" : ""}">● ${state.watchedLabIds.has(lab.id) ? "author watch" : "site watch"}</span><button class="research-open" data-lab-id="${escapeHtml(lab.id)}" type="button">profile</button><a class="visit" href="${safeUrl(lab.website)}" target="_blank" rel="noreferrer">lab ↗</a></div></article>`; }).join("") : '<div class="empty">No laboratory matches this search.</div>';
}

export function renderResearchProfile(labId) {
  const lab = state.labs.find((item) => item.id === labId), profile = state.researchProfiles.get(labId); if (!lab) return;
  const methods = labMethods(labId); const studies = (profile?.majorStudies || []).map((study) => {
    const english = paperFor(study.url);
    const link = paperLabs(english?.id || "").find((entry) => entry.labId === labId);
    const status = english?.publicationStatus || study.publicationStatus || "status to verify";
    const released = english
      ? `<p class="study-released"><b>English reading record</b>Published at all three scales and re-checked against the DOI record on ${escapeHtml(english.verification?.checkedAt || "")}${link ? `. This laboratory is recorded as ${escapeHtml(roleLabels[link.role] || link.role)}.` : "."}</p><div class="study-actions"><button type="button" class="paper-open" data-paper-id="${escapeHtml(english.id)}">Open reading record ↗</button><a href="${safeUrl(study.url)}" target="_blank" rel="noreferrer">Open original paper ↗</a></div>`
      : `<p class="study-limit"><b>English release status</b>The source and audit metadata are retained. The interpretive text remains unpublished until English translation is checked against the paper.</p><a href="${safeUrl(study.url)}" target="_blank" rel="noreferrer">Open original paper ↗</a>`;
    return `<article class="research-study"><div class="reading-layer-label"><span>Scale 1 · 60-second paper card</span><small>${study.readingLevel === "figure-audited" ? "Scale 2 · Figure-level audit recorded" : "Evidence audit recorded"} · ${escapeHtml(status)}</small></div><div class="study-meta">${escapeHtml(study.journal)} · ${escapeHtml(study.year)}</div><h5>${escapeHtml(study.title)}</h5>${released}</article>`;
  }).join("");
  $("#labResearchContent").innerHTML = `<p class="eyebrow">GLOBAL LAB PROFILE · ENGLISH VERIFIED LAYER</p><h3>${escapeHtml(lab.pi)}</h3><p class="research-institution">${escapeHtml(lab.institution)} · ${escapeHtml(lab.region)}</p><p class="reading-layer-kicker">Scale 3 · longitudinal laboratory synthesis</p><section class="research-question"><span>Persistent question</span><strong>${escapeHtml(lab.question)}</strong><p>${escapeHtml(lab.focus)}</p></section><section class="research-block"><h4>Distinctive method capability</h4><div class="research-chips">${methods.length ? methods.map((method) => `<span>${escapeHtml(method.name)}</span>`).join("") : '<span>Capability mapping in progress</span>'}</div></section><section class="research-block"><h4>Representative source records · paper-level evidence</h4>${studies || '<p class="research-pending">No representative paper has passed the source-attribution gate yet.</p>'}</section><section class="research-block audit-block"><h4>Language and evidence control</h4><p class="audit-good">✓ English PI, institution, focus and question are published.</p><p class="audit-open">? Chinese/Japanese names are search aliases, not parallel narrative copies.</p><p class="audit-fix">↺ Legacy Chinese figure notes remain offline until source-checked English migration.</p></section><div class="research-actions"><a href="${safeUrl(lab.website)}" target="_blank" rel="noreferrer">Lab website ↗</a></div>`;
  $("#labResearchDialog").showModal();
}

const statusLabels = { "version-of-record": "version of record", corrected: "carries a registered correction", preprint: "preprint", accepted: "accepted manuscript", retracted: "retracted" };
const roleLabels = { lead: "lead laboratory", "co-lead": "co-lead laboratory", "method collaborator": "method collaborator", "conceptual collaborator": "conceptual collaborator", "pre-independence": "first-author work before independent appointment", "contributing-author": "contributing author, role unverified" };

function paperFor(url = "") { return state.papersByDoi.get(url.toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "").replace(/\/$/, "")); }
function paperLabs(paperId) { return (state.linksByPaper.get(paperId) || []).map((link) => ({ ...link, lab: state.labs.find((lab) => lab.id === link.labId) })).filter((entry) => entry.lab); }

function renderPaperThemes() {
  const themes = ["All", ...new Set(state.papers.map((paper) => paper.theme))];
  $("#paperThemes").innerHTML = themes.map((theme) => `<button type="button" data-paper-theme="${escapeHtml(theme)}" class="${theme === state.paperTheme ? "active" : ""}">${escapeHtml(theme)}</button>`).join("");
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
    return `<article class="paper-card"><div class="paper-top"><span>${escapeHtml(paper.journal)} · ${escapeHtml(String(paper.year))}</span><b class="paper-status ${paper.publicationStatus === "corrected" ? "flagged" : ""}">${escapeHtml(statusLabels[paper.publicationStatus] || paper.publicationStatus)}</b></div><h3>${escapeHtml(paper.title)}</h3><p>${escapeHtml(paper.sixtySecond.advance)}</p><div class="paper-tags">${paper.contested ? '<span class="chip contested">formally contested</span>' : ""}<span class="chip">${escapeHtml(paper.readingLevel === "figure-audited" ? "figure-level audit" : "evidence audit")}</span>${leads.slice(0, 2).map((entry) => `<span class="chip lab-hit">LAB · ${escapeHtml(entry.lab.pi)}</span>`).join("")}</div><div class="paper-bottom"><button type="button" class="paper-open" data-paper-id="${escapeHtml(paper.id)}">Open reading record ↗</button><a href="${safeUrl(paper.url)}" target="_blank" rel="noreferrer">Primary source ↗</a></div></article>`;
  }).join("") : '<div class="empty">No paper matches this filter.</div>';
}

export function renderPaperDetail(paperId) {
  const paper = state.papers.find((item) => item.id === paperId); if (!paper) return;
  const sixty = paper.sixtySecond, verification = paper.verification || {};
  const events = (paper.versionEvents || []).map((event) => `<li><b>${escapeHtml(event.type)}</b>${event.doi ? ` · <a href="${safeUrl(`https://doi.org/${event.doi}`)}" target="_blank" rel="noreferrer">${escapeHtml(event.doi)}</a>` : ""} · ${escapeHtml(event.date)} · affects ${escapeHtml(event.affects)}<span>${escapeHtml(event.note)}</span></li>`).join("");
  const figures = (paper.figureAudit || []).map((figure) => `<article class="figure-unit"><div class="figure-head"><b>${escapeHtml(figure.figure)}</b><small>${escapeHtml(figure.sourceScope)}</small></div><p class="figure-question">${escapeHtml(figure.question)}</p><dl><dt>Intervention</dt><dd>${escapeHtml(figure.intervention)}</dd><dt>Readout</dt><dd>${escapeHtml(figure.readout)}</dd><dt>Answer</dt><dd>${escapeHtml(figure.answer)}</dd></dl><p class="figure-boundary"><b>Cannot show</b>${escapeHtml(figure.boundary)}</p></article>`).join("");
  const attribution = paperLabs(paper.id).map((entry) => `<li><b>${escapeHtml(entry.lab.pi)}</b> · ${escapeHtml(roleLabels[entry.role] || entry.role)}<span>${escapeHtml(entry.roleBasis)}</span><span>${escapeHtml(entry.continuity)}</span></li>`).join("");
  $("#paperContent").innerHTML = `<p class="eyebrow">${escapeHtml(paper.journal)} · ${escapeHtml(String(paper.year))} · ${escapeHtml(statusLabels[paper.publicationStatus] || paper.publicationStatus)}${paper.contested ? " · FORMALLY CONTESTED" : ""}</p><h3>${escapeHtml(paper.title)}</h3><p class="paper-citation">${escapeHtml(paper.citation || "")} · ${escapeHtml(paper.doi)}</p>
<section class="research-block"><p class="reading-layer-kicker">Scale 1 · 60-second question card</p><div class="sixty-grid"><div><span>What was open</span><p>${escapeHtml(sixty.story)}</p></div><div><span>What this adds</span><p>${escapeHtml(sixty.advance)}</p></div><div><span>Evidence anchor</span><p>${escapeHtml(sixty.evidenceAnchor)}</p></div><div><span>Scope limit</span><p>${escapeHtml(sixty.scope)}</p></div><div><span>Still open</span><p>${escapeHtml(sixty.openQuestion)}</p></div></div></section>
<section class="research-block"><h4>Condition vector</h4><p class="condition-vector">${escapeHtml(paper.conditionVector)}</p></section>
${events ? `<section class="research-block"><h4>Version and correction history</h4><ul class="version-events">${events}</ul></section>` : ""}
<section class="research-block"><p class="reading-layer-kicker">Scale 2 · Figure-level causal audit</p><div class="figure-chain">${figures}</div></section>
<section class="research-block"><h4>Laboratory attribution</h4><ul class="attribution-list">${attribution || "<li>No attribution record.</li>"}</ul></section>
<section class="research-block audit-block"><h4>What was verified, and when</h4><p class="audit-good">✓ ${escapeHtml(verification.metadata || "")}</p><p class="audit-good">✓ ${escapeHtml(verification.claims || "")}</p><p class="audit-open">? ${escapeHtml(verification.figureLayer || "")}</p>${(verification.unresolved || []).map((item) => `<p class="audit-fix">↺ ${escapeHtml(item)}</p>`).join("")}</section>
<div class="research-actions"><a href="${safeUrl(paper.url)}" target="_blank" rel="noreferrer">Open the primary source ↗</a></div>`;
  $("#paperDialog").showModal();
}

function renderMethodGroups() {
  const groups = ["All", ...new Set(state.methods.map((method) => method.group))];
  $("#methodGroups").innerHTML = groups.map((group) => `<button type="button" data-group="${escapeHtml(group)}" class="${group === state.methodGroup ? "active" : ""}">${escapeHtml(group)}</button>`).join("");
  $$("#methodGroups button").forEach((button) => button.addEventListener("click", () => { state.methodGroup = button.dataset.group; renderMethodGroups(); renderMethods(); }));
}

function renderMethods() {
  const term = state.methodSearch.trim().toLowerCase();
  const methods = state.methods.filter((method) => state.methodGroup === "All" || method.group === state.methodGroup).filter((method) => !term || [method.name, method.group, method.evidenceRole, method.plainEnglish, method.measures, method.cannotProve, ...method.distinctiveLabs.map((id) => state.labs.find((lab) => lab.id === id)?.pi || "")].join(" ").toLowerCase().includes(term));
  $("#methodGrid").innerHTML = methods.length ? methods.map((method) => `<article class="method-card"><div class="method-top"><span>${escapeHtml(method.group)}</span><b>${escapeHtml(method.evidenceRole)}</b></div><h3>${escapeHtml(method.name)}</h3><p>${escapeHtml(method.plainEnglish)}</p><div class="method-boundary"><span>Cannot prove alone</span>${escapeHtml(method.cannotProve)}</div><div class="method-labs">${method.distinctiveLabs.slice(0,4).map((id) => state.labs.find((lab) => lab.id === id)?.pi).filter(Boolean).map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div><button type="button" class="method-open" data-method-id="${escapeHtml(method.id)}">Open evidence card ↗</button></article>`).join("") : '<div class="empty">No method matches this search.</div>';
}

export function renderMethodDetail(methodId) {
  const method = state.methods.find((item) => item.id === methodId); if (!method) return;
  $("#methodContent").innerHTML = `<p class="eyebrow">${escapeHtml(method.group)} · ${escapeHtml(method.evidenceRole)}</p><h3>${escapeHtml(method.name)}</h3><section class="research-question"><span>In simple English</span><strong>${escapeHtml(method.plainEnglish)}</strong><p><b>Measures:</b> ${escapeHtml(method.measures)}</p></section><section class="research-block"><h4>What it cannot prove alone</h4><p class="method-warning">${escapeHtml(method.cannotProve)}</p></section><section class="research-block two-columns"><div><h4>Better practice</h4><ol>${method.bestPractice.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div><div><h4>Common failure modes</h4><ol>${method.commonPitfalls.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div></section><section class="research-block"><h4>Laboratories with distinctive capability</h4><div class="research-chips">${method.distinctiveLabs.map((id) => state.labs.find((lab) => lab.id === id)?.pi).filter(Boolean).map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div></section><div class="research-actions"><a href="${safeUrl(method.source)}" target="_blank" rel="noreferrer">Method source ↗</a></div>`;
  $("#methodDialog").showModal();
}

const networkPositions = { "iron-homeostasis":[12,23], "pufa-remodelling":[37,8], "lipid-peroxidation":[50,38], "gpx4-gsh":[78,12], "fsp1-coq":[88,38], "organelle-spatial":[23,56], "death-execution":[53,70], "tumour-ecology":[78,65], "tissue-injury":[34,90], "translation":[82,90] };
function renderNetwork() {
  const mechanisms = state.network?.mechanisms || [], edges = state.network?.mechanismEdges || [];
  const lines = edges.map((edge) => { const a = networkPositions[edge.source], b = networkPositions[edge.target]; if (!a || !b) return ""; const active = edge.source === state.selectedMechanism || edge.target === state.selectedMechanism; return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${active ? "active" : ""}" />`; }).join("");
  $("#networkMap").innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${mechanisms.map((node) => { const [x,y] = networkPositions[node.id]; return `<button type="button" role="listitem" data-mechanism-id="${escapeHtml(node.id)}" class="network-node ${node.id === state.selectedMechanism ? "active" : ""}" style="left:${x}%;top:${y}%"><b>${escapeHtml(node.short)}</b><span>${escapeHtml(node.label)}</span></button>`; }).join("")}`;
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
  $("#networkDetail").innerHTML = `<p class="eyebrow">SELECTED MECHANISM</p><h3>${escapeHtml(node.label)}</h3><p>${escapeHtml(node.description)}</p><div class="network-relations">${edges.map((edge) => { const otherId = edge.source === node.id ? edge.target : edge.source; const other = state.network.mechanisms.find((item) => item.id === otherId); return `<section><span>${escapeHtml(edge.relation)}</span><b>${escapeHtml(other?.label || otherId)}</b><p>${escapeHtml(edge.label)}</p><small>${escapeHtml(edge.confidence)}</small></section>`; }).join("")}</div><h4>Methods that interrogate this node</h4><div class="research-chips">${methods.map((method) => `<span>${escapeHtml(method.name)}</span>`).join("")}</div><h4>Laboratories connected through those methods</h4><div class="network-labs">${labs.map((lab) => `<button type="button" data-network-lab="${escapeHtml(lab.id)}">${escapeHtml(lab.pi)}</button>`).join("")}</div>`;
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
  $("#resourceTypes").innerHTML = types.map((type) => `<button type="button" data-resource-type="${escapeHtml(type)}" class="${type === state.resourceType ? "active" : ""}">${escapeHtml(type)}</button>`).join("");
  $$("#resourceTypes button").forEach((button) => button.addEventListener("click", () => { state.resourceType = button.dataset.resourceType; renderResourceTypes(); renderResources(); }));
}

function renderResources() {
  const resources = state.resources.filter((item) => state.resourceType === "All" || item.type === state.resourceType);
  $("#resourceGrid").innerHTML = resources.map((item) => `<article class="resource-card"><div class="resource-top"><span>${escapeHtml(item.type)}</span><b>${escapeHtml(item.authority)}</b></div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><div class="resource-caution"><b>Use boundary</b>${escapeHtml(item.caution)}</div><div class="resource-bottom"><span>${escapeHtml(item.language)} · checked ${escapeHtml(item.checkedAt)}</span><a href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">Open resource ↗</a></div></article>`).join("");
}

function renderFreshness() {
  const updated = state.meta?.generatedAt; $("#topUpdated").textContent = updated ? timeAgo(updated) : "offline data"; $("#footerUpdated").textContent = `Last aggregation: ${updated ? formatDate(updated) : "unknown"}`;
  $("#labCount").textContent = state.labs.length; $("#methodCount").textContent = state.methods.length; $("#trialCount").textContent = state.meta?.counts?.clinicalTrials ?? state.signals.filter((item) => item.sourceType === "trial").length;
  if (state.researchCounts) { $("#researchCoverage").textContent = `${state.researchCounts.audited} lab archives audited; ${state.researchCounts.figureAuditedStudies}/${state.researchCounts.studies} unique representative papers reached figure-level audit; ${state.researchCounts.studyRecords} lab–paper relationship records.`; $("#longitudinalLabCount").textContent = `${state.researchCounts.audited} lab syntheses`; }
  const englishFigureAudits = state.papers.filter((paper) => paper.readingLevel === "figure-audited").length;
  $("#paperCount").textContent = state.papers.length;
  $("#quickStudyCount").textContent = `${state.papers.length} papers published in English${state.researchCounts ? ` of ${state.researchCounts.studies} indexed` : ""}`;
  $("#figureStudyCount").textContent = `${englishFigureAudits} English figure-level audits`;
  $("#freshnessList").innerHTML = (state.meta?.sources || []).map((row) => `<div class="freshness-row"><b>${escapeHtml(row.name)}</b><span>${row.ok ? "success" : "failed"} · ${timeAgo(row.updatedAt)}</span><small>${escapeHtml(plain(row.note, row.ok ? "The latest scheduled source fetch completed." : "The source update reported an error; inspect the refresh workflow."))}</small></div>`).join("") || '<div class="empty">No update record is available.</div>';
}

function bindEvents() {
  $$("#sourceFilters button").forEach((button) => button.addEventListener("click", () => { state.source = button.dataset.source; state.visibleSignals = 8; $$("#sourceFilters button").forEach((item) => item.classList.toggle("active", item === button)); renderSignals(); }));
  $("#topicFilter").addEventListener("change", (event) => { state.topic = event.target.value; state.visibleSignals = 8; renderSignals(); });
  $("#signalSort").addEventListener("change", (event) => { state.signalSort = event.target.value; renderSignals(); });
  $("#loadMoreSignals").addEventListener("click", () => { state.visibleSignals += 8; renderSignals(); });
  $("#labSearch").addEventListener("input", (event) => { state.labSearch = event.target.value; renderLabs(); });
  $("#labGrid").addEventListener("click", (event) => { const button = event.target.closest(".research-open"); if (button) renderResearchProfile(button.dataset.labId); });
  $("#paperSearch").addEventListener("input", (event) => { state.paperSearch = event.target.value; renderPapers(); });
  $("#paperGrid").addEventListener("click", (event) => { const button = event.target.closest(".paper-open"); if (button) renderPaperDetail(button.dataset.paperId); });
  $("#labResearchContent").addEventListener("click", (event) => { const button = event.target.closest(".paper-open"); if (button) { $("#labResearchDialog").close(); renderPaperDetail(button.dataset.paperId); } });
  $("#methodSearch").addEventListener("input", (event) => { state.methodSearch = event.target.value; renderMethods(); });
  $("#methodGrid").addEventListener("click", (event) => { const button = event.target.closest(".method-open"); if (button) renderMethodDetail(button.dataset.methodId); });
  $("#glossarySearch").addEventListener("input", (event) => { state.glossarySearch = event.target.value; renderGlossary(); });
  $("#loadMoreGlossary").addEventListener("click", () => { state.visibleGlossary = state.glossary.length; renderGlossary(); });
  $("#freshnessButton").addEventListener("click", () => $("#freshnessDialog").showModal());
  for (const dialog of $$("dialog")) { dialog.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close()); dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }); }
}

async function init() {
  const [rawLabs, englishLabs, curated, live, meta, watchQueries, research, methods, glossary, network, resources, briefs, papers, paperLinks] = await Promise.all([
    readJson("data/labs.json", []), readJson("data/labs-en.json", []), readJson("data/intelligence-curated.json", []), readJson("data/live.json", []), readJson("data/meta.json", null), readJson("data/watch-queries.json", []), readJson("data/lab-research.json", { profiles: [], counts: null }), readJson("data/methods.json", []), readJson("data/glossary.json", []), readJson("data/knowledge-network.json", { mechanisms: [], mechanismEdges: [], methodLinks: [] }), readJson("data/resources.json", []), readJson("data/signal-briefs-en.json", []), readJson("data/papers-en.json", []), readJson("data/lab-paper-links.json", [])
  ]);
  const overlays = new Map(englishLabs.map((item) => [item.id, item]));
  state.labs = rawLabs.map((lab) => ({ ...lab, ...(overlays.get(lab.id) || {}) })).filter((lab) => overlays.has(lab.id));
  state.methods = methods; state.glossary = glossary; state.network = network; state.resources = resources; state.meta = meta;
  state.researchProfiles = new Map(research.profiles.map((profile) => [profile.labId, profile])); state.researchCounts = research.counts; state.watchedLabIds = new Set(watchQueries.map((item) => item.labId));
  state.papers = papers; state.paperLinks = paperLinks;
  state.papersByDoi = new Map(papers.map((paper) => [paper.doi.toLowerCase(), paper]));
  state.linksByPaper = paperLinks.reduce((map, link) => map.set(link.paperId, [...(map.get(link.paperId) || []), link]), new Map());
  const labMap = new Map(state.labs.map((lab) => [lab.id, lab])), briefMap = new Map(briefs.map((item) => [item.id, item]));
  state.signals = uniqueSignals([...curated.map((item) => ({ ...item, reviewStatus: "curated" })), ...live.map((item) => ({ ...item, reviewStatus: "auto" }))]).map((item) => normalizeSignal(item, briefMap, labMap));
  renderFrontiers(); renderTopicOptions(); renderSignals(); renderPaperThemes(); renderPapers(); renderMethodGroups(); renderMethods(); renderNetwork(); renderLabCategories(); renderLabs(); renderGlossary(); renderResourceTypes(); renderResources(); renderFreshness(); bindEvents();
}

export const ready = init();
