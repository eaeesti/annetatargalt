ALTER TABLE "bank_transactions" ADD COLUMN "direction" varchar(1);--> statement-breakpoint
-- Where the category already says which way the money went. A debit line is
-- imported as 'outgoing', and only a debit line can lack an archiving code
-- (those get a 'kv-' key). Everything else waits for the next import that
-- covers it.
UPDATE "bank_transactions" SET "direction" = 'D' WHERE "category" = 'outgoing' OR "archiving_code" LIKE 'kv-%';--> statement-breakpoint
UPDATE "bank_transactions" SET "direction" = 'C' WHERE "direction" IS NULL AND "category" IN ('donation', 'card-payout');
