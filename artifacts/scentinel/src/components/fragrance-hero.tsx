import { Fragrance, ACCORD_COLORS, LONGEVITY_LABELS, SILLAGE_LABELS } from "@/types";

interface FragranceHeroProps {
  fragrance: Fragrance;
}

function LongevityBar({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-1 w-4 rounded-full"
          style={{
            background: i <= value ? "hsl(42 54% 50%)" : "hsl(34 10% 18%)",
          }}
        />
      ))}
    </div>
  );
}

function NotePyramid({ notes }: { notes: Fragrance["notes"] }) {
  const Section = ({
    label,
    items,
    width,
  }: {
    label: string;
    items: string[];
    width: string;
  }) => (
    <div className="flex flex-col items-center gap-1.5" style={{ width }}>
      <span
        className="text-xs font-mono tracking-widest"
        style={{ color: "hsl(42 54% 50%)" }}
      >
        {label}
      </span>
      <div
        className="w-full rounded px-3 py-2 flex flex-wrap justify-center gap-1.5"
        style={{ background: "hsl(34 12% 11%)" }}
      >
        {items.map((note) => (
          <span
            key={note}
            className="text-xs capitalize"
            style={{ color: "hsl(40 15% 72%)" }}
          >
            {note}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-2 mt-4">
      <Section label="TOP" items={notes.top} width="60%" />
      <Section label="HEART" items={notes.heart} width="80%" />
      <Section label="BASE" items={notes.base} width="100%" />
    </div>
  );
}

export function FragranceHero({ fragrance }: FragranceHeroProps) {
  return (
    <div
      data-testid="fragrance-hero"
      className="rounded border p-5 mb-6"
      style={{
        background: "hsl(34 17% 8%)",
        borderColor: "hsl(34 10% 14%)",
      }}
    >
      {/* Header — bottle image + title side by side */}
      <div className="flex gap-5 mb-4">
        {fragrance.image_url && (
          <div
            className="shrink-0 rounded overflow-hidden flex items-center justify-center"
            style={{
              width: 96,
              height: 128,
              background: "hsl(34 12% 11%)",
              border: "1px solid hsl(34 10% 18%)",
            }}
          >
            <img
              src={fragrance.image_url}
              alt={`${fragrance.house} ${fragrance.name} bottle`}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-mono tracking-widest uppercase mb-1"
            style={{ color: "hsl(40 10% 45%)" }}
          >
            {fragrance.house}
          </p>
          <h1
            className="font-serif text-4xl leading-tight mb-3"
            style={{ color: "hsl(40 20% 90%)" }}
            data-testid="fragrance-name"
          >
            {fragrance.name}
          </h1>

          {/* Meta pills */}
          <div className="flex flex-wrap gap-2">
            {[
              fragrance.concentration,
              String(fragrance.year),
              `${LONGEVITY_LABELS[fragrance.longevity]} longevity`,
              `${SILLAGE_LABELS[fragrance.sillage]} sillage`,
            ].map((label) => (
              <span
                key={label}
                className="text-xs px-2.5 py-1 rounded-full border font-mono"
                style={{
                  borderColor: "hsl(34 10% 22%)",
                  color: "hsl(40 10% 55%)",
                  background: "hsl(34 12% 11%)",
                }}
              >
                {label}
              </span>
            ))}
            <span
              className="text-xs px-2.5 py-1 rounded-full font-mono font-medium"
              style={{ background: "hsl(42 54% 50% / 0.15)", color: "hsl(42 54% 70%)" }}
            >
              ${fragrance.price_usd}
            </span>
          </div>
        </div>
      </div>

      {/* Accords */}
      <div className="flex flex-wrap gap-2 mb-1">
        {fragrance.accords.map((accord) => {
          const color = ACCORD_COLORS[accord] ?? "#7a7a7a";
          return (
            <span
              key={accord}
              data-testid={`accord-chip-${accord}`}
              className="text-xs px-2.5 py-1 rounded-full capitalize font-medium"
              style={{
                background: `${color}22`,
                color: color,
                border: `1px solid ${color}44`,
              }}
            >
              {accord}
            </span>
          );
        })}
      </div>

      {/* Notes pyramid */}
      <div className="mt-1">
        <p className="text-xs font-mono tracking-widest mb-3" style={{ color: "hsl(40 10% 40%)" }}>
          NOTES PYRAMID
        </p>
        <NotePyramid notes={fragrance.notes} />
      </div>

      {/* Longevity & Sillage */}
      <div
        className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t"
        style={{ borderColor: "hsl(34 10% 14%)" }}
      >
        <div>
          <p className="text-xs font-mono tracking-widest mb-2" style={{ color: "hsl(40 10% 40%)" }}>
            LONGEVITY
          </p>
          <LongevityBar value={fragrance.longevity} />
        </div>
        <div>
          <p className="text-xs font-mono tracking-widest mb-2" style={{ color: "hsl(40 10% 40%)" }}>
            SILLAGE
          </p>
          <LongevityBar value={fragrance.sillage} />
        </div>
      </div>
    </div>
  );
}
