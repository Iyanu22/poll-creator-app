import Link from "next/link";
import { getCurrentUser } from "@/server/session";
import { SignOutButton } from "./sign-out-button";

// Reads the session, so it must render inside <Suspense>.
export async function AccountStatus() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href="/sign-in" className="font-bold underline">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p>
        Signed in as <strong>{user.name}</strong>
      </p>
      {user.isGuest ? (
        <span className="rounded-full bg-butter px-3 py-1 text-xs font-bold tracking-[0.06em] uppercase">
          Guest
        </span>
      ) : null}
      <SignOutButton />
    </div>
  );
}
