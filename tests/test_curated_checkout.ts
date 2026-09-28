/**
 * Curated-design checkout contract. Needs DATABASE_URL (local Postgres is fine).
 * Run: npx tsx tests/test_curated_checkout.ts  (npm run test:checkout)
 */
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { POST as checkout } from "../src/app/api/checkout/route";
import { GET as getOrder } from "../src/app/api/orders/[id]/route";
import { prisma } from "../src/lib/db";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) pass++;
  else {
    fail++;
    console.log(`  ✗ ${name} ${detail}`);
  }
};
const req = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/checkout", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", host: "localhost:3000" } });

(async () => {
  const audioId = "aud_" + "a1b2c3d4e5f60718";
  const dir = path.resolve("storage", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${audioId}.wav`), Buffer.alloc(64));
  const peaks = Array.from({ length: 400 }, (_, i) => Math.abs(Math.sin(i / 7)));
  const good = { designId: "herbarium", colorwayId: "stone", fields: { title: "Rose Okafor", names: "Her grandchildren", date: "1952 — 2026", message: "Call me" }, peaks, audioId, size: "12x16", format: "framed", frameFinish: "natural", showQr: true, qrStyle: "discreet", rightsConfirmed: true, listenUrl: "open.spotify.com/track/abc123" };

  let r = await checkout(req(good));
  let j = await r.json();
  check("valid curated checkout → 200", r.status === 200, JSON.stringify(j));
  check("returns order id", typeof j.orderId === "string");
  check("price is framed 12x16 ($99)", j.value === 99, String(j.value));
  const order = await prisma.order.findUnique({ where: { id: j.orderId } });
  const spec = order?.artworkSpec ? JSON.parse(order.artworkSpec) : null;
  check("artworkSpec stored", !!spec && spec.designId === "herbarium" && spec.widthIn === 12 && spec.qrStyle === "discreet" && spec.heightIn === 16);
  check("listen token + QR url stored", !!order?.listenToken && spec?.qrUrl?.endsWith(`/l/${order?.listenToken}`));
  check("audio path is server-resolved", order?.audioPath === `storage/uploads/${audioId}.wav`);
  check("totalAmount in cents", order?.totalAmount === 9900);

  const o = await getOrder(new NextRequest(`http://localhost:3000/api/orders/${j.orderId}`), { params: Promise.resolve({ id: j.orderId }) });
  const oj = await o.json();
  check("order API exposes artwork without file paths", oj.artwork?.designId === "herbarium" && !JSON.stringify(oj).includes("storage/"));

  r = await checkout(req({ ...good, designId: "x-record" }));
  check("exploration designs are not sellable", r.status === 400);
  for (const retired of ["in-memoriam", "liner-notes", "arch"]) {
    r = await checkout(req({ ...good, designId: retired }));
    check(`retired design ${retired} not sellable`, r.status === 400);
  }
  check("listen link normalised and stored", spec?.listenUrl === "https://open.spotify.com/track/abc123", String(spec?.listenUrl));
  check("rights confirmation timestamp stored", typeof spec?.rightsConfirmedAt === "string");
  r = await checkout(req({ ...good, rightsConfirmed: false }));
  check("order without rights confirmation rejected", r.status === 400);
  for (const bad of ["javascript:alert(1)", "not a url", "ftp://x.com/a", "https://user:pw@evil.com/"]) {
    r = await checkout(req({ ...good, listenUrl: bad }));
    check(`bad listen link rejected: ${bad}`, r.status === 400);
  }
  r = await checkout(req({ ...good, listenUrl: "" }));
  j = await r.json();
  const on = await prisma.order.findUnique({ where: { id: j.orderId } });
  check("empty listen link → plays recording (null)", JSON.parse(on!.artworkSpec!).listenUrl === null);
  r = await checkout(req({ ...good, fields: { ...good.fields, song: "At Last — Etta James" } }));
  j = await r.json();
  const os = await prisma.order.findUnique({ where: { id: j.orderId } });
  check("song context stored as metadata field", JSON.parse(os!.artworkSpec!).fields.song === "At Last — Etta James");
  r = await checkout(req({ ...good, qrStyle: "weird" }));
  j = await r.json();
  const oq = await prisma.order.findUnique({ where: { id: j.orderId } });
  check("unknown qrStyle falls back to discreet", JSON.parse(oq!.artworkSpec!).qrStyle === "discreet");
  r = await checkout(req({ ...good, size: "16x20" }));
  check("legacy size rejected on curated path", r.status === 400);
  r = await checkout(req({ ...good, fields: { names: "x", date: "2020" } }));
  check("missing required field rejected", r.status === 400);
  r = await checkout(req({ ...good, peaks: "nope" }));
  check("bad peaks rejected", r.status === 400);
  r = await checkout(req({ ...good, audioId: "../../etc/passwd" }));
  check("path-like audio id rejected", r.status === 400);
  r = await checkout(req({ ...good, audioId: "aud_ffffffffffffffff" }));
  check("unknown upload rejected", r.status === 400);
  r = await checkout(req({ ...good, format: "print", size: "8x10" }));
  j = await r.json();
  check("print-only 8x10 priced $35", j.value === 35, String(j.value));
  r = await checkout(req({ ...good, fields: { ...good.fields, names: "x".repeat(500) } }));
  j = await r.json();
  const o2 = await prisma.order.findUnique({ where: { id: j.orderId } });
  check("over-long names truncated to maxLength", JSON.parse(o2!.artworkSpec!).fields.names.length === 30);

  fs.unlinkSync(path.join(dir, `${audioId}.wav`));
  console.log(`\nCurated checkout: ${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})();
