import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Section } from "@/components/legal/LegalPage";
import { BRAND_NAME, LEGAL_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: `Privacy Policy | ${BRAND_NAME}`,
  description: `What ${BRAND_NAME} collects, why, how long we keep your recordings, and how to have them removed.`,
  alternates: { canonical: "/privacy" },
};

const UPDATED = "28 September 2026";

export default function PrivacyPage() {
  const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
  return (
    <LegalPage
      title="Privacy Policy"
      updated={UPDATED}
      intro={<>Your recordings are personal — often a voice you can’t record again. We collect as little as we can, keep it only as long as it’s needed, and delete it when you ask. This policy is from {LEGAL_NAME}.</>}
    >
      <Section n={1} title="What we collect">
        <ul>
          <li>
            <strong>Your recording — sound only.</strong> If you upload a video, your browser extracts the soundtrack on your device and only the sound is sent to us. The footage never leaves your phone or computer. Recordings made in the studio are sent as audio too.
          </li>
          <li><strong>The words on your print</strong> — names, dates, a message, an optional song title — and the design choices you make.</li>
          <li><strong>An optional listen link</strong> if you choose for your code to open one. We store it; we never visit it.</li>
          <li><strong>Order details</strong> — your email, shipping name and address, and what you bought. Card details go directly to our payment processor; we never see them.</li>
          <li><strong>Your email</strong>, if you sign up for reminders (such as holiday order-by dates).</li>
          <li>
            <strong>Basic usage events</strong> — for example “studio opened” or “recording uploaded” — with a random per-tab ID, the page and your browser type. This first-party log uses no cookies and isn’t shared with anyone. It helps us see where the studio is confusing.
          </li>
        </ul>
      </Section>

      <Section n={2} title="How we use it">
        <p>
          To make and deliver your artwork, to play your recording when your printed code is scanned, to answer your emails, to send order and shipping updates, and (only if you signed up) occasional reminders. We don’t use your recording to train AI models, we don’t sell your data, and we don’t share it for advertising.
        </p>
      </Section>

      <Section n={3} title="Who we share it with">
        <p>Only the services needed to run the shop, each for its own job:</p>
        <ul>
          <li><strong>Our print partner</strong> receives the finished print file and your shipping address — not your recording.</li>
          <li><strong>Our payment processor</strong> handles payment.</li>
          <li><strong>Our email provider</strong> sends order emails and reminders.</li>
          <li><strong>Our hosting and storage</strong> keep the site and your recording running.</li>
        </ul>
        <p>
          If advertising analytics (such as Google Analytics, Meta or TikTok) are switched on, advertising cookies only load after you accept them in the banner; you can change your mind by clearing this site’s data in your browser. We’ll disclose information if the law requires it.
        </p>
      </Section>

      <Section n={4} title="How long we keep your recording">
        <ul>
          <li><strong>Prints with a scan-to-listen code:</strong> for as long as we operate, so the code keeps working. If we ever close, we’ll email you first with a way to download it.</li>
          <li><strong>Prints without a code:</strong> deleted 90 days after delivery (long enough to handle any reprint).</li>
          <li><strong>Cancelled orders and unfinished checkouts:</strong> deleted after 30 days.</li>
          <li><strong>Uploads that never became an order:</strong> deleted after 30 days.</li>
        </ul>
        <p>
          Order records (what was bought, where it was shipped) are kept as long as tax and accounting rules require. Unsubscribing from emails removes you from reminders straight away.
        </p>
      </Section>

      <Section n={5} title="Removing your recording or data">
        <p>
          Email {mail} and we’ll delete your recording and switch off its code, usually within two business days — no reason needed. Anyone who can be heard in a recording can ask too. You can also ask for a copy of the data we hold about you, or for your data to be corrected or deleted. We’ll never charge for this or treat you differently for asking.
        </p>
      </Section>

      <Section n={6} title="Security">
        <p>
          Recordings are stored privately and are only reachable through your code’s unguessable link. Connections to our site are encrypted. No system is perfect; if something goes wrong that affects you, we’ll tell you promptly.
        </p>
      </Section>

      <Section n={7} title="Children">
        <p>
          Our shop is for adults. Parents often make prints from recordings of their children — a heartbeat, a first laugh — and we treat those recordings with the same care as any other, under the parent’s control.
        </p>
      </Section>

      <Section n={8} title="Changes and contact">
        <p>
          If we change this policy, we’ll update the date above, and for anything significant we’ll email customers. Questions or requests: {mail}. See also our <Link href="/terms">Terms of Service</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
