import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FAQ from "@/components/FAQ";
import { FAQ_ITEMS } from "@/lib/faq";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `FAQ — ${BRAND_NAME}`,
  description: "What you can upload, how video works, how long printing takes, the scan-to-listen code, privacy, and what happens if something's wrong.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="main" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <FAQ />
        <p className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-8">
          Still stuck? <Link href="/contact" className="underline">Contact us</Link> · <Link href="/shipping" className="underline">Shipping</Link> · <Link href="/returns" className="underline">Returns</Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
