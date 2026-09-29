import React from "react";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Studio from "@/components/studio/Studio";
import { activeVariants } from "@/lib/server/catalog";
import { readCart } from "@/lib/server/cart";
import { BRAND_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Create your print — ${BRAND_NAME}`,
  description: "Add your recording or video, choose a finished design, add your words, and see exactly what we'll print. Framed or print-only, shipped free in the US.",
  alternates: { canonical: "/create" },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CreatePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const variants = await activeVariants();
  const itemId = one(sp.item);
  let editItem: { id: string; variantId: string; frameFinish: string | null; quantity: number } | null = null;
  let projectId = one(sp.project);
  if (itemId) {
    const cart = await readCart();
    const item = cart?.items.find((i) => i.id === itemId);
    if (item) {
      editItem = { id: item.id, variantId: item.variantId, frameFinish: item.frameFinish, quantity: item.quantity };
      projectId = item.projectId;
    }
  }
  return (
    <div className="flex min-h-screen flex-col pb-[72px] lg:pb-0">
      <Navbar />
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-8">
          <h1 className="display text-[13vw] sm:text-[8vw] lg:text-[88px]">
            {editItem ? "Edit your " : "Make your "}
            <span className="accent !font-normal">piece.</span>
          </h1>
        </div>
        {variants.length === 0 ? (
          <p className="mx-auto max-w-xl px-4 py-24 text-center text-lg">Our print options are being updated. Please check back shortly, or email us.</p>
        ) : (
          <Studio
            variants={variants}
            initialDesign={one(sp.design) ?? one(sp.template)}
            initialOccasion={one(sp.occasion)}
            initialColorway={one(sp.colorway)}
            initialSize={one(sp.size)}
            projectId={projectId}
            editItem={editItem}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
