import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(root, "data", name), "utf8"));
const labs = await readJson("labs.json");
const audits = await readJson("lab-research-audits.json");
const research = await readJson("lab-research.json");
const method = await fs.readFile(path.join(root, "docs", "RESEARCH_INTELLIGENCE_METHOD.md"), "utf8");
const app = await fs.readFile(path.join(root, "app.js"), "utf8");
const index = await fs.readFile(path.join(root, "index.html"), "utf8");
const errors = [];
const fail = (condition, message) => { if (!condition) errors.push(message); };
const labIds = new Set(labs.map((lab) => lab.id));
const profileIds = research.profiles.map((profile) => profile.labId);

fail(research.profiles.length === 37, `研究档案应覆盖 37 个团队，当前 ${research.profiles.length}`);
fail(research.schemaVersion === "0.3.0", `研究数据结构版本应为 0.3.0，当前 ${research.schemaVersion}`);
fail(research.methodVersion === "0.8", `研究方法版本应为 0.8，当前 ${research.methodVersion}`);
fail(new Set(profileIds).size === profileIds.length, "研究档案存在重复 labId");
fail(profileIds.every((id) => labIds.has(id)) && [...labIds].every((id) => profileIds.includes(id)), "研究档案与 labs.json 未一一对应");
fail(research.counts.total === 37, "counts.total 与团队总数不符");
fail(research.counts.audited === audits.length, "counts.audited 与审计样本数不符");
fail(research.counts.screened + research.counts.audited === research.counts.total, "screened + audited 与 total 不符");
fail(research.counts.studyRecords === 74, `团队—论文记录应为 74 条，当前 ${research.counts.studyRecords}`);
fail(research.counts.studies === 69, `规范化 DOI 后应为 69 篇唯一论文，当前 ${research.counts.studies}`);
fail(research.papers?.length === research.counts.studies, "唯一论文库与 counts.studies 不一致");
fail(research.counts.figureAuditedStudies + research.counts.evidenceAuditedStudies === research.counts.studies, "论文阅读深度计数与代表论文总数不符");
fail(research.counts.figureAuditedStudies >= 25, `五批至少 25 篇代表论文应达到逐图精读，当前 ${research.counts.figureAuditedStudies}`);

const normalizeStudyUrl = (url = "") => url.toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "https://doi.org/").replace(/\/$/, "");
const studyRecordsByUrl = new Map();
for (const profile of research.profiles) {
  for (const study of profile.majorStudies || []) {
    const key = normalizeStudyUrl(study.url);
    if (!studyRecordsByUrl.has(key)) studyRecordsByUrl.set(key, []);
    studyRecordsByUrl.get(key).push(study);
  }
}
fail(studyRecordsByUrl.size === research.counts.studies, "团队档案的唯一 DOI 数与论文库不一致");
for (const [url, records] of studyRecordsByUrl) {
  fail(new Set(records.map((study) => study.readingLevel)).size === 1, `同一论文阅读深度不一致：${url}`);
  fail(new Set(records.map((study) => study.publicationStatus)).size === 1, `同一论文正式版本状态不一致：${url}`);
  if (records[0].readingLevel === "figure-audited") {
    fail(records.every((study) => study.deepDive?.status === "figure-audited"), `同一逐图论文未向所有团队档案共享审计：${url}`);
  }
}

for (const profile of research.profiles) {
  const prefix = `研究档案 ${profile.labId}`;
  fail(profile.question?.endsWith("？"), `${prefix} 缺少可检验问题`);
  fail(profile.whyFollow?.length >= 20, `${prefix} whyFollow 过短`);
  fail(profile.currentSignal?.length >= 30, `${prefix} 缺少能够连接旧主线与最新工作的团队纵向信号`);
  fail(profile.capabilities?.length >= 2, `${prefix} 能力标签不足`);
  fail(profile.watchQuestions?.length >= 2, `${prefix} 监控问题不足`);
  fail(profile.officialSource?.url?.startsWith("https://"), `${prefix} 缺少 HTTPS 官网`);
  fail(profile.audit?.unresolved?.length >= 1, `${prefix} 缺少未解决问题`);

  if (profile.audit?.status === "pending") {
    fail(profile.majorStudies?.length === 0, `${prefix} 未审计却包含代表研究`);
    fail(profile.officialSource.verified === false, `${prefix} 未审计却标记官网已核验`);
    fail(profile.audit.score === 0, `${prefix} 未审计却有审计分数`);
  } else {
    fail(profile.officialSource.verified === true, `${prefix} 已审计但官网未核验`);
    fail(profile.audit.score >= 70, `${prefix} 审计分数低于 70`);
    fail(profile.majorStudies?.length >= 2, `${prefix} 代表研究少于两篇`);
    for (const study of profile.majorStudies || []) {
      fail(study.title && study.year && study.journal, `${prefix} 代表研究元数据不完整`);
      fail(study.url?.startsWith("https://doi.org/"), `${prefix} 代表研究未使用 DOI 一手入口`);
      fail(["version-of-record", "accepted", "preprint", "corrected"].includes(study.publicationStatus), `${prefix} 代表研究未核对版本状态`);
      fail(["evidence-audited", "figure-audited"].includes(study.readingLevel), `${prefix} 代表研究缺少阅读深度`);
      fail(study.labRole?.length >= 12, `${prefix} 代表研究未说明团队角色`);
      fail(study.question?.endsWith("？"), `${prefix} 代表研究缺少问题`);
      fail(study.finding?.length >= 20, `${prefix} 代表研究结论过短`);
      fail(study.evidence?.length >= 2, `${prefix} 代表研究证据链不足`);
      fail(study.limitations?.length >= 20, `${prefix} 代表研究缺少限制`);
      if (study.readingLevel === "figure-audited") {
        const dive = study.deepDive;
        fail(dive?.status === "figure-audited", `${prefix} 逐图精读缺少状态`);
        fail(dive?.centralHypothesis?.length >= 25, `${prefix} 逐图精读缺少中心假说`);
        fail(dive?.figureChain?.length >= 4, `${prefix} 逐图精读的 Figure 因果链不足`);
        for (const figure of dive?.figureChain || []) {
          fail(figure.figure && figure.question && figure.answer && figure.evidence && figure.boundary, `${prefix} Figure 证据单元字段不完整`);
        }
        fail(dive?.openQuestions?.length >= 2, `${prefix} 逐图精读缺少由证据导出的开放问题`);
      }
    }
  }
}

for (const phrase of ["60 秒初筛", "单篇机制深挖", "团队研究主线", "方法范例与领域证据的硬隔离", "method-example", "domain-evidence", "search-lead", "三个维度是同一条情报的不同分辨率", "Fact", "Inference", "Unknown", "急性扰动", "三层升级门", "labRole", "publicationStatus", "readingLevel", "观察工具是否同时是干预工具", "工程化遗传压力不能偷换成药理可转化性", "疾病表型相似不等于疾病病因", "混合死亡程序必须保留", "论文身份与团队归属必须分层", "团队—论文记录", "唯一论文", "信号、增敏物和充分执行因子必须分开", "空间结论必须附条件向量", "外源营养脂质是暴露实验，不是膳食建议", "强制定位证明局部可行性，不等于内源起点", "局部给药不是系统药理", "模型图不是新的因果证据", "反应型探针是化学参与者，不是摄像机", "遗传必要性不等于直接酶化学", "动力学排序必须带相环境", "疾病 signature 不是疾病病因", "超营养剂量和预防性处理不是饮食或治疗建议", "模板槽位必须与 canonical metadata 一致", "更正要按影响层级处理", "肿瘤启动期遗传删除不是已建立肿瘤治疗", "体外阴性不等于体内无依赖", "免疫系统必须记录细胞类型方向性", "临床表达或 signature 不是患者机制测量", "离体人器官不是临床试验", "配对器官改善对照，不自动解决小样本", "多机制化合物要拆分作用归因", "连续体内选择会混合适应与克隆选择", "Corrected proof 与 Publisher Correction 必须持续追踪", "完整 Figure 访问是逐图标签的硬门", "增益筛选和过表达不等于内源充分性", "总磷脂重塑不等于氧化脂质通量", "已有临床药物加实验性 FIN 不等于可立即再利用", "争议药理必须记录剂量—脱靶—遗传证据三角", "细胞器必要性必须以诱导方式索引", "工程化触发与最小膜重构证明的是层级化充分性", "人类基因型关联与小鼠机制是三角互证，不是临床闭环", "广谱翻译因子和代谢蛋白必须保留多效性负担", "团队纵向归属不能被高影响论文覆盖"]) {
  fail(method.includes(phrase), `学习规范缺少关键规则：${phrase}`);
}
for (const unrelated of ["Coordinator", "TWIST1", "颅神经嵴", "Chai lab", "面部与肢体间充质"]) {
  fail(!JSON.stringify(research).includes(unrelated), `铁死亡研究数据混入无关案例内容：${unrelated}`);
}

const conrad = research.profiles.find((profile) => profile.labId === "conrad-helmholtz");
const finLoop = conrad?.majorStudies?.find((study) => study.url === "https://doi.org/10.1016/j.cell.2025.11.014");
fail(finLoop?.journal === "Cell", "GPX4 fin-loop 论文期刊必须校正为 Cell");
fail(conrad?.audit?.corrections?.some((item) => item.includes("Why Nature/Why Science")), "GPX4 范例模板残留未记录为审计修正");
fail(conrad?.audit?.corrections?.some((item) => item.includes("机制修正")), "GPX4 范例的范式主张未降级");

const rodriguez = research.profiles.find((profile) => profile.labId === "rodriguez-curie");
fail(!rodriguez?.majorStudies?.some((study) => study.url.includes("10597-2")), "精胺论文被错误列为 Rodriguez 团队主导代表作");
fail(rodriguez?.audit?.corrections?.some((item) => item.includes("循环伏安")), "Rodriguez 团队的精胺论文贡献边界未记录");

const tang = research.profiles.find((profile) => profile.labId === "tang-kang-utsw");
const spermine = tang?.majorStudies?.find((study) => study.url.includes("10597-2"));
fail(spermine?.labRole?.includes("总体监督") && spermine?.labRole?.includes("数据分析与修稿"), "Tang／Kang 在精胺论文中的贡献边界未准确记录");

const gilTate = research.profiles.find((profile) => profile.labId === "gil-tate-imperial");
const fsp1 = gilTate?.majorStudies?.find((study) => study.url.includes("1707-0"));
fail(fsp1?.labRole?.includes("中间作者") && fsp1?.labRole?.includes("不能视为"), "Tate 在 FSP1 论文中的非主导角色未准确记录");

const bush = research.profiles.find((profile) => profile.labId === "bush-florey");
fail(bush?.audit?.corrections?.some((item) => item.includes("总脑铁相关性")), "Bush 团队的脑铁相关性未与 ferroptosis 因果证据区分");

const zou = research.profiles.find((profile) => profile.labId === "zou-westlake");
const etherLipids = zou?.majorStudies?.find((study) => study.url.includes("2732-8"));
fail(etherLipids?.readingLevel === "figure-audited" && etherLipids?.deepDive?.figureChain?.length === 4, "Zou 醚脂质论文未完成四张主图审计");
fail(etherLipids?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("工程化 GPX4-null")), "Zou 醚脂质论文未区分工程化遗传压力与药理转化");

const yamada = research.profiles.find((profile) => profile.labId === "yamada-kyushu");
const lysosome = yamada?.majorStudies?.find((study) => study.url.includes("58909-w"));
fail(lysosome?.readingLevel === "figure-audited" && lysosome?.deepDive?.figureChain?.length === 4, "Yamada 溶酶体论文未完成四张主图审计");
fail(lysosome?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("检测剂也是自由基捕获剂")), "Yamada 溶酶体论文未记录探针干预被观察过程");

const imai = research.profiles.find((profile) => profile.labId === "imai-kitasato");
const rpe = imai?.majorStudies?.find((study) => study.url.includes("07150-2"));
fail(rpe?.readingLevel === "figure-audited" && rpe?.deepDive?.figureChain?.length === 6, "Imai RPE 论文未完成六张主图审计");
fail(imai?.audit?.corrections?.some((item) => item.includes("不能描述为纯 ferroptosis")), "Imai RPE 模型未保留 ferroptosis/necroptosis 混合边界");

const mishima = research.profiles.find((profile) => profile.labId === "mishima-tohoku");
const prdx6 = mishima?.majorStudies?.find((study) => study.url.includes("molcel.2024.10.028"));
fail(prdx6?.readingLevel === "figure-audited" && prdx6?.deepDive?.figureChain?.length === 7, "Mishima PRDX6 论文未完成七张主图审计");
fail(prdx6?.deepDive?.openQuestions?.some((item) => item.includes("GS-Se-SG")), "PRDX6 论文未把细胞内 GS-Se-SG 供体保留为未知");

const fsp1Discovery = conrad?.majorStudies?.find((study) => study.url.includes("1707-0"));
fail(fsp1Discovery?.readingLevel === "figure-audited" && fsp1Discovery?.deepDive?.figureChain?.length === 4, "FSP1 发现论文未完成四张主图审计");
fail(fsp1Discovery?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("第一代人源细胞探针")), "FSP1 论文未保留 iFSP1 的物种和药理边界");

const kagan = research.profiles.find((profile) => profile.labId === "kagan-pitt");
const oxidizedPe = kagan?.majorStudies?.find((study) => study.url.includes("nchembio.2238"));
fail(oxidizedPe?.readingLevel === "figure-audited" && oxidizedPe?.deepDive?.figureChain?.length === 6, "Kagan 氧化 PE 论文未完成六张主图审计");
fail(oxidizedPe?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("单独并未造成同等死亡")), "氧化 PE 论文未区分增敏与充分致死");

const stockwell = research.profiles.find((profile) => profile.labId === "stockwell-columbia");
const essentialSites = stockwell?.majorStudies?.find((study) => study.url.includes("01249-3"));
fail(essentialSites?.readingLevel === "figure-audited" && essentialSites?.deepDive?.figureChain?.length === 6, "Stockwell 细胞器位点论文未完成六张主图审计");
fail(essentialSites?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("直接改变 ER 面积/组成未成功")), "ER 空间结论未保留直接因果操纵缺口");

const dixon = research.profiles.find((profile) => profile.labId === "dixon-stanford");
const mufa = dixon?.majorStudies?.find((study) => study.url.includes("2018.11.016"));
fail(mufa?.readingLevel === "figure-audited" && mufa?.deepDive?.figureChain?.length === 6, "Dixon MUFA 论文未完成六张主图审计");
fail(mufa?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("白蛋白结合")) && mufa?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("状态重塑")), "MUFA 论文未保留有效暴露与预处理边界");

const lysosomalIron = rodriguez?.majorStudies?.find((study) => study.url.includes("08974-4"));
fail(lysosomalIron?.readingLevel === "figure-audited" && lysosomalIron?.deepDive?.figureChain?.length === 4, "Rodriguez 溶酶体铁论文未完成三张主图与关键扩展数据审计");
fail(lysosomalIron?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("人为强制定位")) && lysosomalIron?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("淋巴内局部给药")), "溶酶体铁论文未区分局部化学充分性与系统药理");

const por = zou?.majorStudies?.find((study) => study.url.includes("0472-6"));
fail(por?.readingLevel === "figure-audited" && por?.deepDive?.figureChain?.length === 5, "POR 论文未完成五张主图审计");
fail(por?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("未鉴定 CYP 伙伴")), "POR 论文把遗传必要性错误提升为直接酶化学");

fail(finLoop?.readingLevel === "figure-audited" && finLoop?.deepDive?.figureChain?.length === 5, "GPX4 fin-loop 论文未完成五张主图审计");
fail(finLoop?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("不证明 GPX4 缺陷是散发性 AD 的病因")), "GPX4 fin-loop 论文未保留疾病 signature 的因果边界");

const radicalProbe = yamada?.majorStudies?.find((study) => study.url.includes("nchembio.2105"));
fail(radicalProbe?.readingLevel === "figure-audited" && radicalProbe?.deepDive?.figureChain?.length === 5, "NBD-Pen 论文未完成五个 Figure 证据单元审计");
fail(radicalProbe?.limitations?.includes("未检测或声称 ferroptosis") && radicalProbe?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("捕获消耗自由基")), "NBD-Pen 方法论文被错误倒推为 ferroptosis 证据或无扰动成像");

const pratt = research.profiles.find((profile) => profile.labId === "pratt-ottawa");
const radicalTraps = pratt?.majorStudies?.find((study) => study.url.includes("acscentsci.7b00028"));
fail(radicalTraps?.readingLevel === "figure-audited" && radicalTraps?.deepDive?.figureChain?.length === 6, "Fer-1/Lip-1 论文未完成六张主图审计");
fail(radicalTraps?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("非极性均相溶剂")) && radicalTraps?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("真正的 Lip-1 nitroxide")), "Fer-1/Lip-1 论文未保留膜相动力学与产物鉴定边界");

const vitaminKRecords = studyRecordsByUrl.get("https://doi.org/10.1038/s41586-022-05022-3") || [];
fail(vitaminKRecords.length === 2 && vitaminKRecords.every((study) => study.readingLevel === "figure-audited" && study.deepDive?.figureChain?.length === 4), "维生素 K 逐图审计未按 DOI 传播到两个团队记录");
fail(new Set(vitaminKRecords.map((study) => study.labRole)).size === 2, "维生素 K 论文共享审计时丢失团队角色差异");
fail(vitaminKRecords.some((study) => study.deepDive?.figureChain?.some((figure) => figure.boundary.includes("不能把药理结果写成普通膳食维生素 K 的疗效"))), "维生素 K 论文未保留超营养与预处理边界");

const papagiannakopoulos = research.profiles.find((profile) => profile.labId === "papagiannakopoulos-nyu");
const lungFsp1 = papagiannakopoulos?.majorStudies?.find((study) => study.url.includes("09710-8"));
fail(lungFsp1?.readingLevel === "figure-audited" && lungFsp1?.deepDive?.figureChain?.length === 5, "肺癌 FSP1 论文未完成五张主图审计");
fail(lungFsp1?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("肿瘤启动时")) && lungFsp1?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("NSG 小鼠")), "肺癌 FSP1 论文未区分肿瘤启动依赖、PDX 与已建立肿瘤治疗");

const ubellacker = research.profiles.find((profile) => profile.labId === "ubellacker-harvard");
const melanomaFsp1 = ubellacker?.majorStudies?.find((study) => study.url.includes("09709-1"));
fail(melanomaFsp1?.readingLevel === "figure-audited" && melanomaFsp1?.deepDive?.figureChain?.length === 5, "黑色素瘤淋巴结 FSP1 论文未完成五张主图审计");
fail(melanomaFsp1?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("多轮体内选择")) && melanomaFsp1?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("局部高浓度瘤内给药")) && melanomaFsp1?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("Fig. 5j 是综合模型")), "淋巴结 FSP1 论文未保留选择模型、局部给药和模型图边界");

const vandenBerghe = research.profiles.find((profile) => profile.labId === "vandenberghe-antwerp");
const graftFerroptosis = vandenBerghe?.majorStudies?.find((study) => study.url.includes("j.cell.2026.04.024"));
fail(graftFerroptosis?.publicationStatus === "corrected" && graftFerroptosis?.readingLevel === "figure-audited" && graftFerroptosis?.deepDive?.figureChain?.length === 6, "移植器官 FXT-001 论文版本或六张主图审计不完整");
fail(graftFerroptosis?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("MDA 是非特异")) && graftFerroptosis?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("结果定义为描述性")), "移植论文未区分 MDA 关联、配对小样本与临床移植结局");

const linkermann = research.profiles.find((profile) => profile.labId === "linkermann-mannheim");
const estradiolKidney = linkermann?.majorStudies?.find((study) => study.url.includes("09389-x"));
fail(estradiolKidney?.publicationStatus === "corrected" && estradiolKidney?.readingLevel === "figure-audited" && estradiolKidney?.deepDive?.figureChain?.length === 5, "雌二醇肾损伤论文版本或五张主图审计不完整");
fail(estradiolKidney?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("10 μM 细胞剂量与 10 mg/kg")) && estradiolKidney?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("PRX/TRX 或其他补偿")) && estradiolKidney?.deepDive?.sourceScope?.includes("两份 Publisher Correction"), "肾损伤论文未保留剂量、补偿通路和更正版本边界");

const immuneZou = research.profiles.find((profile) => profile.labId === "zoulab-michigan");
const cd8Ferroptosis = immuneZou?.majorStudies?.find((study) => study.url.includes("1170-y"));
fail(cd8Ferroptosis?.readingLevel === "figure-audited" && cd8Ferroptosis?.deepDive?.figureChain?.length === 4, "CD8+ T 细胞—肿瘤 ferroptosis 论文未完成四张主图审计");
fail(cd8Ferroptosis?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("全身 Lip-1")) && cd8Ferroptosis?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("全部为观察性表达关联")), "肿瘤免疫论文未区分系统药理、肿瘤细胞归因与患者相关性");

const jiang = research.profiles.find((profile) => profile.labId === "jiang-msk");
const mboat = jiang?.majorStudies?.find((study) => study.url.includes("cell.2023.05.003"));
fail(mboat?.readingLevel === "figure-audited" && mboat?.deepDive?.figureChain?.length === 7, "MBOAT1/2 论文未完成七张主图审计");
fail(mboat?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("未氧化总磷脂")) && mboat?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("实验性 GPX4 KO")), "MBOAT1/2 论文未区分总脂质重塑、氧化通量与临床药物组合");

const gan = research.profiles.find((profile) => profile.labId === "gan-mdanderson");
const dhodh = gan?.majorStudies?.find((study) => study.url.includes("03539-7"));
fail(dhodh?.publicationStatus === "corrected" && dhodh?.readingLevel === "figure-audited" && dhodh?.deepDive?.figureChain?.length === 4, "DHODH 论文版本或四张主图审计不完整");
fail(dhodh?.deepDive?.sourceScope?.includes("Matters Arising") && dhodh?.deepDive?.sourceScope?.includes("Reply") && dhodh?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("500 μM") && figure.boundary.includes("FSP1")), "DHODH 论文未把正式更正与高剂量 FSP1 脱靶争议分层");

const garciaSaez = research.profiles.find((profile) => profile.labId === "garcia-saez-mpi");
const contactSpread = garciaSaez?.majorStudies?.find((study) => study.url.includes("58175-w"));
fail(contactSpread?.readingLevel === "figure-audited" && contactSpread?.deepDive?.figureChain?.length === 7, "膜接触传播论文未完成七张主图审计");
fail(contactSpread?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("physicochemical sufficiency") && figure.boundary.includes("组织内主导机制")), "人工膜重构被错误上调为体内主导传播证据");

const gao = research.profiles.find((profile) => profile.labId === "gao-hit");
const mitochondrialRole = gao?.majorStudies?.find((study) => study.url.includes("2018.10.042"));
fail(mitochondrialRole?.readingLevel === "figure-audited" && mitochondrialRole?.deepDive?.figureChain?.length === 6, "线粒体条件性论文未完成六张主图审计");
fail(mitochondrialRole?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("48 小时 CCCP")) && mitochondrialRole?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("RSL3") && figure.boundary.includes("GPX4 KO")), "线粒体论文未记录广泛代谢扰动或诱导方式边界");

const yin = research.profiles.find((profile) => profile.labId === "yin-cityu");
const aldh2 = yin?.majorStudies?.find((study) => study.url.includes("075220"));
fail(aldh2?.readingLevel === "figure-audited" && aldh2?.deepDive?.figureChain?.length === 7, "ALDH2/eIF3E 心肌论文未完成六张数据主图与模型图审计");
fail(aldh2?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("观察性")) && aldh2?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("预防性遗传干预")) && aldh2?.deepDive?.figureChain?.some((figure) => figure.boundary.includes("整合模型而非新增实验")), "ALDH2/eIF3E 论文未区分人群关联、预防性干预和模型图");

const march7 = research.papers?.find((study) => study.url.includes("cell.2026.03.052"));
if (march7) fail(march7.readingLevel === "evidence-audited", "未获得完整主图的 MARCH7 论文不应升级为逐图审计");

fail(research.counts.audited === 37, `37 个团队应全部完成档案审计，当前 ${research.counts.audited}`);
fail(research.counts.screened === 0, `完成全量审计后不应保留 pending 初筛，当前 ${research.counts.screened}`);
fail(app.includes("${state.researchCounts.figureAuditedStudies}/${state.researchCounts.studies} 篇唯一代表论文达到逐图精读") && app.includes("${state.researchCounts.studyRecords} 条团队—论文记录"), "页面必须同时公开唯一论文数与关系记录数，避免重复计算覆盖率");
fail(app.includes("档案审计通过") && !app.includes('"精读通过"'), "团队层必须标为档案审计，不能冒充论文逐图精读");
fail(app.includes("持续问题") && app.includes("能力与当前信号") && app.includes("代表工作与证据边界") && app.includes("下一步监控问题") && app.includes("profile.currentSignal"), "团队详情页未同时呈现单篇证据与跨论文纵向综合");
fail(app.includes("维度 1 · 60 秒问题卡") && app.includes("Story｜问题") && app.includes("Advance｜推进") && app.includes("Evidence｜支点") && app.includes("Scope｜边界"), "代表论文卡没有显式呈现 60 秒阅读层");
fail(app.includes("维度 2 · 展开逐图机制链") && app.includes("维度 3 · 团队纵向综合"), "团队档案没有显式区分逐图层与纵向综合层");
fail(index.includes("id=\"quickStudyCount\"") && index.includes("id=\"figureStudyCount\"") && index.includes("id=\"longitudinalLabCount\""), "全球团队页缺少三维阅读覆盖概览");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`研究方法测试通过：37 个团队均有问题档案；${research.counts.studyRecords} 条团队—论文记录对应 ${research.counts.studies} 篇唯一论文，其中 ${research.counts.figureAuditedStudies} 篇达到逐图精读。`);
