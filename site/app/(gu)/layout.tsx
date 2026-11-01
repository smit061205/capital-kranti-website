import { Anek_Gujarati, Hind_Vadodara, Noto_Serif_Gujarati } from "next/font/google";
import { PREPAINT } from "@/components/Frame.tsx";
import "@/app/globals.css";

// Hind Vadodara for headlines and the interface; the news is read in our own one-weight cut of Noto Serif ("CK Read", globals.css). Anek and the
// all-weights Noto Serif are Aavtikal's alone (2 Nov: fonts were 58% of a page, those two files 271 KB of it). A page fetches only what it uses.
// None is loaded ahead (the user, 30 Oct: every page was sent all 22 font files, 2.1 MB, the Hindi ones too): a browser fetches
// only those a page uses. The light Anek has no width axis; the wide name and Aavtikal's condensed headlines are small files of our own (globals.css).
const ui = Anek_Gujarati({ subsets: ["gujarati", "latin"], variable: "--font-ui", preload: false });
const serif = Noto_Serif_Gujarati({ subsets: ["gujarati", "latin"], variable: "--font-serif", preload: false });
// headlines (29 Oct): Hind Vadodara, upright and strong like a printed paper's
const head = Hind_Vadodara({ subsets: ["gujarati", "latin"], weight: ["400", "600", "700"], variable: "--font-head", preload: false });

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="gu" data-scroll-behavior="smooth" className={`${ui.variable} ${serif.variable} ${head.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: PREPAINT }} /></head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
