// Round-7 regression tests. Each case is an integrity attack that the registry and graph
// accepted before this round; the test asserts it is now rejected, and that the legitimate
// counterpart still passes. If any of these ever goes green-when-it-should-be-red, a forged
// "source-checked" or "independently-rechecked" claim can reach a reader again.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRegistry } from "../lib/source-registry.mjs";
import { buildGraph } from "../lib/graph.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (file) => JSON.parse(fs.readFileSync(path.join(root, "data", file), "utf8"));

let failures = 0;
const test = (name, fn) => { try { fn(); console.log(`  ok  ${name}`); } catch (error) { failures += 1; console.error(`FAIL  ${name}\n      ${error.message}`); } };
const caught = (problems, needle) => problems.some((p) => p.includes(needle));

// ---- registry independent-review chain (problem 1) --------------------------------------
const baseRegistry = () => ({
  owner: "owner-x",
  reviewers: [{ id: "r1", name: "R1" }, { id: "r2", name: "R2" }],
  sources: [{
    id: "s1", documentClass: "paper", url: "https://x/s1",
    version: { label: "v1", retrievedAt: "2026-07-01", sha256: "a".repeat(64) },
    scopes: [
      { id: "sc-open", label: "Fig 1", surfaceType: "figure-caption", accessExtent: "complete-scope", boundary: "b" },
      { id: "sc-shut", label: "Fig 9", surfaceType: "figure-panel", accessExtent: "not-opened", boundary: "b" },
    ],
  }],
  reviewEvents: [],
});
const withEvents = (events, patch) => { const r = baseRegistry(); r.reviewEvents = events; patch?.(r); return r; };
const firstReading = { id: "e0", sourceId: "s1", reviewState: "source-checked", reviewerId: "r1", checkedAt: "2026-07-01", boundary: "b", scopeIds: ["sc-open"] };
const validRecheck = { id: "e1", sourceId: "s1", reviewState: "independently-rechecked", reviewerId: "r2", checkedAt: "2026-07-02", boundary: "b", scopeIds: ["sc-open"], priorReviewEventId: "e0", agreement: "agrees" };

test("a circular independent-review chain is rejected", () => {
  const r = withEvents([
    { ...validRecheck, id: "eA", reviewerId: "r1", priorReviewEventId: "eB" },
    { ...validRecheck, id: "eB", reviewerId: "r2", priorReviewEventId: "eA" },
  ]);
  assert.ok(caught(validateRegistry(r), "circular"), "circular chain must be caught");
});
test("a checked event citing a not-opened scope is rejected", () => {
  const r = withEvents([{ ...firstReading, scopeIds: ["sc-shut"] }]);
  assert.ok(caught(validateRegistry(r), "not-opened"), "a reading of an unopened surface must be caught");
});
test("an independent recheck of an unopened prior is rejected", () => {
  const r = withEvents([{ ...firstReading, reviewState: "recorded-unverified", scopeIds: [] }, validRecheck]);
  assert.ok(caught(validateRegistry(r), "must reproduce a checked reading"), "reproducing an unread record must be caught");
});
test("an event that names a prior but is not independently-rechecked is rejected", () => {
  const r = withEvents([firstReading, { ...validRecheck, reviewState: "source-checked" }]);
  assert.ok(caught(validateRegistry(r), "an event that reproduces another must be"), "a masquerading recheck must be caught");
});
test("an independent recheck resolving to an unhashed source is rejected", () => {
  const r = withEvents([firstReading, validRecheck], (reg) => { reg.sources[0].version.sha256 = null; });
  assert.ok(caught(validateRegistry(r), "no pinned sha256"), "an unprovable byte identity must be caught");
});
test("a well-formed independent recheck still passes", () => {
  assert.deepEqual(validateRegistry(withEvents([firstReading, validRecheck])), [], "a valid recheck must not be flagged");
});

// ---- paper private-field forgery in the real graph (problem 2) --------------------------
const graphInputs = () => ({
  papers: rd("papers-en.json"), labs: rd("labs.json"), labsEn: rd("labs-en.json"),
  links: rd("lab-paper-links.json"), methods: rd("methods.json"),
  network: rd("knowledge-network.json"), claims: rd("paper-claims.json"),
  sourceReviews: rd("source-reviews.json"),
});

test("the clean graph builds with zero independently-rechecked edges", () => {
  const g = buildGraph(graphInputs());
  assert.equal(g.counts.byReviewState["independently-rechecked"], 0, "nothing in this repo has a second reading yet");
});
test("raising a paper's private reviewState cannot forge an independently-rechecked edge", () => {
  const input = graphInputs();
  let mutated = 0;
  for (const p of input.papers) for (const s of p.verification?.sources || []) {
    if (s.reviewState === "source-checked") { s.reviewState = "independently-rechecked"; s.verificationDepth = "raw-data-rechecked"; mutated += 1; }
  }
  assert.ok(mutated > 0, "the fixture must actually mutate something");
  assert.throws(() => buildGraph(input), /the registry is the authority/, "the forged private state must fail the build, not promote an edge");
});

// ---- cross-paper evidence borrow (audit HOLE-1) -----------------------------------------
test("a paper cannot borrow another paper's source and reading", () => {
  const input = graphInputs();
  const borrower = input.papers.find((p) => p.doi === "10.1038/s41586-020-2732-8");
  borrower.verification.sources.push({ kind: "fulltext", sourceId: "pmc5506843", reviewEventId: "claude-r4-kagan2017", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5506843/", reviewState: "source-checked", verificationDepth: "figures-legends-checked", finding: "a deliberately borrowed reading of a different paper", scope: [], status: "source-checked" });
  assert.throws(() => buildGraph(input), /may not borrow another paper's reading/, "a foreign source (about another DOI) must fail the build");
});

// ---- experimental claim promoted by a metadata surface (audit HOLE-2) -------------------
test("an experimental claim cannot be promoted by a bibliographic metadata scope", () => {
  const input = graphInputs();
  const paper = input.papers.find((p) => p.doi === "10.1038/s41586-020-2732-8");
  const claim = input.claims.claims.find((c) => c.paperId === paper.id);
  assert.ok(claim, "the fixture needs a claim on this paper");
  claim.review = { scopeRef: "authors" };
  assert.throws(() => buildGraph(input), /primary-document content surface/, "an experimental edge on a metadata surface must fail the build");
});

// ---- forged duplicate-bytes shadow source (audit RESIDUAL-A) ----------------------------
test("a second source with the same bytes but a different DOI is rejected", () => {
  const input = graphInputs();
  const real = input.sourceReviews.sources.find((s) => s.id === "pmc5506843");
  input.sourceReviews.sources.push({ ...structuredClone(real), id: "pmc5506843-forged", identifiers: { doi: "10.1038/s41586-020-2732-8" } });
  const problems = validateRegistry(input.sourceReviews);
  assert.ok(problems.some((p) => /forged duplicate/.test(p)), "a duplicate-URL/hash source must be rejected by the registry");
  assert.throws(() => buildGraph(input), /forged duplicate/, "the build must refuse a registry with a forged duplicate source");
});

// ---- experimental claim promoted by a correction notice (audit RESIDUAL-B) --------------
test("an experimental claim cannot be promoted by a correction-notice surface", () => {
  const input = graphInputs();
  const paper = input.papers.find((p) => p.doi === "10.1038/s41589-020-0472-6");
  const claim = input.claims.claims.find((c) => c.paperId === paper.id);
  assert.ok(claim, "the fixture needs a claim on this paper");
  const correction = input.sourceReviews.sources.find((s) => s.id === "correction-s41589-021-00767-w");
  claim.review = { scopeRef: correction.scopes[0].label };
  assert.throws(() => buildGraph(input), /primary-document content surface/, "an experimental edge on a correction-notice surface must fail the build");
});

// ---- claim promoted by a scope that is not its own figure (audit pass-3 HOLE) -----------
test("a claim about one figure cannot be promoted by a reading of a different figure", () => {
  const input = graphInputs();
  const claim = input.claims.claims.find((c) => c.id === "claim-oxpe-species");
  assert.ok(claim && claim.figure === "Fig. 3", "the fixture claim must be about Fig. 3");
  claim.review = { scopeRef: "Fig. 6" }; // a genuinely-read scope on the same paper, but the wrong figure
  assert.throws(() => buildGraph(input), /own asserted evidence location/, "promoting a Fig. 3 claim off Fig. 6 must fail the build");
});

// ---- notice inline review cannot mint an independent recheck (audit pass-4 C1) ----------
// The notice path is now registry-joined, so every way of hand-setting an inline recheck fails
// structurally — dropping the event id, keeping a real but only-source-checked event id, and
// naming a non-existent event id — rather than being caught only by a count assertion.
const forgeNoticeRecheck = (patch) => {
  const input = graphInputs();
  const paper = input.papers.find((p) => p.doi === "10.1038/s41589-020-0472-6");
  let injected = false;
  for (const event of paper.versionEvents || []) {
    if (event.reviews && event.reviews.length) {
      const forged = structuredClone(event.reviews.find((r) => r.reviewState === "source-checked") || event.reviews[0]);
      forged.reviewState = "independently-rechecked";
      patch(forged);
      event.reviews.push(forged);
      injected = true;
      break;
    }
  }
  assert.ok(injected, "the fixture needs a notice with an inline review to clone");
  return input;
};
test("a correction notice recheck with no registry event is rejected", () => {
  assert.throws(() => buildGraph(forgeNoticeRecheck((r) => { delete r.reviewEventId; })), /no checked registry event backs it/, "an inline notice copy with no event must not mint independently-rechecked");
});
test("a correction notice recheck citing a merely-source-checked event is rejected", () => {
  // keeps the real reviewEventId, which resolves to a source-checked (not independent) event
  assert.throws(() => buildGraph(forgeNoticeRecheck(() => {})), /the registry is the authority/, "the inline copy may not out-rank its registry event");
});
test("a correction notice recheck citing a non-existent event is rejected", () => {
  assert.throws(() => buildGraph(forgeNoticeRecheck((r) => { r.reviewEventId = "does-not-exist"; })), /does not resolve in the registry/, "a bogus event id must be rejected, not trusted");
});

// ---- method assertion promoted by the other assertion's reading (audit pass-4 C2) -------
test("a method's MEASURES and CANNOT_DISTINGUISH cannot cite the same reading", () => {
  const input = graphInputs();
  const link = input.network.methodLinks.find((l) => l.method === "oxidized-pl-lcms");
  assert.ok(link?.assertionScopes?.CANNOT_DISTINGUISH, "the fixture method must have a boundary scope to borrow");
  link.assertionScopes.MEASURES = link.assertionScopes.CANNOT_DISTINGUISH;
  assert.throws(() => buildGraph(input), /same reading cannot separately establish/, "borrowing the boundary's reading for the measurement claim must fail the build");
});

// ---- a metadata source cannot carry an experimental content surface (round-8 audit HOLE-1) --
// The edge-level allowlist trusts a scope's self-declared surfaceType, so a crossref metadata
// record could carry a scope claiming surfaceType "figure-caption"; a paper figureAudit pointing
// at it would then promote a figure edge to source-checked backed only by bibliographic metadata
// no reader opened. The registry now binds a scope's surfaceType to the source's documentClass.
test("a crossref metadata source cannot declare an experimental content surface", () => {
  const input = graphInputs();
  const crossref = input.sourceReviews.sources.find((s) => s.documentClass === "crossref-metadata-record");
  assert.ok(crossref, "the fixture needs a crossref metadata source");
  crossref.scopes.push({ id: "forged-fig-caption", label: "Fig. 1", surfaceType: "figure-caption", accessExtent: "complete-scope", boundary: "a forged content surface on a metadata record" });
  assert.ok(caught(validateRegistry(input.sourceReviews), 'cannot expose a "figure-caption" surface'), "a figure-caption scope on a metadata record must be rejected by the registry");
  assert.throws(() => buildGraph(input), /cannot expose a "figure-caption" surface/, "the build must refuse a metadata source carrying an experimental content surface");
});
test("a pubmed record may still carry its abstract, and a version-of-record any content surface", () => {
  // the constraint must not over-reach: legitimate abstract/content scopes still validate
  assert.deepEqual(validateRegistry(rd("source-reviews.json")), [], "the real registry must stay clean under the new documentClass/surface constraint");
});

if (failures) { console.error(`\n${failures} registry-hardening case(s) failed.`); process.exit(1); }
console.log(`\nRegistry-hardening tests passed: circular chains, unopened-scope readings, unopened-prior and masquerading rechecks, unhashed byte-identity claims, and paper private-field forgery are all rejected while a valid recheck passes.`);
