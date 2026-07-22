import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const labs = JSON.parse(await fs.readFile(path.join(root, "data/labs.json"), "utf8"));
const strict = process.argv.includes("--strict");
const concurrency = 6;
const timeoutMs = 15_000;
const attempts = 2;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function classify(status) {
  if (status >= 200 && status < 400) return "healthy";
  if ([401, 403, 405, 406, 418, 429].includes(status)) return "reachable";
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
      headers: {
        "user-agent": "FerroScope-Link-Monitor/1.0 (+https://kkailab.github.io/ferroscope/)"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function inspect(lab) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      let response = await request(lab.website, "HEAD");
      if ([400, 405, 501].includes(response.status)) response = await request(lab.website, "GET");
      return {
        id: lab.id,
        url: lab.website,
        finalUrl: response.url,
        status: response.status,
        state: classify(response.status)
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(750 * attempt);
    }
  }
  return {
    id: lab.id,
    url: lab.website,
    status: null,
    state: "broken",
    error: lastError?.cause?.code || lastError?.name || "request_failed"
  };
}

const results = [];
let cursor = 0;

async function worker() {
  while (cursor < labs.length) {
    const index = cursor;
    cursor += 1;
    results[index] = await inspect(labs[index]);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

for (const result of results) {
  const mark = result.state === "healthy" ? "✓" : result.state === "reachable" ? "△" : "✗";
  const detail = result.status ?? result.error;
  const redirect = result.finalUrl && result.finalUrl !== result.url ? ` -> ${result.finalUrl}` : "";
  console.log(`${mark} ${result.id}: ${detail}${redirect}`);
}

const broken = results.filter((result) => result.state === "broken");
const restricted = results.filter((result) => result.state === "reachable");
console.log(`\n外链体检：${results.length - broken.length - restricted.length} 正常，${restricted.length} 可达但限制自动访问，${broken.length} 硬故障。`);

if (strict && broken.length) process.exit(1);
