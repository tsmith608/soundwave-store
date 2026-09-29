import Link from "next/link";
import { notFound } from "next/navigation";
import Artwork from "@/components/art/Artwork";
import { ActionButton, ConfirmForm } from "@/components/admin/ActionButton";
import { Badge, H1, money, Table, when } from "@/components/admin/ui";
import type { ArtFields } from "@/lib/art";
import { prisma } from "@/lib/server/db";
import { orderUrl } from "@/lib/server/orders/access";
import { storage } from "@/lib/server/storage";
import {
  addNoteAction,
  cancelAction,
  correctTextAction,
  clearAttentionAction,
  markDeliveredAction,
  refundAction,
  removeRecordingAction,
  rerenderAction,
  resendConfirmationAction,
  retryFulfillmentAction,
  syncFulfillmentAction,
} from "../../actions";

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { generatedAssets: { orderBy: { createdAt: "desc" } }, audioAsset: true, variant: true } },
      payments: true,
      refunds: { orderBy: { createdAt: "desc" } },
      fulfillments: { orderBy: { createdAt: "desc" } },
      shipments: true,
      events: { orderBy: { createdAt: "desc" }, take: 100 },
      emails: { orderBy: { createdAt: "desc" } },
      redemption: true,
      user: true,
    },
  });
  if (!o) notFound();
  const store = await storage();
  const links = new Map<string, string>();
  for (const it of o.items) for (const a of it.generatedAssets) links.set(a.id, await store.presignGet(a.storageKey, { expiresIn: 900, downloadName: `${o.number}-${it.id.slice(-6)}-${a.kind}.${a.kind === "print_pdf" ? "pdf" : "png"}` }));
  const address = [o.shipName, o.shipLine1, o.shipLine2, [o.shipCity, o.shipState, o.shipPostalCode].filter(Boolean).join(", "), o.shipCountry].filter(Boolean);
  const refundable = o.totalCents - o.refundedCents;
  const jobs = await prisma.job.findMany({ where: { OR: [{ dedupeKey: { contains: o.id } }, { payload: { path: ["orderId"], equals: o.id } }] }, orderBy: { createdAt: "desc" }, take: 20 });
  const section = "mt-8 border-2 border-ink p-4";

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/orders" className="underline">
          ← Orders
        </Link>
      </p>
      <H1>
        {o.number} <Badge tone={o.status}>{o.status}</Badge>
      </H1>
      {o.attentionReason && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border-2 border-[#B2361B] bg-[#FBE7E1] p-3">
          <strong>Needs attention: {o.attentionReason}</strong>
          <ActionButton action={clearAttentionAction.bind(null, o.id)} label="Mark resolved" />
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="border-2 border-ink p-4">
          <h2 className="mb-2 font-bold">Customer</h2>
          <p>{o.customerName ?? o.shipName ?? "—"}</p>
          <p>{o.email}</p>
          {o.phone && <p>{o.phone}</p>}
          <p className="text-sm text-ink-soft">{o.user ? `Account ${o.user.email}` : "Guest checkout"}</p>
          <h3 className="mb-1 mt-3 font-bold">Ship to</h3>
          <address className="not-italic">{address.length ? address.map((l) => <span key={l} className="block">{l}</span>) : "—"}</address>
          <p className="mt-2 text-sm">Method: {o.shippingMethod}</p>
          <p className="mt-2 text-sm">
            <a href={orderUrl(o.id)} className="underline" target="_blank">
              Customer order page ↗
            </a>
          </p>
        </section>
        <section className="border-2 border-ink p-4">
          <h2 className="mb-2 font-bold">Money</h2>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt>Subtotal</dt>
            <dd>{money(o.subtotalCents)}</dd>
            <dt>Discount {o.discountCode ? `(${o.discountCode})` : ""}</dt>
            <dd>−{money(o.discountCents)}</dd>
            <dt>Shipping</dt>
            <dd>{money(o.shippingCents)}</dd>
            <dt>Tax</dt>
            <dd>{money(o.taxCents)}</dd>
            <dt className="font-bold">Total</dt>
            <dd className="font-bold">{money(o.totalCents)}</dd>
            <dt>Refunded</dt>
            <dd>{money(o.refundedCents)}</dd>
          </dl>
          <p className="mt-2 text-xs text-ink-soft">Stripe session {o.stripeCheckoutSessionId ?? "—"}</p>
          <p className="text-xs text-ink-soft">PaymentIntent {o.stripePaymentIntentId ?? "—"}</p>
          {o.payments.map((p) => (
            <p key={p.id} className="text-sm">
              Payment {money(p.amountCents)} · <Badge>{p.status}</Badge>
            </p>
          ))}
          {o.refunds.map((r) => (
            <p key={r.id} className="text-sm">
              Refund {money(r.amountCents)} · <Badge>{r.status}</Badge> · {r.createdBy} {r.failureReason && <span className="text-[#7E2512]">({r.failureReason})</span>}
            </p>
          ))}
        </section>
        <section className="border-2 border-ink p-4">
          <h2 className="mb-2 font-bold">Timeline</h2>
          <p className="text-sm">Created {when(o.createdAt)}</p>
          <p className="text-sm">Paid {when(o.paidAt)}</p>
          {o.cancelledAt && <p className="text-sm">Cancelled {when(o.cancelledAt)}</p>}
          <h3 className="mb-1 mt-3 font-bold">Fulfillment</h3>
          {o.fulfillments.length === 0 && <p className="text-sm text-ink-soft">Not submitted yet.</p>}
          {o.fulfillments.map((f) => (
            <div key={f.id} className="text-sm">
              <p>
                {f.provider} {f.providerOrderId ?? "(no id)"} · <Badge>{f.status}</Badge> {f.providerStatus && <span className="text-ink-soft">{f.providerStatus}</span>}
              </p>
              <p>
                Attempts {f.attempts} · cost {f.costCents != null ? `${money(f.costCents)} ${f.costCurrency ?? ""}` : "—"} · synced {when(f.lastSyncedAt)}
              </p>
              {f.lastError && <p className="text-[#7E2512]">{f.lastError}</p>}
            </div>
          ))}
          <h3 className="mb-1 mt-3 font-bold">Shipments</h3>
          {o.shipments.length === 0 && <p className="text-sm text-ink-soft">None yet.</p>}
          {o.shipments.map((s) => (
            <p key={s.id} className="text-sm">
              {s.carrier} {s.service} · {s.trackingNumber ?? "—"} {s.trackingUrl && <a className="underline" href={s.trackingUrl} target="_blank" rel="noreferrer">track</a>} · <Badge>{s.status}</Badge>
            </p>
          ))}
        </section>
      </div>

      <section className={section}>
        <h2 className="mb-3 font-bold">Items</h2>
        <div className="space-y-6">
          {o.items.map((it) => {
            const spec = it.artworkSpec as unknown as { designId: string; colorwayId: string; fields: ArtFields; peaks: number[]; widthIn: number; heightIn: number; showQr: boolean; qrStyle: "discreet" | "standard"; qrUrl: string | null; listenUrl: string | null; templateVersion: number };
            return (
              <div key={it.id} className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                <div className="border-2 border-ink bg-paper-2 p-2">
                  <Artwork designId={spec.designId} fields={spec.fields} peaks={spec.peaks} colorwayId={spec.colorwayId} widthIn={spec.widthIn} heightIn={spec.heightIn} showQr={spec.showQr} qrStyle={spec.qrStyle} idPrefix={`adm-${it.id}`} />
                </div>
                <div className="text-sm">
                  <p className="text-base font-bold">
                    {it.designName} v{spec.templateVersion} · {it.productName} {it.frameFinish ? `· ${it.frameFinish} frame` : ""} × {it.quantity} · {money(it.lineTotalCents)}
                  </p>
                  <p>
                    SKU {it.sku} → provider SKU <code>{it.variant.fulfillmentSku}</code>
                  </p>
                  <dl className="mt-2 grid grid-cols-[120px_1fr] gap-y-0.5">
                    {Object.entries(spec.fields).map(([k, v]) => (v ? [<dt key={`${k}d`} className="text-ink-soft">{k}</dt>, <dd key={`${k}v`}>{v}</dd>] : null))}
                    <dt className="text-ink-soft">QR</dt>
                    <dd>{spec.showQr ? `${spec.qrStyle} → ${spec.listenUrl ? `link ${spec.listenUrl}` : "recording"} (${spec.qrUrl ?? "—"})` : "none"}</dd>
                    <dt className="text-ink-soft">Recording</dt>
                    <dd>
                      {it.recordingRemovedAt ? `removed ${when(it.recordingRemovedAt)}` : it.audioAsset ? `${it.audioAsset.status} · ${it.audioAsset.source} · ${(it.audioAsset.sizeBytes / 1e6).toFixed(1)} MB · ${it.audioAsset.durationMs ? Math.round(it.audioAsset.durationMs / 1000) + "s" : ""}` : "—"}
                    </dd>
                    <dt className="text-ink-soft">Rights</dt>
                    <dd>{it.rightsConfirmedAt ? `confirmed ${when(it.rightsConfirmedAt)}` : "—"}</dd>
                  </dl>
                  {["paid", "processing_artwork", "ready_for_fulfillment"].includes(o.status) && (
                    <details className="mt-3">
                      <summary className="cursor-pointer font-semibold underline">Correct the text (before it goes to the lab)</summary>
                      <div className="mt-2 max-w-lg">
                        <ConfirmForm action={correctTextAction.bind(null, it.id)} title="Edit the words on this print" submitLabel="Save and re-render" tone="default">
                          {Object.entries(spec.fields).map(([k, v]) => (
                            <label key={k} className="block text-sm">
                              {k}
                              <input name={`field_${k}`} defaultValue={v ?? ""} className="mt-1 h-9 w-full border-2 border-ink px-2" />
                            </label>
                          ))}
                        </ConfirmForm>
                      </div>
                    </details>
                  )}
                  <p className="mt-2 font-semibold">Files</p>
                  {it.generatedAssets.length === 0 && <p className="text-ink-soft">Not rendered yet.</p>}
                  <ul>
                    {it.generatedAssets.map((a) => (
                      <li key={a.id}>
                        <a href={links.get(a.id)} className="underline">
                          {a.kind}
                        </a>{" "}
                        · {a.widthPx ? `${a.widthPx}×${a.heightPx}px` : `${Number(a.widthIn)}×${Number(a.heightIn)}in`} {a.dpi ? `@${a.dpi}dpi` : ""} · {(a.sizeBytes / 1e6).toFixed(2)} MB · {a.rendererVersion} · {when(a.createdAt)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={section}>
        <h2 className="mb-3 font-bold">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <ActionButton action={retryFulfillmentAction.bind(null, o.id)} label="Retry print / fulfillment" />
          <ActionButton action={rerenderAction.bind(null, o.id)} label="Re-render print files" confirm="Render new print files from the stored spec?" />
          <ActionButton action={syncFulfillmentAction.bind(null, o.id)} label="Sync with lab now" />
          <ActionButton action={resendConfirmationAction.bind(null, o.id)} label="Resend confirmation email" />
          {o.status === "shipped" && <ActionButton action={markDeliveredAction.bind(null, o.id)} label="Mark delivered" confirm="Mark this order delivered?" />}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {o.paidAt && refundable > 0 && (
            <ConfirmForm action={refundAction.bind(null, o.id)} title={`Refund (up to ${money(refundable)})`} submitLabel="Issue refund" confirmHint={`Type ${o.number} to confirm`}>
              <label className="block text-sm">
                Amount (USD)
                <input name="amount" required inputMode="decimal" defaultValue={(refundable / 100).toFixed(2)} className="mt-1 h-10 w-full border-2 border-ink px-2" />
              </label>
              <label className="block text-sm">
                Reason (shown in the audit log)
                <input name="reason" className="mt-1 h-10 w-full border-2 border-ink px-2" />
              </label>
            </ConfirmForm>
          )}
          {!["shipped", "delivered", "cancelled", "refunded"].includes(o.status) && (
            <ConfirmForm action={cancelAction.bind(null, o.id)} title="Cancel order" submitLabel="Cancel order" confirmHint={`Type ${o.number} to confirm`}>
              <label className="block text-sm">
                Reason
                <input name="reason" className="mt-1 h-10 w-full border-2 border-ink px-2" />
              </label>
              {o.paidAt && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="refund" defaultChecked /> Refund in full
                </label>
              )}
            </ConfirmForm>
          )}
          <ConfirmForm action={removeRecordingAction.bind(null, o.id)} title="Remove recording (takedown)" submitLabel="Delete recording" confirmHint={`Type ${o.number} to confirm`}>
            <p className="text-sm text-ink-soft">Deletes the audio permanently and switches the printed QR code to “removed”.</p>
          </ConfirmForm>
        </div>
        <div className="mt-4 max-w-xl">
          <ConfirmForm action={addNoteAction.bind(null, o.id)} title="Add an internal note" submitLabel="Add note" tone="default">
            <textarea name="note" rows={2} className="w-full border-2 border-ink p-2" />
          </ConfirmForm>
        </div>
      </section>

      <section className={section}>
        <h2 className="mb-3 font-bold">History</h2>
        <Table
          head={["When", "Type", "Change", "Actor", "Message"]}
          empty="No events."
          rows={o.events.map((e) => [when(e.createdAt), e.type, e.toStatus ? `${e.fromStatus ?? "—"} → ${e.toStatus}` : "", e.actor, e.message ?? ""])}
        />
      </section>

      <section className={section}>
        <h2 className="mb-3 font-bold">Emails &amp; jobs</h2>
        <Table head={["Template", "To", "Status", "Sent", "Error"]} empty="No emails." rows={o.emails.map((m) => [m.template, m.to, <Badge key="s">{m.status}</Badge>, when(m.sentAt), m.error ?? ""])} />
        <div className="mt-4">
          <Table head={["Job", "Status", "Attempts", "Run at", "Error"]} empty="No jobs." rows={jobs.map((j) => [j.type, <Badge key="s">{j.status}</Badge>, `${j.attempts}/${j.maxAttempts}`, when(j.runAt), j.lastError ?? ""])} />
        </div>
      </section>
    </div>
  );
}
