CREATE TABLE IF NOT EXISTS "ignored_bank_transactions" (
	"archiving_code" varchar(20) PRIMARY KEY NOT NULL,
	"reason" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(256)
);
