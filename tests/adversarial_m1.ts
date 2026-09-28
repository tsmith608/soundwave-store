/**
 * SoundWave Art — Adversarial Test Suite for Milestone 1
 * Stress-tests audio validation, upload API, and order query/preview endpoints.
 */

import { validateAudioUpload, detectAudioFormat, estimateAudioDuration } from "@/lib/audio";
import { POST as uploadHandler } from "@/app/api/upload/route";
import { GET as orderHandler } from "@/app/api/orders/[id]/route";
import { GET as previewHandler } from "@/app/api/orders/[id]/preview/route";
import { createOrder, getOrderById } from "@/lib/db";
import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

interface TestCaseResult {
  name: string;
  category: string;
  passed: boolean;
  expected: string;
  actual: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  details?: string;
}

const results: TestCaseResult[] = [];

function record(result: TestCaseResult) {
  results.push(result);
  const status = result.passed ? "[PASS]" : `[FAIL - ${result.severity || "BUG"}]`;
  console.log(`  ${status} [${result.category}] ${result.name}`);
  if (!result.passed) {
    console.log(`         Expected: ${result.expected}`);
    console.log(`         Actual:   ${result.actual}`);
    if (result.details) console.log(`         Details:  ${result.details}`);
  }
}

async function runAdversarialTests() {
  console.log("================================================================");
  console.log("   SOUNDWAVE ART — ADVERSARIAL STRESS TEST (MILESTONE 1)");
  console.log("================================================================\n");

  // -------------------------------------------------------------------------
  // CATEGORY 1: Non-Audio Files Disguised as Audio
  // -------------------------------------------------------------------------
  console.log("--- 1. Non-Audio Files Disguised as Audio ---");

  // 1.1 Plain text disguised with .wav extension
  {
    const textBuffer = Buffer.from("This is a plain text file pretending to be soundwave audio data.");
    const res = validateAudioUpload(textBuffer, "disguised.wav", "audio/wav");
    record({
      name: "Text file with .wav extension and audio/wav MIME must be rejected",
      category: "Content-Sniffing Bypass",
      passed: !res.valid,
      expected: "valid: false (rejected as non-audio)",
      actual: `valid: ${res.valid}, format: ${res.format}, error: ${res.error}`,
      severity: "CRITICAL",
      details: "Client-controlled filename or MIME causes text file to be accepted as valid audio",
    });
  }

  // 1.2 Plain text disguised with .mp3 extension and audio/mpeg MIME
  {
    const textBuffer = Buffer.from("Plain text content with .mp3 extension");
    const res = validateAudioUpload(textBuffer, "fake.mp3", "audio/mpeg");
    record({
      name: "Text file with .mp3 extension and audio/mpeg MIME must be rejected",
      category: "Content-Sniffing Bypass",
      passed: !res.valid,
      expected: "valid: false",
      actual: `valid: ${res.valid}, format: ${res.format}`,
      severity: "CRITICAL",
      details: "Text file masquerading as MP3 is accepted",
    });
  }

  // 1.3 Executable / Shell script disguised as audio
  {
    const scriptBuffer = Buffer.from("#!/bin/bash\nrm -rf /storage/uploads\necho 'pwned'\n");
    const res = validateAudioUpload(scriptBuffer, "payload.wav", "audio/wav");
    record({
      name: "Shell script named payload.wav must be rejected",
      category: "Malicious Upload",
      passed: !res.valid,
      expected: "valid: false",
      actual: `valid: ${res.valid}, format: ${res.format}`,
      severity: "CRITICAL",
      details: "Shell script accepted as valid audio and saved to storage/uploads",
    });
  }

  // 1.4 Random binary data disguised as audio
  {
    const randomBuffer = Buffer.alloc(1024);
    for (let i = 0; i < randomBuffer.length; i++) {
      randomBuffer[i] = Math.floor(Math.random() * 256);
    }
    // Make sure it doesn't accidentally start with RIFF or ID3
    randomBuffer.write("XXXX", 0, "ascii");
    const res = validateAudioUpload(randomBuffer, "noise.wav", "audio/wav");
    record({
      name: "Random binary data with audio/wav MIME must be rejected",
      category: "Content-Sniffing Bypass",
      passed: !res.valid,
      expected: "valid: false",
      actual: `valid: ${res.valid}, format: ${res.format}`,
      severity: "HIGH",
      details: "Random binary noise accepted as audio",
    });
  }

  // 1.5 JPEG image (JFIF header starts with FF D8 FF E0)
  {
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    ]);
    const detected = detectAudioFormat(jpegBuffer);
    const res = validateAudioUpload(jpegBuffer, "image.jpg", "image/jpeg");
    record({
      name: "JPEG image must not be detected as MP3 via MPEG sync false-positive",
      category: "False-Positive Detection",
      passed: detected === null && !res.valid,
      expected: "detected: null, valid: false",
      actual: `detected: ${detected}, valid: ${res.valid}`,
      severity: "HIGH",
      details: "MPEG sync bit search (0xFF followed by 0xE0) false-triggers on JPEG JFIF header (FF D8 FF E0)",
    });
  }

  // -------------------------------------------------------------------------
  // CATEGORY 2: Corrupted Audio Headers
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Corrupted Audio Headers ---");

  // 2.1 Truncated WAV: Only 12 bytes 'RIFF....WAVE' (no fmt or data chunk)
  {
    const truncWav = Buffer.alloc(12);
    truncWav.write("RIFF", 0, "ascii");
    truncWav.writeUInt32LE(4, 4);
    truncWav.write("WAVE", 8, "ascii");

    const res = validateAudioUpload(truncWav, "truncated.wav", "audio/wav");
    record({
      name: "12-byte WAV with no fmt or data chunk must be rejected as invalid audio",
      category: "Corrupted Audio",
      passed: !res.valid,
      expected: "valid: false (corrupted/incomplete WAV container)",
      actual: `valid: ${res.valid}, durationSeconds: ${res.durationSeconds}`,
      severity: "HIGH",
      details: "Incomplete WAV with zero audio data or format chunk accepted as valid audio",
    });
  }

  // 2.2 WAV fmt chunk claims 16 bytes but file truncated at byte 20 (fmt byteRate out of bounds)
  {
    const truncFmt = Buffer.alloc(20);
    truncFmt.write("RIFF", 0, "ascii");
    truncFmt.writeUInt32LE(12, 4);
    truncFmt.write("WAVE", 8, "ascii");
    truncFmt.write("fmt ", 12, "ascii");
    truncFmt.writeUInt32LE(16, 16); // Claims 16 byte fmt chunk, but buffer ends here!

    const res = validateAudioUpload(truncFmt, "corrupt_fmt.wav", "audio/wav");
    record({
      name: "Truncated WAV with out-of-bounds fmt chunk must be rejected",
      category: "Corrupted Audio",
      passed: !res.valid,
      expected: "valid: false",
      actual: `valid: ${res.valid}, error: ${res.error}`,
      severity: "HIGH",
      details: "Throws RangeError internally and silently falls back to 1-second valid duration",
    });
  }

  // 2.3 WAV with 0 sample rate / 0 byteRate
  {
    const zeroRateWav = Buffer.alloc(44);
    zeroRateWav.write("RIFF", 0, "ascii");
    zeroRateWav.writeUInt32LE(36, 4);
    zeroRateWav.write("WAVE", 8, "ascii");
    zeroRateWav.write("fmt ", 12, "ascii");
    zeroRateWav.writeUInt32LE(16, 16);
    zeroRateWav.writeUInt16LE(1, 20); // PCM
    zeroRateWav.writeUInt16LE(1, 22); // 1 channel
    zeroRateWav.writeUInt32LE(0, 24); // SampleRate = 0 (INVALID)
    zeroRateWav.writeUInt32LE(0, 28); // ByteRate = 0 (INVALID)
    zeroRateWav.writeUInt16LE(2, 32);
    zeroRateWav.writeUInt16LE(16, 34);
    zeroRateWav.write("data", 36, "ascii");
    zeroRateWav.writeUInt32LE(0, 40);

    const res = validateAudioUpload(zeroRateWav, "zero_rate.wav", "audio/wav");
    record({
      name: "WAV with 0 sampleRate and 0 byteRate must be rejected",
      category: "Corrupted Audio",
      passed: !res.valid,
      expected: "valid: false",
      actual: `valid: ${res.valid}`,
      severity: "MEDIUM",
      details: "Invalid 0 sample rate WAV accepted",
    });
  }

  // 2.4 MP3 with ID3 header but 0 audio frames / truncated
  {
    const fakeMp3 = Buffer.alloc(10);
    fakeMp3.write("ID3", 0, "ascii");
    fakeMp3[3] = 0x03;
    fakeMp3[4] = 0x00;
    fakeMp3[5] = 0x00;
    fakeMp3[6] = 0x00;
    fakeMp3[7] = 0x00;
    fakeMp3[8] = 0x00;
    fakeMp3[9] = 0x00;

    const res = validateAudioUpload(fakeMp3, "empty_id3.mp3", "audio/mpeg");
    record({
      name: "10-byte file with only ID3 header and no audio frames must be rejected",
      category: "Corrupted Audio",
      passed: !res.valid,
      expected: "valid: false",
      actual: `valid: ${res.valid}, durationSeconds: ${res.durationSeconds}`,
      severity: "MEDIUM",
      details: "ID3 header alone without MPEG audio data accepted as valid MP3",
    });
  }

  // -------------------------------------------------------------------------
  // CATEGORY 3: Boundary Conditions
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Boundary Conditions ---");

  // 3.1 0-byte file buffer
  {
    const emptyBuffer = Buffer.alloc(0);
    const res = validateAudioUpload(emptyBuffer, "empty.wav", "audio/wav");
    record({
      name: "0-byte buffer must be rejected by validateAudioUpload",
      category: "Boundary Conditions",
      passed: !res.valid && Boolean(res.error?.includes("Empty")),
      expected: "valid: false, error containing 'Empty'",
      actual: `valid: ${res.valid}, error: ${res.error}`,
      severity: "HIGH",
    });
  }

  // 3.2 0-byte file in POST /api/upload
  {
    const formData = new FormData();
    const emptyBlob = new Blob([], { type: "audio/wav" });
    formData.append("audio", emptyBlob, "empty.wav");

    const req = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    const response = await uploadHandler(req);
    const json = await response.json();
    record({
      name: "POST /api/upload with 0-byte file returns HTTP 400",
      category: "Boundary Conditions",
      passed: response.status === 400 && json.success === false,
      expected: "HTTP 400, success: false",
      actual: `HTTP ${response.status}, success: ${json.success}, error: ${json.error}`,
      severity: "HIGH",
    });
  }

  // 3.3 51MB file exceeding 50MB limit
  {
    // Allocate 51MB buffer (51 * 1024 * 1024 = 53,477,376 bytes)
    const oversizedBuffer = Buffer.alloc(51 * 1024 * 1024);
    oversizedBuffer.write("RIFF", 0, "ascii");
    oversizedBuffer.write("WAVE", 8, "ascii");

    const res = validateAudioUpload(oversizedBuffer, "large.wav", "audio/wav");
    record({
      name: "51MB buffer must be rejected with size limit error",
      category: "Boundary Conditions",
      passed: !res.valid && Boolean(res.error?.includes("exceeds maximum size limit")),
      expected: "valid: false, exceeds limit error",
      actual: `valid: ${res.valid}, error: ${res.error}`,
      severity: "HIGH",
    });
  }

  // 3.4 51MB file in POST /api/upload
  {
    const oversizedBuffer = Buffer.alloc(51 * 1024 * 1024);
    oversizedBuffer.write("RIFF", 0, "ascii");
    oversizedBuffer.write("WAVE", 8, "ascii");

    const formData = new FormData();
    const oversizedBlob = new Blob([new Uint8Array(oversizedBuffer)], { type: "audio/wav" });
    formData.append("audio", oversizedBlob, "huge.wav");

    const req = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    const response = await uploadHandler(req);
    const json = await response.json();
    record({
      name: "POST /api/upload with 51MB file returns HTTP 400",
      category: "Boundary Conditions",
      passed: response.status === 400 && json.success === false,
      expected: "HTTP 400, success: false",
      actual: `HTTP ${response.status}, success: ${json.success}`,
      severity: "HIGH",
    });
  }

  // 3.5 Tiny buffers (< 12 bytes)
  {
    const tiny1 = Buffer.from([0x52, 0x49, 0x46, 0x46]); // 'RIFF' 4 bytes
    const res1 = validateAudioUpload(tiny1, "tiny.wav", "audio/wav");
    record({
      name: "4-byte buffer with 'RIFF' must be rejected",
      category: "Boundary Conditions",
      passed: !res1.valid,
      expected: "valid: false",
      actual: `valid: ${res1.valid}`,
      severity: "MEDIUM",
    });
  }

  // -------------------------------------------------------------------------
  // CATEGORY 4: Path Traversal & Invalid MIME Types
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Path Traversal & Invalid MIME Types ---");

  // 4.1 Path traversal in filename: ../../evil.wav in POST /api/upload
  {
    const validWav = Buffer.alloc(44);
    validWav.write("RIFF", 0, "ascii");
    validWav.writeUInt32LE(36, 4);
    validWav.write("WAVE", 8, "ascii");
    validWav.write("fmt ", 12, "ascii");
    validWav.writeUInt32LE(16, 16);
    validWav.writeUInt16LE(1, 20);
    validWav.writeUInt16LE(1, 22);
    validWav.writeUInt32LE(44100, 24);
    validWav.writeUInt32LE(88200, 28);
    validWav.writeUInt16LE(2, 32);
    validWav.writeUInt16LE(16, 34);
    validWav.write("data", 36, "ascii");
    validWav.writeUInt32LE(0, 40);

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(validWav)], { type: "audio/wav" });
    formData.append("audio", blob, "../../evil.wav");

    const req = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    const response = await uploadHandler(req);
    const json = await response.json();

    const sanitizedPath = json.audioPath && !json.audioPath.includes("..");
    const idSafe = json.audioId && !json.audioId.includes("..");
    record({
      name: "Path traversal filename '../../evil.wav' must not escape storage/uploads",
      category: "Path Traversal",
      passed: sanitizedPath && idSafe,
      expected: "audioPath does not contain '..' and stays within storage/uploads",
      actual: `audioPath: ${json.audioPath}, audioId: ${json.audioId}`,
      severity: "HIGH",
    });
  }

  // 4.2 Malicious file with path traversal filename AND non-audio text content
  {
    const badText = Buffer.from("恶意代码 - Malicious script disguised with traversal");
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(badText)], { type: "audio/wav" });
    formData.append("audio", blob, "../../../etc/cron.d/evil.wav");

    const req = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    const response = await uploadHandler(req);
    const json = await response.json();

    record({
      name: "POST /api/upload rejects non-audio file submitted with path traversal name",
      category: "Adversarial Upload",
      passed: response.status === 400 && json.success === false,
      expected: "HTTP 400, success: false",
      actual: `HTTP ${response.status}, success: ${json.success}, path: ${json.audioPath}`,
      severity: "CRITICAL",
      details: "Text file disguised as WAV with path traversal was stored to disk",
    });
  }

  // 4.3 Invalid MIME types: application/octet-stream with valid WAV vs invalid text
  {
    const badText = Buffer.from("random text");
    const res = validateAudioUpload(badText, "audio.bin", "application/octet-stream");
    record({
      name: "Rejects application/octet-stream with non-audio content",
      category: "MIME Validation",
      passed: !res.valid,
      expected: "valid: false",
      actual: `valid: ${res.valid}`,
      severity: "MEDIUM",
    });
  }

  // 4.4 Completely bogus MIME type: 'audio/x-evil-payload' with text
  {
    const badText = Buffer.from("bogus audio");
    const res = validateAudioUpload(badText, "test", "audio/x-evil-payload");
    record({
      name: "Rejects unrecognized audio/ MIME type",
      category: "MIME Validation",
      passed: !res.valid,
      expected: "valid: false",
      actual: `valid: ${res.valid}`,
      severity: "MEDIUM",
    });
  }

  // -------------------------------------------------------------------------
  // CATEGORY 5: Order APIs & Preview Path Traversal
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Order APIs & Preview Path Traversal ---");

  // 5.1 GET /api/orders/[id] with SQL injection / special characters
  {
    const attackId = "' OR '1'='1";
    const req = new NextRequest(`http://localhost:3000/api/orders/${encodeURIComponent(attackId)}`);
    const res = await orderHandler(req, { params: Promise.resolve({ id: attackId }) });
    record({
      name: "GET /api/orders/[id] safely handles SQL injection string in ID",
      category: "Input Sanitization",
      passed: res.status === 404,
      expected: "HTTP 404",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
    });
  }

  // 5.2 GET /api/orders/[id] with path traversal ID
  {
    const attackId = "../../package.json";
    const req = new NextRequest(`http://localhost:3000/api/orders/${encodeURIComponent(attackId)}`);
    const res = await orderHandler(req, { params: Promise.resolve({ id: attackId }) });
    record({
      name: "GET /api/orders/[id] safely handles path traversal ID",
      category: "Input Sanitization",
      passed: res.status === 404,
      expected: "HTTP 404",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
    });
  }

  // 5.3 Local File Inclusion (LFI) via order.previewUrl
  // What if an order has previewUrl pointing to a sensitive file on disk?
  {
    const lfiOrderId = `ord_lfi_test_${Date.now()}`;
    await createOrder({
      id: lfiOrderId,
      customerEmail: "attacker@example.com",
      frameSize: "8x10",
      palette: "midnight_gold",
      audioPath: "storage/uploads/dummy.wav",
      previewUrl: "package.json", // Relative path to source file!
      totalAmount: 4900,
    });

    const previewReq = new NextRequest(`http://localhost:3000/api/orders/${lfiOrderId}/preview`);
    const previewRes = await previewHandler(previewReq, { params: Promise.resolve({ id: lfiOrderId }) });
    const bodyText = await previewRes.text();

    const isLfiVulnerable = previewRes.status === 200 && bodyText.includes('"name": "soundwave-store"');
    record({
      name: "Preview API must NOT serve arbitrary files when previewUrl points to sensitive files",
      category: "Local File Inclusion",
      passed: !isLfiVulnerable,
      expected: "Rejected or confined to storage/previews directory only",
      actual: isLfiVulnerable ? "VULNERABLE: package.json contents leaked via /preview endpoint!" : "Safe",
      severity: "CRITICAL",
      details: "src/app/api/orders/[id]/preview/route.ts resolves order.previewUrl directly against process.cwd() and reads it without verifying it is inside storage/previews",
    });
  }

  // -------------------------------------------------------------------------
  // Summary & Breakdown
  // -------------------------------------------------------------------------
  console.log("\n================================================================");
  console.log("                  ADVERSARIAL TEST SUMMARY");
  console.log("================================================================");

  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedResults = results.filter((r) => !r.passed);

  console.log(`Total tests run: ${total}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedResults.length}`);

  if (failedResults.length > 0) {
    console.log("\nCRITICAL & HIGH FAILURES:");
    for (const f of failedResults) {
      console.log(`  - [${f.severity || "FAIL"}] ${f.name}`);
      console.log(`    Expected: ${f.expected}`);
      console.log(`    Actual:   ${f.actual}`);
      if (f.details) console.log(`    Details:  ${f.details}`);
    }
  }

  console.log("================================================================\n");

  if (failedResults.length > 0) {
    process.exit(1);
  }
}

runAdversarialTests().catch((err) => {
  console.error("Adversarial runner failed:", err);
  process.exit(1);
});

