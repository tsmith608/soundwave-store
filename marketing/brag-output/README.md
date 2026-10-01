# Afterhum launch video (/brag)

Made with the [/brag](https://github.com/latent-spaces/brag) skill in brag-slim mode: 21.5 s, 1920×1080, 30 fps, polished tone.

- `brag.mp4`: the video, with an original synthesised soundtrack (no licensed music) and the poster baked in as frame 0
- `brag.jpg`: the poster (the Herbarium print fully grown)
- `share-copy.txt`: the caption
- `brag-plan.md`: the angle and storyboard

Names in the video are illustrative and labelled "Demo · illustrative names". There's no URL in it yet; add one in the post, or put it on the end card once the domain is bought.

## Re-render

```bash
npx tsx scripts/marketing/brag.ts --stills 1.5,7.2,12.4   # check stills (work/stills)
npx tsx scripts/marketing/brag.ts                          # frames → work/frames
python3 scripts/marketing/brag_audio.py                    # soundtrack → work/soundtrack.wav
# encode (ffmpeg from imageio_ffmpeg, or any ffmpeg); frame 216 is the poster
cp work/frames/0216.jpg brag.jpg && cp brag.jpg work/frames/0000.jpg
ffmpeg -framerate 30 -i work/frames/%04d.jpg -i work/soundtrack.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart brag.mp4
```

Run these from the repo root, except `cp` and `ffmpeg`, which run inside `marketing/brag-output/`.
