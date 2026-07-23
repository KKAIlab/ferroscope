// Claim-specific review contract for method decision fields (round-5 P0-A/P0-C/P1-A).
//
// Round 4 could prove a citation-shaped object existed; it could not prove the cited source
// and scope supported the sentence that received the label. This module makes the join
// enforceable. A source-checked decision field does not carry loose URL/date/reviewer
// strings that a validator can only shape-check. It references, by stable id, one source
// record, one review event inside that record, and one reviewed scope inside that event —
// and it declares how the passage supports the claim.
//
// scripts/validate-v09.mjs imports this in Node; scripts/test-method-review.mjs imports it to
// break the contract on purpose. Keeping the rule here means the validator and the mutation
// tests read the same contract rather than two drifting copies.

import { VERIFICATION_DEPTHS, verificationDepthRank } from "./graph.mjs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS = /^https:\/\//;

// The thirteen questions a reader has to answer before reusing a result.
export const METHOD_DECISION_AXES = [
  "specimen", "question", "perturbation", "readout", "quantificationUnit", "instrument",
  "positiveControl", "negativeControl", "processControl", "orthogonalConfirmation",
  "timing", "compartmentResolution", "confounders",
];

export const FIELD_STATUSES = ["source-checked", "pending-source-review"];
export const SOURCE_ROUTE_KINDS = ["vendor-protocol", "field-recommendation", "original-research-demonstration", "local-laboratory-capability", "unclassified-source"];
// The route status vocabulary is the same one the graph maps, so a status one validator
// accepts and another rejects can no longer exist (round-4 P1-1).
export const ROUTE_STATUSES = ["source-checked", "independently-rechecked", "not-checked", "unavailable"];
export const REVIEWABLE_STATUSES = ["source-checked", "independently-rechecked"];

// How the cited passage relates to the sentence. This is the compensation for a validator
// that cannot read: an analytical leap is not hidden behind a citation, it is declared as
// one and shown to the reader.
export const SUPPORT_MODES = ["explicit", "derived", "analytical-inference", "curated-guidance"];

// A support note attached to an "explicit" claim may not itself admit that the claim is not
// in the source. If it does, the claim is not explicit and must be relabelled.
const INFERENCE_MARKERS = /\b(inferred|analytical inference|not stated|unstated|we assume|assumed|general knowledge|surmise)\b/i;

export const INDEPENDENT_AGREEMENTS = ["agrees", "partly-agrees", "disagrees"];

// The control-axis definitions, machine-readable so every module and the public UI use one
// vocabulary. A comparator must not be relabelled to fill an axis it does not answer.
export const CONTROL_AXES = {
  positiveControl: "A condition or reference material expected to produce or verify the assay's positive signal.",
  negativeControl: "A matched condition or reference expected not to produce that signal.",
  processControl: "A control for extraction, loading, handling, acquisition or analytical performance.",
  orthogonalConfirmation: "A different measurement or perturbation that tests the same biological conclusion by another principle.",
};

const rank = (depth) => verificationDepthRank(depth);

// Validates one method module's routes, decision fields and any independent-review events.
// `owner` is the dataset owner id, so an independent recheck cannot be signed by the owner.
export function validateMethodReview(method, { labIds = new Set(), owner = null } = {}) {
  const problems = [];
  const where = `Method ${method.id}`;
  const push = (message) => problems.push(`${where}: ${message}`);

  // --------------------------------------------------------------------- source records
  const routes = method.sourceRoutes || [];
  if (!routes.length) push("declares no source route");

  const routesById = new Map();
  for (const [index, route] of routes.entries()) {
    const rw = `${where} sourceRoutes[${index}]`;
    if (!route.id) problems.push(`${rw}: a source record needs a stable id`);
    else if (routesById.has(route.id)) problems.push(`${rw}: duplicate source record id ${route.id}`);
    else routesById.set(route.id, route);

    if (!SOURCE_ROUTE_KINDS.includes(route.kind)) problems.push(`${rw}: unknown route kind ${route.kind}`);
    if (!route.kindBasis) problems.push(`${rw}: a route must say how its kind was decided`);
    if (!HTTPS.test(route.url || "")) problems.push(`${rw}: an HTTPS source URL is required`);
    if (!ROUTE_STATUSES.includes(route.status)) problems.push(`${rw}: unknown status ${route.status}`);
    if (!VERIFICATION_DEPTHS.includes(route.verificationDepth)) problems.push(`${rw}: a route must record how far it was read`);
    if (!route.boundary) problems.push(`${rw}: a route must state what declaring it does not prove`);

    const reviewable = REVIEWABLE_STATUSES.includes(route.status);
    const scopes = route.reviewedScopes || [];
    const scopeIds = new Set();
    for (const [si, scope] of scopes.entries()) {
      const sw = `${rw} reviewedScopes[${si}]`;
      if (!scope.id) problems.push(`${sw}: a reviewed scope needs a stable id`);
      else if (scopeIds.has(scope.id)) problems.push(`${sw}: duplicate scope id ${scope.id}`);
      else scopeIds.add(scope.id);
      if (!scope.label) problems.push(`${sw}: a reviewed scope needs a human-readable label`);
      if (reviewable) {
        if (!VERIFICATION_DEPTHS.includes(scope.verificationDepth)) problems.push(`${sw}: a reviewed scope must pin its own verification depth`);
        else if (rank(scope.verificationDepth) > rank(route.verificationDepth)) problems.push(`${sw}: a scope may not be read deeper (${scope.verificationDepth}) than its record's summary maximum (${route.verificationDepth})`);
        if (!scope.accessSurface) problems.push(`${sw}: a reviewed scope must state the surface that was opened`);
        if (!scope.boundary) problems.push(`${sw}: a reviewed scope must state what it did not establish`);
      }
    }

    if (reviewable) {
      if (!ISO_DATE.test(route.checkedAt || "")) problems.push(`${rw}: a checked route must record an ISO check date`);
      if (!route.checkedBy) problems.push(`${rw}: a checked route must record who read it`);
      if (!route.reviewerId) problems.push(`${rw}: a checked route must record a stable reviewer id`);
      if (!route.reviewEventId) problems.push(`${rw}: a checked route must carry a review-event id its fields can reference`);
      if (!route.sourceVersion) problems.push(`${rw}: a checked route must pin the version, accession or retrieval it read`);
      if (!scopes.length) problems.push(`${rw}: a checked route must state what was read`);
    } else {
      if (route.checkedAt) problems.push(`${rw}: an unchecked route must not carry a check date`);
      if (route.reviewEventId) problems.push(`${rw}: an unchecked route must not carry a review-event id`);
      if (scopes.length) problems.push(`${rw}: an unchecked route must not claim a scope; "not read" cannot be dressed as partial coverage`);
    }

    // Independent recheck is a second event, not an edited status string (round-4 P1-1).
    if (route.status === "independently-rechecked") problems.push(...validateIndependentReview(route, { rw, owner, routesById, routes }));
  }
  if (routes[0]?.url !== method.source) push("the first source route must be the module's declared source");

  // --------------------------------------------------------------------- decision fields
  const profile = method.decisionProfile;
  if (!profile) { push("has no decisionProfile; every module must answer the decision axes or say it cannot"); return { problems, checked: 0, pending: 0 }; }
  if (!FIELD_STATUSES.includes(profile.reviewState)) push(`decisionProfile.reviewState must be one of ${FIELD_STATUSES.join(", ")}`);

  let checked = 0;
  let pending = 0;
  for (const axis of METHOD_DECISION_AXES) {
    const field = profile.fields?.[axis];
    if (!field) { push(`does not answer the ${axis} axis, not even to say it is unresolved`); continue; }
    if (!FIELD_STATUSES.includes(field.status)) { push(`${axis}: status must be one of ${FIELD_STATUSES.join(", ")}`); continue; }
    const fw = `${where}.${axis}`;

    if (field.status === "source-checked") {
      checked += 1;
      if (!field.value) problems.push(`${fw} is marked source-checked but records no value`);
      const evidence = field.evidence || [];
      if (!evidence.length) problems.push(`${fw} is marked source-checked but references no review evidence`);
      for (const [ei, entry] of evidence.entries()) {
        const ew = `${fw} evidence[${ei}]`;
        // A field joins to evidence only through stable ids. A duplicated URL/date/reviewer
        // string is never the join key.
        const route = routesById.get(entry.sourceRecordId);
        if (!route) { problems.push(`${ew}: unknown source record id ${JSON.stringify(entry.sourceRecordId)}`); continue; }
        if (!REVIEWABLE_STATUSES.includes(route.status)) problems.push(`${ew}: references source record ${route.id}, whose status ${route.status} is not a review`);
        if (entry.reviewEventId !== route.reviewEventId) problems.push(`${ew}: review event ${JSON.stringify(entry.reviewEventId)} does not match record ${route.id}'s event ${JSON.stringify(route.reviewEventId)}`);
        const scope = (route.reviewedScopes || []).find((s) => s.id === entry.scopeId);
        if (!scope) { problems.push(`${ew}: unknown scope id ${JSON.stringify(entry.scopeId)} in record ${route.id}`); continue; }
        if (!SUPPORT_MODES.includes(entry.supportMode)) problems.push(`${ew}: supportMode must be one of ${SUPPORT_MODES.join(", ")}`);
        if (!entry.supportNote) problems.push(`${ew}: a checked field must explain how the passage supports the claim`);
        if (entry.supportMode === "explicit" && INFERENCE_MARKERS.test(entry.supportNote || "")) {
          problems.push(`${ew}: marked explicit, but the support note admits inference or an unstated claim; relabel its support mode`);
        }
        // Denormalised display fields are allowed, but only if they agree byte-for-byte with
        // the canonical record. A field cannot quietly carry a different URL, version or date.
        if ("url" in entry && entry.url !== route.url) problems.push(`${ew}: denormalised url disagrees with record ${route.id}`);
        if ("sourceVersion" in entry && entry.sourceVersion !== route.sourceVersion) problems.push(`${ew}: denormalised sourceVersion disagrees with record ${route.id}`);
        if ("checkedAt" in entry && entry.checkedAt !== route.checkedAt) problems.push(`${ew}: denormalised checkedAt disagrees with record ${route.id}`);
        if ("checkedBy" in entry && entry.checkedBy !== route.checkedBy) problems.push(`${ew}: denormalised checkedBy disagrees with record ${route.id}`);
        // A field may not claim a depth its scope never reached.
        if (entry.assertedDepth && rank(entry.assertedDepth) > rank(scope.verificationDepth)) {
          problems.push(`${ew}: claims depth ${entry.assertedDepth} from a scope read only to ${scope.verificationDepth}`);
        }
      }
    } else {
      pending += 1;
      if (field.value) problems.push(`${fw} carries a value while declaring itself unverified; promote it with a source or leave it null`);
      if (!field.unresolved) problems.push(`${fw} is pending but does not say what has to be read to resolve it`);
    }
  }
  if (profile.sourceCheckedFields !== checked) push(`decisionProfile.sourceCheckedFields says ${profile.sourceCheckedFields} but ${checked} fields are source-checked`);
  if (profile.pendingFields !== pending) push(`decisionProfile.pendingFields says ${profile.pendingFields} but ${pending} fields are pending`);
  if (pending > 0 && profile.reviewState !== "pending-source-review") push(`has ${pending} unresolved fields but does not declare itself provisional`);
  if (pending > 0 && !profile.provisionalBecause) push("is provisional but does not say why");

  return { problems, checked, pending };
}

// An independently-rechecked record must be a genuine second event: a different party, a
// prior event to reproduce, the same pinned source version, an overlapping scope and an
// explicit agreement outcome. None of this can be conjured by editing a status string.
export function validateIndependentReview(route, { rw, owner, routesById = new Map() } = {}) {
  const problems = [];
  const review = route.independentReview;
  if (!review) { problems.push(`${rw}: an independently-rechecked record must carry an independentReview event`); return problems; }
  if (!review.reviewEventId) problems.push(`${rw}: the recheck event needs its own id`);
  if (!review.priorReviewEventId) problems.push(`${rw}: an independent recheck must name the prior review event it reproduces`);
  if (!review.reviewerId) problems.push(`${rw}: an independent recheck must name its reviewer`);
  else {
    if (owner && review.reviewerId === owner) problems.push(`${rw}: an independent recheck may not be signed by the dataset owner`);
    if (review.reviewerId === route.reviewerId) problems.push(`${rw}: an independent recheck must use a different reviewer from the original event`);
  }
  if (!review.sourceVersion) problems.push(`${rw}: an independent recheck must pin the source version it re-read`);
  else if (route.sourceVersion && review.sourceVersion !== route.sourceVersion) problems.push(`${rw}: an independent recheck must cover the same source version as the event it reproduces`);
  const overlap = review.scopeIds || [];
  const recordScopes = new Set((route.reviewedScopes || []).map((s) => s.id));
  if (!overlap.length) problems.push(`${rw}: an independent recheck must overlap at least one reviewed scope`);
  else if (!overlap.some((id) => recordScopes.has(id))) problems.push(`${rw}: the recheck's scopes do not overlap the record's reviewed scopes`);
  if (!INDEPENDENT_AGREEMENTS.includes(review.agreement)) problems.push(`${rw}: an independent recheck must record agreement as one of ${INDEPENDENT_AGREEMENTS.join(", ")}`);
  if (review.agreement && review.agreement !== "agrees" && !review.note) problems.push(`${rw}: a recheck that does not fully agree must record what it found`);
  return problems;
}
