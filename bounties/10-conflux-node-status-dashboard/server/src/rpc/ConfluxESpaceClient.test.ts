import { ConfluxESpaceClient } from "./ConfluxESpaceClient";

function rpcOk(result: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: "2.0" as const, id: 1, result }),
  };
}

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("ConfluxESpaceClient", () => {
  const url = "https://evm.confluxrpc.com";
  let client: ConfluxESpaceClient;

  beforeEach(() => {
    client = new ConfluxESpaceClient(url);
  });

  describe("getBlockHeight", () => {
    it("converts hex block number to decimal", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk("0x2faf080") as never);

      expect(await client.getBlockHeight()).toBe(50_000_000);
    });
  });

  describe("getSyncLag", () => {
    it("returns 0 when eth_syncing returns false", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk(false) as never);

      expect(await client.getSyncLag()).toBe(0);
    });

    it("returns lag when syncing", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        rpcOk({
          startingBlock: "0x0",
          currentBlock: "0x64", // 100
          highestBlock: "0x6e", // 110
        }) as never
      );

      expect(await client.getSyncLag()).toBe(10);
    });
  });

  describe("getGasPrice", () => {
    it("returns gas price as bigint", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk("0x3b9aca00") as never);

      expect(await client.getGasPrice()).toBe(BigInt(1_000_000_000));
    });
  });

  describe("getPeerCount", () => {
    it("converts hex peer count to decimal", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk("0x19") as never); // 25

      expect(await client.getPeerCount()).toBe(25);
    });
  });

  describe("getPendingTxCount", () => {
    it("sums pending + queued from txpool_status", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        rpcOk({
          pending: "0xa", // 10
          queued: "0x5", // 5
        }) as never
      );

      expect(await client.getPendingTxCount()).toBe(15);
    });

    it("returns 0 when txpool_status is unavailable", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new Error("not supported"));

      expect(await client.getPendingTxCount()).toBe(0);
    });
  });

  describe("getLatestBlock", () => {
    it("parses block data from eth_getBlockByNumber", async () => {
      const block = {
        number: "0xc8",
        hash: "0xdeadbeef",
        parentHash: "0xcafebabe",
        timestamp: "0x60000000",
        miner: "0x0000",
        gasLimit: "0x1312d00",
        gasUsed: "0x5208",
        size: "0x200",
        transactions: ["0xtx1"],
      };

      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk(block) as never);

      const result = await client.getLatestBlock();
      expect(result.height).toBe(200);
      expect(result.hash).toBe("0xdeadbeef");
      expect(result.txCount).toBe(1);
      expect(result.gasUsed).toBe(21000);
      expect(result.gasLimit).toBe(20_000_000);
    });
  });

  describe("measureLatency", () => {
    it("returns a non-negative number", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk("0x64") as never);

      const latency = await client.measureLatency();
      expect(latency).toBeGreaterThanOrEqual(0);
    });
  });
});
