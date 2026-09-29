import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Artwork from "@/components/art/Artwork";
import { getDesign, type ArtFields } from "@/lib/art";
import { prisma } from "@/lib/server/db";
import { BRAND_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Listen — ${BRAND_NAME}`, robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Landing page for the printed scan-to-listen code. Unlisted, noindex. */
export default async function ListenPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ recording?: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) notFound();
  const item = await prisma.orderItem.findUnique({ where: { listenToken: token }, include: { order: { select: { status: true, paidAt: true } } } });
  if (!item || !item.order.paidAt || item.order.status === "cancelled") notFound();
  const spec = item.artworkSpec as { designId: string; colorwayId: string; fields: Record<string, string>; peaks: number[]; widthIn: number; heightIn: number; listenUrl?: string | null };

  if (item.recordingRemovedAt) {
    return (
      <main id="main" className="flex min-h-screen flex-col items-center justify-center bg-night px-6 py-12 text-center text-night-ink">
        <h1 className="display text-4xl">This recording has been removed.</h1>
        <p className="mt-4 max-w-sm opacity-80">It was taken down at the request of its owner. The print is still yours to keep.</p>
      </main>
    );
  }
  // The customer chose a public listen link (e.g. a song on Spotify): the printed
  // code opens it. We only redirect; the URL is never fetched by our server.
  if (typeof spec.listenUrl === "string" && /^https?:\/\//.test(spec.listenUrl) && (await searchParams)?.recording === undefined) {
    redirect(spec.listenUrl);
  }
  const design = getDesign(spec.designId);
  const heading = spec.fields?.names || spec.fields?.title || "";
  const sub = [spec.fields?.title !== heading ? spec.fields?.title : "", spec.fields?.subtitle].filter(Boolean).join(" · ");

  return (
    <main id="main" className="flex min-h-screen flex-col items-center bg-night px-6 py-12 text-night-ink">
      <div className="w-full max-w-sm text-center">
        {heading && <h1 className="display text-5xl">{heading}</h1>}
        {sub && <p className="mt-2 text-sm opacity-80">{sub}</p>}
        <audio controls preload="metadata" src={`/api/listen/${token}`} className="mt-8 w-full" />
        {design && (
          <div className="mx-auto mt-10 w-48 shadow-[0_10px_30px_rgba(40,30,20,.15)]">
            <Artwork designId={design.id} fields={spec.fields as unknown as ArtFields} peaks={spec.peaks} colorwayId={spec.colorwayId} widthIn={spec.widthIn} heightIn={spec.heightIn} showQr={false} idPrefix="listen" />
          </div>
        )}
        <p className="mt-10 text-xs opacity-60">
          Played from a print by <Link href="/" className="underline">{BRAND_NAME}</Link>
        </p>
      </div>
    </main>
  );
}
