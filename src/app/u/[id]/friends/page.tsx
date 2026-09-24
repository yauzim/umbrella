import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FriendsGrid } from "@/components/friends-section";
import { getProfileFriends, getProfileUser } from "@/lib/queries";

export default async function FriendsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getProfileUser(id);
  if (!user) notFound();

  // Same readable-URL handover as the profile itself.
  if (user.handle && id !== user.handle) {
    redirect(`/u/${user.handle}/friends`);
  }

  const friends = await getProfileFriends(user.steamId);
  const members = friends.filter((f) => f.isMember);
  const others = friends.filter((f) => !f.isMember);
  const profilePath = `/u/${user.handle ?? user.steamId}`;

  return (
    <div
      className="mx-auto max-w-5xl px-4 py-10 sm:px-6"
      style={{ ["--accent" as string]: user.accentColor }}
    >
      <Link
        href={profilePath}
        className="text-sm text-faint underline-offset-2 hover:underline"
      >
        ← {user.personaName}
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">
        Friends{" "}
        <span className="tnum text-base font-normal text-faint">
          {friends.length}
        </span>
      </h1>

      {friends.length === 0 && (
        <p className="panel-raised mt-6 rounded-xl border border-border bg-panel px-4 py-8 text-center text-sm text-muted">
          No friends to show. Steam only shares a friend list when it is set
          to public.
        </p>
      )}

      {members.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">
            On Umbrella · {members.length}
          </h2>
          <FriendsGrid friends={members} />
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">
            Not here yet · {others.length}
          </h2>
          <FriendsGrid friends={others} />
        </section>
      )}
    </div>
  );
}
