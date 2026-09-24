import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AchievementRow, AchievementTile } from "@/components/achievement-tile";
import { AvatarFrame } from "@/components/avatar-frame";
import { FriendsSidebar } from "@/components/friends-section";
import { GameCard } from "@/components/game-card";
import { SyncButton } from "@/components/sync-button";
import {
  getFavoriteGames,
  getInProgressGames,
  getLists,
  getPerfectGames,
  getProfileStats,
  getBannerArt,
  getProfileFriends,
  getProfileUser,
  getRarestUnlocks,
  getRecentGames,
  getTimeline,
  resolveAvatarUrl,
} from "@/lib/queries";
import { frameFor } from "@/lib/frames";
import { formatPercent, formatUnlockDate } from "@/lib/rarity";
import { getSession } from "@/lib/session";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getProfileUser(id);
  if (!user) notFound();

  // Prefer the readable URL. Reaching the profile by SteamID still works
  // (old links, no vanity name), but it hands over to /u/<handle>.
  if (user.handle && id !== user.handle) {
    redirect(`/u/${user.handle}`);
  }

  const session = await getSession();
  const isOwner = session?.steamId === user.steamId;

  const [
    stats,
    favorites,
    recent,
    rarest,
    perfect,
    inProgress,
    timeline,
    lists,
    avatarUrl,
    friends,
  ] = await Promise.all([
    getProfileStats(user.steamId),
    getFavoriteGames(user.steamId),
    getRecentGames(user.steamId, 4),
    getRarestUnlocks(user.steamId, 6, 2),
    getPerfectGames(user.steamId, 8),
    getInProgressGames(user.steamId, 8),
    getTimeline(user.steamId, { limit: 25 }),
    getLists(user.steamId),
    resolveAvatarUrl(user),
    getProfileFriends(user.steamId),
  ]);

  const banner = await getBannerArt(
    user.bannerAppid,
    favorites[0]?.appid ?? rarest[0]?.appid ?? null,
  );
  const frame = frameFor(stats.rarestPercent);

  const neverSynced = user.librarySyncedAt === null;
  const hasApiKey = Boolean(process.env.STEAM_API_KEY);

  return (
    <div
      className="min-h-screen"
      style={{ ["--accent" as string]: user.accentColor }}
    >
      {/* Banner ------------------------------------------------------- */}
      {/* Hero art (1920x620) rather than a stretched header thumbnail, and
          shown at real opacity — the point of choosing a game is seeing it.
          Legibility comes from the scrims below, not from blurring the art
          into mush. */}
      <div className="relative h-52 overflow-hidden border-b border-border sm:h-72">
        {banner.hero || banner.header ? (
          <Image
            src={banner.hero ?? banner.header!}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover object-[center_30%]"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-panel" />
        )}

        {/* Vertical scrim carries the art into the page background; the
            horizontal one keeps the left column readable over busy art. */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-bg/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/80 via-transparent to-transparent" />

        {/* The game's own wordmark, composited the way Steam's library
            does it. Absent for very new releases, so it is optional. */}
        {banner.logo && (
          <div className="pointer-events-none absolute bottom-4 right-4 hidden h-16 w-48 opacity-70 sm:block">
            <Image
              src={banner.logo}
              alt=""
              fill
              sizes="192px"
              className="object-contain object-right-bottom drop-shadow-lg"
              unoptimized
            />
          </div>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {/* Identity --------------------------------------------------- */}
        {/* `relative z-10` is load-bearing: the banner above is positioned,
            and positioned elements paint over static ones whatever the DOM
            order, so without this the banner's gradient covers the top of
            the avatar that is meant to overlap it. */}
        <header className="relative z-10 -mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:gap-5">
          <div className="flex items-end gap-4">
            {/* Always rendered, even without art: it is what gives the
                header its height, so an empty avatar would otherwise pull
                the name up into the banner where it is unreadable. */}
            {/* Frame is earned from the rarest achievement held, so the
                ring is a claim you can verify by scrolling down. */}
            <span className="sm:hidden">
              <AvatarFrame
                src={avatarUrl}
                fallback={user.personaName}
                frame={frame}
                size={84}
                priority
              />
            </span>
            <span className="hidden sm:inline-block">
              <AvatarFrame
                src={avatarUrl}
                fallback={user.personaName}
                frame={frame}
                size={124}
                priority
              />
            </span>

            <div className="min-w-0 flex-1 pb-1 sm:hidden">
              <h1 className="truncate text-xl font-bold tracking-tight">
                {user.personaName}
              </h1>
              <p className="text-[11px] font-medium" style={{ color: frame.colors[0] }}>
                {frame.label}
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1 sm:pb-1">
            <div className="hidden items-center gap-2.5 sm:flex">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {user.personaName}
              </h1>
              {frame.tier !== "none" && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    color: frame.colors[0],
                    backgroundColor: frame.glow,
                  }}
                  title={frame.requirement}
                >
                  {frame.label}
                </span>
              )}
            </div>
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

          {isOwner && (
            <div className="flex items-start justify-between gap-3 sm:flex-col sm:items-end">
              <Link
                href="/settings"
                className="rounded-lg border border-border-strong bg-raised px-3 py-1.5 text-sm font-medium transition-colors hover:border-accent"
              >
                Customize
              </Link>
              {hasApiKey && <SyncButton autoStart={neverSynced} />}
            </div>
          )}
        </header>

        {/* Body: main column + a friends column that runs the full
            height of the page on desktop. It holds five friends, starts
            level with the stats row, and sticks under the nav so they stay
            in view all the way down. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-6">
          <div className="min-w-0">
            {/* Stats ------------------------------------------------------ */}
            <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:mt-8 sm:grid-cols-4">
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

            {isOwner && !hasApiKey && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <p className="font-medium">
                  Signed in — but no Steam API key is configured.
                </p>
                <p className="mt-1 text-amber-200/80">
                  Achievements cannot be fetched until one is set. Get a key at{" "}
                  <a
                    className="underline underline-offset-2"
                    href="https://steamcommunity.com/dev/apikey"
                    target="_blank"
                    rel="noreferrer"
                  >
                    steamcommunity.com/dev/apikey
                  </a>
                  , add it to{" "}
                  <code className="rounded bg-black/30 px-1">.env.local</code> as{" "}
                  <code className="rounded bg-black/30 px-1">STEAM_API_KEY</code>,
                  then restart the dev server.
                </p>
              </div>
            )}

            {user.profileIsPrivate && (
              <p className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-300">
                This Steam profile is private, so achievements cannot be read.
                {isOwner &&
                  " Set Steam → Privacy Settings → Game details to Public, then sync again."}
              </p>
            )}

            {neverSynced && !user.profileIsPrivate && hasApiKey && (
              <p className="mt-4 rounded-lg border border-border bg-panel panel-raised px-4 py-3 text-sm text-muted">
                {isOwner
                  ? "Nothing synced yet — the first scan is running now."
                  : "This profile has not been synced yet."}
              </p>
            )}

            {/* Pinned · Recently played · Friends ------------------------- */}
            {/* Each game block is a fixed 2x2 so the cards get real size. On
                desktop friends live in the full-height column instead; below
                that width this compact box of five sits under the games, so
                phones do not have friends buried beneath the timeline. */}
            {(favorites.length > 0 || recent.length > 0 || friends.length > 0) && (
              <div className="mt-8 grid gap-8 md:grid-cols-2 lg:gap-6">
                <section>
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 className="text-lg font-semibold tracking-tight">Pinned</h2>
                    {isOwner && favorites.length === 0 && (
                      <Link
                        href="/settings"
                        className="text-xs text-faint underline-offset-2 hover:underline"
                      >
                        Pick four
                      </Link>
                    )}
                  </div>
                  {favorites.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {favorites.map((g) => (
                        <GameCard key={g.appid} game={g} />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-xs text-faint">
                      {isOwner
                        ? "Pin four games you are proud of."
                        : "Nothing pinned yet."}
                    </p>
                  )}
                </section>

                {recent.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-lg font-semibold tracking-tight">
                      Recently played
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      {recent.map((g) => (
                        <GameCard key={g.appid} game={g} />
                      ))}
                    </div>
                  </section>
                )}

                <FriendsSidebar
                  friends={friends}
                  isOwner={isOwner}
                  profilePath={`/u/${user.handle ?? user.steamId}`}
                  className="md:col-span-2 lg:hidden"
                />
              </div>
            )}

            {/* Completed -------------------------------------------------- */}
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

            {/* Rarest ----------------------------------------------------- */}
            {rarest.length > 0 && (
              <Section
                title="Rarest unlocks"
                hint="At most two per game, so the shelf shows range"
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rarest.map((u) => (
                    <AchievementTile key={u.achievementId} unlock={u} />
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
                    <Link
                      key={l.id}
                      href={`/u/${user.handle ?? user.steamId}/lists/${l.slug}`}
                      className="block rounded-lg border border-border bg-panel panel-raised p-4 transition-colors hover:border-border-strong"
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
                    </Link>
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
                <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-panel panel-raised">
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
              <p className="mt-10 rounded-lg border border-border bg-panel panel-raised px-4 py-6 text-center text-sm text-muted">
                No achievements found in this library yet.
              </p>
            )}
          </div>

          {/* The aside stretches the full height of the main column; the
              box inside is sticky, so its five friends ride along from the
              stats row to the bottom. mt-8 lines its top up with the stats. */}
          <aside className="hidden lg:block">
            <div className="sticky top-16 mt-8">
              <FriendsSidebar
                friends={friends}
                isOwner={isOwner}
                profilePath={`/u/${user.handle ?? user.steamId}`}
              />
            </div>
          </aside>
        </div>
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
    <div className="bg-panel panel-raised px-3 py-3 sm:px-4 sm:py-4">
      <p
        className="tnum text-xl font-bold tracking-tight sm:text-2xl"
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
