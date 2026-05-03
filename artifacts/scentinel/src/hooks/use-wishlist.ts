import { useState, useCallback, useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import type { Fragrance } from "@/types";

export interface WishlistItem extends Fragrance {
  addedAt: string;
  personalNote: string;
}

const LOCAL_KEY = "scentinel-wishlist";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function loadLocal(): WishlistItem[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveLocal(items: WishlistItem[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function useWishlist() {
  const { isSignedIn, isLoaded } = useUser();
  const [items, setItems] = useState<WishlistItem[]>(loadLocal);
  const synced = useRef(false);

  // When user signs in, load wishlist from server and merge with local
  useEffect(() => {
    if (!isLoaded || !isSignedIn || synced.current) return;
    synced.current = true;

    (async () => {
      try {
        const serverItems: WishlistItem[] = await apiFetch("/api/wishlist");
        const local = loadLocal();

        // Merge: items in local but not on server → push to server
        const serverIds = new Set(serverItems.map((i) => i.id));
        for (const item of local) {
          if (!serverIds.has(item.id)) {
            await apiFetch("/api/wishlist", {
              method: "POST",
              body: JSON.stringify({ fragrance: item, personalNote: item.personalNote }),
            }).catch(() => {});
          }
        }

        // Reload from server (canonical source when signed in)
        const merged: WishlistItem[] = await apiFetch("/api/wishlist");
        setItems(merged);
        saveLocal(merged);
      } catch {
        // Server unavailable — stay on local
      }
    })();
  }, [isLoaded, isSignedIn]);

  // When user signs out, reload from localStorage
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      synced.current = false;
      setItems(loadLocal());
    }
  }, [isLoaded, isSignedIn]);

  const add = useCallback(
    async (f: Fragrance) => {
      if (items.some((i) => i.id === f.id)) return;
      const item: WishlistItem = {
        ...f,
        addedAt: new Date().toISOString(),
        personalNote: "",
      };

      setItems((prev) => {
        const next = [item, ...prev];
        saveLocal(next);
        return next;
      });

      if (isSignedIn) {
        apiFetch("/api/wishlist", {
          method: "POST",
          body: JSON.stringify({ fragrance: f }),
        }).catch(() => {});
      }
    },
    [items, isSignedIn],
  );

  const remove = useCallback(
    async (id: string) => {
      setItems((prev) => {
        const next = prev.filter((i) => i.id !== id);
        saveLocal(next);
        return next;
      });

      if (isSignedIn) {
        apiFetch(`/api/wishlist/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }).catch(() => {});
      }
    },
    [isSignedIn],
  );

  const isWishlisted = useCallback(
    (id: string) => items.some((i) => i.id === id),
    [items],
  );

  const updateNote = useCallback(
    async (id: string, note: string) => {
      setItems((prev) => {
        const next = prev.map((i) => (i.id === id ? { ...i, personalNote: note } : i));
        saveLocal(next);
        return next;
      });

      if (isSignedIn) {
        apiFetch(`/api/wishlist/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ personalNote: note }),
        }).catch(() => {});
      }
    },
    [isSignedIn],
  );

  return { items, add, remove, isWishlisted, updateNote };
}
