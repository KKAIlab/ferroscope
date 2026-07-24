# Delivery Audit · Round 9 (Claude Code — content migration, self-audited)

Date: 2026-07-24
Repository: `/Users/chenjingquan/Projects/ferroscope`, branch `main`
Implemented by: Claude Code. Independently re-audited by the spawned adversarial agent
(`.claude/agents/provenance-auditor.md`). Nothing pushed until the gate is clean; nothing sealed
or turned into a real independent recheck.

Round 9 continues the content pivot begun in round 8 (see `DELIVERY_AUDIT_ROUND8.md`): it migrates
the **remaining 6 figure-audited** backlog papers into the English-first layer, taking
`data/papers-en.json` from **19 → 25**. With this, the entire figure-audited backlog (14 papers)
is now in the English layer; the ~44 evidence-audited papers remain for future batches.

## 1. What the batch did

| # | Paper | Journal / year | Attributed lab | Role |
|---|-------|----------------|----------------|------|
| 1 | Ferroptosis surveillance independent of GPX4 and differentially regulated by sex hormones | Cell 2023 | jiang-msk | lead |
| 2 | Exogenous Monounsaturated Fatty Acids Promote a Ferroptosis-Resistant Cell State | Cell Chem Biol 2019 | dixon-stanford | lead |
| 3 | Role of Mitochondria in Ferroptosis | Mol Cell 2019 | gao-hit | pre-independence |
| 4 | CD8+ T cells regulate tumour ferroptosis during cancer immunotherapy | Nature 2019 | zoulab-michigan | lead |
| 5 | On the Mechanism of Cytoprotection by Ferrostatin-1 and Liproxstatin-1 … | ACS Cent Sci 2017 | pratt-ottawa | lead |
| 6 | Fluorescence probes to detect lipid-derived radicals | Nat Chem Biol 2016 | yamada-kyushu | co-lead |

Same deterministic, idempotent assembly as round 8 (`scripts/migrate-round9.mjs` +
`scripts/round9-specs.mjs`); aborts on any legacy-title mismatch.

## 2. Honest by construction (unchanged recipe)

- **Figure claims stay archive-derived.** Each figure chain is a faithful English rewrite of the
  legacy audit, entered at `verificationDepth: archive-derived` with no `scopeRef`, so all **34**
  new figure `BOUNDED_BY` edges are `archive-derived` — no `source-checked` figure claim.
- **Only the metadata spine is source-checked.** Each paper's Crossref bibliographic metadata was
  re-queried live on 2026-07-24; that is the one `source-checked` fact, promoting the **6** new
  attribution edges at `metadata-checked` depth.
- **Two attributions the archive would have mis-stated as lead were corrected by reading the
  Crossref author order:**
  - *"Role of Mitochondria in Ferroptosis"* — Minghui Gao is the **first** author, senior/last
    author Xuejun Jiang; the work predates Gao's independent HIT laboratory → **pre-independence**,
    the same honest treatment the round-8/earlier work gives a first-author-before-independence
    (e.g. zou-westlake on the POR paper). This edge is `PRE_INDEPENDENCE_WORK`, not a lead claim.
  - *"Fluorescence probes to detect lipid-derived radicals"* — Ken-ichi Yamada is the **first**
    author and originator of the NBD-Pen probe line, last author Mayumi Yamato is the senior
    radical-detection collaborator, and **Crossref marks no corresponding author**. Rather than
    claim sole `lead` for a first author, the role is **co-lead**, with the roleBasis disclosing
    the full position and the absence of a marked corresponding author. This is deliberately the
    conservative end of the HOLE-2 trust boundary documented in round 8.

## 3. Self-audit gate

The gate re-checked the honesty invariants on the 6 new papers (all 34 figure edges archive-derived,
6 attribution edges source-checked, 0 independently-rechecked), independently re-queried Crossref for
the two nuanced roles and two more papers (no drift; pre-independence and co-lead both confirmed
honest), and confirmed no CJK (including the cleaned `（模型）` figure-label annotation) or overclaim
leaked. The delivered data was clean — but the auditor found the round-8 fix **bypassable**:

- **HOLE (critical, count-gated — a bypass of the round-8 fix). FIXED.** `DOCUMENT_CLASS_SURFACES`
  binds a scope's `surfaceType` to the `documentClass`, but trusted the `documentClass` itself.
  Relabelling a crossref metadata source as an (unconstrained) `version-of-record` while keeping its
  `api.crossref.org` URL let it carry a `figure-caption` scope and promote a migrated paper's figure
  edge to `source-checked` at `figures-legends-checked` depth — every check green except the
  `check:readme` count bump, which regenerating makes green: the count-gated class the project had
  eliminated. **Fix:** `lib/source-registry.mjs` `URL_PINNED_DOCUMENT_CLASS` pins `documentClass` to
  the URL for the machine-checkable metadata endpoints (`api.crossref.org` → `crossref-metadata-record`,
  `pubmed.ncbi.nlm.nih.gov` → `pubmed-record`), enforced in `validateRegistry`, so the relabel throws
  before any content surface attaches. Regression-locked in `scripts/test-registry-hardening.mjs`
  (19→20 cases). The delivered round-9 data never contained this (0 misclassed sources); it was a
  latent bypass of the fix, not an active forgery.

Independent re-audit verdict (spawned auditor, verification pass after the bypass fix,
`AUDIT: 0 holes (0 critical)`): the auditor re-ran the exact relabel bypass and confirmed it now
throws inside `validateRegistry`/`buildGraph` (*"a https://api.crossref.org/… URL is a
crossref-metadata-record and cannot be declared documentClass version-of-record"*), with the suite
staying **red even when the README count is regenerated** — the count-gating is gone. No over-reach
(all 25 crossref and 13 pubmed sources already match their pinned class). It verified that no
existing source carries an unpinned metadata-API URL, so the pin list is complete for the actual
data, and it classified the remaining figure-forgery routes as the irreducible §6 trust boundary:
fabricating a `doi.org` version-of-record source that claims a full-text reading nobody performed is
consistent and not machine-disprovable (and its naive form, leaving `verificationDepth: archive-derived`,
is additionally caught by `check:papers`' depth-consistency rule). Repo confirmed pristine; full
`npm run check` green.

Defense-in-depth follow-up (not a hole): the pin list covers the two pure-metadata APIs the project
ingests from (crossref, pubmed); a future batch that ingests from another purely-metadata API
(OpenAlex, Semantic Scholar) should add it to `URL_PINNED_DOCUMENT_CLASS` — but not Europe PMC or
NCBI E-utilities, which also serve full text and legitimately back content surfaces.

## 4. Verification

`npm run check` passes all 14 sub-checks. Counts (data-derived, enforced by `check:readme`):

- `data/papers-en.json`: **25** English paper records (23 archive-derived, 2 methods-checked);
  30 laboratory attribution records across 24 laboratories.
- Provenance graph: **253 nodes and 287 edges**. Review state: recorded-unverified 69,
  archive-derived 157, source-checked 61, independently-rechecked 0.
- `data/source-reviews.json`: **73** canonical source records, **44** review events.

## 5. Known limitations and not-done

- **Curated-judgment seniority trust (round-8 HOLE-2).** The `co-lead` on the Yamada probe paper
  is the honest conservative call for a first-author PI with no marked corresponding author; like
  all role labels it is not machine-checked against author order (documented trust boundary).
- **Figure-level content remains archive-derived** — no migrated figure was reopened.
- **~44 evidence-audited papers remain.** The figure-audited backlog is now complete (14/14 in the
  English layer); the next batches move to the evidence-audited papers, then to widening the
  mechanism graph and terminology corpus.
- **Unchanged from round 7.** Authorized browser and accessibility QA — still no authorized preview.
