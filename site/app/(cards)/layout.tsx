import { Anek_Gujarati } from "next/font/google";

// The Instagram cards' own frame (lib/cards.ts): no header, menu or counters; a browser saves each card as a picture.
// Anek with its width axis, for the slightly narrow, heavy headlines of the chosen look (3 Nov).
const anek = Anek_Gujarati({ subsets: ["gujarati", "latin"], axes: ["wdth"], variable: "--font-card" });

export const metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="gu" className={anek.variable}>
      <body style={{ margin: 0, background: "#e9e4da" }}>{children}</body>
    </html>
  );
}
