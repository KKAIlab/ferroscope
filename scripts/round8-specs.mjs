// Round-8 migration specs: English content + Crossref-verified metadata for the legacy papers
// being surfaced into the English-first layer. Each `title` MUST equal the legacy archive title
// byte-for-byte (the migration script aborts otherwise). figureAudit figures carry no scopeRef,
// so every figure edge stays at the paper's archive-derived baseline; only the Crossref metadata
// spine is source-checked, because only that was re-verified against a live authoritative source.
//
// Author positions in each roleBasis were read from the ordered Crossref author list on
// 2026-07-24. Where the attributed laboratory's PI is not the senior/last author, the role is
// set to what the position honestly supports (contributing-author / co-lead), not to "lead".

const SS = "Figure and legend as recorded in the project audit archive; not re-opened in this pass.";

export const SPECS = [
  {
    doi: "10.1038/s41589-022-01249-3",
    title: "Identification of essential sites of lipid peroxidation in ferroptosis",
    journal: "Nature Chemical Biology",
    year: 2023,
    citation: "Nature Chemical Biology 19, 719-730",
    crossrefFinding:
      "Nature Chemical Biology, volume 19, issue 6, pages 719-730, published 2023, 15 authors, " +
      "first author A. Nikolai von Krusenstiern, last author Brent R. Stockwell. No correction, " +
      "erratum or update relation is registered against this DOI at Crossref, verified 2026-07-24.",
    theme: "endoplasmic reticulum as an early site of lethal lipid peroxidation",
    conditionVector:
      "HT-1080 and additional cancer cell lines in culture, driven by four mechanistically distinct " +
      "FIN inducer classes and by FINO2-type endoperoxides, with bis-allylic dideuterated PUFAs, " +
      "monounsaturated fatty acids and ACSL4 overexpression as perturbations; readouts are stimulated " +
      "Raman scattering imaging of the carbon-deuterium vibration, organelle-masked C11-BODIPY " +
      "oxidation, molecular-species LC-MS and subcellular fractionation over acute inducer time courses.",
    sixtySecond: {
      story: "Ferroptosis kills by peroxidizing membrane phospholipids, but which membrane the lethal oxidation starts in was not resolved.",
      advance: "Using deuterated fatty acids as traceable protectors and organelle-targeted endoperoxides as inducers, the work places the endoplasmic reticulum as an early and functionally important site of the peroxidation, with oxidation later extending to the plasma membrane.",
      evidenceAnchor: "Stimulated Raman imaging localizes protective D-PUFAs to the ER over lipid droplets, LC-MS and fractionation agree, organelle-redirected FINO2 analogues induce rescuable death from several compartments, and masked C11-BODIPY shows an ER-first oxidation time course under four inducer classes.",
      scope: "All work is in cultured cancer cells with chemical inducers and mobile proxy probes; a direct manipulation of ER lipid composition was attempted and did not succeed, so the ER-first ordering rests on localization rather than on causal control.",
      openQuestion: "How can ER oxidized phospholipids be manipulated and measured directly, without mobile probes or forced artificial endoperoxides, and does the compartment order shift with the inducer and cell state?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Where inside the cell do the ferroptosis-protective bis-allylic dideuterated PUFAs (D-PUFAs) mainly distribute?", intervention: "Supplementation with several bis-allylic dideuterated PUFAs, challenged with four mechanistically distinct FIN inducer classes across multiple cell lines.", readout: "Cell survival, and stimulated Raman scattering imaging of the carbon-deuterium vibration to localize where the labelled fatty acids accumulate.", answer: "Several D-PUFAs suppress all four classes of ferroptosis inducer and, by stimulated Raman scattering imaging, distribute in a perinuclear and punctate pattern.", boundary: "Where a protective agent accumulates only nominates a candidate site; the kinetic isotope effect and metabolic fate of a D-PUFA do not by themselves show that lethal peroxidation is initiated there." },
      { figure: "Fig. 2", question: "Does accumulation of D-PUFAs in lipid droplets account for their anti-ferroptotic activity?", intervention: "Co-imaging of stimulated Raman scattering with Nile Red, lipidomic tracing of D-PUFA into triacylglycerol, and clearance of droplets with two DGAT inhibitors.", readout: "Lipid-droplet co-localization, tracer incorporation into triacylglycerol, and cell survival.", answer: "D-PUFAs do enter triacylglycerol and lipid droplets, but protection persists after DGAT inhibition clears the droplets, so droplets are not a required storage site in this model.", boundary: "The conclusion is confined to acute DGAT pharmacology in HT-1080 cells; it does not extend to a claim that lipid droplets are irrelevant to ferroptosis in every cell state." },
      { figure: "Fig. 3", question: "With droplets excluded, which membranes and phospholipids do the D-PUFAs mainly enter?", intervention: "ER and Golgi co-imaging, molecular-species LC-MS of phospholipids, and ER versus mitochondria fractionation with resident-protein contamination controls.", readout: "Marker overlap, phospholipid species distribution, and fraction-level label enrichment.", answer: "SRS overlaps strongly with ER markers and less with Golgi; LC-MS shows D-PUFAs entering phosphatidylethanolamine and ether phospholipids, and fractionation places more label in ER than in mitochondria.", boundary: "The fractionation carries ER-mitochondria cross-contamination and the authors state they cannot exclude a minor mitochondrial pool; localization is not a substitute for a direct causal manipulation of ER lipid composition." },
      { figure: "Fig. 4", question: "Is ER enrichment specific to the protective D-PUFAs, or do pro- and anti-ferroptotic fatty acids use the same compartment?", intervention: "Stimulated Raman imaging of several deuterated fatty acids, ACSL4 overexpression, and ER versus plasma-membrane masking.", readout: "Cell survival and relative incorporation quantified per compartment.", answer: "A pro-ferroptotic non-bis-allylic deuterated PUFA and an anti-ferroptotic MUFA both enter the ER and droplets yet move sensitivity in opposite directions, and ACSL4 overexpression strengthens the PUFA effect.", boundary: "Shared localization with opposite effects shows that being in the ER does not by itself set direction; the specific fatty-acid chemistry, acyl activation and which phospholipid is entered matter as much." },
      { figure: "Fig. 5", question: "Can targeting endoperoxides to different organelles induce ferroptosis directly from more than one compartment?", intervention: "Structure-directed chemistry to relocate a FINO2-type endoperoxide to the ER/Golgi, mitochondria or lysosome, with organelle-marker co-localization and dose-response under ferroptosis-inhibitor rescue.", readout: "Fluorescence and SRS localization, cell-death dose-response, and rescue by ferrostatin-1 or D-PUFAs.", answer: "FINO2 analogues can be redirected to the ER/Golgi, mitochondria or lysosome and, in each case, trigger death that ferrostatin-1 or D-PUFAs rescue.", boundary: "Chemical derivatization and forced targeting may change reactivity, potency and cellular uptake at once; this shows several compartments are sufficient to carry an artificial peroxidation stress, not the natural order of events under an endogenous inducer." },
      { figure: "Fig. 6", question: "Under common ferroptosis inducers, does lipid peroxidation follow an ER-first, plasma-membrane-later time course?", intervention: "Four FIN inducer classes, several timepoints, and ER/plasma-membrane and mitochondria/lysosome masks applied over the oxidation time course.", readout: "C11-BODIPY oxidation ratio per compartment and the timing of morphological collapse.", answer: "Organelle-masked C11-BODIPY shows an ER oxidation signal appearing first under all four inducer classes, with the plasma-membrane signal and morphological collapse rising close to death.", boundary: "C11-BODIPY is a mobile proxy probe, and co-localization at a few timepoints cannot establish the ER as a universal endogenous origin; the authors' attempt to directly alter ER area and composition did not succeed, and that causal gap remains open." },
    ],
    labs: [
      { labId: "stockwell-columbia", role: "lead", roleBasis: "Last author of the 15-author Crossref author list (Brent R. Stockwell), verified at Crossref on 2026-07-24. The contribution statement was not re-read in this pass.", continuity: "Extends the laboratory's programme on where in the cell lethal lipid peroxidation is initiated and how ferroptosis can be chemically probed and blocked." },
    ],
  },

  {
    doi: "10.1161/CIRCULATIONAHA.125.075220",
    title: "ALDH2/eIF3E Interaction Modulates Protein Translation Critical for Cardiomyocyte Ferroptosis in Acute Myocardial Ischemia Injury",
    journal: "Circulation",
    year: 2026,
    citation: "Circulation 153, 164-184",
    crossrefFinding:
      "Circulation, volume 153, issue 3, pages 164-184, published 2026, 27 authors, first author " +
      "Xin Chen, last author Huiyong Yin. No correction, erratum or update relation is registered " +
      "against this DOI at Crossref, verified 2026-07-24.",
    theme: "an ALDH2 variant that shifts translation toward iron import and PUFA activation",
    conditionVector:
      "An acute-myocardial-infarction patient cohort stratified by ALDH2 genotype, ALDH2*2 knock-in " +
      "mice with coronary-ligation infarction, and cardiomyocytes; perturbations are the ALDH2*2 " +
      "variant, ferrostatin-1 pretreatment, cardiac AAV9-eIF3E knockdown and 5'UTR motif reporters; " +
      "readouts are plasma and myocardial targeted oxidized-phospholipid LC-MS, metabolomics, " +
      "echocardiography and infarct scoring, ribosome-associated translation analysis, and TFRC and " +
      "ACSL4 protein versus mRNA over acute ischemic windows.",
    sixtySecond: {
      story: "The common ALDH2*2 variant is known to slow aldehyde metabolism, but why it also worsens ischemic heart injury through ferroptosis was unclear.",
      advance: "The work links ALDH2*2 to weaker ALDH2-eIF3E binding, which lets eIF3E raise translation of TFRC and ACSL4 transcripts carrying a shared 5'UTR motif, expanding both iron import and the oxidizable PUFA-phospholipid pool in ischemic cardiomyocytes.",
      evidenceAnchor: "A patient cohort, ALDH2*2 knock-in mice rescued by ferrostatin-1, myocardial targeted oxidized-phospholipid measurements, ribosome-level translation analysis identifying a GAGGACR motif, biochemical ALDH2-eIF3E binding, and cardiac AAV9-eIF3E knockdown converge on the model.",
      scope: "The causal genetics are in mouse infarction with mostly preventive dosing, and the human data are observational plasma associations in a cohort of roughly one hundred, so the mechanism is supported but no post-onset treatment window is established.",
      openQuestion: "Can eIF3E or its motif-dependent translation be inhibited acutely and safely after infarction onset, and how much of the benefit is specific to TFRC and ACSL4 rather than the many other transcripts eIF3E touches?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "In acute myocardial infarction patients, is ALDH2*2 accompanied by stronger circulating oxidized-lipid and ferroptosis-related metabolic signatures?", intervention: "An acute-infarction cohort stratified by ALDH2 genotype, compared on plasma targeted oxidized-lipid LC-MS, metabolomics and clinical variables.", readout: "Plasma oxidized-phospholipid and oxidized-lipid signals and metabolic profiles by genotype.", answer: "ALDH2*2 carriers show higher levels of several oxidized-phospholipid and oxidized-lipid signals and a distinct metabolic profile relative to wild type, indicating genotype-linked susceptibility.", boundary: "This is an observational plasma association in a cohort of roughly one hundred; it cannot localize the signal to myocardium, cannot exclude diet, drug and injury-severity confounders, and a genotype association is not treatment causation." },
      { figure: "Fig. 2", question: "Does ALDH2*2 worsen infarct injury in a controlled genetic background, and can a ferroptosis inhibitor relieve it?", intervention: "ALDH2*2 knock-in mice subjected to infarction surgery, with ferrostatin-1 (Fer-1) pretreatment.", readout: "Cardiac function by echocardiography, infarct size, and lipid-oxidation and iron-related tissue readouts.", answer: "ALDH2*2 mice have worse post-infarction function, larger infarcts and higher lipid-oxidation and iron readouts, and preoperative Fer-1 markedly improves these phenotypes.", boundary: "Fer-1 is not an absolutely specific probe for the mode of death and was given mainly as prevention; an acute surgical mouse model does not establish an effective post-onset treatment window in patients." },
      { figure: "Fig. 3", question: "Does the genotype effect fall on iron import and PUFA-phospholipid remodelling rather than only general oxidative damage?", intervention: "ALDH2*2 infarcted myocardium assayed for targeted oxidized phospholipids, iron and lipid readouts, with TFRC and ACSL4 protein versus mRNA controls.", readout: "Tissue targeted oxidized-phospholipid levels and TFRC/ACSL4 protein against transcript levels.", answer: "ALDH2*2 infarcted myocardium shows higher targeted oxidized phospholipids together with raised TFRC and ACSL4 protein whose mRNA changes are too small to account for it, pointing to translational control.", boundary: "Direct oxidized-phospholipid evidence is stronger than C11 or 4-HNE proxies but is still a tissue endpoint; the protein-mRNA gap indicates translational regulation without on its own identifying eIF3E." },
      { figure: "Fig. 4", question: "Which transcripts and sequence features make up the ALDH2-genotype-linked selective translation programme?", intervention: "Translatome and ribosome-associated analysis, candidate-pathway enrichment, 5'UTR motif discovery and protein validation.", readout: "Translation-efficiency changes, enriched targets, and a shared 5'UTR motif.", answer: "Ribosome-associated analysis places TFRC and ACSL4 among transcripts with enhanced protein synthesis and finds a shared GAGGACR motif enriched in their 5'UTRs.", boundary: "Motif enrichment is a candidate rule, not a demonstration that every motif-bearing transcript is equally regulated; translatome changes may also include secondary effects of infarct stress." },
      { figure: "Fig. 5", question: "Does ALDH2 bind eIF3E directly and, through that interaction, restrain motif-dependent translation?", intervention: "Interaction mass spectrometry and co-immunoprecipitation, GST pull-down, RNA immunoprecipitation, wild-type and mutant motif reporters, and comparison of ALDH2 variants.", readout: "ALDH2-eIF3E binding, and eIF3E binding and translation of motif reporters and TFRC/ACSL4 transcripts.", answer: "ALDH2 binds eIF3E in immunoprecipitation and with purified proteins; ALDH2*2 binds less, and eIF3E then binds and translates the motif reporter and TFRC/ACSL4 transcripts more strongly.", boundary: "Several orthogonal experiments support a direct interaction, but eIF3E is a multi-target translation factor and reporter systems cannot fully reproduce the RNA structure and competition inside a cardiomyocyte." },
      { figure: "Fig. 6", question: "Is lowering eIF3E in cardiomyocytes sufficient to reverse the in vivo ischemic susceptibility of ALDH2*2?", intervention: "Cardiac-directed AAV9-eIF3E knockdown, with eIF3E and target-protein validation, infarction functional endpoints, tissue iron and targeted oxidized phospholipids.", readout: "TFRC/ACSL4 levels, oxidized phospholipids, injury, and post-infarction cardiac function.", answer: "Cardiac AAV9-eIF3E knockdown lowers TFRC and ACSL4, oxidized phospholipids and injury and improves post-infarction function in ALDH2*2 mice.", boundary: "AAV9 was given before infarction as a preventive genetic intervention; eIF3E knockdown affects many mRNAs, so the benefit cannot be attributed entirely to TFRC and ACSL4, and no acute pharmacological safety window is shown." },
      { figure: "Fig. 7", question: "How does the proposed ALDH2-eIF3E-ferroptosis model integrate across the paper?", intervention: "A synthesis schematic built on the cohort, genetic, lipidomic, translatome, biochemical-interaction and mouse-intervention evidence of the previous six figures.", readout: "An integrated model connecting the interaction defect to translation, iron uptake, PUFA activation, oxidized-phospholipid accumulation and injury.", answer: "The authors' model links the ALDH2*2 interaction defect to motif-dependent translation, iron uptake and PUFA activation, oxidized-phospholipid accumulation and cardiomyocyte injury.", boundary: "Figure 7 is an integrating model rather than new experiments; the classic aldehyde-metabolism role of ALDH2, 4-HNE and other non-ferroptotic injury, and clinical treatment timing may all contribute in parallel." },
    ],
    labs: [
      { labId: "yin-cityu", role: "lead", roleBasis: "Last author of the 27-author Crossref author list (Huiyong Yin), verified at Crossref on 2026-07-24. The contribution statement was not re-read in this pass.", continuity: "Extends the laboratory's work on oxidized-lipid mass spectrometry and how lipid oxidation drives cardiovascular ferroptosis and ischemic injury." },
    ],
  },

  {
    doi: "10.1038/s41586-025-09710-8",
    title: "Targeting FSP1 triggers ferroptosis in lung cancer",
    journal: "Nature",
    year: 2026,
    citation: "Nature 649, 487-495",
    crossrefFinding:
      "Nature, volume 649, issue 8096, pages 487-495, 20 authors, first author Katherine Wu, last " +
      "author Thales Papagiannakopoulos (Marcus Conrad is second-to-last). Crossref dates the online " +
      "publication to 2025; the issue and the project archive use 2026. No correction, erratum or " +
      "update relation is registered against this DOI at Crossref, verified 2026-07-24.",
    theme: "an in vivo lung environment that makes tumours depend on FSP1",
    conditionVector:
      "Autochthonous KRAS/TP53 lung adenocarcinoma mouse models and human and mouse lung-cancer " +
      "xenograft and syngeneic transplants across several driver genotypes; perturbations are " +
      "tumour-specific Gpx4 and Fsp1 CRISPR deletion, the FSP1 inhibitor icFSP1, an icFSP1-resistant " +
      "FSP1(Q319K), Acsl4 deletion, dietary vitamin E and the lipophilic antioxidant LIP1; readouts " +
      "are tumour burden by MRI and histology, 4-HNE and TUNEL, oxidized PUFA-phospholipid lipidomics, " +
      "CoQH2/CoQ and survival over tumour initiation-to-treatment windows.",
    sixtySecond: {
      story: "Lung tumours can look independent of the FSP1 and GPX4 antioxidant defences in dish culture, leaving open whether that defence matters in the living lung.",
      advance: "The work shows that in the oxidative lung environment KRAS/TP53 tumours depend on FSP1 in vivo even when GPX4 is intact, so tumour-specific FSP1 deletion or an in-vivo-active FSP1 inhibitor triggers ferroptosis that lipid antioxidants, Acsl4 deletion or vitamin E reverse.",
      evidenceAnchor: "Autochthonous and transplant models across seven driver backgrounds, oxidized-phospholipid lipidomics and CoQ measurements, orthogonal rescue by re-expressed FSP1/GPX4, Acsl4 deletion, vitamin E and LIP1, and on-target icFSP1 efficacy blocked by LIP1 and by a drug-resistant FSP1 mutant.",
      scope: "All causal work is in mouse and xenograft tumours with high-vitamin-E diet and systemic LIP1 as environmental rescues; the dependence is in vivo rather than in culture, so the specific lung source of the sensitivity is not pinned down and no human exposure is established.",
      openQuestion: "What exactly in the lung environment raises the demand on FSP1, and can an FSP1 inhibitor reach an on-target, ferroptosis-dependent effect with a safe long-term window in patients?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Does GPX4 actually limit ferroptosis and tumour formation in orthotopic KRAS/TP53 lung adenocarcinoma?", intervention: "Autochthonous KP lung-cancer mice with intratumoral dual sgRNA Gpx4 deletion, and continuous LIP1 rescue given from tumour initiation.", readout: "Lung tumour burden by MRI and histology, and 4-HNE immunohistochemistry.", answer: "Tumour-specific Gpx4 CRISPR markedly lowers orthotopic lung tumour burden and raises 4-HNE; continuous LIP1 from initiation restores burden and lowers the oxidation readout.", boundary: "This is genetic deletion at tumour initiation with preventive continuous rescue, not drug treatment of an established tumour; 4-HNE is a tissue lipid-oxidation proxy rather than a specific lethal oxidized phospholipid." },
      { figure: "Fig. 2", question: "Is FSP1 upregulated with lung-cancer progression and does it become an orthotopic dependency while GPX4 is intact?", intervention: "Human LUAD TCGA survival, timed immunohistochemistry across the mouse model, and orthotopic dual-sgRNA Fsp1 versus Gpx4 deletion with TUNEL.", readout: "FSP1 expression over progression, survival association, tumour burden and TUNEL.", answer: "FSP1 rises as adenomas progress to adenocarcinoma, high expression tracks worse survival in TCGA, and tumour-specific Fsp1 deletion limits burden like Gpx4 deletion while increasing TUNEL.", boundary: "TCGA is a prognostic association, not a treatment prediction; TUNEL does not specifically mark ferroptosis, and knockout initiated with the tumour mixes establishment and maintenance effects." },
      { figure: "Fig. 3", question: "Is FSP1 dependence limited to one lung-cancer driver mutation or model?", intervention: "sgFSP1 versus control in seven human and mouse lung-cancer backgrounds (KRAS, NRAS, EGFR, KEAP1/STK11), as subcutaneous or syngeneic transplants.", readout: "In vivo growth curves and endpoint tumour weight.", answer: "FSP1 deletion consistently slows in vivo growth across the seven genetic backgrounds in xenograft and syngeneic transplants.", boundary: "Cross-model reproducibility shows the dependence is not confined to one driver, but most are transplant tumours, and growth inhibition alone still needs the orthogonal ferroptosis rescue of Fig. 4 to attribute the mode of death." },
      { figure: "Fig. 4", question: "Is the growth defect of Fsp1-null tumours caused by lipid-peroxidation ferroptosis rather than a general growth deficit?", intervention: "Tumour oxidized-lipidomics and CoQ quantification, catalytic and localization mutant re-expression, Acsl4 double knockout, established-tumour vitamin E diet switch, and orthotopic LIP1 rescue.", readout: "Oxidized PUFA-phospholipids, CoQH2/CoQ, and in vivo versus in vitro growth after each rescue.", answer: "Fsp1-null tumours accumulate oxidized PUFA-phospholipids and lower CoQH2/CoQ; re-expressing active FSP1 or GPX4, deleting Acsl4, raising dietary vitamin E or giving LIP1 each partly restore in vivo growth, while the same cells grow near-normally in culture.", boundary: "High-vitamin-E diet and systemic LIP1 are environmental rescues, not patient dietary advice; that the dependence is in vivo and not in vitro means culture misses the mechanism and the specific lung source of sensitivity is still undetermined." },
      { figure: "Fig. 5", question: "Can pharmacological FSP1 inhibition give an on-target, ferroptosis-dependent therapeutic effect in established lung cancer?", intervention: "Treatment-phase icFSP1 with survival and bioluminescence, LIP1 reverse-rescue, a drug-resistant FSP1(Q319K) internal control, and KRAS/TP53 PDX.", readout: "Survival and tumour growth, and loss of drug effect under LIP1 or the resistant mutant.", answer: "icFSP1 extends orthotopic syngeneic lung-cancer survival and inhibits PDX growth; LIP1 abolishes the effect, and an FSP1(Q319K) mutant that keeps anti-ferroptotic function makes tumours no longer respond to icFSP1.", boundary: "These are still preclinical models with PDX in NSG mice; unchanged coarse immune-cell proportions cannot exclude functional immune or normal-tissue effects, and a long-term safety window and human exposure are not established." },
    ],
    labs: [
      { labId: "papagiannakopoulos-nyu", role: "lead", roleBasis: "Last author of the 20-author Crossref author list (Thales Papagiannakopoulos; Marcus Conrad is second-to-last), verified at Crossref on 2026-07-24. The contribution statement was not re-read in this pass.", continuity: "Extends the laboratory's work on how the in vivo tumour environment and redox metabolism set lung-cancer vulnerabilities, here an FSP1-dependent ferroptosis." },
    ],
  },

  {
    doi: "10.1038/s41586-025-09709-1",
    title: "Lymph node environment drives FSP1 targetability in metastasizing melanoma",
    journal: "Nature",
    year: 2026,
    citation: "Nature 649, 477-486",
    crossrefFinding:
      "Nature, volume 649, issue 8096, pages 477-486, 32 authors, first author Mario Palma, last " +
      "author Jessalyn M. Ubellacker. Crossref dates the online publication to 2025; the issue and " +
      "the project archive use 2026. No correction, erratum or update relation is registered against " +
      "this DOI at Crossref, verified 2026-07-24.",
    theme: "a low-oxygen lymph node niche that creates an FSP1 dependency",
    conditionVector:
      "A serial lymph-node-metastasis melanoma selection model with late-generation cells, subcutaneous " +
      "and lymph-node tumours in mice; perturbations are repeated lymph-node colonization, 1% oxygen " +
      "hypoxia, proteasome inhibition, NMT inhibition and an FSP1 G2A myristoylation mutant, Fsp1 " +
      "deletion, four FSP1 inhibitors, BSO and intratumoral dosing; readouts are GCLC/GSH/GPX4/ACSL4 " +
      "and FSP1 protein, metabolomics and GSH/GSSG, GPX4 ubiquitination, live-cell lysosomal " +
      "co-localization, C11-BODIPY and anatomically paired tumour growth.",
    sixtySecond: {
      story: "Melanoma cells that repeatedly colonize lymph nodes change how they resist ferroptosis, but whether that creates a treatable weakness was unclear.",
      advance: "Serial lymph-node selection lowers the GCLC-GSH and GPX4 defences while relocating N-myristoylated FSP1 to lysosome-associated membranes, producing an FSP1 dependency that is fully exposed only in the low-oxygen lymph-node niche.",
      evidenceAnchor: "Nine rounds of lymph-node selection lower GCLC, GPX4 and ACSL4 and raise FSP1; hypoxia lowers GPX4 protein by proteasomal degradation, FSP1 relocalizes to lysosomes in a myristoylation-dependent way, and local FSP1 inhibition preferentially slows lymph-node over subcutaneous tumours.",
      scope: "This is a mouse cell model re-expanded after serial in vivo selection, so changes may include clonal selection and culture adaptation; the therapeutic effect is mostly local intratumoral dosing and is much weaker subcutaneously, so it is not a general systemic melanoma dependency.",
      openQuestion: "Which E3 ligase degrades GPX4 under hypoxia, is the relocalized lysosomal FSP1 pool the necessary site of protection, and does the niche-specific dependency hold in patient metastases?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Does serial lymph-node colonization systematically rearrange melanoma ferroptosis defences?", intervention: "A nine-round lymph-node selection model, with cross-generation RNA and protein quantification and hypoxia and defence-protein comparison of subcutaneous versus lymph-node tumours.", readout: "GCLC, GPX4, ACSL4 and FSP1 levels across generations and in vivo.", answer: "Late-generation cells from nine rounds of lymph-node selection progressively lower GCLC, GPX4 and ACSL4 while raising FSP1, and lymph-node tumours show the same direction in vivo.", boundary: "This is a mouse cell model re-expanded ex vivo after multiple in vivo selection rounds; the changes may include clonal selection and culture adaptation and cannot be equated directly with the natural timing of patient metastasis." },
      { figure: "Fig. 2", question: "Do late-generation lymph-node metastatic cells really lower de novo GSH synthesis and steady-state pools?", intervention: "Unsupervised metabolomics, glutamate/cysteine-related metabolite LC-MS, GSH/GSSG quantification across generations, and cysteine-removal controls.", readout: "GSH-pathway metabolites and total and oxidized glutathione pools.", answer: "Metabolomics, glutamate- and cysteine-related metabolites and GSH/GSSG quantification all show reduced GSH synthesis capacity and total pool in late-generation cells.", boundary: "Most measurements are ex vivo steady-state abundances rather than isotope flux; cell lines in uniform medium cannot fully reproduce the nutrient exchange of a lymph node." },
      { figure: "Fig. 3", question: "How does low oxygen further weaken the GPX4 defence?", intervention: "Hypoxia-reoxygenation time courses, GPX4 imaging and fractionation, mRNA, ubiquitination immunoprecipitation, two proteasome inhibitors and multi-cell-line comparison.", readout: "GPX4 protein versus mRNA, ubiquitination, and recovery under proteasome inhibition.", answer: "1% oxygen rapidly and reversibly lowers GPX4 protein but not mRNA and increases GPX4 ubiquitination; proteasome inhibitors restore GPX4, and late-generation cells drop further under hypoxia.", boundary: "1% oxygen is a strong experimental hypoxia and the responsible E3 ligase is not identified; CoCl2/HIF stabilization does not on its own establish HIF causality, so the hypoxia effect cannot be reduced to one known HIF pathway." },
      { figure: "Fig. 4", question: "Is FSP1 relocalized to lysosome-associated membranes in late-generation cells, and does this depend on N-myristoylation?", intervention: "Live-cell confocal imaging with LAMP1/LysoTracker and ER/Golgi controls, orthogonal sectioning, organelle fractionation, NMT inhibition and a G2A localization mutant.", readout: "FSP1-OFP perinuclear and lysosomal co-localization and lysosomal enrichment.", answer: "FSP1-OFP shows perinuclear and lysosomal co-localization and lysosomal enrichment in late-generation cells, and NMT inhibition or the G2A mutation weakens this localization.", boundary: "Fluorescent fusion protein, overexpression and enrichment fractionation support the localization but do not directly measure CoQ or vitamin-K reduction flux at the lysosomal membrane, and a localization change does not by itself show that compartment is the sole necessary site of protection." },
      { figure: "Fig. 5", question: "Do these defence changes create an exploitable, anatomically specific FSP1 vulnerability?", intervention: "Hypoxic RSL3/ML210, C11-BODIPY with Lip-1, four FSP1 inhibitors, BSO combination, intratumoral dosing, and paired lymph-node versus subcutaneous comparison of the same cells.", readout: "Lipid oxidation and GPX4-inhibitor sensitivity under hypoxia, and anatomically paired tumour growth.", answer: "Fsp1 deletion markedly increases lipid oxidation and GPX4-inhibitor sensitivity under hypoxia; FSP1 and GCLC inhibition is rescued by Lip-1, and local FSP1 inhibition preferentially lowers lymph-node over subcutaneous tumour growth.", boundary: "This is mostly high-concentration local intratumoral dosing in mouse and transplant models; the effect is much weaker at the subcutaneous site, which itself argues against extrapolating to a general systemic melanoma dependency. Fig. 5j is a synthesis model, not new data." },
    ],
    labs: [
      { labId: "ubellacker-harvard", role: "lead", roleBasis: "Last author of the 32-author Crossref author list (Jessalyn M. Ubellacker), verified at Crossref on 2026-07-24. The contribution statement was not re-read in this pass.", continuity: "Extends the laboratory's work on how the metastatic environment, and the lymph node in particular, reshapes oxidative stress and ferroptosis susceptibility." },
    ],
  },

  {
    doi: "10.1038/s41467-025-58909-w",
    title: "Lysosomal lipid peroxidation contributes to ferroptosis induction via lysosomal membrane permeabilization",
    journal: "Nature Communications",
    year: 2025,
    citation: "Nature Communications 16, 3554",
    crossrefFinding:
      "Nature Communications, volume 16, issue 1, article 3554, published 2025, 17 authors, first " +
      "author Yuma Saimoto, last author Ken-ichi Yamada. No correction, erratum or update relation is " +
      "registered against this DOI at Crossref, verified 2026-07-24.",
    theme: "lysosomal lipid peroxidation and membrane permeabilization as an early ferroptosis step",
    conditionVector:
      "Calu-1, PC9, H460, H1299 and other non-small-cell lung cancer cells in culture and GPX4-knockout " +
      "H460 subcutaneous xenografts; perturbations are RSL3 and erastin, a lysosome-targeted radical " +
      "trap (Lyso-NBD-Pen), lysosomotropic agents (chloroquine, NH4Cl, methylamine) with bafilomycin " +
      "controls, iron chelators and ferroptosis inhibitors; readouts are LC-MS/MS radical adducts, " +
      "lysosomal pH, dextran and cathepsin leakage, cytosolic Fe2+ probes, C11-BODIPY, LDH release, " +
      "tumour growth and 4-HNE over acute inducer time courses.",
    sixtySecond: {
      story: "Lipid peroxidation is central to ferroptosis, but which membrane the early lethal radicals accumulate in, and how that spreads, was unsettled in some models.",
      advance: "In partial-GPX4-inhibition models the work places early lipid radicals in the lysosome, where they cause lysosomal membrane permeabilization; leaked Fe2+ then extends peroxidation to the ER and plasma membrane toward ferroptotic death.",
      evidenceAnchor: "A lysosome-localizing radical trap captures early RSL3-induced radicals and, when lysosome-targeted, blocks death at lower doses; lysosomal leakage precedes LDH release, cytosolic Fe2+ then rises, and promoting lysosomal permeabilization enhances killing of GPX4-null tumours.",
      scope: "The key timing comes mainly from RSL3/erastin in Calu-1, and both the radical trap and the iron probes can perturb the chemistry they report, so the lysosome-first order holds for these conditions rather than for every inducer, and the in vivo work uses a preformed GPX4 knockout in immunodeficient mice.",
      openQuestion: "Does the lysosome-first order hold under pharmacological GPX4 inhibition and in patient tumours, and what sets the lysosomal-membrane-permeabilization threshold that lets less sensitive cells survive?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Where does a probe that captures lethal lipid radicals localize, and does clearing radicals there block death?", intervention: "Probe dose-viability, LC-MS/MS radical adducts, Lip-1 and OH-Pen controls, live-cell co-localization, and a lysosome-targeted trap (Lyso-NBD-Pen).", readout: "Radical-adduct identity, punctate probe localization, and viability at each probe dose.", answer: "NBD-Pen captures the truncated alkyl radicals that rise after RSL3 and forms lysosome-like puncta; lysosome-targeted Lyso-NBD-Pen suppresses ferroptosis at lower concentration.", boundary: "NBD-Pen and Lyso-NBD-Pen are both detectors and radical scavengers, so the localization readout comes from a system already perturbed by the probe; C11-BODIPY does not show the same lysosomal signal under these conditions." },
      { figure: "Fig. 2", question: "Does lysosomal lipid peroxidation cause lysosomal membrane permeabilization first, then spread to other membranes via Fe2+ leakage?", intervention: "Acridine orange, 40-kDa dextran and cathepsin B leakage, lysosomal and cytosolic Fe2+ probes, time-resolved NBD-Pen imaging, ER/plasma-membrane co-staining, and delayed-addition rescue.", readout: "Order of lysosomal leakage, cytosolic Fe2+ rise, LDH release, and whole-cell peroxidation.", answer: "After RSL3, lysosomal pH change and dextran and cathepsin leakage precede LDH release; cytosolic Fe2+ then rises, and iron chelators or radical traps added late still suppress whole-cell peroxidation and death.", boundary: "Both iron and radical fluorescent probes can shift the chemical balance; the key timing comes mainly from RSL3/erastin in Calu-1 and cannot be equated directly with all induction modes." },
      { figure: "Fig. 3", question: "Do less sensitive cells already undergo lysosomal lipid peroxidation but survive by not crossing the permeabilization threshold?", intervention: "Dose-response across NSCLC lines, lysosomal imaging, chloroquine/NH4Cl/methylamine with bafilomycin controls, a death-inhibitor panel, dextran leakage and iron probes.", readout: "Sublethal lysosomal probe signal, and permeabilization, cytosolic Fe2+ and death after lysosomotropic agents.", answer: "Less sensitive cells such as PC9 still show lysosomal NBD-Pen signal at sublethal RSL3; lysosomotropic agents such as chloroquine promote permeabilization, cytosolic Fe2+ and ferroptosis, blocked by Lip-1 or DFO.", boundary: "Chloroquine and high-concentration weak bases have broad lysosomal effects, so pharmacological synergy does not show permeabilization is the sole cause, and the concentrations used and their clinical reachability are not resolved." },
      { figure: "Fig. 4", question: "Can artificially promoting lysosomal membrane permeabilization enhance suppression of GPX4-null tumours in vivo?", intervention: "GPX4-knockout versus wild-type H460 subcutaneous xenografts, randomized vehicle or chloroquine, serial tumour volume, endpoint weight and 4-HNE staining.", readout: "Tumour growth, endpoint weight and 4-HNE.", answer: "Chloroquine slows GPX4-knockout H460 xenograft growth and lowers endpoint tumour weight, with increased 4-HNE.", boundary: "The in vivo model uses a preformed GPX4 knockout in immunodeficient mice; 4-HNE is an oxidation endpoint rather than evidence of lysosomal initiation, and pharmacological GPX4 inhibition and patient tumours are not tested." },
    ],
    labs: [
      { labId: "yamada-kyushu", role: "lead", roleBasis: "Last author of the 17-author Crossref author list (Ken-ichi Yamada), verified at Crossref on 2026-07-24. The contribution statement was not re-read in this pass.", continuity: "Extends the laboratory's work on radical-trapping probes and where in the cell lipid peroxidation is initiated and propagated during ferroptosis." },
    ],
  },

  {
    doi: "10.1038/s41556-025-01790-y",
    title: "FSP1-mediated lipid droplet quality control prevents neutral lipid peroxidation and ferroptosis",
    journal: "Nature Cell Biology",
    year: 2025,
    citation: "Nature Cell Biology 27, 1902-1913",
    crossrefFinding:
      "Nature Cell Biology, volume 27, issue 11, pages 1902-1913, published 2025, 16 authors, first " +
      "author Mike Lange, last author James A. Olzmann (Maria Fedorova is second-to-last). No " +
      "correction, erratum or update relation is registered against this DOI at Crossref, verified 2026-07-24.",
    theme: "FSP1 as a lipid-droplet quality-control enzyme against neutral-lipid peroxidation",
    conditionVector:
      "Cultured cells with genetic and pharmacological FSP1 perturbation, arachidonic-acid loading and " +
      "DGAT-dependent lipid-droplet induction, plus a minimal reconstituted droplet system; " +
      "perturbations are FSP1 loss and inhibition, organelle-directed and catalytic-mutant FSP1 " +
      "constructs, purified FSP1 with CoQ10 and NADH, DGAT and acyl-CoA pathway manipulation and " +
      "ferrostatin-1 rescue; readouts are lipidomics of PUFA glycerolipids, oxidized triacylglycerol " +
      "and cholesteryl ester, time-resolved epilipidomics, droplet imaging and cell death.",
    sixtySecond: {
      story: "FSP1 is known as a plasma-membrane antioxidant in ferroptosis, but whether it also guards the neutral lipids stored in lipid droplets was not established.",
      advance: "The work indicates FSP1 acts at the lipid-droplet surface through CoQ10 cycling to perform neutral-lipid quality control, limiting the initiation or amplification of ferroptosis, and shows loss of FSP1 lets oxidized triacylglycerol and cholesteryl ester accumulate and spread.",
      evidenceAnchor: "Lipidomics links FSP1 activity to the PUFA glycerolipid pool, droplet-directed catalytically active FSP1 is needed for protection, a reconstituted FSP1/CoQ10/NADH system lowers triacylglycerol oxidation, and oxidized neutral lipids accumulate first when FSP1 is lost, with ferrostatin-1 rescue.",
      scope: "Much of the causal work depends on an engineered PUFA-loaded droplet-rich background and reconstituted systems that can carry bacterial CoQ8 and purification impurities, and no animal model shows this pathway dominates in vivo, so the droplet role is supported rather than established as the general main route.",
      openQuestion: "How much of endogenous ferroptosis protection runs through droplet FSP1 in unmanipulated cells and tissues, and can droplet-localized CoQ reduction flux be measured directly rather than inferred from localization and reconstitution?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Does FSP1 activity systematically change the PUFA glycerolipid pool?", intervention: "Genetic and pharmacological FSP1 perturbation with comparative lipidomics of lipid changes with and without FSP1.", readout: "PUFA glycerolipid oxidation and composition by lipidomics.", answer: "Loss of FSP1 function is accompanied by PUFA glycerolipid oxidation and compositional change, indicating that neutral lipids are also a protected substrate pool.", boundary: "An omics association nominates a candidate lipid pool but cannot on its own show that the lipid droplet is the causal site of action." },
      { figure: "Fig. 2", question: "Are both lipid-droplet localization and FSP1 catalytic activity required for protection?", intervention: "Organelle-directed FSP1 constructs, catalytic mutants, oxidized-lipid readouts and ferroptosis phenotypes.", readout: "Oxidized triacylglycerol and cholesteryl ester and cell death per construct.", answer: "FSP1 directed to lipid droplets and catalytically intact suppresses oxidized triacylglycerol and cholesteryl ester and cell death, while inactive constructs cannot provide protection.", boundary: "The effect depends on an engineered droplet-rich background and cannot be extrapolated to a general dominant pathway in the basal cell state." },
      { figure: "Fig. 3", question: "Can FSP1 directly suppress triacylglycerol peroxidation in a minimal droplet system?", intervention: "Artificial droplets, purified FSP1, cofactor reconstitution with CoQ10 and NADH, and oxidation-product analysis.", readout: "Triacylglycerol oxidation with and without the reconstituted FSP1 system.", answer: "In the reconstituted system FSP1, CoQ10 and NADH together lower triacylglycerol oxidation, supporting a direct chemical mechanism.", boundary: "Bacterially expressed protein can carry a CoQ8 background, and a minimal system still needs care against exogenous quinones and purification impurities." },
      { figure: "Fig. 4", question: "How can cell conditions be set up to expose droplet FSP1 function?", intervention: "Arachidonic-acid loading, DGAT dependence, droplet imaging and lipid-composition measurement.", readout: "PUFA-triacylglycerol droplet formation and composition.", answer: "Arachidonic-acid loading together with the DGAT pathway forms PUFA-rich triacylglycerol droplets, providing the condition for the causal tests that follow.", boundary: "This is an artificially enhanced nutrient-loading model and is not equivalent to the physiological PUFA supply of different tissues." },
      { figure: "Fig. 5", question: "When FSP1 is lost, does oxidation appear first in the neutral-lipid fraction?", intervention: "Lipid fractionation, time-resolved epilipidomics, FSP1 inhibition or knockout, and ferrostatin-1 rescue.", readout: "Timing of oxidized triacylglycerol/cholesteryl ester versus broader polar-lipid oxidation.", answer: "Time-resolved fractionation shows oxidized triacylglycerol and cholesteryl ester accumulating first in the neutral fraction, followed by broader polar-lipid oxidation, with ferrostatin-1 rescue.", boundary: "Isotope-labelled internal standards were not used for all oxidation products, and some lipid alcohols may be alkaline-hydrolysis artefacts." },
      { figure: "Fig. 6", question: "Does death caused by PUFA droplets depend on neutral-lipid synthesis and match ferroptosis?", intervention: "Cell death, radical-trap rescue, genetic and pharmacological lipid-synthesis perturbation, and multi-cell-line comparison.", readout: "Arachidonic-acid toxicity, ferrostatin-1 rescue and DGAT/acyl-CoA dependence.", answer: "Under FSP1 loss, arachidonic-acid toxicity is suppressed by ferrostatin-1 and depends on the DGAT and acyl-CoA pathways.", boundary: "Cell-type effects are not fully consistent, and no animal model shows this route dominates in vivo." },
    ],
    labs: [
      { labId: "olzmann-berkeley", role: "lead", roleBasis: "Last author of the 16-author Crossref author list (James A. Olzmann), verified at Crossref on 2026-07-24. The contribution statement was not re-read in this pass.", continuity: "Extends the laboratory's work on lipid-droplet biology and how neutral-lipid quality control intersects with ferroptosis and membrane lipid oxidation." },
      { labId: "fedorova-dresden", role: "co-lead", roleBasis: "Second-to-last author of the 16-author Crossref author list (Maria Fedorova), a co-senior position with last author James A. Olzmann, verified at Crossref on 2026-07-24. The contribution statement was not re-read in this pass.", continuity: "Extends the laboratory's redox-lipidomics and epilipidomics work on oxidized lipid species, here mapping oxidized neutral lipids under FSP1 loss." },
    ],
  },

  {
    doi: "10.1038/s41419-024-07150-2",
    title: "Retinal pigment epithelium-specific ablation of GPx4 in adult mice recapitulates key features of geographic atrophy in age-related macular degeneration",
    journal: "Cell Death & Disease",
    year: 2024,
    citation: "Cell Death & Disease 15, 763",
    crossrefFinding:
      "Cell Death & Disease, volume 15, issue 10, article 763, published 2024, 10 authors, first " +
      "author Kunihiro Azuma, last author Takashi Ueta (Hirotaka Imai is author 5 of 10). No " +
      "correction, erratum or update relation is registered against this DOI at Crossref, verified 2026-07-24.",
    theme: "adult RPE GPx4 loss as a mixed ferroptosis-necroptosis model of geographic atrophy",
    conditionVector:
      "Adult mice with RPE65-promoter AAV-Cre inducing RPE-specific GPx4 deletion; perturbations are " +
      "GPx4 conditional knockout, vitamin E, and ferrostatin-1, necrostatin-1s and Z-VAD death " +
      "inhibitors; readouts are RPE morphology and injury scoring, acrolein/MDA/4-HNE lipid " +
      "peroxidation, fundus, SD-OCT and autofluorescence imaging, transmission electron microscopy, " +
      "complement C3/MAC and necrosome protein analysis over 13-42 day windows.",
    sixtySecond: {
      story: "Geographic atrophy in age-related macular degeneration destroys the retinal pigment epithelium, but a tractable adult model of what drives that loss was needed.",
      advance: "RPE-specific GPx4 deletion in adult mice triggers lipid peroxidation and progressive RPE degeneration with geographic-atrophy-like features, and inhibitor rescue indicates the tissue damage is a mixture of ferroptosis and necroptosis rather than ferroptosis alone.",
      evidenceAnchor: "AAV-Cre lowers RPE GPX4 and raises aldehyde lipid-peroxidation products before morphological loss, vitamin E improves the phenotype, the model reproduces AMD-like imaging and histopathology, and ferrostatin-1 and necrostatin-1s both improve injury while Z-VAD does not.",
      scope: "About half the RPE is transduced and injured samples include mixed RPE-choroid tissue, the model is driven by acute GPx4 deletion without the early lipid deposits of human disease, and pharmacological rescue does not establish the genetic necessity of either death programme.",
      openQuestion: "Which cell-autonomous death programme is genetically required in RPE, and does a slower, age-related loss of GPX4 or related defences reproduce the same pathology without acute deletion?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Can AAV-Cre efficiently delete GPX4 in adult RPE and produce lipid peroxidation before morphological injury?", intervention: "An RPE65-promoter AAV-Cre with mCherry/Cre localization, GPX4 immunostaining, and RPE-choroid aldehyde lipid-peroxidation readouts against wild-type plus AAV-Cre controls.", readout: "GPX4 level and RPE localization, and acrolein, MDA and 4-HNE.", answer: "RPE65-promoter AAV-Cre expresses in RPE and lowers GPX4, and acrolein, MDA and 4-HNE rise afterwards.", boundary: "Transduction covers about half the RPE and injured samples contain mixed RPE-choroid tissue; aldehyde endpoints cannot resolve the specific lethal oxidized phospholipid." },
      { figure: "Fig. 2", question: "Is GPX4 loss sufficient to cause progressive RPE degeneration, and is it relieved by a lipophilic antioxidant?", intervention: "A predefined RPE injury grade, centre-to-periphery morphometry, Cre-virus controls, and vitamin E intervention.", readout: "RPE morphology, injury scores and cell enlargement over 14 and 42 days.", answer: "By 14 days RPE cells enlarge and lose their hexagonal structure with regional degeneration that worsens by 42 days, and vitamin E markedly improves morphology and injury scores.", boundary: "Vitamin E shows the importance of a lipid-radical process but is not a ferroptosis-specific rescue and cannot separate initial death from secondary inflammatory injury." },
      { figure: "Fig. 3", question: "Does the degeneration reproduce key histopathological features of late dry AMD and geographic atrophy?", intervention: "Fundus, SD-OCT, histology, autofluorescence, F4/80 and Iba1 markers, complement immunostaining and C9/C9b protein analysis.", readout: "Hypopigmented patches, OCT hyperreflective foci, RPE/photoreceptor loss, pigment-laden phagocytes and complement activation.", answer: "The model shows hypopigmented patches, OCT hyperreflective foci, RPE and photoreceptor loss, pigment-laden phagocytes and complement C3/MAC activation.", boundary: "These are an AMD-like set of phenotypes; the model lacks the early-to-intermediate human lipid deposits and is driven by acute GPX4 deletion, so it cannot establish patient aetiology." },
      { figure: "Fig. 4", question: "Does ultrastructure support RPE polarity collapse, phagocytic burden and rapid tissue degeneration?", intervention: "Transmission electron microscopy at 13-14 days comparing control and GPX4 conditional-knockout RPE, photoreceptor outer segments and pigment-laden cells.", readout: "Apical microvilli and basal infolding, melanolipofuscin, undigested outer segments and RPE loss.", answer: "TEM shows loss of apical microvilli and basal infoldings, accumulation of melanolipofuscin and undigested outer segments, followed by loss of RPE and outer segments.", boundary: "Ultrastructure is a descriptive endpoint that cannot on its own decide the mode of death or confirm the lineage origin of the observed phagocytes." },
      { figure: "Fig. 5", question: "Is the RPE injury differentially rescued by ferroptosis, necroptosis or apoptosis inhibitors?", intervention: "Ferrostatin-1, necrostatin-1s, Z-VAD or vehicle in the same GPX4 conditional-knockout model, with blinded morphology and cell-count comparison.", readout: "Injury scores and surviving RPE cell numbers per inhibitor.", answer: "Ferrostatin-1 and necrostatin-1s both improve injury scores and surviving RPE numbers, while Z-VAD gives no significant protection.", boundary: "Pharmacological rescue indicates that two death programmes participate but does not establish the genetic necessity of either, and this result directly argues against describing the model as pure ferroptosis." },
      { figure: "Fig. 6", question: "Is there structural and signalling evidence supporting coexisting ferroptosis and necroptosis?", intervention: "TEM mitochondrial-area morphometry, insoluble/soluble protein fractionation and necrosome-related immunoblotting.", readout: "Mitochondrial size, and RIP3, MLKL, p-MLKL and cleaved caspase-8 p18.", answer: "RPE mitochondria shrink while the insoluble fraction shows increased RIP3, MLKL and p-MLKL and lower active caspase-8 p18.", boundary: "Mitochondrial shrinkage is not a ferroptosis-exclusive marker, and RPE-specific RIPK3/MLKL genetic deletion was not used to establish the cell-autonomous necessity of necroptosis." },
    ],
    labs: [
      { labId: "imai-kitasato", role: "contributing-author", roleBasis: "Author 5 of the 10-author Crossref author list (Hirotaka Imai), a contributing co-author; the senior last author is Takashi Ueta. Position verified at Crossref on 2026-07-24, and the contribution statement was not re-read in this pass.", continuity: "Connects to the laboratory's long work on phospholipid hydroperoxide GPX4 biology, here contributed to an RPE-specific GPx4-loss retinal degeneration model." },
    ],
  },

  {
    doi: "10.1016/j.molcel.2024.10.028",
    title: "PRDX6 dictates ferroptosis sensitivity by directing cellular selenium utilization",
    journal: "Molecular Cell",
    year: 2024,
    citation: "Molecular Cell 84, 4629-4644.e9",
    crossrefFinding:
      "Molecular Cell, volume 84, issue 23, pages 4629-4644.e9, published 2024, 25 authors, first " +
      "author Junya Ito, last author Marcus Conrad (Eikan Mishima is author 24 of 25, second-to-last). " +
      "A preprint relation is registered; no correction, erratum or update relation is registered " +
      "against this DOI at Crossref, verified 2026-07-24.",
    theme: "PRDX6 as a selenium carrier that supports selenoprotein synthesis rather than a GPX4 substitute",
    conditionVector:
      "Multiple cancer cell lines with PRDX6 and PRDX-family knockout and re-expression of WT, S32A, " +
      "C47S and C91S mutants, plus whole-body Prdx6-knockout mice and A549 xenografts; perturbations " +
      "are selenium source (selenite, L-selenocystine, GS-Se-SG), BSO and cysteine restriction, and " +
      "the IKE and RSL3/erastin inducers; readouts are deuterated-PCOOH LC-MS/MS reduction assays, " +
      "GPX4/GPX1 and selenoprotein immunoblots, DepMap co-dependency, C11-BODIPY, site mass " +
      "spectrometry, ICP-MS selenium binding and tumour growth.",
    sixtySecond: {
      story: "PRDX6 protects against ferroptosis, but whether it does so by directly reducing phospholipid hydroperoxides like GPX4 was uncertain.",
      advance: "The work indicates PRDX6 does not mainly substitute for GPX4 at the membrane but instead, through its C47 residue, accepts and mobilizes selenium to raise the translation efficiency of GPX4 and other selenoproteins.",
      evidenceAnchor: "GPX4-null lysate keeps most of its phospholipid-hydroperoxide reduction independent of PRDX6, PRDX6 loss lowers GPX4 protein and selenium utilization without changing GPX4 mRNA, a C47S mutant fails to restore selenoproteins or selenium rescue, and C47 accepts selenium in a defined chemical system.",
      scope: "Much of the selenium work uses strong reducing-power and selenium-source manipulations that also affect xCT, GSH and ferroptosis together, and whole-body and xenograft models cannot localize the effect to a cell type, so the selenium-carrier model is supported rather than fully isolated as the sole function.",
      openQuestion: "Does a GSH-dependent mobile selenium carrier such as GS-Se-SG exist and act inside cells, and can the C47 selenium-transfer function be separated cleanly from the classic peroxidase activity of that same residue?",
    },
    figureAudit: [
      { figure: "Fig. 1", question: "Is the residual phospholipid-hydroperoxide reduction after GPX4 loss carried directly by PRDX6?", intervention: "Deuterated-PCOOH LC-MS/MS reduction assays, purified GPX4/PRDX6 controls, GPX4 and PRDX6 knockout lysates, and GPX4 re-expression.", readout: "PCOOH reduction capacity per genotype and protection of GPX4-null cells.", answer: "GPX4-null lysate keeps about two-thirds of its PCOOH reduction capacity, but PRDX6 overexpression or loss changes it little, and overexpression does not protect GPX4-deficient cells.", boundary: "A lysate assay lacks the intact membrane environment and may underestimate PRDX6 activity that needs GST/GSH cycling; the result excludes a major direct-substitute role, not every local peroxidase contribution." },
      { figure: "Fig. 2", question: "If not by directly reducing PCOOH, why does PRDX6 loss raise ferroptosis sensitivity?", intervention: "Multi-sgRNA multi-cell-line immunoblotting, DepMap protein correlation, RSL3/erastin/FSP1-inhibitor dose-response, and Lip-1 rescue.", readout: "GPX4 protein, inducer sensitivity and Lip-1 rescue across lines.", answer: "PRDX6 knockout lowers GPX4 protein and increases sensitivity to several ferroptosis inducers with Lip-1 rescue, while knockout of other PRDX-family members does not reproduce the effect.", boundary: "The effect depends on a cell's baseline reliance on GPX4, for example H460 changes little to RSL3, and a cross-cell-line protein correlation is not itself causal." },
      { figure: "Fig. 3", question: "Does PRDX6 control cellular selenium utilization and selenoprotein synthesis after transcription?", intervention: "DepMap co-dependency, GPX4 qPCR, L-selenocystine and selenite dose rescue, selenium-restricted culture, C11-BODIPY, and selenoprotein immunoblots.", readout: "Selenium co-dependency, GPX4 mRNA, selenium rescue requirement and lipid peroxidation under selenium restriction.", answer: "PRDX6 forms a co-dependency cluster with selenium-metabolism genes, its loss does not lower GPX4 mRNA but raises the selenium supplementation requirement, and selenium restriction rapidly drives Lip-1-inhibitable peroxidation and death in knockout cells.", boundary: "Medium, dialysed serum and selenium source strongly change the phenotype; supplemented selenium doses do not directly represent the physiological selenium flux of different tissues." },
      { figure: "Fig. 4", question: "Which functional site of PRDX6 is responsible for selenium metabolism and ferroptosis protection?", intervention: "Re-expression of WT, S32A (PLA2 site), C47S and C91S in PRDX6-knockout cells, comparing selenoprotein expression, drug sensitivity and selenium-restriction death.", readout: "GPX4/GPX1 recovery, RSL3/erastin tolerance and selenium-rescue survival per mutant.", answer: "C47S fails to restore GPX4/GPX1, selenium-supported survival or RSL3/erastin tolerance, while the PLA2-site S32A and the alternative cysteine C91S largely do.", boundary: "C47 is also the classic peroxidase active site; a point mutation may change local conformation or several chemistries, so re-expression alone cannot attribute all function to selenium transport." },
      { figure: "Fig. 5", question: "Does PRDX6 raise the utilization efficiency of organic and inorganic selenium under low GSH or cysteine?", intervention: "BSO, cysteine-free and erastin pretreatment, then dose rescue with the two selenium sources and selenoprotein immunoblots.", readout: "L-selenocystine and selenite rescue efficiency and selenoprotein expression under reducing-power restriction.", answer: "When GSH or cysteine is lowered, PRDX6 knockout needs more L-selenocystine and can barely use selenite to restore GPX4/GPX1, while beta-mercaptoethanol partially rescues.", boundary: "These strong reducing-power perturbations affect xCT, GSH and ferroptosis at the same time, and the multi-pathway coupling makes the independent flux contribution of PRDX6 hard to quantify." },
      { figure: "Fig. 6", question: "Can PRDX6 directly accept selenium through C47 in a defined chemical system?", intervention: "Recombinant PRDX6, isotope and fragment mass spectrometry, LC-MS site identification, ICP-MS total selenium, and C47S, NEM, GSH/GSSG and synthetic GS-Se-SG controls.", readout: "C47 selenium modification and total selenium binding per condition.", answer: "LC-MS detects Se-SG and selenium modification at C47, and ICP-MS shows wild type binding more selenium under selenite plus GSH or GS-Se-SG while C47S binds less, supporting a GSH-dependent mobile selenium-carrier model.", boundary: "ICP-MS still shows residual binding without GSH or after NEM, which the authors consider possibly non-specific, and whether GS-Se-SG exists and is the main species used inside cells is not directly shown." },
      { figure: "Fig. 7", question: "Does the PRDX6-selenium axis have physiological consequences in normal tissue and tumours?", intervention: "Whole-body Prdx6-knockout brain, liver and kidney immunoblots, and WT/knockout A549 xenografts with vehicle or IKE, tumour growth and endpoint protein analysis.", readout: "Tissue GPX4/GPX1, and xenograft growth and selenoprotein levels under IKE.", answer: "Prdx6-null mouse brain, but not liver or kidney, markedly lowers GPX4/GPX1, and A549 PRDX6-knockout xenografts are more sensitive to IKE while keeping lower GPX4/GPX1.", boundary: "Whole-body knockout cannot localize the brain effect to a cell type, and the xenografts use immunodeficient mice with tumour shrinkage not attributed by multiple orthogonal in-tissue ferroptosis markers." },
    ],
    labs: [
      { labId: "mishima-tohoku", role: "co-lead", roleBasis: "Second-to-last author of the 25-author Crossref author list (Eikan Mishima), a co-senior position with last author Marcus Conrad. Position verified at Crossref on 2026-07-24, and the contribution statement was not re-read in this pass.", continuity: "Extends the laboratory's work on selenium and selenoprotein biology in ferroptosis, here defining PRDX6 as a selenium carrier that supports GPX4 synthesis." },
    ],
  },
];
