export function getDisplayName(
  user: {
    id?: string;
    username?: string | null;
    name?: string | null;
    email: string;
  },
  currentUserId?: string,
): string {
  if (currentUserId && user.id === currentUserId) return "You";
  return user.username ? `@${user.username}` : (user.name ?? user.email);
}
