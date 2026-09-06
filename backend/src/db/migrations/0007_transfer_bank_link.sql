ALTER TABLE "bank_transactions" ADD COLUMN IF NOT EXISTS "donation_transfer_id" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_transactions_donation_transfer_idx" ON "bank_transactions" USING btree ("donation_transfer_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_donation_transfer_id_donation_transfers_id_fk" FOREIGN KEY ("donation_transfer_id") REFERENCES "public"."donation_transfers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
