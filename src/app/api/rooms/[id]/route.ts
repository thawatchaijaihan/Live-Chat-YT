import * as storage from "@/lib/file-storage";

export const dynamic = "force-dynamic";

// GET - Get a specific room
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const room = storage.getRoom(id);

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  return Response.json(room);
}

// PATCH - Update a room
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const updates = await request.json();
  const room = storage.updateRoom(id, updates);

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
  const success = storage.removeRoom(id);

  if (!success) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
