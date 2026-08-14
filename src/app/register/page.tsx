"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { animate, stagger } from "animejs";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { safeNextPath } from "@/lib/safe-redirect";

function RegisterForm() {
  const { user, loading, register } = useAuth();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [user, loading, router, next]);

  useEffect(() => {
    if (!formRef.current) return;
    animate(formRef.current.querySelectorAll(".stagger-field"), {
      opacity: [0, 1],
      translateY: [12, 0],
      delay: stagger(80),
      duration: 400,
      ease: "outQuad",
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, username);
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong during sign up.");
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
        <div className="mb-4 flex items-center gap-3">
          <Logo size={40} />
          <h1 className="text-2xl font-bold">allChat</h1>
        </div>
        <p className="mb-6 text-sm text-muted">Create a new account</p>

        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="username"
            label="Username"
            required
            minLength={3}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="stagger-field opacity-0"
          />
          <Input
            id="email"
            type="email"
            label="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="stagger-field opacity-0"
          />
          <Input
            id="password"
            type="password"
            label="Password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="stagger-field opacity-0"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={submitting} className="stagger-field opacity-0 mt-2 w-full">
            Sign Up
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            href={next === "/app" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
            className="font-medium text-accent hover:underline"
          >
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
