"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
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
      await login(email, password);
      router.replace("/app");
    } catch {
      setError("E-posta veya şifre hatalı.");
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
        <p className="mb-6 text-sm text-muted">Hesabına giriş yap</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={submitting} className="mt-2 w-full">
            Giriş Yap
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Hesabın yok mu?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Kayıt ol
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
