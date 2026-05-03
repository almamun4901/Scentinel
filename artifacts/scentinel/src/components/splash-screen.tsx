import { useState, useEffect, useCallback } from "react";
import { TextFlippingBoard } from "@/components/ui/text-flipping-board";
import { ShootingStars } from "@/components/shooting-stars";

const MESSAGES = [
  "SCENTINEL\nFRAGRANCE INTELLIGENCE",
  "YOUR SIGNATURE\nAWAITS",
];

export function shouldShowSplash(): boolean {
  return true;
}

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [msgVisible, setMsgVisible] = useState(true);

  const dismiss = useCallback(() => {
    if (fading) return;
    setFading(true);
    setTimeout(onDone, 680);
  }, [fading, onDone]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (msgIdx < MESSAGES.length - 1) {
        setMsgVisible(false);
        setTimeout(() => {
          setMsgIdx((i) => i + 1);
          setMsgVisible(true);
        }, 380);
      } else {
        dismiss();
      }
    }, 3200);
    return () => clearTimeout(timer);
  }, [msgIdx, dismiss]);

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "hsl(30 14% 3%)",
        opacity: fading ? 0 : 1,
        transition: "opacity 680ms cubic-bezier(0.4,0,0.2,1)",
        cursor: "pointer",
      }}
    >
      <ShootingStars minSpeed={1} maxSpeed={3} minDelay={1800} maxDelay={6000} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          opacity: msgVisible ? 1 : 0,
          transform: msgVisible ? "translateY(0)" : "translateY(-6px)",
          transition: "opacity 380ms ease, transform 380ms ease",
        }}
      >
        <TextFlippingBoard text={MESSAGES[msgIdx]} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
          }}
        >
          {MESSAGES.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === msgIdx ? 16 : 4,
                height: 2,
                borderRadius: 2,
                background:
                  i === msgIdx ? "hsl(42 54% 50%)" : "hsl(34 10% 18%)",
                transition: "width 300ms ease, background 300ms ease",
              }}
            />
          ))}
        </div>
      </div>

      <p
        style={{
          position: "absolute",
          bottom: 32,
          fontSize: 10,
          fontFamily: "DM Mono, monospace",
          letterSpacing: "0.15em",
          color: "hsl(40 10% 26%)",
          opacity: fading ? 0 : 1,
          transition: "opacity 680ms ease",
          userSelect: "none",
        }}
      >
        TAP ANYWHERE TO SKIP
      </p>
    </div>
  );
}
