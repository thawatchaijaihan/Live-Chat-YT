"use client";

import * as React from "react";
import { useChatRooms } from "@/lib/chat-rooms-context";
import type { YouTubeMessage } from "@/lib/db";
import { formatThaiTime } from "@/lib/time";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Search, User, MessageSquare, Filter, X } from "lucide-react";

interface FilterResult {
  roomId: string;
  roomName: string;
  messages: YouTubeMessage[];
  filterType: "user" | "text";
  filterValue: string;
}

export function ViewersContent() {
  const { rooms, activeRoomId, setActiveRoom, searchMessages } = useChatRooms();
  const [filterType, setFilterType] = React.useState<"user" | "text">("user");
  const [filterInput, setFilterInput] = React.useState("");
  const [filterResults, setFilterResults] = React.useState<FilterResult[]>([]);
  const [isFiltering, setIsFiltering] = React.useState(false);
  const [selectedTabs, setSelectedTabs] = React.useState<Set<string>>(new Set());

  // Get active room name
  const getRoomName = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    return room?.name || "Unknown";
  };

  const handleFilter = async () => {
    if (!filterInput.trim()) return;

    setIsFiltering(true);
    setFilterResults([]);
    setSelectedTabs(new Set());

    const results: FilterResult[] = [];

    for (const room of rooms) {
      try {
        const query = filterType === "user" ? filterInput.trim() : filterInput.trim();
        const messages = await searchMessages(room.id, query);

        if (messages.length > 0) {
          results.push({
            roomId: room.id,
            roomName: room.name,
            messages,
            filterType,
            filterValue: filterInput,
          });
        }
      } catch (error) {
        console.error(`Error filtering room ${room.id}:`, error);
      }
    }

    setFilterResults(results);
    // Auto-select first tab if available
    if (results.length > 0) {
      setSelectedTabs(new Set([results[0].roomId]));
    }
    setIsFiltering(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFilter();
    }
  };

  const toggleTab = (roomId: string) => {
    const newTabs = new Set(selectedTabs);
    if (newTabs.has(roomId)) {
      newTabs.delete(roomId);
    } else {
      newTabs.add(roomId);
    }
    setSelectedTabs(newTabs);
  };

  const goToMessage = (roomId: string, messageId: string) => {
    setActiveRoom(roomId);
    // Store the message ID to highlight in sessionStorage
    sessionStorage.setItem("highlightMessageId", messageId);
    // The ChatWindow should check for this on mount
  };

  const getInitials = (name: string) => {
    return name.split(/\s+/).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getUserColor = (user: string) => {
    const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-orange-500", "bg-teal-500"];
    return colors[user.charCodeAt(0) % colors.length];
  };

  const renderMessageContent = (msg: YouTubeMessage) => {
    return msg.message.map((item, idx) => {
      if (item.type === "emoji" && item.emojiUrl) {
        return <img key={idx} src={item.emojiUrl} alt={item.emojiAlt || "emoji"} className="h-5 w-5 inline-block mx-0.5" />;
      }
      if (item.type === "image" && item.text) {
        return <img key={idx} src={item.text} alt="image" className="h-20 w-20 inline-block mx-0.5 rounded" />;
      }
      return <span key={idx}>{item.text}</span>;
    });
  };

  const highlightedMsgId = typeof window !== "undefined" ? sessionStorage.getItem("highlightMessageId") : null;

  // Filter messages to show based on selected tabs
  const visibleResults = filterResults.filter((r) => selectedTabs.has(r.roomId));
  const totalMessages = visibleResults.reduce((sum, r) => sum + r.messages.length, 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b shrink-0">
        <h2 className="text-xl font-bold mb-4">Viewers</h2>

        {/* Filter Input Section */}
        <div className="space-y-3">
          {/* Filter Type Tabs */}
          <div className="flex gap-1">
            <button
              onClick={() => setFilterType("user")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                filterType === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              <User className="h-4 w-4" />
              ผู้ใช้
            </button>
            <button
              onClick={() => setFilterType("text")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                filterType === "text"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              ข้อความ
            </button>
          </div>

          {/* Input Row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              {filterType === "user" ? (
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              ) : (
                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
              <Input
                placeholder={
                  filterType === "user"
                    ? "@ชื่อผู้ใช้ เช่น @noonoei7046"
                    : "ข้อความที่ต้องการค้นหา เช่น สวัสดี"
                }
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className={filterType === "user" ? "pl-9" : "pl-9"}
              />
            </div>
            <Button onClick={handleFilter} disabled={!filterInput.trim() || isFiltering}>
              <Filter className="h-4 w-4 mr-2" />
              {isFiltering ? "กำลังกรอง..." : "กรอง"}
            </Button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="flex-1 overflow-y-auto">
        {filterResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
            <Search className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">ยังไม่มีผลลัพธ์</p>
            <p className="text-sm">
              ใส่ข้อมูลและกดปุ่ม &quot;กรอง&quot; เพื่อค้นหาข้อความ
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Room Tabs */}
            <div className="flex flex-wrap gap-2">
              {filterResults.map((result) => (
                <button
                  key={result.roomId}
                  onClick={() => toggleTab(result.roomId)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors",
                    selectedTabs.has(result.roomId)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {selectedTabs.has(result.roomId) ? (
                    <X className="h-3 w-3" />
                  ) : (
                    <span className="h-2 w-2 bg-secondary rounded-full" />
                  )}
                  <span>{result.roomName}</span>
                  <Badge
                    variant={selectedTabs.has(result.roomId) ? "secondary" : "outline"}
                    className="ml-1 text-xs"
                  >
                    {result.messages.length}
                  </Badge>
                </button>
              ))}
            </div>

            {/* Messages List */}
            {totalMessages === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>เลือกแท็บห้องเพื่อดูผลลัพธ์</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleResults.map((result) =>
                  result.messages.map((msg) => (
                    <div
                      key={`${result.roomId}-${msg.id}`}
                      data-message-id={msg.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent",
                        highlightedMsgId === msg.id && "bg-yellow-100 dark:bg-yellow-900/30"
                      )}
                      onClick={() => goToMessage(result.roomId, msg.id)}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={msg.author.thumbnail} />
                        <AvatarFallback className={cn("text-white text-xs", getUserColor(msg.author.name))}>
                          {getInitials(msg.author.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{msg.author.name}</span>
                          {msg.author.isOwner && <Badge variant="destructive" className="text-xs">Creator</Badge>}
                          {msg.author.isVerified && <Badge variant="secondary" className="text-xs">✓</Badge>}
                          {msg.isMembership && <Badge className="text-xs bg-purple-500">Member</Badge>}
                          {msg.isSuperChat && msg.amount && <Badge className="text-xs bg-yellow-500 text-black">${msg.amount}</Badge>}
                          <span className="text-xs text-muted-foreground">{formatThaiTime(msg.timestamp)}</span>
                          <Badge variant="outline" className="text-xs ml-auto">
                            {result.roomName}
                          </Badge>
                        </div>
                        <p className="text-sm break-words leading-relaxed">{renderMessageContent(msg)}</p>
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
