import HomeClient from "./home-client";
import * as db from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    roomId?: string | string[];
    view?: string | string[];
  }>;
};

function getInitialView(view: string | string[] | undefined) {
  const value = Array.isArray(view) ? view[0] : view;
  if (value === "chat" || value === "viewers") {
    return value;
  }
  return "dashboard";
}

function getInitialRoomId(roomId: string | string[] | undefined) {
  return Array.isArray(roomId) ? roomId[0] : roomId;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialRooms = db.getRooms();
  const requestedRoomId = getInitialRoomId(params?.roomId);
  const initialActiveRoomId: string | null =
    requestedRoomId && initialRooms.some((room) => room.id === requestedRoomId)
    ? requestedRoomId
    : initialRooms[0]?.id ?? null;
  const initialMessagesByRoom = Object.fromEntries(
    initialRooms.map((room) => [room.id, db.getMessages(room.id, 100)])
  );

  return (
    <HomeClient
      initialActiveRoomId={initialActiveRoomId}
      initialMessagesByRoom={initialMessagesByRoom}
      initialRooms={initialRooms}
      initialView={getInitialView(params?.view)}
    />
  );
}
