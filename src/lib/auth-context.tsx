"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import {
  createUserProfile,
  ensureJoinedGenesis,
  isUsernameAvailable,
  listenUserProfile,
  setupPresence,
} from "./db";
import type { UserProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  register: (email: string, password: string, username: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          await ensureJoinedGenesis(u.uid);
        } catch {
          // best-effort; user may not have a profile yet mid-registration
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubProfile = listenUserProfile(user.uid, setProfile);
    const unsubPresence = setupPresence(user.uid);
    return () => {
      unsubProfile();
      unsubPresence();
    };
  }, [user]);

  async function register(email: string, password: string, username: string) {
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      throw new Error("Username must be at least 3 characters long.");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      throw new Error("Username can only contain letters, numbers, and underscores.");
    }
    const available = await isUsernameAvailable(trimmed);
    if (!available) {
      throw new Error("That username is already taken.");
    }
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await createUserProfile(cred.user.uid, trimmed, email);
  }

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
