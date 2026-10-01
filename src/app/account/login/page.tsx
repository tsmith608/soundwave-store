import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LoginForm from "@/components/account/LoginForm";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Sign in — ${BRAND_NAME}`, robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-md px-4 py-16">
          <h1 className="display text-6xl">Sign in</h1>
          <p className="mt-3 text-lg text-ink-soft">No password needed — we&rsquo;ll email you a secure link. You don&rsquo;t need an account to order; signing in lets you see past orders and saved designs.</p>
          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-[#B2361B]/40 bg-[#FBE7E1] p-3 text-[#7E2512]">
              {error === "rate" ? "Too many attempts — please wait a few minutes." : "That sign-in link has expired or was already used. Request a new one below."}
            </p>
          )}
          <LoginForm next={next ?? "/account"} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
