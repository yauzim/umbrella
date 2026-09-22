"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SyncReport } from "@/lib/steam/sync";

interface Props {
  /** Auto-runs once for a profile that has never been synced. */
  autoStart: boolean;
}

/**
 * Guard against a server bug turning into an unbounded request loop.
 * At 25 games per batch this covers a ~5,000 game library.
 */
const MAX_BATCHES = 200;

interface Progress {
  scanned: number;
  remaining: number;
  unlocked: number;
  perfect: number;
}

export function SyncButton({ autoStart }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [progress, setProgress] = useState<Progress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  async function run(force = false) {
    if (state === "running") return;
    setState("running");
    setMessage(null);
    setProgress(null);

    const totals: Progress = { scanned: 0, remaining: 0, unlocked: 0, perfect: 0 };

    try {
      // The server scans one batch per request, so a large library needs
      // several. Each batch commits, so an interruption costs one batch
      // rather than the entire scan.
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const res = await fetch(`/api/sync${force ? "?force=1" : ""}`, {
          method: "POST",
        });

        const data = (await res.json()) as SyncReport & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Sync failed");

        if (data.private) {
          setState("error");
          setMessage(
            "Your Steam profile is private. Set Game details to Public in Steam privacy settings, then sync again.",
          );
          return;
        }

        totals.scanned += data.gamesScanned;
        totals.unlocked += data.achievementsUnlocked;
        totals.perfect += data.perfectGames;
        totals.remaining = data.remaining;
        setProgress({ ...totals });

        if (data.remaining === 0) break;
      }

      setState("done");
      setMessage(
        `${totals.unlocked.toLocaleString()} achievements across ${totals.scanned} games` +
          (totals.perfect ? ` · ${totals.perfect} at 100%` : ""),
      );
      router.refresh();
    } catch (err) {
      setState("error");
      // Partial progress is real and durable, so say so rather than making
      // a dropped connection look like total failure.
      const detail =
        totals.scanned > 0
          ? ` (${totals.scanned} games saved before this — press Sync again to resume)`
          : "";
      setMessage(
        (err instanceof Error ? err.message : "Sync failed") + detail,
      );
      router.refresh();
    }
  }

  useEffect(() => {
    // Ref guard, not just state: React mounts effects twice in dev Strict
    // Mode, and a duplicate run means hundreds of wasted API calls.
    if (autoStart && !started.current) {
      started.current = true;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const total = progress ? progress.scanned + progress.remaining : 0;
  const pct = total > 0 ? (progress!.scanned / total) * 100 : 0;

  return (
    <div className="flex w-56 flex-col items-end gap-1.5">
      <button
        onClick={() => run(state === "done")}
        disabled={state === "running"}
        className="rounded-lg border border-border-strong bg-raised px-3 py-1.5 text-sm font-medium transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "running"
          ? "Syncing…"
          : state === "done"
            ? "Re-sync"
            : state === "error"
              ? "Resume sync"
              : "Sync Steam"}
      </button>

      {state === "running" && progress && total > 0 && (
        <div className="w-full">
          <div className="h-1 overflow-hidden rounded-full bg-raised">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="tnum mt-1 text-right text-xs text-faint">
            {progress.scanned} of {total} games ·{" "}
            {progress.unlocked.toLocaleString()} unlocks
          </p>
        </div>
      )}

      {state === "running" && !progress && (
        <p className="text-right text-xs text-faint">Reading your library…</p>
      )}

      {message && (
        <p
          className={`text-right text-xs ${
            state === "error" ? "text-orange-400" : "text-muted"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
