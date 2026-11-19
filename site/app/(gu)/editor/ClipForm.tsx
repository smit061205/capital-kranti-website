"use client";
// A video from the editor's phone made into a Reel (lib/clips.ts): he picks the story (its headline goes over the video,
// and he may change it), says who filmed it and that the paper may use it, and chooses the video. It goes straight to the
// photo store with a one-time pass (actions.ts clipPass: a video is far more than a request to the site may carry), then
// is recorded (addClip) and the Instagram runner makes the Reel within minutes (engine/clips.ts).
import { put } from "@vercel/blob/client";
import { useRef, useState } from "react";
import s from "./editor.module.css";
import { addClip, clipPass } from "./actions.ts";

export interface ClipWords {
  title: string; help: string; story: string; own: string; headline: string; credit: string; creditDefault: string; video: string;
  permission: string; send: string; /** "{pc}" is the share done */ uploading: string; done: string; failed: string; day: string; type: string; big: string;
  needVideo: string; needHeadline: string; needOwn: string;
}

const GU = "૦૧૨૩૪૫૬૭૮૯";
export default function ClipForm({ w, stories, lang }: { w: ClipWords; stories: { id: string; headline: string }[]; lang: "gu" | "en" }) {
  const nn = (x: number) => (lang === "gu" ? String(x).replace(/\d/g, (d) => GU[Number(d)]) : String(x));
  const [storyId, setStoryId] = useState("");
  const [headline, setHeadline] = useState("");
  const [credit, setCredit] = useState(w.creditDefault);
  const [own, setOwn] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pc, setPc] = useState<number | null>(null);
  const [say, setSay] = useState<{ text: string; good: boolean } | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setSay({ text: w.needVideo, good: false });
    if (!headline.trim()) return setSay({ text: w.needHeadline, good: false });
    if (!own) return setSay({ text: w.needOwn, good: false });
    if (file.size > 300 * 1024 * 1024) return setSay({ text: w.big, good: false });
    setSay(null);
    setPc(0);
    try {
      const ext = (file.name.split(".").pop() ?? "").toLowerCase() || "mp4";
      const pass = await clipPass(ext);
      if ("error" in pass) { setPc(null); return setSay({ text: pass.error === "day" ? w.day : w.type, good: false }); }
      await put(pass.path, file, { access: "private", token: pass.token, contentType: file.type || "video/mp4", multipart: file.size > 20 * 1024 * 1024,
        onUploadProgress: (p) => setPc(Math.round(p.percentage)) });
      const r = await addClip({ id: pass.id, path: pass.path, storyId, headline, credit, own });
      setPc(null);
      if ("error" in r) return setSay({ text: `${w.failed} (${r.error})`, good: false });
      setSay({ text: w.done, good: true });
      setFile(null); setStoryId(""); setHeadline(""); setOwn(false);
      if (picker.current) picker.current.value = "";
    } catch (err) {
      setPc(null);
      setSay({ text: `${w.failed} (${err instanceof Error ? err.message : err})`, good: false });
    }
  }

  return (
    <form className={s.form} onSubmit={send}>
      <p className={s.help}>{w.help}</p>
      <label className={s.field}><span>{w.story}</span>
        <select className={s.select} value={storyId} onChange={(e) => {
          setStoryId(e.target.value);
          const st = stories.find((x) => x.id === e.target.value);
          if (st) setHeadline(st.headline);
        }}>
          <option value="">{w.own}</option>
          {stories.map((x) => <option key={x.id} value={x.id}>{x.headline}</option>)}
        </select>
      </label>
      <label className={s.field}><span>{w.headline}</span>
        <textarea rows={2} maxLength={160} value={headline} onChange={(e) => setHeadline(e.target.value)} /></label>
      <label className={s.field}><span>{w.credit}</span>
        <input maxLength={60} value={credit} onChange={(e) => setCredit(e.target.value)} /></label>
      <label className={s.field}><span>{w.video}</span>
        <input ref={picker} type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      <label className={s.check}><input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} /><span>{w.permission}</span></label>
      {pc !== null && <p className={s.running}><progress max={100} value={pc} /> {w.uploading.replace("{pc}", nn(pc))}</p>}
      {say && <p className={say.good ? s.done : s.why}>{say.text}</p>}
      <button className={s.yes} style={{ alignSelf: "flex-start" }} disabled={pc !== null}>{w.send}</button>
    </form>
  );
}
