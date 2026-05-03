import { useState, useCallback } from "react";
import type { Fragrance } from "@/types";

export interface WishlistItem extends Fragrance {
  addedAt: string;
  personalNote: string;
}

const KEY = "scentinel-wishlist";

function load(): WishlistItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function save(items: WishlistItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function useWishlist() {
  const [items, setItems] = useState<WishlistItem[]>(load);

  const add = useCallback((f: Fragrance) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === f.id)) return prev;
      const next = [{ ...f, addedAt: new Date().toISOString(), personalNote: "" }, ...prev];
      save(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => { const next = prev.filter((i) => i.id !== id); save(next); return next; });
  }, []);

  const isWishlisted = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  const updateNote = useCallback((id: string, note: string) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, personalNote: note } : i));
      save(next);
      return next;
    });
  }, []);

  return { items, add, remove, isWishlisted, updateNote };
}
