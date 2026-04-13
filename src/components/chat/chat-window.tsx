"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useYouTubeChat } from "@/lib/youtube-chat-context";
import { useChatRooms } from "@/lib/chat-rooms-context";
import type { YouTubeMessage } from "@/lib/db";
import { formatThaiTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { MessageSquare, Radio, ChevronDown, X, Plus, Loader2, WifiOff, Search } from "lucide-react";

const MESSAGE_POLL_INTERVAL_MS = 2500;
const MESSAGE_POLL_LIMIT = 300;
const MESSAGE_SNAPSHOT_LIMIT = 120;
const WAKE_REFRESH_THROTTLE_MS = 2000;
const NEAR_BOTTOM_PX = 240;

function mergeMessages(existing: YouTubeMessage[], incoming: YouTubeMessage[]) {
  if (incoming.length === 0) return existing;

  const existingIds = new Set(existing.map((message) => message.id));
  const nextMessages = [...existing];
  let hasNewMessages = false;

  for (const message of incoming) {
    if (!existingIds.has(message.id)) {
      existingIds.add(message.id);
      nextMessages.push(message);
      hasNewMessages = true;
    }
  }

  return hasNewMessages ? nextMessages : existing;
}

function getLatestMessageTimestamp(messages: YouTubeMessage[]) {
  let latestTimestamp = "";

  for (const message of messages) {
    if (!latestTimestamp || Date.parse(message.timestamp) > Date.parse(latestTimestamp)) {
      latestTimestamp = message.timestamp;
    }
  }

  return latestTimestamp;
}

export function ChatWindow() {
  const { rooms, activeRoomId, initialMessagesByRoom, setActiveRoom, addRoom, removeRoom, getMessages, clearMessages, searchMessages, fetchRoomStatus } = useChatRooms();
  const { messages: sseMessages, isConnected, isConnecting, isEnded, error, connect, disconnect } = useYouTubeChat();
  const [storedMessages, setStoredMessages] = React.useState<YouTubeMessage[]>(
    () => (activeRoomId ? initialMessagesByRoom[activeRoomId] ?? [] : [])
  );
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = React.useState(true);
  const [newRoomName, setNewRoomName] = React.useState("");
  const [newRoomInput, setNewRoomInput] = React.useState("");
  const lastMessageCountRef = React.useRef(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<YouTubeMessage[]>([]);
  const [highlightedMsgId, setHighlightedMsgId] = React.useState<string | null>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const prevEndedRoomsRef = React.useRef<Set<string>>(new Set());
  const latestMessageTimestampRef = React.useRef("");
  const lastWakeRefreshRef = React.useRef(0);
  const [displayLimit, setDisplayLimit] = React.useState(100);

  // Active room
  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const activeRoomIsConnected = Boolean(activeRoom?.isConnected || isConnected);
  const activeRoomIsConnecting = Boolean(activeRoom?.isConnecting || isConnecting);
  const activeRoomIsEnded = Boolean(isEnded || activeRoom?.isEnded);
  const activeRoomError = error ?? activeRoom?.error ?? null;

  // Connect to room when active room changes
  const prevRoomIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (activeRoomId && activeRoom) {
      const cachedMessages = initialMessagesByRoom[activeRoomId] ?? [];

      // If switching rooms, disconnect from previous first
      if (prevRoomIdRef.current && prevRoomIdRef.current !== activeRoomId) {
        disconnect();
        setStoredMessages(cachedMessages);
        setDisplayLimit(100); // Reset display limit when switching rooms
      } else if (storedMessages.length === 0 && cachedMessages.length > 0) {
        setStoredMessages(cachedMessages);
        lastMessageCountRef.current = cachedMessages.length;
      }

      // Fetch existing messages from SQLite
      getMessages(activeRoomId).then((msgs) => {
        const nextMessages = msgs.length > 0 ? msgs : cachedMessages;
        setStoredMessages(nextMessages);
        lastMessageCountRef.current = nextMessages.length;
        setDisplayLimit(100); // Reset to show latest 100
      });

      // Start SSE connection
      connect(activeRoomId);
      prevRoomIdRef.current = activeRoomId;
    } else {
      disconnect();
      setStoredMessages([]);
      prevRoomIdRef.current = null;
    }
  }, [activeRoomId]);

  React.useEffect(() => {
    latestMessageTimestampRef.current = getLatestMessageTimestamp(storedMessages);
  }, [storedMessages]);

  React.useEffect(() => {
    if (sseMessages.length === 0) return;
    setStoredMessages((prev) => mergeMessages(prev, sseMessages));
  }, [sseMessages]);

  const syncLatestMessages = React.useCallback(async (roomId: string, options: { incremental?: boolean } = {}) => {
    const after = options.incremental ? latestMessageTimestampRef.current || undefined : undefined;
    const messages = await getMessages(
      roomId,
      after
        ? {
            after,
            limit: MESSAGE_POLL_LIMIT,
          }
        : MESSAGE_SNAPSHOT_LIMIT
    );

    setStoredMessages((prev) => mergeMessages(prev, messages));
  }, [getMessages]);

  // EventSource is the fast path. This polling path keeps mobile browsers in sync
  // when they pause or buffer the stream behind ngrok.
  React.useEffect(() => {
    if (!activeRoomId) return;

    let isCancelled = false;

    const pollLatestMessages = async () => {
      const messages = await getMessages(activeRoomId, MESSAGE_SNAPSHOT_LIMIT);
      if (isCancelled) return;
      setStoredMessages((prev) => mergeMessages(prev, messages));
    };

    pollLatestMessages();
    const intervalId = window.setInterval(pollLatestMessages, MESSAGE_POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeRoomId, getMessages]);

  React.useEffect(() => {
    if (!activeRoomId) return;

    const wakeAndSync = () => {
      if (document.visibilityState === "hidden") return;

      const now = Date.now();
      if (now - lastWakeRefreshRef.current < WAKE_REFRESH_THROTTLE_MS) return;
      lastWakeRefreshRef.current = now;

      void syncLatestMessages(activeRoomId);
      connect(activeRoomId);
    };

    document.addEventListener("visibilitychange", wakeAndSync);
    window.addEventListener("pageshow", wakeAndSync);
    window.addEventListener("focus", wakeAndSync);
    window.addEventListener("online", wakeAndSync);

    return () => {
      document.removeEventListener("visibilitychange", wakeAndSync);
      window.removeEventListener("pageshow", wakeAndSync);
      window.removeEventListener("focus", wakeAndSync);
      window.removeEventListener("online", wakeAndSync);
    };
  }, [activeRoomId, connect, syncLatestMessages]);

  // Poll for live restart - check every 10 seconds for ended rooms that are now live
  React.useEffect(() => {
    const pollInterval = setInterval(async () => {
      for (const room of rooms) {
        if (room.isEnded) {
          // Check if this room was previously ended
          const wasEnded = prevEndedRoomsRef.current.has(room.id);
          if (wasEnded) {
            // Fetch latest status
            const latestRoom = await fetchRoomStatus(room.id);
            if (latestRoom && latestRoom.isConnected && !latestRoom.isEnded) {
              // Room is now live again! Reconnect
              if (activeRoomId === room.id) {
                // If this is the active room, reconnect
                disconnect();
                setStoredMessages([]);
                connect(room.id);
              }
            }
          }
        } else if (room.isConnected) {
          // Room is currently connected, add to prevEnded set in case it ends
          prevEndedRoomsRef.current.add(room.id);
        }
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [rooms, activeRoomId, connect, disconnect, fetchRoomStatus]);

  // The UI renders from the DB-backed message list. SSE only notifies this list
  // about messages that have already been persisted by the server collector.
  const allMessages = storedMessages;

  const orderedMessages = React.useMemo(() => {
    return [...allMessages].sort((a, b) => {
      const aTime = Date.parse(a.timestamp);
      const bTime = Date.parse(b.timestamp);

      if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
        return 0;
      }

      return aTime - bTime;
    });
  }, [allMessages]);

  const visibleMessages = React.useMemo(
    () => orderedMessages.slice(-displayLimit),
    [displayLimit, orderedMessages]
  );

  // Update scroll when messages change
  React.useEffect(() => {
    if (allMessages.length !== lastMessageCountRef.current) {
      lastMessageCountRef.current = allMessages.length;

      if (isAutoScrollEnabled && containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      } else if (allMessages.length > 0) {
        setShowScrollButton(true);
      }
    }
  }, [allMessages, isAutoScrollEnabled]);

  // Check for highlight message from Viewers navigation
  React.useEffect(() => {
    if (activeRoomId) {
      const highlightId = sessionStorage.getItem("highlightMessageId");
      if (highlightId && allMessages.length > 0) {
        const element = containerRef.current?.querySelector(`[data-message-id="${highlightId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          setHighlightedMsgId(highlightId);
          setTimeout(() => setHighlightedMsgId(null), 2000);
        }
        sessionStorage.removeItem("highlightMessageId");
      } else if (allMessages.length > 0) {
        // Auto scroll to bottom (latest messages) when opening chat room
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
            setIsAutoScrollEnabled(true);
            setShowScrollButton(false);
          }
        }, 100);
      }
    }
  }, [activeRoomId, allMessages.length]);

  // Handle scroll
  const handleScroll = React.useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_PX;
    setIsAutoScrollEnabled(isNearBottom);
    setShowScrollButton(!isNearBottom && allMessages.length > 0);
  }, [allMessages.length]);

  const scrollToBottom = React.useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
      setShowScrollButton(false);
      setIsAutoScrollEnabled(true);
    }
  }, []);

  const scrollToMessage = React.useCallback((msgId: string) => {
    if (containerRef.current) {
      const element = containerRef.current.querySelector(`[data-message-id="${msgId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedMsgId(msgId);
        setSearchQuery("");
        setSearchResults([]);
        // Remove highlight after 2 seconds
        setTimeout(() => setHighlightedMsgId(null), 2000);
      }
    }
  }, []);

  const getInitials = (name: string) => {
    return name.split(/\s+/).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getUserColor = (user: string) => {
    const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-orange-500", "bg-teal-500"];
    return colors[user.charCodeAt(0) % colors.length];
  };

  const renderMessageContent = (msg: YouTubeMessage) => {
    return msg.message.map((item, idx) => {
      if (item.type === "emoji" && item.emojiUrl) {
        return <img key={idx} src={item.emojiUrl} alt={item.emojiAlt || "emoji"} className="h-5 w-5 max-w-full inline-block mx-0.5" />;
      }
      if (item.type === "image" && item.text) {
        return <img key={idx} src={item.text} alt="image" className="h-20 w-20 max-w-full inline-block mx-0.5 rounded" />;
      }
      return <span key={idx}>{item.text}</span>;
    });
  };

  const handleAddRoom = async () => {
    if (newRoomName.trim() && newRoomInput.trim()) {
      await addRoom(newRoomName.trim(), newRoomInput.trim());
      setNewRoomName("");
      setNewRoomInput("");
    }
  };

  // No rooms state
  if (rooms.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full max-w-full overflow-x-hidden relative">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-w-0 w-full max-w-full">
          <MessageSquare className="h-16 w-16 mb-4 text-muted-foreground/20" />
          <h3 className="text-lg font-medium mb-2">No Chat Rooms</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Add a room from the Dashboard to start monitoring
          </p>
          <div className="flex flex-col gap-2 w-full max-w-md">
            <Input
              placeholder="YouTube URL or Video ID"
              value={newRoomInput}
              onChange={(e) => setNewRoomInput(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Room name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
              />
              <Button onClick={handleAddRoom} disabled={!newRoomName.trim() || !newRoomInput.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full max-w-full overflow-x-hidden relative">
      {/* Room Tabs Header */}
      <div className="p-3 border-b bg-card shrink-0 min-w-0 w-full max-w-full overflow-x-hidden">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {rooms.map((room) => {
            const isActiveRoom = activeRoomId === room.id;
            const roomIsConnected = isActiveRoom ? Boolean(room.isConnected || isConnected) : room.isConnected;
            const roomIsConnecting = isActiveRoom ? Boolean(room.isConnecting || isConnecting) : room.isConnecting;
            const roomIsEnded = isActiveRoom ? Boolean(isEnded || room.isEnded) : room.isEnded;

            return (
              <a
                key={room.id}
                href={`/?view=chat&roomId=${encodeURIComponent(room.id)}`}
                onClick={(event) => {
                  event.preventDefault();
                  window.history.replaceState(
                    null,
                    "",
                    `/?view=chat&roomId=${encodeURIComponent(room.id)}`
                  );
                  setActiveRoom(room.id);
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm whitespace-nowrap shrink-0 min-w-0 max-w-[82vw]",
                  isActiveRoom
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {roomIsConnected ? (
                  <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                ) : roomIsConnecting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : roomIsEnded ? (
                  <Radio className="h-3 w-3" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                <span className="min-w-0 max-w-[58vw] truncate">{room.name}</span>
                {isActiveRoom && (
                  <span
                    aria-label={`Delete ${room.name}`}
                    role="button"
                    tabIndex={0}
                    className="h-3 w-3 ml-1 shrink-0 hover:bg-primary-foreground/20 rounded-full p-0.5"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeRoom(room.id);
                    }}
                  >
                    <X className="h-full w-full" />
                  </span>
                )}
              </a>
            );
          })}
        </div>
        {activeRoom && (
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground min-w-0 max-w-full">
            {activeRoomIsConnected ? (
              <>
                <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                <span>Live</span>
              </>
            ) : activeRoomIsConnecting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Connecting</span>
              </>
            ) : activeRoomIsEnded ? (
              <span>Stream ended</span>
            ) : activeRoomError ? (
              <span className="text-destructive min-w-0 flex-1 [overflow-wrap:anywhere]">
                {activeRoomError}
              </span>
            ) : (
              <span>Not connected</span>
            )}
            <span className="ml-auto shrink-0">{allMessages.length} messages</span>
            {displayLimit < allMessages.length && (
              <span className="text-xs text-muted-foreground ml-2 shrink-0">
                (แสดง {displayLimit})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b shrink-0 min-w-0 w-full max-w-full overflow-x-hidden">
        <div className="relative min-w-0 w-full max-w-full">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาข้อความหรือผู้ส่ง..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
              if (e.target.value.trim() && activeRoomId) {
                searchTimeoutRef.current = setTimeout(() => {
                  searchMessages(activeRoomId, e.target.value).then(setSearchResults);
                }, 300);
              } else {
                setSearchResults([]);
              }
            }}
            className="pl-8"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-background border rounded-md shadow-lg max-h-64 overflow-y-auto overflow-x-hidden">
              {searchResults.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => scrollToMessage(msg.id)}
                  className="w-full min-w-0 text-left px-3 py-2 hover:bg-accent border-b last:border-b-0"
                >
                  <span className="font-medium text-sm [overflow-wrap:anywhere]">{msg.author.name}</span>
                  <span className="block text-muted-foreground text-sm truncate">
                    {msg.message.map((m) => m.text).join("")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-w-0 w-full max-w-full overflow-y-auto overflow-x-hidden"
      >
        <div className="space-y-3 p-4 min-w-0 w-full max-w-full">
          {displayLimit < orderedMessages.length && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                onClick={() => setDisplayLimit((prev) => prev + 100)}
                className="text-sm"
              >
                แสดงเพิ่ม (+100 ข้อความ)
              </Button>
            </div>
          )}
          {isEnded && allMessages.length > 0 && (
            <div className="flex justify-center">
              <Badge variant="outline" className="text-xs gap-1">
                <Radio className="h-3 w-3" />
                Stream ended
              </Badge>
            </div>
          )}
          {allMessages.length === 0 && !isConnecting && (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">{isConnecting ? "Connecting..." : "No messages yet"}</p>
            </div>
          )}
          {visibleMessages.map((msg) => (
            <div
              key={msg.id}
              data-message-id={msg.id}
              className={cn(
                "flex items-start gap-3 transition-colors min-w-0 w-full max-w-full overflow-hidden",
                highlightedMsgId === msg.id && "bg-yellow-100 dark:bg-yellow-900/30"
              )}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={msg.author.thumbnail} />
                <AvatarFallback className={cn("text-white text-xs", getUserColor(msg.author.name))}>
                  {getInitials(msg.author.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                <div className="flex items-center gap-2 flex-wrap min-w-0 max-w-full">
                  <span className="font-medium text-sm min-w-0 max-w-full [overflow-wrap:anywhere]">
                    {msg.author.name}
                  </span>
                  {msg.author.isOwner && <Badge variant="destructive" className="text-xs">Creator</Badge>}
                  {msg.author.isVerified && <Badge variant="secondary" className="text-xs">✓</Badge>}
                  {msg.isMembership && <Badge className="text-xs bg-purple-500">Member</Badge>}
                  {msg.isSuperChat && msg.amount && <Badge className="text-xs bg-yellow-500 text-black">${msg.amount}</Badge>}
                  <span className="text-xs text-muted-foreground">{formatThaiTime(msg.timestamp)}</span>
                </div>
                <p className="text-sm break-words leading-relaxed min-w-0 max-w-full [overflow-wrap:anywhere]">
                  {renderMessageContent(msg)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll button */}
      {showScrollButton && allMessages.length > 0 && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-4 right-4 rounded-full shadow-lg h-10 w-10"
          onClick={scrollToBottom}
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
