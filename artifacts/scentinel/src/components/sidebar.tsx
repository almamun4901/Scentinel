import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";

interface SidebarProps {
  ownedFragrances: string[];
  activeSection: string;
  onSectionChange: (s: string) => void;
  onOpenOnboarding: () => void;
  onClose?: () => void;
  recentChats?: string[];
  wishlistCount?: number;
  onHomeClick?: () => void;
}

const NAV_DISCOVER = [
  {
    id: "chat",
    label: "Chat",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: "discover",
    label: "Discover",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
      </svg>
    ),
  },
  {
    id: "explore",
    label: "Explore",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    id: "similar",
    label: "Similar",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
        <path d="M12 12h.01" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "dupes",
    label: "Dupes",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    ),
  },
];

const NAV_MY_SCENTS = [
  {
    id: "collection",
    label: "Collection",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    id: "wishlist",
    label: "Wishlist",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

function InitialsDot({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono shrink-0"
      title={name}
      style={{ background: "hsl(34 17% 14%)", color: "hsl(40 15% 60%)", border: "1px solid hsl(34 10% 20%)" }}
    >
      {initials}
    </div>
  );
}

function NavItem({
  item,
  active,
  expanded,
  badge,
  onClick,
}: {
  item: { id: string; label: string; icon: React.ReactNode };
  active: boolean;
  expanded: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={`nav-${item.id}`}
      onClick={onClick}
      title={!expanded ? item.label : undefined}
      className="relative w-full flex items-center rounded-lg transition-all duration-200"
      style={{
        padding: expanded ? "8px 12px" : "10px 0",
        justifyContent: expanded ? "flex-start" : "center",
        gap: expanded ? 10 : 0,
        background: active ? "rgba(196,154,60,0.10)" : "transparent",
        color: active ? "hsl(42 54% 58%)" : "hsl(40 10% 46%)",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(196,154,60,0.05)";
        (e.currentTarget as HTMLButtonElement).style.color = active ? "hsl(42 54% 62%)" : "hsl(40 10% 62%)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color = active ? "hsl(42 54% 58%)" : "hsl(40 10% 46%)";
      }}
    >
      {/* Active indicator */}
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
          style={{ width: 3, height: 18, background: "hsl(42 54% 50%)" }}
        />
      )}

      <span
        style={{
          opacity: active ? 1 : 0.65,
          flexShrink: 0,
          display: "flex",
          transition: "opacity 0.2s",
        }}
      >
        {item.icon}
      </span>

      {/* Label — slides in when expanded */}
      <span
        className="text-sm font-sans whitespace-nowrap overflow-hidden transition-all duration-300"
        style={{
          maxWidth: expanded ? 140 : 0,
          opacity: expanded ? 1 : 0,
          transitionProperty: "max-width, opacity",
          transitionDuration: expanded ? "250ms, 200ms" : "200ms, 100ms",
          transitionDelay: expanded ? "50ms, 80ms" : "0ms, 0ms",
        }}
      >
        {item.label}
      </span>

      {/* Badge */}
      {badge != null && badge > 0 && expanded && (
        <span
          className="ml-auto text-xs font-mono px-1.5 py-0.5 rounded-full transition-all duration-200"
          style={{
            background: "hsl(42 54% 50% / 0.15)",
            color: "hsl(42 54% 60%)",
            opacity: expanded ? 1 : 0,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export function SidebarContent({
  ownedFragrances,
  activeSection,
  onSectionChange,
  onOpenOnboarding,
  onClose,
  recentChats = [],
  wishlistCount = 0,
  onHomeClick,
  expanded = true,
}: SidebarProps & { expanded?: boolean }) {
  const { isAuthenticated, login, logout, isLoading } = useAuth();

  const handleNav = (id: string) => { onSectionChange(id); onClose?.(); };
  const handleLogoClick = () => { onHomeClick?.(); onClose?.(); };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ padding: "20px 8px 16px" }}>

      {/* Logo */}
      <button
        onClick={handleLogoClick}
        className="flex items-center rounded-lg mb-6 transition-all duration-200"
        style={{
          padding: expanded ? "6px 8px" : "6px 0",
          justifyContent: expanded ? "flex-start" : "center",
          gap: 10,
          cursor: onHomeClick ? "pointer" : "default",
          minHeight: 44,
        }}
        onMouseEnter={(e) => {
          if (onHomeClick) (e.currentTarget as HTMLButtonElement).style.background = "rgba(196,154,60,0.04)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }}
      >
        {/* Icon mark — always visible */}
        <div
          className="shrink-0 flex items-center justify-center rounded-md font-serif"
          style={{
            width: 32,
            height: 32,
            background: "rgba(196,154,60,0.12)",
            border: "1px solid rgba(196,154,60,0.25)",
            color: "hsl(42 54% 58%)",
            fontSize: 17,
            letterSpacing: "0.05em",
          }}
        >
          S
        </div>

        {/* Text — fades in */}
        <div
          className="overflow-hidden transition-all duration-300"
          style={{
            maxWidth: expanded ? 160 : 0,
            opacity: expanded ? 1 : 0,
            transitionDelay: expanded ? "60ms" : "0ms",
          }}
        >
          <p className="font-serif text-base whitespace-nowrap leading-tight" style={{ color: "hsl(42 54% 58%)", letterSpacing: "0.1em" }}>
            Scen<span style={{ color: "hsl(40 10% 38%)", fontWeight: 300 }}>tinel</span>
          </p>
          <p className="text-xs whitespace-nowrap mt-0.5" style={{ color: "hsl(40 10% 30%)" }}>
            Fragrance Intelligence
          </p>
        </div>
      </button>

      {/* Divider */}
      <div className="mb-3" style={{ height: 1, background: "hsl(34 10% 11%)", margin: "0 4px 12px" }} />

      {/* DISCOVER section */}
      <div className="mb-1">
        <div
          className="overflow-hidden transition-all duration-200"
          style={{
            maxHeight: expanded ? 24 : 0,
            opacity: expanded ? 1 : 0,
            marginBottom: expanded ? 4 : 0,
            transitionDelay: expanded ? "40ms" : "0ms",
          }}
        >
          <p className="text-xs font-mono px-3 whitespace-nowrap" style={{ color: "hsl(40 10% 28%)", letterSpacing: "0.1em" }}>
            DISCOVER
          </p>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV_DISCOVER.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              active={activeSection === item.id}
              expanded={expanded}
              onClick={() => handleNav(item.id)}
            />
          ))}
        </nav>
      </div>

      {/* MY SCENTS section */}
      <div className="mt-3">
        <div
          className="overflow-hidden transition-all duration-200"
          style={{
            maxHeight: expanded ? 24 : 0,
            opacity: expanded ? 1 : 0,
            marginBottom: expanded ? 4 : 0,
            transitionDelay: expanded ? "40ms" : "0ms",
          }}
        >
          <p className="text-xs font-mono px-3 whitespace-nowrap" style={{ color: "hsl(40 10% 28%)", letterSpacing: "0.1em" }}>
            MY SCENTS
          </p>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV_MY_SCENTS.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              active={activeSection === item.id}
              expanded={expanded}
              badge={item.id === "wishlist" ? wishlistCount : undefined}
              onClick={() => handleNav(item.id)}
            />
          ))}
        </nav>
      </div>

      {/* Contextual panel — only when expanded */}
      <div
        className="flex-1 overflow-hidden transition-all duration-200 mt-4"
        style={{
          opacity: expanded ? 1 : 0,
          transitionDelay: expanded ? "100ms" : "0ms",
          pointerEvents: expanded ? "auto" : "none",
        }}
      >
        {activeSection === "chat" && recentChats.length > 0 && (
          <>
            <p className="text-xs px-3 mb-2 font-mono tracking-widest whitespace-nowrap" style={{ color: "hsl(40 10% 28%)" }}>
              RECENT
            </p>
            <div className="flex flex-col gap-0.5">
              {recentChats.slice(0, 5).map((q, i) => (
                <div key={i} className="px-3 py-1.5 rounded text-xs leading-snug truncate" style={{ color: "hsl(40 10% 38%)" }} title={q}>
                  {q}
                </div>
              ))}
            </div>
          </>
        )}

        {(activeSection === "explore" || activeSection === "discover" || activeSection === "similar" || activeSection === "dupes" || activeSection === "collection") && (
          <>
            <div className="flex items-center justify-between mb-2 px-3">
              <p className="text-xs font-mono tracking-widest whitespace-nowrap" style={{ color: "hsl(40 10% 28%)" }}>
                COLLECTION
              </p>
              <button
                onClick={() => { onOpenOnboarding(); onClose?.(); }}
                className="text-xs transition-colors whitespace-nowrap"
                style={{ color: "hsl(42 54% 42%)" }}
              >
                Edit
              </button>
            </div>
            {ownedFragrances.length === 0 ? (
              <p className="px-3 text-xs" style={{ color: "hsl(40 10% 26%)" }}>No fragrances added</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 px-3">
                {ownedFragrances.map((f) => <InitialsDot key={f} name={f} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Auth — bottom */}
      <div
        className="mt-4 overflow-hidden transition-all duration-200"
        style={{
          opacity: expanded ? 1 : 0,
          maxHeight: expanded ? 40 : 0,
          transitionDelay: expanded ? "80ms" : "0ms",
          pointerEvents: expanded ? "auto" : "none",
        }}
      >
        <div style={{ padding: "0 12px" }}>
          {!isLoading && (
            isAuthenticated ? (
              <button
                data-testid="btn-logout"
                onClick={logout}
                className="w-full text-left text-xs py-1 transition-colors whitespace-nowrap"
                style={{ color: "hsl(40 10% 36%)" }}
              >
                Sign out
              </button>
            ) : (
              <button
                data-testid="btn-login"
                onClick={login}
                className="w-full text-left text-xs py-1 transition-colors whitespace-nowrap"
                style={{ color: "hsl(42 54% 42%)" }}
              >
                Sign in
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="hidden md:block shrink-0 relative" style={{ width: 56 }}>
      <aside
        className="absolute inset-y-0 left-0 flex flex-col overflow-hidden"
        style={{
          width: expanded ? 220 : 56,
          borderRight: "1px solid hsl(34 10% 11%)",
          background: expanded ? "hsl(28 16% 4%)" : "hsl(30 14% 3%)",
          boxShadow: expanded ? "4px 0 24px rgba(0,0,0,0.5)" : "none",
          transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1), background 300ms ease, box-shadow 300ms ease",
          zIndex: 20,
        }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <SidebarContent {...props} expanded={expanded} />
      </aside>
    </div>
  );
}
