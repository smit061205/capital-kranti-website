// The editor page's Instagram block (lib/insta.ts): each section's set for this edition, its cards as they will go up;
// a card can be taken out or given another photo (the pictures are made again within a quarter of an hour), the words
// changed, and the set approved, which puts it up at once. The last few posted, with their links.
import s from "./editor.module.css";
import { approveInsta, captionInsta, dropInstaCard, nextInstaPhoto, skipInsta } from "./actions.ts";
import { editionName, MIN_KEPT, type InstaSet } from "@/lib/insta.ts";
import { num } from "@/lib/format.ts";
import { sectionName } from "@/lib/sections.ts";

const WORDS = {
  gu: {
    title: "ઇન્સ્ટાગ્રામ", note: "દરરોજ સવારે ૮ અને સાંજે ૭ વાગ્યે ગુજરાત, દેશ અને વિશ્વના મુખ્ય સમાચારના સેટ, એક કલાક પહેલાં અહીં તૈયાર થાય છે. મંજૂર કરશો ત્યારે જ મુકાશે; મંજૂર ન થયેલો સેટ આગલા સેટ વખતે જાતે જતો રહેશે.",
    off: "ઇન્સ્ટાગ્રામ ખાતું હજી જોડાયેલું નથી: મંજૂર કરેલો સેટ ખાતું જોડાયા પછી “હવે મૂકો” દબાવવાથી મુકાશે.",
    none: "આ વખતનો કોઈ સેટ નથી.", making: "ચિત્રો બની રહ્યાં છે: ૧૫ મિનિટમાં અહીં દેખાશે.", waiting: "મંજૂરીની રાહ", approved: "મંજૂર: મુકાવાનું બાકી",
    posted: "મુકાયો", failed: "મુકાયો નહીં", expired: "સમય ગયો",
    drop: "આ કાર્ડ હટાવો", next: "બીજો ફોટો", caption: "ઇન્સ્ટાગ્રામ પરના શબ્દો", saveCaption: "શબ્દો સાચવો",
    approve: "મંજૂર કરો અને મૂકો", again: "હવે મૂકો", skip: "આ સેટ ન મૂકો", sure: "હા, ન મૂકો", see: "ઇન્સ્ટાગ્રામ પર જુઓ", last: "છેલ્લે મુકાયેલા",
    lastCard: "છેલ્લું કાર્ડ: વિભાગની લિંક",
  },
  en: {
    title: "Instagram", note: "Every day at 8 in the morning and 7 in the evening, sets of the main Gujarat, India and world news are ready here an hour ahead. Nothing goes up until you approve it; a set not approved goes by itself at the next one.",
    off: "The Instagram account isn't connected yet: an approved set goes up with “Post now” once it is.",
    none: "No set this time.", making: "The pictures are being made: they show here within 15 minutes.", waiting: "Waiting for you", approved: "Approved: not up yet",
    posted: "Posted", failed: "Not posted", expired: "Time passed",
    drop: "Take this card out", next: "Another photo", caption: "The words on Instagram", saveCaption: "Save the words",
    approve: "Approve and post", again: "Post now", skip: "Don't post this set", sure: "Yes, don't post", see: "See it on Instagram", last: "Posted lately",
    lastCard: "Last card: the section's link",
  },
};

export default function Insta({ lang, sets, on }: { lang: "gu" | "en"; sets: InstaSet[]; on: boolean }) {
  const w = WORDS[lang];
  const nn = (x: number) => (lang === "gu" ? num(x, "gu") : String(x));
  const current = sets.filter((x) => ["making", "waiting", "approved", "failed"].includes(x.state) && x.cards.length);
  const posted = sets.filter((x) => x.state === "posted").slice(0, 6);
  return (
    <section className={s.block} aria-labelledby="insta">
      <h2 id="insta">{w.title} {current.some((x) => x.state === "waiting") && <span className={s.count}>{nn(current.filter((x) => x.state === "waiting").length)}</span>}</h2>
      <p className={s.help}>{w.note}</p>
      {!on && <p className={s.note}>{w.off}</p>}
      {current.length ? current.map((set) => (
        <article key={set.id} className={s.card}>
          <p className={s.tag}>{sectionName(set.tier, "gu")} · {editionName(set.edition)} · {w[set.state as "waiting"]}</p>
          {set.note && <p className={s.why}>{set.note}</p>}
          {set.state === "making" || !set.image ? (
            <>
              <p className={s.running}>{w.making}</p>
              <ol className={s.runs}>{set.cards.map((c) => <li key={c.storyId}>{c.headline}</li>)}</ol>
            </>
          ) : (
            <div className={s.cards}>
              {set.cards.map((c, i) => (
                <figure key={c.storyId}>
                  <img src={`${set.image}?card=${i + 1}&w=360`} width={360} height={450} alt={c.headline} loading="lazy" />
                  {set.state === "waiting" && (
                    <figcaption>
                      {c.options.length > 1 && <form action={nextInstaPhoto.bind(null, set.id, i)}><button className={s.small}>{w.next} ({nn(c.pick + 1)}/{nn(c.options.length)})</button></form>}
                      {set.cards.length > MIN_KEPT && <form action={dropInstaCard.bind(null, set.id, i)}><button className={s.small}>{w.drop}</button></form>}
                    </figcaption>
                  )}
                </figure>
              ))}
              <figure>
                <img src={`${set.image}?card=${set.cards.length + 1}&w=360`} width={360} height={450} alt={w.lastCard} loading="lazy" />
              </figure>
            </div>
          )}
          {set.state !== "making" && (
            <details className={s.more}><summary>{w.caption}</summary>
              <form className={s.form} action={captionInsta.bind(null, set.id)}>
                <textarea name="caption" rows={12} maxLength={2200} defaultValue={set.caption} aria-label={w.caption} />
                <button className={s.small}>{w.saveCaption}</button>
              </form>
            </details>
          )}
          <div className={s.buttons}>
            {set.image && set.state !== "making" && <form action={approveInsta.bind(null, set.id)}><button className={s.yes}>{set.state === "waiting" ? w.approve : w.again}</button></form>}
            <details className={s.confirm}><summary>{w.skip}</summary>
              <form action={skipInsta.bind(null, set.id)}><button className={s.no}>{w.sure}</button></form></details>
          </div>
        </article>
      )) : <p className={s.empty}>{w.none}</p>}
      {posted.length > 0 && <>
        <h3 className={s.sub}>{w.last}</h3>
        <ul className={s.runs}>{posted.map((x) => (
          <li key={x.id}><span>{sectionName(x.tier, "gu")} · {editionName(x.edition)}</span>{x.postUrl && <a href={x.postUrl} target="_blank" rel="noopener">{w.see}</a>}</li>
        ))}</ul>
      </>}
    </section>
  );
}
