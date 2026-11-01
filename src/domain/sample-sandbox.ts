import { z } from "zod";
import samplePolls from "../../data/sample-polls.json";
import {
  AVATAR_TINTS,
  OPTION_SOURCES,
  POLL_STATUSES,
  POLL_TYPES,
  type AvatarTint,
  type OptionSource,
  type PollStatus,
  type PollType,
  type SuggestionStatus,
} from "./rules";

// Turns data/sample-polls.json into rows for one guest's sandbox: fresh ids,
// and every timestamp shifted so the data's "now" lands on the guest's now.
// Pure, so the seeding is testable without a database.

/** The moment the sample data was written as if it were "now" (data/README). */
export const SAMPLE_NOW = new Date("2026-09-17T15:00:00Z");

const timestamp = z.iso.datetime().transform((s) => new Date(s));
const person = z.object({
  name: z.string(),
  avatar: z.object({ seed: z.string(), tint: z.enum(AVATAR_TINTS) }),
});

const sampleSchema = z.object({
  creator: person,
  polls: z.array(
    z.object({
      title: z.string(),
      type: z.enum(POLL_TYPES),
      maxChoices: z.number().int(),
      suggestionsEnabled: z.boolean(),
      status: z.enum(POLL_STATUSES),
      createdAt: timestamp,
      closesAt: timestamp,
      settledAt: timestamp.nullable(),
      options: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          source: z.enum(OPTION_SOURCES),
          suggestionStatus: z.enum(["approved", "pending"]).optional(),
          suggestedBy: person.optional(),
        }),
      ),
      votes: z.array(
        z.object({
          optionId: z.string(),
          voter: person,
          voterToken: z.string(),
          castAt: timestamp,
        }),
      ),
    }),
  ),
});

// Parsed once at load: a malformed sample file fails loudly, not mid-seed.
const sample = sampleSchema.parse(samplePolls);

export const SAMPLE_CREATOR = sample.creator;

export interface SandboxPoll {
  id: string;
  creatorId: string;
  title: string;
  type: PollType;
  maxChoices: number;
  suggestionsEnabled: boolean;
  status: PollStatus;
  closesAt: Date;
  settledAt: Date | null;
  settledEarly: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SandboxOption {
  id: string;
  pollId: string;
  label: string;
  position: number;
  source: OptionSource;
  suggestionStatus: SuggestionStatus | null;
  suggestedByName: string | null;
  suggestedByAvatarSeed: string | null;
  suggestedByAvatarTint: AvatarTint | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export interface SandboxBallot {
  id: string;
  pollId: string;
  voterToken: string;
  voterName: string;
  avatarSeed: string;
  avatarTint: AvatarTint;
  castAt: Date;
}

export interface SandboxRows {
  polls: SandboxPoll[];
  options: SandboxOption[];
  ballots: SandboxBallot[];
  votes: { ballotId: string; optionId: string }[];
}

const midpoint = (a: Date, b: Date) =>
  new Date((a.getTime() + b.getTime()) / 2);

export function buildSandbox({
  creatorId,
  now,
  newPollId,
  newUuid,
}: {
  creatorId: string;
  now: Date;
  newPollId: () => string;
  newUuid: () => string;
}): SandboxRows {
  const offset = now.getTime() - SAMPLE_NOW.getTime();
  const shift = (d: Date) => new Date(d.getTime() + offset);
  const rows: SandboxRows = { polls: [], options: [], ballots: [], votes: [] };

  for (const poll of sample.polls) {
    const pollId = newPollId();
    const castTimes = poll.votes.map((v) => v.castAt.getTime());
    const lastActivity = castTimes.length
      ? new Date(Math.max(...castTimes))
      : poll.createdAt;

    rows.polls.push({
      id: pollId,
      creatorId,
      title: poll.title,
      type: poll.type,
      maxChoices: poll.maxChoices,
      suggestionsEnabled: poll.suggestionsEnabled,
      status: poll.status,
      closesAt: shift(poll.closesAt),
      settledAt: poll.settledAt && shift(poll.settledAt),
      settledEarly: poll.settledAt !== null && poll.settledAt < poll.closesAt,
      createdAt: shift(poll.createdAt),
      updatedAt: shift(poll.settledAt ?? lastActivity),
    });

    // Sample option ids ("detroit") are only meaningful within the file
    const optionIds = new Map<string, string>();
    poll.options.forEach((option, position) => {
      const id = newUuid();
      optionIds.set(option.id, id);

      // The sample has no suggestion timestamps. Approved ones are placed
      // before their first vote; pending ones arrive after the last vote.
      let createdAt = poll.createdAt;
      let decidedAt: Date | null = null;
      if (option.suggestionStatus === "approved") {
        const firstVote = poll.votes
          .filter((v) => v.optionId === option.id)
          .map((v) => v.castAt)
          .sort((a, b) => a.getTime() - b.getTime())[0];
        decidedAt = midpoint(
          poll.createdAt,
          firstVote ?? poll.settledAt ?? SAMPLE_NOW,
        );
        createdAt = midpoint(poll.createdAt, decidedAt);
      } else if (option.suggestionStatus === "pending") {
        createdAt = midpoint(lastActivity, SAMPLE_NOW);
      }

      rows.options.push({
        id,
        pollId,
        label: option.label,
        position,
        source: option.source,
        suggestionStatus: option.suggestionStatus ?? null,
        suggestedByName: option.suggestedBy?.name ?? null,
        suggestedByAvatarSeed: option.suggestedBy?.avatar.seed ?? null,
        suggestedByAvatarTint: option.suggestedBy?.avatar.tint ?? null,
        decidedAt: decidedAt && shift(decidedAt),
        createdAt: shift(createdAt),
      });
    });

    // The sample has one row per vote; a multi-choice voter is several rows
    // sharing a voterToken, so group them into one ballot.
    const ballotIds = new Map<string, string>();
    for (const vote of poll.votes) {
      let ballotId = ballotIds.get(vote.voterToken);
      if (!ballotId) {
        ballotId = newUuid();
        ballotIds.set(vote.voterToken, ballotId);
        rows.ballots.push({
          id: ballotId,
          pollId,
          voterToken: vote.voterToken,
          voterName: vote.voter.name,
          avatarSeed: vote.voter.avatar.seed,
          avatarTint: vote.voter.avatar.tint,
          castAt: shift(vote.castAt),
        });
      }
      const optionId = optionIds.get(vote.optionId);
      if (!optionId) {
        throw new Error(
          `Sample vote references unknown option ${vote.optionId}`,
        );
      }
      rows.votes.push({ ballotId, optionId });
    }
  }

  return rows;
}
