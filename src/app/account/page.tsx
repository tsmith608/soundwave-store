import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Artwork from "@/components/art/Artwork";
import { AccountActions, DeleteProjectButton, ReorderButton, AddressBook } from "@/components/account/AccountActions";
import { getDesign, type ArtFields } from "@/lib/art";
import { formatCents } from "@/lib/commerce";
import { getCurrentUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { orderUrl } from "@/lib/server/orders/access";
import { STATUS_LABEL } from "@/lib/server/orders/state";
import { BRAND_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Your account — ${BRAND_NAME}`, robots: { index: false } };

const PAGE = 10;

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?next=/account");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [orders, orderCount, projects, addresses] = await Promise.all([
    prisma.order.findMany({ where: { userId: user.id, paidAt: { not: null } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { items: true, shipments: true } }),
    prisma.order.count({ where: { userId: user.id, paidAt: { not: null } } }),
    prisma.project.findMany({ where: { userId: user.id, status: "draft" }, orderBy: { updatedAt: "desc" }, take: 12 }),
    prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
  ]);
  const pages = Math.ceil(orderCount / PAGE);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-[1100px] px-4 pb-20 pt-10 sm:px-8">
          <p className="meta">Signed in as {user.email}</p>
          <h1 className="display mt-2 text-6xl">Your account</h1>

          <section className="mt-12" aria-labelledby="orders-h">
            <h2 id="orders-h" className="display text-4xl">
              Orders
            </h2>
            {orders.length === 0 ? (
              <p className="mt-4 rounded-xl border border-ink/15 bg-paper-2 p-6 text-lg">
                No orders yet. Orders placed with <strong>{user.email}</strong> appear here automatically.{" "}
                <Link href="/create" className="underline">
                  Create your first piece
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 divide-y-2 divide-ink border-y border-ink/15">
                {orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div>
                      <a href={orderUrl(o.id)} className="font-semibold underline">
                        {o.number}
                      </a>
                      <span className="ml-3 text-ink-soft">{o.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</span>
                      <p className="text-sm">
                        {o.items.map((i) => `${i.designName} · ${i.productName}`).join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="meta">{STATUS_LABEL[o.status]}</span>
                      <span className="font-semibold">{formatCents(o.totalCents)}</span>
                      {o.items[0] && <ReorderButton orderItemId={o.items[0].id} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {pages > 1 && (
              <nav className="mt-4 flex gap-4" aria-label="Order pages">
                {page > 1 && (
                  <Link href={`/account?page=${page - 1}`} className="underline">
                    ← Newer
                  </Link>
                )}
                {page < pages && (
                  <Link href={`/account?page=${page + 1}`} className="underline">
                    Older →
                  </Link>
                )}
              </nav>
            )}
          </section>

          <section className="mt-14" aria-labelledby="designs-h">
            <h2 id="designs-h" className="display text-4xl">
              Saved designs
            </h2>
            {projects.length === 0 ? (
              <p className="mt-4 text-ink-soft">Designs you start while signed in are saved here automatically.</p>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/create?project=${p.id}`} className="block rounded-xl border border-ink/15 bg-paper-2 p-2 hover:bg-paper">
                      <Artwork designId={p.designId} fields={p.fields as unknown as ArtFields} peaks={(p.peaks as number[]) ?? null} colorwayId={p.colorwayId} showQr={false} idPrefix={`acc-${p.id}`} />
                    </Link>
                    <p className="mt-2 text-sm font-semibold">{getDesign(p.designId)?.name}</p>
                    <p className="text-xs text-ink-soft">Edited {p.updatedAt.toLocaleDateString()}</p>
                    <DeleteProjectButton projectId={p.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-14" aria-labelledby="addr-h">
            <h2 id="addr-h" className="display text-4xl">
              Addresses
            </h2>
            <AddressBook initial={addresses.map((a) => ({ id: a.id, text: [a.name, a.line1, a.line2, `${a.city}${a.state ? `, ${a.state}` : ""} ${a.postalCode}`, a.country].filter(Boolean).join(" · "), isDefault: a.isDefault }))} />
          </section>

          <section className="mt-14 border-t border-ink/15 pt-8" aria-labelledby="acct-h">
            <h2 id="acct-h" className="display text-4xl">
              Account
            </h2>
            <AccountActions />
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
