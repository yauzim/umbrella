import Image from "next/image";
import Link from "next/link";
import {
  getLeaderboard,
  METRICS,
  type LeaderboardMetric,
  type LeaderboardScope,
} from "@/lib/leaderboard";
import { getSession } from "@/lib/session";
import { JumpToMe } from "@/components/jump-to-me";

export const metadata = { title: "Leaderboard — Umbrella" };

const SCOPES: { key: LeaderboardScope; label: string }[] = [
  { key: "world", label: "World" },
  { key: "region", label: "Region" },
  { key: "friends", label: "Friends" },
];

function isMetric(v: string | undefined): v is LeaderboardMetric {
  return METRICS.some((m) => m.key === v);
}
function isScope(v: string | undefined): v is LeaderboardScope {
  return SCOPES.some((s) => s.key === v);
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; scope?: string }>;
}) {
  const sp = await searchParams;
  const metric: LeaderboardMetric = isMetric(sp.metric) ? sp.metric : "perfect";
  const scope: LeaderboardScope = isScope(sp.scope) ? sp.scope : "world";

  const session = await getSession();
  const board = await getLeaderboard({
    metric,
    scope,
    viewerSteamId: session?.steamId ?? null,
  });

  const unit = METRICS.find((m) => m.key === metric)!.unit;
  const viewerOnPage = board.rows.some((r) => r.isViewer);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        {session && (
          <Link
            href={`/u/${session.steamId}`}
            className="rounded-lg border border-border-strong bg-raised px-3 py-1.5 text-sm font-medium transition-colors hover:border-accent"
          >
            My profile
          </Link>
        )}
      </div>

      {/* Metric ------------------------------------------------------- */}
      <div className="mt-6 flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <Link
            key={m.key}
            href={`/leaderboard?metric=${m.key}&scope=${scope}`}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              metric === m.key
                ? "border-accent bg-raised"
                : "border-border bg-panel hover:border-border-strong"
            }`}
          >
            {m.label}
          </Link>
        ))}
      </div>

      {/* Scope -------------------------------------------------------- */}
      <div className="mt-2 flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <Link
            key={s.key}
            href={`/leaderboard?metric=${metric}&scope=${s.key}`}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              scope === s.key
                ? "bg-accent font-medium text-bg"
                : "bg-panel text-muted hover:text-text"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Region needs a country Steam will not always give us --------- */}
      {scope === "region" && board.viewerMissingRegion && (
        <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-medium">Steam is not telling us your country.</p>
          <p className="mt-1 text-amber-200/80">
            Region standings come from your Steam profile, which has to be
            public and have a country set. Open{" "}
            <a
              className="underline underline-offset-2"
              href="https://steamcommunity.com/my/edit/settings"
              target="_blank"
              rel="noreferrer"
            >
              Steam → Edit Profile → Privacy Settings
            </a>{" "}
            and set <strong>My profile</strong> to Public, then set your
            country under{" "}
            <a
              className="underline underline-offset-2"
              href="https://steamcommunity.com/my/edit/info"
              target="_blank"
              rel="noreferrer"
            >
              Edit Profile → Country
            </a>
            . Sync again afterwards and you will appear here.
          </p>
        </div>
      )}

      {scope !== "world" && !session && (
        <p className="mt-5 rounded-lg border border-border bg-panel px-4 py-3 text-sm text-muted">
          Sign in to see {scope === "friends" ? "friends" : "region"} standings.
        </p>
      )}

      {/* Standings ---------------------------------------------------- */}
      {board.rows.length > 0 ? (
        <>
          <p className="mt-6 text-xs text-faint">
            {board.total.toLocaleString()}{" "}
            {board.total === 1 ? "player" : "players"} ranked · {unit}
          </p>

          <ol className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-panel">
            {board.rows.map((r) => (
              <li
                key={r.steamId}
                id={r.isViewer ? "me" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${
                  r.isViewer ? "bg-raised" : ""
                }`}
                style={
                  r.isViewer
                    ? { boxShadow: "inset 3px 0 0 0 var(--accent)" }
                    : undefined
                }
              >
                <span className="tnum w-8 shrink-0 text-sm font-semibold text-faint">
                  {r.rank}
                </span>

                {r.avatarUrl ? (
                  <Image
                    src={r.avatarUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 shrink-0 rounded-md"
                    unoptimized
                  />
                ) : (
                  <span className="size-8 shrink-0 rounded-md bg-raised" />
                )}

                <Link
                  href={`/u/${r.handle ?? r.steamId}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                >
                  {r.personaName}
                  {r.isViewer && (
                    <span className="ml-2 text-xs text-faint">you</span>
                  )}
                </Link>

                {r.countryCode && (
                  <span className="shrink-0 text-xs text-faint">
                    {r.countryCode}
                  </span>
                )}

                <span className="tnum shrink-0 text-sm font-semibold">
                  {r.score.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>

          {/* Standing when the viewer is off the visible page ---------- */}
          {board.viewer && !viewerOnPage && (
            <div
              className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-panel px-3 py-2.5 sm:px-4"
              style={{ boxShadow: "inset 3px 0 0 0 var(--accent)" }}
            >
              <span className="tnum w-8 shrink-0 text-sm font-semibold text-faint">
                {board.viewer.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {board.viewer.personaName}
                <span className="ml-2 text-xs text-faint">you</span>
              </span>
              <span className="tnum shrink-0 text-sm font-semibold">
                {board.viewer.score.toLocaleString()}
              </span>
            </div>
          )}

          {board.viewer && viewerOnPage && <JumpToMe rank={board.viewer.rank} />}
        </>
      ) : (
        <p className="mt-6 rounded-lg border border-border bg-panel px-4 py-8 text-center text-sm text-muted">
          {scope === "friends"
            ? "None of your Steam friends have synced a library here yet."
            : scope === "region" && board.viewerMissingRegion
              ? "Set a country on your Steam profile to appear in region standings."
              : "Nobody has synced a library yet."}
        </p>
      )}
    </div>
  );
}
