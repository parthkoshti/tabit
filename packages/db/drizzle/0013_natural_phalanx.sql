CREATE TABLE "expense_reaction" (
	"expenseId" text NOT NULL,
	"userId" text NOT NULL,
	"emoji" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expense_reaction_expenseId_userId_pk" PRIMARY KEY("expenseId","userId")
);
--> statement-breakpoint
ALTER TABLE "expense_reaction" ADD CONSTRAINT "expense_reaction_expenseId_expense_id_fk" FOREIGN KEY ("expenseId") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_reaction" ADD CONSTRAINT "expense_reaction_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;