export function BottlePlaceholder({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.5}
      viewBox="0 0 40 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: 0.35 }}
    >
      <rect x="16" y="2" width="8" height="4" rx="1.5" fill="hsl(42 54% 50%)" />
      <rect x="17.5" y="6" width="5" height="6" rx="1" fill="hsl(42 40% 45%)" />
      <path
        d="M14 12 Q8 18 8 30 Q8 50 20 52 Q32 50 32 30 Q32 18 26 12 Z"
        fill="hsl(34 17% 13%)"
        stroke="hsl(42 30% 30%)"
        strokeWidth="0.8"
      />
      <path
        d="M14 12 Q8 18 8 30 Q8 50 20 52 Q32 50 32 30 Q32 18 26 12 Z"
        fill="url(#bottleGrad)"
        opacity="0.6"
      />
      <rect x="12" y="30" width="16" height="10" rx="2" fill="hsl(42 54% 50%)" opacity="0.12" />
      <rect x="13" y="31" width="14" height="8" rx="1.5" fill="none" stroke="hsl(42 40% 40%)" strokeWidth="0.5" />
      <path
        d="M11 22 Q9 26 9 30"
        stroke="hsl(40 20% 30%)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
      <defs>
        <linearGradient id="bottleGrad" x1="8" y1="12" x2="32" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(42 54% 50%)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="hsl(28 40% 30%)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
    </svg>
  );
}
