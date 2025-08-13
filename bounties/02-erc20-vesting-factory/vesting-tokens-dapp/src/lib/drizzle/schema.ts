// Drizzle schema for Supabase PostgreSQL
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
  text,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table (matches your Prisma schema)
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  address: varchar("address", { length: 42 }).unique().notNull(),
  name: varchar("name", { length: 100 }),
  email: varchar("email", { length: 255 }),
  avatar: varchar("avatar", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Deployed tokens table
export const deployedTokens = pgTable("deployed_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  address: varchar("address", { length: 42 }).unique().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  totalSupply: varchar("total_supply", { length: 78 }).notNull(),
  decimals: integer("decimals").default(18).notNull(),
  ownerAddress: varchar("owner_address", { length: 42 }).notNull(),
  factoryTxHash: varchar("factory_tx_hash", { length: 66 }).notNull(),
  deployedAt: timestamp("deployed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Metadata
  description: text("description"),
  website: varchar("website", { length: 500 }),
  logo: varchar("logo", { length: 500 }),
  category: varchar("category", { length: 50 }),
  batchId: uuid("batch_id"),
});

// Vesting schedules table
export const vestingSchedules = pgTable("vesting_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenId: uuid("token_id").notNull(),
  contractAddress: varchar("contract_address", { length: 42 }).notNull(),
  beneficiaryAddress: varchar("beneficiary_address", { length: 42 }).notNull(),
  totalAmount: varchar("total_amount", { length: 78 }).notNull(),
  cliffDuration: integer("cliff_duration").notNull(),
  vestingDuration: integer("vesting_duration").notNull(),
  startTime: timestamp("start_time").notNull(),
  releasedAmount: varchar("released_amount", { length: 78 })
    .default("0")
    .notNull(),
  revocable: boolean("revocable").default(false).notNull(),
  revoked: boolean("revoked").default(false).notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Metadata
  category: varchar("category", { length: 50 }),
  description: text("description"),
});

// Vesting claims table
export const vestingClaims = pgTable("vesting_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  vestingScheduleId: uuid("vesting_schedule_id").notNull(),
  amountClaimed: varchar("amount_claimed", { length: 78 }).notNull(),
  txHash: varchar("tx_hash", { length: 66 }).unique().notNull(),
  blockNumber: integer("block_number"),
  gasUsed: varchar("gas_used", { length: 78 }),
  gasPrice: varchar("gas_price", { length: 78 }),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations (same as before)
export const usersRelations = relations(users, ({ many }) => ({
  deployedTokens: many(deployedTokens),
  vestingSchedules: many(vestingSchedules),
}));

export const deployedTokensRelations = relations(
  deployedTokens,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [deployedTokens.ownerAddress],
      references: [users.address],
    }),
    vestingSchedules: many(vestingSchedules),
  })
);

export const vestingSchedulesRelations = relations(
  vestingSchedules,
  ({ one, many }) => ({
    token: one(deployedTokens, {
      fields: [vestingSchedules.tokenId],
      references: [deployedTokens.id],
    }),
    beneficiary: one(users, {
      fields: [vestingSchedules.beneficiaryAddress],
      references: [users.address],
    }),
    claims: many(vestingClaims),
  })
);

export const vestingClaimsRelations = relations(vestingClaims, ({ one }) => ({
  vestingSchedule: one(vestingSchedules, {
    fields: [vestingClaims.vestingScheduleId],
    references: [vestingSchedules.id],
  }),
}));

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DeployedToken = typeof deployedTokens.$inferSelect;
export type NewDeployedToken = typeof deployedTokens.$inferInsert;
export type VestingSchedule = typeof vestingSchedules.$inferSelect;
export type NewVestingSchedule = typeof vestingSchedules.$inferInsert;
export type VestingClaim = typeof vestingClaims.$inferSelect;
export type NewVestingClaim = typeof vestingClaims.$inferInsert;
