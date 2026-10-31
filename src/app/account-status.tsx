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
        Signed in as <strong>{user.isGuest ? "Guest" : user.name}</strong>
      </p>
      <SignOutButton />
    </div>
  );
}
