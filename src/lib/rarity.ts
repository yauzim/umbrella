/**
 * Rarity tiers.
 *
 * Steam shows a bare percentage, which reads the same at 40% and 0.4%.
 * Naming the bands is what lets a profile communicate difficulty at a
 * glance — the whole reason to show achievements rather than list them.
 */

export type RarityTier =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export interface RarityStyle {
  tier: RarityTier;
  label: string;
  /** Border / text colour. Tuned to stay legible on the dark surface. */
  color: string;
  /** Translucent fill for the badge background. */
  glow: string;
}

const TIERS: { max: number; style: RarityStyle }[] = [
  {
    max: 1,
    style: {
      tier: "legendary",
      label: "Legendary",
      color: "#f5a524",
      glow: "rgba(245, 165, 36, 0.14)",
    },
  },
  {
    max: 5,
    style: {
      tier: "epic",
      label: "Epic",
      color: "#c084fc",
      glow: "rgba(192, 132, 252, 0.14)",
    },
  },
  {
    max: 20,
    style: {
      tier: "rare",
      label: "Rare",
      color: "#5b8def",
      glow: "rgba(91, 141, 239, 0.14)",
    },
  },
  {
    max: 50,
    style: {
      tier: "uncommon",
      label: "Uncommon",
      color: "#3fb950",
      glow: "rgba(63, 185, 80, 0.14)",
    },
  },
];

const COMMON: RarityStyle = {
  tier: "common",
  label: "Common",
  color: "#8b949e",
  glow: "rgba(139, 148, 158, 0.12)",
};

export function rarityOf(percent: number | null | undefined): RarityStyle {
  // Unknown rarity reads as common rather than inventing a tier.
  if (percent === null || percent === undefined) return COMMON;
  return TIERS.find((t) => percent < t.max)?.style ?? COMMON;
}

export function formatPercent(percent: number | null | undefined): string {
  if (percent === null || percent === undefined) return "—";
  // Sub-1% is where bragging happens, so keep two decimals there.
  if (percent < 1) return `${percent.toFixed(2)}%`;
  if (percent < 10) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}

export function formatPlaytime(minutes: number): string {
  if (minutes <= 0) return "Never played";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString()}h`;
}

export function formatUnlockDate(date: Date | null): string {
  // Steam has no timestamps for very old unlocks. Saying so is better
  // than rendering 1 Jan 1970.
  if (!date) return "Date unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
