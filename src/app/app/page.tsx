"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GENESIS_SERVER_ID, GENESIS_TEXT_CHANNEL_ID } from "@/lib/constants";

export default function AppIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/app/servers/${GENESIS_SERVER_ID}/channels/${GENESIS_TEXT_CHANNEL_ID}`);
  }, [router]);

  return null;
}
