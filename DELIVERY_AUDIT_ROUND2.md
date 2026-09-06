# FerroScope Round-2 Delivery Audit

Date: 2026-07-24
Implementer: Claude Code
Repository: `/Users/chenjingquan/Projects/ferroscope`
Specification executed: [`HANDOFF.md`](HANDOFF.md), the independent Codex review of 2026-07-23
Baseline reviewed HEAD: `f307ea6`

---

## 0. Read this first — two constraints that change how you should read everything below

**No code was executed in this round.** The execution environment blocked every Node, npm, git-write and network command. `node --version` was permitted; `node scripts/validate-data.mjs`, `npm run check`, `npm run check:links`, `curl`, `git add` and `git commit` were all refused, for this session and for delegated subagents alike. Consequently:

- **no test in this repository was run.** Every claim below about behaviour is derived from reading the code, not from observing it. Section 3 lists the tests that exist and must be run; it does not claim they pass.
- **no commit was produced.** `git add` and `git commit` were refused, so the round-2 work is present as uncommitted changes in the working tree. `git status --short` is therefore **not clean**, and cannot be made clean from here. This directly fails requirement 7 of HANDOFF section 6, and it is the first thing the next reviewer should notice.
- **no network verification was possible.** The four correction notices were classified from the readings recorded in HANDOFF section 2, attributed to the independent reviewer in the data itself, not re-opened here.

**Nothing here has been verified by execution. Run the suite before believing any of it.** The intended first command is:

```bash
npm run check && npm run check:links
```

**What is done and what is claimed are different things.** Where a change is implemented but unverified, this document says so in place rather than in a footnote.

---

## 1. Commits produced

**None.** Git write operations were unavailable. The change set exists only as a dirty working tree:

| State | Paths |
|---|---|
| Modified | `app.js`, `index.html`, `package.json`, `README.md`, `v09.css`, `data/labs.json`, `data/live.json`, `data/meta.json`, `data/papers-en.json`, `data/schema-versions.json`, `data/watch-queries.json`, `scripts/update-data.mjs`, `scripts/validate-data.mjs`, `scripts/validate-papers.mjs`, `scripts/validate-v09.mjs`, `scripts/test-public-surface.mjs`, `scripts/serve.mjs`, `scripts/lib/dom-harness.mjs`, `.github/workflows/deploy-pages.yml`, `.github/workflows/check-lab-links.yml` |
| Added | `lib/records.mjs`, `lib/graph.mjs`, `data/record-overlays.json`, `data/monitoring-coverage.json`, `data/paper-claims.json`, `data/evidence-bundles.json`, `scripts/validate-graph.mjs`, `scripts/test-ingestion.mjs`, `scripts/test-manifest.mjs`, `scripts/seal-manifest.mjs`, `scripts/check-links.mjs`, this file |
| Deleted | `scripts/check-lab-links.mjs`, replaced by `scripts/check-links.mjs` |

A suggested commit split, if the next operator wants one rather than a single change:

1. `lib/records.mjs` plus `scripts/update-data.mjs`, `data/live.json`, `data/meta.json` — ingestion truthfulness (P0.1, P0.2, P0.3, P0.8);
2. `data/papers-en.json` plus `scripts/validate-papers.mjs` — provenance and corrections (P0.5, P0.6, P0.7);
3. `data/monitoring-coverage.json`, `data/watch-queries.json`, `data/labs.json` — coverage and the Nankai link (P0.4, P0.10);
4. `data/schema-versions.json`, `scripts/validate-v09.mjs`, `scripts/seal-manifest.mjs`, `scripts/test-manifest.mjs` — ownership and review fingerprints (P0.9);
5. `lib/graph.mjs`, `data/paper-claims.json`, `data/evidence-bundles.json`, `scripts/validate-graph.mjs` — the provenance graph and the methods decision layer (P1.1, P1.2);
6. `app.js`, `index.html`, `v09.css` — the interface changes that make all of the above visible.

---

## 2. Independent review of my own output

Because I could not execute the tests, I ran two independent static reviews of the change set — one tracing every validator assertion against the actual data files, one tracing the runtime JavaScript for undefined references, template-literal breakage and harness gaps. Their findings and what I did about them are in section 9. **A static review is weaker than a test run.** It is what was available.

---

## 3. Tests: what exists, and what was actually run

| Command | Proves | Run in this round? |
|---|---|---|
| `npm run check:data` | no automated record grades itself; canonical identities are unique; monitoring coverage matches the laboratory list | **No — blocked** |
| `npm run check:v09` | foreign keys, manifest ownership, review fingerprints, evidence-bundle integrity | **No — blocked** |
| `npm run check:papers` | paper layer, separated publication axes, classified notices, structured verification | **No — blocked** |
| `npm run check:graph` | every graph edge names a source, a scope, a condition vector or a reason none applies | **No — blocked** |
| `npm run test:research` | pre-existing research-method tests | **No — blocked** |
| `npm run check:surface` | language gate, injection gate, evidence gate, merge gate, verification-depth gate | **No — blocked** |
| `npm run check:ingestion` | ingestion fixtures under `TZ=UTC`, `TZ=Asia/Tokyo` and `TZ=America/Los_Angeles` | **No — blocked** |
| `npm run check:manifest` | manifest mutation tests, including a clean pass after sealing | **No — blocked** |
| `npm run check:links` | laboratory sites and external resources, including the replaced Nankai URL | **No — blocked, and needs network** |

New test files added this round: `scripts/test-ingestion.mjs` (30 cases, 80 assertions, run under three timezones), `scripts/test-manifest.mjs` (16 mutation cases), `scripts/validate-graph.mjs`, plus 30 new assertions inside `scripts/test-public-surface.mjs`, which now carries 49 in total.

`npm run check` now chains: `check:data → check:v09 → check:papers → check:graph → test:research → check:surface → check:ingestion → check:manifest`.

---

## 4. Before and after, one P0 at a time

### P0.1 — Automated records are not evidence grade B by default

**Before.** `scripts/update-data.mjs` wrote `evidence: "B"` on every PubMed item that survived the filter. `app.js` printed `sourceLabels.paper = "Peer reviewed"` for all of them and allowed sorting by evidence level. `data/live.json` carried 36 records at grade B, including two commentary pieces.

**After.** Three properties that were one property are now three:

| Axis | Field | Who may set it |
|---|---|---|
| What kind of document it is | `documentType`, `documentTypeBasis` | ingestion may say `unknown`; only a curated audit may say `original-research` |
| Who looked at it | `reviewStatus` | ingestion sets `automated`; the curated layer sets `curated` |
| How far the result can be reused | `evidenceGrade`, `evidenceGradeBasis` | ingestion may only write `null` / `unassessed` |

`lib/records.mjs` classifies PubMed publication types into `original-research | review | commentary | protocol | correction | preprint | trial-record | unknown`. `Journal Article` is deliberately absent from the mapping, because PubMed applies it to Spotlights and News & Views as well as to primary research; a record carrying only that tag resolves to `unknown` and renders as **“PubMed record”**. A record tagged both `Comment` and `Published Erratum` resolves to the more limiting class. `data/live.json` now carries `"evidenceGrade": null, "evidenceGradeBasis": "unassessed"` on all 56 records and no `evidence` key at all; `scripts/validate-data.mjs` fails the build if one reappears.

**Acceptance fixtures.**

- PMID 42439891 (`doi:10.1083/jcb.202606160`) — classified `commentary`, subtype *Journal of Cell Biology Spotlight*, evidence unassessed, via `data/record-overlays.json`.
- PMID 41813884 (`doi:10.1038/s41556-026-01904-0`) — classified `commentary`, subtype *Nature Cell Biology News & Views style commentary*, evidence unassessed.
- Promotion path — an automated record whose canonical identity matches a published reading record in `data/papers-en.json` is promoted to `original-research` with basis `paper-layer-audit`; `data/record-overlays.json` can promote a record that has no reading record yet.

**Caveat, stated plainly.** The two commentary classifications are recorded as read by the independent reviewer, not by me — `checkDepth: "review-report-only"` and `checkLimit` are stored in the overlay itself. The ingestion classifier's `pubtype` path is exercised by fixtures, not by a live PubMed response, because `data/live.json` was migrated in place rather than regenerated (see section 8, item 2).

### P0.2 — PubMed dates depend on the machine timezone

**Before.** `pubmedDate()` did `new Date(raw)` then `toISOString()`. In `Asia/Tokyo`, `new Date("2025 Dec 4")` is local midnight, which is `2025-12-03T15:00:00Z`; the stored date was `2025-12-03`. `data/live.json` stored the GPX4 fin-loop electronic date as **2025-12-03** where PubMed reports **2025-12-04**.

**After.** `parseCalendarDate()` in `lib/records.mjs` decomposes the string textually and never constructs a `Date` from a date-only value. `pubmedDates()` returns `onlineDate`, `issueDate`, `displayDate` and `datePrecision` separately, so a month-only record is not silently presented as the first of the month with day precision. A publisher date after today is clamped by string comparison rather than by date arithmetic.

`data/live.json` record `pubmed-41349546` is corrected to `"date": "2025-12-04"` with `"onlineDate": "2025-12-04"` and `"datePrecision": "day"`.

`npm run check:ingestion` runs the fixtures under three timezones and prints, for the timezone in use, what a naive local round trip of `"2025 Dec 4"` would have stored — so the regression is visible in the passing output, not only in a failure.

### P0.3 — Deduplicate by canonical source identity, then merge layers

**Before.** `app.js` deduplicated on `id` before `url`. Curated and live records for the same study used different ids, so four studies rendered twice. At ingestion, `new Map(collections.map(i => [i.id, i]))` overwrote rather than merged, so an overlap between the generic PubMed stream and a laboratory watch could discard `trackedLabIds`.

**After.** `canonicalIdentity()` resolves in a fixed order — normalized DOI → PMID → NCT → normalized canonical URL → synthetic id — and derives a DOI from a `nature.com/articles/…`, `biorxiv.org` or `medrxiv.org` URL where the mapping is one to one. A `sciencedirect.com` PII URL, which has no derivable DOI, becomes a URL identity rather than an invented DOI.

`mergeCanonicalRecords()` keeps curated narrative and the curated evidence decision, takes date and status from the automated layer, unions `trackedLabIds`, and preserves every discovery route in a `sources` array. `mergeSignalLayers()` is used by both `app.js` and `scripts/update-data.mjs`, so ingestion and rendering cannot disagree.

**Acceptance fixtures.** The four URLs the review found rendering twice are asserted to render once, to keep the curated card, and to retain both routes, in `scripts/test-public-surface.mjs`:

| Canonical identity | Layers merged |
|---|---|
| `doi:10.1016/j.cell.2025.11.014` | curated card + `pubmed-41349546`; the merged record is asserted to still carry `mishima-tohoku` from the automated match |
| `nct:NCT07433283` | curated + `trial-NCT07433283` |
| `nct:NCT06218524` | curated + `trial-NCT06218524` |
| `nct:NCT06928649` | curated + `trial-NCT06928649` |

A fifth duplicate that the review had not found turned up in my own static self-check: `10.7554/eLife.111544` and `10.7554/eLife.111544.1` are the published version and Reviewed Preprint v1 of one eLife study, and were rendering as two cards. Version suffixes are now normalised away for the two registrant schemes that use them, and the published version leads the merged record so a paper that has appeared is not labelled “Not peer reviewed”. See section 9, item 1.

### P0.4 — Monitoring coverage is overstated

**Before.** 37 laboratory profiles, 15 author watches, and `app.js` printed **“site watch”** on the other 22. No site crawler exists; `data/meta.json` said as much in the same dataset.

**After.** `data/monitoring-coverage.json` publishes, for all 37 laboratories: `authorWatch` (`orcid-exact | author-plus-affiliation | none`), `watchState` (`active | pending-first-run | manual-queue`), `orcid`, `identityProof`, `siteMonitor`, `manualReview`, `lastCheckedAt`, `nextReviewDue` and a note giving the reason. `scripts/validate-data.mjs` requires exactly one row per laboratory, requires `siteMonitor` to be `"none"` for every row because no crawler exists, and requires `watch-queries.json` and the coverage file to agree in both directions.

The badge is now **“author watch”**, **“author watch · first run pending”** or **“manual official link · not yet automated”**. The section heading carries a generated coverage sentence.

Eight new author watches were added at the `author-plus-affiliation` tier, chosen for low surname collision and given affiliation clauses that span a relocation where one has occurred: `garcia-saez-mpi`, `linkermann-mannheim`, `ubellacker-harvard`, `vandenberghe-antwerp`, `bayir-columbia`, `overholtzer-msk`, `vandenabeele-vib`, `toyokuni-nagoya`. **None of these queries has ever been executed**, so all eight are `pending-first-run` and counted separately. Fourteen laboratories stay in the manual queue because a surname-plus-initial query is not safe for them, with the reason recorded per laboratory.

### P0.5 — “Figure-audited” and “source-checked” are overloaded

**Before.** All 11 records displayed `figure-level audit`, while the bottom of each dialog admitted the English text was rewritten from the legacy archive and that the full text and figures were not re-opened.

**After.** Two axes replace `readingLevel`:

- `readingDepth`: `metadata | abstract | figure-chain | longitudinal`;
- `verificationDepth`: `metadata-checked | abstract-cross-checked | archive-derived | full-text-rechecked | raw-data-rechecked`.

All 11 records are `readingDepth: "figure-chain"`, `verificationDepth: "archive-derived"`. Each carries `derivedFrom` with the legacy file, the legacy record id and the commit the rewrite came from (`eaae307`, the commit that last wrote `data/lab-research.json`).

The card and the top of the dialog both render the generated badge **“Archive-derived figure chain · abstract cross-checked · full figures pending”**. `scripts/validate-papers.mjs` refuses `verificationDepth: "full-text-rechecked"` unless a `publisher-full-text` source is recorded as `checked`, and refuses `archive-derived` if one is. `scripts/test-public-surface.mjs` fails if the string `figure-level audit` reappears anywhere on a paper card or in a reading record.

### P0.6 — Replace free-text provenance with structured provenance

**Before.** `verification.metadata`, `verification.claims` and `verification.figureLayer` were prose.

**After.** Each record carries `verification.sources[]`, where every entry has `kind` (`crossref | pubmed | publisher-full-text | correction-notice | preprint-server | trial-registry | raw-data`), `url`, `scope[]`, `status` (`checked | not-checked | unavailable`), `checkedAt`, `checkedBy` and `finding`, plus `verification.derivation` with `type`, `sourceRecord` and `sourceCommit`. A checked source must state a non-empty scope and name who checked it; an unchecked source must carry an empty scope, so “not read” cannot be dressed as partial coverage. The one-line UI summary is generated from that list rather than stored, so it cannot drift from what the record says.

The three prose fields are now **rejected** by the validator, which is why they cannot come back.

### P0.7 — Resolve the four pending correction notices and repair the schema

**Before.** Four events carried `affects: "pending-source-check"`. Article stage and post-publication status were one enum.

**After.** No `pending-source-check` remains anywhere in `data/papers-en.json`. `affects` is rejected by the validator in favour of `affectedDomains[]`, and each event additionally carries `noticeType`, `conclusionImpact`, `sourceUrl` and `checkedAt`. `articleStage` and `postPublicationStatus` are separate fields with separate vocabularies. A publisher notice may only claim an affected domain if that notice also appears as a **checked `correction-notice` source** on the same record — the classification and the reading of the notice are tied together.

The full classification is in section 5.

The transplantation paper (`doi:10.1016/j.cell.2026.04.024`) is now `articleStage: "version-of-record"`, `postPublicationStatus: "none"`, with an explicit `article-stage-reclassification` event recording that the legacy archive read it from an in-press corrected proof and that an Elsevier corrected proof is a production stage, not a published correction. Its `verification.unresolved` states that the legacy archive entry itself has not been rewritten.

### P0.8 — Freshness copy does not match the workflow

**Before.** `index.html` claimed a failed source retains the previous dataset **and reports the failure**. In fact the run rebuilt the collection, wrote it, then `npm run check` failed on `sources[].ok`, the workflow stopped before commit, and the public site kept the old data without ever receiving the failure metadata.

**After.** Every live record stores `sourceName`. On failure, `retainOnFailure()` keeps only that source's prior records, marks them `stale: true`, and preserves `lastSuccessAt` while recording `lastAttemptAt`, `retainedAgeDays` and an error class (`timeout | http-client-error | http-server-error | network-unreachable | malformed-response | unknown-error`). Source status carries a `state` of `ok | degraded | failed | manual`.

`scripts/validate-data.mjs` now permits a `degraded` source and fails only on `failed` — a source with no retained data inside the **14-day** maximum age. So an honest degraded state deploys; a stale-and-pretending state does not.

The dialog copy in `index.html` was rewritten to describe exactly that policy, including the 14-day limit and the fact that sources are reported independently. The interface shows retained-record counts and the time since last success per source.

### P0.9 — The schema manifest claims an owner but stores none

**Before.** The manifest's own note said a dataset could not enter without an owner. No entry had one, and the validator checked only version, shape, maintenance, purpose and date. A curated file could change without `reviewedAt` moving.

**After.** Every entry names an `owner` drawn from a declared `owners` table, generated files included — a script wrote the bytes, but somebody is still accountable for publishing them. Beyond that the design splits on a distinction the original finding implies:

- **awaiting review** — `reviewer: null`, `reviewPending: true`, and `reviewedContentSha256` **must be null**. Recording a digest here would assert that somebody read those exact bytes, which is the false assurance the whole gate exists to prevent.
- **reviewed** — `reviewer` names a declared party other than the owner, and `reviewedContentSha256` is a sha256 of the file. Any later edit fails validation with the recorded and found digests both quoted.
- **generated** — carries `generator` (which must exist on disk) and `generatorVersion` (cross-checked against the value the generator wrote into the file), and is **forbidden** from naming a reviewer, a review date or a fingerprint.

`npm run seal -- --reviewer=<owner-id> [files...]` records a review. It refuses an anonymous seal, refuses a reviewer who is not declared, and refuses to let an owner review their own dataset.

**Every curated and archive dataset currently ships as `reviewPending: true`.** That is the truthful state: the 2026-07-23 Codex review covered behaviour, primary metadata, correction notices and link health, not the bytes of any dataset, and round 2 rewrote much of the content. Nothing in this repository claims a review it has not had.

`scripts/test-manifest.mjs` proves both gates by mutating a throwaway copy: a missing owner, an undeclared owner, a curated file edited after review, a named review with no fingerprint, a missing fingerprint field, a fingerprint on a pending file, a generated file claiming a reviewer, an owner reviewing their own file, a file with neither reviewer nor pending flag, an unregistered data file, a registered file missing from disk, a generator-version mismatch, a generator that does not exist, and an anonymous seal attempt. It also asserts that the repository **as shipped** passes, and that a copy sealed by an independent reviewer passes.

### P0.10 — Repair the Nankai link

**Before.** `data/labs.json` `chen-nankai.website` was `https://sky.nankai.edu.cn/cq1/list.htm`, which timed out.

**After.** `https://sklmcb.nankai.edu.cn/2026/0428/c14029a593896/page.htm`.

`scripts/check-lab-links.mjs` is replaced by `scripts/check-links.mjs`, which checks laboratory sites **and** `data/resources.json`, classifies `401/403/405/406/418/429` as **`restricted`** rather than healthy and reports them separately, records `lastSuccessAt`, response class, final canonical URL, redirect flag and TLS, and writes `docs/link-health.json`, which the scheduled workflow keeps as an artifact. Every result carries a `proves` field stating that a resolving URL is not evidence that the page still describes the intended laboratory.

**The strict link check has not been run.** The environment had no outbound network. The Nankai replacement is therefore an unverified edit made on the reviewer's evidence.

---

## 5. Correction notice classifications

All four previously pending notices are classified. The readings are the independent reviewer's, recorded in HANDOFF section 2 and attributed as such in the data.

| Paper | Notice | Type | `affectedDomains` | `conclusionImpact` | Source URL |
|---|---|---|---|---|---|
| `10.1038/s41589-020-0472-6` (POR) | Author Correction `10.1038/s41589-021-00767-w`, 2021-03-02 | `author-correction` | `methods`, `reagent-identification` | `none-stated` | https://www.nature.com/articles/s41589-021-00767-w |
| `10.1038/s41586-021-03539-7` (DHODH) | Author Correction `10.1038/s41586-021-03820-9`, 2021-08-02 | `author-correction` | `funding`, `acknowledgements` | `none-stated` | https://www.nature.com/articles/s41586-021-03820-9 |
| `10.1038/s41586-025-09389-x` (oestradiol) | Publisher Correction `10.1038/s41586-025-09562-2`, 2025-08-26 | `publisher-correction` | `text`, `discussion` | `none-stated` | https://www.nature.com/articles/s41586-025-09562-2 |
| `10.1038/s41586-025-09389-x` (oestradiol) | Publisher Correction `10.1038/s41586-026-10148-9`, 2026-01-21 | `publisher-correction` | `figures`, `figure-labels`, `cross-references`, `supplement` | `explicitly-none` | https://www.nature.com/articles/s41586-026-10148-9 |

Two further events were already classified and are carried forward with the new schema: the DHODH Matters Arising `10.1038/s41586-023-06269-0` and the authors' Reply `10.1038/s41586-023-06270-7`, both `conclusionImpact: potentially-material`, affecting `conclusions` and `target-attribution`. Neither is presented as settled.

Only the second oestradiol notice states explicitly that conclusions are unaffected; the other three state nothing, and are recorded as `none-stated` rather than upgraded to `explicitly-none`. The second notice changes **sample-size labels in Fig. 2o–q**, which matters to anyone reading the figure chain even though the publisher says the conclusions stand — so that record's `verification.unresolved` says the affected panels must be re-read before it can be promoted to a full-text-rechecked audit.

Publication-state split, all 11 papers:

| `articleStage` | Count | `postPublicationStatus` | Count |
|---|---|---|---|
| `version-of-record` | 11 | `none` | 8 |
| | | `corrected` | 2 |
| | | `contested` | 1 |

---

## 6. Provenance graph

The graph is **derived at load time** by `lib/graph.mjs`, imported by both `app.js` and `scripts/validate-graph.mjs`, rather than committed as a generated file. A committed artefact can silently describe a version of the records that is no longer on disk; a derived one cannot.

Counts below are derived by hand from the inputs. **`npm run check:graph` prints the authoritative numbers and has not been run.**

**Nodes — 159**

| Type | Count | Source |
|---|---|---|
| `paper` | 11 | `papers-en.json` |
| `laboratory` | 37 | `labs.json` + `labs-en.json` |
| `method` | 16 | `methods.json` |
| `mechanism` | 10 | `knowledge-network.json` |
| `disease_context` | 6 | `paper-claims.json` |
| `compound_or_perturbation` | 18 | `paper-claims.json` |
| `evidence_boundary` | 54 | one per audited figure record |
| `correction_or_dispute` | 7 | one per version event |

**Edges — 192**

| Relation | Count | Derived from |
|---|---|---|
| `BOUNDED_BY` | 54 | the boundary sentence of each audited figure |
| `CANNOT_DISTINGUISH` | 39 | 37 from method `cannotProve`, 2 from curated paper claims |
| `MEASURES` | 37 | method-to-mechanism links |
| `SUPPORTS_IN_CONTEXT` | 13 | curated claims read out of figures |
| `CONTRIBUTED_TO` | 12 | `lab-paper-links.json` |
| `USES_METHOD` | 10 | curated claims |
| `TESTS_IN` | 8 | curated claims |
| `USES_PERTURBATION` | 8 | curated claims |
| `CORRECTED_BY` | 5 | version events |
| `PRE_INDEPENDENCE_WORK` | 3 | `lab-paper-links.json`, role `pre-independence` |
| `CHALLENGES_ATTRIBUTION` | 2 | the DHODH Matters Arising and Reply |
| `REPLICATES` | 1 | the oestradiol ether-lipid claim |
| **`CONTRADICTS`** | **0** | no contradiction between two papers is established in the current corpus |

The zero is reported rather than hidden. `scripts/validate-graph.mjs` prints every relation with its count including zeros, and warns about any paper carrying no mechanism-level claim (currently none).

Every edge carries `relation`, `paperId` (or `null` with a `paperlessBasis` explaining why no paper backs it), `claimScope`, a structured `conditionVector` or a `conditionVectorReason`, `sourceUrl`, `checkedAt`, `verificationDepth`, `confidence` and `confidenceBasis`. Nothing is derived from shared keywords: the 42 curated claims in `data/paper-claims.json` each name the specific figure they were read from, and `scripts/validate-graph.mjs` fails if a claim cites a figure that is not in that paper's audited chain.

In the interface, selecting a mechanism now lists the individual paper claims that support it, replicate it, contradict it or **cannot separate it from an alternative**, each with its figure, condition vector, confidence and verification depth, plus the assay boundaries of the methods that interrogate that node. Supporting and disputed claims are shown as separate groups; they are never averaged.

---

## 7. Monitoring coverage counts

| Category | Count of 37 |
|---|---|
| **Author-monitored, watch has actually run** | **15** |
| **Author watches added this round, never executed** | **8** |
| **Manual only, no automated watch** | **14** |
| **Site-monitored by an automated crawler** | **0** |
| Manually reviewed | 37 |
| ORCID-proven identity | 0 |

The site renders: *“Monitoring coverage: 15/37 laboratories have a running author watch; 8 further author watches were added and have not run yet; 14 are manual-only; 0/37 have an automated site monitor, because no laboratory-site crawler exists.”*

No laboratory claims ORCID-exact identity, because no ORCID was verified — the environment had no network. All 23 watches are `author-plus-affiliation` with `identityProof: "pending-orcid"`.

---

## 8. Browser QA

**No browser QA of any kind was performed, and none is claimed.**

| Check | Status |
|---|---|
| Deployed HTTPS preview URL | **Not created.** No network access and no deployment authority. |
| Desktop viewport | **Not tested** |
| 390 px viewport, no horizontal overflow | **Not tested** |
| Paper search and theme filters | **Not tested** |
| Lab profile → paper dialog transition | **Not tested** |
| Escape and close-button behaviour | **Not tested** |
| Focus restoration | **Not tested — and not implemented; see section 10** |
| Keyboard-only navigation | **Not tested** |
| Accessible dialog names | Implemented as `aria-label` on all four dialogs; **not tested** |
| `aria-pressed` on segmented filters | Implemented on the source filters and on the lab, paper, method, resource and mechanism buttons; **not tested** |
| No console errors | **Not tested** |

Localhost QA was not attempted, in line with HANDOFF section 5.1. Responsive rules for the new components were added to `v09.css` at the existing 760 px breakpoint, unverified.

---

## 9. Findings from the static self-review, and what was done

Two independent static reviews were run over the finished change set: one traced every validator assertion against the actual data files, the other traced the runtime JavaScript. Together with a follow-up check of my own they found **nine defects**, all of which are fixed. They are listed because a reviewer should know what a first pass at this change set got wrong — two of them were the very defects this round exists to fix, surviving in a place I had not looked.

| # | Where | Defect | Fix |
|---|---|---|---|
| 1 | `lib/records.mjs`, `data/live.json` | **A real P0.3 miss.** `pubmed-42267631` (`10.7554/eLife.111544`) and `preprint-10.7554/elife.111544.1` are the same eLife study, published version and Reviewed Preprint v1. `normalizeDoi` did not strip a version suffix, so they resolved to two canonical identities and rendered as two cards — the exact defect P0.3 exists to prevent, surviving my own fix. | Added `DOI_VERSION_RULES` for the two registrant schemes that version DOIs (eLife `…​.<version>`, bioRxiv/medRxiv `…v<n>`), deliberately **not** a blanket `\.\d+$` strip, because `10.1016/j.cell.2025.11.014` ends in a numeric segment that is part of the article identifier. The two records were collapsed in `data/live.json` into one record that keeps both routes in `sources`; `liveSignals` is now 56. Three new fixtures cover it. |
| 2 | `lib/records.mjs` | Merging two automated records picked whichever came first, so a preprint could lead its own published version and the card would read “Not peer reviewed”. | Automated candidates are now ranked, published version before preprint, then by relevance. Fixture added. |
| 3 | `lib/graph.mjs` | Dead ternary: `link.role === "pre-independence" ? "author-position-verified" : "author-position-verified"` gave every attribution edge the same confidence, discarding the distinction it was written to record — in the one file whose stated purpose is that every edge names its source. | Pre-independence edges now carry `author-position-verified-pre-independence`. |
| 4 | `scripts/validate-v09.mjs` | An eager `await fs.stat(...)` for six data files rejected on ENOENT at top level, so the process would die on an unhandled rejection **before** the manifest and ownership gate ran — the `Missing v0.9 data file` message was unreachable. | Guarded with `.catch(() => null)`. |
| 5 | `app.js` | `const [x,y] = networkPositions[node.id]` was unguarded while the line above it guards. Adding an eleventh mechanism to `knowledge-network.json` would throw inside `init()`, blanking the network map **and** aborting the rest of the page render. | Guarded; an unpositioned node is skipped. |
| 6 | `scripts/update-data.mjs` | A local `statuses` map inside `fetchTrials()` shadowed the module-level `statuses` array of per-source results. Legal today, a landmine for the next edit. | Renamed to `statusScores`. |
| 7 | `scripts/validate-papers.mjs` | The overclaim scanner cleared a negation only within 45 characters. Two live sentences cleared with 13 and 4 characters of margin, so an innocuous rewording would have failed the build with `asserts proof`. | Window widened to 120 characters; the trailing `[^.]*$` still confines it to one sentence. |
| 8 | `scripts/seal-manifest.mjs` | `--reviewer=a=b` was truncated to `a` by `.split("=")[1]`. | Splits on the first `=` only. |
| 9 | `scripts/update-data.mjs`, `data/live.json` | **Found while checking the fix for #1.** PubMed indexes preprints, and two bioRxiv postings (`10.64898/2026.05.16.725645`, `10.64898/2026.03.28.714855`) arrived through the laboratory watch as `sourceType: "paper"` with no “Not peer reviewed” caveat, because the watch stream sets the source type and the classifier's answer was ignored. A preprint was presented as a paper — the same failure as P0.1 in a different place. | `automatedRecord` now derives `sourceType` and the caveat from the classified document type. Both records corrected at rest; a classifier fixture covers `pubtype: ["Preprint"]`. |

Both reviews independently confirmed the parts that matter most and that I could not run: the 20 manifest entries match the 20 files on disk with correct shapes; all 11 paper records pass every assertion in `validate-papers.mjs`, including the notice-to-source coupling and the legacy-archive comparison; every id referenced by `paper-claims.json` exists and every claim cites a figure that is really in that paper's audited chain; all 43 element ids `app.js` touches exist in `index.html`; every template literal in `app.js` is balanced; and the DOM harness covers every method the renderer now calls.

**A static review is not a test run.** Two reviewers reading the same code can share a blind spot, and neither observed the program behave. Section 10 stands.

---

## 10. Unresolved, in plain terms

1. **Nothing was executed, so nothing is verified.** No test, no validator, no linter, no browser. The whole change set is unrun code. Treat section 4 as a description of intent that has to be checked against behaviour.
2. **`git status --short` is not clean, and there are no commits.** Git write access was unavailable. This fails HANDOFF requirement 7 outright.
3. **`data/live.json` was migrated in place, not regenerated.** `npm run update` could not run. The records were rewritten field by field to the new shape: evidence grades removed and replaced by `evidenceGrade: null`, document types assigned per source class, `sourceName` and `stale` added, and the one timezone-damaged date corrected. What is therefore **not** present until the next refresh: real PubMed `pubtype` values behind each `documentType`, `canonicalId` written at rest, and the `sources[]` array on each record. The renderer computes canonical identity and merges layers at load time, so the interface is correct either way — but the file on disk is a hand-migrated dataset, and the first `npm run update` will rewrite it.
4. **The four correction notices were not opened by me.** They are classified from the independent reviewer's readings. Each affected record stores `checkedBy: "independent review (Codex), recorded in HANDOFF.md section 2"` and, in the overlay file, an explicit `checkLimit`. If the reviewer's readings were wrong, this repository is wrong in the same way.
5. **The eight new author watches have never run.** They are marked `pending-first-run` and excluded from the running-coverage count, but a wrong affiliation clause would silently return nothing rather than fail. Each needs one refresh cycle and then a look at what it returned.
6. **The Nankai link is unverified.** Replaced on the reviewer's evidence; `npm run check:links` was blocked.
7. **No ORCID identity is proven,** so all 14 manual-queue laboratories stay manual and the 23 author watches remain affiliation-qualified guesses about identity. HANDOFF P1.3's identity table exists as a coverage file with `orcid: null` throughout; it is not yet an identity table.
8. **P1.2 is only half done.** The decision layer — `data/evidence-bundles.json`, six bundles across cell culture, organoid, animal and human tissue, with a `neverStandalone` list that keeps BODIPY 581/591 C11, MDA/4-HNE, hydroperoxide probes and electron microscopy out of standalone answers — is implemented and surfaced in the method dialog. **The per-assay metadata HANDOFF P1.2 asks for is not:** specimen, instrument, quantification unit, essential positive and negative controls, timing constraints, compartment resolution and confounders are still absent from `data/methods.json`. I did not invent them.
9. **The provenance graph covers the 11 English papers only.** The legacy archive's other records contribute nothing to it, and `CONTRADICTS` has no instances — the corpus has a dispute over attribution (DHODH) but no head-to-head contradiction between two papers.
10. **`docs/link-health.json` does not exist yet.** It is created by the first `npm run check:links`; until then no `lastSuccessAt` history exists for any link.
11. **`verificationDepth` is `archive-derived` for all 11 papers.** No paper has been re-read from its full text in this round, and the second oestradiol correction touches figure panels that the archive-derived chain predates. That record is the first that should be promoted to `full-text-rechecked`.
12. **The deployment artifact now depends on `lib/`.** `.github/workflows/deploy-pages.yml` copies it and asserts both modules are present, and `scripts/serve.mjs` now serves `.mjs` as JavaScript. If either is wrong, the page loads no module at all and renders blank. **This is the single highest-severity unverified change in the set**, because its failure mode is a white screen rather than a wrong number.
13. **`data/schema-versions.json` marks every curated and archive dataset `reviewPending: true`.** That is accurate, not a gap in the mechanism — but it does mean no dataset in this repository is currently pinned to reviewed bytes. The gate only starts protecting content once someone runs `npm run seal -- --reviewer=…` against files they actually read.

---

## 11. What the next reviewer should do first

1. `npm run check` — expect this to find defects; it has never been executed.
2. `npm run check:links` — the Nankai replacement and the resources sweep are both unverified.
3. Deploy a preview and run the section 8 matrix, starting with whether the page renders at all, because of item 12.
4. If the content survives review, `npm run seal -- --reviewer=independent-review-codex` on the files actually read, and commit the digests with the review.

`HANDOFF.md` is unchanged; this file is the reply to it. Nothing has been pushed to `origin/main`, and `main` remains four commits ahead of the public site with the round-2 work uncommitted on top.
