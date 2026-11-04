// Posting an approved set to the paper's Facebook Page too (the user, 4 Nov: Gujarati readers are on Facebook, and a
// Facebook post's links can be tapped, unlike Instagram's): the same cards as one post of several photos, and the same
// words with each story's link. The site needs two settings in Vercel, which the user adds there: FACEBOOK_PAGE_ID (the
// Page's number) and FACEBOOK_PAGE_TOKEN (a Page token with pages_manage_posts). Facebook fetches each card itself from
// the site's address (app/media), as Instagram does.
import { SITE, type InstaSet } from "./insta.ts";
import { num } from "./format.ts";

const API = () => process.env.FACEBOOK_API || "https://graph.facebook.com/v23.0";
export const facebookOn = () => !!process.env.FACEBOOK_PAGE_ID && !!process.env.FACEBOOK_PAGE_TOKEN;

async function call(method: "GET" | "POST", path: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...params, access_token: process.env.FACEBOOK_PAGE_TOKEN! });
  const url = `${API()}/${path}${method === "GET" ? `?${body}` : ""}`;
  const res = await fetch(url, { method, body: method === "POST" ? body : undefined, signal: AbortSignal.timeout(40_000) });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  // Facebook's own words, without the token
  if (!res.ok || j.error) throw new Error(j.error?.message ?? `Facebook answered ${res.status}`);
  return j;
}

/** The words for Facebook: the set's words (as the editor left them), with each story's link where Instagram's say "the
 *  link in the profile" */
export function facebookWords(set: InstaSet): string {
  const links = ["દરેક સમાચાર વિગતે વાંચવા:", ...set.cards.map((c, i) => `${num(i + 1, "gu")}. ${SITE}/news/${encodeURIComponent(c.storyId)}`)].join("\n");
  const lines = set.caption.split("\n");
  const at = lines.findIndex((l) => l.includes("પ્રોફાઇલમાંની લિંક"));
  if (at >= 0) lines.splice(at, 1, links);
  else lines.push("", links);
  return lines.join("\n");
}

/** Puts the set up on the Page as one post of the cards: its address on Facebook. */
export async function postSetFacebook(set: InstaSet, say: (line: string) => Promise<void> = async () => {}): Promise<string> {
  if (!facebookOn()) throw new Error("the Facebook Page isn't connected yet");
  if (!set.image) throw new Error("the set has no pictures");
  const page = process.env.FACEBOOK_PAGE_ID!;
  await say(`${set.cards.length + 1} કાર્ડ ફેસબુકને આપ્યાં: ફેસબુક એ ચિત્રો લે છે`);
  // each card first kept on the Page unpublished, all at once, then one post holding them all
  const photos = await Promise.all(Array.from({ length: set.cards.length + 1 }, async (_, i) =>
    (await call("POST", `${page}/photos`, { url: `${SITE}${set.image}?card=${i + 1}`, published: "false" })).id as string));
  await say("ફેસબુકે બધાં ચિત્રો લીધાં: પોસ્ટ મુકાય છે");
  const media = Object.fromEntries(photos.map((id, i) => [`attached_media[${i}]`, JSON.stringify({ media_fbid: id })]));
  const posted = await call("POST", `${page}/feed`, { message: facebookWords(set), ...media });
  const link = await call("GET", posted.id as string, { fields: "permalink_url" }).catch(() => ({ permalink_url: "" }));
  return (link.permalink_url as string) || `https://www.facebook.com/${posted.id}`;
}

// kept ten minutes when reached, so every button press doesn't wait on Facebook to show the page again
let known: { name: string; at: number } | null = null;
/** The Page the settings reach, for the editor page: its name, or Facebook's reason it can't be reached. */
export async function facebookWho(): Promise<{ name: string } | { why: string } | null> {
  if (!facebookOn()) return null;
  if (known && Date.now() - known.at < 10 * 60_000) return { name: known.name };
  try {
    const me = await call("GET", process.env.FACEBOOK_PAGE_ID!, { fields: "name" });
    known = { name: String(me.name ?? ""), at: Date.now() };
    return { name: known.name };
  } catch (e) {
    return { why: e instanceof Error ? e.message : String(e) };
  }
}
