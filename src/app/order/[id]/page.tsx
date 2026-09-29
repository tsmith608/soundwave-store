import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Artwork from "@/components/art/Artwork";
import type { ArtFields } from "@/lib/art";
import { formatCents } from "@/lib/commerce";
import { FRAME_FINISHES } from "@/lib/catalog";
import { getCurrentUser, requireAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { checkOrderAccessToken } from "@/lib/server/orders/access";
import { PROGRESS, STATUS_LABEL } from "@/lib/server/orders/state";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Your order — ${BRAND_NAME}`, robots: { index: false, follow: false } };

const STEP_LABEL = ["Paid", "Print file", "At the studio", "Printing", "Shipped", "Delivered"];

/**
 * Order status. Visible to: the link in the customer's emails (signed token),
 * the signed-in owner, or an admin. Knowing the order id alone isn't enough.
 */
export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, shipments: { orderBy: { createdAt: "asc" } } } });
  if (!order) notFound();
  const user = await getCurrentUser();
  const allowed = checkOrderAccessToken(order.id, t) || (user && order.userId === user.id) || Boolean(await requireAdmin());
  if (!allowed) notFound();

  const idx = PROGRESS.indexOf(order.status);
  const closed = ["cancelled", "refunded", "failed", "pending_payment"].includes(order.status);
  const addr = [order.shipName, order.shipLine1, order.shipLine2, [order.shipCity, order.shipState, order.shipPostalCode].filter(Boolean).join(", ")].filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-[1100px] px-4 pb-20 pt-10 sm:px-8">
          <p className="meta">Order {order.number}</p>
          <h1 className="display mt-2 text-5xl sm:text-6xl">{STATUS_LABEL[order.status]}</h1>
          {order.paidAt && <p className="mt-2 text-ink-soft">Placed {order.paidAt.toLocaleDateString("en-US", { dateStyle: "long" })}</p>}
          {order.refundedCents > 0 && order.status !== "refunded" && <p className="mt-2 font-semibold">{formatCents(order.refundedCents)} refunded.</p>}

          {!closed && (
            <ol className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Progress">
              {STEP_LABEL.map((label, i) => {
                const done = idx >= i || (order.status === "ready_for_fulfillment" && i <= 1);
                return (
                  <li key={label} className={`border-2 border-ink p-2 text-sm ${done ? "bg-ink text-paper" : "bg-paper"}`} aria-current={idx === i ? "step" : undefined}>
                    <span className="meta block !text-[10px] opacity-70">{done ? "✓" : `0${i + 1}`}</span>
                    {label}
                  </li>
                );
              })}
            </ol>
          )}

          {order.shipments.length > 0 && (
            <section className="mt-10 border-2 border-ink bg-botanical p-5">
              <h2 className="display text-3xl">Tracking</h2>
              <ul className="mt-3 space-y-2">
                {order.shipments.map((s) => (
                  <li key={s.id}>
                    {s.carrier ?? "Carrier"} {s.service ? `· ${s.service}` : ""} — {s.trackingNumber ?? "number pending"}{" "}
                    {s.trackingUrl && (
                      <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                        Track package
                      </a>
                    )}
                    {s.deliveredAt && <span className="ml-2">· Delivered {s.deliveredAt.toLocaleDateString()}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm">Delivery dates are the carrier&rsquo;s estimate.</p>
            </section>
          )}

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section aria-label="Items">
              <ul className="space-y-6">
                {order.items.map((it) => {
                  const spec = it.artworkSpec as unknown as { designId: string; colorwayId: string; fields: ArtFields; peaks: number[]; widthIn: number; heightIn: number; showQr: boolean; qrStyle: "discreet" | "standard" };
                  return (
                    <li key={it.id} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
                      <div className="border-2 border-ink bg-paper-2 p-2">
                        <Artwork designId={spec.designId} fields={spec.fields} peaks={spec.peaks} colorwayId={spec.colorwayId} widthIn={spec.widthIn} heightIn={spec.heightIn} showQr={spec.showQr} qrStyle={spec.qrStyle} idPrefix={`o-${it.id}`} />
                      </div>
                      <div>
                        <p className="display text-2xl">{it.designName}</p>
                        <p className="text-ink-soft">
                          {it.productName}
                          {it.frameFinish ? ` · ${FRAME_FINISHES.find((f) => f.id === it.frameFinish)?.label ?? it.frameFinish} frame` : ""} · × {it.quantity}
                        </p>
                        <p className="mt-1 text-sm">{[spec.fields.title, spec.fields.names, spec.fields.date].filter(Boolean).join(" · ")}</p>
                        <p className="mt-1 font-semibold">{formatCents(it.lineTotalCents)}</p>
                        {it.recordingRemovedAt && <p className="mt-1 text-sm text-ink-soft">Recording removed on request; the code is switched off.</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
            <aside className="h-fit space-y-6 border-2 border-ink p-5">
              <dl className="space-y-1.5 text-[15px]">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{formatCents(order.subtotalCents)}</dd>
                </div>
                {order.discountCents > 0 && (
                  <div className="flex justify-between">
                    <dt>Discount {order.discountCode ? `(${order.discountCode})` : ""}</dt>
                    <dd>−{formatCents(order.discountCents)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt>Shipping</dt>
                  <dd>{order.shippingCents ? formatCents(order.shippingCents) : "Free"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Tax</dt>
                  <dd>{formatCents(order.taxCents)}</dd>
                </div>
                <div className="flex justify-between border-t-2 border-ink pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd>{formatCents(order.totalCents)}</dd>
                </div>
              </dl>
              {addr.length > 0 && (
                <div>
                  <p className="meta mb-1">Shipping to</p>
                  <address className="not-italic">
                    {addr.map((l) => (
                      <span key={l} className="block">
                        {l}
                      </span>
                    ))}
                  </address>
                </div>
              )}
              <div className="text-sm">
                <p className="font-semibold">Something not right?</p>
                <p className="mt-1 text-ink-soft">
                  Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Order%20${order.number}`} className="underline">{SUPPORT_EMAIL}</a> or use our <Link href={`/contact?order=${order.number}`} className="underline">contact form</Link> with your order number.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
