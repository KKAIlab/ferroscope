# Recipe — migrating a paper at the bibliographic level

Round 11 introduced a second, shallower way to bring a paper into the English layer. This
file is the reusable version of it, written down so the next pass reproduces the tier
instead of re-deriving it from the round-11 scripts and arriving somewhere slightly
different. If you are about to add a paper that this project has not figure-audited, read
this first.

## The two tiers, and how to choose

| | Archive-derived migration (rounds 6, 8–10) | Bibliographic migration (round 11+) |
|---|---|---|
| Precondition | The paper is in the project's figure-audit archive (`data/lab-research.json`) with a figure chain | The paper is **not** in the archive; no figure chain exists |
| `readingDepth` | `figure-chain` | `abstract` |
| `verificationDepth` | `archive-derived` (or deeper, e.g. `methods-checked`) | `metadata-checked` — the ceiling |
| `figureAudit` | Required, ≥ 4 figures | **Absent** |
| `verification.baselineReviewState` | `archive-derived` | `recorded-unverified` |
| What was actually source-checked | The archive's figure-level reading, plus the Crossref spine | **Only** the Crossref spine, re-queried live in the pass |
| Can carry a paper claim in `paper-claims.json`? | Yes | **No** — see the guard below |
| Reference implementation | `scripts/migrate-round9.mjs` + `round9-specs.mjs` | `scripts/migrate-round11.mjs` + `round11-specs.mjs` |

Choose the bibliographic tier when the graph needs a **named, real anchor** for a
mechanism that currently rests on an unsourced assertion, and nobody is going to audit the
figures in this pass. It buys provenance, not depth. It does not buy the right to say
anything about what the paper's figures show.

The honest framing to keep in your head: *we verified this paper exists and is what we say
it is; we did not open its figures.* Everything in the tier follows from that sentence.

## Procedure

1. **Write the spec** (`scripts/roundNN-specs.mjs`). One entry per paper: `doi`, `title`,
   `journal`, `year`, `citation`, `theme`, `crossrefFinding`, `conditionVector`,
   `sixtySecond` (the five fields), `labs`.
   - `crossrefFinding` must state what the Crossref query settled **and** end with the
     limit — that it establishes nothing about figures, methods or quantitative claims.
   - `conditionVector` and `sixtySecond` are abstract-level summaries of the public
     record. Do not write anything that could only be known from a figure panel.
2. **Verify the spine live.** Query `https://api.crossref.org/works/<doi>` in this pass and
   record what it actually returned: title, journal, volume/issue/pages, issued date,
   author count, first and last author. Do not copy a previous round's finding.
3. **Verify every lab role against the live author list.** `role` must be the tracked
   laboratory's real position:
   - `lead` — last/senior author, and the work was done in that lab;
   - `co-lead` — second-to-last or joint senior position;
   - `contributing-author` — a middle position; say which (`author 15 of 17`);
   - `pre-independence` — first author before their own lab existed.
   `roleBasis` must **name the evidence** (author position, verified date), not assert the
   role. `validate-papers.mjs` enforces that it mentions author/corresponding/contribution.
   If the senior author runs no lab this project tracks, record only the tracked lab's real
   position. Do **not** invent a `lead` to fill the slot.
4. **Run the migration** (`scripts/migrate-roundNN.mjs`, modelled on round 11). It writes
   two registry sources per paper — the Crossref record (`source-checked`, scoped) and the
   version-of-record full text (`recorded-unverified`, `scopes: []`, `reviewEventId: null`)
   — plus one review event for the Crossref reading only, the paper record, and the lab
   links. Keep it idempotent: skip a DOI already in `papers-en.json`.
5. **Anchor the mechanism edge** (`scripts/expand-roundNN.mjs`), if that was the point.
6. **Run `npm run check`.** All of it, not the subset you think is relevant.

## Why no validator changes were needed — and the one that was

Round 11 needed almost no new validation, because the existing rules already degrade
correctly for a paper with no archive record:

- `validate-papers.mjs` skips the title-identity comparison for a paper absent from the
  legacy archive (there is nothing to compare against), and skips the `archive-rewrite`
  derivation requirement when the baseline is not `archive-derived`.
- `validate-papers.mjs` caps `verificationDepth` at the deepest source actually read, so
  `metadata-checked` is the natural ceiling — no special case required.

One exemption **was** required, in `scripts/validate-graph.mjs`:

```js
if (paper.readingDepth === "abstract") continue;   // before the BOUNDED_BY requirement
```

A figure-chain paper must contribute at least one evidence-boundary node. A bibliographic
paper legitimately has none — its figures were never opened, so fabricating a boundary
would be exactly the dishonesty this project exists to prevent. Its limit is enforced
elsewhere instead: the `metadata-checked` depth, the `recorded-unverified` baseline, and
the fact that a paper claim citing it fails the audited-figure check further up the same
file.

## The constraints that are not optional

- **No `figureAudit`.** Not an empty array with a note — absent.
- **`verificationDepth: "metadata-checked"`.** Never deeper. If someone later reads the
  figures, that is a new review event and a tier change, not an edit to this field.
- **`baselineReviewState: "recorded-unverified"`** with a `baselineBoundary` that says in
  plain words that only the metadata spine was checked.
- **The version-of-record source stays unread.** `scopes: []`, no review event. A review
  event attached to a document nobody opened is a forgery, and
  `validate-coherence.mjs` rejects it.
- **The edge that cites it must disclose its depth.** This is the honesty contract in
  `docs/HONESTY-CONTRACTS.md` §1 — read it before adding the edge, because the failure it
  guards against was live in the codebase for a full round.
- **Declare the gap.** A new abstract-only-anchored edge must be added to
  `ACKNOWLEDGED_GAPS.edgesAnchoredOnlyOnAbstracts` in `scripts/validate-coherence.mjs`, or
  the check fails. That is deliberate: widening the corpus's silence must be an explicit
  act.

## Cost

Round 11 migrated three papers (Dixon 2012 system xc-, Kraft 2020 GCH1-BH4, Freitas 2024
7-DHC) and added three mechanism nodes and three anchored edges. Papers 25 → 28, mechanisms
14 → 17, edges 20 → 23, registry 79 sources / 47 events.
