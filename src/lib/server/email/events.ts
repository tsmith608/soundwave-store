import { prisma } from "../db";

/** Resend delivery events → EmailMessage status (for support visibility). */
export async function handleResendEvent(payload: unknown): Promise<"processed" | "ignored"> {
  const e = payload as { type?: string; data?: { email_id?: string } };
  const id = e?.data?.email_id;
  const map: Record<string, "delivered" | "bounced" | "complained" | "failed"> = {
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.failed": "failed",
  };
  const status = e?.type ? map[e.type] : undefined;
  if (!id || !status) return "ignored";
  const r = await prisma.emailMessage.updateMany({ where: { providerMessageId: id }, data: { status } });
  return r.count ? "processed" : "ignored";
}
