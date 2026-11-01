import "server-only";
import { createAvatar } from "@dicebear/core";
import { micah } from "@dicebear/collection";
import type { AvatarTint } from "@/domain/rules";

// DiceBear "micah", rendered on our server: no third-party request per face.
// Decorative by default because the person's name always sits beside it.

function avatarUri(seed: string, tint: AvatarTint): string | null {
  try {
    return createAvatar(micah, { seed, backgroundColor: [tint] }).toDataUri();
  } catch {
    return null;
  }
}

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
  const src = avatarUri(seed, tint);
  const frame = `shrink-0 rounded-full border-[length:var(--border-chip)] border-cocoa ${className}`;

  if (!src) {
    // A tinted circle with an initial, never a silent gap
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size, backgroundColor: `#${tint}` }}
        className={`${frame} inline-flex items-center justify-center font-display text-xs font-bold`}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- inline data URI
  return <img src={src} alt="" width={size} height={size} className={frame} />;
}
