"use client";

import * as React from "react";
import { useYouTubeChat } from "@/lib/youtube-chat-context";
import { useChatRooms } from "@/lib/chat-rooms-context";
import type { YouTubeMessage } from "@/lib/db";
import { formatThaiTime } from "@/lib/time";
import {
  MessageSquare,
  Radio,
  ChevronDown,
  X,
  Plus,
  Loader2,
  WifiOff,
  Search,
} from "lucide-react";

const POLL_INTERVAL_MS = 1500;
const POLL_LIMIT = 300;
const SNAPSHOT_LIMIT = 120;
const WAKE_THROTTLE_MS = 2000;
const NEAR_BOTTOM_PX = 200;
const DISPLAY_LIMIT_STEP = 50;
const INITIAL_DISPLAY_LIMIT = 50;

function mergeMessages(
  existing: YouTubeMessage[],
  incoming: YouTubeMessage[]
) {
  if (incoming.length === 0) return existing;
  const ids = new Set(existing.map((m) => m.id));
  const next = [...existing];
  let changed = false;
  for (const msg of incoming) {
    if (!ids.has(msg.id)) {
      ids.add(msg.id);
      next.push(msg);
      changed = true;
    }
  }
  return changed ? next : existing;
}

function getLatestTimestamp(messages: YouTubeMessage[]) {
  let latest = "";
  for (const m of messages) {
    if (!latest || Date.parse(m.timestamp) > Date.parse(latest)) {
      latest = m.timestamp;
    }
  }
  return latest;
}

const USER_COLORS = [
  "bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500",
  "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-orange-500", "bg-teal-500",
];

export function MobileChat() {
  const {
    rooms,
    activeRoomId,
    initialMessagesByRoom,
    setActiveRoom,
    addRoom,
    removeRoom,
    getMessages,
    searchMessages,
    fetchRoomStatus,
    fetchRooms,
  } = useChatRooms();
  const {
    messages: sseMessages,
    isConnected,
    isConnecting,
    isEnded,
    error,
    connect,
    disconnect,
  } = useYouTubeChat();

  const [storedMessages, setStoredMessages] = React.useState<YouTubeMessage[]>(
    () => (activeRoomId ? initialMessagesByRoom[activeRoomId] ?? [] : [])
  );
  const [showScrollBtn, setShowScrollBtn] = React.useState(false);
  const [isAutoScroll, setIsAutoScroll] = React.useState(true);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = React.useState(INITIAL_DISPLAY_LIMIT);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<YouTubeMessage[]>([]);
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  const [showSearch, setShowSearch] = React.useState(false);
  const [newRoomName, setNewRoomName] = React.useState("");
  const [newRoomInput, setNewRoomInput] = React.useState("");

  const containerRef = React.useRef<HTMLDivElement>(null);
  const lastCountRef = React.useRef(0);
  const latestTsRef = React.useRef("");
  const lastWakeRef = React.useRef(0);
  const prevRoomRef = React.useRef<string | null>(null);
  const searchTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const prevEndedRef = React.useRef<Set<string>>(new Set());

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const roomConnected = Boolean(activeRoom?.isConnected || isConnected);
  const roomConnecting = Boolean(activeRoom?.isConnecting || isConnecting);
  const roomEnded = Boolean(isEnded || activeRoom?.isEnded);
  const roomError = error ?? activeRoom?.error ?? null;

  // --- Connect when room changes ---
  React.useEffect(() => {
    if (activeRoomId && activeRoom) {
      const cached = initialMessagesByRoom[activeRoomId] ?? [];

      if (prevRoomRef.current && prevRoomRef.current !== activeRoomId) {
        disconnect();
        setStoredMessages(cached);
      } else if (storedMessages.length === 0 && cached.length > 0) {
        setStoredMessages(cached);
        lastCountRef.current = cached.length;
      }

      getMessages(activeRoomId).then((msgs) => {
        const next = msgs.length > 0 ? msgs : cached;
        setStoredMessages(next);
        lastCountRef.current = next.length;
        setDisplayLimit(INITIAL_DISPLAY_LIMIT);
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
            setIsAutoScroll(true);
            setShowScrollBtn(false);
          }
        }, 100);
      });

      connect(activeRoomId);
      prevRoomRef.current = activeRoomId;
    } else {
      disconnect();
      setStoredMessages([]);
      prevRoomRef.current = null;
    }
  }, [activeRoomId]);

  // Track latest timestamp
  React.useEffect(() => {
    latestTsRef.current = getLatestTimestamp(storedMessages);
  }, [storedMessages]);

  // Merge SSE messages
  React.useEffect(() => {
    if (sseMessages.length === 0) return;
    setStoredMessages((prev) => mergeMessages(prev, sseMessages));
  }, [sseMessages]);

  // Polling
  React.useEffect(() => {
    if (!activeRoomId) return;
    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const msgs = await getMessages(activeRoomId, SNAPSHOT_LIMIT);
        if (!cancelled) {
          setStoredMessages((prev) => mergeMessages(prev, msgs));
        }
      } catch {}
      if (!cancelled) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeRoomId, getMessages]);

  // Wake / visibility sync
  React.useEffect(() => {
    if (!activeRoomId) return;

    const wakeSync = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastWakeRef.current < WAKE_THROTTLE_MS) return;
      lastWakeRef.current = now;

      getMessages(activeRoomId, SNAPSHOT_LIMIT).then((msgs) => {
        setStoredMessages((prev) => mergeMessages(prev, msgs));
      });
      connect(activeRoomId);
    };

    document.addEventListener("visibilitychange", wakeSync);
    window.addEventListener("pageshow", wakeSync);
    window.addEventListener("focus", wakeSync);
    window.addEventListener("online", wakeSync);
    return () => {
      document.removeEventListener("visibilitychange", wakeSync);
      window.removeEventListener("pageshow", wakeSync);
      window.removeEventListener("focus", wakeSync);
      window.removeEventListener("online", wakeSync);
    };
  }, [activeRoomId, connect, getMessages]);

  // Auto-detect live restart
  React.useEffect(() => {
    const interval = setInterval(async () => {
      for (const room of rooms) {
        if (room.isEnded && prevEndedRef.current.has(room.id)) {
          const latest = await fetchRoomStatus(room.id);
          if (latest?.isConnected && !latest.isEnded && activeRoomId === room.id) {
            disconnect();
            setStoredMessages([]);
            connect(room.id);
          }
        } else if (room.isConnected) {
          prevEndedRef.current.add(room.id);
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [rooms, activeRoomId, connect, disconnect, fetchRoomStatus]);

  // --- Derived data ---
  const allMessages = storedMessages;

  const ordered = React.useMemo(
    () =>
      [...allMessages].sort((a, b) => {
        const at = Date.parse(a.timestamp);
        const bt = Date.parse(b.timestamp);
        if (Number.isNaN(at) || Number.isNaN(bt)) return 0;
        return at - bt;
      }),
    [allMessages]
  );

  const visible = React.useMemo(
    () => ordered.slice(-displayLimit),
    [ordered, displayLimit]
  );

  // Auto-scroll on new messages
  React.useEffect(() => {
    if (allMessages.length !== lastCountRef.current) {
      lastCountRef.current = allMessages.length;
      if (isAutoScroll && containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      } else if (allMessages.length > 0) {
        setShowScrollBtn(true);
      }
    }
  }, [allMessages, isAutoScroll]);

  // Scroll handler
  const handleScroll = React.useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_PX;
    setIsAutoScroll(nearBottom);
    setShowScrollBtn(!nearBottom && allMessages.length > 0);
  }, [allMessages.length]);

  const scrollToBottom = React.useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
      setShowScrollBtn(false);
      setIsAutoScroll(true);
    }
  }, []);

  // Copy author name
  const copyName = React.useCallback(async (name: string, msgId: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(name);
      } else {
        const ta = document.createElement("textarea");
        ta.value = name;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedId(msgId);
      setTimeout(() => setCopiedId((c) => (c === msgId ? null : c)), 1500);
    } catch {}
  }, []);

  const getUserColor = (name: string) =>
    USER_COLORS[name.charCodeAt(0) % USER_COLORS.length];

  const getInitials = (name: string) =>
    name.split(/\s+/).map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const renderContent = (msg: YouTubeMessage) =>
    msg.message.map((item, i) => {
      if (item.type === "emoji" && item.emojiUrl)
        return (
          <img key={i} src={item.emojiUrl} alt={item.emojiAlt || "emoji"} className="h-5 w-5 inline-block mx-0.5" />
        );
      if (item.type === "image" && item.text)
        return (
          <img key={i} src={item.text} alt="image" className="h-16 w-16 inline-block mx-0.5 rounded" />
        );
      return <span key={i}>{item.text}</span>;
    });

  // Search handler
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim() && activeRoomId) {
      searchTimerRef.current = setTimeout(() => {
        searchMessages(activeRoomId, value).then(setSearchResults);
      }, 300);
    } else {
      setSearchResults([]);
    }
  };

  const scrollToMessage = (msgId: string) => {
    if (containerRef.current) {
      const el = containerRef.current.querySelector(
        `[data-message-id="${msgId}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightId(msgId);
        setSearchQuery("");
        setSearchResults([]);
        setShowSearch(false);
        setTimeout(() => setHighlightId(null), 2000);
      }
    }
  };

  // Add room
  const handleAddRoom = async () => {
    if (newRoomName.trim() && newRoomInput.trim()) {
      await addRoom(newRoomName.trim(), newRoomInput.trim());
      setNewRoomName("");
      setNewRoomInput("");
    }
  };

  // --- No rooms state ---
  if (rooms.length === 0) {
    return (
      <div className="m-empty" style={{ minHeight: "60vh" }}>
        <MessageSquare className="m-empty-icon" />
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 8 }}>
          ยังไม่มีห้องแชท
        </h3>
        <p style={{ fontSize: "0.875rem", marginBottom: 20, color: "var(--muted-foreground)" }}>
          เพิ่มห้องเพื่อเริ่มดูแชทสด
        </p>
        <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            className="m-search-input"
            style={{ paddingLeft: 12 }}
            placeholder="YouTube URL หรือ Video ID"
            value={newRoomInput}
            onChange={(e) => setNewRoomInput(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="m-search-input"
              style={{ paddingLeft: 12, flex: 1 }}
              placeholder="ชื่อห้อง"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
            />
            <button
              className="m-load-more-btn"
              onClick={handleAddRoom}
              disabled={!newRoomName.trim() || !newRoomInput.trim()}
              style={{ opacity: !newRoomName.trim() || !newRoomInput.trim() ? 0.5 : 1 }}
            >
              <Plus style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Room Tabs */}
      <div className="m-room-tabs">
        {rooms.map((room) => {
          const isActive = activeRoomId === room.id;
          const rc = isActive ? Boolean(room.isConnected || isConnected) : room.isConnected;
          const rk = isActive ? Boolean(room.isConnecting || isConnecting) : room.isConnecting;
          const re = isActive ? Boolean(isEnded || room.isEnded) : room.isEnded;

          return (
            <button
              key={room.id}
              className={`m-room-tab ${isActive ? "active" : ""}`}
              onClick={() => setActiveRoom(room.id)}
            >
              {rc ? (
                <span className="m-dot live" />
              ) : rk ? (
                <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
              ) : re ? (
                <Radio style={{ width: 12, height: 12 }} />
              ) : (
                <WifiOff style={{ width: 12, height: 12 }} />
              )}
              <span style={{ maxWidth: "52vw", overflow: "hidden", textOverflow: "ellipsis" }}>
                {room.name}
              </span>
              {isActive && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRoom(room.id);
                  }}
                  style={{ marginLeft: 2, display: "flex" }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Status Bar */}
      {activeRoom && (
        <div
          className={`m-status-bar ${
            roomConnected ? "live" : roomConnecting ? "connecting" : roomEnded ? "ended" : roomError ? "error" : "ended"
          }`}
        >
          {roomConnected ? (
            <>
              <span className="m-dot live" />
              <span>ถ่ายทอดสด</span>
            </>
          ) : roomConnecting ? (
            <>
              <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
              <span>กำลังเชื่อมต่อ...</span>
            </>
          ) : roomEnded ? (
            <span>สตรีมจบแล้ว</span>
          ) : roomError ? (
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {roomError}
            </span>
          ) : (
            <span>ไม่ได้เชื่อมต่อ</span>
          )}
          <span style={{ marginLeft: "auto", flexShrink: 0 }}>
            {allMessages.length} ข้อความ
          </span>
          <button
            onClick={() => setShowSearch(!showSearch)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: 4,
              display: "flex",
            }}
          >
            <Search style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

      {/* Search (collapsible) */}
      {showSearch && (
        <div className="m-search-wrapper" style={{ position: "relative" }}>
          <Search className="m-search-icon" />
          <input
            className="m-search-input"
            placeholder="ค้นหาข้อความหรือผู้ส่ง..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="m-search-results">
              {searchResults.map((msg) => (
                <button
                  key={msg.id}
                  className="m-search-result-item"
                  onClick={() => scrollToMessage(msg.id)}
                >
                  <span style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
                    {msg.author.name}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.8125rem",
                      color: "var(--muted-foreground)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {msg.message.map((m) => m.text).join("")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
        }}
      >
        <div className="m-messages">
          {/* Load more */}
          {displayLimit < ordered.length && (
            <div className="m-load-more">
              <button
                className="m-load-more-btn"
                onClick={() => setDisplayLimit((p) => p + DISPLAY_LIMIT_STEP)}
              >
                แสดงเพิ่ม (+{DISPLAY_LIMIT_STEP} ข้อความ)
              </button>
            </div>
          )}

          {/* Stream ended */}
          {roomEnded && allMessages.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
              <span className="m-badge ended" style={{ gap: 4, display: "inline-flex", alignItems: "center" }}>
                <Radio style={{ width: 12, height: 12 }} />
                สตรีมจบแล้ว
              </span>
            </div>
          )}

          {/* Empty state */}
          {allMessages.length === 0 && !roomConnecting && (
            <div className="m-empty" style={{ minHeight: "40vh" }}>
              <MessageSquare className="m-empty-icon" />
              <p style={{ fontSize: "0.875rem" }}>ยังไม่มีข้อความ</p>
            </div>
          )}

          {/* Message list */}
          {visible.map((msg) => (
            <div
              key={msg.id}
              data-message-id={msg.id}
              className={`m-message ${highlightId === msg.id ? "highlighted" : ""}`}
            >
              <div
                className={`m-msg-avatar ${getUserColor(msg.author.name)}`}
                style={
                  msg.author.thumbnail
                    ? {
                        backgroundImage: `url(${msg.author.thumbnail})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : {}
                }
              >
                {!msg.author.thumbnail && getInitials(msg.author.name)}
              </div>
              <div className="m-msg-body">
                <div className="m-msg-header">
                  <button
                    className="m-msg-author"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyName(msg.author.name, msg.id);
                    }}
                  >
                    {msg.author.name}
                  </button>
                  {copiedId === msg.id && (
                    <span className="m-toast">คัดลอกแล้ว</span>
                  )}
                  {msg.author.isOwner && (
                    <span className="m-badge creator">Creator</span>
                  )}
                  {msg.author.isVerified && (
                    <span className="m-badge" style={{ background: "var(--muted)", color: "var(--foreground)" }}>
                      ✓
                    </span>
                  )}
                  {msg.isMembership && (
                    <span className="m-badge member">Member</span>
                  )}
                  {msg.isSuperChat && msg.amount && (
                    <span className="m-badge superchat">${msg.amount}</span>
                  )}
                  <span className="m-msg-time">
                    {formatThaiTime(msg.timestamp)}
                  </span>
                </div>
                <p className="m-msg-text">{renderContent(msg)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll to bottom FAB */}
      {showScrollBtn && allMessages.length > 0 && (
        <button className="m-scroll-fab" onClick={scrollToBottom}>
          <ChevronDown style={{ width: 22, height: 22 }} />
        </button>
      )}
    </>
  );
}
