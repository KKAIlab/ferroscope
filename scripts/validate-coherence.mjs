// Cross-file coherence: the checks that no single validator owns.
//
// validate-papers, validate-graph and test-registry-hardening each guard one layer. What
// none of them sees is whether the layers still agree with each other after a round of
// edits: whether a paper cites a review event that belongs to a different source, whether
// a mechanism edge anchors a DOI that left papers-en, whether data/ grew a file that
// schema-versions never registered.
//
// Two categories come out of this, and the difference matters more than the counts.
//
// A CONTRADICTION is a statement the corpus makes about itself that is not true — a
// dangling reference, a duplicate identity, a paper claiming a review state its registry
// event does not support. Those fail the build.
//
// An ACKNOWLEDGED GAP is something the corpus honestly does not have: a mechanism node no
// method interrogates yet, an edge whose only anchor was read at abstract level. Those are
// not failures; hiding them would be. They are pinned to the baseline below by exact
// identity rather than by count, so a round that adds a node with no method has to say so
// in this file instead of quietly widening the silence.
//
// A note on what is deliberately NOT a contradiction here, because it was misread once
// during the round-12 audit and cost a re-derivation:
//
//   * A registered source with no review event. Those are the recorded-unverified
//     publisher full texts — declared so the reader knows the version of record exists,
//     never opened. No reading happened, so no review event may exist. An event attached
//     to one of them would be the forgery, not the absence.
//   * A paper with no `lead` attribution. Attribution records the position of a tracked
//     laboratory. When the senior author of a paper runs no lab we track, the honest
//     record is the contributing or pre-independence position we can verify, not a lead
//     invented to fill the slot.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (file) => JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8"));

// The corpus states these absences on the record. Each entry is a gap we can name and
// justify; the check fails if the real set drifts from it in either direction, so growing
// the silence and closing it both require an edit here.
const ACKNOWLEDGED_GAPS = {
  // No methodLink reaches these nodes, so their detail panel shows no interrogating method.
  mechanismsWithoutMethod: [
    "selenium-selenoprotein", "mitochondrial-metabolism",
    "immune-regulation", "system-xc", "gch1-bh4", "mevalonate-sterol",
  ],
  // Every anchor of these edges was read at abstract level. The interface already discloses
  // this per edge ("figures not audited"); the list exists so deepening them stays a
  // tracked decision rather than something noticed by accident.
  edgesAnchoredOnlyOnAbstracts: [
    "system-xc->gpx4-gsh", "gch1-bh4->lipid-peroxidation", "mevalonate-sterol->lipid-peroxidation",
  ],
};

const [papers, labs, links, methods, network, glossary, sourceReviews, schemaVersions] = await Promise.all([
  read("papers-en.json"), read("labs-en.json"), read("lab-paper-links.json"), read("methods.json"),
  read("knowledge-network.json"), read("glossary.json"), read("source-reviews.json"), read("schema-versions.json"),
]);

const contradictions = [];
const notes = [];

const collect = (value, key, found = []) => {
  if (value === null || typeof value !== "object") return found;
  if (Array.isArray(value)) { for (const item of value) collect(item, key, found); return found; }
  for (const [name, item] of Object.entries(value)) {
    if (name === key && typeof item === "string") found.push(item);
    collect(item, key, found);
  }
  return found;
};
const duplicates = (values) => [...values.reduce((seen, value) => seen.set(value, (seen.get(value) || 0) + 1), new Map())]
  .filter(([, count]) => count > 1).map(([value, count]) => `${value} ×${count}`);

const sourceById = new Map(sourceReviews.sources.map((source) => [source.id, source]));
const eventById = new Map(sourceReviews.reviewEvents.map((event) => [event.id, event]));
const labById = new Map(labs.map((lab) => [lab.id, lab]));
const paperById = new Map(papers.map((paper) => [paper.id, paper]));
const paperByDoi = new Map(papers.map((paper) => [paper.doi, paper]));
const mechanismById = new Map(network.mechanisms.map((mechanism) => [mechanism.id, mechanism]));
const methodById = new Map(methods.map((method) => [method.id, method]));
const glossaryById = new Map(glossary.map((entry) => [entry.id, entry]));

// --- identity -------------------------------------------------------------------------
for (const duplicate of duplicates(papers.map((paper) => paper.doi))) contradictions.push(`papers-en registers DOI ${duplicate}`);
for (const duplicate of duplicates(papers.map((paper) => paper.id))) contradictions.push(`papers-en registers id ${duplicate}`);
for (const duplicate of duplicates(glossary.map((entry) => entry.term.toLowerCase()))) contradictions.push(`glossary registers term ${duplicate}`);
for (const duplicate of duplicates(network.mechanismEdges.map((edge) => `${edge.source}->${edge.target}`))) contradictions.push(`knowledge-network registers mechanism edge ${duplicate}`);

// One alias may name one concept. Two entries claiming the same string is the synonym
// collision the terminology layer exists to prevent.
const aliasOwner = new Map();
for (const entry of glossary) {
  for (const alias of [entry.term, ...Object.values(entry.aliases || {}).flat()]) {
    const key = alias.toLowerCase();
    if (aliasOwner.has(key) && aliasOwner.get(key) !== entry.id) contradictions.push(`glossary alias "${alias}" is claimed by both ${aliasOwner.get(key)} and ${entry.id}`);
    else aliasOwner.set(key, entry.id);
  }
}

// --- papers ↔ registry ------------------------------------------------------------------
for (const paper of papers) {
  for (const sourceId of collect(paper, "sourceId")) {
    if (!sourceById.has(sourceId)) contradictions.push(`${paper.id} cites source ${sourceId}, which is not registered`);
  }
  for (const eventId of collect(paper, "reviewEventId")) {
    if (!eventById.has(eventId)) contradictions.push(`${paper.id} cites review event ${eventId}, which is not registered`);
  }
  for (const declared of paper.verification?.sources || []) {
    const event = declared.reviewEventId ? eventById.get(declared.reviewEventId) : null;
    // A review event proves a reading of one specific source. Pairing it with a different
    // source id would let one reading vouch for a document nobody opened.
    if (event && declared.sourceId && event.sourceId !== declared.sourceId) {
      contradictions.push(`${paper.id} pairs source ${declared.sourceId} with event ${event.id}, which reviewed ${event.sourceId}`);
    }
    // The depth a paper advertises has to be the depth the registry recorded.
    if (event && declared.reviewState && event.reviewState !== declared.reviewState) {
      contradictions.push(`${paper.id} declares ${declared.reviewState} for ${declared.sourceId} while event ${event.id} records ${event.reviewState}`);
    }
    if (!declared.sourceId) continue;
    const registryHasReading = sourceReviews.reviewEvents.some((candidate) => candidate.sourceId === declared.sourceId);
    // Claiming anything above recorded-unverified requires a reading in the registry.
    if (!registryHasReading && declared.reviewState !== "recorded-unverified") {
      contradictions.push(`${paper.id} claims ${declared.reviewState} for ${declared.sourceId}, which has no review event`);
    }
    if (registryHasReading && !declared.reviewEventId) {
      contradictions.push(`${paper.id} cites ${declared.sourceId}, which was reviewed, without naming the review event`);
    }
  }
  // Registration metadata is the one surface every paper must have checked.
  const crossref = (paper.verification?.sources || []).filter((declared) => declared.kind === "crossref");
  if (crossref.length === 0) contradictions.push(`${paper.id} declares no Crossref source`);
  for (const declared of crossref) {
    const event = declared.reviewEventId ? eventById.get(declared.reviewEventId) : null;
    if (!event || event.reviewState !== "source-checked") contradictions.push(`${paper.id} has a Crossref source that is not source-checked`);
  }
}
for (const event of sourceReviews.reviewEvents) {
  if (!sourceById.has(event.sourceId)) contradictions.push(`review event ${event.id} reviews source ${event.sourceId}, which is not registered`);
  if (event.priorReviewEventId && !eventById.has(event.priorReviewEventId)) contradictions.push(`review event ${event.id} cites prior event ${event.priorReviewEventId}, which is not registered`);
}
// A source with a read scope but no event would be a reading with no record of who did it.
for (const source of sourceReviews.sources) {
  const hasScope = (source.scopes || []).length > 0;
  const hasEvent = sourceReviews.reviewEvents.some((event) => event.sourceId === source.id);
  if (hasScope && !hasEvent) contradictions.push(`source ${source.id} declares read scopes but carries no review event`);
}

// Registered but referenced nowhere: the registry would be describing documents the
// corpus no longer uses, which is how a stale provenance record starts.
const referencedSourceIds = new Set();
const referencedEventIds = new Set();
for (const file of (await fs.readdir(path.join(root, "data"))).filter((name) => name.endsWith(".json"))) {
  const contents = JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8"));
  for (const sourceId of collect(contents, "sourceId")) referencedSourceIds.add(sourceId);
  for (const eventId of collect(contents, "reviewEventId")) referencedEventIds.add(eventId);
}
for (const source of sourceReviews.sources) {
  if (!referencedSourceIds.has(source.id)) contradictions.push(`source ${source.id} is registered but referenced by no data file`);
}
for (const event of sourceReviews.reviewEvents) {
  const citedAsPrior = sourceReviews.reviewEvents.some((candidate) => candidate.priorReviewEventId === event.id);
  if (!referencedEventIds.has(event.id) && !citedAsPrior) contradictions.push(`review event ${event.id} is registered but referenced by no data file`);
}

// --- attribution -------------------------------------------------------------------------
const linksByPaper = new Map();
for (const link of links) {
  if (!labById.has(link.labId)) contradictions.push(`lab-paper-link names laboratory ${link.labId}, which is not registered`);
  if (!paperById.has(link.paperId)) contradictions.push(`lab-paper-link names paper ${link.paperId}, which is not in papers-en`);
  if (!linksByPaper.has(link.paperId)) linksByPaper.set(link.paperId, []);
  linksByPaper.get(link.paperId).push(link);
}
for (const paper of papers) {
  if (!linksByPaper.has(paper.id)) contradictions.push(`${paper.id} carries no laboratory attribution`);
}
// Two leads on one paper would be two claims to the same senior position.
for (const [paperId, paperLinks] of linksByPaper) {
  const leads = paperLinks.filter((link) => link.role === "lead");
  if (leads.length > 1) contradictions.push(`${paperId} records ${leads.length} lead laboratories: ${leads.map((link) => link.labId).join(", ")}`);
}

// --- mechanism layer ----------------------------------------------------------------------
const endpointIds = new Set();
for (const edge of network.mechanismEdges) {
  for (const end of ["source", "target"]) {
    endpointIds.add(edge[end]);
    if (!mechanismById.has(edge[end])) contradictions.push(`mechanism edge ${edge.source}->${edge.target} names ${end} ${edge[end]}, which is not a mechanism`);
  }
  const anchors = edge.evidence || [];
  // An unanchored edge is an assertion the interface would draw with no paper behind it.
  if (anchors.length === 0) contradictions.push(`mechanism edge ${edge.source}->${edge.target} cites no evidence`);
  for (const doi of anchors) {
    if (!paperByDoi.has(doi)) contradictions.push(`mechanism edge ${edge.source}->${edge.target} anchors ${doi}, which is not in papers-en`);
  }
}
for (const mechanism of network.mechanisms) {
  if (!endpointIds.has(mechanism.id)) contradictions.push(`mechanism ${mechanism.id} appears on no edge`);
}
for (const link of network.methodLinks) {
  if (!methodById.has(link.method)) contradictions.push(`methodLink names method ${link.method}, which is not registered`);
  for (const mechanism of link.mechanisms || []) {
    if (!mechanismById.has(mechanism)) contradictions.push(`methodLink ${link.method} names mechanism ${mechanism}, which does not exist`);
  }
}
for (const entry of glossary) {
  for (const related of entry.related || []) {
    if (!glossaryById.has(related)) contradictions.push(`glossary entry ${entry.id} relates to ${related}, which does not exist`);
  }
}

// --- manifest ---------------------------------------------------------------------------
const registeredFiles = Object.keys(schemaVersions.files || {}).map((file) => (file.startsWith("data/") ? file : `data/${file}`));
const actualFiles = (await fs.readdir(path.join(root, "data"))).filter((name) => name.endsWith(".json")).map((name) => `data/${name}`);
for (const file of actualFiles) {
  if (!registeredFiles.includes(file)) contradictions.push(`${file} exists but schema-versions does not register it`);
}
for (const file of registeredFiles) {
  if (!actualFiles.includes(file)) contradictions.push(`schema-versions registers ${file}, which does not exist`);
}

// --- acknowledged gaps ---------------------------------------------------------------------
const compareToBaseline = (label, actual, baseline) => {
  const actualSet = new Set(actual);
  const baselineSet = new Set(baseline);
  const appeared = actual.filter((value) => !baselineSet.has(value));
  const closed = baseline.filter((value) => !actualSet.has(value));
  if (appeared.length) contradictions.push(`${label}: ${appeared.join(", ")} — new, undeclared. Add to ACKNOWLEDGED_GAPS in scripts/validate-coherence.mjs, or close the gap.`);
  if (closed.length) contradictions.push(`${label}: ${closed.join(", ")} — declared but no longer real. Remove from ACKNOWLEDGED_GAPS in scripts/validate-coherence.mjs.`);
  notes.push(`${label}: ${actual.length} declared (${actual.join(", ") || "none"})`);
};

const mechanismsWithMethod = new Set(network.methodLinks.flatMap((link) => link.mechanisms || []));
compareToBaseline(
  "mechanisms no method interrogates",
  network.mechanisms.map((mechanism) => mechanism.id).filter((id) => !mechanismsWithMethod.has(id)),
  ACKNOWLEDGED_GAPS.mechanismsWithoutMethod,
);
compareToBaseline(
  "mechanism edges anchored only on abstract-level readings",
  network.mechanismEdges
    .filter((edge) => (edge.evidence || []).every((doi) => paperByDoi.get(doi)?.readingDepth === "abstract"))
    .map((edge) => `${edge.source}->${edge.target}`),
  ACKNOWLEDGED_GAPS.edgesAnchoredOnlyOnAbstracts,
);

// The reasoning-chain layout lives in app.js as MECHANISM_GROUP, a table mapping each mechanism
// id to the band it is drawn in. An unmapped node is not dropped — groupOf() falls back to
// "context", so it renders inside the "Disease & therapy" band as though the project had placed
// it there deliberately. Nothing read that table, which is the exact shape both honesty
// contracts describe: a claim reaching the reader through a path no validator covers. Adding a
// mechanism to the data was therefore enough to state a false thing about it on screen, with
// every check green. A new mechanism must now declare its band.
const appSource = await fs.readFile(path.join(root, "app.js"), "utf8");
const groupBlock = appSource.match(/const MECHANISM_GROUP = \{([\s\S]*?)\n\};/);
if (!groupBlock) {
  // Failing closed is deliberate: if the table is renamed or restructured, this check must be
  // rewritten, not silently skipped. A silent skip returns the corpus to the unguarded state.
  contradictions.push(
    "app.js: the MECHANISM_GROUP layout table could not be located. If it was renamed or restructured, " +
    "update this check — an unmapped mechanism silently rendering in the \"Disease & therapy\" band is what it exists to catch.",
  );
} else {
  const mapped = new Set([...groupBlock[1].matchAll(/"([a-z0-9-]+)"\s*:/g)].map((match) => match[1]));
  const unmapped = network.mechanisms.map((mechanism) => mechanism.id).filter((id) => !mapped.has(id));
  const stale = [...mapped].filter((id) => !mechanismById.has(id));
  if (unmapped.length) {
    contradictions.push(
      `mechanisms with no declared layout band in app.js MECHANISM_GROUP: ${unmapped.join(", ")} — ` +
      "each would fall back to the \"Disease & therapy\" band, placing it in the reasoning chain where it does not belong.",
    );
  }
  if (stale.length) {
    contradictions.push(`app.js MECHANISM_GROUP assigns a band to ids that are not mechanisms: ${stale.join(", ")}.`);
  }
  notes.push(`mechanism layout bands declared in app.js: ${mapped.size}, covering all ${network.mechanisms.length} mechanisms`);
}

if (contradictions.length) {
  console.error(contradictions.join("\n"));
  process.exit(1);
}

const figureChain = papers.filter((paper) => paper.readingDepth === "figure-chain").length;
const abstractLevel = papers.filter((paper) => paper.readingDepth === "abstract").length;
console.log(`Cross-file coherence passed: ${papers.length} papers (${figureChain} figure-chain, ${abstractLevel} abstract-level), ${links.length} attributions over ${linksByPaper.size} papers, ${sourceReviews.sources.length} sources and ${sourceReviews.reviewEvents.length} review events all resolving, ${network.mechanisms.length} mechanisms on ${network.mechanismEdges.length} anchored edges, ${glossary.length} glossary entries, ${actualFiles.length} data files all registered.`);
for (const note of notes) console.log(`  ${note}`);
