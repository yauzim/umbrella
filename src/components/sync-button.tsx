"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SyncReport } from "@/lib/steam/sync";

interface Props {
  /** Auto-runs once for a profile that has never been synced. */
  autoStart: boolean;
}

export function SyncButton({ autoStart }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  async function run(force = false) {
    if (state === "running") return;
    setState("running");
    setMessage(null);

    try {
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

      setState("done");
      setMessage(
        `${data.achievementsUnlocked.toLocaleString()} achievements across ${data.gamesScanned} games` +
          (data.perfectGames ? ` · ${data.perfectGames} at 100%` : ""),
      );
      router.refresh();
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Sync failed");
    }
  }

  useEffect(() => {
    // Ref guard, not just state: React 18+ mounts effects twice in dev
    // Strict Mode, and a duplicate run means hundreds of wasted API calls.
    if (autoStart && !started.current) {
      started.current = true;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={() => run(state === "done")}
        disabled={state === "running"}
        className="rounded-lg border border-border-strong bg-raised px-3 py-1.5 text-sm font-medium transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "running" ? "Syncing…" : state === "done" ? "Re-sync" : "Sync Steam"}
      </button>

      {state === "running" && (
        <p className="max-w-xs text-right text-xs text-faint">
          Scanning your library. A large one takes a minute or two.
        </p>
      )}
      {message && (
        <p
          className={`max-w-xs text-right text-xs ${
            state === "error" ? "text-orange-400" : "text-muted"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
