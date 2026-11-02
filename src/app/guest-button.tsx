"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";

/** "Try it with sample polls": a guest account with its own sandbox. */
export function GuestButton({ className }: { className: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-disabled={isPending}
        aria-busy={isPending}
        onClick={() => {
          if (isPending) return;
          setFailed(false);
          startTransition(async () => {
            // The server seeds the sample polls before this resolves
            const { error } = await authClient.signIn.anonymous();
            if (error) return setFailed(true);
            router.push("/polls");
          });
        }}
        className={className}
      >
        {isPending
          ? "Setting up your sample polls…"
          : "Try it with sample polls"}
      </button>
      <p role="status" className="text-sm">
        {failed ? "That didn't go through. Try again." : null}
      </p>
    </div>
  );
}
