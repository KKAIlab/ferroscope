# Delivery Audit · Claude Code → Codex

Date: 2026-07-23
Repository: `/Users/chenjingquan/Projects/ferroscope`, branch `main`
Input contract: `CLAUDE_CODE_HANDOFF.md`
Commits produced: `a2a6030`, `fb86017` (local only; nothing pushed, nothing deleted, no history rewritten)

This is an audit, not a summary. It states what was delivered, what was verified against a
primary source, what was **not** verified, what was found to be wrong in the previous state,
and what is left. Read section 4 and section 7 before planning the next phase.

---

## 1. Scope executed

Both P0 items from the handoff, plus the parts of P1 that the paper layer makes cheap.

| Handoff item | Status | Owning files |
|---|---|---|
| P0 · English-native, enforceable pipeline | complete | `scripts/update-data.mjs`, `scripts/validate-data.mjs`, `scripts/serve.mjs`, `scripts/validate-v09.mjs`, `data/schema-versions.json`, `scripts/lib/dom-harness.mjs`, `scripts/test-public-surface.mjs`, `.github/workflows/verify.yml`, `package.json` |
| P0 · Source-checked English paper audits | 11 papers delivered against a target of 10 | `data/papers-en.json`, `data/lab-paper-links.json`, `scripts/validate-papers.mjs`, `app.js`, `index.html`, `v09.css` |
| P1 · Provenance graph | substrate built, graph not wired | paper and attribution layers exist and are validated; `data/knowledge-network.json` still has no paper or disease nodes |
| P1 · Methods as a decision system | not started | — |
| P2 · Link health, release QA | not started, one gap closed (CI) | — |

## 2. Delivery evidence

From a clean `git clone` of this repository, Node v24.5.0:

```
Data check passed: 37 laboratories, 11 country or region labels, 15 author watches and 23 curated signals.
FerroScope v0.9 validation passed: 37 English lab profiles, 16 methods, 25 trilingual terms, 10 mechanism nodes, 12 external resources and 23 English curated briefs.
Paper layer validation passed: 11 source-checked English papers (11 at all three reading scales, 3 carrying registered corrections, 1 formally contested) and 15 laboratory attribution records across 12 laboratories.
研究方法测试通过：37 个团队均有问题档案；74 条团队—论文记录对应 69 篇唯一论文，其中 25 篇达到逐图精读。
Public surface tests passed: 99 rendered fragments checked, CJK confined to the terminology corpus, and hostile source metadata neutralised.
```

Both new gates were mutation-tested rather than merely observed to pass:

- injecting `这是一个中文泄漏测试` into `data/methods.json` failed the language gate and named the
  offending string in both the method card and the method dialog;
- rewriting one `sixtySecond.advance` to contain "first-ever", "definitively proves",
  "causes Alzheimer disease" and "paradigm shift" produced five separate overclaim errors;
- the injection gate initially reported false positives on the page's own decorative `<svg>` and on
  the harmless escaped substring `onerror=`; the assertions were tightened to payload-carrying tag
  forms and real-quote event handlers, and the hostile fixture was pinned above every curated signal
  so it actually enters the visible window and the featured strip.

## 3. Verification ledger for the paper layer

This is the part most easily overstated, so it is stated exactly.

**Verified in this pass, per paper, against a primary metadata source:**

- Crossref record for the DOI: title, container title, volume, pages, issue date, author count,
  first and last author, and the `updated-by` relation. All 11 checked on 2026-07-23.
- PubMed abstract, by PMID, used to cross-check the central claim written into the 60-second card.
- For every correction, Matters Arising and Reply: the notice DOI, its registered type, its title
  and its `update-to` target were confirmed at Crossref.

**Not verified in this pass:**

- The full text and figures were **not** re-opened. The figure-level audits are concise English
  rewritten from this project's previously audited Chinese archive, cross-checked against the
  abstract for consistency. Every record says so in `verification.figureLayer`. If Codex wants
  `figure-audited` to mean "re-read in English against the source", that is a separate pass.
- Four correction notices were not read, so their `affects` value is `pending-source-check` and each
  appears in `verification.unresolved`:
  - `10.1038/s41589-021-00767-w` — Author Correction to the POR paper
  - `10.1038/s41586-025-09562-2` and `10.1038/s41586-026-10148-9` — two Publisher Corrections to the oestradiol paper
  - `10.1038/s41586-021-03820-9` — Author Correction to the DHODH paper
- Laboratory roles rest on the verified Crossref author list. No contribution statement was read.
  Where only author position is known, the role is `contributing-author` and the basis says so
  explicitly rather than upgrading the claim.

## 4. Findings against the previous state

Four things were found to be wrong or missing. None was silently repaired.

**4.1 The POR paper was labelled version-of-record but carries a registered Author Correction.**
`data/lab-research.json` records `publicationStatus: "version-of-record"` for
`10.1038/s41589-020-0472-6`, while its own `sourceScope` says the 2021 author correction was checked.
Crossref confirms `correction:10.1038/s41589-021-00767-w` dated 2021-03-02. The English layer records
the paper as `corrected` with the event attached. **The archive still disagrees.**

**4.2 `corrected` is being used for two different things.**
The transplantation paper `10.1016/j.cell.2026.04.024` is labelled `corrected` in the archive, but its
`sourceScope` shows the reading was taken from an Elsevier *in-press corrected proof* — an article
stage, not a published correction. Crossref now assigns volume 189, pages 3991-4004.e26, a June 2026
issue date and **no correction notice**. The English layer records it as `version-of-record` with an
explicit `article-stage reclassification` event. The same enum value therefore means "a publisher has
issued a correction" for two papers and "Elsevier had not finalised the proof" for a third. This is a
schema defect, not a data typo, and it needs a decision.

**4.3 A publication-year disagreement.** The Kagan oxidised-PE paper was recorded as 2017 in the
archive and would have been recorded as 2016 from Crossref's online date alone. PubMed gives the issue
date 2017 January against an epub date of 2016-11-14. The English layer uses the citation year 2017 and
records both dates. The validator now fails on any year disagreement between the two layers.

**4.4 The language rule had no CI gate.** `npm run check` only ran on the six-hourly refresh workflow,
so nothing blocked a push or a pull request that reintroduced Chinese into the public page.
`.github/workflows/verify.yml` now runs the full suite on push and pull request.

## 5. Deviations from the handoff plan, and why

- **The language test is a rendered-DOM test, but with an in-repo harness rather than jsdom.** The
  project has zero dependencies and no `node_modules`; adding a DOM library to satisfy one test was a
  worse trade than 150 lines of `scripts/lib/dom-harness.mjs`. The harness records every `innerHTML`
  and `textContent` write made by the real `app.js`, so the assertions follow the actual rendering
  path. `app.js` gained `export` statements and a `ready` promise; nothing about its browser behaviour
  changed.
- **Schema and date validation is done through a manifest, not per-file version fields.** Most data
  files are top-level arrays, so a `schemaVersion` key could not be added without restructuring them.
  `data/schema-versions.json` gives the same guarantee and adds one the handoff did not ask for: an
  unregistered file in `data/` now fails validation, so a new dataset cannot reach the site without an
  owner, a declared shape and a review date.
- **Eleven papers, not ten.** The handoff listed ten classes; FSP1-CoQ and FSP1-vitamin K are two
  papers, and separating them was cheaper than compressing them.
- **A `contributing-author` role was added to the allowed set.** The handoff's enum had no honest slot
  for "verified as an author, contribution unread". Forcing that into `method collaborator` would have
  been exactly the inference the handoff forbids.

## 6. Honest weaknesses of what was built

- The figure-level English text is a rewrite of a prior audit, not an independent reading. It is
  labelled as such in every record, but a reader who ignores `verification` will not see the
  difference between it and a first-hand audit.
- The overclaim detector is negation-aware by proximity (45 characters back to a negation cue). It will
  miss an overclaim placed shortly after an unrelated negation, and it only inspects
  `sixtySecond` and `figureAudit`.
- The DOM harness returns an empty list for `querySelectorAll`, so delegated click bindings are never
  exercised by the language gate. Dialogs are covered because the render functions are exported and
  called directly, but a future UI that renders only through a `querySelectorAll` path would escape
  the gate.
- **No browser was used.** Two Chrome instances are connected to this account and the tooling requires
  a human to choose one, so responsive layout, keyboard access to the new dialog and the 390 px
  overflow check were not performed. The new CSS follows the existing card patterns and includes
  1080 px and 760 px breakpoints, but that is design intent, not verification.
- `npm run update` was executed once against live sources to regenerate `data/live.json`, so the
  automated signal set in commit `a2a6030` is a fresh capture, not the previous one.

## 7. Open items, in the order they are worth doing

1. **Decide what `publicationStatus: "corrected"` means** and split the article-stage concept out of
   it. Until that is settled, `data/lab-research.json` and `data/papers-en.json` disagree on two DOIs
   by design; `scripts/validate-papers.mjs` permits the disagreement only because a version event
   explains it. Note that `scripts/test-research-method.mjs` currently *asserts* the archive's stale
   value for the transplantation paper, so changing the archive requires changing that test —
   deliberately, not incidentally. The archive is provenance; do not overwrite it casually.
2. **Read the four pending correction notices** and replace `pending-source-check` with a real
   `affects` value. The validator already fails if a pending event is not mirrored in
   `verification.unresolved`, so this cannot be forgotten silently.
3. **Wire the paper layer into the knowledge network** (P1). `data/papers-en.json` and
   `data/lab-paper-links.json` are the substrate the handoff asked for: typed `paper`, `laboratory` and
   `evidence_boundary` nodes can now be generated with a `paperId`, a `conditionVector` and a
   `checkedAt` on every edge. `SUPPORTS_IN_CONTEXT` and `CHALLENGES` are directly derivable — the DHODH
   record already carries a Matters Arising and a Reply.
4. **Extend the remaining 58 archive papers** to the English layer, in the order that serves the
   laboratories with no English record at all.
5. **Methods as a decision system** (P1) — untouched.
6. **Link health for `data/resources.json`** (P2) — still outside `npm run check:links`.
7. **Browser QA** — responsive layout at 390 px, keyboard access to `#paperDialog`, and focus
   management when the laboratory dialog closes to open the paper dialog.
8. **Remaining CJK in developer tooling.** `scripts/test-research-method.mjs` (111 lines) and
   `scripts/build-lab-research.mjs` (22 lines) still report in Chinese. The former is a legitimate
   exception: it asserts the content of the Chinese archive. The latter is not, and one line remains in
   `scripts/check-lab-links.mjs`. None of this reaches the public page — the language gate covers that.

## 8. Reproducing this audit

```bash
cd /Users/chenjingquan/Projects/ferroscope
npm run check          # all five checks, in order
npm run check:papers   # paper layer and attribution layer only
npm run check:surface  # rendered-DOM language gate and injection gate only
PORT=4180 npm start    # port 4173 is held by an unrelated process on this machine
```

To confirm a gate is real rather than vacuous, break it deliberately and restore afterwards. Note that
`data/papers-en.json`, `data/lab-paper-links.json` and `data/schema-versions.json` were untracked when
first written; `git checkout <file>` will not restore a mutation made before those files were committed.

## 9. What the return handoff needs to decide

1. Does `figure-audited` require a first-hand English reading of the full text, or is a labelled
   rewrite of the audited archive acceptable as a published reading level? Everything in section 3
   depends on this answer.
2. How is article stage separated from correction status in the schema, and does the legacy archive get
   updated or stay frozen as provenance?
3. Is the next phase breadth (more papers into the English layer) or depth (the provenance graph over
   the eleven that exist)? The graph work is more valuable per token, because it is the thing the
   handoff called the point of the system, and the eleven records were chosen to span the field.
