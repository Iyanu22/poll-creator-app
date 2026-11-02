import "server-only";
import { createAvatar } from "@dicebear/core";
import { micah } from "@dicebear/collection";
import type { AvatarTint } from "@/domain/rules";

// DiceBear "micah", rendered on our server: no third-party request per face.
// Faces are drawn on a transparent background and the tint is CSS, so one
// face renders once however many tints it's shown on (the voter's picker).

/** The face as a data URI, or null if rendering fails. */
export function faceUri(seed: string): string | null {
  try {
    return createAvatar(micah, { seed }).toDataUri();
  } catch {
    return null;
  }
}

/** Decorative by default: the person's name always sits beside it. */
export function Avatar({
  seed,
  tint,
  name,
  size = 32,
  className = "",
}: {
  seed: string;
  tint: AvatarTint;
  name: string;
  size?: number;
  className?: string;
}) {
  const src = faceUri(seed);
  const frame = `shrink-0 rounded-full border-[length:var(--border-chip)] border-cocoa ${className}`;
  const style = { width: size, height: size, backgroundColor: `#${tint}` };

  if (!src) {
    // A tinted circle with an initial, never a silent gap
    return (
      <span
        aria-hidden="true"
        style={style}
        className={`${frame} inline-flex items-center justify-center font-display text-xs font-bold`}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- inline data URI
  return <img src={src} alt="" style={style} className={frame} />;
}
