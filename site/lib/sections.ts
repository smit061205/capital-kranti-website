import type { Genre, Lang, Tier } from "./types.ts";

export const TIERS: Tier[] = ["gujarat", "india", "world"];
export const GENRES: Genre[] = ["farm", "economy", "tech", "health", "sport", "education", "entertainment"];
/** a place's own section (the readers asked, 3 Nov): Gujarat stories that name it (lib/db.ts storiesIn) */
export type Place = "gandhinagar";
export const PLACES: Place[] = ["gandhinagar"];
export const SECTIONS: (Tier | Place | Genre)[] = ["gujarat", ...PLACES, "india", "world", ...GENRES];
/** how a place is written in a story, in each language */
export const PLACE_WORDS: Record<Place, string[]> = { gandhinagar: ["ગાંધીનગર", "Gandhinagar", "गांधीनगर"] };

const NAMES: Record<Tier | Place | Genre, Record<Lang, string>> = {
  gujarat: { gu: "ગુજરાત", en: "Gujarat", hi: "गुजरात" },
  gandhinagar: { gu: "ગાંધીનગર", en: "Gandhinagar", hi: "गांधीनगर" },
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
