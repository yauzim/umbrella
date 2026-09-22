import Image from "next/image";
import { formatPercent, formatUnlockDate, rarityOf } from "@/lib/rarity";
import type { UnlockRow } from "@/lib/queries";

/**
 * The hero unit: one achievement, framed so the rarity reads first.
 * Used in the "rarest unlocks" showcase where the point is to brag.
 */
export function AchievementTile({ unlock }: { unlock: UnlockRow }) {
  const rarity = rarityOf(unlock.globalPercent);

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-xl border bg-panel transition-colors"
      style={{ borderColor: rarity.glow.replace(/[\d.]+\)$/, "0.35)") }}
    >
      {unlock.gameHeaderUrl && (
        <div className="absolute inset-0 opacity-[0.12] transition-opacity group-hover:opacity-20">
          <Image
            src={unlock.gameHeaderUrl}
            alt=""
            fill
            sizes="360px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <div className="relative flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          {unlock.icon && (
            <Image
              src={unlock.icon}
              alt=""
              width={56}
              height={56}
              className="size-14 shrink-0 rounded-lg border border-border-strong"
              unoptimized
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold leading-tight">
              {unlock.displayName}
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted">
              {unlock.gameName}
            </p>
          </div>
        </div>

        {unlock.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted">
            {unlock.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span
            className="tnum rounded-md px-2 py-1 text-xs font-semibold"
            style={{ color: rarity.color, backgroundColor: rarity.glow }}
          >
            {formatPercent(unlock.globalPercent)} · {rarity.label}
          </span>
          <time className="text-xs text-faint">
            {formatUnlockDate(unlock.unlockedAt)}
          </time>
        </div>
      </div>
    </article>
  );
}

/** Compact variant for the chronological feed. */
export function AchievementRow({ unlock }: { unlock: UnlockRow }) {
  const rarity = rarityOf(unlock.globalPercent);

  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-raised">
      <span
        className="h-9 w-0.5 shrink-0 rounded-full"
        style={{ backgroundColor: rarity.color }}
        aria-hidden
      />
      {unlock.icon && (
        <Image
          src={unlock.icon}
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 rounded border border-border"
          unoptimized
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{unlock.displayName}</p>
        <p className="truncate text-xs text-faint">{unlock.gameName}</p>
      </div>
      <span
        className="tnum shrink-0 text-xs font-semibold"
        style={{ color: rarity.color }}
      >
        {formatPercent(unlock.globalPercent)}
      </span>
    </li>
  );
}
