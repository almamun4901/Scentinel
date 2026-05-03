import { Bookmark, BookmarkCheck } from "lucide-react";
import { Fragrance, ACCORD_COLORS, LONGEVITY_LABELS, SILLAGE_LABELS } from "@/types";
import { BottlePlaceholder } from "@/components/bottle-placeholder";

interface FragranceHeroProps {
  fragrance: Fragrance;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
}

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

function PyramidSection({
  label,
  items,
  widthPct,
  accentColor,
  showConnector,
}: {
  label: string;
  items: string[];
  widthPct: number;
  accentColor: string;
  showConnector: boolean;
}) {
  return (
    <div className="flex flex-col items-center w-full">
      <div
        className="w-full rounded px-4 py-3"
        style={{
          maxWidth: `${widthPct}%`,
          background: `${accentColor}0d`,
          border: `1px solid ${accentColor}28`,
        }}
      >
        <p
          className="text-xs font-mono tracking-widest text-center mb-2"
          style={{ color: accentColor }}
        >
          {label}
        </p>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
          {items.map((note) => (
            <span
              key={note}
              className="text-xs capitalize flex items-center gap-1"
              style={{ color: "hsl(40 15% 72%)" }}
            >
              <span style={{ fontSize: 9, opacity: 0.7 }}>{getNoteIcon(note)}</span>
              {note}
            </span>
          ))}
        </div>
      </div>
      {showConnector && (
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "12px solid transparent",
            borderRight: "12px solid transparent",
            borderTop: `7px solid ${accentColor}20`,
            margin: "1px 0",
          }}
        />
      )}
    </div>
  );
}

function NotePyramid({ notes }: { notes: Fragrance["notes"] }) {
  return (
    <div className="flex flex-col items-center gap-0 mt-2">
      {/* Apex */}
      <div
        style={{
          width: 0, height: 0,
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderBottom: "7px solid hsl(42 54% 50% / 0.25)",
          marginBottom: 1,
        }}
      />
      <PyramidSection label="TOP" items={notes.top} widthPct={52} accentColor="hsl(42,54%,50%)" showConnector={true} />
      <PyramidSection label="HEART" items={notes.heart} widthPct={76} accentColor="hsl(35,55%,52%)" showConnector={true} />
      <PyramidSection label="BASE" items={notes.base} widthPct={100} accentColor="hsl(28,45%,44%)" showConnector={false} />
    </div>
  );
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
      <span className="text-xs font-mono w-4" style={{ color: "hsl(40 10% 42%)" }}>
        {value}/5
      </span>
    </div>
  );
}

export function FragranceHero({ fragrance, isWishlisted, onToggleWishlist }: FragranceHeroProps) {
  return (
    <div
      data-testid="fragrance-hero"
      className="rounded border mb-6 overflow-hidden"
      style={{ background: "hsl(34 17% 8%)", borderColor: "hsl(34 10% 14%)" }}
    >
      {/* Top band: image + identity */}
      <div
        className="flex gap-4 p-5 pb-4"
        style={{ borderBottom: "1px solid hsl(34 10% 12%)" }}
      >
        {/* Bottle image */}
        <div
          className="shrink-0 rounded overflow-hidden flex items-center justify-center relative"
          style={{
            width: 96,
            height: 128,
            background: "linear-gradient(135deg, hsl(34 17% 10%), hsl(34 12% 7%))",
            border: "1px solid hsl(34 10% 18%)",
          }}
        >
          {fragrance.image_url ? (
            <img
              src={fragrance.image_url}
              alt={`${fragrance.house} ${fragrance.name}`}
              className="w-full h-full object-contain"
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = "none";
                const parent = el.parentElement;
                if (parent) {
                  const placeholder = document.createElement("div");
                  placeholder.className = "absolute inset-0 flex items-center justify-center";
                  parent.appendChild(placeholder);
                }
              }}
            />
          ) : (
            <BottlePlaceholder size={64} />
          )}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-mono tracking-widest uppercase mb-1" style={{ color: "hsl(40 10% 42%)" }}>
                {fragrance.house}
              </p>
              <h1
                className="font-serif leading-tight mb-3"
                style={{ fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "hsl(40 20% 92%)" }}
                data-testid="fragrance-name"
              >
                {fragrance.name}
              </h1>
            </div>

            {/* Wishlist toggle */}
            {onToggleWishlist && (
              <button
                onClick={onToggleWishlist}
                className="shrink-0 p-2 rounded transition-all"
                style={{ color: isWishlisted ? "hsl(42 54% 55%)" : "hsl(40 10% 38%)" }}
                title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                {isWishlisted
                  ? <BookmarkCheck size={18} />
                  : <Bookmark size={18} />
                }
              </button>
            )}
          </div>

          {/* Meta pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              fragrance.concentration,
              String(fragrance.year),
            ].map((label) => (
              <span
                key={label}
                className="text-xs px-2.5 py-1 rounded-full border font-mono"
                style={{ borderColor: "hsl(34 10% 22%)", color: "hsl(40 10% 52%)", background: "hsl(34 12% 11%)" }}
              >
                {label}
              </span>
            ))}
            <span
              className="text-xs px-2.5 py-1 rounded-full font-mono font-semibold"
              style={{ background: "hsl(42 54% 50% / 0.13)", color: "hsl(42 54% 68%)" }}
            >
              ${fragrance.price_usd}
            </span>
          </div>

          {/* Longevity & Sillage inline */}
          <div className="mt-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono w-20 shrink-0" style={{ color: "hsl(40 10% 38%)" }}>
                {LONGEVITY_LABELS[fragrance.longevity]} longevity
              </span>
              <PerformanceBar value={fragrance.longevity} color="hsl(42 54% 50%)" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono w-20 shrink-0" style={{ color: "hsl(40 10% 38%)" }}>
                {SILLAGE_LABELS[fragrance.sillage]} sillage
              </span>
              <PerformanceBar value={fragrance.sillage} color="hsl(28 50% 48%)" />
            </div>
          </div>
        </div>
      </div>

      {/* Accord pills */}
      <div className="flex flex-wrap gap-1.5 px-5 py-3" style={{ borderBottom: "1px solid hsl(34 10% 12%)" }}>
        {fragrance.accords.map((accord) => {
          const color = ACCORD_COLORS[accord] ?? "#7a7a7a";
          return (
            <span
              key={accord}
              data-testid={`accord-chip-${accord}`}
              className="text-xs px-2.5 py-1 rounded-full capitalize font-medium"
              style={{ background: `${color}1e`, color, border: `1px solid ${color}40` }}
            >
              {accord}
            </span>
          );
        })}
      </div>

      {/* Notes pyramid */}
      <div className="px-5 py-4">
        <p className="text-xs font-mono tracking-widest mb-3" style={{ color: "hsl(40 10% 36%)" }}>
          FRAGRANCE PYRAMID
        </p>
        <NotePyramid notes={fragrance.notes} />
      </div>
    </div>
  );
}
