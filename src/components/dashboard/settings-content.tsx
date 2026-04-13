"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useChatRooms } from "@/lib/chat-rooms-context";
import { Loader2 } from "lucide-react";

export function SettingsContent() {
  const { rooms, activeRoomId, setActiveRoom, fetchRoomStatus, addRoom } = useChatRooms();
  const [selectedRoomId, setSelectedRoomId] = React.useState<string | null>(activeRoomId);
  const [telegramChatId, setTelegramChatId] = React.useState("");
  const [retentionDays, setRetentionDays] = React.useState(3);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add New Room state
  const [newRoomName, setNewRoomName] = React.useState("");
  const [newRoomInput, setNewRoomInput] = React.useState("");
  const [isFetchingName, setIsFetchingName] = React.useState(false);
  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Load settings when selected room changes
  React.useEffect(() => {
    if (selectedRoomId) {
      const room = rooms.find((r) => r.id === selectedRoomId);
      if (room) {
        setTelegramChatId(room.telegramChatId || "");
      }
    }
  }, [selectedRoomId, rooms]);

  // Sync with active room from context
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

  // Auto-fetch channel name when input changes
  const handleInputChange = (value: string) => {
    setNewRoomInput(value);

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    if (newRoomName && newRoomName !== "") {
      return;
    }

    fetchTimeoutRef.current = setTimeout(async () => {
      if (value.trim() && isYouTubeInput(value)) {
        setIsFetchingName(true);
        try {
          const response = await fetch(`/api/channel-info?input=${encodeURIComponent(value)}`);
          const data = await response.json();
          if (data.name && !newRoomName) {
            setNewRoomName(data.name);
          }
        } catch (error) {
          console.error("Failed to fetch channel name:", error);
        } finally {
          setIsFetchingName(false);
        }
      }
    }, 1000);
  };

  const isYouTubeInput = (input: string): boolean => {
    const trimmed = input.trim();
    if (
      trimmed.includes("youtube.com") ||
      trimmed.includes("youtu.be") ||
      trimmed.startsWith("@") ||
      /^[a-zA-Z0-9_-]{11}$/.test(trimmed)
    ) {
      return true;
    }
    return false;
  };

  const handleAddRoom = async () => {
    if (newRoomName.trim() && newRoomInput.trim()) {
      const newId = await addRoom(newRoomName.trim(), newRoomInput.trim());
      if (newId) {
        handleRoomChange(newId);
      }
      setNewRoomName("");
      setNewRoomInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddRoom();
    }
  };

  const handleSave = async () => {
    if (!selectedRoomId) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch(`/api/rooms/${selectedRoomId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramChatId,
          retentionDays,
        }),
      });

      if (response.ok) {
        setSaveMessage({ type: "success", text: "บันทึกสำเร็จ" });
        await fetchRoomStatus(selectedRoomId);
      } else {
        setSaveMessage({ type: "error", text: "เกิดข้อผิดพลาด" });
      }
    } catch (error) {
      setSaveMessage({ type: "error", text: "เกิดข้อผิดพลาด: " + String(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const currentRoom = rooms.find((r) => r.id === selectedRoomId);
  const isTelegramEnabled = !!telegramChatId;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">ตั้งค่าห้อง</h2>
        <p className="text-muted-foreground">จัดการการเชื่อมต่อ Telegram และการเก็บรักษาข้อความ</p>
      </div>

      {/* Add New Room */}
      <Card>
        <CardHeader>
          <CardTitle>เพิ่มห้องใหม่</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="YouTube URL, Channel @handle, หรือ Video ID"
            value={newRoomInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="ชื่อห้อง (กรอกอัตโนมัติ)"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pr-8"
              />
              {isFetchingName && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <Button onClick={handleAddRoom} disabled={!newRoomName.trim() || !newRoomInput.trim()}>
              เพิ่ม
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Room Selector */}
      <Card>
        <CardHeader>
          <CardTitle>เลือกห้อง</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
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
            <p className="text-xs text-muted-foreground mt-2 truncate">{currentRoom.input}</p>
          )}
        </CardContent>
      </Card>

      {selectedRoomId && (
        <>
          {/* Telegram Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Telegram</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="telegramEnabled"
                  checked={isTelegramEnabled}
                  onChange={(e) => setTelegramChatId(e.target.checked ? telegramChatId || "-" : "")}
                  className="h-4 w-4"
                />
                <label htmlFor="telegramEnabled" className="text-sm font-medium">
                  เปิดใช้งานการส่งต่อไป Telegram
                </label>
              </div>

              {isTelegramEnabled && (
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Telegram Chat ID</label>
                  <Input
                    placeholder="เช่น -1001234567890"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    ใส่ Chat ID ของกลุ่มหรือแชนแนลที่ต้องการรับข้อความ
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message Retention */}
          <Card>
            <CardHeader>
              <CardTitle>การเก็บรักษาข้อความ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  เก็บข้อความไว้
                </label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                >
                  <option value={3}>3 วัน</option>
                  <option value={7}>7 วัน</option>
                  <option value={15}>15 วัน</option>
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                ข้อความที่เก่ากว่า {retentionDays} วันจะถูกลบโดยอัตโนมัติเมื่อมีข้อความใหม่
              </p>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
            </Button>
            {saveMessage && (
              <span
                className={`text-sm ${
                  saveMessage.type === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {saveMessage.text}
              </span>
            )}
          </div>
        </>
      )}

      {!selectedRoomId && (
        <div className="text-center py-12 text-muted-foreground">
          <p>กรุณาเลือกห้องเพื่อตั้งค่า</p>
        </div>
      )}
    </div>
  );
}
