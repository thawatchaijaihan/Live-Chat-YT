"use client";

import * as React from "react";
import { useChatRooms } from "@/lib/chat-rooms-context";
import { Sparkles, Loader2, MessageSquare } from "lucide-react";

export function MobileSummarize() {
  const { rooms, activeRoomId, setActiveRoom } = useChatRooms();
  const [selectedRoomId, setSelectedRoomId] = React.useState<string | null>(activeRoomId);
  const [messageCount, setMessageCount] = React.useState(50);
  const [isSummarizing, setIsSummarizing] = React.useState(false);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<{ messageCount: number; roomName: string } | null>(null);

  const handleSummarize = async () => {
    if (!selectedRoomId) return;

    setIsSummarizing(true);
    setError(null);
    setSummary(null);
    setStats(null);

    try {
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoomId,
          messageCount,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }

      const data = await response.json();
      setSummary(data.summary);
      setStats({ messageCount: data.messageCount, roomName: data.roomName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSummarizing(false);
    }
  };

  const currentRoom = rooms.find((r) => r.id === selectedRoomId);

  return (
    <div className="m-content-padded">
      <h2 className="m-section-title">AI</h2>
      <p className="m-section-subtitle">สรุปแชทด้วย AI</p>

      {/* Controls */}
      <div className="m-card">
        <div className="m-card-title">ตั้งค่าการสรุป</div>

        {/* Room Selector */}
        <div className="m-field">
          <label className="m-label">เลือกห้อง</label>
          <select
            className="m-select"
            value={selectedRoomId || ""}
            onChange={(e) => {
              setSelectedRoomId(e.target.value || null);
              setSummary(null);
              setError(null);
            }}
          >
            <option value="">-- เลือกห้อง --</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({room.messageCount} ข้อความ)
              </option>
            ))}
          </select>
        </div>

        {/* Message Count */}
        <div className="m-field">
          <label className="m-label">จำนวนข้อความที่ใช้สรุป</label>
          <select
            className="m-select"
            value={messageCount}
            onChange={(e) => setMessageCount(Number(e.target.value))}
          >
            <option value={20}>20 ข้อความล่าสุด</option>
            <option value={50}>50 ข้อความล่าสุด</option>
            <option value={100}>100 ข้อความล่าสุด</option>
          </select>
        </div>

        {/* Summarize Button */}
        <button
          className="m-button-primary w-full"
          onClick={handleSummarize}
          disabled={!selectedRoomId || isSummarizing}
        >
          {isSummarizing ? (
            <>
              <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
              กำลังสรุป...
            </>
          ) : (
            <>
              <Sparkles style={{ width: 16, height: 16 }} />
              สรุปด้วย AI
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="m-card" style={{ borderColor: "oklch(0.65 0.24 25 / 0.5)" }}>
          <div className="m-error-text">{error}</div>
        </div>
      )}

      {/* Loading */}
      {isSummarizing && (
        <div className="m-card">
          <div className="m-loading">
            <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
            <span>AI กำลังวิเคราะห์ข้อความ...</span>
          </div>
          <div className="m-skeleton-lines">
            <div className="m-skeleton" style={{ width: "75%" }} />
            <div className="m-skeleton" style={{ width: "50%" }} />
            <div className="m-skeleton" style={{ width: "85%" }} />
          </div>
        </div>
      )}

      {/* Summary Result */}
      {summary && stats && (
        <div className="m-card">
          <div className="m-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles style={{ width: 16, height: 16, color: "oklch(0.8 0.2 85)" }} />
            สรุปจาก {stats.roomName}
          </div>
          <div className="m-text-xs" style={{ color: "oklch(0.6 0 0)", marginBottom: 12 }}>
            วิเคราะห์จาก {stats.messageCount} ข้อความ
          </div>
          <div className="m-summary-text">
            {summary}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedRoomId && !summary && (
        <div className="m-card">
          <div className="m-empty-state">
            <MessageSquare style={{ width: 48, height: 48, opacity: 0.3 }} />
            <p>เลือกห้องเพื่อสรุปแชทด้วย AI</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .m-skeleton {
          height: 12px;
          background: oklch(0.3 0 0 / 0.3);
          border-radius: 6px;
          animation: pulse 1.5s ease-in-out infinite;
        }
        .m-skeleton-lines {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 12px;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
