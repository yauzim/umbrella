import { NextResponse } from "next/server";
import { buildLoginUrl } from "@/lib/steam/openid";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.redirect(buildLoginUrl(appUrl));
}
