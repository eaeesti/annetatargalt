CREATE TABLE "donation_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"datetime" date NOT NULL,
	"recipient" varchar(256),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" serial PRIMARY KEY NOT NULL,
	"donor_id" integer NOT NULL,
	"recurring_donation_id" integer,
	"donation_transfer_id" integer,
	"datetime" timestamp NOT NULL,
	"amount" integer NOT NULL,
	"finalized" boolean DEFAULT false NOT NULL,
	"payment_method" varchar(64),
	"iban" varchar(34),
	"comment" text,
	"company_name" varchar(128),
	"company_code" varchar(128),
	"sent_to_organization" boolean DEFAULT false NOT NULL,
	"dedication_name" varchar(128),
	"dedication_email" varchar(256),
	"dedication_message" text,
	"external_donation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donors" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_code" varchar(11),
	"first_name" varchar(128),
	"last_name" varchar(128),
	"email" varchar(256),
	"recurring_donor" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_donations" (
	"id" serial PRIMARY KEY NOT NULL,
	"donation_id" integer NOT NULL,
	"organization_internal_id" varchar(64) NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_recurring_donations" (
	"id" serial PRIMARY KEY NOT NULL,
	"recurring_donation_id" integer NOT NULL,
	"organization_internal_id" varchar(64) NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_donations" (
	"id" serial PRIMARY KEY NOT NULL,
	"donor_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"company_name" varchar(128),
	"company_code" varchar(128),
	"comment" text,
	"bank" varchar(64),
	"amount" integer NOT NULL,
	"datetime" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_recurring_donation_id_recurring_donations_id_fk" FOREIGN KEY ("recurring_donation_id") REFERENCES "public"."recurring_donations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_donation_transfer_id_donation_transfers_id_fk" FOREIGN KEY ("donation_transfer_id") REFERENCES "public"."donation_transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_donations" ADD CONSTRAINT "organization_donations_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_recurring_donations" ADD CONSTRAINT "organization_recurring_donations_recurring_donation_id_recurring_donations_id_fk" FOREIGN KEY ("recurring_donation_id") REFERENCES "public"."recurring_donations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_donations" ADD CONSTRAINT "recurring_donations_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE no action ON UPDATE no action;