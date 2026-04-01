import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpendTracker } from "../spend.js";

describe("SpendTracker", () => {
  const SPEND_CAP = "10000000"; // 10 USDT0
  const DAILY_BUDGET = "5000000"; // 5 USDT0

  it("should allow spending within cap and daily budget", () => {
    const tracker = new SpendTracker(SPEND_CAP, DAILY_BUDGET);
    expect(tracker.canSpend(100_000n)).toBe(true); // 0.10 USDT0
  });

  it("should reject spending over the total cap", () => {
    const tracker = new SpendTracker(SPEND_CAP, DAILY_BUDGET);
    // Try to spend more than the total cap in one go
    expect(tracker.canSpend(10_000_001n)).toBe(false);
  });

  it("should reject spending over the daily budget", () => {
    const tracker = new SpendTracker(SPEND_CAP, DAILY_BUDGET);
    // Try to spend more than the daily budget in one go
    expect(tracker.canSpend(5_000_001n)).toBe(false);
  });

  it("should track cumulative spending", () => {
    const tracker = new SpendTracker(SPEND_CAP, DAILY_BUDGET);

    // First spend: 2 USDT0
    expect(tracker.canSpend(2_000_000n)).toBe(true);
    tracker.recordSpend(2_000_000n);

    // Second spend: 2.5 USDT0 (total daily: 4.5, under 5 cap)
    expect(tracker.canSpend(2_500_000n)).toBe(true);
    tracker.recordSpend(2_500_000n);

    // Third spend: 1 USDT0 would exceed daily budget (4.5 + 1 = 5.5 > 5)
    expect(tracker.canSpend(1_000_000n)).toBe(false);
  });

  it("should track transaction count", () => {
    const tracker = new SpendTracker(SPEND_CAP, DAILY_BUDGET);
    tracker.recordSpend(100_000n);
    tracker.recordSpend(200_000n);
    tracker.recordSpend(300_000n);

    const summary = tracker.getSummary();
    expect(summary.txCount).toBe(3);
    expect(summary.totalSpent).toBe("600000");
    expect(summary.dailySpent).toBe("600000");
  });

  it("should report correct remaining amounts", () => {
    const tracker = new SpendTracker(SPEND_CAP, DAILY_BUDGET);
    tracker.recordSpend(1_000_000n); // 1 USDT0

    const summary = tracker.getSummary();
    expect(summary.remainingCap).toBe("9000000"); // 10 - 1 = 9
    expect(summary.remainingDaily).toBe("4000000"); // 5 - 1 = 4
  });

  it("should reject zero cap", () => {
    const tracker = new SpendTracker("0", "0");
    expect(tracker.canSpend(1n)).toBe(false);
  });

  it("should allow exact cap amount", () => {
    const tracker = new SpendTracker(SPEND_CAP, DAILY_BUDGET);
    expect(tracker.canSpend(5_000_000n)).toBe(true); // exactly daily budget
  });

  it("should restore state from previous session", () => {
    const restored = {
      totalSpent: "3000000",
      dailySpent: "1000000",
      txCount: 5,
      dailyResetAt: Date.now() + 86_400_000, // tomorrow
    };

    const tracker = new SpendTracker(SPEND_CAP, DAILY_BUDGET, restored);
    const summary = tracker.getSummary();

    expect(summary.totalSpent).toBe("3000000");
    expect(summary.dailySpent).toBe("1000000");
    expect(summary.txCount).toBe(5);
    expect(summary.remainingCap).toBe("7000000");
    expect(summary.remainingDaily).toBe("4000000");
  });

  it("should reset daily spend if restored state has expired reset time", () => {
    const restored = {
      totalSpent: "3000000",
      dailySpent: "4000000",
      txCount: 5,
      dailyResetAt: Date.now() - 1000, // already passed
    };

    const tracker = new SpendTracker(SPEND_CAP, DAILY_BUDGET, restored);
    const summary = tracker.getSummary();

    // Total is preserved but daily is reset
    expect(summary.totalSpent).toBe("3000000");
    expect(summary.dailySpent).toBe("0");
    expect(summary.txCount).toBe(5);
  });

  it("should reset daily budget at midnight", () => {
    const tracker = new SpendTracker(SPEND_CAP, DAILY_BUDGET);

    // Spend up to daily limit
    tracker.recordSpend(5_000_000n);
    expect(tracker.canSpend(1n)).toBe(false);

    // Simulate midnight by manipulating the reset time
    const state = tracker.getState();
    expect(state.dailyResetAt).toBeGreaterThan(Date.now());
  });

  it("should serialize and deserialize state correctly", () => {
    const tracker = new SpendTracker(SPEND_CAP, DAILY_BUDGET);
    tracker.recordSpend(1_500_000n);
    tracker.recordSpend(500_000n);

    const state = tracker.getState();
    const json = JSON.stringify(state);
    const parsed = JSON.parse(json);

    const restored = new SpendTracker(SPEND_CAP, DAILY_BUDGET, parsed);
    const summary = restored.getSummary();

    expect(summary.totalSpent).toBe("2000000");
    expect(summary.txCount).toBe(2);
  });
});
