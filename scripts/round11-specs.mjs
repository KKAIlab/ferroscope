// Round-11 specs: three founding/defining defence-arm papers brought into the English layer at the
// BIBLIOGRAPHIC level. Unlike the round 8-10 archive-derived migrations, these papers are NOT in the
// project's figure-audit archive, so there is no figure chain to translate. What is source-checked is
// only their Crossref bibliographic spine (title, journal, pagination, dates, author list), re-queried
// live in this pass; their scientific content is summarised at abstract level from the public record and
// is explicitly NOT figure-audited. They exist so the mechanism graph's GCH1-BH4, mevalonate-sterol and
// system xc- defence arms can be anchored to a real, named source instead of an unsourced assertion.
//
// verificationDepth is "metadata-checked" (the honest ceiling: we verified the metadata, not the
// figures); readingDepth is "abstract"; the record carries no figureAudit and a recorded-unverified
// baseline, so nothing here can be mistaken for a figure-level reading.

export const SPECS = [
  {
    doi: "10.1016/j.cell.2012.03.042",
    title: "Ferroptosis: an iron-dependent form of nonapoptotic cell death",
    journal: "Cell",
    year: 2012,
    citation: "Dixon SJ, et al. Cell. 2012;149(5):1060-1072.",
    theme: "the report that named ferroptosis and its system xc- dependence",
    crossrefFinding:
      "Crossref confirms this is the paper: the same DOI, Cell volume 149 issue 5 pages 1060-1072 (2012), and the twelve-author list opening with Scott J. Dixon and closing with Brent R. Stockwell. The title is recorded here in the sentence case used by this project's archive, which differs only in capitalisation from the publisher's title-case rendering. The check settles the bibliographic record only and establishes nothing about the paper's figures, methods or specific quantitative claims.",
    conditionVector:
      "Human cancer cell lines including engineered RAS-mutant fibrosarcoma and HT-1080, treated with the small molecules erastin and RSL3 over hours; readouts of viability, cytosolic and lipid reactive oxygen species, and rescue by iron chelators (deferoxamine) and lipophilic antioxidants; mechanism assessed by cystine deprivation and glutathione measurement rather than by a single in vivo model.",
    sixtySecond: {
      story: "A RAS-selective lethal compound killed cells in a way that did not look like apoptosis, necrosis or autophagy, and the identity of that death pathway was unresolved.",
      advance: "The paper introduced the term ferroptosis for an iron-dependent, non-apoptotic death and tied it pharmacologically to loss of cystine import through system xc- and to glutathione depletion.",
      evidenceAnchor: "Erastin blocks the cystine/glutamate antiporter system xc-, depleting glutathione; the resulting death needs iron and is rescued by iron chelation and by lipophilic radical-trapping antioxidants.",
      scope: "The 2012 work defined ferroptosis pharmacologically in cultured cancer cells; it did not resolve the terminal membrane-execution chemistry and did not rest on animal models.",
      openQuestion: "What exactly executes the lethal membrane damage downstream of glutathione loss, and where system xc- dependence does and does not hold in vivo.",
    },
    labs: [
      { labId: "stockwell-columbia", role: "lead", roleBasis: "Brent Stockwell is the last (senior) author on the Crossref author record for this paper and the study was carried out in his Columbia laboratory.", continuity: "Anchors the Stockwell laboratory's founding role in defining ferroptosis and the system xc- axis this dashboard tracks." },
      { labId: "dixon-stanford", role: "pre-independence", roleBasis: "Scott Dixon is the first author on the Crossref author record; the work predates his independent Stanford laboratory, so it is recorded as pre-independence rather than as his laboratory's own output.", continuity: "The founding ferroptosis paper on which Dixon's later independent system xc- and membrane-lipid work builds." },
    ],
  },
  {
    doi: "10.1021/acscentsci.9b01063",
    title: "GTP Cyclohydrolase 1/Tetrahydrobiopterin Counteract Ferroptosis through Lipid Remodeling",
    journal: "ACS Central Science",
    year: 2020,
    citation: "Kraft VAN, et al. ACS Cent Sci. 2020;6(1):41-53.",
    theme: "GCH1-BH4 as an endogenous radical-trapping defence arm",
    crossrefFinding:
      "Crossref confirms the exact title, ACS Central Science volume 6 issue 1 pages 41-53, the seventeen-author list opening with Vanessa A. N. Kraft, and the DOI. It settles the bibliographic record only and establishes nothing about the paper's figures, lipidomics or specific quantitative claims.",
    conditionVector:
      "Cancer cell lines with GTP cyclohydrolase 1 (GCH1) overexpression and depletion, challenged with GPX4-inhibitor and system xc--inhibitor ferroptosis inducers over hours; readouts of tetrahydrobiopterin and dihydrobiopterin levels, C11-BODIPY lipid peroxidation, and untargeted lipidomics, with dihydrofolate reductase inhibition used to probe BH4 recycling; conclusions drawn in cell culture rather than a single in vivo model.",
    sixtySecond: {
      story: "A genetic screen flagged GCH1 as a ferroptosis-suppressing gene, but how the GCH1-tetrahydrobiopterin pathway protected membranes was not defined.",
      advance: "The paper describes GCH1-derived tetrahydrobiopterin (BH4) as an endogenous radical-trapping antioxidant that, together with lipid remodelling, raises the ferroptosis threshold independently of GPX4.",
      evidenceAnchor: "Raising GCH1 increases BH4 and protects against ferroptosis inducers, while the protection tracks with BH4 abundance and with a shift in membrane lipid composition rather than with GPX4 activity.",
      scope: "The mechanism is characterised in cultured cells with genetic and pharmacological manipulation of the BH4 pathway; tissue-level and therapeutic relevance are not settled here.",
      openQuestion: "How large the GCH1-BH4 arm's contribution is relative to GPX4 and FSP1 across tissues, and how its lipid-remodelling and radical-trapping roles are weighted.",
    },
    labs: [
      { labId: "stockwell-columbia", role: "contributing-author", roleBasis: "Brent Stockwell appears as author fifteen of seventeen on the Crossref author record; a contributing author, not the senior or corresponding laboratory of this paper.", continuity: "Connects to the Stockwell laboratory's continuing work on ferroptosis-suppressing metabolism and radical-trapping antioxidants." },
    ],
  },
  {
    doi: "10.1038/s41586-023-06878-9",
    title: "7-Dehydrocholesterol is an endogenous suppressor of ferroptosis",
    journal: "Nature",
    year: 2024,
    citation: "Freitas FP, et al. Nature. 2024;626(7998):401-410.",
    theme: "7-dehydrocholesterol from the mevalonate-sterol pathway as an anti-ferroptotic lipid",
    crossrefFinding:
      "Crossref confirms the exact title, Nature volume 626 issue 7998 pages 401-410 (2024), the forty-seven-author list opening with Florencio Porto Freitas and closing with Jose Pedro Friedmann Angeli, and the DOI. It settles the bibliographic record only and establishes nothing about the paper's figures, in vivo models or specific quantitative claims.",
    conditionVector:
      "Cancer cell lines and tumour models in which the sterol-biosynthesis enzyme DHCR7 and 7-dehydrocholesterol (7-DHC) levels are manipulated genetically and pharmacologically, challenged with GPX4-inhibitor and other ferroptosis inducers; readouts of lipid peroxidation, 7-DHC accumulation and cell death, extended into xenograft and lymphoma models rather than cell culture alone.",
    sixtySecond: {
      story: "The mevalonate-sterol pathway was known to influence ferroptosis mainly through coenzyme Q, but whether a sterol intermediate itself protected membranes was unclear.",
      advance: "The paper identifies 7-dehydrocholesterol, a cholesterol precursor made through the mevalonate pathway, as an endogenous lipid that suppresses ferroptosis by shielding membranes from peroxidation.",
      evidenceAnchor: "Raising 7-DHC, for example by blocking the downstream enzyme DHCR7, reduces phospholipid peroxidation and protects cells and tumours from ferroptosis, while lowering 7-DHC sensitises them.",
      scope: "The protective role is shown for 7-DHC across cell and tumour models; the balance between this arm and the GPX4, FSP1 and BH4 defences in normal tissue is not resolved here.",
      openQuestion: "How broadly 7-DHC accumulation shapes ferroptosis sensitivity in normal physiology and disease, and how it can be exploited without disturbing sterol metabolism.",
    },
    labs: [
      { labId: "angeli-wurzburg", role: "lead", roleBasis: "Jose Pedro Friedmann Angeli is the last (senior) author on the Crossref author record for this paper.", continuity: "Extends the Angeli laboratory's work on endogenous radical-trapping and lipid defences against ferroptosis." },
      { labId: "conrad-helmholtz", role: "contributing-author", roleBasis: "Marcus Conrad appears as author forty-six of forty-seven (second to last) on the Crossref author record; recorded conservatively as a contributing author absent confirmation of co-corresponding status.", continuity: "Links to the Conrad laboratory's long study of the ferroptosis-suppressing defence network." },
    ],
  },
];
