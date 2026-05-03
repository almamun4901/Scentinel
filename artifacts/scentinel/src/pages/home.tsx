import { useState, useCallback, useEffect } from "react";
import { Menu } from "lucide-react";
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import ChatPage from "@/pages/chat";
import {
  Fragrance,
  DupeResult,
  ContextPick,
  BlindBuyScore,
  UserProfile,
} from "@/types";

export default function Home() {
  const [selectedFragrance, setSelectedFragrance] = useState<Fragrance | null>(null);
  const [dupes, setDupes] = useState<DupeResult[] | null>(null);
  const [contextPicks, setContextPicks] = useState<ContextPick[] | null>(null);
  const [blindBuyScore, setBlindBuyScore] = useState<BlindBuyScore | null>(null);
  const [activeSection, setActiveSection] = useState("explore");
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
    if (!onboardingDismissed) {
      setShowOnboarding(true);
    }
  }, [onboardingDismissed]);

  const dupesMutation = useFindDupes();
  const contextMutation = useGetContextRecommendations();
  const scoreMutation = useGetBlindBuyScore();

  const handleFragranceSelect = useCallback(
    (fragrance: Fragrance) => {
      setSelectedFragrance(fragrance);
      setDupes(null);
      setContextPicks(null);
      setBlindBuyScore(null);

      const ownedFragrances = profile.ownedFragrances ?? [];

      dupesMutation.mutate(
        { data: { fragranceName: fragrance.name } },
        { onSuccess: (data) => setDupes(data as DupeResult[]) }
      );

      contextMutation.mutate(
        {
          data: {
            fragranceName: fragrance.name,
            weatherTemp,
            weatherDesc,
            occasion,
            timeOfDay,
            ownedFragrances,
          },
        },
        { onSuccess: (data) => setContextPicks(data as ContextPick[]) }
      );

      scoreMutation.mutate(
        {
          data: {
            fragranceName: fragrance.name,
            ownedFragrances,
            budget: profile.budget ? parseBudget(profile.budget) : null,
          },
        },
        { onSuccess: (data) => setBlindBuyScore(data as BlindBuyScore) }
      );
    },
    [profile, occasion, timeOfDay, weatherTemp, weatherDesc, dupesMutation, contextMutation, scoreMutation]
  );

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
    onSectionChange: setActiveSection,
    onOpenOnboarding: () => setShowOnboarding(true),
    recentChats,
  };

  const isChat = activeSection === "chat";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "hsl(30 14% 3%)" }}>
      {/* Left Sidebar */}
      <Sidebar {...sidebarProps} />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar — hidden in chat mode (chat has its own context display) */}
        {!isChat && (
          <header
            className="shrink-0 flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 border-b"
            style={{ borderColor: "hsl(34 10% 12%)" }}
          >
            <button
              className="md:hidden shrink-0 p-1.5 rounded transition-colors"
              style={{ color: "hsl(40 10% 48%)" }}
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="md:hidden shrink-0 mr-1">
              <span className="font-serif text-lg tracking-wide" style={{ color: "hsl(42 54% 55%)" }}>
                Scentinel
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <SearchBar onSelect={handleFragranceSelect} />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className="text-xs px-2 py-1.5 rounded border font-mono"
                style={{
                  borderColor: "hsl(34 10% 18%)",
                  color: "hsl(40 10% 48%)",
                  background: "hsl(34 12% 9%)",
                }}
              >
                {weatherTemp}°C
              </div>
              <div
                className="hidden sm:block text-xs px-2.5 py-1.5 rounded border capitalize"
                style={{
                  borderColor: "hsl(34 10% 18%)",
                  color: "hsl(40 10% 48%)",
                  background: "hsl(34 12% 9%)",
                }}
              >
                {weatherDesc}
              </div>
            </div>
          </header>
        )}

        {/* Chat mode top bar */}
        {isChat && (
          <header
            className="shrink-0 flex items-center gap-3 px-5 py-3 border-b"
            style={{ borderColor: "hsl(34 10% 12%)" }}
          >
            <button
              className="md:hidden shrink-0 p-1.5 rounded"
              style={{ color: "hsl(40 10% 48%)" }}
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
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

        {/* Page content */}
        {isChat ? (
          <ChatPage
            profile={profile}
            weatherTemp={weatherTemp}
            weatherDesc={weatherDesc}
            onMessageSent={handleChatMessageSent}
          />
        ) : (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            {!selectedFragrance ? (
              <EmptyState onFragranceSelect={handleFragranceSelect} />
            ) : (
              <div className="max-w-3xl">
                <FragranceHero fragrance={selectedFragrance} />

                <DupesSection
                  dupes={dupes}
                  isLoading={dupesMutation.isPending}
                />

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
                        {
                          data: {
                            fragranceName: selectedFragrance.name,
                            weatherTemp,
                            weatherDesc,
                            occasion: v,
                            timeOfDay,
                            ownedFragrances: profile.ownedFragrances,
                          },
                        },
                        { onSuccess: (data) => setContextPicks(data as ContextPick[]) }
                      );
                    }
                  }}
                  onTimeOfDayChange={(v) => {
                    setTimeOfDay(v);
                    if (selectedFragrance) {
                      contextMutation.mutate(
                        {
                          data: {
                            fragranceName: selectedFragrance.name,
                            weatherTemp,
                            weatherDesc,
                            occasion,
                            timeOfDay: v,
                            ownedFragrances: profile.ownedFragrances,
                          },
                        },
                        { onSuccess: (data) => setContextPicks(data as ContextPick[]) }
                      );
                    }
                  }}
                />

                <div className="xl:hidden mb-6">
                  <BlindBuyScorer
                    inline
                    score={blindBuyScore}
                    isLoading={scoreMutation.isPending}
                    fragranceName={selectedFragrance?.name}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Right panel — Blind Buy Scorer, only on xl+ and not in chat mode */}
      {!isChat && (
        <aside
          className="hidden xl:flex w-[280px] shrink-0 flex-col py-6 px-5 overflow-y-auto"
          style={{ borderLeft: "1px solid hsl(34 10% 12%)" }}
        >
          <BlindBuyScorer
            score={blindBuyScore}
            isLoading={scoreMutation.isPending}
            fragranceName={selectedFragrance?.name}
          />
        </aside>
      )}

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent
          side="left"
          className="p-0 border-r"
          style={{
            background: "hsl(30 14% 3%)",
            borderColor: "hsl(34 10% 12%)",
            width: 240,
          }}
        >
          <SidebarContent
            {...sidebarProps}
            onClose={() => setMobileSidebarOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Onboarding */}
      <OnboardingModal
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    </div>
  );
}

function parseBudget(budget: string | null): number | null {
  if (!budget) return null;
  const map: Record<string, number> = {
    under_50: 50,
    "50_150": 150,
    "150_300": 300,
    no_limit: 9999,
  };
  return map[budget] ?? null;
}

function EmptyState({ onFragranceSelect: _ }: { onFragranceSelect: (f: Fragrance) => void }) {
  const SUGGESTIONS = [
    { name: "Aventus", house: "Creed" },
    { name: "Sauvage EDP", house: "Dior" },
    { name: "Oud Wood", house: "Tom Ford" },
    { name: "Layton", house: "Parfums de Marly" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
      <h2
        className="font-serif text-3xl sm:text-4xl mb-3 leading-tight"
        style={{ color: "hsl(40 15% 55%)" }}
      >
        What are you wearing tonight?
      </h2>
      <p className="text-sm mb-8 max-w-sm" style={{ color: "hsl(40 10% 35%)" }}>
        Search any fragrance to discover alternatives, get context recommendations, and assess blind buy risk.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.name}
            data-testid={`suggestion-${s.name.replace(/\s+/g, "-").toLowerCase()}`}
            className="px-4 py-2 rounded border text-sm transition-all"
            style={{
              borderColor: "hsl(34 10% 18%)",
              color: "hsl(40 10% 45%)",
              background: "hsl(34 12% 9%)",
            }}
          >
            <span style={{ color: "hsl(40 10% 35%)" }}>{s.house} · </span>
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
