import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  Monitor,
  Moon,
  Sun,
  Check,
  Palette,
  UserCircle2,
  ShieldCheck,
} from "lucide-react";
import {
  applyTheme,
  loadSavedTheme,
  type ThemeMode,
  type AccentTheme,
} from "@/lib/theme";

const MODE_OPTIONS: {
  value: ThemeMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Bright interface with strong contrast for daytime use.",
    icon: <Sun className="h-4 w-4" />,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Low-glare workspace designed for long sessions.",
    icon: <Moon className="h-4 w-4" />,
  },
  {
    value: "system",
    label: "System",
    description: "Automatically match your device appearance.",
    icon: <Monitor className="h-4 w-4" />,
  },
];

const ACCENT_OPTIONS: {
  value: AccentTheme;
  label: string;
  swatch: string;
  previewText: string;
}[] = [
  {
    value: "ocean",
    label: "Ocean",
    swatch: "from-sky-500 to-cyan-500",
    previewText: "Fresh and calm",
  },
  {
    value: "indigo",
    label: "Indigo",
    swatch: "from-indigo-500 to-blue-500",
    previewText: "Professional and modern",
  },
  {
    value: "emerald",
    label: "Emerald",
    swatch: "from-emerald-500 to-teal-500",
    previewText: "Balanced and confident",
  },
  {
    value: "rose",
    label: "Rose",
    swatch: "from-rose-500 to-pink-500",
    previewText: "Warm and refined",
  },
  {
    value: "amber",
    label: "Amber",
    swatch: "from-amber-500 to-orange-500",
    previewText: "Bold and energetic",
  },
];

function getResolvedMode(mode: ThemeMode): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

export default function Settings() {
  const { user } = useAuth();

  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [accentTheme, setAccentTheme] = useState<AccentTheme>("ocean");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const saved = loadSavedTheme();
    setThemeMode(saved.mode);
    setAccentTheme(saved.accent);
  }, []);

  const resolvedMode = useMemo(() => getResolvedMode(themeMode), [themeMode]);

  const saveAppearance = () => {
    localStorage.setItem("themeMode", themeMode);
    localStorage.setItem("accentTheme", accentTheme);
    applyTheme(themeMode, accentTheme);
    window.dispatchEvent(new Event("theme-updated"));
    setSavedMessage("Appearance preferences saved.");
    window.setTimeout(() => setSavedMessage(""), 2500);
  };

  const previewSurface =
    resolvedMode === "dark"
      ? "bg-slate-900 border-slate-800 text-slate-100"
      : "bg-white border-slate-200 text-slate-900";

  const previewMuted =
    resolvedMode === "dark" ? "text-slate-400" : "text-slate-500";

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            Manage your account details, appearance preferences, and workspace
            experience.
          </p>
        </div>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UserCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    Profile Information
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Update your personal details and review account information.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary ring-4 ring-primary/5">
                  {user?.fullName?.charAt(0) || "U"}
                </div>

                <div className="space-y-2">
                  <button className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/5">
                    Upload Photo
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Use a clear image for better identification across the
                    workspace.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Full Name
                  </label>
                  <input
                    type="text"
                    defaultValue={user?.fullName || ""}
                    className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    placeholder="Enter your full name"
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    This will appear in your account and workspace profile.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Email Address
                  </label>
                  <input
                    type="email"
                    defaultValue={user?.email || ""}
                    disabled
                    className="w-full cursor-not-allowed rounded-2xl border border-input bg-muted/50 px-4 py-3 text-muted-foreground"
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Your email is managed securely and cannot be edited here.
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Role
                  </label>
                  <input
                    type="text"
                    defaultValue={user?.role || ""}
                    disabled
                    className="w-full cursor-not-allowed rounded-2xl border border-input bg-muted/50 px-4 py-3 capitalize text-muted-foreground"
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Role permissions are managed by your organization or system
                    administrator.
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <button className="rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-md transition hover:bg-primary/90">
                  Save Changes
                </button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Palette className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    Appearance
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose a mode and colour theme with strong readability
                    across the app.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-8 px-6 py-6">
              <div>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Mode
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select how the workspace should appear on your screen.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {MODE_OPTIONS.map((option) => {
                    const active = themeMode === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setThemeMode(option.value)}
                        className={`rounded-2xl border p-4 text-left transition-all ${
                          active
                            ? "border-primary bg-primary/5 ring-2 ring-primary/10"
                            : "border-border bg-background hover:border-primary/30 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground">
                            {option.icon}
                          </div>

                          {active && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="mt-4">
                          <div className="font-semibold text-foreground">
                            {option.label}
                          </div>
                          <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {option.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Colour Theme
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose the accent colour used for highlights, selections,
                    and controls.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {ACCENT_OPTIONS.map((option) => {
                    const active = accentTheme === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAccentTheme(option.value)}
                        className={`rounded-2xl border p-3 text-left transition-all ${
                          active
                            ? "border-primary bg-primary/5 ring-2 ring-primary/10"
                            : "border-border bg-background hover:border-primary/30 hover:bg-muted/30"
                        }`}
                      >
                        <div
                          className={`h-12 w-full rounded-xl bg-gradient-to-r ${option.swatch}`}
                        />
                        <div className="mt-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              {option.label}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {option.previewText}
                            </div>
                          </div>

                          {active && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Preview
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Check readability before saving your appearance settings.
                  </p>
                </div>

                <div
                  className={`rounded-3xl border p-5 shadow-sm ${previewSurface}`}
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${
                            ACCENT_OPTIONS.find((a) => a.value === accentTheme)
                              ?.swatch
                          }`}
                        />
                        <div>
                          <div className="font-semibold">
                            TaxIntel Workspace
                          </div>
                          <div className={`text-sm ${previewMuted}`}>
                            Readable interface preview
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 max-w-xl space-y-2">
                        <p className="text-sm font-medium">
                          This is how headings and body text will appear.
                        </p>
                        <p
                          className={`text-sm leading-relaxed ${previewMuted}`}
                        >
                          The selected mode and colour theme should remain easy
                          to read across navigation, profile cards, forms, and
                          content panels.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r ${
                          ACCENT_OPTIONS.find((a) => a.value === accentTheme)
                            ?.swatch
                        }`}
                      >
                        Accent
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          resolvedMode === "dark"
                            ? "border-slate-700 bg-slate-800 text-slate-200"
                            : "border-slate-200 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {resolvedMode === "dark" ? "Dark mode" : "Light mode"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Visibility guidance
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      For strongest readability, use Light or Dark mode instead
                      of System when working in changing lighting conditions,
                      and choose a colour theme that provides clear emphasis
                      without overpowering text.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    onClick={saveAppearance}
                    className="rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-md transition hover:bg-primary/90"
                  >
                    Save Appearance
                  </button>

                  <div className="min-h-[20px] text-sm font-medium text-primary">
                    {savedMessage}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
