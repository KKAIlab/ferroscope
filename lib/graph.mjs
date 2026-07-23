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

export const EDGE_REVIEW_STATES = ["source-checked", "pending-source-review"];

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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// The contract every edge has to satisfy, kept here rather than in the validator so the
// renderer, the validator and the negative test all read the same rule.
//
// A null check date used to pass silently, which let a curated method-module boundary sit
// in the graph looking exactly like a claim read out of a figure. An edge now either names
// the ISO date its source was checked, or declares that it is awaiting source review and
// says what has not been read. There is no third, quiet option.
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
  require(Boolean(edge.verificationDepth), "verificationDepth is required so a reader knows how far the claim was checked");
  require(Boolean(edge.confidence && edge.confidenceBasis), "confidence and its basis are both required");

  const checked = ISO_DATE.test(edge.checkedAt || "");
  require(edge.checkedAt === null || checked, "checkedAt must be an ISO date or explicitly null");
  require(
    checked || edge.reviewState === "pending-source-review",
    `checkedAt is ${JSON.stringify(edge.checkedAt ?? null)}, so the edge must declare reviewState "pending-source-review"; an unchecked edge may not pass silently`,
  );
  require(!checked || edge.reviewState === "source-checked", "an edge carrying a check date must declare reviewState \"source-checked\"");
  if (edge.reviewState === "pending-source-review") {
    require(Boolean(edge.reviewPendingReason), "an edge awaiting source review must state what has not been read yet");
  }

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

export function buildGraph({ papers, labs, labsEn, links, methods, network, claims }) {
  const nodes = new Map();
  const edges = [];
  const problems = [];

  // An edge declares its own review state from the date it actually carries, so a record
  // that loses its check date becomes visibly provisional instead of quietly keeping the
  // appearance of a checked one.
  const reviewFields = (checkedAt, pendingReason, where) => {
    // A malformed date is a data defect, not a reason to quietly downgrade the edge to
    // provisional; the builder refuses it so the bad value is fixed rather than absorbed.
    if (checkedAt !== null && checkedAt !== undefined && !ISO_DATE.test(checkedAt)) {
      problems.push(`${where}: checkedAt must be an ISO date or absent, not ${JSON.stringify(checkedAt)}`);
    }
    return ISO_DATE.test(checkedAt || "")
      ? { checkedAt, reviewState: "source-checked", reviewPendingReason: null }
      : { checkedAt: null, reviewState: "pending-source-review", reviewPendingReason: pendingReason };
  };

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
      sourceUrl: paper.url,
      provenanceClass: "attribution-record",
      ...reviewFields(paper.verification?.checkedAt, `The attribution of ${paper.id} to ${link.labId} has no recorded check date.`, `lab-paper-link ${link.labId} -> ${paper.id}`),
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
      sourceUrl: claim.sourceUrl,
      provenanceClass: "paper-backed-experimental",
      ...reviewFields(claim.checkedAt, `Claim ${claim.id} names a figure but records no date on which that figure was read.`, `claim ${claim.id}`),
      verificationDepth: paper.verificationDepth,
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
        sourceUrl: paper.url,
        provenanceClass: "paper-backed-experimental",
        ...reviewFields(paper.verification?.checkedAt, `The audited figure chain of ${paper.id} records no verification date.`, `${paper.id} ${figure.figure}`),
        verificationDepth: paper.verificationDepth,
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
        sourceUrl: event.sourceUrl,
        provenanceClass: "bibliographic-event",
        ...reviewFields(event.checkedAt, `The ${event.noticeType} notice on ${paper.id} has not been opened and dated.`, `${paper.id} notice ${event.noticeType}`),
        verificationDepth: "metadata-checked",
        confidence: event.conclusionImpact,
        confidenceBasis: `Affected domains: ${(event.affectedDomains || []).join(", ")}.`,
      });
    }
  }

  // A method module states what it measures and what it cannot establish alone. Both are
  // emitted, so a query that returns a mechanism also returns the boundary of the assay
  // that produced it.
  for (const link of network.methodLinks || []) {
    const method = methods.find((item) => item.id === link.method);
    if (!method) { problems.push(`method link points at unknown method ${link.method}`); continue; }
    for (const mechanismId of link.mechanisms || []) {
      // A method-to-mechanism link is a curated statement about an assay class. It is not
      // a claim read out of a figure, and until the module's declared source is actually
      // read it is provisional — so it says so rather than borrowing the appearance of a
      // paper-backed edge.
      const review = reviewFields(
        link.checkedAt,
        `The method module "${method.name}" links to this mechanism on curated judgement; its declared source ${method.source} has not been read and dated.`,
        `method link ${method.id} -> ${mechanismId}`,
      );
      const base = {
        from: nodeId("method", method.id),
        to: requireNode(nodeId("mechanism", mechanismId), `method link ${method.id}`),
        paperId: null,
        paperlessBasis: "Curated method module; the boundary applies to the assay itself rather than to one paper.",
        conditionVector: null,
        conditionVectorReason: "A method module describes an assay class, so its conditions are set by the study that uses it.",
        sourceUrl: method.source,
        provenanceClass: "curated-method-module",
        ...review,
        verificationDepth: review.reviewState === "source-checked" ? "metadata-checked" : "curated-unverified",
      };
      edges.push({ ...base, relation: "MEASURES", claimScope: method.measures, confidence: method.evidenceRole, confidenceBasis: method.plainEnglish });
      edges.push({ ...base, relation: "CANNOT_DISTINGUISH", claimScope: method.cannotProve, confidence: "boundary-of-assay", confidenceBasis: method.cannotProve });
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
  const reviewCounts = Object.fromEntries(EDGE_REVIEW_STATES.map((value) => [value, edgeList.filter((edge) => edge.reviewState === value).length]));

  return {
    schemaVersion: "1.1.0",
    // The generator is this module. The graph is derived at load time rather than written
    // to disk, and naming a build script that does not exist made the provenance line the
    // one unverifiable field in a file whose whole purpose is verifiable provenance.
    generator: "lib/graph.mjs",
    generatorVersion: "1.1.0",
    note: "Derived at load time from papers-en.json, paper-claims.json, lab-paper-links.json, methods.json and knowledge-network.json. Every edge names its source, keeps its condition vector or states why none applies, and declares whether its source was checked or is still awaiting review. A relation with a count of zero is reported as zero rather than hidden.",
    counts: { nodes: nodeList.length, edges: edgeList.length, byNodeType: nodeCounts, byRelation: edgeCounts, byProvenanceClass: provenanceCounts, byReviewState: reviewCounts },
    nodes: nodeList,
    edges: edgeList,
    unusedPaperDois: [...paperByDoi.keys()].filter((doi) => !edgeList.some((edge) => edge.from === nodeId("paper", doi) && ["SUPPORTS_IN_CONTEXT", "CONTRADICTS", "REPLICATES"].includes(edge.relation))),
  };
}
