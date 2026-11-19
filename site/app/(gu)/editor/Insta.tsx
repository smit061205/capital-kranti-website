// The editor page's Instagram block (lib/insta.ts): whether the account is reached; a set made now, for the sections the
// editor picks; each section's latest set, its cards as they will go up: a card can be taken out, moved or given another
// photo (the pictures are made again within minutes), the words changed, and the set approved, which puts it up at once.
// The last few posted, with their links; and the editor's times, sections and whether sets come by themselves.
import s from "./editor.module.css";
import { approveClip, approveInsta, captionClip, captionInsta, dropInstaCard, dropReel, makeInstaNow, moveInstaCard, nextInstaPhoto, saveInstaTimes, skipClip, skipInsta } from "./actions.ts";
import ClipForm, { type ClipWords } from "./ClipForm.tsx";
import type { Clip } from "@/lib/clips.ts";
import { editionName, MAX_TIMES, MIN_KEPT, timeName, type InstaAsk, type InstaLogLine, type InstaNews, type InstaProgress, type InstaSet, type InstaSettings } from "@/lib/insta.ts";
import Renew from "./Renew.tsx";
import Press from "./Press.tsx";
import InstaLog from "./InstaLog.tsx";
import { POSTING_MS } from "@/lib/instamend.ts";
import { TIERS } from "@/lib/sections.ts";
import { num } from "@/lib/format.ts";
import { sectionName } from "@/lib/sections.ts";

const WORDS = {
  gu: {
    title: "ઇન્સ્ટાગ્રામ",
    note: (times: string, tiers: string) => `દરરોજ ${times} વાગ્યે ${tiers}ના મુખ્ય સમાચારના સેટ, એક કલાક પહેલાં અહીં તૈયાર થાય છે. મંજૂર કરશો ત્યારે જ મુકાશે; મંજૂર ન થયેલો સેટ એ વિભાગનો નવો સેટ બને ત્યારે (કે ૧૨ કલાકે) જાતે જતો રહેશે.`,
    manual: "સેટ જાતે બનતા નથી: જ્યારે જોઈએ ત્યારે નીચેથી બનાવો.", and: " અને ",
    off: "ઇન્સ્ટાગ્રામ ખાતું હજી જોડાયેલું નથી: મંજૂર કરેલો સેટ ખાતું જોડાયા પછી “હવે મૂકો” દબાવવાથી મુકાશે.",
    on: (n: string) => `ઇન્સ્ટાગ્રામ જોડાયેલું છે: @${n}`, broken: "ઇન્સ્ટાગ્રામ સુધી પહોંચાતું નથી. ઇન્સ્ટાગ્રામનું કારણ:",
    now: "હમણાં નવો સેટ બનાવો", nowHelp: "છેલ્લા ૧૨ કલાકના (ઓછા હોય તો ૨૪ કલાકના) સૌથી મહત્ત્વના સમાચારમાંથી, જે વિભાગ પસંદ કરો તેના. ૫ થી ૧૦ મિનિટમાં અહીં દેખાશે; મુકાતાં પહેલાં તમે જોઈ શકશો.",
    nowBtn: "સેટ બનાવો", asked: (t: string) => `${t} વાગ્યે માગ્યો.`,
    queued: "રાહમાં: અડધી મિનિટમાં શરૂ થશે, પછી ૫ થી ૧૦ મિનિટ લાગે છે.",
    since: (m: string) => `શરૂ થયાને ${m} મિનિટ`, ago: (m: string) => `${m} મિનિટ પહેલાં માગ્યો`, live: "આ પાનું જાતે તાજું થતું રહે છે.", lastAsk: (t: string) => `${t} વાગ્યે માગેલો સેટ:`,
    none: "આ વખતનો કોઈ સેટ નથી.", making: "ચિત્રો બની રહ્યાં છે: થોડી મિનિટમાં અહીં દેખાશે.", waiting: "મંજૂરીની રાહ", approved: "મંજૂર: મુકાવાનું બાકી", going: "ઇન્સ્ટાગ્રામ પર મુકાઈ રહ્યો છે…",
    posted: "મુકાયો", failed: "મુકાયો નહીં", expired: "સમય ગયો", igOnly: "ઇન્સ્ટાગ્રામ પર મુકાયો, ફેસબુક પર નહીં", fbOnly: "ફેસબુક પર મુકાયો, ઇન્સ્ટાગ્રામ પર નહીં",
    drop: "આ કાર્ડ હટાવો", next: "બીજો ફોટો", earlier: "← આગળ", later: "પાછળ →", caption: "ઇન્સ્ટાગ્રામ પરના શબ્દો", saveCaption: "શબ્દો સાચવો",
    approve: "મંજૂર કરો અને મૂકો", again: "હવે મૂકો", skip: "આ સેટ ન મૂકો", sure: "હા, ન મૂકો", see: "ઇન્સ્ટાગ્રામ પર જુઓ", last: "છેલ્લે મુકાયેલા",
    fbOn: (n: string) => `ફેસબુક પેજ જોડાયેલું છે: ${n}`, fbOff: "ફેસબુક પેજ હજી જોડાયેલું નથી: જોડાશે પછી સેટ ત્યાં પણ મુકાશે.",
    fbBroken: "ફેસબુક પેજ સુધી પહોંચાતું નથી. ફેસબુકનું કારણ:", fbSee: "ફેસબુક પર જુઓ", fbToo: "ફેસબુક પર પણ મૂકો",
    lastCard: "છેલ્લું કાર્ડ: વિભાગની લિંક",
    reel: "રીલ (આ જ કાર્ડનો વીડિયો, મથાળાં અવાજમાં)", reelNote: "મંજૂર કરશો તો કાર્ડની સાથે આ રીલ પણ ઇન્સ્ટાગ્રામ પર મુકાશે.",
    noReel: "રીલ ન મૂકો", reelSee: "રીલ જુઓ",
    settings: "સમય અને વિભાગ બદલો", how: "સેટ કેવી રીતે બને", auto: "દરરોજ નક્કી સમયે જાતે", byHand: "ફક્ત હું માગું ત્યારે",
    times: "સમય (ભારતનો)", timesHelp: `${num(MAX_TIMES, "gu")} સુધી સમય. દરેક સમયના એક કલાક પહેલાં સેટ તૈયાર થાય છે; ખાલી રાખેલો સમય ગણાશે નહીં.`,
    tiers: "કયા વિભાગના સેટ", save: "સાચવો",
    log: "શું થયું: દરેક પગલું (લોગ)",
    working: "થઈ રહ્યું છે…", posting: "મુકાય છે…", asking: "માગી રહ્યા છીએ…", saving: "સચવાય છે…",
    clip: {
      title: "તમારા વીડિયોની રીલ", help: "તમે કે અમારા પ્રતિનિધિએ લીધેલો વીડિયો પસંદ કરો: તેના પર સમાચારનું મથાળું, “કેપિટલ ક્રાંતિ” અને “વીડિયો: …” મુકાઈને રીલ બનશે (૨ થી ૫ મિનિટ, પહેલી ૯૦ સેકન્ડ), તેના પોતાના અવાજ સાથે. બીજાં છાપાં કે ચેનલના વીડિયો ન વાપરો: તેમનું નામ લખવાથી પણ વાપરવાની છૂટ મળતી નથી.",
      story: "કયા સમાચારનો વીડિયો", own: "— મથાળું જાતે લખો —", headline: "વીડિયો પરનું મથાળું", credit: "વીડિયો કોણે લીધો", creditDefault: "કેપિટલ ક્રાંતિ",
      video: "વીડિયો (ફોનમાંથી)", permission: "આ વીડિયો અમે જાતે લીધો છે, અથવા તેને વાપરવાની અમને લેખિત છૂટ છે.", send: "વીડિયો મોકલો",
      uploading: "અપલોડ થાય છે… {pc}%", done: "વીડિયો મળ્યો: રીલ બને છે, થોડી મિનિટમાં અહીં દેખાશે.", failed: "વીડિયો ન મોકલાયો; ફરી પ્રયાસ કરો",
      day: "આજના વીડિયો (૧૦) પૂરા થયા; કાલે મોકલો.", type: "આ ફાઇલ વીડિયો નથી (MP4 કે MOV મોકલો).", big: "વીડિયો ૩૦૦ MBથી મોટો છે; ટૂંકો કરીને મોકલો.",
      needVideo: "વીડિયો પસંદ કરો.", needHeadline: "મથાળું લખો કે સમાચાર પસંદ કરો.", needOwn: "વીડિયો તમારો છે કે વાપરવાની છૂટ છે તે ખાતરી કરો (ખાનું ટિક કરો).",
    } satisfies ClipWords,
    clipMaking: "રીલ બની રહી છે: થોડી મિનિટમાં અહીં દેખાશે.", clipPost: "ઇન્સ્ટાગ્રામ પર મૂકો", clipSkip: "આ રીલ ન મૂકો", clipBy: (n: string) => `${n}એ મોકલ્યો`,
  },
  en: {
    title: "Instagram",
    note: (times: string, tiers: string) => `Every day at ${times}, sets of the main ${tiers} news are ready here an hour ahead. Nothing goes up until you approve it; a set not approved goes by itself when a newer one of its section is made (or after 12 hours).`,
    manual: "Sets aren't made by themselves: make one below whenever you want.", and: " and ",
    off: "The Instagram account isn't connected yet: an approved set goes up with “Post now” once it is.",
    on: (n: string) => `Instagram is connected: @${n}`, broken: "Instagram can't be reached. Instagram's reason:",
    now: "Make a new set now", nowHelp: "From the most important stories of the last 12 hours (24 when there are too few), for the sections you pick. It shows here in 5 to 10 minutes; you see it before it goes up.",
    nowBtn: "Make the set", asked: (t: string) => `Asked for at ${t}.`,
    queued: "Waiting: it starts within half a minute, then takes 5 to 10 minutes.",
    since: (m: string) => `Started ${m} min ago`, ago: (m: string) => `asked ${m} min ago`, live: "This page renews itself.", lastAsk: (t: string) => `The set asked for at ${t}:`,
    none: "No set this time.", making: "The pictures are being made: they show here in a few minutes.", waiting: "Waiting for you", approved: "Approved: not up yet", going: "Going up on Instagram…",
    posted: "Posted", failed: "Not posted", expired: "Time passed", igOnly: "Up on Instagram, not on Facebook", fbOnly: "Up on Facebook, not on Instagram",
    drop: "Take this card out", next: "Another photo", earlier: "← Earlier", later: "Later →", caption: "The words on Instagram", saveCaption: "Save the words",
    approve: "Approve and post", again: "Post now", skip: "Don't post this set", sure: "Yes, don't post", see: "See it on Instagram", last: "Posted lately",
    fbOn: (n: string) => `The Facebook Page is connected: ${n}`, fbOff: "The Facebook Page isn't connected yet: once it is, sets go up there too.",
    fbBroken: "The Facebook Page can't be reached. Facebook's reason:", fbSee: "See it on Facebook", fbToo: "Post on Facebook too",
    lastCard: "Last card: the section's link",
    reel: "Reel (the same cards as a video, headlines read out)", reelNote: "Approving the set posts this Reel on Instagram with the cards.",
    noReel: "Don't post the Reel", reelSee: "See the Reel",
    settings: "Change the times and sections", how: "How sets are made", auto: "By themselves, every day at set times", byHand: "Only when I ask",
    times: "Times (India)", timesHelp: `Up to ${MAX_TIMES} times. A set is ready an hour before each; a time left empty doesn't count.`,
    tiers: "Sets for which sections", save: "Save",
    log: "What happened: every step (log)",
    working: "Working…", posting: "Posting…", asking: "Asking…", saving: "Saving…",
    clip: {
      title: "A Reel from your video", help: "Choose a video you or our reporter filmed: the story's headline, “Capital Kranti” and “Video: …” go over it and it becomes a Reel (2 to 5 minutes, the first 90 seconds), with its own sound. Don't use other papers' or channels' videos: naming them doesn't give permission to use them.",
      story: "Which story is it for", own: "— write the headline yourself —", headline: "The headline on the video", credit: "Who filmed it", creditDefault: "કેપિટલ ક્રાંતિ",
      video: "The video (from the phone)", permission: "We filmed this video ourselves, or have written permission to use it.", send: "Send the video",
      uploading: "Uploading… {pc}%", done: "Video received: the Reel is being made and shows here in a few minutes.", failed: "The video wasn't sent; try again",
      day: "Today's videos (10) are used; send it tomorrow.", type: "This file isn't a video (send an MP4 or MOV).", big: "The video is over 300 MB; send a shorter one.",
      needVideo: "Choose a video.", needHeadline: "Write a headline or pick a story.", needOwn: "Confirm the video is yours or you may use it (tick the box).",
    } satisfies ClipWords,
    clipMaking: "The Reel is being made: it shows here in a few minutes.", clipPost: "Post on Instagram", clipSkip: "Don't post this Reel", clipBy: (n: string) => `sent by ${n}`,
  },
};

/** "સાંજે ૭:૦૦" for a moment */
const clock = (iso: string, lang: "gu" | "en") => timeName(new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(11, 16), lang);
const list = (xs: string[], and: string) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")}${and}${xs.at(-1)}` : xs[0] ?? "");

export default function Insta({ lang, sets, settings, ask, news, progress, who, page, logs, clips = [], stories = [] }: {
  lang: "gu" | "en"; sets: InstaSet[]; settings: InstaSettings; ask: InstaAsk | null; news: InstaNews | null; progress: InstaProgress | null;
  who: { name: string } | { why: string } | null; page: { name: string } | { why: string } | null; logs: InstaLogLine[];
  clips?: Clip[]; stories?: { id: string; headline: string }[];
}) {
  const w = WORDS[lang];
  const nn = (x: number) => (lang === "gu" ? num(x, "gu") : String(x));
  const current = sets.filter((x) => ["making", "waiting", "approved", "failed"].includes(x.state) && x.cards.length);
  const posted = sets.filter((x) => x.state === "posted").slice(0, 6);
  // the engine's progress, if it renewed it in the last five minutes (a run cut short leaves it behind)
  const working = progress && Date.now() - new Date(progress.at).getTime() < 5 * 60_000 ? progress : null;
  const mins = (iso: string) => nn(Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000)));
  // going up on Instagram now: approved, and started (postedAt) within the button's five minutes
  const going = (x: InstaSet) => x.state === "approved" && !!x.postedAt && Date.now() - new Date(x.postedAt).getTime() < POSTING_MS;
  // a set up in one place but not the other says so, not just "not posted"
  const stateName = (x: InstaSet) => going(x) ? w.going
    : x.state === "failed" && x.postUrl ? w.igOnly : x.state === "failed" && x.fbUrl ? w.fbOnly : w[x.state as "waiting"];
  const clipGoing = (c: Clip) => c.state === "approved" && !!c.postedAt && Date.now() - new Date(c.postedAt).getTime() < POSTING_MS;
  const clipsNow = clips.filter((c) => ["making", "waiting", "approved", "failed"].includes(c.state) && (c.reel || c.state === "making"));
  const clipsUp = clips.filter((c) => c.state === "posted" && c.reelUrl).slice(0, 3);
  const busy = !!ask || !!working || current.some((x) => x.state === "making" || going(x)) || clipsNow.some((c) => c.state === "making" || clipGoing(c));
  const bar = working && (
    <div className={s.progress}>
      <progress max={working.total} value={working.done} />
      <p><b>{working.step}</b> · {w.since(mins(working.started))}</p>
    </div>
  );
  const tierName = (t: (typeof TIERS)[number]) => sectionName(t, lang);
  const times = Array.from({ length: MAX_TIMES }, (_, i) => settings.times[i] ?? "");
  const tierPills = (picked: readonly string[]) => (
    <div className={s.pills}>{TIERS.map((t) => (
      <label key={t}><input type="checkbox" name="tier" value={t} defaultChecked={picked.includes(t)} /><span>{tierName(t)}</span></label>
    ))}</div>
  );
  return (
    <section className={s.block} aria-labelledby="insta">
      {busy && <Renew />}
      <h2 id="insta">{w.title} {current.some((x) => x.state === "waiting") && <span className={s.count}>{nn(current.filter((x) => x.state === "waiting").length)}</span>}</h2>
      <p className={s.help}>{settings.auto && settings.times.length
        ? w.note(list(settings.times.map((t) => timeName(t, lang)), w.and), list(settings.tiers.map(tierName), w.and))
        : w.manual}</p>
      {!who ? <p className={s.note}>{w.off}</p>
        : "name" in who ? <p className={s.done}>✓ {w.on(who.name)}</p>
        : <p className={s.why}>{w.broken} {who.why}</p>}
      {!page ? <p className={s.note}>{w.fbOff}</p>
        : "name" in page ? <p className={s.done}>✓ {w.fbOn(page.name)}</p>
        : <p className={s.why}>{w.fbBroken} {page.why}</p>}

      <div className={s.card}>
        <h3>{w.now}</h3>
        {ask ? <>
          {bar || <p className={s.running}>{w.queued}</p>}
          <p className={s.when}>{w.asked(clock(ask.at, lang))} ({w.ago(mins(ask.at))}) · {w.live}</p>
        </> : (
          <form className={s.form} action={makeInstaNow}>
            <p className={s.help}>{w.nowHelp}</p>
            {tierPills(settings.tiers)}
            <Press className={s.yes} style={{ alignSelf: "flex-start" }} busy={w.asking}>{w.nowBtn}</Press>
          </form>
        )}
        {news && !ask && Date.now() - new Date(news.at).getTime() < 6 * 3600_000 && <p className={s.when}>{w.lastAsk(clock(news.at, lang))} {news.text}</p>}
      </div>

      <div className={s.card}>
        <h3>{w.clip.title}</h3>
        <ClipForm w={w.clip} stories={stories} lang={lang} />
        {clipsNow.map((c) => (
          <article key={c.id} className={s.reel}>
            {c.reel ? <video src={c.reel} controls playsInline preload="metadata" width={180} height={320} /> : null}
            <div>
              <p className={s.tag}>{c.headline} · {clipGoing(c) ? w.going : c.state === "making" ? w.clipMaking : w[c.state as "waiting"]} · {w.clipBy(c.by)}</p>
              {c.note && <p className={c.state === "failed" ? s.why : s.help}>{c.note}</p>}
              {c.reel && c.state !== "making" && !clipGoing(c) && <>
                <details className={s.more}><summary>{w.caption}</summary>
                  <form className={s.form} action={captionClip.bind(null, c.id)}>
                    <textarea name="caption" rows={8} maxLength={2200} defaultValue={c.caption} aria-label={w.caption} />
                    <Press className={s.small} busy={w.saving}>{w.saveCaption}</Press>
                  </form>
                </details>
                <div className={s.buttons}>
                  <form action={approveClip.bind(null, c.id)}><Press className={s.yes} busy={w.posting}>{w.clipPost}</Press></form>
                  <details className={s.confirm}><summary>{w.clipSkip}</summary>
                    <form action={skipClip.bind(null, c.id)}><Press className={s.no} busy={w.working}>{w.sure}</Press></form></details>
                </div>
              </>}
            </div>
          </article>
        ))}
        {clipsUp.length > 0 && <ul className={s.runs}>{clipsUp.map((c) => (
          <li key={c.id}><span>{c.headline}</span><a href={c.reelUrl!} target="_blank" rel="noopener">{w.reelSee}</a></li>
        ))}</ul>}
      </div>

      {current.length ? current.map((set) => (
        <article key={set.id} className={s.card}>
          <p className={s.tag}>{sectionName(set.tier, "gu")} · {editionName(set.edition)} · {stateName(set)}
            {set.postUrl && <> · <a href={set.postUrl} target="_blank" rel="noopener">{w.see}</a></>}
            {set.reelUrl && <> · <a href={set.reelUrl} target="_blank" rel="noopener">{w.reelSee}</a></>}
            {set.fbUrl && <> · <a href={set.fbUrl} target="_blank" rel="noopener">{w.fbSee}</a></>}</p>
          {set.note && <p className={s.why}>{set.note}</p>}
          {set.state === "making" || !set.image ? (
            <>
              {!ask && bar ? bar : <p className={s.running}>{w.making}</p>}
              <ol className={s.runs}>{set.cards.map((c) => <li key={c.storyId}>{c.headline}</li>)}</ol>
            </>
          ) : (
            <div className={s.cards}>
              {set.cards.map((c, i) => (
                <figure key={c.storyId}>
                  <img src={`${set.image}?card=${i + 1}&w=360`} width={360} height={450} alt={c.headline} loading="lazy" />
                  {set.state === "waiting" && (
                    <figcaption>
                      {i > 0 && <form action={moveInstaCard.bind(null, set.id, i, -1)}><Press className={s.small} busy={w.working}>{w.earlier}</Press></form>}
                      {i < set.cards.length - 1 && <form action={moveInstaCard.bind(null, set.id, i, 1)}><Press className={s.small} busy={w.working}>{w.later}</Press></form>}
                      {c.options.length > 1 && <form action={nextInstaPhoto.bind(null, set.id, i)}><Press className={s.small} busy={w.working}>{w.next} ({nn(c.pick + 1)}/{nn(c.options.length)})</Press></form>}
                      {set.cards.length > MIN_KEPT && <form action={dropInstaCard.bind(null, set.id, i)}><Press className={s.small} busy={w.working}>{w.drop}</Press></form>}
                    </figcaption>
                  )}
                </figure>
              ))}
              <figure>
                <img src={`${set.image}?card=${set.cards.length + 1}&w=360`} width={360} height={450} alt={w.lastCard} loading="lazy" />
              </figure>
            </div>
          )}
          {set.reel && set.image && set.state !== "making" && (
            <div className={s.reel}>
              <video src={set.reel} controls playsInline preload="metadata" width={180} height={320} />
              <div>
                <p className={s.tag}>{w.reel}</p>
                {!set.reelUrl && <p className={s.help}>{w.reelNote}</p>}
                {!set.reelUrl && set.state !== "posted" && !going(set) &&
                  <form action={dropReel.bind(null, set.id)}><Press className={s.small} busy={w.working}>{w.noReel}</Press></form>}
              </div>
            </div>
          )}
          {set.state !== "making" && (
            <details className={s.more}><summary>{w.caption}</summary>
              <form className={s.form} action={captionInsta.bind(null, set.id)}>
                <textarea name="caption" rows={12} maxLength={2200} defaultValue={set.caption} aria-label={w.caption} />
                <Press className={s.small} busy={w.saving}>{w.saveCaption}</Press>
              </form>
            </details>
          )}
          <div className={s.buttons}>
            {set.image && set.state !== "making" && !going(set) && <form action={approveInsta.bind(null, set.id)}><Press className={s.yes} busy={w.posting}>{set.state === "waiting" ? w.approve : w.again}</Press></form>}
            <details className={s.confirm}><summary>{w.skip}</summary>
              <form action={skipInsta.bind(null, set.id)}><Press className={s.no} busy={w.working}>{w.sure}</Press></form></details>
          </div>
        </article>
      )) : <p className={s.empty}>{w.none}</p>}
      {posted.length > 0 && <>
        <h3 className={s.sub}>{w.last}</h3>
        <ul className={s.runs}>{posted.map((x) => (
          <li key={x.id}><span>{sectionName(x.tier, "gu")} · {editionName(x.edition)}</span>
            {x.postUrl && <a href={x.postUrl} target="_blank" rel="noopener">{w.see}</a>}
            {x.fbUrl && <a href={x.fbUrl} target="_blank" rel="noopener">{w.fbSee}</a>}
            {!x.fbUrl && page && "name" in page && x.image && (
              <form action={approveInsta.bind(null, x.id)}><Press className={s.small} busy={w.posting}>{w.fbToo}</Press></form>
            )}</li>
        ))}</ul>
      </>}

      <details className={s.more}><summary>{w.settings}</summary>
        <form className={s.form} action={saveInstaTimes}>
          <fieldset className={s.pick}><legend>{w.how}</legend>
            <div className={s.pills}>
              <label><input type="radio" name="auto" value="on" defaultChecked={settings.auto} /><span>{w.auto}</span></label>
              <label><input type="radio" name="auto" value="off" defaultChecked={!settings.auto} /><span>{w.byHand}</span></label>
            </div>
          </fieldset>
          <fieldset className={s.pick}><legend>{w.times}</legend>
            <div className={s.times}>{times.map((t, i) => <input key={i} type="time" name="time" defaultValue={t} className={s.select} aria-label={`${w.times} ${i + 1}`} />)}</div>
            <span className={s.help}>{w.timesHelp}</span>
          </fieldset>
          <fieldset className={s.pick}><legend>{w.tiers}</legend>{tierPills(settings.tiers)}</fieldset>
          <Press className={s.yes} style={{ alignSelf: "flex-start" }} busy={w.saving}>{w.save}</Press>
        </form>
      </details>

      <details className={s.more} open><summary>{w.log}</summary>
        <InstaLog lang={lang} first={logs} />
      </details>
    </section>
  );
}
