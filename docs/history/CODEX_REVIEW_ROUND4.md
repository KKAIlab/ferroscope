# Codex independent review of Claude Code round 4

Date: 2026-07-24  
Reviewed commit: `f2d64ca`  
Repository: `/Users/chenjingquan/Projects/ferroscope`  
Decision: **not ready to seal or deliver**

## 1. Outcome first

Round 4 made a real improvement: dates no longer promote records by themselves, two
author manuscripts and four correction notices were actually opened, three method modules
were populated from identifiable sources, the graph now distinguishes review state from
verification depth, and the complete automated suite passes.

That is not yet enough for a trustworthy research system. Independent inspection found a
more subtle class of defect: the software can prove that a citation-shaped object exists,
but it cannot yet prove that the cited source and scope support the sentence that received
the `source-checked` label. This is already producing incorrect provenance links, inflated
scope depth, and several method fields whose wording outruns the passages cited for them.

The correct next move is to reduce or relabel overclaimed fields and strengthen the
provenance contract before adding more laboratories, papers or methods. A lower checked
count after round 5 will be an improvement if it is the result of honest demotion.

## 2. What I independently verified

### Repository and tests

- `npm run check` passes at `f2d64ca`.
- `git diff --check` passes and the worktree was clean before this review document.
- The shipped graph contains 159 nodes and 192 edges.
- Graph review states are 69 `recorded-unverified`, 77 `archive-derived`, 46
  `source-checked`, and 0 `independently-rechecked`.
- The method layer reports 35 of 208 decision fields as `source-checked`.
- The accidental reconstruction of `lib/graph.mjs` did not change its bytes: current
  `lib/graph.mjs` is identical to the version committed at `91fc2a8`.

### Primary-source access

I independently fetched the NCBI XML for both manuscript records and inspected the exact
passages used by the new method fields:

- `PMC5506843.1` / NIHMS873824: Kagan et al., accepted author manuscript for
  `10.1038/nchembio.2238`.
- `PMC7353921.1` / NIHMS1603967: Zou et al., accepted author manuscript for
  `10.1038/s41589-020-0472-6`.

The manuscripts are not the publisher versions of record. The repository records that
boundary correctly.

The following round-4 corrections are supported by the accessible source text:

- the Kagan ACSL4 result belongs to Fig. 2, not Fig. 4;
- the final signature is four molecular species within one PE class, not four lipid
  classes;
- the LPCAT3 experiment is Cre-lox shRNA knockdown, not pharmacological inhibition;
- Kagan states that C11-BODIPY and LiperFluo both react with peroxyl radicals, while
  LiperFluo, but not C11-BODIPY, interacts with phospholipid hydroperoxides;
- Zou's flow implementation uses 5 micromolar BODIPY-C11 during the final 45 minutes of a
  90-minute ML210 treatment and a Sony SH800; the imaging implementation uses the final
  30 minutes of a 3-hour ML210 treatment and an Operetta;
- Zou's MDA method uses Abcam ab118970, BHT in lysis, 95 degrees C for 60 minutes,
  excitation/emission 532/553 nm and protein normalization;
- Zou Fig. 5 contains BODIPY-C11, H2-DCFDA, MDA and redox-lipidomics;
- the accessible Zou manuscript still contains the antibody information superseded by the
  2021 publisher correction, and the repository records that boundary.

## 3. Blocking findings

### P0-1. A checked graph edge can link to a source that was never opened

`reviewFrom()` copies reviewer, date, version and scope from the covering review record,
but it does not copy that record's `sourceUrl`. Callers set `sourceUrl` before spreading the
review result, so the edge keeps the module or claim's declared URL even when a different
source supplied the evidence.

Concrete shipped example:

- both `method:mda-4hne -> mechanism:*` `MEASURES` edges say they were checked at
  `Methods: Malondialdehyde (MDA) assay`, with the PMC author-manuscript version string;
- the clickable `sourceUrl` is nevertheless
  `https://doi.org/10.1038/s41580-025-00843-2`, the 2025 field recommendation that was not
  opened beyond its abstract;
- the actual opened source was `https://pmc.ncbi.nlm.nih.gov/articles/PMC7353921/`.

This is not cosmetic. It breaks traceability at the exact point where the graph claims to
provide it.

Required fix: a promoted edge must carry the URL and stable id of the exact covering review
record. Add a negative test in which a method's declared source differs from its
demonstrating source; the edge must link to the demonstrating source.

### P0-2. Verification depth leaks across unrelated scopes in one source record

The PMC source record stores one global `verificationDepth: "methods-checked"` and a flat
list containing abstract, results, figure captions and methods. Any edge whose `scopeRef`
matches any one item inherits `methods-checked`.

As a result, all Kagan and Zou figure-boundary edges render at methods depth even though the
record itself says that figure panels were not opened and only captions were read. This
contradicts the comments in `lib/graph.mjs` that promise selective, claim-level promotion.

Required fix: verification depth must belong to the reviewed scope, not only to the source
container. Use stable review-record ids and structured scope entries such as:

```json
{
  "id": "pmc7353921-xml-20260724",
  "sourceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7353921/",
  "sourceVersion": "PMC7353921.1 / NIHMS1603967",
  "reviewedScopes": [
    {
      "id": "fig-5-caption",
      "label": "Fig. 5",
      "verificationDepth": "figures-legends-checked",
      "accessSurface": "XML caption; rendered panel not opened",
      "boundary": "No panel pixels or supplement were inspected."
    },
    {
      "id": "methods-mda",
      "label": "Methods: Malondialdehyde (MDA) assay",
      "verificationDepth": "methods-checked",
      "accessSurface": "author-manuscript XML",
      "boundary": "The kit protocol was not opened."
    }
  ]
}
```

An edge must reference both the review record and one reviewed-scope id. It inherits the
scope's depth and boundary. A source-level maximum may be reported as a summary only; it
must not promote every scope to that maximum.

### P0-3. Method-field evidence is shape-checked, not source-route checked

`scripts/validate-v09.mjs` requires an HTTPS URL, date, reviewer and non-empty scope on each
checked field. It does not require that:

- the evidence URL matches a declared `sourceRoutes` record;
- that route is itself `source-checked`;
- the field's scope is contained in the route's reviewed scopes;
- reviewer, date and source version agree with the route;
- the cited passage explicitly supports the field or is labelled as an inference.

The graph has a scope containment test; the thirteen method decision fields do not. A fake
`https://example.org` field citation with a date, reviewer and arbitrary scope can satisfy
the current validator.

Required fix: method evidence must reference a stable route/review id plus a stable scope
id. Duplicated URL/date/reviewer strings must not be the join key. Add mutation tests for
unknown route id, unknown scope id, unchecked route, source-version mismatch and a scope
depth overrun.

### P0-4. Existing method fields demonstrate semantic overclaim

Automated validation passes all of the following, but independent source reading does not.

#### `mda-4hne.confounders`

The field says the TBA reaction detects a class of aldehydes, is not specific to MDA or
ferroptosis, and rises after several forms of oxidative injury. Its only cited scope is
Zou's MDA Methods paragraph. That paragraph describes the commercial kit workflow and BHT;
it does not make those specificity claims.

Action: demote the unsupported portion to pending, or add an authoritative source that
actually states the boundary. Keep only the BHT/process-handling statement attached to the
Zou method.

#### `bodipy-c11-assay.processControl`

Parallel H2-DCFDA is a comparator/orthogonal specificity readout, not a process control for
probe loading, acquisition, sample handling or assay performance.

Action: move it to orthogonal confirmation or a named comparator field. Leave process
control pending until a source specifies one.

#### `bodipy-c11-assay.orthogonalConfirmation`

The manuscript shows multiple readouts, but the sentence that all three were "required to
move together" is an editorial rule not stated by the paper.

Action: say only that the study paired these readouts, and separately state FerroScope's
curated recommendation as curated guidance rather than source-derived fact.

#### `bodipy-c11-assay.confounders`

Peroxyl-radical reactivity and lack of direct phospholipid-hydroperoxide detection are
supported by Kagan. Storage/light-handling claims may be supported by the vendor page.
"Can redistribute between compartments" was not established by the cited passages.

Action: split claims by source and demote/remove the unsupported clause.

#### `oxidized-pl-lcms.processControl`

The Kagan text supports ratiometric comparison to a pre-selected internal standard and
per-class standard curves. It does not state that the standard was added before extraction,
nor does the cited Kagan method say the material was snap-frozen or handled with
antioxidants. Snap-freezing and named internal standards occur in Zou's redox-lipidomics
method, not in the cited Kagan scopes.

Action: narrow this field to what Kagan states, or add Zou as a separate demonstrating
route and keep the implementations distinct.

#### `oxidized-pl-lcms.confounders`

Kagan explicitly uses PAF-AH and targeted inclusion lists. The current wording turns those
procedural facts into broader method limitations and adds ex-vivo autoxidation/antioxidant
handling that the cited Kagan passages do not state.

Action: label explicit procedural facts separately from reasonable analytical inference;
demote source-uncovered statements.

#### `oxidized-pl-lcms.negativeControl` and `.positiveControl`

The current entries mix biological comparator, unsupervised class label, non-oxidized
precursor and analytical structural reference. These are useful, but they are different
control types. A <15% versus >15% cell-death threshold is not itself an assay negative
control, and SAPE-OOH is an identity/reference standard rather than a biological positive
control.

Action: define the control axes before populating them. Do not force any convenient
comparator into a thirteen-axis slot merely to reach 13/13.

## 4. High-priority design findings

### P1-1. `independently-rechecked` is a label, not yet a provable second review

`checkReviewRecord()` imposes the same fields on `source-checked` and
`independently-rechecked`. It does not require a prior review, a different reviewer, the
same source version, or an explicit link to the review being reproduced. A single person
could currently write `independently-rechecked` directly.

Method-route validation also rejects `independently-rechecked` even though the graph maps
that status. The schemas disagree.

Required fix: model review events separately. Independent recheck requires a prior review
id, a different reviewer id, a pinned source version, an overlapping scope id and an
explicit agreement/disagreement outcome. Add negative tests for self-review, missing prior
review and changed source version.

### P1-2. Pending manifest entries carry a misleading `reviewedAt`

All curated datasets remain unsealed, correctly. However, the manifest entries say
`reviewPending: true`, `reviewer: null`, `reviewedContentSha256: null` while still carrying
`reviewedAt: "2026-07-23"`. A field named `reviewedAt` must not be populated when no review
occurred.

Required fix: pending entries use `reviewedAt: null`; add `lastChangedAt` or
`registeredAt` if a maintenance date is needed. Mutation tests must reject a pending entry
with `reviewedAt` and a reviewed entry without a fingerprint.

### P1-3. README is no longer a reliable description of the current release

The first/current section still says all 208 method fields are pending and describes the
round-3 graph vocabulary. Later it calls 11 archive rewrites "source-checked reading
records". These statements conflict with the current data and with the round-4 review
model.

Required fix: add a current v0.9.4 status section generated or asserted against live counts,
and correct historical language that would now mislead a reader. State prominently:

- 35/208 is the pre-round-5 claimed count and will change after semantic correction;
- 0 datasets are sealed;
- 0 scopes are independently rechecked;
- two papers were read from accepted author manuscripts, not publisher versions;
- rendered figure panels and supplements remain unread;
- browser/accessibility QA remains pending.

### P1-4. Review selection ignores review state when depths tie

`reviewCovering()` sorts covering records only by verification depth. If a source-checked
and an independently rechecked record cover the same scope at equal depth, array order can
select the weaker state.

Required fix: select first by review-state rank, then by scope-specific depth, then by a
deterministic review date/id rule. Add an order-reversal test.

## 5. Remaining non-blocking gaps

- Authorized HTTPS desktop/mobile browser and accessibility QA has not been performed.
- No dataset is sealed, which is correct until the defects above are repaired and a second
  reviewer checks final bytes.
- Hard-coded graph totals in tests will make normal corpus growth look like a regression.
  Derive expected counts from input fixtures except where a fixed seed corpus is the thing
  being tested.
- Link health is reachability, not content validation. Continue rendering that distinction.
- The site still has no first-party lab-site crawler; author queries and link checks do not
  amount to lab-dynamics monitoring.

## 6. Independent decision

Do not seal `methods.json`, `papers-en.json`, `paper-claims.json`,
`knowledge-network.json`, `evidence-bundles.json`, `historical-link-overlays.json` or the
manifest at this commit. Do not expand the corpus yet. Execute `HANDOFF.md` as round 5,
then return for a second Codex review.

