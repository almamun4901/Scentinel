import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp } from "@clerk/react";
import { dark } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

const clerkAppearance = {
  baseTheme: dark,
  layout: {
    logoImageUrl: "/logo.svg",
    logoLinkUrl: "/",
  },
  variables: {
    colorBackground: "hsl(34 17% 8%)",
    colorInputBackground: "hsl(34 12% 9%)",
    colorInputText: "hsl(40 20% 88%)",
    colorText: "hsl(40 20% 88%)",
    colorTextSecondary: "hsl(40 10% 48%)",
    colorPrimary: "hsl(42 54% 50%)",
    colorDanger: "hsl(0 70% 45%)",
    colorSuccess: "hsl(142 50% 40%)",
    colorNeutral: "hsl(40 10% 48%)",
    borderRadius: "0.375rem",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontFamilyButtons: "'DM Sans', system-ui, sans-serif",
    fontSize: "14px",
  },
  elements: {
    card: {
      background: "hsl(34 17% 8%)",
      border: "1px solid hsl(34 10% 18%)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    },
    rootBox: {
      width: "100%",
    },
    headerTitle: {
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      fontSize: "22px",
      fontWeight: "500",
      letterSpacing: "0.04em",
      color: "hsl(40 20% 88%)",
    },
    headerSubtitle: {
      color: "hsl(40 10% 48%)",
      fontSize: "13px",
    },
    socialButtonsBlockButton: {
      border: "1px solid hsl(34 10% 18%)",
      background: "hsl(34 12% 9%)",
      color: "hsl(40 20% 80%)",
    },
    socialButtonsBlockButton__hover: {
      background: "hsl(34 12% 13%)",
    },
    dividerLine: {
      background: "hsl(34 10% 16%)",
    },
    dividerText: {
      color: "hsl(40 10% 36%)",
    },
    formFieldLabel: {
      color: "hsl(40 15% 60%)",
      fontSize: "12px",
      letterSpacing: "0.08em",
    },
    formFieldInput: {
      background: "hsl(34 12% 9%)",
      border: "1px solid hsl(34 10% 18%)",
      color: "hsl(40 20% 88%)",
    },
    formFieldInput__focus: {
      border: "1px solid hsl(42 54% 40%)",
      boxShadow: "0 0 0 2px hsl(42 54% 50% / 0.15)",
    },
    formButtonPrimary: {
      background: "hsl(42 54% 50%)",
      color: "hsl(30 14% 4%)",
      fontWeight: "500",
      letterSpacing: "0.04em",
    },
    formButtonPrimary__hover: {
      background: "hsl(42 54% 44%)",
    },
    footerActionLink: {
      color: "hsl(42 54% 55%)",
    },
    identityPreviewText: {
      color: "hsl(40 20% 80%)",
    },
    identityPreviewEditButton: {
      color: "hsl(42 54% 55%)",
    },
  },
};

const clerkLocalization = {
  signIn: {
    start: {
      title: "Welcome back",
      subtitle: "Sign in to your Scentinel account",
    },
  },
  signUp: {
    start: {
      title: "Begin your journey",
      subtitle: "Create your Scentinel account",
    },
  },
};

function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "hsl(30 14% 3%)" }}
    >
      {/* Subtle background texture */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, hsl(34 17% 6% / 0.8) 0%, transparent 100%)",
        }}
      />

      {/* Top brand link */}
      <a
        href={base || "/"}
        className="relative mb-8 flex items-center gap-3 group"
      >
        <div
          className="flex items-center justify-center rounded-md font-serif"
          style={{
            width: 36,
            height: 36,
            background: "rgba(196,154,60,0.12)",
            border: "1px solid rgba(196,154,60,0.25)",
            color: "hsl(42 54% 58%)",
            fontSize: 19,
          }}
        >
          S
        </div>
        <span
          className="font-serif text-lg tracking-widest"
          style={{ color: "hsl(42 54% 58%)" }}
        >
          Scen<span style={{ color: "hsl(40 10% 38%)", fontWeight: 300 }}>tinel</span>
        </span>
      </a>

      {/* Clerk component */}
      <div className="relative w-full max-w-sm px-4">
        {mode === "sign-in" ? (
          <SignIn
            appearance={clerkAppearance}
            localization={clerkLocalization}
            routing="path"
            path={`${base}/sign-in`}
            signUpUrl={`${base}/sign-up`}
            fallbackRedirectUrl={base || "/"}
          />
        ) : (
          <SignUp
            appearance={clerkAppearance}
            localization={clerkLocalization}
            routing="path"
            path={`${base}/sign-up`}
            signInUrl={`${base}/sign-in`}
            fallbackRedirectUrl={base || "/"}
          />
        )}
      </div>

      {/* Footer */}
      <p
        className="relative mt-8 text-xs"
        style={{ color: "hsl(40 10% 28%)" }}
      >
        Fragrance Intelligence
      </p>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} />
      <Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} />
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      appearance={clerkAppearance}
      localization={clerkLocalization}
      signInUrl={`${base}/sign-in`}
      signUpUrl={`${base}/sign-up`}
      afterSignInUrl={base || "/"}
      afterSignUpUrl={base || "/"}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={base}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
