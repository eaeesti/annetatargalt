CREATE TABLE "email_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" varchar(24) NOT NULL,
	"name" varchar(256) DEFAULT '' NOT NULL,
	"content" jsonb NOT NULL,
	"audience" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"created_by" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"donor_id" integer NOT NULL,
	"status" varchar(16) DEFAULT 'sending' NOT NULL,
	"error" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_sends_campaign_donor_unique" UNIQUE("campaign_id","donor_id")
);
--> statement-breakpoint
ALTER TABLE "donors" ADD COLUMN "newsletter" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "donors" ADD COLUMN "transfer_emails" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "donors" ADD COLUMN "yearly_emails" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Everyone who had given before there was a newsletter gets it too, and says
-- so. Anyone else has it by default, as donors from now on do.
ALTER TABLE "donors" ADD COLUMN "newsletter_source" varchar(24) DEFAULT 'existing-donor' NOT NULL;--> statement-breakpoint
ALTER TABLE "donors" ALTER COLUMN "newsletter_source" SET DEFAULT 'default';--> statement-breakpoint
UPDATE "donors" SET "newsletter_source" = 'default'
WHERE NOT EXISTS (SELECT 1 FROM "donations"
  WHERE "donations"."donor_id" = "donors"."id" AND "donations"."finalized");--> statement-breakpoint
ALTER TABLE "donors" ADD COLUMN "email_preferences_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donors_address_idx" ON "donors" USING btree (lower(trim("email")));
