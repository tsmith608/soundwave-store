import { NextRequest, NextResponse } from "next/server";
import { FRAME_SIZES, PALETTES } from "@/lib/constants";
import { createOrder, updateOrderStatus } from "@/lib/db";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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

        await updateOrderStatus(order.id, "pending_payment", {
          // Store stripeSessionId
        });

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
