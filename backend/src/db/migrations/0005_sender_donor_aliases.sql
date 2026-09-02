CREATE TABLE IF NOT EXISTS "sender_donor_aliases" (
	"sender_code" varchar(64) PRIMARY KEY NOT NULL,
	"donor_id" integer NOT NULL,
	"note" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(256)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sender_donor_aliases" ADD CONSTRAINT "sender_donor_aliases_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;