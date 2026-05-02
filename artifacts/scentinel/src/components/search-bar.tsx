import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchFragrances, getSearchFragrancesQueryKey } from "@workspace/api-client-react";
import { Fragrance } from "@/types";

interface SearchBarProps {
  onSelect: (fragrance: Fragrance) => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const params = { q: debouncedQuery };
  const { data: results, isLoading } = useSearchFragrances(params, {
    query: {
      enabled: debouncedQuery.length >= 2,
      queryKey: getSearchFragrancesQueryKey(params),
    },
  });

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (fragrance: Fragrance) => {
      setQuery(`${fragrance.house} ${fragrance.name}`);
      setOpen(false);
      onSelect(fragrance);
    },
    [onSelect]
  );

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <input
        ref={inputRef}
        data-testid="search-input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search any fragrance…"
        className="w-full px-4 py-2.5 rounded border text-sm bg-transparent outline-none transition-all placeholder:italic"
        style={{
          background: "hsl(34 17% 6%)",
          borderColor: open ? "hsl(42 54% 40%)" : "hsl(34 10% 16%)",
          color: "hsl(40 20% 85%)",
          fontFamily: "'DM Sans', sans-serif",
        }}
        autoComplete="off"
        spellCheck={false}
      />

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded border z-50 overflow-hidden"
          style={{
            background: "hsl(34 17% 8%)",
            borderColor: "hsl(34 10% 18%)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
          }}
        >
          {isLoading ? (
            <div className="px-4 py-3 text-sm" style={{ color: "hsl(40 10% 48%)" }}>
              Searching...
            </div>
          ) : results && results.length > 0 ? (
            <ul>
              {(results as Fragrance[]).map((fragrance) => (
                <li key={fragrance.id}>
                  <button
                    data-testid={`search-result-${fragrance.id}`}
                    onClick={() => handleSelect(fragrance)}
                    className="w-full text-left px-4 py-2.5 flex items-center justify-between group transition-colors"
                    style={{ borderBottom: "1px solid hsl(34 10% 12%)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "hsl(34 17% 11%)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <div>
                      <span className="text-sm block" style={{ color: "hsl(40 20% 85%)" }}>
                        {fragrance.name}
                      </span>
                      <span className="text-xs" style={{ color: "hsl(40 10% 48%)" }}>
                        {fragrance.house}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: "hsl(34 12% 16%)",
                          color: "hsl(40 10% 55%)",
                        }}
                      >
                        {fragrance.concentration}
                      </span>
                      <span className="text-xs font-mono" style={{ color: "hsl(42 54% 50%)" }}>
                        £{fragrance.price_gbp}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm" style={{ color: "hsl(40 10% 48%)" }}>
              No results for "{debouncedQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
