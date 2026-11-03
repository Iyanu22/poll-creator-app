import { describe, expect, it, vi } from "vitest";
import { retryOnce } from "./retry";

describe("retryOnce", () => {
  it("returns the first result when it works", async () => {
    const attempt = vi.fn().mockResolvedValue("ok");
    await expect(retryOnce(attempt, { delayMs: 0 })).resolves.toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("tries exactly once more after a failure", async () => {
    const onRetry = vi.fn();
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce("ok");
    await expect(retryOnce(attempt, { delayMs: 0, onRetry })).resolves.toBe(
      "ok",
    );
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(new Error("blip"));
  });

  it("gives up with the second error", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"));
    await expect(retryOnce(attempt, { delayMs: 0 })).rejects.toThrow("second");
    expect(attempt).toHaveBeenCalledTimes(2);
  });
});
