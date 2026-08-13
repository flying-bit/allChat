"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Shared app-shell UI state: mobile drawer toggles plus the single
// user-settings modal instance (opened from both ServerRail and
// ChannelSidebar's profile rows).
interface MobileUIContextValue {
  channelDrawerOpen: boolean;
  toggleChannelDrawer: () => void;
  closeChannelDrawer: () => void;
  memberListOpen: boolean;
  toggleMemberList: () => void;
  closeMemberList: () => void;
  userSettingsOpen: boolean;
  openUserSettings: () => void;
  closeUserSettings: () => void;
}

const MobileUIContext = createContext<MobileUIContextValue | null>(null);

export function MobileUIProvider({ children }: { children: ReactNode }) {
  const [channelDrawerOpen, setChannelDrawerOpen] = useState(false);
  const [memberListOpen, setMemberListOpen] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);

  const value: MobileUIContextValue = {
    channelDrawerOpen,
    toggleChannelDrawer: () => setChannelDrawerOpen((v) => !v),
    closeChannelDrawer: () => setChannelDrawerOpen(false),
    memberListOpen,
    toggleMemberList: () => setMemberListOpen((v) => !v),
    closeMemberList: () => setMemberListOpen(false),
    userSettingsOpen,
    openUserSettings: () => setUserSettingsOpen(true),
    closeUserSettings: () => setUserSettingsOpen(false),
  };

  return <MobileUIContext.Provider value={value}>{children}</MobileUIContext.Provider>;
}

export function useMobileUI() {
  const ctx = useContext(MobileUIContext);
  if (!ctx) throw new Error("useMobileUI must be used within MobileUIProvider");
  return ctx;
}
