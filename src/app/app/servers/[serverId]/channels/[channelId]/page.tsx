"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Hash, Volume2, Users } from "lucide-react";
import { motion } from "motion/react";
import { TopBar } from "@/components/layout/TopBar";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { VoiceChannelPanel } from "@/components/voice/VoiceChannelPanel";
import { MemberList } from "@/components/layout/MemberList";
import { useAuth } from "@/lib/auth-context";
import { useMobileUI } from "@/lib/mobile-ui-context";
import {
  listenChannelMeta,
  listenChannelMessages,
  sendChannelMessage,
  uploadPastedImage,
} from "@/lib/db";
import type { ChannelData, MessageData } from "@/types";

export default function ChannelPage() {
  const { serverId, channelId } = useParams<{ serverId: string; channelId: string }>();
  const { user } = useAuth();
  const { toggleMemberList } = useMobileUI();
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);

  useEffect(() => listenChannelMeta(serverId, channelId, setChannel), [serverId, channelId]);

  useEffect(() => {
    if (channel?.type !== "text") return;
    return listenChannelMessages(channelId, setMessages);
  }, [channelId, channel?.type]);

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
        <MessageList messages={messages} currentUid={user.uid} />
        <MessageInput
          placeholder={`Message #${channel.name}`}
          uploadImage={(file) => uploadPastedImage(channelId, file)}
          onSend={(content) => sendChannelMessage(channelId, user.uid, content)}
        />
      </motion.div>
      <MemberList serverId={serverId} />
    </div>
  );
}
