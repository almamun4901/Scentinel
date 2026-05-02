import { useEffect, useRef } from "react";
import { BlindBuyScore, RiskFlag } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface BlindBuyScorerProps {
  score: BlindBuyScore | null;
  isLoading: boolean;
  fragranceName?: string;
}

const CIRCUMFERENCE = 2 * Math.PI * 52;

function ScoreRing({ score, animated }: { score: number; animated: boolean }) {
  const dashOffset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
  const gradientId = "score-ring-gradient";

  const verdictColor = (s: number) => {
    if (s >= 80) return "hsl(142 50% 55%)";
    if (s >= 60) return "hsl(42 54% 55%)";
    if (s >= 40) return "hsl(30 70% 55%)";
    return "hsl(0 60% 50%)";
  };

  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="mx-auto">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(42 54% 35%)" />
          <stop offset="100%" stopColor={verdictColor(score)} />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle
        cx="64"
        cy="64"
        r="52"
        fill="none"
        stroke="hsl(34 10% 16%)"
        strokeWidth="8"
      />
      {/* Score arc */}
      <circle
        cx="64"
        cy="64"
        r="52"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={animated ? dashOffset : CIRCUMFERENCE}
        transform="rotate(-90 64 64)"
        style={{
          transition: animated ? "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
      />
      {/* Score label */}
      <text
        x="64"
        y="58"
        textAnchor="middle"
        fill="hsl(40 20% 88%)"
        fontSize="28"
        fontFamily="'DM Mono', monospace"
        fontWeight="400"
      >
        {score}
      </text>
      <text
        x="64"
        y="76"
        textAnchor="middle"
        fill="hsl(40 10% 45%)"
        fontSize="10"
        fontFamily="'DM Mono', monospace"
      >
        / 100
      </text>
    </svg>
  );
}

const VERDICT_STYLES: Record<string, { bg: string; text: string }> = {
  "Strong buy": { bg: "hsl(142 50% 20%)", text: "hsl(142 60% 60%)" },
  "Buy": { bg: "hsl(42 54% 20%)", text: "hsl(42 60% 65%)" },
  "Try first": { bg: "hsl(30 60% 20%)", text: "hsl(30 70% 65%)" },
  "Avoid": { bg: "hsl(0 50% 18%)", text: "hsl(0 60% 60%)" },
};

const RISK_FLAG_STYLES: Record<string, { borderColor: string; dotColor: string }> = {
  warn: { borderColor: "hsl(30 70% 40%)", dotColor: "hsl(30 80% 55%)" },
  info: { borderColor: "hsl(220 50% 40%)", dotColor: "hsl(220 60% 65%)" },
  ok: { borderColor: "hsl(142 40% 30%)", dotColor: "hsl(142 50% 55%)" },
};

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs capitalize" style={{ color: "hsl(40 10% 50%)" }}>
        {label.replace(/_/g, " ")}
      </span>
      <span className="text-sm font-mono" style={{ color: "hsl(40 20% 80%)" }}>
        {value}
      </span>
    </div>
  );
}

function RiskFlagItem({ flag }: { flag: RiskFlag }) {
  const styles = RISK_FLAG_STYLES[flag.level] ?? RISK_FLAG_STYLES.info;
  return (
    <div
      className="flex gap-2.5 px-3 py-2 rounded border-l-2 text-xs"
      style={{
        borderLeftColor: styles.borderColor,
        background: "hsl(34 12% 10%)",
        color: "hsl(40 15% 65%)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5"
        style={{ background: styles.dotColor }}
      />
      {flag.message}
    </div>
  );
}

export function BlindBuyScorer({ score, isLoading, fragranceName }: BlindBuyScorerProps) {
  const scoreRef = useRef(false);

  useEffect(() => {
    if (score) {
      scoreRef.current = false;
      const timer = setTimeout(() => { scoreRef.current = true; }, 50);
      return () => clearTimeout(timer);
    }
  }, [score]);

  return (
    <div
      className="h-full flex flex-col"
      style={{ borderLeft: "1px solid hsl(34 10% 12%)", paddingLeft: "20px" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg" style={{ color: "hsl(40 20% 82%)" }}>
          Blind Buy Score
        </h3>
        {fragranceName && (
          <span className="text-xs" style={{ color: "hsl(40 10% 40%)" }}>
            {fragranceName}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="w-32 h-32 rounded-full" style={{ background: "hsl(34 17% 12%)" }} />
          <Skeleton className="h-5 w-24 rounded" style={{ background: "hsl(34 17% 12%)" }} />
          <div className="w-full space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7 w-full rounded" style={{ background: "hsl(34 17% 10%)" }} />
            ))}
          </div>
        </div>
      ) : score ? (
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Score ring */}
          <ScoreRing score={score.overall_score} animated />

          {/* Verdict */}
          {(() => {
            const vs = VERDICT_STYLES[score.verdict] ?? VERDICT_STYLES["Buy"];
            return (
              <div
                data-testid="verdict-badge"
                className="text-center py-1.5 px-3 rounded text-sm font-medium"
                style={{ background: vs.bg, color: vs.text }}
              >
                {score.verdict}
              </div>
            );
          })()}

          {/* Breakdown */}
          <div className="border-t pt-3" style={{ borderColor: "hsl(34 10% 14%)" }}>
            <p className="text-xs font-mono tracking-widest mb-2" style={{ color: "hsl(40 10% 38%)" }}>
              BREAKDOWN
            </p>
            {Object.entries(score.breakdown).map(([key, val]) => (
              <BreakdownRow key={key} label={key} value={val} />
            ))}
          </div>

          {/* Risk flags */}
          {score.risk_flags.length > 0 && (
            <div>
              <p className="text-xs font-mono tracking-widest mb-2" style={{ color: "hsl(40 10% 38%)" }}>
                RISK FLAGS
              </p>
              <div className="space-y-2">
                {score.risk_flags.map((flag, i) => (
                  <RiskFlagItem key={i} flag={flag} />
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          {score.recommendation && (
            <div className="text-xs leading-relaxed" style={{ color: "hsl(40 10% 50%)" }}>
              {score.recommendation}
            </div>
          )}

          {/* CTAs */}
          <div className="space-y-2 mt-auto pt-2">
            <button
              data-testid="btn-find-best-price"
              className="w-full py-2.5 text-sm rounded border transition-all"
              style={{
                borderColor: "hsl(42 54% 35%)",
                color: "hsl(42 54% 60%)",
                background: "hsl(42 54% 50% / 0.08)",
              }}
            >
              Find the best price
            </button>
            <button
              data-testid="btn-order-sample"
              className="w-full py-2.5 text-sm rounded border transition-all"
              style={{
                borderColor: "hsl(34 10% 20%)",
                color: "hsl(40 10% 55%)",
                background: "transparent",
              }}
            >
              Order a sample instead
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col items-center justify-center text-center px-4"
          style={{ color: "hsl(40 10% 35%)" }}
        >
          <div className="mb-3 text-3xl font-serif" style={{ color: "hsl(34 10% 25%)" }}>
            —
          </div>
          <p className="text-sm">Select a fragrance to generate a blind buy score</p>
        </div>
      )}
    </div>
  );
}
