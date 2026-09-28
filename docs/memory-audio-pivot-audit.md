# Memory-Audio Pivot — Audit (before changes)

Audited at commit `2c04267`, 28 Sep 2026. There is no `CLAUDE.md` or `AGENTS.md` in the repo. `README.md` and `docs/owner-review.md` were read.

## 1. Current positioning

- **Homepage H1:** "Your song, your vows, a voice you love — made into art for the wall."
- **Site title:** "SoundWave Art — Your song, vows or a voice you love, as art for the wall".

Songs sit first in the promise, and several surfaces tell people to upload "the song". Nothing claims we fetch audio from Spotify or YouTube. **There is no URL-analysis code anywhere.** Artwork is only ever generated from a file the customer uploads or records. But the copy leans on song art, and the samples show commercial songs as the *source* of the artwork.

## 2. Problematic claims

"Implies commercial audio is the art source" is marked **⚠**. "Song as context only (acceptable)" is marked **✓**.

| Where | Text | Issue |
|---|---|---|
| `src/app/layout.tsx` (title and description) | "Your song, vows or a voice you love…", "Turn a first-dance song… into a finished art print" | ⚠ Song-first |
| `src/app/page.tsx` H1 | "Your song, your vows, a voice you love" | ⚠ Song-first |
| `src/app/page.tsx` examples + hero alt | "A first-dance song" · alt: "leaves are drawn from a first-dance song" | ⚠ |
| `src/lib/art/designs/herbarium.ts` sample | subtitle "“At Last”, Etta James"; message "**Pressed from the song we danced to.**" (explicitly called out in the brief) | ⚠ |
| `src/lib/art/designs/nightOf.ts` sample | title "At Last — Etta James"; `sampleKind: "song"` | ⚠ Commercial track shown as what you hear |
| `src/lib/catalog.ts` occasions | "First dance & wedding song" · prompt "**Upload the song (an MP3…)**" · "Your song, a voice note…" | ⚠ Directly instructs uploading commercial audio |
| `src/app/wedding-song-art/page.tsx` | H1 "The song you danced to…"; "Use the audio file if you have it — An MP3 or M4A of the song"; FAQ "How long can the song be?"; four examples using song titles; CTA "Make your wedding song print" | ⚠ Whole page is song-as-source |
| `src/app/anniversary-sound-wave-gift/page.tsx` | "Your song… Upload the track or a clip"; "make it from a song without asking them" | ⚠ |
| `src/components/FAQ.tsx` | "your first-dance song, vows from a wedding video…" | ⚠ Song first |
| `src/components/Footer.tsx` | "first-dance songs, vows, voicemails…" · link "Wedding song art" | ⚠ |
| `src/components/studio/Studio.tsx` | "Any length works — a 4-second voicemail or a whole song" | ⚠ |
| Wedding page FAQ | "Can the code play our song on Spotify? — The code plays the audio you upload…" | ✓ Accurate, but there is no way to point the QR at Spotify |
| `docs/content-strategy-q4-2026.md` | c02 "Our first dance, but make it a record sleeve" (retired design; song audio as hook) | ⚠ |
| Etsy integration (`api/etsy/orders`) | Personalisation question "Song title, artist name, or custom caption" | ✓ Metadata; left alone (separate channel) |

**Privacy claims to check.** The FAQ says "We never publish, share or use it for anything else, and we'll delete it on request."

What the code actually does:
- Uploads are written to `storage/uploads/` (local disk).
- There is **no automated deletion** and **no retention limit**.
- The listen page is public to anyone holding the unguessable token.

"Delete on request" is only true if the owner handles it manually. We'll keep that promise but say plainly that it's done by email, and flag automated retention in the owner review.

## 3. Relevant files

| Area | Files |
|---|---|
| Homepage | `src/app/page.tsx`, `components/FAQ.tsx`, `Testimonials.tsx`, `Footer.tsx`, `Navbar.tsx` |
| Designs page | `src/app/designs/page.tsx` |
| Intent pages | `src/components/IntentPage.tsx` + 4 pages + `how-to-save-a-voicemail` |
| Configurator | `src/components/studio/Studio.tsx`, `StudioFromParams.tsx`, `AudioRecorder.tsx` |
| Upload | `src/app/api/upload/route.ts`, `src/lib/audio.ts` (server validation, 50 MB, mp3/wav/webm/m4a by magic bytes) |
| Audio analysis | `src/lib/art/peaks.ts` (`decodePeaksFromBlob` = Web Audio decode → 400 RMS peaks; `blobToWav`) |
| Renderers | `src/lib/art/designs/nightOf.ts`, `herbarium.ts` (+ retired) |
| QR / link | `designs/common.ts` (`qrBlock`), `/l/[token]` page, `/api/listen/[token]` |
| Checkout | `src/app/api/checkout/route.ts` (curated path → `artworkSpec`) |
| SEO | `layout.tsx`, page `metadata`, `sitemap.ts`, `robots.ts` |
| Analytics | `src/lib/analytics.ts` (event names are content-neutral; no change needed) |

## 4. Upload capabilities today

- **Server** accepts MP3, WAV, WebM and M4A up to 50 MB, validated by magic bytes.
- **Client picker** accepts `audio/*`, `video/mp4`, `video/quicktime`, `.mp3 .wav .webm .m4a .mp4 .mov .aac`. Files up to 400 MB are accepted if they're video.
- **Video is already supported.** `Studio.handleAudio` decodes the blob with the browser's Web Audio `decodeAudioData`, which reads the audio track of MP4/MOV (H.264/AAC) in Chrome, Safari and Edge. If the container isn't directly accepted by the server, `blobToWav` re-encodes the decoded audio to 22.05 kHz mono WAV **in the browser**, so only audio is uploaded. The video frames never leave the device.
- **Gaps:**
  - M4V isn't listed in the picker.
  - No duration limit. A very long video decodes the whole track into memory, and WAV at 44 KB/s exceeds the 50 MB server limit after about 19 minutes.
  - The error messages are generic: they don't separate "no audio track", "unsupported codec", "corrupt" or "too long".
  - Firefox can't decode AAC inside MOV on some platforms.

## 5. Smallest safe implementation path

1. **Copy:** rewrite song-first language to memory-first on all surfaces in §2. Change samples to personal recordings (vows, voicemails, a first phone call). Keep "first dance" only as a *video of the moment*.
2. **Song as context:** an optional "Song behind the memory" field (title — artist), stored as metadata and printable as a small line. It is never used as the audio source.
3. **Listen link:** an optional public URL, validated (http/https only), stored in the spec. The printed QR keeps pointing to our short `/l/<token>` URL, which **redirects** to the customer's link when set, and otherwise plays their uploaded recording. The URL is never fetched server-side. Benefits: the printed code stays short and scannable, and the link can be fixed later without reprinting.
4. **Video:** add M4V; cap at 15 minutes of audio; classify decode failures into clear messages; say "we only use the sound" in the upload UI.
5. **Permission:** one checkbox, "I made this recording or have permission to use it", required at order time.
6. **Pages:** rename the wedding page to vows and first-dance *video*. `/wedding-song-art` issues a 301 to `/wedding-vows-art`, keeping "first dance" and "wedding video" relevance. Rewrite the anniversary copy.
7. **Herbarium integrity:** already true. Leaf *i* length = amplitude of the recording at position *i*/26 (smoothed RMS), ordered root → tip. The plain-English explanation matches the code.
