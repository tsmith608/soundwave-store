/**
 * Storefront catalogue for curated designs.
 *
 * Prices are provisional: see docs/unit-economics.md for the cost model and
 * the supplier quotes the owner must confirm before launch. The legacy
 * FRAME_SIZES in constants.ts remain for existing orders and tests.
 */

/** Physical formats are printed by the lab; "digital" is a file delivered by email. */
export type PhysicalFormat = "framed" | "print";
export type ProductFormat = PhysicalFormat | "digital";

export interface PrintSize {
  id: string;
  label: string;
  widthIn: number;
  heightIn: number;
  note: string;
  /** Prices in cents per format. */
  price: Record<PhysicalFormat, number>;
  /** Supplier SKUs to be confirmed in the supplier dashboard before launch. */
  sku: { prodigi: Record<PhysicalFormat, string> };
}

export const PRINT_SIZES: PrintSize[] = [
  {
    id: "8x10",
    label: '8 × 10"',
    widthIn: 8,
    heightIn: 10,
    note: "Desk, shelf or bedside",
    price: { print: 3500, framed: 6900 },
    sku: { prodigi: { print: "GLOBAL-FAP-8X10", framed: "GLOBAL-CFPM-8X10" } },
  },
  {
    id: "12x16",
    label: '12 × 16"',
    widthIn: 12,
    heightIn: 16,
    note: "Most chosen as a gift",
    price: { print: 4900, framed: 9900 },
    sku: { prodigi: { print: "GLOBAL-FAP-12X16", framed: "GLOBAL-CFPM-12X16" } },
  },
  {
    id: "18x24",
    label: '18 × 24"',
    widthIn: 18,
    heightIn: 24,
    note: "Above a bed or sofa",
    price: { print: 6500, framed: 14900 },
    sku: { prodigi: { print: "GLOBAL-FAP-18X24", framed: "GLOBAL-CFPM-18X24" } },
  },
];

export const DEFAULT_SIZE_ID = "12x16";

export const FORMATS: { id: ProductFormat; label: string; description: string }[] = [
  { id: "framed", label: "Framed", description: "Solid wood frame, white mount, acrylic glazing, ready to hang" },
  { id: "print", label: "Print only", description: "Archival matte fine-art paper, shipped flat in a rigid mailer" },
  { id: "digital", label: "Digital file", description: "High-res file by email, ready to print anywhere or share with family" },
];

/**
 * The digital file: sold on its own, and included free with every print.
 * One size (12 × 16 proportions); the vector PDF scales to any size and the
 * PNG prints sharply up to 18 × 24.
 */
export const DIGITAL = {
  variantId: "digital-12x16",
  sizeId: "12x16",
  widthIn: 12,
  heightIn: 16,
  priceCents: 1900,
  pngDpi: 300,
  label: "Digital file (PNG + PDF)",
} as const;

export const FRAME_FINISHES = [
  { id: "black", label: "Black", color: "#1E1D1B" },
  { id: "natural", label: "Natural oak", color: "#C9A77C" },
  { id: "white", label: "White", color: "#F4F2EE" },
] as const;

export type FrameFinish = (typeof FRAME_FINISHES)[number]["id"];

export function getPrintSize(id: string | null | undefined): PrintSize | undefined {
  return PRINT_SIZES.find((s) => s.id === id);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * Occasions shown in the studio and on the homepage. Each points at the
 * design that suits it best and adjusts prompts; the customer can still pick
 * any design. Order reflects the demand evidence in docs/positioning.md.
 */
export interface Occasion {
  id: string;
  label: string;
  designId: string;
  colorwayId?: string;
  recordingPrompt: string;
  sampleKind: "voice" | "song" | "heartbeat";
  landing?: string;
}

export const OCCASIONS: Occasion[] = [
  {
    id: "vows",
    label: "Wedding & vows",
    designId: "herbarium",
    recordingPrompt: "A phone video of the vows, the speeches or the first dance works — upload the video and we use its sound.",
    sampleKind: "voice",
    landing: "/wedding-vows-art",
  },
  {
    id: "anniversary",
    label: "The night we met",
    designId: "night-of",
    recordingPrompt: "A voice note you've kept, a clip from that night, or record a message for them now.",
    sampleKind: "voice",
    landing: "/anniversary-sound-wave-gift",
  },
  {
    id: "memorial",
    label: "A voice to keep",
    designId: "herbarium",
    colorwayId: "stone",
    recordingPrompt: "Saved voicemails can be exported: on iPhone open the voicemail, tap Share, Save to Files. On Android use Share in your voicemail app — or screen-record it playing.",
    sampleKind: "voice",
    landing: "/voicemail-memorial-art",
  },
  {
    id: "family",
    label: "Family",
    designId: "herbarium",
    colorwayId: "herbarium",
    recordingPrompt: "Grandma singing, the kids saying goodnight, a birthday video — any clip with the sound you want to keep.",
    sampleKind: "voice",
  },
  {
    id: "baby",
    label: "Baby",
    designId: "herbarium",
    colorwayId: "blush",
    recordingPrompt: "A heartbeat from a scan video, a first laugh, a first word — phone videos are perfect.",
    sampleKind: "heartbeat",
    landing: "/gifts/first-baby-heartbeat-soundwave-art",
  },
  {
    id: "pet",
    label: "Pet memorial",
    designId: "herbarium",
    colorwayId: "stone",
    recordingPrompt: "A bark, a purr, the jingle of a collar — any video where you can hear them.",
    sampleKind: "voice",
    landing: "/pet-memorial-sound-art",
  },
  {
    id: "friendship",
    label: "Friendship",
    designId: "night-of",
    colorwayId: "plum",
    recordingPrompt: "That voice note you replay, a clip from the trip, the night everyone was laughing.",
    sampleKind: "voice",
  },
  {
    id: "custom",
    label: "Any memory",
    designId: "night-of",
    recordingPrompt: "Any recording or video you made or have permission to use.",
    sampleKind: "voice",
  },
];
