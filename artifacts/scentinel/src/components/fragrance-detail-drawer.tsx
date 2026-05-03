import { useState, useEffect, useCallback } from "react";
import { X, Bookmark, BookmarkCheck, ArrowRight, Loader2, Users } from "lucide-react";
import { Fragrance, ACCORD_COLORS, LONGEVITY_LABELS, SILLAGE_LABELS } from "@/types";
import { BottlePlaceholder } from "@/components/bottle-placeholder";

const NOTE_ICONS: Record<string, string> = {
  bergamot: "🍋", lemon: "🍋", lime: "🍋", grapefruit: "🍊", mandarin: "🍊", orange: "🍊",
  rose: "🌹", jasmine: "🌸", iris: "🌸", lavender: "💜", violet: "🌸", ylang: "🌸", peony: "🌸",
  sandalwood: "🪵", cedar: "🌲", vetiver: "🌿", patchouli: "🍂", oakmoss: "🌿",
  musk: "○", amber: "◆", vanilla: "✦", benzoin: "✦",
  oud: "🪵", leather: "▲", tobacco: "◈", incense: "〜",
  pepper: "●", cardamom: "●", ginger: "●", cinnamon: "●",
  apple: "🍎", peach: "🍑", plum: "🫐", pear: "🍐",
};

function getNoteIcon(note: string): string {
  const lower = note.toLowerCase();
  for (const [k, v] of Object.entries(NOTE_ICONS)) {
    if (lower.includes(k)) return v;
  }
  return "·";
}

function PerformanceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5 flex-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full"
            style={{ background: i <= value ? color : "hsl(34 10% 18%)" }}
          />
        ))}
      </div>
      <span className="text-xs font-mono w-6 shrink-0" style={{ color: "hsl(40 10% 42%)" }}>
        {value}/5
      </span>
    </div>
  );
}

function PyramidRow({
  label,
  notes,
  maxWidthPct,
  color,
}: {
  label: string;
  notes: string[];
  maxWidthPct: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center w-full mb-1">
      <div
        className="w-full rounded px-3 py-2.5"
        style={{
          maxWidth: `${maxWidthPct}%`,
          background: `${color}0d`,
          border: `1px solid ${color}28`,
        }}
      >
        <p className="text-xs font-mono tracking-widest text-center mb-2" style={{ color }}>
          {label}
        </p>
        <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
          {notes.map((note) => (
            <span
              key={note}
              className="text-xs capitalize flex items-center gap-1"
              style={{ color: "hsl(40 15% 72%)" }}
            >
              <span style={{ fontSize: 9, opacity: 0.6 }}>{getNoteIcon(note)}</span>
              {note}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface FragranceDetailDrawerProps {
  fragrance: Fragrance | null;
  onClose: () => void;
  onFullAnalysis?: (f: Fragrance) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (f: Fragrance) => void;
}

export function FragranceDetailDrawer({
  fragrance,
  onClose,
  onFullAnalysis,
  isWishlisted,
  onToggleWishlist,
}: FragranceDetailDrawerProps) {
  const [bullets, setBullets] = useState<string[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  const fetchCommunity = useCallback(async (name: string, house: string) => {
    setCommunityLoading(true);
    setBullets([]);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/fragrance/community`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fragranceName: `${house} ${name}` }),
      });
      if (res.ok) {
        const data = await res.json() as { bullets: string[] };
        setBullets(data.bullets ?? []);
      }
    } catch { /* ignore */ } finally {
      setCommunityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fragrance) {
      setVisible(true);
      fetchCommunity(fragrance.name, fragrance.house);
    } else {
      setVisible(false);
    }
  }, [fragrance, fetchCommunity]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const handleFullAnalysis = () => {
    if (fragrance && onFullAnalysis) {
      handleClose();
      setTimeout(() => onFullAnalysis(fragrance), 300);
    }
  };

  if (!fragrance && !visible) return null;

  const f = fragrance;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{
          zIndex: 50,
          background: "hsl(30 14% 2% / 0.7)",
          backdropFilter: "blur(2px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.28s ease",
        }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full flex flex-col overflow-hidden"
        style={{
          zIndex: 51,
          width: "min(480px, 100vw)",
          background: "hsl(32 14% 6%)",
          borderLeft: "1px solid hsl(34 10% 14%)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.32, 0, 0.15, 1)",
          boxShadow: "-24px 0 64px hsl(30 14% 2% / 0.6)",
        }}
      >
        {f && (
          <>
            {/* Header */}
            <div
              className="shrink-0 flex items-start gap-4 px-6 pt-6 pb-5"
              style={{ borderBottom: "1px solid hsl(34 10% 11%)" }}
            >
              {/* Bottle */}
              <div
                className="shrink-0 rounded overflow-hidden flex items-center justify-center"
                style={{
                  width: 72,
                  height: 96,
                  background: "linear-gradient(135deg, hsl(34 17% 10%), hsl(34 12% 7%))",
                  border: "1px solid hsl(34 10% 18%)",
                  minWidth: 72,
                }}
              >
                {f.image_url ? (
                  <img
                    src={f.image_url}
                    alt={`${f.house} ${f.name}`}
                    className="w-full h-full object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <BottlePlaceholder size={48} />
                )}
              </div>

              {/* Identity */}
              <div className="flex-1 min-w-0 pt-1">
                <p
                  className="text-xs font-mono tracking-widest uppercase mb-1"
                  style={{ color: "hsl(40 10% 40%)" }}
                >
                  {f.house}
                </p>
                <h2
                  className="font-serif leading-tight mb-3"
                  style={{ fontSize: "clamp(1.3rem, 4vw, 1.9rem)", color: "hsl(40 20% 92%)" }}
                >
                  {f.name}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {[f.concentration, String(f.year)].map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full border font-mono"
                      style={{ borderColor: "hsl(34 10% 22%)", color: "hsl(40 10% 52%)", background: "hsl(34 12% 11%)" }}
                    >
                      {tag}
                    </span>
                  ))}
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold"
                    style={{ background: "hsl(42 54% 50% / 0.13)", color: "hsl(42 54% 68%)" }}
                  >
                    ${f.price_usd}
                  </span>
                </div>
              </div>

              {/* Close */}
              <button
                onClick={handleClose}
                className="shrink-0 p-1.5 rounded transition-colors"
                style={{ color: "hsl(40 10% 38%)" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Accords */}
              <div className="px-6 py-4" style={{ borderBottom: "1px solid hsl(34 10% 11%)" }}>
                <p className="text-xs font-mono tracking-widest mb-3" style={{ color: "hsl(40 10% 32%)" }}>
                  ACCORDS
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {f.accords.map((accord) => {
                    const color = ACCORD_COLORS[accord] ?? "#7a7a7a";
                    return (
                      <span
                        key={accord}
                        className="text-xs px-2.5 py-1 rounded-full capitalize font-medium"
                        style={{ background: `${color}1e`, color, border: `1px solid ${color}40` }}
                      >
                        {accord}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Performance */}
              <div className="px-6 py-4" style={{ borderBottom: "1px solid hsl(34 10% 11%)" }}>
                <p className="text-xs font-mono tracking-widest mb-3" style={{ color: "hsl(40 10% 32%)" }}>
                  PERFORMANCE
                </p>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs" style={{ color: "hsl(40 10% 48%)" }}>
                        Longevity — {LONGEVITY_LABELS[f.longevity]}
                      </span>
                    </div>
                    <PerformanceBar value={f.longevity} color="hsl(42 54% 50%)" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs" style={{ color: "hsl(40 10% 48%)" }}>
                        Sillage — {SILLAGE_LABELS[f.sillage]}
                      </span>
                    </div>
                    <PerformanceBar value={f.sillage} color="hsl(28 50% 48%)" />
                  </div>
                </div>
              </div>

              {/* Notes pyramid */}
              <div className="px-6 py-4" style={{ borderBottom: "1px solid hsl(34 10% 11%)" }}>
                <p className="text-xs font-mono tracking-widest mb-4" style={{ color: "hsl(40 10% 32%)" }}>
                  FRAGRANCE PYRAMID
                </p>
                <div className="flex flex-col items-center gap-1">
                  <div
                    style={{
                      width: 0, height: 0,
                      borderLeft: "9px solid transparent",
                      borderRight: "9px solid transparent",
                      borderBottom: "6px solid hsl(42 54% 50% / 0.2)",
                      marginBottom: 2,
                    }}
                  />
                  <PyramidRow label="TOP" notes={f.notes.top} maxWidthPct={54} color="hsl(42,54%,50%)" />
                  <PyramidRow label="HEART" notes={f.notes.heart} maxWidthPct={78} color="hsl(35,55%,52%)" />
                  <PyramidRow label="BASE" notes={f.notes.base} maxWidthPct={100} color="hsl(28,45%,44%)" />
                </div>
              </div>

              {/* Community */}
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={12} style={{ color: "hsl(40 10% 32%)" }} />
                  <p className="text-xs font-mono tracking-widest" style={{ color: "hsl(40 10% 32%)" }}>
                    COMMUNITY SAYS
                  </p>
                </div>

                {communityLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 size={13} className="animate-spin" style={{ color: "hsl(42 54% 40%)" }} />
                    <span className="text-xs" style={{ color: "hsl(40 10% 38%)" }}>
                      Gathering community insight…
                    </span>
                  </div>
                ) : bullets.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {bullets.map((b, i) => (
                      <li key={i} className="flex gap-2.5 items-start">
                        <span
                          className="shrink-0 mt-0.5 font-mono text-xs"
                          style={{ color: "hsl(42 54% 45%)" }}
                        >
                          ✦
                        </span>
                        <span className="text-sm leading-relaxed" style={{ color: "hsl(40 12% 62%)" }}>
                          {b}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm" style={{ color: "hsl(40 10% 38%)" }}>
                    No community data available.
                  </p>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div
              className="shrink-0 flex items-center gap-3 px-6 py-4"
              style={{ borderTop: "1px solid hsl(34 10% 11%)", background: "hsl(32 14% 5%)" }}
            >
              <button
                onClick={() => onToggleWishlist?.(f)}
                className="flex items-center gap-2 px-4 py-2.5 rounded border text-sm transition-all"
                style={{
                  borderColor: isWishlisted ? "hsl(42 54% 40%)" : "hsl(34 10% 20%)",
                  color: isWishlisted ? "hsl(42 54% 65%)" : "hsl(40 10% 48%)",
                  background: isWishlisted ? "hsl(42 54% 50% / 0.1)" : "transparent",
                }}
                title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                {isWishlisted ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                <span>{isWishlisted ? "Wishlisted" : "Wishlist"}</span>
              </button>

              <button
                onClick={handleFullAnalysis}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded text-sm font-medium transition-all"
                style={{
                  background: "hsl(42 54% 50% / 0.15)",
                  color: "hsl(42 54% 70%)",
                  border: "1px solid hsl(42 54% 35%)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "hsl(42 54% 50% / 0.25)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "hsl(42 54% 50% / 0.15)";
                }}
              >
                Full Analysis
                <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
