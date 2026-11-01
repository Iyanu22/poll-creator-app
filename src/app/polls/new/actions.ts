"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { DraftErrors } from "@/domain/poll-draft";
import { MAX_OPTIONS, POLL_TYPES } from "@/domain/rules";
import { createPoll } from "@/server/poll-service";
import { getCurrentUser } from "@/server/session";

export type CreateResult =
  { ok: false; message: string } | { ok: false; errors: DraftErrors };

// Shape only: the rules (lengths, duplicates, deadlines) live in
// validateDraft, which createPoll runs.
const inputSchema = z.object({
  title: z.string().max(1000),
  options: z.array(z.string().max(1000)).max(MAX_OPTIONS * 2),
  type: z.enum(POLL_TYPES),
  maxChoices: z.number().int().min(1).max(MAX_OPTIONS),
  suggestionsEnabled: z.boolean(),
  closesAt: z.iso.datetime(),
});

/** On success this redirects to the share step and never returns. */
export async function createPollAction(
  input: z.input<typeof inputSchema>,
): Promise<CreateResult> {
  const user = await getCurrentUser();
  if (!user)
    return { ok: false, message: "You've been signed out. Sign in again." };

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Something about that wasn't right. Try again.",
    };
  }

  const result = await createPoll(user.id, {
    ...parsed.data,
    closesAt: new Date(parsed.data.closesAt),
  });
  if ("errors" in result) return { ok: false, errors: result.errors };
  redirect(`/polls/${result.pollId}/share`);
}
