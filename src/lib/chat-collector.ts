import { EventEmitter } from "node:events";
import { LiveChat } from "youtube-chat";
import type { ChatItem, YoutubeId } from "youtube-chat/dist/types/data";
import * as db from "@/lib/db";
import { sendToTelegram } from "@/lib/telegram";
import type { YouTubeMessage } from "@/lib/db";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

type CollectorStatus = "connecting" | "connected" | "ended" | "error";

type CollectorEvents = {
  start: (payload: { liveId: string }) => void;
  message: (message: YouTubeMessage) => void;
  end: (payload: { reason?: string }) => void;
  error: (payload: { message: string }) => void;
};

type CollectorEmitter = EventEmitter & {
  on<EventName extends keyof CollectorEvents>(
    eventName: EventName,
    listener: CollectorEvents[EventName]
  ): CollectorEmitter;
  off<EventName extends keyof CollectorEvents>(
    eventName: EventName,
    listener: CollectorEvents[EventName]
  ): CollectorEmitter;
  emit<EventName extends keyof CollectorEvents>(
    eventName: EventName,
    ...args: Parameters<CollectorEvents[EventName]>
  ): boolean;
};

export interface ChatCollector {
  roomId: string;
  emitter: CollectorEmitter;
  status: CollectorStatus;
  liveId?: string;
  error?: string;
  chat: LiveChat | null;
  ignoreEndEvent: boolean;
}

const globalForCollectors = globalThis as typeof globalThis & {
  __liveChatCollectors?: Map<string, ChatCollector>;
};

const collectors = globalForCollectors.__liveChatCollectors ?? new Map<string, ChatCollector>();
globalForCollectors.__liveChatCollectors = collectors;

export function getChatErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message === "Live Stream was not found") {
    return "ยังไม่พบไลฟ์สดของช่องนี้ตอนนี้ ถ้าช่องกำลังไลฟ์อยู่ให้ลองใส่ลิงก์วิดีโอไลฟ์หรือ Video ID โดยตรง";
  }

  if (message === "Continuation was not found") {
    return "พบวิดีโอแล้ว แต่ยังไม่พบ live chat สำหรับวิดีโอนี้";
  }

  if (message.endsWith(" is finished live")) {
    return "ไลฟ์นี้จบแล้ว";
  }

  return message;
}

function parseYouTubeInput(input: string): YoutubeId {
  const trimmed = input.trim();

  if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
    const videoMatch = trimmed.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (videoMatch) {
      return { liveId: videoMatch[1] };
    }

    const handleMatch = trimmed.match(/@([a-zA-Z0-9_-]+)/);
    if (handleMatch) {
      return { handle: handleMatch[1] };
    }

    const channelMatch = trimmed.match(/\/channel\/([a-zA-Z0-9_-]+)/);
    if (channelMatch) {
      return { channelId: channelMatch[1] };
    }

    const customMatch = trimmed.match(/\/c\/([a-zA-Z0-9_-]+)/);
    if (customMatch) {
      return { channelId: customMatch[1] };
    }
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { liveId: trimmed };
  }

  if (trimmed.startsWith("@")) {
    return { handle: trimmed.slice(1) };
  }

  return { channelId: trimmed };
}

function mapChatItem(item: ChatItem): YouTubeMessage {
  return {
    id: item.id || Date.now().toString(),
    author: {
      name: item.author?.name || "Anonymous",
      thumbnail: item.author?.thumbnail?.url,
      isVerified: item.isVerified || false,
      isOwner: item.isOwner || false,
      isMembership: item.isMembership || false,
    },
    message: item.message.map((msg) => {
      if ("emojiText" in msg) {
        return {
          type: "emoji" as const,
          text: msg.emojiText,
          emojiUrl: msg.url,
          emojiAlt: msg.alt,
        };
      }

      return {
        type: "text" as const,
        text: msg.text,
      };
    }),
    timestamp: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
    isMembership: item.isMembership || false,
    isSuperChat: !!item.superchat,
    amount: item.superchat?.amount,
  };
}

function failCollector(collector: ChatCollector, error: unknown) {
  const errorMessage = getChatErrorMessage(error);
  collector.status = "error";
  collector.error = errorMessage;
  collector.ignoreEndEvent = true;
  db.updateRoom(collector.roomId, {
    isConnected: false,
    isConnecting: false,
    error: errorMessage,
  });
  collector.emitter.emit("error", { message: errorMessage });
  collector.chat?.stop(errorMessage);
  collectors.delete(collector.roomId);
}

async function startCollector(collector: ChatCollector, source: YoutubeId) {
  try {
    const chat = new LiveChat(source);
    collector.chat = chat;

    chat.on("start", (liveId: string) => {
      collector.status = "connected";
      collector.liveId = liveId;
      db.updateRoom(collector.roomId, {
        isConnected: true,
        isConnecting: false,
        isEnded: false,
        error: null,
      });
      collector.emitter.emit("start", { liveId });
    });

    chat.on("chat", (item: ChatItem) => {
      const message = mapChatItem(item);
      const isNewMessage = db.addMessage(collector.roomId, message);
      if (!isNewMessage) return;

      const latestRoom = db.getRoom(collector.roomId);
      if (latestRoom?.telegramChatId && TELEGRAM_BOT_TOKEN) {
        void sendToTelegram(TELEGRAM_BOT_TOKEN, latestRoom.telegramChatId, message);
      }

      collector.emitter.emit("message", message);
    });

    chat.on("end", (reason?: string) => {
      if (collector.ignoreEndEvent) return;

      collector.status = "ended";
      db.updateRoom(collector.roomId, {
        isConnected: false,
        isConnecting: false,
        isEnded: true,
      });
      collector.emitter.emit("end", { reason });
      collectors.delete(collector.roomId);
    });

    chat.on("error", (err: unknown) => {
      failCollector(collector, err);
    });

    const started = await chat.start();
    if (!started && collector.status === "connecting") {
      failCollector(collector, new Error("ไม่สามารถเริ่มเชื่อมต่อ live chat ได้"));
    }
  } catch (error) {
    failCollector(collector, error);
  }
}

export function ensureChatCollector(roomId: string) {
  const existingCollector = collectors.get(roomId);
  if (
    existingCollector &&
    (existingCollector.status === "connecting" || existingCollector.status === "connected")
  ) {
    return existingCollector;
  }

  const room = db.getRoom(roomId);
  if (!room) return null;

  const collector: ChatCollector = {
    roomId,
    emitter: new EventEmitter() as CollectorEmitter,
    status: "connecting",
    chat: null,
    ignoreEndEvent: false,
  };

  collectors.set(roomId, collector);
  db.updateRoom(roomId, {
    isConnected: false,
    isConnecting: true,
    isEnded: false,
    error: null,
  });

  void startCollector(collector, parseYouTubeInput(room.input));
  return collector;
}

export function stopChatCollector(roomId: string, reason = "Collector stopped") {
  const collector = collectors.get(roomId);
  if (!collector) return;

  collector.ignoreEndEvent = true;
  collector.status = "ended";
  collector.emitter.emit("end", { reason });
  collector.chat?.stop(reason);
  collector.emitter.removeAllListeners();
  collectors.delete(roomId);
}
