import { useState, useCallback, useEffect } from "react";
import { Search, Loader2, Waves } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCORD_COLORS, LONGEVITY_LABELS, SILLAGE_LABELS } from "@/types";
import type { Fragrance, SimilarResult } from "@/types";

interface SimilarPageProps {
  onSelectFragrance?: (f: Fragrance) => void;
}

function SimilarityBar({ pct, animate }: { pct: number; animate: boolean }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (animate) {
      const t = setTimeout(() => setWidth(pct), 100);
      return () => clearTimeout(t);
    }
    setWidth(pct);
  }, [pct, animate]);

  return (
    <div className="relative h-1 rounded-full overflow-hidden" style={{ background: "hsl(34 10% 16%)" }}>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all"
        style={{
          width: `${width}%`,
          transitionDuration: "800ms",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          background: "linear-gradient(to right, hsl(200 60% 35%), hsl(200 70% 55%))",
        }}
      />
    </div>
  );
}

function SimilarCard({
  result,
  index,
  animate,
  onSelect,
}: {
  result: SimilarResult;
  index: number;
  animate: boolean;
  onSelect?: (name: string, house: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const isTopPick = index === 0;
  const clickable = !!onSelect;

  const handleClick = async () => {
    if (!onSelect || loading) return;
    setLoading(true);
    try {
      await onSelect(result.name, result.house);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="rounded border p-4 flex flex-col gap-3 relative overflow-hidden transition-all"
      style={{
        background: "hsl(34 17% 8%)",
        borderColor: isTopPick ? "hsl(200 50% 30%)" : "hsl(34 10% 14%)",
        borderTopWidth: isTopPick ? "2px" : "1px",
        cursor: clickable ? "pointer" : "default",
      }}
      onMouseEnter={(e) => {
        if (clickable) (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(200 50% 38%)";
      }}
      onMouseLeave={(e) => {
        if (clickable)
          (e.currentTarget as HTMLDivElement).style.borderColor = isTopPick
            ? "hsl(200 50% 30%)"
            : "hsl(34 10% 14%)";
      }}
    >
      {isTopPick && (
        <span
          className="absolute top-0 right-3 text-xs font-mono tracking-widest px-2 py-0.5 rounded-b"
          style={{ background: "hsl(200 60% 42%)", color: "hsl(30 14% 96%)" }}
        >
          CLOSEST
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs" style={{ color: "hsl(40 10% 45%)" }}>{result.house}</p>
          <p className="font-serif text-lg leading-tight mt-0.5" style={{ color: "hsl(40 20% 88%)" }}>
            {result.name}
          </p>
          <p className="text-xs mt-0.5 font-mono" style={{ color: "hsl(40 10% 38%)" }}>
            {result.concentration} · ${result.price_usd}
          </p>
        </div>
        {loading && <Loader2 size={14} className="animate-spin shrink-0 mt-1" style={{ color: "hsl(200 60% 50%)" }} />}
        {clickable && !loading && (
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="shrink-0 mt-1 opacity-40" style={{ color: "hsl(200 60% 50%)" }}
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: "hsl(40 10% 45%)" }}>Scent match</span>
          <span className="text-sm font-mono" style={{ color: "hsl(200 60% 60%)" }}>
            {result.similarity_pct}%
          </span>
        </div>
        <SimilarityBar pct={result.similarity_pct} animate={animate} />
      </div>

      {/* Shared DNA */}
      {result.shared_accords.length > 0 && (
        <div>
          <p className="text-xs mb-1.5" style={{ color: "hsl(40 10% 35%)" }}>Shared DNA</p>
          <div className="flex flex-wrap gap-1.5">
            {result.shared_accords.map((accord) => {
              const color = ACCORD_COLORS[accord] ?? "#7a7a7a";
              return (
                <span
                  key={accord}
                  className="text-xs px-1.5 py-0.5 rounded capitalize font-medium"
                  style={{ background: `${color}25`, color, border: `1px solid ${color}40` }}
                >
                  {accord}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-3 pt-1 border-t" style={{ borderColor: "hsl(34 10% 13%)" }}>
        <div className="text-xs" style={{ color: "hsl(40 10% 38%)" }}>
          <span style={{ color: "hsl(40 10% 50%)" }}>Longevity</span>{" "}
          {LONGEVITY_LABELS[result.longevity] ?? result.longevity}
        </div>
        <div className="text-xs" style={{ color: "hsl(40 10% 38%)" }}>
          <span style={{ color: "hsl(40 10% 50%)" }}>Sillage</span>{" "}
          {SILLAGE_LABELS[result.sillage] ?? result.sillage}
        </div>
      </div>
    </div>
  );
}

export function SimilarPage({ onSelectFragrance }: SimilarPageProps) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [searchResults, setSearchResults] = useState<Fragrance[]>([]);
  const [selected, setSelected] = useState<Fragrance | null>(null);
  const [results, setResults] = useState<SimilarResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [animated, setAnimated] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    setSelected(null);
    setResults(null);
    setSearched(q.trim());
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/search?q=${encodeURIComponent(q.trim())}`);
      const data = (await res.json()) as Fragrance[];
      setSearchResults(data.slice(0, 8));
    } catch { /* ignore */ } finally {
      setSearchLoading(false);
    }
  }, []);

  const handlePickFragrance = useCallback(async (f: Fragrance) => {
    setSelected(f);
    setSearchResults([]);
    setResults(null);
    setAnimated(false);
    setSimilarLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/similar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fragranceName: f.name }),
      });
      const data = (await res.json()) as SimilarResult[];
      setResults(data);
      setTimeout(() => setAnimated(true), 50);
    } catch { /* ignore */ } finally {
      setSimilarLoading(false);
    }
  }, []);

  const handleCardSelect = useCallback(async (name: string, _house: string) => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/search?q=${encodeURIComponent(name)}`);
      const data = (await res.json()) as Fragrance[];
      if (data.length > 0 && onSelectFragrance) onSelectFragrance(data[0]);
    } catch { /* ignore */ }
  }, [onSelectFragrance]);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Waves size={16} style={{ color: "hsl(200 60% 50%)" }} />
            <h2 className="font-serif text-2xl" style={{ color: "hsl(40 20% 85%)" }}>Similar Fragrances</h2>
          </div>
          <p className="text-sm" style={{ color: "hsl(40 10% 38%)" }}>
            Find fragrances that share the same scent DNA — ranked purely by accord similarity, no price bias.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(query); }} className="mb-5">
          <div
            className="flex gap-2 rounded border px-3 py-2.5"
            style={{ background: "hsl(34 12% 9%)", borderColor: "hsl(34 10% 18%)" }}
          >
            <Search size={15} className="shrink-0 mt-0.5" style={{ color: "hsl(40 10% 38%)" }} />
            <input
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "hsl(40 15% 80%)" }}
              placeholder="e.g. Creed Aventus, Tom Ford Oud Wood, Baccarat Rouge 540..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={searchLoading || !query.trim()}
              className="shrink-0 p-1.5 rounded transition-opacity disabled:opacity-40"
              style={{ color: "hsl(200 60% 55%)" }}
            >
              {searchLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            </button>
          </div>
        </form>

        {/* Search results picker */}
        {searchResults.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-mono tracking-widest mb-2" style={{ color: "hsl(40 10% 30%)" }}>
              SELECT FRAGRANCE
            </p>
            <div className="flex flex-col gap-1.5">
              {searchResults.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handlePickFragrance(f)}
                  className="flex items-center gap-3 px-4 py-3 rounded border text-left transition-all"
                  style={{ background: "hsl(34 12% 9%)", borderColor: "hsl(34 10% 16%)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(200 50% 30%)";
                    (e.currentTarget as HTMLButtonElement).style.background = "hsl(34 17% 11%)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(34 10% 16%)";
                    (e.currentTarget as HTMLButtonElement).style.background = "hsl(34 12% 9%)";
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-mono" style={{ color: "hsl(40 10% 40%)" }}>{f.house}</span>
                    <p className="font-serif text-base" style={{ color: "hsl(40 20% 88%)" }}>{f.name}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {f.accords.slice(0, 3).map((a) => {
                      const color = ACCORD_COLORS[a] ?? "#7a7a7a";
                      return (
                        <span key={a} className="text-xs px-1.5 py-0.5 rounded capitalize" style={{ background: `${color}18`, color }}>
                          {a}
                        </span>
                      );
                    })}
                  </div>
                  <span className="text-xs font-mono shrink-0" style={{ color: "hsl(200 60% 55%)" }}>
                    ${f.price_usd}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {searched && !searchLoading && searchResults.length === 0 && !selected && (
          <p className="text-sm mb-6" style={{ color: "hsl(40 10% 38%)" }}>
            No fragrance found for "{searched}". Try a different name or house.
          </p>
        )}

        {/* Selected + results */}
        {selected && (
          <>
            <div
              className="flex items-center gap-3 px-4 py-3 rounded border mb-5"
              style={{ background: "hsl(200 60% 42% / 0.07)", borderColor: "hsl(200 50% 30% / 0.4)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono tracking-widest mb-0.5" style={{ color: "hsl(40 10% 38%)" }}>
                  FINDING SIMILAR TO
                </p>
                <p className="font-serif text-lg" style={{ color: "hsl(40 20% 90%)" }}>
                  {selected.house} {selected.name}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selected.accords.map((a) => {
                    const color = ACCORD_COLORS[a] ?? "#7a7a7a";
                    return (
                      <span key={a} className="text-xs px-1.5 py-0.5 rounded capitalize" style={{ background: `${color}18`, color }}>
                        {a}
                      </span>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => { setSelected(null); setResults(null); setQuery(""); }}
                className="text-xs px-2 py-1 rounded border transition-colors shrink-0"
                style={{ borderColor: "hsl(34 10% 22%)", color: "hsl(40 10% 48%)" }}
              >
                Change
              </button>
            </div>

            {/* Results grid */}
            {similarLoading ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-serif text-xl" style={{ color: "hsl(40 20% 85%)" }}>Scent Matches</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-52 rounded" style={{ background: "hsl(34 17% 10%)" }} />
                  ))}
                </div>
              </div>
            ) : results && results.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-serif text-xl" style={{ color: "hsl(40 20% 85%)" }}>Scent Matches</h3>
                  {onSelectFragrance && (
                    <span className="text-xs" style={{ color: "hsl(40 10% 32%)" }}>Click to explore</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.map((r, i) => (
                    <SimilarCard
                      key={r.id}
                      result={r}
                      index={i}
                      animate={animated}
                      onSelect={onSelectFragrance ? handleCardSelect : undefined}
                    />
                  ))}
                </div>
              </div>
            ) : results && results.length === 0 ? (
              <p className="text-sm" style={{ color: "hsl(40 10% 38%)" }}>
                No similar fragrances found with enough accord overlap.
              </p>
            ) : null}
          </>
        )}

        {/* Empty state */}
        {!searched && !selected && (
          <div className="flex flex-col gap-2 mt-2">
            <p className="text-xs font-mono tracking-widest mb-1" style={{ color: "hsl(40 10% 28%)" }}>
              POPULAR SEARCHES
            </p>
            {["Baccarat Rouge 540", "Tom Ford Oud Wood", "Creed Aventus", "Dior Sauvage EDP", "Jo Malone Peony & Blush Suede"].map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); handleSearch(s); }}
                className="text-left text-sm px-3 py-2.5 rounded border transition-all"
                style={{ background: "hsl(34 12% 8%)", borderColor: "hsl(34 10% 15%)", color: "hsl(40 10% 45%)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(200 50% 22%)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(34 10% 15%)"; }}
              >
                <span style={{ color: "hsl(200 60% 42%)" }}>◎ </span>{s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
