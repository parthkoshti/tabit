function formatNameAsFirstLastInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${firstName} ${lastInitial}`;
}

export function getDisplayName(
  user: {
    id?: string;
    username?: string | null;
    name?: string | null;
    email?: string | null;
  },
  currentUserId?: string,
  options?: { useFullName?: boolean },
): string {
  if (currentUserId && user.id === currentUserId) return "You";
  const name = user.name ?? null;
  if (name)
    return options?.useFullName ? name : formatNameAsFirstLastInitial(name);
  return user.username ? `@${user.username}` : user.email ?? "";
}
