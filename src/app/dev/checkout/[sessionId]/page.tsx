import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { getEnv } from "@/lib/server/env";
import { formatCents } from "@/lib/commerce";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test checkout", robots: { index: false } };

/** Local stand-in for Stripe's hosted checkout page (development only). */
export default async function FakeCheckout({ params }: { params: Promise<{ sessionId: string }> }) {
  const env = getEnv();
  if (env.isProd || env.paymentsProvider !== "fake") notFound();
  const { sessionId } = await params;
  const order = await prisma.order.findUnique({ where: { stripeCheckoutSessionId: sessionId }, include: { items: true } });
  if (!order) notFound();
  const input = "h-11 w-full border-2 border-ink bg-white px-3";
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-10">
      <p className="meta text-signal">Development · fake payment page</p>
      <h1 className="display mt-2 text-4xl">Test checkout</h1>
      <p className="mt-2 text-ink-soft">This stands in for Stripe Checkout when no Stripe keys are configured. The buttons send signed Stripe-format webhooks to this app.</p>
      <ul className="mt-6 divide-y-2 divide-ink border-2 border-ink">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between p-3">
            <span>
              {i.designName} — {i.productName} × {i.quantity}
            </span>
            <span>{formatCents(i.lineTotalCents)}</span>
          </li>
        ))}
        <li className="flex justify-between p-3 font-semibold">
          <span>Total {order.number}</span>
          <span>{formatCents(order.totalCents)}</span>
        </li>
      </ul>
      <form method="post" action="/api/dev/fake-stripe" className="mt-6 space-y-3">
        <input type="hidden" name="sessionId" value={sessionId} />
        <label className="block">
          Email <input name="email" type="email" defaultValue={order.email || "test.customer@example.com"} className={input} />
        </label>
        <label className="block">
          Name <input name="name" defaultValue="Test Customer" className={input} />
        </label>
        <label className="block">
          Address <input name="line1" defaultValue="1 Test Street" className={input} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <input name="city" defaultValue="Portland" className={input} aria-label="City" />
          <input name="state" defaultValue="OR" className={input} aria-label="State" />
          <input name="postalCode" defaultValue="97201" className={input} aria-label="ZIP" />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button name="outcome" value="pay" className="btn btn-signal">
            Pay {formatCents(order.totalCents)}
          </button>
          <button name="outcome" value="async_fail" className="btn">
            Simulate failed payment
          </button>
          <button name="outcome" value="expire" className="btn">
            Abandon checkout
          </button>
        </div>
      </form>
    </main>
  );
}
