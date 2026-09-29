import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Section } from "@/components/legal/LegalPage";
import { activeVariants } from "@/lib/server/catalog";
import { formatCents } from "@/lib/commerce";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: `Shipping — ${BRAND_NAME}`,
  description: "How long your print takes, where we ship, tracking, and what to do if a delivery goes wrong.",
  alternates: { canonical: "/shipping" },
};

export default async function ShippingPage() {
  const variants = await activeVariants().catch(() => []);
  const express = Number(process.env.SHIPPING_EXPRESS_CENTS || 0);
  return (
    <LegalPage title="Shipping" updated="29 September 2026" intro={<>Every piece is printed to order, then shipped with tracking. Here&rsquo;s what to expect.</>}>
      <Section n={1} title="Where we ship">
        {/* OWNER: update if you add countries (also set SHIPPING_COUNTRIES). */}
        <p>We currently ship to addresses in the United States only.</p>
      </Section>
      <Section n={2} title="How long it takes">
        <p>Times are business days from your order to your door, and are estimates — carriers can be slower around holidays and in bad weather.</p>
        <ul>
          {variants.map((v) => (
            <li key={v.id}>
              {v.label}: usually {v.leadTimeMinDays}–{v.leadTimeMaxDays} business days
            </li>
          ))}
        </ul>
        <p>Before Christmas and other busy dates we publish order-by dates on the homepage and in our emails.</p>
      </Section>
      <Section n={3} title="Cost">
        <p>Standard tracked shipping is free on every order within the US.{express > 0 ? ` Express shipping is available at checkout for ${formatCents(express)}.` : ""} Sales tax, where it applies, is calculated at checkout from your shipping address.</p>
      </Section>
      <Section n={4} title="Tracking">
        <p>
          We email your tracking number the day your order ships. You can also check any time on your order page — the link is in your confirmation email, or use <Link href="/track">Track an order</Link>.
        </p>
      </Section>
      <Section n={5} title="If something goes wrong">
        <ul>
          <li>
            <strong>Arrived damaged:</strong> keep the packaging, take a photo, and email {SUPPORT_EMAIL} within 30 days. We&rsquo;ll send a replacement at no cost.
          </li>
          <li>
            <strong>Tracking hasn&rsquo;t moved for 7 business days, or it says delivered but it isn&rsquo;t there:</strong> contact us and we&rsquo;ll chase the carrier and, if it&rsquo;s lost, reprint it.
          </li>
          <li>
            <strong>Wrong address:</strong> tell us within 12 hours of ordering and we&rsquo;ll correct it before it&rsquo;s printed.
          </li>
        </ul>
      </Section>
    </LegalPage>
  );
}
