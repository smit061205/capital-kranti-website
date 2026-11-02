// Instagram cards (the user, 3 Nov): twice a day, one post each for Gujarat, India and the world, all in Gujarati;
// 5 to 7 story cards (the most important fact-checked stories of the last 12 hours) and a last card that points to
// the section on the site. Every card has a picture (the user: plain colour cards "are not acceptable"); a photo keeps
// its own shape. The editor approves each set on the editor page before it goes up.
import { storiesIn } from "./db.ts";
import { sampleOn } from "./sample.ts";
import type { Story, Tier } from "./types.ts";

export const MIN_STORIES = 5;
export const MAX_STORIES = 7;
/** a photo narrower than this would be blown up on the 1080-wide card, and look soft */
export const MIN_WIDTH = 1000;

export interface CardPhoto { url: string; width: number; height: number; credit?: string; representative?: boolean }
export interface StoryCard { id: string; headline: string; photo: CardPhoto }
export interface CardSet { tier: Tier; at: string; stories: StoryCard[]; end: Landmark }

/** the last card's photo, one for each section: free photos from Wikimedia Commons, credited (the user picks them by eye) */
export interface Landmark extends CardPhoto { title: string; short: string }
export const LANDMARKS: Record<Tier, Landmark> = {
  gujarat: { title: "ગુજરાતના આજના બધા સમાચાર", short: "capitalkranti.co.in/gujarat", credit: "Rahilarious, CC BY-SA 4.0", width: 1280, height: 1644,
             url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Foot_bridge_at_Ahmedabad_Sabarmati_Riverfront.jpg/1280px-Foot_bridge_at_Ahmedabad_Sabarmati_Riverfront.jpg" },
  india: { title: "દેશના આજના બધા સમાચાર", short: "capitalkranti.co.in/india", credit: "A.Savin, FAL", width: 1280, height: 1600,
           url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/India_Gate_in_New_Delhi_03-2016.jpg/1280px-India_Gate_in_New_Delhi_03-2016.jpg" },
  world: { title: "વિશ્વના આજના બધા સમાચાર", short: "capitalkranti.co.in/world", credit: "NASA, Apollo 17", width: 1280, height: 1281,
           url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/1280px-The_Earth_seen_from_Apollo_17.jpg" },
};

/** The story's own photo when it's big enough for a card; a Commons file photo of its subject is marked as one. */
function photoOf(s: Story): CardPhoto | null {
  const p = s.photo;
  if (!p || p.width < MIN_WIDTH) return null;
  return { url: p.url, width: p.width, height: p.height, credit: p.credit, representative: !!p.credit };
}

/** One section's set: its most important stories of the last 12 hours that have a good photo, most important first. */
export async function cardSet(tier: Tier, now = new Date()): Promise<CardSet | null> {
  const since = now.getTime() - 12 * 3600_000;
  const all = await storiesIn(tier, 80);
  // the local sample's stories are days old: there the window is left out, to look at the cards
  const recent = sampleOn() ? all : all.filter((s) => new Date(s.publishedAt).getTime() >= since);
  const ranked = recent
    .map((s) => ({ s, photo: photoOf(s) }))
    .filter((x): x is { s: Story; photo: CardPhoto } => !!x.photo)
    .sort((a, b) => (b.s.importance ?? 0) - (a.s.importance ?? 0) || b.s.publishedAt.localeCompare(a.s.publishedAt))
    .slice(0, MAX_STORIES);
  if (ranked.length < MIN_STORIES) return null;
  return { tier, at: now.toISOString(), stories: ranked.map(({ s, photo }) => ({ id: s.id, headline: s.headline, photo })), end: LANDMARKS[tier] };
}
