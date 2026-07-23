# FerroScope round-5 handoff: make source checking claim-specific and auditable

Date: 2026-07-24
Base commit: `f2d64ca`
Read first: `CODEX_REVIEW_ROUND4.md`
Do not push, deploy, open a PR, or seal any dataset.

## 1. Mission

Round 4 proved that a date is not a review. Round 5 must prove something harder:

> A `source-checked` sentence must point to the exact source version and exact reviewed
> scope that supports that sentence, at no deeper access level than that scope earned.

Do not add laboratories, papers, methods, glossary terms or research signals in this
round. Correct provenance and reduce overclaim first. It is acceptable and expected for
the total number of source-checked method fields or graph edges to fall.

## 2. Non-negotiable principles

1. Source container, reviewed scope, review event, claim and independent recheck are
   different objects.
2. A source-level maximum depth is a summary, never permission to promote every scope.
3. URLs, dates and reviewer names are metadata, not evidence joins. Use stable ids.
4. The clickable source on a checked claim is the source that was opened, not merely the
   module's declared/default source.
5. Explicit source statement, calculation/derivation, analytical inference and curated
   recommendation must render as different support modes.
6. A lower checked count is preferable to an unsupported checked field.
7. Claude Code is the implementer in this round and must not mark its own work
   independently rechecked or seal it.

## 3. P0-A: introduce a claim-specific review model

Replace flat string scope arrays as the promotion authority with stable review and scope
records. The exact storage layout may differ, but it must support this contract:

```json
{
  "id": "pmc7353921-xml-20260724",
  "kind": "pmc-author-manuscript",
  "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7353921/",
  "sourceVersion": "PMC7353921.1 / NIHMS1603967",
  "reviewEvents": [
    {
      "id": "claude-r4-pmc7353921",
      "reviewState": "source-checked",
      "reviewerId": "claude-code-round4-implementer",
      "checkedAt": "2026-07-24",
      "reviewedScopes": [
        {
          "id": "fig-5-caption",
          "label": "Fig. 5",
          "verificationDepth": "figures-legends-checked",
          "accessSurface": "author-manuscript XML caption",
          "boundary": "Rendered panels and supplement not opened."
        },
        {
          "id": "methods-mda",
          "label": "Methods: Malondialdehyde (MDA) assay",
          "verificationDepth": "methods-checked",
          "accessSurface": "author-manuscript XML",
          "boundary": "Kit protocol not opened."
        }
      ]
    }
  ]
}
```

Each promoted claim/field/edge must carry or derive:

- `sourceRecordId`;
- `reviewEventId`;
- `scopeId`;
- exact opened `sourceUrl`;
- pinned `sourceVersion`;
- reviewer and date;
- scope-specific `verificationDepth`;
- scope-specific boundary;
- support mode: `explicit | derived | analytical-inference | curated-guidance`;
- a short support note explaining the relationship between passage and claim.

Do not duplicate full review metadata in every field as an independent source of truth.
References resolve to one canonical review record. If denormalized display fields are kept,
validation must prove byte-for-byte agreement with the canonical record.

### Required review selection rule

When more than one review covers a scope, select deterministically by:

1. highest review-state rank;
2. deepest scope-specific verification depth;
3. most recent valid review date;
4. lexical stable id as the final tie-breaker.

Array order must never decide review state.

## 4. P0-B: fix graph provenance

In `lib/graph.mjs` and its validators/tests:

1. `reviewFrom()` must return the actual covering review record's URL and stable ids.
2. A promoted edge's `sourceUrl` must be that returned URL.
3. A figure-caption edge inherits `figures-legends-checked`, even when another scope in the
   same source reached methods depth.
4. A methods edge inherits methods depth only from the exact method scope.
5. The graph edge must not merely name a human-readable scope string; it must resolve a
   stable scope id in the named review event.
6. A missing, mistyped, unchecked or shallower scope fails the build.
7. The edge's source URL, version, reviewer, date, state and depth must all agree with the
   referenced event/scope.

Add a regression assertion for the shipped MDA graph edge: it must link to
`PMC7353921`, not to the unread 2025 recommendation DOI.

## 5. P0-C: make method-field evidence enforceable

Update `data/methods.json`, `scripts/validate-v09.mjs` and the public renderer so each
source-checked decision field references canonical review/scope ids.

Add mutation tests that reject all of these:

- unknown source record id;
- unknown review event id;
- unknown scope id;
- an unchecked route;
- an evidence field whose URL does not equal the opened source URL;
- reviewer/date/version mismatch;
- a field depth deeper than the referenced scope;
- a field marked explicit when the support note admits inference;
- a pending field that retains a published value;
- a checked field with no support note or boundary.

The validator cannot understand scientific semantics fully. Compensate by requiring a
support mode and a concise support note, then make the UI show them. This turns inference
into an inspectable claim instead of hiding it behind a citation.

## 6. P0-D: correct the three populated method modules

Re-open the exact source passages while editing. Do not rely on this handoff's paraphrases
as the source.

### Define the control axes first

Add a machine-readable or documented definition used consistently by all modules:

- `positiveControl`: a condition/reference expected to produce or verify the assay's
  positive signal;
- `negativeControl`: a matched condition/reference expected not to produce that signal;
- `processControl`: a control for extraction, loading, handling, acquisition or analytical
  performance;
- `orthogonalConfirmation`: a different measurement or perturbation that tests the same
  biological conclusion by another principle.

If one study did not provide a control of that type, leave the axis pending. Do not relabel
a nearby comparator to reach 13/13.

### `mda-4hne`

- Keep BHT and protein normalization as process controls supported by Zou Methods.
- Keep DMSO and ML210+Lip-1 as baseline/rescue comparators, but label their exact roles.
- Move the TBA/MDA specificity boundary to pending unless an opened authoritative source
  states it.
- Do not claim the Zou paragraph says TBARS detects a class of aldehydes; it does not.
- Keep the statement that the demonstrating study paired MDA with other readouts, without
  converting that observation into a universal requirement.

### `bodipy-c11-assay`

- H2-DCFDA is a parallel comparator/orthogonal specificity readout, not a process control.
- Narrow orthogonal-confirmation wording to what Fig. 5/results actually show.
- Retain Kagan's explicit peroxyl-radical/direct-hydroperoxide boundary.
- Retain vendor storage or spectral claims only where the opened vendor scope states them.
- Remove or demote compartment-redistribution language not established by a cited scope.
- Keep quantification, positive control, negative control and process control pending unless
  a read source establishes each one.

### `oxidized-pl-lcms`

- Kagan supports use of a pre-selected internal standard and per-class standard curve; do
  not say it was added before extraction unless a read passage says so.
- Do not attribute snap-freezing or antioxidant handling to Kagan. If Zou is added as a
  second demonstrating implementation, keep the two implementations distinguishable.
- Separate explicit use of PAF-AH/inclusion lists from analytical inference about their
  limitations.
- Classify SAPE-OOH as an analytical identity/reference standard unless the control
  definition genuinely supports calling it a positive control.
- Do not use the <15%/>15% class threshold as the assay negative control.
- Preserve the corrected Fig. 2, one-PE-class and LPCAT3-shRNA facts.

Recompute all checked/pending counts from data. Do not preserve 35/208 as a target.

## 7. P1-A: make independent review a real second event

An `independently-rechecked` event is valid only when it:

- references a prior review event id;
- uses a different reviewer id from both the prior event and the dataset owner;
- covers the same stable source version and at least one same scope id;
- records `agreement: agrees | partly-agrees | disagrees`;
- records a note for any discrepancy;
- never appears merely because a status string was edited.

Make paper sources, method routes and graph edges use the same vocabulary. Remove dead
status mappings that one validator accepts and another rejects.

Add negative tests for self-review, missing prior event, changed source version, no scope
overlap and array-order reversal. Do not create any real independently-rechecked event in
this round; Codex will perform that review later.

## 8. P1-B: repair manifest semantics

For every pending curated dataset:

- `reviewer: null`;
- `reviewPending: true`;
- `reviewedAt: null`;
- `reviewedContentSha256: null`.

If maintenance timing is useful, introduce `registeredAt` or `lastChangedAt`; do not call it
review time. Validators and mutation tests must reject pending records with `reviewedAt`
and reviewed records without reviewer, date and matching fingerprint.

Do not seal anything.

## 9. P1-C: make README state current and testable

Add a current release/status section for round 5. Correct misleading statements in the
historical sections. At minimum state:

- exact post-correction method checked/pending counts;
- exact graph counts by review state;
- 0 independent rechecks until Codex performs one;
- 0 sealed datasets;
- Kagan and Zou were read as accepted author manuscripts;
- captions were read, rendered figure panels and supplements were not;
- browser/accessibility QA remains pending;
- link reachability is not source-content validation;
- no first-party laboratory-site crawler exists yet.

Add a small documentation-consistency check so current README counts cannot drift from the
derived data. Avoid hard-coded corpus totals in behavioural tests where the expected count
can be derived from the fixture.

## 10. Public UI requirements

The public site remains English-first. In the paper, method and graph detail views, show:

- `Source checked` versus `Independently rechecked` distinctly;
- source type and version;
- exact reviewed scope label;
- scope-specific access depth;
- `explicit`, `derived`, `analytical inference` or `curated guidance`;
- a plain-English boundary;
- the actual opened source link.

Simple English is required. Chinese and Japanese remain terminology/search aliases only.
Do not expose internal reviewer implementation details as promotional copy.

## 11. Browser and accessibility gate

If an authorized HTTPS preview already exists, test desktop and 390 px width for:

- no horizontal overflow;
- method decision fields and long provenance blocks wrap correctly;
- keyboard-only opening/closing;
- Escape and close button;
- focus restoration;
- dialog accessible names;
- external link behaviour;
- zero console errors.

If no authorized HTTPS preview exists, leave this explicitly pending. Do not deploy merely
to manufacture a pass, and do not substitute MIME or DOM harness checks for browser QA.

## 12. Required tests

Before returning:

1. `npm run check` passes.
2. `npm run check:links` reports restricted separately and 0 unexplained broken links.
3. `git diff --check` passes.
4. Worktree is clean after coherent local commits.
5. Checked method fields resolve to canonical source/review/scope ids.
6. The MDA graph source regression test passes.
7. Caption claims do not inherit methods depth.
8. Independent-review spoof mutations fail.
9. Pending-manifest `reviewedAt` spoof mutations fail.
10. README derived counts match data.
11. No dataset is sealed.
12. No push, deployment or PR is created.

## 13. Deliverable

Create `DELIVERY_AUDIT_ROUND5.md` with:

- commits created;
- exact commands and results;
- before/after graph counts by state and scope-specific depth;
- before/after method-field counts by module;
- every demoted, narrowed, moved or newly supported method field;
- provenance schema migration table;
- source URL regression demonstration for MDA;
- independent-review mutation-test matrix;
- manifest semantics before/after;
- README consistency result;
- link-health result;
- browser QA matrix or explicit pending reason;
- every unresolved issue in plain language.

End by requesting independent Codex review. Do not claim delivery readiness.
