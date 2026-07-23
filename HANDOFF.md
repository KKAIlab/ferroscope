# FerroScope Independent Review Handoff

Date: 2026-07-23  
Reviewer: Codex  
Repository: `/Users/chenjingquan/Projects/ferroscope`  
Reviewed HEAD: `f307ea6`  
Previous implementation commits: `a2a6030`, `fb86017`, `f307ea6`  
Public origin at review time: `eaae307` (`main` is four commits ahead locally)

## 1. Release decision

**Do not push or deploy the current local HEAD yet.**

The Claude Code delivery is a strong foundation: the full local test suite passes, the working tree is clean, the English paper layer exists, correction history is visible, and the public-surface escaping tests are meaningful. However, the independent review found several P0 issues that would mislead a researcher about evidence strength, freshness or monitoring coverage.

The public GitHub Pages site is still the old build. A direct check on 2026-07-23 returned the previous mixed-language section `02 · GLOBAL LAB WATCH / 全球研究团队`; none of the four local commits has been published. This is desirable until the P0 items below are fixed.

## 2. What was independently verified

### Local engineering checks

- `npm run check`: passed independently at `f307ea6`.
- `git diff --check 9b18e04..f307ea6`: passed.
- Worktree: clean; branch `main` ahead of `origin/main` by four commits.
- Paper layer: 11 records, 15 laboratory relationships, 12 laboratories.
- All 11 records currently use `readingLevel: "figure-audited"`.
- Public-surface test rendered 99 fragments and passed its CJK and hostile-metadata gates.

### Primary metadata checks

The 11 PubMed records were independently re-queried on 2026-07-23. Titles, journals, citation years, volume/pages and first/last authors were consistent with `data/papers-en.json`. The Kagan oxidized-PE article correctly uses citation year 2017 while retaining the 2016 electronic date.

### Correction notices read in this review

The four notices previously marked `pending-source-check` were opened on the publisher's official site:

1. [POR Author Correction](https://www.nature.com/articles/s41589-021-00767-w)
   - Corrects the POR antibody catalogue, clone and lot information in the immunoblot Methods.
   - Affected domain: `methods`.
   - No conclusion change is stated.
2. [DHODH Author Correction](https://www.nature.com/articles/s41586-021-03820-9)
   - Adds a PDX Development and Trial Center grant to the Acknowledgements.
   - Affected domain: `funding/acknowledgements`, not methods, figures or conclusions.
3. [First oestradiol Publisher Correction](https://www.nature.com/articles/s41586-025-09562-2)
   - Removes reference-title text inserted into the seventh sentence of the Discussion and restores the intended concluding sentence.
   - Affected domain: `text/discussion`.
   - The notice does not explicitly state a conclusion-impact classification.
4. [Second oestradiol Publisher Correction](https://www.nature.com/articles/s41586-026-10148-9)
   - Corrects chemical structures in Fig. 2e,f, sample-size labels in Fig. 2o-q, figure cross-references and a duplicated Supplementary figure.
   - Affected domains: `figures`, `labels`, `supplement`, `cross-references`.
   - The notice explicitly states that none of the mistakes affects scientific conclusions.

### Link checks

- Laboratory checker: 33 healthy, 3 reachable but automation-restricted (403), 1 hard failure.
- Hard failure: `chen-nankai` old URL timed out.
- Current official replacement: [Quan Chen, Nankai University](https://sklmcb.nankai.edu.cn/2026/0428/c14029a593896/page.htm).
- The new Kitasato link already in `data/labs.json` returned 200; the expired-certificate URL from the earlier screenshot is no longer canonical.
- All 12 external research resources were reachable; bioRxiv and LIPID MAPS returned 403 to the automated client but were otherwise classified as reachable.

### Browser QA boundary

Real browser access to `http://127.0.0.1` was blocked by enterprise policy. Do not claim desktop, 390 px mobile or keyboard QA has passed. Use a deployed preview URL in the next round. Do not bypass this restriction with another local browser surface.

## 3. P0 findings — fix before release

### P0.1 Automated records are not evidence grade B by default

`scripts/update-data.mjs:128` and `scripts/update-data.mjs:176` assign `evidence: "B"` to every PubMed item that survives a broad query. `app.js` then displays all `sourceType: "paper"` records as `Peer reviewed` and allows sorting by `Evidence level`.

This is scientifically unsafe. Current `data/live.json` includes at least two commentary-style records as evidence B:

- `pubmed-42439891`, *More gas, fewer brakes...*, is a JCB **Spotlight** connected to another article.
- `pubmed-41813884`, *Fat bolsters tumours against ferroptosis*, has no abstract and is a short Nature Cell Biology commentary on other papers.

Required change:

- Separate `documentType` from `reviewStatus` and from `evidenceGrade`.
- Read PubMed publication types and publisher article types where available.
- Suggested `documentType`: `original-research | review | commentary | protocol | correction | preprint | trial-record | unknown`.
- Automated alerts must default to `evidenceGrade: null` or `unassessed`, not B.
- Only a curated audit may assign A-D evidence strength.
- Replace the automatic UI label `Peer reviewed` with an accurate type such as `PubMed record` until document type is known.
- Exclude or visibly label Spotlight, News & Views, commentary and protocol content; do not silently mix them with original research.

Acceptance fixture:

- PMID 42439891 renders as `commentary/Spotlight`, not original research and not evidence B.
- PMID 41813884 renders as commentary/unassessed.
- An original research record can still be promoted by a curated overlay after audit.

### P0.2 PubMed dates depend on the machine timezone

`scripts/update-data.mjs:41-46` parses date-only strings with `new Date(raw)` and then converts to UTC. In `Asia/Tokyo`, `new Date("2025 Dec 4")` becomes `2025-12-03T15:00:00Z`, so the stored date shifts back one day.

Observed result:

- PubMed reports the GPX4 fin-loop electronic date as 2025-12-04.
- Current `data/live.json` stores `2025-12-03`.
- The same parser returns 2025-12-04 under `TZ=UTC` and 2025-12-03 under `TZ=Asia/Tokyo`.

Required change:

- Parse PubMed date components explicitly as a calendar date; never round-trip a date-only value through local time.
- Keep `onlineDate`, `issueDate` and `displayDate` separate when both exist.
- Add a timezone-invariance test that runs under UTC and Asia/Tokyo.

### P0.3 Deduplicate by canonical source identity, then merge layers

`app.js:56-58` deduplicates by `id` before URL. Curated and live records for the same DOI/NCT use different IDs, so they both render.

Current duplicate canonical URLs:

- GPX4 fin-loop DOI: curated + PubMed live record.
- NCT07433283: curated + live trial record.
- NCT06218524: curated + live trial record.
- NCT06928649: curated + live trial record.

At ingestion, `new Map(collections.map(item => [item.id, item]))` also overwrites rather than merges when generic PubMed and a lab-watch query return the same PMID; a future overlap can discard `trackedLabIds`.

Required change:

- Canonical identity order: normalized DOI, PMID, NCT ID, then normalized canonical URL; use a synthetic ID only as the last fallback.
- Prefer curated narrative and evidence decisions.
- Merge current date/status and the union of `trackedLabIds` from automated records.
- Preserve a `sources` array so one rendered signal can show all discovery routes.

Acceptance fixture:

- Each of the four URLs above renders once.
- The merged record retains the curated card and the automated lab-match metadata.

### P0.4 Monitoring coverage is overstated

There are 37 laboratory profiles but only 15 PubMed author watches. In `app.js:113`, every laboratory not in the author-watch set is labelled `site watch`. No automated site crawler exists; `data/meta.json` explicitly says laboratory links are curated manually.

Required change:

- Replace `site watch` with `manual official link` or `not yet automated` until an actual monitor exists.
- Publish a structured coverage field per laboratory: `authorWatch`, `siteMonitor`, `manualReview`, `lastCheckedAt`, `nextReviewDue`.
- Show global coverage honestly, for example `15/37 author-monitored; 22 manual-only`.
- Expand author monitoring using ORCID and affiliation-qualified queries. Common abbreviated names must remain manual until identity is proven.
- Do not claim a lab-site update was checked merely because its URL returned 200.

### P0.5 “Figure-audited” and “source-checked” are overloaded

All 11 records are displayed as `figure-level audit` (`app.js:151`, `app.js:236`), while every record states later in the dialog that the English text was rewritten from the legacy archive and that the full text and figures were **not re-opened** in this pass.

The lower verification block is honest, but the high-level badge is stronger than the actual verification performed in this release.

Required change:

- Split at least two axes:
  - `readingDepth`: `metadata | abstract | figure-chain | longitudinal`;
  - `verificationDepth`: `metadata-checked | abstract-cross-checked | archive-derived | full-text-rechecked | raw-data-rechecked`.
- Add `derivedFrom` with legacy DOI/record ID and the commit or content hash used for the rewrite.
- On cards and top-of-dialog headers, visibly show `Archive-derived figure chain · abstract cross-checked · full figures pending`.
- Reserve `source-checked figure audit` for a pass that reopens the full text, main figures and relevant supplements.
- Do not hide this distinction only at the bottom of a long modal.

### P0.6 Replace free-text provenance with structured provenance

`verification.metadata`, `claims` and `figureLayer` are prose. They are useful to a reader but cannot safely drive the future knowledge graph or automatic staleness checks.

Required minimum structure:

```json
{
  "verification": {
    "checkedAt": "2026-07-23",
    "sources": [
      {"kind": "crossref", "url": "...", "scope": ["title", "journal", "authors", "version-relations"]},
      {"kind": "pubmed", "url": "...", "scope": ["citation", "abstract"]},
      {"kind": "publisher-full-text", "url": "...", "scope": [], "status": "not-checked"}
    ],
    "derivation": {
      "type": "archive-rewrite",
      "sourceRecord": "doi:...",
      "sourceCommit": "..."
    }
  }
}
```

Keep a short English summary for the UI, but generate it from structured fields.

### P0.7 Resolve the four pending correction notices and repair the schema

Update the four events using section 2. Do not squeeze all corrections into one `affects` enum. Use:

- `affectedDomains: []` as a list;
- `conclusionImpact: none-stated | explicitly-none | potentially-material | material | unknown`;
- `sourceUrl`;
- `noticeType`;
- `checkedAt`.

After updating, no event in these 11 papers may remain `pending-source-check`.

Also split article stage from post-publication status:

- `articleStage`: `preprint | accepted-manuscript | corrected-proof | version-of-record`;
- `postPublicationStatus`: `none | corrected | expression-of-concern | editor-note | retracted | contested`.

The transplantation paper is a version of record that was previously read as a corrected proof; that history is not the same as a published correction.

### P0.8 Freshness copy does not match the workflow

`index.html:96` claims that a failed source retains its previous dataset **and reports the failure**. In reality:

- `update-data.mjs:270-310` builds a new collection and writes it even when a source fails;
- `npm run check` then fails because `meta.sources[].ok` is false;
- the refresh workflow stops before commit;
- the public site therefore retains the old successful dataset but does **not** receive the failure metadata.

Required change:

- Store source identity on each live item.
- On a source failure, retain only that source's prior items, mark them `stale: true`, preserve `lastSuccessAt`, and record `lastAttemptAt` plus the error class.
- Permit validation/deployment of an honest degraded state if retained data is within a defined maximum age.
- Fail only when the retained source is too old, missing or structurally invalid.
- Rewrite the UI copy to match the implemented policy exactly.

### P0.9 The schema manifest claims an owner but stores none

`data/schema-versions.json:4` says a dataset cannot enter without an owner. No entry has an `owner`, and `scripts/validate-v09.mjs:87-99` checks only version, shape, maintenance, purpose and date.

Also, a file can change without changing `reviewedAt`; the date is not tied to reviewed content.

Required change:

- Add `owner`, `reviewer`, and for curated/archive datasets a `reviewedContentSha256` or another enforceable review fingerprint.
- Generated datasets should carry generator version plus `generatedAt`; do not pretend they were manually reviewed every run.
- Add mutation tests proving that a missing owner and a changed curated file with a stale review fingerprint both fail.

### P0.10 Repair the Nankai link

Replace `data/labs.json` `chen-nankai.website` with:

`https://sklmcb.nankai.edu.cn/2026/0428/c14029a593896/page.htm`

Then rerun the strict laboratory link check. Keep 401/403/429 as `restricted`, not `healthy`, and report them separately.

## 4. P1 — turn the foundation into the requested research system

Complete P0 before P1. Do not spend quota on visual redesign or framework migration.

### P1.1 Materialize the provenance graph

Generate graph nodes for:

- paper;
- laboratory;
- method;
- mechanism;
- disease/context;
- compound/perturbation;
- evidence boundary;
- correction/dispute.

Every edge must contain:

- `relation` from a controlled vocabulary;
- `paperId`;
- structured condition vector;
- `sourceUrl`;
- `checkedAt`;
- `verificationDepth`;
- `confidence` and its basis.

Minimum relation set:

- `SUPPORTS_IN_CONTEXT`;
- `CONTRADICTS`;
- `CHALLENGES_ATTRIBUTION`;
- `REPLICATES`;
- `USES_METHOD`;
- `MEASURES`;
- `CANNOT_DISTINGUISH`;
- `CONTRIBUTED_TO`;
- `PRE_INDEPENDENCE_WORK`;
- `CORRECTED_BY`.

Do not derive universal biology from the graph. A query result must always retain model, inducer, time, compartment and assay.

### P1.2 Convert methods into a decision system

For every method module add:

- specimen/model;
- biological question;
- perturbation;
- readout and unit;
- instrument;
- essential positive and negative controls;
- orthogonal confirmation;
- timing constraints;
- compartment resolution;
- confounders;
- protocol/source URL;
- laboratories with demonstrated capability and the paper proving that capability.

Add a decision path:

`question → minimum evidence bundle → optional mechanistic depth → interpretation boundary`.

Example: BODIPY 581/591 C11 must never be returned as a standalone ferroptosis diagnosis; pair it with time-resolved death, iron/lipid-radical dependence, genetics or target engagement, and a model-appropriate orthogonal lipid/iron measurement.

### P1.3 Expand monitoring coverage without name-collision errors

- Build an identity table with ORCID, canonical names, prior/current affiliations and independent-appointment date.
- Add watches in tiers: ORCID exact > author + current affiliation > manual queue.
- Track correction, retraction, editor-note and Matters Arising signals separately from new-paper alerts.
- Never treat a first-author paper before an independent appointment as current-lab leadership.

## 5. P2 — release QA

### P2.1 Accessible preview

Deploy the fixed branch to a temporary HTTPS preview URL, then test:

- desktop and 390 px viewport with no horizontal overflow;
- paper search and theme filters;
- lab profile → paper dialog transition;
- Escape and close-button behavior;
- focus restoration;
- keyboard-only navigation;
- accessible dialog names (`aria-labelledby` or equivalent);
- `aria-pressed` or equivalent state for segmented filter buttons;
- no console errors.

Localhost browser QA is not accepted because it was blocked in the independent review environment.

### P2.2 Link health

- Add `data/resources.json` to a scheduled link checker.
- Store `lastSuccessAt`, response class and final canonical URL.
- Do not call 403 healthy; call it reachable/restricted.
- A 200 response proves reachability, not that the page still describes the intended laboratory.

## 6. Required tests before requesting the next Codex review

1. `npm run check` passes.
2. `npm run check:links` passes after the Nankai replacement.
3. New offline ingestion fixtures prove:
   - commentary is not evidence B;
   - UTC and Asia/Tokyo produce the same calendar date;
   - DOI/NCT duplicates merge to one record;
   - curated narrative wins while `trackedLabIds` are retained;
   - a failed source retains its prior records and publishes honest stale metadata.
4. Paper validation proves:
   - no `pending-source-check` remains in the 11 papers;
   - article stage and post-publication status are separate;
   - archive-derived and full-text-rechecked audits are visibly different;
   - structured source URLs and verification depth exist.
5. Manifest mutation tests prove missing owner and stale review fingerprint fail.
6. A deployed preview passes desktop, 390 px and keyboard QA.
7. `git status --short` is clean and the delivery report names every unresolved issue.

## 7. Quota allocation for the next Claude Code run

Use the remaining effort in this order:

1. **40% — P0 ingestion truthfulness:** document type, unassessed evidence, date parsing, canonical merge, freshness semantics.
2. **25% — P0 provenance and corrections:** visible verification depth, structured sources, four notices, publication-state split.
3. **25% — P1 provenance graph:** generate the first usable paper–lab–method–mechanism–context graph over the existing 11 papers.
4. **10% — link/accessibility/preview QA.**

Do not bulk-translate the remaining archive, redesign the visual system, migrate frameworks, add authentication or create a backend. Depth and traceability over the 11 papers are more valuable than 58 additional records with ambiguous provenance.

## 8. Next handoff format

When finished, create `DELIVERY_AUDIT_ROUND2.md` containing:

- commits produced;
- exact tests run;
- before/after examples for each P0 item;
- correction notice classifications and source URLs;
- graph node/edge counts by type;
- monitoring coverage counts (`author automated`, `site automated`, `manual only`);
- preview URL and browser QA matrix;
- unresolved items, with no euphemisms.

Do not push to `origin/main` until the independent Codex review says `release-ready`.
