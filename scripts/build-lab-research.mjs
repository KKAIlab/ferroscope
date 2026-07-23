import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const labs = JSON.parse(await fs.readFile(path.join(dataDir, "labs.json"), "utf8"));
const audits = JSON.parse(await fs.readFile(path.join(dataDir, "lab-research-audits.json"), "utf8"));
const auditedById = new Map(audits.map((profile) => [profile.labId, profile]));

function questionFor(lab) {
  const [first = "核心机制", second = "脂质过氧化"] = lab.tags || [];
  if (lab.category === "methods") {
    return `${first} 与 ${second} 能否把 ferroptosis 的关键化学事件从代理读出推进到直接、定量且具有空间分辨率的测量？`;
  }
  if (lab.category === "translational") {
    return `${first} 相关表型是否由 ferroptosis 因果驱动，并能否在 ${second} 模型中形成可干预窗口？`;
  }
  if (lab.category === "adjacent") {
    return `${first} 与 ${second} 在什么条件下真正汇入 ferroptosis 机制，而不是只构成相邻的应激或细胞死亡背景？`;
  }
  return `${first} 与 ${second} 如何决定 ferroptosis 的发生、耐受或组织特异性？`;
}

function watchQuestionsFor(lab) {
  if (lab.category === "methods") {
    return [
      "该方法测量的是自由基、氧化脂质分子种还是代理信号，选择性和定量范围如何？",
      "方法能否在独立实验室、组织样本和体内模型中重复？"
    ];
  }
  if (lab.category === "translational") {
    return [
      "治疗或疾病表型是否同时具有遗传学、脂质过氧化和铁依赖的正交证据？",
      "细胞、动物、离体人组织与患者证据之间是否存在未解释的断层？"
    ];
  }
  if (lab.category === "adjacent") {
    return [
      "新工作是否直接操作 ferroptosis 执行链，还是只观察 NRF2、ROS、炎症或细胞死亡关联？",
      "该团队的独特能力能否补足脂质生化、体内因果或转化边界中的一个缺口？"
    ];
  }
  return [
    "关键因子是否具有必要性、充分性、直接生化读出和正交救援？",
    "机制能否从培养细胞推进到组织特异动物模型或人源系统？"
  ];
}

const rawProfiles = labs.map((lab) => auditedById.get(lab.id) || {
  labId: lab.id,
  question: questionFor(lab),
  whyFollow: lab.focus,
  capabilities: (lab.tags || []).slice(0, 5),
  watchQuestions: watchQuestionsFor(lab),
  officialSource: {
    url: lab.website,
    checkedAt: null,
    verified: false,
    supports: []
  },
  majorStudies: [],
  currentSignal: "已完成 60 秒问题初筛；官网研究内容和代表性原创论文待逐条精读。",
  audit: {
    status: "pending",
    score: 0,
    checkedAt: null,
    findings: [],
    unresolved: ["待核对官网研究页与至少两篇原创研究", "待检索反证、更正和版本状态"],
    corrections: []
  }
});

const normalizeStudyUrl = (url = "") => url
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "https://doi.org/")
  .replace(/\/$/, "");

// 阅读深度属于论文，而团队角色属于“团队—论文”关系。同一 DOI 出现在多个
// 团队档案时，共享逐图审计结果，但保留各团队不同的 labRole 与主线解释。
const paperAuditByUrl = new Map();
for (const profile of rawProfiles) {
  for (const study of profile.majorStudies || []) {
    const key = normalizeStudyUrl(study.url);
    const candidate = {
      readingLevel: study.readingLevel || "evidence-audited",
      ...(study.deepDive ? { deepDive: study.deepDive } : {})
    };
    const existing = paperAuditByUrl.get(key);
    if (!existing || (existing.readingLevel !== "figure-audited" && candidate.readingLevel === "figure-audited")) {
      paperAuditByUrl.set(key, candidate);
      continue;
    }
    if (existing.readingLevel === "figure-audited" && candidate.readingLevel === "figure-audited") {
      if (existing.deepDive && candidate.deepDive
        && JSON.stringify(existing.deepDive) !== JSON.stringify(candidate.deepDive)) {
        throw new Error(`同一论文存在冲突的逐图审计：${study.url}`);
      }
      // 同一 DOI 可能先出现在方法协作团队、后出现在主导团队。优先采用完整的
      // 逐图审计，再把它传播到所有团队—论文记录；缺少 deepDive 不是冲突。
      if (!existing.deepDive && candidate.deepDive) paperAuditByUrl.set(key, candidate);
    }
  }
}

const profiles = rawProfiles.map((profile) => ({
  ...profile,
  majorStudies: (profile.majorStudies || []).map((study) => {
    const { readingLevel: _readingLevel, deepDive: _deepDive, ...teamStudy } = study;
    const paperAudit = paperAuditByUrl.get(normalizeStudyUrl(study.url)) || { readingLevel: "evidence-audited" };
    return { ...teamStudy, ...paperAudit };
  })
}));

const studyRecords = profiles.flatMap((profile) => profile.majorStudies || []);
const papersByUrl = new Map();
for (const study of studyRecords) {
  const key = normalizeStudyUrl(study.url);
  const existing = papersByUrl.get(key);
  if (existing && (existing.title !== study.title || existing.publicationStatus !== study.publicationStatus)) {
    throw new Error(`同一论文的元数据或版本状态不一致：${study.url}`);
  }
  if (!existing) {
    papersByUrl.set(key, {
      title: study.title,
      year: study.year,
      journal: study.journal,
      url: study.url,
      publicationStatus: study.publicationStatus,
      readingLevel: study.readingLevel,
      ...(study.deepDive ? { deepDive: study.deepDive } : {})
    });
  }
}
const papers = [...papersByUrl.values()];

const result = {
  schemaVersion: "0.3.0",
  methodVersion: "0.8",
  researchCutoff: "2026-07-23",
  counts: {
    total: profiles.length,
    audited: profiles.filter((profile) => profile.audit.status !== "pending").length,
    screened: profiles.filter((profile) => profile.audit.status === "pending").length,
    studyRecords: studyRecords.length,
    studies: papers.length,
    figureAuditedStudies: papers.filter((study) => study.readingLevel === "figure-audited").length,
    evidenceAuditedStudies: papers.filter((study) => study.readingLevel === "evidence-audited").length
  },
  papers,
  profiles
};

await fs.writeFile(path.join(dataDir, "lab-research.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(`研究档案已生成：${result.counts.total} 个团队，${result.counts.audited} 个已完成三维审计；${result.counts.studyRecords} 条团队—论文记录对应 ${result.counts.studies} 篇唯一论文，其中 ${result.counts.figureAuditedStudies} 篇达到逐图精读。`);
