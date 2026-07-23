// Builds the provenance graph from the curated layers.
//
// The graph is derived at load time rather than committed as a generated file, so it
// cannot drift out of step with the records it is derived from. app.js imports it in the
// browser and scripts/validate-graph.mjs imports it in Node, so both see the same graph.
//
// Nothing here infers a relation from shared keywords. Every edge comes from a record
// that a person wrote and that names its own source: a curated claim read out of an
// audited figure, a laboratory attribution record, a published notice, a stated method
// boundary. An edge that cannot name where it came from is a bug, not a weak edge, and
// the builder throws rather than emitting it.

import { createResolver, validateRegistry, validateIndependentEvent, isIndependentEvent, surfaceToDepth } from "./source-registry.mjs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const RELATIONS = [
  "SUPPORTS_IN_CONTEXT",
  "CONTRADICTS",
  "CHALLENGES_ATTRIBUTION",
  "REPLICATES",
  "USES_METHOD",
  "MEASURES",
  "CANNOT_DISTINGUISH",
  "CONTRIBUTED_TO",
  "PRE_INDEPENDENCE_WORK",
  "CORRECTED_BY",
  "TESTS_IN",
  "USES_PERTURBATION",
  "BOUNDED_BY",
];

// Where an edge came from, which is not the same question as how far it was checked. A
// claim read out of an audited figure and a curated assay-class boundary are both useful
// and both legitimate, but they are not the same kind of statement and must not render
// with the same confidence.
export const EDGE_PROVENANCE_CLASSES = [
  "paper-backed-experimental",
  "attribution-record",
  "bibliographic-event",
  "curated-method-module",
];

// How far a review got. This is a separate question from *when* it happened, and the two
// were previously collapsed: any record carrying an ISO date was promoted to
// "source-checked". A date can mean the record was created, migrated or metadata-checked.
// It never proves that a full text, figure, legend, method or supplement was opened.
//
// The ladder is ordered by *what document surface an identified reviewer demonstrably
// opened*. The first three ranks share rank 0 on purpose: a curated judgement, an unread
// source and a claim rewritten out of this project's own archive all have the same
// property, which is that no external document was opened in this repository.
export const VERIFICATION_DEPTHS = [
  "not-read",
  "curated-unverified",
  "archive-derived",
  "metadata-only",
  "metadata-checked",
  "abstract-checked",
  "figures-legends-checked",
  "methods-checked",
  "supplement-checked",
  "full-text-rechecked",
  "raw-data-rechecked",
];

const DEPTH_RANK = {
  "not-read": 0,
  "curated-unverified": 0,
  "archive-derived": 0,
  "metadata-only": 1,
  "metadata-checked": 1,
  "abstract-checked": 2,
  "figures-legends-checked": 3,
  "methods-checked": 4,
  "supplement-checked": 5,
  "full-text-rechecked": 6,
  "raw-data-rechecked": 7,
};

// What kind of review state the record is in. Stored explicitly on the source record and
// never derived from any other field.
export const EDGE_REVIEW_STATES = [
  "recorded-unverified",
  "archive-derived",
  "source-checked",
  "independently-rechecked",
];

const STATE_RANK = {
  "recorded-unverified": 0,
  "archive-derived": 1,
  "source-checked": 2,
  "independently-rechecked": 3,
};

// The two states that assert somebody opened the cited source and recorded what they read.
export const isSourceChecked = (state) => state === "source-checked" || state === "independently-rechecked";

export const verificationDepthRank = (depth) => (depth in DEPTH_RANK ? DEPTH_RANK[depth] : -1);
export const reviewStateRank = (state) => (state in STATE_RANK ? STATE_RANK[state] : -1);

// Depths at which nothing outside this repository was opened. A record may not call itself
// source-checked while sitting at one of them, however many dates it carries.
const OPENED_NOTHING = new Set(["not-read", "curated-unverified", "archive-derived"]);

export const REVIEW_STATE_LABELS = {
  "recorded-unverified": "recorded, source not read",
  "archive-derived": "archive-derived claim · source recheck pending",
  "source-checked": "source-checked",
  "independently-rechecked": "independently rechecked",
};

// The contract a *source review record* has to satisfy before anything may cite it as
// evidence of review. This is the rule that P0-A asked for: state is declared, not derived,
// and the fields that make a review auditable — who, when, what scope, which version, what
// was not covered — are required together or not at all.
export function checkReviewRecord(review, where = "review record") {
  const problems = [];
  const require = (condition, message) => { if (!condition) problems.push(`${where}: ${message}`); };

  if (!review || typeof review !== "object") return [`${where}: no review record was supplied, so nothing may be promoted`];

  require(EDGE_REVIEW_STATES.includes(review.reviewState), `reviewState must be one of ${EDGE_REVIEW_STATES.join(", ")}`);
  require(VERIFICATION_DEPTHS.includes(review.verificationDepth), `verificationDepth must be one of ${VERIFICATION_DEPTHS.join(", ")}`);
  require(review.checkedAt === null || review.checkedAt === undefined || ISO_DATE.test(review.checkedAt), "checkedAt must be an ISO date or explicitly null");
  require(Array.isArray(review.scope), "scope must be an array, empty when nothing was read");

  if (isSourceChecked(review.reviewState)) {
    // Everything below is what a date on its own cannot supply. Requiring them together is
    // the whole point: any one of them missing means the claim of review is unauditable.
    require(ISO_DATE.test(review.checkedAt || ""), "a source-checked record must name the ISO date on which the source was read");
    require(Boolean(review.checkedBy), "a source-checked record must name who read the source");
    require(/^https:\/\//.test(review.sourceUrl || ""), "a source-checked record must name the HTTPS source that was opened");
    require(Boolean(review.sourceVersion), "a source-checked record must pin the version, accession or retrieval it read, because sources change");
    require(Array.isArray(review.scope) && review.scope.length > 0, "a source-checked record must say what was actually read; a date is not a scope");
    require(Boolean(review.boundary), "a source-checked record must state what it did not inspect or establish");
    require(
      !OPENED_NOTHING.has(review.verificationDepth),
      `verificationDepth ${JSON.stringify(review.verificationDepth)} means no external document was opened, so the record may not declare itself source-checked`,
    );
  } else {
    // The mirror rule. An unread or archive-derived record may not accumulate a scope it
    // never earned, which is how a migration date turned into apparent coverage.
    require(
      !Array.isArray(review.scope) || review.scope.length === 0,
      `reviewState ${JSON.stringify(review.reviewState)} did not open the source, so it may not declare a read scope`,
    );
  }

  if (review.reviewState === "archive-derived") {
    require(
      review.verificationDepth === "archive-derived",
      "an archive-derived claim must sit at archive-derived depth; a migration date does not deepen it",
    );
  }
  return problems;
}

export const NODE_TYPES = [
  "paper",
  "laboratory",
  "method",
  "mechanism",
  "disease_context",
  "compound_or_perturbation",
  "evidence_boundary",
  "correction_or_dispute",
];

const NODE_PREFIX = {
  paper: "paper",
  laboratory: "lab",
  method: "method",
  mechanism: "mechanism",
  disease_context: "context",
  compound_or_perturbation: "perturbation",
  evidence_boundary: "boundary",
  correction_or_dispute: "notice",
};

const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const nodeId = (type, key) => `${NODE_PREFIX[type]}:${key}`;

// A reviewed scope may be recorded as a bare label — which inherits the record's summary
// depth — or as a structured entry that pins its own depth, access surface and boundary.
// This is what P0-2 asked for: reading a figure caption in a manuscript whose Methods were
// also read must inherit figures-legends-checked, not methods-checked. The record-level
// verificationDepth becomes a summary maximum, never a permission to promote every scope.
export const scopeLabel = (scope) => (typeof scope === "string" ? scope : scope?.label);
export const scopeKey = (scope) => (typeof scope === "string" ? scope : (scope?.id ?? scope?.label));
export const scopeMatches = (scope, ref) => Boolean(ref) && (scopeLabel(scope) === ref || scopeKey(scope) === ref);
export const scopeDepthOf = (scope, recordDepth) =>
  (scope && typeof scope === "object" && scope.verificationDepth) ? scope.verificationDepth : recordDepth;

// A laboratory role is a claim about who did what. It is never inferred from author
// order here; it is copied from the attribution layer together with its stated basis.
const ROLE_RELATION = {
  lead: "CONTRIBUTED_TO",
  "co-lead": "CONTRIBUTED_TO",
  "method collaborator": "CONTRIBUTED_TO",
  "conceptual collaborator": "CONTRIBUTED_TO",
  "contributing-author": "CONTRIBUTED_TO",
  "pre-independence": "PRE_INDEPENDENCE_WORK",
};

const NOTICE_RELATION = {
  "author-correction": "CORRECTED_BY",
  "publisher-correction": "CORRECTED_BY",
  "editor-note": "CORRECTED_BY",
  "expression-of-concern": "CORRECTED_BY",
  retraction: "CORRECTED_BY",
  "matters-arising": "CHALLENGES_ATTRIBUTION",
  reply: "CHALLENGES_ATTRIBUTION",
  "article-stage-reclassification": "CORRECTED_BY",
};

// The contract every edge has to satisfy, kept here rather than in the validator so the
// renderer, the validator and the negative test all read the same rule.
//
// An edge inherits its review state from the source record it was read out of. It may never
// exceed that record on either axis: not in state, not in depth. The date the record carries
// plays no part in deciding any of this — it only says when.
export function checkEdgeContract(edge = {}, where = "edge") {
  const problems = [];
  const require = (condition, message) => { if (!condition) problems.push(`${where}: ${message}`); };

  require(RELATIONS.includes(edge.relation), "relation is outside the controlled vocabulary");
  require(EDGE_PROVENANCE_CLASSES.includes(edge.provenanceClass), `provenanceClass must be one of ${EDGE_PROVENANCE_CLASSES.join(", ")}`);
  require(EDGE_REVIEW_STATES.includes(edge.reviewState), `reviewState must be one of ${EDGE_REVIEW_STATES.join(", ")}`);
  require(edge.paperId !== null || Boolean(edge.paperlessBasis), "an edge without a paperId must state why no paper backs it");
  require(Boolean(edge.claimScope), "every edge must state the scope of what it claims");
  require(Boolean(edge.conditionVector || edge.conditionVectorReason), "an edge without a condition vector must say why none applies");
  require(/^https:\/\//.test(edge.sourceUrl || ""), "an HTTPS source URL is required");
  require(VERIFICATION_DEPTHS.includes(edge.verificationDepth), `verificationDepth must be one of ${VERIFICATION_DEPTHS.join(", ")}`);
  require(Boolean(edge.confidence && edge.confidenceBasis), "confidence and its basis are both required");

  require(edge.checkedAt === null || ISO_DATE.test(edge.checkedAt || ""), "checkedAt must be an ISO date or explicitly null");

  // The rule P0-A asked for, stated in the negative so it cannot be satisfied by accident:
  // a date is not a promotion. An edge is source-checked only when the record it came from
  // said who read what, and the edge names the scope entry that covers its own assertion.
  if (isSourceChecked(edge.reviewState)) {
    require(ISO_DATE.test(edge.checkedAt || ""), "a source-checked edge must carry the ISO date its source record was read");
    require(Boolean(edge.checkedBy), "a source-checked edge must name who read the source");
    require(Boolean(edge.sourceVersion), "a source-checked edge must carry the pinned version of the source it was read from");
    require(
      Boolean(edge.scopeRef),
      "a source-checked edge must name the scope entry of its source record that covers this assertion; without it the edge is claiming coverage the record never granted",
    );
    require(
      !OPENED_NOTHING.has(edge.verificationDepth),
      `verificationDepth ${JSON.stringify(edge.verificationDepth)} means nothing was opened, so this edge may not be called source-checked`,
    );
  } else {
    require(Boolean(edge.reviewPendingReason), "an edge that is not source-checked must state what has not been read yet");
    require(!edge.scopeRef, "an edge that is not source-checked may not name a read scope");
  }

  // An edge may not outrun the record it derives from, in either direction. This is what
  // stops a figure-level claim from inheriting the confidence of a deeper reading of some
  // other part of the same paper.
  require(Boolean(edge.sourceReviewState), "every edge must name the review state of the record it was derived from");
  require(Boolean(edge.sourceVerificationDepth), "every edge must name the verification depth of the record it was derived from");
  require(
    reviewStateRank(edge.reviewState) <= reviewStateRank(edge.sourceReviewState),
    `the edge claims reviewState ${JSON.stringify(edge.reviewState)} from a source record that is only ${JSON.stringify(edge.sourceReviewState)}`,
  );
  require(
    verificationDepthRank(edge.verificationDepth) <= verificationDepthRank(edge.sourceVerificationDepth),
    `the edge claims verificationDepth ${JSON.stringify(edge.verificationDepth)} from a source record read only to ${JSON.stringify(edge.sourceVerificationDepth)}`,
  );

  // A curated statement about an assay class is not a reading of a paper, in either
  // direction. Letting the two blur is what made a null-check-date method edge look like
  // an archive-derived paper claim.
  require(
    edge.provenanceClass !== "curated-method-module" || edge.paperId === null,
    "a curated method-module edge must not claim a paper as its backing",
  );
  require(
    edge.provenanceClass !== "paper-backed-experimental" || (edge.paperId !== null && edge.paperId !== undefined),
    "an edge classed as paper-backed must name the paper it was read from",
  );
  return problems;
}

export function buildGraph({ papers, labs, labsEn, links, methods, network, claims, sourceReviews }) {
  const nodes = new Map();
  const edges = [];
  const problems = [];

  // The canonical registry is the single authority for source records and review events. The
  // graph resolves every method route through it and refuses to build if the registry is
  // internally inconsistent — so an invalid independent-review chain fails the build even when
  // buildGraph is called directly, outside the full validation suite (P0-C).
  const resolver = createResolver(sourceReviews || { sources: [], reviewEvents: [], reviewers: [] });
  if (sourceReviews) problems.push(...validateRegistry(sourceReviews));

  // Picks the review record whose recorded scope actually covers this assertion, together
  // with the exact scope entry that covers it, so the edge inherits that scope's own depth
  // rather than the record's summary maximum. Selective by construction: reading Fig. 5e
  // promotes what was read out of Fig. 5e and leaves the rest of the same paper exactly where
  // it was.
  const reviewCovering = (records, scopeRef) => {
    if (!scopeRef) return null;
    const candidates = [];
    for (const record of records || []) {
      if (!isSourceChecked(record?.reviewState) || !Array.isArray(record.scope)) continue;
      const scopeEntry = record.scope.find((scope) => scopeMatches(scope, scopeRef));
      if (scopeEntry === undefined) continue;
      candidates.push({ record, scopeEntry, scopeDepth: scopeDepthOf(scopeEntry, record.verificationDepth) });
    }
    // P1-4: array order must never decide review state. Rank by review-state first, then by
    // the scope-specific depth, then by the most recent valid review date, then by a stable
    // id, so a source-checked and an independently-rechecked record covering the same scope
    // at equal depth resolve deterministically to the stronger one.
    candidates.sort((a, b) =>
      reviewStateRank(b.record.reviewState) - reviewStateRank(a.record.reviewState) ||
      verificationDepthRank(b.scopeDepth) - verificationDepthRank(a.scopeDepth) ||
      String(b.record.checkedAt || "").localeCompare(String(a.record.checkedAt || "")) ||
      String(a.record.id || a.record.sourceUrl || "").localeCompare(String(b.record.id || b.record.sourceUrl || "")));
    return candidates[0] || null;
  };

  // Resolves what review state an edge may inherit. `baseline` is where the assertion sits
  // when nobody has opened its source; `scopeRef` is the scope entry the assertion needs a
  // reviewer to have recorded. Nothing here reads a date to decide a state.
  const reviewFrom = ({ baseline, records = [], scopeRef = null, declared = false, declaredUrl = null, pendingReason, where }) => {
    problems.push(...checkReviewRecord(baseline, `${where} baseline`));
    for (const record of records) problems.push(...checkReviewRecord(record, `${where} source record`));

    const covering = reviewCovering(records, scopeRef);
    if (covering) {
      const { record, scopeEntry, scopeDepth } = covering;
      return {
        reviewState: record.reviewState,
        // The scope's own depth, never the record's summary maximum (P0-2).
        verificationDepth: scopeDepth,
        checkedAt: record.checkedAt,
        checkedBy: record.checkedBy,
        // The source that was actually opened, not the module or claim's declared/default
        // source (P0-1). A checked edge must click through to the document its evidence came
        // from.
        sourceUrl: record.sourceUrl,
        sourceVersion: record.sourceVersion,
        scopeRef: scopeLabel(scopeEntry),
        scopeId: scopeKey(scopeEntry),
        scopeBoundary: (scopeEntry && typeof scopeEntry === "object" ? scopeEntry.boundary : null) || record.boundary || null,
        // The document surface that was opened and how much of it — the descriptive facts that
        // replace the misleading total order between Methods, Results and figure captions.
        scopeSurfaceType: (scopeEntry && typeof scopeEntry === "object" ? scopeEntry.surfaceType : null) || null,
        scopeAccessExtent: (scopeEntry && typeof scopeEntry === "object" ? scopeEntry.accessExtent : null) || null,
        // The selected review event, its reader and the source document class, so a promoted
        // edge names who read what and, for a recheck, whether they agreed.
        reviewEventId: record.reviewEventId || null,
        reviewerId: record.reviewerId || null,
        documentClass: record.documentClass || null,
        priorReviewEventId: record.priorReviewEventId || null,
        agreement: record.agreement || null,
        discrepancyNote: record.discrepancyNote || null,
        reviewPendingReason: null,
        sourceReviewState: record.reviewState,
        // The record's summary maximum is the ceiling the scope depth may not exceed.
        sourceVerificationDepth: record.verificationDepth,
      };
    }

    // Asking for a scope no reviewer recorded is a data defect, not a reason to quietly
    // fall back. Otherwise a mistyped scope entry would silently demote a real reading, and
    // a fabricated one would silently pass as provisional.
    if (declared && scopeRef) {
      const offered = (records || []).filter((record) => isSourceChecked(record?.reviewState)).flatMap((record) => (record.scope || []).map(scopeLabel));
      problems.push(
        `${where}: this assertion declares it was read at scope ${JSON.stringify(scopeRef)}, but no source-checked record covers it. Recorded scopes: ${offered.length ? offered.map((value) => JSON.stringify(value)).join(", ") : "(none)"}`,
      );
    }

    return {
      reviewState: baseline?.reviewState ?? "recorded-unverified",
      verificationDepth: baseline?.verificationDepth ?? "not-read",
      checkedAt: null,
      checkedBy: null,
      sourceUrl: declaredUrl ?? baseline?.sourceUrl ?? null,
      sourceVersion: null,
      scopeRef: null,
      scopeId: null,
      scopeBoundary: null,
      scopeAccessSurface: null,
      reviewPendingReason: pendingReason,
      sourceReviewState: baseline?.reviewState ?? "recorded-unverified",
      sourceVerificationDepth: baseline?.verificationDepth ?? "not-read",
    };
  };

  // The baseline is deliberately *not* the paper's own verificationDepth. Opening Fig. 3 of a
  // paper raises how far that paper was read; it does not retrospectively verify a sentence
  // nobody checked, so uncovered assertions keep falling back to archive-derived.
  const paperBaseline = (paper) => ({
    reviewState: paper.verification?.baselineReviewState || "archive-derived",
    verificationDepth: paper.verification?.baselineVerificationDepth || paper.verificationDepth || "archive-derived",
    checkedAt: paper.verification?.checkedAt ?? null,
    checkedBy: paper.verification?.checkedBy ?? null,
    sourceUrl: paper.url,
    sourceVersion: null,
    scope: [],
    boundary: paper.verification?.baselineBoundary || "Rewritten from this project's own archive; the published source was not re-opened for this claim.",
  });
  const paperReviews = (paper) => (paper.verification?.sources || []).map((source) => {
    // A paper verification source references the same registry as everything else, so a
    // promoted paper edge names the canonical event, reader and document class rather than a
    // private copy.
    const event = source.reviewEventId ? resolver.event(source.reviewEventId) : null;
    const registrySource = source.sourceId ? resolver.source(source.sourceId) : null;
    return {
      id: source.id || source.url,
      reviewState: source.reviewState,
      verificationDepth: source.verificationDepth,
      checkedAt: source.checkedAt,
      checkedBy: source.checkedBy,
      reviewEventId: source.reviewEventId || null,
      reviewerId: event?.reviewerId || null,
      documentClass: registrySource?.documentClass || null,
      priorReviewEventId: event?.priorReviewEventId || null,
      agreement: event?.agreement || null,
      discrepancyNote: event?.discrepancyNote || null,
      sourceUrl: source.url,
      sourceVersion: source.sourceVersion,
      scope: source.reviewedScopes || source.scope || [],
      boundary: source.boundary || source.finding,
    };
  });

  const addNode = (type, key, fields) => {
    const id = nodeId(type, key);
    if (!nodes.has(id)) nodes.set(id, { id, type, ...fields });
    return id;
  };

  const requireNode = (id, where) => {
    if (!nodes.has(id)) problems.push(`${where}: points at a node that does not exist: ${id}`);
    return id;
  };

  // ------------------------------------------------------------------------- nodes
  const labNames = new Map(labsEn.map((lab) => [lab.id, lab.pi]));
  for (const lab of labs) {
    addNode("laboratory", lab.id, { label: labNames.get(lab.id) || lab.id, institution: lab.institution, region: lab.region, website: lab.website });
  }
  for (const paper of papers) {
    addNode("paper", paper.doi, {
      label: paper.title,
      journal: paper.journal,
      year: paper.year,
      articleStage: paper.articleStage,
      postPublicationStatus: paper.postPublicationStatus,
      readingDepth: paper.readingDepth,
      verificationDepth: paper.verificationDepth,
      sourceUrl: paper.url,
    });
  }
  for (const method of methods) {
    addNode("method", method.id, { label: method.name, group: method.group, evidenceRole: method.evidenceRole, sourceUrl: method.source });
  }
  for (const mechanism of network.mechanisms || []) {
    addNode("mechanism", mechanism.id, { label: mechanism.label, description: mechanism.description });
  }
  for (const context of claims.contexts || []) {
    addNode("disease_context", context.id, { label: context.label, scale: context.scale });
  }
  for (const perturbation of claims.perturbations || []) {
    addNode("compound_or_perturbation", perturbation.id, { label: perturbation.label, kind: perturbation.kind });
  }

  // Each audited figure carries a boundary sentence. That sentence is the most useful
  // object in the whole record, so it becomes a node rather than a footnote.
  for (const paper of papers) {
    for (const figure of paper.figureAudit || []) {
      const key = `${paper.doi}#${slug(figure.figure)}`;
      addNode("evidence_boundary", key, { label: `${figure.figure}: ${figure.boundary}`, paperId: paper.id, figure: figure.figure, sourceScope: figure.sourceScope });
    }
  }

  for (const paper of papers) {
    for (const event of paper.versionEvents || []) {
      const key = event.doi || `${paper.doi}#${slug(event.noticeType)}-${event.date}`;
      addNode("correction_or_dispute", key, {
        label: event.type,
        noticeType: event.noticeType,
        date: event.date,
        affectedDomains: event.affectedDomains || [],
        conclusionImpact: event.conclusionImpact,
        sourceUrl: event.sourceUrl,
      });
    }
  }

  // ------------------------------------------------------------------------- edges
  const paperByDoi = new Map(papers.map((paper) => [paper.doi, paper]));
  const paperById = new Map(papers.map((paper) => [paper.id, paper]));

  for (const link of links) {
    const paper = paperById.get(link.paperId);
    if (!paper) { problems.push(`lab-paper-link for ${link.labId} points at unknown paper ${link.paperId}`); continue; }
    const relation = ROLE_RELATION[link.role];
    if (!relation) { problems.push(`lab-paper-link for ${link.labId} carries an unmapped role ${link.role}`); continue; }
    edges.push({
      relation,
      from: requireNode(nodeId("laboratory", link.labId), `lab-paper-link ${link.labId}`),
      to: requireNode(nodeId("paper", paper.doi), `lab-paper-link ${link.labId}`),
      paperId: paper.id,
      role: link.role,
      claimScope: link.continuity,
      conditionVector: null,
      conditionVectorReason: "An attribution record describes who contributed, so no experimental condition applies.",
      provenanceClass: "attribution-record",
      // Who wrote a paper is settled by the author list, so this edge is promoted by a
      // bibliographic record that recorded "authors" in its scope — not by the paper's
      // reading depth, which is a different question entirely.
      ...reviewFrom({
        baseline: paperBaseline(paper),
        records: paperReviews(paper),
        scopeRef: "authors",
        declaredUrl: paper.url,
        pendingReason: `No bibliographic record for ${paper.id} was checked at author-list scope, so the attribution of this paper to ${link.labId} is unverified here.`,
        where: `lab-paper-link ${link.labId} -> ${paper.id}`,
      }),
      verificationDepth: "metadata-checked",
      // First-author work before an independent appointment is a weaker claim about the
      // current laboratory than a corresponding-author position, and the edge says so.
      confidence: link.role === "pre-independence" ? "author-position-verified-pre-independence" : "author-position-verified",
      confidenceBasis: link.roleBasis,
    });
  }

  for (const claim of claims.claims || []) {
    const paper = paperById.get(claim.paperId);
    if (!paper) { problems.push(`claim ${claim.id} points at unknown paper ${claim.paperId}`); continue; }
    if (!RELATIONS.includes(claim.relation)) { problems.push(`claim ${claim.id} uses an unknown relation ${claim.relation}`); continue; }
    const target = claim.object || {};
    if (!NODE_TYPES.includes(target.type)) { problems.push(`claim ${claim.id} points at an unknown node type ${target.type}`); continue; }
    const targetId = nodeId(target.type, target.id);
    edges.push({
      relation: claim.relation,
      from: requireNode(nodeId("paper", paper.doi), `claim ${claim.id}`),
      to: requireNode(targetId, `claim ${claim.id}`),
      paperId: paper.id,
      figure: claim.figure,
      claimScope: claim.claimScope,
      conditionVector: claim.conditionVector,
      conditionVectorReason: null,
      provenanceClass: "paper-backed-experimental",
      // A claim is promoted by naming the scope entry a reviewer recorded against this
      // paper — "Fig. 5e", "Methods: Redox-lipidomics analysis". A claim that names none
      // stays at the paper's baseline no matter what date it carries.
      ...reviewFrom({
        baseline: paperBaseline(paper),
        records: paperReviews(paper),
        scopeRef: claim.review?.scopeRef || null,
        declared: Boolean(claim.review?.scopeRef),
        declaredUrl: claim.sourceUrl,
        pendingReason: `Claim ${claim.id} names ${claim.figure} but no reviewer has recorded reading that figure in ${paper.id}.`,
        where: `claim ${claim.id}`,
      }),
      confidence: claim.confidence,
      confidenceBasis: claim.confidenceBasis,
    });
  }

  for (const paper of papers) {
    for (const figure of paper.figureAudit || []) {
      const key = `${paper.doi}#${slug(figure.figure)}`;
      edges.push({
        relation: "BOUNDED_BY",
        from: nodeId("paper", paper.doi),
        to: requireNode(nodeId("evidence_boundary", key), `${paper.id} ${figure.figure}`),
        paperId: paper.id,
        figure: figure.figure,
        claimScope: figure.boundary,
        conditionVector: { model: paper.conditionVector, readout: figure.readout, perturbation: figure.intervention },
        conditionVectorReason: null,
        provenanceClass: "paper-backed-experimental",
        ...reviewFrom({
          baseline: paperBaseline(paper),
          records: paperReviews(paper),
          scopeRef: figure.scopeRef || null,
          declared: Boolean(figure.scopeRef),
          declaredUrl: paper.url,
          pendingReason: `The boundary recorded against ${figure.figure} of ${paper.id} comes from the project archive; no reviewer has recorded opening that figure.`,
          where: `${paper.id} ${figure.figure}`,
        }),
        confidence: "stated-in-audit",
        confidenceBasis: figure.sourceScope,
      });
    }
    for (const event of paper.versionEvents || []) {
      const key = event.doi || `${paper.doi}#${slug(event.noticeType)}-${event.date}`;
      edges.push({
        relation: NOTICE_RELATION[event.noticeType] || "CORRECTED_BY",
        from: nodeId("paper", paper.doi),
        to: requireNode(nodeId("correction_or_dispute", key), `${paper.id} notice ${event.noticeType}`),
        paperId: paper.id,
        claimScope: event.note,
        conditionVector: null,
        conditionVectorReason: "A published notice is a bibliographic event, not an experiment.",
        provenanceClass: "bibliographic-event",
        // A notice is its own document. Knowing that one exists is a different fact from
        // having read what it changed, so the notice carries its own review record.
        ...reviewFrom({
          baseline: event.baselineReview || {
            reviewState: "recorded-unverified",
            verificationDepth: "metadata-only",
            checkedAt: null,
            scope: [],
            boundary: `The existence of this ${event.noticeType} is recorded from bibliographic metadata; the notice text was not opened, so what it changed is not established here.`,
          },
          records: event.reviews || [],
          scopeRef: event.scopeRef || null,
          declared: Boolean(event.scopeRef),
          declaredUrl: event.sourceUrl,
          pendingReason: `The ${event.noticeType} notice on ${paper.id} is recorded from metadata; its text has not been opened, so what it changed is not established here.`,
          where: `${paper.id} notice ${event.noticeType}`,
        }),
        verificationDepth: "metadata-checked",
        confidence: event.conclusionImpact,
        confidenceBasis: `Affected domains: ${(event.affectedDomains || []).join(", ")}.`,
      });
    }
  }

  // A method source route now carries only a reference: a canonical sourceId and, when a
  // reading exists, a reviewEventId. The route becomes a review record only by resolving that
  // event through the registry — never by a status string a caller could edit. An independent
  // recheck resolves to an event that names its own reviewer and date, so the graph attributes
  // the recheck to the second reader, not to the original implementer (P0-3).
  const routeReview = (route) => {
    const source = resolver.source(route.sourceId);
    const event = route.reviewEventId ? resolver.event(route.reviewEventId) : null;
    if (route.reviewEventId && !event) problems.push(`method route ${route.id}: reviewEventId ${JSON.stringify(route.reviewEventId)} does not resolve in the registry`);
    if (event && isIndependentEvent(event)) problems.push(...validateIndependentEvent(event, { registry: sourceReviews, owner: sourceReviews?.owner }));
    const checked = event && (event.reviewState === "source-checked" || event.reviewState === "independently-rechecked");
    const scopes = checked
      ? (event.scopeIds || []).map((id) => {
          const scope = resolver.scope(source?.id, id);
          if (!scope) { problems.push(`method route ${route.id}: event ${event.id} names scope ${JSON.stringify(id)} that source ${route.sourceId} does not declare`); return null; }
          return { id: scope.id, label: scope.label, verificationDepth: scope.verificationDepth, surfaceType: scope.surfaceType, accessExtent: scope.accessExtent, boundary: scope.boundary };
        }).filter(Boolean)
      : [];
    const summaryDepth = scopes.length
      ? scopes.reduce((best, scope) => (verificationDepthRank(scope.verificationDepth) > verificationDepthRank(best) ? scope.verificationDepth : best), scopes[0].verificationDepth)
      : (checked ? "metadata-checked" : "curated-unverified");
    return {
      id: route.id,
      reviewState: event ? event.reviewState : "recorded-unverified",
      verificationDepth: checked ? summaryDepth : "curated-unverified",
      checkedAt: event?.checkedAt ?? null,
      checkedBy: event ? resolver.reviewerName(event.reviewerId) : null,
      reviewerId: event?.reviewerId ?? null,
      reviewEventId: event?.id ?? null,
      priorReviewEventId: event?.priorReviewEventId ?? null,
      agreement: event?.agreement ?? null,
      discrepancyNote: event?.discrepancyNote ?? null,
      documentClass: source?.documentClass ?? null,
      sourceUrl: source?.url ?? null,
      sourceVersion: source?.version?.label ?? null,
      scope: scopes,
      boundary: event?.boundary || route.boundary,
    };
  };

  for (const link of network.methodLinks || []) {
    const method = methods.find((item) => item.id === link.method);
    if (!method) { problems.push(`method link points at unknown method ${link.method}`); continue; }

    // P0-B, stated as a build failure rather than a convention. The old contract let
    // `methodLinks[i].checkedAt = "<today>"` promote both of that module's edges to
    // source-checked. A bare date on a method link now has no meaning and is refused, so the
    // only way to promote is to record a route that says who read what.
    if ("checkedAt" in link) {
      problems.push(
        `method link ${method.id}: a bare checkedAt is not evidence of review and is no longer honoured. Record a sourceRoutes entry with status "source-checked", checkedBy, an ISO checkedAt, a sourceVersion and a scope that covers the assertion.`,
      );
    }

    const routes = (method.sourceRoutes || []).map(routeReview);
    const baseline = {
      reviewState: "recorded-unverified",
      verificationDepth: "curated-unverified",
      checkedAt: null,
      scope: [],
      boundary: `Curated judgement about the assay class "${method.name}". No declared source has been read at a scope that covers this statement.`,
    };

    for (const mechanismId of link.mechanisms || []) {
      const to = requireNode(nodeId("mechanism", mechanismId), `method link ${method.id}`);
      // Each assertion is promoted separately. Reading a paper's methods section can
      // establish what an assay measures without establishing what it cannot distinguish,
      // so the two relations name different scope entries and move independently.
      const assertions = [
        { relation: "MEASURES", claimScope: method.measures, confidence: method.evidenceRole, confidenceBasis: method.plainEnglish },
        { relation: "CANNOT_DISTINGUISH", claimScope: method.cannotProve, confidence: "boundary-of-assay", confidenceBasis: method.cannotProve },
      ];
      for (const assertion of assertions) {
        const scopeRef = link.assertionScopes?.[assertion.relation] || null;
        edges.push({
          ...assertion,
          from: nodeId("method", method.id),
          to,
          paperId: null,
          paperlessBasis: "Curated method module; the boundary applies to the assay itself rather than to one paper.",
          conditionVector: null,
          conditionVectorReason: "A method module describes an assay class, so its conditions are set by the study that uses it.",
          provenanceClass: "curated-method-module",
          ...reviewFrom({
            baseline,
            records: routes,
            scopeRef,
            declared: Boolean(scopeRef),
            declaredUrl: method.source,
            pendingReason: `The method module "${method.name}" links to this mechanism on curated judgement; no declared source route has been read at a scope covering its ${assertion.relation} statement.`,
            where: `method link ${method.id} -> ${mechanismId} (${assertion.relation})`,
          }),
        });
      }
    }
  }

  // The contract is enforced where the edges are built, so the renderer cannot show an
  // edge that the validator would have rejected.
  for (const [index, edge] of edges.entries()) {
    problems.push(...checkEdgeContract(edge, `edge[${index}] ${edge.relation} ${edge.from} -> ${edge.to}`));
  }

  if (problems.length) {
    const error = new Error(`The provenance graph could not be built:\n  ${problems.join("\n  ")}`);
    error.problems = problems;
    throw error;
  }

  const nodeList = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
  const edgeList = edges.sort((a, b) => `${a.relation}${a.from}${a.to}`.localeCompare(`${b.relation}${b.from}${b.to}`, "en"));

  const nodeCounts = Object.fromEntries(NODE_TYPES.map((type) => [type, nodeList.filter((node) => node.type === type).length]));
  const edgeCounts = Object.fromEntries(RELATIONS.map((relation) => [relation, edgeList.filter((edge) => edge.relation === relation).length]));
  const provenanceCounts = Object.fromEntries(EDGE_PROVENANCE_CLASSES.map((value) => [value, edgeList.filter((edge) => edge.provenanceClass === value).length]));
  // Both axes are reported in full, including the states and depths with a count of zero.
  // A single "checked / not checked" split was what let 118 archive rewrites be counted as
  // source-checked, so the binary is gone rather than relabelled.
  const reviewCounts = Object.fromEntries(EDGE_REVIEW_STATES.map((value) => [value, edgeList.filter((edge) => edge.reviewState === value).length]));
  const depthCounts = Object.fromEntries(VERIFICATION_DEPTHS.map((value) => [value, edgeList.filter((edge) => edge.verificationDepth === value).length]));

  return {
    schemaVersion: "1.1.0",
    // The generator is this module. The graph is derived at load time rather than written
    // to disk, and naming a build script that does not exist made the provenance line the
    // one unverifiable field in a file whose whole purpose is verifiable provenance.
    generator: "lib/graph.mjs",
    generatorVersion: "1.1.0",
    note: "Derived at load time from papers-en.json, paper-claims.json, lab-paper-links.json, methods.json and knowledge-network.json. Every edge names its source, keeps its condition vector or states why none applies, and inherits its review state and verification depth from a source record that says who read what — never from a date. An edge may not exceed that record on either axis. A relation, state or depth with a count of zero is reported as zero rather than hidden.",
    counts: { nodes: nodeList.length, edges: edgeList.length, byNodeType: nodeCounts, byRelation: edgeCounts, byProvenanceClass: provenanceCounts, byReviewState: reviewCounts, byVerificationDepth: depthCounts },
    nodes: nodeList,
    edges: edgeList,
    unusedPaperDois: [...paperByDoi.keys()].filter((doi) => !edgeList.some((edge) => edge.from === nodeId("paper", doi) && ["SUPPORTS_IN_CONTEXT", "CONTRADICTS", "REPLICATES"].includes(edge.relation))),
  };
}
