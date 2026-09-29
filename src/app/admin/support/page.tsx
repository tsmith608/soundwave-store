import { prisma } from "@/lib/server/db";
import { ActionButton } from "@/components/admin/ActionButton";
import { Badge, H1, when } from "@/components/admin/ui";
import { SUPPORT_EMAIL } from "@/lib/site";
import { setContactStatusAction } from "../actions";

export default async function Support() {
  const messages = await prisma.contactMessage.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 });
  return (
    <div>
      <H1>Support</H1>
      <p className="mb-4 text-sm text-ink-soft">Messages from the contact form (also emailed to {SUPPORT_EMAIL}). Reply from your email client.</p>
      {messages.length === 0 && <p className="border-2 border-dashed border-ink p-6 text-ink-soft">No messages.</p>}
      <ul className="space-y-4">
        {messages.map((m) => (
          <li key={m.id} className="border-2 border-ink p-4">
            <p className="flex flex-wrap items-center gap-2">
              <strong>{m.name}</strong> &lt;<a className="underline" href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.topic)}`}>{m.email}</a>&gt; <Badge>{m.status}</Badge>
              <span className="text-sm text-ink-soft">
                {m.topic}
                {m.orderNumber ? ` · ${m.orderNumber}` : ""} · {when(m.createdAt)}
              </span>
            </p>
            <p className="mt-2 whitespace-pre-wrap">{m.message}</p>
            <div className="mt-3 flex gap-2">
              {m.status !== "answered" && <ActionButton action={setContactStatusAction.bind(null, m.id, "answered")} label="Mark answered" />}
              {m.status !== "closed" && <ActionButton action={setContactStatusAction.bind(null, m.id, "closed")} label="Close" />}
              {m.status !== "open" && <ActionButton action={setContactStatusAction.bind(null, m.id, "open")} label="Reopen" />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
