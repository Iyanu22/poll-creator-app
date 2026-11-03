import { Pool, type PoolClient } from "@neondatabase/serverless";
import { retryOnce } from "../lib/retry"; // relative: drizzle-kit doesn't resolve tsconfig paths

type ConnectCallback = (
  err: Error | undefined,
  client: PoolClient | undefined,
  done: (release?: unknown) => void,
) => void;

/**
 * A Neon pool that survives a dropped connection without turning a page
 * into an error screen.
 *
 * Opening a connection gets one quick retry. That's always safe: if opening
 * fails, nothing has reached the database, so even a vote or an insert
 * can't be applied twice. It covers the real-world blips (a network hiccup,
 * Neon's free tier waking from sleep). Failures after a query is sent are
 * not retried; casting stays idempotent for those.
 */
export class ResilientPool extends Pool {
  constructor(config: ConstructorParameters<typeof Pool>[0]) {
    super(config);
    // An idle connection that dies emits "error" on the pool; with no
    // listener that would crash the server. The pool discards it anyway.
    this.on("error", (error: Error) => {
      console.warn("Idle database connection dropped:", error.message);
    });
  }

  override connect(): Promise<PoolClient>;
  override connect(callback: ConnectCallback): void;
  override connect(callback?: ConnectCallback): Promise<PoolClient> | void {
    const opened = retryOnce(() => super.connect(), {
      onRetry: (error) =>
        console.warn(
          "Database connection failed, retrying once:",
          error instanceof Error ? error.message : error,
        ),
    });
    if (!callback) return opened;
    // pg-pool's own query() asks for a connection this way
    opened.then(
      (client) =>
        callback(undefined, client, (release) =>
          client.release(release as boolean),
        ),
      (error: Error) => callback(error, undefined, () => {}),
    );
  }
}
