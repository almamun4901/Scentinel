import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Menu, ArrowLeft } from "lucide-react";
import {
  useFindDupes,
  useGetContextRecommendations,
  useGetBlindBuyScore,
  useGetProfile,
  useGetWeather,
  getGetWeatherQueryKey,
} from "@workspace/api-client-react";
import { SearchBar } from "@/components/search-bar";
import { FragranceHero } from "@/components/fragrance-hero";
import { DupesSection } from "@/components/dupes-section";
import { ContextPicks } from "@/components/context-picks";
import { BlindBuyScorer } from "@/components/blind-buy-scorer";
import { Sidebar, SidebarContent } from "@/components/sidebar";
import { OnboardingModal } from "@/components/onboarding-modal";
import { WishlistPage } from "@/components/wishlist-page";
import { SemanticSearchView } from "@/components/semantic-search-view";
import { ShootingStars } from "@/components/shooting-stars";
import { SplashScreen, shouldShowSplash } from "@/components/splash-screen";
import { InfiniteMovingCards, type FragranceCardItem } from "@/components/ui/infinite-moving-cards";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import ChatPage from "@/pages/chat";
import { useWishlist } from "@/hooks/use-wishlist";
import {
  Fragrance,
  DupeResult,
  ContextPick,
  BlindBuyScore,
  UserProfile,
} from "@/types";

export default function Home() {
  const [selectedFragrance, setSelectedFragrance] = useState<Fragrance | null>(null);
  const [fragranceHistory, setFragranceHistory] = useState<Fragrance[]>([]);
  const selectedFragranceRef = useRef<Fragrance | null>(null);
  selectedFragranceRef.current = selectedFragrance;
  const [dupes, setDupes] = useState<DupeResult[] | null>(null);
  const [contextPicks, setContextPicks] = useState<ContextPick[] | null>(null);
  const [blindBuyScore, setBlindBuyScore] = useState<BlindBuyScore | null>(null);
  const [showSplash, setShowSplash] = useState(() => shouldShowSplash());
  const [activeSection, setActiveSection] = useState("explore");
  const [slideDir, setSlideDir] = useState<"right" | "left" | null>(null);
  const [occasion, setOccasion] = useState("casual");
  const [timeOfDay, setTimeOfDay] = useState("daytime");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [recentChats, setRecentChats] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("scentinel-recent-chats") ?? "[]"); } catch { return []; }
  });
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem("scentinel-onboarding-done") === "1"
  );

  const { items: wishlistItems, add: addToWishlist, remove: removeFromWishlist, isWishlisted } = useWishlist();

  const { data: profileData, refetch: refetchProfile } = useGetProfile({
    query: { queryKey: ["profile"] },
  });
  const profile: UserProfile = profileData ?? { ownedFragrances: [], budget: null };

  const weatherParams = { lat: "51.5", lon: "-0.12" };
  const { data: weatherData } = useGetWeather(weatherParams, {
    query: { queryKey: getGetWeatherQueryKey(weatherParams) },
  });
  const weatherTemp = weatherData?.temp_c ?? 18;
  const weatherDesc = weatherData?.description ?? "partly cloudy";

  useEffect(() => {
    if (!onboardingDismissed) setShowOnboarding(true);
  }, [onboardingDismissed]);

  const dupesMutation = useFindDupes();
  const contextMutation = useGetContextRecommendations();
  const scoreMutation = useGetBlindBuyScore();

  const handleFragranceSelect = useCallback(
    (fragrance: Fragrance, addToHistory = true) => {
      if (addToHistory && selectedFragranceRef.current) {
        setFragranceHistory((prev) => [...prev, selectedFragranceRef.current!]);
      }
      setSelectedFragrance(fragrance);
      setDupes(null);
      setContextPicks(null);
      setBlindBuyScore(null);
      if (activeSection === "discover") { setSlideDir("right"); setActiveSection("explore"); }

      const ownedFragrances = profile.ownedFragrances ?? [];

      dupesMutation.mutate(
        { data: { fragranceName: fragrance.name } },
        { onSuccess: (data) => setDupes(data as DupeResult[]) }
      );
      contextMutation.mutate(
        { data: { fragranceName: fragrance.name, weatherTemp, weatherDesc, occasion, timeOfDay, ownedFragrances } },
        { onSuccess: (data) => setContextPicks(data as ContextPick[]) }
      );
      scoreMutation.mutate(
        { data: { fragranceName: fragrance.name, ownedFragrances, budget: profile.budget ? parseBudget(profile.budget) : null } },
        { onSuccess: (data) => setBlindBuyScore(data as BlindBuyScore) }
      );
    },
    [profile, occasion, timeOfDay, weatherTemp, weatherDesc, activeSection, dupesMutation, contextMutation, scoreMutation]
  );

  const handleBack = useCallback(() => {
    if (fragranceHistory.length === 0) return;
    const prev = fragranceHistory[fragranceHistory.length - 1];
    setFragranceHistory((h) => h.slice(0, -1));
    handleFragranceSelect(prev, false);
  }, [fragranceHistory, handleFragranceSelect]);

  const handleDupeSelect = useCallback(async (name: string, house: string) => {
    try {
      const q = encodeURIComponent(name);
      const res = await fetch(`${import.meta.env.BASE_URL}api/search?q=${q}`);
      const data = (await res.json()) as Fragrance[];
      if (data.length > 0) handleFragranceSelect(data[0]);
    } catch { /* ignore */ }
  }, [handleFragranceSelect]);

  const NAV_ORDER = ["chat", "discover", "explore", "dupes", "collection", "wishlist"];

  const handleSectionChange = useCallback((section: string) => {
    if (section === activeSection) return;
    const prevIdx = NAV_ORDER.indexOf(activeSection);
    const nextIdx = NAV_ORDER.indexOf(section);
    setSlideDir(nextIdx >= prevIdx ? "right" : "left");
    setActiveSection(section);
  }, [activeSection]); // eslint-disable-line

  const handleHomeClick = useCallback(() => {
    setSlideDir("left");
    setSelectedFragrance(null);
    setFragranceHistory([]);
    setDupes(null);
    setContextPicks(null);
    setBlindBuyScore(null);
    setActiveSection("explore");
  }, []);

  const handleOnboardingComplete = (_p: { ownedFragrances: string[]; budget: string | null }) => {
    localStorage.setItem("scentinel-onboarding-done", "1");
    setOnboardingDismissed(true);
    setShowOnboarding(false);
    refetchProfile();
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem("scentinel-onboarding-done", "1");
    setOnboardingDismissed(true);
    setShowOnboarding(false);
  };

  const handleChatMessageSent = useCallback((message: string) => {
    setRecentChats((prev) => {
      const next = [message, ...prev.filter((m) => m !== message)].slice(0, 8);
      localStorage.setItem("scentinel-recent-chats", JSON.stringify(next));
      return next;
    });
  }, []);

  const sidebarProps = {
    ownedFragrances: profile.ownedFragrances,
    activeSection,
    onSectionChange: handleSectionChange,
    onOpenOnboarding: () => setShowOnboarding(true),
    recentChats,
    wishlistCount: wishlistItems.length,
    onHomeClick: handleHomeClick,
  };

  const isChat = activeSection === "chat";
  const isWishlist = activeSection === "wishlist";
  const isDiscover = activeSection === "discover";
  const isExplore = !isChat && !isWishlist && !isDiscover;

  return (
    <div className="flex h-screen overflow-hidden relative" style={{ background: "hsl(30 14% 3%)" }}>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      {!showSplash && <ShootingStars minSpeed={1.5} maxSpeed={4} minDelay={1500} maxDelay={5500} />}
      <div className="relative flex flex-1 overflow-hidden" style={{ zIndex: 1 }}>
      <Sidebar {...sidebarProps} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div
          key={activeSection}
          className={[
            "flex-1 flex flex-col overflow-hidden",
            slideDir === "right" ? "slide-from-right" : slideDir === "left" ? "slide-from-left" : "",
          ].filter(Boolean).join(" ")}
        >
        {/* Top bar */}
        {!isChat && !isWishlist && !isDiscover && (
          <header
            className="shrink-0 flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 border-b"
            style={{ borderColor: "hsl(34 10% 12%)" }}
          >
            <button
              className="md:hidden shrink-0 p-1.5 rounded transition-colors"
              style={{ color: "hsl(40 10% 48%)" }}
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            {/* Back button — shown when there's history */}
            {fragranceHistory.length > 0 ? (
              <button
                onClick={handleBack}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs transition-all hover:border-amber-700/50"
                style={{
                  borderColor: "hsl(34 10% 18%)",
                  color: "hsl(40 10% 58%)",
                  background: "hsl(34 12% 8%)",
                  maxWidth: 140,
                }}
                title={`Back to ${fragranceHistory[fragranceHistory.length - 1].name}`}
              >
                <ArrowLeft size={12} />
                <span className="truncate font-sans">
                  {fragranceHistory[fragranceHistory.length - 1].name}
                </span>
              </button>
            ) : (
              <div className="md:hidden shrink-0 mr-1">
                <span className="font-serif text-lg tracking-wide" style={{ color: "hsl(42 54% 55%)" }}>
                  Scentinel
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <SearchBar onSelect={handleFragranceSelect} />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className="text-xs px-2 py-1.5 rounded border font-mono"
                style={{ borderColor: "hsl(34 10% 18%)", color: "hsl(40 10% 48%)", background: "hsl(34 12% 9%)" }}
              >
                {weatherTemp}°C
              </div>
              <div
                className="hidden sm:block text-xs px-2.5 py-1.5 rounded border capitalize"
                style={{ borderColor: "hsl(34 10% 18%)", color: "hsl(40 10% 48%)", background: "hsl(34 12% 9%)" }}
              >
                {weatherDesc}
              </div>
            </div>
          </header>
        )}

        {/* Chat top bar */}
        {isChat && (
          <header
            className="shrink-0 flex items-center gap-3 px-5 py-3 border-b"
            style={{ borderColor: "hsl(34 10% 12%)" }}
          >
            <button
              className="md:hidden shrink-0 p-1.5 rounded"
              style={{ color: "hsl(40 10% 48%)" }}
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <p className="font-serif flex-1" style={{ fontSize: 17, color: "hsl(40 20% 80%)" }}>
              Ask Scentinel anything
            </p>
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs"
                style={{ background: "hsl(34 12% 9%)", borderColor: "hsl(34 10% 16%)", color: "hsl(40 10% 48%)" }}
              >
                <span className="rounded-full" style={{ width: 5, height: 5, background: "#7ab866" }} />
                {weatherTemp}°C · {weatherDesc}
              </div>
              {profile.ownedFragrances.length > 0 && (
                <div
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs"
                  style={{ background: "hsl(34 12% 9%)", borderColor: "hsl(34 10% 16%)", color: "hsl(40 10% 48%)" }}
                >
                  <span className="rounded-full" style={{ width: 5, height: 5, background: "hsl(174 50% 40%)" }} />
                  {profile.ownedFragrances.length} in collection
                </div>
              )}
            </div>
          </header>
        )}

        {/* Wishlist / Discover top bar */}
        {(isWishlist || isDiscover) && (
          <header
            className="shrink-0 flex items-center gap-3 px-5 py-3 border-b"
            style={{ borderColor: "hsl(34 10% 12%)" }}
          >
            <button
              className="md:hidden shrink-0 p-1.5 rounded"
              style={{ color: "hsl(40 10% 48%)" }}
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <p className="font-serif flex-1" style={{ fontSize: 17, color: "hsl(40 20% 80%)" }}>
              {isWishlist ? "Wishlist" : "Discover"}
            </p>
            <div
              className="text-xs px-2 py-1.5 rounded border font-mono"
              style={{ borderColor: "hsl(34 10% 18%)", color: "hsl(40 10% 48%)", background: "hsl(34 12% 9%)" }}
            >
              {weatherTemp}°C
            </div>
          </header>
        )}

        {/* Content */}
        {isChat ? (
          <ChatPage
            profile={profile}
            weatherTemp={weatherTemp}
            weatherDesc={weatherDesc}
            onMessageSent={handleChatMessageSent}
          />
        ) : isWishlist ? (
          <WishlistPage />
        ) : isDiscover ? (
          <SemanticSearchView onSelectFragrance={handleFragranceSelect} />
        ) : (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            {!selectedFragrance ? (
              <EmptyState onSelect={handleFragranceSelect} />
            ) : (
              <div className="max-w-3xl">
                <FragranceHero
                  fragrance={selectedFragrance}
                  isWishlisted={isWishlisted(selectedFragrance.id)}
                  onToggleWishlist={() => {
                    if (isWishlisted(selectedFragrance.id)) {
                      removeFromWishlist(selectedFragrance.id);
                    } else {
                      addToWishlist(selectedFragrance);
                    }
                  }}
                />
                <DupesSection dupes={dupes} isLoading={dupesMutation.isPending} onSelect={handleDupeSelect} />
                <ContextPicks
                  picks={contextPicks}
                  isLoading={contextMutation.isPending}
                  weatherTemp={weatherTemp}
                  weatherDesc={weatherDesc}
                  occasion={occasion}
                  timeOfDay={timeOfDay}
                  onOccasionChange={(v) => {
                    setOccasion(v);
                    if (selectedFragrance) {
                      contextMutation.mutate(
                        { data: { fragranceName: selectedFragrance.name, weatherTemp, weatherDesc, occasion: v, timeOfDay, ownedFragrances: profile.ownedFragrances } },
                        { onSuccess: (data) => setContextPicks(data as ContextPick[]) }
                      );
                    }
                  }}
                  onTimeOfDayChange={(v) => {
                    setTimeOfDay(v);
                    if (selectedFragrance) {
                      contextMutation.mutate(
                        { data: { fragranceName: selectedFragrance.name, weatherTemp, weatherDesc, occasion, timeOfDay: v, ownedFragrances: profile.ownedFragrances } },
                        { onSuccess: (data) => setContextPicks(data as ContextPick[]) }
                      );
                    }
                  }}
                />
                <div className="xl:hidden mb-6">
                  <BlindBuyScorer inline score={blindBuyScore} isLoading={scoreMutation.isPending} fragranceName={selectedFragrance?.name} />
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </main>

      {/* Right panel — Blind Buy Scorer */}
      {isExplore && (
        <aside
          className="hidden xl:flex w-[280px] shrink-0 flex-col py-6 px-5 overflow-y-auto"
          style={{ borderLeft: "1px solid hsl(34 10% 12%)" }}
        >
          <BlindBuyScorer score={blindBuyScore} isLoading={scoreMutation.isPending} fragranceName={selectedFragrance?.name} />
        </aside>
      )}

      {/* Mobile Sidebar */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent
          side="left"
          className="p-0 border-r"
          style={{ background: "hsl(30 14% 3%)", borderColor: "hsl(34 10% 12%)", width: 240 }}
        >
          <SidebarContent {...sidebarProps} onClose={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <OnboardingModal
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
      </div>
    </div>
  );
}

function parseBudget(budget: string | null): number | null {
  if (!budget) return null;
  const map: Record<string, number> = { under_50: 50, "50_150": 150, "150_300": 300, no_limit: 9999 };
  return map[budget] ?? null;
}

const ALL_SUGGESTIONS = [
  { name: "Aventus", house: "Creed" },
  { name: "Sauvage EDP", house: "Dior" },
  { name: "Oud Wood", house: "Tom Ford" },
  { name: "Layton", house: "Parfums de Marly" },
  { name: "Baccarat Rouge 540", house: "MFK" },
  { name: "Tobacco Vanille", house: "Tom Ford" },
  { name: "Bleu de Chanel EDP", house: "Chanel" },
  { name: "Jubilation XXV", house: "Amouage" },
  { name: "Oud for Greatness", house: "Initio" },
  { name: "Naxos", house: "Xerjoff" },
  { name: "Jazz Club", house: "Maison Margiela" },
  { name: "Santal 33", house: "Le Labo" },
  { name: "Bal d'Afrique", house: "Byredo" },
  { name: "Wood Sage & Sea Salt", house: "Jo Malone" },
  { name: "Irish Leather", house: "Memo Paris" },
  { name: "Acqua di Gio Profondo", house: "Giorgio Armani" },
  { name: "Interlude Man", house: "Amouage" },
  { name: "Percival", house: "Parfums de Marly" },
  { name: "Side Effect", house: "Initio" },
  { name: "Libre EDP", house: "YSL" },
  { name: "Black Orchid", house: "Tom Ford" },
  { name: "Spicebomb Extreme", house: "Viktor & Rolf" },
  { name: "Explorer", house: "Montblanc" },
  { name: "Invictus Platinum", house: "Paco Rabanne" },
];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const ROW_ONE: FragranceCardItem[] = [
  { name: "Aventus", house: "Creed", accords: ["fruity", "woody", "smoky"], notes: ["Blackcurrant", "Bergamot", "Birch"], season: "spring", seasonColor: "#7ba864", year: 2010 },
  { name: "Sauvage EDP", house: "Dior", accords: ["spicy", "aromatic", "woody"], notes: ["Pepper", "Lavender", "Ambroxan"], season: "fall", seasonColor: "#c4703c", year: 2018 },
  { name: "Oud Wood", house: "Tom Ford", accords: ["woody", "oud", "spicy"], notes: ["Oud", "Rosewood", "Cardamom"], season: "winter", seasonColor: "#4a9fb5", year: 2007 },
  { name: "Bleu de Chanel EDP", house: "Chanel", accords: ["woody", "aromatic", "fresh"], notes: ["Citrus", "Labdanum", "Sandalwood"], season: "all year", seasonColor: "#c4923c", year: 2014 },
  { name: "Layton", house: "Parfums de Marly", accords: ["spicy", "sweet", "vanilla"], notes: ["Apple", "Cardamom", "Vanilla"], season: "fall", seasonColor: "#c4703c", year: 2016 },
  { name: "Interlude Man", house: "Amouage", accords: ["spicy", "smoky", "oriental"], notes: ["Oregano", "Amber", "Oud"], season: "winter", seasonColor: "#4a9fb5", year: 2012 },
  { name: "Naxos", house: "Xerjoff", accords: ["sweet", "vanilla", "lavender"], notes: ["Lavender", "Tonka Bean", "Honey"], season: "summer", seasonColor: "#e4c04a", year: 2019 },
  { name: "Tobacco Vanille", house: "Tom Ford", accords: ["sweet", "spicy", "vanilla"], notes: ["Tobacco", "Vanilla", "Tonka Bean"], season: "winter", seasonColor: "#4a9fb5", year: 2007 },
  { name: "Y EDP", house: "YSL", accords: ["fresh", "spicy", "woody"], notes: ["Bergamot", "Sage", "Amberwood"], season: "spring", seasonColor: "#7ba864", year: 2017 },
];

const ROW_TWO: FragranceCardItem[] = [
  { name: "Club de Nuit Intense Man", house: "Armaf", accords: ["fruity", "woody", "smoky"], notes: ["Blackcurrant", "Birch", "Musk"], season: "spring", seasonColor: "#7ba864", year: 2015 },
  { name: "Jazz Club", house: "Maison Margiela", accords: ["spicy", "sweet", "woody"], notes: ["Rum", "Tobacco", "Vetiver"], season: "fall", seasonColor: "#c4703c", year: 2013 },
  { name: "Acqua di Gio Profondo", house: "Giorgio Armani", accords: ["aquatic", "fresh", "mineral"], notes: ["Bergamot", "Sea Notes", "Patchouli"], season: "summer", seasonColor: "#e4c04a", year: 2021 },
  { name: "Santal 33", house: "Le Labo", accords: ["woody", "earthy", "spicy"], notes: ["Sandalwood", "Cedarwood", "Cardamom"], season: "all year", seasonColor: "#c4923c", year: 2011 },
  { name: "Oud for Greatness", house: "Initio", accords: ["oud", "spicy", "smoky"], notes: ["Oud", "Saffron", "Musk"], season: "winter", seasonColor: "#4a9fb5", year: 2018 },
  { name: "Bal d'Afrique", house: "Byredo", accords: ["floral", "woody", "citrus"], notes: ["Marigold", "Violet", "Vetiver"], season: "summer", seasonColor: "#e4c04a", year: 2009 },
  { name: "Wood Sage & Sea Salt", house: "Jo Malone", accords: ["aromatic", "aquatic", "earthy"], notes: ["Sea Salt", "Sage", "Ambrette"], season: "spring", seasonColor: "#7ba864", year: 2014 },
  { name: "Invictus Platinum", house: "Paco Rabanne", accords: ["fresh", "woody", "spicy"], notes: ["Grapefruit", "Cardamom", "Vetiver"], season: "spring", seasonColor: "#7ba864", year: 2021 },
  { name: "Percival", house: "Parfums de Marly", accords: ["aromatic", "sweet", "spicy"], notes: ["Cinnamon", "Lavender", "Musk"], season: "fall", seasonColor: "#c4703c", year: 2020 },
];

function EmptyState({ onSelect }: { onSelect: (f: Fragrance) => void }) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const handleCardSelect = async (item: FragranceCardItem) => {
    const key = `${item.house}-${item.name}`;
    if (loadingKey) return;
    setLoadingKey(key);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/search?q=${encodeURIComponent(item.name)}`);
      const data = await res.json() as Fragrance[];
      if (data.length > 0) onSelect(data[0]);
    } catch { /* ignore */ } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
      <div className="px-4 mb-10">
        <h2 className="font-serif text-3xl sm:text-4xl mb-3 leading-tight" style={{ color: "hsl(40 15% 55%)" }}>
          What are you wearing tonight?
        </h2>
        <p className="text-sm max-w-sm mx-auto" style={{ color: "hsl(40 10% 35%)" }}>
          Click any fragrance below or search above to explore alternatives, context picks, and blind buy risk.
        </p>
      </div>

      <div className="w-full flex flex-col gap-3 overflow-hidden">
        <InfiniteMovingCards
          items={ROW_ONE}
          direction="left"
          speed="slow"
          onSelect={handleCardSelect}
        />
        <InfiniteMovingCards
          items={ROW_TWO}
          direction="right"
          speed="slow"
          onSelect={handleCardSelect}
        />
      </div>

      {loadingKey && (
        <p className="mt-6 text-xs font-mono" style={{ color: "hsl(42 54% 50%)" }}>
          Loading profile…
        </p>
      )}
    </div>
  );
}
