// Round-11 knowledge expansion: add the three defence arms that Fig. 1 of the field's consensus paper
// treats as first-class (system xc- cystine supply, the GCH1-BH4 radical-trapping arm, and the
// mevalonate-sterol arm) now that their founding/defining papers exist in papers-en.json at the
// bibliographic level. Each new mechanism edge is anchored to one of those DOIs, and validate-v09
// enforces that the DOI resolves to a real English paper record. Also retargets the round-10 immune
// edge onto system xc-: the CD8 T-cell paper shows IFN-gamma lowering SLC7A11 (system xc-) specifically,
// so immune-regulation -> system-xc -> gpx4-gsh is a truer chain than immune-regulation -> gpx4-gsh.
// Deterministic and idempotent. Mechanism labels/descriptions are English only; the new glossary terms
// carry a full en/zh/ja alias set (CJK is allowed only in the glossary).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (f) => path.join(root, "data", f);
const readJson = (f) => JSON.parse(fs.readFileSync(dataPath(f), "utf8"));
const writeJson = (f, v) => fs.writeFileSync(dataPath(f), JSON.stringify(v, null, 2) + "\n");

// ---- 3 new defence-arm mechanism nodes (14 -> 17) -------------------------------------------
const NEW_MECHANISMS = [
  { id: "system-xc", label: "System xc- cystine supply", short: "xCT", description: "The cystine/glutamate antiporter (SLC7A11, xCT) that imports cystine for glutathione synthesis; its blockade by erastin is a founding trigger of ferroptosis." },
  { id: "gch1-bh4", label: "GCH1-BH4 radical trapping", short: "BH4", description: "GTP cyclohydrolase 1 makes tetrahydrobiopterin (BH4), an endogenous radical-trapping antioxidant that raises the ferroptosis threshold independently of GPX4." },
  { id: "mevalonate-sterol", label: "Mevalonate-sterol antioxidants", short: "MVA", description: "The mevalonate pathway supplies CoQ10 and sterol intermediates such as 7-dehydrocholesterol that suppress phospholipid peroxidation." },
];

// ---- evidence anchors for the new edges, keyed by "source->target" --------------------------
const EDGE_EVIDENCE = {
  "system-xc->gpx4-gsh": ["10.1016/j.cell.2012.03.042"],
  "gch1-bh4->lipid-peroxidation": ["10.1021/acscentsci.9b01063"],
  "mevalonate-sterol->lipid-peroxidation": ["10.1038/s41586-023-06878-9"],
};

const NEW_EDGES = [
  { source: "system-xc", target: "gpx4-gsh", relation: "supplies", label: "cystine import through system xc- feeds glutathione synthesis for the GPX4 axis", confidence: "established; founding mechanism" },
  { source: "gch1-bh4", target: "lipid-peroxidation", relation: "suppresses", label: "GCH1-derived BH4 acts as an endogenous radical-trapping antioxidant, independent of GPX4", confidence: "established in selected models" },
  { source: "mevalonate-sterol", target: "lipid-peroxidation", relation: "suppresses", label: "7-dehydrocholesterol from the mevalonate pathway shields membranes from peroxidation", confidence: "established in selected models" },
];

// ---- 3 new trilingual terms (33 -> 36) ------------------------------------------------------
const NEW_TERMS = [
  { id: "system-xc", term: "System xc- (SLC7A11)", aliases: { en: ["cystine/glutamate antiporter", "xCT"], zh: ["胱氨酸/谷氨酸反向转运体（SLC7A11）"], ja: ["シスチン/グルタミン酸トランスポーター（SLC7A11）"] }, simpleEnglish: "The membrane transporter that imports cystine in exchange for glutamate; the cystine it brings in is used to make glutathione, so blocking it (for example with erastin) starves the GPX4 defence and triggers ferroptosis.", precisionNote: "Its inhibition raises intracellular labile iron in some contexts but not all, and system xc- dependence is strong in many cell lines yet not universal in vivo.", related: ["glutathione", "gpx4", "slc7a11"] },
  { id: "gch1-bh4", term: "GCH1-BH4 pathway", aliases: { en: ["GTP cyclohydrolase 1", "tetrahydrobiopterin"], zh: ["GTP环化水解酶1–四氢生物蝶呤"], ja: ["GTPシクロヒドロラーゼ1–テトラヒドロビオプテリン"] }, simpleEnglish: "An endogenous defence in which the enzyme GCH1 makes tetrahydrobiopterin (BH4), a molecule that traps lipid radicals and remodels membrane lipids to resist peroxidation, working in parallel to GPX4.", precisionNote: "Characterised mainly by genetic overexpression and knockdown in cultured cells; how much it contributes across normal tissues relative to GPX4 and FSP1 is not settled.", related: ["fsp1", "coq", "radical-trapping-antioxidant"] },
  { id: "mevalonate-7dhc", term: "Mevalonate pathway / 7-DHC", aliases: { en: ["7-dehydrocholesterol", "squalene", "DHCR7"], zh: ["甲羟戊酸通路 / 7-脱氢胆固醇"], ja: ["メバロン酸経路 / 7-デヒドロコレステロール"] }, simpleEnglish: "The cholesterol-synthesis pathway that also suppresses ferroptosis: it supplies CoQ10 for FSP1, and its intermediate 7-dehydrocholesterol accumulates to shield membranes from peroxidation.", precisionNote: "The anti-ferroptotic role of 7-DHC is shown across cell and tumour models; balancing it against normal sterol metabolism and the other defence arms is unresolved.", related: ["fsp1", "coq", "lipid-peroxidation"] },
];

// ---- apply (idempotent) ---------------------------------------------------------------------
const net = readJson("knowledge-network.json");
const glossary = readJson("glossary.json");

const mechIds = new Set(net.mechanisms.map((m) => m.id));
let addedMech = 0;
for (const m of NEW_MECHANISMS) if (!mechIds.has(m.id)) { net.mechanisms.push(m); mechIds.add(m.id); addedMech += 1; }

// retarget the round-10 immune edge onto the more precise system xc- node (idempotent: after the first
// run no edge matches, because the target is already system-xc)
let retargeted = 0;
for (const edge of net.mechanismEdges) {
  if (edge.source === "immune-regulation" && edge.target === "gpx4-gsh") { edge.target = "system-xc"; retargeted += 1; }
}

const edgeKeys = new Set(net.mechanismEdges.map((e) => `${e.source}->${e.target}`));
let addedEdge = 0;
for (const e of NEW_EDGES) {
  const key = `${e.source}->${e.target}`;
  if (!edgeKeys.has(key)) { net.mechanismEdges.push({ ...e, evidence: EDGE_EVIDENCE[key] || [] }); edgeKeys.add(key); addedEdge += 1; }
}

const termIds = new Set(glossary.map((t) => t.id));
let addedTerm = 0;
for (const t of NEW_TERMS) if (!termIds.has(t.id)) { glossary.push(t); termIds.add(t.id); addedTerm += 1; }

writeJson("knowledge-network.json", net);
writeJson("glossary.json", glossary);

console.log(`Round-11 expansion applied:`);
console.log(`  mechanisms: +${addedMech} (now ${net.mechanisms.length})`);
console.log(`  edges: +${addedEdge} new, ${retargeted} retargeted (now ${net.mechanismEdges.length}, all with evidence: ${net.mechanismEdges.every((e) => (e.evidence || []).length)})`);
console.log(`  terms: +${addedTerm} (now ${glossary.length})`);
