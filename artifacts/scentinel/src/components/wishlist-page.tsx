import { useState, useEffect } from "react";
import { Trash2, StickyNote, Bookmark, BookmarkPlus, Sparkles, Loader2 } from "lucide-react";
import { useWishlist } from "@/hooks/use-wishlist";
import { useGetProfile } from "@workspace/api-client-react";
import { ACCORD_COLORS } from "@/types";
import type { Fragrance } from "@/types";
import { BottlePlaceholder } from "@/components/bottle-placeholder";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Budget → vibe mapping for semantic search ────────────────────────────────
const BUDGET_VIBES: Record<string, string> = {
  under_50:  "affordable fresh and versatile everyday fragrance, great longevity for the price",
  "50_150":  "popular designer fragrance with excellent longevity and mass appeal",
  "150_300": "luxury niche fragrance with a unique character and sophisticated dry-down",
  no_limit:  "rare ultra-luxury niche fragrance with exceptional quality and depth",
};

// ─── WishlistCard ─────────────────────────────────────────────────────────────
function WishlistCard({ item, onRemove, onNoteUpdate, onOpenDrawer }: {
  item: ReturnType<typeof useWishlist>["items"][number];
  onRemove: (id: string) => void;
  onNoteUpdate: (id: string, note: string) => void;
  onOpenDrawer?: (f: ReturnType<typeof useWishlist>["items"][number]) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(item.personalNote);
  const [hovered, setHovered] = useState(false);

  const saveNote = () => { onNoteUpdate(item.id, noteText); setEditingNote(false); };

  return (
    <div
      className="rounded border p-4 flex flex-col gap-3"
      style={{
        background: hovered ? "hsl(34 17% 11%)" : "hsl(34 17% 8%)",
        borderColor: hovered ? "hsl(42 54% 30%)" : "hsl(34 10% 14%)",
        transition: "background 0.18s, border-color 0.18s",
        cursor: onOpenDrawer ? "pointer" : "default",
      }}
      onClick={() => onOpenDrawer?.(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="w-full rounded overflow-hidden flex items-center justify-center relative -mx-4"
        style={{
          width: "calc(100% + 2rem)", height: 180,
          background: "linear-gradient(160deg, hsl(34 17% 10%) 0%, hsl(34 12% 6%) 100%)",
        }}
      >
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="h-full w-full object-contain"
            style={{ padding: "8px 40px" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <BottlePlaceholder size={60} />
        )}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent 55%, hsl(34 17% 8% / 0.92) 100%)" }} />
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          className="absolute top-2 right-2 p-1.5 rounded-full transition-colors"
          style={{ background: "hsl(30 14% 4% / 0.65)", color: "hsl(40 10% 45%)", backdropFilter: "blur(4px)" }}
          title="Remove from wishlist"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex-1 min-w-0 mt-1">
        <p className="text-xs font-mono tracking-widest uppercase" style={{ color: "hsl(40 10% 42%)" }}>
          {item.house}
        </p>
        <p className="font-serif text-lg leading-tight mt-0.5 truncate" style={{ color: "hsl(40 20% 90%)" }}>
          {item.name}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs font-mono" style={{ color: "hsl(42 54% 60%)" }}>${item.price_usd}</span>
          <span className="text-xs" style={{ color: "hsl(40 10% 35%)" }}>·</span>
          <span className="text-xs font-mono" style={{ color: "hsl(40 10% 40%)" }}>{item.concentration}</span>
          <span className="text-xs" style={{ color: "hsl(40 10% 35%)" }}>·</span>
          <span className="text-xs font-mono" style={{ color: "hsl(40 10% 40%)" }}>{item.year}</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {item.accords.slice(0, 4).map((accord) => {
            const color = ACCORD_COLORS[accord] ?? "#7a7a7a";
            return (
              <span key={accord} className="text-xs px-1.5 py-0.5 rounded capitalize"
                style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                {accord}
              </span>
            );
          })}
        </div>
      </div>

      {editingNote ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            className="w-full text-xs rounded px-2.5 py-2 resize-none outline-none"
            style={{ background: "hsl(34 12% 11%)", border: "1px solid hsl(42 54% 35%)", color: "hsl(40 15% 72%)", minHeight: 60 }}
            placeholder="Add a note — batch, where to try it, thoughts..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setNoteText(item.personalNote); setEditingNote(false); }}
              className="text-xs px-2.5 py-1 rounded" style={{ color: "hsl(40 10% 40%)" }}>
              Cancel
            </button>
            <button onClick={saveNote} className="text-xs px-3 py-1 rounded"
              style={{ background: "hsl(42 54% 50% / 0.15)", color: "hsl(42 54% 65%)" }}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setEditingNote(true); }}
          className="flex items-center gap-1.5 text-xs text-left rounded px-2 py-1 transition-colors"
          style={{ color: item.personalNote ? "hsl(40 15% 55%)" : "hsl(40 10% 32%)", background: item.personalNote ? "hsl(34 12% 10%)" : "transparent" }}
        >
          <StickyNote size={11} />
          <span className="truncate">{item.personalNote || "Add a personal note..."}</span>
        </button>
      )}

      <p className="text-xs" style={{ color: "hsl(40 10% 28%)" }}>
        Added {new Date(item.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}

// ─── Suggestion card ──────────────────────────────────────────────────────────
function SuggestionCard({ frag, onAdd, added }: {
  frag: Fragrance & { match_score?: number; match_reason?: string; similarity_pct?: number };
  onAdd: (f: Fragrance) => void;
  added: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const score = frag.match_score ?? frag.similarity_pct;

  return (
    <div
      className="rounded border flex flex-col overflow-hidden"
      style={{
        background: hovered ? "hsl(34 17% 11%)" : "hsl(34 17% 8%)",
        borderColor: hovered ? "hsl(42 54% 28%)" : "hsl(34 10% 14%)",
        transition: "background 0.18s, border-color 0.18s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image strip */}
      <div className="relative flex items-center justify-center shrink-0"
        style={{ height: 140, background: "linear-gradient(160deg, hsl(34 17% 10%) 0%, hsl(34 12% 6%) 100%)" }}>
        {frag.image_url ? (
          <img src={frag.image_url} alt={frag.name} className="h-full w-full object-contain"
            style={{ padding: "8px 32px" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <BottlePlaceholder size={44} />
        )}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent 55%, hsl(34 17% 8% / 0.88) 100%)" }} />
        {score !== undefined && (
          <span className="absolute top-2 left-2 text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: "hsl(34 12% 8% / 0.85)", color: "hsl(42 54% 55%)", backdropFilter: "blur(4px)" }}>
            {score}%
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-xs font-mono tracking-wide" style={{ color: "hsl(40 10% 38%)" }}>{frag.house}</p>
          <p className="font-serif text-sm leading-tight mt-0.5" style={{ color: "hsl(40 20% 90%)" }}>{frag.name}</p>
          <span className="text-xs font-mono" style={{ color: "hsl(42 54% 55%)" }}>${frag.price_usd}</span>
        </div>

        {frag.match_reason && (
          <p className="text-xs italic leading-snug" style={{ color: "hsl(40 10% 40%)" }}>
            {frag.match_reason}
          </p>
        )}

        <div className="flex flex-wrap gap-1 mt-auto">
          {frag.accords.slice(0, 3).map((accord) => {
            const color = ACCORD_COLORS[accord] ?? "#7a7a7a";
            return (
              <span key={accord} className="text-xs px-1.5 py-0.5 rounded capitalize"
                style={{ background: `${color}15`, color }}>
                {accord}
              </span>
            );
          })}
        </div>

        <button
          onClick={() => onAdd(frag)}
          disabled={added}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-mono tracking-wide transition-all mt-1"
          style={{
            background: added ? "hsl(42 54% 50% / 0.08)" : "hsl(42 54% 50% / 0.12)",
            color: added ? "hsl(42 54% 40%)" : "hsl(42 54% 60%)",
            border: `1px solid ${added ? "hsl(42 54% 30% / 0.4)" : "hsl(42 54% 40% / 0.3)"}`,
            cursor: added ? "default" : "pointer",
          }}
        >
          <BookmarkPlus size={12} />
          {added ? "Wishlisted" : "Add to wishlist"}
        </button>
      </div>
    </div>
  );
}

// ─── Suggestions panel (empty state) ─────────────────────────────────────────
function WishlistSuggestions({ onAdd, wishlisted }: {
  onAdd: (f: Fragrance) => void;
  wishlisted: (id: string) => boolean;
}) {
  const { data: profile } = useGetProfile({ query: { queryKey: ["profile"] } });
  const [suggestions, setSuggestions] = useState<(Fragrance & { match_score?: number; match_reason?: string; similarity_pct?: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("Suggestions for you");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchSuggestions() {
      const owned: string[] = profile?.ownedFragrances ?? [];
      const budget: string | null = (profile as { budget?: string | null } | undefined)?.budget ?? null;

      try {
        if (owned.length > 0) {
          // Use the user's first owned fragrance to find similar ones
          const pivot = owned[0]!;
          setLabel(`Because you own ${pivot.split(" ").slice(-1)[0]}`);

          const res = await fetch(`${BASE}/api/similar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fragranceName: pivot }),
          });

          if (res.ok) {
            const data = await res.json() as (Fragrance & { similarity_pct: number })[];
            // Filter out owned fragrances, take top 6
            const filtered = data
              .filter((f) => !owned.some((o) => o.toLowerCase().includes(f.name.toLowerCase())))
              .slice(0, 6);
            if (!cancelled) setSuggestions(filtered);
            return;
          }
        }

        // Fallback: semantic search based on budget vibe
        const vibe = BUDGET_VIBES[budget ?? "50_150"] ?? BUDGET_VIBES["50_150"]!;
        if (budget) setLabel("Matched to your budget");
        else setLabel("Popular right now");

        const res = await fetch(`${BASE}/api/semantic-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: vibe }),
        });

        if (res.ok) {
          const data = await res.json() as { results: (Fragrance & { match_score: number; match_reason: string })[] };
          if (!cancelled) setSuggestions(data.results.slice(0, 6));
        }
      } catch { /* leave empty */ } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSuggestions();
    return () => { cancelled = true; };
  }, [profile]);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Empty hero */}
        <div className="flex flex-col items-center text-center py-10 mb-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: "hsl(34 12% 11%)", border: "1px solid hsl(34 10% 18%)" }}
          >
            <Bookmark size={22} style={{ color: "hsl(40 10% 40%)" }} />
          </div>
          <h2 className="font-serif text-2xl mb-2" style={{ color: "hsl(40 15% 55%)" }}>
            Your wishlist is empty
          </h2>
          <p className="text-sm max-w-xs" style={{ color: "hsl(40 10% 35%)" }}>
            Search any fragrance and tap the bookmark icon to save it for later.
          </p>
        </div>

        {/* Suggestions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={13} style={{ color: "hsl(42 54% 50%)" }} />
            <p className="text-xs font-mono tracking-widest" style={{ color: "hsl(40 10% 40%)" }}>
              {label.toUpperCase()}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 size={16} className="animate-spin" style={{ color: "hsl(42 54% 45%)" }} />
              <span className="text-sm" style={{ color: "hsl(40 10% 38%)" }}>Finding fragrances for you…</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {suggestions.map((frag) => (
                <SuggestionCard
                  key={frag.id}
                  frag={frag}
                  onAdd={onAdd}
                  added={wishlisted(frag.id)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── WishlistPage ─────────────────────────────────────────────────────────────
export function WishlistPage({ onOpenDrawer }: { onOpenDrawer?: (f: Fragrance) => void }) {
  const { items, add, remove, isWishlisted, updateNote } = useWishlist();

  if (items.length === 0) {
    return <WishlistSuggestions onAdd={add} wishlisted={isWishlisted} />;
  }

  const totalValue = items.reduce((s, i) => s + i.price_usd, 0);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-serif text-2xl" style={{ color: "hsl(40 20% 85%)" }}>Wishlist</h2>
          <span className="text-sm font-mono" style={{ color: "hsl(40 10% 40%)" }}>
            {items.length} {items.length === 1 ? "fragrance" : "fragrances"} · ${totalValue.toLocaleString()} total
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              onRemove={remove}
              onNoteUpdate={updateNote}
              onOpenDrawer={onOpenDrawer}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
