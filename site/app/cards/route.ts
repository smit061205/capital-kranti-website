// The Instagram cards' test page (lib/insta.ts), to choose a look by eye: a section's whole set in each of the looks,
// switched with the buttons or the arrow keys. Only to look at; not linked from the site.
import { LOOK, LOOKS } from "@/lib/insta.ts";

export const dynamic = "force-dynamic";

export function GET() {
  const looks = LOOKS.map((l, i) => `<button data-look="${i}"><b>${i}</b> ${l.name}</button>`).join("");
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Instagram cards</title><style>
:root{color-scheme:light;--ink:#1b1720;--muted:#6b6470;--line:#d9d2c6;--brand:#7f3894;--bg:#f4f0e8}
*{box-sizing:border-box}body{margin:0;font:15px/1.4 system-ui,sans-serif;color:var(--ink);background:var(--bg)}
header{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid var(--line);padding:12px 16px;display:flex;flex-direction:column;gap:10px}
h1{margin:0;font-size:18px}h1 small{font-weight:400;color:var(--muted)}
.row{display:flex;gap:6px;align-items:center;overflow-x:auto;scrollbar-width:none;white-space:nowrap}button{flex:none}.row>span{color:var(--muted);margin-right:4px;min-width:64px}
button{font:inherit;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:999px;padding:6px 12px;cursor:pointer}
button b{color:var(--brand);margin-right:2px}button[aria-pressed=true]{background:var(--brand);border-color:var(--brand);color:#fff}button[aria-pressed=true] b{color:#fff}
main{padding:16px}iframe{display:block;border:0;width:100%;background:#e9e4da;border-radius:10px}
.nav{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}.nav strong{font-size:17px}
</style></head><body>
<header><h1>Instagram cards <small>pick a look; ← → to step through them</small></h1>
<div class="row" id="tiers"><span>Section</span><button data-tier="gujarat">Gujarat</button><button data-tier="india">India</button><button data-tier="world">World</button></div>
<div class="row" id="looks"><span>Look</span>${looks}</div>
<div class="row" id="sizes"><span>Size</span><button data-size="small">Whole set</button><button data-size="full">Full size</button></div></header>
<main><div class="nav"><button id="prev">← Previous</button><strong id="name"></strong><button id="next">Next →</button><a id="open" target="_blank" rel="noopener">open on its own</a></div>
<iframe id="f" title="cards"></iframe></main>
<script>
const names=${JSON.stringify(LOOKS.map((l) => l.name))};
const st={tier:"gujarat",look:${LOOK},size:"small"};
try{Object.assign(st,JSON.parse(localStorage.getItem("ck-cards")||"{}"))}catch{}
const f=document.getElementById("f");
function show(){
  try{localStorage.setItem("ck-cards",JSON.stringify(st))}catch{}
  for(const b of document.querySelectorAll("[data-tier]"))b.setAttribute("aria-pressed",b.dataset.tier===st.tier);
  for(const b of document.querySelectorAll("[data-look]"))b.setAttribute("aria-pressed",+b.dataset.look===st.look);
  for(const b of document.querySelectorAll("[data-size]"))b.setAttribute("aria-pressed",b.dataset.size===st.size);
  const u="/cards/"+st.tier+"?look="+st.look+(st.size==="small"?"&small":"");
  document.getElementById("name").textContent=st.look+" · "+names[st.look];
  document.getElementById("open").href=u;
  f.src=u;
}
f.addEventListener("load",()=>{try{const d=f.contentDocument;f.style.height=(d.documentElement.scrollHeight*(st.size==="small"?1:1)+20)+"px"}catch{}});
document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  if(b.dataset.tier)st.tier=b.dataset.tier;else if(b.dataset.look)st.look=+b.dataset.look;else if(b.dataset.size)st.size=b.dataset.size;
  else if(b.id==="prev")st.look=(st.look+names.length-1)%names.length;else if(b.id==="next")st.look=(st.look+1)%names.length;else return;show()});
document.addEventListener("keydown",e=>{if(e.key==="ArrowRight")st.look=(st.look+1)%names.length;else if(e.key==="ArrowLeft")st.look=(st.look+names.length-1)%names.length;else return;show()});
show();
</script></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
}
