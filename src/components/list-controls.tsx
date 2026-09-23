"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addToList,
  createList,
  removeFromList,
  toggleSystemList,
} from "@/lib/game-actions";

interface Membership {
  id: number;
  name: string;
  slug: string;
  kind: string;
  has: boolean;
}

/**
 * Backlog and Hunting get dedicated buttons because they are the two
 * decisions people actually make on a game page. Everything else lives
 * behind "Add to list" so the common case stays one click.
 */
export function ListControls({
  appid,
  lists,
}: {
  appid: number;
  lists: Membership[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const backlog = lists.find((l) => l.slug === "backlog");
  const hunting = lists.find((l) => l.slug === "hunting");
  const custom = lists.filter(
    (l) => l.slug !== "backlog" && l.slug !== "hunting",
  );

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle
        label="Backlog"
        on={backlog?.has ?? false}
        disabled={pending}
        onClick={() => run(() => toggleSystemList("backlog", appid))}
      />
      <Toggle
        label="Hunting"
        on={hunting?.has ?? false}
        disabled={pending}
        onClick={() => run(() => toggleSystemList("hunting", appid))}
      />

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-border bg-panel px-3 py-1.5 text-sm transition-colors hover:border-border-strong"
        >
          Add to list ▾
        </button>

        {open && (
          <>
            {/* Click-away layer so the menu closes like a real popover. */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div className="absolute right-0 z-50 mt-1 w-64 rounded-xl border border-border bg-panel p-2 shadow-xl">
              {custom.length > 0 ? (
                <ul className="max-h-56 overflow-y-auto">
                  {custom.map((l) => (
                    <li key={l.id}>
                      <button
                        onClick={() =>
                          run(() =>
                            l.has
                              ? removeFromList(l.id, appid)
                              : addToList(l.id, appid),
                          )
                        }
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-raised"
                      >
                        <span
                          className="flex size-4 shrink-0 items-center justify-center rounded border text-[10px]"
                          style={{
                            borderColor: l.has
                              ? "var(--accent)"
                              : "var(--border-strong)",
                            backgroundColor: l.has
                              ? "var(--accent)"
                              : "transparent",
                            color: "var(--bg)",
                          }}
                        >
                          {l.has ? "✓" : ""}
                        </span>
                        <span className="truncate">{l.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-1.5 text-xs text-faint">
                  No lists yet.
                </p>
              )}

              <div className="mt-2 border-t border-border pt-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newName.trim()) {
                      run(async () => {
                        const l = await createList({ name: newName });
                        await addToList(l.id, appid);
                        setNewName("");
                      });
                    }
                  }}
                  placeholder="New list, then Enter"
                  maxLength={80}
                  className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm outline-none placeholder:text-faint focus:border-accent"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Toggle({
  label,
  on,
  disabled,
  onClick,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
      style={{
        borderColor: on ? "var(--accent)" : "var(--border)",
        backgroundColor: on ? "var(--accent)" : "var(--panel)",
        color: on ? "var(--bg)" : "var(--text)",
      }}
    >
      {on ? `✓ ${label}` : label}
    </button>
  );
}
