// Builds the curated-enrichment queue: the automated records that most deserve a
// human (or agent) reading round but have no curated coverage yet.
//
// This is a pre-read work list, NOT an audit. Nothing written here carries a review
// state, reaches data/, or renders on the site: the output lives in docs/ precisely so
// the honesty contracts stay intact — a record leaves this queue only when someone
// actually opens the primary source and writes the curated layers by hand, following
// docs/RECIPE-curated-enrichment.md.
//
// Abstracts are fetched from PubMed efetch when the network allows, because a reader
// triaging the queue works faster with the abstract in front of them. A failed fetch
// degrades to a queue without abstracts rather than failing the build: the queue's job
// is discovery, and the metadata alone already carries the work list.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalIdentity } from "../lib/records.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const docsDir = path.join(root, "docs");
const readData = async (file, fallback) => {
  try { return JSON.parse(await fs.readFile(path.join(dataDir, file), "utf8")); } catch { return fallback; }
};

const live = await readData("live.json", []);
const curated = await readData("intelligence-curated.json", []);
const overlays = await readData("record-overlays.json", []);
const papers = await readData("papers-en.json", []);
const briefs = await readData("signal-briefs-en.json", []);
const labsEn = await readData("labs-en.json", []);
const labName = new Map(labsEn.map((lab) => [lab.id, lab.pi]));

// A record is covered when any curated layer already speaks for it: a curated signal,
// an audit overlay, a paper reading record, or a signal brief.
const covered = new Set();
for (const item of curated) covered.add(canonicalIdentity(item).canonicalId);
for (const overlay of overlays) covered.add(overlay.canonicalId);
for (const paper of papers) covered.add(canonicalIdentity(paper).canonicalId);
const briefed = new Set(briefs.map((brief) => brief.id));

// Papers and preprints only: trial registry records get their caveats at ingestion and
// rarely warrant a reading card. Records the classifier already resolved to commentary,
// correction, review or protocol are excluded — the queue is for potential original
// research whose class and evidence nobody has established.
const MIN_RELEVANCE = 65;
const candidates = live
  .filter((item) => ["paper", "preprint"].includes(item.sourceType))
  .filter((item) => !["commentary", "correction", "review", "protocol"].includes(item.documentType))
  .filter((item) => (Number(item.relevance) || 0) >= MIN_RELEVANCE)
  .filter((item) => !covered.has(item.canonicalId) && !briefed.has(item.id))
  .sort((a, b) =>
    Number(Boolean(b.trackedLabIds?.length)) - Number(Boolean(a.trackedLabIds?.length))
    || (b.relevance || 0) - (a.relevance || 0)
    || String(b.date || "").localeCompare(String(a.date || "")));

// ------------------------------------------------------------------ abstracts

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

async function fetchAbstracts(pmids) {
  const abstracts = new Map();
  if (!pmids.length) return abstracts;
  try {
    const url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi");
    url.search = new URLSearchParams({ db: "pubmed", id: pmids.join(","), rettype: "abstract", retmode: "xml" });
    const response = await fetch(url, {
      headers: { "User-Agent": "FerroScope/0.1 (research intelligence dashboard)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const xml = await response.text();
    for (const article of xml.split("<PubmedArticle>").slice(1)) {
      const pmid = article.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
      if (!pmid) continue;
      const parts = [...article.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)]
        .map(([, text]) => decodeEntities(text.replace(/<[^>]+>/g, "").trim()))
        .filter(Boolean);
      if (parts.length) abstracts.set(pmid, parts.join(" "));
    }
  } catch (error) {
    console.warn(`Abstracts unavailable (${error.message}); the queue is written without them.`);
  }
  return abstracts;
}

const abstracts = await fetchAbstracts(candidates.map((item) => item.pmid).filter(Boolean));

// -------------------------------------------------------------------- outputs

const generatedAt = new Date().toISOString();
const queue = {
  generatedAt,
  generator: "scripts/build-enrichment-queue.mjs",
  status: "pre-read work list — no entry here carries any review state",
  minRelevance: MIN_RELEVANCE,
  candidateCount: candidates.length,
  candidates: candidates.map((item) => ({
    canonicalId: item.canonicalId,
    recordId: item.id,
    title: item.title,
    date: item.date,
    sourceType: item.sourceType,
    documentType: item.documentType,
    relevance: item.relevance,
    trackedLabs: (item.trackedLabIds || []).map((id) => labName.get(id)).filter(Boolean),
    url: item.url,
    doi: item.doi || null,
    pmid: item.pmid || null,
    takeaway: item.takeaway,
    abstract: abstracts.get(item.pmid) || null,
  })),
};

const entryMarkdown = (item, index) => {
  const labs = item.trackedLabs.length ? ` · lab watch: ${item.trackedLabs.join(", ")}` : "";
  const abstract = item.abstract
    ? `\n> ${item.abstract}\n`
    : "\n> Abstract not fetched in this run — open the primary link.\n";
  return `### ${index + 1}. ${item.title}

- \`${item.canonicalId}\` · ${item.date || "date unavailable"} · ${item.sourceType} (${item.documentType}) · research fit ${item.relevance}/100${labs}
- Primary source: ${item.url}${item.pmid ? ` · [PubMed](https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/)` : ""}
- Route note: ${item.takeaway}
${abstract}
- [ ] Primary source opened and read (abstract at minimum; figures before any grade)
- [ ] Document class recorded in \`data/record-overlays.json\` (with \`checkedBy\`, \`checkedAt\`, \`reason\`)
- [ ] Signal brief written in \`data/signal-briefs-en.json\` (takeaway + caveat in English)
- [ ] If read to figure level: paper record per \`docs/RECIPE-bibliographic-migration.md\`
`;
};

const markdown = `# Curated-enrichment queue

*Generated ${generatedAt} by \`scripts/build-enrichment-queue.mjs\`. Regenerate with \`npm run build:enrichment\`.*

This is a **pre-read work list, not an audit**. Every entry below is an automated
record — it matched a search, nothing more. It stays "Evidence not assessed" on the
public site until someone opens the primary source and writes the curated layers by
hand. The procedure, the honesty rules and the file contracts are in
\`docs/RECIPE-curated-enrichment.md\`. Do not tick a checkbox without doing the work it
names; the validators (\`npm run check\`) enforce the file contracts but cannot verify
that a source was actually read — that part is on the reader.

Selection: papers and preprints with research fit ≥ ${MIN_RELEVANCE}/100 and no curated
coverage (no curated signal, no audit overlay, no paper record, no brief), laboratory-watch
matches first. **${candidates.length} record(s) in the queue.**

${queue.candidates.map(entryMarkdown).join("\n")}
`;

await fs.mkdir(docsDir, { recursive: true });
await fs.writeFile(path.join(docsDir, "enrichment-queue.json"), `${JSON.stringify(queue, null, 2)}\n`);
await fs.writeFile(path.join(docsDir, "ENRICHMENT-QUEUE.md"), markdown);
console.log(`Enrichment queue written: ${candidates.length} candidate(s), ${abstracts.size} abstract(s) attached, docs/ENRICHMENT-QUEUE.md + docs/enrichment-queue.json.`);
