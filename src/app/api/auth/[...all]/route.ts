import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth owns everything under /api/auth: OAuth redirects and
// callbacks, session reads, sign-out.
export const { GET, POST } = toNextJsHandler(auth);
