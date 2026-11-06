// Every page's frame (DESIGN.md §3.1): the header and menu (Chrome), the
// section scroller, the page, the footer.
import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import type { Lang } from "../lib/types.ts";
import { href, t } from "../lib/i18n.ts";
import { SECTIONS, sectionName } from "../lib/sections.ts";
import { flw } from "../lib/flagship.ts";
import { INSTAGRAM, PAPER, PREFERRED_SOURCE } from "../lib/site.ts";
import { dateText, num } from "../lib/format.ts";
import Chrome from "./Chrome.tsx";
import LangLink from "./LangLink.tsx";
import NavProgress from "./NavProgress.tsx";
import ServiceWorker from "./ServiceWorker.tsx";
import InstallPrompt from "./InstallPrompt.tsx";
import ToTop from "./ToTop.tsx";
import BreakingBar from "./BreakingBar.tsx";
import { breakingNow } from "../lib/db.ts";
import { BREAKING_HOURS } from "../lib/push.ts";

export interface FrameProps {
  lang: Lang;
  /** this page's path without the language prefix, e.g. "/news/p2326794" */
  path: string;
  /** the section the page belongs to, underlined in the scroller */
  section?: string;
  active?: "home" | "latest" | "archive";
  /** articles carry their own reading bar on a phone */
  bottomBar?: boolean;
  children: React.ReactNode;
}

export default async function Frame({ lang, path, section, active, bottomBar = true, children }: FrameProps) {
  const L = (p: string) => href(lang, p);
  const words = Object.fromEntries((["menu", "sections", "search", "close", "home", "latest", "latestTitle", "archive", "searchPlaceholder",
    "settings", "size", "language", "services", "about", "savedTitle", "fHow", "fPolicy", "fFix", "fContact", "editorPage", "classifieds", "advertise"] as const)
    .map((k) => [k, t(lang, k)])) as Parameters<typeof Chrome>[0]["words"];
  const brk = await breakingNow();
  const bw = brk && (lang === "gu" ? brk.headline : lang === "en" ? brk.en?.headline : brk.hi?.headline);
  return (
    <>
      <a className="skip" href="#main">{t(lang, "skip")}</a>
      <Suspense fallback={null}><NavProgress /></Suspense>
      <Chrome
        lang={lang} name={PAPER.gu.name} tagline={PAPER[lang].tagline} words={words} bottomBar={bottomBar} active={active} mast={path === "/" ? dateText(new Date().toISOString(), lang, true) : undefined}
        paths={{ gu: href("gu", path), en: href("en", path), hi: href("hi", path) }}
        sections={[...SECTIONS.map((k) => ({ key: k, name: sectionName(k, lang), href: L(`/section/${k}`) })), { key: "aavtikal", name: flw(lang).name, href: L("/aavtikal") }]}
        links={{ home: L("/"), latest: L("/latest"), archive: L("/archive"), search: L("/search"), saved: L("/saved"), classifieds: L("/classifieds"), advertise: L("/advertise"),
                 about: L("/about"), how: L("/how-we-check"), policy: L("/editorial-policy"), corrections: L("/corrections"), contact: L("/contact") }}
      />
      <BreakingBar first={brk && { id: brk.id, headline: bw || brk.headline, href: L(`/news/${brk.id}`), until: Date.parse(brk.publishedAt) + BREAKING_HOURS * 3600_000 }}
        made={Date.now()} lang={lang} label={t(lang, "brk")} close={t(lang, "close")} />
      {bottomBar && <nav className="wrap secs" aria-label={t(lang, "sections")}>
        {SECTIONS.map((k) => <Link prefetch={false} key={k} href={L(`/section/${k}`)} className={section === k ? "on" : undefined}>{sectionName(k, lang)}</Link>)}
        {/* the flagship section (views/Flagship.tsx), set apart at the end */}
        <Link prefetch={false} href={L("/aavtikal")} className="fl">{flw(lang).name}</Link>
      </nav>}
      {/* the page's content crossfades into the next one (the header and footer stay put) */}
      <ViewTransition enter="page-in" exit="page-out" default="none">
        <main className="wrap" id="main" tabIndex={-1}>{children}</main>
      </ViewTransition>
      <ToTop label={t(lang, "toTop")} />
      <ServiceWorker />
      {/* on every page, stories too: most readers arrive straight on a story from Google or WhatsApp */}
      <InstallPrompt words={Object.fromEntries((["installTitle", "installText", "installBtn", "installIos", "installSteps", "later"] as const).map((k) => [k, t(lang, k)])) as Parameters<typeof InstallPrompt>[0]["words"]} />
      <div className="foot"><div className="wrap">
        <footer>
          <Link prefetch={false} className="wm" href={L("/")}><b>{PAPER.gu.name}</b></Link>
          <div className="fcols">
            <div><b>{t(lang, "f1")}</b><Link prefetch={false} href={L("/about")}>{t(lang, "fAbout")}</Link><Link prefetch={false} href={L("/editorial-policy")}>{t(lang, "fPolicy")}</Link>
              <Link prefetch={false} href={L("/how-we-check")}>{t(lang, "fHow")}</Link><Link prefetch={false} href={L("/corrections")}>{t(lang, "fFix")}</Link><Link prefetch={false} href={L("/contact")}>{t(lang, "fContact")}</Link></div>
            <div><b>{t(lang, "f2")}</b>{SECTIONS.map((k) => <Link prefetch={false} key={k} href={L(`/section/${k}`)}>{sectionName(k, lang)}</Link>)}<Link prefetch={false} href={L("/aavtikal")}>{flw(lang).name}</Link></div>
            <div><b>{t(lang, "f3")}</b><Link prefetch={false} href={L("/archive")}>{t(lang, "archive")}</Link>
              <Link prefetch={false} href={L("/classifieds")}>{t(lang, "classifieds")}</Link>
              <Link prefetch={false} href={L("/advertise")}>{t(lang, "advertise")}</Link>
              <Link prefetch={false} href={L("/rss")}>{t(lang, "fRss")}</Link>
              <a href={PREFERRED_SOURCE} target="_blank" rel="noopener">{t(lang, "prefShort")}</a>
              <a href={INSTAGRAM} target="_blank" rel="noopener me">Instagram</a></div>
            <div><b>{t(lang, "f4")}</b><Link prefetch={false} href={L("/terms")}>{t(lang, "fTerms")}</Link><Link prefetch={false} href={L("/privacy")}>{t(lang, "fPrivacy")}</Link>
              {(["gu", "hi", "en"] as const).filter((l) => l !== lang).map((l) => (
                <LangLink key={l} to={l} href={href(l, path)} hrefLang={l}>{{ gu: "ગુજરાતી", hi: "हिंदी", en: "English" }[l]}</LangLink>))}</div>
          </div>
          <p className="legal">© {num(PAPER.founded, lang)}–{num(new Date().getFullYear(), lang)} {PAPER[lang].name}, {PAPER[lang].place} · RNI {PAPER.rni}</p>
        </footer>
      </div></div>
    </>
  );
}

/** Runs before the first paint: the reader's text size, so nothing jumps. The site is light only
 *  (the user, 29 Oct); a theme saved by its old switch is forgotten, so Aavtikal, the one part
 *  with a dark look, simply follows the phone. And the fades between pages (the ViewTransition above): when one would
 *  start while the tab is in the background, the browser skips it and React reports "Transition was aborted because of
 *  invalid state" as an uncaught error (6 Nov, the user saw it); the page still changes, so that report is marked handled. */
export const PREPAINT = `try{var s=localStorage.getItem("ck-size"),r=document.documentElement;localStorage.removeItem("ck-theme");var t=localStorage.getItem("fl-theme");if(t==="light"||t==="dark")r.setAttribute("data-theme",t);` +
  `if(s==="2"||s==="3")r.setAttribute("data-size",s)}catch(e){}` +
  `var q=function(x){return x&&x.name==="InvalidStateError"&&/Transition was aborted/.test(x.message)};` +
  `addEventListener("unhandledrejection",function(e){if(q(e.reason))e.preventDefault()});addEventListener("error",function(e){if(q(e.error))e.preventDefault()});`;
