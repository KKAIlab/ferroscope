# FerroScope Round-4 Delivery Audit

Date: 2026-07-24
Implementer: Claude Code (this is an implementer's report, not an independent review)
Repository: `/Users/chenjingquan/Projects/ferroscope`
Specification executed: [`HANDOFF.md`](HANDOFF.md), against [`CODEX_REVIEW_ROUND3.md`](CODEX_REVIEW_ROUND3.md)
Baseline: `bd38bcd` (round-3 review commit)
Release state: **not pushed, not deployed, no PR.** The release gate is unchanged.

---

## 0. Execution environment

`node --version` 24.5.0, `npm` 11.7.0, `git` 2.50.1. Unlike round 2, this session
allowed `node`, `npm`, `git` writes and outbound HTTPS. Every number below was produced by
running the quoted command on this tree; where something was not done, it says so.

Two process facts recorded for the reviewer, without euphemism:

1. **Sealing gate demonstrated, not exercised for real.** Nothing was sealed (§9). The
   fingerprint gate was proven on real bytes with a transient demo reviewer that was fully
   reverted; the manifest still carries `0 sealed review fingerprints`.
2. **`lib/graph.mjs` was reconstructed once mid-session.** A mutation test used
   `git checkout lib/graph.mjs` to restore the file, which reverted it to the round-3
   baseline because the round-4 work was not yet committed. The file was rewritten from the
   in-context edits and verified byte-equivalent: the full suite passes and the graph counts
   are identical to the pre-incident run (`source-checked 46`, `recorded-unverified 69`,
   `archive-derived 77`). All later mutation tests restore from a `/tmp` backup, not git.

---

## 1. Commits created

Four round-4 commits on `main`, on top of `bd38bcd`, plus this audit. Nothing pushed;
`origin/main` is still at `eaae307`.

| Commit | Subject |
|---|---|
| `91fc2a8` | Separate review state and verification depth from any date (P0-A, P0-B) |
| `0b60260` | Read Packages A–D from primary sources and record exact access depth |
| `7adb93e` | Fix route fallback age, real-calendar validation and add link overlay (P1-B/C/D) |
| `1e2631d` | Populate three method modules from read sources and add the assay comparison |
| *(this file)* | Round-4 delivery audit and refreshed link-health record |

These are review groupings. The suite is verified at `HEAD` with a clean worktree, not at
each intermediate commit; `app.js` and `data/schema-versions.json` legitimately span two
themes (the render vocabulary follows the contract in `91fc2a8`, the comparison box lands in
`1e2631d`). Squash if you want a bisectable history.

---

## 2. Tests actually run

| Command | Result |
|---|---|
| `npm run check` | **exit 0** — all sub-checks below |
| `npm run check:data` | 37 labs, 11 region labels, 23 curated signals, 56 automated records; 57 routes across 56 records; **1 historical-link overlay** bound to an unchanged archive assertion |
| `npm run check:v09` | 37 lab profiles, 16 methods; **35 source-checked and 173 pending method decision fields**; capability 13 demonstrated; 0 sealed fingerprints |
| `npm run check:papers` | 11 paper records; reading depth **9 archive-derived, 2 methods-checked**; 7 version events, **4 with the notice text opened and read** |
| `npm run check:graph` | 159 nodes, 192 edges; review state and verification depth counted separately |
| `npm run check:graph-contract` | **29 cases** (was 16) |
| `npm run test:research` | 37 team profiles; 74 team–paper records over 69 papers |
| `npm run check:surface` | 102 rendered fragments; comparison box asserted; CJK confined to terminology |
| `npm run check:dates` | passed in 3 timezones |
| `npm run check:ingestion` | **42 cases** (was 36) under `TZ=UTC`, `Asia/Tokyo`, `America/Los_Angeles` |
| `npm run check:manifest` | 16 mutation cases |
| `npm run check:links` | **53 resolved, 5 restricted, 0 broken** across 58 targets |
| `git diff --check` | clean |

---

## 3. P0 correction: review state is no longer a date (commit `91fc2a8`)

**Before.** `lib/graph.mjs` promoted any record with an ISO `checkedAt` to
`reviewState: "source-checked"`. Result: 118 of 192 edges labelled source-checked, including
all 11 archive-derived papers and all 37 curated method boundaries.

**After.** Two independent, explicit axes, never derived from a date:

- `reviewState` ∈ `recorded-unverified | archive-derived | source-checked | independently-rechecked`
- `verificationDepth` ∈ an 11-rung ladder from `not-read` to `raw-data-rechecked`

`checkReviewRecord()` requires, together, an ISO date **and** a reviewer **and** an HTTPS
source **and** a pinned `sourceVersion` **and** a non-empty `scope[]` **and** a `boundary`
before any record may call itself source-checked, and forbids that state at any depth where
nothing was opened. An edge inherits state and depth from the source record whose recorded
scope covers its own assertion, and `checkEdgeContract()` rejects an edge that claims a
deeper state or depth than that record.

**P0-B.** A bare `checkedAt` on a `methodLinks[]` entry is now a build failure. Promotion
requires a `sourceRoutes` entry with `status: "source-checked"`, a reader, an ISO date, a
`sourceVersion`, and a `scope` that covers the assertion (`MEASURES` or `CANNOT_DISTINGUISH`
resolve independently).

**Mutation tests** (defect reintroduced, suite confirmed to fail, restored from `/tmp`):

| Reintroduced defect | Result |
|---|---|
| P0-A: promote any record carrying an ISO date | `check:graph-contract` — 2 scope-containment cases fail (`Missing expected exception`) |
| P0-B: honour a bare `checkedAt` on a method link | `check:graph-contract` — `a bare check date on a method link is refused` fails |
| P1-B: age from the bare `lastSuccessAt` argument | `check:ingestion` — 4 retention fixtures fail |
| P1-C: make `isRealCalendarDate` always true | `check:ingestion` — impossible-date and leap-year fixtures fail |

The 29 graph-contract cases include the required negatives: date-only, URL-only,
scope-mismatch, restamped verification block, depth/state over-run, archive-derived
rendering, and figure-scoped selective promotion.

### Before / after edge review state

| | Round 3 | Round 4 |
|---|---|---|
| `source-checked` | 118 | **46** |
| `archive-derived` | — (not a state) | **77** |
| `recorded-unverified` / `pending` | 74 | **69** |
| `independently-rechecked` | — | 0 |

The 46 source-checked edges: 19 paper-backed (claims and figure boundaries a read figure or
methods scope covers), 15 attribution (author lists settled by the Crossref `authors`
scope), 8 curated-method-module (the three modules read this round), 4 bibliographic (the
four correction notices read in full). The 77 archive-derived edges are all paper-backed
claims whose figures were not opened.

### Edge verification depth

`curated-unverified 66 · archive-derived 77 · metadata-checked 22 · methods-checked 25 · full-text-rechecked 2` (all other rungs zero, reported as zero).

---

## 4. Source-access table

Every source read directly this round, with the deepest access actually achieved. No user
summary, legacy archive, search snippet or abstract was treated as full-text verification.

| Package | DOI / URL | How reached | Depth achieved | Boundary |
|---|---|---|---|---|
| B | `10.1038/nchembio.2238` (Kagan 2017) | NCBI E-utilities efetch → `PMC5506843` author manuscript XML (140 KB) | **methods-checked** — abstract, all Results, Discussion, 6 figure legends, full Online Methods | Author manuscript, not version of record; figure images and supplements not opened; internal-standard compound not named in the text |
| C | `10.1038/s41589-020-0472-6` (Zou 2020) | efetch → `PMC7353921` author manuscript XML (117 KB) | **methods-checked** — abstract, all Results, Discussion, 5 figure legends, full Online Methods | Author manuscript still carries the **pre-correction** POR antibody (ab133303 / UOTR1B493); figure images and supplements not opened |
| C | `10.1038/s41589-021-00767-w` (POR Author Correction) | nature.com HTML, read in full | **full-text-rechecked** | Short notice read end to end; names the Methods section but no figure |
| A | `10.1016/j.cell.2025.11.014` (GPX4 fin-loop) | PubMed efetch, `41349546` | **abstract-checked** | Not in PMC, not open access. Abstract does **not** mention I129S/L130S, name liproxstatin-1, name the membrane systems, or say which of death/biomarker/structure/behaviour/survival was rescued — all four figure-level questions in the handoff are unanswerable from it |
| D | `10.1038/s41580-025-00843-2` (2025 recommendation) | nature.com redirects to an IdP auth endpoint; **not bypassed** | **abstract-checked** (PubMed `40204928`) | Article body paywalled; used only where the abstract supports it |
| D | `thermofisher.com/order/catalog/product/D3861` | Direct HTML fetch, read in full | **full-text-rechecked** (vendor page) | Gives chemistry, spectra, storage, reconstitution; no assay design — no specimen, control, timing or quantification |
| — | `10.1038/s41586-025-09562-2`, `10.1038/s41586-026-10148-9` (oestradiol Publisher Corrections) | nature.com HTML, read in full | **full-text-rechecked** | Second one restates Fig. 2o–q sample sizes n=2/n=5 → n=6/n=5; states no conclusion affected |
| — | `10.1038/s41586-021-03820-9` (DHODH Author Correction) | nature.com HTML, read in full | **full-text-rechecked** | Funding-attribution change only |

**Access not obtained, recorded as pending:** the Cell GPX4 figures/methods/supplement; the
NRMCB 2025 recommendation body; every publisher version-of-record; all supplementary
datasets. Nothing downstream claims these were read.

---

## 5. Corrections found by reading, recorded not silently applied

| Where | Was | Now | Basis |
|---|---|---|---|
| `claim-oxpe-acsl4` | cited Fig. 4 | Fig. 2, rescoped to the ACSL4-dependent esterification numbers | Fig. 4 of Kagan 2017 is a Gpx4-KO cell/kidney figure with no ACSL4 data; the evidence is Fig. 2 |
| Kagan Fig. 3 audit answer | "four classes" of oxidised PE | four species in **one** class | Source: "Only four molecular species of phospholipids in only one class" |
| Kagan Fig. 2 audit intervention | "LPCAT3 inhibition" | Lpcat3 knockdown by Cre-lox shRNA | Methods section "Lpcat3 Knock-down" |
| POR paper antibody | ab133303, clone UOTR1B493 (in PMC copy) | ab180597, clone EPR 14479(B) in the version of record | The 2021 Author Correction; recorded as a boundary on the PMC source so a reader is warned the free copy carries the wrong reagent |

Each correction carries `correctedOn`, `correctedBy` and a `why`, and the original value is
preserved in the record.

---

## 6. Method decision fields (commit `1e2631d`)

Filled only where a source actually read supports the field; every filled field cites its
document and methods-section scope. Values state the demonstrating study's implementation,
with a transfer boundary — no protocol detail was copied across models silently.

| Module | Source-checked | Declared source | Notes |
|---|---|---|---|
| `oxidized-pl-lcms` | **13 / 13** | Kagan 2017 (its own declared source, now read) | Includes the boundary that the LC-MS resolves no compartment — the ER origin came from separate imaging |
| `mda-4hne` | **12 / 13** | 2025 recommendation (paywalled) + Zou 2020 as demonstration | Positive standard left pending; the declared source could not be read |
| `bodipy-c11-assay` | **10 / 13** | D3861 vendor page + Zou 2020 | Quantification unit, positive and RTA-negative controls left pending with the exact section named |

Repository total: **35 of 208 fields source-checked** (up from 0), 173 explicitly pending,
each naming the section that would resolve it. The three priority modules all exceed the
8/13 minimum. 13 other modules remain fully pending and say so.

8 curated-method-module graph edges promoted to source-checked — only the assertions a read
route's scope covers (`oxidized-pl-lcms` MEASURES + CANNOT_DISTINGUISH, `bodipy-c11-assay`
MEASURES, `mda-4hne` MEASURES, each over its two mechanism links). 66 method edges stay
`curated-unverified`.

**BODIPY C11 versus direct oxidised-phospholipid comparison box** added to
`evidence-bundles.json`, rendered on both assay dialogs, six axes, sourced from Kagan 2017,
Zou 2020 and D3861. BODIPY 581/591 C11 remains prohibited as a standalone diagnosis
(`neverStandalone`, still reachable only inside a larger bundle, surface-asserted).

---

## 7. Graph edge counts by provenance, state and depth

192 edges, 159 nodes.

| Provenance class | Edges |
|---|---|
| `paper-backed-experimental` | 96 |
| `curated-method-module` | 74 |
| `attribution-record` | 15 |
| `bibliographic-event` | 7 |

Review state and verification depth as in §3. `CONTRADICTS 0` still printed, not hidden; no
contradiction edge was added to balance the graph.

---

## 8. Link health and monitoring

`npm run check:links --strict` over the network this session:

| | Count |
|---|---|
| Targets | 58 |
| Resolved | 53 |
| Restricted (automation refused, not broken) | 5 |
| Broken | **0** |

Restricted, unchanged and reported separately: `stockwell-columbia`, `gao-hit`,
`bush-florey`, `biorxiv-ferroptosis`, `lipidmaps`. Method sources now checked: 9 distinct.

**Historical-link overlay (P1-D).** `data/historical-link-overlays.json` supersedes the
reachability of the Nankai archive URL `https://sky.nankai.edu.cn/cq1/list.htm`, which timed
out again this session (curl exit 28, HTTP 000, 25 s), and points at the reachable
replacement `https://sklmcb-en.nankai.edu.cn/About/Administration.htm` (HTTP 200, 0.84 s).
The archive's original `verified: true` is left intact; `validate-data.mjs` binds the
overlay to that exact assertion and fails if it drifts (proven: flipping the archive value
makes validation exit 1 with `the overlay has drifted or the archive was rewritten`).

Monitoring unchanged: 15 running author watches, 8 pending a first run, 14 manual-only, 0
automated site monitors, 0 proven ORCIDs. A 200 is reachability, not laboratory activity.

---

## 9. Datasets reviewed and sealed

**0 datasets sealed.** This is deliberate and honest. Sealing asserts that a party *other
than the owner* read the exact bytes; the only declared independent party is
`independent-review-codex`, and I am the round-4 implementer, not Codex. Sealing my own
output under Codex's identity would forge an independent review and is exactly the
"run this to make a red check go green" abuse the mechanism exists to prevent. All 19
datasets remain `reviewPending: true`.

The gate was proven to work on real bytes: a transient `seal-gate-demo` reviewer was added,
`glossary.json` sealed, validation passed, one byte mutated, validation **rejected** it with
`changed since it was reviewed`, then the file and manifest were restored from a `/tmp`
backup. No demo residue remains (`grep seal-gate-demo` → 0; `glossary.json` identical to
HEAD; 0 fingerprints in the manifest).

The changed datasets awaiting an independent byte-level review are: `papers-en.json`,
`paper-claims.json`, `methods.json`, `knowledge-network.json`, `evidence-bundles.json`,
`historical-link-overlays.json`, `schema-versions.json`.

---

## 10. Browser and accessibility QA — explicitly pending

**No browser QA was performed and none is claimed.** No authorized HTTPS preview exists, and
the handoff forbids deploying to create one and forbids claiming QA from MIME tests.

| Check | Status |
|---|---|
| Authorized HTTPS preview URL | Not created |
| Desktop / 390 px / no horizontal overflow | Not tested |
| Keyboard-only navigation, Escape, close, focus restoration | Not tested; focus restoration still not implemented |
| Dialog accessible names, filter pressed state, external-link behaviour | Not tested |
| Zero console errors | Not tested |

The components most needing a real viewport are the new comparison grid (responsive rules
added at the 760 px breakpoint, collapsing to stacked rows) and the longer method dialog.
They are unverified.

---

## 11. Unresolved, in plain language

1. **Package A (Cell GPX4) is abstract-only.** Four figure-level questions in the handoff —
   I129S/L130S, the membrane systems, the neuronal/organoid/mouse support, what
   liproxstatin-1 rescues — cannot be answered from the abstract and are logged as such. The
   paper stays archive-derived for every figure claim.
2. **173 of 208 method fields remain pending.** 13 of 16 modules are untouched this round.
3. **No dataset is sealed.** The gate works and protects nothing yet; independent byte-level
   review is the next reviewer's role, not the implementer's.
4. **The PMC author manuscripts differ from the versions of record.** Page/panel numbering
   may differ, and the Zou 2020 copy carries the superseded POR antibody. Recorded as
   boundaries; not resolved.
5. **The NRMCB 2025 recommendation could not be read** (paywall, auth redirect not
   bypassed). `mda-4hne` is populated from Zou 2020 instead, with that stated.
6. **Attribution is still author-position, not identity.** No ORCID is proven; 14 labs stay
   manual-only; the 8 round-2 author watches have still never run.
7. **`data/live.json` is still hand-migrated.** `npm run update` was not run; it would
   replace the corpus with unreviewed PubMed content and invalidate pinned fixtures.
8. **No browser QA** (§10).
9. **Intermediate commits are not individually green** (§1).
10. **48 of 56 `distinctiveLabs` entries still have no evidence**, and 5 evidence-backed labs
    remain off the curated shortlist — published, unresolved, an editorial call left to the
    reviewer.

---

## 12. Verification checklist (HANDOFF §12)

1. `npm run check` — exit 0. ✓
2. `npm run check:links` — 53 resolved, 5 restricted, 0 broken. ✓
3. Date-only review promotion fails. ✓ (mutation-tested)
4. Archive-derived claims never render as source-checked. ✓ (77 archive-derived edges)
5. Route fallback-age and invalid-calendar fixtures pass. ✓
6. Each promoted method field resolves to a checked source scope. ✓
7. Each promoted graph edge is no deeper than its source record. ✓ (contract-enforced)
8. Three anchor modules pass a source-scope completeness check. ✓ (13/12/10 of 13)
9. Browser QA recorded as pending, no deployment claim. ✓
10. `git diff --check` passes. ✓
11. Worktree clean after commits. ✓ (after this file is committed)
12. No push, deployment or PR. ✓

`origin/main` remains at `eaae307`; local `main` is ahead by the round-2/3/4 commits. The
release gate is unchanged: no push and no deployment until an independent review says
release-ready. Requesting independent Codex review.
