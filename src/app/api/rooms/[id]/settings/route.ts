import * as db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const { telegramChatId, retentionDays } = body;

  // Build updates object
  const updates: Partial<db.ChatRoom> = {};

  if (typeof telegramChatId === "string") {
    updates.telegramChatId = telegramChatId || undefined;
  }

  // Validate retentionDays
  if (typeof retentionDays === "number" && retentionDays >= 1 && retentionDays <= 90) {
    // Store in a settings object (we'll add a settings column or use room metadata)
    // For now, we'll run cleanup immediately when saving
    if (telegramChatId !== undefined || retentionDays !== undefined) {
      const currentRoom = db.getRoom(id);
      if (currentRoom) {
        // Run cleanup with new retention days if changed
        db.cleanupOldMessages(id, retentionDays || 3);
      }
    }
  }

  const room = db.updateRoom(id, updates);
  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  return Response.json(room);
}
