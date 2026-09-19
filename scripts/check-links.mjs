// Link health for laboratory sites and external research resources.
//
// A 200 proves that a URL resolves. It does not prove that the page still describes the
// laboratory or resource we think it does, so nothing here is reported as a content
// check. A 403 is not health either: it means an automated client was refused, which is
// a different fact from a working page, and it is reported separately.
//
// The report is written to docs/link-health.json and carries the last time each target
// actually succeeded, so a temporary refusal does not erase the history of a good link.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");
const reportPath = path.join(root, "docs", "link-health.json");
const concurrency = 6;
const timeoutMs = 15_000;
const attempts = 3;
const checkedAt = new Date().toISOString();

const labs = JSON.parse(await fs.readFile(path.join(root, "data/labs.json"), "utf8"));
const resources = JSON.parse(await fs.readFile(path.join(root, "data/resources.json"), "utf8"));
const methods = JSON.parse(await fs.readFile(path.join(root, "data/methods.json"), "utf8"));
const sourceReviews = JSON.parse(await fs.readFile(path.join(root, "data/source-reviews.json"), "utf8"));
const previous = await fs.readFile(reportPath, "utf8").then((text) => JSON.parse(text)).catch(() => ({ targets: [] }));
const previousByKey = new Map((previous.targets || []).map((target) => [`${target.kind}:${target.id}`, target]));

// A method module declares the source its guidance rests on. Its routes now reference the
// canonical registry, so the URL is resolved from the registry source rather than embedded in
// the route. Many modules share one DOI, so the URLs are deduplicated and each target records
// which modules declare it. Resolving is still not reading: a healthy result says the document
// is reachable, nothing more.
const sourceUrlById = new Map((sourceReviews.sources || []).map((source) => [source.id, source.url]));
const methodSources = new Map();
for (const method of methods) {
  for (const route of method.sourceRoutes || []) {
    const url = sourceUrlById.get(route.sourceId);
    if (!url) continue;
    if (!methodSources.has(url)) methodSources.set(url, { modules: [], kinds: new Set() });
    methodSources.get(url).modules.push(method.id);
    methodSources.get(url).kinds.add(route.kind);
  }
}

const targets = [
  ...labs.map((lab) => ({ kind: "laboratory", id: lab.id, url: lab.website })),
  ...resources.map((resource) => ({ kind: "resource", id: resource.id, url: resource.url })),
  ...[...methodSources].map(([url, entry]) => ({
    kind: "method-source",
    id: entry.modules.join("+"),
    url,
    declaredBy: entry.modules,
    routeKinds: [...entry.kinds],
  })),
];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// "reachable" is deliberately not "healthy": the server answered, and refused us.
function classify(status) {
  if (status >= 200 && status < 400) return "healthy";
  if ([401, 403, 405, 406, 418, 429].includes(status)) return "restricted";
  return "broken";
}

async function request(url, method) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "FerroScope-Link-Monitor/1.1 (+https://kkailab.github.io/ferroscope/)" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function inspect(target) {
  const history = previousByKey.get(`${target.kind}:${target.id}`);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      let response = await request(target.url, "HEAD");
      if ([400, 405, 501].includes(response.status)) response = await request(target.url, "GET");
      const state = classify(response.status);
      return {
        ...target,
        status: response.status,
        state,
        finalUrl: response.url,
        redirected: Boolean(response.url && response.url !== target.url),
        tls: target.url.startsWith("https://"),
        checkedAt,
        lastSuccessAt: state === "healthy" ? checkedAt : history?.lastSuccessAt || null,
        proves: "the URL resolves; it does not prove the page still describes this laboratory or resource, and for a method source it does not mean anyone has read it",
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(750 * attempt);
    }
  }
  // A request that never completed proves nothing in either direction: a broken link
  // answers (404, 410, DNS pointing at a parked page answers 200), while a timeout from
  // one vantage point is routinely just the network path — several tracked laboratory
  // sites are hosted in China and time out intermittently from US-hosted runners while
  // loading fine elsewhere. That is a different fact from "broken", so it carries its
  // own state and does not, by itself, fail a strict run.
  return {
    ...target,
    status: null,
    state: "unreachable",
    finalUrl: null,
    redirected: false,
    tls: target.url.startsWith("https://"),
    checkedAt,
    lastSuccessAt: history?.lastSuccessAt || null,
    error: lastError?.cause?.code || lastError?.name || "request_failed",
    proves: "nothing; the request did not complete from this vantage point",
  };
}

const results = [];
let cursor = 0;

async function worker() {
  while (cursor < targets.length) {
    const index = cursor;
    cursor += 1;
    results[index] = await inspect(targets[index]);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

for (const result of results) {
  const mark = result.state === "healthy" ? "✓" : result.state === "restricted" ? "△" : result.state === "unreachable" ? "?" : "✗";
  const detail = result.status ?? result.error;
  const redirect = result.redirected ? ` -> ${result.finalUrl}` : "";
  console.log(`${mark} ${result.kind}/${result.id}: ${detail}${redirect}`);
}

const healthy = results.filter((result) => result.state === "healthy");
const restricted = results.filter((result) => result.state === "restricted");
const unreachable = results.filter((result) => result.state === "unreachable");
const broken = results.filter((result) => result.state === "broken");

await fs.writeFile(reportPath, `${JSON.stringify({
  checkedAt,
  note: "A healthy result means the URL resolved. It is not evidence that the page still describes the intended laboratory or resource; a restricted result means an automated client was refused rather than that the link is broken; an unreachable result means the request never completed from this vantage point, which proves nothing in either direction — lastSuccessAt says when it last resolved.",
  counts: { total: results.length, healthy: healthy.length, restricted: restricted.length, unreachable: unreachable.length, broken: broken.length },
  targets: results,
}, null, 2)}\n`);

const byKind = (kind) => results.filter((result) => result.kind === kind).length;
console.log(`\nLink health: ${healthy.length} resolved, ${restricted.length} reachable but refusing automated clients, ${unreachable.length} unreachable from this vantage point, ${broken.length} broken. Report written to docs/link-health.json.`);
console.log(`Targets by kind: ${byKind("laboratory")} laboratory sites, ${byKind("resource")} external resources, ${byKind("method-source")} declared method sources. Resolving a method source is not reading it.`);
if (restricted.length) console.log(`Restricted (not counted as healthy): ${restricted.map((result) => `${result.kind}/${result.id}`).join(", ")}`);
if (unreachable.length) console.warn(`Unreachable this run (not counted as broken; check lastSuccessAt in the report): ${unreachable.map((result) => `${result.kind}/${result.id} (${result.error})`).join(", ")}`);
if (broken.length) console.error(`Broken: ${broken.map((result) => `${result.kind}/${result.id} (${result.status ?? result.error})`).join(", ")}`);

// Strict mode is for CI. A definitively broken link is a data defect and fails the run.
// A transport failure does not — one vantage point's timeout is not evidence of death —
// unless most targets are unreachable at once, in which case the monitor's own network
// is the thing that failed and a green run would mean nothing was actually checked.
const monitorBlind = unreachable.length > results.length / 2;
if (monitorBlind) console.error(`${unreachable.length} of ${results.length} targets were unreachable: the monitor's own network path is suspect, so this run proves nothing.`);
if (strict && (broken.length || monitorBlind)) process.exit(1);
