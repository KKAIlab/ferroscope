import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (file) => JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8"));
const [labs, labsEn, methods, glossary, network, resources, curated, briefs] = await Promise.all([
  read("labs.json"), read("labs-en.json"), read("methods.json"), read("glossary.json"), read("knowledge-network.json"), read("resources.json"), read("intelligence-curated.json"), read("signal-briefs-en.json")
]);

const errors = [];
const cjk = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u;
const unique = (items, name) => {
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    if (!item.id) errors.push(`${name}[${index}] has no id`);
    if (ids.has(item.id)) errors.push(`${name} has duplicate id: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
};

const labIds = unique(labs, "labs");
const englishLabIds = unique(labsEn, "labs-en");
const methodIds = unique(methods, "methods");
const glossaryIds = unique(glossary, "glossary");
unique(resources, "resources");
const curatedIds = unique(curated, "curated signals");
const briefIds = unique(briefs, "English signal briefs");
const mechanismIds = unique(network.mechanisms || [], "mechanisms");

for (const id of labIds) if (!englishLabIds.has(id)) errors.push(`Missing English lab overlay: ${id}`);
for (const id of englishLabIds) if (!labIds.has(id)) errors.push(`English lab overlay points to unknown lab: ${id}`);
for (const lab of labsEn) {
  for (const field of ["pi", "institution", "region", "focus", "question"]) {
    if (!lab[field]) errors.push(`English lab ${lab.id} is missing ${field}`);
    else if (cjk.test(lab[field])) errors.push(`English lab ${lab.id}.${field} contains CJK narrative text`);
  }
}
for (const method of methods) {
  for (const field of ["name", "group", "evidenceRole", "plainEnglish", "measures", "cannotProve"]) if (!method[field]) errors.push(`Method ${method.id} is missing ${field}`);
  for (const id of method.distinctiveLabs || []) if (!labIds.has(id)) errors.push(`Method ${method.id} points to unknown lab ${id}`);
}
for (const entry of glossary) {
  if (!entry.term || !entry.simpleEnglish || !entry.precisionNote) errors.push(`Glossary ${entry.id} is incomplete`);
  if (!entry.aliases?.en || !entry.aliases?.zh || !entry.aliases?.ja) errors.push(`Glossary ${entry.id} lacks a language alias set`);
  for (const related of entry.related || []) if (!glossaryIds.has(related)) errors.push(`Glossary ${entry.id} points to unknown term ${related}`);
}
for (const edge of network.mechanismEdges || []) {
  if (!mechanismIds.has(edge.source) || !mechanismIds.has(edge.target)) errors.push(`Unknown mechanism in edge ${edge.source} -> ${edge.target}`);
  if (!edge.relation || !edge.confidence) errors.push(`Untyped or unqualified mechanism edge ${edge.source} -> ${edge.target}`);
}
for (const link of network.methodLinks || []) {
  if (!methodIds.has(link.method)) errors.push(`Network points to unknown method ${link.method}`);
  for (const id of link.mechanisms || []) if (!mechanismIds.has(id)) errors.push(`Method link ${link.method} points to unknown mechanism ${id}`);
}
for (const resource of resources) {
  if (!resource.url?.startsWith("https://")) errors.push(`Resource is not HTTPS: ${resource.id}`);
  if (!resource.authority || !resource.caution || !resource.checkedAt) errors.push(`Resource ${resource.id} lacks authority, caution or checkedAt`);
}
for (const id of briefIds) if (!curatedIds.has(id)) errors.push(`English signal brief points to unknown curated signal: ${id}`);
for (const id of curatedIds) if (!briefIds.has(id)) errors.push(`Curated signal has no English brief: ${id}`);

const html = await fs.readFile(path.join(root, "index.html"), "utf8");
if (!html.includes('<html lang="en">')) errors.push("index.html is not declared English");
for (const file of ["methods.json", "glossary.json", "knowledge-network.json", "resources.json", "labs-en.json", "signal-briefs-en.json"]) if (!html.includes("app.js") || !(await fs.stat(path.join(root, "data", file))).isFile()) errors.push(`Missing v0.9 data file: ${file}`);

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`FerroScope v0.9 validation passed: ${labsEn.length} English lab profiles, ${methods.length} methods, ${glossary.length} trilingual terms, ${network.mechanisms.length} mechanism nodes, ${resources.length} external resources and ${briefs.length} English curated briefs.`);
