import { NextRequest, NextResponse } from "next/server";
import { FRAME_SIZES, PALETTES } from "@/lib/constants";
import { createOrder, updateOrderStatus } from "@/lib/db";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { cleanFields, getSellableDesign, sanitizePeaks } from "@/lib/art";
import { FRAME_FINISHES, getPrintSize, type ProductFormat } from "@/lib/catalog";

const UPLOAD_ID = /^(aud|img)_[a-f0-9]{16}$/;

function findUpload(id: unknown, prefix: "aud" | "img", exts: string[]): string | null {
  if (typeof id !== "string" || !UPLOAD_ID.test(id) || !id.startsWith(prefix)) return null;
  const dir = path.resolve(process.cwd(), "storage", "uploads");
  for (const ext of exts) {
    const f = path.join(dir, `${id}${ext}`);
    if (fs.existsSync(f)) return path.relative(process.cwd(), f).replace(/\\/g, "/");
  }
  return null;
}

/**
 * Curated-design checkout: the body names a design, colourway, the
 * customer's words, the waveform peaks computed in the browser, and a size
 * and format from the catalogue. Everything is validated server-side and
 * stored as Order.artworkSpec, which the print renderer consumes as-is.
 */
async function curatedCheckout(request: NextRequest, body: any) {
  const design = getSellableDesign(body.designId);
  if (!design) return NextResponse.json({ error: "Unknown design" }, { status: 400 });
  const size = getPrintSize(body.size);
  if (!size) return NextResponse.json({ error: "Invalid size" }, { status: 400 });
  const format: ProductFormat = body.format === "print" ? "print" : "framed";
  const frameFinish = FRAME_FINISHES.some((f) => f.id === body.frameFinish) ? body.frameFinish : "black";
  const colorway = design.colorways.find((c) => c.id === body.colorwayId) ?? design.colorways[0];
  const fields = cleanFields(design, body.fields ?? {});
  const missing = design.fields.filter((f) => f.required && !fields[f.key]);
  if (missing.length) {
    return NextResponse.json({ error: `Please fill in: ${missing.map((f) => f.label).join(", ")}` }, { status: 400 });
  }
  const peaks = sanitizePeaks(body.peaks);
  const audioPath = findUpload(body.audioId, "aud", [".wav", ".mp3", ".webm", ".m4a"]);
  if (!peaks || !audioPath) {
    return NextResponse.json({ error: "Please add your recording before checking out." }, { status: 400 });
  }
  const photoPath = design.supportsPhoto ? findUpload(body.photoId, "img", [".jpg", ".png"]) : null;
  const email = typeof body.customerEmail === "string" && /.+@.+\..+/.test(body.customerEmail) ? body.customerEmail.slice(0, 200) : "pending@checkout";
  const priceCents = size.price[format];

  const listenToken = crypto.randomBytes(12).toString("base64url");
  const host0 = request.headers.get("host") || "localhost:3000";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.headers.get("x-forwarded-proto") || "http"}://${host0}`;
  const spec = {
    version: 1,
    qrUrl: `${appUrl.replace(/\/$/, "")}/l/${listenToken}`,
    designId: design.id,
    colorwayId: colorway.id,
    fields,
    peaks: peaks.map((p) => Math.round(p * 1000) / 1000),
    showQr: body.showQr !== false,
    qrStyle: body.qrStyle === "standard" ? "standard" : "discreet",
    format,
    frameFinish: format === "framed" ? frameFinish : null,
    sizeId: size.id,
    widthIn: size.widthIn,
    heightIn: size.heightIn,
    photoPath,
  };

  const orderId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const order = await createOrder({
    id: orderId,
    customerEmail: email,
    frameSize: size.id,
    palette: colorway.id,
    caption: [fields.title, fields.names].filter(Boolean).join(" — ").slice(0, 200) || null,
    audioPath,
    photoPath,
    decorativeTheme: design.id,
    artworkSpec: JSON.stringify(spec),
    listenToken,
    totalAmount: priceCents,
    status: "pending_payment",
  });

  const host = request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
  const productName = `${design.name} — ${size.label} ${format === "framed" ? "framed print" : "art print"}`;

  if (isStripeConfigured && stripe) {
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_creation: "always",
        shipping_address_collection: { allowed_countries: ["US"] },
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: productName, description: fields.title || fields.names || undefined },
              unit_amount: priceCents,
            },
            quantity: 1,
          },
        ],
        metadata: { orderId: order.id, designId: design.id, sizeId: size.id, format },
        success_url: `${origin}/order/${order.id}?session_id={CHECKOUT_SESSION_ID}&status=success`,
        cancel_url: `${origin}/create?design=${design.id}`,
      });
      await updateOrderStatus(order.id, "pending_payment", { stripeSessionId: session.id });
      return NextResponse.json({ success: true, orderId: order.id, checkoutUrl: session.url, sessionId: session.id, value: priceCents / 100 });
    } catch (err: any) {
      console.error("Stripe session creation failed:", err.message);
      return NextResponse.json({ error: "Payment is temporarily unavailable. Your design is saved — please try again shortly." }, { status: 502 });
    }
  }

  // Payments not configured yet: show the saved order so the flow can be tested end to end.
  return NextResponse.json({
    success: true,
    orderId: order.id,
    checkoutUrl: `${origin}/order/${order.id}?preview_checkout=1`,
    sessionId: null,
    paymentsEnabled: false,
    value: priceCents / 100,
  });
}

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (body && typeof body.designId === "string") {
      return await curatedCheckout(request, body);
    }

    const {
      audioId,
      photoId,
      photoPath: reqPhotoPath,
      frameSize,
      palette,
      caption,
      customerEmail,
      shippingName,
      shippingAddress,
      decorativeStyle,
      decorativeTheme,
    } = body;

    const resolvedDecorativeTheme = (
      (typeof decorativeTheme === "string" && decorativeTheme.trim()) ||
      (typeof decorativeStyle === "string" && decorativeStyle.trim()) ||
      (typeof body.theme === "string" && body.theme.trim()) ||
      "botanical"
    );

    // Validate frame size
    if (!frameSize || typeof frameSize !== "string" || !FRAME_SIZES[frameSize]) {
      return NextResponse.json(
        {
          error: "Invalid frame size. Allowed sizes: 8x10, 11x14, 16x20, 24x36",
        },
        { status: 400 }
      );
    }

    const frameConfig = FRAME_SIZES[frameSize];

    // Validate caption length (boundary: max 200 chars)
    if (caption && typeof caption === "string" && caption.length > 200) {
      return NextResponse.json(
        { error: "Caption exceeds maximum length of 200 characters" },
        { status: 400 }
      );
    }

    // Resolve palette ID
    let paletteId = "midnight_gold";
    if (typeof palette === "string" && PALETTES[palette]) {
      paletteId = palette;
    } else if (palette && typeof palette === "object" && palette.id && PALETTES[palette.id]) {
      paletteId = palette.id;
    } else if (typeof palette === "string") {
      const match = Object.keys(PALETTES).find(
        (k) => k.toLowerCase() === palette.toLowerCase() || PALETTES[k].name.toLowerCase() === palette.toLowerCase()
      );
      if (match) paletteId = match;
    }

    // Resolve audio path
    let audioPath = body.audioPath;
    if (!audioPath && audioId) {
      const storageDir = path.resolve(process.cwd(), "storage", "uploads");
      const candidateFiles = [
        path.join(storageDir, `${audioId}.wav`),
        path.join(storageDir, `${audioId}.mp3`),
        path.join(storageDir, `${audioId}.webm`),
      ];
      for (const cf of candidateFiles) {
        if (fs.existsSync(cf)) {
          audioPath = path.relative(process.cwd(), cf).replace(/\\/g, "/");
          break;
        }
      }
      if (!audioPath) {
        audioPath = `storage/uploads/${audioId}.wav`;
      }
    } else if (!audioPath) {
      audioPath = "storage/uploads/default_sample.wav";
    }

    // Resolve photo path
    let photoPath = reqPhotoPath || body.imagePath || null;
    const resolvedPhotoId = photoId || body.imageId || null;
    if (!photoPath && resolvedPhotoId) {
      const storageDir = path.resolve(process.cwd(), "storage", "uploads");
      const candidatePhotoFiles = [
        path.join(storageDir, `${resolvedPhotoId}.jpg`),
        path.join(storageDir, `${resolvedPhotoId}.jpeg`),
        path.join(storageDir, `${resolvedPhotoId}.png`),
      ];
      for (const cf of candidatePhotoFiles) {
        if (fs.existsSync(cf)) {
          photoPath = path.relative(process.cwd(), cf).replace(/\\/g, "/");
          break;
        }
      }
      if (!photoPath) {
        photoPath = `storage/uploads/${resolvedPhotoId}.jpg`;
      }
    }

    const sanitizedCaption = caption ? String(caption).slice(0, 200) : "";
    const sanitizedEmail = customerEmail && typeof customerEmail === "string" ? customerEmail : "customer@example.com";

    // Generate compliant unique order ID starting with 'ord_'
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const orderId = `ord_${Date.now().toString(36)}_${randomSuffix}`;

    // Create database order record
    const order = await createOrder({
      id: orderId,
      customerEmail: sanitizedEmail,
      shippingName: shippingName || null,
      shippingAddress: shippingAddress || null,
      frameSize,
      palette: paletteId,
      caption: sanitizedCaption || null,
      audioPath,
      photoPath: photoPath || null,
      decorativeTheme: resolvedDecorativeTheme,
      totalAmount: frameConfig.priceCents,
      status: "pending_payment",
    });

    const host = request.headers.get("host") || "localhost:3000";
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const origin = `${proto}://${host}`;

    // Handle real Stripe Checkout if configured
    if (isStripeConfigured && stripe) {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          customer_creation: "always",
          phone_number_collection: { enabled: true },
          shipping_address_collection: {
            allowed_countries: ["US", "CA", "GB", "AU", "DE", "FR"],
          },
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `SoundWave Art — ${frameConfig.name}`,
                  description: sanitizedCaption
                    ? `Custom SoundWave Art: "${sanitizedCaption}"`
                    : `Custom Framed SoundWave Art (${frameConfig.dimensions})`,
                },
                unit_amount: frameConfig.priceCents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            orderId: order.id,
            frameSize: frameConfig.id,
            paletteId: paletteId,
            caption: sanitizedCaption,
            audioId: audioId || "",
            photoId: resolvedPhotoId || "",
            photoPath: photoPath || "",
            decorativeTheme: resolvedDecorativeTheme,
          },
          success_url: `${origin}/order/${order.id}?session_id={CHECKOUT_SESSION_ID}&status=success`,
          cancel_url: `${origin}/#builder`,
        });

        await updateOrderStatus(order.id, "pending_payment", { stripeSessionId: session.id });

        return NextResponse.json({
          success: true,
          orderId: order.id,
          checkoutUrl: session.url || `${origin}/order/${order.id}`,
          sessionId: session.id,
        });
      } catch (stripeErr: any) {
        console.warn("Stripe API call failed, falling back to simulated session:", stripeErr.message);
      }
    }

    // Mock / test mode Stripe checkout session
    const mockSessionId = `cs_test_${order.id}_${Date.now()}`;
    const checkoutUrl = `${origin}/order/${order.id}?session_id=${mockSessionId}&mock_payment=true`;

    return NextResponse.json({
      success: true,
      orderId: order.id,
      checkoutUrl,
      sessionId: mockSessionId,
    });
  } catch (error: any) {
    console.error("Checkout creation error:", error);
    return NextResponse.json(
      { error: "Failed to initialize checkout session", details: error.message },
      { status: 500 }
    );
  }
}
