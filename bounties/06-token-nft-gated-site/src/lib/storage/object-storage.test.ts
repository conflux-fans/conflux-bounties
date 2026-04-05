import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

jest.mock("@aws-sdk/client-s3");
jest.mock("@aws-sdk/s3-request-presigner");

import {
  deleteGatedObject,
  putGatedObject,
  presignGatedGetUrl,
  resetS3ClientForTests,
} from "./object-storage";

describe("object-storage (S3)", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    resetS3ClientForTests();
    jest.clearAllMocks();
    process.env.STORAGE_MODE = "s3";
    process.env.S3_BUCKET = "b";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "secretsecretsecretsecret";
    process.env.S3_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.S3_FORCE_PATH_STYLE = "true";

    (S3Client as unknown as jest.Mock).mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({}),
    }));
    (getSignedUrl as jest.Mock).mockResolvedValue("https://signed.example/get");
  });

  afterEach(() => {
    process.env = { ...prev };
    resetS3ClientForTests();
  });

  it("putGatedObject sends PutObject", async () => {
    const send = jest.fn().mockResolvedValue({});
    (S3Client as unknown as jest.Mock).mockImplementation(() => ({ send }));

    await putGatedObject("k1", Buffer.from("x"), "text/plain");

    expect(send).toHaveBeenCalled();
    const cmd = send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutObjectCommand);
  });

  it("deleteGatedObject sends DeleteObject", async () => {
    const send = jest.fn().mockResolvedValue({});
    (S3Client as unknown as jest.Mock).mockImplementation(() => ({ send }));

    await deleteGatedObject("k1");

    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it("presignGatedGetUrl returns signed URL", async () => {
    const send = jest.fn().mockResolvedValue({});
    (S3Client as unknown as jest.Mock).mockImplementation(() => ({ send }));

    const url = await presignGatedGetUrl("k1", {
      expiresInSec: 60,
      filename: "a.pdf",
    });
    expect(url).toBe("https://signed.example/get");
    expect(getSignedUrl).toHaveBeenCalled();
  });
});
