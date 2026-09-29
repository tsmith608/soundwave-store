import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Sign in — ${BRAND_NAME}`, robots: { index: false }, referrer: "no-referrer" };

export default async function Verify({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const { token = "", next = "/account" } = await searchParams;
  return (
    <div className="min-h-screen">
      <Navbar />
      <main id="main" className="mx-auto max-w-md px-4 py-20">
        <h1 className="display text-5xl">Sign in</h1>
        <p className="mt-3 text-lg text-ink-soft">Confirm to finish signing in on this device.</p>
        <form method="post" action="/api/auth/callback" className="mt-8">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="next" value={next} />
          <button className="btn btn-signal">
            <span>Continue</span>
            <span className="btn-arrow" aria-hidden>
              →
            </span>
          </button>
        </form>
      </main>
    </div>
  );
}
