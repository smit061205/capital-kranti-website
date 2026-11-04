# Getting Capital Kranti into Google and Bing: what only you can do

The website now tells Google everything it needs on every page (what the story is, when it went up, its photo, its
language versions, and who publishes it). What's left needs your own Google and Microsoft sign-in, so only you can do it.
Nobody needs your passwords for any of this: never send them to anyone, including me.

It takes about 30 minutes. Do the steps in order.

## 1. Google Search Console (the most important)

This tells Google the site is yours and lets you hand it the lists of pages.

1. Open **https://search.google.com/search-console** and sign in with the paper's Google account
   (the one that should own the site for years, e.g. capitalkranti@gmail.com).
2. Click **Add property**. Choose the left box, **Domain**, and type `capitalkranti.co.in` (no `www`, no `https`).
   Click **Continue**.
3. Google shows a line starting with `google-site-verification=`. Click **Copy**.
4. Open the place where the domain's settings live and add that line as a **TXT record**:
   - If the domain's settings are at **Vercel** (vercel.com → your team → **Domains** → `capitalkranti.co.in`):
     **Add record** → Type `TXT`, Name: leave empty (or `@`), Value: paste the line → **Save**.
   - If they are at the company you bought the domain from (GoDaddy, Hostinger, BigRock and so on): find
     **DNS** or **Manage DNS**, add a record of type `TXT`, host `@`, value the copied line, and save.
   - Don't change or delete any other record (they keep the site and email working).
5. Go back to Search Console and click **Verify**. If it says it couldn't find the record, wait 15 minutes and try
   again (it can take up to a day).
6. Once verified, on the left click **Sitemaps**. In "Add a new sitemap" type `sitemap.xml` and click **Submit**.
   Then type `news-sitemap.xml` and click **Submit** again. Both should say **Success** within a day.
7. Check one story: at the top, paste a story's address (for example one from the home page) into
   **Inspect any URL**. Then click **Test live URL**. It should say "URL is available to Google" and, under
   *Enhancements*, show **Breadcrumbs** found. Click **Request indexing** for a few of the day's big stories.

What to look at afterwards (once a week is enough):
- **Pages** (on the left): how many pages are in Google. Pages "Alternate page with proper canonical tag" are fine:
  they are English or Hindi copies not yet translated, which point Google to the Gujarati story on purpose.
- **Performance**: how many people found the site in Google, and with which words.

## 2. Google Publisher Center (to show up as a named source in Google News)

Google News can find the stories by itself once step 1 is done, but this gives the paper its name and logo there.

1. Open **https://publishercenter.google.com** with the **same** Google account as step 1.
2. Click **Add publication**. Name: `Capital Kranti`. Main country: **India**. Click **Add**.
3. In the new publication, open **General**:
   - **Publication website**: `https://www.capitalkranti.co.in`, then click **Verify** (it uses step 1's ownership,
     which is why it has to be the same account).
   - **Publication language**: Gujarati. Add English and Hindi as further languages if it offers them.
   - Add the contact email and the paper's description (one line, e.g. "Gujarati daily from Gandhinagar since 1993").
4. Open **Visual styles** and upload the logo. The site's own logo file is at
   https://www.capitalkranti.co.in/logo.png (save it from there); a square one is
   https://www.capitalkranti.co.in/icon.png.
5. Click **Save**. Google decides by itself when the paper appears in Google News; it may take a few weeks.

## 3. Bing Webmaster Tools (Bing, and the search in Windows and Microsoft Edge)

1. Open **https://www.bing.com/webmasters** and sign in (a Microsoft account, or "Sign in with Google").
2. Choose **Import your sites from Google Search Console**, and allow it. That copies the site, its ownership
   and both sitemaps in one go, so there's nothing to verify again.
3. If it doesn't show both sitemaps, open **Sitemaps** → **Submit sitemap** and add
   `https://www.capitalkranti.co.in/sitemap.xml` and `https://www.capitalkranti.co.in/news-sitemap.xml`.

## What the website already does (no work for you)

- Every story and Aavtikal article carries the data Google News reads (headline, times, photo, language, the paper
  as publisher with its logo), plus "Home › Section › Story" breadcrumbs.
- The Gujarati, English and Hindi copies of a story point to one another, but only once a translation exists.
- The news list for Google (`news-sitemap.xml`) holds only the last two days and is renewed every time a story goes up
  (and at least every ten minutes).
- Readers' own pages (search results, saved stories) and the editor's page are kept out of search engines; everything
  else, photos included, is open to them.

To check a story yourself at any time: **https://search.google.com/test/rich-results**, paste the story's address,
click **Test URL**. It should find "Article" and "Breadcrumbs" with no errors.
