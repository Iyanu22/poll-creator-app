import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type CurrentUser = {
  id: string;
  name: string;
  image: string | null;
  isGuest: boolean;
};

// The one place the app reads the session. Returns a narrow user, never the
// raw session, so tokens can't leak into props. Reads request headers, so
// callers must render behind a <Suspense> boundary (Cache Components).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    image: user.image ?? null,
    isGuest: Boolean(user.isAnonymous),
  };
}
