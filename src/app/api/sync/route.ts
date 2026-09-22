import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { syncUser } from "@/lib/steam/sync";

/** A full library scan is hundreds of sequential-ish API calls. */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Only ever sync yourself — otherwise anyone could burn the API budget
  // by requesting scans of arbitrary accounts.
  const force = request.nextUrl.searchParams.get("force") === "1";

  try {
    const report = await syncUser(session.steamId, { force });
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
