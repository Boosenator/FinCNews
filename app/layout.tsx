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

export const metadata: Metadata = {
  title: {
    default: "FinCNews — Finance & Crypto Intelligence",
    template: "%s | FinCNews",
  },
  description:
    "Fast AI-powered finance news: crypto, markets, macro and fintech. Breaking stories in English, Ukrainian, Russian and Polish.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "https://fincnews.com"),
  openGraph: {
    siteName: "FinCNews",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@fincnews",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
