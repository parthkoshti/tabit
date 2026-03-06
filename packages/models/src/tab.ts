import { z } from "zod";

export const tabMemberRoleSchema = z.enum(["owner", "member"]);
export type TabMemberRole = z.infer<typeof tabMemberRoleSchema>;

export const createTabSchema = z.object({
  name: z.string().min(1).max(100),
});

export type CreateTabInput = z.infer<typeof createTabSchema>;

export const addMemberSchema = z.object({
  tabId: z.string(),
  email: z.string().email(),
  role: tabMemberRoleSchema.default("member"),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const tabSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date(),
});

export type Tab = z.infer<typeof tabSchema>;

export const tabWithMembersSchema = tabSchema.extend({
  members: z.array(
    z.object({
      userId: z.string(),
      role: tabMemberRoleSchema,
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string().nullable(),
      }),
    })
  ),
});

export type TabWithMembers = z.infer<typeof tabWithMembersSchema>;
