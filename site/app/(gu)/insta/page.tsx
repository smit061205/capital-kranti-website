// The Instagram profile's link (lib/insta.ts): Instagram's words can't hold a link to tap, so each post says "the link
// in the profile", which opens this page: the latest post of each section, its stories in the cards' order, each a tap
// away. Renewed when a set goes up (editor/actions.ts).
import Link from "next/link";
import Frame from "@/components/Frame.tsx";
import { db } from "@/lib/db.ts";
import { num } from "@/lib/format.ts";
import { editionName, photoOfCard, recentSets, type InstaSet } from "@/lib/insta.ts";
import { pageMeta } from "@/lib/meta.ts";
import { pic } from "@/lib/photo.ts";
import { sectionName, TIERS } from "@/lib/sections.ts";

export const revalidate = 600;
export const metadata = pageMeta({ lang: "gu", path: "/insta", title: "ઇન્સ્ટાગ્રામના સમાચાર" });

export default async function Page() {
  const sql = db();
  const sets = sql ? await recentSets(sql, 30) : [];
  const latest = TIERS.map((t) => sets.find((s) => s.tier === t && s.state === "posted")).filter((s): s is InstaSet => !!s);
  return (
    <Frame lang="gu" path="/">
      <div className="sechead"><h1>ઇન્સ્ટાગ્રામના સમાચાર</h1></div>
      <p className="note" style={{ margin: "0 0 8px" }}>કેપિટલ ક્રાંતિના ઇન્સ્ટાગ્રામ પરના છેલ્લા કાર્ડના સમાચાર, એ જ ક્રમમાં: નંબર જોઈને સમાચાર પર ટૅપ કરો.</p>
      {latest.length ? latest.map((set) => (
        <section key={set.id} className="insta">
          <h2 className="h3"><Link prefetch={false} href={`/section/${set.tier}`}>{sectionName(set.tier, "gu")}</Link> <small>{editionName(set.edition)}</small></h2>
          <ol>
            {set.cards.map((c, i) => (
              <li key={c.storyId}>
                <Link prefetch={false} className="h" href={`/news/${encodeURIComponent(c.storyId)}`}>
                  <span className="n">{num(i + 1, "gu")}</span>
                  <img {...pic(photoOfCard(c), "96px")} width={96} height={120} alt="" loading="lazy" decoding="async" />
                  <span className="h4">{c.headline}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )) : <p className="empty">ઇન્સ્ટાગ્રામ પર હજી કંઈ મુકાયું નથી. <Link prefetch={false} href="/latest">તાજા સમાચાર જુઓ</Link></p>}
    </Frame>
  );
}
