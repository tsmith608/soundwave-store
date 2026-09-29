# Video Upload Support

**Status: implemented** in `src/components/studio/useMemoryUpload.ts` and used by the studio (`src/components/studio/Studio.tsx`, Memory step).

## What the customer can upload

| Kind | Formats | Notes |
|---|---|---|
| Video | MP4, MOV, M4V, WebM, 3GP | iPhone camera roll (`.mov`, `.mp4`), Android (`.mp4`), saved Snapchat memories (`.mp4`), screen recordings |
| Audio | M4A, MP3, WAV, AAC, WebM, OGG, FLAC | iPhone voice memos (`.m4a`), exported voicemails, WhatsApp voice notes once saved to Files |
| Record now | In-browser recording (MediaRecorder) | "Record a voice note now" button |

Limits: **400 MB** file size, **3 minutes** duration (owner decision, 28 Sep 2026). There is no minimum beyond "a second or two".

## How it works (the footage never leaves the device)

1. **Read (in the browser).** The file is checked by extension and MIME type. Duration is probed with a hidden `<audio>`/`<video>` element (`probeDuration`), so long files are rejected before decoding.
2. **Extract (in the browser).** `decodePeaksFromBlob` (`src/lib/art/peaks.ts`) decodes the soundtrack with the Web Audio API. That produces:
   - the loudness envelope (the peaks that shape the artwork),
   - the duration,
   - a raw loudness level used to detect silence.
3. **Upload the sound only**, straight to private object storage through a short-lived signed URL (`POST /api/uploads` → `PUT` → `POST /api/uploads/:id/complete`). The server then checks the stored size and sniffs the file's real type before accepting it.
   - For **videos**, and for any audio file over 10 MB, the decoded sound is re-encoded as a mono 22 kHz WAV (`blobToWav`, about 8 MB for 3 minutes), and only that is uploaded.
   - Small MP3/WAV/WebM/M4A files are sent unchanged. Every stored recording is therefore at most about 10 MB, so 1 TB of storage holds roughly 100,000 recordings.
   - The server accepts at most 12 MB of audio (`src/lib/server/media.ts`).
4. **Ready.** The studio shows the source ("Video (sound only)", "Voice recording" or "Audio"), the file name and the length, and the preview redraws from the real recording.

Only the sound is stored (bucket prefix `uploads/`, random keys). **No video frames are uploaded or stored.**

## States and error messages

`useMemoryUpload` exposes `idle → reading → extracting → uploading → ready`, or `error` with a code. Each error has a specific, plain-English message and a way forward:

| Code | When | Message (abridged) |
|---|---|---|
| `unsupported` | Not audio/video by type or extension | "That file type isn't supported. Upload a video (MP4, MOV, M4V) or audio (M4A, MP3, WAV, AAC)." |
| `too_large` | Over 400 MB | "Trim it to the moment you want and try again." |
| `too_long` | Over 3 minutes (probe or decode) | "That recording is 4:12 long. Please trim it to under 3 minutes." |
| `no_audio` | The decoder can't find a readable soundtrack (no audio track, or a codec the browser can't open), **or** the soundtrack is silent (max RMS < 0.002) | "We couldn't find a soundtrack we can read in this video… try saving it again from your camera roll, or upload an audio file." / "This file seems to be silent. Does the video have sound?" |
| `unreadable` | Corrupt file, decode failure, or under ~1 s | "Something went wrong preparing your recording." / "That recording is too short." |
| `network` | Upload request failed | "The upload didn't go through — check your connection and try again." (with a **Try again** button that reuses the prepared audio) |
| `server` | The server rejected it (type, size or content check) | The server's message |

The error box is `role="alert"`, so screen readers announce it.

## Verified (28 Sep 2026, Playwright/Chromium against `next dev`)

| File | Result |
|---|---|
| `silent.mp4` (H.264, **no audio track**) | `no_audio` error shown ✓ |
| `memory.webm` (VP8 + Opus, 6 s voice) | Ready → peaks from the real sound → order created with those peaks ✓ |
| `memory.mp4` / `memory.mov` (H.264 + **AAC**) | `no_audio` in Playwright's Chromium only. That build has no proprietary codecs, so it can't decode AAC. Chrome, Edge, Safari and Firefox on macOS/iOS/Windows/Android all ship AAC decoding, so these files work for customers. **Please test one real iPhone video on a real phone before launch.** |

## Known limitations and follow-ups

- **Codec coverage depends on the customer's browser.** HEVC audio-only is rare; the risk is Linux desktop browsers without AAC (a tiny share). The error message tells the customer to upload an audio file instead.
- **Videos are decoded in memory.** The 3-minute cap keeps this manageable on older phones.
- **No trimming UI.** Customers trim in their Photos app. A simple start/end selector is the obvious next feature.
- **No server-side transcoding.** This is by design (no ffmpeg in production, footage stays on the device).
- **Upload retention:** the worker applies `src/lib/retention.ts` every 10 minutes; takedowns via admin or `npm run uploads:remove -- <order> --apply`.
