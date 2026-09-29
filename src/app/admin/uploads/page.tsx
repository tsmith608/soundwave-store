import type { AssetStatus } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { ActionButton } from "@/components/admin/ActionButton";
import { Badge, H1, Pager, Table, when } from "@/components/admin/ui";
import { deleteUploadAction } from "../actions";

const PAGE = 50;

/** Customer recordings (metadata only — audio is never listed or previewed here). */
export default async function Uploads({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = ["pending", "ready", "rejected", "deleted"].includes(sp.status ?? "") ? (sp.status as AssetStatus) : undefined;
  const [assets, totals] = await Promise.all([
    prisma.uploadedAsset.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE + 1, include: { orderItems: { select: { order: { select: { number: true, id: true } } } } } }),
    prisma.uploadedAsset.groupBy({ by: ["status"], _count: { _all: true }, _sum: { sizeBytes: true } }),
  ]);
  return (
    <div>
      <H1>Uploads</H1>
      <p className="mb-4 text-sm">
        {totals.map((t) => `${t.status}: ${t._count._all} (${((t._sum.sizeBytes ?? 0) / 1e6).toFixed(1)} MB)`).join(" · ") || "No uploads yet."}
      </p>
      <form className="mb-4 flex gap-2">
        <select name="status" defaultValue={sp.status ?? ""} className="h-10 border-2 border-ink px-2">
          <option value="">All</option>
          <option value="ready">ready</option>
          <option value="pending">pending</option>
          <option value="rejected">rejected</option>
          <option value="deleted">deleted</option>
        </select>
        <button className="h-10 border-2 border-ink px-3 text-sm font-semibold">Filter</button>
      </form>
      <Table
        head={["Uploaded", "Status", "Source", "Size", "Length", "Orders", "Expires", ""]}
        empty="No uploads."
        rows={assets.slice(0, PAGE).map((a) => [
          when(a.createdAt),
          <Badge key="s">{a.status}</Badge>,
          a.source,
          `${(a.sizeBytes / 1e6).toFixed(2)} MB`,
          a.durationMs ? `${Math.round(a.durationMs / 1000)}s` : "—",
          a.orderItems.map((i) => i.order.number).join(", ") || "—",
          a.expiresAt ? when(a.expiresAt) : a.status === "ready" ? "kept (order)" : "—",
          a.status === "ready" || a.status === "pending" ? <ActionButton key="d" action={deleteUploadAction.bind(null, a.id)} label="Delete" tone="danger" confirm="Permanently delete this recording?" /> : a.deleteReason ?? "",
        ])}
      />
      <Pager base="/admin/uploads" page={page} hasMore={assets.length > PAGE} params={{ status: sp.status }} />
    </div>
  );
}
