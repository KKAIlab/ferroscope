// Mutation tests for the dataset manifest.
//
// The manifest used to claim that a dataset could not enter the site without an owner
// while storing no owner at all, and a review date could stay fresh while the reviewed
// file changed underneath it. Asserting that the current manifest passes would not prove
// either gate works. These tests break the manifest on purpose, in a throwaway copy of
// the repository, and require the validator to reject each break.
//
// The first case runs the seal step and requires a clean pass, so the suite also proves
// that a correctly sealed manifest is reachable rather than permanently red.

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const passes = [];

async function makeCopy() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ferroscope-manifest-"));
  for (const entry of ["data", "lib", "scripts"]) {
    await fs.cp(path.join(root, entry), path.join(dir, entry), { recursive: true });
  }
  await fs.cp(path.join(root, "index.html"), path.join(dir, "index.html"));
  return dir;
}

const run = (dir, script, args = []) => spawnSync(process.execPath, [path.join(dir, "scripts", script), ...args], { encoding: "utf8" });
const REVIEWER = "independent-review-codex";

const readManifest = async (dir) => JSON.parse(await fs.readFile(path.join(dir, "data", "schema-versions.json"), "utf8"));
const writeManifest = async (dir, manifest) => fs.writeFile(path.join(dir, "data", "schema-versions.json"), `${JSON.stringify(manifest, null, 2)}\n`);

// Each case mutates a sealed copy and states which failure it expects to see.
async function check(name, { seal = true, mutate, expectExit, expectMessage }) {
  const dir = await makeCopy();
  try {
    if (seal) {
      const sealed = run(dir, "seal-manifest.mjs", [`--reviewer=${REVIEWER}`, "--date=2026-07-23"]);
      if (sealed.status !== 0) throw new Error(`the seal step itself failed: ${sealed.stderr || sealed.stdout}`);
    }
    if (mutate) await mutate(dir);
    const result = run(dir, "validate-v09.mjs");
    const output = `${result.stdout}\n${result.stderr}`;
    if (expectExit === 0 && result.status !== 0) throw new Error(`expected a clean pass, got exit ${result.status}:\n${output}`);
    if (expectExit !== 0 && result.status === 0) throw new Error(`expected the validator to reject this, but it passed:\n${output}`);
    if (expectMessage && !expectMessage.test(output)) throw new Error(`the rejection did not name the problem. Expected ${expectMessage}, got:\n${output}`);
    passes.push(name);
  } catch (error) {
    failures.push({ name, message: error.message });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

await check("the repository as shipped passes validation with every dataset marked pending review", {
  seal: false,
  expectExit: 0,
});

await check("a manifest sealed by an independent reviewer passes validation", {
  expectExit: 0,
});

await check("a dataset awaiting review may not carry a review fingerprint", {
  seal: false,
  mutate: async (dir) => {
    const manifest = await readManifest(dir);
    manifest.files["glossary.json"].reviewedContentSha256 = "0".repeat(64);
    await writeManifest(dir, manifest);
  },
  expectExit: 1,
  expectMessage: /awaiting review but records a review fingerprint/,
});

await check("sealing without naming a reviewer is refused", {
  seal: false,
  mutate: async (dir) => {
    const attempt = run(dir, "seal-manifest.mjs");
    if (attempt.status === 0) throw new Error("the seal step accepted an anonymous review");
    if (!/has to name its reviewer/.test(attempt.stderr)) throw new Error(`the refusal did not explain itself: ${attempt.stderr}`);
  },
  expectExit: 0,
});

await check("a dataset with no owner is rejected", {
  mutate: async (dir) => {
    const manifest = await readManifest(dir);
    delete manifest.files["papers-en.json"].owner;
    await writeManifest(dir, manifest);
  },
  expectExit: 1,
  expectMessage: /papers-en\.json has no owner/,
});

await check("an owner that is not a declared party is rejected", {
  mutate: async (dir) => {
    const manifest = await readManifest(dir);
    manifest.files["papers-en.json"].owner = "somebody-not-listed";
    await writeManifest(dir, manifest);
  },
  expectExit: 1,
  expectMessage: /names an owner that is not declared/,
});

await check("a curated file that changed after review is rejected", {
  mutate: async (dir) => {
    const file = path.join(dir, "data", "glossary.json");
    const glossary = JSON.parse(await fs.readFile(file, "utf8"));
    glossary[0].simpleEnglish = `${glossary[0].simpleEnglish} An edit nobody reviewed.`;
    await fs.writeFile(file, `${JSON.stringify(glossary, null, 2)}\n`);
  },
  expectExit: 1,
  expectMessage: /glossary\.json changed since it was reviewed/,
});

await check("a named review with no fingerprint behind it is rejected", {
  mutate: async (dir) => {
    const manifest = await readManifest(dir);
    manifest.files["glossary.json"].reviewedContentSha256 = null;
    await writeManifest(dir, manifest);
  },
  expectExit: 1,
  expectMessage: /names a reviewer but records no review fingerprint/,
});

await check("a curated file with no fingerprint field at all is rejected", {
  mutate: async (dir) => {
    const manifest = await readManifest(dir);
    delete manifest.files["glossary.json"].reviewedContentSha256;
    await writeManifest(dir, manifest);
  },
  expectExit: 1,
  expectMessage: /declares no reviewedContentSha256/,
});

await check("a generated file may not claim a human reviewer", {
  mutate: async (dir) => {
    const manifest = await readManifest(dir);
    manifest.files["live.json"].reviewer = "independent-review-codex";
    manifest.files["live.json"].reviewedAt = "2026-07-23";
    await writeManifest(dir, manifest);
  },
  expectExit: 1,
  expectMessage: /is generated and must not claim a reviewer/,
});

await check("a curated file reviewed by its own owner is rejected", {
  mutate: async (dir) => {
    const manifest = await readManifest(dir);
    manifest.files["glossary.json"].reviewer = manifest.files["glossary.json"].owner;
    await writeManifest(dir, manifest);
  },
  expectExit: 1,
  expectMessage: /same party as owner and reviewer/,
});

await check("a curated file with neither a reviewer nor a pending flag is rejected", {
  mutate: async (dir) => {
    const manifest = await readManifest(dir);
    manifest.files["glossary.json"].reviewer = null;
    await writeManifest(dir, manifest);
  },
  expectExit: 1,
  expectMessage: /does not declare reviewPending/,
});

await check("an unregistered data file cannot reach the site", {
  mutate: async (dir) => {
    await fs.writeFile(path.join(dir, "data", "smuggled.json"), "[]\n");
  },
  expectExit: 1,
  expectMessage: /Unregistered data file: smuggled\.json/,
});

await check("a registered file that is missing from disk is rejected", {
  mutate: async (dir) => {
    await fs.rm(path.join(dir, "data", "lab-research-audits.json"));
  },
  expectExit: 1,
  expectMessage: /registers a missing data file: lab-research-audits\.json/,
});

await check("a generated file written by an older generator is rejected", {
  mutate: async (dir) => {
    const manifest = await readManifest(dir);
    manifest.files["meta.json"].generatorVersion = "9.9.9";
    await writeManifest(dir, manifest);
  },
  expectExit: 1,
  expectMessage: /written by generator version .* but the manifest declares 9\.9\.9/,
});

await check("a generated file naming a generator that does not exist is rejected", {
  mutate: async (dir) => {
    const manifest = await readManifest(dir);
    manifest.files["live.json"].generator = "scripts/does-not-exist.mjs";
    await writeManifest(dir, manifest);
  },
  expectExit: 1,
  expectMessage: /names a generator that does not exist/,
});

for (const failure of failures) console.error(`FAIL ${failure.name}\n      ${failure.message}`);
if (failures.length) {
  console.error(`\n${failures.length} of ${failures.length + passes.length} manifest mutation tests failed.`);
  process.exit(1);
}
console.log(`Manifest mutation tests passed: ${passes.length} cases, including a clean pass after sealing and a rejection for every way a dataset could claim a review it did not have.`);
