import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = ["labs.json", "intelligence-curated.json", "live.json", "meta.json", "watch-queries.json"];
const errors = [];

for (const file of files) {
  try { JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8")); }
  catch (error) { errors.push(`${file}: JSON 无效（${error.message}）`); }
}

const labs = JSON.parse(await fs.readFile(path.join(root, "data/labs.json"), "utf8"));
const curated = JSON.parse(await fs.readFile(path.join(root, "data/intelligence-curated.json"), "utf8"));
const watches = JSON.parse(await fs.readFile(path.join(root, "data/watch-queries.json"), "utf8"));
const allowedCategories = new Set(["core", "methods", "translational", "adjacent"]);
for (const [name, items] of [["labs", labs], ["curated", curated]]) {
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    if (!item.id) errors.push(`${name}[${index}] 缺少 id`);
    if (ids.has(item.id)) errors.push(`${name} 存在重复 id: ${item.id}`);
    ids.add(item.id);
    if (!item.url && !item.website) errors.push(`${name}[${index}] 缺少一手链接`);
  }
}

if (labs.length < 30) errors.push(`全球团队覆盖不足：当前仅 ${labs.length} 个，最低要求 30 个`);
for (const category of allowedCategories) {
  if (!labs.some((lab) => lab.category === category)) errors.push(`缺少团队分类: ${category}`);
}
const representedRegions = new Set(labs.map((lab) => lab.region.split("·")[0].trim()));
if (representedRegions.size < 8) errors.push(`地区覆盖不足：当前仅 ${representedRegions.size} 个国家/地区标签，最低要求 8 个`);
for (const lab of labs) {
  if (!allowedCategories.has(lab.category)) errors.push(`团队分类无效: ${lab.id} -> ${lab.category}`);
  if (!lab.website?.startsWith("https://")) errors.push(`团队官网不是 HTTPS: ${lab.id}`);
  if (!lab.region || !lab.focus || !lab.institution) errors.push(`团队信息不完整: ${lab.id}`);
}

const labIds = new Set(labs.map((lab) => lab.id));
for (const watch of watches) {
  if (!labIds.has(watch.labId)) errors.push(`watch-queries 指向不存在的团队: ${watch.labId}`);
  if (!watch.query?.includes("[Author]")) errors.push(`watch-queries 缺少作者限定: ${watch.labId}`);
}

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`数据检查通过：${labs.length} 个团队，${representedRegions.size} 个国家/地区标签，${watches.length} 个定向监控，${curated.length} 条人工精选信号。`);
