# Original User Request

## Initial Request — 2026-09-20T23:12:19Z

You are the Project Orchestrator for the SoundWave Art store restructuring project.

Working directory: `C:\Users\trent\WebProjects\soundwave-store`
Agent metadata directory: `C:\Users\trent\WebProjects\soundwave-store\.agents\orchestrator`
Original user request file: `C:\Users\trent\WebProjects\soundwave-store\ORIGINAL_REQUEST.md`
Integrity mode: development

Requirements:
### R1. Premium E-Commerce Architecture
Convert the site into a true multi-page Next.js store (e.g., Homepage, Shop, Product Detail Page). Implement smooth, elegant animations (subtle fade-ins, parallax, seamless page transitions) to achieve an "Awwwards-level" luxury feel.

### R2. Aesthetic Market Research
The agent team must research trending wall art and interior design aesthetics to determine 5-10 highly desirable visual themes (e.g., minimalist botanical, vintage grunge, luxury marble, abstract geometric). Record in `research_findings.md`.

### R3. Rich Customizer Templates
Update the `PortraitBuilder` UI and the Python fulfillment backend to support these new aesthetic themes as selectable "decorations/templates". Users should be able to browse these beautiful designs in the customizer and apply them to their soundwave/photo print.

Acceptance Criteria:
- Next.js application has multiple functioning routes (e.g., `/`, `/product/custom`).
- Programmatic checks (or E2E tests) confirm the presence of animation libraries (e.g., Framer Motion) and proper layout structure.
- An artifact (`research_findings.md`) is generated detailing the market research on the chosen wall art aesthetics.
- The customizer UI allows selection between at least 5 distinct aesthetic templates.
- The Python backend successfully generates a high-res PDF applying the newly researched decoration templates.

Instructions:
1. Maintain your `BRIEFING.md` and `progress.md` in your agent directory (`C:\Users\trent\WebProjects\soundwave-store\.agents\orchestrator\`).
2. Coordinate and dispatch specialist subagents as needed to research, implement, and verify all requirements.
3. Ensure all tests and acceptance criteria pass.
4. When finished, write a comprehensive handoff/completion report and message me with your victory claim and evidence.

## 2026-09-21T21:04:15Z

Execute the next sprint for the SoundWave Art print-on-demand platform, focusing on automated marketing and distribution infrastructure. This includes setting up a Programmatic SEO (pSEO) engine for occasion-based gifts, beginning the Etsy API integration for automated order ingestion, configuring Resend webhooks for email tracking, and generating 50 UGC video scripts/shotlists.

Working directory: `C:\Users\trent\WebProjects\soundwave-store`
Integrity mode: development

## Requirements

### R1. Database Migration & Wipe (Supabase)
Migrate the local SQLite Prisma schema to PostgreSQL. Connect to the provided Supabase credentials in `.env.local`. **You must completely wipe/reset the existing database schema and data** in that Supabase instance before pushing the new SoundWave Art schema. 

### R2. Programmatic SEO (pSEO) Engine
Implement a Next.js dynamic routing structure to support occasion-based programmatic landing pages (e.g., `/gifts/[occasion]-soundwave-art`). Create the foundational data structures for at least two engines (e.g., Anniversary materials by year, and Memorial/Keepsake moments). The pages must include dynamic metadata, schema markup, and a clear CTA linking to the customizer.

### R3. Etsy API Integration Foundation
Begin the Etsy API v3 integration to enable zero-touch order fulfillment. Create the necessary backend routes/services to handle Etsy OAuth authentication and to poll/receive new orders. The system should map Etsy personalization fields to the SoundWave Art data model.

### R4. Resend Webhooks Configuration
Implement API endpoints to receive and process Resend webhooks for transactional email events (e.g., delivered, bounced, complained). Update the database schema and logic to track email delivery status for customer orders.

### R5. UGC Content Engine (July 2026 Style)
Generate a comprehensive markdown document containing 50 user-generated content (UGC) video scripts and shotlists designed for TikTok and Instagram Reels. The creative direction should follow the "July 2026" hyper-authentic, hook-driven aesthetic, focusing on emotional reveals, gift reactions, and the audio-to-art transformation process.

## Acceptance Criteria

### Infrastructure & Integration
- [ ] The Prisma schema is updated for PostgreSQL and `prisma db push` (or equivalent wipe/reset command) has successfully executed against the Supabase database.
- [ ] Next.js dynamic routes for pSEO are accessible and render the correct metadata and content based on URL parameters.
- [ ] Etsy API utility functions/routes exist for authenticating and fetching orders, failing gracefully if API keys are missing.
- [ ] A Resend webhook handler endpoint exists and correctly parses incoming event payloads, updating the relevant database records.
- [ ] The UGC script document contains exactly 50 distinct scripts with hooks, visual shotlists, and suggested audio.
- [ ] The existing Next.js build and test suite continue to pass without regression.

## 2026-09-21T21:14:23Z

CRITICAL REQUIREMENT UPDATE from the user regarding R5 (UGC Content Engine): 

The user has clarified that the creative direction should follow the "September 2026" style, NOT the "July 2026" style. Please ensure all 50 UGC video scripts and shotlists reflect the hyper-authentic, hook-driven aesthetic current to September 2026.


