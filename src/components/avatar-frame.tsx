import Image from "next/image";
import type { Frame } from "@/lib/frames";

/**
 * Avatar inside its earned frame.
 *
 * The ring is a conic gradient on the wrapper with the avatar inset by a
 * couple of pixels, so the frame is real geometry rather than a box-shadow
 * that would wash out against bright cover art. Top tiers rotate the
 * gradient; the rest stay still so a list of people is not a disco.
 */
export function AvatarFrame({
  src,
  fallback,
  frame,
  size = 112,
  priority = false,
}: {
  src: string | null;
  fallback: string;
  frame: Frame;
  size?: number;
  priority?: boolean;
}) {
  const ring = Math.max(3, Math.round(size * 0.035));
  const [a, b, c] = frame.colors;

  return (
    <span
      className={`relative inline-block shrink-0 rounded-2xl ${
        frame.animated ? "frame-spin" : ""
      }`}
      style={{
        width: size,
        height: size,
        padding: ring,
        background: `conic-gradient(from var(--frame-angle), ${a}, ${b}, ${c}, ${a})`,
        boxShadow: `0 0 ${ring * 4}px ${frame.glow}`,
      }}
      title={`${frame.label} — ${frame.requirement}`}
    >
      <span
        className="relative block size-full overflow-hidden rounded-xl bg-raised"
        style={{ boxShadow: "inset 0 0 0 2px var(--bg)" }}
      >
        {src ? (
          <Image
            src={src}
            alt=""
            width={size}
            height={size}
            priority={priority}
            className="size-full object-cover"
            unoptimized
          />
        ) : (
          <span
            className="flex size-full items-center justify-center font-bold"
            style={{ fontSize: size * 0.34, color: a }}
            aria-hidden
          >
            {fallback.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
    </span>
  );
}
