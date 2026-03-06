-- Better Auth tables
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean DEFAULT false NOT NULL,
  "image" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "expiresAt" timestamp NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "accessToken" text,
  "refreshToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "idToken" text,
  "password" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- App tables
CREATE TABLE IF NOT EXISTS "group" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_member" (
  "groupId" text NOT NULL,
  "userId" text NOT NULL,
  "role" text DEFAULT 'member' NOT NULL,
  PRIMARY KEY ("groupId", "userId")
);

CREATE TABLE IF NOT EXISTS "expense" (
  "id" text PRIMARY KEY NOT NULL,
  "groupId" text NOT NULL,
  "paidById" text NOT NULL,
  "amount" decimal(12, 2) NOT NULL,
  "description" text NOT NULL,
  "splitType" text DEFAULT 'equal' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "expense_split" (
  "id" text PRIMARY KEY NOT NULL,
  "expenseId" text NOT NULL,
  "userId" text NOT NULL,
  "amount" decimal(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS "settlement" (
  "id" text PRIMARY KEY NOT NULL,
  "groupId" text NOT NULL,
  "fromUserId" text NOT NULL,
  "toUserId" text NOT NULL,
  "amount" decimal(12, 2) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- Foreign keys
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_groupId_group_id_fk" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "expense" ADD CONSTRAINT "expense_groupId_group_id_fk" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "expense" ADD CONSTRAINT "expense_paidById_user_id_fk" FOREIGN KEY ("paidById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_expenseId_expense_id_fk" FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_groupId_group_id_fk" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_fromUserId_user_id_fk" FOREIGN KEY ("fromUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_toUserId_user_id_fk" FOREIGN KEY ("toUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
