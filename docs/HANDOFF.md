# Handoff — working on FerroScope alongside other agents

More than one agent commits to this repository. This file is what a new session needs to
know before it touches anything: who owns which layer, how to push without destroying
someone else's work, and what is currently open.

Updated 2026-07-25 (round 12, stabilisation pass).

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

`app.js` is shared in practice: the honesty disclosures in the mechanism-graph renderer
(`edgeAnchorHtml`, `edgeAnchorDepth`, `edgeWeight`) belong to the evidence contract even
though the file is front-end. Changing how those render is an evidence-layer decision. See
`docs/HONESTY-CONTRACTS.md` §1.

## Before you change anything

- `npm run check` — the full chain, not a subset. It ends green or the batch is not done.
- Adding a paper this project has not figure-audited? → `docs/RECIPE-bibliographic-migration.md`
- Adding or restyling a mechanism edge, badge, or confidence visual? →
  `docs/HONESTY-CONTRACTS.md` first. Both contracts in it were violations before they were
  rules.
- Adding a mechanism node with no method link, or an edge anchored only on abstracts? →
  declare it in `ACKNOWLEDGED_GAPS` in `scripts/validate-coherence.mjs`. The check fails
  otherwise, by design: widening the corpus's silence must be a deliberate, visible act.

## Open items

### For the front-end / FerrDb owner

1. **`data/node-gene-map.json` is missing three nodes.** The graph has 17 mechanisms; the
   map covers 14. Missing: `system-xc`, `gch1-bh4`, `mevalonate-sterol` (added in round 11).
   Deep links silently no-op for them — an honest empty state, but a gap. Suggested mapping,
   for the owner to verify and apply:
   - `system-xc` → SLC7A11, SLC3A2
   - `gch1-bh4` → GCH1, DHFR
   - `mevalonate-sterol` → HMGCR, DHCR7
2. **`graphSyncNote` in that file is stale.** It states "All 14 node ids here exist in the
   committed knowledge-network.json". The count is now 17 in the graph, 14 in the map. The
   note's substantive claim (consumers look up by node id and no-op for absent ids) still
   holds — only the number and the implied completeness are wrong.

### On the evidence side, deferred by decision

3. **Seven mechanism nodes have no method link**, so their detail panel shows no
   interrogating method: `mufa-membrane-remodelling`, `selenium-selenoprotein`,
   `mitochondrial-metabolism`, `immune-regulation`, `system-xc`, `gch1-bh4`,
   `mevalonate-sterol`. Declared in `ACKNOWLEDGED_GAPS`.
4. **Three mechanism edges rest only on abstract-level anchors**: `system-xc→gpx4-gsh`,
   `gch1-bh4→lipid-peroxidation`, `mevalonate-sterol→lipid-peroxidation`. Disclosed to the
   reader per edge, and declared in `ACKNOWLEDGED_GAPS`. Deepening any of them means a
   figure audit, not a field edit.
5. **~44 evidence-audited papers remain unmigrated** in the legacy archive with no figure
   chain. They would arrive at abstract level at best; not started.
6. **Fig. 1 of the consensus review still has unmodelled arms.** The mechanism graph's
   reasoning-chain layout is grounded in Mishima/Conrad, *Nat Rev Mol Cell Biol* 2025
   (`robust-research-2025` in `resources.json`), deliberately not matching it one-to-one.
   ACSL4 / LPCAT3 / SCD1 have no node yet.

## Environment notes

- Local preview: run the server via a **backgrounded Bash tool call**, not a `(cmd &)`
  subshell — the subshell server dies between turns. Chrome sometimes throws `chrome-error`
  on `localhost`; retry, or use `127.0.0.1`. Do not rabbit-hole the browser: fall back to
  validating layout arithmetic in Node.
- `.discussions/` is gitignored. Strategy and round-discussion files stay local and must not
  reach the public repository.
- This is a **public** repository with public Pages. Third-party all-rights-reserved data
  (FerrDb) may be linked, never mirrored.
