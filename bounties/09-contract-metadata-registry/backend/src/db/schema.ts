import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
  bigint,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    contractAddress: varchar("contract_address", { length: 42 }).notNull(),
    submitterAddress: varchar("submitter_address", { length: 42 }).notNull(),
    metadataCid: text("metadata_cid"),
    contentHash: varchar("content_hash", { length: 66 }),
    rawMetadata: jsonb("raw_metadata").notNull(),
    version: integer("version").notNull().default(1),
    status: varchar("status", { length: 20 })
      .notNull()
      .default("pending")
      .$type<
        "pending" | "validating" | "pinning" | "submitted_onchain" | "approved" | "rejected" | "failed"
      >(),
    txHash: varchar("tx_hash", { length: 66 }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_submissions_contract").on(table.contractAddress),
    index("idx_submissions_status").on(table.status),
    index("idx_submissions_submitter").on(table.submitterAddress),
  ]
);

export const moderationLogs = pgTable("moderation_logs", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id")
    .notNull()
    .references(() => submissions.id),
  action: varchar("action", { length: 20 }).notNull().$type<"approved" | "rejected">(),
  moderatorAddress: varchar("moderator_address", { length: 42 }).notNull(),
  reason: text("reason"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ipfsPins = pgTable(
  "ipfs_pins",
  {
    id: serial("id").primaryKey(),
    cid: text("cid").notNull(),
    submissionId: integer("submission_id")
      .notNull()
      .references(() => submissions.id),
    provider: varchar("provider", { length: 20 }).notNull().default("pinata"),
    pinStatus: varchar("pin_status", { length: 20 })
      .notNull()
      .default("queued")
      .$type<"queued" | "pinned" | "failed" | "unpinned">(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    lastVerified: timestamp("last_verified"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_ipfs_pins_cid").on(table.cid)]
);
