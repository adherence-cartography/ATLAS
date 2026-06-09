import sys
import re
import json
import shutil

sys.stdout.reconfigure(encoding='utf-8')

# MAP question translations for all 30 languages
MAP_TRANSLATIONS = {
    "en": {
        "q1": "Are there times when you forget to take your medications?",
        "q2": "In the past two weeks, have there been times when you chose to skip a dose — for example, because of side effects, cost, or feeling better?",
        "q3": "In the past two weeks, did you reduce your dose or stop a medication on your own, without telling your doctor or care team, because of how it was making you feel?",
        "q4": "When your daily routine changes (for example, when traveling, working different hours, or staying away from home), do you find it hard to keep up with your medications?",
        "q5": "Were you able to take your last dose as directed?",
        "q6": "When you start feeling better or your symptoms improve, do you ever think about reducing or pausing your medication on your own?",
        "q7": "Does keeping up with your medication routine feel like a big challenge in your everyday life?",
        "q8": "In a typical week, how often do you have trouble taking all your medications as prescribed?"
    },
    "af": {
        "q1": "Is daar tye wanneer jy vergeet om jou medikasie te neem?",
        "q2": "In die afgelope twee weke, was daar tye wanneer jy gekies het om 'n dosis oor te slaan — byvoorbeeld vanweë newe-effekte, koste, of omdat jy beter gevoel het?",
        "q3": "In die afgelope twee weke, het jy jou dosis verminder of 'n medikasie op jou eie gestaak, sonder om jou dokter of sorgspan in te lig, as gevolg van hoe dit jou laat voel het?",
        "q4": "Wanneer jou daaglikse roetine verander (byvoorbeeld wanneer jy reis, verskillende ure werk, of weg van die huis af is), vind jy dit moeilik om jou medikasie by te hou?",
        "q5": "Was jy in staat om jou laaste dosis soos voorgeskryf te neem?",
        "q6": "Wanneer jy begin beter voel of jou simptome verbeter, dink jy ooit om jou medikasie op jou eie te verminder of te onderbreek?",
        "q7": "Voel dit vir jou soos 'n groot uitdaging om jou medikasie-roetine in jou alledaagse lewe by te hou?",
        "q8": "In 'n tipiese week, hoe dikwels het jy probleme om al jou medikasie soos voorgeskryf te neem?"
    },
    "sq": {
        "q1": "A ka herë kur harroni të merrni ilaçet tuaja?",
        "q2": "Gjatë dy javëve të fundit, ka pasur herë kur keni zgjedhur të kapërceni një dozë — për shembull, për shkak të efekteve anësore, kostos, ose sepse ndiheshit më mirë?",
        "q3": "Gjatë dy javëve të fundit, a keni reduktuar dozën tuaj ose keni ndaluar një ilaç vetë, pa i treguar mjekut ose ekipit tuaj të kujdesit, për shkak të mënyrës se si ju bënte të ndiheshit?",
        "q4": "Kur rutina juaj e përditshme ndryshon (për shembull, kur udhëtoni, punoni orë të ndryshme, ose qëndroni larg shtëpisë), e gjeni të vështirë të vazhdoni me ilaçet tuaja?",
        "q5": "A keni qenë në gjendje të merrni dozën tuaj të fundit sipas udhëzimeve?",
        "q6": "Kur filloni të ndiheni më mirë ose simptomat tuaja përmirësohen, a mendoni ndonjëherë për reduktimin ose ndërprerjen e ilaçit tuaj vetë?",
        "q7": "A ndihet si një sfidë e madhe për ju të mbani rutinën e ilaçeve tuaja në jetën tuaj të përditshme?",
        "q8": "Gjatë një jave tipike, sa shpesh keni vështirësi në marrjen e të gjitha ilaçeve tuaja sipas recetës?"
    },
    "ar": {
        "q1": "هل هناك أوقات تنسى فيها تناول أدويتك؟",
        "q2": "في الأسبوعين الماضيين، هل كانت هناك أوقات اخترت فيها تخطي جرعة — على سبيل المثال، بسبب الآثار الجانبية، أو التكلفة، أو الشعور بتحسن؟",
        "q3": "في الأسبوعين الماضيين، هل قللت جرعتك أو أوقفت دواءً بنفسك، دون إخبار طبيبك أو فريق رعايتك، بسبب الطريقة التي كان يجعلك تشعر بها؟",
        "q4": "عندما تتغير روتينك اليومي (على سبيل المثال، عند السفر، أو العمل لساعات مختلفة، أو البعد عن المنزل)، هل تجد صعوبة في مواكبة أدويتك؟",
        "q5": "هل تمكنت من أخذ جرعتك الأخيرة كما هو موجه؟",
        "q6": "عندما تبدأ في الشعور بتحسن أو تتحسن أعراضك، هل تفكر أحيانًا في تقليل دوائك أو إيقافه بنفسك؟",
        "q7": "هل يبدو الحفاظ على روتين دوائك تحديًا كبيرًا في حياتك اليومية؟",
        "q8": "في أسبوع عادي، كم مرة تواجه صعوبة في تناول جميع أدويتك كما هو موصوف؟"
    },
    "bn": {
        "q1": "এমন কি কোনো সময় আছে যখন আপনি আপনার ওষুধ নিতে ভুলে যান?",
        "q2": "গত দুই সপ্তাহে, এমন কি কোনো সময় ছিল যখন আপনি একটি ডোজ এড়িয়ে যাওয়ার সিদ্ধান্ত নিয়েছিলেন — উদাহরণস্বরূপ, পার্শ্বপ্রতিক্রিয়া, খরচ, বা ভালো অনুভব করার কারণে?",
        "q3": "গত দুই সপ্তাহে, আপনি কি আপনার ডাক্তার বা যত্ন দলকে না জানিয়ে নিজে থেকে আপনার ডোজ কমিয়েছেন বা কোনো ওষুধ বন্ধ করেছেন, কারণ এটি আপনাকে কেমন অনুভব করাচ্ছিল?",
        "q4": "যখন আপনার দৈনন্দিন রুটিন পরিবর্তিত হয় (উদাহরণস্বরূপ, ভ্রমণের সময়, বিভিন্ন ঘণ্টা কাজ করার সময়, বা বাড়ি থেকে দূরে থাকার সময়), আপনি কি আপনার ওষুধ চালিয়ে যেতে কঠিন মনে করেন?",
        "q5": "আপনি কি নির্দেশ অনুযায়ী আপনার শেষ ডোজ নিতে পেরেছিলেন?",
        "q6": "যখন আপনি ভালো অনুভব করতে শুরু করেন বা আপনার উপসর্গ উন্নত হয়, আপনি কি কখনো নিজে থেকে আপনার ওষুধ কমানো বা বিরতি দেওয়ার কথা ভাবেন?",
        "q7": "আপনার দৈনন্দিন জীবনে আপনার ওষুধের রুটিন বজায় রাখা কি একটি বড় চ্যালেঞ্জ মনে হয়?",
        "q8": "একটি সাধারণ সপ্তাহে, আপনি কতবার নির্ধারিত সমস্ত ওষুধ নিতে সমস্যায় পড়েন?"
    },
    "zh": {
        "q1": "有时候你会忘记服药吗？",
        "q2": "在过去两周内，是否有时候你选择跳过一次剂量——例如，因为副作用、费用或感觉好转？",
        "q3": "在过去两周内，你是否自行减少剂量或停止用药，未告知你的医生或护理团队，因为它对你的感受有影响？",
        "q4": "当你的日常作息改变时（例如旅行、工作时间不同或在外过夜），你是否觉得难以坚持按时服药？",
        "q5": "你是否按照指示服用了最后一次剂量？",
        "q6": "当你开始感觉好转或症状改善时，你是否有时会考虑自行减少或暂停用药？",
        "q7": "在日常生活中，坚持服药计划是否让你感到很大的挑战？",
        "q8": "在典型的一周中，你多久会有一次难以按处方服用所有药物的情况？"
    },
    "zh-TW": {
        "q1": "有時候你會忘記服藥嗎？",
        "q2": "在過去兩週內，是否有時候你選擇跳過一次劑量——例如，因為副作用、費用或感覺好轉？",
        "q3": "在過去兩週內，你是否自行減少劑量或停止用藥，未告知你的醫生或護理團隊，因為它對你的感受有影響？",
        "q4": "當你的日常作息改變時（例如旅行、工作時間不同或在外過夜），你是否覺得難以堅持按時服藥？",
        "q5": "你是否按照指示服用了最後一次劑量？",
        "q6": "當你開始感覺好轉或症狀改善時，你是否有時會考慮自行減少或暫停用藥？",
        "q7": "在日常生活中，堅持服藥計劃是否讓你感到很大的挑戰？",
        "q8": "在典型的一週中，你多久會有一次難以按處方服用所有藥物的情況？"
    },
    "hr": {
        "q1": "Ima li trenutaka kada zaboravljate uzeti lijekove?",
        "q2": "U protekla dva tjedna, je li bilo trenutaka kada ste se odlučili preskočiti dozu — na primjer, zbog nuspojava, troška ili jer ste se osjećali bolje?",
        "q3": "U protekla dva tjedna, jeste li sami smanjili dozu ili prestali uzimati lijek, bez obavještavanja liječnika ili tima za skrb, zbog toga kako vas je to tjerao da se osjećate?",
        "q4": "Kada se vaša dnevna rutina promijeni (na primjer, pri putovanju, radu u drugačijim satima ili boravku izvan doma), smatrate li teško pratiti uzimanje lijekova?",
        "q5": "Jeste li mogli uzeti posljednju dozu prema uputama?",
        "q6": "Kada počnete osjećati poboljšanje ili se vaši simptomi poboljšaju, razmišljate li ikad o vlastitom smanjenju ili pauziranju lijeka?",
        "q7": "Čini li vam se praćenje rasporeda uzimanja lijekova velikim izazovom u svakodnevnom životu?",
        "q8": "U tipičnom tjednu, koliko često imate poteškoća s uzimanjem svih propisanih lijekova?"
    },
    "da": {
        "q1": "Er der tidspunkter, hvor du glemmer at tage dine mediciner?",
        "q2": "I løbet af de seneste to uger, har der været tidspunkter, hvor du valgte at springe en dosis over — for eksempel på grund af bivirkninger, omkostninger eller fordi du havde det bedre?",
        "q3": "I løbet af de seneste to uger, reducerede du din dosis eller stoppede du en medicin på egen hånd, uden at fortælle din læge eller plejeteam, på grund af hvordan det fik dig til at have det?",
        "q4": "Når din daglige rutine ændrer sig (for eksempel når du rejser, arbejder på andre tidspunkter eller opholder dig væk fra hjemmet), finder du det svært at holde trit med din medicin?",
        "q5": "Var du i stand til at tage din sidste dosis som foreskrevet?",
        "q6": "Når du begynder at have det bedre eller dine symptomer forbedres, tænker du nogensinde på at reducere eller pause din medicin på egen hånd?",
        "q7": "Føles det som en stor udfordring at holde trit med din medicineringsrutine i dit daglige liv?",
        "q8": "I en typisk uge, hvor ofte har du svært ved at tage alle dine mediciner som foreskrevet?"
    },
    "nl": {
        "q1": "Zijn er momenten waarop je vergeet je medicijnen te nemen?",
        "q2": "In de afgelopen twee weken, waren er momenten waarop je ervoor koos een dosis over te slaan — bijvoorbeeld vanwege bijwerkingen, kosten of omdat je je beter voelde?",
        "q3": "In de afgelopen twee weken, heb je zelf je dosis verminderd of een medicijn gestopt, zonder je arts of zorgteam te informeren, vanwege hoe het je liet voelen?",
        "q4": "Wanneer je dagelijkse routine verandert (bijvoorbeeld tijdens reizen, het werken op andere uren of verblijven buiten de deur), vind je het dan moeilijk om je medicijnen bij te houden?",
        "q5": "Was je in staat je laatste dosis in te nemen zoals voorgeschreven?",
        "q6": "Wanneer je je beter begint te voelen of je symptomen verbeteren, denk je er dan ooit aan zelf je medicatie te verminderen of te pauzeren?",
        "q7": "Voelt het bijhouden van je medicatieroutine als een grote uitdaging in je dagelijks leven?",
        "q8": "In een typische week, hoe vaak heb je moeite om alle medicijnen in te nemen zoals voorgeschreven?"
    },
    "fi": {
        "q1": "Onko hetkiä, jolloin unohdat ottaa lääkkeesi?",
        "q2": "Viimeisen kahden viikon aikana, on ollut hetkiä, jolloin olet päättänyt jättää annoksen väliin — esimerkiksi sivuvaikutusten, kustannusten tai paremman olon takia?",
        "q3": "Viimeisen kahden viikon aikana, oletko itse vähentänyt annosta tai lopettanut lääkityksen kertomatta siitä lääkärillesi tai hoitotiimillesi, sen takia miten se sai sinut tuntemaan?",
        "q4": "Kun päivittäinen rutiinisi muuttuu (esimerkiksi matkustaessasi, tehdessäsi eri tunteja töitä tai ollessa poissa kotoa), onko sinulla vaikeuksia pitää kiinni lääkityksestäsi?",
        "q5": "Pystyitkö ottamaan viimeisen annoksesi ohjeiden mukaan?",
        "q6": "Kun alat tuntea olosi paremmaksi tai oireesi lievittyvät, ajatteletko koskaan vähentää tai keskeyttää lääkitystäsi omatoimisesti?",
        "q7": "Tuntuuko lääkitysrutiinistasi kiinnipitäminen suurelta haasteelta jokapäiväisessä elämässäsi?",
        "q8": "Tyypillisellä viikolla, kuinka usein sinulla on vaikeuksia ottaa kaikki lääkkeesi määräyksen mukaan?"
    },
    "fr": {
        "q1": "Y a-t-il des moments où vous oubliez de prendre vos médicaments ?",
        "q2": "Au cours des deux dernières semaines, y a-t-il eu des moments où vous avez choisi de sauter une dose — par exemple, en raison d'effets secondaires, de coût, ou parce que vous vous sentiez mieux ?",
        "q3": "Au cours des deux dernières semaines, avez-vous réduit votre dose ou arrêté un médicament de votre propre chef, sans en informer votre médecin ou votre équipe soignante, en raison de la façon dont il vous faisait vous sentir ?",
        "q4": "Lorsque votre routine quotidienne change (par exemple, lorsque vous voyagez, travaillez à des heures différentes ou êtes loin de chez vous), trouvez-vous difficile de suivre vos médicaments ?",
        "q5": "Avez-vous pu prendre votre dernière dose comme prescrit ?",
        "q6": "Lorsque vous commencez à vous sentir mieux ou que vos symptômes s'améliorent, pensez-vous parfois à réduire ou à interrompre votre médicament de votre propre chef ?",
        "q7": "Le fait de maintenir votre routine médicamenteuse vous semble-t-il un grand défi dans votre vie quotidienne ?",
        "q8": "Dans une semaine typique, combien de fois avez-vous du mal à prendre tous vos médicaments comme prescrits ?"
    },
    "de": {
        "q1": "Gibt es Momente, in denen Sie vergessen, Ihre Medikamente einzunehmen?",
        "q2": "Haben Sie in den letzten zwei Wochen manchmal eine Dosis ausgelassen — zum Beispiel wegen Nebenwirkungen, Kosten oder weil Sie sich besser gefühlt haben?",
        "q3": "Haben Sie in den letzten zwei Wochen Ihre Dosis eigenmächtig reduziert oder ein Medikament abgesetzt, ohne Ihren Arzt oder Ihr Pflegeteam zu informieren, wegen des Einflusses auf Ihr Befinden?",
        "q4": "Wenn sich Ihre tägliche Routine ändert (zum Beispiel beim Reisen, anderen Arbeitszeiten oder wenn Sie nicht zu Hause sind), fällt es Ihnen dann schwer, Ihre Medikamente regelmäßig einzunehmen?",
        "q5": "Konnten Sie Ihre letzte Dosis wie verordnet einnehmen?",
        "q6": "Wenn Sie sich besser fühlen oder Ihre Symptome sich verbessern, denken Sie manchmal daran, Ihr Medikament eigenmächtig zu reduzieren oder zu pausieren?",
        "q7": "Fühlt es sich wie eine große Herausforderung an, Ihre Medikationsroutine in Ihrem Alltag aufrechtzuerhalten?",
        "q8": "Wie oft haben Sie in einer typischen Woche Schwierigkeiten, alle Ihre Medikamente wie verschrieben einzunehmen?"
    },
    "el": {
        "q1": "Υπάρχουν στιγμές που ξεχνάτε να πάρετε τα φάρμακά σας;",
        "q2": "Τις τελευταίες δύο εβδομάδες, υπήρχαν στιγμές που επιλέξατε να παραλείψετε μια δόση — για παράδειγμα, λόγω παρενεργειών, κόστους ή επειδή αισθανόσαστε καλύτερα;",
        "q3": "Τις τελευταίες δύο εβδομάδες, μειώσατε τη δόση σας ή σταματήσατε ένα φάρμακο μόνοι σας, χωρίς να ενημερώσετε τον γιατρό ή την ομάδα φροντίδας σας, λόγω του πώς σας έκανε να αισθάνεστε;",
        "q4": "Όταν αλλάζει η καθημερινή σας ρουτίνα (για παράδειγμα, όταν ταξιδεύετε, εργάζεστε διαφορετικές ώρες ή είστε μακριά από το σπίτι), δυσκολεύεστε να συνεχίσετε με τα φάρμακά σας;",
        "q5": "Μπορέσατε να πάρετε την τελευταία σας δόση όπως σας υποδείχθηκε;",
        "q6": "Όταν αρχίζετε να αισθάνεστε καλύτερα ή τα συμπτώματά σας βελτιώνονται, σκέφτεστε ποτέ να μειώσετε ή να σταματήσετε το φάρμακό σας μόνοι σας;",
        "q7": "Σας φαίνεται η διατήρηση της φαρμακευτικής σας ρουτίνας μεγάλη πρόκληση στην καθημερινή σας ζωή;",
        "q8": "Σε μια τυπική εβδομάδα, πόσο συχνά δυσκολεύεστε να πάρετε όλα σας τα φάρμακα όπως σας έχουν συνταγογραφηθεί;"
    },
    "hi": {
        "q1": "क्या ऐसे समय होते हैं जब आप अपनी दवाएं लेना भूल जाते हैं?",
        "q2": "पिछले दो हफ्तों में, क्या ऐसे समय थे जब आपने एक खुराक छोड़ने का चुनाव किया — उदाहरण के लिए, दुष्प्रभावों, लागत, या बेहतर महसूस करने के कारण?",
        "q3": "पिछले दो हफ्तों में, क्या आपने अपने डॉक्टर या देखभाल टीम को बताए बिना, खुद ही अपनी खुराक कम की या कोई दवा बंद की, इस कारण कि यह आपको कैसा महसूस करा रही थी?",
        "q4": "जब आपकी दैनिक दिनचर्या बदलती है (उदाहरण के लिए, यात्रा करते समय, अलग-अलग घंटे काम करते समय, या घर से दूर रहते समय), तो क्या आपको अपनी दवाएं लेते रहना कठिन लगता है?",
        "q5": "क्या आप अपनी अंतिम खुराक निर्देशानुसार लेने में सक्षम थे?",
        "q6": "जब आप बेहतर महसूस करने लगते हैं या आपके लक्षण सुधरते हैं, तो क्या आप कभी खुद ही अपनी दवा कम करने या रोकने के बारे में सोचते हैं?",
        "q7": "क्या आपकी दवा की दिनचर्या को बनाए रखना आपके रोजमर्रा के जीवन में एक बड़ी चुनौती की तरह लगता है?",
        "q8": "एक सामान्य सप्ताह में, आपको कितनी बार सभी दवाएं निर्धारित अनुसार लेने में कठिनाई होती है?"
    },
    "id": {
        "q1": "Apakah ada saat-saat ketika Anda lupa minum obat?",
        "q2": "Dalam dua minggu terakhir, apakah ada saat-saat ketika Anda memilih untuk melewatkan dosis — misalnya, karena efek samping, biaya, atau merasa lebih baik?",
        "q3": "Dalam dua minggu terakhir, apakah Anda mengurangi dosis atau menghentikan obat sendiri, tanpa memberi tahu dokter atau tim perawatan Anda, karena bagaimana obat itu membuat Anda merasa?",
        "q4": "Ketika rutinitas harian Anda berubah (misalnya, saat bepergian, bekerja dengan jam yang berbeda, atau tinggal jauh dari rumah), apakah Anda merasa sulit untuk tetap mengonsumsi obat?",
        "q5": "Apakah Anda dapat mengonsumsi dosis terakhir sesuai petunjuk?",
        "q6": "Ketika Anda mulai merasa lebih baik atau gejala Anda membaik, apakah Anda pernah berpikir untuk mengurangi atau menghentikan sementara obat Anda sendiri?",
        "q7": "Apakah menjaga rutinitas obat Anda terasa seperti tantangan besar dalam kehidupan sehari-hari Anda?",
        "q8": "Dalam seminggu yang khas, seberapa sering Anda mengalami kesulitan minum semua obat sesuai resep?"
    },
    "it": {
        "q1": "Ci sono momenti in cui dimentica di prendere i suoi farmaci?",
        "q2": "Nelle ultime due settimane, ci sono stati momenti in cui ha scelto di saltare una dose — ad esempio, a causa di effetti collaterali, costi o perché si sentiva meglio?",
        "q3": "Nelle ultime due settimane, ha ridotto la sua dose o interrotto un farmaco da solo, senza informare il suo medico o il team di cura, a causa di come la stava facendo sentire?",
        "q4": "Quando la sua routine quotidiana cambia (ad esempio, quando viaggia, lavora a orari diversi o è lontano da casa), trova difficile mantenere l'assunzione dei farmaci?",
        "q5": "È riuscito a prendere l'ultima dose come prescritto?",
        "q6": "Quando inizia a sentirsi meglio o i suoi sintomi migliorano, pensa mai di ridurre o interrompere il farmaco da solo?",
        "q7": "Mantenere la routine dei farmaci le sembra una grande sfida nella sua vita quotidiana?",
        "q8": "In una settimana tipica, quante volte ha difficoltà a prendere tutti i suoi farmaci come prescritto?"
    },
    "ja": {
        "q1": "薬を飲むのを忘れることがありますか？",
        "q2": "過去2週間で、副作用、費用、または体調が改善したなどの理由で、服用をスキップすることを選んだことはありましたか？",
        "q3": "過去2週間で、薬の感じ方が原因で、医師やケアチームに告げずに、自分で用量を減らしたり薬を中止したりしましたか？",
        "q4": "日常のルーティンが変わるとき（例えば、旅行中、異なる時間帯の勤務、または自宅を離れているとき）、薬の服用を継続することが難しいと感じますか？",
        "q5": "指示された通りに最後の用量を服用することができましたか？",
        "q6": "体調が良くなったり症状が改善したとき、自分で薬を減らしたり中断したりすることを考えることがありますか？",
        "q7": "毎日の服薬ルーティンを維持することが、日常生活において大きな課題に感じますか？",
        "q8": "典型的な1週間で、処方された通りにすべての薬を服用するのに問題を抱えることは何回ありますか？"
    },
    "ko": {
        "q1": "약을 먹는 것을 잊는 때가 있습니까?",
        "q2": "지난 2주 동안, 예를 들어 부작용, 비용, 또는 상태가 나아진 느낌 때문에 복용을 건너뛰기로 선택한 때가 있었습니까?",
        "q3": "지난 2주 동안, 약이 당신에게 미치는 영향 때문에 의사나 의료팀에 알리지 않고 스스로 용량을 줄이거나 약을 중단한 적이 있습니까?",
        "q4": "일상 생활이 변할 때(예: 여행 중, 다른 시간에 근무할 때, 또는 집을 떠나 있을 때), 약을 계속 복용하기가 어렵다고 느낍니까?",
        "q5": "지시대로 마지막 용량을 복용할 수 있었습니까?",
        "q6": "상태가 나아지거나 증상이 호전될 때, 스스로 약을 줄이거나 중단하는 것을 생각한 적이 있습니까?",
        "q7": "약 복용 루틴을 유지하는 것이 일상생활에서 큰 도전처럼 느껴집니까?",
        "q8": "전형적인 한 주 동안, 처방된 대로 모든 약을 복용하는 데 어려움을 겪는 빈도는 얼마나 됩니까?"
    },
    "ms": {
        "q1": "Adakah ada masa-masa apabila anda terlupa untuk mengambil ubat anda?",
        "q2": "Dalam dua minggu yang lalu, adakah ada masa-masa apabila anda memilih untuk melangkau dos — contohnya, kerana kesan sampingan, kos, atau berasa lebih baik?",
        "q3": "Dalam dua minggu yang lalu, adakah anda mengurangkan dos anda atau menghentikan ubat sendiri, tanpa memberitahu doktor atau pasukan penjagaan anda, kerana bagaimana ia membuatkan anda berasa?",
        "q4": "Apabila rutin harian anda berubah (contohnya, semasa mengembara, bekerja pada waktu yang berbeza, atau berada jauh dari rumah), adakah anda merasa sukar untuk mengekalkan pengambilan ubat anda?",
        "q5": "Adakah anda dapat mengambil dos terakhir anda seperti yang diarahkan?",
        "q6": "Apabila anda mula berasa lebih baik atau gejala anda bertambah baik, adakah anda pernah berfikir untuk mengurangkan atau menjeda ubat anda sendiri?",
        "q7": "Adakah mengekalkan rutin ubat anda terasa seperti cabaran besar dalam kehidupan seharian anda?",
        "q8": "Dalam minggu yang biasa, berapa kerap anda menghadapi masalah mengambil semua ubat anda seperti yang ditetapkan?"
    },
    "pt": {
        "q1": "Há momentos em que você esquece de tomar seus medicamentos?",
        "q2": "Nas últimas duas semanas, houve momentos em que você escolheu pular uma dose — por exemplo, por causa de efeitos colaterais, custo ou por estar se sentindo melhor?",
        "q3": "Nas últimas duas semanas, você reduziu sua dose ou parou um medicamento por conta própria, sem informar seu médico ou equipe de saúde, por causa de como ele estava lhe fazendo sentir?",
        "q4": "Quando sua rotina diária muda (por exemplo, quando viaja, trabalha em horários diferentes ou fica longe de casa), você acha difícil manter o uso dos seus medicamentos?",
        "q5": "Você conseguiu tomar sua última dose conforme orientado?",
        "q6": "Quando você começa a se sentir melhor ou seus sintomas melhoram, você já pensou em reduzir ou pausar sua medicação por conta própria?",
        "q7": "Manter a rotina de medicamentos parece um grande desafio na sua vida diária?",
        "q8": "Em uma semana típica, com que frequência você tem dificuldade em tomar todos os seus medicamentos como prescritos?"
    },
    "ru": {
        "q1": "Бывают ли моменты, когда вы забываете принять лекарства?",
        "q2": "За последние две недели были ли случаи, когда вы намеренно пропускали приём дозы — например, из-за побочных эффектов, стоимости или потому что чувствовали себя лучше?",
        "q3": "За последние две недели вы самостоятельно снижали дозу или прекращали приём препарата, не сообщая об этом врачу или медицинскому персоналу, из-за того, как он на вас воздействовал?",
        "q4": "Когда ваш распорядок дня меняется (например, во время поездок, при работе в другое время или вдали от дома), вам трудно придерживаться режима приёма лекарств?",
        "q5": "Смогли ли вы принять последнюю дозу в соответствии с предписанием?",
        "q6": "Когда вы начинаете чувствовать себя лучше или симптомы улучшаются, думаете ли вы порой о том, чтобы самостоятельно снизить дозу или сделать перерыв в приёме лекарства?",
        "q7": "Кажется ли вам поддержание режима приёма лекарств серьёзным испытанием в повседневной жизни?",
        "q8": "В типичную неделю, как часто вам бывает трудно принимать все лекарства строго по назначению?"
    },
    "es": {
        "q1": "¿Hay momentos en los que olvida tomar sus medicamentos?",
        "q2": "En las últimas dos semanas, ¿hubo momentos en que eligió saltarse una dosis — por ejemplo, debido a efectos secundarios, costo o porque se sentía mejor?",
        "q3": "En las últimas dos semanas, ¿redujo su dosis o suspendió un medicamento por su cuenta, sin informar a su médico o equipo de atención, debido a cómo le hacía sentir?",
        "q4": "Cuando su rutina diaria cambia (por ejemplo, cuando viaja, trabaja en horarios diferentes o está lejos de casa), ¿le resulta difícil mantenerse al día con sus medicamentos?",
        "q5": "¿Pudo tomar su última dosis como se le indicó?",
        "q6": "Cuando empieza a sentirse mejor o sus síntomas mejoran, ¿alguna vez piensa en reducir o pausar su medicación por su cuenta?",
        "q7": "¿Mantener su rutina de medicación le parece un gran desafío en su vida diaria?",
        "q8": "En una semana típica, ¿con qué frecuencia tiene dificultades para tomar todos sus medicamentos como se los recetaron?"
    },
    "sw": {
        "q1": "Je, kuna nyakati ambapo unasahau kuchukua dawa zako?",
        "q2": "Katika wiki mbili zilizopita, je, kulikuwa na nyakati ambapo ulichagua kuruka dozi — kwa mfano, kwa sababu ya madhara, gharama, au kuhisi vizuri zaidi?",
        "q3": "Katika wiki mbili zilizopita, je, ulipunguza dozi yako au kusimamisha dawa peke yako, bila kumwambia daktari wako au timu ya huduma, kwa sababu ya jinsi ilivyokufanya uhisi?",
        "q4": "Wakati utaratibu wako wa kila siku unabadilika (kwa mfano, unaposafariri, kufanya kazi kwa masaa tofauti, au kukaa mbali na nyumba), je, unapata ugumu wa kuendelea na dawa zako?",
        "q5": "Je, uliweza kuchukua dozi yako ya mwisho kama ilivyoelekezwa?",
        "q6": "Unapojisikia vizuri zaidi au dalili zako zinapoboresha, je, unafikiria wakati mwingine kupunguza au kusimamisha dawa yako peke yako?",
        "q7": "Je, kudumisha utaratibu wako wa dawa kunajisikia kama changamoto kubwa katika maisha yako ya kila siku?",
        "q8": "Katika wiki ya kawaida, mara ngapi una tatizo la kuchukua dawa zako zote kama ilivyoagizwa?"
    },
    "sv": {
        "q1": "Finns det tillfällen när du glömmer att ta dina mediciner?",
        "q2": "Under de senaste två veckorna, har det funnits tillfällen när du valde att hoppa över en dos — till exempel på grund av biverkningar, kostnad eller för att du mådde bättre?",
        "q3": "Under de senaste två veckorna, minskade du din dos eller slutade du med ett läkemedel på egen hand, utan att berätta för din läkare eller vårdteam, på grund av hur det fick dig att känna?",
        "q4": "När din dagliga rutin förändras (till exempel när du reser, arbetar olika tider eller befinner dig borta hemifrån), tycker du att det är svårt att hålla dig till din medicinering?",
        "q5": "Kunde du ta din senaste dos som anvisad?",
        "q6": "När du börjar känna dig bättre eller dina symtom förbättras, tänker du ibland på att minska eller pausa din medicin på egen hand?",
        "q7": "Känns det som en stor utmaning att hålla din medicineringsrutin i ditt dagliga liv?",
        "q8": "Under en typisk vecka, hur ofta har du svårt att ta alla dina mediciner som föreskrivits?"
    },
    "tr": {
        "q1": "İlaçlarınızı almayı unuttuğunuz zamanlar oluyor mu?",
        "q2": "Son iki haftada, örneğin yan etkiler, maliyet veya kendinizi daha iyi hissettiğiniz için bir dozu atlamayı seçtiğiniz zamanlar oldu mu?",
        "q3": "Son iki haftada, ilacın sizi nasıl hissettirdiği nedeniyle doktorunuza veya bakım ekibinize haber vermeden kendi başınıza dozunuzu azalttınız veya bir ilacı kestiniz mi?",
        "q4": "Günlük rutininiz değiştiğinde (örneğin seyahat ederken, farklı saatlerde çalışırken veya evden uzakta kalırken), ilaçlarınıza devam etmeyi zor buluyor musunuz?",
        "q5": "Son dozunuzu belirtildiği şekilde alabildiniz mi?",
        "q6": "Kendinizi daha iyi hissetmeye başladığınızda veya semptomlarınız iyileştiğinde, ilaçlarınızı kendi başınıza azaltmayı ya da duraklatmayı düşünüyor musunuz?",
        "q7": "İlaç rutininizi sürdürmek günlük yaşamınızda büyük bir zorluk gibi mi geliyor?",
        "q8": "Tipik bir haftada, reçete edildiği gibi tüm ilaçlarınızı almakta ne sıklıkla güçlük çekiyorsunuz?"
    },
    "uk": {
        "q1": "Чи бувають моменти, коли ви забуваєте прийняти ліки?",
        "q2": "За останні два тижні чи були моменти, коли ви свідомо пропускали дозу — наприклад, через побічні ефекти, вартість або покращення самопочуття?",
        "q3": "За останні два тижні ви самостійно зменшували дозу або припиняли прийом ліків, не повідомляючи лікаря або медичну команду, через те, як вони на вас впливали?",
        "q4": "Коли ваш щоденний розпорядок змінюється (наприклад, під час подорожей, роботи в інший час або перебування вдалині від дому), чи важко вам дотримуватись режиму прийому ліків?",
        "q5": "Чи вдалось вам прийняти останню дозу відповідно до призначення?",
        "q6": "Коли ви починаєте почуватися краще або симптоми покращуються, чи думаєте ви іноді про самостійне зменшення дози або перерву в прийомі ліків?",
        "q7": "Чи здається вам підтримання режиму прийому ліків серйозним викликом у повсякденному житті?",
        "q8": "У типовий тиждень, як часто у вас виникають труднощі з прийомом усіх ліків відповідно до призначення?"
    },
    "ur": {
        "q1": "کیا ایسے اوقات ہوتے ہیں جب آپ اپنی دوائیں لینا بھول جاتے ہیں؟",
        "q2": "پچھلے دو ہفتوں میں، کیا ایسے اوقات تھے جب آپ نے جان بوجھ کر ایک خوراک چھوڑنے کا انتخاب کیا — مثلاً، ضمنی اثرات، قیمت، یا بہتر محسوس کرنے کی وجہ سے؟",
        "q3": "پچھلے دو ہفتوں میں، کیا آپ نے اپنے ڈاکٹر یا نگہداشت کی ٹیم کو بتائے بغیر، خود ہی اپنی خوراک کم کی یا کوئی دوا بند کی، اس وجہ سے کہ یہ آپ کو کیسا محسوس کرا رہی تھی؟",
        "q4": "جب آپ کا روزانہ کا معمول بدلتا ہے (مثلاً، سفر کے دوران، مختلف اوقات میں کام کرتے وقت، یا گھر سے دور رہتے وقت)، تو کیا آپ کو اپنی دوائیں جاری رکھنا مشکل لگتا ہے؟",
        "q5": "کیا آپ اپنی آخری خوراک ہدایت کے مطابق لینے میں کامیاب ہوئے؟",
        "q6": "جب آپ بہتر محسوس کرنے لگتے ہیں یا آپ کی علامات میں بہتری آتی ہے، تو کیا آپ کبھی خود ہی اپنی دوا کم کرنے یا روکنے کے بارے میں سوچتے ہیں؟",
        "q7": "کیا آپ کی دوا کا معمول برقرار رکھنا آپ کی روزمرہ کی زندگی میں ایک بڑا چیلنج محسوس ہوتا ہے؟",
        "q8": "ایک عام ہفتے میں، آپ کو کتنی بار تجویز کردہ تمام دوائیں لینے میں دشواری ہوتی ہے؟"
    },
    "vi": {
        "q1": "Có những lúc bạn quên uống thuốc không?",
        "q2": "Trong hai tuần qua, có những lúc bạn chọn bỏ qua một liều — ví dụ, vì tác dụng phụ, chi phí, hoặc cảm thấy khỏe hơn không?",
        "q3": "Trong hai tuần qua, bạn có tự giảm liều hoặc ngừng thuốc mà không báo cho bác sĩ hoặc đội ngũ chăm sóc, vì cách thuốc ảnh hưởng đến cảm giác của bạn không?",
        "q4": "Khi thói quen hàng ngày của bạn thay đổi (ví dụ, khi đi du lịch, làm việc theo giờ khác, hoặc ở xa nhà), bạn có thấy khó duy trì việc uống thuốc không?",
        "q5": "Bạn có thể uống liều cuối cùng theo hướng dẫn không?",
        "q6": "Khi bạn bắt đầu cảm thấy tốt hơn hoặc các triệu chứng cải thiện, bạn có bao giờ nghĩ đến việc tự giảm hoặc tạm dừng thuốc không?",
        "q7": "Việc duy trì lịch uống thuốc có cảm thấy như một thách thức lớn trong cuộc sống hàng ngày của bạn không?",
        "q8": "Trong một tuần điển hình, bạn có bao nhiêu lần gặp khó khăn trong việc uống tất cả các thuốc theo đơn?"
    },
    "tl": {
        "q1": "May mga pagkakataon bang nakalilimutan mong inumin ang iyong mga gamot?",
        "q2": "Sa nakalipas na dalawang linggo, may mga pagkakataon bang pinili mong laktawan ang isang dosis — halimbawa, dahil sa mga side effect, gastos, o pakiramdam na mas malusog ka na?",
        "q3": "Sa nakalipas na dalawang linggo, nabawasan mo ba ang iyong dosis o itinigil ang isang gamot nang mag-isa, nang hindi sinasabi sa iyong doktor o koponan ng pag-aalaga, dahil sa epekto nito sa iyong pakiramdam?",
        "q4": "Kapag nagbabago ang iyong pang-araw-araw na gawain (halimbawa, kapag naglalakbay, nagtatrabaho sa ibang oras, o nanatili sa labas ng bahay), nahihirapan ka bang mapanatili ang pag-inom ng iyong mga gamot?",
        "q5": "Nagawa mo bang inumin ang iyong huling dosis ayon sa tagubilin?",
        "q6": "Kapag nagsimula kang makaramdam ng mas magaling o ang iyong mga sintomas ay gumaling, nag-iisip ka bang baguhin o ihinto ang iyong gamot nang mag-isa?",
        "q7": "Ang pagpapanatili ng iyong rutina sa paginom ng gamot ba ay nakakaramdam ng isang malaking hamon sa iyong pang-araw-araw na buhay?",
        "q8": "Sa isang tipikal na linggo, ilang beses kang nahihirapang inumin ang lahat ng iyong mga gamot ayon sa reseta?"
    }
}

ZOE_SYSTEM_NEW = '''You are ZOE, a compassionate AI health guide conducting a MAP (Multidimensional Adherence Parameters) medication adherence assessment for the Adherence Cartography ATLAS platform (Philip Morisky, Founder & Chief Optimus, Adherence Inc.).

MAP QUESTIONS — ask in order, exactly as written:
Q1: Are there times when you forget to take your medications?
Q2: In the past two weeks, have there been times when you chose to skip a dose — for example, because of side effects, cost, or feeling better?
Q3: In the past two weeks, did you reduce your dose or stop a medication on your own, without telling your doctor or care team, because of how it was making you feel?
Q4: When your daily routine changes (for example, when traveling, working different hours, or staying away from home), do you find it hard to keep up with your medications?
Q5: Were you able to take your last dose as directed?
Q6: When you start feeling better or your symptoms improve, do you ever think about reducing or pausing your medication on your own?
Q7: Does keeping up with your medication routine feel like a big challenge in your everyday life?
Q8: In a typical week, how often do you have trouble taking all your medications as prescribed?

SCORING:
Q1-Q4, Q6, Q7: YES=0, NO=1
Q5: YES=1, NO=0 (reversed — taking last dose as directed is good)
Q8: Never=1, Rarely=0.75, Sometimes=0.5, Often=0.25, All of the time=0

YOUR ROLE:
- Listen to natural speech. Extract the clinical answer even from long, nuanced responses.
- Respond with genuine warmth — one brief compassionate acknowledgment before moving on.
- You are a caring human guide, not a clinical form.
- If the patient sounds distressed or shares something difficult, acknowledge it gently.
- If the answer is ambiguous, ask one short clarifying question.
- Never explain the scoring system to the patient.
- Keep responses concise: 1-2 sentences maximum.
- After Q8, close with: "If you have questions about your medications, or if something is making it hard to take them as prescribed, please talk to your doctor, nurse, or pharmacist. Your honest answers help us find the best ways to support you."

OUTPUT — respond ONLY with valid JSON, no preamble, no markdown:
{"extracted_answer":"yes|no|never|rarely|sometimes|often|always|unclear","score_value":0-1_or_null,"compassionate_response":"1-2 warm sentences","needs_clarification":true_or_false,"clarification_prompt":"only if needs_clarification"}'''

ZOE_QUESTIONS_NEW = [
    "Are there times when you forget to take your medications?",
    "In the past two weeks, have there been times when you chose to skip a dose \u2014 for example, because of side effects, cost, or feeling better?",
    "In the past two weeks, did you reduce your dose or stop a medication on your own, without telling your doctor or care team, because of how it was making you feel?",
    "When your daily routine changes (for example, when traveling, working different hours, or staying away from home), do you find it hard to keep up with your medications?",
    "Were you able to take your last dose as directed?",
    "When you start feeling better or your symptoms improve, do you ever think about reducing or pausing your medication on your own?",
    "Does keeping up with your medication routine feel like a big challenge in your everyday life?",
    "In a typical week, how often do you have trouble taking all your medications as prescribed? You can say: never, rarely, sometimes, often, or all of the time."
]

SRC = "C:/Users/philm/documents/atlas_v8/cloudbase/assess.html"
BAK = SRC + ".bak"

print("Reading file...")
with open(SRC, "r", encoding="utf-8") as f:
    content = f.read()

print("Creating backup...")
shutil.copy2(SRC, BAK)
print(f"  Backup: {BAK}")

# --- Extract and parse MMAS_QUESTIONS ---
pattern = r'(const MMAS_QUESTIONS\s*=\s*)(\{[\s\S]*?\});'
m = re.search(pattern, content)
if not m:
    print("ERROR: Could not find MMAS_QUESTIONS in file!")
    sys.exit(1)

prefix = m.group(1)
json_str = m.group(2)

print("Parsing MMAS_QUESTIONS JSON...")
try:
    data = json.loads(json_str)
except json.JSONDecodeError as e:
    print(f"ERROR parsing JSON: {e}")
    sys.exit(1)

langs_found = list(data.keys())
print(f"  Languages found: {len(langs_found)}: {langs_found}")

# --- Update q1-q8 for all languages ---
updated = 0
missing_translations = []
for lang_code, lang_data in data.items():
    if lang_code in MAP_TRANSLATIONS:
        t = MAP_TRANSLATIONS[lang_code]
        lang_data["q1"] = t["q1"]
        lang_data["q2"] = t["q2"]
        lang_data["q3"] = t["q3"]
        lang_data["q4"] = t["q4"]
        lang_data["q5"] = t["q5"]
        lang_data["q6"] = t["q6"]
        lang_data["q7"] = t["q7"]
        lang_data["q8"] = t["q8"]
        updated += 1
    else:
        missing_translations.append(lang_code)
        print(f"  WARNING: No translation for '{lang_code}' — keeping original questions")

print(f"  Updated q1-q8 for {updated} languages")
if missing_translations:
    print(f"  Missing translations: {missing_translations}")

# Re-serialize compactly
new_json = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
new_block = prefix + new_json + ';'

content = content[:m.start()] + new_block + content[m.end():]
print("  MMAS_QUESTIONS block replaced in content")

# --- Update ZOE_SYSTEM ---
zoe_sys_pattern = r'(const ZOE_SYSTEM\s*=\s*`)([^`]*?)(`\s*;)'
zs = re.search(zoe_sys_pattern, content, re.DOTALL)
if zs:
    content = content[:zs.start()] + 'const ZOE_SYSTEM = `' + ZOE_SYSTEM_NEW + '`;' + content[zs.end():]
    print("  ZOE_SYSTEM updated")
else:
    print("  WARNING: ZOE_SYSTEM not found — skipping")

# --- Update ZOE_QUESTIONS ---
zoe_q_pattern = r'(const ZOE_QUESTIONS\s*=\s*\[)([^\]]*?)(\]\s*;)'
zq = re.search(zoe_q_pattern, content, re.DOTALL)
if zq:
    items = ',\n  '.join(json.dumps(q, ensure_ascii=False) for q in ZOE_QUESTIONS_NEW)
    new_zq = f'const ZOE_QUESTIONS = [\n  {items}\n];'
    content = content[:zq.start()] + new_zq + content[zq.end():]
    print("  ZOE_QUESTIONS updated")
else:
    print("  WARNING: ZOE_QUESTIONS not found — skipping")

# --- Write back ---
print("Writing updated file...")
with open(SRC, "w", encoding="utf-8") as f:
    f.write(content)
print("  Done.")

# --- Verification ---
print("\n=== VERIFICATION ===")
with open(SRC, "r", encoding="utf-8") as f:
    verify = f.read()

m2 = re.search(r'const MMAS_QUESTIONS\s*=\s*(\{[\s\S]*?\});', verify)
if m2:
    d2 = json.loads(m2.group(1))
    en_q1 = d2.get("en", {}).get("q1", "NOT FOUND")
    print(f"English q1: {en_q1}")
    expected = "Are there times when you forget to take your medications?"
    if en_q1 == expected:
        print("  PASS: English q1 matches expected MAP question")
    else:
        print(f"  FAIL: Expected: {expected}")
    print(f"  en q1_yes still present: {'q1_yes' in d2.get('en', {})}")
    print(f"  en q8_never still present: {'q8_never' in d2.get('en', {})}")

print(f"\nSummary: {updated} of {len(langs_found)} languages updated with MAP questions")
print("Backup saved to:", BAK)
