"use client";

import { Sidebar as YishanSidebar, SidebarProvider } from "@zerocmf/yishan-shadcn";

export function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <YishanSidebar />
      <main className="flex-1">
        {children}
      </main>
    </SidebarProvider>
  );
}