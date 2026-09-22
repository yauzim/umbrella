"use client";

/**
 * Scrolls the viewer to their own row.
 *
 * A leaderboard you have to scroll to find yourself in is the main thing
 * that makes them annoying, so this is a first-class control rather than
 * an anchor link — it centres the row and flashes it, so the eye lands in
 * the right place.
 */
export function JumpToMe({ rank }: { rank: number }) {
  return (
    <button
      onClick={() => {
        const el = document.getElementById("me");
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.animate(
          [
            { backgroundColor: "var(--accent)", opacity: 0.35 },
            { backgroundColor: "transparent", opacity: 1 },
          ],
          { duration: 900, easing: "ease-out" },
        );
      }}
      className="tnum mt-3 rounded-lg border border-border-strong bg-raised px-3 py-1.5 text-sm font-medium transition-colors hover:border-accent"
    >
      Jump to my position (#{rank})
    </button>
  );
}
