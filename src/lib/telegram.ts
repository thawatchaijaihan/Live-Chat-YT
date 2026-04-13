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

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "เวลาไม่ระบุ";
    return date.toISOString().replace("T", " ").split(".")[0];
  };

  const formatMessageContent = (message: TelegramMessage) =>
    message.message
      .map((segment) => {
        if (segment.type === "text") {
          return escapeHtml(segment.text ?? "");
        }
        if (segment.type === "emoji") {
          return escapeHtml(segment.emojiAlt ?? "");
        }
        if (segment.type === "image") {
          return escapeHtml(segment.emojiAlt ?? "[รูปภาพ]");
        }
        return "";
      })
      .join("")
      .trim();

  try {
    const badges: string[] = [];
    if (message.author.isOwner) badges.push("Creator");
    if (message.author.isMembership || message.isMembership) badges.push("Member");
    if (message.isSuperChat) badges.push("Super Chat");

    // Remove @ prefix if present and add person icon
    const authorName = message.author.name.startsWith("@")
      ? message.author.name.slice(1)
      : message.author.name;

    const header = [`👤 <b>${escapeHtml(authorName)}</b>`];
    if (badges.length) {
      header.push(`<i>${escapeHtml(badges.join(" • "))}</i>`);
    }
    if (message.isSuperChat && message.amount) {
      header.push(`<b>ยอด</b> <code>${escapeHtml(message.amount)}</code>`);
    }

    const lines = [header.join(" ")];
    const content = formatMessageContent(message);
    if (content) lines.push(content);

    const text = lines.join("\n");

    const response = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Telegram API error:", response.status, errorBody);
    }

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