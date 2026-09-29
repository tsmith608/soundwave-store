import { NextResponse, type NextRequest } from "next/server";
import { deviceKeyHash } from "@/lib/server/identity";
import { clientIp } from "@/lib/server/http";
import { completeLogin, safeNext } from "@/lib/server/login";
import { rateLimit } from "@/lib/server/rateLimit";
import { getEnv } from "@/lib/server/env";

/** Form POST from /account/verify (a POST so link-scanners can't consume the token). */
export async function POST(req: NextRequest) {
  const base = getEnv().NEXT_PUBLIC_APP_URL;
  try {
    await rateLimit("login", clientIp(req));
  } catch {
    return NextResponse.redirect(`${base}/account/login?error=rate`, 303);
  }
  const form = await req.formData();
  const token = String(form.get("token") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  const user = token ? await completeLogin(token, req.headers.get("user-agent"), await deviceKeyHash(false)) : null;
  if (!user) return NextResponse.redirect(`${base}/account/login?error=expired`, 303);
  return NextResponse.redirect(`${base}${next}`, 303);
}
