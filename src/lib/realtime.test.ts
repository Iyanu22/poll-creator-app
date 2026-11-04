import { describe, expect, it } from "vitest";
import { refetchDelay } from "./realtime";

describe("refetchDelay", () => {
  it("spreads open pages' refetches out instead of one tick", () => {
    expect(refetchDelay(0)).not.toBe(refetchDelay(0.5));
    expect(refetchDelay(0.5)).not.toBe(refetchDelay(0.99));
  });

  it("still coalesces a burst, and stays inside the 1s push budget", () => {
    for (const random of [0, 0.25, 0.5, 0.75, 0.999999]) {
      const delay = refetchDelay(random);
      expect(delay).toBeGreaterThanOrEqual(250);
      // The rest of the second is the network and the render
      expect(delay).toBeLessThanOrEqual(600);
    }
  });
});
