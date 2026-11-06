import type { Genre, Lang, Tier } from "./types.ts";

export const TIERS: Tier[] = ["gujarat", "india", "world"];
export const GENRES: Genre[] = ["farm", "economy", "tech", "health", "sport", "education", "entertainment"];
/** a place's own section (the readers asked, 3 Nov): Gujarat stories that name it (lib/db.ts storiesIn). Gandhinagar, the
 *  paper's home, is in the section scroller; the other cities and districts (6 Nov, for readers who search "<city> news":
 *  the paper's area first, then Gujarat's big cities) are reached from the Gujarat section and from each other. */
export type Place = "gandhinagar" | "ahmedabad" | "surat" | "vadodara" | "rajkot" | "mehsana" | "patan" | "banaskantha" | "sabarkantha"
  | "bhavnagar" | "jamnagar" | "junagadh" | "kutch";
export const CITIES: Place[] = ["ahmedabad", "surat", "vadodara", "rajkot", "mehsana", "patan", "banaskantha", "sabarkantha", "bhavnagar", "jamnagar", "junagadh", "kutch"];
export const PLACES: Place[] = ["gandhinagar", ...CITIES];
/** the sections in the scroller, the menu and the footer */
export const SECTIONS: (Tier | Place | Genre)[] = ["gujarat", "gandhinagar", "india", "world", ...GENRES];
/** every section with a page of its own */
export const ALL_SECTIONS: (Tier | Place | Genre)[] = [...SECTIONS, ...CITIES];
/** how a place is written in a story, in each language (a district by its own name and its main town's) */
export const PLACE_WORDS: Record<Place, string[]> = {
  gandhinagar: ["ગાંધીનગર", "Gandhinagar", "गांधीनगर"],
  ahmedabad: ["અમદાવાદ", "Ahmedabad", "अहमदाबाद"],
  surat: ["સુરત", "Surat"],
  vadodara: ["વડોદરા", "Vadodara", "वडोदरा", "Baroda"],
  rajkot: ["રાજકોટ", "Rajkot", "राजकोट"],
  mehsana: ["મહેસાણા", "Mehsana", "महेसाणा"],
  patan: ["પાટણ", "Patan", "पाटण"],
  banaskantha: ["બનાસકાંઠા", "પાલનપુર", "Banaskantha", "Palanpur", "बनासकांठा"],
  sabarkantha: ["સાબરકાંઠા", "હિંમતનગર", "Sabarkantha", "Himmatnagar", "साबरकांठा"],
  bhavnagar: ["ભાવનગર", "Bhavnagar", "भावनगर"],
  jamnagar: ["જામનગર", "Jamnagar", "जामनगर"],
  junagadh: ["જૂનાગઢ", "જુનાગઢ", "Junagadh", "जूनागढ़"],
  kutch: ["કચ્છ", "ભુજ", "Kutch", "Kachchh", "Bhuj", "कच्छ"],
};

const NAMES: Record<Tier | Place | Genre, Record<Lang, string>> = {
  gujarat: { gu: "ગુજરાત", en: "Gujarat", hi: "गुजरात" },
  gandhinagar: { gu: "ગાંધીનગર", en: "Gandhinagar", hi: "गांधीनगर" },
  ahmedabad: { gu: "અમદાવાદ", en: "Ahmedabad", hi: "अहमदाबाद" },
  surat: { gu: "સુરત", en: "Surat", hi: "सूरत" },
  vadodara: { gu: "વડોદરા", en: "Vadodara", hi: "वडोदरा" },
  rajkot: { gu: "રાજકોટ", en: "Rajkot", hi: "राजकोट" },
  mehsana: { gu: "મહેસાણા", en: "Mehsana", hi: "महेसाणा" },
  patan: { gu: "પાટણ", en: "Patan", hi: "पाटण" },
  banaskantha: { gu: "બનાસકાંઠા", en: "Banaskantha", hi: "बनासकांठा" },
  sabarkantha: { gu: "સાબરકાંઠા", en: "Sabarkantha", hi: "साबरकांठा" },
  bhavnagar: { gu: "ભાવનગર", en: "Bhavnagar", hi: "भावनगर" },
  jamnagar: { gu: "જામનગર", en: "Jamnagar", hi: "जामनगर" },
  junagadh: { gu: "જૂનાગઢ", en: "Junagadh", hi: "जूनागढ़" },
  kutch: { gu: "કચ્છ", en: "Kutch", hi: "कच्छ" },
  india: { gu: "દેશ", en: "India", hi: "देश" },
  world: { gu: "વિશ્વ", en: "World", hi: "विश्व" },
  farm: { gu: "ખેતી", en: "Farming", hi: "खेती" },
  economy: { gu: "અર્થતંત્ર", en: "Economy", hi: "अर्थव्यवस्था" },
  tech: { gu: "ટેક-વિજ્ઞાન", en: "Tech & science", hi: "टेक-विज्ञान" },
  health: { gu: "આરોગ્ય", en: "Health", hi: "स्वास्थ्य" },
  sport: { gu: "રમતગમત", en: "Sport", hi: "खेल" },
  education: { gu: "શિક્ષણ", en: "Education", hi: "शिक्षा" },
  entertainment: { gu: "મનોરંજન", en: "Entertainment", hi: "मनोरंजन" },
};
export const sectionName = (key: string, lang: Lang) => NAMES[key as Tier]?.[lang] ?? key;
export const isPlace = (key: string): key is Place => PLACES.includes(key as Place);
export const isSection = (key: string): key is Tier | Place | Genre => key in NAMES;

/** what each section page carries, for its title and description in search results and the line under its name */
const ABOUT: Partial<Record<Tier | Genre, Record<Lang, string>>> = {
  gujarat: { gu: "ગુજરાત સરકાર, જિલ્લાઓ, શહેરો અને ગામડાંના તાજા સમાચાર: નિર્ણયો, યોજનાઓ, ભરતી, હવામાન અને લોકોને સ્પર્શતી વાતો.",
             en: "The latest news from Gujarat: the state government's decisions and schemes, the districts and cities, jobs, weather and the stories that touch people.",
             hi: "गुजरात के ताज़ा समाचार: राज्य सरकार के निर्णय और योजनाएँ, ज़िले और शहर, भर्ती, मौसम और लोगों से जुड़ी बातें." },
  india: { gu: "દેશના તાજા સમાચાર: કેન્દ્ર સરકાર, સંસદ, મંત્રાલયો, રાજ્યો અને અદાલતોના નિર્ણયો સરળ ગુજરાતીમાં.",
           en: "The latest news from India: the central government, Parliament, the ministries, the states and the courts, in plain words.",
           hi: "देश के ताज़ा समाचार: केंद्र सरकार, संसद, मंत्रालय, राज्य और अदालतों के निर्णय, सरल शब्दों में." },
  world: { gu: "વિશ્વના તાજા સમાચાર: બીજા દેશો, આંતરરાષ્ટ્રીય સંસ્થાઓ અને ભારત સાથેના સંબંધોની વાત.",
           en: "The latest world news: other countries, international bodies and India's ties with the world.",
           hi: "विश्व के ताज़ा समाचार: दूसरे देश, अंतरराष्ट्रीय संस्थाएँ और दुनिया से भारत के संबंध." },
  farm: { gu: "ખેતી અને ખેડૂતોના સમાચાર: પાકના ભાવ, ટેકાના ભાવ, સહાય યોજનાઓ, વરસાદ, પશુપાલન અને સહકારી ડેરી.",
          en: "News for farmers: crop prices and MSP, government help, the rains, animal husbandry and the dairy cooperatives.",
          hi: "खेती और किसानों के समाचार: फ़सल के भाव, समर्थन मूल्य, सहायता योजनाएँ, बारिश, पशुपालन और सहकारी डेयरी." },
  economy: { gu: "અર્થતંત્રના સમાચાર: બજાર, ભાવ, બેંક અને રિઝર્વ બેંક, કર, ઉદ્યોગ, વેપાર અને રોજગાર.",
             en: "Economy news: markets, prices, banks and the RBI, taxes, industry, trade and jobs.",
             hi: "अर्थव्यवस्था के समाचार: बाज़ार, भाव, बैंक और रिज़र्व बैंक, कर, उद्योग, व्यापार और रोज़गार." },
  tech: { gu: "ટેક્નોલોજી અને વિજ્ઞાનના સમાચાર: અવકાશ અને ઇસરો, મોબાઇલ અને ઇન્ટરનેટ, AI, સંશોધન અને નવી શોધો.",
          en: "Technology and science news: space and ISRO, phones and the internet, AI, research and new discoveries.",
          hi: "तकनीक और विज्ञान के समाचार: अंतरिक्ष और इसरो, मोबाइल और इंटरनेट, AI, शोध और नई खोजें." },
  health: { gu: "આરોગ્યના સમાચાર: હોસ્પિટલ, રોગ અને રસી, સરકારી આરોગ્ય યોજનાઓ, દવાઓ અને સારા આરોગ્યની સલાહ.",
            en: "Health news: hospitals, diseases and vaccines, government health schemes, medicines and advice for staying well.",
            hi: "स्वास्थ्य के समाचार: अस्पताल, बीमारियाँ और टीके, सरकारी स्वास्थ्य योजनाएँ, दवाएँ और अच्छे स्वास्थ्य की सलाह." },
  sport: { gu: "રમતગમતના સમાચાર: ક્રિકેટ, ઓલિમ્પિક રમતો, ગુજરાતના ખેલાડીઓ અને મોટી સ્પર્ધાઓનાં પરિણામ.",
           en: "Sports news: cricket, the Olympic sports, Gujarat's players and the results of the big tournaments.",
           hi: "खेल के समाचार: क्रिकेट, ओलंपिक खेल, गुजरात के खिलाड़ी और बड़ी प्रतियोगिताओं के नतीजे." },
  education: { gu: "શિક્ષણના સમાચાર: શાળા અને બોર્ડની પરીક્ષા, પરિણામ, યુનિવર્સિટી, પ્રવેશ, શિષ્યવૃત્તિ અને ભરતી.",
               en: "Education news: schools and board exams, results, universities, admissions, scholarships and recruitment.",
               hi: "शिक्षा के समाचार: स्कूल और बोर्ड परीक्षा, परिणाम, विश्वविद्यालय, प्रवेश, छात्रवृत्ति और भर्ती." },
  entertainment: { gu: "મનોરંજનના સમાચાર: ગુજરાતી અને હિંદી ફિલ્મો, સંગીત, તહેવારો, કલા અને સંસ્કૃતિ.",
                   en: "Entertainment news: Gujarati and Hindi films, music, festivals, art and culture.",
                   hi: "मनोरंजन के समाचार: गुजराती और हिंदी फ़िल्में, संगीत, त्योहार, कला और संस्कृति." },
};
/** a section's line for search results; a place's names the place */
export function sectionAbout(key: string, lang: Lang): string {
  if (isPlace(key)) {
    const n = sectionName(key, lang);
    return { gu: `${n}ના તાજા સમાચાર: સરકારી નિર્ણયો, વિકાસનાં કામ, શિક્ષણ, ખેતી, હવામાન અને ${n}ના લોકોને સ્પર્શતા સમાચાર, ગુજરાતીમાં.`,
             en: `The latest news from ${n}, Gujarat: government decisions, development work, education, farming, weather and the stories that touch its people.`,
             hi: `${n} (गुजरात) के ताज़ा समाचार: सरकारी निर्णय, विकास कार्य, शिक्षा, खेती, मौसम और ${n} के लोगों से जुड़े समाचार.` }[lang];
  }
  return ABOUT[key as Tier]?.[lang] ?? "";
}
/** a section's title in search results: what people type ("ગુજરાત સમાચાર", "Ahmedabad news") */
export function sectionTitle(key: string, lang: Lang): string {
  const n = sectionName(key, lang);
  return { gu: `${n}ના સમાચાર`, en: `${n} news`, hi: `${n} समाचार` }[lang];
}
/** the place a Gujarat story is about: the first named in its headline, kicker or line under it (as lib/db.ts storiesIn
 *  finds a place's stories), for the link to the place's page on the story */
export function placeOf(s: { tier: string; headline: string; kicker: string; deck: string }): Place | null {
  if (s.tier !== "gujarat") return null;
  const text = `${s.headline} ${s.kicker} ${s.deck}`.toLowerCase();
  return PLACES.find((p) => PLACE_WORDS[p].some((w) => text.includes(w.toLowerCase()))) ?? null;
}
