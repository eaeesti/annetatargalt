CREATE TABLE IF NOT EXISTS "bank_transactions" (
	"archiving_code" varchar(20) PRIMARY KEY NOT NULL,
	"date" date,
	"amount" integer,
	"description" text,
	"counterparty_name" varchar(256),
	"counterparty_account" varchar(64),
	"sender_code" varchar(64),
	"category" varchar(24) DEFAULT 'undecided' NOT NULL,
	"gross_amount" integer,
	"fee_amount" integer,
	"note" varchar(512),
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"imported_by" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "processor_fee_cents" integer;--> statement-breakpoint
-- carry the "not a donation" ignore list into the new table
INSERT INTO "bank_transactions" ("archiving_code", "category", "note", "imported_by", "created_at", "imported_at", "updated_at")
SELECT "archiving_code", 'ignored', "reason", "created_by", "created_at", "created_at", "created_at"
FROM "ignored_bank_transactions"
ON CONFLICT ("archiving_code") DO NOTHING;--> statement-breakpoint
-- stub a row for every archiving code already recorded on a donation, so the FK
-- below can be added. category 'unimported' = "we know a donation points here
-- but the bank line has not been imported yet"; the first real statement import
-- of that period overwrites it with the true category + bank fields, and
-- money-flow excludes it entirely until then.
INSERT INTO "bank_transactions" ("archiving_code", "category")
SELECT DISTINCT "transaction_id", 'unimported'
FROM "donations"
WHERE "transaction_id" IS NOT NULL
ON CONFLICT ("archiving_code") DO NOTHING;--> statement-breakpoint
DROP TABLE IF EXISTS "ignored_bank_transactions" CASCADE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_transactions_date_idx" ON "bank_transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_transactions_category_idx" ON "bank_transactions" USING btree ("category");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "donations" ADD CONSTRAINT "donations_transaction_id_bank_transactions_archiving_code_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."bank_transactions"("archiving_code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
