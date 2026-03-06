CREATE TABLE IF NOT EXISTS "friend_request" (
	"id" text PRIMARY KEY NOT NULL,
	"fromUserId" text NOT NULL,
	"toUserId" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pending_friend" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL UNIQUE,
	"userId" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "friend_request" ADD CONSTRAINT "friend_request_fromUserId_user_id_fk" FOREIGN KEY ("fromUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "friend_request" ADD CONSTRAINT "friend_request_toUserId_user_id_fk" FOREIGN KEY ("toUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "pending_friend" ADD CONSTRAINT "pending_friend_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
