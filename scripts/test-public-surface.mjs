// Public-surface regression tests.
//
// 1. Language gate: render the whole interface from the real data files and fail
//    if any CJK text reaches the page outside the terminology corpus.
// 2. Injection gate: render the interface again from deliberately hostile source
//    metadata and fail if markup or an unsafe URL scheme survives into the page.
//
// The renderer under test is app.js itself, driven through a small DOM harness,
// so the assertions follow the real rendering path rather than a copy of it.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DomHarness, cjkFindings, cjkPattern } from "./lib/dom-harness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "app.js");
const errors = [];
const fail = (condition, message) => {
  if (!condition) errors.push(message);
};

async function renderWith(dataRoot, cacheKey) {
  const harness = new DomHarness({ dataRoot }).install();
  const url = pathToFileURL(appPath);
  url.search = `?harness=${cacheKey}`;
  const app = await import(url.href);
  await app.ready;
  // The default view shows eight signals. The gates below are about every record that
  // can reach the page, so the whole list is rendered before it is inspected.
  app.state.visibleSignals = app.state.signals.length;
  app.renderSignals();
  for (const lab of app.state.labs) app.renderResearchProfile(lab.id);
  for (const method of app.state.methods) app.renderMethodDetail(method.id);
  for (const paper of app.state.papers) app.renderPaperDetail(paper.id);
  for (const mechanism of app.state.network?.mechanisms || []) {
    app.state.selectedMechanism = mechanism.id;
    app.renderNetworkDetail();
  }
  harness.uninstall();
  return { harness, app };
}

// ---------------------------------------------------------------- language gate

const { harness, app } = await renderWith(root, "live");

fail(app.state.labs.length > 0, "The harness rendered no laboratories; the data load path is broken.");
fail(app.state.signals.length > 0, "The harness rendered no research signals.");
fail(app.state.methods.length > 0, "The harness rendered no method modules.");
fail(harness.opened.has("#labResearchDialog"), "The laboratory profile dialog never opened during rendering.");
fail(app.state.papers.length >= 10, `The English paper layer rendered ${app.state.papers.length} records; at least ten are required.`);
fail(harness.opened.has("#paperDialog"), "The paper reading-record dialog never opened during rendering.");

// ------------------------------------------------------- evidence and document class
//
// The independent review found the interface calling every PubMed hit "Peer reviewed"
// and grading it B. Both claims are checked here against the rendered page, not against
// the data, because the rendered page is what a researcher reads.

const signalHtml = harness.htmlFor("#signalList", "#frontierGrid");
fail(!/Peer reviewed/.test(signalHtml), "The interface still labels an automated record as peer reviewed.");
fail(signalHtml.includes("Evidence not assessed"), "No record renders as unassessed, so automated alerts are still being graded.");
fail(signalHtml.includes("PubMed record"), "An unclassified automated record must render as a PubMed record rather than as research.");

const automated = app.state.signals.filter((item) => item.reviewStatus === "automated");
fail(automated.length > 0, "The harness rendered no automated signals, so the evidence gate proves nothing.");
for (const item of automated) {
  fail(item.evidenceGrade === null, `Automated record ${item.id} carries evidence grade ${item.evidenceGrade}; only a curated audit may assign one.`);
  fail(item.documentType !== "original-research" || item.documentTypeBasis === "paper-layer-audit", `Automated record ${item.id} was promoted to original research without an audit.`);
}

// The two records the review named by PMID must render as commentary, not as research.
const commentaries = [
  ["doi:10.1083/jcb.202606160", "PMID 42439891, a Journal of Cell Biology Spotlight"],
  ["doi:10.1038/s41556-026-01904-0", "PMID 41813884, a Nature Cell Biology commentary"],
];
for (const [canonicalId, description] of commentaries) {
  const record = app.state.signals.find((item) => item.canonicalId === canonicalId);
  fail(Boolean(record), `${description} is no longer in the dataset, so the classification fixture cannot run.`);
  if (!record) continue;
  fail(record.documentType === "commentary", `${description} renders as ${record.documentType} rather than commentary.`);
  fail(record.evidenceGrade === null, `${description} carries an evidence grade.`);
}

// ------------------------------------------------------------------ canonical merge

const byCanonicalId = new Map();
for (const item of app.state.signals) {
  if (byCanonicalId.has(item.canonicalId)) {
    fail(false, `Two rendered signals share the canonical identity ${item.canonicalId}: ${byCanonicalId.get(item.canonicalId)} and ${item.id}.`);
  }
  byCanonicalId.set(item.canonicalId, item.id);
}
// The four the review found rendering twice.
for (const canonicalId of ["doi:10.1016/j.cell.2025.11.014", "nct:NCT07433283", "nct:NCT06218524", "nct:NCT06928649"]) {
  const matches = app.state.signals.filter((item) => item.canonicalId === canonicalId);
  fail(matches.length === 1, `${canonicalId} renders ${matches.length} times; curated and automated layers did not merge.`);
  const merged = matches[0];
  if (!merged) continue;
  fail(merged.reviewStatus === "curated", `${canonicalId} lost its curated card in the merge.`);
  fail((merged.sources || []).length >= 2, `${canonicalId} does not retain both discovery routes.`);
}
const finLoop = app.state.signals.find((item) => item.canonicalId === "doi:10.1016/j.cell.2025.11.014");
fail((finLoop?.trackedLabIds || []).includes("mishima-tohoku"), "The merged fin-loop record dropped the automated laboratory match.");

// ------------------------------------------------------------- monitoring coverage

const labHtml = harness.htmlFor("#labGrid");
fail(!/site watch/.test(labHtml), "A laboratory is still described as site-watched although no site crawler exists.");
fail(/manual official link/.test(labHtml), "Laboratories without an author watch must be labelled as manual.");
fail(app.state.coverage?.labs?.length === app.state.labs.length, `Monitoring coverage covers ${app.state.coverage?.labs?.length} laboratories but ${app.state.labs.length} are published.`);

// ------------------------------------------------------------- verification depth

const paperHtml = harness.htmlFor("#paperGrid", "#paperContent");
fail(/Archive-derived figure chain/.test(paperHtml), "The archive-derived verification depth is not visible on the card or at the top of the dialog.");
fail(/full figures pending/.test(paperHtml), "The interface does not state that the full figures were not re-opened.");
fail(!/figure-level audit/.test(paperHtml), "The overstated 'figure-level audit' badge is still rendered.");
for (const paper of app.state.papers) {
  fail(!("publicationStatus" in paper), `${paper.id} still carries the merged publicationStatus field.`);
  fail(Boolean(paper.articleStage && paper.postPublicationStatus), `${paper.id} does not separate article stage from post-publication status.`);
  for (const event of paper.versionEvents || []) {
    fail(!(event.affectedDomains || []).includes("pending-source-check"), `${paper.id} still carries an unread correction notice.`);
    fail(/^https:\/\//.test(event.sourceUrl || ""), `${paper.id} has a version event with no notice URL.`);
  }
}

// ------------------------------------------------------- method decision schema (P1-A)
//
// A gap is only honest if a reader can see it. These assertions are against the rendered
// method dialog, not against the data, because the dialog is what a researcher reads.

const methodHtml = harness.htmlFor("#methodGrid", "#methodContent");
fail(/Provisional module/.test(methodHtml), "A module with unresolved decision fields does not say so in the dialog.");
fail(/pending source review/.test(methodHtml), "The pending-source-review status is not visible on any decision field.");
fail(/decision fields source-checked/.test(methodHtml), "The method card does not state how many decision fields are source-checked.");
fail(/What declaring it does not prove/.test(methodHtml), "A declared source route does not state what declaring it fails to prove.");
fail(/Source not yet classified/.test(methodHtml), "A source whose kind was never established must say so rather than being given a class.");
fail(/Vendor protocol/.test(methodHtml) && /Field recommendation/.test(methodHtml) && /Original research demonstration/.test(methodHtml),
  "The dialog does not distinguish vendor protocol, field recommendation and original research demonstration.");
fail(/no evidence recorded/.test(methodHtml), "Laboratories listed by curated judgement alone are not separated from evidence-backed capability.");
fail(/Demonstrated through a source-checked claim/.test(methodHtml), "No capability claim is presented as evidence-backed, so the split proves nothing.");
fail(/reviewPending/.test(methodHtml), "A module built on a dataset with no independent review does not disclose it.");

for (const method of app.state.methods) {
  const profile = method.decisionProfile;
  fail(Boolean(profile), `Method ${method.id} has no decision profile.`);
  if (!profile) continue;
  for (const [axis, field] of Object.entries(profile.fields || {})) {
    fail(["source-checked", "pending-source-review"].includes(field.status), `Method ${method.id}.${axis} has no explicit status.`);
    fail(field.status === "source-checked" || !field.value, `Method ${method.id}.${axis} carries a value while declaring itself unverified.`);
  }
  for (const route of method.sourceRoutes || []) {
    fail(route.status !== "checked" || Boolean(route.checkedAt && route.checkedBy), `Method ${method.id} claims a checked source with no reader or date.`);
  }
  for (const row of method.capabilityAttribution?.demonstrated || []) {
    fail(Boolean(row.paperId && row.role), `Method ${method.id} asserts a capability without naming both a paper and a role.`);
  }
}

// BODIPY 581/591 C11 must stay prohibited as a standalone diagnosis.
const bodipy = app.state.bundles?.neverStandalone?.find((entry) => entry.methodId === "bodipy-c11-assay");
fail(Boolean(bodipy), "BODIPY 581/591 C11 is no longer listed as an assay that may never stand alone.");
fail(/Never a standalone answer/.test(methodHtml), "The never-standalone prohibition is not rendered in any method dialog.");

// The BODIPY-versus-direct-oxidised-phospholipid comparison box must render on both assays.
fail(/BODIPY 581\/591 C11 versus direct oxidised-phospholipid/.test(methodHtml), "The BODIPY-versus-oxidised-PL comparison box does not render in the method dialog.");
fail(/does not interact with phospholipid hydroperoxides/.test(methodHtml), "The comparison box does not carry the sourced specificity limit of BODIPY C11.");

// ---------------------------------------------------- graph provenance visibility (P1-B)

const networkHtml = harness.htmlFor("#networkDetail");
fail(/awaiting source review/.test(networkHtml), "A curated method-module boundary is presented without its provisional state.");
fail(/curated method-module statements/.test(networkHtml), "The mechanism view does not separate curated assay boundaries from paper claims.");

// The terminology corpus is the only place where Chinese and Japanese are published.
const glossaryHtml = harness.htmlFor("#glossaryGrid");
const publicHtml = harness.htmlExcept("#glossaryGrid");
const leaks = cjkFindings(publicHtml);
fail(leaks.length === 0, `CJK text reached the public interface outside the terminology corpus:\n  ${leaks.join("\n  ")}`);
fail(cjkPattern.test(glossaryHtml), "The terminology corpus rendered no Chinese or Japanese translations.");

// index.html is static markup, so it is checked directly rather than through the harness.
const indexHtml = await fs.readFile(path.join(root, "index.html"), "utf8");
const glossarySection = indexHtml.slice(indexHtml.indexOf('<section id="glossary"'), indexHtml.indexOf("</section>", indexHtml.indexOf('<section id="glossary"')));
const staticOutsideGlossary = indexHtml.replace(glossarySection, "");
const staticLeaks = cjkFindings(staticOutsideGlossary);
fail(staticLeaks.length === 0, `index.html carries CJK outside the terminology section:\n  ${staticLeaks.join("\n  ")}`);

// The rendering layer suppresses CJK as a safety net. The ingestion layer must not
// rely on that net for the fields it fully controls.
const live = JSON.parse(await fs.readFile(path.join(root, "data", "live.json"), "utf8"));
const meta = JSON.parse(await fs.readFile(path.join(root, "data", "meta.json"), "utf8"));
for (const item of live) {
  for (const topic of item.topics || []) {
    fail(!cjkPattern.test(topic), `Automated signal ${item.id} carries a non-English topic label: ${topic}`);
  }
  fail(!cjkPattern.test(item.caveat || ""), `Automated signal ${item.id} carries a non-English caveat.`);
  fail(!cjkPattern.test(item.sourceType || ""), `Automated signal ${item.id} carries a non-English source type.`);
}
for (const source of meta.sources || []) {
  fail(!cjkPattern.test(source.note || ""), `Source status note for ${source.name} is not English: ${source.note}`);
}

const ingest = await fs.readFile(path.join(root, "scripts", "update-data.mjs"), "utf8");
fail(!cjkPattern.test(ingest), "scripts/update-data.mjs still contains CJK string literals or comments; the ingestion layer must be English-native.");
fail(ingest.includes("labs-en.json"), "The ingestion layer must resolve public laboratory names from labs-en.json rather than watch-query labels.");
fail(!/lab\.label|\.label\b/.test(ingest.replace(/labelFor|labelled/g, "")), "The ingestion layer must not write watch-query display labels into the public dataset.");

// -------------------------------------------------------------- injection gate

const hostileDir = await fs.mkdtemp(path.join(os.tmpdir(), "ferroscope-hostile-"));
await fs.cp(path.join(root, "data"), path.join(hostileDir, "data"), { recursive: true });

// Relevance is pinned above every curated signal so both records are inside the
// default visible window and inside the featured strip.
const hostileSignals = [
  {
    id: "hostile-markup",
    title: '<img src=x onerror="alert(1)">Ferroptosis title probe',
    date: "2026-07-01",
    sourceType: "paper",
    evidence: "B",
    relevance: 100,
    featured: true,
    frontier: '<script>alert(2)</script>',
    topics: ['<b onclick="alert(3)">lipid peroxidation</b>'],
    takeaway: '"><script>alert(4)</script> Journal of Probes',
    caveat: "</p><iframe src=//evil.example></iframe>",
    url: "javascript:alert(5)",
  },
  {
    id: "hostile-url",
    title: '<svg onload="alert(6)">Second probe record',
    date: "2026-07-02",
    sourceType: "preprint",
    evidence: "C",
    relevance: 99,
    featured: true,
    topics: ["methods"],
    takeaway: "Preprint server probe",
    caveat: "Not peer reviewed.",
    url: "data:text/html;base64,PHNjcmlwdD5hbGVydCg3KTwvc2NyaXB0Pg==",
  },
];
await fs.writeFile(path.join(hostileDir, "data", "live.json"), `${JSON.stringify(hostileSignals, null, 2)}\n`);

const hostileMeta = JSON.parse(JSON.stringify(meta));
hostileMeta.sources = [{ name: '<svg onload="alert(6)">Injected source', ok: false, updatedAt: meta.generatedAt, note: "<script>alert(7)</script>" }];
await fs.writeFile(path.join(hostileDir, "data", "meta.json"), `${JSON.stringify(hostileMeta, null, 2)}\n`);

const { harness: hostileHarness } = await renderWith(hostileDir, "hostile");
const hostileHtml = hostileHarness.allHtml();
await fs.rm(hostileDir, { recursive: true, force: true });

// Proof that the fixture actually reached the page, in neutralised form.
fail(hostileHtml.includes("Ferroptosis title probe"), "The hostile fixture did not render; the injection gate proves nothing.");
fail(hostileHtml.includes("&lt;img src=x"), "The hostile title was not rendered as escaped text.");
fail(hostileHtml.includes("&lt;script&gt;"), "The hostile script payload was not rendered as escaped text.");

// The page's own decorative SVG is legitimate markup, so tags are only rejected when
// they carry a payload or come from a source-controlled field.
fail(!/<(script|iframe|img|object|embed)\b/i.test(hostileHtml), "A tag from source metadata survived into the rendered page.");
fail(!/<svg[^>]*\son\w+\s*=/i.test(hostileHtml), "An svg carrying an event handler survived into the rendered page.");
fail(!/\son(error|load|click|mouseover)\s*=\s*["']/i.test(hostileHtml), "An inline event handler from source metadata survived into the rendered page.");
fail(!/href="javascript:/i.test(hostileHtml), "A javascript: URL survived into a rendered link.");
fail(!/href="data:/i.test(hostileHtml), "A data: URL survived into a rendered link.");
fail(hostileHtml.includes('href="#"'), "Unsafe URL schemes must be replaced by an inert href.");

// --------------------------------------------------- freshness rendering gate (P0-B)
//
// Nothing in the shipped dataset is stale, so partial degradation would never reach the
// page in the tests above. It is rendered here from a fixture, because "a card that lost
// one route of several" and "a card published entirely from retained bytes" must not look
// the same to a reader.

const freshnessDir = await fs.mkdtemp(path.join(os.tmpdir(), "ferroscope-freshness-"));
await fs.cp(path.join(root, "data"), path.join(freshnessDir, "data"), { recursive: true });

const route = (name, stale) => ({
  route: name, kind: "automated", recordId: `record-${name}`, url: "https://doi.org/10.1000/fixture",
  stale, lastSuccessAt: "2026-07-20T00:00:00.000Z", lastAttemptAt: "2026-07-23T00:00:00.000Z",
});
const freshnessSignals = [
  {
    id: "partly-retained", title: "Ferroptosis record whose secondary route failed", date: "2026-07-01",
    sourceType: "paper", documentType: "unknown", documentTypeBasis: "pubmed-publication-type-unspecific",
    evidenceGrade: null, evidenceGradeBasis: "unassessed", sourceName: "Tracked labs / PubMed",
    relevance: 100, topics: ["methods"], takeaway: "One route retained, one route current.",
    url: "https://doi.org/10.1000/fixture", stale: false, freshnessState: "partially-stale",
    staleSourceNames: ["PubMed"], freshSourceNames: ["Tracked labs / PubMed"],
    sources: [route("Tracked labs / PubMed", false), route("PubMed", true)],
  },
  {
    id: "wholly-retained", title: "Ferroptosis record whose every route failed", date: "2026-07-02",
    sourceType: "paper", documentType: "unknown", documentTypeBasis: "pubmed-publication-type-unspecific",
    evidenceGrade: null, evidenceGradeBasis: "unassessed", sourceName: "PubMed",
    relevance: 99, topics: ["methods"], takeaway: "Published from retained bytes.",
    url: "https://doi.org/10.1000/fixture-2", stale: true, freshnessState: "stale",
    staleSourceNames: ["PubMed"], freshSourceNames: [], sources: [route("PubMed", true)],
  },
];
await fs.writeFile(path.join(freshnessDir, "data", "live.json"), `${JSON.stringify(freshnessSignals, null, 2)}\n`);

const { harness: freshnessHarness } = await renderWith(freshnessDir, "freshness");
const freshnessHtml = freshnessHarness.htmlFor("#signalList");
await fs.rm(freshnessDir, { recursive: true, force: true });

fail(/one route retained/.test(freshnessHtml), "A partially degraded record does not say that one route was retained.");
fail(/every source route last failed/.test(freshnessHtml), "A wholly retained record does not say that every route failed.");
fail(/review-badge partial-stale/.test(freshnessHtml), "Partial degradation is not marked distinctly from a wholly stale record.");
const partialIndex = freshnessHtml.indexOf("partial-stale");
const staleIndex = freshnessHtml.indexOf('review-badge stale"');
fail(partialIndex !== -1 && staleIndex !== -1 && partialIndex !== staleIndex, "The two freshness states render with the same badge.");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Public surface tests passed: ${harness.writes.length} rendered fragments checked, ` +
    `CJK confined to the terminology corpus, and hostile source metadata neutralised.`,
);
