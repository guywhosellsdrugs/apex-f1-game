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

export type TimeOfDayPreset =
  | 'live'
  | 'sunrise'
  | 'morning'
  | 'noon'
  | 'golden_hour'
  | 'sunset'
  | 'night';

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
  sunAltitude: number; // -1.0 to 1.0 (sin of solar elevation angle)
  sunElevationDeg: number; // true astronomical elevation in degrees (-90..+90)
  sunAzimuthDeg: number; // true astronomical azimuth clockwise from North (0=N, 90=E, 180=S, 270=W)
  sunriseHour: number; // exact today's sunrise hour in America/New_York
  sunsetHour: number; // exact today's sunset hour in America/New_York
  sunriseString: string;
  sunsetString: string;
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

let activeTimeOfDayPreset: TimeOfDayPreset = 'live';

export function getTimeOfDayPreset(): TimeOfDayPreset {
  return activeTimeOfDayPreset;
}

export function setTimeOfDayPreset(preset: TimeOfDayPreset): void {
  activeTimeOfDayPreset = preset;
}

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

function formatHour12(hourFloat: number, tzLabel: string): string {
  const wrapped = ((hourFloat % 24) + 24) % 24;
  let h = Math.floor(wrapped);
  let m = Math.round((wrapped - h) * 60);
  if (m >= 60) {
    m -= 60;
    h = (h + 1) % 24;
  }
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix} ${tzLabel}`;
}

function computeGaithersburgSolarPosition(
  year: number,
  month: number,
  day: number,
  localHour: number,
  utcOffsetHours: number
): {
  elevationDeg: number;
  azimuthDeg: number;
  sunAltitude: number;
  sunriseHour: number;
  sunsetHour: number;
} {
  const startOfYear = Date.UTC(year, 0, 1);
  const currentDayUtc = Date.UTC(year, month - 1, day);
  const dayOfYear = Math.floor((currentDayUtc - startOfYear) / 86400000) + 1;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;

  // NOAA Solar Calculation equations (accurate within ~1 minute for sunrise/sunset)
  const gamma = ((2 * Math.PI) / daysInYear) * (dayOfYear - 1 + (localHour - 12) / 24);

  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const declRad =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latRad = (GAITHERSBURG_LAT * Math.PI) / 180;
  const timeOffsetMin = eqTime + 4 * GAITHERSBURG_LON - 60 * utcOffsetHours;
  const trueSolarTimeMin = ((localHour * 60 + timeOffsetMin) % 1440 + 1440) % 1440;
  const hourAngleDeg = trueSolarTimeMin / 4 - 180;
  const hourAngleRad = (hourAngleDeg * Math.PI) / 180;

  const sinElev =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);
  const clampedSinElev = Math.max(-1, Math.min(1, sinElev));
  const elevationRad = Math.asin(clampedSinElev);
  const elevationDeg = (elevationRad * 180) / Math.PI;

  // Solar Azimuth clockwise from true North (0 = N, 90 = E, 180 = S, 270 = W)
  const cosZenith = Math.max(0.0001, Math.cos(elevationRad));
  const cosAz = Math.max(
    -1,
    Math.min(1, (Math.sin(declRad) - Math.sin(latRad) * clampedSinElev) / (Math.cos(latRad) * cosZenith))
  );
  let azimuthDeg = (Math.acos(cosAz) * 180) / Math.PI;
  if (hourAngleDeg > 0) {
    azimuthDeg = 360 - azimuthDeg;
  }

  // Exact official Sunrise/Sunset (solar zenith 90.833° including atmospheric refraction + disc radius)
  const zenithOfficialRad = (90.833 * Math.PI) / 180;
  const cosSunriseHa = Math.max(
    -1,
    Math.min(
      1,
      Math.cos(zenithOfficialRad) / (Math.cos(latRad) * Math.cos(declRad)) -
        Math.tan(latRad) * Math.tan(declRad)
    )
  );
  const sunriseHaDeg = (Math.acos(cosSunriseHa) * 180) / Math.PI;

  // Compute sunrise/sunset using noon equation-of-time for cleanest precision
  const gammaNoon = ((2 * Math.PI) / daysInYear) * (dayOfYear - 1);
  const eqNoon =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gammaNoon) -
      0.032077 * Math.sin(gammaNoon) -
      0.014615 * Math.cos(2 * gammaNoon) -
      0.040849 * Math.sin(2 * gammaNoon));
  const solarNoonMin = 720 - 4 * GAITHERSBURG_LON - eqNoon + 60 * utcOffsetHours;
  const sunriseHour = (solarNoonMin - sunriseHaDeg * 4) / 60;
  const sunsetHour = (solarNoonMin + sunriseHaDeg * 4) / 60;

  return {
    elevationDeg,
    azimuthDeg,
    sunAltitude: clampedSinElev,
    sunriseHour,
    sunsetHour,
  };
}

/**
 * Get current time & astronomical sun position in Gaithersburg, Maryland (America/New_York)
 */
export function getGaithersburgLocalTime(presetOverride?: TimeOfDayPreset): {
  localTimeString: string;
  localHour: number;
  isDaytime: boolean;
  sunAltitude: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  sunriseHour: number;
  sunsetHour: number;
  sunriseString: string;
  sunsetString: string;
} {
  const now = new Date();
  const effectivePreset = presetOverride ?? activeTimeOfDayPreset;

  const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    timeZoneName: 'short',
  });
  const parts = dateTimeFormatter.formatToParts(now);
  const getNum = (type: string, fallback: number) =>
    Number(parts.find((p) => p.type === type)?.value ?? fallback);

  const year = getNum('year', now.getUTCFullYear());
  const month = getNum('month', now.getUTCMonth() + 1);
  const day = getNum('day', now.getUTCDate());
  const rawHourPart = getNum('hour', 12);
  const hourPart = rawHourPart === 24 ? 0 : rawHourPart;
  const minPart = getNum('minute', 0);
  const secPart = getNum('second', 0);
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'EST';
  const utcOffsetHours = tzName.includes('EDT') ? -4 : -5;

  const liveHour = hourPart + minPart / 60 + secPart / 3600;

  // Compute exact today's sunrise & sunset for Gaithersburg, MD first
  const baseSolar = computeGaithersburgSolarPosition(year, month, day, liveHour, utcOffsetHours);

  let localHour = liveHour;
  if (effectivePreset === 'sunrise') {
    localHour = baseSolar.sunriseHour + 0.08; // ~5 mins past horizon emergence
  } else if (effectivePreset === 'morning') {
    localHour = baseSolar.sunriseHour + 2.2;
  } else if (effectivePreset === 'noon') {
    localHour = (baseSolar.sunriseHour + baseSolar.sunsetHour) * 0.5;
  } else if (effectivePreset === 'golden_hour') {
    localHour = baseSolar.sunsetHour - 0.65;
  } else if (effectivePreset === 'sunset') {
    localHour = baseSolar.sunsetHour - 0.06; // glowing solar disc touching western Piedmont horizon
  } else if (effectivePreset === 'night') {
    localHour = 23.0;
  }

  const solar = computeGaithersburgSolarPosition(year, month, day, localHour, utcOffsetHours);
  const isDaytime = solar.elevationDeg > -0.833;

  const localTimeString =
    effectivePreset === 'live'
      ? new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        }).format(now)
      : formatHour12(localHour, tzName);

  return {
    localTimeString,
    localHour,
    isDaytime,
    sunAltitude: solar.sunAltitude,
    sunElevationDeg: solar.elevationDeg,
    sunAzimuthDeg: solar.azimuthDeg,
    sunriseHour: solar.sunriseHour,
    sunsetHour: solar.sunsetHour,
    sunriseString: formatHour12(solar.sunriseHour, tzName),
    sunsetString: formatHour12(solar.sunsetHour, tzName),
  };
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
  const timeInfo = getGaithersburgLocalTime();
  const { localTimeString, localHour, isDaytime, sunAltitude } = timeInfo;

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
            sunElevationDeg: timeInfo.sunElevationDeg,
            sunAzimuthDeg: timeInfo.sunAzimuthDeg,
            sunriseHour: timeInfo.sunriseHour,
            sunsetHour: timeInfo.sunsetHour,
            sunriseString: timeInfo.sunriseString,
            sunsetString: timeInfo.sunsetString,
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
      sunElevationDeg: timeInfo.sunElevationDeg,
      sunAzimuthDeg: timeInfo.sunAzimuthDeg,
      sunriseHour: timeInfo.sunriseHour,
      sunsetHour: timeInfo.sunsetHour,
      sunriseString: timeInfo.sunriseString,
      sunsetString: timeInfo.sunsetString,
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
    // Graceful offline fallback: realistic Gaithersburg climate
    return getFallbackGaithersburgWeather(
      localTimeString,
      localHour,
      isDaytime,
      sunAltitude,
      timeInfo
    );
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
  sunAltitude: number,
  solarExtras?: {
    sunElevationDeg?: number;
    sunAzimuthDeg?: number;
    sunriseHour?: number;
    sunsetHour?: number;
    sunriseString?: string;
    sunsetString?: string;
  }
): GaithersburgWeather {
  const elevDeg = solarExtras?.sunElevationDeg ?? (Math.asin(Math.max(-1, Math.min(1, sunAltitude))) * 180) / Math.PI;
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
    sunElevationDeg: elevDeg,
    sunAzimuthDeg: solarExtras?.sunAzimuthDeg ?? 180,
    sunriseHour: solarExtras?.sunriseHour ?? 6.75,
    sunsetHour: solarExtras?.sunsetHour ?? 17.5,
    sunriseString: solarExtras?.sunriseString ?? '6:45 AM EST',
    sunsetString: solarExtras?.sunsetString ?? '5:30 PM EST',
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
  baseTime?: ReturnType<typeof getGaithersburgLocalTime>
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
    sunElevationDeg: time.sunElevationDeg,
    sunAzimuthDeg: time.sunAzimuthDeg,
    sunriseHour: time.sunriseHour,
    sunsetHour: time.sunsetHour,
    sunriseString: time.sunriseString,
    sunsetString: time.sunsetString,
    roadGrip: getBaseRoadGrip(override),
    isRaining,
    isSnowing,
    isFoggy,
    source: 'override',
  };
}
