import "server-only";
import { after } from "next/server";
import Pusher from "pusher";
import { POLL_CHANGED, pollChannel } from "@/lib/realtime";

let client: Pusher | null | undefined;

function pusher(): Pusher | null {
  if (client !== undefined) return client;
  const {
    PUSHER_APP_ID: appId,
    PUSHER_SECRET: secret,
    NEXT_PUBLIC_PUSHER_KEY: key,
    NEXT_PUBLIC_PUSHER_CLUSTER: cluster,
  } = process.env;
  // Without Pusher, pages fall back to polling: slower, still correct
  client =
    appId && secret && key && cluster
      ? new Pusher({ appId, secret, key, cluster, useTLS: true })
      : null;
  return client;
}

/**
 * Tells open pages that a poll changed. Runs after the response, so the
 * person who acted never waits on it, and a Pusher outage never fails
 * their vote.
 */
export function notifyPollChanged(pollId: string) {
  after(async () => {
    try {
      await pusher()?.trigger(pollChannel(pollId), POLL_CHANGED, {});
    } catch (error) {
      console.error("Realtime notify failed", error);
    }
  });
}
