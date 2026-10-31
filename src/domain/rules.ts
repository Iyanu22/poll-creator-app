// Product rules as data. The DB schema, the state machine, and the UI all
// read from here so a limit never disagrees with itself.

export const MIN_OPTIONS = 2;
/** Applies to the whole ballot, approved suggestions included. */
export const MAX_OPTIONS = 10;

export const TITLE_MAX = 120;
export const OPTION_LABEL_MAX = 80;
export const VOTER_NAME_MAX = 40;

/**
 * The decline toast shows for ~8s; the server allows a little longer so a
 * click at 7.9s isn't lost to network latency.
 */
export const DECLINE_UNDO_WINDOW_MS = 10_000;

/** DiceBear "micah" background tints (hex without #, as DiceBear takes them). */
export const AVATAR_TINTS = ["f8c9b9", "cbe2d8", "f6e0a4", "e3d2f2"] as const;
export type AvatarTint = (typeof AVATAR_TINTS)[number];

export const POLL_TYPES = ["single", "multi"] as const;
export const POLL_STATUSES = ["open", "settled"] as const;
export const OPTION_SOURCES = ["creator", "suggestion"] as const;
export const SUGGESTION_STATUSES = ["pending", "approved", "declined"] as const;

export type PollType = (typeof POLL_TYPES)[number];
export type PollStatus = (typeof POLL_STATUSES)[number];
export type OptionSource = (typeof OPTION_SOURCES)[number];
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];
