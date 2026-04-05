import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Minimal valid PDF (single page) as base64 — opens in common viewers. */
const SAMPLE_PDF_B64 =
  "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCAyMDAgMjAwXS9Db250ZW50cyA0IDAgUj4+CmVuZG9iago0IDAgb2JqCjw8L0xlbmd0aCA0ND4+CnN0cmVhbQpCVAovRjEgMTIgVGYKNjggNzAgVGQKKERlbW8pIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjIxIDAwMDAwIG4gCnRyYWlsZXIKPDwvUm9vdCAxIDAgUi9TaXplIDU+PgpzdGFydHhyZWYKMjk2CiUlRU9G";

function defaultRulesJson() {
  const raw = process.env.DEFAULT_RULES_JSON?.trim();
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (j && Array.isArray(j.conditions) && j.conditions.length > 0) {
        return j;
      }
    } catch (e) {
      console.warn("DEFAULT_RULES_JSON invalid, using built-in default:", e.message);
    }
  }
  return {
    conditions: [
      {
        type: "ERC20",
        chainId: 1030,
        address: "0x0000000000000000000000000000000000000001",
        minBalance: "1",
      },
    ],
  };
}

async function seedRules() {
  const existing = await prisma.gatingRule.count();
  if (existing > 0) {
    console.log("GatingRule rows already exist; skip rule seed.");
    return;
  }

  const rulesJson = defaultRulesJson();

  await prisma.gatingRule.createMany({
    data: [
      {
        name: "Members area",
        pathPattern: "/members",
        combineLogic: "ALL",
        rulesJson,
        sortOrder: 0,
        enabled: true,
      },
      {
        name: "Resources subtree",
        pathPattern: "/resources/*",
        combineLogic: "ALL",
        rulesJson,
        sortOrder: 1,
        enabled: true,
      },
      {
        name: "Protected API",
        pathPattern: "/api/protected/*",
        combineLogic: "ALL",
        rulesJson,
        sortOrder: 2,
        enabled: true,
      },
    ],
  });
  console.log("Seeded default gating rules.");
}

async function seedBundledAssets() {
  const bundled = path.join(__dirname, "../storage/gated/bundled");
  fs.mkdirSync(bundled, { recursive: true });

  const pdfBuf = Buffer.from(SAMPLE_PDF_B64, "base64");
  fs.writeFileSync(path.join(bundled, "sample.pdf"), pdfBuf);

  const videoReadme = `Demo video / media placeholder
========================
Replace with a real .mp4 (or other format) via Admin → Assets upload.
Signed download links are issued after gating checks pass.
`;
  fs.writeFileSync(path.join(bundled, "demo-video.txt"), videoReadme, "utf8");

  const vidBuf = Buffer.from(videoReadme);
  const rows = [
    {
      slug: "sample-pdf",
      originalName: "sample.pdf",
      mimeType: "application/pdf",
      sha256: createHash("sha256").update(pdfBuf).digest("hex"),
      sizeBytes: pdfBuf.length,
      storageKey: "bundled/sample.pdf",
      body: pdfBuf,
    },
    {
      slug: "demo-video",
      originalName: "demo-video.txt",
      mimeType: "text/plain",
      sha256: createHash("sha256").update(vidBuf).digest("hex"),
      sizeBytes: vidBuf.length,
      storageKey: "bundled/demo-video.txt",
      body: vidBuf,
    },
  ];

  const bucket = process.env.R2_BUCKET || process.env.S3_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
  const mode = process.env.STORAGE_MODE?.toLowerCase();
  if (
    (mode === "s3" || mode === "r2") &&
    bucket &&
    accessKeyId &&
    secretAccessKey
  ) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const rawRegion = process.env.R2_REGION || process.env.S3_REGION || "auto";
    const region = rawRegion === "auto" ? "us-east-1" : rawRegion;
    const forcePathStyle =
      process.env.R2_FORCE_PATH_STYLE === "true" ||
      process.env.S3_FORCE_PATH_STYLE === "true";
    const client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: Boolean(endpoint && forcePathStyle),
    });
    for (const r of rows) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: r.storageKey,
          Body: r.body,
          ContentType: r.mimeType,
        }),
      );
    }
    console.log("Uploaded bundled assets to Cloudflare R2 (S3-compatible) bucket.");
  }

  for (const r of rows) {
    const { body: _b, ...row } = r;
    await prisma.gatedAsset.upsert({
      where: { slug: row.slug },
      create: row,
      update: {
        sha256: row.sha256,
        sizeBytes: row.sizeBytes,
        mimeType: row.mimeType,
        originalName: row.originalName,
        storageKey: row.storageKey,
      },
    });
  }
  console.log("Seeded bundled gated assets (sample PDF + video placeholder).");
}

async function main() {
  const admins = (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => /^0x[a-f0-9]{40}$/.test(a));

  for (const address of admins) {
    await prisma.allowlistEntry.upsert({
      where: { address },
      create: { address, note: "seeded from ADMIN_WALLETS" },
      update: {},
    });
  }

  await seedRules();
  await seedBundledAssets();
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
