CREATE TABLE "expense_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"expenseId" text NOT NULL,
	"tabId" text NOT NULL,
	"action" text NOT NULL,
	"performedById" text NOT NULL,
	"performedAt" timestamp DEFAULT now() NOT NULL,
	"changes" jsonb
);
--> statement-breakpoint
CREATE TABLE "settlement_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"settlementId" text NOT NULL,
	"tabId" text NOT NULL,
	"action" text DEFAULT 'create' NOT NULL,
	"performedById" text NOT NULL,
	"performedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_audit_log" ADD CONSTRAINT "expense_audit_log_expenseId_expense_id_fk" FOREIGN KEY ("expenseId") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_audit_log" ADD CONSTRAINT "expense_audit_log_tabId_tab_id_fk" FOREIGN KEY ("tabId") REFERENCES "public"."tab"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_audit_log" ADD CONSTRAINT "expense_audit_log_performedById_user_id_fk" FOREIGN KEY ("performedById") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_audit_log" ADD CONSTRAINT "settlement_audit_log_settlementId_settlement_id_fk" FOREIGN KEY ("settlementId") REFERENCES "public"."settlement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_audit_log" ADD CONSTRAINT "settlement_audit_log_tabId_tab_id_fk" FOREIGN KEY ("tabId") REFERENCES "public"."tab"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_audit_log" ADD CONSTRAINT "settlement_audit_log_performedById_user_id_fk" FOREIGN KEY ("performedById") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;