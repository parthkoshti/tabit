CREATE TABLE IF NOT EXISTS "pending_tab_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"tabId" text NOT NULL,
	"createdByUserId" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pending_tab_invite_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS "tab_invite_request" (
	"id" text PRIMARY KEY NOT NULL,
	"tabId" text NOT NULL,
	"fromUserId" text NOT NULL,
	"toUserId" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "pending_tab_invite" ADD CONSTRAINT "pending_tab_invite_tabId_tab_id_fk" FOREIGN KEY ("tabId") REFERENCES "public"."tab"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "pending_tab_invite" ADD CONSTRAINT "pending_tab_invite_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tab_invite_request" ADD CONSTRAINT "tab_invite_request_tabId_tab_id_fk" FOREIGN KEY ("tabId") REFERENCES "public"."tab"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tab_invite_request" ADD CONSTRAINT "tab_invite_request_fromUserId_user_id_fk" FOREIGN KEY ("fromUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tab_invite_request" ADD CONSTRAINT "tab_invite_request_toUserId_user_id_fk" FOREIGN KEY ("toUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
