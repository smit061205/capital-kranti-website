# Capital Kranti website: handoff

The paper's website and its Aavtikal section, with their own news engine. Split from the newsroom app's repository
(`smit061205/Newsletter`) on 31 Oct 2026, with this history. Notes below that mention the app's folders, `site-guard` or
`NewsPaper_Site` date from before the split.

## Where it stands

### Where it stands now (30 Oct; read this first, then the older notes below)

*Written for a new Claude Code session or account taking over. Where this block and the
older notes below disagree, this block is right.*

- **Live:** https://capital-kranti.vercel.app. Vercel deploys `main`. The site's status, with
  the engine's and the Aavtikal desk's latest logs, is public at `/api/status`.
- **Working copy:** the website is worked on in its own clone, `/Users/smitthakkar/NewsPaper_Site`,
  on a branch (`site/phase-b` until now; start a new one for new work). The app's folder
  `/Users/smitthakkar/NewsPaper_Project` is for the app. Merge pattern, after the checks:
  `git fetch -q && git checkout -q --detach origin/main && git merge -q --no-ff <branch> -m "Merge: …" && git push -q origin HEAD:main && git checkout -q <branch>`.
- **Checks before every merge:** `npx --prefix site tsc -p site --noEmit`,
  `npx --prefix site tsc -p site/engine --noEmit`,
  `node --experimental-strip-types --no-warnings site/engine/selftest.ts` (18 checks), and
  `(cd site && env -u CK_SAMPLE npm run -s build)`.
- **Seeing it locally:** the preview "flagship-dev" (port 3200, `CK_SAMPLE=1`, in
  `NewsPaper_Project/.claude/launch.json`). In sample mode the editor page signs in by itself.
  When the app's browser pane is hidden, pages don't finish loading there: check with headless
  Playwright instead (`createRequire` on `site/package.json`; the Chromium in
  `~/Library/Caches/ms-playwright`). `CK_SAMPLE_BREAKING=1` shows the breaking-news bar.
- **Roadmap Phase B is built** (30 Oct; `docs/website/ROADMAP.md` §6): Hindi, the editor's
  page, tier × genre pages, the "from other outlets" row, breaking news (bar plus opt-in
  alerts, `site/lib/push.ts`), and the leaders' birthdays (`site/lib/leaders.ts`). **What's
  left of Phase B is its review:** a day of real running, every story checked, ₹0 spent.
- **The news engine** (`site/engine/run.ts`, `site-engine.yml`): each run queues the next
  (GitHub's own schedule was unreliable), with an hourly schedule as a backstop.
- **Aavtikal's desk** (`site/engine/desk.ts`, `site-desk.yml`, 45-minute rounds that queue the
  next): writes **15 explainers a day** on AI, Tech and Science (never Politics on its own;
  never touches the editor's own articles). Gemini Flash writes on Google's free tier; Gemini
  Flash Lite looks at every picture before it is used (`site/engine/cover.ts`). **Covers are
  real pictures only (the user, 30 Oct, replacing the drawn covers of that morning):** nothing
  drawn, nothing AI-looking. If the first pictures have none, Commons and NASA are searched
  wider; a new subject with no real picture is set aside; a published article with none comes
  off the site (held) and returns by itself once one is found. On 30 Oct the re-check of every old
  article used up Flash's free allowance by 6:27 AM IST; it resets about 1:30 PM IST.
- **No approvals (the user, 30 Oct):** news and Aavtikal go up by themselves, sensitive stories
  too. What fails its checks doesn't go up at all; a story a source corrects comes down to the
  removed list. Telegram only sends notes. The readers' pages say so (`views/Policy.tsx`, `lib/flagship.ts`).
- **Speed (30 Oct):** the site runs in Singapore (`site/vercel.json`, beside the database;
  `/api/status` shows `speed`). No font is loaded ahead, and the wide name and Aavtikal's condensed
  headlines are small files of our own (`site/app/fonts/`). Pictures come at the size shown
  (`site/lib/photo.ts`). Links fetch nothing ahead (`prefetch={false}`, keep it on new links).
  Each language has its own root layout, so changing language is a full page load:
  `components/LangLink.tsx` is a plain link and fetches the page on touch, and `proxy.ts` lets that through.
- **The editor's page** (`/editor`, Google sign-in for the addresses in Vercel's
  `CK_EDITORS`): change or take down any story or article,
  write their own news or Aavtikal article with photos, the engine's stop switch, the day's
  use, and the leaders list with birthday greetings and Gujarati email drafts. **The site
  never sends an email**; the editor sends it from their own Gmail.

**Next (30 Oct):**
1. Phase B's review (above): read the next days' stories and the desk's logs; fix what they show.
2. **The domain:** the user will say where `capitalkranti.co.in` (or their chosen name) is
   registered and whether it carries email. Then point it at Vercel and change the site's
   own address everywhere it is written: `site/lib/config.ts` (`WEBSITE.url`),
   `site-seed.yml` and `site-features.yml` (their `curl`), `site/pipeline/seed.ts`,
   `site/pipeline/features.ts`, the user agent in `site/engine/wikiphoto.ts` and
   `site/lib/leaders.ts`, `site/README.md` and this file; set `SITE_URL`; send
   `capital-kranti.vercel.app` there.
3. Small: the editor may fix the typo "૧૯૬ ૮" in
   one article. The Hindi backfill of old stories continues on its own.
4. The editor fills in the leaders list (it starts empty).
5. **Only when the user says:** Phase C, the social media desk.


*(Rewritten 26 Oct, evening, when the website moved from a cloud session to a local one.
Everything below is on `main`, at or after commit `f0bb961`.)*

The user wants a live website as the heart of the paper. It has its own news engine, and
later a social media desk. It is live at https://capital-kranti.vercel.app.

**The user's rules for website work (25–26 Oct):**
- Touch only `site/`, `.github/workflows/site*.yml` and `docs/website/`, plus these notes
  (`CLAUDE.md`, `HANDOFF.md`).
- Never change the app's code, and never tag an app release for website work. The site may
  *import* `backend/src/ingest/pib.ts` and `backend/src/editorial/rewrite.ts` read-only.
- **Open Claude Code in `site/`.** There a hook (`site/.claude/`) refuses edits outside the
  allowed paths, and `site-guard.yml` fails any website branch that touches the app. The
  local app session and the website session must not share a working copy: use a separate
  clone or `git worktree add ../Newsletter-site main`.
- Free AI only (₹0): Gemma models. Never Anthropic models; never paid ones.
- Don't get around any site's bot blocking. Never commit keys. Costs are shown in ₹.
- Inspiration, not imports: take ideas from WPDS, the Guardian and the BBC, never their
  components (`docs/website/UIUX.md`).
- When a round is finished and checked, merge it to `main` and push. That's how it has been
  done: `git merge --no-ff` from the work branch, after the `site` workflow passes. Vercel
  deploys `main`.

**Read first:** `site/README.md` (the manual: running it, the engine, the workflows and
keys), `docs/website/ROADMAP.md` (the plan; §0.1 the engine's purpose, §3.1 the
verification loop), `docs/website/UIUX.md` (the UI choices and where each lives), and
`docs/website/DESIGN.md`.

**Where it stands (26 Oct, evening):**
- **The news engine runs every 15 minutes** (`site-engine.yml`, started 26 Oct after the
  user approved two dry-run stories).
  - It reads 122 sources politely and triages them in batches of 12. It groups reports of
    the same event, then gates each one: fresh, not debunked, official or confirmed by two
    independent outlets, and a 6-hour wait.
  - It ranks by importance. Gemma writes in Gujarati, every number and claim is checked, and
    national and world news gets English and Hindi.
  - It publishes confirmed, non-sensitive stories itself and holds the rest for Telegram.
  - Code: `site/engine/`. AI calls: `site/engine/ai.ts`.
- **AI:**
  - The user's Google AI Studio key (`GOOGLE_AI_KEY`, Gemma 4 free tier) comes first.
    gemma-4-26b-a4b-it writes, with `thinkingLevel: "minimal"` (7 s rather than 100 s);
    gemma-4-31b-it checks.
  - OpenRouter's free Gemmas are the fallback, but they are usually "rate-limited upstream".
  - Google sometimes answers 500/503 ("high demand"). A story that fails is retried on the
    next run.
  - Models and limits: `site/lib/config.ts`.
- **The first real run** (26 Oct, 11:40 UTC) went cleanly. 68 of 122 sources answered and
  there was nothing new yet; 15 sources refuse programs and are left off. **The first
  scheduled hour has not been checked yet: do that first.** Read the latest `site-engine`
  runs' logs (GitHub, Actions): items collected, triaged, written, published or held.
- **Telegram approvals are off** until the user adds the secrets `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_CHAT_IDS`. Until then, held stories wait in the database (`status = 'held'`).
  With only the token set, the bot answers `/start` with that chat's number (29 Oct; it
  answered nothing before), the number `TELEGRAM_CHAT_IDS` needs. It answers within
  seconds while the engine runs (`engine/listen.ts`), so the engine must be running.
- **Dry runs** (store nothing): `site-engine-try.yml`, with input `stories` and an optional
  `probe`.
- **The site:**
  - Pages: home, story, sections, latest, search, e-paper, past issues, saved, policy pages.
    Gujarati at `/`, English at `/en`, Hindi at `/hi`.
  - Design: Washington Post-style tokens and motion (loading bar, reading bar, skeletons,
    page transitions). The lead is sized by importance (the Guardian's boost levels: 7.5,
    9.5, 11). Sections are a wide row or small boxes three to a row, and a story shows once
    per page.
  - Story pages: a byline block, the photo full screen, read-also and related stories.
  - Also: an e-paper reader, instant search, and a BBC-style focus ring.
  - **New on 26 Oct:** most read (`reads` table; `/api/read`, one count per browser), an
    installable app with offline reading (`app/manifest.ts`, `public/sw.js`, production
    only), and "more on this" (stories sharing three engine key words).
  - Rules: lines and header icons line up with the page's edges. A row shows photos only
    when all its cards have one. An older printed paper is called "the latest", never
    "today's".
- **Checks:**
  - `site.yml` builds the site and runs `site/test/a11y.mjs` (axe, WCAG 2 AA, phone and
    desktop, light and dark; a serious problem fails it).
  - The engine has `npx --prefix site tsc -p site/engine` and
    `node --experimental-strip-types site/engine/selftest.ts`.
- **To work on the site:** run `CK_SAMPLE=1 npm run dev --prefix site`. It opens on
  http://localhost:3200 with 22 Oct's sample stories and needs no keys. Check layout at
  390, 800, 1440 and 2000 px wide; the user's screen is about 2000 px.

**Aavtikal (આવતીકાલ), the flagship section (28-29 Oct):** long articles on AI, tech, science
and politics at `/aavtikal` (and `/en/aavtikal`, `/hi/aavtikal`), linked from the daily site's
sections row, menu and footer. Look modelled on Pirate Wires, measured in
`docs/website/FLAGSHIP.md`; the beat's name sits on the plain page, never on a colour block
(the user, 28 Oct). Its own table `features`, so the daily queries never meet it. Code:
`site/lib/flagship.ts`, `site/components/flagship/`, `site/views/Flagship.tsx`. Articles are
published from `site/pipeline/features/<date>.json` by `site-features.yml` (photos copied
into the site's store, credited in captions); 11 explainers went live on 28 Oct, all by the
AI desk. Next for it: the editor page (shared with the daily site's), then an engine that
drafts features and always holds them for the editor; Hindi translations; the WhatsApp channel.

**The engine's schedule (checked 29 Oct):** GitHub starts `site-engine.yml` only every 4 to 6
hours, not every 15 minutes (11 runs from 26 to 28 Oct), so few stories reach the site. It
needs an outside timer calling the workflow's dispatch API (the user's to set up: a token).

**Next (the user's list, in order):**
1. Check the engine's first scheduled hours and show the user the first stories that went
   live. Fix what the logs show (only in `site/`).
2. The user adds the Telegram secrets; then test an approval end to end.
3. Keep polishing the UI from the user's screenshots. They care about alignment, a
   professional feel, motion and the reading experience. They compare the site to the
   Washington Post.
4. Later: the editor page on the site (Google sign-in); leaders' birthdays (an edited image
   and a draft email, **never sent**; ROADMAP §3.3); point `capitalkranti.co.in` at Vercel,
   then set `SITE_URL` so search engines may index it.
5. **Much later, only when the user says:** the social media desk (X, Instagram, Facebook,
   YouTube Shorts). The user explicitly put it after the website and the content pipeline.
