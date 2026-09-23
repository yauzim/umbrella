/**
 * Avatar frames.
 *
 * The Points Shop sells decoration. Here it is earned: your frame is
 * determined by the rarest achievement you hold, so the ring around
 * someone's face is itself a claim you can verify by clicking through.
 * Nothing here is purchasable and nothing is uploadable.
 */

export type FrameTier =
  | "none"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export interface Frame {
  tier: FrameTier;
  label: string;
  /** Requirement, shown on hover so the frame explains itself. */
  requirement: string;
  colors: [string, string, string];
  glow: string;
  /** Top tiers rotate; lower ones would just be noise in a list. */
  animated: boolean;
}

const FRAMES: Record<FrameTier, Frame> = {
  none: {
    tier: "none",
    label: "Unframed",
    requirement: "Sync a library to earn a frame",
    colors: ["#2f3742", "#2f3742", "#2f3742"],
    glow: "transparent",
    animated: false,
  },
  uncommon: {
    tier: "uncommon",
    label: "Verdant",
    requirement: "Hold an achievement under 50%",
    colors: ["#3fb950", "#2ea043", "#3fb950"],
    glow: "rgba(63,185,80,0.35)",
    animated: false,
  },
  rare: {
    tier: "rare",
    label: "Azure",
    requirement: "Hold an achievement under 20%",
    colors: ["#5b8def", "#3b6fd4", "#5b8def"],
    glow: "rgba(91,141,239,0.4)",
    animated: false,
  },
  epic: {
    tier: "epic",
    label: "Amethyst",
    requirement: "Hold an achievement under 5%",
    colors: ["#c084fc", "#8b5cf6", "#e9d5ff"],
    glow: "rgba(192,132,252,0.45)",
    animated: true,
  },
  legendary: {
    tier: "legendary",
    label: "Gilded",
    requirement: "Hold an achievement under 1%",
    colors: ["#f5a524", "#fde68a", "#b45309"],
    glow: "rgba(245,165,36,0.5)",
    animated: true,
  },
  mythic: {
    tier: "mythic",
    label: "Mythic",
    requirement: "Hold an achievement under 0.5%",
    colors: ["#f87171", "#fbbf24", "#a78bfa"],
    glow: "rgba(248,113,113,0.5)",
    animated: true,
  },
};

/** Frame earned by the rarest achievement a person holds. */
export function frameFor(rarestPercent: number | null | undefined): Frame {
  if (rarestPercent === null || rarestPercent === undefined) {
    return FRAMES.none;
  }
  if (rarestPercent < 0.5) return FRAMES.mythic;
  if (rarestPercent < 1) return FRAMES.legendary;
  if (rarestPercent < 5) return FRAMES.epic;
  if (rarestPercent < 20) return FRAMES.rare;
  if (rarestPercent < 50) return FRAMES.uncommon;
  return FRAMES.none;
}

export const ALL_FRAMES = Object.values(FRAMES);
