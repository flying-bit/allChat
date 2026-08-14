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
  deleteDmMessage,
  dmIdFor,
  listenDmMessages,
  listenDmReactions,
  markDmRead,
  sendDmMessage,
  setDmReaction,
  setTyping,
  uploadPastedImage,
  uploadChatVideo,
} from "@/lib/db";
import type { MessageData, ReactionMap } from "@/types";

export default function DmPage() {
  const { uid: otherUid } = useParams<{ uid: string }>();
  const { user, profile } = useAuth();
  const otherProfile = useUserProfile(otherUid);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [reactions, setReactions] = useState<Record<string, ReactionMap>>({});
  const [replyTo, setReplyTo] = useState<MessageData | null>(null);

  // Clear a pending reply when the thread changes, without a setState-in-
  // effect cascade - adjusting state during render (React's recommended
  // pattern) instead of in a useEffect.
  const [replyToOtherUid, setReplyToOtherUid] = useState(otherUid);
  if (otherUid !== replyToOtherUid) {
    setReplyToOtherUid(otherUid);
    setReplyTo(null);
  }

  const dmId = user ? dmIdFor(user.uid, otherUid) : null;

  useEffect(() => {
    if (!dmId) return;
    return listenDmMessages(dmId, setMessages);
  }, [dmId]);

  useEffect(() => {
    if (!dmId) return;
    return listenDmReactions(dmId, setReactions);
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
      <MessageList
        messages={messages}
        currentUid={user.uid}
        reactions={reactions}
        onReply={setReplyTo}
        onDelete={(messageId) => void deleteDmMessage(dmId as string, messageId)}
        onReact={(messageId, emoji, active) =>
          void setDmReaction(dmId as string, messageId, emoji, user.uid, active)
        }
      />
      <TypingIndicator threadId={dmId as string} currentUid={user.uid} />
      <MessageInput
        placeholder={`Message ${otherProfile.username}`}
        uploadImage={(file) => uploadPastedImage(dmId as string, file)}
        uploadVideo={(file) => uploadChatVideo(dmId as string, file)}
        onSend={(content) => sendDmMessage(user.uid, otherUid, content)}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onTypingChange={(isTyping) => {
          if (!profile) return;
          if (isTyping) setTyping(dmId as string, user.uid, profile.username);
          else clearTyping(dmId as string, user.uid);
        }}
      />
    </motion.div>
  );
}
