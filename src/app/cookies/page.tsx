import type { Metadata } from "next";
import LegalPage, { Section } from "@/components/legal/LegalPage";
import CookiePreferences from "@/components/CookiePreferences";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Cookies & privacy choices — ${BRAND_NAME}`, alternates: { canonical: "/cookies" } };

export default function CookiesPage() {
  const ads = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || process.env.NEXT_PUBLIC_GA4_ID);
  return (
    <LegalPage title="Cookies" updated="29 September 2026" intro={<>We keep cookies to the minimum the shop needs to work. Advertising cookies are off until you choose.</>}>
      <Section n={1} title="Needed for the shop to work">
        <ul>
          <li><strong>sw_cart</strong> — remembers your cart (60 days).</li>
          <li><strong>sw_did</strong> — keeps your designs and uploads linked to this device without an account (1 year).</li>
          <li><strong>sw_session</strong> — keeps you signed in, only if you sign in (30 days).</li>
        </ul>
        <p>Your in-progress design is also saved in this browser&rsquo;s local storage so a refresh doesn&rsquo;t lose it. Checkout is handled by Stripe, which sets its own cookies for fraud prevention.</p>
      </Section>
      <Section n={2} title="Measurement">
        <p>We count visits and steps in the ordering process with our own first-party analytics (no cookies, nothing shared, never the words or recordings you add).{process.env.NEXT_PUBLIC_GA4_ID ? " We also use Google Analytics to understand traffic." : ""}</p>
      </Section>
      <Section n={3} title="Advertising (optional)">
        {ads ? <p>If you allow it, Meta and TikTok pixels help us see which ads and videos bring visitors. They only load after you choose &ldquo;Allow&rdquo;.</p> : <p>We don&rsquo;t currently use advertising cookies.</p>}
        <CookiePreferences />
      </Section>
    </LegalPage>
  );
}
