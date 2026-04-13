"use client";

import * as React from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { ViewersContent } from "@/components/dashboard/viewers-content";
import { ChatWindow } from "@/components/chat/chat-window";
import { YouTubeChatProvider } from "@/lib/youtube-chat-context";
import { ChatRoomsProvider, useChatRooms } from "@/lib/chat-rooms-context";
import type { ChatRoom, YouTubeMessage } from "@/lib/db";

const navItems = [
  { label: "Dashboard", view: "dashboard", href: "/" },
  { label: "Live Chat", view: "chat", href: "/?view=chat" },
  { label: "Filter", view: "viewers", href: "/?view=viewers" },
];

function MainContent({ initialView }: { initialView: string }) {
  const [activeView, setActiveView] = React.useState(initialView);
  const { fetchRooms } = useChatRooms();

  const navigate = React.useCallback((view: string, href: string) => {
    setActiveView(view);
    window.history.replaceState(null, "", href);
  }, []);

  // Fetch rooms on mount to refresh server-rendered data when JavaScript is available.
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
      <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full max-w-full overflow-hidden">
        {/* Tab bar for small screens - hidden on large screens */}
        <div className="lg:hidden border-b px-4 py-2 shrink-0 w-full max-w-full overflow-x-hidden">
          <div className="flex gap-1 max-w-full overflow-x-auto">
            {navItems.map((item) => (
              <a
                key={item.view}
                href={item.href}
                className={`shrink-0 px-3 py-1.5 text-sm rounded-md ${
                  activeView === item.view
                    ? "bg-secondary"
                    : "hover:bg-accent"
                }`}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(item.view, item.href);
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Content based on active view */}
        {activeView === "dashboard" && (
          <div className="flex-1 overflow-auto">
            <DashboardContent />
          </div>
        )}

        {activeView === "chat" && (
          <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full max-w-full overflow-hidden">
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

export default function HomeClient({
  initialActiveRoomId,
  initialMessagesByRoom,
  initialRooms,
  initialView,
}: {
  initialActiveRoomId: string | null;
  initialMessagesByRoom: Record<string, YouTubeMessage[]>;
  initialRooms: ChatRoom[];
  initialView: string;
}) {
  return (
    <ChatRoomsProvider
      initialActiveRoomId={initialActiveRoomId}
      initialMessagesByRoom={initialMessagesByRoom}
      initialRooms={initialRooms}
    >
      <YouTubeChatProvider>
        <div className="flex h-screen w-full max-w-full bg-background overflow-hidden">
          <MainContent initialView={initialView} />
        </div>
      </YouTubeChatProvider>
    </ChatRoomsProvider>
  );
}
