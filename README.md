# FerroScope · Global Ferroptosis Research System

FerroScope is an English-first research-intelligence website for ferroptosis and lipid biochemistry. It connects current research signals, laboratories, experimental methods, mechanisms, terminology and external research routes while keeping evidence limitations visible.

## What v0.9 adds

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
npm run check:v09
npm run check
```

`check:v09` verifies English laboratory coverage, trilingual terminology fields, method-to-laboratory foreign keys, typed mechanism links, HTTPS resources and complete English curated-signal briefs.

## Refresh first-party intelligence

```bash
npm run update
npm run check
```

Automated source ingestion reads PubMed, preprint metadata and ClinicalTrials.gov. Curated interpretation and automated alerts are stored separately. The deployed workflow runs every six hours; this is near-real-time monitoring, not a live market feed.

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
- `data/methods.json`: method principle, measurement boundary, best practice, failure modes and distinctive laboratories;
- `data/knowledge-network.json`: typed mechanism relations and method links;
- `data/glossary.json`: English definitions with Chinese and Japanese terminology aliases;
- `data/resources.json`: external research resources with authority and caution labels;
- `data/signal-briefs-en.json`: verified English overlays for curated signals;
- `data/live.json`: automated alerts;
- `data/lab-research.json`: legacy evidence and figure-audit archive, not directly rendered in public narrative.

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

See `CLAUDE_CODE_HANDOFF.md` for the next implementation phase and acceptance criteria.
