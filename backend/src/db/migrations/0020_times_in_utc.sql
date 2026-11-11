-- The times the database wrote by its own clock, the columns' defaults and
-- now(), were in Estonian time, while the app writes UTC and reads every
-- one as UTC: they read as hours off. The columns' defaults now write UTC
-- whatever the connection's time zone, so rows a backend still running
-- the old code writes during a deploy come out right too, and the app's
-- connections use UTC. This migration runs on those connections, so the
-- zone the times already written are in is named.
-- An updated_at is turned only while it's still the one written with the
-- row: one the app has written since is UTC already. A bank line's was
-- set by the database when its statement was imported again, and by the
-- app when it was edited, and nothing says which came last: those are left
-- as they are, and neither is shown or used anywhere. The emails' own times
-- are the app's.
ALTER TABLE "admin_audit_log" ALTER COLUMN "timestamp" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "bank_transaction_files" ALTER COLUMN "uploaded_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "bank_transactions" ALTER COLUMN "imported_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "bank_transactions" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "bank_transactions" ALTER COLUMN "updated_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "donation_transfers" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "donation_transfers" ALTER COLUMN "updated_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "donations" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "donations" ALTER COLUMN "updated_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "donors" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "donors" ALTER COLUMN "updated_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "email_campaigns" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "email_campaigns" ALTER COLUMN "updated_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "email_sends" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "organization_donations" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "organization_donations" ALTER COLUMN "updated_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "organization_recurring_donations" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "organization_recurring_donations" ALTER COLUMN "updated_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "recurring_donations" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "recurring_donations" ALTER COLUMN "updated_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "sender_donor_aliases" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
UPDATE "admin_audit_log" SET "timestamp" = ("timestamp" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC';
--> statement-breakpoint
UPDATE "bank_transaction_files" SET "uploaded_at" = ("uploaded_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC';
--> statement-breakpoint
UPDATE "bank_transactions" SET "updated_at" = CASE WHEN "updated_at" = "created_at" THEN ("updated_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC' ELSE "updated_at" END, "created_at" = ("created_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC', "imported_at" = ("imported_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC';
--> statement-breakpoint
UPDATE "donation_transfers" SET "updated_at" = CASE WHEN "updated_at" = "created_at" THEN ("updated_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC' ELSE "updated_at" END, "created_at" = ("created_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC';
--> statement-breakpoint
UPDATE "donations" SET "updated_at" = CASE WHEN "updated_at" = "created_at" THEN ("updated_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC' ELSE "updated_at" END, "created_at" = ("created_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC';
--> statement-breakpoint
UPDATE "donors" SET "updated_at" = CASE WHEN "updated_at" = "created_at" THEN ("updated_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC' ELSE "updated_at" END, "created_at" = ("created_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC';
--> statement-breakpoint
UPDATE "organization_donations" SET "updated_at" = CASE WHEN "updated_at" = "created_at" THEN ("updated_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC' ELSE "updated_at" END, "created_at" = ("created_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC';
--> statement-breakpoint
UPDATE "organization_recurring_donations" SET "updated_at" = CASE WHEN "updated_at" = "created_at" THEN ("updated_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC' ELSE "updated_at" END, "created_at" = ("created_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC';
--> statement-breakpoint
UPDATE "recurring_donations" SET "updated_at" = CASE WHEN "updated_at" = "created_at" THEN ("updated_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC' ELSE "updated_at" END, "created_at" = ("created_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC';
--> statement-breakpoint
UPDATE "sender_donor_aliases" SET "created_at" = ("created_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC';
--> statement-breakpoint
UPDATE "email_sends" SET "created_at" = ("created_at" AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'UTC';
