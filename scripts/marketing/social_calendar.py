"""Two-month social calendar for Afterhum (8 weeks, launch week to the holiday cutoff).

    python3 scripts/marketing/social_calendar.py   # writes marketing/social/calendar.json + calendar.csv

Dates assume launch on Mon 12 Oct 2026. If launch moves, change START and every
date shifts with it. Holiday dates (Thanksgiving, Black Friday...) are fixed, so
re-check week 7 if you move launch by more than a few days.
"""
import csv
import json
import os
from datetime import date, timedelta

START = date(2026, 10, 12)  # a Monday
SITE = "https://DOMAIN"  # replace with the real domain
OUT = os.path.join("marketing", "social")

REELS = ["Instagram Reels", "TikTok", "YouTube Shorts"]
FEED = ["Instagram", "Facebook"]
STORY = ["Instagram Stories", "Facebook Stories"]
PIN = ["Pinterest"]

WEEKS = [
    ("Launch", "Introduce Afterhum and both designs. Every post explains what it is in one line."),
    ("Save the voicemail", "Useful, shareable voicemail content. The carousel is the save-and-send post of the season."),
    ("The moon on your date", "Night Of week. Comment-your-date gets people talking; replies become content."),
    ("Vows and anniversaries", "Weddings and the paper (first) anniversary. The scan-to-play code."),
    ("New parents", "Heartbeats, first laughs and the sounds that change fastest."),
    ("Gift guide", "Who it's for, shown in real-feeling rooms (ChatGPT scenes with the real print composited in)."),
    ("Thanksgiving: record them", "Encourage people to record family at the table. Black Friday without fake discounts."),
    ("Last call", "The holiday order-by date, said plainly and often."),
]

TAGS = {
    "voicemail": "#voicemail #grief #keepsake #personalizedgifts",
    "moon": "#moonphase #anniversarygift #thenightwemet #personalizedgifts",
    "wedding": "#weddingvows #paperanniversary #weddinggift #keepsake",
    "baby": "#newparents #babyheartbeat #nurseryart #keepsake",
    "gift": "#giftideas #meaningfulgifts #personalizedgifts #christmasgifts",
    "general": "#keepsake #wallart #personalizedgifts #soundart",
}

# (week, weekday 0=Mon, platforms, format, asset, hook, caption, cta, tags, notes)
POSTS = [
    # ── Week 1 · Launch
    (1, 0, REELS, "Vertical video", "out/video/vertical-herbarium.mp4", "This plant grew from a voicemail.",
     "This plant grew from a voicemail. Every leaf is a second of their voice, root to tip.\n\nAfterhum is open. Upload a voice memo, a saved voicemail or a video from your phone, and we turn its sound into a print you can keep.",
     "Link in bio", "voicemail", "Add a sound in the app if you want one; the file already has its own soft piano track."),
    (1, 1, PIN, "3 pins", "out/images/pin-01-voicemail-memorial.png · pin-05-save-voicemail.png · pin-02-wedding-vows.png", "Pinterest batch",
     "Use the titles and descriptions from marketing/README.md (Pinterest section). Pin-05 links to the how-to-save-a-voicemail page.",
     "Link each pin to its landing page", "", "Pinterest is slow to build: post 2–3 pins every week, every week."),
    (1, 2, FEED, "Carousel (3)", "out/images/carousel-how-1.png → carousel-how-3.png", "How it works, in three slides",
     "How it works, in three slides.\n1. Upload a memory: a voice memo, a saved voicemail, a wedding clip.\n2. Make it yours: The Night Of or Herbarium, names, a date, a short line.\n3. We print and frame it, and ship it free in the US.\n\nOnly the sound is used. Your video never leaves your phone.",
     "Link in bio", "general", ""),
    (1, 4, REELS, "Vertical video", "out/video/vertical-night-of.mp4", "What did the moon look like the night you met?",
     "What did the moon look like the night you met?\n\nThe Night Of draws the real moon for your date and rings it with the sound of your recording: your vows, a voice note, the video from that night.",
     "Link in bio", "moon", ""),
    (1, 5, ["Facebook", "YouTube", "LinkedIn"], "Landscape video", "brag-output/brag.mp4", "We're open.",
     "Still have their voicemail? Afterhum turns the sound of it into a print you can hang: every leaf drawn from their voice, with a quiet code that plays it again.",
     f"{SITE}/?utm_source=facebook&utm_medium=social&utm_campaign=launch&utm_content=launch-film", "general", "The 16:9 launch film. Pin it to the top of the Facebook page."),
    (1, 6, STORY, "Story + question sticker", "out/images/story-03-moon.png", "When did you meet?",
     "Add a question sticker: \"What date did you meet?\" Reply to answers in DMs with a screenshot of the moon from the studio preview.",
     "Link sticker → /create", "", "Answers become week 3 content (ask permission before sharing anyone's date publicly)."),

    # ── Week 2 · Save the voicemail
    (2, 0, FEED, "Carousel (4)", "out/images/carousel-voicemail-1.png → carousel-voicemail-4.png", "How to save a voicemail before it's gone",
     "Carriers delete saved voicemails, and a new phone or a cancelled line can wipe them for good. Here's how to keep a copy, on iPhone and Android.\n\nSave this, and send it to whoever needs it.",
     "Save + share", "voicemail", "The most useful post of the plan. Make it the first pinned post on the grid."),
    (2, 1, PIN, "2 pins + 1 scene", "out/images/pin-05-save-voicemail.png · pin-01-voicemail-memorial.png · AI-1 composite (herbarium-stone)", "Pinterest batch",
     "AI-1 is the bedside scene from chatgpt-image-guide.md with the real Herbarium Stone print composited in.",
     "Link to /how-to-save-a-voicemail and /voicemail-memorial-art", "", ""),
    (2, 2, REELS, "Vertical video", "out/video/video-01-voicemail-to-leaves.mp4", "Don't delete that voicemail.",
     "Don't delete that voicemail.\n\nSave it, upload it, and we'll grow it into a botanical print. Every leaf is a moment of their voice.",
     "Link in bio", "voicemail", "Names shown are illustrative; the video says so."),
    (2, 4, FEED, "Single image", "out/images/feed-02-voicemail.png", "Don't delete that voicemail.",
     "For the voicemail you play when you need to hear them. Save it, upload it, and we'll grow it into a print you can keep. There's a quiet code on the print that plays it again.",
     "Link in bio", "voicemail", ""),
    (2, 5, REELS, "To film (10–15 s)", "FILM: screen recording on a real iPhone", "How to save a voicemail on iPhone in 10 seconds",
     "How to save a voicemail on iPhone: Phone → Voicemail → tap the message → Share → Save to Files. That's it. Do it today; carriers delete them.",
     "Link in bio", "voicemail", "Screen-record a real voicemail from a friend (with their OK) or a test one you leave yourself. No product pitch; the profile does that."),
    (2, 6, STORY, "Story + poll", "out/images/ad-01-voice.png (or a plain colour story)", "Do you still have a voicemail you can't delete?",
     "Poll sticker: \"Do you still have a voicemail you can't delete?\" Yes / I wish I'd saved one. Next frame: link to the save-a-voicemail carousel.",
     "Link sticker → carousel post", "", ""),

    # ── Week 3 · The moon on your date
    (3, 0, FEED, "Single image (engagement)", "out/images/feed-09-comment-your-date.png", "Comment the date you met.",
     "Comment the date you met, and we'll reply with the moon from that night, exactly as it was.",
     "Comment", "moon", "Reply to every comment with a screenshot of the studio preview for that date. It takes about 30 seconds each, and it's the best engagement post in the plan."),
    (3, 1, PIN, "2 pins + 1 scene", "out/images/pin-04-anniversary-moon.png · AI-8 composite (night-of-midnight)", "Pinterest batch",
     "AI-8 is the anniversary dinner-table scene with The Night Of composited in.",
     "Link to /anniversary-sound-wave-gift", "", ""),
    (3, 2, REELS, "Vertical video", "out/video/video-02-moon-on-your-date.mp4", "What did the moon look like the night you met?",
     "The moon changes every night. Yours was exactly this one.\n\nThe Night Of: the real moon for your date, ringed by the sound of your recording.",
     "Link in bio", "moon", ""),
    (3, 4, FEED, "Single image", "out/images/feed-05-night-of.png", "The moon, exactly as it was that night.",
     "The moon, exactly as it was that night. Phase computed for your date, ringed by the sound of your recording. Midnight, Dawn or Plum Night; framed or print-only.",
     "Link in bio", "moon", ""),
    (3, 5, REELS, "To film (15–20 s)", "FILM: screen recording of the studio", "Replying to your dates",
     "You sent us your dates. Here's the moon from three of them.",
     "Link in bio", "moon", "Screen-record /create: type a commenter's date (with their OK) and show the preview update. Real UI, real moon."),
    (3, 6, STORY, "Story + link", "out/images/story-03-moon.png", "Find your moon",
     "Tell us your date. We'll show you.",
     "Link sticker → /create?occasion=night-we-met", "", ""),

    # ── Week 4 · Vows and anniversaries
    (4, 0, REELS, "Vertical video", "out/video/video-03-scan-it-hear-it.mp4", "Scan it. Hear it again.",
     "Scan it. Hear it again.\n\nEvery print can carry a small, tone-on-tone code that plays your recording from any phone camera. No app. Your vows, back in the room.",
     "Link in bio", "wedding", ""),
    (4, 1, PIN, "2 pins + 1 scene", "out/images/pin-02-wedding-vows.png · AI-12 composite (herbarium-herbarium)", "Pinterest batch",
     "", "Link to /wedding-vows-art", "", ""),
    (4, 2, FEED, "Single image", "out/images/feed-03-transformation.png", "From a clip on your phone to a print on your wall.",
     "From a clip on your phone to a print on your wall. 01 your video, 02 its sound, 03 your print. We use the sound, not the footage.",
     "Link in bio", "wedding", ""),
    (4, 4, FEED, "Lifestyle image", "AI-3 composite (night-of-dawn, natural frame)", "Your vows, on the shelf.",
     "Your vows from the wedding video, on the shelf where you'll see them every day.",
     "Link in bio", "wedding", "ChatGPT shelf scene with the real Dawn print composited in. Label as AI if the platform asks."),
    (4, 6, STORY, "Story", "out/images/story-02-wedding-video.png", "The first anniversary is paper.",
     "The first anniversary is traditionally paper. This one is archival paper, printed with your vows.",
     "Link sticker → /wedding-vows-art", "", ""),

    # ── Week 5 · New parents
    (5, 0, FEED, "Lifestyle image", "AI-5 composite (herbarium-blush, white frame)", "The first sound you heard of them.",
     "The first sound you heard of them. Upload the heartbeat from the scan video in your camera roll, and we grow it into a botanical print for the nursery.",
     "Link in bio", "baby", ""),
    (5, 1, PIN, "1 pin + 1 scene", "out/images/pin-03-baby-heartbeat.png · AI-5 composite", "Pinterest batch",
     "", "Link to /gifts/first-baby-heartbeat-soundwave-art", "", ""),
    (5, 2, REELS, "To film (15 s)", "FILM: text-on-screen over b-roll of your own phone", "Sounds to record before they're grown",
     "Sounds to record before they're grown: the first laugh, the made-up song, \"I love you\" said wrong, bedtime questions, the way they say your name.",
     "Link in bio", "baby", "No faces needed: film hands, a phone on a table, a voice-memo waveform. Use your own recordings or ask a friend."),
    (5, 4, FEED, "Single image", "out/images/feed-08-what-can-become-art.png", "What can become art?",
     "A saved voicemail, wedding vows, a Snapchat memory, a baby's laugh, a dog's bark, Grandma singing. If it's on your phone and it has sound, it can become a print.",
     "Link in bio", "general", ""),
    (5, 6, STORY, "Story", "out/images/story-04-heartbeat.png", "From the scan video in your camera roll.",
     "The first sound you heard of them.",
     "Link sticker → /create?occasion=baby", "", ""),

    # ── Week 6 · Gift guide
    (6, 0, FEED, "Carousel (4)", "out/images/feed-07-gift-guide.png + AI-2, AI-6, AI-10 composites", "Gifts made from a sound you share",
     "Gifts made from a sound you share.\nFor the anniversary: the moon from your night.\nFor the new parents: a heartbeat.\nFor the one who misses a voice: the voicemail they saved.",
     "Link in bio", "gift", "Slide 1 is the existing graphic; slides 2–4 are ChatGPT room scenes with real prints composited in."),
    (6, 1, PIN, "3 scenes", "AI-2, AI-7, AI-10 composites", "Pinterest batch",
     "Gift-guide pins. Title pattern: \"[Recipient] gift idea: [what it is]\".", "Link to /create", "", ""),
    (6, 2, REELS, "Repost best Reel", "Best performer from weeks 1–5", "(new hook in the first line of the caption)",
     "Repost your best-performing Reel with a new caption hook aimed at gifting: \"The gift for the person who has everything except this.\"",
     "Link in bio", "gift", "Reposting a winner beats a new mediocre post."),
    (6, 4, FEED, "Single image", "out/images/seasonal-holiday-cutoff.png", "Order by [date] for framed prints.",
     "Every print is made to order, so the holiday date is real: order framed prints by [DATE] for delivery before the 25th (US).",
     "Link in bio", "gift", "Only post once Prodigi confirms the cutoff. Re-render with MARKETING_CUTOFF=\"Dec X\"."),
    (6, 6, STORY, "Story", "out/images/story-05-record-them.png", "Record them this Thanksgiving.",
     "A heads-up for Thursday: put your phone on the table, open Voice Memos, and ask one question.",
     "No link needed", "", "Pure value. People screenshot this."),

    # ── Week 7 · Thanksgiving
    (7, 1, REELS, "To film (15–20 s)", "FILM: a phone on a dinner table, Voice Memos recording", "Do this at Thanksgiving",
     "Do this at Thanksgiving: set your phone on the table, hit record, and ask \"How did you two meet?\" You'll be so glad you have it.",
     "Link in bio", "general", "Film only hands and the table. If you use real family audio, get their OK."),
    (7, 3, STORY, "Story", "out/images/story-05-record-them.png", "Record them today.",
     "Happy Thanksgiving. Record them today.",
     "No link", "", "Thanksgiving Day (Thu 26 Nov). No selling today."),
    (7, 4, FEED, "Square image", "out/images/ad-01-voice.png", "Keep their voice where you can see it.",
     "Keep their voice where you can see it. Upload a saved voicemail or voice note, and we grow it into a botanical print you can frame.",
     "Link in bio", "gift", "Black Friday (27 Nov). Only mention an offer if you've actually set up a discount code in Admin → Discounts. Never show a fake \"was\" price."),
    (7, 5, REELS, "To film (20–30 s)", "FILM: you, talking to camera (or voice-over)", "Why I started Afterhum",
     "Small Business Saturday. Here's why Afterhum exists.",
     "Link in bio", "general", "Real founder story; it's the one thing no competitor can copy. Keep it under 30 seconds."),

    # ── Week 8 · Last call
    (8, 0, REELS, "Vertical video", "out/video/vertical-herbarium.mp4 or the best performer", "Last week for framed prints.",
     "Last call for the holidays: order framed prints by [DATE] for delivery before the 25th (US). Every one is made to order.",
     "Link in bio", "gift", "Cyber Monday (30 Nov)."),
    (8, 1, PIN, "Refresh", "Top 3 pins re-pinned to a \"Christmas gifts\" board", "Pinterest batch",
     "", "", "", ""),
    (8, 2, FEED, "Single image", "out/images/seasonal-holiday-cutoff.png", "Order by [date].",
     "One week left to order framed prints for Christmas delivery. Print-only orders ship faster.",
     "Link in bio", "gift", "Check print-only versus framed lead times with Prodigi before saying \"faster\"."),
    (8, 4, STORY, "Story + countdown sticker", "out/images/story-06-last-week.png", "Last week for framed prints.",
     "Add a countdown sticker to the cutoff date so followers get a reminder.",
     "Link sticker → /create", "", ""),
    (8, 6, STORY, "Story", "out/images/story-06-last-week.png", "Final days.",
     "Final days to order for the holidays.",
     "Link sticker → /create", "", "If the cutoff has passed, switch to: \"Too late for Christmas? It makes a beautiful New Year's gift.\""),
]


def main():
    rows = []
    for week, wd, platforms, fmt, asset, hook, caption, cta, tag, notes in POSTS:
        d = START + timedelta(weeks=week - 1, days=wd)
        theme, why = WEEKS[week - 1]
        link_note = cta
        rows.append({
            "date": d.isoformat(),
            "day": d.strftime("%a %d %b"),
            "week": week,
            "theme": theme,
            "platforms": platforms,
            "format": fmt,
            "asset": asset,
            "hook": hook,
            "caption": caption + (f"\n\n{TAGS[tag]}" if tag else ""),
            "cta": link_note,
            "notes": notes,
        })
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "calendar.json"), "w") as f:
        json.dump({"start": START.isoformat(), "weeks": [{"n": i + 1, "theme": t, "why": w} for i, (t, w) in enumerate(WEEKS)], "posts": rows}, f, indent=1, ensure_ascii=False)
    with open(os.path.join(OUT, "calendar.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Date", "Week", "Theme", "Platforms", "Format", "Asset", "Hook", "Caption", "CTA / link", "Notes"])
        for r in rows:
            w.writerow([r["date"], r["week"], r["theme"], ", ".join(r["platforms"]), r["format"], r["asset"], r["hook"], r["caption"], r["cta"], r["notes"]])
    print("posts", len(rows), "→", OUT)


if __name__ == "__main__":
    main()
