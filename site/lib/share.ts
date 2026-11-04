// The picture a story without a photo shows when it's shared (WhatsApp, Facebook, X): its headline on the paper's own
// card, 1200×630, made by a real browser in the Instagram runner (engine/share.ts) since Next's own picture maker puts
// Gujarati's letters in the wrong order (5 Nov: "વિકાસ" came out "વકિાસ"). Before 5 Nov every such story shared the
// site's one picture.
import { dateText } from "./format.ts";
import { sectionName } from "./sections.ts";
import type { Tier } from "./types.ts";

export interface ShareCard { id: string; tier: Tier; kicker: string; headline: string; publishedAt: string }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
// a headline's size by its length, so the longest still fits in three lines
const size = (h: string) => (h.length > 110 ? " longer" : h.length > 75 ? " long" : "");

const CSS = `
body{margin:0;background:#e9e4da}
.set{display:flex;flex-direction:column;gap:32px;padding:32px;font-family:'Anek Gujarati',sans-serif}
.c{position:relative;width:1200px;height:630px;overflow:hidden;background:#fbf8f2;color:#141118;flex:none;box-sizing:border-box;
   padding:52px 72px 44px 88px;display:flex;flex-direction:column}
.c::before{content:"";position:absolute;left:0;top:0;bottom:0;width:18px;background:#7f3894}
.top{display:flex;align-items:center;gap:22px}
.logo{font-size:46px;font-weight:800;font-stretch:80%;color:#7f3894;line-height:1}
.tag{font-size:28px;font-weight:700;color:#fff;background:#7f3894;padding:6px 20px 2px;border-radius:6px}
.kick{margin-top:auto;font-size:30px;font-weight:600;color:#7f3894;margin-bottom:10px}
.hl{font-size:72px;font-weight:750;font-stretch:90%;line-height:1.18;text-wrap:balance;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.kick+.hl{margin-top:0}.top+.hl{margin-top:auto}
.long{font-size:62px}.longer{font-size:54px}
.foot{margin-top:40px;padding-top:26px;border-top:2px solid #e3dccf;display:flex;justify-content:space-between;font-size:28px;color:#6b6470}
.foot b{color:#141118;font-weight:700}`;

/** The cards' page, one 1200×630 card for each story. */
export function shareHtml(cards: ShareCard[]): string {
  const one = (c: ShareCard) => `<section data-share="${esc(c.id)}" class="c">
    <div class="top"><span class="logo">કેપિટલ ક્રાંતિ</span><span class="tag">${esc(sectionName(c.tier, "gu"))}</span></div>
    ${c.kicker ? `<div class="kick">${esc(c.kicker)}</div>` : ""}<div class="hl${size(c.headline)}">${esc(c.headline)}</div>
    <div class="foot"><span>${esc(dateText(c.publishedAt, "gu"))}</span><b>capitalkranti.co.in</b></div></section>`;
  return `<!doctype html><html lang="gu"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anek+Gujarati:wdth,wght@75..125,100..800&display=block">
<style>${CSS}</style></head><body><main class="set">${cards.map(one).join("\n")}</main></body></html>`;
}
