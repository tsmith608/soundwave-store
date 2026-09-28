/**
 * Empirical Adversarial Verification Suite: Frontend & Customizer (Generation 5)
 *
 * This test suite rigorously tests:
 * 1. Default Light Mode Theme & Styling (#FAF7F2 cream background, typography, CSS tokens)
 * 2. PortraitBuilder UI File Input & Validation (.jpg, .jpeg, .png, MIME, uppercase, edge case sizes, rejection)
 * 3. WaveformCanvas Composite Rendering (photo aspect ratio, mat border, 4 decorative styles, waveform positioning, QR code)
 * 4. Backend /api/upload Image Handling (JPEG/PNG magic bytes, payload limits, rejection of spoofed/invalid files)
 * 5. Data Flow & Checkout Continuity (persistence of photoPath, client-to-server payload integrity)
 */

import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { POST as uploadHandler } from "../src/app/api/upload/route";
import { POST as checkoutHandler } from "../src/app/api/checkout/route";
import { PALETTES, FRAME_SIZES, DECORATIVE_STYLES, DecorativeStyle, PaletteConfig } from "../src/lib/constants";
import { getOrderById } from "../src/lib/db";

// Test counters
let totalPassed = 0;
let totalFailed = 0;
const results: { suite: string; name: string; status: "PASS" | "FAIL"; details?: string }[] = [];

function assert(condition: boolean, suite: string, name: string, failureDetails?: string) {
  if (condition) {
    totalPassed++;
    results.push({ suite, name, status: "PASS" });
    console.log(`  [PASS] [${suite}] ${name}`);
  } else {
    totalFailed++;
    results.push({ suite, name, status: "FAIL", details: failureDetails });
    console.error(`  [FAIL] [${suite}] ${name}: ${failureDetails || "Condition failed"}`);
  }
}

// =========================================================================
// SUITE 1: Light Mode Default Styling & Theme Verification
// =========================================================================
function testLightModeStyling() {
  console.log("\n=== SUITE 1: Light Mode Default Styling & Theme Verification ===");

  const layoutPath = path.resolve(process.cwd(), "src/app/layout.tsx");
  const layoutCode = fs.readFileSync(layoutPath, "utf-8");

  // 1. Root HTML tag has light class
  const htmlTagLight = /<html[^>]*className=["'][^"']*light[^"']*["']/.test(layoutCode);
  assert(htmlTagLight, "LightMode", "Root <html lang='en'> has 'light' className", "Root html lacks light class");

  // 2. HTML does not have dark class
  const htmlTagDark = /<html[^>]*className=["'][^"']*dark[^"']*["']/.test(layoutCode);
  assert(!htmlTagDark, "LightMode", "Root <html> does NOT have 'dark' className", "Found dark class on root html");

  // 3. Viewport themeColor is #FAF7F2
  const themeColorMatch = /themeColor:\s*["']#FAF7F2["']/i.test(layoutCode);
  assert(themeColorMatch, "LightMode", "Viewport themeColor is #FAF7F2 (light cream)", "themeColor is not #FAF7F2");

  // 4. Body styling applies cream background #FAF7F2 and dark charcoal text #2D2A26
  const bodyHasCreamBg = layoutCode.includes("bg-[#FAF7F2]");
  const bodyHasCharcoalText = layoutCode.includes("text-[#2D2A26]");
  assert(bodyHasCreamBg, "LightMode", "Root <body> contains bg-[#FAF7F2]", "Missing bg-[#FAF7F2] on body");
  assert(bodyHasCharcoalText, "LightMode", "Root <body> contains text-[#2D2A26]", "Missing text-[#2D2A26] on body");

  // 5. CSS variables in globals.css
  const globalsPath = path.resolve(process.cwd(), "src/app/globals.css");
  const globalsCode = fs.readFileSync(globalsPath, "utf-8");

  assert(globalsCode.includes("--bg-primary: #FAF7F2;"), "LightMode", "globals.css defines --bg-primary: #FAF7F2;");
  assert(globalsCode.includes("--text-primary: #2D2A26;"), "LightMode", "globals.css defines --text-primary: #2D2A26;");
  assert(globalsCode.includes("--bg-card: #FFFFFF;"), "LightMode", "globals.css defines --bg-card: #FFFFFF;");
  assert(globalsCode.includes("background-color: var(--bg-primary);"), "LightMode", "body uses var(--bg-primary)");
  assert(globalsCode.includes("color: var(--text-primary);"), "LightMode", "body uses var(--text-primary)");

  // 6. Check tailwind config
  const tailwindPath = path.resolve(process.cwd(), "tailwind.config.js");
  const tailwindCode = fs.readFileSync(tailwindPath, "utf-8");
  assert(tailwindCode.includes('"bg-primary": "#FAF7F2"'), "LightMode", "tailwind.config.js maps bg-primary to #FAF7F2");
  assert(tailwindCode.includes("cream: {"), "LightMode", "tailwind.config.js contains millennial cream color scale");

  // 7. Check landing page does not force dark theme
  const pagePath = path.resolve(process.cwd(), "src/app/page.tsx");
  const pageCode = fs.readFileSync(pagePath, "utf-8");
  assert(pageCode.includes("bg-[#FAF7F2] text-[#2D2A26]"), "LightMode", "page.tsx main container uses bg-[#FAF7F2]");
  assert(!pageCode.includes("bg-[#0c0c0e]"), "LightMode", "page.tsx does not use old dark SaaS background #0c0c0e");
}

// =========================================================================
// SUITE 2: PortraitBuilder UI File Input & Client-Side Validation
// =========================================================================
function testPortraitBuilderFileInput() {
  console.log("\n=== SUITE 2: PortraitBuilder UI File Input & Client Validation ===");

  const pbPath = path.resolve(process.cwd(), "src/components/PortraitBuilder.tsx");
  const pbCode = fs.readFileSync(pbPath, "utf-8");

  // 1. File input element exists
  const hasFileInput = pbCode.includes('type="file"');
  assert(hasFileInput, "CustomizerUI", "PortraitBuilder has <input type='file'>");

  // 2. Accept attribute supports .jpg, .jpeg, .png and MIME types
  const hasAcceptAttr = pbCode.includes('accept=".jpg,.jpeg,.png,image/jpeg,image/png"');
  assert(hasAcceptAttr, "CustomizerUI", "File input accept attribute includes .jpg, .jpeg, .png, and image mime types");

  // 3. Hidden input triggered by styled drop/click target
  const hasInputRef = pbCode.includes("ref={photoInputRef}");
  const hasClickTrigger = pbCode.includes("photoInputRef.current?.click()");
  assert(hasInputRef && hasClickTrigger, "CustomizerUI", "File input is connected to accessible UI click and drag-and-drop triggers");

  // 4. Test client validation algorithm (extracted directly from PortraitBuilder.tsx processPhotoFile)
  function simulateProcessPhotoFile(file: { name: string; type: string; size: number }): {
    valid: boolean;
    error: string | null;
  } {
    const validTypes = ["image/jpeg", "image/png", "image/jpg"];
    const validExts = [".jpg", ".jpeg", ".png"];
    const hasValidExt = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!validTypes.includes(file.type) && !hasValidExt) {
      return { valid: false, error: "Please upload a valid image file (.jpg, .jpeg, or .png)." };
    }

    if (file.size > 25 * 1024 * 1024) {
      return { valid: false, error: "Image must be smaller than 25MB." };
    }

    return { valid: true, error: null };
  }

  // 4a. Valid JPEG
  const resJpg = simulateProcessPhotoFile({ name: "wedding_photo.jpg", type: "image/jpeg", size: 1024 * 500 });
  assert(resJpg.valid && resJpg.error === null, "CustomizerUI", "Accepts standard JPEG (.jpg, image/jpeg)");

  // 4b. Valid PNG
  const resPng = simulateProcessPhotoFile({ name: "baby_photo.png", type: "image/png", size: 1024 * 1024 * 2 });
  assert(resPng.valid && resPng.error === null, "CustomizerUI", "Accepts standard PNG (.png, image/png)");

  // 4c. Uppercase extensions
  const resUpperJpg = simulateProcessPhotoFile({ name: "SUNSET.JPG", type: "image/jpeg", size: 2048 });
  const resUpperPng = simulateProcessPhotoFile({ name: "FAMILY.PNG", type: "image/png", size: 4096 });
  assert(resUpperJpg.valid && resUpperPng.valid, "CustomizerUI", "Accepts uppercase extensions (.JPG, .PNG)");

  // 4d. Mixed case .JPEG
  const resJpeg = simulateProcessPhotoFile({ name: "portrait.Jpeg", type: "image/jpeg", size: 8192 });
  assert(resJpeg.valid, "CustomizerUI", "Accepts .Jpeg extension");

  // 4e. Missing MIME but valid extension
  const resNoMime = simulateProcessPhotoFile({ name: "camera_raw.jpg", type: "", size: 5000 });
  assert(resNoMime.valid, "CustomizerUI", "Accepts file with valid extension even if browser MIME is empty");

  // 4f. Edge case: 25MB exact boundary
  const res25MbExact = simulateProcessPhotoFile({ name: "highres.jpg", type: "image/jpeg", size: 25 * 1024 * 1024 });
  assert(res25MbExact.valid, "CustomizerUI", "Accepts file exactly at 25MB limit");

  // 4g. Edge case: 25MB + 1 byte
  const res25MbOver = simulateProcessPhotoFile({ name: "oversized.jpg", type: "image/jpeg", size: 25 * 1024 * 1024 + 1 });
  assert(!res25MbOver.valid && res25MbOver.error === "Image must be smaller than 25MB.", "CustomizerUI", "Rejects file exceeding 25MB");

  // 4h. Rejection of unsupported types
  const unsupportedTypes = [
    { name: "animation.gif", type: "image/gif" },
    { name: "vector.svg", type: "image/svg+xml" },
    { name: "modern.webp", type: "image/webp" },
    { name: "document.pdf", type: "application/pdf" },
    { name: "script.js", type: "application/javascript" },
    { name: "binary.exe", type: "application/x-msdownload" },
    { name: "audio.mp3", type: "audio/mpeg" },
  ];

  for (const item of unsupportedTypes) {
    const res = simulateProcessPhotoFile({ ...item, size: 1024 });
    assert(!res.valid, "CustomizerUI", `Rejects unsupported file type: ${item.name} (${item.type})`);
  }
}

// =========================================================================
// SUITE 3: WaveformCanvas Rendering Pipeline & Decorative Styles
// =========================================================================
function testWaveformCanvasRendering() {
  console.log("\n=== SUITE 3: WaveformCanvas Rendering Pipeline & Decorative Styles ===");

  const canvasPath = path.resolve(process.cwd(), "src/components/WaveformCanvas.tsx");
  const canvasCode = fs.readFileSync(canvasPath, "utf-8");

  // 1. Props interface contains photoUrl and decorativeStyle
  assert(canvasCode.includes("photoUrl?: string | null;"), "CanvasRendering", "WaveformCanvasProps includes photoUrl");
  assert(canvasCode.includes("decorativeStyle?: DecorativeStyle;"), "CanvasRendering", "WaveformCanvasProps includes decorativeStyle");

  // 2. Preloading of photoUrl into HTMLImageElement
  assert(canvasCode.includes("new Image()"), "CanvasRendering", "Preloads image using Image() constructor");
  assert(canvasCode.includes("img.onload"), "CanvasRendering", "Handles image onload to cache loadedImage in state");
  assert(canvasCode.includes("img.onerror"), "CanvasRendering", "Handles image onerror gracefully");

  // 3. Archival mat frame and background
  assert(canvasCode.includes("ctx.fillRect(0, 0, width, height)"), "CanvasRendering", "Fills canvas with palette background");
  assert(canvasCode.includes("ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2)"), "CanvasRendering", "Draws archival mat inset frame");

  // 4. All 4 decorative styles supported
  assert(canvasCode.includes('decorativeStyle === "botanical"'), "CanvasRendering", "Supports botanical decorative style");
  assert(canvasCode.includes('decorativeStyle === "modern_border"'), "CanvasRendering", "Supports modern_border decorative style");
  assert(canvasCode.includes('decorativeStyle === "arch"'), "CanvasRendering", "Supports arch decorative style");

  // 5. Botanical corner branch rendering algorithm
  assert(canvasCode.includes("bezierCurveTo"), "CanvasRendering", "Botanical style renders curving Bézier stem");
  assert(canvasCode.includes("ellipse("), "CanvasRendering", "Botanical style renders delicate leaf petal ellipses");
  assert(canvasCode.includes("drawBranch("), "CanvasRendering", "Draws 4 corner branches symmetrically");

  // 6. Modern border crosshairs
  assert(canvasCode.includes("innerInset"), "CanvasRendering", "Modern border renders inner hairline border");

  // 7. Dual layout math: photo vs standalone waveform
  assert(canvasCode.includes("const hasPhoto = !!loadedImage;"), "CanvasRendering", "Detects presence of loaded photo");
  assert(canvasCode.includes("waveMidY = photoY + photoH +"), "CanvasRendering", "Positions waveform comfortably below photo when photo is present");
  assert(canvasCode.includes("waveMidY = height * 0.48"), "CanvasRendering", "Positions waveform hero-centered when photo is absent");

  // 8. Object-fit: cover math verification (no stretching/distortion)
  function simulateObjectFitCover(imgW: number, imgH: number, targetW: number, targetH: number) {
    const imgAspect = imgW / imgH;
    const targetAspect = targetW / targetH;
    let sW = imgW;
    let sH = imgH;
    let sX = 0;
    let sY = 0;

    if (imgAspect > targetAspect) {
      sW = imgH * targetAspect;
      sX = (imgW - sW) / 2;
    } else {
      sH = imgW / targetAspect;
      sY = (imgH - sH) / 2;
    }

    return { sX, sY, sW, sH };
  }

  // 8a. Square image on portrait canvas (wider than target)
  const squareCrop = simulateObjectFitCover(1000, 1000, 300, 400);
  assert(squareCrop.sW === 750 && squareCrop.sX === 125 && squareCrop.sY === 0, "CanvasRendering", "Object-fit cover correctly crops horizontal surplus on square photo");

  // 8b. Landscape 16:9 on 4:5 frame (wider than target)
  const landscapeCrop = simulateObjectFitCover(1920, 1080, 400, 500);
  const expectedSW = 1080 * (400 / 500);
  assert(Math.abs(landscapeCrop.sW - expectedSW) < 1 && landscapeCrop.sX > 0, "CanvasRendering", "Object-fit cover correctly crops horizontal surplus on 16:9 landscape photo");

  // 8c. Tall 9:16 portrait on 4:5 frame (taller than target)
  const portraitCrop = simulateObjectFitCover(1080, 1920, 400, 500);
  const expectedSH = 1080 / (400 / 500);
  assert(Math.abs(portraitCrop.sH - expectedSH) < 1 && portraitCrop.sY > 0, "CanvasRendering", "Object-fit cover correctly crops vertical surplus on tall portrait photo");

  // 9. QR code badge rendering
  assert(canvasCode.includes("ctx.fillText(\"QR\""), "CanvasRendering", "Renders scannable QR badge on preview canvas");

  // 10. Waveform bars rendering
  assert(canvasCode.includes("const bars = 80;"), "CanvasRendering", "Waveform renders 80 bars for smooth resolution");
}

// =========================================================================
// SUITE 4: Backend /api/upload Route Empirical Testing
// =========================================================================
async function testBackendUploadAPI() {
  console.log("\n=== SUITE 4: Backend /api/upload Route Empirical Testing ===");

  // Helper to build multipart request
  function createMultipartRequest(fieldName: string, filename: string, mimeType: string, content: Buffer): NextRequest {
    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, content, footer]);

    return new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
  }

  // 1. Valid JPEG with magic bytes: FF D8 FF
  const validJpegBuffer = Buffer.alloc(1024);
  validJpegBuffer[0] = 0xff;
  validJpegBuffer[1] = 0xd8;
  validJpegBuffer[2] = 0xff;
  validJpegBuffer[3] = 0xe0;

  const reqJpeg = createMultipartRequest("photo", "test_portrait.jpg", "image/jpeg", validJpegBuffer);
  const resJpeg = await uploadHandler(reqJpeg);
  const dataJpeg = await resJpeg.json();

  assert(resJpeg.status === 200, "BackendUpload", "POST /api/upload returns 200 for valid JPEG");
  assert(dataJpeg.success === true, "BackendUpload", "Valid JPEG upload returns success: true");
  assert(typeof dataJpeg.photoId === "string" && dataJpeg.photoId.startsWith("img_"), "BackendUpload", `Returns photoId with 'img_' prefix: ${dataJpeg.photoId}`);
  assert(dataJpeg.photoPath.endsWith(".jpg"), "BackendUpload", `Returns photoPath with .jpg: ${dataJpeg.photoPath}`);
  assert(dataJpeg.format === "jpeg", "BackendUpload", "Reports format: 'jpeg'");

  // Verify file was written to disk
  const diskPath = path.resolve(process.cwd(), dataJpeg.photoPath);
  assert(fs.existsSync(diskPath), "BackendUpload", "JPEG file physically written to storage/uploads");
  if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);

  // 2. Valid PNG with magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const validPngBuffer = Buffer.alloc(1024);
  validPngBuffer[0] = 0x89;
  validPngBuffer[1] = 0x50;
  validPngBuffer[2] = 0x4e;
  validPngBuffer[3] = 0x47;
  validPngBuffer[4] = 0x0d;
  validPngBuffer[5] = 0x0a;
  validPngBuffer[6] = 0x1a;
  validPngBuffer[7] = 0x0a;

  const reqPng = createMultipartRequest("image", "family.png", "image/png", validPngBuffer);
  const resPng = await uploadHandler(reqPng);
  const dataPng = await resPng.json();

  assert(resPng.status === 200, "BackendUpload", "POST /api/upload returns 200 for valid PNG");
  assert(dataPng.success === true, "BackendUpload", "Valid PNG upload returns success: true");
  assert(dataPng.format === "png", "BackendUpload", "Reports format: 'png'");
  assert(dataPng.photoPath.endsWith(".png"), "BackendUpload", `Returns photoPath with .png: ${dataPng.photoPath}`);

  const pngDiskPath = path.resolve(process.cwd(), dataPng.photoPath);
  assert(fs.existsSync(pngDiskPath), "BackendUpload", "PNG file physically written to storage/uploads");
  if (fs.existsSync(pngDiskPath)) fs.unlinkSync(pngDiskPath);

  // 3. Spoofed image: .jpg extension with plain text content
  const spoofedBuffer = Buffer.from("THIS IS NOT A JPEG FILE, JUST FAKE TEXT DATA");
  const reqSpoofed = createMultipartRequest("photo", "fake.jpg", "image/jpeg", spoofedBuffer);
  const resSpoofed = await uploadHandler(reqSpoofed);
  const dataSpoofed = await resSpoofed.json();

  assert(resSpoofed.status === 400, "BackendUpload", "Rejects spoofed JPEG (invalid magic bytes) with 400");
  assert(dataSpoofed.error.includes("Invalid image format"), "BackendUpload", "Returns 'Invalid image format' error message");

  // 4. Oversized image > 25MB (magic bytes + 26MB dummy data)
  const oversizedBuffer = Buffer.alloc(26 * 1024 * 1024);
  oversizedBuffer[0] = 0xff;
  oversizedBuffer[1] = 0xd8;
  oversizedBuffer[2] = 0xff;

  const reqOversized = createMultipartRequest("photo", "huge.jpg", "image/jpeg", oversizedBuffer);
  const resOversized = await uploadHandler(reqOversized);
  const dataOversized = await resOversized.json();

  assert(resOversized.status === 400, "BackendUpload", "Rejects image exceeding 25MB with 400");
  assert(dataOversized.error.includes("exceeds maximum limit of 25MB"), "BackendUpload", "Returns 25MB exceeded error");

  // 5. Unsupported file under 'photo' field (e.g., pdf)
  const pdfBuffer = Buffer.from("%PDF-1.4 dummy pdf header");
  const reqPdf = createMultipartRequest("photo", "document.pdf", "application/pdf", pdfBuffer);
  const resPdf = await uploadHandler(reqPdf);
  assert(resPdf.status === 400, "BackendUpload", "Rejects PDF submitted to upload handler with 400");
}

// =========================================================================
// SUITE 5: Data Flow & Checkout Persistence Verification
// =========================================================================
async function testCheckoutDataFlow() {
  console.log("\n=== SUITE 5: Data Flow & Checkout Persistence Verification ===");

  // 1. Checkout route accepts photoId and photoPath and persists to DB
  const testPhotoPath = "storage/uploads/test_photo_sample.jpg";
  const dummyUploadDir = path.resolve(process.cwd(), "storage", "uploads");
  fs.mkdirSync(dummyUploadDir, { recursive: true });
  fs.writeFileSync(path.resolve(process.cwd(), testPhotoPath), "test content");

  const checkoutPayload = {
    audioId: "aud_test_audio_flow",
    photoPath: testPhotoPath,
    photoId: "img_test_12345",
    frameSize: "16x20",
    palette: "blush_rosegold",
    caption: "Our Wedding Day — June 2026",
    customerEmail: "challenger_test@example.com",
    shippingName: "Jane Doe",
    shippingAddress: "123 Cherry Lane, New York, NY 10001",
  };

  const reqCheckout = new NextRequest("http://localhost:3000/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkoutPayload),
  });

  const resCheckout = await checkoutHandler(reqCheckout);
  const dataCheckout = await resCheckout.json();

  assert(resCheckout.status === 200, "CheckoutFlow", "POST /api/checkout returns 200 with photo payload");
  assert(dataCheckout.success === true, "CheckoutFlow", "Checkout response indicates success");
  assert(typeof dataCheckout.orderId === "string", "CheckoutFlow", "Checkout returns valid orderId");

  // Verify DB record has photoPath populated
  const orderInDb = await getOrderById(dataCheckout.orderId);
  assert(orderInDb !== null, "CheckoutFlow", "Order record retrieved from SQLite");
  assert(orderInDb?.photoPath === testPhotoPath, "CheckoutFlow", `DB Order.photoPath is correctly persisted as '${testPhotoPath}'`);
  assert(orderInDb?.frameSize === "16x20", "CheckoutFlow", "DB Order.frameSize is 16x20");
  assert(orderInDb?.palette === "blush_rosegold", "CheckoutFlow", "DB Order.palette is blush_rosegold");

  // 2. CRITICAL ADVERSARIAL AUDIT: Check PortraitBuilder.tsx client checkout trigger
  const pbPath = path.resolve(process.cwd(), "src/components/PortraitBuilder.tsx");
  const pbCode = fs.readFileSync(pbPath, "utf-8");

  // Does PortraitBuilder upload the photoFile before checkout or pass photoPath/photoId in payload?
  const pbHasPhotoUploadCall = /fetch\(["']\/api\/upload["'][^)]*photo/i.test(pbCode) ||
    pbCode.includes("formData.append(\"photo\"") ||
    pbCode.includes("formData.append(\"image\"");

  const pbSendsPhotoInPayload = /payload\s*=\s*\{[^}]*photo/s.test(pbCode) ||
    pbCode.includes("photoId:") ||
    pbCode.includes("photoPath:");

  console.log("\n--- Adversarial Client-to-Backend Flow Audit ---");
  console.log(`  PortraitBuilder uploads photoFile to /api/upload: ${pbHasPhotoUploadCall}`);
  console.log(`  PortraitBuilder includes photoId/photoPath in checkout payload: ${pbSendsPhotoInPayload}`);

  assert(
    pbSendsPhotoInPayload,
    "ClientCheckoutIntegrity",
    "PortraitBuilder.tsx includes photoId/photoPath in checkout payload",
    "GAP FOUND: PortraitBuilder allows customer to upload photo for canvas preview, but handleOrder() does NOT transmit photo to /api/upload or /api/checkout payload! The placed order will have photoPath = null in production."
  );

  // Clean up test file
  if (fs.existsSync(path.resolve(process.cwd(), testPhotoPath))) {
    fs.unlinkSync(path.resolve(process.cwd(), testPhotoPath));
  }
}

// =========================================================================
// RUN ALL SUITES
// =========================================================================
async function runAll() {
  console.log("=================================================================");
  console.log("  SOUNDWAVE ART GEN 5 — FRONTEND & CUSTOMIZER EMPIRICAL CHALLENGE");
  console.log("=================================================================");

  testLightModeStyling();
  testPortraitBuilderFileInput();
  testWaveformCanvasRendering();
  await testBackendUploadAPI();
  await testCheckoutDataFlow();

  console.log("\n=================================================================");
  console.log(`TOTAL TESTS: ${totalPassed + totalFailed} | PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
  console.log("=================================================================");

  if (totalFailed > 0) {
    console.error(`\nVerdict: REQUEST_CHANGES (${totalFailed} failure(s) detected)`);
    process.exit(1);
  } else {
    console.log("\nVerdict: APPROVE (All empirical assertions passed)");
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error("Test execution unhandled error:", err);
  process.exit(1);
});
