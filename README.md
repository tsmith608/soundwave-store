# SoundWave Art — Next-Gen Acoustic Fine Art E-Commerce Platform

> **Comprehensive Hand-Off Documentation & Developer Guide**  
> *Engineered for immediate onboarding by Claude, autonomous AI agents, and human developers.*

---

## 1. Executive Summary & Core Concept

**SoundWave Art** is a custom-domain, direct-to-consumer e-commerce brand and software platform that transforms personal memories into museum-grade framed acoustic art prints. 

### The Problem It Solves
Traditional Etsy soundwave sellers rely on 100% manual labor:
1. The customer orders on Etsy and sends an audio file via Etsy messages.
2. The seller manually opens Adobe Illustrator, generates a soundwave vector, places photos, types the inscription, and exports a proof.
3. 3 to 7 days of back-and-forth email revisions follow before anything is printed.
4. The seller manually uploads the design to a print-on-demand provider or prints it locally.

### The SoundWave Art Moat
SoundWave Art replaces this friction with **instant, client-side automated compositing and zero-touch POD fulfillment**:
- **Instant Browser Studio**: Customers upload a photo and audio (or record directly via microphone). A high-performance HTML5 Canvas renders a live, 60 FPS acoustic waveform in real time.
- **Bespoke Aesthetics**: Customers customize from 8 curated design aesthetics (Botanical, Bauhaus, Arch, Art Deco, Celestial, Minimal, etc.) and fine-art color palettes (Blush Rose Gold, Sage Cream, Midnight Gold, Nordic Slate).
- **Physical Keepsake + Audio Playback**: Every physical print is assembled at 300 DPI archival quality, framed in real wood, and includes a scannable QR code linking to the customer's permanent audio playback URL.
- **Zero-Touch Fulfillment**: Stripe payment automatically triggers database record creation, high-res PDF generation, submission to print partners (Printify / Prodigi), and transactional email confirmation via Resend.

---

## 2. Tech Stack & System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS 16 FRONTEND                           │
│  - App Router (React 19 / TypeScript)                                  │
│  - Tailwind CSS + Cormorant Garamond (Serif) & Inter (Sans)            │
│  - Framer Motion (Luxury cubic-bezier transitions & 3D magnetic tilt)  │
│  - HTML5 Canvas & Web Audio API (Live 60 FPS waveform analysis)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SERVER & API LAYER                              │
│  - Next.js API Route Handlers (Edge / Node Runtime)                    │
│  - Stripe Payments & Webhook Verification                              │
│  - File Upload Pipeline (/api/upload -> multipart handling)            │
│  - Prisma ORM + PostgreSQL (Supabase Connection Pooling)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   AUTOMATED FULFILLMENT ENGINE (Python)                │
│  - backend/fulfill.py: Master orchestration pipeline                   │
│  - backend/waveform_generator.py: Audio DSP & peak normalization      │
│  - backend/print_engine.py: 300 DPI vector/bitmap PDF generation       │
│  - backend/preview_generator.py: Web-optimized proof thumbnails        │
│  - backend/print_partner.py: Printify & Prodigi POD API submission     │
│  - backend/email_service.py: Resend transactional email notifications  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Product Catalog & Pricing Architecture

All products are configured in [`src/lib/constants.ts`](src/lib/constants.ts):

| Size ID | Dimensions | Retail Price | Production Cost (Est.) | Gross Margin | Prodigi / Printify Target |
|:-------:|:----------:|:------------:|:----------------------:|:------------:|:-------------------------:|
| `8x10`  | 8" × 10"   | **$49.00**   | ~$18.00                | **63%**      | Entry / Anchor Price      |
| `11x14` | 11" × 14"  | **$69.00**   | ~$24.00                | **65%**      | Nursery & Bedroom         |
| `16x20` | 16" × 20"  | **$99.00**   | ~$36.00                | **64%**      | **Hero / Best Seller**    |
| `24x36` | 24" × 36"  | **$149.00**  | ~$54.00                | **64%**      | Statement Living Room     |

### Curated Decorative Styles
- **Floral Botanical** (`botanical`): Organic biophilic eucalyptus fronds and leaf petals.
- **Modern Double Border** (`modern_border`): Bauhaus architectural hairlines and corner crosshairs.
- **Architectural Arch** (`arch`): Neoclassical vaulted frame with gilded keystone.
- **Art Deco Noir** (`art_deco`): Stepped chevron corner accents and Gatsby 1920s geometry.
- **Celestial Starlight** (`celestial`): Astrophotography starlight field and crescent moon motif.
- **Luxury Marble** (`luxury_marble`): Subtle Carrara stone veining and brass corner brackets.
- **Clean Minimal** (`minimal`): Pure archival white space; soundwave takes center stage.

### Signature Color Palettes
- `blush_rosegold` (`#FAF7F2` bg, `#B76E79` wave) — Primary brand theme
- `sage_cream` (`#F7F8F5` bg, `#738671` wave)
- `midnight_gold` (`#111111` bg, `#D4AF37` wave)
- `nordic_slate` (`#1F2428` bg, `#F0F2F5` wave)
- `warm_sand` (`#F8F5EE` bg, `#A67C52` wave)
- `dark_blue_white` (`#0D2142` bg, `#FFFFFF` wave)
- `white_silver` (`#FFFFFF` bg, `#808080` wave)

---

## 4. Frontend Route Structure & Design System

The storefront follows an intentional 3-stage luxury e-commerce funnel:

### 1. Landing Page (`/` -> `src/app/page.tsx`)
- **`Hero.tsx`**: Editorial headline (*"The Sound of the Moment You Never Want to Forget"*), trust badges, and CTA routing to the collection catalog.
- **`HowItWorks.tsx`**: 3-step numbered process diagram explaining customization, live studio preview, and automated home delivery.
- **`UseCases.tsx`**: High-emotion customer story modules (Wedding Vows, Baby Ultrasound Heartbeat, Memorial Voicemail) with interactive sample audio visualizers.
- **`Testimonials.tsx`**: Social proof showcasing 6 verified buyer reviews, product dimension tags, and 4.97/5 aggregate score.
- **`FAQ.tsx`**: Plain-English accordion covering archival paper (240+ GSM), audio formats (MP3/WAV/WebM up to 50MB), QR playback, and delivery.
- **`Footer.tsx`**: Brand mission, studio navigation, 6 quality promises with checkmarks, and social links (TikTok, Instagram, Pinterest).

### 2. Collection Catalog (`/shop` -> `src/app/shop/page.tsx`)
- Curated gallery of 8 preset aesthetic styles with category filters (*Botanical, Architectural, Abstract, Minimal, Vintage, Luxury*).
- 3D magnetic tilt cards (`MagneticFrame.tsx`) with dynamic fine-art acrylic sheen reflection.
- Interactive **Frame Proportion & Scale Guide** allowing users to preview 8×10, 11×14, 16×20, and 24×36 against a wall sill.
- Direct-to-studio deep links passing query parameters (e.g. `/product/custom?template=botanical&palette=sage_cream&size=16x20`).

### 3. Bespoke Customizer Studio (`/product/custom` -> `src/app/product/custom/page.tsx`)
- **`PortraitBuilder.tsx`**: Master interactive component.
  - Left pane: Sticky, true-to-aspect-ratio fine-art wooden frame preview (`WaveformCanvas.tsx`).
  - Right pane: 7-step customization sequence (Photo Upload -> Decorative Border -> Audio Record/Upload -> Palette -> Size -> Inscription -> Wave Elevation).
  - One-click checkout creating a Stripe checkout session with embedded metadata.
- Bottom section: Craftsmanship anatomy detailing 240+ GSM 100% cotton rag, shatterproof optical acrylic, and solid hardwood frames.

### 4. Order Status & Artwork Proof (`/order/[id]` -> `src/app/order/[id]/page.tsx`)
- Customer order tracker featuring a 5-step status progression bar (*Pending Payment -> Payment Confirmed -> Print Submitted -> Shipped -> Delivered*).
- High-fidelity visual proof rendering via `/api/orders/[id]/preview`.
- Carrier tracking integration and privacy-masked shipping addresses.

---

## 5. Backend & Fulfillment Pipeline

### Database Schema (`prisma/schema.prisma`)
Backed by PostgreSQL (Supabase) via Prisma ORM:
- **`Order`**: Tracks customer info, audio/photo assets, selected palette/size/decor, status, Stripe session ID, external partner order IDs, Resend email status, and Etsy bridge fields.
- **`FulfillmentLog`**: Audit trail of every step during automated processing.
- **`WebhookEvent`**: Idempotency log guaranteeing Stripe webhooks are processed exactly once.
- **`EmailEvent`**: Webhook analytics for email delivery, opens, clicks, or bounces.
- **`EtsyToken`**: OAuth credentials for external marketplace synchronization.

### Python Print Engine & Partner Dispatch
Located in `backend/`:
1. `fulfill.py`: The orchestrator called upon `checkout.session.completed`.
2. `waveform_generator.py`: Analyzes audio samples using RMS + peak algorithms, normalized across 80 rounded pill bars.
3. `print_engine.py`: Emits a production-ready 300 DPI CMYK PDF scaled to physical dimensions (e.g., 4800 × 6000 px for 16×20").
4. `print_partner.py`: Submits the generated PDF and customer shipping address to Printify or Prodigi REST APIs.
5. `email_service.py`: Generates and sends branded transactional HTML emails via Resend.

---

## 6. Business Strategy & Scaling Documentation

The root directory contains pre-researched, production-ready operational playbooks:

- **[`BUSINESS_PLAN.md`](BUSINESS_PLAN.md)**: 14-section comprehensive business playbook covering unit economics ($45 net margin on $99 orders), 90-day launch roadmap, zero-budget organic growth strategy, Meta/TikTok ad architectures, and customer LTV expansion.
- **[`CONTENT_SCRIPTS.md`](CONTENT_SCRIPTS.md)**: 10 copy-paste TikTok/Instagram video scripts, 5 paid ad scripts, 20 viral hooks, and caption templates.
- **[`OPERATING_CHECKLISTS.md`](OPERATING_CHECKLISTS.md)**: Daily 5-minute checklists, Sunday weekly reviews, monthly financial audits, VA hand-off protocol, and incident response playbooks.
- **[`docs/UGC_SCRIPTS_50.md`](docs/UGC_SCRIPTS_50.md)**: 50 creator-ready UGC scripts segmented across Weddings, New Born/Ultrasound, Memorials, Long Distance, Song Milestones, and Pet Keepsakes.

---

## 7. Local Development Setup

### Prerequisites
- **Node.js**: v18.18+ or v20+ (Node v22 tested)
- **Python**: 3.10+ (for backend PDF generation)
- **PostgreSQL Database**: Local or free Supabase instance

### Quick Start

1. **Clone & Install Dependencies**:
   ```bash
   git clone https://github.com/tsmith608/soundwave-store.git
   cd soundwave-store
   npm install
   ```

2. **Configure Environment Variables**:
   Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```
   *(Edit `.env.local` with your database and API keys. The app runs in mock/demo mode if external keys are omitted).*

3. **Initialize Database & Prisma**:
   ```bash
   npx prisma generate
   # If connecting to live PostgreSQL:
   # npx prisma db push
   ```

4. **Python Backend Setup (Optional for PDF generation testing)**:
   ```bash
   cd backend
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # Linux/Mac:
   # source venv/bin/activate
   pip install -r requirements.txt
   cd ..
   ```

5. **Start Next.js Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

6. **Verify Production Build**:
   ```bash
   npm run build
   ```

---

## 8. Deployment Guide (Vercel & Supabase)

### 1. Database (Supabase)
1. Create a free project at [supabase.com](https://supabase.com).
2. Under Project Settings -> Database, copy the pooled connection string (`Transaction` mode on port 6543 or 5432).
3. Run `npx prisma db push` to synchronize the schema.

### 2. Hosting (Vercel)
1. Import `tsmith608/soundwave-store` in the Vercel Dashboard.
2. In Vercel Project Settings -> Environment Variables, add:
   - `DATABASE_URL` & `DIRECT_URL`
   - `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
   - `PRINTIFY_API_KEY`, `PRINTIFY_SHOP_ID`
   - `NEXT_PUBLIC_APP_URL` (Set to your live domain e.g., `https://soundwaveart.com`)
3. Deploy!

### 3. Stripe Webhook Configuration
1. In your Stripe Dashboard, go to **Developers -> Webhooks**.
2. Add an endpoint pointing to: `https://yourdomain.com/api/webhooks/stripe`.
3. Select event: `checkout.session.completed`.
4. Copy the Signing Secret (`whsec_...`) and update `STRIPE_WEBHOOK_SECRET` on Vercel.

---

## 9. Context & Guidance for Claude / Future AI Collaborators

When picking up development or modifying this codebase:

1. **Brand Aesthetic Guardrails**:
   - Maintain the warm, editorial aesthetic: Ivory/Cream (`#FAF7F2`), Rose Gold (`#B76E79`), and Deep Charcoal (`#2D2A26`).
   - Do NOT introduce generic bright blue or purple SaaS buttons.
   - Typography strictly pairs `var(--font-serif)` (*Cormorant Garamond*) for headlines and `var(--font-sans)` (*Inter*) for interface copy.
2. **Client-Side Waveform Rendering**:
   - `WaveformCanvas.tsx` is performance-tuned. Live microphone recording uses `requestAnimationFrame` with an `AnalyserNode`. Static rendering decodes peak blocks into 80 normalized bins. Keep canvas allocations optimized.
3. **Fulfillment Decoupling**:
   - Webhooks should never synchronously block user response while waiting for a 300 DPI PDF render. The Next.js API delegates fulfillment asynchronously while returning HTTP 200 to Stripe immediately.
4. **No Direct Secret Exposure**:
   - Never commit `.env` or `.env.local`. All production secrets are managed strictly through environment variables.
