# Delivery Audit · Round 8 (Claude Code — content migration, self-audited)

Date: 2026-07-24
Repository: `/Users/chenjingquan/Projects/ferroscope`, branch `main`
Implemented by: Claude Code. Independently re-audited by a spawned adversarial agent
(`.claude/agents/provenance-auditor.md`), because the implementer may not sign its own work.
Nothing pushed, deployed, sealed, or turned into a real independent recheck.

This round executes the strategic recommendation of `DELIVERY_AUDIT_ROUND7.md` §6: freeze the
provenance contract (now correct for the honest-report threat and regression-locked) and spend
the effort on **content** — the actual "10× learning" mission that had not moved since round 1.

## 1. What the batch did

The English-first layer `data/papers-en.json` held only **11** papers, while the legacy audited
archive `data/lab-research.json` held **69** figure-audited papers (the "Build English-first"
migration had done 1/6 and stopped). This batch surfaces **8** more into the English layer,
taking it from **11 → 19**.

| # | Paper | Journal / year | Attributed lab | Role |
|---|-------|----------------|----------------|------|
| 1 | Identification of essential sites of lipid peroxidation in ferroptosis | Nat Chem Biol 2023 | stockwell-columbia | lead |
| 2 | ALDH2/eIF3E Interaction Modulates Protein Translation … Cardiomyocyte Ferroptosis | Circulation 2026 | yin-cityu | lead |
| 3 | Targeting FSP1 triggers ferroptosis in lung cancer | Nature 2026 | papagiannakopoulos-nyu | lead |
| 4 | Lymph node environment drives FSP1 targetability in metastasizing melanoma | Nature 2026 | ubellacker-harvard | lead |
| 5 | Lysosomal lipid peroxidation … via lysosomal membrane permeabilization | Nat Commun 2025 | yamada-kyushu | lead |
| 6 | FSP1-mediated lipid droplet quality control prevents neutral lipid peroxidation … | Nat Cell Biol 2025 | olzmann-berkeley / fedorova-dresden | lead / co-lead |
| 7 | RPE-specific ablation of GPx4 in adult mice recapitulates … geographic atrophy | Cell Death Dis 2024 | imai-kitasato | contributing-author |
| 8 | PRDX6 dictates ferroptosis sensitivity by directing cellular selenium utilization | Mol Cell 2024 | mishima-tohoku | co-lead |

Selection rule: the 8 highest-value **figure-audited** papers remaining (richest legacy content),
2023–2026, high-impact journals. Assembly is a deterministic, idempotent script
(`scripts/migrate-round8.mjs`) driven by hand-authored English specs (`scripts/round8-specs.mjs`);
the migration aborts if a spec's title is not byte-identical to the legacy archive title.

## 2. Why the migration is honest by construction

The point of the round-4→7 work was that the system must never show a review depth nobody earned.
Content migration is where that is easiest to violate, so each new paper enters at the honest floor:

- **Figure claims stay archive-derived.** Each paper's figure chain is translated from this
  project's own audited archive and enters at `verificationDepth: archive-derived`. Its
  `figureAudit` entries carry **no `scopeRef`**, so every one of the **46** new figure `BOUNDED_BY`
  edges resolves to the paper's unverified baseline — `archive-derived`, not `source-checked`.
  A migration date records when the rewrite happened, not that the PDF was reopened.
- **Only the metadata spine is source-checked, because only it was re-verified.** Each paper's
  bibliographic metadata was re-queried **live at Crossref on 2026-07-24**. That is the one thing
  marked `source-checked` (a `crossref-metadata-record` source at `metadata-checked` depth); the
  publisher full text is recorded as declared-but-not-opened (`recorded-unverified`). The **9** new
  `CONTRIBUTED_TO` attribution edges are `source-checked` at metadata depth on that basis — an
  honest claim, since authorship is exactly what a Crossref record settles.
- **The re-verification corrected the archive's attribution guesses.** Reading the ordered Crossref
  author list changed three role assignments away from a naive "lead": **Imai** is author 5 of 10
  on the RPE paper (a middle author) → `contributing-author`, not lead; **Mishima** is author 24 of
  25 on PRDX6 (second-to-last, co-senior with last-author Conrad) → `co-lead`; and
  **Papagiannakopoulos** was confirmed as the true last author (20 of 20) on the FSP1-lung paper.
  This is the integrity discipline paying for itself on content: the check that prevents a forged
  review also catches a mis-stated authorship.
- **Two 2026 Nature papers carry a documented online/issue year split** (Crossref online 2025,
  issue 2026, both in vol 649 issue 8096). The record uses the issue year 2026 to stay consistent
  with the legacy archive, and each `crossrefFinding` states both — the same treatment given the
  Kagan 2016/2017 case, not a silent pick.

## 3. The self-audit gate found two holes; the critical one is fixed structurally

The spawned auditor ran the round-8 delta against the playbook and its own fresh attacks. It
confirmed invariants (all 46 figure edges archive-derived; only the 9 attribution edges
source-checked at metadata depth; 0 independently-rechecked repo-wide), independently re-queried
Crossref for 4 of the 8 papers and found no factual drift, and confirmed no CJK or overclaim
leaked into the English surface. It found two holes:

- **HOLE-1 (critical, structural forgery — was count-gated). FIXED.** A `crossref-metadata-record`
  source could be given a scope that merely *declares* `surfaceType: "figure-caption"` with a
  label like "Fig. 1"; a migrated paper's `figureAudit[i].scopeRef` pointing at it would promote
  that figure's `BOUNDED_BY` edge to **`source-checked` at `figures-legends-checked` depth**,
  backed only by Crossref metadata no reader opened. The edge-level content-surface allowlist
  (round 7) trusts the scope's self-declared `surfaceType`, and nothing bound that `surfaceType`
  to the source's `documentClass`. Only `check:readme` tripped, on the count bump — the exact
  count-gated weakness the project spent round 4 eliminating elsewhere. **Fix:** `lib/source-registry.mjs`
  now carries `DOCUMENT_CLASS_SURFACES`, and `validateRegistry` rejects any scope whose
  `surfaceType` is inconsistent with the source's `documentClass` (a metadata, notice or vendor
  record may not expose an experimental content surface). The forgery now throws in
  `validateRegistry`/`buildGraph` before any count. Regression-locked in
  `scripts/test-registry-hardening.mjs` (now **19** cases): the figure-caption-on-metadata scope
  is rejected, and the real registry still validates clean so the constraint does not over-reach.
- **HOLE-2 (minor, curated-judgment trust boundary). DOCUMENTED, not a forgery.** The seniority
  label `lead`/`co-lead`/`contributing-author` in `lab-paper-links.json` is not machine-checked
  against the Crossref author position, because the registry stores no per-author ordinal position
  to check against. The **delivered data is honest** — every role was set from the ordered Crossref
  list and the three corrections above are documented — so this is the same class as the round-7
  method-2a residual: the validator proves the author list was read, not that the human's
  role label is the right seniority word. All three roles map to the same `source-checked`
  `CONTRIBUTED_TO` edge, so a dishonest label would forge a seniority claim, not a review state.
  Recorded here as a trust boundary (§5); closing it structurally needs the data model to store
  each attributed PI's author index, which is a follow-up, not this batch.

Independent re-audit verdict (spawned auditor, verification pass after the HOLE-1 fix,
`AUDIT: 0 holes (0 critical)`): the auditor re-ran its exact HOLE-1 attack and confirmed it now
throws inside `validateRegistry`/`buildGraph` at construction (*"a crossref-metadata-record source
cannot expose a 'figure-caption' surface"*) — regenerating the README count to `source-checked 56`
leaves the full suite **red**, so the count-gate is gone. It confirmed no over-reach (the real
registry still validates clean; `pubmed-record` keeps its abstract scope, author manuscripts keep
their content scopes). It then tried two fresh bypasses and found both closed by other layers,
count-independently: mislabelling the forged scope as `metadata-record` throws at the edge contract
(*"metadata-record … reports no experiment"*), and routing the figure through a fabricated
`pubmed-record` `abstract-text` scope throws at `check:graph-contract` (a `Fig. N` scopeRef must
inherit `figures-legends-checked`, not `abstract-checked`). The only remaining route to a
source-checked figure edge is a genuine figure-surface scope on a real primary document — i.e.
actually opening the figures. HOLE-2 is agreed as a documented trust boundary, not an active
forgery. Repo confirmed pristine; full `npm run check` green.

## 4. Verification

`npm run check` passes all **14** sub-checks from the working tree. New/changed counts, all
derived from the data and enforced by `check:readme`:

- `data/papers-en.json`: **19** English paper records (17 archive-derived, 2 methods-checked);
  24 laboratory attribution records across 20 laboratories.
- Provenance graph: **213 nodes and 247 edges**. Review state: recorded-unverified 69,
  archive-derived 123, source-checked 55, independently-rechecked 0.
- `data/source-reviews.json`: **61** canonical source records, **38** review events (8 new
  `ingest-crossref-*` source-checked metadata events; 0 new independent events).
- `scripts/test-registry-hardening.mjs`: **19** regression cases (was 17; HOLE-1 added).

## 5. Known limitations and not-done

- **Attribution seniority is curated-judgment trust (HOLE-2).** As above: role labels are honest
  and Crossref-verified in the delivered data, but not machine-bound to the author position.
- **Figure-level content remains archive-derived.** No migrated figure was reopened; the figure
  chain is a faithful English rewrite of the legacy audit. Turning any of these into a real
  `source-checked` figure reading requires opening the paper and adding a registry event — future
  work, and an independent recheck remains the independent reviewer's act.
- **41 of the backlog remain.** 6 more figure-audited classics (2019–2023) and ~44 evidence-audited
  papers are still only in the legacy layer. This batch is the first of several; run the auditor
  once per batch as the gate, as done here.
- **Unchanged from round 7.** Authorized browser and accessibility QA — still no authorized preview.

## 6. Recommendation for the next batch

Continue the content pivot: migrate the remaining 6 figure-audited papers next (same honest
recipe), then move to the evidence-audited backlog, and only then consider widening the mechanism
graph and terminology corpus (the other three axes the user named). Keep the per-batch auditor gate
— this batch is the proof it earns its cost: it caught a critical count-gated forgery path that the
14-step suite passed green, and a mis-statable attribution, on a round that only added data.
