# FerroScope round-6 delivery audit

Date: 2026-07-24
Answers: `CODEX_REVIEW_ROUND5.md`, executed against `HANDOFF.md`
Base commit: `7d0622c` · Delivered at: `c1c24b2` (local `main`, not pushed)
Decision requested: independent Codex review. **This is not a claim of delivery readiness.**

Session had full `node`/`npm`/`git`/network access. No push, deploy, PR, seal, `git
checkout`/`reset`, or real independent-review event was created. No corpus content was added.

## 1. Commits

```
c729850 Introduce one canonical source/review registry and migrate consumers to references
a3f7778 Resolve the canonical registry in the validator, graph and UI
c1c24b2 Test the registry, independent-event and clause-fragment contracts; refresh counts
```

Worktree clean after commit; `git diff --check` passes.

## 2. Acceptance commands and results

| Command | Result |
|---|---|
| `npm run check` | **exit 0** — all 13 steps pass |
| `npm run check:links` | 54 resolved, **5 restricted reported separately**, **0 failed** |
| `git diff --check` | clean |
| worktree | clean (`git status --short` empty) |

Selected step output: v0.9 validation passed (registry validated first, 0 problems); method
schema 33 source-checked / 175 pending; paper layer 11 records; graph 159 nodes / 192 edges;
graph-contract 33 cases; method-review 25 mutation cases; public-surface 102 fragments;
manifest 17 cases; README consistency `method 33/208, 159 nodes / 192 edges, 46 source-checked,
0 independently-rechecked, 0 sealed`.

## 3. Source-registry schema (`data/source-reviews.json`, `lib/source-registry.mjs`)

Three object types, all id-joined:

- **Source record** — `{ id, documentClass, url, identifiers, version{label, retrievedAt,
  byteLength, sha256}, scopes[] }`. Globally unique id.
- **Reviewed scope** (nested in a source) — `{ id, label, surfaceType, accessExtent, boundary }`.
  Unique within its source. `surfaceType` is a controlled vocabulary (metadata-record,
  abstract-text, results-text, body-text, figure-caption, figure-panel, methods-text,
  supplement-text/data, correction-text, vendor-description/specifications/faq, full-document,
  raw-data); `accessExtent` is not-opened / partial-scope / complete-scope. **The ordinal depth
  ladder is retired at the surface layer**; a legacy `verificationDepth` is *derived* from the
  surface (`surfaceToDepth`) only for backward-compatible internal ceilings and counts, and is
  no longer the statement a reader is shown.
- **Review event** — `{ id, sourceId, reviewState, reviewerId, checkedAt, scopeIds[], boundary,
  priorReviewEventId, agreement, discrepancyNote }`. Globally unique id; source and every scope
  resolve; independent events carry a resolving `priorReviewEventId`.

`validateRegistry()` enforces global id uniqueness, event→source/scope resolution and every
independent-review chain. `createResolver()` gives read-through `source/event/scope/reviewer`
lookups used by the validator, graph, UI and tests.

## 4. Migration table (round-5 embedded shape → round-6 reference shape)

| Consumer | Round 5 | Round 6 |
|---|---|---|
| method `sourceRoutes[]` | embedded url, status, reviewerId, checkedAt, checkedBy, sourceVersion, verificationDepth, reviewedScopes | `{ id, kind, kindBasis, corpusPaperId?, sourceId, reviewEventId\|null, routePurpose, boundary }` — no authority stored |
| method evidence item | sourceRecordId, reviewEventId, scopeId, supportMode, supportNote (+ denormalised url/version/date) | + `claimFragment`; denormalised authority forbidden; scopeId is the canonical registry scope id |
| paper `verification.sources[]` | url, reviewState, verificationDepth, checkedBy, sourceVersion, scope | + `sourceId`, `reviewEventId`; registry is authority, denormalised url cross-checked byte-for-byte |

Migration is `scripts/migrate-round6.mjs` + `scripts/round6-corrections.mjs` (one-shot,
idempotency-guarded; committed as reproducible provenance, not part of `npm run check`).

## 5. Canonical counts

- **45 source records, 174 reviewed scopes, 30 review events, 4 reviewers, 0 independent events.**
- Scope surface types: metadata-record 80, methods-text 32, correction-text 16, results-text 14,
  abstract-text 13, figure-caption 11, body-text 5, vendor-description/specifications/faq 1 each.

## 6. Cross-file duplicate elimination (the review's P0-1 attack)

One record per source, referenced by many consumers:

| Canonical source | Referencing method routes | Also in paper layer |
|---|---|---|
| `field-rec-2025-nrmcb` | **9** (was 9 embedded copies) | — |
| `pmc7353921` (Zou) | 2 (BODIPY + MDA) | paper `doi:10.1038/s41589-020-0472-6` |
| `pmc5506843` (Kagan) | 2 (BODIPY + oxidized-PL) | paper `doi:10.1038/nchembio.2238` |
| `thermofisher-d3861` | 1 (BODIPY) | — |

The forged-version attack now **fails at the type level**: a method route stores no version to
forge (`test-method-review`: "a route embedding its own version is rejected"). A second source
minted under an existing id but different bytes/URL fails `validateRegistry` ("a forged second
source under an existing id fails registry validation").

## 7. Source hashes and access surfaces

- `pmc7353921` — 117,289 bytes, SHA-256 `3165d84baf87d6798e3b76843f60e651c43c3979367d346be5929f021e4a7b6d`, accepted-author-manuscript.
- `pmc5506843` — 140,459 bytes, SHA-256 `647b73b571ea97af59d24483fd4cb3b3f16112ab2dea20849216b7c9334769aa`, accepted-author-manuscript.

Both byte pins were independently fetched by Codex (`CODEX_REVIEW_ROUND5.md §2`). Recording
objective bytes is not a scientific review and does not authorise a source-checked promotion.
Vendor `thermofisher-d3861` scopes carry `vendor-description/specifications/faq` surfaces and
render as "Vendor product description", never as a scientific full text.

## 8. Independent-event mutation matrix (`validateIndependentEvent`, all rejected)

nonexistent prior id (`THIS-EVENT-DOES-NOT-EXIST`); prior id == event id; changed source id;
same reviewer as prior; owner as reviewer; no overlapping scope; scope the source does not
declare; date earlier than prior; missing agreement; partial-agreement with no discrepancy
note; missing recheck (via route). Whole-registry: duplicate event id; forged duplicate source
id. A well-formed recheck passes. `buildGraph` rejects an invalid chain when called directly
(graph-contract: "buildGraph refuses an invalid independent-review chain even when called
directly"). **No real independent event was created** — Codex adds the first.

## 9. Graph reviewer-propagation regression (P0-3)

`test-graph-contract` "array order never decides review state, and a recheck attributes to the
second reader": with a genuine registry recheck over a shared scope, the promoted edge is
`independently-rechecked`, `reviewerId === independent-review-codex`, `checkedBy` does not match
`implementer`, and `agreement === agrees` — regardless of route array order. The round-5 defect
(edge claiming independent review while naming the original implementer) is fixed because the
edge now inherits the resolved independent event, not the original route.

## 10. Support-fragment corrections by method field (P0-5)

Every source-checked evidence row now names the exact clause it supports (`claimFragment`,
required and unique per field). The interpretive clauses the review named were relabelled from
`explicit`:

| Field | Corrected clause → mode |
|---|---|
| `mda-4hne.readout` | "measured species is the MDA–TBA adduct" → derived |
| `mda-4hne.negativeControl` | "DMSO/liproxstatin as the negative-control axis" → derived |
| `mda-4hne.processControl` | "BHT functions as a process control" → derived |
| `mda-4hne.compartmentResolution` | "no molecular-species/compartment resolution" → analytical-inference |
| `mda-4hne.orthogonalConfirmation` | "corroborates rather than substitutes" → derived |
| `oxidized-pl-lcms.positiveControl` | "positive-control / identity-reference axis" → derived |
| `oxidized-pl-lcms.negativeControl` | "Acsl4-KO read as negative-control axis" → derived |
| `oxidized-pl-lcms.processControl` | "internal-standard read as process control" → derived |
| `oxidized-pl-lcms.compartmentResolution` | "no compartment resolution" → analytical-inference, **cited to the whole-extract LC-MS scope**; the LiperFluo imaging scopes support only where the ER localisation came from (explicit) |
| `oxidized-pl-lcms.orthogonalConfirmation` | "convergent genetic+pharmacological suppression tests the same conclusion" → derived |
| `bodipy-c11-assay.question` | "an emission shift rather than an identified molecular species" → derived (from Kagan's specificity limit) |

The validator requires a non-empty, non-duplicate claim fragment per row; missing and duplicate
fragments are rejected (`test-method-review`). Source-checked field count is unchanged at 33 —
the difference is now visible per clause rather than lost in a single coarse mode.

## 11. Public UI assertions (`test-public-surface`, rendered DOM — not browser QA)

Asserted against the rendered method dialog: the canonical registry resolves on app state; each
evidence row renders its claim fragment, its surface type + access extent, "Read by
<reviewer> · <date>", the boundary ("Not established here:"), the document class/version and
"Opened source ↗"; a Results scope renders as "Results section text" and a Methods scope as
"Methods section text"; **no method surface renders "Methods-checked" or "full-text-rechecked"**;
the vendor page renders as "Vendor product description"; the relabelled "Derived from source"
mode is visible. Chinese/Japanese remain confined to the terminology corpus.

## 12. Method and graph counts

- Method decision fields: **33 source-checked, 175 pending** across 16 modules (13 axes).
- Graph: **159 nodes, 192 edges**. Review state: recorded-unverified 69, archive-derived 77,
  source-checked 46, independently-rechecked 0. Provenance: paper-backed 96, attribution 15,
  bibliographic 7, curated-method-module 74. (Identical to round 5 — the change is provenance
  structure, not corpus size.)

## 13. Link health

54 resolved, 5 reachable-but-refusing-automated-clients (reported separately, not counted
healthy), 0 failed. 37 laboratory sites, 12 external resources, **10 declared method sources now
resolved from the registry** (round 5 read them from embedded route URLs). Resolving is not
reading. Report: `docs/link-health.json`.

## 14. Browser / accessibility QA

**Pending — no authorized HTTPS preview exists.** The DOM harness tests in §11 exercise the real
`app.js` render path and are explicitly *not* browser QA; MIME/DOM checks are not a substitute
for an authorized browser and accessibility pass. Not deployed.

## 15. Unresolved issues and explicit boundaries

1. **Legacy `verificationDepth` retained as a derived annotation.** The surface-vs-order fix is
   complete at the presentation and selection layers (edges and UI use `surfaceType`/
   `accessExtent`; promotion selection ranks by review state then date, with no surface-depth
   tiebreaker). The internal `checkReviewRecord`/`checkEdgeContract` still carry a derived
   depth-rank ceiling as a consistency guard. This is a deliberate scope boundary to keep the
   ~40 graph/paper contract tests green; it is not user-facing. A future round could remove the
   derived depth entirely.
2. **Paper verification sources are denormalised-but-verified, not stripped.** Method routes were
   fully stripped to references; paper sources keep a URL/version cache that the validator
   cross-checks against the registry byte-for-byte (forgery is caught, registry is authority).
   Fully stripping the paper layer was out of scope this round and is a candidate for the next.
3. **No independent review event exists** (0), by instruction. Codex should add the first for the
   Kagan/Zou scopes it re-read and byte-pinned; the mutation matrix and graph propagation are in
   place to receive it.
4. **Nothing sealed** (0). Claude Code is the implementer and may not sign its own second reading.
5. **One-shot migration scripts committed.** `scripts/migrate-round6.mjs` /
   `round6-corrections.mjs` are non-idempotent (guarded) provenance of the transform, not part of
   `npm run check`.

Requesting independent Codex review.
