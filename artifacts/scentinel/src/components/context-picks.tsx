import { ContextPick } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";

interface PriceRetailer {
  name: string;
  accent: string;
  buildUrl: (q: string) => string;
}

const PRICE_RETAILERS: PriceRetailer[] = [
  {
    name: "FragranceNet",
    accent: "hsl(210 70% 52%)",
    buildUrl: (q) => `https://www.fragrancenet.com/search?q=${q}`,
  },
  {
    name: "Notino",
    accent: "hsl(340 65% 52%)",
    buildUrl: (q) => `https://www.notino.com/search/?q=${q}`,
  },
  {
    name: "Sephora",
    accent: "hsl(330 60% 48%)",
    buildUrl: (q) => `https://www.sephora.com/search?keyword=${q}`,
  },
  {
    name: "Amazon",
    accent: "hsl(36 90% 50%)",
    buildUrl: (q) => `https://www.amazon.com/s?k=${q}+perfume`,
  },
];

interface ContextPicksProps {
  picks: ContextPick[] | null;
  isLoading: boolean;
  weatherTemp: number;
  weatherDesc: string;
  occasion: string;
  timeOfDay: string;
  onOccasionChange: (v: string) => void;
  onTimeOfDayChange: (v: string) => void;
}

const OCCASIONS = ["casual", "office", "date", "outdoor", "evening"];
const TIMES_OF_DAY = ["morning", "daytime", "evening", "night"];

function ContextChip({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const idx = options.indexOf(value);
  const next = () => onChange(options[(idx + 1) % options.length]);

  return (
    <button
      data-testid={`context-chip-${label.toLowerCase()}`}
      onClick={next}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-xs"
      style={{
        background: "hsl(34 12% 11%)",
        borderColor: "hsl(34 10% 20%)",
        color: "hsl(40 15% 70%)",
      }}
      title={`Click to change ${label.toLowerCase()}`}
    >
      <span style={{ color: "hsl(40 10% 40%)" }}>{label}</span>
      <span className="font-medium capitalize" style={{ color: "hsl(42 54% 60%)" }}>
        {value}
      </span>
    </button>
  );
}

export function ContextPicks({
  picks,
  isLoading,
  weatherTemp,
  weatherDesc,
  occasion,
  timeOfDay,
  onOccasionChange,
  onTimeOfDayChange,
}: ContextPicksProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-xl" style={{ color: "hsl(40 20% 85%)" }}>
          Context Recommendations
        </h2>
      </div>

      {/* Context chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs"
          style={{
            background: "hsl(34 12% 11%)",
            borderColor: "hsl(34 10% 20%)",
            color: "hsl(40 15% 70%)",
          }}
        >
          <span style={{ color: "hsl(40 10% 40%)" }}>Weather</span>
          <span className="font-mono" style={{ color: "hsl(42 54% 60%)" }}>
            {weatherTemp}°C · {weatherDesc}
          </span>
        </div>
        <ContextChip
          label="Occasion"
          options={OCCASIONS}
          value={occasion}
          onChange={onOccasionChange}
        />
        <ContextChip
          label="Time"
          options={TIMES_OF_DAY}
          value={timeOfDay}
          onChange={onTimeOfDayChange}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded" style={{ background: "hsl(34 17% 10%)" }} />
          ))}
        </div>
      ) : picks && picks.length > 0 ? (
        <div className="space-y-2">
          {picks.map((pick) => {
            const query = encodeURIComponent(`${pick.house} ${pick.name}`);
            return (
              <div
                key={`${pick.name}-${pick.rank}`}
                data-testid={`context-pick-${pick.rank}`}
                className="rounded border px-4 py-3 transition-all"
                style={{
                  background: pick.rank === 1 ? "hsl(174 40% 12%)" : "hsl(34 17% 8%)",
                  borderColor: pick.rank === 1 ? "hsl(174 40% 20%)" : "hsl(34 10% 14%)",
                }}
              >
                {/* Top row — rank / name / match */}
                <div className="flex items-center gap-4">
                  <span
                    className="text-2xl font-serif shrink-0"
                    style={{ color: pick.rank === 1 ? "hsl(174 50% 55%)" : "hsl(40 10% 35%)" }}
                  >
                    {pick.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-base" style={{ color: "hsl(40 20% 88%)" }}>
                        {pick.name}
                      </span>
                      <span className="text-xs shrink-0" style={{ color: "hsl(40 10% 45%)" }}>
                        {pick.house}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "hsl(40 10% 50%)" }}>
                      {pick.reason}
                    </p>
                  </div>
                  <span
                    className="text-sm font-mono shrink-0"
                    style={{ color: pick.rank === 1 ? "hsl(174 50% 60%)" : "hsl(40 10% 45%)" }}
                  >
                    {pick.match_pct}%
                  </span>
                </div>

                {/* Price links row */}
                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5" style={{ borderTop: "1px solid hsl(34 10% 12%)" }}>
                  <span className="text-xs self-center mr-0.5" style={{ color: "hsl(40 10% 30%)" }}>
                    Best price:
                  </span>
                  {PRICE_RETAILERS.map((r) => (
                    <a
                      key={r.name}
                      href={r.buildUrl(query)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-all"
                      style={{
                        background: `${r.accent}14`,
                        color: r.accent,
                        border: `1px solid ${r.accent}30`,
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.background = `${r.accent}28`;
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = `${r.accent}60`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.background = `${r.accent}14`;
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = `${r.accent}30`;
                      }}
                    >
                      {r.name}
                      <ExternalLink size={9} />
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
