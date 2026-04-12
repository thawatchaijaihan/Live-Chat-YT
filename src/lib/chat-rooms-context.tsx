"use client";

import * as React from "react";
import type { ChatRoom, YouTubeMessage } from "./db";

interface ChatRoomsContextType {
  rooms: ChatRoom[];
  activeRoomId: string | null;
  loading: boolean;
  setActiveRoom: (id: string | null) => void;
  fetchRooms: () => Promise<void>;
  addRoom: (name: string, input: string) => Promise<string | null>;
  removeRoom: (id: string) => Promise<void>;
  getMessages: (roomId: string) => Promise<YouTubeMessage[]>;
  clearMessages: (roomId: string) => Promise<void>;
  fetchRoomStatus: (roomId: string) => Promise<ChatRoom | null>;
  searchMessages: (roomId: string, query: string) => Promise<YouTubeMessage[]>;
}

const ChatRoomsContext = React.createContext<ChatRoomsContextType | null>(null);

export function ChatRoomsProvider({ children }: { children: React.ReactNode }) {
  const [rooms, setRooms] = React.useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const fetchRooms = React.useCallback(async () => {
    try {
      const response = await fetch("/api/rooms");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setRooms(data);
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    }
  }, []);

  const fetchRoomStatus = React.useCallback(async (roomId: string): Promise<ChatRoom | null> => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`);
      if (response.ok) {
        const room = await response.json();
        setRooms((prev) => prev.map((r) => (r.id === roomId ? room : r)));
        return room;
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch room status:", error);
      return null;
    }
  }, []);

  const addRoom = React.useCallback(async (name: string, input: string): Promise<string | null> => {
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, input }),
      });

      if (response.ok) {
        const result = await response.json();
        const room = result.room;

        if (result.isNew) {
          // New room - add to state
          setRooms((prev) => [...prev, room]);
        } else {
          // Existing room - ensure it's in state and update if needed
          setRooms((prev) => {
            const exists = prev.find((r) => r.id === room.id);
            if (exists) {
              return prev.map((r) => (r.id === room.id ? room : r));
            }
            return [...prev, room];
          });
        }

        setActiveRoomId(room.id);
        return room.id;
      }
      return null;
    } catch (error) {
      console.error("Failed to add room:", error);
      return null;
    }
  }, []);

  const removeRoom = React.useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/rooms/${id}`, { method: "DELETE" });
      if (response.ok) {
        setRooms((prev) => prev.filter((room) => room.id !== id));
        if (activeRoomId === id) {
          setActiveRoomId(null);
        }
      }
    } catch (error) {
      console.error("Failed to remove room:", error);
    }
  }, [activeRoomId]);

  const getMessages = React.useCallback(async (roomId: string): Promise<YouTubeMessage[]> => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/messages`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error("Failed to get messages:", error);
      return [];
    }
  }, []);

  const clearMessages = React.useCallback(async (roomId: string) => {
    try {
      await fetch(`/api/rooms/${roomId}/messages`, { method: "DELETE" });
    } catch (error) {
      console.error("Failed to clear messages:", error);
    }
  }, []);

  const searchMessages = React.useCallback(async (roomId: string, query: string): Promise<YouTubeMessage[]> => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/messages/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error("Failed to search messages:", error);
      return [];
    }
  }, []);

  return (
    <ChatRoomsContext.Provider
      value={{
        rooms,
        activeRoomId,
        loading,
        setActiveRoom: setActiveRoomId,
        fetchRooms,
        addRoom,
        removeRoom,
        getMessages,
        clearMessages,
        fetchRoomStatus,
        searchMessages,
      }}
    >
      {children}
    </ChatRoomsContext.Provider>
  );
}

export function useChatRooms() {
  const context = React.useContext(ChatRoomsContext);
  if (!context) {
    throw new Error("useChatRooms must be used within ChatRoomsProvider");
  }
  return context;
}
