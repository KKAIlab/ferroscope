// Validates the provenance graph that the interface builds at load time.
//
// The graph is not a committed artefact, so what is checked here is the contract every
// edge has to satisfy: a relation from the controlled vocabulary, a resolvable source,
// a condition vector or a stated reason none applies, and a confidence with a basis.
// A relation with no instances is reported rather than hidden, because "we have no
// contradiction edges" is a fact about the corpus, not a detail to leave out.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EDGE_PROVENANCE_CLASSES, EDGE_REVIEW_STATES, NODE_TYPES, RELATIONS, buildGraph, checkEdgeContract } from "../lib/graph.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (file) => JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8"));

const [papers, labs, labsEn, links, methods, network, claims] = await Promise.all([
  read("papers-en.json"), read("labs.json"), read("labs-en.json"), read("lab-paper-links.json"),
  read("methods.json"), read("knowledge-network.json"), read("paper-claims.json"),
]);

const errors = [];
let graph;
try {
  graph = buildGraph({ papers, labs, labsEn, links, methods, network, claims });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

// The graph declares which module derives it. A generator that does not exist on disk is
// an unverifiable provenance line in a file whose whole purpose is verifiable provenance.
const generatorPath = path.join(root, graph.generator || "");
const generatorExists = await fs.stat(generatorPath).then((entry) => entry.isFile()).catch(() => false);
if (!graph.generator) errors.push("The graph declares no generator.");
else if (!generatorExists) errors.push(`The graph declares generator ${graph.generator}, which does not exist on disk.`);

const nodeIds = new Set(graph.nodes.map((node) => node.id));
const paperIds = new Set(papers.map((paper) => paper.id));

for (const node of graph.nodes) {
  if (!NODE_TYPES.includes(node.type)) errors.push(`Node ${node.id} has an unknown type ${node.type}`);
  if (!node.label) errors.push(`Node ${node.id} has no label`);
}

for (const [index, edge] of graph.edges.entries()) {
  const where = `edge[${index}] ${edge.relation} ${edge.from} -> ${edge.to}`;
  // The shared contract covers relation, provenance class, review state and the check-date
  // rule; only the cross-file identity checks are local to the validator.
  errors.push(...checkEdgeContract(edge, where));
  if (!nodeIds.has(edge.from)) errors.push(`${where}: source node does not exist`);
  if (!nodeIds.has(edge.to)) errors.push(`${where}: target node does not exist`);
  if (edge.paperId !== null && !paperIds.has(edge.paperId)) {
    errors.push(`${where}: paperId ${edge.paperId} is not a known paper`);
  }
}

// A claim that cites a figure must cite one that exists in that paper's audited chain.
const figuresByPaper = new Map(papers.map((paper) => [paper.id, new Set((paper.figureAudit || []).map((figure) => figure.figure))]));
for (const claim of claims.claims || []) {
  if (!claim.figure) { errors.push(`claim ${claim.id} does not name the figure it was read from`); continue; }
  const figures = figuresByPaper.get(claim.paperId);
  if (!figures) { errors.push(`claim ${claim.id} points at unknown paper ${claim.paperId}`); continue; }
  const known = [...figures].some((figure) => figure === claim.figure || figure.startsWith(`${claim.figure} `));
  if (!known) errors.push(`claim ${claim.id} cites ${claim.figure}, which is not in the audited figure chain of ${claim.paperId}`);
}

// Every paper must be reachable from a laboratory and must state at least one boundary,
// otherwise the graph would carry a claim with no attribution or no limit.
for (const paper of papers) {
  const paperNode = `paper:${paper.doi}`;
  const attributed = graph.edges.some((edge) => edge.to === paperNode && ["CONTRIBUTED_TO", "PRE_INDEPENDENCE_WORK"].includes(edge.relation));
  if (!attributed) errors.push(`${paper.id} has no laboratory attribution edge`);
  const bounded = graph.edges.some((edge) => edge.from === paperNode && edge.relation === "BOUNDED_BY");
  if (!bounded) errors.push(`${paper.id} contributes no evidence-boundary node`);
}

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }

const relationSummary = RELATIONS.map((relation) => `${relation} ${graph.counts.byRelation[relation]}`).join(", ");
const nodeSummary = NODE_TYPES.map((type) => `${type} ${graph.counts.byNodeType[type]}`).join(", ");
const provenanceSummary = EDGE_PROVENANCE_CLASSES.map((value) => `${value} ${graph.counts.byProvenanceClass[value]}`).join(", ");
const reviewSummary = EDGE_REVIEW_STATES.map((value) => `${value} ${graph.counts.byReviewState[value]}`).join(", ");
if (graph.unusedPaperDois.length) {
  console.warn(`Papers with no mechanism-level claim yet: ${graph.unusedPaperDois.join(", ")}`);
}
console.log(`Provenance graph validation passed: ${graph.counts.nodes} nodes (${nodeSummary}) and ${graph.counts.edges} edges (${relationSummary}).`);
console.log(`Edge provenance: ${provenanceSummary}. Review state: ${reviewSummary}. Generator ${graph.generator} verified on disk.`);
