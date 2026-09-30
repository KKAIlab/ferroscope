# FerroScope Round-2 Independent Review

Date: 2026-07-24  
Reviewer: Codex  
Reviewed worktree baseline: `f307ea6` plus the uncommitted round-2 implementation  
Release decision: **not release-ready; do not push or deploy**

## 1. What passed independently

The Claude Code report correctly disclosed that its environment could not execute code. Codex then ran the implementation rather than accepting the report as evidence.

- `npm run check`: passed after one obsolete research-test assertion was rewritten to protect the new, more honest archive-derived wording instead of requiring the old overclaim.
- `npm run check:links`: 44 resolved, 5 reachable but automation-restricted, 0 broken after replacing the Nankai timeout with a stable official Nankai institutional page that names Quan Chen as director.
- Local module smoke test: `/`, `app.js`, `lib/records.mjs`, `lib/graph.mjs` and `data/papers-en.json` all returned 200 with the expected HTML, JavaScript or JSON MIME type.
- `git diff --check`: passed before the third-round handoff was written.

Verified corpus counts:

- 37 laboratory profiles across 11 country/region labels;
- 56 automated signals with no self-assigned evidence grade;
- 11 English reading records, all visibly archive-derived and none claimed as full-text-rechecked;
- 159 graph nodes and 192 typed edges;
- 30 ingestion fixtures under UTC, Asia/Tokyo and America/Los_Angeles;
- 16 manifest mutation cases;
- 102 rendered public-surface fragments, including hostile-metadata escaping.

## 2. P0 findings that remain

### P0-A — the display layer reintroduces the calendar-date bug

`app.js` formats a date-only value with `new Date(date)` and the viewer's local timezone. A value such as `2025-12-04` is parsed as UTC midnight and can display as **03 Dec** in a negative UTC offset. The ingestion parser is timezone-invariant, but the browser undoes that guarantee.

Required fix:

- Format ISO calendar dates explicitly in UTC, or format the components without constructing a local instant.
- Add a fixture that renders the same date under UTC, Asia/Tokyo and America/Los_Angeles and asserts the visible day is identical.

### P0-B — retained freshness is not source-specific after canonical merging

`retainOnFailure()` selects only `item.sourceName === sourceName`. A canonical record discovered through both a laboratory watch and generic PubMed stores all routes in `sources[]` but has only one top-level `sourceName`. A failure of the secondary route can therefore lose its retained copy.

The reverse case is also unsafe: if a stale retained copy and a fresh copy from another source merge, `mergeCanonicalRecords()` does not derive `stale`, `lastSuccessAt` or `lastAttemptAt` from all routes. Whichever record becomes primary can make the whole card stale or current even though the truth is route-specific.

Required fix:

- Store `stale`, `lastSuccessAt` and `lastAttemptAt` on every source route.
- On failure, retain only the failed source route from a multi-route cached record.
- During canonical merge, a card is globally stale only when every automated discovery route is stale; preserve `staleSourceNames` for partial degradation.
- Add fixtures for:
  1. a secondary discovery route failing;
  2. one fresh and one stale route merging;
  3. every route stale;
  4. a curated card plus a stale automated route.
- Render partial degradation differently from a wholly stale record.

### P0-C — the round-2 report is now stale

`DELIVERY_AUDIT_ROUND2.md` still says no tests ran, the Nankai link is unverified and `docs/link-health.json` does not exist. Those statements were true when Claude ended but are false after this independent review. Preserve it as the implementer's contemporaneous report; write a separate round-3 delivery report rather than silently rewriting history.

## 3. P1 findings

### P1-A — the method system is only half implemented

`data/evidence-bundles.json` is useful, but `data/methods.json` still lacks the fields explicitly required by the prior handoff for every one of the 16 method modules:

- specimen/model;
- biological question;
- perturbation;
- readout and quantification unit;
- instrument;
- essential positive, negative and process controls;
- orthogonal confirmation;
- timing constraints;
- compartment resolution;
- confounders;
- protocol/source URLs with verification status;
- laboratory capability attribution with the paper and role that demonstrate it.

Do not fill these fields from general knowledge and call them source-checked. Each source must carry `status`, `checkedAt`, `verificationDepth`, `scope` and a boundary. If only a review or abstract was read, label the module provisional.

### P1-B — method graph provenance is weaker than the graph contract implies

All 37 method-to-mechanism edges have `paperId: null` and `checkedAt: null`; the validator explicitly permits this. The prior contract said every edge should have a paper and a check date. A curated assay-class boundary may legitimately be paperless, but the UI and validator must distinguish:

- a paper-backed experimental edge;
- a curated method-module edge awaiting source review.

Do not present a null-check-date method edge with the same visual confidence as an archive-derived paper claim.

### P1-C — graph generator provenance names a file that does not exist

The derived graph reports `generator: "scripts/build-graph.mjs"`, while the implementation is `lib/graph.mjs`. Correct the generator identity and validate that the declared generator exists.

### P1-D — review fingerprints work, but protect zero production datasets

The mutation mechanism passes, but every curated/archive dataset remains `reviewPending: true`; the public knowledge content is therefore not pinned to reviewed bytes. Do not bulk-seal files. Seal only files actually read by an independent reviewer, and make the pending state visible on method modules that depend on unreviewed curated data.

## 4. P2 boundary

Real browser QA is still not complete. The environment policy blocked localhost in the in-app browser and prohibited a workaround. The module/MIME smoke test passed, but these remain unverified:

- desktop and 390 px layout/overflow;
- keyboard-only operation;
- dialog transition and focus restoration;
- Escape behaviour;
- console errors in a real browser.

Do not deploy merely to satisfy this check. Use an authorized HTTPS preview and record the matrix when one exists.

## 5. Corrections to the project record

- The stable Nankai entry is now `https://sklmcb-en.nankai.edu.cn/About/Administration.htm`. It is an official institutional page that names Quan Chen as director, not a dedicated laboratory-news feed.
- Five targets return 403 to automation and remain `restricted`, not healthy: Stockwell, Gao, Bush, bioRxiv and LIPID MAPS.
- The public site remains the old release. The local branch must not be pushed until the P0 findings above close and the final review says release-ready.

## 6. Next action

Execute `HANDOFF_ROUND3.md`. The release gate is unchanged: no push and no deployment.
