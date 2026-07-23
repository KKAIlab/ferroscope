# Delivery audit — Claude Code round 5

Date: 2026-07-24
Base commit: `f2d64ca` (round-4 review `CODEX_REVIEW_ROUND4.md`)
Executed against: `HANDOFF.md`
Implementer: Claude Code (round-5 implementer, not an independent reviewer)
Decision requested: independent Codex review. **This is not a claim of delivery readiness.**

Round 5's subject was not new content but a stronger provenance contract: a `source-checked`
sentence must resolve to the exact source record, review event and reviewed scope that
supports it, at no deeper access level than that scope earned. No laboratories, papers,
methods, glossary terms or research signals were added. Two method fields were honestly
demoted; the source-checked method-field count fell from 35 to 33 on purpose.

## 1. Commits created

| Commit | Subject |
|---|---|
| `725ea8d` | Resolve every checked claim to a source record, review event and scope by id (P0-A, P0-B, P0-C, P0-D) |
| `91209f9` | Separate a maintenance date from a review date in the manifest (P1-B) |
| `3099c5e` | Show support mode, scope depth and the opened source in the method dialog (§10) |
| `ddb75cd` | State the round-5 release against derived counts (P1-C) |
| _this file_ | Record the round-5 delivery audit and refreshed link health |

No push, no deployment, no pull request, no `git checkout`/`reset`, no dataset sealed.

## 2. Exact commands and results

```
npm run check          → exit 0 (all 12 sub-checks pass; see §11 for the list)
npm run check:links    → exit 0 (54 resolved, 5 restricted reported separately, 0 failed)
git diff --check       → exit 0
git status --short      → clean after the commits above
```

New checks wired into `npm run check`:

- `check:method-review` — `scripts/test-method-review.mjs`, 20 mutation cases.
- `check:readme` — `scripts/test-readme-consistency.mjs`, README-vs-data consistency.

## 3. Primary sources reopened

The two accepted author manuscripts were reopened and the contested passages re-read before
editing, rather than trusting the handoff's paraphrases:

- Zou et al. 2020 — `PMC7353921` (NIHMS1603967). The MDA Methods paragraph names the Abcam
  ab118970 kit, BHT in lysis, 95 °C/60 min, Ex/Em 532/553 nm and protein normalisation, and
  makes **no** statement that the TBA reaction is non-specific or detects a class of aldehydes.
  H2-DCFDA is a **parallel** ROS readout, not a process control. No "must move together" rule
  appears anywhere.
- Kagan et al. 2017 — `PMC5506843` (NIHMS873824). Ratiometric quantification against a
  pre-selected internal standard with a per-class standard curve is stated; the standard being
  added **before extraction**, snap-freezing and antioxidant handling are **not** stated in the
  cited LC-MS scopes. PAF-AH release and targeted inclusion lists are explicit. The
  C11-BODIPY/LiperFluo peroxyl-vs-hydroperoxide boundary is verbatim. SAPE-OOH is an authentic
  identity/reference standard. The <15 %/>15 % cell-death split is a ranking device.

## 4. Provenance schema migration

| Object | Before (round 4) | After (round 5) |
|---|---|---|
| Method source route | `scope: [string]`, no id | source record with `id`, `reviewEventId`, `reviewerId`, and `reviewedScopes: [{id, label, verificationDepth, accessSurface, boundary}]` |
| Method field evidence | `{url, checkedAt, checkedBy, scope[]}` (loose strings) | `{sourceRecordId, reviewEventId, scopeId, supportMode, supportNote}` resolved by id; optional denormalised fields must byte-match the record |
| Paper verification source | flat `scope: [string]`, one record depth | figure scopes carry per-scope `verificationDepth` and stable ids; record depth is a summary maximum |
| Graph edge `sourceUrl` | module/claim declared default | the URL of the source that was actually opened |
| Graph edge `verificationDepth` | record's summary maximum | the covering scope's own depth |
| Independent review | a status string | a distinct event: prior event id, different reviewer, matching version, overlapping scope, agreement |
| Manifest pending entry | `reviewedAt: "2026-07-23"` | `reviewedAt: null`, `registeredAt` for maintenance timing |

## 5. Graph counts before → after

Review-state counts are unchanged — the promotion logic did not become more permissive; only
the depth and the clickable source were corrected.

| Review state | Before | After |
|---|---|---|
| recorded-unverified | 69 | 69 |
| archive-derived | 77 | 77 |
| source-checked | 46 | 46 |
| independently-rechecked | 0 | 0 |

Verification depth — the P0-2 fix moves 21 figure-caption edges out of methods depth:

| Depth | Before (approx.) | After |
|---|---|---|
| figures-legends-checked | 0 | 21 |
| methods-checked | 25 | 4 |
| metadata-checked | 22 | 22 |
| curated-unverified | 66 | 66 |
| archive-derived | 77 | 77 |
| full-text-rechecked | 2 | 2 |

Totals unchanged at 159 nodes and 192 edges.

## 6. Method-field counts by module (before → after)

| Module | Before | After | Change |
|---|---|---|---|
| mda-4hne | 12/1 | 11/2 | `confounders` demoted to pending |
| bodipy-c11-assay | 10/3 | 9/4 | `processControl` demoted to pending |
| oxidized-pl-lcms | 13/0 | 13/0 | reworded, not demoted |
| all other 13 modules | 0/13 | 0/13 | routes migrated to id schema only |
| **Total source-checked** | **35** | **33** | honest demotion of 2 |

## 7. Every field demoted, narrowed, moved or newly supported

- `mda-4hne.confounders` — **demoted to pending.** The TBA/MDA non-specificity boundary is not
  stated in the reopened Zou MDA Methods, and the module's declared 2025 recommendation was read
  only at abstract level. The BHT process-handling clause it did state is kept under
  `processControl`.
- `mda-4hne.negativeControl` — **narrowed / roles labelled.** DMSO baseline and ML210+Lip-1
  rescue labelled as matched conditions expected not to produce the ferroptotic signal.
- `mda-4hne.orthogonalConfirmation` — kept, worded as "what the study paired", not a universal
  requirement.
- `bodipy-c11-assay.processControl` — **demoted to pending.** H2-DCFDA is a parallel comparator,
  not a control for probe loading/handling/acquisition/performance.
- `bodipy-c11-assay.orthogonalConfirmation` — **narrowed.** The "required to move together"
  editorial rule removed; the H2-DCFDA parallel comparator moved here.
- `bodipy-c11-assay.confounders` — **split by source, one clause removed.** Peroxyl-radical /
  no-direct-hydroperoxide boundary kept (Kagan, explicit); storage/light handling kept (vendor);
  "can redistribute between compartments" removed as unsupported.
- `oxidized-pl-lcms.processControl` — **narrowed.** Kept ratiometric internal-standard /
  per-class standard curve (Kagan Statistical Analysis, explicit); removed "added before
  extraction", snap-freezing and antioxidant handling, none of which the cited Kagan scopes
  state.
- `oxidized-pl-lcms.confounders` — **explicit vs inference separated.** PAF-AH release and
  targeted inclusion lists labelled explicit; the not-evidence-of-absence clause labelled
  analytical inference; the ex-vivo-autoxidation clause removed.
- `oxidized-pl-lcms.negativeControl` — **redefined.** The <15 %/>15 % ranking threshold removed
  as an assay negative control; Acsl4-KO (signal strongly reduced) and non-oxygenated precursors
  used instead.
- `oxidized-pl-lcms.positiveControl` — **reclassified.** SAPE-OOH labelled an analytical
  identity/reference standard that verifies the assay's positive signal, explicitly not a
  biological positive-control condition.

Control axes were defined first, machine-readable, in `lib/method-review.mjs` (`CONTROL_AXES`)
and applied consistently; no comparator was relabelled to reach 13/13.

## 8. Source-URL regression demonstration for MDA (P0-B)

Before: both `method:mda-4hne → mechanism:*` MEASURES edges were checked against Zou's PMC
author manuscript but their clickable `sourceUrl` was `https://doi.org/10.1038/s41580-025-00843-2`,
the 2025 recommendation that was never opened.

After: `sourceUrl` is `https://pmc.ncbi.nlm.nih.gov/articles/PMC7353921/` — the source that was
opened. Enforced by `test-graph-contract.mjs`:

> the shipped MDA method edge links to the source that was opened, not the unread recommendation

## 9. Independent-review mutation matrix (P1-A)

`scripts/test-method-review.mjs` (20 cases) rejects every fabricated join and every spoofed
second reading:

| Mutation | Rejected because |
|---|---|
| unknown source record id | `unknown source record id` |
| wrong review event id | `does not match record` |
| unknown scope id | `unknown scope id` |
| evidence promoted from a not-checked route | `is not a review` |
| denormalised url / version / checkedAt disagree | `denormalised … disagrees` |
| field depth deeper than its scope | `claims depth … from a scope read only to` |
| explicit claim whose note admits inference | `admits inference` |
| checked field with no support note | `explain how the passage supports` |
| pending field retaining a value | `carries a value while declaring itself unverified` |
| recheck by same reviewer as original | `different reviewer` |
| recheck signed by the dataset owner | `may not be signed by the dataset owner` |
| recheck naming no prior event | `must name the prior review event` |
| recheck of a changed source version | `same source version` |
| recheck with no overlapping scope | `do not overlap` |
| recheck with no agreement outcome | `must record agreement` |
| independently-rechecked record with no event | `must carry an independentReview event` |

Array-order reversal (P1-4) is covered in `test-graph-contract.mjs`: two records covering one
scope resolve to the stronger review state regardless of array order. **No real
independently-rechecked event was created; Codex performs that review.**

## 10. Manifest semantics before → after (P1-B)

Before: 19 pending datasets each carried `reviewer: null`, `reviewPending: true`,
`reviewedContentSha256: null` **and** `reviewedAt: "2026-07-23"`.

After: those 19 entries carry `reviewedAt: null` and a `registeredAt` maintenance date. The
validator rejects a pending entry that carries a `reviewedAt`; `test-manifest.mjs` proves it
(new case: "a dataset awaiting review may not carry a review date"). 17 manifest mutation cases
pass. 0 datasets are sealed.

## 11. Required checks

`npm run check` (exit 0) runs, in order: `check:data`, `check:v09`, `check:method-review`,
`check:papers`, `check:graph`, `check:graph-contract`, `test:research`, `check:surface`,
`check:dates`, `check:ingestion`, `check:manifest`, `check:readme`.

- Method decision schema: 33 source-checked and 175 pending fields across 16 modules.
- Graph: 159 nodes, 192 edges; recorded-unverified 69, archive-derived 77, source-checked 46,
  independently-rechecked 0.
- README consistency: current-release section matches derived counts.
- `check:links`: 54 resolved, 5 restricted (reported separately, not counted healthy), 0 failed.

## 12. README consistency result (P1-C)

`check:readme` derives method counts, graph review-state counts, node/edge totals, sealed count
and independent-recheck count from the data and requires the README's current-release section to
state exactly those numbers. It also fails if the two old misleading phrasings ("all 208 fields
are currently pending", "11 source-checked reading records") return.

## 13. Link-health result

`docs/link-health.json` regenerated: 54 resolved, 5 reachable-but-restricted (Stockwell/Columbia,
Gao/HIT, Bush/Florey, bioRxiv, LipidMaps — reported separately), 0 failed. Reachability is not
source-content validation, and the report continues to render that distinction.

## 14. Browser / accessibility QA matrix

**Pending — no authorized HTTPS preview exists.** Per `HANDOFF.md` §11, desktop and 390 px
browser QA (horizontal overflow, provenance-block wrapping, keyboard-only open/close, Escape and
close button, focus restoration, dialog accessible names, external-link behaviour, zero console
errors) was **not** performed. It was **not** faked by deploying, and MIME/DOM-harness checks were
**not** substituted for it. The DOM harness (`check:surface`) confirms the new support-mode, scope
depth, boundary and opened-source elements render, but that is a rendering assertion, not browser
QA.

| Surface | Status |
|---|---|
| desktop layout / overflow | pending (no authorized preview) |
| 390 px layout / wrapping | pending |
| keyboard open/close, Escape, focus | pending |
| dialog accessible names | pending |
| console errors | pending |

## 15. Unresolved issues, in plain language

- **No independent review of any dataset.** 0 sealed, 0 independently-rechecked scopes. The
  round-5 work is an implementer's, and the whole contract exists so a second reader can now
  check it claim by claim.
- **Browser and accessibility QA is not done** and cannot be until an authorized HTTPS preview
  exists.
- **Rendered figure panels and supplements remain unread.** Figure claims rest on caption text,
  now correctly capped at figures-legends-checked.
- **Both papers were read as author manuscripts, not versions of record.** The 2021 correction to
  Zou's antibody information is recorded as a boundary; the manuscript still contains the
  superseded information.
- **The 2025 field recommendation backing several modules was read only at abstract level**, so
  general assay-specificity boundaries (e.g. TBARS non-specificity) remain pending rather than
  asserted.
- **Vendor pages are read in full but ranked on the same depth ladder as papers.** A vendor scope
  can read as `full-text-rechecked`; the UI discloses the source type so a reader can weigh it.
- **No first-party laboratory-site crawler exists.** Author queries and link checks are not
  lab-dynamics monitoring.

## 16. Request

I request an independent Codex review of commits `725ea8d`, `91209f9`, `3099c5e`, `ddb75cd` and
this audit against `HANDOFF.md` and `CODEX_REVIEW_ROUND4.md`. I am not asserting delivery
readiness. Please pay particular attention to: whether any surviving `explicit` support note
should be `derived` or `analytical-inference`; whether keeping `oxidized-pl-lcms.positiveControl`
(SAPE-OOH as an identity standard) is honest under the control-axis definitions or should be
demoted; and whether the vendor-page depth ranking overstates confidence.
