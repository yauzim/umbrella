"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  favoriteGames,
  FAVORITE_SLOTS,
  userAchievements,
  userGames,
  users,
} from "@/db/schema";
import { ACCENT_PRESETS } from "@/lib/profile-presets";
import { getSession } from "@/lib/session";
import { normalizeHandle } from "@/lib/steam/sync";

/**
 * Server Functions are reachable by direct POST, not only through our UI,
 * so every one of these re-establishes who is calling and only ever
 * writes to that person's own row. A steamId is never taken from input.
 */
async function requireSteamId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in");
  return session.steamId;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Reserved so a handle can never shadow a route or a SteamID. */
const RESERVED_HANDLES = new Set([
  "settings",
  "api",
  "u",
  "login",
  "logout",
  "admin",
  "about",
  "new",
  "me",
]);

export async function updateHandle(raw: string): Promise<
  { ok: true; handle: string } | { ok: false; error: string }
> {
  const steamId = await requireSteamId();

  const handle = normalizeHandle(raw);
  if (!handle) {
    return {
      ok: false,
      error:
        "3–32 characters, letters, numbers, dashes and underscores. Cannot be all digits.",
    };
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { ok: false, error: "That name is reserved." };
  }

  const [taken] = await db
    .select({ steamId: users.steamId })
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1);
  if (taken && taken.steamId !== steamId) {
    return { ok: false, error: "That name is already taken." };
  }

  await db.update(users).set({ handle }).where(eq(users.steamId, steamId));
  revalidatePath(`/u/${handle}`);
  return { ok: true, handle };
}

export async function updateProfile(formData: FormData) {
  const steamId = await requireSteamId();

  const bioRaw = (formData.get("bio") as string | null)?.trim() ?? "";
  const accentRaw = (formData.get("accentColor") as string | null) ?? "";

  // Reject anything not in the palette rather than trusting the form.
  const accentColor =
    HEX.test(accentRaw) &&
    (ACCENT_PRESETS as readonly string[]).includes(accentRaw)
      ? accentRaw
      : undefined;

  await db
    .update(users)
    .set({
      bio: bioRaw.slice(0, 280) || null,
      ...(accentColor ? { accentColor } : {}),
    })
    .where(eq(users.steamId, steamId));

  revalidatePath(`/u/${steamId}`);
}

/** Banner art comes from a game in your own library. */
export async function setBanner(appid: number | null) {
  const steamId = await requireSteamId();

  if (appid !== null) {
    const [owned] = await db
      .select({ appid: userGames.appid })
      .from(userGames)
      .where(and(eq(userGames.steamId, steamId), eq(userGames.appid, appid)))
      .limit(1);
    if (!owned) throw new Error("You can only use a game from your library.");
  }

  await db
    .update(users)
    .set({ bannerAppid: appid })
    .where(eq(users.steamId, steamId));
  revalidatePath(`/u/${steamId}`);
}

/**
 * Avatar is a game you own or an achievement you unlocked — never an
 * upload. Passing both nulls restores the Steam avatar.
 */
export async function setAvatar(
  source: { kind: "game"; appid: number } | { kind: "achievement"; id: number } | { kind: "steam" },
) {
  const steamId = await requireSteamId();

  if (source.kind === "game") {
    const [owned] = await db
      .select({ appid: userGames.appid })
      .from(userGames)
      .where(
        and(eq(userGames.steamId, steamId), eq(userGames.appid, source.appid)),
      )
      .limit(1);
    if (!owned) throw new Error("You can only use a game from your library.");

    await db
      .update(users)
      .set({ avatarAppid: source.appid, avatarAchievementId: null })
      .where(eq(users.steamId, steamId));
  } else if (source.kind === "achievement") {
    const [earned] = await db
      .select({ id: achievements.id })
      .from(userAchievements)
      .innerJoin(
        achievements,
        eq(achievements.id, userAchievements.achievementId),
      )
      .where(
        and(
          eq(userAchievements.steamId, steamId),
          eq(userAchievements.achievementId, source.id),
        ),
      )
      .limit(1);
    // Wearing an achievement you have not earned would make the whole
    // signal worthless, so this is enforced, not merely hidden in the UI.
    if (!earned) throw new Error("You have not unlocked that achievement.");

    await db
      .update(users)
      .set({ avatarAchievementId: source.id, avatarAppid: null })
      .where(eq(users.steamId, steamId));
  } else {
    await db
      .update(users)
      .set({ avatarAppid: null, avatarAchievementId: null })
      .where(eq(users.steamId, steamId));
  }

  revalidatePath(`/u/${steamId}`);
}

/** Replaces the pinned games wholesale, in the given order. */
export async function setFavorites(appids: number[]) {
  const steamId = await requireSteamId();

  const wanted = [...new Set(appids)].slice(0, FAVORITE_SLOTS);

  const owned = wanted.length
    ? new Set(
        (
          await db
            .select({ appid: userGames.appid })
            .from(userGames)
            .where(
              and(
                eq(userGames.steamId, steamId),
                inArray(userGames.appid, wanted),
              ),
            )
        ).map((r) => r.appid),
      )
    : new Set<number>();

  const valid = wanted.filter((a) => owned.has(a));

  db.transaction((tx) => {
    tx.delete(favoriteGames)
      .where(eq(favoriteGames.steamId, steamId))
      .run();
    valid.forEach((appid, position) => {
      tx.insert(favoriteGames)
        .values({ steamId, appid, position })
        .run();
    });
  });

  revalidatePath(`/u/${steamId}`);
}
