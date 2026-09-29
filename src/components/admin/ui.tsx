import Link from "next/link";
import React from "react";
import type { OrderStatus } from "@prisma/client";

export function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="display mb-6 text-4xl">{children}</h1>;
}

const TONE: Partial<Record<OrderStatus | string, string>> = {
  paid: "bg-film",
  processing_artwork: "bg-film",
  ready_for_fulfillment: "bg-film",
  submitted_to_fulfillment: "bg-botanical",
  in_production: "bg-botanical",
  shipped: "bg-botanical",
  delivered: "bg-botanical",
  cancelled: "bg-paper-2",
  refunded: "bg-paper-2",
  failed: "bg-[#FBE7E1]",
  pending_payment: "bg-paper-2",
};

export function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-block border border-ink px-1.5 py-0.5 text-xs ${tone ? TONE[tone] ?? "" : ""}`}>{children}</span>;
}

export function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="border-2 border-dashed border-ink p-6 text-ink-soft">{empty}</p>;
  return (
    <div className="overflow-x-auto border-2 border-ink">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-paper-2 text-left">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-ink/30 align-top">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ base, page, hasMore, params = {} }: { base: string; page: number; hasMore: boolean; params?: Record<string, string | undefined> }) {
  const q = (p: number) => {
    const u = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${base}?${u}`;
  };
  return (
    <nav className="mt-4 flex gap-4 text-sm" aria-label="Pages">
      {page > 1 && <Link href={q(page - 1)} className="underline">← Previous</Link>}
      <span className="text-ink-soft">Page {page}</span>
      {hasMore && <Link href={q(page + 1)} className="underline">Next →</Link>}
    </nav>
  );
}

export const money = (c: number | null | undefined) => (c == null ? "—" : `$${(c / 100).toFixed(2)}`);
export const when = (d: Date | null | undefined) => (d ? d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—");
