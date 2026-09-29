import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { Badge, H1, money, Pager, Table, when } from "@/components/admin/ui";

const STATUSES: OrderStatus[] = ["pending_payment", "paid", "processing_artwork", "ready_for_fulfillment", "submitted_to_fulfillment", "in_production", "shipped", "delivered", "cancelled", "refunded", "failed"];
const PAGE = 30;

export default async function Orders({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; attention?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.OrderWhereInput = {};
  if (sp.status && STATUSES.includes(sp.status as OrderStatus)) where.status = sp.status as OrderStatus;
  else where.status = { not: "pending_payment" };
  if (sp.attention) where.attentionReason = { not: null };
  if (sp.q) {
    const q = sp.q.trim();
    where.OR = [{ number: { contains: q.toUpperCase() } }, { email: { contains: q.toLowerCase() } }, { shipName: { contains: q, mode: "insensitive" } }];
  }
  const orders = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE + 1, include: { items: { select: { quantity: true } } } });
  const hasMore = orders.length > PAGE;
  return (
    <div>
      <H1>Orders</H1>
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Order number, email or name" className="h-10 min-w-[240px] border-2 border-ink px-2" />
        <select name="status" defaultValue={sp.status ?? ""} className="h-10 border-2 border-ink px-2">
          <option value="">All (excl. unpaid)</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="attention" value="1" defaultChecked={Boolean(sp.attention)} /> Needs attention
        </label>
        <button className="h-10 border-2 border-ink px-3 text-sm font-semibold">Filter</button>
      </form>
      <Table
        head={["Order", "Customer", "Items", "Total", "Status", "Attention", "Created"]}
        empty="No orders match."
        rows={orders.slice(0, PAGE).map((o) => [
          <Link key="n" href={`/admin/orders/${o.id}`} className="font-semibold underline">
            {o.number}
          </Link>,
          <span key="c">
            {o.shipName ?? "—"}
            <br />
            <span className="text-ink-soft">{o.email || "—"}</span>
          </span>,
          o.items.reduce((a, i) => a + i.quantity, 0),
          money(o.totalCents),
          <Badge key="s" tone={o.status}>{o.status}</Badge>,
          o.attentionReason ? <Badge key="a" tone="failed">{o.attentionReason}</Badge> : "",
          when(o.createdAt),
        ])}
      />
      <Pager base="/admin/orders" page={page} hasMore={hasMore} params={{ q: sp.q, status: sp.status, attention: sp.attention }} />
    </div>
  );
}
