// ══════════════════════════════════════════════
// CONSENT SCREEN
// ══════════════════════════════════════════════

/**
 * Populates the consent screen eyebrow, purpose, and data-storage paragraphs
 * to match the instrument(s) the participant is about to complete.
 * Call before showScreen('screen-consent').
 * @param {'map'|'mmas'|'peacs'|'both'} instrument - Which instrument(s) are being administered
 * @returns {void}
 */
function renderConsentForInstrument(instrument) {
  const eyebrow = document.getElementById('consent-eyebrow');
  const purpose = document.getElementById('consent-purpose-body');
  const data    = document.getElementById('consent-data-body');
  if (!eyebrow || !purpose || !data) return;

  // Per-language consent text. Languages not listed fall back to 'en'.
  const _consent = {
    en: {
      map:   { eyebrow: 'Informed Consent · MAP',
               purpose: 'The ATLAS platform is a global, community-based research infrastructure. The Multidimensional Adherence Parameters (MAP) instrument assesses medication adherence across eight behavioral dimensions — capturing not just whether you take medication, but how your adherence pattern is structured over time. Your responses contribute to real-time population health mapping across more than 150 countries. No names, email addresses, or identifying personal information are collected at any point.',
               data:    'Your responses are stored anonymously. We record: your MAP composite score and domain subscores (Architectural, Executive, and Contextual adherence), your approximate geographic location (country and city level only), a random session ID (not linked to you), and a timestamp. No personally identifiable information is collected or retained.' },
      mmas:  { eyebrow: 'Informed Consent · MMAS-8',
               purpose: 'The ATLAS platform is a global, community-based research infrastructure measuring medication adherence using the validated Morisky Medication Adherence Scale (MMAS-8), developed by Dr. Donald E. Morisky. Your responses contribute to real-time population health mapping across more than 150 countries. No names, email addresses, or identifying personal information are collected at any point.',
               data:    'Your responses are stored anonymously. We record: your MMAS-8 score, your approximate geographic location (country and city, derived from your browser or IP address), a random session ID (not linked to you), and a timestamp. No personally identifiable information is collected or retained.' },
      peacs: { eyebrow: 'Informed Consent · PEACS v2.0',
               purpose: 'The ATLAS platform collects behavioral health data using PEACS v2.0 (Predictive Emergence Analysis of Contextual Strata), grounded in the Theory of Predictive Emergence. PEACS generates a PE score (0–1) reflecting the convergence of your behavioral Baseline, Movement capacity, and Contextual Strata. Your responses contribute to global behavioral research across more than 150 countries. No names, email addresses, or identifying personal information are collected at any point.',
               data:    'Your responses are stored anonymously. We record: your PEACS PE score and domain subscores (Base, Movement, Strata), your approximate geographic location (country and city level only), a random session ID (not linked to you), and a timestamp. No personally identifiable information is collected or retained.' },
      both:  { eyebrow: 'Informed Consent · MMAS-8 + PEACS',
               purpose: 'This session uses two complementary instruments. The MMAS-8 (Morisky Medication Adherence Scale) measures overall medication adherence with a validated 8-item scale. PEACS v2.0 (Predictive Emergence Analysis of Contextual Strata) generates a behavioral PE score across three domains: Baseline, Movement, and Strata. Both instruments contribute to global adherence research across more than 150 countries. No names, email addresses, or identifying personal information are collected.',
               data:    'Your responses are stored anonymously. We record: your MMAS-8 score, your PEACS PE score and domain subscores, your approximate geographic location (country and city level only), a random session ID (not linked to you), and a timestamp. No personally identifiable information is collected or retained.' },
    },
    el: {
      map:   { eyebrow: 'Ενημερωμένη Συγκατάθεση · MAP',
               purpose: 'Η πλατφόρμα ATLAS είναι μια παγκόσμια, κοινοτική ερευνητική υποδομή. Το εργαλείο MAP αξιολογεί την τήρηση της φαρμακευτικής αγωγής σε οκτώ συμπεριφορικές διαστάσεις — καταγράφει όχι μόνο αν παίρνετε το φάρμακό σας, αλλά και πώς είναι δομημένο το μοτίβο τήρησής σας. Οι απαντήσεις σας συμβάλλουν στη χαρτογράφηση της δημόσιας υγείας σε πραγματικό χρόνο σε περισσότερες από 150 χώρες. Δεν συλλέγονται ονόματα, διευθύνσεις email ή άλλα προσωπικά στοιχεία.',
               data:    'Οι απαντήσεις σας αποθηκεύονται ανώνυμα. Καταγράφουμε: τη σύνθετη βαθμολογία MAP και τις υποκλίμακες (Αρχιτεκτονική, Εκτελεστική και Συναισθηματική τήρηση), την κατά προσέγγιση γεωγραφική σας τοποθεσία (μόνο σε επίπεδο χώρας και πόλης), ένα τυχαίο αναγνωριστικό συνεδρίας (που δεν συνδέεται με εσάς) και μια χρονική σφραγίδα. Δεν συλλέγονται ή διατηρούνται στοιχεία ταυτοποίησης.' },
      mmas:  { eyebrow: 'Ενημερωμένη Συγκατάθεση · MMAS-8',
               purpose: 'Η πλατφόρμα ATLAS μετρά την τήρηση της φαρμακευτικής αγωγής χρησιμοποιώντας την επικυρωμένη Κλίμακα Τήρησης Φαρμακευτικής Αγωγής Morisky (MMAS-8). Οι απαντήσεις σας συμβάλλουν στη χαρτογράφηση της δημόσιας υγείας σε πραγματικό χρόνο σε περισσότερες από 150 χώρες.',
               data:    'Οι απαντήσεις σας αποθηκεύονται ανώνυμα. Καταγράφουμε: τη βαθμολογία MMAS-8, την κατά προσέγγιση γεωγραφική σας τοποθεσία, ένα τυχαίο αναγνωριστικό συνεδρίας και μια χρονική σφραγίδα.' },
      peacs: { eyebrow: 'Ενημερωμένη Συγκατάθεση · PEACS v2.0',
               purpose: 'Η πλατφόρμα ATLAS συλλέγει δεδομένα συμπεριφορικής υγείας με το PEACS v2.0. Οι απαντήσεις σας συμβάλλουν στην παγκόσμια έρευνα συμπεριφοράς σε περισσότερες από 150 χώρες.',
               data:    'Οι απαντήσεις σας αποθηκεύονται ανώνυμα. Καταγράφουμε: τη βαθμολογία PE και τις υποκλίμακες PEACS, την κατά προσέγγιση γεωγραφική σας τοποθεσία, ένα τυχαίο αναγνωριστικό συνεδρίας και μια χρονική σφραγίδα.' },
      both:  { eyebrow: 'Ενημερωμένη Συγκατάθεση · MMAS-8 + PEACS',
               purpose: 'Αυτή η συνεδρία χρησιμοποιεί δύο συμπληρωματικά εργαλεία: το MMAS-8 και το PEACS v2.0. Και τα δύο συμβάλλουν στην παγκόσμια έρευνα τήρησης αγωγής σε περισσότερες από 150 χώρες.',
               data:    'Οι απαντήσεις σας αποθηκεύονται ανώνυμα. Καταγράφουμε τις βαθμολογίες MMAS-8 και PEACS, την κατά προσέγγιση τοποθεσία σας, ένα τυχαίο αναγνωριστικό συνεδρίας και μια χρονική σφραγίδα.' },
    },
    ar: {
      map:   { eyebrow: 'الموافقة المستنيرة · MAP',
               purpose: 'منصة ATLAS هي بنية تحتية بحثية مجتمعية عالمية. تقيّم أداة MAP الالتزام بالأدوية عبر ثماني أبعاد سلوكية — إذ لا تقتصر على تسجيل ما إذا كنت تتناول الدواء، بل تتتبع أيضاً كيفية تنظيم نمط التزامك. تُسهم إجاباتك في رسم خرائط الصحة العامة في الوقت الفعلي في أكثر من 150 دولة. لا تُجمع أي أسماء أو عناوين بريد إلكتروني أو معلومات تعريفية شخصية.',
               data:    'تُخزَّن إجاباتك بصورة مجهولة. نقوم بتسجيل: درجة MAP المركّبة ودرجات المحاور الفرعية، وموقعك الجغرافي التقريبي (على مستوى الدولة والمدينة فقط)، ومعرّف جلسة عشوائي (غير مرتبط بك)، وطابع زمني. لا تُجمع أي معلومات تعريفية شخصية.' },
      mmas:  { eyebrow: 'الموافقة المستنيرة · MMAS-8',
               purpose: 'منصة ATLAS تقيس الالتزام بالأدوية باستخدام مقياس موريسكي للالتزام الدوائي (MMAS-8). تُسهم إجاباتك في رسم خرائط الصحة العامة في الوقت الفعلي في أكثر من 150 دولة.',
               data:    'تُخزَّن إجاباتك بصورة مجهولة. نقوم بتسجيل: درجة MMAS-8، وموقعك الجغرافي التقريبي، ومعرّف جلسة عشوائي، وطابع زمني.' },
      peacs: { eyebrow: 'الموافقة المستنيرة · PEACS v2.0',
               purpose: 'تجمع منصة ATLAS بيانات الصحة السلوكية باستخدام PEACS v2.0. تُسهم إجاباتك في البحث السلوكي العالمي في أكثر من 150 دولة.',
               data:    'تُخزَّن إجاباتك بصورة مجهولة. نقوم بتسجيل: درجة PE ودرجات المحاور الفرعية لـ PEACS، وموقعك التقريبي، ومعرّف جلسة عشوائي، وطابع زمني.' },
      both:  { eyebrow: 'الموافقة المستنيرة · MMAS-8 + PEACS',
               purpose: 'تستخدم هذه الجلسة أداتين تكمّلان بعضهما: MMAS-8 وPEACS v2.0. كلتاهما تُسهمان في بحث الالتزام الدوائي العالمي في أكثر من 150 دولة.',
               data:    'تُخزَّن إجاباتك بصورة مجهولة. نقوم بتسجيل درجات MMAS-8 وPEACS، وموقعك التقريبي، ومعرّف جلسة عشوائي، وطابع زمني.' },
    },
    es: {
      map:   { eyebrow: 'Consentimiento Informado · MAP',
               purpose: 'La plataforma ATLAS es una infraestructura de investigación comunitaria global. El instrumento MAP evalúa la adherencia a la medicación en ocho dimensiones conductuales: no solo si toma su medicamento, sino cómo está estructurado su patrón de adherencia. Sus respuestas contribuyen a la cartografía de salud pública en tiempo real en más de 150 países. No se recopilan nombres, correos electrónicos ni información personal identificable.',
               data:    'Sus respuestas se almacenan de forma anónima. Registramos: su puntuación compuesta MAP y subpuntuaciones de dominio, su ubicación geográfica aproximada (solo país y ciudad), un ID de sesión aleatorio (no vinculado a usted) y una marca de tiempo. No se recopila ni retiene información de identificación personal.' },
      mmas:  { eyebrow: 'Consentimiento Informado · MMAS-8',
               purpose: 'La plataforma ATLAS mide la adherencia a la medicación usando la Escala de Adherencia de Morisky (MMAS-8). Sus respuestas contribuyen a la cartografía de salud pública en tiempo real en más de 150 países.',
               data:    'Sus respuestas se almacenan de forma anónima. Registramos: su puntuación MMAS-8, su ubicación geográfica aproximada, un ID de sesión aleatorio y una marca de tiempo.' },
      peacs: { eyebrow: 'Consentimiento Informado · PEACS v2.0',
               purpose: 'La plataforma ATLAS recopila datos de salud conductual con PEACS v2.0. Sus respuestas contribuyen a la investigación conductual global en más de 150 países.',
               data:    'Sus respuestas se almacenan de forma anónima. Registramos: su puntuación PE y subpuntuaciones PEACS, su ubicación aproximada, un ID de sesión aleatorio y una marca de tiempo.' },
      both:  { eyebrow: 'Consentimiento Informado · MMAS-8 + PEACS',
               purpose: 'Esta sesión utiliza dos instrumentos complementarios: MMAS-8 y PEACS v2.0. Ambos contribuyen a la investigación global de adherencia en más de 150 países.',
               data:    'Sus respuestas se almacenan de forma anónima. Registramos las puntuaciones MMAS-8 y PEACS, su ubicación aproximada, un ID de sesión aleatorio y una marca de tiempo.' },
    },
    de: {
      map:   { eyebrow: 'Einwilligungserklärung · MAP',
               purpose: 'Die ATLAS-Plattform ist eine globale, gemeinschaftsbasierte Forschungsinfrastruktur. Das MAP-Instrument bewertet die Medikamentenadhärenz in acht Verhaltensdimensionen — es erfasst nicht nur, ob Sie Ihre Medikamente einnehmen, sondern wie Ihr Adhärenzmuster strukturiert ist. Ihre Antworten tragen zur Echtzeit-Gesundheitskartierung in mehr als 150 Ländern bei. Es werden keine Namen, E-Mail-Adressen oder personenbezogenen Daten erfasst.',
               data:    'Ihre Antworten werden anonym gespeichert. Wir erfassen: Ihren MAP-Gesamtwert und Domänen-Teilwerte (Architektonische, Ausführende und Kontextuelle Adhärenz), Ihren ungefähren geografischen Standort (nur auf Länder- und Stadtebene), eine zufällige Sitzungs-ID (nicht mit Ihnen verknüpft) und einen Zeitstempel. Es werden keine personenbezogenen Daten erfasst oder gespeichert.' },
      mmas:  { eyebrow: 'Einwilligungserklärung · MMAS-8',
               purpose: 'Die ATLAS-Plattform misst die Medikamentenadhärenz mithilfe der validierten Morisky Medication Adherence Scale (MMAS-8). Ihre Antworten tragen zur Echtzeit-Gesundheitskartierung in mehr als 150 Ländern bei.',
               data:    'Ihre Antworten werden anonym gespeichert. Wir erfassen: Ihren MMAS-8-Wert, Ihren ungefähren geografischen Standort, eine zufällige Sitzungs-ID und einen Zeitstempel.' },
      peacs: { eyebrow: 'Einwilligungserklärung · PEACS v2.0',
               purpose: 'Die ATLAS-Plattform erfasst Verhaltensdaten mit PEACS v2.0. Ihre Antworten tragen zur globalen Verhaltensforschung in mehr als 150 Ländern bei.',
               data:    'Ihre Antworten werden anonym gespeichert. Wir erfassen: Ihren PE-Wert und PEACS-Teilwerte, Ihren ungefähren Standort, eine zufällige Sitzungs-ID und einen Zeitstempel.' },
      both:  { eyebrow: 'Einwilligungserklärung · MMAS-8 + PEACS',
               purpose: 'Diese Sitzung verwendet zwei sich ergänzende Instrumente: MMAS-8 und PEACS v2.0. Beide tragen zur globalen Adhärenzforschung in mehr als 150 Ländern bei.',
               data:    'Ihre Antworten werden anonym gespeichert. Wir erfassen die MMAS-8- und PEACS-Werte, Ihren ungefähren Standort, eine zufällige Sitzungs-ID und einen Zeitstempel.' },
    },
    fr: {
      map:   { eyebrow: 'Consentement Éclairé · MAP',
               purpose: "La plateforme ATLAS est une infrastructure de recherche mondiale basée sur la communauté. L'instrument MAP évalue l'observance thérapeutique selon huit dimensions comportementales — il ne mesure pas seulement si vous prenez vos médicaments, mais aussi comment votre schéma d'observance est structuré. Vos réponses contribuent à la cartographie de la santé publique en temps réel dans plus de 150 pays. Aucun nom, adresse e-mail ou information personnelle identifiable n'est collecté.",
               data:    "Vos réponses sont stockées de manière anonyme. Nous enregistrons : votre score MAP composite et sous-scores de domaine, votre localisation géographique approximative (pays et ville uniquement), un identifiant de session aléatoire (non lié à vous) et un horodatage. Aucune information personnelle identifiable n'est collectée ou conservée." },
      mmas:  { eyebrow: 'Consentement Éclairé · MMAS-8',
               purpose: "La plateforme ATLAS mesure l'observance thérapeutique à l'aide de l'Échelle d'Observance de Morisky (MMAS-8). Vos réponses contribuent à la cartographie de la santé publique en temps réel dans plus de 150 pays.",
               data:    "Vos réponses sont stockées anonymement. Nous enregistrons : votre score MMAS-8, votre localisation approximative, un identifiant de session aléatoire et un horodatage." },
      peacs: { eyebrow: 'Consentement Éclairé · PEACS v2.0',
               purpose: "La plateforme ATLAS collecte des données de santé comportementale avec PEACS v2.0. Vos réponses contribuent à la recherche comportementale mondiale dans plus de 150 pays.",
               data:    "Vos réponses sont stockées anonymement. Nous enregistrons : votre score PE et sous-scores PEACS, votre localisation approximative, un identifiant de session aléatoire et un horodatage." },
      both:  { eyebrow: 'Consentement Éclairé · MMAS-8 + PEACS',
               purpose: "Cette session utilise deux instruments complémentaires : MMAS-8 et PEACS v2.0. Tous deux contribuent à la recherche mondiale sur l'observance dans plus de 150 pays.",
               data:    "Vos réponses sont stockées anonymement. Nous enregistrons les scores MMAS-8 et PEACS, votre localisation approximative, un identifiant de session aléatoire et un horodatage." },
    },
    it: {
      map:   { eyebrow: 'Consenso Informato · MAP',
               purpose: "La piattaforma ATLAS è un'infrastruttura di ricerca globale basata sulla comunità. Lo strumento MAP valuta l'aderenza terapeutica in otto dimensioni comportamentali. Le sue risposte contribuiscono alla mappatura della salute pubblica in tempo reale in più di 150 paesi. Non vengono raccolti nomi, indirizzi e-mail o informazioni personali identificabili.",
               data:    'Le sue risposte vengono archiviate in modo anonimo. Registriamo: il punteggio composito MAP e i punteggi di sottoscala, la sua posizione geografica approssimativa (solo paese e città), un ID di sessione casuale (non collegato a lei) e un timestamp.' },
      mmas:  { eyebrow: 'Consenso Informato · MMAS-8',
               purpose: "La piattaforma ATLAS misura l'aderenza terapeutica usando la Scala MMAS-8 di Morisky. Le sue risposte contribuiscono alla mappatura della salute pubblica in più di 150 paesi.",
               data:    'Le sue risposte sono archiviate anonimamente. Registriamo: il punteggio MMAS-8, la posizione geografica approssimativa, un ID di sessione casuale e un timestamp.' },
      peacs: { eyebrow: 'Consenso Informato · PEACS v2.0',
               purpose: 'La piattaforma ATLAS raccoglie dati di salute comportamentale con PEACS v2.0. Le sue risposte contribuiscono alla ricerca comportamentale globale in più di 150 paesi.',
               data:    'Le sue risposte sono archiviate anonimamente. Registriamo: il punteggio PE e i sottopunteggi PEACS, la posizione approssimativa, un ID di sessione casuale e un timestamp.' },
      both:  { eyebrow: 'Consenso Informato · MMAS-8 + PEACS',
               purpose: 'Questa sessione utilizza due strumenti complementari: MMAS-8 e PEACS v2.0. Entrambi contribuiscono alla ricerca globale sull\'aderenza in più di 150 paesi.',
               data:    'Le sue risposte sono archiviate anonimamente. Registriamo i punteggi MMAS-8 e PEACS, la posizione approssimativa, un ID di sessione casuale e un timestamp.' },
    },
    pt: {
      map:   { eyebrow: 'Consentimento Informado · MAP',
               purpose: 'A plataforma ATLAS é uma infraestrutura de pesquisa global baseada na comunidade. O instrumento MAP avalia a adesão à medicação em oito dimensões comportamentais. Suas respostas contribuem para o mapeamento da saúde pública em tempo real em mais de 150 países. Nenhum nome, endereço de e-mail ou informação pessoal identificável é coletada.',
               data:    'Suas respostas são armazenadas anonimamente. Registramos: sua pontuação composta MAP e subpontuações de domínio, sua localização geográfica aproximada (apenas país e cidade), um ID de sessão aleatório (não vinculado a você) e um timestamp.' },
      mmas:  { eyebrow: 'Consentimento Informado · MMAS-8',
               purpose: 'A plataforma ATLAS mede a adesão à medicação usando a Escala MMAS-8 de Morisky. Suas respostas contribuem para o mapeamento da saúde pública em tempo real em mais de 150 países.',
               data:    'Suas respostas são armazenadas anonimamente. Registramos: sua pontuação MMAS-8, sua localização geográfica aproximada, um ID de sessão aleatório e um timestamp.' },
      peacs: { eyebrow: 'Consentimento Informado · PEACS v2.0',
               purpose: 'A plataforma ATLAS coleta dados de saúde comportamental com PEACS v2.0. Suas respostas contribuem para a pesquisa comportamental global em mais de 150 países.',
               data:    'Suas respostas são armazenadas anonimamente. Registramos: sua pontuação PE e subpontuações PEACS, sua localização aproximada, um ID de sessão aleatório e um timestamp.' },
      both:  { eyebrow: 'Consentimento Informado · MMAS-8 + PEACS',
               purpose: 'Esta sessão usa dois instrumentos complementares: MMAS-8 e PEACS v2.0. Ambos contribuem para a pesquisa global de adesão em mais de 150 países.',
               data:    'Suas respostas são armazenadas anonimamente. Registramos as pontuações MMAS-8 e PEACS, sua localização aproximada, um ID de sessão aleatório e um timestamp.' },
    },
    ru: {
      map:   { eyebrow: 'Информированное согласие · MAP',
               purpose: 'Платформа ATLAS — это глобальная исследовательская инфраструктура. Инструмент MAP оценивает приверженность лечению по восьми поведенческим измерениям. Ваши ответы вносят вклад в картографирование общественного здоровья в реальном времени в более чем 150 странах. Личные данные не собираются.',
               data:    'Ваши ответы хранятся анонимно. Мы фиксируем: сводный балл MAP и баллы по субшкалам, ваше приблизительное местоположение (только страна и город), случайный идентификатор сессии и временную метку.' },
      mmas:  { eyebrow: 'Информированное согласие · MMAS-8',
               purpose: 'Платформа ATLAS измеряет приверженность лечению с помощью шкалы MMAS-8 Мориски. Ваши ответы вносят вклад в картографирование здоровья в более чем 150 странах.',
               data:    'Ваши ответы хранятся анонимно. Мы фиксируем: балл MMAS-8, приблизительное местоположение, идентификатор сессии и временную метку.' },
      peacs: { eyebrow: 'Информированное согласие · PEACS v2.0',
               purpose: 'Платформа ATLAS собирает данные поведенческого здоровья с помощью PEACS v2.0. Ваши ответы вносят вклад в глобальные поведенческие исследования в более чем 150 странах.',
               data:    'Ваши ответы хранятся анонимно. Мы фиксируем: балл PE и субшкалы PEACS, приблизительное местоположение, идентификатор сессии и временную метку.' },
      both:  { eyebrow: 'Информированное согласие · MMAS-8 + PEACS',
               purpose: 'В этой сессии используются два взаимодополняющих инструмента: MMAS-8 и PEACS v2.0. Оба вносят вклад в глобальные исследования приверженности в более чем 150 странах.',
               data:    'Ваши ответы хранятся анонимно. Мы фиксируем баллы MMAS-8 и PEACS, приблизительное местоположение, идентификатор сессии и временную метку.' },
    },
    tr: {
      map:   { eyebrow: 'Bilgilendirilmiş Onam · MAP',
               purpose: "ATLAS platformu, küresel, toplum tabanlı bir araştırma altyapısıdır. MAP aracı, ilaç uyumunu sekiz davranışsal boyutta değerlendirir. Yanıtlarınız, 150'den fazla ülkede gerçek zamanlı halk sağlığı haritalama çalışmalarına katkıda bulunur. Kişisel bilgi toplanmaz.",
               data:    "Yanıtlarınız anonim olarak saklanır. MAP puanınızı ve alt puanlarını, yaklaşık coğrafi konumunuzu, rastgele bir oturum kimliğini ve zaman damgasını kaydederiz." },
      mmas:  { eyebrow: 'Bilgilendirilmiş Onam · MMAS-8',
               purpose: "ATLAS platformu, Morisky İlaç Uyum Ölçeği (MMAS-8) kullanarak ilaç uyumunu ölçer. Yanıtlarınız 150'den fazla ülkede sağlık haritalama çalışmalarına katkıda bulunur.",
               data:    'Yanıtlarınız anonim olarak saklanır. MMAS-8 puanınızı, yaklaşık konumunuzu, rastgele oturum kimliğini ve zaman damgasını kaydederiz.' },
      peacs: { eyebrow: 'Bilgilendirilmiş Onam · PEACS v2.0',
               purpose: "ATLAS platformu, PEACS v2.0 ile davranışsal sağlık verileri toplar. Yanıtlarınız 150'den fazla ülkede küresel davranışsal araştırmalara katkıda bulunur.",
               data:    'Yanıtlarınız anonim olarak saklanır. PE puanınızı ve PEACS alt puanlarını, yaklaşık konumunuzu, oturum kimliğini ve zaman damgasını kaydederiz.' },
      both:  { eyebrow: 'Bilgilendirilmiş Onam · MMAS-8 + PEACS',
               purpose: "Bu oturum iki tamamlayıcı araç kullanır: MMAS-8 ve PEACS v2.0. Her ikisi de 150'den fazla ülkede küresel uyum araştırmalarına katkıda bulunur.",
               data:    'Yanıtlarınız anonim saklanır. MMAS-8 ve PEACS puanlarınızı, yaklaşık konumunuzu, oturum kimliğini ve zaman damgasını kaydederiz.' },
    },
    zh: {
      map:   { eyebrow: '知情同意书 · MAP',
               purpose: 'ATLAS平台是一个全球性的社区研究基础设施。MAP工具通过八个行为维度评估药物依从性。您的回答有助于实时绘制150多个国家的公共健康地图。不收集任何个人身份信息。',
               data:    '您的回答以匿名方式存储。我们记录：您的MAP综合评分及各领域子分、您的大致地理位置（仅限国家和城市）、随机会话ID以及时间戳。' },
      mmas:  { eyebrow: '知情同意书 · MMAS-8',
               purpose: 'ATLAS平台使用Morisky药物依从性量表（MMAS-8）评估用药依从性。您的回答有助于实时绘制150多个国家的健康地图。',
               data:    '您的回答以匿名方式存储。我们记录：您的MMAS-8分数、大致地理位置、随机会话ID和时间戳。' },
      peacs: { eyebrow: '知情同意书 · PEACS v2.0',
               purpose: 'ATLAS平台使用PEACS v2.0收集行为健康数据。您的回答有助于150多个国家的全球行为研究。',
               data:    '您的回答以匿名方式存储。我们记录：PE分数及PEACS子分、大致位置、随机会话ID和时间戳。' },
      both:  { eyebrow: '知情同意书 · MMAS-8 + PEACS',
               purpose: '本次会话使用两种互补工具：MMAS-8和PEACS v2.0。两者均有助于150多个国家的全球依从性研究。',
               data:    '您的回答以匿名方式存储。我们记录MMAS-8和PEACS分数、大致位置、随机会话ID和时间戳。' },
    },
    'zh-TW': {
      map:   { eyebrow: '知情同意書 · MAP',
               purpose: 'ATLAS平台是一個全球性的社區研究基礎設施。MAP工具透過八個行為維度評估藥物依從性。您的回答有助於即時繪製150多個國家的公共健康地圖。不收集任何個人身份資訊。',
               data:    '您的回答以匿名方式儲存。我們記錄：您的MAP綜合評分及各領域子分、您的大致地理位置（僅限國家和城市）、隨機工作階段ID以及時間戳記。' },
      mmas:  { eyebrow: '知情同意書 · MMAS-8',
               purpose: 'ATLAS平台使用Morisky藥物依從性量表（MMAS-8）評估用藥依從性。您的回答有助於即時繪製150多個國家的健康地圖。',
               data:    '您的回答以匿名方式儲存。我們記錄：您的MMAS-8分數、大致地理位置、隨機工作階段ID和時間戳記。' },
      peacs: { eyebrow: '知情同意書 · PEACS v2.0',
               purpose: 'ATLAS平台使用PEACS v2.0收集行為健康數據。您的回答有助於150多個國家的全球行為研究。',
               data:    '您的回答以匿名方式儲存。我們記錄：PE分數及PEACS子分、大致位置、隨機工作階段ID和時間戳記。' },
      both:  { eyebrow: '知情同意書 · MMAS-8 + PEACS',
               purpose: '本次工作階段使用兩種互補工具：MMAS-8和PEACS v2.0。兩者均有助於150多個國家的全球依從性研究。',
               data:    '您的回答以匿名方式儲存。我們記錄MMAS-8和PEACS分數、大致位置、隨機工作階段ID和時間戳記。' },
    },
    ja: {
      map:   { eyebrow: 'インフォームドコンセント · MAP',
               purpose: 'ATLASプラットフォームは、グローバルなコミュニティベースの研究インフラです。MAPツールは8つの行動次元にわたって服薬アドヒアランスを評価します。回答は150か国以上でのリアルタイム公衆衛生マッピングに貢献します。個人情報は一切収集されません。',
               data:    '回答は匿名で保存されます。記録するのは：MAPの総合スコアとドメインサブスコア、おおよその地理的位置（国・都市レベルのみ）、ランダムなセッションID、タイムスタンプです。' },
      mmas:  { eyebrow: 'インフォームドコンセント · MMAS-8',
               purpose: 'ATLASプラットフォームは、Morisky服薬アドヒアランス尺度（MMAS-8）を使用して服薬アドヒアランスを測定します。回答は150か国以上での公衆衛生マッピングに貢献します。',
               data:    '回答は匿名で保存されます。MMAS-8スコア、おおよその地理的位置、ランダムなセッションID、タイムスタンプを記録します。' },
      peacs: { eyebrow: 'インフォームドコンセント · PEACS v2.0',
               purpose: 'ATLASプラットフォームはPEACS v2.0で行動的健康データを収集します。回答は150か国以上の世界的な行動研究に貢献します。',
               data:    '回答は匿名で保存されます。PEスコアとPEACsサブスコア、おおよその位置、ランダムセッションID、タイムスタンプを記録します。' },
      both:  { eyebrow: 'インフォームドコンセント · MMAS-8 + PEACS',
               purpose: 'このセッションでは2つの補完的なツール（MMAS-8とPEACS v2.0）を使用します。どちらも150か国以上でのグローバルなアドヒアランス研究に貢献します。',
               data:    '回答は匿名で保存されます。MMAS-8とPEACSのスコア、おおよその位置、セッションID、タイムスタンプを記録します。' },
    },
    ko: {
      map:   { eyebrow: '사전 동의서 · MAP',
               purpose: 'ATLAS 플랫폼은 글로벌 커뮤니티 기반 연구 인프라입니다. MAP 도구는 8가지 행동 차원에서 약물 순응도를 평가합니다. 귀하의 응답은 150개국 이상에서 실시간 공중 보건 매핑에 기여합니다. 개인 식별 정보는 수집되지 않습니다.',
               data:    '귀하의 응답은 익명으로 저장됩니다. MAP 종합 점수 및 도메인 하위 점수, 대략적인 지리적 위치, 임의 세션 ID, 타임스탬프를 기록합니다.' },
      mmas:  { eyebrow: '사전 동의서 · MMAS-8',
               purpose: 'ATLAS 플랫폼은 Morisky 약물 순응도 척도(MMAS-8)를 사용하여 약물 순응도를 측정합니다. 귀하의 응답은 150개국 이상에서 공중 보건 매핑에 기여합니다.',
               data:    '귀하의 응답은 익명으로 저장됩니다. MMAS-8 점수, 대략적인 지리적 위치, 임의 세션 ID, 타임스탬프를 기록합니다.' },
      peacs: { eyebrow: '사전 동의서 · PEACS v2.0',
               purpose: 'ATLAS 플랫폼은 PEACS v2.0으로 행동 건강 데이터를 수집합니다. 귀하의 응답은 150개국 이상의 글로벌 행동 연구에 기여합니다.',
               data:    '귀하의 응답은 익명으로 저장됩니다. PE 점수 및 PEACS 하위 점수, 대략적인 위치, 임의 세션 ID, 타임스탬프를 기록합니다.' },
      both:  { eyebrow: '사전 동의서 · MMAS-8 + PEACS',
               purpose: '이 세션은 두 가지 보완 도구(MMAS-8 및 PEACS v2.0)를 사용합니다. 둘 다 150개국 이상에서 글로벌 순응도 연구에 기여합니다.',
               data:    '귀하의 응답은 익명으로 저장됩니다. MMAS-8 및 PEACS 점수, 대략적인 위치, 세션 ID, 타임스탬프를 기록합니다.' },
    },
    hi: {
      map:   { eyebrow: 'सूचित सहमति · MAP',
               purpose: 'ATLAS प्लेटफ़ॉर्म एक वैश्विक, समुदाय-आधारित अनुसंधान अवसंरचना है। MAP उपकरण आठ व्यवहारिक आयामों में दवा अनुपालन का मूल्यांकन करता है। आपके उत्तर 150 से अधिक देशों में सार्वजनिक स्वास्थ्य मानचित्रण में योगदान करते हैं। कोई व्यक्तिगत जानकारी एकत्र नहीं की जाती।',
               data:    'आपके उत्तर गुमनाम रूप से संग्रहीत होते हैं। हम MAP स्कोर और सब-स्कोर, अनुमानित स्थान, सत्र ID और टाइमस्टैम्प रिकॉर्ड करते हैं।' },
      mmas:  { eyebrow: 'सूचित सहमति · MMAS-8',
               purpose: 'ATLAS प्लेटफ़ॉर्म Morisky MMAS-8 स्केल का उपयोग करके दवा अनुपालन मापता है। आपके उत्तर 150 से अधिक देशों में स्वास्थ्य मानचित्रण में योगदान करते हैं।',
               data:    'आपके उत्तर गुमनाम रूप से संग्रहीत होते हैं। हम MMAS-8 स्कोर, अनुमानित स्थान, सत्र ID और टाइमस्टैम्प रिकॉर्ड करते हैं।' },
      peacs: { eyebrow: 'सूचित सहमति · PEACS v2.0',
               purpose: 'ATLAS प्लेटफ़ॉर्म PEACS v2.0 के साथ व्यवहारिक स्वास्थ्य डेटा एकत्र करता है। आपके उत्तर 150 से अधिक देशों में वैश्विक व्यवहारिक अनुसंधान में योगदान करते हैं।',
               data:    'आपके उत्तर गुमनाम रूप से संग्रहीत होते हैं। हम PE स्कोर और PEACS सब-स्कोर, अनुमानित स्थान, सत्र ID और टाइमस्टैम्प रिकॉर्ड करते हैं।' },
      both:  { eyebrow: 'सूचित सहमति · MMAS-8 + PEACS',
               purpose: 'इस सत्र में दो पूरक उपकरणों का उपयोग किया जाता है: MMAS-8 और PEACS v2.0। दोनों 150 से अधिक देशों में वैश्विक अनुपालन अनुसंधान में योगदान करते हैं।',
               data:    'आपके उत्तर गुमनाम रूप से संग्रहीत होते हैं। हम MMAS-8 और PEACS स्कोर, अनुमानित स्थान, सत्र ID और टाइमस्टैम्प रिकॉर्ड करते हैं।' },
    },
    id: {
      map:   { eyebrow: 'Persetujuan Berdasarkan Informasi · MAP',
               purpose: 'Platform ATLAS adalah infrastruktur penelitian berbasis komunitas global. Instrumen MAP menilai kepatuhan pengobatan dalam delapan dimensi perilaku. Jawaban Anda berkontribusi pada pemetaan kesehatan masyarakat real-time di lebih dari 150 negara. Tidak ada informasi pribadi yang dikumpulkan.',
               data:    'Jawaban Anda disimpan secara anonim. Kami merekam: skor MAP komposit dan subskor domain, lokasi geografis perkiraan (hanya tingkat negara dan kota), ID sesi acak, dan cap waktu.' },
      mmas:  { eyebrow: 'Persetujuan Berdasarkan Informasi · MMAS-8',
               purpose: 'Platform ATLAS mengukur kepatuhan pengobatan menggunakan Skala Kepatuhan Obat Morisky (MMAS-8). Jawaban Anda berkontribusi pada pemetaan kesehatan di lebih dari 150 negara.',
               data:    'Jawaban Anda disimpan secara anonim. Kami merekam: skor MMAS-8, lokasi geografis perkiraan, ID sesi acak, dan cap waktu.' },
      peacs: { eyebrow: 'Persetujuan Berdasarkan Informasi · PEACS v2.0',
               purpose: 'Platform ATLAS mengumpulkan data kesehatan perilaku dengan PEACS v2.0. Jawaban Anda berkontribusi pada penelitian perilaku global di lebih dari 150 negara.',
               data:    'Jawaban Anda disimpan secara anonim. Kami merekam: skor PE dan subskor PEACS, lokasi perkiraan, ID sesi acak, dan cap waktu.' },
      both:  { eyebrow: 'Persetujuan Berdasarkan Informasi · MMAS-8 + PEACS',
               purpose: 'Sesi ini menggunakan dua instrumen pelengkap: MMAS-8 dan PEACS v2.0. Keduanya berkontribusi pada penelitian kepatuhan global di lebih dari 150 negara.',
               data:    'Jawaban Anda disimpan secara anonim. Kami merekam skor MMAS-8 dan PEACS, lokasi perkiraan, ID sesi acak, dan cap waktu.' },
    },
  };

  const _lang = (typeof mmasCurrentLang !== 'undefined' && mmasCurrentLang) ? mmasCurrentLang : 'en';
  const _langData = _consent[_lang] || _consent.en;
  const c = _langData[instrument] || _langData.map;
  eyebrow.textContent = c.eyebrow;
  purpose.textContent = c.purpose;
  data.textContent    = c.data;
}

/**
 * Shows the consent screen in patient mode, returning to the entry screen on back.
 * Applies patient-mode CSS class and triggers a language render pass.
 * @returns {void}
 */
function showPatientConsent() {
  _postConsentTarget = 'entry';
  document.body.classList.add('patient-mode');
  document.body.classList.remove('researcher-mode');
  showScreen('screen-consent');
  var _cLang = (typeof mmasCurrentLang !== 'undefined' && mmasCurrentLang) ? mmasCurrentLang : 'en';
  if (typeof renderPatientLanguage === 'function') renderPatientLanguage(_cLang);
}

// ══════════════════════════════════════════════
// MMAS-8 QUESTION DATA (60 languages)
// ══════════════════════════════════════════════

/**
 * @typedef {Object} MmasLanguageData
 * @property {string} name - English language name
 * @property {string} native - Native language name
 * @property {'ltr'|'rtl'} dir - Text direction
 * @property {string} q1 - Question 1 template (use {{COND}} for condition placeholder)
 * @property {string} q2 - Question 2 template
 * @property {string} q3 - Question 3 template
 * @property {string} q4 - Question 4 template
 * @property {string} q5 - Question 5 template
 * @property {string} q6 - Question 6 template
 * @property {string} q7 - Question 7 template
 * @property {string} q8 - Question 8 template
 * @property {string} q1_yes - "Yes" label for Q1
 * @property {string} q1_no - "No" label for Q1
 * @property {string} q8_never - "Never/Rarely" option for Q8
 * @property {string} q8_once - "Once in a while" option for Q8
 * @property {string} q8_sometimes - "Sometimes" option for Q8
 * @property {string} q8_usually - "Usually" option for Q8
 * @property {string} q8_always - "All the time" option for Q8
 */

/** @type {Object.<string, MmasLanguageData>} MMAS-8 question text keyed by BCP-47 language code */
const MMAS_QUESTIONS = {
  "en":{"name":"English","native":"English","dir":"ltr","q1":"Do you sometimes forget to take your {{COND}} pills?","q2":"People sometimes miss taking their medications for reasons other than forgetting. Over the past two weeks, were there any days when you did not take your {{COND}} medicine?","q3":"Have you ever cut back or stopped taking your medication without telling your doctor because you felt worse when you took it?","q4":"When you travel or leave home, do you sometimes forget to bring along your {{COND}} medication?","q5":"Did you take your {{COND}} medicine yesterday?","q6":"When you feel like your {{COND}} is under control, do you sometimes stop taking your medicine?","q7":"Taking medication every day is a real inconvenience for some people. Do you ever feel hassled about sticking to your {{COND}} treatment plan?","q8":"How often do you have difficulty remembering to take all your {{COND}} medication?","q1_yes":"Yes","q1_no":"No","q8_never":"Never/Rarely","q8_once":"Once in a while","q8_sometimes":"Sometimes","q8_usually":"Usually","q8_always":"All the time"},
  "af":{"name":"Afrikaans","native":"Afrikaans","dir":"ltr","q1":"Vergeet jy soms om jou {{COND}} pille te neem?","q2":"Mense misloop soms hul medikasie om redes anders as vergeetagtigheid. Gedurende die afgelope twee weke, was daar enige dae waarop jy nie jou {{COND}} medikasie geneem het nie?","q3":"Het jy al ooit jou medikasie verminder of opgehou sonder om jou dokter te vertel, omdat jy slegter gevoel het toe jy dit geneem het?","q4":"Wanneer jy reis of die huis verlaat, vergeet jy soms om jou {{COND}} medikasie saam te bring?","q5":"Het jy gister jou {{COND}} medikasie geneem?","q6":"Wanneer jy voel dat jou {{COND}} onder beheer is, hou jy soms op om jou medikasie te neem?","q7":"Dit is vir sommige mense 'n regte ongerief om elke dag medikasie te neem. Voel jy ooit lastig geval om jou {{COND}} behandelingsplan te volg?","q8":"Hoe dikwels het jy moeilikheid om te onthou om al jou {{COND}} medikasie te neem?","q1_yes":"Ja","q1_no":"Nee","q8_never":"Nooit/Selde","q8_once":"So nou en dan","q8_sometimes":"Soms","q8_usually":"Gewoonlik","q8_always":"Altyd"},
  "sq":{"name":"Albanian","native":"Shqip","dir":"ltr","q1":"A harroni ndonjëherë të merrni {{COND}} tabletat tuaja?","q2":"Njerëzit ndonjëherë humbasin marrjen e ilaçeve për arsye të tjera përveç harresës. Gjatë dy javëve të fundit, a pati ndonjë ditë kur nuk morët {{COND}} ilaçin tuaj?","q3":"A keni reduktuar ose ndaluar ndonjëherë marrjen e ilaçeve pa i thënë mjekut tuaj, sepse u ndjetë më keq kur i morët ato?","q4":"Kur udhëtoni ose largoheni nga shtëpia, a harroni ndonjëherë të merrni me vete {{COND}} ilaçin tuaj?","q5":"A morët {{COND}} ilaçin tuaj dje?","q6":"Kur ndiheni se {{COND}} juaj është nën kontroll, a ndaloni ndonjëherë të merrni ilaçin tuaj?","q7":"Marrja e ilaçeve çdo ditë është një shqetësim i vërtetë për disa njerëz. A ndiheni ndonjëherë të lodhur nga mbajtja e {{COND}} planit tuaj të trajtimit?","q8":"Sa shpesh keni vështirësi të mbani mend të merrni të gjitha {{COND}} ilaçet?","q1_yes":"Po","q1_no":"Jo","q8_never":"Kurrë/Rrallë","q8_once":"Herë pas here","q8_sometimes":"Ndonjëherë","q8_usually":"Zakonisht","q8_always":"Gjithmonë"},
  "ar":{"name":"Arabic","native":"العربية","dir":"rtl","q1":"هل تنسى أحيانًا تناول حبوب {{COND}}؟","q2":"يفوّت الناس أحيانًا تناول دوائهم لأسباب غير النسيان. خلال الأسبوعين الماضيين، هل كانت هناك أيام لم تتناول فيها دواء {{COND}}؟","q3":"هل سبق لك أن قللت أو توقفت عن تناول دوائك دون إخبار طبيبك لأنك شعرت بأنك أسوأ عندما تناولته؟","q4":"عندما تسافر أو تغادر المنزل، هل تنسى أحيانًا إحضار دواء {{COND}} معك؟","q5":"هل تناولت دواء {{COND}} أمس؟","q6":"عندما تشعر أن {{COND}} تحت السيطرة، هل تتوقف أحيانًا عن تناول دوائك؟","q7":"تناول الدواء كل يوم يعد إزعاجًا حقيقيًا لبعض الناس. هل تشعر بالانزعاج من الالتزام بخطة علاج {{COND}} الخاصة بك؟","q8":"كم مرة تجد صعوبة في تذكر تناول جميع أدوية {{COND}}؟","q1_yes":"نعم","q1_no":"لا","q8_never":"أبدًا/نادرًا","q8_once":"بين الحين والآخر","q8_sometimes":"أحيانًا","q8_usually":"عادةً","q8_always":"طوال الوقت"},
  "bn":{"name":"Bengali","native":"বাংলা","dir":"ltr","q1":"আপনি কি কখনও কখনও আপনার {{COND}} বড়ি নিতে ভুলে যান?","q2":"মানুষ কখনও কখনও ভুলে যাওয়া ছাড়া অন্য কারণে তাদের ওষুধ মিস করেন। গত দুই সপ্তাহে, এমন কোনো দিন কি ছিল যখন আপনি আপনার {{COND}} ওষুধ নেননি?","q3":"আপনি কি কখনও আপনার ডাক্তারকে না জানিয়ে আপনার ওষুধের ডোজ কমিয়েছেন বা বন্ধ করেছেন, কারণ আপনি ওষুধ গ্রহণ করলে আরও খারাপ অনুভব করতেন?","q4":"আপনি যখন ভ্রমণ করেন বা বাড়ি ছেড়ে যান, তখন কি কখনও কখনও আপনার {{COND}} ওষুধ সাথে আনতে ভুলে যান?","q5":"আপনি কি গতকাল আপনার {{COND}} ওষুধ নিয়েছিলেন?","q6":"যখন আপনি অনুভব করেন যে আপনার {{COND}} নিয়ন্ত্রণে রয়েছে, তখন কি আপনি কখনও কখনও আপনার ওষুধ নেওয়া বন্ধ করেন?","q7":"প্রতিদিন ওষুধ নেওয়া কিছু লোকের জন্য সত্যিই অসুবিধাজনক। আপনি কি কখনও আপনার {{COND}} চিকিৎসা পরিকল্পনা মেনে চলা সম্পর্কে বিরক্তি অনুভব করেন?","q8":"আপনার {{COND}} সমস্ত ওষুধ গ্রহণের কথা মনে রাখতে আপনার কতটা অসুবিধা হয়?","q1_yes":"হ্যাঁ","q1_no":"না","q8_never":"কখনো না/কদাচিৎ","q8_once":"মাঝে মাঝে","q8_sometimes":"কখনো কখনো","q8_usually":"সাধারণত","q8_always":"সবসময়"},
  "zh":{"name":"Chinese (Simplified)","native":"中文(简体)","dir":"ltr","q1":"你有时候会忘记吃{{COND}}药片吗？","q2":"人们有时会因为忘记以外的原因而漏服药物。在过去两周内，是否有某些天你没有服用{{COND}}药物？","q3":"你有没有在没有告诉医生的情况下减少或停止服药，因为你觉得服药后感觉更糟？","q4":"旅行或离开家时，你有时会忘记随身携带{{COND}}药物吗？","q5":"你昨天服用{{COND}}药物了吗？","q6":"当你觉得{{COND}}得到控制时，你有时会停止服药吗？","q7":"每天吃药对有些人来说确实很不方便。你是否觉得坚持{{COND}}治疗计划很麻烦？","q8":"你多久会发现很难记住服用所有的{{COND}}药物？","q1_yes":"是","q1_no":"否","q8_never":"从不/很少","q8_once":"偶尔","q8_sometimes":"有时","q8_usually":"通常","q8_always":"一直"},
  "zh-TW":{"name":"Chinese (Traditional)","native":"中文(繁體)","dir":"ltr","q1":"你有時候會忘記吃{{COND}}藥片嗎？","q2":"人們有時會因為忘記以外的原因而漏服藥物。在過去兩週內，是否有某些天你沒有服用{{COND}}藥物？","q3":"你有沒有在沒有告訴醫生的情況下減少或停止服藥，因為你覺得服藥後感覺更糟？","q4":"旅行或離開家時，你有時會忘記隨身攜帶{{COND}}藥物嗎？","q5":"你昨天服用{{COND}}藥物了嗎？","q6":"當你覺得{{COND}}得到控制時，你有時會停止服藥嗎？","q7":"每天吃藥對有些人來說確實很不方便。你是否覺得堅持{{COND}}治療計劃很麻煩？","q8":"你多久會發現很難記住服用所有的{{COND}}藥物？","q1_yes":"是","q1_no":"否","q8_never":"從不/很少","q8_once":"偶爾","q8_sometimes":"有時","q8_usually":"通常","q8_always":"一直"},
  "hr":{"name":"Croatian","native":"Hrvatski","dir":"ltr","q1":"Zaboravljate li ponekad uzeti {{COND}} tablete?","q2":"Ljudi ponekad propuste uzeti lijek iz razloga koji nisu zaborav. Tijekom posljednja dva tjedna, je li bilo dana kada niste uzeli {{COND}} lijek?","q3":"Jeste li ikada smanjili ili prestali uzimati lijekove, a da niste rekli liječniku, jer ste se osjećali lošije dok ste ih uzimali?","q4":"Kada putujete ili odlazite od kuće, zaboravite li ponekad ponijeti {{COND}} lijek sa sobom?","q5":"Jeste li uzeli {{COND}} lijek jučer?","q6":"Kada osjećate da je vaš {{COND}} pod kontrolom, prestanete li ponekad uzimati lijek?","q7":"Svakodnevno uzimanje lijekova nekima je prava neugodnost. Osjećate li se ikada mučno zbog pridržavanja svog {{COND}} plana liječenja?","q8":"Koliko često imate poteškoća sa sjećanjem da morate uzeti sve {{COND}} lijekove?","q1_yes":"Da","q1_no":"Ne","q8_never":"Nikad/Rijetko","q8_once":"S vremena na vrijeme","q8_sometimes":"Ponekad","q8_usually":"Obično","q8_always":"Cijelo vrijeme"},
  "da":{"name":"Danish","native":"Dansk","dir":"ltr","q1":"Glemmer du nogle gange at tage dine {{COND}} piller?","q2":"Folk glemmer nogle gange at tage deres medicin af andre årsager end glemsomhed. Var der i løbet af de seneste to uger dage, hvor du ikke tog din {{COND}} medicin?","q3":"Har du nogensinde skåret ned på eller stoppet med at tage din medicin uden at fortælle det til din læge, fordi du havde det værre, når du tog den?","q4":"Når du rejser eller forlader hjemmet, glemmer du så nogle gange at tage din {{COND}} medicin med?","q5":"Tog du din {{COND}} medicin i går?","q6":"Når du føler, at din {{COND}} er under kontrol, stopper du så nogle gange med at tage din medicin?","q7":"At tage medicin hver dag er en rigtig ulejlighed for nogle mennesker. Føler du dig nogensinde irriteret over at følge din {{COND}} behandlingsplan?","q8":"Hvor ofte har du svært ved at huske at tage al din {{COND}} medicin?","q1_yes":"Ja","q1_no":"Nej","q8_never":"Aldrig/Sjældent","q8_once":"En gang imellem","q8_sometimes":"Nogle gange","q8_usually":"Sædvanligvis","q8_always":"Hele tiden"},
  "nl":{"name":"Dutch","native":"Nederlands","dir":"ltr","q1":"Vergeet je soms je {{COND}} pillen in te nemen?","q2":"Mensen missen soms het innemen van hun medicatie om andere redenen dan vergeetachtigheid. Waren er in de afgelopen twee weken dagen waarop je je {{COND}} medicatie niet hebt ingenomen?","q3":"Heb je ooit je medicatie verminderd of gestopt zonder je dokter te vertellen, omdat je je slechter voelde toen je het innam?","q4":"Wanneer je reist of van huis weggaat, vergeet je soms je {{COND}} medicatie mee te nemen?","q5":"Heb je gisteren je {{COND}} medicatie ingenomen?","q6":"Wanneer je het gevoel hebt dat je {{COND}} onder controle is, stop je soms met het innemen van je medicatie?","q7":"Het dagelijks innemen van medicatie is voor sommige mensen echt een ongemak. Voel je je ooit gehinderd door je aan je {{COND}} behandelplan te houden?","q8":"Hoe vaak heb je moeite om te onthouden al je {{COND}} medicatie in te nemen?","q1_yes":"Ja","q1_no":"Nee","q8_never":"Nooit/Zelden","q8_once":"Af en toe","q8_sometimes":"Soms","q8_usually":"Meestal","q8_always":"Altijd"},
  "fi":{"name":"Finnish","native":"Suomi","dir":"ltr","q1":"Unohtatko joskus ottaa {{COND}} pillerisi?","q2":"Ihmiset jättävät joskus lääkkeensä ottamatta muista syistä kuin unohtamisen takia. Oliko viimeisen kahden viikon aikana päiviä, jolloin et ottanut {{COND}} lääkettäsi?","q3":"Oletko koskaan vähentänyt tai lopettanut lääkityksesi ottamisen kertomatta siitä lääkärillesi, koska voit huonommin ottaessasi sitä?","q4":"Kun matkustat tai lähdet kotoa, unohtatko joskus ottaa {{COND}} lääkkeesi mukaan?","q5":"Otitko {{COND}} lääkkeesi eilen?","q6":"Kun tuntuu, että {{COND}} on hallinnassa, lopetatko joskus lääkkeesi ottamisen?","q7":"Lääkkeiden ottaminen joka päivä on joillekin ihmisille todellinen vaiva. Tuntuuko {{COND}} hoitosuunnitelmassasi pysyminen joskus hankalalta?","q8":"Kuinka usein sinulla on vaikeuksia muistaa ottaa kaikki {{COND}} lääkkeesi?","q1_yes":"Kyllä","q1_no":"Ei","q8_never":"Ei koskaan/Harvoin","q8_once":"Silloin tällöin","q8_sometimes":"Joskus","q8_usually":"Yleensä","q8_always":"Koko ajan"},
  "fr":{"name":"French","native":"Français","dir":"ltr","q1":"Parfois, oubliez-vous de prendre vos comprimés {{COND}} ?","q2":"Les gens oublient parfois de prendre leurs médicaments pour des raisons autres que l'oubli. Au cours des deux dernières semaines, y a-t-il eu des jours où vous n'avez pas pris votre médicament {{COND}} ?","q3":"Avez-vous déjà réduit ou arrêté de prendre votre médicament sans en parler à votre médecin, parce que vous vous sentiez pire en le prenant ?","q4":"Lorsque vous voyagez ou quittez la maison, oubliez-vous parfois d'emporter avec vous votre médicament {{COND}} ?","q5":"Avez-vous pris votre médicament {{COND}} hier ?","q6":"Lorsque vous sentez que votre {{COND}} est sous contrôle, arrêtez-vous parfois de prendre votre médicament ?","q7":"Prendre des médicaments tous les jours est un véritable inconvénient pour certaines personnes. Vous sentez-vous parfois harcelé par le fait de suivre votre plan de traitement {{COND}} ?","q8":"À quelle fréquence avez-vous du mal à vous rappeler de prendre tous vos médicaments {{COND}} ?","q1_yes":"Oui","q1_no":"Non","q8_never":"Jamais/Rarement","q8_once":"De temps en temps","q8_sometimes":"Parfois","q8_usually":"Habituellement","q8_always":"Tout le temps"},
  "de":{"name":"German","native":"Deutsch","dir":"ltr","q1":"Vergessen Sie manchmal, Ihre {{COND}} Tabletten einzunehmen?","q2":"Menschen versäumen manchmal die Einnahme ihrer Medikamente aus anderen Gründen als Vergessen. Gab es in den letzten zwei Wochen Tage, an denen Sie Ihr {{COND}} Medikament nicht eingenommen haben?","q3":"Haben Sie jemals die Einnahme Ihres Medikaments reduziert oder aufgehört, ohne es Ihrem Arzt zu sagen, weil Sie sich schlechter fühlten, wenn Sie es genommen haben?","q4":"Wenn Sie reisen oder das Haus verlassen, vergessen Sie manchmal, Ihr {{COND}} Medikament mitzunehmen?","q5":"Haben Sie gestern Ihr {{COND}} Medikament eingenommen?","q6":"Wenn Sie das Gefühl haben, dass Ihr {{COND}} unter Kontrolle ist, hören Sie manchmal auf, Ihr Medikament einzunehmen?","q7":"Die tägliche Einnahme von Medikamenten ist für manche Menschen eine echte Unannehmlichkeit. Fühlen Sie sich manchmal genervt, Ihren {{COND}} Behandlungsplan einzuhalten?","q8":"Wie oft haben Sie Schwierigkeiten, sich daran zu erinnern, alle Ihre {{COND}} Medikamente einzunehmen?","q1_yes":"Ja","q1_no":"Nein","q8_never":"Nie/Selten","q8_once":"Hin und wieder","q8_sometimes":"Manchmal","q8_usually":"Meistens","q8_always":"Die ganze Zeit"},
  "el":{"name":"Greek","native":"Ελληνικά","dir":"ltr","q1":"Μερικές φορές ξεχνάτε να πάρετε τα {{COND}} χάπια σας;","q2":"Μερικές φορές οι άνθρωποι χάνουν τη λήψη των φαρμάκων τους για λόγους άλλους από τη λήθη. Τις τελευταίες δύο εβδομάδες, υπήρξαν ημέρες κατά τις οποίες δεν πήρατε το {{COND}} φάρμακό σας;","q3":"Έχετε ποτέ μειώσει ή σταματήσει να παίρνετε τα φάρμακά σας χωρίς να ενημερώσετε τον γιατρό σας, επειδή αισθανόσασταν χειρότερα όταν τα παίρνατε;","q4":"Όταν ταξιδεύετε ή φεύγετε από το σπίτι, ξεχνάτε μερικές φορές να πάρετε μαζί σας το {{COND}} φάρμακό σας;","q5":"Πήρατε το {{COND}} φάρμακό σας χθες;","q6":"Όταν αισθάνεστε ότι το {{COND}} σας είναι υπό έλεγχο, σταματάτε μερικές φορές να παίρνετε το φάρμακό σας;","q7":"Η καθημερινή λήψη φαρμάκων είναι πραγματική ταλαιπωρία για μερικούς ανθρώπους. Αισθάνεστε ποτέ ενοχλημένοι από την τήρηση του {{COND}} θεραπευτικού σας σχεδίου;","q8":"Πόσο συχνά δυσκολεύεστε να θυμηθείτε να πάρετε όλα τα {{COND}} φάρμακα;","q1_yes":"Ναι","q1_no":"Όχι","q8_never":"Ποτέ/Σπάνια","q8_once":"Κάπου κάπου","q8_sometimes":"Μερικές φορές","q8_usually":"Συνήθως","q8_always":"Συνέχεια"},
  "hi":{"name":"Hindi","native":"हिन्दी","dir":"ltr","q1":"क्या आप कभी-कभी अपनी {{COND}} गोलियाँ लेना भूल जाते हैं?","q2":"लोग कभी-कभी भूलने के अलावा अन्य कारणों से अपनी दवाएं लेना चूक जाते हैं। पिछले दो हफ्तों में, क्या ऐसे कोई दिन थे जब आपने अपनी {{COND}} दवा नहीं ली?","q3":"क्या आपने कभी अपने डॉक्टर को बताए बिना दवा कम कर दी या बंद कर दी क्योंकि जब आप इसे लेते थे तो आप बुरा महसूस करते थे?","q4":"जब आप यात्रा करते हैं या घर से बाहर जाते हैं, तो क्या आप कभी-कभी अपनी {{COND}} दवा साथ लाना भूल जाते हैं?","q5":"क्या आपने कल अपनी {{COND}} दवा ली थी?","q6":"जब आपको लगता है कि आपका {{COND}} नियंत्रण में है, तो क्या आप कभी-कभी अपनी दवा लेना बंद कर देते हैं?","q7":"हर दिन दवा लेना कुछ लोगों के लिए वास्तव में असुविधाजनक है। क्या आप कभी-कभी अपनी {{COND}} उपचार योजना का पालन करने से परेशान महसूस करते हैं?","q8":"आपको कितनी बार अपनी सभी {{COND}} दवाएं लेना याद रखने में कठिनाई होती है?","q1_yes":"हाँ","q1_no":"नहीं","q8_never":"कभी नहीं/कभी-कभार","q8_once":"कभी-कभार","q8_sometimes":"कभी-कभी","q8_usually":"आमतौर पर","q8_always":"हर समय"},
  "id":{"name":"Indonesian","native":"Bahasa Indonesia","dir":"ltr","q1":"Apakah Anda terkadang lupa minum pil {{COND}}?","q2":"Orang-orang terkadang melewatkan minum obat karena alasan selain lupa. Dalam dua minggu terakhir, apakah ada hari-hari ketika Anda tidak minum obat {{COND}}?","q3":"Pernahkah Anda mengurangi atau berhenti minum obat tanpa memberitahu dokter karena Anda merasa lebih buruk saat meminumnya?","q4":"Saat bepergian atau meninggalkan rumah, apakah Anda terkadang lupa membawa serta obat {{COND}}?","q5":"Apakah Anda minum obat {{COND}} kemarin?","q6":"Ketika Anda merasa {{COND}} terkontrol, apakah Anda terkadang berhenti minum obat?","q7":"Minum obat setiap hari adalah ketidaknyamanan nyata bagi sebagian orang. Apakah Anda terkadang merasa terbebani mengikuti rencana pengobatan {{COND}}?","q8":"Seberapa sering Anda kesulitan mengingat minum semua obat {{COND}}?","q1_yes":"Ya","q1_no":"Tidak","q8_never":"Tidak pernah/Jarang","q8_once":"Sesekali","q8_sometimes":"Kadang-kadang","q8_usually":"Biasanya","q8_always":"Selalu"},
  "it":{"name":"Italian","native":"Italiano","dir":"ltr","q1":"A volte dimentica di prendere le sue compresse {{COND}}?","q2":"A volte le persone dimenticano di prendere i farmaci per motivi diversi dalla dimenticanza. Nelle ultime due settimane, ci sono stati giorni in cui non ha preso il suo farmaco {{COND}}?","q3":"Ha mai ridotto o smesso di prendere i suoi farmaci senza dirlo al medico, perché si sentiva peggio quando li prendeva?","q4":"Quando viaggia o si allontana da casa, a volte dimentica di portare con sé il suo farmaco {{COND}}?","q5":"Ha preso il suo farmaco {{COND}} ieri?","q6":"Quando sente che il suo {{COND}} è sotto controllo, a volte smette di prendere il farmaco?","q7":"Prendere i farmaci ogni giorno è un vero inconveniente per alcune persone. Si sente a volte infastidito dal seguire il suo piano di trattamento {{COND}}?","q8":"Con quale frequenza ha difficoltà a ricordare di prendere tutti i suoi farmaci {{COND}}?","q1_yes":"Sì","q1_no":"No","q8_never":"Mai/Raramente","q8_once":"Di tanto in tanto","q8_sometimes":"A volte","q8_usually":"Di solito","q8_always":"Sempre"},
  "ja":{"name":"Japanese","native":"日本語","dir":"ltr","q1":"{{COND}}の錠剤を飲み忘れることがありますか？","q2":"薬を飲み忘れる以外の理由で服薬を失念することがあります。過去2週間で、{{COND}}の薬を飲まなかった日はありましたか？","q3":"飲んでいると具合が悪くなるため、医師に告げずに薬を減らしたり止めたりしたことはありますか？","q4":"旅行や外出の際、{{COND}}の薬を持参するのを忘れることがありますか？","q5":"昨日、{{COND}}の薬を飲みましたか？","q6":"{{COND}}がコントロールされていると感じると、薬を飲むのをやめることがありますか？","q7":"毎日薬を飲むことは、一部の人にとって本当に不便です。{{COND}}の治療計画を守ることに煩わしさを感じることがありますか？","q8":"{{COND}}の薬をすべて飲むことを覚えるのが難しいと感じる頻度はどのくらいですか？","q1_yes":"はい","q1_no":"いいえ","q8_never":"ない/まれに","q8_once":"たまに","q8_sometimes":"ときどき","q8_usually":"たいてい","q8_always":"いつも"},
  "ko":{"name":"Korean","native":"한국어","dir":"ltr","q1":"때때로 {{COND}} 알약 먹는 것을 잊어버리십니까?","q2":"사람들은 때때로 잊어버리는 것 외의 이유로 약을 복용하지 못하기도 합니다. 지난 2주 동안, {{COND}} 약을 복용하지 않은 날이 있었습니까?","q3":"약을 먹으면 상태가 나빠진다고 느껴서 의사에게 알리지 않고 약을 줄이거나 끊어본 적이 있습니까?","q4":"여행을 하거나 집을 떠날 때, 때때로 {{COND}} 약을 챙겨가는 것을 잊습니까?","q5":"어제 {{COND}} 약을 복용하셨습니까?","q6":"{{COND}}이 조절되고 있다고 느낄 때, 때때로 약 먹는 것을 중단하십니까?","q7":"매일 약을 먹는 것은 일부 사람들에게 실제로 불편한 일입니다. {{COND}} 치료 계획을 따르는 것이 때때로 불편하게 느껴집니까?","q8":"{{COND}} 약을 모두 복용하는 것을 기억하는 데 어려움을 겪는 빈도는 얼마나 됩니까?","q1_yes":"예","q1_no":"아니오","q8_never":"전혀 없다/드물게","q8_once":"가끔씩","q8_sometimes":"때때로","q8_usually":"보통","q8_always":"항상"},
  "ms":{"name":"Malay","native":"Bahasa Melayu","dir":"ltr","q1":"Adakah anda kadang-kadang terlupa untuk mengambil pil {{COND}} anda?","q2":"Orang kadang-kadang terlepas mengambil ubat mereka atas sebab selain terlupa. Dalam dua minggu yang lalu, adakah terdapat hari-hari apabila anda tidak mengambil ubat {{COND}} anda?","q3":"Pernahkah anda mengurangkan atau berhenti mengambil ubat anda tanpa memberitahu doktor anda, kerana anda berasa lebih teruk apabila mengambilnya?","q4":"Apabila anda melakukan perjalanan atau meninggalkan rumah, adakah anda kadang-kadang terlupa membawa ubat {{COND}} anda bersama?","q5":"Adakah anda mengambil ubat {{COND}} anda semalam?","q6":"Apabila anda rasa {{COND}} anda terkawal, adakah anda kadang-kadang berhenti mengambil ubat anda?","q7":"Mengambil ubat setiap hari adalah ketidakselesaan sebenar bagi sesetengah orang. Adakah anda kadang-kadang berasa susah hati untuk mematuhi pelan rawatan {{COND}} anda?","q8":"Berapa kerap anda menghadapi kesukaran mengingat untuk mengambil semua ubat {{COND}} anda?","q1_yes":"Ya","q1_no":"Tidak","q8_never":"Tidak pernah/Jarang","q8_once":"Sekali-sekala","q8_sometimes":"Kadang-kadang","q8_usually":"Biasanya","q8_always":"Sentiasa"},
  "pt":{"name":"Portuguese","native":"Português","dir":"ltr","q1":"Às vezes você esquece de tomar seus comprimidos de {{COND}}?","q2":"As pessoas às vezes não tomam seus medicamentos por razões além do esquecimento. Nas últimas duas semanas, houve dias em que você não tomou seu medicamento {{COND}}?","q3":"Você já reduziu ou parou de tomar seus medicamentos sem contar ao seu médico, porque se sentiu pior quando os tomou?","q4":"Quando você viaja ou sai de casa, às vezes esquece de trazer seu medicamento {{COND}} junto?","q5":"Você tomou seu medicamento {{COND}} ontem?","q6":"Quando sente que seu {{COND}} está controlado, às vezes para de tomar seu medicamento?","q7":"Tomar medicamentos todos os dias é um grande inconveniente para algumas pessoas. Às vezes você se sente incomodado de seguir seu plano de tratamento {{COND}}?","q8":"Com que frequência você tem dificuldades em lembrar de tomar todos os seus medicamentos {{COND}}?","q1_yes":"Sim","q1_no":"Não","q8_never":"Nunca/Raramente","q8_once":"De vez em quando","q8_sometimes":"Às vezes","q8_usually":"Geralmente","q8_always":"O tempo todo"},
  "ru":{"name":"Russian","native":"Русский","dir":"ltr","q1":"Иногда ли вы забываете принимать таблетки {{COND}}?","q2":"Люди иногда пропускают приём лекарств по причинам, не связанным с забывчивостью. За последние две недели были ли дни, когда вы не принимали лекарство от {{COND}}?","q3":"Случалось ли вам когда-либо уменьшить дозу или прекратить приём лекарств, не сообщив об этом врачу, потому что вам становилось хуже?","q4":"Когда вы путешествуете или уходите из дома, иногда ли вы забываете взять лекарство от {{COND}} с собой?","q5":"Вы принимали лекарство от {{COND}} вчера?","q6":"Когда вы чувствуете, что {{COND}} под контролем, иногда ли вы прекращаете принимать лекарства?","q7":"Ежедневный приём лекарств — настоящее неудобство для некоторых людей. Иногда ли вы чувствуете себя обременёнными необходимостью следовать плану лечения {{COND}}?","q8":"Как часто вам трудно вспомнить, что нужно принять все лекарства от {{COND}}?","q1_yes":"Да","q1_no":"Нет","q8_never":"Никогда/Редко","q8_once":"Время от времени","q8_sometimes":"Иногда","q8_usually":"Обычно","q8_always":"Всё время"},
  "es":{"name":"Spanish","native":"Español","dir":"ltr","q1":"¿A veces olvida tomar sus pastillas de {{COND}}?","q2":"A veces las personas se olvidan de tomar sus medicamentos por razones distintas al olvido. Durante las últimas dos semanas, ¿hubo algún día en que no tomó su medicamento {{COND}}?","q3":"¿Alguna vez ha reducido o dejado de tomar su medicamento sin decírselo a su médico, porque se sentía peor cuando lo tomaba?","q4":"Cuando viaja o sale de casa, ¿a veces olvida traer consigo su medicamento {{COND}}?","q5":"¿Tomó su medicamento {{COND}} ayer?","q6":"Cuando siente que su {{COND}} está bajo control, ¿a veces deja de tomar su medicamento?","q7":"Tomar medicamentos todos los días es un verdadero inconveniente para algunas personas. ¿A veces se siente molesto por tener que seguir su plan de tratamiento {{COND}}?","q8":"¿Con qué frecuencia tiene dificultades para recordar tomar todos sus medicamentos {{COND}}?","q1_yes":"Sí","q1_no":"No","q8_never":"Nunca/Raramente","q8_once":"De vez en cuando","q8_sometimes":"A veces","q8_usually":"Generalmente","q8_always":"Todo el tiempo"},
  "sw":{"name":"Swahili","native":"Kiswahili","dir":"ltr","q1":"Je, wakati mwingine husahau kumeza vidonge vya {{COND}}?","q2":"Watu wakati mwingine hukosa kumeza dawa zao kwa sababu nyingine zaidi ya kusahau. Katika wiki mbili zilizopita, kulikuwa na siku zozote ambapo hukumeza dawa yako ya {{COND}}?","q3":"Je, umewahi kupunguza au kusimama kumeza dawa bila kumwambia daktari wako, kwa sababu ulijisikia vibaya zaidi ulipomeza?","q4":"Unaposafiri au kuondoka nyumbani, wakati mwingine unasahau kubeba dawa yako ya {{COND}} nawe?","q5":"Je, ulimeza dawa yako ya {{COND}} jana?","q6":"Unapohisi kwamba {{COND}} yako iko chini ya udhibiti, wakati mwingine unaacha kumeza dawa yako?","q7":"Kumeza dawa kila siku ni usumbufu wa kweli kwa watu wengine. Je, wakati mwingine unahisi usumbufu wa kushikamana na mpango wako wa matibabu ya {{COND}}?","q8":"Mara ngapi una ugumu wa kukumbuka kumeza dawa zako zote za {{COND}}?","q1_yes":"Ndiyo","q1_no":"Hapana","q8_never":"Kamwe/Mara chache","q8_once":"Mara kwa mara","q8_sometimes":"Wakati mwingine","q8_usually":"Kawaida","q8_always":"Kila wakati"},
  "sv":{"name":"Swedish","native":"Svenska","dir":"ltr","q1":"Glömmer du ibland att ta dina {{COND}} tabletter?","q2":"Människor missar ibland att ta sina mediciner av andra skäl än glömska. Fanns det under de senaste två veckorna dagar då du inte tog din {{COND}} medicin?","q3":"Har du någonsin minskat eller slutat ta din medicin utan att berätta det för din läkare, för att du mådde sämre när du tog den?","q4":"När du reser eller lämnar hemmet, glömmer du ibland att ta med din {{COND}} medicin?","q5":"Tog du din {{COND}} medicin igår?","q6":"När du känner att din {{COND}} är under kontroll, slutar du ibland ta din medicin?","q7":"Att ta medicin varje dag är ett verkligt besvär för en del människor. Känner du dig ibland besvärad av att hålla dig till din {{COND}} behandlingsplan?","q8":"Hur ofta har du svårt att komma ihåg att ta alla dina {{COND}} mediciner?","q1_yes":"Ja","q1_no":"Nej","q8_never":"Aldrig/Sällan","q8_once":"Då och då","q8_sometimes":"Ibland","q8_usually":"Vanligtvis","q8_always":"Hela tiden"},
  "tr":{"name":"Turkish","native":"Türkçe","dir":"ltr","q1":"Bazen {{COND}} haplarınızı almayı unutuyor musunuz?","q2":"İnsanlar bazen unutmak dışındaki nedenlerle ilaçlarını almayı kaçırır. Son iki hafta içinde, {{COND}} ilacınızı almadığınız günler oldu mu?","q3":"İlaçlarınızı aldığınızda daha kötü hissettiğiniz için doktorunuza söylemeden ilaçlarınızı azalttınız veya kestiniz mi?","q4":"Seyahat ettiğinizde veya evden ayrıldığınızda, {{COND}} ilacınızı yanınıza almayı bazen unutuyor musunuz?","q5":"{{COND}} ilacınızı dün aldınız mı?","q6":"{{COND}}'unuzun kontrol altında olduğunu hissettiğinizde, bazen ilacınızı almayı bırakıyor musunuz?","q7":"Her gün ilaç almak bazı insanlar için gerçek bir sıkıntıdır. {{COND}} tedavi planınıza uymaktan bazen bunaldığınızı hissediyor musunuz?","q8":"Tüm {{COND}} ilaçlarınızı almayı hatırlamakta ne sıklıkla güçlük çekiyorsunuz?","q1_yes":"Evet","q1_no":"Hayır","q8_never":"Hiçbir zaman/Nadiren","q8_once":"Arada bir","q8_sometimes":"Bazen","q8_usually":"Genellikle","q8_always":"Her zaman"},
  "uk":{"name":"Ukrainian","native":"Українська","dir":"ltr","q1":"Чи іноді ви забуваєте приймати таблетки {{COND}}?","q2":"Люди іноді пропускають прийом ліків з причин, що не пов'язані із забудькуватістю. Протягом останніх двох тижнів, чи були дні, коли ви не приймали ліки від {{COND}}?","q3":"Чи траплялося вам коли-небудь зменшувати дозу або припиняти прийом ліків, не повідомляючи лікаря, бо вам ставало гірше під час їх прийому?","q4":"Коли ви подорожуєте або виходите з дому, чи іноді забуваєте взяти з собою ліки від {{COND}}?","q5":"Чи приймали ви ліки від {{COND}} вчора?","q6":"Коли вам здається, що {{COND}} контролюється, чи іноді ви припиняєте приймати ліки?","q7":"Щоденний прийом ліків є справжнім незручністю для деяких людей. Чи іноді ви відчуваєте роздратування від необхідності дотримуватися плану лікування {{COND}}?","q8":"Як часто вам важко пам'ятати про прийом усіх ліків від {{COND}}?","q1_yes":"Так","q1_no":"Ні","q8_never":"Ніколи/Рідко","q8_once":"Час від часу","q8_sometimes":"Іноді","q8_usually":"Зазвичай","q8_always":"Весь час"},
  "ur":{"name":"Urdu","native":"اردو","dir":"rtl","q1":"کیا آپ کبھی کبھی اپنی {{COND}} گولیاں لینا بھول جاتے ہیں؟","q2":"لوگ کبھی کبھی بھول جانے کے علاوہ دیگر وجوہات کی بنا پر اپنی دوائیں لینا چھوڑ دیتے ہیں۔ گزشتہ دو ہفتوں میں، کیا ایسے دن تھے جب آپ نے اپنی {{COND}} دوائی نہیں لی؟","q3":"کیا آپ نے کبھی اپنے ڈاکٹر کو بتائے بغیر دوائی کم کر دی یا بند کر دی کیونکہ جب آپ اسے لیتے تھے تو آپ بدتر محسوس کرتے تھے؟","q4":"جب آپ سفر کرتے ہیں یا گھر سے نکلتے ہیں، کیا آپ کبھی کبھی اپنی {{COND}} دوائی ساتھ لانا بھول جاتے ہیں؟","q5":"کیا آپ نے کل اپنی {{COND}} دوائی لی تھی؟","q6":"جب آپ محسوس کرتے ہیں کہ آپ کا {{COND}} قابو میں ہے، کیا آپ کبھی کبھی اپنی دوائی لینا بند کر دیتے ہیں؟","q7":"ہر روز دوائی لینا کچھ لوگوں کے لیے واقعی تکلیف دہ ہے۔ کیا آپ کبھی کبھی اپنے {{COND}} علاج کے منصوبے پر عمل کرنے سے پریشان محسوس کرتے ہیں؟","q8":"آپ کو کتنی بار اپنی تمام {{COND}} دوائیں لینا یاد رکھنے میں دشواری ہوتی ہے؟","q1_yes":"ہاں","q1_no":"نہیں","q8_never":"کبھی نہیں/شاذ و نادر","q8_once":"کبھی کبھار","q8_sometimes":"کبھی کبھی","q8_usually":"عموماً","q8_always":"ہر وقت"},
  "vi":{"name":"Vietnamese","native":"Tiếng Việt","dir":"ltr","q1":"Đôi khi bạn có quên uống thuốc {{COND}} không?","q2":"Đôi khi mọi người bỏ lỡ việc uống thuốc vì những lý do khác ngoài việc quên. Trong hai tuần qua, có ngày nào bạn không uống thuốc {{COND}} không?","q3":"Bạn có bao giờ giảm liều hoặc ngừng uống thuốc mà không nói với bác sĩ, vì bạn cảm thấy tệ hơn khi dùng thuốc không?","q4":"Khi đi du lịch hoặc rời khỏi nhà, bạn có đôi khi quên mang theo thuốc {{COND}} không?","q5":"Bạn có uống thuốc {{COND}} hôm qua không?","q6":"Khi bạn cảm thấy {{COND}} của bạn đang được kiểm soát, bạn có đôi khi ngừng uống thuốc không?","q7":"Uống thuốc mỗi ngày là điều bất tiện thực sự đối với một số người. Bạn có đôi khi cảm thấy phiền phức về việc tuân thủ kế hoạch điều trị {{COND}} của mình không?","q8":"Bạn thường gặp khó khăn như thế nào trong việc nhớ uống tất cả các loại thuốc {{COND}}?","q1_yes":"Có","q1_no":"Không","q8_never":"Không bao giờ/Hiếm khi","q8_once":"Thỉnh thoảng","q8_sometimes":"Đôi khi","q8_usually":"Thường thường","q8_always":"Mọi lúc"}
,
"tl":{"name":"Filipino","native":"Filipino (Tagalog)","dir":"ltr","q1":"Nakalilimutan mo ba minsan na inumin ang iyong {{COND}} na mga tableta?","q2":"Minsan ay nakakalimot ang mga tao na uminom ng gamot dahil sa iba pang dahilan bukod sa paglimot. Sa nakalipas na dalawang linggo, may mga araw ba na hindi mo nainom ang iyong {{COND}} na gamot?","q3":"Nagbawas ka na ba o tumigil sa pag-inom ng iyong gamot nang hindi sinasabi sa iyong doktor dahil naramdaman mong mas masama ka nang inumin mo ito?","q4":"Kapag naglalakbay ka o umaalis sa bahay, nakalilimutan mo ba minsan na dalhin ang iyong {{COND}} na gamot?","q5":"Nainom mo ba ang iyong {{COND}} na gamot kahapon?","q6":"Kapag naramdaman mong kontrolado na ang iyong {{COND}}, titigil ka ba minsan sa pag-inom ng iyong gamot?","q7":"Ang pag-inom ng gamot araw-araw ay isang tunay na abala para sa ilang tao. Naramdaman mo na ba na naaabala sa pagsunod sa iyong {{COND}} na plano ng paggamot?","q8":"Gaano kadalas ikaw ay nahihirapang matandaan na inumin ang lahat ng iyong gamot para sa {{COND}}?","q1_yes":"Oo","q1_no":"Hindi","q8_never":"Kailanman/Bihira","q8_once":"Paminsan-minsan","q8_sometimes":"Minsan","q8_usually":"Kadalasan","q8_always":"Palagi"}
};

// ══════════════════════════════════════════════
// BUILD LANG SELECT
// ══════════════════════════════════════════════
// ── FEATURE: ZOE Language Auto-Detect ──────────────────────────────────────
// Maps browser BCP47 language tag → MMAS_QUESTIONS key.
// Called once on DOMContentLoaded; silently no-ops if the lang isn't in the set.
/**
 * Reads the browser's preferred language list and sets the ATLAS UI language to the
 * closest match in MMAS_QUESTIONS. Silently no-ops when no match is found.
 * @returns {void}
 */
function autoDetectLanguage() {
  try {
    const langs = navigator.languages && navigator.languages.length
      ? [...navigator.languages]
      : [navigator.language || 'en'];
    const available = Object.keys(MMAS_QUESTIONS);
    for (const raw of langs) {
      const l = raw.toLowerCase();
      // Exact match first (e.g. "zh-TW")
      const exact = available.find(k => k.toLowerCase() === l);
      if (exact) return exact;
      // Base-language match (e.g. "zh-CN" → "zh", "pt-BR" → "pt")
      const base = l.split('-')[0];
      const baseMatch = available.find(k => k.toLowerCase() === base);
      if (baseMatch) return baseMatch;
    }
  } catch(e) {}
  return 'en';
}

