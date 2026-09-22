/**
 * Shared profile constants.
 *
 * Kept out of `actions.ts` because that file is a `"use server"` module,
 * whose exports are meant to be async functions only — a plain constant
 * there works today but is not what the directive is for.
 */

/**
 * A fixed palette rather than a free colour picker. The goal is a profile
 * that looks composed after a minute of choices, not a design tool that
 * eats an evening and still ends up muddy.
 */
export const ACCENT_PRESETS = [
  "#5b8def",
  "#3fb950",
  "#c084fc",
  "#f5a524",
  "#f87171",
  "#22d3ee",
  "#e6edf3",
] as const;
