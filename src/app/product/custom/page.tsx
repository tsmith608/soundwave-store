import React, { Suspense } from "react";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StudioFromParams from "@/components/studio/StudioFromParams";

// Legacy URL kept working for existing links; the canonical studio is /create.
export const metadata: Metadata = {
  title: "Create your print — SoundWave Art",
  alternates: { canonical: "/create" },
};

export default function CustomProductPage() {
  return (
    <div className="flex min-h-screen flex-col pb-[72px] lg:pb-0">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-8">
          <h1 className="display text-[13vw] sm:text-[8vw] lg:text-[88px]">
            Make your <span className="accent !font-normal">piece.</span>
          </h1>
        </div>
        <Suspense fallback={<div className="py-32 text-center meta">Loading the studio…</div>}>
          <StudioFromParams />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
