import { getChainById, appChains } from "./chains";

describe("chains", () => {
  it("resolves Conflux eSpace by id", () => {
    const c = getChainById(1030);
    expect(c?.id).toBe(1030);
  });

  it("returns undefined for unknown chain", () => {
    expect(getChainById(999999)).toBeUndefined();
  });

  it("appChains includes mainnet and testnet", () => {
    const ids = appChains.map((c) => c.id).sort((a, b) => a - b);
    expect(ids).toEqual([71, 1030]);
  });
});
