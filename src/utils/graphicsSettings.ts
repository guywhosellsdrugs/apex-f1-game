export type GraphicsQuality =
  | 'dynamic_conservative'
  | 'dynamic_aggressive'
  | 'retro'
  | 'retro_pixel'
  | 'low'
  | 'medium'
  | 'high'
  | 'ultra';

export const GRAPHICS_QUALITY_OPTIONS: GraphicsQuality[] = [
  'dynamic_conservative',
  'dynamic_aggressive',
  'retro',
  'retro_pixel',
  'low',
  'medium',
  'high',
  'ultra',
];

export function isDynamicGraphics(quality: GraphicsQuality): boolean {
  return quality === 'dynamic_conservative' || quality === 'dynamic_aggressive';
}

export interface GraphicsPresetConfig {
  id: GraphicsQuality;
  label: string;
  shortLabel: string;
  hudButtonLabel: string;
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
  isRetroStyle?: boolean;
}

const STORAGE_KEY = 'apex26_graphics_quality_v2';

export const GRAPHICS_PRESETS: Record<GraphicsQuality, GraphicsPresetConfig> = {
  dynamic_conservative: {
    id: 'dynamic_conservative',
    label: 'Conservative Dynamic (60+ FPS Always · Crisp 1.0x+ Clarity · Zero Pixelation)',
    shortLabel: 'Conservative Dynamic',
    hudButtonLabel: 'Dyn: 60+ Crisp',
    badge: '60+ FPS · CRISP HD (NO PIXELATION)',
    description:
      'Locks razor-sharp native 1.0x+ screen resolution with anti-aliasing so the image is never blurry or pixelated, while keeping 60+ FPS via instant draw-call culling, fast shaders, and smart scenery/LOD distance scaling.',
    maxPixelRatio: 1.15,
    antialias: true,
    shadowsEnabled: false,
    shadowMapSize: 512,
    useSoftShadows: false,
    useEnvironmentReflections: false,
    envMapIntensity: 0.65,
    trackSegments: 440,
    asphaltTextureSize: 1024,
    anisotropy: 4,
    sceneryMode: 'standard',
    carGeometrySegments: 16,
    usePhysicalClearcoat: false,
    enableRimAndFillLights: false,
    enableSpeedParticlesAndSparks: false,
    cameraSmoothingHz: 32,
  },
  dynamic_aggressive: {
    id: 'dynamic_aggressive',
    label: 'Aggressive Dynamic (High Quality + Hard Playable Floor · Never <40 FPS · Uncapped)',
    shortLabel: 'Aggressive Dynamic',
    hudButtonLabel: 'Dyn: Quality',
    badge: 'HIGH QUALITY · PLAYABLE FLOOR',
    description:
      'Keeps maximum detail, full circuit scenery, and multi-point lighting active as long as possible while enforcing a hard playability floor so FPS never drops into the 20–30 FPS range. Uncapped max FPS on fast GPUs.',
    maxPixelRatio: 1.4,
    antialias: true,
    shadowsEnabled: false,
    shadowMapSize: 512,
    useSoftShadows: false,
    useEnvironmentReflections: false,
    envMapIntensity: 1.0,
    trackSegments: 640,
    asphaltTextureSize: 1024,
    anisotropy: 6,
    sceneryMode: 'standard',
    carGeometrySegments: 22,
    usePhysicalClearcoat: false,
    enableRimAndFillLights: true,
    enableSpeedParticlesAndSparks: true,
    cameraSmoothingHz: 32,
  },
  retro: {
    id: 'retro',
    label: "Retro Arcade '89 (90s Virtua Racing / OutRun Polygon Style · 60+ FPS)",
    shortLabel: "Retro Arcade '89",
    hudButtonLabel: 'Retro Arcade',
    badge: '90s ARCADE POLYGON · 60+ FPS',
    description:
      'Authentic 1990s SEGA Virtua Racing & OutRun flat-shaded polygon aesthetic with synthwave sunset grid horizon, high-contrast arcade curbs, bold faceted 3D cars, and locked 60+ FPS speed.',
    maxPixelRatio: 1.25,
    antialias: true,
    shadowsEnabled: false,
    shadowMapSize: 256,
    useSoftShadows: false,
    useEnvironmentReflections: false,
    envMapIntensity: 0.5,
    trackSegments: 360,
    asphaltTextureSize: 1024,
    anisotropy: 4,
    sceneryMode: 'standard',
    carGeometrySegments: 8,
    usePhysicalClearcoat: false,
    enableRimAndFillLights: true,
    enableSpeedParticlesAndSparks: true,
    cameraSmoothingHz: 34,
    isRetroStyle: true,
  },
  retro_pixel: {
    id: 'retro_pixel',
    label: "Retro Pixel '92 (Slightly Pixelated 16-Bit CRT Arcade · 60+ FPS)",
    shortLabel: "Retro Pixel '92",
    hudButtonLabel: 'Retro Pixel',
    badge: '16-BIT PIXELATED · 60+ FPS',
    description:
      'Slightly pixelated 16-bit CRT arcade renderer with crisp nearest-neighbor pixel blocks, flat-shaded low-poly F1 cars, OutRun neon grid horizon, and ultra-fast 60+ FPS.',
    maxPixelRatio: 0.42,
    antialias: false,
    shadowsEnabled: false,
    shadowMapSize: 256,
    useSoftShadows: false,
    useEnvironmentReflections: false,
    envMapIntensity: 0.5,
    trackSegments: 320,
    asphaltTextureSize: 512,
    anisotropy: 1,
    sceneryMode: 'standard',
    carGeometrySegments: 8,
    usePhysicalClearcoat: false,
    enableRimAndFillLights: true,
    enableSpeedParticlesAndSparks: true,
    cameraSmoothingHz: 34,
    isRetroStyle: true,
  },
  low: {
    id: 'low',
    label: 'Low (Maximum FPS / Entry Devices · Crisp Native Resolution)',
    shortLabel: 'Low (Fast)',
    hudButtonLabel: 'Low',
    badge: 'MAX FPS · UNCAPPED',
    description:
      'Lightweight geometry and fast shaders at clean 1.0x resolution for lower-end laptops or ultra-high-refresh competitive racing with zero FPS cap.',
    maxPixelRatio: 1.0,
    antialias: true,
    shadowsEnabled: false,
    shadowMapSize: 256,
    useSoftShadows: false,
    useEnvironmentReflections: false,
    envMapIntensity: 0.4,
    trackSegments: 320,
    asphaltTextureSize: 1024,
    anisotropy: 2,
    sceneryMode: 'minimal',
    carGeometrySegments: 12,
    usePhysicalClearcoat: false,
    enableRimAndFillLights: false,
    enableSpeedParticlesAndSparks: false,
    cameraSmoothingHz: 26,
  },
  medium: {
    id: 'medium',
    label: 'Medium (Balanced Performance · Uncapped FPS)',
    shortLabel: 'Medium',
    hudButtonLabel: 'Med',
    badge: 'BALANCED · UNCAPPED',
    description:
      'Balanced 1080p anti-aliasing, crisp lighting, and circuit landmarks with completely uncapped frame rates.',
    maxPixelRatio: 1.15,
    antialias: true,
    shadowsEnabled: false,
    shadowMapSize: 512,
    useSoftShadows: false,
    useEnvironmentReflections: false,
    envMapIntensity: 0.9,
    trackSegments: 600,
    asphaltTextureSize: 1024,
    anisotropy: 4,
    sceneryMode: 'standard',
    carGeometrySegments: 20,
    usePhysicalClearcoat: false,
    enableRimAndFillLights: false,
    enableSpeedParticlesAndSparks: true,
    cameraSmoothingHz: 28,
  },
  high: {
    id: 'high',
    label: 'High (Broadcast Quality · Uncapped FPS)',
    shortLabel: 'High',
    hudButtonLabel: 'High',
    badge: 'HIGH PBR · UNCAPPED',
    description:
      'High-definition F1 broadcast visuals with clearcoat bodywork, natural environment reflections, full circuit landmarks, and uncapped FPS.',
    maxPixelRatio: 1.4,
    antialias: true,
    shadowsEnabled: false,
    shadowMapSize: 1024,
    useSoftShadows: false,
    useEnvironmentReflections: true,
    envMapIntensity: 0.72,
    trackSegments: 880,
    asphaltTextureSize: 1024,
    anisotropy: 8,
    sceneryMode: 'full',
    carGeometrySegments: 32,
    usePhysicalClearcoat: true,
    enableRimAndFillLights: true,
    enableSpeedParticlesAndSparks: true,
    cameraSmoothingHz: 32,
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra Realistic (Photorealistic Clearcoat Reflections · Uncapped FPS)',
    shortLabel: 'Ultra Realistic',
    hudButtonLabel: 'Ultra',
    badge: 'ULTRA PBR · TRUE REFLECTIONS',
    description:
      'Photorealistic 360° PMREM sky & horizon environment reflections, Neutral broadcast tone-mapping (zero harsh glare blowouts), multi-layer automotive clearcoat lacquer, satin carbon weave, and uncapped FPS.',
    maxPixelRatio: 1.75,
    antialias: true,
    shadowsEnabled: false,
    shadowMapSize: 2048,
    useSoftShadows: false,
    useEnvironmentReflections: true,
    envMapIntensity: 0.82,
    trackSegments: 1120,
    asphaltTextureSize: 2048,
    anisotropy: 16,
    sceneryMode: 'ultra',
    carGeometrySegments: 42,
    usePhysicalClearcoat: true,
    enableRimAndFillLights: true,
    enableSpeedParticlesAndSparks: true,
    cameraSmoothingHz: 36,
  },
};

export interface DynamicGpuProfile {
  qualityScore: number; // 0.01 to 1.00
  preferShadowsOverReflections: boolean;
}

const DYNAMIC_GPU_PROFILE_KEY = 'apex26_dynamic_gpu_profile_v6';

export function getStoredDynamicGpuProfile(mode?: GraphicsQuality): DynamicGpuProfile {
  const defaultScore = mode === 'dynamic_aggressive' ? 0.75 : 0.65;
  if (typeof window === 'undefined') {
    return { qualityScore: defaultScore, preferShadowsOverReflections: true };
  }
  try {
    const key =
      mode === 'dynamic_aggressive'
        ? `${DYNAMIC_GPU_PROFILE_KEY}_aggressive`
        : `${DYNAMIC_GPU_PROFILE_KEY}_conservative`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.qualityScore === 'number') {
        return {
          qualityScore: Math.max(0.05, Math.min(1.0, parsed.qualityScore)),
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
  return { qualityScore: defaultScore, preferShadowsOverReflections: true };
}

export function setStoredDynamicGpuProfile(
  profile: DynamicGpuProfile,
  mode?: GraphicsQuality
): void {
  if (typeof window === 'undefined') return;
  try {
    const key =
      mode === 'dynamic_aggressive'
        ? `${DYNAMIC_GPU_PROFILE_KEY}_aggressive`
        : `${DYNAMIC_GPU_PROFILE_KEY}_conservative`;
    localStorage.setItem(key, JSON.stringify(profile));
  } catch {
    // Ignore storage error
  }
}

type Listener = (quality: GraphicsQuality) => void;
const listeners = new Set<Listener>();

export function getStoredGraphicsQuality(): GraphicsQuality {
  if (typeof window === 'undefined') return 'dynamic_conservative';
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('apex26_graphics_quality_v1');
    if (raw === 'dynamic') return 'dynamic_conservative';
    if (
      raw === 'dynamic_conservative' ||
      raw === 'dynamic_aggressive' ||
      raw === 'retro' ||
      raw === 'retro_pixel' ||
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
  return 'dynamic_conservative';
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
  dynamic_conservative: {
    label: GRAPHICS_PRESETS.dynamic_conservative.shortLabel,
    subtitle: GRAPHICS_PRESETS.dynamic_conservative.description,
  },
  dynamic_aggressive: {
    label: GRAPHICS_PRESETS.dynamic_aggressive.shortLabel,
    subtitle: GRAPHICS_PRESETS.dynamic_aggressive.description,
  },
  retro: {
    label: GRAPHICS_PRESETS.retro.shortLabel,
    subtitle: GRAPHICS_PRESETS.retro.description,
  },
  retro_pixel: {
    label: GRAPHICS_PRESETS.retro_pixel.shortLabel,
    subtitle: GRAPHICS_PRESETS.retro_pixel.description,
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
  return GRAPHICS_PRESETS[q] || GRAPHICS_PRESETS.dynamic_conservative;
}
