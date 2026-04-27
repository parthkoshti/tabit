CREATE TABLE "recurring_expense_occurrence" (
	"id" text PRIMARY KEY NOT NULL,
	"ruleId" text NOT NULL,
	"occurrenceKey" text NOT NULL,
	"expenseId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_expense_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"tabId" text NOT NULL,
	"ownerUserId" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"ruleName" text NOT NULL,
	"schedule" jsonb NOT NULL,
	"template" jsonb NOT NULL,
	"startsOn" date NOT NULL,
	"endsOn" date,
	"maxCount" integer,
	"postedCount" integer DEFAULT 0 NOT NULL,
	"nextDueKey" text NOT NULL,
	"pausedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "recurringRuleId" text;--> statement-breakpoint
ALTER TABLE "recurring_expense_occurrence" ADD CONSTRAINT "recurring_expense_occurrence_ruleId_recurring_expense_rule_id_fk" FOREIGN KEY ("ruleId") REFERENCES "public"."recurring_expense_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expense_occurrence" ADD CONSTRAINT "recurring_expense_occurrence_expenseId_expense_id_fk" FOREIGN KEY ("expenseId") REFERENCES "public"."expense"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expense_rule" ADD CONSTRAINT "recurring_expense_rule_tabId_tab_id_fk" FOREIGN KEY ("tabId") REFERENCES "public"."tab"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expense_rule" ADD CONSTRAINT "recurring_expense_rule_ownerUserId_user_id_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_expense_occurrence_ruleId_occurrenceKey_uidx" ON "recurring_expense_occurrence" USING btree ("ruleId","occurrenceKey");--> statement-breakpoint
CREATE INDEX "recurring_expense_rule_tabId_idx" ON "recurring_expense_rule" USING btree ("tabId");--> statement-breakpoint
CREATE INDEX "recurring_expense_rule_ownerUserId_idx" ON "recurring_expense_rule" USING btree ("ownerUserId");--> statement-breakpoint
CREATE INDEX "recurring_expense_rule_status_nextDueKey_idx" ON "recurring_expense_rule" USING btree ("status","nextDueKey");--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_recurringRuleId_recurring_expense_rule_id_fk" FOREIGN KEY ("recurringRuleId") REFERENCES "public"."recurring_expense_rule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_recurringRuleId_idx" ON "expense" USING btree ("recurringRuleId");