import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomizePanel } from "@/components/customize-panel";
import {
  getFavoriteGames,
  getPickerAchievements,
  getPickerGames,
  getProfileUser,
} from "@/lib/queries";
import { getSession } from "@/lib/session";

export const metadata = { title: "Customize your profile — Umbrella" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const user = await getProfileUser(session.steamId);
  if (!user) redirect("/");

  const [games, achievements, favorites] = await Promise.all([
    getPickerGames(session.steamId, { limit: 120 }),
    getPickerAchievements(session.steamId, 60),
    getFavoriteGames(session.steamId),
  ]);

  return (
    <div
      className="mx-auto max-w-5xl px-4 py-10 sm:px-6"
      style={{ ["--accent" as string]: user.accentColor }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Customize your profile
          </h1>
          <p className="mt-1 text-sm text-muted">
            Everything here comes from games you own and achievements you
            unlocked. No uploads — that is the point.
          </p>
        </div>
        <Link
          href={`/u/${user.handle ?? user.steamId}`}
          className="rounded-lg border border-border-strong bg-raised px-3 py-1.5 text-sm font-medium transition-colors hover:border-accent"
        >
          Back to profile
        </Link>
      </div>

      <CustomizePanel
        user={{
          bio: user.bio,
          accentColor: user.accentColor,
          bannerAppid: user.bannerAppid,
          avatarAppid: user.avatarAppid,
          avatarAchievementId: user.avatarAchievementId,
          steamAvatarUrl: user.avatarUrl,
          personaName: user.personaName,
        }}
        games={games}
        achievements={achievements}
        favoriteAppids={favorites.map((f) => f.appid)}
      />
    </div>
  );
}
