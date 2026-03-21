ALTER TABLE "settlement" ADD COLUMN "settlementDate" timestamp;--> statement-breakpoint
UPDATE "settlement" SET "settlementDate" = "createdAt" WHERE "settlementDate" IS NULL;--> statement-breakpoint
ALTER TABLE "settlement" ALTER COLUMN "settlementDate" SET NOT NULL;--> statement-breakpoint
