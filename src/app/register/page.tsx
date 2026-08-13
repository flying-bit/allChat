"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  const { user, loading, register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/app");
  }, [user, loading, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, username);
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt sırasında bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm"
      >
        <h1 className="mb-1 text-2xl font-bold text-accent">allChat</h1>
        <p className="mb-6 text-sm text-muted">Yeni bir hesap oluştur</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="username"
            label="Kullanıcı adı"
            required
            minLength={3}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            id="email"
            type="email"
            label="E-posta"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            id="password"
            type="password"
            label="Şifre"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={submitting} className="mt-2 w-full">
            Kayıt Ol
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Zaten hesabın var mı?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Giriş yap
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
