import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSaveProfile } from "@workspace/api-client-react";
import { SEEDED_FRAGRANCES, BUDGET_OPTIONS } from "@/types";

interface OnboardingModalProps {
  open: boolean;
  onComplete: (profile: { ownedFragrances: string[]; budget: string | null }) => void;
  onSkip: () => void;
}

export function OnboardingModal({ open, onComplete, onSkip }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [budget, setBudget] = useState<string | null>(null);

  const saveProfile = useSaveProfile();

  const toggleFragrance = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]
    );
  };

  const handleConfirm = () => {
    saveProfile.mutate(
      { data: { ownedFragrances: selected, budget } },
      {
        onSettled: () => {
          onComplete({ ownedFragrances: selected, budget });
        },
      }
    );
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden border"
        style={{
          background: "hsl(34 17% 8%)",
          borderColor: "hsl(34 10% 18%)",
        }}
      >
        <DialogTitle className="sr-only">Set up your collection</DialogTitle>
        <p id="onboarding-desc" className="sr-only">
          Complete these steps to personalise your Scentinel experience.
        </p>

        {/* Step indicator */}
        <div className="flex border-b" style={{ borderColor: "hsl(34 10% 14%)" }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className="flex-1 py-3 text-center text-xs font-mono tracking-widest transition-colors"
              style={{
                color: step === s ? "hsl(42 54% 50%)" : "hsl(40 10% 35%)",
                borderBottom: step === s ? "1px solid hsl(42 54% 50%)" : "1px solid transparent",
              }}
            >
              0{s}
            </div>
          ))}
        </div>

        <div className="p-6">
          {step === 1 && (
            <div>
              <h2 className="font-serif text-2xl text-foreground mb-1">Your Collection</h2>
              <p className="text-sm mb-5" style={{ color: "hsl(40 10% 48%)" }}>
                Select the fragrances you already own. We use this to personalise recommendations.
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {SEEDED_FRAGRANCES.map((name) => {
                  const isSelected = selected.includes(name);
                  return (
                    <button
                      key={name}
                      data-testid={`onboarding-fragrance-${name.replace(/\s+/g, "-").toLowerCase()}`}
                      onClick={() => toggleFragrance(name)}
                      className="text-left px-3 py-2.5 rounded text-sm transition-all border"
                      style={{
                        background: isSelected ? "hsl(42 54% 50% / 0.12)" : "hsl(34 12% 12%)",
                        borderColor: isSelected ? "hsl(42 54% 50% / 0.5)" : "hsl(34 10% 18%)",
                        color: isSelected ? "hsl(42 54% 70%)" : "hsl(40 15% 70%)",
                      }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs mt-3" style={{ color: "hsl(40 10% 35%)" }}>
                {selected.length} selected
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-serif text-2xl text-foreground mb-1">Your Budget</h2>
              <p className="text-sm mb-5" style={{ color: "hsl(40 10% 48%)" }}>
                Set a rough budget ceiling for fragrance recommendations.
              </p>
              <div className="space-y-2">
                {BUDGET_OPTIONS.map((opt) => {
                  const isSelected = budget === opt.value;
                  return (
                    <button
                      key={opt.value}
                      data-testid={`onboarding-budget-${opt.value}`}
                      onClick={() => setBudget(opt.value)}
                      className="w-full text-left px-4 py-3 rounded border transition-all"
                      style={{
                        background: isSelected ? "hsl(42 54% 50% / 0.12)" : "hsl(34 12% 12%)",
                        borderColor: isSelected ? "hsl(42 54% 50% / 0.5)" : "hsl(34 10% 18%)",
                        color: isSelected ? "hsl(42 54% 70%)" : "hsl(40 15% 70%)",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-serif text-2xl text-foreground mb-1">Confirm</h2>
              <p className="text-sm mb-5" style={{ color: "hsl(40 10% 48%)" }}>
                Here is a summary of your profile before we begin.
              </p>
              <div
                className="rounded border p-4 space-y-3"
                style={{ borderColor: "hsl(34 10% 18%)", background: "hsl(34 12% 6%)" }}
              >
                <div>
                  <div className="text-xs font-mono tracking-widest mb-2" style={{ color: "hsl(42 54% 50%)" }}>
                    COLLECTION
                  </div>
                  {selected.length === 0 ? (
                    <p className="text-sm" style={{ color: "hsl(40 10% 48%)" }}>No fragrances selected</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.map((f) => (
                        <span
                          key={f}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: "hsl(34 17% 14%)", color: "hsl(40 15% 70%)" }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-mono tracking-widest mb-1" style={{ color: "hsl(42 54% 50%)" }}>
                    BUDGET
                  </div>
                  <p className="text-sm" style={{ color: "hsl(40 15% 70%)" }}>
                    {BUDGET_OPTIONS.find((b) => b.value === budget)?.label ?? "Not set"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-between px-6 pb-6 pt-2"
        >
          <button
            data-testid="onboarding-skip"
            onClick={onSkip}
            className="text-xs font-mono tracking-widest transition-colors"
            style={{ color: "hsl(40 10% 35%)" }}
          >
            Skip
          </button>
          <div className="flex gap-3">
            {step > 1 && (
              <button
                data-testid="onboarding-back"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-sm border rounded transition-all"
                style={{
                  borderColor: "hsl(34 10% 22%)",
                  color: "hsl(40 15% 65%)",
                  background: "transparent",
                }}
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                data-testid="onboarding-next"
                onClick={() => setStep(step + 1)}
                className="px-5 py-2 text-sm rounded font-medium transition-all"
                style={{ background: "hsl(42 54% 50%)", color: "hsl(30 14% 5%)" }}
              >
                Continue
              </button>
            ) : (
              <button
                data-testid="onboarding-confirm"
                onClick={handleConfirm}
                disabled={saveProfile.isPending}
                className="px-5 py-2 text-sm rounded font-medium transition-all disabled:opacity-50"
                style={{ background: "hsl(42 54% 50%)", color: "hsl(30 14% 5%)" }}
              >
                {saveProfile.isPending ? "Saving..." : "Start exploring"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
