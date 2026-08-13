"use client";

import { Users } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { AddFriend } from "@/components/friends/AddFriend";
import { FriendRequests } from "@/components/friends/FriendRequests";
import { FriendList } from "@/components/friends/FriendList";

export default function FriendsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar icon={<Users size={18} className="text-muted" />} title="Arkadaşlar" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <AddFriend />
          <FriendRequests />
          <FriendList />
        </div>
      </div>
    </div>
  );
}
