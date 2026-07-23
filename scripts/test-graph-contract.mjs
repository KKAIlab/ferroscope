// Graph provenance contract tests (P1-B, P1-C).
//
// The previous contract let `checkedAt: null` pass silently, so all 37 method-to-mechanism
// edges sat in the graph with no paper and no check date, indistinguishable from a claim
// read out of an audited figure. These are the negative cases: each one asserts that an
// edge which understates what is known about it is *rejected*, not merely rendered with a
// quieter label.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EDGE_PROVENANCE_CLASSES, EDGE_REVIEW_STATES, buildGraph, checkEdgeContract } from "../lib/graph.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (file) => JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8"));

const cases = [];
const test = (name, run) => {
  try {
    run();
    cases.push({ name, ok: true });
  } catch (error) {
    cases.push({ name, ok: false, message: error.message });
  }
};

const [papers, labs, labsEn, links, methods, network, claims] = await Promise.all([
  read("papers-en.json"), read("labs.json"), read("labs-en.json"), read("lab-paper-links.json"),
  read("methods.json"), read("knowledge-network.json"), read("paper-claims.json"),
]);
const inputs = { papers, labs, labsEn, links, methods, network, claims };
const graph = buildGraph(inputs);

// A method-module edge exactly as the builder emits it: no paper, no check date, and an
// explicit provisional review state.
const methodEdge = graph.edges.find((edge) => edge.provenanceClass === "curated-method-module");

// ---------------------------------------------------------------- the required case

test("an unchecked method edge without a provisional review state is rejected", () => {
  const silent = { ...methodEdge, reviewState: undefined };
  const problems = checkEdgeContract(silent, "fixture");
  assert.ok(problems.length > 0, "an edge with no review state must not pass");
  assert.ok(
    problems.some((problem) => /pending-source-review/.test(problem)),
    `the rejection must name the missing provisional state; got: ${problems.join(" | ")}`,
  );
});

test("an unchecked method edge cannot claim it was source-checked", () => {
  const overclaim = { ...methodEdge, reviewState: "source-checked" };
  const problems = checkEdgeContract(overclaim, "fixture");
  assert.ok(problems.length > 0, "a null check date with a source-checked state must not pass");
});

test("a provisional edge must say what has not been read yet", () => {
  const mute = { ...methodEdge, reviewPendingReason: null };
  assert.ok(checkEdgeContract(mute, "fixture").some((problem) => /has not been read/.test(problem)));
});

test("a review state outside the vocabulary is rejected rather than treated as pending", () => {
  for (const value of ["unreviewed", "", null, "SOURCE-CHECKED"]) {
    assert.ok(checkEdgeContract({ ...methodEdge, reviewState: value }, "fixture").length > 0, `reviewState ${JSON.stringify(value)} must be rejected`);
  }
});

// ------------------------------------------------------------ provenance separation

test("a curated method-module edge may not claim a paper as its backing", () => {
  const borrowed = { ...methodEdge, paperId: "doi:10.1038/nchembio.2238" };
  assert.ok(checkEdgeContract(borrowed, "fixture").some((problem) => /must not claim a paper/.test(problem)));
});

test("an edge classed as paper-backed must name the paper it was read from", () => {
  const orphan = { ...methodEdge, provenanceClass: "paper-backed-experimental" };
  assert.ok(checkEdgeContract(orphan, "fixture").some((problem) => /must name the paper/.test(problem)));
});

test("an edge with no provenance class is rejected", () => {
  assert.ok(checkEdgeContract({ ...methodEdge, provenanceClass: undefined }, "fixture").length > 0);
});

test("a check date that is not an ISO date is rejected on both sides of the contract", () => {
  assert.ok(checkEdgeContract({ ...methodEdge, checkedAt: "soon", reviewState: "source-checked" }, "fixture").length > 0);
  assert.ok(checkEdgeContract({ ...methodEdge, checkedAt: "2026-07", reviewState: "source-checked" }, "fixture").length > 0);
});

// ------------------------------------------------------------------ builder behaviour

test("the builder refuses a method link whose checkedAt is malformed rather than downgrading it", () => {
  const damaged = structuredClone(network);
  damaged.methodLinks[0].checkedAt = "soon";
  assert.throws(
    () => buildGraph({ ...inputs, network: damaged }),
    /checkedAt must be an ISO date/,
    "a malformed date must be a build failure, not a silent demotion to provisional",
  );
});

test("a method link that records an ISO check date is promoted to source-checked", () => {
  const dated = structuredClone(network);
  dated.methodLinks[0].checkedAt = "2026-07-24";
  const rebuilt = buildGraph({ ...inputs, network: dated });
  const promoted = rebuilt.edges.filter((edge) => edge.provenanceClass === "curated-method-module" && edge.reviewState === "source-checked");
  assert.ok(promoted.length > 0, "recording a check date must move the edge out of the provisional state");
  assert.ok(promoted.every((edge) => edge.checkedAt === "2026-07-24"));
  assert.ok(promoted.every((edge) => edge.verificationDepth === "metadata-checked"));
});

// -------------------------------------------------------------- the shipped graph

test("every edge in the shipped graph satisfies the contract", () => {
  const problems = graph.edges.flatMap((edge, index) => checkEdgeContract(edge, `edge[${index}]`));
  assert.deepEqual(problems, []);
});

test("every method-module edge is visibly provisional and paperless", () => {
  const moduleEdges = graph.edges.filter((edge) => edge.provenanceClass === "curated-method-module");
  assert.equal(moduleEdges.length, 74, "the 16 method modules contribute a MEASURES and a CANNOT_DISTINGUISH edge per mechanism link");
  for (const edge of moduleEdges) {
    assert.equal(edge.paperId, null);
    assert.equal(edge.checkedAt, null);
    assert.equal(edge.reviewState, "pending-source-review");
    assert.equal(edge.verificationDepth, "curated-unverified");
    assert.ok(edge.reviewPendingReason, "a provisional edge must state what has not been read");
  }
});

test("the graph names a generator that exists on disk", async () => {
  assert.equal(graph.generator, "lib/graph.mjs");
});

test("the zero-count CONTRADICTS relation stays visible in the counts", () => {
  assert.equal(graph.counts.byRelation.CONTRADICTS, 0);
  assert.ok("CONTRADICTS" in graph.counts.byRelation, "a relation with no instances is a fact about the corpus, not a row to omit");
});

test("provenance and review counts add up to the edge total", () => {
  const provenanceTotal = EDGE_PROVENANCE_CLASSES.reduce((total, value) => total + graph.counts.byProvenanceClass[value], 0);
  const reviewTotal = EDGE_REVIEW_STATES.reduce((total, value) => total + graph.counts.byReviewState[value], 0);
  assert.equal(provenanceTotal, graph.counts.edges);
  assert.equal(reviewTotal, graph.counts.edges);
});

const generatorExists = await fs.stat(path.join(root, graph.generator)).then((entry) => entry.isFile()).catch(() => false);
test("the declared generator resolves to a real file", () => {
  assert.ok(generatorExists, `${graph.generator} does not exist on disk`);
});

// ----------------------------------------------------------------------- reporting

const failures = cases.filter((entry) => !entry.ok);
for (const failure of failures) console.error(`FAIL ${failure.name}\n      ${failure.message}`);
if (failures.length) {
  console.error(`\n${failures.length} of ${cases.length} graph contract cases failed.`);
  process.exit(1);
}
console.log(
  `Graph contract tests passed: ${cases.length} cases. ` +
    `${graph.counts.byReviewState["source-checked"]} edges name a check date, ` +
    `${graph.counts.byReviewState["pending-source-review"]} declare that their source is still unread, ` +
    `and an unchecked edge without that declaration is rejected.`,
);
