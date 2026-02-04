import { ConfluxCoreClient } from "./ConfluxCoreClient";

/** Helper to build a valid JSON-RPC response */
function rpcOk(result: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: "2.0" as const, id: 1, result }),
  };
}

function rpcErr(code: number, message: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      jsonrpc: "2.0" as const,
      id: 1,
      error: { code, message },
    }),
  };
}

function httpErr(status: number) {
  return {
    ok: false,
    status,
    statusText: "Internal Server Error",
    json: async () => ({}),
  };
}

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("ConfluxCoreClient", () => {
  const url = "https://main.confluxrpc.com";
  let client: ConfluxCoreClient;

  beforeEach(() => {
    client = new ConfluxCoreClient(url);
  });

  describe("getBlockHeight", () => {
    it("returns the epoch number as a decimal integer", async () => {
      const status = {
        bestHash: "0xabc",
        blockNumber: "0x100",
        chainId: "0x1",
        epochNumber: "0x2faf080", // 50_000_000
        latestCheckpoint: "0x0",
        latestConfirmed: "0x2faf07e",
        latestFinalized: "0x2faf07d",
        latestState: "0x2faf080",
        networkId: "0x1",
        pendingTxNumber: "0xa",
      };

      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk(status) as never);

      const height = await client.getBlockHeight();
      expect(height).toBe(50_000_000);
    });
  });

  describe("getSyncLag", () => {
    it("returns 0 when epochNumber equals latestFinalized", async () => {
      const status = {
        bestHash: "0xabc",
        blockNumber: "0x100",
        chainId: "0x1",
        epochNumber: "0x64",
        latestCheckpoint: "0x0",
        latestConfirmed: "0x63",
        latestFinalized: "0x64",
        latestState: "0x64",
        networkId: "0x1",
        pendingTxNumber: "0x0",
      };

      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk(status) as never);

      expect(await client.getSyncLag()).toBe(0);
    });

    it("returns positive lag when epochNumber > latestFinalized", async () => {
      const status = {
        bestHash: "0xabc",
        blockNumber: "0x100",
        chainId: "0x1",
        epochNumber: "0x6e", // 110
        latestCheckpoint: "0x0",
        latestConfirmed: "0x63",
        latestFinalized: "0x64", // 100
        latestState: "0x6e",
        networkId: "0x1",
        pendingTxNumber: "0x0",
      };

      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk(status) as never);

      expect(await client.getSyncLag()).toBe(10);
    });
  });

  describe("getGasPrice", () => {
    it("returns gas price as bigint", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk("0x3b9aca00") as never); // 1_000_000_000

      const gas = await client.getGasPrice();
      expect(gas).toBe(BigInt(1_000_000_000));
    });
  });

  describe("getPendingTxCount", () => {
    it("parses pendingTxNumber from cfx_getStatus", async () => {
      const status = {
        bestHash: "0xabc",
        blockNumber: "0x100",
        chainId: "0x1",
        epochNumber: "0x64",
        latestCheckpoint: "0x0",
        latestConfirmed: "0x63",
        latestFinalized: "0x64",
        latestState: "0x64",
        networkId: "0x1",
        pendingTxNumber: "0x1f4", // 500
      };

      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk(status) as never);

      expect(await client.getPendingTxCount()).toBe(500);
    });
  });

  describe("getLatestBlock", () => {
    it("parses block data from cfx_getBlockByEpochNumber", async () => {
      const block = {
        epochNumber: "0x64",
        blockNumber: "0xc8",
        hash: "0xdeadbeef",
        parentHash: "0xcafebabe",
        timestamp: "0x60000000",
        miner: "0x0000",
        gasLimit: "0x1312d00",
        gasUsed: "0x5208",
        size: "0x200",
        transactionsRoot: "0x0000",
        transactions: ["0xtx1", "0xtx2", "0xtx3"],
      };

      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk(block) as never);

      const result = await client.getLatestBlock();
      expect(result.height).toBe(100);
      expect(result.hash).toBe("0xdeadbeef");
      expect(result.txCount).toBe(3);
      expect(result.gasUsed).toBe(21000);
    });
  });

  describe("measureLatency", () => {
    it("returns a positive number in ms", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcOk("0x64") as never);

      const latency = await client.measureLatency();
      expect(typeof latency).toBe("number");
      expect(latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe("error handling", () => {
    it("throws on HTTP errors", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(httpErr(500) as never);

      await expect(client.getBlockHeight()).rejects.toThrow("HTTP 500");
    });

    it("throws on RPC errors", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(rpcErr(-32600, "Invalid Request") as never);

      await expect(client.getGasPrice()).rejects.toThrow(
        "RPC error -32600: Invalid Request"
      );
    });
  });
});
