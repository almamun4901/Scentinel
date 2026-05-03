import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface FragranceCardItem {
  name: string;
  house: string;
  accords: string[];
  notes: string[];
  season: string;
  seasonColor: string;
  year?: number;
}

interface InfiniteMovingCardsProps {
  items: FragranceCardItem[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  pauseOnHover?: boolean;
  className?: string;
  onSelect?: (item: FragranceCardItem) => void;
}

const ACCORD_COLORS: Record<string, string> = {
  fruity: "#e86c4f",
  woody: "#a0785a",
  smoky: "#7a7a7a",
  fresh: "#6bb8c9",
  citrus: "#e4c04a",
  spicy: "#c45c3a",
  lavender: "#9b87c4",
  vanilla: "#d4a96a",
  aromatic: "#7ba864",
  aquatic: "#4a9fb5",
  mineral: "#8a9aad",
  earthy: "#8c6f4e",
  oud: "#8a5c3e",
  resinous: "#9c7a3a",
  sweet: "#c4788a",
  fougere: "#5a8c6a",
  oriental: "#c4703c",
  floral: "#c48aaa",
  amber: "#c4923c",
};

const SPEED_MAP = { fast: "20s", normal: "40s", slow: "60s" };

export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "slow",
  pauseOnHover = true,
  className,
  onSelect,
}: InfiniteMovingCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLUListElement>(null);
  const [start, setStart] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !scrollRef.current) return;
    const ul = scrollRef.current;
    Array.from(ul.children).forEach((child) => {
      const clone = child.cloneNode(true) as HTMLElement;
      ul.appendChild(clone);
    });
    containerRef.current.style.setProperty(
      "--animation-duration",
      SPEED_MAP[speed]
    );
    containerRef.current.style.setProperty(
      "--animation-direction",
      direction === "left" ? "forwards" : "reverse"
    );
    setStart(true);
  }, [speed, direction]);

  return (
    <div
      ref={containerRef}
      className={cn("scroller relative overflow-hidden", className)}
      style={
        {
          maskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        } as React.CSSProperties
      }
    >
      <ul
        ref={scrollRef}
        className={cn(
          "flex w-max min-w-full gap-3 py-1",
          start && "animate-scroll"
        )}
        style={{
          animationDuration: SPEED_MAP[speed],
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationDirection: direction === "left" ? "normal" : "reverse",
          ...(pauseOnHover ? {} : {}),
        }}
        onMouseEnter={(e) => {
          if (pauseOnHover)
            (e.currentTarget as HTMLUListElement).style.animationPlayState =
              "paused";
        }}
        onMouseLeave={(e) => {
          if (pauseOnHover)
            (e.currentTarget as HTMLUListElement).style.animationPlayState =
              "running";
        }}
      >
        {items.map((item, i) => {
          const primaryAccord = item.accords[0] ?? "woody";
          const accentColor = ACCORD_COLORS[primaryAccord] ?? "#c4963c";
          return (
            <li
              key={`${item.name}-${i}`}
              onClick={() => onSelect?.(item)}
              className="relative rounded-xl shrink-0 w-[200px] px-4 py-4 flex flex-col gap-2.5 transition-all"
              style={{
                background:
                  "linear-gradient(145deg, hsl(34 17% 9%), hsl(34 12% 7%))",
                border: `1px solid ${accentColor}28`,
                cursor: onSelect ? "pointer" : "default",
              }}
              onMouseEnter={(e) => {
                if (onSelect)
                  (e.currentTarget as HTMLLIElement).style.borderColor = `${accentColor}60`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLLIElement).style.borderColor =
                  `${accentColor}28`;
              }}
            >
              {/* Accord color strip */}
              <div className="flex gap-0.5 h-1 rounded-full overflow-hidden">
                {item.accords.slice(0, 4).map((accord) => (
                  <div
                    key={accord}
                    className="flex-1 rounded-full"
                    style={{ background: ACCORD_COLORS[accord] ?? "#888" }}
                  />
                ))}
              </div>

              {/* Name & house */}
              <div>
                <p
                  className="font-serif text-base leading-tight"
                  style={{ color: "hsl(40 20% 88%)" }}
                >
                  {item.name}
                </p>
                <p
                  className="text-xs mt-0.5 font-mono"
                  style={{ color: "hsl(40 10% 40%)" }}
                >
                  {item.house}
                </p>
              </div>

              {/* Top notes */}
              <div className="flex flex-wrap gap-1">
                {item.notes.slice(0, 3).map((note) => (
                  <span
                    key={note}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: "hsl(34 12% 13%)",
                      color: "hsl(40 10% 52%)",
                    }}
                  >
                    {note}
                  </span>
                ))}
              </div>

              {/* Season + year */}
              <div className="flex items-center justify-between mt-auto pt-1">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-mono capitalize"
                  style={{
                    background: `${item.seasonColor}18`,
                    color: item.seasonColor,
                  }}
                >
                  {item.season}
                </span>
                {item.year && (
                  <span
                    className="text-xs font-mono"
                    style={{ color: "hsl(40 10% 30%)" }}
                  >
                    {item.year}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
