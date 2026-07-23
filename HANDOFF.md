# FerroScope One-Week Handoff · Source-Verified Core

Date: 2026-07-24
Canonical repository: `/Users/chenjingquan/Projects/ferroscope`
Starting HEAD: `316bef9` plus the independent round-3 review commit
Public origin: `eaae307`
Release rule: **local work only; do not push or deploy**

Read first:

1. `CODEX_REVIEW_ROUND3.md` — authoritative defects and release boundary;
2. `DELIVERY_AUDIT_ROUND3.md` — implementer's test record;
3. `CODEX_REVIEW_ROUND2.md` — historical context;
4. `CLAUDE_CODE_HANDOFF.md` — original product vision, not the current work order.

## 1. Mission

Use the remaining one-week quota to turn FerroScope from a well-tested framework into a **small, source-verified ferroptosis knowledge core** for a lipid-biochemistry researcher.

Do not optimize for record count. Optimize for the speed and reliability of answering:

- What exactly was tested?
- In which model, compartment, perturbation and time window?
- Which figure and readout support the claim?
- What does the experiment fail to establish?
- Which laboratory demonstrated the method, and in what role?
- Has the source, correction history and laboratory link been checked recently?

The public narrative remains simple English. Chinese and Japanese belong in terminology/search aliases, not duplicated scientific prose.

## 2. Critical correction before content work

### Separate time, depth and review state

The current graph incorrectly promotes any dated record to `source-checked`. Fix this first.

Every reviewable object must store independent fields:

```json
{
  "reviewState": "recorded-unverified | archive-derived | source-checked | independently-rechecked",
  "verificationDepth": "metadata-only | abstract-checked | figures-legends-checked | methods-checked | supplement-checked | full-text-rechecked | raw-data-rechecked",
  "checkedAt": "YYYY-MM-DD or null",
  "checkedBy": "agent/reviewer identity or null",
  "sourceUrl": "https://...",
  "sourceVersion": "version/DOI/content hash when available",
  "scope": ["title", "abstract", "Fig. 1", "Methods: lipid extraction"],
  "boundary": "What this review did not inspect or establish"
}
```

Rules:

- `checkedAt` records when; it never proves what was checked.
- `source-checked` requires non-empty scope and an explicit depth.
- an archive-derived claim stays archive-derived even if it has a migration date;
- an edge cannot claim a deeper state than its source record;
- method capability cannot be called demonstrated/source-checked until the cited paper claim and laboratory attribution both satisfy the relevant scope;
- preserve correction notices and access limitations.

Required tests:

- date-only promotion fails;
- URL-only promotion fails;
- scope mismatch fails;
- archive-derived paper claim renders as archive-derived;
- a genuinely checked figure claim promotes only the edges supported by that figure;
- the counts printed by validation separate all review states and depths.

## 3. Primary-source work package

Read sources directly. Do not treat the existing Chinese archive, user-provided summaries, abstracts, search snippets or model memory as full-text verification.

### Package A — GPX4 membrane access

Paper: `10.1016/j.cell.2025.11.014`

Questions:

- Which experiments distinguish catalytic activity from membrane anchoring?
- What do R152H and I129S/L130S establish separately?
- Which membrane systems were used, and what do they omit?
- Which neuronal, organoid and mouse claims are directly supported?
- What exactly does liproxstatin-1 rescue: death, biomarker, structure, behaviour or survival?

Populate:

- paper record at three reading scales;
- figure claims with condition vectors;
- `membrane-reconstitution` method fields supported by read sections;
- conditional genetics fields only where the paper/methods support them;
- laboratory attribution with contribution-statement basis.

### Package B — oxidized phospholipid LC–MS/MS

Paper: `10.1038/nchembio.2238`

Questions:

- Which oxidized AA/AdA-PE species were measured?
- How were species assigned and quantified?
- What internal standards, extraction, chromatography, fragmentation and controls are stated?
- Which findings are correlative, necessary or sufficient?
- What cannot be inferred from BODIPY or bulk MDA/4-HNE measurements?

Populate:

- `oxidized-pl-lcms` decision fields actually supported by the source;
- `epilipidomics` only where the source scope covers it;
- method-to-mechanism edges with precise analyte/compartment/model boundaries;
- a comparison box: BODIPY C11 versus direct oxidized phospholipid measurement.

### Package C — POR and phospholipid peroxidation

Paper: `10.1038/s41589-020-0472-6`
Correction: `10.1038/s41589-021-00767-w`

Questions:

- What genetic and biochemical evidence supports POR's role?
- Which lipid species/readouts were used?
- What does the antibody correction change, and what does it not change?
- Which conclusions are model-specific?
- Which laboratory roles are lead, collaborating or pre-independence?

Populate the paper, graph, method capabilities and correction boundary together. The corrected antibody information must be visible wherever the affected method is discussed.

### Package D — method standards

Sources:

- `10.1038/s41580-025-00843-2`;
- `https://www.thermofisher.com/order/catalog/product/D3861`.

Read the actual accessible content and record access depth. Use them to populate only supported fields for:

- death kinetics;
- orthogonal rescue/pathway exclusion;
- BODIPY 581/591 C11;
- MDA/4-HNE boundaries;
- electron-microscopy boundaries.

BODIPY 581/591 C11 must remain prohibited as a standalone ferroptosis diagnosis.

## 4. Three-dimensional reading model

Every promoted paper must support all three views without duplicating prose.

### Scale 1 — 60-second decision card

- Story: the real unresolved question;
- Advance: what changed relative to prior knowledge;
- Evidence anchor: the decisive experiment, not a journal-value claim;
- Scope: model and boundary;
- Open question: the next falsifiable problem.

Avoid `paradigm shift`, `first`, `proves` and `Why Cell/Nature?` unless a source and boundary justify them. Journal prestige is not evidence.

### Scale 2 — figure-level causal chain

For every included figure/panel:

`question → intervention → readout → result → inference → alternative explanation → boundary`

Record exact figure/panel identifiers and which parts were actually opened. A figure legend alone is not the same as the full methods section.

### Scale 3 — longitudinal laboratory synthesis

For a laboratory, distinguish:

- persistent scientific question;
- current independent-lab work;
- pre-independence work;
- technical contribution versus conceptual leadership;
- demonstrated method use versus editorially judged distinctive capability;
- new paper, correction, dispute, job/recruitment and official-site activity.

Do not infer a laboratory update from a reachable homepage.

## 5. Method schema completion rule

The 13 fields are:

1. specimen/model;
2. biological question;
3. perturbation;
4. readout;
5. quantification unit;
6. instrument;
7. positive control;
8. negative control;
9. process control;
10. orthogonal confirmation;
11. timing;
12. compartment resolution;
13. confounders.

For each field:

- store a value only if the cited source and scope support it;
- otherwise retain `pending-source-review` with the exact section/source needed;
- distinguish vendor protocol, field recommendation, original research demonstration and local laboratory capability;
- never copy a protocol detail from one model into another without a stated transfer boundary;
- keep units, instrument model and analysis method separate;
- store essential controls as structured rows, not a prose list.

Minimum one-week target:

- 3 papers rechecked at figures/legends plus relevant methods;
- 3 priority method modules with at least 8 of 13 fields source-checked;
- the remaining fields visibly pending;
- no decrease in provenance strictness.

## 6. Knowledge-network rule

An edge must retain:

`model × perturbation × dose × exposure × medium/nutrients × readout × compartment × time window`

Do not merge different conditions into a universal mechanism. The interface should let the user move through:

`laboratory ↔ paper ↔ figure claim ↔ method ↔ mechanism ↔ disease/context ↔ correction/boundary`

Required graph changes:

- replace the binary review-state count with explicit depth/state counts;
- keep `CONTRADICTS 0` visible until an actual contradiction is encoded;
- add no contradiction edge merely to make the graph look balanced;
- capability rows must explain the laboratory's role and the evidence boundary;
- a correction must point to the affected figure/method/claim where possible.

## 7. Monitoring and outside links

Keep global coverage in English, Chinese and Japanese search terms. The public scientific explanation stays English.

Priority order for identity:

1. ORCID exact match;
2. author plus current affiliation;
3. author plus verified prior/current appointment window;
4. manual queue.

Track separately:

- original papers;
- preprints;
- corrections/retractions/editor notes/Matters Arising;
- official laboratory news and recruitment;
- clinical-trial records;
- resource/link reachability.

A status code proves reachability only. A laboratory news monitor must detect and archive content changes with timestamp and source URL. Never scrape around access restrictions.

Also add a non-destructive overlay for superseded historical links; do not rewrite archival provenance.

## 8. One-week quota allocation

Use the remaining quota approximately as follows:

- **45% — direct source reading and structured extraction** for Packages A–C;
- **20% — method decision fields** from Package D and the three anchor papers;
- **15% — review-state contract correction** and negative tests;
- **10% — graph/laboratory attribution integration**;
- **5% — authorized HTTPS browser QA**;
- **5% — audit report, selective sealing and clean commits**.

Stop conditions:

- Do not use quota on framework migration, backend/authentication, visual redesign, bulk translation or adding dozens of shallow papers.
- If full text is inaccessible, record the accessible scope and move to the next source; do not fabricate completion.
- If a content claim cannot be traced to a source section, keep it pending.

## 9. Engineering fixes included in this round

Before content promotion:

1. fix `retainOnFailure()` so cached route `lastSuccessAt` is used when the source-level argument is absent;
2. validate real calendar dates, including leap years, without local-time conversion;
3. add the historical-link correction overlay;
4. retain all existing P0 mutation tests;
5. keep CJK outside the public narrative except terminology/search aliases.

## 10. Browser and accessibility gate

Use an authorized HTTPS preview only. Test:

- desktop and 390 px width with no horizontal overflow;
- method dialog length and grid wrapping;
- keyboard-only navigation;
- Escape and close button;
- focus restoration to the opening control;
- dialog accessible names;
- filter pressed state;
- external-link behaviour;
- zero console errors.

Do not deploy merely to make this test possible, and do not claim browser QA from MIME tests.

## 11. Dataset review and sealing

Sealing is not a bulk command.

For each changed curated dataset:

1. review the actual final bytes;
2. record reviewer, date, source scope and unresolved boundaries;
3. run the relevant validators;
4. seal only that file;
5. mutate a byte and prove the fingerprint gate fails;
6. restore and rerun the complete suite.

Never seal generated/live data as if it were manually reviewed.

## 12. Required verification

Before returning to Codex:

1. `npm run check` passes.
2. `npm run check:links` reports restricted separately and 0 broken, or documents each new failure.
3. Date-only review promotion fails.
4. Archive-derived claims never render as source-checked.
5. Route fallback-age and invalid-calendar fixtures pass.
6. Each promoted method field resolves to a checked source scope.
7. Each promoted graph edge is no deeper than its source record.
8. Three anchor papers pass a source-scope completeness validator.
9. Authorized browser QA matrix is recorded, or remains explicitly pending with no deployment claim.
10. `git diff --check` passes.
11. Worktree is clean after coherent local commits.
12. No push, deployment or PR was created.

## 13. Deliverable

Create `DELIVERY_AUDIT_ROUND4.md` containing:

- commits created;
- exact commands and results;
- source-access table for every paper/protocol read;
- before/after review-state counts;
- method-field counts by module and verification depth;
- graph-edge counts by provenance, state and depth;
- corrections and source URLs;
- datasets reviewed and selectively sealed;
- link-health and monitoring counts;
- browser QA matrix;
- every unresolved issue in plain language.

Do not push to `origin/main`. End with a clean local worktree and request independent Codex review.
