"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Steam cover art, with a fallback chain.
 *
 * Valve serves header art from two schemes: the long-standing
 * `/steam/apps/<id>/header.jpg` path, and a newer `store_item_assets`
 * path used for more recent entries. Neither covers everything — some
 * games (delisted, region-locked, very new) have no header at all — so
 * this tries each in turn and then degrades to a titled placeholder
 * rather than leaving an empty grey box that reads as a bug.
 */

export function headerCandidates(appid: number): string[] {
  return [
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
  ];
}

interface Props {
  appid: number;
  name: string;
  /** Skip straight to a known-good URL (e.g. a stored icon). */
  src?: string | null;
  sizes?: string;
  className?: string;
  priority?: boolean;
}

export function GameArt({
  appid,
  name,
  src,
  sizes = "260px",
  className = "object-cover",
  priority = false,
}: Props) {
  const sources = src ? [src, ...headerCandidates(appid)] : headerCandidates(appid);
  const [index, setIndex] = useState(0);

  if (index >= sources.length) {
    // Exhausted every source: show the title instead of nothing, so the
    // card still communicates which game it is.
    return (
      <div className="flex size-full items-center justify-center bg-raised px-2">
        <span className="line-clamp-3 text-center text-[11px] font-medium leading-tight text-faint">
          {name}
        </span>
      </div>
    );
  }

  return (
    <Image
      key={sources[index]}
      src={sources[index]}
      alt=""
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      unoptimized
      onError={() => setIndex((i) => i + 1)}
    />
  );
}
