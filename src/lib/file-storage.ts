import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "rooms");

export interface ChatRoom {
  id: string;
  name: string;
  input: string;
  isConnected: boolean;
  isConnecting: boolean;
  isEnded: boolean;
  error: string | null;
  messageCount: number;
  createdAt: string;
}

export interface YouTubeMessage {
  id: string;
  author: {
    name: string;
    thumbnail?: string;
    isVerified: boolean;
    isOwner: boolean;
    isMembership: boolean;
  };
  message: Array<{
    type: "text" | "emoji" | "image";
    text?: string;
    emojiUrl?: string;
    emojiAlt?: string;
  }>;
  timestamp: string;
  isMembership: boolean;
  isSuperChat: boolean;
  amount?: string;
}

// Ensure data directory exists
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getRoomDir(roomId: string): string {
  return path.join(DATA_DIR, roomId);
}

function getRoomsFile(): string {
  return path.join(DATA_DIR, "rooms.json");
}

// Room operations
export function getRooms(): ChatRoom[] {
  const file = getRoomsFile();
  if (!fs.existsSync(file)) {
    return [];
  }
  try {
    const data = fs.readFileSync(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveRooms(rooms: ChatRoom[]): void {
  ensureDir(DATA_DIR);
  fs.writeFileSync(getRoomsFile(), JSON.stringify(rooms, null, 2));
}

export function getRoom(id: string): ChatRoom | undefined {
  const rooms = getRooms();
  return rooms.find((r) => r.id === id);
}

// Normalize YouTube URL to extract unique identifier
function normalizeYouTubeInput(input: string): string {
  const trimmed = input.trim();

  // Handle YouTube URLs
  if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
    // Video URL
    const videoMatch = trimmed.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (videoMatch) {
      return `video:${videoMatch[1]}`;
    }

    // Channel @handle
    const handleMatch = trimmed.match(/@([a-zA-Z0-9_-]+)/);
    if (handleMatch) {
      return `handle:${handleMatch[1]}`;
    }

    // Channel ID
    const channelMatch = trimmed.match(/\/channel\/([a-zA-Z0-9_-]+)/);
    if (channelMatch) {
      return `channel:${channelMatch[1]}`;
    }

    // Custom URL
    const customMatch = trimmed.match(/\/c\/([a-zA-Z0-9_-]+)/);
    if (customMatch) {
      return `custom:${customMatch[1]}`;
    }
  }

  // Handle bare video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `video:${trimmed}`;
  }

  // Handle @handle without URL
  if (trimmed.startsWith("@")) {
    return `handle:${trimmed.slice(1)}`;
  }

  // Assume channel ID
  return `channel:${trimmed}`;
}

export function addRoom(name: string, input: string): { room: ChatRoom; isNew: boolean } {
  const rooms = getRooms();
  const normalizedInput = normalizeYouTubeInput(input);

  // Check if room with same URL already exists
  const existingRoom = rooms.find((r) => normalizeYouTubeInput(r.input) === normalizedInput);
  if (existingRoom) {
    return { room: existingRoom, isNew: false };
  }

  // Create new room
  const room: ChatRoom = {
    id: Date.now().toString(),
    name,
    input,
    isConnected: false,
    isConnecting: false,
    isEnded: false,
    error: null,
    messageCount: 0,
    createdAt: new Date().toISOString(),
  };
  rooms.push(room);

  // Create room directory
  const roomDir = getRoomDir(room.id);
  ensureDir(roomDir);

  // Save rooms list
  saveRooms(rooms);

  return { room, isNew: true };
}

export function updateRoom(id: string, updates: Partial<ChatRoom>): ChatRoom | undefined {
  const rooms = getRooms();
  const index = rooms.findIndex((r) => r.id === id);
  if (index === -1) return undefined;

  rooms[index] = { ...rooms[index], ...updates };
  saveRooms(rooms);
  return rooms[index];
}

export function removeRoom(id: string): boolean {
  const rooms = getRooms();
  const filtered = rooms.filter((r) => r.id !== id);
  if (filtered.length === rooms.length) return false;

  saveRooms(filtered);

  // Remove room directory
  const roomDir = getRoomDir(id);
  if (fs.existsSync(roomDir)) {
    fs.rmSync(roomDir, { recursive: true });
  }

  return true;
}

// Message operations
export function getMessages(roomId: string): YouTubeMessage[] {
  const file = path.join(getRoomDir(roomId), "messages.json");
  if (!fs.existsSync(file)) {
    return [];
  }
  try {
    const data = fs.readFileSync(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveMessages(roomId: string, messages: YouTubeMessage[]): void {
  const roomDir = getRoomDir(roomId);
  ensureDir(roomDir);
  const file = path.join(roomDir, "messages.json");
  fs.writeFileSync(file, JSON.stringify(messages, null, 2));
}

export function addMessage(roomId: string, message: YouTubeMessage): void {
  const messages = getMessages(roomId);
  messages.push(message);

  saveMessages(roomId, messages);

  // Update room message count
  const room = getRoom(roomId);
  if (room) {
    updateRoom(roomId, { messageCount: messages.length });
  }
}

export function clearMessages(roomId: string): void {
  saveMessages(roomId, []);
  updateRoom(roomId, { messageCount: 0 });
}
