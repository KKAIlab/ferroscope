// Graph provenance contract tests (P0-A, P0-B).
//
// The previous version of this file asserted that setting `methodLinks[0].checkedAt` to
// today's date promoted a method edge to source-checked. That encoded the defect as a
// desired behaviour: a date says when something happened, never what was read. Every case
// below is the negative form — an edge or a record that claims more review than it can
// account for is *rejected*, not quietly rendered with a softer label.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EDGE_PROVENANCE_CLASSES,
  EDGE_REVIEW_STATES,
  VERIFICATION_DEPTHS,
  buildGraph,
  checkEdgeContract,
  checkReviewRecord,
  isSourceChecked,
} from "../lib/graph.mjs";

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

const methodEdge = graph.edges.find((edge) => edge.provenanceClass === "curated-method-module");
const checkedEdge = graph.edges.find((edge) => edge.reviewState === "source-checked");
const KAGAN = "doi:10.1038/nchembio.2238";

// ------------------------------------------------------- P0-A: a date is not a promotion

test("a date alone never promotes a review record", () => {
  const dated = {
    reviewState: "source-checked",
    verificationDepth: "full-text-rechecked",
    checkedAt: "2026-07-24",
    scope: [],
  };
  const problems = checkReviewRecord(dated, "fixture");
  assert.ok(problems.length > 0, "a record carrying only a date must not pass as source-checked");
  assert.ok(problems.some((problem) => /a date is not a scope/.test(problem)), problems.join(" | "));
  assert.ok(problems.some((problem) => /must name who read the source/.test(problem)), problems.join(" | "));
});

test("a URL alone never promotes a review record", () => {
  const linked = {
    reviewState: "source-checked",
    verificationDepth: "methods-checked",
    sourceUrl: "https://doi.org/10.1038/nchembio.2238",
    checkedAt: null,
    scope: [],
  };
  const problems = checkReviewRecord(linked, "fixture");
  assert.ok(problems.some((problem) => /must name the ISO date/.test(problem)), problems.join(" | "));
  assert.ok(problems.some((problem) => /a date is not a scope/.test(problem)), problems.join(" | "));
});

test("a record that opened nothing may not call itself source-checked however deep it claims to be", () => {
  for (const depth of ["not-read", "curated-unverified", "archive-derived"]) {
    const problems = checkReviewRecord({
      reviewState: "source-checked",
      verificationDepth: depth,
      checkedAt: "2026-07-24",
      checkedBy: "somebody",
      sourceUrl: "https://example.org/x",
      sourceVersion: "v1",
      scope: ["Fig. 1"],
      boundary: "none",
    }, "fixture");
    assert.ok(problems.some((problem) => /no external document was opened/.test(problem)), `${depth}: ${problems.join(" | ")}`);
  }
});

test("an unread record may not accumulate a scope it never earned", () => {
  const problems = checkReviewRecord({
    reviewState: "archive-derived",
    verificationDepth: "archive-derived",
    checkedAt: "2026-07-24",
    scope: ["Fig. 1", "Methods"],
  }, "fixture");
  assert.ok(problems.some((problem) => /may not declare a read scope/.test(problem)), problems.join(" | "));
});

test("an archive-derived record cannot be deepened by a migration date", () => {
  const problems = checkReviewRecord({
    reviewState: "archive-derived",
    verificationDepth: "methods-checked",
    checkedAt: "2026-07-24",
    scope: [],
  }, "fixture");
  assert.ok(problems.some((problem) => /must sit at archive-derived depth/.test(problem)), problems.join(" | "));
});

// ----------------------------------------------------------- P0-A: the edge-level mirror

test("a source-checked edge that names no scope entry is rejected", () => {
  const problems = checkEdgeContract({ ...checkedEdge, scopeRef: null }, "fixture");
  assert.ok(problems.some((problem) => /must name the scope entry/.test(problem)), problems.join(" | "));
});

test("a source-checked edge with no reader or pinned version is rejected", () => {
  assert.ok(checkEdgeContract({ ...checkedEdge, checkedBy: null }, "fixture").some((problem) => /must name who read/.test(problem)));
  assert.ok(checkEdgeContract({ ...checkedEdge, sourceVersion: null }, "fixture").some((problem) => /pinned version/.test(problem)));
  assert.ok(checkEdgeContract({ ...checkedEdge, checkedAt: null }, "fixture").some((problem) => /must carry the ISO date/.test(problem)));
});

test("an edge may not claim a deeper state than the record it came from", () => {
  const overrun = { ...methodEdge, reviewState: "source-checked", checkedAt: "2026-07-24", checkedBy: "x", sourceVersion: "v", scopeRef: "Fig. 1", verificationDepth: "methods-checked" };
  const problems = checkEdgeContract(overrun, "fixture");
  assert.ok(problems.some((problem) => /from a source record that is only/.test(problem)), problems.join(" | "));
  assert.ok(problems.some((problem) => /read only to/.test(problem)), problems.join(" | "));
});

test("an edge that is not source-checked may not name a read scope", () => {
  assert.ok(checkEdgeContract({ ...methodEdge, scopeRef: "Fig. 1" }, "fixture").some((problem) => /may not name a read scope/.test(problem)));
});

test("an edge that is not source-checked must say what has not been read", () => {
  assert.ok(checkEdgeContract({ ...methodEdge, reviewPendingReason: null }, "fixture").some((problem) => /has not been read/.test(problem)));
});

test("a review state or depth outside the vocabulary is rejected rather than treated as pending", () => {
  for (const value of ["pending-source-review", "unreviewed", "", null, "SOURCE-CHECKED"]) {
    assert.ok(checkEdgeContract({ ...methodEdge, reviewState: value }, "fixture").length > 0, `reviewState ${JSON.stringify(value)} must be rejected`);
  }
  for (const value of ["read", "", null]) {
    assert.ok(checkEdgeContract({ ...methodEdge, verificationDepth: value }, "fixture").length > 0, `verificationDepth ${JSON.stringify(value)} must be rejected`);
  }
});

// -------------------------------------------------------------- P0-A: scope containment

test("a claim that declares a scope no reviewer recorded fails the build", () => {
  const mismatched = structuredClone(claims);
  mismatched.claims.find((claim) => claim.id === "claim-oxpe-species").review = { scopeRef: "Fig. 9" };
  assert.throws(
    () => buildGraph({ ...inputs, claims: mismatched }),
    /no source-checked record covers it/,
    "a scope entry nobody recorded must fail loudly rather than silently demote",
  );
});

test("a genuinely checked figure promotes only the claims that figure covers", () => {
  // Narrow the Kagan review record to Fig. 3 alone. Every claim and figure whose scopeRef
  // is not Fig. 3 must therefore drop back to the paper's archive-derived baseline — which
  // means removing their now-uncovered scopeRef declarations, exactly as a real narrowing
  // of the read scope would.
  const narrowed = structuredClone(papers);
  const paper = narrowed.find((entry) => entry.id === KAGAN);
  const manuscript = paper.verification.sources.find((source) => source.kind === "pmc-author-manuscript");
  manuscript.scope = ["Fig. 3"];
  for (const figure of paper.figureAudit) if (figure.scopeRef !== "Fig. 3") delete figure.scopeRef;

  const narrowedClaims = structuredClone(claims);
  for (const claim of narrowedClaims.claims) if (claim.paperId === KAGAN && claim.review?.scopeRef !== "Fig. 3") delete claim.review;

  const rebuilt = buildGraph({ ...inputs, papers: narrowed, claims: narrowedClaims });

  const kaganEdges = rebuilt.edges.filter((edge) => edge.paperId === KAGAN && edge.provenanceClass === "paper-backed-experimental");
  const promoted = kaganEdges.filter((edge) => isSourceChecked(edge.reviewState));
  assert.ok(promoted.length > 0, "the figure that was read must promote something");
  assert.ok(promoted.every((edge) => edge.scopeRef === "Fig. 3"), `only Fig. 3 may be promoted, got ${[...new Set(promoted.map((edge) => edge.scopeRef))].join(", ")}`);
  assert.ok(
    kaganEdges.filter((edge) => edge.figure && edge.figure !== "Fig. 3").every((edge) => edge.reviewState === "archive-derived"),
    "every figure nobody opened must stay archive-derived",
  );
});

test("an archive-derived paper claim renders as archive-derived, never as source-checked", () => {
  const untouched = graph.edges.filter((edge) => edge.provenanceClass === "paper-backed-experimental" && !edge.scopeRef);
  assert.ok(untouched.length > 0, "the corpus must still contain claims nobody has re-read");
  for (const edge of untouched) {
    assert.equal(edge.reviewState, "archive-derived");
    assert.equal(edge.verificationDepth, "archive-derived");
    assert.equal(edge.checkedAt, null);
    assert.ok(edge.reviewPendingReason, "an archive-derived edge must say what has not been read");
  }
});

test("adding a date to a paper's verification block promotes nothing", () => {
  const dated = structuredClone(papers);
  for (const paper of dated) paper.verification.checkedAt = "2026-07-24";
  const rebuilt = buildGraph({ ...inputs, papers: dated });
  assert.equal(
    rebuilt.counts.byReviewState["source-checked"],
    graph.counts.byReviewState["source-checked"],
    "restamping every verification block must not move a single edge",
  );
});

// ------------------------------------------------------------------------------- P0-B

test("a bare check date on a method link is refused rather than honoured", () => {
  const dated = structuredClone(network);
  dated.methodLinks[0].checkedAt = "2026-07-24";
  assert.throws(
    () => buildGraph({ ...inputs, network: dated }),
    /a bare checkedAt is not evidence of review/,
    "the acceptance mutation for P0-B: a date alone must never promote a method edge",
  );
});

test("a method route promotes only with status, reader, date, version and a covering scope", () => {
  const base = structuredClone(methods);
  const module = base.find((entry) => entry.id === "death-kinetics");
  const link = structuredClone(network);
  link.methodLinks.find((entry) => entry.method === "death-kinetics").assertionScopes = { MEASURES: "Box 1: death kinetics" };

  // A module that has read its source both records the route and declares which scope entry
  // covers each assertion. A module that has not done neither: the route stays not-checked
  // and no assertionScope is declared, so there is nothing to promote and nothing to reject.
  const promoteWith = (route, declareScope = true) => {
    const patched = structuredClone(base);
    patched.find((entry) => entry.id === "death-kinetics").sourceRoutes[0] = { ...module.sourceRoutes[0], ...route };
    const network = structuredClone(link);
    if (!declareScope) delete network.methodLinks.find((entry) => entry.method === "death-kinetics").assertionScopes;
    const rebuilt = buildGraph({ ...inputs, methods: patched, network });
    return rebuilt.edges.filter((edge) => edge.from === "method:death-kinetics" && isSourceChecked(edge.reviewState));
  };

  const complete = {
    status: "source-checked",
    checkedAt: "2026-07-24",
    checkedBy: "a named reviewer",
    sourceVersion: "retrieved 2026-07-24",
    verificationDepth: "figures-legends-checked",
    reviewedScopes: [{ id: "box-1", label: "Box 1: death kinetics", verificationDepth: "figures-legends-checked", accessSurface: "x", boundary: "y" }],
  };
  assert.equal(promoteWith(complete).length, 2, "a complete route must promote the MEASURES edges it covers");

  for (const missing of ["checkedBy", "sourceVersion", "checkedAt"]) {
    const partial = { ...complete, [missing]: null };
    assert.throws(() => promoteWith(partial), /./, `a route missing ${missing} must not promote silently`);
  }
  // A real not-checked route carries no scope and the module declares none, so it promotes nothing.
  assert.equal(
    promoteWith({ status: "not-checked", checkedAt: null, checkedBy: null, sourceVersion: null, verificationDepth: "not-read", reviewedScopes: [] }, false).length,
    0,
    "an unchecked status must not promote",
  );
});

test("a method route with a scope that does not cover the assertion fails the build", () => {
  const patched = structuredClone(methods);
  patched.find((entry) => entry.id === "death-kinetics").sourceRoutes[0] = {
    ...patched.find((entry) => entry.id === "death-kinetics").sourceRoutes[0],
    status: "source-checked",
    checkedAt: "2026-07-24",
    checkedBy: "a named reviewer",
    sourceVersion: "retrieved 2026-07-24",
    verificationDepth: "figures-legends-checked",
    reviewedScopes: [{ id: "box-2", label: "Box 2: something else", verificationDepth: "figures-legends-checked", accessSurface: "x", boundary: "y" }],
  };
  const link = structuredClone(network);
  link.methodLinks.find((entry) => entry.method === "death-kinetics").assertionScopes = { MEASURES: "Box 1: death kinetics" };
  assert.throws(
    () => buildGraph({ ...inputs, methods: patched, network: link }),
    /no source-checked record covers it/,
    "a scope mismatch must fail rather than promote the wrong assertion",
  );
});

test("MEASURES and CANNOT_DISTINGUISH are promoted independently", () => {
  const patched = structuredClone(methods);
  const dkModule = patched.find((entry) => entry.id === "death-kinetics");
  dkModule.sourceRoutes[0] = {
    ...dkModule.sourceRoutes[0],
    status: "source-checked",
    checkedAt: "2026-07-24",
    checkedBy: "a named reviewer",
    sourceVersion: "retrieved 2026-07-24",
    verificationDepth: "figures-legends-checked",
    reviewedScopes: [{ id: "what-measures", label: "what the assay measures", verificationDepth: "figures-legends-checked", accessSurface: "x", boundary: "y" }],
  };
  const link = structuredClone(network);
  link.methodLinks.find((entry) => entry.method === "death-kinetics").assertionScopes = { MEASURES: "what the assay measures" };
  const rebuilt = buildGraph({ ...inputs, methods: patched, network: link });
  const edges = rebuilt.edges.filter((edge) => edge.from === "method:death-kinetics");
  assert.ok(edges.filter((edge) => edge.relation === "MEASURES").every((edge) => isSourceChecked(edge.reviewState)));
  assert.ok(
    edges.filter((edge) => edge.relation === "CANNOT_DISTINGUISH").every((edge) => edge.reviewState === "recorded-unverified"),
    "reading what an assay measures does not establish what it cannot distinguish",
  );
});

// ------------------------------------------------------------ provenance separation

test("a curated method-module edge may not claim a paper as its backing", () => {
  assert.ok(checkEdgeContract({ ...methodEdge, paperId: KAGAN }, "fixture").some((problem) => /must not claim a paper/.test(problem)));
});

test("an edge classed as paper-backed must name the paper it was read from", () => {
  assert.ok(checkEdgeContract({ ...methodEdge, provenanceClass: "paper-backed-experimental" }, "fixture").some((problem) => /must name the paper/.test(problem)));
});

test("an edge with no provenance class is rejected", () => {
  assert.ok(checkEdgeContract({ ...methodEdge, provenanceClass: undefined }, "fixture").length > 0);
});

test("an edge that does not name the record it derives from is rejected", () => {
  assert.ok(checkEdgeContract({ ...methodEdge, sourceReviewState: undefined }, "fixture").some((problem) => /review state of the record/.test(problem)));
  assert.ok(checkEdgeContract({ ...methodEdge, sourceVerificationDepth: undefined }, "fixture").some((problem) => /verification depth of the record/.test(problem)));
});

// -------------------------------------------------------------- the shipped graph

test("every edge in the shipped graph satisfies the contract", () => {
  assert.deepEqual(graph.edges.flatMap((edge, index) => checkEdgeContract(edge, `edge[${index}]`)), []);
});

test("every method-module edge is paperless, and unreviewed unless a read route covers it", () => {
  const moduleEdges = graph.edges.filter((edge) => edge.provenanceClass === "curated-method-module");
  assert.equal(moduleEdges.length, 74, "the 16 method modules contribute a MEASURES and a CANNOT_DISTINGUISH edge per mechanism link");
  for (const edge of moduleEdges) {
    assert.equal(edge.paperId, null, "a method module never borrows a paper as its backing");
    if (isSourceChecked(edge.reviewState)) {
      // Promoted only because a source route this module declares was read at a scope that
      // covers this assertion. It must therefore carry the full source-checked apparatus.
      assert.ok(edge.scopeRef, "a promoted method edge must name the scope entry that covers it");
      assert.ok(edge.checkedAt && edge.checkedBy && edge.sourceVersion, "a promoted method edge must carry who read what, and when");
      assert.notEqual(edge.verificationDepth, "curated-unverified");
    } else {
      assert.equal(edge.reviewState, "recorded-unverified");
      assert.equal(edge.checkedAt, null);
      assert.equal(edge.verificationDepth, "curated-unverified");
      assert.ok(edge.reviewPendingReason, "an unreviewed edge must state what has not been read");
    }
  }
  // The three modules read this round promote exactly the assertions their routes cover, and
  // no more; the rest of the atlas stays unreviewed, so the boundary between read and unread
  // is visible rather than blurred.
  const promoted = moduleEdges.filter((edge) => isSourceChecked(edge.reviewState));
  assert.equal(promoted.length, 8, "3 modules promote only the MEASURES/CANNOT_DISTINGUISH edges their read scopes cover");
  assert.ok(moduleEdges.filter((edge) => !isSourceChecked(edge.reviewState)).length >= 60, "the great majority of the method atlas is still honestly unread");
});

test("the graph names a generator that exists on disk", () => {
  assert.equal(graph.generator, "lib/graph.mjs");
});

test("the zero-count CONTRADICTS relation stays visible in the counts", () => {
  assert.equal(graph.counts.byRelation.CONTRADICTS, 0);
  assert.ok("CONTRADICTS" in graph.counts.byRelation, "a relation with no instances is a fact about the corpus, not a row to omit");
});

test("the counts separate every review state and every verification depth", () => {
  for (const state of EDGE_REVIEW_STATES) assert.ok(state in graph.counts.byReviewState, `state ${state} must be reported even at zero`);
  for (const depth of VERIFICATION_DEPTHS) assert.ok(depth in graph.counts.byVerificationDepth, `depth ${depth} must be reported even at zero`);
  assert.equal(graph.counts.byReviewState["independently-rechecked"], 0, "nothing in this repository has had a second independent reading");
  const provenanceTotal = EDGE_PROVENANCE_CLASSES.reduce((total, value) => total + graph.counts.byProvenanceClass[value], 0);
  const reviewTotal = EDGE_REVIEW_STATES.reduce((total, value) => total + graph.counts.byReviewState[value], 0);
  const depthTotal = VERIFICATION_DEPTHS.reduce((total, value) => total + graph.counts.byVerificationDepth[value], 0);
  assert.equal(provenanceTotal, graph.counts.edges);
  assert.equal(reviewTotal, graph.counts.edges);
  assert.equal(depthTotal, graph.counts.edges);
});

const generatorExists = await fs.stat(path.join(root, graph.generator)).then((entry) => entry.isFile()).catch(() => false);
test("the declared generator resolves to a real file", () => {
  assert.ok(generatorExists, `${graph.generator} does not exist on disk`);
});

// ------------------------------------------------- P0-B: the edge links to the opened source

test("the shipped MDA method edge links to the source that was opened, not the unread recommendation", () => {
  // The round-4 defect: the MEASURES edge was checked against Zou's PMC author manuscript but
  // its clickable sourceUrl was the 2025 field recommendation DOI, which was never opened.
  const mda = graph.edges.filter((edge) => edge.from === "method:mda-4hne" && edge.relation === "MEASURES");
  assert.ok(mda.length > 0, "the MDA module must contribute MEASURES edges");
  for (const edge of mda) {
    assert.ok(isSourceChecked(edge.reviewState), "the MDA MEASURES edge is promoted");
    assert.match(edge.sourceUrl, /PMC7353921/, `expected the opened Zou manuscript, got ${edge.sourceUrl}`);
    assert.doesNotMatch(edge.sourceUrl, /s41580-025-00843-2/, "the edge must not link to the unread 2025 recommendation");
  }
});

test("a checked figure-caption edge inherits figures-legends depth, never methods depth", () => {
  // P0-2: a manuscript whose Methods were read must not lend methods depth to a figure caption.
  const figureEdges = graph.edges.filter((edge) => isSourceChecked(edge.reviewState) && /^Fig\. \d+$/.test(edge.scopeRef || ""));
  assert.ok(figureEdges.length > 0, "the corpus must contain promoted figure-caption edges");
  for (const edge of figureEdges) {
    assert.equal(edge.verificationDepth, "figures-legends-checked", `${edge.relation} at ${edge.scopeRef} must not inherit ${edge.verificationDepth}`);
    assert.ok(
      ["methods-checked", "figures-legends-checked", "supplement-checked", "full-text-rechecked", "raw-data-rechecked"].includes(edge.sourceVerificationDepth),
      "the record's summary maximum is the ceiling, reported separately from the scope depth",
    );
  }
});

test("array order never decides review state when two records cover one scope (P1-4)", () => {
  // Two source records cover the same method scope: a source-checked reading and a stronger
  // independent recheck. Whichever order they sit in the array, the stronger state must win.
  const scopeEntry = (depth) => ({ id: "s1", label: "shared scope", verificationDepth: depth, accessSurface: "x", boundary: "y" });
  // The source-checked reading is the DEEPER one; the independent recheck is shallower. State
  // rank must still win over depth, so the shallower recheck is selected.
  const checked = {
    status: "source-checked", checkedAt: "2026-07-24", checkedBy: "first reader", reviewerId: "reader-a",
    reviewEventId: "ev-a", sourceVersion: "v1", verificationDepth: "methods-checked", reviewedScopes: [scopeEntry("methods-checked")],
  };
  const rechecked = {
    status: "independently-rechecked", checkedAt: "2026-07-24", checkedBy: "second reader", reviewerId: "reader-b",
    reviewEventId: "ev-b", sourceVersion: "v1", verificationDepth: "abstract-checked", reviewedScopes: [scopeEntry("abstract-checked")],
  };
  const build = (order) => {
    const patched = structuredClone(methods);
    const module = patched.find((entry) => entry.id === "death-kinetics");
    const first = { ...module.sourceRoutes[0] };
    module.sourceRoutes = order.map((route, i) => ({ ...first, ...route, id: `dk-${i}`, kind: "original-research-demonstration", url: `https://example.org/${i}`, kindBasis: "test", boundary: "test" }));
    module.source = module.sourceRoutes[0].url;
    const net = structuredClone(network);
    net.methodLinks.find((entry) => entry.method === "death-kinetics").assertionScopes = { MEASURES: "shared scope" };
    return buildGraph({ ...inputs, methods: patched, network: net }).edges.filter((edge) => edge.from === "method:death-kinetics" && edge.relation === "MEASURES");
  };
  for (const order of [[checked, rechecked], [rechecked, checked]]) {
    const edges = build(order);
    assert.ok(edges.length > 0, "the shared scope must promote the MEASURES edges");
    assert.ok(edges.every((edge) => edge.reviewState === "independently-rechecked"), "the stronger independent recheck must win regardless of array order");
  }
});

// ----------------------------------------------------------------------- reporting

const failures = cases.filter((entry) => !entry.ok);
for (const failure of failures) console.error(`FAIL ${failure.name}\n      ${failure.message}`);
if (failures.length) {
  console.error(`\n${failures.length} of ${cases.length} graph contract cases failed.`);
  process.exit(1);
}
const states = EDGE_REVIEW_STATES.map((state) => `${state} ${graph.counts.byReviewState[state]}`).join(", ");
console.log(
  `Graph contract tests passed: ${cases.length} cases. Review state: ${states}. ` +
    "A date, a URL, a restamped verification block and a scope that covers a different assertion each fail to promote anything.",
);
