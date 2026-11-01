import { AVATAR_TINTS, VOTER_FACES, type AvatarTint } from "@/domain/rules";

// The voter's name and face, remembered on this device only so their next
// poll is one less step. Nothing here is sent anywhere until they vote.

export type VoterFace = (typeof VOTER_FACES)[number];

export interface VoterIdentity {
  name: string;
  avatarSeed: VoterFace;
  avatarTint: AvatarTint;
}

export interface FaceOption {
  seed: VoterFace;
  /** Pre-rendered on the server; null falls back to an initial. */
  src: string | null;
}

const KEY = "tiebreak:voter";

export function loadIdentity(): Partial<VoterIdentity> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      name: typeof saved.name === "string" ? saved.name : undefined,
      avatarSeed: VOTER_FACES.includes(saved.avatarSeed)
        ? saved.avatarSeed
        : undefined,
      avatarTint: AVATAR_TINTS.includes(saved.avatarTint)
        ? saved.avatarTint
        : undefined,
    };
  } catch {
    return {};
  }
}

export function saveIdentity(identity: VoterIdentity) {
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // Private mode or storage full: remembering is a nicety, not a need
  }
}

/** Set before casting so the next render can greet the voter properly. */
export const justVotedKey = (pollId: string) => `tiebreak:just-voted:${pollId}`;
