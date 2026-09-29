import { prisma } from "@/lib/server/db";
import { ActionButton } from "@/components/admin/ActionButton";
import { Badge, H1, Table, when } from "@/components/admin/ui";
import { retryJobAction, retryWebhookAction } from "../actions";

export default async function System() {
  const [hooks, jobs, emails, queue, audit] = await Promise.all([
    prisma.webhookEvent.findMany({ orderBy: [{ status: "asc" }, { receivedAt: "desc" }], take: 50 }),
    prisma.job.findMany({ where: { status: { in: ["failed", "dead", "running"] } }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.emailMessage.findMany({ where: { status: { in: ["failed", "bounced", "complained"] } }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.job.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return (
    <div>
      <H1>System</H1>
      <p className="mb-6 text-sm">Job queue: {queue.map((q) => `${q.status} ${q._count._all}`).join(" · ") || "empty"}. If &ldquo;queued&rdquo; keeps growing, the worker isn&rsquo;t running.</p>
      <h2 className="mb-2 text-xl font-bold">Webhooks (failed first)</h2>
      <Table
        head={["Received", "Provider", "Type", "Status", "Attempts", "Error", ""]}
        empty="No webhooks received yet."
        rows={hooks.map((h) => [when(h.receivedAt), h.provider, h.type, <Badge key="s">{h.status}</Badge>, h.attempts, h.lastError ?? "", h.status === "failed" ? <ActionButton key="r" action={retryWebhookAction.bind(null, h.id)} label="Retry" /> : ""])}
      />
      <h2 className="mb-2 mt-8 text-xl font-bold">Jobs needing attention</h2>
      <Table
        head={["Type", "Status", "Attempts", "Next run", "Error", ""]}
        empty="All jobs healthy."
        rows={jobs.map((j) => [j.type, <Badge key="s">{j.status}</Badge>, `${j.attempts}/${j.maxAttempts}`, when(j.runAt), <span key="e" className="text-[#7E2512]">{j.lastError}</span>, j.status !== "running" ? <ActionButton key="r" action={retryJobAction.bind(null, j.id)} label="Retry now" /> : ""])}
      />
      <h2 className="mb-2 mt-8 text-xl font-bold">Email problems</h2>
      <Table head={["When", "Template", "To", "Status", "Error"]} empty="No email problems." rows={emails.map((m) => [when(m.updatedAt), m.template, m.to, <Badge key="s">{m.status}</Badge>, m.error ?? ""])} />
      <h2 className="mb-2 mt-8 text-xl font-bold">Admin audit log</h2>
      <Table head={["When", "Who", "Action", "Target"]} empty="No admin actions yet." rows={audit.map((a) => [when(a.createdAt), a.actor, a.action, `${a.targetType} ${a.targetId}`])} />
    </div>
  );
}
