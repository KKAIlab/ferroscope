// Clause-level support corrections the round-6 review named (P0-5 / P0-E). Each entry replaces
// the whole evidence array for one decision field so a multi-clause value carries one fragment
// per clause, and an over-broad "explicit" label is split into an explicit source fact plus a
// declared derivation or analytical inference. Scope ids are the module-local scope ids; the
// migration remaps them to canonical registry scope ids.

const zou = "zou2020-pmc7353921";
const zouEvent = "claude-r4-zou2020";
const kagan = "kagan2017-pmc5506843";
const kaganEvent = "claude-r4-kagan2017";
const thermo = "thermofisher-d3861";
const thermoEvent = "claude-r4-thermofisher-d3861";

export const CORRECTIONS = {
  "mda-4hne": {
    readout: [
      {
        sourceRecordId: zou, reviewEventId: zouEvent, scopeId: "methods-mda", supportMode: "explicit",
        claimFragment: "measured fluorometrically with a commercial kit (Abcam ab118970) after thiobarbituric-acid addition",
        supportNote: "The Methods name the Abcam ab118970 kit, the TBA addition and the fluorometric readout verbatim.",
      },
      {
        sourceRecordId: zou, reviewEventId: zouEvent, scopeId: "methods-mda", supportMode: "derived",
        claimFragment: "the measured species is the malondialdehyde–thiobarbituric-acid (MDA–TBA) adduct",
        supportNote: "The kit reports a fluorescent TBARS signal; identifying that signal specifically as the MDA–TBA adduct is the standard reading of the assay, not a species identification the Methods make, so it is derived rather than explicit.",
      },
    ],
    negativeControl: [
      {
        sourceRecordId: zou, reviewEventId: zouEvent, scopeId: "methods-mda", supportMode: "explicit",
        claimFragment: "the DMSO, ML210 and ML210-plus-liproxstatin-1 conditions are run",
        supportNote: "The Methods record the DMSO baseline, ML210 and ML210+Lip-1 rescue conditions verbatim.",
      },
      {
        sourceRecordId: zou, reviewEventId: zouEvent, scopeId: "methods-mda", supportMode: "derived",
        claimFragment: "DMSO baseline and the liproxstatin-1 rescue serve as the negative-control axis",
        supportNote: "Assigning the baseline and rescue conditions to the negative-control axis is a classification per the control-axis definitions, not a label the Methods themselves apply.",
      },
    ],
    processControl: [
      {
        sourceRecordId: zou, reviewEventId: zouEvent, scopeId: "methods-mda", supportMode: "explicit",
        claimFragment: "butylated hydroxytoluene is added to the lysis buffer and every sample is protein-normalised",
        supportNote: "The Methods state that BHT is added to the lysis buffer and that signal is normalised to protein.",
      },
      {
        sourceRecordId: zou, reviewEventId: zouEvent, scopeId: "methods-mda", supportMode: "derived",
        claimFragment: "BHT functions as a process control that limits ex-vivo lipid oxidation during handling",
        supportNote: "That BHT is present is explicit; reading its role as a process control against ex-vivo oxidation is the accepted rationale for the additive, classified here, not stated as such in the Methods.",
      },
    ],
    compartmentResolution: [
      {
        sourceRecordId: zou, reviewEventId: zouEvent, scopeId: "methods-mda", supportMode: "explicit",
        claimFragment: "MDA is measured from a bulk cell homogenate",
        supportNote: "The Methods measure MDA from a bulk homogenate workflow.",
      },
      {
        sourceRecordId: zou, reviewEventId: zouEvent, scopeId: "methods-mda", supportMode: "analytical-inference",
        claimFragment: "so the assay carries no molecular-species or compartment resolution",
        supportNote: "The absence of species or compartment resolution follows from the bulk-homogenate design; it is an analytical inference, not a limitation the Methods state.",
      },
    ],
    orthogonalConfirmation: [
      {
        sourceRecordId: zou, reviewEventId: zouEvent, scopeId: "fig-5", supportMode: "explicit",
        claimFragment: "MDA is placed alongside BODIPY-C11 and species-resolved redox-lipidomics",
        supportNote: "Fig. 5 shows the MDA readout together with BODIPY-C11 and redox-lipidomics.",
      },
      {
        sourceRecordId: zou, reviewEventId: zouEvent, scopeId: "results-por-peroxidation", supportMode: "derived",
        claimFragment: "the bulk product corroborates, rather than substitutes for, the species-level measurement",
        supportNote: "The readouts appear together in the results; reading them as mutually corroborating is a derivation, not a statement that the study requires them to move together.",
      },
    ],
  },
  "oxidized-pl-lcms": {
    positiveControl: [
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "methods-hydroperoxy-pe", supportMode: "explicit",
        claimFragment: "authentic SAPE-OOH is prepared by 15-lipoxygenase oxidation and HPLC-purified to 99%",
        supportNote: "The Methods prepare and HPLC-purify authentic SAPE-OOH to 99%.",
      },
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "methods-identification-pe-ox", supportMode: "derived",
        claimFragment: "it serves as the assay's positive-control / analytical identity-reference axis",
        supportNote: "The authentic standard is used to confirm the identity of the oxygenated PE detected in cells; classifying it as the positive-control axis is a control-axis assignment, not a term the Methods use.",
      },
    ],
    negativeControl: [
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "results-acsl4", supportMode: "explicit",
        claimFragment: "the oxygenated-PE signal is strongly reduced in Acsl4-knockout cells (199.3 vs 72.2 pmol/µmol)",
        supportNote: "The Acsl4-KO results show the oxygenated-PE signal strongly reduced when the substrate-generating enzyme is lost.",
      },
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "results-acsl4", supportMode: "derived",
        claimFragment: "Acsl4-knockout is read as the assay's matched genetic negative-control condition",
        supportNote: "The reduction is explicit; treating Acsl4-KO as the negative-control axis is a classification per the control-axis definitions.",
      },
    ],
    processControl: [
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "methods-statistical", supportMode: "explicit",
        claimFragment: "phospholipids are quantified ratiometrically against a pre-selected internal standard using a per-class standard curve",
        supportNote: "The Statistical Analysis Methods state ratiometric comparison to a pre-selected internal standard with a per-class standard curve.",
      },
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "methods-statistical", supportMode: "derived",
        claimFragment: "this internal-standard quantification is read as the analytical process control",
        supportNote: "The quantification scheme is explicit; naming it the process control that governs analytical performance is a control-axis classification, not a statement the Methods make.",
      },
    ],
    compartmentResolution: [
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "methods-lcms-phospholipids", supportMode: "analytical-inference",
        claimFragment: "the LC-MS measures species from a whole-cell or whole-tissue lipid extract, so it carries no compartment resolution",
        supportNote: "The whole-extract LC-MS preparation is explicit; that it therefore resolves no compartment is an analytical inference from the extraction design. The absence of spatial resolution is cited to the extraction/LC-MS scope, not to the imaging scopes.",
      },
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "methods-live-imaging", supportMode: "explicit",
        claimFragment: "the endoplasmic-reticulum localisation came from a separate LiperFluo live-imaging experiment",
        supportNote: "The Live Cell Imaging Methods establish the ER localisation through LiperFluo imaging, which is a different experiment from the LC-MS.",
      },
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "results-liperfluo-er", supportMode: "explicit",
        claimFragment: "the ER-accumulation result is the imaging experiment, distinct from the whole-extract LC-MS",
        supportNote: "The LiperFluo ER-accumulation result establishes only where the paper obtained its ER localisation; it does not give the LC-MS spatial resolution.",
      },
    ],
    confounders: [
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "methods-lcms-free-esterified", supportMode: "explicit",
        claimFragment: "esterified oxidised acyls are read only after release by PAF-acetylhydrolase",
        supportNote: "The Methods state that esterified oxidised acyls are released by PAF-acetylhydrolase before analysis.",
      },
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "methods-identification-pe-ox", supportMode: "explicit",
        claimFragment: "detection uses targeted MS inclusion lists that see only the species they are set for",
        supportNote: "The identification Methods state the use of targeted MS inclusion lists.",
      },
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "methods-identification-pe-ox", supportMode: "analytical-inference",
        claimFragment: "an undetected species is therefore not evidence of absence",
        supportNote: "That an undetected species is not evidence of absence follows from the targeted inclusion-list design; it is analytical inference, not a stated limitation.",
      },
    ],
    orthogonalConfirmation: [
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "results-lcms-identification", supportMode: "explicit",
        claimFragment: "structural assignment uses MS2/MS3 fragmentation and stable-isotope d8-arachidonic-acid tracing",
        supportNote: "The identification results use MS2/MS3 and d8-AA tracing verbatim.",
      },
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "results-direct-oxygenation", supportMode: "derived",
        claimFragment: "convergent genetic (Acsl4-KO) and pharmacological (rosiglitazone) suppression of the same species tests the conclusion by another principle",
        supportNote: "The individual suppressions are explicit; reading them as orthogonal confirmation of one biological conclusion is a derivation.",
      },
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "fig-5", supportMode: "explicit",
        claimFragment: "the convergent readouts are shown together in Fig. 5",
        supportNote: "Fig. 5 shows the convergent readouts side by side.",
      },
    ],
  },
  "bodipy-c11-assay": {
    question: [
      {
        sourceRecordId: thermo, reviewEventId: thermoEvent, scopeId: "product-description", supportMode: "explicit",
        claimFragment: "the probe reports membrane lipid peroxidation as a shift in its fluorescence emission",
        supportNote: "The vendor page describes the probe as reporting membrane lipid peroxidation via an emission shift.",
      },
      {
        sourceRecordId: zou, reviewEventId: zouEvent, scopeId: "results-por-peroxidation", supportMode: "explicit",
        claimFragment: "the emission shift rises under a ferroptotic perturbation",
        supportNote: "The results read the probe's emission shift as membrane lipid peroxidation under the ferroptotic perturbation.",
      },
      {
        sourceRecordId: kagan, reviewEventId: kaganEvent, scopeId: "results-liperfluo-er", supportMode: "derived",
        claimFragment: "the probe reports an emission shift rather than an identified molecular lipid species",
        supportNote: "Kagan states that C11-BODIPY, unlike LiperFluo, does not interact with phospholipid hydroperoxides; reading this as a method boundary — an emission shift, not a species identification — is a derivation from that specificity limit, not a claim the assay itself makes.",
      },
    ],
  },
};
