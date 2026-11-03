import { Pool } from "@neondatabase/serverless";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResilientPool } from "./resilient-pool";

// No network: the parent class's connection opening is stubbed, so these
// check the wiring (both ways the pool hands out connections), not Neon.

function fakeClient() {
  return {
    query: vi.fn((...args: unknown[]) => {
      const result = { rows: [{ ok: 1 }], rowCount: 1, fields: [] };
      const callback = args.find((a) => typeof a === "function") as
        ((err: undefined, res: typeof result) => void) | undefined;
      if (callback) return void callback(undefined, result);
      return Promise.resolve(result);
    }),
    release: vi.fn(),
    // pg-pool's query() listens for errors on the connection it borrows
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
  };
}

const newPool = () =>
  new ResilientPool({ connectionString: "postgres://u:p@localhost:5432/db" });

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("ResilientPool", () => {
  it("retries a failed connection open once (transactions use this path)", async () => {
    const client = fakeClient();
    const open = vi
      .spyOn(Pool.prototype, "connect")
      .mockRejectedValueOnce(new Error("WebSocket closed"))
      .mockResolvedValueOnce(client as never);

    await expect(newPool().connect()).resolves.toBe(client);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("covers pool.query too, which opens connections internally", async () => {
    const client = fakeClient();
    const open = vi
      .spyOn(Pool.prototype, "connect")
      .mockRejectedValueOnce(new Error("WebSocket closed"))
      .mockResolvedValueOnce(client as never);

    const result = await newPool().query("select 1 as ok");
    expect(result.rows).toEqual([{ ok: 1 }]);
    expect(open).toHaveBeenCalledTimes(2);
    expect(client.release).toHaveBeenCalled();
  });

  it("surfaces the error if the retry fails too", async () => {
    vi.spyOn(Pool.prototype, "connect")
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("still down"));

    await expect(newPool().connect()).rejects.toThrow("still down");
  });
});
