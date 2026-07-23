# FerroScope round-6 handoff: one source registry, real review events, exact access surfaces

Date: 2026-07-24
Base commit: `c3d6c8a`
Read first: `CODEX_REVIEW_ROUND5.md`
Do not push, deploy, open a PR, seal a dataset, or create a real independent recheck.

## 1. Mission

Round 5 added stable-looking ids inside each method module. Round 6 must make them genuinely
canonical:

> One source has one source record. One reading has one review event. Every paper, method,
> notice, graph edge and UI statement resolves those same objects instead of embedding a
> private copy.

Also replace the false linear “verification depth” ladder with exact document surfaces and
access extent, and finish the clause-level support-mode audit.

Do not expand the corpus. A correct small core is the prerequisite for scaling.

## 2. P0-A: create a global canonical source/review registry

Add a curated dataset such as `data/source-reviews.json`, registered in the manifest. Its
exact layout may vary, but it must normalize three object types.

### Source record

```json
{
  "id": "pmc7353921",
  "documentClass": "accepted-author-manuscript",
  "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7353921/",
  "identifiers": {
    "pmcid": "PMC7353921",
    "doi": "10.1038/s41589-020-0472-6"
  },
  "version": {
    "label": "PMC7353921.1 / NIHMS1603967",
    "retrievedAt": "2026-07-24",
    "byteLength": 117289,
    "sha256": "3165d84baf87d6798e3b76843f60e651c43c3979367d346be5929f021e4a7b6d"
  }
}
```

Also pin PMC5506843:

- byte length 140,459;
- SHA-256 `647b73b571ea97af59d24483fd4cb3b3f16112ab2dea20849216b7c9334769aa`.

These hashes were computed by Codex from independent NCBI E-utilities XML fetches. Recording
the objective bytes does not authorize Claude Code to mark an independent scientific review.

### Reviewed scope

A scope is stable within one source and describes what surface was opened:

```json
{
  "id": "methods-mda",
  "label": "Methods: Malondialdehyde (MDA) assay",
  "surfaceType": "methods-text",
  "accessExtent": "complete-scope",
  "locator": "article/body/... or section title",
  "boundary": "The commercial kit SOP and rendered figure panels were not opened."
}
```

Use a controlled `surfaceType` vocabulary that covers at least:

- `metadata-record`;
- `abstract-text`;
- `results-text`;
- `figure-caption`;
- `figure-panel`;
- `methods-text`;
- `supplement-text`;
- `supplement-data`;
- `correction-text`;
- `vendor-description`;
- `vendor-specifications`;
- `vendor-faq`;
- `full-document`;
- `raw-data`.

Use `accessExtent: not-opened | partial-scope | complete-scope`. The exact surface plus
extent replaces the misleading total order between Methods, Results and figures.

### Review event

```json
{
  "id": "claude-r4-zou2020",
  "sourceId": "pmc7353921",
  "reviewState": "source-checked",
  "reviewerId": "claude-code-round4-implementer",
  "checkedAt": "2026-07-24",
  "scopeIds": ["methods-mda", "methods-flow", "fig-5-caption"],
  "boundary": "Accepted manuscript XML; rendered panels and supplements not opened."
}
```

Move, do not copy, source URL/version, review metadata and scopes out of:

- `data/methods.json`;
- `data/papers-en.json` verification source copies;
- notice review copies where practical.

Those files may store route purpose or paper/source relations, but must reference canonical
`sourceId` and `reviewEventId`. No duplicated record with the same id is allowed anywhere.

## 3. P0-B: make independent review a resolvable second event

An independent review is another entry in the same event collection, not a nested status
object on a route. It must contain:

- unique event id;
- `priorReviewEventId` that resolves to a real event;
- same canonical source id and exact source hash/version as the prior event;
- different reviewer from the prior reviewer and dataset owner;
- non-empty overlapping scope ids that resolve in that source;
- date not earlier than the prior event;
- `agreement: agrees | partly-agrees | disagrees`;
- discrepancy note when not fully agreeing.

The independent state applies only to the scopes the second event actually covered.

Add mutation tests that reject:

- nonexistent prior id, including a non-empty fake string;
- event id equal to prior id;
- duplicate event id;
- changed source id;
- changed hash/version;
- same reviewer;
- owner reviewer;
- no scope overlap;
- unknown scope id;
- earlier review date;
- missing agreement;
- partial/disagreement with no note.

Do not create a real independent event. Codex will do so after this implementation is
reviewed.

## 4. P0-C: one shared resolver for validator, graph and UI

Build one library that loads/resolves canonical sources, scopes and events. Use it in:

- `validate-v09.mjs` / paper validation;
- `buildGraph()`;
- method-field validation;
- public UI derivation;
- mutation tests.

`buildGraph()` must reject an invalid independent chain even when called directly. Remove
the existing graph test that fabricates `independently-rechecked` with no second event.

A promoted edge must carry:

- canonical source id and actual opened URL;
- selected review event id;
- selected reviewer id/name and date;
- scope id, surface type, access extent and boundary;
- agreement/discrepancy if independently rechecked;
- support mode where applicable.

Selection is by valid review state, coverage and date. Do not compare Methods, Results and
figure captions on a fake ordinal depth scale.

## 5. P0-D: migrate all source types, not only the two PMC records

Assign stable ids and canonical registry entries to every source used by the paper/method
graph core, including:

- Crossref records;
- PubMed records;
- publisher correction notices;
- publisher full-text routes even when not opened;
- Thermo Fisher D3861;
- the 2025 field recommendation;
- PMC5506843 and PMC7353921.

Unchecked routes point to a source record but no checked event/scope. A URL is never a
fallback review-event id.

Add cross-file uniqueness tests and the exact acceptance attack from the review:

- changing one consumer's supposed source version must be impossible because consumers no
  longer store a version;
- introducing a second source with an existing id but different bytes/URL must fail.

## 6. P0-E: finish clause-level support mapping

A field value can contain several claims. Add `claimFragment` (or an equivalent atomic
support mapping) to each evidence item, so the UI shows which clause is explicit, derived,
analytical inference or curated guidance.

Correct at least the fields listed in `CODEX_REVIEW_ROUND5.md` §3 P0-5:

- MDA readout, negative control, process control, compartment resolution and orthogonal
  confirmation;
- oxidized-PL LC-MS positive control, negative control, process control, compartment
  resolution and orthogonal confirmation;
- BODIPY question/boundary.

For `oxidized-pl-lcms.compartmentResolution`, cite the whole-extract/LC-MS preparation scope
for the absence of spatial resolution; the separate LiperFluo imaging scopes establish only
where the paper obtained its ER localisation.

The validator must require a non-empty claim fragment. It cannot prove semantics, but it can
prevent one vague evidence row from appearing to cover a multi-clause paragraph. Add tests
for missing fragments and duplicate/empty mappings.

Source-checked field counts do not need to fall merely because one fragment is derived; the
public UI must make the difference unmistakable.

## 7. P1-A: public UI must render the real event

For every evidence row show simple English:

- claim fragment;
- support mode;
- exact surface, e.g. “Results section text checked” or “Figure caption checked”;
- access extent;
- source document class/version;
- reviewer/date for the selected event;
- boundary;
- actual opened link.

For a future independent recheck, show the second reviewer, date, agreement and discrepancy.
Never render it as “not read.” Show vendor pages as vendor pages; do not call them
“full-text-rechecked.”

Chinese and Japanese remain terminology/search aliases only.

## 8. P1-B: fix validator edge cases

- `validateMethodReview()` returns one stable object shape in every branch, including a
  missing `decisionProfile`.
- validate every structured scope even when no current edge references it.
- validate globally unique source, scope-within-source and event ids.
- require every checked paper/method/notice reference to resolve through the registry.
- remove dead fallback identity and incompatible status vocabularies.

## 9. P1-C: update documentation and counts

Update README and the current audit language to describe:

- canonical global source registry;
- exact surface coverage instead of one maximum verification depth;
- objective hashes for the two PMC XMLs;
- 0 independent reviews and 0 sealed datasets;
- browser QA still pending if no authorized HTTPS preview exists.

Make README current counts derive from data. Report graph coverage by surface type and review
state rather than by the retired depth ladder.

## 10. Browser and accessibility gate

If no authorized HTTPS preview exists, keep this pending and do not deploy. DOM tests must
cover the new claim-fragment, surface, event reviewer/date, boundary and source-link
elements, but must not be called browser QA.

## 11. Required acceptance tests

1. `npm run check` passes.
2. `npm run check:links` reports restricted separately and 0 unexplained failures.
3. `git diff --check` passes and worktree is clean after coherent local commits.
4. One canonical record exists for each source id.
5. No consumer embeds source URL/version/reviewer/date/scope copies as authority.
6. The forged duplicate-version attack fails.
7. The nonexistent-prior-event attack fails.
8. Graph independent state names the independent reviewer, not the original implementer.
9. Results evidence never renders “Methods-checked.”
10. Vendor evidence never renders “full-text-rechecked.”
11. Every checked method evidence row has a claim fragment and support mode.
12. No real independent event and no dataset seal is created.
13. No push, deployment or PR is created.

## 12. Deliverable

Create `DELIVERY_AUDIT_ROUND6.md` containing:

- commits and exact commands/results;
- source-registry schema and migration table;
- canonical source/event/scope counts;
- cross-file duplicate elimination evidence;
- source hashes and access surfaces;
- independent-event mutation matrix, including nonexistent prior id;
- graph reviewer-propagation regression;
- support-fragment corrections by method field;
- public UI assertions;
- method and graph counts;
- link health;
- browser QA matrix or explicit pending reason;
- every unresolved issue.

End with a clean local worktree and request independent Codex review. Do not claim delivery
readiness.
