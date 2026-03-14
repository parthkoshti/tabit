ALTER TABLE "expense" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
CREATE INDEX "expense_tabId_deletedAt_idx" ON "expense" USING btree ("tabId","deletedAt");