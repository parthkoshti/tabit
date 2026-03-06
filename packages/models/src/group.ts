import { z } from "zod";

export const groupMemberRoleSchema = z.enum(["owner", "member"]);
export type GroupMemberRole = z.infer<typeof groupMemberRoleSchema>;

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const addMemberSchema = z.object({
  groupId: z.string(),
  email: z.string().email(),
  role: groupMemberRoleSchema.default("member"),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date(),
});

export type Group = z.infer<typeof groupSchema>;

export const groupWithMembersSchema = groupSchema.extend({
  members: z.array(
    z.object({
      userId: z.string(),
      role: groupMemberRoleSchema,
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string().nullable(),
      }),
    })
  ),
});

export type GroupWithMembers = z.infer<typeof groupWithMembersSchema>;
