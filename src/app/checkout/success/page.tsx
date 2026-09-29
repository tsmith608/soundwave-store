import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PaymentConfirmation from "@/components/order/PaymentConfirmation";
import { BRAND_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Thank you — ${BRAND_NAME}`, robots: { index: false } };

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-8">
          <PaymentConfirmation sessionId={session_id ?? ""} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
