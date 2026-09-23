"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import {
  gameReviews,
  games,
  listItems,
  lists,
  MAX_RATING,
} from "@/db/schema";
import { getSession } from "@/lib/session";
import { SYSTEM_LISTS, type SystemListKind } from "@/lib/list-queries";

/**
 * Every action re-derives the caller. Server Functions are reachable by
 * direct POST, so a steamId is never accepted from the client.
 */
async function requireSteamId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in");
  return session.steamId;
}

async function assertGameExists(appid: number) {
  const [row] = await db
    .select({ appid: games.appid })
    .from(games)
    .where(eq(games.appid, appid))
    .limit(1);
  if (!row) throw new Error("Unknown game.");
}

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

export async function saveReview(input: {
  appid: number;
  rating: number | null;
  body: string;
  containsSpoilers: boolean;
}) {
  const steamId = await requireSteamId();
  await assertGameExists(input.appid);

  const rating =
    input.rating === null
      ? null
      : Math.min(MAX_RATING, Math.max(1, Math.round(input.rating)));

  const body = input.body.trim().slice(0, 5000) || null;

  // A review with neither a score nor words is just noise on the page.
  if (rating === null && !body) {
    throw new Error("Add a rating or write something.");
  }

  const now = new Date();
  await db
    .insert(gameReviews)
    .values({
      steamId,
      appid: input.appid,
      rating,
      body,
      containsSpoilers: input.containsSpoilers,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [gameReviews.steamId, gameReviews.appid],
      set: {
        rating,
        body,
        containsSpoilers: input.containsSpoilers,
        updatedAt: now,
      },
    });

  revalidatePath(`/game/${input.appid}`);
}

export async function deleteReview(appid: number) {
  const steamId = await requireSteamId();
  await db
    .delete(gameReviews)
    .where(and(eq(gameReviews.steamId, steamId), eq(gameReviews.appid, appid)));
  revalidatePath(`/game/${appid}`);
}

/* ------------------------------------------------------------------ */
/* Lists                                                               */
/* ------------------------------------------------------------------ */

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "list"
  );
}

/** Slugs are unique per owner, so a duplicate name gets a numeric suffix. */
async function uniqueSlug(steamId: string, base: string): Promise<string> {
  const existing = new Set(
    (
      await db
        .select({ slug: lists.slug })
        .from(lists)
        .where(eq(lists.steamId, steamId))
    ).map((r) => r.slug),
  );
  if (!existing.has(base)) return base;
  for (let i = 2; i < 200; i++) {
    if (!existing.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createList(input: {
  name: string;
  description?: string;
  ranked?: boolean;
}): Promise<{ id: number; slug: string }> {
  const steamId = await requireSteamId();

  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("Give the list a name.");

  const slug = await uniqueSlug(steamId, slugify(name));

  const [row] = await db
    .insert(lists)
    .values({
      steamId,
      name,
      slug,
      description: input.description?.trim().slice(0, 500) || null,
      kind: "custom",
      ranked: input.ranked ?? false,
    })
    .returning({ id: lists.id, slug: lists.slug });

  revalidatePath(`/u/${steamId}`);
  return row;
}

/** Fetches Backlog / Hunting, creating it the first time it is needed. */
async function ensureSystemList(
  steamId: string,
  kind: SystemListKind,
): Promise<number> {
  const spec = SYSTEM_LISTS[kind];

  const [existing] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.steamId, steamId), eq(lists.slug, spec.slug)))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(lists)
    .values({
      steamId,
      name: spec.name,
      slug: spec.slug,
      description: spec.description,
      kind,
    })
    .returning({ id: lists.id });
  return created.id;
}

async function assertOwnsList(steamId: string, listId: number) {
  const [row] = await db
    .select({ steamId: lists.steamId })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1);
  if (!row || row.steamId !== steamId) {
    throw new Error("That is not your list.");
  }
}

export async function addToList(listId: number, appid: number) {
  const steamId = await requireSteamId();
  await assertOwnsList(steamId, listId);
  await assertGameExists(appid);

  // Append rather than insert at the top: a ranked list's order is the
  // owner's statement, and new entries should not disturb it.
  const [tail] = await db
    .select({ maxPos: max(listItems.position) })
    .from(listItems)
    .where(eq(listItems.listId, listId));

  await db
    .insert(listItems)
    .values({ listId, appid, position: (tail?.maxPos ?? -1) + 1 })
    .onConflictDoNothing();

  revalidatePath(`/game/${appid}`);
  revalidatePath(`/u/${steamId}`);
}

export async function removeFromList(listId: number, appid: number) {
  const steamId = await requireSteamId();
  await assertOwnsList(steamId, listId);

  await db
    .delete(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.appid, appid)));

  revalidatePath(`/game/${appid}`);
  revalidatePath(`/u/${steamId}`);
}

/** One-click Backlog / Hunting from a game page. */
export async function toggleSystemList(kind: SystemListKind, appid: number) {
  const steamId = await requireSteamId();
  const listId = await ensureSystemList(steamId, kind);

  const [existing] = await db
    .select({ id: listItems.id })
    .from(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.appid, appid)))
    .limit(1);

  if (existing) {
    await removeFromList(listId, appid);
    return { added: false };
  }
  await addToList(listId, appid);
  return { added: true };
}

export async function updateList(input: {
  listId: number;
  name?: string;
  description?: string;
  ranked?: boolean;
  isPublic?: boolean;
}) {
  const steamId = await requireSteamId();
  await assertOwnsList(steamId, input.listId);

  await db
    .update(lists)
    .set({
      ...(input.name ? { name: input.name.trim().slice(0, 80) } : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim().slice(0, 500) || null }
        : {}),
      ...(input.ranked !== undefined ? { ranked: input.ranked } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
    })
    .where(eq(lists.id, input.listId));

  revalidatePath(`/u/${steamId}`);
}

export async function deleteList(listId: number) {
  const steamId = await requireSteamId();
  await assertOwnsList(steamId, listId);
  await db.delete(lists).where(eq(lists.id, listId));
  revalidatePath(`/u/${steamId}`);
}

/** Persists a reordered list in one write. */
export async function reorderList(listId: number, appidsInOrder: number[]) {
  const steamId = await requireSteamId();
  await assertOwnsList(steamId, listId);

  db.transaction((tx) => {
    appidsInOrder.forEach((appid, position) => {
      tx.update(listItems)
        .set({ position })
        .where(and(eq(listItems.listId, listId), eq(listItems.appid, appid)))
        .run();
    });
  });

  revalidatePath(`/u/${steamId}`);
}

export async function setItemNote(
  listId: number,
  appid: number,
  note: string,
) {
  const steamId = await requireSteamId();
  await assertOwnsList(steamId, listId);

  await db
    .update(listItems)
    .set({ note: note.trim().slice(0, 300) || null })
    .where(and(eq(listItems.listId, listId), eq(listItems.appid, appid)));

  revalidatePath(`/u/${steamId}`);
}
