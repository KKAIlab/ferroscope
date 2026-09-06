# Honesty contracts

Two rules in this repository exist because the code once violated them. Both were caught by
adversarial audit rather than by a validator, which is the reason they are written down:
the validators now enforce them, but a future change can only respect a contract it can
find.

The shared lesson is at the bottom. Read it even if you only came for one of the rules.

---

## 1. The mechanism-edge anchor-disclosure contract

**The rule.** Every mechanism edge must render, to the reader, which paper(s) anchor it and
how deeply *this project* read each one. An edge may present as figure-verified only if
**every** one of its anchors was read to its figure chain.

**What went wrong.** Round 11 added mechanism edges anchored to bibliographic (abstract-level)
papers. The edge `confidence` field — free text like `"established; founding mechanism"` —
bypassed every review-state gate in the system, through three independent holes at once:

- `buildGraph` does not consume `mechanismEdges` at all. Mechanism-to-mechanism links are a
  front-end concept map; the provenance graph is built from mechanism *nodes*, method links
  and paper claims. So the graph contract never saw these edges.
- `validate-v09.mjs` checked only that an edge's evidence DOI resolves — not how deeply that
  paper was read.
- `edgeWeight()` mapped the word `"established"` to the thick `strong` visual, identical to a
  figure-audited edge, and the cited DOI was **never rendered at all**.

The result: an edge anchored to a paper whose figures nobody opened rendered exactly like an
edge backed by a full figure audit, with the detail panel literally showing `established`
above *"No source-checked paper claim."* Every individual field was true. The screen lied.

**How it is enforced now** (`app.js`, `scripts/test-public-surface.mjs`):

- `edgeAnchorHtml(edge)` renders each anchor as a clickable `.paper-open` link followed by
  **its own** depth label — `figure chain audited` or `abstract-level · figures not audited`.
  Per anchor, never merged: a figure-audited paper and an abstract-level one on the same edge
  must not hide behind one reassuring label.
- `edgeAnchorDepth(edge)` takes the **shallowest** anchor. One abstract anchor pulls the whole
  edge down.
- `edgeWeight(edge)` caps a non-figure-anchored edge below `strong`, however established the
  underlying biology is. The visual reports *our* reading depth, not the field's consensus.
- Abstract-anchored links render dotted, with a legend entry naming what dotted means.
- `test-public-surface.mjs` asserts that both `figure chain audited` and `figures not audited`
  appear in the rendered network HTML. The assertion lives at the layer the hole lived in —
  the rendered surface — because that is where the lie was visible and where a data-layer
  validator could not see it.
- `validate-coherence.mjs` pins the set of abstract-only-anchored edges to a named baseline,
  so a new one cannot appear without being declared.

**If you add or change a mechanism edge**, the question is not "is this claim true?" but
"does the screen show the reader how deeply we read the thing we are citing?"

---

## 2. The FerrDb license guard

**The rule.** `data/ferrdb-regulators.json` may not assert a FerrDb license or carry a
regulators payload unless a `licenseGrant` record backs it.

**What went wrong.** The file carried `status: "license-confirmed"` as a self-reported flag.
No validator read it, and `seal-manifest` excluded the file (`maintenance: "generated"`), so
nothing in the system could tell the difference between a real permission and a string
somebody typed. Flipping that one field would have silently dropped the "pending FerrDb
permission" caveat from the badge the interface shows. It was inert only because the file
rendered no numbers yet — and a per-node FerrDb aggregation feature was already planned,
which would have started rendering off exactly that flag.

**How it is enforced now** (`scripts/validate-v09.mjs`): the validator reads the file and
rejects any of

- `status !== "pending-license-confirmation"`,
- a non-empty `regulators` array,
- `regulatorsStatus !== "empty-pending-license"`,

unless `licenseGrant` supplies **`grantedBy` + an ISO date + `evidenceUrl`**. Verified by
mutation: flipping the flag turns the check red; adding a grant record turns it green.

**Context.** FerroScope is a public repository with public Pages. FerrDb data is
all-rights-reserved: it may be **linked** (deep links per gene), never mirrored. See
`docs/` and the FerrDb V3 access notes before touching anything in that layer.

---

## 3. The mechanism layout-band contract

**The rule.** Every mechanism node must declare which band of the reasoning chain it is drawn
in — its entry in `MECHANISM_GROUP` (`app.js`). A node the table does not name is not allowed
to render.

**What went wrong, twice.** The mechanism view has now placed nodes it was never told where to
put, in two different ways:

- **Round 10 — silent deletion.** The view was a fixed diagram driven by a hardcoded coordinate
  table listing only the original ten nodes. Round 10 added four more. They were dropped from
  the canvas entirely: the data said fourteen mechanisms, the screen showed ten, and every
  check was green.
- **Round 11 — silent misplacement.** The rebuild replaced the coordinate table with a seeded
  layered force pass, and made an unmapped node fall back to the `context` band instead of
  vanishing. That fixed the disappearance and left the cause: a node the table does not name is
  now *drawn inside "Disease & therapy"*, asserting a position in the causal chain that nobody
  assigned it. The improvement moved the lie rather than removing it — arguably a worse
  failure, because a missing node is noticeable and a confidently misplaced one is not.

Nothing between the two rounds read that table. Round 13 added the ACSL4–LPCAT3 node and would
have shipped it into the disease-and-therapy band on a single forgotten line.

**How it is enforced now** (`scripts/validate-coherence.mjs`): the check parses
`MECHANISM_GROUP` out of `app.js` and rejects

- a mechanism in `knowledge-network.json` with no band declared,
- a band assigned to an id that is not a mechanism,
- **a table it cannot locate at all** — if `MECHANISM_GROUP` is renamed or restructured, the
  check fails closed and demands rewriting. A guard that quietly skips itself when the code it
  guards moves is worth nothing, and this one is a regex over source, so it *will* be moved
  eventually.

Verified by mutation in `scripts/test-coherence.mjs` (three cases, one per rule) and against
the working tree: removing the `acsl4-lpcat3` line turns the check red and names the node.

**The layer note.** `app.js` belongs to the front-end owner, but which band a mechanism sits in
is an evidence-layer statement — it says where in the causal chain this project places that
biology, and the band scheme is grounded in the consensus figure. Adding a row is an
evidence-side edit; restyling how bands *look* is not. See `docs/HANDOFF.md` §domain split.

---

## The transferable lesson

All three failures had the same shape: **a claim reached the reader through a path the
verification layer did not cover.**

- The edge case: `mechanismEdges` is a UI-only structure, outside the registry and graph
  contracts. Everything the validators checked was true; the composition on screen was not.
- The FerrDb case: a generated file, excluded from the seal mechanism, carrying a
  self-reported permission flag no validator read.
- The layout case: a plain source-code lookup table in the presentation file, holding an
  evidence-layer statement — where in the causal chain a mechanism sits — that no validator
  had any reason to look for, because it did not look like data.

The third one adds a warning the first two do not: **fixing the symptom can hide the cause.**
Round 11 stopped unmapped nodes from disappearing and, in doing so, converted a visible failure
into an invisible one. When a rendering bug is fixed by choosing a better default, ask whether
anything now *detects* the case the default was chosen for.

So when adding **any** new evidence tier, badge, flag or visual weight, ask three questions:

1. **What does the reader end up seeing?** Not what the data says — what renders.
2. **Which validator sees that surface?** If the answer is none, the honesty guarantee stops
   at the last layer that is checked, and everything downstream is unverified by
   construction.
3. **Can this field be flipped by one edit with no backing record?** If yes, it is a
   self-report, not evidence.

Add the regression guard **at the layer the hole lives in**. A data-layer validator cannot
catch a rendering lie, and a rendered-surface assertion cannot catch a forged registry
event. Both layers needed their own guard, and both now have one.
