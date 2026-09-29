import type { ProductVariant } from "@prisma/client";
import { shippingMethods, type ShippingMethod } from "@/lib/commerce";
import { prisma } from "./db";
import { getEnv } from "./env";

export interface VariantDto {
  id: string;
  sku: string;
  format: "print" | "framed";
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

export function availableShipping(variants: Pick<VariantDto, "leadTimeMinDays" | "leadTimeMaxDays">[]): ShippingMethod[] {
  const leadMin = variants.length ? Math.max(...variants.map((v) => v.leadTimeMinDays)) : 5;
  const leadMax = variants.length ? Math.max(...variants.map((v) => v.leadTimeMaxDays)) : 9;
  return shippingMethods({ expressCents: getEnv().SHIPPING_EXPRESS_CENTS, leadMin, leadMax });
}
