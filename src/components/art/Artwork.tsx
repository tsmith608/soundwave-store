"use client";

import React, { useMemo } from "react";
import { getDesign, renderArtwork, type ArtFields } from "@/lib/art";

export interface ArtworkProps {
  designId: string;
  fields: ArtFields;
  peaks?: number[] | null;
  colorwayId?: string;
  widthIn?: number;
  heightIn?: number;
  showQr?: boolean;
  photoHref?: string | null;
  className?: string;
  idPrefix?: string;
  title?: string;
}

/**
 * Renders a design as inline SVG. The markup comes from the same renderer as
 * the print file; all customer text is XML-escaped by the renderer.
 */
export default function Artwork({
  designId,
  fields,
  peaks,
  colorwayId,
  widthIn = 12,
  heightIn = 16,
  showQr = true,
  photoHref,
  className = "",
  idPrefix = "p",
  title,
}: ArtworkProps) {
  const svg = useMemo(() => {
    const design = getDesign(designId);
    if (!design) return "";
    return renderArtwork(design, fields, peaks, { widthIn, heightIn, colorwayId, showQr, photoHref, idPrefix }).replace(
      /width="[\d.]+in" height="[\d.]+in"/,
      'width="100%" height="100%"'
    );
  }, [designId, fields, peaks, colorwayId, widthIn, heightIn, showQr, photoHref, idPrefix]);

  return (
    <div
      role="img"
      aria-label={title ?? "Artwork preview"}
      className={`block w-full ${className}`}
      style={{ aspectRatio: `${widthIn} / ${heightIn}` }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
