import qrcode from "qrcode-generator";
import { r } from "./svg";

/**
 * Draws a QR code as a single SVG path in the artwork's own ink colour.
 * Error correction "M" keeps modules large enough to scan at 0.9"+ while
 * tolerating paper texture and glazing reflections.
 */
export function qrPath(url: string, x: number, y: number, size: number, color: string): string {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const m = size / n;
  let d = "";
  for (let row = 0; row < n; row++) {
    let run = -1;
    for (let col = 0; col <= n; col++) {
      const dark = col < n && qr.isDark(row, col);
      if (dark && run < 0) run = col;
      if (!dark && run >= 0) {
        d += `M${r(x + run * m)} ${r(y + row * m)}h${r((col - run) * m)}v${r(m)}h${r(-(col - run) * m)}z`;
        run = -1;
      }
    }
  }
  return `<path d="${d}" fill="${color}" shape-rendering="crispEdges"/>`;
}
