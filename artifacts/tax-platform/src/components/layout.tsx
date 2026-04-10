import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  Building2,
  ChevronRight,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { loadSavedTheme, type AccentTheme, type ThemeMode } from "@/lib/theme";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/transactions", label: "Transactions", icon: FileSpreadsheet },
  { href: "/risks", label: "Tax Risks", icon: ShieldAlert },
  { href: "/reports", label: "Reports", icon: FileText },
];

function getInitials(name?: string) {
  if (!name) return "TI";

  return name
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    const handleChange = () => setIsDesktop(mediaQuery.matches);
    handleChange();

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
}

function getThemeClasses(mode: "light" | "dark", accent: AccentTheme) {
  const accentMap = {
    ocean: {
      active:
        mode === "dark"
          ? "bg-sky-500/15 text-sky-300"
          : "bg-sky-500/12 text-sky-700",
      activeIcon:
        mode === "dark"
          ? "bg-sky-500/10 text-sky-300"
          : "bg-sky-500/10 text-sky-700",
      avatar: "from-sky-500 to-cyan-500",
      profileButton:
        mode === "dark"
          ? "bg-white text-slate-900 hover:bg-slate-100"
          : "bg-slate-900 text-white hover:bg-slate-800",
    },
    indigo: {
      active:
        mode === "dark"
          ? "bg-indigo-500/15 text-indigo-300"
          : "bg-indigo-500/12 text-indigo-700",
      activeIcon:
        mode === "dark"
          ? "bg-indigo-500/10 text-indigo-300"
          : "bg-indigo-500/10 text-indigo-700",
      avatar: "from-indigo-500 to-blue-500",
      profileButton:
        mode === "dark"
          ? "bg-white text-slate-900 hover:bg-slate-100"
          : "bg-slate-900 text-white hover:bg-slate-800",
    },
    emerald: {
      active:
        mode === "dark"
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-emerald-500/12 text-emerald-700",
      activeIcon:
        mode === "dark"
          ? "bg-emerald-500/10 text-emerald-300"
          : "bg-emerald-500/10 text-emerald-700",
      avatar: "from-emerald-500 to-teal-500",
      profileButton:
        mode === "dark"
          ? "bg-white text-slate-900 hover:bg-slate-100"
          : "bg-slate-900 text-white hover:bg-slate-800",
    },
    rose: {
      active:
        mode === "dark"
          ? "bg-rose-500/15 text-rose-300"
          : "bg-rose-500/12 text-rose-700",
      activeIcon:
        mode === "dark"
          ? "bg-rose-500/10 text-rose-300"
          : "bg-rose-500/10 text-rose-700",
      avatar: "from-rose-500 to-pink-500",
      profileButton:
        mode === "dark"
          ? "bg-white text-slate-900 hover:bg-slate-100"
          : "bg-slate-900 text-white hover:bg-slate-800",
    },
    amber: {
      active:
        mode === "dark"
          ? "bg-amber-500/15 text-amber-300"
          : "bg-amber-500/12 text-amber-700",
      activeIcon:
        mode === "dark"
          ? "bg-amber-500/10 text-amber-300"
          : "bg-amber-500/10 text-amber-700",
      avatar: "from-amber-500 to-orange-500",
      profileButton:
        mode === "dark"
          ? "bg-white text-slate-900 hover:bg-slate-100"
          : "bg-slate-900 text-white hover:bg-slate-800",
    },
  } as const;

  if (mode === "dark") {
    return {
      appBg: "bg-slate-950",
      mobileBar: "bg-slate-900/90 border-slate-800 text-slate-100",
      sidebar: "bg-slate-900/95 border-slate-800 text-slate-100",
      brandMuted: "text-slate-400",
      brandPill: "bg-white/5 text-slate-400",
      ghostButton: "text-slate-400 hover:bg-white/5 hover:text-white",
      profileCard: "from-slate-800 to-slate-900 border-white/10 text-white",
      profileSubtle: "bg-white/5 border-white/10",
      profileTextMuted: "text-slate-300",
      profileTiny: "text-slate-400",
      sectionLabel: "text-slate-500",
      navIdle: "text-slate-400 hover:bg-white/5 hover:text-white",
      navIconIdle:
        "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white",
      settingsIdle: "text-slate-400 hover:bg-white/5 hover:text-white",
      settingsIcon: "bg-white/5",
      logoutIdle: "text-slate-400 hover:bg-red-500/10 hover:text-red-400",
      border: "border-slate-800",
      content: "bg-slate-950",
      overlay: "bg-black/50",
      ...accentMap[accent],
    };
  }

  return {
    appBg: "bg-slate-50",
    mobileBar: "bg-white/90 border-slate-200 text-slate-900",
    sidebar: "bg-white/95 border-slate-200 text-slate-900",
    brandMuted: "text-slate-500",
    brandPill: "bg-slate-100 text-slate-500",
    ghostButton: "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
    profileCard: "from-white to-slate-100 border-slate-200 text-slate-900",
    profileSubtle: "bg-white/70 border-slate-200",
    profileTextMuted: "text-slate-600",
    profileTiny: "text-slate-500",
    sectionLabel: "text-slate-400",
    navIdle: "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
    navIconIdle:
      "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-800",
    settingsIdle: "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
    settingsIcon: "bg-slate-100",
    logoutIdle: "text-slate-500 hover:bg-red-50 hover:text-red-600",
    border: "border-slate-200",
    content: "bg-slate-50",
    overlay: "bg-black/40",
    ...accentMap[accent],
  };
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isDesktop = useIsDesktop();

  const [mode, setMode] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState<AccentTheme>("ocean");

  useEffect(() => {
    const syncTheme = () => {
      const saved = loadSavedTheme();
      const resolved =
        saved.mode === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : saved.mode;

      setMode(resolved);
      setAccent(saved.accent);
    };

    syncTheme();

    window.addEventListener("storage", syncTheme);
    window.addEventListener("theme-updated", syncTheme as EventListener);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const saved = loadSavedTheme();
      if (saved.mode === "system") syncTheme();
    };

    mq.addEventListener("change", onChange);

    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("theme-updated", syncTheme as EventListener);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  const theme = getThemeClasses(mode, accent);
  const initials = getInitials(user?.fullName);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const sidebarWidth = collapsed ? "w-[92px]" : "w-[290px]";

  return (
    <div className={`min-h-screen flex flex-col md:flex-row ${theme.appBg}`}>
      <div
        className={`md:hidden sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 backdrop-blur ${theme.mobileBar}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.avatar} shadow-sm`}
          >
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">TaxIntel</p>
            <p className={`text-xs ${theme.brandMuted}`}>
              Professional workspace
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className={`rounded-xl ${theme.ghostButton}`}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      <AnimatePresence>
        {(mobileMenuOpen || isDesktop) && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className={`fixed md:sticky left-0 top-0 z-50 h-screen ${sidebarWidth} border-r shadow-2xl transition-[width] duration-300 md:shadow-none backdrop-blur ${
              mobileMenuOpen ? "block" : "hidden md:flex"
            } ${theme.sidebar} ${theme.border}`}
          >
            <div className="flex h-full flex-col">
              <div
                className={`border-b py-5 ${collapsed ? "px-4" : "px-5"} ${theme.border}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`flex items-center ${collapsed ? "justify-center w-full" : "gap-3"} min-w-0`}
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.avatar} shadow-sm`}
                    >
                      <Building2 className="h-6 w-6 text-white" />
                    </div>

                    {!collapsed && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-lg font-bold tracking-tight">
                            TaxIntel
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${theme.brandPill}`}
                          >
                            Suite
                          </span>
                        </div>
                        <p className={`mt-1 text-xs ${theme.brandMuted}`}>
                          Smart tax operations
                        </p>
                      </div>
                    )}
                  </div>

                  {isDesktop && !collapsed && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCollapsed(true)}
                      className={`rounded-xl ${theme.ghostButton}`}
                    >
                      <PanelLeftClose className="h-5 w-5" />
                    </Button>
                  )}
                </div>

                {isDesktop && collapsed && (
                  <div className="mt-3 flex justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCollapsed(false)}
                      className={`rounded-xl ${theme.ghostButton}`}
                    >
                      <PanelLeftOpen className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>

              <div
                className="flex-1 overflow-y-auto px-3 py-4 hide-scrollbar"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                <div
                  className={`mb-6 overflow-hidden rounded-3xl border bg-gradient-to-br shadow-sm ${
                    collapsed ? "p-3" : "p-4"
                  } ${theme.profileCard}`}
                >
                  <div
                    className={`flex ${
                      collapsed
                        ? "flex-col items-center justify-center gap-3"
                        : "items-start justify-between gap-3"
                    }`}
                  >
                    <div
                      className={`flex min-w-0 ${
                        collapsed
                          ? "flex-col items-center gap-3"
                          : "items-center gap-3"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.avatar} text-sm font-semibold text-white shadow-md`}
                        >
                          {initials}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 bg-emerald-400 ${
                            mode === "dark"
                              ? "border-slate-900"
                              : "border-white"
                          }`}
                        />
                      </div>

                      {!collapsed && (
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold tracking-tight">
                            {user?.fullName || "TaxIntel User"}
                          </p>
                          <p
                            className={`mt-0.5 truncate text-xs capitalize ${theme.profileTextMuted}`}
                          >
                            {user?.role || "user"}
                          </p>
                        </div>
                      )}
                    </div>

                    {!collapsed && (
                      <div
                        className={`rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${theme.profileSubtle}`}
                      >
                        Active
                      </div>
                    )}
                  </div>

                  {!collapsed && (
                    <>
                      <div
                        className={`mt-4 rounded-2xl border p-3 backdrop-blur ${theme.profileSubtle}`}
                      >
                        <div className="flex items-start gap-2">
                          <Sparkles className={`mt-0.5 h-4 w-4`} />
                          <div>
                            <p className="text-xs font-medium">
                              Workspace ready
                            </p>
                            <p
                              className={`mt-1 text-[11px] leading-relaxed ${theme.profileTextMuted}`}
                            >
                              Manage clients, transactions, reports, and risk
                              reviews from one place.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <Link
                          href="/settings"
                          onClick={closeMobileMenu}
                          className={`inline-flex items-center rounded-xl px-3 py-2 text-[11px] font-semibold transition ${theme.profileButton}`}
                        >
                          View profile
                        </Link>

                        <span className={`text-[11px] ${theme.profileTiny}`}>
                          Secure session
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {!collapsed && (
                  <div
                    className={`mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${theme.sectionLabel}`}
                  >
                    Navigation
                  </div>
                )}

                <nav className="space-y-1.5">
                  {NAV_ITEMS.map((item) => {
                    const isActive =
                      location === item.href ||
                      location.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobileMenu}
                        className={`group flex items-center ${
                          collapsed
                            ? "justify-center px-2 py-3"
                            : "justify-between px-3 py-3"
                        } rounded-2xl transition-all duration-200 ${
                          isActive ? theme.active : theme.navIdle
                        }`}
                        title={collapsed ? item.label : undefined}
                      >
                        <div
                          className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}
                        >
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                              isActive ? theme.activeIcon : theme.navIconIdle
                            }`}
                          >
                            <item.icon className="h-[18px] w-[18px]" />
                          </div>

                          {!collapsed && (
                            <span className="text-sm font-medium tracking-tight">
                              {item.label}
                            </span>
                          )}
                        </div>

                        {!collapsed && (
                          <ChevronRight
                            className={`h-4 w-4 transition ${
                              isActive
                                ? mode === "dark"
                                  ? "text-white/70"
                                  : "text-slate-700/70"
                                : mode === "dark"
                                  ? "text-slate-600 group-hover:text-slate-300"
                                  : "text-slate-300 group-hover:text-slate-500"
                            }`}
                          />
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className={`border-t p-3 space-y-2 ${theme.border}`}>
                <Link
                  href="/settings"
                  onClick={closeMobileMenu}
                  className={`flex items-center ${
                    collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-3"
                  } rounded-2xl transition ${
                    location === "/settings" ? theme.active : theme.settingsIdle
                  }`}
                  title={collapsed ? "Settings" : undefined}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${theme.settingsIcon}`}
                  >
                    <Settings className="h-[18px] w-[18px]" />
                  </div>
                  {!collapsed && (
                    <span className="font-medium tracking-tight">Settings</span>
                  )}
                </Link>

                <button
                  onClick={() => logout()}
                  className={`flex w-full items-center ${
                    collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-3"
                  } rounded-2xl transition ${theme.logoutIdle}`}
                  title={collapsed ? "Logout" : undefined}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${theme.settingsIcon}`}
                  >
                    <LogOut className="h-[18px] w-[18px]" />
                  </div>
                  {!collapsed && (
                    <span className="font-medium tracking-tight">Logout</span>
                  )}
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <main
        className={`relative flex min-w-0 flex-1 flex-col overflow-hidden ${theme.content}`}
      >
        <div className={`flex-1 overflow-auto ${theme.content}`}>
          {children}
        </div>
      </main>

      {mobileMenuOpen && (
        <div
          className={`fixed inset-0 z-40 backdrop-blur-sm md:hidden ${theme.overlay}`}
          onClick={closeMobileMenu}
        />
      )}
    </div>
  );
}
