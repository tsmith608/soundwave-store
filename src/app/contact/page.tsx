import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ContactForm from "@/components/ContactForm";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact us — ${BRAND_NAME}`,
  description: "Questions about an order, a recording, or removing a recording? A real person reads every message, usually within one business day.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ order?: string; topic?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="main" className="flex-1">
        <div className="mx-auto grid max-w-[1100px] gap-12 px-4 py-14 sm:px-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h1 className="display text-6xl sm:text-7xl">
              Talk to a <span className="accent !font-normal">person.</span>
            </h1>
            <p className="mt-6 text-lg text-ink-soft">We usually reply within one business day. For an existing order, include your order number (it starts with SW-).</p>
            <p className="mt-6">
              Email: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              {/* OWNER: add a phone number or business address here only if you want them public. */}
              We don&rsquo;t offer phone support yet.
            </p>
          </div>
          <ContactForm defaultOrder={sp.order ?? ""} defaultTopic={sp.topic === "removal" ? "Remove my recording" : undefined} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
