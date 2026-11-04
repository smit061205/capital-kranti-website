// The editor page (ROADMAP §6 phase B, item 4): what waits for the editor's yes or no,
// Capital Kranti's news and Aavtikal's articles (each searched, shown 25 at a time, changed
// or taken down and put back), the engine's stop switch and the day's use.
// Gujarati first, English as a switch (?lang=en); plain words, big buttons.
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import s from "./editor.module.css";
import { W } from "./words.ts";
import Birthday from "./Birthday.tsx";
import LeaderForm from "./LeaderForm.tsx";
import Insta from "./Insta.tsx";
import { addAdAction, dropAdAction, dropLeaderAction, pauseEngine, publishFeature, putBackStory, removeFeature, removeStory } from "./actions.ts";
import { db } from "@/lib/db.ts";
import { COOKIE, desk, editorOf, findFeatures, findStories, PAGE, signInReady, type Found, type Show } from "@/lib/editor.ts";
import { beatName, isBeat } from "@/lib/flagship.ts";
import { birthdays, draftEmail, leaders } from "@/lib/leaders.ts";
import { ads, DAYS, KINDS, KIND_NAMES } from "@/lib/classifieds.ts";
import { DEFAULT_SETTINGS, instaAsk, instaNews, instaSettings, recentSets } from "@/lib/insta.ts";
import { instagramWho } from "@/lib/instagram.ts";
import { dateText, num, timeText, shortDate, todayIst } from "@/lib/format.ts";

export const dynamic = "force-dynamic";

/** the page's tabs (3 Nov: everything was on one long page): an overview first, then each thing the editor looks after */
const TABS = ["today", "news", "aavtikal", "insta", "leaders", "ads", "engine"] as const;
type Tab = (typeof TABS)[number];
const OLD_LINKS = `(function(){var h=location.hash.slice(1),m={news:"news",aavtikal:"aavtikal",insta:"insta",leaders:"leaders",ads:"ads",engine:"engine",use:"engine"};
if(m[h]&&!/[?&]tab=/.test(location.search)){var u=new URL(location.href);u.searchParams.set("tab",m[h]);u.hash="";location.replace(u.href)}})()`;
export const metadata: Metadata = { title: "સંપાદક | કેપિટલ ક્રાંતિ", robots: { index: false, follow: false } };

type Q = { lang?: string; signin?: string; q?: string; show?: string; n?: string; fq?: string; fshow?: string; fn?: string; saved?: string; written?: string; wrote?: string; ad?: string; tab?: string };

/** the Instagram tab's settings, the editor's ask, what it came to and the account the site reaches: only on that tab */
async function instaExtra(sql: ReturnType<typeof db>) {
  const [settings, ask, news, who] = await Promise.all([sql ? instaSettings(sql) : DEFAULT_SETTINGS, sql ? instaAsk(sql) : null, sql ? instaNews(sql) : null, instagramWho()]);
  return { settings, ask, news, who };
}

export default async function Editor({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const lang = q.lang === "en" ? "en" : "gu";
  const w = W[lang];
  const who = editorOf((await cookies()).get(COOKIE)?.value);
  const other = lang === "en" ? "/editor" : "/editor?lang=en";

  if (!who) {
    const note = !signInReady() ? w.off : q.signin === "refused" ? w.refused : q.signin === "again" ? w.again : null;
    return (
      <main className={s.page} lang={lang === "en" ? "en" : undefined}>
        <header className={s.top}><h1>{w.title}</h1><Link href={other}>{w.lang}</Link></header>
        <section className={s.signin}>
          <p>{w.intro}</p>
          {note && <p className={s.note} role="status">{note}</p>}
          {signInReady() && <a className={s.big} href="/api/editor/login">{w.signIn}</a>}
        </section>
      </main>
    );
  }

  // what's asked for: words, which list, how many (25 more each time)
  const words = (q.q ?? "").trim().slice(0, 80), fwords = (q.fq ?? "").trim().slice(0, 80);
  const show: Show = q.show === "removed" ? "removed" : "site", fshow: Show = q.fshow === "removed" ? "removed" : "site";
  const count = (v?: string) => Math.min(500, Math.max(PAGE, Math.round(Number(v) / PAGE) * PAGE || PAGE));
  const n = count(q.n), fn = count(q.fn);
  // the tab shown (3 Nov: the page was one long scroll); a message after saving opens the tab it belongs to
  const tab: Tab = TABS.includes(q.tab as Tab) ? (q.tab as Tab)
    : q.written || (q.saved && !q.tab) ? "news" : q.wrote ? "aavtikal" : q.ad ? "ads" : "today";
  const sql = db();
  const [d, news, arts, people, adList, instaSets] = await Promise.all([desk(sql), findStories(sql, words, show, n), findFeatures(sql, fwords, fshow, fn), leaders(sql), ads(sql, true),
    sql ? recentSets(sql, 20) : Promise.resolve([])]);
  const bday = birthdays(people);

  // a link to this page with some of its asks changed (the rest kept)
  const keep: Record<string, string | undefined> = { tab: tab === "today" ? undefined : tab, lang: lang === "en" ? "en" : undefined, q: words || undefined, show: show === "removed" ? show : undefined,
    n: n > PAGE ? String(n) : undefined, fq: fwords || undefined, fshow: fshow === "removed" ? fshow : undefined, fn: fn > PAGE ? String(fn) : undefined };
  const link = (change: Record<string, string | undefined>, at: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, ...change })) if (v) p.set(k, v);
    const qs = p.toString();
    return `/editor${qs ? `?${qs}` : ""}#${at}`;
  };
  const back = lang === "en" ? "lang=en" : "";

  const time = (iso: string) => (iso ? `${shortDate(iso, "gu")}, ${timeText(iso, "gu")}` : "");
  const nn = (x: number) => (lang === "gu" ? num(x, "gu") : String(x));
  const today = todayIst();

  // one searchable list (Capital Kranti's news or Aavtikal's articles)
  const Finder = ({ at, kind, found, value, which, more }: { at: string; kind: "story" | "feature"; found: { rows: Found[]; more: boolean }; value: string; which: Show; more: string }) => {
    const qk = kind === "story" ? "q" : "fq", sk = kind === "story" ? "show" : "fshow", nk = kind === "story" ? "n" : "fn";
    const hidden = Object.entries(keep).filter(([k, v]) => v && k !== qk && k !== nk);
    return (
      <>
        <form className={s.search} action={`/editor#${at}`} role="search">
          {hidden.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input type="search" name={qk} defaultValue={value} placeholder={w.searchFor} aria-label={w.search} />
          <button className={s.find}>{w.search}</button>
        </form>
        <div className={s.tabs} role="group">
          <Link href={link({ [sk]: undefined, [nk]: undefined }, at)} aria-current={which === "site" ? "true" : undefined}>{w.onSite}</Link>
          <Link href={link({ [sk]: "removed", [nk]: undefined }, at)} aria-current={which === "removed" ? "true" : undefined}>{w.removedTab}</Link>
          {value && <Link className={s.clear} href={link({ [qk]: undefined, [nk]: undefined }, at)}>{w.clear}</Link>}
        </div>
        {found.rows.length ? (
          <ul className={s.list}>
            {found.rows.map((x) => (
              <li key={x.id}>
                <div className={s.what}>
                  {x.status === "withdrawn"
                    ? <span className={s.title}>{x.headline}</span>
                    : <a className={s.title} href={kind === "story" ? `/news/${x.id}` : `/aavtikal/p/${x.id}`} target="_blank" rel="noopener">{x.headline}</a>}
                  <span className={s.when}>
                    {time(x.at)} · {kind === "story" ? (x.kind === "editor" ? w.fromYou : x.kind === "live" ? w.fromEngine : w.fromPaper) : isBeat(x.kind) ? beatName(x.kind, lang) : x.kind}
                  </span>
                </div>
                <div className={s.acts}>
                  {x.status === "withdrawn" ? (
                    <form action={(kind === "story" ? putBackStory : publishFeature).bind(null, x.id)}><button className={s.small}>{w.putBack}</button></form>
                  ) : <>
                    <Link className={s.small} href={`/editor/${kind}/${x.id}${back ? `?${back}` : ""}`}>{w.edit}</Link>
                    <details className={s.confirm}><summary>{w.remove}</summary>
                      <form action={(kind === "story" ? removeStory : removeFeature).bind(null, x.id)}><button className={s.no}>{w.sure}</button></form></details>
                  </>}
                </div>
              </li>
            ))}
          </ul>
        ) : <p className={s.empty}>{value ? w.noneFound : w.none}</p>}
        {found.more && <Link className={s.moreBtn} href={more}>{w.more}</Link>}
      </>
    );
  };

  const waiting = instaSets.filter((x) => x.state === "waiting" && x.cards.length).length;
  const tabHref = (t: Tab) => `/editor${[t === "today" ? "" : `tab=${t}`, back].filter(Boolean).length ? `?${[t === "today" ? "" : `tab=${t}`, back].filter(Boolean).join("&")}` : ""}`;
  const badge = (x: number) => (x > 0 ? <span className={s.count}>{nn(x)}</span> : null);
  const TAB_NAMES: Record<Tab, React.ReactNode> = {
    today: w.tabToday, news: w.ck, aavtikal: w.av, insta: <>{w.tabInsta} {badge(waiting)}</>,
    leaders: <>{w.leadersShort} {badge(bday.today.length)}</>, ads: w.adsShort, engine: w.engine,
  };

  return (
    <main className={s.page} lang={lang === "en" ? "en" : undefined}>
      {/* an old link to a part of the page (/editor#ads, the Telegram notes) opens that part's tab */}
      <script dangerouslySetInnerHTML={{ __html: OLD_LINKS }} />
      <header className={s.top}>
        <h1>{w.title}</h1>
        <div className={s.who}>
          <span>{who}</span>
          <Link href={other}>{w.lang}</Link>
          <form action="/api/editor/logout" method="post"><button className={s.link}>{w.signOut}</button></form>
        </div>
      </header>
      <nav className={s.tabbar} aria-label={w.jump}>
        {TABS.map((t) => <Link key={t} href={tabHref(t)} aria-current={tab === t ? "page" : undefined}
          className={t === "news" ? s.jCK : t === "aavtikal" ? s.jAV : undefined}>{TAB_NAMES[t]}</Link>)}
      </nav>

      {tab === "today" && (
        <section className={s.block} aria-labelledby="today">
          <h2 id="today">{w.tabToday}</h2>
          <h3 className={s.sub}>{w.needYou}</h3>
          {waiting || bday.today.length || d.paused ? (
            <ul className={s.tasks}>
              {d.paused && <li><Link href={tabHref("engine")} className={s.taskBad}><b>{w.engineOff}</b><span>{w.open} →</span></Link></li>}
              {waiting > 0 && <li><Link href={tabHref("insta")}><b>{nn(waiting)} {w.instaWaiting}</b><span>{w.open} →</span></Link></li>}
              {bday.today.length > 0 && <li><Link href={tabHref("leaders")}><b>{w.bdayToday}: {bday.today.map((l) => `${l.title} ${l.nameGu}`).join(", ")}</b><span>{w.open} →</span></Link></li>}
            </ul>
          ) : <p className={s.done}>{w.allGood}</p>}
          <h3 className={s.sub}>{w.quick}</h3>
          <div className={s.quick}>
            <Link className={s.writeBtn} href={`/editor/write${back ? `?${back}` : ""}`}>{w.writeNew}</Link>
            <Link className={`${s.writeBtn} ${s.writeAv}`} href={`/editor/write?for=aavtikal${back ? `&${back}` : ""}`}>{w.avWriteNew}</Link>
            <Link className={s.ghost} href={`${tabHref("ads")}#add`}>{w.addAd}</Link>
          </div>
          <h3 className={s.sub}>{w.atGlance}</h3>
          <dl className={s.use}>
            <div><dt>{w.engine}</dt><dd className={d.paused ? s.bad : s.ok}>{d.paused ? w.off2 : w.on2}</dd></div>
            <div><dt>{w.stories}</dt><dd>{nn(d.today.stories)}</dd></div>
            {d.av && <div><dt>{w.avNew}</dt><dd>{nn(d.av.published)} / {nn(d.av.target)}</dd></div>}
            <div><dt>{w.cost}</dt><dd>₹{nn(0)}</dd></div>
          </dl>
        </section>
      )}

      {tab === "news" && (
        <section className={`${s.block} ${s.ck}`} aria-labelledby="news">
          <div className={s.brandHead}><h2 id="news">{w.ck}</h2><p>{w.ckNote}</p></div>
          {q.written && <p className={s.done} role="status">{w.written} <a href={`/news/${encodeURIComponent(q.written)}`} target="_blank" rel="noopener">{w.seeIt}</a></p>}
          {q.saved && <p className={q.saved === "1" ? s.done : s.stopped} role="status">{q.saved === "1" ? w.saved : w.notSaved}</p>}
          <Link className={s.writeBtn} href={`/editor/write${back ? `?${back}` : ""}`}>{w.writeNew}</Link>
          <h3 className={s.sub}>{w.onSiteNews}</h3>
          <Finder at="news" kind="story" found={news} value={words} which={show} more={link({ n: String(n + PAGE) }, "news")} />
        </section>
      )}

      {tab === "aavtikal" && (
        <section className={`${s.block} ${s.av}`} aria-labelledby="aavtikal">
          <div className={s.brandHead}><h2 id="aavtikal">{w.av}</h2><p>{w.avNote}</p></div>
          {q.wrote && <p className={s.done} role="status">{w.avWritten} <a href={`/aavtikal/p/${encodeURIComponent(q.wrote)}`} target="_blank" rel="noopener">{w.seeIt}</a></p>}
          {q.saved && <p className={q.saved === "1" ? s.done : s.stopped} role="status">{q.saved === "1" ? w.saved : w.notSaved}</p>}
          <Link className={`${s.writeBtn} ${s.writeAv}`} href={`/editor/write?for=aavtikal${back ? `&${back}` : ""}`}>{w.avWriteNew}</Link>
          {d.av && <>
            <h3 className={s.sub}>{w.avDesk}</h3>
            <p className={d.av.running ? s.running : s.stopped}>{d.av.running ? w.avWorking : w.avResting}</p>
            <dl className={s.use}>
              <div><dt>{w.avNew}</dt><dd>{nn(d.av.published)} / {nn(d.av.target)}</dd></div>
              <div><dt>{w.avOld}</dt><dd>{nn(d.av.rewritten)}{d.av.toRewrite > 0 && <small> · {nn(d.av.toRewrite)} {w.avOldLeft}</small>}</dd></div>
            </dl>
            {d.av.lines.length > 0 && <details className={s.more}><summary>{w.avLog}</summary>
              <ul className={s.runs}>{d.av.lines.map((l, i) => <li key={i}>{l}</li>)}</ul></details>}
          </>}
          <h3 className={s.sub}>{w.published}</h3>
          <Finder at="aavtikal" kind="feature" found={arts} value={fwords} which={fshow} more={link({ fn: String(fn + PAGE) }, "aavtikal")} />
        </section>
      )}

      {tab === "insta" && <Insta lang={lang} sets={instaSets} {...await instaExtra(sql)} />}

      {tab === "leaders" && (
        <section className={s.block} aria-labelledby="leaders">
          <h2 id="leaders">{w.leaders} {badge(bday.today.length)}</h2>
          <p className={s.help}>{w.leadersNote}</p>
          {bday.today.length ? bday.today.map((l) => {
            const m = draftEmail(l);
            return <Birthday key={l.id} lang={lang} leader={l} subject={m.subject} body={m.body} />;
          }) : <p className={s.empty}>{w.bdayNone}</p>}
          {bday.soon.length > 0 && <>
            <h3 className={s.sub}>{w.bdaySoon}</h3>
            <ul className={s.runs}>{bday.soon.map(({ leader: l, inDays }) => (
              <li key={l.id}><span>{l.title} {l.nameGu}</span><span className={s.when}>{inDays === 1 ? w.tomorrow : `${nn(inDays)} ${w.daysLater}`}</span></li>
            ))}</ul>
          </>}
          <h3 className={s.sub}>{w.allLeaders}</h3>
          <details className={s.addLeader}><summary className={s.writeBtn}>{w.addLeader}</summary><LeaderForm lang={lang} /></details>
          {people.length ? (
            <ul className={s.list}>
              {people.map((l) => (
                <li key={l.id}>
                  <div className={s.what}>
                    <span className={s.title}>{l.title} {l.nameGu}</span>
                    <span className={s.when}>{nn(Number(l.born.slice(3)))} {w.months[Number(l.born.slice(0, 2)) - 1]}{l.post && ` · ${l.post}`}{!l.email && ` · ${w.noEmailShort}`}</span>
                  </div>
                  <div className={s.acts}>
                    <details className={s.confirm}><summary>{w.edit}</summary><LeaderForm lang={lang} leader={l} /></details>
                    <details className={s.confirm}><summary>{w.removeLeader}</summary>
                      <form action={dropLeaderAction.bind(null, l.id)}><button className={s.no}>{w.sure}</button></form></details>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className={s.empty}>{w.leadersNone}</p>}
        </section>
      )}

      {tab === "ads" && (
        <section className={s.block} aria-labelledby="ads">
          <h2 id="ads">{w.ads}</h2>
          <p className={s.help}>{w.adsNote} <a href="/classifieds" target="_blank" rel="noopener">{w.seeAds}</a></p>
          {q.ad && <p className={q.ad === "1" ? s.done : s.stopped} role="status">{q.ad === "1" ? w.adSaved : w.adNotSaved}</p>}
          <details className={s.addLeader} id="add"><summary className={s.writeBtn}>{w.addAd}</summary>
            <form className={s.form} action={addAdAction.bind(null, back)}>
              <fieldset className={s.pills}><legend>{w.adKind}</legend>
                {KINDS.map((k, i) => <label key={k}><input type="radio" name="kind" value={k} defaultChecked={i === 0} /><span>{KIND_NAMES[k][lang]}</span></label>)}
              </fieldset>
              <label>{w.adText}<textarea name="text" rows={4} maxLength={1000} required /></label>
              <label>{w.adContact}<input className={s.select} name="contact" type="tel" maxLength={80} /></label>
              <label>{w.adPlace}<input className={s.select} name="place" maxLength={60} /></label>
              <fieldset className={s.pills}><legend>{w.adDays}</legend>
                {DAYS.map((n, i) => <label key={n}><input type="radio" name="days" value={n} defaultChecked={i === 0} /><span>{nn(n)} {w.dayWord}</span></label>)}
              </fieldset>
              <button className={s.big}>{w.adSave}</button>
            </form>
          </details>
          <h3 className={s.sub}>{w.adsAll}</h3>
          {adList.length ? (
            <ul className={s.list}>
              {adList.map((a) => (
                <li key={a.id}>
                  <div className={s.what}>
                    <span className={s.title}>{a.text}</span>
                    <span className={s.when}>{KIND_NAMES[a.kind][lang]}{a.place && ` · ${a.place}`}{a.contact && ` · ${a.contact}`} · {a.until < today ? w.adEnded : `${dateText(a.until, lang)} ${w.adUntil}`}</span>
                  </div>
                  <div className={s.acts}>
                    <details className={s.confirm}><summary>{w.removeAd}</summary>
                      <form action={dropAdAction.bind(null, a.id)}><button className={s.no}>{w.sure}</button></form></details>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className={s.empty}>{w.adsNone}</p>}
        </section>
      )}

      {tab === "engine" && <>
        <section className={s.block} aria-labelledby="engine">
          <h2 id="engine">{w.engine}</h2>
          <p className={d.paused ? s.stopped : s.running}>{d.paused ? w.stopped : w.running}</p>
          <form action={pauseEngine.bind(null, !d.paused)}><button className={d.paused ? s.yes : s.no}>{d.paused ? w.start : w.stop}</button></form>
          {d.runs.length > 0 && <>
            <h3 className={s.sub}>{w.lastRuns}</h3>
            <ul className={s.runs}>
              {d.runs.map((r) => (
                <li key={r.at}><span>{time(r.at)}</span><span className={r.ok ? s.ok : s.bad}>{r.running ? w.runningNow : r.ok ? w.ok : w.failed}</span>
                  <span className={s.when}>{`${nn(r.stories)} ${w.storiesUp}`}{r.seconds != null && ` · ${nn(r.seconds)} ${w.seconds}`}{r.ai != null && ` · ${nn(r.ai)} ${w.requests}`}</span></li>
              ))}
            </ul>
          </>}
        </section>
        <section className={s.block} aria-labelledby="use">
          <h2 id="use">{w.use}</h2>
          <dl className={s.use}>
            <div><dt>{w.stories}</dt><dd>{nn(d.today.stories)}</dd></div>
            <div><dt>{w.ai}</dt><dd>{nn(d.today.ai)} / {nn(d.today.aiLimit)}</dd></div>
            <div><dt>{w.aiAavtikal}</dt><dd>{nn(d.today.aiAavtikal)}</dd></div>
            <div><dt>{w.uploads}</dt><dd>{nn(d.today.uploads)} / {nn(d.today.uploadLimit)}</dd></div>
            <div><dt>{w.cost}</dt><dd>₹{nn(0)}</dd></div>
          </dl>
          <p className={s.empty}>{w.free}</p>
        </section>
      </>}
    </main>
  );
}
