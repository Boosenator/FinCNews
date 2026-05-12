import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fincnews.com";

export const metadata: Metadata = {
  title: {
    default: "FinCNews — Finance & Crypto Intelligence",
    template: "%s | FinCNews",
  },
  description:
    "Fast AI-powered finance news. Bitcoin, Ethereum, markets, macro and fintech — breaking stories as they happen.",
  metadataBase: new URL(BASE_URL),
  openGraph: { siteName: "FinCNews", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image", site: "@fincnews", creator: "@fincnews" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-950 text-zinc-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
