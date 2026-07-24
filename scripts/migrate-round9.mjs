// Round-9 content migration: surface legacy-audited papers into the English-first layer.
//
// The legacy archive (data/lab-research.json) holds 69 figure-audited papers with Chinese
// deepDive/figureChain content; only 11 had been migrated into data/papers-en.json. This
// script migrates further papers, honestly:
//   - the figure chain is TRANSLATED from the legacy audit and enters as archive-derived
//     (verificationDepth archive-derived, figureAudit carries NO scopeRef, so every BOUNDED_BY
//     edge resolves to the paper's unverified baseline — no forged source-checked figure claim);
//   - the paper's bibliographic metadata is RE-VERIFIED live at Crossref in this pass, so the
//     one thing marked source-checked is the metadata spine (title/journal/pages/authors), which
//     is exactly what confirms the record is real and catches any legacy drift;
//   - the publisher full text is recorded as declared-but-not-opened (recorded-unverified).
//
// Assembly is deterministic here so the provenance fields (baseline states, scope schema,
// sha256:null, sourceVersion equality, doi belonging) cannot be fat-fingered per paper. The
// script is idempotent: a DOI already present in papers-en.json is skipped.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SPECS } from "./round9-specs.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (f) => path.join(root, "data", f);
const readJson = (f) => JSON.parse(fs.readFileSync(dataPath(f), "utf8"));
const writeJson = (f, v) => fs.writeFileSync(dataPath(f), JSON.stringify(v, null, 1) + "\n");

const TODAY = new Date().toISOString().slice(0, 10);
const SOURCE_COMMIT = "e09ddd1"; // HEAD at which the legacy archive was read for this rewrite
const REVIEWER = {
  id: "claude-code-round9-migration",
  name: "Claude Code round-9 content-migration pass (implementer, not an independent reviewer)",
  role: "implementer",
};
const CROSSREF_SCOPES = ["title", "journal", "volume-pages", "issued-date", "authors", "version-relations"];
const slug = (doi) => doi.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

// --- deterministic assembly -----------------------------------------------------------------
const papers = readJson("papers-en.json");
const registry = readJson("source-reviews.json");
const links = readJson("lab-paper-links.json");
const archive = readJson("lab-research.json");

const archiveByDoi = new Map(
  (archive.papers || []).map((p) => [p.url.toLowerCase().replace(/^https:\/\/doi\.org\//, ""), p]),
);
const existingDois = new Set(papers.map((p) => p.doi));
if (!(registry.reviewers || []).some((r) => r.id === REVIEWER.id)) registry.reviewers.push(REVIEWER);

let added = 0;
for (const spec of SPECS) {
  if (existingDois.has(spec.doi)) { console.log(`skip (already migrated): ${spec.doi}`); continue; }
  const legacy = archiveByDoi.get(spec.doi.toLowerCase());
  if (!legacy) { console.error(`ABORT: no legacy record for ${spec.doi}`); process.exit(1); }
  if (legacy.title !== spec.title) {
    console.error(`ABORT: title mismatch for ${spec.doi}\n  legacy: ${legacy.title}\n  spec:   ${spec.title}`);
    process.exit(1);
  }
  const s = slug(spec.doi);
  const crossrefUrl = `https://api.crossref.org/works/${spec.doi}`;
  const doiUrl = `https://doi.org/${spec.doi}`;
  const crossrefVersion = `crossref response as retrieved on ${TODAY}; no content hash was captured at the time of that query`;
  const doiVersion = `${doiUrl} (declared source)`;

  // registry: crossref metadata source + its source-checked event
  registry.sources.push({
    id: `crossref-${s}`,
    documentClass: "crossref-metadata-record",
    url: crossrefUrl,
    identifiers: { doi: spec.doi },
    version: { label: crossrefVersion, retrievedAt: TODAY, byteLength: null, sha256: null },
    scopes: CROSSREF_SCOPES.map((label) => ({
      id: label,
      label,
      surfaceType: "metadata-record",
      accessExtent: "complete-scope",
      boundary: "Bibliographic metadata field only; no full text was read at this scope.",
    })),
  });
  registry.reviewEvents.push({
    id: `ingest-crossref-${s}`,
    sourceId: `crossref-${s}`,
    reviewState: "source-checked",
    reviewerId: REVIEWER.id,
    checkedAt: TODAY,
    scopeIds: [...CROSSREF_SCOPES].sort(),
    boundary: spec.crossrefFinding,
    priorReviewEventId: null,
    agreement: null,
    discrepancyNote: null,
  });
  // registry: the version-of-record full text, declared but not opened (no event)
  registry.sources.push({
    id: `doi-${s}`,
    documentClass: "version-of-record",
    url: doiUrl,
    identifiers: { doi: spec.doi },
    version: { label: doiVersion, retrievedAt: TODAY, byteLength: null, sha256: null },
    scopes: [],
  });

  // papers-en verification.sources derived from the registry entries above (equality guaranteed)
  const crossrefSource = {
    kind: "crossref",
    url: crossrefUrl,
    scope: CROSSREF_SCOPES,
    status: "source-checked",
    checkedAt: TODAY,
    checkedBy: REVIEWER.name,
    finding: spec.crossrefFinding,
    reviewState: "source-checked",
    verificationDepth: "metadata-checked",
    sourceVersion: crossrefVersion,
    boundary: "A registration record settles title, journal, pagination, dates, author list and version relations. It establishes nothing about what any figure, method or supplement of the paper contains.",
    sourceId: `crossref-${s}`,
    reviewEventId: `ingest-crossref-${s}`,
  };
  const fullTextSource = {
    kind: "publisher-full-text",
    url: doiUrl,
    scope: [],
    status: "not-checked",
    checkedAt: null,
    checkedBy: null,
    finding: "The full text, main figures and supplements were not re-opened, so the figure chain below is archive-derived rather than freshly read.",
    reviewState: "recorded-unverified",
    verificationDepth: "not-read",
    sourceVersion: doiVersion,
    boundary: "Declared but not opened.",
    sourceId: `doi-${s}`,
    reviewEventId: null,
  };

  papers.push({
    id: `doi:${spec.doi}`,
    doi: spec.doi,
    url: doiUrl,
    title: spec.title,
    journal: spec.journal,
    year: spec.year,
    citation: spec.citation,
    articleStage: "version-of-record",
    postPublicationStatus: "none",
    versionEvents: [],
    readingDepth: "figure-chain",
    verificationDepth: "archive-derived",
    derivedFrom: {
      legacyFile: "data/lab-research.json",
      legacyRecordId: `doi:${spec.doi}`,
      legacyReadingLevel: legacy.readingLevel,
      sourceCommit: SOURCE_COMMIT,
    },
    theme: spec.theme,
    conditionVector: spec.conditionVector,
    sixtySecond: spec.sixtySecond,
    figureAudit: spec.figureAudit.map((f) => ({
      ...f,
      sourceScope: "Figure and legend as recorded in the project audit archive; not re-opened in this pass.",
    })),
    verification: {
      checkedAt: TODAY,
      sources: [crossrefSource, fullTextSource],
      derivation: { type: "archive-rewrite", sourceRecord: `doi:${spec.doi}`, sourceCommit: SOURCE_COMMIT },
      unresolved: [],
      baselineReviewState: "archive-derived",
      baselineBoundary: "The figure chain and sixty-second card for this paper were rewritten from this project's own archive. A migration date records when the rewrite happened, not that the published source was re-opened.",
      baselineVerificationDepth: "archive-derived",
    },
  });

  for (const lab of spec.labs) {
    links.push({ labId: lab.labId, paperId: `doi:${spec.doi}`, role: lab.role, roleBasis: lab.roleBasis, continuity: lab.continuity });
  }
  existingDois.add(spec.doi);
  added += 1;
  console.log(`migrated: ${spec.doi} (${spec.figureAudit.length} figures, ${spec.labs.length} lab link[s])`);
}

if (added) {
  if (registry.updatedAt) registry.updatedAt = TODAY;
  writeJson("papers-en.json", papers);
  writeJson("source-reviews.json", registry);
  writeJson("lab-paper-links.json", links);
  console.log(`\nWrote ${added} migrated paper(s). papers-en now ${papers.length}, registry sources ${registry.sources.length}, links ${links.length}.`);
} else {
  console.log("\nNothing to migrate (all specs already present).");
}
