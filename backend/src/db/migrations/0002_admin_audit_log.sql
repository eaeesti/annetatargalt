CREATE TABLE "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar(256) NOT NULL,
	"user_email" varchar(256) NOT NULL,
	"action" varchar(128) NOT NULL,
	"record_id" varchar(64),
	"ip" varchar(64)
);
