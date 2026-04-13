"use client";

import * as React from "react";
import { MessageSquare, LayoutDashboard, Settings, Filter, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  onNavigate?: (view: string) => void;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", view: "dashboard" },
  { icon: MessageSquare, label: "Live Chat", view: "chat" },
  { icon: Filter, label: "Filter", view: "viewers" },
  { icon: Sparkles, label: "AI", view: "ai-summarizer" },
  { icon: Settings, label: "Settings", view: "settings" },
];

export function Sidebar({ onNavigate, className }: SidebarProps & { className?: string }) {
  const [active, setActive] = React.useState("Dashboard");

  const handleClick = (label: string, view: string) => {
    setActive(label);
    onNavigate?.(view);
  };

  return (
    <div className={cn("flex flex-col h-screen bg-sidebar border-r w-56 shrink-0", className)}>
      <div className="p-4">
        <h1 className="text-xl font-bold px-3">Live Chat YT</h1>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.label}
              variant={active === item.label ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3",
                active === item.label && "bg-accent"
              )}
              onClick={() => handleClick(item.label, item.view)}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Button>
          ))}
        </nav>
      </ScrollArea>
      <div className="p-4 border-t">
        <div className="flex items-center gap-3 px-3">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
            U
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">User</span>
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
