import * as db from "@/lib/db";

export const dynamic = "force-dynamic";

const MINIMAX_API_URL = "https://api.minimax.io/anthropic/v1/messages";

export async function POST(request: Request) {
  try {
    const { roomId, messageCount = 50 } = await request.json();

    if (!roomId) {
      return Response.json({ error: "Missing roomId" }, { status: 400 });
    }

    // Get recent messages from database
    const messages = db.getMessages(roomId, messageCount, 0);

    if (messages.length === 0) {
      return Response.json({ error: "No messages found" }, { status: 404 });
    }

    // Format messages for AI
    const formattedMessages = messages
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

    const room = db.getRoom(roomId);
    const roomName = room?.name || "Unknown Room";

    const prompt = `You are a Thai-language AI assistant analyzing YouTube live chat messages.

Please analyze and summarize the following chat messages from the room "${roomName}" in Thai language:

${formattedMessages}

Please provide:
1. **สรุปประเด็นหลัก** (Main Topics) - What are the main topics discussed?
2. **ความรู้สึกโดยรวม** (Overall Sentiment) - Positive, Negative, or Neutral
3. **ผู้ใช้ที่activeมากที่สุด** (Most Active Users) - Top 3 most active chatters
4. **ประเด็นที่น่าสนใจ** (Interesting Points) - Any notable moments or highlights

Format your response in Thai language with clear sections.`;

    const apiKey = process.env.MINIMAX_API_KEY;

    if (!apiKey) {
      return Response.json({ error: "MiniMax API key not configured" }, { status: 500 });
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
            content: prompt,
          },
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
    console.log("MiniMax response:", JSON.stringify(data));

    // Try different response formats
    let summary = "ไม่สามารถสร้างสรุปได้";

    // Format 1: Anthropic-style
    if (data.content?.[0]?.text) {
      summary = data.content[0].text;
    }
    // Format 2: MiniMax might return directly in text field
    else if (data.text) {
      summary = data.text;
    }
    // Format 3: MiniMax might use a different structure
    else if (data.choices?.[0]?.message?.content) {
      summary = data.choices[0].message.content;
    }

    return Response.json({
      summary,
      messageCount: messages.length,
      roomName,
    });
  } catch (error) {
    console.error("Summarize error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
