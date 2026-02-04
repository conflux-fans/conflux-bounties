import { VerificationService } from "../src/services/verification.service";
import { WebhookService } from "../src/services/webhook.service";
import { IpfsService } from "../src/services/ipfs.service";

// Mock ethers provider
jest.mock("../src/lib/rpc", () => ({
  provider: {
    getCode: jest.fn(),
  },
}));

describe("VerificationService", () => {
  const service = new VerificationService();

  describe("verifyOwnership", () => {
    it("should return false when contract has no owner() function", async () => {
      const result = await service.verifyOwnership(
        "0x" + "1".repeat(40),
        "0x" + "2".repeat(40)
      );
      expect(result).toBe(false);
    });
  });

  describe("getBytecodeHash", () => {
    it("should return null for empty bytecode", async () => {
      const { provider } = require("../src/lib/rpc");
      provider.getCode.mockResolvedValueOnce("0x");

      const result = await service.getBytecodeHash("0x" + "1".repeat(40));
      expect(result).toBeNull();
    });

    it("should return keccak256 hash of bytecode", async () => {
      const { provider } = require("../src/lib/rpc");
      provider.getCode.mockResolvedValueOnce("0x608060405234801561001057600080fd5b50");

      const result = await service.getBytecodeHash("0x" + "1".repeat(40));
      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-f0-9]{64}$/);
    });
  });
});

describe("WebhookService", () => {
  const service = new WebhookService();

  it("should not throw when WEBHOOK_URL is not set", async () => {
    await expect(
      service.notifyApproval("0x" + "1".repeat(40), "QmTest")
    ).resolves.not.toThrow();
  });
});

describe("IpfsService", () => {
  it("should be instantiable", () => {
    const service = new IpfsService();
    expect(service).toBeDefined();
  });
});
