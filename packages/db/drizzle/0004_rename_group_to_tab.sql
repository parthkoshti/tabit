-- Rename group to tab
ALTER TABLE "group" RENAME TO "tab";

-- Rename group_member to tab_member
ALTER TABLE "group_member" RENAME TO "tab_member";

-- Rename groupId to tabId in tab_member
ALTER TABLE "tab_member" RENAME COLUMN "groupId" TO "tabId";

-- Rename groupId to tabId in expense
ALTER TABLE "expense" RENAME COLUMN "groupId" TO "tabId";

-- Rename groupId to tabId in settlement
ALTER TABLE "settlement" RENAME COLUMN "groupId" TO "tabId";

-- Drop old foreign key constraints
ALTER TABLE "tab_member" DROP CONSTRAINT IF EXISTS "group_member_groupId_group_id_fk";
ALTER TABLE "expense" DROP CONSTRAINT IF EXISTS "expense_groupId_group_id_fk";
ALTER TABLE "settlement" DROP CONSTRAINT IF EXISTS "settlement_groupId_group_id_fk";

-- Add new foreign key constraints
ALTER TABLE "tab_member" ADD CONSTRAINT "tab_member_tabId_tab_id_fk" FOREIGN KEY ("tabId") REFERENCES "tab"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "expense" ADD CONSTRAINT "expense_tabId_tab_id_fk" FOREIGN KEY ("tabId") REFERENCES "tab"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_tabId_tab_id_fk" FOREIGN KEY ("tabId") REFERENCES "tab"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
