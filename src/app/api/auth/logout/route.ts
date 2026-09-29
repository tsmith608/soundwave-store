import { NextResponse } from "next/server";
import { endSession } from "@/lib/server/auth";
import { getEnv } from "@/lib/server/env";

export async function POST() {
  await endSession();
  return NextResponse.redirect(`${getEnv().NEXT_PUBLIC_APP_URL}/`, 303);
}
