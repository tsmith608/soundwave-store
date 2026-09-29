import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { ActionButton } from "@/components/admin/ActionButton";
import { Badge, H1, Table, when } from "@/components/admin/ui";
import { retryFulfillmentAction } from "../actions";

export default async function Fulfillment() {
  const [failed, waiting, active] = await Promise.all([
    prisma.fulfillment.findMany({ where: { status: "failed" }, include: { order: true }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.order.findMany({ where: { status: { in: ["paid", "processing_artwork", "ready_for_fulfillment"] } }, orderBy: { paidAt: "asc" }, take: 50 }),
    prisma.fulfillment.findMany({ where: { status: { in: ["submitted", "in_production", "shipped"] } }, include: { order: true }, orderBy: { submittedAt: "asc" }, take: 100 }),
  ]);
  return (
    <div>
      <H1>Fulfillment</H1>
      <h2 className="mb-2 text-xl font-bold">Failed — needs a human</h2>
      <Table
        head={["Order", "Provider", "Attempts", "Error", "Updated", ""]}
        empty="No failures. 🎉"
        rows={failed.map((f) => [
          <Link key="o" href={`/admin/orders/${f.orderId}`} className="underline">{f.order.number}</Link>,
          f.provider,
          f.attempts,
          <span key="e" className="text-[#7E2512]">{f.lastError}</span>,
          when(f.updatedAt),
          <ActionButton key="r" action={retryFulfillmentAction.bind(null, f.orderId)} label="Retry" />,
        ])}
      />
      <h2 className="mb-2 mt-8 text-xl font-bold">Paid, not yet at the lab</h2>
      <Table
        head={["Order", "Status", "Paid", ""]}
        empty="Nothing waiting."
        rows={waiting.map((o) => [<Link key="o" href={`/admin/orders/${o.id}`} className="underline">{o.number}</Link>, <Badge key="s" tone={o.status}>{o.status}</Badge>, when(o.paidAt), <ActionButton key="r" action={retryFulfillmentAction.bind(null, o.id)} label="Process now" />])}
      />
      <h2 className="mb-2 mt-8 text-xl font-bold">At the lab</h2>
      <Table
        head={["Order", "Provider order", "Status", "Lab status", "Submitted", "Last sync"]}
        empty="Nothing in production."
        rows={active.map((f) => [<Link key="o" href={`/admin/orders/${f.orderId}`} className="underline">{f.order.number}</Link>, f.providerOrderId, <Badge key="s">{f.status}</Badge>, f.providerStatus ?? "", when(f.submittedAt), when(f.lastSyncedAt)])}
      />
    </div>
  );
}
