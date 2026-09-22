import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/session";
import { verifyCallback } from "@/lib/steam/openid";
import { getPlayerSummary } from "@/lib/steam/api";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const steamId = await verifyCallback(request.nextUrl.searchParams);
  if (!steamId) {
    return NextResponse.redirect(`${appUrl}/?error=steam_auth_failed`);
  }

  // Create the row immediately so the profile page has something to render
  // while the (much slower) full library sync runs.
  const [existing] = await db
    .select({ steamId: users.steamId })
    .from(users)
    .where(eq(users.steamId, steamId))
    .limit(1);

  if (!existing) {
    const summary = await getPlayerSummary(steamId);
    await db
      .insert(users)
      .values({
        steamId,
        personaName: summary?.personaname ?? steamId,
        avatarUrl: summary?.avatarfull ?? null,
        profileUrl: summary?.profileurl ?? null,
      })
      .onConflictDoNothing()
      .run();
  }

  await createSession(steamId);
  return NextResponse.redirect(`${appUrl}/u/${steamId}`);
}
