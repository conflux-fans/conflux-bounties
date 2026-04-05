jest.mock("@/lib/prisma", () => ({
  prisma: {
    gatedAsset: { findUnique: jest.fn() },
    accessLog: { create: jest.fn().mockResolvedValue({}) },
  },
}));

jest.mock("@/lib/storage/object-storage", () => ({
  isS3StorageConfigured: jest.fn(() => false),
  presignGatedGetUrl: jest.fn(),
}));

jest.mock("@/lib/assets/read-gated-file", () => ({
  readGatedFile: jest.fn(),
}));

import { GET } from "./route";
import { NextRequest } from "next/server";
import { signDownloadToken } from "@/lib/assets/download-token";
import { prisma } from "@/lib/prisma";
import {
  isS3StorageConfigured,
  presignGatedGetUrl,
} from "@/lib/storage/object-storage";
import { readGatedFile } from "@/lib/assets/read-gated-file";

const assetRow = {
  slug: "pack",
  storageKey: "gated/pack.zip",
  sha256: "deadbeef",
  sizeBytes: 5,
  mimeType: "application/zip",
  originalName: "pack.zip",
};

describe("GET /api/assets/download", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (readGatedFile as jest.Mock).mockResolvedValue(Buffer.from("hello"));
    (isS3StorageConfigured as jest.Mock).mockReturnValue(false);
  });

  it("400 without token", async () => {
    const req = new NextRequest("http://localhost/api/assets/download");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("streams local file when S3 not configured", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const t = signDownloadToken({
      slug: "pack",
      wallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      exp,
    });
    (prisma.gatedAsset.findUnique as jest.Mock).mockResolvedValue(assetRow);
    const req = new NextRequest(
      `http://localhost/api/assets/download?t=${encodeURIComponent(t)}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(readGatedFile).toHaveBeenCalled();
  });

  it("302 to presigned URL when remote storage configured", async () => {
    (isS3StorageConfigured as jest.Mock).mockReturnValue(true);
    (presignGatedGetUrl as jest.Mock).mockResolvedValue(
      "https://example.com/signed",
    );
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const t = signDownloadToken({
      slug: "pack",
      wallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      exp,
    });
    (prisma.gatedAsset.findUnique as jest.Mock).mockResolvedValue(assetRow);
    const req = new NextRequest(
      `http://localhost/api/assets/download?t=${encodeURIComponent(t)}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/signed");
  });

  it("502 when presign fails", async () => {
    (isS3StorageConfigured as jest.Mock).mockReturnValue(true);
    (presignGatedGetUrl as jest.Mock).mockRejectedValue(new Error("no"));
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const t = signDownloadToken({
      slug: "pack",
      wallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      exp,
    });
    (prisma.gatedAsset.findUnique as jest.Mock).mockResolvedValue(assetRow);
    const req = new NextRequest(
      `http://localhost/api/assets/download?t=${encodeURIComponent(t)}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(502);
  });
});
