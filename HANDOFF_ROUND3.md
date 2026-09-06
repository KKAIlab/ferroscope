# FerroScope Round-3 Handoff

Date: 2026-07-24  
Authoritative review: `CODEX_REVIEW_ROUND2.md`  
Prior implementation report: `DELIVERY_AUDIT_ROUND2.md`  
Release rule: **do not push and do not deploy**

## Mission

Close the two remaining P0 truthfulness defects, finish the per-method decision schema without inventing source verification, and leave a tested, clean local worktree for the next Codex review.

## Work order

### 1. P0 first

1. Make rendered calendar dates timezone-invariant and add a three-timezone rendering fixture.
2. Make freshness route-specific across cached canonical records, including partial degradation, and add the four fixtures specified in `CODEX_REVIEW_ROUND2.md`.
3. Keep the public freshness copy exactly aligned with the implemented merge semantics.

### 2. Finish the method data model

For all 16 method modules, add structured fields for specimen/model, question, perturbation, readout, unit, instrument, essential controls, orthogonal confirmation, timing, compartment resolution, confounders, verified source routes and demonstrated laboratory capability.

Rules:

- Never invent a protocol detail to complete a schema.
- A missing verified detail must be explicit (`status: pending-source-review`) and visible in the method dialog.
- Distinguish vendor protocol, field recommendation, original research demonstration and local laboratory capability.
- A laboratory capability claim must cite a paper and the laboratory's role; `distinctiveLabs` alone is not evidence.
- BODIPY 581/591 C11 remains prohibited as a standalone diagnosis.

### 3. Tighten graph provenance

- Correct the graph generator identity.
- Make paperless, unchecked method-module edges visibly provisional.
- Require either an ISO `checkedAt` or an explicit `reviewState: pending-source-review`; null must not silently pass.
- Keep the zero-count `CONTRADICTS` relation visible.

### 4. Reconcile reports and review state

- Do not edit the historical round-2 report to pretend Claude ran tests.
- Create `DELIVERY_AUDIT_ROUND3.md` with actual commands and results.
- Update the Nankai descriptions and current link-health facts where they are still stale.
- Do not seal any dataset unless the bytes were actually reviewed by an independent reviewer.

## Required verification

1. `npm run check` passes.
2. `npm run check:links` passes with 0 broken and restricted links reported separately.
3. The display-date fixture passes under UTC, Asia/Tokyo and America/Los_Angeles.
4. The four multi-source freshness fixtures pass.
5. Every method has either a source-checked value or an explicit pending-source-review value for every required field.
6. The graph validator rejects an unchecked method edge that lacks a provisional review state.
7. Local module/MIME smoke test passes.
8. `git diff --check` passes.
9. Worktree is clean after local commits.

Browser QA may remain explicitly pending if no authorized HTTPS preview exists. Do not bypass the browser policy and do not claim it passed.

## Deliverable

`DELIVERY_AUDIT_ROUND3.md` must state:

- commits created;
- exact tests run and their outputs/counts;
- before/after examples for the two P0 fixes;
- method completeness counts, separated into source-checked and pending-source-review fields;
- graph edge counts by provenance/review state;
- link-health counts;
- unresolved browser and full-text review work.
