const state = {
  labs: [],
  signals: [],
  meta: null,
  source: "all",
  topic: "all",
  signalSort: "relevance",
  labCategory: "全部",
  labSearch: "",
  visibleSignals: 8,
  watchedLabIds: new Set(),
  researchProfiles: new Map(),
  researchCounts: null,
};

const categoryLabels = {
  core: "核心机制",
  methods: "技术与化学",
  translational: "疾病与转化",
  adjacent: "相邻战略方向",
};

const sourceLabels = { paper: "同行评议", preprint: "预印本", trial: "临床试验" };
const evidenceOrder = { A: 4, B: 3, C: 2, D: 1 };

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function readJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error(`读取 ${path} 失败`, error);
    return fallback;
  }
}

function uniqueSignals(items) {
  const seen = new Set();
  return items.filter((item) => {
    const value = (item.title || item.titleZh || item.id || item.url).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function formatDate(date) {
  if (!date) return "日期未知";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
}

function timeAgo(date) {
  if (!date) return "未更新";
  const diffHours = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 3_600_000));
  if (diffHours < 1) return "1 小时内";
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${Math.floor(diffHours / 24)} 天前`;
}

function renderFrontiers() {
  const frontiers = state.signals
    .filter((item) => item.featured)
    .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
    .slice(0, 3);
  $("#frontierGrid").innerHTML = frontiers.map((item, index) => `
    <a class="frontier-card" data-index="0${index + 1}" href="${item.url}" target="_blank" rel="noreferrer">
      <div class="frontier-top"><span class="tag">${item.frontier || item.topics?.[0] || "FRONTIER"}</span><span class="date">${formatDate(item.date)}</span></div>
      <h3>${item.titleZh || item.title}</h3>
      <p>${item.takeaway || item.title}</p>
    </a>
  `).join("");
}

function renderTopicOptions() {
  const topics = [...new Set(state.signals.flatMap((item) => item.topics || []))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  $("#topicFilter").innerHTML = '<option value="all">全部主题</option>' + topics.map((topic) => `<option value="${topic}">${topic}</option>`).join("");
}

function sortedFilteredSignals() {
  const filtered = state.signals.filter((item) => {
    const sourcePass = state.source === "all" || item.sourceType === state.source;
    const topicPass = state.topic === "all" || item.topics?.includes(state.topic);
    return sourcePass && topicPass;
  });
  return filtered.sort((a, b) => {
    if (state.signalSort === "date") return new Date(b.date || 0) - new Date(a.date || 0);
    if (state.signalSort === "evidence") return (evidenceOrder[b.evidence] || 0) - (evidenceOrder[a.evidence] || 0);
    return (b.relevance || 0) - (a.relevance || 0) || new Date(b.date || 0) - new Date(a.date || 0);
  });
}

function meter(level, sourceType) {
  const value = evidenceOrder[level] || 1;
  return `<div class="meter ${sourceType === "preprint" ? "orange" : ""}">${[1,2,3,4].map((n) => `<i class="${n <= value ? "on" : ""}"></i>`).join("")}</div>`;
}

function renderSignals() {
  const filtered = sortedFilteredSignals();
  const visible = filtered.slice(0, state.visibleSignals);
  $("#signalList").innerHTML = visible.length ? visible.map((item) => `
    <article class="signal-item">
      <div class="signal-source">
        <span class="source-badge ${item.sourceType}">${sourceLabels[item.sourceType] || item.sourceType}</span>
        <span class="review-badge ${item.reviewStatus}">${item.reviewStatus === "curated" ? "人工精选" : "自动捕获"}</span>
        <time datetime="${item.date || ""}">${formatDate(item.date)}</time>
      </div>
      <div class="signal-main">
        <h3>${item.titleZh || item.title}</h3>
        <p>${item.takeaway || item.title}${item.caveat ? ` · 注意：${item.caveat}` : ""}</p>
        <div class="signal-tags">${(item.trackedLabs || []).slice(0, 2).map((lab) => `<span class="chip lab-hit">LAB · ${lab}</span>`).join("")}${(item.topics || []).slice(0, 4).map((topic) => `<span class="chip">${topic}</span>`).join("")}</div>
      </div>
      <div class="evidence">
        <span>证据等级 ${item.evidence || "D"}</span>
        ${meter(item.evidence, item.sourceType)}
        <b class="relevance">相关度 ${item.relevance || 0}/100</b>
      </div>
      <a class="signal-arrow" href="${item.url}" target="_blank" rel="noreferrer" aria-label="打开一手来源">↗</a>
    </article>
  `).join("") : '<div class="empty">当前筛选没有结果。请切换来源或主题。</div>';
  $("#loadMoreSignals").hidden = visible.length >= filtered.length;
}

function renderLabCategories() {
  const categories = ["全部", ...Object.values(categoryLabels)];
  $("#labCategories").innerHTML = categories.map((category) => `<button type="button" data-category="${category}" class="${category === state.labCategory ? "active" : ""}">${category}</button>`).join("");
  $$("#labCategories button").forEach((button) => button.addEventListener("click", () => {
    state.labCategory = button.dataset.category;
    renderLabCategories();
    renderLabs();
  }));
}

function renderLabs() {
  const term = state.labSearch.trim().toLowerCase();
  const labs = state.labs
    .filter((lab) => state.labCategory === "全部" || categoryLabels[lab.category] === state.labCategory)
    .filter((lab) => {
      const profile = state.researchProfiles.get(lab.id);
      return !term || [lab.pi, lab.institution, lab.region, lab.focus, ...(lab.tags || []), profile?.question, ...(profile?.capabilities || [])].join(" ").toLowerCase().includes(term);
    })
    .sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

  $("#labGrid").innerHTML = labs.length ? labs.map((lab, index) => {
    const profile = state.researchProfiles.get(lab.id);
    const audited = profile?.audit?.status !== "pending";
    const stage = audited
      ? `${profile.audit.score >= 85 ? "档案审计通过" : "档案审计有条件通过"} · ${profile.audit.score}/100`
      : "60 秒初筛";
    return `
    <article class="lab-card">
      <span class="lab-number">${String(index + 1).padStart(2, "0")} / ${String(labs.length).padStart(2, "0")}</span>
      <span class="lab-class">${categoryLabels[lab.category]}</span>
      <span class="research-stage ${audited ? "audited" : "screened"}">${stage}</span>
      <h3>${lab.pi}</h3>
      <div class="institution">${lab.institution}</div>
      <p class="lab-question">${profile?.question || lab.focus}</p>
      <div class="lab-tags">${(lab.tags || []).slice(0, 5).map((tag) => `<span>${tag}</span>`).join("")}</div>
      <div class="lab-bottom"><span class="region">${lab.region}</span><span class="watch-state ${state.watchedLabIds.has(lab.id) ? "on" : ""}">● ${state.watchedLabIds.has(lab.id) ? "定向监控" : "官网观察"}</span><button class="research-open" data-lab-id="${lab.id}" type="button">研究档案</button><a class="visit" href="${lab.website}" target="_blank" rel="noreferrer">官网 ↗</a></div>
    </article>
  `; }).join("") : '<div class="empty">没有找到匹配团队。</div>';
}

function renderResearchProfile(labId) {
  const lab = state.labs.find((item) => item.id === labId);
  const profile = state.researchProfiles.get(labId);
  if (!lab || !profile) return;
  const audited = profile.audit.status !== "pending";
  const status = audited
    ? `${profile.audit.score >= 85 ? "档案审计通过" : "档案审计有条件通过"} · ${profile.audit.score}/100`
    : "60 秒问题初筛 · 尚未逐篇审计";
  const studies = profile.majorStudies?.length
    ? profile.majorStudies.map((study) => {
      const readingLabel = study.readingLevel === "figure-audited" ? "逐图机制精读" : "证据精读";
      const versionLabel = {
        "version-of-record": "正式版本",
        accepted: "已接收",
        preprint: "预印本",
        corrected: "已更正版本",
      }[study.publicationStatus] || "版本待核对";
      const deepDive = study.deepDive ? `
        <details class="deep-dive">
          <summary>维度 2 · 展开逐图机制链 · ${study.deepDive.figureChain.length} 个证据单元</summary>
          <p><b>中心假说</b>${study.deepDive.centralHypothesis}</p>
          <div class="figure-chain">${study.deepDive.figureChain.map((figure) => `
            <section>
              <span>${figure.figure}</span><strong>${figure.question}</strong>
              <p><b>回答</b>${figure.answer}</p>
              <p><b>证据</b>${figure.evidence}</p>
              <p class="study-limit"><b>边界</b>${figure.boundary}</p>
            </section>`).join("")}</div>
          <p><b>因果链</b>${study.deepDive.causalChain}</p>
          <p><b>开放问题</b>${study.deepDive.openQuestions.join(" · ")}</p>
        </details>` : "";
      return `
      <article class="research-study">
        <div class="reading-layer-label"><span>维度 1 · 60 秒问题卡</span><small>${study.readingLevel === "figure-audited" ? "已升级至逐图精读" : "证据级核验"}</small></div>
        <div class="study-meta">${study.journal} · ${study.year} · ${readingLabel} · ${versionLabel}</div>
        <h5>${study.title}</h5>
        <p class="study-role"><b>团队角色</b>${study.labRole}</p>
        <p><b>Story｜问题</b>${study.question}</p>
        <p><b>Advance｜推进</b>${study.finding}</p>
        <p><b>Evidence｜支点</b>${study.evidence.join(" · ")}</p>
        <p class="study-limit"><b>Scope｜边界</b>${study.limitations}</p>
        ${deepDive}
        <a href="${study.url}" target="_blank" rel="noreferrer">打开原创论文 ↗</a>
      </article>`;
    }).join("")
    : '<p class="research-pending">尚未达到“官网 + 两篇原创研究”交叉核验门槛，因此不生成看似完整的团队故事。</p>';

  $("#labResearchContent").innerHTML = `
    <p class="eyebrow">${status}</p>
    <h3>${lab.pi}</h3>
    <p class="research-institution">${lab.institution} · ${lab.region}</p>
    <p class="reading-layer-kicker">维度 3 · 团队纵向综合</p>
    <section class="research-question"><span>持续问题</span><strong>${profile.question}</strong><p>${profile.whyFollow}</p></section>
    <section class="research-block"><h4>能力与当前信号</h4><div class="research-chips">${profile.capabilities.map((item) => `<span>${item}</span>`).join("")}</div><p>${profile.currentSignal}</p></section>
    <section class="research-block"><h4>下一步监控问题</h4><ol>${profile.watchQuestions.map((item) => `<li>${item}</li>`).join("")}</ol></section>
    <section class="research-block"><h4>代表工作与证据边界</h4>${studies}</section>
    <section class="research-block audit-block"><h4>审计状态</h4>
      ${(profile.audit.findings || []).map((item) => `<p class="audit-good">✓ ${item}</p>`).join("")}
      ${(profile.audit.unresolved || []).map((item) => `<p class="audit-open">? ${item}</p>`).join("")}
      ${(profile.audit.corrections || []).map((item) => `<p class="audit-fix">↺ ${item}</p>`).join("")}
    </section>
    <div class="research-actions"><a href="${lab.website}" target="_blank" rel="noreferrer">LAB 官网 ↗</a><a href="${profile.officialSource.url}" target="_blank" rel="noreferrer">核验来源 ↗</a></div>`;
  $("#labResearchDialog").showModal();
}

function renderSources() {
  const sources = [
    { name: "PubMed", type: "PEER-REVIEWED", copy: "原创论文与正式更正的主索引。自动查询排除 Review，并对目标机制与作者加权。", url: "https://pubmed.ncbi.nlm.nih.gov/?term=ferroptosis%5BTitle%2FAbstract%5D&sort=date" },
    { name: "Preprints", type: "CROSSREF INDEX", copy: "通过 Crossref 聚合 bioRxiv 等平台，抢先发现尚未同行评议的新机制与负结果；所有条目始终显示预印本警示。", url: "https://www.biorxiv.org/search/ferroptosis" },
    { name: "ClinicalTrials.gov", type: "TRANSLATION", copy: "区分直接干预、机制伴随研究与仅测量标志物的观察性项目，避免夸大临床成熟度。", url: "https://clinicaltrials.gov/search?term=ferroptosis" },
    { name: "Lab / Network", type: "PRIMARY SITES", copy: "直达实验室和正式研究网络官网，追踪人员变动、招聘、会议信息与未进入数据库的动态。", url: "https://www.dfg-ferroptosis.net/" },
  ];
  $("#sourceGrid").innerHTML = sources.map((source) => `
    <article class="source-card"><span class="source-type">${source.type}</span><h3>${source.name}</h3><p>${source.copy}</p><a href="${source.url}" target="_blank" rel="noreferrer">打开源站 ↗</a></article>
  `).join("");
}

function renderFreshness() {
  const updated = state.meta?.generatedAt;
  $("#topUpdated").textContent = updated ? timeAgo(updated) : "离线数据";
  $("#footerUpdated").textContent = `最后聚合：${updated ? formatDate(updated) : "未知"}`;
  $("#labCount").textContent = state.labs.length;
  $("#trialCount").textContent = state.meta?.counts?.clinicalTrials ?? state.signals.filter((s) => s.sourceType === "trial").length;
  if (state.researchCounts) {
    $("#researchCoverage").textContent = `${state.researchCounts.audited} 个团队已完成三维审计，${state.researchCounts.screened} 个仅停留在 60 秒初筛；${state.researchCounts.figureAuditedStudies}/${state.researchCounts.studies} 篇唯一代表论文达到逐图精读（${state.researchCounts.studyRecords} 条团队—论文记录）。`;
    $("#quickStudyCount").textContent = `${state.researchCounts.studies} 篇唯一论文`;
    $("#figureStudyCount").textContent = `${state.researchCounts.figureAuditedStudies} 篇已升级`;
    $("#longitudinalLabCount").textContent = `${state.researchCounts.audited} 个团队`;
  }
  const rows = state.meta?.sources || [];
  $("#freshnessList").innerHTML = rows.map((row) => `
    <div class="freshness-row"><b>${row.name}</b><span>${row.ok ? "成功" : "失败"} · ${timeAgo(row.updatedAt)}</span><small>${row.note || ""}</small></div>
  `).join("") || '<div class="empty">暂无更新记录</div>';
}

function bindEvents() {
  $$("#sourceFilters button").forEach((button) => button.addEventListener("click", () => {
    state.source = button.dataset.source;
    state.visibleSignals = 8;
    $$("#sourceFilters button").forEach((item) => item.classList.toggle("active", item === button));
    renderSignals();
  }));
  $("#topicFilter").addEventListener("change", (event) => { state.topic = event.target.value; state.visibleSignals = 8; renderSignals(); });
  $("#signalSort").addEventListener("change", (event) => { state.signalSort = event.target.value; renderSignals(); });
  $("#loadMoreSignals").addEventListener("click", () => { state.visibleSignals += 8; renderSignals(); });
  $("#labSearch").addEventListener("input", (event) => { state.labSearch = event.target.value; renderLabs(); });
  $("#labGrid").addEventListener("click", (event) => {
    const button = event.target.closest(".research-open");
    if (button) renderResearchProfile(button.dataset.labId);
  });
  const freshnessDialog = $("#freshnessDialog");
  $("#freshnessButton").addEventListener("click", () => freshnessDialog.showModal());
  for (const dialog of $$("dialog")) {
    dialog.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  }
}

async function init() {
  const [labs, curated, live, meta, watchQueries, research] = await Promise.all([
    readJson("data/labs.json", []),
    readJson("data/intelligence-curated.json", []),
    readJson("data/live.json", []),
    readJson("data/meta.json", null),
    readJson("data/watch-queries.json", []),
    readJson("data/lab-research.json", { profiles: [], counts: null }),
  ]);
  state.labs = labs;
  state.researchProfiles = new Map(research.profiles.map((profile) => [profile.labId, profile]));
  state.researchCounts = research.counts;
  state.watchedLabIds = new Set(watchQueries.map((item) => item.labId));
  state.signals = uniqueSignals([
    ...curated.map((item) => ({ ...item, reviewStatus: "curated" })),
    ...live.map((item) => ({ ...item, reviewStatus: "auto" })),
  ]);
  state.meta = meta;
  renderFrontiers();
  renderTopicOptions();
  renderSignals();
  renderLabCategories();
  renderLabs();
  renderSources();
  renderFreshness();
  bindEvents();
}

init();
