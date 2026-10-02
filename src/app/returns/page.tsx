import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Section } from "@/components/legal/LegalPage";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: `Returns & refunds — ${BRAND_NAME}`,
  description: "Every piece is personalised, so we don't take change-of-mind returns — but if it arrives damaged or isn't what you previewed, we'll make it right.",
  alternates: { canonical: "/returns" },
};

export default function ReturnsPage() {
  return (
    <LegalPage title="Returns & refunds" updated="2 October 2026" intro={<>Each piece is made from your recording and your words, so we can&rsquo;t resell it. But we stand behind every print.</>}>
      <Section n={1} title="We'll reprint or refund if">
        <ul>
          <li>it arrived damaged,</li>
          <li>it doesn&rsquo;t match the preview you approved (colours on paper can differ slightly from screens), or</li>
          <li>we made a mistake.</li>
        </ul>
        <p>Email {SUPPORT_EMAIL} within 30 days of delivery with your order number and a photo. You choose a free reprint or a full refund. We don&rsquo;t need the damaged piece back.</p>
      </Section>
      <Section n={2} title="Changes and cancellations">
        <p>You can change or cancel for free until your print goes into production — usually within a day of ordering. Reply to your confirmation email as soon as possible.</p>
      </Section>
      <Section n={3} title="What we can't take back">
        <p>Because every piece is personalised, we can&rsquo;t accept returns if you&rsquo;ve changed your mind. If a typo was in the preview you approved, we&rsquo;ll reprint it at cost.</p>
        <p>
          <strong>Digital files</strong> are delivered as soon as you pay, so they can&rsquo;t be returned. If a file has a mistake we made, or doesn&rsquo;t download, email us and we&rsquo;ll fix it or refund you. A typo that was in your preview we&rsquo;ll correct free, once.
        </p>
      </Section>
      <Section n={4} title="How refunds are paid">
        <p>Refunds go back to your original payment method. They usually appear within 5–10 business days, depending on your bank. We&rsquo;ll email you when we issue one.</p>
        <p>
          More detail in our <Link href="/terms">Terms</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
