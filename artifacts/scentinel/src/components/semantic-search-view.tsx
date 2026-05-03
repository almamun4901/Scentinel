import { useState } from "react";
import { Sparkles, Search, Loader2, ShoppingBag } from "lucide-react";
import { ACCORD_COLORS } from "@/types";
import { BottlePlaceholder } from "@/components/bottle-placeholder";
import type { Fragrance } from "@/types";

interface SemanticResult extends Fragrance {
  match_score: number;
  match_reason: string;
}

interface SemanticResponse {
  interpretation: string;
  accords: string[];
  results: SemanticResult[];
}

const EXAMPLE_QUERIES = [
  "Warm and cozy for winter evenings, like smoky oud and dark amber",
  "Fresh green office scent, not too loud, citrusy with a woody dry-down",
  "Something romantic and floral for a summer date night",
  "Aquatic and energetic, sport-inspired but sophisticated",
  "Intense and mysterious like a Middle Eastern bazaar",
];

interface SemanticSearchViewProps {
  onSelectFragrance?: (f: Fragrance) => void;
  onOpenDrawer?: (f: Fragrance) => void;
}

export function SemanticSearchView({ onSelectFragrance, onOpenDrawer }: SemanticSearchViewProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SemanticResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim() }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json() as SemanticResponse;
      setResult(data);
    } catch {
      setError("Something went wrong. Try a different description.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  const handleExample = (q: string) => {
    setQuery(q);
    search(q);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} style={{ color: "hsl(42 54% 50%)" }} />
            <h2 className="font-serif text-2xl" style={{ color: "hsl(40 20% 85%)" }}>Discover</h2>
          </div>
          <p className="text-sm" style={{ color: "hsl(40 10% 38%)" }}>
            Describe a mood, occasion, or vibe in natural language — find fragrances that match.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="mb-5">
          <div
            className="flex gap-2 rounded border px-3 py-2.5"
            style={{ background: "hsl(34 12% 9%)", borderColor: "hsl(34 10% 18%)" }}
          >
            <Sparkles size={15} className="shrink-0 mt-0.5" style={{ color: "hsl(42 54% 45%)" }} />
            <textarea
              className="flex-1 bg-transparent outline-none resize-none text-sm leading-snug"
              style={{ color: "hsl(40 15% 80%)", minHeight: 48, maxHeight: 120 }}
              placeholder="e.g. Warm smoky leather for cold evenings, something daring and luxurious..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); search(query); }
              }}
              rows={2}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="shrink-0 p-1.5 rounded transition-opacity disabled:opacity-40"
              style={{ color: "hsl(42 54% 55%)" }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </div>
        </form>

        {/* Example queries */}
        {!result && !loading && (
          <div className="mb-6">
            <p className="text-xs font-mono tracking-widest mb-3" style={{ color: "hsl(40 10% 32%)" }}>
              TRY THESE
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleExample(q)}
                  className="text-left text-sm px-3 py-2.5 rounded border transition-all"
                  style={{
                    background: "hsl(34 12% 8%)",
                    borderColor: "hsl(34 10% 16%)",
                    color: "hsl(40 10% 45%)",
                  }}
                >
                  <span style={{ color: "hsl(42 54% 40%)" }}>✦ </span>{q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className="relative">
              <Sparkles size={24} style={{ color: "hsl(42 54% 45%)" }} className="animate-pulse" />
            </div>
            <p className="text-sm" style={{ color: "hsl(40 10% 38%)" }}>
              Interpreting your vibe...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm py-4" style={{ color: "hsl(0 60% 55%)" }}>{error}</p>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Interpretation */}
            <div
              className="rounded border px-4 py-3 mb-5 flex gap-3 items-start"
              style={{ background: "hsl(42 54% 50% / 0.06)", borderColor: "hsl(42 54% 50% / 0.2)" }}
            >
              <Sparkles size={14} className="shrink-0 mt-0.5" style={{ color: "hsl(42 54% 55%)" }} />
              <p className="text-sm italic leading-relaxed" style={{ color: "hsl(40 15% 68%)" }}>
                {result.interpretation}
              </p>
            </div>

            {/* Extracted accord profile */}
            {result.accords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {result.accords.map((accord) => {
                  const color = ACCORD_COLORS[accord] ?? "#7a7a7a";
                  return (
                    <span
                      key={accord}
                      className="text-xs px-2.5 py-1 rounded-full capitalize font-medium"
                      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
                    >
                      {accord}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Result count */}
            <p className="text-xs font-mono tracking-widest mb-4" style={{ color: "hsl(40 10% 32%)" }}>
              {result.results.length} MATCHES FOUND
            </p>

            {/* Result cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {result.results.map((frag, i) => (
                <SemanticResultCard
                  key={frag.id}
                  frag={frag}
                  rank={i}
                  onSelect={onOpenDrawer ?? onSelectFragrance}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SemanticResultCard({
  frag,
  rank,
  onSelect,
}: {
  frag: SemanticResult;
  rank: number;
  onSelect?: (f: Fragrance) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isTop = rank === 0;
  const scoreColor =
    frag.match_score >= 80 ? "hsl(142 50% 50%)" :
    frag.match_score >= 60 ? "hsl(42 54% 55%)" :
    "hsl(40 10% 48%)";

  return (
    <button
      className="rounded border p-4 flex flex-col gap-3 text-left relative overflow-hidden"
      style={{
        background: hovered ? "hsl(34 17% 11%)" : "hsl(34 17% 8%)",
        borderColor: hovered
          ? "hsl(42 54% 40%)"
          : isTop ? "hsl(42 54% 35%)" : "hsl(34 10% 14%)",
        borderTopWidth: isTop ? "2px" : "1px",
        transform: hovered ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
        boxShadow: hovered
          ? "0 8px 32px hsl(42 54% 30% / 0.18), 0 0 0 1px hsl(42 54% 40% / 0.15)"
          : "none",
        transition: "background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect?.(frag)}
      title="View fragrance details"
    >
      {isTop && (
        <span
          className="absolute top-0 right-3 text-xs font-mono tracking-widest px-2 py-0.5 rounded-b"
          style={{ background: "hsl(42 54% 50%)", color: "hsl(30 14% 5%)" }}
        >
          BEST MATCH
        </span>
      )}

      {/* Product image — full-width strip */}
      <div
        className="w-full rounded overflow-hidden flex items-center justify-center -mx-4 relative"
        style={{
          width: "calc(100% + 2rem)",
          height: 160,
          background: "linear-gradient(160deg, hsl(34 17% 10%) 0%, hsl(34 12% 6%) 100%)",
          marginTop: isTop ? "1rem" : 0,
        }}
      >
        {frag.image_url ? (
          <img
            src={frag.image_url}
            alt={frag.name}
            className="h-full w-full object-contain"
            style={{ padding: "8px 32px" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <BottlePlaceholder size={52} />
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent 60%, hsl(34 17% 8% / 0.9) 100%)" }}
        />
      </div>

      {/* Identity */}
      <div className="flex items-start justify-between gap-2 mt-1">
        <div className="min-w-0">
          <p className="text-xs font-mono tracking-wide" style={{ color: "hsl(40 10% 38%)" }}>{frag.house}</p>
          <p className="font-serif text-base leading-tight mt-0.5" style={{ color: "hsl(40 20% 92%)" }}>
            {frag.name}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-xs font-mono font-semibold block" style={{ color: scoreColor }}>
            {frag.match_score}%
          </span>
          <span className="text-xs font-mono" style={{ color: "hsl(42 54% 55%)" }}>
            ${frag.price_usd}
          </span>
        </div>
      </div>

      <p className="text-xs italic leading-snug" style={{ color: "hsl(40 10% 42%)" }}>
        {frag.match_reason}
      </p>

      <div className="flex flex-wrap gap-1">
        {frag.accords.slice(0, 4).map((accord) => {
          const color = ACCORD_COLORS[accord] ?? "#7a7a7a";
          return (
            <span
              key={accord}
              className="text-xs px-1.5 py-0.5 rounded capitalize"
              style={{ background: `${color}18`, color }}
            >
              {accord}
            </span>
          );
        })}
      </div>
    </button>
  );
}
