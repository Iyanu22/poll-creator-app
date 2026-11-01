import { normalizeLabel } from "./poll-machine";
import {
  MAX_OPTIONS,
  MIN_OPTIONS,
  OPTION_LABEL_MAX,
  TITLE_MAX,
  type PollType,
} from "./rules";

// A poll before it exists. The creation form validates inline with this and
// the server validates again with the same function, so the two can never
// disagree about what a valid poll is.

export interface PollDraft {
  title: string;
  /** In the creator's order; blanks are allowed while typing, then dropped. */
  options: string[];
  type: PollType;
  /** 1 for single; 2..options for multi. */
  maxChoices: number;
  suggestionsEnabled: boolean;
  closesAt: Date;
}

export interface DraftErrors {
  title?: string;
  /** Per field, by index into draft.options. */
  optionFields?: Record<number, string>;
  /** About the list as a whole ("add at least two"). */
  options?: string;
  maxChoices?: string;
  closesAt?: string;
}

export type DraftResult =
  | { ok: true; poll: Omit<PollDraft, "options"> & { options: string[] } }
  | { ok: false; errors: DraftErrors };

const tidy = (text: string) => text.trim().replace(/\s+/g, " ");

export function validateDraft(draft: PollDraft, now: Date): DraftResult {
  const errors: DraftErrors = {};

  const title = tidy(draft.title);
  if (!title) errors.title = "Give your poll a question.";
  else if (title.length > TITLE_MAX) {
    errors.title = `Keep it under ${TITLE_MAX} characters.`;
  }

  const optionFields: Record<number, string> = {};
  const seen = new Map<string, number>();
  const options: string[] = [];
  draft.options.forEach((raw, index) => {
    const label = tidy(raw);
    if (!label) return; // blank rows are just unused
    if (label.length > OPTION_LABEL_MAX) {
      optionFields[index] = `Keep it under ${OPTION_LABEL_MAX} characters.`;
      return;
    }
    const key = normalizeLabel(label);
    if (seen.has(key)) {
      optionFields[index] = "That's already an option.";
      return;
    }
    seen.set(key, index);
    options.push(label);
  });
  if (Object.keys(optionFields).length) errors.optionFields = optionFields;

  const filled = draft.options.filter((o) => tidy(o)).length;
  if (filled < MIN_OPTIONS) {
    errors.options = `Add at least ${MIN_OPTIONS} options.`;
  } else if (filled > MAX_OPTIONS) {
    errors.options = `${MAX_OPTIONS} options is the most a poll can have.`;
  }

  let maxChoices = 1;
  if (draft.type === "multi") {
    maxChoices = Math.trunc(draft.maxChoices);
    if (!(maxChoices >= 2)) {
      errors.maxChoices = "Pick-more-than-one needs at least 2 picks.";
    } else if (filled >= MIN_OPTIONS && maxChoices > filled) {
      errors.maxChoices = `There are only ${filled} options to pick from.`;
    }
  }

  if (Number.isNaN(draft.closesAt.getTime())) {
    errors.closesAt = "Pick when voting closes.";
  } else if (draft.closesAt <= now) {
    errors.closesAt = "Pick a closing time in the future.";
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    poll: {
      title,
      options,
      type: draft.type,
      maxChoices,
      suggestionsEnabled: draft.suggestionsEnabled,
      closesAt: draft.closesAt,
    },
  };
}
