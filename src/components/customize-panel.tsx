"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setAvatar,
  setBanner,
  setFavorites,
  updateHandle,
  updateProfile,
} from "@/lib/actions";
import { ACCENT_PRESETS } from "@/lib/profile-presets";
import type { PickerAchievement, PickerGame } from "@/lib/queries";
import { formatPercent, rarityOf } from "@/lib/rarity";
import { FAVORITE_SLOTS } from "@/db/schema";

interface Props {
  user: {
    bio: string | null;
    accentColor: string;
    bannerAppid: number | null;
    avatarAppid: number | null;
    avatarAchievementId: number | null;
    steamAvatarUrl: string | null;
    handle: string | null;
    personaName: string;
  };
  games: PickerGame[];
  achievements: PickerAchievement[];
  favoriteAppids: number[];
}

export function CustomizePanel({
  user,
  games,
  achievements,
  favoriteAppids,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [accent, setAccent] = useState(user.accentColor);
  const [bio, setBio] = useState(user.bio ?? "");
  const [handle, setHandle] = useState(user.handle ?? "");
  const [handleMsg, setHandleMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [banner, setBannerState] = useState(user.bannerAppid);
  const [avatarGame, setAvatarGame] = useState(user.avatarAppid);
  const [avatarAch, setAvatarAch] = useState(user.avatarAchievementId);
  const [favorites, setFavoritesState] = useState<number[]>(favoriteAppids);
  const [avatarTab, setAvatarTab] = useState<"achievement" | "game" | "steam">(
    user.avatarAchievementId ? "achievement" : user.avatarAppid ? "game" : "steam",
  );

  const perfect = games.filter(
    (g) => g.achievementCount > 0 && g.unlockedCount >= g.achievementCount,
  );

  function toggleFavorite(appid: number) {
    setFavoritesState((current) => {
      const next = current.includes(appid)
        ? current.filter((a) => a !== appid)
        : // Oldest pick drops out once the slots are full, so clicking
          // always does something rather than silently failing.
          [...current, appid].slice(-FAVORITE_SLOTS);
      startTransition(async () => {
        await setFavorites(next);
        router.refresh();
      });
      return next;
    });
  }

  function chooseBanner(appid: number) {
    const next = banner === appid ? null : appid;
    setBannerState(next);
    startTransition(async () => {
      await setBanner(next);
      router.refresh();
    });
  }

  function chooseAvatarGame(appid: number) {
    setAvatarGame(appid);
    setAvatarAch(null);
    startTransition(async () => {
      await setAvatar({ kind: "game", appid });
      router.refresh();
    });
  }

  function chooseAvatarAchievement(id: number) {
    setAvatarAch(id);
    setAvatarGame(null);
    startTransition(async () => {
      await setAvatar({ kind: "achievement", id });
      router.refresh();
    });
  }

  function chooseSteamAvatar() {
    setAvatarAch(null);
    setAvatarGame(null);
    startTransition(async () => {
      await setAvatar({ kind: "steam" });
      router.refresh();
    });
  }

  return (
    <div
      className="mt-8 space-y-10"
      style={{ ["--accent" as string]: accent }}
    >
      {/* Handle ------------------------------------------------------- */}
      <Block
        title="Profile URL"
        hint="Nobody wants to share a 17-digit account number."
      >
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-lg border border-border bg-panel px-3 py-2 focus-within:border-accent">
            <span className="shrink-0 text-sm text-faint">/u/</span>
            <input
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                setHandleMsg(null);
              }}
              placeholder="your-name"
              maxLength={32}
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-faint"
            />
          </div>
          <button
            onClick={() =>
              startTransition(async () => {
                const res = await updateHandle(handle);
                setHandleMsg(
                  res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error },
                );
                if (res.ok) router.refresh();
              })
            }
            disabled={pending || !handle.trim()}
            className="rounded-lg border border-border-strong bg-raised px-4 py-2 text-sm font-medium transition-colors hover:border-accent disabled:opacity-60"
          >
            Save
          </button>
        </div>
        {handleMsg && (
          <p
            className={`mt-2 text-xs ${handleMsg.ok ? "text-muted" : "text-orange-400"}`}
          >
            {handleMsg.text}
          </p>
        )}
      </Block>

      {/* Identity ----------------------------------------------------- */}
      <Block
        title="About you"
        hint="One line is plenty. 280 characters max."
      >
        <form
          action={(fd) =>
            startTransition(async () => {
              await updateProfile(fd);
              router.refresh();
            })
          }
          className="space-y-4"
        >
          <textarea
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="Chasing every Soulsborne platinum. Terrible at racing games."
            className="w-full resize-none rounded-lg border border-border bg-panel px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
          />

          <div>
            <p className="mb-2 text-xs font-medium text-muted">Accent colour</p>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((c) => (
                <label key={c} className="cursor-pointer">
                  <input
                    type="radio"
                    name="accentColor"
                    value={c}
                    checked={accent === c}
                    onChange={() => setAccent(c)}
                    className="sr-only"
                  />
                  <span
                    className="block size-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: accent === c ? "#e6edf3" : "transparent",
                    }}
                    title={c}
                  />
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-border-strong bg-raised px-4 py-2 text-sm font-medium transition-colors hover:border-accent disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      </Block>

      {/* Avatar ------------------------------------------------------- */}
      <Block
        title="Avatar"
        hint="Wear an achievement you actually earned, or a game you own."
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["achievement", "Achievements"],
              ["game", "Games"],
              ["steam", "Steam default"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setAvatarTab(key);
                if (key === "steam") chooseSteamAvatar();
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                avatarTab === key
                  ? "border-accent bg-raised"
                  : "border-border bg-panel hover:border-border-strong"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {avatarTab === "achievement" && (
          <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-8 md:grid-cols-10">
            {achievements.map((a) => {
              const r = rarityOf(a.globalPercent);
              return (
                <button
                  key={a.id}
                  onClick={() => chooseAvatarAchievement(a.id)}
                  title={`${a.displayName} — ${a.gameName} · ${formatPercent(a.globalPercent)}`}
                  className="group relative aspect-square overflow-hidden rounded-lg border-2 transition-transform hover:scale-105"
                  style={{
                    borderColor: avatarAch === a.id ? r.color : "transparent",
                  }}
                >
                  {a.icon && (
                    <Image
                      src={a.icon}
                      alt={a.displayName}
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </button>
              );
            })}
            {achievements.length === 0 && <EmptyNote />}
          </div>
        )}

        {avatarTab === "game" && (
          <ArtGrid
            games={games}
            selected={avatarGame}
            onPick={chooseAvatarGame}
            useIcon
          />
        )}

        {avatarTab === "steam" && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-panel p-4">
            {user.steamAvatarUrl && (
              <Image
                src={user.steamAvatarUrl}
                alt=""
                width={56}
                height={56}
                className="size-14 rounded-lg"
                unoptimized
              />
            )}
            <p className="text-sm text-muted">
              Using your Steam avatar for {user.personaName}.
            </p>
          </div>
        )}
      </Block>

      {/* Banner ------------------------------------------------------- */}
      <Block
        title="Banner"
        hint="Cover art from a game in your library. Click again to clear."
      >
        <ArtGrid games={games} selected={banner} onPick={chooseBanner} />
      </Block>

      {/* Pinned ------------------------------------------------------- */}
      <Block
        title={`Pinned games · ${favorites.length}/${FAVORITE_SLOTS}`}
        hint="The four under your name. Completions are marked; pick any game you are proud of."
      >
        <ArtGrid
          games={[
            ...perfect,
            ...games.filter((g) => !perfect.some((p) => p.appid === g.appid)),
          ]}
          selectedMany={favorites}
          onPick={toggleFavorite}
          showComplete
        />
      </Block>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Block({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-xs text-faint">{hint}</p>}
      {children}
    </section>
  );
}

function EmptyNote() {
  return (
    <p className="col-span-full rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-faint">
      Nothing here yet — sync your library first.
    </p>
  );
}

function ArtGrid({
  games,
  selected,
  selectedMany,
  onPick,
  useIcon = false,
  showComplete = false,
}: {
  games: PickerGame[];
  selected?: number | null;
  selectedMany?: number[];
  onPick: (appid: number) => void;
  useIcon?: boolean;
  showComplete?: boolean;
}) {
  if (games.length === 0) return <EmptyNote />;

  const isOn = (appid: number) =>
    selectedMany ? selectedMany.includes(appid) : selected === appid;

  return (
    <div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-5">
      {games.map((g) => {
        const on = isOn(g.appid);
        const complete =
          g.achievementCount > 0 && g.unlockedCount >= g.achievementCount;
        const src = useIcon ? (g.iconUrl ?? g.headerUrl) : g.headerUrl;
        const order = selectedMany ? selectedMany.indexOf(g.appid) : -1;

        return (
          <button
            key={g.appid}
            onClick={() => onPick(g.appid)}
            title={g.name}
            className="group relative overflow-hidden rounded-lg border-2 text-left transition-transform hover:scale-[1.02]"
            style={{ borderColor: on ? "var(--accent)" : "transparent" }}
          >
            <div className="relative aspect-[460/215] bg-raised">
              {src && (
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="220px"
                  className="object-cover"
                  unoptimized
                />
              )}
              {showComplete && complete && (
                <span className="absolute right-1 top-1 rounded bg-black/75 px-1 py-0.5 text-[9px] font-bold text-accent backdrop-blur">
                  100%
                </span>
              )}
              {order >= 0 && (
                <span
                  className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-bg"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {order + 1}
                </span>
              )}
            </div>
            <p className="truncate bg-panel px-2 py-1.5 text-[11px]">{g.name}</p>
          </button>
        );
      })}
    </div>
  );
}
