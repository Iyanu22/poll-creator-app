// Shared by the server notifier and the browser subscriber. Events carry no
// data: "this poll changed" is all anyone learns from Pusher, and pages
// refetch through our own server, which decides what each viewer may see.

export const POLL_CHANGED = "changed";

/** The poll id is the share secret already, so the channel can be public. */
export const pollChannel = (pollId: string) => `poll-${pollId}`;
