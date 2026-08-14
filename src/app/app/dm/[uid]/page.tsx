"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { TopBar } from "@/components/layout/TopBar";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth-context";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import {
  clearTyping,
  dmIdFor,
  listenDmMessages,
  markDmRead,
  sendDmMessage,
  setTyping,
  uploadPastedImage,
} from "@/lib/db";
import type { MessageData } from "@/types";

export default function DmPage() {
  const { uid: otherUid } = useParams<{ uid: string }>();
  const { user, profile } = useAuth();
  const otherProfile = useUserProfile(otherUid);
  const [messages, setMessages] = useState<MessageData[]>([]);

  const dmId = user ? dmIdFor(user.uid, otherUid) : null;

  useEffect(() => {
    if (!dmId) return;
    return listenDmMessages(dmId, setMessages);
  }, [dmId]);

  useEffect(() => {
    if (!user || !messages.length) return;
    void markDmRead(user.uid, otherUid);
  }, [user, otherUid, messages]);

  if (!user || !otherProfile) return <div className="flex-1" />;

  return (
    <motion.div
      key={otherUid}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <TopBar
        icon={<Avatar name={otherProfile.username} src={otherProfile.avatarUrl} size={28} />}
        title={otherProfile.username}
      />
      <MessageList messages={messages} currentUid={user.uid} />
      <TypingIndicator threadId={dmId as string} currentUid={user.uid} />
      <MessageInput
        placeholder={`Message ${otherProfile.username}`}
        uploadImage={(file) => uploadPastedImage(dmId as string, file)}
        onSend={(content) => sendDmMessage(user.uid, otherUid, content)}
        onTypingChange={(isTyping) => {
          if (!profile) return;
          if (isTyping) setTyping(dmId as string, user.uid, profile.username);
          else clearTyping(dmId as string, user.uid);
        }}
      />
    </motion.div>
  );
}
