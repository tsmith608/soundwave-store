import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TrackForm from "@/components/order/TrackForm";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Track your order — ${BRAND_NAME}`, description: "Check the status of your order with your order number and email.", alternates: { canonical: "/track" } };

export default function TrackPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-16 sm:px-8">
          <h1 className="display text-6xl">Track your order</h1>
          <p className="mt-4 text-lg text-ink-soft">Enter your order number (it starts with SW-) and the email you used at checkout.</p>
          <TrackForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
