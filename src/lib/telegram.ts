const TELEGRAM_API = "https://api.telegram.org/bot";

export interface TelegramMessage {
  id: string;
  author: {
    name: string;
    isOwner: boolean;
    isMembership: boolean;
  };
  message: Array<{
    type: "text" | "emoji" | "image";
    text?: string;
    emojiUrl?: string;
    emojiAlt?: string;
  }>;
  timestamp: string;
  isMembership: boolean;
  isSuperChat: boolean;
  amount?: string;
}

export async function sendToTelegram(
  botToken: string,
  chatId: string,
  message: TelegramMessage
): Promise<boolean> {
  if (!chatId || !botToken) return false;

  try {
    // Format message text
    const parts: string[] = [];

    // Author name with badges
    let authorText = message.author.name;
    if (message.author.isOwner) authorText += " [Creator]";
    if (message.author.isMembership || message.isMembership) authorText += " [Member]";
    if (message.isSuperChat && message.amount) authorText += ` [$${message.amount} Super Chat]`;

    parts.push(authorText);

    // Message content
    const content = message.message.map((m) => m.text || "").join("").trim();
    if (content) {
      parts.push(content);
    }

    const text = parts.join("\n");

    const response = await fetch(
      `${TELEGRAM_API}${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error("Telegram send error:", error);
    return false;
  }
}

export async function sendTextToTelegram(
  botToken: string,
  chatId: string,
  text: string
): Promise<boolean> {
  if (!chatId || !botToken) return false;

  try {
    const response = await fetch(
      `${TELEGRAM_API}${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error("Telegram send error:", error);
    return false;
  }
}