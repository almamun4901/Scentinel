import { useAuth } from "@workspace/replit-auth-web";

interface SidebarProps {
  ownedFragrances: string[];
  activeSection: string;
  onSectionChange: (s: string) => void;
  onOpenOnboarding: () => void;
  onClose?: () => void;
}

const NAV_ITEMS = [
  { id: "explore", label: "Explore" },
  { id: "dupes", label: "Dupes" },
  { id: "collection", label: "Collection" },
];

function InitialsDot({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
}: SidebarProps) {
  const { isAuthenticated, login, logout, isLoading } = useAuth();

  const handleNav = (id: string) => {
    onSectionChange(id);
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full py-6 pr-4 pl-5">
      {/* Logo */}
      <div className="mb-8 px-2">
        <h1 className="font-serif text-2xl tracking-wide" style={{ color: "hsl(42 54% 55%)" }}>
          Scentinel
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "hsl(40 10% 35%)" }}>
          Fragrance Intelligence
        </p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 mb-8">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            data-testid={`nav-${item.id}`}
            onClick={() => handleNav(item.id)}
            className="text-left px-3 py-2 rounded text-sm transition-all"
            style={{
              background: activeSection === item.id ? "hsl(34 17% 11%)" : "transparent",
              color: activeSection === item.id ? "hsl(40 20% 88%)" : "hsl(40 10% 48%)",
              borderLeft: activeSection === item.id ? "2px solid hsl(42 54% 50%)" : "2px solid transparent",
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Collection preview */}
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between mb-2 px-2">
          <p className="text-xs font-mono tracking-widest" style={{ color: "hsl(40 10% 35%)" }}>
            COLLECTION
          </p>
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
          <p className="px-2 text-xs" style={{ color: "hsl(40 10% 30%)" }}>
            No fragrances added
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 px-2">
            {ownedFragrances.map((f) => (
              <InitialsDot key={f} name={f} />
            ))}
          </div>
        )}
      </div>

      {/* Auth */}
      <div className="mt-4 px-2">
        {!isLoading && (
          isAuthenticated ? (
            <button
              data-testid="btn-logout"
              onClick={logout}
              className="w-full text-left text-xs transition-colors py-1"
              style={{ color: "hsl(40 10% 38%)" }}
            >
              Sign out
            </button>
          ) : (
            <button
              data-testid="btn-login"
              onClick={login}
              className="w-full text-left text-xs transition-colors py-1"
              style={{ color: "hsl(42 54% 45%)" }}
            >
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
    <aside
      className="hidden md:flex w-[200px] shrink-0 flex-col"
      style={{ borderRight: "1px solid hsl(34 10% 12%)" }}
    >
      <SidebarContent {...props} />
    </aside>
  );
}
