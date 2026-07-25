// Mutation tests for the cross-file coherence check.
//
// A validator that never fails is indistinguishable from no validator, and the failure is
// silent: the build stays green while the corpus rots. So every rule in
// validate-coherence.mjs is exercised here by breaking the corpus in the specific way that
// rule exists to catch, and asserting the check rejects it.
//
// The mutations run against a throwaway copy of data/ in the system temp directory. The
// repository's own data is never written to.
//
// The last three cases guard the baseline itself. ACKNOWLEDGED_GAPS is a promise that the
// corpus states its absences out loud; if a new node with no method, a new abstract-only
// edge, or the quiet closing of a declared gap could slide past unmentioned, the promise
// would be decorative.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "ferroscope-coherence-"));
fs.mkdirSync(path.join(sandbox, "scripts"));
fs.cpSync(path.join(root, "data"), path.join(sandbox, "data"), { recursive: true });
fs.copyFileSync(path.join(root, "scripts", "validate-coherence.mjs"), path.join(sandbox, "scripts", "validate-coherence.mjs"));
// app.js is part of the sandbox because the coherence check reads the mechanism-graph layout
// table out of it. The table is source, not data, but a mechanism missing from it renders in the
// wrong reasoning-chain band, so it is a cross-file coherence surface like any other.
fs.copyFileSync(path.join(root, "app.js"), path.join(sandbox, "app.js"));

const pristine = new Map();
for (const file of fs.readdirSync(path.join(sandbox, "data"))) {
  pristine.set(file, fs.readFileSync(path.join(sandbox, "data", file), "utf8"));
}
const pristineApp = fs.readFileSync(path.join(sandbox, "app.js"), "utf8");
const restore = () => {
  for (const file of fs.readdirSync(path.join(sandbox, "data"))) {
    if (!pristine.has(file)) fs.unlinkSync(path.join(sandbox, "data", file));
  }
  for (const [file, contents] of pristine) fs.writeFileSync(path.join(sandbox, "data", file), contents);
  fs.writeFileSync(path.join(sandbox, "app.js"), pristineApp);
};
const loadApp = () => fs.readFileSync(path.join(sandbox, "app.js"), "utf8");
const saveApp = (contents) => fs.writeFileSync(path.join(sandbox, "app.js"), contents);
const load = (file) => JSON.parse(fs.readFileSync(path.join(sandbox, "data", file), "utf8"));
const save = (file, value) => fs.writeFileSync(path.join(sandbox, "data", file), JSON.stringify(value, null, 2));
const check = () => {
  try {
    execFileSync("node", [path.join(sandbox, "scripts", "validate-coherence.mjs")], { stdio: "pipe" });
    return { accepted: true, message: "" };
  } catch (error) {
    return { accepted: false, message: (error.stderr?.toString() || "").split("\n")[0] };
  }
};

const cases = [
  ["the unmutated corpus passes", () => {}, true],

  // papers ↔ registry
  ["a paper citing an unregistered source is rejected", () => {
    const papers = load("papers-en.json");
    papers[0].verification.sources[0].sourceId = "crossref-that-was-never-registered";
    save("papers-en.json", papers);
  }, false],
  ["a paper citing an unregistered review event is rejected", () => {
    const papers = load("papers-en.json");
    papers[0].verification.sources[0].reviewEventId = "review-that-never-happened";
    save("papers-en.json", papers);
  }, false],
  ["a review event that reviewed a different source than the paper pairs it with is rejected", () => {
    const papers = load("papers-en.json");
    papers[0].verification.sources[0].reviewEventId = papers[1].verification.sources[0].reviewEventId;
    save("papers-en.json", papers);
  }, false],
  ["a paper advertising a deeper review state than its event recorded is rejected", () => {
    const papers = load("papers-en.json");
    const declared = papers[0].verification.sources.find((source) => source.reviewEventId);
    declared.reviewState = declared.reviewState === "source-checked" ? "independently-rechecked" : "source-checked";
    save("papers-en.json", papers);
  }, false],
  ["an unread source promoted to source-checked with no review event behind it is rejected", () => {
    const papers = load("papers-en.json");
    const paper = papers.find((candidate) => candidate.verification.sources.some((source) => source.reviewState === "recorded-unverified"));
    paper.verification.sources.find((source) => source.reviewState === "recorded-unverified").reviewState = "source-checked";
    save("papers-en.json", papers);
  }, false],
  ["a source handed read scopes but no review event is rejected", () => {
    const reviews = load("source-reviews.json");
    const source = reviews.sources.find((candidate) => (candidate.scopes || []).length === 0);
    source.scopes = [{ id: "forged", label: "forged", surfaceType: "correction-text", accessExtent: "complete-scope", boundary: "never opened" }];
    save("source-reviews.json", reviews);
  }, false],

  // identity
  ["a duplicate DOI in papers-en is rejected", () => {
    const papers = load("papers-en.json");
    papers.push({ ...papers[0], id: "doi:duplicate-entry" });
    save("papers-en.json", papers);
  }, false],
  ["a glossary alias claimed by two entries is rejected", () => {
    const glossary = load("glossary.json");
    glossary[1].aliases.en = [...(glossary[1].aliases.en || []), glossary[0].term];
    save("glossary.json", glossary);
  }, false],

  // attribution
  ["a paper with no laboratory attribution is rejected", () => {
    const papers = load("papers-en.json");
    save("lab-paper-links.json", load("lab-paper-links.json").filter((link) => link.paperId !== papers[0].id));
  }, false],
  ["a second lead laboratory on one paper is rejected", () => {
    const links = load("lab-paper-links.json");
    const lead = links.find((link) => link.role === "lead");
    links.push({ ...lead, labId: links.find((link) => link.labId !== lead.labId).labId });
    save("lab-paper-links.json", links);
  }, false],

  // mechanism layer
  ["a mechanism edge anchoring a DOI outside papers-en is rejected", () => {
    const network = load("knowledge-network.json");
    network.mechanismEdges[0].evidence = ["10.9999/not-in-the-corpus"];
    save("knowledge-network.json", network);
  }, false],
  ["a mechanism edge with no evidence at all is rejected", () => {
    const network = load("knowledge-network.json");
    network.mechanismEdges[0].evidence = [];
    save("knowledge-network.json", network);
  }, false],
  ["a mechanism that appears on no edge is rejected", () => {
    const network = load("knowledge-network.json");
    network.mechanisms.push({ id: "floating-mechanism", label: "Floating", short: "F", description: "attached to nothing" });
    save("knowledge-network.json", network);
  }, false],

  // manifest
  ["a data file schema-versions never registered is rejected", () => {
    fs.writeFileSync(path.join(sandbox, "data", "smuggled.json"), "{}");
  }, false],

  // the baseline itself
  ["a new mechanism with no method, widening the declared silence, is rejected", () => {
    const network = load("knowledge-network.json");
    network.mechanisms.push({ id: "unmethodised", label: "Unmethodised", short: "U", description: "no method reaches it" });
    network.mechanismEdges.push({
      source: "unmethodised", target: "lipid-peroxidation", relation: "drives", label: "undeclared",
      confidence: "strong", evidence: [load("papers-en.json")[0].doi],
    });
    save("knowledge-network.json", network);
  }, false],
  ["closing a declared gap without updating the baseline is rejected", () => {
    const network = load("knowledge-network.json");
    network.methodLinks[0].mechanisms.push("system-xc");
    save("knowledge-network.json", network);
  }, false],
  ["a new abstract-only-anchored edge outside the baseline is rejected", () => {
    const network = load("knowledge-network.json");
    const abstractPaper = load("papers-en.json").find((paper) => paper.readingDepth === "abstract");
    network.mechanismEdges.push({
      source: "immune-regulation", target: "gpx4-gsh", relation: "suppresses", label: "undeclared",
      confidence: "strong", evidence: [abstractPaper.doi],
    });
    save("knowledge-network.json", network);
  }, false],

  // the reasoning-chain layout table in app.js
  //
  // These three exist because an unmapped mechanism does not disappear from the canvas — it is
  // drawn in the "Disease & therapy" band by fallback, stating a position in the causal chain
  // that the project never assigned it. Nothing checked that table before this round.
  ["a mechanism with no declared layout band is rejected", () => {
    // Drop the table's first mapping, whichever mechanism currently holds that slot, so the case
    // keeps testing the rule rather than one node's name.
    saveApp(loadApp().replace(/(const MECHANISM_GROUP = \{\s*\n\s*)"[a-z0-9-]+": "[a-z]+", /, "$1"));
  }, false],
  ["a layout band assigned to an id that is no longer a mechanism is rejected", () => {
    saveApp(loadApp().replace("const MECHANISM_GROUP = {", "const MECHANISM_GROUP = {\n  \"mechanism-that-was-deleted\": \"defence\","));
  }, false],
  ["a renamed layout table fails closed instead of silently skipping the check", () => {
    saveApp(loadApp().replace("const MECHANISM_GROUP = {", "const MECHANISM_LAYOUT_BANDS = {"));
  }, false],
];

let failures = 0;
for (const [name, mutate, shouldAccept] of cases) {
  restore();
  mutate();
  const result = check();
  const correct = result.accepted === shouldAccept;
  if (!correct) failures += 1;
  console.log(`  ${correct ? "ok " : "FAIL"}  ${name}`);
  if (!correct) console.log(`        expected ${shouldAccept ? "pass" : "rejection"}, got ${result.accepted ? "pass" : `rejection: ${result.message}`}`);
}
fs.rmSync(sandbox, { recursive: true, force: true });

if (failures) {
  console.error(`\n${failures} coherence mutation case(s) behaved incorrectly.`);
  process.exit(1);
}
console.log(`\nCoherence mutation tests passed: ${cases.length} cases. Every cross-file rule rejects the break it exists to catch, and the acknowledged-gap baseline cannot be widened, closed or bypassed silently.`);
