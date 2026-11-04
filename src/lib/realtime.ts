// Shared by the server notifier and the browser subscriber. Events carry no
// data: "this poll changed" is all anyone learns from Pusher, and pages
// refetch through our own server, which decides what each viewer may see.

export const POLL_CHANGED = "changed";

/** The poll id is the share secret already, so the channel can be public. */
export const pollChannel = (pollId: string) => `poll-${pollId}`;

/**
 * How long a page waits before refetching after an event. The base lets a
 * burst of votes coalesce into one refetch; the random spread stops every
 * open page hitting the server on the same tick. Capped so a vote still
 * shows up within a second, leaving the rest for the network and render.
 */
export const refetchDelay = (random = Math.random()) => 250 + random * 350;
