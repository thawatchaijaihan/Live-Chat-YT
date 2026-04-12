import * as db from "@/lib/db";

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
    const results = db.searchMessages(id, query);
    return Response.json(results);
  } catch (error) {
    console.error("Search error:", error);
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
