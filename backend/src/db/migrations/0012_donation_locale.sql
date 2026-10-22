ALTER TABLE "donations" ADD COLUMN "locale" varchar(8) DEFAULT 'et' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_donations" ADD COLUMN "locale" varchar(8) DEFAULT 'et' NOT NULL;