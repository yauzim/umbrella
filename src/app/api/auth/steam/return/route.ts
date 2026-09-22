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
    // Steam has already proved who this is, so the sign-in itself must not
    // depend on the Web API. A missing key or a Steam outage should leave
    // the user logged in with a sparse profile, not a 500 on the way back.
    let summary: Awaited<ReturnType<typeof getPlayerSummary>> = null;
    try {
      summary = await getPlayerSummary(steamId);
    } catch (err) {
      console.warn(
        `[auth] Could not fetch Steam profile for ${steamId}; continuing with a placeholder.`,
        err instanceof Error ? err.message : err,
      );
    }

    await db
      .insert(users)
      .values({
        steamId,
        personaName: summary?.personaname ?? `Steam user ${steamId.slice(-6)}`,
        avatarUrl: summary?.avatarfull ?? null,
        profileUrl: summary?.profileurl ?? `https://steamcommunity.com/profiles/${steamId}`,
      })
      .onConflictDoNothing()
      .run();
  }

  await createSession(steamId);
  return NextResponse.redirect(`${appUrl}/u/${steamId}`);
}
