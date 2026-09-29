/**
 * End-to-end: customise → upload → add to cart → checkout (fake Stripe, real
 * signed webhook) → order paid → worker renders print files, submits to the
 * (mock) lab, sends the confirmation email. Then replays the webhook to prove
 * idempotency.
 *
 * Requires: dev server on BASE_URL (default http://localhost:3000) with
 * PAYMENTS_PROVIDER unset/fake, FULFILLMENT_PROVIDER mock, EMAIL_PROVIDER file,
 * and the same DATABASE_URL.   Run: npm run test:e2e
 */
import { execFileSync } from "child_process";
import path from "path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CHROME = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const prisma = new PrismaClient();

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 4/.test(m.text()) && errors.push(m.text()));

  // 1. Studio
  await page.goto(`${BASE}/create?design=herbarium`, { waitUntil: "networkidle" });
  await page.locator('input[type=file]').setInputFiles(path.resolve("tests/fixtures/voice.wav"));
  // Generous first timeout: a cold dev server compiles the upload routes on first use.
  await page.getByText("Your artwork is now shaped by this recording").waitFor({ timeout: 120_000 });
  await page.locator('input[type=checkbox]').first().check();
  await page.getByRole("button", { name: /Details/ }).first().click();
  await page.locator('input[type=text]').first().fill("Dad's voicemail");
  await page.getByRole("button", { name: /Review/ }).first().click();
  await page.getByRole("button", { name: /^Add to cart — / }).click();
  await page.waitForURL(/\/cart/, { timeout: 90_000 });
  console.log("✓ added to cart");

  // 2. Refresh keeps the cart (server-side, cookie-bound)
  await page.reload();
  await page.getByText("Dad's voicemail").first().waitFor();

  // 3. Checkout → fake Stripe → pay
  await page.getByRole("button", { name: /^Checkout/ }).click();
  await page.waitForURL(/\/dev\/checkout\//, { timeout: 30_000 });
  const sessionId = page.url().split("/").pop()!;
  await page.getByRole("button", { name: /^Pay / }).click();
  await page.waitForURL(/\/checkout\/success/, { timeout: 30_000 });
  await page.getByText("Payment confirmed").waitFor({ timeout: 30_000 });
  console.log("✓ payment confirmed via webhook");

  const order = await prisma.order.findUniqueOrThrow({ where: { stripeCheckoutSessionId: sessionId }, include: { items: true, payments: true } });
  assert.equal(order.status, "paid");
  assert.equal(order.payments.length, 1);
  assert.equal(order.items.length, 1);
  assert.ok(order.items[0].listenToken, "QR listen token issued");
  assert.equal(order.shipCity, "Portland");

  // 4. Replay the same webhook: must be a no-op.
  const wh = await prisma.webhookEvent.findFirstOrThrow({ where: { provider: "stripe", type: "checkout.session.completed" }, orderBy: { receivedAt: "desc" } });
  const { deliverFakeEventRaw } = await import("./helpers");
  const replay = await deliverFakeEventRaw(BASE, wh.payload);
  assert.equal(replay.status, 200);
  assert.equal(replay.body?.duplicate, true);
  assert.equal(await prisma.payment.count({ where: { orderId: order.id } }), 1);
  console.log("✓ duplicate webhook ignored");

  // 5. Worker: render → submit → email
  execFileSync("npx", ["tsx", "scripts/worker.ts", "--once"], { stdio: "inherit", env: { ...process.env, LOG_LEVEL: "warn", FULFILLMENT_HOLD_HOURS: "0" } });
  const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: { include: { generatedAssets: true } }, fulfillments: true, emails: true } });
  assert.equal(after.status, "submitted_to_fulfillment", `status is ${after.status}`);
  const kinds = after.items[0].generatedAssets.map((a) => a.kind).sort();
  assert.deepEqual(kinds, ["preview_png", "print_pdf", "print_png"]);
  const png = after.items[0].generatedAssets.find((a) => a.kind === "print_png")!;
  assert.equal(png.dpi, 300);
  assert.equal(png.widthPx, 12 * 300);
  assert.ok(after.fulfillments[0]?.providerOrderId, "submitted to lab");
  assert.ok(after.emails.some((e) => e.template === "order_confirmation" && e.status === "sent"), "confirmation email sent");
  console.log("✓ print files rendered (300 DPI), submitted to lab, confirmation emailed");

  // 6. The QR page works for this order.
  const listen = await page.goto(`${BASE}/l/${after.items[0].listenToken}`);
  assert.equal(listen?.status(), 200);

  assert.deepEqual(errors, [], `browser errors: ${errors.join("\n")}`);
  await browser.close();
  await prisma.$disconnect();
  console.log("\nE2E checkout: PASS");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
