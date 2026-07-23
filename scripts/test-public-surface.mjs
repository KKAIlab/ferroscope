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

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Public surface tests passed: ${harness.writes.length} rendered fragments checked, ` +
    `CJK confined to the terminology corpus, and hostile source metadata neutralised.`,
);
