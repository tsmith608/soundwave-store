# Art Direction — 2026

> **One-line brief:** sell finished art that happens to be made from someone's recording, not a template with a waveform in it.

Renders of every design discussed here are in [`docs/review/designs/`](review/designs/) ([contact sheet](review/designs/contact-sheet.jpg)). In development, the live internal gallery is at `/dev/designs`. The code is in `src/lib/art/`.

---

> **Update, 28 Sep 2026:** the owner chose to focus the company on **The Night Of** and **Herbarium**, the two highest-scoring and most distinctive designs. The other three are retired (still renderable). Herbarium gained a Stone colourway for memorial orders. QR codes default to a discreet tone-on-tone style (30% ink over paper, no caption); see owner-review §0.

## 1. Why the old product looked cheap

See [old print previews](review/old/old_print_previews.jpg) and the [old customizer](review/old/customizer.png).

1. **The ornament was the product, and there was almost none of it.** Each "style" was a hairline rectangle with tiny corner marks: 1–2% of the canvas carrying 100% of the claimed character ("Art Deco Noir", "Carrara Opulence"). When the ornament is that small, the eye reads it as template decoration, not design.
2. **No composition.** Every style was the same layout (centred waveform, centred caption, centred QR), so nothing created hierarchy, tension or a focal point. With the waveform replaced by any other graphic, it's a blank certificate.
3. **The waveform was treated as a logo.** A symmetrical block of bars dead centre. Buyers of personalised gifts have seen this exact image thousands of times on Etsy (see competitor-research-2026.md §3).
4. **Arbitrary combinations.** 9 borders × 11 palettes × 4 sizes ≈ 400 unreviewed combinations. Nobody had looked at most of them, and it showed (e.g. a black waveform box on cream paper).
5. **Weak typography.** A connected script (Great Vibes) for everything. 2026 stationery trends explicitly move away from script-and-serif pairings toward editorial, typography-led design ([Paperlust 2026](https://paperlust.co/blog/wedding-trends-2026/), [Every Little Something](https://everylittlesomething.com/2026-wedding-stationery-trends/)).
6. **Fake texture.** Digital noise printed onto real paper, added to pass an arbitrary 1 MB file-size check.
7. **"Luxury" signalled by adjectives and gold, not by craft.** Emoji icons next to "Awwwards-level" copy.

## 2. What premium looks like in 2026: research patterns

| Dimension | What the research shows | Source | How we apply it |
|---|---|---|---|
| **Typography** | Serif revival continues; expressive, high-contrast serifs with personality; "type as graphic"; editorial magazine grids | [Envato font trends](https://elements.envato.com/learn/font-trends), [Fontfabric 2026](https://www.fontfabric.com/blog/10-design-trends-shaping-the-visual-typographic-landscape-in-2026/), [It's Nice That](https://www.itsnicethat.com/features/forward-thinking-graphic-trends-2026-graphic-design-120126) | Instrument Serif (editorial display), Cormorant Garamond (classical italic), Inter (tracked capitals), IBM Plex Mono (credits, labels). No scripts. |
| **Stationery** | Typography-led layouts replacing decorative ones; inspiration from "luxury magazines and high-end restaurant menus" | [Paperlust](https://paperlust.co/blog/wedding-trends-2026/), [THE WED](https://thewed.com/magazine/major-wedding-stationery-signage-trends-for-2026) | Liner Notes and In Memoriam are pure typographic compositions |
| **Composition** | Asymmetric grids, generous whitespace, layouts that guide the eye | [Envato](https://elements.envato.com/learn/font-trends) | Liner Notes (flush-left grid), Herbarium (off-centre stem, label bottom-right) |
| **Shape** | Rounded arches and fluid forms everywhere in interiors | [Printful wall-art trends](https://www.printful.com/blog/wall-art-trends), [Urban Road](https://urbanroad.com/en-us/blogs/trends/2026-wall-art-trends-what-s-coming-next) | The Arch: one confident shape, not ornaments |
| **Colour** | Warm neutrals (Mocha Mousse family: taupe, terracotta, clay, caramel); Pantone 2026 is *Cloud Dancer*, a soft white; jewel tones and matte black as structural contrast | [Paperlust palettes](https://paperlust.co/blog/2026-wedding-color-palettes/), [Pantone](https://www.pantone.com/articles/press-releases/pantone-announces-color-of-the-year-2026-cloud-dancer) | Every design ships a warm light, a dark and one accent colourway; papers are off-whites (#F1ECE3, #F4EEE6, #EFE9DC), not pure white |
| **Texture** | Texture is the most agreed-on 2026 direction, but as *real* tactility (brushstrokes, torn paper, block print) | [Mixtiles](https://www.mixtiles.com/blog/wall-art-home-decor/wall-art-trends), [Urban Road](https://urbanroad.com/en-us/blogs/trends/2026-wall-art-trends-what-s-coming-next) | Texture comes from the **paper** (matte fine-art), not printed noise. Vector files keep edges crisp on textured stock. |
| **Illustration** | Botanical design is bolder, denser, more theatrical; line art for stationery | [Envato botanical](https://elements.envato.com/learn/botanical-design) | Herbarium: one authored plant with real mass, not tiny corner leaves |
| **Collected, not curated** | Walls mix eras and frames; art that "looks gathered over time" | [Urban Road](https://urbanroad.com/en-us/blogs/trends/2026-wall-art-trends-what-s-coming-next) | Designs that read as genres people already collect: record sleeve, specimen sheet, moon chart, memorial card |
| **Memorial** | Minimalism, clean lines, meaning kept personal rather than performative | [Funeral Program Site](https://www.funeralprogramsite.com/blogs/articles/top-design-trends-for-memorial-cards-crafting-a-lasting-tribute), [Oaktree](https://oaktreememorials.com/blogs/blog/memorial-jewelry-trends-for-2026-emerging-designs) | In Memoriam: no hearts or doves; the person's actual words |
| **Adjacent winners** | Star maps (The Night Sky: ~9.7k reviews on one product) and typographic lyric prints (Blim & Blum: 3,891 reviews) | competitor-research-2026.md | Date-true content (real moon phase), restraint, heavy paper |

## 3. The system

**Curated finished designs.** Each design fixes the layout, the typefaces, the proportions and three colourways. The customer chooses a design, types their words and adds a recording. They never choose ornaments, borders, fonts or arbitrary colours.

**One renderer.** `renderArtwork(design, fields, peaks, options)` returns an SVG document. The browser shows it inline, and the print pipeline sends the *same* SVG to Chromium to produce a vector PDF at exact physical size with embedded fonts. Text is fitted using real advance widths extracted from the actual font files (`scripts/build-font-metrics.mjs`), so long names shrink or wrap identically in preview and print.

**The waveform isn't always bars.** It can be:
- a run of flat-cut bars (Liner Notes)
- a knockout horizon inside an arch (The Arch)
- **leaf lengths** on a stem (Herbarium)
- a halo of rays around the moon (The Night Of)
- a single fine oscilloscope trace (In Memoriam)

**Print rules** (enforced in `designs/common.ts`):
- Minimum type 7 pt at the printed size.
- QR code at least 0.9" with a 4-module quiet zone, always dark-on-light (a light tile on dark colourways).
- Content kept inside an ~8.5% margin, so the frame lip and mount never crop it.

Verified: every design × colourway × size decodes with ZXing (45/45) at a deliberately coarse 100 px/in.

**Sizes.** Layouts are proportional (1200-unit wide canvas), tested at 8×10 (4:5), 12×16 and 18×24 (3:4).

## 4. Explorations and internal critique

Eleven composition systems were built and rendered with realistic content: 5 sold, 6 held back. Scores are internal only and are **never shown to customers**. Each is scored 1–5 on seven criteria (maximum 35).

**The test from the brief:** *"Would this still look like legitimate wall art if the waveform were replaced with another graphic?"*

| Design | Coherence | Emotion | Premium | Print | Legibility | Differentiation | Safe personalisation | **Total** | Art without the waveform? | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| **Herbarium** | 5 | 4 | 5 | 5 | 4 | 5 | 5 | **33** | Yes: a botanical specimen sheet | **Sell** |
| **In Memoriam** | 5 | 5 | 4 | 5 | 5 | 4 | 5 | **33** | Yes: a fine memorial card | **Sell** |
| **Liner Notes** | 5 | 3 | 4 | 5 | 5 | 4 | 5 | **31** | Yes: an editorial music poster | **Sell** |
| **The Night Of** | 5 | 5 | 4 | 5 | 4 | 4 | 4 | **31** | Yes: a moon-phase print | **Sell** |
| **The Arch** | 5 | 4 | 4 | 5 | 4 | 3 | 4 | **29** | Yes: an arch-shape stationery print | **Sell** (the only photo design) |
| Big Date | 4 | 3 | 4 | 5 | 5 | 4 | 3 | 28 | Yes: a Swiss type poster | Hold: overlaps Liner Notes; candidate for a second drop |
| Record | 4 | 3 | 3 | 5 | 4 | 1 | 4 | 24 | Somewhat | Reject: the vinyl-lyric format is saturated |
| Colour Field | 4 | 2 | 4 | 5 | 3 | 3 | 3 | 24 | Yes, very | Reject: the personal element disappears |
| Horizon | 3 | 3 | 3 | 4 | 4 | 2 | 4 | 23 | Yes | Reject: "soundwave mountains" is an Etsy trope |
| Score | 2 | 2 | 2 | 4 | 4 | 2 | 4 | 20 | No | Reject: novelty, looks unfinished |
| Photo Editorial | 3 | 3 | 2 | 2 | 4 | 1 | 2 | 17 | Only with a great photo | Reject: quality depends on customer photos |

**Why five, not three.** Competitor collections are organised by occasion (wedding song, memorial, baby, pet), and the brief's working hypothesis was 3–5. Five designs cover the occasions with real demand (positioning.md) without overlapping: Editorial for music, Keepsake for vows and photos, Botanical for gentle gifts and baby, Celestial for "the night we…", Memorial for voices. Hypothesis to test: if analytics show one design takes under 5% of selections after ~300 studio sessions, retire it.

**Why three colourways each, not a palette picker.** Every colourway was designed and reviewed for its own design. A universal palette list recreates the untested-combination problem.

## 5. Critique of the shipped five: known weaknesses

- **Liner Notes** can feel cool for sentimental buyers. Mitigated by the *Clay* colourway and the italic pull quote. Watch its share in the wedding occasion.
- **The Arch** with a photo is only as good as the photo. It shows an arch of tone with no photo, which is the recommended default. The copy advises "portrait, simple background".
- **Herbarium's** leaves need some dynamic range in the recording. Near-constant recordings (a hum, a steady heartbeat) produce even leaves, which still look fine but less alive. Consider exaggerating the contrast for flat inputs.
- **The Night Of** needs an exact date for the moon. If the text isn't an ISO date, it falls back to a full moon and hides the phase line. The studio uses a date picker for this design.
- **In Memoriam** is deliberately quiet, which can look sparse in a small thumbnail. The homepage uses it at mockup size, not as a thumbnail.

## 6. Rules for adding a design

1. Start from a *genre people already hang* (poster, specimen, map, card, chart), not from "a border".
2. It must pass the replace-the-waveform test.
3. One focal element, one accent colour, at most two typefaces from the system.
4. Design with real, awkward content: "Bartholomew-Maximilian & Anastasia-Josephine", a 60-character song title, an empty message.
5. Add it to `EXPLORATION_DESIGNS` first. Render the gallery (`npm run art:gallery`), critique it against the table above, and promote it to `DESIGNS` only if it scores at least 29 and doesn't overlap an existing design.
