import type { Order, OrderItem, Shipment } from "@prisma/client";
import { formatCents } from "@/lib/commerce";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/site";
import { getEnv } from "../env";
import { orderUrl } from "../orders/access";

/**
 * Transactional email templates. Plain, fast-loading HTML with a text
 * alternative. Every dynamic value is escaped. No customer media is embedded
 * or linked — only the words on their print, which they wrote.
 */
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type OrderWith = Order & { items: OrderItem[] };

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

function layout(title: string, body: string, preheader = ""): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#F2EDE3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#151412">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:2px solid #151412">
<tr><td style="padding:20px 24px;border-bottom:2px solid #151412;font-weight:800;font-size:18px;letter-spacing:-0.02em">${esc(BRAND_NAME)}</td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.55">${body}</td></tr>
<tr><td style="padding:16px 24px;border-top:2px solid #151412;font-size:13px;color:#57524B">Questions? Reply to this email or write to <a href="mailto:${esc(SUPPORT_EMAIL)}" style="color:#151412">${esc(SUPPORT_EMAIL)}</a>.${process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ? `<br>${esc(process.env.NEXT_PUBLIC_BUSINESS_ADDRESS)}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#151412;color:#F2EDE3;border-radius:999px;padding:13px 24px;font-weight:600;text-decoration:none;display:inline-block">${esc(label)}</a></p>`;
}

function itemsTable(o: OrderWith): { html: string; text: string } {
  const rows = o.items
    .map((i) => {
      const f = (i.artworkSpec as { fields?: Record<string, string> }).fields ?? {};
      const words = [f.title, f.names, f.date].filter(Boolean).join(" · ");
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #E9E2D4"><strong>${esc(i.designName)}</strong> — ${esc(i.productName)}${i.frameFinish ? `, ${esc(i.frameFinish)} frame` : ""}${i.quantity > 1 ? ` × ${i.quantity}` : ""}<br><span style="color:#57524B;font-size:14px">${esc(words)}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #E9E2D4;white-space:nowrap">${formatCents(i.lineTotalCents)}</td></tr>`;
    })
    .join("");
  const total = (label: string, cents: number, bold = false) =>
    `<tr><td style="padding:4px 0${bold ? ";font-weight:700" : ""}">${label}</td><td align="right" style="padding:4px 0${bold ? ";font-weight:700" : ""}">${formatCents(cents)}</td></tr>`;
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${rows}
${total("Subtotal", o.subtotalCents)}${o.discountCents ? total(`Discount${o.discountCode ? ` (${esc(o.discountCode)})` : ""}`, -o.discountCents) : ""}${total("Shipping", o.shippingCents)}${total("Tax", o.taxCents)}${total("Total", o.totalCents, true)}</table>`;
  const text = [
    ...o.items.map((i) => `- ${i.designName} — ${i.productName}${i.frameFinish ? `, ${i.frameFinish} frame` : ""} x${i.quantity}: ${formatCents(i.lineTotalCents)}`),
    `Subtotal ${formatCents(o.subtotalCents)}`,
    o.discountCents ? `Discount -${formatCents(o.discountCents)}` : "",
    `Shipping ${formatCents(o.shippingCents)}  Tax ${formatCents(o.taxCents)}`,
    `Total ${formatCents(o.totalCents)}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { html, text };
}

function address(o: Order): string {
  return [o.shipName, o.shipLine1, o.shipLine2, [o.shipCity, o.shipState, o.shipPostalCode].filter(Boolean).join(", "), o.shipCountry].filter(Boolean).join("\n");
}

function hello(o: Order) {
  const first = (o.customerName || o.shipName || "").split(" ")[0];
  return first ? `Hi ${first},` : "Hello,";
}

export function orderConfirmation(o: OrderWith, lead: { min: number; max: number }): Rendered {
  const t = itemsTable(o);
  const link = orderUrl(o.id);
  const physical = o.items.some((i) => i.format !== "digital");
  const next = physical
    ? `We print and frame each piece to order. Most orders arrive in about ${lead.min}–${lead.max} business days; we'll email tracking as soon as it ships. Your free digital copy will arrive by email shortly.`
    : "We're making your digital file now. You'll get an email with the download link in a few minutes.";
  const html = layout(
    `Order ${o.number} confirmed`,
    `<p>${esc(hello(o))}</p><p>Thank you — your order <strong>${esc(o.number)}</strong> is confirmed and paid. We're preparing your ${physical ? "print file" : "digital file"} now.</p>
${t.html}
${physical ? `<p style="margin-top:20px"><strong>Shipping to</strong><br>${esc(address(o)).replace(/\n/g, "<br>")}</p>` : ""}
<p><strong>What happens next</strong><br>${esc(next)}</p>
<p>Please check the names and dates above. If anything's wrong, reply within 12 hours and we'll fix it${physical ? " before it's printed" : ""}.</p>
${button(link, "View your order")}`,
    `Order ${o.number} is confirmed.`,
  );
  const text = `${hello(o)}\n\nThank you — your order ${o.number} is confirmed and paid.\n\n${t.text}\n\n${physical ? `Shipping to:\n${address(o)}\n\n` : ""}${next}\nIf a name or date is wrong, reply within 12 hours.\n\nView your order: ${link}\n`;
  return { subject: `Order ${o.number} confirmed — ${BRAND_NAME}`, html, text };
}

/** Download link for the digital file: the product itself for digital orders, a free extra with prints. */
export function digitalReady(o: OrderWith): Rendered {
  const link = orderUrl(o.id);
  const physical = o.items.some((i) => i.format !== "digital");
  const intro = physical ? "Your print is on its way, and here's something extra: the digital file of your artwork, free with your order." : "Your digital file is ready.";
  const about = "You'll find a high-resolution PNG (prints sharply up to 18 × 24 in) and a PDF that scales to any size. Print it anywhere, set it as a lock screen, or send a copy to family. It's yours for personal use.";
  return {
    subject: physical ? `Your free digital copy — order ${o.number}` : `Your digital file is ready — order ${o.number}`,
    html: layout(
      "Your digital file",
      `<p>${esc(hello(o))}</p><p>${esc(intro)}</p><p>${esc(about)}</p>${button(link, "Download your files")}<p style="font-size:14px;color:#57524B">The link on your order page stays available. If a name or date needs fixing, reply to this email.</p>`,
      intro,
    ),
    text: `${hello(o)}\n\n${intro}\n\n${about}\n\nDownload: ${link}\n`,
  };
}

export function paymentFailed(o: Order): Rendered {
  const cart = `${getEnv().NEXT_PUBLIC_APP_URL}/cart`;
  return {
    subject: `Your payment didn't go through — order ${o.number}`,
    html: layout("Payment failed", `<p>${esc(hello(o))}</p><p>Your payment for order <strong>${esc(o.number)}</strong> didn't go through, so nothing has been charged and the order hasn't been printed.</p><p>Your design is saved. You can try again with another payment method:</p>${button(cart, "Return to your cart")}`),
    text: `${hello(o)}\n\nYour payment for order ${o.number} didn't go through. Nothing was charged. Your design is saved — try again: ${cart}\n`,
  };
}

export function inProduction(o: Order): Rendered {
  const link = orderUrl(o.id);
  return {
    subject: `Your print is being made — order ${o.number}`,
    html: layout("In production", `<p>${esc(hello(o))}</p><p>Good news: order <strong>${esc(o.number)}</strong> is now being printed${o.shipName ? " and framed" : ""} at our print studio. We'll email tracking as soon as it ships.</p>${button(link, "Order status")}`),
    text: `${hello(o)}\n\nOrder ${o.number} is now being printed. We'll email tracking when it ships.\n${link}\n`,
  };
}

export function shipped(o: Order, s: Shipment): Rendered {
  const link = orderUrl(o.id);
  const tracking = s.trackingNumber ? `${s.carrier ?? "Tracking"}: ${s.trackingNumber}` : "Tracking will appear on your order page shortly.";
  return {
    subject: `Shipped — order ${o.number} is on its way`,
    html: layout(
      "Shipped",
      `<p>${esc(hello(o))}</p><p>Order <strong>${esc(o.number)}</strong> is on its way.</p><p><strong>${esc(tracking)}</strong>${s.service ? `<br>${esc(s.service)}` : ""}</p>${s.trackingUrl ? button(s.trackingUrl, "Track your package") : ""}<p>Delivery times are the carrier's estimate. Please open the box carefully — if anything arrived damaged, reply with a photo and we'll replace it.</p><p><a href="${esc(link)}" style="color:#151412">Order details</a></p>`,
      tracking,
    ),
    text: `${hello(o)}\n\nOrder ${o.number} is on its way.\n${tracking}\n${s.trackingUrl ?? ""}\n\nIf anything arrived damaged, reply with a photo and we'll replace it.\n${link}\n`,
  };
}

export function delivered(o: Order): Rendered {
  return {
    subject: `Delivered — order ${o.number}`,
    html: layout("Delivered", `<p>${esc(hello(o))}</p><p>The carrier says order <strong>${esc(o.number)}</strong> has been delivered. We hope it's everything you wanted.</p><p>If anything isn't right — damage in transit, or it doesn't match your preview — reply within 30 days with a photo and we'll make it right.</p>`),
    text: `${hello(o)}\n\nOrder ${o.number} has been delivered. If anything isn't right, reply within 30 days with a photo.\n`,
  };
}

export function refund(o: Order, refundedCents: number): Rendered {
  const full = refundedCents >= o.totalCents;
  return {
    subject: `${full ? "Refund" : "Partial refund"} for order ${o.number}`,
    html: layout("Refund", `<p>${esc(hello(o))}</p><p>We've refunded <strong>${formatCents(refundedCents)}</strong> for order <strong>${esc(o.number)}</strong>${full ? " (the full amount)" : ""}. It usually appears on your statement within 5–10 business days, depending on your bank.</p>`),
    text: `${hello(o)}\n\nWe've refunded ${formatCents(refundedCents)} for order ${o.number}. It usually appears within 5–10 business days.\n`,
  };
}

export function cancelled(o: Order): Rendered {
  return {
    subject: `Order ${o.number} cancelled`,
    html: layout("Cancelled", `<p>${esc(hello(o))}</p><p>Order <strong>${esc(o.number)}</strong> has been cancelled.${o.paidAt ? " Any payment will be refunded to your original payment method; you'll receive a separate refund confirmation." : ""}</p><p>If you didn't expect this, please reply and we'll help.</p>`),
    text: `${hello(o)}\n\nOrder ${o.number} has been cancelled.${o.paidAt ? " Any payment will be refunded." : ""}\n`,
  };
}

export function contactConfirmation(name: string, topic: string): Rendered {
  return {
    subject: `We got your message — ${BRAND_NAME}`,
    html: layout("Message received", `<p>Hi ${esc(name.split(" ")[0])},</p><p>Thanks for getting in touch about <strong>${esc(topic)}</strong>. A real person reads every message; we usually reply within one business day.</p>`),
    text: `Hi ${name.split(" ")[0]},\n\nThanks for getting in touch about ${topic}. We usually reply within one business day.\n`,
  };
}

export function contactNotification(m: { name: string; email: string; topic: string; orderNumber?: string | null; message: string }): Rendered {
  return {
    subject: `[Contact] ${m.topic}${m.orderNumber ? ` · ${m.orderNumber}` : ""} — ${m.name}`,
    html: layout("New message", `<p><strong>${esc(m.name)}</strong> &lt;${esc(m.email)}&gt;<br>Topic: ${esc(m.topic)}${m.orderNumber ? `<br>Order: ${esc(m.orderNumber)}` : ""}</p><pre style="white-space:pre-wrap;font-family:inherit">${esc(m.message)}</pre>`),
    text: `${m.name} <${m.email}>\nTopic: ${m.topic}\nOrder: ${m.orderNumber ?? "-"}\n\n${m.message}\n`,
  };
}

export function loginLink(url: string): Rendered {
  return {
    subject: `Your sign-in link — ${BRAND_NAME}`,
    html: layout("Sign in", `<p>Use the button below to sign in. The link works once and expires in 20 minutes.</p>${button(url, "Sign in")}<p style="font-size:14px;color:#57524B">If you didn't ask for this, you can ignore this email.</p>`, "Your sign-in link"),
    text: `Sign in: ${url}\n\nThe link works once and expires in 20 minutes. If you didn't ask for this, ignore this email.\n`,
  };
}
