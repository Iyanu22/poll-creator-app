import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { customAlphabet } from "nanoid";
import {
  AVATAR_TINTS,
  OPTION_LABEL_MAX,
  OPTION_SOURCES,
  POLL_STATUSES,
  POLL_TYPES,
  SUGGESTION_STATUSES,
  TITLE_MAX,
  VOTER_NAME_MAX,
} from "../../domain/rules"; // relative: drizzle-kit doesn't resolve tsconfig paths
import { users } from "./auth";

export const pollType = pgEnum("poll_type", POLL_TYPES);
export const pollStatus = pgEnum("poll_status", POLL_STATUSES);
export const optionSource = pgEnum("option_source", OPTION_SOURCES);
export const suggestionStatus = pgEnum(
  "suggestion_status",
  SUGGESTION_STATUSES,
);

// The poll id is the share slug and the access control for public pages
// (unguessable link = permission to vote). 12 chars of [a-z0-9] ≈ 62 bits:
// short enough to paste into a chat, far too many to enumerate.
export const pollSlug = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyz",
  12,
);

const tintList = sql.raw(AVATAR_TINTS.map((t) => `'${t}'`).join(", "));

export const polls = pgTable(
  "polls",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => pollSlug()),
    creatorId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text().notNull(),
    type: pollType().notNull().default("single"),
    maxChoices: smallint().notNull().default(1),
    suggestionsEnabled: boolean().notNull().default(true),
    // Stored status can lag reality: an "open" poll past closesAt is settled.
    // Every read goes through settleIfExpired, which writes the truth back.
    status: pollStatus().notNull().default("open"),
    closesAt: timestamp({ withTimezone: true }).notNull(),
    settledAt: timestamp({ withTimezone: true }),
    settledEarly: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index().on(t.creatorId, t.status, t.closesAt),
    check(
      "polls_title_length",
      sql`char_length(${t.title}) between 1 and ${sql.raw(String(TITLE_MAX))}`,
    ),
    check(
      "polls_max_choices",
      sql`(${t.type} = 'single' and ${t.maxChoices} = 1) or (${t.type} = 'multi' and ${t.maxChoices} >= 2)`,
    ),
    check(
      "polls_settled_consistency",
      sql`(${t.status} = 'open' and ${t.settledAt} is null and not ${t.settledEarly}) or (${t.status} = 'settled' and ${t.settledAt} is not null)`,
    ),
  ],
);

// A suggestion is an option with a status: approving flips the status and
// it's on the ballot with 0 votes. Creator options have no status at all.
export const options = pgTable(
  "options",
  {
    id: uuid().primaryKey().defaultRandom(),
    pollId: text()
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    label: text().notNull(),
    position: smallint().notNull(),
    source: optionSource().notNull(),
    suggestionStatus: suggestionStatus(),
    suggestedByName: text(),
    suggestedByAvatarSeed: text(),
    suggestedByAvatarTint: text(),
    decidedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.pollId, t.position),
    check(
      "options_label_length",
      sql`char_length(${t.label}) between 1 and ${sql.raw(String(OPTION_LABEL_MAX))}`,
    ),
    check(
      "options_source_shape",
      sql`(${t.source} = 'creator'
            and ${t.suggestionStatus} is null
            and ${t.suggestedByName} is null
            and ${t.suggestedByAvatarSeed} is null
            and ${t.suggestedByAvatarTint} is null
            and ${t.decidedAt} is null)
        or (${t.source} = 'suggestion'
            and ${t.suggestionStatus} is not null
            and ${t.suggestedByName} is not null
            and ${t.suggestedByAvatarSeed} is not null
            and ${t.suggestedByAvatarTint} in (${tintList})
            and (${t.suggestionStatus} = 'pending') = (${t.decidedAt} is null))`,
    ),
  ],
);

// One ballot per voter per poll: the unique (pollId, voterToken) constraint
// is what makes casting idempotent and "no takebacks" enforceable.
export const ballots = pgTable(
  "ballots",
  {
    id: uuid().primaryKey().defaultRandom(),
    pollId: text()
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    voterToken: text().notNull(),
    voterName: text().notNull(),
    avatarSeed: text().notNull(),
    avatarTint: text().notNull(),
    castAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("ballots_one_per_voter").on(t.pollId, t.voterToken),
    check(
      "ballots_voter_name_length",
      sql`char_length(${t.voterName}) between 1 and ${sql.raw(String(VOTER_NAME_MAX))}`,
    ),
    check("ballots_avatar_tint", sql`${t.avatarTint} in (${tintList})`),
  ],
);

// One row per chosen option: pick-up-to-N is just N rows on one ballot.
export const votes = pgTable(
  "votes",
  {
    ballotId: uuid()
      .notNull()
      .references(() => ballots.id, { onDelete: "cascade" }),
    optionId: uuid()
      .notNull()
      .references(() => options.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.ballotId, t.optionId] }),
    index().on(t.optionId),
  ],
);

export type Poll = typeof polls.$inferSelect;
export type Option = typeof options.$inferSelect;
export type Ballot = typeof ballots.$inferSelect;
export type Vote = typeof votes.$inferSelect;
