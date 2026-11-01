"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { RuleError } from "@/domain/poll-machine";
import {
  AVATAR_TINTS,
  MAX_OPTIONS,
  OPTION_LABEL_MAX,
  VOTER_FACES,
  VOTER_NAME_MAX,
} from "@/domain/rules";
import { castBallot, suggestOption } from "@/server/poll-service";
import { ensureVoterToken } from "@/server/voter-token";

// Voter actions on the public vote page. No account: the voter token cookie
// is the identity, and the poll service enforces every rule (open poll,
// one ballot per token, idempotent replays).

export type VoterActionResult = { ok: true } | { ok: false; message: string };

const pollIdSchema = z.string().min(1).max(64);
const identity = {
  name: z.string().trim().min(1).max(VOTER_NAME_MAX),
  avatarSeed: z.enum(VOTER_FACES),
  avatarTint: z.enum(AVATAR_TINTS),
};

const castSchema = z.object({
  ...identity,
  optionIds: z.array(z.uuid()).min(1).max(MAX_OPTIONS),
});

const suggestSchema = z.object({
  ...identity,
  label: z.string().trim().min(1).max(OPTION_LABEL_MAX),
});

const invalid: VoterActionResult = {
  ok: false,
  message: "Something about that wasn't right. Check your name and picks.",
};

export async function castVoteAction(
  pollId: string,
  input: z.input<typeof castSchema>,
): Promise<VoterActionResult> {
  const id = pollIdSchema.safeParse(pollId);
  const vote = castSchema.safeParse(input);
  if (!id.success || !vote.success) return invalid;

  const { optionIds, ...voter } = vote.data;
  try {
    await castBallot({
      pollId: id.data,
      voterToken: await ensureVoterToken(),
      voter,
      optionIds,
    });
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    // The page may be stale (poll closed, already voted elsewhere in this
    // browser): show the voter where things really stand.
    refresh();
    return { ok: false, message: error.message };
  }
  refresh();
  return { ok: true };
}

export async function suggestAction(
  pollId: string,
  input: z.input<typeof suggestSchema>,
): Promise<VoterActionResult> {
  const id = pollIdSchema.safeParse(pollId);
  const suggestion = suggestSchema.safeParse(input);
  if (!id.success || !suggestion.success) return invalid;

  const { label, ...suggestedBy } = suggestion.data;
  try {
    await suggestOption({ pollId: id.data, label, suggestedBy });
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    return { ok: false, message: error.message };
  }
  // Nothing to refresh: pending suggestions aren't on the public ballot
  return { ok: true };
}
