ALTER TABLE "user" ADD COLUMN "defaultCurrency" text;--> statement-breakpoint
ALTER TABLE "tab" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;