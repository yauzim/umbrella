"use client";

import { useId, useState } from "react";

/**
 * Half-star rating, Letterboxd-style.
 *
 * The value is 1–10 half-stars. Each star is two hit targets so half
 * ratings are a normal click rather than a fiddly drag, and the whole
 * control is keyboard-operable via a hidden radio group.
 */

export function StarDisplay({
  value,
  size = 16,
}: {
  value: number | null; // 1–10 half-stars
  size?: number;
}) {
  if (value === null) return null;
  return (
    <span
      className="inline-flex gap-0.5 align-middle"
      title={`${(value / 2).toFixed(1)} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.max(0, Math.min(1, value / 2 - (star - 1)));
        return <Star key={star} fill={fill} size={size} />;
      })}
    </span>
  );
}

function Star({ fill, size }: { fill: number; size: number }) {
  // useId, not Math.random: the gradient id is rendered into markup on the
  // server and must match on the client, or hydration tears.
  const id = `sg-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="var(--accent)" />
          <stop offset={`${fill * 100}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M10 1.5l2.6 5.3 5.9.9-4.3 4.2 1 5.8L10 15l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z"
        fill={`url(#${id})`}
        stroke="var(--accent)"
        strokeWidth="1.1"
        strokeLinejoin="round"
        opacity={fill > 0 ? 1 : 0.35}
      />
    </svg>
  );
}

export function StarInput({
  value,
  onChange,
  size = 28,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex gap-0.5"
        onMouseLeave={() => setHover(null)}
        role="radiogroup"
        aria-label="Rating"
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = shown === null ? 0 : Math.max(0, Math.min(1, shown / 2 - (star - 1)));
          return (
            <span key={star} className="relative" style={{ width: size, height: size }}>
              <Star fill={fill} size={size} />
              {/* Two halves per star: left sets .5, right sets whole. */}
              {[0, 1].map((half) => {
                const v = star * 2 - 1 + half;
                return (
                  <button
                    key={half}
                    type="button"
                    role="radio"
                    aria-checked={value === v}
                    aria-label={`${v / 2} stars`}
                    onMouseEnter={() => setHover(v)}
                    onClick={() => onChange(value === v ? null : v)}
                    className="absolute top-0 h-full w-1/2 cursor-pointer"
                    style={{ left: half ? "50%" : 0 }}
                  />
                );
              })}
            </span>
          );
        })}
      </div>

      <span className="tnum text-sm text-muted">
        {shown === null ? "No rating" : `${(shown / 2).toFixed(1)}`}
      </span>

      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-faint underline-offset-2 hover:underline"
        >
          clear
        </button>
      )}
    </div>
  );
}
