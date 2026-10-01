/**
 * 5×7 in package insert card (front + back) as a print-ready PDF with
 * 0.125 in bleed on every side (5.25×7.25 in pages). Text stays 0.3 in
 * inside the trim. Upload to any card printer (e.g. 16pt matte stock).
 *
 * The QR code on the back points at MARKETING_URL — re-render with the real
 * domain before printing:  MARKETING_URL=yourrealdomain.com npm run marketing:render -- print
 */
import path from "path";
import { qrPath } from "../../src/lib/art/qr";
import { BRAND, C, OUT, SITE, URL_TEXT, art, baseCss, bars, ensureDir, logo } from "./kit";

type Browser = Awaited<ReturnType<typeof import("../../src/lib/art/node").launch>>;

const SUPPORT = process.env.MARKETING_SUPPORT_EMAIL || `support@${URL_TEXT}`;
const HANDLE = process.env.MARKETING_HANDLE || "";
const CODE = process.env.MARKETING_INSERT_CODE || ""; // must exist in Admin → Discounts

const BLEED = 0.125;
const PW = 5 + BLEED * 2;
const PH = 7 + BLEED * 2;
const DPI = 96; // CSS px per inch

export function insertHtml(): string {
  const px = (inch: number) => inch * DPI;
  const safe = px(BLEED + 0.3);
  const qrSize = px(1.1);
  const qr = `<svg width="${qrSize}" height="${qrSize}" viewBox="0 0 ${qrSize} ${qrSize}">${qrPath(`${SITE}/?utm_source=insert&utm_medium=print&utm_campaign=gift_again`, 0, 0, qrSize, C.ink)}</svg>`;
  const front = `
  <section class="pg" style="background:${C.night};color:${C.nightInk}">
    <div style="position:absolute;inset:0;opacity:.95">${art({ design: "night-of", qr: false, widthIn: PW, heightIn: PH, fields: { names: "", date: "2025-06-14", title: "" } })}</div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:45%;background:linear-gradient(0deg,${C.night} 55%,rgba(15,22,39,0))"></div>
    <div style="position:absolute;left:${safe}px;right:${safe}px;top:${safe}px">${logo(15, C.nightInk)}</div>
    <div style="position:absolute;left:${safe}px;right:${safe}px;bottom:${safe}px;padding:14px 0 0">
      <h1 class="display" style="font-size:46px;line-height:.9">Thank you for trusting us with <span class="accent">it.</span></h1>
      <p class="ui" style="font-size:11.5px;line-height:1.5;margin-top:12px;opacity:.85;font-weight:500">A recording like yours is never just a file. We hope it sounds as good on your wall as it did the day it happened.</p>
    </div>
  </section>`;
  const back = `
  <section class="pg" style="background:${C.paper};color:${C.ink}">
    <div style="position:absolute;left:${safe}px;right:${safe}px;top:${safe}px">
      <div class="meta" style="font-size:9px;color:${C.soft}">Scan it · hear it again</div>
      <h2 class="display" style="font-size:30px;margin-top:8px">The code on your print plays your <span class="accent">recording.</span></h2>
      <p class="ui" style="font-size:10.5px;line-height:1.5;margin-top:8px;font-weight:500">Point any phone camera at it. The link is private, and we keep the recording for as long as we&rsquo;re in business. Want it removed? Email us and it&rsquo;s gone.</p>
      <div style="margin-top:16px">${bars("insert", 64, px(5) - 2 * (safe - px(BLEED)), 34, C.ink, 0.45)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px" class="ui">
        <div><div class="meta" style="font-size:8.5px;color:${C.soft}">Care</div><p style="font-size:10px;line-height:1.5;margin-top:4px">Hang out of direct sunlight. Dust with a soft dry cloth; no sprays on the glazing.</p></div>
        <div><div class="meta" style="font-size:8.5px;color:${C.soft}">Something wrong?</div><p style="font-size:10px;line-height:1.5;margin-top:4px">Damaged or our mistake? Tell us within 30 days for a reprint or refund. ${SUPPORT}</p></div>
      </div>
      <div style="margin-top:22px;padding:14px 16px;background:${C.paper2};border:1.5px solid ${C.ink}">
        <div class="meta" style="font-size:8.5px;color:${C.soft}">How yours was made</div>
        <p class="accent" style="font-size:19px;line-height:1.15;margin-top:6px">We measured how loud your recording was from its first second to its last — that&rsquo;s the shape on your wall. No two are alike.</p>
      </div>
    </div>
    <div style="position:absolute;left:${safe}px;right:${safe}px;bottom:${safe}px;display:flex;gap:16px;align-items:flex-end;border-top:1.5px solid ${C.ink};padding-top:14px">
      <div style="padding:6px;background:#fff;border:1.5px solid ${C.ink}">${qr}</div>
      <div style="flex:1">
        <div class="display" style="font-size:22px">Know someone with a voicemail they can&rsquo;t <span class="accent">delete?</span></div>
        <p class="ui" style="font-size:10px;line-height:1.45;margin-top:6px;font-weight:500">${CODE ? `Use <b>${CODE}</b> on their gift. ` : ""}${URL_TEXT}${HANDLE ? ` · ${HANDLE}` : ""}</p>
      </div>
    </div>
    <div class="meta" style="position:absolute;right:${safe}px;top:${safe}px;font-size:8px;color:${C.soft}">${BRAND}</div>
  </section>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss()}
  @page{size:${PW}in ${PH}in;margin:0}
  html,body{overflow:visible}
  .pg{position:relative;width:${PW}in;height:${PH}in;overflow:hidden;page-break-after:always}
  .pg svg{display:block}
  </style></head><body>${front}${back}</body></html>`;
}

export async function renderPrint(browser: Browser) {
  const dir = path.join(OUT, "print");
  ensureDir(dir);
  const page = await browser.newPage();
  await page.setContent(insertHtml(), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const pdf = path.join(dir, "insert-card-5x7-bleed.pdf");
  await page.pdf({ path: pdf, width: `${PW}in`, height: `${PH}in`, printBackground: true, preferCSSPageSize: true });
  // Preview PNGs (front/back side by side) for review and the contact sheet.
  await page.setViewportSize({ width: Math.round(PW * DPI), height: Math.round(PH * DPI * 2) });
  await page.screenshot({ path: path.join(dir, "insert-card-preview.png"), fullPage: true, scale: "device" });
  await page.close();
  console.log("print", path.relative(process.cwd(), pdf));
}
