import { getObjectStorageEnv } from "./env";

describe("getObjectStorageEnv", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("prefers R2_* over S3_*", () => {
    process.env.R2_BUCKET = "r2-bucket";
    process.env.R2_ACCESS_KEY_ID = "rk";
    process.env.R2_SECRET_ACCESS_KEY = "rs".repeat(8);
    process.env.S3_BUCKET = "s3-bucket";
    process.env.S3_ACCESS_KEY_ID = "sk";
    process.env.S3_SECRET_ACCESS_KEY = "ss".repeat(8);
    const e = getObjectStorageEnv();
    expect(e?.bucket).toBe("r2-bucket");
    expect(e?.accessKeyId).toBe("rk");
  });

  it("falls back to S3_* when R2_* missing", () => {
    delete process.env.R2_BUCKET;
    process.env.S3_BUCKET = "s3-only";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s".repeat(16);
    const e = getObjectStorageEnv();
    expect(e?.bucket).toBe("s3-only");
  });
});
