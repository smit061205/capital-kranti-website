"use client";
// "Capital Kranti on your phone": a small card asking a returning reader on a phone to put the site on their home
// screen (it's already an app: app/manifest.ts, public/sw.js). Android's Chrome installs it with one button; an
// iPhone can't, so the card says where to tap. Never for someone who has it already; "Later" hides it for two weeks.
// ?install=android or ?install=ios shows it anyway, to look at it.
import { useEffect, useState } from "react";

type Words = Record<"installTitle" | "installText" | "installBtn" | "installIos" | "later", string>;
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };

export default function InstallPrompt({ words: w }: { words: Words }) {
  const [kind, setKind] = useState<"android" | "ios" | null>(null);
  const [ev, setEv] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const forced = new URLSearchParams(location.search).get("install");
    if (forced === "android" || forced === "ios") { setKind(forced); return; }
    const installed = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (installed || !matchMedia("(max-width: 739px)").matches) return;
    // one visit a day counts; the card waits for the second
    const today = new Date().toDateString();
    const visits = Number(get("ck-visits") ?? "0") + (get("ck-visit-day") === today ? 0 : 1);
    set("ck-visits", String(visits)); set("ck-visit-day", today);
    const later = Number(get("ck-install-later") ?? "0");
    if (visits < 2 || Date.now() - later < 14 * 864e5) return;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) { setKind("ios"); return; }
    const take = (e: Event) => { e.preventDefault(); setEv(e as InstallEvent); setKind("android"); };
    addEventListener("beforeinstallprompt", take);
    return () => removeEventListener("beforeinstallprompt", take);
  }, []);
  if (!kind) return null;
  const close = () => { set("ck-install-later", String(Date.now())); setKind(null); };
  const install = async () => {
    if (!ev) return close();
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    if (outcome !== "accepted") set("ck-install-later", String(Date.now()));
    setKind(null);
  };
  return (
    <aside className="install" aria-label={w.installTitle}>
      <img src="/icon-192.png" alt="" width={48} height={48} />
      <div>
        <b>{w.installTitle}</b>
        <p>{kind === "ios" ? w.installIos : w.installText}</p>
        <div className="installb">
          {kind === "android" && <button type="button" className="go" onClick={install}>{w.installBtn}</button>}
          <button type="button" onClick={close}>{w.later}</button>
        </div>
      </div>
    </aside>
  );
}
