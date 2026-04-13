import * as db from "@/lib/db";

export const dynamic = "force-dynamic";

const MINIMAX_API_URL = "https://api.minimax.io/anthropic/v1/messages";

export async function POST(request: Request) {
  try {
    const { messages, roomId, includeChatContext = true } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Missing messages" }, { status: 400 });
    }

    const apiKey = process.env.MINIMAX_API_KEY;

    if (!apiKey) {
      return Response.json({ error: "MiniMax API key not configured" }, { status: 500 });
    }

    // Get room context and recent messages if roomId provided
    let roomContext = "";
    let chatContext = "";

    if (roomId && includeChatContext) {
      const room = db.getRoom(roomId);
      if (room) {
        roomContext = `\n\nChat Room: "${room.name}"`;

        // Get recent messages from this room
        const recentMessages = db.getMessages(roomId, 50, 0);
        if (recentMessages.length > 0) {
          const formattedMessages = recentMessages
            .slice(0, 50)
            .map((msg) => {
              const content = msg.message
                .map((m) => m.text || "")
                .join("")
                .trim();
              return `[${msg.author.name}]: ${content}`;
            })
            .reverse()
            .join("\n");

          chatContext = `\n\nRecent chat messages from this room:\n${formattedMessages}`;
        }
      }
    }

    const response = await fetch(MINIMAX_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "MiniMax-M2.7",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `You are a helpful AI assistant.${roomContext}${chatContext}\n\nKeep responses concise and natural, in Thai language.`,
          },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MiniMax API error:", response.status, errorText);
      return Response.json(
        { error: `MiniMax API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    let reply = "ขอโทษนะ เกิดข้อผิดพลาด";

    // MiniMax returns content as array with type "text" or "thinking"
    if (data.content && Array.isArray(data.content)) {
      const textContent = data.content.find((c: { type: string }) => c.type === "text");
      if (textContent?.text) {
        reply = textContent.text;
      }
    } else if (data.text) {
      reply = data.text;
    } else if (data.choices?.[0]?.message?.content) {
      reply = data.choices[0].message.content;
    }

    return Response.json({ reply });
  } catch (error) {
    console.error("Chat AI error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}