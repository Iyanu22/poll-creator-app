// The poll state machine as pure functions: no DB, no clock reads. Each
// `plan*` checks a transition against the rules and returns the patch to
// write, or throws a RuleError. The service layer runs these inside a
// transaction holding the poll's row lock, so the checks and the write
// can't be raced.
//
//   poll:        open ──(closesAt passes | end early)──▶ settled
//                settled ──(reopen + new future deadline)──▶ open
//   suggestion:  pending ──▶ approved | declined
//                declined ──(undo, within the toast window)──▶ pending
//   ballot:      cast once per voter token; replaying the same cast is a no-op

import {
  DECLINE_UNDO_WINDOW_MS,
  MAX_OPTIONS,
  type OptionSource,
  type PollStatus,
  type PollType,
  type SuggestionStatus,
} from "./rules";

export type RuleErrorCode =
  | "POLL_NOT_FOUND"
  | "POLL_SETTLED"
  | "POLL_OPEN"
  | "DEADLINE_NOT_FUTURE"
  | "EMPTY_SELECTION"
  | "DUPLICATE_CHOICE"
  | "TOO_MANY_CHOICES"
  | "OPTION_NOT_ON_BALLOT"
  | "ALREADY_VOTED"
  | "SUGGESTIONS_DISABLED"
  | "DUPLICATE_LABEL"
  | "BALLOT_FULL"
  | "SUGGESTION_NOT_FOUND"
  | "SUGGESTION_NOT_PENDING"
  | "SUGGESTION_NOT_DECLINED"
  | "UNDO_EXPIRED";

export class RuleError extends Error {
  constructor(
    readonly code: RuleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RuleError";
  }
}

export interface PollState {
  status: PollStatus;
  type: PollType;
  maxChoices: number;
  suggestionsEnabled: boolean;
  closesAt: Date;
  settledAt: Date | null;
  settledEarly: boolean;
}

export interface OptionState {
  id: string;
  label: string;
  source: OptionSource;
  suggestionStatus: SuggestionStatus | null;
  decidedAt: Date | null;
}

export type PollPatch = Pick<
  PollState,
  "status" | "settledAt" | "settledEarly"
> &
  Partial<Pick<PollState, "closesAt">>;

export type SuggestionPatch = Pick<
  OptionState,
  "suggestionStatus" | "decidedAt"
>;

// ── Poll lifecycle ───────────────────────────────────────────────────────

/** The truth, regardless of whether the stored status has caught up. */
export function effectiveStatus(poll: PollState, now: Date): PollStatus {
  if (poll.status === "open" && poll.closesAt <= now) return "settled";
  return poll.status;
}

/**
 * Lazy settling: if the deadline passed while nobody was looking, returns
 * the patch that records it as settled on time. Null if nothing to do.
 */
export function expiredSettlement(
  poll: PollState,
  now: Date,
): PollPatch | null {
  if (poll.status === "open" && poll.closesAt <= now) {
    return { status: "settled", settledAt: poll.closesAt, settledEarly: false };
  }
  return null;
}

function assertOpen(poll: PollState, now: Date) {
  if (effectiveStatus(poll, now) !== "open") {
    throw new RuleError("POLL_SETTLED", "Voting has ended on this poll.");
  }
}

export function planEndEarly(poll: PollState, now: Date): PollPatch {
  assertOpen(poll, now);
  return { status: "settled", settledAt: now, settledEarly: true };
}

export function planReopen(
  poll: PollState,
  newClosesAt: Date,
  now: Date,
): PollPatch {
  if (effectiveStatus(poll, now) !== "settled") {
    throw new RuleError("POLL_OPEN", "This poll is already open.");
  }
  // Invariant: an open poll always has a future deadline, so auto-close
  // stays true for every open poll.
  if (newClosesAt <= now) {
    throw new RuleError(
      "DEADLINE_NOT_FUTURE",
      "Pick a closing time in the future.",
    );
  }
  return {
    status: "open",
    settledAt: null,
    settledEarly: false,
    closesAt: newClosesAt,
  };
}

// ── Ballot ───────────────────────────────────────────────────────────────

export function isOnBallot(option: OptionState): boolean {
  return option.source === "creator" || option.suggestionStatus === "approved";
}

export function assertCanCast(
  poll: PollState,
  options: readonly OptionState[],
  selection: readonly string[],
  now: Date,
): void {
  assertOpen(poll, now);

  if (selection.length === 0) {
    throw new RuleError("EMPTY_SELECTION", "Pick an option to vote for.");
  }
  if (new Set(selection).size !== selection.length) {
    throw new RuleError(
      "DUPLICATE_CHOICE",
      "Each option can only be picked once.",
    );
  }
  if (selection.length > poll.maxChoices) {
    throw new RuleError(
      "TOO_MANY_CHOICES",
      poll.maxChoices === 1
        ? "This poll takes one pick."
        : `Pick up to ${poll.maxChoices} options.`,
    );
  }

  const ballot = new Set(options.filter(isOnBallot).map((o) => o.id));
  if (!selection.every((id) => ballot.has(id))) {
    throw new RuleError(
      "OPTION_NOT_ON_BALLOT",
      "That option isn't on the ballot.",
    );
  }
}

/**
 * A voter token that already has a ballot: replaying the exact same cast
 * (refresh, double-tap, retry after a dropped response) is idempotent;
 * anything else is a second vote, and votes are final.
 */
export function resolveRecast(
  existingSelection: readonly string[],
  selection: readonly string[],
): "replay" {
  const existing = new Set(existingSelection);
  const same =
    existing.size === new Set(selection).size &&
    selection.every((id) => existing.has(id));
  if (!same) {
    throw new RuleError("ALREADY_VOTED", "You've already voted. No takebacks!");
  }
  return "replay";
}

// ── Suggestions ──────────────────────────────────────────────────────────

/** Labels compare case- and spacing-insensitively: "Jaws" = " jaws ". */
export const normalizeLabel = (label: string) =>
  label.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export function assertCanSuggest(
  poll: PollState,
  options: readonly OptionState[],
  label: string,
  now: Date,
): void {
  assertOpen(poll, now);
  if (!poll.suggestionsEnabled) {
    throw new RuleError(
      "SUGGESTIONS_DISABLED",
      "Suggestions are turned off for this poll.",
    );
  }
  // Declined ideas don't block a re-suggestion; ballot + pending ones do.
  const taken = options
    .filter((o) => isOnBallot(o) || o.suggestionStatus === "pending")
    .map((o) => normalizeLabel(o.label));
  if (taken.includes(normalizeLabel(label))) {
    throw new RuleError("DUPLICATE_LABEL", "That's already an option.");
  }
}

function assertPending(option: OptionState) {
  if (option.source !== "suggestion") {
    throw new RuleError(
      "SUGGESTION_NOT_FOUND",
      "That suggestion doesn't exist.",
    );
  }
  if (option.suggestionStatus !== "pending") {
    throw new RuleError(
      "SUGGESTION_NOT_PENDING",
      "That suggestion has already been decided.",
    );
  }
}

export function planApprove(
  poll: PollState,
  options: readonly OptionState[],
  suggestion: OptionState,
  now: Date,
): SuggestionPatch {
  assertPending(suggestion);
  // Adding an option to a decided poll would change nothing but the record.
  assertOpen(poll, now);
  if (options.filter(isOnBallot).length >= MAX_OPTIONS) {
    throw new RuleError(
      "BALLOT_FULL",
      `The ballot is full (${MAX_OPTIONS} options).`,
    );
  }
  return { suggestionStatus: "approved", decidedAt: now };
}

/** Allowed on settled polls too: tidying the queue is always fine. */
export function planDecline(
  suggestion: OptionState,
  now: Date,
): SuggestionPatch {
  assertPending(suggestion);
  return { suggestionStatus: "declined", decidedAt: now };
}

export function planUndoDecline(
  suggestion: OptionState,
  now: Date,
): SuggestionPatch {
  if (
    suggestion.source !== "suggestion" ||
    suggestion.suggestionStatus !== "declined" ||
    !suggestion.decidedAt
  ) {
    throw new RuleError(
      "SUGGESTION_NOT_DECLINED",
      "Only a declined suggestion can be restored.",
    );
  }
  if (now.getTime() - suggestion.decidedAt.getTime() > DECLINE_UNDO_WINDOW_MS) {
    throw new RuleError("UNDO_EXPIRED", "Too late to undo that one.");
  }
  return { suggestionStatus: "pending", decidedAt: null };
}
