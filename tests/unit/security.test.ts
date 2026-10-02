import { describe, it } from "node:test";
import assert from "node:assert/strict";
process.env.APP_SECRET = "unit-test-secret-unit-test-secret-1234";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://localhost/unused";
import { signToken, verifyToken, safeEqual } from "../../src/lib/server/crypto";
import { assertKey } from "../../src/lib/server/storage/types";
import { sniffAudio, AUDIO_TYPES, normaliseMime, safeFileName } from "../../src/lib/server/media";
import { safeNext } from "../../src/lib/server/login";
import { orderAccessToken, checkOrderAccessToken } from "../../src/lib/server/orders/access";
import { cleanListenUrl } from "../../src/lib/listenLink";
import { NextRequest } from "next/server";
import { assertSameOrigin, clientIp } from "../../src/lib/server/http";

describe("signed tokens", () => {
  it("round-trips and rejects tampering, wrong purpose, expiry", () => {
    const t = signToken('{"k":"uploads/a.wav"}', "storage", 60);
    assert.equal(verifyToken(t, "storage"), '{"k":"uploads/a.wav"}');
    assert.equal(verifyToken(t, "other"), null);
    assert.equal(verifyToken(t.replace("a.wav", "b.wav"), "storage"), null);
    assert.equal(verifyToken(signToken("x", "storage", -5), "storage"), null);
  });
  it("compares in constant time and handles length mismatch", () => {
    assert.equal(safeEqual("abc", "abc"), true);
    assert.equal(safeEqual("abc", "abcd"), false);
  });
});

describe("order access tokens", () => {
  it("only the matching token opens an order", () => {
    const t = orderAccessToken("ord1");
    assert.ok(checkOrderAccessToken("ord1", t));
    assert.equal(checkOrderAccessToken("ord2", t), false);
    assert.equal(checkOrderAccessToken("ord1", null), false);
    assert.equal(checkOrderAccessToken("ord1", ""), false);
  });
});

describe("storage keys", () => {
  it("block path traversal and odd characters", () => {
    assert.equal(assertKey("uploads/2026/09/abc.wav"), "uploads/2026/09/abc.wav");
    for (const bad of ["../etc/passwd", "uploads/../../x", "/abs/path", "a//b", "x y", "uploads/%2e%2e/x"]) assert.throws(() => assertKey(bad), bad);
  });
});

describe("upload validation", () => {
  const b = (s: string, pad = 16) => Buffer.concat([Buffer.from(s, "latin1"), Buffer.alloc(pad)]);
  it("identifies real audio containers by magic bytes", () => {
    assert.equal(sniffAudio(b("RIFF\0\0\0\0WAVE")), "wav");
    assert.equal(sniffAudio(b("ID3\x04")), "mp3");
    assert.equal(sniffAudio(b("\0\0\0\x20ftypM4A ")), "mp4");
    assert.equal(sniffAudio(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...new Array(12).fill(0)])), "webm");
    assert.equal(sniffAudio(b("OggS")), "ogg");
    assert.equal(sniffAudio(b("fLaC")), "flac");
  });
  it("rejects non-audio disguised as audio", () => {
    assert.equal(sniffAudio(b("%PDF-1.7")), null);
    assert.equal(sniffAudio(b("<html><script>")), null);
    assert.equal(sniffAudio(b("\x89PNG\r\n\x1a\n")), null);
    assert.equal(sniffAudio(Buffer.from("MZ")), null);
  });
  it("only allows audio mime types", () => {
    assert.ok(AUDIO_TYPES[normaliseMime("audio/webm;codecs=opus")]);
    assert.equal(AUDIO_TYPES[normaliseMime("video/mp4")], undefined);
    assert.equal(AUDIO_TYPES[normaliseMime("text/html")], undefined);
  });
  it("sanitises file names", () => {
    assert.equal(safeFileName("../../etc/<script>.wav"), ".._.._etc__script_.wav");
  });
});

describe("redirect safety", () => {
  it("only allows same-site relative paths after sign-in", () => {
    assert.equal(safeNext("/account"), "/account");
    assert.equal(safeNext("/admin/orders?x=1"), "/admin/orders?x=1");
    for (const bad of ["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "", null]) assert.equal(safeNext(bad as string), "/account");
  });
  it("listen links: http(s) only, never javascript:, no credentials", () => {
    assert.equal(cleanListenUrl("open.spotify.com/track/1"), "https://open.spotify.com/track/1");
    assert.equal(cleanListenUrl("javascript:alert(1)"), null);
    assert.equal(cleanListenUrl("https://user:pw@example.com"), null);
    assert.equal(cleanListenUrl("ftp://x.com"), null);
  });
});

describe("client IP for rate limits", () => {
  const req = (h: Record<string, string>) => new Request("https://shop.test/api/x", { headers: h });
  it("ignores spoofed first X-Forwarded-For entries and uses the last proxy hop", () => {
    delete process.env.TRUSTED_IP_HEADER;
    assert.equal(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" })), "203.0.113.9");
  });
  it("uses only the configured trusted header when set", () => {
    process.env.TRUSTED_IP_HEADER = "fly-client-ip";
    assert.equal(clientIp(req({ "fly-client-ip": "198.51.100.7", "x-forwarded-for": "6.6.6.6" })), "198.51.100.7");
    assert.equal(clientIp(req({ "x-forwarded-for": "6.6.6.6" })), "unknown");
    delete process.env.TRUSTED_IP_HEADER;
  });
});

describe("same-origin guard", () => {
  const nreq = (h: Record<string, string>) => new NextRequest("https://shop.test/api/cart", { method: "POST", headers: { host: "shop.test", ...h } });
  it("allows our own pages and non-browser clients", () => {
    assert.doesNotThrow(() => assertSameOrigin(nreq({ origin: "https://shop.test", "sec-fetch-site": "same-origin" })));
    assert.doesNotThrow(() => assertSameOrigin(nreq({})));
  });
  it("blocks other sites", () => {
    assert.throws(() => assertSameOrigin(nreq({ origin: "https://evil.example" })));
    assert.throws(() => assertSameOrigin(nreq({ "sec-fetch-site": "cross-site" })));
    assert.throws(() => assertSameOrigin(nreq({ origin: "null" })));
  });
});
