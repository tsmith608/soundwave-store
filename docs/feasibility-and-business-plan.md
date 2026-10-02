# Afterhum: feasibility study, business plan and the next two months

**2 Oct 2026.** The figures below are estimates. Each is labelled with where it comes from, and the biggest unknowns are named. Update the model once real Prodigi costs and the first month of sales are in.

---

## 1. Verdict

**Feasible, as a lean business you can start now with very little money at risk.** Whether it can become a full-time income is **unproven**. Decide that in January, with real holiday-season numbers.

Why it's feasible:
- **Low cash risk.** There's no inventory: prints are made to order after the customer has paid. Setup costs are roughly **$300–600**, plus about **$25–70 a month** to run.
- **Healthy margins.** About **$34 profit per order** on an average $88 order, before advertising (estimate; see §4).
- **A growing market.** US personalised gifts are about **$13.5 billion** and growing about 7–9% a year, roughly three times faster than gifting overall ([Beyond Memories](https://beyond-memories.com/blogs/beyond-memories/state-of-personalized-gifting-2026), [Technavio](https://www.technavio.com/report/personalized-gifts-market-in-us-industry-analysis), [Arizton](https://www.arizton.com/market-reports/united-states-personalized-gifts-market)).
- **A product that's genuinely different.** Most competitors print a generic waveform. Afterhum has a real moon for the date, a plant grown from the recording's loudness, a code that plays the recording again, a preview that matches the print exactly, and no footage uploaded.
- **The store is built.** Checkout, printing, emails, admin, security and two months of marketing are done.

What could stop it:
1. **Traffic.** With no ad budget, sales depend on organic posts catching on, which is unpredictable. This is the biggest risk.
2. **Real costs.** Print and frame costs are still estimates. If framed 12×16 costs more than about $60 delivered, margins shrink (the fix is in §4).
3. **Timing.** Launching mid-October leaves about **8 weeks** before the holiday order-by date. That's tight, but it's the biggest gifting window of the year.
4. **A sensitive audience.** Grief buyers need trust. Mistakes, slow support or anything that feels fake hurt more here than in most categories.
5. **Brand.** "Afterhum" still needs a trademark search and a domain.

**Go / no-go check on 6 December** (end of the plan):

| Signal | Keep going | Rethink |
|---|---|---|
| Orders in 8 weeks | 25 or more | Under 10 |
| Site conversion rate (visits to orders) | 2% or more | Under 1% |
| Reprints and refunds | 5% or less | Over 10% |
| Social reach | At least one post over 50k views | Nothing over 5k |

---

## 2. Market and competition

- **Size:** US personalised gifts are about $13.5B in 2026, up about 9% on the year ([Beyond Memories](https://beyond-memories.com/blogs/beyond-memories/state-of-personalized-gifting-2026)). Forecasts range from $14.6B by 2030 ([Arizton](https://www.arizton.com/market-reports/united-states-personalized-gifts-market)) to +$5.3B by 2029 ([Technavio](https://www.technavio.com/report/personalized-gifts-market-in-us-industry-analysis)).
- **Memorial demand:** cremation is now the majority choice in the US (about 63% in 2025), which shifts remembrance spending toward keepsakes ([Small Biz Trends](https://smallbiztrends.com/sympathy-gifts/)). Pet memorials alone are a $6B+ global market ([Credence](https://www.credenceresearch.com/report/pet-memorials-market)).
- **Competitors:** see `docs/pricing-review-2026-10.md`.
  - **Etsy budget sellers:** $15–60.
  - **Premium brands:** $70–170, e.g. Bespoken Art ($99–169 custom framed), Artsy Voiceprint ($45–227), and star and map makers like Mapiful and Grafomap.
  - **Afterhum:** framed prints at $69–149. That's in the premium tier, priced below Bespoken.
- **Our edge:** design quality, true-to-date and true-to-recording art, playback, privacy (no footage uploaded), and the exact preview. **Our weakness:** no reviews or brand recognition yet.

## 3. Business model

- **What we sell:** two designs (The Night Of and Herbarium) in three sizes, as a fine-art print or a framed print. A code on the print can play the recording.
- **Who buys:**
  - people grieving, or buying for someone grieving (voicemails);
  - couples (vows, the moon on an anniversary);
  - new parents (heartbeats, first laughs);
  - gift buyers generally.
- **How it works:** the customer designs it on the site and pays through Stripe. Prodigi prints, frames and ships it, and charges us per order. Stripe pays out every few days, and Prodigi bills per order.
- **Prices** (US shipping included):

  | Size | Print only | Framed |
  |---|---|---|
  | 8×10 | $35 | $69 |
  | 12×16 | $49 | $99 |
  | 18×24 | $65 | $149 |

- **Profit per order, estimated** (`docs/unit-economics.md`):
  - framed 12×16: about $36;
  - print 12×16: about $28;
  - **across the expected mix: about $34 on an average $88 order.**

## 4. Costs

| Cost | Amount | Type |
|---|---|---|
| Domain | $12–20 / year | one-time |
| **Prodigi samples** (one per design, framed, to photograph and check quality) | ~$120–200 | one-time, **order this week** |
| Trademark search | Free (USPTO) | one-time |
| Trademark filing (optional, later) | ~$350 per class | one-time |
| Business registration (LLC, optional) | $50–500 depending on state | one-time |
| Hosting (web + worker + Postgres) | ~$20–60 / month | monthly |
| Storage (Cloudflare R2), email (Resend free tier), Sentry (free) | ~$0–10 / month | monthly |
| Stripe | 2.9% + 30¢ per order | per order (in the profit figure) |
| Print, frame, shipping | ~$18–90 per order | per order (in the profit figure) |
| Advertising | **$0 until a post proves itself** (§6) | optional |

**Total to launch: roughly $300–600** (more if you form an LLC or file a trademark now). **Running costs: about $25–70 a month.**

**Check this when Prodigi's prices arrive:** if a framed 12×16 costs more than about **$60 delivered**, raise it to **$109**. That's still below Bespoken's custom range, and it keeps about $35 profit per order.

## 5. What to expect, in money

### The next 8 weeks (12 Oct – 6 Dec)

These are scenarios, not promises. New online stores vary a lot: about 60% of new stores make under $1,000 a month in year one ([Folio3](https://ecommerce.folio3.com/blog/average-shopify-store-revenue/), [Nudgify](https://www.nudgify.com/how-long-does-it-take-to-make-money-on-shopify/)), but personalised-gift stores convert visitors better than most, at about 3–4% ([Grips](https://gripsintelligence.com/insights/industries/home-garden/personalized-gifts-and-home-decor)).

| Scenario | What has to happen | Orders | Revenue | Profit after costs |
|---|---|---|---|---|
| **Low** | Posts get little reach; friends and family buy | ~8 | ~$700 | **about −$130** (the samples and setup aren't covered yet) |
| **Base** | One or two posts reach 50–100k views; ~1,400 site visits at 2.5% conversion | ~35 | ~$3,100 | **about +$800** |
| **High** | A video catches on during gift season; ~4,800 visits | ~120 | ~$10,500 | **about +$3,700** |

Profit after costs = orders × ~$34, minus ~$400 of setup and two months of hosting, before income tax. **Plan around Base, and hope for High.** In the Low case the most you lose is a few hundred dollars, which mostly bought samples and setup you'd need anyway.

**Cash flow:** Stripe pays out a few days after each sale, and Prodigi charges your card when each order goes to print. Keep **$200–300 on the card** so a busy week doesn't stall printing.

**Taxes:** set aside **25–30% of profit** for income tax. Collect sales tax through Stripe Tax for your home state; talk to an accountant once orders start. That costs about $150–300 and is worth it in year one.

### The first year (rough)

| | Low | Base | High |
|---|---|---|---|
| Orders | ~150 | ~350 | ~800+ |
| Revenue | ~$13k | ~$31k | ~$70k+ |
| Profit before ads and your time | ~$5k | ~$12k | ~$27k+ |

Seasonality:
- **Peaks:** November–December, Valentine's Day, Mother's Day (May), and wedding and Father's Day season (June).
- **Quiet:** January and late summer.

Getting past the Base case usually needs **profitable paid ads**, which only works once you know which creative converts (§6), plus **reviews and customer photos**.

## 6. Business plan

**Mission:** keep the sound of a moment someone loves, as art they can hang and play back.

**Positioning:** premium, honest and private. "The real moon for your date. A plant grown from their voice. A code that plays it again."

**Channels, in order:**
1. **Organic social, daily:** TikTok, Reels and Shorts, Facebook and Pinterest. The 8-week calendar is ready (`marketing/social/`).
2. **Pinterest SEO:** gift searches like "voicemail memorial gift" and "paper anniversary gift" keep sending visits for months.
3. **Search engines:** the site already has pages for the voicemail, vows, anniversary, baby and pet occasions, plus the "how to save a voicemail" guide.
4. **Email:** the holiday-reminder list and the post-purchase thank-you, asking for photos and reviews.
5. **Gifted prints to small creators** (5–10 in November, cost = the print).
6. **Paid ads, only after proof.**
   - **When:** a post already does well organically, or site conversion is at or above 2.5%.
   - **How:** boost that exact post at $10–20 a day for 5 days.
   - **Stop rule:** halt if cost per order goes above **$30** (your profit is ~$34; see `docs/paid-acquisition-q4-2026.md`).

**Operations:**
- Orders flow through on their own, with a 12-hour hold before printing so customers can fix typos.
- **Your daily routine (~1–2 hours):**
  1. Post the day's content (scheduled ahead in Later or Buffer).
  2. Reply to comments; for "comment your date" posts, reply with that date's moon.
  3. Check the admin "Needs attention" list.
  4. Answer support emails.

**Milestones:**

| By | Milestone |
|---|---|
| 11 Oct | Domain bought; live keys; samples ordered; end-to-end test order shipped |
| 25 Oct | First 5 real orders; first customer photo |
| 15 Nov | 20 orders; one post over 50k views; holiday order-by date announced |
| 6 Dec | Go / no-go review (§1) |
| Jan 2027 | Decide: scale with ads, keep lean, or pivot. Plan Valentine's Day. |

**Numbers to watch every Monday** (Stripe dashboard, `/admin` and platform analytics):
- site visits, conversion rate and orders;
- average order value and the framed share;
- reprint and refund rate;
- top 3 posts by views and by link clicks;
- email signups.

## 7. The next two months, week by week

**Before launch (this week to 11 Oct). Do these in order, since some take days:**
1. **Order Prodigi samples today:** a framed Night Of and a framed Herbarium at 12×16. Shipping takes 5–10 days. They're your photos, your quality check and your proof that the code scans.
2. **Trademark search and domain.** Search "Afterhum" on USPTO, buy the domain, and claim @afterhum on TikTok, Instagram, Pinterest and Facebook.
3. **Accounts:**
   - Stripe in live mode;
   - Prodigi with billing;
   - Cloudflare R2;
   - Resend, with your domain verified;
   - your host (`docs/launch-checklist.md` lists everything).
4. **Security basics** (`docs/security-opsec.md`): two-factor authentication on email, registrar and Stripe; a restricted Stripe key; a separate database role for the app.
5. **Rehearsal in test mode**, using `docs/operations.md`.
6. **Re-render the marketing** with the real domain and order-by date (one command each).

**Weeks 1–2 (12–25 Oct): launch.**
- Post daily from the calendar.
- Tell everyone you know; your first 5–10 orders will probably come from your own circle, and that's normal.
- Ask the first customers for a photo of the print on their wall.

**Weeks 3–4 (26 Oct – 8 Nov): find what works.**
- Look at which series gets the most views and link clicks.
- Make more of the winner and drop the weakest series.
- Start messaging creators about gifted prints.

**Weeks 5–6 (9–22 Nov): gift season.**
- Gift-guide posts, and the ChatGPT room scenes.
- Announce the confirmed order-by date.
- If a post is clearly winning, consider the first small boost, within the stop rule.

**Weeks 7–8 (23 Nov – 6 Dec): Thanksgiving to last call.**
- "Record them" posts at Thanksgiving.
- Black Friday without fake discounts.
- Push the order-by date hard.
- On 6 December, run the go / no-go review.

**After the cutoff:**
- Switch to "a gift for the New Year" and print-only, which ships faster.
- Collect reviews.
- Plan Valentine's Day, the next peak, starting in mid-January.

## 8. Advice

1. **Order the samples today.** They unblock photos, quality checks, your own hands-only videos and real product proof. Nothing else on this list is as urgent.
2. **Don't spend on ads to "test the market".** Organic reach tells you what works for free. Ads multiply something that already works; they don't find it.
3. **Your edge is honesty and craft.** Never fake reviews, scarcity or sales. Grief buyers can tell, and the FTC fines for it.
4. **Treat support as marketing.** A fast, kind reply to someone sending their late father's voicemail earns a lifelong customer and a referral.
5. **Price for the premium tier, and raise prices before lowering them.** If framed sells easily at $99, test $109.
6. **Make a "copy for family" option** (a second print at about 30% off). Memorial orders often need several copies; it's the cheapest way to raise order value.
7. **Keep it a side business until the numbers say otherwise.** The cost to try is small; don't give up income on the strength of a holiday season.
8. **Write everything down weekly:** orders, conversion, best posts. In January you'll make better decisions from 8 weeks of notes than from memory.
9. **Have one place for questions.** A support email you check daily, with a reply-within-a-day promise.
10. **Protect the brand early:** the trademark search now, filing once you see traction (about $350).
