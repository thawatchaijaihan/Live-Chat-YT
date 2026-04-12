import * as storage from "@/lib/file-storage";

export const dynamic = "force-dynamic";

// GET - Get all rooms
export async function GET() {
  const rooms = storage.getRooms();
  return Response.json(rooms);
}

// POST - Add a new room
export async function POST(request: Request) {
  try {
    const { name, input } = await request.json();

    if (!name || !input) {
      return Response.json({ error: "Missing name or input" }, { status: 400 });
    }

    const result = storage.addRoom(name, input);
    return Response.json(result, { status: result.isNew ? 201 : 200 });
  } catch (error) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
