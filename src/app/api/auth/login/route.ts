import { NextResponse } from "next/server";
import { assertSameOrigin, clientIp, parseJson, route, z } from "@/lib/server/http";
import { requestLogin } from "@/lib/server/login";
import { rateLimit } from "@/lib/server/rateLimit";

const Body = z.object({ email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(254), next: z.string().max(200).optional() });

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  await rateLimit("login", ip);
  const { email, next } = await parseJson(req, Body);
  await requestLogin(email, next ?? "/account", ip);
  return NextResponse.json({ ok: true });
});
