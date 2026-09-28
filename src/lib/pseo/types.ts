import { DecorativeStyle } from "@/lib/constants";

export type EngineType = "anniversary" | "memorial";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface OccasionData {
  id: string;
  slug: string;
  aliases: string[];
  engine: EngineType;
  title: string;
  subtitle: string;
  badge: string;
  milestoneYear?: number;
  traditionalMaterial?: string;
  modernMaterial?: string;
  symbolism: string;
  emotionalHook: string;
  storyCopy: string;
  audioIdeas: string[];
  sampleCaption: string;
  recommendedTemplate: DecorativeStyle;
  recommendedPalette: string;
  recommendedSize: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  faqs: FaqItem[];
  ratingValue: string;
  reviewCount: number;
  highlights?: string[];
}

export interface PseoBreadcrumb {
  name: string;
  url: string;
}
