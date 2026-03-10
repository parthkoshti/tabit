export function getDisplayName(
  user: {
    id?: string;
    username?: string | null;
    name?: string | null;
    email?: string | null;
  },
  currentUserId?: string,
): string {
  if (currentUserId && user.id === currentUserId) return "You";
  return user.name ?? (user.username ? `@${user.username}` : user.email ?? "");
}
