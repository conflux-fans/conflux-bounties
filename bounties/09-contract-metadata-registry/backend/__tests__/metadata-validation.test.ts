import { metadataSchema, submitRequestSchema } from "../src/types/metadata";

describe("Metadata Schema Validation", () => {
  const validMetadata = {
    name: "Test Contract",
    description: "A test contract for unit testing",
    abi: [{ type: "function", name: "test", inputs: [], outputs: [] }],
    bytecodeHash: "0x" + "a".repeat(64),
    compiler: { name: "solc", version: "0.8.28" },
  };

  it("should accept valid metadata", () => {
    const result = metadataSchema.safeParse(validMetadata);
    expect(result.success).toBe(true);
  });

  it("should accept metadata with optional fields", () => {
    const result = metadataSchema.safeParse({
      ...validMetadata,
      logoUrl: "https://example.com/logo.png",
      website: "https://example.com",
      tags: ["defi", "token"],
      social: {
        twitter: "https://twitter.com/test",
        github: "https://github.com/test",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject metadata without name", () => {
    const { name, ...rest } = validMetadata;
    const result = metadataSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("should reject metadata with empty ABI", () => {
    const result = metadataSchema.safeParse({ ...validMetadata, abi: [] });
    expect(result.success).toBe(false);
  });

  it("should reject name longer than 100 chars", () => {
    const result = metadataSchema.safeParse({
      ...validMetadata,
      name: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("should reject description longer than 2000 chars", () => {
    const result = metadataSchema.safeParse({
      ...validMetadata,
      description: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid bytecodeHash format", () => {
    const result = metadataSchema.safeParse({
      ...validMetadata,
      bytecodeHash: "not-a-hash",
    });
    expect(result.success).toBe(false);
  });

  it("should reject more than 10 tags", () => {
    const result = metadataSchema.safeParse({
      ...validMetadata,
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("should reject tags longer than 30 chars", () => {
    const result = metadataSchema.safeParse({
      ...validMetadata,
      tags: ["a".repeat(31)],
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid logoUrl", () => {
    const result = metadataSchema.safeParse({
      ...validMetadata,
      logoUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

describe("Submit Request Schema", () => {
  it("should accept valid submit request", () => {
    const result = submitRequestSchema.safeParse({
      contractAddress: "0x" + "a".repeat(40),
      metadata: {
        name: "Test",
        description: "Test",
        abi: [{ type: "function", name: "test", inputs: [], outputs: [] }],
        bytecodeHash: "0x" + "b".repeat(64),
        compiler: { name: "solc", version: "0.8.28" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid contract address", () => {
    const result = submitRequestSchema.safeParse({
      contractAddress: "invalid",
      metadata: {
        name: "Test",
        description: "Test",
        abi: [{}],
        bytecodeHash: "0x" + "b".repeat(64),
        compiler: { name: "solc", version: "0.8.28" },
      },
    });
    expect(result.success).toBe(false);
  });
});
