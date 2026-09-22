import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(`/u/${session.steamId}`);

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20">
      <p className="text-sm font-medium tracking-wide text-accent">Umbrella</p>

      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        A profile worth showing for the achievements you actually earned.
      </h1>

      <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
        Every achievement tracker is a spreadsheet with a forum attached. This
        one is a shelf: your rarest unlocks up front, your 100% runs as cover
        art, and one timeline of everything you have ever finished.
      </p>

      <ul className="mt-8 space-y-2.5 text-sm text-muted">
        <Feature>
          Rarity read at a glance — a 0.3% unlock should not look like a 40% one
        </Feature>
        <Feature>
          Lists you control: a backlog, what you are hunting now, a shelf of
          personal bests
        </Feature>
        <Feature>
          Steam today. PSN and RetroAchievements merge into the same timeline
          next.
        </Feature>
      </ul>

      <div className="mt-10">
        <Link
          href="/api/auth/steam"
          className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-raised px-5 py-3 font-medium transition-colors hover:border-accent"
        >
          Sign in through Steam
        </Link>
        <p className="mt-3 text-xs text-faint">
          Steam handles the login — this app never sees your password. Your
          Game details privacy must be Public for achievements to be readable.
        </p>
      </div>

      {error === "steam_auth_failed" && (
        <p className="mt-6 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-300">
          Steam could not verify that sign-in. Please try again.
        </p>
      )}
    </main>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
      <span>{children}</span>
    </li>
  );
}
