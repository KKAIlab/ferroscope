# Delivery Audit · Round 7 (Claude Code, self-audited)

Date: 2026-07-24
Repository: `/Users/chenjingquan/Projects/ferroscope`, branch `main`
Implemented by: Claude Code. Independently re-audited by a spawned adversarial agent
(`.claude/agents/provenance-auditor.md`), because the implementer may not sign its own work.
Nothing pushed, deployed, sealed, or turned into a real independent recheck.

This round had no Codex handoff — Codex was off. The task was: take the six confirmed
blocking problems, **verify them independently**, fix them structurally, and stand up a
reusable review agent so the project is no longer blocked when the external reviewer is away.

## 1. The six problems were verified, not assumed

Each was reproduced against the real `lib`/`data` before any fix:

| # | Problem | Reproduction | Verdict |
|---|---------|--------------|---------|
| 1 | Registry accepts forged/circular rechecks, checked events on unopened scopes | Built circular chain, not-opened-scope reading, masquerade — `validateRegistry` returned 0 problems | confirmed |
| 2 | Paper private-field edit forges independently-rechecked edges | Raised paper `verification.sources[].reviewState` only → **34** forged edges (worse than the 9 reported) | confirmed |
| 3 | 40 authority copies; "byte-by-byte" is URL-only | 40 paper source blocks embed url/version/state; `validate-papers.mjs` comment claimed byte-for-byte, code compared URL strings | confirmed |
| 4 | Suspicious method claim fragments | 18 rows carried an ellipsis-truncated whole-value fragment + a `(clause N)` index suffix; `g (clause 2)`, `5-1 (clause 2)` are truncation artifacts | confirmed |
| 5 | 43/45 sources unhashed | 43 of 45 registry sources have `version.sha256 == null` | confirmed |
| 6 | Content still 37/16/25/10 | true | confirmed — see §6 |

## 2. What was fixed, and why structurally

The root cause of 1–3 was one thing: **review state was stored as a private copy on each
consumer instead of being resolved from the one canonical registry event.** The method layer
already resolved from the registry; the paper layer did not. So the fix was to make the paper
layer resolve like the method layer, and to harden the registry contract the resolution trusts.

- **Registry chain (problem 1)** — `lib/source-registry.mjs`: reject circular chains
  (acyclic walk), a recheck whose prior is not itself a checked reading, a state/structure
  masquerade (`priorReviewEventId` ⇔ `independently-rechecked`), a checked event citing a
  `not-opened` scope, and an independent recheck on an unhashed source.
- **Paper resolution (problems 2, 3)** — `lib/graph.mjs` `paperReviews()` now derives
  `reviewState`, `verificationDepth`, `scope`, `url`, `version` from the registry event and
  refuses to build if a private copy outranks it. The 40 denormalised copies were reconciled to
  the registry (14 had drifted, one on the retrieval date), and `validate-papers.mjs` locks
  them there and no longer calls a URL comparison "byte-for-byte."
- **Byte identity (problem 5)** — an independent recheck may not resolve to a source with a
  null `sha256`, so "two readers, same bytes" is only claimable where bytes are pinned.
- **Claim fragments (problem 4)** — `lib/method-review.mjs` rejects ellipsis fragments, the
  `(clause N)` suffix, and an `explicit` fragment that is not a literal span of the field value.
  40 gamed fragments across `bodipy-c11-assay`, `mda-4hne` and `oxidized-pl-lcms` were repaired
  to real, distinct clauses (the migration self-checked substring and uniqueness before writing).

## 3. The self-audit ran six passes and closed seven more holes

The spawned auditor did what a single reproduction of a known attack cannot: it invented fresh
attacks against each fix. It took six passes to converge, and that iteration is the point — the
early fixes patched instances, and the auditor broke the class each time until nothing green
remained. Every hole below is now a regression test in `scripts/test-registry-hardening.mjs`.

- **Pass 1** confirmed the six original fixes and found two:
  - *HOLE-1 (critical): cross-paper evidence borrow* — a paper could cite another paper's registry
    source+event and inherit its reader, URL and depth. *Fix:* registry sources carry
    `identifiers.doi`; a paper source about a different DOI is refused.
  - *HOLE-2 (minor): experimental claim on a metadata surface* — a claim promoted by the paper's
    own `authors` (CrossRef) scope. *Fix:* a metadata-record surface may not promote an experiment.
- **Pass 2** confirmed those, then broke both again — each was an instance, not the class:
  - *RESIDUAL-A (critical): forged duplicate-bytes source* — mint a second source with the same URL
    and `sha256` but a different `identifiers.doi`. *Class fix:* the registry rejects two sources
    sharing a URL or a `sha256`; "one document is one source record" now holds on the bytes.
  - *RESIDUAL-B (critical): experimental claim on a correction notice* — blocking only
    `metadata-record` left `correction-text` open. *Class fix:* replaced the blocklist with a
    positive allowlist of the paper's own primary-document content surfaces, excluding metadata,
    correction and vendor surfaces at once.
- **Pass 3** confirmed those two, then found the deeper class:
  - *HOLE (critical): the promoting scope was not bound to the claim's own figure* — a claim about
    Fig. 3 could be marked checked by a genuine reading of Fig. 6, and the reader was shown "Fig. 3,
    checked." *Fix:* a paper-backed experimental edge's `scopeRef` must equal its `figure`. Also
    `app.js` now shows a scope's access extent, so a partial read no longer renders as a full one.
- **Pass 4** confirmed that, and found the same "promote-by-label" pattern in two paths the figure
  guard did not reach:
  - *C1 (structural, then count-gated): the correction-notice path was not registry-joined* — an
    inline notice review could declare `independently-rechecked`. *Fix, in two steps:* first a
    presence check, then (pass 5→6) the notice path was fully routed through the shared
    `registryReviews()` resolver, so a notice's state comes only from a resolved, chain-validated
    registry event.
  - *C2 (curated-judgment boundary): a method's two opposite assertions could cite the same reading.*
    *Guard:* `MEASURES` and `CANNOT_DISTINGUISH` may not cite the same scope. The residual — a method
    assertion pointed at a *different* genuinely-read scope that may not support it — is not
    structurally checkable and is documented as a trust boundary (§7).
- **Pass 5** returned `AUDIT: 0 holes (0 critical)` — no green structural forgery in any edge family
  — and flagged one remaining count-gated weakness: the notice path's presence-only recheck check.
- **Pass 6** confirms the notice path is now structural rather than count-gated, and that merging the
  paper and notice resolvers reopened none of the earlier holes; its verdict is in §5.

## 4. The reusable review agent

`.claude/agents/provenance-auditor.md` encodes the attack playbook used this round: private-field
promotion, circular/masquerade/unopened-prior/unhashed rechecks, unopened-scope readings,
claimFragment gaming, byte-identity honesty, and count integrity, plus a mandate to invent fresh
attacks against new code. It is the standing replacement for "wait for Codex": the maintainer can
run an independent adversarial provenance audit on demand. It reports holes; it never edits data
or signs a review. Note: a project agent definition is not auto-registered as a subagent type in a
fresh session; drive it by spawning a general-purpose agent with this playbook as its prompt (as was
done here), or register it in session config.

## 5. Verification

`npm run check` runs 14 sub-checks (was 13; `check:registry` is new) and passes from the working
tree. The new guarantees are regression-locked in `scripts/test-registry-hardening.mjs` (17 cases):
circular chain, unopened-scope reading, unopened-prior recheck, masquerade, unhashed byte identity,
a valid recheck still passing, zero-forgery clean build, paper private-field forgery, cross-paper
borrow, experimental-claim-on-metadata-surface, forged duplicate-bytes source, experimental-claim-
on-correction-surface, wrong-figure promotion, method same-scope, and three notice-recheck variants
(no event, merely-source-checked event, non-existent event).

Independent re-audit verdict (spawned auditor, sixth/final pass, `AUDIT: 0 holes (0 critical)`):
passes 1-5 recorded 2 + 2 + 1 + (2 → 0) findings; the sixth pass reproduced every closed attack
against the merged `registryReviews()` resolver and confirmed each still throws at `buildGraph`
construction, structurally, before any count assertion runs:

- **Notice path, now structural not count-gated.** Three inline-recheck forgeries against a real
  correction notice all throw from `registryReviews()`: no `reviewEventId` → *"no checked registry
  event backs it"*; keeping the real but only-`source-checked` event id → *"the registry is the
  authority"*; a non-existent event id → *"does not resolve in the registry"*. Source-checked
  notices still render (clean build: 5 `CORRECTED_BY` edges, 4 source-checked, 0 rechecked).
- **Paper-path refactor reopened nothing.** Cross-paper borrow, private-field promotion, and
  wrong-figure promotion each still throw; a genuine registry recheck still promotes end-to-end.
- **All three recheck-capable paths gated identically.** One forged recheck event (same reviewer as
  prior, so it fails `validateIndependentEvent`) wired into the paper, notice, and method routes
  throws on every one — the `independently-rechecked == 0` count assertion is now redundant
  belt-and-suspenders, so the guarantee will still hold when Codex adds the first real recheck.
- **Clean build unchanged:** 192 edges, `byReviewState {69, 77, 46, 0}`, `CORRECTED_BY = 5`; real
  `npm run check` exit 0 (14 sub-checks); `check:registry` = 17 cases. Real repo pristine
  (0 fingerprints; `paper-claims.json`/`knowledge-network.json` untouched; all mutations were
  in-memory clones). The one remaining green data-only edit is the method-2a curated-judgment
  residual of §7, not a structural forgery.

## 6. The strategic finding the user should weigh

Rounds 4–6 built an elaborate provenance-integrity machine, and each round an adversarial review
found a new way to forge provenance. This is a **single-maintainer, static, GitHub Pages** site.
Whoever can edit `data/*.json` to forge a claim can also edit `lib/*.mjs` and the validators, so
this machinery does not defend against a malicious maintainer. What it legitimately protects is
**honest self-report** — the system, and any AI agent editing it, must not be able to *accidentally*
show a review depth nobody earned. Judged by that standard the fixes are worth keeping, and the
holes were real.

But there is a point of diminishing returns, and the project is at it. You cannot make a JSON file
prove a human opened a PDF; a `sha256` only helps if something re-fetches and diffs the bytes,
which nothing here does. Problem 6 — the actual mission of "global, real-time, 10× learning" — has
not moved since round 1 (still 37 labs, 16 methods, 25 terms, 10 mechanisms) while three rounds
went into provenance plumbing.

**Recommendation:** freeze the provenance contract here (it is now correct for the honest-report
threat model and regression-locked), and spend the next rounds on content and the learning goal —
more laboratories and papers into the English layer, the mechanism graph widened, the terminology
corpus grown — with the auditor agent run once per batch as a gate rather than as the whole task.
Expanding coverage is where the mission is, and the small core is now trustworthy enough to scale
onto.

## 7. Known limitations and not-done

- **Curated-judgment trust, by design.** A method's `MEASURES`/`CANNOT_DISTINGUISH` edge can be
  pointed at a *genuinely-read* scope that the passage may not actually support. The validator proves
  the scope was read — real event, real reviewer, pinned bytes, opened surface — but cannot prove the
  passage supports that specific assertion; that needs reading the source and is scientific judgment,
  the same trust the project already places in a `supportMode` label. Method assertions have a wider
  mis-assignment surface than paper claims because, unlike a claim, a method assertion has no figure
  of its own to bind against. This is a documented trust boundary, not a forgery: no fabricated
  reading, no false reviewer.
- **Follow-ups, not blockers.** Full removal (rather than registry-locked reconciliation) of the
  denormalised authority fields on paper `verification.sources` — now provably equal to the registry
  and CI-locked, so removal is cosmetic. Populating `sha256` on the remaining registry sources (only
  the 2 deep-read manuscripts are hashed; the rest are metadata/notice records where byte-pinning
  matters less).
- **Unchanged from round 6.** Authorized browser and accessibility QA — still no authorized preview.
- **Problem 6 (content scale)** — a program, proposed in §6, not attempted this round.
