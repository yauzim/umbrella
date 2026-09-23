"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReview, saveReview } from "@/lib/game-actions";
import { StarInput } from "@/components/stars";

interface Props {
  appid: number;
  initial: {
    rating: number | null;
    body: string | null;
    containsSpoilers: boolean;
  } | null;
}

export function ReviewEditor({ appid, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(initial === null);

  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [body, setBody] = useState(initial?.body ?? "");
  const [spoilers, setSpoilers] = useState(initial?.containsSpoilers ?? false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await saveReview({ appid, rating, body, containsSpoilers: spoilers });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save.");
      }
    });
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-panel p-4">
        <p className="text-sm text-muted">Your review is saved.</p>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border border-border-strong bg-raised px-3 py-1.5 text-sm font-medium transition-colors hover:border-accent"
        >
          Edit
        </button>
        <button
          onClick={() =>
            startTransition(async () => {
              await deleteReview(appid);
              setRating(null);
              setBody("");
              setSpoilers(false);
              setOpen(true);
              router.refresh();
            })
          }
          disabled={pending}
          className="text-sm text-faint underline-offset-2 hover:underline disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <StarInput value={rating} onChange={setRating} />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={5000}
        placeholder="What was the grind actually like?"
        className="mt-3 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={spoilers}
            onChange={(e) => setSpoilers(e.target.checked)}
            className="size-3.5 accent-[var(--accent)]"
          />
          Contains spoilers or achievement solutions
        </label>

        <div className="flex items-center gap-2">
          {initial && (
            <button
              onClick={() => setOpen(false)}
              className="text-sm text-faint underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          )}
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-lg border border-border-strong bg-raised px-4 py-2 text-sm font-medium transition-colors hover:border-accent disabled:opacity-60"
          >
            {pending ? "Saving…" : initial ? "Update" : "Post review"}
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-orange-400">{error}</p>}
    </div>
  );
}
