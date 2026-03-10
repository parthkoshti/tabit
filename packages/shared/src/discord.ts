const AVATAR_URL = "https://app.tabit.in/icon-192x192.png";

export function sendDiscordWebhook(content: string): void {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const body = {
    content,
    username: "Tab",
    avatar_url: AVATAR_URL,
  };

  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((err) => console.error("Discord webhook failed:", err));
}
