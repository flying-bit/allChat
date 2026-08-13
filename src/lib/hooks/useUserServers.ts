"use client";

import { useEffect, useState } from "react";
import { listenUserServerIds, listenServer } from "@/lib/db";
import type { ServerData } from "@/types";

export function useUserServers(uid: string | undefined) {
  const [ids, setIds] = useState<string[]>([]);
  const [servers, setServers] = useState<Record<string, ServerData>>({});

  useEffect(() => {
    if (!uid) {
      setIds([]);
      return;
    }
    return listenUserServerIds(uid, setIds);
  }, [uid]);

  useEffect(() => {
    const unsubs = ids.map((id) =>
      listenServer(id, (s) => {
        setServers((prev) => {
          if (!s) {
            const next = { ...prev };
            delete next[id];
            return next;
          }
          return { ...prev, [id]: s };
        });
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [ids]);

  return ids.map((id) => servers[id]).filter((s): s is ServerData => Boolean(s));
}
