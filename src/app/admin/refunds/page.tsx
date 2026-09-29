import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { Badge, H1, money, Table, when } from "@/components/admin/ui";

export default async function Refunds() {
  const refunds = await prisma.refund.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { order: true } });
  return (
    <div>
      <H1>Refunds</H1>
      <p className="mb-4 text-sm text-ink-soft">Issue refunds from an order page. Refunds made directly in the Stripe dashboard also appear here (via webhook).</p>
      <Table
        head={["When", "Order", "Amount", "Status", "By", "Reason", "Stripe id"]}
        empty="No refunds."
        rows={refunds.map((r) => [when(r.createdAt), <Link key="o" href={`/admin/orders/${r.orderId}`} className="underline">{r.order.number}</Link>, money(r.amountCents), <Badge key="s">{r.status}</Badge>, r.createdBy, r.reason ?? r.failureReason ?? "", r.providerRefundId ?? "—"])}
      />
    </div>
  );
}
