import { RpcClientFactory } from "./RpcClientFactory";
import { ConfluxCoreClient } from "./ConfluxCoreClient";
import { ConfluxESpaceClient } from "./ConfluxESpaceClient";

describe("RpcClientFactory", () => {
  let factory: RpcClientFactory;

  beforeEach(() => {
    factory = new RpcClientFactory();
  });

  it("returns a ConfluxCoreClient for space type 'core'", () => {
    const client = factory.getClient("https://main.confluxrpc.com", "core");
    expect(client).toBeInstanceOf(ConfluxCoreClient);
    expect(client.rpcUrl).toBe("https://main.confluxrpc.com");
  });

  it("returns a ConfluxESpaceClient for space type 'espace'", () => {
    const client = factory.getClient("https://evm.confluxrpc.com", "espace");
    expect(client).toBeInstanceOf(ConfluxESpaceClient);
    expect(client.rpcUrl).toBe("https://evm.confluxrpc.com");
  });

  it("caches clients by URL + space type", () => {
    const a = factory.getClient("https://main.confluxrpc.com", "core");
    const b = factory.getClient("https://main.confluxrpc.com", "core");
    expect(a).toBe(b);
  });

  it("creates separate clients for different space types on the same URL", () => {
    const core = factory.getClient("https://example.com", "core");
    const espace = factory.getClient("https://example.com", "espace");
    expect(core).not.toBe(espace);
    expect(core).toBeInstanceOf(ConfluxCoreClient);
    expect(espace).toBeInstanceOf(ConfluxESpaceClient);
  });

  it("throws for unknown space types", () => {
    expect(() =>
      factory.getClient("https://example.com", "unknown" as never)
    ).toThrow("Unknown space type");
  });

  it("clears the cache", () => {
    const a = factory.getClient("https://main.confluxrpc.com", "core");
    factory.clear();
    const b = factory.getClient("https://main.confluxrpc.com", "core");
    expect(a).not.toBe(b);
  });
});
