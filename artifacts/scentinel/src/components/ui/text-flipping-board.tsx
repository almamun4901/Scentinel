import { useEffect, useState } from "react";

const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·:*%#@";

interface CharTileProps {
  target: string;
  delay: number;
}

function CharTile({ target, delay }: CharTileProps) {
  const [display, setDisplay] = useState("·");
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setDisplay("·");
    setSettled(false);

    if (target === " ") {
      setSettled(true);
      return;
    }

    let frame = 0;
    const totalFrames = 10;
    let iv: ReturnType<typeof setInterval>;

    const id = setTimeout(() => {
      iv = setInterval(() => {
        if (frame >= totalFrames) {
          setDisplay(target.toUpperCase());
          setSettled(true);
          clearInterval(iv);
        } else {
          setDisplay(SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]);
          frame++;
        }
      }, 38);
    }, delay);

    return () => {
      clearTimeout(id);
      clearInterval(iv);
    };
  }, [target, delay]);

  if (target === " ") {
    return <span style={{ display: "inline-block", width: 10 }} />;
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 36,
        background: settled ? "hsl(34 12% 9%)" : "hsl(34 8% 5%)",
        border: `1px solid ${settled ? "hsl(42 30% 22%)" : "hsl(34 8% 10%)"}`,
        borderRadius: 3,
        color: settled ? "hsl(42 54% 58%)" : "hsl(34 10% 28%)",
        fontSize: 13,
        fontFamily: "DM Mono, monospace",
        fontWeight: 500,
        marginRight: 3,
        marginBottom: 5,
        transition: "background 180ms, border-color 180ms, color 180ms",
        userSelect: "none",
      }}
    >
      {display}
    </span>
  );
}

export interface TextFlippingBoardProps {
  text: string;
}

export function TextFlippingBoard({ text }: TextFlippingBoardProps) {
  const lines = text.split("\n");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {lines.map((line, li) => {
        const lineStartIdx = lines
          .slice(0, li)
          .reduce((acc, l) => acc + l.length, 0);
        return (
          <div
            key={li}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {line.split("").map((char, ci) => (
              <CharTile
                key={`${li}-${ci}-${char}`}
                target={char}
                delay={(lineStartIdx + ci) * 36}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
