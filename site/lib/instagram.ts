// Posting an approved set to Instagram (the Instagram API with Instagram login: a Business or Creator account). The site
// needs two settings in Vercel, which the user adds there: INSTAGRAM_USER_ID (the account's number) and INSTAGRAM_TOKEN
// (a long-lived token, good for 60 days; INSTAGRAM_API may name another API address, e.g. https://graph.facebook.com/v23.0
// for an account linked through Facebook). Instagram fetches each card itself from the site's address (app/media).
import { SITE, type InstaSet } from "./insta.ts";

const API = () => process.env.INSTAGRAM_API || "https://graph.instagram.com/v23.0";
export const instagramOn = () => !!process.env.INSTAGRAM_USER_ID && !!process.env.INSTAGRAM_TOKEN;

async function call(method: "GET" | "POST", path: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...params, access_token: process.env.INSTAGRAM_TOKEN! });
  const url = `${API()}/${path}${method === "GET" ? `?${body}` : ""}`;
  const res = await fetch(url, { method, body: method === "POST" ? body : undefined, signal: AbortSignal.timeout(30_000) });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  // Instagram's own words, without the token
  if (!res.ok || j.error) throw new Error(j.error?.message ?? `Instagram answered ${res.status}`);
  return j;
}

const ready = async (id: string) => {
  // a container is made from the pictures in a few seconds; up to 40 seconds
  for (let i = 0; i < 20; i++) {
    const s = (await call("GET", id, { fields: "status_code" })).status_code as string;
    if (s === "FINISHED") return;
    if (s === "ERROR" || s === "EXPIRED") throw new Error(`Instagram couldn't use the pictures (${s})`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Instagram took too long with the pictures");
};

/** Puts the set up as one carousel: its address on Instagram. */
export async function postSet(set: InstaSet, say: (line: string) => Promise<void> = async () => {}): Promise<string> {
  if (!instagramOn()) throw new Error("Instagram isn't connected yet");
  if (!set.image) throw new Error("the set has no pictures");
  const user = process.env.INSTAGRAM_USER_ID!;
  // all the cards at once, not one after another: the editor's button has a minute (4 Nov: one by one, a set of six
  // ran past it and stayed "approved, not up yet")
  await say(`${set.cards.length + 1} કાર્ડ ઇન્સ્ટાગ્રામને આપ્યાં: ઇન્સ્ટાગ્રામ એ ચિત્રો લે છે`);
  const children = await Promise.all(Array.from({ length: set.cards.length + 1 }, async (_, i) =>
    (await call("POST", `${user}/media`, { image_url: `${SITE}${set.image}?card=${i + 1}`, is_carousel_item: "true" })).id as string));
  await Promise.all(children.map(ready));
  await say("ઇન્સ્ટાગ્રામે બધાં ચિત્રો લીધાં: કેરોસેલ બને છે");
  const carousel = await call("POST", `${user}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: set.caption });
  await ready(carousel.id as string);
  await say("કેરોસેલ તૈયાર: પ્રકાશિત થાય છે");
  const posted = await call("POST", `${user}/media_publish`, { creation_id: carousel.id as string });
  const link = await call("GET", posted.id as string, { fields: "permalink" }).catch(() => ({ permalink: "" }));
  return (link.permalink as string) || "https://www.instagram.com/";
}

/** The account the settings reach, for the editor page: its name, or Instagram's reason it can't be reached. */
// kept ten minutes when reached, so every button press doesn't wait on Instagram to show the page again
let known: { name: string; at: number } | null = null;
export async function instagramWho(): Promise<{ name: string } | { why: string } | null> {
  if (!instagramOn()) return null;
  if (known && Date.now() - known.at < 10 * 60_000) return { name: known.name };
  try {
    const me = await call("GET", process.env.INSTAGRAM_USER_ID!, { fields: "username" });
    known = { name: String(me.username ?? ""), at: Date.now() };
    return { name: known.name };
  } catch (e) {
    return { why: e instanceof Error ? e.message : String(e) };
  }
}
