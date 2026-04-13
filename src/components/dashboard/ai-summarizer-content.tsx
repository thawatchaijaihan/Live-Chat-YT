"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useChatRooms } from "@/lib/chat-rooms-context";
import { Sparkles, Loader2, MessageSquare } from "lucide-react";

export function AISummarizerContent() {
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
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">AI</h2>
        <p className="text-muted-foreground">สรุปแชทด้วย AI</p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>ตั้งค่าการสรุป</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Room Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">เลือกห้อง</label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
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
          <div className="space-y-2">
            <label className="text-sm font-medium">จำนวนข้อความที่ใช้สรุป</label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={messageCount}
              onChange={(e) => setMessageCount(Number(e.target.value))}
            >
              <option value={20}>20 ข้อความล่าสุด</option>
              <option value={50}>50 ข้อความล่าสุด</option>
              <option value={100}>100 ข้อความล่าสุด</option>
              <option value={200}>200 ข้อความล่าสุด</option>
            </select>
          </div>

          {/* Summarize Button */}
          <Button
            onClick={handleSummarize}
            disabled={!selectedRoomId || isSummarizing}
            className="w-full"
          >
            {isSummarizing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังสรุป...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                สรุปด้วย AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-4">
            <p className="text-red-500 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading Skeleton */}
      {isSummarizing && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">AI กำลังวิเคราะห์ข้อความ...</span>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
              <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Result */}
      {summary && stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              สรุปจาก {stats.roomName}
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              วิเคราะห์จาก {stats.messageCount} ข้อความ
            </p>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
              {summary}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!selectedRoomId && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>เลือกห้องเพื่อสรุปแชทด้วย AI</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
