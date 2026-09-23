import Link from "next/link";
import { notFound } from "next/navigation";
import { ListEditor } from "@/components/list-editor";
import { GameCard } from "@/components/game-card";
import { getListBySlug, getListEntries } from "@/lib/list-queries";
import { getProfileUser } from "@/lib/queries";
import { getSession } from "@/lib/session";

export default async function ListPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;

  const owner = await getProfileUser(id);
  if (!owner) notFound();

  const list = await getListBySlug(owner.steamId, slug);
  if (!list) notFound();

  const session = await getSession();
  const isOwner = session?.steamId === owner.steamId;

  // A private list is the owner's business only.
  if (!list.isPublic && !isOwner) notFound();

  const entries = await getListEntries(list.id, owner.steamId);

  const done = entries.filter(
    (e) => e.achievementCount > 0 && e.unlockedCount >= e.achievementCount,
  ).length;

  return (
    <div
      className="mx-auto max-w-5xl px-4 py-10 sm:px-6"
      style={{ ["--accent" as string]: owner.accentColor }}
    >
      <Link
        href={`/u/${owner.handle ?? owner.steamId}`}
        className="text-sm text-faint underline-offset-2 hover:underline"
      >
        ← {owner.personaName}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{list.name}</h1>
          {list.description && (
            <p className="mt-1 max-w-xl text-sm text-muted">
              {list.description}
            </p>
          )}
          <p className="tnum mt-1 text-xs text-faint">
            {entries.length} {entries.length === 1 ? "game" : "games"}
            {done > 0 && ` · ${done} at 100%`}
            {!list.isPublic && " · private"}
            {list.ranked && " · ranked"}
          </p>
        </div>
      </div>

      {isOwner ? (
        <ListEditor
          listId={list.id}
          ranked={list.ranked}
          isPublic={list.isPublic}
          name={list.name}
          description={list.description}
          canDelete={list.kind === "custom"}
          ownerPath={`/u/${owner.handle ?? owner.steamId}`}
          entries={entries.map((e) => ({
            appid: e.appid,
            name: e.name,
            headerUrl: e.headerUrl,
            note: e.note,
            unlockedCount: e.unlockedCount ?? 0,
            achievementCount: e.achievementCount,
            playtimeForever: e.playtimeForever ?? 0,
          }))}
        />
      ) : entries.length > 0 ? (
        <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map((e, i) => (
            <li key={e.appid}>
              {list.ranked && (
                <span className="tnum mb-1 block text-xs font-semibold text-faint">
                  #{i + 1}
                </span>
              )}
              <Link href={`/game/${e.appid}`}>
                <GameCard
                  linked={false}
                  game={{
                    appid: e.appid,
                    name: e.name,
                    headerUrl: e.headerUrl,
                    unlockedCount: e.unlockedCount ?? 0,
                    achievementCount: e.achievementCount,
                    playtimeForever: e.playtimeForever ?? 0,
                    lastPlayedAt: null,
                  }}
                />
              </Link>
              {e.note && (
                <p className="mt-1 text-xs text-muted">{e.note}</p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 rounded-xl border border-border bg-panel px-4 py-8 text-center text-sm text-muted">
          This list is empty.
        </p>
      )}
    </div>
  );
}
