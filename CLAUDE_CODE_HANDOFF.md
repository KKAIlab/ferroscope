# Claude Code Handoff · FerroScope v0.9 → v1.0

> **Status on 2026-07-23:** this original plan has been implemented through local commit `f307ea6` and independently reviewed. The authoritative next-round instructions are now in [`HANDOFF.md`](HANDOFF.md). Read that file before making further changes. Do not push the current local HEAD.

Date: 2026-07-23  
Canonical project path: `/Users/chenjingquan/Projects/ferroscope`  
Public repository: `KKAIlab/ferroscope`  
Public site: `https://kkailab.github.io/ferroscope/`

## 1. Mission

Turn FerroScope into a durable, English-first global research system for ferroptosis, optimized for a lipid-biochemistry researcher who needs primary-source intelligence rather than a generic paper feed.

The system must connect five objects:

1. **research signals** — papers, preprints, corrections and clinical registrations;
2. **laboratories** — persistent questions, capabilities, official sites and current activity;
3. **methods** — what each experiment measures, cannot prove and which laboratories perform it distinctively;
4. **mechanisms** — typed, directional and condition-aware biological relations;
5. **terminology and external resources** — precise trilingual search terms and reliable routes to the field.

The public narrative is English. Chinese and Japanese are allowed only in search aliases and the dedicated terminology corpus.

## 2. User requirements that must not be diluted

- Follow global ferroptosis teams, not only China, Japan, Europe or North America.
- Use simple English to explain specialist terms while preserving scientific precision.
- Build an English–Chinese–Japanese terminology corpus.
- Distinguish common ferroptosis experiments from each laboratory's distinctive methods.
- Construct a knowledge network linking laboratory ↔ paper ↔ mechanism ↔ method ↔ disease/context.
- Provide curated off-site links so FerroScope functions as a research-system entry point.
- Preserve three reading scales:
  1. 60-second question card;
  2. Figure-level causal audit;
  3. longitudinal laboratory synthesis.
- Maintain direct links to official laboratory sites and primary sources.
- Reduce correction risk; do not use unchecked machine translation as publishable scientific interpretation.

## 3. Scientific rules

### 3.1 Ferroptosis is not diagnosed by one assay

Never present any of the following alone as proof of ferroptosis:

- BODIPY 581/591 C11 oxidation;
- MDA or 4-HNE increase;
- GPX4 protein decrease;
- mitochondrial shrinkage by electron microscopy;
- partial Ferrostatin-1 rescue;
- a ferroptosis gene-set score or clinical signature.

The correct reagent name is **BODIPY 581/591 C11**, not “BODIPY 11”. The probe reports oxidation of a membrane-localized fatty-acid analogue. It does not identify a named endogenous oxidized phospholipid and is not a standalone ferroptosis diagnosis.

Use the 2025 recommendation as the methods baseline: `https://doi.org/10.1038/s41580-025-00843-2`.

### 3.2 Condition vectors must remain attached

Spatial and mechanistic conclusions must retain:

`cell/model × inducer × dose × exposure × medium/nutrients × probe/method × compartment × time window`

Do not flatten ER, lysosome and plasma-membrane studies into a universal organelle sequence.

### 3.3 Paper identity and laboratory attribution are different objects

- A unique paper is identified by normalized DOI or another stable source ID.
- Reading level, version status, corrections and Figure audit belong to the paper.
- Laboratory role belongs to a laboratory–paper relationship.
- First-author work before independent appointment must be labeled as pre-independence work.
- A methods collaboration must not be presented as sole laboratory leadership.

### 3.4 Translation and disease claims require explicit boundaries

- disease-like morphology ≠ disease cause;
- clinical gene expression/signature ≠ patient ferroptosis measurement;
- organoid or ex situ human organ ≠ clinical trial;
- local perfusion or intratumoural dosing ≠ systemic treatment window;
- preprint ≠ peer-reviewed result;
- Editor’s Note ≠ retraction, but it must remain visible;
- correction metadata must state whether the change affects methods, metadata, figures or conclusions.

## 4. v0.9 architecture already implemented

### Public interface

- English hero and navigation;
- filtered current research signals;
- three-scale reading overview;
- methods atlas with evidence boundaries;
- interactive mechanism network;
- 37 English global laboratory profiles with multilingual search aliases;
- 25-term English–Chinese–Japanese glossary;
- 12-resource external research hub;
- evidence gate;
- escaped external content and safe URL-scheme handling.

### New data files

- `data/labs-en.json`
  - public English overlay for all 37 laboratories;
  - includes PI, institution, region, focus, persistent question and Chinese/Japanese aliases;
  - canonical website/category/tags/relevance still come from `data/labs.json`.
- `data/methods.json`
  - 16 method modules;
  - fields: group, evidenceRole, plainEnglish, measures, cannotProve, bestPractice, commonPitfalls, distinctiveLabs, source.
- `data/glossary.json`
  - 25 trilingual entries;
  - English definition and precision note plus en/zh/ja aliases.
- `data/knowledge-network.json`
  - 10 mechanism nodes;
  - typed directional edges with confidence text;
  - method-to-mechanism links.
- `data/resources.json`
  - 12 external links;
  - type, authority, description, language, checkedAt and caution.
- `data/signal-briefs-en.json`
  - English overlays for all 23 curated signals.
- `scripts/validate-v09.mjs`
  - validates coverage, foreign keys, English narrative, typed graph edges, HTTPS resources and English-signal completeness.
- `v09.css`
  - additive design layer; avoids destabilizing the original stylesheet during the architecture upgrade.

### Deliberate safety decision

`data/lab-research.json` contains a high-value legacy Chinese evidence archive, including 25 Figure-audited papers. The public v0.9 interface does **not** display its Chinese interpretation. It exposes only English source metadata until a translation has been checked against the original paper.

Do not bypass this gate by applying bulk machine translation and publishing the output.

## 5. Known gaps

1. `scripts/update-data.mjs` still writes some Chinese topic and ingestion-note strings to raw JSON. The UI normalizes or suppresses them, so the public page stays English, but the ingestion layer should become natively English.
2. English Figure-level audits are not yet published. Source metadata remains visible; the interpretive layer is intentionally held.
3. The knowledge network links mechanisms to methods and laboratories, but paper nodes and disease/context nodes are not yet fully materialized.
4. The methods atlas records distinctive laboratories but does not yet store assay-level protocol metadata such as specimen, instrument, quantification unit and critical controls.
5. External-resource links have manual `checkedAt` fields but are not included in the scheduled link checker.
6. Automated author matching is intentionally conservative; common author names still require ORCID/affiliation or manual attribution.
7. The original CSS and `v09.css` should be consolidated only after functional work is complete.

## 6. One-week execution plan optimized for limited quota

Do not spend the remaining budget on a framework migration, backend rewrite, visual redesign or indiscriminate translation. Work in this order.

### P0 · Make the data pipeline English-native and enforceable

Estimated focus: first 20% of effort.

1. Convert `scripts/update-data.mjs` topic labels, takeaway templates, status notes and warnings to English.
2. Use laboratory IDs to resolve the public English PI name from `labs-en.json`; do not use `watch-queries.json.label` for display.
3. Add a rendered-DOM language test:
   - CJK is allowed only under `#glossary` and inside non-rendered search aliases;
   - CJK elsewhere fails CI.
4. Add a safe HTML/URL regression test for automated titles and metadata.
5. Extend `validate-v09.mjs` to validate JSON schema versions and dates.

Acceptance:

- `npm run update && npm run check` produces an English public page;
- malicious or malformed source metadata cannot inject markup or unsafe links;
- no curated signal lacks an English brief.

### P0 · Publish source-checked English paper audits

Estimated focus: 35% of effort.

Do **not** translate all 451 KB of legacy narrative in one pass.

Start with these high-value papers/classes:

1. GPX4 fin-loop / membrane anchoring;
2. POR and phospholipid peroxidation;
3. PUFA ether-lipid plasticity;
4. FSP1–CoQ and FSP1–vitamin B2/FAD;
5. oxidized AA/AdA-PE redox lipidomics;
6. lysosomal iron and lysosomal membrane permeabilization;
7. ER–mitochondria or membrane-propagation studies;
8. transplantation / ex situ human-organ study;
9. one kidney-injury genetics study;
10. one negative or contested study.

Create `data/papers-en.json` with a canonical paper layer:

```json
{
  "id": "doi:10.xxxx/xxxx",
  "doi": "10.xxxx/xxxx",
  "title": "...",
  "journal": "...",
  "year": 2026,
  "publicationStatus": "version-of-record",
  "versionEvents": [],
  "readingLevel": "figure-audited",
  "sixtySecond": {
    "story": "...",
    "advance": "...",
    "evidenceAnchor": "...",
    "scope": "...",
    "openQuestion": "..."
  },
  "figureAudit": [
    {
      "figure": "Fig. 1",
      "question": "...",
      "intervention": "...",
      "readout": "...",
      "answer": "...",
      "boundary": "...",
      "sourceScope": "main figure and legend checked"
    }
  ]
}
```

Create `data/lab-paper-links.json` separately:

```json
{
  "labId": "...",
  "paperId": "doi:...",
  "role": "lead | co-lead | method collaborator | conceptual collaborator | pre-independence",
  "roleBasis": "author position, corresponding-author statement and contribution statement",
  "continuity": "how this paper connects to the laboratory's persistent question"
}
```

Translation workflow for each paper:

1. normalize DOI and verify version of record;
2. check correction / Editor’s Note / retraction status;
3. compare the Chinese archive with title, abstract, figures, legends and relevant methods;
4. write concise English from the source, not sentence-by-sentence translation;
5. run a second pass that only looks for overstatement, wrong journal, wrong Figure count, disease causation and attribution;
6. publish only after all mandatory fields pass.

Acceptance:

- at least 10 high-value papers available in English at all three reading scales;
- no laboratory role inferred from name presence alone;
- one DOI has one reading level and version chain across the site;
- unsupported “first”, “proves”, “paradigm shift” and disease-causation language is rejected.

### P1 · Expand the knowledge network into a provenance graph

Estimated focus: 25% of effort.

Add typed nodes:

- `paper`;
- `laboratory`;
- `method`;
- `mechanism`;
- `disease_context`;
- `compound_or_perturbation`;
- `evidence_boundary`.

Allowed edge examples:

- laboratory `LEADS` paper;
- laboratory `CONTRIBUTES_METHOD` to paper;
- paper `SUPPORTS_IN_CONTEXT` mechanism;
- paper `CHALLENGES` mechanism;
- method `MEASURES` chemical/readout;
- method `CANNOT_ESTABLISH_ALONE` mechanism;
- mechanism `DEPENDS_ON_UNDER_CONDITION` another mechanism;
- paper `TESTS_IN` disease context;
- publication event `CORRECTS` paper version.

Every paper-derived edge must carry:

- `paperId`;
- `evidenceLevel`;
- `conditionVector` or a reason it is not applicable;
- `claimScope`;
- `checkedAt`.

Do not add generic co-occurrence edges based only on shared keywords.

Acceptance:

- selecting a mechanism reveals supporting and challenging papers;
- selecting a laboratory reveals distinctive methods and its actual role in linked papers;
- every displayed paper claim has a route to the primary source;
- disputed relations are visible rather than averaged into consensus.

### P1 · Improve methods as an experimental decision system

Estimated focus: 10% of effort.

Extend each method with:

- sample type;
- live/fixed/destructive;
- spatial resolution;
- molecular specificity;
- quantitative output;
- critical controls;
- compatible orthogonal methods;
- perturbation risk;
- exemplar source paper;
- laboratories with demonstrated capability and the evidence for that assignment.

Add a “design an evidence bundle” interaction:

- user chooses cell culture / organoid / animal / human tissue;
- user chooses mechanistic question;
- site proposes a minimum bundle and warns what remains unproven.

Do not turn the website into a protocol repository. Link to original methods and reagent documents; store design logic and evidence boundaries.

### P2 · External hub, link health and release QA

Estimated focus: final 10% of effort.

1. Include `data/resources.json` in weekly link checks.
2. Record redirect target, TLS status, HTTP status and last successful check.
3. Preserve a resource when temporarily unavailable, but display degraded status.
4. Add mobile and keyboard QA for the knowledge graph and dialogs.
5. Consolidate CSS only if no functional regression.
6. Run all checks, preview locally, then commit. Do not push or deploy unless explicitly authorized in the active task.

Acceptance:

- all first-party/official external links open or show a clear degraded state;
- keyboard users can select graph nodes and close dialogs;
- no horizontal overflow at 390 px width;
- GitHub Pages artifact includes `v09.css` and all new data files;
- `npm run check` passes from a clean checkout.

## 7. Commands

```bash
cd /Users/chenjingquan/Projects/ferroscope
npm run check:v09
npm run check
npm start
```

The deployment workflow must copy:

```text
index.html
app.js
styles.css
v09.css
README.md
data/
```

## 8. Do not do these things

- Do not bulk-publish machine-translated scientific interpretation.
- Do not delete the legacy Chinese audit archive after migration; it is provenance.
- Do not merge canonical paper data and laboratory contribution data.
- Do not convert every tag into a knowledge-graph edge.
- Do not infer laboratory activity solely from author-name matching.
- Do not present preprints, observational trials or ex situ human organs as clinical proof.
- Do not suppress contradictions among organelle or disease models.
- Do not add a backend, database server, framework migration or authentication during this one-week phase.
- Do not redesign the visual identity before evidence and data integrity are complete.
- Do not push, publish, delete or rewrite Git history without explicit authorization.

## 9. Definition of v1.0 complete

FerroScope v1.0 is ready when:

- all public narrative is English, with CJK restricted to glossary translations and search aliases;
- 37 laboratories have an English question, capability map, official website and attribution-safe representative works;
- at least 10 highest-value papers have source-checked English three-scale reading records;
- methods distinguish common assays from distinctive capabilities and retain “cannot prove alone” boundaries;
- the graph connects labs, papers, methods, mechanisms and contexts with typed, source-backed edges;
- external resources are categorized, HTTPS where possible and health-checked;
- automated alerts remain visibly different from curated interpretation;
- correction, retraction and Editor’s Note events propagate through the paper record;
- validation and responsive UI checks pass from a clean checkout.

## 10. First command for the next session

Read this file and `README.md`, then run:

```bash
npm run check:v09 && git status --short
```

Before editing, report which P0 item is being executed and which files it owns. Work in small commits that preserve a clean rollback path.
