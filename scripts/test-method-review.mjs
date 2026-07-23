// Mutation tests for the claim-specific method-review contract and the canonical registry's
// independent-review rule (round-6 P0-B, P0-C, P0-E).
//
// validate-v09.mjs passing proves the shipped data is consistent. It does not prove the
// contract rejects a fabricated join, because the shipped data never fabricates one. These
// tests take the real source-checked module and the real registry, break the join between a
// decision field and the source record / review event / reviewed scope it cites, and require
// the validator to name the break. The independent-review block does the same for a second
// reader event, which is now a first-class registry entry that must resolve its prior event.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMethodReview } from "../lib/method-review.mjs";
import { createResolver, validateRegistry, validateIndependentEvent } from "../lib/source-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (file) => JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8"));
const parsed = await read("methods.json");
const labs = await read("labs.json");
const registry = await read("source-reviews.json");
const labIds = new Set(labs.map((lab) => lab.id));
const OWNER = "ferroscope-maintainer";
const resolver = createResolver(registry);

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
    const { problems } = validateMethodReview(module, { labIds, owner: OWNER, resolver });
    assert.ok(problems.length > 0, "expected at least one problem");
    assert.ok(problems.some((p) => pattern.test(p)), `expected ${pattern}, got:\n  ${problems.join("\n  ")}`);
    cases.push({ name, ok: true });
  } catch (error) {
    cases.push({ name, ok: false, message: error.message });
  }
};

// The shipped module must pass, or every rejection below would be meaningless.
try {
  const { problems } = validateMethodReview(clone(base()), { labIds, owner: OWNER, resolver });
  assert.deepEqual(problems, []);
  cases.push({ name: "the shipped oxidized-pl-lcms module satisfies the review contract", ok: true });
} catch (error) {
  cases.push({ name: "the shipped oxidized-pl-lcms module satisfies the review contract", ok: false, message: error.message });
}

expectRejection("an evidence entry citing an unknown source route is rejected", (m) => {
  firstCheckedEvidence(m).entry.sourceRecordId = "no-such-route";
}, /unknown source route id/);

expectRejection("an evidence entry citing the wrong review event is rejected", (m) => {
  firstCheckedEvidence(m).entry.reviewEventId = "some-other-event";
}, /does not match route/);

expectRejection("an evidence entry citing an unknown scope is rejected", (m) => {
  firstCheckedEvidence(m).entry.scopeId = "scope-that-was-never-read";
}, /unknown scope id/);

expectRejection("a field promoted from a not-opened route is rejected", (m) => {
  // Point a checked field's evidence at the declared-but-unread version-of-record route.
  const { entry } = firstCheckedEvidence(m);
  entry.sourceRecordId = "nchembio2238-version-of-record";
  entry.reviewEventId = null;
}, /is not a checked reading/);

expectRejection("a route embedding its own version is rejected as forged authority", (m) => {
  m.sourceRoutes[1].sourceVersion = "FORGED-DIFFERENT-VERSION";
}, /may not embed sourceVersion/);

expectRejection("an evidence entry embedding a denormalised url is rejected", (m) => {
  firstCheckedEvidence(m).entry.url = "https://example.org/not-the-source";
}, /may not embed url/);

expectRejection("a checked field with no claim fragment is rejected", (m) => {
  delete firstCheckedEvidence(m).entry.claimFragment;
}, /must name the claim fragment/);

expectRejection("two evidence rows of one field sharing a claim fragment are rejected", (m) => {
  const field = m.decisionProfile.fields.compartmentResolution;
  field.evidence[1].claimFragment = field.evidence[0].claimFragment;
}, /duplicate claimFragment/);

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

// -------------------------------------------------- P0-B: independent recheck is a real event
//
// An independent recheck is another entry in the same event collection. It must name a prior
// event that resolves, the same source (so the same pinned bytes), a later date, a different
// reviewer from the prior reader and the dataset owner, and an overlapping resolvable scope.

const REG = {
  owner: OWNER,
  reviewers: [
    { id: "ferroscope-maintainer", name: "owner", role: "dataset-owner" },
    { id: "claude-code-round4-implementer", name: "implementer", role: "implementer" },
    { id: "independent-review-codex", name: "codex", role: "independent-reviewer" },
  ],
  sources: [
    { id: "pmc5506843", documentClass: "accepted-author-manuscript", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5506843/", identifiers: {}, version: { label: "PMC5506843.1", retrievedAt: "2026-07-24", byteLength: 140459, sha256: "647b73b571ea97af59d24483fd4cb3b3f16112ab2dea20849216b7c9334769aa" }, scopes: [
      { id: "fig-3", label: "Fig. 3", surfaceType: "figure-caption", accessExtent: "complete-scope", boundary: "caption only" },
      { id: "fig-5", label: "Fig. 5", surfaceType: "figure-caption", accessExtent: "complete-scope", boundary: "caption only" },
      { id: "fig-6", label: "Fig. 6", surfaceType: "figure-caption", accessExtent: "complete-scope", boundary: "caption only" },
    ] },
    { id: "other-source", documentClass: "accepted-author-manuscript", url: "https://example.org/other", identifiers: {}, version: { label: "v", retrievedAt: "2026-07-24", byteLength: 1, sha256: null }, scopes: [{ id: "fig-3", label: "Fig. 3", surfaceType: "figure-caption", accessExtent: "complete-scope", boundary: "b" }] },
  ],
  reviewEvents: [
    { id: "claude-r4-kagan2017", sourceId: "pmc5506843", reviewState: "source-checked", reviewerId: "claude-code-round4-implementer", checkedAt: "2026-07-24", scopeIds: ["fig-3", "fig-5"], boundary: "manuscript", priorReviewEventId: null, agreement: null, discrepancyNote: null },
  ],
};
const validRecheck = () => ({ id: "codex-recheck-1", sourceId: "pmc5506843", reviewState: "independently-rechecked", reviewerId: "independent-review-codex", checkedAt: "2026-07-25", scopeIds: ["fig-3"], boundary: "second reading", priorReviewEventId: "claude-r4-kagan2017", agreement: "agrees", discrepancyNote: null });
const regWith = (event) => ({ ...REG, reviewEvents: [...REG.reviewEvents, event] });

const expectRecheckRejection = (name, mutate, pattern) => {
  try {
    const event = validRecheck();
    mutate(event);
    const problems = validateIndependentEvent(event, { registry: regWith(event), owner: OWNER });
    assert.ok(problems.some((p) => pattern.test(p)), `expected ${pattern}, got:\n  ${problems.join("\n  ") || "(none)"}`);
    cases.push({ name, ok: true });
  } catch (error) {
    cases.push({ name, ok: false, message: error.message });
  }
};

try {
  const problems = validateIndependentEvent(validRecheck(), { registry: regWith(validRecheck()), owner: OWNER });
  assert.deepEqual(problems, []);
  cases.push({ name: "a well-formed independent recheck passes", ok: true });
} catch (error) {
  cases.push({ name: "a well-formed independent recheck passes", ok: false, message: error.message });
}

expectRecheckRejection("a recheck naming a nonexistent prior event is rejected", (r) => {
  r.priorReviewEventId = "THIS-EVENT-DOES-NOT-EXIST";
}, /does not resolve to a real event/);

expectRecheckRejection("a recheck whose id equals the prior id is rejected", (r) => {
  r.id = "claude-r4-kagan2017";
  r.priorReviewEventId = "claude-r4-kagan2017";
}, /id must differ from the prior event id/);

expectRecheckRejection("a recheck of a different source is rejected", (r) => {
  r.sourceId = "other-source";
}, /same source as the event it reproduces/);

expectRecheckRejection("a recheck signed by the same reviewer as the prior event is rejected", (r) => {
  r.reviewerId = "claude-code-round4-implementer";
}, /different reviewer/);

expectRecheckRejection("a recheck signed by the dataset owner is rejected", (r) => {
  r.reviewerId = OWNER;
}, /may not be signed by the dataset owner/);

expectRecheckRejection("a recheck with no overlapping scope is rejected", (r) => {
  // fig-6 resolves in the source but the prior event covered only fig-3 and fig-5.
  r.scopeIds = ["fig-6"];
}, /do not overlap/);

expectRecheckRejection("a recheck citing a scope the source does not declare is rejected", (r) => {
  r.scopeIds = ["fig-99"];
}, /does not declare/);

expectRecheckRejection("a recheck dated before the prior event is rejected", (r) => {
  r.checkedAt = "2026-07-01";
}, /cannot predate/);

expectRecheckRejection("a recheck with no agreement outcome is rejected", (r) => {
  delete r.agreement;
}, /must record agreement/);

expectRecheckRejection("a partial-agreement recheck with no discrepancy note is rejected", (r) => {
  r.agreement = "partly-agrees";
  r.discrepancyNote = null;
}, /must record a discrepancy note/);

// A duplicate event id is caught by the whole-registry validation, not by the pairwise rule.
try {
  const dup = validRecheck();
  dup.id = "claude-r4-kagan2017";
  const problems = validateRegistry({ ...REG, reviewEvents: [...REG.reviewEvents, dup] });
  assert.ok(problems.some((p) => /duplicate review event id/.test(p)), problems.join(" | "));
  cases.push({ name: "a duplicate review event id fails whole-registry validation", ok: true });
} catch (error) {
  cases.push({ name: "a duplicate review event id fails whole-registry validation", ok: false, message: error.message });
}

// A second source minted under an existing id but with different bytes must fail (the review's
// acceptance attack, cross-file form).
try {
  const forged = { ...REG.sources[0], url: "https://example.org/forged", version: { label: "forged", retrievedAt: "2026-07-24", byteLength: 2, sha256: null } };
  const problems = validateRegistry({ ...REG, sources: [...REG.sources, forged] });
  assert.ok(problems.some((p) => /duplicate source id/.test(p)), problems.join(" | "));
  cases.push({ name: "a forged second source under an existing id fails registry validation", ok: true });
} catch (error) {
  cases.push({ name: "a forged second source under an existing id fails registry validation", ok: false, message: error.message });
}

const failures = cases.filter((c) => !c.ok);
for (const failure of failures) console.error(`FAIL ${failure.name}\n      ${failure.message}`);
if (failures.length) {
  console.error(`\n${failures.length} of ${cases.length} method-review mutation tests failed.`);
  process.exit(1);
}
console.log(`Method-review mutation tests passed: ${cases.length} cases. A fabricated source/event/scope join, a forged embedded version, a missing or duplicate claim fragment, an inference hidden as explicit, and an independent recheck that fails to resolve its prior event, its source, its reviewer, its date, its scope overlap or its agreement each fail.`);
