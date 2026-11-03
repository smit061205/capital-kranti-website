import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // site/ has its own installs and lockfile, apart from the repository's
  // workspaces (the desktop app's), so it is its own root.
  turbopack: {
    root: __dirname,
  },
  // two root layouts (Gujarati, English): a web address matching neither gets app/global-not-found.tsx
  // the service worker is always fetched fresh, so a new release reaches every phone
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] }];
  },
  // the e-paper left the website (31 Oct): its old addresses go to the past issues
  // the site's own address (2 Nov): a page opened at the old Vercel address goes to the same page on www.capitalkranti.co.in
  // (not the API: the engine's calls and Telegram's messages may still come there)
  async redirects() {
    return [
      ...["", "/en", "/hi"].flatMap((l) => [
        { source: `${l}/epaper`, destination: `${l}/archive`, permanent: false },
        { source: `${l}/epaper/:date`, destination: `${l}/archive/:date`, permanent: false },
      ]),
      // the short addresses on the Instagram cards' last card (lib/cards.ts), easy to type from a phone
      ...["gujarat", "india", "world"].map((k) => ({ source: `/${k}`, destination: `/section/${k}`, permanent: false })),
      { source: "/:path((?!api/).*)", has: [{ type: "host" as const, value: "capital-kranti.vercel.app" }], destination: "https://www.capitalkranti.co.in/:path", permanent: true },
    ];
  },
  experimental: {
    globalNotFound: true,
  },
};

export default nextConfig;
