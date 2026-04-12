import * as storage from "@/lib/file-storage";

export const dynamic = "force-dynamic";

// GET - Search messages in a room
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase();

  if (!query) {
    return Response.json([]);
  }

  try {
    const messages = storage.getMessages(id);
    const results = messages.filter((msg) => {
      // Search by author name
      if (msg.author.name.toLowerCase().includes(query)) {
        return true;
      }
      // Search in message content
      if (msg.message.some((m) => m.text?.toLowerCase().includes(query))) {
        return true;
      }
      return false;
    });

    // Return most recent results first, limit to 50
    return Response.json(results.slice(-50).reverse());
  } catch (error) {
    console.error("Search error:", error);
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
