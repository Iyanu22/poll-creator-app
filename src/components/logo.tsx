import Link from "next/link";

/** The game-piece mark: tangerine circle, cocoa ring, cream check. */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="shrink-0"
    >
      <circle
        cx="12"
        cy="12"
        r="10.6"
        className="fill-tangerine stroke-cocoa"
        strokeWidth="2.4"
      />
      <path
        d="M7.4 12.4l3.1 3.1 6.1-6.4"
        fill="none"
        className="stroke-cream-bright"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark + wordmark, linking home (or wherever "home" is for this screen). */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 self-start font-display text-lg font-extrabold"
    >
      <LogoMark size={26} />
      tiebreak
    </Link>
  );
}
