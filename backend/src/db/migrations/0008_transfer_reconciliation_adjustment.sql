ALTER TABLE "donation_transfers" ADD COLUMN IF NOT EXISTS "reconciliation_adjustment_cents" integer;--> statement-breakpoint
ALTER TABLE "donation_transfers" ADD COLUMN IF NOT EXISTS "reconciliation_note" text;
