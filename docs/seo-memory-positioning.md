# SEO — Memory-First Positioning

**Date:** 28 Sep 2026.
**Supersedes:** the song-led parts of `docs/positioning.md` → SEO.

**New core phrase:** *keepsake wall art made from the sound of your own recordings and videos.*

"Sound wave art" remains the category term people search for, so we keep it. We move the *modifiers* from songs to memories: voicemail, voice, vows, video, heartbeat, pet.

## 1. Why move away from song keywords

- **Legal/brand risk.** Pages ranking for "[song title] sound wave art" or "first dance song print" invite customers to upload commercial recordings. We don't want to be positioned as a song-art shop (see `docs/memory-audio-pivot-audit.md`).
- **Crowded and commoditised.** Song-wave prints are the default Etsy offer. Our two designs (the real moon for a date; a botanical grown from the recording) are differentiated around *personal* sound.
- **Better intent.** "Voicemail keepsake", "save dad's voicemail" and "wedding video keepsake" come from people holding an irreplaceable recording. That is exactly our customer.

We don't have keyword-volume tools in this environment. The priorities below come from query intent and the competitor research in `docs/competitor-research-2026.md`, not from measured volumes. Check them in Google Search Console once the site is live.

## 2. Page map (implemented)

| URL | Primary intent | Title (live) | Status |
|---|---|---|---|
| `/` | sound wave art from your recordings | "SoundWave Art — Keepsake wall art from your own recordings and videos" | Rewritten |
| `/wedding-vows-art` | wedding vows art, wedding video keepsake | "Wedding Vows & First Dance Keepsake Art — From Your Wedding Video" | **New URL** (was `/wedding-song-art`; permanent 308 redirect in `next.config.ts`) |
| `/voicemail-memorial-art` | voicemail memorial gift, keep a loved one's voice | "Voicemail Memorial Art — Keep Their Voice" | Copy updated (romantic world) |
| `/how-to-save-a-voicemail` | how to save a voicemail iPhone/Android | "How to Save a Voicemail on iPhone or Android (Before It's Deleted)" | Guide; restyled; CTA to Herbarium keepsake |
| `/anniversary-sound-wave-gift` | anniversary sound wave gift, paper anniversary | "Anniversary Sound Wave Gift — Your Voice, Vows or Video as Art" | Rewritten memory-first |
| `/pet-memorial-sound-art` | pet memorial sound art, dog bark print | "Pet Memorial Sound Art — Their Bark or Purr as a Print" | Examples switched to voice/pet recordings |
| `/designs` | the product (The Night Of, Herbarium) | "The Art — The Night Of & Herbarium" | Rewritten |
| `/gifts/first-baby-heartbeat-soundwave-art` | baby heartbeat art, ultrasound keepsake | "Baby Heartbeat Art — From Your Scan Video" | Rewritten on the intent template (same URL) |
| `/gifts/baby-first-laugh-soundwave-art` | baby first laugh keepsake | "Baby's First Laugh Art — From a Phone Video" | Rewritten (same URL) |
| `/gifts/proposal-audio-soundwave-art` | proposal keepsake, engagement gift | "Proposal Keepsake Art — The 'Yes' From Your Video" | Rewritten (same URL) |
| other `/gifts/*`, `/gifts`, `/shop` | — | — | **Removed**; 308 redirects to the matching page (`next.config.ts`) |
| `/terms`, `/privacy` | — | — | New |

**Canonical consolidation:** `/gifts/first-dance-song-soundwave-art` and `/gifts/wedding-vow-soundwave-art` now canonicalise to `/wedding-vows-art`. The sitemap lists `/wedding-vows-art`, not the old URL.

## 3. Copy rules for search pages

1. **Lead with the recording, not the song.** "Your vows, exactly as they sounded that day", not "Your first dance song".
2. **Songs are context only.** Allowed: "if a song is part of the story, add its title — it's printed as a small line, and your code can open it." Never: "upload your song", "any song", "[track] sound wave".
3. **Say how video works in one line** on every page: "Upload the video; we use its sound, not the footage."
4. **No fabricated proof.** Examples are labelled *demo recordings*. No invented reviews or star ratings in JSON-LD.
5. **Each page is a distinct document.** Different examples, how-to steps, considerations and FAQs (`IntentPage` template), to stay clear of doorway/scaled-content policies.
6. **FAQ JSON-LD** stays on intent pages (built from their real FAQs).

## 4. Follow-ups (not done in this pass)

- **Done (28 Sep):** the song-led `/gifts/*` pSEO pages were removed or rewritten (see the table above). `src/lib/pseo` is kept only because an old test suite covers it; it is marked deprecated.
- **New pages worth writing next** (in priority order): "wedding video keepsake" (or fold into `/wedding-vows-art`); "baby's first laugh art"; "grandparent voice recording gift"; "how to get audio from a video on iPhone" (a how-to that feeds the studio).
- **OG images:** `public/og.jpg` is regenerated from the new samples. Per-page OG images for intent pages would help social sharing.
- **Search Console:** after deploy, request re-indexing of `/` and `/wedding-vows-art`, and watch the 308 from `/wedding-song-art`.
