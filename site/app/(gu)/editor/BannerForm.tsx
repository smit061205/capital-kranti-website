"use client";
// A banner ad put up (lib/banners.ts): its picture from the phone or computer (made a JPEG here, at most 1,600 wide, on
// white, and kept by app/api/editor/photo as on the write page), where a click leads, the advertiser's name, where on
// the site it shows and for how many days.
import { useRef, useState } from "react";
import s from "./editor.module.css";
import { W } from "./words.ts";
import { addBannerAction } from "./actions.ts";
import { BANNER_DAYS, SLOTS, SLOT_NAMES, type Slot } from "@/lib/banners.ts";

/** the banner as a JPEG at most 1,600 pixels wide, on white (a see-through picture would turn black) */
async function asJpeg(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * k), height = Math.round(bmp.height * k);
  const c = document.createElement("canvas");
  c.width = width; c.height = height;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, width, height);
  g.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.9));
  if (!blob) throw new Error("no JPEG");
  return { blob, width, height };
}

export default function BannerForm({ lang }: { lang: "gu" | "en" }) {
  const w = W[lang];
  const [image, setImage] = useState<{ url: string; width: number; height: number } | null>(null);
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<Slot[]>(["home", "end"]);
  const [days, setDays] = useState(BANNER_DAYS[2]);
  const [busy, setBusy] = useState<"" | "photo" | "save">("");
  const [say, setSay] = useState<{ text: string; good: boolean } | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function photo(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy("photo"); setSay(null);
    try {
      const { blob, width, height } = await asJpeg(file);
      const res = await fetch(`/api/editor/photo?w=${width}&h=${height}`, { method: "POST", body: blob, headers: { "content-type": "image/jpeg" } });
      if (!res.ok) throw new Error(String(res.status));
      setImage((await res.json()) as { url: string; width: number; height: number });
    } catch { setSay({ text: w.badPhoto, good: false }); }
    setBusy("");
    if (picker.current) picker.current.value = "";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!image || !slots.length) { setSay({ text: w.bannerNotSaved, good: false }); return; }
    setBusy("save");
    const ok = await addBannerAction({ image: image.url, width: image.width, height: image.height, link, name, slots, days }).catch(() => false);
    setBusy("");
    setSay({ text: ok ? w.bannerSaved : w.bannerNotSaved, good: ok });
    if (ok) { setImage(null); setLink(""); setName(""); }
  }

  return (
    <form className={s.form} onSubmit={save}>
      {say && <p className={say.good ? s.done : s.stopped} role="status">{say.text}</p>}
      <label>{w.bannerPicture}
        <input ref={picker} className={s.select} type="file" accept="image/*" onChange={(e) => void photo(e.target.files)} disabled={busy === "photo"} />
        <span className={s.help}>{busy === "photo" ? w.bannerSending : w.bannerSize}</span>
      </label>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image.url} width={image.width} height={image.height} alt="" style={{ maxWidth: "100%", height: "auto", border: "1px solid var(--rule)" }} />}
      <label>{w.bannerLink}<input className={s.select} type="url" inputMode="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} required lang="en" /></label>
      <label>{w.bannerName}<input className={s.select} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
      <fieldset className={s.pills}><legend>{w.bannerWhere}</legend>
        {SLOTS.map((k) => (
          <label key={k}><input type="checkbox" checked={slots.includes(k)} onChange={(e) => setSlots((x) => (e.target.checked ? [...x, k] : x.filter((y) => y !== k)))} /><span>{SLOT_NAMES[k][lang]}</span></label>
        ))}
      </fieldset>
      <fieldset className={s.pills}><legend>{w.adDays}</legend>
        {BANNER_DAYS.map((n) => <label key={n}><input type="radio" name="bdays" checked={days === n} onChange={() => setDays(n)} /><span>{lang === "gu" ? String(n).replace(/\d/g, (d) => "૦૧૨૩૪૫૬૭૮૯"[+d]) : n} {w.dayWord}</span></label>)}
      </fieldset>
      <button className={s.big} disabled={busy !== "" || !image}>{busy === "save" ? w.bannerSending : w.bannerSave}</button>
    </form>
  );
}
