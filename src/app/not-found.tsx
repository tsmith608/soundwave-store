import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-24 sm:px-8">
          <p className="meta">404</p>
          <h1 className="display mt-3 text-6xl">
            This page is <span className="accent !font-normal">silent.</span>
          </h1>
          <p className="mt-5 text-lg text-ink-soft">We couldn&rsquo;t find what you were looking for. It may have moved, or the link may be incomplete.</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/" className="btn btn-ink">
              <span>Go home</span>
            </Link>
            <Link href="/create" className="btn">
              <span>Create a piece</span>
            </Link>
            <Link href="/track" className="meta inline-flex min-h-[44px] items-center underline">
              Track an order
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
