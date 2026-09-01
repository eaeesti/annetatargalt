ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "transaction_id" varchar(20);--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "transaction_match_source" varchar(24);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donations_transaction_id_idx" ON "donations" USING btree ("transaction_id");