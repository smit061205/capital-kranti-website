// One section's Instagram cards, at their real size (1080×1350), one under another: a browser saves each `[data-card]`
// as a picture. `?small` shows them at a third, to look at.
import { notFound } from "next/navigation";
import { cardSet, type CardPhoto } from "@/lib/cards.ts";
import { dateText, num } from "@/lib/format.ts";
import { TIERS, sectionName } from "@/lib/sections.ts";
import type { Tier } from "@/lib/types.ts";
import s from "../cards.module.css";

export const dynamic = "force-dynamic";

/** The photo across the card's width from the top at its own shape; a blurred copy fills below a wide one. */
function Picture({ p, cover }: { p: CardPhoto; cover?: boolean }) {
  if (cover) return <img className={`${s.pic} ${s.cover}`} src={p.url} alt="" />;
  const wide = (1080 * p.height) / p.width < 1350;
  return (
    <>
      {wide && <div className={s.fill} style={{ backgroundImage: `url("${p.url}")` }} />}
      <img className={s.pic} src={p.url} alt="" />
    </>
  );
}

// a headline's size by its length, so a long one stays in the card's lower half
const size = (h: string) => (h.length > 95 ? s.longer : h.length > 70 ? s.long : "");

export default async function Page({ params, searchParams }: { params: Promise<{ tier: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const tier = (await params).tier as Tier;
  if (!TIERS.includes(tier)) notFound();
  const small = "small" in (await searchParams);
  const set = await cardSet(tier);
  if (!set) return <p className={s.none}>{sectionName(tier, "gu")}: not enough stories with a good photo in the last 12 hours for a set.</p>;
  const total = set.stories.length + 1;
  const date = dateText(set.at, "gu");
  const top = (i: number) => <div className={s.top}><span className={s.logo}>કેપિટલ ક્રાંતિ</span><span className={s.n}>{num(i, "gu")}/{num(total, "gu")}</span></div>;
  return (
    <main className={`${s.set}${small ? ` ${s.small}` : ""}`}>
      {set.stories.map((c, i) => (
        <section key={c.id} data-card={i + 1} data-story={c.id} className={`${s.c}${(1080 * c.photo.height) / c.photo.width < 1350 ? ` ${s.wide}` : ""}`}>
          <Picture p={c.photo} />
          {top(i + 1)}
          <div className={s.body}>
            <span className={s.tag}>{sectionName(tier, "gu")}</span>
            <div className={`${s.hl} ${size(c.headline)}`}>{c.headline}</div>
            <div className={s.foot}>
              <span>{date}</span>
              <span>{c.photo.credit ? `ફોટો: ${c.photo.representative ? "ફાઇલ · " : ""}${c.photo.credit}` : "capitalkranti.co.in"}</span>
            </div>
          </div>
        </section>
      ))}
      <section data-card={total} className={s.c}>
        <Picture p={set.end} cover />
        {top(total)}
        <div className={s.body}>
          <span className={s.tag}>{sectionName(tier, "gu")}</span>
          <div className={s.endt}>{set.end.title}</div>
          <div className={s.endu}>{set.end.short}</div>
          <div className={s.endn}>લિંક પ્રોફાઇલમાં ↑</div>
          <div className={s.foot}><span /><span>ફોટો: {set.end.credit}</span></div>
        </div>
      </section>
    </main>
  );
}
