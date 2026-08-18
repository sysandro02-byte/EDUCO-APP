CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_name" text NOT NULL,
	"role" text NOT NULL,
	"action" text NOT NULL,
	"details" text,
	"timestamp" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"total" double precision NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" text,
	"capacity" integer DEFAULT 40,
	"student_count" integer DEFAULT 0,
	"main_teacher" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "classes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_name" text NOT NULL,
	"fee_type" text NOT NULL,
	"amount" double precision NOT NULL,
	"due_date" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"notif_id" text NOT NULL,
	"message" text NOT NULL,
	"type" text NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb,
	"timestamp" text NOT NULL,
	"read" boolean DEFAULT false,
	"link" text,
	CONSTRAINT "notifications_notif_id_unique" UNIQUE("notif_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer,
	"student_name" text NOT NULL,
	"class_name" text NOT NULL,
	"fee_type" text NOT NULL,
	"amount_paid" double precision NOT NULL,
	"total_due" double precision NOT NULL,
	"payment_date" text NOT NULL,
	"payment_method" text DEFAULT 'Espèces',
	"cashier_name" text,
	"receipt_number" text,
	"status" text DEFAULT 'Payé' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payments_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "personnel" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"email" text,
	"phone" text,
	"salary" double precision DEFAULT 0,
	"contract_type" text DEFAULT 'CDI',
	"status" text DEFAULT 'Actif' NOT NULL,
	"avatar" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "school_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_name" text DEFAULT 'EDUCO Excellence',
	"address" text,
	"phone" text,
	"email" text,
	"currency" text DEFAULT '€',
	"logo_url" text,
	"academic_year" text DEFAULT '2025-2026',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"coefficient" double precision DEFAULT 1,
	"teacher_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"txn_id" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"amount" double precision NOT NULL,
	"date" text NOT NULL,
	"status" text DEFAULT 'En attente' NOT NULL,
	"category" text NOT NULL,
	"justification" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "transactions_txn_id_unique" UNIQUE("txn_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'Actif' NOT NULL,
	"avatar" text,
	"class_name" text,
	"parent_phone" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
