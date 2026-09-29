/**
 * Security checks against a running dev server (npm run dev): cross-visitor
 * access, admin gating, webhook spoofing, security headers, upload validation.
 *   npm run test:security
 */
import assert from "node:assert/strict";
import fs from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";

/** Minimal cookie-jar client (one per simulated visitor). */
function client() {
  const jar = new Map<string, string>();
  return async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      redirect: "manual",
      headers: { ...(init.headers as Record<string, string>), cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), origin: BASE },
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const [k, v] = kv.split("=");
      if (v) jar.set(k, v);
      else jar.delete(k);
    }
    return res;
  };
}

async function uploadFixture(c: ReturnType<typeof client>) {
  const wav = fs.readFileSync("tests/fixtures/voice.wav");
  const intent = await (await c("/api/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mimeType: "audio/wav", sizeBytes: wav.length, durationMs: 3000, source: "audio", fileName: "v.wav" }) })).json();
  const put = await fetch(intent.upload.url, { method: "PUT", headers: intent.upload.headers, body: wav });
  assert.equal(put.status, 200);
  const done = await c(`/api/uploads/${intent.assetId}/complete`, { method: "POST" });
  assert.equal(done.status, 200);
  return intent.assetId as string;
}

async function main() {
  const alice = client();
  const mallory = client();

  // Alice builds a project and a cart.
  const assetId = await uploadFixture(alice);
  const peaks = Array.from({ length: 64 }, (_, i) => 0.2 + 0.5 * Math.abs(Math.sin(i / 5)));
  const pr = await (await alice("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ designId: "night-of", fields: { date: "2024-06-01", names: "A & B" }, peaks, audioAssetId: assetId, rightsConfirmed: true }) })).json();
  const projectId = pr.project.id as string;
  const cart = await (await alice("/api/cart/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, variantId: "print-8x10", quantity: 1 }) })).json();
  const itemId = cart.cart.items[0].id as string;

  // Mallory can't read, edit or delete Alice's things.
  assert.equal((await mallory(`/api/projects/${projectId}`)).status, 404, "project read blocked");
  assert.equal((await mallory(`/api/projects/${projectId}`, { method: "DELETE" })).status, 404, "project delete blocked");
  assert.equal((await mallory(`/api/uploads/${assetId}`)).status, 404, "recording playback blocked");
  assert.equal((await mallory(`/api/uploads/${assetId}/complete`, { method: "POST" })).status, 404, "upload completion blocked");
  assert.equal((await mallory(`/api/cart/items/${itemId}`, { method: "DELETE" })).status, 404, "cart item delete blocked");
  const steal = await mallory("/api/cart/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, variantId: "print-8x10" }) });
  assert.equal(steal.status, 404, "can't add someone else's design to your cart");
  assert.equal((await mallory(`/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ designId: "night-of", audioAssetId: assetId, peaks, rightsConfirmed: true }) })).status, 400, "can't attach someone else's recording");
  console.log("✓ cross-visitor access blocked");

  // Server-side pricing: client can't set prices or invalid quantities.
  const bad = await alice(`/api/cart/items/${itemId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ quantity: 999 }) });
  assert.equal(bad.status, 400);
  const priced = await (await alice("/api/cart")).json();
  assert.equal(priced.cart.quote.subtotalCents, 3500, "price comes from the database");
  // Discount guessing is rate limited.
  for (let i = 0; i < 16; i++) await alice("/api/cart/discount", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: `GUESS${i}` }) });
  assert.equal((await alice("/api/cart/discount", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "GUESSX" }) })).status, 429);
  console.log("✓ pricing is server-side; code guessing rate-limited");

  // Cross-site requests are refused.
  const csrf = await fetch(`${BASE}/api/cart/items`, { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}" });
  assert.equal(csrf.status, 403);

  // Admin and private pages.
  const admin = await mallory("/admin");
  assert.ok([307, 308].includes(admin.status) && /account\/login/.test(admin.headers.get("location") ?? ""), "admin redirects to sign-in");
  assert.equal((await mallory("/order/some-order-id")).status, 404, "order page needs a token");
  console.log("✓ admin and order pages gated");

  // Webhook spoofing.
  const spoof = await fetch(`${BASE}/api/webhooks/stripe`, { method: "POST", headers: { "stripe-signature": "t=1,v1=deadbeef", "content-type": "application/json" }, body: JSON.stringify({ id: "evt_x", type: "checkout.session.completed", data: { object: {} } }) });
  assert.equal(spoof.status, 400);
  const pro = await fetch(`${BASE}/api/webhooks/prodigi?token=wrong`, { method: "POST", body: "{}" });
  assert.equal(pro.status, 403);
  console.log("✓ spoofed webhooks rejected");

  // Upload validation: a disguised file is rejected after upload.
  const fake = Buffer.concat([Buffer.from("<html><script>alert(1)</script>"), Buffer.alloc(2000)]);
  const i2 = await (await alice("/api/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mimeType: "audio/wav", sizeBytes: fake.length, source: "audio" }) })).json();
  await fetch(i2.upload.url, { method: "PUT", headers: i2.upload.headers, body: fake });
  assert.equal((await alice(`/api/uploads/${i2.assetId}/complete`, { method: "POST" })).status, 422);
  assert.equal((await alice("/api/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mimeType: "text/html", sizeBytes: 5000 }) })).status, 415);
  assert.equal((await alice("/api/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mimeType: "audio/wav", sizeBytes: 50_000_000 }) })).status, 413);
  // A tampered storage URL is refused.
  const tampered = i2.upload.url.replace(/t=([^&]+)/, (_: string, t: string) => `t=${t.slice(0, -3)}abc`);
  assert.equal((await fetch(tampered, { method: "PUT", headers: i2.upload.headers, body: fake })).status, 403);
  console.log("✓ uploads validated by content, type and size; signed URLs tamper-proof");

  // Security headers.
  const home = await fetch(`${BASE}/`);
  assert.match(home.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.equal(home.headers.get("x-frame-options"), "DENY");
  console.log("✓ security headers present");

  // Clean up Alice's cart item so repeated runs stay tidy.
  await alice(`/api/cart/items/${itemId}`, { method: "DELETE" });
  console.log("\nSecurity E2E: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
