import type { ProductVariant } from "@prisma/client";
import { DIGITAL_DELIVERY, shippingMethods, type ShippingMethod } from "@/lib/commerce";
import { prisma } from "./db";
import { getEnv } from "./env";

export interface VariantDto {
  id: string;
  sku: string;
  format: "print" | "framed" | "digital";
  sizeId: string;
  label: string;
  widthIn: number;
  heightIn: number;
  priceCents: number;
  frameFinishes: string[];
  leadTimeMinDays: number;
  leadTimeMaxDays: number;
}

export function variantDto(v: ProductVariant): VariantDto {
  return {
    id: v.id,
    sku: v.sku,
    format: v.format,
    sizeId: v.sizeId,
    label: v.label,
    widthIn: Number(v.widthIn),
    heightIn: Number(v.heightIn),
    priceCents: v.priceCents,
    frameFinishes: v.frameFinishes,
    leadTimeMinDays: v.leadTimeMinDays,
    leadTimeMaxDays: v.leadTimeMaxDays,
  };
}

/** Active variants, straight from the database (the source of truth for prices). */
export async function activeVariants(): Promise<VariantDto[]> {
  const rows = await prisma.productVariant.findMany({ where: { active: true, product: { active: true } }, orderBy: { sortOrder: "asc" } });
  return rows.map(variantDto);
}

/** True when anything in the list has to be printed and shipped. */
export function needsShipping(variants: Pick<VariantDto, "format">[]): boolean {
  return variants.some((v) => v.format !== "digital");
}

export function availableShipping(all: Pick<VariantDto, "format" | "leadTimeMinDays" | "leadTimeMaxDays">[]): ShippingMethod[] {
  if (all.length && !needsShipping(all)) return [DIGITAL_DELIVERY];
  // Lead times come from the physical items only (digital files don't hold up the parcel).
  const variants = all.filter((v) => v.format !== "digital");
  const leadMin = variants.length ? Math.max(...variants.map((v) => v.leadTimeMinDays)) : 5;
  const leadMax = variants.length ? Math.max(...variants.map((v) => v.leadTimeMaxDays)) : 9;
  return shippingMethods({ expressCents: getEnv().SHIPPING_EXPRESS_CENTS, leadMin, leadMax });
}
