import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FixedWindowLimiter } from "../rate-limiter";

describe("FixedWindowLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("tryConsume", () => {
    it("allows exactly `max` calls in a window, then denies", () => {
      const limiter = new FixedWindowLimiter(5, 60_000);

      for (let i = 0; i < 5; i++) {
        expect(limiter.tryConsume("a")).toBe(true);
      }
      expect(limiter.tryConsume("a")).toBe(false);
    });

    it("does not consume allowance once the caller is over the limit", () => {
      const limiter = new FixedWindowLimiter(1, 60_000);
      limiter.tryConsume("a");

      // Hammering a denied key must not push its reset further out; the
      // window has to expire on schedule or a blocked caller never recovers.
      for (let i = 0; i < 10; i++) expect(limiter.tryConsume("a")).toBe(false);

      vi.advanceTimersByTime(60_001);
      expect(limiter.tryConsume("a")).toBe(true);
    });

    it("keeps separate allowances per key", () => {
      const limiter = new FixedWindowLimiter(1, 60_000);

      expect(limiter.tryConsume("a")).toBe(true);
      expect(limiter.tryConsume("b")).toBe(true);
      expect(limiter.tryConsume("a")).toBe(false);
      expect(limiter.tryConsume("b")).toBe(false);
    });

    it("refills after the window elapses", () => {
      const limiter = new FixedWindowLimiter(2, 60_000);
      limiter.tryConsume("a");
      limiter.tryConsume("a");
      expect(limiter.tryConsume("a")).toBe(false);

      vi.advanceTimersByTime(59_999);
      expect(limiter.tryConsume("a")).toBe(false);

      vi.advanceTimersByTime(2);
      expect(limiter.tryConsume("a")).toBe(true);
    });
  });

  describe("isLimited / record", () => {
    it("reports limited only once `max` hits are recorded", () => {
      const limiter = new FixedWindowLimiter(3, 60_000);

      expect(limiter.isLimited("a")).toBe(false);
      limiter.record("a");
      limiter.record("a");
      expect(limiter.isLimited("a")).toBe(false);
      limiter.record("a");
      expect(limiter.isLimited("a")).toBe(true);
    });

    it("isLimited does not itself consume allowance", () => {
      const limiter = new FixedWindowLimiter(1, 60_000);

      expect(limiter.isLimited("a")).toBe(false);
      expect(limiter.isLimited("a")).toBe(false);
      expect(limiter.tryConsume("a")).toBe(true);
    });

    it("starts a fresh window rather than resurrecting an expired one", () => {
      const limiter = new FixedWindowLimiter(2, 60_000);
      limiter.record("a");
      limiter.record("a");
      expect(limiter.isLimited("a")).toBe(true);

      vi.advanceTimersByTime(60_001);
      limiter.record("a");
      expect(limiter.isLimited("a")).toBe(false);
    });
  });

  it("prunes expired buckets instead of growing without bound", () => {
    const limiter = new FixedWindowLimiter(1, 60_000);

    // Fill past the prune threshold with keys that will all go stale.
    for (let i = 0; i < 1000; i++) limiter.record(`old-${i}`);
    vi.advanceTimersByTime(60_001);

    // The next write is what triggers the sweep.
    limiter.record("fresh");

    const buckets = (limiter as unknown as { buckets: Map<string, unknown> })
      .buckets;
    expect(buckets.size).toBe(1);
    expect(buckets.has("fresh")).toBe(true);
  });

  it("keeps live buckets when pruning", () => {
    const limiter = new FixedWindowLimiter(1, 60_000);

    for (let i = 0; i < 999; i++) limiter.record(`old-${i}`);
    vi.advanceTimersByTime(30_000);
    limiter.record("half-way"); // still live when the sweep runs
    vi.advanceTimersByTime(30_001); // the 999 are now stale, "half-way" is not

    limiter.record("fresh");

    const buckets = (limiter as unknown as { buckets: Map<string, unknown> })
      .buckets;
    expect(buckets.has("half-way")).toBe(true);
    expect(buckets.has("fresh")).toBe(true);
    expect(buckets.size).toBe(2);
  });
});
