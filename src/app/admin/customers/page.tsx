import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { H1, money, Pager, Table, when } from "@/components/admin/ui";

const PAGE = 50;

/** Customers = everyone who has paid, grouped by email (guests included), plus account status. */
export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const groups = await prisma.order.groupBy({
    by: ["email"],
    where: { paidAt: { not: null }, ...(sp.q ? { email: { contains: sp.q.toLowerCase() } } : {}) },
    _count: { _all: true },
    _sum: { totalCents: true, refundedCents: true },
    _max: { paidAt: true },
    orderBy: { _max: { paidAt: "desc" } },
    skip: (page - 1) * PAGE,
    take: PAGE + 1,
  });
  const users = await prisma.user.findMany({ where: { email: { in: groups.map((g) => g.email) } }, select: { email: true, role: true, createdAt: true } });
  const byEmail = new Map(users.map((u) => [u.email, u]));
  return (
    <div>
      <H1>Customers</H1>
      <form className="mb-4 flex gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Email" className="h-10 min-w-[240px] border-2 border-ink px-2" />
        <button className="h-10 border-2 border-ink px-3 text-sm font-semibold">Search</button>
      </form>
      <Table
        head={["Email", "Orders", "Spent", "Refunded", "Last order", "Account"]}
        empty="No customers yet."
        rows={groups.slice(0, PAGE).map((g) => [
          <Link key="e" href={`/admin/orders?q=${encodeURIComponent(g.email)}`} className="underline">{g.email}</Link>,
          g._count._all,
          money(g._sum.totalCents ?? 0),
          money(g._sum.refundedCents ?? 0),
          when(g._max.paidAt),
          byEmail.get(g.email) ? `${byEmail.get(g.email)!.role} since ${byEmail.get(g.email)!.createdAt.toLocaleDateString()}` : "guest",
        ])}
      />
      <Pager base="/admin/customers" page={page} hasMore={groups.length > PAGE} params={{ q: sp.q }} />
    </div>
  );
}
