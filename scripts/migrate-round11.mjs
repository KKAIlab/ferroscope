// Round-11 content migration: bring three founding/defining defence-arm papers into the English layer
// at the BIBLIOGRAPHIC level, so the mechanism graph's GCH1-BH4, mevalonate-sterol and system xc- arms
// can be anchored to a real source instead of an unsourced assertion.
//
// This is a NEW, shallower tier than the round 8-10 archive-derived migration. These papers are NOT in
// the project's figure-audit archive, so:
//   - there is NO figure chain: readingDepth is "abstract", the record carries no figureAudit, and the
//     baseline is recorded-unverified (nothing here can read as a figure-level claim);
//   - the ONLY source-checked fact is the Crossref bibliographic spine, re-verified live in this pass
//     (verificationDepth metadata-checked) — exactly what confirms the record is real;
//   - the version-of-record full text is recorded as declared-but-not-opened.
// The honest ceiling is therefore metadata-checked. A mechanism edge that cites one of these papers is
// anchored to a named, real source read at abstract level, not to a figure this project audited.
//
// Idempotent: a DOI already present in papers-en.json is skipped. No archive record is required or read.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SPECS } from "./round11-specs.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (f) => path.join(root, "data", f);
const readJson = (f) => JSON.parse(fs.readFileSync(dataPath(f), "utf8"));
const writeJson = (f, v) => fs.writeFileSync(dataPath(f), JSON.stringify(v, null, 1) + "\n");

const TODAY = new Date().toISOString().slice(0, 10);
const REVIEWER = {
  id: "claude-code-round11-migration",
  name: "Claude Code round-11 bibliographic-migration pass (implementer, not an independent reviewer)",
  role: "implementer",
};
const CROSSREF_SCOPES = ["title", "journal", "volume-pages", "issued-date", "authors", "version-relations"];
const slug = (doi) => doi.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

const papers = readJson("papers-en.json");
const registry = readJson("source-reviews.json");
const links = readJson("lab-paper-links.json");

const existingDois = new Set(papers.map((p) => p.doi));
if (!(registry.reviewers || []).some((r) => r.id === REVIEWER.id)) registry.reviewers.push(REVIEWER);

let added = 0;
for (const spec of SPECS) {
  if (existingDois.has(spec.doi)) { console.log(`skip (already present): ${spec.doi}`); continue; }
  const s = slug(spec.doi);
  const crossrefUrl = `https://api.crossref.org/works/${spec.doi}`;
  const doiUrl = `https://doi.org/${spec.doi}`;
  const crossrefVersion = `crossref response as retrieved on ${TODAY}; no content hash was captured at the time of that query`;
  const doiVersion = `${doiUrl} (declared source)`;

  // registry: crossref metadata source + its source-checked event (the one verified fact)
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
    finding: "The full text, figures and supplements were not opened. This record is bibliographic: only the Crossref metadata spine was verified and the scientific content is summarised at abstract level.",
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
    readingDepth: "abstract",
    verificationDepth: "metadata-checked",
    theme: spec.theme,
    conditionVector: spec.conditionVector,
    sixtySecond: spec.sixtySecond,
    verification: {
      checkedAt: TODAY,
      sources: [crossrefSource, fullTextSource],
      unresolved: [],
      baselineReviewState: "recorded-unverified",
      baselineBoundary: "This record is bibliographic: only the Crossref metadata spine was source-checked. The scientific summary is abstract-level and no figure, method or supplement of the paper was opened, so every scientific claim falls back to a recorded-unverified baseline.",
      baselineVerificationDepth: "metadata-checked",
    },
  });

  for (const lab of spec.labs) {
    links.push({ labId: lab.labId, paperId: `doi:${spec.doi}`, role: lab.role, roleBasis: lab.roleBasis, continuity: lab.continuity });
  }
  existingDois.add(spec.doi);
  added += 1;
  console.log(`migrated (bibliographic): ${spec.doi} (${spec.labs.length} lab link[s])`);
}

if (added) {
  if (registry.updatedAt) registry.updatedAt = TODAY;
  writeJson("papers-en.json", papers);
  writeJson("source-reviews.json", registry);
  writeJson("lab-paper-links.json", links);
  console.log(`\nWrote ${added} bibliographic paper(s). papers-en now ${papers.length}, registry sources ${registry.sources.length}, links ${links.length}.`);
} else {
  console.log("\nNothing to migrate (all specs already present).");
}
