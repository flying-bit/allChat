"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Hash, Volume2 } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { VoiceChannelPanel } from "@/components/voice/VoiceChannelPanel";
import { useAuth } from "@/lib/auth-context";
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
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);

  useEffect(() => listenChannelMeta(serverId, channelId, setChannel), [serverId, channelId]);

  useEffect(() => {
    if (channel?.type !== "text") return;
    return listenChannelMessages(channelId, setMessages);
  }, [channelId, channel?.type]);

  if (!channel || !user) {
    return <div className="flex-1" />;
  }

  if (channel.type === "voice") {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar icon={<Volume2 size={18} className="text-muted" />} title={channel.name} />
        <VoiceChannelPanel channelId={channelId} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar icon={<Hash size={18} className="text-muted" />} title={channel.name} />
      <MessageList messages={messages} currentUid={user.uid} />
      <MessageInput
        placeholder={`#${channel.name} kanalına mesaj gönder`}
        uploadImage={(file) => uploadPastedImage(channelId, file)}
        onSend={(content) => sendChannelMessage(channelId, user.uid, content)}
      />
    </div>
  );
}
