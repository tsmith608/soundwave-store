import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Artwork from "@/components/art/Artwork";
import { getDesign } from "@/lib/art";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Listen — SoundWave Art", robots: { index: false, follow: false } };

/** Landing page for the printed scan-to-listen code. Unlisted, noindex. */
export default async function ListenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) notFound();
  const order = await prisma.order.findUnique({ where: { listenToken: token }, select: { artworkSpec: true, status: true } }).catch(() => null);
  if (!order || !order.artworkSpec || order.status === "cancelled") notFound();
  const spec = JSON.parse(order.artworkSpec);
  const design = getDesign(spec.designId);
  const heading = spec.fields?.names || spec.fields?.title || "";
  const sub = [spec.fields?.title !== heading ? spec.fields?.title : "", spec.fields?.subtitle].filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#2D2A26] flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        {heading && <h1 className="font-serif text-4xl leading-tight">{heading}</h1>}
        {sub && <p className="mt-2 text-sm text-[#6B655F]">{sub}</p>}
        <audio controls preload="metadata" src={`/api/listen/${token}`} className="mt-8 w-full" />
        {design && (
          <div className="mt-10 mx-auto w-48 shadow-[0_10px_30px_rgba(40,30,20,.15)]">
            <Artwork designId={design.id} fields={spec.fields} peaks={spec.peaks} colorwayId={spec.colorwayId} widthIn={spec.widthIn} heightIn={spec.heightIn} showQr={false} idPrefix="listen" />
          </div>
        )}
        <p className="mt-10 text-xs text-[#9E968F]">
          Played from a print by <a href="/" className="underline">SoundWave Art</a>
        </p>
      </div>
    </main>
  );
}
