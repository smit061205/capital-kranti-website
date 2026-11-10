// The site's own words, Gujarati first, then Hindi and English (docs/website/DESIGN.md §5).
// Stories carry their own English and Hindi (the engine and the hourly run make them); these are the labels.
import type { Lang } from "./types.ts";

const WORDS = {
  gu: {
    skip: "મુખ્ય સમાચાર પર જાઓ", menu: "મેનુ", sections: "વિભાગો", search: "શોધો", close: "બંધ કરો", 
    pageNo: "પાનું", newer: "← નવા સમાચાર", older: "જૂના સમાચાર →", cities: "શહેર અને જિલ્લા", prevDay: "← અગાઉનો દિવસ", nextDay: "પછીનો દિવસ →",
    home: "હોમ", latest: "તાજા", latestTitle: "તાજા સમાચાર", allLatest: "બધા તાજા સમાચાર", archive: "જૂના અંકો",
    updated: "દિવસભર નવા સમાચાર", more: "વધુ", none: "આ વિભાગમાં હજી સમાચાર નથી.", back: "હોમ પર જાઓ",
    searchPlaceholder: "સમાચાર શોધો", found: "સમાચાર મળ્યા", notFound: "કોઈ સમાચાર ન મળ્યા. બીજો શબ્દ અજમાવો.", searchTitle: "શોધ",
    settings: "સેટિંગ્સ", size: "અક્ષરનું કદ", language: "ભાષા",
    services: "અમારી સેવાઓ", about: "અમારા વિશે",
    share: "WhatsApp પર મોકલો", shareShort: "મોકલો", copy: "લિંક કૉપી કરો", copied: "લિંક કૉપી થઈ", save: "સાચવો", saved: "સાચવ્યું",
    savedToast: "સમાચાર સાચવ્યા", unsavedToast: "સાચવેલામાંથી કાઢ્યા", savedTitle: "સાચવેલા સમાચાર", noneSaved: "હજી કોઈ સમાચાર સાચવ્યા નથી. સમાચારમાં “સાચવો” દબાવો.",
    seeSaved: "સાચવેલા જુઓ", savedOffline: "ઇન્ટરનેટ વિના પણ વાંચી શકાશે", remove: "કાઢો", savedCount: "સાચવેલા સમાચાર",
    installTitle: "કેપિટલ ક્રાંતિ તમારા ફોનમાં", installText: "હોમ સ્ક્રીન પરથી એક ટચમાં ખોલો, ઇન્ટરનેટ ધીમું હોય ત્યારે પણ.", installBtn: "ફોનમાં ઉમેરો", later: "પછી",
    installIos: "શેર બટન દબાવો (ચોરસમાંથી ઉપર જતું તીર), પછી “હોમ સ્ક્રીન પર ઉમેરો”.",
    installSteps: "ઉપર જમણે ⋮ દબાવો, પછી “હોમ સ્ક્રીન પર ઉમેરો”.",
    published: "પ્રકાશિત", updatedAt: "સુધારેલ", desk: "કેપિટલ ક્રાંતિ ડેસ્ક", editorTitle: "તંત્રી",
    aiNote: "આ સમાચાર AIએ નીચે આપેલા સ્રોતો પરથી લખ્યા છે; દરેક દાવો અને આંકડો તે સ્રોતો સાથે મેળવીને જ પ્રકાશિત થાય છે.", aiHow: "અમે કેવી રીતે ચકાસીએ છીએ",
    prefSource: "Google પર કેપિટલ ક્રાંતિને તમારો પસંદગીનો સ્રોત બનાવો", prefShort: "Google પર પસંદગીનો સ્રોત", by: "લેખક", min: "મિનિટનું વાંચન",
    srcTitle: "આ સમાચારનો સ્રોત", report: "ભૂલ દેખાય? અમને જણાવો", reportBody: "આ સમાચારમાં ભૂલ:", correction: "સુધારો", related: "આ વિભાગમાંથી વધુ", photo: "ફોટો",
    mostRead: "સૌથી વધુ વંચાયેલા", elsewhere: "બીજાં અખબારોમાં", elsewhereNote: "અન્ય વિશ્વસનીય સમાચાર સંસ્થાઓના આજના મુખ્ય સમાચાર; દરેક તેમના પોતાના પાને ખૂલશે.", moreNews: "વધુ સમાચાર", editorPage: "સંપાદકનું પાનું", moreOn: "આ વિષય પર વધુ", 
    issue: "અંક", storiesCount: "સમાચાર", noIssues: "હજી કોઈ જૂનો અંક નથી.",
    brk: "તાજા સમાચાર", alertsOn: "મોટા સમાચારની સૂચના મેળવો", alertsAreOn: "સૂચના ચાલુ છે", alertsOff: "બંધ કરો", alertsNote: "દિવસમાં વધુમાં વધુ ચાર, ફક્ત ખરેખર મોટા સમાચાર વખતે.", alertsDenied: "આ ફોને સૂચનાની પરવાનગી બંધ રાખી છે: ફોનના સેટિંગમાં આ સાઇટને પરવાનગી આપો.", alertsIos: "iPhone પર સૂચના માટે: નીચે શેર બટન દબાવી \u201cહોમ સ્ક્રીન પર ઉમેરો\u201d, પછી ત્યાંથી સાઇટ ખોલીને અહીં દબાવો.", alertsFailed: "સૂચના ચાલુ ન થઈ. થોડી વાર પછી ફરી પ્રયાસ કરો.", joinTitle: "કેપિટલ ક્રાંતિ WhatsApp પર", joinText: "રોજ સાંજે દિવસના મુખ્ય સમાચાર, સીધા તમારા ફોનમાં.", joinSoon: "ચેનલ ટૂંક સમયમાં",
    noEnglish: "", topics: "વિષયો",
    f1: "કેપિટલ ક્રાંતિ", f2: "વિભાગો", f3: "મેળવો", f4: "નિયમો", fAbout: "અમારા વિશે", fPolicy: "સંપાદકીય નીતિ", fHow: "અમે સમાચાર કેવી રીતે ચકાસીએ છીએ",
    fFix: "સુધારા", fContact: "સંપર્ક", fTerms: "ઉપયોગના નિયમો", fPrivacy: "ગોપનીયતા", fRss: "RSS", classifieds: "વર્ગીકૃત જાહેરાતો", adsShort: "જાહેરાતો", adsNone: "હમણાં કોઈ જાહેરાત નથી.", adsNote: "જાહેરાત આપવા માટે અમારો સંપર્ક કરો.", pdf: "PDF ડાઉનલોડ કરો", pdfShort: "PDF", todayPaper: "છેલ્લો અંક", adsUntil: "સુધી", advertise: "જાહેરાત આપો",
    toTop: "ઉપર જાઓ", live: "હમણાં", readAlso: "આ પણ વાંચો", zoom: "ફોટો મોટો જુઓ", close2: "બંધ કરો", inBrief: "ટૂંકમાં", of: "માંથી", live2: "તરત પરિણામ",
    empty: "હજી સમાચાર મુકાયા નથી. આજે સાંજે ફરી જુઓ.", notFoundTitle: "આ પાનું મળ્યું નહીં", notFoundText: "આ સમાચાર કે પાનું અહીં નથી. હોમ પરથી શોધો.",
  },
  en: {
    skip: "Skip to the news", menu: "Menu", sections: "Sections", search: "Search", close: "Close", 
    pageNo: "Page", newer: "← Newer stories", older: "Older stories →", cities: "Cities and districts", prevDay: "← The day before", nextDay: "The day after →",
    home: "Home", latest: "Latest", latestTitle: "Latest news", allLatest: "All the latest", archive: "Past issues",
    updated: "News all day", more: "More", none: "No stories in this section yet.", back: "Go to the home page",
    searchPlaceholder: "Search the news", found: "stories found", notFound: "No stories found. Try another word.", searchTitle: "Search",
    settings: "Settings", size: "Text size", language: "Language",
    services: "Our services", about: "About us",
    share: "Send on WhatsApp", shareShort: "Send", copy: "Copy link", copied: "Link copied", save: "Save", saved: "Saved",
    savedToast: "Story saved", unsavedToast: "Removed from saved", savedTitle: "Saved stories", noneSaved: "No saved stories yet. Press “Save” on a story.",
    seeSaved: "See saved", savedOffline: "You can read it without internet too", remove: "Remove", savedCount: "saved stories",
    installTitle: "Capital Kranti on your phone", installText: "Open it in one tap from your home screen, even on a slow connection.", installBtn: "Add to phone", later: "Later",
    installIos: "Tap the Share button (a square with an arrow pointing up), then “Add to Home Screen”.",
    installSteps: "Tap ⋮ at the top right, then “Add to Home screen”.",
    published: "Published", updatedAt: "Updated", desk: "Capital Kranti desk", editorTitle: "Editor",
    aiNote: "This story was written by AI from the sources listed below; every claim and number in it was checked against them before it went up.", aiHow: "How we check",
    prefSource: "Make Capital Kranti your preferred source on Google", prefShort: "Preferred source on Google", by: "By", min: "min read",
    srcTitle: "Where this story comes from", report: "Spotted a mistake? Tell us", reportBody: "A mistake in this story:", correction: "Correction", related: "More from this section", photo: "Photo",
    mostRead: "Most read", elsewhere: "Elsewhere in the news", elsewhereNote: "Today’s main headlines from other trusted news outlets; each opens on their own site.", moreNews: "More news", editorPage: "Editor’s page", moreOn: "More on this", 
    issue: "Issue", storiesCount: "stories", noIssues: "No past issues yet.",
    brk: "Breaking", alertsOn: "Get alerts for big news", alertsAreOn: "Alerts are on", alertsOff: "Turn off", alertsNote: "Four a day at most, only for really big news.", alertsDenied: "This phone has blocked alerts from the site: allow them in the phone’s settings.", alertsIos: "For alerts on an iPhone: tap Share, then \u201cAdd to Home Screen\u201d, open the site from there and tap here.", alertsFailed: "Alerts couldn’t be turned on. Try again in a while.", joinTitle: "Capital Kranti on WhatsApp", joinText: "The day’s main news every evening, straight to your phone.", joinSoon: "Channel coming soon",
    noEnglish: "This story’s English version isn’t ready yet, so it is shown in Gujarati.", topics: "Topics",
    f1: "Capital Kranti", f2: "Sections", f3: "Get it", f4: "Policies", fAbout: "About us", fPolicy: "Editorial policy", fHow: "How we check the news",
    fFix: "Corrections", fContact: "Contact", fTerms: "Terms of use", fPrivacy: "Privacy", fRss: "RSS", classifieds: "Classified ads", adsShort: "Classifieds", adsNone: "No ads right now.", adsNote: "To place an ad, get in touch with us.", pdf: "Download the PDF", pdfShort: "PDF", todayPaper: "Latest issue", adsUntil: "until", advertise: "Advertise with us",
    toTop: "Back to top", live: "Just in", readAlso: "Read also", zoom: "View the photo larger", close2: "Close", inBrief: "In brief", of: "of", live2: "Results",
    empty: "No stories yet. Look again this evening.", notFoundTitle: "Page not found", notFoundText: "This story or page isn’t here. Try the home page.",
  },
  hi: {
    skip: "मुख्य समाचार पर जाएँ", menu: "मेन्यू", sections: "विभाग", search: "खोजें", close: "बंद करें", 
    pageNo: "पेज", newer: "← नए समाचार", older: "पुराने समाचार →", cities: "शहर और ज़िले", prevDay: "← पिछला दिन", nextDay: "अगला दिन →",
    home: "होम", latest: "ताज़ा", latestTitle: "ताज़ा समाचार", allLatest: "सभी ताज़ा समाचार", archive: "पुराने अंक",
    updated: "दिन भर नए समाचार", more: "और", none: "इस विभाग में अभी कोई समाचार नहीं है।", back: "होम पर जाएँ",
    searchPlaceholder: "समाचार खोजें", found: "समाचार मिले", notFound: "कोई समाचार नहीं मिला। कोई दूसरा शब्द आज़माएँ।", searchTitle: "खोज",
    settings: "सेटिंग्स", size: "अक्षर का आकार", language: "भाषा",
    services: "हमारी सेवाएँ", about: "हमारे बारे में",
    share: "WhatsApp पर भेजें", shareShort: "भेजें", copy: "लिंक कॉपी करें", copied: "लिंक कॉपी हो गया", save: "सहेजें", saved: "सहेजा गया",
    savedToast: "समाचार सहेजा गया", unsavedToast: "सहेजे गए से हटाया गया", savedTitle: "सहेजे गए समाचार", noneSaved: "अभी कोई समाचार सहेजा नहीं गया है। समाचार में “सहेजें” दबाएँ।",
    seeSaved: "सहेजे गए देखें", savedOffline: "बिना इंटरनेट के भी पढ़ सकेंगे", remove: "हटाएँ", savedCount: "सहेजे गए समाचार",
    installTitle: "कैपिटल क्रांति आपके फ़ोन में", installText: "होम स्क्रीन से एक टच में खोलें, धीमे इंटरनेट पर भी।", installBtn: "फ़ोन में जोड़ें", later: "बाद में",
    installIos: "शेयर बटन दबाएँ (चौकोर से ऊपर जाता तीर), फिर “होम स्क्रीन में जोड़ें”।",
    installSteps: "ऊपर दाईं ओर ⋮ दबाएँ, फिर “होम स्क्रीन में जोड़ें”।",
    published: "प्रकाशित", updatedAt: "अपडेट", desk: "कैपिटल क्रांति डेस्क", editorTitle: "संपादक",
    aiNote: "यह समाचार AI ने नीचे दिए स्रोतों से लिखा है; इसका हर दावा और आँकड़ा उन स्रोतों से मिलाकर ही प्रकाशित किया गया है।", aiHow: "हम कैसे जाँचते हैं",
    prefSource: "Google पर कैपिटल क्रांति को अपना पसंदीदा स्रोत बनाएँ", prefShort: "Google पर पसंदीदा स्रोत", by: "लेखक", min: "मिनट का पाठ",
    srcTitle: "इस समाचार का स्रोत", report: "कोई ग़लती दिखी? हमें बताएँ", reportBody: "इस समाचार में ग़लती:", correction: "सुधार", related: "इस विभाग से और", photo: "फ़ोटो",
    mostRead: "सबसे ज़्यादा पढ़े गए", elsewhere: "दूसरे अख़बारों में", elsewhereNote: "दूसरे विश्वसनीय समाचार संस्थानों की आज की मुख्य ख़बरें; हर एक उनकी अपनी साइट पर खुलेगी।", moreNews: "और समाचार", editorPage: "संपादक का पन्ना", moreOn: "इस विषय पर और", 
    issue: "अंक", storiesCount: "समाचार", noIssues: "अभी कोई पुराना अंक नहीं है।",
    brk: "ताज़ा ख़बर", alertsOn: "बड़ी ख़बरों की सूचना पाएँ", alertsAreOn: "सूचना चालू है", alertsOff: "बंद करें", alertsNote: "दिन में ज़्यादा से ज़्यादा चार, सिर्फ़ सचमुच बड़ी ख़बर पर।", alertsDenied: "इस फ़ोन ने सूचनाएँ रोक रखी हैं: फ़ोन की सेटिंग में इस साइट को अनुमति दें।", alertsIos: "iPhone पर सूचना के लिए: शेयर दबाएँ, फिर \u201cहोम स्क्रीन में जोड़ें\u201d, वहाँ से साइट खोलकर यहाँ दबाएँ।", alertsFailed: "सूचना चालू नहीं हुई। थोड़ी देर बाद फिर कोशिश करें।", joinTitle: "कैपिटल क्रांति WhatsApp पर", joinText: "हर शाम दिन के मुख्य समाचार, सीधे आपके फ़ोन में।", joinSoon: "चैनल जल्द ही",
    noEnglish: "इस समाचार का हिंदी संस्करण अभी तैयार नहीं है, इसलिए यह गुजराती में दिखाया गया है।", topics: "विषय",
    f1: "कैपिटल क्रांति", f2: "विभाग", f3: "पाएँ", f4: "नियम", fAbout: "हमारे बारे में", fPolicy: "संपादकीय नीति", fHow: "हम समाचार कैसे जाँचते हैं",
    fFix: "सुधार", fContact: "संपर्क", fTerms: "उपयोग के नियम", fPrivacy: "गोपनीयता", fRss: "RSS", classifieds: "वर्गीकृत विज्ञापन", adsShort: "विज्ञापन", adsNone: "अभी कोई विज्ञापन नहीं है।", adsNote: "विज्ञापन देने के लिए हमसे संपर्क करें।", pdf: "PDF डाउनलोड करें", pdfShort: "PDF", todayPaper: "ताज़ा अंक", adsUntil: "तक", advertise: "विज्ञापन दें",
    toTop: "ऊपर जाएँ", live: "अभी-अभी", readAlso: "यह भी पढ़ें", zoom: "फ़ोटो बड़ा देखें", close2: "बंद करें", inBrief: "संक्षेप में", of: "में से", live2: "परिणाम",
    empty: "अभी कोई समाचार नहीं है। थोड़ी देर बाद फिर देखें।", notFoundTitle: "यह पन्ना नहीं मिला", notFoundText: "यह समाचार या पन्ना यहाँ नहीं है। होम से खोजें।",
  },
} as const;

export type WordKey = keyof (typeof WORDS)["gu"];
export const t = (lang: Lang, key: WordKey): string => WORDS[lang][key];

/** A path in the reader's language: Gujarati at the root, English under /en, Hindi under /hi. */
export const href = (lang: Lang, path: string) => (lang === "gu" ? path : path === "/" ? `/${lang}` : `/${lang}${path}`);
/** The same page in the other language. */
export const otherLang = (lang: Lang): Lang => (lang === "gu" ? "en" : "gu");

/** the letter on the text-size buttons, in each language's script (10 Nov: English and Hindi pages showed "અ") */
export const SIZE_LETTER: Record<Lang, string> = { gu: "અ", en: "A", hi: "अ" };
