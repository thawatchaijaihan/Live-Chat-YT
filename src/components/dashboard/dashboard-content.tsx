"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useChatRooms } from "@/lib/chat-rooms-context";
import { Loader2, Send } from "lucide-react";

export function DashboardContent() {
  const { rooms, activeRoomId, removeRoom, fetchRoomStatus } = useChatRooms();

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

  // Stats
  const totalMessages = rooms.reduce((sum, room) => sum + room.messageCount, 0);
  const connectedRooms = rooms.filter((room) => room.isConnected).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">YouTube live chat rooms</p>
      </div>

      {/* Stats */}
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
              <p className="text-sm">ไปที่ Settings เพื่อเพิ่มห้องใหม่</p>
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
                      {room.telegramChatId ? (
                        <Badge variant="default" className="bg-blue-500 gap-1 text-xs" title={`Telegram: ${room.telegramChatId}`}>
                          <Send className="h-3 w-3" />
                          Telegram
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                          <Send className="h-3 w-3" />
                          ไม่เชื่อมต่อ
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
