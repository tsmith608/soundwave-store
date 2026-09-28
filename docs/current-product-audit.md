# Current Product Audit (as found, 28 Sep 2026)

This audits the store as it existed at commit `4bce3f9`, before this round of work. Screenshots of that state are in [`docs/review/old/`](review/old/).

**Legend.** **Fact** = verified in the code or by rendering it. **Observed** = seen in screenshots or behaviour. **Hypothesis** = my inference. **Recommendation** = what to do about it.

---

## 1. Verdict

The old product wasn't sellable. The problems weren't polish:

1. **The artwork looked like a template.** The "product" was a thin rectangle with tiny corner ornaments around a centred waveform ([old print previews](review/old/old_print_previews.jpg), [customizer](review/old/customizer.png)).
2. **What the customer previewed wasn't what would print.** The browser preview (HTML canvas) and the print file (Python/Playwright HTML template) were two separate renderers, and they disagreed.
3. **Paid orders could not have been fulfilled with the configured database.**
4. **The site made trust claims that weren't true.**

---

## 2. Visual and product design

| # | Finding | Type |
|---|---|---|
| V1 | Each of the 9 "decorative styles" (`botanical`, `art_deco`, `celestial`, …) was the same layout with different corner marks: a hairline rectangle, a centred waveform and a script caption. Rendered side by side, three "themes" are almost indistinguishable ([old_print_previews.jpg](review/old/old_print_previews.jpg)). | Fact |
| V2 | The border *was* the product. Style names promised things like "Gatsby glamour", "Carrara opulence" and "astrophotography", but delivered 1–2% of the canvas as ornament. | Observed |
| V3 | Customers were asked to design: a 7-step sequence of photo → border → audio → one of 11 palettes → size → caption → "wave elevation" slider. Any border could be combined with any palette, so most combinations had never been looked at by anyone. | Fact |
| V4 | Emoji (🌿 🏛️ ✨ 📻 💎) stood in as style icons, next to "Awwwards-level luxury" copy. | Observed |
| V5 | **Palette mismatch between front end and back end.** The customizer's palette IDs (`blush_rosegold`, `sage_cream`, …) aren't in the Python print engine's list (`blush_rose`, `botanical_sage`, …). Every order would have printed in the fallback `midnight_gold`: a black waveform box on cream paper ([old_print_previews.jpg](review/old/old_print_previews.jpg)). | Fact (reproduced with `python -m backend.preview_generator --palette blush_rosegold` → rejected) |
| V6 | **Preview ≠ print.** The browser drew a canvas; the printer received a different HTML template. Nobody could guarantee the customer would get what they saw. | Fact |
| V7 | The print engine *added* random noise to the PDF so it would exceed an arbitrary 1 MB "quality" threshold (`generate_fine_art_texture`, `backend/print_engine.py`). Printing fake paper grain onto real paper degrades the print. | Fact |
| V8 | The homepage showed no finished product: text, icons and "sample" waveform strips, but not one image of a framed print ([home.png](review/old/home.png)). | Observed |

## 3. Trust, claims and legal risk

| # | Finding | Type |
|---|---|---|
| T1 | **Fabricated social proof.** "4.97 out of 5 from 840+ verified purchases" and six named "verified" testimonials, on a store that has never taken an order (`src/components/Testimonials.tsx`). The FTC's rule on fake reviews and testimonials (16 CFR Part 465, effective October 2024) allows civil penalties for this. **Removed.** | Fact |
| T2 | Material and service claims had no supplier behind them: "240+ GSM 100% cotton rag", "genuine pigment inks that will not fade for over 100 years", "solid hardwood", "ships via FedEx in 2–4 business days", "free insured delivery". **Rewritten** to what a Prodigi- or Printful-class supplier actually provides; the owner must confirm specifics once a supplier is chosen (see `owner-review.md`). | Fact |
| T3 | The printed QR code pointed to `${APP_URL}/play/<id>`, **a route that didn't exist**. Every printed code would have opened a 404. | Fact |

## 4. Engineering and operations

| # | Finding | Severity | Status |
|---|---|---|---|
| E1 | `backend/fulfill.py` only talks to SQLite, but Prisma is configured for Supabase Postgres. With a Postgres `DATABASE_URL` it silently opens a local `storage/soundwave.db`, doesn't find the order, and exits. The process is spawned detached with output discarded, so orders would sit in `pending_fulfillment` indefinitely. | **Launch blocker** | Not fixed (it's architectural: see owner-review for the recommended approach). The new vector render step is wired in and works. |
| E2 | The Stripe webhook accepted three hard-coded test secrets that are public in this repository. Anyone could have forged `checkout.session.completed` and triggered free fulfilment. | Critical | **Fixed for production.** Test secrets now only work when `NODE_ENV !== "production"`, and a missing secret in production refuses the webhook. |
| E3 | `stripeSessionId` was never saved (an empty update object), so the webhook's fallback lookup never matched. | Medium | Fixed |
| E4 | If the Stripe API call failed, checkout quietly switched to a "mock" URL, and a real customer would land on an order page without paying. | High | Fixed on the new checkout path (returns a clear error) |
| E5 | Checkout accepted arbitrary `audioPath` and `photoPath` strings from the browser and handed them to the print pipeline. | High | Fixed on the new path (only server-issued upload IDs accepted). The legacy path is kept for old tests. |
| E6 | The README says to deploy on Vercel, but fulfilment spawns `python3` and writes uploads to local disk; neither works on serverless. | Launch blocker | Not fixed; documented in owner-review |
| E7 | The upload picker's `accept` list excluded `.m4a`, the format iPhone voicemails and Voice Memos export. On iPhone those files would show as unselectable. | High | Fixed; phone videos (MP4/MOV) are now accepted too, and their audio is decoded in the browser |
| E8 | 24 programmatic `/gifts/*` pages, 17 of them "Nth [material] anniversary soundwave art" for a paper print (e.g. "6th iron", "20th china"). That's doorway-style content under Google's scaled-content policy. | Medium | Thin pages set to `noindex`; overlapping pages canonicalised to new intent pages |
| E9 | No analytics: the funnel couldn't be measured at all. | High | Fixed (see analytics-plan.md) |

## 5. What was kept

- Upload validation (`src/lib/audio.ts`), the in-browser recorder, the order status page and the DB helpers.
- The Etsy and Resend integrations (untouched).
- The legacy `FRAME_SIZES`, the palettes and the old checkout path. Existing tests and orders depend on them.
- `/product/custom` still works; it now serves the new studio.
- `/shop` redirects to `/designs`.
