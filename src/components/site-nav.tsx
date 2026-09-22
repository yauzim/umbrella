import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";

/** Slim global bar. The profile banner sits directly beneath it. */
export async function SiteNav() {
  const session = await getSession();

  let profileHref: string | null = null;
  if (session) {
    const [me] = await db
      .select({ handle: users.handle })
      .from(users)
      .where(eq(users.steamId, session.steamId))
      .limit(1);
    profileHref = `/u/${me?.handle ?? session.steamId}`;
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-5 px-4 sm:px-6">
        <Link href="/" className="text-sm font-bold tracking-tight">
          Umbrella
        </Link>
        <Link
          href="/leaderboard"
          className="text-sm text-muted transition-colors hover:text-text"
        >
          Leaderboard
        </Link>

        <div className="ml-auto">
          {profileHref ? (
            <Link
              href={profileHref}
              className="text-sm text-muted transition-colors hover:text-text"
            >
              My profile
            </Link>
          ) : (
            <Link
              href="/api/auth/steam"
              className="text-sm text-muted transition-colors hover:text-text"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
