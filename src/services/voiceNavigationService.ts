import type { GpsManeuverType } from '../game/cityTrafficBuilder';

export function formatGoogleMapsDistance(meters: number): {
  shortText: string;
  spokenText: string;
} {
  const safeM = Math.max(0, meters);
  const feet = safeM * 3.28084;
  if (feet < 950) {
    const roundedFt =
      feet < 150
        ? Math.max(50, Math.round(feet / 25) * 25)
        : Math.round(feet / 50) * 50;
    return {
      shortText: `${roundedFt} ft`,
      spokenText: `${roundedFt} feet`,
    };
  }
  const miles = safeM / 1609.344;
  const roundedMi = miles < 10 ? Number(miles.toFixed(1)) : Math.round(miles);
  const miUnit = roundedMi === 1 ? 'mile' : 'miles';
  return {
    shortText: `${roundedMi} mi`,
    spokenText: `${roundedMi} ${miUnit}`,
  };
}

class VoiceNavigationService {
  private muted: boolean = false;
  private lastRouteKey: string = '';
  private lastStageKey: string = '';
  private lastSpokenText: string = '';
  private lastSpokenTimeMs: number = 0;

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.cancel();
    }
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public cancel(): void {
    if (!this.isSupported()) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore speech synthesis errors in restricted iframe sandboxes
    }
  }

  public repeatLast(): void {
    if (this.muted || !this.lastSpokenText) return;
    this.speak(this.lastSpokenText, true);
  }

  private speak(text: string, interrupt: boolean = false): void {
    if (this.muted || !this.isSupported() || !text.trim()) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!interrupt && now - this.lastSpokenTimeMs < 3200) {
      return;
    }

    try {
      const synth = window.speechSynthesis;
      if (interrupt) {
        synth.cancel();
      } else if (synth.speaking || synth.pending) {
        return;
      }

      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.04;
      utter.pitch = 1.0;
      utter.volume = 0.92;
      utter.lang = 'en-US';

      const voices = synth.getVoices();
      if (voices && voices.length > 0) {
        const preferred =
          voices.find(
            (v) =>
              v.lang.startsWith('en-US') &&
              (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))
          ) ||
          voices.find((v) => v.lang.startsWith('en-US')) ||
          voices.find((v) => v.lang.startsWith('en'));
        if (preferred) {
          utter.voice = preferred;
        }
      }

      this.lastSpokenText = text;
      this.lastSpokenTimeMs = now;
      synth.speak(utter);
    } catch {
      // Ignore synthesis playback errors
    }
  }

  private buildManeuverPhrase(maneuver: GpsManeuverType, roadName?: string): string {
    const cleanRoad = roadName && roadName.trim().length > 0 ? ` onto ${this.humanizeRoadName(roadName)}` : '';
    switch (maneuver) {
      case 'left':
        return `turn left${cleanRoad}`;
      case 'slight_left':
        return `keep left${cleanRoad}`;
      case 'right':
        return `turn right${cleanRoad}`;
      case 'slight_right':
        return `keep right${cleanRoad}`;
      case 'uturn':
        return `make a U-turn when possible${cleanRoad}`;
      case 'arrive':
        return `your destination will be ahead`;
      case 'straight':
      default:
        return cleanRoad ? `continue straight${cleanRoad}` : `continue straight`;
    }
  }

  private humanizeRoadName(raw: string): string {
    return raw
      .replace(/\bRD\b/gi, 'Road')
      .replace(/\bAVE\b/gi, 'Avenue')
      .replace(/\bBLVD\b/gi, 'Boulevard')
      .replace(/\bPKWY\b/gi, 'Parkway')
      .replace(/\bDR\b/gi, 'Drive')
      .replace(/\bLN\b/gi, 'Lane')
      .replace(/\bCT\b/gi, 'Court')
      .replace(/\bHWY\b/gi, 'Highway')
      .replace(/\bEXPWY\b/gi, 'Expressway')
      .replace(/\s*\([^)]*\)/g, '')
      .trim();
  }

  public updateProgress(params: {
    active: boolean;
    destLabel?: string;
    maneuver?: GpsManeuverType;
    nextRoadName?: string;
    distToTurnMeters?: number;
    totalRouteMeters?: number;
  }): void {
    if (!params.active) {
      if (this.lastRouteKey) {
        this.lastRouteKey = '';
        this.lastStageKey = '';
        this.cancel();
      }
      return;
    }

    const dest = params.destLabel || 'destination';
    const maneuver: GpsManeuverType = params.maneuver || 'straight';
    const road = params.nextRoadName || '';
    const distTurn = params.distToTurnMeters ?? params.totalRouteMeters ?? 0;
    const totalMeters = params.totalRouteMeters ?? distTurn;
    const routeKey = `${dest}`;

    if (routeKey !== this.lastRouteKey) {
      this.lastRouteKey = routeKey;
      this.lastStageKey = '';
      const totalFormatted = formatGoogleMapsDistance(totalMeters);
      const startPhrase =
        maneuver === 'straight'
          ? `Starting route to ${dest}. Head straight for ${totalFormatted.spokenText}.`
          : `Starting route to ${dest}. In ${formatGoogleMapsDistance(distTurn).spokenText}, ${this.buildManeuverPhrase(maneuver, road)}.`;
      this.speak(startPhrase, true);
      return;
    }

    if (totalMeters <= 32) {
      const stage = `arrive_${routeKey}`;
      if (this.lastStageKey !== stage) {
        this.lastStageKey = stage;
        this.speak(`You have arrived at ${dest}.`, true);
      }
      return;
    }

    // Standard Google Maps distance announcement brackets (no repetitive spam)
    const maneuverKey = `${maneuver}_${road}`;
    if (maneuver === 'uturn') {
      const stage = `uturn_${Math.floor(totalMeters / 180)}`;
      if (this.lastStageKey !== stage) {
        this.lastStageKey = stage;
        this.speak('When safe, make a U-turn to return to the route.', false);
      }
      return;
    }

    if (maneuver !== 'straight' && maneuver !== 'arrive') {
      if (distTurn <= 45) {
        const stage = `now_${maneuverKey}`;
        if (this.lastStageKey !== stage) {
          this.lastStageKey = stage;
          const phrase = this.buildManeuverPhrase(maneuver, road);
          this.speak(phrase.charAt(0).toUpperCase() + phrase.slice(1) + '.', true);
        }
      } else if (distTurn <= 165) {
        const stage = `soon_${maneuverKey}`;
        if (this.lastStageKey !== stage) {
          this.lastStageKey = stage;
          const distStr = formatGoogleMapsDistance(distTurn).spokenText;
          this.speak(`In ${distStr}, ${this.buildManeuverPhrase(maneuver, road)}.`, false);
        }
      } else if (distTurn <= 420) {
        const stage = `approach_${maneuverKey}`;
        if (this.lastStageKey !== stage) {
          this.lastStageKey = stage;
          const distStr = formatGoogleMapsDistance(distTurn).spokenText;
          this.speak(`In ${distStr}, ${this.buildManeuverPhrase(maneuver, road)}.`, false);
        }
      }
    }
  }
}

export const voiceNavigationService = new VoiceNavigationService();
