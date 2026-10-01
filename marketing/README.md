# Marketing kit

Every image and video here is rendered from the **real artwork engine** (`src/lib/art`), so ads show exactly what a customer receives. Nothing has been posted, and no campaigns or ad spend have been created.

```bash
npm run marketing:render                 # everything → marketing/out/
npm run marketing:render -- stills       # images only (add a name filter: -- stills story)
npm run marketing:render -- video        # 3 MP4s (~2 min)
npm run marketing:render -- print        # insert card PDF
npm run marketing:render -- sheet        # contact sheet

# After the rename / domain decision, re-render everything in one go:
MARKETING_URL="afterhum.com" npm run marketing:render   # once the domain is bought
```

Optional variables:

| Variable | Used for | Default |
|---|---|---|
| `MARKETING_BRAND` | Wordmark on every asset | `NEXT_PUBLIC_BRAND_NAME`, then "Afterhum" |
| `MARKETING_URL` | Printed URL + insert-card QR | `yourdomain.com` (**re-render before printing**) |
| `MARKETING_CUTOFF` | Holiday graphic date | `Dec 10` (**placeholder: confirm with Prodigi**) |
| `MARKETING_SUPPORT_EMAIL` | Insert card | `support@<MARKETING_URL>` |
| `MARKETING_HANDLE` | Insert card, e.g. `@stillheard` | none |
| `MARKETING_INSERT_CODE` | Insert card discount code; create it in Admin → Discounts first | none |

## What's in `out/`

| File(s) | Size | Use |
|---|---|---|
| `images/feed-01…07` | 1080×1350 (4:5) | Instagram / Facebook feed |
| `images/carousel-how-1…3` | 1080×1350 | "How it works" carousel (post in order) |
| `images/story-01…04` | 1080×1920 | Stories / Reels covers / TikTok photo posts |
| `images/pin-01…04` | 1000×1500 (2:3) | Pinterest |
| `images/ad-01…03` | 1080×1080 | Square ads (Meta, also fine for Google Display) |
| `images/seasonal-holiday-cutoff` | 1080×1350 | Holiday order-by reminder |
| `video/video-01…03.mp4` | 1080×1920, 12 s, 30 fps, **silent** | Reels / TikTok / Shorts; `-poster.jpg` is a cover frame |
| `print/insert-card-5x7-bleed.pdf` | 5×7 in + 0.125 in bleed (5.25×7.25 in pages) | Thank-you card in each box; front + back |
| `contact-sheet.jpg` | — | Overview of everything |
| `emails/*.html` | — | Launch announcement and holiday cutoff (see `emails/_shared-notes.txt`) |

## Honesty rules (keep these when editing)

- **Names, dates and recordings in the assets are illustrative.** Feed posts, stories and videos with a person's name carry a "Demo · illustrative" label. Keep the label, or swap in a real customer's print **with their written permission**.
- **No testimonials, star ratings, review counts, "as seen in" logos or sales numbers.** None exist yet. Add them only when they're real.
- First-person hooks such as *"I turned my dad's old voicemail into this"* (story-01) are **for the owner or a real customer to post as themselves**. Don't run them as paid ads in a fictional person's voice. If you use one in an ad, change it to second person ("Turn your dad's old voicemail into this").
- The framed prints are rendered mockups. Once you have real product photos, prefer those for paid ads; platforms and customers both reward real photos.
- The holiday date is a placeholder until Prodigi confirms its cutoffs.

## Posting notes

- **Audio:** the videos are silent on purpose. Add a sound **inside the app** when you post (Instagram/TikTok licensed library). Business accounts can only use the commercial library. Never add a commercial song in an editor and upload it.
- **Safe zones:** Reels/TikTok UI covers roughly the top 220 px, the bottom 400 px and the right 140 px of 1080×1920. The videos and stories keep text inside that.
- **Captions on screen** already carry the message, since most people watch muted.
- **Alt text:** add it on Instagram (Advanced settings) and Pinterest. The captions below double as alt text starters.
- **Links:** use the UTM format below so `/admin` attribution shows which post sold.

### UTM links

```
https://DOMAIN/?utm_source=instagram&utm_medium=social&utm_campaign=launch&utm_content=feed-02-voicemail
https://DOMAIN/create?utm_source=tiktok&utm_medium=paid_social&utm_campaign=voicemail_q4&utm_content=video-01
https://DOMAIN/?utm_source=pinterest&utm_medium=social&utm_campaign=evergreen&utm_content=pin-01
```
`utm_source`: instagram / facebook / tiktok / pinterest / email / insert. `utm_medium`: social / paid_social / email / print. `utm_content`: the asset's file name.

## Copy deck

### Feed posts (caption + first comment hashtags)

**feed-01-hero**
> Turn a moment you can hear into art you can keep. 🌙
> Upload a voice memo, voicemail, wedding clip or any video on your phone. We use the sound inside it (never the footage) to make a one-of-a-kind print. Framed, signed off by you, shipped to your door.
> Link in bio.

**feed-02-voicemail**
> Don't delete that voicemail.
> Save it, upload it, and we'll grow it into a botanical print. Every leaf's length is how loud that moment of their voice was. There's a small code on the print that plays it again.
> (Names in this post are illustrative.)

**feed-03-transformation**
> From a clip on your phone to a print on your wall.
> 01 your video → 02 its sound → 03 your print. We use the sound, not the footage. Your video never leaves your phone.

**feed-04-herbarium**
> Every leaf is a moment of the recording.
> Herbarium is grown from your sound, root to tip. No presets: no two plants are alike, because no two voices are.

**feed-05-night-of**
> The moon, exactly as it was that night.
> The Night Of shows the real moon phase for your date, ringed by the sound of your recording.

**feed-06-scan-it**
> Scan it. Hear it again.
> A small, tone-on-tone code on every print plays the original recording from any phone camera. No app. Private link.

**feed-07-gift-guide**
> Gifts made from a sound you share.
> For the anniversary · for the new parents · for the one who misses a voice.

**carousel-how-1…3**
> How it works, in three slides ➡️
> 1. Upload a memory (voice memo, voicemail, video). 2. Make it yours (design, names, date). 3. We print and frame it.

**seasonal-holiday-cutoff**
> Made to order means the holiday cutoff is real. Order framed prints by [DATE] for delivery before the 25th.

Hashtags (pick 3–5; more doesn't help): `#voicemail #griefsupport #weddinggift #anniversarygift #newparents #keepsake #personalizedgifts #soundwaveart #wallart #giftideas`

### Meta ads (Facebook / Instagram)

Primary text: under 125 characters shows without "See more". Headline: up to 40 (27 shows on most placements).

| # | Primary text | Headline | Image / video |
|---|---|---|---|
| A1 | Still have their voicemail? Turn it into a botanical print where every leaf is a moment of their voice. | Keep their voice where you can see it | ad-01-voice / video-01 |
| A2 | Your wedding video, framed. We use the sound of your vows (not the footage) to make one-of-a-kind art. | Your vows, on your wall | ad-02-video |
| A3 | What did the moon look like on your night? We draw the real moon for your date, ringed by your recording. | The moon from your night | ad-03-moon / video-02 |
| A4 | The code on the print plays your recording again from any phone. Art you can look at and listen to. | Scan it. Hear it again. | video-03 |

Description (optional, 30 chars): `Framed & shipped in the US` · CTA button: *Shop now* or *Learn more*.

### TikTok ad text (12–100 characters)

- `POV: you finally do something with Dad's old voicemail` (54)
- `What did the moon look like the night you met? We'll show you.` (62)
- `This is what our wedding video sounds like 🌙` (44)
- `Every leaf on this print is a second of their voice.` (52)

### Pinterest (title ≤100 characters; description ≤500, the first ~50 show in feed)

**pin-01-voicemail-memorial**
Title: `Memorial gift idea: turn a saved voicemail into a botanical keepsake print`
Description: `A meaningful sympathy and memorial gift. Upload a saved voicemail or voice memo and we grow it into a framed botanical print — every leaf drawn from their voice. A small code plays the recording again.`

**pin-02-wedding-vows**
Title: `Wedding vows art from your wedding video — a personalized anniversary gift`
Description: `Your vows, exactly as they sounded that day. We use the sound from your wedding video to make one-of-a-kind wall art, with the real moon from your date.`

**pin-03-baby-heartbeat**
Title: `Baby heartbeat art from your scan video — nursery wall art keepsake`
Description: `The first sound you heard of them. Upload the ultrasound video from your camera roll and we turn its heartbeat into a botanical nursery print.`

**pin-04-anniversary-moon**
Title: `Moon phase anniversary gift: the moon from the night you met, with your voices`
Description: `The real moon phase for your date, ringed by a recording of your voices. Personalized anniversary art, framed and shipped.`

## Package insert

`print/insert-card-5x7-bleed.pdf`: front "Thank you for trusting us with it"; back explains the QR code, care, the 30-day reprint/refund promise (matches `/returns`), how the art was made, and a QR to the homepage for gifting (`utm_source=insert`).

- Print on 14–16 pt matte card stock at any online printer that takes a PDF with 0.125 in bleed.
- **Check first** whether Prodigi can include third-party inserts for your account. If it can't, send the cards with orders you pack yourself, or skip them.
- Re-render with the real domain and support email before ordering.

## Ideas not yet made (need you or real assets)

- Real phone-in-hand / on-the-wall photos and UGC-style videos. These outperform rendered mockups.
- A founder-story video ("why I built this"). It can't be faked.
- Customer stories, with written permission, to replace the demo names.
