/** Contact sheet of every rendered asset: marketing/out/contact-sheet.jpg */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { BRAND, C, OUT, baseCss } from "./kit";

type Browser = Awaited<ReturnType<typeof import("../../src/lib/art/node").launch>>;

export async function renderSheet(browser: Browser) {
  const groups: [string, string[]][] = [
    ["Images", fs.existsSync(path.join(OUT, "images")) ? fs.readdirSync(path.join(OUT, "images")).filter((f) => f.endsWith(".png")).sort().map((f) => `images/${f}`) : []],
    ["Video posters (silent MP4s in video/)", fs.existsSync(path.join(OUT, "video")) ? fs.readdirSync(path.join(OUT, "video")).filter((f) => f.endsWith("-poster.jpg")).sort().map((f) => `video/${f}`) : []],
    ["Print", fs.existsSync(path.join(OUT, "print")) ? ["print/insert-card-preview.png"] : []],
  ];
  const cells = groups
    .filter(([, files]) => files.length)
    .map(([title, files]) => `<h2 class="meta" style="grid-column:1/-1;font-size:20px;margin-top:30px;color:${C.soft}">${title}</h2>` +
      files.map((f) => `<figure><img src="${f}"><figcaption class="meta">${path.basename(f).replace(/\.(png|jpg)$/, "")}</figcaption></figure>`).join(""))
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss()}
  html,body{overflow:visible;background:${C.paper}}
  body{padding:48px;width:2000px}
  .grid{display:grid;grid-template-columns:repeat(6,1fr);gap:22px;align-items:end}
  figure img{width:100%;display:block;border:1px solid rgba(0,0,0,.15)}
  figcaption{font-size:13px;margin-top:6px;color:${C.soft};text-transform:none}
  </style></head><body><h1 class="display" style="font-size:64px">${BRAND} — marketing kit</h1><div class="grid">${cells}</div></body></html>`;
  const tmp = path.join(OUT, ".sheet.html");
  fs.writeFileSync(tmp, html);
  const page = await browser.newPage({ viewport: { width: 2096, height: 1200 } });
  await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
  const out = path.join(OUT, "contact-sheet.jpg");
  await page.screenshot({ path: out, fullPage: true, type: "jpeg", quality: 85 });
  await page.close();
  fs.rmSync(tmp);
  console.log("sheet", path.relative(process.cwd(), out));
}
