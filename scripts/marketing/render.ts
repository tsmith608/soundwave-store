/**
 * Renders the marketing kit into marketing/out/.
 *   npm run marketing:render            # everything
 *   npm run marketing:render -- stills  # just images (also: video, print, sheet)
 * Re-brand:  MARKETING_BRAND="New Name" MARKETING_URL="newdomain.com" npm run marketing:render
 */
import "../_env";
import path from "path";
import { launch } from "../../src/lib/art/node";
import { allStills } from "./stills";
import { OUT, ensureDir } from "./kit";

type Browser = Awaited<ReturnType<typeof launch>>;

async function renderStills(browser: Browser, filter?: string) {
  ensureDir(path.join(OUT, "images"));
  const list = allStills().filter((s) => !filter || s.name.includes(filter));
  for (const s of list) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
    await page.setContent(s.html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(OUT, "images", `${s.name}.png`);
    await page.screenshot({ path: file, type: "png" });
    await page.close();
    console.log("image", path.relative(process.cwd(), file));
  }
}

async function main() {
  const what = process.argv[2] ?? "all";
  const browser = await launch();
  try {
    if (what === "all" || what === "stills") await renderStills(browser, process.argv[3]);
    if (what === "all" || what === "video") await (await import("./video")).renderVideos(browser, what === "video" ? process.argv[3] : undefined);
    if (what === "all" || what === "print") await (await import("./print")).renderPrint(browser);
    if (what === "all" || what === "sheet") await (await import("./sheet")).renderSheet(browser);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
