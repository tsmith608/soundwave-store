import { permanentRedirect } from "next/navigation";

// The border-preset catalogue was replaced by curated designs (docs/art-direction-2026.md).
export default function ShopPage() {
  permanentRedirect("/designs");
}
