import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import localFont from "next/font/local";
import { site } from "@/lib/site";
import { SPLASH_GATE } from "@/components/brand/splash-gate";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

/*
 * Numbers font. Cormorant's old-style figures (uneven heights) read badly in
 * prices, so Inter takes over for number characters only: each face below
 * covers just digits / ₹ / number punctuation (unicode-range), and it sits first
 * in both font stacks, so letters still fall through to Cormorant / Montserrat.
 * Serif copies are scaled down to sit with Cormorant's smaller letters.
 */
// next/font needs literal options: digits 0-9 % + , . / → "U+0030-0039, U+0025, U+002B, U+002C, U+002E, U+002F";
// ₹ is "U+20B9" (only in Inter's latin-ext file).

const interNum = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-num",
  display: "swap",
  adjustFontFallback: false, // its auto fallback face would cover ALL characters
  declarations: [{ prop: "unicode-range", value: "U+0030-0039, U+0025, U+002B, U+002C, U+002E, U+002F" }],
});
const interRupee = localFont({
  src: "./fonts/inter-latin-ext.woff2",
  weight: "100 900",
  variable: "--font-num-rupee",
  display: "swap",
  adjustFontFallback: false, // its auto fallback face would cover ALL characters
  declarations: [{ prop: "unicode-range", value: "U+20B9" }],
});
const interNumSerif = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-num-serif",
  display: "swap",
  adjustFontFallback: false, // its auto fallback face would cover ALL characters
  declarations: [
    { prop: "unicode-range", value: "U+0030-0039, U+0025, U+002B, U+002C, U+002E, U+002F" },
    { prop: "size-adjust", value: "86%" },
  ],
});
const interRupeeSerif = localFont({
  src: "./fonts/inter-latin-ext.woff2",
  weight: "100 900",
  variable: "--font-num-rupee-serif",
  display: "swap",
  adjustFontFallback: false, // its auto fallback face would cover ALL characters
  declarations: [
    { prop: "unicode-range", value: "U+20B9" },
    { prop: "size-adjust", value: "86%" },
  ],
});

export const metadata: Metadata = {
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  icons: {
    icon: "/brand/icon-192.png",
    apple: "/brand/icon-512.png",
  },
  appleWebApp: { capable: true, title: site.name, statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${montserrat.variable} ${interNum.variable} ${interRupee.variable} ${interNumSerif.variable} ${interRupeeSerif.variable} antialiased`}
    >
      <head>
        {/* Must run before the first paint: decides whether the brand splash shows (components/brand/brand-splash.tsx). */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_GATE }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
