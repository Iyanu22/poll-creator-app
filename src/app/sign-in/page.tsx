import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { SignInButtons } from "./sign-in-buttons";
import { SignInError } from "./sign-in-error";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-content flex-1 flex-col justify-center gap-6 px-6 py-16 outline-none"
    >
      <Logo />
      <h1 className="text-2xl font-extrabold tracking-[-0.02em]">
        Sign in to Tiebreak
      </h1>
      {/* Reads searchParams, so it streams in after the static shell */}
      <Suspense>
        <SignInError />
      </Suspense>
      <SignInButtons />
    </main>
  );
}
