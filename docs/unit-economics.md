# Unit Economics

**Status: provisional.** Stripe fees are published (fact). Print, frame and shipping costs are **estimates**: Prodigi, Printful and Gelato only show exact base costs inside a logged-in account ([Prodigi](https://www.prodigi.com/products/wall-art/framed-prints/classic-frames/), [Printful](https://www.printful.com/custom/wall-art/framed-posters/enhanced-matte-paper-framed-poster-in), [Gelato](https://www.gelato.com/custom/wall-art/wooden-framed-posters)), and this environment has no account access. The old README's cost figures (e.g. "~$36 for 16×20") were unsourced. **Replace every value marked ESTIMATE with a real quote before setting final prices or spending on ads** (checklist in §6).

The model is a small spreadsheet you can re-run: change the inputs in §2 and the formulas in §3 still hold.

---

## 1. What's configured in code

- Prices: `src/lib/catalog.ts` (`PRINT_SIZES`)
- Stripe: `src/lib/stripe.ts` (card payments; US shipping only on the curated checkout)
- Print partner: `backend/print_partner.py` (Printify / Prodigi / mock)
- Email: Resend (`backend/email_service.py`)

| Size | Print only | Framed |
|---|---|---|
| 8×10" | $35 | $69 |
| **12×16"** (default) | **$49** | **$99** |
| 18×24" | $65 | $149 |

All prices include free tracked US shipping.

## 2. Cost inputs

| Input | Value used (mid) | Range | Type |
|---|---|---|---|
| Stripe card fee | 2.9% + $0.30 | +1.5% on international cards; $15 per dispute | **Fact** ([Checkout Page](https://checkoutpage.com/blog/stripe-processing-fees)) |
| Fine-art print, 8×10 / 12×16 / 18×24 (US POD) | $8 / $11.50 / $18 | $6–10 / $9–14 / $14–22 | ESTIMATE |
| Framed (wood frame, mount, acrylic), 8×10 / 12×16 / 18×24 | $30 / $42.50 / $67.50 | $25–35 / $35–50 / $55–80 | ESTIMATE |
| Shipping, print (flat or tube) | $6.50 / $6.50 / $7.50 | $5–8 | ESTIMATE |
| Shipping, framed | $11 / $14 / $21.50 | $9–13 / $10–18 / $15–28 | ESTIMATE |
| Reprints, damage and refunds allowance | 3% of price | 2–5% | Hypothesis (a free-reprint promise is in the copy) |
| Audio hosting / email per order | ~$0 | — | Resend and Supabase free tiers cover early volume (confirm plan limits) |

**Fixed monthly costs** (not per order): domain, hosting (Vercel or a small VM for the Python/Chromium renderer — see owner-review), Supabase, email. **ESTIMATE: $20–70/month** at launch volume. Samples for photography: see owner-review.

## 3. Contribution per order (mid estimates)

Contribution = price − product − shipping − Stripe − reprint allowance.

| SKU | Price | Product | Ship | Stripe | Reprint | **Contribution** | **Margin** |
|---|---|---|---|---|---|---|---|
| Print 8×10 | $35 | 8.00 | 6.50 | 1.32 | 1.05 | **$18.13** | 52% |
| Print 12×16 | $49 | 11.50 | 6.50 | 1.72 | 1.47 | **$27.81** | 57% |
| Print 18×24 | $65 | 18.00 | 7.50 | 2.19 | 1.95 | **$35.36** | 54% |
| Framed 8×10 | $69 | 30.00 | 11.00 | 2.30 | 2.07 | **$23.63** | 34% |
| **Framed 12×16** | **$99** | 42.50 | 14.00 | 3.17 | 2.97 | **$36.36** | 37% |
| Framed 18×24 | $149 | 67.50 | 21.50 | 4.62 | 4.47 | **$50.91** | 34% |

**Sensitivity (framed 12×16).**

| Cost case | Product + ship | Contribution |
|---|---|---|
| High | $50 + $18 | ~$24 |
| Low | $35 + $10 | ~$48 |

The framed price only works if the real framed cost including shipping is **≤ ~$60**. If quotes come in higher, raise framed 12×16 to $109–119 (still inside the $70–110+ competitor band plus premium) or push print-only harder.

**Blended assumption** (hypothesis, to replace with real mix from analytics): 55% framed 12×16, 20% print 12×16, 10% framed 8×10, 10% framed 18×24, 5% print other.

- **Blended AOV ≈ $88**
- **Blended contribution ≈ $34 per order** (~38%)

## 4. Break-even and target CAC

- **Break-even CAC** is the contribution of the first order. We don't count repeat purchases until we have repeat data. There's no subscription, and gift products have low but real repeat (a second anniversary, a sibling's copy).
- **Target CAC** keeps at least 15% of revenue as profit after acquisition: target = contribution − 0.15 × price.

| SKU / blend | Break-even CAC | Target CAC (≥15% net) |
|---|---|---|
| Framed 12×16 ($99) | $36 | **≤ $21** |
| Print 12×16 ($49) | $28 | ≤ $20 |
| Framed 18×24 ($149) | $51 | ≤ $29 |
| Framed 8×10 ($69) | $24 | ≤ $13 |
| **Blended (AOV $88)** | **~$34** | **≤ $20–21** |

**What those CACs require of ads.** Cost per purchase = CPC ÷ conversion rate.

| CPC | CR 1.4% | CR 2.0% | CR 3.0% |
|---|---|---|---|
| $0.50 | $36 | $25 | $17 |
| $0.80 | $57 | $40 | $27 |
| $1.20 | $86 | $60 | $40 |

- CPC range: TikTok traffic ~$0.40–1.20 ([Admetrics](https://www.admetrics.io/post/tiktok-ads-costs-complete-2026-pricing-guide), [Stackmatix](https://www.stackmatix.com/blog/tiktok-ads-cost-2026-pricing-breakdown)). Meta CPMs average ~$13.48 in 2026 and rise 30–80% in Q4 ([Ryze](https://www.get-ryze.ai/blog/meta-ads-cost-benchmarks-by-industry-2026)).
- Home décor converts ~1.4% on average; the global average is ~2.66% ([DTC Pages](https://www.dtcpages.com/blog/ecommerce-conversion-rate-benchmarks-2026), [Skailama](https://www.skailama.com/blog/ecommerce-conversion-rate-by-industry)).

**Conclusion.** At average conversion rates, cold paid traffic costs **more** than an order is worth. Paid only works if:
1. conversion rate on paid landing traffic is at least 2.5–3%, and
2. clicks come in at or below ~$0.60, usually from creative that already performed organically.

This directly shapes paid-acquisition-q4-2026.md: **organic first, then boost proven posts, with hard stop-losses.**

## 5. Levers, in order of impact

1. **Framed attach rate and framed cost.** The framed 12×16 is the profit engine. Confirm a frame supplier at ≤ $60 landed.
2. **Conversion rate.** Instant true preview, clear delivery dates, real reviews. Every +0.5 pt of CR moves cost per purchase more than any bid tweak.
3. **AOV.**
   - A second copy for family at a discount (memorial orders especially). Hypothesis: a "copy for a sibling" add-on at −30% keeps ~$20 contribution, because design and audio work are already done.
   - 18×24 upsell.
   - Gift wrap or note card, if the supplier supports it.
4. **Don't discount by default.** Competitors' permanent "sales" are a known weakness (competitor-research §3). If a Black Friday offer runs, prefer "free upgrade to framed 12×16 for print price + $30" over percentage discounts, and check it against §3.

## 6. Numbers the owner must supply

- [ ] Chosen print partner(s) for US fulfilment: **Prodigi** (already integrated; UK-based with US production), **Printify** (integrated) or **Gelato/Printful** (not integrated).
- [ ] Exact base cost for: fine-art print at 8×10, 12×16 and 18×24; framed (black, natural, white) at the same sizes with mount and acrylic.
- [ ] US shipping cost per item, and per extra item.
- [ ] Production time per product (for the "3–5 business days" claim) and the partner's **2026 holiday cutoff dates**. Printify publishes per-provider cutoffs ([Printify holiday resources](https://help.printify.com/hc/en-us/articles/40716992503697-Holiday-Season-Resources-for-Printify-Merchants)).
- [ ] Paper spec (name and gsm) and frame spec, so the site's material claims can be made specific.
- [ ] SKUs to replace the placeholders in `src/lib/catalog.ts` (`sku.prodigi`).
- [ ] Hosting choice (see owner-review) and expected monthly cost.
- [ ] Sales-tax approach (Stripe Tax or manual). Not modelled here; tax is collected on top of price.
