import { useState, useCallback, useEffect } from "react";
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
import { Sidebar } from "@/components/sidebar";
import { OnboardingModal } from "@/components/onboarding-modal";
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
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem("scentinel-onboarding-done") === "1"
  );

  // Profile data
  const { data: profileData, refetch: refetchProfile } = useGetProfile({
    query: { queryKey: ["profile"] },
  });
  const profile: UserProfile = profileData ?? { ownedFragrances: [], budget: null };

  // Weather — use a neutral default lat/lon (London)
  const weatherParams = { lat: "51.5", lon: "-0.12" };
  const { data: weatherData } = useGetWeather(weatherParams, {
    query: { queryKey: getGetWeatherQueryKey(weatherParams) },
  });
  const weatherTemp = weatherData?.temp_c ?? 18;
  const weatherDesc = weatherData?.description ?? "partly cloudy";

  // Show onboarding on first visit or empty collection
  useEffect(() => {
    if (!onboardingDismissed) {
      setShowOnboarding(true);
    }
  }, [onboardingDismissed]);

  // Mutations
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

      // Fire all three in parallel
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

  const handleOnboardingComplete = (p: { ownedFragrances: string[]; budget: string | null }) => {
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

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "hsl(30 14% 3%)" }}
    >
      {/* Left Sidebar */}
      <Sidebar
        ownedFragrances={profile.ownedFragrances}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onOpenOnboarding={() => setShowOnboarding(true)}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="shrink-0 flex items-center gap-4 px-6 py-3 border-b"
          style={{ borderColor: "hsl(34 10% 12%)" }}
        >
          <SearchBar onSelect={handleFragranceSelect} />

          {/* Context chips in top bar */}
          <div className="flex items-center gap-2 ml-2 shrink-0">
            <div
              className="text-xs px-2.5 py-1.5 rounded border font-mono"
              style={{
                borderColor: "hsl(34 10% 18%)",
                color: "hsl(40 10% 48%)",
                background: "hsl(34 12% 9%)",
              }}
            >
              {weatherTemp}°C
            </div>
            <div
              className="text-xs px-2.5 py-1.5 rounded border capitalize"
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

        {/* Scrollable main area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
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
            </div>
          )}
        </div>
      </main>

      {/* Right panel — Blind Buy Scorer */}
      <aside
        className="w-[280px] shrink-0 flex flex-col py-6 px-5 overflow-y-auto"
        style={{ borderLeft: "1px solid hsl(34 10% 12%)" }}
      >
        <BlindBuyScorer
          score={blindBuyScore}
          isLoading={scoreMutation.isPending}
          fragranceName={selectedFragrance?.name}
        />
      </aside>

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

function EmptyState({ onFragranceSelect }: { onFragranceSelect: (f: Fragrance) => void }) {
  const SUGGESTIONS = [
    { name: "Aventus", house: "Creed" },
    { name: "Sauvage EDP", house: "Dior" },
    { name: "Oud Wood", house: "Tom Ford" },
    { name: "Layton", house: "Parfums de Marly" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
      <h2
        className="font-serif text-4xl mb-3 leading-tight"
        style={{ color: "hsl(40 15% 55%)" }}
      >
        What are you wearing tonight?
      </h2>
      <p className="text-sm mb-8" style={{ color: "hsl(40 10% 35%)" }}>
        Search any fragrance to discover alternatives, get context recommendations, and assess blind buy risk.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.name}
            data-testid={`suggestion-${s.name.replace(/\s+/g, "-").toLowerCase()}`}
            onClick={() => {
              // We can't directly select without a full Fragrance object,
              // but we can populate the search — let the user click
            }}
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
