# FerroScope · Global Ferroptosis Research System

FerroScope is an English-first research-intelligence website for ferroptosis and lipid biochemistry. It connects current research signals, laboratories, experimental methods, mechanisms, terminology and external research routes while keeping evidence limitations visible.

## Current release status — v0.9.8 (round 9)

Round 9 continues the content pivot: it migrates the remaining 6 figure-audited backlog papers (2016–2023) into the English-first layer, taking `data/papers-en.json` from 19 to 25 papers, by the same honest recipe as round 8 (`scripts/migrate-round9.mjs`, driven by the translated `scripts/round9-specs.mjs`, regression-checked by `npm run check`).

- **Same honest floor.** Figure chains are translated from the audited archive and enter `archive-derived` with no `scopeRef`, so all 34 new figure `BOUNDED_BY` edges stay `archive-derived`; only each paper's Crossref metadata spine is `source-checked`, promoting the 6 new attribution edges. Crossref re-verification set two roles the archive would have mis-stated as lead: Minghui Gao is the first author of "Role of Mitochondria in Ferroptosis" (senior author Xuejun Jiang), so gao-hit is `pre-independence`, not lead; and Ken-ichi Yamada is the first author and originator of the NBD-Pen probe (senior last author Mayumi Yamato, no marked corresponding author), so yamada-kyushu is `co-lead`, not sole lead.
- **The auditor gate closed a bypass of the round-8 fix.** Round 8's `DOCUMENT_CLASS_SURFACES` binds a scope's `surfaceType` to its source's `documentClass`, but trusted the `documentClass` itself: relabelling a crossref metadata source as an (unconstrained) `version-of-record` while keeping its `api.crossref.org` URL re-opened the figure-caption promotion, caught only by a README count. `lib/source-registry.mjs` now pins `documentClass` to the URL for the machine-checkable metadata endpoints (`URL_PINNED_DOCUMENT_CLASS`: an `api.crossref.org` URL must be `crossref-metadata-record`, a `pubmed.ncbi.nlm.nih.gov` URL must be `pubmed-record`), so the relabel is rejected in `validateRegistry`/`buildGraph` before any content surface can attach. Regression-locked in `scripts/test-registry-hardening.mjs` (now 20 cases). The residual — fabricating a primary-document source with a plausible publisher URL that claims a reading nobody performed — is the trust boundary documented in `DELIVERY_AUDIT_ROUND7.md` §6, not machine-disprovable.
- **Provenance graph.** The graph holds 253 nodes and 287 edges. By review state: recorded-unverified 69, archive-derived 157, source-checked 61 and independently-rechecked 0. `data/source-reviews.json` now holds 73 canonical source records and 44 review events. Method decision fields are unchanged: 33 of 208 method decision fields are source-checked and 175 remain pending. 0 datasets are sealed and 0 scopes are independently rechecked; Claude Code is the implementer this round and may not sign its own work as a second reading.

## Previous release status — v0.9.7 (round 8)

Round 8 acts on the strategic finding of [`DELIVERY_AUDIT_ROUND7.md`](DELIVERY_AUDIT_ROUND7.md) §6: with the provenance contract now correct for the honest-report threat and regression-locked, effort moves from provenance plumbing to content. This round surfaces eight legacy figure-audited papers into the English-first layer, taking `data/papers-en.json` from 11 to 19 papers. The migration is honest by construction (`scripts/migrate-round8.mjs`, driven by the translated specs in `scripts/round8-specs.mjs`, regression-checked by `npm run check`):

- **Archive-derived by default, no forged reading.** Each paper's figure chain is translated from this project's own audited archive (`data/lab-research.json`) and enters at `verificationDepth: archive-derived`; its `figureAudit` carries no `scopeRef`, so every figure `BOUNDED_BY` edge resolves to the paper's unverified baseline, not a `source-checked` state nobody earned. The eight papers add 46 figure edges, all `archive-derived`.
- **Only the metadata spine is source-checked, because only it was re-verified.** Each paper's bibliographic metadata was re-queried live at Crossref on 2026-07-24, so the one `source-checked` fact per paper is its title/journal/pages/authors record at `metadata-checked` depth; the publisher full text is recorded as declared-but-not-opened. The nine new `CONTRIBUTED_TO` attribution edges are `source-checked` at metadata depth on that basis, and the re-verification corrected the author-position attribution the archive had guessed: one middle author became `contributing-author`, one second-to-last author became `co-lead`, and an apparent last-author mismatch was confirmed as the true last author.
- **Provenance graph.** The graph holds 213 nodes and 247 edges. By review state: recorded-unverified 69, archive-derived 123, source-checked 55 and independently-rechecked 0. `data/source-reviews.json` now holds 61 canonical source records and 38 review events. Method decision fields are unchanged: 33 of 208 method decision fields are source-checked and 175 remain pending. 0 datasets are sealed and 0 scopes are independently rechecked; Claude Code is the implementer this round and may not sign its own work as a second reading.

## Previous release status — v0.9.6 (round 7)

Round 7 answers a set of confirmed integrity holes ([`CODEX_REVIEW_ROUND6.md` findings, carried into `DELIVERY_AUDIT_ROUND7.md`](DELIVERY_AUDIT_ROUND7.md)) and was implemented and adversarially self-audited by Claude Code with a reusable auditor agent (`.claude/agents/provenance-auditor.md`), not by Codex. Its subject is not new content: the review-state counts were unchanged from round 6 at round 7 (round 8, above, changed them by migrating content; `npm run check:readme` enforces the current counts). What changed in round 7 is that several ways to *show a review nobody earned* were closed, structurally rather than by patch.

- **The registry is now the only authority on review state.** A paper verification source used to carry its own `reviewState`/`verificationDepth`, so raising that private copy to `independently-rechecked` — without touching `data/source-reviews.json` — forged 34 graph edges. `lib/graph.mjs` now resolves a paper's review state, depth, scope, URL and version from the canonical review event, and refuses to build if the private copy contradicts the registry. The 40 denormalised copies were reconciled to the registry (14 had drifted, including a retrieval date), and `scripts/validate-papers.mjs` locks them there.
- **The independent-recheck contract no longer accepts forgeries.** `lib/source-registry.mjs` now rejects a circular recheck chain, a recheck whose prior event was never a real reading, an ordinary reading masquerading as a second one, a checked event that cites an `accessExtent: "not-opened"` scope, and an independent recheck resolving to a source with no pinned `sha256` (two readers cannot claim the same bytes without one). Every review path — paper claim, figure boundary, method route and now the correction-notice path — resolves its state through one shared registry resolver, so an inline copy can no longer declare a checked or rechecked state its registry event does not back. 0 independent review events exist; the first must still be added by an independent reviewer.
- **A paper cannot borrow another paper's reading, and an experimental claim must cite the experiment.** Registry sources now carry `identifiers.doi`, and a paper verification source whose registry source is about a different DOI is refused — closing a cross-paper evidence borrow found by the self-audit. Because that check trusts a per-record DOI, the registry also now enforces that no two sources share a URL or a `sha256`, so a forged duplicate-bytes source cannot be minted under a second DOI. And a `paper-backed-experimental` claim may be promoted only by a surface on the paper's own primary document — an allowlist of `abstract-text`, `results-text`, `body-text`, `figure-caption`, `figure-panel`, `methods-text`, `supplement-text`, `supplement-data`, `full-document` or `raw-data` — which closes promotion off a `metadata-record`, a `correction-text` notice or a vendor page in one rule. Each of these four closures was found by the auditor breaking the previous fix, and each is a regression test.
- **Method claim fragments name real clauses.** The `(clause N)` index suffix and the ellipsis-truncated whole-value fragment — used to split one fact into two "distinct" rows — are rejected, and an `explicit` fragment must be a literal span of the field value or be relabelled `derived`/`analytical inference`. 40 gamed fragments across three source-checked modules were repaired.
- **No false byte-level claim.** `scripts/validate-papers.mjs` no longer describes its URL/version comparison as "byte-for-byte"; it states plainly that nothing in this repository re-fetches and diffs bytes, and byte identity is asserted only where a `sha256` is pinned.
- **Regression-locked.** `npm run check:registry` (`scripts/test-registry-hardening.mjs`) reproduces each closed hole as a test, so a regression turns a check red.

## Provenance backbone — v0.9.5 (round 6)

Round 6 answers [`CODEX_REVIEW_ROUND5.md`](CODEX_REVIEW_ROUND5.md), executed against [`HANDOFF.md`](HANDOFF.md). Its subject is not new content but one canonical provenance backbone. Round 5 gave each method module stable-looking ids, but the same source record and review event were copied into several modules and into the paper layer, where a forged version in one copy passed validation. Round 6 replaces the copies with a single registry. The numbers below are derived from the data and enforced by `npm run check:readme`, so this section cannot silently drift from the release.

- **One canonical registry.** `data/source-reviews.json` now holds 45 canonical source records, 174 reviewed scopes and 30 review events, resolved by every method route, paper verification source, graph edge and UI statement through `lib/source-registry.mjs`. A method route embeds no URL, version, reviewer, date or scope of its own; it references a `sourceId` and, when a reading exists, a `reviewEventId`. The forged-version acceptance attack now fails because a route stores no version to forge, and a second source minted under an existing id but different bytes is rejected.
- **Surfaces, not an ordinal depth ladder.** Each scope declares a `surfaceType` (metadata record, abstract text, results text, methods text, figure caption, correction text, vendor description/specifications/FAQ, and so on) and an `accessExtent` (not opened, read in part, read in full). Graph coverage is reported by surface type and review state, not by the retired maximum-verification-depth number: a Results paragraph no longer renders as "Methods-checked", and a vendor catalogue page is shown as a vendor product description rather than a "full-text-rechecked" scientific full text.
- **Independent review is a resolvable second event.** An independent recheck is another entry in the same event collection, with a `priorReviewEventId` that must resolve to a real event, the same source and pinned bytes, a different reviewer from both the prior reader and the dataset owner, a date no earlier than the prior event, overlapping resolvable scopes and an explicit agreement. `buildGraph()` refuses to build on an invalid chain even when called directly, and a promoted recheck attributes to the second reader, not the original implementer. 0 independent review events exist; Codex will add the first.
- **Method decision fields.** 33 of 208 method decision fields are source-checked; 175 remain pending, each naming what has to be read to resolve it. Every source-checked field now maps each piece of evidence to the exact clause it supports (`claimFragment`) and declares its support mode — `explicit`, `derived`, `analytical inference` or `curated guidance`. The support-mode audit the review named was completed: MDA readout, negative control, process control, compartment resolution and orthogonal confirmation, the oxidised-PL positive/negative/process controls, compartment resolution and orthogonal confirmation, and the BODIPY question boundary now label their interpretive clauses as derived or analytical inference rather than explicit.
- **Provenance graph.** The graph holds 159 nodes and 192 edges. By review state: recorded-unverified 69, archive-derived 77, source-checked 46 and independently-rechecked 0. A checked edge links to the source that was actually opened and carries the selected review event, its reader and date, the scope surface and access extent, and — for a future recheck — the agreement.
- **Nothing is sealed and nothing is independently rechecked.** 0 datasets are sealed and 0 scopes have been independently rechecked; Claude Code is the implementer this round and may not sign its own work as a second reading.
- **Two papers were read as accepted author manuscripts, not versions of record.** Kagan et al. 2017 (`10.1038/nchembio.2238`) was read as the NIH author manuscript PMC5506843 (140,459 bytes, SHA-256 `647b73b5…`), and Zou et al. 2020 (`10.1038/s41589-020-0472-6`) as PMC7353921 (117,289 bytes, SHA-256 `3165d84b…`); the byte pins were independently fetched by Codex. Figure captions were read; rendered figure panels and the supplements were not opened. Recording objective bytes is not a scientific review.
- **Still pending.** Authorized HTTPS browser and accessibility QA remains pending — no authorized preview exists, and MIME or DOM harness checks are not a substitute. Link health is reachability, not source-content validation.

## Previous release status — v0.9.4 (round 5)

Round 5 answers [`CODEX_REVIEW_ROUND4.md`](CODEX_REVIEW_ROUND4.md), executed against [`HANDOFF.md`](HANDOFF.md). Its subject is not new content but a stronger, claim-specific provenance contract: a `source-checked` sentence must resolve to the exact source record, review event and reviewed scope that supports it, at no deeper access level than that scope earned. The numbers below are derived from the data and enforced by `npm run check:readme`, so this section cannot silently drift from the release.

- **Method decision fields.** 33 of 208 method decision fields are source-checked; 175 remain pending, each naming what has to be read to resolve it. The count fell from the round-4 figure of 35 because two fields were honestly demoted rather than left overclaimed (`mda-4hne.confounders` and `bodipy-c11-assay.processControl`). Every source-checked field now references a source record, a review event and a reviewed scope by stable id, and declares its support mode — `explicit`, `derived`, `analytical inference` or `curated guidance` — with a short note the UI shows.
- **Provenance graph.** The graph holds 159 nodes and 192 edges. By review state: recorded-unverified 69, archive-derived 77, source-checked 46 and independently-rechecked 0. A checked edge now links to the source that was actually opened, not the module or claim's declared default, and a figure-caption edge inherits `figures-legends-checked` even when another scope in the same paper reached methods depth.
- **Nothing is sealed and nothing is independently rechecked.** 0 datasets are sealed and 0 scopes have been independently rechecked; Claude Code is the implementer this round and may not sign its own work as a second reading. Independent review is modelled as a distinct second event and Codex will perform it.
- **Two papers were read as accepted author manuscripts, not versions of record.** Kagan et al. 2017 (`10.1038/nchembio.2238`) was read as the NIH author manuscript PMC5506843, and Zou et al. 2020 (`10.1038/s41589-020-0472-6`) as PMC7353921. Figure captions were read; rendered figure panels and the supplements were not opened.
- **Still pending.** Authorized HTTPS browser and accessibility QA remains pending — no authorized preview exists, and MIME or DOM harness checks are not a substitute. Link health is reachability, not source-content validation. No first-party laboratory-site crawler exists yet.

## What v0.9.3 adds

Round 3 answers the independent review in [`CODEX_REVIEW_ROUND2.md`](CODEX_REVIEW_ROUND2.md), executed against [`HANDOFF_ROUND3.md`](HANDOFF_ROUND3.md).

- **A calendar date reads the same to every reader.** The ingestion parser was already timezone-invariant, but `app.js` formatted the result with `new Date(date)`, so `2025-12-04` rendered as **03 Dec** in any negative UTC offset. `formatCalendarDate()` in `lib/records.mjs` reads the components out of the string and never builds a local instant. `npm run check:dates` renders the real interface under UTC, Asia/Tokyo and America/Los_Angeles and asserts the visible day is identical.
- **Freshness belongs to the discovery route, not to the card.** Each entry in `sources[]` carries its own `stale`, `lastSuccessAt` and `lastAttemptAt`. A failing source retains only its own route from a multi-route cached record — matching on the single top-level `sourceName` used to lose the secondary route entirely. A card is labelled retained only when every automated route has failed and no curated record supplies it; anything in between renders as partial degradation.
- **Method modules answer thirteen decision axes or say they cannot.** Specimen, question, perturbation, readout, unit, instrument, the three essential controls, orthogonal confirmation, timing, compartment resolution and confounders each carry `source-checked` or `pending-source-review`. In round 3 all 208 fields were pending; the current source-checked and pending counts are stated in the round-5 status section above, and the method dialog shows the gaps rather than leaving blanks.
- **Laboratory capability is derived from evidence, not asserted.** A capability claim counts only where a source-checked `USES_METHOD` claim links a paper to the module and the attribution layer independently places the laboratory on that paper. 13 rows qualify; the remaining 48 `distinctiveLabs` entries are published as curated claims with no evidence recorded.
- **A graph edge cannot be quietly unchecked.** Every edge declares a `provenanceClass` and a `reviewState`; a null `checkedAt` must be accompanied by `pending-source-review` and a reason, and the validator rejects it otherwise. The 74 curated method-module edges render as provisional rather than with the confidence of a claim read out of a figure. The graph names `lib/graph.mjs` as its generator, and the validator checks that the file exists.
- **Declared method sources are monitored.** `npm run check:links` now also resolves the eight distinct URLs the method modules rest on. Resolving is not reading, and the report says so.

## What v0.9.2 adds

Round 2 answers the independent review in [`HANDOFF.md`](HANDOFF.md). Every change below exists because a claim on the page was stronger than the evidence behind it.

- **Automated records no longer carry an evidence grade.** Ingestion writes `evidenceGrade: null` with `evidenceGradeBasis: "unassessed"`; only a curated audit in `data/record-overlays.json`, or a published reading record in `data/papers-en.json`, may assign A–D. Document class is separate from review status and from evidence strength, and an unclassified PubMed hit renders as “PubMed record”, never as “Peer reviewed”.
- **Dates are parsed as calendar dates.** `lib/records.mjs` decomposes a publisher date textually instead of round-tripping it through local time, which used to shift a date back one day east of UTC. `npm run check:ingestion` runs the fixtures under three timezones.
- **One study renders once.** Curated and automated layers merge on a canonical identity — normalized DOI, then PMID, then NCT, then canonical URL — keeping the curated narrative, the current date and the union of laboratory matches, with every discovery route preserved in `sources`.
- **A failed source degrades honestly.** Its previous records are retained, marked `stale`, and published with the last success, the last attempt and the error class. Past a 14-day limit that source publishes nothing and validation fails.
- **Reading depth and verification depth are separate and visible.** Every paper card and dialog header states `Archive-derived figure chain · abstract cross-checked · full figures pending` rather than a bare “figure-level audit”.
- **Provenance is structured.** `verification.sources[]` records each route with its scope, status, date and who checked it; the UI summary is generated from those fields.
- **Article stage and post-publication status are separate axes,** and all four previously unread correction notices are classified with `affectedDomains`, `conclusionImpact`, `noticeType` and `sourceUrl`. No `pending-source-check` remains.
- **Monitoring coverage is stated, not implied.** `data/monitoring-coverage.json` records the watch tier, watch state and review dates for all 37 laboratories. No laboratory claims a site monitor, because no site crawler exists.
- **The manifest enforces ownership and review.** Every dataset names an accountable owner. A dataset is either awaiting review, or names an independent reviewer and pins a sha256 of the reviewed bytes; a later edit then fails validation. Mutation tests prove both gates.
- **A provenance graph is derived at load time** from the audited figure chains, so mechanisms resolve to the individual paper claims that support, replicate, contradict or cannot separate them, each with its condition vector.
- **Methods are a decision system.** `data/evidence-bundles.json` maps a question and a model scale to a minimum evidence bundle and to the sentence the result still cannot support. BODIPY 581/591 C11 is reachable only inside a bundle.

## What v0.9.1 added

- an English paper layer, `data/papers-en.json`, holding 25 papers whose baseline is an archive-derived figure chain, each carrying structured verification sources (metadata, abstract, and where opened, author-manuscript scopes), a condition vector, a version and correction history and a statement of what was verified and what was not;
- a separate laboratory attribution layer, `data/lab-paper-links.json`, so a role claim can never become a property of the paper;
- an English-native ingestion pipeline: `scripts/update-data.mjs` writes English topic labels, takeaways, caveats and source-status notes, and resolves public laboratory names from `labs-en.json` by id rather than from watch-query labels;
- a rendered-DOM language gate and an injection gate, `scripts/test-public-surface.mjs`, which drive the real `app.js` through a small DOM harness and fail if CJK reaches the page outside the terminology corpus or if hostile source metadata survives escaping;
- a data manifest, `data/schema-versions.json`, so no dataset can reach the site without a declared schema version, shape, owner and review date;
- `.github/workflows/verify.yml`, which runs the full check suite on every push and pull request.

## What v0.9 added

- English-only public narrative, with Chinese and Japanese retained as search aliases and terminology translations;
- 37 global laboratory profiles, classified by capability rather than publication count;
- a 16-module methods atlas that separates common identification assays from distinctive laboratory capabilities;
- a typed knowledge network linking 10 mechanism nodes to methods and laboratories;
- a 25-entry English–Chinese–Japanese terminology corpus;
- a curated external research hub with authority labels, use boundaries and link-check dates;
- English briefs for all curated research signals;
- output escaping and URL-scheme checks for automatically ingested content.

The legacy Chinese research archive remains in `data/lab-research.json` for provenance, but its narrative is not rendered publicly. English interpretations are released only after translation is checked against the primary paper.

## Run locally

Node.js 18 or newer is required.

```bash
npm start
```

Open `http://127.0.0.1:4173`. Do not open `index.html` directly because browsers block local JSON requests.

## Validate

```bash
npm run check            # everything below, in order
npm run check:data       # laboratory coverage, automated-record gate, monitoring coverage
npm run check:v09        # foreign keys, schema manifest, ownership, review fingerprints
npm run check:papers     # paper layer, correction notices and laboratory attribution
npm run check:graph      # provenance graph contract
npm run check:graph-contract # negative cases: an unchecked edge with no provisional state is rejected
npm run check:surface    # rendered-DOM language, evidence, merge, depth and decision-schema gates
npm run check:dates      # the interface renders one calendar date identically in three timezones
npm run check:ingestion  # offline ingestion fixtures under three timezones
npm run check:manifest   # manifest mutation tests
npm run check:links      # laboratory sites, external resources and declared method sources (needs network)
```

`check:data` fails if any automated record carries an evidence grade of its own, claims to be original research, omits its source, or collides with another record on canonical identity. It also requires exactly one monitoring-coverage row per laboratory and keeps `watch-queries.json` and `monitoring-coverage.json` in agreement.

`check:v09` verifies English laboratory coverage, trilingual terminology fields, method-to-laboratory foreign keys, typed mechanism links, HTTPS resources, complete English curated-signal briefs, the evidence-bundle decision paths, and that every file in `data/` is registered in the manifest with an accountable owner, a valid schema version and either a pending-review flag or a matching review fingerprint.

`check:papers` enforces one reading record per normalized DOI, a condition vector, a boundary statement on every figure record, separate article stage and post-publication status, a classified notice with an affected domain and a conclusion impact for every version event, a structured verification source list, and rejection of priority, proof and disease-causation language in published narrative. It also fails if the English layer silently disagrees with the legacy archive.

`check:surface` renders the real interface through a DOM harness and fails if Chinese or Japanese text reaches the page outside `#glossaryGrid`, if a hostile title, topic, takeaway or URL scheme survives into the rendered markup, if an automated record is graded or labelled peer reviewed, if two layers of the same study render twice, or if the archive-derived verification depth is not visible on the card.

## Record a review

```bash
npm run seal -- --reviewer=<owner-id> [files...]
```

Sealing states that a named party other than the owner read those exact bytes. It writes the reviewer, the date and a sha256 of the file; any later edit then fails `check:v09` until the file is reviewed again. Declared parties are the keys of `owners` in `data/schema-versions.json`. Running this to turn a red check green defeats the mechanism it exists to provide.

## Refresh first-party intelligence

```bash
npm run update
npm run check
```

Automated source ingestion reads PubMed, preprint metadata and ClinicalTrials.gov. Curated interpretation and automated alerts are stored separately. The deployed workflow runs every six hours; this is near-real-time monitoring, not a live market feed.

When a source fails, the records it last returned are retained, marked `stale`, and published together with the date of the last success and the class of the error, while the other sources are unaffected. If those retained records are more than 14 days old, that source publishes nothing and validation fails rather than presenting an old dataset as current. The freshness dialog states this policy in the same words.

## Evidence model

No single assay defines ferroptosis. FerroScope organizes evidence around four linked questions:

1. Is there time-resolved cell death rather than only growth inhibition?
2. Does the phenotype depend on iron and lipid-radical chemistry?
3. Do genetics, target engagement and direct chemical measurements support the proposed mechanism?
4. Does the conclusion survive a physiological model without overstating clinical translation?

BODIPY 581/591 C11, MDA, 4-HNE, GPX4 protein abundance, mitochondrial morphology or one Ferrostatin-1 rescue can support a study, but none is a standalone diagnosis.

## Data layers

- `data/labs.json`: canonical links, categories and original internal records;
- `data/labs-en.json`: public English laboratory identity, focus, question and multilingual search aliases;
- `data/methods.json`: method principle, measurement boundary, best practice, failure modes, the thirteen decision axes with their review status, the declared source routes and the evidence-derived laboratory capability;
- `data/knowledge-network.json`: typed mechanism relations and method links;
- `data/glossary.json`: English definitions with Chinese and Japanese terminology aliases;
- `data/resources.json`: external research resources with authority and caution labels;
- `data/signal-briefs-en.json`: verified English overlays for curated signals;
- `data/papers-en.json`: canonical English paper records, keyed by normalized DOI, with the 60-second card, the audited figure chain, classified version events, separate article stage and post-publication status, separate reading and verification depth, and a structured verification source list;
- `data/lab-paper-links.json`: laboratory contribution records, deliberately separate from paper facts;
- `data/paper-claims.json`: typed claims read out of the audited figure chain, each naming its figure, condition vector and confidence basis; the seed for the provenance graph;
- `data/evidence-bundles.json`: question-to-minimum-evidence-bundle decision paths and the assays that may never stand alone;
- `data/record-overlays.json`: curated document-class and evidence-grade decisions for automated records;
- `data/monitoring-coverage.json`: per-laboratory watch tier, watch state, site-monitor state and review dates;
- `data/schema-versions.json`: the manifest that registers every dataset with an owner, schema version, shape, maintenance mode and either a pending-review flag or a review fingerprint;
- `data/live.json`: automated alerts, each stating its source, its document class and that its evidence grade is unassessed;
- `data/lab-research.json`: legacy evidence and figure-audit archive, not directly rendered in public narrative;
- `lib/records.mjs` and `lib/graph.mjs`: the record semantics and the provenance graph, shared by the ingestion pipeline, the validators and the browser. The deployment workflow copies `lib/` alongside `data/`; without it the page loads no module at all.

## Three-scale reading system

1. **60-second question card** — question, advance, evidence anchor, scope and next decision;
2. **Figure-level causal audit** — intervention, readout, rescue, physiological model and missing link;
3. **Longitudinal lab synthesis** — persistent question, capability evolution, attribution, contradictions and next watch point.

Reading depth belongs to a unique paper identified by normalized DOI. Laboratory contribution is a separate relationship record. A shared paper must not be counted as several unique studies, and a methods collaborator must not be presented as the sole mechanism-discovery lab.

## Important limitations

- automated capture is a navigation layer, not a literature conclusion;
- an author-name match is not laboratory attribution;
- pathway maps and databases are secondary navigators;
- organelle localization is condition-dependent;
- disease signatures and ex situ human organs are not clinical proof;
- corrections, Editor’s Notes and retractions must remain attached to the publication record.

- a laboratory URL that returns 200 proves the URL resolves, not that the page still describes that laboratory;
- an author watch that has never run is coverage on paper, not coverage in fact, and is labelled as pending.

`HANDOFF.md` holds the independent review this round answers, and `DELIVERY_AUDIT_ROUND2.md` records what was changed, what was tested and what remains open. `CLAUDE_CODE_HANDOFF.md` is the superseded round-1 plan.
