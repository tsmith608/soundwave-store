/**
 * Etsy API v3 Data Mapper
 *
 * Maps Etsy Receipts and Transactions to SoundWave Art Order models:
 * - Frame sizes matched to allowed sizes: "8x10", "11x14", "16x20", "24x36" (default "16x20")
 * - Color palettes matched to PALETTES constants (default "midnight_gold")
 * - Decorative styles matched to DECORATIVE_STYLES constants (default "botanical")
 * - Personalization fields parsed for captions (max 200 chars) and cloud audio URLs
 * - Customer & shipping details formatted into database-ready structures
 * - Unique partnerOrderId generated for deduplication: "etsy_${receiptId}_${transactionId}"
 */

import { FRAME_SIZES, PALETTES, DECORATIVE_STYLES, DecorativeStyle } from "@/lib/constants";
import { EtsyPersonalization, EtsyReceipt, EtsyTransaction, EtsyVariation, MappedEtsyOrder } from "./types";
import { OrderStatus } from "@/lib/db";

const DEFAULT_FRAME_SIZE = "16x20";
const DEFAULT_PALETTE = "midnight_gold";
const DEFAULT_THEME = "botanical";
const DEFAULT_PENDING_AUDIO = "pending_etsy_audio";

/**
 * Resolves frame size from variation value string.
 * Supports: 8x10, 11x14, 16x20, 24x36 with flexible formatting (e.g. '16 x 20"', '8x10 inches').
 */
export function resolveFrameSize(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return DEFAULT_FRAME_SIZE;
  const clean = raw
    .toLowerCase()
    .replace(/[\u00d7]/g, "x")
    .replace(/\bby\b/g, "x")
    .replace(/["'\s]/g, "");

  if (/8x10|8\*10/.test(clean)) return "8x10";
  if (/11x14|11\*14/.test(clean)) return "11x14";
  if (/16x20|16\*20/.test(clean)) return "16x20";
  if (/24x36|24\*36/.test(clean)) return "24x36";

  // Check if directly one of the keys in FRAME_SIZES
  if (FRAME_SIZES[raw.trim()]) return raw.trim();

  return DEFAULT_FRAME_SIZE;
}

/**
 * Resolves palette key from variation value string.
 * Matches against PALETTES keys, display names, and color keywords.
 */
export function resolvePalette(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return DEFAULT_PALETTE;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase().replace(/[\s\-_/]+/g, " ");

  // Direct key match
  const keyNormalized = trimmed.toLowerCase().replace(/[\s\-]+/g, "_");
  if (PALETTES[keyNormalized]) {
    return keyNormalized;
  }

  // Match against palette names and labels
  for (const [key, config] of Object.entries(PALETTES)) {
    const nameLower = config.name.toLowerCase();
    const labelLower = config.label.toLowerCase();
    if (lower === nameLower || lower === labelLower) {
      return key;
    }
  }

  // Keyword-based fuzzy resolution
  if (lower.includes("midnight") || (lower.includes("black") && lower.includes("gold"))) {
    return "midnight_gold";
  }
  if (lower.includes("silver") || lower.includes("everest") || (lower.includes("white") && lower.includes("silver"))) {
    return "white_silver";
  }
  if (lower.includes("navy") || lower.includes("dark blue") || lower.includes("ocean")) {
    return "dark_blue_white";
  }
  if (lower.includes("slate") || lower.includes("nordic")) {
    return "nordic_slate";
  }
  if (lower.includes("rose") || lower.includes("blush")) {
    return "blush_rosegold";
  }
  if (lower.includes("sage") || lower.includes("eucalyptus")) {
    return "sage_cream";
  }
  if (lower.includes("sand") || lower.includes("terracotta") || lower.includes("warm")) {
    return "warm_sand";
  }
  if (lower.includes("bauhaus") || lower.includes("cobalt")) {
    return "bauhaus_primary";
  }
  if (lower.includes("tobacco") || (lower.includes("vintage") && lower.includes("amber"))) {
    return "vintage_tobacco";
  }
  if (lower.includes("celestial") || lower.includes("obsidian") || lower.includes("cosmic") || lower.includes("starlight")) {
    return "celestial_night";
  }
  if (lower.includes("carrara") || (lower.includes("marble") && lower.includes("gold"))) {
    return "carrara_gold";
  }

  return DEFAULT_PALETTE;
}

/**
 * Resolves decorative style / theme key from variation value string.
 * Matches against DECORATIVE_STYLES keys, display names, and theme keywords.
 */
export function resolveTheme(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return DEFAULT_THEME;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase().replace(/[\s\-_/]+/g, " ");

  // Direct key match
  const keyNormalized = trimmed.toLowerCase().replace(/[\s\-]+/g, "_");
  if (DECORATIVE_STYLES[keyNormalized as DecorativeStyle]) {
    return keyNormalized;
  }

  // Match against style names and subtitles
  for (const [key, config] of Object.entries(DECORATIVE_STYLES)) {
    const nameLower = config.name.toLowerCase();
    const subLower = config.subtitle.toLowerCase();
    if (lower === nameLower || lower === subLower) {
      return key;
    }
  }

  // Keyword-based fuzzy resolution
  if (lower.includes("botanical") || lower.includes("floral") || lower.includes("flower") || lower.includes("plant")) {
    return "botanical";
  }
  if (lower.includes("double border") || (lower.includes("modern") && lower.includes("border"))) {
    return "modern_border";
  }
  if (lower.includes("arch") || lower.includes("travertine") || lower.includes("neoclassical")) {
    return "arch";
  }
  if (lower.includes("art deco") || lower.includes("gatsby") || lower.includes("chevron")) {
    return "art_deco";
  }
  if (lower.includes("grunge") || lower.includes("deckle") || (lower.includes("vintage") && !lower.includes("tobacco"))) {
    return "vintage_grunge";
  }
  if (lower.includes("marble")) {
    return "luxury_marble";
  }
  if (lower.includes("abstract geometric") || lower.includes("geometric") || lower.includes("constructivist")) {
    return "abstract_geometric";
  }
  if (lower.includes("celestial") || lower.includes("starlight") || lower.includes("constellation") || lower.includes("moon")) {
    return "celestial";
  }
  if (lower.includes("minimal") || lower.includes("clean") || lower.includes("nordic fine art")) {
    return "minimal";
  }

  return DEFAULT_THEME;
}

/**
 * Extracts the user-requested custom caption or quote from personalizations.
 * Truncates safely to 200 characters to conform to the Order schema.
 */
export function extractCaption(
  personalizations?: EtsyPersonalization[],
  fallback?: string | null
): string {
  if (personalizations && Array.isArray(personalizations)) {
    // Look for explicit caption, text, quote, lyrics, or song questions
    const captionItem = personalizations.find((p) =>
      /caption|text|quote|lyrics|names|song|phrase|message/i.test(p.question_text || "")
    );
    if (captionItem && captionItem.value && typeof captionItem.value === "string") {
      const trimmed = captionItem.value.trim();
      if (trimmed.length > 0) {
        return trimmed.slice(0, 200);
      }
    }

    // Fallback to any non-URL personalization value
    for (const p of personalizations) {
      if (p.value && typeof p.value === "string") {
        const val = p.value.trim();
        if (val.length > 0 && !/^https?:\/\//i.test(val)) {
          return val.slice(0, 200);
        }
      }
    }
  }

  if (fallback && typeof fallback === "string") {
    const trimmed = fallback.trim();
    if (trimmed.length > 0) {
      return trimmed.slice(0, 200);
    }
  }

  return "";
}

/**
 * Parses personalizations and buyer notes for cloud audio URLs (Dropbox, Google Drive, iCloud, etc.).
 */
export function extractAudioUrl(
  personalizations?: EtsyPersonalization[],
  buyerNotes?: string | null
): string | null {
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;

  if (personalizations && Array.isArray(personalizations)) {
    for (const p of personalizations) {
      if (p.value && typeof p.value === "string") {
        const matches = p.value.match(urlRegex);
        if (matches && matches.length > 0) {
          return matches[0].trim();
        }
      }
    }
  }

  if (buyerNotes && typeof buyerNotes === "string") {
    const matches = buyerNotes.match(urlRegex);
    if (matches && matches.length > 0) {
      return matches[0].trim();
    }
  }

  return null;
}

/**
 * Formats a clean mailing address from an Etsy Receipt.
 */
export function formatShippingAddress(receipt: EtsyReceipt): string {
  if (receipt.formatted_address && receipt.formatted_address.trim().length > 0) {
    return receipt.formatted_address.trim();
  }

  const parts = [
    receipt.first_line,
    receipt.second_line,
    receipt.city,
    receipt.state,
    receipt.zip,
    receipt.country_iso,
  ].filter((p) => typeof p === "string" && p.trim().length > 0);

  return parts.join(", ");
}

/**
 * Calculates total order amount in integer cents.
 */
export function extractTotalAmountCents(receipt: EtsyReceipt, transaction?: EtsyTransaction): number {
  if (receipt.grandtotal && typeof receipt.grandtotal.amount === "number") {
    const divisor = receipt.grandtotal.divisor || 100;
    return Math.round((receipt.grandtotal.amount / divisor) * 100);
  }

  if (transaction?.price && typeof transaction.price.amount === "number") {
    const divisor = transaction.price.divisor || 100;
    const qty = transaction.quantity || 1;
    return Math.round(((transaction.price.amount * qty) / divisor) * 100);
  }

  return 0;
}

/**
 * Maps a single Etsy transaction within a receipt to a SoundWave Art Order model.
 */
export function mapEtsyTransactionToOrder(
  receipt: EtsyReceipt,
  transaction: EtsyTransaction
): MappedEtsyOrder {
  const receiptId = String(receipt.receipt_id);
  const transactionId = String(transaction.transaction_id);
  const partnerOrderId = `etsy_${receiptId}_${transactionId}`;

  // Extract variations
  const variations: EtsyVariation[] = transaction.variations || [];
  let rawFrameSize: string | null = null;
  let rawPalette: string | null = null;
  let rawTheme: string | null = null;

  for (const v of variations) {
    const name = (v.formatted_name || "").toLowerCase();
    const val = v.formatted_value || "";

    if (/size|dimensions|frame/i.test(name)) {
      rawFrameSize = val;
    } else if (/decorative|decoration|template|theme|border/i.test(name)) {
      rawTheme = val;
    } else if (/palette|color/i.test(name)) {
      rawPalette = val;
    } else if (/style/i.test(name)) {
      if (resolvePalette(val) !== DEFAULT_PALETTE && resolveTheme(val) === DEFAULT_THEME) {
        rawPalette = val;
      } else {
        rawTheme = val;
      }
    }
  }

  // Fallback checks on title or listing description if variations didn't specify
  if (!rawFrameSize && transaction.title) {
    if (/8x10|11x14|16x20|24x36/i.test(transaction.title)) {
      rawFrameSize = transaction.title;
    }
  }

  const frameSize = resolveFrameSize(rawFrameSize);
  const palette = resolvePalette(rawPalette);
  const decorativeTheme = resolveTheme(rawTheme);

  // Extract caption & audio
  const personalizations = transaction.personalizations || [];
  const caption = extractCaption(personalizations, receipt.message_from_buyer);
  const audioSourceUrl = extractAudioUrl(personalizations, receipt.message_from_buyer);
  const audioPath = audioSourceUrl || DEFAULT_PENDING_AUDIO;

  // Customer & Shipping
  const customerEmail = receipt.buyer_email || transaction.buyer_email || "customer@example.com";
  const shippingName = receipt.name || "Etsy Customer";
  const shippingAddress = formatShippingAddress(receipt);
  const totalAmount = extractTotalAmountCents(receipt, transaction);

  const status: OrderStatus = receipt.was_paid ? "pending_fulfillment" : "pending_payment";

  return {
    partnerOrderId,
    externalOrderId: partnerOrderId,
    receiptId,
    transactionId,
    customerEmail,
    shippingName,
    shippingAddress,
    frameSize,
    palette,
    decorativeTheme,
    caption,
    audioPath,
    audioSourceUrl,
    personalizationData: JSON.stringify(personalizations),
    etsyListingId: transaction.listing_id ? String(transaction.listing_id) : null,
    etsyReceiptId: receiptId,
    totalAmount,
    source: "etsy",
    status,
  };
}

/**
 * Maps an entire Etsy receipt and all of its contained transactions to an array of MappedEtsyOrder.
 */
export function mapEtsyReceiptToOrders(receipt: EtsyReceipt): MappedEtsyOrder[] {
  const transactions = receipt.transactions || [];
  if (transactions.length === 0) {
    // If no transactions exist, create a single order for the receipt
    const syntheticTransaction: EtsyTransaction = {
      transaction_id: receipt.receipt_id,
      receipt_id: receipt.receipt_id,
      title: "Etsy Custom SoundWave Art",
    };
    return [mapEtsyTransactionToOrder(receipt, syntheticTransaction)];
  }

  return transactions.map((tx) => mapEtsyTransactionToOrder(receipt, tx));
}
