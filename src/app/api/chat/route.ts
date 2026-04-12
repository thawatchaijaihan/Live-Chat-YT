import { LiveChat } from "youtube-chat";
import * as storage from "@/lib/file-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId");

  if (!roomId) {
    return new Response("Missing roomId parameter", { status: 400 });
  }

  const room = storage.getRoom(roomId);
  if (!room) {
    return new Response("Room not found", { status: 404 });
  }

  // Parse YouTube input
  const parseYouTubeInput = (input: string) => {
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
  };

  const encoder = new TextEncoder();
  const parsed = parseYouTubeInput(room.input);
  let isControllerClosed = false;

  // Update room status to connecting
  storage.updateRoom(roomId, { isConnecting: true, isEnded: false, error: null });

  const stream = new ReadableStream({
    async start(controller) {
      let chat: LiveChat | null = null;

      const sendEvent = (event: string, data: object) => {
        if (isControllerClosed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          isControllerClosed = true;
        }
      };

      try {
        chat = new LiveChat(parsed);

        chat.on("start", (liveId: string) => {
          storage.updateRoom(roomId, { isConnected: true, isConnecting: false, isEnded: false });
          sendEvent("start", { liveId });
        });

        chat.on("chat", (item: any) => {
          const message = {
            id: item.id || Date.now().toString(),
            author: {
              name: item.author?.name || "Anonymous",
              thumbnail: item.author?.thumbnail?.url,
              isVerified: item.author?.isVerified || false,
              isOwner: item.author?.isOwner || false,
              isMembership: item.author?.isMembership || false,
            },
            message: (item.message || []).map((msg: any) => ({
              type: msg.type === "emoji" ? "emoji" : msg.type === "image" ? "image" : "text",
              text: msg.text,
              emojiUrl: msg.emojiUrl,
              emojiAlt: msg.emojiAlt,
            })),
            timestamp: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
            isMembership: item.isMembership || false,
            isSuperChat: !!item.superchat,
            amount: item.superchat?.amount,
          };

          // Save message to file
          storage.addMessage(roomId, message);

          sendEvent("chat", message);
        });

        chat.on("end", (reason?: string) => {
          storage.updateRoom(roomId, { isConnected: false, isEnded: true });
          sendEvent("end", { reason });
          try {
            controller.close();
          } catch {
            // Controller already closed
          }
          isControllerClosed = true;
        });

        chat.on("error", (err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          storage.updateRoom(roomId, { isConnected: false, isConnecting: false, error: errorMessage });
          sendEvent("error", { message: errorMessage });
          try {
            controller.close();
          } catch {
            // Controller already closed
          }
          isControllerClosed = true;
        });

        await chat.start();
      } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        storage.updateRoom(roomId, { isConnected: false, isConnecting: false, error: errorMessage });
        sendEvent("error", { message: errorMessage });
        try {
          controller.close();
        } catch {
          // Controller already closed
        }
        isControllerClosed = true;
      }
    },
    cancel() {
      isControllerClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
