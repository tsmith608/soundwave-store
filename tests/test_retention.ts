import { fileVerdict, hasQr, orderVerdict } from "../src/lib/retention";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean) {
  if (ok) pass++;
  else {
    fail++;
    console.log(`  [FAIL] ${name}`);
  }
}
const now = new Date("2026-09-28T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
const spec = (o: object) => JSON.stringify(o);

check("QR order kept forever", orderVerdict({ status: "delivered", artworkSpec: spec({ showQr: true }), updatedAt: daysAgo(5000) }, now).keep);
check("legacy order (no spec) treated as QR", hasQr({ artworkSpec: null }));
check("unreadable spec kept", hasQr({ artworkSpec: "{bad" }));
check("no-QR delivered 91 days → delete", !orderVerdict({ status: "delivered", artworkSpec: spec({ showQr: false }), updatedAt: daysAgo(91) }, now).keep);
check("no-QR delivered 30 days → keep", orderVerdict({ status: "delivered", artworkSpec: spec({ showQr: false }), updatedAt: daysAgo(30) }, now).keep);
check("no-QR in production → keep", orderVerdict({ status: "in_production", artworkSpec: spec({ showQr: false }), updatedAt: daysAgo(400) }, now).keep);
check("cancelled 31 days → delete", !orderVerdict({ status: "cancelled", artworkSpec: spec({ showQr: true }), updatedAt: daysAgo(31) }, now).keep);
check("abandoned checkout 31 days → delete", !orderVerdict({ status: "pending_payment", artworkSpec: spec({ showQr: true }), updatedAt: daysAgo(31) }, now).keep);
check("checkout 2 days → keep", orderVerdict({ status: "pending_payment", artworkSpec: null, updatedAt: daysAgo(2) }, now).keep);
check("orphan upload 31 days → delete", !fileVerdict([], daysAgo(31), now).keep);
check("orphan upload 3 days → keep", fileVerdict([], daysAgo(3), now).keep);
check(
  "shared file kept if any order needs it",
  fileVerdict(
    [
      { status: "cancelled", artworkSpec: null, updatedAt: daysAgo(200) },
      { status: "delivered", artworkSpec: spec({ showQr: true }), updatedAt: daysAgo(200) },
    ],
    daysAgo(200),
    now,
  ).keep,
);
check("removed recording no longer counts as QR", !hasQr({ artworkSpec: spec({ showQr: true, recordingRemovedAt: "2026-09-01" }) }));

console.log(`\nRetention: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
