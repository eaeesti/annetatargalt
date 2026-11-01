ALTER TABLE "email_sends" ALTER COLUMN "status" SET DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "newsletter" boolean;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD COLUMN "heartbeat_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD COLUMN "sender_id" varchar(36);--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD COLUMN "held_for" text;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD COLUMN "editor_id" varchar(36);--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD COLUMN "editor_save" integer;--> statement-breakpoint
ALTER TABLE "email_sends" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_sends" ADD COLUMN "retry_at" timestamp;--> statement-breakpoint
CREATE INDEX "admin_audit_log_timestamp_idx" ON "admin_audit_log" USING btree ("timestamp");