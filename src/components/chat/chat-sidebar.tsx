"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatRoom {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  time: string;
  unread: number;
  isLive: boolean;
}

const chatRooms: ChatRoom[] = [
  { id: "1", name: "Live Stream Chat", lastMessage: "Hello everyone!", time: "now", unread: 3, isLive: true },
  { id: "2", name: "Song Requests", lastMessage: "Can you play Despacito?", time: "2m", unread: 0, isLive: false },
  { id: "3", name: "Game Discussion", lastMessage: "GG!", time: "5m", unread: 1, isLive: false },
  { id: "4", name: "Off Topic", lastMessage: "Nice weather today", time: "10m", unread: 0, isLive: false },
];

export function ChatSidebar({
  selectedRoom,
  onSelectRoom,
}: {
  selectedRoom: string;
  onSelectRoom: (id: string) => void;
}) {
  return (
    <div className="w-72 border-r flex flex-col bg-card">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Chats</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {chatRooms.map((room) => (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={cn(
                "w-full p-3 rounded-lg text-left hover:bg-accent transition-colors",
                selectedRoom === room.id && "bg-accent"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={room.avatar} />
                    <AvatarFallback>{room.name[0]}</AvatarFallback>
                  </Avatar>
                  {room.isLive && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{room.name}</span>
                    {room.isLive && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                        LIVE
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {room.lastMessage}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">{room.time}</span>
                  {room.unread > 0 && (
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {room.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
