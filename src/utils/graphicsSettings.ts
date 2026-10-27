export type GraphicsQuality = 'dynamic' | 'low' | 'medium' | 'high' | 'ultra';

export const GRAPHICS_QUALITY_OPTIONS: GraphicsQuality[] = [
  'dynamic',
  'low',
  'medium',
  'high',
  'ultra',
];

export interface GraphicsPresetConfig {
  id: GraphicsQuality;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
  maxPixelRatio: number;
  antialias: boolean;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  useSoftShadows: boolean;
  useEnvironmentReflections: boolean;
  envMapIntensity: number;
  trackSegments: number;
  asphaltTextureSize: number;
  anisotropy: number;
  sceneryMode: 'minimal' | 'standard' | 'full' | 'ultra';
  carGeometrySegments: number;
  usePhysicalClearcoat: boolean;
  enableRimAndFillLights: boolean;
  enableSpeedParticlesAndSparks: boolean;
  cameraSmoothingHz: number;
}

const STORAGE_KEY = 'apex26_graphics_quality_v1';

export const GRAPHICS_PRESETS: Record<GraphicsQuality, GraphicsPresetConfig> = {
  dynamic: {
    id: 'dynamic',
    label: 'Dynamic (Smart 60 FPS Clear Auto-Tuner)',
    shortLabel: 'Dynamic (60FPS Auto)',
    badge: 'SMART 60FPS CLEAR',
    description:
      'Keeps screen resolution sharp and clear (1.0x–1.25x) while checking FPS right from race start. Automatically toggles Live Reflections vs. Dynamic Shadows (or vice versa) and micro-tunes draw distance to keep 60 FPS with zero startup lag.',
    maxPixelRatio: 1.25,
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    useSoftShadows: true,
    useEnvironmentReflections: true,
    envMapIntensity: 1.75,
    trackSegments: 720,
    asphaltTextureSize: 1024,
    anisotropy: 8,
    sceneryMode: 'standard',
    carGeometrySegments: 24,
    usePhysicalClearcoat: true,
    enableRimAndFillLights: true,
    enableSpeedParticlesAndSparks: true,
    cameraSmoothingHz: 28,
  },
  low: {
    id: 'low',
    label: 'Low (60Hz Monitors / Worse Devices)',
    shortLabel: 'Low (60Hz Fast)',
    badge: '60HZ LOCKED / FAST',
    description:
      'Calibrated for 60Hz monitors on lower-end laptops, tablets, and integrated GPUs. Disables heavy shadows and buildings while keeping locked 60 FPS smoothness.',
    maxPixelRatio: 0.85,
    antialias: false,
    shadowsEnabled: false,
    shadowMapSize: 512,
    useSoftShadows: false,
    useEnvironmentReflections: false,
    envMapIntensity: 0.5,
    trackSegments: 380,
    asphaltTextureSize: 512,
    anisotropy: 1,
    sceneryMode: 'minimal',
    carGeometrySegments: 14,
    usePhysicalClearcoat: false,
    enableRimAndFillLights: false,
    enableSpeedParticlesAndSparks: false,
    cameraSmoothingHz: 20,
  },
  medium: {
    id: 'medium',
    label: 'Medium (60Hz Balanced Performance)',
    shortLabel: 'Medium (60Hz)',
    badge: '60HZ BALANCED',
    description:
      'Tuned for standard 60Hz monitors with 1080p anti-aliasing, dynamic shadows, real-time environment reflections, and steady 60 FPS pacing.',
    maxPixelRatio: 1.25,
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    useSoftShadows: false,
    useEnvironmentReflections: true,
    envMapIntensity: 1.25,
    trackSegments: 680,
    asphaltTextureSize: 1024,
    anisotropy: 4,
    sceneryMode: 'standard',
    carGeometrySegments: 24,
    usePhysicalClearcoat: true,
    enableRimAndFillLights: false,
    enableSpeedParticlesAndSparks: true,
    cameraSmoothingHz: 24,
  },
  high: {
    id: 'high',
    label: 'High (60Hz Broadcast Quality + Live Reflections)',
    shortLabel: 'High (60Hz)',
    badge: '60HZ HIGH PBR',
    description:
      'High-definition 60Hz F1 broadcast visuals with 2048px soft shadows, live 3D object reflections on car bodywork, and full circuit landmarks.',
    maxPixelRatio: 1.5,
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    useSoftShadows: true,
    useEnvironmentReflections: true,
    envMapIntensity: 1.75,
    trackSegments: 960,
    asphaltTextureSize: 1024,
    anisotropy: 8,
    sceneryMode: 'full',
    carGeometrySegments: 36,
    usePhysicalClearcoat: true,
    enableRimAndFillLights: true,
    enableSpeedParticlesAndSparks: true,
    cameraSmoothingHz: 28,
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra Realistic (60Hz Photorealistic Ray-Like Reflections & Shadows)',
    shortLabel: 'Ultra Realistic',
    badge: '60HZ ULTRA REALISTIC',
    description:
      'True photorealistic 3D rendering optimized for 60Hz monitors: real-time 360° CubeCamera reflections of actual trees, buildings, bridges, curbs, and rival cars across the chassis, 4K soft shadows, reflective wing mirrors, PBR road sheen, and HDR bloom.',
    maxPixelRatio: 2.0,
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 4096,
    useSoftShadows: true,
    useEnvironmentReflections: true,
    envMapIntensity: 2.4,
    trackSegments: 1280,
    asphaltTextureSize: 2048,
    anisotropy: 16,
    sceneryMode: 'ultra',
    carGeometrySegments: 48,
    usePhysicalClearcoat: true,
    enableRimAndFillLights: true,
    enableSpeedParticlesAndSparks: true,
    cameraSmoothingHz: 32,
  },
};

export interface DynamicGpuProfile {
  qualityScore: number; // 0.15 to 1.00
  preferShadowsOverReflections: boolean; // Whether this GPU runs faster with Shadows ON + Refl OFF vs Refl ON + Shadows OFF
}

const DYNAMIC_GPU_PROFILE_KEY = 'apex26_dynamic_gpu_profile_v2';

export function getStoredDynamicGpuProfile(): DynamicGpuProfile {
  if (typeof window === 'undefined') {
    return { qualityScore: 0.65, preferShadowsOverReflections: true };
  }
  try {
    const raw = localStorage.getItem(DYNAMIC_GPU_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.qualityScore === 'number') {
        return {
          qualityScore: Math.max(0.15, Math.min(1.0, parsed.qualityScore)),
          preferShadowsOverReflections:
            typeof parsed.preferShadowsOverReflections === 'boolean'
              ? parsed.preferShadowsOverReflections
              : true,
        };
      }
    }
  } catch {
    // Ignore storage error
  }
  // Start at a safe, fast 65% profile on the very first run so the race launch is 100% lag-free, then ramp up if 60 FPS holds!
  return { qualityScore: 0.65, preferShadowsOverReflections: true };
}

export function setStoredDynamicGpuProfile(profile: DynamicGpuProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DYNAMIC_GPU_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage error
  }
}

type Listener = (quality: GraphicsQuality) => void;
const listeners = new Set<Listener>();

export function getStoredGraphicsQuality(): GraphicsQuality {
  if (typeof window === 'undefined') return 'dynamic';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (
      raw === 'dynamic' ||
      raw === 'low' ||
      raw === 'medium' ||
      raw === 'high' ||
      raw === 'ultra'
    ) {
      return raw;
    }
  } catch {
    // Ignore storage error
  }
  return 'dynamic';
}

export function setStoredGraphicsQuality(quality: GraphicsQuality): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, quality);
    } catch {
      // Ignore storage error
    }
  }
  listeners.forEach((cb) => cb(quality));
}

export function onGraphicsQualityChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export const GRAPHICS_PRESET_LABELS: Record<
  GraphicsQuality,
  { label: string; subtitle: string }
> = {
  dynamic: {
    label: GRAPHICS_PRESETS.dynamic.shortLabel,
    subtitle: GRAPHICS_PRESETS.dynamic.description,
  },
  low: {
    label: GRAPHICS_PRESETS.low.shortLabel,
    subtitle: GRAPHICS_PRESETS.low.description,
  },
  medium: {
    label: GRAPHICS_PRESETS.medium.shortLabel,
    subtitle: GRAPHICS_PRESETS.medium.description,
  },
  high: {
    label: GRAPHICS_PRESETS.high.shortLabel,
    subtitle: GRAPHICS_PRESETS.high.description,
  },
  ultra: {
    label: GRAPHICS_PRESETS.ultra.shortLabel,
    subtitle: GRAPHICS_PRESETS.ultra.description,
  },
};

export function getGraphicsPresetConfig(quality?: GraphicsQuality): GraphicsPresetConfig {
  const q = quality || getStoredGraphicsQuality();
  return GRAPHICS_PRESETS[q] || GRAPHICS_PRESETS.dynamic;
}


