// Steps 2 and 4 in one pass (ROADMAP §3): a free model reads new items 12 at
// a time (one request for 12 headlines keeps hundreds of sources within the
// free allowance) and gives each its importance to Capital Kranti's readers,
// its tier and genres, whether it's sensitive, one English line naming the
// event, and English keywords. The keywords group items about one event into
// a cluster, across Gujarati, Hindi and English (cluster()).
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { askGemini, askJson, geminiRemaining } from "./ai.ts";
import { sourceById } from "./sources.ts";
import type { Genre, Tier } from "../lib/types.ts";

type Sql = NeonQueryFunction<false, false>;
const BATCH = 12;
/** a batch for Gemini Flash Lite, whose tokens a minute are many times Groq's (5 Nov: 4,910 items in a day, twice the day
 *  before's, and Groq's free 200,000 tokens a day for each model sorted half of them; the rest went to the Gemmas, whose
 *  minute's tokens the writing needs, and 715 waited unsorted) */
const LITE_BATCH = 40;
/** Flash Lite requests kept for the writing, the translations and Aavtikal: below them the sorting goes back to Groq */
const LITE_KEPT_SORTING = 350;
const TIERS: Tier[] = ["gujarat", "india", "world"];
const GENRES: Genre[] = ["farm", "economy", "tech", "health", "sport", "education", "entertainment"];

export interface Triage {
  score: number; tier: Tier; genres: Genre[]; sensitive: boolean; event: string; keys: string[];
  /** a fact-checker's item: the false claim it debunks, in English */
  debunk?: string;
}
export interface TriageInput { i: number; source: string; lang: string; title: string; summary: string; factcheck: boolean }

const SYSTEM = `You are the news editor of Capital Kranti, a Gujarati daily newspaper and website from Gandhinagar, Gujarat, India.
You get a numbered list of new items from news sources (Gujarati, Hindi or English). For EACH item reply with:
- score: 0-10, how much it matters to Capital Kranti's readers (Gujaratis in Gujarat and India):
  9-10 a major event (a Gujarat or national government decision affecting many people, a disaster, a big court verdict, war, an election result);
  7-8 important (state or national policy, big economy or science news, major sport results involving India);
  5-6 worth a story; 3-4 worth a short brief; 0-2 not for us (local trivia from far away, celebrity gossip, opinion, ads, live blogs, quizzes, horoscopes).
  News about Gujarat counts more; world news only when it matters to India or is globally major.
  Routine government publicity is NOT news and scores 0-3 however official: awareness campaigns ("Special Campaign", Swachhata drives),
  meetings, reviews, courtesy calls, visits without a decision, greetings and condolence messages, book fairs, exhibitions, workshops,
  webinars, newsletters, "to visit"/"to inaugurate" announcements of minor events. A decision, a new scheme, money, a result, or a number
  that affects people is news.
- tier: "gujarat" ONLY when the event happens in Gujarat or is about Gujarat's government, people or places; "india" for national news and
  for news from any other state or city (Mumbai, Delhi, Rajasthan... are "india", even when a Gujarati outlet reports them);
  "world" for other countries, or India abroad.
- genres: up to 2 of "farm","economy","tech","health","sport","education","entertainment"; [] if none fit.
  "economy" is money and business: banks, insurance, taxes, prices, markets, companies, jobs, trade, budgets.
  "education" is schools, colleges, exams, textbooks, students and teachers.
  "tech" is ONLY technology and science (computers, internet, AI, space, research), never a government website or an app launch for a scheme.
  "health" is illness, hospitals, medicine, doctors; "farm" is crops, farmers, animals, irrigation, fishing.
- sensitive: true for deaths, accidents, crime, violence, communal matters, sexual offences, allegations against named people, health scares; else false.
- event: ONE short English line naming the specific event: who did what, where (e.g. "Gujarat cabinet approves ₹2,000 crore Narmada canal repair").
- keys: 4-8 lowercase English keywords for that event: the people, places, organisations, numbers (e.g. ["gujarat","cabinet","narmada","canal","2000 crore"]).
- debunk: ONLY for items marked factcheck: the false claim it debunks, in one English line; else "".
Reply with JSON only: {"items":[{"i":1,"score":0,"tier":"india","genres":[],"sensitive":false,"event":"","keys":[],"debunk":""}, ...]} with one entry for every item.`;

// The model sometimes files a Gujarati outlet's news from elsewhere under Gujarat (29 Oct: Mumbai's
// airport), and then names Gujarat in its own keywords too; so the check reads the sources' own words
// (headline and summary, in any script). A "gujarat" event whose sources name a place outside Gujarat
// and none in it is national news.
const GUJARAT = /\b(gujarat|ahmedabad|gandhinagar|surat|vadodara|baroda|rajkot|bhavnagar|jamnagar|junagadh|kutch|kachchh|bhuj|anand|nadiad|kheda|mehsana|patan|palanpur|banaskantha|sabarkantha|himmatnagar|panchmahal|godhra|dahod|bharuch|ankleshwar|valsad|vapi|navsari|tapi|dang|narmada|kevadia|ekta nagar|statue of unity|porbandar|dwarka|somnath|gir|amreli|botad|morbi|surendranagar|dholera|mundra|kandla|saurashtra|sabarmati|aravalli|modasa|mahisagar|chhota udepur|gift city|sanand|halol|diu|daman|bhupendra patel)\b|ગુજરાત|અમદાવાદ|ગાંધીનગર|સુરત|વડોદરા|રાજકોટ|ભાવનગર|જામનગર|જૂનાગઢ|કચ્છ|ભુજ|આણંદ|નડિયાદ|મહેસાણા|પાટણ|પાલનપુર|ગોધરા|દાહોદ|ભરૂચ|વલસાડ|વાપી|નવસારી|નર્મદા|કેવડિયા|એકતાનગર|પોરબંદર|દ્વારકા|સોમનાથ|અમરેલી|બોટાદ|મોરબી|સુરેન્દ્રનગર|સૌરાષ્ટ્ર|સાબરમતી|ભૂપેન્દ્ર પટેલ|गुजरात|अहमदाबाद|गांधीनगर|सूरत|वडोदरा|राजकोट/i;
const ELSEWHERE = /\b(maharashtra|mumbai|pune|nagpur|thane|delhi|rajasthan|jaipur|udaipur|madhya pradesh|bhopal|indore|uttar pradesh|lucknow|noida|ayodhya|varanasi|bihar|patna|karnataka|bengaluru|bangalore|tamil nadu|chennai|kerala|kochi|west bengal|kolkata|telangana|hyderabad|andhra|punjab|chandigarh|haryana|gurugram|goa|odisha|assam|jharkhand|chhattisgarh|uttarakhand|himachal|kashmir|srinagar|ladakh|manipur|mizoram|nagaland|meghalaya|tripura|sikkim|arunachal|mial)\b|મુંબઈ|મુંબઇ|મહારાષ્ટ્ર|પુણે|દિલ્હી|રાજસ્થાન|જયપુર|મધ્યપ્રદેશ|ઉત્તરપ્રદેશ|બિહાર|કર્ણાટક|બેંગલુરુ|તમિલનાડુ|ચેન્નાઈ|કેરળ|બંગાળ|કોલકાતા|તેલંગાણા|હૈદરાબાદ|પંજાબ|હરિયાણા|ગોવા|ઓડિશા|આસામ|કાશ્મીર|मुंबई|महाराष्ट्र|दिल्ली|राजस्थान|जयपुर|मध्य प्रदेश|उत्तर प्रदेश|बिहार|कर्नाटक|बेंगलुरु|तमिलनाडु|केरल|बंगाल|कोलकाता|तेलंगाना|हैदराबाद|पंजाब|हरियाणा|गोवा|ओडिशा|असम|कश्मीर/i;
// 5 Nov: national news from English and Hindi sources (an insurance scheme, a textbook) was filed under Gujarat with no
// Gujarat place in its words; so a report not in Gujarati must name one (a Gujarati outlet's local news often names only a
// village or a ward, which the list can't hold).
export function placeTier(tier: Tier, sourceWords: string, lang?: string): Tier {
  if (tier !== "gujarat" || GUJARAT.test(sourceWords)) return tier;
  return ELSEWHERE.test(sourceWords) || (lang && lang !== "gu") ? "india" : tier;
}

function checkBatch(n: number) {
  return (v: unknown): Map<number, Triage> | null => {
    const list = (v as { items?: unknown[] })?.items;
    if (!Array.isArray(list)) return null;
    const out = new Map<number, Triage>();
    for (const x of list as Record<string, unknown>[]) {
      const i = Number(x.i);
      if (!Number.isInteger(i) || i < 1 || i > n) continue;
      const keys = (Array.isArray(x.keys) ? x.keys : []).map((k) => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 10);
      out.set(i, {
        score: Math.max(0, Math.min(10, Number(x.score) || 0)),
        tier: TIERS.includes(x.tier as Tier) ? (x.tier as Tier) : "india",
        genres: (Array.isArray(x.genres) ? x.genres : []).filter((g): g is Genre => GENRES.includes(g as Genre)).slice(0, 2),
        sensitive: x.sensitive === true,
        event: String(x.event ?? "").slice(0, 200),
        keys,
        debunk: String(x.debunk ?? "").slice(0, 300) || undefined,
      });
    }
    // most of the batch answered (a long answer cut short keeps what it finished), or it's not trusted
    return out.size >= Math.ceil(n * 0.6) ? out : null;
  };
}

/** One batch through a free model: Flash Lite for a big batch (`lite`), else Groq's and the Gemmas (no database: those). */
export async function triageBatch(sql: Sql | null, batch: TriageInput[], lite = false) {
  const user = batch.map((b) => `${b.i}. [${b.source}${b.factcheck ? ", factcheck" : ""}, ${b.lang}] ${b.title}${b.summary ? ` -- ${b.summary.slice(0, 220)}` : ""}`).join("\n");
  const ask = { system: SYSTEM, user, maxTokens: lite ? 16000 : 8000, small: true, temperature: 0.1 };
  const res = lite && sql
    ? await askGemini(sql, "lite", ask, checkBatch(batch.length), { wait: false, timeoutMs: 90_000 }).then((r) => (r.ok ? r : askJson(sql, ask, checkBatch(batch.length))))
    : await askJson(sql, ask, checkBatch(batch.length));
  if (res.ok) for (const [i, tr] of res.value) tr.tier = placeTier(tr.tier, `${batch[i - 1].title} ${batch[i - 1].summary}`, batch[i - 1].lang);
  return res;
}

/** batches sorted at once (4 Nov: one at a time, a round's sorting took minutes of waiting on one model's answer) */
const SIDE_BY_SIDE = 2;

/** Every untriaged item, newest first, as far as the run's share of the allowance goes. */
export async function triage(sql: Sql, log: (s: string) => void, maxBatches: number, deadline: number) {
  let done = 0, batches = 0;
  while (batches < maxBatches && Date.now() < deadline) {
    const take = Math.min(SIDE_BY_SIDE, maxBatches - batches);
    const lite = (await geminiRemaining(sql, "lite")) > LITE_KEPT_SORTING;
    const size = lite ? LITE_BATCH : BATCH;
    const all = await sql.query(`select id, source, lang, title, summary from items where triage is null order by seen_at desc limit ${size * take}`);
    if (!all.length) break;
    const groups = Array.from({ length: Math.ceil(all.length / size) }, (_, g) => all.slice(g * size, (g + 1) * size));
    const results = await Promise.all(groups.map(async (rows) => {
      const input: TriageInput[] = rows.map((r, k) => ({ i: k + 1, source: sourceById.get(r.source as string)?.name ?? (r.source as string),
        lang: r.lang as string, title: r.title as string, summary: r.summary as string, factcheck: sourceById.get(r.source as string)?.trust === "factcheck" }));
      const res = await triageBatch(sql, input, lite);
      if (!res.ok) { log(`  triage: ${res.why}`); return res; }
      // the whole batch in one write (5 Nov: one a row, 40 round trips a batch)
      await sql.query(`update items set triage = v.t::jsonb from unnest($1::text[], $2::text[]) as v(id, t) where items.id = v.id`,
        [rows.map((r) => r.id), rows.map((_, k) => JSON.stringify(res.value.get(k + 1) ?? { skipped: "no answer" }))]);
      done += res.value.size;
      return res;
    }));
    batches += groups.length;
    if (results.some((r) => !r.ok && r.stop)) return { done, stop: true };
  }
  log(`  triaged ${done} item(s) in ${batches} request(s)`);
  return { done, stop: false };
}

// ---- clustering: one event, however many sources and languages report it ----

const STOP = new Set(["the", "a", "of", "in", "on", "and", "to", "for", "india", "indian", "government", "govt", "says", "said", "new"]);
export const keySet = (keys: string[]) => new Set(keys.flatMap((k) => k.split(/[\s/-]+/)).map((k) => k.replace(/[^\p{L}\p{N}.]/gu, "")).filter((k) => k.length > 1 && !STOP.has(k)));
export function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let both = 0;
  for (const k of a) if (b.has(k)) both++;
  return both / Math.min(a.size, b.size);
}
/** Two items are one event when most of the shorter keyword set is shared (and at least 3 words). */
export const SAME_EVENT = 0.6;

// Two clusters can grow for one event when its reports share too few keywords (29 Oct: Spain's train
// crash went up twice, minutes apart). Before a cluster is written, the stories of the last two days that
// share words with it are put to a free model; when one is the same incident, the cluster joins it.
const SAME = `You compare news events. You get one NEW event and a numbered list of EARLIER events, each earlier one with
the story already published about it. Answer with the number of the earlier event that is the SAME real-world incident or
decision (the same crash, the same verdict, the same announcement), even when the wording, numbers or angle differ.
Different parts or details of one decision are the SAME event: a cabinet's changes to one scheme (longer service, higher
pay, permanent posts) told in separate reports, one budget's different measures, one match's different records.
A different incident on the same topic (another crash, another verdict), or someone else's later reaction or own
decision (a state announcing its own quota for the scheme's members) is NOT the same.
Reply with JSON only: {"same": 0} when none is.`;

/** The words of an event line, as keywords */
const eventWords = (event: string) => keySet(event.toLowerCase().split(/\s+/));

/** Two events close enough in words to be one told two ways (sameEvent's rule for asking a model): two shared keywords,
 *  or three words of their event lines */
export function nearEvent(a: { event: string; keys: string[] }, b: { event: string; keys: string[] }) {
  const ka = keySet(a.keys.map((k) => k.toLowerCase()));
  let both = 0, words = 0;
  for (const k of keySet(b.keys.map((k) => k.toLowerCase()))) if (ka.has(k)) both++;
  const la = eventWords(a.event);
  for (const k of eventWords(b.event)) if (la.has(k)) words++;
  return both >= 2 || words >= 3;
}

/** The published or held cluster (last 48 hours) that is the same event as this one, or null; "unsure" when the free
 *  models couldn't answer (the caller waits for a later round rather than risk a second copy). Earlier events are put to
 *  the model when they share two keywords, or three words of the event line (2 Nov: "India squad announced for Asia
 *  Cup including Rinku Singh" and "BCCI announces India A squad for Rising Stars Asia Cup" went up as two stories). */
export async function sameEvent(sql: Sql, c: { id: string; event: string; keys: string[]; before?: string }): Promise<{ id: string; story: string } | "unsure" | null> {
  const mine = keySet(c.keys.map((k) => k.toLowerCase()));
  const line = eventWords(c.event);
  const rows = await sql.query(
    `select id, event, keys, story_id from clusters where id <> $1 and story_id is not null and state in ('published', 'held')
       and first_seen > now() - interval '48 hours' and ($2::timestamptz is null or first_seen < $2)`, [c.id, c.before ?? null]);
  const near = rows.map((r) => {
    let both = 0, words = 0;
    for (const k of keySet((r.keys as string[]).map((k) => k.toLowerCase()))) if (mine.has(k)) both++;
    for (const k of eventWords(r.event as string)) if (line.has(k)) words++;
    return { id: r.id as string, story: r.story_id as string, event: r.event as string, both, words };
  }).filter((r) => r.both >= 2 || r.words >= 3).sort((a, b) => b.both + b.words - a.both - a.words).slice(0, 6);
  if (!near.length) return null;
  // already told "none of these" about the same earlier events: not asked again (5 Nov: the same events were asked about
  // round after round while each waited its turn to be written)
  const key = `twin:${c.id}`;
  const [told0] = await sql.query(`select value from state where key = $1`, [key]);
  const cleared = new Set(String(told0?.value ?? "").split(",").filter(Boolean));
  if (near.every((r) => cleared.has(r.id))) return null;
  // each event with the headlines of two of its reports: the one-line event can mislead (2 Nov: "India squad announced
  // for Asia Cup including Rinku Singh" was the India A squad for the Rising Stars Asia Cup, judged a different event)
  const heads = await sql.query(
    `select cluster_id, string_agg(left(title, 140), ' | ') as titles from (select cluster_id, title, row_number() over (partition by cluster_id order by seen_at) as n
       from items where cluster_id = any($1::text[])) t where n <= 2 group by cluster_id`, [[c.id, ...near.map((r) => r.id)]]);
  // and the story already up about each earlier one (4 Nov: three stories of the Agniveers' one cabinet decision went up,
  // its event lines alone told apart as "permanent recruitment" and "extra years and higher pay")
  const ours = new Map((await sql.query(`select id, coalesce(en->>'headline', headline) as h, coalesce(en->>'deck', deck) as d from stories where id = any($1::text[])`,
    [near.map((r) => r.story)])).map((r) => [r.id as string, `${r.h} - ${r.d}`.slice(0, 260)]));
  const told = (id: string, event: string, story?: string) => {
    const t = heads.find((h) => h.cluster_id === id)?.titles;
    return `${event}${t ? ` (reports: ${t})` : ""}${story && ours.has(story) ? ` [published: ${ours.get(story)}]` : ""}`;
  };
  const res = await askJson(sql, { system: SAME, user: `NEW: ${told(c.id, c.event)}\n\nEARLIER:\n${near.map((r, i) => `${i + 1}. ${told(r.id, r.event, r.story)}`).join("\n")}`, maxTokens: 60, small: true },
    (v) => { const n = Number((v as { same?: unknown })?.same); return Number.isInteger(n) && n >= 0 && n <= near.length ? n : null; });
  if (!res.ok) return "unsure";
  if (res.value === 0) await sql.query(`insert into state (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value`,
    [key, [...new Set([...cleared, ...near.map((r) => r.id)])].join(",")]);
  return res.value > 0 ? near[res.value - 1] : null;
}

/** Triaged, unclustered news items into clusters (new ones, or joining one from the last 2 days). */
export async function cluster(sql: Sql, log: (s: string) => void) {
  const items = await sql.query(
    `select id, source, triage from items where cluster_id is null and triage is not null and not (triage ? 'skipped')
      order by seen_at asc limit 500`);
  const recent = (await sql.query(`select id, keys, state from clusters where updated_at > now() - interval '48 hours'`))
    .map((c) => ({ id: c.id as string, keys: keySet(c.keys as string[]), state: c.state as string }));
  let joined = 0, created = 0, ignored = 0;
  for (const it of items) {
    const t = it.triage as Triage;
    const src = sourceById.get(it.source as string);
    if (src?.trust === "factcheck") { await sql.query(`update items set cluster_id = 'factcheck' where id = $1`, [it.id]); continue; }
    if (t.score < 3) { await sql.query(`update items set cluster_id = 'ignored' where id = $1`, [it.id]); ignored++; continue; }
    const keys = keySet(t.keys);
    let best: { id: string; s: number; keys: Set<string> } | null = null;
    for (const c of recent) {
      const s = similarity(keys, c.keys);
      let both = 0;
      for (const k of keys) if (c.keys.has(k)) both++;
      if (s >= SAME_EVENT && both >= 3 && (!best || s > best.s)) best = { id: c.id, s, keys: c.keys };
    }
    if (best) {
      await sql.query(
        `update clusters set updated_at = now(), score = greatest(score, $2), sensitive = sensitive or $3,
           genres = (select array(select distinct unnest(genres || $4::text[]))), keys = (select array(select distinct unnest(keys || $5::text[])))[1:16]
         where id = $1`, [best.id, t.score, t.sensitive, t.genres, t.keys]);
      await sql.query(`update items set cluster_id = $2 where id = $1`, [it.id, best.id]);
      for (const k of keys) best.keys.add(k);
      joined++;
    } else {
      const id = `c${(it.id as string).slice(0, 12)}`;
      await sql.query(
        `insert into clusters (id, event, keys, tier, genres, sensitive, score) values ($1, $2, $3, $4, $5, $6, $7) on conflict (id) do nothing`,
        [id, t.event || "(no event line)", t.keys, t.tier, t.genres, t.sensitive, t.score]);
      await sql.query(`update items set cluster_id = $2 where id = $1`, [it.id, id]);
      recent.push({ id, keys, state: "new" });
      created++;
    }
  }
  log(`  clusters: ${created} new, ${joined} item(s) joined one, ${ignored} not for us`);
}
