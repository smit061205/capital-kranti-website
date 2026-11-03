"use server";
// The editor page's buttons (lib/editor.ts). Each one checks the sign-in itself: these
// can be called directly, not only from the page.
import { cookies } from "next/headers";
import { refresh, revalidatePath } from "next/cache";
import { db } from "@/lib/db.ts";
import { redirect } from "next/navigation";
import { addFeature, addStory, COOKIE, decideFeature, editorOf, restoreStory, saveFeature, saveStory, setPaused, withdrawStory, type NewFeature, type NewStory, type Words } from "@/lib/editor.ts";
import { help, type Draft, type Help } from "@/lib/aihelp.ts";
import { GENRES, TIERS } from "@/lib/sections.ts";
import { dropLeader, findLeader, saveLeader, type FoundLeader, type Leader } from "@/lib/leaders.ts";
import { addAd, dropAd } from "@/lib/classifieds.ts";
import { captionFor, getSet, MIN_KEPT, saveSet } from "@/lib/insta.ts";
import { instagramOn, postSet } from "@/lib/instagram.ts";

async function signedIn() {
  const who = editorOf((await cookies()).get(COOKIE)?.value);
  if (!who) throw new Error("not signed in");
  return { who, sql: db() };
}
/** the site's pages renewed, and this page shown again */
function renew(aavtikal = false) {
  for (const p of ["/", "/en", "/hi"]) revalidatePath(p, "layout");
  if (aavtikal) for (const p of ["/aavtikal", "/en/aavtikal", "/hi/aavtikal"]) revalidatePath(p, "layout");
  refresh();
}

export async function removeStory(id: string) { const { who, sql } = await signedIn(); if (sql) await withdrawStory(sql, id, who); renew(); }
export async function publishFeature(id: string) { const { sql } = await signedIn(); if (sql) await decideFeature(sql, id, "published"); renew(true); }
export async function removeFeature(id: string) { const { sql } = await signedIn(); if (sql) await decideFeature(sql, id, "withdrawn"); renew(true); }
export async function pauseEngine(paused: boolean) { const { sql } = await signedIn(); if (sql) await setPaused(sql, paused); refresh(); }
export async function putBackStory(id: string) { const { sql } = await signedIn(); if (sql) await restoreStory(sql, id); renew(); }

const words = (f: FormData): Words => {
  const v = (k: string) => String(f.get(k) ?? "").replace(/\r\n/g, "\n").trim();
  return { headline: v("headline"), deck: v("deck"), body: v("body"), caption: v("caption") };
};
/** the editor's changes saved; back to the list, which says so */
export async function changeStory(id: string, back: string, f: FormData) {
  const { who, sql } = await signedIn();
  const w = words(f);
  if (!w.headline || !w.body) redirect(`/editor/story/${encodeURIComponent(id)}?${back ? `${back}&` : ""}missing=1`);
  const ok = sql ? await saveStory(sql, id, w, who) : false;
  renew();
  redirect(`/editor?${back ? `${back}&` : ""}saved=${ok ? "1" : "0"}#news`);
}
export async function changeFeature(id: string, back: string, f: FormData) {
  const { sql } = await signedIn();
  const w = words(f);
  if (!w.headline || !w.body) redirect(`/editor/feature/${encodeURIComponent(id)}?${back ? `${back}&` : ""}missing=1`);
  const ok = sql ? await saveFeature(sql, id, w) : false;
  renew(true);
  redirect(`/editor?${back ? `${back}&` : ""}saved=${ok ? "1" : "0"}#aavtikal`);
}

/** only photos the write page put in the photo store (app/api/editor/photo), at most 12 */
const editorPhotos = (list: unknown): NewStory["photos"] =>
  (Array.isArray(list) ? (list as NewStory["photos"]) : []).filter((p) => /^\/media\/live\/\d{4}-\d{2}-\d{2}\/ed-[a-z0-9]+\.jpg$/.test(String(p?.url)))
    .slice(0, 12).map((p) => ({ url: p.url, width: Math.round(Number(p.width)) || 1600, height: Math.round(Number(p.height)) || 1067 }));

/** a story the editor wrote (app/(gu)/editor/write): on the site at once, word for word */
export async function writeStory(x: NewStory): Promise<{ id: string } | { error: "missing" | "failed" }> {
  const { who, sql } = await signedIn();
  const clean = (t: unknown) => String(t ?? "").replace(/\r\n/g, "\n").trim();
  const story: NewStory = {
    headline: clean(x.headline), deck: clean(x.deck), body: clean(x.body).replace(/\n{3,}/g, "\n\n"), caption: clean(x.caption),
    tier: TIERS.includes(x.tier) ? x.tier : "gujarat",
    genre: x.genre && (GENRES as string[]).includes(x.genre) ? x.genre : null,
    photos: editorPhotos(x.photos),
  };
  if (!story.headline || !story.body) return { error: "missing" };
  if (!sql) return { error: "failed" };
  try {
    const id = await addStory(sql, story, who);
    renew();
    return { id };
  } catch (e) {
    console.error(`a written story not saved: ${e}`);
    return { error: "failed" };
  }
}
/** an Aavtikal article the editor wrote (the same page, ?for=aavtikal): in Aavtikal at once, word for word */
export async function writeFeature(x: NewFeature): Promise<{ id: string } | { error: "missing" | "failed" }> {
  const { who, sql } = await signedIn();
  const clean = (t: unknown) => String(t ?? "").replace(/\r\n/g, "\n").trim();
  const article: NewFeature = {
    headline: clean(x.headline), deck: clean(x.deck), body: clean(x.body).replace(/\n{3,}/g, "\n\n"), caption: clean(x.caption),
    beat: (["ai", "tech", "science", "politics"] as const).includes(x.beat) ? x.beat : "tech",
    photos: editorPhotos(x.photos),
  };
  if (!article.headline || !article.body) return { error: "missing" };
  if (!sql) return { error: "failed" };
  try {
    const id = await addFeature(sql, article, who);
    renew(true);
    return { id };
  } catch (e) {
    console.error(`a written article not saved: ${e}`);
    return { error: "failed" };
  }
}
/** the optional AI help on the same page: suggestions the editor may keep or undo (lib/aihelp.ts) */
export async function aiHelp(d: Draft, kind: "news" | "article" = "news"): Promise<Help> {
  const { sql } = await signedIn();
  if (!String(d?.body ?? "").trim()) return { ok: false, why: "failed" };
  return help(sql, { headline: String(d.headline ?? ""), deck: String(d.deck ?? ""), body: String(d.body).slice(0, 30_000) }, kind === "article" ? "article" : "news");
}

/** the leaders list (lib/leaders.ts): a leader looked up on Wikidata, added or changed, taken off */
export async function findLeaderAction(name: string): Promise<FoundLeader | null> {
  await signedIn();
  return findLeader(String(name ?? "")).catch(() => null);
}
export async function saveLeaderAction(x: Leader): Promise<boolean> {
  const { sql } = await signedIn();
  const s = (v: unknown) => String(v ?? "");
  const ok = await saveLeader(sql, { id: s(x.id), nameGu: s(x.nameGu), nameEn: s(x.nameEn), title: s(x.title), post: s(x.post), born: s(x.born), email: s(x.email), portrait: s(x.portrait), credit: s(x.credit) });
  if (ok) refresh();
  return ok;
}
export async function dropLeaderAction(id: string) { const { sql } = await signedIn(); await dropLeader(sql, id); refresh(); }

/** the classified ads (lib/classifieds.ts): one put up from the form, one taken down */
export async function addAdAction(back: string, f: FormData) {
  const { who, sql } = await signedIn();
  const v = (k: string) => String(f.get(k) ?? "").replace(/\r\n/g, "\n").trim();
  const ok = sql ? await addAd(sql, { kind: v("kind"), text: v("text"), contact: v("contact"), place: v("place"), days: Number(v("days")) }, who) : false;
  renew();
  redirect(`/editor?${back ? `${back}&` : ""}ad=${ok ? 1 : 0}#ads`);
}
export async function dropAdAction(id: string) { const { sql } = await signedIn(); if (sql) await dropAd(sql, id); renew(); }

// Instagram's sets (Insta.tsx, lib/insta.ts)
async function instaSet(id: string) {
  const { sql } = await signedIn();
  const set = sql ? await getSet(sql, id) : null;
  return { sql: sql!, set };
}
/** a card taken out, or given its next photo: the pictures are made again by the engine's next round */
export async function dropInstaCard(id: string, i: number) {
  const { sql, set } = await instaSet(id);
  if (!set || set.state !== "waiting" || set.cards.length <= MIN_KEPT || !set.cards[i]) return refresh();
  set.cards.splice(i, 1);
  set.caption = captionFor(set.tier, set.edition, set.cards);
  set.state = "making";
  await saveSet(sql, set);
  refresh();
}
export async function nextInstaPhoto(id: string, i: number) {
  const { sql, set } = await instaSet(id);
  const c = set?.cards[i];
  if (!set || set.state !== "waiting" || !c || c.options.length < 2) return refresh();
  c.pick = (c.pick + 1) % c.options.length;
  set.caption = captionFor(set.tier, set.edition, set.cards);
  set.state = "making";
  await saveSet(sql, set);
  refresh();
}
export async function captionInsta(id: string, f: FormData) {
  const { sql, set } = await instaSet(id);
  const caption = String(f.get("caption") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 2200);
  if (set && caption && set.state !== "posted") { set.caption = caption; await saveSet(sql, set); }
  refresh();
}
/** approved: put up at once when the account is connected, else kept approved for "Post now" */
export async function approveInsta(id: string) {
  const { sql, set } = await instaSet(id);
  if (!set || !set.image || !["waiting", "approved", "failed"].includes(set.state)) return refresh();
  set.state = "approved";
  set.note = "";
  await saveSet(sql, set);
  if (instagramOn()) {
    try {
      set.postUrl = await postSet(set);
      set.state = "posted";
      set.postedAt = new Date().toISOString();
      revalidatePath("/insta");
    } catch (e) {
      set.state = "failed";
      set.note = `ઇન્સ્ટાગ્રામે ના પાડી: ${e instanceof Error ? e.message : e}`.slice(0, 300);
    }
    await saveSet(sql, set);
  }
  refresh();
}
export async function skipInsta(id: string) {
  const { sql, set } = await instaSet(id);
  if (set && set.state !== "posted") { set.state = "expired"; await saveSet(sql, set); }
  refresh();
}
