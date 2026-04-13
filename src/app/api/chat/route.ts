import { ensureChatCollector } from "@/lib/chat-collector";
import * as db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId");

  if (!roomId) {
    return new Response("Missing roomId parameter", { status: 400 });
  }

  const room = db.getRoom(roomId);
  if (!room) {
    return new Response("Room not found", { status: 404 });
  }

  const collector = ensureChatCollector(roomId);
  if (!collector) {
    return new Response("Room not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let isControllerClosed = false;
      let heartbeatId: ReturnType<typeof setInterval> | null = null;

      const sendRaw = (payload: string) => {
        if (isControllerClosed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          isControllerClosed = true;
        }
      };

      const sendEvent = (event: string, data: object) => {
        sendRaw(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const closeStream = () => {
        if (isControllerClosed) return;
        cleanup();
        try {
          controller.close();
        } catch {
          // Controller already closed
        }
        isControllerClosed = true;
      };

      const onStart = (payload: { liveId: string }) => {
        sendEvent("start", payload);
      };

      const onMessage = (message: db.YouTubeMessage) => {
        sendEvent("chat", message);
      };

      const onEnd = (payload: { reason?: string }) => {
        sendEvent("end", payload);
        closeStream();
      };

      const onError = (payload: { message: string }) => {
        sendEvent("chat-error", payload);
        closeStream();
      };

      cleanup = () => {
        collector.emitter.off("start", onStart);
        collector.emitter.off("message", onMessage);
        collector.emitter.off("end", onEnd);
        collector.emitter.off("error", onError);
        if (heartbeatId) {
          clearInterval(heartbeatId);
          heartbeatId = null;
        }
      };

      collector.emitter.on("start", onStart);
      collector.emitter.on("message", onMessage);
      collector.emitter.on("end", onEnd);
      collector.emitter.on("error", onError);

      if (collector.status === "connected" && collector.liveId) {
        sendEvent("start", { liveId: collector.liveId });
      } else if (collector.status === "error" && collector.error) {
        sendEvent("chat-error", { message: collector.error });
        closeStream();
        return;
      } else if (collector.status === "ended") {
        sendEvent("end", {});
        closeStream();
        return;
      }

      heartbeatId = setInterval(() => {
        sendRaw(": ping\n\n");
      }, 15000);
    },
    cancel() {
      cleanup();
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
