export type UnitSystem = 'metric' | 'imperial';

const STORAGE_KEY_UNITS = 'apex26_unit_system_v1';
const UNIT_CHANGE_EVENT = 'apex26_unit_changed';

export function getStoredUnitSystem(): UnitSystem {
  if (typeof localStorage === 'undefined') return 'metric';
  const val = localStorage.getItem(STORAGE_KEY_UNITS);
  return val === 'imperial' ? 'imperial' : 'metric';
}

export function setStoredUnitSystem(unit: UnitSystem): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_UNITS, unit);
  window.dispatchEvent(new CustomEvent(UNIT_CHANGE_EVENT, { detail: { unit } }));
}

export function onUnitSystemChange(callback: (unit: UnitSystem) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<{ unit: UnitSystem }>;
    callback(customEvent.detail.unit);
  };
  window.addEventListener(UNIT_CHANGE_EVENT, handler);
  return () => window.removeEventListener(UNIT_CHANGE_EVENT, handler);
}

export function convertSpeed(kmh: number, unit: UnitSystem): number {
  if (typeof kmh !== 'number' || !Number.isFinite(kmh)) return 0;
  if (unit === 'imperial') {
    return kmh * 0.621371; // km/h to mph
  }
  return kmh;
}

export function formatSpeed(kmh: number, unit: UnitSystem, includeUnit: boolean = true): string {
  const safeKmh = typeof kmh === 'number' && Number.isFinite(kmh) ? kmh : 0;
  const val = Math.round(convertSpeed(safeKmh, unit));
  if (!includeUnit) return `${val}`;
  return `${val} ${unit === 'imperial' ? 'MPH' : 'KM/H'}`;
}

export function convertDistance(km: number, unit: UnitSystem): number {
  if (typeof km !== 'number' || !Number.isFinite(km)) return 0;
  if (unit === 'imperial') {
    return km * 0.621371; // km to miles
  }
  return km;
}

export function formatDistance(km: number, unit: UnitSystem, decimals: number = 2): string {
  const safeKm = typeof km === 'number' && Number.isFinite(km) ? km : 0;
  const val = convertDistance(safeKm, unit).toFixed(decimals);
  return `${val} ${unit === 'imperial' ? 'MILES' : 'KM'}`;
}

export function convertTemp(celsius: number, unit: UnitSystem): number {
  if (typeof celsius !== 'number' || !Number.isFinite(celsius)) return 0;
  if (unit === 'imperial') {
    return Math.round((celsius * 9) / 5 + 32); // Celsius to Fahrenheit
  }
  return Math.round(celsius);
}

export function formatTemp(celsius: number, unit: UnitSystem): string {
  const safeC = typeof celsius === 'number' && Number.isFinite(celsius) ? celsius : 0;
  const val = convertTemp(safeC, unit);
  return `${val}°${unit === 'imperial' ? 'F' : 'C'}`;
}

export function getSpeedUnitLabel(unit: UnitSystem): string {
  return unit === 'imperial' ? 'MPH' : 'KM/H';
}

export function getDistanceUnitLabel(unit: UnitSystem): string {
  return unit === 'imperial' ? 'MI' : 'KM';
}

export function getTempUnitLabel(unit: UnitSystem): string {
  return unit === 'imperial' ? '°F' : '°C';
}
