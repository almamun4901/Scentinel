import { useState, useCallback, useEffect } from "react";
import { useUser } from "@clerk/react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: unknown[];
  createdAt: string;
}

export interface ChatSessionMeta {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSessionFull extends ChatSessionMeta {
  messages: StoredMessage[];
}

async function apiFetch(path: string, opts?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function useChatSessions() {
  const { isSignedIn, isLoaded } = useUser();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    apiFetch("/api/chat-sessions?limit=20")
      .then((data) => setSessions(data as ChatSessionMeta[]))
      .catch(() => {});
  }, [isLoaded, isSignedIn]);

  const loadLatestSession = useCallback(async (): Promise<ChatSessionFull | null> => {
    if (!isSignedIn) return null;
    try {
      const list = (await apiFetch("/api/chat-sessions?limit=1")) as ChatSessionMeta[];
      if (list.length > 0 && list[0]) {
        setCurrentSessionId(list[0].id);
        const full = (await apiFetch(`/api/chat-sessions/${list[0].id}`)) as ChatSessionFull;
        return full;
      }
    } catch { /* ignore */ }
    return null;
  }, [isSignedIn]);

  const createSession = useCallback(
    async (title = "New conversation"): Promise<ChatSessionFull | null> => {
      if (!isSignedIn) return null;
      try {
        const session = (await apiFetch("/api/chat-sessions", {
          method: "POST",
          body: JSON.stringify({ title }),
        })) as ChatSessionFull;
        setCurrentSessionId(session.id);
        setSessions((prev) => [{ ...session, messageCount: 0 }, ...prev]);
        return session;
      } catch {
        return null;
      }
    },
    [isSignedIn],
  );

  const saveMessages = useCallback(
    (sessionId: string, messages: StoredMessage[], title?: string) => {
      if (!isSignedIn || !sessionId) return;
      apiFetch(`/api/chat-sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ messages, ...(title ? { title } : {}) }),
      }).catch(() => {});
    },
    [isSignedIn],
  );

  const startNewSession = useCallback(() => {
    setCurrentSessionId(null);
  }, []);

  return {
    currentSessionId,
    setCurrentSessionId,
    sessions,
    loadLatestSession,
    createSession,
    saveMessages,
    startNewSession,
    isSignedIn: isSignedIn ?? false,
  };
}
