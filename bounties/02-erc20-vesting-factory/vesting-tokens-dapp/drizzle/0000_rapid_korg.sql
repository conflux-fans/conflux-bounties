CREATE TABLE "batch_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_address" varchar(42) NOT NULL,
	"name" varchar(100),
	"description" text,
	"token_count" integer NOT NULL,
	"total_vesting_schedules" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployed_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" varchar(42) NOT NULL,
	"name" varchar(100) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"total_supply" varchar(78) NOT NULL,
	"decimals" integer DEFAULT 18 NOT NULL,
	"owner_address" varchar(42) NOT NULL,
	"factory_tx_hash" varchar(66) NOT NULL,
	"deployed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"website" varchar(500),
	"logo" varchar(500),
	"category" varchar(50),
	"batch_id" uuid,
	CONSTRAINT "deployed_tokens_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" varchar(42) NOT NULL,
	"name" varchar(100),
	"email" varchar(255),
	"avatar" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "vesting_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vesting_schedule_id" uuid NOT NULL,
	"amount_claimed" varchar(78) NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"block_number" integer,
	"gas_used" varchar(78),
	"gas_price" varchar(78),
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vesting_claims_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "vesting_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"contract_address" varchar(42) NOT NULL,
	"beneficiary_address" varchar(42) NOT NULL,
	"total_amount" varchar(78) NOT NULL,
	"cliff_duration" integer NOT NULL,
	"vesting_duration" integer NOT NULL,
	"start_time" timestamp NOT NULL,
	"released_amount" varchar(78) DEFAULT '0' NOT NULL,
	"revocable" boolean DEFAULT false NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"category" varchar(50),
	"description" text
);
