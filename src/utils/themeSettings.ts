export type AppThemeId = 'dark' | 'light' | 'papaya' | 'rosso' | 'emerald' | 'retro';
export type SpeedometerDockSide = 'right' | 'left';

export interface ThemeMeta {
  id: AppThemeId;
  name: string;
  shortLabel: string;
  badgeColor: string;
  accentHex: string;
  isLight: boolean;
  description: string;
}

export const APP_THEMES: Record<AppThemeId, ThemeMeta> = {
  light: {
    id: 'light',
    name: 'Daylight Paddock (Light)',
    shortLabel: 'Light',
    badgeColor: '#F59E0B',
    accentHex: '#E11D48',
    isLight: true,
    description: 'Crisp ceramic white surfaces, slate typography, and FIA crimson accents',
  },
  dark: {
    id: 'dark',
    name: 'Obsidian Carbon (Dark)',
    shortLabel: 'Dark',
    badgeColor: '#38BDF8',
    accentHex: '#EF4444',
    isLight: false,
    description: 'Deep carbon-fiber dark mode with telemetry cyan and racing red highlights',
  },
  papaya: {
    id: 'papaya',
    name: 'Papaya Speed (Neon)',
    shortLabel: 'Papaya',
    badgeColor: '#FF8000',
    accentHex: '#FF8000',
    isLight: false,
    description: 'Midnight navy paddock with McLaren papaya orange and electric cyan glow',
  },
  rosso: {
    id: 'rosso',
    name: 'Scuderia Rosso (Crimson)',
    shortLabel: 'Rosso',
    badgeColor: '#DC2626',
    accentHex: '#EF4444',
    isLight: false,
    description: 'Maranello scarlet & warm championship gold over deep espresso carbon',
  },
  emerald: {
    id: 'emerald',
    name: 'Aston Emerald (Luxury)',
    shortLabel: 'Emerald',
    badgeColor: '#10B981',
    accentHex: '#10B981',
    isLight: false,
    description: 'British Racing Green hospitality suite with lime-volt telemetry accents',
  },
  retro: {
    id: 'retro',
    name: "Retro Arcade '89 (Synthwave)",
    shortLabel: 'Retro',
    badgeColor: '#FF2A85',
    accentHex: '#00F0FF',
    isLight: false,
    description: '90s Grand Prix Arcade cabinet with OutRun magenta, turbo yellow & CRT cyan',
  },
};

export const THEME_OPTIONS: AppThemeId[] = ['light', 'dark', 'papaya', 'rosso', 'emerald', 'retro'];

const THEME_STORAGE_KEY = 'apex26_ui_theme_v1';
const DOCK_STORAGE_KEY = 'apex26_hud_dock_side_v1';

type ThemeListener = (theme: AppThemeId) => void;
type DockListener = (side: SpeedometerDockSide) => void;

const themeListeners = new Set<ThemeListener>();
const dockListeners = new Set<DockListener>();

export function getStoredTheme(): AppThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY) as AppThemeId | null;
    if (raw && APP_THEMES[raw]) {
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return 'papaya';
}

export function setStoredTheme(theme: AppThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage errors
  }
  applyThemeToDocument(theme);
  themeListeners.forEach((cb) => cb(theme));
}

export function onThemeChange(cb: ThemeListener): () => void {
  themeListeners.add(cb);
  return () => {
    themeListeners.delete(cb);
  };
}

export function applyThemeToDocument(theme: AppThemeId): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark', 'theme-papaya', 'theme-rosso', 'theme-emerald', 'theme-retro');
  root.classList.add(`theme-${theme}`);
  root.setAttribute('data-theme', theme);
}

export function getStoredSpeedometerDock(): SpeedometerDockSide {
  try {
    const raw = localStorage.getItem(DOCK_STORAGE_KEY);
    if (raw === 'left' || raw === 'right') {
      return raw;
    }
  } catch {
    // ignore
  }
  return 'right';
}

export function setStoredSpeedometerDock(side: SpeedometerDockSide): void {
  try {
    localStorage.setItem(DOCK_STORAGE_KEY, side);
  } catch {
    // ignore
  }
  dockListeners.forEach((cb) => cb(side));
}

export function onSpeedometerDockChange(cb: DockListener): () => void {
  dockListeners.add(cb);
  return () => {
    dockListeners.delete(cb);
  };
}
