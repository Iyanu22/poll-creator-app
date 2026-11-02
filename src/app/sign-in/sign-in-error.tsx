"use client";

import { useSearchParams } from "next/navigation";

// Better Auth redirects failed OAuth callbacks to /sign-in?error=<code>.
// The code is for logs, not people, so the message stays generic.
export function SignInError() {
  const error = useSearchParams().get("error");
  if (!error) return null;

  return (
    <p role="alert" className="rounded-md bg-cream-deep px-4 py-3 text-cocoa">
      Sign-in didn&apos;t finish. Try again.
    </p>
  );
}
