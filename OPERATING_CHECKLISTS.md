# SoundWave Art — Operating Checklists

> *These are the only recurring tasks needed to keep the business healthy once it's running.*

---

## Daily Check (5 Minutes)

Every morning, open a single browser dashboard and scan:

- [ ] **Stripe Dashboard:** Any orders from last 24h? Any failed payments?
- [ ] **Order Status DB:** Any orders stuck in `pending_fulfillment` (should auto-advance to `fulfillment_submitted` within minutes of payment)?
- [ ] **Resend/Email logs:** Any transactional email failures (confirmation not sent)?
- [ ] **Print Partner (Prodigi/Printify) dashboard:** Any errors or rejected jobs?
- [ ] **Customer support inbox:** Any unread messages? (Target: respond within 4 hours)

**If everything is green: close dashboard. Done.**

---

## Weekly Review (1 Hour — Sunday)

### Marketing Performance

**Meta Ads:**
- [ ] Review ROAS for the week — is it above 2.0×?
- [ ] Check CTR on all running ads — pause anything below 0.5%
- [ ] Check CPA — is it below $25?
- [ ] Any ad fatigue signs (CTR dropping week-over-week)? Refresh creative.
- [ ] Review the retargeting campaign separately — what's the conversion rate?

**TikTok/Instagram:**
- [ ] Which posts performed best this week (views, saves, link clicks)?
- [ ] Are any organic posts worth boosting with Spark Ads?
- [ ] What's the weekly follower growth rate?

**Email/Klaviyo:**
- [ ] Review abandoned cart flow — how many triggered, how many recovered?
- [ ] Any unsubscribes or complaints above 0.2% (email health warning)?
- [ ] Open rate above 30%? Click rate above 2%?

### Operations
- [ ] Review VA's weekly summary (if VA is onboarded)
- [ ] Any recurring issue pattern in customer service? (If yes, update FAQ or fix the root cause)
- [ ] Any orders showing as `fulfillment_submitted` for more than 7 days without a shipping update? (Investigate with print partner)

### Content
- [ ] Plan next week's TikTok/Instagram content (batch-shoot Sunday)
- [ ] Schedule Pinterest pins for the week via Tailwind
- [ ] Respond to any creator DMs about gifting program
- [ ] Check if any gifted influencer posts went live this week — engage and save the content

---

## Monthly Strategic Review (2 Hours — First Sunday of Month)

### Revenue & Financials
- [ ] Total revenue for the month
- [ ] Total orders, AOV (Average Order Value)
- [ ] Total COGS + ad spend + tool subscriptions
- [ ] **Net profit** — is it on track toward the target?
- [ ] ROAS for the full month — is it improving or degrading?

### Marketing Analysis
- [ ] Which ad creative had the best ROAS this month? Double its budget.
- [ ] Which ad creative underperformed? Kill it.
- [ ] Top traffic sources for the month (GA4) — what's converting best?
- [ ] Organic TikTok: Any videos that hit 10K+ views? Analyze what made them work.
- [ ] Pinterest: Top-performing pins for the month — create 5 variations of each

### SEO
- [ ] Check Google Search Console — any new keywords ranking?
- [ ] Check impressions trend — growing month-over-month?
- [ ] Publish at least 2 new blog articles this month

### Product & Business
- [ ] Read all customer reviews left this month — are there product improvement insights?
- [ ] Any new product ideas or upsell opportunities observed?
- [ ] Check competitor Etsy stores for price changes or new products
- [ ] Is the print quality still excellent? (Order a sample if more than 60 days since last sample check)

---

## Quarterly Strategic Session (Half Day)

Once per quarter, block 4 hours for bigger-picture decisions:

- [ ] Are we hitting the revenue targets set in the business plan?
- [ ] What's the LTV trend? Are customers coming back for a second order?
- [ ] Review influencer affiliate performance — who are the top performers? Double down.
- [ ] Should we expand to a new product SKU? (Acrylic block? Canvas wrap?)
- [ ] Should we test international shipping? (UK, Canada, Australia)
- [ ] Review all tool subscriptions — are we paying for anything we don't use?
- [ ] Update the seasonal marketing calendar for the next quarter
- [ ] Are we capturing enough emails? (Target: email opt-in rate > 5% of site visitors)

---

## VA Handoff Protocol (When Ready to Delegate)

Once at 5+ orders/day, hire a VA for 1 hour/day and hand off:

### What the VA Does:
1. Opens customer support inbox every morning
2. Handles all Tier 2 customer messages using the template library
3. Tracks any orders that haven't shipped after 7 days
4. Flags any issues they can't resolve in a shared Notion doc
5. Sends you a weekly 5-bullet summary

### What the VA Does NOT Do:
- Access to Stripe account
- Access to print partner accounts
- Access to Meta Ads account
- Make any financial decisions

### VA Budget Allocation:
- **Reprint budget:** $50/week. They can authorize reprints without asking you for orders under $100.
- **Escalation threshold:** Any issue involving more than $100 or an angry customer who has messaged 3+ times → escalate to owner immediately.

### Finding the Right VA:
- Platform: Upwork (search "ecommerce customer service virtual assistant")
- Rate: $5–$12/hour for Philippines-based VA with ecommerce experience
- Vetting: Require a test task — send them 3 sample customer service scenarios and grade their responses before hiring

---

## Incident Response Playbook

### Scenario 1: Order stuck in `pending_fulfillment`

**Check first:** Did the Stripe webhook fire? Look at Stripe → Webhooks tab. If the webhook event shows "Failed" — manually re-trigger via Stripe dashboard.

If webhook fired but PDF generation failed:
1. Check the Python backend logs for error
2. Manually run `fulfill.py` with the order ID
3. Contact the customer: "We're processing your order manually — you'll receive a shipping update within 24 hours."

### Scenario 2: Print partner is down / rejected job

1. Check Prodigi/Printify status page for known outages
2. If Prodigi is down → reroute that order to Printify (backup pipeline)
3. Notify the customer of a 24-48 hour delay with a $10 discount code for inconvenience
4. Never let a customer reach out first about a delay

### Scenario 3: A Meta ad campaign is spending but no purchases

**Rule of thumb:**
- No purchases after $40 spend → pause the ad, review the landing page (is the CTA above the fold on mobile?)
- If landing page looks fine → the creative is failing. Test a new creative.
- If CTR is high but no purchases → checkout flow issue. Test the checkout manually.

### Scenario 4: Viral TikTok post (good problem)

If any post hits 50K+ views:
1. **Don't change anything** — let it run organically for 24 hours
2. At the 24-hour mark: launch a Spark Ad behind it with $50-$100/day budget
3. Monitor conversions every 6 hours — scale if ROAS is above 2×
4. Order extra inventory signal to print partner (heads-up on potential volume spike)
5. Prepare customer service responses for volume increase

### Scenario 5: Negative review left publicly

1. Respond within 2 hours — publicly, professionally, warmly
2. Offer to make it right with a free reprint or full refund
3. Never argue or get defensive
4. Template: *"Hi [name], I'm so sorry this wasn't the experience we work hard to deliver. Please reach out to us directly at [email] — we want to make this right immediately."*
5. Once resolved, politely ask if they'd be willing to update the review
