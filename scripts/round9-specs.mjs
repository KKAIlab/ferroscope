// Round-9 migration specs: the remaining 6 figure-audited backlog papers (2016-2023),
// same honest recipe as round 8 (see scripts/round8-specs.mjs and DELIVERY_AUDIT_ROUND8.md).
// Titles are byte-identical to the legacy archive; author positions in each roleBasis were read
// from the ordered Crossref author list on 2026-07-24. Figure chains enter archive-derived with
// no scopeRef; only the Crossref metadata spine is source-checked.
//
// Attribution notes verified at Crossref 2026-07-24:
//  - molcel.2018.10.042 (Role of Mitochondria): Minghui Gao is FIRST author, senior/last author is
//    Xuejun Jiang; the work predates Gao's independent HIT laboratory -> role "pre-independence".
//  - nchembio.2105 (Fluorescence probes): Ken-ichi Yamada is FIRST author and originator of the
//    NBD-Pen probe line; last author Mayumi Yamato is the senior radical-detection collaborator;
//    Crossref marks no corresponding author -> role "co-lead" (conservative, not sole lead).

export const SPECS = [
  {
    doi: "10.1016/j.cell.2023.05.003",
    title: "Ferroptosis surveillance independent of GPX4 and differentially regulated by sex hormones",
    journal: "Cell",
    year: 2023,
    citation: "Cell 186, 2748-2764.e22",
    crossrefFinding:
      "Cell, volume 186, issue 13, pages 2748-2764.e22, published 2023, 10 authors, first author " +
      "Deguang Liang, last author Xuejun Jiang. No correction, erratum, retraction or update relation " +
      "is registered against this DOI at Crossref, verified 2026-07-24.",
    theme: "MBOAT1/2 acyltransferases as a GPX4-independent membrane defence tuned by sex hormones",
    conditionVector:
      "HT-1080, prostate (LnAR) and ER-positive breast (MCF7) cancer cells in culture and inducible " +
      "GPX4-knockout xenografts; perturbations are genome-wide CRISPRa, MBOAT2 and MBOAT1 " +
      "overexpression and catalytic mutants, SCD1/ACSL3 manipulation, oleic-acid supplementation, and " +
      "androgen (DHT, enzalutamide, ARV-110) and estrogen (fulvestrant) receptor modulation; readouts " +
      "are cell survival with ferrostatin-1 rescue, 370-species phospholipid LC-MS, receptor ChIP-qPCR, " +
      "C11-BODIPY, 4-HNE/PTGS2 and xenograft growth over acute-to-subacute windows.",
    sixtySecond: {
      story: "Cells clear lipid peroxides through GPX4 and FSP1, but whether a separate membrane-composition defence also sets ferroptosis sensitivity was unclear.",
      advance: "The work identifies MBOAT1 and MBOAT2 as acyltransferases that write monounsaturated fatty acids into phospholipids and reduce oxidizable PUFA-phospholipid species, a GPX4-independent defence that androgen and estrogen receptors maintain in specific tumours.",
      evidenceAnchor: "A gain-of-function CRISPRa screen, MBOAT2/1 overexpression and catalytic-mutant rescue, 370-species lipidomics showing raised PE-MUFA and lowered PE-arachidonoyl species, receptor ChIP, and endocrine-drug plus GPX4-stress synergy in xenografts.",
      scope: "Much of the causal work starts from forced overexpression or gain-of-function screening and uses experimental GPX4 knockout as the in vivo ferroptosis stress, so it shows the defence is sufficient in these settings rather than that endogenous MBOAT levels protect every tissue.",
      openQuestion: "Do endogenous MBOAT1/2 levels set ferroptosis sensitivity in patient tumours, and can an endocrine drug plus a clinical GPX4-pathway inhibitor reach the same synergy without an engineered knockout?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Is there a defence beyond GPX4 and FSP1 that resists both cystine starvation and GPX4 inhibition?", intervention: "A genome-wide CRISPRa gain-of-function screen in HT-1080 with two rounds of positive selection, ferrostatin-1 reverse-rescue, and GPX4-knockout and GPX4/FSP1 double-knockout backgrounds.", readout: "Enriched protective hits, and cell survival and lipid oxidation on MBOAT2 overexpression.", answer: "The screen returns MBOAT2 as a shared hit, and MBOAT2 overexpression suppresses death and lipid oxidation under IKE, cystine starvation, RSL3 and GPX4 or GPX4/FSP1 loss.", boundary: "This is a gain-of-function screen and overexpression starting point; forced high expression cannot show that endogenous MBOAT2 is sufficient in every tissue, and the screen hit does not itself give the enzyme's substrate or lipid product." },
      { figure: "Fig. 2", question: "Does MBOAT2 protection depend on a monounsaturated-fatty-acid source and acyl activation?", intervention: "SCD1 and ACSL3 pharmacological and genetic perturbation in a GPX4-knockout background, oleic-acid supplementation, and MBOAT2 re-expression.", readout: "Survival timing and dependence on SCD1-derived and exogenous MUFA.", answer: "SCD1 inhibition or loss weakens protection and exogenous oleic acid restores it when SCD1 is absent; ACSL3 is required for both endogenous and exogenous MUFA to enter the protective pathway.", boundary: "Exogenous oleic acid needs hours of pretreatment, a carrier and ACSL3-mediated membrane remodelling; this is not acute radical scavenging and not a dietary oleic-acid recommendation." },
      { figure: "Fig. 3", question: "Does MBOAT2 change the ferroptosis threshold by writing MUFA into specific phospholipids and displacing PUFA?", intervention: "LC-MS of 370 lipid species with PE/PC fractionation, an MBOAT2 catalytic mutant (H373A), time-resolved death, and two shRNAs against endogenous MBOAT2.", readout: "PE-MUFA versus PE-arachidonoyl/adrenoyl abundance and sensitivity of pancreatic-cancer cells.", answer: "MBOAT2 raises several PE-MUFA species and lowers PE-arachidonoyl/adrenoyl species, the catalytic mutant loses protection, and MBOAT2 knockdown sensitizes pancreatic-cancer cells.", boundary: "The measurement is largely unoxidized total phospholipid abundance and does not give the formation flux of each oxidized PE; competitive displacement is a model consistent with the genetics, not a per-species demonstration of lethal weight." },
      { figure: "Fig. 4", question: "Does the androgen receptor in prostate cancer directly maintain the MBOAT2 defence?", intervention: "TCGA and cell-line expression, DHT and enzalutamide, AR knockdown/overexpression, AR ChIP-qPCR, MBOAT2 re-expression, and lipidomics with RSL3/IKE response.", readout: "AR-MBOAT2 transcriptional axis, and lipid and ferroptosis sensitivity changes.", answer: "AR-positive cells express more MBOAT2, and DHT, AR antagonism, AR knockdown/overexpression and promoter occupancy together support an AR-MBOAT2 transcriptional axis that shifts lipids and sensitivity.", boundary: "AR reshapes many metabolic and growth programmes at once; a cohort expression correlation and a few cell lines cannot show MBOAT2 is the only mediator of AR-linked resistance." },
      { figure: "Fig. 5", question: "Can dismantling AR-MBOAT2 increase prostate-cancer ferroptosis in vivo?", intervention: "Two-dimensional combination dose matrices, genetic rescue, lipid-oxidation readouts, and a doxycycline-inducible GPX4-knockout LnAR xenograft with histology.", readout: "Synergy of enzalutamide/ARV-110 with RSL3/GPX4 loss, tumour burden and 4-HNE/PTGS2.", answer: "Enzalutamide or ARV-110 synergizes with RSL3 or GPX4 loss, MBOAT2 overexpression or oleic acid partly reverses it, and combination treatment suppresses inducible-GPX4-knockout LnAR xenografts with higher 4-HNE/PTGS2.", boundary: "The endocrine drug is given for 48 hours first and the in vivo ferroptosis stress comes from experimental GPX4 knockout; no clinical GPX4 inhibitor replaces that combination and the xenograft does not assess immune effects." },
      { figure: "Fig. 6", question: "Do female-hormone-linked tumours use the corresponding MBOAT1-ER defence?", intervention: "MBOAT-family comparison, catalytic and lipidomic analysis, ER/FOXA1 expression and ChIP, fulvestrant, and MBOAT1 genetic rescue.", readout: "MBOAT1 protection and PE-MUFA in ER-positive breast cancer.", answer: "MBOAT1 protects GPX4-deficient cells and raises PE-MUFA like MBOAT2, and in ER-positive breast cancer the estrogen receptor occupies and maintains MBOAT1 while fulvestrant lowers it and raises sensitivity.", boundary: "MBOAT1 and MBOAT2 tissue expression and substrate preference are not interchangeable; TCGA and cell-line correlations still need patient endocrine-resistant samples and direct enzymatic validation." },
      { figure: "Fig. 7", question: "Can fulvestrant re-expose a ferroptosis weakness in endocrine-resistant ER-positive breast cancer?", intervention: "Dose matrices, MBOAT1 re-expression, linoleic-acid sensitization, C11-BODIPY, and combination treatment of resistant cells and an MCF7-FulR xenograft.", readout: "Fulvestrant plus RSL3/IKE synergy in parental and resistant cells and in vivo.", answer: "Fulvestrant synergizes with RSL3/IKE in parental and resistant cells, MBOAT1 re-expression lowers the effect, and fulvestrant plus IKE outperforms single agents in an MCF7-FulR xenograft.", boundary: "Fulvestrant being in clinical use does not mean its combination with experimental IKE is clinically feasible; the closing Fig. 7M pathway diagram with a question mark is the authors' model, not a new causal experiment." },
    ],
    labs: [
      { labId: "jiang-msk", role: "lead", roleBasis: "Last author of the 10-author Crossref author list (Xuejun Jiang), verified at Crossref on 2026-07-24. The contribution statement was not re-read in this pass.", continuity: "Extends the laboratory's work on GPX4-independent ferroptosis surveillance and how membrane lipid composition sets the ferroptosis threshold." },
    ],
  },

  {
    doi: "10.1016/j.chembiol.2018.11.016",
    title: "Exogenous Monounsaturated Fatty Acids Promote a Ferroptosis-Resistant Cell State",
    journal: "Cell Chemical Biology",
    year: 2019,
    citation: "Cell Chemical Biology 26, 420-432.e9",
    crossrefFinding:
      "Cell Chemical Biology, volume 26, issue 3, pages 420-432.e9, published 2019 (issue year; the " +
      "DOI dates online publication to 2018), 12 authors, first author Leslie Magtanong, last author " +
      "Scott J. Dixon. No correction, erratum, retraction or update relation is registered against " +
      "this DOI at Crossref, verified 2026-07-24.",
    theme: "exogenous monounsaturated fatty acids building a ferroptosis-resistant membrane state",
    conditionVector:
      "Transformed and non-transformed cells in culture; perturbations are exogenous oleic and " +
      "palmitoleic acid at 125-500 uM with structural fatty-acid series, erastin-class and RSL3/ML162 " +
      "inducers, ACSL3 knockout, SCD1 and DGAT inhibition, and ferrostatin-1/DFO controls; readouts " +
      "are 72-hour death kinetics, glutamate release and total glutathione, C11-BODIPY flow and " +
      "confocal with plasma-membrane masking, targeted lipidomics and AA-alkyne click imaging over " +
      "hours-long preconditioning windows.",
    sixtySecond: {
      story: "Serum carries monounsaturated fatty acids, but whether an exogenous fatty acid could selectively change ferroptosis sensitivity was not established.",
      advance: "The work shows oleic and palmitoleic acid build a ferroptosis-resistant cell state not by neutralizing the inducer but by ACSL3-dependent activation that displaces oxidizable PUFA from membrane phospholipids over time.",
      evidenceAnchor: "A fatty-acid by inducer matrix, exclusion of system xc-/GSH/GPX4 upstream nodes, plasma-membrane-masked C11-BODIPY imaging, targeted lipidomics and AA-alkyne click showing lowered PUFA-phospholipid incorporation, and loss of protection in ACSL3-knockout cells.",
      scope: "All work is in cultured cells with 125-500 uM fatty-acid loading over a multi-hour preconditioning window, and the protection is a state change rather than acute scavenging, so it does not translate to a dietary MUFA recommendation.",
      openQuestion: "Which acyl-CoA synthetases beyond ACSL3 can compensate, and does the same membrane-remodelling state set ferroptosis sensitivity under physiological fatty-acid supply in vivo?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Can a common exogenous fatty acid selectively change ferroptosis sensitivity?", intervention: "A fatty-acid by lethal-compound matrix, 72-hour death kinetics across multiple cell lines, ferrostatin-1/DFO controls, and a structural fatty-acid series.", readout: "Selective suppression of erastin-class death by cis-MUFA versus trans or different-chain analogues.", answer: "Oleic and palmitoleic acid selectively suppress erastin-class death across transformed and non-transformed cells, while structurally related trans or different-chain-length fatty acids do not protect equally.", boundary: "Comparing medium free-fatty-acid totals to serum values does not equate albumin binding and effective activity, and 125-500 uM supplementation is an in vitro loading condition." },
      { figure: "Fig. 2", question: "Does MUFA protection act upstream at system xc-/GSH/GPX4 or downstream by remodelling the membrane?", intervention: "Glutamate release, total glutathione, CHAC1 qPCR, low-cystine and inducible Gpx4 deletion, a DPPH chemical assay, and GPX4/ACSL4 protein blots.", readout: "Whether oleic acid restores upstream nodes or scavenges radicals directly, versus protecting downstream.", answer: "Oleic acid does not restore system xc-, glutathione or CHAC1 and does not scavenge DPPH directly, yet protects low-cystine and Gpx4-deletion models, placing its action downstream of or parallel to GPX4.", boundary: "This localization is by excluding measured upstream nodes; a negative DPPH result cannot exclude all membrane-phase antioxidant chemistry, and GPX4 substrate turnover was not directly measured." },
      { figure: "Fig. 3", question: "Does MUFA specifically suppress the plasma-membrane lipid ROS linked to terminal membrane damage?", intervention: "C11-BODIPY flow and confocal with plasma-membrane and perinuclear region masks, DFO/Fer-1 controls, and pre-death morphological timing.", readout: "Regional C11 oxidation and membrane blebbing.", answer: "Total flow C11 oxidation changes little, but imaging shows oleic acid reduces plasma-membrane-region C11 oxidation and blebbing while some perinuclear oxidation remains.", boundary: "C11-BODIPY redistributes between membranes, and the mask plus probe redistribution can affect the signal; plasma-membrane oxidation correlating with death does not show it is the only execution site." },
      { figure: "Fig. 4", question: "Does protection require gradual displacement of oxidizable PUFA from membrane phospholipids?", intervention: "Targeted lipidomics, free-fatty-acid and acylcarnitine controls, AA-alkyne click imaging, plasma-membrane quantification, and varied preconditioning durations.", readout: "PUFA-phospholipid and plasma-membrane AA-alkyne incorporation versus preconditioning time.", answer: "Oleic acid lowers several PUFA-containing phospholipids and plasma-membrane AA-alkyne incorporation, and at least about 6-10 hours of pretreatment is needed for stable protection, so acute co-addition does not block fast ML162 death.", boundary: "A click AA analogue and a limited lipid panel cannot give total membrane flux; the time dependence indicates state remodelling rather than immediate pharmacological rescue." },
      { figure: "Fig. 5", question: "Which acyl-CoA synthetase converts exogenous MUFA into the protective membrane state?", intervention: "Two ACSL3-knockout clones, OA-alkyne membrane incorporation, C11 imaging, dose-dependence, DGAT double inhibition, lipid-droplet staining, and CTRP cell-line correlation.", readout: "Membrane incorporation, plasma-membrane C11 protection and tolerance versus ACSL3.", answer: "ACSL3 loss lowers oleic-acid entry into phospholipids, plasma-membrane C11 protection and tolerance; high oleic-acid concentration partly bypasses this and DGAT-dependent droplet formation is not required.", boundary: "ACSL3 dependence varies with concentration, suggesting other ACSL can compensate; a CTRP expression-sensitivity correlation is not a patient causal marker, and the DGAT conclusion is confined to acute cell models." },
      { figure: "Fig. 6", question: "Does MUFA use the same mechanism to protect against ferroptosis and saturated-fatty-acid lipotoxicity?", intervention: "Oleate/palmitate/erastin combinations, ferrostatin-1, SCD1 inhibition, DGAT inhibition, and ACSL3 wild-type versus knockout death comparison.", readout: "Oleic-acid protection against erastin ferroptosis versus palmitate apoptotic lipotoxicity and its ACSL3 dependence.", answer: "Oleic acid suppresses both erastin ferroptosis and palmitate lipotoxicity, but ACSL3 is more critical for the former and less for the latter, indicating the two protective mechanisms are separable.", boundary: "Oleic acid is not a ferroptosis-specific compound; it alters several lipid-toxicity pathways, so its effect must be interpreted separately by death trigger and ACSL3 dependence." },
    ],
    labs: [
      { labId: "dixon-stanford", role: "lead", roleBasis: "Last author of the 12-author Crossref author list (Scott J. Dixon), verified at Crossref on 2026-07-24. The contribution statement was not re-read in this pass.", continuity: "Extends the laboratory's work on the lipid determinants of ferroptosis, here how exogenous monounsaturated fatty acids remodel membranes into a resistant state." },
    ],
  },

  {
    doi: "10.1016/j.molcel.2018.10.042",
    title: "Role of Mitochondria in Ferroptosis",
    journal: "Molecular Cell",
    year: 2019,
    citation: "Molecular Cell 73, 354-363.e3",
    crossrefFinding:
      "Molecular Cell, volume 73, issue 2, pages 354-363.e3, published 2019 (issue year; the DOI " +
      "dates online publication to 2018), 7 authors, first author Minghui Gao, last author Xuejun " +
      "Jiang. A has-review relation is registered; no correction, erratum, retraction or update " +
      "relation is registered against this DOI at Crossref, verified 2026-07-24.",
    theme: "mitochondria as a conditional, induction-specific driver of ferroptosis",
    conditionVector:
      "Cancer cells in culture, including Parkin-expressing and FH-mutant renal-cancer lines; " +
      "perturbations are Parkin/CCCP-induced mitophagy, glutaminolysis and TCA inhibition with " +
      "cell-permeable TCA-intermediate rescue, electron-transport-chain complex inhibitors, and CCCP " +
      "depolarization; the ferroptosis triggers are cystine deprivation, erastin, RSL3 and GPX4 " +
      "knockout; readouts are cell survival, C11-BODIPY lipid ROS, mitochondrial lipid oxidation and " +
      "TMRE membrane potential over acute-to-48-hour windows.",
    sixtySecond: {
      story: "Mitochondria are central to many forms of cell death, but their role in ferroptosis was contested.",
      advance: "The work indicates mitochondria are not a universal ferroptosis executioner but a conditional driver: under cysteine deprivation, glutaminolysis-TCA-ETC metabolism and membrane-potential changes provide oxidative drive, while direct GPX4 inactivation kills without that mitochondrial contribution.",
      evidenceAnchor: "Parkin/CCCP mitochondrial clearance, glutaminolysis inhibition with cell-permeable TCA-intermediate rescue, ETC complex inhibitors, TMRE hyperpolarization reversed by CCCP, and the key contrast that mitochondrial reduction protects cystine deprivation and erastin but not RSL3 or GPX4 knockout.",
      scope: "Most manipulations are acute high-dose pharmacology or a 48-hour Parkin/CCCP protocol that reshapes energy, iron and lipid metabolism at once, so the work supports a conditional metabolic role rather than a clean mitochondrial ablation, and does not cover every inducer class.",
      openQuestion: "Which specific mitochondrial oxidation reaction under the membrane-potential change feeds lethal lipid peroxidation, and does the induction-specific mitochondrial dependence hold in vivo?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Does greatly reducing functional mitochondria selectively block cystine-deprivation ferroptosis?", intervention: "Parkin-expressing cells with CCCP-induced mitophagy, mitochondrial-protein and imaging validation, and survival with C11-BODIPY.", readout: "Death, lipid ROS and mitochondrial-membrane lipid oxidation after mitochondrial clearance.", answer: "After CCCP-induced mitophagy in Parkin cells, cystine-deprivation and erastin death, lipid ROS and mitochondrial-membrane lipid oxidation all fall.", boundary: "The protocol includes about 48 hours of CCCP plus recovery, which reshapes energy, iron, lipid and antioxidant metabolism; this is not a side-effect-free mitochondrial ablation, and C11 co-localization is not an oxidized-lipid flux measurement." },
      { figure: "Fig. 2", question: "Is carbon flow from glutaminolysis into the TCA cycle required for cysteine-deprivation death?", intervention: "Glutamine withdrawal or metabolic inhibition, supplementation with cell-permeable dimethyl TCA intermediates such as alpha-ketoglutarate, and survival with lipid-ROS readouts.", readout: "Protection on blocking glutaminolysis and re-establishment on TCA-intermediate add-back.", answer: "Inhibiting glutaminolysis or removing a key metabolic input protects, while cell-permeable TCA intermediates re-establish lipid oxidation and death.", boundary: "High-concentration dimethyl-ester exposure, ester hydrolysis and non-physiological effects are complex; add-back supports the metabolic position without showing a single endogenous intermediate directly oxidizes membrane lipids." },
      { figure: "Fig. 3", question: "Does the electron-transport chain downstream of the TCA cycle convert metabolic flux into the oxidative pressure ferroptosis needs?", intervention: "Several complex I-IV inhibitors with dose-response, cell survival and lipid ROS.", readout: "Lipid ROS and death under ETC inhibition.", answer: "Multiple complex I-IV inhibitors lower cystine-deprivation/erastin lipid ROS and death, supporting the ETC as a conditional pro-death node.", boundary: "Most are acute high-dose pharmacology that can also change ATP, oxygen consumption, membrane potential and ion balance at once; equally strong per-complex genetic validation is lacking." },
      { figure: "Fig. 4", question: "Does cysteine deprivation cause a mitochondrial membrane-potential change linked to death?", intervention: "TMRE flow and imaging time course, CCCP depolarization, and survival with lipid-ROS co-measurement.", readout: "Mitochondrial hyperpolarization and its reversal.", answer: "Cysteine deprivation causes mitochondrial hyperpolarization, and CCCP depolarization lowers it and suppresses lipid oxidation and death, supporting a role for membrane potential.", boundary: "TMRE depends on mitochondrial mass, dye loading and cell state; CCCP broadly reshapes metabolism, so the figure supports a functional association without identifying the downstream oxidation reaction." },
      { figure: "Fig. 5", question: "Does mitochondrial dependence depend on how ferroptosis is induced?", intervention: "The same genetic and pharmacological backgrounds compared across cystine deprivation, erastin, RSL3 and GPX4 knockout, with survival and lipid ROS.", readout: "Which inducers are protected by mitochondrial reduction or ETC inhibition.", answer: "Mitochondrial reduction or ETC inhibition protects against cystine deprivation and erastin but not RSL3 or GPX4 knockout, establishing induction-mode dependence.", boundary: "This is the paper's most important negative boundary: RSL3 and GPX4 knockout are not protected by mitochondrial reduction, so the first four figures cannot be generalized to 'ferroptosis requires mitochondria', and other inducer classes such as FIN56 and FINO2 are not exhausted." },
      { figure: "Fig. 6", question: "Do tumour genotypes that block the TCA cycle show corresponding ferroptosis resistance?", intervention: "FH-deficient renal-cancer cells and paired FH-reconstituted models, with metabolic and death phenotypes.", readout: "Cystine-deprivation tolerance versus FH status.", answer: "FH-deficient renal-cancer cells and paired reconstitution models are more tolerant of cystine deprivation, supporting a link between TCA function and this induction type.", boundary: "A few paired cell lines cannot exclude long-term tumour adaptation and other genetic differences, and no in vivo work shows this resistance decides FH-deficient tumour onset or treatment response." },
    ],
    labs: [
      { labId: "gao-hit", role: "pre-independence", roleBasis: "First author of the 7-author Crossref author list (Minghui Gao), with senior last author Xuejun Jiang, verified at Crossref on 2026-07-24. The work predates the independent Harbin Institute of Technology laboratory and must not be presented as that laboratory leading it.", continuity: "Origin of the laboratory's later work on the metabolic and mitochondrial control of ferroptosis, done as first author before the independent laboratory." },
    ],
  },

  {
    doi: "10.1038/s41586-019-1170-y",
    title: "CD8+ T cells regulate tumour ferroptosis during cancer immunotherapy",
    journal: "Nature",
    year: 2019,
    citation: "Nature 569, 270-274",
    crossrefFinding:
      "Nature, volume 569, issue 7755, pages 270-274, published 2019, 30 authors, first author " +
      "Weimin Wang, last author Weiping Zou. No correction, erratum, retraction or update relation is " +
      "registered against this DOI at Crossref, verified 2026-07-24.",
    theme: "CD8+ T cell IFN-gamma sensitizing tumours to ferroptosis during immunotherapy",
    conditionVector:
      "Immune-competent ID8 and B16 mouse tumour models and human and mouse tumour cells; " +
      "perturbations are PD-L1/CTLA-4 checkpoint blockade, OT-I T-cell transfer, IFN-gamma " +
      "neutralization, tumour IFNGR1 and STAT1 knockout, engineered cyst(e)inase, and systemic " +
      "liproxstatin-1; readouts are CD45-negative tumour-cell C11-BODIPY oxidation, SLC7A11/SLC3A2 " +
      "expression and 14C-cystine uptake, glutathione, tumour control, and paired patient nivolumab " +
      "transcriptomes over 24-40 hour and in vivo windows.",
    sixtySecond: {
      story: "Checkpoint immunotherapy activates cytotoxic T cells, but whether those T cells also change how tumour cells die by ferroptosis was unknown.",
      advance: "The work shows immunotherapy-activated CD8+ T cells secrete IFN-gamma that, through tumour IFNGR1-STAT1, lowers system xc- and cystine/glutathione and sensitizes tumour cells to ferroptosis, so metabolic cyst(e)ine depletion synergizes with checkpoint blockade.",
      evidenceAnchor: "Checkpoint blockade and OT-I transfer raising tumour-cell C11-BODIPY with liproxstatin-1 partly reversing efficacy, IFN-gamma as the key soluble signal, IFNGR1/STAT1 knockout and system xc- downregulation, engineered cyst(e)inase synergy, and paired patient nivolumab transcriptomes.",
      scope: "Most mechanism uses 24-40 hour IFN-gamma pretreatment of cultured cells and small in vivo cohorts, and the patient data are observational expression associations, so the axis is supported alongside, not instead of, contact-dependent and other cytotoxic mechanisms.",
      openQuestion: "How much of immunotherapy-driven tumour killing runs through ferroptosis rather than perforin/granzyme or Fas, and can cyst(e)ine depletion plus checkpoint blockade reach that synergy safely in patients?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Do immunotherapy-activated CD8+ T cells increase tumour-cell lipid oxidation in vivo and make ferroptosis contribute to tumour control?", intervention: "Immune-competent ID8/B16 models, PD-L1/CTLA-4 blockade, OT-I antigen transfer, CD45-negative tumour-gated C11-BODIPY, systemic liproxstatin-1, and human and mouse T-cell supernatant.", readout: "Tumour-cell C11-BODIPY oxidation, tumour burden and Lip-1 reversal.", answer: "PD-L1 blockade or OT-I transfer raises CD45-negative tumour-cell C11-BODIPY oxidation and suppresses tumours, systemic Lip-1 partly weakens checkpoint-blockade efficacy, and activated T-cell supernatant raises tumour-cell lipid oxidation.", boundary: "C11-BODIPY is a proxy readout and systemic Lip-1 can affect tumour, T cells and other cells at once, so this shows a lipid-peroxidation mechanism contributes to efficacy without quantifying its share of total immune killing." },
      { figure: "Fig. 2", question: "Through which tumour-intrinsic metabolic axis does CD8+ T-cell signalling raise ferroptosis sensitivity?", intervention: "Co-culture and supernatant, IFN-gamma neutralization, tumour IFNGR1 and STAT1 knockout, ChIP/qPCR, system xc- protein, 14C-cystine uptake, and several FIN and rescue conditions.", readout: "IFN-gamma versus TNF-alpha, SLC7A11/SLC3A2 downregulation, cystine uptake and glutathione.", answer: "IFN-gamma rather than TNF-alpha is the main soluble signal; tumour IFNGR1/STAT1 downregulates SLC7A11 and SLC3A2, lowering cystine uptake and glutathione and increasing erastin/RSL3 lipid oxidation and death.", boundary: "Most mechanism uses 24-40 hour IFN-gamma pretreatment of cultured cells; it shows a soluble sensitizing axis without excluding parallel contact, perforin/granzyme, Fas or other cytokine effects." },
      { figure: "Fig. 3", question: "Can direct cyst(e)ine depletion turn this metabolic axis into an in vivo strategy that synergizes with checkpoint blockade?", intervention: "Engineered cyst(e)inase with Fer-1/DFO/GSH rescue, IFN-gamma pretreatment, a four-arm ID8 treatment study, tumour C11-BODIPY, and CD4/CD8 and IFN-gamma/TNF-alpha flow.", readout: "Cyst(e)inase-induced death and rescue, and combination tumour lipid oxidation, T-cell effector function and control.", answer: "Engineered cyst(e)inase causes tumour-cell death that Fer-1/DFO/GSH inhibit, and combined with PD-L1 blockade markedly increases tumour lipid oxidation, T-cell effector function and control, while Lip-1 weakens the combination.", boundary: "The engineered enzyme causes systemic amino-acid depletion that can reshape tumour and immune cells at once; sample sizes are small and this is not a clinical trial, so the synergy cannot be attributed entirely to tumour-cell ferroptosis." },
      { figure: "Fig. 4", question: "Are patient data consistent with the IFN-gamma-system xc- model?", intervention: "Immunohistochemistry of 90 tissues, TCGA expression/survival, a ferroptosis-response signature, and paired transcriptomes of nivolumab responders and non-responders.", readout: "SLC7A11/SLC3A2 versus CD8/IFN-gamma signature and outcome, and on-treatment changes.", answer: "In human melanoma, lower SLC7A11/SLC3A2 tracks with a CD8/IFN-gamma signature and better outcome, and among 27 paired pre/post-nivolumab samples responders show SLC3A2 decrease and CD8A/IFN-gamma increase.", boundary: "These are all observational expression associations with no direct oxidized-phospholipid, iron-dependence or cell-death measurement; signature covariation does not show patient response is driven by ferroptosis, nor make SLC3A2 a validated predictive marker." },
    ],
    labs: [
      { labId: "zoulab-michigan", role: "lead", roleBasis: "Last author of the 30-author Crossref author list (Weiping Zou), verified at Crossref on 2026-07-24. The contribution statement was not re-read in this pass.", continuity: "Extends the laboratory's tumour-immunology work, here linking CD8+ T-cell IFN-gamma to tumour ferroptosis sensitivity during checkpoint immunotherapy." },
    ],
  },

  {
    doi: "10.1021/acscentsci.7b00028",
    title: "On the Mechanism of Cytoprotection by Ferrostatin-1 and Liproxstatin-1 and the Role of Lipid Peroxidation in Ferroptotic Cell Death",
    journal: "ACS Central Science",
    year: 2017,
    citation: "ACS Central Science 3, 232-243",
    crossrefFinding:
      "ACS Central Science, volume 3, issue 3, pages 232-243, published 2017, 7 authors, first author " +
      "Omkar Zilka, last author Derek A. Pratt. No correction, erratum, retraction or update relation " +
      "is registered against this DOI at Crossref, verified 2026-07-24.",
    theme: "ferrostatin-1 and liproxstatin-1 as membrane radical-trapping antioxidants, not 15-LOX inhibitors",
    conditionVector:
      "Cell-free autoxidation chemistry (chlorobenzene/styrene and egg-PC liposomes), quantum-chemical " +
      "calculation, a 15-LOX-1 lysate assay, and RSL3, inducible Gpx4-deletion and HT22 glutamate " +
      "cell models; perturbations are ferrostatin-1, liproxstatin-1, a tetrahydronaphthyridinol (THN) " +
      "series, and an independently synthesized nitroxide; readouts are inhibited-autoxidation rate " +
      "constants and stoichiometry, kinetic isotope effects, bond-dissociation enthalpies, LC-MS/MS " +
      "HETE quantification, EPR, and cell survival with C11-BODIPY.",
    sixtySecond: {
      story: "Ferrostatin-1 and liproxstatin-1 block ferroptosis at nanomolar doses, but whether they work by inhibiting 15-lipoxygenase or by trapping lipid radicals was debated.",
      advance: "The work indicates their nanomolar cytoprotection comes from efficiently trapping chain-carrying peroxyl radicals inside the lipid bilayer rather than from inhibiting 15-LOX, with membrane-phase kinetics, hydrogen-bonding and radical-regenerating oxidation products explaining the potency.",
      evidenceAnchor: "Homogeneous-solution rates about an order of magnitude below alpha-tocopherol yet faster apparent rates in liposomes, weak 15-LOX-1 inhibition up to 10 uM against nanomolar cell potency, a bilayer-designed THN series active across three cell models, and an EPR-identified nitroxide that both inhibits liposome oxidation and protects cells.",
      scope: "Most work is cell-free chemistry in single-lipid liposomes lacking anionic lipids, proteins, cholesterol and organelle diversity, and the true liproxstatin nitroxide was not purified, so the regenerating-product route is a supported inference rather than a direct identification, and there is no animal efficacy.",
      openQuestion: "What is the actual regenerating oxidation product of liproxstatin-1 in a cell, and do these membrane radical-trapping kinetics predict in vivo potency across real membrane environments?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Is the intrinsic peroxyl-radical-trapping ability of Fer-1/Lip-1 enough to explain their cell potency?", intervention: "PBD-BODIPY competitive autoxidation in chlorobenzene/styrene, inhibition periods, rate constants, stoichiometry, and MeOH/MeOD kinetic isotope effects.", readout: "Hydrogen-atom-transfer rate constants versus alpha-tocopherol.", answer: "Both trap radicals by N-H hydrogen-atom transfer but at rates about an order of magnitude below alpha-tocopherol, so homogeneous-solution reactivity alone does not explain their cellular advantage.", boundary: "This is intrinsic chemistry in a non-polar homogeneous solvent and cannot directly rank the compounds' actual protective potency inside a membrane." },
      { figure: "Fig. 2", question: "Are the molecular bond energies consistent with the moderate homogeneous-solution reactivity of Fer-1/Lip-1?", intervention: "CBS-QB3 quantum-chemical geometry optimization and bond-dissociation-enthalpy calculation.", readout: "Weakest N-H bond-dissociation enthalpy versus alpha-tocopherol/THN O-H.", answer: "CBS-QB3 gives a weakest N-H bond of about 82-83 kcal/mol, higher than the O-H bonds of alpha-tocopherol and THN, consistent with slower hydrogen-atom transfer.", boundary: "The calculation supports the reactivity trend but is not an experimental measurement of membrane localization, intracellular metabolism or the real reaction products." },
      { figure: "Fig. 3", question: "Do the relative kinetics of Fer-1/Lip-1 invert once they enter a phospholipid bilayer?", intervention: "STY-BODIPY/FENIX-type liposome autoxidation in egg-PC at several inhibitor concentrations, with rate constants and trapping stoichiometry.", readout: "Apparent peroxyl-trapping rate and stoichiometry in liposomes.", answer: "In egg-PC liposomes both trap peroxyl radicals at apparent rates above alpha-tocopherol, and Lip-1/Fer-1 also show sustained inhibition beyond two equivalents, indicating membrane kinetics and later active products matter.", boundary: "Single egg-PC liposomes lack anionic lipids, proteins, cholesterol and organelle differences; an apparent stoichiometry well above two does not itself identify the regenerating chemistry." },
      { figure: "Fig. 4", question: "Do Fer-1/Lip-1 block ferroptosis mainly by directly inhibiting 15-LOX-1?", intervention: "15-LOX-1-overexpressing HEK293 lysate with free arachidonic-acid substrate, LC-MS/MS HETE quantification, and a PD146176 positive control.", readout: "15-H(P)ETE production versus inhibitor concentration.", answer: "Both barely inhibit 15-LOX-1 production of 15-H(P)ETE up to 10 uM in a near dose-independent way while the PD146176 control is effective, which does not match their nanomolar cellular protection.", boundary: "This cell-free lysate/free-AA system cannot exclude other LOX isoforms, a PEBP1-LOX complex or indirect membrane-context effects; it only argues against direct 15-LOX-1 inhibition as the main explanation." },
      { figure: "Fig. 5", question: "Can a THN designed for membrane-phase radical chemistry reproduce protection in pharmacological and genetic GPX4-loss models?", intervention: "A THN structural series across RSL3, inducible Gpx4 deletion and HT22 glutamate models, on both pharmacological and genetic routes, with survival and C11-BODIPY.", readout: "Nanomolar protection and C11 oxidation versus side-chain length.", answer: "THNs with suitable hydrophobic chain length give nanomolar protection across RSL3, inducible Gpx4 deletion and HT22 glutamate models and lower C11-BODIPY oxidation, while too-short or too-long chains are markedly weaker.", boundary: "Side-chain potency relationships fold in membrane partitioning, uptake and availability at once; in vitro PMHC potency does not translate to in vivo availability, and the paper has no animal efficacy." },
      { figure: "Fig. 6", question: "Could the super-stoichiometric trapping of Fer-1/Lip-1 come from a regenerating nitroxide-type product?", intervention: "A constrained analogue that cannot form the quinone-diimine route, EPR identification of a nitroxide, liposome kinetics, and cell EC50.", readout: "Sustained stoichiometry above two, and nitroxide activity in liposomes and cells.", answer: "A dihydroquinoline that cannot form the quinone-diimine route still shows stoichiometry above two, and its independently synthesized nitroxide both inhibits liposome oxidation and protects cells, supporting a nitroxide-cycling route.", boundary: "The authors did not purify and directly verify the true liproxstatin nitroxide, so the product route is a supported mechanistic inference rather than a direct identification of the liproxstatin cellular metabolite." },
    ],
    labs: [
      { labId: "pratt-ottawa", role: "lead", roleBasis: "Last author of the 7-author Crossref author list (Derek A. Pratt), verified at Crossref on 2026-07-24. The contribution statement was not re-read in this pass.", continuity: "Extends the laboratory's radical-trapping-antioxidant chemistry, here defining how ferrostatin-1 and liproxstatin-1 act in the membrane rather than on 15-LOX." },
    ],
  },

  {
    doi: "10.1038/nchembio.2105",
    title: "Fluorescence probes to detect lipid-derived radicals",
    journal: "Nature Chemical Biology",
    year: 2016,
    citation: "Nature Chemical Biology 12, 608-613",
    crossrefFinding:
      "Nature Chemical Biology, volume 12, issue 8, pages 608-613, published 2016, 13 authors, first " +
      "author Ken-ichi Yamada, last author Mayumi Yamato. Crossref marks no corresponding author. No " +
      "correction, erratum, retraction or update relation is registered against this DOI at Crossref, " +
      "verified 2026-07-24.",
    theme: "turn-on fluorescence probes that convert lipid-radical trapping into an imaging signal",
    conditionVector:
      "Cell-free radical-generation chemistry (arachidonic acid with lipoxygenase and azo initiators), " +
      "cultured hepatocytes, and a two-stage diethylnitrosamine (DEN) rat liver-injury and " +
      "tumour-initiation model; perturbations are the NBD-Pen turn-on probe, the nitroxide scavenger " +
      "OH-Pen and a non-trapping methoxyamine control, and a broad CYP inhibitor (SKF-525A); readouts " +
      "are fluorescence spectra and imaging, ESR, TBARS and 4-HNE/acrolein, 8-OHdG, ALT, IL-6 and JNK " +
      "phosphorylation, and tumour-focus counts over an hours-to-12-week window.",
    sixtySecond: {
      story: "Lipid-derived radicals sit at the start of lipid peroxidation, but there was no way to image the early radical-trapping event in cells and tissue.",
      advance: "The work couples a hydrophobic nitroxide radical trap to an NBD fluorophore so that trapping a lipid-derived radical relieves quenching, turning early chain lipid oxidation into an imaging signal, and tests its function with a matched scavenger in DEN liver injury and tumour initiation.",
      evidenceAnchor: "A turn-on probe whose fluorescence rises with lipoxygenase or azo-initiated lipid radicals over measured ROS controls, DEN-raised probe signal lowered by a CYP inhibitor, and early-dosed OH-Pen but not a non-trapping control reducing 12-week tumour foci and downstream oxidative and inflammatory markers.",
      scope: "Selectivity covers only the reactants, concentrations and solvents tested, the probe consumes radicals as it reports them, and the tumour work is an early chemoprevention/initiation intervention that does not establish ferroptosis or treat an established tumour.",
      openQuestion: "Which specific lipid-radical species and membrane compartment does the probe report, and does trapping early lipid radicals change tumour initiation through a genetically defined lipid-radical to inflammation pathway?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Can NBD-Pen convert lipid-radical trapping into turn-on fluorescence with enough sensitivity and selectivity?", intervention: "Probe design, fluorescence spectra, ESR, arachidonic-acid/lipoxygenase and azo-initiator concentration and time curves, and H2O2/ClO-/O2-/OH controls.", readout: "Fluorescence rise and ESR signal loss on radical trapping versus other ROS.", answer: "AA-LOX or azo systems lower the nitroxide ESR signal and produce dose- and time-dependent fluorescence, and the signal is stronger for lipid-radical conditions than for the H2O2, ClO-, superoxide and hydroxyl radical controls tested.", boundary: "Selectivity covers only the reactants, concentrations and solvents tested; the probe consumes radicals by covalent trapping, so fluorescence intensity also depends on probe partitioning, reaction competition and adduct amount." },
      { figure: "Fig. 2", question: "Can the probe report early lipid radicals from DEN metabolism in live cells and animal tissue?", intervention: "Live-cell imaging, liver and serum extract fluorescence, tissue sections, several timepoints, and the CYP inhibitor SKF-525A.", readout: "NBD-Pen fluorescence in hepatocytes and rat liver versus CYP inhibition.", answer: "DEN raises NBD-Pen fluorescence in hepatocytes and rat liver tissue, most clearly near one hour, and the broad CYP inhibitor SKF-525A lowers the signal in cells and tissue.", boundary: "SKF-525A also changes DEN bioactivation and overall metabolism; the signal supports CYP-dependent radical generation without identifying the specific radical, membrane compartment or oxidized-lipid species." },
      { figure: "Fig. 3", question: "Does scavenging lipid radicals early after DEN exposure change later liver-tumour promotion?", intervention: "A matched-chemistry comparison of the nitroxide OH-Pen versus a non-trapping methoxyamine control, in a two-stage DEN/2-AAF/CCl4 rat model, with tumour-focus counts.", readout: "12-week tumour-focus number and size versus early OH-Pen dosing.", answer: "The radical-trapping OH-Pen given early after DEN markedly lowers 12-week tumour foci, while the non-trapping methoxyamine control does not protect.", boundary: "This is a chemoprevention/initiation-stage intervention about one hour after carcinogen exposure, not treatment of an established liver cancer; OH-Pen may affect several radical reactions and the paper does not show ferroptosis." },
      { figure: "Fig. 4", question: "Does the long-term protection by OH-Pen come with a matched drop in acute lipid oxidation, tissue injury and inflammatory signalling?", intervention: "TBARS, 4-HNE/acrolein, 8-OHdG, ALT, apoptosis, proliferation, IL-6 and JNK phosphorylation readouts with structure-matched controls.", readout: "Oxidation, DNA-damage, liver-injury, death, proliferation and cytokine markers versus radical-trapping ability.", answer: "OH-Pen lowers TBARS, 4-HNE/acrolein, 8-OHdG, ALT, apoptosis, proliferation, IL-6 and JNK phosphorylation, while non-trapping controls mostly do not protect.", boundary: "These endpoints form a correlated injury chain but are mostly downstream or mixed markers; no genetic perturbation shows each arrow of the lipid-radical to JNK to tumour pathway individually." },
      { figure: "Fig. 5", question: "How do the authors integrate DEN, lipid-radical detection and tumour-initiation results?", intervention: "A synthesis schematic integrating Fig. 1-4, with no new experimental data.", readout: "An integrated model of DEN-generated lipid radicals driving oxidation, inflammation and hepatocellular carcinoma.", answer: "The authors propose that DEN metabolism generates lipid radicals that drive lipid peroxidation, electrophiles, inflammation/apoptosis/proliferation and hepatocellular carcinoma, with NBD-Pen for detection and OH-Pen for blockade.", boundary: "The linear order and causal arrows in the model are not all validated segment by segment, and the schematic must not be treated as ferroptosis evidence or as new data." },
    ],
    labs: [
      { labId: "yamada-kyushu", role: "co-lead", roleBasis: "First author of the 13-author Crossref author list (Ken-ichi Yamada) and originator of the NBD-Pen lipid-radical probe that defines this laboratory's method line; the last author is Mayumi Yamato, the senior radical-detection collaborator. Crossref marks no corresponding author; positions verified 2026-07-24. Attributed as co-lead rather than sole lead because seniority is shared and not machine-verifiable here.", continuity: "Origin of the laboratory's radical-trapping fluorescence-probe methods later used in its lysosomal ferroptosis work, here first developed for lipid-derived radicals." },
    ],
  },
];
