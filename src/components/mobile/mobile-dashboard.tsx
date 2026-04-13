"use client";

import * as React from "react";
import { useChatRooms } from "@/lib/chat-rooms-context";
import { Loader2, Send, Trash2 } from "lucide-react";

export function MobileDashboard() {
  const { rooms, activeRoomId, setActiveRoom, removeRoom, fetchRoomStatus, fetchRooms } =
    useChatRooms();

  // Refresh on mount
  React.useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Poll status
  React.useEffect(() => {
    if (rooms.length === 0) return;
    const interval = setInterval(() => {
      rooms.forEach((room) => {
        if (room.isConnecting || room.isConnected) {
          fetchRoomStatus(room.id);
        }
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [rooms, fetchRoomStatus]);

  const totalMessages = rooms.reduce((s, r) => s + r.messageCount, 0);
  const connectedRooms = rooms.filter((r) => r.isConnected).length;

  return (
    <div className="m-content-padded m-view-enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Title */}
      <div>
        <h2 style={{ fontSize: "1.375rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          หน้าหลัก
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: 4 }}>
          ภาพรวม YouTube Live Chat
        </p>
      </div>

      {/* Stats */}
      <div className="m-stats-grid">
        <div className="m-stat-card">
          <div className="m-stat-label">ห้องทั้งหมด</div>
          <div className="m-stat-value">{rooms.length}</div>
          <div className="m-stat-sub">{connectedRooms} เชื่อมต่อ</div>
        </div>
        <div className="m-stat-card">
          <div className="m-stat-label">ข้อความทั้งหมด</div>
          <div className="m-stat-value">{totalMessages.toLocaleString()}</div>
          <div className="m-stat-sub">จากทุกห้อง</div>
        </div>
      </div>

      {/* Room List */}
      <div className="m-card">
        <div className="m-card-header">ห้องแชท</div>
        <div className="m-card-content" style={{ padding: 0 }}>
          {rooms.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px 16px",
                color: "var(--muted-foreground)",
                fontSize: "0.875rem",
              }}
            >
              <p style={{ fontWeight: 500 }}>ยังไม่มีห้องแชท</p>
              <p style={{ fontSize: "0.8125rem", marginTop: 4 }}>
                ไปที่ ตั้งค่า เพื่อเพิ่มห้องใหม่
              </p>
            </div>
          ) : (
            rooms.map((room) => (
              <div key={room.id} className="m-room-card">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                      {room.name}
                    </span>
                    {room.isConnected ? (
                      <span className="m-badge live">
                        <span className="m-dot live" style={{ width: 6, height: 6 }} />
                        ถ่ายทอดสด
                      </span>
                    ) : room.isConnecting ? (
                      <span className="m-badge connecting">
                        <Loader2 style={{ width: 10, height: 10, animation: "spin 1s linear infinite" }} />
                        กำลังเชื่อมต่อ
                      </span>
                    ) : room.isEnded ? (
                      <span className="m-badge ended">จบแล้ว</span>
                    ) : (
                      <span className="m-badge ended">ตัดการเชื่อมต่อ</span>
                    )}
                    {room.telegramChatId ? (
                      <span className="m-badge telegram">
                        <Send style={{ width: 10, height: 10 }} />
                        Telegram
                      </span>
                    ) : null}
                  </div>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted-foreground)",
                      marginTop: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {room.input}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted-foreground)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {room.messageCount} ข้อความ
                  </span>
                  <button
                    onClick={() => removeRoom(room.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--destructive)",
                      cursor: "pointer",
                      padding: 8,
                      display: "flex",
                      minWidth: 40,
                      minHeight: 40,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Trash2 style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
