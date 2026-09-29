import { permanentRedirect } from "next/navigation";

type SP = Record<string, string | string[] | undefined>;

/** Legacy customizer URL: forwards (with its query) to /create. */
export default async function LegacyCustom({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  permanentRedirect(`/create${q.size ? `?${q}` : ""}`);
}
