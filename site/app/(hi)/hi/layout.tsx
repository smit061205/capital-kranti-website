import { Anek_Devanagari, Anek_Gujarati, Hind, Hind_Vadodara, Noto_Serif_Devanagari, Noto_Serif_Gujarati } from "next/font/google";
import { PREPAINT } from "@/components/Frame.tsx";
import "@/app/globals.css";

// Hind and Hind Vadodara for headlines and the interface, with Gujarati behind Devanagari (a story not yet in Hindi is shown in Gujarati): globals.css,
// html[lang="hi"]. The news is read in our own one-weight cut of Noto Serif ("CK Read"); Anek and the all-weights Noto Serif are Aavtikal's alone (2 Nov).
// None is loaded ahead (the user, 30 Oct: every page was sent all 22 font files, 2.1 MB, the Hindi ones too): a browser fetches
// only those a page uses. The light Anek has no width axis; the wide name and Aavtikal's condensed headlines are small files of our own (globals.css).
const uiHi = Anek_Devanagari({ subsets: ["devanagari", "latin"], variable: "--font-ui-hi", preload: false });
const serifHi = Noto_Serif_Devanagari({ subsets: ["devanagari", "latin"], variable: "--font-serif-hi", preload: false });
const ui = Anek_Gujarati({ subsets: ["gujarati", "latin"], variable: "--font-ui", preload: false });
const serif = Noto_Serif_Gujarati({ subsets: ["gujarati", "latin"], variable: "--font-serif", preload: false });
// headlines (29 Oct): Hind, the Devanagari of Hind Vadodara
const headHi = Hind({ subsets: ["devanagari", "latin"], weight: ["400", "600", "700"], variable: "--font-head-hi", preload: false });
const head = Hind_Vadodara({ subsets: ["gujarati", "latin"], weight: ["400", "600", "700"], variable: "--font-head", preload: false });

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hi" data-scroll-behavior="smooth" className={`${uiHi.variable} ${serifHi.variable} ${ui.variable} ${serif.variable} ${headHi.variable} ${head.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: PREPAINT }} /></head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
