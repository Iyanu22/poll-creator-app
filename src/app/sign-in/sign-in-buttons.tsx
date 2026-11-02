"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const providers = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
] as const;

type ProviderId = (typeof providers)[number]["id"];

export function SignInButtons() {
  const router = useRouter();
  const [pending, setPending] = useState<ProviderId | "guest" | null>(null);
  const [failed, setFailed] = useState(false);

  async function tryAsGuest() {
    setPending("guest");
    setFailed(false);
    // Creates the anonymous user; the server seeds their sample polls
    // before this resolves.
    const { error } = await authClient.signIn.anonymous();
    if (error) {
      setPending(null);
      setFailed(true);
      return;
    }
    router.push("/polls");
    router.refresh();
  }

  async function signIn(provider: ProviderId) {
    setPending(provider);
    setFailed(false);
    // On success the browser leaves for the provider, so only failures
    // come back here. Provider-side errors land on errorCallbackURL.
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: "/polls",
      errorCallbackURL: "/sign-in",
    });
    if (error) {
      setPending(null);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {providers.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => signIn(id)}
          disabled={pending !== null}
          aria-busy={pending === id}
          className="rounded-full border-2 border-cocoa bg-card px-5 py-3 font-display text-base font-bold disabled:opacity-60"
        >
          {pending === id ? "Redirecting…" : label}
        </button>
      ))}
      <button
        type="button"
        onClick={tryAsGuest}
        disabled={pending !== null}
        aria-busy={pending === "guest"}
        className="rounded-full px-5 py-3 font-display text-base font-bold underline disabled:opacity-60"
      >
        {pending === "guest" ? "Setting up your sample polls…" : "Try as guest"}
      </button>
      <p role="alert" className="text-sm text-cocoa-soft">
        {failed ? "That didn't go through. Try again." : null}
      </p>
    </div>
  );
}
