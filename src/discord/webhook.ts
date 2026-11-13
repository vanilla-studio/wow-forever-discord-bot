export interface DiscordEmbed {
  author?: { name: string };
  title?: string;
  description: string;
  color?: number;
  thumbnail?: { url: string };
  footer?: { text: string };
  timestamp?: string;
}

/**
 * Posts one or more embeds to the configured Discord webhook.
 * Discord accepts up to 10 embeds per message, so we chunk if needed.
 */
export async function publishEmbeds(webhookUrl: string, embeds: DiscordEmbed[]): Promise<void> {
  if (embeds.length === 0) {
    return;
  }

  for (let i = 0; i < embeds.length; i += 10) {
    const chunk = embeds.slice(i, i + 10);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ embeds: chunk }),
    });

    if (!res.ok) {
      throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
    }
  }
}
