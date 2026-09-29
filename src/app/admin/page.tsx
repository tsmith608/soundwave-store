import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { Badge, H1, money, Table, when } from "@/components/admin/ui";
import { getEnv } from "@/lib/server/env";

function since(days: number) {
  return new Date(Date.now() - days * 86400_000);
}

async function load() {
  return Promise.all([
    prisma.order.aggregate({ where: { paidAt: { gte: since(1) } }, _sum: { totalCents: true }, _count: true }),
    prisma.order.aggregate({ where: { paidAt: { gte: since(7) } }, _sum: { totalCents: true }, _count: true }),
    prisma.order.findMany({ where: { attentionReason: { not: null } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.job.count({ where: { status: "dead" } }),
    prisma.webhookEvent.count({ where: { status: "failed" } }),
    prisma.emailMessage.count({ where: { status: { in: ["failed", "bounced"] } } }),
    prisma.contactMessage.count({ where: { status: "open" } }),
    prisma.order.findMany({ where: { paidAt: { not: null } }, orderBy: { paidAt: "desc" }, take: 10 }),
  ]);
}

export default async function Dashboard() {
  const env = getEnv();
  const [today, week, attention, deadJobs, failedHooks, failedEmails, openContacts, recent] = await load();
  const cards: [string, string, string?][] = [
    ["Paid today", `${today._count} · ${money(today._sum.totalCents ?? 0)}`],
    ["Last 7 days", `${week._count} · ${money(week._sum.totalCents ?? 0)}`],
    ["Needs attention", String(attention.length), "/admin/orders?attention=1"],
    ["Dead jobs", String(deadJobs), "/admin/system"],
    ["Failed webhooks", String(failedHooks), "/admin/system"],
    ["Email failures", String(failedEmails), "/admin/system"],
    ["Open messages", String(openContacts), "/admin/support"],
  ];
  return (
    <div>
      <H1>Dashboard</H1>
      <p className="mb-4 text-sm text-ink-soft">
        Payments: <strong>{env.paymentsProvider}</strong> · Fulfillment: <strong>{env.fulfillmentProvider}</strong>
        {env.fulfillmentProvider === "prodigi" ? ` (${env.PRODIGI_ENV})` : ""} · Email: <strong>{env.emailProvider}</strong> · Storage: <strong>{env.STORAGE_DRIVER}</strong>
        {!env.FULFILLMENT_AUTO_SUBMIT && " · Auto-submit OFF (orders wait for manual retry)"}
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([k, v, href]) => {
          const inner = (
            <>
              <span className="meta block">{k}</span>
              <span className="display mt-1 block text-2xl">{v}</span>
            </>
          );
          return href ? (
            <Link key={k} href={href} className="border-2 border-ink p-3 hover:bg-paper-2">
              {inner}
            </Link>
          ) : (
            <div key={k} className="border-2 border-ink p-3">
              {inner}
            </div>
          );
        })}
      </div>
      <h2 className="display mb-3 mt-10 text-2xl">Needs attention</h2>
      <Table
        head={["Order", "Reason", "Status", "Updated"]}
        empty="Nothing needs attention."
        rows={attention.map((o) => [<Link key="n" href={`/admin/orders/${o.id}`} className="underline">{o.number}</Link>, o.attentionReason, <Badge key="s" tone={o.status}>{o.status}</Badge>, when(o.updatedAt)])}
      />
      <h2 className="display mb-3 mt-10 text-2xl">Latest orders</h2>
      <Table
        head={["Order", "Customer", "Total", "Status", "Paid"]}
        empty="No paid orders yet."
        rows={recent.map((o) => [<Link key="n" href={`/admin/orders/${o.id}`} className="underline">{o.number}</Link>, o.email, money(o.totalCents), <Badge key="s" tone={o.status}>{o.status}</Badge>, when(o.paidAt)])}
      />
    </div>
  );
}
