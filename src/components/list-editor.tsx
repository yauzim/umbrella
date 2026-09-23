"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteList,
  removeFromList,
  reorderList,
  setItemNote,
  updateList,
} from "@/lib/game-actions";
import { formatPlaytime } from "@/lib/rarity";

interface Entry {
  appid: number;
  name: string;
  headerUrl: string | null;
  note: string | null;
  unlockedCount: number;
  achievementCount: number;
  playtimeForever: number;
}

interface Props {
  listId: number;
  name: string;
  description: string | null;
  ranked: boolean;
  isPublic: boolean;
  canDelete: boolean;
  ownerPath: string;
  entries: Entry[];
}

/**
 * Owner's view of a list.
 *
 * Reordering uses explicit up/down controls rather than drag-and-drop:
 * drag is fiddly on touch, invisible to keyboards, and this is a list of
 * a dozen games, not a thousand.
 */
export function ListEditor({
  listId,
  name,
  description,
  ranked,
  isPublic,
  canDelete,
  ownerPath,
  entries: initialEntries,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [entries, setEntries] = useState(initialEntries);
  const [editingMeta, setEditingMeta] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftDesc, setDraftDesc] = useState(description ?? "");
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;

    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    setEntries(next); // optimistic: the arrows should feel instant
    run(() => reorderList(listId, next.map((e) => e.appid)));
  }

  return (
    <div className="mt-6">
      {/* List settings ------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setEditingMeta((v) => !v)}
          className="rounded-lg border border-border bg-panel px-3 py-1.5 text-sm transition-colors hover:border-border-strong"
        >
          {editingMeta ? "Close" : "Edit details"}
        </button>

        <button
          onClick={() => run(() => updateList({ listId, ranked: !ranked }))}
          disabled={pending}
          aria-pressed={ranked}
          className="rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-60"
          style={{
            borderColor: ranked ? "var(--accent)" : "var(--border)",
            backgroundColor: ranked ? "var(--accent)" : "var(--panel)",
            color: ranked ? "var(--bg)" : "var(--text)",
          }}
        >
          {ranked ? "✓ Ranked" : "Ranked"}
        </button>

        <button
          onClick={() => run(() => updateList({ listId, isPublic: !isPublic }))}
          disabled={pending}
          className="rounded-lg border border-border bg-panel px-3 py-1.5 text-sm transition-colors hover:border-border-strong disabled:opacity-60"
        >
          {isPublic ? "Public" : "Private"}
        </button>

        {canDelete && (
          <button
            onClick={() => {
              if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
              startTransition(async () => {
                await deleteList(listId);
                router.push(ownerPath);
              });
            }}
            disabled={pending}
            className="ml-auto text-sm text-faint underline-offset-2 hover:text-orange-400 hover:underline disabled:opacity-60"
          >
            Delete list
          </button>
        )}
      </div>

      {editingMeta && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-panel p-4">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={80}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <textarea
            value={draftDesc}
            onChange={(e) => setDraftDesc(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="What is this list for?"
            className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
          />
          <button
            onClick={() =>
              run(async () => {
                await updateList({
                  listId,
                  name: draftName,
                  description: draftDesc,
                });
                setEditingMeta(false);
              })
            }
            disabled={pending || !draftName.trim()}
            className="rounded-lg border border-border-strong bg-raised px-4 py-2 text-sm font-medium transition-colors hover:border-accent disabled:opacity-60"
          >
            Save
          </button>
        </div>
      )}

      {/* Entries ------------------------------------------------------ */}
      {entries.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          Nothing here yet. Open a game and use{" "}
          <span className="text-text">Add to list</span>.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-panel">
          {entries.map((e, i) => {
            const complete =
              e.achievementCount > 0 && e.unlockedCount >= e.achievementCount;
            return (
              <li key={e.appid} className="flex items-center gap-3 p-3">
                {ranked && (
                  <span className="tnum w-6 shrink-0 text-sm font-semibold text-faint">
                    {i + 1}
                  </span>
                )}

                <Link
                  href={`/game/${e.appid}`}
                  className="relative aspect-[460/215] w-24 shrink-0 overflow-hidden rounded border border-border bg-raised sm:w-32"
                >
                  {e.headerUrl ? (
                    <Image
                      src={e.headerUrl}
                      alt=""
                      fill
                      sizes="128px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center px-1 text-center text-[10px] text-faint">
                      {e.name}
                    </span>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/game/${e.appid}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {e.name}
                  </Link>
                  <p className="tnum text-xs text-faint">
                    {e.achievementCount > 0
                      ? `${e.unlockedCount}/${e.achievementCount}`
                      : "no achievements"}
                    {" · "}
                    {formatPlaytime(e.playtimeForever)}
                    {complete && (
                      <span style={{ color: "var(--accent)" }}> · 100%</span>
                    )}
                  </p>

                  {noteFor === e.appid ? (
                    <div className="mt-1 flex gap-2">
                      <input
                        value={noteText}
                        onChange={(ev) => setNoteText(ev.target.value)}
                        maxLength={300}
                        autoFocus
                        placeholder="Why is it on the list?"
                        className="min-w-0 flex-1 rounded border border-border bg-bg px-2 py-1 text-xs outline-none focus:border-accent"
                      />
                      <button
                        onClick={() =>
                          run(async () => {
                            await setItemNote(listId, e.appid, noteText);
                            setNoteFor(null);
                          })
                        }
                        className="text-xs text-muted hover:text-text"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    e.note && (
                      <p className="mt-0.5 text-xs text-muted">{e.note}</p>
                    )
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {ranked && (
                    <>
                      <IconButton
                        label="Move up"
                        disabled={i === 0 || pending}
                        onClick={() => move(i, -1)}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        label="Move down"
                        disabled={i === entries.length - 1 || pending}
                        onClick={() => move(i, 1)}
                      >
                        ↓
                      </IconButton>
                    </>
                  )}
                  <IconButton
                    label="Note"
                    disabled={pending}
                    onClick={() => {
                      setNoteFor(noteFor === e.appid ? null : e.appid);
                      setNoteText(e.note ?? "");
                    }}
                  >
                    ✎
                  </IconButton>
                  <IconButton
                    label="Remove"
                    disabled={pending}
                    onClick={() => {
                      setEntries((c) => c.filter((x) => x.appid !== e.appid));
                      run(() => removeFromList(listId, e.appid));
                    }}
                  >
                    ✕
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function IconButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-7 items-center justify-center rounded border border-border text-xs text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-30"
    >
      {children}
    </button>
  );
}
