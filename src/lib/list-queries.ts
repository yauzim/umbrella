import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { games, listItems, lists, userGames, users } from "@/db/schema";

/**
 * Two lists are special. Backlog and Hunting are created on demand so a
 * new profile is not cluttered with empty lists, but once they exist they
 * behave like any other list.
 */
export const SYSTEM_LISTS = {
  backlog: {
    name: "Backlog",
    slug: "backlog",
    description: "Games waiting their turn.",
  },
  hunting: {
    name: "Currently hunting",
    slug: "hunting",
    description: "Achievements actively being chased.",
  },
} as const;

export type SystemListKind = keyof typeof SYSTEM_LISTS;

export interface ListDetail {
  id: number;
  steamId: string;
  name: string;
  slug: string;
  description: string | null;
  kind: string;
  isPublic: boolean;
  ranked: boolean;
  ownerHandle: string | null;
  ownerName: string;
}

export async function getListBySlug(
  steamId: string,
  slug: string,
): Promise<ListDetail | null> {
  const [row] = await db
    .select({
      id: lists.id,
      steamId: lists.steamId,
      name: lists.name,
      slug: lists.slug,
      description: lists.description,
      kind: lists.kind,
      isPublic: lists.isPublic,
      ranked: lists.ranked,
      ownerHandle: users.handle,
      ownerName: users.personaName,
    })
    .from(lists)
    .innerJoin(users, eq(users.steamId, lists.steamId))
    .where(and(eq(lists.steamId, steamId), eq(lists.slug, slug)))
    .limit(1);
  return row ?? null;
}

export interface ListEntry {
  itemId: number;
  appid: number;
  name: string;
  headerUrl: string | null;
  note: string | null;
  position: number;
  /** The owner's progress, so a backlog shows what is already done. */
  unlockedCount: number;
  achievementCount: number;
  playtimeForever: number;
}

export async function getListEntries(
  listId: number,
  ownerSteamId: string,
): Promise<ListEntry[]> {
  return db
    .select({
      itemId: listItems.id,
      appid: listItems.appid,
      name: games.name,
      headerUrl: games.headerUrl,
      note: listItems.note,
      position: listItems.position,
      unlockedCount: userGames.unlockedCount,
      achievementCount: games.achievementCount,
      playtimeForever: userGames.playtimeForever,
    })
    .from(listItems)
    .innerJoin(games, eq(games.appid, listItems.appid))
    .leftJoin(
      userGames,
      and(
        eq(userGames.appid, listItems.appid),
        eq(userGames.steamId, ownerSteamId),
      ),
    )
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.position), asc(games.name)) as Promise<ListEntry[]>;
}

/** Which of the viewer's lists already contain this game. */
export async function getListMembership(
  steamId: string,
  appid: number,
): Promise<{ id: number; name: string; slug: string; kind: string; has: boolean }[]> {
  const owned = await db
    .select({
      id: lists.id,
      name: lists.name,
      slug: lists.slug,
      kind: lists.kind,
      itemAppid: listItems.appid,
    })
    .from(lists)
    .leftJoin(
      listItems,
      and(eq(listItems.listId, lists.id), eq(listItems.appid, appid)),
    )
    .where(eq(lists.steamId, steamId))
    .orderBy(asc(lists.createdAt));

  return owned.map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    kind: l.kind,
    has: l.itemAppid !== null,
  }));
}
