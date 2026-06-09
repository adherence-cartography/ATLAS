# MAP/PEACS: A Behavioral Phenotyping and Coaching Framework for Medication Adherence in Digital Health Platforms

**Manuscript Type:** Original Research / Framework Paper
**Target Journal:** Journal of Medical Internet Research (JMIR) or npj Digital Medicine
**Submission Status:** Draft — Pending IRB Data Integration

---

## Abstract

**Background:** Medication non-adherence remains a critical global health crisis, contributing to an estimated $500 billion in avoidable costs annually in the United States alone and accounting for up to 50% of chronic disease treatment failures. Existing adherence interventions frequently apply uniform behavioral strategies regardless of the underlying reason for non-adherence, limiting their clinical efficacy. Advances in validated psychometric instruments, particularly the Morisky Medication Adherence Scale (MMAS-8), provide a foundation for more granular, phenotype-driven approaches.

**Objective:** This paper introduces the MAP/PEACS framework — Multidimensional Adherence Parameters (MAP) paired with the Predictive Emergence Assessment for Clinical Services (PEACS) — a structured methodology for classifying patients into discrete behavioral adherence subtypes and delivering matched coaching interventions through a digital health platform.

**Methods:** MAP applies a multi-dimensional analysis of MMAS-8 item-level subscores to classify patients into one of four adherence phenotypes: Intentional Non-Adherent, Unintentional Non-Adherent, Partially Adherent, and Adherent. PEACS operationalizes phenotype-specific coaching protocols delivered through the ATLAS digital health platform, incorporating bidirectional patient-provider feedback loops and longitudinal adherence tracking. Framework development drew on the MMAS validation literature, behavioral change theory, and digital health coaching evidence.

**Results:** Preliminary pilot outcomes are pending full IRB approval. Expected primary metrics include pre/post adherence rate change (MMAS-8 composite score delta), patient engagement rates, and provider satisfaction scores. Preliminary feasibility observations are described.

**Conclusions:** MAP/PEACS represents a clinically grounded, scalable framework for individualized adherence intervention. By pairing behavioral phenotyping with matched coaching protocols in a digital environment, the system addresses a longstanding gap between adherence measurement and actionable intervention. Full prospective validation is warranted and planned.

**Keywords:** medication adherence, behavioral phenotyping, MMAS-8, digital health coaching, patient engagement, chronic disease management, adherence interventions

---

## 1. Introduction

Medication non-adherence is among the most costly and prevalent problems in contemporary healthcare. The World Health Organization estimated that only 50% of patients with chronic conditions in developed countries take their medications as prescribed (WHO, 2003). In the United States, the consequences of non-adherence contribute to approximately 125,000 preventable deaths, 10% of all hospitalizations, and economic losses exceeding $500 billion per year (Osterberg & Blaschke, 2005; Iuga & McGuire, 2014). Despite decades of research and the development of numerous validated adherence instruments, translating adherence measurement into effective, individualized clinical intervention remains an unsolved problem.

A fundamental limitation of prevailing approaches is the conflation of adherence measurement with adherence intervention. Clinicians and health systems frequently administer validated tools such as the Morisky Medication Adherence Scale (MMAS-8) to stratify patients by adherence level — low, medium, or high — but the clinical response to that stratification is rarely structured, repeatable, or phenotype-informed. Low adherence is treated as a unitary phenomenon, when in practice it encompasses fundamentally different behavioral profiles: a patient who forgets to take morning doses because of cognitive overload is categorically different from a patient who intentionally skips doses due to perceived side effects or health beliefs. Delivering identical coaching content to both patients is unlikely to produce sustained behavior change in either.

The field of behavioral medicine has long recognized the importance of matching intervention to etiology. Motivational Interviewing (MI), for instance, is most effective when patients are in the contemplation or preparation stage of change, but poorly matched when patients are already in action (Miller & Rollnick, 2012). Cognitive-behavioral approaches are optimized for patients with structured barriers — such as forgetfulness, routine disruption, or anxiety — rather than those with volitional resistance. Despite this theoretical foundation, no widely adopted clinical framework systematically maps these distinctions onto an adherence phenotyping model and pairs each phenotype with a differentiated, digitally deliverable coaching protocol.

This paper addresses that gap by introducing MAP/PEACS: the Multidimensional Adherence Parameters system (MAP), which classifies patients into four clinically meaningful behavioral adherence subtypes using MMAS-8 item-level analysis, and the Predictive Emergence Assessment for Clinical Services (PEACS), which delivers phenotype-matched coaching interventions through a structured digital platform. Together, MAP/PEACS represents a departure from one-size-fits-all adherence management and toward a precision behavioral medicine model.

The clinical rationale for this framework is compelling. Systematic reviews have demonstrated that complex, multicomponent adherence interventions consistently outperform simple reminder-based or educational approaches (Nieuwlaat et al., 2014). Behavioral tailoring — aligning intervention content with the patient's specific adherence barrier — is among the most robust moderators of intervention effectiveness (Conn et al., 2015). Digital health platforms, when designed around structured behavioral protocols rather than generic reminders, have shown significant potential for sustainable adherence improvement (Gandapur et al., 2016). MAP/PEACS is designed to synthesize these evidence streams into an operationalizable clinical tool.

The remainder of this paper proceeds as follows. Section 2 reviews the validation history of the MMAS-8 and the gap in adherence coaching literature. Section 3 defines the four MAP phenotypes and their derivation from MMAS-8 subscores. Section 4 describes the PEACS coaching protocols and their digital delivery through the ATLAS platform. Section 5 presents preliminary outcome data and planned validation metrics. Section 6 discusses the framework's position relative to prior work, its limitations, and future directions.

---

## 2. Background

### 2.1 MMAS-8 Validation and Psychometric Properties

The Morisky Medication Adherence Scale (MMAS-8) is among the most widely validated and extensively deployed self-report adherence instruments in clinical and research settings globally. Developed and validated by Morisky and colleagues, the 8-item scale demonstrates strong internal consistency (Cronbach's alpha = 0.83), acceptable test-retest reliability, and significant criterion validity against objective adherence measures including pharmacy refill records and biological assay outcomes (Morisky, Ang, Krousel-Wood, & Ward, 2008). The MMAS-8 has been validated across more than 40 languages and disease states including hypertension, diabetes, HIV, dyslipidemia, and asthma, with translated and validated versions demonstrating cross-cultural measurement equivalence (Krousel-Wood et al., 2009; de Oliveira-Filho et al., 2012).

The scale produces a composite score (range 0–8) mapped to three adherence tiers: high adherence (score = 8), medium adherence (score 6 to <8), and low adherence (score <6). However, an underexploited feature of the MMAS-8 is its item-level structure. Items 1 through 7 assess distinct behavioral domains — including forgetting, carelessness, stopping medication when feeling better, stopping when feeling worse, taking all medication yesterday, cutting back, and annoyance from adherence demands — while item 8 captures frequency of difficulty remembering. This item-level granularity, when analyzed as subscores rather than collapsed into a composite, provides a theoretically motivated basis for phenotypic classification.

### 2.2 Gaps in Adherence Coaching Literature

Despite the existence of robust adherence measurement tools, the literature on adherence coaching interventions reflects significant gaps. Meta-analyses of pharmacist-led, nurse-led, and digital coaching interventions demonstrate moderate mean effect sizes but extreme heterogeneity (I² > 75% in multiple reviews), suggesting that average effects mask substantial variation in who responds to what type of intervention (Vervloet et al., 2012; Conn et al., 2015). This heterogeneity is rarely systematically explained by phenotypic patient characteristics; rather, study designs tend to apply uniform protocols and report aggregate outcomes.

The dominant theoretical frameworks applied to adherence interventions — Health Belief Model, Self-Determination Theory, Information-Motivation-Behavioral Skills model — all posit that different cognitive and motivational profiles require distinct intervention strategies (Fisher, Fisher, & Harman, 2003). Yet translating this theoretical premise into standardized clinical phenotyping with matched protocols has not been achieved at scale. MAP/PEACS is designed to operationalize this translation.

---

## 3. The MAP Framework: Multidimensional Adherence Parameters

### 3.1 Theoretical Basis

The MAP framework is grounded in the observation that non-adherence is etiologically heterogeneous and that effective intervention requires matching strategy to etiology. This is consistent with Horne and colleagues' Necessity-Concerns Framework, which distinguishes between patients who fail to adhere because they doubt the necessity of medication versus those who are concerned about side effects or complexity (Horne, Weinman, & Hankins, 1999). It is also consistent with the intentional/unintentional non-adherence distinction formalized by Lehane and McCarthy (2007), which separates volitional non-adherence (a deliberate decision not to take medication) from non-volitional non-adherence (forgetting or inability to execute the intended behavior).

MAP extends these theoretical foundations by incorporating a four-phenotype taxonomy that captures clinically distinguishable behavioral profiles directly from MMAS-8 item-level patterns, enabling classification at the point of assessment without requiring additional instruments.

### 3.2 The Four MAP Adherence Phenotypes

**Phenotype 1: Intentional Non-Adherent (INA)**
Patients classified as Intentional Non-Adherent demonstrate a pattern of volitional behavior change — deliberately stopping or reducing medication, typically in response to perceived side effects, negative health beliefs, or absence of perceived symptomatic benefit. On the MMAS-8, this phenotype is characterized by affirmative responses to items 3 (stopping when feeling better), 4 (stopping when feeling worse or side effects), and 8 (difficulty remembering driven by motivational rather than cognitive factors), in combination with a composite score below 6. Clinical theory suggests these patients require motivational engagement strategies — including MI-based exploration of ambivalence, direct discussion of medication necessity beliefs, and shared decision-making — rather than cognitive-behavioral reminder systems.

**Phenotype 2: Unintentional Non-Adherent (UNA)**
The Unintentional Non-Adherent phenotype captures patients who intend to take their medication as prescribed but fail to do so due to cognitive or structural barriers — primarily forgetfulness, disrupted routines, and difficulty integrating dosing into daily schedules. This phenotype is indexed by affirmative responses to items 1 (forgetting), 2 (carelessness at times), and 8 (frequency of difficulty remembering), with low endorsement of items reflecting intentional stopping. These patients demonstrate intact motivation but impaired execution. Evidence supports the use of environmental restructuring, habit cue pairing, and reminder-based digital nudges as primary intervention components (Lam & Fresco, 2015).

**Phenotype 3: Partially Adherent (PA)**
Partially Adherent patients exhibit mixed adherence behavior — taking medication more days than not, but with inconsistent patterns that do not reflect either stable intentionality or consistent forgetfulness. MMAS-8 profiles for this phenotype often show moderate scores (6 to <8) with no dominant item cluster. This group is theoretically heterogeneous and may represent patients in transition between non-adherence and adherence, or those with context-dependent barriers (e.g., adherence disruption during travel, illness episodes, or stress periods). Coaching for this phenotype emphasizes consolidation strategies, contingency planning, and engagement maintenance.

**Phenotype 4: Adherent (A)**
Patients scoring 8 on the MMAS-8 composite are classified as Adherent. While this group does not require adherence intervention, MAP recognizes that adherence is not static. Research has demonstrated substantial intra-individual variability in adherence over time (Vrijens et al., 2012), and the Adherent phenotype requires monitoring protocols and maintenance-oriented engagement to prevent regression. PEACS provides this group with positive reinforcement, longitudinal tracking, and proactive engagement during identified high-risk transition periods (medication changes, illness events, life disruptions).

### 3.3 Classification Procedure

MAP classification is performed algorithmically within the ATLAS platform. Upon completion of the MMAS-8 assessment, item-level responses are analyzed against a decision matrix that weights item clusters associated with intentional versus unintentional behavior patterns, alongside the composite score threshold. The classification output feeds directly into the PEACS protocol assignment system. Classification is repeated at each reassessment interval (typically 90 days), allowing phenotype drift to be captured and coaching protocols to be updated accordingly.

---

## 4. PEACS: Predictive Emergence Assessment for Clinical Services

### 4.1 Design Principles

PEACS is designed around three core principles derived from the behavioral change literature: (1) phenotype specificity — coaching content and modality are matched to the patient's MAP classification; (2) patient engagement — the system incorporates active patient participation, not passive information delivery; and (3) bidirectional feedback — both patients and providers receive structured information flows that support shared decision-making and longitudinal management.

The system is operationalized through the ATLAS digital health platform, a modular clinical tool designed for integration within healthcare workflows. ATLAS delivers PEACS coaching through a combination of structured messaging sequences, interactive check-in modules, provider dashboard reporting, and automated flagging of adherence deterioration signals.

### 4.2 Phenotype-Specific Coaching Protocols

**INA Protocol — Motivational Engagement Track**
Patients classified as Intentional Non-Adherent receive coaching grounded in Motivational Interviewing principles. Protocol content includes: structured exploration of medication necessity beliefs and concerns using validated Necessity-Concerns questionnaire probes; reflective prompts designed to surface ambivalence; peer narrative exposure (anonymized case vignettes of patients who navigated similar concerns); and direct provider escalation triggers when resistance patterns persist across two consecutive check-ins. The protocol explicitly avoids didactic information delivery, which evidence suggests is counterproductive in patients with active volitional resistance (Miller & Rollnick, 2012).

**UNA Protocol — Behavioral Structuring Track**
Unintentional Non-Adherent patients receive a behavioral structuring protocol focused on habit formation, environmental design, and cognitive scaffolding. Protocol elements include: personalized dosing schedule mapping aligned to existing daily routines (habit cue pairing); smart reminder configuration with patient-selected modalities (push notifications, SMS, app-based alerts); administration technique coaching for patients with physical dexterity or swallowing difficulties; and weekly adherence logging with automated positive reinforcement for streak maintenance. Gamification elements are incorporated modestly and optionally, consistent with evidence supporting their utility in routine-building without imposing motivational burden on patients already inclined to comply.

**PA Protocol — Consolidation and Resilience Track**
Partially Adherent patients receive a consolidation protocol targeting the specific contexts in which their adherence typically breaks down. Protocol delivery begins with a brief structured interview (via the ATLAS check-in module) to identify adherence disruption patterns — travel, schedule changes, refill lapses, co-pay burden, or emotional distress. Coaching content is then tailored dynamically to the identified disruption context and includes: contingency planning exercises; refill management prompts integrated with pharmacy systems where available; and stress-adherence psychoeducation for patients whose patterns suggest emotional regulation as a moderating variable.

**A Protocol — Maintenance and Monitoring Track**
Adherent patients receive a lower-intensity maintenance protocol. This includes quarterly MMAS-8 reassessment, longitudinal trend visualization within the patient-facing ATLAS interface, milestone acknowledgment, and proactive education about known adherence disruption triggers (new medication additions, formulary changes, life transitions). Provider alerts are generated if a patient reassesses out of the Adherent phenotype at any monitoring interval.

### 4.3 Patient-Provider Feedback Loop

PEACS incorporates a structured feedback architecture designed to close the loop between patient-facing coaching and clinical care. Providers receive a quarterly MAP/PEACS summary dashboard within ATLAS that reports: current phenotype classification per patient; adherence trajectory since last assessment; coaching protocol engagement metrics (session completion rates, check-in response rates); and flagged patients requiring clinical attention (phenotype deterioration, persistent INA pattern, or engagement dropout). This feedback structure is designed to enable providers to incorporate adherence data meaningfully into clinical encounters without requiring additional time investment outside the platform.

---

## 5. Preliminary Outcomes

### 5.1 Current Development Status

The MAP/PEACS framework has been operationalized within the ATLAS platform and is currently in pre-pilot implementation. Full prospective outcome data collection is contingent upon IRB approval, which has been submitted and is pending review. The following section describes the planned study design, expected metrics, and preliminary feasibility observations from framework development.

### 5.2 Planned Study Design

The planned validation study is a prospective, pre-post observational cohort with an intended sample of n = 200 patients across two ambulatory care sites, with chronic condition diagnoses requiring daily oral medication (hypertension, type 2 diabetes, or dyslipidemia). Patients will complete MMAS-8 assessment at enrollment (T0), receive MAP classification and initiation of phenotype-matched PEACS protocol, and complete reassessment at 90 days (T1) and 180 days (T2).

### 5.3 Planned Primary Outcome Metrics

**Primary metric:** Change in MMAS-8 composite score from T0 to T1 (90-day delta), stratified by MAP phenotype at baseline.

**Secondary metrics:**
- Patient engagement rate: Proportion of assigned PEACS sessions and check-ins completed per protocol per phenotype
- Phenotype migration: Frequency and direction of MAP classification change across T0–T1–T2 intervals
- Provider satisfaction: Structured survey assessing perceived clinical utility of ATLAS MAP/PEACS dashboard
- Healthcare utilization signal: Emergency department visits and unplanned hospitalizations at 180 days (administrative data)

### 5.4 Feasibility Observations

During framework development and platform build, structured usability testing with a convenience sample of five primary care providers identified strong perceived clinical relevance of the phenotype classification model, with all five providers indicating that phenotype-differentiated coaching "more closely reflects how I think about adherence in practice" than composite score stratification alone. Patient-facing module testing with a convenience sample of twelve patients identified high comprehension of phenotype-specific coaching content and acceptable usability of ATLAS check-in modules across age groups including patients aged 65 and older. Formal feasibility results will be reported in a subsequent methods paper.

---

## 6. Discussion

### 6.1 Positioning Relative to Prior Frameworks

MAP/PEACS is not the first attempt to introduce behavioral theory into adherence management. The Information-Motivation-Behavioral Skills (IMB) model (Fisher et al., 2003), the Theoretical Domains Framework (Atkins et al., 2017), and the COM-B model (Michie et al., 2011) all provide structured theoretical accounts of behavioral adherence determinants. What MAP/PEACS contributes that these frameworks do not is a direct, instrument-anchored phenotyping procedure that can be executed at the point of care using an already widely deployed validated scale (MMAS-8), without requiring additional assessment instruments or specialized training in behavioral theory.

Prior attempts to operationalize multi-component adherence interventions in digital health settings (Dayer et al., 2013; Park et al., 2014; Gandapur et al., 2016) have demonstrated feasibility and moderate efficacy but have not systematically phenotyped patients prior to protocol assignment. This distinction is theoretically significant: if non-adherence etiology predicts differential response to intervention type (as the behavioral change literature suggests), then non-phenotyped intervention studies will systematically underestimate efficacy for any given protocol while masking important sub-group effects.

### 6.2 Strengths

Several features of the MAP/PEACS framework represent substantive strengths. First, the phenotyping system builds on an instrument (MMAS-8) with an extensive international validation record, avoiding the burden of a novel unvalidated assessment. Second, the four-phenotype taxonomy maps cleanly onto distinct evidence-based intervention modalities, ensuring that coaching protocol selection is theoretically grounded rather than arbitrary. Third, the digital delivery architecture (ATLAS platform) enables scalable deployment, longitudinal monitoring, and data collection without requiring in-person contact, making the system suited to both primary care and telehealth contexts. Fourth, the bidirectional feedback architecture addresses the longstanding failure of adherence tools to generate clinically actionable output for providers.

### 6.3 Limitations

Several limitations warrant transparent acknowledgment. The MAP classification algorithm, while grounded in established behavioral theory and MMAS-8 item structure, has not yet been validated against gold-standard objective adherence measures (e.g., electronic pill cap data, pharmacy refill records). The phenotyping thresholds will require refinement through prospective data and, ideally, latent class analysis of item-level MMAS-8 response patterns in large clinical samples. The PEACS coaching protocols, while grounded in evidence-based behavioral change techniques, have not yet been tested for differential efficacy by phenotype in a randomized controlled design. Selection bias in feasibility testing is acknowledged.

Additionally, the MMAS-8 is a self-report instrument and thus subject to social desirability bias — a known limitation in adherence measurement research. MAP classification is only as reliable as the underlying MMAS-8 administration, and systematic under-reporting of non-adherence could result in misclassification toward the Adherent or Partially Adherent phenotypes.

### 6.4 Future Directions

The immediate priority is completion of the planned IRB-approved prospective cohort study. Beyond that, several research directions are indicated. First, latent class analysis of large MMAS-8 item-level datasets would provide an empirically derived alternative to the theory-based phenotyping algorithm, enabling comparison and potential refinement. Second, a randomized controlled trial comparing phenotype-matched versus phenotype-mismatched PEACS protocols would constitute a definitive test of the phenotyping hypothesis. Third, integration of pharmacy refill data and electronic health record flags into the MAP classification procedure could improve phenotyping accuracy beyond self-report. Fourth, extension to complex polypharmacy patients — who likely exhibit hybrid phenotype profiles — warrants dedicated framework development and testing.

---

## 7. Conclusion

Medication non-adherence is not a single problem. It is a family of behaviorally distinct problems that share a surface-level presentation — patients not taking their medications — but differ fundamentally in etiology, and therefore in the interventions likely to produce change. MAP/PEACS offers a structured, clinically feasible framework for making this distinction operationally meaningful in a digital health context.

By combining the established validity of the MMAS-8 with a four-phenotype behavioral taxonomy and a matched coaching protocol system, MAP/PEACS represents a meaningful step toward precision behavioral medicine in adherence management. The framework's integration into the ATLAS platform ensures that phenotyping and coaching are embedded in a scalable digital workflow with structured provider feedback, addressing both the measurement and the translation gaps that have limited adherence improvement at scale.

Prospective validation is planned and underway. The authors invite collaboration with clinical sites, health systems, and research partners interested in participating in validation studies or adapting the framework to specialized disease populations.

---

## References

Atkins, L., Francis, J., Islam, R., O'Connor, D., Patey, A., Ivers, N., Foy, R., Duncan, E. M., Colquhoun, H., Grimshaw, J. M., Lawton, R., & Michie, S. (2017). A guide to using the Theoretical Domains Framework of behaviour change to investigate implementation problems. *Implementation Science, 12*(1), 77. https://doi.org/10.1186/s13012-017-0605-9

Conn, V. S., Ruppar, T. M., Chan, K. C., Dunbar-Jacob, J., Pepper, G. A., & De Geest, S. (2015). Packaging interventions to increase medication adherence: Systematic review and meta-analysis. *Current Medical Research and Opinion, 31*(1), 145–160. https://doi.org/10.1185/03007995.2014.978939

Dayer, L., Heldenbrand, S., Anderson, P., Gubbins, P. O., & Martin, B. C. (2013). Smartphone medication adherence apps: Potential benefits to patients and providers. *Journal of the American Pharmacists Association, 53*(2), 172–181. https://doi.org/10.1331/JAPhA.2013.12202

de Oliveira-Filho, A. D., Morisky, D. E., Neves, S. J. F., Costa, F. A., & de Lyra, D. P. (2012). The 8-item Morisky Medication Adherence Scale: Validation of a Brazilian-Portuguese version in hypertensive adults. *Research in Social and Administrative Pharmacy, 10*(3), 554–561. https://doi.org/10.1016/j.sapharm.2012.10.005

Fisher, J. D., Fisher, W. A., & Harman, J. J. (2003). The information-motivation-behavioral skills model: A general social psychological approach to understanding and promoting health behavior. In J. Suls & K. A. Wallston (Eds.), *Social Psychological Foundations of Health and Illness* (pp. 82–106). Blackwell.

Gandapur, Y., Kianoush, S., Kelli, H. M., Isiadinso, I., Polanka, B., Howard, G., Bhatt, D. L., & Sherman, A. (2016). The role of mHealth for improving medication adherence in patients with cardiovascular disease: A systematic review. *European Heart Journal – Quality of Care and Clinical Outcomes, 2*(4), 237–244. https://doi.org/10.1093/ehjqcco/qcw018

Horne, R., Weinman, J., & Hankins, M. (1999). The beliefs about medicines questionnaire: The development and evaluation of a new method for assessing the cognitive representation of medication. *Psychology & Health, 14*(1), 1–24. https://doi.org/10.1080/08870449908407311

Iuga, A. O., & McGuire, M. J. (2014). Adherence and health care costs. *Risk Management and Healthcare Policy, 7*, 35–44. https://doi.org/10.2147/RMHP.S19801

Krousel-Wood, M., Islam, T., Webber, L. S., Re, R. N., Morisky, D. E., & Muntner, P. (2009). New medication adherence scale versus pharmacy fill rates in seniors with hypertension. *The American Journal of Managed Care, 15*(1), 59–66.

Lam, W. Y., & Fresco, P. (2015). Medication adherence measures: An overview. *BioMed Research International, 2015*, 217047. https://doi.org/10.1155/2015/217047

Lehane, E., & McCarthy, G. (2007). Intentional and unintentional medication non-adherence: A comprehensive framework for clinical research and practice? A discussion paper. *International Journal of Nursing Studies, 44*(8), 1468–1477. https://doi.org/10.1016/j.ijnurstu.2006.07.010

Michie, S., van Stralen, M. M., & West, R. (2011). The behaviour change wheel: A new method for characterising and designing behaviour change interventions. *Implementation Science, 6*(1), 42. https://doi.org/10.1186/1748-5908-6-42

Miller, W. R., & Rollnick, S. (2012). *Motivational Interviewing: Helping People Change* (3rd ed.). Guilford Press.

Morisky, D. E., Ang, A., Krousel-Wood, M., & Ward, H. J. (2008). Predictive validity of a medication adherence measure in an outpatient setting. *Journal of Clinical Hypertension, 10*(5), 348–354. https://doi.org/10.1111/j.1751-7176.2008.07572.x

Nieuwlaat, R., Wilczynski, N., Navarro, T., Hobson, N., Jeffery, R., Keepanasseril, A., Agoritsas, T., Mistry, N., Iorio, A., Jack, S., Sivaramalingam, B., Iserman, E., Mustafa, R. A., Jedraszewski, D., Cotoi, C., & Haynes, R. B. (2014). Interventions for enhancing medication adherence. *Cochrane Database of Systematic Reviews, 2014*(11), CD000011. https://doi.org/10.1002/14651858.CD000011.pub4

Osterberg, L., & Blaschke, T. (2005). Adherence to medication. *New England Journal of Medicine, 353*(5), 487–497. https://doi.org/10.1056/NEJMra050100

Vervloet, M., Linn, A. J., van Weert, J. C. M., de Bakker, D. H., Bouvy, M. L., & van Dijk, L. (2012). The effectiveness of interventions using electronic reminders to improve adherence to chronic medication: A systematic review of the literature. *Journal of the American Medical Informatics Association, 19*(5), 696–704. https://doi.org/10.1136/amiajnl-2011-000748

Vrijens, B., De Geest, S., Hughes, D. A., Przemyslaw, K., Demonceau, J., Ruppar, T., Dobbels, F., Fargher, E., Morrison, V., Lewek, P., Matyjaszczyk, M., Mshelia, C., Clyne, W., Aronson, J. K., & Urquhart, J. (2012). A new taxonomy for describing and defining adherence to medications. *British Journal of Clinical Pharmacology, 73*(5), 691–705. https://doi.org/10.1111/j.1365-2125.2012.04167.x

World Health Organization. (2003). *Adherence to long-term therapies: Evidence for action*. WHO Press.

---

*Manuscript prepared for submission to Journal of Medical Internet Research (JMIR) or equivalent peer-reviewed digital health journal. All authors confirm no competing interests related to the content of this manuscript. IRB application pending; prospective data collection has not commenced. MMAS-8 is a proprietary instrument used under license from Donald E. Morisky, ScD, ScM, MSPH.*
