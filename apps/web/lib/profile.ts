export function needsProfileSetup(
  user: { name?: string | null; username?: string | null } | null,
): boolean {
  if (!user) return false;
  const name = user.name?.trim();
  const username = user.username?.trim();
  return !name || !username;
}
