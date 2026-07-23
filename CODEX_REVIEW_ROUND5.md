# Codex independent review of Claude Code round 5

Date: 2026-07-24
Reviewed commit: `c3d6c8a`
Repository: `/Users/chenjingquan/Projects/ferroscope`
Decision: **round 5 is a substantial improvement, but it is not ready to seal or deliver**

## 1. Outcome first

Round 5 fixed the shipped MDA source link, reduced figure-caption edges from methods depth
to figure/legend depth, demoted two unsupported method fields, exposed support modes in the
UI, repaired pending-manifest dates and added useful mutation tests. I independently reran
`npm run check`; every check passes at `c3d6c8a`.

The new ids are not yet a canonical provenance system. The same source record and review
event are copied into several method modules and into the paper layer. Each copy can carry a
different scope set or even a forged source version while passing validation. The
independent-review event also does not resolve its claimed prior event, and the graph
promotes the route while still displaying the original implementer as the checker.

Round 6 must create one global source/review registry, remove the false total order between
different document surfaces, and finish the semantic support-mode audit before Codex signs
any real second review.

## 2. What I independently verified

- `npm run check` passes, including 20 method-review mutations, 32 graph-contract cases,
  17 manifest mutations and README-derived counts.
- The shipped graph remains 159 nodes / 192 edges, with review state 69
  `recorded-unverified`, 77 `archive-derived`, 46 `source-checked`, 0
  `independently-rechecked`.
- The method layer now reports 33/208 fields checked and 175 pending.
- The MDA `MEASURES` edges now link to PMC7353921, the source that was opened.
- 21 figure-caption edges now carry `figures-legends-checked`, not `methods-checked`.
- No dataset is sealed and the worktree was clean before this review document.
- The two NCBI XML files independently fetched by Codex have these exact byte pins:
  - PMC5506843: 140,459 bytes; SHA-256
    `647b73b571ea97af59d24483fd4cb3b3f16112ab2dea20849216b7c9334769aa`.
  - PMC7353921: 117,289 bytes; SHA-256
    `3165d84baf87d6798e3b76843f60e651c43c3979367d346be5929f021e4a7b6d`.

## 3. Blocking findings

### P0-1. Stable ids point to duplicated records, not one canonical record

`sourceRecordId` and `reviewEventId` are only unique inside one method module. The same ids
are embedded repeatedly:

- `zou2020-pmc7353921` / `claude-r4-zou2020` appears in both BODIPY and MDA, with different
  partial `reviewedScopes` arrays;
- `kagan2017-pmc5506843` / `claude-r4-kagan2017` appears in BODIPY and oxidized-PL LC-MS,
  again with different partial scope arrays;
- the paper layer separately embeds the same source yet another time.

This is not a canonical join. It is several mutable copies sharing a name.

Acceptance attack performed by Codex:

1. clone the shipped BODIPY module;
2. change the `zou2020-pmc7353921` `sourceVersion` to
   `FORGED-DIFFERENT-VERSION`;
3. run `validateMethodReview()`.

Result: `[]` — the forged copy passes. No cross-module or cross-file validator knows that a
different copy of the same id pins a different version.

Required fix: create one global source and review-event registry. Method modules, papers,
notices and graph inputs must reference it; none may embed a private copy of source URL,
version, reviewer, date or reviewed scope.

### P0-2. An independent recheck need not reference a real prior event

`validateIndependentReview()` checks only that `priorReviewEventId` is non-empty. It never
resolves the id or compares it with the original event.

Acceptance attack performed by Codex:

- set `priorReviewEventId` to `THIS-EVENT-DOES-NOT-EXIST`;
- keep a different reviewer, same source version, overlapping scope and agreement;
- call `validateIndependentReview()`.

Result: `[]`. The nonexistent prior review is accepted.

The independent event's own id is also not required to differ from the prior id.

Required fix: independent reviews must be first-class entries in the global registry. The
prior id must resolve; reviewer must differ from the prior reviewer and dataset owner; event
id must be unique and different; source id and pinned bytes/version must be identical;
covered scope ids must resolve and overlap; the recheck date cannot predate the prior event.

### P0-3. The graph promotes the recheck state but attributes it to the original reader

`routeReview()` maps `status: independently-rechecked` to the stronger graph state, but it
continues to copy `checkedAt`, `checkedBy`, `reviewerId` and scopes from the original route,
not from `independentReview`.

Acceptance attack performed by Codex:

- add a valid-looking independent event to the shipped Thermo Fisher route;
- build the graph;
- inspect the BODIPY `MEASURES` edge.

Result:

```json
{
  "reviewState": "independently-rechecked",
  "checkedBy": "Claude Code round-4 primary-source pass (implementer, not an independent reviewer)"
}
```

The edge claims independent review while naming the original implementer as the checker.

Required fix: graph promotion is scope-specific and event-specific. It must carry the
selected second event id, reviewer, date, agreement and boundary. `buildGraph()` must reject
an independent status whose event chain is invalid, even when called outside the full CLI
validation suite.

### P0-4. Verification “depth” still confuses document surface with ordinal depth

The vocabulary treats abstract, figure legends, methods, supplement and full text as one
ordered ladder. They are different surfaces, not necessarily deeper readings of each other.
Round 5 makes this visible:

- Results-section text scopes are labelled `methods-checked` because no Results surface
  exists in the vocabulary;
- a vendor catalogue page is labelled `full-text-rechecked`, a phrase that suggests a
  scientific full text;
- the UI therefore shows “Methods-checked” next to evidence read from a Results paragraph.

Per-scope ids fixed cross-scope leakage, but the label attached to several scopes is still
false.

Required fix: separate at least:

- `surfaceType`: metadata, abstract, results text, figure caption, rendered figure panel,
  methods text, supplement text/data, correction text, vendor description/specification/FAQ,
  full document, raw data;
- `accessExtent`: not opened, partial, complete for that named surface;
- `reviewState`: recorded/unverified, source-checked, independently-rechecked.

Do not rank Methods as universally deeper than a figure or Results section. An edge inherits
the exact surface and extent of its referenced scope. Source-level coverage is a set of
surfaces, not one maximum depth.

### P0-5. Several support modes still call interpretation “explicit”

Round 5 correctly introduced support modes, but the remaining labels need a clause-level
audit. The validator can only search a few words such as “inferred”; it cannot detect a
support note that says “classified here per the control-axis definitions.”

Minimum corrections:

| Field | Explicit source fact | Interpretation that must not be called explicit |
|---|---|---|
| `mda-4hne.readout` | kit, TBA addition, fluorescence | calling the measured species an MDA–TBA adduct |
| `mda-4hne.negativeControl` | DMSO / ML210 / ML210+Lip-1 conditions | classifying baseline and rescue as the negative-control axis |
| `mda-4hne.processControl` | BHT is added; signal is protein-normalized | BHT is added *to prevent ex-vivo oxidation*; classification as process control |
| `mda-4hne.compartmentResolution` | bulk homogenate workflow | no molecular-species or compartment resolution |
| `mda-4hne.orthogonalConfirmation` | the readouts appear together | they corroborate one another |
| `oxidized-pl-lcms.positiveControl` | SAPE-OOH preparation and identity reference | classifying it as the positive-control axis |
| `oxidized-pl-lcms.negativeControl` | Acsl4-KO reduces signal | classifying it as the assay negative control |
| `oxidized-pl-lcms.processControl` | internal-standard / standard-curve quantification | saying this controls analytical performance |
| `oxidized-pl-lcms.compartmentResolution` | whole-extract LC-MS and separate imaging | no compartment resolution; current evidence should cite the extraction/LC-MS scope |
| `bodipy-c11-assay.question` | emission shift under perturbation | “rather than an identified molecular species” as a method boundary |

These fields may remain `source-checked` if that state means the source was opened, but the
claim fragments must be labelled `derived`, `analytical-inference` or `curated-guidance` as
appropriate. A composite field needs clause/fragment-level support mapping; one evidence
mode for an entire multi-clause sentence is too coarse.

## 4. High-priority design findings

### P1-1. The paper and method review models still disagree

Only the two PMC paper sources received stable ids. Crossref, PubMed, notices and other paper
sources still fall back to URL identity. `validate-papers.mjs` does not validate structured
scope ids, surface type, extent or independent-event chains. Method routes use a different
schema. A research system should not have separate meanings of “source checked” depending
on which page displays it.

### P1-2. `buildGraph()` accepts an independent route with no independent event

The graph contract test itself fabricates `status: independently-rechecked` without an
`independentReview` event and expects graph promotion. The full v0.9 validator might catch a
shipped record, but the browser graph builder and any direct consumer do not enforce the
same contract.

Required fix: one shared validator/resolver is used by data validation, graph construction
and UI derivation.

### P1-3. Independent-review UI paths are incorrect

- `sourceRoutesHtml()` renders any status other than exactly `source-checked` as “not read,”
  including `independently-rechecked`.
- method evidence would show “Independently rechecked” but no second reviewer, date,
  agreement or discrepancy.
- `accessSurface` is stored but not shown in the evidence row.

No real recheck exists yet, so these are dormant defects. They must be fixed before Codex
adds the first one.

### P1-4. Source bytes are not pinned despite being available

Round 4 recorded accession and byte size but not content hash. Codex independently fetched
the same byte sizes and computed hashes in §2. Put these objective pins in the canonical
source registry so a “same version” comparison is enforceable rather than textual.

### P1-5. One validator has an inconsistent return type

`validateMethodReview()` returns an array directly if `decisionProfile` is absent, but
returns `{ problems, checked, pending }` otherwise. Current shipped modules all have the
profile, so tests miss this. Return one stable shape in every branch and add a mutation.

## 5. What remains correct

- The MDA source-link regression is fixed.
- Figure captions no longer borrow Methods depth from the same record.
- The two challenged fields were correctly demoted.
- The explicit Kagan and Zou procedural facts listed in `CODEX_REVIEW_ROUND4.md` remain
  supported by the independently fetched XML.
- README current counts are derived and no longer silently stale.
- Pending manifest entries no longer carry a fake review date.
- No data was sealed prematurely.

## 6. Independent decision

Do not seal any dataset at `c3d6c8a`. Do not add laboratories or papers yet. Execute the new
`HANDOFF.md` as round 6. After round 6, Codex can add a small real independent-review core
for the Kagan and Zou scopes that were actually re-read and byte-pinned.
