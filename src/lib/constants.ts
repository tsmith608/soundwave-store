export interface FrameSizeConfig {
  id: string;
  name: string;
  dimensions: string;
  priceCents: number;
  priceFormatted: string;
  aspectRatio: string;
  aspectRatioNum: number;
  prodigiSku: string;
  printifyVariantId: number;
}

export const FRAME_SIZES: Record<string, FrameSizeConfig> = Object.assign(
  Object.create(null),
  {
    "8x10": {
      id: "8x10",
      name: '8" × 10" Framed Print',
      dimensions: '8" × 10"',
      priceCents: 4900,
      priceFormatted: "$49.00",
      aspectRatio: "4/5",
      aspectRatioNum: 4 / 5,
      prodigiSku: "GLOBAL-CFP-8X10",
      printifyVariantId: 70801,
    },
    "11x14": {
      id: "11x14",
      name: '11" × 14" Framed Print',
      dimensions: '11" × 14"',
      priceCents: 6900,
      priceFormatted: "$69.00",
      aspectRatio: "11/14",
      aspectRatioNum: 11 / 14,
      prodigiSku: "GLOBAL-CFP-11X14",
      printifyVariantId: 70802,
    },
    "16x20": {
      id: "16x20",
      name: '16" × 20" Framed Print',
      dimensions: '16" × 20"',
      priceCents: 9900,
      priceFormatted: "$99.00",
      aspectRatio: "4/5",
      aspectRatioNum: 4 / 5,
      prodigiSku: "GLOBAL-CFP-16X20",
      printifyVariantId: 70803,
    },
    "24x36": {
      id: "24x36",
      name: '24" × 36" Framed Print',
      dimensions: '24" × 36"',
      priceCents: 14900,
      priceFormatted: "$149.00",
      aspectRatio: "2/3",
      aspectRatioNum: 2 / 3,
      prodigiSku: "GLOBAL-CFP-24X36",
      printifyVariantId: 70804,
    },
  }
);

export interface PaletteConfig {
  id: string;
  name: string;
  bg: string;
  wave: string;
  label: string;
}

export const PALETTES: Record<string, PaletteConfig> = {
  midnight_gold: {
    id: "midnight_gold",
    name: "Midnight Gold",
    bg: "#0c0c0c",
    wave: "#d4af37",
    label: "Black / Gold",
  },
  white_silver: {
    id: "white_silver",
    name: "Everest Silver",
    bg: "#fdfdfd",
    wave: "#c0c0c0",
    label: "White / Silver",
  },
  dark_blue_white: {
    id: "dark_blue_white",
    name: "Ocean Navy",
    bg: "#0b1d3a",
    wave: "#ffffff",
    label: "Dark Blue / White",
  },
  nordic_slate: {
    id: "nordic_slate",
    name: "Nordic Slate",
    bg: "#1a1a1a",
    wave: "#fdfdfd",
    label: "Slate / White",
  },
  blush_rosegold: {
    id: "blush_rosegold",
    name: "Blush Rose Gold",
    bg: "#FAF7F2",
    wave: "#B76E79",
    label: "Cream / Rose Gold",
  },
  sage_cream: {
    id: "sage_cream",
    name: "Sage Eucalyptus",
    bg: "#FDFBF7",
    wave: "#738671",
    label: "Soft Cream / Sage",
  },
  warm_sand: {
    id: "warm_sand",
    name: "Warm Sand",
    bg: "#F8F5EE",
    wave: "#A67C52",
    label: "Sand / Terracotta",
  },
  bauhaus_primary: {
    id: "bauhaus_primary",
    name: "Bauhaus Cobalt",
    bg: "#F4F0E8",
    wave: "#1E3A8A",
    label: "Parchment / Cobalt",
  },
  vintage_tobacco: {
    id: "vintage_tobacco",
    name: "Vintage Tobacco",
    bg: "#EFE7D8",
    wave: "#B45309",
    label: "Newsprint / Amber",
  },
  celestial_night: {
    id: "celestial_night",
    name: "Cosmic Obsidian",
    bg: "#070A12",
    wave: "#E2E8F0",
    label: "Obsidian / Starlight",
  },
  carrara_gold: {
    id: "carrara_gold",
    name: "Carrara Marble",
    bg: "#F5F4F0",
    wave: "#C5A059",
    label: "Alabaster / Quartz Gold",
  },
};

export const COLOR_PALETTES = PALETTES;

export type DecorativeStyle =
  | "botanical"
  | "modern_border"
  | "arch"
  | "art_deco"
  | "vintage_grunge"
  | "luxury_marble"
  | "abstract_geometric"
  | "celestial"
  | "minimal";

export interface DecorativeStyleConfig {
  id: DecorativeStyle;
  name: string;
  description: string;
  icon: string;
  subtitle: string;
  category: string;
  primaryColor?: string;
  accentColor?: string;
}

export const DECORATIVE_STYLES: Record<DecorativeStyle, DecorativeStyleConfig> = {
  botanical: {
    id: "botanical",
    name: "Floral Botanical",
    description: "Delicate botanical corner flourishes in every corner",
    icon: "🌿",
    subtitle: "Organic & Biophilic",
    category: "Nature",
    primaryColor: "#738671",
    accentColor: "#B76E79",
  },
  modern_border: {
    id: "modern_border",
    name: "Modern Double Border",
    description: "Refined dual hairline contemporary border with architectural corner marks",
    icon: "◻",
    subtitle: "Bauhaus Gallery",
    category: "Contemporary",
    primaryColor: "#2D2A26",
    accentColor: "#D8C7B5",
  },
  arch: {
    id: "arch",
    name: "Architectural Arch",
    subtitle: "Neoclassical Elegance",
    description: "Neoclassical travertine arched header frame",
    icon: "🏛️",
    category: "luxury",
    primaryColor: "#C5A059",
    accentColor: "#2D3748",
  },
  art_deco: {
    id: "art_deco",
    name: "Art Deco Noir",
    subtitle: "1920s Gatsby Glamour",
    description: "Stepped chevron corner accents and dual gold framing",
    icon: "✨",
    category: "luxury",
    primaryColor: "#D4AF37",
    accentColor: "#F5EBE1",
  },
  vintage_grunge: {
    id: "vintage_grunge",
    name: "Vintage Grunge",
    subtitle: "Analog Vinyl Warmth",
    description: "Distressed deckle frame edge and analog warmth",
    icon: "📻",
    category: "vintage",
    primaryColor: "#B45309",
    accentColor: "#451A03",
  },
  luxury_marble: {
    id: "luxury_marble",
    name: "Luxury Marble Arch",
    subtitle: "Carrara Opulence",
    description: "Fine metallic dual hairlines with delicate marble veining",
    icon: "💎",
    category: "luxury",
    primaryColor: "#C5A059",
    accentColor: "#1E293B",
  },
  abstract_geometric: {
    id: "abstract_geometric",
    name: "Abstract Geometric",
    subtitle: "Constructivist Kinetic",
    description: "Bauhaus constructivist intersecting balance accents",
    icon: "📐",
    category: "modern",
    primaryColor: "#2563EB",
    accentColor: "#C2410C",
  },
  celestial: {
    id: "celestial",
    name: "Celestial Starlight",
    subtitle: "Cosmic Astrophotography",
    description: "Subtle starlight constellations and crescent moon motif",
    icon: "⭐",
    category: "luxury",
    primaryColor: "#E2E8F0",
    accentColor: "#A78BFA",
  },
  minimal: {
    id: "minimal",
    name: "Clean Minimal",
    subtitle: "Nordic Fine Art",
    description: "Generous archival mat with pure unadorned borders",
    icon: "◻️",
    category: "minimal",
    primaryColor: "#6B7280",
    accentColor: "#111827",
  },
};

