import Image from "next/image";
import { notFound } from "next/navigation";
import { AchievementRow, AchievementTile } from "@/components/achievement-tile";
import { GameCard } from "@/components/game-card";
import { SyncButton } from "@/components/sync-button";
import {
  getInProgressGames,
  getLists,
  getPerfectGames,
  getProfileStats,
  getProfileUser,
  getRarestUnlocks,
  getTimeline,
} from "@/lib/queries";
import { formatPercent, formatUnlockDate } from "@/lib/rarity";
import { getSession } from "@/lib/session";
import { gameHeaderUrl } from "@/lib/steam/api";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getProfileUser(id);
  if (!user) notFound();

  const session = await getSession();
  const isOwner = session?.steamId === user.steamId;

  const [stats, rarest, perfect, inProgress, timeline, lists] =
    await Promise.all([
      getProfileStats(user.steamId),
      getRarestUnlocks(user.steamId, 6),
      getPerfectGames(user.steamId, 8),
      getInProgressGames(user.steamId, 8),
      getTimeline(user.steamId, { limit: 25 }),
      getLists(user.steamId),
    ]);

  const bannerUrl = user.bannerAppid
    ? gameHeaderUrl(user.bannerAppid)
    : (rarest[0]?.gameHeaderUrl ?? null);

  const neverSynced = user.librarySyncedAt === null;

  return (
    <div
      className="min-h-screen"
      style={{ ["--accent" as string]: user.accentColor }}
    >
      {/* Banner ------------------------------------------------------- */}
      <div className="relative h-48 overflow-hidden border-b border-border sm:h-60">
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt=""
            fill
            sizes="100vw"
            priority
            className="scale-110 object-cover opacity-40 blur-[2px]"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-panel" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-transparent" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-24">
        {/* Identity --------------------------------------------------- */}
        <header className="-mt-16 flex flex-wrap items-end gap-5">
          {user.avatarUrl && (
            <Image
              src={user.avatarUrl}
              alt=""
              width={112}
              height={112}
              className="size-24 rounded-2xl border-4 border-bg sm:size-28"
              style={{ outline: `2px solid ${user.accentColor}` }}
              unoptimized
            />
          )}

          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {user.personaName}
            </h1>
            {user.bio ? (
              <p className="mt-1 max-w-xl text-sm text-muted">{user.bio}</p>
            ) : (
              isOwner && (
                <p className="mt-1 text-sm text-faint">
                  No bio yet — this is your shelf, say something about it.
                </p>
              )
            )}
          </div>

          {isOwner && <SyncButton autoStart={neverSynced} />}
        </header>

        {/* Stats ------------------------------------------------------ */}
        <section className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          <Stat label="Achievements" value={stats.unlocked.toLocaleString()} />
          <Stat
            label="100% games"
            value={stats.perfectGames.toLocaleString()}
            accent
          />
          <Stat
            label="Rarest unlock"
            value={formatPercent(stats.rarestPercent)}
          />
          <Stat
            label="Completion"
            value={
              stats.available > 0
                ? `${Math.round((stats.unlocked / stats.available) * 100)}%`
                : "—"
            }
            sub={
              stats.available > 0
                ? `of ${stats.available.toLocaleString()} played`
                : undefined
            }
          />
        </section>

        {user.profileIsPrivate && (
          <p className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-300">
            This Steam profile is private, so achievements cannot be read.
            {isOwner &&
              " Set Steam → Privacy Settings → Game details to Public, then sync again."}
          </p>
        )}

        {neverSynced && !user.profileIsPrivate && (
          <p className="mt-4 rounded-lg border border-border bg-panel px-4 py-3 text-sm text-muted">
            {isOwner
              ? "Nothing synced yet — the first scan is running now."
              : "This profile has not been synced yet."}
          </p>
        )}

        {/* Rarest ----------------------------------------------------- */}
        {rarest.length > 0 && (
          <Section
            title="Rarest unlocks"
            hint="Ordered by how few owners on Steam have ever earned them"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rarest.map((u) => (
                <AchievementTile key={u.achievementId} unlock={u} />
              ))}
            </div>
          </Section>
        )}

        {/* Perfect ---------------------------------------------------- */}
        {perfect.length > 0 && (
          <Section
            title="Completed"
            hint={`${stats.perfectGames} games taken to 100%`}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {perfect.map((g) => (
                <GameCard key={g.appid} game={g} />
              ))}
            </div>
          </Section>
        )}

        {/* In progress ------------------------------------------------ */}
        {inProgress.length > 0 && (
          <Section title="Closest to done" hint="Sorted by how near the finish">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {inProgress.map((g) => (
                <GameCard key={g.appid} game={g} />
              ))}
            </div>
          </Section>
        )}

        {/* Lists ------------------------------------------------------ */}
        {lists.length > 0 && (
          <Section title="Lists">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lists.map((l) => (
                <div
                  key={l.id}
                  className="rounded-lg border border-border bg-panel p-4"
                >
                  <h3 className="font-medium">{l.name}</h3>
                  {l.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
                      {l.description}
                    </p>
                  )}
                  <p className="tnum mt-2 text-xs text-faint">
                    {l.itemCount} {l.itemCount === 1 ? "game" : "games"}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Timeline --------------------------------------------------- */}
        {timeline.length > 0 && (
          <Section
            title="Timeline"
            hint="Every unlock in order. Steam now; PSN and RetroAchievements merge in here later."
          >
            <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-panel">
              {groupByMonth(timeline).map(([month, unlocks]) => (
                <li key={month}>
                  <p className="bg-raised px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
                    {month}
                  </p>
                  <ul className="p-2">
                    {unlocks.map((u) => (
                      <AchievementRow key={u.achievementId} unlock={u} />
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {!neverSynced && stats.unlocked === 0 && !user.profileIsPrivate && (
          <p className="mt-10 rounded-lg border border-border bg-panel px-4 py-6 text-center text-sm text-muted">
            No achievements found in this library yet.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-panel px-4 py-4">
      <p
        className="tnum text-2xl font-bold tracking-tight"
        style={accent ? { color: "var(--accent)" } : undefined}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
      {sub && <p className="text-[11px] text-faint">{sub}</p>}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {hint && <p className="text-xs text-faint">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Groups the feed into month buckets, preserving the query's ordering. */
function groupByMonth<T extends { unlockedAt: Date | null }>(
  rows: T[],
): [string, T[]][] {
  const out: [string, T[]][] = [];
  for (const row of rows) {
    const key = row.unlockedAt
      ? row.unlockedAt.toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })
      : formatUnlockDate(null);
    const last = out[out.length - 1];
    if (last && last[0] === key) last[1].push(row);
    else out.push([key, [row]]);
  }
  return out;
}
