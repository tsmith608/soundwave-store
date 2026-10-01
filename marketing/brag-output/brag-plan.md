# /brag plan: Afterhum launch video

Made with the /brag skill ([latent-spaces/brag](https://github.com/latent-spaces/brag), brag-slim mode).
1920×1080, 30 fps, 21.5 s. Tone: **polished** (serious, elegant, restrained). This is a grief-and-love product, so it gets long holds and soft fades, and the humour is left out.

## Inspection answers

- **What is it?** Afterhum turns the sound from your own recordings and videos (a voicemail, wedding vows, a baby's heartbeat) into keepsake wall art.
- **Who is it for?** Anyone with a recording they can't delete, and people looking for a gift that means something.
- **What sets it apart?**
  - The art is drawn from the recording itself: every Herbarium leaf is a moment of loudness.
  - The Night Of shows the real moon for your date.
  - A code on the print plays the recording again.
  - We use the sound, not the footage.
- **Most impressive claim:** "Every leaf is a moment of the recording." Second: the moon is true to the date.
- **Visual hook:** a voicemail playing, then its waveform growing into a plant.
- **Real UI/flow to show:** the studio. You type a name and the print preview updates live ("The preview is exactly what we print"), then add to cart.
- **Tone:** polished.
- **Share caption:** see `share-copy.txt`.

## Angle

Start from the moment people actually have: a saved voicemail they can't delete. Show the sound becoming the art, then show how simple it is to make, then the moon, then the code that plays it back. End on the brand line.

## Visual identity (from the site's source)

- **Colours:** the site's colour worlds.
  - Paper `#F2EDE3`, ink `#151412`
  - Blush `#ECD3CD` / wine `#5A1E2B`
  - Film `#F1D9A5`
  - Night `#0F1627` / `#E8E6DF`, moon `#EFE6D0`
  - Botanical `#DFE6CF` / `#213520`
- **Fonts:** Bricolage Grotesque 800 for headlines, Instrument Serif italic for accent words, IBM Plex Mono for labels, Inter for the UI.
- **Real material:** prints rendered by the production art engine (`src/lib/art`), the same code that makes the print files. The studio panel uses the site's real copy and the new soft-pill styling.
- **Honesty:** a corner label reads "Demo · illustrative names". There are no invented reviews, numbers or customers.

## Storyboard

| # | Time | World | On screen | Text (read time) |
|---|---|---|---|---|
| 1 Hook | 0.0–3.4 | Blush | A voicemail phone ("Dad · Mar 11, 2021") plays; its progress bar runs | "Don't delete that *voicemail.*" (on screen by 0.4s, held 3s) |
| 2 Reveal | 3.4–7.6 | Film | Waveform bars draw in, dissolve, and a framed Herbarium print grows root to tip | "Turn a moment you can *hear* into art you can *keep.*" (3.6s) |
| 3 Product in use | 7.6–13.0 | Paper | The studio: Details step active. "Walter James Brennan" is typed letter by letter and the preview updates with each word. A cursor clicks "Add to cart · $99", then an "Added" toast | "Make it *yours.*" plus "The preview is exactly what we print." (4.5s) |
| 4 Highlight | 13.0–16.8 | Night | A Night Of print; the date ticks from 1 to 12 Oct 2019 and the moon phase changes with it, landing on the full moon | "The moon, exactly as it was *that night.*" (3.4s) |
| 5 Outro | 16.8–21.5 | Paper | First a phone playing the recording from a print: "Scan it. Hear it *again.*" Then the end card: the Afterhum wordmark, "What stays after the sound.", and a "Make yours" pill | 1.8s + 2.3s |

Transitions dip through paper: the old scene fades out, then the new one fades in, so busy layouts never double-expose.

## Sound

The soundtrack is original and synthesised for this video, so there's no licence question:
- soft felt-piano chords in D major (Dmaj9, Bm11, Gmaj7, Em9, A-sus, Dmaj9) changing on the scene cuts;
- a warm pad underneath, and a small reverb.

The effects are in the same key and sit under the music:
- muted key ticks for the typing;
- a soft click on "Add to cart";
- a bell-like chime when the plant finishes growing, when the date lands, and on the logo.

There's a fade-in, and a fade-out under the end card.
