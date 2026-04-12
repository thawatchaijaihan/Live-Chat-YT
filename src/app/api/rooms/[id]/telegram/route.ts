import * as db from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH - Update room's Telegram chat ID
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { telegramChatId } = await request.json();

  const room = db.updateRoom(id, { telegramChatId });
  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  return Response.json(room);
}