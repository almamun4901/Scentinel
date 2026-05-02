import { ContextPick } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

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
          {picks.map((pick) => (
            <div
              key={`${pick.name}-${pick.rank}`}
              data-testid={`context-pick-${pick.rank}`}
              className="flex items-center gap-4 rounded border px-4 py-3 transition-all"
              style={{
                background:
                  pick.rank === 1 ? "hsl(174 40% 12%)" : "hsl(34 17% 8%)",
                borderColor:
                  pick.rank === 1 ? "hsl(174 40% 20%)" : "hsl(34 10% 14%)",
              }}
            >
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
          ))}
        </div>
      ) : null}
    </div>
  );
}
