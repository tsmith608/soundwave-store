# Using ChatGPT images for Afterhum promotions

ChatGPT's image model is good at **rooms, light, hands, gift wrap and seasonal scenes**. It's bad at **reproducing our artwork**: it redraws the leaves, garbles the small names and dates, and invents a QR code that doesn't scan. So we split the job:

- **ChatGPT makes the scene.** The frame holds a flat green placeholder.
- **Our script puts the real print in.** `scripts/marketing/composite.py` finds the green, warps the exact print into it in perspective, keeps the room's lighting, and leaves anything in front of the frame (a plant, a hand) in front.

The result is a lifestyle photo where the product is pixel-accurate.

## The rules (so the ads stay honest)

1. **Never let AI draw the print.** Always composite the real file from `marketing/out/art/`.
2. **Show the right size.** Our prints are 8×10, 12×16 and 18×24 in. A 12×16 print over a sofa looks tiny in real life, so don't prompt a giant print above a sofa. Each prompt below states the size.
3. **Show the real product.**
   - The frame is a slim wood frame (black, natural or white) with an off-white mount.
   - There's no gold leaf, no canvas wrap and no float frame.
   - Confirm the exact frame look with your Prodigi samples and adjust the prompts if it differs.
4. **No fake customers.**
   - Don't generate "customers", reviews, unboxing reactions presented as real, or before/after stories.
   - Hands are fine. Faces are best avoided.
   - Keep the "Demo · illustrative names" label when names show.
5. **Label AI content where the platform asks.**
   - TikTok asks creators to label realistic AI-generated content.
   - Meta may add an "AI info" label.
   - Check each platform's current rules before you post. A photorealistic AI room is "realistic" content.
6. Once you have real photos of real prints, use those for ads first. Use AI scenes to fill gaps.

## Workflow

1. **Export the prints** (already done; re-run after design changes):
   `npx tsx scripts/marketing/export_art.ts` writes `marketing/out/art/<design>-<colourway>.png`.
2. **In ChatGPT**, paste one of the prompts below. Ask for the aspect ratio listed.
   - If the green isn't flat or has reflections, say: "Make the rectangle a perfectly flat, evenly lit solid #00FF00 with crisp edges, no glare."
   - Download the PNG.
3. **Composite:**
   ```bash
   python3 scripts/marketing/composite.py room.png marketing/out/art/herbarium-stone.png out.jpg
   ```
   Is the print a hair too small or large inside the opening? Add `--inset 2` (grow) or `--inset -2` (shrink).
   For a real photo with no green, pass the four corners yourself (top-left, top-right, bottom-right, bottom-left, in pixels; any image editor shows pixel coordinates when you hover):
   ```bash
   python3 scripts/marketing/composite.py photo.jpg ART.png out.jpg --corners 412,300 690,310 684,690 405,680
   ```
4. **Check at 100% zoom:** no green fringe, the print isn't stretched, and the light direction matches. Then post, or drop the image into a Canva or Figma template with our fonts.

The colourways to choose from:
- **The Night Of:** `night-of-midnight`, `night-of-dawn`, `night-of-plum`
- **Herbarium:** `herbarium-herbarium`, `herbarium-blush`, `herbarium-cyanotype`, `herbarium-stone`

## The frame sentence (paste into every prompt)

> …a slim **[black / natural oak / white]** wooden picture frame, portrait orientation, with a wide off-white mat. Inside the mat, the picture area is a perfectly flat, evenly lit, solid chroma-key green (#00FF00) rectangle with crisp straight edges and a 3:4 ratio. No glare, no reflections on it, nothing printed on it.

## Style sentence (paste at the end of every prompt)

> Natural window light, soft shadows, realistic 35mm photograph, warm neutral palette (warm paper white, deep wine, sage green, soft navy accents), uncluttered and calm, no text, no logos, no people's faces.

## Prompt library

Each prompt has an ID that the social calendar refers to, a suggested aspect ratio and a print size.

| ID | Use | Ratio | Prompt (then add the frame + style sentences) |
|---|---|---|---|
| AI-1 | Bedside, memorial | 4:5 | A quiet bedroom corner: a framed 8×10 photo-sized print leaning on a linen-covered nightstand next to a small ceramic lamp and a folded reading-glasses case. Early-morning light. |
| AI-2 | Hallway gallery | 4:5 | A hallway wall with a framed 12×16 print hanging at eye level beside a coat hook and a small wooden console with keys in a bowl. Late-afternoon light across the wall. |
| AI-3 | Living room shelf | 4:5 | A built-in shelf with books, a trailing pothos and a framed 12×16 print standing on the shelf, slightly angled. Soft daylight. |
| AI-4 | Above a sofa (large) | 4:5 | A calm living room with a framed 18×24 print centred above a low linen sofa. The print is realistically sized (about two hand-spans wide), not oversized. |
| AI-5 | Nursery | 4:5 | A soft nursery: a framed 12×16 print above a white crib, a knitted blanket over the rail, sage and blush tones. |
| AI-6 | Gift unwrapping (hands) | 4:5 | Two hands lifting a framed 12×16 print out of kraft tissue paper on a wooden table, ribbon and scissors nearby. Only hands and forearms visible. |
| AI-7 | Holiday mantel | 4:5 / 9:16 | A fireplace mantel decorated simply for the holidays (eucalyptus garland, two candles) with a framed 12×16 print leaning in the centre. Evening, warm lamp light. |
| AI-8 | Anniversary table | 4:5 | A small dinner table set for two with wine glasses and a single candle; a framed 8×10 print standing against the wall behind the table. Dusk light. |
| AI-9 | Phone + print flat lay | 1:1 | Top-down flat lay on warm linen: a smartphone showing a plain audio waveform (no text), a framed 8×10 print, a sprig of dried flowers and a handwritten card with no legible writing. |
| AI-10 | Desk / office | 4:5 | A tidy home-office desk with a framed 8×10 print standing beside a monitor, a coffee mug and a notebook. Morning light. |
| AI-11 | Vertical wall (Stories/Reels cover) | 9:16 | A tall, softly lit plaster wall with a framed 12×16 print hanging in the upper half and a small bench with a plant below. Leave the top fifth and bottom fifth of the image calm for text. |
| AI-12 | Pinterest room | 2:3 | A Scandinavian-style reading nook with an armchair, a throw and a framed 12×16 print on the wall above a small side table. |

**Backgrounds for text posts** (no frame needed, nothing to composite). Make these, then put our text on top in Canva or Figma:
- **AI-B1:** "A seamless sheet of warm handmade cotton paper, softly lit from the left, subtle fibres, no objects."
- **AI-B2:** "Deep navy night sky over a dark sea, faint stars, very calm, lots of empty space."
- **AI-B3:** "Pressed eucalyptus and fern leaves arranged loosely on cream paper, top-down, lots of empty space."

## Quick checklist before posting an AI scene

- [ ] The print came from `marketing/out/art/` (not drawn by AI)
- [ ] The size looks true to 8×10, 12×16 or 18×24
- [ ] The frame matches what customers actually get
- [ ] No fake people, reviews or customer claims
- [ ] Marked as AI-generated where the platform asks for it
- [ ] Checked at 100% for green fringes and stretching
