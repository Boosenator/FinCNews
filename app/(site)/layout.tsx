import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PriceTicker from "@/components/PriceTicker";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<div className="h-9 border-b border-white/[0.06] bg-zinc-900/60" />}>
        <PriceTicker />
      </Suspense>
      <Header />
      {children}
      <Footer />
    </>
  );
}
