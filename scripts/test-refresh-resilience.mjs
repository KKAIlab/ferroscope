// Refresh-resilience fixtures.
//
// The scheduled refresh commits fresh data only when scripts/validate-data.mjs (and the
// public-surface test) pass, so what that validator accepts and rejects decides whether
// the site keeps updating. Two failure classes have frozen the site before: a contract
// that rejected a state the generator can legitimately produce (a hard-failed source),
// and a record shape the generator could emit but the contract refused (an undated
// record). Each case here runs the real validator, as a child process, against a
// mutated copy of the real data directory — the same way CI runs it against a fresh
// fetch — and pins down which states are publishable and which must still fail.

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cases = [];
const test = (name, ok, detail = "") => cases.push({ name, ok, detail });

// validate-data resolves its data directory relative to its own location, so the
// fixture reproduces the layout it expects: <dir>/scripts/validate-data.mjs,
// <dir>/lib/records.mjs, <dir>/data/*.json.
async function scaffold() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ferroscope-resilience-"));
  await fs.cp(path.join(root, "data"), path.join(dir, "data"), { recursive: true });
  await fs.cp(path.join(root, "lib"), path.join(dir, "lib"), { recursive: true });
  await fs.mkdir(path.join(dir, "scripts"));
  await fs.copyFile(path.join(root, "scripts", "validate-data.mjs"), path.join(dir, "scripts", "validate-data.mjs"));
  return dir;
}

function runValidator(dir) {
  return spawnSync(process.execPath, [path.join(dir, "scripts", "validate-data.mjs")], { encoding: "utf8" });
}

async function readData(dir, file) {
  return JSON.parse(await fs.readFile(path.join(dir, "data", file), "utf8"));
}

async function writeData(dir, file, value) {
  await fs.writeFile(path.join(dir, "data", file), `${JSON.stringify(value, null, 2)}\n`);
}

// ------------------------------------------------------------------ baseline

{
  const dir = await scaffold();
  const result = runValidator(dir);
  test("the repository's committed data passes the validator in the fixture layout", result.status === 0, result.stderr);
  await fs.rm(dir, { recursive: true, force: true });
}

// ------------------------------------------- a hard-failed source is publishable

// A source whose retained records passed the 14-day limit publishes nothing and a
// "failed" status row. That state must validate: rejecting it froze every OTHER
// source's updates too, and hid the failure behind a stale "ok" on the live site.
{
  const dir = await scaffold();
  const meta = await readData(dir, "meta.json");
  const failedAt = meta.generatedAt;
  const row = meta.sources.find((source) => source.name === "ClinicalTrials.gov");
  Object.assign(row, {
    ok: false,
    state: "failed",
    lastSuccessAt: "2026-06-01T00:00:00.000Z",
    lastAttemptAt: failedAt,
    retainedItems: 0,
    retainedAgeDays: null,
    errorClass: "http-server-error",
    note: "This source failed (http-server-error) and no retained records are within the 14-day limit, so nothing from it is published.",
  });
  await writeData(dir, "meta.json", meta);
  const live = await readData(dir, "live.json");
  await writeData(dir, "live.json", live.filter((item) => item.sourceName !== "ClinicalTrials.gov"));
  const result = runValidator(dir);
  test("a hard-failed source with no records is publishable rather than freezing the refresh", result.status === 0, result.stderr);
  test("the hard failure is reported on the way through", /Hard-failed sources published/.test(result.stderr + result.stdout), result.stderr);
  await fs.rm(dir, { recursive: true, force: true });
}

// ------------------------------------- but a failure must still be classified

{
  const dir = await scaffold();
  const meta = await readData(dir, "meta.json");
  const row = meta.sources.find((source) => source.name === "ClinicalTrials.gov");
  Object.assign(row, { ok: false, state: "failed", lastAttemptAt: meta.generatedAt, retainedItems: 0, errorClass: null, note: null });
  await writeData(dir, "meta.json", meta);
  const live = await readData(dir, "live.json");
  await writeData(dir, "live.json", live.filter((item) => item.sourceName !== "ClinicalTrials.gov"));
  const result = runValidator(dir);
  test("a failed source without an errorClass and note is rejected", result.status === 1, result.stdout);
  test("the rejection names the missing classification", /errorClass/.test(result.stderr) && /note/.test(result.stderr), result.stderr);
  await fs.rm(dir, { recursive: true, force: true });
}

// -------------------------------------------------- bad records must still fail

// The generator drops undated and impossible-dated records before publishing, so these
// contracts are unreachable in a healthy pipeline — they exist to catch a generator
// regression before it is committed, not to be tolerated.
{
  const dir = await scaffold();
  const live = await readData(dir, "live.json");
  const clone = JSON.parse(JSON.stringify(live[0]));
  clone.id = "pubmed-99999999";
  clone.pmid = "99999999";
  clone.doi = undefined;
  clone.url = "https://pubmed.ncbi.nlm.nih.gov/99999999/";
  clone.canonicalId = "pmid:99999999";
  clone.canonicalIdKind = "pmid";
  clone.date = null;
  if (clone.sources?.[0]) clone.sources[0].recordId = clone.id;
  await writeData(dir, "live.json", [clone, ...live]);
  const result = runValidator(dir);
  test("an undated record is still rejected by the published contract", result.status === 1, result.stdout);
  await fs.rm(dir, { recursive: true, force: true });
}

{
  const dir = await scaffold();
  const live = await readData(dir, "live.json");
  live[0].date = "2026-02-31";
  await writeData(dir, "live.json", live);
  const result = runValidator(dir);
  test("an ISO-shaped but impossible date is rejected", result.status === 1, result.stdout);
  test("the rejection names the impossible day", /impossible day/.test(result.stderr), result.stderr);
  await fs.rm(dir, { recursive: true, force: true });
}

// ------------------------------------------------- structural meta contracts hold

{
  const dir = await scaffold();
  const meta = await readData(dir, "meta.json");
  meta.sources = meta.sources.filter((source) => source.name !== "PubMed");
  await writeData(dir, "meta.json", meta);
  const result = runValidator(dir);
  test("a missing required source row is still rejected", result.status === 1, result.stdout);
  await fs.rm(dir, { recursive: true, force: true });
}

{
  const dir = await scaffold();
  const meta = await readData(dir, "meta.json");
  meta.generatorVersion = "0.0.1";
  await writeData(dir, "meta.json", meta);
  const result = runValidator(dir);
  test("a generator version the manifest does not declare is rejected", result.status === 1, result.stdout);
  await fs.rm(dir, { recursive: true, force: true });
}

{
  const dir = await scaffold();
  const meta = await readData(dir, "meta.json");
  meta.generatedAt = "2099-01-01T00:00:00.000Z";
  await writeData(dir, "meta.json", meta);
  const result = runValidator(dir);
  test("a generation timestamp from the future is rejected", result.status === 1, result.stdout);
  await fs.rm(dir, { recursive: true, force: true });
}

// ----------------------------------------------------------------------- report

const failures = cases.filter((entry) => !entry.ok);
for (const entry of cases) console.log(` ${entry.ok ? " ok " : "FAIL"}  ${entry.name}`);
for (const failure of failures) console.error(`\nFAIL ${failure.name}\n${failure.detail}`);
if (failures.length) {
  console.error(`\n${failures.length} of ${cases.length} refresh-resilience cases failed.`);
  process.exit(1);
}
console.log(`\nRefresh-resilience fixtures passed: ${cases.length} cases. A hard-failed source publishes its failure instead of freezing the refresh; undated, impossible-dated and misdeclared datasets still fail before they can be committed.`);
