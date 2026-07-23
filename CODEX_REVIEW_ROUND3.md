# FerroScope Round-3 Independent Review

Date: 2026-07-24
Reviewer: Codex
Reviewed HEAD: `316bef9`
Implementation report: `DELIVERY_AUDIT_ROUND3.md`
Release decision: **not release-ready; do not push or deploy**

## 1. Outcome

Round 3 closes the two engineering P0 defects from the previous review. Calendar dates now render identically across timezones, and freshness is derived per discovery route instead of from whichever copy wins a merge. The implementation has meaningful negative and mutation tests, not only green-path assertions.

The project is now a credible **research-system framework**. It is not yet a source-verified ferroptosis knowledge base. The limiting numbers are:

- 0 of 208 method decision fields checked against a declared source;
- 0 of 11 paper records rechecked against the full text and figures;
- 0 curated datasets sealed to independently reviewed bytes;
- 0 automated laboratory-site monitors;
- browser, mobile and keyboard QA still pending.

Passing code tests cannot convert these zeroes into scientific validation.

## 2. Independent checks

Codex independently ran the following after Claude Code finished:

- `npm run check`: exit 0;
- `npm run check:links`: 52 resolved, 5 automation-restricted, 0 broken across 57 targets;
- `git diff --check`: clean at the reviewed commit;
- worktree was clean before the independent link-health timestamp was refreshed.

Verified corpus and contract counts:

- 37 laboratories across 11 country/region labels;
- 56 automated records and 57 discovery routes;
- 16 method modules, each carrying 13 decision fields;
- 11 English paper records, all archive-derived;
- 159 graph nodes and 192 typed edges;
- 118 edges labelled `source-checked`, 74 labelled `pending-source-review`;
- 18 owned datasets awaiting independent review and 0 sealed fingerprints.

The Claude delivery report accurately states the test results and the remaining browser/full-text boundary. It must remain as an implementation report, not be treated as independent scientific review.

## 3. Closed findings

### Closed — calendar-date display

`2025-12-04` renders as `04 Dec 2025` in UTC, Asia/Tokyo and America/Los_Angeles. The test drives the real interface. Reintroducing the prior `new Date(date)` implementation makes the Los Angeles case fail as `03 Dec 2025`.

### Closed — route-specific freshness

The data model now stores freshness on each discovery route and distinguishes:

- current;
- partially stale;
- wholly retained/stale;
- curated only.

Fixtures cover a secondary source failure, mixed fresh/stale routes, all routes stale, and a curated card with a stale automated route. The public badges distinguish partial degradation from complete retention.

### Closed — graph provenance class separation

Paper-backed experimental edges, laboratory attribution records, bibliographic events and curated method-module boundaries are now distinct provenance classes. A paperless method boundary no longer looks identical to a paper claim, and the declared generator resolves to `lib/graph.mjs`.

## 4. New P0 findings

### P0-A — `checkedAt` is incorrectly used as proof of source review

`lib/graph.mjs` derives `reviewState: "source-checked"` from the presence of an ISO `checkedAt` date. That is not a valid scientific rule. A date can mean that a record was created, migrated or metadata-checked; it does not prove that the full text, figure, legend, methods or supplement was read.

This matters now, not hypothetically:

- all 11 papers declare `verificationDepth: "archive-derived"`;
- `paper-claims.json` carries dates on claims derived from the legacy archive;
- the graph therefore reports 118 edges as `source-checked`;
- the method dialog says `Demonstrated through a source-checked claim` even though no paper was full-text-rechecked in this release.

Required correction:

1. Make review state explicit in the source record; never derive it from a date.
2. Use a controlled depth vocabulary such as:
   - `recorded-unverified`;
   - `metadata-checked`;
   - `abstract-checked`;
   - `archive-derived`;
   - `figures-legends-checked`;
   - `methods-checked`;
   - `full-text-rechecked`;
   - `raw-data-rechecked`.
3. Keep `checkedAt`, `checkedBy`, `sourceVersion` and `scope[]` as separate fields.
4. A graph edge may be called `source-checked` only if its explicit source record says what was read and the edge's claim falls inside that scope.
5. Until the 11 papers are re-read, render these claims as `archive-derived claim · source recheck pending`.
6. Rename capability rows accordingly; do not call them source-checked.

Acceptance mutation: adding or changing `checkedAt` alone must never promote review state.

### P0-B — a method edge can be promoted by adding only a date

`scripts/test-graph-contract.mjs` currently asserts that setting `network.methodLinks[0].checkedAt = "2026-07-24"` promotes the method edge to `source-checked`. This encodes the same faulty rule as a desired behaviour.

Required correction:

- promotion requires a linked method source route with explicit `status: source-checked`, `checkedBy`, ISO `checkedAt`, non-empty `scope[]`, `verificationDepth` and a source URL/version;
- the scope must cover the actual assertion (`MEASURES` or `CANNOT_DISTINGUISH`);
- a date without those fields must fail validation;
- replace the current promotion test with negative tests for date-only, URL-only and scope-mismatch promotion.

## 5. P1 findings

### P1-A — the knowledge system contains schema, not method knowledge

All 208 method fields are honestly pending. That is preferable to fabricated completeness, but it means the current method atlas is a decision-schema shell. The next round must read primary sources and fill a small high-value subset deeply. Do not create another schema layer.

### P1-B — retention age ignores the route fallback date

`retainOnFailure()` correctly derives `routeSuccessAt` from either the supplied source status or the cached route. It then computes `ageDays` from only the function argument `lastSuccessAt`. If that argument is absent but the route has a valid `lastSuccessAt`, the route is treated as infinitely old and discarded.

Required fix:

```js
const ageDays = routeSuccessAt
  ? daysBetween(routeSuccessAt, attemptedAt)
  : Number.POSITIVE_INFINITY;
```

Add a fixture where the cached route supplies the only success date.

### P1-C — date parser validates shape but not real calendar dates

`parseCalendarDate()` and `formatCalendarDate()` accept impossible dates such as 31 February because they validate numeric ranges only loosely. This is not the observed timezone regression, but it is a future ingestion-quality risk. Validate calendar components without local-time conversion and add leap-year fixtures.

### P1-D — historical-link corrections need an overlay

The legacy Nankai archive still records a timed-out URL as `verified: true`. Rewriting the archive would falsify its historical state, but leaving an unqualified `verified` flag is also misleading to future tooling. Add a correction/overlay record that preserves the original assertion while superseding its current reachability status.

### P1-E — author identity and website monitoring remain weak

Eight watches have never completed a first run, 14 laboratories are manual-only, no ORCID is proven and no laboratory website is monitored for content changes. A 200 response is only reachability. Do not use it as evidence of current laboratory activity.

## 6. Scientific content gate

The next usable milestone is not “more records.” It is a small, sealed primary-source core:

1. re-read 3 anchor papers plus their relevant figures, legends and methods;
2. read the 2025 reproducibility recommendation and the BODIPY vendor protocol;
3. populate only the method fields supported by those sources;
4. attach scope and boundary to every promoted claim;
5. independently review and seal only the datasets whose bytes were actually checked.

Recommended anchor set for the user's lipid-biochemistry focus:

- GPX4 fin-loop / membrane anchoring: `10.1016/j.cell.2025.11.014`;
- oxidized AA/AdA phosphatidylethanolamines: `10.1038/nchembio.2238`;
- POR-driven phospholipid peroxidation: `10.1038/s41589-020-0472-6`, including its methods correction;
- field methods recommendation: `10.1038/s41580-025-00843-2`;
- BODIPY 581/591 C11 vendor protocol: `https://www.thermofisher.com/order/catalog/product/D3861`.

If access is limited to abstract or figures, record exactly that scope. Do not infer unavailable methods details from reviews or general knowledge.

## 7. Release boundary

Do not push or deploy yet. A release candidate requires:

- P0-A and P0-B closed;
- at least 3 papers genuinely rechecked and visible as such;
- at least 3 priority method modules partially populated from read sources, with every remaining field explicitly pending;
- an authorized HTTPS preview and desktop/390 px/keyboard/focus/console QA;
- an independent final review of the changed datasets followed by selective sealing.

The authoritative continuation plan is `HANDOFF.md`.
