# Paid Acquisition — Q4 2026

**Constraint:** founder-funded tests, not a growth budget. Every rule below comes from the unit economics:

- Blended AOV ≈ $88
- **Break-even CAC ≈ $34**
- **Target CAC ≤ $20–21**
- These are estimates until supplier quotes arrive (unit-economics.md).

**No campaigns have been created and no money has been spent.**

---

## 1. Platform facts (September 2026)

| Fact | Source |
|---|---|
| TikTok Ads Manager minimums: **$50 per campaign, $20 per day per ad group**. Reliable conversion optimisation needs ~50 conversions per week per ad group, which realistically means $150+/day | [Stackmatix](https://www.stackmatix.com/blog/tiktok-ads-cost-2026-pricing-breakdown), [Trendtrack](https://www.trendtrack.io/blog-post/tiktok-ad-costs) |
| **TikTok Promote** (in-app boost) supports website-visit goals from about **$3–10/day for 1–7 days**. Website-visit CPC is often $0.10–0.50 | [TikTok Promote help](https://ads.tiktok.com/help/article/how-to-set-up-promote-for-website-visits-and-conversions), [Megadigital](https://megadigital.ai/en/blog/tiktok-promotion-features/) |
| **Spark Ads** boost your own or a creator's organic post; engagement accrues to the original post. Authorisation codes last 7, 30, 60 or 365 days. Widely cited as the most cost-effective small-business format | [TikTok Spark Ads](https://ads.tiktok.com/help/article/spark-ads), [Enrich Labs](https://www.enrichlabs.ai/blog/tiktok-spark-ads-complete-guide-2026), [Novoads](https://novoads.ai/en/blog/tiktok-spark-ads-guide) |
| TikTok CPM typically $5–12; **Q4 rises 25–40%** | [Influee](https://influee.co/blog/tiktok-cpm), [Admetrics](https://www.admetrics.io/post/tiktok-ads-costs-complete-2026-pricing-guide) |
| Meta average CPM ≈ **$13.48** in 2026; Q4 rises **30–80%**; BFCM often 2–3× | [Ryze](https://www.get-ryze.ai/blog/meta-ads-cost-benchmarks-by-industry-2026), [Adamigo](https://www.adamigo.ai/blog/meta-ads-cpm-benchmarks-by-industry-2026) |
| Meta ad sets need ~**50 optimisation events per week** to exit learning. Under ~€50/day per ad set, most small advertisers stay "Learning Limited". Consolidate into one campaign | [Pigeon Digital](https://www.pigeondigital.com/insight/facebook-ads-learning-phase-50-conversions-rule-2026), [AdLibrary](https://adlibrary.com/posts/meta-ads-learning-phase-50-events-guide) |
| Home décor ecommerce converts ~1.4% | [DTC Pages](https://www.dtcpages.com/blog/ecommerce-conversion-rate-benchmarks-2026) |

## 2. The ten questions

**1. Should we use paid ads at launch?**
Not cold, and not before organic proof. At a 1.4% conversion rate and $0.80 CPC, cost per purchase is ~$57, above the $34 break-even (unit-economics §4). None of these test budgets can reach 50 conversions a week, so the platforms' purchase optimisation won't work for us. Paid starts **only after** a post has proven itself organically *and* the site has shown it converts organic visitors.

**2. Which platform first?**
**TikTok**:
- The format (reveals, the scan moment) is native to it.
- CPMs are ~35% below Meta's.
- Spark Ads let us pay for posts that already won.
- Promote allows single-digit daily budgets.

Meta second, for **retargeting only**.

**3. Under what conditions?**
All three must be true before spending on any creative:
- (a) The tracking checklist in analytics-plan.md §4 passes, including a test purchase deduplicated server-side.
- (b) The site has ≥ 300 organic studio sessions with **audio_uploaded ÷ design_selected ≥ 25%** and at least one organic purchase. That proves the funnel works for people who arrive interested.
- (c) There's a candidate post with **≥ 2× the account's median completion rate and ≥ 1% share rate** after 48 hours.

**4. What creative gets money?**
Only organic winners from the content plan, boosted as **Spark Ads** (or Promote, for $100 tests). Expected best candidates:
- c09 (scan moment)
- c02 (first dance → record sleeve)
- c04 (moon on your date)
- c03 (leaves)

**Memorial content (c01, c05, c28) is never boosted to cold audiences**, and we never target by bereavement or life-event signals. Memorial buyers come through search and organic.

**5. What conversion data do we need?**
- The first-party funnel (always on).
- TikTok Pixel with `ViewContent`, `AddToCart`, `InitiateCheckout` and `CompletePayment`, plus Events API deduplication.
- UTMs on every ad (`utm_content` = concept id).

Because purchases will be few, **judge tests on cost per add_to_cart and cost per audio_uploaded**, with purchase as confirmation.

**6. What's a rational minimum test?**
**$100 over 10 days** on 1–2 proven posts. That's enough for 150–400 landing visits at $0.25–0.60 per click: enough to measure upload and add-to-cart rates, not enough to prove CAC. See the tiers below.

**7. What metrics stop spend?** Any one of these:
- Landing-page CPC > **$1.00** after $40 spent on a creative.
- < **30%** of paid visitors reach `design_selected`. Traffic mismatch.
- **$60 spent with zero `add_to_cart`**.
- Cost per `add_to_cart` > **$25** after $100.
- Cost per purchase > **$40** after $200 spent. Above break-even with margin for error.
- **Dec 8, 2026:** stop all cold spend. Delivery after the Dec 10 order cutoff can't be promised.

**8. What metrics justify spending more?**
- Cost per `add_to_cart` ≤ **$12** and cost per purchase ≤ **$30** over ≥ 5 purchases → raise that creative's budget 30–50% every 3 days.
- Cost per purchase ≤ **$21** over ≥ 10 purchases → this is profitable at target. Move to a TikTok **website-conversion** campaign optimising for `CompletePayment`, and plan a January Valentine's test at higher budget.

**9. Boost organic posts instead of making traditional ads?**
**Yes.** Spark Ads keep social proof on the original post, cost less per engagement than standard formats ([Sprout Social](https://sproutsocial.com/insights/tiktok-promotion/): promoted organic 20–40% lower cost per engagement), and require no separate ad production. Make "ads" only by re-cutting a winning post: a new first 2 seconds, or a different end card.

**10. How should retargeting be used?**
Narrowly, and only once audiences exist:
- **Who:** people with `audio_uploaded` or `add_to_cart` in the last 14 days who didn't buy. They've already done the hard part.
- **Where:** Meta (IG and FB placements) and TikTok custom audiences.
- **Message:** "Your design is saved — order by Dec 10 for Christmas." Plus a scan-moment video.
- **No discount by default.**
- **Minimum audience:** ≥ 300 people. Below that, delivery is erratic and frequency spikes.
- **Frequency cap:** ~2 per day.
- **Never retarget memorial-occasion sessions with ads.** Exclude `occasion=memorial` and `occasion=pet` from audiences, and send them a gentle email instead if they've given an address.

## 3. Test plans

These are tests, not commitments. Each tier assumes the conditions in Q3 are met.

### $100 test: "Does a proven post bring the right people?"

| Item | Plan |
|---|---|
| Structure | **TikTok Promote** on the best organic post (goal: website visits). If two posts qualify, split $50/$50. |
| Creatives | 1–2 proven organic posts |
| Daily spend | $10/day (or 2 × $5) |
| Duration | 10 days, Oct 20 – Nov 14 window (before BFCM CPM inflation) |
| Objective | Website visits → `/create?occasion=…` with UTMs |
| Audience | Promote's automatic audience, US, 25–54 (the gift-buying core); no interest stacking |
| Success | CPC ≤ $0.60; ≥ 40% reach `design_selected`; ≥ 8% reach `audio_uploaded`; ≥ 2 `add_to_cart` |
| Failure | Any stop rule in Q7 |
| Learning goal | Paid-visitor funnel rates versus organic visitors |

### $250 test: "Can we get add-to-carts at a sane price?"

| Item | Plan |
|---|---|
| Structure | **TikTok Ads Manager**, 1 campaign, **1 ad group** (to consolidate learning), **Spark Ads** |
| Creatives | 3 proven organic posts (ideally one wedding, one anniversary/moon, one scan-moment) |
| Daily spend | $20/day (the ad-group minimum) |
| Duration | ~12 days, Oct 27 – Nov 16 |
| Objective | Days 1–5: **traffic / landing page view** (~$100), to seed pixel data. Days 6–12: **website conversions → AddToCart** (~$150). |
| Audience | US, 25–54, broad; exclude purchasers; no memorial targeting |
| Success | Cost per add_to_cart ≤ $12; ≥ 3 purchases; cost per purchase ≤ $34 |
| Failure | Q7 stop rules; turn off any creative with CTR < 0.6% after 5,000 impressions |
| Learning goal | Which message (wedding / moon / scan) converts, and the true paid CR |

### $500 test: "Profitable path into the holiday window?"

| Item | Plan |
|---|---|
| Structure | $300 TikTok (the $250 structure, extended with the winning creative) + **$150 Meta retargeting** + **$50 reserve** |
| Creatives | TikTok: 3 → narrow to the best 1–2 by day 7. Meta: 2 (scan moment; a "your design is saved" static of the customer's chosen design style) |
| Daily spend | TikTok $20/day × 15 days. Meta $7/day × ~21 days, **only after the retargeting pool is ≥ 300** |
| Duration | TikTok Oct 27 – Nov 20; Meta retargeting Nov 16 – Dec 8 (through BFCM, when warm audiences convert best despite high CPMs) |
| Objective | TikTok: website conversions → AddToCart, switching to CompletePayment if ≥ 10 purchases per week. Meta: Sales, with retargeting custom audience (audio_uploaded / add_to_cart, 14 days) |
| Audience | As above; retargeting excludes purchasers and memorial/pet occasions |
| Success | Blended cost per purchase ≤ $30; retargeting ROAS ≥ 3 |
| Failure | Q7; pause Meta if frequency > 4 per week or CPA > $40 |
| Reserve use | Scale the single best creative if it hits Q8, otherwise leave it unspent |

## 4. What happens after the tests

- **Green** (cost per purchase ≤ $21 on ≥ 10 purchases): hold spend flat through Dec 8. Plan the Valentine's campaign (Jan 12 – Feb 6) with 2–3× budget and fresh creative.
- **Amber** ($21–34): paid is marginal. Focus on conversion rate (reviews, preview, delivery clarity) and keep only retargeting.
- **Red** (> $34 or no purchases): stop paid. Double down on organic, SEO and Pinterest into wedding season (Jan–Jun). Revisit paid when reviews and a better conversion rate exist.

## 5. Creator and UGC boosting

- Seed product to 5–10 micro-creators (5k–50k followers) in weddings, home or grief-support **only with clear disclosure** (#ad / paid partnership). Cost: product plus shipping (~$60 each for framed 12×16 at estimated cost), with no fee requested.
- Ask for a **Spark Ads code** (30-day) in exchange for a modest fee **only if the post performs organically**.
- Never script fake reactions. Real unboxing or scan moments only.
