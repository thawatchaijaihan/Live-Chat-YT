"use client";

import * as React from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { ViewersContent } from "@/components/dashboard/viewers-content";
import { ChatWindow } from "@/components/chat/chat-window";
import { YouTubeChatProvider } from "@/lib/youtube-chat-context";
import { ChatRoomsProvider, useChatRooms } from "@/lib/chat-rooms-context";

function MainContent() {
  const [activeView, setActiveView] = React.useState<string>("dashboard");
  const { fetchRooms } = useChatRooms();

  // Fetch rooms on mount
  React.useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return (
    <>
      {/* Sidebar for large screens - hidden on small screens */}
      <div className="hidden lg:flex">
        <Sidebar onNavigate={setActiveView} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Tab bar for small screens - hidden on large screens */}
        <div className="lg:hidden border-b px-4 py-2 shrink-0">
          <div className="flex gap-1">
            <button
              className={`px-3 py-1.5 text-sm rounded-md ${
                activeView === "dashboard"
                  ? "bg-secondary"
                  : "hover:bg-accent"
              }`}
              onClick={() => setActiveView("dashboard")}
            >
              Dashboard
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded-md ${
                activeView === "chat"
                  ? "bg-secondary"
                  : "hover:bg-accent"
              }`}
              onClick={() => setActiveView("chat")}
            >
              Live Chat
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded-md ${
                activeView === "viewers"
                  ? "bg-secondary"
                  : "hover:bg-accent"
              }`}
              onClick={() => setActiveView("viewers")}
            >
              Filter
            </button>
          </div>
        </div>

        {/* Content based on active view */}
        {activeView === "dashboard" && (
          <div className="flex-1 overflow-auto">
            <DashboardContent />
          </div>
        )}

        {activeView === "chat" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <ChatWindow />
          </div>
        )}

        {activeView === "viewers" && (
          <ViewersContent />
        )}

        {activeView !== "dashboard" && activeView !== "chat" && activeView !== "viewers" && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Coming soon: {activeView}</p>
          </div>
        )}
      </div>
    </>
  );
}

export default function Home() {
  return (
    <ChatRoomsProvider>
      <YouTubeChatProvider>
        <div className="flex h-screen bg-background overflow-hidden">
          <MainContent />
        </div>
      </YouTubeChatProvider>
    </ChatRoomsProvider>
  );
}
