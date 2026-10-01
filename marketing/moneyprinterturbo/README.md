# MoneyPrinterTurbo pack (run on your own computer)

[MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) (MIT licence) turns a script into a narrated short video: voiceover, subtitles, music and footage. It can't run in the Claude workspace (its stock-footage and voice services are blocked there), but it runs fine on a laptop: 4+ CPU cores, 8 GB RAM, no GPU needed.

## What it's good for here (and what it isn't)

**Good:** narrated explainers, the kind of video that answers a question.
- "How to save a voicemail on iPhone"
- "What the code on the print does"
- "Questions to ask your grandparents"

Voice plus big subtitles keeps people watching, and these topics get searched on TikTok.

**Not good:** using it on autopilot with stock footage. Stock clips never show your product. Strangers in stock footage can read as customers, which you must not imply. And TikTok and Instagram push down near-duplicate, low-effort videos. Use it with **your own footage** and **the scripts below** (reviewed by you), not with topics the AI writes from scratch.

## Setup (about 20 minutes)

1. Install it by following the repo's README (Docker or Python), then open the web UI it starts.
2. **Script:** choose to write your own script, and paste one from below. You don't need an AI key for this. If you'd rather it draft scripts, it supports Claude and other models with your own API key, but always edit what it writes.
3. **Footage:** choose **local files** (your own materials), not Pexels. Upload:
   - `marketing/out/video/*.mp4` (product videos) and `marketing/out/daily/video/*.mp4` (daily series)
   - `marketing/out/art/*.png` (clean prints) and `marketing/out/images/*.png` (graphics)
   - any real phone footage you film: hands, a phone playing a voicemail, a print on your wall

   If you do use Pexels for b-roll (free, with an API key from pexels.com/api), stick to objects and places: phones, tables, windows. No people who could be mistaken for customers.
4. **Format:** 9:16 portrait, 30–45 seconds, subtitles on (bottom-centre, large).
5. **Voice:**
   - **Best:** record the script yourself in Voice Memos and use that audio. Real voices perform better for this product, and there's nothing to license.
   - **Built-in free voices:** they use Microsoft's online text-to-speech. Check that its terms cover commercial use before you post ads with it.
6. **Music:** keep it low, or off and add a sound in the TikTok app.
7. Watch every video before posting. Fix any subtitle that mishears a word ("Afterhum" especially).

## Scripts

Each is about 30–40 seconds read at a natural pace. Paste the script; the "Footage" line says which of your files to upload for it.

**1 · How to save a voicemail on iPhone**
> If there's a voicemail you'd never want to lose, save it today. Carriers can delete saved voicemails, and a new phone can wipe them. Open the Phone app and tap Voicemail. Tap the message, then the share button, the square with the arrow. Choose Save to Files. That's it: you now have an audio file you can back up. Keep two copies, one in the cloud and one on a computer. And if you'd ever like to see it on your wall, that's what we make at Afterhum.

Footage: a screen recording of your own iPhone doing this; `carousel-voicemail-2.png`, `video-01-voicemail-to-leaves.mp4`.

**2 · How to save a voicemail on Android**
> On Android, open the Phone app and go to the Voicemail tab. Tap the message, then the three-dot menu, then Share, and save it to Drive, Gmail or Files. On Samsung or carrier phones, look for Save or Export in your carrier's voicemail app. No save button at all? Play it on speaker and record it with another phone's voice memo app. However you do it, do it soon, and keep two copies.

Footage: an Android screen recording if you have one; `carousel-voicemail-3.png`, `pin-05-save-voicemail.png`.

**3 · What the code on the print does**
> Every Afterhum print can have a small code on it, printed tone-on-tone so it's barely there. Point any phone camera at it, and it plays the recording the print was made from: the voicemail, the vows, the laugh. No app. The link is private. And if you ever want the recording removed, we delete it, no questions asked.

Footage: `video-03-scan-it-hear-it.mp4`, `feed-06-scan-it.png`.

**4 · The Night Of**
> What did the moon look like the night you met? We can show you. The Night Of draws the real moon for any date (the phase, how much of it was lit) and rings it with the sound of your own recording. Your vows, a voice note, the video from that night. Choose Midnight, Dawn or Plum Night, framed or print-only.

Footage: `vertical-night-of.mp4`, a few `daily/video/*-moon.mp4`, `art/night-of-*.png`.

**5 · Herbarium**
> This plant grew from a voicemail. Every leaf is a moment of the recording, and its length is how loud that second was, root to tip. So no two are alike, because no two voices are. Upload a voicemail, a voice note or a video, and we grow yours. Four colourways, framed or print-only.

Footage: `vertical-herbarium.mp4`, `daily/video/*-grow.mp4`, `art/herbarium-*.png`.

**6 · Questions to ask your grandparents**
> Next time you're with your grandparents, put your phone on the table and press record. Then ask one question. How did you two meet? What was your first job? What song takes you right back? What do you want us to remember? You'll be so glad you have it. Their voices are the thing you can't get back.

Footage: your own phone on a table with Voice Memos running (hands only); `story-05-record-them.png`.

**7 · How to record better audio on your phone**
> Want a recording that sounds good years from now? Get close: an arm's length or less. Find the quietest room, away from the fridge and the TV. Turn on airplane mode so a notification doesn't cut in. Start recording a few seconds early. And keep the original file, not a copy sent through a messaging app, which squashes the sound.

Footage: your own phone; `daily/video/*-list.mp4`.

**8 · The first anniversary is paper**
> The traditional first-anniversary gift is paper. So here's an idea: your vows, printed on archival paper. We take the sound of your vows from the wedding video (just the sound, never the footage) and make it into a print with the real moon from your wedding night. Framed or print-only.

Footage: `story-02-wedding-video.png`, `art/night-of-dawn.png`, `video-02-moon-on-your-date.mp4`.

**9 · What can become art?**
> If it's on your phone and it has sound, it can become a print. A saved voicemail. Your wedding vows. A Snapchat memory. A baby's first laugh. Your dog barking at the door. Grandma singing at Christmas. Upload it, and we use only the sound to make one-of-a-kind art, made to order.

Footage: `feed-08-what-can-become-art.png`, `video-01…03`, `art/*.png`.

**10 · Is my recording private?**
> People ask us what happens to their recordings. When you upload a video, your phone pulls out the sound, and only the sound is uploaded. The footage never leaves your phone. If you add the code to your print, the recording plays from a private link. And if you ever want it removed, email us and it's gone.

Footage: `feed-03-transformation.png`, `vertical-herbarium.mp4`.

**11 · A gift for someone who's grieving**
> If someone you love has lost someone, the best gifts are small and specific. A meal. A card that says their person's name. Your time. And if they have a voicemail or a video of that person, a keepsake made from their voice can mean more than anything you could buy. Go gently, and ask first.

Footage: `story-01-dads-voicemail.png` (illustrative names), `art/herbarium-stone.png`, AI-1 bedside scene.

**12 · Holiday order-by date** (only once Prodigi confirms it)
> Every Afterhum print is made to order, so the holiday date is real: order framed prints by [DATE] for delivery before Christmas in the US. Upload a recording, choose The Night Of or Herbarium, add names and a date, and we'll print it and ship it to you.

Footage: `seasonal-holiday-cutoff.png`, `story-06-last-week.png`, `brag-output/brag.mp4`.

## Before posting anything it makes

- [ ] Watched it all the way through; subtitles are right
- [ ] Footage is yours or object/place stock (no stand-in "customers")
- [ ] Every claim matches the site (prices from $35, framed from $69, US shipping, 3-minute uploads)
- [ ] Not near-identical to a video you posted in the last two weeks
