"use client";

import { useEffect, useState } from "react";
import { listenUserProfile } from "@/lib/db";
import type { UserProfile } from "@/types";

export function useUserProfile(uid: string | undefined | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    if (!uid) return;
    return listenUserProfile(uid, setProfile);
  }, [uid]);
  return uid ? profile : null;
}
