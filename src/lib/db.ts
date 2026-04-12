import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const BUNDLED_DATA_DIR = path.join(process.cwd(), "data");
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "live-chat-yt")
  : BUNDLED_DATA_DIR;

let db: Database.Database | null = null;

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
  telegramChatId?: string;
}

// SSE format (returned from API)
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

// Internal DB row format
interface ChatRoomRow {
  id: string;
  name: string;
  input: string;
  isConnected: number;
  isConnecting: number;
  isEnded: number;
  error: string | null;
  messageCount: number;
  createdAt: string;
  telegramChatId: string | null;
}

interface YouTubeMessageRow {
  id: string;
  roomId: string;
  authorName: string;
  authorThumbnail: string | null;
  authorIsVerified: number;
  authorIsOwner: number;
  authorIsMembership: number;
  messageJson: string;
  timestamp: string;
  isMembership: number;
  isSuperChat: number;
  amount: string | null;
}

interface CountRow {
  cnt: number;
}

function getDbPath(): string {
  // Ensure directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  return path.join(DATA_DIR, "chat.db");
}

function mapRoomRow(row: ChatRoomRow): ChatRoom {
  return {
    id: row.id,
    name: row.name,
    input: row.input,
    isConnected: Boolean(row.isConnected),
    isConnecting: Boolean(row.isConnecting),
    isEnded: Boolean(row.isEnded),
    error: row.error,
    messageCount: row.messageCount,
    createdAt: row.createdAt,
    telegramChatId: row.telegramChatId ?? undefined,
  };
}

function mapMessageRow(row: YouTubeMessageRow): YouTubeMessage {
  return {
    id: row.id,
    author: {
      name: row.authorName,
      thumbnail: row.authorThumbnail ?? undefined,
      isVerified: Boolean(row.authorIsVerified),
      isOwner: Boolean(row.authorIsOwner),
      isMembership: Boolean(row.authorIsMembership),
    },
    message: JSON.parse(row.messageJson),
    timestamp: row.timestamp,
    isMembership: Boolean(row.isMembership),
    isSuperChat: Boolean(row.isSuperChat),
    amount: row.amount ?? undefined,
  };
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath();
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    initializeSchema();
  }
  return db;
}

function initializeSchema(): void {
  const database = db!;

  // Create rooms table
  database.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      input TEXT NOT NULL,
      isConnected INTEGER DEFAULT 0,
      isConnecting INTEGER DEFAULT 0,
      isEnded INTEGER DEFAULT 0,
      error TEXT,
      messageCount INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      telegramChatId TEXT
    )
  `);

  // Create messages table
  database.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      authorName TEXT NOT NULL,
      authorThumbnail TEXT,
      authorIsVerified INTEGER DEFAULT 0,
      authorIsOwner INTEGER DEFAULT 0,
      authorIsMembership INTEGER DEFAULT 0,
      messageJson TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      isMembership INTEGER DEFAULT 0,
      isSuperChat INTEGER DEFAULT 0,
      amount TEXT,
      FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_roomId ON messages(roomId);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_authorName ON messages(authorName);
  `);
}

// Room operations
export function getRooms(): ChatRoom[] {
  const database = getDb();
  const rows = database.prepare("SELECT * FROM rooms ORDER BY createdAt DESC").all() as ChatRoomRow[];
  return rows.map(mapRoomRow);
}

export function getRoom(id: string): ChatRoom | undefined {
  const database = getDb();
  const row = database.prepare("SELECT * FROM rooms WHERE id = ?").get(id) as ChatRoomRow | undefined;
  if (!row) return undefined;
  return mapRoomRow(row);
}

export function saveRoom(room: ChatRoom): void {
  const database = getDb();
  database.prepare(`
    INSERT INTO rooms (id, name, input, isConnected, isConnecting, isEnded, error, messageCount, createdAt, telegramChatId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      input = excluded.input,
      isConnected = excluded.isConnected,
      isConnecting = excluded.isConnecting,
      isEnded = excluded.isEnded,
      error = excluded.error,
      messageCount = excluded.messageCount,
      createdAt = excluded.createdAt,
      telegramChatId = excluded.telegramChatId
  `).run(
    room.id,
    room.name,
    room.input,
    room.isConnected ? 1 : 0,
    room.isConnecting ? 1 : 0,
    room.isEnded ? 1 : 0,
    room.error,
    room.messageCount,
    room.createdAt,
    room.telegramChatId || null
  );
}

export function updateRoom(id: string, updates: Partial<ChatRoom>): ChatRoom | undefined {
  const room = getRoom(id);
  if (!room) return undefined;

  const updated = { ...room, ...updates };
  saveRoom(updated);
  return updated;
}

export function removeRoom(id: string): boolean {
  const database = getDb();
  const result = database.prepare("DELETE FROM rooms WHERE id = ?").run(id);
  // Messages are cascade deleted
  return result.changes > 0;
}

// Message operations
export function getMessages(roomId: string, limit = 1000, offset = 0): YouTubeMessage[] {
  const database = getDb();
  const rows = database.prepare(
    "SELECT * FROM messages WHERE roomId = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?"
  ).all(roomId, limit, offset) as YouTubeMessageRow[];

  return rows.map(mapMessageRow);
}

export function addMessage(roomId: string, message: YouTubeMessage): boolean {
  const database = getDb();

  // First ensure room exists
  const room = getRoom(roomId);
  if (!room) return false;

  const result = database.prepare(`
    INSERT OR IGNORE INTO messages (id, roomId, authorName, authorThumbnail, authorIsVerified, authorIsOwner, authorIsMembership, messageJson, timestamp, isMembership, isSuperChat, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    message.id,
    roomId,
    message.author.name,
    message.author.thumbnail || null,
    message.author.isVerified ? 1 : 0,
    message.author.isOwner ? 1 : 0,
    message.author.isMembership ? 1 : 0,
    JSON.stringify(message.message),
    message.timestamp,
    message.isMembership ? 1 : 0,
    message.isSuperChat ? 1 : 0,
    message.amount || null
  );

  // Update room message count
  const count = database.prepare("SELECT COUNT(*) as cnt FROM messages WHERE roomId = ?").get(roomId) as CountRow;
  updateRoom(roomId, { messageCount: count.cnt });
  return result.changes > 0;
}

export function clearMessages(roomId: string): void {
  const database = getDb();
  database.prepare("DELETE FROM messages WHERE roomId = ?").run(roomId);
  updateRoom(roomId, { messageCount: 0 });
}

export function searchMessages(roomId: string, query: string, limit = 50): YouTubeMessage[] {
  const database = getDb();
  const searchPattern = `%${query.toLowerCase()}%`;

  const rows = database.prepare(`
    SELECT * FROM messages
    WHERE roomId = ? AND (
      LOWER(authorName) LIKE ? OR
      LOWER(messageJson) LIKE ?
    )
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(roomId, searchPattern, searchPattern, limit) as YouTubeMessageRow[];

  return rows.map(mapMessageRow);
}

// Normalize YouTube URL to extract unique identifier
export function normalizeYouTubeInput(input: string): string {
  const trimmed = input.trim();

  if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
    const videoMatch = trimmed.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (videoMatch) {
      return `video:${videoMatch[1]}`;
    }

    const handleMatch = trimmed.match(/@([a-zA-Z0-9_-]+)/);
    if (handleMatch) {
      return `handle:${handleMatch[1]}`;
    }

    const channelMatch = trimmed.match(/\/channel\/([a-zA-Z0-9_-]+)/);
    if (channelMatch) {
      return `channel:${channelMatch[1]}`;
    }

    const customMatch = trimmed.match(/\/c\/([a-zA-Z0-9_-]+)/);
    if (customMatch) {
      return `custom:${customMatch[1]}`;
    }
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `video:${trimmed}`;
  }

  if (trimmed.startsWith("@")) {
    return `handle:${trimmed.slice(1)}`;
  }

  return `channel:${trimmed}`;
}

export function addRoom(name: string, input: string): { room: ChatRoom; isNew: boolean } {
  const database = getDb();
  const normalizedInput = normalizeYouTubeInput(input);

  // Check if room with same URL already exists
  const existingRooms = database.prepare("SELECT * FROM rooms").all() as ChatRoomRow[];
  const existingRoom = existingRooms.find((r) => normalizeYouTubeInput(r.input) === normalizedInput);
  if (existingRoom) {
    return { room: mapRoomRow(existingRoom), isNew: false };
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

  saveRoom(room);
  return { room, isNew: true };
}
