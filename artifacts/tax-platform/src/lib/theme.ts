export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentTheme = 'ocean' | 'indigo' | 'emerald' | 'rose' | 'amber';

interface AccentValues {
  primary: string;
  ring: string;
  sidebarPrimary: string;
}

const ACCENT_MAP: Record<AccentTheme, AccentValues> = {
  ocean:   { primary: '199 89% 48%', ring: '199 89% 48%', sidebarPrimary: '199 89% 48%' },
  indigo:  { primary: '234 89% 55%', ring: '234 89% 55%', sidebarPrimary: '234 89% 55%' },
  emerald: { primary: '152 69% 35%', ring: '152 69% 35%', sidebarPrimary: '152 69% 35%' },
  rose:    { primary: '350 89% 58%', ring: '350 89% 58%', sidebarPrimary: '350 89% 58%' },
  amber:   { primary: '38 92% 46%',  ring: '38 92% 46%',  sidebarPrimary: '38 92% 46%' },
};

export function loadSavedTheme(): { mode: ThemeMode; accent: AccentTheme } {
  const mode = (localStorage.getItem('themeMode') as ThemeMode | null) ?? 'system';
  const accent = (localStorage.getItem('accentTheme') as AccentTheme | null) ?? 'ocean';
  return { mode, accent };
}

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(mode: ThemeMode, accent: AccentTheme): void {
  const resolved = resolveMode(mode);
  const root = document.documentElement;

  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const vals = ACCENT_MAP[accent] ?? ACCENT_MAP.indigo;
  root.style.setProperty('--primary', vals.primary);
  root.style.setProperty('--ring', vals.ring);
  root.style.setProperty('--accent', vals.primary);
  root.style.setProperty('--chart-1', vals.primary);
  root.style.setProperty('--sidebar-primary', vals.sidebarPrimary);
  root.style.setProperty('--sidebar-ring', vals.sidebarPrimary);
}

export default function watchSystemTheme(): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    const saved = loadSavedTheme();
    if (saved.mode === 'system') {
      applyTheme('system', saved.accent);
    }
  });

  window.addEventListener('theme-updated', () => {
    const saved = loadSavedTheme();
    applyTheme(saved.mode, saved.accent);
  });
}
