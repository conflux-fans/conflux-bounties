export interface SpendState {
  totalSpent: string;
  dailySpent: string;
  txCount: number;
  dailyResetAt: number;
}

export class SpendTracker {
  private totalSpent = 0n;
  private dailySpent = 0n;
  private spendCap: bigint;
  private dailyBudget: bigint;
  private dailyResetAt: number;
  private txCount = 0;

  constructor(spendCap: string, dailyBudget: string, restored?: SpendState) {
    this.spendCap = BigInt(spendCap);
    this.dailyBudget = BigInt(dailyBudget);
    this.dailyResetAt = this.nextMidnight();

    if (restored) {
      this.totalSpent = BigInt(restored.totalSpent);
      this.txCount = restored.txCount;
      // Only restore daily spend if the reset time hasn't passed
      if (Date.now() < restored.dailyResetAt) {
        this.dailySpent = BigInt(restored.dailySpent);
        this.dailyResetAt = restored.dailyResetAt;
      }
    }
  }

  getState(): SpendState {
    return {
      totalSpent: this.totalSpent.toString(),
      dailySpent: this.dailySpent.toString(),
      txCount: this.txCount,
      dailyResetAt: this.dailyResetAt,
    };
  }

  canSpend(amount: bigint): boolean {
    this.maybeResetDaily();
    return (
      this.totalSpent + amount <= this.spendCap &&
      this.dailySpent + amount <= this.dailyBudget
    );
  }

  recordSpend(amount: bigint) {
    this.maybeResetDaily();
    this.totalSpent += amount;
    this.dailySpent += amount;
    this.txCount++;
  }

  getSummary() {
    this.maybeResetDaily();
    return {
      totalSpent: this.totalSpent.toString(),
      dailySpent: this.dailySpent.toString(),
      remainingCap: (this.spendCap - this.totalSpent).toString(),
      remainingDaily: (this.dailyBudget - this.dailySpent).toString(),
      txCount: this.txCount,
    };
  }

  private maybeResetDaily() {
    if (Date.now() >= this.dailyResetAt) {
      this.dailySpent = 0n;
      this.dailyResetAt = this.nextMidnight();
    }
  }

  private nextMidnight(): number {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }
}
