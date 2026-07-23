// Claim-specific review contract for method decision fields (round-6 P0-C/P0-E/P1-B).
//
// Round 5 gave each module stable-looking ids, but the source record and the review event
// were copied into several modules; a forged version in one copy passed validation because
// nothing joined the copies. Round 6 removes the copies. A source route now carries only a
// reference — `sourceId`, an optional `reviewEventId`, and its own local purpose — and every
// authority field (URL, pinned version, reviewer, date, reviewed scopes) is resolved from the
// one canonical registry in lib/source-registry.mjs. A decision field references a route, a
// review event and a reviewed scope by id, declares how the passage supports the claim
// (explicit / derived / analytical-inference / curated-guidance) and names the exact clause it
// supports, so a single vague row can no longer appear to cover a multi-clause paragraph.
//
// scripts/validate-v09.mjs imports this in Node; scripts/test-method-review.mjs imports it to
// break the contract on purpose. The independent-review rule lives in source-registry.mjs so
// the registry, the graph and these tests read one contract.

import { isCheckedState, isIndependentEvent, validateIndependentEvent } from "./source-registry.mjs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// The thirteen questions a reader has to answer before reusing a result.
export const METHOD_DECISION_AXES = [
  "specimen", "question", "perturbation", "readout", "quantificationUnit", "instrument",
  "positiveControl", "negativeControl", "processControl", "orthogonalConfirmation",
  "timing", "compartmentResolution", "confounders",
];

export const FIELD_STATUSES = ["source-checked", "pending-source-review"];
export const SOURCE_ROUTE_KINDS = ["vendor-protocol", "field-recommendation", "original-research-demonstration", "local-laboratory-capability", "unclassified-source"];
export const ROUTE_PURPOSES = ["primary-source-reading", "declared-source-not-opened"];

// How the cited passage relates to the sentence. This is the compensation for a validator
// that cannot read: an analytical leap is not hidden behind a citation, it is declared as one.
export const SUPPORT_MODES = ["explicit", "derived", "analytical-inference", "curated-guidance"];

// A support note attached to an "explicit" claim may not itself admit the claim is not in the
// source. If it does, the claim is not explicit and must be relabelled.
const INFERENCE_MARKERS = /\b(inferred|analytical inference|not stated|unstated|we assume|assumed|general knowledge|surmise)\b/i;

// The control-axis definitions, machine-readable so every module and the public UI use one
// vocabulary. A comparator must not be relabelled to fill an axis it does not answer.
export const CONTROL_AXES = {
  positiveControl: "A condition or reference material expected to produce or verify the assay's positive signal.",
  negativeControl: "A matched condition or reference expected not to produce that signal.",
  processControl: "A control for extraction, loading, handling, acquisition or analytical performance.",
  orthogonalConfirmation: "A different measurement or perturbation that tests the same biological conclusion by another principle.",
};

// Validates one method module's routes and decision fields, resolving every reference through
// the canonical registry. `resolver` is createResolver(registry); `owner` is the dataset owner
// so an independent recheck cannot be signed by the owner.
export function validateMethodReview(method, { labIds = new Set(), owner = null, resolver = null } = {}) {
  const problems = [];
  const where = `Method ${method.id}`;
  const push = (message) => problems.push(`${where}: ${message}`);
  if (!resolver) { push("was validated without a source registry resolver; the review contract cannot be checked"); return { problems, checked: 0, pending: 0 }; }

  // --------------------------------------------------------------------- source routes
  const routes = method.sourceRoutes || [];
  if (!routes.length) push("declares no source route");

  const routesById = new Map();
  for (const [index, route] of routes.entries()) {
    const rw = `${where} sourceRoutes[${index}]`;
    if (!route.id) problems.push(`${rw}: a source route needs a stable id`);
    else if (routesById.has(route.id)) problems.push(`${rw}: duplicate source route id ${route.id}`);
    else routesById.set(route.id, route);

    if (!SOURCE_ROUTE_KINDS.includes(route.kind)) problems.push(`${rw}: unknown route kind ${route.kind}`);
    if (!route.kindBasis) problems.push(`${rw}: a route must say how its kind was decided`);
    if (!route.boundary) problems.push(`${rw}: a route must state what declaring it does not prove`);
    if (!ROUTE_PURPOSES.includes(route.routePurpose)) problems.push(`${rw}: routePurpose must be one of ${ROUTE_PURPOSES.join(", ")}`);

    // A route carries no authority of its own; it resolves one canonical source.
    for (const forbidden of ["url", "sourceVersion", "checkedAt", "checkedBy", "reviewerId", "verificationDepth", "reviewedScopes", "status"]) {
      if (forbidden in route) problems.push(`${rw}: a route may not embed ${forbidden}; that is registry authority, not a route copy`);
    }
    if (!route.sourceId) { problems.push(`${rw}: a route must reference a canonical sourceId`); continue; }
    const source = resolver.source(route.sourceId);
    if (!source) { problems.push(`${rw}: sourceId ${JSON.stringify(route.sourceId)} does not resolve in the registry`); continue; }

    if (route.reviewEventId) {
      const event = resolver.event(route.reviewEventId);
      if (!event) { problems.push(`${rw}: reviewEventId ${JSON.stringify(route.reviewEventId)} does not resolve in the registry`); continue; }
      if (event.sourceId !== route.sourceId) problems.push(`${rw}: review event ${event.id} covers source ${event.sourceId}, not ${route.sourceId}`);
      if (!isCheckedState(event.reviewState)) problems.push(`${rw}: review event ${event.id} is ${event.reviewState}, so a checked route may not cite it`);
      if (route.routePurpose !== "primary-source-reading") problems.push(`${rw}: a route naming a review event must declare routePurpose primary-source-reading`);
      // An independent recheck is a resolvable second event, enforced by the registry rule.
      if (isIndependentEvent(event)) problems.push(...validateIndependentEvent(event, { registry: resolver.registry, owner }));
    } else if (route.routePurpose !== "declared-source-not-opened") {
      problems.push(`${rw}: a route with no review event must declare routePurpose declared-source-not-opened; "not read" cannot be dressed as a reading`);
    }
  }
  const firstSource = routes[0] ? resolver.source(routes[0].sourceId) : null;
  if (firstSource && firstSource.url !== method.source) push("the first source route must resolve to the module's declared source");

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
      const fragments = new Set();
      for (const [ei, entry] of evidence.entries()) {
        const ew = `${fw} evidence[${ei}]`;
        const route = routesById.get(entry.sourceRecordId);
        if (!route) { problems.push(`${ew}: unknown source route id ${JSON.stringify(entry.sourceRecordId)}`); continue; }
        const event = route.reviewEventId ? resolver.event(route.reviewEventId) : null;
        if (!event || !isCheckedState(event.reviewState)) { problems.push(`${ew}: references route ${route.id}, whose route is not a checked reading`); continue; }
        if (entry.reviewEventId !== route.reviewEventId) problems.push(`${ew}: review event ${JSON.stringify(entry.reviewEventId)} does not match route ${route.id}'s event ${JSON.stringify(route.reviewEventId)}`);
        const scope = resolver.scope(route.sourceId, entry.scopeId);
        if (!scope) { problems.push(`${ew}: unknown scope id ${JSON.stringify(entry.scopeId)} in source ${route.sourceId}`); continue; }
        if (!SUPPORT_MODES.includes(entry.supportMode)) problems.push(`${ew}: supportMode must be one of ${SUPPORT_MODES.join(", ")}`);
        if (!entry.supportNote) problems.push(`${ew}: a checked field must explain how the passage supports the claim`);
        // P0-E: every evidence row names the exact clause it supports, and no two rows of one
        // field may name the same clause or none, so a vague row cannot cover a whole paragraph.
        if (!entry.claimFragment) problems.push(`${ew}: a checked field must name the claim fragment (clause) this evidence supports`);
        else if (fragments.has(entry.claimFragment)) problems.push(`${ew}: duplicate claimFragment ${JSON.stringify(entry.claimFragment)}; each evidence row must map a distinct clause`);
        else fragments.add(entry.claimFragment);
        if (entry.supportMode === "explicit" && INFERENCE_MARKERS.test(entry.supportNote || "")) {
          problems.push(`${ew}: marked explicit, but the support note admits inference or an unstated claim; relabel its support mode`);
        }
        for (const forbidden of ["url", "sourceVersion", "checkedAt", "checkedBy", "assertedDepth"]) {
          if (forbidden in entry) problems.push(`${ew}: evidence may not embed ${forbidden}; resolve it from the registry instead`);
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
  // Every calendar date this module still carries must be a real ISO date (defensive; dates
  // now live in the registry, but a stray one must not slip through unshaped).
  for (const key of ["checkedAt"]) if (key in profile && profile[key] && !ISO_DATE.test(profile[key])) push(`decisionProfile.${key} is not an ISO date`);

  return { problems, checked, pending };
}
