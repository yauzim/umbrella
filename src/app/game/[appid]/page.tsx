import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameArt } from "@/components/game-art";
import { ListControls } from "@/components/list-controls";
import { ReviewEditor } from "@/components/review-editor";
import { StarDisplay } from "@/components/stars";
import {
  getCompletionStats,
  getGame,
  getGameAchievements,
  getGamePlayers,
  getGameReviews,
  getMyReview,
  getRatingSummary,
} from "@/lib/game-queries";
import { getListMembership } from "@/lib/list-queries";
import { formatPercent, formatPlaytime, rarityOf } from "@/lib/rarity";
import { getSession } from "@/lib/session";

export default async function GamePage({
  params,
}: {
  params: Promise<{ appid: string }>;
}) {
  const { appid: raw } = await params;
  const appid = Number(raw);
  if (!Number.isInteger(appid)) notFound();

  const game = await getGame(appid);
  if (!game) notFound();

  const session = await getSession();

  const [stats, rating, reviews, myReview, achievements, players, lists] =
    await Promise.all([
      getCompletionStats(appid),
      getRatingSummary(appid),
      getGameReviews(appid),
      session ? getMyReview(session.steamId, appid) : Promise.resolve(null),
      getGameAchievements(appid, session?.steamId ?? null),
      getGamePlayers(appid),
      session
        ? getListMembership(session.steamId, appid)
        : Promise.resolve([]),
    ]);

  const mine = achievements.filter((a) => a.unlocked).length;

  return (
    <div>
      {/* Banner ------------------------------------------------------- */}
      <div className="relative h-36 overflow-hidden border-b border-border sm:h-48">
        {game.headerUrl && (
          <Image
            src={game.headerUrl}
            alt=""
            fill
            sizes="100vw"
            priority
            className="scale-110 object-cover opacity-30 blur-[2px]"
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-transparent" />
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        {/* Identity — relative z-10 so it paints above the banner ------ */}
        <header className="relative z-10 -mt-16 flex flex-col gap-4 sm:-mt-20 sm:flex-row sm:items-end">
          <div className="relative aspect-[460/215] w-56 shrink-0 overflow-hidden rounded-xl border-4 border-bg bg-raised sm:w-72">
            <GameArt name={game.name} src={game.headerUrl} sizes="288px" priority />
          </div>

          <div className="min-w-0 flex-1 sm:pb-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {game.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {rating.average !== null ? (
                <span className="flex items-center gap-1.5">
                  <StarDisplay value={Math.round(rating.average)} />
                  <span className="tnum">{(rating.average / 2).toFixed(1)}</span>
                  <span className="text-faint">
                    ({rating.count} {rating.count === 1 ? "rating" : "ratings"})
                  </span>
                </span>
              ) : (
                <span className="text-faint">No ratings yet</span>
              )}
              <span className="text-faint">·</span>
              <span>{game.achievementCount} achievements</span>
            </div>
          </div>

          {session && (
            <div className="sm:pb-2">
              <ListControls appid={appid} lists={lists} />
            </div>
          )}
        </header>

        {/* Completion context — the HowLongToBeat-shaped bit ----------- */}
        {/* Column count follows the number of cells: "Your progress" only
            exists for a signed-in viewer, and a fixed 4-up leaves a blank
            cell for everyone else. */}
        <section
          className={`mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border ${
            session ? "sm:grid-cols-4" : "sm:grid-cols-3"
          }`}
        >
          <Stat
            label="Median to 100%"
            value={
              stats.medianHoursToComplete !== null
                ? `${Math.round(stats.medianHoursToComplete)}h`
                : "—"
            }
            sub={
              stats.completers > 0
                ? `${stats.completers} ${stats.completers === 1 ? "completion" : "completions"}`
                : "nobody here yet"
            }
          />
          <Stat
            label="Median played"
            value={
              stats.medianHoursPlayed !== null
                ? `${Math.round(stats.medianHoursPlayed)}h`
                : "—"
            }
            sub={`${stats.players} ${stats.players === 1 ? "player" : "players"}`}
          />
          <Stat
            label="Avg completion"
            value={
              stats.averageCompletionPercent !== null
                ? `${Math.round(stats.averageCompletionPercent)}%`
                : "—"
            }
          />
          {session && (
            <Stat
              label="Your progress"
              value={`${mine}/${game.achievementCount}`}
              accent
            />
          )}
        </section>

        {stats.completers > 0 && stats.completers < 3 && (
          <p className="mt-2 text-xs text-faint">
            Based on {stats.completers}{" "}
            {stats.completers === 1 ? "person" : "people"} here — treat the
            median as a rough hint, not a benchmark.
          </p>
        )}

        {/* Your review -------------------------------------------------- */}
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            {myReview ? "Your review" : "Rate it"}
          </h2>
          {session ? (
            <ReviewEditor
              appid={appid}
              initial={
                myReview
                  ? {
                      rating: myReview.rating,
                      body: myReview.body,
                      containsSpoilers: myReview.containsSpoilers,
                    }
                  : null
              }
            />
          ) : (
            <p className="rounded-xl border border-border bg-panel px-4 py-6 text-center text-sm text-muted">
              <Link href="/api/auth/steam" className="underline underline-offset-2">
                Sign in through Steam
              </Link>{" "}
              to rate and review.
            </p>
          )}
        </section>

        {/* Reviews ------------------------------------------------------ */}
        {reviews.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              Reviews
            </h2>
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li
                  key={r.steamId}
                  className="rounded-xl border border-border bg-panel p-4"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {r.avatarUrl && (
                      <Image
                        src={r.avatarUrl}
                        alt=""
                        width={28}
                        height={28}
                        className="size-7 rounded-md"
                        unoptimized
                      />
                    )}
                    <Link
                      href={`/u/${r.handle ?? r.steamId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {r.personaName}
                    </Link>
                    <StarDisplay value={r.rating} />
                    <span className="tnum ml-auto text-xs text-faint">
                      {r.unlockedCount}/{r.achievementCount} ·{" "}
                      {formatPlaytime(r.playtimeForever)}
                    </span>
                  </div>

                  {r.body && (
                    <p
                      className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted ${
                        r.containsSpoilers
                          ? "blur-sm transition hover:blur-none focus:blur-none"
                          : ""
                      }`}
                      tabIndex={r.containsSpoilers ? 0 : undefined}
                      title={
                        r.containsSpoilers
                          ? "Contains spoilers — hover to reveal"
                          : undefined
                      }
                    >
                      {r.body}
                    </p>
                  )}
                  {r.containsSpoilers && (
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-faint">
                      Spoilers — hover to reveal
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Who else plays it -------------------------------------------- */}
        {players.length > 1 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              Players here
            </h2>
            <ul className="flex flex-wrap gap-2">
              {players.map((p) => (
                <li key={p.steamId}>
                  <Link
                    href={`/u/${p.handle ?? p.steamId}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs transition-colors hover:border-border-strong"
                  >
                    {p.avatarUrl && (
                      <Image
                        src={p.avatarUrl}
                        alt=""
                        width={20}
                        height={20}
                        className="size-5 rounded"
                        unoptimized
                      />
                    )}
                    <span className="max-w-32 truncate">{p.personaName}</span>
                    <span className="tnum text-faint">
                      {p.unlockedCount}/{p.achievementCount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Achievements -------------------------------------------------- */}
        {achievements.length > 0 && (
          <section className="mt-10">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                Achievements
              </h2>
              <p className="text-xs text-faint">Rarest first</p>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-panel">
              {achievements.map((a) => {
                const r = rarityOf(a.globalPercent);
                const icon = a.unlocked ? a.icon : (a.iconGray ?? a.icon);
                return (
                  <li
                    key={a.id}
                    className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${
                      a.unlocked ? "" : "opacity-55"
                    }`}
                  >
                    {icon && (
                      <Image
                        src={icon}
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 shrink-0 rounded border border-border"
                        unoptimized
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {a.displayName}
                      </p>
                      {a.description && (
                        <p className="truncate text-xs text-faint">
                          {a.description}
                        </p>
                      )}
                    </div>
                    <span
                      className="tnum shrink-0 text-xs font-semibold"
                      style={{ color: r.color }}
                    >
                      {formatPercent(a.globalPercent)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

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
    <div className="bg-panel px-3 py-3 sm:px-4 sm:py-4">
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
