/**
 * Artwork engine types.
 *
 * A design is a finished composition, not a border. It receives the
 * customer's words and the waveform peaks of their recording and returns a
 * complete SVG document. The same function renders the live preview in the
 * browser and the vector print file, so the two can never drift apart.
 */

export type FieldKey = "title" | "subtitle" | "names" | "date" | "message" | "song";

export interface ArtFields {
  /** Headline: "Our vows", "Dad's voicemail", a name for memorials. */
  title: string;
  /** About the recording: "Voicemail · March 2019", "Wedding video". */
  subtitle: string;
  /** "Emma & James", "Mom", "Biscuit". */
  names: string;
  /** Free text or ISO date (YYYY-MM-DD). ISO dates are typeset per design. */
  date: string;
  /** A short personal line. */
  message: string;
  /**
   * Optional song associated with the memory ("At Last — Etta James").
   * Context only: printed as a small line. The artwork is ALWAYS generated
   * from the customer's uploaded recording, never from a song or a URL.
   */
  song?: string;
}

export interface FieldSpec {
  key: FieldKey;
  label: string;
  placeholder: string;
  maxLength: number;
  required?: boolean;
  /** Short helper text shown under the input. */
  hint?: string;
  multiline?: boolean;
}

export interface Colorway {
  id: string;
  name: string;
  /** Paper / ground colour. */
  paper: string;
  /** Primary ink. */
  ink: string;
  /** Secondary ink for small type and hairlines. */
  muted: string;
  /** Accent used sparingly (waveform, one ornament). */
  accent: string;
  /** Optional additional tone for fields of colour. */
  tone?: string;
  /** Swatch shown in the UI. */
  swatch: [string, string];
}

export interface RenderOptions {
  /** Width / height in inches. Layout is computed on a 1200-unit-wide canvas. */
  widthIn: number;
  heightIn: number;
  colorwayId?: string;
  showQr: boolean;
  /**
   * "standard": full-contrast code with a caption.
   * "discreet": tone-on-tone code with no caption, blended into the paper.
   * Contrast is tuned so ZXing/OpenCV still decode a simulated phone photo
   * (see tests/test_qr_discreet.py).
   */
  qrStyle?: "standard" | "discreet";
  /** Override discreet contrast (0..1 share of ink mixed into paper). Experiments only. */
  qrContrast?: number;
  /** URL the QR code resolves to. */
  qrUrl?: string;
  /** Optional photo (data URI or absolute URL). Only designs with supportsPhoto use it. */
  photoHref?: string | null;
  /** When true, the document embeds @font-face rules (print / standalone export). */
  embedFontsCss?: string;
  /** Adds an id prefix so several artworks can live on one page. */
  idPrefix?: string;
}

export interface RenderContext {
  W: number;
  H: number;
  fields: ArtFields;
  peaks: number[];
  colorway: Colorway;
  opts: RenderOptions;
  /** Unique id prefix for defs. */
  uid: string;
}

export type ArtDirection =
  | "Editorial"
  | "Keepsake"
  | "Botanical"
  | "Celestial"
  | "Memorial"
  | "Exploration";

export interface DesignDefinition {
  id: string;
  name: string;
  direction: ArtDirection;
  /** One sentence a customer reads. */
  tagline: string;
  /** Why this design exists, for the owner / dev gallery. */
  rationale: string;
  bestFor: string[];
  fields: FieldSpec[];
  colorways: Colorway[];
  supportsPhoto?: boolean;
  /** Example content used for catalogue previews and mockups. */
  sample: ArtFields;
  /** Seed for the sample waveform shape. */
  sampleSeed: string;
  sampleKind?: "voice" | "song" | "heartbeat";
  render(ctx: RenderContext): string;
}
