CREATE INDEX IF NOT EXISTS "donations_donor_idx" ON "donations" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donations_recurring_donation_idx" ON "donations" USING btree ("recurring_donation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donations_donation_transfer_idx" ON "donations" USING btree ("donation_transfer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donations_datetime_idx" ON "donations" USING btree ("datetime");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_donations_donation_idx" ON "organization_donations" USING btree ("donation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_recurring_donations_recurring_idx" ON "organization_recurring_donations" USING btree ("recurring_donation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_donations_donor_idx" ON "recurring_donations" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sender_donor_aliases_donor_idx" ON "sender_donor_aliases" USING btree ("donor_id");