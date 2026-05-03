import { useState } from "react";
import { Trash2, StickyNote, Bookmark } from "lucide-react";
import { useWishlist } from "@/hooks/use-wishlist";
import { ACCORD_COLORS } from "@/types";
import type { Fragrance } from "@/types";
import { BottlePlaceholder } from "@/components/bottle-placeholder";

function WishlistCard({ item, onRemove, onNoteUpdate, onOpenDrawer }: {
  item: ReturnType<typeof useWishlist>["items"][number];
  onRemove: (id: string) => void;
  onNoteUpdate: (id: string, note: string) => void;
  onOpenDrawer?: (f: ReturnType<typeof useWishlist>["items"][number]) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(item.personalNote);

  const saveNote = () => {
    onNoteUpdate(item.id, noteText);
    setEditingNote(false);
  };

  const [hovered, setHovered] = useState(false);

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
      {/* Product image strip */}
      <div
        className="w-full rounded overflow-hidden flex items-center justify-center relative -mx-4"
        style={{
          width: "calc(100% + 2rem)",
          height: 180,
          background: "linear-gradient(160deg, hsl(34 17% 10%) 0%, hsl(34 12% 6%) 100%)",
        }}
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="h-full w-full object-contain"
            style={{ padding: "8px 40px" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <BottlePlaceholder size={60} />
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent 55%, hsl(34 17% 8% / 0.92) 100%)" }}
        />
        {/* Remove button floated over image */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          className="absolute top-2 right-2 p-1.5 rounded-full transition-colors"
          style={{ background: "hsl(30 14% 4% / 0.65)", color: "hsl(40 10% 45%)", backdropFilter: "blur(4px)" }}
          title="Remove from wishlist"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Identity */}
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
              <span
                key={accord}
                className="text-xs px-1.5 py-0.5 rounded capitalize"
                style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
              >
                {accord}
              </span>
            );
          })}
        </div>
      </div>

      {/* Personal note */}
      {editingNote ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            className="w-full text-xs rounded px-2.5 py-2 resize-none outline-none"
            style={{
              background: "hsl(34 12% 11%)",
              border: "1px solid hsl(42 54% 35%)",
              color: "hsl(40 15% 72%)",
              minHeight: 60,
            }}
            placeholder="Add a note — batch, where to try it, thoughts..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setNoteText(item.personalNote); setEditingNote(false); }}
              className="text-xs px-2.5 py-1 rounded"
              style={{ color: "hsl(40 10% 40%)" }}
            >
              Cancel
            </button>
            <button
              onClick={saveNote}
              className="text-xs px-3 py-1 rounded"
              style={{ background: "hsl(42 54% 50% / 0.15)", color: "hsl(42 54% 65%)" }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setEditingNote(true); }}
          className="flex items-center gap-1.5 text-xs text-left rounded px-2 py-1 transition-colors"
          style={{
            color: item.personalNote ? "hsl(40 15% 55%)" : "hsl(40 10% 32%)",
            background: item.personalNote ? "hsl(34 12% 10%)" : "transparent",
          }}
        >
          <StickyNote size={11} />
          <span className="truncate">{item.personalNote || "Add a personal note..."}</span>
        </button>
      )}

      {/* Added date */}
      <p className="text-xs" style={{ color: "hsl(40 10% 28%)" }}>
        Added {new Date(item.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}

export function WishlistPage({ onOpenDrawer }: { onOpenDrawer?: (f: Fragrance) => void }) {
  const { items, remove, updateNote } = useWishlist();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
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
    );
  }

  const totalValue = items.reduce((s, i) => s + i.price_usd, 0);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-serif text-2xl" style={{ color: "hsl(40 20% 85%)" }}>
            Wishlist
          </h2>
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
