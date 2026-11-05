// The pages a news site needs and Google News looks for (ROADMAP §4): who we
// are, how we work, how to reach us, and the rules. Plain words, in Gujarati, English and Hindi.
import { notFound } from "next/navigation";
import type { Lang } from "../lib/types.ts";
import { PAPER } from "../lib/site.ts";
import { num } from "../lib/format.ts";
import Frame from "../components/Frame.tsx";

type Page = { title: string; paras: string[] };
const contact = (lang: Lang) => ({
  gu: `ઈમેલ: ${PAPER.email} · મોબાઇલ: ${num(PAPER.phone, "gu")} · ફોન અને ફેક્સ: ${num(PAPER.landline, "gu")}`,
  en: `Email: ${PAPER.email} · Mobile: ${PAPER.phone} · Phone and fax: ${PAPER.landline}`,
  hi: `ईमेल: ${PAPER.email} · मोबाइल: ${PAPER.phone} · फ़ोन और फ़ैक्स: ${PAPER.landline}`,
})[lang];
// from the paper's own old website (capitalkranti.co.in, 2 Nov)
const offices = {
  gu: ["તંત્રી: પાર્થ ઠક્કર", "કાર્યાલય: કેપિટલ ક્રાંતિ દૈનિક, ૯૦૫/૫/બી, જીઆઈડીસી એન્જિનિયરિંગ એસ્ટેટ, સેક્ટર ૨૮, ગાંધીનગર, ગુજરાત – ૩૮૨૦૨૮", "પત્રવ્યવહાર: કેપિટલ ક્રાંતિ દૈનિક, બ્લોક નં. ૩૨/૪, ‘જીએચ’ ટાઇપ, સેક્ટર ૨૮, ગાંધીનગર, ગુજરાત – ૩૮૨૦૨૮"],
  en: ["Editor: Parth Thakkar", "Office: Capital Kranti Daily, 905/5/B, GIDC Engineering Estate, Sector 28, Gandhinagar, Gujarat 382028", "Correspondence: Capital Kranti Daily, Block No. 32/4, ‘GH’ Type, Sector 28, Gandhinagar, Gujarat 382028"],
  hi: ["संपादक: पार्थ ठक्कर", "कार्यालय: कैपिटल क्रांति दैनिक, 905/5/बी, जीआईडीसी इंजीनियरिंग एस्टेट, सेक्टर 28, गांधीनगर, गुजरात 382028", "पत्राचार: कैपिटल क्रांति दैनिक, ब्लॉक नं. 32/4, ‘जीएच’ टाइप, सेक्टर 28, गांधीनगर, गुजरात 382028"],
};

export const POLICY: Record<string, Record<Lang, Page>> = {
  about: {
    gu: { title: "અમારા વિશે", paras: [
      `કેપિટલ ક્રાંતિ ગાંધીનગરથી પ્રકાશિત થતું ગુજરાતી દૈનિક છે (RNI ${PAPER.rni}). ગુજરાતના પાટનગરથી, ${num(PAPER.founded, "gu")}થી, અમે સરકાર, ખેતી, અર્થતંત્ર, શિક્ષણ અને સમાજના સમાચાર વાચકો સુધી પહોંચાડીએ છીએ.`,
      "“મને સર્વ સ્વતંત્રતાઓની સાથોસાથ જાણવાની, બોલવાની અને વિવેકબુદ્ધિ અનુસાર મુક્ત રીતે દલીલ કરવાની સ્વતંત્રતા આપો.” – જોન મિલ્ટન",
      "અમે ન્યાય, પારદર્શકતા, જાણવાની સ્વતંત્રતા અને અભિપ્રાયો, વિચારો અને સંવેદનાઓને અભિવ્યક્ત કરવાની સ્વતંત્રતામાં માનીએ છીએ.",
      "અમે ગાંધીનગરનાં સૌથી શરૂઆતનાં અખબારોમાંનાં એક છીએ અને ખાસ વાચકોનો વિશાળ વર્ગ ધરાવીએ છીએ. ગાંધીનગર, અમદાવાદ, બનાસકાંઠા, સાબરકાંઠા, પાટણ અને મહેસાણા જિલ્લા સુધી અમે ફેલાયેલા છીએ, અને સૌરાષ્ટ્રનો પણ મોટો ભાગ આવરી લઈએ છીએ.",
      "જાહેરાતો પ્રકાશિત કરવા માટે ગુજરાત સરકાર અને ભારત સરકાર (ડીએવીપી) દ્વારા માન્ય દૈનિક તરીકે, અમે ગુજરાત અને બીજાં રાજ્યોનાં વ્યવસાયિક ગૃહોની પસંદ છીએ, અને સમગ્ર ભારતની પબ્લિક રિલેશન એજન્સીઓ સાથે જોડાયેલા છીએ.",
      "આ વેબસાઇટ પર દિવસભર તાજા સમાચાર, દરરોજ સાંજે છપાયેલા પેપરના સમાચાર અને જૂના અંકો મળે છે. સમાચાર ગુજરાતીમાં, અને દેશ-વિદેશના સમાચાર હિંદી અને અંગ્રેજીમાં પણ વાંચી શકાય છે.",
      "અમારું સૂત્ર છે: સમાજનો વિવેકપૂર્ણ દ્રષ્ટિકોણ. અમે હકીકતો આપીએ છીએ, સ્રોત જણાવીએ છીએ અને ભૂલ થાય તો ખુલ્લેઆમ સુધારીએ છીએ.",
      `માલિકી: કેપિટલ ક્રાંતિના માલિક, મુદ્રક અને પ્રકાશક ${PAPER.editor.gu} છે; તે કોઈ રાજકીય પક્ષ કે બીજી કંપનીની માલિકીનું નથી.`,
      `અમારી ટીમ: તંત્રી ${PAPER.editor.gu}. વેબસાઇટ અને તેની ટેક્નોલોજી: ${PAPER.tech.map((x) => x.gu).join(" અને ")}.`,
    ] },
    en: { title: "About us", paras: [
      `Capital Kranti is a Gujarati daily newspaper published from Gandhinagar (RNI ${PAPER.rni}). From Gujarat’s capital, since ${PAPER.founded}, it has brought readers the news of government, farming, the economy, education and society.`,
      "“Give me the liberty to know, to utter, and to argue freely according to conscience, above all liberties.” – John Milton",
      "We believe in justice, transparency, and the liberty to know and to express views, ideas and emotions.",
      "We are one of the oldest newspapers in Gandhinagar, with a large number of exclusive readers. We are spread across the districts of Gandhinagar, Ahmedabad, Banaskantha, Sabarkantha, Patan and Mehsana, and also cover a significant part of Saurashtra.",
      "Empanelled with the Government of Gujarat and the Government of India (DAVP) for publishing advertisements, we are a popular choice among commercial houses from Gujarat and other states, and are connected to public relations agencies across India.",
      "This website carries the latest news through the day, the stories of each evening’s printed paper and past issues. Stories are in Gujarati; national and world stories are also in Hindi and English.",
      "Our motto is “a thoughtful view of society”. We give the facts, say where they come from, and correct mistakes openly.",
      `Ownership: Capital Kranti is owned, printed and published by ${PAPER.editor.en}; it is not owned by any political party or other company.`,
      `Our team: ${PAPER.editor.en}, Editor. The website and its technology: ${PAPER.tech.map((x) => x.en).join(" and ")}.`,
    ] },
    hi: { title: "हमारे बारे में", paras: [
      `कैपिटल क्रांति गांधीनगर से प्रकाशित होने वाला गुजराती दैनिक है (RNI ${PAPER.rni})। गुजरात की राजधानी से, ${PAPER.founded} से, हम सरकार, खेती, अर्थव्यवस्था, शिक्षा और समाज के समाचार पाठकों तक पहुँचाते हैं।`,
      "“मुझे सभी स्वतंत्रताओं से ऊपर जानने, बोलने और विवेक के अनुसार मुक्त रूप से तर्क करने की स्वतंत्रता दो।” – जॉन मिल्टन",
      "हम न्याय, पारदर्शिता, जानने की स्वतंत्रता और विचारों, मतों तथा भावनाओं को व्यक्त करने की स्वतंत्रता में विश्वास रखते हैं।",
      "हम गांधीनगर के सबसे पुराने अख़बारों में से एक हैं और हमारे ख़ास पाठकों का बड़ा वर्ग है। हम गांधीनगर, अहमदाबाद, बनासकांठा, साबरकांठा, पाटण और महेसाणा ज़िलों तक फैले हैं और सौराष्ट्र के भी बड़े हिस्से को कवर करते हैं।",
      "विज्ञापन प्रकाशित करने के लिए गुजरात सरकार और भारत सरकार (डीएवीपी) से मान्य दैनिक के रूप में, हम गुजरात और दूसरे राज्यों के व्यावसायिक घरानों की पसंद हैं और पूरे भारत की जनसंपर्क एजेंसियों से जुड़े हैं।",
      "इस वेबसाइट पर दिन भर ताज़ा समाचार, हर शाम छपे अख़बार के समाचार और पुराने अंक मिलते हैं। समाचार गुजराती में हैं; देश और विदेश के समाचार हिंदी और अंग्रेज़ी में भी पढ़े जा सकते हैं।",
      "हमारा सूत्र है: समाज का विवेकपूर्ण दृष्टिकोण। हम तथ्य देते हैं, स्रोत बताते हैं और ग़लती होने पर खुलकर सुधारते हैं।",
      `स्वामित्व: कैपिटल क्रांति के स्वामी, मुद्रक और प्रकाशक ${PAPER.editor.hi} हैं; यह किसी राजनीतिक दल या दूसरी कंपनी के स्वामित्व में नहीं है।`,
      `हमारी टीम: संपादक ${PAPER.editor.hi}। वेबसाइट और उसकी तकनीक: ${PAPER.tech.map((x) => x.hi).join(" और ")}।`,
    ] },
  },
  "editorial-policy": {
    gu: { title: "સંપાદકીય નીતિ", paras: [
      "સ્રોત: અમારા સમાચાર સત્તાવાર સ્રોતો (પત્ર સૂચના કાર્યાલય – PIB, મંત્રાલયો, રિઝર્વ બેંક, ગુજરાત સરકાર, વિદેશની સરકારો અને આંતરરાષ્ટ્રીય સંસ્થાઓ) અને જાણીતાં, વિશ્વસનીય સમાચાર માધ્યમો પરથી છે. દરેક સમાચારના અંતે તેના બધા સ્રોત લિંક સાથે આપેલા છે.",
      "અમારા શબ્દોમાં: સમાચાર અમે અમારા શબ્દોમાં લખીએ છીએ; બીજા માધ્યમોનું લખાણ કે ફોટા લેતા નથી.",
      "ફોટા: ફોટા સરકારી સ્રોતો, વિકિમીડિયા કૉમન્સ (મુક્ત લાઇસન્સવાળા ફોટા) અને Unsplash તથા Pexels જેવી ફોટો લાઇબ્રેરીમાંથી લેવાય છે, અને દરેક ફોટાની નીચે તેનો સ્રોત લખેલો હોય છે. દોરેલાં કે AIથી બનાવેલાં ચિત્રો અમે વાપરતા નથી.",
      "સંવેદનશીલ સમાચાર: મૃત્યુ, અકસ્માત, ગુના કે કોઈ વ્યક્તિ સામેના આક્ષેપો જેવા સમાચાર માત્ર સ્રોતોમાં જે કહેવાયું હોય તે જ જણાવે છે, અને તેની સાથે જૂના ફોટા મુકાતા નથી.",
      "જાહેરાત અને સમાચાર અલગ: પૈસા લઈને સમાચાર છાપવામાં આવતા નથી. જાહેરાત હંમેશાં જાહેરાત તરીકે ઓળખાશે.",
    ] },
    en: { title: "Editorial policy", paras: [
      "Sources: our stories come from official sources (the Press Information Bureau – PIB, ministries, the Reserve Bank, the Gujarat government, foreign governments and international bodies) and from established, trusted news outlets. Every story ends with all its sources and links.",
      "In our own words: we write stories in our own words and never take other outlets’ text or photos.",
      "Photos: photos come from government sources, Wikimedia Commons (freely licensed photos) and photo libraries such as Unsplash and Pexels, and each one is credited under it. We never use drawn or AI-made pictures.",
      "Sensitive stories: deaths, accidents, crime and allegations against named people say only what the sources say, and carry no file photos.",
      "News is not for sale: we do not publish news for payment. Advertising is always marked as advertising.",
    ] },
    hi: { title: "संपादकीय नीति", paras: [
      "स्रोत: हमारे समाचार आधिकारिक स्रोतों (पत्र सूचना कार्यालय – PIB, मंत्रालय, रिज़र्व बैंक, गुजरात सरकार, विदेशी सरकारें और अंतरराष्ट्रीय संस्थाएँ) और जाने-माने, भरोसेमंद समाचार माध्यमों से हैं। हर समाचार के अंत में उसके सभी स्रोत लिंक के साथ दिए गए हैं।",
      "अपने शब्दों में: हम समाचार अपने शब्दों में लिखते हैं; दूसरे माध्यमों का लेख या फ़ोटो नहीं लेते।",
      "फ़ोटो: फ़ोटो सरकारी स्रोतों, विकिमीडिया कॉमन्स (मुक्त लाइसेंस वाले फ़ोटो) और Unsplash व Pexels जैसी फ़ोटो लाइब्रेरी से लिए जाते हैं, और हर फ़ोटो के नीचे उसका स्रोत लिखा होता है। हम बनाए हुए या AI से बने चित्र इस्तेमाल नहीं करते।",
      "संवेदनशील समाचार: मृत्यु, दुर्घटना, अपराध या किसी व्यक्ति पर आरोप जैसे समाचार वही बताते हैं जो स्रोतों में कहा गया है, और उनके साथ पुरानी तस्वीरें नहीं लगाई जातीं।",
      "समाचार बिकाऊ नहीं: पैसे लेकर समाचार नहीं छापे जाते। विज्ञापन हमेशा विज्ञापन के रूप में पहचाना जाएगा।",
    ] },
  },
  "how-we-check": {
    gu: { title: "અમે સમાચાર કેવી રીતે ચકાસીએ છીએ", paras: [
      `કોણ લખે છે: વેબસાઇટના મોટા ભાગના તાજા સમાચાર AI (કૃત્રિમ બુદ્ધિ) સત્તાવાર જાહેરાતો અને નીચેની યાદીનાં માધ્યમોના અહેવાલ પરથી લખે છે, અને નીચે જણાવ્યા મુજબ ચકાસાય છે; તેના પર “કેપિટલ ક્રાંતિ ડેસ્ક” લખેલું હોય છે. તંત્રીના પોતાના અહેવાલ પર તેમનું નામ હોય છે. પેપર માટે જવાબદાર તંત્રી ${PAPER.editor.gu} છે.`,
      "કોણે કહ્યું: સરકાર કે સત્તાવાર સંસ્થા પોતે જાહેર કરે તે સમાચાર સીધા પ્રકાશિત થાય છે. બીજા સમાચાર અમારી યાદીનાં માન્ય માધ્યમોના અહેવાલ પરથી પ્રકાશિત થાય છે; ઘણી વાર તે એક જ માધ્યમનો અહેવાલ હોય છે, અને સમાચારમાં તેનો સ્રોત લખેલો હોય છે.",
      "તાજા અને સાચા: જૂના સમાચાર ફરી ફરતા હોય તો પકડાય છે. ફેક્ટ-ચેક સંસ્થાઓએ (જેમ કે PIB ફેક્ટ ચેક) ખોટા જાહેર કરેલા દાવા પ્રકાશિત થતા નથી.",
      "દરેક દાવો અને આંકડો: સમાચારનો દરેક દાવો અને દરેક આંકડો (રકમ, તારીખ, સંખ્યા) મૂળ સ્રોત સાથે મેળવાય છે; લખનાર સિવાયની બીજી તપાસ પણ દરેક દાવો ફરી તપાસે છે. મેળ ન ખાય તો સમાચાર પ્રકાશિત થતા નથી.",
      "અનુવાદ: અંગ્રેજી અને હિંદી અનુવાદના આંકડા પણ ગુજરાતી સમાચાર સાથે મેળવાય છે. મેળ ન ખાય તો ગુજરાતી સમાચાર જ બતાવાય છે.",
      "પ્રકાશન પછી પણ: સ્રોત પોતાના સમાચાર સુધારે કે પાછા ખેંચે તો અમારા સમાચાર પણ તરત રોકાય છે અને સુધારાય છે. દરેક સમાચારના અંતે મૂળ સ્રોતની લિંક હોય છે, જેથી વાચક જાતે મેળવી શકે.",
    ] },
    en: { title: "How we check the news", paras: [
      `Who writes: most of the latest news on this website is written by AI from official releases and the reports of the outlets on our list, and checked as described below; it carries the byline “Capital Kranti desk”. Reports written by the editor carry the editor’s name. The editor responsible for the paper is ${PAPER.editor.en}.`,
      "Who said it: a government or official body speaking for itself is published directly. Other news is published from the reports of the outlets on our list; often that is one outlet's report, and the story names its source.",
      "Fresh and true: old news going round again is caught. Claims that fact-checkers (such as PIB Fact Check) have found false are not published.",
      "Every claim and number: each claim and each number in a story (amounts, dates, counts) is matched against the original sources, and a second check, separate from the writing, goes over every claim again. If anything doesn’t match, the story isn’t published.",
      "Translations: the numbers in each English and Hindi version are matched against the Gujarati story too. If they don’t match, the Gujarati story is shown instead.",
      "After publishing too: if a source corrects or withdraws its report, our story is held and corrected at once. Every story ends with links to its original sources, so readers can check it themselves.",
    ] },
    hi: { title: "हम समाचार कैसे जाँचते हैं", paras: [
      `कौन लिखता है: वेबसाइट के ज़्यादातर ताज़ा समाचार AI (कृत्रिम बुद्धि) आधिकारिक घोषणाओं और हमारी सूची के माध्यमों की ख़बरों से लिखता है, और नीचे बताए तरीक़े से जाँचे जाते हैं; उन पर “कैपिटल क्रांति डेस्क” लिखा होता है। संपादक की अपनी ख़बरों पर उनका नाम होता है। अख़बार के ज़िम्मेदार संपादक ${PAPER.editor.hi} हैं।`,
      "किसने कहा: सरकार या आधिकारिक संस्था के अपने बयान सीधे प्रकाशित होते हैं। दूसरे समाचार हमारी सूची के माध्यमों की ख़बरों से प्रकाशित होते हैं; अक्सर वह एक ही माध्यम की ख़बर होती है, और समाचार में उसका स्रोत लिखा होता है।",
      "ताज़ा और सच: पुराने समाचार फिर से फैलें तो पकड़े जाते हैं। फ़ैक्ट-चेक संस्थाओं (जैसे PIB फ़ैक्ट चेक) ने जिन दावों को ग़लत बताया है, वे प्रकाशित नहीं होते।",
      "हर दावा और आँकड़ा: समाचार का हर दावा और हर आँकड़ा (रक़म, तारीख़, संख्या) मूल स्रोतों से मिलाया जाता है, और लिखने से अलग एक दूसरी जाँच हर दावे को फिर परखती है। मेल न खाए तो समाचार प्रकाशित नहीं होता।",
      "अनुवाद: अंग्रेज़ी और हिंदी संस्करणों के आँकड़े भी गुजराती समाचार से मिलाए जाते हैं। मेल न खाए तो गुजराती समाचार ही दिखाया जाता है।",
      "प्रकाशन के बाद भी: स्रोत अपनी ख़बर सुधारे या वापस ले, तो हमारा समाचार तुरंत रोका और सुधारा जाता है। हर समाचार के अंत में मूल स्रोतों की लिंक होती है, ताकि पाठक ख़ुद जाँच सकें।",
    ] },
  },
  corrections: {
    gu: { title: "સુધારા", paras: [
      "ભૂલ થાય તો અમે તેને ખુલ્લેઆમ સુધારીએ છીએ. સુધારેલા સમાચારની ઉપર તારીખ સાથે નોંધ મુકાય છે કે શું બદલાયું. ચૂપચાપ ફેરફાર કરવામાં આવતો નથી.",
      "ભૂલ દેખાય તો દરેક સમાચારના અંતે “ભૂલ દેખાય? અમને જણાવો” દબાવો, અથવા અમને લખો: " + PAPER.email + ".",
    ] },
    en: { title: "Corrections", paras: [
      "When we make a mistake, we correct it openly. A corrected story carries a dated note at the top saying what changed. We never change a story silently.",
      "If you spot a mistake, press “Spotted a mistake? Tell us” at the end of the story, or write to us: " + PAPER.email + ".",
    ] },
    hi: { title: "सुधार", paras: [
      "ग़लती होने पर हम उसे खुलकर सुधारते हैं। सुधारे गए समाचार के ऊपर तारीख़ के साथ लिखा जाता है कि क्या बदला। चुपचाप बदलाव नहीं किया जाता।",
      "कोई ग़लती दिखे तो समाचार के अंत में “कोई ग़लती दिखी? हमें बताएँ” दबाएँ, या हमें लिखें: " + PAPER.email + "।",
    ] },
  },
  contact: {
    gu: { title: "સંપર્ક", paras: [contact("gu"), ...offices.gu, "સમાચાર, ભૂલ, જાહેરાત કે અન્ય કોઈ બાબત માટે ઈમેલ કરો. અમે જલદી જવાબ આપીશું."] },
    en: { title: "Contact", paras: [contact("en"), ...offices.en, "Email us about news, a mistake, advertising or anything else. We’ll reply as soon as we can."] },
    hi: { title: "संपर्क", paras: [contact("hi"), ...offices.hi, "समाचार, ग़लती, विज्ञापन या किसी और बात के लिए ईमेल करें। हम जल्द जवाब देंगे।"] },
  },
  // the readers asked (3 Nov): how to advertise, from the facts in "about us" and the paper's contacts
  advertise: {
    gu: { title: "જાહેરાત આપો", paras: [
      "કેપિટલ ક્રાંતિ ગુજરાત સરકાર અને ભારત સરકાર (ડીએવીપી) દ્વારા જાહેરાતો પ્રકાશિત કરવા માટે માન્ય દૈનિક છે.",
      "અમારું છાપેલું અખબાર ગાંધીનગર, અમદાવાદ, બનાસકાંઠા, સાબરકાંઠા, પાટણ અને મહેસાણા જિલ્લા સુધી, અને સૌરાષ્ટ્રના મોટા ભાગમાં પહોંચે છે; આ વેબસાઇટ ગુજરાતી, હિંદી અને અંગ્રેજીમાં દિવસભર વંચાય છે.",
      "અમે આ જાહેરાતો સ્વીકારીએ છીએ: વ્યવસાયની જાહેરાત, સરકારી ટેન્ડર અને જાહેર સૂચના, અને નોકરી, મિલકત, વાહન, લગ્ન વિષયક જેવી વર્ગીકૃત જાહેરાતો. વર્ગીકૃત જાહેરાતો વેબસાઇટના “વર્ગીકૃત જાહેરાતો” પાના પર પણ દેખાય છે.",
      "દર, માપ અને તારીખ માટે અમારો સંપર્ક કરો:",
      contact("gu"), offices.gu[1],
    ] },
    en: { title: "Advertise with us", paras: [
      "Capital Kranti is a daily approved for publishing advertisements by the Government of Gujarat and the Government of India (DAVP).",
      "Our printed paper reaches Gandhinagar, Ahmedabad, Banaskantha, Sabarkantha, Patan and Mehsana districts and much of Saurashtra; this website is read through the day in Gujarati, Hindi and English.",
      "We take business advertisements, government tenders and public notices, and classified ads such as jobs, property, vehicles and matrimonial. Classified ads also appear on the website's Classified ads page.",
      "For rates, sizes and dates, get in touch:",
      contact("en"), offices.en[1],
    ] },
    hi: { title: "विज्ञापन दें", paras: [
      "कैपिटल क्रांति गुजरात सरकार और भारत सरकार (डीएवीपी) द्वारा विज्ञापन प्रकाशित करने के लिए मान्य दैनिक है।",
      "हमारा छपा अख़बार गांधीनगर, अहमदाबाद, बनासकांठा, साबरकांठा, पाटण और महेसाणा ज़िलों तक और सौराष्ट्र के बड़े हिस्से में पहुँचता है; यह वेबसाइट गुजराती, हिंदी और अंग्रेज़ी में दिनभर पढ़ी जाती है।",
      "हम ये विज्ञापन लेते हैं: व्यवसाय के विज्ञापन, सरकारी टेंडर और सार्वजनिक सूचनाएँ, और नौकरी, संपत्ति, वाहन, वैवाहिक जैसे वर्गीकृत विज्ञापन। वर्गीकृत विज्ञापन वेबसाइट के “वर्गीकृत विज्ञापन” पेज पर भी दिखते हैं।",
      "दर, आकार और तारीख़ के लिए हमसे संपर्क करें:",
      contact("hi"), offices.hi[1],
    ] },
  },
  // the readers asked (3 Nov): the RSS link did nothing on an iPhone, which has no feed reader of its own; this page says
  // what a feed is and gives its addresses to copy into a reader app
  rss: {
    gu: { title: "RSS ફીડ", paras: [
      "RSS ફીડ વડે કેપિટલ ક્રાંતિના નવા સમાચાર તમારી ફીડ વાંચવાની એપમાં (જેમ કે Feedly, Inoreader કે NetNewsWire) આપોઆપ આવે છે. iPhone કે Android પર એવી એપ ખોલો, “ફીડ ઉમેરો” દબાવો અને નીચેનું સરનામું ચોંટાડો.",
      "બધા સમાચાર: https://www.capitalkranti.co.in/rss.xml",
      "હિંદીમાં: https://www.capitalkranti.co.in/hi/rss.xml · અંગ્રેજીમાં: https://www.capitalkranti.co.in/en/rss.xml",
      "એક જ વિભાગ: વિભાગના સરનામા પછી /rss.xml, જેમ કે https://www.capitalkranti.co.in/section/gujarat/rss.xml",
    ] },
    en: { title: "RSS feeds", paras: [
      "With an RSS feed, Capital Kranti's new stories arrive by themselves in your feed reader app (such as Feedly, Inoreader or NetNewsWire). Open such an app on your iPhone or Android phone, tap “add feed” and paste the address below.",
      "All news in English: https://www.capitalkranti.co.in/en/rss.xml",
      "In Gujarati: https://www.capitalkranti.co.in/rss.xml · In Hindi: https://www.capitalkranti.co.in/hi/rss.xml",
      "One section: the section's address followed by /rss.xml, such as https://www.capitalkranti.co.in/en/section/india/rss.xml",
    ] },
    hi: { title: "RSS फ़ीड", paras: [
      "RSS फ़ीड से कैपिटल क्रांति के नए समाचार आपकी फ़ीड पढ़ने वाली ऐप (जैसे Feedly, Inoreader या NetNewsWire) में अपने-आप आते हैं। iPhone या Android पर ऐसी ऐप खोलें, “फ़ीड जोड़ें” दबाएँ और नीचे का पता चिपकाएँ।",
      "हिंदी में सभी समाचार: https://www.capitalkranti.co.in/hi/rss.xml",
      "गुजराती में: https://www.capitalkranti.co.in/rss.xml · अंग्रेज़ी में: https://www.capitalkranti.co.in/en/rss.xml",
      "एक विभाग: विभाग के पते के बाद /rss.xml, जैसे https://www.capitalkranti.co.in/hi/section/india/rss.xml",
    ] },
  },
  terms: {
    gu: { title: "ઉપયોગના નિયમો", paras: [
      "આ વેબસાઇટના સમાચાર કેપિટલ ક્રાંતિના છે; દરેક ફોટો તેની નીચે જણાવેલા સ્રોતનો છે. અંગત વાંચન માટે ઉપયોગ કરો; સમાચારની લિંક મોકલવાનું સ્વાગત છે.",
      "આખા સમાચાર બીજે ફરી પ્રકાશિત કરવા હોય તો પહેલાં અમારી લેખિત મંજૂરી લો.",
      "અમે સમાચાર સાચા રાખવા પૂરો પ્રયત્ન કરીએ છીએ; ભૂલ દેખાય તો જણાવો, અમે સુધારીશું.",
    ] },
    en: { title: "Terms of use", paras: [
      "The stories on this website belong to Capital Kranti; each photo belongs to the source credited under it. Use them for personal reading; sharing links to stories is welcome.",
      "To republish whole stories elsewhere, ask us for written permission first.",
      "We do our best to keep every story accurate; if you spot a mistake, tell us and we will correct it.",
    ] },
    hi: { title: "उपयोग के नियम", paras: [
      "इस वेबसाइट के समाचार कैपिटल क्रांति के हैं; हर फ़ोटो उसके नीचे बताए स्रोत का है। निजी पढ़ने के लिए उपयोग करें; समाचारों की लिंक भेजने का स्वागत है।",
      "पूरे समाचार कहीं और फिर से प्रकाशित करने हों तो पहले हमारी लिखित अनुमति लें।",
      "हम हर समाचार सही रखने की पूरी कोशिश करते हैं; ग़लती दिखे तो बताएँ, हम सुधारेंगे।",
    ] },
  },
  privacy: {
    gu: { title: "ગોપનીયતા", paras: [
      "આ વેબસાઇટ વાંચવા માટે ખાતું કે સાઇન-ઇન જરૂરી નથી. અમે તમારી માહિતી વેચતા નથી અને જાહેરાત માટે તમને ટ્રૅક કરતા નથી.",
      "તમારો દેખાવ (લાઇટ/ડાર્ક), અક્ષરનું કદ અને સાચવેલા સમાચાર ફક્ત તમારા પોતાના બ્રાઉઝરમાં રહે છે; અમારી પાસે આવતા નથી.",
      "\"સૌથી વધુ વંચાયેલા\" યાદી માટે અમે ફક્ત ગણીએ છીએ કે દરેક સમાચાર કેટલી વાર ખૂલ્યા; કોણે ખોલ્યા તે નહીં. તમારા બ્રાઉઝરમાં ફક્ત એટલું યાદ રહે છે કે કયા સમાચાર ગણાઈ ગયા, જેથી એક જ વ્યક્તિ બે વાર ન ગણાય.",
      "વેબસાઇટ ચલાવતી સેવા (Vercel) સુરક્ષા માટે થોડા સમય માટે સામાન્ય ટેકનિકલ લૉગ રાખે છે.",
      "પ્રશ્ન હોય તો લખો: " + PAPER.email + ".",
    ] },
    en: { title: "Privacy", paras: [
      "You don’t need an account or sign-in to read this website. We don’t sell your information and don’t track you for advertising.",
      "Your appearance (light or dark), text size and saved stories stay in your own browser only; they never reach us.",
      "For the \"most read\" list we only count how many times each story is opened, never who opened it. Your browser remembers which stories it has already counted, so one reader isn’t counted twice.",
      "The service that runs the website (Vercel) keeps ordinary technical logs for a short time, for security.",
      "Questions? Write to " + PAPER.email + ".",
    ] },
    hi: { title: "गोपनीयता", paras: [
      "इस वेबसाइट को पढ़ने के लिए खाता या साइन-इन ज़रूरी नहीं है। हम आपकी जानकारी नहीं बेचते और विज्ञापन के लिए आपको ट्रैक नहीं करते।",
      "आपका रूप (लाइट/डार्क), अक्षर का आकार और सहेजे गए समाचार केवल आपके अपने ब्राउज़र में रहते हैं; हम तक नहीं आते।",
      "\"सबसे ज़्यादा पढ़े गए\" सूची के लिए हम केवल गिनते हैं कि हर समाचार कितनी बार खुला; किसने खोला, यह नहीं। आपका ब्राउज़र बस यह याद रखता है कि कौन-से समाचार गिने जा चुके, ताकि एक पाठक दो बार न गिना जाए।",
      "वेबसाइट चलाने वाली सेवा (Vercel) सुरक्षा के लिए थोड़े समय तक सामान्य तकनीकी लॉग रखती है।",
      "कोई प्रश्न? लिखें: " + PAPER.email + "।",
    ] },
  },
};

export default function Policy({ page, lang }: { page: string; lang: Lang }) {
  const p = POLICY[page]?.[lang];
  if (!p) notFound();
  return (
    <Frame lang={lang} path={`/${page}`}>
      <article className="art prose" style={{ paddingTop: 20 }}>
        <h1>{p.title}</h1>
        <div className="body">{p.paras.map((x, i) => <p key={i}>{x}</p>)}</div>
      </article>
    </Frame>
  );
}
