"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/layout/AuthGate";
import { ServerRail } from "@/components/layout/ServerRail";
import { ChannelSidebar } from "@/components/layout/ChannelSidebar";
import { DmSidebar } from "@/components/layout/DmSidebar";
import { UserSettingsModal } from "@/components/settings/UserSettingsModal";
import { MobileUIProvider } from "@/lib/mobile-ui-context";

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const serverId = pathname.match(/\/app\/servers\/([^/]+)/)?.[1];

  return (
    <AuthGate>
      <MobileUIProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-background">
          <ServerRail />
          {serverId ? <ChannelSidebar key={serverId} serverId={serverId} /> : <DmSidebar />}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>
        <UserSettingsModal />
      </MobileUIProvider>
    </AuthGate>
  );
}
