"use client";

import * as React from "react";
import type { YouTubeMessage } from "./db";

interface YouTubeChatContextType {
  messages: YouTubeMessage[];
  isConnected: boolean;
  isConnecting: boolean;
  isEnded: boolean;
  error: string | null;
  connect: (roomId: string) => void;
  disconnect: () => void;
}

const YouTubeChatContext = React.createContext<YouTubeChatContextType | null>(null);

export function YouTubeChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<YouTubeMessage[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isEnded, setIsEnded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);

  const disconnect = React.useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const connect = React.useCallback((roomId: string) => {
    disconnect();
    setError(null);
    setIsEnded(false);
    setIsConnecting(true);
    setMessages([]);

    const eventSource = new EventSource(`/api/chat?roomId=${encodeURIComponent(roomId)}`);
    eventSourceRef.current = eventSource;

    const parseEventData = (e: MessageEvent) => {
      if (!e.data) return null;
      try {
        return JSON.parse(e.data);
      } catch {
        return null;
      }
    };

    eventSource.addEventListener("start", (e) => {
      const data = parseEventData(e as MessageEvent);
      if (!data) return;
      setIsConnected(true);
      setIsConnecting(false);
      setIsEnded(false);
    });

    eventSource.addEventListener("chat", (e) => {
      const data = parseEventData(e as MessageEvent);
      if (!data) return;
      setMessages((prev) => [...prev, data].slice(-500));
    });

    eventSource.addEventListener("end", (e) => {
      const data = parseEventData(e as MessageEvent);
      setIsConnected(false);
      setIsConnecting(false);
      setIsEnded(true);
      eventSource.close();
    });

    eventSource.addEventListener("chat-error", (e) => {
      const data = parseEventData(e as MessageEvent);
      if (!data) return;
      setError(data.message);
      setIsConnecting(false);
      setIsConnected(false);
      eventSource.close();
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setIsConnecting(false);
        setIsConnected(false);
      }
    };
  }, [disconnect]);

  React.useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <YouTubeChatContext.Provider
      value={{
        messages,
        isConnected,
        isConnecting,
        isEnded,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </YouTubeChatContext.Provider>
  );
}

export function useYouTubeChat() {
  const context = React.useContext(YouTubeChatContext);
  if (!context) {
    throw new Error("useYouTubeChat must be used within YouTubeChatProvider");
  }
  return context;
}
