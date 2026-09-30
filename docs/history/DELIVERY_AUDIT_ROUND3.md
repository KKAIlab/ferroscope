# FerroScope Round-3 Delivery Audit

Date: 2026-07-24
Implementer: Claude Code
Repository: `/Users/chenjingquan/Projects/ferroscope`
Specification executed: [`HANDOFF_ROUND3.md`](HANDOFF_ROUND3.md), against the independent review in [`CODEX_REVIEW_ROUND2.md`](CODEX_REVIEW_ROUND2.md)
Baseline: `f307ea6` plus the uncommitted round-2 change set
Release state: **not pushed, not deployed.** The release gate is unchanged.

---

## 0. What is different about this report

Round 2 could not execute anything: every `node`, `npm`, `curl` and `git` write was refused, so [`DELIVERY_AUDIT_ROUND2.md`](DELIVERY_AUDIT_ROUND2.md) described unrun code and an uncommittable tree. **That report is preserved unedited.** It was true when it was written and it is the implementer's contemporaneous record; this file is a separate report, not a revision of it.

This round the environment allowed execution. Every number below was produced by running the command quoted next to it. Where something was not run, it says so in the same sentence.

One thing was verified that a passing suite does not prove on its own: **the new fixtures were mutation-tested.** For each of the two P0 fixes the defect was deliberately reintroduced and the suite was confirmed to fail with a specific message, then the fix was restored. A test that cannot fail is not evidence, and section 3 records what each one did when the bug came back.

---

## 1. Commits created

Six commits on `main`, on top of `f307ea6`. Nothing was pushed.

| Commit | Subject | Files |
|---|---|---|
| `a71524c` | Make record semantics and freshness route-specific | `lib/records.mjs`, `scripts/update-data.mjs`, `scripts/validate-data.mjs`, `scripts/test-ingestion.mjs`, `data/live.json`, `data/meta.json`, `data/record-overlays.json` |
| `564b011` | Publish the paper layer with structured, bounded provenance | `data/papers-en.json`, `data/paper-claims.json`, `scripts/validate-papers.mjs` |
| `28fd896` | State monitoring coverage and check every declared link | `data/monitoring-coverage.json`, `data/watch-queries.json`, `data/labs.json`, `docs/link-health.json`, `scripts/check-links.mjs`, `.github/workflows/check-lab-links.yml`, removal of `scripts/check-lab-links.mjs` |
| `534a900` | Pin datasets to an accountable owner and a reviewed-bytes fingerprint | `data/schema-versions.json`, `scripts/seal-manifest.mjs`, `scripts/test-manifest.mjs` |
| `4a1c468` | Separate curated method modules from paper-backed claims | `lib/graph.mjs`, `data/methods.json`, `data/evidence-bundles.json`, `scripts/validate-graph.mjs`, `scripts/test-graph-contract.mjs`, `scripts/validate-v09.mjs` |
| `e479f0d` | Render one calendar date the same way to every reader | `app.js`, `index.html`, `v09.css`, `package.json`, `scripts/test-display-dates.mjs`, `scripts/test-public-surface.mjs`, `scripts/lib/dom-harness.mjs`, `scripts/serve.mjs`, `scripts/test-research-method.mjs`, `.github/workflows/deploy-pages.yml` |
| *(this file)* | Record the round-2 review, the round-3 handoff and this audit | `CODEX_REVIEW_ROUND2.md`, `DELIVERY_AUDIT_ROUND2.md`, `HANDOFF.md`, `HANDOFF_ROUND3.md`, `DELIVERY_AUDIT_ROUND3.md`, `README.md`, `CLAUDE_CODE_HANDOFF.md` |

**Stated plainly: these are review groupings, not independently green build states.** Round 2 was never committed, so this tree is one interdependent round-2-plus-round-3 change set. `scripts/validate-v09.mjs`, for example, cannot pass before `data/methods.json` carries the decision schema, and both live in the same commit for that reason — but the paper-layer commit sits between the ingestion commit and the manifest commit purely for reviewability. **The suite is verified at `HEAD` with a clean worktree, not at each intermediate commit.** If you want a bisectable history, squash.

`git diff --check` passes. `git status --short` is empty after the final commit.

---

## 2. Tests actually run

Every line below is the command's real output, in this environment, on this tree.

| Command | Result |
|---|---|
| `npm run check` | **exit 0** — the eight sub-checks below, in order |
| `npm run check:data` | 37 laboratories, 11 country/region labels, 23 curated signals, 56 automated records with no self-assigned grade; 15 running author watches, 8 pending first run, 14 manual-only, 0 site monitors. Plus, new this round: **57 discovery routes across 56 records (1 multi-route), 56 current, 0 partially stale, 0 wholly retained** |
| `npm run check:v09` | 37 English lab profiles, 16 methods, 25 trilingual terms, 10 mechanism nodes, 12 external resources, 23 English briefs, **0 sealed review fingerprints**; 18 datasets listed as owned but awaiting independent review |
| `npm run check:papers` | 11 English paper records, 11 readable at all three scales, **0 verified against the full text**, 11 archive-derived, 3 carrying a post-publication notice, 1 formally contested, 7 classified version events, zero unread notices; 15 attribution records across 12 laboratories |
| `npm run check:graph` | 159 nodes, 192 edges, all relations printed including `CONTRADICTS 0`; generator `lib/graph.mjs` verified on disk |
| `npm run check:graph-contract` | **16 cases passed** (new this round) |
| `npm run test:research` | 37 team question profiles; 74 team–paper records over 69 unique papers, 25 with a figure chain |
| `npm run check:surface` | **102 rendered fragments, 71 assertions, 4 full renders**; CJK confined to the terminology corpus, hostile metadata neutralised |
| `npm run check:dates` | **passed in 3 timezones** (new this round) |
| `npm run check:ingestion` | **36 cases** under each of `TZ=UTC`, `TZ=Asia/Tokyo`, `TZ=America/Los_Angeles` (30 before this round) |
| `npm run check:manifest` | 16 mutation cases |
| `npm run check:links` | **exit 0 — 52 resolved, 5 restricted, 0 broken** |
| Local module/MIME smoke test | passed on `PORT=4180`; detail in section 7 |
| `git diff --check` | passed |

Round 2 added 30 ingestion fixtures and 16 manifest cases. This round adds **6 freshness fixtures, 16 graph-contract cases, a 3-timezone display-date fixture and 22 new public-surface assertions.**

---

## 3. The two P0 fixes, before and after

### P0-A — the display layer reintroduced the calendar-date bug

**Before.** `app.js` formatted a date-only value through a local instant:

```js
const value = new Date(date);
return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit" }).format(value);
```

`new Date("2025-12-04")` is UTC midnight, so any negative UTC offset renders the previous day. Measured, not inferred:

| Timezone | What the old formatter rendered for `2025-12-04` |
|---|---|
| UTC | 04 Dec 2025 |
| Asia/Tokyo | 04 Dec 2025 |
| **America/Los_Angeles** | **03 Dec 2025** |

The record affected is `pubmed-41349546`, the GPX4 fin-loop paper whose date round 2 had just corrected from 2025-12-03 to 2025-12-04 at ingestion. A Californian reader saw 03 Dec anyway.

**After.** `formatCalendarDate()` in `lib/records.mjs` matches the components out of the string and never constructs a `Date`. A full ISO timestamp is accepted and rendered as its UTC calendar day, which is the frame `generatedAt` is written in. Anything else returns `null` and the caller escapes the raw text rather than being shown a guess.

`npm run check:dates` drives the **real interface** — `app.js` through the DOM harness, not a copy of its formatter — once per timezone, pulls the visible text out of the rendered `<time datetime="2025-12-04">` element, and asserts all three are `04 Dec 2025`. It additionally asserts that the *old* path would have differed in at least one zone, so it cannot pass vacuously.

**Mutation test.** Restoring the old two lines in `app.js`:

```
Under TZ=America/Los_Angeles the interface rendered 2025-12-04 as "03 Dec 2025" instead of "04 Dec 2025".
The same calendar date rendered differently across timezones: UTC=04 Dec 2025, Asia/Tokyo=04 Dec 2025, America/Los_Angeles=03 Dec 2025.
exit=1
```

The fix was then restored and the suite reconfirmed green.

### P0-B — retained freshness was not source-specific after canonical merging

**Before.** `retainOnFailure()` selected `previousItems.filter((item) => item.sourceName === sourceName)`. A canonical record discovered through both a laboratory watch and generic PubMed keeps every route in `sources[]` but has exactly one top-level `sourceName`. When the *secondary* route failed, that filter matched nothing and the retained copy was simply lost. Separately, `mergeCanonicalRecords()` never derived `stale`, `lastSuccessAt` or `lastAttemptAt` at all — whichever record happened to become primary decided the freshness of the whole card.

**After.**

- Every entry in `sources[]` carries `kind`, `stale`, `lastSuccessAt` and `lastAttemptAt`. A record written before routes carried freshness falls back to the record-level flags, so an older `live.json` reads with the same semantics instead of silently becoming fresh.
- `retainOnFailure()` searches the routes, retains **only the failed route**, and restores that route's own record id. The other routes are republished by their own sources in the same run; copying them would resurrect a stale duplicate of a record that is current.
- `freshnessOf()` derives the card state from all routes. A card is `stale` **only** when every automated route is stale *and* no curated layer supplies it. Everything in between is `partially-stale`, with `staleSourceNames` and `freshSourceNames` preserved.
- `mergeSourceRoutes()` lets a fresh copy of a route beat a retained stale copy of the same route.

The four fixtures `CODEX_REVIEW_ROUND2.md` asked for, all in `scripts/test-ingestion.mjs` and all run under three timezones:

| Fixture | Asserts |
|---|---|
| 1 — a secondary discovery route fails | the merged record still retains **1** copy, carrying only the `PubMed` route, marked stale, under the failed route's own record id |
| 2 — one fresh and one stale route merge | `freshnessState: "partially-stale"`, `stale: false`, `staleSourceNames: ["PubMed"]`, `freshSourceNames: ["Tracked labs / PubMed"]`, both routes visible, latest success reported |
| 3 — every route stale | `freshnessState: "stale"`, `stale: true`, both route names in `staleSourceNames`, `freshSourceNames: []` |
| 4 — a curated card plus a stale automated route | `stale: false` — the curated layer supplies the card, so it is not published from retained bytes — with `freshnessState: "partially-stale"` and the automated route named |

Two further fixtures cover a curated-only card and a stale copy failing to overwrite a fresh one.

**Mutation test.** Restoring the old single-name selector:

```
FAIL fixture 1: a failing secondary route still retains its own copy of a merged record
      matching only the top-level sourceName loses the secondary route
      0 !== 1
FAIL fixture 2: one fresh and one stale route merge into a partially stale card
```

**Rendering.** Nothing in the shipped dataset is stale, so partial degradation would never reach the page from live data. `scripts/test-public-surface.mjs` therefore renders a fixture through the real interface and asserts the two states use **different** badges: `one route retained · PubMed last failed` against `retained · every source route last failed`. Reverting `freshnessBadge()` to emit one badge for both fails three assertions.

**Public copy.** The freshness dialog in `index.html` now states the implemented semantics: freshness belongs to the route, a failed route retains only its own copy, and a card is called retained only when every automated route has failed and no curated record supplies it.

**Data migration.** `data/live.json` was migrated to carry route-level freshness — 57 routes across 56 records, 1 multi-route. Every value restates what `meta.json` already asserts per source; no new claim was introduced. `scripts/validate-data.mjs` now re-derives `freshnessState`, `stale`, `staleSourceNames` and `freshSourceNames` from the routes and fails on any disagreement, so the stored summary cannot drift from the routes it summarises.

---

## 4. Method decision schema — completeness counts

All 16 modules carry the thirteen decision axes: specimen, question, perturbation, readout, quantification unit, instrument, essential positive / negative / process controls, orthogonal confirmation, timing, compartment resolution, confounders.

| | Count |
|---|---|
| Modules | 16 |
| Decision fields required (13 axes × 16) | **208** |
| **Source-checked** | **0** |
| **Pending source review** | **208** |
| Modules declaring themselves provisional | 16 of 16 |

**Zero is the honest number, and it is the point.** `CODEX_REVIEW_ROUND2.md` §3 P1-A says not to fill these fields from general knowledge and call them source-checked. No declared method source was opened and read in this round, so nothing was promoted. Every pending field carries an `unresolved` sentence naming the axis and the document that would resolve it, and the validator rejects a field that carries a value while declaring itself unverified — the schema cannot be quietly half-filled later.

One exception, labelled as such: the `readout` axis carries a `curatedStatement` quoting the module's own existing `measures` sentence, rendered with the words *"This has not been checked against a source."* Information is shown, not claimed.

### Source routes

The four kinds the handoff asked to be distinguished, plus an explicit fifth for a route whose kind is not established:

| Kind | Modules | Basis |
|---|---|---|
| `field-recommendation` | 9 | `10.1038/s41580-025-00843-2`, which this repository already publishes as the 2025 reproducibility recommendation in `index.html` |
| `unclassified-source` | 4 | two PubMed records and two DOIs that were not opened, so whether they are protocols, recommendations or research demonstrations is not established |
| `original-research-demonstration` | 2 | the DOI resolves to a record in the paper layer (`nchembio.2238`, `s41467-025-58175-w`), whose own reading record is archive-derived |
| `vendor-protocol` | 1 | the Thermo Fisher catalogue page for BODIPY 581/591 C11 |

All 16 routes are `status: "not-checked"`, `checkedAt: null`, `verificationDepth: "not-read"`, `scope: []`. The validator forbids an unchecked route from claiming a scope, so "not read" cannot be dressed as partial coverage.

### Laboratory capability

`distinctiveLabs` alone is not evidence, so it is no longer treated as any. A capability claim counts here only where a **source-checked `USES_METHOD` claim** links a paper to the module **and** the attribution layer independently places the laboratory on that paper.

| | Count |
|---|---|
| Capability rows demonstrated by evidence | **13** |
| …of which the curated shortlist does not list the laboratory | **5** |
| `distinctiveLabs` entries published as claims with no evidence | **48** of 56 |
| Modules with at least one demonstrated capability | 9 of 16 |
| Modules with none | 7 — `death-kinetics`, `orthogonal-rescue`, `bodipy-c11-assay`, `lipid-hydroperoxide-probes`, `mda-4hne`, `redox-metabolites`, `electron-microscopy` |

Each demonstrated row cites the paper, the figure, the role, the role's basis, the claim id and the attribution check date, and carries a boundary sentence saying what it does **not** prove — participation in a study that used the method is not proof that the laboratory owns or operates it. A `pre-independence` role gets a stronger boundary, because the attribution layer records that the work predates that laboratory's independence.

`scripts/validate-v09.mjs` **re-derives all 13 rows** from `paper-claims.json` and `lab-paper-links.json` and fails on any addition or omission, so a hand-written capability claim cannot survive a validation run.

The 5 evidence-backed rows that the curated shortlist omits are reported rather than silently added to it. The shortlist is an editorial judgement about distinctive capability; the evidence is a different claim. Forcing them to agree would have destroyed information in one direction or the other.

BODIPY 581/591 C11 remains prohibited as a standalone diagnosis: it stays in `neverStandalone` alongside MDA/4-HNE, hydroperoxide probes and electron microscopy, the validator still requires it to be reachable only inside a larger bundle, and the surface test asserts the prohibition renders.

---

## 5. Graph edge counts by provenance and review state

192 edges, 159 nodes. Every edge now declares both a provenance class and a review state.

| Provenance class | Edges |
|---|---|
| `paper-backed-experimental` | 96 |
| `curated-method-module` | 74 |
| `attribution-record` | 15 |
| `bibliographic-event` | 7 |

| Review state | Edges |
|---|---|
| `source-checked` | 118 |
| `pending-source-review` | 74 |

The 74 pending edges are exactly the method-module edges: 37 `MEASURES` and 37 `CANNOT_DISTINGUISH`, all `paperId: null`, all `checkedAt: null`, each carrying a `reviewPendingReason` naming the module and the source that has not been read. They render as `curated method module · awaiting source review`, under a note stating how many of the boundaries shown are provisional — not with the confidence of a claim read out of an audited figure.

Relation counts are unchanged from round 2, and `CONTRADICTS 0` is still printed rather than hidden.

**The validator rejects an unchecked edge that lacks a provisional review state** — required verification 6. The rule lives in `checkEdgeContract()` in `lib/graph.mjs`, so the builder, the validator and the tests all read the same contract, and the builder throws rather than emitting a violating edge. `scripts/test-graph-contract.mjs` covers 16 cases, including: an unchecked edge with `reviewState` missing, set to `source-checked`, or set to a value outside the vocabulary; a provisional edge that does not say what is unread; a curated method-module edge that borrows a paper; a paper-backed edge with no paper; a malformed check date, which is a build failure rather than a silent demotion; and the promotion path, where recording an ISO date on a method link moves its edges to `source-checked`.

**P1-C.** The graph reported `generator: "scripts/build-graph.mjs"`, a file that does not exist. It now reports `lib/graph.mjs`, and `scripts/validate-graph.mjs` stats the declared generator and fails if it is not a real file.

---

## 6. Link health

`npm run check:links --strict`, run in this session over the network:

| | Count |
|---|---|
| Targets | **57** |
| Resolved | **52** |
| Restricted (automation refused, not broken) | **5** |
| **Broken** | **0** |

Targets by kind: 37 laboratory sites, 12 external resources, and — new this round — **8 distinct declared method sources**. The nine modules that share the reproducibility-recommendation DOI are checked once, with the target recording every module that declares it.

The five restricted targets are unchanged from the independent review: `stockwell-columbia`, `gao-hit` and `bush-florey` (403), and the `biorxiv-ferroptosis` and `lipidmaps` resources (403). They are reported separately and are not counted as healthy.

**Nankai.** `chen-nankai.website` is `https://sklmcb-en.nankai.edu.cn/About/Administration.htm`, which resolved 200 in this run. Two stale descriptions were corrected:

- `data/schema-versions.json` said the link "has not been re-reviewed"; it now records that the official institutional page names Quan Chen as director and resolved 200 under the strict monitor, while stating that reachability is not a content review and that the dataset bytes still have no independent reviewer.
- `data/monitoring-coverage.json` dated the check `2026-07-24`, which was the local-timezone rendering of a `2026-07-23T16:15Z` run — the same ambiguity class this round exists to remove. It now names the UTC date and states that the target is an administration page, not a laboratory news feed.

Every result still carries the `proves` field, extended for method sources: resolving one is not reading it.

---

## 7. Local module and MIME smoke test

Round 2 flagged the `lib/` runtime dependency as its highest-severity unverified change, because its failure mode is a blank page. Served on `PORT=4180` (4173 is held by an unrelated process on this machine):

| Path | Status | Content-Type |
|---|---|---|
| `/` | 200 | `text/html; charset=utf-8` |
| `/app.js` | 200 | `text/javascript; charset=utf-8` |
| `/lib/records.mjs` | 200 | `text/javascript; charset=utf-8` |
| `/lib/graph.mjs` | 200 | `text/javascript; charset=utf-8` |
| `/data/papers-en.json`, `/data/methods.json`, `/data/live.json`, `/data/schema-versions.json` | 200 | `application/json; charset=utf-8` |
| `/v09.css` | 200 | `text/css; charset=utf-8` |

Beyond status and MIME, the **bytes the server actually returned** were evaluated as ES modules: `records.mjs` parses and exports 23 names including `formatCalendarDate`, `freshnessOf` and `sourceRoutesOf`, and `formatCalendarDate("2025-12-04")` returns `04 Dec 2025` from the served copy; `graph.mjs` parses and exports 6 names including `checkEdgeContract`. Both specifiers `app.js` imports (`./lib/records.mjs`, `./lib/graph.mjs`) resolve over HTTP with a JavaScript MIME type, and `index.html` still loads `app.js` as a module.

This proves the page can load its modules. **It is not browser QA** — see section 8.

---

## 8. Browser QA — explicitly pending

**No browser QA was performed, and none is claimed.** No authorized HTTPS preview exists, and the round-3 handoff forbids bypassing the browser policy and forbids deploying merely to satisfy this check. The following remain unverified:

| Check | Status |
|---|---|
| Authorized HTTPS preview URL | **Not created** — no deployment authority |
| Desktop viewport | **Not tested** |
| 390 px viewport, no horizontal overflow | **Not tested** |
| Keyboard-only operation | **Not tested** |
| Dialog transition and focus restoration | **Not tested**, and focus restoration is still not implemented |
| Escape and close-button behaviour | **Not tested** |
| Console errors in a real browser | **Not tested** |

The round-3 interface changes that most need a real viewport are the new decision-field grid, the source-route cards and the capability rows in the method dialog, which is now substantially longer than it was. Responsive rules were added at the existing 760 px breakpoint for the new components. They are unverified.

---

## 9. Unresolved, in plain terms

1. **All 208 method decision fields are unverified.** No declared method source was read. The schema, the gaps and the reads that would close them are recorded; the values are not.
2. **All 11 papers remain `archive-derived`; 0 are full-text-rechecked.** The second oestradiol correction changes sample-size labels in Fig. 2o–q, and that record is still the first that should be promoted.
3. **No dataset is sealed.** `0 sealed review fingerprints`; 18 datasets are owned but `reviewPending`. Nothing was sealed because no independent reviewer has read any dataset's bytes — the handoff forbids sealing on any weaker basis. The gate works and currently protects no content, which the manifest states.
4. **48 of 56 `distinctiveLabs` entries have no evidence in this repository**, and 5 laboratories the evidence supports are missing from the curated shortlist. Both are published; neither is resolved.
5. **`data/live.json` is still a hand-migrated dataset.** `npm run update` was not run: it would replace the corpus with fresh PubMed content that no one has reviewed and would invalidate fixtures pinned to specific records, such as the two commentary PMIDs. The first refresh will rewrite the file, and the route-level freshness fields are written natively by `automatedRecord()` when it does.
6. **The eight author watches added in round 2 have still never run.** They remain `pending-first-run` and excluded from the running-coverage count.
7. **No ORCID is proven,** so 14 laboratories stay manual-only and all 23 author watches remain affiliation-qualified guesses about identity.
8. **Found, not fixed:** the legacy archive (`data/lab-research.json`, `data/lab-research-audits.json`) still records `https://sky.nankai.edu.cn/cq1/list.htm` for `chen-nankai` with `"verified": true`. That URL is the one that timed out. The archive is historical provenance and rewriting it would falsify what was believed when it was written, and the renderer does not surface `officialSource`, so no reader is given the dead link — but a `verified: true` flag on a dead URL sits in the data with no correction mechanism attached. The archive has no overlay layer; the automated layer has one. That is the gap.
9. **`data/intelligence-curated.json` carries a Nankai URL that no monitor checks.** `check:links` covers laboratory sites, resources and method sources, not curated-signal URLs.
10. **The four correction notices were still not opened by me.** They remain classified from the independent reviewer's readings, attributed as such in the data.
11. **Intermediate commits are not individually green.** See section 1.

---

## 10. What the next reviewer should do first

1. `npm run check` and `npm run check:links` — both pass here; confirm independently.
2. Re-run the two mutation tests in section 3. If reintroducing either P0 defect does **not** fail the suite, the fixtures are worthless and everything above is unsupported.
3. Read the bytes of the datasets you are willing to stand behind and seal them: `npm run seal -- --reviewer=independent-review-codex <files>`. Until then nothing in this repository is pinned to reviewed bytes.
4. Decide whether the 5 evidence-backed laboratories missing from `distinctiveLabs` should be added to the shortlist, or whether the shortlist is deliberately narrower. That is an editorial judgement and was deliberately not made here.
5. If an authorized HTTPS preview can be created, run the section 8 matrix against the method dialog first — it grew the most this round.

Nothing has been pushed. `origin/main` is still at `eaae307`; local `main` is **eleven commits ahead of it**, four of which predate this round. The release gate is unchanged: **no push and no deployment until an independent review says release-ready.**
