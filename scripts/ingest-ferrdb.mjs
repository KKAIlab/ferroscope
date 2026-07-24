// Build-time ingestion of the FerrDb V3 ferroptosis regulator table into
// data/ferrdb-regulators.json.
//
// STATUS: LICENSE-GATED. As recon on 2026-07-24 established, the FerrDb site does NOT
// grant an explicit redistribution licence:
//   - Footer (current, cites the V3 paper gkaf1119): "All rights reserved."
//   - Download page visible text grants only "free access to all of its data for
//     educational and scientific purposes" — a use permission, not a right to re-publish.
//   - A CC BY-NC 4.0 statement exists in the V2 download-page source but is HTML-commented
//     out and shown to nobody; it is absent from the V3 download page.
//   - The NAR article is CC BY-NC 4.0, which covers the article text/figures, NOT the
//     database dumps.
// Redistributing FerrDb's gene-level curation onto FerroScope's public GitHub Pages is
// therefore NOT authorised. This script will NOT fetch or write gene-level FerrDb data
// unless run with --license-confirmed, which a human must set only after the FerrDb
// maintainers (admin@zhounan.org) confirm redistribution rights in writing.
//
// Without the gate, it (re)writes a placeholder data/ferrdb-regulators.json that carries
// full provenance, the paper's Table 2 aggregate counts (cited facts, not a data dump)
// and an empty regulators array marked pending-license-confirmation.
//
//   node scripts/ingest-ferrdb.mjs                     # writes/refreshes the placeholder
//   node scripts/ingest-ferrdb.mjs --license-confirmed # ONLY after written permission
//
// Download contract discovered during recon (for the licensed path):
//   POST https://data.zhounan.org/pm2505/api/download/data/
//   body: multipart FormData { selectRcd: "ferroptosis", selectDataset: <driver|
//         suppressor|marker|unclassified|inducer|inhibitor|disease>, selectFormat: "csv" }
//   response: a CSV blob for that dataset. Only ferroptosis and cuproptosis are exposed in
//   the download form even though the database covers 22 RCD modalities.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "data", "ferrdb-regulators.json");

const GENERATOR_VERSION = "0.1.0";
const CHECKED_AT = "2026-07-24";
const licenseConfirmed = process.argv.includes("--license-confirmed");

// Aggregate totals quoted verbatim from FerrDb V3 paper Table 2 (ferroptosis, V3). These
// are published figures cited with attribution, NOT the per-gene database dump.
const publishedCounts = {
  note: "Verbatim aggregate totals from FerrDb V3 paper Table 2 (ferroptosis modality, V3). Cited as published facts with attribution; NOT the per-gene database export.",
  driver: 734,
  suppressor: 1021,
  marker: 59,
  unclassified: 143,
  inducerSubstance: 563,
  inhibitorSubstance: 510,
  diseaseAssociation: 437,
  ferroptosisArticlesCurated: 18371
};

const provenance = {
  name: "FerrDb V3",
  version: "V3",
  siteUrl: "https://www.zhounan.org/ferrdb/v3/",
  downloadPage: "https://www.zhounan.org/ferrdb/v3/pages/download.html",
  downloadApi: "POST https://data.zhounan.org/pm2505/api/download/data/ (FormData selectRcd/selectDataset/selectFormat; formats txt|csv; ferroptosis and cuproptosis only)",
  geneUrlTemplate: "https://www.zhounan.org/ferrdb/v3/pages/genedetail.html?genesymbol={SYMBOL}",
  paper: {
    citation: "Zhou N, et al. FerrDb V3: expanding the manually curated resource for regulators and disease associations from ferroptosis to regulated cell death. Nucleic Acids Res. 2026;54:D572-D582.",
    doi: "10.1093/nar/gkaf1119",
    articleLicense: "CC BY-NC 4.0 (covers the article, not the database export)"
  },
  checkedAt: CHECKED_AT,
  license: {
    siteFooter: "©Copyright 2019- by FerrDb. All rights reserved.",
    visibleDataGrant: "Free access to all of its data for educational and scientific purposes.",
    ccByNcOnSite: "A CC BY-NC 4.0 statement exists in the V2 download-page HTML source but is commented out and not displayed; it is absent from the V3 download page.",
    redistribution: "NOT AUTHORISED. FerrDb data must not be mirrored onto FerroScope's public GitHub Pages until the maintainers (admin@zhounan.org) confirm redistribution rights in writing."
  },
  useBoundary: "FerrDb is a third-party, dated, secondary source. Its labels are publication-centric: the same gene may be recorded as driver in one paper and suppressor in another, and both are kept with a per-gene confidence level. Disease links are association-level, not causal. Any number derived from it is a literature count, never a mechanistic claim."
};

async function fetchLicensedRegulators() {
  // Reference implementation of the licensed path. Intentionally reached only under the
  // --license-confirmed gate. Left as a documented POST so that, once permission exists,
  // ingestion is a small, auditable change rather than a rewrite.
  const datasets = ["driver", "suppressor", "marker", "unclassified"];
  const regulators = [];
  for (const dataset of datasets) {
    const body = new FormData();
    body.set("selectRcd", "ferroptosis");
    body.set("selectDataset", dataset);
    body.set("selectFormat", "csv");
    const response = await fetch("https://data.zhounan.org/pm2505/api/download/data/", { method: "POST", body });
    if (!response.ok) throw new Error(`FerrDb download failed for ${dataset}: ${response.status} ${response.statusText}`);
    const csv = await response.text();
    // A licensed run parses CSV -> { symbol, classification, confidence, citationCount }
    // rows here. Parsing is deliberately not implemented on the ungated path so no scraped
    // rows can be produced by accident.
    regulators.push({ dataset, rawCsvLength: csv.length, parsed: "IMPLEMENT_ON_LICENSED_RUN" });
  }
  return regulators;
}

async function main() {
  let regulators = [];
  let status = "pending-license-confirmation";
  let regulatorsStatus = "empty-pending-license";

  if (licenseConfirmed) {
    regulators = await fetchLicensedRegulators();
    status = "license-confirmed";
    regulatorsStatus = "populated";
    console.warn("--license-confirmed set: fetched FerrDb data. Confirm written redistribution permission is on file before committing this output.");
  } else {
    console.log("License gate active: writing placeholder ferrdb-regulators.json with no gene-level FerrDb data.");
    console.log("Run with --license-confirmed only after admin@zhounan.org grants redistribution rights.");
  }

  const payload = {
    generatorVersion: GENERATOR_VERSION,
    generatedAt: CHECKED_AT,
    status,
    source: provenance,
    publishedCounts,
    regulators,
    regulatorsStatus
  };

  await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${path.relative(root, outPath)} (status: ${status}, ${regulators.length} regulator rows).`);
}

main().catch((error) => { console.error(error); process.exit(1); });
