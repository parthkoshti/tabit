export function getDisplayName(user: {
  username?: string | null;
  name?: string | null;
  email: string;
}): string {
  return user.username ?? user.name ?? user.email;
}
