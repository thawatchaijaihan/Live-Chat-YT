"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatRooms } from "@/lib/chat-rooms-context";
import { Loader2 } from "lucide-react";

export function DashboardContent() {
  const { rooms, activeRoomId, addRoom, removeRoom, setActiveRoom, fetchRoomStatus } = useChatRooms();
  const [newRoomName, setNewRoomName] = React.useState("");
  const [newRoomInput, setNewRoomInput] = React.useState("");
  const [isFetchingName, setIsFetchingName] = React.useState(false);
  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Poll room status every 3 seconds when there are active rooms
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

  // Also fetch status when activeRoomId changes
  React.useEffect(() => {
    if (activeRoomId) {
      fetchRoomStatus(activeRoomId);
    }
  }, [activeRoomId, fetchRoomStatus]);

  // Auto-fetch channel name when input changes
  const handleInputChange = (value: string) => {
    setNewRoomInput(value);

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // If room name is already customized by user, don't auto-fill
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
      await addRoom(newRoomName.trim(), newRoomInput.trim());
      setNewRoomName("");
      setNewRoomInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddRoom();
    }
  };

  // Stats
  const totalMessages = rooms.reduce((sum, room) => sum + room.messageCount, 0);
  const connectedRooms = rooms.filter((room) => room.isConnected).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Live Chat Control</h2>
        <p className="text-muted-foreground">Manage your YouTube live chat rooms</p>
      </div>

      {/* Stats + Add New Room */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {/* Total Rooms */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Rooms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rooms.length}</div>
            <p className="text-xs text-muted-foreground">{connectedRooms} connected</p>
          </CardContent>
        </Card>

        {/* Total Messages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMessages}</div>
            <p className="text-xs text-muted-foreground">across all rooms</p>
          </CardContent>
        </Card>

        {/* Add New Room */}
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Add New Room</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2">
              <Input
                placeholder="YouTube URL, Channel @handle, or Video ID"
                value={newRoomInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Room name (auto-filled)"
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
                  Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chat Rooms List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Chat Rooms</CardTitle>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No chat rooms yet</p>
              <p className="text-sm">Add a room above to start monitoring</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    activeRoomId === room.id ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{room.name}</span>
                      {room.isConnected ? (
                        <Badge variant="default" className="bg-green-500 gap-1 text-xs">
                          Live
                        </Badge>
                      ) : room.isConnecting ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Connecting
                        </Badge>
                      ) : room.isEnded ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          Ended
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs">
                          Disconnected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{room.input}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{room.messageCount} msgs</span>
                    <Button variant="ghost" size="icon" onClick={() => removeRoom(room.id)}>
                      <span className="text-destructive text-sm">Delete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
