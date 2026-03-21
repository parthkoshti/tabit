CREATE TABLE "fx_rate_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"rateDate" date NOT NULL,
	"base" text NOT NULL,
	"rates" jsonb NOT NULL,
	"fetchedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rate_snapshot_rateDate_base_idx" ON "fx_rate_snapshot" USING btree ("rateDate","base");--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "originalAmount" numeric(12, 2);--> statement-breakpoint
UPDATE "expense" e
SET
  "currency" = t."currency",
  "originalAmount" = e."amount"::numeric
FROM "tab" t
WHERE t."id" = e."tabId";--> statement-breakpoint
ALTER TABLE "expense" ALTER COLUMN "currency" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ALTER COLUMN "originalAmount" SET NOT NULL;
