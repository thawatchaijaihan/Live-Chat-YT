"use client";

import * as React from "react";
import { useChatRooms } from "@/lib/chat-rooms-context";
import { Loader2 } from "lucide-react";

export function MobileSettings() {
  const { rooms, activeRoomId, setActiveRoom, fetchRoomStatus, addRoom } =
    useChatRooms();
  const [selectedRoomId, setSelectedRoomId] = React.useState<string | null>(
    activeRoomId
  );
  const [telegramChatId, setTelegramChatId] = React.useState("");
  const [retentionDays, setRetentionDays] = React.useState(3);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Add room
  const [newRoomName, setNewRoomName] = React.useState("");
  const [newRoomInput, setNewRoomInput] = React.useState("");
  const [isFetchingName, setIsFetchingName] = React.useState(false);
  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Load settings
  React.useEffect(() => {
    if (selectedRoomId) {
      const room = rooms.find((r) => r.id === selectedRoomId);
      if (room) {
        setTelegramChatId(room.telegramChatId || "");
      }
    }
  }, [selectedRoomId, rooms]);

  React.useEffect(() => {
    if (!selectedRoomId && activeRoomId) {
      setSelectedRoomId(activeRoomId);
    }
  }, [activeRoomId, selectedRoomId]);

  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    setActiveRoom(roomId);
    setSaveMessage(null);
  };

  // Auto-fetch channel name
  const handleInputChange = (value: string) => {
    setNewRoomInput(value);
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    if (newRoomName) return;

    fetchTimeoutRef.current = setTimeout(async () => {
      const trimmed = value.trim();
      if (
        trimmed &&
        (trimmed.includes("youtube.com") ||
          trimmed.includes("youtu.be") ||
          trimmed.startsWith("@") ||
          /^[a-zA-Z0-9_-]{11}$/.test(trimmed))
      ) {
        setIsFetchingName(true);
        try {
          const res = await fetch(
            `/api/channel-info?input=${encodeURIComponent(value)}`
          );
          const data = await res.json();
          if (data.name && !newRoomName) {
            setNewRoomName(data.name);
          }
        } catch {}
        setIsFetchingName(false);
      }
    }, 1000);
  };

  const handleAddRoom = async () => {
    if (newRoomName.trim() && newRoomInput.trim()) {
      const newId = await addRoom(newRoomName.trim(), newRoomInput.trim());
      if (newId) handleRoomChange(newId);
      setNewRoomName("");
      setNewRoomInput("");
    }
  };

  const handleSave = async () => {
    if (!selectedRoomId) return;
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/rooms/${selectedRoomId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramChatId, retentionDays }),
      });

      if (res.ok) {
        setSaveMessage({ type: "success", text: "บันทึกสำเร็จ" });
        await fetchRoomStatus(selectedRoomId);
      } else {
        setSaveMessage({ type: "error", text: "เกิดข้อผิดพลาด" });
      }
    } catch (err) {
      setSaveMessage({ type: "error", text: "เกิดข้อผิดพลาด: " + String(err) });
    }
    setIsSaving(false);
  };

  const currentRoom = rooms.find((r) => r.id === selectedRoomId);
  const isTelegramEnabled = !!telegramChatId;

  return (
    <div
      className="m-content-padded m-view-enter"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {/* Title */}
      <div>
        <h2
          style={{
            fontSize: "1.375rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          ตั้งค่า
        </h2>
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--muted-foreground)",
            marginTop: 4,
          }}
        >
          จัดการห้องแชท Telegram และการเก็บข้อความ
        </p>
      </div>

      {/* Add New Room */}
      <div className="m-card">
        <div className="m-card-header">เพิ่มห้องใหม่</div>
        <div className="m-card-content" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="m-search-input"
            style={{ paddingLeft: 12 }}
            placeholder="YouTube URL, Channel @handle, หรือ Video ID"
            value={newRoomInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddRoom()}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                className="m-search-input"
                style={{ paddingLeft: 12, paddingRight: 32 }}
                placeholder="ชื่อห้อง (กรอกอัตโนมัติ)"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddRoom()}
              />
              {isFetchingName && (
                <Loader2
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 16,
                    height: 16,
                    animation: "spin 1s linear infinite",
                    color: "var(--muted-foreground)",
                  }}
                />
              )}
            </div>
            <button
              className="m-load-more-btn"
              onClick={handleAddRoom}
              disabled={!newRoomName.trim() || !newRoomInput.trim()}
              style={{
                opacity:
                  !newRoomName.trim() || !newRoomInput.trim() ? 0.5 : 1,
                minHeight: 40,
              }}
            >
              เพิ่ม
            </button>
          </div>
        </div>
      </div>

      {/* Room Selector */}
      <div className="m-card">
        <div className="m-card-header">เลือกห้อง</div>
        <div className="m-card-content">
          <select
            style={{
              width: "100%",
              height: 44,
              padding: "0 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--muted)",
              color: "var(--foreground)",
              fontSize: "0.9375rem",
              fontFamily: "inherit",
              appearance: "auto",
            }}
            value={selectedRoomId || ""}
            onChange={(e) => handleRoomChange(e.target.value)}
          >
            <option value="">-- เลือกห้อง --</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
          {currentRoom && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--muted-foreground)",
                marginTop: 8,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentRoom.input}
            </p>
          )}
        </div>
      </div>

      {selectedRoomId && (
        <>
          {/* Telegram */}
          <div className="m-card">
            <div className="m-card-header">Telegram</div>
            <div
              className="m-card-content"
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <div
                  onClick={() =>
                    setTelegramChatId(
                      isTelegramEnabled ? "" : telegramChatId || "-"
                    )
                  }
                  style={{
                    width: 48,
                    height: 28,
                    borderRadius: 14,
                    background: isTelegramEnabled
                      ? "oklch(0.55 0.18 155)"
                      : "var(--muted)",
                    border: "2px solid var(--border)",
                    position: "relative",
                    cursor: "pointer",
                    transition: "background 0.2s ease",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: isTelegramEnabled ? 22 : 2,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "white",
                      transition: "left 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }}
                  />
                </div>
                เปิดใช้งานการส่งต่อไป Telegram
              </label>

              {isTelegramEnabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    Telegram Chat ID
                  </span>
                  <input
                    className="m-search-input"
                    style={{ paddingLeft: 12 }}
                    placeholder="เช่น -1001234567890"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                  />
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    ใส่ Chat ID ของกลุ่มหรือแชนแนล
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Retention */}
          <div className="m-card">
            <div className="m-card-header">การเก็บรักษาข้อความ</div>
            <div
              className="m-card-content"
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                เก็บข้อความไว้
              </span>
              <select
                style={{
                  width: "100%",
                  height: 44,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--muted)",
                  color: "var(--foreground)",
                  fontSize: "0.9375rem",
                  fontFamily: "inherit",
                  appearance: "auto",
                }}
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
              >
                <option value={3}>3 วัน</option>
                <option value={7}>7 วัน</option>
                <option value={15}>15 วัน</option>
              </select>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted-foreground)",
                }}
              >
                ข้อความที่เก่ากว่า {retentionDays} วันจะถูกลบโดยอัตโนมัติ
              </span>
            </div>
          </div>

          {/* Save */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              className="m-load-more-btn"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                opacity: isSaving ? 0.5 : 1,
                minHeight: 44,
                padding: "0 24px",
              }}
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
            </button>
            {saveMessage && (
              <span
                style={{
                  fontSize: "0.875rem",
                  color:
                    saveMessage.type === "success"
                      ? "oklch(0.65 0.2 150)"
                      : "oklch(0.65 0.22 25)",
                }}
              >
                {saveMessage.text}
              </span>
            )}
          </div>
        </>
      )}

      {!selectedRoomId && (
        <div
          className="m-empty"
          style={{ minHeight: "30vh" }}
        >
          <p style={{ fontSize: "0.875rem" }}>กรุณาเลือกห้องเพื่อตั้งค่า</p>
        </div>
      )}

      {/* Desktop link */}
      <div
        style={{
          textAlign: "center",
          padding: "16px 0 24px",
          borderTop: "1px solid var(--border)",
          marginTop: 8,
        }}
      >
        <a
          href="/?desktop=1"
          style={{
            fontSize: "0.8125rem",
            color: "var(--muted-foreground)",
            textDecoration: "underline",
          }}
        >
          สลับไปหน้า Desktop
        </a>
      </div>
    </div>
  );
}
