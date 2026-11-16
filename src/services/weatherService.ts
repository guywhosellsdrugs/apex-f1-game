/**
 * Live Weather & Time Service for Gaithersburg, Maryland
 * Coordinates: Latitude 39.1434° N, Longitude -77.2014° W
 * Timezone: America/New_York (US Eastern Time)
 * 
 * Synchronizes in-game weather and diurnal cycle with real-world Gaithersburg, MD.
 * Provides authentic road grip multipliers and physics modifiers based on
 * rain, snow, fog, drivetrain (RWD / FWD / AWD), and vehicle ground clearance.
 */

export type WeatherConditionType =
  | 'clear'
  | 'partly_cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy_rain'
  | 'snow'
  | 'heavy_snow'
  | 'thunderstorm';

export type WeatherMode = 'live_gaithersburg' | WeatherConditionType;

export interface GaithersburgWeather {
  temperatureC: number;
  temperatureF: number;
  condition: WeatherConditionType;
  conditionLabel: string;
  weatherCode: number;
  isDay: boolean;
  cloudCover: number; // 0 - 100%
  precipitationRate: number; // 0.0 - 1.0
  rainMm: number;
  snowCm: number;
  windSpeedKmh: number;
  relativeHumidity: number;
  localTimeString: string; // e.g. "8:45 AM EDT"
  localHour: number; // 0 - 24 float
  sunAltitude: number; // -1.0 to 1.0 (positive = above horizon)
  roadGrip: number; // 0.30 to 1.0
  isRaining: boolean;
  isSnowing: boolean;
  isFoggy: boolean;
  source: 'live' | 'override';
}

const GAITHERSBURG_LAT = 39.1434;
const GAITHERSBURG_LON = -77.2014;
const CACHE_KEY = 'metrocity_gaithersburg_weather_cache';
const CACHE_DURATION_MS = 8 * 60 * 1000; // 8 minutes

// Map WMO Weather Codes to WeatherConditionType
export function mapWmoCodeToCondition(code: number, precipitationMm = 0, snowfallCm = 0): WeatherConditionType {
  if (snowfallCm > 0 || [71, 73, 75, 77, 85, 86].includes(code)) {
    return code === 75 || code === 86 || snowfallCm >= 2.0 ? 'heavy_snow' : 'snow';
  }
  if ([95, 96, 99].includes(code)) {
    return 'thunderstorm';
  }
  if ([63, 65, 81, 82].includes(code) || precipitationMm >= 4.0) {
    return 'heavy_rain';
  }
  if ([51, 53, 55, 56, 57].includes(code)) {
    return 'drizzle';
  }
  if ([61, 66, 67, 80].includes(code) || precipitationMm > 0) {
    return 'rain';
  }
  if ([45, 48].includes(code)) {
    return 'fog';
  }
  if (code === 3) {
    return 'overcast';
  }
  if (code === 1 || code === 2) {
    return 'partly_cloudy';
  }
  return 'clear';
}

/**
 * Get current time details in Gaithersburg, Maryland (America/New_York)
 */
export function getGaithersburgLocalTime(): {
  localTimeString: string;
  localHour: number;
  isDaytime: boolean;
  sunAltitude: number;
} {
  const now = new Date();
  
  // Format formatted string in Eastern Time
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
  const localTimeString = timeFormatter.format(now);

  // Extract numeric hour and minute in America/New_York
  const hourFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = hourFormatter.formatToParts(now);
  const rawHourPart = Number(parts.find((p) => p.type === 'hour')?.value ?? 12);
  const hourPart = rawHourPart === 24 ? 0 : rawHourPart;
  const minPart = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const secPart = Number(parts.find((p) => p.type === 'second')?.value ?? 0);

  const localHour = hourPart + minPart / 60 + secPart / 3600;

  // Maryland Sun Angle: Sunrise ~6:45 AM, Solar Noon ~12:00 PM, Sunset ~5:00 PM (winter) to ~8:30 PM (summer)
  // Approximate seasonal average: sunrise at 6.8h, sunset at 17.5h (November)
  const isDaytime = localHour >= 6.7 && localHour <= 17.6;

  // Normalized sun altitude from -1 (midnight) to +1 (zenith noon)
  let sunAltitude: number;
  if (isDaytime) {
    const dayProgress = (localHour - 6.7) / (17.6 - 6.7); // 0 to 1
    sunAltitude = Math.sin(dayProgress * Math.PI); // 0 at dawn/dusk, 1.0 at noon
  } else {
    const nightLength = 24 - (17.6 - 6.7);
    const nightProgress = localHour > 17.6 ? (localHour - 17.6) / nightLength : (localHour + 24 - 17.6) / nightLength;
    sunAltitude = -Math.sin(nightProgress * Math.PI);
  }

  return { localTimeString, localHour, isDaytime, sunAltitude };
}

/**
 * Base road grip based on weather condition
 */
export function getBaseRoadGrip(condition: WeatherConditionType): number {
  switch (condition) {
    case 'clear':
      return 1.0;
    case 'partly_cloudy':
      return 1.0;
    case 'overcast':
      return 0.98;
    case 'fog':
      return 0.88; // damp tarmac
    case 'drizzle':
      return 0.80;
    case 'rain':
      return 0.70; // wet tarmac
    case 'heavy_rain':
    case 'thunderstorm':
      return 0.60; // standing water, hydroplaning risk
    case 'snow':
      return 0.42; // slick snowy surface
    case 'heavy_snow':
      return 0.32; // deep snow and ice slush
    default:
      return 1.0;
  }
}

/**
 * Calculates authentic vehicle traction modifier based on:
 * - Weather condition & road surface grip
 * - Drivetrain: AWD struggles least; FWD moderate; RWD struggles most in snow/rain (rear slips easily)
 * - Ground Clearance: High clearance (Cadillac Escalade, Chevy Tahoe) struggles significantly less
 *   in snow than low-slung, stiff sports cars (Nissan GT-R, Huracan, Jesko)
 */
export function calculateDrivetrainTractionModifier(
  drivetrain: 'FWD' | 'RWD' | 'AWD',
  groundClearance: 'low' | 'medium' | 'high',
  weather: GaithersburgWeather
): {
  effectiveGrip: number;
  launchGrip: number;
  fishtailFactor: number;
  tractionSummary: string;
} {
  const baseGrip = weather.roadGrip;
  const isWet = weather.isRaining || weather.condition === 'drizzle' || weather.condition === 'thunderstorm';
  const isSnow = weather.isSnowing;

  let dtMultiplier = 1.0;
  let launchGripMultiplier = 1.0;
  let fishtail = 0.0;

  if (isSnow) {
    if (drivetrain === 'AWD') {
      dtMultiplier = 0.90;
      launchGripMultiplier = 0.92;
      fishtail = 0.08;
    } else if (drivetrain === 'FWD') {
      dtMultiplier = 0.68;
      launchGripMultiplier = 0.72;
      fishtail = 0.04; // FWD understeers rather than fishtails
    } else {
      // RWD struggles most in snow!
      dtMultiplier = 0.42;
      launchGripMultiplier = 0.38;
      fishtail = 0.65; // Severe oversteer / wheelspin
    }

    // Ground clearance factor in snow:
    // High clearance (Escalade, Tahoe) powers over snowbanks without getting beached;
    // Low clearance (GT-R, supercars) acts like a snow plow and loses traction!
    if (groundClearance === 'high') {
      dtMultiplier += 0.16;
      launchGripMultiplier += 0.18;
    } else if (groundClearance === 'low') {
      dtMultiplier -= 0.12;
      launchGripMultiplier -= 0.14;
    }
  } else if (isWet) {
    if (drivetrain === 'AWD') {
      dtMultiplier = 0.96;
      launchGripMultiplier = 0.98;
      fishtail = 0.04;
    } else if (drivetrain === 'FWD') {
      dtMultiplier = 0.85;
      launchGripMultiplier = 0.88;
      fishtail = 0.02;
    } else {
      // RWD struggles in rain
      dtMultiplier = 0.70;
      launchGripMultiplier = 0.68;
      fishtail = 0.40;
    }

    if (groundClearance === 'high') {
      dtMultiplier += 0.06; // Less hydroplaning with tall truck tires
    } else if (groundClearance === 'low') {
      dtMultiplier -= 0.05;
    }
  }

  const effectiveGrip = Math.max(0.24, Math.min(1.05, baseGrip * dtMultiplier));
  const launchGrip = Math.max(0.22, Math.min(1.05, baseGrip * launchGripMultiplier));

  let tractionSummary = 'Optimal Dry Grip';
  if (isSnow) {
    if (drivetrain === 'AWD') {
      tractionSummary = groundClearance === 'high' ? 'AWD + High Clearance: Superior Snow Grip' : 'AWD: Controlled Snow Traction';
    } else if (drivetrain === 'FWD') {
      tractionSummary = 'FWD: Moderate Snow Grip (Watch Understeer)';
    } else {
      tractionSummary = 'RWD: Severe Snow Wheelspin & Fishtailing!';
    }
  } else if (isWet) {
    if (drivetrain === 'AWD') {
      tractionSummary = 'AWD: High Wet Surface Grip';
    } else if (drivetrain === 'FWD') {
      tractionSummary = 'FWD: Stable Wet Traction';
    } else {
      tractionSummary = 'RWD: Slippery Rear Grip (Gentle Throttle)';
    }
  }

  return {
    effectiveGrip,
    launchGrip,
    fishtailFactor: fishtail,
    tractionSummary,
  };
}

/**
 * Fetch Live Weather for Gaithersburg, Maryland from Open-Meteo API
 */
export async function fetchLiveGaithersburgWeather(): Promise<GaithersburgWeather> {
  const { localTimeString, localHour, isDaytime, sunAltitude } = getGaithersburgLocalTime();

  try {
    // Check cached weather first
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const cached = window.sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
          return {
            ...parsed.data,
            localTimeString,
            localHour,
            isDay: isDaytime,
            sunAltitude,
          };
        }
      }
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${GAITHERSBURG_LAT}&longitude=${GAITHERSBURG_LON}&current=temperature_2m,relative_humidity_2m,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m&timezone=America%2FNew_York`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Open-Meteo returned status ${res.status}`);
    }

    const json = await res.json();
    const current = json.current || {};

    const tempC = current.temperature_2m ?? 12.0;
    const tempF = Math.round((tempC * 9) / 5 + 32);
    const code = current.weather_code ?? 0;
    const rain = (current.rain ?? 0) + (current.showers ?? 0) + (current.precipitation ?? 0);
    const snowfall = current.snowfall ?? 0;
    const cloudCover = current.cloud_cover ?? 40;
    const windKmh = current.wind_speed_10m ?? 8.0;
    const humidity = current.relative_humidity_2m ?? 65;

    const condition = mapWmoCodeToCondition(code, rain, snowfall);
    const isRaining = condition === 'rain' || condition === 'heavy_rain' || condition === 'drizzle' || condition === 'thunderstorm';
    const isSnowing = condition === 'snow' || condition === 'heavy_snow';
    const isFoggy = condition === 'fog';

    const precipRate = isSnowing
      ? Math.min(1.0, 0.4 + (snowfall / 3.0) * 0.6)
      : isRaining
      ? Math.min(1.0, 0.35 + (rain / 8.0) * 0.65)
      : 0.0;

    const weatherData: GaithersburgWeather = {
      temperatureC: Math.round(tempC * 10) / 10,
      temperatureF: tempF,
      condition,
      conditionLabel: getConditionLabel(condition),
      weatherCode: code,
      isDay: isDaytime,
      cloudCover,
      precipitationRate: precipRate,
      rainMm: rain,
      snowCm: snowfall,
      windSpeedKmh: windKmh,
      relativeHumidity: humidity,
      localTimeString,
      localHour,
      sunAltitude,
      roadGrip: getBaseRoadGrip(condition),
      isRaining,
      isSnowing,
      isFoggy,
      source: 'live',
    };

    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ timestamp: Date.now(), data: weatherData })
      );
    }

    return weatherData;
  } catch (_err) {
    // Graceful offline fallback: realistic Gaithersburg late-autumn climate
    return getFallbackGaithersburgWeather(localTimeString, localHour, isDaytime, sunAltitude);
  }
}

function getConditionLabel(condition: WeatherConditionType): string {
  switch (condition) {
    case 'clear':
      return 'Clear Skies';
    case 'partly_cloudy':
      return 'Partly Cloudy';
    case 'overcast':
      return 'Overcast';
    case 'fog':
      return 'Morning Fog';
    case 'drizzle':
      return 'Light Drizzle';
    case 'rain':
      return 'Rain Showers';
    case 'heavy_rain':
      return 'Heavy Downpour';
    case 'snow':
      return 'Snow Flurries';
    case 'heavy_snow':
      return 'Heavy Snowstorm';
    case 'thunderstorm':
      return 'Thunderstorm';
    default:
      return 'Clear';
  }
}

export function getFallbackGaithersburgWeather(
  localTimeString: string,
  localHour: number,
  isDaytime: boolean,
  sunAltitude: number
): GaithersburgWeather {
  return {
    temperatureC: 17.5,
    temperatureF: 64,
    condition: 'clear',
    conditionLabel: 'Clear Skies',
    weatherCode: 0,
    isDay: isDaytime,
    cloudCover: 12,
    precipitationRate: 0.0,
    rainMm: 0.0,
    snowCm: 0.0,
    windSpeedKmh: 9.5,
    relativeHumidity: 52,
    localTimeString,
    localHour,
    sunAltitude,
    roadGrip: 1.0,
    isRaining: false,
    isSnowing: false,
    isFoggy: false,
    source: 'live',
  };
}

/**
 * Generate synthetic weather data for manual testing override modes
 */
export function getOverriddenWeather(
  override: WeatherConditionType,
  baseTime?: { localTimeString: string; localHour: number; isDaytime: boolean; sunAltitude: number }
): GaithersburgWeather {
  const time = baseTime || getGaithersburgLocalTime();
  const isRaining = override === 'rain' || override === 'heavy_rain' || override === 'drizzle' || override === 'thunderstorm';
  const isSnowing = override === 'snow' || override === 'heavy_snow';
  const isFoggy = override === 'fog';

  let tempC = 12.0;
  if (isSnowing) tempC = override === 'heavy_snow' ? -4.5 : -1.5;
  if (isRaining) tempC = 8.5;

  const tempF = Math.round((tempC * 9) / 5 + 32);
  const cloudCover =
    isSnowing || isRaining
      ? 100
      : override === 'overcast'
      ? 95
      : isFoggy
      ? 85
      : override === 'partly_cloudy'
      ? 52
      : 8;
  const weatherCode = isSnowing
    ? 75
    : isRaining
    ? 65
    : isFoggy
    ? 45
    : override === 'overcast'
    ? 3
    : override === 'partly_cloudy'
    ? 2
    : 0;

  return {
    temperatureC: tempC,
    temperatureF: tempF,
    condition: override,
    conditionLabel: getConditionLabel(override),
    weatherCode,
    isDay: time.isDaytime,
    cloudCover,
    precipitationRate: override === 'heavy_snow' || override === 'heavy_rain' ? 0.95 : isSnowing || isRaining ? 0.6 : 0.0,
    rainMm: isRaining ? 5.4 : 0.0,
    snowCm: isSnowing ? (override === 'heavy_snow' ? 4.5 : 1.2) : 0.0,
    windSpeedKmh: override === 'overcast' ? 16.0 : override === 'partly_cloudy' ? 13.0 : isFoggy ? 6.0 : 11.0,
    relativeHumidity: isRaining || isSnowing ? 98 : override === 'overcast' ? 76 : 56,
    localTimeString: time.localTimeString,
    localHour: time.localHour,
    sunAltitude: time.sunAltitude,
    roadGrip: getBaseRoadGrip(override),
    isRaining,
    isSnowing,
    isFoggy,
    source: 'override',
  };
}
