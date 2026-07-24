// Round-10 knowledge expansion: widen the mechanism network and the terminology corpus, grounding
// every mechanism edge in the papers now in the English layer (papers-en.json). Deterministic and
// idempotent: re-running does not duplicate nodes, edges or terms. Content is curatorial (the
// mechanism map is the project's conceptual framing), so nothing here is source-checked — but each
// mechanism edge now names the papers that address it, and validate-v09 enforces that those DOIs
// resolve to real English paper records. Mechanism node labels/descriptions are English only; the
// new glossary terms carry a full en/zh/ja alias set (CJK is allowed only in the glossary).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (f) => path.join(root, "data", f);
const readJson = (f) => JSON.parse(fs.readFileSync(dataPath(f), "utf8"));
const writeJson = (f, v) => fs.writeFileSync(dataPath(f), JSON.stringify(v, null, 2) + "\n");

// ---- 4 new mechanism nodes (10 -> 14) -------------------------------------------------------
const NEW_MECHANISMS = [
  { id: "mufa-membrane-remodelling", label: "MUFA membrane remodelling defence", short: "MUFA", description: "Writing monounsaturated fatty acids into membrane phospholipids to displace oxidizable PUFA and raise the ferroptosis threshold, independent of GPX4." },
  { id: "selenium-selenoprotein", label: "Selenium and selenoprotein supply", short: "Se", description: "Cellular selenium uptake, transfer and utilization that supports synthesis of GPX4 and other selenoproteins." },
  { id: "mitochondrial-metabolism", label: "Mitochondrial metabolic drive", short: "Mito", description: "A conditional, induction-specific mitochondrial contribution through glutaminolysis, the TCA cycle, the electron-transport chain and membrane potential." },
  { id: "immune-regulation", label: "Immune regulation of ferroptosis", short: "Immune", description: "How immune signalling, in particular CD8+ T-cell interferon-gamma, reshapes tumour-cell cystine metabolism and ferroptosis sensitivity during immunotherapy." },
];

// ---- evidence anchors for every mechanism edge, keyed by "source->target" -------------------
// Each value is a list of papers-en DOIs that address the relation. The 14 existing edges are
// backfilled; the 6 new edges are added with their anchors. Every DOI must exist in papers-en.json.
const EDGE_EVIDENCE = {
  "iron-homeostasis->lipid-peroxidation": ["10.1038/s41586-025-08974-4", "10.1038/nchembio.2238"],
  "pufa-remodelling->lipid-peroxidation": ["10.1038/s41586-020-2732-8", "10.1038/s41589-020-0472-6", "10.1038/nchembio.2238"],
  "gpx4-gsh->lipid-peroxidation": ["10.1016/j.cell.2025.11.014", "10.1038/nchembio.2238"],
  "fsp1-coq->lipid-peroxidation": ["10.1038/s41586-019-1707-0", "10.1038/s41586-022-05022-3"],
  "lipid-peroxidation->death-execution": ["10.1038/s41467-025-58175-w", "10.1038/s41586-025-08974-4"],
  "organelle-spatial->iron-homeostasis": ["10.1038/s41586-025-08974-4", "10.1038/s41467-025-58909-w"],
  "organelle-spatial->lipid-peroxidation": ["10.1038/s41589-022-01249-3", "10.1038/s41467-025-58909-w"],
  "tumour-ecology->pufa-remodelling": ["10.1038/s41586-020-2732-8", "10.1016/j.cell.2023.05.003"],
  "tumour-ecology->fsp1-coq": ["10.1038/s41586-025-09710-8", "10.1038/s41586-025-09709-1"],
  "death-execution->tissue-injury": ["10.1038/s41586-025-09389-x", "10.1038/s41419-024-07150-2", "10.1016/j.cell.2026.04.024"],
  "translation->gpx4-gsh": ["10.1016/j.cell.2025.11.014", "10.1161/CIRCULATIONAHA.125.075220"],
  "translation->fsp1-coq": ["10.1038/s41586-025-09710-8", "10.1038/s41586-022-05022-3"],
  "translation->iron-homeostasis": ["10.1161/CIRCULATIONAHA.125.075220", "10.1038/s41586-025-08974-4"],
  "translation->tissue-injury": ["10.1016/j.cell.2026.04.024", "10.1038/s41586-025-09389-x"],
  // new edges
  "mufa-membrane-remodelling->lipid-peroxidation": ["10.1016/j.cell.2023.05.003", "10.1016/j.chembiol.2018.11.016"],
  "selenium-selenoprotein->gpx4-gsh": ["10.1016/j.molcel.2024.10.028"],
  // Gao only: the "drives" relation rests on the paper that shows a conditional mitochondrial
  // driver. DHODH (s41586-2021) is a mitochondrial *defence* paper (opposite polarity, and itself
  // contested by a Matters Arising), so citing it under "drives" was directionally wrong — dropped.
  "mitochondrial-metabolism->lipid-peroxidation": ["10.1016/j.molcel.2018.10.042"],
  "translation->mufa-membrane-remodelling": ["10.1016/j.cell.2023.05.003"],
  "immune-regulation->gpx4-gsh": ["10.1038/s41586-019-1170-y"],
  "fsp1-coq->organelle-spatial": ["10.1038/s41586-025-09709-1", "10.1038/s41556-025-01790-y"],
};

const NEW_EDGES = [
  { source: "mufa-membrane-remodelling", target: "lipid-peroxidation", relation: "suppresses", label: "MUFA-loaded phospholipids displace oxidizable PUFA and raise the threshold", confidence: "strong in selected models" },
  { source: "selenium-selenoprotein", target: "gpx4-gsh", relation: "supplies", label: "selenium utilization supports GPX4 selenoprotein synthesis", confidence: "strong in selected models" },
  { source: "mitochondrial-metabolism", target: "lipid-peroxidation", relation: "conditionally drives", label: "metabolic and membrane-potential drive under cysteine deprivation, not under direct GPX4 loss", confidence: "induction-specific; actively contested" },
  { source: "translation", target: "mufa-membrane-remodelling", relation: "targets", label: "endocrine therapy dismantles the hormone-maintained MBOAT defence", confidence: "preclinical" },
  { source: "immune-regulation", target: "gpx4-gsh", relation: "suppresses", label: "CD8+ T-cell IFN-gamma lowers system xc- cystine uptake and glutathione", confidence: "strong in selected in vivo models" },
  { source: "fsp1-coq", target: "organelle-spatial", relation: "localizes", label: "FSP1 acts at lysosome-associated membranes and lipid droplets, not only the plasma membrane", confidence: "model-dependent" },
];

// ---- 8 new trilingual terms (25 -> 33) ------------------------------------------------------
const NEW_TERMS = [
  { id: "mboat", term: "MBOAT1/2", aliases: { en: ["membrane-bound O-acyltransferase 1/2"], zh: ["膜结合O-酰基转移酶1/2"], ja: ["膜結合型O-アシルトランスフェラーゼ1/2"] }, simpleEnglish: "Enzymes that write monounsaturated fatty acids into phospholipids, lowering the pool of oxidizable PUFA and raising the ferroptosis threshold.", precisionNote: "A GPX4-independent, membrane-composition defence; its protective effect is shown mainly by overexpression and in selected tumours, not established for every tissue.", related: ["mufa", "pufa-pl", "acsl4"] },
  { id: "mufa", term: "monounsaturated fatty acid", aliases: { en: ["MUFA"], zh: ["单不饱和脂肪酸"], ja: ["一価不飽和脂肪酸"] }, simpleEnglish: "A fatty acid with one carbon-carbon double bond, such as oleic acid, which is far less prone to peroxidation than a PUFA.", precisionNote: "Exogenous MUFA builds a ferroptosis-resistant membrane state over hours through ACSL3, not by acute radical scavenging.", related: ["mboat", "acsl3", "pufa-pl"] },
  { id: "acsl3", term: "ACSL3", aliases: { en: ["acyl-CoA synthetase long-chain family member 3"], zh: ["长链酰基辅酶A合成酶3"], ja: ["長鎖アシルCoA合成酵素3"] }, simpleEnglish: "An enzyme that activates monounsaturated fatty acids for incorporation into membrane lipids, required for exogenous MUFA to protect against ferroptosis.", precisionNote: "The counterpart to ACSL4: ACSL3 favours MUFA (protective) whereas ACSL4 favours PUFA (sensitizing).", related: ["acsl4", "mufa"] },
  { id: "selenoprotein", term: "selenoprotein", aliases: { en: ["selenocysteine protein"], zh: ["硒蛋白"], ja: ["セレンタンパク質"] }, simpleEnglish: "A protein that carries a selenocysteine residue; GPX4 is the selenoprotein central to ferroptosis defence.", precisionNote: "Selenoprotein synthesis depends on cellular selenium supply and reducing power, so it links selenium metabolism to the GPX4 defence.", related: ["selenium", "gpx4", "prdx6"] },
  { id: "prdx6", term: "PRDX6", aliases: { en: ["peroxiredoxin 6"], zh: ["过氧化物还原酶6"], ja: ["ペルオキシレドキシン6"] }, simpleEnglish: "A peroxiredoxin that supports ferroptosis resistance mainly by directing cellular selenium utilization toward selenoprotein synthesis rather than by directly reducing phospholipid hydroperoxides.", precisionNote: "Its key anti-ferroptotic role is proposed as a selenium carrier through its C47 residue; a direct GPX4-substitute role was excluded in lysate assays.", related: ["selenoprotein", "selenium", "gpx4"] },
  { id: "lipid-droplet", term: "lipid droplet", aliases: { en: ["LD"], zh: ["脂滴"], ja: ["脂肪滴"] }, simpleEnglish: "An organelle storing neutral lipids such as triacylglycerol and cholesteryl ester; a site where FSP1 can perform quality control against neutral-lipid peroxidation.", precisionNote: "Whether droplets protect or supply oxidizable substrate is context-dependent; the droplet FSP1 role is shown in engineered PUFA-loaded conditions.", related: ["fsp1", "coq", "pufa-pl"] },
  { id: "mitochondria-ferroptosis", term: "mitochondria in ferroptosis", aliases: { en: ["mitochondrial contribution"], zh: ["线粒体（铁死亡）"], ja: ["ミトコンドリア（フェロトーシス）"] }, simpleEnglish: "The conditional role of mitochondrial metabolism in ferroptosis: it drives death under cysteine deprivation but is dispensable when GPX4 is directly inactivated.", precisionNote: "Mitochondria are not a universal ferroptosis executioner; the dependence is induction-specific and remains actively contested.", related: ["system-xc", "glutathione", "lipid-peroxidation"] },
  { id: "ifn-gamma-ferroptosis", term: "IFN-gamma in ferroptosis", aliases: { en: ["interferon gamma"], zh: ["干扰素γ（铁死亡）"], ja: ["インターフェロンγ（フェロトーシス）"] }, simpleEnglish: "A cytokine from immunotherapy-activated CD8+ T cells that lowers tumour-cell system xc- and glutathione, sensitizing tumour cells to ferroptosis.", precisionNote: "Shown as one soluble sensitizing axis alongside classical cytotoxicity; patient data are observational expression associations, not direct ferroptosis measurements.", related: ["system-xc", "slc7a11", "glutathione"] },
];

// ---- apply (idempotent) ---------------------------------------------------------------------
const net = readJson("knowledge-network.json");
const glossary = readJson("glossary.json");

const mechIds = new Set(net.mechanisms.map((m) => m.id));
let addedMech = 0;
for (const m of NEW_MECHANISMS) if (!mechIds.has(m.id)) { net.mechanisms.push(m); mechIds.add(m.id); addedMech += 1; }

// backfill evidence on existing edges (does not overwrite a non-empty evidence already present)
let anchored = 0;
for (const edge of net.mechanismEdges) {
  const key = `${edge.source}->${edge.target}`;
  if ((!edge.evidence || !edge.evidence.length) && EDGE_EVIDENCE[key]) { edge.evidence = EDGE_EVIDENCE[key]; anchored += 1; }
}
// add new edges (idempotent by source->target)
const edgeKeys = new Set(net.mechanismEdges.map((e) => `${e.source}->${e.target}`));
let addedEdge = 0;
for (const e of NEW_EDGES) {
  const key = `${e.source}->${e.target}`;
  if (!edgeKeys.has(key)) { net.mechanismEdges.push({ ...e, evidence: EDGE_EVIDENCE[key] || [] }); edgeKeys.add(key); addedEdge += 1; }
}

const termIds = new Set(glossary.map((t) => t.id));
let addedTerm = 0;
for (const t of NEW_TERMS) if (!termIds.has(t.id)) { glossary.push(t); termIds.add(t.id); addedTerm += 1; }

net.updatedAt = net.updatedAt || "2026-07-24";
writeJson("knowledge-network.json", net);
writeJson("glossary.json", glossary);

console.log(`Round-10 expansion applied:`);
console.log(`  mechanisms: +${addedMech} (now ${net.mechanisms.length})`);
console.log(`  edges: +${addedEdge} new, ${anchored} backfilled with evidence (now ${net.mechanismEdges.length}, all with evidence: ${net.mechanismEdges.every((e) => (e.evidence || []).length)})`);
console.log(`  terms: +${addedTerm} (now ${glossary.length})`);
