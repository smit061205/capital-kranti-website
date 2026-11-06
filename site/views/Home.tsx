// The front page (2 Nov), laid out as a magazine: one big centred headline with its picture across the page, a pair of
// stories, a row of three, the latest and the most read, then each section led by one story with the rest beside it.
// Every block has a version without pictures, so a day of weak photos still looks finished.
import type { Lang, Story } from "../lib/types.ts";
import { elsewhere, latestStories, moreOnSubject, mostRead } from "../lib/db.ts";
import { href, t } from "../lib/i18n.ts";
import { sectionName } from "../lib/sections.ts";
import { Credit, decent, ElsewhereRow, Join, Meta, MoreOn, strong, words } from "../components/cards.tsx";
import { frontTop, topScore } from "../lib/rank.ts";
import Link from "next/link";
import { pic, SIZES } from "../lib/photo.ts";
import { num, timeText } from "../lib/format.ts";
import TimeAgo from "../components/TimeAgo.tsx";
import Frame from "../components/Frame.tsx";
import { PAPER, SITE_URL } from "../lib/site.ts";
import { JsonLd, ORG_ID, organization } from "../lib/jsonld.tsx";
import { beatName, featureWords, features, flw, type Feature } from "../lib/flagship.ts";
import { Chev } from "../components/icons.tsx";

const inSection = (s: Story, key: string) => s.tier === key || s.genres.includes(key as never);
const BELOW = ["gujarat", "india", "world", "economy", "farm", "tech", "health", "sport", "education", "entertainment"];
const newest = (a: Story, b: Story) => b.publishedAt.localeCompare(a.publishedAt);
const storyHref = (s: Story, lang: Lang) => href(lang, `/news/${s.id}`);

// Each section's newest stories, led by the most important of the last day for its age (lib/rank.ts), one with a photo if it has one
// (29 Oct: farming was led by a week-old photo story above one of ten hours before).
function freshFirst(list: Story[]): Story[] {
  const day = list.filter((s) => Date.now() - Date.parse(s.publishedAt) < 24 * 3600_000)
    .sort((a, b) => topScore(b) - topScore(a) || newest(a, b));
  const lead = day.find(decent) ?? day[0] ?? list.find(decent) ?? list[0];
  return lead ? [lead, ...list.filter((s) => s !== lead)] : list;
}
/** The sections below the top: one with four stories gets a block of its own; the stories of sections with fewer go
 *  together under "more news", cut to whole rows of three. A story shows once on the page. */
function sectionBoxes(stories: Story[], shown: Set<string>) {
  const used = new Set(shown);
  const wide: { k: string; list: Story[] }[] = [];
  const few: { k: string; s: Story }[] = [];
  for (const k of BELOW) {
    const list = freshFirst(stories.filter((s) => inSection(s, k) && !used.has(s.id)).sort(newest).slice(0, 4));
    if (!list.length) continue;
    list.forEach((s) => used.add(s.id));
    if (list.length === 4) wide.push({ k, list });
    else few.push(...list.map((s) => ({ k, s })));
  }
  few.sort((a, b) => newest(a.s, b.s));
  return { wide: wide.slice(0, 6), few: few.length >= 3 ? few.slice(0, Math.min(6, few.length - few.length % 3)) : few };
}

function Photo({ s, lang, sizes, eager = false }: { s: Story; lang: Lang; sizes: string; eager?: boolean }) {
  const w = words(s, lang);
  return (
    <span className="phw"><img className="ph" {...pic(s.photo!, sizes)} width={s.photo!.width} height={s.photo!.height} alt={w.caption || w.headline}
      loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} decoding="async" /></span>
  );
}

/** A story card: its picture (when asked for), section, headline, summary and time. */
function Card({ s, lang, cls, photo, label, dek = true, sizes = SIZES.card }: { s: Story; lang: Lang; cls: string; photo: boolean; label?: string; dek?: boolean; sizes?: string }) {
  const w = words(s, lang);
  return (
    <Link prefetch={false} className={`h mc ${cls}`} href={storyHref(s, lang)}>
      {photo && s.photo && <Photo s={s} lang={lang} sizes={sizes} />}
      <span className="kick">{label ?? sectionName(s.tier, lang)}</span>
      <h3 className="h3">{w.headline}</h3>
      {dek && w.deck && <p className="dek">{w.deck}</p>}
      <Meta s={s} lang={lang} sec={false} />
    </Link>
  );
}

/** A section's title, centred, linking to the section. */
function Title({ label, to }: { label: string; to?: string }) {
  return <h2 className="mt">{to ? <Link prefetch={false} href={to}>{label}</Link> : label}</h2>;
}

/** A section: its lead story large, its picture beside it (on alternate sides), the other three in a row below. */
function SectionBlock({ k, list, lang, flip }: { k: string; list: Story[]; lang: Lang; flip: boolean }) {
  const [first, ...rest] = list;
  const w = words(first, lang);
  const withPic = decent(first);
  return (
    <section className="mblock">
      <Title label={sectionName(k, lang)} to={href(lang, `/section/${k}`)} />
      <Link prefetch={false} className={`h feat${withPic ? "" : " nop"}${flip ? " r" : ""}`} href={storyHref(first, lang)}>
        {withPic && <Photo s={first} lang={lang} sizes={SIZES.lead} />}
        <div><h3 className="fh">{w.headline}</h3>{w.deck && <p className="dek">{w.deck}</p>}<Meta s={first} lang={lang} sec={false} /></div>
      </Link>
      <div className="m3">{rest.map((s) => <Card key={s.id} s={s} lang={lang} cls="" photo={false} label={sectionName(k, lang)} dek={false} />)}</div>
    </section>
  );
}

/** Aavtikal's newest, a dark band of its own: one with its picture large, two more headlines. */
function AavtikalBand({ list, lang }: { list: Feature[]; lang: Lang }) {
  const [first, ...rest] = list;
  const fw = featureWords(first, lang);
  const at = (f: Feature) => href(lang, `/aavtikal/p/${f.id}`);
  const tongue = (f: Feature) => featureWords(f, lang).translated || lang === "gu" ? lang : "gu";
  return (
    <section className="mav">
      <div className="wrap">
        <Link prefetch={false} className="lab" href={href(lang, "/aavtikal")}>{flw(lang).name}</Link>
        <Link prefetch={false} className="h" href={at(first)} lang={tongue(first)}>
          <span className="kick">{beatName(first.beat, lang)}</span>
          <h2>{fw.headline}</h2>
          {first.photo && <span className="phw"><img className="ph" {...pic(first.photo, SIZES.full)} width={first.photo.width} height={first.photo.height} alt="" loading="lazy" decoding="async" /></span>}
        </Link>
        <ul>{rest.map((f) => <li key={f.id}><Link prefetch={false} href={at(f)} lang={tongue(f)}><span className="kick">{beatName(f.beat, lang)}</span>{featureWords(f, lang).headline}</Link></li>)}</ul>
      </div>
    </section>
  );
}

export default async function Home({ lang }: { lang: Lang }) {
  const stories = await latestStories(200);
  const day = stories[0]?.issueDate;
  const today = stories.filter((s) => s.issueDate === day);
  // the top: the lead, a pair and a row of three, ranked by how much each matters, how fresh it is and how many outlets
  // report it, each a different event (lib/rank.ts; 4 Nov: the pair and the three were simply the newest with a photo)
  const top = frontTop(stories, { strong, decent });
  const lead = top.lead ?? today[0];
  const [more, read, articles, others] = await Promise.all([lead ? moreOnSubject(lead.id) : [], mostRead(16), features({ limit: 6 }), elsewhere(lang)]);
  const { pair, three } = top;
  const shown = new Set([lead, ...pair, ...three].filter(Boolean).map((s) => s!.id));
  // the latest: newest first, without what's above; most read and the sections leave out what's already shown (2 Nov)
  const latest = stories.filter((s) => !shown.has(s.id)).sort(newest).slice(0, 8);
  latest.forEach((s) => shown.add(s.id));
  const most = read.filter((s) => !shown.has(s.id)).slice(0, 5);
  most.forEach((s) => shown.add(s.id));
  const { wide, few } = sectionBoxes(stories, shown);
  const av = [...articles.filter((f) => f.photo), ...articles.filter((f) => !f.photo)].slice(0, 3);
  const lw = lead && words(lead, lang);

  return (
    <Frame lang={lang} path="/" active="home">
      <JsonLd items={[organization(lang), { "@type": "WebSite", "@id": `${SITE_URL}${href(lang, "/")}#site`, url: `${SITE_URL}${href(lang, "/")}`, name: PAPER[lang].name,
                                             inLanguage: lang, publisher: { "@id": ORG_ID } }]} />
      {/* the page's name for screen readers and search engines (the wordmark above is a link) */}
      <h1 className="vh">{PAPER[lang].name}: {PAPER[lang].tagline}</h1>
      {!lead || !lw ? <p className="empty">{t(lang, "empty")}</p> : (
        <>
          <section className="mhero">
            <Link prefetch={false} className="h" href={storyHref(lead, lang)}>
              <span className="kick">{lw.kicker || sectionName(lead.tier, lang)}</span>
              <h2 className="display">{lw.headline}</h2>
              {lw.deck && <p className="dek">{lw.deck}</p>}
              <Meta s={lead} lang={lang} />
              {strong(lead) && <Photo s={lead} lang={lang} sizes={SIZES.full} eager />}
            </Link>
            {strong(lead) && lw.caption && <p className="cap">{lw.caption}<Credit s={lead} lang={lang} /></p>}
            {more.length > 0 && <MoreOn stories={more} lang={lang} />}
          </section>
          {pair.length === 2 && (
            <div className={`mpair${pair.every(decent) ? "" : " nop"}`}>
              <Card s={pair[0]} lang={lang} cls="a" photo={pair.every(decent)} dek={false} sizes={SIZES.lead} />
              <Card s={pair[1]} lang={lang} cls="b" photo={pair.every(decent)} sizes="(max-width: 800px) 60vw, 45vw" />
            </div>
          )}
          {three.length === 3 && <div className="m3 top3">{three.map((s) => <Card key={s.id} s={s} lang={lang} cls="" photo={false} />)}</div>}
          {latest.length >= 4 && (
            <section className="mblock">
              <Title label={t(lang, "latestTitle")} to={href(lang, "/latest")} />
              <ul className="mlatest">
                {latest.map((s) => (
                  <li key={s.id}><Link prefetch={false} className="h" href={storyHref(s, lang)}>
                    <TimeAgo iso={s.publishedAt} lang={lang} fallback={timeText(s.publishedAt, lang)} /><h3 className="h4">{words(s, lang).headline}</h3></Link></li>
                ))}
              </ul>
              <Link prefetch={false} className="mmore" href={href(lang, "/latest")}>{t(lang, "allLatest")} <Chev /></Link>
            </section>
          )}
          {most.length >= 3 && (
            <section className="mblock">
              <Title label={t(lang, "mostRead")} />
              <ol className="mmost">{most.map((s, i) => (
                <li key={s.id}><Link prefetch={false} className="h" href={storyHref(s, lang)}><b aria-hidden="true">{num(i + 1, lang)}</b><h3 className="h4">{words(s, lang).headline}</h3></Link></li>
              ))}</ol>
            </section>
          )}
          {wide.slice(0, 2).map((b, i) => <SectionBlock key={b.k} k={b.k} list={b.list} lang={lang} flip={i % 2 === 1} />)}
        </>
      )}
      {lead && av.length >= 1 && <AavtikalBand list={av} lang={lang} />}
      {lead && (
        <>
          {wide.slice(2).map((b, i) => <SectionBlock key={b.k} k={b.k} list={b.list} lang={lang} flip={i % 2 === 1} />)}
          {few.length >= 3 && (
            <section className="mblock"><Title label={t(lang, "moreNews")} />
              <div className="m3">{few.map(({ k, s }) => <Card key={s.id} s={s} lang={lang} cls="" photo={false} label={sectionName(k, lang)} dek={false} />)}</div>
            </section>
          )}
          <section className="mblock mjoin"><Join lang={lang} /></section>
          {others.length >= 4 && <ElsewhereRow items={others} lang={lang} />}
        </>
      )}
    </Frame>
  );
}
