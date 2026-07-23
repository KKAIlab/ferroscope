// Records an independent review in data/schema-versions.json.
//
// Sealing is the act of saying: a named party other than the owner read these exact
// bytes. It writes the reviewer, the review date and a sha256 of the file, after which
// any later edit fails validation until the file is reviewed again. Running this to make
// a red check go green is the one use that defeats the whole mechanism.
//
//   npm run seal -- --reviewer=independent-review-codex                 (every pending dataset)
//   npm run seal -- --reviewer=independent-review-codex papers-en.json  (named datasets only)

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const manifestPath = path.join(dataDir, "schema-versions.json");

const args = process.argv.slice(2);
// Split on the first "=" only, so a value that contains one survives intact.
const optionValue = (prefix) => {
  const argument = args.find((entry) => entry.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : "";
};
const reviewer = optionValue("--reviewer=");
const requested = args.filter((argument) => !argument.startsWith("--"));
const reviewedAt = optionValue("--date=") || new Date().toISOString().slice(0, 10);

if (!reviewer) {
  console.error("A review has to name its reviewer.\n\n  npm run seal -- --reviewer=<owner-id> [files...]\n\nDeclared reviewers are the keys of \"owners\" in data/schema-versions.json.");
  process.exit(1);
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
if (!Object.keys(manifest.owners || {}).includes(reviewer)) {
  console.error(`"${reviewer}" is not declared in manifest.owners. Add the party there first, so a reviewer is a known accountable name rather than a free-text string.`);
  process.exit(1);
}

const digestOf = async (file) => crypto.createHash("sha256").update(await fs.readFile(path.join(dataDir, file))).digest("hex");

const targets = Object.entries(manifest.files).filter(([file, entry]) => {
  if (entry.maintenance === "generated" || entry.selfDescribing === true) return false;
  return requested.length ? requested.includes(file) : true;
});

const unknown = requested.filter((file) => !targets.some(([name]) => name === file));
if (unknown.length) {
  console.error(`Not a sealable dataset: ${unknown.join(", ")}. Generated files and the manifest itself cannot be sealed.`);
  process.exit(1);
}

const changes = [];
for (const [file, entry] of targets) {
  if (entry.owner === reviewer) {
    console.error(`${file} is owned by ${reviewer}; a review has to be independent of the owner.`);
    process.exit(1);
  }
  const actual = await digestOf(file);
  if (entry.reviewer === reviewer && entry.reviewedContentSha256 === actual) continue;
  changes.push({ file, from: entry.reviewedContentSha256, to: actual, previousReviewer: entry.reviewer });
  entry.reviewer = reviewer;
  entry.reviewedAt = reviewedAt;
  entry.reviewedContentSha256 = actual;
  delete entry.reviewPending;
}

if (!changes.length) {
  console.log(`Nothing to record: every requested dataset already carries a ${reviewer} review of its current bytes.`);
  process.exit(0);
}

await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
for (const change of changes) {
  const previous = change.from ? `${change.from.slice(0, 12)}…` : change.previousReviewer ? "no fingerprint" : "awaiting review";
  console.log(`recorded ${reviewer} review of ${change.file}: ${previous} -> ${change.to.slice(0, 12)}…`);
}
console.log(`\n${changes.length} ${changes.length === 1 ? "review" : "reviews"} recorded on ${reviewedAt}. Read the diff before committing: every line asserts that ${reviewer} read those exact bytes.`);
