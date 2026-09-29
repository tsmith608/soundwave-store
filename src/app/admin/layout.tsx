import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { BRAND_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Admin — ${BRAND_NAME}`, robots: { index: false, follow: false } };

const NAV = [
  ["/admin", "Dashboard"],
  ["/admin/orders", "Orders"],
  ["/admin/fulfillment", "Fulfillment"],
  ["/admin/customers", "Customers"],
  ["/admin/products", "Products"],
  ["/admin/templates", "Designs"],
  ["/admin/discounts", "Discounts"],
  ["/admin/refunds", "Refunds"],
  ["/admin/uploads", "Uploads"],
  ["/admin/support", "Support"],
  ["/admin/system", "System"],
] as const;

/** Every /admin page is gated here (and every action re-checks). Non-admins get the sign-in page. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  if (!user) redirect("/account/login?next=/admin");
  return (
    <div className="min-h-screen bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-4 py-3">
        <Link href="/admin" className="font-bold">
          {BRAND_NAME} · Admin
        </Link>
        <span className="text-sm text-ink-soft">
          {user.email} ·{" "}
          <Link href="/" className="underline">
            Store
          </Link>
        </span>
      </header>
      <div className="flex flex-col lg:flex-row">
        <nav aria-label="Admin" className="border-b-2 border-ink lg:min-h-[calc(100vh-54px)] lg:w-52 lg:border-b-0 lg:border-r-2">
          <ul className="flex flex-wrap lg:flex-col">
            {NAV.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="block min-h-[44px] px-4 py-2.5 text-sm hover:bg-paper-2">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
