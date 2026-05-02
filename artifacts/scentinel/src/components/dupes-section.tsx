import { useEffect, useState } from "react";
import { DupeResult, ACCORD_COLORS } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface DupesSectionProps {
  dupes: DupeResult[] | null;
  isLoading: boolean;
}

function SimilarityBar({ pct, animate }: { pct: number; animate: boolean }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setWidth(pct), 100);
      return () => clearTimeout(timer);
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
          background: "linear-gradient(to right, hsl(42 54% 40%), hsl(42 54% 62%))",
        }}
      />
    </div>
  );
}

function DupeCard({ dupe, index, animate }: { dupe: DupeResult; index: number; animate: boolean }) {
  const isTopPick = index === 0;
  const savings = dupe.price_delta;

  return (
    <div
      data-testid={`dupe-card-${index}`}
      className="rounded border p-4 flex flex-col gap-3 relative overflow-hidden"
      style={{
        background: "hsl(34 17% 8%)",
        borderColor: isTopPick ? "hsl(42 54% 35%)" : "hsl(34 10% 14%)",
        borderTopWidth: isTopPick ? "2px" : "1px",
      }}
    >
      {isTopPick && (
        <span
          className="absolute top-0 right-3 text-xs font-mono tracking-widest px-2 py-0.5 rounded-b"
          style={{ background: "hsl(42 54% 50%)", color: "hsl(30 14% 5%)" }}
        >
          TOP PICK
        </span>
      )}

      <div>
        <p className="text-xs" style={{ color: "hsl(40 10% 45%)" }}>{dupe.house}</p>
        <p className="font-serif text-lg leading-tight mt-0.5" style={{ color: "hsl(40 20% 88%)" }}>
          {dupe.name}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: "hsl(40 10% 45%)" }}>Similarity</span>
          <span className="text-sm font-mono" style={{ color: "hsl(42 54% 60%)" }}>
            {dupe.similarity_pct}%
          </span>
        </div>
        <SimilarityBar pct={dupe.similarity_pct} animate={animate} />
      </div>

      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "hsl(34 10% 13%)" }}>
        <span className="font-mono text-sm" style={{ color: "hsl(40 20% 80%)" }}>
          £{dupe.price_gbp}
        </span>
        {savings > 0 && (
          <span className="text-xs font-mono" style={{ color: "hsl(142 50% 50%)" }}>
            Save £{savings}
          </span>
        )}
        {savings < 0 && (
          <span className="text-xs font-mono" style={{ color: "hsl(40 10% 45%)" }}>
            +£{Math.abs(savings)} more
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {dupe.accords.slice(0, 4).map((accord) => {
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
    </div>
  );
}

export function DupesSection({ dupes, isLoading }: DupesSectionProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (dupes) {
      setAnimated(false);
      const timer = setTimeout(() => setAnimated(true), 50);
      return () => clearTimeout(timer);
    }
  }, [dupes]);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-xl" style={{ color: "hsl(40 20% 85%)" }}>
          Alternatives & Dupes
        </h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded" style={{ background: "hsl(34 17% 10%)" }} />
          ))}
        </div>
      ) : dupes && dupes.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {dupes.slice(0, 3).map((dupe, i) => (
            <DupeCard key={`${dupe.name}-${i}`} dupe={dupe} index={i} animate={animated} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
