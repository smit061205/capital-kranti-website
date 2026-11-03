// The classified ads (lib/classifieds.ts), by kind, newest first; a phone number can be tapped to call.
import Link from "next/link";
import type { Lang } from "../lib/types.ts";
import { ads, KINDS, KIND_NAMES } from "../lib/classifieds.ts";
import { db } from "../lib/db.ts";
import { dateText, num } from "../lib/format.ts";
import { href, t } from "../lib/i18n.ts";
import Frame from "../components/Frame.tsx";

export default async function Classifieds({ lang }: { lang: Lang }) {
  const list = await ads(db());
  const kinds = KINDS.filter((k) => list.some((a) => a.kind === k));
  return (
    <Frame lang={lang} path="/classifieds">
      <div className="sechead"><h1>{t(lang, "classifieds")}</h1></div>
      <p className="note" style={{ margin: "0 0 8px" }}>{t(lang, "adsNote")} <Link prefetch={false} href={href(lang, "/advertise")}>{t(lang, "advertise")}</Link></p>
      {kinds.length ? kinds.map((k) => (
        <section key={k} className="ads">
          <h2 className="h3">{KIND_NAMES[k][lang]}</h2>
          <ul>
            {list.filter((a) => a.kind === k).map((a) => (
              <li key={a.id}>
                <p>{a.text}</p>
                <div className="meta">
                  {a.place && <span>{a.place}</span>}
                  {a.contact && <a href={`tel:${a.contact.replace(/[^\d+]/g, "")}`}>{num(a.contact, lang)}</a>}
                  <span>{dateText(a.until, lang)} {t(lang, "adsUntil")}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )) : <p className="empty">{t(lang, "adsNone")}</p>}
    </Frame>
  );
}
