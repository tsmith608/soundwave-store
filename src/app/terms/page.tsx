import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Section } from "@/components/legal/LegalPage";
import { BRAND_NAME, LEGAL_NAME, LEGAL_STATE, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: `Terms of Service | ${BRAND_NAME}`,
  description: `The terms for ordering keepsake art from ${BRAND_NAME}: your recordings, our prints, the QR code, reprints and refunds.`,
  alternates: { canonical: "/terms" },
};

const UPDATED = "28 September 2026";

export default function TermsPage() {
  const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
  return (
    <LegalPage
      title="Terms of Service"
      updated={UPDATED}
      intro={
        <>
          The plain version: you send us a recording you’re allowed to use, we turn its sound into a print, and if we get it wrong we fix it. The details are below. “We” means {LEGAL_NAME}; “you” means the person placing the order.
        </>
      }
    >
      <Section n={1} title="What we make">
        <p>
          We create personalised wall art from the sound of a recording you upload or record on our site. The artwork is generated from the loudness of that recording and the words you add. We print it on archival paper and, if you choose, frame it and ship it to you.
        </p>
        <p>
          The preview in the studio is what we print. Colours on paper can look slightly different from your screen, and wood frames vary naturally in grain.
        </p>
      </Section>

      <Section n={2} title="Your recording and your rights">
        <p>When you upload or record something, you confirm that:</p>
        <ul>
          <li>you made the recording, or you have permission from whoever did to use it this way;</li>
          <li>the people who can be heard in it would not reasonably object — or you have their permission (for someone who has died, you are a family member or have the family’s blessing);</li>
          <li>it is not illegal, and it isn’t something you know you have no right to use, such as a commercial track downloaded from a streaming service.</li>
        </ul>
        <p>
          You keep all rights to your recording. You give us permission to store it, analyse its sound to make your artwork, print that artwork, and — if your print has a code — play the recording to whoever scans it. We use it for nothing else, and we never sell it or make it public.
        </p>
        <p>
          A wedding or party video will often include music playing in the room. That’s fine: we only use the recording to shape your artwork and to play it back privately through your code.
        </p>
      </Section>

      <Section n={3} title="Songs and listen links">
        <p>
          You can add a song title as a line of text, and you can choose for your code to open a link (for example on Spotify, Apple Music or YouTube). We never download, fetch or analyse anything from those links — the code simply sends the person scanning it there. We aren’t responsible for what third-party sites show, or if a link stops working; email us and we’ll point your code somewhere else.
        </p>
      </Section>

      <Section n={4} title="The scan-to-listen code">
        <p>
          If your print has a code, it opens a private page on our site that plays your recording (or goes to the link you chose). The page isn’t listed or indexed, but anyone who scans the print can hear it — so only include a code if you’re happy for guests to listen.
        </p>
        <p>
          We keep recordings behind a printed code for as long as we operate, so the code keeps working. If we ever close, we’ll email you first with a way to download your recording.
        </p>
      </Section>

      <Section n={5} title="Removing a recording">
        <p>
          You — or anyone who can be heard in a recording — can ask us to remove it at any time by emailing {mail}. We’ll delete it and switch the code off (it will say the recording has been removed). We don’t need a reason. If the request comes from someone other than the customer, we’ll let the customer know.
        </p>
      </Section>

      <Section n={6} title="Orders, prices and payment">
        <p>
          Prices are shown in US dollars and include shipping within the United States. Payment is taken when you order, through our payment processor; we never see or store your full card details. We start making your print once payment is confirmed.
        </p>
        <p>
          If you need to change or cancel, email us as soon as possible. We can change or cancel for free until your print goes into production (usually within one business day).
        </p>
      </Section>

      <Section n={7} title="Delivery">
        <p>
          Prints are made to order and typically arrive within 5–9 business days in the continental US. Delivery dates are estimates, not guarantees, and carriers can be delayed around holidays — we publish order-by dates for Christmas and other peaks.
        </p>
      </Section>

      <Section n={8} title="Reprints and refunds">
        <p>
          Because every piece is personalised, we can’t accept returns because you changed your mind. But if your print arrives damaged, is different from the preview you approved, or has a mistake we made, email us within 30 days with a photo and we’ll reprint it free or refund you — your choice.
        </p>
        <p>
          If there’s a typo that was in the preview you approved, we’ll reprint it at cost. Please check names and dates before ordering.
        </p>
      </Section>

      <Section n={9} title="Our artwork">
        <p>
          The designs, the software that generates them and the look of our site belong to us. Your print is yours to hang, give and enjoy; please don’t reproduce the designs to sell.
        </p>
      </Section>

      <Section n={10} title="Things we can refuse">
        <p>
          We may decline or cancel an order (with a full refund) if we believe the recording or text is unlawful, hateful, infringes someone’s rights, or would be used to harass someone.
        </p>
      </Section>

      <Section n={11} title="Liability">
        <p>
          We make each piece with care, but to the extent the law allows, our total liability for any order is limited to what you paid for it, and we aren’t liable for indirect losses. Nothing here limits rights you have under consumer-protection law that can’t be excluded.
        </p>
      </Section>

      <Section n={12} title="Changes and law">
        <p>
          We may update these terms; the version in force when you ordered applies to that order. These terms are governed by the laws of {LEGAL_STATE ? `the State of ${LEGAL_STATE}` : "the US state where we are registered"} and the United States.
        </p>
        <p>
          Questions? {mail}. See also our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
