import { useState, useCallback } from "react";
import { Library, Plus, Trash2, Search, Loader2, ExternalLink } from "lucide-react";
import { useGetProfile, useSaveProfile } from "@workspace/api-client-react";
import { ACCORD_COLORS } from "@/types";
import type { Fragrance } from "@/types";

interface CollectionPageProps {
  onSelectFragrance?: (f: Fragrance) => void;
}

export function CollectionPage({ onSelectFragrance }: CollectionPageProps) {
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<Fragrance[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const { data: profileData, refetch } = useGetProfile({ query: { queryKey: ["profile"] } });
  const saveProfile = useSaveProfile();

  const owned: string[] = profileData?.ownedFragrances ?? [];
  const [resolvedMap, setResolvedMap] = useState<Record<string, Fragrance>>({});

  const resolveFragrance = useCallback(async (name: string) => {
    if (resolvedMap[name]) return;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/search?q=${encodeURIComponent(name)}`);
      const data = (await res.json()) as Fragrance[];
      if (data.length > 0) {
        setResolvedMap((prev) => ({ ...prev, [name]: data[0] }));
      }
    } catch { /* ignore */ }
  }, [resolvedMap]);

  // Resolve all on mount / when owned changes
  useState(() => {
    owned.forEach(resolveFragrance);
  });

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setAddLoading(true);
    setAddResults([]);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/search?q=${encodeURIComponent(q.trim())}`);
      const data = (await res.json()) as Fragrance[];
      setAddResults(data.slice(0, 6));
    } catch { /* ignore */ } finally {
      setAddLoading(false);
    }
  }, []);

  const handleAdd = useCallback(async (name: string) => {
    if (owned.includes(name)) return;
    const next = [...owned, name];
    await saveProfile.mutateAsync({ data: { ownedFragrances: next } });
    await refetch();
    setAddResults([]);
    setAddQuery("");
    setShowSearch(false);
  }, [owned, saveProfile, refetch]);

  const handleRemove = useCallback(async (name: string) => {
    const next = owned.filter((n) => n !== name);
    await saveProfile.mutateAsync({ data: { ownedFragrances: next } });
    await refetch();
  }, [owned, saveProfile, refetch]);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Library size={16} style={{ color: "hsl(42 54% 50%)" }} />
              <h2 className="font-serif text-2xl" style={{ color: "hsl(40 20% 85%)" }}>Collection</h2>
            </div>
            <p className="text-sm" style={{ color: "hsl(40 10% 38%)" }}>
              Track what you own — used for personalised recommendations.
            </p>
          </div>
          <button
            onClick={() => setShowSearch((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded border text-sm transition-all shrink-0"
            style={{
              background: showSearch ? "hsl(42 54% 50% / 0.12)" : "hsl(34 12% 9%)",
              borderColor: showSearch ? "hsl(42 54% 40%)" : "hsl(34 10% 18%)",
              color: showSearch ? "hsl(42 54% 65%)" : "hsl(40 10% 55%)",
            }}
          >
            <Plus size={14} />
            Add
          </button>
        </div>

        {/* Add search panel */}
        {showSearch && (
          <div
            className="rounded border px-4 py-4 mb-5"
            style={{ background: "hsl(34 12% 8%)", borderColor: "hsl(42 54% 30% / 0.35)" }}
          >
            <p className="text-xs font-mono tracking-widest mb-3" style={{ color: "hsl(40 10% 32%)" }}>
              SEARCH TO ADD
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); handleSearch(addQuery); }}
              className="flex gap-2 mb-3"
            >
              <div
                className="flex-1 flex gap-2 rounded border px-3 py-2"
                style={{ background: "hsl(34 12% 11%)", borderColor: "hsl(34 10% 20%)" }}
              >
                <Search size={14} className="shrink-0 mt-0.5" style={{ color: "hsl(40 10% 38%)" }} />
                <input
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: "hsl(40 15% 80%)" }}
                  placeholder="Fragrance name..."
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={addLoading || !addQuery.trim()}
                className="px-3 py-2 rounded border text-sm transition-all disabled:opacity-40"
                style={{ borderColor: "hsl(42 54% 35%)", color: "hsl(42 54% 60%)", background: "hsl(42 54% 50% / 0.08)" }}
              >
                {addLoading ? <Loader2 size={14} className="animate-spin" /> : "Search"}
              </button>
            </form>

            {addResults.length > 0 && (
              <div className="flex flex-col gap-1">
                {addResults.map((f) => {
                  const alreadyOwned = owned.includes(f.name);
                  return (
                    <button
                      key={f.id}
                      onClick={() => !alreadyOwned && handleAdd(f.name)}
                      disabled={alreadyOwned}
                      className="flex items-center gap-3 px-3 py-2.5 rounded border text-left transition-all disabled:opacity-50"
                      style={{
                        background: alreadyOwned ? "hsl(34 12% 11%)" : "hsl(34 12% 10%)",
                        borderColor: alreadyOwned ? "hsl(42 54% 28%)" : "hsl(34 10% 17%)",
                      }}
                      onMouseEnter={(e) => {
                        if (!alreadyOwned) (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(42 54% 32%)";
                      }}
                      onMouseLeave={(e) => {
                        if (!alreadyOwned) (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(34 10% 17%)";
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-mono" style={{ color: "hsl(40 10% 40%)" }}>{f.house}</span>
                        <p className="font-serif text-sm leading-tight" style={{ color: "hsl(40 20% 86%)" }}>{f.name}</p>
                      </div>
                      <span className="text-xs font-mono shrink-0" style={{ color: "hsl(42 54% 55%)" }}>
                        ${f.price_usd}
                      </span>
                      <span
                        className="text-xs shrink-0 px-2 py-0.5 rounded"
                        style={{
                          background: alreadyOwned ? "hsl(42 54% 50% / 0.15)" : "hsl(34 12% 14%)",
                          color: alreadyOwned ? "hsl(42 54% 60%)" : "hsl(40 10% 45%)",
                        }}
                      >
                        {alreadyOwned ? "Owned" : "+ Add"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Collection grid */}
        {owned.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-center rounded border"
            style={{ borderColor: "hsl(34 10% 12%)", background: "hsl(34 12% 7%)" }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
              style={{ background: "hsl(34 12% 11%)", border: "1px solid hsl(34 10% 18%)" }}
            >
              <Library size={22} style={{ color: "hsl(40 10% 40%)" }} />
            </div>
            <h3 className="font-serif text-xl mb-2" style={{ color: "hsl(40 15% 55%)" }}>
              Your collection is empty
            </h3>
            <p className="text-sm max-w-xs mb-5" style={{ color: "hsl(40 10% 35%)" }}>
              Add fragrances you own to get smarter context recommendations and dupes.
            </p>
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded border text-sm transition-all"
              style={{
                borderColor: "hsl(42 54% 35%)",
                color: "hsl(42 54% 62%)",
                background: "hsl(42 54% 50% / 0.1)",
              }}
            >
              <Plus size={14} />
              Add your first fragrance
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs font-mono tracking-widest mb-3" style={{ color: "hsl(40 10% 28%)" }}>
              {owned.length} {owned.length === 1 ? "FRAGRANCE" : "FRAGRANCES"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {owned.map((name) => {
                const f = resolvedMap[name];
                const query = encodeURIComponent(name);
                return (
                  <div
                    key={name}
                    className="rounded border p-4 flex flex-col gap-3"
                    style={{ background: "hsl(34 17% 8%)", borderColor: "hsl(34 10% 14%)" }}
                  >
                    {/* Image strip */}
                    {f?.image_url && (
                      <div
                        className="w-full rounded overflow-hidden flex items-center justify-center -mx-4"
                        style={{
                          width: "calc(100% + 2rem)",
                          height: 140,
                          background: "linear-gradient(160deg, hsl(34 17% 10%) 0%, hsl(34 12% 6%) 100%)",
                        }}
                      >
                        <img
                          src={f.image_url}
                          alt={name}
                          className="h-full w-full object-contain"
                          style={{ padding: "8px 32px" }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    )}

                    {/* Identity */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {f ? (
                          <>
                            <p className="text-xs font-mono tracking-widest uppercase" style={{ color: "hsl(40 10% 40%)" }}>
                              {f.house}
                            </p>
                            <p className="font-serif text-lg leading-tight mt-0.5" style={{ color: "hsl(40 20% 90%)" }}>
                              {f.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-mono" style={{ color: "hsl(42 54% 55%)" }}>${f.price_usd}</span>
                              <span style={{ color: "hsl(40 10% 30%)" }}>·</span>
                              <span className="text-xs font-mono" style={{ color: "hsl(40 10% 40%)" }}>{f.concentration}</span>
                            </div>
                          </>
                        ) : (
                          <p className="font-serif text-base" style={{ color: "hsl(40 20% 80%)" }}>{name}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemove(name)}
                        className="shrink-0 p-1.5 rounded transition-colors"
                        style={{ color: "hsl(40 10% 32%)" }}
                        title="Remove from collection"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Accords */}
                    {f && (
                      <div className="flex flex-wrap gap-1">
                        {f.accords.slice(0, 4).map((a) => {
                          const color = ACCORD_COLORS[a] ?? "#7a7a7a";
                          return (
                            <span key={a} className="text-xs px-1.5 py-0.5 rounded capitalize" style={{ background: `${color}18`, color }}>
                              {a}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Actions */}
                    <div
                      className="flex items-center gap-2 pt-2"
                      style={{ borderTop: "1px solid hsl(34 10% 12%)" }}
                    >
                      {f && onSelectFragrance && (
                        <button
                          onClick={() => onSelectFragrance(f)}
                          className="flex-1 text-xs px-3 py-1.5 rounded border transition-all text-center"
                          style={{ borderColor: "hsl(42 54% 30%)", color: "hsl(42 54% 60%)", background: "hsl(42 54% 50% / 0.08)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "hsl(42 54% 50% / 0.16)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "hsl(42 54% 50% / 0.08)"; }}
                        >
                          Explore →
                        </button>
                      )}
                      <a
                        href={`https://www.fragrancenet.com/search?q=${query}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border transition-all"
                        style={{
                          borderColor: "hsl(210 70% 52% / 0.3)",
                          color: "hsl(210 70% 52%)",
                          background: "hsl(210 70% 52% / 0.08)",
                          textDecoration: "none",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "hsl(210 70% 52% / 0.16)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "hsl(210 70% 52% / 0.08)"; }}
                      >
                        Best Price <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
