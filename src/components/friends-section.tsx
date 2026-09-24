import Image from "next/image";
import Link from "next/link";
import { AvatarFrame } from "@/components/avatar-frame";
import { frameFor } from "@/lib/frames";
import type { ProfileFriend } from "@/lib/queries";

/** Non-members beyond this collapse to a "+N" count. */
const COMPACT_LIMIT = 18;

/**
 * Steam friends on a profile.
 *
 * Members get the full treatment — their own earned frame, completion
 * count and a link — because they are people you can actually compare
 * shelves with. Friends who have not joined are a compact strip that links
 * out to Steam, so the section is useful before anyone else signs up.
 */
export function FriendsSection({
  friends,
  isOwner,
}: {
  friends: ProfileFriend[];
  isOwner: boolean;
}) {
  if (friends.length === 0) return null;

  const members = friends.filter((f) => f.isMember);
  const others = friends.filter((f) => !f.isMember);
  const shown = others.slice(0, COMPACT_LIMIT);
  const hidden = others.length - shown.length;

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Friends{" "}
          <span className="tnum text-sm font-normal text-faint">
            {friends.length}
          </span>
        </h2>
        <p className="text-xs text-faint">
          {members.length > 0
            ? `${members.length} on Umbrella`
            : "None on Umbrella yet"}
        </p>
      </div>

      {members.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((f) => {
            const frame = frameFor(f.rarestPercent);
            return (
              <li key={f.steamId}>
                <Link
                  href={`/u/${f.handle ?? f.steamId}`}
                  className="panel-raised flex items-center gap-3 rounded-xl border border-border bg-panel p-2.5 transition-colors hover:border-border-strong"
                >
                  <AvatarFrame
                    src={f.avatarUrl}
                    fallback={f.personaName ?? "?"}
                    frame={frame}
                    size={48}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {f.personaName ?? "Steam user"}
                    </p>
                    <p className="tnum text-xs text-faint">
                      {f.perfectGames} at 100%
                      {frame.tier !== "none" && (
                        <span style={{ color: frame.colors[0] }}>
                          {" · "}
                          {frame.label}
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {shown.length > 0 && (
        <div
          className={`panel-raised rounded-xl border border-border bg-panel p-3 ${
            members.length > 0 ? "mt-2" : ""
          }`}
        >
          <ul className="flex flex-wrap gap-1.5">
            {shown.map((f) => (
              <li key={f.steamId}>
                <a
                  href={`https://steamcommunity.com/profiles/${f.steamId}`}
                  target="_blank"
                  rel="noreferrer"
                  title={`${f.personaName ?? "Steam user"} — not on Umbrella yet`}
                  className="block size-9 overflow-hidden rounded-lg border border-border opacity-70 grayscale-[35%] transition hover:opacity-100 hover:grayscale-0"
                >
                  {f.avatarUrl ? (
                    <Image
                      src={f.avatarUrl}
                      alt={f.personaName ?? ""}
                      width={36}
                      height={36}
                      className="size-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-raised text-xs text-faint">
                      {(f.personaName ?? "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                </a>
              </li>
            ))}
            {hidden > 0 && (
              <li className="tnum flex size-9 items-center justify-center rounded-lg border border-dashed border-border text-[11px] text-faint">
                +{hidden}
              </li>
            )}
          </ul>
          {isOwner && members.length === 0 && (
            <p className="mt-2.5 text-xs text-faint">
              When any of them sign in, they show up here with their shelf and
              frame — and on your friends leaderboard.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
