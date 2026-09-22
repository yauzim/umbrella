import { GameArt } from "@/components/game-art";
import { formatPlaytime } from "@/lib/rarity";
import type { GameProgress } from "@/lib/queries";

export function GameCard({ game }: { game: GameProgress }) {
  const pct =
    game.achievementCount > 0
      ? Math.min(100, (game.unlockedCount / game.achievementCount) * 100)
      : 0;
  const complete = pct >= 100;

  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-panel transition-colors hover:border-border-strong">
      <div className="relative aspect-[460/215] bg-raised">
        <GameArt
          appid={game.appid}
          name={game.name}
          sizes="(max-width: 768px) 50vw, 260px"
        />
        {complete && (
          <span className="absolute right-2 top-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent backdrop-blur">
            100%
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="truncate text-sm font-medium" title={game.name}>
          {game.name}
        </h3>

        <div className="mt-2 h-1 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full transition-[width]"
            style={{
              width: `${pct}%`,
              backgroundColor: complete ? "var(--accent)" : "var(--border-strong)",
            }}
          />
        </div>

        <div className="tnum mt-1.5 flex justify-between text-xs text-faint">
          <span>
            {game.unlockedCount}/{game.achievementCount}
          </span>
          <span>{formatPlaytime(game.playtimeForever)}</span>
        </div>
      </div>
    </article>
  );
}
