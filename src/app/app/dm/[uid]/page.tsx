"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth-context";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { dmIdFor, listenDmMessages, sendDmMessage, uploadPastedImage } from "@/lib/db";
import type { MessageData } from "@/types";

export default function DmPage() {
  const { uid: otherUid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const otherProfile = useUserProfile(otherUid);
  const [messages, setMessages] = useState<MessageData[]>([]);

  const dmId = user ? dmIdFor(user.uid, otherUid) : null;

  useEffect(() => {
    if (!dmId) return;
    return listenDmMessages(dmId, setMessages);
  }, [dmId]);

  if (!user || !otherProfile) return <div className="flex-1" />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        icon={<Avatar name={otherProfile.username} src={otherProfile.avatarUrl} size={28} />}
        title={otherProfile.username}
      />
      <MessageList messages={messages} currentUid={user.uid} />
      <MessageInput
        placeholder={`Message ${otherProfile.username}`}
        uploadImage={(file) => uploadPastedImage(dmId as string, file)}
        onSend={(content) => sendDmMessage(user.uid, otherUid, content)}
      />
    </div>
  );
}
