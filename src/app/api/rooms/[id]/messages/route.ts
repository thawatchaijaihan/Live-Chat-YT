import * as db from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Get messages for a room
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const offsetParam = Number(searchParams.get("offset"));
  const after = searchParams.get("after");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 1000;
  const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0;
  const messages = after
    ? db.getMessagesSince(id, after, limit)
    : db.getMessages(id, limit, offset);

  return Response.json(messages, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

// DELETE - Clear messages for a room
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  db.clearMessages(id);
  return Response.json({ success: true });
}
