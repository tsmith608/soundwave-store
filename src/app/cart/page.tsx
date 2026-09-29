import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartView from "@/components/cart/CartView";
import { cartDto, priceCart, readCart } from "@/lib/server/cart";
import { BRAND_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Your cart — ${BRAND_NAME}`, robots: { index: false } };

export default async function CartPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const cart = await readCart();
  const initial = cart && cart.items.length ? cartDto(await priceCart(cart)) : null;
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-10 sm:px-8">
          <h1 className="display text-6xl sm:text-7xl">Your cart</h1>
          <CartView initial={initial} notice={sp.checkout === "cancelled" ? "cancelled" : sp.added ? "added" : null} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
