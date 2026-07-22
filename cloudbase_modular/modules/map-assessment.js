'use strict';
// ══════════════════════════════════════════════════════════════════════════════
// MAP ASSESSMENT MODULE — ATLAS v8.7.0
// Multidimensional Adherence Parameters (MAP) Instrument
// Created by Philip Morisky — next-generation adherence science tool
//
// TRIADIC scoring model: Architecture x Execution x Context-Guard
// PE = (A * E * Cg)^(1/3) — geometric mean, weakest domain governs outcome
//
// Global scope pattern — no imports/exports.
// All functions are attached to window implicitly via global declarations.
// ══════════════════════════════════════════════════════════════════════════════

// ── MAP Design Tokens ─────────────────────────────────────────────────────────
// Matches ATLAS platform token set exactly.
// --ink:#080e1a  --surface:#0d1525  --card:#111d30  --border:rgba(255,255,255,0.07)
// --bright:#e8f0f8  --muted:#6b8099  --base:#4e9cf5  --pe:#d4a843
// Domain accent colors: amber=Architecture, cyan=Execution, purple=Context-Guard

var MAP_COLORS = {
  pe:           '#d4a843',
  architecture: '#f59e0b',
  execution:    '#22d3ee',
  context:      '#a78bfa',
  surface:      '#0d1525',
  card:         '#111d30',
  border:       'rgba(255,255,255,0.07)',
  bright:       '#e8f0f8',
  muted:        '#6b8099',
  base:         '#4e9cf5',
  ink:          '#080e1a',
};

// ── Item definitions — MAP instrument (not MMAS-8) ───────────────────────────
// Architecture (A)   = mean(Q2, Q3, Q6)   — intentional adherence decisions
// Execution (E)      = mean(Q1, Q5, Q8)   — routine, habit, memory
// Context-Guard (Cg) = 0.5 + 0.5 * mean(Q4, Q7), floored at 0.5 — barriers
// Q2 and Q3 use a 14-day rolling anchor for longitudinal independence.
var MAP_QUESTIONS = [
  {
    id: 'q1', domain: 'execution', label: 'E',
    text: 'Are there times when you forget to take your medications?',
    type: 'binary',
    coding: { Yes: 0, No: 1 },
  },
  {
    id: 'q2', domain: 'architecture', label: 'A',
    text: 'In the past two weeks, have there been times when you chose to skip a dose (for example, because of side effects, cost, or feeling better)?',
    type: 'binary',
    coding: { Yes: 0, No: 1 },
  },
  {
    id: 'q3', domain: 'architecture', label: 'A',
    text: 'In the past two weeks, did you reduce your dose or stop a medication on your own, without telling your doctor or care team, because of how it was making you feel?',
    type: 'binary',
    coding: { Yes: 0, No: 1 },
  },
  {
    id: 'q4', domain: 'context', label: 'C',
    text: 'When your daily routine changes (for example, when traveling, working different hours, or staying away from home), do you find it hard to keep up with your medications?',
    type: 'binary',
    coding: { Yes: 0, No: 1 },
  },
  {
    id: 'q5', domain: 'execution', label: 'E',
    text: 'Were you able to take your last dose as directed?',
    type: 'binary',
    coding: { Yes: 1, No: 0 },
  },
  {
    id: 'q6', domain: 'architecture', label: 'A',
    text: 'When you start feeling better or your symptoms improve, do you ever think about reducing or pausing your medication on your own?',
    type: 'binary',
    coding: { Yes: 0, No: 1 },
  },
  {
    id: 'q7', domain: 'context', label: 'C',
    text: 'Does keeping up with your medication routine feel like a big challenge in your everyday life?',
    type: 'binary',
    coding: { Yes: 0, No: 1 },
  },
  {
    id: 'q8', domain: 'execution', label: 'E',
    text: 'In a typical week, how often do you have trouble taking all your medications as prescribed?',
    type: 'ordinal',
    options: [
      { label: 'Never',        value: 1.00 },
      { label: 'Rarely',       value: 0.75 },
      { label: 'Sometimes',    value: 0.50 },
      { label: 'Often',        value: 0.25 },
      { label: 'All the time', value: 0.00 },
    ],
  },
];

// ── Domain lookup maps ─────────────────────────────────────────────────────────
var MAP_INTERVENTION_TARGETS = {
  architecture: 'Belief restructuring and shared decision-making',
  execution:    'Behavioral cue systems and routine anchoring',
  context_guard:'Environmental barrier reduction and social support activation',
};

// ── MAP i18n dictionary ───────────────────────────────────────────────────────
var MAP_I18N = {
  en: {
    formTitle: 'MAP Assessment',
    formSubtitle: 'Multidimensional Adherence Parameters',
    scoreLabel_pe: 'PE Score',
    scoreLabel_arch: 'Architecture',
    scoreLabel_exec: 'Execution',
    scoreLabel_ctx: 'Context-Guard',
    progressHint: 'Answer all 8 questions to compute live PE score',
    progressCount: function(a, t) { return a + ' / ' + t + ' answered'; },
    allAnswered: 'All questions answered. Review scores before submitting.',
    submitBtn: 'Submit Assessment',
    pleaseAnswerAll: 'Please answer all 8 questions before submitting.',
    resultsTitle: 'Assessment Results',
    metaAdditive: 'Additive',
    metaLowAdherence: 'Low Adherence',
    metaDominantFailure: 'Dominant Failure',
    interventionLabel: 'Intervention Protocol',
    assessmentRecorded: 'Assessment Recorded',
    confidence: { high: 'high confidence', moderate: 'moderate confidence', low: 'low confidence' },
    domainNames: { A: 'Architecture', E: 'Execution', C: 'Context-Guard' },
    modeLabels: { clinical: 'Clinical', pharmacy: 'Pharmacy', self: 'Self-Report', research: 'Research', chw: 'Community Health Worker' },
    questions: [
      { text: 'Are there times when you forget to take your medications?', binary: ['Yes', 'No'] },
      { text: 'In the past two weeks, have there been times when you chose to skip a dose (for example, because of side effects, cost, or feeling better)?', binary: ['Yes', 'No'] },
      { text: 'In the past two weeks, did you reduce your dose or stop a medication on your own, without telling your doctor or care team, because of how it was making you feel?', binary: ['Yes', 'No'] },
      { text: 'When your daily routine changes (for example, when traveling, working different hours, or staying away from home), do you find it hard to keep up with your medications?', binary: ['Yes', 'No'] },
      { text: 'Were you able to take your last dose as directed?', binary: ['Yes', 'No'] },
      { text: 'When you start feeling better or your symptoms improve, do you ever think about reducing or pausing your medication on your own?', binary: ['Yes', 'No'] },
      { text: 'Does keeping up with your medication routine feel like a big challenge in your everyday life?', binary: ['Yes', 'No'] },
      { text: 'In a typical week, how often do you have trouble taking all your medications as prescribed?', ordinal: ['Never', 'Rarely', 'Sometimes', 'Often', 'All the time'] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: 'Optimistic Stopper',   desc: 'The patient shows adequate behavioral adherence but holds beliefs that medication may no longer be necessary. Symptom resolution or perceived cure is likely driving intentional dose reduction or planned discontinuation.', intervention: 'Education on illness chronicity; shared goal-setting on long-term medication purpose; re-evaluation of treatment beliefs; structured follow-up to monitor intentional stopping behavior.' },
      'Intentional Resistor': { name: 'Intentional Resistor', desc: 'The patient holds beliefs that actively conflict with consistent adherence. Non-adherence is intentional and decision-driven, not circumstantial or forgetful. The Architecture domain is the primary failure.', intervention: 'Motivational interviewing to explore medication beliefs; collaborative re-framing of perceived necessity and concerns; side-effect discussion and alternative regimen negotiation where appropriate.' },
      'Routine Forgetter':    { name: 'Routine Forgetter',    desc: 'The patient has adequate beliefs about medication but consistently fails to execute the daily routine. Forgetfulness, inconsistent timing, and difficulty remembering are the primary barriers.', intervention: 'Behavioral cue strategies (alarms, pill organizers, habit stacking with existing routines); pharmacy-initiated blister packs; caregiver or digital reminder integration.' },
      'Situational Skipper':  { name: 'Situational Skipper',  desc: 'The patient encounters significant environmental, social, or logistical barriers that interrupt adherence. Medication access, cost, side-effect interference, or social context disrupts an otherwise motivated patient.', intervention: 'Barrier mapping and social support assessment; pharmacy access programs; cost-assistance navigation; regimen simplification to reduce situational demand; peer support linkage.' },
      'Side-Effect Avoider':  { name: 'Side-Effect Avoider',  desc: 'The patient experiences both environmental friction (Q4) and side-effect or social interference (Q7) alongside reduced medication beliefs. The non-adherence pattern is consistent with avoidance driven by medication experience.', intervention: 'Side-effect review and symptom management strategies; regimen modification discussion with prescriber; patient education on managing expected effects; barrier support programs.' },
      'Balanced Low':         { name: 'Balanced Low',         desc: 'The patient shows globally reduced adherence across all three MAP domains without a single dominant failure pattern. Comprehensive intervention addressing beliefs, routine, and context simultaneously is indicated.', intervention: 'Holistic adherence review; multi-component intervention addressing beliefs, behavioral routines, and environmental barriers in parallel; close monitoring and reassessment after initial intervention.' },
      'Adequate Adherent':    { name: 'Adequate Adherent',    desc_high: 'The patient demonstrates adequate adherence across Architecture, Execution, and Context-Guard domains. PE score indicates optimal adherence health.', desc_moderate: 'The patient demonstrates adequate adherence across Architecture, Execution, and Context-Guard domains. PE score indicates good adherence health.', intervention: 'Maintain current regimen and reinforce adherence behaviors at routine follow-up. Schedule reassessment at next clinical visit.' },
    },
  },
  pl: {
    formTitle: 'Ocena MAP',
    formSubtitle: 'Wielowymiarowe Parametry Adherencji',
    scoreLabel_pe: 'Wynik PE',
    scoreLabel_arch: 'Architektura',
    scoreLabel_exec: 'Wykonanie',
    scoreLabel_ctx: 'Strażnik Kontekstu',
    progressHint: 'Odpowiedz na wszystkie 8 pytań, aby obliczyć wynik PE na żywo',
    progressCount: function(a, t) { return a + ' / ' + t + ' odpowiedzi'; },
    allAnswered: 'Wszystkie pytania odpowiedziane. Przejrzyj wyniki przed przesłaniem.',
    submitBtn: 'Prześlij ocenę',
    pleaseAnswerAll: 'Proszę odpowiedzieć na wszystkie 8 pytań przed przesłaniem.',
    resultsTitle: 'Wyniki oceny',
    metaAdditive: 'Addytywny',
    metaLowAdherence: 'Niska adherencja',
    metaDominantFailure: 'Dominująca nieprawidłowość',
    interventionLabel: 'Protokół interwencji',
    assessmentRecorded: 'Ocena zarejestrowana',
    confidence: { high: 'wysoka pewność', moderate: 'umiarkowana pewność', low: 'niska pewność' },
    domainNames: { A: 'Architektura', E: 'Wykonanie', C: 'Strażnik Kontekstu' },
    modeLabels: { clinical: 'Kliniczny', pharmacy: 'Apteczny', self: 'Samoocena', research: 'Badawczy', chw: 'Pracownik zdrowia środowiskowego' },
    questions: [
      { text: 'Czy zdarza się Panu/Pani zapomnieć o przyjęciu leków?', binary: ['Tak', 'Nie'] },
      { text: 'Czy w ciągu ostatnich dwóch tygodni zdarzały się sytuacje, w których świadomie pominął(a) Pan/Pani dawkę (np. z powodu działań niepożądanych, kosztów lub poczucia poprawy)?', binary: ['Tak', 'Nie'] },
      { text: 'Czy w ciągu ostatnich dwóch tygodni zmniejszył(a) Pan/Pani dawkę lub odstawił(a) lek na własną rękę, nie informując lekarza ani zespołu opieki, z powodu złego samopoczucia po jego przyjęciu?', binary: ['Tak', 'Nie'] },
      { text: 'Kiedy zmienia się Pana/Pani codzienny rytm (np. w trakcie podróży, przy innych godzinach pracy lub przebywaniu poza domem), czy trudno jest Panu/Pani utrzymać regularność przyjmowania leków?', binary: ['Tak', 'Nie'] },
      { text: 'Czy udało się Panu/Pani przyjąć ostatnią dawkę zgodnie z zaleceniami?', binary: ['Tak', 'Nie'] },
      { text: 'Kiedy zaczyna Pan/Pani czuć się lepiej lub objawy ustępują, czy pojawia się myśl o samodzielnym zmniejszeniu lub przerwaniu leczenia?', binary: ['Tak', 'Nie'] },
      { text: 'Czy regularne przyjmowanie leków stanowi dla Pana/Pani duże wyzwanie w codziennym życiu?', binary: ['Tak', 'Nie'] },
      { text: 'Jak często w typowym tygodniu ma Pan/Pani trudności z przyjmowaniem wszystkich leków zgodnie z zaleceniami?', ordinal: ['Nigdy', 'Rzadko', 'Czasami', 'Często', 'Przez cały czas'] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: 'Optymistyczny Przerywający',       desc: 'Pacjent wykazuje odpowiednie zachowania adherencyjne, ale przekonany jest, że lek może nie być już konieczny. Prawdopodobnie ustąpienie objawów lub poczucie wyzdrowienia skłaniają do celowego zmniejszania dawki lub planowanego odstawienia.', intervention: 'Edukacja dotycząca przewlekłości choroby; wspólne ustalanie celów długoterminowego stosowania leku; ponowna ocena przekonań o leczeniu; ustrukturyzowane wizyty kontrolne w celu monitorowania zachowań przerywania.' },
      'Intentional Resistor': { name: 'Celowy Opierający się',            desc: 'Pacjent żywi przekonania aktywnie sprzeciwiające się konsekwentnej adherencji. Nieprzyleganie jest celowe i decyzyjne, a nie przypadkowe ani wynikające z zapomnienia. Domena Architektura jest główną przeszkodą.', intervention: 'Wywiad motywacyjny w celu zbadania przekonań dotyczących leków; wspólne przepracowanie postrzeganej konieczności i obaw; omówienie działań niepożądanych i ewentualna modyfikacja schematu leczenia.' },
      'Routine Forgetter':    { name: 'Zapominalski Rutynowy',            desc: 'Pacjent ma odpowiednie przekonania dotyczące leku, ale konsekwentnie nie wykonuje codziennej rutyny. Zapominalstwo, niespójna pora przyjmowania i trudności z pamiętaniem są głównymi barierami.', intervention: 'Strategie sygnałów behawioralnych (alarmy, organizery na leki, łączenie z istniejącymi nawykami); blistry z apteki; integracja przypomnień dla opiekuna lub wsparcie cyfrowe.' },
      'Situational Skipper':  { name: 'Sytuacyjny Pomijający',            desc: 'Pacjent napotyka na istotne bariery środowiskowe, społeczne lub logistyczne przerywające adherencję. Dostęp do leku, koszty, zakłócenia związane z działaniami niepożądanymi lub kontekst społeczny destabilizują adherencję u w sumie zmotywowanego pacjenta.', intervention: 'Mapowanie barier i ocena wsparcia społecznego; programy dostępu do leków w aptece; pomoc w nawigowaniu programów obniżenia kosztów; uproszczenie schematu leczenia; wsparcie rówieśnicze.' },
      'Side-Effect Avoider':  { name: 'Unikający Działań Niepożądanych', desc: 'Pacjent doświadcza zarówno tarcia środowiskowego (Q4), jak i zakłóceń wynikających z działań niepożądanych lub kontekstu społecznego (Q7), przy zmniejszonych przekonaniach o leku. Wzorzec nieprzylegania odpowiada unikaniu wynikającemu z doświadczeń związanych z lekiem.', intervention: 'Przegląd działań niepożądanych i strategie leczenia objawowego; omówienie modyfikacji schematu leczenia z lekarzem; edukacja pacjenta dotycząca radzenia sobie z przewidywanymi efektami; programy wsparcia w usuwaniu barier.' },
      'Balanced Low':         { name: 'Globalnie Niska Adherencja',       desc: 'Pacjent wykazuje globalnie obniżoną adherencję we wszystkich trzech domenach MAP bez jednego dominującego wzorca nieprawidłowości. Wskazana jest kompleksowa interwencja adresująca jednocześnie przekonania, rutynę i kontekst.', intervention: 'Kompleksowy przegląd adherencji; wielokomponentowa interwencja adresująca jednocześnie przekonania, rutyny behawioralne i bariery środowiskowe; bliskie monitorowanie i ponowna ocena po wstępnej interwencji.' },
      'Adequate Adherent':    { name: 'Wystarczająca Adherencja',         desc_high: 'Pacjent demonstruje odpowiednią adherencję we wszystkich domenach: Architektura, Wykonanie i Strażnik Kontekstu. Wynik PE wskazuje na optymalną kondycję adherencyjną.', desc_moderate: 'Pacjent demonstruje odpowiednią adherencję we wszystkich domenach: Architektura, Wykonanie i Strażnik Kontekstu. Wynik PE wskazuje na dobrą kondycję adherencyjną.', intervention: 'Utrzymać bieżący schemat leczenia i wzmacniać zachowania adherencyjne podczas rutynowych wizyt. Zaplanować ponowną ocenę podczas następnej wizyty klinicznej.' },
    },
  },
  de: {
    formTitle: 'MAP-Bewertung',
    formSubtitle: 'Multidimensionale Adherenzparameter',
    scoreLabel_pe: 'PE-Wert',
    scoreLabel_arch: 'Architektur',
    scoreLabel_exec: 'Ausführung',
    scoreLabel_ctx: 'Kontextwächter',
    progressHint: 'Beantworten Sie alle 8 Fragen, um den PE-Wert in Echtzeit zu berechnen',
    progressCount: function(a, t) { return a + ' / ' + t + ' beantwortet'; },
    allAnswered: 'Alle Fragen beantwortet. Überprüfen Sie die Werte vor dem Einreichen.',
    submitBtn: 'Bewertung einreichen',
    pleaseAnswerAll: 'Bitte beantworten Sie alle 8 Fragen vor dem Einreichen.',
    resultsTitle: 'Bewertungsergebnisse',
    metaAdditive: 'Additiv',
    metaLowAdherence: 'Geringe Adhärenz',
    metaDominantFailure: 'Dominantes Versagen',
    interventionLabel: 'Interventionsprotokoll',
    assessmentRecorded: 'Bewertung erfasst',
    confidence: { high: 'hohe Sicherheit', moderate: 'moderate Sicherheit', low: 'geringe Sicherheit' },
    domainNames: { A: 'Architektur', E: 'Ausführung', C: 'Kontextwächter' },
    modeLabels: { clinical: 'Klinisch', pharmacy: 'Apotheke', self: 'Selbstbeurteilung', research: 'Forschung', chw: 'Gemeindlicher Gesundheitsarbeiter' },
    questions: [
      { text: 'Gibt es Zeiten, in denen Sie vergessen, Ihre Medikamente einzunehmen?', binary: ['Ja', 'Nein'] },
      { text: 'Gab es in den letzten zwei Wochen Situationen, in denen Sie sich bewusst dazu entschieden haben, eine Dosis auszulassen (z.B. wegen Nebenwirkungen, Kosten oder weil Sie sich besser fühlten)?', binary: ['Ja', 'Nein'] },
      { text: 'Haben Sie in den letzten zwei Wochen Ihre Dosis auf eigene Faust reduziert oder ein Medikament abgesetzt, ohne Ihren Arzt oder das Pflegeteam zu informieren, weil Sie sich durch die Einnahme schlecht fühlten?', binary: ['Ja', 'Nein'] },
      { text: 'Wenn sich Ihr Tagesablauf ändert (z.B. auf Reisen, bei anderen Arbeitszeiten oder wenn Sie nicht zu Hause sind), finden Sie es dann schwer, Ihre Medikamente regelmäßig einzunehmen?', binary: ['Ja', 'Nein'] },
      { text: 'Konnten Sie Ihre letzte Dosis wie vorgeschrieben einnehmen?', binary: ['Ja', 'Nein'] },
      { text: 'Wenn Sie sich besser fühlen oder Ihre Symptome sich verbessern, denken Sie dann manchmal daran, Ihr Medikament auf eigene Faust zu reduzieren oder zu pausieren?', binary: ['Ja', 'Nein'] },
      { text: 'Fühlt sich die Einhaltung Ihrer Medikamenten-Routine in Ihrem Alltag wie eine große Herausforderung an?', binary: ['Ja', 'Nein'] },
      { text: 'Wie oft haben Sie in einer typischen Woche Schwierigkeiten, alle Ihre Medikamente wie vorgeschrieben einzunehmen?', ordinal: ['Nie', 'Selten', 'Manchmal', 'Oft', 'Die ganze Zeit'] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: 'Optimistischer Abbrecher',         desc: 'Der Patient zeigt angemessenes Adhärenzverhalten, glaubt jedoch, dass das Medikament möglicherweise nicht mehr notwendig ist. Symptomrückgang oder wahrgenommene Heilung treiben wahrscheinlich eine beabsichtigte Dosisreduzierung oder geplante Absetzung an.', intervention: 'Aufklärung über die Chronizität der Erkrankung; gemeinsame Zielsetzung zum langfristigen Zweck der Medikation; Neubewertung von Behandlungsüberzeugungen; strukturierte Nachsorge zur Überwachung des Abbruchverhaltens.' },
      'Intentional Resistor': { name: 'Absichtlicher Verweigerer',        desc: 'Der Patient hegt Überzeugungen, die einer konsequenten Adhärenz aktiv entgegenstehen. Die Nicht-Adhärenz ist beabsichtigt und entscheidungsgetrieben, nicht zufällig oder vergesslich. Die Architektur-Domäne ist das primäre Versagen.', intervention: 'Motivierende Gesprächsführung zur Erforschung von Medikamentenüberzeugungen; gemeinsame Neurahmung von wahrgenommener Notwendigkeit und Bedenken; Nebenwirkungsgespräch und ggf. Anpassung des Behandlungsschemas.' },
      'Routine Forgetter':    { name: 'Routinemäßiger Vergesslicher',     desc: 'Der Patient hat angemessene Überzeugungen über das Medikament, scheitert jedoch konsequent an der täglichen Ausführung. Vergesslichkeit, inkonsistente Einnahmezeiten und Schwierigkeiten beim Erinnern sind die primären Barrieren.', intervention: 'Verhaltensbasierte Hinweisstrategien (Alarme, Pillenorganizer, Gewohnheitsstapelung); Blisterverpackungen aus der Apotheke; Integration von Betreuer- oder digitalen Erinnerungen.' },
      'Situational Skipper':  { name: 'Situativer Auslasser',             desc: 'Der Patient begegnet erheblichen umweltbedingten, sozialen oder logistischen Barrieren, die die Adhärenz unterbrechen. Medikamentenzugang, Kosten, Nebenwirkungsinterferenzen oder sozialer Kontext stören einen ansonsten motivierten Patienten.', intervention: 'Barrierenanalyse und Bewertung sozialer Unterstützung; Apotheken-Zugangsprogramme; Kostenunterstützungsnavigation; Vereinfachung des Behandlungsschemas; Peer-Support-Vernetzung.' },
      'Side-Effect Avoider':  { name: 'Nebenwirkungsvermeidender',        desc: 'Der Patient erlebt sowohl Umweltreibung (Q4) als auch Nebenwirkungs- oder soziale Interferenz (Q7) zusammen mit reduzierten Medikamentenüberzeugungen. Das Nicht-Adhärenzmuster entspricht einer durch Medikamentenerfahrung getriebenen Vermeidung.', intervention: 'Nebenwirkungsüberprüfung und Symptommanagementstrategien; Besprechung von Schemaänderungen mit dem Verschreiber; Patientenaufklärung über den Umgang mit erwarteten Effekten; Barriereunterstützungsprogramme.' },
      'Balanced Low':         { name: 'Ausgewogen Niedrige Adhärenz',     desc: 'Der Patient zeigt global reduzierte Adhärenz in allen drei MAP-Domänen ohne ein einzelnes dominantes Versagensmuster. Eine umfassende Intervention, die gleichzeitig Überzeugungen, Routine und Kontext anspricht, ist indiziert.', intervention: 'Umfassende Adhärenzüberprüfung; Mehrkomponentenintervention, die Überzeugungen, Verhaltensroutinen und Umweltbarrieren parallel adressiert; engmaschige Überwachung und Neubewertung nach der Erstintervention.' },
      'Adequate Adherent':    { name: 'Ausreichende Adhärenz',            desc_high: 'Der Patient zeigt angemessene Adhärenz in den Domänen Architektur, Ausführung und Kontextwächter. Der PE-Wert weist auf optimale Adhärenzgesundheit hin.', desc_moderate: 'Der Patient zeigt angemessene Adhärenz in den Domänen Architektur, Ausführung und Kontextwächter. Der PE-Wert weist auf gute Adhärenzgesundheit hin.', intervention: 'Aktuelles Therapieschema beibehalten und Adhärenzverhalten bei Routinekontrollen stärken. Neubewertung beim nächsten klinischen Termin planen.' },
    },
  },
  fr: {
    formTitle: "Évaluation MAP",
    formSubtitle: "Paramètres d'Adhésion Multidimensionnels",
    scoreLabel_pe: "Score PE",
    scoreLabel_arch: "Architecture",
    scoreLabel_exec: "Exécution",
    scoreLabel_ctx: "Garde-Contexte",
    progressHint: "Répondez aux 8 questions pour calculer le score PE en direct",
    progressCount: function(a, t) { return a + ' / ' + t + ' répondues'; },
    allAnswered: "Toutes les questions répondues. Vérifiez les scores avant de soumettre.",
    submitBtn: "Soumettre l'évaluation",
    pleaseAnswerAll: "Veuillez répondre aux 8 questions avant de soumettre.",
    resultsTitle: "Résultats de l'évaluation",
    metaAdditive: "Additif",
    metaLowAdherence: "Faible adhésion",
    metaDominantFailure: "Défaillance dominante",
    interventionLabel: "Protocole d'intervention",
    assessmentRecorded: "Évaluation enregistrée",
    confidence: { high: "confiance élevée", moderate: "confiance modérée", low: "confiance faible" },
    domainNames: { A: "Architecture", E: "Exécution", C: "Garde-Contexte" },
    modeLabels: { clinical: "Clinique", pharmacy: "Pharmacie", self: "Auto-évaluation", research: "Recherche", chw: "Agent de santé communautaire" },
    questions: [
      { text: "Y a-t-il des moments où vous oubliez de prendre vos médicaments?", binary: ["Oui", "Non"] },
      { text: "Au cours des deux dernières semaines, avez-vous choisi de sauter une dose (effets secondaires, coût ou amélioration ressentie)?", binary: ["Oui", "Non"] },
      { text: "Au cours des deux dernières semaines, avez-vous réduit votre dose ou arrêté un médicament de vous-même, sans en informer votre médecin, en raison de son effet sur vous?", binary: ["Oui", "Non"] },
      { text: "Lorsque votre routine quotidienne change (voyages, horaires différents ou absence du domicile), avez-vous du mal à prendre vos médicaments régulièrement?", binary: ["Oui", "Non"] },
      { text: "Avez-vous pu prendre votre dernière dose comme prescrit?", binary: ["Oui", "Non"] },
      { text: "Lorsque vous vous sentez mieux ou que vos symptômes s'améliorent, pensez-vous à réduire ou interrompre votre médicament de vous-même?", binary: ["Oui", "Non"] },
      { text: "Respecter votre routine médicamenteuse vous semble-t-il un grand défi dans votre vie quotidienne?", binary: ["Oui", "Non"] },
      { text: "Au cours d'une semaine typique, combien de fois avez-vous du mal à prendre tous vos médicaments comme prescrit?", ordinal: ["Jamais", "Rarement", "Parfois", "Souvent", "Tout le temps"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Arrêteur Optimiste",              desc: "Le patient présente une adhésion comportementale adéquate mais croit que le médicament n'est plus nécessaire. La résolution des symptômes motive une réduction ou un arrêt intentionnel.", intervention: "Éducation sur la chronicité; objectifs partagés à long terme; réévaluation des croyances thérapeutiques; suivi structuré pour surveiller les arrêts intentionnels." },
      'Intentional Resistor': { name: "Résistant Intentionnel",          desc: "Le patient entretient des croyances contraires à une adhésion cohérente. La non-adhésion est intentionnelle et décisionnelle. Le domaine Architecture est la défaillance principale.", intervention: "Entretien motivationnel; recadrage collaboratif des croyances; discussion sur les effets indésirables et ajustement du schéma si approprié." },
      'Routine Forgetter':    { name: "Oublieux Routinier",              desc: "Le patient a des croyances adéquates mais échoue régulièrement à exécuter la routine. L'oubli et les horaires irréguliers sont les principales barrières.", intervention: "Rappels comportementaux (alarmes, piluliers, association aux routines existantes); préparations de la pharmacie; intégration de rappels numériques." },
      'Situational Skipper':  { name: "Sauteur Situationnel",            desc: "Des barrières environnementales ou logistiques interrompent l'adhésion d'un patient par ailleurs motivé. Accès, coût ou contexte social sont en cause.", intervention: "Cartographie des barrières; programmes d'accès aux médicaments; aide financière; simplification du schéma; soutien par les pairs." },
      'Side-Effect Avoider':  { name: "Éviteur d'Effets Indésirables",   desc: "Le patient présente des frictions environnementales et des interférences liées aux effets indésirables avec des croyances médicamenteuses réduites. Le schéma correspond à un évitement médicamenteux.", intervention: "Revue des effets indésirables; stratégies de gestion symptomatique; discussion de modification du schéma avec le prescripteur; programmes de soutien." },
      'Balanced Low':         { name: "Faible Équilibré",                desc: "Adhésion globalement réduite dans les trois domaines MAP sans défaillance dominante unique. Une intervention globale est indiquée.", intervention: "Revue globale de l'adhésion; intervention multi-composantes adressant croyances, routines et barrières en parallèle; surveillance rapprochée." },
      'Adequate Adherent':    { name: "Adhésion Adéquate",               desc_high: "Le patient démontre une adhésion adéquate dans les trois domaines. Le score PE indique une santé d'adhésion optimale.", desc_moderate: "Le patient démontre une adhésion adéquate dans les trois domaines. Le score PE indique une bonne santé d'adhésion.", intervention: "Maintenir le schéma actuel; renforcer les comportements lors des visites de routine. Planifier une réévaluation à la prochaine visite." },
    },
  },
  es: {
    formTitle: "Evaluación MAP",
    formSubtitle: "Parámetros de Adherencia Multidimensionales",
    scoreLabel_pe: "Puntuación PE",
    scoreLabel_arch: "Arquitectura",
    scoreLabel_exec: "Ejecución",
    scoreLabel_ctx: "Guardia de Contexto",
    progressHint: "Responda las 8 preguntas para calcular la puntuación PE en tiempo real",
    progressCount: function(a, t) { return a + ' / ' + t + ' respondidas'; },
    allAnswered: "Todas las preguntas respondidas. Revise las puntuaciones antes de enviar.",
    submitBtn: "Enviar evaluación",
    pleaseAnswerAll: "Por favor responda las 8 preguntas antes de enviar.",
    resultsTitle: "Resultados de la evaluación",
    metaAdditive: "Aditivo",
    metaLowAdherence: "Baja adherencia",
    metaDominantFailure: "Fallo dominante",
    interventionLabel: "Protocolo de intervención",
    assessmentRecorded: "Evaluación registrada",
    confidence: { high: "alta confianza", moderate: "confianza moderada", low: "baja confianza" },
    domainNames: { A: "Arquitectura", E: "Ejecución", C: "Guardia de Contexto" },
    modeLabels: { clinical: "Clínico", pharmacy: "Farmacia", self: "Autoinforme", research: "Investigación", chw: "Trabajador de Salud Comunitaria" },
    questions: [
      { text: "¿Hay momentos en que olvida tomar sus medicamentos?", binary: ["Sí", "No"] },
      { text: "En las últimas dos semanas, ¿hubo momentos en que eligió omitir una dosis (por efectos secundarios, costo o sentirse mejor)?", binary: ["Sí", "No"] },
      { text: "En las últimas dos semanas, ¿redujo su dosis o dejó un medicamento por su cuenta, sin informar a su médico, debido a cómo le hacía sentir?", binary: ["Sí", "No"] },
      { text: "Cuando su rutina diaria cambia (viajes, horarios diferentes o estar fuera de casa), ¿le resulta difícil mantener sus medicamentos?", binary: ["Sí", "No"] },
      { text: "¿Pudo tomar su última dosis según lo indicado?", binary: ["Sí", "No"] },
      { text: "Cuando empieza a sentirse mejor o sus síntomas mejoran, ¿piensa en reducir o pausar su medicamento por su cuenta?", binary: ["Sí", "No"] },
      { text: "¿Mantener su rutina de medicamentos le parece un gran desafío en su vida diaria?", binary: ["Sí", "No"] },
      { text: "En una semana típica, ¿con qué frecuencia tiene dificultades para tomar todos sus medicamentos según lo prescrito?", ordinal: ["Nunca", "Raramente", "A veces", "A menudo", "Siempre"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Suspensor Optimista",             desc: "El paciente muestra adherencia conductual adecuada pero cree que el medicamento ya no es necesario. La resolución de síntomas o la curación percibida impulsa la reducción o suspensión intencional.", intervention: "Educación sobre la cronicidad; establecimiento de metas a largo plazo; reevaluación de creencias sobre el tratamiento; seguimiento estructurado para monitorear la suspensión intencional." },
      'Intentional Resistor': { name: "Resistente Intencional",         desc: "El paciente tiene creencias que se oponen activamente a una adherencia constante. La no adherencia es intencional y basada en decisiones. El dominio Arquitectura es la falla principal.", intervention: "Entrevista motivacional; reformulación colaborativa de creencias; discusión sobre efectos secundarios y negociación de régimen alternativo si corresponde." },
      'Routine Forgetter':    { name: "Olvidadizo Rutinario",           desc: "El paciente tiene creencias adecuadas pero falla consistentemente en ejecutar la rutina diaria. El olvido y los horarios inconsistentes son las barreras principales.", intervention: "Estrategias de señales conductuales (alarmas, pastilleros, asociación con rutinas existentes); blisters de farmacia; integración de recordatorios digitales." },
      'Situational Skipper':  { name: "Saltador Situacional",           desc: "Barreras ambientales, sociales o logísticas interrumpen la adherencia de un paciente motivado. El acceso, el costo o el contexto social son los factores.", intervention: "Mapeo de barreras; programas de acceso a medicamentos; asistencia financiera; simplificación del régimen; vinculación con apoyo de pares." },
      'Side-Effect Avoider':  { name: "Evitador de Efectos Secundarios", desc: "El paciente experimenta fricción ambiental e interferencia por efectos secundarios con creencias reducidas sobre el medicamento. El patrón corresponde a evitación impulsada por la experiencia medicamentosa.", intervention: "Revisión de efectos secundarios; estrategias de manejo de síntomas; modificación del régimen con el prescriptor; educación al paciente; programas de apoyo a barreras." },
      'Balanced Low':         { name: "Bajo Equilibrado",               desc: "El paciente muestra adherencia globalmente reducida en los tres dominios MAP sin un patrón de falla dominante. Se indica una intervención integral.", intervention: "Revisión integral de adherencia; intervención multicomponente abordando creencias, rutinas y barreras en paralelo; monitoreo cercano y reevaluación." },
      'Adequate Adherent':    { name: "Adherencia Adecuada",            desc_high: "El paciente demuestra adherencia adecuada en los tres dominios. La puntuación PE indica una salud de adherencia óptima.", desc_moderate: "El paciente demuestra adherencia adecuada en los tres dominios. La puntuación PE indica buena salud de adherencia.", intervention: "Mantener el régimen actual; reforzar conductas de adherencia en visitas de rutina. Programar reevaluación en la próxima visita clínica." },
    },
  },
  it: {
    formTitle: "Valutazione MAP",
    formSubtitle: "Parametri di Aderenza Multidimensionali",
    scoreLabel_pe: "Punteggio PE",
    scoreLabel_arch: "Architettura",
    scoreLabel_exec: "Esecuzione",
    scoreLabel_ctx: "Guardia del Contesto",
    progressHint: "Rispondi a tutte le 8 domande per calcolare il punteggio PE in tempo reale",
    progressCount: function(a, t) { return a + ' / ' + t + ' risposte'; },
    allAnswered: "Tutte le domande con risposta. Rivedi i punteggi prima di inviare.",
    submitBtn: "Invia valutazione",
    pleaseAnswerAll: "Si prega di rispondere a tutte le 8 domande prima di inviare.",
    resultsTitle: "Risultati della valutazione",
    metaAdditive: "Additivo",
    metaLowAdherence: "Bassa aderenza",
    metaDominantFailure: "Fallimento dominante",
    interventionLabel: "Protocollo di intervento",
    assessmentRecorded: "Valutazione registrata",
    confidence: { high: "alta fiducia", moderate: "fiducia moderata", low: "bassa fiducia" },
    domainNames: { A: "Architettura", E: "Esecuzione", C: "Guardia del Contesto" },
    modeLabels: { clinical: "Clinico", pharmacy: "Farmacia", self: "Auto-valutazione", research: "Ricerca", chw: "Operatore Sanitario di Comunità" },
    questions: [
      { text: "Ci sono momenti in cui dimentica di prendere i suoi farmaci?", binary: ["Sì", "No"] },
      { text: "Nelle ultime due settimane, ha scelto di saltare una dose (per effetti collaterali, costo o perché si sentiva meglio)?", binary: ["Sì", "No"] },
      { text: "Nelle ultime due settimane, ha ridotto la dose o interrotto un farmaco di propria iniziativa, senza informare il medico, per come le faceva sentire?", binary: ["Sì", "No"] },
      { text: "Quando la sua routine quotidiana cambia (viaggi, orari diversi o assenze da casa), trova difficile mantenere la terapia?", binary: ["Sì", "No"] },
      { text: "È riuscito/a a prendere l'ultima dose come prescritto?", binary: ["Sì", "No"] },
      { text: "Quando si sente meglio o i sintomi migliorano, pensa mai di ridurre o sospendere il farmaco di propria iniziativa?", binary: ["Sì", "No"] },
      { text: "Seguire la routine della terapia le sembra una grande sfida nella vita quotidiana?", binary: ["Sì", "No"] },
      { text: "In una settimana tipica, con quale frequenza ha difficoltà ad assumere tutti i farmaci come prescritto?", ordinal: ["Mai", "Raramente", "A volte", "Spesso", "Sempre"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Sospensore Ottimista",            desc: "Il paziente mostra un'aderenza comportamentale adeguata ma ritiene che il farmaco non sia più necessario. La risoluzione dei sintomi o la guarigione percepita guida la riduzione o sospensione intenzionale.", intervention: "Educazione sulla cronicità; definizione condivisa degli obiettivi a lungo termine; rivalutazione delle credenze sul trattamento; follow-up strutturato per monitorare le sospensioni intenzionali." },
      'Intentional Resistor': { name: "Resistente Intenzionale",         desc: "Il paziente ha credenze che si oppongono attivamente a un'aderenza coerente. La non-aderenza è intenzionale e decisionale. Il dominio Architettura è la principale carenza.", intervention: "Colloquio motivazionale; riformulazione collaborativa delle credenze; discussione sugli effetti collaterali e negoziazione di un regime alternativo se appropriato." },
      'Routine Forgetter':    { name: "Smemorato Routinario",            desc: "Il paziente ha credenze adeguate ma fallisce costantemente nell'eseguire la routine quotidiana. Dimenticanza e orari inconsistenti sono le barriere principali.", intervention: "Strategie di segnali comportamentali (allarmi, portapillole, abbinamento a routine esistenti); blister dalla farmacia; integrazione di promemoria digitali." },
      'Situational Skipper':  { name: "Saltatore Situazionale",          desc: "Barriere ambientali, sociali o logistiche interrompono l'aderenza di un paziente altrimenti motivato. Accesso, costo o contesto sociale sono i fattori.", intervention: "Mappatura delle barriere; programmi di accesso ai farmaci; assistenza finanziaria; semplificazione del regime; supporto tra pari." },
      'Side-Effect Avoider':  { name: "Evitatore di Effetti Collaterali", desc: "Il paziente sperimenta attrito ambientale e interferenza da effetti collaterali con credenze ridotte sul farmaco. Lo schema corrisponde a un'evitamento guidato dall'esperienza farmacologica.", intervention: "Revisione degli effetti collaterali; strategie di gestione sintomatica; discussione di modifiche al regime col prescrittore; educazione del paziente; programmi di supporto." },
      'Balanced Low':         { name: "Bassa Aderenza Equilibrata",      desc: "Il paziente mostra un'aderenza globalmente ridotta nei tre domini MAP senza un singolo schema di fallimento dominante. È indicato un intervento globale.", intervention: "Revisione globale dell'aderenza; intervento multi-componente che affronta in parallelo credenze, routine e barriere ambientali; monitoraggio ravvicinato." },
      'Adequate Adherent':    { name: "Aderenza Adeguata",               desc_high: "Il paziente dimostra un'aderenza adeguata nei tre domini. Il punteggio PE indica una salute di aderenza ottimale.", desc_moderate: "Il paziente dimostra un'aderenza adeguata nei tre domini. Il punteggio PE indica una buona salute di aderenza.", intervention: "Mantenere il regime attuale; rafforzare i comportamenti di aderenza nelle visite di routine. Programmare la rivalutazione alla prossima visita clinica." },
    },
  },
  pt: {
    formTitle: "Avaliação MAP",
    formSubtitle: "Parâmetros de Adesão Multidimensionais",
    scoreLabel_pe: "Pontuação PE",
    scoreLabel_arch: "Arquitetura",
    scoreLabel_exec: "Execução",
    scoreLabel_ctx: "Guarda de Contexto",
    progressHint: "Responda às 8 perguntas para calcular a pontuação PE em tempo real",
    progressCount: function(a, t) { return a + ' / ' + t + ' respondidas'; },
    allAnswered: "Todas as perguntas respondidas. Revise as pontuações antes de enviar.",
    submitBtn: "Enviar avaliação",
    pleaseAnswerAll: "Por favor responda às 8 perguntas antes de enviar.",
    resultsTitle: "Resultados da avaliação",
    metaAdditive: "Aditivo",
    metaLowAdherence: "Baixa adesão",
    metaDominantFailure: "Falha dominante",
    interventionLabel: "Protocolo de intervenção",
    assessmentRecorded: "Avaliação registrada",
    confidence: { high: "alta confiança", moderate: "confiança moderada", low: "baixa confiança" },
    domainNames: { A: "Arquitetura", E: "Execução", C: "Guarda de Contexto" },
    modeLabels: { clinical: "Clínico", pharmacy: "Farmácia", self: "Auto-avaliação", research: "Pesquisa", chw: "Agente Comunitário de Saúde" },
    questions: [
      { text: "Há momentos em que você esquece de tomar seus medicamentos?", binary: ["Sim", "Não"] },
      { text: "Nas últimas duas semanas, houve momentos em que você escolheu pular uma dose (por efeitos colaterais, custo ou porque se sentiu melhor)?", binary: ["Sim", "Não"] },
      { text: "Nas últimas duas semanas, você reduziu a dose ou interrompeu um medicamento por conta própria, sem informar seu médico, por causa de como ele o fazia sentir?", binary: ["Sim", "Não"] },
      { text: "Quando sua rotina diária muda (viagens, horários diferentes ou ficar fora de casa), você acha difícil manter seus medicamentos?", binary: ["Sim", "Não"] },
      { text: "Você conseguiu tomar a última dose conforme prescrito?", binary: ["Sim", "Não"] },
      { text: "Quando começa a se sentir melhor ou seus sintomas melhoram, você pensa em reduzir ou pausar seu medicamento por conta própria?", binary: ["Sim", "Não"] },
      { text: "Manter a rotina de medicamentos parece um grande desafio na sua vida cotidiana?", binary: ["Sim", "Não"] },
      { text: "Em uma semana típica, com que frequência você tem dificuldade em tomar todos os medicamentos conforme prescrito?", ordinal: ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Suspensor Otimista",              desc: "O paciente mostra adesão comportamental adequada mas acredita que o medicamento não é mais necessário. A resolução dos sintomas ou cura percebida motiva a redução ou interrupção intencional.", intervention: "Educação sobre cronicidade; definição compartilhada de metas a longo prazo; reavaliação das crenças sobre o tratamento; acompanhamento estruturado para monitorar interrupções intencionais." },
      'Intentional Resistor': { name: "Resistente Intencional",         desc: "O paciente tem crenças que se opõem ativamente a uma adesão consistente. A não adesão é intencional e baseada em decisões. O domínio Arquitetura é a falha principal.", intervention: "Entrevista motivacional; reformulação colaborativa das crenças; discussão sobre efeitos colaterais e negociação de regime alternativo quando apropriado." },
      'Routine Forgetter':    { name: "Esquecido Rotineiro",            desc: "O paciente tem crenças adequadas mas falha consistentemente na execução da rotina diária. O esquecimento e horários inconsistentes são as principais barreiras.", intervention: "Estratégias de lembretes comportamentais (alarmes, porta-comprimidos, associação a rotinas existentes); blisters da farmácia; integração de lembretes digitais." },
      'Situational Skipper':  { name: "Saltador Situacional",           desc: "Barreiras ambientais, sociais ou logísticas interrompem a adesão de um paciente motivado. Acesso, custo ou contexto social são os fatores.", intervention: "Mapeamento de barreiras; programas de acesso a medicamentos; assistência financeira; simplificação do regime; suporte de pares." },
      'Side-Effect Avoider':  { name: "Evitador de Efeitos Colaterais", desc: "O paciente experimenta atrito ambiental e interferência por efeitos colaterais com crenças reduzidas sobre o medicamento. O padrão corresponde a evitação impulsada pela experiência medicamentosa.", intervention: "Revisão de efeitos colaterais; estratégias de manejo sintomático; discussão de modificação do regime com o prescritor; educação do paciente; programas de suporte." },
      'Balanced Low':         { name: "Baixo Equilibrado",              desc: "O paciente mostra adesão globalmente reduzida nos três domínios MAP sem padrão de falha dominante único. Uma intervenção abrangente é indicada.", intervention: "Revisão abrangente da adesão; intervenção multi-componente abordando crenças, rotinas e barreiras em paralelo; monitoramento próximo e reavaliação." },
      'Adequate Adherent':    { name: "Adesão Adequada",                desc_high: "O paciente demonstra adesão adequada nos três domínios. A pontuação PE indica saúde de adesão ótima.", desc_moderate: "O paciente demonstra adesão adequada nos três domínios. A pontuação PE indica boa saúde de adesão.", intervention: "Manter o regime atual; reforçar comportamentos de adesão nas visitas de rotina. Agendar reavaliação na próxima visita clínica." },
    },
  },

  el: {
    formTitle: "Αξιολόγηση MAP",
    formSubtitle: "Πολυδιάστατες Παράμετροι Συμμόρφωσης",
    scoreLabel_pe: "Βαθμολογία PE",
    scoreLabel_arch: "Αρχιτεκτονική",
    scoreLabel_exec: "Εκτέλεση",
    scoreLabel_ctx: "Φύλακας Πλαισίου",
    progressHint: "Απαντήστε και τις 8 ερωτήσεις για να υπολογιστεί η βαθμολογία PE σε πραγματικό χρόνο",
    progressCount: function(a, t) { return a + ' / ' + t + ' απαντήθηκαν'; },
    allAnswered: "Όλες οι ερωτήσεις απαντήθηκαν. Ελέγξτε τις βαθμολογίες πριν υποβάλετε.",
    submitBtn: "Υποβολή αξιολόγησης",
    pleaseAnswerAll: "Παρακαλώ απαντήστε και τις 8 ερωτήσεις πριν υποβάλετε.",
    resultsTitle: "Αποτελέσματα αξιολόγησης",
    metaAdditive: "Αθροιστικό",
    metaLowAdherence: "Χαμηλή συμμόρφωση",
    metaDominantFailure: "Κυρίαρχη αποτυχία",
    interventionLabel: "Πρωτόκολλο παρέμβασης",
    assessmentRecorded: "Η αξιολόγηση καταγράφηκε",
    confidence: { high: "υψηλή εμπιστοσύνη", moderate: "μέτρια εμπιστοσύνη", low: "χαμηλή εμπιστοσύνη" },
    domainNames: { A: "Αρχιτεκτονική", E: "Εκτέλεση", C: "Φύλακας Πλαισίου" },
    modeLabels: { clinical: "Κλινικό", pharmacy: "Φαρμακείο", self: "Αυτο-αναφορά", research: "Έρευνα", chw: "Κοινοτικός Εργαζόμενος Υγείας" },
    questions: [
      { text: "Υπάρχουν στιγμές που ξεχνάτε να πάρετε τα φάρμακά σας;", binary: ["Ναι", "Όχι"] },
      { text: "Τις τελευταίες δύο εβδομάδες, επιλέξατε να παραλείψετε μια δόση (λόγω παρενεργειών, κόστους ή επειδή αισθανόσαστε καλύτερα);", binary: ["Ναι", "Όχι"] },
      { text: "Τις τελευταίες δύο εβδομάδες, μειώσατε τη δόση ή σταματήσατε ένα φάρμακο μόνοι σας, χωρίς να ενημερώσετε τον γιατρό σας, λόγω του τρόπου που σας έκανε να αισθάνεστε;", binary: ["Ναι", "Όχι"] },
      { text: "Όταν αλλάζει η καθημερινή σας ρουτίνα (ταξίδια, διαφορετικά ωράρια ή απουσία από το σπίτι), δυσκολεύεστε να τηρήσετε τη φαρμακευτική αγωγή;", binary: ["Ναι", "Όχι"] },
      { text: "Καταφέρατε να πάρετε την τελευταία δόση σας όπως συνταγογραφήθηκε;", binary: ["Ναι", "Όχι"] },
      { text: "Όταν αρχίζετε να αισθάνεστε καλύτερα ή τα συμπτώματά σας βελτιώνονται, σκέφτεστε να μειώσετε ή να σταματήσετε το φάρμακο μόνοι σας;", binary: ["Ναι", "Όχι"] },
      { text: "Η τήρηση της φαρμακευτικής σας αγωγής σάς φαίνεται μεγάλη πρόκληση στην καθημερινή ζωή;", binary: ["Ναι", "Όχι"] },
      { text: "Σε μια τυπική εβδομάδα, πόσο συχνά δυσκολεύεστε να πάρετε όλα τα φάρμακά σας όπως συνταγογραφήθηκαν;", ordinal: ["Ποτέ", "Σπάνια", "Μερικές φορές", "Συχνά", "Πάντα"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Αισιόδοξος Διακόπτης",       desc: "Ο ασθενής παρουσιάζει επαρκή συμπεριφορική συμμόρφωση αλλά πιστεύει ότι το φάρμακο δεν είναι πλέον απαραίτητο. Η υποχώρηση συμπτωμάτων οδηγεί σε εκούσια μείωση ή διακοπή.", intervention: "Εκπαίδευση για τη χρονιότητα της νόσου; κοινά μακροπρόθεσμα στόχοι; επανεκτίμηση πεποιθήσεων θεραπείας; δομημένη παρακολούθηση." },
      'Intentional Resistor': { name: "Εκούσιος Αντιστεκόμενος",    desc: "Ο ασθενής έχει πεποιθήσεις που αντιτίθενται ενεργά στη συμμόρφωση. Η μη-συμμόρφωση είναι εκούσια και αποφασιστική. Ο τομέας Αρχιτεκτονική είναι η κύρια αποτυχία.", intervention: "Κινητοποιητική συνέντευξη; συλλογική επανεκτίμηση πεποιθήσεων; συζήτηση παρενεργειών και εναλλακτικού σχήματος." },
      'Routine Forgetter':    { name: "Συνηθισμένος Λησμονητής",     desc: "Ο ασθενής έχει επαρκείς πεποιθήσεις αλλά αποτυγχάνει συνεχώς στην εκτέλεση της καθημερινής ρουτίνας. Λήθη και ασυνεπή ωράρια είναι τα κύρια εμπόδια.", intervention: "Στρατηγικές υπενθύμισης (συναγερμοί, θήκες χαπιών, σύνδεση με υπάρχουσες ρουτίνες); φαρμακευτικές συσκευασίες· ψηφιακές υπενθυμίσεις." },
      'Situational Skipper':  { name: "Καταστασιακός Παραλείπτης",   desc: "Περιβαλλοντικά, κοινωνικά ή λογιστικά εμπόδια διακόπτουν τη συμμόρφωση ενός κατά τα άλλα κινητοποιημένου ασθενή.", intervention: "Χαρτογράφηση εμποδίων; προγράμματα πρόσβασης σε φάρμακα; οικονομική βοήθεια; απλούστευση σχήματος; υποστήριξη ομοτίμων." },
      'Side-Effect Avoider':  { name: "Αποφεύγων Παρενέργειες",      desc: "Ο ασθενής παρουσιάζει περιβαλλοντική τριβή και παρεμβολή παρενεργειών με μειωμένες πεποιθήσεις για το φάρμακο. Το μοτίβο αντιστοιχεί σε αποφυγή λόγω φαρμακευτικής εμπειρίας.", intervention: "Ανασκόπηση παρενεργειών; στρατηγικές διαχείρισης συμπτωμάτων; τροποποίηση σχήματος με τον συνταγογράφο; εκπαίδευση ασθενή." },
      'Balanced Low':         { name: "Ισορροπημένα Χαμηλή",         desc: "Ο ασθενής παρουσιάζει γενικά μειωμένη συμμόρφωση και στους τρεις τομείς MAP χωρίς ένα κυρίαρχο μοτίβο αποτυχίας. Υποδεικνύεται ολοκληρωμένη παρέμβαση.", intervention: "Ολοκληρωμένη ανασκόπηση συμμόρφωσης; πολυσυνιστωσιακή παρέμβαση που αντιμετωπίζει παράλληλα πεποιθήσεις, ρουτίνες και εμπόδια; στενή παρακολούθηση." },
      'Adequate Adherent':    { name: "Επαρκής Συμμόρφωση",          desc_high: "Ο ασθενής παρουσιάζει επαρκή συμμόρφωση και στους τρεις τομείς. Η βαθμολογία PE υποδηλώνει βέλτιστη υγεία συμμόρφωσης.", desc_moderate: "Ο ασθενής παρουσιάζει επαρκή συμμόρφωση και στους τρεις τομείς. Η βαθμολογία PE υποδηλώνει καλή υγεία συμμόρφωσης.", intervention: "Διατήρηση τρέχοντος σχήματος· ενίσχυση συμπεριφορών συμμόρφωσης στις τακτικές επισκέψεις. Προγραμματισμός επανεκτίμησης στην επόμενη κλινική επίσκεψη." },
    },
  },
  nl: {
    formTitle: "MAP-Beoordeling",
    formSubtitle: "Multidimensionale Therapietrouwparameters",
    scoreLabel_pe: "PE-Score",
    scoreLabel_arch: "Architectuur",
    scoreLabel_exec: "Uitvoering",
    scoreLabel_ctx: "Contextbewaker",
    progressHint: "Beantwoord alle 8 vragen om de PE-score live te berekenen",
    progressCount: function(a, t) { return a + ' / ' + t + ' beantwoord'; },
    allAnswered: "Alle vragen beantwoord. Controleer de scores voor het indienen.",
    submitBtn: "Beoordeling indienen",
    pleaseAnswerAll: "Beantwoord alstublieft alle 8 vragen voor het indienen.",
    resultsTitle: "Beoordelingsresultaten",
    metaAdditive: "Additief",
    metaLowAdherence: "Lage therapietrouw",
    metaDominantFailure: "Dominante tekortkoming",
    interventionLabel: "Interventieprotocol",
    assessmentRecorded: "Beoordeling geregistreerd",
    confidence: { high: "hoge betrouwbaarheid", moderate: "matige betrouwbaarheid", low: "lage betrouwbaarheid" },
    domainNames: { A: "Architectuur", E: "Uitvoering", C: "Contextbewaker" },
    modeLabels: { clinical: "Klinisch", pharmacy: "Apotheek", self: "Zelfrapportage", research: "Onderzoek", chw: "Gemeenschappelijke Gezondheidswerker" },
    questions: [
      { text: "Zijn er momenten waarop u vergeet uw medicijnen in te nemen?", binary: ["Ja", "Nee"] },
      { text: "Heeft u de afgelopen twee weken een dosis overgeslagen (vanwege bijwerkingen, kosten of omdat u zich beter voelde)?", binary: ["Ja", "Nee"] },
      { text: "Heeft u de afgelopen twee weken uw dosis eigenmachtig verlaagd of een medicijn gestopt zonder uw arts te informeren, vanwege hoe het u liet voelen?", binary: ["Ja", "Nee"] },
      { text: "Wanneer uw dagelijkse routine verandert (reizen, andere werktijden of niet thuis zijn), vindt u het dan moeilijk uw medicatie bij te houden?", binary: ["Ja", "Nee"] },
      { text: "Kon u uw laatste dosis innemen zoals voorgeschreven?", binary: ["Ja", "Nee"] },
      { text: "Wanneer u zich beter begint te voelen of uw symptomen verbeteren, denkt u er dan ooit aan uw medicijn eigenmachtig te verminderen of te pauzeren?", binary: ["Ja", "Nee"] },
      { text: "Voelt het bijhouden van uw medicatieroutine als een grote uitdaging in uw dagelijks leven?", binary: ["Ja", "Nee"] },
      { text: "In een typische week, hoe vaak heeft u moeite om al uw medicijnen zoals voorgeschreven in te nemen?", ordinal: ["Nooit", "Zelden", "Soms", "Vaak", "Altijd"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Optimistische Stopper",        desc: "De patiënt vertoont adequaat gedragsmatige therapietrouw maar gelooft dat het medicijn niet meer nodig is. Symptoomvermindering of vermeende genezing drijft opzettelijke dosisvermindering of geplande stopzetting aan.", intervention: "Voorlichting over chroniciteit; gezamenlijke doelstelling voor langetermijnmedicatiedoel; herziening van behandelingsovertuigingen; gestructureerde follow-up." },
      'Intentional Resistor': { name: "Opzettelijke Weigeraar",       desc: "De patiënt heeft overtuigingen die actief ingaan tegen consistente therapietrouw. Niet-therapietrouw is opzettelijk en beslissingsgedreven. Het Architectuurdomein is de primaire tekortkoming.", intervention: "Motiverende gespreksvoering; gezamenlijke herformulering van overtuigingen; bespreking van bijwerkingen en alternatief regime indien van toepassing." },
      'Routine Forgetter':    { name: "Vergeetachtige Routinier",      desc: "De patiënt heeft adequate overtuigingen maar faalt consequent in de dagelijkse uitvoering. Vergeetachtigheid en inconsistente tijdstippen zijn de primaire barrières.", intervention: "Gedragsmatige herinneringsstrategieën (alarmen, pillendozen, koppeling aan bestaande routines); apotheekblisters; digitale herinneringsintegratie." },
      'Situational Skipper':  { name: "Situationele Overslager",       desc: "Omgevings- of logistieke barrières onderbreken de therapietrouw van een anderszins gemotiveerde patiënt. Toegang, kosten of sociale context zijn de factoren.", intervention: "Barrièrekartering; toegangsprogramma's voor medicijnen; financiële ondersteuning; vereenvoudiging van het regime; peer-support." },
      'Side-Effect Avoider':  { name: "Bijwerkingsvermijder",          desc: "De patiënt ervaart omgevingswrijving en bijwerkingsinterferentie met verminderde medicijnovertuigingen. Het patroon komt overeen met vermijding door medicijnervaring.", intervention: "Bijwerkingsbeoordeling; symptoombeheersstrategieën; regimewijziging met de voorschrijver; patiënteneducatie; ondersteuningsprogramma's." },
      'Balanced Low':         { name: "Evenwichtig Laag",              desc: "De patiënt toont globaal verminderde therapietrouw in alle drie MAP-domeinen zonder dominant faalpatroon. Een uitgebreide interventie is geïndiceerd.", intervention: "Uitgebreide therapietrouwbeoordeling; meervoudige interventie gericht op overtuigingen, routines en barrières parallel; nauwe monitoring en herbeoordeling." },
      'Adequate Adherent':    { name: "Adequate Therapietrouw",        desc_high: "De patiënt vertoont adequate therapietrouw in de drie domeinen. De PE-score wijst op optimale therapietrouwgezondheid.", desc_moderate: "De patiënt vertoont adequate therapietrouw in de drie domeinen. De PE-score wijst op goede therapietrouwgezondheid.", intervention: "Huidig regime handhaven; therapietrouwgedrag versterken bij routinebezoeken. Herbeoordeling plannen bij volgende klinische afspraak." },
    },
  },
  da: {
    formTitle: "MAP-Vurdering",
    formSubtitle: "Multidimensionale Efterlevelsesparametre",
    scoreLabel_pe: "PE-Score",
    scoreLabel_arch: "Arkitektur",
    scoreLabel_exec: "Udførelse",
    scoreLabel_ctx: "Kontekstvogter",
    progressHint: "Besvar alle 8 spørgsmål for at beregne PE-scoren live",
    progressCount: function(a, t) { return a + ' / ' + t + ' besvaret'; },
    allAnswered: "Alle spørgsmål besvaret. Gennemgå scorerne før indsendelse.",
    submitBtn: "Indsend vurdering",
    pleaseAnswerAll: "Besvar venligst alle 8 spørgsmål inden indsendelse.",
    resultsTitle: "Vurderingsresultater",
    metaAdditive: "Additiv",
    metaLowAdherence: "Lav efterlevelse",
    metaDominantFailure: "Dominerende fejl",
    interventionLabel: "Interventionsprotokol",
    assessmentRecorded: "Vurdering registreret",
    confidence: { high: "høj sikkerhed", moderate: "moderat sikkerhed", low: "lav sikkerhed" },
    domainNames: { A: "Arkitektur", E: "Udførelse", C: "Kontekstvogter" },
    modeLabels: { clinical: "Klinisk", pharmacy: "Apotek", self: "Selvrapport", research: "Forskning", chw: "Samfundssundhedsarbejder" },
    questions: [
      { text: "Er der tidspunkter, hvor du glemmer at tage dine mediciner?", binary: ["Ja", "Nej"] },
      { text: "Har du inden for de seneste to uger valgt at springe en dosis over (f.eks. pga. bivirkninger, omkostninger eller fordi du følte dig bedre)?", binary: ["Ja", "Nej"] },
      { text: "Har du inden for de seneste to uger reduceret din dosis eller stoppet en medicin på egen hånd, uden at informere din læge, på grund af dens virkning på dig?", binary: ["Ja", "Nej"] },
      { text: "Når din daglige rutine ændres (f.eks. rejser, andre arbejdstider eller fravær hjemmefra), finder du det svært at holde styr på dine mediciner?", binary: ["Ja", "Nej"] },
      { text: "Var du i stand til at tage din seneste dosis som foreskrevet?", binary: ["Ja", "Nej"] },
      { text: "Når du begynder at have det bedre eller dine symptomer forbedres, overvejer du nogensinde at reducere eller sætte din medicin på pause på egen hånd?", binary: ["Ja", "Nej"] },
      { text: "Føles det at holde styr på din medicinrutine som en stor udfordring i din hverdag?", binary: ["Ja", "Nej"] },
      { text: "Hvor ofte i en typisk uge har du svært ved at tage alle dine mediciner som foreskrevet?", ordinal: ["Aldrig", "Sjældent", "Sommetider", "Ofte", "Altid"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Optimistisk Stopper",           desc: "Patienten viser tilstrækkelig adfærdsmæssig efterlevelse men tror, at medicinen muligvis ikke længere er nødvendig. Symptomafhjælpning eller oplevet helbredelse driver tilsigtet dosisreduktion.", intervention: "Undervisning om sygdommens kroniske natur; fælles mål for langsigtet medicinbehov; revurdering af behandlingsopfattelser; struktureret opfølgning." },
      'Intentional Resistor': { name: "Bevidst Modstander",            desc: "Patienten har overbevisninger, der aktivt modvirker konsekvent efterlevelse. Manglende efterlevelse er bevidst og beslutningsbaseret. Arkitekturdomænet er den primære fejl.", intervention: "Motiverende samtale; samarbejde om at omformulere overbevisninger; diskussion om bivirkninger og alternativt regime om relevant." },
      'Routine Forgetter':    { name: "Rutineglemmer",                 desc: "Patienten har tilstrækkelige overbevisninger men mislykkes konsekvent i den daglige udførelse. Glemsomhed og inkonsistente tidspunkter er de primære barrierer.", intervention: "Adfærdsmæssige påmindelsesstrategier (alarmer, pilleæsker, sammenkædning med eksisterende rutiner); apotekets blisterpakker; digitale påmindelser." },
      'Situational Skipper':  { name: "Situationel Springer",          desc: "Miljømæssige eller logistiske barrierer afbryder efterlevelsen hos en ellers motiveret patient. Adgang, omkostninger eller social kontekst er faktorer.", intervention: "Barrierekortlægning; adgangsprogrammer til medicin; finansiel støtte; forenkling af regime; peer-støtte." },
      'Side-Effect Avoider':  { name: "Bivirkningsundgåer",            desc: "Patienten oplever miljømæssig friktion og bivirkning/social interferens med reducerede medicinoverbevisninger. Mønstret svarer til undvigelse drevet af medicinoplevelse.", intervention: "Gennemgang af bivirkninger; symptomhåndteringsstrategier; regimemodifikation med ordinerende læge; patientundervisning; støtteprogrammer." },
      'Balanced Low':         { name: "Afbalanceret Lav",              desc: "Patienten viser globalt reduceret efterlevelse i alle tre MAP-domæner uden ét dominerende fejlmønster. En omfattende intervention er indiceret.", intervention: "Samlet efterlevelsesgennemgang; flerkomponentintervention der adresserer overbevisninger, rutiner og barrierer parallelt; tæt overvågning og genvurdering." },
      'Adequate Adherent':    { name: "Tilstrækkelig Efterlevelse",    desc_high: "Patienten demonstrerer tilstrækkelig efterlevelse i de tre domæner. PE-scoren indikerer optimal efterlevelsesstatus.", desc_moderate: "Patienten demonstrerer tilstrækkelig efterlevelse i de tre domæner. PE-scoren indikerer god efterlevelsesstatus.", intervention: "Oprethold nuværende regime; styrk efterlevelseadfærd ved rutinebesøg. Planlæg genvurdering ved næste kliniske besøg." },
    },
  },
  sv: {
    formTitle: "MAP-Bedömning",
    formSubtitle: "Multidimensionella Efterlevnadsparametrar",
    scoreLabel_pe: "PE-Poäng",
    scoreLabel_arch: "Arkitektur",
    scoreLabel_exec: "Utförande",
    scoreLabel_ctx: "Kontextvakt",
    progressHint: "Svara på alla 8 frågor för att beräkna PE-poängen live",
    progressCount: function(a, t) { return a + ' / ' + t + ' besvarade'; },
    allAnswered: "Alla frågor besvarade. Granska poängen innan du skickar in.",
    submitBtn: "Skicka in bedömning",
    pleaseAnswerAll: "Vänligen svara på alla 8 frågor innan du skickar in.",
    resultsTitle: "Bedömningsresultat",
    metaAdditive: "Additiv",
    metaLowAdherence: "Låg efterlevnad",
    metaDominantFailure: "Dominerande svikt",
    interventionLabel: "Interventionsprotokoll",
    assessmentRecorded: "Bedömning registrerad",
    confidence: { high: "hög säkerhet", moderate: "måttlig säkerhet", low: "låg säkerhet" },
    domainNames: { A: "Arkitektur", E: "Utförande", C: "Kontextvakt" },
    modeLabels: { clinical: "Klinisk", pharmacy: "Apotek", self: "Självrapport", research: "Forskning", chw: "Samhällshälsoarbetare" },
    questions: [
      { text: "Finns det tillfällen då du glömmer att ta dina mediciner?", binary: ["Ja", "Nej"] },
      { text: "Under de senaste två veckorna, har det hänt att du valt att hoppa över en dos (exempelvis på grund av biverkningar, kostnad eller för att du mådde bättre)?", binary: ["Ja", "Nej"] },
      { text: "Under de senaste två veckorna, har du på eget initiativ minskat din dos eller slutat med ett läkemedel utan att informera din läkare, på grund av hur det fick dig att må?", binary: ["Ja", "Nej"] },
      { text: "När din dagliga rutin ändras (t.ex. resor, andra arbetstider eller att vara hemifrån), tycker du att det är svårt att hålla reda på dina mediciner?", binary: ["Ja", "Nej"] },
      { text: "Kunde du ta din senaste dos som ordinerat?", binary: ["Ja", "Nej"] },
      { text: "När du börjar må bättre eller dina symtom förbättras, funderar du någon gång på att minska eller pausa ditt läkemedel på eget initiativ?", binary: ["Ja", "Nej"] },
      { text: "Känns det att hålla din medicinrutin som en stor utmaning i din vardag?", binary: ["Ja", "Nej"] },
      { text: "Hur ofta under en typisk vecka har du svårt att ta alla dina mediciner som ordinerat?", ordinal: ["Aldrig", "Sällan", "Ibland", "Ofta", "Hela tiden"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Optimistisk Avslutare",         desc: "Patienten uppvisar adekvat beteendemässig efterlevnad men tror att läkemedlet kanske inte längre behövs. Symtomlindring eller upplevd tillfrisknande driver avsiktlig dosreduktion.", intervention: "Utbildning om sjukdomens kroniska karaktär; gemensamma långsiktiga mål; omvärdering av behandlingsövertygelser; strukturerad uppföljning." },
      'Intentional Resistor': { name: "Avsiktlig Motståndare",         desc: "Patienten har övertygelser som aktivt motverkar konsekvent efterlevnad. Bristande efterlevnad är avsiktlig och beslutsstyrd. Arkitekturdomänet är den primära bristen.", intervention: "Motiverande samtal; samarbetsinriktad omformulering av övertygelser; diskussion om biverkningar och alternativt schema vid behov." },
      'Routine Forgetter':    { name: "Rutinglömska",                   desc: "Patienten har adekvata övertygelser men misslyckas konsekvent med att utföra den dagliga rutinen. Glömska och oregelbundna tider är de viktigaste hindren.", intervention: "Beteendebaserade påminnelsestrategier (larm, dosetter, koppling till befintliga rutiner); apotekets blisterförpackningar; digitala påminnelser." },
      'Situational Skipper':  { name: "Situationell Hoppare",           desc: "Miljömässiga eller logistiska hinder avbryter efterlevnaden hos en annars motiverad patient. Tillgång, kostnad eller socialt sammanhang är faktorer.", intervention: "Kartläggning av hinder; tillgångsprogram för läkemedel; ekonomiskt stöd; förenkling av schema; kamratstöd." },
      'Side-Effect Avoider':  { name: "Biverkningsundvikare",           desc: "Patienten upplever miljömässig friktion och biverkningsinterferens med minskade läkemedelsövertygelser. Mönstret motsvarar undvikande drivet av läkemedelsupplevelse.", intervention: "Genomgång av biverkningar; symtomhanteringsstrategier; schemamodifiering med förskrivaren; patientutbildning; stödprogram." },
      'Balanced Low':         { name: "Balanserat Låg",                 desc: "Patienten uppvisar globalt minskad efterlevnad i alla tre MAP-domäner utan ett enda dominerande felmönster. En heltäckande intervention är indicerad.", intervention: "Övergripande efterlevnadsgranskning; multikomponentintervention som parallellt adresserar övertygelser, rutiner och hinder; nära uppföljning." },
      'Adequate Adherent':    { name: "Adekvat Efterlevnad",            desc_high: "Patienten uppvisar adekvat efterlevnad i de tre domänerna. PE-poängen indikerar optimal efterlevnadshälsa.", desc_moderate: "Patienten uppvisar adekvat efterlevnad i de tre domänerna. PE-poängen indikerar god efterlevnadshälsa.", intervention: "Behåll nuvarande schema; förstärk efterlevnadsbeteenden vid rutinbesök. Planera omvärdering vid nästa kliniska besök." },
    },
  },
  fi: {
    formTitle: "MAP-Arviointi",
    formSubtitle: "Moniulotteiset Hoitoon Sitoutumisen Parametrit",
    scoreLabel_pe: "PE-Pisteet",
    scoreLabel_arch: "Arkkitehtuuri",
    scoreLabel_exec: "Toteutus",
    scoreLabel_ctx: "Kontekstivartija",
    progressHint: "Vastaa kaikkiin 8 kysymykseen laskeaksesi PE-pistemäärän reaaliajassa",
    progressCount: function(a, t) { return a + ' / ' + t + ' vastattu'; },
    allAnswered: "Kaikki kysymykset vastattu. Tarkista pisteet ennen lähettämistä.",
    submitBtn: "Lähetä arviointi",
    pleaseAnswerAll: "Vastaa kaikkiin 8 kysymykseen ennen lähettämistä.",
    resultsTitle: "Arviointitulokset",
    metaAdditive: "Additiivinen",
    metaLowAdherence: "Heikko hoitoon sitoutuminen",
    metaDominantFailure: "Hallitseva epäonnistuminen",
    interventionLabel: "Interventioprotokolle",
    assessmentRecorded: "Arviointi tallennettu",
    confidence: { high: "korkea luottamus", moderate: "kohtalainen luottamus", low: "alhainen luottamus" },
    domainNames: { A: "Arkkitehtuuri", E: "Toteutus", C: "Kontekstivartija" },
    modeLabels: { clinical: "Kliininen", pharmacy: "Apteekki", self: "Itseraportoi", research: "Tutkimus", chw: "Yhteisöterveydenhuollon Työntekijä" },
    questions: [
      { text: "Onko sinulla hetkiä, jolloin unohdat ottaa lääkkeesi?", binary: ["Kyllä", "Ei"] },
      { text: "Oletko viimeisten kahden viikon aikana jättänyt annoksen väliin (esim. sivuvaikutusten, kustannusten tai paremman olon vuoksi)?", binary: ["Kyllä", "Ei"] },
      { text: "Oletko viimeisten kahden viikon aikana omin päin vähentänyt annostasi tai lopettanut lääkkeen kertomatta lääkärillesi siitä, miten se sai sinut voimaan?", binary: ["Kyllä", "Ei"] },
      { text: "Kun päivittäinen rutiinisi muuttuu (esim. matkat, erilaiset työajat tai kotoa poissaolo), onko sinulla vaikeuksia pitää kiinni lääkityksestäsi?", binary: ["Kyllä", "Ei"] },
      { text: "Pystyitkö ottamaan viimeisen annoksesi ohjeen mukaan?", binary: ["Kyllä", "Ei"] },
      { text: "Kun alat voida paremmin tai oireesi lievittyvät, harkitsetko joskus lääkkeesi vähentämistä tai tauottamista omin päin?", binary: ["Kyllä", "Ei"] },
      { text: "Tuntuuko lääkerutiinin ylläpitäminen suurelta haasteelta jokapäiväisessä elämässäsi?", binary: ["Kyllä", "Ei"] },
      { text: "Kuinka usein tyypillisenä viikkona sinulla on vaikeuksia ottaa kaikki lääkkeesi ohjeen mukaan?", ordinal: ["Ei koskaan", "Harvoin", "Joskus", "Usein", "Koko ajan"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Optimistinen Lopettaja",         desc: "Potilas osoittaa riittävää käyttäytymiseen perustuvaa hoitoon sitoutumista, mutta uskoo, että lääke ei ehkä enää ole tarpeen. Oireiden helpottuminen tai koettu paraneminen johtaa tarkoitukselliseen annoksen vähentämiseen tai lopettamiseen.", intervention: "Koulutus sairauden kroonisuudesta; yhteiset pitkän aikavälin tavoitteet; hoitoasenteiden uudelleenarviointi; strukturoitu seuranta." },
      'Intentional Resistor': { name: "Tahallinen Vastustaja",          desc: "Potilaalla on uskomuksia, jotka aktiivisesti estävät johdonmukaista hoitoon sitoutumista. Sitoutumattomuus on tahallista ja päätöspohjaista. Arkkitehtuuridomeeni on ensisijainen epäonnistuminen.", intervention: "Motivoiva haastattelu; yhteistyöhön perustuva uskomusten uudelleenjäsentäminen; sivuvaikutuskeskustelu ja vaihtoehtoinen hoitosuunnitelma tarvittaessa." },
      'Routine Forgetter':    { name: "Rutiinin Unohtaja",              desc: "Potilaalla on riittävät uskomukset, mutta epäonnistuu johdonmukaisesti päivittäisen rutiinin toteuttamisessa. Unohtelu ja epäjohdonmukaiset ajankohdat ovat ensisijaisia esteitä.", intervention: "Käyttäytymispohjaiset muistutusstrategiat (hälytykset, dosetti, yhdistäminen olemassa oleviin rutiineihin); apteekin pakkaukset; digitaaliset muistutukset." },
      'Situational Skipper':  { name: "Tilannekohtainen Ohittaja",      desc: "Ympäristölliset tai logistiset esteet keskeyttävät muutoin motivoituneen potilaan hoitoon sitoutumisen. Saatavuus, kustannukset tai sosiaalinen konteksti ovat tekijöitä.", intervention: "Esteiden kartoitus; lääkkeiden saatavuusohjelmat; taloudellinen tuki; hoito-ohjelman yksinkertaistaminen; vertaistuki." },
      'Side-Effect Avoider':  { name: "Sivuvaikutusten Välttelyä",      desc: "Potilaalla on ympäristöllinen kitka ja sivuvaikutushäiriö vähentyneillä lääkeuskomuksilla. Malli vastaa lääkekokemuksesta johtuvaa välttämistä.", intervention: "Sivuvaikutusten arviointi; oireidenhallintastrategiat; hoito-ohjelman muutos määrääjän kanssa; potilasohjaus; tukiohjelmat." },
      'Balanced Low':         { name: "Tasapainoisesti Alhainen",       desc: "Potilaalla on yleisesti alentunut hoitoon sitoutuminen kaikissa kolmessa MAP-domeenissa ilman yhtä hallitsevaa epäonnistumismallia. Kattava interventio on aiheellinen.", intervention: "Kattava hoitoon sitoutumisen arviointi; monikomponenttinen interventio, joka käsittelee uskomuksia, rutiineja ja esteitä rinnakkain; tiivis seuranta." },
      'Adequate Adherent':    { name: "Riittävä Hoitoon Sitoutuminen",  desc_high: "Potilas osoittaa riittävää hoitoon sitoutumista kaikissa kolmessa domeenissa. PE-pisteet osoittavat optimaalisen hoitoon sitoutumisen terveyden.", desc_moderate: "Potilas osoittaa riittävää hoitoon sitoutumista kaikissa kolmessa domeenissa. PE-pisteet osoittavat hyvän hoitoon sitoutumisen terveyden.", intervention: "Ylläpidä nykyinen hoito-ohjelma; vahvista hoitoon sitoutumiskäyttäytymistä rutiinikäynneillä. Aikatauluta uudelleenarviointi seuraavalla kliinisellä käynnillä." },
    },
  },
  af: {
    formTitle: "MAP-Assessering",
    formSubtitle: "Multidimensionele Nakoming-Parameters",
    scoreLabel_pe: "PE-Telling",
    scoreLabel_arch: "Argitektuur",
    scoreLabel_exec: "Uitvoering",
    scoreLabel_ctx: "Konteks-Wag",
    progressHint: "Beantwoord al 8 vrae om die PE-telling lewendig te bereken",
    progressCount: function(a, t) { return a + ' / ' + t + ' beantwoord'; },
    allAnswered: "Alle vrae beantwoord. Hersien die tellings voor indiening.",
    submitBtn: "Dien assessering in",
    pleaseAnswerAll: "Beantwoord asseblief al 8 vrae voor indiening.",
    resultsTitle: "Assesseringsresultate",
    metaAdditive: "Additief",
    metaLowAdherence: "Lae nakoming",
    metaDominantFailure: "Dominante mislukking",
    interventionLabel: "Intervensieprotokol",
    assessmentRecorded: "Assessering aangeteken",
    confidence: { high: "hoë vertroue", moderate: "matige vertroue", low: "lae vertroue" },
    domainNames: { A: "Argitektuur", E: "Uitvoering", C: "Konteks-Wag" },
    modeLabels: { clinical: "Klinies", pharmacy: "Apteek", self: "Self-verslag", research: "Navorsing", chw: "Gemeenskapsgesondheidswerker" },
    questions: [
      { text: "Is daar tye wanneer jy vergeet om jou medisyne te neem?", binary: ["Ja", "Nee"] },
      { text: "Het jy die afgelope twee weke 'n dosis oorgesit (bv. weens newe-effekte, koste of omdat jy beter gevoel het)?", binary: ["Ja", "Nee"] },
      { text: "Het jy die afgelope twee weke op jou eie 'n dosis verminder of 'n medisyne gestaak sonder om jou dokter in te lig, weens die effek daarvan op jou?", binary: ["Ja", "Nee"] },
      { text: "Wanneer jou daaglikse roetine verander (bv. reise, ander werksure of afwesigheid van die huis), vind jy dit moeilik om jou medisyne by te hou?", binary: ["Ja", "Nee"] },
      { text: "Was jy in staat om jou laaste dosis soos voorgeskryf te neem?", binary: ["Ja", "Nee"] },
      { text: "Wanneer jy beter begin voel of jou simptome verbeter, dink jy ooit om jou medisyne op jou eie te verminder of te staak?", binary: ["Ja", "Nee"] },
      { text: "Voel die handhawing van jou medisyneroetine soos 'n groot uitdaging in jou daaglikse lewe?", binary: ["Ja", "Nee"] },
      { text: "Hoe gereeld in 'n tipiese week het jy moeite om al jou medisyne soos voorgeskryf te neem?", ordinal: ["Nooit", "Selde", "Soms", "Gereeld", "Altyd"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Optimistiese Stopper",           desc: "Die pasiënt toon voldoende gedragsmatige nakoming maar glo dat die medisyne dalk nie meer nodig is nie. Simptoomverligting of waargenome genesing dryf doelbewuste dosisverlaging aan.", intervention: "Opvoeding oor chroniese aard van siekte; gesamentlike langtermyndoelwitte; hersiening van behandelingsoortuigings; gestruktureerde opvolging." },
      'Intentional Resistor': { name: "Doelbewuste Weigeraar",          desc: "Die pasiënt het oortuigings wat aktief teen konsekwente nakoming inwerk. Nie-nakoming is doelbewus en besluitgebaseerd. Die Argitektuurdomein is die primêre mislukking.", intervention: "Motiverende onderhoud; samewerkende herformulering van oortuigings; bespreking van newe-effekte en alternatiewe regimen indien van toepassing." },
      'Routine Forgetter':    { name: "Roetine Vergeter",               desc: "Die pasiënt het voldoende oortuigings maar misluk konsekwent in die daaglikse uitvoering. Vergeetagtigheid en inkonsistente tye is die primêre hindernisse.", intervention: "Gedragsherinneringsstrategieë (alarms, pilledosette, koppeling aan bestaande roetines); apteek blister-pakke; digitale herinneringsintegrasie." },
      'Situational Skipper':  { name: "Situasionele Oorslaaner",        desc: "Omgewings- of logistieke hindernisse onderbreek die nakoming van 'n andersins gemotiveerde pasiënt. Toegang, koste of sosiale konteks is faktore.", intervention: "Hindernis-kartering; toegangsprogramme vir medisyne; finansiële ondersteuning; vereenvoudiging van regimen; portuurondersteuning." },
      'Side-Effect Avoider':  { name: "Newe-effek Vermeider",           desc: "Die pasiënt ervaar omgewingswrywing en newe-effek-interferensie met verminderde medisyneoortuigings. Die patroon stem ooreen met vermyding gedryf deur medisyneervaring.", intervention: "Newe-effek hersiening; simptoombestuurstrategieë; regimen-wysiging met die voorskrywer; pasiëntopvoeding; ondersteuningsprogramme." },
      'Balanced Low':         { name: "Gebalanseerde Lae Nakoming",     desc: "Die pasiënt toon globaal verminderde nakoming in alle drie MAP-domeine sonder 'n enkele dominante mislukking. 'n Omvattende intervensie is aangedui.", intervention: "Omvattende nakomingshersiening; multikомponent-intervensie wat oortuigings, roetines en hindernisse parallel aanspreek; noue monitering." },
      'Adequate Adherent':    { name: "Voldoende Nakoming",             desc_high: "Die pasiënt toon voldoende nakoming in die drie domeine. Die PE-telling dui op optimale nakomingsgesondheid.", desc_moderate: "Die pasiënt toon voldoende nakoming in die drie domeine. Die PE-telling dui op goeie nakomingsgesondheid.", intervention: "Handhaaf huidige regimen; versterk nakomingsgedrag by roetinebesoeke. Beplan herbeoordeling by volgende kliniese besoek." },
    },
  },

  ru: {
    formTitle: "Оценка MAP",
    formSubtitle: "Многомерные Параметры Приверженности",
    scoreLabel_pe: "Оценка PE",
    scoreLabel_arch: "Архитектура",
    scoreLabel_exec: "Выполнение",
    scoreLabel_ctx: "Контекст-Страж",
    progressHint: "Ответьте на все 8 вопросов для расчёта оценки PE в реальном времени",
    progressCount: function(a, t) { return a + ' / ' + t + ' отвечено'; },
    allAnswered: "На все вопросы отвечено. Проверьте оценки перед отправкой.",
    submitBtn: "Отправить оценку",
    pleaseAnswerAll: "Пожалуйста, ответьте на все 8 вопросов перед отправкой.",
    resultsTitle: "Результаты оценки",
    metaAdditive: "Аддитивный",
    metaLowAdherence: "Низкая приверженность",
    metaDominantFailure: "Доминирующий сбой",
    interventionLabel: "Протокол вмешательства",
    assessmentRecorded: "Оценка зафиксирована",
    confidence: { high: "высокая уверенность", moderate: "умеренная уверенность", low: "низкая уверенность" },
    domainNames: { A: "Архитектура", E: "Выполнение", C: "Контекст-Страж" },
    modeLabels: { clinical: "Клинический", pharmacy: "Аптека", self: "Самооценка", research: "Исследование", chw: "Работник здравоохранения сообщества" },
    questions: [
      { text: "Бывают ли у вас моменты, когда вы забываете принять лекарства?", binary: ["Да", "Нет"] },
      { text: "За последние две недели бывали ли случаи, когда вы намеренно пропускали дозу (например, из-за побочных эффектов, стоимости или улучшения самочувствия)?", binary: ["Да", "Нет"] },
      { text: "За последние две недели вы самостоятельно снижали дозу или прекращали приём лекарства, не сообщая об этом врачу, из-за его влияния на ваше самочувствие?", binary: ["Да", "Нет"] },
      { text: "Когда ваш распорядок дня меняется (путешествия, другой рабочий график или пребывание вне дома), вам трудно придерживаться режима приёма лекарств?", binary: ["Да", "Нет"] },
      { text: "Смогли ли вы принять последнюю дозу в соответствии с назначением?", binary: ["Да", "Нет"] },
      { text: "Когда вы начинаете чувствовать себя лучше или симптомы улучшаются, задумываетесь ли вы о самостоятельном снижении дозы или прекращении приёма лекарства?", binary: ["Да", "Нет"] },
      { text: "Ощущаете ли вы соблюдение режима приёма лекарств как большой вызов в повседневной жизни?", binary: ["Да", "Нет"] },
      { text: "Как часто в течение типичной недели у вас возникают трудности с приёмом всех лекарств в соответствии с назначением?", ordinal: ["Никогда", "Редко", "Иногда", "Часто", "Всегда"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Оптимистичный Прерыватель",     desc: "Пациент демонстрирует достаточную поведенческую приверженность, но убеждён, что лекарство, возможно, больше не нужно. Купирование симптомов или воспринимаемое выздоровление обусловливает намеренное снижение дозы или плановое прекращение.", intervention: "Обучение хронической природе заболевания; совместное определение долгосрочных целей лечения; пересмотр убеждений; структурированное наблюдение." },
      'Intentional Resistor': { name: "Намеренно Сопротивляющийся",    desc: "Пациент придерживается убеждений, активно противодействующих последовательной приверженности. Неприверженность носит намеренный и обоснованный характер. Домен Архитектура является основным сбоем.", intervention: "Мотивационное интервью; совместное переосмысление убеждений; обсуждение побочных эффектов и альтернативной схемы при необходимости." },
      'Routine Forgetter':    { name: "Забывчивый Рутинер",            desc: "Пациент имеет адекватные убеждения, но постоянно не выполняет ежедневный распорядок. Забывчивость и непоследовательное время приёма — основные барьеры.", intervention: "Поведенческие сигналы-напоминания (будильники, таблетницы, связка с существующими привычками); аптечные блистеры; цифровые напоминания." },
      'Situational Skipper':  { name: "Ситуативный Пропускающий",      desc: "Экологические или логистические барьеры нарушают приверженность мотивированного пациента. Доступность, стоимость или социальный контекст являются факторами.", intervention: "Картирование барьеров; программы доступа к лекарствам; финансовая помощь; упрощение схемы; поддержка сверстников." },
      'Side-Effect Avoider':  { name: "Избегающий Побочных Эффектов",  desc: "Пациент испытывает экологическое трение и интерференцию побочных эффектов при сниженных убеждениях в отношении лекарства. Паттерн соответствует избеганию, обусловленному опытом приёма лекарств.", intervention: "Оценка побочных эффектов; стратегии купирования симптомов; коррекция схемы с назначающим врачом; обучение пациента; программы поддержки." },
      'Balanced Low':         { name: "Равномерно Низкая Приверженность", desc: "Пациент демонстрирует глобально сниженную приверженность по всем трём доменам MAP без единого доминирующего паттерна. Показано комплексное вмешательство.", intervention: "Комплексный анализ приверженности; многокомпонентное вмешательство, параллельно охватывающее убеждения, поведенческие рутины и экологические барьеры; тщательный мониторинг." },
      'Adequate Adherent':    { name: "Достаточная Приверженность",    desc_high: "Пациент демонстрирует достаточную приверженность по всем трём доменам. Оценка PE указывает на оптимальное состояние приверженности.", desc_moderate: "Пациент демонстрирует достаточную приверженность по всем трём доменам. Оценка PE указывает на хорошее состояние приверженности.", intervention: "Поддерживать текущую схему; укреплять поведение приверженности при рутинных визитах. Запланировать повторную оценку на следующем приёме." },
    },
  },
  uk: {
    formTitle: "Оцінка MAP",
    formSubtitle: "Багатовимірні Параметри Прихильності",
    scoreLabel_pe: "Оцінка PE",
    scoreLabel_arch: "Архітектура",
    scoreLabel_exec: "Виконання",
    scoreLabel_ctx: "Контекст-Охоронець",
    progressHint: "Дайте відповіді на всі 8 питань для розрахунку оцінки PE в реальному часі",
    progressCount: function(a, t) { return a + ' / ' + t + ' відповіли'; },
    allAnswered: "На всі питання отримано відповіді. Перевірте оцінки перед відправленням.",
    submitBtn: "Надіслати оцінку",
    pleaseAnswerAll: "Будь ласка, дайте відповіді на всі 8 питань перед надсиланням.",
    resultsTitle: "Результати оцінки",
    metaAdditive: "Адитивний",
    metaLowAdherence: "Низька прихильність",
    metaDominantFailure: "Домінуюча невдача",
    interventionLabel: "Протокол втручання",
    assessmentRecorded: "Оцінку зафіксовано",
    confidence: { high: "висока впевненість", moderate: "помірна впевненість", low: "низька впевненість" },
    domainNames: { A: "Архітектура", E: "Виконання", C: "Контекст-Охоронець" },
    modeLabels: { clinical: "Клінічний", pharmacy: "Аптека", self: "Самооцінка", research: "Дослідження", chw: "Громадський медичний працівник" },
    questions: [
      { text: "Чи бувають у вас моменти, коли ви забуваєте приймати ліки?", binary: ["Так", "Ні"] },
      { text: "За останні два тижні чи були випадки, коли ви навмисно пропускали дозу (наприклад, через побічні ефекти, вартість або покращення самопочуття)?", binary: ["Так", "Ні"] },
      { text: "За останні два тижні чи самостійно зменшували дозу або припиняли прийом ліків, не повідомивши лікаря, через їхній вплив на ваше самопочуття?", binary: ["Так", "Ні"] },
      { text: "Коли ваш розпорядок дня змінюється (подорожі, інший графік роботи або відсутність вдома), чи важко вам дотримуватися режиму прийому ліків?", binary: ["Так", "Ні"] },
      { text: "Чи змогли ви прийняти останню дозу відповідно до призначення?", binary: ["Так", "Ні"] },
      { text: "Коли ви починаєте почуватися краще або симптоми покращуються, чи думаєте ви про самостійне зменшення або припинення прийому ліків?", binary: ["Так", "Ні"] },
      { text: "Чи відчуваєте ви дотримання режиму прийому ліків як велику проблему у повсякденному житті?", binary: ["Так", "Ні"] },
      { text: "Як часто протягом типового тижня у вас виникають труднощі з прийомом усіх ліків відповідно до призначення?", ordinal: ["Ніколи", "Рідко", "Іноді", "Часто", "Завжди"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Оптимістичний Припиняч",        desc: "Пацієнт демонструє достатню поведінкову прихильність, але переконаний, що ліки, можливо, вже не потрібні. Зникнення симптомів або уявне одужання зумовлює навмисне зниження дози або плановане припинення.", intervention: "Навчання хронічній природі захворювання; спільне визначення довгострокових цілей; перегляд переконань; структурований моніторинг." },
      'Intentional Resistor': { name: "Навмисно Чинячий Опір",         desc: "Пацієнт має переконання, що активно протидіють послідовній прихильності. Неприхильність носить навмисний та обґрунтований характер. Домен Архітектура є основною невдачею.", intervention: "Мотиваційне інтерв'ю; спільне переосмислення переконань; обговорення побічних ефектів і альтернативної схеми за потреби." },
      'Routine Forgetter':    { name: "Звичний Забудько",              desc: "Пацієнт має адекватні переконання, але постійно не виконує щоденний розпорядок. Забудькуватість і непослідовний час прийому — основні бар'єри.", intervention: "Поведінкові нагадування (будильники, таблетниці, прив'язка до існуючих звичок); аптечні блістери; цифрові нагадування." },
      'Situational Skipper':  { name: "Ситуативний Пропускач",         desc: "Екологічні або логістичні бар'єри порушують прихильність мотивованого пацієнта. Доступність, вартість або соціальний контекст є факторами.", intervention: "Картування бар'єрів; програми доступу до ліків; фінансова допомога; спрощення схеми; підтримка однолітків." },
      'Side-Effect Avoider':  { name: "Уникач Побічних Ефектів",       desc: "Пацієнт відчуває екологічне тертя і інтерференцію побічних ефектів при знижених переконаннях щодо ліків. Патерн відповідає уникненню, зумовленому досвідом прийому ліків.", intervention: "Оцінка побічних ефектів; стратегії усунення симптомів; корекція схеми з призначаючим лікарем; навчання пацієнта; програми підтримки." },
      'Balanced Low':         { name: "Рівномірно Низька Прихильність", desc: "Пацієнт демонструє загально знижену прихильність за всіма трьома доменами MAP без єдиного домінуючого патерну. Показано комплексне втручання.", intervention: "Комплексний аналіз прихильності; багатокомпонентне втручання, що паралельно охоплює переконання, рутини і бар'єри; ретельний моніторинг." },
      'Adequate Adherent':    { name: "Достатня Прихильність",         desc_high: "Пацієнт демонструє достатню прихильність за всіма трьома доменами. Оцінка PE вказує на оптимальний стан прихильності.", desc_moderate: "Пацієнт демонструє достатню прихильність за всіма трьома доменами. Оцінка PE вказує на хороший стан прихильності.", intervention: "Підтримувати поточну схему; зміцнювати поведінку прихильності при рутинних візитах. Запланувати повторну оцінку на наступному прийомі." },
    },
  },
  hr: {
    formTitle: "MAP Procjena",
    formSubtitle: "Višedimenzionalni Parametri Adherencije",
    scoreLabel_pe: "PE Rezultat",
    scoreLabel_arch: "Arhitektura",
    scoreLabel_exec: "Izvršenje",
    scoreLabel_ctx: "Kontekst-Čuvar",
    progressHint: "Odgovorite na sva 8 pitanja za izračun PE rezultata uživo",
    progressCount: function(a, t) { return a + ' / ' + t + ' odgovoreno'; },
    allAnswered: "Sva pitanja su odgovorena. Pregledajte rezultate prije slanja.",
    submitBtn: "Pošalji procjenu",
    pleaseAnswerAll: "Molimo odgovorite na sva 8 pitanja prije slanja.",
    resultsTitle: "Rezultati procjene",
    metaAdditive: "Aditivni",
    metaLowAdherence: "Niska adherencija",
    metaDominantFailure: "Dominantni neuspjeh",
    interventionLabel: "Protokol intervencije",
    assessmentRecorded: "Procjena zabilježena",
    confidence: { high: "visoka pouzdanost", moderate: "umjerena pouzdanost", low: "niska pouzdanost" },
    domainNames: { A: "Arhitektura", E: "Izvršenje", C: "Kontekst-Čuvar" },
    modeLabels: { clinical: "Klinički", pharmacy: "Ljekarna", self: "Samoizvještavanje", research: "Istraživanje", chw: "Zdravstveni radnik zajednice" },
    questions: [
      { text: "Postoje li trenuci kada zaboravite uzeti lijekove?", binary: ["Da", "Ne"] },
      { text: "U protekla dva tjedna, jeste li namjerno preskočili dozu (npr. zbog nuspojava, troška ili jer ste se osjećali bolje)?", binary: ["Da", "Ne"] },
      { text: "U protekla dva tjedna, jeste li sami smanjili dozu ili prestali uzimati lijek bez obavještavanja liječnika, zbog toga kako vas je činio osjećati?", binary: ["Da", "Ne"] },
      { text: "Kada se vaša dnevna rutina promijeni (putovanja, drugačije radno vrijeme ili odsutnost od kuće), teško vam je pratiti uzimanje lijekova?", binary: ["Da", "Ne"] },
      { text: "Jeste li uspjeli uzeti posljednju dozu kako je propisano?", binary: ["Da", "Ne"] },
      { text: "Kada počnete osjećati poboljšanje ili vaši simptomi se poboljšaju, razmišljate li o samostalnom smanjenju ili pauziranju lijeka?", binary: ["Da", "Ne"] },
      { text: "Osjećate li da je pridržavanje terapijskog rasporeda veliki izazov u svakodnevnom životu?", binary: ["Da", "Ne"] },
      { text: "Koliko često u tipičnom tjednu imate poteškoća s uzimanjem svih lijekova prema propisu?", ordinal: ["Nikad", "Rijetko", "Ponekad", "Često", "Uvijek"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Optimistični Zaustavljač",       desc: "Pacijent pokazuje adekvatno ponašanje adherencije, ali vjeruje da lijek možda više nije potreban. Povlačenje simptoma potiče namjerno smanjenje doze ili planiranu obustavu.", intervention: "Edukacija o kroničnosti bolesti; zajednički dugoročni ciljevi; preispitivanje uvjerenja o liječenju; strukturirano praćenje." },
      'Intentional Resistor': { name: "Namjerni Otpornik",              desc: "Pacijent ima uvjerenja koja aktivno sprječavaju dosljednu adherenciju. Neadherencija je namjerna i odlučujuća. Domena Arhitektura je primarni neuspjeh.", intervention: "Motivacijski intervju; suradničko preformuliranje uvjerenja; razgovor o nuspojavama i alternativnom režimu po potrebi." },
      'Routine Forgetter':    { name: "Rutinski Zaboravljač",           desc: "Pacijent ima adekvatna uvjerenja, ali dosljedeno ne izvršava dnevnu rutinu. Zaboravljivost i nedosljedni termini su primarne prepreke.", intervention: "Bihevioralni podsjetnici (alarmi, kutije za tablete, vezanje uz postojeće rutine); ljekarničke blister-pakete; digitalni podsjetnici." },
      'Situational Skipper':  { name: "Situacijski Preskakač",          desc: "Okolišne ili logističke prepreke prekidaju adherenciju inače motiviranog pacijenta. Pristup, trošak ili društveni kontekst su čimbenici.", intervention: "Kartiranje prepreka; programi pristupa lijekovima; financijska pomoć; pojednostavljivanje režima; vršnjačka podrška." },
      'Side-Effect Avoider':  { name: "Izbjegavač Nuspojava",           desc: "Pacijent doživljava okolišno trenje i interferenciju nuspojava sa smanjenim uvjerenjima o lijeku. Obrazac odgovara izbjegavanju potaknutom iskustvom s lijekovima.", intervention: "Pregled nuspojava; strategije upravljanja simptomima; modifikacija režima s propisivačem; edukacija pacijenta; programi podrške." },
      'Balanced Low':         { name: "Uravnoteženo Niska Adherencija", desc: "Pacijent pokazuje globalno smanjenu adherenciju u sve tri MAP domene bez jednog dominantnog obrasca neuspjeha. Indicirana je sveobuhvatna intervencija.", intervention: "Sveobuhvatan pregled adherencije; višekomponentna intervencija koja paralelno adresira uvjerenja, rutine i prepreke; pomno praćenje." },
      'Adequate Adherent':    { name: "Adekvatna Adherencija",          desc_high: "Pacijent pokazuje adekvatnu adherenciju u sve tri domene. PE rezultat ukazuje na optimalnu adherencijsku zdravlje.", desc_moderate: "Pacijent pokazuje adekvatnu adherenciju u sve tri domene. PE rezultat ukazuje na dobro adherencijsko zdravlje.", intervention: "Održavati trenutni režim; ojačati ponašanje adherencije na rutinskim posjetima. Planirati ponovnu procjenu na sljedećem kliničkom posjetu." },
    },
  },
  sq: {
    formTitle: "Vlerësimi MAP",
    formSubtitle: "Parametrat Shumëdimensionalë të Respektimit",
    scoreLabel_pe: "Rezultati PE",
    scoreLabel_arch: "Arkitektura",
    scoreLabel_exec: "Ekzekutimi",
    scoreLabel_ctx: "Kujdestari i Kontekstit",
    progressHint: "Përgjigjuni të gjitha 8 pyetjeve për të llogaritur rezultatin PE në kohë reale",
    progressCount: function(a, t) { return a + ' / ' + t + ' u përgjigjën'; },
    allAnswered: "Të gjitha pyetjet u përgjigjën. Rishikoni rezultatet para dorëzimit.",
    submitBtn: "Dërgo vlerësimin",
    pleaseAnswerAll: "Ju lutem përgjigjuni të gjitha 8 pyetjeve para dorëzimit.",
    resultsTitle: "Rezultatet e vlerësimit",
    metaAdditive: "Aditiv",
    metaLowAdherence: "Respektim i ulët",
    metaDominantFailure: "Dështim dominues",
    interventionLabel: "Protokolli i ndërhyrjes",
    assessmentRecorded: "Vlerësimi u regjistrua",
    confidence: { high: "besim i lartë", moderate: "besim i mesëm", low: "besim i ulët" },
    domainNames: { A: "Arkitektura", E: "Ekzekutimi", C: "Kujdestari i Kontekstit" },
    modeLabels: { clinical: "Klinike", pharmacy: "Farmaci", self: "Vetë-raportim", research: "Kërkime", chw: "Punonjës i Shëndetit Komunitar" },
    questions: [
      { text: "A ka momente kur harroni të merrni ilaçet tuaja?", binary: ["Po", "Jo"] },
      { text: "Gjatë dy javëve të fundit, a ka pasur raste kur keni zgjedhur të kapërceni një dozë (p.sh. për shkak të efekteve anësore, kostos ose ngaqë ndiheshit më mirë)?", binary: ["Po", "Jo"] },
      { text: "Gjatë dy javëve të fundit, a keni reduktuar dozën ose ndaluar një ilaç vetë, pa informuar mjekun tuaj, për shkak të mënyrës se si ju bënte të ndiheshit?", binary: ["Po", "Jo"] },
      { text: "Kur rutina juaj e përditshme ndryshon (udhëtime, orare të ndryshme pune ose mungesë nga shtëpia), e gjeni të vështirë të mbani ritmin e ilaçeve?", binary: ["Po", "Jo"] },
      { text: "A mundët të merrni dozën e fundit sipas udhëzimeve?", binary: ["Po", "Jo"] },
      { text: "Kur filloni të ndiheni më mirë ose simptomat tuaja përmirësohen, a mendoni ndonjëherë të reduktoni ose të ndaloni ilaçin tuaj vetë?", binary: ["Po", "Jo"] },
      { text: "A ndiheni se mbajtja e rutinës suaj të ilaçeve është një sfidë e madhe në jetën tuaj të përditshme?", binary: ["Po", "Jo"] },
      { text: "Sa shpesh gjatë një jave tipike keni vështirësi të merrni të gjitha ilaçet tuaja sipas recetës?", ordinal: ["Kurrë", "Rrallë", "Ndonjëherë", "Shpesh", "Gjithmonë"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Ndarpritësi Optimist",           desc: "Pacienti tregon respektim adekuat sjellësor, por beson se ilaçi nuk është më i nevojshëm. Zhdukja e simptomave ose shërimi i perceptuar shkakton reduktimin e qëllimshëm të dozës.", intervention: "Edukimi mbi kronicitetet e sëmundjes; vendosja e qëllimeve afatgjata; rivlerësimi i besimeve mbi trajtimin; ndjekje e strukturuar." },
      'Intentional Resistor': { name: "Rezistuesi i Qëllimshëm",        desc: "Pacienti mban besime që kundërshtojnë aktivisht respektimin konsistent. Mosrespektimi është i qëllimshëm dhe i bazuar në vendime. Domeni Arkitektura është dështimi kryesor.", intervention: "Intervista motivuese; rikuadrim bashkëpunues i besimeve; diskutim mbi efektet anësore dhe regjimin alternativ nëse është e përshtatshme." },
      'Routine Forgetter':    { name: "Harruesi Rutinor",               desc: "Pacienti ka besime adekuate, por vazhdimisht dështon në ekzekutimin e rutinës ditore. Harresa dhe oraret e parregullta janë pengesat kryesore.", intervention: "Strategji kujtese sjellësore (alarme, kutia e ilaçeve, lidhja me rutina ekzistuese); paketa farmaciste; kujtues dixhitalë." },
      'Situational Skipper':  { name: "Kapërcyesi Situacional",         desc: "Pengesat mjedisore ose logjistike ndërpresin respektimin e një pacienti të motivuar. Aksesi, kostoja ose konteksti social janë faktorët.", intervention: "Hartëzimi i pengesave; programet e aksesit në ilaçe; ndihmë financiare; thjeshtim i regjimit; mbështetje bashkëmoshatarësh." },
      'Side-Effect Avoider':  { name: "Shmangësi i Efekteve Anësore",   desc: "Pacienti përjeton fërkime mjedisore dhe ndërhyrje të efekteve anësore me besime të reduktuara mbi ilaçin. Modeli korrespondon me shmangien e drejtuar nga përvoja me ilaçet.", intervention: "Rishikimi i efekteve anësore; strategji menaxhimi simptomesh; modifikim regjimi me recetuesin; edukimi i pacientit; programe mbështetjeje." },
      'Balanced Low':         { name: "I Ulët Ekuilibruar",             desc: "Pacienti tregon respektim të reduktuar globalisht në të tre domenët MAP pa një model dështimi dominues. Ndërhyrja gjithëpërfshirëse është e treguar.", intervention: "Rishikim gjithëpërfshirës i respektimit; ndërhyrje shumëkomponentësh duke adresuar paralelisht besimet, rutinave dhe pengesat; monitorim i ngushtë." },
      'Adequate Adherent':    { name: "Respektim Adekuat",              desc_high: "Pacienti demonstron respektim adekuat në tre domenët. Rezultati PE tregon shëndet optimal të respektimit.", desc_moderate: "Pacienti demonstron respektim adekuat në tre domenët. Rezultati PE tregon shëndet të mirë të respektimit.", intervention: "Ruaj regjimin aktual; përforco sjelljen e respektimit gjatë vizitave rutinore. Planifiko rivlerësimin në vizitën e ardhshme klinike." },
    },
  },
  tr: {
    formTitle: "MAP Değerlendirmesi",
    formSubtitle: "Çok Boyutlu Uyum Parametreleri",
    scoreLabel_pe: "PE Puanı",
    scoreLabel_arch: "Mimari",
    scoreLabel_exec: "Yürütme",
    scoreLabel_ctx: "Bağlam Bekçisi",
    progressHint: "PE puanını canlı hesaplamak için tüm 8 soruyu yanıtlayın",
    progressCount: function(a, t) { return a + ' / ' + t + ' yanıtlandı'; },
    allAnswered: "Tüm sorular yanıtlandı. Göndermeden önce puanları gözden geçirin.",
    submitBtn: "Değerlendirmeyi gönder",
    pleaseAnswerAll: "Lütfen göndermeden önce tüm 8 soruyu yanıtlayın.",
    resultsTitle: "Değerlendirme Sonuçları",
    metaAdditive: "Toplamsal",
    metaLowAdherence: "Düşük uyum",
    metaDominantFailure: "Baskın başarısızlık",
    interventionLabel: "Müdahale Protokolü",
    assessmentRecorded: "Değerlendirme kaydedildi",
    confidence: { high: "yüksek güven", moderate: "orta güven", low: "düşük güven" },
    domainNames: { A: "Mimari", E: "Yürütme", C: "Bağlam Bekçisi" },
    modeLabels: { clinical: "Klinik", pharmacy: "Eczane", self: "Öz Bildirim", research: "Araştırma", chw: "Toplum Sağlığı Çalışanı" },
    questions: [
      { text: "İlaçlarınızı almayı unuttuğunuz anlar oluyor mu?", binary: ["Evet", "Hayır"] },
      { text: "Son iki haftada bir dozu atlamayı tercih ettiğiniz oldu mu (örn. yan etkiler, maliyet veya daha iyi hissetmek nedeniyle)?", binary: ["Evet", "Hayır"] },
      { text: "Son iki haftada, doktorunuzu bilgilendirmeden kendi başınıza dozunuzu azalttınız veya bir ilacı bıraktınız mı, sizi nasıl hissettirdiği nedeniyle?", binary: ["Evet", "Hayır"] },
      { text: "Günlük rutininiz değiştiğinde (seyahat, farklı çalışma saatleri veya evden uzakta olma), ilaçlarınızı düzenli almakta zorlanıyor musunuz?", binary: ["Evet", "Hayır"] },
      { text: "Son dozunuzu belirtildiği gibi alabildинiz mi?", binary: ["Evet", "Hayır"] },
      { text: "Kendinizi daha iyi hissetmeye başladığınızda veya semptomlarınız iyileştiğinde, ilacınızı kendi başınıza azaltmayı veya duraklatmayı düşünüyor musunuz?", binary: ["Evet", "Hayır"] },
      { text: "İlaç rutininizi sürdürmek günlük yaşamınızda büyük bir zorluk gibi mi geliyor?", binary: ["Evet", "Hayır"] },
      { text: "Tipik bir haftada, tüm ilaçlarınızı reçete edildiği gibi almakta ne sıklıkla güçlük çekiyorsunuz?", ordinal: ["Hiçbir zaman", "Nadiren", "Bazen", "Sık sık", "Her zaman"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "İyimser Bırakan",                desc: "Hasta yeterli davranışsal uyum göstermekte ancak ilacın artık gerekli olmadığına inanmaktadır. Semptomların düzelmesi veya algılanan iyileşme kasıtlı doz azaltımını ya da planlanmış bırakmayı tetiklemektedir.", intervention: "Hastalığın kronikliği hakkında eğitim; uzun vadeli hedef belirleme; tedavi inançlarının yeniden değerlendirilmesi; yapılandırılmış takip." },
      'Intentional Resistor': { name: "Kasıtlı Direnen",               desc: "Hastanın tutarlı uyuma aktif olarak karşı çıkan inançları vardır. Uyumsuzluk kasıtlı ve karar tabanlıdır. Mimari alanı birincil başarısızlıktır.", intervention: "Motivasyonel görüşme; inançların işbirlikçi yeniden çerçevelenmesi; yan etkilerin tartışılması ve uygun olduğunda alternatif rejim müzakeresi." },
      'Routine Forgetter':    { name: "Rutin Unutkan",                  desc: "Hastanın yeterli inançları var, ancak günlük rutini tutarlı biçimde uygulayamamaktadır. Unutkanlık ve tutarsız zamanlar birincil engellerdir.", intervention: "Davranışsal ipucu stratejileri (alarmlar, hap kutuları, mevcut rutinlere bağlama); eczane blister paketleri; dijital hatırlatıcı entegrasyonu." },
      'Situational Skipper':  { name: "Durumsal Atlayan",              desc: "Çevresel veya lojistik engeller motive bir hastanın uyumunu sekteye uğratmaktadır. Erişim, maliyet veya sosyal bağlam etkenlerdir.", intervention: "Engel haritalama; ilaç erişim programları; finansal yardım; rejim basitleştirme; akran destek bağlantısı." },
      'Side-Effect Avoider':  { name: "Yan Etki Kaçınmacısı",          desc: "Hasta çevresel sürtünme ve yan etki müdahalesini azaltılmış ilaç inançlarıyla birlikte yaşamaktadır. Patern, ilaç deneyimi tarafından yönlendirilen kaçınmaya karşılık gelmektedir.", intervention: "Yan etki gözden geçirme; semptom yönetimi stratejileri; reçete eden ile rejim modifikasyonu; hasta eğitimi; engel destek programları." },
      'Balanced Low':         { name: "Dengeli Düşük Uyum",            desc: "Hasta üç MAP alanında da tek bir baskın başarısızlık deseni olmaksızın genel olarak azalmış uyum göstermektedir. Kapsamlı müdahale endikedir.", intervention: "Kapsamlı uyum gözden geçirmesi; inançları, davranışsal rutinleri ve çevresel engelleri paralel olarak ele alan çok bileşenli müdahale; yakın izleme." },
      'Adequate Adherent':    { name: "Yeterli Uyum",                  desc_high: "Hasta üç alanda da yeterli uyum göstermektedir. PE puanı optimal uyum sağlığını göstermektedir.", desc_moderate: "Hasta üç alanda da yeterli uyum göstermektedir. PE puanı iyi uyum sağlığını göstermektedir.", intervention: "Mevcut rejimi sürdür; rutin ziyaretlerde uyum davranışlarını güçlendir. Sonraki klinik ziyarette yeniden değerlendirme planla." },
    },
  },

  ar: {
    formTitle: "تقييم MAP",
    formSubtitle: "معاملات الالتزام متعددة الأبعاد",
    scoreLabel_pe: "درجة PE",
    scoreLabel_arch: "البنية",
    scoreLabel_exec: "التنفيذ",
    scoreLabel_ctx: "حارس السياق",
    progressHint: "أجب على جميع الأسئلة الـ 8 لحساب درجة PE مباشرة",
    progressCount: function(a, t) { return a + ' / ' + t + ' تمت الإجابة'; },
    allAnswered: "تمت الإجابة على جميع الأسئلة. راجع الدرجات قبل الإرسال.",
    submitBtn: "إرسال التقييم",
    pleaseAnswerAll: "يرجى الإجابة على جميع الأسئلة الـ 8 قبل الإرسال.",
    resultsTitle: "نتائج التقييم",
    metaAdditive: "تراكمي",
    metaLowAdherence: "التزام منخفض",
    metaDominantFailure: "فشل مهيمن",
    interventionLabel: "بروتوكول التدخل",
    assessmentRecorded: "تم تسجيل التقييم",
    confidence: { high: "ثقة عالية", moderate: "ثقة معتدلة", low: "ثقة منخفضة" },
    domainNames: { A: "البنية", E: "التنفيذ", C: "حارس السياق" },
    modeLabels: { clinical: "سريري", pharmacy: "صيدلية", self: "تقرير ذاتي", research: "بحث", chw: "عامل صحة مجتمعي" },
    questions: [
      { text: "هل هناك أوقات تنسى فيها تناول أدويتك؟", binary: ["نعم", "لا"] },
      { text: "خلال الأسبوعين الماضيين، هل اخترت تخطي جرعة (بسبب الآثار الجانبية أو التكلفة أو الشعور بتحسن)؟", binary: ["نعم", "لا"] },
      { text: "خلال الأسبوعين الماضيين، هل خفضت جرعتك أو أوقفت دواءً بنفسك دون إبلاغ طبيبك، بسبب تأثيره عليك؟", binary: ["نعم", "لا"] },
      { text: "عندما تتغير روتينك اليومي (السفر، ساعات عمل مختلفة، أو الغياب عن المنزل)، هل تجد صعوبة في الالتزام بأدويتك؟", binary: ["نعم", "لا"] },
      { text: "هل استطعت تناول آخر جرعة كما وُصفت لك؟", binary: ["نعم", "لا"] },
      { text: "عندما تبدأ بالشعور بتحسن أو تتحسن أعراضك، هل تفكر أحياناً في تقليل دوائك أو إيقافه بنفسك؟", binary: ["نعم", "لا"] },
      { text: "هل يبدو الالتزام بروتين أدويتك تحدياً كبيراً في حياتك اليومية؟", binary: ["نعم", "لا"] },
      { text: "في أسبوع نموذجي، كم مرة تجد صعوبة في تناول جميع أدويتك كما وُصفت؟", ordinal: ["أبداً", "نادراً", "أحياناً", "غالباً", "دائماً"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "المتوقف المتفائل",              desc: "يُظهر المريض التزاماً سلوكياً كافياً لكنه يعتقد أن الدواء لم يعد ضرورياً. يدفع تراجع الأعراض أو الشعور بالشفاء إلى تخفيض الجرعة أو الإيقاف المتعمد.", intervention: "تثقيف حول مزمنة المرض؛ وضع أهداف مشتركة طويلة المدى؛ إعادة تقييم المعتقدات العلاجية؛ متابعة منتظمة منظمة." },
      'Intentional Resistor': { name: "المقاوم المتعمد",               desc: "يحمل المريض معتقدات تتعارض بفاعلية مع الالتزام المنتظم. عدم الالتزام متعمد وقائم على القرار. نطاق البنية هو الإخفاق الرئيسي.", intervention: "مقابلة تحفيزية؛ إعادة صياغة تعاونية للمعتقدات؛ مناقشة الآثار الجانبية والنظام البديل عند الاقتضاء." },
      'Routine Forgetter':    { name: "الناسي الاعتيادي",              desc: "لدى المريض معتقدات كافية لكنه يفشل باستمرار في تنفيذ الروتين اليومي. النسيان والمواعيد غير المتسقة هي العوائق الرئيسية.", intervention: "استراتيجيات التذكير السلوكي (المنبهات، علب الحبوب، الربط بعادات قائمة)؛ جرعات الصيدلية؛ التذكير الرقمي." },
      'Situational Skipper':  { name: "المتخطي الظرفي",               desc: "تُقاطع العوائق البيئية أو اللوجستية التزام مريض متحفز في الأساس. الوصول والتكلفة أو السياق الاجتماعي هي العوامل.", intervention: "رسم خرائط العوائق؛ برامج الوصول للأدوية؛ الدعم المالي؛ تبسيط النظام؛ دعم الأقران." },
      'Side-Effect Avoider':  { name: "متجنب الآثار الجانبية",         desc: "يعاني المريض من احتكاك بيئي وتدخل بسبب الآثار الجانبية مع تراجع في المعتقدات تجاه الدواء. يتوافق النمط مع التجنب المدفوع بتجربة الدواء.", intervention: "مراجعة الآثار الجانبية؛ استراتيجيات إدارة الأعراض؛ تعديل النظام مع الطبيب المعالج؛ تثقيف المريض؛ برامج الدعم." },
      'Balanced Low':         { name: "منخفض متوازن",                  desc: "يُظهر المريض التزاماً منخفضاً بشكل عام في المجالات الثلاثة لـ MAP دون نمط إخفاق مهيمن واحد. يُشار إلى تدخل شامل.", intervention: "مراجعة شاملة للالتزام؛ تدخل متعدد المكونات يعالج المعتقدات والروتين والعوائق بالتوازي؛ مراقبة دقيقة وإعادة تقييم." },
      'Adequate Adherent':    { name: "التزام كافٍ",                   desc_high: "يُظهر المريض التزاماً كافياً في المجالات الثلاثة. تشير درجة PE إلى صحة التزام مثلى.", desc_moderate: "يُظهر المريض التزاماً كافياً في المجالات الثلاثة. تشير درجة PE إلى صحة التزام جيدة.", intervention: "الحفاظ على النظام الحالي؛ تعزيز سلوكيات الالتزام في الزيارات الروتينية. جدولة إعادة التقييم في الزيارة السريرية القادمة." },
    },
  },
  hi: {
    formTitle: "MAP मूल्यांकन",
    formSubtitle: "बहुआयामी पालन पैरामीटर",
    scoreLabel_pe: "PE स्कोर",
    scoreLabel_arch: "वास्तुकला",
    scoreLabel_exec: "निष्पादन",
    scoreLabel_ctx: "संदर्भ-रक्षक",
    progressHint: "PE स्कोर लाइव गणना करने के लिए सभी 8 प्रश्नों का उत्तर दें",
    progressCount: function(a, t) { return a + ' / ' + t + ' उत्तर दिए'; },
    allAnswered: "सभी प्रश्नों का उत्तर दिया गया। सबमिट करने से पहले स्कोर की समीक्षा करें।",
    submitBtn: "मूल्यांकन सबमिट करें",
    pleaseAnswerAll: "सबमिट करने से पहले कृपया सभी 8 प्रश्नों का उत्तर दें।",
    resultsTitle: "मूल्यांकन परिणाम",
    metaAdditive: "योगात्मक",
    metaLowAdherence: "कम पालन",
    metaDominantFailure: "प्रमुख विफलता",
    interventionLabel: "हस्तक्षेप प्रोटोकॉल",
    assessmentRecorded: "मूल्यांकन दर्ज किया गया",
    confidence: { high: "उच्च विश्वास", moderate: "मध्यम विश्वास", low: "कम विश्वास" },
    domainNames: { A: "वास्तुकला", E: "निष्पादन", C: "संदर्भ-रक्षक" },
    modeLabels: { clinical: "नैदानिक", pharmacy: "फार्मेसी", self: "स्व-रिपोर्ट", research: "अनुसंधान", chw: "सामुदायिक स्वास्थ्य कार्यकर्ता" },
    questions: [
      { text: "क्या ऐसे समय होते हैं जब आप अपनी दवाएं लेना भूल जाते हैं?", binary: ["हाँ", "नहीं"] },
      { text: "पिछले दो हफ्तों में, क्या ऐसे समय थे जब आपने एक खुराक छोड़ने का चुनाव किया (जैसे दुष्प्रभावों, लागत या बेहतर महसूस होने के कारण)?", binary: ["हाँ", "नहीं"] },
      { text: "पिछले दो हफ्तों में, क्या आपने अपने डॉक्टर को बताए बिना खुद खुराक कम की या दवा बंद की, इस वजह से कि यह आपको कैसा महसूस करा रही थी?", binary: ["हाँ", "नहीं"] },
      { text: "जब आपकी दैनिक दिनचर्या बदलती है (यात्रा, अलग कार्य घंटे, या घर से दूर रहना), तो क्या आपको अपनी दवाएं लेते रहना मुश्किल लगता है?", binary: ["हाँ", "नहीं"] },
      { text: "क्या आप अपनी आखिरी खुराक निर्देशानुसार ले पाए?", binary: ["हाँ", "नहीं"] },
      { text: "जब आप बेहतर महसूस करने लगते हैं या आपके लक्षणों में सुधार होता है, तो क्या आप कभी अपनी दवा खुद कम करने या रोकने के बारे में सोचते हैं?", binary: ["हाँ", "नहीं"] },
      { text: "क्या दवाओं की दिनचर्या बनाए रखना आपको अपने रोजमर्रा के जीवन में एक बड़ी चुनौती लगती है?", binary: ["हाँ", "नहीं"] },
      { text: "एक सामान्य सप्ताह में, आपको कितनी बार सभी दवाएं निर्धारित अनुसार लेने में कठिनाई होती है?", ordinal: ["कभी नहीं", "शायद ही कभी", "कभी-कभी", "अक्सर", "हमेशा"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "आशावादी रोकने वाला",            desc: "रोगी पर्याप्त व्यवहारिक पालन दर्शाता है लेकिन मानता है कि दवा अब आवश्यक नहीं है। लक्षणों का ठीक होना या कथित उपचार जानबूझकर खुराक घटाने या बंद करने की प्रेरणा देता है।", intervention: "बीमारी की दीर्घकालिकता पर शिक्षा; दीर्घकालिक लक्ष्य साझाकरण; उपचार विश्वासों का पुनर्मूल्यांकन; संरचित अनुवर्ती।" },
      'Intentional Resistor': { name: "जानबूझकर प्रतिरोधी",           desc: "रोगी के विश्वास सक्रिय रूप से लगातार पालन के विरुद्ध हैं। गैर-पालन जानबूझकर और निर्णय-आधारित है। वास्तुकला डोमेन प्राथमिक विफलता है।", intervention: "प्रेरक साक्षात्कार; विश्वासों का सहयोगी पुनर्गठन; दुष्प्रभावों पर चर्चा और वैकल्पिक नियम, यदि उचित हो।" },
      'Routine Forgetter':    { name: "नियमित भुलक्कड़",              desc: "रोगी के पर्याप्त विश्वास हैं लेकिन वह लगातार दैनिक दिनचर्या निष्पादित करने में विफल रहता है। भुलक्कड़पन और असंगत समय प्राथमिक बाधाएं हैं।", intervention: "व्यवहारिक संकेत रणनीतियां (अलार्म, दवा के डिब्बे, मौजूदा दिनचर्या से जोड़ना); फार्मेसी ब्लिस्टर पैक; डिजिटल अनुस्मारक।" },
      'Situational Skipper':  { name: "परिस्थितिजन्य छोड़ने वाला",    desc: "पर्यावरणीय या तार्किक बाधाएं एक प्रेरित रोगी के पालन को बाधित करती हैं। पहुंच, लागत या सामाजिक संदर्भ कारक हैं।", intervention: "बाधाओं की मैपिंग; दवा पहुंच कार्यक्रम; वित्तीय सहायता; नियम का सरलीकरण; सहकर्मी समर्थन।" },
      'Side-Effect Avoider':  { name: "दुष्प्रभाव टालने वाला",        desc: "रोगी कम दवा विश्वासों के साथ पर्यावरणीय घर्षण और दुष्प्रभाव हस्तक्षेप का अनुभव करता है। पैटर्न दवा अनुभव से प्रेरित परिहार के अनुरूप है।", intervention: "दुष्प्रभाव समीक्षा; लक्षण प्रबंधन रणनीतियां; निर्धारक के साथ नियम संशोधन; रोगी शिक्षा; सहायता कार्यक्रम।" },
      'Balanced Low':         { name: "संतुलित रूप से कम",            desc: "रोगी एकल प्रमुख विफलता पैटर्न के बिना तीनों MAP डोमेन में समग्र रूप से कम पालन दर्शाता है। व्यापक हस्तक्षेप संकेतित है।", intervention: "व्यापक पालन समीक्षा; विश्वासों, दिनचर्या और बाधाओं को समानांतर में संबोधित करने वाला बहु-घटक हस्तक्षेप; सावधानीपूर्वक निगरानी।" },
      'Adequate Adherent':    { name: "पर्याप्त पालन",                desc_high: "रोगी तीनों डोमेन में पर्याप्त पालन दर्शाता है। PE स्कोर इष्टतम पालन स्वास्थ्य इंगित करता है।", desc_moderate: "रोगी तीनों डोमेन में पर्याप्त पालन दर्शाता है। PE स्कोर अच्छे पालन स्वास्थ्य को इंगित करता है।", intervention: "वर्तमान नियम बनाए रखें; नियमित यात्राओं में पालन व्यवहार को मजबूत करें। अगली नैदानिक यात्रा पर पुनर्मूल्यांकन निर्धारित करें।" },
    },
  },
  ur: {
    formTitle: "MAP تشخیص",
    formSubtitle: "کثیر جہتی تعمیل پیرامیٹرز",
    scoreLabel_pe: "PE اسکور",
    scoreLabel_arch: "ڈھانچہ",
    scoreLabel_exec: "عمل",
    scoreLabel_ctx: "سیاق محافظ",
    progressHint: "PE اسکور کا حساب لگانے کے لیے تمام 8 سوالوں کا جواب دیں",
    progressCount: function(a, t) { return a + ' / ' + t + ' جوابات دیے گئے'; },
    allAnswered: "تمام سوالوں کا جواب دے دیا گیا۔ جمع کرانے سے پہلے اسکور کا جائزہ لیں۔",
    submitBtn: "تشخیص جمع کریں",
    pleaseAnswerAll: "جمع کرانے سے پہلے براہ کرم تمام 8 سوالوں کا جواب دیں۔",
    resultsTitle: "تشخیص کے نتائج",
    metaAdditive: "اضافی",
    metaLowAdherence: "کم تعمیل",
    metaDominantFailure: "غالب ناکامی",
    interventionLabel: "مداخلت پروٹوکول",
    assessmentRecorded: "تشخیص درج کر لی گئی",
    confidence: { high: "اعلیٰ اعتماد", moderate: "اعتدال پسند اعتماد", low: "کم اعتماد" },
    domainNames: { A: "ڈھانچہ", E: "عمل", C: "سیاق محافظ" },
    modeLabels: { clinical: "طبی", pharmacy: "دوائی خانہ", self: "خود رپورٹ", research: "تحقیق", chw: "کمیونٹی صحت کارکن" },
    questions: [
      { text: "کیا ایسے اوقات ہوتے ہیں جب آپ اپنی دوائیں لینا بھول جاتے ہیں؟", binary: ["ہاں", "نہیں"] },
      { text: "پچھلے دو ہفتوں میں، کیا ایسے اوقات تھے جب آپ نے جان بوجھ کر ایک خوراک چھوڑنے کا انتخاب کیا (مثلاً ضمنی اثرات، لاگت یا بہتر محسوس کرنے کی وجہ سے)؟", binary: ["ہاں", "نہیں"] },
      { text: "پچھلے دو ہفتوں میں، کیا آپ نے اپنے ڈاکٹر کو بتائے بغیر خود خوراک کم کی یا دوائی بند کی، اس لیے کہ یہ آپ کو کیسا محسوس کرا رہی تھی؟", binary: ["ہاں", "نہیں"] },
      { text: "جب آپ کا روزمرہ معمول بدلتا ہے (سفر، مختلف کام کے اوقات، یا گھر سے دور رہنا)، کیا آپ کو اپنی دوائیں لیتے رہنا مشکل لگتا ہے؟", binary: ["ہاں", "نہیں"] },
      { text: "کیا آپ اپنی آخری خوراک ہدایت کے مطابق لے پائے؟", binary: ["ہاں", "نہیں"] },
      { text: "جب آپ بہتر محسوس کرنے لگتے ہیں یا آپ کی علامات بہتر ہوتی ہیں، کیا آپ کبھی اپنی دوائی خود کم کرنے یا روکنے کے بارے میں سوچتے ہیں؟", binary: ["ہاں", "نہیں"] },
      { text: "کیا دوائیوں کا معمول برقرار رکھنا آپ کو روزمرہ زندگی میں ایک بڑا چیلنج لگتا ہے؟", binary: ["ہاں", "نہیں"] },
      { text: "ایک عام ہفتے میں، آپ کو کتنی بار تمام دوائیں تجویز کے مطابق لینے میں دشواری ہوتی ہے؟", ordinal: ["کبھی نہیں", "شاذ و نادر", "کبھی کبھی", "اکثر", "ہمیشہ"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "پرامید بند کرنے والا",          desc: "مریض کافی رویاتی تعمیل ظاہر کرتا ہے لیکن یقین رکھتا ہے کہ دوائی شاید اب ضروری نہیں۔ علامات کا ٹھیک ہونا یا مبینہ شفایابی جان بوجھ کر خوراک کم کرنے کی تحریک دیتی ہے۔", intervention: "مرض کی دائمیت پر تعلیم؛ طویل مدتی اہداف کا اشتراک؛ علاج کے عقائد کا دوبارہ جائزہ؛ منظم فالو اپ۔" },
      'Intentional Resistor': { name: "جان بوجھ کر مزاحمت کرنے والا", desc: "مریض کے عقائد مستقل تعمیل کے خلاف فعال طور پر کام کرتے ہیں۔ عدم تعمیل جان بوجھ کر اور فیصلے پر مبنی ہے۔ ڈھانچے کا ڈومین بنیادی ناکامی ہے۔", intervention: "محرک انٹرویو؛ عقائد کی اشتراکی تشکیل نو؛ ضمنی اثرات اور متبادل نظام پر گفتگو۔" },
      'Routine Forgetter':    { name: "معمول کا بھولنے والا",          desc: "مریض کے کافی عقائد ہیں لیکن روزانہ کے معمول پر مستقل طور پر عمل درآمد کرنے میں ناکام رہتا ہے۔ بھولنا اور غیر مستقل اوقات بنیادی رکاوٹیں ہیں۔", intervention: "رویاتی یاددہانی کی حکمت عملی (الارم، گولی خانے، موجودہ معمولات سے جوڑنا)؛ فارمیسی بلسٹر پیک؛ ڈیجیٹل یاددہانیاں۔" },
      'Situational Skipper':  { name: "صورتحالی چھوڑنے والا",         desc: "ماحولیاتی یا لاجسٹک رکاوٹیں ایک حوصلہ مند مریض کی تعمیل کو متاثر کرتی ہیں۔ رسائی، لاگت یا سماجی سیاق عوامل ہیں۔", intervention: "رکاوٹوں کی نقشہ سازی؛ ادویات تک رسائی کے پروگرام؛ مالی مدد؛ نظام کو آسان بنانا؛ ہم عمر معاونت۔" },
      'Side-Effect Avoider':  { name: "ضمنی اثرات سے بچنے والا",      desc: "مریض کم دوائی عقائد کے ساتھ ماحولیاتی رگڑ اور ضمنی اثرات کی مداخلت کا تجربہ کرتا ہے۔ نمونہ دوائی تجربے سے چلنے والی گریز کے مطابق ہے۔", intervention: "ضمنی اثرات کا جائزہ؛ علامات کے انتظام کی حکمت عملیاں؛ تجویز کنندہ کے ساتھ نظام ترمیم؛ مریض کی تعلیم؛ معاون پروگرام۔" },
      'Balanced Low':         { name: "متوازن طور پر کم",             desc: "مریض ایک غالب ناکامی نمونے کے بغیر تمام تین MAP ڈومینز میں مجموعی طور پر کم تعمیل ظاہر کرتا ہے۔ جامع مداخلت کی نشاندہی ہے۔", intervention: "جامع تعمیل جائزہ؛ عقائد، معمولات اور رکاوٹوں کو متوازی طور پر حل کرنے والی کثیر جزوی مداخلت؛ قریبی نگرانی۔" },
      'Adequate Adherent':    { name: "کافی تعمیل",                   desc_high: "مریض تینوں ڈومینز میں کافی تعمیل ظاہر کرتا ہے۔ PE اسکور بہترین تعمیل صحت کی نشاندہی کرتا ہے۔", desc_moderate: "مریض تینوں ڈومینز میں کافی تعمیل ظاہر کرتا ہے۔ PE اسکور اچھی تعمیل صحت کی نشاندہی کرتا ہے۔", intervention: "موجودہ نظام برقرار رکھیں؛ معمول کے دوروں پر تعمیل رویے کو مضبوط کریں۔ اگلے طبی دورے پر دوبارہ تشخیص کا شیڈول بنائیں۔" },
    },
  },
  bn: {
    formTitle: "MAP মূল্যায়ন",
    formSubtitle: "বহুমাত্রিক আনুগত্য প্যারামিটার",
    scoreLabel_pe: "PE স্কোর",
    scoreLabel_arch: "স্থাপত্য",
    scoreLabel_exec: "কার্যকরণ",
    scoreLabel_ctx: "প্রেক্ষাপট-রক্ষক",
    progressHint: "PE স্কোর লাইভ গণনা করতে সমস্ত ৮টি প্রশ্নের উত্তর দিন",
    progressCount: function(a, t) { return a + ' / ' + t + ' উত্তর দেওয়া হয়েছে'; },
    allAnswered: "সমস্ত প্রশ্নের উত্তর দেওয়া হয়েছে। জমা দেওয়ার আগে স্কোর পর্যালোচনা করুন।",
    submitBtn: "মূল্যায়ন জমা দিন",
    pleaseAnswerAll: "জমা দেওয়ার আগে অনুগ্রহ করে সমস্ত ৮টি প্রশ্নের উত্তর দিন।",
    resultsTitle: "মূল্যায়নের ফলাফল",
    metaAdditive: "যোগাত্মক",
    metaLowAdherence: "কম আনুগত্য",
    metaDominantFailure: "প্রভাবশালী ব্যর্থতা",
    interventionLabel: "হস্তক্ষেপ প্রোটোকল",
    assessmentRecorded: "মূল্যায়ন নথিভুক্ত হয়েছে",
    confidence: { high: "উচ্চ আস্থা", moderate: "মাঝারি আস্থা", low: "কম আস্থা" },
    domainNames: { A: "স্থাপত্য", E: "কার্যকরণ", C: "প্রেক্ষাপট-রক্ষক" },
    modeLabels: { clinical: "ক্লিনিকাল", pharmacy: "ফার্মেসি", self: "স্ব-প্রতিবেদন", research: "গবেষণা", chw: "সামাজিক স্বাস্থ্যকর্মী" },
    questions: [
      { text: "এমন সময় কি হয় যখন আপনি আপনার ওষুধ খেতে ভুলে যান?", binary: ["হ্যাঁ", "না"] },
      { text: "গত দুই সপ্তাহে, এমন সময় কি হয়েছে যখন আপনি একটি ডোজ এড়িয়ে যাওয়ার সিদ্ধান্ত নিয়েছিলেন (যেমন পার্শ্বপ্রতিক্রিয়া, খরচ বা ভালো অনুভব করার কারণে)?", binary: ["হ্যাঁ", "না"] },
      { text: "গত দুই সপ্তাহে, আপনি কি আপনার ডাক্তারকে না জানিয়ে নিজে থেকে ডোজ কমিয়েছেন বা ওষুধ বন্ধ করেছেন, কারণ এটি আপনাকে কেমন অনুভব করাচ্ছিল?", binary: ["হ্যাঁ", "না"] },
      { text: "যখন আপনার দৈনন্দিন রুটিন পরিবর্তন হয় (ভ্রমণ, ভিন্ন কাজের সময় বা বাড়ি থেকে দূরে থাকা), তখন কি আপনার ওষুধ নেওয়া অব্যাহত রাখা কঠিন মনে হয়?", binary: ["হ্যাঁ", "না"] },
      { text: "আপনি কি আপনার শেষ ডোজটি নির্দেশ অনুযায়ী নিতে পেরেছিলেন?", binary: ["হ্যাঁ", "না"] },
      { text: "যখন আপনি ভালো অনুভব করতে শুরু করেন বা আপনার লক্ষণগুলি উন্নত হয়, তখন কি আপনি কখনো নিজে থেকে আপনার ওষুধ কমানো বা বিরতি দেওয়ার কথা ভাবেন?", binary: ["হ্যাঁ", "না"] },
      { text: "আপনার ওষুধের রুটিন বজায় রাখা কি আপনার দৈনন্দিন জীবনে একটি বড় চ্যালেঞ্জ মনে হয়?", binary: ["হ্যাঁ", "না"] },
      { text: "একটি সাধারণ সপ্তাহে, কতবার আপনার নির্ধারিত অনুযায়ী সমস্ত ওষুধ নিতে সমস্যা হয়?", ordinal: ["কখনই না", "কদাচিৎ", "মাঝে মাঝে", "প্রায়ই", "সর্বদা"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "আশাবাদী বন্ধকারী",             desc: "রোগী পর্যাপ্ত আচরণগত আনুগত্য দেখায় কিন্তু বিশ্বাস করে যে ওষুধ আর প্রয়োজন নেই। লক্ষণ উপশম বা অনুভূত নিরাময় ইচ্ছাকৃত ডোজ হ্রাস বা পরিকল্পিত বন্ধের প্রেরণা দেয়।", intervention: "রোগের দীর্ঘস্থায়ীতা সম্পর্কে শিক্ষা; দীর্ঘমেয়াদী লক্ষ্য ভাগাভাগি; চিকিৎসা বিশ্বাসের পুনর্মূল্যায়ন; কাঠামোগত ফলো-আপ।" },
      'Intentional Resistor': { name: "ইচ্ছাকৃত প্রতিরোধী",          desc: "রোগীর বিশ্বাসগুলি সক্রিয়ভাবে ধারাবাহিক আনুগত্যের বিরুদ্ধে কাজ করে। অ-আনুগত্য ইচ্ছাকৃত এবং সিদ্ধান্তভিত্তিক। স্থাপত্য ডোমেন প্রাথমিক ব্যর্থতা।", intervention: "অনুপ্রেরণামূলক সাক্ষাৎকার; বিশ্বাসের সহযোগিতামূলক পুনর্গঠন; পার্শ্বপ্রতিক্রিয়া এবং বিকল্প পদ্ধতির আলোচনা।" },
      'Routine Forgetter':    { name: "নিয়মিত ভুলনেওয়ালা",          desc: "রোগীর পর্যাপ্ত বিশ্বাস আছে কিন্তু ধারাবাহিকভাবে দৈনিক রুটিন সম্পাদনে ব্যর্থ হয়। ভুলে যাওয়া এবং অসঙ্গত সময় প্রাথমিক বাধা।", intervention: "আচরণগত সংকেত কৌশল (অ্যালার্ম, বড়ি বাক্স, বিদ্যমান রুটিনের সাথে যুক্ত করা); ফার্মেসি ব্লিস্টার প্যাক; ডিজিটাল অনুস্মারক।" },
      'Situational Skipper':  { name: "পরিস্থিতিগত এড়িয়ে যাওয়া",   desc: "পরিবেশগত বা লজিস্টিক বাধাগুলি একজন অন্যথায় অনুপ্রাণিত রোগীর আনুগত্যকে বাধা দেয়। প্রবেশাধিকার, খরচ বা সামাজিক প্রেক্ষাপট হল কারণগুলি।", intervention: "বাধা ম্যাপিং; ওষুধ অ্যাক্সেস প্রোগ্রাম; আর্থিক সহায়তা; পদ্ধতি সরলীকরণ; সহকর্মী সমর্থন।" },
      'Side-Effect Avoider':  { name: "পার্শ্বপ্রতিক্রিয়া এড়িয়ে চলা", desc: "রোগী হ্রাসপ্রাপ্ত ওষুধ বিশ্বাসের সাথে পরিবেশগত ঘর্ষণ এবং পার্শ্বপ্রতিক্রিয়া হস্তক্ষেপ অনুভব করে। প্যাটার্নটি ওষুধ অভিজ্ঞতা দ্বারা চালিত পরিহারের সাথে সামঞ্জস্যপূর্ণ।", intervention: "পার্শ্বপ্রতিক্রিয়া পর্যালোচনা; লক্ষণ ব্যবস্থাপনা কৌশল; প্রেসক্রাইবারের সাথে পদ্ধতি পরিবর্তন; রোগী শিক্ষা; সহায়তা কার্যক্রম।" },
      'Balanced Low':         { name: "সুষমভাবে কম",                  desc: "রোগী একটি একক প্রভাবশালী ব্যর্থতার প্যাটার্ন ছাড়াই তিনটি MAP ডোমেন জুড়ে বৈশ্বিকভাবে হ্রাসপ্রাপ্ত আনুগত্য দেখায়। ব্যাপক হস্তক্ষেপ নির্দেশিত।", intervention: "ব্যাপক আনুগত্য পর্যালোচনা; বিশ্বাস, রুটিন এবং বাধাগুলিকে সমান্তরালে সম্বোধনকারী বহু-উপাদান হস্তক্ষেপ; ঘনিষ্ঠ পর্যবেক্ষণ।" },
      'Adequate Adherent':    { name: "পর্যাপ্ত আনুগত্য",             desc_high: "রোগী তিনটি ডোমেনে পর্যাপ্ত আনুগত্য দেখায়। PE স্কোর সর্বোত্তম আনুগত্য স্বাস্থ্য নির্দেশ করে।", desc_moderate: "রোগী তিনটি ডোমেনে পর্যাপ্ত আনুগত্য দেখায়। PE স্কোর ভালো আনুগত্য স্বাস্থ্য নির্দেশ করে।", intervention: "বর্তমান পদ্ধতি বজায় রাখুন; রুটিন পরিদর্শনে আনুগত্য আচরণ শক্তিশালী করুন। পরবর্তী ক্লিনিকাল পরিদর্শনে পুনর্মূল্যায়ন নির্ধারণ করুন।" },
    },
  },

  ja: {
    formTitle: "MAP評価",
    formSubtitle: "多次元服薬遵守パラメータ",
    scoreLabel_pe: "PEスコア",
    scoreLabel_arch: "構造",
    scoreLabel_exec: "実行",
    scoreLabel_ctx: "コンテキスト・ガード",
    progressHint: "すべての8問に回答してPEスコアをリアルタイムで計算してください",
    progressCount: function(a, t) { return a + ' / ' + t + ' 回答済み'; },
    allAnswered: "すべての質問に回答しました。提出前にスコアを確認してください。",
    submitBtn: "評価を提出する",
    pleaseAnswerAll: "提出前にすべての8問に回答してください。",
    resultsTitle: "評価結果",
    metaAdditive: "加算式",
    metaLowAdherence: "低い服薬遵守",
    metaDominantFailure: "主要な問題",
    interventionLabel: "介入プロトコル",
    assessmentRecorded: "評価が記録されました",
    confidence: { high: "高信頼", moderate: "中程度の信頼", low: "低信頼" },
    domainNames: { A: "構造", E: "実行", C: "コンテキスト・ガード" },
    modeLabels: { clinical: "臨床", pharmacy: "薬局", self: "自己申告", research: "研究", chw: "地域保健ワーカー" },
    questions: [
      { text: "薬を飲み忘れることはありますか？", binary: ["はい", "いいえ"] },
      { text: "過去2週間で、意図的に用量を飛ばしたことはありましたか（副作用、費用、または気分が良くなったためなど）？", binary: ["はい", "いいえ"] },
      { text: "過去2週間で、薬があなたの体調に与える影響のため、医師に告げずに自分で用量を減らしたり、薬を止めたりしましたか？", binary: ["はい", "いいえ"] },
      { text: "日常のルーティンが変わったとき（旅行、異なる勤務時間、外出時など）、薬を続けて飲むことが難しいと感じますか？", binary: ["はい", "いいえ"] },
      { text: "最後の用量を指示通りに飲めましたか？", binary: ["はい", "いいえ"] },
      { text: "気分が良くなり始めたり、症状が改善されたりしたとき、自分で薬を減らすか中断しようと思ったことはありますか？", binary: ["はい", "いいえ"] },
      { text: "薬のルーティンを維持することは、日常生活において大きな課題だと感じますか？", binary: ["はい", "いいえ"] },
      { text: "典型的な1週間で、処方された通りにすべての薬を飲むことが難しいのはどのくらいの頻度ですか？", ordinal: ["全くない", "めったにない", "時々ある", "よくある", "常にある"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "楽観的中断者",                   desc: "患者は十分な行動的服薬遵守を示しているが、薬がもはや不要だと信じている。症状の消失または感知された回復が意図的な減量または計画的な中断を引き起こしている。", intervention: "疾患の慢性性に関する教育；長期目標の共有；治療に関する信念の再評価；意図的な中断行動を監視するための構造化フォローアップ。" },
      'Intentional Resistor': { name: "意図的抵抗者",                   desc: "患者は一貫した服薬遵守に積極的に反する信念を持っている。非遵守は意図的かつ決定に基づいており、偶発的または物忘れによるものではない。構造ドメインが主要な問題。", intervention: "薬に関する信念を探る動機付け面接；認識された必要性と懸念の協働的再構成；副作用の議論と必要に応じた代替療法の協議。" },
      'Routine Forgetter':    { name: "ルーティン忘却者",               desc: "患者は薬に関する十分な信念を持っているが、日常のルーティンを一貫して実行できない。物忘れ、不規則なタイミング、覚えることの難しさが主な障壁。", intervention: "行動キュー戦略（アラーム、錠剤ケース、既存のルーティンとの組み合わせ）；薬局発行のブリスターパック；介護者またはデジタルリマインダーの統合。" },
      'Situational Skipper':  { name: "状況的スキッパー",               desc: "環境的、社会的、または物流的な障壁が服薬遵守を中断させる。薬へのアクセス、費用、副作用の干渉、または社会的文脈が動機付けられた患者の服薬を妨げている。", intervention: "障壁マッピングとソーシャルサポートの評価；薬局アクセスプログラム；費用援助ナビゲーション；状況的需要を減らすための療法の簡素化；ピアサポートの連携。" },
      'Side-Effect Avoider':  { name: "副作用回避者",                   desc: "患者は環境的な摩擦（Q4）と副作用または社会的干渉（Q7）の両方を経験し、薬に対する信念が低下している。非遵守のパターンは薬体験による回避に対応している。", intervention: "副作用レビューと症状管理戦略；処方者との療法変更の議論；予期される副作用の管理に関する患者教育；障壁サポートプログラム。" },
      'Balanced Low':         { name: "バランス型低遵守",               desc: "患者は単一の支配的な問題パターンなしに、3つのMAPドメイン全体で全般的に低下した服薬遵守を示している。信念、ルーティン、コンテキストを同時に対処する包括的な介入が適応される。", intervention: "総合的な服薬遵守レビュー；信念、行動ルーティン、環境障壁を並行して対処する多成分介入；密接な監視と初回介入後の再評価。" },
      'Adequate Adherent':    { name: "十分な服薬遵守",                 desc_high: "患者は構造、実行、コンテキスト・ガードの3つのドメインで十分な服薬遵守を示している。PEスコアは最適な服薬遵守の健康状態を示している。", desc_moderate: "患者は3つのドメインで十分な服薬遵守を示している。PEスコアは良好な服薬遵守の健康状態を示している。", intervention: "現在の療法を維持し、定期検診で服薬遵守行動を強化する。次回の臨床受診で再評価を予定する。" },
    },
  },
  ko: {
    formTitle: "MAP 평가",
    formSubtitle: "다차원 복약 순응도 매개변수",
    scoreLabel_pe: "PE 점수",
    scoreLabel_arch: "구조",
    scoreLabel_exec: "실행",
    scoreLabel_ctx: "맥락 수호자",
    progressHint: "PE 점수를 실시간으로 계산하려면 8개 질문 모두에 답하세요",
    progressCount: function(a, t) { return a + ' / ' + t + ' 답변 완료'; },
    allAnswered: "모든 질문에 답변했습니다. 제출하기 전에 점수를 검토하세요.",
    submitBtn: "평가 제출",
    pleaseAnswerAll: "제출하기 전에 모든 8개 질문에 답해주세요.",
    resultsTitle: "평가 결과",
    metaAdditive: "가산적",
    metaLowAdherence: "낮은 순응도",
    metaDominantFailure: "지배적 실패",
    interventionLabel: "중재 프로토콜",
    assessmentRecorded: "평가가 기록되었습니다",
    confidence: { high: "높은 신뢰도", moderate: "중간 신뢰도", low: "낮은 신뢰도" },
    domainNames: { A: "구조", E: "실행", C: "맥락 수호자" },
    modeLabels: { clinical: "임상", pharmacy: "약국", self: "자기 보고", research: "연구", chw: "지역사회 보건 종사자" },
    questions: [
      { text: "약을 복용하는 것을 잊을 때가 있나요?", binary: ["예", "아니오"] },
      { text: "지난 2주 동안 의도적으로 복용량을 건너뛴 적이 있었나요 (예: 부작용, 비용, 또는 더 나아진 느낌)?", binary: ["예", "아니오"] },
      { text: "지난 2주 동안 약이 몸에 미치는 영향 때문에 의사에게 알리지 않고 스스로 복용량을 줄이거나 약을 중단했나요?", binary: ["예", "아니오"] },
      { text: "일상 루틴이 바뀔 때 (여행, 다른 근무 시간, 또는 집에서 떨어져 있을 때), 약 복용을 계속하기 어렵다고 느끼나요?", binary: ["예", "아니오"] },
      { text: "마지막 복용량을 지시대로 복용할 수 있었나요?", binary: ["예", "아니오"] },
      { text: "기분이 나아지거나 증상이 개선될 때, 스스로 약을 줄이거나 중단할 생각을 한 적이 있나요?", binary: ["예", "아니오"] },
      { text: "약 복용 루틴을 유지하는 것이 일상에서 큰 도전으로 느껴지나요?", binary: ["예", "아니오"] },
      { text: "일반적인 주에 처방된 대로 모든 약을 복용하는 데 어려움을 겪는 빈도는 어느 정도인가요?", ordinal: ["전혀 없음", "드물게", "가끔", "자주", "항상"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "낙관적 중단자",                  desc: "환자는 적절한 행동적 순응도를 보이지만 약이 더 이상 필요하지 않다고 믿습니다. 증상 해소나 인식된 치유가 의도적인 용량 감소 또는 계획된 중단을 유발합니다.", intervention: "질병의 만성적 특성에 대한 교육; 장기적인 약물 치료 목적에 관한 공동 목표 설정; 치료 신념 재평가; 의도적인 중단 행동 모니터링을 위한 구조적 추적 관찰." },
      'Intentional Resistor': { name: "의도적 저항자",                  desc: "환자는 일관된 순응도에 적극적으로 반하는 신념을 가지고 있습니다. 비순응은 의도적이고 결정에 기반하며 우연적이거나 망각에 의한 것이 아닙니다. 구조 도메인이 주요 실패입니다.", intervention: "약물 신념을 탐색하는 동기 강화 상담; 인식된 필요성과 우려 사항의 협력적 재구성; 부작용 논의 및 적절한 경우 대체 요법 협상." },
      'Routine Forgetter':    { name: "습관적 망각자",                  desc: "환자는 약에 대한 적절한 신념을 가지고 있지만 일상 루틴 수행에 지속적으로 실패합니다. 망각, 불일치한 시간, 기억의 어려움이 주요 장벽입니다.", intervention: "행동 단서 전략 (알람, 약 케이스, 기존 루틴과의 연결); 약국 발행 블리스터 팩; 보호자 또는 디지털 알림 통합." },
      'Situational Skipper':  { name: "상황적 건너뛰기",               desc: "환경적, 사회적, 또는 물류적 장벽이 순응도를 중단시킵니다. 약에 대한 접근성, 비용, 부작용 간섭 또는 사회적 맥락이 동기 부여된 환자의 복약을 방해합니다.", intervention: "장벽 매핑 및 사회적 지지 평가; 약국 접근 프로그램; 비용 지원 탐색; 상황적 요구를 줄이기 위한 요법 간소화; 동료 지원 연결." },
      'Side-Effect Avoider':  { name: "부작용 회피자",                  desc: "환자는 약에 대한 신념이 낮아진 상태에서 환경적 마찰과 부작용 또는 사회적 간섭을 경험합니다. 비순응 패턴은 약물 경험에 의한 회피에 해당합니다.", intervention: "부작용 검토 및 증상 관리 전략; 처방자와의 요법 수정 논의; 예상되는 부작용 관리에 관한 환자 교육; 장벽 지원 프로그램." },
      'Balanced Low':         { name: "균형적 저순응",                  desc: "환자는 단일 지배적 실패 패턴 없이 세 가지 MAP 도메인 전반에 걸쳐 전반적으로 감소된 순응도를 보입니다. 신념, 루틴 및 맥락을 동시에 다루는 포괄적인 중재가 적응됩니다.", intervention: "전반적인 순응도 검토; 신념, 행동 루틴 및 환경 장벽을 병행하여 다루는 다중 구성 요소 중재; 면밀한 모니터링 및 초기 중재 후 재평가." },
      'Adequate Adherent':    { name: "적절한 순응도",                  desc_high: "환자는 구조, 실행, 맥락 수호자 세 가지 도메인에서 적절한 순응도를 보입니다. PE 점수는 최적의 순응도 건강을 나타냅니다.", desc_moderate: "환자는 세 가지 도메인에서 적절한 순응도를 보입니다. PE 점수는 좋은 순응도 건강을 나타냅니다.", intervention: "현재 요법을 유지하고 정기 방문 시 순응도 행동을 강화합니다. 다음 임상 방문 시 재평가를 예약합니다." },
    },
  },
  zh: {
    formTitle: "MAP评估",
    formSubtitle: "多维服药依从性参数",
    scoreLabel_pe: "PE评分",
    scoreLabel_arch: "架构",
    scoreLabel_exec: "执行",
    scoreLabel_ctx: "情境守护",
    progressHint: "回答全部8道题以实时计算PE评分",
    progressCount: function(a, t) { return a + ' / ' + t + ' 已回答'; },
    allAnswered: "所有问题已回答。提交前请检查评分。",
    submitBtn: "提交评估",
    pleaseAnswerAll: "提交前请回答全部8道题。",
    resultsTitle: "评估结果",
    metaAdditive: "累加型",
    metaLowAdherence: "低依从性",
    metaDominantFailure: "主导性失败",
    interventionLabel: "干预方案",
    assessmentRecorded: "评估已记录",
    confidence: { high: "高置信度", moderate: "中置信度", low: "低置信度" },
    domainNames: { A: "架构", E: "执行", C: "情境守护" },
    modeLabels: { clinical: "临床", pharmacy: "药房", self: "自我报告", research: "科研", chw: "社区卫生工作者" },
    questions: [
      { text: "您有时会忘记服药吗？", binary: ["是", "否"] },
      { text: "在过去两周内，您是否有意跳过某次剂量（例如因为副作用、费用或感觉好转）？", binary: ["是", "否"] },
      { text: "在过去两周内，您是否因药物对您的影响，在未告知医生的情况下自行减少剂量或停药？", binary: ["是", "否"] },
      { text: "当您的日常生活规律发生变化时（如出行、工作时间不同或不在家），您是否觉得很难坚持按时服药？", binary: ["是", "否"] },
      { text: "您的最后一次剂量是否按医嘱服用了？", binary: ["是", "否"] },
      { text: "当您开始感觉好转或症状改善时，您是否会考虑自行减少或暂停服药？", binary: ["是", "否"] },
      { text: "在日常生活中，坚持服药计划对您来说是一个很大的挑战吗？", binary: ["是", "否"] },
      { text: "在典型的一周内，您有多少次在按时服用所有处方药方面遇到困难？", ordinal: ["从不", "很少", "有时", "经常", "总是"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "乐观停药者",                     desc: "患者表现出足够的行为依从性，但认为药物可能不再必要。症状消退或感知康复可能促使其有意减量或计划停药。", intervention: "关于疾病慢性特征的教育；共同制定长期用药目标；重新评估治疗信念；结构化随访以监测有意停药行为。" },
      'Intentional Resistor': { name: "主动抗拒者",                     desc: "患者持有积极抵触持续依从性的信念。不依从是有意且基于决策的，而非偶发或遗忘所致。架构领域是主要失败点。", intervention: "动机性访谈以探索用药信念；协同重构感知必要性和顾虑；副作用讨论及适时的替代方案协商。" },
      'Routine Forgetter':    { name: "习惯性遗忘者",                   desc: "患者对药物的信念充分，但持续未能执行日常服药程序。遗忘、时间不一致及记忆困难是主要障碍。", intervention: "行为提示策略（闹钟、药盒、结合现有习惯）；药房分装盒；看护者或数字提醒整合。" },
      'Situational Skipper':  { name: "情境跳过者",                     desc: "环境、社会或物流障碍打断了原本积极的患者的依从性。药物获取、费用、副作用干扰或社会背景是干扰因素。", intervention: "障碍识别与社会支持评估；药房获取计划；费用援助导航；简化用药方案；同伴支持链接。" },
      'Side-Effect Avoider':  { name: "副作用回避者",                   desc: "患者同时经历环境摩擦与副作用干扰，且用药信念减弱。不依从模式与药物体验驱动的回避行为一致。", intervention: "副作用评估与症状管理策略；与处方者讨论方案调整；针对预期副作用的患者教育；障碍支持计划。" },
      'Balanced Low':         { name: "均衡低依从",                     desc: "患者在三个MAP领域均表现出整体偏低的依从性，无单一主导失败模式。需综合干预同时解决信念、习惯与情境问题。", intervention: "全面依从性回顾；并行解决信念、行为习惯和环境障碍的多成分干预；密切监测与初始干预后再评估。" },
      'Adequate Adherent':    { name: "依从性良好",                     desc_high: "患者在架构、执行和情境守护三个领域均表现出足够的依从性。PE评分显示最佳依从健康状态。", desc_moderate: "患者在三个领域均表现出足够的依从性。PE评分显示良好的依从健康状态。", intervention: "维持当前方案；在例行就诊时强化依从行为。下次临床就诊时安排再评估。" },
    },
  },
  "zh-TW": {
    formTitle: "MAP評估",
    formSubtitle: "多維服藥依從性參數",
    scoreLabel_pe: "PE評分",
    scoreLabel_arch: "架構",
    scoreLabel_exec: "執行",
    scoreLabel_ctx: "情境守護",
    progressHint: "回答全部8道題以即時計算PE評分",
    progressCount: function(a, t) { return a + ' / ' + t + ' 已回答'; },
    allAnswered: "所有問題已回答。提交前請檢查評分。",
    submitBtn: "提交評估",
    pleaseAnswerAll: "提交前請回答全部8道題。",
    resultsTitle: "評估結果",
    metaAdditive: "累加型",
    metaLowAdherence: "低依從性",
    metaDominantFailure: "主導性失敗",
    interventionLabel: "介入方案",
    assessmentRecorded: "評估已記錄",
    confidence: { high: "高可信度", moderate: "中可信度", low: "低可信度" },
    domainNames: { A: "架構", E: "執行", C: "情境守護" },
    modeLabels: { clinical: "臨床", pharmacy: "藥局", self: "自我回報", research: "研究", chw: "社區衛生工作者" },
    questions: [
      { text: "您有時會忘記服藥嗎？", binary: ["是", "否"] },
      { text: "在過去兩週內，您是否有意跳過某次劑量（例如因為副作用、費用或感覺好轉）？", binary: ["是", "否"] },
      { text: "在過去兩週內，您是否因藥物對您的影響，在未告知醫師的情況下自行減少劑量或停藥？", binary: ["是", "否"] },
      { text: "當您的日常生活規律發生變化時（如出行、工作時間不同或不在家），您是否覺得很難堅持按時服藥？", binary: ["是", "否"] },
      { text: "您的最後一次劑量是否按醫囑服用了？", binary: ["是", "否"] },
      { text: "當您開始感覺好轉或症狀改善時，您是否會考慮自行減少或暫停服藥？", binary: ["是", "否"] },
      { text: "在日常生活中，堅持服藥計畫對您來說是一個很大的挑戰嗎？", binary: ["是", "否"] },
      { text: "在典型的一週內，您有多少次在按時服用所有處方藥方面遇到困難？", ordinal: ["從不", "很少", "有時", "經常", "總是"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "樂觀停藥者",                     desc: "患者表現出足夠的行為依從性，但認為藥物可能不再必要。症狀消退或感知康復可能促使其有意減量或計畫停藥。", intervention: "關於疾病慢性特徵的衛教；共同制定長期用藥目標；重新評估治療信念；結構化追蹤以監測有意停藥行為。" },
      'Intentional Resistor': { name: "主動抗拒者",                     desc: "患者持有積極抵觸持續依從性的信念。不依從是有意且基於決策的，而非偶發或遺忘所致。架構領域是主要失敗點。", intervention: "動機性訪談以探索用藥信念；協同重構感知必要性和顧慮；副作用討論及適時的替代方案協商。" },
      'Routine Forgetter':    { name: "習慣性遺忘者",                   desc: "患者對藥物的信念充分，但持續未能執行日常服藥程序。遺忘、時間不一致及記憶困難是主要障礙。", intervention: "行為提示策略（鬧鐘、藥盒、結合現有習慣）；藥局分裝盒；照護者或數位提醒整合。" },
      'Situational Skipper':  { name: "情境跳過者",                     desc: "環境、社會或物流障礙打斷了原本積極的患者的依從性。藥物取得、費用、副作用干擾或社會背景是干擾因素。", intervention: "障礙識別與社會支持評估；藥局取得計畫；費用協助導航；簡化用藥方案；同儕支持連結。" },
      'Side-Effect Avoider':  { name: "副作用回避者",                   desc: "患者同時經歷環境摩擦與副作用干擾，且用藥信念減弱。不依從模式與藥物體驗驅動的回避行為一致。", intervention: "副作用評估與症狀管理策略；與處方者討論方案調整；針對預期副作用的患者衛教；障礙支持計畫。" },
      'Balanced Low':         { name: "均衡低依從",                     desc: "患者在三個MAP領域均表現出整體偏低的依從性，無單一主導失敗模式。需綜合介入同時解決信念、習慣與情境問題。", intervention: "全面依從性回顧；並行解決信念、行為習慣和環境障礙的多成分介入；密切監測與初始介入後再評估。" },
      'Adequate Adherent':    { name: "依從性良好",                     desc_high: "患者在架構、執行和情境守護三個領域均表現出足夠的依從性。PE評分顯示最佳依從健康狀態。", desc_moderate: "患者在三個領域均表現出足夠的依從性。PE評分顯示良好的依從健康狀態。", intervention: "維持目前方案；在例行就診時強化依從行為。下次臨床就診時安排再評估。" },
    },
  },
  vi: {
    formTitle: "Đánh giá MAP",
    formSubtitle: "Thông số Tuân thủ Điều trị Đa chiều",
    scoreLabel_pe: "Điểm PE",
    scoreLabel_arch: "Kiến trúc",
    scoreLabel_exec: "Thực hiện",
    scoreLabel_ctx: "Bảo vệ Ngữ cảnh",
    progressHint: "Trả lời tất cả 8 câu hỏi để tính điểm PE theo thời gian thực",
    progressCount: function(a, t) { return a + ' / ' + t + ' đã trả lời'; },
    allAnswered: "Tất cả câu hỏi đã được trả lời. Xem lại điểm số trước khi gửi.",
    submitBtn: "Gửi đánh giá",
    pleaseAnswerAll: "Vui lòng trả lời tất cả 8 câu hỏi trước khi gửi.",
    resultsTitle: "Kết quả đánh giá",
    metaAdditive: "Cộng gộp",
    metaLowAdherence: "Tuân thủ thấp",
    metaDominantFailure: "Thất bại chủ đạo",
    interventionLabel: "Giao thức Can thiệp",
    assessmentRecorded: "Đánh giá đã được ghi lại",
    confidence: { high: "độ tin cậy cao", moderate: "độ tin cậy trung bình", low: "độ tin cậy thấp" },
    domainNames: { A: "Kiến trúc", E: "Thực hiện", C: "Bảo vệ Ngữ cảnh" },
    modeLabels: { clinical: "Lâm sàng", pharmacy: "Nhà thuốc", self: "Tự báo cáo", research: "Nghiên cứu", chw: "Nhân viên Y tế Cộng đồng" },
    questions: [
      { text: "Có những lúc bạn quên uống thuốc không?", binary: ["Có", "Không"] },
      { text: "Trong hai tuần qua, có lúc nào bạn chủ động bỏ qua một liều thuốc không (ví dụ: vì tác dụng phụ, chi phí hoặc cảm thấy tốt hơn)?", binary: ["Có", "Không"] },
      { text: "Trong hai tuần qua, bạn có tự ý giảm liều hoặc ngừng thuốc mà không báo cho bác sĩ, do tác dụng của thuốc khiến bạn khó chịu không?", binary: ["Có", "Không"] },
      { text: "Khi thói quen hàng ngày của bạn thay đổi (đi du lịch, giờ làm việc khác, hoặc ở xa nhà), bạn có thấy khó duy trì việc uống thuốc không?", binary: ["Có", "Không"] },
      { text: "Bạn có thể uống liều cuối cùng theo đúng hướng dẫn không?", binary: ["Có", "Không"] },
      { text: "Khi bạn bắt đầu cảm thấy tốt hơn hoặc các triệu chứng cải thiện, bạn có bao giờ nghĩ đến việc tự ý giảm hoặc tạm dừng thuốc không?", binary: ["Có", "Không"] },
      { text: "Việc duy trì thói quen uống thuốc có cảm thấy là một thách thức lớn trong cuộc sống hàng ngày của bạn không?", binary: ["Có", "Không"] },
      { text: "Trong một tuần điển hình, bao nhiêu lần bạn gặp khó khăn khi uống tất cả các thuốc theo đơn?", ordinal: ["Không bao giờ", "Hiếm khi", "Đôi khi", "Thường xuyên", "Luôn luôn"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Người Lạc Quan Ngừng Thuốc",     desc: "Bệnh nhân thể hiện hành vi tuân thủ đầy đủ nhưng tin rằng thuốc có thể không còn cần thiết. Triệu chứng thuyên giảm hoặc cảm giác khỏi bệnh thúc đẩy giảm liều có chủ ý hoặc ngừng thuốc có kế hoạch.", intervention: "Giáo dục về tính mãn tính của bệnh; đặt mục tiêu dùng thuốc dài hạn chung; đánh giá lại niềm tin về điều trị; theo dõi có cấu trúc để kiểm soát hành vi ngừng thuốc có chủ ý." },
      'Intentional Resistor': { name: "Người Cố Ý Kháng Cự",           desc: "Bệnh nhân có niềm tin tích cực chống lại việc tuân thủ nhất quán. Không tuân thủ là có chủ ý và dựa trên quyết định, không phải tình cờ hay do quên. Lĩnh vực Kiến trúc là lỗi chính.", intervention: "Phỏng vấn tạo động lực về niềm tin dùng thuốc; tái cấu trúc nhận thức về sự cần thiết và mối lo ngại; thảo luận tác dụng phụ và đàm phán phác đồ thay thế nếu phù hợp." },
      'Routine Forgetter':    { name: "Người Hay Quên Theo Thói Quen",  desc: "Bệnh nhân có niềm tin đầy đủ về thuốc nhưng liên tục thất bại trong việc thực hiện thói quen hàng ngày. Hay quên, thời gian không nhất quán và khó nhớ là những rào cản chính.", intervention: "Chiến lược nhắc nhở hành vi (báo thức, hộp đựng thuốc, kết hợp với thói quen hiện có); gói thuốc từ nhà thuốc; tích hợp nhắc nhở kỹ thuật số hoặc từ người chăm sóc." },
      'Situational Skipper':  { name: "Người Bỏ Thuốc Tình Huống",     desc: "Các rào cản môi trường, xã hội hoặc hậu cần làm gián đoạn sự tuân thủ của bệnh nhân vốn có động lực. Việc tiếp cận thuốc, chi phí, tác dụng phụ hoặc bối cảnh xã hội là các yếu tố.", intervention: "Lập bản đồ rào cản; chương trình tiếp cận nhà thuốc; hỗ trợ chi phí; đơn giản hóa phác đồ; kết nối hỗ trợ từ đồng nghiệp." },
      'Side-Effect Avoider':  { name: "Người Tránh Tác Dụng Phụ",      desc: "Bệnh nhân trải qua cả ma sát môi trường và sự can thiệp của tác dụng phụ cùng với niềm tin về thuốc bị giảm sút. Mô hình không tuân thủ tương ứng với sự né tránh do trải nghiệm với thuốc.", intervention: "Xem xét tác dụng phụ; chiến lược kiểm soát triệu chứng; thảo luận điều chỉnh phác đồ với người kê đơn; giáo dục bệnh nhân; chương trình hỗ trợ rào cản." },
      'Balanced Low':         { name: "Tuân Thủ Thấp Đồng Đều",        desc: "Bệnh nhân thể hiện sự tuân thủ giảm sút toàn diện trên cả ba lĩnh vực MAP mà không có một mô hình lỗi chủ đạo duy nhất. Cần can thiệp toàn diện đồng thời giải quyết niềm tin, thói quen và bối cảnh.", intervention: "Đánh giá toàn diện về tuân thủ; can thiệp đa thành phần giải quyết song song niềm tin, thói quen hành vi và rào cản môi trường; theo dõi chặt chẽ và đánh giá lại sau can thiệp ban đầu." },
      'Adequate Adherent':    { name: "Tuân Thủ Đầy Đủ",               desc_high: "Bệnh nhân thể hiện sự tuân thủ đầy đủ trên ba lĩnh vực. Điểm PE cho thấy sức khỏe tuân thủ tối ưu.", desc_moderate: "Bệnh nhân thể hiện sự tuân thủ đầy đủ trên ba lĩnh vực. Điểm PE cho thấy sức khỏe tuân thủ tốt.", intervention: "Duy trì phác đồ hiện tại; củng cố hành vi tuân thủ trong các lần khám định kỳ. Lên lịch đánh giá lại tại lần khám lâm sàng tiếp theo." },
    },
  },
  id: {
    formTitle: "Penilaian MAP",
    formSubtitle: "Parameter Kepatuhan Multidimensional",
    scoreLabel_pe: "Skor PE",
    scoreLabel_arch: "Arsitektur",
    scoreLabel_exec: "Eksekusi",
    scoreLabel_ctx: "Penjaga Konteks",
    progressHint: "Jawab semua 8 pertanyaan untuk menghitung skor PE secara langsung",
    progressCount: function(a, t) { return a + ' / ' + t + ' terjawab'; },
    allAnswered: "Semua pertanyaan telah dijawab. Tinjau skor sebelum mengirim.",
    submitBtn: "Kirim penilaian",
    pleaseAnswerAll: "Harap jawab semua 8 pertanyaan sebelum mengirim.",
    resultsTitle: "Hasil Penilaian",
    metaAdditive: "Aditif",
    metaLowAdherence: "Kepatuhan rendah",
    metaDominantFailure: "Kegagalan dominan",
    interventionLabel: "Protokol Intervensi",
    assessmentRecorded: "Penilaian tercatat",
    confidence: { high: "kepercayaan tinggi", moderate: "kepercayaan sedang", low: "kepercayaan rendah" },
    domainNames: { A: "Arsitektur", E: "Eksekusi", C: "Penjaga Konteks" },
    modeLabels: { clinical: "Klinis", pharmacy: "Apotek", self: "Laporan Diri", research: "Penelitian", chw: "Pekerja Kesehatan Masyarakat" },
    questions: [
      { text: "Apakah ada saat-saat ketika Anda lupa minum obat?", binary: ["Ya", "Tidak"] },
      { text: "Dalam dua minggu terakhir, apakah ada saat Anda memilih untuk melewatkan dosis (misalnya karena efek samping, biaya, atau merasa lebih baik)?", binary: ["Ya", "Tidak"] },
      { text: "Dalam dua minggu terakhir, apakah Anda mengurangi dosis atau menghentikan obat sendiri tanpa memberi tahu dokter, karena efeknya pada Anda?", binary: ["Ya", "Tidak"] },
      { text: "Ketika rutinitas harian Anda berubah (misalnya bepergian, jam kerja berbeda, atau tidak di rumah), apakah sulit bagi Anda untuk tetap meminum obat?", binary: ["Ya", "Tidak"] },
      { text: "Apakah Anda dapat meminum dosis terakhir sesuai petunjuk?", binary: ["Ya", "Tidak"] },
      { text: "Ketika Anda mulai merasa lebih baik atau gejala membaik, apakah Anda pernah berpikir untuk mengurangi atau menghentikan obat sendiri?", binary: ["Ya", "Tidak"] },
      { text: "Apakah menjaga rutinitas obat terasa sebagai tantangan besar dalam kehidupan sehari-hari Anda?", binary: ["Ya", "Tidak"] },
      { text: "Dalam seminggu yang khas, seberapa sering Anda kesulitan meminum semua obat sesuai resep?", ordinal: ["Tidak pernah", "Jarang", "Kadang-kadang", "Sering", "Selalu"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Penghenti Optimis",              desc: "Pasien menunjukkan kepatuhan perilaku yang memadai tetapi percaya obat mungkin tidak lagi diperlukan. Berkurangnya gejala atau penyembuhan yang dirasakan mendorong pengurangan dosis yang disengaja.", intervention: "Edukasi tentang kronisitas penyakit; penetapan tujuan bersama untuk tujuan obat jangka panjang; evaluasi ulang keyakinan pengobatan; tindak lanjut terstruktur." },
      'Intentional Resistor': { name: "Penolak Disengaja",              desc: "Pasien memiliki keyakinan yang secara aktif bertentangan dengan kepatuhan yang konsisten. Ketidakpatuhan disengaja dan berbasis keputusan. Domain Arsitektur adalah kegagalan utama.", intervention: "Wawancara motivasi; reframing kolaboratif keyakinan; diskusi efek samping dan negosiasi rejimen alternatif bila sesuai." },
      'Routine Forgetter':    { name: "Pelupa Rutin",                   desc: "Pasien memiliki keyakinan yang memadai tetapi secara konsisten gagal menjalankan rutinitas harian. Kelupaan dan jadwal yang tidak konsisten adalah hambatan utama.", intervention: "Strategi pengingat perilaku (alarm, kotak pil, menghubungkan dengan rutinitas yang ada); paket blistering apotek; integrasi pengingat digital." },
      'Situational Skipper':  { name: "Pelompat Situasional",           desc: "Hambatan lingkungan atau logistik mengganggu kepatuhan pasien yang termotivasi. Akses obat, biaya, gangguan efek samping, atau konteks sosial mengganggu pasien yang termotivasi.", intervention: "Pemetaan hambatan; program akses apotek; navigasi bantuan biaya; penyederhanaan rejimen; hubungan dukungan sebaya." },
      'Side-Effect Avoider':  { name: "Penghindari Efek Samping",       desc: "Pasien mengalami gesekan lingkungan dan gangguan efek samping bersamaan dengan keyakinan obat yang berkurang. Pola sesuai dengan penghindaran yang didorong pengalaman obat.", intervention: "Tinjauan efek samping; strategi manajemen gejala; modifikasi rejimen dengan dokter penulis resep; edukasi pasien; program dukungan hambatan." },
      'Balanced Low':         { name: "Rendah Seimbang",                desc: "Pasien menunjukkan kepatuhan yang berkurang secara global di ketiga domain MAP tanpa pola kegagalan dominan tunggal. Intervensi komprehensif diindikasikan.", intervention: "Tinjauan kepatuhan menyeluruh; intervensi multi-komponen yang mengatasi keyakinan, rutinitas perilaku, dan hambatan lingkungan secara paralel; pemantauan ketat dan penilaian ulang." },
      'Adequate Adherent':    { name: "Kepatuhan Memadai",              desc_high: "Pasien menunjukkan kepatuhan memadai di tiga domain. Skor PE menunjukkan kesehatan kepatuhan optimal.", desc_moderate: "Pasien menunjukkan kepatuhan memadai di tiga domain. Skor PE menunjukkan kesehatan kepatuhan yang baik.", intervention: "Pertahankan rejimen saat ini; perkuat perilaku kepatuhan pada kunjungan rutin. Jadwalkan penilaian ulang pada kunjungan klinis berikutnya." },
    },
  },
  ms: {
    formTitle: "Penilaian MAP",
    formSubtitle: "Parameter Pematuhan Pelbagai Dimensi",
    scoreLabel_pe: "Skor PE",
    scoreLabel_arch: "Seni Bina",
    scoreLabel_exec: "Pelaksanaan",
    scoreLabel_ctx: "Pengawal Konteks",
    progressHint: "Jawab semua 8 soalan untuk mengira skor PE secara langsung",
    progressCount: function(a, t) { return a + ' / ' + t + ' dijawab'; },
    allAnswered: "Semua soalan telah dijawab. Semak skor sebelum menghantar.",
    submitBtn: "Hantar penilaian",
    pleaseAnswerAll: "Sila jawab semua 8 soalan sebelum menghantar.",
    resultsTitle: "Keputusan Penilaian",
    metaAdditive: "Aditif",
    metaLowAdherence: "Pematuhan rendah",
    metaDominantFailure: "Kegagalan dominan",
    interventionLabel: "Protokol Intervensi",
    assessmentRecorded: "Penilaian telah direkodkan",
    confidence: { high: "keyakinan tinggi", moderate: "keyakinan sederhana", low: "keyakinan rendah" },
    domainNames: { A: "Seni Bina", E: "Pelaksanaan", C: "Pengawal Konteks" },
    modeLabels: { clinical: "Klinikal", pharmacy: "Farmasi", self: "Laporan Diri", research: "Penyelidikan", chw: "Pekerja Kesihatan Komuniti" },
    questions: [
      { text: "Adakah terdapat masa-masa apabila anda terlupa untuk mengambil ubat anda?", binary: ["Ya", "Tidak"] },
      { text: "Dalam dua minggu yang lalu, adakah terdapat masa apabila anda memilih untuk melewatkan dos (contohnya kerana kesan sampingan, kos atau berasa lebih baik)?", binary: ["Ya", "Tidak"] },
      { text: "Dalam dua minggu yang lalu, adakah anda mengurangkan dos atau berhenti mengambil ubat sendiri tanpa memberitahu doktor, kerana kesannya terhadap anda?", binary: ["Ya", "Tidak"] },
      { text: "Apabila rutin harian anda berubah (contohnya perjalanan, waktu kerja berbeza atau tidak di rumah), adakah anda sukar untuk terus mengambil ubat?", binary: ["Ya", "Tidak"] },
      { text: "Adakah anda dapat mengambil dos terakhir anda seperti yang diarahkan?", binary: ["Ya", "Tidak"] },
      { text: "Apabila anda mula berasa lebih baik atau gejala anda bertambah baik, adakah anda pernah terfikir untuk mengurangkan atau berhenti mengambil ubat sendiri?", binary: ["Ya", "Tidak"] },
      { text: "Adakah mengekalkan rutin ubat anda terasa seperti satu cabaran besar dalam kehidupan seharian anda?", binary: ["Ya", "Tidak"] },
      { text: "Dalam seminggu yang biasa, berapa kerapkah anda menghadapi kesukaran untuk mengambil semua ubat anda seperti yang ditetapkan?", ordinal: ["Tidak pernah", "Jarang", "Kadang-kadang", "Kerap", "Sentiasa"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Penghenti Optimis",              desc: "Pesakit menunjukkan pematuhan tingkah laku yang mencukupi tetapi percaya ubat mungkin tidak lagi diperlukan. Penghapusan simptom atau penyembuhan yang dirasakan mendorong pengurangan dos yang disengajakan.", intervention: "Pendidikan tentang kronisiti penyakit; penetapan matlamat bersama jangka panjang; penilaian semula kepercayaan rawatan; susulan berstruktur." },
      'Intentional Resistor': { name: "Penentang Disengajakan",         desc: "Pesakit mempunyai kepercayaan yang secara aktif bertentangan dengan pematuhan yang konsisten. Ketidakpatuhan adalah disengajakan dan berasaskan keputusan. Domain Seni Bina adalah kegagalan utama.", intervention: "Temu bual motivasi; pembingkaian semula kepercayaan secara kolaboratif; perbincangan kesan sampingan dan rejimen alternatif jika sesuai." },
      'Routine Forgetter':    { name: "Pelupa Rutin",                   desc: "Pesakit mempunyai kepercayaan yang mencukupi tetapi secara konsisten gagal melaksanakan rutin harian. Kelupaan dan jadual yang tidak konsisten adalah halangan utama.", intervention: "Strategi isyarat tingkah laku (penggera, kotak pil, menghubungkan dengan rutin sedia ada); pembungkusan farmasi; integrasi peringatan digital." },
      'Situational Skipper':  { name: "Pelangkau Situasi",              desc: "Halangan persekitaran atau logistik mengganggu pematuhan pesakit yang bermotivasi. Akses ubat, kos, gangguan kesan sampingan atau konteks sosial adalah faktor.", intervention: "Pemetaan halangan; program akses farmasi; bantuan kewangan; penyederhanaan rejimen; sokongan rakan sebaya." },
      'Side-Effect Avoider':  { name: "Pengelak Kesan Sampingan",       desc: "Pesakit mengalami geseran persekitaran dan gangguan kesan sampingan bersama kepercayaan ubat yang berkurangan. Corak tidak mematuhi bersesuaian dengan pengelakan yang didorong pengalaman ubat.", intervention: "Semakan kesan sampingan; strategi pengurusan gejala; pengubahsuaian rejimen dengan pengamal yang menetapkan; pendidikan pesakit; program sokongan." },
      'Balanced Low':         { name: "Rendah Seimbang",                desc: "Pesakit menunjukkan pematuhan yang berkurangan secara global merentas tiga domain MAP tanpa corak kegagalan dominan tunggal. Intervensi menyeluruh diperlukan.", intervention: "Semakan pematuhan menyeluruh; intervensi pelbagai komponen yang menangani kepercayaan, rutin tingkah laku dan halangan persekitaran secara selari; pemantauan rapat." },
      'Adequate Adherent':    { name: "Pematuhan Mencukupi",            desc_high: "Pesakit menunjukkan pematuhan yang mencukupi dalam tiga domain. Skor PE menunjukkan kesihatan pematuhan yang optimum.", desc_moderate: "Pesakit menunjukkan pematuhan yang mencukupi dalam tiga domain. Skor PE menunjukkan kesihatan pematuhan yang baik.", intervention: "Kekalkan rejimen semasa; kukuhkan tingkah laku pematuhan pada lawatan rutin. Jadualkan penilaian semula pada lawatan klinikal seterusnya." },
    },
  },
  tl: {
    formTitle: "Pagtatasa ng MAP",
    formSubtitle: "Multidimensyonal na mga Parameter ng Pagsunod sa Gamot",
    scoreLabel_pe: "Puntos PE",
    scoreLabel_arch: "Arkitektura",
    scoreLabel_exec: "Pagpapatupad",
    scoreLabel_ctx: "Tagapagtanggol ng Konteksto",
    progressHint: "Sagutin ang lahat ng 8 katanungan upang makalkula ang puntos PE nang live",
    progressCount: function(a, t) { return a + ' / ' + t + ' nasagot'; },
    allAnswered: "Nasagot na ang lahat ng tanong. Suriin ang mga puntos bago isumite.",
    submitBtn: "Isumite ang pagtatasa",
    pleaseAnswerAll: "Pakisagot ang lahat ng 8 katanungan bago isumite.",
    resultsTitle: "Mga Resulta ng Pagtatasa",
    metaAdditive: "Aditibo",
    metaLowAdherence: "Mababang pagsunod",
    metaDominantFailure: "Dominanteng pagkabigo",
    interventionLabel: "Protokol ng Interbensyon",
    assessmentRecorded: "Naitala ang pagtatasa",
    confidence: { high: "mataas na kumpiyansa", moderate: "katamtamang kumpiyansa", low: "mababang kumpiyansa" },
    domainNames: { A: "Arkitektura", E: "Pagpapatupad", C: "Tagapagtanggol ng Konteksto" },
    modeLabels: { clinical: "Klinika", pharmacy: "Parmasya", self: "Sariling Ulat", research: "Pananaliksik", chw: "Manggagawa sa Kalusugan ng Komunidad" },
    questions: [
      { text: "May mga pagkakataon ba na nakalimutan mo ang pag-inom ng iyong gamot?", binary: ["Oo", "Hindi"] },
      { text: "Sa nakaraang dalawang linggo, may mga pagkakataon ba na pinili mong laktawan ang isang dosis (halimbawa, dahil sa mga side effect, gastos, o pagkaramdam na mas maayos)?", binary: ["Oo", "Hindi"] },
      { text: "Sa nakaraang dalawang linggo, binawasan mo ba ang iyong dosis o tinigilan ang isang gamot nang mag-isa, nang hindi sinabihan ang iyong doktor, dahil sa epekto nito sa iyong pakiramdam?", binary: ["Oo", "Hindi"] },
      { text: "Kapag nagbabago ang iyong pang-araw-araw na gawi (halimbawa, paglalakbay, iba't ibang oras ng trabaho, o pagiging malayo sa bahay), nahihirapan ka bang makasabay sa pag-inom ng iyong gamot?", binary: ["Oo", "Hindi"] },
      { text: "Nakuha mo ba ang iyong huling dosis ayon sa itinuro?", binary: ["Oo", "Hindi"] },
      { text: "Kapag nagsimula kang makaramdam ng mas maayos o bumubuti ang iyong mga sintomas, naiisip mo bang bawasan o itigil ang iyong gamot nang mag-isa?", binary: ["Oo", "Hindi"] },
      { text: "Ang pagpapanatili ng iyong gawi sa gamot ay parang isang malaking hamon ba sa iyong pang-araw-araw na buhay?", binary: ["Oo", "Hindi"] },
      { text: "Sa isang karaniwang linggo, gaano kadalas kang nahihirapang inumin ang lahat ng iyong gamot ayon sa reseta?", ordinal: ["Hindi kailanman", "Bihira", "Minsan", "Madalas", "Palagi"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Optimistang Tumitigil",          desc: "Ang pasyente ay nagpapakita ng sapat na pagsunod sa pag-uugali ngunit naniniwala na ang gamot ay maaaring hindi na kailangan. Ang pagkawala ng mga sintomas o ang nararamdamang paggaling ay nagtutulak ng sadyang pagbabawas ng dosis o planong pagttigil.", intervention: "Edukasyon sa kronikong katangian ng sakit; sama-samang pagtatakda ng pangmatagalang layunin; muling pagsusuri ng mga paniniwala sa paggamot; nakabalangkas na pagsubaybay." },
      'Intentional Resistor': { name: "Sadyang Sumasalungat",           desc: "Ang pasyente ay may mga paniniwala na aktibong lumalaban sa pare-parehong pagsunod. Ang hindi pagsunod ay sadya at batay sa desisyon, hindi aksidental. Ang domain na Arkitektura ang pangunahing kabiguan.", intervention: "Motivasyonal na panayam; kolaboratibong muling pagbabalangkas ng mga paniniwala; talakayan ng mga side effect at negosasyon ng alternatibong regimen kung naaangkop." },
      'Routine Forgetter':    { name: "Nakagawiang Nakalimot",          desc: "Ang pasyente ay may sapat na mga paniniwala ngunit patuloy na nabibigo sa pagpapatupad ng pang-araw-araw na gawi. Ang pagiging malimot at hindi pare-parehong oras ang mga pangunahing hadlang.", intervention: "Mga estratehiya ng paggunita sa pag-uugali (mga alarma, lalagyan ng tableta, pag-uugnay sa mga kasalukuyang gawi); mga pakete ng parmasya; pagsasama ng mga digital na paalala." },
      'Situational Skipper':  { name: "Situasyonal na Lumilaktaw",      desc: "Mga hadlang na pangkapaligiran o logistiko ang nagkakaputol ng pagsunod ng isang pasyenteng may motibasyon. Ang access sa gamot, gastos, o sosyal na konteksto ang mga salik.", intervention: "Pagmamapa ng mga hadlang; mga programa sa pag-access sa parmasya; tulong pinansyal; pagpapasimple ng regimen; pagkonekta sa suporta ng kapwa." },
      'Side-Effect Avoider':  { name: "Umiiwas sa Side Effect",         desc: "Ang pasyente ay nakakaranas ng parehong alitan sa kapaligiran at pakikialam ng side effect na may nabawasang mga paniniwala sa gamot. Ang pattern ay katumbas ng pag-iwas na naudyukan ng karanasan sa gamot.", intervention: "Pagsusuri ng side effect; mga estratehiya sa pamamahala ng sintomas; pagbabago ng regimen sa nagreseta; edukasyon ng pasyente; mga programa ng suporta sa hadlang." },
      'Balanced Low':         { name: "Balanseng Mababa",               desc: "Ang pasyente ay nagpapakita ng pangkalahatang nabawasang pagsunod sa lahat ng tatlong domain ng MAP nang walang iisang nangingibabaw na pattern ng kabiguan. Ipinahiwatig ang komprehensibong interbensyon.", intervention: "Komprehensibong pagsusuri ng pagsunod; multi-component na interbensyon na tumutugon sa mga paniniwala, gawi sa pag-uugali, at mga hadlang sa kapaligiran nang magkatuwang; malapit na pagsubaybay." },
      'Adequate Adherent':    { name: "Sapat na Pagsunod",              desc_high: "Nagpapakita ang pasyente ng sapat na pagsunod sa tatlong domain. Ang puntos PE ay nagpapahiwatig ng pinakamainam na kalusugan ng pagsunod.", desc_moderate: "Nagpapakita ang pasyente ng sapat na pagsunod sa tatlong domain. Ang puntos PE ay nagpapahiwatig ng magandang kalusugan ng pagsunod.", intervention: "Panatilihin ang kasalukuyang regimen; palakasin ang mga gawi sa pagsunod sa mga regular na pagbisita. Mag-iskedyul ng muling pagtatasa sa susunod na klinikalng pagbisita." },
    },
  },
  sw: {
    formTitle: "Tathmini ya MAP",
    formSubtitle: "Vigezo vya Kufuata Dawa vya Pande Nyingi",
    scoreLabel_pe: "Alama PE",
    scoreLabel_arch: "Muundo",
    scoreLabel_exec: "Utekelezaji",
    scoreLabel_ctx: "Mlinda Muktadha",
    progressHint: "Jibu maswali yote 8 ili kuhesabu alama ya PE moja kwa moja",
    progressCount: function(a, t) { return a + ' / ' + t + ' yamejibiwa'; },
    allAnswered: "Maswali yote yamejibiwa. Kagua alama kabla ya kutuma.",
    submitBtn: "Tuma tathmini",
    pleaseAnswerAll: "Tafadhali jibu maswali yote 8 kabla ya kutuma.",
    resultsTitle: "Matokeo ya Tathmini",
    metaAdditive: "Jumla",
    metaLowAdherence: "Kufuata dawa kwa kiwango cha chini",
    metaDominantFailure: "Kushindwa kwa nguvu zaidi",
    interventionLabel: "Itifaki ya Uingiliaji",
    assessmentRecorded: "Tathmini imerekodiwa",
    confidence: { high: "imani ya juu", moderate: "imani ya wastani", low: "imani ya chini" },
    domainNames: { A: "Muundo", E: "Utekelezaji", C: "Mlinda Muktadha" },
    modeLabels: { clinical: "Kliniki", pharmacy: "Duka la dawa", self: "Ripoti ya kibinafsi", research: "Utafiti", chw: "Mfanyakazi wa Afya ya Jamii" },
    questions: [
      { text: "Je, kuna nyakati ambapo unasahau kumeza dawa zako?", binary: ["Ndiyo", "Hapana"] },
      { text: "Katika wiki mbili zilizopita, je, kulikuwa na nyakati ambapo ulichagua kuruka kipimo (kwa mfano, kwa sababu ya madhara, gharama, au kujisikia vizuri zaidi)?", binary: ["Ndiyo", "Hapana"] },
      { text: "Katika wiki mbili zilizopita, je, ulipunguza kipimo chako au kusimamisha dawa peke yako bila kumwambia daktari wako, kwa sababu ya jinsi ilivyokuathiri?", binary: ["Ndiyo", "Hapana"] },
      { text: "Wakati utaratibu wako wa kila siku unabadilika (kwa mfano, kusafiri, masaa tofauti ya kazi, au kuwa mbali na nyumbani), je, ni vigumu kwako kudumu na dawa zako?", binary: ["Ndiyo", "Hapana"] },
      { text: "Je, uliweza kuchukua kipimo chako cha mwisho kama ilivyoelekezwa?", binary: ["Ndiyo", "Hapana"] },
      { text: "Unapoanza kujisikia vizuri au dalili zako zinaboreshwa, je, unafikiria wakati mwingine kupunguza au kusimamisha dawa yako peke yako?", binary: ["Ndiyo", "Hapana"] },
      { text: "Je, kudumisha utaratibu wako wa dawa kunajisikia kama changamoto kubwa katika maisha yako ya kila siku?", binary: ["Ndiyo", "Hapana"] },
      { text: "Katika wiki ya kawaida, mara ngapi una ugumu wa kumeza dawa zako zote kama ilivyoagizwa?", ordinal: ["Kamwe", "Mara chache", "Wakati mwingine", "Mara nyingi", "Kila wakati"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "Msimamishaji Mwenye Matumaini",  desc: "Mgonjwa anaonyesha utiifu wa kitabia wa kutosha lakini anaamini dawa haiweza kuwa muhimu tena. Kupungua kwa dalili au uponyaji unaoonekana kunaendesha kupunguza kipimo kwa makusudi.", intervention: "Elimu kuhusu udumu wa ugonjwa; kuweka malengo ya muda mrefu pamoja; tathmini upya imani za matibabu; ufuatiliaji uliopangwa ili kufuatilia tabia za kusimamisha kwa makusudi." },
      'Intentional Resistor': { name: "Mpinzani wa Makusudi",           desc: "Mgonjwa ana imani zinazopinga kikamilifu utiifu thabiti. Kutotii ni kwa makusudi na kwa msingi wa uamuzi. Uwanja wa Muundo ndiyo kushindwa kwa msingi.", intervention: "Mahojiano ya motisha; kuunda upya imani kwa ushirikiano; mjadala wa madhara na majadiliano ya mpango mbadala inapohitajika." },
      'Routine Forgetter':    { name: "Msahaulifu wa Kawaida",          desc: "Mgonjwa ana imani za kutosha lakini inashindwa mara kwa mara kutekeleza utaratibu wa kila siku. Usahaulifu na nyakati zisizo thabiti ni vikwazo vikuu.", intervention: "Mikakati ya vidokezo vya tabia (kengele, kisanduku cha vidonge, kuunganisha na utaratibu uliopo); vifurushi vya duka la dawa; ujumuishaji wa vikumbusho vya kidijitali." },
      'Situational Skipper':  { name: "Mrukaji wa Hali",                desc: "Vikwazo vya mazingira au usafirishaji vinavyokatiza utiifu wa mgonjwa mwenye motisha. Upatikanaji wa dawa, gharama, kuingiliwa kwa madhara, au muktadha wa kijamii ni mambo yanayoathiri.", intervention: "Ramani ya vikwazo; mipango ya upatikanaji wa dawa za duka; msaada wa kifedha; kurahisisha mpango; muunganisho wa msaada wa wenzao." },
      'Side-Effect Avoider':  { name: "Mwepukaji wa Madhara",           desc: "Mgonjwa hupata msuguano wa mazingira na uingiliaji wa madhara pamoja na imani zilizopungua za dawa. Muundo unalingana na uepukaji unaosababishwa na uzoefu wa dawa.", intervention: "Mapitio ya madhara; mikakati ya usimamizi wa dalili; urekebishaji wa mpango na daktari anayeandika maagizo; elimu ya mgonjwa; mipango ya msaada wa vikwazo." },
      'Balanced Low':         { name: "Chini kwa Usawa",                desc: "Mgonjwa anaonyesha utiifu uliopungua kwa ujumla katika maeneo yote matatu ya MAP bila muundo mmoja wa kushindwa unaotawala. Uingiliaji wa kina unaonyeshwa.", intervention: "Mapitio ya kina ya utiifu; uingiliaji wenye vipengele vingi unaoshughulikia imani, mienendo ya tabia, na vikwazo vya mazingira kwa wakati mmoja; ufuatiliaji wa karibu na tathmini upya." },
      'Adequate Adherent':    { name: "Utiifu wa Kutosha",              desc_high: "Mgonjwa anaonyesha utiifu wa kutosha katika maeneo matatu. Alama ya PE inaonyesha afya bora ya utiifu.", desc_moderate: "Mgonjwa anaonyesha utiifu wa kutosha katika maeneo matatu. Alama ya PE inaonyesha afya nzuri ya utiifu.", intervention: "Dumisha mpango wa sasa; imarisha tabia za utiifu katika ziara za kawaida. Panga tathmini upya katika ziara ya kliniki inayofuata." },
    },
  },
  pa: {
    formTitle: "MAP ਮੁਲਾਂਕਣ",
    formSubtitle: "ਬਹੁ-ਆਯਾਮੀ ਪਾਲਣਾ ਪੈਰਾਮੀਟਰ",
    scoreLabel_pe: "PE ਸਕੋਰ",
    scoreLabel_arch: "ਬਣਤਰ",
    scoreLabel_exec: "ਅਮਲ",
    scoreLabel_ctx: "ਸੰਦਰਭ-ਰੱਖਿਅਕ",
    progressHint: "PE ਸਕੋਰ ਲਾਈਵ ਗਣਨਾ ਕਰਨ ਲਈ ਸਾਰੇ 8 ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦਿਓ",
    progressCount: function(a, t) { return a + ' / ' + t + ' ਜਵਾਬ ਦਿੱਤੇ'; },
    allAnswered: "ਸਾਰੇ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦਿੱਤੇ ਗਏ। ਜਮ੍ਹਾਂ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਸਕੋਰ ਦੀ ਸਮੀਖਿਆ ਕਰੋ।",
    submitBtn: "ਮੁਲਾਂਕਣ ਜਮ੍ਹਾਂ ਕਰੋ",
    pleaseAnswerAll: "ਜਮ੍ਹਾਂ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਕਿਰਪਾ ਕਰਕੇ ਸਾਰੇ 8 ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦਿਓ।",
    resultsTitle: "ਮੁਲਾਂਕਣ ਨਤੀਜੇ",
    metaAdditive: "ਜੋੜਾਤਮਕ",
    metaLowAdherence: "ਘੱਟ ਪਾਲਣਾ",
    metaDominantFailure: "ਪ੍ਰਮੁੱਖ ਅਸਫਲਤਾ",
    interventionLabel: "ਦਖਲ ਪ੍ਰੋਟੋਕੋਲ",
    assessmentRecorded: "ਮੁਲਾਂਕਣ ਦਰਜ ਕੀਤਾ ਗਿਆ",
    confidence: { high: "ਉੱਚ ਭਰੋਸਾ", moderate: "ਦਰਮਿਆਨਾ ਭਰੋਸਾ", low: "ਘੱਟ ਭਰੋਸਾ" },
    domainNames: { A: "ਬਣਤਰ", E: "ਅਮਲ", C: "ਸੰਦਰਭ-ਰੱਖਿਅਕ" },
    modeLabels: { clinical: "ਕਲੀਨਿਕਲ", pharmacy: "ਫਾਰਮੇਸੀ", self: "ਸਵੈ-ਰਿਪੋਰਟ", research: "ਖੋਜ", chw: "ਕਮਿਊਨਿਟੀ ਸਿਹਤ ਕਰਮਚਾਰੀ" },
    questions: [
      { text: "ਕੀ ਅਜਿਹੇ ਸਮੇਂ ਹੁੰਦੇ ਹਨ ਜਦੋਂ ਤੁਸੀਂ ਆਪਣੀਆਂ ਦਵਾਈਆਂ ਲੈਣਾ ਭੁੱਲ ਜਾਂਦੇ ਹੋ?", binary: ["ਹਾਂ", "ਨਹੀਂ"] },
      { text: "ਪਿਛਲੇ ਦੋ ਹਫ਼ਤਿਆਂ ਵਿੱਚ, ਕੀ ਅਜਿਹੇ ਸਮੇਂ ਸਨ ਜਦੋਂ ਤੁਸੀਂ ਜਾਣ-ਬੁੱਝ ਕੇ ਇੱਕ ਖੁਰਾਕ ਛੱਡੀ (ਉਦਾਹਰਨ ਵਜੋਂ, ਮਾੜੇ ਪ੍ਰਭਾਵਾਂ, ਖਰਚੇ ਜਾਂ ਬਿਹਤਰ ਮਹਿਸੂਸ ਕਰਨ ਕਾਰਨ)?", binary: ["ਹਾਂ", "ਨਹੀਂ"] },
      { text: "ਪਿਛਲੇ ਦੋ ਹਫ਼ਤਿਆਂ ਵਿੱਚ, ਕੀ ਤੁਸੀਂ ਆਪਣੇ ਡਾਕਟਰ ਜਾਂ ਦੇਖਭਾਲ ਟੀਮ ਨੂੰ ਦੱਸੇ ਬਿਨਾਂ ਖੁਦ ਖੁਰਾਕ ਘੱਟ ਕੀਤੀ ਜਾਂ ਦਵਾਈ ਬੰਦ ਕੀਤੀ, ਕਿਉਂਕਿ ਇਹ ਤੁਹਾਨੂੰ ਬੁਰਾ ਮਹਿਸੂਸ ਕਰਾ ਰਹੀ ਸੀ?", binary: ["ਹਾਂ", "ਨਹੀਂ"] },
      { text: "ਜਦੋਂ ਤੁਹਾਡੀ ਰੋਜ਼ਾਨਾ ਰੁਟੀਨ ਬਦਲਦੀ ਹੈ (ਉਦਾਹਰਨ ਵਜੋਂ, ਯਾਤਰਾ ਕਰਨ, ਵੱਖਰੇ ਸਮੇਂ ਕੰਮ ਕਰਨ ਜਾਂ ਘਰ ਤੋਂ ਦੂਰ ਰਹਿਣ ਵੇਲੇ), ਕੀ ਤੁਹਾਨੂੰ ਆਪਣੀਆਂ ਦਵਾਈਆਂ ਨਾਲ ਕਾਇਮ ਰਹਿਣਾ ਔਖਾ ਲੱਗਦਾ ਹੈ?", binary: ["ਹਾਂ", "ਨਹੀਂ"] },
      { text: "ਕੀ ਤੁਸੀਂ ਆਪਣੀ ਆਖਰੀ ਖੁਰਾਕ ਨਿਰਦੇਸ਼ ਅਨੁਸਾਰ ਲੈ ਸਕੇ?", binary: ["ਹਾਂ", "ਨਹੀਂ"] },
      { text: "ਜਦੋਂ ਤੁਸੀਂ ਬਿਹਤਰ ਮਹਿਸੂਸ ਕਰਨ ਲੱਗਦੇ ਹੋ ਜਾਂ ਤੁਹਾਡੇ ਲੱਛਣ ਘੱਟ ਜਾਂਦੇ ਹਨ, ਕੀ ਤੁਸੀਂ ਕਦੇ ਆਪਣੀ ਦਵਾਈ ਆਪਣੇ ਆਪ ਘੱਟ ਕਰਨ ਜਾਂ ਰੋਕਣ ਬਾਰੇ ਸੋਚਦੇ ਹੋ?", binary: ["ਹਾਂ", "ਨਹੀਂ"] },
      { text: "ਕੀ ਆਪਣੀ ਦਵਾਈ ਦੀ ਰੁਟੀਨ ਨਾਲ ਕਾਇਮ ਰਹਿਣਾ ਤੁਹਾਡੀ ਰੋਜ਼ਾਨਾ ਜ਼ਿੰਦਗੀ ਵਿੱਚ ਇੱਕ ਵੱਡੀ ਚੁਣੌਤੀ ਵਰਗਾ ਲੱਗਦਾ ਹੈ?", binary: ["ਹਾਂ", "ਨਹੀਂ"] },
      { text: "ਇੱਕ ਆਮ ਹਫ਼ਤੇ ਵਿੱਚ, ਤੁਹਾਨੂੰ ਕਿੰਨੀ ਵਾਰ ਆਪਣੀਆਂ ਸਾਰੀਆਂ ਦਵਾਈਆਂ ਨਿਰਦੇਸ਼ ਅਨੁਸਾਰ ਲੈਣ ਵਿੱਚ ਮੁਸ਼ਕਲ ਆਉਂਦੀ ਹੈ?", ordinal: ["ਕਦੇ ਨਹੀਂ", "ਬਹੁਤ ਘੱਟ", "ਕਦੇ-ਕਦੇ", "ਅਕਸਰ", "ਹਮੇਸ਼ਾ"] },
    ],
    phenotypes: {
      'Optimistic Stopper':   { name: "ਆਸ਼ਾਵਾਦੀ ਬੰਦ ਕਰਨ ਵਾਲਾ",       desc: "ਰੋਗੀ ਚੰਗੀ ਵਿਵਹਾਰਕ ਪਾਲਣਾ ਦਿਖਾਉਂਦਾ ਹੈ ਪਰ ਸੋਚਦਾ ਹੈ ਕਿ ਦਵਾਈ ਹੁਣ ਜ਼ਰੂਰੀ ਨਹੀਂ। ਲੱਛਣਾਂ ਦਾ ਠੀਕ ਹੋਣਾ ਜਾਂ ਸਮਝੀ ਗਈ ਚੰਗਾਈ ਜਾਣ-ਬੁੱਝ ਕੇ ਖੁਰਾਕ ਘੱਟ ਕਰਨ ਜਾਂ ਬੰਦ ਕਰਨ ਦੀ ਪ੍ਰੇਰਣਾ ਦਿੰਦੀ ਹੈ।", intervention: "ਬਿਮਾਰੀ ਦੀ ਲੰਮੇ ਸਮੇਂ ਦੀ ਪ੍ਰਕਿਰਤੀ ਬਾਰੇ ਸਿੱਖਿਆ; ਲੰਮੇ ਸਮੇਂ ਦੇ ਟੀਚੇ ਸਾਂਝੇ ਕਰਨਾ; ਇਲਾਜ ਵਿਸ਼ਵਾਸਾਂ ਦਾ ਦੁਬਾਰਾ ਮੁਲਾਂਕਣ; ਨਿਯਮਤ ਫਾਲੋ-ਅੱਪ।" },
      'Intentional Resistor': { name: "ਜਾਣ-ਬੁੱਝ ਕੇ ਵਿਰੋਧ ਕਰਨ ਵਾਲਾ", desc: "ਰੋਗੀ ਦੇ ਵਿਸ਼ਵਾਸ ਨਿਰੰਤਰ ਪਾਲਣਾ ਦੇ ਵਿਰੁੱਧ ਕੰਮ ਕਰਦੇ ਹਨ। ਅਪਾਲਣਾ ਜਾਣ-ਬੁੱਝ ਕੇ ਅਤੇ ਫੈਸਲੇ 'ਤੇ ਆਧਾਰਿਤ ਹੈ। ਬਣਤਰ ਡੋਮੇਨ ਮੁੱਖ ਅਸਫਲਤਾ ਹੈ।", intervention: "ਪ੍ਰੇਰਕ ਇੰਟਰਵਿਊ; ਵਿਸ਼ਵਾਸਾਂ ਦਾ ਸਹਿਯੋਗੀ ਪੁਨਰਗਠਨ; ਮਾੜੇ ਪ੍ਰਭਾਵਾਂ ਬਾਰੇ ਚਰਚਾ ਅਤੇ ਵਿਕਲਪਕ ਨਿਯਮ।" },
      'Routine Forgetter':    { name: "ਰੁਟੀਨ ਵਿੱਚ ਭੁੱਲਣ ਵਾਲਾ",      desc: "ਰੋਗੀ ਦੇ ਚੰਗੇ ਵਿਸ਼ਵਾਸ ਹਨ ਪਰ ਰੋਜ਼ਾਨਾ ਰੁਟੀਨ 'ਤੇ ਅਮਲ ਕਰਨ ਵਿੱਚ ਲਗਾਤਾਰ ਅਸਫਲ ਰਹਿੰਦਾ ਹੈ। ਭੁੱਲਣਾ ਅਤੇ ਅਸੰਗਤ ਸਮਾਂ ਮੁੱਖ ਰੁਕਾਵਟਾਂ ਹਨ।", intervention: "ਵਿਵਹਾਰਕ ਯਾਦ-ਦਹਾਨੀ ਰਣਨੀਤੀਆਂ (ਅਲਾਰਮ, ਦਵਾਈ ਡੱਬੇ, ਮੌਜੂਦਾ ਰੁਟੀਨ ਨਾਲ ਜੋੜਨਾ); ਫਾਰਮੇਸੀ ਬਲਿਸਟਰ ਪੈਕ; ਡਿਜ਼ੀਟਲ ਯਾਦ-ਦਹਾਨੀਆਂ।" },
      'Situational Skipper':  { name: "ਸਥਿਤੀ ਅਨੁਸਾਰ ਛੱਡਣ ਵਾਲਾ",   desc: "ਵਾਤਾਵਰਣ ਜਾਂ ਲੌਜਿਸਟਿਕ ਰੁਕਾਵਟਾਂ ਇੱਕ ਪ੍ਰੇਰਿਤ ਰੋਗੀ ਦੀ ਪਾਲਣਾ ਵਿੱਚ ਵਿਘਨ ਪਾਉਂਦੀਆਂ ਹਨ। ਪਹੁੰਚ, ਖਰਚਾ ਜਾਂ ਸਮਾਜਿਕ ਸੰਦਰਭ ਕਾਰਕ ਹਨ।", intervention: "ਰੁਕਾਵਟਾਂ ਦੀ ਮੈਪਿੰਗ; ਦਵਾਈ ਪਹੁੰਚ ਪ੍ਰੋਗਰਾਮ; ਵਿੱਤੀ ਸਹਾਇਤਾ; ਨਿਯਮ ਸਰਲੀਕਰਨ; ਸਾਥੀ ਸਹਾਇਤਾ।" },
      'Side-Effect Avoider':  { name: "ਮਾੜੇ ਪ੍ਰਭਾਵਾਂ ਤੋਂ ਬਚਣ ਵਾਲਾ", desc: "ਰੋਗੀ ਘੱਟ ਦਵਾਈ ਵਿਸ਼ਵਾਸਾਂ ਦੇ ਨਾਲ ਵਾਤਾਵਰਣਕ ਰੁਕਾਵਟ ਅਤੇ ਮਾੜੇ ਪ੍ਰਭਾਵਾਂ ਦੀ ਦਖਲਅੰਦਾਜ਼ੀ ਦਾ ਅਨੁਭਵ ਕਰਦਾ ਹੈ। ਪੈਟਰਨ ਦਵਾਈ ਅਨੁਭਵ ਤੋਂ ਚਲਾਈ ਗਈ ਬਚਣ ਦੀ ਪ੍ਰਵਿਰਤੀ ਨਾਲ ਮੇਲ ਖਾਂਦਾ ਹੈ।", intervention: "ਮਾੜੇ ਪ੍ਰਭਾਵਾਂ ਦੀ ਸਮੀਖਿਆ; ਲੱਛਣ ਪ੍ਰਬੰਧਨ ਰਣਨੀਤੀਆਂ; ਨੁਸਖ਼ਾ ਦੇਣ ਵਾਲੇ ਨਾਲ ਨਿਯਮ ਸੋਧ; ਰੋਗੀ ਸਿੱਖਿਆ; ਸਹਾਇਤਾ ਪ੍ਰੋਗਰਾਮ।" },
      'Balanced Low':         { name: "ਸੰਤੁਲਿਤ ਘੱਟ",                desc: "ਰੋਗੀ ਕਿਸੇ ਇੱਕ ਪ੍ਰਮੁੱਖ ਅਸਫਲਤਾ ਪੈਟਰਨ ਤੋਂ ਬਿਨਾਂ ਤਿੰਨੋਂ MAP ਡੋਮੇਨਾਂ ਵਿੱਚ ਸਮੁੱਚੇ ਤੌਰ 'ਤੇ ਘੱਟ ਪਾਲਣਾ ਦਿਖਾਉਂਦਾ ਹੈ। ਵਿਆਪਕ ਦਖਲ ਦਰਸਾਇਆ ਗਿਆ ਹੈ।", intervention: "ਵਿਆਪਕ ਪਾਲਣਾ ਸਮੀਖਿਆ; ਵਿਸ਼ਵਾਸਾਂ, ਵਿਵਹਾਰਕ ਰੁਟੀਨਾਂ ਅਤੇ ਵਾਤਾਵਰਣਕ ਰੁਕਾਵਟਾਂ ਨੂੰ ਸਮਾਨਾਂਤਰ ਵਿੱਚ ਹੱਲ ਕਰਨ ਵਾਲਾ ਬਹੁ-ਹਿੱਸੇ ਦਖਲ; ਨਜ਼ਦੀਕੀ ਨਿਗਰਾਨੀ।" },
      'Adequate Adherent':    { name: "ਉਚਿਤ ਪਾਲਣਾ",                  desc_high: "ਰੋਗੀ ਬਣਤਰ, ਅਮਲ ਅਤੇ ਸੰਦਰਭ-ਰੱਖਿਅਕ ਡੋਮੇਨਾਂ ਵਿੱਚ ਉਚਿਤ ਪਾਲਣਾ ਦਿਖਾਉਂਦਾ ਹੈ। PE ਸਕੋਰ ਸਰਵੋਤਮ ਪਾਲਣਾ ਸਿਹਤ ਦਰਸਾਉਂਦਾ ਹੈ।", desc_moderate: "ਰੋਗੀ ਬਣਤਰ, ਅਮਲ ਅਤੇ ਸੰਦਰਭ-ਰੱਖਿਅਕ ਡੋਮੇਨਾਂ ਵਿੱਚ ਉਚਿਤ ਪਾਲਣਾ ਦਿਖਾਉਂਦਾ ਹੈ। PE ਸਕੋਰ ਚੰਗੀ ਪਾਲਣਾ ਸਿਹਤ ਦਰਸਾਉਂਦਾ ਹੈ।", intervention: "ਮੌਜੂਦਾ ਨਿਯਮ ਕਾਇਮ ਰੱਖੋ; ਨਿਯਮਤ ਫੇਰਿਆਂ ਵਿੱਚ ਪਾਲਣਾ ਵਿਵਹਾਰ ਨੂੰ ਮਜ਼ਬੂਤ ਕਰੋ। ਅਗਲੀ ਕਲੀਨਿਕਲ ਫੇਰੀ 'ਤੇ ਦੁਬਾਰਾ ਮੁਲਾਂਕਣ ਨਿਰਧਾਰਿਤ ਕਰੋ।" },
    },
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// scoreMAP(responses)
// Pure function. Takes array of 8 values [q1..q8].
// Q1-Q7: binary adherent=1, non-adherent=0
// Q8: ordinal value (Never=1.00, Rarely=0.75, Sometimes=0.50, Often=0.25, All_the_time=0.00)
// Returns triadic score object.
// ══════════════════════════════════════════════════════════════════════════════
function scoreMAP(responses) {
  if (!Array.isArray(responses) || responses.length < 8) {
    throw new Error('scoreMAP: requires array of 8 responses [q1..q8]');
  }

  var q1 = parseFloat(responses[0]);
  var q2 = parseFloat(responses[1]);
  var q3 = parseFloat(responses[2]);
  var q4 = parseFloat(responses[3]);
  var q5 = parseFloat(responses[4]);
  var q6 = parseFloat(responses[5]);
  var q7 = parseFloat(responses[6]);
  var q8 = parseFloat(responses[7]);

  // Validate inputs
  [q1,q2,q3,q4,q5,q6,q7].forEach(function(v, i) {
    if (isNaN(v) || v < 0 || v > 1) {
      throw new Error('scoreMAP: Q' + (i+1) + ' must be 0 or 1, got: ' + responses[i]);
    }
  });
  if (isNaN(q8) || q8 < 0 || q8 > 1) {
    throw new Error('scoreMAP: Q8 must be 0-1 ordinal value, got: ' + responses[7]);
  }

  // Domain means
  // Architecture (A) = mean(Q2, Q3, Q6)
  var architecture = (q2 + q3 + q6) / 3;

  // Execution (E) = mean(Q1, Q5, Q8)
  var execution = (q1 + q5 + q8) / 3;

  // Context-Guard (Cg) = 0.5 + 0.5 * mean(Q4, Q7), floored at 0.5
  var ctx_raw = (q4 + q7) / 2;
  var context_guard = Math.max(0.5, 0.5 + 0.5 * ctx_raw);

  // PE score = geometric mean of the three domains
  var pe = Math.pow(architecture * execution * context_guard, 1/3);

  // Additive score: sum of all 8 items (0-8 scale)
  var additive = q1 + q2 + q3 + q4 + q5 + q6 + q7 + q8;

  var low_adherence = additive < 6;

  // Dominant failure = whichever domain is lowest
  var domains = { architecture: architecture, execution: execution, context_guard: context_guard };
  var dominant_failure = Object.keys(domains).reduce(function(min, key) {
    return domains[key] < domains[min] ? key : min;
  });

  // If all domains are equal (balanced), mark context_guard as dominant only if truly low;
  // otherwise default to architecture as intervention priority
  if (domains.architecture === domains.execution && domains.execution === domains.context_guard) {
    dominant_failure = low_adherence ? 'architecture' : 'balanced';
  }

  return {
    pe:               parseFloat(pe.toFixed(4)),
    architecture:     parseFloat(architecture.toFixed(4)),
    execution:        parseFloat(execution.toFixed(4)),
    context_guard:    parseFloat(context_guard.toFixed(4)),
    ctx_raw:          parseFloat(ctx_raw.toFixed(4)),
    additive:         parseFloat(additive.toFixed(2)),
    low_adherence:    low_adherence,
    dominant_failure: dominant_failure === 'balanced' ? 'balanced' : dominant_failure,
    intervention_target: MAP_INTERVENTION_TARGETS[dominant_failure] ||
                         MAP_INTERVENTION_TARGETS['architecture'],
    items: { q1:q1, q2:q2, q3:q3, q4:q4, q5:q5, q6:q6, q7:q7, q8:q8 },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// classifyPEACS(mapResult)
// Takes scoreMAP output, returns PEACS phenotype classification.
//
// Classification logic (order matters — evaluated top to bottom):
//   Optimistic Stopper:   Architecture < 0.5 AND additive >= 5 (was adherent, stopping)
//   Intentional Resistor: Architecture < 0.5 AND architecture is the minimum domain
//   Routine Forgetter:    Execution < 0.5 AND execution is the minimum domain
//   Situational Skipper:  ctx_raw < 0.6 AND context_guard is minimum (before Cg floor applied)
//   Side-Effect Avoider:  mixed low scores with Q4/Q7 pattern suggesting barrier/side-effect
//   Balanced Low:         low_adherence but no single dominant failure
// ══════════════════════════════════════════════════════════════════════════════
function classifyPEACS(mapResult) {
  if (!mapResult || typeof mapResult.pe === 'undefined') {
    throw new Error('classifyPEACS: requires scoreMAP output object');
  }

  var arch = mapResult.architecture;
  var exec = mapResult.execution;
  var cg   = mapResult.context_guard;
  var ctx_raw = typeof mapResult.ctx_raw === 'number' ? mapResult.ctx_raw : cg;
  var add  = mapResult.additive;
  var fail = mapResult.dominant_failure;
  var items = mapResult.items || {};

  // Helper: is this domain the sole minimum?
  function isMinDomain(domain) {
    var vals = { architecture: arch, execution: exec, context_guard: cg };
    var minVal = Math.min(arch, exec, cg);
    return vals[domain] === minVal;
  }

  // Optimistic Stopper: Arch < 0.5 but overall additive score >= 5
  // Profile: patient WAS adherent, now reducing/stopping because symptoms resolved
  if (arch < 0.5 && add >= 5) {
    return {
      phenotype: 'Optimistic Stopper',
      confidence: arch < 0.35 ? 'high' : 'moderate',
      description: 'The patient shows adequate behavioral adherence but holds beliefs that ' +
        'medication may no longer be necessary. Symptom resolution or perceived cure is ' +
        'likely driving intentional dose reduction or planned discontinuation.',
      intervention_protocol: 'Education on illness chronicity; shared goal-setting on ' +
        'long-term medication purpose; re-evaluation of treatment beliefs; ' +
        'structured follow-up to monitor intentional stopping behavior.',
    };
  }

  // Intentional Resistor: Architecture failure is dominant
  if (arch < 0.5 && isMinDomain('architecture')) {
    return {
      phenotype: 'Intentional Resistor',
      confidence: arch < 0.33 ? 'high' : 'moderate',
      description: 'The patient holds beliefs that actively conflict with consistent ' +
        'adherence. Non-adherence is intentional and decision-driven, not circumstantial ' +
        'or forgetful. The Architecture domain is the primary failure.',
      intervention_protocol: 'Motivational interviewing to explore medication beliefs; ' +
        'collaborative re-framing of perceived necessity and concerns; ' +
        'side-effect discussion and alternative regimen negotiation where appropriate.',
    };
  }

  // Routine Forgetter: Execution failure is dominant
  if (exec < 0.5 && isMinDomain('execution')) {
    return {
      phenotype: 'Routine Forgetter',
      confidence: exec < 0.33 ? 'high' : 'moderate',
      description: 'The patient has adequate beliefs about medication but consistently ' +
        'fails to execute the daily routine. Forgetfulness, inconsistent timing, and ' +
        'difficulty remembering are the primary barriers.',
      intervention_protocol: 'Behavioral cue strategies (alarms, pill organizers, ' +
        'habit stacking with existing routines); pharmacy-initiated blister packs; ' +
        'caregiver or digital reminder integration.',
    };
  }

  // Situational Skipper: Context-Guard failure (use ctx_raw before floor to detect real friction)
  // ctx_raw < 0.6 = meaningful environmental burden even if Cg floor keeps it at 0.5
  if (ctx_raw < 0.6 && isMinDomain('context_guard')) {
    return {
      phenotype: 'Situational Skipper',
      confidence: ctx_raw < 0.4 ? 'high' : 'moderate',
      description: 'The patient encounters significant environmental, social, or logistical ' +
        'barriers that interrupt adherence. Medication access, cost, side-effect interference, ' +
        'or social context disrupts an otherwise motivated patient.',
      intervention_protocol: 'Barrier mapping and social support assessment; ' +
        'pharmacy access programs; cost-assistance navigation; ' +
        'regimen simplification to reduce situational demand; peer support linkage.',
    };
  }

  // Side-Effect Avoider: Q4 (cost/access/life) and Q7 (side effects/social) both low,
  // with mixed domain profile suggesting the avoidance is driven by medication experience
  var q4val = items.q4 !== undefined ? items.q4 : 1;
  var q7val = items.q7 !== undefined ? items.q7 : 1;
  if (q4val === 0 && q7val === 0 && arch < 0.7 && exec < 0.7) {
    return {
      phenotype: 'Side-Effect Avoider',
      confidence: 'moderate',
      description: 'The patient experiences both environmental friction (Q4) and side-effect ' +
        'or social interference (Q7) alongside reduced medication beliefs. The non-adherence ' +
        'pattern is consistent with avoidance driven by medication experience.',
      intervention_protocol: 'Side-effect review and symptom management strategies; ' +
        'regimen modification discussion with prescriber; ' +
        'patient education on managing expected effects; barrier support programs.',
    };
  }

  // Balanced Low: low adherence but no single dominant failure
  if (mapResult.low_adherence) {
    return {
      phenotype: 'Balanced Low',
      confidence: 'low',
      description: 'The patient shows globally reduced adherence across all three MAP domains ' +
        'without a single dominant failure pattern. Comprehensive intervention addressing ' +
        'beliefs, routine, and context simultaneously is indicated.',
      intervention_protocol: 'Holistic adherence review; multi-component intervention ' +
        'addressing beliefs, behavioral routines, and environmental barriers in parallel; ' +
        'close monitoring and reassessment after initial intervention.',
    };
  }

  // Adequate adherence
  return {
    phenotype: 'Adequate Adherent',
    confidence: mapResult.pe >= 0.85 ? 'high' : 'moderate',
    description: 'The patient demonstrates adequate adherence across Architecture, Execution, ' +
      'and Context-Guard domains. PE score indicates ' +
      (mapResult.pe >= 0.85 ? 'optimal' : 'good') + ' adherence health.',
    intervention_protocol: 'Maintain current regimen and reinforce adherence behaviors at ' +
      'routine follow-up. Schedule reassessment at next clinical visit.',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// renderMAPAssessmentUI(containerId, options)
// Renders the full 8-question MAP assessment form inside the given container.
// Computes and displays PE, domain scores, and PEACS phenotype in real time.
//
// options: {
//   mode: 'clinical|pharmacy|self|chw'  (default 'clinical')
//   lang: 'en'                          (default 'en', i18n hook)
//   conditionContext: ''                (optional condition/disease context label)
//   onComplete: function(result) {}     (called when form is submitted)
// }
// ══════════════════════════════════════════════════════════════════════════════
function renderMAPAssessmentUI(containerId, options) {
  var opts = options || {};
  var mode  = opts.mode  || 'clinical';
  var lang  = opts.lang  || window._atlasLang || 'en';
  var condCtx  = opts.conditionContext || '';
  var onComplete = opts.onComplete || null;

  var L = MAP_I18N[lang] || MAP_I18N.en;

  var container = document.getElementById(containerId);
  if (!container) {
    console.error('renderMAPAssessmentUI: container not found:', containerId);
    return;
  }

  // State: current responses keyed by question id
  var _responses = {};
  var _submitted  = false;

  // ── Inject scoped CSS if not already present ─────────────────────────────
  if (!document.getElementById('map-assessment-styles')) {
    var style = document.createElement('style');
    style.id = 'map-assessment-styles';
    style.textContent = [
      // Form wrapper
      '.map-form { font-family: var(--font-body, "IBM Plex Sans"), sans-serif; color: var(--bright, #e8f0f8); }',
      '.map-form-header { margin-bottom: 20px; }',
      '.map-form-title { font-family: var(--font-display, "Cormorant Garamond"), Georgia, serif; font-size: 1.6rem; font-weight: 300; color: var(--bright, #e8f0f8); margin: 0 0 4px; }',
      '.map-form-subtitle { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted, #6b8099); }',

      // Live scorebar cluster
      '.map-live-scores { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }',
      '@media (max-width: 560px) { .map-live-scores { grid-template-columns: repeat(2, 1fr); } }',
      '.map-score-card { background: var(--card, #111d30); border: 1px solid var(--border, rgba(255,255,255,0.07)); border-radius: 10px; padding: 12px 14px; text-align: center; }',
      '.map-score-label { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.65rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted, #6b8099); margin-bottom: 6px; }',
      '.map-score-value { font-family: var(--font-display, "Cormorant Garamond"), Georgia, serif; font-size: 1.6rem; font-weight: 300; line-height: 1; }',
      '.map-score-bar-wrap { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 8px; }',
      '.map-score-bar { height: 3px; border-radius: 2px; transition: width 0.4s cubic-bezier(0.22,1,0.36,1); }',

      // Question cards
      '.map-question { background: var(--card, #111d30); border: 1px solid var(--border, rgba(255,255,255,0.07)); border-radius: 10px; padding: 16px 18px; margin-bottom: 12px; transition: border-color 0.2s; }',
      '.map-question.answered { border-color: rgba(255,255,255,0.14); }',
      '.map-question-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }',
      '.map-domain-badge { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.62rem; letter-spacing: 0.12em; font-weight: 700; padding: 3px 8px; border-radius: 5px; flex-shrink: 0; margin-top: 2px; }',
      '.map-domain-badge.A { background: rgba(245,158,11,0.12); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); }',
      '.map-domain-badge.E { background: rgba(34,211,238,0.12); color: #22d3ee; border: 1px solid rgba(34,211,238,0.25); }',
      '.map-domain-badge.C { background: rgba(167,139,250,0.12); color: #a78bfa; border: 1px solid rgba(167,139,250,0.25); }',
      '.map-question-text { font-size: 0.95rem; line-height: 1.5; color: var(--bright, #e8f0f8); }',
      '.map-question-num { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.68rem; color: var(--muted, #6b8099); flex-shrink: 0; margin-top: 3px; }',

      // Answer options
      '.map-options { display: flex; gap: 8px; flex-wrap: wrap; }',
      '.map-option { display: flex; align-items: center; gap: 7px; cursor: pointer; padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); transition: background 0.15s, border-color 0.15s; font-size: 0.88rem; color: var(--bright, #e8f0f8); user-select: none; }',
      '.map-option:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.2); }',
      '.map-option.selected { border-color: var(--base, #4e9cf5); background: rgba(78,156,245,0.1); color: var(--base, #4e9cf5); }',
      '.map-option input[type=radio] { display: none; }',

      // Results panel
      '.map-results { margin-top: 24px; background: var(--card, #111d30); border: 1px solid var(--border, rgba(255,255,255,0.07)); border-radius: 12px; overflow: hidden; display: none; }',
      '.map-results.visible { display: block; }',
      '.map-results-header { padding: 20px 22px 16px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.07)); }',
      '.map-results-title { font-family: var(--font-display, "Cormorant Garamond"), Georgia, serif; font-size: 1.3rem; font-weight: 300; color: var(--bright, #e8f0f8); margin-bottom: 4px; }',

      // PE gauge
      '.map-pe-gauge { display: flex; align-items: flex-end; gap: 6px; padding: 20px 22px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.07)); }',
      '.map-pe-num { font-family: var(--font-display, "Cormorant Garamond"), Georgia, serif; font-size: 3.8rem; font-weight: 300; color: var(--pe, #d4a843); line-height: 1; }',
      '.map-pe-label { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted, #6b8099); padding-bottom: 10px; }',

      // Domain triadic breakdown
      '.map-triadic { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 20px 22px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.07)); }',
      '@media (max-width: 480px) { .map-triadic { grid-template-columns: 1fr; } }',
      '.map-domain-cell { text-align: center; }',
      '.map-domain-cell-label { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.63rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted, #6b8099); margin-bottom: 8px; }',
      '.map-domain-cell-value { font-family: var(--font-display, "Cormorant Garamond"), Georgia, serif; font-size: 2rem; font-weight: 300; line-height: 1; margin-bottom: 8px; }',
      '.map-domain-track { height: 4px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }',
      '.map-domain-fill { height: 4px; border-radius: 3px; }',

      // PEACS phenotype card
      '.map-phenotype-card { padding: 20px 22px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.07)); }',
      '.map-phenotype-tag { display: inline-block; font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; padding: 5px 12px; border-radius: 20px; border: 1px solid; margin-bottom: 12px; }',
      '.map-phenotype-desc { font-size: 0.88rem; color: rgba(232,240,248,0.8); line-height: 1.6; margin-bottom: 14px; }',
      '.map-intervention-block { background: rgba(78,156,245,0.06); border: 1px solid rgba(78,156,245,0.15); border-radius: 8px; padding: 14px 16px; }',
      '.map-intervention-label { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--base, #4e9cf5); margin-bottom: 8px; }',
      '.map-intervention-text { font-size: 0.85rem; color: rgba(232,240,248,0.75); line-height: 1.6; }',

      // Submit area
      '.map-submit-area { padding: 18px 22px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }',
      '.map-submit-btn { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; padding: 11px 28px; background: var(--base, #4e9cf5); color: #080e1a; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; transition: opacity 0.2s; }',
      '.map-submit-btn:hover { opacity: 0.88; }',
      '.map-submit-btn:disabled { opacity: 0.35; cursor: not-allowed; }',
      '.map-submit-status { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.72rem; color: var(--muted, #6b8099); }',
      '.map-progress-hint { font-family: var(--font-mono, "IBM Plex Mono"), monospace; font-size: 0.68rem; color: var(--muted, #6b8099); margin-bottom: 18px; }',
      '@keyframes mapZoePulse{0%,100%{transform:scale(1);opacity:0.6;}50%{transform:scale(1.12);opacity:1;}}',
      '@keyframes mapZoeListening{0%,100%{box-shadow:0 0 40px rgba(46,201,138,0.3);}50%{box-shadow:0 0 60px rgba(46,201,138,0.5);}}',
      '#map-zoe-overlay{display:none;position:fixed;inset:0;z-index:9999;background:linear-gradient(135deg,rgba(8,14,26,0.99),rgba(13,21,37,0.99));backdrop-filter:blur(12px);align-items:center;justify-content:center;overflow-y:auto;}',
      '#map-zoe-overlay.active{display:flex;}',
      '#map-zoe-inner{display:flex;flex-direction:column;align-items:center;gap:18px;max-width:480px;width:100%;padding:32px 24px;}',
      '#map-zoe-orb-wrap{position:relative;width:160px;height:160px;flex-shrink:0;}',
      '#map-zoe-orb{width:160px;height:160px;border-radius:50%;background:radial-gradient(circle at 40% 35%,rgba(212,168,67,0.6),rgba(245,158,11,0.3) 50%,rgba(167,139,250,0.15) 100%);box-shadow:0 0 40px rgba(212,168,67,0.3);display:flex;align-items:center;justify-content:center;font-size:2.4rem;}',
      '#map-zoe-pulse-ring{display:none;position:absolute;inset:-12px;border-radius:50%;border:2px solid rgba(212,168,67,0.3);animation:mapZoePulse 1.8s ease-in-out infinite;}',
      '#map-zoe-listen-ring{display:none;position:absolute;inset:-12px;border-radius:50%;border:2px solid rgba(46,201,138,0.4);animation:mapZoeListening 1.4s ease-in-out infinite;}',
      '#map-zoe-domain-badge{font-family:"IBM Plex Mono",monospace;font-size:0.64rem;letter-spacing:0.12em;text-transform:uppercase;padding:3px 12px;border-radius:20px;border:1px solid rgba(212,168,67,0.3);color:rgba(212,168,67,0.8);background:rgba(212,168,67,0.06);}',
      '#map-zoe-status{font-family:"IBM Plex Mono",monospace;font-size:0.78rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(212,168,67,0.7);text-align:center;}',
      '#map-zoe-q{font-family:"IBM Plex Sans",sans-serif;font-size:1rem;line-height:1.6;color:#e8f0f8;text-align:center;max-width:420px;min-height:60px;}',
      '#map-zoe-transcript{font-family:"IBM Plex Mono",monospace;font-size:0.82rem;color:rgba(232,240,248,0.45);font-style:italic;text-align:center;min-height:22px;}',
      '#map-zoe-response{font-family:"IBM Plex Sans",sans-serif;font-size:0.88rem;color:rgba(232,240,248,0.7);text-align:center;line-height:1.55;min-height:44px;max-width:400px;}',
      '.map-zoe-pills{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;}',
      '.map-zoe-pill{width:28px;height:6px;border-radius:3px;background:rgba(255,255,255,0.1);transition:background 0.3s;}',
      '#map-zoe-controls{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;}',
      '#map-zoe-mic-btn{font-family:"IBM Plex Mono",monospace;font-size:0.82rem;letter-spacing:0.14em;text-transform:uppercase;padding:13px 40px;border-radius:10px;border:2px solid rgba(212,168,67,0.4);background:rgba(212,168,67,0.06);color:#d4a843;cursor:pointer;transition:all 0.2s;width:100%;max-width:220px;}',
      '#map-zoe-mic-btn:hover{background:rgba(212,168,67,0.12);border-color:rgba(212,168,67,0.7);}',
      '#map-zoe-row2{display:flex;gap:10px;justify-content:center;}',
      '#map-zoe-skip-btn,#map-zoe-close-btn{font-family:"IBM Plex Mono",monospace;font-size:0.70rem;letter-spacing:0.12em;text-transform:uppercase;padding:7px 16px;border-radius:7px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(232,240,248,0.3);cursor:pointer;}',
      '.map-zoe-trigger{font-family:"IBM Plex Mono",monospace;font-size:0.69rem;letter-spacing:0.14em;text-transform:uppercase;padding:7px 16px;border-radius:7px;border:1px solid rgba(212,168,67,0.3);background:rgba(212,168,67,0.06);color:rgba(212,168,67,0.8);cursor:pointer;white-space:nowrap;flex-shrink:0;margin-top:4px;}',
      '.map-zoe-trigger:hover{background:rgba(212,168,67,0.12);border-color:rgba(212,168,67,0.6);}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Build HTML ──────────────────────────────────────────────────────────────
  var modeLabel = (L.modeLabels && L.modeLabels[mode]) || L.modeLabels.clinical;

  var html = '<div class="map-form">';
  html += '<div class="map-form-header">';
  html += '<div class="map-form-title">' + _mapEsc(L.formTitle) + '</div>';
  html += '<div class="map-form-subtitle">' + _mapEsc(L.formSubtitle);
  if (condCtx) html += ' &middot; ' + _mapEsc(condCtx);
  html += ' &middot; ' + _mapEsc(modeLabel) + ' Mode</div>';
  html += '<button class="map-zoe-trigger" onclick="mapZoeOpen()">&#127908; Zoe Voice</button>';
  html += '</div>';

  // Zoe Voice Overlay
  html += '<div id="map-zoe-overlay">';
  html += '<div id="map-zoe-inner">';
  html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.65rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(212,168,67,0.5);">MAP Voice Assessment</div>';
  html += '<div id="map-zoe-domain-badge">Architecture</div>';
  html += '<div id="map-zoe-orb-wrap">';
  html += '<div id="map-zoe-orb">&#127908;</div>';
  html += '<div id="map-zoe-pulse-ring"></div>';
  html += '<div id="map-zoe-listen-ring"></div>';
  html += '</div>';
  html += '<div id="map-zoe-status">Initializing...</div>';
  html += '<div id="map-zoe-q"></div>';
  html += '<div class="map-zoe-pills" id="map-zoe-pills"></div>';
  html += '<div id="map-zoe-transcript"></div>';
  html += '<div id="map-zoe-response"></div>';
  html += '<div id="map-zoe-controls">';
  html += '<button id="map-zoe-mic-btn" onclick="mapZoeStartListening()">&#127908; Tap to Speak</button>';
  html += '<div id="map-zoe-row2">';
  html += '<button id="map-zoe-skip-btn" onclick="mapZoeSkip()">Skip Q</button>';
  html += '<button id="map-zoe-close-btn" onclick="mapZoeClose()">Close</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  // Live score display
  html += '<div class="map-live-scores">';
  html += '<div class="map-score-card"><div class="map-score-label">' + _mapEsc(L.scoreLabel_pe) + '</div>';
  html += '<div class="map-score-value" id="map-live-pe" style="color:#d4a843;">--</div>';
  html += '<div class="map-score-bar-wrap"><div class="map-score-bar" id="map-bar-pe" style="width:0%;background:#d4a843;"></div></div></div>';

  html += '<div class="map-score-card"><div class="map-score-label">' + _mapEsc(L.scoreLabel_arch) + '</div>';
  html += '<div class="map-score-value" id="map-live-arch" style="color:#f59e0b;">--</div>';
  html += '<div class="map-score-bar-wrap"><div class="map-score-bar" id="map-bar-arch" style="width:0%;background:#f59e0b;"></div></div></div>';

  html += '<div class="map-score-card"><div class="map-score-label">' + _mapEsc(L.scoreLabel_exec) + '</div>';
  html += '<div class="map-score-value" id="map-live-exec" style="color:#22d3ee;">--</div>';
  html += '<div class="map-score-bar-wrap"><div class="map-score-bar" id="map-bar-exec" style="width:0%;background:#22d3ee;"></div></div></div>';

  html += '<div class="map-score-card"><div class="map-score-label">' + _mapEsc(L.scoreLabel_ctx) + '</div>';
  html += '<div class="map-score-value" id="map-live-ctx" style="color:#a78bfa;">--</div>';
  html += '<div class="map-score-bar-wrap"><div class="map-score-bar" id="map-bar-ctx" style="width:0%;background:#a78bfa;"></div></div></div>';
  html += '</div>';

  html += '<div class="map-progress-hint" id="map-progress-hint">' + _mapEsc(L.progressHint) + '</div>';

  // Question cards
  MAP_QUESTIONS.forEach(function(q, idx) {
    var lq = (L.questions && L.questions[idx]) || {};
    var qText = lq.text || q.text;
    html += '<div class="map-question" id="map-q-card-' + q.id + '">';
    html += '<div class="map-question-header">';
    html += '<span class="map-question-num">Q' + (idx+1) + '</span>';
    html += '<span class="map-domain-badge ' + q.label + '">' + _mapEsc((L.domainNames && L.domainNames[q.label]) || q.label) + '</span>';
    html += '<span class="map-question-text">' + _mapEsc(qText) + '</span>';
    html += '</div>';

    html += '<div class="map-options">';
    if (q.type === 'binary') {
      var binaryKeys = Object.keys(q.coding);
      var binaryLabels = (lq.binary && lq.binary.length === 2) ? lq.binary : binaryKeys;
      binaryKeys.forEach(function(optKey, bi) {
        var val = q.coding[optKey];
        var displayLabel = binaryLabels[bi] || optKey;
        html += '<label class="map-option" id="map-opt-' + q.id + '-' + optKey + '">';
        html += '<input type="radio" name="map-' + q.id + '" value="' + val + '">';
        html += _mapEsc(displayLabel);
        html += '</label>';
      });
    } else {
      // Ordinal Q8
      q.options.forEach(function(opt, oi) {
        var displayLabel = (lq.ordinal && lq.ordinal[oi]) ? lq.ordinal[oi] : opt.label;
        html += '<label class="map-option" id="map-opt-' + q.id + '-' + opt.value + '">';
        html += '<input type="radio" name="map-' + q.id + '" value="' + opt.value + '">';
        html += _mapEsc(displayLabel);
        html += '</label>';
      });
    }
    html += '</div>';
    html += '</div>';
  });

  // Submit
  html += '<div class="map-submit-area">';
  html += '<button class="map-submit-btn" id="map-submit-btn" disabled>' + _mapEsc(L.submitBtn) + '</button>';
  html += '<span class="map-submit-status" id="map-submit-status"></span>';
  html += '</div>';

  // Results panel
  html += '<div class="map-results" id="map-results-panel">';
  html += '<div class="map-results-header"><div class="map-results-title">' + _mapEsc(L.resultsTitle) + '</div>';
  html += '<div id="map-results-meta" style="font-family:var(--font-mono,\'IBM Plex Mono\'),monospace;font-size:0.65rem;color:var(--muted,#6b8099);"></div></div>';
  html += '<div class="map-pe-gauge"><div class="map-pe-num" id="map-results-pe">--</div>';
  html += '<div class="map-pe-label">' + _mapEsc(L.scoreLabel_pe) + '<br>Geometric Mean</div></div>';
  html += '<div class="map-triadic">';
  html += '<div class="map-domain-cell"><div class="map-domain-cell-label">' + _mapEsc(L.scoreLabel_arch) + '</div>';
  html += '<div class="map-domain-cell-value" id="map-res-arch" style="color:#f59e0b;">--</div>';
  html += '<div class="map-domain-track"><div class="map-domain-fill" id="map-res-arch-bar" style="width:0%;background:#f59e0b;"></div></div></div>';
  html += '<div class="map-domain-cell"><div class="map-domain-cell-label">' + _mapEsc(L.scoreLabel_exec) + '</div>';
  html += '<div class="map-domain-cell-value" id="map-res-exec" style="color:#22d3ee;">--</div>';
  html += '<div class="map-domain-track"><div class="map-domain-fill" id="map-res-exec-bar" style="width:0%;background:#22d3ee;"></div></div></div>';
  html += '<div class="map-domain-cell"><div class="map-domain-cell-label">' + _mapEsc(L.scoreLabel_ctx) + '</div>';
  html += '<div class="map-domain-cell-value" id="map-res-ctx" style="color:#a78bfa;">--</div>';
  html += '<div class="map-domain-track"><div class="map-domain-fill" id="map-res-ctx-bar" style="width:0%;background:#a78bfa;"></div></div></div>';
  html += '</div>';
  html += '<div class="map-phenotype-card" id="map-phenotype-block"></div>';
  html += '<div style="padding:0 22px 20px;font-family:var(--font-mono,\'IBM Plex Mono\'),monospace;font-size:0.68rem;color:var(--muted,#6b8099);"></div>';
  html += '</div>';

  html += '</div>'; // .map-form

  container.innerHTML = html;

  // ── Zoe MAP voice bridge ──────────────────────────────────────────────────
  // Allows module-level mapZoe* functions to write into this closure's state
  window._mapZoeOnAnswer = function(qIdx, scoreVal) {
    var q = MAP_QUESTIONS[qIdx];
    if (!q) return;
    _responses[q.id] = scoreVal;
    // Visually select the closest matching radio
    var radios = document.querySelectorAll('input[name="map-' + q.id + '"]');
    var bestDiff = Infinity;
    var bestInput = null;
    radios.forEach(function(r) {
      var diff = Math.abs(parseFloat(r.value) - scoreVal);
      if (diff < bestDiff) { bestDiff = diff; bestInput = r; }
    });
    if (bestInput) {
      bestInput.checked = true;
      var label = bestInput.parentElement;
      document.querySelectorAll('#map-q-card-' + q.id + ' .map-option').forEach(function(l) { l.classList.remove('selected'); });
      if (label) label.classList.add('selected');
    }
    _updateLiveScores();
  };

  window._mapZoeOnComplete = function() {
    var submitBtn = document.getElementById('map-submit-btn');
    if (submitBtn && !submitBtn.disabled) submitBtn.click();
  };

  window._mapZoeLang = lang;

  // ── Wire up interactivity ─────────────────────────────────────────────────

  function _updateLiveScores() {
    var answered = Object.keys(_responses).length;
    var total    = MAP_QUESTIONS.length;
    var hint = document.getElementById('map-progress-hint');
    var submitBtn = document.getElementById('map-submit-btn');

    if (answered < total) {
      if (hint) hint.textContent = L.progressCount(answered, total);
      if (submitBtn) submitBtn.disabled = true;
    } else {
      if (hint) hint.textContent = L.allAnswered;
      if (submitBtn) submitBtn.disabled = _submitted;
    }

    // Need at least enough answers to compute partial domain means
    var responses = MAP_QUESTIONS.map(function(q) { return _responses[q.id]; });
    var allAnswered = responses.every(function(v) { return typeof v === 'number'; });

    if (!allAnswered) {
      // Partial: compute what we can
      _computePartialLive(responses);
      return;
    }

    try {
      var result = scoreMAP(responses);
      _setLiveDisplay(result.pe, result.architecture, result.execution, result.context_guard);
    } catch(e) {
      // Ignore scoring errors during partial input
    }
  }

  function _computePartialLive(responses) {
    // Architecture: Q2(idx1), Q3(idx2), Q6(idx5)
    var archVals = [responses[1], responses[2], responses[5]].filter(function(v) { return typeof v === 'number'; });
    var execVals = [responses[0], responses[4], responses[7]].filter(function(v) { return typeof v === 'number'; });
    var ctxVals  = [responses[3], responses[6]].filter(function(v) { return typeof v === 'number'; });

    var arch = archVals.length ? archVals.reduce(function(s,v){return s+v;},0)/archVals.length : null;
    var exec = execVals.length ? execVals.reduce(function(s,v){return s+v;},0)/execVals.length : null;
    var ctx  = ctxVals.length  ? Math.max(0.5, 0.5 + 0.5 * (ctxVals.reduce(function(s,v){return s+v;},0)/ctxVals.length)) : null;

    var pe = (arch !== null && exec !== null && ctx !== null)
      ? Math.pow(arch * exec * ctx, 1/3) : null;

    _setLiveDisplay(pe, arch, exec, ctx);
  }

  function _setLiveDisplay(pe, arch, exec, ctx) {
    var peEl   = document.getElementById('map-live-pe');
    var archEl = document.getElementById('map-live-arch');
    var execEl = document.getElementById('map-live-exec');
    var ctxEl  = document.getElementById('map-live-ctx');
    var peBar   = document.getElementById('map-bar-pe');
    var archBar = document.getElementById('map-bar-arch');
    var execBar = document.getElementById('map-bar-exec');
    var ctxBar  = document.getElementById('map-bar-ctx');

    if (peEl)   peEl.textContent   = pe   !== null ? pe.toFixed(3)   : '--';
    if (archEl) archEl.textContent = arch !== null ? arch.toFixed(3) : '--';
    if (execEl) execEl.textContent = exec !== null ? exec.toFixed(3) : '--';
    if (ctxEl)  ctxEl.textContent  = ctx  !== null ? ctx.toFixed(3)  : '--';

    if (peBar)   peBar.style.width   = pe   !== null ? (pe   * 100).toFixed(1) + '%' : '0%';
    if (archBar) archBar.style.width = arch !== null ? (arch * 100).toFixed(1) + '%' : '0%';
    if (execBar) execBar.style.width = exec !== null ? (exec * 100).toFixed(1) + '%' : '0%';
    if (ctxBar)  ctxBar.style.width  = ctx  !== null ? (ctx  * 100).toFixed(1) + '%' : '0%';
  }

  // Attach radio listeners
  MAP_QUESTIONS.forEach(function(q, idx) {
    var inputs = container.querySelectorAll('input[name="map-' + q.id + '"]');
    inputs.forEach(function(input) {
      input.addEventListener('change', function() {
        _responses[q.id] = parseFloat(this.value);

        // Highlight selected option, clear others
        var siblings = container.querySelectorAll('input[name="map-' + q.id + '"]');
        siblings.forEach(function(sib) {
          var lbl = sib.closest('.map-option');
          if (lbl) lbl.classList.toggle('selected', sib === input);
        });

        // Mark question card as answered
        var card = document.getElementById('map-q-card-' + q.id);
        if (card) card.classList.add('answered');

        _updateLiveScores();
      });
    });
  });

  // Submit button
  var submitBtn = document.getElementById('map-submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', function() {
      if (_submitted) return;
      var responses = MAP_QUESTIONS.map(function(q) { return _responses[q.id]; });
      var allAnswered = responses.every(function(v) { return typeof v === 'number'; });
      if (!allAnswered) {
        var status = document.getElementById('map-submit-status');
        if (status) status.textContent = L.pleaseAnswerAll;
        return;
      }

      _submitted = true;
      submitBtn.disabled = true;

      var result = scoreMAP(responses);
      var phenotype = classifyPEACS(result);

      _renderResults(result, phenotype);

      if (typeof onComplete === 'function') {
        onComplete({
          responses: responses,
          mapResult: result,
          phenotype: phenotype,
          mode: mode,
          conditionContext: condCtx,
          timestamp: Date.now(),
        });
      }
    });
  }

  function _renderResults(result, phenotype) {
    var panel = document.getElementById('map-results-panel');
    if (!panel) return;
    panel.classList.add('visible');

    // Scroll results into view
    setTimeout(function() {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);

    // PE display
    var peEl = document.getElementById('map-results-pe');
    if (peEl) { peEl.textContent = result.pe.toFixed(4); peEl.style.color = _mapPeColor(result.pe); }

    // Meta
    var metaEl = document.getElementById('map-results-meta');
    if (metaEl) {
      metaEl.textContent = L.metaAdditive + ': ' + result.additive.toFixed(2) + ' / 8' +
        (result.low_adherence ? ' · ' + L.metaLowAdherence : '') +
        ' · ' + L.metaDominantFailure + ': ' + (result.dominant_failure || 'balanced');
    }

    // Triadic domain bars
    function _setDomainResult(valId, barId, value) {
      var el  = document.getElementById(valId);
      var bar = document.getElementById(barId);
      if (el)  el.textContent  = value.toFixed(4);
      if (bar) bar.style.width = (value * 100).toFixed(1) + '%';
    }
    _setDomainResult('map-res-arch', 'map-res-arch-bar', result.architecture);
    _setDomainResult('map-res-exec', 'map-res-exec-bar', result.execution);
    _setDomainResult('map-res-ctx',  'map-res-ctx-bar',  result.context_guard);

    // PEACS phenotype block
    var pBlock = document.getElementById('map-phenotype-block');
    if (pBlock) {
      var confColor = { high: '#10b981', moderate: '#f59e0b', low: '#6b8099' }[phenotype.confidence] || '#6b8099';
      var tagStyle  = 'color:' + confColor + ';border-color:' + confColor + ';background:' +
        confColor.replace(/^#/, 'rgba(') + ',0.08)';

      // Build phenotype content safely
      pBlock.innerHTML = '';

      var lp = (L.phenotypes && L.phenotypes[phenotype.phenotype]) || {};
      var localName = lp.name || phenotype.phenotype;
      var localConf = (L.confidence && L.confidence[phenotype.confidence]) || (phenotype.confidence + ' confidence');
      var localDesc = lp.desc || (lp.desc_high && result.pe >= 0.85 ? lp.desc_high : lp.desc_moderate) || phenotype.description;
      if (!localDesc && lp.desc_high) localDesc = result.pe >= 0.85 ? lp.desc_high : lp.desc_moderate;
      if (!localDesc) localDesc = phenotype.description;
      var localIntervention = lp.intervention || phenotype.intervention_protocol;

      var tagEl = document.createElement('div');
      tagEl.className = 'map-phenotype-tag';
      tagEl.style.cssText = tagStyle;
      tagEl.textContent = localName + ' (' + localConf + ')';
      pBlock.appendChild(tagEl);

      var descEl = document.createElement('div');
      descEl.className = 'map-phenotype-desc';
      descEl.textContent = localDesc;
      pBlock.appendChild(descEl);

      if (localIntervention) {
        var intBlock = document.createElement('div');
        intBlock.className = 'map-intervention-block';
        var intLabel = document.createElement('div');
        intLabel.className = 'map-intervention-label';
        intLabel.textContent = L.interventionLabel;
        var intText = document.createElement('div');
        intText.className = 'map-intervention-text';
        intText.textContent = localIntervention;
        intBlock.appendChild(intLabel);
        intBlock.appendChild(intText);
        pBlock.appendChild(intBlock);
      }
    }

    // Update submit button to completion state
    var btn = document.getElementById('map-submit-btn');
    if (btn) {
      btn.textContent = L.assessmentRecorded;
      btn.style.background = '#10b981';
    }
    var status = document.getElementById('map-submit-status');
    if (status) status.textContent = 'Submitted ' + new Date().toLocaleTimeString();
  }
}

// ── PE color interpolation (matches PEACS peColor pattern) ─────────────────
function _mapPeColor(pe) {
  if (!pe || pe <= 0) return '#ef4444';
  if (pe >= 1)        return '#10b981';
  if (pe <= 0.25) return _mapLerpHex('#ef4444', '#f59e0b', pe / 0.25);
  if (pe <= 0.5)  return _mapLerpHex('#f59e0b', '#eab308', (pe - 0.25) / 0.25);
  if (pe <= 0.75) return _mapLerpHex('#eab308', '#3b82f6', (pe - 0.5)  / 0.25);
  return _mapLerpHex('#3b82f6', '#10b981', (pe - 0.75) / 0.25);
}
function _mapLerpHex(a, b, t) {
  var ha = parseInt(a.slice(1), 16), hb = parseInt(b.slice(1), 16);
  var ar = ha >> 16, ag = (ha >> 8) & 255, ab = ha & 255;
  var br = hb >> 16, bg = (hb >> 8) & 255, bb = hb & 255;
  return '#' + [
    Math.round(ar + (br-ar)*t),
    Math.round(ag + (bg-ag)*t),
    Math.round(ab + (bb-ab)*t)
  ].map(function(v) { return v.toString(16).padStart(2,'0'); }).join('');
}

// ── XSS-safe text escaping for HTML insertion ───────────────────────────────
function _mapEsc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

// ══════════════════════════════════════════════════════════════════════════════
// submitMAPAssessment(data, workspaceKey)
// Saves MAP assessment to Firebase /map_assessments/{id} AND to D1 via the
// Cloudflare Worker API endpoint (/api/v1/map/submit).
// Returns a Promise resolving to the saved record with computed scores.
//
// data: {
//   responses:        [q1..q8] array
//   patient_number:   string (optional)
//   condition:        string (optional)
//   medication:       string (optional)
//   country:          string (optional)
//   country_iso2:     string (optional)
//   language:         string (optional)
//   session_id:       string (optional)
//   assessor_id:      string (optional)
//   assessment_mode:  string (optional, default 'clinical')
//   conditionContext: string (optional)
//   latitude:         number (optional)
//   longitude:        number (optional)
//   city:             string (optional)
// }
// ══════════════════════════════════════════════════════════════════════════════
function submitMAPAssessment(data, workspaceKey) {
  return new Promise(function(resolve, reject) {
    if (!data || !Array.isArray(data.responses) || data.responses.length < 8) {
      return reject(new Error('submitMAPAssessment: data.responses must be array of 8 values'));
    }
    if (!workspaceKey) {
      return reject(new Error('submitMAPAssessment: workspaceKey is required'));
    }

    var mapResult;
    try {
      mapResult = scoreMAP(data.responses);
    } catch(e) {
      return reject(new Error('submitMAPAssessment: scoring failed: ' + e.message));
    }

    var phenotype = classifyPEACS(mapResult);

    var now = Date.now();
    var id  = 'map_' + now + '_' + Math.random().toString(36).slice(2, 9);

    var record = {
      id:               id,
      instrument_type:  'map',
      workspace_key:    workspaceKey,
      // Raw items
      q1: mapResult.items.q1, q2: mapResult.items.q2, q3: mapResult.items.q3,
      q4: mapResult.items.q4, q5: mapResult.items.q5, q6: mapResult.items.q6,
      q7: mapResult.items.q7, q8: mapResult.items.q8,
      // MAP scores
      arch_score:       mapResult.architecture,
      exec_score:       mapResult.execution,
      ctx_score:        mapResult.context_guard,
      pe_score:         mapResult.pe,
      additive_score:   mapResult.additive,
      low_adherence:    mapResult.low_adherence,
      dominant_failure: mapResult.dominant_failure,
      peacs_phenotype:  phenotype.phenotype,
      phenotype_confidence: phenotype.confidence,
      // Metadata
      patient_number:   data.patient_number   || null,
      condition:        data.condition        || data.conditionContext || null,
      medication:       data.medication       || null,
      country:          data.country          || null,
      country_iso2:     data.country_iso2     || null,
      language:         data.language         || 'en',
      assessment_mode:  data.assessment_mode  || 'clinical',
      session_id:       data.session_id       || null,
      assessor_id:      data.assessor_id      || null,
      latitude:         data.latitude         || null,
      longitude:        data.longitude        || null,
      city:             data.city             || null,
      timestamp:        now,
      submitted_at:     new Date(now).toISOString(),
      tool:             'map',
      // Embedded phenotype for Firebase query convenience
      phenotype_data:   phenotype,
    };

    // 1. Save to Firebase
    var fbSavePromise = new Promise(function(res, rej) {
      if (typeof database === 'undefined' || !database) {
        console.warn('submitMAPAssessment: Firebase database not available, skipping Firebase save');
        res(null);
        return;
      }
      atlasDB('map_assessments/' + id).set(record, function(err) {
        if (err) {
          console.warn('submitMAPAssessment: Firebase save failed:', err);
          res(null); // Non-fatal: D1 is the authoritative store
        } else {
          res(record);
        }
      });
    });

    // 2. Save to D1 via Worker API
    var apiBase = (typeof ATLAS_API_BASE !== 'undefined' ? ATLAS_API_BASE : '') || '/api/v1';
    var d1SavePromise = new Promise(function(res, rej) {
      // Get Firebase auth token for API call
      var authPromise;
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        authPromise = firebase.auth().currentUser.getIdToken();
      } else {
        authPromise = Promise.resolve(null);
      }

      authPromise.then(function(token) {
        var headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;

        return fetch(apiBase + '/map/submit', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            workspace_key:    workspaceKey,
            q1: record.q1, q2: record.q2, q3: record.q3, q4: record.q4,
            q5: record.q5, q6: record.q6, q7: record.q7, q8: record.q8,
            arch_score:       record.arch_score,
            exec_score:       record.exec_score,
            ctx_score:        record.ctx_score,
            pe_score:         record.pe_score,
            peacs_phenotype:  record.peacs_phenotype,
            patient_number:   record.patient_number,
            condition:        record.condition,
            medication:       record.medication,
            country:          record.country,
            country_iso2:     record.country_iso2,
            language:         record.language,
            assessment_mode:  record.assessment_mode,
            session_id:       record.session_id,
            assessor_id:      record.assessor_id,
          }),
        });
      }).then(function(resp) {
        if (!resp) { res(null); return; }
        return resp.json().then(function(json) {
          if (json && json.ok) { res(json.data); }
          else {
            console.warn('submitMAPAssessment: D1 save returned error:', json && json.error);
            res(null);
          }
        });
      }).catch(function(err) {
        console.warn('submitMAPAssessment: D1 API call failed:', err);
        res(null); // Non-fatal: Firebase already has the record
      });
    });

    // 3. Update longitudinal session if session_id is provided
    var sessionUpdatePromise = Promise.resolve(null);
    if (record.session_id && typeof database !== 'undefined' && database) {
      sessionUpdatePromise = _updateMAPLongitudinalSession(record);
    }

    Promise.all([fbSavePromise, d1SavePromise, sessionUpdatePromise])
      .then(function(results) {
        // REDCap auto-sync — non-blocking, only fires if workspace has rc_auto_sync enabled
        if (typeof redcapAutoSyncRecord === 'function') redcapAutoSyncRecord(record);
        resolve(record);
      })
      .catch(function(err) {
        // Still resolve with the record since Firebase likely saved
        console.warn('submitMAPAssessment: one save target failed, record may be partial:', err);
        resolve(record);
      });
  });
}

// ── Update longitudinal session in Firebase ──────────────────────────────────
function _updateMAPLongitudinalSession(record) {
  return new Promise(function(resolve) {
    if (!record.session_id || !record.patient_number) { resolve(null); return; }

    var ref = atlasDB('map_sessions/' + record.session_id);
    ref.once('value', function(snap) {
      var existing = snap.val();
      var now = Date.now();

      if (!existing) {
        // Create new session
        var newSession = {
          session_id:       record.session_id,
          patient_number:   record.patient_number,
          workspace_key:    record.workspace_key,
          condition:        record.condition || null,
          started_at:       now,
          last_updated:     now,
          assessment_count: 1,
          baseline_pe:      record.pe_score,
          latest_pe:        record.pe_score,
          arch_trajectory:  JSON.stringify([record.arch_score]),
          exec_trajectory:  JSON.stringify([record.exec_score]),
          ctx_trajectory:   JSON.stringify([record.ctx_score]),
          pe_trajectory:    JSON.stringify([record.pe_score]),
          dropout_risk:     null,
          dominant_domain:  record.dominant_failure || null,
        };
        ref.set(newSession, function(err) {
          if (err) console.warn('_updateMAPLongitudinalSession: set failed:', err);
          resolve(newSession);
        });
      } else {
        // Update existing session
        var archTraj = _safeJsonParse(existing.arch_trajectory, []);
        var execTraj = _safeJsonParse(existing.exec_trajectory, []);
        var ctxTraj  = _safeJsonParse(existing.ctx_trajectory,  []);
        var peTraj   = _safeJsonParse(existing.pe_trajectory,   []);

        archTraj.push(record.arch_score);
        execTraj.push(record.exec_score);
        ctxTraj.push(record.ctx_score);
        peTraj.push(record.pe_score);

        // Recalculate dominant domain from latest
        var updates = {
          last_updated:     now,
          assessment_count: (existing.assessment_count || 0) + 1,
          latest_pe:        record.pe_score,
          arch_trajectory:  JSON.stringify(archTraj),
          exec_trajectory:  JSON.stringify(execTraj),
          ctx_trajectory:   JSON.stringify(ctxTraj),
          pe_trajectory:    JSON.stringify(peTraj),
          dominant_domain:  record.dominant_failure || existing.dominant_domain,
        };
        if (!existing.baseline_pe) updates.baseline_pe = record.pe_score;

        ref.update(updates, function(err) {
          if (err) console.warn('_updateMAPLongitudinalSession: update failed:', err);
          resolve(updates);
        });
      }
    });
  });
}

function _safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch(e) { return fallback; }
}

// ── MAP Zoe Voice Agent ───────────────────────────────────────────────────────

var _mapZoeActive      = false;
var _mapZoeCurrQ       = 0;
var _mapZoeHistory     = [];
var _mapZoeRecognition = null;
var _mapZoeListening   = false;
var _mapZoeProcessing  = false;
var _mapZoeSessionSys  = '';

var _MAP_ZOE_BCP47 = {
  en:'en-US', ar:'ar-SA', es:'es-ES', fr:'fr-FR', de:'de-DE', it:'it-IT',
  pt:'pt-BR', ru:'ru-RU', zh:'zh-CN', ja:'ja-JP', ko:'ko-KR', tr:'tr-TR',
  nl:'nl-NL', pl:'pl-PL', sv:'sv-SE', da:'da-DK', fi:'fi-FI', nb:'nb-NO',
  cs:'cs-CZ', sk:'sk-SK', ro:'ro-RO', hu:'hu-HU', bg:'bg-BG', hr:'hr-HR',
  uk:'uk-UA', he:'he-IL', fa:'fa-IR', hi:'hi-IN', bn:'bn-BD', ur:'ur-PK',
  th:'th-TH', vi:'vi-VN', id:'id-ID', ms:'ms-MY'
};

var _MAP_ZOE_Q8_SCORES = {
  'never': 1.0, 'rarely': 0.75, 'sometimes': 0.5, 'often': 0.25, 'all the time': 0.0
};

function _mzId(id) { return document.getElementById('map-zoe-' + id); }

function _mzSetStatus(txt) { var el = _mzId('status'); if (el) el.textContent = txt; }

function _mzSetQ(txt) { var el = _mzId('q'); if (el) el.textContent = txt; }

function _mzSetTranscript(txt) { var el = _mzId('transcript'); if (el) el.textContent = txt ? '“' + txt + '”' : ''; }

function _mzSetResponse(txt) { var el = _mzId('response'); if (el) el.textContent = txt; }

function _mzSetPill(idx, state) {
  var pills = document.querySelectorAll('.map-zoe-pill');
  if (pills[idx]) {
    pills[idx].style.background = state === 'done'
      ? '#2ec98a'
      : state === 'active'
        ? '#d4a843'
        : state === 'skipped'
          ? 'rgba(255,255,255,0.15)'
          : 'rgba(255,255,255,0.1)';
  }
}

function _mzShowControls(show) {
  var ctrl = _mzId('controls');
  if (ctrl) ctrl.style.display = show ? 'flex' : 'none';
}

function _mzSetDomainBadge(domainLabel) {
  var el = _mzId('domain-badge');
  if (!el) return;
  var colors = { A: '#f59e0b', E: '#22d3ee', C: '#a78bfa' };
  var names  = { A: 'Architecture', E: 'Execution', C: 'Context-Guard' };
  var col    = colors[domainLabel] || '#d4a843';
  var name   = names[domainLabel]  || domainLabel;
  el.textContent = name;
  el.style.color       = col;
  el.style.borderColor = col;
  el.style.background  = 'rgba(0,0,0,0.2)';
}

function _mzSetOrb(state) {
  var orb   = _mzId('orb');
  var pulse = _mzId('pulse-ring');
  var listn = _mzId('listen-ring');
  if (!orb) return;
  if (state === 'speaking') {
    if (pulse) pulse.style.display = 'block';
    if (listn) listn.style.display = 'none';
    orb.style.boxShadow = '0 0 40px rgba(212,168,67,0.4)';
  } else if (state === 'listening') {
    if (pulse) pulse.style.display = 'none';
    if (listn) listn.style.display = 'block';
    orb.style.boxShadow = '0 0 40px rgba(46,201,138,0.4)';
  } else {
    if (pulse) pulse.style.display = 'none';
    if (listn) listn.style.display = 'none';
    orb.style.boxShadow = '0 0 40px rgba(212,168,67,0.2)';
  }
}

function _mzSpeak(text, onEnd) {
  if (!window.speechSynthesis) { if (onEnd) onEnd(); return; }
  window.speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(text);
  var lang = (window._mapZoeLang) || 'en';
  var bcp  = _MAP_ZOE_BCP47[lang] || 'en-US';
  utt.lang  = bcp;
  utt.rate  = 0.92;
  utt.pitch = 1.05;
  var voices = window.speechSynthesis.getVoices();
  var match = voices.find(function(v) {
    return v.lang.startsWith(bcp.split('-')[0]) && v.name.toLowerCase().indexOf('female') !== -1;
  });
  if (!match) match = voices.find(function(v) { return v.lang.startsWith(bcp.split('-')[0]); });
  if (match) utt.voice = match;
  _mzSetOrb('speaking');
  utt.onend  = function() { _mzSetOrb('idle'); if (onEnd) onEnd(); };
  utt.onerror = function() { _mzSetOrb('idle'); if (onEnd) onEnd(); };
  window.speechSynthesis.speak(utt);
}

function _mzGetQuestion(qIdx) {
  var lang = (window._mapZoeLang) || 'en';
  var L = MAP_I18N[lang] || MAP_I18N['en'];
  var q = MAP_QUESTIONS[qIdx];
  if (!q) return null;
  var lq = (L.questions && L.questions[qIdx]) || {};
  return { q: q, lq: lq, text: lq.text || q.text };
}

function _mzExtractScore(qIdx, transcript, claudeJson) {
  var q = MAP_QUESTIONS[qIdx];
  if (!q) return null;
  var extracted = (claudeJson && claudeJson.extracted_answer) ? claudeJson.extracted_answer.toLowerCase().trim() : '';

  if (q.type === 'binary') {
    if (extracted === 'yes') return (q.coding['Yes'] !== undefined) ? q.coding['Yes'] : 0;
    if (extracted === 'no')  return (q.coding['No']  !== undefined) ? q.coding['No']  : 1;
    var tl = transcript.toLowerCase();
    var hasYes = /\byes\b|\byeah\b|\baffirm|\bcorrect\b|\bsure\b|\balways\b/.test(tl);
    var hasNo  = /\bno\b|\bnope\b|\bnever\b|\bnot\b/.test(tl);
    if (hasYes && !hasNo) return (q.coding['Yes'] !== undefined) ? q.coding['Yes'] : 0;
    if (hasNo  && !hasYes) return (q.coding['No']  !== undefined) ? q.coding['No']  : 1;
    return null;
  }

  // Ordinal Q8
  if (extracted && _MAP_ZOE_Q8_SCORES[extracted] !== undefined) return _MAP_ZOE_Q8_SCORES[extracted];
  var tl2 = transcript.toLowerCase();
  for (var key in _MAP_ZOE_Q8_SCORES) {
    if (tl2.indexOf(key) !== -1) return _MAP_ZOE_Q8_SCORES[key];
  }
  return null;
}

function _mzBuildSystem() {
  var lang = (window._mapZoeLang) || 'en';
  var L = MAP_I18N[lang] || MAP_I18N['en'];
  var lines = [
    'You are Zoe, a compassionate AI healthcare assistant helping a patient complete the MAP (Medication Adherence Profile) assessment.',
    'Listen to the patient\'s verbal response, extract their answer, and reply with warmth.',
    '',
    'MAP QUESTIONS (8 total):'
  ];
  MAP_QUESTIONS.forEach(function(q, i) {
    var lq = (L.questions && L.questions[i]) || {};
    var qText = lq.text || q.text;
    var info = 'Q' + (i+1) + ' [Domain:' + q.label + '] [' + q.type + ']: ' + qText;
    if (q.type === 'binary') {
      var keys = Object.keys(q.coding);
      info += ' | Coding: ' + keys.map(function(k) { return k + '=' + q.coding[k]; }).join(', ');
      info += ' | extracted_answer must be "yes" or "no" (English)';
    } else {
      info += ' | Options: never=1.0, rarely=0.75, sometimes=0.5, often=0.25, all the time=0.0';
      info += ' | extracted_answer must be one of those exact English strings';
    }
    lines.push(info);
  });
  lines.push('');
  lines.push('Return JSON only: {"extracted_answer":"<english answer>","response":"<1-2 sentence warm reply>","confidence":"high|medium|low"}');
  lines.push('Never mention scores or percentages. Keep responses under 40 words. If unclear, set confidence to "low" and ask for clarification.');
  return lines.join('\n');
}

function mapZoeOpen() {
  var overlay = document.getElementById('map-zoe-overlay');
  if (!overlay) return;
  _mapZoeActive      = true;
  _mapZoeCurrQ       = 0;
  _mapZoeHistory     = [];
  _mapZoeSessionSys  = _mzBuildSystem();

  var pillsEl = document.getElementById('map-zoe-pills');
  if (pillsEl) {
    pillsEl.innerHTML = MAP_QUESTIONS.map(function() { return '<div class="map-zoe-pill"></div>'; }).join('');
  }
  _mzSetPill(0, 'active');
  if (MAP_QUESTIONS[0]) _mzSetDomainBadge(MAP_QUESTIONS[0].label);
  _mzShowControls(false);
  _mzSetTranscript('');
  _mzSetResponse('');
  _mzSetOrb('idle');
  overlay.classList.add('active');

  setTimeout(function() {
    var lang = (window._mapZoeLang) || 'en';
    var L = MAP_I18N[lang] || MAP_I18N['en'];
    var intro = (L.zoeIntro) || "Hello, I'm Zoe. I'll read each question aloud and listen to your response. Let's begin with the MAP assessment.";
    _mzSetStatus('Speaking...');
    _mzSetQ(intro);
    _mzSpeak(intro, function() { _mzPlayIntroThenListen(); });
  }, 300);
}

function mapZoeClose() {
  _mapZoeActive = false;
  if (_mapZoeRecognition) { try { _mapZoeRecognition.stop(); } catch(e) {} _mapZoeRecognition = null; }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  var overlay = document.getElementById('map-zoe-overlay');
  if (overlay) overlay.classList.remove('active');
  _mapZoeListening  = false;
  _mapZoeProcessing = false;
}

function _mzPlayIntroThenListen() {
  if (!_mapZoeActive) return;
  var qData = _mzGetQuestion(_mapZoeCurrQ);
  if (!qData) { mapZoeClose(); return; }

  _mzSetDomainBadge(qData.q.label);
  _mzSetStatus('Question ' + (_mapZoeCurrQ + 1) + ' of ' + MAP_QUESTIONS.length);
  _mzSetQ(qData.text);
  _mzSetTranscript('');
  _mzSetResponse('');
  _mzShowControls(false);

  _mzSpeak(qData.text, function() {
    if (!_mapZoeActive) return;
    _mzSetStatus('Tap to Speak');
    _mzShowControls(true);
  });
}

function mapZoeStartListening() {
  if (!_mapZoeActive || _mapZoeListening || _mapZoeProcessing) return;
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    _mzSetStatus('Voice input not supported in this browser');
    _mzShowControls(true);
    return;
  }

  _mapZoeListening = true;
  _mzSetStatus('Listening...');
  _mzSetOrb('listening');
  _mzShowControls(false);
  if (window.speechSynthesis) window.speechSynthesis.cancel();

  var rec = new SpeechRec();
  var lang = (window._mapZoeLang) || 'en';
  rec.lang = _MAP_ZOE_BCP47[lang] || 'en-US';
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  _mapZoeRecognition = rec;

  rec.onresult = function(evt) {
    var transcript = evt.results[0][0].transcript;
    _mzSetTranscript(transcript);
    _mapZoeListening  = false;
    _mapZoeProcessing = true;
    _mzSetOrb('idle');
    _mzSetStatus('Processing...');
    _mzHandleResponse(transcript);
  };

  rec.onerror = function() {
    _mapZoeListening = false;
    _mzSetOrb('idle');
    _mzSetStatus("Couldn't hear you. Tap to try again.");
    _mzShowControls(true);
  };

  rec.onend = function() {
    _mapZoeListening = false;
    if (!_mapZoeProcessing) {
      _mzSetOrb('idle');
      _mzSetStatus('Tap to Speak');
      _mzShowControls(true);
    }
  };

  rec.start();
}

function mapZoeSkip() {
  if (!_mapZoeActive) return;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  _mzSetPill(_mapZoeCurrQ, 'skipped');
  _mapZoeCurrQ++;
  if (_mapZoeCurrQ >= MAP_QUESTIONS.length) {
    mapZoeClose();
    return;
  }
  _mzSetPill(_mapZoeCurrQ, 'active');
  _mzPlayIntroThenListen();
}

function _mzHandleResponse(transcript) {
  var qIdx     = _mapZoeCurrQ;
  var messages = _mapZoeHistory.concat([{ role: 'user', content: 'Q' + (qIdx+1) + ' patient response: ' + transcript }]);

  fetch('/lambda-proxy/zoe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 350,
      system: _mapZoeSessionSys,
      messages: messages
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    _mapZoeProcessing = false;
    if (!_mapZoeActive) return;

    var raw = (data && data.content && data.content[0] && data.content[0].text) || '';
    var parsed = null;
    try {
      var m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch(e) {}

    var responseText = (parsed && parsed.response) || 'Thank you for sharing that.';
    _mzSetResponse(responseText);

    var score = _mzExtractScore(qIdx, transcript, parsed);

    if (score !== null) {
      _mzSetPill(qIdx, 'done');
      _mapZoeHistory.push({ role: 'user',      content: 'Q' + (qIdx+1) + ' patient response: ' + transcript });
      _mapZoeHistory.push({ role: 'assistant', content: raw });

      if (window._mapZoeOnAnswer) window._mapZoeOnAnswer(qIdx, score);

      _mzSpeak(responseText, function() {
        if (!_mapZoeActive) return;
        _mapZoeCurrQ++;
        if (_mapZoeCurrQ >= MAP_QUESTIONS.length) {
          _mzSetStatus('Assessment Complete');
          _mzSetQ('You have answered all 8 questions. Thank you!');
          _mzSpeak('Wonderful. You have completed all eight questions of the MAP assessment. Well done.', function() {
            setTimeout(function() {
              if (window._mapZoeOnComplete) window._mapZoeOnComplete();
              mapZoeClose();
            }, 1200);
          });
          return;
        }
        _mzSetPill(_mapZoeCurrQ, 'active');
        _mzPlayIntroThenListen();
      });
    } else {
      // Low confidence: ask for clarification
      var clarify = responseText + ' Could you please answer more clearly?';
      _mzSetResponse(clarify);
      _mzSpeak(clarify, function() {
        if (!_mapZoeActive) return;
        _mzSetStatus('Tap to Speak');
        _mzShowControls(true);
      });
    }
  })
  .catch(function(err) {
    _mapZoeProcessing = false;
    if (!_mapZoeActive) return;
    console.warn('MAP Zoe fetch error:', err);
    _mzSetStatus('Connection error. Tap to try again.');
    _mzShowControls(true);
  });
}
