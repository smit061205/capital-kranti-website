// Section, latest, search and archive pages (DESIGN.md §3.6-3.7).
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Genre, Lang, Tier } from "../lib/types.ts";
import { archiveDays, issueOn, latestStories, search, storiesIn, storiesInBoth, storiesOn } from "../lib/db.ts";
import { href, t } from "../lib/i18n.ts";
import { GENRES, isPlace, isSection, PLACES, SECTIONS, sectionAbout, sectionName, TIERS } from "../lib/sections.ts";
import { dateText, num } from "../lib/format.ts";
import { Lead, River, Std } from "../components/cards.tsx";
import Frame from "../components/Frame.tsx";
import { topScore } from "../lib/rank.ts";
import Saved from "../components/Saved.tsx";

/** A section's stories on each of its pages; the further pages (/section/gujarat/page/2, 6 Nov: so older stories stay a
 *  click or two from the section, for readers and for search engines) go back up to MAX_PAGES. */
export const PER_PAGE = 60;
export const MAX_PAGES = 20;
/** a section's page n, in the reader's language */
const pageHref = (lang: Lang, k: string, n: number) => href(lang, n > 1 ? `/section/${k}/page/${n}` : `/section/${k}`);

/** A section, or a region on one subject (`sub`: "ગુજરાત › ખેતી", /section/gujarat/farm; ROADMAP §4), with chips to the
 *  section's other side: a region's subjects, a subject's regions, only those with stories. Gujarat and each place also
 *  carry chips to the cities and districts (lib/sections.ts PLACES). */
export async function Section({ k, sub, page = 1, lang }: { k: string; sub?: string; page?: number; lang: Lang }) {
  if (!isSection(k)) notFound();
  const tier = TIERS.includes(k as Tier) ? (k as Tier) : null;
  if (sub && !(tier && GENRES.includes(sub as Genre))) notFound();
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGES || (sub && page > 1)) notFound();
  // one more than a page holds, to know whether there's an older page
  const got = sub ? await storiesInBoth(tier!, sub as Genre, 60) : await storiesIn(k, PER_PAGE + 1, false, (page - 1) * PER_PAGE);
  const list = got.slice(0, PER_PAGE);
  const older = !sub && got.length > PER_PAGE && page < MAX_PAGES;
  if (page > 1 && !list.length) notFound();
  // the chips: from the whole section's stories (a region-and-subject page shows its region's other subjects)
  const all = sub ? await storiesIn(k, 120) : list;
  // a place's page has no subject chips: all its stories are Gujarat's
  const others: { key: string; href: string; on: boolean }[] = page > 1 || isPlace(k) ? [] : tier
    ? GENRES.filter((g) => all.some((s) => s.genres.includes(g))).map((g) => ({ key: g, href: `/section/${tier}/${g}`, on: g === sub }))
    : TIERS.filter((t) => all.some((s) => s.tier === t)).map((t) => ({ key: t, href: `/section/${t}/${k}`, on: false }));
  const places = page === 1 && !sub && (k === "gujarat" || isPlace(k)) ? PLACES : [];
  // the lead is the day's news (the user, 29 Oct: an old story never heads a section): the most important of
  // the last 24 hours, one with a photo first; only a section with nothing new leads with its newest
  // (4 Nov: ranked as the front page ranks, lib/rank.ts, so a big story of the morning gives way by evening; one with a
  // photo when it is nearly as important). A further page has no lead: it's the older stories in order.
  const fresh = list.filter((s) => Date.now() - Date.parse(s.publishedAt) < 24 * 3600_000).sort((a, b) => topScore(b) - topScore(a));
  const top = page > 1 ? undefined : fresh.slice(0, 4).find((s) => s.photo && topScore(s) >= topScore(fresh[0]) - 1.5) ?? fresh[0] ?? list[0];
  const about = page === 1 && !sub ? sectionAbout(k, lang) : "";
  return (
    <Frame lang={lang} path={sub ? `/section/${k}/${sub}` : page > 1 ? `/section/${k}/page/${page}` : `/section/${k}`}
      section={SECTIONS.includes(k as Tier) ? k : "gujarat"}>
      <div className="sechead">
        <h1>{sub ? <><Link prefetch={false} href={href(lang, `/section/${k}`)}>{sectionName(k, lang)}</Link><span className="secsep" aria-hidden="true">›</span>{sectionName(sub, lang)}</>
          : page > 1 ? <><Link prefetch={false} href={href(lang, `/section/${k}`)}>{sectionName(k, lang)}</Link><span className="secsep" aria-hidden="true">›</span>{t(lang, "pageNo")} {num(page, lang)}</>
          : sectionName(k, lang)}</h1>
      </div>
      {about && <p className="secabout">{about}</p>}
      {others.length > 1 && (
        <nav className="chips" aria-label={sectionName(k, lang)}>
          {others.map((o) => <Link prefetch={false} key={o.key} href={href(lang, o.href)} className={o.on ? "on" : undefined} aria-current={o.on ? "page" : undefined}>{sectionName(o.key, lang)}</Link>)}
        </nav>
      )}
      {places.length > 0 && (
        <nav className="chips places" aria-label={t(lang, "cities")}>
          <span className="lbl">{t(lang, "cities")}</span>
          {places.map((p) => <Link prefetch={false} key={p} href={href(lang, `/section/${p}`)} className={p === k ? "on" : undefined} aria-current={p === k ? "page" : undefined}>{sectionName(p, lang)}</Link>)}
        </nav>
      )}
      {top ? (
        <>
          <div className="ctr" style={{ marginTop: 20 }}>{top.photo ? <Lead s={top} lang={lang} /> : <Std s={top} lang={lang} sec={false} />}</div>
          <div className="ctr"><River stories={list.filter((s) => s !== top)} lang={lang} /></div>
        </>
      ) : list.length ? <div className="ctr" style={{ marginTop: 12 }}><River stories={list} lang={lang} /></div>
        : <><p className="empty">{t(lang, "none")}</p><Link prefetch={false} className="more" href={href(lang, "/")}>{t(lang, "back")}</Link></>}
      {(page > 1 || older) && (
        <nav className="pager" aria-label={t(lang, "pageNo")}>
          {page > 1 ? <Link prefetch={false} rel="prev" href={pageHref(lang, k, page - 1)}>{t(lang, "newer")}</Link> : <span />}
          <span className="pgno">{t(lang, "pageNo")} {num(page, lang)}</span>
          {older ? <Link prefetch={false} rel="next" href={pageHref(lang, k, page + 1)}>{t(lang, "older")}</Link> : <span />}
        </nav>
      )}
    </Frame>
  );
}

export async function Latest({ lang }: { lang: Lang }) {
  const list = (await latestStories(80)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return (
    <Frame lang={lang} path="/latest" active="latest">
      <div className="sechead"><h1>{t(lang, "latestTitle")}</h1></div>
      <p className="note" style={{ margin: "0 0 8px" }}>{t(lang, "updated")}</p>
      {list.length ? <River stories={list} lang={lang} sec /> : <p className="empty">{t(lang, "empty")}</p>}
    </Frame>
  );
}

export async function Search({ q, lang }: { q: string; lang: Lang }) {
  const list = q ? await search(q) : [];
  return (
    <Frame lang={lang} path="/search">
      <div className="sechead"><h1>{q ? `“${q}”` : t(lang, "searchTitle")}</h1></div>
      <form className="search" role="search" action={href(lang, "/search")} method="get" style={{ maxWidth: 560 }}>
        <input name="q" type="search" defaultValue={q} placeholder={t(lang, "searchPlaceholder")} aria-label={t(lang, "searchPlaceholder")} />
      </form>
      {q && <p className="note">{num(list.length, lang)} {t(lang, "found")}</p>}
      {q && (list.length ? <River stories={list} lang={lang} sec /> : <p className="empty">{t(lang, "notFound")}</p>)}
    </Frame>
  );
}

/** Every day of stories, newest first (6 Nov: the printed issues only, before), each day's printed issue named. */
export async function Archive({ lang }: { lang: Lang }) {
  const days = await archiveDays();
  return (
    <Frame lang={lang} path="/archive" active="archive">
      <div className="sechead"><h1>{t(lang, "archive")}</h1></div>
      {/* the newest printed paper's PDF first (the readers asked, 3 Nov; app/api/publish/pdf) */}
      {days.find((d) => d.pdf) && (() => { const d = days.find((x) => x.pdf)!; return (
        <a className="pdfbtn" href={d.pdf!} download={`capital-kranti-${d.date}.pdf`}>{t(lang, "todayPaper")}, {dateText(d.date, lang)}: {t(lang, "pdf")}</a>); })()}
      {days.length ? (
        <div className="river">
          {days.map((d) => (
            <Link prefetch={false} key={d.date} className="h" href={href(lang, `/archive/${d.date}`)}>
              <span className="when">{d.number != null && `${t(lang, "issue")} ${num(d.number, lang)}`}</span>
              <div><h3 className="h3">{dateText(d.date, lang, true)}</h3><div className="meta">{num(d.stories, lang)} {t(lang, "storiesCount")}{d.pdf && ` · ${t(lang, "pdfShort")}`}</div></div>
              <span />
            </Link>
          ))}
        </div>
      ) : <p className="empty">{t(lang, "noIssues")}</p>}
    </Frame>
  );
}

/** One day's stories, the printed issue's first in its order, with the days before and after. */
export async function ArchiveDay({ date, lang }: { date: string; lang: Lang }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const [issue, list, days] = await Promise.all([issueOn(date), storiesOn(date), archiveDays()]);
  if (!issue && !list.length) notFound();
  // the list is newest first: the day before is the next one in it
  const i = days.findIndex((d) => d.date === date);
  const before = i >= 0 ? days[i + 1] : days.find((d) => d.date < date);
  const after = i > 0 ? days[i - 1] : i < 0 ? [...days].reverse().find((d) => d.date > date) : undefined;
  return (
    <Frame lang={lang} path={`/archive/${date}`} active="archive">
      <div className="sechead"><h1>{dateText(date, lang, true)}</h1></div>
      {issue && <p className="note" style={{ margin: 0 }}>{t(lang, "issue")} {num(issue.number, lang)}</p>}
      {issue?.pdf && <a className="pdfbtn" href={issue.pdf} download={`capital-kranti-${date}.pdf`}>{t(lang, "pdf")}</a>}
      <div className="ctr" style={{ marginTop: 16 }}><River stories={list} lang={lang} sec /></div>
      {(before || after) && (
        <nav className="pager" aria-label={t(lang, "archive")}>
          {before ? <Link prefetch={false} href={href(lang, `/archive/${before.date}`)}>{t(lang, "prevDay")}</Link> : <span />}
          <Link prefetch={false} className="pgno" href={href(lang, "/archive")}>{t(lang, "archive")}</Link>
          {after ? <Link prefetch={false} href={href(lang, `/archive/${after.date}`)}>{t(lang, "nextDay")}</Link> : <span />}
        </nav>
      )}
    </Frame>
  );
}

export function SavedPage({ lang }: { lang: Lang }) {
  return (
    <Frame lang={lang} path="/saved">
      <div className="sechead"><h1>{t(lang, "savedTitle")}</h1></div>
      <Saved lang={lang} empty={t(lang, "noneSaved")} remove={t(lang, "remove")} count={t(lang, "savedCount")} />
    </Frame>
  );
}
