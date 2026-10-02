import { NextResponse, type NextRequest } from "next/server";
import { endSession } from "@/lib/server/auth";
import { getEnv } from "@/lib/server/env";
import { AppError, assertSameOrigin } from "@/lib/server/http";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req); // stops other sites from signing people out
  } catch (e) {
    return NextResponse.json({ error: e instanceof AppError ? e.message : "Forbidden" }, { status: 403 });
  }
  await endSession();
  return NextResponse.redirect(`${getEnv().NEXT_PUBLIC_APP_URL}/`, 303);
}
