ALTER TABLE "expense" ADD COLUMN "expenseDate" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "expense" SET "expenseDate" = "createdAt";