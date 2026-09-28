/**
 * Storefront catalogue for curated designs.
 *
 * Prices are provisional: see docs/unit-economics.md for the cost model and
 * the supplier quotes the owner must confirm before launch. The legacy
 * FRAME_SIZES in constants.ts remain for existing orders and tests.
 */

export type ProductFormat = "framed" | "print";

export interface PrintSize {
  id: string;
  label: string;
  widthIn: number;
  heightIn: number;
  note: string;
  /** Prices in cents per format. */
  price: Record<ProductFormat, number>;
  /** Supplier SKUs to be confirmed in the supplier dashboard before launch. */
  sku: { prodigi: Record<ProductFormat, string> };
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
];

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
    id: "wedding",
    label: "First dance & wedding song",
    designId: "liner-notes",
    recordingPrompt: "Upload the song (an MP3 or a clip you recorded) or a video's audio from the day.",
    sampleKind: "song",
    landing: "/wedding-song-art",
  },
  {
    id: "vows",
    label: "Vows & proposals",
    designId: "arch",
    recordingPrompt: "A phone video of the vows works. Upload the video's audio or a voice memo.",
    sampleKind: "voice",
  },
  {
    id: "anniversary",
    label: "Anniversary",
    designId: "night-of",
    recordingPrompt: "Your song, a voice note you've kept, or record a message for them now.",
    sampleKind: "song",
    landing: "/anniversary-sound-wave-gift",
  },
  {
    id: "memorial",
    label: "A voice to keep",
    designId: "in-memoriam",
    recordingPrompt: "Voicemails can be exported from your phone — iPhone: open the voicemail, tap Share, save to Files. Android varies by carrier; screen-recording while it plays also works.",
    sampleKind: "voice",
    landing: "/voicemail-memorial-art",
  },
  {
    id: "baby",
    label: "Baby & heartbeat",
    designId: "herbarium",
    colorwayId: "blush",
    recordingPrompt: "A heartbeat from a scan video or doppler, a first laugh, a lullaby.",
    sampleKind: "heartbeat",
  },
  {
    id: "pet",
    label: "Pet memorial",
    designId: "in-memoriam",
    colorwayId: "linen",
    recordingPrompt: "A bark, a purr, a video from the garden — any clip with their sound.",
    sampleKind: "voice",
    landing: "/pet-memorial-sound-art",
  },
];
