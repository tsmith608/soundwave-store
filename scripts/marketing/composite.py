"""Place a real Afterhum print into an AI-generated (or real) room photo.

Ask the image model for a scene whose frame holds a flat chroma-green (#00FF00)
rectangle where the artwork goes (prompts in marketing/chatgpt-image-guide.md).
This script finds the green, warps our real print into it in perspective, keeps
the room's light falloff (read from the green's brightness), and leaves anything
in front of the frame (a plant, a hand) in front.

    python3 scripts/marketing/composite.py ROOM.png marketing/out/art/herbarium-stone.png OUT.jpg
    python3 scripts/marketing/composite.py ROOM.png ART.png OUT.jpg --corners 412,300 690,310 684,690 405,680

Use --corners (top-left, top-right, bottom-right, bottom-left, in pixels) for a
photo without a green placeholder; then the whole quad is replaced.
"""
import argparse

import numpy as np
from PIL import Image, ImageFilter


def perspective_coeffs(dst, src):
    """Coefficients for PIL's PERSPECTIVE transform mapping output points (dst) to input points (src)."""
    rows = []
    rhs = []
    for (x, y), (u, v) in zip(dst, src):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        rhs += [u, v]
    return np.linalg.solve(np.array(rows, float), np.array(rhs, float)).tolist()


def green_mask(room):
    a = np.asarray(room.convert("RGB")).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    hard = (g > 90) & (g - np.maximum(r, b) > 50)
    return hard, g


def _hull(points):
    pts = sorted(set(points))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def _intersect(p1, p2, p3, p4):
    d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0])
    if abs(d) < 1e-9:
        return None
    a = p1[0] * p2[1] - p1[1] * p2[0]
    b = p3[0] * p4[1] - p3[1] * p4[0]
    return ((a * (p3[0] - p4[0]) - (p1[0] - p2[0]) * b) / d, (a * (p3[1] - p4[1]) - (p1[1] - p2[1]) * b) / d)


def _tri_area(a, b, c):
    return abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2


def corners_from_mask(mask):
    """Quadrilateral around the green area. Extending the visible edges recovers a corner
    hidden behind something in front of the frame."""
    if mask.sum() < 500:
        raise SystemExit("No green placeholder found. Pass --corners instead.")
    edge = mask & ~np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))).astype(bool)
    ys, xs = np.nonzero(edge)
    hull = [(float(x), float(y)) for x, y in _hull(list(zip(xs.tolist(), ys.tolist())))]
    while len(hull) > 4:
        n = len(hull)
        best = None
        for i in range(n):
            a, b = hull[i], hull[(i + 1) % n]
            p = _intersect(hull[i - 1], a, b, hull[(i + 2) % n])
            if p is None:
                continue
            cost = _tri_area(a, p, b)
            if best is None or cost < best[0]:
                best = (cost, i, p)
        if best is None:
            break
        _, i, p = best
        j = (i + 1) % n
        hull = [q for k, q in enumerate(hull) if k not in (i, j)]
        hull.insert(i if j > i else i - 1, p)
    # order TL, TR, BR, BL
    s = [x + y for x, y in hull]
    d = [x - y for x, y in hull]
    return [hull[int(np.argmin(s))], hull[int(np.argmax(d))], hull[int(np.argmax(s))], hull[int(np.argmin(d))]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("room")
    ap.add_argument("art")
    ap.add_argument("out")
    ap.add_argument("--corners", nargs=4, help="x,y for TL TR BR BL")
    ap.add_argument("--inset", type=float, default=1.0, help="grow (>0) or shrink (<0) the placed print by N px to hide green fringes")
    args = ap.parse_args()

    room = Image.open(args.room).convert("RGB")
    art = Image.open(args.art).convert("RGB")
    W, H = room.size

    if args.corners:
        quad = [tuple(map(float, c.split(","))) for c in args.corners]
        mask = np.zeros((H, W), bool)
        shade = np.ones((H, W))
    else:
        mask, g = green_mask(room)
        quad = [tuple(map(float, p)) for p in corners_from_mask(mask)]
        inside = g[mask]
        ref = np.percentile(inside, 95)
        shade_img = Image.fromarray(np.clip(g / ref * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(12))
        shade = np.clip(np.asarray(shade_img).astype(float) / 255, 0.55, 1.05)

    # grow the quad slightly from its centre so no green fringe survives
    cx = sum(p[0] for p in quad) / 4
    cy = sum(p[1] for p in quad) / 4
    grown = []
    for x, y in quad:
        dx, dy = x - cx, y - cy
        n = max(1e-6, (dx * dx + dy * dy) ** 0.5)
        grown.append((x + dx / n * args.inset, y + dy / n * args.inset))

    aw, ah = art.size
    coeffs = perspective_coeffs(grown, [(0, 0), (aw, 0), (aw, ah), (0, ah)])
    warped = art.transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC)

    quad_mask = Image.new("L", (W, H), 0)
    from PIL import ImageDraw

    ImageDraw.Draw(quad_mask).polygon(grown, fill=255)
    qm = np.asarray(quad_mask).astype(float) / 255
    if args.corners:
        alpha = qm
    else:
        # inside the quad, only replace pixels that are green (objects in front stay)
        soft = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
        alpha = np.minimum(qm, np.asarray(soft).astype(float) / 255)

    r = np.asarray(room).astype(float)
    w = np.asarray(warped).astype(float) * shade[..., None]
    out = r * (1 - alpha[..., None]) + w * alpha[..., None]

    # despill: pull any remaining green cast near the edge back to neutral
    edge = (alpha > 0.02) & (alpha < 0.98)
    rr, gg, bb = out[..., 0], out[..., 1], out[..., 2]
    gg[edge] = np.minimum(gg[edge], (rr[edge] + bb[edge]) / 2 + 8)

    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(args.out, quality=92)
    print("composite", args.out, "corners", [tuple(round(v) for v in p) for p in quad])


if __name__ == "__main__":
    main()
