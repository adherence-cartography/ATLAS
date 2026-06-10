// ══════════════════════════════════════════════════════════════════════════
// MULTILINGUAL CONDITION DROPDOWN — v2026.06.03-B1
// 30-language condition list. option.value is always the English term so
// Firebase records stay language-independent across all locales.
// ══════════════════════════════════════════════════════════════════════════
/**
 * @typedef {{ en:string,el:string,ar:string,es:string,af:string,sq:string,bn:string,zh:string,'zh-TW':string,hr:string,da:string,nl:string,fi:string,fr:string,de:string,hi:string,id:string,it:string,ja:string,ko:string,ms:string,pt:string,ru:string,sw:string,sv:string,tr:string,uk:string,ur:string,vi:string,tl:string,isOther?:boolean }} ConditionItem
 * @typedef {{ en:string,el:string,ar:string,es:string,af:string,sq:string,bn:string,zh:string,'zh-TW':string,hr:string,da:string,nl:string,fi:string,fr:string,de:string,hi:string,id:string,it:string,ja:string,ko:string,ms:string,pt:string,ru:string,sw:string,sv:string,tr:string,uk:string,ur:string,vi:string,tl:string,items:ConditionItem[] }} ConditionGroup
 */

/**
 * Grouped medical condition data for the SDOH condition dropdown.
 * 30 languages. Item `value` is always the English term so Firebase records
 * remain language-independent.
 * @type {ConditionGroup[]}
 */
const _CONDITION_GROUPS = [
  { en: 'Cardiovascular System', el: 'Καρδιαγγειακά νοσήματα', ar: 'الجهاز القلبي الوعائي', es: 'Sistema Cardiovascular', af: 'Kardiovaskulêre Stelsel', sq: 'Sistemi Kardiovaskular', bn: 'হৃদ্‌বাহী তন্ত্র', zh: '心血管系统', 'zh-TW': '心血管系統', hr: 'Kardiovaskularni sustav', da: 'Kardiovaskulært system', nl: 'Cardiovasculair systeem', fi: 'Sydän- ja verisuonijärjestelmä', fr: 'Système cardiovasculaire', de: 'Herz-Kreislauf-System', hi: 'हृदय-संवहनी तंत्र', id: 'Sistem Kardiovaskular', it: 'Sistema Cardiovascolare', ja: '循環器系', ko: '심혈관계', ms: 'Sistem Kardiovaskular', pt: 'Sistema Cardiovascular', ru: 'Сердечно-сосудистая система', sw: 'Mfumo wa Moyo na Mishipa', sv: 'Kardiovaskulärt system', tr: 'Kardiyovasküler Sistem', uk: 'Серцево-судинна система', ur: 'قلبی عروقی نظام', vi: 'Hệ tim mạch', tl: 'Sistema ng Puso at Daluyan ng Dugo', items: [
    { en: 'Hypertension', el: 'Υπέρταση', ar: 'ارتفاع ضغط الدم', es: 'Hipertensión', af: 'Hipertensie', sq: 'Hipertensioni', bn: 'উচ্চ রক্তচাপ', zh: '高血压', 'zh-TW': '高血壓', hr: 'Hipertenzija', da: 'Hypertension', nl: 'Hypertensie', fi: 'Verenpainetauti', fr: 'Hypertension artérielle', de: 'Bluthochdruck', hi: 'उच्च रक्तचाप', id: 'Hipertensi', it: 'Ipertensione', ja: '高血圧', ko: '고혈압', ms: 'Hipertensi', pt: 'Hipertensão', ru: 'Гипертония', sw: 'Shinikizo la damu la juu', sv: 'Högt blodtryck', tr: 'Hipertansiyon', uk: 'Гіпертонія', ur: 'ہائی بلڈ پریشر', vi: 'Tăng huyết áp', tl: 'Altapresyon' },
    { en: 'Heart Failure', el: 'Καρδιακή ανεπάρκεια', ar: 'قصور القلب', es: 'Insuficiencia Cardíaca', af: 'Hartversaking', sq: 'Dështimi i zemrës', bn: 'হৃদযন্ত্রের ব্যর্থতা', zh: '心力衰竭', 'zh-TW': '心臟衰竭', hr: 'Zatajivanje srca', da: 'Hjertesvigt', nl: 'Hartfalen', fi: 'Sydämen vajaatoiminta', fr: 'Insuffisance cardiaque', de: 'Herzinsuffizienz', hi: 'हृदय विफलता', id: 'Gagal Jantung', it: 'Insufficienza cardiaca', ja: '心不全', ko: '심부전', ms: 'Kegagalan Jantung', pt: 'Insuficiência Cardíaca', ru: 'Сердечная недостаточность', sw: 'Kushindwa kwa moyo', sv: 'Hjärtsvikt', tr: 'Kalp yetmezliği', uk: 'Серцева недостатність', ur: 'دل کی ناکامی', vi: 'Suy tim', tl: 'Kabiguan ng Puso' },
    { en: 'Coronary Artery Disease / Angina', el: 'Στεφανιαία νόσος / Στηθάγχη', ar: 'مرض الشريان التاجي / الذبحة الصدرية', es: 'Enfermedad Coronaria / Angina de Pecho', af: 'Koronêre arteriesiekte / Angina', sq: 'Sëmundja koronare / Angina', bn: 'করোনারি ধমনী রোগ / এনজাইনা', zh: '冠心病 / 心绞痛', 'zh-TW': '冠狀動脈疾病 / 心絞痛', hr: 'Koronarna bolest / Angina', da: 'Koronararteriesygdom / Angina', nl: 'Coronaire hartziekte / Angina', fi: 'Sepelvaltimotauti / Angina', fr: 'Maladie coronarienne / Angine de poitrine', de: 'Koronare Herzkrankheit / Angina', hi: 'कोरोनरी धमनी रोग / एनजाइना', id: 'Penyakit Arteri Koroner / Angina', it: 'Malattia coronarica / Angina', ja: '冠動脈疾患 / 狭心症', ko: '관상동맥 질환 / 협심증', ms: 'Penyakit Arteri Koronari / Angina', pt: 'Doença Arterial Coronariana / Angina', ru: 'Ишемическая болезнь сердца / Стенокардия', sw: 'Ugonjwa wa moyo / Maumivu ya kifua', sv: 'Kranskärlssjukdom / Angina', tr: 'Koroner arter hastalığı / Angina', uk: 'Ішемічна хвороба серця / Стенокардія', ur: 'کورونری شریان کی بیماری / انجائنا', vi: 'Bệnh động mạch vành / Đau thắt ngực', tl: 'Sakit sa Coronary Artery / Angina' },
    { en: 'Atrial Fibrillation', el: 'Κολπική μαρμαρυγή', ar: 'الرجفان الأذيني', es: 'Fibrilación Auricular', af: 'Atriumfibrillasie', sq: 'Fibrilacioni atrial', bn: 'অ্যাট্রিয়াল ফিব্রিলেশন', zh: '心房颤动', 'zh-TW': '心房顫動', hr: 'Fibrilacija atrija', da: 'Atrieflimren', nl: 'Atriumfibrilleren', fi: 'Eteisvärinä', fr: 'Fibrillation auriculaire', de: 'Vorhofflimmern', hi: 'अलिंद विकम्पन', id: 'Fibrilasi Atrium', it: 'Fibrillazione atriale', ja: '心房細動', ko: '심방세동', ms: 'Fibrilasi Atrium', pt: 'Fibrilação Auricular', ru: 'Фибрилляция предсердий', sw: 'Mshtuko wa moyo wa atria', sv: 'Förmaksflimmer', tr: 'Atriyal fibrilasyon', uk: 'Фібриляція передсердь', ur: 'ایٹریل فبریلیشن', vi: 'Rung tâm nhĩ', tl: 'Atrial Fibrillation' },
    { en: 'Hyperlipidaemia / Dyslipidaemia', el: 'Υπερλιπιδαιμία / Δυσλιπιδαιμία', ar: 'فرط شحوم الدم / اضطراب شحوم الدم', es: 'Hiperlipidemia / Dislipidemia', af: 'Hiperlipidemie / Dislipidemie', sq: 'Hiperlipidemia / Dislipidemia', bn: 'হাইপারলিপিডেমিয়া / ডিসলিপিডেমিয়া', zh: '高脂血症 / 血脂异常', 'zh-TW': '高血脂症 / 血脂異常', hr: 'Hiperlipidemija / Dislipidemija', da: 'Hyperlipidæmi / Dyslipidæmi', nl: 'Hyperlipidemie / Dyslipidemie', fi: 'Hyperlipidemie / Dyslipidemia', fr: 'Hyperlipidémie / Dyslipidémie', de: 'Hyperlipidämie / Dyslipidämie', hi: 'हाइपरलिपिडेमिया / डिस्लिपिडेमिया', id: 'Hiperlipidemia / Dislipidemia', it: 'Iperlipidemia / Dislipidemia', ja: '高脂血症 / 脂質異常症', ko: '고지혈증 / 이상지질혈증', ms: 'Hiperlipidemia / Dislipidemia', pt: 'Hiperlipidemia / Dislipidemia', ru: 'Гиперлипидемия / Дислипидемия', sw: 'Mafuta mengi kwenye damu', sv: 'Hyperlipidemi / Dyslipidemi', tr: 'Hiperlipidemi / Dislipidemi', uk: 'Гіперліпідемія / Дисліпідемія', ur: 'ہائپرلپیڈیمیا / ڈسلپیڈیمیا', vi: 'Tăng lipid máu / Rối loạn lipid máu', tl: 'Hyperlipidemia / Dyslipidemia' },
    { en: 'Peripheral Arterial Disease', el: 'Περιφερική αρτηριακή νόσος', ar: 'مرض الشرايين الطرفية', es: 'Enfermedad Arterial Periférica', af: 'Perifere arteriële siekte', sq: 'Sëmundja arteriale periferike', bn: 'পেরিফেরাল আর্টারিয়াল ডিজিজ', zh: '外周动脉疾病', 'zh-TW': '周邊動脈疾病', hr: 'Periferna arterijska bolest', da: 'Perifer arteriel sygdom', nl: 'Perifere arteriële aandoening', fi: 'Alaraajojen valtimosairaus', fr: 'Artériopathie périphérique', de: 'Periphere arterielle Verschlusskrankheit', hi: 'परिधीय धमनी रोग', id: 'Penyakit Arteri Perifer', it: 'Arteriopatia periferica', ja: '末梢動脈疾患', ko: '말초동맥 질환', ms: 'Penyakit Arteri Periferi', pt: 'Doença Arterial Periférica', ru: 'Периферический атеросклероз', sw: 'Ugonjwa wa mishipa ya damu ya nje', sv: 'Perifer artärsjukdom', tr: 'Periferik arter hastalığı', uk: 'Периферійна артеріальна хвороба', ur: 'پیریفرل آرٹریل ڈیزیز', vi: 'Bệnh động mạch ngoại vi', tl: 'Peripheral Arterial Disease' },
    { en: 'Deep Vein Thrombosis / Pulmonary Embolism', el: 'Εν τω βάθει φλεβική θρόμβωση / Πνευμονική εμβολή', ar: 'تجلط الأوردة العميقة / الانسداد الرئوي', es: 'Trombosis Venosa Profunda / Embolia Pulmonar', af: 'Diep aartrombose / Longembool', sq: 'Tromboza venoze e thellë / Embolia pulmonare', bn: 'ডিপ ভেইন থ্রম্বোসিস / পালমোনারি এম্বোলিজম', zh: '深静脉血栓 / 肺栓塞', 'zh-TW': '深靜脈血栓 / 肺栓塞', hr: 'Duboka venska tromboza / Plućna embolija', da: 'Dyb venetrombose / Lungeemboli', nl: 'Diepe veneuze trombose / Longembolie', fi: 'Syvä laskimotukos / Keuhkoembolia', fr: 'Thrombose veineuse profonde / Embolie pulmonaire', de: 'Tiefe Venenthrombose / Lungenembolie', hi: 'डीप वेन थ्रोम्बोसिस / पल्मोनरी एम्बोलिज्म', id: 'Trombosis Vena Dalam / Emboli Paru', it: 'Trombosi venosa profonda / Embolia polmonare', ja: '深部静脈血栓症 / 肺塞栓症', ko: '심부정맥 혈전증 / 폐색전증', ms: 'Trombosis Vena Dalam / Embolisme Pulmonari', pt: 'Trombose Venosa Profunda / Embolia Pulmonar', ru: 'Тромбоз глубоких вен / Тромбоэмболия лёгочной артерии', sw: 'Kuganda kwa damu kwenye mishipa ya ndani / Embolism ya mapafu', sv: 'Djup ventrombos / Lungemboli', tr: 'Derin ven trombozu / Pulmoner emboli', uk: 'Тромбоз глибоких вен / Тромбоемболія легеневої артерії', ur: 'ڈیپ وین تھرومبوسس / پلمونری ایمبولزم', vi: 'Huyết khối tĩnh mạch sâu / Thuyên tắc phổi', tl: 'Deep Vein Thrombosis / Pulmonary Embolism' },
    { en: 'Stroke / TIA', el: 'Αγγειακό εγκεφαλικό επεισόδιο / Παροδικό ισχαιμικό επεισόδιο', ar: 'السكتة الدماغية / نوبة نقص التروية العابرة', es: 'Accidente Cerebrovascular / AIT', af: 'Beroerte / TIA', sq: 'Goditja cerebrale / TIA', bn: 'স্ট্রোক / টিআইএ', zh: '脑卒中 / 短暂性脑缺血发作', 'zh-TW': '腦中風 / 短暫性腦缺血發作', hr: 'Moždani udar / TIA', da: 'Slagtilfælde / TIA', nl: 'Beroerte / TIA', fi: 'Aivohalvaus / TIA', fr: 'AVC / AIT', de: 'Schlaganfall / TIA', hi: 'स्ट्रोक / टीआईए', id: 'Stroke / TIA', it: 'Ictus / TIA', ja: '脳卒中 / 一過性脳虚血発作', ko: '뇌졸중 / 일과성 허혈 발작', ms: 'Strok / TIA', pt: 'AVC / AIT', ru: 'Инсульт / ТИА', sw: 'Kiharusi / TIA', sv: 'Stroke / TIA', tr: 'İnme / GİA', uk: 'Інсульт / ТІА', ur: 'فالج / ٹی آئی اے', vi: 'Đột quỵ / TIA', tl: 'Stroke / TIA' },
  ]},
  { en: 'Endocrine & Metabolic', el: 'Ενδοκρινολογικά και μεταβολικά νοσήματα', ar: 'الغدد الصماء والاستقلاب', es: 'Enfermedades Endocrinas y Metabólicas', af: 'Endokriene en Metaboliese', sq: 'Endokrine dhe Metabolike', bn: 'অন্তঃস্রাবী ও বিপাক রোগ', zh: '内分泌和代谢疾病', 'zh-TW': '內分泌及代謝疾病', hr: 'Endokrine i metaboličke bolesti', da: 'Endokrine og metaboliske sygdomme', nl: 'Endocriene en metabole aandoeningen', fi: 'Umpieritys- ja aineenvaihduntasairaudet', fr: 'Maladies endocriniennes et métaboliques', de: 'Endokrine und metabolische Erkrankungen', hi: 'अंतःस्रावी और चयापचय रोग', id: 'Penyakit Endokrin dan Metabolik', it: 'Malattie endocrine e metaboliche', ja: '内分泌・代謝疾患', ko: '내분비 및 대사 질환', ms: 'Penyakit Endokrin dan Metabolik', pt: 'Doenças Endócrinas e Metabólicas', ru: 'Эндокринные и метаболические заболевания', sw: 'Magonjwa ya Homoni na Kimetaboliki', sv: 'Endokrina och metabola sjukdomar', tr: 'Endokrin ve Metabolik Hastalıklar', uk: 'Ендокринні та метаболічні захворювання', ur: 'اینڈوکرائن اور میٹابولک امراض', vi: 'Bệnh nội tiết và chuyển hóa', tl: 'Endocrine at Metabolic', items: [
    { en: 'Type 1 Diabetes Mellitus', el: 'Σακχαρώδης διαβήτης τύπου 1', ar: 'داء السكري من النوع الأول', es: 'Diabetes Mellitus Tipo 1', af: 'Tipe 1 Diabetes Mellitus', sq: 'Diabeti mellitus tip 1', bn: 'টাইপ ১ ডায়াবেটিস মেলিটাস', zh: '1型糖尿病', 'zh-TW': '第一型糖尿病', hr: 'Diabetes mellitus tip 1', da: 'Type 1 diabetes mellitus', nl: 'Diabetes mellitus type 1', fi: 'Tyypin 1 diabetes', fr: 'Diabète de type 1', de: 'Typ-1-Diabetes mellitus', hi: 'टाइप 1 मधुमेह', id: 'Diabetes Melitus Tipe 1', it: 'Diabete mellito di tipo 1', ja: '1型糖尿病', ko: '제1형 당뇨병', ms: 'Diabetes Mellitus Jenis 1', pt: 'Diabetes Mellitus Tipo 1', ru: 'Сахарный диабет 1 типа', sw: 'Kisukari cha aina ya 1', sv: 'Typ 1 diabetes mellitus', tr: 'Tip 1 diabetes mellitus', uk: 'Цукровий діабет 1 типу', ur: 'ٹائپ 1 ذیابیطس', vi: 'Đái tháo đường type 1', tl: 'Type 1 Diabetes Mellitus' },
    { en: 'Type 2 Diabetes Mellitus', el: 'Σακχαρώδης διαβήτης τύπου 2', ar: 'داء السكري من النوع الثاني', es: 'Diabetes Mellitus Tipo 2', af: 'Tipe 2 Diabetes Mellitus', sq: 'Diabeti mellitus tip 2', bn: 'টাইপ ২ ডায়াবেটিস মেলিটাস', zh: '2型糖尿病', 'zh-TW': '第二型糖尿病', hr: 'Diabetes mellitus tip 2', da: 'Type 2 diabetes mellitus', nl: 'Diabetes mellitus type 2', fi: 'Tyypin 2 diabetes', fr: 'Diabète de type 2', de: 'Typ-2-Diabetes mellitus', hi: 'टाइप 2 मधुमेह', id: 'Diabetes Melitus Tipe 2', it: 'Diabete mellito di tipo 2', ja: '2型糖尿病', ko: '제2형 당뇨병', ms: 'Diabetes Mellitus Jenis 2', pt: 'Diabetes Mellitus Tipo 2', ru: 'Сахарный диабет 2 типа', sw: 'Kisukari cha aina ya 2', sv: 'Typ 2 diabetes mellitus', tr: 'Tip 2 diabetes mellitus', uk: 'Цукровий діабет 2 типу', ur: 'ٹائپ 2 ذیابیطس', vi: 'Đái tháo đường type 2', tl: 'Type 2 Diabetes Mellitus' },
    { en: 'Hypothyroidism', el: 'Υποθυρεοειδισμός', ar: 'قصور الغدة الدرقية', es: 'Hipotiroidismo', af: 'Hipotiroïdisme', sq: 'Hipotiroidizmi', bn: 'হাইপোথাইরয়েডিজম', zh: '甲状腺功能减退', 'zh-TW': '甲狀腺功能低下', hr: 'Hipotireoza', da: 'Hypothyroidisme', nl: 'Hypothyreoïdie', fi: 'Kilpirauhasen vajaatoiminta', fr: 'Hypothyroïdie', de: 'Hypothyreose', hi: 'हाइपोथायरायडिज्म', id: 'Hipotiroidisme', it: 'Ipotiroidismo', ja: '甲状腺機能低下症', ko: '갑상선 기능 저하증', ms: 'Hipotiroidisme', pt: 'Hipotiroidismo', ru: 'Гипотиреоз', sw: 'Upungufu wa tezi ya tairodi', sv: 'Hypotyreos', tr: 'Hipotiroidizm', uk: 'Гіпотиреоз', ur: 'ہائپوتھائرائیڈزم', vi: 'Suy giáp', tl: 'Hypothyroidism' },
    { en: 'Hyperthyroidism', el: 'Υπερθυρεοειδισμός', ar: 'فرط نشاط الغدة الدرقية', es: 'Hipertiroidismo', af: 'Hipertiroïdisme', sq: 'Hipertiroidizmi', bn: 'হাইপারথাইরয়েডিজম', zh: '甲状腺功能亢进', 'zh-TW': '甲狀腺功能亢進', hr: 'Hipertireoza', da: 'Hypertyreoidi', nl: 'Hyperthyreoïdie', fi: 'Kilpirauhasen liikatoiminta', fr: 'Hyperthyroïdie', de: 'Hyperthyreose', hi: 'हाइपरथायरायडिज्म', id: 'Hipertiroidisme', it: 'Ipertiroidismo', ja: '甲状腺機能亢進症', ko: '갑상선 기능 항진증', ms: 'Hipertiroidisme', pt: 'Hipertiroidismo', ru: 'Гипертиреоз', sw: 'Utendaji kupita kiasi wa tezi ya tairodi', sv: 'Hypertyreos', tr: 'Hipertiroidizm', uk: 'Гіпертиреоз', ur: 'ہائپرتھائرائیڈزم', vi: 'Cường giáp', tl: 'Hyperthyroidism' },
    { en: 'Obesity', el: 'Παχυσαρκία', ar: 'السمنة', es: 'Obesidad', af: 'Vetsug', sq: 'Obeziteti', bn: 'স্থূলতা', zh: '肥胖症', 'zh-TW': '肥胖症', hr: 'Pretilost', da: 'Fedme', nl: 'Obesitas', fi: 'Lihavuus', fr: 'Obésité', de: 'Adipositas', hi: 'मोटापा', id: 'Obesitas', it: 'Obesità', ja: '肥満', ko: '비만', ms: 'Obesiti', pt: 'Obesidade', ru: 'Ожирение', sw: 'Unene kupita kiasi', sv: 'Fetma', tr: 'Obezite', uk: 'Ожиріння', ur: 'موٹاپا', vi: 'Béo phì', tl: 'Obesity' },
    { en: 'Osteoporosis', el: 'Οστεοπόρωση', ar: 'هشاشة العظام', es: 'Osteoporosis', af: 'Osteoporose', sq: 'Osteoporoza', bn: 'অস্টিওপোরোসিস', zh: '骨质疏松症', 'zh-TW': '骨質疏鬆症', hr: 'Osteoporoza', da: 'Osteoporose', nl: 'Osteoporose', fi: 'Osteoporoosi', fr: 'Ostéoporose', de: 'Osteoporose', hi: 'अस्थिसुषिरता', id: 'Osteoporosis', it: 'Osteoporosi', ja: '骨粗鬆症', ko: '골다공증', ms: 'Osteoporosis', pt: 'Osteoporose', ru: 'Остеопороз', sw: 'Udhaifu wa mifupa', sv: 'Osteoporos', tr: 'Osteoporoz', uk: 'Остеопороз', ur: 'ہڈیوں کی کمزوری', vi: 'Loãng xương', tl: 'Osteoporosis' },
    { en: 'Gout', el: 'Ουρική αρθρίτιδα', ar: 'النقرس', es: 'Gota', af: 'Jig', sq: 'Guta', bn: 'গেঁটে বাত', zh: '痛风', 'zh-TW': '痛風', hr: 'Giht', da: 'Gigt', nl: 'Jicht', fi: 'Kihti', fr: 'Goutte', de: 'Gicht', hi: 'गाउट', id: 'Asam Urat', it: 'Gotta', ja: '痛風', ko: '통풍', ms: 'Gout', pt: 'Gota', ru: 'Подагра', sw: 'Gout', sv: 'Gikt', tr: 'Gut', uk: 'Подагра', ur: 'گٹھیا', vi: 'Gút', tl: 'Gout' },
  ]},
  { en: 'Respiratory', el: 'Αναπνευστικά νοσήματα', ar: 'الجهاز التنفسي', es: 'Enfermedades Respiratorias', af: 'Respiratoriese siektes', sq: 'Sëmundjet e frymëmarrjes', bn: 'শ্বাসতন্ত্রের রোগ', zh: '呼吸系统疾病', 'zh-TW': '呼吸系統疾病', hr: 'Respiratorne bolesti', da: 'Luftvejssygdomme', nl: 'Longziekten', fi: 'Hengityselinsairaudet', fr: 'Maladies respiratoires', de: 'Atemwegserkrankungen', hi: 'श्वसन रोग', id: 'Penyakit Pernapasan', it: 'Malattie respiratorie', ja: '呼吸器疾患', ko: '호흡기 질환', ms: 'Penyakit Pernafasan', pt: 'Doenças Respiratórias', ru: 'Заболевания органов дыхания', sw: 'Magonjwa ya Mfumo wa Hewa', sv: 'Luftvägssjukdomar', tr: 'Solunum Hastalıkları', uk: 'Захворювання органів дихання', ur: 'سانس کی بیماریاں', vi: 'Bệnh hô hấp', tl: 'Sakit sa Paghinga', items: [
    { en: 'Asthma', el: 'Άσθμα', ar: 'الربو', es: 'Asma', af: 'Asma', sq: 'Astma', bn: 'হাঁপানি', zh: '哮喘', 'zh-TW': '氣喘', hr: 'Astma', da: 'Astma', nl: 'Astma', fi: 'Astma', fr: 'Asthme', de: 'Asthma', hi: 'दमा', id: 'Asma', it: 'Asma', ja: '喘息', ko: '천식', ms: 'Asma', pt: 'Asma', ru: 'Астма', sw: 'Pumu', sv: 'Astma', tr: 'Astım', uk: 'Астма', ur: 'دمہ', vi: 'Hen suyễn', tl: 'Hika' },
    { en: 'COPD (Chronic Obstructive Pulmonary Disease)', el: 'Χρόνια Αποφρακτική Πνευμονοπάθεια (ΧΑΠ)', ar: 'مرض الانسداد الرئوي المزمن', es: 'EPOC (Enfermedad Pulmonar Obstructiva Crónica)', af: 'COPD (Chroniese Obstruktiewe Longsiekte)', sq: 'COPD (Sëmundja kronike obstruktive pulmonare)', bn: 'সিওপিডি (ক্রনিক অবস্ট্রাক্টিভ পালমোনারি ডিজিজ)', zh: '慢性阻塞性肺疾病', 'zh-TW': '慢性阻塞性肺病', hr: 'KOPB (Kronična opstruktivna plućna bolest)', da: 'KOL (Kronisk obstruktiv lungesygdom)', nl: 'COPD (Chronische obstructieve longziekte)', fi: 'COPD (Keuhkoahtaumatauti)', fr: 'BPCO (Broncho-pneumopathie chronique obstructive)', de: 'COPD (Chronisch obstruktive Lungenerkrankung)', hi: 'सीओपीडी (क्रोनिक ऑब्सट्रक्टिव पल्मोनरी डिजीज)', id: 'PPOK (Penyakit Paru Obstruktif Kronik)', it: 'BPCO (Broncopneumopatia cronica ostruttiva)', ja: 'COPD（慢性閉塞性肺疾患）', ko: 'COPD (만성 폐쇄성 폐질환)', ms: 'COPD (Penyakit Paru-paru Obstruktif Kronik)', pt: 'DPOC (Doença Pulmonar Obstrutiva Crônica)', ru: 'ХОБЛ (Хроническая обструктивная болезнь лёгких)', sw: 'COPD (Ugonjwa sugu wa kuzuia hewa mapafu)', sv: 'KOL (Kronisk obstruktiv lungsjukdom)', tr: 'KOAH (Kronik obstrüktif akciğer hastalığı)', uk: 'ХОЗЛ (Хронічне обструктивне захворювання легень)', ur: 'سی او پی ڈی (دائمی رکاوٹ پھیپھڑوں کی بیماری)', vi: 'COPD (Bệnh phổi tắc nghẽn mạn tính)', tl: 'COPD (Chronic Obstructive Pulmonary Disease)' },
    { en: 'Pulmonary Fibrosis', el: 'Πνευμονική ίνωση', ar: 'التليف الرئوي', es: 'Fibrosis Pulmonar', af: 'Longfibrose', sq: 'Fibroza pulmonare', bn: 'পালমোনারি ফাইব্রোসিস', zh: '肺纤维化', 'zh-TW': '肺纖維化', hr: 'Plućna fibroza', da: 'Lungefibrose', nl: 'Longfibrose', fi: 'Keuhkofibroosi', fr: 'Fibrose pulmonaire', de: 'Lungenfibrose', hi: 'पल्मोनरी फाइब्रोसिस', id: 'Fibrosis Paru', it: 'Fibrosi polmonare', ja: '肺線維症', ko: '폐섬유증', ms: 'Fibrosis Pulmonari', pt: 'Fibrose Pulmonar', ru: 'Лёгочный фиброз', sw: 'Fibrosis ya mapafu', sv: 'Lungfibros', tr: 'Pulmoner fibrozis', uk: 'Легеневий фіброз', ur: 'پھیپھڑوں کی فائبروسس', vi: 'Xơ phổi', tl: 'Pulmonary Fibrosis' },
    { en: 'Sleep Apnoea', el: 'Υπνική άπνοια', ar: 'انقطاع التنفس أثناء النوم', es: 'Apnea del Sueño', af: 'Slaapapnee', sq: 'Apnea e gjumit', bn: 'ঘুমের মধ্যে শ্বাসরোধ', zh: '睡眠呼吸暂停', 'zh-TW': '睡眠呼吸中止症', hr: 'Apneja u snu', da: 'Søvnapnø', nl: 'Slaapapneu', fi: 'Uniapnea', fr: 'Apnée du sommeil', de: 'Schlafapnoe', hi: 'नींद में सांस रुकना', id: 'Apnea Tidur', it: 'Apnea notturna', ja: '睡眠時無呼吸症候群', ko: '수면 무호흡증', ms: 'Apnea Tidur', pt: 'Apneia do Sono', ru: 'Синдром ночного апноэ', sw: 'Kusimama kupumua wakati wa usingizi', sv: 'Sömnapné', tr: 'Uyku apnesi', uk: 'Нічне апное', ur: 'نیند میں سانس کا رکنا', vi: 'Ngưng thở khi ngủ', tl: 'Sleep Apnea' },
    { en: 'Allergic Rhinitis', el: 'Αλλεργική ρινίτιδα', ar: 'التهاب الأنف التحسسي', es: 'Rinitis Alérgica', af: 'Allergiese rinitis', sq: 'Riniti alergjik', bn: 'অ্যালার্জিক রাইনাইটিস', zh: '过敏性鼻炎', 'zh-TW': '過敏性鼻炎', hr: 'Alergijski rinitis', da: 'Allergisk rhinitis', nl: 'Allergische rhinitis', fi: 'Allerginen nuha', fr: 'Rhinite allergique', de: 'Allergische Rhinitis', hi: 'एलर्जिक राइनाइटिस', id: 'Rinitis Alergi', it: 'Rinite allergica', ja: 'アレルギー性鼻炎', ko: '알레르기성 비염', ms: 'Rhinitis Alergik', pt: 'Rinite Alérgica', ru: 'Аллергический ринит', sw: 'Pua ya mzio', sv: 'Allergisk rinit', tr: 'Alerjik rinit', uk: 'Алергічний риніт', ur: 'الرجک رائنائٹس', vi: 'Viêm mũi dị ứng', tl: 'Allergic Rhinitis' },
  ]},
  { en: 'Gastrointestinal', el: 'Γαστρεντερικά και ηπατικά νοσήματα', ar: 'الجهاز الهضمي', es: 'Enfermedades Gastrointestinales', af: 'Gastro-intestinale siektes', sq: 'Sëmundjet gastrointestinale', bn: 'গ্যাস্ট্রোইন্টেস্টিনাল রোগ', zh: '消化系统疾病', 'zh-TW': '消化系統疾病', hr: 'Gastrointestinalne bolesti', da: 'Mave-tarmsygdomme', nl: 'Maagdarmaandoeningen', fi: 'Ruuansulatuselinsairaudet', fr: 'Maladies gastro-intestinales', de: 'Magen-Darm-Erkrankungen', hi: 'पाचन तंत्र रोग', id: 'Penyakit Gastrointestinal', it: 'Malattie gastrointestinali', ja: '消化器疾患', ko: '소화기 질환', ms: 'Penyakit Gastrousus', pt: 'Doenças Gastrointestinais', ru: 'Заболевания ЖКТ', sw: 'Magonjwa ya Mfumo wa Usagaji Chakula', sv: 'Magtarmsjukdomar', tr: 'Gastrointestinal Hastalıklar', uk: 'Захворювання шлунково-кишкового тракту', ur: 'معدے اور آنتوں کی بیماریاں', vi: 'Bệnh tiêu hóa', tl: 'Gastrointestinal', items: [
    { en: 'Gastro-oesophageal Reflux Disease (GERD)', el: 'Γαστροοισοφαγική παλινδρόμηση (ΓΟΠ)', ar: 'داء الارتداد المعدي المريئي', es: 'Enfermedad por Reflujo Gastroesofágico (ERGE)', af: 'Gastro-oesofageale refluks (GERD)', sq: 'Sëmundja e refluksit gastroezofageal (GERD)', bn: 'গ্যাস্ট্রো-ইসোফেজিয়াল রিফ্লাক্স ডিজিজ (GERD)', zh: '胃食管反流病', 'zh-TW': '胃食道逆流疾病', hr: 'Gastroezofagealna refluksna bolest (GERB)', da: 'Gastroøsofageal reflukssygdom (GERD)', nl: 'Gastro-oesofageale refluxziekte (GERD)', fi: 'Refluksitauti (GERD)', fr: 'Reflux gastro-œsophagien (RGO)', de: 'Gastroösophageale Refluxkrankheit (GERD)', hi: 'गैस्ट्रो-ऑइसोफेजियल रिफ्लक्स रोग (GERD)', id: 'Penyakit Refluks Gastroesofageal (GERD)', it: 'Malattia da reflusso gastroesofageo (MRGE)', ja: '胃食道逆流症（GERD）', ko: '위식도 역류 질환 (GERD)', ms: 'Penyakit Refluks Gastroesofagus (GERD)', pt: 'Doença do Refluxo Gastroesofágico (DRGE)', ru: 'Гастроэзофагеальная рефлюксная болезнь (ГЭРБ)', sw: 'Ugonjwa wa kurudi kwa asidi ya tumbo', sv: 'Gastroesofageal refluxsjukdom (GERD)', tr: 'Gastroözofageal reflü hastalığı (GÖRH)', uk: 'Гастроезофагеальна рефлюксна хвороба (ГЕРХ)', ur: 'معدے کا تیزاب واپس آنا (GERD)', vi: 'Trào ngược dạ dày thực quản (GERD)', tl: 'Gastro-oesophageal Reflux Disease (GERD)' },
    { en: 'Peptic Ulcer Disease', el: 'Πεπτικό έλκος', ar: 'مرض القرحة الهضمية', es: 'Úlcera Péptica', af: 'Peptiese ulkussiekte', sq: 'Sëmundja e ulçerës peptike', bn: 'পেপটিক আলসার রোগ', zh: '消化性溃疡', 'zh-TW': '消化性潰瘍', hr: 'Peptički ulkus', da: 'Peptisk ulkussygdom', nl: 'Peptische ulcusziekte', fi: 'Peptinen haavauma', fr: 'Ulcère gastroduodénal', de: 'Peptisches Ulkusleiden', hi: 'पेप्टिक अल्सर रोग', id: 'Penyakit Ulkus Peptikum', it: 'Ulcera peptica', ja: '消化性潰瘍', ko: '소화성 궤양', ms: 'Penyakit Ulser Peptik', pt: 'Úlcera Péptica', ru: 'Язвенная болезнь', sw: 'Vidonda vya tumbo', sv: 'Peptisk ulcussjukdom', tr: 'Peptik ülser hastalığı', uk: 'Виразкова хвороба', ur: 'معدے کا السر', vi: 'Bệnh loét dạ dày tá tràng', tl: 'Peptic Ulcer Disease' },
    { en: "Inflammatory Bowel Disease (Crohn's / Ulcerative Colitis)", el: 'Φλεγμονώδης νόσος εντέρου (Νόσος Crohn / Ελκώδης κολίτιδα)', ar: 'مرض التهاب الأمعاء (كرون / التهاب القولون التقرحي)', es: "Enfermedad Inflamatoria Intestinal (Crohn / Colitis Ulcerosa)", af: "Inflammatoriese dermsiekte (Crohn / Ulseratiewe kolitis)", sq: "Sëmundja inflamatore e zorrëve (Crohn / Koliti ulceroz)", bn: 'প্রদাহজনক অন্ত্রের রোগ (ক্রোনস / আলসারেটিভ কোলাইটিস)', zh: '炎症性肠病（克罗恩病/溃疡性结肠炎）', 'zh-TW': '發炎性腸道疾病（克隆氏症/潰瘍性結腸炎）', hr: "Upalna bolest crijeva (Crohnova bolest / Ulcerozni kolitis)", da: "Inflammatorisk tarmsygdom (Crohns / Ulcerøs colitis)", nl: "Inflammatoire darmziekte (Crohn / Colitis ulcerosa)", fi: "Tulehduksellinen suolistosairaus (Crohnin tauti / Haavainen paksusuolitulehdus)", fr: "Maladie inflammatoire de l'intestin (Crohn / Rectocolite)", de: "Chronisch entzündliche Darmerkrankung (Morbus Crohn / Colitis ulcerosa)", hi: 'सूजन संबंधी आंत्र रोग (क्रोन / अल्सरेटिव कोलाइटिस)', id: "Penyakit Radang Usus (Crohn / Kolitis Ulseratif)", it: "Malattia infiammatoria intestinale (Crohn / Colite ulcerosa)", ja: '炎症性腸疾患（クローン病/潰瘍性大腸炎）', ko: '염증성 장 질환 (크론병 / 궤양성 대장염)', ms: "Penyakit Usus Radang (Crohn / Kolitis Ulseratif)", pt: "Doença Inflamatória Intestinal (Crohn / Colite Ulcerosa)", ru: 'Воспалительные заболевания кишечника (Болезнь Крона / Язвенный колит)', sw: "Ugonjwa wa uvimbe wa utumbo (Crohn / Kolitis ya vidonda)", sv: "Inflammatorisk tarmsjukdom (Crohns / Ulcerös kolit)", tr: "İnflamatuar bağırsak hastalığı (Crohn / Ülseratif kolit)", uk: 'Запальні захворювання кишківника (Хвороба Крона / Виразковий коліт)', ur: 'سوزش والی آنتوں کی بیماری (کروہن / السرٹیو کولائٹس)', vi: 'Bệnh viêm ruột (Crohn / Viêm loét đại tràng)', tl: "Inflammatory Bowel Disease (Crohn's / Ulcerative Colitis)" },
    { en: 'Irritable Bowel Syndrome', el: 'Σύνδρομο ευερέθιστου εντέρου', ar: 'متلازمة القولون العصبي', es: 'Síndrome de Intestino Irritable', af: 'Prikkelbare dermkanaal-sindroom', sq: 'Sindroma e zorrës së irritueshme', bn: 'ইরিটেবল বাওয়েল সিনড্রোম', zh: '肠易激综合征', 'zh-TW': '腸躁症', hr: 'Sindrom iritabilnog crijeva', da: 'Irritabel tyktarm', nl: 'Prikkelbare darm syndroom', fi: 'Ärtyvän suolen oireyhtymä', fr: "Syndrome de l'intestin irritable", de: 'Reizdarmsyndrom', hi: 'चिड़चिड़ा आंत्र सिंड्रोम', id: 'Sindrom Usus Besar Sensitif', it: "Sindrome dell'intestino irritabile", ja: '過敏性腸症候群', ko: '과민성 대장 증후군', ms: 'Sindrom Usus Mudah Marah', pt: 'Síndrome do Intestino Irritável', ru: 'Синдром раздражённого кишечника', sw: 'Ugonjwa wa utumbo msisitizi', sv: 'Irritabel tarm', tr: 'İrritabl bağırsak sendromu', uk: 'Синдром подразненого кишківника', ur: 'آنتوں کا سنڈروم', vi: 'Hội chứng ruột kích thích', tl: 'Irritable Bowel Syndrome' },
    { en: 'Chronic Liver Disease / Cirrhosis', el: 'Χρόνια ηπατική νόσος / Κίρρωση', ar: 'مرض الكبد المزمن / تليف الكبد', es: 'Enfermedad Hepática Crónica / Cirrosis', af: 'Chroniese lewernsiekte / Sirrose', sq: 'Sëmundja kronike e mëlçisë / Cirroza', bn: 'ক্রনিক লিভার রোগ / সিরোসিস', zh: '慢性肝病 / 肝硬化', 'zh-TW': '慢性肝病 / 肝硬化', hr: 'Kronična bolest jetre / Ciroza', da: 'Kronisk leversygdom / Cirrose', nl: 'Chronische leverziekte / Cirrose', fi: 'Krooninen maksasairaus / Maksakirroosi', fr: 'Maladie hépatique chronique / Cirrhose', de: 'Chronische Lebererkrankung / Zirrhose', hi: 'क्रोनिक लिवर रोग / सिरोसिस', id: 'Penyakit Hati Kronis / Sirosis', it: 'Epatopatia cronica / Cirrosi', ja: '慢性肝疾患 / 肝硬変', ko: '만성 간 질환 / 간경변', ms: 'Penyakit Hati Kronik / Sirosis', pt: 'Doença Hepática Crónica / Cirrose', ru: 'Хроническое заболевание печени / Цирроз', sw: 'Ugonjwa sugu wa ini / Ugumu wa ini', sv: 'Kronisk leversjukdom / Levercirros', tr: 'Kronik karaciğer hastalığı / Siroz', uk: 'Хронічне захворювання печінки / Цироз', ur: 'دائمی جگر کی بیماری / سروسس', vi: 'Bệnh gan mạn tính / Xơ gan', tl: 'Chronic Liver Disease / Cirrhosis' },
    { en: 'Hepatitis B', el: 'Ηπατίτιδα Β', ar: 'التهاب الكبد الفيروسي ب', es: 'Hepatitis B', af: 'Hepatitis B', sq: 'Hepatiti B', bn: 'হেপাটাইটিস বি', zh: '乙型肝炎', 'zh-TW': 'B型肝炎', hr: 'Hepatitis B', da: 'Hepatitis B', nl: 'Hepatitis B', fi: 'Hepatiitti B', fr: 'Hépatite B', de: 'Hepatitis B', hi: 'हेपेटाइटिस बी', id: 'Hepatitis B', it: 'Epatite B', ja: 'B型肝炎', ko: 'B형 간염', ms: 'Hepatitis B', pt: 'Hepatite B', ru: 'Гепатит B', sw: 'Homa ya ini B', sv: 'Hepatit B', tr: 'Hepatit B', uk: 'Гепатит B', ur: 'ہیپاٹائٹس بی', vi: 'Viêm gan B', tl: 'Hepatitis B' },
    { en: 'Hepatitis C', el: 'Ηπατίτιδα C', ar: 'التهاب الكبد الفيروسي ج', es: 'Hepatitis C', af: 'Hepatitis C', sq: 'Hepatiti C', bn: 'হেপাটাইটিস সি', zh: '丙型肝炎', 'zh-TW': 'C型肝炎', hr: 'Hepatitis C', da: 'Hepatitis C', nl: 'Hepatitis C', fi: 'Hepatiitti C', fr: 'Hépatite C', de: 'Hepatitis C', hi: 'हेपेटाइटिस सी', id: 'Hepatitis C', it: 'Epatite C', ja: 'C型肝炎', ko: 'C형 간염', ms: 'Hepatitis C', pt: 'Hepatite C', ru: 'Гепатит C', sw: 'Homa ya ini C', sv: 'Hepatit C', tr: 'Hepatit C', uk: 'Гепатит C', ur: 'ہیپاٹائٹس سی', vi: 'Viêm gan C', tl: 'Hepatitis C' },
  ]},
  { en: 'Mental Health & Neurology', el: 'Ψυχιατρικά και νευρολογικά νοσήματα', ar: 'الصحة النفسية والأعصاب', es: 'Salud Mental y Neurología', af: 'Geestesgesondheid en Neurologie', sq: 'Shëndeti mendor dhe Neurologjia', bn: 'মানসিক স্বাস্থ্য ও স্নায়ুবিজ্ঞান', zh: '精神健康与神经学', 'zh-TW': '精神健康與神經學', hr: 'Mentalno zdravlje i neurologija', da: 'Mental sundhed og neurologi', nl: 'Geestelijke gezondheid en neurologie', fi: 'Mielenterveys ja neurologia', fr: 'Santé mentale et neurologie', de: 'Psychische Gesundheit und Neurologie', hi: 'मानसिक स्वास्थ्य और तंत्रिका विज्ञान', id: 'Kesehatan Mental dan Neurologi', it: 'Salute mentale e neurologia', ja: '精神科・神経科', ko: '정신 건강 및 신경과', ms: 'Kesihatan Mental dan Neurologi', pt: 'Saúde Mental e Neurologia', ru: 'Психическое здоровье и неврология', sw: 'Afya ya Akili na Neva', sv: 'Psykisk hälsa och neurologi', tr: 'Ruh sağlığı ve Nöroloji', uk: "Психічне здоров'я та неврологія", ur: 'ذہنی صحت اور نیورولوجی', vi: 'Sức khỏe tâm thần và thần kinh học', tl: 'Kalusugang Pangkaisipan at Neurolohiya', items: [
    { en: 'Depression', el: 'Κατάθλιψη', ar: 'الاكتئاب', es: 'Depresión', af: 'Depressie', sq: 'Depresioni', bn: 'বিষণ্নতা', zh: '抑郁症', 'zh-TW': '憂鬱症', hr: 'Depresija', da: 'Depression', nl: 'Depressie', fi: 'Masennus', fr: 'Dépression', de: 'Depression', hi: 'अवसाद', id: 'Depresi', it: 'Depressione', ja: 'うつ病', ko: '우울증', ms: 'Kemurungan', pt: 'Depressão', ru: 'Депрессия', sw: 'Unyogovu', sv: 'Depression', tr: 'Depresyon', uk: 'Депресія', ur: 'ڈپریشن', vi: 'Trầm cảm', tl: 'Depresyon' },
    { en: 'Anxiety Disorder', el: 'Αγχώδεις διαταραχές', ar: 'اضطراب القلق', es: 'Trastorno de Ansiedad', af: 'Angsversteuring', sq: 'Çrregullimi i ankthit', bn: 'উদ্বেগজনিত ব্যাধি', zh: '焦虑症', 'zh-TW': '焦慮症', hr: 'Anksiozni poremećaj', da: 'Angstlidelse', nl: 'Angststoornis', fi: 'Ahdistuneisuushäiriö', fr: 'Trouble anxieux', de: 'Angststörung', hi: 'चिंता विकार', id: 'Gangguan Kecemasan', it: "Disturbo d'ansia", ja: '不安障害', ko: '불안 장애', ms: 'Gangguan Kebimbangan', pt: 'Transtorno de Ansiedade', ru: 'Тревожное расстройство', sw: 'Ugonjwa wa wasiwasi', sv: 'Ångestsyndrom', tr: 'Anksiyete bozukluğu', uk: 'Тривожний розлад', ur: 'اضطراب کی خرابی', vi: 'Rối loạn lo âu', tl: 'Anxiety Disorder' },
    { en: 'Bipolar Disorder', el: 'Διπολική διαταραχή', ar: 'الاضطراب ثنائي القطب', es: 'Trastorno Bipolar', af: 'Bipolêre versteuring', sq: 'Çrregullimi bipolar', bn: 'বাইপোলার ডিসঅর্ডার', zh: '双相情感障碍', 'zh-TW': '躁鬱症', hr: 'Bipolarni poremećaj', da: 'Bipolar lidelse', nl: 'Bipolaire stoornis', fi: 'Kaksisuuntainen mielialahäiriö', fr: 'Trouble bipolaire', de: 'Bipolare Störung', hi: 'द्विध्रुवी विकार', id: 'Gangguan Bipolar', it: 'Disturbo bipolare', ja: '双極性障害', ko: '양극성 장애', ms: 'Gangguan Bipolar', pt: 'Transtorno Bipolar', ru: 'Биполярное расстройство', sw: 'Ugonjwa wa bipolar', sv: 'Bipolär sjukdom', tr: 'Bipolar bozukluk', uk: 'Біполярний розлад', ur: 'بائی پولر ڈس آرڈر', vi: 'Rối loạn lưỡng cực', tl: 'Bipolar Disorder' },
    { en: 'Schizophrenia / Psychosis', el: 'Σχιζοφρένεια / Ψύχωση', ar: 'الفصام / الذهان', es: 'Esquizofrenia / Psicosis', af: 'Skisofrenie / Psigose', sq: 'Skizofrenia / Psikoza', bn: 'সিজোফ্রেনিয়া / সাইকোসিস', zh: '精神分裂症 / 精神病', 'zh-TW': '思覺失調症 / 精神病', hr: 'Shizofrenija / Psihoza', da: 'Skizofreni / Psykose', nl: 'Schizofrenie / Psychose', fi: 'Skitsofrenia / Psykoosi', fr: 'Schizophrénie / Psychose', de: 'Schizophrenie / Psychose', hi: 'सिज़ोफ्रेनिया / मनोविकृति', id: 'Skizofrenia / Psikosis', it: 'Schizofrenia / Psicosi', ja: '統合失調症 / 精神病', ko: '조현병 / 정신병', ms: 'Skizofrenia / Psikosis', pt: 'Esquizofrenia / Psicose', ru: 'Шизофрения / Психоз', sw: 'Ugonjwa wa akili wa skizofreniya / Psikosi', sv: 'Schizofreni / Psykos', tr: 'Şizofreni / Psikoz', uk: 'Шизофренія / Психоз', ur: 'شیزوفرینیا / نفسیاتی مرض', vi: 'Tâm thần phân liệt / Loạn thần', tl: 'Schizophrenia / Psychosis' },
    { en: 'ADHD', el: 'Διαταραχή ελλειμματικής προσοχής και υπερκινητικότητας (ΔΕΠΥ)', ar: 'اضطراب نقص الانتباه وفرط الحركة', es: 'TDAH (Trastorno por Déficit de Atención e Hiperactividad)', af: 'ADHD', sq: 'ADHD', bn: 'এডিএইচডি', zh: '注意缺陷多动障碍', 'zh-TW': '注意力不足過動症', hr: 'ADHD', da: 'ADHD', nl: 'ADHD', fi: 'ADHD', fr: 'TDAH', de: 'ADHS', hi: 'एडीएचडी', id: 'ADHD', it: 'ADHD', ja: 'ADHD（注意欠如・多動症）', ko: 'ADHD', ms: 'ADHD', pt: 'TDAH', ru: 'СДВГ', sw: 'ADHD', sv: 'ADHD', tr: 'DEHB', uk: 'СДУГ', ur: 'اے ڈی ایچ ڈی', vi: 'ADHD', tl: 'ADHD' },
    { en: 'Epilepsy / Seizure Disorder', el: 'Επιληψία / Επιληπτικές κρίσεις', ar: 'الصرع / اضطراب النوبات', es: 'Epilepsia / Trastorno Convulsivo', af: 'Epilepsie / Aanvalversteuring', sq: 'Epilepsia / Çrregullimi i konfiskimit', bn: 'মৃগীরোগ / খিঁচুনি রোগ', zh: '癫痫 / 癫痫发作障碍', 'zh-TW': '癲癇 / 癲癇發作障礙', hr: 'Epilepsija / Konvulzivni poremećaj', da: 'Epilepsi / Krampelidelse', nl: 'Epilepsie / Aanvalsziekte', fi: 'Epilepsia / Kohtausoire', fr: 'Épilepsie / Trouble épileptique', de: 'Epilepsie / Anfallsleiden', hi: 'मिर्गी / दौरा विकार', id: 'Epilepsi / Gangguan Kejang', it: 'Epilessia / Disturbo convulsivo', ja: 'てんかん / 発作性疾患', ko: '뇌전증 / 발작 장애', ms: 'Epilepsi / Gangguan Sawan', pt: 'Epilepsia / Transtorno Convulsivo', ru: 'Эпилепсия / Судорожное расстройство', sw: 'Kifafa / Ugonjwa wa degedege', sv: 'Epilepsi / Krampsjukdom', tr: 'Epilepsi / Nöbet bozukluğu', uk: 'Епілепсія / Судомний розлад', ur: 'مرگی / دورے کی بیماری', vi: 'Động kinh / Rối loạn co giật', tl: 'Epilepsy / Seizure Disorder' },
    { en: "Parkinson's Disease", el: 'Νόσος Πάρκινσον', ar: 'مرض باركنسون', es: 'Enfermedad de Parkinson', af: 'Parkinsonsiekte', sq: "Sëmundja e Parkinsonit", bn: 'পার্কিনসনস রোগ', zh: '帕金森病', 'zh-TW': '帕金森氏症', hr: 'Parkinsonova bolest', da: 'Parkinsons sygdom', nl: 'De ziekte van Parkinson', fi: 'Parkinsonin tauti', fr: 'Maladie de Parkinson', de: 'Parkinson-Krankheit', hi: 'पार्किंसन रोग', id: 'Penyakit Parkinson', it: "Malattia di Parkinson", ja: 'パーキンソン病', ko: '파킨슨병', ms: "Penyakit Parkinson", pt: "Doença de Parkinson", ru: 'Болезнь Паркинсона', sw: "Ugonjwa wa Parkinson", sv: "Parkinsons sjukdom", tr: "Parkinson hastalığı", uk: "Хвороба Паркінсона", ur: "پارکنسنز کی بیماری", vi: "Bệnh Parkinson", tl: "Sakit na Parkinson" },
    { en: "Alzheimer's / Dementia", el: 'Νόσος Αλτσχάιμερ / Άνοια', ar: 'الزهايمر / الخرف', es: 'Alzheimer / Demencia', af: "Alzheimer / Demensie", sq: "Alzheimer / Demencia", bn: 'আলঝেইমার / ডিমেনশিয়া', zh: '阿尔茨海默病 / 痴呆', 'zh-TW': '阿茲海默症 / 失智症', hr: "Alzheimerova bolest / Demencija", da: "Alzheimers / Demens", nl: "Alzheimer / Dementie", fi: "Alzheimer / Dementia", fr: "Alzheimer / Démence", de: "Alzheimer / Demenz", hi: 'अल्जाइमर / मनोभ्रंश', id: "Alzheimer / Demensia", it: "Alzheimer / Demenza", ja: 'アルツハイマー病 / 認知症', ko: '알츠하이머 / 치매', ms: "Alzheimer / Demensia", pt: "Alzheimer / Demência", ru: 'Болезнь Альцгеймера / Деменция', sw: "Alzheimer / Ugonjwa wa kusahau", sv: "Alzheimers / Demens", tr: "Alzheimer / Bunama", uk: "Хвороба Альцгеймера / Деменція", ur: "الزائمر / ڈیمنشیا", vi: "Alzheimer / Sa sút trí tuệ", tl: "Alzheimer's / Dementia" },
    { en: 'Multiple Sclerosis', el: 'Πολλαπλή σκλήρυνση', ar: 'التصلب المتعدد', es: 'Esclerosis Múltiple', af: 'Meervoudige sklerose', sq: 'Skleroza multiple', bn: 'মাল্টিপল স্ক্লেরোসিস', zh: '多发性硬化症', 'zh-TW': '多發性硬化症', hr: 'Multipla skleroza', da: 'Multipel sklerose', nl: 'Multiple sclerose', fi: 'MS-tauti', fr: 'Sclérose en plaques', de: 'Multiple Sklerose', hi: 'मल्टीपल स्क्लेरोसिस', id: 'Multiple Sclerosis', it: 'Sclerosi multipla', ja: '多発性硬化症', ko: '다발성 경화증', ms: 'Multiple Sklerosis', pt: 'Esclerose Múltipla', ru: 'Рассеянный склероз', sw: 'Ugonjwa wa mfumo wa neva', sv: 'Multipel skleros', tr: 'Multipl skleroz', uk: 'Розсіяний склероз', ur: 'ملٹیپل سکلیروسس', vi: 'Bệnh xơ cứng rải rác', tl: 'Multiple Sclerosis' },
    { en: 'Migraine', el: 'Ημικρανία', ar: 'الصداع النصفي', es: 'Migraña', af: 'Migreine', sq: 'Migrena', bn: 'মাইগ্রেন', zh: '偏头痛', 'zh-TW': '偏頭痛', hr: 'Migrena', da: 'Migræne', nl: 'Migraine', fi: 'Migreeni', fr: 'Migraine', de: 'Migräne', hi: 'माइग्रेन', id: 'Migrain', it: 'Emicrania', ja: '片頭痛', ko: '편두통', ms: 'Migrain', pt: 'Enxaqueca', ru: 'Мигрень', sw: 'Maumivu ya kichwa ya migraine', sv: 'Migrän', tr: 'Migren', uk: 'Мігрень', ur: 'درد شقیقہ', vi: 'Đau nửa đầu', tl: 'Migraine' },
  ]},
  { en: 'Musculoskeletal', el: 'Ρευματολογικά και μυοσκελετικά νοσήματα', ar: 'الجهاز العضلي الهيكلي', es: 'Enfermedades Musculoesqueléticas', af: 'Muskuloskeletale siektes', sq: 'Sëmundjet muskuloskeletore', bn: 'পেশী-কঙ্কাল রোগ', zh: '肌肉骨骼疾病', 'zh-TW': '肌肉骨骼疾病', hr: 'Mišićno-koštane bolesti', da: 'Muskel- og skeletsygdomme', nl: 'Spier- en skeletaandoeningen', fi: 'Tuki- ja liikuntaelinsairaudet', fr: 'Maladies musculo-squelettiques', de: 'Muskel-Skelett-Erkrankungen', hi: 'मस्कुलोस्केलेटल रोग', id: 'Penyakit Muskuloskeletal', it: 'Malattie muscolo-scheletriche', ja: '筋骨格系疾患', ko: '근골격계 질환', ms: 'Penyakit Muskuloskeletal', pt: 'Doenças Musculoesqueléticas', ru: 'Заболевания опорно-двигательного аппарата', sw: 'Magonjwa ya Misuli na Mifupa', sv: 'Muskuloskeletala sjukdomar', tr: 'Kas-iskelet Hastalıkları', uk: 'Захворювання опорно-рухового апарату', ur: 'عضلات اور ہڈیوں کی بیماریاں', vi: 'Bệnh cơ xương khớp', tl: 'Musculoskeletal', items: [
    { en: 'Rheumatoid Arthritis', el: 'Ρευματοειδής αρθρίτιδα', ar: 'التهاب المفاصل الروماتويدي', es: 'Artritis Reumatoide', af: 'Rumatoïede artritis', sq: 'Artrit reumatoid', bn: 'রিউমাটয়েড আর্থ্রাইটিস', zh: '类风湿关节炎', 'zh-TW': '類風濕性關節炎', hr: 'Reumatoidni artritis', da: 'Reumatoid artritis', nl: 'Reumatoïde artritis', fi: 'Nivelreuma', fr: 'Polyarthrite rhumatoïde', de: 'Rheumatoide Arthritis', hi: 'रुमेटीइड आर्थ्राइटिस', id: 'Artritis Reumatoid', it: 'Artrite reumatoide', ja: '関節リウマチ', ko: '류마티스 관절염', ms: 'Artritis Reumatoid', pt: 'Artrite Reumatoide', ru: 'Ревматоидный артрит', sw: 'Ugonjwa wa viungo vya rheumatoid', sv: 'Reumatoid artrit', tr: 'Romatoid artrit', uk: 'Ревматоїдний артрит', ur: 'ریمٹائڈ آرتھرائٹس', vi: 'Viêm khớp dạng thấp', tl: 'Rheumatoid Arthritis' },
    { en: 'Osteoarthritis', el: 'Οστεοαρθρίτιδα', ar: 'الفصال العظمي', es: 'Osteoartritis', af: 'Osteoartritis', sq: 'Osteoartriti', bn: 'অস্টিওআর্থ্রাইটিস', zh: '骨关节炎', 'zh-TW': '骨關節炎', hr: 'Osteoartritis', da: 'Slidgigt', nl: 'Artrose', fi: 'Nivelrikko', fr: 'Arthrose', de: 'Arthrose', hi: 'ऑस्टियोआर्थ्राइटिस', id: 'Osteoartritis', it: 'Osteoartrite', ja: '変形性関節症', ko: '골관절염', ms: 'Osteoartritis', pt: 'Osteoartrite', ru: 'Остеоартрит', sw: 'Ugonjwa wa maumivu ya viungo', sv: 'Artros', tr: 'Osteoartrit', uk: 'Остеоартрит', ur: 'ہڈیوں کے جوڑوں کی بیماری', vi: 'Thoái hóa khớp', tl: 'Osteoarthritis' },
    { en: 'Systemic Lupus Erythematosus (SLE)', el: 'Συστηματικός ερυθηματώδης λύκος', ar: 'الذئبة الحمامية الجهازية', es: 'Lupus Eritematoso Sistémico (LES)', af: 'Sistemiese lupus erythematosus (SLE)', sq: 'Lupusi eritematoz sistemik (LES)', bn: 'সিস্টেমিক লুপাস এরিথেমাটোসাস (SLE)', zh: '系统性红斑狼疮', 'zh-TW': '全身性紅斑性狼瘡', hr: 'Sistemski eritematozni lupus (SLE)', da: 'Systemisk lupus erythematosus (SLE)', nl: 'Systemische lupus erythematosus (SLE)', fi: 'Systeeminen lupus erythematosus (SLE)', fr: 'Lupus érythémateux systémique (LES)', de: 'Systemischer Lupus erythematodes (SLE)', hi: 'सिस्टेमिक ल्यूपस एरिथेमेटोसस (एसएलई)', id: 'Lupus Eritematosus Sistemik (LES)', it: 'Lupus eritematoso sistemico (LES)', ja: '全身性エリテマトーデス（SLE）', ko: '전신 홍반 루푸스 (SLE)', ms: 'Lupus Eritematosus Sistemik (SLE)', pt: 'Lúpus Eritematoso Sistémico (LES)', ru: 'Системная красная волчанка (СКВ)', sw: 'Lupus ya mwili wote (SLE)', sv: 'Systemisk lupus erythematosus (SLE)', tr: 'Sistemik lupus eritematozus (SLE)', uk: 'Системний червоний вовчак (СЧВ)', ur: 'سسٹیمک لوپس ایریتھیمیٹوسس (ایس ایل ای)', vi: 'Lupus ban đỏ hệ thống (SLE)', tl: 'Systemic Lupus Erythematosus (SLE)' },
    { en: 'Ankylosing Spondylitis', el: 'Αγκυλοποιητική σπονδυλίτιδα', ar: 'التهاب الفقار اللاصق', es: 'Espondilitis Anquilosante', af: 'Ankiloserende spondilitis', sq: 'Spondiliti ankilozant', bn: 'অ্যাঙ্কাইলোজিং স্পন্ডিলাইটিস', zh: '强直性脊柱炎', 'zh-TW': '僵直性脊椎炎', hr: 'Ankilozantni spondilitis', da: 'Ankyloserende spondylitis', nl: 'Ankyloserende spondylitis', fi: 'Selkärankareuma', fr: 'Spondylarthrite ankylosante', de: 'Ankylosierende Spondylitis', hi: 'एंकिलोजिंग स्पॉन्डिलाइटिस', id: 'Spondilitis Ankilosa', it: 'Spondilite anchilosante', ja: '強直性脊椎炎', ko: '강직성 척추염', ms: 'Spondilitis Ankilos', pt: 'Espondilite Anquilosante', ru: 'Анкилозирующий спондилит', sw: 'Ugonjwa wa mgongo ankylosing spondylitis', sv: 'Ankyloserande spondylit', tr: 'Ankilozan spondilit', uk: 'Анкілозуючий спондиліт', ur: 'انکائلوزنگ اسپونڈیلائٹس', vi: 'Viêm cột sống dính khớp', tl: 'Ankylosing Spondylitis' },
    { en: 'Psoriatic Arthritis', el: 'Ψωριασική αρθρίτιδα', ar: 'التهاب المفاصل الصدفي', es: 'Artritis Psoriásica', af: 'Psoriatiese artritis', sq: 'Artrit psoriatik', bn: 'সোরিয়াটিক আর্থ্রাইটিস', zh: '银屑病关节炎', 'zh-TW': '乾癬性關節炎', hr: 'Psorijatični artritis', da: 'Psoriasisgigt', nl: 'Psoriasisartritis', fi: 'Psoriaasiartriitti', fr: 'Rhumatisme psoriasique', de: 'Psoriasisarthritis', hi: 'सोरायटिक आर्थ्राइटिस', id: 'Artritis Psoriasis', it: 'Artrite psoriasica', ja: '乾癬性関節炎', ko: '건선성 관절염', ms: 'Artritis Psoriatik', pt: 'Artrite Psoriática', ru: 'Псориатический артрит', sw: 'Ugonjwa wa viungo wa psoriatic', sv: 'Psoriasisartrit', tr: 'Psoriyatik artrit', uk: 'Псоріатичний артрит', ur: 'سورائٹک آرتھرائٹس', vi: 'Viêm khớp vẩy nến', tl: 'Psoriatic Arthritis' },
  ]},
  { en: 'Oncology', el: 'Κακοήθειες (Καρκίνος)', ar: 'الأورام', es: 'Oncología', af: 'Onkologie', sq: 'Onkologjia', bn: 'অনকোলজি', zh: '肿瘤科', 'zh-TW': '腫瘤科', hr: 'Onkologija', da: 'Onkologi', nl: 'Oncologie', fi: 'Onkologia', fr: 'Oncologie', de: 'Onkologie', hi: 'ऑन्कोलॉजी', id: 'Onkologi', it: 'Oncologia', ja: '腫瘍科', ko: '종양학', ms: 'Onkologi', pt: 'Oncologia', ru: 'Онкология', sw: 'Saratani', sv: 'Onkologi', tr: 'Onkoloji', uk: 'Онкологія', ur: 'آنکولوجی', vi: 'Ung thư học', tl: 'Onkolohiya', items: [
    { en: 'Breast Cancer', el: 'Καρκίνος μαστού', ar: 'سرطان الثدي', es: 'Cáncer de Mama', af: 'Borskanker', sq: 'Kanceri i gjirit', bn: 'স্তন ক্যান্সার', zh: '乳腺癌', 'zh-TW': '乳癌', hr: 'Rak dojke', da: 'Brystkræft', nl: 'Borstkanker', fi: 'Rintasyöpä', fr: 'Cancer du sein', de: 'Brustkrebs', hi: 'स्तन कैंसर', id: 'Kanker Payudara', it: 'Cancro al seno', ja: '乳がん', ko: '유방암', ms: 'Kanser Payudara', pt: 'Câncer de Mama', ru: 'Рак молочной железы', sw: 'Saratani ya matiti', sv: 'Bröstcancer', tr: 'Meme kanseri', uk: 'Рак молочної залози', ur: 'چھاتی کا سرطان', vi: 'Ung thư vú', tl: 'Kanser sa Suso' },
    { en: 'Prostate Cancer', el: 'Καρκίνος προστάτη', ar: 'سرطان البروستاتا', es: 'Cáncer de Próstata', af: 'Prostaatkanker', sq: 'Kanceri i prostatës', bn: 'প্রোস্টেট ক্যান্সার', zh: '前列腺癌', 'zh-TW': '攝護腺癌', hr: 'Rak prostate', da: 'Prostatakræft', nl: 'Prostaatkanker', fi: 'Eturauhassyöpä', fr: 'Cancer de la prostate', de: 'Prostatakrebs', hi: 'प्रोस्टेट कैंसर', id: 'Kanker Prostat', it: 'Cancro alla prostata', ja: '前立腺がん', ko: '전립선암', ms: 'Kanser Prostat', pt: 'Câncer de Próstata', ru: 'Рак предстательной железы', sw: 'Saratani ya kibofu cha mkojo', sv: 'Prostatacancer', tr: 'Prostat kanseri', uk: 'Рак передміхурової залози', ur: 'پروسٹیٹ کا سرطان', vi: 'Ung thư tuyến tiền liệt', tl: 'Kanser sa Prostate' },
    { en: 'Colorectal Cancer', el: 'Καρκίνος παχέος εντέρου', ar: 'سرطان القولون والمستقيم', es: 'Cáncer Colorrectal', af: 'Kolorektale kanker', sq: 'Kanceri kolorektal', bn: 'কোলোরেক্টাল ক্যান্সার', zh: '结直肠癌', 'zh-TW': '大腸直腸癌', hr: 'Kolorektalni rak', da: 'Kolorektal kræft', nl: 'Colorectale kanker', fi: 'Paksusuolensyöpä', fr: 'Cancer colorectal', de: 'Darmkrebs', hi: 'कोलोरेक्टल कैंसर', id: 'Kanker Kolorektal', it: 'Cancro colorettale', ja: '大腸がん', ko: '대장암', ms: 'Kanser Kolorektal', pt: 'Câncer Colorretal', ru: 'Колоректальный рак', sw: 'Saratani ya utumbo mpana', sv: 'Kolorektal cancer', tr: 'Kolorektal kanser', uk: 'Колоректальний рак', ur: 'آنت کا سرطان', vi: 'Ung thư đại trực tràng', tl: 'Colorectal Cancer' },
    { en: 'Lung Cancer', el: 'Καρκίνος πνεύμονα', ar: 'سرطان الرئة', es: 'Cáncer de Pulmón', af: 'Longkanker', sq: 'Kanceri i mushkërive', bn: 'ফুসফুস ক্যান্সার', zh: '肺癌', 'zh-TW': '肺癌', hr: 'Rak pluća', da: 'Lungekræft', nl: 'Longkanker', fi: 'Keuhkosyöpä', fr: 'Cancer du poumon', de: 'Lungenkrebs', hi: 'फेफड़े का कैंसर', id: 'Kanker Paru-paru', it: 'Cancro al polmone', ja: '肺がん', ko: '폐암', ms: 'Kanser Paru-paru', pt: 'Câncer de Pulmão', ru: 'Рак лёгких', sw: 'Saratani ya mapafu', sv: 'Lungcancer', tr: 'Akciğer kanseri', uk: 'Рак легенів', ur: 'پھیپھڑوں کا سرطان', vi: 'Ung thư phổi', tl: 'Kanser sa Baga' },
    { en: 'Haematological Malignancy (Leukaemia / Lymphoma / Myeloma)', el: 'Αιματολογική κακοήθεια (Λευχαιμία / Λέμφωμα / Μυέλωμα)', ar: 'الأورام الخبيثة الدموية (اللوكيميا / الليمفوما / المايلوما)', es: 'Neoplasia Hematológica (Leucemia / Linfoma / Mieloma)', af: 'Hematologiese maligniteit (Leukemie / Limfoom / Mieloom)', sq: 'Malinjteti hematologjik (Leuçemia / Limfoma / Mieloma)', bn: 'হেমাটোলজিক্যাল ম্যালিগন্যান্সি (লিউকেমিয়া / লিম্ফোমা / মায়েলোমা)', zh: '血液系统恶性肿瘤（白血病/淋巴瘤/骨髓瘤）', 'zh-TW': '血液惡性腫瘤（白血病/淋巴瘤/骨髓瘤）', hr: 'Hematološka maligna bolest (Leukemija / Limfom / Mijelom)', da: 'Hæmatologisk malignitet (Leukæmi / Lymfom / Myelom)', nl: 'Hematologische maligniteit (Leukemie / Lymfoom / Myeloom)', fi: 'Hematologinen pahanlaatuisuus (Leukemia / Lymfooma / Myelooma)', fr: 'Hémopathie maligne (Leucémie / Lymphome / Myélome)', de: 'Hämatologische Malignität (Leukämie / Lymphom / Myelom)', hi: 'हेमेटोलॉजिकल मालिग्नेंसी (ल्यूकेमिया / लिम्फोमा / मायलोमा)', id: 'Keganasan Hematologi (Leukemia / Limfoma / Mieloma)', it: 'Neoplasia ematologica (Leucemia / Linfoma / Mieloma)', ja: '血液悪性腫瘍（白血病/リンパ腫/骨髄腫）', ko: '혈액 악성종양 (백혈병 / 림프종 / 골수종)', ms: 'Keganasan Hematologi (Leukemia / Limfoma / Mieloma)', pt: 'Neoplasia Hematológica (Leucemia / Linfoma / Mieloma)', ru: 'Гематологические злокачественные опухоли (Лейкоз / Лимфома / Миелома)', sw: 'Saratani ya damu (Leukemia / Lymphoma / Myeloma)', sv: 'Hematologisk malignitet (Leukemi / Lymfom / Myelom)', tr: 'Hematolojik malignite (Lösemi / Lenfoma / Miyelom)', uk: 'Гематологічні злоякісні пухлини (Лейкоз / Лімфома / Мієлома)', ur: 'خون کی خرابی (لیوکیمیا / لمفوما / میلوما)', vi: 'Ác tính huyết học (Bạch cầu / U lympho / Đa u tủy)', tl: 'Haematological Malignancy (Leukaemia / Lymphoma / Myeloma)' },
    { en: 'Other Cancer', el: 'Άλλος καρκίνος', ar: 'سرطان آخر', es: 'Otro Cáncer', af: 'Ander kanker', sq: 'Kancer tjetër', bn: 'অন্যান্য ক্যান্সার', zh: '其他癌症', 'zh-TW': '其他癌症', hr: 'Drugi rak', da: 'Anden kræft', nl: 'Andere kanker', fi: 'Muu syöpä', fr: 'Autre cancer', de: 'Anderer Krebs', hi: 'अन्य कैंसर', id: 'Kanker Lainnya', it: 'Altro cancro', ja: 'その他のがん', ko: '기타 암', ms: 'Kanser Lain', pt: 'Outro Câncer', ru: 'Другой рак', sw: 'Saratani nyingine', sv: 'Annan cancer', tr: 'Diğer kanser', uk: 'Інший рак', ur: 'دیگر سرطان', vi: 'Ung thư khác', tl: 'Ibang Kanser' },
  ]},
  { en: 'Renal & Urology', el: 'Νεφρολογικά και ουρολογικά νοσήματα', ar: 'الكلى والمسالك البولية', es: 'Enfermedades Renales y Urológicas', af: 'Renale en Urologiese siektes', sq: 'Sëmundjet renale dhe urologjike', bn: 'কিডনি ও মূত্রতন্ত্রের রোগ', zh: '肾脏和泌尿系统疾病', 'zh-TW': '腎臟和泌尿系統疾病', hr: 'Bubrežne i urološke bolesti', da: 'Nyre- og urologiske sygdomme', nl: 'Nier- en urologische aandoeningen', fi: 'Munuais- ja urologiset sairaudet', fr: 'Maladies rénales et urologiques', de: 'Nieren- und urologische Erkrankungen', hi: 'गुर्दा और मूत्र रोग', id: 'Penyakit Ginjal dan Urologi', it: 'Malattie renali e urologiche', ja: '腎臓・泌尿器科疾患', ko: '신장 및 비뇨기과 질환', ms: 'Penyakit Buah Pinggang dan Urologi', pt: 'Doenças Renais e Urológicas', ru: 'Заболевания почек и мочевыводящих путей', sw: 'Magonjwa ya Figo na Mfumo wa Mkojo', sv: 'Njur- och urologiska sjukdomar', tr: 'Böbrek ve Üroloji Hastalıkları', uk: 'Захворювання нирок та сечовивідних шляхів', ur: 'گردوں اور پیشاب کی بیماریاں', vi: 'Bệnh thận và tiết niệu', tl: 'Sakit sa Bato at Urinary', items: [
    { en: 'Chronic Kidney Disease', el: 'Χρόνια νεφρική νόσος', ar: 'مرض الكلى المزمن', es: 'Enfermedad Renal Crónica', af: 'Chroniese niersiekte', sq: 'Sëmundja kronike e veshkave', bn: 'ক্রনিক কিডনি রোগ', zh: '慢性肾病', 'zh-TW': '慢性腎臟病', hr: 'Kronična bubrežna bolest', da: 'Kronisk nyresygdom', nl: 'Chronische nierziekte', fi: 'Krooninen munuaissairaus', fr: 'Insuffisance rénale chronique', de: 'Chronische Nierenerkrankung', hi: 'क्रोनिक किडनी रोग', id: 'Penyakit Ginjal Kronis', it: 'Malattia renale cronica', ja: '慢性腎臓病', ko: '만성 신장 질환', ms: 'Penyakit Buah Pinggang Kronik', pt: 'Doença Renal Crónica', ru: 'Хроническая болезнь почек', sw: 'Ugonjwa sugu wa figo', sv: 'Kronisk njursjukdom', tr: 'Kronik böbrek hastalığı', uk: 'Хронічна хвороба нирок', ur: 'دائمی گردوں کی بیماری', vi: 'Bệnh thận mạn tính', tl: 'Chronic Kidney Disease' },
    { en: 'End-Stage Renal Disease (Dialysis)', el: 'Τελικού σταδίου νεφρική ανεπάρκεια (Αιμοκάθαρση)', ar: 'الفشل الكلوي النهائي (الغسيل الكلوي)', es: 'Insuficiencia Renal Terminal (Diálisis)', af: 'Eindstadium niersiekte (Dialise)', sq: 'Sëmundja renale në fazën terminale (Dializa)', bn: 'শেষ পর্যায়ের কিডনি রোগ (ডায়ালাইসিস)', zh: '终末期肾病（透析）', 'zh-TW': '末期腎臟疾病（透析）', hr: 'Terminalna bubrežna bolest (Dijaliza)', da: 'Terminal nyresygdom (Dialyse)', nl: 'Terminale nierziekte (Dialyse)', fi: 'Loppuvaiheen munuaissairaus (Dialyysi)', fr: 'Insuffisance rénale terminale (Dialyse)', de: 'Terminale Niereninsuffizienz (Dialyse)', hi: 'अंत-चरण गुर्दे की बीमारी (डायलिसिस)', id: 'Penyakit Ginjal Stadium Akhir (Dialisis)', it: 'Nefropatia terminale (Dialisi)', ja: '末期腎不全（透析）', ko: '말기 신장 질환 (투석)', ms: 'Penyakit Buah Pinggang Peringkat Akhir (Dialisis)', pt: 'Doença Renal em Estágio Terminal (Diálise)', ru: 'Терминальная почечная недостаточность (Диализ)', sw: 'Kushindwa kwa figo hatua ya mwisho (Dialysis)', sv: 'Terminal njursvikt (Dialys)', tr: 'Son dönem böbrek hastalığı (Diyaliz)', uk: 'Термінальна ниркова недостатність (Діаліз)', ur: 'آخری مرحلے کی گردوں کی بیماری (ڈائیلسس)', vi: 'Bệnh thận giai đoạn cuối (Lọc thận)', tl: 'End-Stage Renal Disease (Dialysis)' },
    { en: 'Benign Prostatic Hyperplasia', el: 'Καλοήθης υπερπλασία προστάτη', ar: 'ضخامة البروستاتا الحميدة', es: 'Hiperplasia Prostática Benigna', af: 'Benigne prostaadhiperplasie', sq: 'Hiperplazia beninje e prostatës', bn: 'বেনিগন প্রোস্টেটিক হাইপারপ্লাজিয়া', zh: '良性前列腺增生', 'zh-TW': '良性攝護腺增生', hr: 'Benigna hiperplazija prostate', da: 'Benign prostatahyperplasi', nl: 'Goedaardige prostaatvergroting', fi: 'Hyvänlaatuinen eturauhasen liikakasvu', fr: 'Hyperplasie bénigne de la prostate', de: 'Benigne Prostatahyperplasie', hi: 'बेनिग्न प्रोस्टेटिक हाइपरप्लासिया', id: 'Hiperplasia Prostat Jinak', it: 'Ipertrofia prostatica benigna', ja: '前立腺肥大症', ko: '전립선 비대증', ms: 'Hiperplasia Prostat Benigna', pt: 'Hiperplasia Prostática Benigna', ru: 'Доброкачественная гиперплазия предстательной железы', sw: 'Ukuaji wa kawaida wa kibofu cha mkojo', sv: 'Benign prostatahyperplasi', tr: 'Benign prostat hiperplazisi', uk: 'Доброякісна гіперплазія передміхурової залози', ur: 'پروسٹیٹ کا بڑھنا', vi: 'Phì đại tuyến tiền liệt lành tính', tl: 'Benign Prostatic Hyperplasia' },
    { en: 'Urinary Tract Infections (Recurrent)', el: 'Ουρολοιμώξεις (υποτροπιάζουσες)', ar: 'التهابات المسالك البولية المتكررة', es: 'Infecciones del Tracto Urinario (Recurrentes)', af: 'Urienwegsinfeksies (Herhalend)', sq: 'Infeksionet e traktit urinar (Të përsëritura)', bn: 'মূত্রনালির সংক্রমণ (বারবার)', zh: '反复性尿路感染', 'zh-TW': '復發性泌尿道感染', hr: 'Infekcije mokraćnog trakta (Ponavljajuće)', da: 'Urinvejsinfektioner (Tilbagevendende)', nl: 'Urineweginfecties (Terugkerend)', fi: 'Virtsatietulehdukset (Toistuvat)', fr: 'Infections urinaires (Récidivantes)', de: 'Harnwegsinfektionen (Wiederkehrend)', hi: 'मूत्र पथ संक्रमण (बार-बार)', id: 'Infeksi Saluran Kemih (Berulang)', it: 'Infezioni del tratto urinario (Ricorrenti)', ja: '尿路感染症（反復性）', ko: '요로 감염 (재발성)', ms: 'Jangkitan Saluran Kencing (Berulang)', pt: 'Infecções do Trato Urinário (Recorrentes)', ru: 'Инфекции мочевыводящих путей (Рецидивирующие)', sw: 'Maambukizi ya njia ya mkojo (Yanayorudia)', sv: 'Urinvägsinfektioner (Återkommande)', tr: 'İdrar yolu enfeksiyonları (Tekrarlayan)', uk: 'Інфекції сечовивідних шляхів (Рецидивуючі)', ur: 'پیشاب کی نالی کی بار بار انفیکشن', vi: 'Nhiễm trùng đường tiết niệu (Tái phát)', tl: 'Urinary Tract Infections (Recurrent)' },
  ]},
  { en: 'Infectious Disease', el: 'Λοιμώδη νοσήματα', ar: 'الأمراض المعدية', es: 'Enfermedades Infecciosas', af: 'Aansteeklike siektes', sq: 'Sëmundjet infektive', bn: 'সংক্রামক রোগ', zh: '传染病', 'zh-TW': '傳染病', hr: 'Zarazne bolesti', da: 'Infektionssygdomme', nl: 'Infectieziekten', fi: 'Tartuntataudit', fr: 'Maladies infectieuses', de: 'Infektionskrankheiten', hi: 'संक्रामक रोग', id: 'Penyakit Menular', it: 'Malattie infettive', ja: '感染症', ko: '감염성 질환', ms: 'Penyakit Berjangkit', pt: 'Doenças Infecciosas', ru: 'Инфекционные болезни', sw: 'Magonjwa ya Kuambukiza', sv: 'Infektionssjukdomar', tr: 'Enfeksiyon Hastalıkları', uk: 'Інфекційні захворювання', ur: 'متعدی بیماریاں', vi: 'Bệnh truyền nhiễm', tl: 'Nakakahawang Sakit', items: [
    { en: 'HIV / AIDS', el: 'HIV / AIDS', ar: 'فيروس نقص المناعة البشري / الإيدز', es: 'VIH / SIDA', af: 'MIV / VIGS', sq: 'HIV / AIDS', bn: 'এইচআইভি / এইডস', zh: '艾滋病病毒 / 艾滋病', 'zh-TW': '愛滋病毒 / 愛滋病', hr: 'HIV / AIDS', da: 'HIV / AIDS', nl: 'HIV / AIDS', fi: 'HIV / AIDS', fr: 'VIH / SIDA', de: 'HIV / AIDS', hi: 'एचआईवी / एड्स', id: 'HIV / AIDS', it: 'HIV / AIDS', ja: 'HIV / AIDS', ko: 'HIV / AIDS', ms: 'HIV / AIDS', pt: 'HIV / SIDA', ru: 'ВИЧ / СПИД', sw: 'VVU / UKIMWI', sv: 'HIV / AIDS', tr: 'HIV / AIDS', uk: 'ВІЛ / СНІД', ur: 'ایچ آئی وی / ایڈز', vi: 'HIV / AIDS', tl: 'HIV / AIDS' },
    { en: 'Tuberculosis', el: 'Φυματίωση', ar: 'السل', es: 'Tuberculosis', af: 'Tuberkulose', sq: 'Tuberkulozi', bn: 'যক্ষ্মা', zh: '结核病', 'zh-TW': '肺結核', hr: 'Tuberkuloza', da: 'Tuberkulose', nl: 'Tuberculose', fi: 'Tuberkuloosi', fr: 'Tuberculose', de: 'Tuberkulose', hi: 'तपेदिक', id: 'Tuberkulosis', it: 'Tubercolosi', ja: '結核', ko: '결핵', ms: 'Tuberkulosis', pt: 'Tuberculose', ru: 'Туберкулёз', sw: 'Kifua kikuu', sv: 'Tuberkulos', tr: 'Tüberküloz', uk: 'Туберкульоз', ur: 'تپ دق', vi: 'Bệnh lao', tl: 'Tuberkulosis' },
    { en: 'Malaria', el: 'Ελονοσία', ar: 'الملاريا', es: 'Malaria', af: 'Malaria', sq: 'Malaria', bn: 'ম্যালেরিয়া', zh: '疟疾', 'zh-TW': '瘧疾', hr: 'Malarija', da: 'Malaria', nl: 'Malaria', fi: 'Malaria', fr: 'Paludisme', de: 'Malaria', hi: 'मलेरिया', id: 'Malaria', it: 'Malaria', ja: 'マラリア', ko: '말라리아', ms: 'Malaria', pt: 'Malária', ru: 'Малярия', sw: 'Malaria', sv: 'Malaria', tr: 'Sıtma', uk: 'Малярія', ur: 'ملیریا', vi: 'Sốt rét', tl: 'Malaria' },
    { en: 'Other Infectious Disease', el: 'Άλλο λοιμώδες νόσημα', ar: 'مرض معدٍ آخر', es: 'Otra Enfermedad Infecciosa', af: 'Ander aansteeklike siekte', sq: 'Sëmundje tjetër infektive', bn: 'অন্যান্য সংক্রামক রোগ', zh: '其他传染病', 'zh-TW': '其他傳染病', hr: 'Druga zarazna bolest', da: 'Anden infektionssygdom', nl: 'Andere infectieziekte', fi: 'Muu tartuntatauti', fr: 'Autre maladie infectieuse', de: 'Andere Infektionskrankheit', hi: 'अन्य संक्रामक रोग', id: 'Penyakit Menular Lainnya', it: 'Altra malattia infettiva', ja: 'その他の感染症', ko: '기타 감염성 질환', ms: 'Penyakit Berjangkit Lain', pt: 'Outra Doença Infecciosa', ru: 'Другие инфекционные болезни', sw: 'Ugonjwa mwingine wa kuambukiza', sv: 'Annan infektionssjukdom', tr: 'Diğer enfeksiyon hastalığı', uk: 'Інші інфекційні захворювання', ur: 'دیگر متعدی بیماریاں', vi: 'Bệnh truyền nhiễm khác', tl: 'Ibang Nakakahawang Sakit' },
  ]},
  { en: 'Haematology', el: 'Αιματολογικά νοσήματα', ar: 'أمراض الدم', es: 'Hematología', af: 'Hematologie', sq: 'Hematologjia', bn: 'হেমাটোলজি', zh: '血液科', 'zh-TW': '血液科', hr: 'Hematologija', da: 'Hæmatologi', nl: 'Hematologie', fi: 'Hematologia', fr: 'Hématologie', de: 'Hämatologie', hi: 'रुधिर विज्ञान', id: 'Hematologi', it: 'Ematologia', ja: '血液科', ko: '혈액학', ms: 'Hematologi', pt: 'Hematologia', ru: 'Гематология', sw: 'Damu na Magonjwa yake', sv: 'Hematologi', tr: 'Hematoloji', uk: 'Гематологія', ur: 'ہیماٹولوجی', vi: 'Huyết học', tl: 'Hematology', items: [
    { en: 'Anaemia (Iron Deficiency)', el: 'Αναιμία (σιδηροπενική)', ar: 'فقر الدم (نقص الحديد)', es: 'Anemia (por Deficiencia de Hierro)', af: 'Anemie (ystergebrek)', sq: 'Anemia (mungesa e hekurit)', bn: 'রক্তস্বল্পতা (আয়রনের অভাব)', zh: '贫血（缺铁性）', 'zh-TW': '貧血（缺鐵性）', hr: 'Anemija (nedostatak željeza)', da: 'Anæmi (jernmangel)', nl: 'Anemie (ijzertekort)', fi: 'Anemia (raudanpuute)', fr: 'Anémie (carence en fer)', de: 'Anämie (Eisenmangel)', hi: 'अनीमिया (आयरन की कमी)', id: 'Anemia (Kekurangan Zat Besi)', it: 'Anemia (carenza di ferro)', ja: '貧血（鉄欠乏性）', ko: '빈혈 (철 결핍)', ms: 'Anemia (Kekurangan Zat Besi)', pt: 'Anemia (Deficiência de Ferro)', ru: 'Анемия (железодефицитная)', sw: 'Upungufu wa damu (ukosefu wa chuma)', sv: 'Anemi (järnbrist)', tr: 'Anemi (demir eksikliği)', uk: 'Анемія (залізодефіцитна)', ur: 'خون کی کمی (آئرن کی کمی)', vi: 'Thiếu máu (thiếu sắt)', tl: 'Anemia (Iron Deficiency)' },
    { en: 'Sickle Cell Disease', el: 'Δρεπανοκυτταρική νόσος', ar: 'مرض فقر الدم المنجلي', es: 'Enfermedad de Células Falciformes', af: 'Sekelselsiekte', sq: 'Sëmundja e qelizave sickle', bn: 'সিকেল সেল ডিজিজ', zh: '镰状细胞病', 'zh-TW': '鐮刀型細胞疾病', hr: 'Bolest srpastih stanica', da: 'Seglcelleanæmi', nl: 'Sikkelcelziekte', fi: 'Sirppisoluanemia', fr: 'Drépanocytose', de: 'Sichelzellanämie', hi: 'सिकल सेल रोग', id: 'Penyakit Sel Sabit', it: 'Anemia falciforme', ja: '鎌状赤血球症', ko: '겸상 적혈구 질환', ms: 'Penyakit Sel Sabit', pt: 'Doença Falciforme', ru: 'Серповидно-клеточная болезнь', sw: 'Ugonjwa wa seli za mundu', sv: 'Sickelcellanemi', tr: 'Orak hücre hastalığı', uk: 'Серповидно-клітинна хвороба', ur: 'سکل سیل بیماری', vi: 'Bệnh hồng cầu hình liềm', tl: 'Sickle Cell Disease' },
    { en: 'Thalassaemia', el: 'Θαλασσαιμία', ar: 'الثلاسيميا', es: 'Talasemia', af: 'Talassemie', sq: 'Talasemia', bn: 'থ্যালাসেমিয়া', zh: '地中海贫血', 'zh-TW': '地中海型貧血', hr: 'Talasemija', da: 'Thalassæmi', nl: 'Thalassemie', fi: 'Talassemia', fr: 'Thalassémie', de: 'Thalassämie', hi: 'थैलेसीमिया', id: 'Talasemia', it: 'Talassemia', ja: 'サラセミア', ko: '지중해 빈혈', ms: 'Talasemia', pt: 'Talassemia', ru: 'Талассемия', sw: 'Talasemia', sv: 'Talassemi', tr: 'Talasemi', uk: 'Таласемія', ur: 'تھیلیسیمیا', vi: 'Thalassemia', tl: 'Thalassemia' },
    { en: 'Haemophilia', el: 'Αιμορροφιλία', ar: 'الهيموفيليا', es: 'Hemofilia', af: 'Hemofilie', sq: 'Hemofilia', bn: 'হিমোফিলিয়া', zh: '血友病', 'zh-TW': '血友病', hr: 'Hemofilija', da: 'Hæmofili', nl: 'Hemofilie', fi: 'Hemofilia', fr: 'Hémophilie', de: 'Hämophilie', hi: 'हीमोफीलिया', id: 'Hemofilia', it: 'Emofilia', ja: '血友病', ko: '혈우병', ms: 'Hemofilia', pt: 'Hemofilia', ru: 'Гемофилия', sw: 'Hemofilia', sv: 'Hemofili', tr: 'Hemofili', uk: 'Гемофілія', ur: 'ہیموفیلیا', vi: 'Bệnh máu khó đông', tl: 'Hemophilia' },
    { en: 'Anticoagulation Therapy', el: 'Αντιπηκτική αγωγή', ar: 'العلاج بمضادات التخثر', es: 'Terapia Anticoagulante', af: 'Antikoagulasieterapie', sq: 'Terapia antikoaguluese', bn: 'অ্যান্টিকোয়াগুলেশন থেরাপি', zh: '抗凝治疗', 'zh-TW': '抗凝治療', hr: 'Antikoagulacijska terapija', da: 'Antikoagulationsbehandling', nl: 'Antistollingstherapie', fi: 'Antikoagulanttihoito', fr: 'Traitement anticoagulant', de: 'Antikoagulationstherapie', hi: 'एंटीकोएगुलेशन थेरेपी', id: 'Terapi Antikoagulasi', it: 'Terapia anticoagulante', ja: '抗凝固療法', ko: '항응고 요법', ms: 'Terapi Antikoagulasi', pt: 'Terapia Anticoagulante', ru: 'Антикоагулянтная терапия', sw: 'Tiba ya kuzuia kuganda kwa damu', sv: 'Antikoagulationsbehandling', tr: 'Antikoagülan tedavi', uk: 'Антикоагулянтна терапія', ur: 'خون پتلا کرنے کی تھراپی', vi: 'Liệu pháp chống đông máu', tl: 'Anticoagulation Therapy' },
  ]},
  { en: 'Dermatology', el: 'Δερματολογικά νοσήματα', ar: 'الأمراض الجلدية', es: 'Dermatología', af: 'Dermatologie', sq: 'Dermatologjia', bn: 'চর্মরোগ', zh: '皮肤科', 'zh-TW': '皮膚科', hr: 'Dermatologija', da: 'Dermatologi', nl: 'Dermatologie', fi: 'Ihotaudit', fr: 'Dermatologie', de: 'Dermatologie', hi: 'त्वचा रोग', id: 'Dermatologi', it: 'Dermatologia', ja: '皮膚科', ko: '피부과', ms: 'Dermatologi', pt: 'Dermatologia', ru: 'Дерматология', sw: 'Magonjwa ya Ngozi', sv: 'Dermatologi', tr: 'Dermatoloji', uk: 'Дерматологія', ur: 'جلد کی بیماریاں', vi: 'Da liễu', tl: 'Dermatolohiya', items: [
    { en: 'Psoriasis', el: 'Ψωρίαση', ar: 'الصدفية', es: 'Psoriasis', af: 'Psoriasis', sq: 'Psoriaza', bn: 'সোরিয়াসিস', zh: '银屑病', 'zh-TW': '乾癬', hr: 'Psorijaza', da: 'Psoriasis', nl: 'Psoriasis', fi: 'Psoriasis', fr: 'Psoriasis', de: 'Psoriasis', hi: 'सोरायसिस', id: 'Psoriasis', it: 'Psoriasi', ja: '乾癬', ko: '건선', ms: 'Psoriasis', pt: 'Psoríase', ru: 'Псориаз', sw: 'Ugonjwa wa ngozi wa psoriasis', sv: 'Psoriasis', tr: 'Psoriazis', uk: 'Псоріаз', ur: 'چنبل', vi: 'Vẩy nến', tl: 'Psoriasis' },
    { en: 'Eczema / Atopic Dermatitis', el: 'Έκζεμα / Ατοπική δερματίτιδα', ar: 'الإكزيما / التهاب الجلد التأتبي', es: 'Eczema / Dermatitis Atópica', af: 'Ekseem / Atopiese dermatitis', sq: 'Ekzema / Dermatiti atopik', bn: 'একজিমা / অ্যাটোপিক ডার্মাটাইটিস', zh: '湿疹 / 特应性皮炎', 'zh-TW': '濕疹 / 異位性皮膚炎', hr: 'Ekcem / Atopijski dermatitis', da: 'Eksem / Atopisk dermatitis', nl: 'Eczeem / Atopische dermatitis', fi: 'Eksema / Atooppinen ihottuma', fr: 'Eczéma / Dermatite atopique', de: 'Ekzem / Atopische Dermatitis', hi: 'एक्जिमा / एटोपिक डर्मेटाइटिस', id: 'Eksim / Dermatitis Atopik', it: 'Eczema / Dermatite atopica', ja: '湿疹 / アトピー性皮膚炎', ko: '습진 / 아토피 피부염', ms: 'Ekzema / Dermatitis Atopik', pt: 'Eczema / Dermatite Atópica', ru: 'Экзема / Атопический дерматит', sw: 'Ugonjwa wa ngozi wa eczema', sv: 'Eksem / Atopisk dermatit', tr: 'Egzama / Atopik dermatit', uk: 'Екзема / Атопічний дерматит', ur: 'ایکزیما / ایٹوپک ڈرمیٹائٹس', vi: 'Chàm / Viêm da dị ứng', tl: 'Eczema / Atopic Dermatitis' },
    { en: 'Acne', el: 'Ακμή', ar: 'حب الشباب', es: 'Acné', af: 'Akne', sq: 'Aknet', bn: 'ব্রণ', zh: '痤疮', 'zh-TW': '痤瘡', hr: 'Akne', da: 'Akne', nl: 'Acne', fi: 'Akne', fr: 'Acné', de: 'Akne', hi: 'मुँहासे', id: 'Jerawat', it: 'Acne', ja: 'ニキビ', ko: '여드름', ms: 'Jerawat', pt: 'Acne', ru: 'Акне', sw: 'Chunusi', sv: 'Akne', tr: 'Akne', uk: 'Акне', ur: 'کیل مہاسے', vi: 'Mụn trứng cá', tl: 'Acne' },
    { en: 'Rosacea', el: 'Ροδόχρους νόσος', ar: 'الوردية الجلدية', es: 'Rosácea', af: 'Rosacea', sq: 'Rozacea', bn: 'রোসেসিয়া', zh: '玫瑰痤疮', 'zh-TW': '酒糟鼻', hr: 'Rozacea', da: 'Rosacea', nl: 'Rosacea', fi: 'Rosacea', fr: 'Rosacée', de: 'Rosazea', hi: 'रोसेसिया', id: 'Rosacea', it: 'Rosacea', ja: '酒さ', ko: '주사비', ms: 'Rosacea', pt: 'Rosácea', ru: 'Розацеа', sw: 'Rosacea', sv: 'Rosacea', tr: 'Rozase', uk: 'Розацеа', ur: 'روزیشیا', vi: 'Mụn đỏ mặt', tl: 'Rosacea' },
  ]},
  { en: 'Ophthalmology', el: 'Οφθαλμολογικά νοσήματα', ar: 'طب العيون', es: 'Oftalmología', af: 'Oftalmologie', sq: 'Oftalmologjia', bn: 'চক্ষুবিজ্ঞান', zh: '眼科', 'zh-TW': '眼科', hr: 'Oftalmologija', da: 'Oftalmologi', nl: 'Oogheelkunde', fi: 'Silmätaudit', fr: 'Ophtalmologie', de: 'Augenheilkunde', hi: 'नेत्र विज्ञान', id: 'Oftalmologi', it: 'Oftalmologia', ja: '眼科', ko: '안과', ms: 'Oftalmologi', pt: 'Oftalmologia', ru: 'Офтальмология', sw: 'Magonjwa ya Macho', sv: 'Oftalmologi', tr: 'Göz hastalıkları', uk: 'Офтальмологія', ur: 'آنکھ کی بیماریاں', vi: 'Nhãn khoa', tl: 'Ophthalmology', items: [
    { en: 'Glaucoma', el: 'Γλαύκωμα', ar: 'الجلوكوما', es: 'Glaucoma', af: 'Gloukoom', sq: 'Glaukoma', bn: 'গ্লুকোমা', zh: '青光眼', 'zh-TW': '青光眼', hr: 'Glaukom', da: 'Glaukom', nl: 'Glaucoom', fi: 'Glaukooma', fr: 'Glaucome', de: 'Glaukom', hi: 'ग्लूकोमा', id: 'Glaukoma', it: 'Glaucoma', ja: '緑内障', ko: '녹내장', ms: 'Glaukoma', pt: 'Glaucoma', ru: 'Глаукома', sw: 'Ugonjwa wa jicho la glaukoma', sv: 'Glaukom', tr: 'Glokom', uk: 'Глаукома', ur: 'گلوکوما', vi: 'Glaucoma', tl: 'Glaucoma' },
    { en: 'Age-Related Macular Degeneration', el: 'Εκφύλιση ωχράς κηλίδας', ar: 'الضمور البقعي المرتبط بالعمر', es: 'Degeneración Macular Asociada a la Edad', af: 'Ouderdomsverwante makula-degenerasie', sq: 'Degjenerimi makular i lidhur me moshën', bn: 'বয়স-সংক্রান্ত ম্যাকুলার ডিজেনারেশন', zh: '年龄相关性黄斑变性', 'zh-TW': '老年性黃斑部病變', hr: 'Senilna makularna degeneracija', da: 'Aldersrelateret makuladegeneration', nl: 'Leeftijdsgerelateerde maculadegeneratie', fi: 'Ikääntymiseen liittyvä silmänpohjan rappeuma', fr: "Dégénérescence maculaire liée à l'âge", de: 'Altersbedingte Makuladegeneration', hi: 'उम्र से संबंधित मैक्युलर डिजनरेशन', id: 'Degenerasi Makula Terkait Usia', it: "Degenerazione maculare correlata all'età", ja: '加齢黄斑変性', ko: '노인성 황반변성', ms: 'Degenerasi Makula Berkaitan Usia', pt: 'Degeneração Macular Relacionada à Idade', ru: 'Возрастная макулярная дегенерация', sw: 'Ugonjwa wa jicho unaohusiana na umri', sv: 'Åldersrelaterad makuladegeneration', tr: 'Yaşa bağlı maküler dejenerasyon', uk: 'Вікова макулярна дегенерація', ur: 'عمر سے متعلق میکولر ڈیجنریشن', vi: 'Thoái hóa điểm vàng liên quan tuổi', tl: 'Age-Related Macular Degeneration' },
    { en: 'Diabetic Retinopathy', el: 'Διαβητική αμφιβληστροειδοπάθεια', ar: 'اعتلال الشبكية السكري', es: 'Retinopatía Diabética', af: 'Diabetiese retinopatia', sq: 'Retinopatia diabetike', bn: 'ডায়াবেটিক রেটিনোপ্যাথি', zh: '糖尿病视网膜病变', 'zh-TW': '糖尿病視網膜病變', hr: 'Dijabetička retinopatija', da: 'Diabetisk retinopati', nl: 'Diabetische retinopathie', fi: 'Diabeettinen retinopatia', fr: 'Rétinopathie diabétique', de: 'Diabetische Retinopathie', hi: 'मधुमेह संबंधी रेटिनोपैथी', id: 'Retinopati Diabetik', it: 'Retinopatia diabetica', ja: '糖尿病性網膜症', ko: '당뇨병성 망막증', ms: 'Retinopati Diabetik', pt: 'Retinopatia Diabética', ru: 'Диабетическая ретинопатия', sw: 'Ugonjwa wa jicho kutokana na kisukari', sv: 'Diabetisk retinopati', tr: 'Diyabetik retinopati', uk: 'Діабетична ретинопатія', ur: 'ذیابیطس کی وجہ سے آنکھ کی بیماری', vi: 'Bệnh võng mạc do tiểu đường', tl: 'Diabetic Retinopathy' },
  ]},
  { en: "Women's Health", el: 'Γυναικολογική και αναπαραγωγική υγεία', ar: 'صحة المرأة', es: 'Salud de la Mujer', af: "Vrouesgesondheid", sq: "Shëndeti i gruas", bn: 'মহিলাদের স্বাস্থ্য', zh: "女性健康", 'zh-TW': "女性健康", hr: "Zdravlje žena", da: "Kvindesundhed", nl: "Vrouwengezondheid", fi: "Naisten terveys", fr: "Santé des femmes", de: "Frauengesundheit", hi: 'महिला स्वास्थ्य', id: "Kesehatan Wanita", it: "Salute della donna", ja: '女性の健康', ko: '여성 건강', ms: "Kesihatan Wanita", pt: "Saúde da Mulher", ru: 'Женское здоровье', sw: "Afya ya Wanawake", sv: "Kvinnohälsa", tr: "Kadın sağlığı", uk: "Жіноче здоров'я", ur: "خواتین کی صحت", vi: "Sức khỏe phụ nữ", tl: "Kalusugan ng Kababaihan", items: [
    { en: 'Contraception', el: 'Αντισύλληψη', ar: 'منع الحمل', es: 'Anticoncepción', af: 'Voorbehoeding', sq: 'Kontraceptivët', bn: 'গর্ভনিরোধ', zh: '避孕', 'zh-TW': '避孕', hr: 'Kontracepcija', da: 'Prævention', nl: 'Anticonceptie', fi: 'Ehkäisy', fr: 'Contraception', de: 'Verhütung', hi: 'गर्भनिरोधक', id: 'Kontrasepsi', it: 'Contraccezione', ja: '避妊', ko: '피임', ms: 'Kontrasepsi', pt: 'Contracepção', ru: 'Контрацепция', sw: 'Uzuiaji wa mimba', sv: 'Preventivmedel', tr: 'Doğum kontrolü', uk: 'Контрацепція', ur: 'ضبط ولادت', vi: 'Tránh thai', tl: 'Kontrasepsyon' },
    { en: 'Endometriosis', el: 'Ενδομητρίωση', ar: 'بطانة الرحم المهاجرة', es: 'Endometriosis', af: 'Endometriose', sq: 'Endometrioza', bn: 'এন্ডোমেট্রিওসিস', zh: '子宫内膜异位症', 'zh-TW': '子宮內膜異位症', hr: 'Endometrioza', da: 'Endometriose', nl: 'Endometriose', fi: 'Endometrioosi', fr: 'Endométriose', de: 'Endometriose', hi: 'एंडोमेट्रियोसिस', id: 'Endometriosis', it: 'Endometriosi', ja: '子宮内膜症', ko: '자궁내막증', ms: 'Endometriosis', pt: 'Endometriose', ru: 'Эндометриоз', sw: 'Endometriosi', sv: 'Endometrios', tr: 'Endometriozis', uk: 'Ендометріоз', ur: 'اینڈومیٹریوسس', vi: 'Lạc nội mạc tử cung', tl: 'Endometriosis' },
    { en: 'Polycystic Ovary Syndrome (PCOS)', el: 'Σύνδρομο πολυκυστικών ωοθηκών', ar: 'متلازمة تكيس المبايض', es: 'Síndrome de Ovario Poliquístico (SOP)', af: 'Polikistiese ovariumsindroom (PCOS)', sq: 'Sindroma e vezores policistike (PCOS)', bn: 'পলিসিস্টিক ওভারি সিনড্রোম (PCOS)', zh: '多囊卵巢综合征', 'zh-TW': '多囊性卵巢症候群', hr: 'Sindrom policističnih jajnika (PCOS)', da: 'Polycystisk ovariesyndrom (PCOS)', nl: 'Polycysteus ovariumsyndroom (PCOS)', fi: 'Munasarjojen monirakkulatauti (PCOS)', fr: 'Syndrome des ovaires polykystiques (SOPK)', de: 'Polyzystisches Ovarialsyndrom (PCOS)', hi: 'पॉलीसिस्टिक ओवरी सिंड्रोम (पीसीओएस)', id: 'Sindrom Ovarium Polikistik (PCOS)', it: "Sindrome dell'ovaio policistico (PCOS)", ja: '多嚢胞性卵巣症候群（PCOS）', ko: '다낭성 난소 증후군 (PCOS)', ms: 'Sindrom Ovari Polikistik (PCOS)', pt: 'Síndrome dos Ovários Policísticos (SOP)', ru: 'Синдром поликистозных яичников (СПКЯ)', sw: 'Ugonjwa wa visiwa vya mayai (PCOS)', sv: 'Polycystiskt ovarialsyndrom (PCOS)', tr: 'Polikistik over sendromu (PKOS)', uk: 'Синдром полікістозних яєчників (СПКЯ)', ur: 'پولی سسٹک اووری سنڈروم (PCOS)', vi: 'Hội chứng buồng trứng đa nang (PCOS)', tl: 'Polycystic Ovary Syndrome (PCOS)' },
    { en: 'Menopause / HRT', el: 'Εμμηνόπαυση / Ορμονική θεραπεία υποκατάστασης', ar: 'انقطاع الطمث / العلاج الهرموني التعويضي', es: 'Menopausia / Terapia Hormonal Sustitutiva', af: 'Menopouse / HRT', sq: 'Menopauzë / THA', bn: 'মেনোপজ / এইচআরটি', zh: '绝经 / 激素替代疗法', 'zh-TW': '更年期 / 荷爾蒙替代療法', hr: 'Menopauza / HNL', da: 'Overgangsalder / HRT', nl: 'Menopauze / HRT', fi: 'Vaihdevuodet / HRT', fr: 'Ménopause / THS', de: 'Wechseljahre / HRT', hi: 'रजोनिवृत्ति / एचआरटी', id: 'Menopause / HRT', it: 'Menopausa / TOS', ja: '更年期 / ホルモン補充療法', ko: '폐경 / 호르몬 대체 요법', ms: 'Menopaus / HRT', pt: 'Menopausa / TRH', ru: 'Менопауза / ЗГТ', sw: 'Kukoma hedhi / Tiba ya homoni', sv: 'Klimakteriet / HRT', tr: 'Menopoz / HRT', uk: 'Менопауза / ЗГТ', ur: 'رجونورتی / ہارمون تھراپی', vi: 'Mãn kinh / Liệu pháp hormone', tl: 'Menopause / HRT' },
    { en: 'Pregnancy-Related Condition', el: 'Καταστάσεις σχετιζόμενες με την εγκυμοσύνη', ar: 'حالة مرتبطة بالحمل', es: 'Afección Relacionada con el Embarazo', af: 'Swangerskapsverbandhoudende toestand', sq: 'Gjendje e lidhur me shtatzëninë', bn: 'গর্ভাবস্থা সম্পর্কিত অবস্থা', zh: '妊娠相关疾病', 'zh-TW': '妊娠相關疾病', hr: 'Stanje povezano s trudnoćom', da: 'Graviditetsrelateret tilstand', nl: 'Zwangerschapsgerelateerde aandoening', fi: 'Raskauteen liittyvä tila', fr: 'Affection liée à la grossesse', de: 'Schwangerschaftsbedingte Erkrankung', hi: 'गर्भावस्था से संबंधित स्थिति', id: 'Kondisi Terkait Kehamilan', it: 'Condizione correlata alla gravidanza', ja: '妊娠関連疾患', ko: '임신 관련 상태', ms: 'Keadaan Berkaitan Kehamilan', pt: 'Condição Relacionada à Gravidez', ru: 'Заболевание, связанное с беременностью', sw: 'Hali inayohusiana na ujauzito', sv: 'Graviditetsrelaterat tillstånd', tr: 'Gebelikle ilişkili durum', uk: "Стан, пов'язаний з вагітністю", ur: 'حمل سے متعلق حالت', vi: 'Tình trạng liên quan đến thai kỳ', tl: 'Pregnancy-Related Condition' },
  ]},
  { en: 'Other', el: 'Άλλα νοσήματα', ar: 'أخرى', es: 'Otras', af: 'Ander', sq: 'Të tjera', bn: 'অন্যান্য', zh: '其他', 'zh-TW': '其他', hr: 'Ostalo', da: 'Andet', nl: 'Overige', fi: 'Muut', fr: 'Autres', de: 'Sonstiges', hi: 'अन्य', id: 'Lainnya', it: 'Altro', ja: 'その他', ko: '기타', ms: 'Lain-lain', pt: 'Outros', ru: 'Другое', sw: 'Nyingine', sv: 'Övrigt', tr: 'Diğer', uk: 'Інше', ur: 'دیگر', vi: 'Khác', tl: 'Iba pa', items: [
    { en: 'Other', el: 'Άλλο (διευκρινίστε παρακάτω)', ar: 'أخرى', es: 'Otro', af: 'Ander (spesifiseer hieronder)', sq: 'Tjetër (specifikoni më poshtë)', bn: 'অন্যান্য (নিচে উল্লেখ করুন)', zh: '其他（请在下方说明）', 'zh-TW': '其他（請在下方說明）', hr: 'Ostalo (navedite u nastavku)', da: 'Andet (angiv nedenfor)', nl: 'Anders (specificeer hieronder)', fi: 'Muu (täsmennä alla)', fr: 'Autre (précisez ci-dessous)', de: 'Sonstiges (bitte unten angeben)', hi: 'अन्य (नीचे निर्दिष्ट करें)', id: 'Lainnya (sebutkan di bawah)', it: 'Altro (specificare di seguito)', ja: 'その他（以下に記入）', ko: '기타 (아래에 명시)', ms: 'Lain-lain (nyatakan di bawah)', pt: 'Outro (especifique abaixo)', ru: 'Другое (укажите ниже)', sw: 'Nyingine (taja hapa chini)', sv: 'Övrigt (ange nedan)', tr: 'Diğer (aşağıda belirtin)', uk: 'Інше (вкажіть нижче)', ur: 'دیگر (نیچے بتائیں)', vi: 'Khác (ghi rõ bên dưới)', tl: 'Iba pa (tukuyin sa ibaba)', isOther: true },
  ]},
];

/**
 * Rebuilds the `#sdoh-condition` multi-select dropdown from `_CONDITION_GROUPS`.
 * Renders English labels by default; switches to Greek when `mmasCurrentLang === 'el'`.
 * Preserves previously selected options across rebuilds.
 * @returns {void}
 */
function rebuildConditionDropdown() {
  const sel   = document.getElementById('sdoh-condition');
  const label = document.getElementById('sdoh-condition-label');
  const note  = document.getElementById('sdoh-condition-note');
  const other = document.getElementById('sdoh-condition-other');
  if (!sel) return;
  const _COND_LANGS = ['ar','es','el','af','sq','bn','zh','zh-TW','hr','da','nl','fi','fr','de','hi','id','it','ja','ko','ms','pt','ru','sw','sv','tr','uk','ur','vi','tl'];
  const _cl = (typeof mmasCurrentLang !== 'undefined' && _COND_LANGS.includes(mmasCurrentLang)) ? mmasCurrentLang : 'en';
  const _condUI = {
    ar: { label: 'الحالة الطبية التي يتم علاجها <span class="sdoh-optional">اختياري</span>', note: 'اضغط Ctrl / Cmd لاختيار أكثر من خيار. تظهر اختياراتك أدناه.', placeholder: '— اختر الحالة —', other: 'يرجى تحديد الحالة' },
    es: { label: 'Condición Médica en Tratamiento <span class="sdoh-optional">opcional</span>', note: 'Mantenga Ctrl / Cmd para seleccionar varias. Sus selecciones aparecen abajo.', placeholder: '— Seleccionar condición —', other: 'Por favor especifique la condición' },
    el: { label: 'Ιατρική Κατάσταση που Αντιμετωπίζεται <span class="sdoh-optional">προαιρετικό</span>', note: 'Κρατήστε Ctrl / Cmd για πολλαπλές επιλογές. Οι επιλογές σας εμφανίζονται παρακάτω.', placeholder: '— Επιλέξτε κατάσταση —', other: 'Παρακαλώ διευκρινίστε την κατάσταση' },
    en: { label: 'Medical Condition Being Treated <span class="sdoh-optional">optional</span>', note: 'Hold Ctrl / Cmd to select multiple. Your selections appear below.', placeholder: '— Select condition —', other: 'Please specify condition' },
    af: { label: 'Mediese Toestand Wat Behandel Word <span class="sdoh-optional">opsioneel</span>', note: 'Hou Ctrl / Cmd ingedruk om veelvuldige keuses te maak. U keuses verskyn hieronder.', placeholder: '— Kies toestand —', other: 'Spesifiseer asseblief die toestand' },
    sq: { label: 'Gjendja Mjekësore që Trajtohet <span class="sdoh-optional">opsionale</span>', note: 'Mbani Ctrl / Cmd për zgjedhje të shumta. Zgjedhjet tuaja shfaqen më poshtë.', placeholder: '— Zgjidhni gjendjen —', other: 'Ju lutemi specifikoni gjendjen' },
    bn: { label: 'চিকিৎসাধীন রোগ <span class="sdoh-optional">ঐচ্ছিক</span>', note: 'একাধিক নির্বাচনের জন্য Ctrl / Cmd চেপে ধরুন। আপনার নির্বাচনগুলি নীচে দেখাবে।', placeholder: '— রোগ নির্বাচন করুন —', other: 'অনুগ্রহ করে রোগটি নির্দিষ্ট করুন' },
    zh: { label: '正在治疗的疾病 <span class="sdoh-optional">可选</span>', note: '按住 Ctrl / Cmd 可进行多项选择。您的选择将显示在下方。', placeholder: '— 选择疾病 —', other: '请指定疾病' },
    'zh-TW': { label: '正在治療的疾病 <span class="sdoh-optional">選填</span>', note: '按住 Ctrl / Cmd 可進行多項選擇。您的選擇將顯示在下方。', placeholder: '— 選擇疾病 —', other: '請指定疾病' },
    hr: { label: 'Medicinsko Stanje koje se Liječi <span class="sdoh-optional">neobavezno</span>', note: 'Držite Ctrl / Cmd za višestruki odabir. Vaši odabiri prikazuju se ispod.', placeholder: '— Odaberite stanje —', other: 'Molimo navedite stanje' },
    da: { label: 'Medicinsk Tilstand Under Behandling <span class="sdoh-optional">valgfri</span>', note: 'Hold Ctrl / Cmd for at vælge flere. Dine valg vises nedenfor.', placeholder: '— Vælg tilstand —', other: 'Angiv venligst tilstanden' },
    nl: { label: 'Medische Aandoening in Behandeling <span class="sdoh-optional">optioneel</span>', note: 'Houd Ctrl / Cmd ingedrukt voor meerdere selecties. Uw selecties verschijnen hieronder.', placeholder: '— Selecteer aandoening —', other: 'Specificeer de aandoening' },
    fi: { label: 'Hoidettava Lääketieteellinen Tila <span class="sdoh-optional">valinnainen</span>', note: 'Pidä Ctrl / Cmd painettuna useita valintoja varten. Valintasi näkyvät alla.', placeholder: '— Valitse tila —', other: 'Ilmoita tila' },
    fr: { label: "Affection Médicale en Cours de Traitement <span class=\"sdoh-optional\">facultatif</span>", note: 'Maintenez Ctrl / Cmd pour sélectionner plusieurs. Vos sélections apparaissent ci-dessous.', placeholder: '— Sélectionner une affection —', other: "Veuillez préciser l'affection" },
    de: { label: 'Behandelte Erkrankung <span class="sdoh-optional">optional</span>', note: 'Strg / Cmd gedrückt halten für Mehrfachauswahl. Ihre Auswahl erscheint unten.', placeholder: '— Erkrankung auswählen —', other: 'Bitte Erkrankung angeben' },
    hi: { label: 'उपचाराधीन चिकित्सा स्थिति <span class="sdoh-optional">वैकल्पिक</span>', note: 'एकाधिक चयन के लिए Ctrl / Cmd दबाए रखें। आपके चयन नीचे दिखाई देंगे।', placeholder: '— स्थिति चुनें —', other: 'कृपया स्थिति निर्दिष्ट करें' },
    id: { label: 'Kondisi Medis yang Sedang Ditangani <span class="sdoh-optional">opsional</span>', note: 'Tahan Ctrl / Cmd untuk memilih beberapa. Pilihan Anda muncul di bawah.', placeholder: '— Pilih kondisi —', other: 'Harap tentukan kondisinya' },
    it: { label: 'Condizione Medica in Trattamento <span class="sdoh-optional">facoltativo</span>', note: 'Tenere premuto Ctrl / Cmd per selezioni multiple. Le selezioni appaiono di seguito.', placeholder: '— Seleziona condizione —', other: 'Specificare la condizione' },
    ja: { label: '治療中の病状 <span class="sdoh-optional">任意</span>', note: '複数選択するには Ctrl / Cmd を押し続けてください。選択内容は以下に表示されます。', placeholder: '— 病状を選択 —', other: '病状を入力してください' },
    ko: { label: '치료 중인 의학적 상태 <span class="sdoh-optional">선택사항</span>', note: '여러 항목을 선택하려면 Ctrl / Cmd를 누르고 있으세요. 선택 항목이 아래에 표시됩니다.', placeholder: '— 상태 선택 —', other: '상태를 지정해 주세요' },
    ms: { label: 'Keadaan Perubatan yang Sedang Dirawat <span class="sdoh-optional">pilihan</span>', note: 'Tahan Ctrl / Cmd untuk memilih berbilang. Pilihan anda muncul di bawah.', placeholder: '— Pilih keadaan —', other: 'Sila nyatakan keadaan' },
    pt: { label: 'Condição Médica em Tratamento <span class="sdoh-optional">opcional</span>', note: 'Segure Ctrl / Cmd para selecionar vários. Suas seleções aparecem abaixo.', placeholder: '— Selecionar condição —', other: 'Por favor especifique a condição' },
    ru: { label: 'Лечащееся Заболевание <span class="sdoh-optional">необязательно</span>', note: 'Удерживайте Ctrl / Cmd для выбора нескольких. Ваш выбор отображается ниже.', placeholder: '— Выберите состояние —', other: 'Укажите состояние' },
    sw: { label: 'Hali ya Kimatibabu Inayotibiwa <span class="sdoh-optional">si lazima</span>', note: 'Shika Ctrl / Cmd kuchagua zaidi ya moja. Chaguzi lako linaonekana hapa chini.', placeholder: '— Chagua hali —', other: 'Tafadhali bainisha hali' },
    sv: { label: 'Medicinskt Tillstånd under Behandling <span class="sdoh-optional">valfritt</span>', note: 'Håll Ctrl / Cmd för flera val. Dina val visas nedan.', placeholder: '— Välj tillstånd —', other: 'Ange tillståndet' },
    tr: { label: 'Tedavi Edilen Tıbbi Durum <span class="sdoh-optional">isteğe bağlı</span>', note: 'Birden fazla seçim için Ctrl / Cmd tuşunu basılı tutun. Seçimleriniz aşağıda görünür.', placeholder: '— Durum seçin —', other: 'Lütfen durumu belirtin' },
    uk: { label: "Медичний Стан, що Лікується <span class=\"sdoh-optional\">необов'язково</span>", note: 'Утримуйте Ctrl / Cmd для кількох вибраних. Ваш вибір відображається нижче.', placeholder: '— Виберіть стан —', other: 'Будь ласка, вкажіть стан' },
    ur: { label: 'علاج کی جانے والی طبی حالت <span class="sdoh-optional">اختیاری</span>', note: 'متعدد انتخاب کے لیے Ctrl / Cmd دبائے رکھیں۔ آپ کے انتخابات نیچے دکھائی دیتے ہیں۔', placeholder: '— حالت منتخب کریں —', other: 'براہ کرم حالت درج کریں' },
    vi: { label: 'Tình Trạng Y Tế Đang Điều Trị <span class="sdoh-optional">tùy chọn</span>', note: 'Giữ Ctrl / Cmd để chọn nhiều. Lựa chọn của bạn xuất hiện bên dưới.', placeholder: '— Chọn tình trạng —', other: 'Vui lòng chỉ định tình trạng' },
    tl: { label: 'Medikal na Kondisyon na Nililuto <span class="sdoh-optional">opsyonal</span>', note: 'Pindutin ang Ctrl / Cmd para pumili ng marami. Ang iyong mga napili ay makikita sa ibaba.', placeholder: '— Pumili ng kondisyon —', other: 'Pakitukoy ang kondisyon' },
  };
  const _cui = _condUI[_cl] || _condUI.en;
  if (label) label.innerHTML = _cui.label;
  if (note) note.textContent = _cui.note;
  if (other) other.placeholder = _cui.other;
  const prevSelected = new Set(Array.from(sel.selectedOptions).map(o => o.value));
  sel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = _cui.placeholder;
  sel.appendChild(placeholder);
  _CONDITION_GROUPS.forEach(group => {
    const og = document.createElement('optgroup');
    og.label = group[_cl] || group.en;
    group.items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.en;
      opt.textContent = item[_cl] || item.en;
      if (prevSelected.has(item.en)) opt.selected = true;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });
  // Reset search filter on rebuild so stale query doesn't hide newly loaded options
  const _srch = document.getElementById('sdoh-condition-search') || document.getElementById('map-sdoh-condition-search');
  if (_srch) { _srch.value = ''; }
}

/**
 * Builds all language selector dropdowns (`#lang-select`, `#lang-select-entry`, `#lang-select-consent`)
 * from `MMAS_QUESTIONS`. Auto-detects the browser language and pre-selects it if available.
 * Wires the change listener on `#lang-select` to call `renderMMASQuestions()` and `rebuildConditionDropdown()`.
 * @returns {void}
 */
function buildLangSelect() {
  var sortedLangs = Object.entries(MMAS_QUESTIONS)
    .sort(function(a,b) { return a[1].name.localeCompare(b[1].name); });

  // Populate #lang-select (MMAS screen) if it exists
  const sel = document.getElementById('lang-select');
  if (sel) {
    sel.innerHTML = '';
    sortedLangs.forEach(function([code, d]) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = d.name + (d.native !== d.name ? ` — ${d.native}` : '');
      if (code === 'en') opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      // setAppLanguage handles: mmasCurrentLang, RTL direction, UI translation, renderMMASQuestions
      if (typeof setAppLanguage === 'function') {
        setAppLanguage(sel.value);
      } else {
        mmasCurrentLang = sel.value;
        renderMMASQuestions();
      }
      rebuildConditionDropdown();
    });
  }

  // Populate all remaining language selectors (entry screen is the primary one)
  ['lang-select-entry', 'lang-select-consent'].forEach(function(selId) {
    var elSel = document.getElementById(selId);
    if (!elSel) return;
    elSel.innerHTML = '';
    sortedLangs.forEach(function(entry) {
      var code = entry[0], d = entry[1];
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = d.name + (d.native !== d.name ? ' — ' + d.native : '');
      if (code === (typeof mmasCurrentLang !== 'undefined' ? mmasCurrentLang : 'en')) opt.selected = true;
      elSel.appendChild(opt);
    });
  });

  // Auto-detect browser language and pre-select if available
  const detected = autoDetectLanguage();
  const entryEl = document.getElementById('lang-select-entry');
  if (detected && detected !== 'en') {
    if (sel) sel.value = detected;
    if (entryEl) entryEl.value = detected;
    mmasCurrentLang = detected;
    rebuildConditionDropdown();
    setTimeout(() => showToast(`🌐 Language auto-detected: ${MMAS_QUESTIONS[detected]?.name || detected}. Change anytime above.`, 4000), 800);
  } else {
    rebuildConditionDropdown(); // build English version on initial load
  }
}

// ══════════════════════════════════════════════
// MMAS-8 QUESTION RENDER
// ══════════════════════════════════════════════
/**
 * Renders all 8 MMAS-8 questions in the current language into `#mmas-questions-container`.
 * Applies RTL document direction when the selected language requires it.
 * Restores previously selected answers via the `mmasAnswers` global.
 * @returns {void}
 */
function renderMMASQuestions() {
  const lang = MMAS_QUESTIONS[mmasCurrentLang] || MMAS_QUESTIONS.en;
  const dir  = lang.dir || 'ltr';
  const yn   = { yes: lang.q1_yes||'Yes', no: lang.q1_no||'No' };
  const freqs = [
    { val:1,    label: lang.q8_never||'Never/Rarely' },
    { val:0.75, label: lang.q8_once||'Once in a while' },
    { val:0.5,  label: lang.q8_sometimes||'Sometimes' },
    { val:0.25, label: lang.q8_usually||'Usually' },
    { val:0,    label: lang.q8_always||'All the time' }
  ];

  // ── {{COND}} interpolation ─────────────────────────────────────────────────
  // Substitutes the patient's selected condition into the question text.
  // If no condition is selected: removes the token before pill/medicine/medication/
  // treatment words; falls back to "condition" when used as a standalone noun.
  const _condSel = document.getElementById('sdoh-condition');
  const _condName = (_condSel && _condSel.value) ? _condSel.value.split('(')[0].trim().toLowerCase() : '';
  const _interp = (t) => {
    if (!t) return t;
    if (_condName) return t.replace(/\{\{COND\}\}/g, _condName);
    return t
      .replace(/\{\{COND\}\}\s+(?=pills|medicine|medication|treatment)/gi, '')
      .replace(/\{\{COND\}\}/g, 'condition');
  };

  // ── Update preamble with condition name ──────────────────────────────────────
  const _preamble = document.getElementById('mmas-page-sub');
  if (_preamble) {
    const _condDisplay = _condName || 'your condition';
    _preamble.textContent = `You indicated that you are taking medication(s) for your ${_condDisplay}. Individuals have identified several issues regarding their medication-taking behavior, and we are interested in your experiences. There is no right or wrong answer. Please answer each question based on your personal experience with your ${_condDisplay} medication.`;
  }

  // Q1–Q7: Yes/No (scoring: q5 reversed — Yes=1, No=0; all others No=1, Yes=0)
  const yesNoQs = [
    { id:'q1', text: _interp(lang.q1), reversed:false },
    { id:'q2', text: _interp(lang.q2), reversed:false },
    { id:'q3', text: _interp(lang.q3), reversed:false },
    { id:'q4', text: _interp(lang.q4), reversed:false },
    { id:'q5', text: _interp(lang.q5), reversed:true  },
    { id:'q6', text: _interp(lang.q6), reversed:false },
    { id:'q7', text: _interp(lang.q7), reversed:false }
  ];

  let html = '';
  yesNoQs.forEach((q, i) => {
    let ans = mmasAnswers[q.id];
    // ZOE stores string 'yes'/'no' — normalize to numeric for display
    if (ans === 'yes') ans = q.reversed ? 1 : 0;
    else if (ans === 'no') ans = q.reversed ? 0 : 1;
    // ans is now 0 or 1 (or undefined if unanswered)
    const answered = ans !== undefined && ans !== null && !isNaN(ans);
    html += `<div class="q-block${answered ? ' answered' : ''}" id="qblock-${q.id}" dir="${dir}">
      <div class="q-number">${(window._currentMMASUI && window._currentMMASUI.questionOf) ? window._currentMMASUI.questionOf(i+1) : 'Question '+(i+1)+' of 8'}</div>
      <div class="q-text">${q.text}</div>
      <div class="q-opts">
        <button class="q-opt${answered && (!q.reversed ? ans===0 : ans===1) ? ' selected' : ''}"
          onclick="answerMMAS('${q.id}','yes',${q.reversed})">${yn.yes}</button>
        <button class="q-opt${answered && (!q.reversed ? ans===1 : ans===0) ? ' selected' : ''}"
          onclick="answerMMAS('${q.id}','no',${q.reversed})">${yn.no}</button>
      </div>
    </div>`;
  });

  // Q8: frequency — ZOE stores string like 'never','sometimes' etc — map to numeric
  let ans8raw = mmasAnswers['q8'];
  const q8StringMap = { never:1, 'once in a while':0.75, rarely:0.75, sometimes:0.5, usually:0.25, often:0.25, 'all the time':0, always:0 };
  let ans8 = (typeof ans8raw === 'string') ? (q8StringMap[ans8raw.toLowerCase()] ?? undefined) : ans8raw;
  html += `<div class="q-block${ans8 !== undefined ? ' answered' : ''}" id="qblock-q8" dir="${dir}">
    <div class="q-number">${(window._currentMMASUI && window._currentMMASUI.questionOf) ? window._currentMMASUI.questionOf(8) : 'Question 8 of 8'}</div>
    <div class="q-text">${_interp(lang.q8)}</div>
    <div class="q8-opts">
      ${freqs.map(f => `<button class="q8-opt${ans8 === f.val ? ' selected' : ''}"
        onclick="answerMMASFreq(${f.val})">${f.label}</button>`).join('')}
    </div>
  </div>`;

  document.getElementById('mmas-questions-container').innerHTML = html;
  updateMMASProgress();
}

/**
 * Records a yes/no answer for a binary MMAS-8 question and re-renders the question set.
 * @param {string} qid - Question key (e.g. `'q1'`–`'q7'`)
 * @param {'yes'|'no'} choice - The user's answer
 * @param {boolean} reversed - If `true`, 'yes' scores 1 (e.g. Q3/Q4 which are reverse-coded)
 * @returns {void}
 */
function answerMMAS(qid, choice, reversed) {
  const val = reversed
    ? (choice === 'yes' ? 1 : 0)
    : (choice === 'no'  ? 1 : 0);
  mmasAnswers[qid] = val;
  // Cherry 7: persist draft so returning users can resume
  try { sessionStorage.setItem('atlas_mmas_draft', JSON.stringify({ answers: mmasAnswers, ts: Date.now() })); } catch(e) {}
  renderMMASQuestions();
}

/**
 * Records the frequency-scale answer for MMAS-8 Q8 (difficulty remembering) and re-renders.
 * @param {number} val - Ordinal score value (1 = Never/Rarely through 5 = All the time)
 * @returns {void}
 */
function answerMMASFreq(val) {
  mmasAnswers['q8'] = val;
  // Cherry 7: persist draft
  try { sessionStorage.setItem('atlas_mmas_draft', JSON.stringify({ answers: mmasAnswers, ts: Date.now() })); } catch(e) {}
  renderMMASQuestions();
}

/**
 * Updates the MMAS-8 progress bar, question count, and running score chip.
 * Enables the submit button and shows the spectator button when all 8 questions are answered.
 * Handles string answers from ZOE voice input as well as numeric button answers.
 * @returns {void}
 */
function updateMMASProgress() {
  const q8StringMap = { never:1, 'once in a while':0.75, rarely:0.75, sometimes:0.5, usually:0.25, often:0.25, 'all the time':0, always:0 };
  const normalizeAns = (k, v) => {
    if (v === 'yes') return 0; // 'yes'/'no' strings from ZOE — treat as answered
    if (v === 'no')  return 1;
    if (typeof v === 'string' && q8StringMap[v.toLowerCase()] !== undefined) return q8StringMap[v.toLowerCase()];
    return parseFloat(v);
  };
  const count = ['q1','q2','q3','q4','q5','q6','q7','q8'].filter(k => {
    const v = mmasAnswers[k];
    return v !== undefined && v !== null && v !== '';
  }).length;
  const score = ['q1','q2','q3','q4','q5','q6','q7','q8'].reduce((a,k) => {
    const v = mmasAnswers[k];
    if (v === undefined || v === null || v === '') return a;
    return a + (normalizeAns(k, v) || 0);
  }, 0);
  document.getElementById('prog-fill').style.width = (count/8*100) + '%';
  document.getElementById('prog-count').textContent = count + ' / 8';

  const submitBtn = document.getElementById('mmas-submit-btn');
  if (count === 8) {
    submitBtn.disabled = false;
    const cat = getAdherenceCategory(score);
    document.getElementById('score-chip').textContent = 'Score: ' + score.toFixed(2);
    document.getElementById('score-chip').style.color = cat.color;
    document.getElementById('score-chip').style.borderColor = cat.color + '44';
    document.getElementById('score-chip').style.background = cat.color + '18';
    document.getElementById('mmas-spectator-btn').style.display = 'flex';
  } else {
    submitBtn.disabled = true;
    document.getElementById('score-chip').textContent = 'Score: —';
    document.getElementById('score-chip').style.color = '';
  }
}

// ══════════════════════════════════════════════
// MMAS SUBMISSION
// ══════════════════════════════════════════════
async function submitMMAS() {
  // Count only canonical q1–q8 keys — ZOE also writes _zoe_q* keys which must not inflate the count
  const count = Object.keys(mmasAnswers).filter(k => /^q\d$/.test(k)).length;
  if (count < 8) { showToast('Please answer all 8 questions.'); return; }

  const btn = document.getElementById('mmas-submit-btn');
  btn.dataset.originalText = btn.textContent;
  if (!document.getElementById('atlas-spin-style')) {
    const s = document.createElement('style');
    s.id = 'atlas-spin-style';
    s.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }
  btn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite;">⟳</span> Submitting...';
  btn.disabled = true;

  if (!userLocation) await requestGeolocation();

  // ZOE path: use snapshotted numeric scores to avoid string-poisoned mmasAnswers reduce
  // Standard path: sum only the 8 canonical numeric q* keys
  let score;
  if (window._zoeScoresSnapshot && window._zoeScoresSnapshot.length === 8) {
    score = window._zoeScoresSnapshot.reduce((a, b) => a + (isNaN(b) ? 0 : Number(b)), 0);
    window._zoeScoresSnapshot = null; // consume
  } else {
    const numericKeys = ['q1','q2','q3','q4','q5','q6','q7','q8'];
    score = numericKeys.reduce((a, k) => a + (parseFloat(mmasAnswers[k]) || 0), 0);
  }
  const cat   = getAdherenceCategory(score);
  const ts    = Date.now();

  // SDoH: ZOE path uses pre-captured snapshot; manual path reads live fields
  const _sn = window._zoeSdohSnapshot || {};
  const sdohCountry  = _sn.country   || document.getElementById('sdoh-country')?.value.trim()  || userLocation?.country  || 'Unknown';
  const sdohCity     = _sn.city      || document.getElementById('sdoh-city')?.value.trim()      || userLocation?.city     || 'Unknown';
  const manualPatient = _sn.patientNum || document.getElementById('sdoh-patient-num')?.value.trim() || null;

  // Auto-assign a short readable patient ID if none was entered.
  // Stored in window._sessionPatientId so PEACS picks it up in the same session.
  if (!window._sessionPatientId) {
    // Generate: PT- + 4 random uppercase hex chars (65536 combinations, readable, short)
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(2)), b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
    window._sessionPatientId = 'PT-' + rand;
  }
  const sdohPatient = manualPatient || window._sessionPatientId;
  const sdohStudy    = _sn.studyId   || document.getElementById('sdoh-study-id')?.value.trim().toUpperCase() || window._activeStudyId || null;
  const condSelect   = document.getElementById('sdoh-condition');
  const selectedConds = condSelect ? Array.from(condSelect.selectedOptions).map(o => o.value).filter(Boolean) : [];
  const hasOther     = selectedConds.includes('Other');
  const otherText    = document.getElementById('sdoh-condition-other')?.value.trim() || '';
  const sdohCond     = _sn.condition ||
    (selectedConds.length ? selectedConds.map(c => c === 'Other' ? (otherText || 'Other') : c).join('; ') : null);
  const sdohDrugType = _sn.drugType    || null;
  const sdohDrugName = _sn.drugName    || null;
  const sdohStrength = _sn.drugStrength|| null;
  const sdohRoute    = _sn.route       || null;
  // Multi-medication support
  const medications  = getMedications();
  const primaryMed   = medications[0] || null;
  const numMedsSel   = document.getElementById('sdoh-num-medications')?.value;
  const numMeds      = numMedsSel ? parseInt(numMedsSel, 10) : (medications.length || null);
  // Find the medication explicitly linked to this MMAS-8 session
  const linkedMed    = medications.find(m => m.mmas_linked) || primaryMed;
  const sdohGender   = _sn.gender      || document.getElementById('sdoh-gender')?.value             || null;
  const sdohAge      = _sn.ageRange    || document.getElementById('sdoh-age')?.value                || null;
  const sdohEdu      = _sn.education   || document.getElementById('sdoh-education')?.value          || null;

  const isResearcher = !!currentWorkspace;
  const full = {
    user_id:         userId,
    timestamp:       ts,
    score:           score,
    adherence_level: cat.label,
    country:         normalizeCountry(sdohCountry),
    city:            sdohCity,
    latitude:        userLocation?.latitude ?? null,
    longitude:       userLocation?.longitude ?? null,
    country_code:    resolveCountryCode(sdohCountry, userLocation?.country_code),
    role:            isResearcher ? 'researcher' : 'patient',
    data_tier:       isResearcher ? 'clinical' : 'public',
    q1: mmasAnswers.q1||0, q2: mmasAnswers.q2||0, q3: mmasAnswers.q3||0,
    q4: mmasAnswers.q4||0, q5: mmasAnswers.q5||0, q6: mmasAnswers.q6||0,
    q7: mmasAnswers.q7||0, q8: mmasAnswers.q8||0
  };
  // Compute & store MMAS-8 PE domain scores (Theory of Predictive Emergence)
  const _mmasPE = computeMMASPE(full);
  if (_mmasPE) { full.mmas_pe = _mmasPE.pe; full.mmas_a = _mmasPE.a; full.mmas_e = _mmasPE.e; full.mmas_c = _mmasPE.c; }
  // Attach SDoH fields only when provided
  full.patient_number = sdohPatient; // always set — auto-assigned if not manually entered
  if (sdohStudy)    full.study_id               = sdohStudy;
  if (sdohCond)     full.condition              = sdohCond;
  if (numMeds)      full.num_medications        = numMeds;
  // Primary/linked med (backwards-compatible single-drug fields — uses MMAS-linked med if specified)
  if (linkedMed) {
    if (linkedMed.type)      full.drug_type               = linkedMed.type;
    if (linkedMed.name)      full.drug_name               = linkedMed.name;
    if (linkedMed.strength)  full.drug_strength           = linkedMed.strength;
    if (linkedMed.route)     full.route_of_administration = linkedMed.route;
    if (linkedMed.frequency) full.dosing_frequency        = linkedMed.frequency;
  }
  // Full polypharmacy list
  if (medications.length > 0) full.medications = medications;
  if (sdohGender)   full.gender                 = sdohGender;
  if (sdohAge)      full.age_range              = sdohAge;
  if (sdohEdu)      full.education_level        = sdohEdu;
  // Adherence barriers (checkbox group)
  const _barrierBoxes = document.querySelectorAll('input[name="sdoh_barrier"]:checked');
  if (_barrierBoxes.length > 0) full.adherence_barriers = Array.from(_barrierBoxes).map(cb => cb.value);
  // Pharmacist notes (free text — workspace-only, not public data)
  const _pharmNotes = document.getElementById('sdoh-pharmacist-notes')?.value.trim();
  if (_pharmNotes && currentWorkspace) full.pharmacist_notes = _pharmNotes;
  const _sdohCustom = getSdohCustomData('sdoh-custom-rows');
  if (_sdohCustom)  full.sdoh_custom            = _sdohCustom;
  if (currentWorkspace) {
    full.institution_code = currentWorkspace;
    // Tag with parent_institution so institution dashboards can roll up child PI data.
    // Without this, child PI MMAS submissions are invisible to their parent institution.
    if (workspaceProfile && workspaceProfile.parent_institution) {
      full.parent_institution = workspaceProfile.parent_institution;
    }
    // Tag with parent_pi so PI dashboards can see their assigned students.
    if (workspaceProfile && workspaceProfile.parent_pi) {
      full.parent_pi = workspaceProfile.parent_pi;
    }
  }
  // Tag with active campaign if one is running
  const _activeCamp = detectActiveCampaign();
  if (_activeCamp) full.campaign_id = _activeCamp.id;


  // Attach ZOE transcript and SOAP note if voice session
  if (window._zoeTranscript && window._zoeTranscript.length) {
    full.zoe_session    = true;
    full.zoe_transcript = window._zoeTranscript;
    if (window._zoeSoapNote) full.soap_note = window._zoeSoapNote;
    window._zoeTranscript = null;
    window._zoeSoapNote   = null;
  }

  try {
    // Guard: ensure Firebase auth is ready before writing.
    // signInAnonymously() is async — if patient submits before it resolves,
    // currentUser is null and the write hits PERMISSION_DENIED.
    if (!firebase.auth().currentUser) {
      await new Promise((resolve, reject) => {
        const unsub = firebase.auth().onAuthStateChanged(user => {
          unsub();
          if (user) resolve();
          else firebase.auth().signInAnonymously().then(resolve).catch(reject);
        });
        // Safety timeout — 8 seconds, then try anyway
        setTimeout(resolve, 8000);
      });
    }

    const ref = await atlasDB('assessments').push(full);

    // Guard against null-island (0°N 0°E) — if geo resolved to hardcoded fallback, omit coords
    const hasValidCoords = userLocation &&
      !(userLocation.latitude === 0 && userLocation.longitude === 0 && userLocation.country === 'Unknown');

    await database.ref('mapData').push({
      score, adherence_level: cat.label,
      latitude:  hasValidCoords ? userLocation.latitude  : null,
      longitude: hasValidCoords ? userLocation.longitude : null,
      // Prefer typed-in SDoH country/city over raw GPS lookup
      country: sdohCountry || (hasValidCoords ? userLocation.country : 'Unknown'),
      city:    sdohCity    || (hasValidCoords ? userLocation.city    : 'Unknown'),
      timestamp: ts, assessment_ref: ref.key,
      // Include workspace so the cohort-filter toggle can isolate by institution
      institution_code: currentWorkspace || null,
      // Campaign tag — mirrors assessments node
      campaign_id: _activeCamp ? _activeCamp.id : null
    });

    // Increment globalStats — single lightweight node for fast counter reads
    database.ref('globalStats/totalAssessments').transaction(n => (n || 0) + 1);
    const _gsCountry = sdohCountry || (hasValidCoords ? userLocation.country : null);
    if (_gsCountry && _gsCountry !== 'Unknown') {
      database.ref('globalStats/countries/' + _gsCountry.replace(/[.#$/[\]]/g, '_')).set(true);
    }
    updatePublicStats(score, _gsCountry);

    btn.textContent = '✓ Submitted';
    btn.style.background = '#10b981';
    window._zoeSdohSnapshot = null;
    // Cherry 7: clear the in-progress draft — assessment is complete
    try { sessionStorage.removeItem('atlas_mmas_draft'); } catch(e) {}

    // ── Cherry 4: Streak counter ─────────────────────────────────────────────
    // Track how many times this device has submitted an MMAS-8 assessment,
    // and how many consecutive days the user has been tracking.
    (function updateStreak() {
      try {
        const now = Date.now();
        const raw = localStorage.getItem('atlas_streak');
        let streak = raw ? JSON.parse(raw) : { count: 0, lastTs: 0, days: 0 };
        streak.count = (streak.count || 0) + 1;
        const daysSinceLast = (now - (streak.lastTs || 0)) / 86400000;
        if (daysSinceLast < 2) {
          // Same or consecutive day — extend streak
          if (daysSinceLast >= 1) streak.days = (streak.days || 1) + 1;
          else streak.days = streak.days || 1;
        } else {
          // Gap of more than a day — reset streak
          streak.days = 1;
        }
        streak.lastTs = now;
        localStorage.setItem('atlas_streak', JSON.stringify(streak));
        window._atlasStreak = streak;
      } catch(e) {}
    })();

    // Fire Sentinel alert for critical scores — non-blocking
    fireSentinelAlert(full, ref.key).catch(()=>{});

    // Auto-refresh dashboard so new submission appears immediately
    // Fire for ALL roles — superadmin dashboard must see patient-path submissions too
    setTimeout(() => { if (typeof loadMmasCohortData === 'function') loadMmasCohortData(); }, 800);

    showResultModal(score, mmasAnswers);
  } catch(e) {
    console.error('submitMMAS error:', e);
    showToast('Submission error: ' + (e && e.message ? e.message : 'Unknown error'));
    btn.disabled = false; btn.textContent = 'Submit Assessment'; btn.style.background = '';
  }
}

// ══════════════════════════════════════════════
// MMAS RESULT MODAL
// ══════════════════════════════════════════════
function classifyPattern(answers) {
  // INA (Intentional Non-Adherence): Q2, Q3, Q6, Q7
  // UNA (Unintentional Non-Adherence): Q1, Q4, Q8
  // Q5 is neutral (adherence confirmation item — excluded from INA/UNA classification)
  let intentional = 0, unintentional = 0;
  if (parseFloat(answers.q1||0) === 0) unintentional++;  // forgetting
  if (parseFloat(answers.q2||0) === 0) intentional++;    // deliberate omission
  if (parseFloat(answers.q3||0) === 0) intentional++;    // side-effect-driven stop
  if (parseFloat(answers.q4||0) === 0) unintentional++;  // travel forgetting
  // Q5 neutral — excluded
  if (parseFloat(answers.q6||0) === 0) intentional++;    // symptom-based stop
  if (parseFloat(answers.q7||0) === 0) intentional++;    // hassle/inconvenience
  if (parseFloat(answers.q8||0) < 1)   unintentional++;  // frequency of difficulty remembering
  return { intentional, unintentional };
}

/**
 * Classify INA/UNA pattern for a MAP record (map_q1–map_q8 field names).
 * TPE domain alignment (revised):
 *   INA (Intentional Non-Adherence):   map_q2, map_q3, map_q6  — Architecture domain
 *   UNA (Unintentional Non-Adherence): map_q1, map_q8           — Execution domain
 *   Neutral (excluded from INA/UNA):   map_q4, map_q5, map_q7  — Context/environmental
 * Q4 (routine disruption) and Q7 (medication burden) are Context domain — excluded from INA/UNA.
 * @param {Object} record - A MAP assessment record with map_q1–map_q8 fields
 * @returns {{ intentional: number, unintentional: number }}
 */
function classifyMapPattern(record) {
  let intentional = 0, unintentional = 0;
  if (parseFloat(record.map_q1||0) === 0) unintentional++;  // forgetting — UNA
  if (parseFloat(record.map_q2||0) === 0) intentional++;    // deliberate omission — INA
  if (parseFloat(record.map_q3||0) === 0) intentional++;    // side-effect-driven stop — INA
  // map_q4 Neutral (Context domain) — excluded
  // map_q5 Neutral — excluded
  if (parseFloat(record.map_q6||0) === 0) intentional++;    // symptom-based stop — INA
  // map_q7 Neutral (Context domain) — excluded
  if (parseFloat(record.map_q8||0) < 1)   unintentional++;  // frequency of difficulty remembering — UNA
  return { intentional, unintentional };
}

// ── MMAS-8 / MAP PE Domain Scoring (Theory of Predictive Emergence) ─────────
// Architecture (A) = mean(Q2,Q3,Q6)   — decisions & beliefs (INA domain)
// Execution    (E) = mean(Q1,Q5,Q8)   — behavioral reliability (UNA domain)
//   Q8 ordinal: never=1.00, rarely=0.75, sometimes=0.50, often=0.25, always=0.00
// Context      (C) = mean(Q4,Q7)      — environmental & burden factors (Neutral domain)
//   Context-Guard: C_g = 0.5 + 0.5×C — floors Context at 0.5; eliminates PE collapse from binary Q7
// PE = (A × E × C_g)^(1/3)
function computeMMASPE(r) {
  if (r.q1 === undefined || r.q2 === undefined || r.q7 === undefined) return null;
  const q8num = typeof r.q8 === 'number'
    ? (Number.isInteger(r.q8) && r.q8 >= 0 && r.q8 <= 4
        ? ({0:1, 1:0.75, 2:0.5, 3:0.25, 4:0}[r.q8] ?? null)
        : (r.q8 >= 0 && r.q8 <= 1 ? r.q8 : null))
    : ({'never':1,'rarely':0.75,'once in a while':0.75,'sometimes':0.5,'often':0.25,'usually':0.25,'always':0,'all the time':0}[String(r.q8||'').toLowerCase()] ?? null);
  if (q8num === null) return null;
  const A   = ((+(r.q2)||0) + (+(r.q3)||0) + (+(r.q6)||0)) / 3;
  const E   = ((+(r.q1)||0) + (+(r.q5)||0) + q8num) / 3;
  const C   = ((+(r.q4)||0) + (+(r.q7)||0)) / 2;
  const C_g = 0.5 + 0.5 * C;   // Context-Guard: maps [0,1] → [0.5,1.0]
  const pe  = Math.pow(A * E * C_g, 1/3);
  return { pe: +pe.toFixed(4), a: +A.toFixed(4), e: +E.toFixed(4), c: +C_g.toFixed(4) };
}

function showResultModal(score, answers) {
  const cat  = getAdherenceCategory(score);
  const pct  = Math.round((score/8)*100);
  const { intentional, unintentional } = classifyPattern(answers);
  var _rsP = (typeof getResultStrings === 'function') ? getResultStrings(score, intentional, unintentional) : null;
  const pattern = _rsP ? _rsP.pattern
    : (intentional > unintentional ? 'Intentional Non-Adherence'
    : unintentional > intentional  ? 'Unintentional Non-Adherence'
    : score >= 8 ? 'High Adherence' : 'Mixed Pattern');

  const radius = 52, circ = Math.PI * radius;
  const offset = circ - (pct/100) * circ;

  // Use translated result strings
  var _rs = (typeof getResultStrings === 'function')
    ? getResultStrings(score, intentional, unintentional)
    : null;
  let message = _rs ? _rs.message : (score >= 8
    ? 'Excellent work. You are maintaining optimal medication adherence.'
    : score >= 6 ? 'You are doing well, but there is room for improvement.'
    : intentional >= unintentional ? 'Your responses suggest you may have concerns about your medication.'
    : 'Your responses suggest you are facing practical barriers like forgetting.');
  let tips = _rs ? _rs.tips : '';

  // PE Profile — compute for display in result modal (gated: researcher / PI / institution)
  const _resPE = computeMMASPE(answers);
  const _showResPE = _resPE && workspaceProfile && workspaceProfile.role !== 'student';
  const _peHtml = (function() {
    if (!_showResPE) return '';
    const { pe, a, e, c } = _resPE;
    const fmt = v => (v * 100).toFixed(0);
    const bar = (v, color) => `<div style="height:6px;border-radius:3px;background:var(--border2);overflow:hidden;"><div style="height:100%;width:${fmt(v)}%;background:${color};border-radius:3px;transition:width 0.8s ease;"></div></div>`;
    const constraint = a <= e && a <= c ? 'Architecture' : e <= a && e <= c ? 'Execution' : 'Context';
    const hint = constraint === 'Architecture'
      ? 'Address beliefs & decision barriers.'
      : constraint === 'Execution'
      ? 'Focus on behavioral reliability & routines.'
      : 'Reduce medication burden & access friction.';
    return `<div style="margin:12px 0;background:rgba(212,168,67,0.06);border:1px solid rgba(212,168,67,0.25);border-radius:12px;padding:16px 18px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--pe);margin-bottom:12px;display:flex;align-items:center;gap:7px;">
        <span style="width:5px;height:5px;border-radius:50%;background:var(--pe);box-shadow:0 0 6px var(--pe);display:inline-block;"></span>TPE · PE Domain Profile
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:300;color:var(--pe);line-height:1;">${pe.toFixed(2)}</div>
        <div style="flex:1;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:var(--dim);margin-bottom:2px;">Predictive Emergence Score</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;color:rgba(212,168,67,0.6);">Constrained by ${constraint} · ${hint}</div>
        </div>
      </div>
      <div style="display:grid;gap:8px;">
        <div><div style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;color:var(--base);margin-bottom:3px;display:flex;justify-content:space-between;"><span>Architecture (A) · Decisions &amp; Beliefs</span><span>${a.toFixed(2)}</span></div>${bar(a,'var(--base)')}</div>
        <div><div style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;color:var(--mvmt);margin-bottom:3px;display:flex;justify-content:space-between;"><span>Execution (E) · Behavioral Reliability</span><span>${e.toFixed(2)}</span></div>${bar(e,'var(--mvmt)')}</div>
        <div><div style="font-family:'IBM Plex Mono',monospace;font-size:0.76rem;color:var(--strata);margin-bottom:3px;display:flex;justify-content:space-between;"><span>Context (C) · Burden &amp; Friction</span><span>${c.toFixed(2)}</span></div>${bar(c,'var(--strata)')}</div>
      </div>
    </div>`;
  })();

  const modal = document.createElement('div');
  modal.className = 'result-modal';
  modal.innerHTML = `
    <div class="result-box">
      <div class="result-score-row">
        <div class="result-gauge">
          <svg width="120" height="70" viewBox="0 0 120 70">
            <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="8" stroke-linecap="round"/>
            <path id="rc-gauge-path" d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="${cat.color}" stroke-width="8" stroke-linecap="round"
              stroke-dasharray="${circ}" stroke-dashoffset="${circ}" style="transition:stroke-dashoffset 1.2s cubic-bezier(0.34,1,0.64,1);"/>
            <text x="60" y="62" text-anchor="middle" fill="${cat.color}" font-family="'Cormorant Garamond',serif" font-size="20" font-weight="300">${score.toFixed(2)}</text>
          </svg>
        </div>
        <div class="result-score-info">
          <div class="result-headline">${cat.label}</div>
          <div class="result-subline" style="color:${cat.color}">${pattern}</div>
        </div>
      </div>
      <div class="result-message">${message}</div>
      ${tips}
      ${_peHtml}
      <div id="rc-ai-insight" style="margin:0 0 14px;border-radius:12px;overflow:hidden;display:none;">
        <div id="rc-ai-insight-inner" style="background:rgba(139,111,245,0.08);border:1px solid rgba(139,111,245,0.28);border-radius:12px;padding:14px 16px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--mvmt);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span style="width:5px;height:5px;border-radius:50%;background:var(--mvmt);box-shadow:0 0 6px var(--mvmt);display:inline-block;"></span>
            ✦ Personalized Insight
          </div>
          <div id="rc-ai-insight-text" style="font-size:0.88rem;color:var(--text);line-height:1.65;">
            <span class="rc-ai-pulse" style="display:inline-block;width:60%;height:0.85em;border-radius:4px;background:rgba(139,111,245,0.18);animation:rcAiPulse 1.4s ease-in-out infinite;vertical-align:middle;"></span>
          </div>
        </div>
      </div>
      <div class="result-global-tag"><span class="result-global-dot"></span>${(_rs && _rs.globalTag) ? _rs.globalTag : 'Your result has been added to the global adherence map.'}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.88rem;text-align:center;margin-bottom:14px;color:var(--dim);">${(function(){ var _t2 = (typeof ATLAS_STRINGS !== 'undefined' && ATLAS_STRINGS[mmasCurrentLang]) ? ATLAS_STRINGS[mmasCurrentLang] : {}; return _t2.labelPatient || 'Patient ID'; })()} <span style="color:var(--bright);letter-spacing:0.08em;" id="rc-patient-id-display">${window._sessionPatientId||'—'}</span></div>
      <!-- Cherry 4: Streak badge — shown when user has more than 1 submission -->
      ${(function(){
        try {
          const s = JSON.parse(localStorage.getItem('atlas_streak') || '{}');
          const count = s.count || 0;
          if (count < 2) return '';
          const days = s.days || 1;
          const streakMsg = days >= 2
            ? `Assessment #${count} · <span style="color:var(--strata);">${days}-day tracking streak</span>`
            : `Assessment #${count} · <span style="color:var(--base);">You've been tracking your adherence</span>`;
          return `<div style="text-align:center;margin-bottom:14px;font-family:'IBM Plex Mono',monospace;font-size:0.90rem;letter-spacing:0.08em;background:rgba(78,156,245,0.06);border:1px solid rgba(78,156,245,0.2);border-radius:8px;padding:8px 14px;color:var(--muted);">${streakMsg}</div>`;
        } catch(e) { return ''; }
      })()}
      <div id="rc-soap-panel" style="display:none;background:rgba(139,111,245,0.06);border:1px solid rgba(139,111,245,0.2);border-radius:12px;padding:20px 22px;margin-bottom:14px;text-align:left;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(139,111,245,0.7);margin-bottom:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:space-between;"><span>🩺 ZOE Clinical Note · SOAP Format<span class="soap-hint">Review and edit before copying to your EHR</span></span><div style="display:flex;gap:6px;"><button id="rc-soap-readback-btn" title="ZOE reads the note aloud — hands-free confirmation" style="font-size:0.80rem;letter-spacing:0.1em;background:rgba(46,201,138,0.1);border:1px solid rgba(46,201,138,0.3);color:var(--strata);border-radius:6px;padding:4px 10px;cursor:pointer;">🔊 ZOE Read-Back</button><button id="rc-soap-copy-btn" style="font-size:0.80rem;letter-spacing:0.1em;background:rgba(139,111,245,0.12);border:1px solid rgba(139,111,245,0.3);color:var(--mvmt);border-radius:6px;padding:4px 10px;cursor:pointer;" onclick="copySoapNote('rc-soap-textarea','rc-soap-copy-btn')">Copy for Chart</button></div></div>
        <textarea id="rc-soap-textarea" class="soap-textarea" rows="12" spellcheck="true"></textarea>
        <div id="rc-zoe-note" style="margin-top:12px;font-size:0.81rem;color:rgba(139,111,245,0.6);font-style:italic;border-top:1px solid rgba(139,111,245,0.12);padding-top:10px;"></div>
      </div>
      <button class="result-download-btn" id="rc-download-btn">${(_rs && _rs.download) ? _rs.download : '↓ Download My Result Card'}</button>
      <button class="result-spectator-btn" id="rc-spectator-btn">${(_rs && _rs.spectator) ? _rs.spectator : '◉ Watch the Live Global Map'}</button>
      <button id="rc-peacs-btn" style="display:${document.body.classList.contains('patient-mode')?'none':'block'};width:100%;margin-bottom:10px;padding:14px;font-family:'IBM Plex Mono',monospace;font-size:0.71rem;letter-spacing:0.1em;text-transform:uppercase;background:linear-gradient(135deg,rgba(139,111,245,0.15),rgba(78,156,245,0.12));border:1px solid rgba(139,111,245,0.35);color:var(--mvmt);border-radius:var(--r);cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='linear-gradient(135deg,rgba(139,111,245,0.25),rgba(78,156,245,0.2))'" onmouseout="this.style.background='linear-gradient(135deg,rgba(139,111,245,0.15),rgba(78,156,245,0.12))'">
        ${window._sessionData ? 'Continue to PEACS Assessment →' : '✦ Take the Predictive Emergence Assessment (PEACS)'}
        <div style="font-size:0.61rem;color:var(--dim);margin-top:4px;text-transform:none;letter-spacing:0;font-family:'Helvetica Neue',Arial,sans-serif;">${window._sessionData ? 'Administer PEACS for patient ' + window._sessionData.patientId : 'Deepen your result — measure the biological, movement, and social strata factors behind your adherence score'}</div>
      </button>
      <button class="result-done-btn" id="rc-ivm-btn" style="background:rgba(78,156,245,0.08);border:1px solid rgba(78,156,245,0.25);color:var(--base);margin-bottom:10px;">🎯 View Matched Interventions</button>
      <div id="rc-wad-share-card" style="margin-bottom:12px;background:linear-gradient(135deg,rgba(212,168,67,0.08),rgba(46,201,138,0.06));border:1px solid rgba(212,168,67,0.28);border-radius:14px;padding:18px 20px;text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--pe);margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:6px;">
          <span style="width:5px;height:5px;border-radius:50%;background:var(--pe);box-shadow:0 0 6px var(--pe);display:inline-block;"></span>
          Adherence Cartography · ATLAS
        </div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.18rem;font-weight:300;color:var(--bright);line-height:1.4;margin-bottom:4px;">I contributed to the<br/><em style="font-style:italic;color:var(--pe);">ATLAS Global Map</em></div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.86rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(212,168,67,0.55);margin-bottom:10px;">#NotADoseADuration</div>
        <div style="font-size:0.90rem;color:var(--muted);margin-bottom:16px;line-height:1.6;">Contributing to real-time global medication adherence research powered by the MMAS-8.</div>
        <button id="rc-wad-copy-btn" style="width:100%;font-family:'IBM Plex Mono',monospace;font-size:0.80rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(212,168,67,0.14);border:1px solid rgba(212,168,67,0.45);color:var(--pe);border-radius:10px;padding:13px 16px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;" onmouseover="this.style.background='rgba(212,168,67,0.24)'" onmouseout="this.style.background='rgba(212,168,67,0.14)'"><span style="font-size:1rem;">📋</span><span>Copy Message to Clipboard</span></button>
        <div style="font-size:0.80rem;color:var(--dim);margin-bottom:8px;font-family:'IBM Plex Mono',monospace;letter-spacing:0.06em;">Then paste and share on your preferred platform</div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <a id="rc-wad-linkedin-btn" href="#" target="_blank" rel="noopener" style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(10,102,194,0.1);border:1px solid rgba(10,102,194,0.3);color:#5ba3d9;border-radius:8px;padding:7px 14px;cursor:pointer;transition:all 0.2s;text-decoration:none;display:inline-flex;align-items:center;gap:5px;" onmouseover="this.style.background='rgba(10,102,194,0.2)'" onmouseout="this.style.background='rgba(10,102,194,0.1)'">🔗 LinkedIn</a>
          <a id="rc-wad-x-btn" href="#" target="_blank" rel="noopener" style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.18);color:rgba(220,235,255,0.8);border-radius:8px;padding:7px 14px;cursor:pointer;transition:all 0.2s;text-decoration:none;display:inline-flex;align-items:center;gap:5px;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">𝕏 Post</a>
          <a id="rc-wad-fb-btn" href="#" target="_blank" rel="noopener" style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(24,119,242,0.1);border:1px solid rgba(24,119,242,0.3);color:#6fa8dc;border-radius:8px;padding:7px 14px;cursor:pointer;transition:all 0.2s;text-decoration:none;display:inline-flex;align-items:center;gap:5px;" onmouseover="this.style.background='rgba(24,119,242,0.2)'" onmouseout="this.style.background='rgba(24,119,242,0.1)'">📘 Facebook</a>
          <button id="rc-wad-ig-btn" style="font-family:'IBM Plex Mono',monospace;font-size:0.84rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(225,48,108,0.08);border:1px solid rgba(225,48,108,0.28);color:#e1306c;border-radius:8px;padding:7px 14px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='rgba(225,48,108,0.18)'" onmouseout="this.style.background='rgba(225,48,108,0.08)'">📸 Instagram</button>
        </div>
      </div>
      <div id="rc-wad-checkin-card" style="margin-bottom:12px;background:linear-gradient(135deg,rgba(46,201,138,0.07),rgba(78,156,245,0.05));border:1px solid rgba(46,201,138,0.25);border-radius:14px;padding:16px 18px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.90rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--strata);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span style="width:5px;height:5px;border-radius:50%;background:var(--strata);box-shadow:0 0 6px var(--strata);display:inline-block;"></span>
          Adherence Cartography · Check-In
        </div>
        <div style="font-size:0.84rem;color:var(--text);margin-bottom:12px;line-height:1.5;">Add your voice to the global adherence map. Your flag and message will appear live on the global map.</div>
        <div id="rc-checkin-options" style="display:flex;flex-direction:column;gap:6px;">
          <button class="wad-checkin-opt" data-msg="I contributed to the Adherence Cartography global map">🌍 I contributed to the Adherence Cartography global map</button>
          <button class="wad-checkin-opt" data-msg="Medication adherence matters to me">💊 Medication adherence matters to me</button>
          <button class="wad-checkin-opt" data-msg="I'm contributing to global health research">🔬 I'm contributing to global health research</button>
          <button class="wad-checkin-opt" data-msg="I support patients who struggle with adherence">🏥 I support patients who struggle with adherence</button>
          <button class="wad-checkin-opt" data-msg="I believe data saves lives">📊 I believe data saves lives</button>
          <button class="wad-checkin-opt" data-msg="I stand with the adherence community">🤝 I stand with the adherence community</button>
        </div>
        <div id="rc-checkin-done" style="display:none;text-align:center;padding:10px 0 2px;">
          <span id="rc-checkin-flag" style="font-size:1.4rem;"></span>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.88rem;color:var(--strata);margin-top:4px;">✓ Checked in — your message is live</div>
        </div>
      </div>
      <button class="result-done-btn" id="rc-done-btn">${(_rs && _rs.done) ? _rs.done : 'Done'}</button>
    </div>
  `;
  document.body.appendChild(modal);

  // ── ✦ Personalized AI Insight — MAP result ────────────────────────────────
  (async () => {
    try {
      const _aiCondSel = document.getElementById('sdoh-condition');
      const _aiCond = (_aiCondSel && _aiCondSel.value) ? _aiCondSel.value : (window._sessionData?.condition || '');
      const _aiPatternStr = intentional > unintentional ? 'Intentional Non-Adherence'
        : unintentional > intentional ? 'Unintentional Non-Adherence'
        : score >= 8 ? 'High Adherence' : 'Mixed Pattern';
      const _aiPrompt = `Patient completed medication adherence assessment. Score: ${score.toFixed(2)}/8. Pattern: ${_aiPatternStr} (${intentional > 0 ? 'intentional' : ''}${unintentional > 0 ? 'unintentional' : ''} non-adherence). Condition: ${_aiCond || 'not specified'}. Write one warm, personalized sentence of encouragement and one concrete tip for this specific patient.`;
      const _aiResp = await fetch('/lambda-proxy/zoe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 120,
          system: 'You are a compassionate adherence health guide. Respond in 1-2 sentences only. Be warm and specific. Never mention MMAS or scoring scales by name.',
          messages: [{ role: 'user', content: _aiPrompt }]
        })
      });
      const _aiData = await _aiResp.json();
      const _aiText = _aiData.content?.[0]?.text?.trim();
      if (_aiText) {
        const _insightEl = document.getElementById('rc-ai-insight');
        const _insightTxt = document.getElementById('rc-ai-insight-text');
        if (_insightEl && _insightTxt) {
          _insightTxt.textContent = _aiText;
          _insightEl.style.display = '';
        }
      }
    } catch(e) { /* fail silently */ }
  })();

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const p = document.getElementById('rc-gauge-path');
    if (p) p.style.strokeDashoffset = offset;
  }));

  document.getElementById('rc-spectator-btn').addEventListener('click', () => {
    modal.remove();
    enterSpectatorMode();
  });
  document.getElementById('rc-peacs-btn').addEventListener('click', () => {
    // Enrich session data with SDoH collected in the MMAS form.
    // This runs whether the session was started via Start Session or directly from MMAS.
    const condSel  = document.getElementById('sdoh-condition');
    const selConds = condSel ? Array.from(condSel.selectedOptions).map(o=>o.value).filter(Boolean) : [];
    const meds     = (typeof getMedications === 'function') ? getMedications() : [];
    const primaryMed = meds[0] ? [meds[0].name, meds[0].strength].filter(Boolean).join(' ') : '';
    const sdohFromMmas = {
      country:   normalizeCountry(document.getElementById('sdoh-country')?.value.trim() || userLocation?.country || ''),
      city:      document.getElementById('sdoh-city')?.value.trim()       || userLocation?.city    || '',
      gender:    document.getElementById('sdoh-gender')?.value            || '',
      age:       document.getElementById('sdoh-age')?.value               || '',
      education: document.getElementById('sdoh-education')?.value         || '',
      condition: selConds.join('; ') || document.getElementById('sdoh-condition-other')?.value.trim() || '',
      medication: primaryMed,
    };
    if (window._sessionData) {
      // Merge SDoH into existing session
      Object.assign(window._sessionData, sdohFromMmas);
    } else {
      window._sessionData = {
        patientId:  window._sessionPatientId || '',
        instrument: 'both',
        startedAt:  Date.now(),
        ...sdohFromMmas,
      };
    }
    updateSessionSummaryBar();
    modal.style.transition='opacity 0.3s'; modal.style.opacity='0';
    setTimeout(() => {
      modal.remove();
      showScreen('screen-peacs');
      // Must call switchPeacsTab AFTER the screen is visible, otherwise
      // peacs-tab-content is in a hidden screen and renders blank
      switchPeacsTab('assess');
    }, 300);
  });
  document.getElementById('rc-done-btn').addEventListener('click', () => {
    modal.style.transition='opacity 0.3s'; modal.style.opacity='0';
    setTimeout(()=>modal.remove(),300);
    // Reset for a fresh assessment
    mmasAnswers = {};
    renderMMASQuestions();
    document.getElementById('mmas-submit-btn').disabled = true;
    document.getElementById('mmas-submit-btn').textContent = 'Submit Assessment';
    document.getElementById('mmas-submit-btn').style.background = '';
    // If launched from the clinician dashboard, return there — never strand the nurse on screen-mmas
    if (_postConsentTarget === 'dashboard') {
      if (typeof showScreen === 'function') showScreen('screen-dashboard');
      // Refresh the clinician worklist so the new record appears immediately
      setTimeout(() => {
        if (typeof renderClinWorklist === 'function') renderClinWorklist();
        if (typeof updateClinKPIs    === 'function') updateClinKPIs();
      }, 400);
    }
  });
  // Intervention matching button — workspace users with research_ivm module
  const ivmBtn = document.getElementById('rc-ivm-btn');
  if (ivmBtn) {
    const canUseIvm = !!window._wsRole && (typeof hasModule !== 'function' || hasModule('research_ivm'));
    ivmBtn.style.display = canUseIvm ? '' : 'none';
    if (canUseIvm) {
      ivmBtn.addEventListener('click', () => openIvmModal(score, pattern, classifyPattern(answers)));
    }
  }
  modal.addEventListener('click', e => { if(e.target === modal) document.getElementById('rc-done-btn').click(); });

  // Hide social sharing for clinical/educational workspace modes
  const _shareCard = document.getElementById('rc-wad-share-card');
  if (_shareCard) {
    const _clinicalMode = window._wsMode === 'researcher' || window._wsMode === 'institution' ||
      window._wsMode === 'pharmacist' || window._wsMode === 'clinician' || window._wsMode === 'student';
    if (_clinicalMode) _shareCard.style.display = 'none';
  }

  // AP2026 Share Card — copy message and LinkedIn share
  const _wadMsg = 'I just completed the MMAS-8 medication adherence assessment on Adherence Cartography\'s ATLAS platform — contributing to real-time global medication adherence research. #NotADoseADuration #MMAS8 #AdherenceCartography atlas.adherence.cc';
  const wadCopyBtn = document.getElementById('rc-wad-copy-btn');
  if (wadCopyBtn) {
    wadCopyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(_wadMsg).then(() => {
        wadCopyBtn.textContent = '✓ Copied!';
        setTimeout(() => { wadCopyBtn.textContent = '📋 Copy Message'; }, 2200);
      }).catch(() => {
        // Fallback for browsers without clipboard API
        const ta = document.createElement('textarea');
        ta.value = _wadMsg; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); wadCopyBtn.textContent = '✓ Copied!'; setTimeout(() => { wadCopyBtn.textContent = '📋 Copy Message'; }, 2200); } catch(e) {}
        document.body.removeChild(ta);
      });
    });
  }
  const wadLiBtn = document.getElementById('rc-wad-linkedin-btn');
  if (wadLiBtn) {
    const _liUrl = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent('https://atlas.adherence.cc') + '&summary=' + encodeURIComponent(_wadMsg);
    wadLiBtn.href = _liUrl;
  }
  const wadXBtn = document.getElementById('rc-wad-x-btn');
  if (wadXBtn) {
    const _xUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(_wadMsg);
    wadXBtn.href = _xUrl;
  }
  const wadFbBtn = document.getElementById('rc-wad-fb-btn');
  if (wadFbBtn) {
    const _fbUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent('https://atlas.adherence.cc') + '&quote=' + encodeURIComponent(_wadMsg);
    wadFbBtn.href = _fbUrl;
  }
  const wadIgBtn = document.getElementById('rc-wad-ig-btn');
  if (wadIgBtn) {
    // Instagram has no direct web share URL — copy message then open Instagram
    wadIgBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(_wadMsg).then(() => {
        wadIgBtn.textContent = '✓ Copied — paste on Instagram!';
        setTimeout(() => { wadIgBtn.textContent = '📸 Instagram'; }, 3000);
        window.open('https://www.instagram.com/', '_blank', 'noopener');
      }).catch(() => {
        window.open('https://www.instagram.com/', '_blank', 'noopener');
      });
    });
  }
  // Confetti for high adherence
  if (score >= 8) { setTimeout(launchConfetti, 300); }

  // ── AP2026 Check-in button logic ─────────────────────────────────────────
  document.querySelectorAll('.wad-checkin-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('selected')) return; // already checked in
      const msg     = btn.getAttribute('data-msg');
      const country = userLocation ? (userLocation.country || 'Unknown') : 'Unknown';
      const city    = userLocation ? (userLocation.city    || 'Unknown') : 'Unknown';
      const iso2    = userLocation ? (userLocation.country_code || '') : '';
      // Convert ISO2 to flag emoji
      const flag    = iso2.length === 2
        ? iso2.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397))
        : '🌐';
      const payload = {
        msg, country, city, flag, iso2,
        timestamp: Date.now(),
        workspace: currentWorkspace || 'EXPLORER'
      };
      // Write to Firebase
      try {
        database.ref('wad_checkins').push(payload);
      } catch(e) {}
      // Highlight selected, hide others, show confirmation
      document.querySelectorAll('.wad-checkin-opt').forEach(b => {
        b.style.display = b === btn ? '' : 'none';
      });
      btn.classList.add('selected');
      btn.style.pointerEvents = 'none';
      const doneEl = document.getElementById('rc-checkin-done');
      const flagEl = document.getElementById('rc-checkin-flag');
      if (doneEl) doneEl.style.display = 'block';
      if (flagEl) flagEl.textContent = flag + ' ' + country;
    });
  });

  // Render SOAP note if this was a ZOE session
  renderSoapOnResultModal();
  document.getElementById('rc-download-btn').addEventListener('click', () => {
    const now  = new Date();
    const date = now.toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});
    const high = cl => cl.scores ? cl.scores.filter(s=>s===8).length : 0; // not used here, local vars
    const highPct = Math.round((score/8)*100);
    // Build print card
    let existing = document.getElementById('print-result-card');
    if (existing) existing.remove();
    const card = document.createElement('div');
    card.id = 'print-result-card';
    card.style.display = 'none';
    const barHigh = score>=8?100:score>=6?Math.round((score/8)*100):0;
    const barColor = cat.color;
    card.innerHTML = `
      <div class="prc-brand">Adherence Cartography · ATLAS · MMAS-8 Assessment</div>
      <div class="prc-title">Personal Adherence Result</div>
      <div class="prc-sub">Assessment completed ${date} · Instrument: MMAS-8 v1.0 · Anonymous</div>
      <div class="prc-score" style="color:${cat.color}">${score.toFixed(2)}</div>
      <div class="prc-level" style="color:${cat.color}">${cat.label}</div>
      <div class="prc-pattern">${pattern}</div>
      <div class="prc-message">${message}</div>
      <div class="prc-bar-row">
        <div style="flex:${highPct};background:${cat.color};"></div>
        <div style="flex:${100-highPct};background:#f3f4f6;"></div>
      </div>
      <div class="prc-bar-label">${highPct}% of maximum adherence score (8.0)</div>
      <div class="prc-footer">
        <div>
          <div>Adherence Cartography · Adherence Inc. · 100 Oceangate, 12th Floor, Long Beach, CA 90802</div>
          <div>info@adherence.cc · www.adherence.cc</div>
          <div class="prc-ip">MMAS-8 is intellectual property of MMAR LLC. ATLAS is the intellectual property of Adherence Cartography. Permission required for use.</div>
        </div>
        <div class="prc-qr-placeholder" id="prc-qr-container" style="width:52px;height:52px;"></div>
      </div>`;
    document.body.appendChild(card);
    // Generate QR code for the print card
    _generateQR('prc-qr-container', 'https://www.adherence.cc', 52);
    document.body.classList.add('printing-result');
    window.print();
    setTimeout(() => { document.body.classList.remove('printing-result'); const c = document.getElementById('print-result-card'); if(c) c.remove(); }, 1000);
  });
}

/**
 * Filters the condition dropdown in real time based on a search string.
 * Shows only options (and their parent optgroups) whose text matches the query.
 * @param {string} query - Live search text from the filter input
 * @param {string} selectId - ID of the select element ('sdoh-condition' or 'map-sdoh-condition')
 */
function filterConditionDropdown(query, selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const q = query.trim().toLowerCase();
  // Use .hidden instead of display:none — Chrome ignores display:none on <option>/<optgroup>
  sel.querySelectorAll('optgroup').forEach(og => {
    let groupVisible = false;
    og.querySelectorAll('option').forEach(opt => {
      const match = !q || opt.textContent.toLowerCase().includes(q);
      opt.hidden = !match;
      if (match) groupVisible = true;
    });
    og.hidden = !groupVisible;
  });
  // Also handle top-level options (placeholder)
  sel.querySelectorAll(':scope > option').forEach(opt => {
    opt.hidden = !(!q || opt.textContent.toLowerCase().includes(q));
  });
}
