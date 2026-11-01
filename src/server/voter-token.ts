import "server-only";
import { nanoid } from "nanoid";
import { cookies } from "next/headers";

// One token per browser, tied to polls through ballots' unique
// (pollId, voterToken). Casual prevention by design: a second browser is a
// second voter; a refresh or double-tap is not (casting is idempotent).

const COOKIE = "tb_voter";
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{21}$/;

export async function readVoterToken(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  return value && TOKEN_SHAPE.test(value) ? value : null;
}

/** Server Actions only: Server Components can't set cookies. */
export async function ensureVoterToken(): Promise<string> {
  const existing = await readVoterToken();
  if (existing) return existing;
  const token = nanoid();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return token;
}
