import Image from "next/image";
import Link from "next/link";
import { AvatarFrame } from "@/components/avatar-frame";
import { frameFor } from "@/lib/frames";
import type { ProfileFriend } from "@/lib/queries";

/** How many friends the profile sidebar shows before "View all". */
export const SIDEBAR_FRIENDS = 5;

/**
 * One friend. Members link to their Umbrella profile and wear their own
 * earned frame; everyone else links out to Steam, slightly muted, so it is
 * obvious at a glance who you can actually compare shelves with.
 */
export function FriendRow({ friend }: { friend: ProfileFriend }) {
  const name = friend.personaName ?? "Steam user";

  if (friend.isMember) {
    const frame = frameFor(friend.rarestPercent);
    return (
      <Link
        href={`/u/${friend.handle ?? friend.steamId}`}
        className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-raised"
      >
        <AvatarFrame
          src={friend.avatarUrl}
          fallback={name}
          frame={frame}
          size={40}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="tnum block truncate text-xs text-faint">
            {friend.perfectGames} at 100%
            {frame.tier !== "none" && (
              <span style={{ color: frame.colors[0] }}> · {frame.label}</span>
            )}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <a
      href={`https://steamcommunity.com/profiles/${friend.steamId}`}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-raised"
    >
      <span className="block size-10 shrink-0 overflow-hidden rounded-lg border border-border opacity-80 grayscale-[35%] transition group-hover:opacity-100 group-hover:grayscale-0">
        {friend.avatarUrl ? (
          <Image
            src={friend.avatarUrl}
            alt=""
            width={40}
            height={40}
            className="size-full object-cover"
            unoptimized
          />
        ) : (
          <span className="flex size-full items-center justify-center bg-raised text-xs text-faint">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-muted group-hover:text-text">
          {name}
        </span>
        <span className="block text-xs text-faint">Not on Umbrella yet</span>
      </span>
    </a>
  );
}

/**
 * Profile sidebar: a handful of friends, members first, with a way through
 * to the rest. Deliberately short — it is context beside the shelf, not a
 * second shelf.
 */
export function FriendsSidebar({
  friends,
  profilePath,
  isOwner,
  className = "",
}: {
  friends: ProfileFriend[];
  profilePath: string;
  isOwner: boolean;
  className?: string;
}) {
  if (friends.length === 0) return null;

  const members = friends.filter((f) => f.isMember).length;
  const shown = friends.slice(0, SIDEBAR_FRIENDS);

  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Friends{" "}
          <span className="tnum text-sm font-normal text-faint">
            {friends.length}
          </span>
        </h2>
        {friends.length > SIDEBAR_FRIENDS && (
          <Link
            href={`${profilePath}/friends`}
            className="text-xs text-faint underline-offset-2 hover:text-text hover:underline"
          >
            View all
          </Link>
        )}
      </div>

      <div className="panel-raised rounded-xl border border-border bg-panel p-1.5">
        {/* One column in the sidebar; two across when the section drops
            below the games on a tablet and has the full width to fill. */}
        <ul className="grid gap-0.5 md:grid-cols-2 lg:grid-cols-1">
          {shown.map((f) => (
            <li key={f.steamId}>
              <FriendRow friend={f} />
            </li>
          ))}
        </ul>

        <p className="border-t border-border px-2 pb-1 pt-2 text-[11px] text-faint">
          {members > 0
            ? `${members} on Umbrella`
            : isOwner
              ? "None here yet — when they sign in they show up with their frame."
              : "None on Umbrella yet"}
        </p>
      </div>
    </section>
  );
}

/** Every friend, for the dedicated friends page. */
export function FriendsGrid({ friends }: { friends: ProfileFriend[] }) {
  return (
    <ul className="panel-raised grid gap-0.5 rounded-xl border border-border bg-panel p-1.5 sm:grid-cols-2 lg:grid-cols-3">
      {friends.map((f) => (
        <li key={f.steamId}>
          <FriendRow friend={f} />
        </li>
      ))}
    </ul>
  );
}
