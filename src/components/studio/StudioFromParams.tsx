"use client";

import { useSearchParams } from "next/navigation";
import Studio from "./Studio";

/** Reads deep-link params: ?design=&occasion=&colorway=&size= (legacy ?template=&size= also accepted). */
export default function StudioFromParams() {
  const sp = useSearchParams();
  return (
    <Studio
      initialDesign={sp.get("design") ?? sp.get("template") ?? undefined}
      initialOccasion={sp.get("occasion") ?? undefined}
      initialColorway={sp.get("colorway") ?? undefined}
      initialSize={sp.get("size") ?? undefined}
    />
  );
}
