# Handoff — working on FerroScope alongside other agents

More than one agent commits to this repository. This file is what a new session needs to
know before it touches anything: who owns which layer, how to push without destroying
someone else's work, and what is currently open.

Updated 2026-07-25 (round 13, acyl axis).

## Push discipline

Non-negotiable, and it exists because of a near-miss: a parallel agent had already pushed to
`origin/main` while this session was preparing a merge, and the branches had diverged in two
of the same files.

1. **`git fetch` and check divergence before every push.**
   `git rev-list --left-right --count main...origin/main`
2. **Never force-push over another agent's commit.** If histories diverged, merge and
   hand-resolve, keeping both sides' intent. Do not "clean up" someone else's work.
3. **Every batch goes on a feature branch** → validate → maintainer approval → fast-forward
   merge → push. Push approval is per-batch and does **not** generalise to the next one.
4. **Keep merged feature branches** for reference rather than deleting them
   (`ui/mechanism-graph` is the standing example).

## Domain split

| Layer | Owner | Files |
|---|---|---|
| Evidence / content / audit | this line of work | `data/papers-en.json`, `data/knowledge-network.json`, `data/source-reviews.json`, `data/lab-paper-links.json`, `data/glossary.json`, `scripts/validate-*`, `scripts/test-*`, `scripts/migrate-*`, `scripts/expand-*`, `README.md`, `docs/` |
| Front end + FerrDb | the parallel agent (Fable, working out of `~/orca/workspaces/ferroscope/*`) | `app.js` presentation layer, `v09.css`, `data/node-gene-map.json`, `data/ferrdb-regulators.json`, `scripts/ingest-ferrdb.mjs` |

On conflict, the evidence/audit side is the integration point. **Do not cross-edit another
owner's files** — leave a request in "Open items" below instead.

`app.js` is shared in practice, and two things in it belong to the evidence contract even
though the file is front-end:

- the honesty disclosures in the mechanism-graph renderer (`edgeAnchorHtml`,
  `edgeAnchorDepth`, `edgeWeight`) — see `docs/HONESTY-CONTRACTS.md` §1;
- the `MECHANISM_GROUP` table — which band of the reasoning chain a mechanism is drawn in is
  a statement about where this project places that biology, not styling. Adding a row is an
  evidence-side edit and `validate-coherence.mjs` now requires one per mechanism; changing how
  the bands *look* (`ROLE_META` hues, spacing, snap strengths) is the front-end owner's call.
  See `docs/HONESTY-CONTRACTS.md` §3.

## Before you change anything

- `npm run check` — the full chain, not a subset. It ends green or the batch is not done.
- Adding a paper this project has not figure-audited? → `docs/RECIPE-bibliographic-migration.md`
- Adding or restyling a mechanism edge, badge, or confidence visual? →
  `docs/HONESTY-CONTRACTS.md` first. Both contracts in it were violations before they were
  rules.
- Adding a mechanism node with no method link, or an edge anchored only on abstracts? →
  declare it in `ACKNOWLEDGED_GAPS` in `scripts/validate-coherence.mjs`. The check fails
  otherwise, by design: widening the corpus's silence must be a deliberate, visible act.
- Adding a mechanism node at all? → it also needs a band in `MECHANISM_GROUP` (`app.js`), or
  the check fails. Without one it would render in "Disease & therapy" by fallback rather than
  disappear, which is the harder failure to notice. `docs/HONESTY-CONTRACTS.md` §3.
- Linking a method to one more mechanism? → check whether that method carries
  `assertionScopes`. Those modules propagate **source-checked** state to every edge they
  produce, so a new link there silently claims a reading of a scope covering the new mechanism
  that nobody performed. `test-graph-contract.mjs` catches it; route the link through a module
  without read scopes unless the scope genuinely covers the new mechanism.
- Writing a test assertion about a specific study? → **never look it up in `data/live.json`.**
  That file is a moving PubMed window, not a corpus: `fetchTrackedLabs` in `update-data.mjs`
  takes each laboratory's four most recent ferroptosis papers within one year, so any given
  record leaves it within months. Three checks were written against records in it and all
  three eventually broke the scheduled refresh — see the round-14 note in `README.md`. Build
  the record as a fixture (`scripts/test-public-surface.mjs` and `scripts/test-display-dates.mjs`
  both show the pattern: `mkdtemp`, copy `data/`, overwrite `live.json`, render). Records in
  `intelligence-curated.json`, `papers-en.json`, `record-overlays.json` and the rest of `data/`
  are hand-maintained and safe to name.
- Note the asymmetry that hid this for six failed runs: `data/live.json` is **committed**, so a
  local `npm run check` validates the snapshot in git while CI validates what it just fetched.
  A green local run does not mean the refresh will pass. To reproduce CI: `npm run update`
  then `npm run check`, and restore `data/live.json` + `data/meta.json` afterwards.

## Open items

### For the front-end / FerrDb owner

1. **`data/node-gene-map.json` is missing four nodes.** The graph has 18 mechanisms; the
   map covers 14. Missing: `system-xc`, `gch1-bh4`, `mevalonate-sterol` (round 11) and
   `acsl4-lpcat3` (round 13). Deep links silently no-op for them — an honest empty state, but
   a gap. Suggested mapping, for the owner to verify and apply:
   - `system-xc` → SLC7A11, SLC3A2
   - `gch1-bh4` → GCH1, DHFR
   - `mevalonate-sterol` → HMGCR, DHCR7
   - `acsl4-lpcat3` → ACSL4, LPCAT3
2. **`graphSyncNote` in that file is stale.** It states "All 14 node ids here exist in the
   committed knowledge-network.json". The count is now 18 in the graph, 14 in the map. The
   note's substantive claim (consumers look up by node id and no-op for absent ids) still
   holds — only the number and the implied completeness are wrong.

### On the evidence side, deferred by decision

3. **Six mechanism nodes have no method link**, so their detail panel shows no
   interrogating method: `selenium-selenoprotein`, `mitochondrial-metabolism`,
   `immune-regulation`, `system-xc`, `gch1-bh4`, `mevalonate-sterol`. Declared in
   `ACKNOWLEDGED_GAPS`. (`mufa-membrane-remodelling` left this list in round 13.)
4. **Three mechanism edges rest only on abstract-level anchors**: `system-xc→gpx4-gsh`,
   `gch1-bh4→lipid-peroxidation`, `mevalonate-sterol→lipid-peroxidation`. Disclosed to the
   reader per edge, and declared in `ACKNOWLEDGED_GAPS`. Deepening any of them means a
   figure audit, not a field edit.
5. **~44 evidence-audited papers remain unmigrated** in the legacy archive with no figure
   chain. They would arrive at abstract level at best; not started.
6. **The acyl axis is modelled; the Fig. 1 comparison itself is not.** Round 13 added
   `acsl4-lpcat3` as a node anchored on Kagan 2017 at figure-chain/methods-checked depth, and
   handled the MUFA side without a node by decision: `mufa-membrane-remodelling` already *is*
   the act those enzymes perform, so SCD1/ACSL3/MBOAT1/2 are named in its description and
   carried as glossary terms (`scd1` added, the other three already present) rather than
   restated as a second node.

   What remains open is the premise, and it should be stated plainly: **this project has never
   systematically compared its graph against that figure.** Mishima/Conrad, *Nat Rev Mol Cell
   Biol* 2025 is `robust-research-2025` in `resources.json` — an `Evidence standard` resource,
   not a figure-audited paper in `papers-en`. So "what else is in Fig. 1" has no source-checked
   answer here, and any future claim to have completed the figure needs the review migrated at
   least to bibliographic tier first (`docs/RECIPE-bibliographic-migration.md`). The graph is
   grounded in that scheme; it was never a checklist against it.

## Environment notes

- Local preview: run the server via a **backgrounded Bash tool call**, not a `(cmd &)`
  subshell — the subshell server dies between turns. Chrome sometimes throws `chrome-error`
  on `localhost`; retry, or use `127.0.0.1`. Do not rabbit-hole the browser: fall back to
  validating layout arithmetic in Node.
- `.discussions/` is gitignored. Strategy and round-discussion files stay local and must not
  reach the public repository.
- This is a **public** repository with public Pages. Third-party all-rights-reserved data
  (FerrDb) may be linked, never mirrored.
