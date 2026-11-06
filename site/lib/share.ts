// The picture a story without a photo shows when it's shared (WhatsApp, Facebook, X): its headline on the paper's own
// card, 1200×630, made by a real browser in the Instagram runner (engine/share.ts) since Next's own picture maker puts
// Gujarati's letters in the wrong order (5 Nov: "વિકાસ" came out "વકિાસ"). Before 5 Nov every such story shared the
// site's one picture. 6 Nov, the user chose "the frame" of ten looks: the paper's name on a purple frame, everything
// centred, the story's line under its headline; the headline is made smaller until it all fits, never cut off.
import { dateText } from "./format.ts";
import { sectionName } from "./sections.ts";
import type { Tier } from "./types.ts";

export interface ShareCard { id: string; tier: Tier; kicker: string; headline: string; deck: string; publishedAt: string }
/** in the name of each picture of this look; a story whose picture's name lacks it has an older look (engine/share.ts) */
export const SHARE_LOOK = "frame";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const CSS = `
body{margin:0;background:#e9e4da}
.set{display:flex;flex-direction:column;gap:32px;padding:32px;font-family:'Anek Gujarati',sans-serif}
.c{position:relative;width:1200px;height:630px;overflow:hidden;background:#fbf8f2;color:#141118;flex:none;box-sizing:border-box;
   padding:92px 110px 62px;display:flex;flex-direction:column;align-items:center;text-align:center}
.c>*{flex:none}
.c::before{content:"";position:absolute;inset:44px 24px 24px;border:6px solid #7f3894;border-radius:10px}
.top{position:absolute;top:47px;left:50%;transform:translate(-50%,-50%);background:#fbf8f2;padding:6px 28px;display:flex;align-items:center}
.logo{font-family:'CK Mark','Anek Gujarati',sans-serif;font-weight:800;font-size:42px;color:#7f3894;line-height:1.25;white-space:nowrap}
.kick{color:#7f3894;font-size:30px;font-weight:700;margin:auto 0 10px}
.hl{font-family:'CK Cond','Anek Gujarati',sans-serif;font-weight:800;font-size:82px;line-height:1.14;text-wrap:balance}
.deck{color:#5b5560;font-size:29px;line-height:1.35;margin-top:14px;text-wrap:balance;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.bottom{margin-top:auto;padding-top:24px;color:#6b6470;font-size:25px}
.bottom b{color:#141118;font-weight:700}`;

/** Run in the page once its fonts are in: each headline made smaller until its card holds everything inside the frame
 *  (and if even the smallest doesn't, the line under it goes), so no word is ever cut off. */
export const FIT = `for (const c of document.querySelectorAll('.c')) {
  const hl = c.querySelector('.hl');
  const over = () => [...c.children].some((e) => e.getBoundingClientRect().bottom > c.getBoundingClientRect().bottom - parseFloat(getComputedStyle(c).paddingBottom) + 1);
  let px = parseFloat(getComputedStyle(hl).fontSize);
  while (over() && px > 52) { px -= 2; hl.style.fontSize = px + 'px'; }
  if (over()) c.querySelector('.deck')?.remove();
}`;

/** The cards' page, one 1200×630 card for each story; `fonts`: the paper's own fonts (CK Mark, CK Cond) as @font-face
 *  rules, which engine/share.ts reads from app/fonts. */
export function shareHtml(cards: ShareCard[], fonts = ""): string {
  const one = (c: ShareCard) => `<section data-share="${esc(c.id)}" class="c">
    <div class="top"><span class="logo">કેપિટલ ક્રાંતિ</span></div>
    <div class="kick">${esc([sectionName(c.tier, "gu"), c.kicker].filter(Boolean).join(" · "))}</div><div class="hl">${esc(c.headline)}</div>
    ${c.deck ? `<div class="deck">${esc(c.deck)}</div>` : ""}<div class="bottom">${esc(dateText(c.publishedAt, "gu"))} · <b>capitalkranti.co.in</b></div></section>`;
  return `<!doctype html><html lang="gu"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anek+Gujarati:wdth,wght@75..125,100..800&display=block">
<style>${fonts}${CSS}</style></head><body><main class="set">${cards.map(one).join("\n")}</main></body></html>`;
}
