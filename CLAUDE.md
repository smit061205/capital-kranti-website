# Capital Kranti website: standing instructions

Read `HANDOFF.md` at the start of a session, and `site/README.md` for how it runs. The Next.js version differs from what
you know: read `site/node_modules/next/dist/docs` before changing Next code (`site/AGENTS.md`).

## Who it's for
- The developer works on a Mac and talks in plain English. Explain what changed and why, briefly.
- The editor is the developer's father: not technical, plain words, Gujarati first.

## Rules
- **No approvals (30 Oct):** news and Aavtikal publish by themselves; what fails the fact check isn't published.
- **Aavtikal covers are real photos**, accurate and good quality; never drawn or AI-looking.
- **Show every cost in rupees (₹)**, converted from USD at display time (₹88 per US$ by default).
- **No Anthropic models for the site's AI** (cost). Free models first; paid Gemma 4 26B on OpenRouter only as a backup when they all fail, at most ₹30 a day (₹1,000 a month, 4 Nov).
- **Don't get around any website's bot blocking.** News comes from PIB and the sources in `site/engine/sources.ts`.
- The repository is **public**. Never commit `.env` files, keys or tokens, and never print or ask for the user's keys.
- **The look is chosen by eye.** Show the user a redesign early. Copying the New York Times was tried and dropped (31 Oct).

## How to work here
- Develop on port 3200. `next dev` and `next build` share `.next`: stop the server before building.
- Run servers with `preview_start`, never from a shell.
- Work on a branch; merge to `main` and push when it's finished and checked: `npx --prefix site tsc -p site/engine`, `node --experimental-strip-types --no-warnings site/engine/selftest.ts`, and `npm run build` in `site/`.
- The engine reads `main` every round, so anything pushed to `main` reaches the running news within about 15 minutes.
- **Vercel's free plan (7 Nov):** each website deploy empties the page cache, and every page made again counts against 200,000 "ISR writes" a month. Merge website changes together, not one by one; engine-only changes skip the deploy (`site/vercel.json` `ignoreCommand`). Never write the time or anything random into a page's HTML.
- `engine/text.ts` was copied from the app on 31 Oct. A fix there doesn't reach the app, or the other way round.
- Commit messages describe the change in plain words.
