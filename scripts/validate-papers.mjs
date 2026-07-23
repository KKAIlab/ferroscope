// Validates the canonical English paper layer and the laboratory contribution layer.
//
// The two files are deliberately separate: papers-en.json holds facts about a paper,
// lab-paper-links.json holds a claim about who did what. Merging them would let an
// author-position guess turn into a property of the paper.

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
const publicationStatuses = new Set(["version-of-record", "accepted", "preprint", "corrected", "retracted"]);
const readingLevels = new Set(["metadata-checked", "evidence-audited", "figure-audited"]);
const affectsValues = new Set(["metadata", "methods", "figures", "conclusions", "pending-source-check"]);
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
  fail(publicationStatuses.has(paper.publicationStatus), `${where}: unknown publicationStatus ${paper.publicationStatus}`);
  fail(readingLevels.has(paper.readingLevel), `${where}: unknown readingLevel ${paper.readingLevel}`);
  fail(typeof paper.conditionVector === "string" && paper.conditionVector.length >= 60, `${where}: a condition vector is required and must describe model, inducer, exposure, readout and time window`);

  const sixty = paper.sixtySecond || {};
  for (const field of ["story", "advance", "evidenceAnchor", "scope", "openQuestion"]) {
    fail(typeof sixty[field] === "string" && sixty[field].length >= 40, `${where}: sixtySecond.${field} is missing or too short for scale 1`);
  }

  const figures = paper.figureAudit || [];
  if (paper.readingLevel === "figure-audited") {
    fail(figures.length >= 4, `${where}: a figure-audited paper needs at least four figure records, found ${figures.length}`);
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
      // A boundary statement is the opposite of an overclaim, so a nearby negation clears it.
      const lead = narrative.slice(Math.max(0, match.index - 45), match.index);
      if (/\b(not|cannot|can't|never|nor|no|rather than|without|neither|beyond)\b[^.]*$/i.test(lead)) continue;
      errors.push(`${where}: published narrative ${label} ("${narrative.slice(Math.max(0, match.index - 30), match.index + match[0].length)}")`);
    }
  }
  fail(!cjk.test(JSON.stringify({ ...paper, verification: null })), `${where}: the published paper record must be English`);

  const events = paper.versionEvents || [];
  for (const [eventIndex, event] of events.entries()) {
    const eventWhere = `${where} versionEvent ${eventIndex + 1}`;
    fail(Boolean(event.type), `${eventWhere}: a type is required`);
    fail(isoDate.test(event.date || ""), `${eventWhere}: an ISO date is required`);
    fail(!event.date || event.date <= today, `${eventWhere}: the date is in the future`);
    fail(affectsValues.has(event.affects), `${eventWhere}: affects must be one of ${[...affectsValues].join(", ")}`);
    fail((event.note || "").length >= 40, `${eventWhere}: a note explaining the event is required`);
  }
  const hasCorrection = events.some((event) => /correction/i.test(event.type || ""));
  fail(!hasCorrection || paper.publicationStatus === "corrected", `${where}: a registered correction requires publicationStatus "corrected"`);
  const isContested = events.some((event) => /matters arising|comment|reply/i.test(event.type || ""));
  fail(!isContested || paper.contested === true, `${where}: a Matters Arising or Reply must be surfaced with contested: true`);

  const verification = paper.verification || {};
  fail(isoDate.test(verification.checkedAt || ""), `${where}: verification.checkedAt must be an ISO date`);
  fail(!verification.checkedAt || verification.checkedAt <= today, `${where}: verification.checkedAt is in the future`);
  for (const field of ["metadata", "claims", "figureLayer"]) {
    fail((verification[field] || "").length >= 40, `${where}: verification.${field} must record what was actually checked`);
  }
  fail(Array.isArray(verification.unresolved), `${where}: verification.unresolved must be an array, empty if nothing is outstanding`);

  const pending = events.filter((event) => event.affects === "pending-source-check");
  fail(pending.length === 0 || (verification.unresolved || []).length > 0, `${where}: a pending correction check must appear in verification.unresolved`);

  if (paper.readingLevel === "figure-audited" && figures.length >= 4 && Object.keys(sixty).length === 5) threeScaleCount += 1;
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
  if (legacy.publicationStatus !== paper.publicationStatus) {
    fail((paper.versionEvents || []).length > 0, `${paper.doi}: publication status differs from the legacy archive (${legacy.publicationStatus} vs ${paper.publicationStatus}) without a recorded version event`);
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

const corrected = papers.filter((paper) => paper.publicationStatus === "corrected").length;
const contested = papers.filter((paper) => paper.contested).length;
console.log(
  `Paper layer validation passed: ${papers.length} source-checked English papers ` +
    `(${threeScaleCount} at all three reading scales, ${corrected} carrying registered corrections, ${contested} formally contested) ` +
    `and ${links.length} laboratory attribution records across ${new Set(links.map((link) => link.labId)).size} laboratories.`,
);
