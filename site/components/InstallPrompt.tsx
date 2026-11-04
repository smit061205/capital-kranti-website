"use client";
// "Capital Kranti on your phone": a small card asking a reader on a phone to put the site on their home screen (it's
// already an app: app/manifest.ts, public/sw.js), a few seconds into their first visit (the user, 4 Nov: "quickly",
// not from the second day). Android's Chrome installs it with one button; where the browser can't (an iPhone, or an
// Android browser that doesn't offer it), the card says where to tap. Never for someone who has it already, nor inside
// Instagram's, Facebook's or WhatsApp's own browsers, which can't install; "Later" hides it for three days.
// ?install=android or ?install=ios shows it anyway, to look at it.
import { useEffect, useState } from "react";

type Words = Record<"installTitle" | "installText" | "installBtn" | "installIos" | "installSteps" | "later", string>;
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };

export default function InstallPrompt({ words: w }: { words: Words }) {
  const [kind, setKind] = useState<"android" | "ios" | "steps" | null>(null);
  const [ev, setEv] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const forced = new URLSearchParams(location.search).get("install");
    if (forced === "android" || forced === "ios" || forced === "steps") { setKind(forced); return; }
    const installed = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    const ua = navigator.userAgent;
    if (installed || !matchMedia("(max-width: 739px)").matches || /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|; wv\)/i.test(ua)) return;
    if (Date.now() - Number(get("ck-install-later") ?? "0") < 3 * 864e5) return;
    // Chrome's own install offer, when it makes one; the card itself comes a few seconds in, with the button if the
    // offer came and the steps if it didn't
    let offer: InstallEvent | null = null;
    const take = (e: Event) => { e.preventDefault(); offer = e as InstallEvent; setEv(offer); };
    addEventListener("beforeinstallprompt", take);
    const k = setTimeout(() => setKind(/iphone|ipad|ipod/i.test(ua) ? "ios" : offer ? "android" : "steps"), 4000);
    return () => { removeEventListener("beforeinstallprompt", take); clearTimeout(k); };
  }, []);
  // an offer arriving after the card shows still gives it its button
  useEffect(() => { if (ev && kind === "steps") setKind("android"); }, [ev, kind]);
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
        {/* the iPhone's share button sits below in Safari and above in Chrome, so the card draws it rather than saying where */}
        <p>{kind === "ios" && <svg className="shareic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          {kind === "ios" ? w.installIos : kind === "steps" ? w.installSteps : w.installText}</p>
        <div className="installb">
          {kind === "android" && <button type="button" className="go" onClick={install}>{w.installBtn}</button>}
          <button type="button" onClick={close}>{w.later}</button>
        </div>
      </div>
    </aside>
  );
}
