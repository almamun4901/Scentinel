import { useAuth } from "@workspace/replit-auth-web";
import type { WishlistItem } from "@/hooks/use-wishlist";

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
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: "discover",
    label: "Discover",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
      </svg>
    ),
  },
  {
    id: "explore",
    label: "Explore",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    id: "dupes",
    label: "Dupes",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
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
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    id: "wishlist",
    label: "Wishlist",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
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

export function SidebarContent({
  ownedFragrances,
  activeSection,
  onSectionChange,
  onOpenOnboarding,
  onClose,
  recentChats = [],
  wishlistCount = 0,
  onHomeClick,
}: SidebarProps) {
  const { isAuthenticated, login, logout, isLoading } = useAuth();

  const handleNav = (id: string) => { onSectionChange(id); onClose?.(); };
  const handleLogoClick = () => { onHomeClick?.(); onClose?.(); };

  const navButton = (item: typeof NAV_DISCOVER[number], badge?: number) => {
    const active = activeSection === item.id;
    return (
      <button
        key={item.id}
        data-testid={`nav-${item.id}`}
        onClick={() => handleNav(item.id)}
        className="flex items-center gap-2 text-left px-3 py-2 rounded text-sm transition-all"
        style={{
          background: active ? "rgba(196,154,60,0.08)" : "transparent",
          color: active ? "hsl(42 54% 55%)" : "hsl(40 10% 48%)",
          borderLeft: active ? "2px solid hsl(42 54% 50%)" : "2px solid transparent",
        }}
      >
        <span style={{ opacity: active ? 1 : 0.6 }}>{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        {badge != null && badge > 0 && (
          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded-full"
            style={{ background: "hsl(42 54% 50% / 0.15)", color: "hsl(42 54% 60%)" }}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full py-6 pr-4 pl-5">
      {/* Logo */}
      <div className="mb-7 px-2">
        <button
          onClick={handleLogoClick}
          className="text-left group"
          style={{ cursor: onHomeClick ? "pointer" : "default" }}
        >
          <h1 className="font-serif text-2xl tracking-wide transition-opacity group-hover:opacity-80" style={{ color: "hsl(42 54% 55%)", letterSpacing: "0.12em" }}>
            Scen<span style={{ color: "hsl(40 10% 35%)", fontWeight: 300 }}>tinel</span>
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "hsl(40 10% 32%)" }}>Fragrance Intelligence</p>
        </button>
      </div>

      {/* Discover nav */}
      <nav className="flex flex-col gap-0.5 mb-2">
        <p className="text-xs px-2 mb-1" style={{ color: "hsl(40 10% 32%)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Discover
        </p>
        {NAV_DISCOVER.map((item) => navButton(item))}
      </nav>

      {/* My Scents nav */}
      <nav className="flex flex-col gap-0.5 mb-6">
        <p className="text-xs px-2 mb-1 mt-3" style={{ color: "hsl(40 10% 32%)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          My Scents
        </p>
        {NAV_MY_SCENTS.map((item) =>
          navButton(item, item.id === "wishlist" ? wishlistCount : undefined)
        )}
      </nav>

      {/* Contextual panel */}
      <div className="flex-1 overflow-hidden">
        {activeSection === "chat" && recentChats.length > 0 && (
          <>
            <p className="text-xs px-2 mb-2 font-mono tracking-widest" style={{ color: "hsl(40 10% 32%)" }}>RECENT</p>
            <div className="flex flex-col gap-0.5">
              {recentChats.slice(0, 5).map((q, i) => (
                <div key={i} className="px-2 py-1.5 rounded text-xs leading-snug truncate" style={{ color: "hsl(40 10% 38%)" }} title={q}>
                  {q}
                </div>
              ))}
            </div>
          </>
        )}

        {(activeSection === "explore" || activeSection === "discover" || activeSection === "dupes") && (
          <>
            <div className="flex items-center justify-between mb-2 px-2">
              <p className="text-xs font-mono tracking-widest" style={{ color: "hsl(40 10% 32%)" }}>COLLECTION</p>
              <button
                data-testid="btn-edit-collection"
                onClick={() => { onOpenOnboarding(); onClose?.(); }}
                className="text-xs transition-colors"
                style={{ color: "hsl(42 54% 45%)" }}
              >
                Edit
              </button>
            </div>
            {ownedFragrances.length === 0 ? (
              <p className="px-2 text-xs" style={{ color: "hsl(40 10% 28%)" }}>No fragrances added</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 px-2">
                {ownedFragrances.map((f) => <InitialsDot key={f} name={f} />)}
              </div>
            )}
          </>
        )}

        {activeSection === "collection" && (
          <>
            <div className="flex items-center justify-between mb-2 px-2">
              <p className="text-xs font-mono tracking-widest" style={{ color: "hsl(40 10% 32%)" }}>COLLECTION</p>
              <button
                onClick={() => { onOpenOnboarding(); onClose?.(); }}
                className="text-xs transition-colors"
                style={{ color: "hsl(42 54% 45%)" }}
              >
                Edit
              </button>
            </div>
            {ownedFragrances.length === 0 ? (
              <p className="px-2 text-xs" style={{ color: "hsl(40 10% 28%)" }}>No fragrances added</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 px-2">
                {ownedFragrances.map((f) => <InitialsDot key={f} name={f} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Auth */}
      <div className="mt-4 px-2">
        {!isLoading && (
          isAuthenticated ? (
            <button data-testid="btn-logout" onClick={logout} className="w-full text-left text-xs py-1 transition-colors" style={{ color: "hsl(40 10% 38%)" }}>
              Sign out
            </button>
          ) : (
            <button data-testid="btn-login" onClick={login} className="w-full text-left text-xs py-1 transition-colors" style={{ color: "hsl(42 54% 45%)" }}>
              Sign in
            </button>
          )
        )}
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="hidden md:flex w-[200px] shrink-0 flex-col" style={{ borderRight: "1px solid hsl(34 10% 12%)" }}>
      <SidebarContent {...props} />
    </aside>
  );
}
