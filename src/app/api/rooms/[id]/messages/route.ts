import * as storage from "@/lib/file-storage";

export const dynamic = "force-dynamic";

// GET - Get messages for a room
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const messages = storage.getMessages(id);
  return Response.json(messages);
}

// DELETE - Clear messages for a room
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  storage.clearMessages(id);
  return Response.json({ success: true });
}
