"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Steam cover art.
 *
 * The URL is resolved during sync and stored on the game row, because it
 * is not always derivable: recent releases serve art from a path that
 * embeds a content hash, which only the store API knows. Anything with no
 * art at all degrades to a titled placeholder rather than an empty grey
 * box that reads as a bug.
 */
interface Props {
  name: string;
  src?: string | null;
  sizes?: string;
  className?: string;
  priority?: boolean;
}

export function GameArt({
  name,
  src,
  sizes = "260px",
  className = "object-cover",
  priority = false,
}: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
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
      src={src}
      alt=""
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}
