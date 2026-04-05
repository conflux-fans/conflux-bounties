import { getStorageMode, isS3StorageConfigured } from "./config";

describe("storage config", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("defaults to local", () => {
    delete process.env.STORAGE_MODE;
    expect(getStorageMode()).toBe("local");
  });

  it("detects s3 mode", () => {
    process.env.STORAGE_MODE = "s3";
    expect(getStorageMode()).toBe("s3");
  });

  it("treats r2 mode as remote (S3-compatible)", () => {
    process.env.STORAGE_MODE = "r2";
    process.env.R2_BUCKET = "b";
    process.env.R2_ACCESS_KEY_ID = "k";
    process.env.R2_SECRET_ACCESS_KEY = "secretsecretsecretsecret";
    expect(getStorageMode()).toBe("s3");
    expect(isS3StorageConfigured()).toBe(true);
  });

  it("isS3StorageConfigured false without credentials", () => {
    process.env.STORAGE_MODE = "s3";
    process.env.S3_BUCKET = "";
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    expect(isS3StorageConfigured()).toBe(false);
  });

  it("isS3StorageConfigured true when S3_* env complete", () => {
    process.env.STORAGE_MODE = "s3";
    process.env.S3_BUCKET = "bucket";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";
    expect(isS3StorageConfigured()).toBe(true);
  });
});
