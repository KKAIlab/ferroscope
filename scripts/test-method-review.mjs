// Mutation tests for the claim-specific method-review contract (round-5 P0-C, P1-A).
//
// validate-v09.mjs passing proves the shipped data is consistent. It does not prove the
// contract rejects a fabricated join, because the shipped data never fabricates one. These
// tests take a real source-checked module, break the join between a decision field and the
// source record / review event / reviewed scope it cites, and require the validator to name
// the break. The independent-review cases do the same for a second-reader event.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMethodReview, validateIndependentReview } from "../lib/method-review.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const parsed = JSON.parse(await fs.readFile(path.join(root, "data", "methods.json"), "utf8"));
const labs = JSON.parse(await fs.readFile(path.join(root, "data", "labs.json"), "utf8"));
const labIds = new Set(labs.map((lab) => lab.id));
const OWNER = "ferroscope-maintainer";

const base = () => parsed.find((m) => m.id === "oxidized-pl-lcms");
const clone = (module) => structuredClone(module);
const firstCheckedEvidence = (module) => {
  for (const axis of Object.keys(module.decisionProfile.fields)) {
    const field = module.decisionProfile.fields[axis];
    if (field.status === "source-checked" && (field.evidence || []).length) return { axis, entry: field.evidence[0] };
  }
  throw new Error("no checked evidence to mutate");
};

const cases = [];
const expectRejection = (name, mutate, pattern) => {
  try {
    const module = clone(base());
    mutate(module);
    const { problems } = validateMethodReview(module, { labIds, owner: OWNER });
    assert.ok(problems.length > 0, "expected at least one problem");
    assert.ok(problems.some((p) => pattern.test(p)), `expected ${pattern}, got:\n  ${problems.join("\n  ")}`);
    cases.push({ name, ok: true });
  } catch (error) {
    cases.push({ name, ok: false, message: error.message });
  }
};

// The shipped module must pass, or every rejection below would be meaningless.
try {
  const { problems } = validateMethodReview(clone(base()), { labIds, owner: OWNER });
  assert.deepEqual(problems, []);
  cases.push({ name: "the shipped oxidized-pl-lcms module satisfies the review contract", ok: true });
} catch (error) {
  cases.push({ name: "the shipped oxidized-pl-lcms module satisfies the review contract", ok: false, message: error.message });
}

expectRejection("an evidence entry citing an unknown source record is rejected", (m) => {
  firstCheckedEvidence(m).entry.sourceRecordId = "no-such-record";
}, /unknown source record id/);

expectRejection("an evidence entry citing the wrong review event is rejected", (m) => {
  firstCheckedEvidence(m).entry.reviewEventId = "some-other-event";
}, /does not match record/);

expectRejection("an evidence entry citing an unknown scope is rejected", (m) => {
  firstCheckedEvidence(m).entry.scopeId = "scope-that-was-never-read";
}, /unknown scope id/);

expectRejection("a field promoted from a not-checked route is rejected", (m) => {
  // Point a checked field's evidence at the declared-but-unread version-of-record route.
  const { entry } = firstCheckedEvidence(m);
  entry.sourceRecordId = "nchembio2238-version-of-record";
  entry.reviewEventId = null;
}, /is not a review/);

expectRejection("a denormalised URL that disagrees with the record is rejected", (m) => {
  firstCheckedEvidence(m).entry.url = "https://example.org/not-the-source";
}, /denormalised url disagrees/);

expectRejection("a denormalised source version that disagrees with the record is rejected", (m) => {
  firstCheckedEvidence(m).entry.sourceVersion = "some other version";
}, /denormalised sourceVersion disagrees/);

expectRejection("a denormalised check date that disagrees with the record is rejected", (m) => {
  firstCheckedEvidence(m).entry.checkedAt = "1999-01-01";
}, /denormalised checkedAt disagrees/);

expectRejection("a field claiming a depth deeper than its scope is rejected", (m) => {
  // fig-5 is a figure caption (figures-legends-checked); asserting supplement depth overruns it.
  const readout = m.decisionProfile.fields.readout;
  const figEntry = readout.evidence.find((e) => e.scopeId === "fig-5");
  figEntry.assertedDepth = "supplement-checked";
}, /claims depth/);

expectRejection("an explicit claim whose note admits inference is rejected", (m) => {
  const { entry } = firstCheckedEvidence(m);
  entry.supportMode = "explicit";
  entry.supportNote = "This value is not stated in the passage; it is inferred.";
}, /admits inference/);

expectRejection("a checked field with no support note is rejected", (m) => {
  delete firstCheckedEvidence(m).entry.supportNote;
}, /explain how the passage supports/);

expectRejection("a pending field that keeps a published value is rejected", (m) => {
  const field = m.decisionProfile.fields.positiveControl;
  field.status = "pending-source-review";
  field.unresolved = "still unread";
  // value stays populated, which is the defect.
}, /carries a value while declaring itself unverified/);

// -------------------------------------------------------- P1-A: independent recheck is an event
const validRecheck = () => ({
  id: "kagan2017-pmc5506843",
  url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5506843/",
  status: "independently-rechecked",
  reviewerId: "claude-code-round4-implementer",
  reviewEventId: "claude-r4-kagan2017",
  sourceVersion: "PMC5506843.1 / NIHMS873824 author manuscript",
  reviewedScopes: [{ id: "fig-3", label: "Fig. 3", verificationDepth: "figures-legends-checked", accessSurface: "x", boundary: "y" }],
  independentReview: {
    reviewEventId: "codex-recheck-1",
    priorReviewEventId: "claude-r4-kagan2017",
    reviewerId: "independent-review-codex",
    sourceVersion: "PMC5506843.1 / NIHMS873824 author manuscript",
    scopeIds: ["fig-3"],
    agreement: "agrees",
    note: null,
  },
});

const expectRecheckRejection = (name, mutate, pattern) => {
  try {
    const route = validRecheck();
    mutate(route);
    const problems = validateIndependentReview(route, { rw: "fixture", owner: OWNER });
    assert.ok(problems.some((p) => pattern.test(p)), `expected ${pattern}, got:\n  ${problems.join("\n  ")}`);
    cases.push({ name, ok: true });
  } catch (error) {
    cases.push({ name, ok: false, message: error.message });
  }
};

try {
  const problems = validateIndependentReview(validRecheck(), { rw: "fixture", owner: OWNER });
  assert.deepEqual(problems, []);
  cases.push({ name: "a well-formed independent recheck passes", ok: true });
} catch (error) {
  cases.push({ name: "a well-formed independent recheck passes", ok: false, message: error.message });
}

expectRecheckRejection("a recheck signed by the same reviewer as the original is rejected", (r) => {
  r.independentReview.reviewerId = r.reviewerId;
}, /different reviewer/);

expectRecheckRejection("a recheck signed by the dataset owner is rejected", (r) => {
  r.independentReview.reviewerId = OWNER;
}, /may not be signed by the dataset owner/);

expectRecheckRejection("a recheck that names no prior event is rejected", (r) => {
  delete r.independentReview.priorReviewEventId;
}, /must name the prior review event/);

expectRecheckRejection("a recheck of a changed source version is rejected", (r) => {
  r.independentReview.sourceVersion = "a different retrieval";
}, /same source version/);

expectRecheckRejection("a recheck with no overlapping scope is rejected", (r) => {
  r.independentReview.scopeIds = ["fig-99"];
}, /do not overlap/);

expectRecheckRejection("a recheck with no agreement outcome is rejected", (r) => {
  delete r.independentReview.agreement;
}, /must record agreement/);

expectRecheckRejection("an independently-rechecked record with no recheck event is rejected", (r) => {
  delete r.independentReview;
}, /must carry an independentReview event/);

const failures = cases.filter((c) => !c.ok);
for (const failure of failures) console.error(`FAIL ${failure.name}\n      ${failure.message}`);
if (failures.length) {
  console.error(`\n${failures.length} of ${cases.length} method-review mutation tests failed.`);
  process.exit(1);
}
console.log(`Method-review mutation tests passed: ${cases.length} cases. A fabricated source/event/scope join, a depth overrun, an inference hidden as explicit, and a self-signed or version-mismatched independent recheck each fail.`);
