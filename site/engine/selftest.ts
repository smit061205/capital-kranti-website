// The engine's own checks, without the network, the database or the AI (CI runs
// it: site-engine.yml): feeds read right, an event is confirmed only by an
// official source or a listed outlet, old news and debunked claims are
// stopped, copied wording is caught, and items about one event group together.
// Run: node --experimental-strip-types site/engine/selftest.ts
import assert from "node:assert/strict";
import { readJson } from "./ai.ts";
import { ownItem } from "./collect.ts";
import { parseFeed, pageText } from "./feed.ts";
import { copiedShare, cutUnsupported, gate, importance, lengthFor, levelOf, sentencesOf, thin, toGujarati, type ClusterItem, type SourceText } from "./newsroom.ts";
import { SOURCES, sourceById } from "./sources.ts";
import { numbersNotIn } from "./text.ts";
import { keySet, placeTier, similarity, SAME_EVENT } from "./triage.ts";
import { coverTier } from "./cover.ts";
import { commonsAt } from "./wikiphoto.ts";

let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log(`ok  ${name}`); };
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const item = (source: string, keys: string[], h = 1, score = 7): ClusterItem => ({
  id: `${source}-${h}`, source, url: `https://${sourceById.get(source)!.hosts[0]}/a`, title: "t", summary: "", lang: "en",
  publishedAt: hoursAgo(h), seenAt: hoursAgo(h), image: null,
  triage: { score, tier: "india", genres: [], sensitive: false, event: "e", keys },
});

test("RSS 2.0 with CDATA, entities and media", () => {
  const xml = `<rss><channel><item><title><![CDATA[Cabinet &amp; budget]]></title><link>https://example.com/a?x=1&amp;y=2</link>
    <description>&lt;p&gt;Summary here&lt;/p&gt;</description><pubDate>Sun, 25 Oct 2026 10:00:00 GMT</pubDate>
    <media:content url="https://example.com/p.jpg" /></item></channel></rss>`;
  const [it] = parseFeed(xml, "https://example.com/");
  assert.equal(it.title, "Cabinet & budget");
  assert.equal(it.url, "https://example.com/a?x=1&y=2");
  assert.equal(it.summary, "Summary here");
  assert.equal(it.publishedAt, "2026-10-25T10:00:00.000Z");
  assert.equal(it.image, "https://example.com/p.jpg");
});
test("Atom with alternate links", () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>UK news</title><link rel="alternate" href="/gov/x"/>
    <updated>2026-10-25T09:00:00Z</updated><summary>s</summary></entry></feed>`;
  const [it] = parseFeed(xml, "https://www.gov.uk/");
  assert.equal(it.url, "https://www.gov.uk/gov/x");
});
test("RDF (RSS 1.0) items", () => {
  const xml = `<rdf:RDF><item rdf:about="https://www.dw.com/a"><title>DW item</title><link>https://www.dw.com/a</link><dc:date>2026-10-25T08:00:00Z</dc:date></item></rdf:RDF>`;
  assert.equal(parseFeed(xml, "https://rss.dw.com/").length, 1);
});
test("a page's text skips menus and keeps paragraphs", () => {
  const html = `<nav><p>Home About Contact and many other menu links here</p></nav><article><p>The cabinet approved the new canal repair plan for north Gujarat today.</p></article>
    <meta property="og:image" content="https://x/y.jpg">`;
  const p = pageText(html);
  assert.match(p.text, /cabinet approved/);
  assert.doesNotMatch(p.text, /Home About/);
  assert.equal(p.image, "https://x/y.jpg");
});
test("an item linking off the source's own site isn't its own", () => {
  const bbc = sourceById.get("bbc-world")!;
  assert.ok(ownItem(bbc, "https://www.bbc.com/news/world-1"));
  assert.ok(!ownItem(bbc, "https://evil.example/bbc.com/news"));
});
test("an official source confirms on its own", () => {
  const g = gate([item("pib-en", ["cabinet", "canal", "gujarat"])], []);
  assert.equal(g.state, "confirmed");
});
test("one outlet is enough on its own", () => {
  assert.equal(gate([item("bbc-world", ["a", "b", "c"])], []).state, "confirmed");
  assert.equal(gate([item("ndtv", ["a"], 1)], []).state, "confirmed");
  assert.equal(gate([item("bbc-world", ["a"]), item("the-hindu", ["a"])], []).state, "confirmed");
});
test("old news going round again is dropped", () => {
  assert.equal(gate([item("pib-en", ["a"], 72)], []).state, "dropped");
});
test("a debunked claim is blocked", () => {
  const keys = ["rbi", "500", "note", "ban", "withdrawn"];
  const g = gate([item("pib-en", keys)], [{ claim: "RBI withdraws ₹500 notes", keys: ["rbi", "500", "note", "withdrawn"], url: "u", source: "altnews" }]);
  assert.equal(g.state, "blocked");
});
test("Hindi letters become Gujarati ones", () => {
  assert.equal(toGujarati("નંदन नीलेकणि।"), "નંદન નીલેકણિ.");
});
test("the number check passes true figures and still catches made-up ones", () => {
  assert.deepEqual(numbersNotIn("કુલ ૪૧,૭૪,૦૦૦ મતદારો", "41.74 lakh voters"), []);
  assert.deepEqual(numbersNotIn("સવારે ૧૦:૦૦ વાગ્યે", "at 10 am"), []);
  assert.deepEqual(numbersNotIn("ટીવી9ના અહેવાલ મુજબ", "a report\n\nટીવી9 ગુજરાતી"), []);
  assert.deepEqual(numbersNotIn("કુલ ૪૨,૦૦,૦૦૦ મતદારો", "41.74 lakh voters"), ["42,00,000"]);
});
test("copied wording is caught, our own words aren't", () => {
  const src = "રાજ્ય સરકારે આજે નર્મદા નહેરના સમારકામ માટે બે હજાર કરોડ રૂપિયાની યોજનાને મંજૂરી આપી હતી અને કામ તરત શરૂ થશે";
  assert.ok(copiedShare(src, src) > 0.9);
  assert.ok(copiedShare("નર્મદા નહેરના સમારકામ માટે સરકારે યોજના મંજૂર કરી; કામ ઝડપથી શરૂ કરવાની વાત છે અને ખર્ચ મોટો છે", src) < 0.12);
});
test("one event across languages groups by its English keywords", () => {
  const a = keySet(["gujarat", "cabinet", "narmada canal", "2000 crore"]);
  const b = keySet(["narmada", "canal", "repair", "gujarat", "cabinet"]);
  const c = keySet(["isro", "launch", "pslv", "sriharikota"]);
  assert.ok(similarity(a, b) >= SAME_EVENT);
  assert.ok(similarity(a, c) < SAME_EVENT);
});
test("importance: Gujarat news weighs more; more independent sources raise it", () => {
  assert.ok(importance(8, "gujarat", 1, true) > importance(8, "world", 1, true));
  assert.ok(importance(6, "india", 3, false) > importance(6, "india", 1, false));
  assert.equal(levelOf(2), null);
  assert.equal(levelOf(9.6), "lead");
});
test("every source has an id, a group, and its own hosts; ids are unique", () => {
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  for (const s of SOURCES) assert.ok(s.group && s.hosts.length && (s.url.startsWith("pib:") || s.url.startsWith("http")), s.id);
});
test("a model's JSON is read from a fence, and a cut-off list keeps its finished entries", () => {
  assert.deepEqual(readJson("```json\n{\"a\":1}\n```"), { a: 1 });
  assert.deepEqual(readJson('Here: {"items":[{"i":1},{"i":2},{"i":3,"x"'), { items: [{ i: 1 }, { i: 2 }] });
  assert.equal(readJson("no json at all"), undefined);
});
test("news from outside Gujarat isn't filed under Gujarat", () => {
  assert.equal(placeTier("gujarat", "MIAL asks airlines to submit Navi Mumbai flight shift plans by November 3"), "india");
  assert.equal(placeTier("gujarat", "એરલાઇન્સ નવી મુંબઈ એરપોર્ટ પર ફ્લાઇટ્સ શિફ્ટ કરે"), "india");
  assert.equal(placeTier("gujarat", "Mumbai-Ahmedabad bullet train reaches Surat"), "gujarat");
  assert.equal(placeTier("gujarat", "ભૂપેન્દ્ર પટેલ દિલ્હીમાં વડાપ્રધાનને મળ્યા"), "gujarat");
  assert.equal(placeTier("gujarat", "વડોદરામાં સોની પરિવારના ત્રણ સભ્યોએ આત્મહત્યા કરી"), "gujarat");
  assert.equal(placeTier("india", "Delhi air quality"), "india");
});
test("a cover from Commons is asked for at Wikimedia's own sizes, never larger than its original", () => {
  const p = { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/A.jpg/1280px-A.jpg?utm_source=x", width: 1280, height: 720, full: 4000 };
  assert.deepEqual(commonsAt(p, 1920), { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/A.jpg/1920px-A.jpg", width: 1920, height: 1080 });
  assert.equal(commonsAt({ ...p, full: 1500 }, 1920).url, "https://upload.wikimedia.org/wikipedia/commons/c/c5/A.jpg");
  // an original is never asked for on the thumbnail server (30 Oct: a broken picture)
  assert.equal(commonsAt({ ...p, url: p.url.replace("upload.", "thumb."), full: 1500 }, 1920).url, "https://upload.wikimedia.org/wikipedia/commons/c/c5/A.jpg");
});
test("only a real, large, landscape picture goes at the top", () => {
  const big = { full: 3000, ratio: 1.5, official: false };
  assert.equal(coverTier({ shows: "subject", kind: "photo", cover: 9 }, big), 3);
  assert.equal(coverTier({ shows: "related", kind: "photo", cover: 8 }, big), 1);
  assert.equal(coverTier({ shows: "subject", kind: "generated", cover: 10 }, big), 0);
  assert.equal(coverTier({ shows: "subject", kind: "illustration", cover: 9 }, big), 0);
  assert.equal(coverTier({ shows: "subject", kind: "illustration", cover: 9 }, { ...big, official: true }), 2);
  assert.equal(coverTier({ shows: "subject", kind: "photo", cover: 9 }, { ...big, ratio: 0.73 }), 0);
  assert.equal(coverTier({ shows: "subject", kind: "photo", cover: 9 }, { ...big, full: 900 }), 0);
  assert.equal(coverTier({ shows: "unrelated", kind: "photo", cover: 9 }, big), 0);
  assert.equal(coverTier({ shows: "subject", kind: "photo", cover: 9, other: true }, big), 0);
});
test("a story from a short source is short, and unsupported lines are cut, not the story", () => {
  const src = (words: number) => [{ text: Array(words).fill("w").join(" ") } as SourceText];
  assert.deepEqual(lengthFor("normal", src(60)), [80, 112]);
  assert.equal(lengthFor("normal", src(500))[0], 500);
  // Wikipedia's background adds a paragraph, and doesn't count as the news
  assert.deepEqual(lengthFor("normal", [...src(60), { text: Array(200).fill("w").join(" "), background: true } as SourceText]), [154, 216]);
  assert.ok(thin("normal", [...src(60), { text: Array(900).fill("w").join(" "), background: true } as SourceText]));
  const body = "ડૉ. શાહે આજે નવી યોજના જાહેર કરી. તેમાં ૫૦ ગામ જોડાશે.\n\nઆ યોજના રાજ્યને નવી ઊંચાઈએ લઈ જશે. કામ જાન્યુઆરીમાં શરૂ થશે.";
  assert.equal(sentencesOf(body).length, 4);
  assert.ok(sentencesOf(body)[0].text.startsWith("ડૉ. શાહે"));
  const w = { kicker: "", headline: "h", deck: "d", body, caption: "", model: "" };
  const cut = cutUnsupported(w, [{ claim: "new heights", supported: false, where: "", sentence: "S3" }, { claim: "50", supported: true, where: "" }], 5);
  assert.equal(cut?.written.body, "ડૉ. શાહે આજે નવી યોજના જાહેર કરી. તેમાં ૫૦ ગામ જોડાશે.\n\nકામ જાન્યુઆરીમાં શરૂ થશે.");
  assert.equal(cutUnsupported(w, [{ claim: "x", supported: false, where: "", sentence: "H" }], 5), null);
  assert.equal(cutUnsupported(w, [{ claim: "x", supported: false, where: "", sentence: "" }], 5), null);
  assert.equal(cutUnsupported(w, [{ claim: "x", supported: false, where: "", sentence: "S1" }], 50), null);
});
console.log(`\n${n} checks passed (${SOURCES.length} sources listed)`);
