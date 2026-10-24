CREATE TABLE "bank_transaction_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"archiving_code" varchar(20) NOT NULL,
	"storage_key" varchar(64) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" varchar(256),
	CONSTRAINT "bank_transaction_files_archiving_code_unique" UNIQUE("archiving_code"),
	CONSTRAINT "bank_transaction_files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "bank_transaction_files" ADD CONSTRAINT "bank_transaction_files_archiving_code_bank_transactions_archiving_code_fk" FOREIGN KEY ("archiving_code") REFERENCES "public"."bank_transactions"("archiving_code") ON DELETE no action ON UPDATE no action;