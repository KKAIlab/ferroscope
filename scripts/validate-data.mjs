import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = ["labs.json", "intelligence-curated.json", "live.json", "meta.json", "watch-queries.json", "lab-research-audits.json", "lab-research.json"];
const errors = [];

for (const file of files) {
  try { JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8")); }
  catch (error) { errors.push(`${file}: invalid JSON (${error.message})`); }
}

const labs = JSON.parse(await fs.readFile(path.join(root, "data/labs.json"), "utf8"));
const curated = JSON.parse(await fs.readFile(path.join(root, "data/intelligence-curated.json"), "utf8"));
const watches = JSON.parse(await fs.readFile(path.join(root, "data/watch-queries.json"), "utf8"));
const meta = JSON.parse(await fs.readFile(path.join(root, "data/meta.json"), "utf8"));
const allowedCategories = new Set(["core", "methods", "translational", "adjacent"]);
for (const [name, items] of [["labs", labs], ["curated", curated]]) {
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    if (!item.id) errors.push(`${name}[${index}] has no id`);
    if (ids.has(item.id)) errors.push(`${name} has a duplicate id: ${item.id}`);
    ids.add(item.id);
    if (!item.url && !item.website) errors.push(`${name}[${index}] has no primary-source link`);
  }
}

if (labs.length < 30) errors.push(`Laboratory coverage is too small: ${labs.length} records, minimum 30`);
for (const category of allowedCategories) {
  if (!labs.some((lab) => lab.category === category)) errors.push(`No laboratory carries the category: ${category}`);
}
const representedRegions = new Set(labs.map((lab) => lab.region.split("·")[0].trim()));
if (representedRegions.size < 8) errors.push(`Regional coverage is too narrow: ${representedRegions.size} country or region labels, minimum 8`);
for (const lab of labs) {
  if (!allowedCategories.has(lab.category)) errors.push(`Invalid laboratory category: ${lab.id} -> ${lab.category}`);
  if (!lab.website?.startsWith("https://")) errors.push(`Laboratory website is not HTTPS: ${lab.id}`);
  if (!lab.region || !lab.focus || !lab.institution) errors.push(`Incomplete laboratory record: ${lab.id}`);
}

const requiredLiveSources = ["Tracked labs / PubMed", "PubMed", "Preprints / Crossref", "ClinicalTrials.gov"];
for (const sourceName of requiredLiveSources) {
  const source = meta.sources?.find((item) => item.name === sourceName);
  if (!source) errors.push(`Live source is missing from meta.json: ${sourceName}`);
  else if (!source.ok) errors.push(`Live source reported a failure: ${sourceName} (${source.note || "no error detail"})`);
}

const labIds = new Set(labs.map((lab) => lab.id));
for (const watch of watches) {
  if (!labIds.has(watch.labId)) errors.push(`watch-queries points to an unknown laboratory: ${watch.labId}`);
  if (!watch.query?.includes("[Author]")) errors.push(`watch-queries has no author restriction: ${watch.labId}`);
}

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`Data check passed: ${labs.length} laboratories, ${representedRegions.size} country or region labels, ${watches.length} author watches and ${curated.length} curated signals.`);
