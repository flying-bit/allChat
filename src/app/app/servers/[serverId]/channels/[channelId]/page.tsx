"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Hash, Volume2, Users } from "lucide-react";
import { motion } from "motion/react";
import { TopBar } from "@/components/layout/TopBar";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { VoiceChannelPanel } from "@/components/voice/VoiceChannelPanel";
import { MemberList } from "@/components/layout/MemberList";
import { useAuth } from "@/lib/auth-context";
import { useMobileUI } from "@/lib/mobile-ui-context";
import {
  clearTyping,
  deleteChannelMessage,
  listenChannelMeta,
  listenChannelMessages,
  listenChannelReactions,
  markChannelRead,
  sendChannelMessage,
  setChannelReaction,
  setTyping,
  uploadPastedImage,
} from "@/lib/db";
import type { ChannelData, MessageData, ReactionMap } from "@/types";

export default function ChannelPage() {
  const { serverId, channelId } = useParams<{ serverId: string; channelId: string }>();
  const { user, profile } = useAuth();
  const { toggleMemberList } = useMobileUI();
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [reactions, setReactions] = useState<Record<string, ReactionMap>>({});
  const [replyTo, setReplyTo] = useState<MessageData | null>(null);

  // Clear a pending reply when the channel changes, without a setState-in-
  // effect cascade (see the matching comment pattern in ServerSettingsModal)
  // - adjusting state during render is React's recommended approach here.
  const [replyToChannelId, setReplyToChannelId] = useState(channelId);
  if (channelId !== replyToChannelId) {
    setReplyToChannelId(channelId);
    setReplyTo(null);
  }

  useEffect(() => listenChannelMeta(serverId, channelId, setChannel), [serverId, channelId]);

  useEffect(() => {
    if (channel?.type !== "text") return;
    return listenChannelMessages(channelId, setMessages);
  }, [channelId, channel?.type]);

  useEffect(() => {
    if (channel?.type !== "text") return;
    return listenChannelReactions(channelId, setReactions);
  }, [channelId, channel?.type]);

  // Viewing a text channel clears its unread badge - re-mark on every
  // message change so it stays cleared as new messages arrive too.
  useEffect(() => {
    if (channel?.type !== "text" || !user || messages.length === 0) return;
    void markChannelRead(user.uid, channelId);
  }, [channel?.type, channelId, messages, user]);

  const memberListToggle = (
    <button
      onClick={toggleMemberList}
      className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer lg:hidden"
      aria-label="Open member list"
    >
      <Users size={18} />
    </button>
  );

  if (!channel || !user) {
    return <div className="flex-1" />;
  }

  if (channel.type === "voice") {
    return (
      <div className="flex min-h-0 min-w-0 flex-1">
        <motion.div
          key={channelId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <TopBar
            icon={<Volume2 size={18} className="text-muted" />}
            title={channel.name}
            right={memberListToggle}
          />
          <VoiceChannelPanel channelId={channelId} />
        </motion.div>
        <MemberList serverId={serverId} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <motion.div
        key={channelId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <TopBar
          icon={<Hash size={18} className="text-muted" />}
          title={channel.name}
          right={memberListToggle}
        />
        <MessageList
          messages={messages}
          currentUid={user.uid}
          reactions={reactions}
          onReply={setReplyTo}
          onDelete={(messageId) => void deleteChannelMessage(channelId, messageId)}
          onReact={(messageId, emoji, active) =>
            void setChannelReaction(channelId, messageId, emoji, user.uid, active)
          }
        />
        <TypingIndicator threadId={channelId} currentUid={user.uid} />
        <MessageInput
          placeholder={`Message #${channel.name}`}
          uploadImage={(file) => uploadPastedImage(channelId, file)}
          onSend={(content) => sendChannelMessage(channelId, user.uid, content)}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onTypingChange={(isTyping) => {
            if (!profile) return;
            if (isTyping) setTyping(channelId, user.uid, profile.username);
            else clearTyping(channelId, user.uid);
          }}
        />
      </motion.div>
      <MemberList serverId={serverId} />
    </div>
  );
}
