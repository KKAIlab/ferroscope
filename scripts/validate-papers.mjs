// Validates the canonical English paper layer and the laboratory contribution layer.
//
// The two files are deliberately separate: papers-en.json holds facts about a paper,
// lab-paper-links.json holds a claim about who did what. Merging them would let an
// author-position guess turn into a property of the paper.
//
// Three axes are kept apart and each is checked on its own:
//   articleStage          where the paper sits in production;
//   postPublicationStatus what happened to it after publication;
//   readingDepth / verificationDepth  how far this project read it, and how far the
//                         reading was verified against a source.
// Collapsing any two of them would let "we rewrote an existing audit" read as "we
// re-opened the figures", or an in-press corrected proof read as a published correction.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (file) => JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8"));
const [papers, links, labs, archive] = await Promise.all([
  read("papers-en.json"), read("lab-paper-links.json"), read("labs.json"), read("lab-research.json"),
]);

const errors = [];
const fail = (condition, message) => {
  if (!condition) errors.push(message);
};

const today = new Date().toISOString().slice(0, 10);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const cjk = /[㐀-鿿぀-ヿ가-힯]/u;

const articleStages = new Set(["preprint", "accepted-manuscript", "corrected-proof", "version-of-record"]);
const postPublicationStatuses = new Set(["none", "corrected", "expression-of-concern", "editor-note", "retracted", "contested"]);
const readingDepths = new Set(["metadata", "abstract", "figure-chain", "longitudinal"]);
const verificationDepths = new Set(["metadata-checked", "abstract-cross-checked", "archive-derived", "full-text-rechecked", "raw-data-rechecked"]);
const noticeTypes = new Set(["author-correction", "publisher-correction", "matters-arising", "reply", "editor-note", "expression-of-concern", "retraction", "article-stage-reclassification"]);
const conclusionImpacts = new Set(["none-stated", "explicitly-none", "potentially-material", "material", "unknown"]);
const sourceKinds = new Set(["crossref", "pubmed", "publisher-full-text", "correction-notice", "preprint-server", "trial-registry", "raw-data"]);
const sourceStatuses = new Set(["checked", "not-checked", "unavailable"]);
// A notice from the publisher has to be read before its domains can be recorded. An
// internal reclassification of our own record is not a publisher notice and has none.
const publisherNoticeTypes = new Set(["author-correction", "publisher-correction", "editor-note", "expression-of-concern", "retraction"]);
const roles = new Set(["lead", "co-lead", "method collaborator", "conceptual collaborator", "pre-independence", "contributing-author"]);

// Language that claims more than a single paper can carry. Applied to published narrative
// only, never to the verification block, where "first author" is a factual statement.
const overclaims = [
  [/\bprove[sd]?\b/i, "asserts proof"],
  [/\bproven\b/i, "asserts proof"],
  [/\bparadigm shift\b/i, "claims a paradigm shift"],
  [/\bbreakthrough\b/i, "claims a breakthrough"],
  [/\bfirst[- ](?:ever|time|report|demonstration)\b/i, "claims priority"],
  [/\bfirst to (?:show|demonstrate|report|prove)\b/i, "claims priority"],
  [/\bcure[sd]?\b/i, "claims a cure"],
  [/\bdefinitively\b/i, "claims a settled result"],
  [/\bunequivocally\b/i, "claims a settled result"],
  [/\bcauses? (?:Alzheimer|Parkinson|sporadic|human disease)/i, "asserts disease causation"],
];

const paperIds = new Set();
const seenDois = new Set();
let threeScaleCount = 0;

for (const [index, paper] of papers.entries()) {
  const where = `papers-en[${index}] ${paper.doi || "(no doi)"}`;
  if (paperIds.has(paper.id)) errors.push(`Duplicate paper id: ${paper.id}`);
  paperIds.add(paper.id);

  fail(paper.doi && paper.id === `doi:${paper.doi}`, `${where}: id must be the normalized DOI in the form doi:<doi>`);
  if (seenDois.has(paper.doi)) errors.push(`${where}: the same DOI appears twice, so one paper would carry two reading levels`);
  seenDois.add(paper.doi);
  fail(paper.url === `https://doi.org/${paper.doi}`, `${where}: url must be the DOI resolver link`);
  fail(Boolean(paper.title && paper.journal && paper.year), `${where}: title, journal and year are required`);
  fail(Number.isInteger(paper.year) && paper.year >= 1990 && paper.year <= new Date().getFullYear() + 1, `${where}: implausible year ${paper.year}`);
  fail(articleStages.has(paper.articleStage), `${where}: unknown articleStage ${paper.articleStage}`);
  fail(postPublicationStatuses.has(paper.postPublicationStatus), `${where}: unknown postPublicationStatus ${paper.postPublicationStatus}`);
  fail(!("publicationStatus" in paper), `${where}: publicationStatus is retired; use articleStage and postPublicationStatus`);
  fail(!("readingLevel" in paper), `${where}: readingLevel is retired; use readingDepth and verificationDepth`);
  fail(readingDepths.has(paper.readingDepth), `${where}: unknown readingDepth ${paper.readingDepth}`);
  fail(verificationDepths.has(paper.verificationDepth), `${where}: unknown verificationDepth ${paper.verificationDepth}`);
  fail(typeof paper.conditionVector === "string" && paper.conditionVector.length >= 60, `${where}: a condition vector is required and must describe model, inducer, exposure, readout and time window`);

  const sixty = paper.sixtySecond || {};
  for (const field of ["story", "advance", "evidenceAnchor", "scope", "openQuestion"]) {
    fail(typeof sixty[field] === "string" && sixty[field].length >= 40, `${where}: sixtySecond.${field} is missing or too short for scale 1`);
  }

  const figures = paper.figureAudit || [];
  if (paper.readingDepth === "figure-chain") {
    fail(figures.length >= 4, `${where}: a figure-chain reading needs at least four figure records, found ${figures.length}`);
  }
  for (const [figureIndex, figure] of figures.entries()) {
    for (const field of ["figure", "question", "intervention", "readout", "answer", "boundary", "sourceScope"]) {
      fail(typeof figure[field] === "string" && figure[field].length > 0, `${where} figure ${figureIndex + 1}: ${field} is required`);
    }
    fail((figure.boundary || "").length >= 40, `${where} figure ${figureIndex + 1}: the boundary must state what the figure cannot show`);
  }

  const narrative = [Object.values(sixty).join(" "), figures.map((figure) => `${figure.question} ${figure.intervention} ${figure.readout} ${figure.answer} ${figure.boundary}`).join(" ")].join(" ");
  for (const [pattern, label] of overclaims) {
    for (const match of narrative.matchAll(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`))) {
      // A boundary statement is the opposite of an overclaim, so a negation earlier in the
      // same sentence clears it. The window is wide because a boundary is often written as
      // "X is an additional rather than a proven sole mechanism"; the trailing [^.]* in the
      // test below is what keeps a negation from a previous sentence out of scope.
      const lead = narrative.slice(Math.max(0, match.index - 120), match.index);
      if (/\b(not|cannot|can't|never|nor|no|rather than|without|neither|beyond)\b[^.]*$/i.test(lead)) continue;
      errors.push(`${where}: published narrative ${label} ("${narrative.slice(Math.max(0, match.index - 30), match.index + match[0].length)}")`);
    }
  }
  fail(!cjk.test(JSON.stringify({ ...paper, verification: null })), `${where}: the published paper record must be English`);

  // ------------------------------------------------------------- correction notices
  const events = paper.versionEvents || [];
  const verification = paper.verification || {};
  const noticeUrls = new Set((verification.sources || []).filter((source) => source.kind === "correction-notice" && source.status === "checked").map((source) => source.url));

  for (const [eventIndex, event] of events.entries()) {
    const eventWhere = `${where} versionEvent ${eventIndex + 1}`;
    fail(Boolean(event.type), `${eventWhere}: a type is required`);
    fail(noticeTypes.has(event.noticeType), `${eventWhere}: unknown noticeType ${event.noticeType}`);
    fail(isoDate.test(event.date || ""), `${eventWhere}: an ISO date is required`);
    fail(!event.date || event.date <= today, `${eventWhere}: the date is in the future`);
    fail(!("affects" in event), `${eventWhere}: the single-valued affects field is retired; use affectedDomains`);
    fail(Array.isArray(event.affectedDomains) && event.affectedDomains.length > 0, `${eventWhere}: affectedDomains must be a non-empty list`);
    fail(!(event.affectedDomains || []).includes("pending-source-check"), `${eventWhere}: pending-source-check is not an affected domain; read the notice and record what it changes`);
    fail(conclusionImpacts.has(event.conclusionImpact), `${eventWhere}: unknown conclusionImpact ${event.conclusionImpact}`);
    fail(isoDate.test(event.checkedAt || ""), `${eventWhere}: checkedAt must record when the notice was classified`);
    fail(/^https:\/\//.test(event.sourceUrl || ""), `${eventWhere}: an HTTPS sourceUrl for the notice is required`);
    fail((event.note || "").length >= 40, `${eventWhere}: a note explaining the event is required`);
    if (event.conclusionImpact === "unknown") {
      fail((verification.unresolved || []).length > 0, `${eventWhere}: an unclassified conclusion impact must appear in verification.unresolved`);
    }
    // A publisher notice may only claim an affected domain if the notice itself was read.
    if (publisherNoticeTypes.has(event.noticeType)) {
      fail(noticeUrls.has(event.sourceUrl), `${eventWhere}: the notice at ${event.sourceUrl} is classified but is not recorded as a checked correction-notice source`);
    }
  }

  const hasPublisherNotice = events.some((event) => publisherNoticeTypes.has(event.noticeType));
  fail(!hasPublisherNotice || paper.postPublicationStatus !== "none", `${where}: a registered publisher notice requires a postPublicationStatus other than "none"`);
  const isContested = events.some((event) => ["matters-arising", "reply"].includes(event.noticeType));
  fail(!isContested || paper.contested === true, `${where}: a Matters Arising or Reply must be surfaced with contested: true`);
  fail(!paper.contested || isContested, `${where}: contested is set but no Matters Arising or Reply event records the dispute`);

  // ---------------------------------------------------------- structured provenance
  fail(isoDate.test(verification.checkedAt || ""), `${where}: verification.checkedAt must be an ISO date`);
  fail(!verification.checkedAt || verification.checkedAt <= today, `${where}: verification.checkedAt is in the future`);
  for (const retired of ["metadata", "claims", "figureLayer"]) {
    fail(!(retired in verification), `${where}: verification.${retired} is retired; record the check as a structured source instead`);
  }
  fail(Array.isArray(verification.sources) && verification.sources.length >= 2, `${where}: verification.sources must list at least the metadata and abstract routes`);
  for (const [sourceIndex, source] of (verification.sources || []).entries()) {
    const sourceWhere = `${where} verification.sources[${sourceIndex}]`;
    fail(sourceKinds.has(source.kind), `${sourceWhere}: unknown source kind ${source.kind}`);
    fail(/^https:\/\//.test(source.url || ""), `${sourceWhere}: an HTTPS url is required`);
    fail(Array.isArray(source.scope), `${sourceWhere}: scope must be an array, empty when nothing was read`);
    fail(sourceStatuses.has(source.status), `${sourceWhere}: unknown status ${source.status}`);
    fail((source.finding || "").length >= 20, `${sourceWhere}: a finding is required, including for a source that was not opened`);
    if (source.status === "checked") {
      fail(isoDate.test(source.checkedAt || ""), `${sourceWhere}: a checked source needs an ISO checkedAt date`);
      fail((source.checkedBy || "").length > 0, `${sourceWhere}: a checked source must name who checked it`);
      fail((source.scope || []).length > 0, `${sourceWhere}: a checked source must state which fields it covered`);
    } else {
      fail((source.scope || []).length === 0, `${sourceWhere}: an unchecked source cannot claim a scope`);
    }
  }
  fail(Array.isArray(verification.unresolved), `${where}: verification.unresolved must be an array, empty if nothing is outstanding`);

  const derivation = verification.derivation || {};
  const derivedFrom = paper.derivedFrom || {};
  if (paper.verificationDepth === "archive-derived") {
    fail(derivation.type === "archive-rewrite", `${where}: an archive-derived record must declare verification.derivation.type "archive-rewrite"`);
    fail(Boolean(derivation.sourceRecord && derivation.sourceCommit), `${where}: an archive-derived record must name the source record and the commit it was rewritten from`);
    fail(derivedFrom.legacyRecordId === derivation.sourceRecord, `${where}: derivedFrom.legacyRecordId and verification.derivation.sourceRecord disagree`);
    fail(derivedFrom.sourceCommit === derivation.sourceCommit, `${where}: derivedFrom.sourceCommit and verification.derivation.sourceCommit disagree`);
    fail(Boolean(derivedFrom.legacyFile), `${where}: derivedFrom must name the file the rewrite came from`);
  }
  const fullText = (verification.sources || []).find((source) => source.kind === "publisher-full-text");
  if (["full-text-rechecked", "raw-data-rechecked"].includes(paper.verificationDepth)) {
    fail(fullText?.status === "checked", `${where}: a full-text-rechecked record must record the publisher full text as a checked source`);
  } else {
    fail(fullText?.status !== "checked", `${where}: the publisher full text is recorded as checked, so verificationDepth must be full-text-rechecked or stronger`);
  }

  if (paper.readingDepth === "figure-chain" && figures.length >= 4 && Object.keys(sixty).length === 5) threeScaleCount += 1;
}

fail(threeScaleCount >= 10, `At least ten papers must be readable at all three scales; ${threeScaleCount} qualify.`);

// The legacy archive stays authoritative for its own provenance. Where the English layer
// disagrees with it, the disagreement has to be recorded rather than silently overwritten.
const archiveByDoi = new Map((archive.papers || []).map((paper) => [paper.url.toLowerCase().replace(/^https:\/\/doi\.org\//, ""), paper]));
for (const paper of papers) {
  const legacy = archiveByDoi.get(paper.doi.toLowerCase());
  if (!legacy) continue;
  fail(legacy.title === paper.title, `${paper.doi}: title disagrees with the legacy archive record`);
  fail(legacy.year === paper.year, `${paper.doi}: year disagrees with the legacy archive record`);
  // The archive stores one flat status. A record matches it if either axis can account
  // for that label; otherwise the reclassification has to be written down as an event.
  const legacyEquivalents = new Set([paper.articleStage]);
  if (paper.postPublicationStatus !== "none") legacyEquivalents.add("corrected");
  if (paper.postPublicationStatus === "retracted") legacyEquivalents.add("retracted");
  if (!legacyEquivalents.has(legacy.publicationStatus)) {
    fail((paper.versionEvents || []).length > 0, `${paper.doi}: publication state differs from the legacy archive (${legacy.publicationStatus} vs ${paper.articleStage}/${paper.postPublicationStatus}) without a recorded version event`);
  }
}

const labIds = new Set(labs.map((lab) => lab.id));
const linkedPapers = new Set();
for (const [index, link] of links.entries()) {
  const where = `lab-paper-links[${index}]`;
  fail(labIds.has(link.labId), `${where}: unknown laboratory ${link.labId}`);
  fail(paperIds.has(link.paperId), `${where}: unknown paper ${link.paperId}`);
  fail(roles.has(link.role), `${where}: unknown role ${link.role}`);
  fail((link.roleBasis || "").length >= 40, `${where}: roleBasis must state the evidence for the role`);
  fail(/author|corresponding|contribution|archive/i.test(link.roleBasis || ""), `${where}: roleBasis must name the attribution evidence, not assert the role`);
  fail((link.continuity || "").length >= 30, `${where}: continuity must connect the paper to the laboratory question`);
  linkedPapers.add(link.paperId);
}

for (const id of paperIds) if (!linkedPapers.has(id)) errors.push(`Paper has no laboratory attribution record: ${id}`);

const leadCounts = new Map();
for (const link of links.filter((item) => item.role === "lead")) leadCounts.set(link.paperId, (leadCounts.get(link.paperId) || 0) + 1);
for (const [paperId, count] of leadCounts) if (count > 1) errors.push(`${paperId} has ${count} laboratories recorded as lead; use co-lead instead`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const withNotices = papers.filter((paper) => paper.postPublicationStatus !== "none").length;
const contested = papers.filter((paper) => paper.contested).length;
const fullTextRechecked = papers.filter((paper) => ["full-text-rechecked", "raw-data-rechecked"].includes(paper.verificationDepth)).length;
const notices = papers.flatMap((paper) => paper.versionEvents || []).length;
console.log(
  `Paper layer validation passed: ${papers.length} English paper records ` +
    `(${threeScaleCount} readable at all three scales, ${fullTextRechecked} verified against the full text, ${papers.length - fullTextRechecked} archive-derived, ` +
    `${withNotices} carrying a post-publication notice, ${contested} formally contested, ${notices} classified version events with zero unread notices) ` +
    `and ${links.length} laboratory attribution records across ${new Set(links.map((link) => link.labId)).size} laboratories.`,
);
