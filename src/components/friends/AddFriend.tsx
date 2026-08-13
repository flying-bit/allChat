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
        setStatus("Kendine arkadaşlık isteği gönderemezsin.");
        return;
      }
      const targetUid = await findUidByUsername(trimmed);
      if (!targetUid) {
        setStatus("Bu kullanıcı adında biri bulunamadı.");
        return;
      }
      await sendFriendRequest(user.uid, profile.username, targetUid);
      setStatus("İstek gönderildi!");
      setUsername("");
    } catch {
      setStatus("Bir hata oluştu, tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 font-semibold">Arkadaş Ekle</h3>
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <Input
          label="Kullanıcı adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="kullaniciadi"
          className="flex-1"
        />
        <Button type="submit" loading={submitting}>
          <UserPlus size={16} /> Gönder
        </Button>
      </form>
      {status && <p className="mt-2 text-sm text-muted">{status}</p>}
    </div>
  );
}
