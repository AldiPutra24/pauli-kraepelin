import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible Next: drawn for legibility, with clearly distinct
// digits (1/7, 3/8, 6/9/0), which is the whole job of a timed number test.
const body = Atkinson_Hyperlegible_Next({
  variable: "--font-body",
  subsets: ["latin"],
  // Next has no metric overrides for this family yet, so no generated fallback.
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

// Source Serif 4 for headings: the voice of a printed test booklet.
const heading = Source_Serif_4({
  variable: "--font-heading",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Latihan Pauli & Kraepelin",
    template: "%s · Latihan Pauli & Kraepelin",
  },
  description:
    "Latihan Tes Pauli dan Tes Kraepelin berwaktu di browser, tanpa akun. Hasil berupa statistik latihan mentah.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ec" },
    { media: "(prefers-color-scheme: dark)", color: "#151513" },
  ],
};

// Applies the saved or system theme before first paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      data-theme="light"
      suppressHydrationWarning
      className={`${body.variable} ${heading.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
