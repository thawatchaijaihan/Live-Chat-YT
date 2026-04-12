import axios from "axios";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get("input");

  if (!input) {
    return Response.json({ error: "Missing input" }, { status: 400 });
  }

  try {
    // Parse YouTube input to get channel URL
    const parseYouTubeInput = (input: string) => {
      const trimmed = input.trim();

      // Check for full URL
      if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
        // Video URL - need to get channel from video page
        const videoMatch = trimmed.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (videoMatch) {
          return { type: "video", id: videoMatch[1] };
        }

        // Channel URL with @handle pattern
        const handleMatch = trimmed.match(/@([a-zA-Z0-9_-]+)/);
        if (handleMatch) {
          return { type: "handle", id: handleMatch[1] };
        }

        // Channel URL with channel/ pattern
        const channelMatch = trimmed.match(/\/channel\/([a-zA-Z0-9_-]+)/);
        if (channelMatch) {
          return { type: "channel", id: channelMatch[1] };
        }

        // Channel URL with c/ pattern
        const customMatch = trimmed.match(/\/c\/([a-zA-Z0-9_-]+)/);
        if (customMatch) {
          return { type: "custom", id: customMatch[1] };
        }
      }

      // If it's just a video ID
      if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
        return { type: "video", id: trimmed };
      }

      // If starts with @, it's a handle
      if (trimmed.startsWith("@")) {
        return { type: "handle", id: trimmed.slice(1) };
      }

      // Assume it's a channel ID
      return { type: "channel", id: trimmed };
    };

    const parsed = parseYouTubeInput(input);

    let channelName = "";
    let channelUrl = "";

    if (parsed.type === "handle") {
      channelUrl = `https://www.youtube.com/@${parsed.id}`;
    } else if (parsed.type === "channel") {
      channelUrl = `https://www.youtube.com/channel/${parsed.id}`;
    } else if (parsed.type === "custom") {
      channelUrl = `https://www.youtube.com/c/${parsed.id}`;
    } else if (parsed.type === "video") {
      channelUrl = `https://www.youtube.com/watch?v=${parsed.id}`;
    }

    // Fetch the page to get channel name
    const response = await axios.get(channelUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // Extract channel name from page HTML
    const html = response.data as string;

    // Try to find channel name in various ways
    let nameMatch = html.match(/"channelName":"([^"]+)"/);
    if (nameMatch) {
      channelName = nameMatch[1];
    } else {
      nameMatch = html.match(/<title>([^<]+)<\/title>/);
      if (nameMatch) {
        channelName = nameMatch[1].replace(" - YouTube", "").replace(" - Live", "");
      }
    }

    return Response.json({
      name: channelName || parsed.id,
      url: channelUrl,
    });
  } catch (error: any) {
    return Response.json({
      name: "",
      error: error.message,
    });
  }
}
