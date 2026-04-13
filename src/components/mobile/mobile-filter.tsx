"use client";

import * as React from "react";
import { useChatRooms } from "@/lib/chat-rooms-context";
import type { YouTubeMessage } from "@/lib/db";
import { formatThaiTime } from "@/lib/time";
import { Search, User, MessageSquare, Filter, X } from "lucide-react";

interface FilterTopic {
  id: string;
  filterType: "user" | "text";
  filterValue: string;
  results: FilterResult[];
}

interface FilterResult {
  roomId: string;
  roomName: string;
  messages: YouTubeMessage[];
}

export function MobileFilter() {
  const { rooms, activeRoomId, setActiveRoom, searchMessages } = useChatRooms();
  const [filterType, setFilterType] = React.useState<"user" | "text">("user");
  const [filterInput, setFilterInput] = React.useState("");
  const [filterTopics, setFilterTopics] = React.useState<FilterTopic[]>([]);
  const [activeTopicId, setActiveTopicId] = React.useState<string | null>(null);
  const [isFiltering, setIsFiltering] = React.useState(false);
  const [selectedTabs, setSelectedTabs] = React.useState<Set<string>>(new Set());

  const handleFilter = async () => {
    if (!filterInput.trim()) return;
    setIsFiltering(true);

    const existing = filterTopics.find(
      (t) =>
        t.filterType === filterType &&
        t.filterValue.toLowerCase() === filterInput.trim().toLowerCase()
    );
    if (existing) {
      setActiveTopicId(existing.id);
      setIsFiltering(false);
      return;
    }

    const topicId = Date.now().toString();
    const results: FilterResult[] = [];

    for (const room of rooms) {
      try {
        const messages = await searchMessages(room.id, filterInput.trim());
        if (messages.length > 0) {
          results.push({ roomId: room.id, roomName: room.name, messages });
        }
      } catch {}
    }

    const topic: FilterTopic = {
      id: topicId,
      filterType,
      filterValue: filterInput.trim(),
      results,
    };

    setFilterTopics((prev) => [...prev, topic]);
    setActiveTopicId(topicId);
    setSelectedTabs(new Set(results.map((r) => r.roomId)));
    setFilterInput("");
    setIsFiltering(false);
  };

  const removeTopic = (topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFilterTopics((prev) => {
      const next = prev.filter((t) => t.id !== topicId);
      if (activeTopicId === topicId) {
        setActiveTopicId(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  };

  const toggleTab = (roomId: string) => {
    const next = new Set(selectedTabs);
    if (next.has(roomId)) next.delete(roomId);
    else next.add(roomId);
    setSelectedTabs(next);
  };

  const goToMessage = (roomId: string, messageId: string) => {
    setActiveRoom(roomId);
    sessionStorage.setItem("highlightMessageId", messageId);
  };

  const activeTopic = filterTopics.find((t) => t.id === activeTopicId);
  const visibleResults =
    activeTopic?.results.filter((r) => selectedTabs.has(r.roomId)) || [];
  const totalMessages = visibleResults.reduce(
    (s, r) => s + r.messages.length,
    0
  );

  const getUserColor = (name: string) => {
    const colors = [
      "bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500",
      "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-orange-500",
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

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

  return (
    <div
      className="m-view-enter"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* Header */}
      <div className="m-content-padded" style={{ flexShrink: 0, paddingBottom: 8 }}>
        <h2
          style={{
            fontSize: "1.375rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          กรอง
        </h2>
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--muted-foreground)",
            marginTop: 4,
          }}
        >
          ค้นหาข้อความหรือผู้ใช้ในแชท
        </p>

        {/* Filter Type */}
        <div className="m-filter-tabs" style={{ marginTop: 12 }}>
          <button
            className={`m-filter-tab ${filterType === "user" ? "active" : ""}`}
            onClick={() => setFilterType("user")}
          >
            <User style={{ width: 16, height: 16 }} />
            ผู้ใช้
          </button>
          <button
            className={`m-filter-tab ${filterType === "text" ? "active" : ""}`}
            onClick={() => setFilterType("text")}
          >
            <MessageSquare style={{ width: 16, height: 16 }} />
            ข้อความ
          </button>
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <div style={{ position: "relative", flex: 1 }}>
            {filterType === "user" ? (
              <User
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 16,
                  height: 16,
                  color: "var(--muted-foreground)",
                }}
              />
            ) : (
              <MessageSquare
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 16,
                  height: 16,
                  color: "var(--muted-foreground)",
                }}
              />
            )}
            <input
              className="m-search-input"
              style={{ paddingLeft: 36 }}
              placeholder={
                filterType === "user"
                  ? "@ชื่อผู้ใช้ เช่น @noonoei7046"
                  : "ข้อความ เช่น สวัสดี"
              }
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFilter()}
            />
          </div>
          <button
            className="m-load-more-btn"
            onClick={handleFilter}
            disabled={!filterInput.trim() || isFiltering}
            style={{
              opacity: !filterInput.trim() || isFiltering ? 0.5 : 1,
              minHeight: 40,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Filter style={{ width: 14, height: 14 }} />
            {isFiltering ? "กรอง..." : "กรอง"}
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {filterTopics.length === 0 ? (
          <div className="m-empty" style={{ minHeight: "40vh" }}>
            <Search className="m-empty-icon" />
            <p style={{ fontSize: "1rem", fontWeight: 500, marginBottom: 4 }}>
              ยังไม่มีผลลัพธ์
            </p>
            <p style={{ fontSize: "0.8125rem" }}>
              ใส่ข้อมูลและกดปุ่ม &quot;กรอง&quot; เพื่อค้นหา
            </p>
          </div>
        ) : (
          <div className="m-content-padded" style={{ paddingTop: 0 }}>
            {/* Topic tabs */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                paddingBottom: 12,
                borderBottom: "1px solid var(--border)",
              }}
            >
              {filterTopics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => {
                    setActiveTopicId(topic.id);
                    setSelectedTabs(
                      new Set(topic.results.map((r) => r.roomId))
                    );
                  }}
                  className={`m-room-tab ${activeTopicId === topic.id ? "active" : ""}`}
                  style={{ paddingRight: 8 }}
                >
                  {topic.filterType === "user" ? (
                    <User style={{ width: 12, height: 12 }} />
                  ) : (
                    <MessageSquare style={{ width: 12, height: 12 }} />
                  )}
                  {topic.filterValue}
                  <span
                    className="m-badge"
                    style={{
                      background: "var(--muted)",
                      color: "var(--foreground)",
                      marginLeft: 4,
                    }}
                  >
                    {topic.results.reduce(
                      (s, r) => s + r.messages.length,
                      0
                    )}
                  </span>
                  <span
                    role="button"
                    onClick={(e) => removeTopic(topic.id, e)}
                    style={{ display: "flex", padding: 2 }}
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </span>
                </button>
              ))}
            </div>

            {/* Room tabs */}
            {activeTopic && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "12px 0",
                }}
              >
                {activeTopic.results.map((result) => (
                  <button
                    key={result.roomId}
                    onClick={() => toggleTab(result.roomId)}
                    className="m-room-tab"
                    style={{
                      background: selectedTabs.has(result.roomId)
                        ? "oklch(0.55 0.18 155)"
                        : "var(--muted)",
                      color: selectedTabs.has(result.roomId)
                        ? "white"
                        : "var(--foreground)",
                    }}
                  >
                    {selectedTabs.has(result.roomId) ? (
                      <X style={{ width: 12, height: 12 }} />
                    ) : (
                      <span className="m-dot" style={{ background: "var(--muted-foreground)", width: 6, height: 6 }} />
                    )}
                    {result.roomName}
                    <span
                      className="m-badge"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        color: "inherit",
                      }}
                    >
                      {result.messages.length}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Messages */}
            {totalMessages === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 0",
                  color: "var(--muted-foreground)",
                  fontSize: "0.875rem",
                }}
              >
                เลือกแท็บห้องเพื่อดูผลลัพธ์
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visibleResults.map((result) =>
                  result.messages.map((msg) => (
                    <div
                      key={`${result.roomId}-${msg.id}`}
                      className="m-message"
                      onClick={() => goToMessage(result.roomId, msg.id)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        background: "var(--card)",
                      }}
                    >
                      <div
                        className={`m-msg-avatar ${getUserColor(msg.author.name)}`}
                        style={
                          msg.author.thumbnail
                            ? {
                                backgroundImage: `url(${msg.author.thumbnail})`,
                                backgroundSize: "cover",
                              }
                            : {}
                        }
                      >
                        {!msg.author.thumbnail &&
                          getInitials(msg.author.name)}
                      </div>
                      <div className="m-msg-body">
                        <div className="m-msg-header">
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: "0.8125rem",
                              color: "var(--primary)",
                            }}
                          >
                            {msg.author.name}
                          </span>
                          {msg.author.isOwner && (
                            <span className="m-badge creator">Creator</span>
                          )}
                          {msg.isMembership && (
                            <span className="m-badge member">Member</span>
                          )}
                          {msg.isSuperChat && msg.amount && (
                            <span className="m-badge superchat">
                              ${msg.amount}
                            </span>
                          )}
                          <span className="m-msg-time">
                            {formatThaiTime(msg.timestamp)}
                          </span>
                          <span
                            className="m-badge"
                            style={{
                              marginLeft: "auto",
                              background: "var(--muted)",
                              color: "var(--muted-foreground)",
                            }}
                          >
                            {result.roomName}
                          </span>
                        </div>
                        <p className="m-msg-text">{renderContent(msg)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
