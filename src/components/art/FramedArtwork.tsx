import React from "react";
import Artwork, { type ArtworkProps } from "./Artwork";

const FRAME_COLORS: Record<string, { face: string; edge: string }> = {
  black: { face: "#1E1D1B", edge: "#0E0D0C" },
  natural: { face: "#C9A77C", edge: "#A9875D" },
  white: { face: "#F4F2EE", edge: "#D9D5CE" },
};

/**
 * Physical-product preview: the artwork inside a wood frame with a white
 * mount, or as an unframed sheet. Proportions follow a real 1" moulding and
 * 2" mount at 12×16 and scale with size.
 */
export default function FramedArtwork({
  format = "framed",
  frameFinish = "black",
  ...art
}: ArtworkProps & { format?: "framed" | "print"; frameFinish?: string }) {
  if (format === "print") {
    return (
      <div className="relative" style={{ filter: "drop-shadow(0 18px 28px rgba(40,30,20,.18)) drop-shadow(0 3px 6px rgba(40,30,20,.12))" }}>
        <Artwork {...art} />
      </div>
    );
  }
  const f = FRAME_COLORS[frameFinish] ?? FRAME_COLORS.black;
  const w = art.widthIn ?? 12;
  const mount = w <= 8 ? 5.5 : 8; // % of frame width
  const moulding = 4.2;
  return (
    <div
      className="relative"
      style={{
        padding: `${moulding}%`,
        background: `linear-gradient(135deg, ${f.face}, ${f.edge})`,
        boxShadow: "0 30px 50px -18px rgba(35,25,15,.45), 0 8px 14px rgba(35,25,15,.18), inset 0 0 0 1px rgba(255,255,255,.06)",
      }}
    >
      <div style={{ padding: `${mount}%`, background: "#FBFAF7", boxShadow: "inset 0 2px 5px rgba(0,0,0,.25)" }}>
        <div style={{ boxShadow: "0 0 0 1px rgba(0,0,0,.06), inset 0 1px 2px rgba(0,0,0,.2)" }}>
          <Artwork {...art} />
        </div>
      </div>
      {/* glazing sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(120deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 70%, rgba(255,255,255,.05) 100%)" }}
      />
    </div>
  );
}
