"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { FRAME_SIZES, PALETTES } from "@/lib/constants";
import FramedArtwork from "@/components/art/FramedArtwork";
import { getDesign, type ArtFields } from "@/lib/art";
import { track } from "@/lib/analytics";

interface OrderArtwork {
  designId: string;
  colorwayId: string;
  fields: ArtFields;
  peaks: number[];
  showQr: boolean;
  format: "framed" | "print";
  frameFinish: string | null;
  widthIn: number;
  heightIn: number;
}

interface OrderData {
  id: string;
  orderId: string;
  status: string;
  statusLabel: string;
  previewUrl: string | null;
  frameSize: string;
  palette: string;
  caption: string | null;
  partnerOrderId: string | null;
  totalAmount: number;
  artwork?: OrderArtwork | null;
  customerEmail?: string;
  shippingName?: string;
  shippingAddress?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STEPS = [
  { key: "pending_payment", label: "Awaiting Payment" },
  { key: "pending_fulfillment", label: "Payment Confirmed" },
  { key: "fulfillment_submitted", label: "Print Submitted" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

function maskStreet(address: string | null | undefined): string {
  if (!address) return "Added at checkout";
  const parts = address.split(",");
  if (parts.length > 1) {
    return "*** " + parts.slice(1).join(", ").trim();
  }
  return "*** " + address.slice(-10);
}

function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@") || email === "pending@checkout") return "Added at checkout";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `*@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

export default function OrderStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
        setError(null);
      } else if (res.status === 404) {
        setError("Order not found. Please check your order ID.");
      } else {
        setError("Failed to retrieve order details.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();

    // Auto-poll while order is in active fulfillment
    const interval = setInterval(() => {
      fetchOrder();
    }, 4000);

    return () => clearInterval(interval);
  }, [orderId]);

  const [isTestOrder, setIsTestOrder] = useState(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setIsTestOrder(sp.get("preview_checkout") === "1");
  }, []);

  // Browser half of the purchase conversion; the server sends the same event_id from the Stripe webhook.
  useEffect(() => {
    if (!order || order.status === "pending_payment") return;
    if (new URLSearchParams(window.location.search).get("status") !== "success") return;
    track(
      "purchase",
      { order_id: order.id, value: order.totalAmount / 100, currency: "USD", design_id: order.artwork?.designId, size: order.frameSize },
      { eventId: `purchase_${order.id}`, onceKey: order.id }
    );
  }, [order]);

  const frameConfig = order ? FRAME_SIZES[order.frameSize] : null;
  const paletteConfig = order ? PALETTES[order.palette] : null;

  // Determine active step index
  const currentStatus = order?.status || "pending_payment";
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === currentStatus);
  const activeIndex = currentStepIndex >= 0 ? currentStepIndex : 1;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2D2A26] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#EAE3DC] bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#B76E79] flex items-center justify-center text-white font-serif font-bold text-xs shadow-sm">
              SW
            </div>
            <span className="font-serif text-lg font-bold text-[#2D2A26] tracking-wide">
              SoundWave Art
            </span>
          </Link>

          <Link
            href="/create"
            className="text-xs uppercase font-semibold tracking-wider text-[#B76E79] hover:underline"
          >
            Create another →
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-[#B76E79] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[#6B655F] text-sm">Locating your custom order details...</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 border border-red-300 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-2xl font-serif text-[#2D2A26]">Order Not Found</h2>
            <p className="text-[#6B655F] text-sm">{error}</p>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-[#B76E79] text-white font-semibold text-sm"
            >
              Return Home
            </Link>
          </div>
        ) : order ? (
          <div className="space-y-8">
            {/* Order Confirmation Banner */}
            <div className="bg-white border border-[#EAE3DC] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#B76E79] bg-[#B76E79]/10 px-2.5 py-0.5 rounded border border-[#B76E79]/20">
                  {order.statusLabel || "Payment Confirmed"}
                </span>
                <h1 className="text-2xl sm:text-3xl font-serif text-[#2D2A26] mt-2">
                  Order #{order.id}
                </h1>
                <p className="text-xs text-[#6B655F] mt-1">
                  Placed on {new Date(order.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="text-right sm:text-right">
                <span className="text-xs text-[#6B655F] block">{order.status === "pending_payment" ? "Total" : "Total Paid"}</span>
                <span className="text-2xl font-serif font-bold text-[#2D2A26]">
                  ${(order.totalAmount / 100).toFixed(2)}
                </span>
              </div>
            </div>

            {isTestOrder && (
              <div className="rounded-xl border border-[#E3D3B8] bg-[#FBF5EA] px-5 py-4 text-sm text-[#5C4A2E]">
                Payments aren&apos;t switched on yet, so this order was saved as a test and nothing was charged.
              </div>
            )}

            {/* Stepper Progression */}
            <div className="bg-white border border-[#EAE3DC] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#2D2A26] mb-6">
                Fulfillment Status
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative">
                {STATUS_STEPS.map((step, idx) => {
                  const isDone = idx <= activeIndex;
                  const isCurrent = idx === activeIndex;

                  return (
                    <div key={step.key} className="flex flex-col items-center text-center space-y-2">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                          isDone
                            ? "bg-[#B76E79] text-white shadow-md shadow-[#B76E79]/20"
                            : "bg-[#FAF7F2] border border-[#EAE3DC] text-[#9E968F]"
                        } ${isCurrent ? "ring-4 ring-[#B76E79]/30 scale-110" : ""}`}
                      >
                        {isDone ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          isCurrent ? "text-[#B76E79] font-bold" : isDone ? "text-[#2D2A26]" : "text-[#9E968F]"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Artwork Preview & Specs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Artwork Preview Card */}
              <div className="lg:col-span-6 bg-white border border-[#EAE3DC] rounded-2xl p-6 flex flex-col items-center justify-center shadow-sm">
                <span className="text-xs uppercase tracking-wider text-[#6B655F] font-semibold mb-4 self-start">
                  Artwork Proof Preview
                </span>

                {order.artwork && getDesign(order.artwork.designId) ? (
                  <div className="w-full max-w-[380px] bg-[#EDE8E1] p-8">
                    <FramedArtwork
                      designId={order.artwork.designId}
                      fields={order.artwork.fields}
                      peaks={order.artwork.peaks}
                      colorwayId={order.artwork.colorwayId}
                      widthIn={order.artwork.widthIn}
                      heightIn={order.artwork.heightIn}
                      showQr={order.artwork.showQr}
                      format={order.artwork.format}
                      frameFinish={order.artwork.frameFinish ?? "black"}
                      idPrefix="order"
                    />
                  </div>
                ) : (
                <div
                  className="w-full max-w-[360px] bg-[#FDFBF7] p-4 rounded-xl border-4 border-[#E8DDD1] shadow-md overflow-hidden"
                  style={{
                    aspectRatio: frameConfig?.aspectRatio || "4/5",
                  }}
                >
                  <img
                    src={`/api/orders/${order.id}/preview`}
                    alt="SoundWave Art Preview"
                    className="w-full h-full object-cover rounded shadow-sm"
                    onError={(e) => {
                      // Fallback if image fails to load
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
                )}

                <p className="text-[11px] text-[#6B655F] mt-4 text-center">
                  {order.artwork ? "This is the exact artwork we print, rendered from your order." : "Low-res preview proof • High-res 300 DPI file currently in print production"}
                </p>
              </div>

              {/* Order Details & Specifications */}
              <div className="lg:col-span-6 space-y-6">
                <div className="bg-white border border-[#EAE3DC] rounded-2xl p-6 space-y-4 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#2D2A26]">
                    Art Specifications
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-[#EAE3DC]">
                      <span className="text-[#6B655F]">Frame Size</span>
                      <span className="text-[#2D2A26] font-medium">{frameConfig?.dimensions || order.frameSize}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#EAE3DC]">
                      <span className="text-[#6B655F]">Colourway</span>
                      <span className="text-[#2D2A26] font-medium">{paletteConfig?.name || order.palette}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#EAE3DC]">
                      <span className="text-[#6B655F]">Words</span>
                      <span className="text-[#2D2A26] font-serif italic">{order.caption || "None"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#EAE3DC]">
                      <span className="text-[#6B655F]">Audio Playback QR Code</span>
                      <span className="text-[#2D2A26] font-medium">{order.artwork && !order.artwork.showQr ? "Not included" : "Included"}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[#6B655F]">Paper Quality</span>
                      <span className="text-[#2D2A26] font-medium">Archival matte fine-art paper</span>
                    </div>
                  </div>
                </div>

                {/* Delivery Information */}
                <div className="bg-white border border-[#EAE3DC] rounded-2xl p-6 space-y-3 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#2D2A26]">
                    Shipping & Tracking
                  </h3>

                  <div className="text-xs space-y-2 text-[#6B655F]">
                    <p>
                      <strong className="text-[#2D2A26]">Shipping Address:</strong> {maskStreet(order.shippingAddress)}
                    </p>
                    <p>
                      <strong className="text-[#2D2A26]">Notification Email:</strong> {maskEmail(order.customerEmail)}
                    </p>
                    <p>
                      <strong className="text-[#2D2A26]">Shipping:</strong> Tracked US delivery
                    </p>
                    {order.partnerOrderId && (
                      <p>
                        <strong className="text-[#2D2A26]">Partner Ref:</strong>{" "}
                        <span className="font-mono text-[#B76E79] font-medium">{order.partnerOrderId}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
