"""
Discreet (tone-on-tone) QR codes must still decode from a simulated phone photo.

Renders every sellable design x colourway with qrStyle="discreet" at 12x16,
degrades each image (blur, sensor noise, uneven lighting, rotation, JPEG) and
decodes with ZXing, the decoder family used by many Android scanners.
Run: python3 tests/test_qr_discreet.py   (needs: pip install zxing-cpp pillow numpy)
A physical test print scanned on real phones is still required before launch.
"""
import io, json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageFilter

try:
    import zxingcpp
except ImportError:
    print("SKIP: zxing-cpp not installed (pip install zxing-cpp)")
    sys.exit(0)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "https://example.com/l/Ab3xK9pQ2mZt7LwR"
out = tempfile.mkdtemp()
script = os.path.join(ROOT, "scripts", "_qr_discreet_render.ts")
with open(script, "w") as f:
    f.write(f"""
import {{ DESIGNS, renderArtwork, samplePeaks }} from "../src/lib/art";
import {{ embeddedFontCss, launch, svgToPng }} from "../src/lib/art/node";
(async () => {{
  const b = await launch(); const css = embeddedFontCss(); const list: string[] = [];
  for (const d of DESIGNS) for (const c of d.colorways) {{
    const svg = renderArtwork(d, d.sample, samplePeaks(d.sampleSeed, d.sampleKind), {{ widthIn: 12, heightIn: 16, colorwayId: c.id, showQr: true, qrStyle: "discreet", qrUrl: "{URL}", embedFontsCss: css }});
    const file = `{out}/${{d.id}}_${{c.id}}.png`; await svgToPng(b, svg, 12, 16, 1800, file); list.push(file);
  }}
  await b.close(); console.log(JSON.stringify(list));
}})();
""")
try:
    files = json.loads(subprocess.run(["npx", "tsx", script], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip().splitlines()[-1])
finally:
    os.remove(script)

rng = np.random.default_rng(1)
def phone(im, blur, noise, light):
    im = im.convert("RGB").filter(ImageFilter.GaussianBlur(blur))
    a = np.asarray(im).astype(float)
    h, w, _ = a.shape
    a = a * (1 - light * (np.mgrid[0:h, 0:w][1] / w))[..., None] + rng.normal(0, noise, a.shape)
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8")).rotate(3, fillcolor=(90, 90, 90))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=70); return Image.open(buf)

fails = []
for f in files:
    for cond in [(0.8, 4, 0.15), (1.4, 8, 0.3)]:
        if not any(r.text == URL for r in zxingcpp.read_barcodes(phone(Image.open(f), *cond))):
            fails.append((os.path.basename(f), cond))
total = len(files) * 2
print(f"Discreet QR: {total - len(fails)}/{total} decoded")
for x in fails: print("  FAIL", x)
sys.exit(1 if fails else 0)
