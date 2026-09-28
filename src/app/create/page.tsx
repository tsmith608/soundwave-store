import React, { Suspense } from "react";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StudioFromParams from "@/components/studio/StudioFromParams";

export const metadata: Metadata = {
  title: "Create your print — SoundWave Art",
  description: "Choose a finished design, add your recording and your words, and see exactly what we'll print.",
  alternates: { canonical: "/create" },
};

export default function CreatePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2D2A26]">
      <Navbar />
      <main className="flex-1 pb-20 lg:pb-0">
        <Suspense fallback={<div className="py-32 text-center text-sm text-[#6B655F]">Loading the studio…</div>}>
          <StudioFromParams />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
