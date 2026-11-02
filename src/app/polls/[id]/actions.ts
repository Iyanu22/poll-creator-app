"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RuleError } from "@/domain/poll-machine";
import { buildResults } from "@/domain/results";
import { TITLE_MAX } from "@/domain/rules";
import {
  approveSuggestion,
  createPoll,
  declineSuggestion,
  endVoting,
  reopenVoting,
  undoDeclineSuggestion,
} from "@/server/poll-service";
import { notifyPollChanged } from "@/server/notify";
import { getCreatorPoll } from "@/server/poll-view";
import { getCurrentUser } from "@/server/session";

// Creator actions on one poll. Arguments come from the browser, so they're
// validated here; the rules themselves live in the poll service, which
// rejects anything the state machine doesn't allow.

export type ActionResult = { ok: true } | { ok: false; message: string };

const pollIdSchema = z.string().min(1).max(64);
const optionIdSchema = z.uuid();

/** A tiebreaker is a quick re-vote: an hour is plenty. */
const TIEBREAKER_MS = 60 * 60 * 1000;

async function asCreator(
  pollId: string,
  run: (creatorId: string) => Promise<void>,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "You've been signed out. Sign in again." };
  }
  try {
    await run(user.id);
  } catch (error) {
    if (error instanceof RuleError)
      return { ok: false, message: error.message };
    throw error;
  }
  refresh();
  notifyPollChanged(pollId);
  return { ok: true };
}

const invalid: ActionResult = {
  ok: false,
  message: "Something about that request wasn't right. Reload and try again.",
};

export async function endVotingAction(pollId: string) {
  const id = pollIdSchema.safeParse(pollId);
  if (!id.success) return invalid;
  return asCreator(id.data, (creatorId) => endVoting(id.data, creatorId));
}

export async function reopenVotingAction(pollId: string, closesAt: string) {
  const id = pollIdSchema.safeParse(pollId);
  const deadline = z.iso.datetime().safeParse(closesAt);
  if (!id.success || !deadline.success) return invalid;
  return asCreator(id.data, (creatorId) =>
    reopenVoting(id.data, creatorId, new Date(deadline.data)),
  );
}

function suggestionAction(
  apply: (pollId: string, optionId: string, creatorId: string) => Promise<void>,
) {
  return async (pollId: string, optionId: string) => {
    const id = pollIdSchema.safeParse(pollId);
    const option = optionIdSchema.safeParse(optionId);
    if (!id.success || !option.success) return invalid;
    return asCreator(id.data, (creatorId) =>
      apply(id.data, option.data, creatorId),
    );
  };
}

export async function approveSuggestionAction(
  pollId: string,
  optionId: string,
) {
  return suggestionAction(approveSuggestion)(pollId, optionId);
}

export async function declineSuggestionAction(
  pollId: string,
  optionId: string,
) {
  return suggestionAction(declineSuggestion)(pollId, optionId);
}

export async function undoDeclineAction(pollId: string, optionId: string) {
  return suggestionAction(undoDeclineSuggestion)(pollId, optionId);
}

/**
 * A tie at close becomes a fresh poll of just the tied options, closing in
 * an hour, and lands on its share step. Rechecks the tie here rather than
 * trusting the button.
 */
export async function runTiebreakerAction(
  pollId: string,
): Promise<ActionResult> {
  const id = pollIdSchema.safeParse(pollId);
  if (!id.success) return invalid;
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "You've been signed out. Sign in again." };
  }

  const poll = await getCreatorPoll(id.data, user.id);
  if (!poll) return invalid;
  const { standing } = buildResults(poll.ballotOptions, poll.voters);
  if (poll.status !== "settled" || standing.kind !== "tie") {
    return { ok: false, message: "There's no tie to break on this poll." };
  }

  const now = new Date();
  const created = await createPoll(
    user.id,
    {
      title: `Tiebreaker: ${poll.title}`.slice(0, TITLE_MAX),
      options: standing.tied.map((o) => o.label),
      type: "single",
      maxChoices: 1,
      suggestionsEnabled: false,
      closesAt: new Date(now.getTime() + TIEBREAKER_MS),
    },
    now,
  );
  if ("errors" in created) {
    return { ok: false, message: "Couldn't set up the tiebreaker. Try again." };
  }
  redirect(`/polls/${created.pollId}/share`);
}
