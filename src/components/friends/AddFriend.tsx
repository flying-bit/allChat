"use client";

import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { findUidByUsername, sendFriendRequest } from "@/lib/db";

export function AddFriend() {
  const { user, profile } = useAuth();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !profile || !username.trim()) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const trimmed = username.trim();
      if (trimmed.toLowerCase() === profile.usernameLower) {
        setStatus("You can't send a friend request to yourself.");
        return;
      }
      const targetUid = await findUidByUsername(trimmed);
      if (!targetUid) {
        setStatus("No one with that username was found.");
        return;
      }
      await sendFriendRequest(user.uid, profile.username, targetUid);
      setStatus("Request sent!");
      setUsername("");
    } catch {
      setStatus("Something went wrong, try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 font-semibold">Add Friend</h3>
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <Input
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          className="flex-1"
        />
        <Button type="submit" loading={submitting}>
          <UserPlus size={16} /> Send
        </Button>
      </form>
      {status && <p className="mt-2 text-sm text-muted">{status}</p>}
    </div>
  );
}
