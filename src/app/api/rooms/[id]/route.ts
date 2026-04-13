import * as db from "@/lib/db";
import { stopChatCollector } from "@/lib/chat-collector";

export const dynamic = "force-dynamic";

// GET - Get a specific room
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const room = db.getRoom(id);

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  return Response.json(room, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

// PATCH - Update a room
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const updates = await request.json();
  const room = db.updateRoom(id, updates);

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  return Response.json(room);
}

// DELETE - Remove a room
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  stopChatCollector(id, "Room deleted");
  const success = db.removeRoom(id);

  if (!success) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
