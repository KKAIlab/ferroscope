// README consistency check (round-5 P1-3).
//
// The README's status numbers used to drift from the data — it still said all 208 method
// fields were pending after 35 had been checked, and called archive rewrites "source-checked
// reading records". This derives the current counts from the data and requires the README's
// current-release section to state exactly those numbers, so the description cannot silently
// fall out of step with the release again.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraph, EDGE_REVIEW_STATES } from "../lib/graph.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (file) => JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8"));

const [papers, labs, labsEn, links, methods, network, claims, manifest, sourceReviews] = await Promise.all([
  read("papers-en.json"), read("labs.json"), read("labs-en.json"), read("lab-paper-links.json"),
  read("methods.json"), read("knowledge-network.json"), read("paper-claims.json"), read("schema-versions.json"), read("source-reviews.json"),
]);

const AXES = 13;
const checked = methods.reduce((total, m) => total + (m.decisionProfile?.sourceCheckedFields || 0), 0);
const pending = methods.reduce((total, m) => total + (m.decisionProfile?.pendingFields || 0), 0);
const totalFields = methods.length * AXES;
const graph = buildGraph({ papers, labs, labsEn, links, methods, network, claims, sourceReviews });
const registrySourceCount = (sourceReviews.sources || []).length;
const registryEventCount = (sourceReviews.reviewEvents || []).length;
const independentEventCount = (sourceReviews.reviewEvents || []).filter((event) => event.priorReviewEventId).length;
const state = graph.counts.byReviewState;
const sha256Hex = /^[0-9a-f]{64}$/;
const sealed = Object.values(manifest.files).filter((entry) => sha256Hex.test(entry.reviewedContentSha256 || "")).length;

const readme = await fs.readFile(path.join(root, "README.md"), "utf8");
const errors = [];
const requireText = (expected, why) => { if (!readme.includes(expected)) errors.push(`README is missing / out of step with the data: ${why}\n  expected to find: ${JSON.stringify(expected)}`); };

requireText(`${checked} of ${totalFields} method decision fields are source-checked`, "method source-checked count");
requireText(`${pending} remain pending`, "method pending count");
requireText(
  `recorded-unverified ${state["recorded-unverified"]}, archive-derived ${state["archive-derived"]}, source-checked ${state["source-checked"]} and independently-rechecked ${state["independently-rechecked"]}`,
  "graph review-state counts",
);
requireText(`${graph.counts.nodes} nodes and ${graph.counts.edges} edges`, "graph node/edge totals");
requireText(`${sealed} datasets are sealed`, "sealed-dataset count");
requireText("independently rechecked", "independent-recheck statement");
requireText("PMC7353921", "Zou author-manuscript accession");
requireText("PMC5506843", "Kagan author-manuscript accession");
requireText("author manuscript", "author-manuscript boundary");
requireText("rendered figure panels", "figure-panel boundary");
requireText("browser", "browser/accessibility QA statement");
requireText("reachability", "link-reachability boundary");
// Round-6 canonical registry: the counts must be derived, and the surface-type vocabulary
// must be described in place of the retired ordinal depth ladder.
requireText(`${registrySourceCount} canonical source records`, "registry source count");
requireText(`${registryEventCount} review events`, "registry event count");
requireText(`${independentEventCount} independent`, "independent-event count from the registry");
requireText("surface type", "surface-type coverage language");

// The old misleading phrasings must be gone.
if (readme.includes("all 208 fields are currently pending")) errors.push("README still claims all 208 method fields are pending; correct it to the current count");
if (/11 source-checked reading records/.test(readme)) errors.push("README still calls the paper layer 11 source-checked reading records; that overstates the archive-derived baseline");

if (EDGE_REVIEW_STATES.some((s) => !(s in state))) errors.push("graph is missing a declared review state");

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`README consistency check passed: current-release section matches the data (method ${checked}/${totalFields} checked, graph ${graph.counts.nodes} nodes / ${graph.counts.edges} edges, ${state["source-checked"]} source-checked and ${state["independently-rechecked"]} independently-rechecked edges, ${sealed} sealed datasets).`);
