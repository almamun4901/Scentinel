import { useState, useCallback } from "react";
import { Copy, Search, Loader2, ExternalLink } from "lucide-react";
import { useFindDupes } from "@workspace/api-client-react";
import { DupesSection } from "@/components/dupes-section";
import { ACCORD_COLORS } from "@/types";
import type { Fragrance, DupeResult } from "@/types";

interface DupesPageProps {
  onSelectFragrance?: (f: Fragrance) => void;
}

export function DupesPage({ onSelectFragrance }: DupesPageProps) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [searchResults, setSearchResults] = useState<Fragrance[]>([]);
  const [selectedForDupes, setSelectedForDupes] = useState<Fragrance | null>(null);
  const [dupes, setDupes] = useState<DupeResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const dupesMutation = useFindDupes();

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    setSelectedForDupes(null);
    setDupes(null);
    setSearched(q.trim());
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/search?q=${encodeURIComponent(q.trim())}`);
      const data = (await res.json()) as Fragrance[];
      setSearchResults(data.slice(0, 8));
    } catch { /* ignore */ } finally {
      setSearchLoading(false);
    }
  }, []);

  const handlePickFragrance = useCallback((f: Fragrance) => {
    setSelectedForDupes(f);
    setSearchResults([]);
    setDupes(null);
    dupesMutation.mutate(
      { data: { fragranceName: f.name } },
      { onSuccess: (data) => setDupes(data as DupeResult[]) }
    );
  }, [dupesMutation]);

  const handleDupeSelect = useCallback(async (name: string, house: string) => {
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
            <Copy size={16} style={{ color: "hsl(42 54% 50%)" }} />
            <h2 className="font-serif text-2xl" style={{ color: "hsl(40 20% 85%)" }}>Dupe Finder</h2>
          </div>
          <p className="text-sm" style={{ color: "hsl(40 10% 38%)" }}>
            Find cheaper or more accessible alternatives to any fragrance you love.
          </p>
        </div>

        {/* Search */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch(query); }}
          className="mb-5"
        >
          <div
            className="flex gap-2 rounded border px-3 py-2.5"
            style={{ background: "hsl(34 12% 9%)", borderColor: "hsl(34 10% 18%)" }}
          >
            <Search size={15} className="shrink-0 mt-0.5" style={{ color: "hsl(40 10% 38%)" }} />
            <input
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "hsl(40 15% 80%)" }}
              placeholder="e.g. Creed Aventus, Dior Sauvage, Tom Ford Black Orchid..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={searchLoading || !query.trim()}
              className="shrink-0 p-1.5 rounded transition-opacity disabled:opacity-40"
              style={{ color: "hsl(42 54% 55%)" }}
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
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(42 54% 30%)";
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
                  <span className="text-xs font-mono shrink-0" style={{ color: "hsl(42 54% 55%)" }}>
                    ${f.price_usd}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {searched && !searchLoading && searchResults.length === 0 && !selectedForDupes && (
          <p className="text-sm mb-6" style={{ color: "hsl(40 10% 38%)" }}>
            No fragrance found for "{searched}". Try a different name or house.
          </p>
        )}

        {/* Selected fragrance + dupes */}
        {selectedForDupes && (
          <>
            <div
              className="flex items-center gap-3 px-4 py-3 rounded border mb-5"
              style={{ background: "hsl(42 54% 50% / 0.07)", borderColor: "hsl(42 54% 35% / 0.4)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono tracking-widest mb-0.5" style={{ color: "hsl(40 10% 38%)" }}>
                  FINDING DUPES FOR
                </p>
                <p className="font-serif text-lg" style={{ color: "hsl(40 20% 90%)" }}>
                  {selectedForDupes.house} {selectedForDupes.name}
                </p>
              </div>
              <span className="font-mono text-sm shrink-0" style={{ color: "hsl(42 54% 60%)" }}>
                ${selectedForDupes.price_usd}
              </span>
              <button
                onClick={() => { setSelectedForDupes(null); setDupes(null); setQuery(""); }}
                className="text-xs px-2 py-1 rounded border transition-colors shrink-0"
                style={{ borderColor: "hsl(34 10% 22%)", color: "hsl(40 10% 48%)" }}
              >
                Change
              </button>
            </div>

            <DupesSection
              dupes={dupes}
              isLoading={dupesMutation.isPending}
              onSelect={handleDupeSelect}
            />

            {/* Price links for dupes */}
            {dupes && dupes.length > 0 && (
              <div
                className="mt-2 px-4 py-3 rounded border"
                style={{ background: "hsl(34 12% 8%)", borderColor: "hsl(34 10% 14%)" }}
              >
                <p className="text-xs font-mono tracking-widest mb-2.5" style={{ color: "hsl(40 10% 30%)" }}>
                  SHOP THE ORIGINAL
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: "FragranceNet", accent: "hsl(210 70% 52%)", url: `https://www.fragrancenet.com/search?q=${encodeURIComponent(`${selectedForDupes.house} ${selectedForDupes.name}`)}` },
                    { name: "Notino", accent: "hsl(340 65% 52%)", url: `https://www.notino.com/search/?q=${encodeURIComponent(`${selectedForDupes.house} ${selectedForDupes.name}`)}` },
                    { name: "Sephora", accent: "hsl(330 60% 48%)", url: `https://www.sephora.com/search?keyword=${encodeURIComponent(`${selectedForDupes.house} ${selectedForDupes.name}`)}` },
                    { name: "Amazon", accent: "hsl(36 90% 50%)", url: `https://www.amazon.com/s?k=${encodeURIComponent(`${selectedForDupes.house} ${selectedForDupes.name}`)}+perfume` },
                  ].map((r) => (
                    <a
                      key={r.name}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
                      style={{ background: `${r.accent}14`, color: r.accent, border: `1px solid ${r.accent}30`, textDecoration: "none" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = `${r.accent}28`; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = `${r.accent}14`; }}
                    >
                      {r.name} <ExternalLink size={10} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!searched && !selectedForDupes && (
          <div className="flex flex-col gap-2 mt-2">
            <p className="text-xs font-mono tracking-widest mb-1" style={{ color: "hsl(40 10% 28%)" }}>
              POPULAR SEARCHES
            </p>
            {["Creed Aventus", "Dior Sauvage", "Tom Ford Oud Wood", "Chanel Bleu EDP", "YSL Y EDP"].map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); handleSearch(s); }}
                className="text-left text-sm px-3 py-2.5 rounded border transition-all"
                style={{ background: "hsl(34 12% 8%)", borderColor: "hsl(34 10% 15%)", color: "hsl(40 10% 45%)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(42 54% 25%)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(34 10% 15%)"; }}
              >
                <span style={{ color: "hsl(42 54% 38%)" }}>✦ </span>{s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
