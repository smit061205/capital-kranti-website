// The front page (DESIGN.md §3.3): a stack of containers. Containers with no
// stories yet simply don't show (phase A has only the evening paper's).
import type { Lang, Story } from "../lib/types.ts";
import { elsewhere, latestStories, moreOnSubject, mostRead } from "../lib/db.ts";
import { href, t } from "../lib/i18n.ts";
import { sectionName } from "../lib/sections.ts";
import { Cmp, ElsewhereRow, Head, Join, LatestList, MostRead, Pictured, Std, strong, TopStory } from "../components/cards.tsx";
import Link from "next/link";
import { pic, SIZES } from "../lib/photo.ts";
import Frame from "../components/Frame.tsx";
import { PAPER } from "../lib/site.ts";
import { beatName, featureWords, features, flw, type Feature } from "../lib/flagship.ts";

const inSection = (s: Story, key: string) => s.tier === key || s.genres.includes(key as never);
const BELOW = ["gujarat", "india", "farm", "economy", "tech", "health", "sport", "education", "entertainment"];

// The sections below the top, after the Post's front page: a section with
// plenty of news gets a full-width row (its best photo story, then columns of
// headlines); the stories of the sections with only a few go together into one
// grid of cards, each with its section's name, cut to whole rows of four so no
// row is left half empty. A story shows once on the page, in the first section it belongs to.
// Each section's newest stories, newest first, led by the most important of the last day, one with a photo
// if it has one (29 Oct: farming was led by a week-old photo story above one of ten hours before).
const newest = (a: Story, b: Story) => b.publishedAt.localeCompare(a.publishedAt);
function freshFirst(list: Story[]): Story[] {
  const day = list.filter((s) => Date.now() - Date.parse(s.publishedAt) < 24 * 3600_000)
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0) || newest(a, b));
  const lead = day.find(strong) ?? day[0] ?? list.find(strong) ?? list[0];
  return lead ? [lead, ...list.filter((s) => s !== lead)] : list;
}
function sectionBoxes(stories: Story[], shown: Set<string>) {
  const used = new Set(shown);
  const wide: { k: string; list: Story[] }[] = [];
  const few: { k: string; s: Story }[] = [];
  for (const k of [...BELOW, "world"]) {
    const list = freshFirst(stories.filter((s) => inSection(s, k) && !used.has(s.id)).sort(newest).slice(0, 3));
    if (!list.length) continue;
    list.forEach((s) => used.add(s.id));
    if (list.length === 3) wide.push({ k, list });
    else few.push(...list.map((s) => ({ k, s })));
  }
  few.sort((a, b) => newest(a.s, b.s));
  return { wide: wide.slice(0, 6), few: few.length >= 3 ? few.slice(0, Math.min(6, few.length - few.length % 3)) : few };
}

/** Every section is built the same way, as the top is: its words on the left, its photo on the right; three headlines side by side when it has no good photo. */
function WideBox({ k, list, lang }: { k: string; list: Story[]; lang: Lang }) {
  const [first, ...rest] = list;
  return (
    <section className="block wide">
      <Head label={sectionName(k, lang)} to={href(lang, `/section/${k}`)} />
      {strong(first) ? (
        <div className="pk">
          <div className="pk-t"><Std s={first} lang={lang} sec={false} photo={false} />{rest.slice(0, 2).map((s) => <Cmp key={s.id} s={s} lang={lang} />)}</div>
          <div className="pk-p"><Pictured s={first} lang={lang} own={false} /></div>
        </div>
      ) : <div className="tri">{list.slice(0, 3).map((s) => <Std key={s.id} s={s} lang={lang} sec={false} photo={false} />)}</div>}
    </section>
  );
}

/** Aavtikal's newest, in the right-hand column: one with its picture, two headlines. */
function AavtikalBox({ list, lang }: { list: Feature[]; lang: Lang }) {
  return (
    <div>
      <Head label={flw(lang).name} to={href(lang, "/aavtikal")} />
      {list.map((f, i) => {
        const w = featureWords(f, lang);
        return (
          <Link prefetch={false} key={f.id} className="h av" href={href(lang, `/aavtikal/p/${f.id}`)} lang={w.translated || lang === "gu" ? lang : "gu"}>
            {i === 0 && f.photo && <span className="phw"><img className="ph" {...pic(f.photo, SIZES.thumb)} width={f.photo.width} height={f.photo.height} alt="" loading="lazy" decoding="async" /></span>}
            <span className="lbl">{beatName(f.beat, lang)}</span>
            <h3 className="h4">{w.headline}</h3>
          </Link>
        );
      })}
    </div>
  );
}

export default async function Home({ lang }: { lang: Lang }) {
  const stories = await latestStories(200);
  const day = stories[0]?.issueDate;
  const today = stories.filter((s) => s.issueDate === day);
  // the lead: the engine's most important story of the last 12 hours when it's
  // headline-sized (ROADMAP §0.1), else the newest day's front page. Fresh first, never
  // an old story (the user, 29 Oct); among the fresh ones, one with a photo (the engine
  // gives them official or Commons file photos), else the biggest across the page.
  const fresh = stories.filter((s) => s.origin === "live" && Date.now() - Date.parse(s.publishedAt) < 12 * 3600_000 && (s.importance ?? 0) >= 7.5)
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0) || b.publishedAt.localeCompare(a.publishedAt));
  const lead = fresh.find(strong) ?? fresh[0] ?? today.find((s) => strong(s) && s.page === 1) ?? today.find(strong) ?? today[0];
  // under the lead, its subject's other stories; below the top, what readers open most; Aavtikal's newest
  const [more, read, articles, others] = await Promise.all([lead ? moreOnSubject(lead.id) : [], mostRead(16), features({ limit: 6 }), elsewhere(lang)]);
  // the big photo in the middle of the top: the lead's own, else the newest strong one of the last day and a half
  const pictured = lead && (strong(lead) ? lead : stories.find((s) => strong(s) && Date.now() - Date.parse(s.publishedAt) < 36 * 3600_000));
  // the next stories: two under the lead, three across below it; today's paper first, then the newest
  const pool = [...today, ...stories.filter((s) => s.issueDate !== day)].filter((s) => s !== lead && s !== pictured).slice(0, 5);
  const side = pool.slice(0, 2), row = pool.slice(2, 5);
  const shown = new Set([lead, pictured, ...pool].filter(Boolean).map((s) => s!.id));
  // the latest list beside them: newest first, without the stories already at the top
  const byTime = stories.filter((s) => !shown.has(s.id))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || (a.page ?? 9) - (b.page ?? 9) || (a.rank ?? 99) - (b.rank ?? 99));
  // a story shows once on the page (2 Nov): most read and the sections leave out what's already above them
  const rail = byTime.slice(0, 10);
  rail.forEach((s) => shown.add(s.id));
  const most = read.filter((s) => !shown.has(s.id)).slice(0, 5);
  most.forEach((s) => shown.add(s.id));
  const { wide, few } = sectionBoxes(stories, shown);

  return (
    <Frame lang={lang} path="/" active="home">
      {/* the page's name for screen readers and search engines (the wordmark above is a link) */}
      <h1 className="vh">{PAPER[lang].name}: {PAPER[lang].tagline}</h1>
      {!lead ? <p className="empty">{t(lang, "empty")}</p> : (
        <>
          <div className="pg">
            <div className="pg-m">
              <section className={`pk first${pictured ? "" : " nop"}`}>
                <div className="pk-t">
                  <TopStory s={lead} lang={lang} more={more} />
                  {side.map((s) => <Cmp key={s.id} s={s} lang={lang} />)}
                </div>
                {pictured && <div className={`pk-p${pictured === lead ? " same" : ""}`}><Pictured s={pictured} lang={lang} own={pictured !== lead} /></div>}
              </section>
              {row.length === 3 && <div className="tri">{row.map((s) => <Std key={s.id} s={s} lang={lang} photo={false} />)}</div>}
              <section className="block phone-latest"><Head label={t(lang, "latestTitle")} to={href(lang, "/latest")} /><LatestList stories={rail} lang={lang} n={6} /></section>
              {wide.map((b) => <WideBox key={b.k} k={b.k} list={b.list} lang={lang} />)}
              {few.length >= 3 && (
                <section className="block"><Head label={t(lang, "moreNews")} />
                  <div className="tri">{few.map(({ k, s }) => <Std key={s.id} s={s} lang={lang} sec={false} label={sectionName(k, lang)} photo={false} />)}</div>
                </section>
              )}
              {others.length >= 4 && <ElsewhereRow items={others} lang={lang} />}
            </div>
            <aside className="pg-r"><div className="pg-in">
              <div className="r-latest"><Head label={t(lang, "latestTitle")} to={href(lang, "/latest")} /><LatestList stories={rail} lang={lang} n={10} /></div>
              {most.length >= 3 && <div><Head label={t(lang, "mostRead")} /><MostRead stories={most} lang={lang} /></div>}
              {articles.length >= 3 && <AavtikalBox list={[...articles.filter((f) => f.photo), ...articles.filter((f) => !f.photo)].slice(0, 3)} lang={lang} />}
              <Join lang={lang} />
            </div></aside>
          </div>
        </>
      )}
    </Frame>
  );
}
