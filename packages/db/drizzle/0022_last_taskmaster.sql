CREATE TABLE "tab_event" (
	"id" text PRIMARY KEY NOT NULL,
	"tabId" text NOT NULL,
	"type" text NOT NULL,
	"performedByUserId" text NOT NULL,
	"payload" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tab_participant" (
	"id" text PRIMARY KEY NOT NULL,
	"tabId" text NOT NULL,
	"kind" text NOT NULL,
	"userId" text,
	"displayName" text NOT NULL,
	"createdByUserId" text NOT NULL,
	"mergedIntoParticipantId" text,
	"mergedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense" ALTER COLUMN "paidById" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_split" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "settlement" ALTER COLUMN "fromUserId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "settlement" ALTER COLUMN "toUserId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "paidByParticipantId" text;--> statement-breakpoint
ALTER TABLE "expense_split" ADD COLUMN "participantId" text;--> statement-breakpoint
ALTER TABLE "settlement" ADD COLUMN "fromParticipantId" text;--> statement-breakpoint
ALTER TABLE "settlement" ADD COLUMN "toParticipantId" text;--> statement-breakpoint
ALTER TABLE "tab_event" ADD CONSTRAINT "tab_event_tabId_tab_id_fk" FOREIGN KEY ("tabId") REFERENCES "public"."tab"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tab_event" ADD CONSTRAINT "tab_event_performedByUserId_user_id_fk" FOREIGN KEY ("performedByUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tab_participant" ADD CONSTRAINT "tab_participant_tabId_tab_id_fk" FOREIGN KEY ("tabId") REFERENCES "public"."tab"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tab_participant" ADD CONSTRAINT "tab_participant_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tab_participant" ADD CONSTRAINT "tab_participant_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tab_participant" ADD CONSTRAINT "tab_participant_merged_into_fk" FOREIGN KEY ("mergedIntoParticipantId") REFERENCES "public"."tab_participant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tab_event_tabId_createdAt_idx" ON "tab_event" USING btree ("tabId","createdAt");--> statement-breakpoint
CREATE INDEX "tab_participant_tabId_idx" ON "tab_participant" USING btree ("tabId");--> statement-breakpoint
CREATE UNIQUE INDEX "tab_participant_tabId_userId_uidx" ON "tab_participant" USING btree ("tabId","userId");--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_paidByParticipantId_tab_participant_id_fk" FOREIGN KEY ("paidByParticipantId") REFERENCES "public"."tab_participant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_participantId_tab_participant_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."tab_participant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_fromParticipantId_tab_participant_id_fk" FOREIGN KEY ("fromParticipantId") REFERENCES "public"."tab_participant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_toParticipantId_tab_participant_id_fk" FOREIGN KEY ("toParticipantId") REFERENCES "public"."tab_participant"("id") ON DELETE restrict ON UPDATE no action;