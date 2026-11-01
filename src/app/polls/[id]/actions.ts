"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { RuleError } from "@/domain/poll-machine";
import {
  approveSuggestion,
  declineSuggestion,
  endVoting,
  reopenVoting,
  undoDeclineSuggestion,
} from "@/server/poll-service";
import { notifyPollChanged } from "@/server/notify";
import { getCurrentUser } from "@/server/session";

// Creator actions on one poll. Arguments come from the browser, so they're
// validated here; the rules themselves live in the poll service, which
// rejects anything the state machine doesn't allow.

export type ActionResult = { ok: true } | { ok: false; message: string };

const pollIdSchema = z.string().min(1).max(64);
const optionIdSchema = z.uuid();

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
