/**
 * Web Audio API procedural sound engine for F1 2026 simulation
 * Generates V6 Turbo-hybrid engine harmonics, turbo whine, tire squeal, kerbs, and race sounds.
 */

export type EngineSoundProfileId =
  | 'ferrari'
  | 'mercedes'
  | 'redbull_ford'
  | 'honda_hrc'
  | 'honda_rbpt'
  | 'audi_renault'
  | 'works_inhouse';

export interface EngineSoundProfile {
  id: string;
  name: string;
  osc1Type: OscillatorType;
  osc2Type: OscillatorType;
  osc3Type: OscillatorType;
  harmonicMultipliers: [number, number, number];
  oscGains: [number, number, number];
  detuneCents: [number, number, number];
  subHarmonicGain: number;
  baseFreqMultiplier: number;
  distortionAmount: number;
  filterCutoffIdle: number;
  filterCutoffRedline: number;
  filterQ: number;
  formantFreq: number;
  formantGainDb: number;
  pulseDepth: number;
  pulseRateMultiplier: number;
  turboFreqBase: number;
  turboFreqSpan: number;
  turboGainFactor: number;
  electricWhineFreqBase: number;
  electricWhineGainFactor: number;
  shiftPitchBase: number;
  screamHarmonicMultiplier: number;
  screamChorusRatio: number;
  screamGainMax: number;
  screamResonanceFreq: number;
  screamQ: number;
  superchargerGainFactor?: number;
}

export const ENGINE_SOUND_PROFILES: Record<EngineSoundProfileId, EngineSoundProfile> = {
  ferrari: {
    id: 'ferrari',
    name: 'Ferrari 066/14 V6 Turbo',
    // Singing Maranello high-harmonic Italian wail (octave + double-octave overtones)
    osc1Type: 'sawtooth',
    osc2Type: 'triangle',
    osc3Type: 'sawtooth',
    harmonicMultipliers: [1.0, 2.0, 4.0],
    oscGains: [0.35, 0.28, 0.20],
    detuneCents: [-5, 5, 10],
    subHarmonicGain: 0.14,
    baseFreqMultiplier: 2.48,
    distortionAmount: 9,
    filterCutoffIdle: 720,
    filterCutoffRedline: 5200,
    filterQ: 2.3,
    formantFreq: 1560,
    formantGainDb: 8.0,
    pulseDepth: 0.07,
    pulseRateMultiplier: 0.5,
    turboFreqBase: 1850,
    turboFreqSpan: 1900,
    turboGainFactor: 0.05,
    electricWhineFreqBase: 880,
    electricWhineGainFactor: 0.045,
    shiftPitchBase: 145,
    screamHarmonicMultiplier: 5.0,
    screamChorusRatio: 1.5,
    screamGainMax: 0.20,
    screamResonanceFreq: 2650,
    screamQ: 2.6,
  },
  mercedes: {
    id: 'mercedes',
    name: 'Mercedes-AMG M17 High Output',
    // Deep, silky Brixworth baritone turbine purr + futuristic MGU-K electric whine
    osc1Type: 'triangle',
    osc2Type: 'sawtooth',
    osc3Type: 'sine',
    harmonicMultipliers: [1.0, 1.5, 2.0],
    oscGains: [0.42, 0.24, 0.24],
    detuneCents: [-4, 4, 0],
    subHarmonicGain: 0.26,
    baseFreqMultiplier: 1.78,
    distortionAmount: 5,
    filterCutoffIdle: 480,
    filterCutoffRedline: 3350,
    filterQ: 1.7,
    formantFreq: 680,
    formantGainDb: 6.5,
    pulseDepth: 0.045,
    pulseRateMultiplier: 0.35,
    turboFreqBase: 1450,
    turboFreqSpan: 1450,
    turboGainFactor: 0.042,
    electricWhineFreqBase: 1120,
    electricWhineGainFactor: 0.115,
    shiftPitchBase: 105,
    screamHarmonicMultiplier: 3.5,
    screamChorusRatio: 1.333,
    screamGainMax: 0.13,
    screamResonanceFreq: 1950,
    screamQ: 1.9,
  },
  redbull_ford: {
    id: 'redbull_ford',
    name: 'Ford Red Bull Powertrains',
    // Throaty V-muscle low-end bark, heavy sub-crank rumble & high-boost turbo whistle
    osc1Type: 'sawtooth',
    osc2Type: 'triangle',
    osc3Type: 'sawtooth',
    harmonicMultipliers: [1.0, 1.25, 2.5],
    oscGains: [0.38, 0.27, 0.18],
    detuneCents: [-9, 8, -5],
    subHarmonicGain: 0.32,
    baseFreqMultiplier: 1.98,
    distortionAmount: 11,
    filterCutoffIdle: 540,
    filterCutoffRedline: 3950,
    filterQ: 2.0,
    formantFreq: 890,
    formantGainDb: 8.2,
    pulseDepth: 0.13,
    pulseRateMultiplier: 0.42,
    turboFreqBase: 2100,
    turboFreqSpan: 2400,
    turboGainFactor: 0.09,
    electricWhineFreqBase: 960,
    electricWhineGainFactor: 0.052,
    shiftPitchBase: 115,
    screamHarmonicMultiplier: 4.0,
    screamChorusRatio: 1.25,
    screamGainMax: 0.16,
    screamResonanceFreq: 2200,
    screamQ: 2.2,
  },
  honda_hrc: {
    id: 'honda_hrc',
    name: 'Honda HRC Performance',
    // Exotic Sakura off-beat cylinder growl at low RPM -> metallic VTEC-like scream at high RPM
    osc1Type: 'sawtooth',
    osc2Type: 'sawtooth',
    osc3Type: 'triangle',
    harmonicMultipliers: [1.0, 1.667, 3.333],
    oscGains: [0.33, 0.26, 0.22],
    detuneCents: [-8, 10, -4],
    subHarmonicGain: 0.19,
    baseFreqMultiplier: 2.25,
    distortionAmount: 10,
    filterCutoffIdle: 580,
    filterCutoffRedline: 4650,
    filterQ: 2.5,
    formantFreq: 1280,
    formantGainDb: 7.4,
    pulseDepth: 0.15,
    pulseRateMultiplier: 0.33,
    turboFreqBase: 1950,
    turboFreqSpan: 2100,
    turboGainFactor: 0.072,
    electricWhineFreqBase: 1040,
    electricWhineGainFactor: 0.075,
    shiftPitchBase: 135,
    screamHarmonicMultiplier: 4.5,
    screamChorusRatio: 1.5,
    screamGainMax: 0.22,
    screamResonanceFreq: 2550,
    screamQ: 2.7,
  },
  honda_rbpt: {
    id: 'honda_rbpt',
    name: 'Honda HRC / Red Bull Powertrains',
    osc1Type: 'sawtooth',
    osc2Type: 'sawtooth',
    osc3Type: 'triangle',
    harmonicMultipliers: [1.0, 1.667, 3.333],
    oscGains: [0.33, 0.26, 0.22],
    detuneCents: [-8, 10, -4],
    subHarmonicGain: 0.19,
    baseFreqMultiplier: 2.25,
    distortionAmount: 10,
    filterCutoffIdle: 580,
    filterCutoffRedline: 4650,
    filterQ: 2.5,
    formantFreq: 1280,
    formantGainDb: 7.4,
    pulseDepth: 0.15,
    pulseRateMultiplier: 0.33,
    turboFreqBase: 1950,
    turboFreqSpan: 2100,
    turboGainFactor: 0.072,
    electricWhineFreqBase: 1040,
    electricWhineGainFactor: 0.075,
    shiftPitchBase: 135,
    screamHarmonicMultiplier: 4.5,
    screamChorusRatio: 1.5,
    screamGainMax: 0.22,
    screamResonanceFreq: 2550,
    screamQ: 2.7,
  },
  audi_renault: {
    id: 'audi_renault',
    name: 'Audi Sport F1 V6',
    // Quattro-inspired warbling 5th/3rd harmonic chorus & velvety German mechanical purr
    osc1Type: 'triangle',
    osc2Type: 'sawtooth',
    osc3Type: 'triangle',
    harmonicMultipliers: [1.0, 1.20, 1.80],
    oscGains: [0.39, 0.28, 0.23],
    detuneCents: [-14, 14, -8],
    subHarmonicGain: 0.24,
    baseFreqMultiplier: 2.08,
    distortionAmount: 7,
    filterCutoffIdle: 520,
    filterCutoffRedline: 3650,
    filterQ: 1.8,
    formantFreq: 790,
    formantGainDb: 6.8,
    pulseDepth: 0.10,
    pulseRateMultiplier: 0.38,
    turboFreqBase: 1620,
    turboFreqSpan: 1650,
    turboGainFactor: 0.058,
    electricWhineFreqBase: 820,
    electricWhineGainFactor: 0.06,
    shiftPitchBase: 122,
    screamHarmonicMultiplier: 3.6,
    screamChorusRatio: 1.2,
    screamGainMax: 0.15,
    screamResonanceFreq: 2100,
    screamQ: 2.1,
  },
  works_inhouse: {
    id: 'works_inhouse',
    name: 'Works In-House Bespoke PU',
    // True Screaming F1 V10 Architecture: 5th-order 10-cylinder harmonic stack (1x, 2x, 2.5x major-tenth chord) + piercing top-end V10 shriek
    osc1Type: 'sawtooth',
    osc2Type: 'sawtooth',
    osc3Type: 'triangle',
    harmonicMultipliers: [1.0, 2.0, 2.5],
    oscGains: [0.32, 0.34, 0.28],
    detuneCents: [-5, 5, 9],
    subHarmonicGain: 0.08,
    baseFreqMultiplier: 3.45,
    distortionAmount: 11,
    filterCutoffIdle: 920,
    filterCutoffRedline: 9200,
    filterQ: 3.1,
    formantFreq: 2450,
    formantGainDb: 11.5,
    pulseDepth: 0.04,
    pulseRateMultiplier: 0.833,
    turboFreqBase: 2400,
    turboFreqSpan: 2400,
    turboGainFactor: 0.0, // Pure naturally-aspirated-style screaming V10 exhaust note
    electricWhineFreqBase: 2650,
    electricWhineGainFactor: 0.19,
    shiftPitchBase: 215,
    screamHarmonicMultiplier: 3.0,
    screamChorusRatio: 1.333,
    screamGainMax: 0.48,
    screamResonanceFreq: 3450,
    screamQ: 3.5,
  },
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private initialized: boolean = false;

  // Active engine sound profile
  public activeProfile: EngineSoundProfile = ENGINE_SOUND_PROFILES.ferrari;
  private isPreviewingRev: boolean = false;
  private previewIntervalId: number | null = null;
  private wasErsActive: boolean = false;
  private prevThrottleLevel: number = 0;
  private lastBovFlutterTime: number = 0;
  private lastExhaustCrackleTime: number = 0;

  // Engine sound nodes
  private engineGain: GainNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private osc3: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private osc1Gain: GainNode | null = null;
  private osc2Gain: GainNode | null = null;
  private osc3Gain: GainNode | null = null;
  private subOscGain: GainNode | null = null;
  private screamOsc1: OscillatorNode | null = null;
  private screamOsc2: OscillatorNode | null = null;
  private screamOsc3: OscillatorNode | null = null;
  private screamFilter: BiquadFilterNode | null = null;
  private screamGain: GainNode | null = null;
  private pulseOsc: OscillatorNode | null = null;
  private pulseDepthGain: GainNode | null = null;
  private pulseModNode: GainNode | null = null;
  private formantFilter: BiquadFilterNode | null = null;
  private turboGain: GainNode | null = null;
  private turboOsc: OscillatorNode | null = null;

  // Dedicated Mechanical Twin-Screw Roots/Lysholm Supercharger Lobe Mesh Whine nodes
  private superchargerGain: GainNode | null = null;
  private superchargerOsc1: OscillatorNode | null = null;
  private superchargerOsc2: OscillatorNode | null = null;
  private superchargerFilter: BiquadFilterNode | null = null;

  // Dedicated ERS MGU-K Electric Inverter & Helical Gear Whine nodes (independent of engine exhaust)
  private electricWhineGain: GainNode | null = null;
  private electricOsc: OscillatorNode | null = null;
  private electricHarmonicOsc: OscillatorNode | null = null;
  private electricHarmonicGain: GainNode | null = null;
  private ersPwmOsc: OscillatorNode | null = null;
  private ersPwmGain: GainNode | null = null;
  private electricFilter: BiquadFilterNode | null = null;

  private distortionNode: WaveShaperNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;

  // Tire screech nodes
  private tireGain: GainNode | null = null;
  private tireNoiseNode: AudioBufferSourceNode | null = null;
  private tireFilter: BiquadFilterNode | null = null;

  // Kerb rumble
  private kerbGain: GainNode | null = null;
  private kerbOsc: OscillatorNode | null = null;

  // Wind rush noise
  private windGain: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;

  public init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupEngineNodes();
      this.setupTireNodes();
      this.setupKerbNodes();
      this.setupWindNodes();
      this.initialized = true;
    } catch {
      // Audio might be blocked until user gesture
    }
  }

  public resume() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setEngineProfile(engineIdentifier: string) {
    const norm = (engineIdentifier || '').toLowerCase();
    let profileKey: EngineSoundProfileId = 'ferrari';
    if (norm.includes('works') || norm.includes('bespoke') || norm.includes('custom') || norm.includes('in-house') || norm.includes('inhouse') || norm.includes('v10')) {
      profileKey = 'works_inhouse';
    } else if (norm.includes('mercedes') || norm.includes('m17') || norm.includes('williams') || norm.includes('mclaren') || norm.includes('alpine')) {
      profileKey = 'mercedes';
    } else if (norm.includes('honda') || norm.includes('hrc') || norm.includes('aston')) {
      profileKey = 'honda_hrc';
    } else if (norm.includes('red bull') || norm.includes('redbull') || norm.includes('ford') || norm.includes('rbpt')) {
      profileKey = 'redbull_ford';
    } else if (norm.includes('audi') || norm.includes('renault') || norm.includes('revolut')) {
      profileKey = 'audi_renault';
    } else if (norm.includes('ferrari') || norm.includes('066') || norm.includes('haas')) {
      profileKey = 'ferrari';
    }
    this.activeProfile = ENGINE_SOUND_PROFILES[profileKey];
    this.applyEngineProfile();
  }

  public setStreetCarEngineProfile(carId: string, trimId?: string) {
    const streetProfiles: Record<string, EngineSoundProfile> = {
      honda_civic: {
        id: 'honda_civic',
        name: trimId === 'civic_type_r' ? '2.0L K20C1 VTEC Turbo Inline-4' : '2.0L DOHC i-VTEC Inline-4',
        osc1Type: 'sawtooth',
        osc2Type: 'square',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [1.0, 2.0, 4.0],
        oscGains: [0.38, 0.25, 0.22],
        detuneCents: [-6, 8, -4],
        subHarmonicGain: trimId === 'civic_type_r' ? 0.16 : 0.09,
        baseFreqMultiplier: trimId === 'civic_type_r' ? 1.54 : 1.42,
        distortionAmount: 13,
        filterCutoffIdle: 640,
        filterCutoffRedline: 4950,
        filterQ: 2.8,
        formantFreq: 1760,
        formantGainDb: 9.5,
        pulseDepth: 0.14,
        pulseRateMultiplier: 0.34,
        turboFreqBase: 1950,
        turboFreqSpan: 2400,
        turboGainFactor: trimId === 'civic_type_r' ? 0.16 : trimId === 'civic_si' ? 0.1 : 0.0,
        electricWhineFreqBase: 700,
        electricWhineGainFactor: 0.0,
        shiftPitchBase: 126,
        screamHarmonicMultiplier: 4.0,
        screamChorusRatio: 2.0,
        screamGainMax: trimId === 'civic_type_r' ? 0.28 : 0.22,
        screamResonanceFreq: 2480,
        screamQ: 3.1,
      },
      toyota_camry: {
        id: 'toyota_camry',
        name:
          trimId === 'camry_trd_v6' || trimId === 'camry_xse_v6'
            ? '3.5L 2GR-FKS DOHC 24V V6'
            : '2.5L Dynamic Force DOHC I4',
        osc1Type: 'sawtooth',
        osc2Type: 'triangle',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [1.0, 1.5, 3.0],
        oscGains: [0.37, 0.28, 0.2],
        detuneCents: [-5, 6, -3],
        subHarmonicGain: trimId === 'camry_trd_v6' ? 0.22 : 0.14,
        baseFreqMultiplier: trimId === 'camry_trd_v6' || trimId === 'camry_xse_v6' ? 1.68 : 1.46,
        distortionAmount: trimId === 'camry_trd_v6' ? 12 : 9,
        filterCutoffIdle: 520,
        filterCutoffRedline: 4300,
        filterQ: 2.3,
        formantFreq: 1320,
        formantGainDb: 8.4,
        pulseDepth: 0.12,
        pulseRateMultiplier: 0.38,
        turboFreqBase: 1400,
        turboFreqSpan: 800,
        turboGainFactor: 0.0,
        electricWhineFreqBase: 750,
        electricWhineGainFactor: 0.0,
        shiftPitchBase: 118,
        screamHarmonicMultiplier: 3.5,
        screamChorusRatio: 1.5,
        screamGainMax: trimId === 'camry_trd_v6' ? 0.24 : 0.17,
        screamResonanceFreq: 2150,
        screamQ: 2.5,
      },
      chevy_camaro: {
        id: 'chevy_camaro',
        name:
          trimId === 'camaro_zl1' || trimId === 'camaro_zl1_1le'
            ? '6.2L LT4 Supercharged V8'
            : '6.2L LT1 Naturally Aspirated V8',
        osc1Type: 'sawtooth',
        osc2Type: 'triangle',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [0.5, 1.0, 1.5],
        oscGains: [0.46, 0.34, 0.19],
        detuneCents: [-13, 11, -7],
        subHarmonicGain: 0.44,
        baseFreqMultiplier: 1.22,
        distortionAmount: 15,
        filterCutoffIdle: 350,
        filterCutoffRedline: 2850,
        filterQ: 2.2,
        formantFreq: 560,
        formantGainDb: 10.2,
        pulseDepth: 0.24,
        pulseRateMultiplier: 0.25,
        turboFreqBase: 1650,
        turboFreqSpan: 1850,
        turboGainFactor: 0.04,
        electricWhineFreqBase: 1420,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: trimId === 'camaro_zl1' || trimId === 'camaro_zl1_1le' ? 0.24 : 0.0,
        shiftPitchBase: 92,
        screamHarmonicMultiplier: 2.6,
        screamChorusRatio: 1.25,
        screamGainMax: 0.18,
        screamResonanceFreq: 1520,
        screamQ: 2.2,
      },
      toyota_supra_mk5: {
        id: 'toyota_supra_mk5',
        name: '3.0L B58 Twin-Scroll Turbo Inline-6',
        osc1Type: 'sawtooth',
        osc2Type: 'sawtooth',
        osc3Type: 'triangle',
        harmonicMultipliers: [1.0, 1.5, 3.0],
        oscGains: [0.36, 0.3, 0.23],
        detuneCents: [-6, 6, 3],
        subHarmonicGain: 0.23,
        baseFreqMultiplier: 1.82,
        distortionAmount: 11,
        filterCutoffIdle: 560,
        filterCutoffRedline: 4500,
        filterQ: 2.5,
        formantFreq: 1260,
        formantGainDb: 8.5,
        pulseDepth: 0.11,
        pulseRateMultiplier: 0.42,
        turboFreqBase: 2050,
        turboFreqSpan: 2550,
        turboGainFactor: 0.16,
        electricWhineFreqBase: 900,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: 0.0,
        shiftPitchBase: 128,
        screamHarmonicMultiplier: 4.0,
        screamChorusRatio: 1.5,
        screamGainMax: 0.23,
        screamResonanceFreq: 2380,
        screamQ: 2.7,
      },
      dodge_challenger: {
        id: 'dodge_challenger',
        name: '6.2L Supercharged HEMI V8 (Hellcat / Demon 170)',
        osc1Type: 'sawtooth',
        osc2Type: 'triangle',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [0.5, 1.0, 1.5],
        oscGains: [0.48, 0.35, 0.18],
        detuneCents: [-15, 13, -9],
        subHarmonicGain: 0.47,
        baseFreqMultiplier: 1.16,
        distortionAmount: 16,
        filterCutoffIdle: 330,
        filterCutoffRedline: 2680,
        filterQ: 2.2,
        formantFreq: 510,
        formantGainDb: 10.8,
        pulseDepth: 0.27,
        pulseRateMultiplier: 0.24,
        turboFreqBase: 1600,
        turboFreqSpan: 1900,
        turboGainFactor: 0.04,
        electricWhineFreqBase: 1480,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: trimId === 'challenger_scat_pack' ? 0.0 : 0.26,
        shiftPitchBase: 86,
        screamHarmonicMultiplier: 2.5,
        screamChorusRatio: 1.25,
        screamGainMax: 0.16,
        screamResonanceFreq: 1450,
        screamQ: 2.1,
      },
      dodge_charger: {
        id: 'dodge_charger',
        name: '6.2L Supercharged HEMI V8 Widebody',
        osc1Type: 'sawtooth',
        osc2Type: 'triangle',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [0.5, 1.0, 1.5],
        oscGains: [0.47, 0.34, 0.18],
        detuneCents: [-14, 12, -8],
        subHarmonicGain: 0.46,
        baseFreqMultiplier: 1.18,
        distortionAmount: 16,
        filterCutoffIdle: 340,
        filterCutoffRedline: 2700,
        filterQ: 2.2,
        formantFreq: 525,
        formantGainDb: 10.6,
        pulseDepth: 0.26,
        pulseRateMultiplier: 0.24,
        turboFreqBase: 1600,
        turboFreqSpan: 1900,
        turboGainFactor: 0.04,
        electricWhineFreqBase: 1460,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: trimId === 'charger_scat_pack' ? 0.0 : 0.25,
        shiftPitchBase: 88,
        screamHarmonicMultiplier: 2.5,
        screamChorusRatio: 1.25,
        screamGainMax: 0.16,
        screamResonanceFreq: 1460,
        screamQ: 2.1,
      },
      chevy_corvette: {
        id: 'chevy_corvette',
        name:
          trimId?.includes('z06')
            ? '5.5L LT6 8,600 RPM Flat-Plane Crank V8 (Z06)'
            : '6.2L LT2 Mid-Engine V8 (Stingray Z51)',
        osc1Type: 'sawtooth',
        osc2Type: trimId?.includes('z06') ? 'sawtooth' : 'triangle',
        osc3Type: trimId?.includes('z06') ? 'triangle' : 'sawtooth',
        harmonicMultipliers: trimId?.includes('z06') ? [1.0, 1.5, 2.5] : [0.5, 1.0, 1.5],
        oscGains: trimId?.includes('z06') ? [0.38, 0.31, 0.25] : [0.46, 0.34, 0.20],
        detuneCents: trimId?.includes('z06') ? [-6, 7, -4] : [-12, 10, -6],
        subHarmonicGain: trimId?.includes('z06') ? 0.24 : 0.45,
        baseFreqMultiplier: trimId?.includes('z06') ? 2.25 : 1.24,
        distortionAmount: trimId?.includes('z06') ? 11 : 14,
        filterCutoffIdle: trimId?.includes('z06') ? 620 : 340,
        filterCutoffRedline: trimId?.includes('z06') ? 5400 : 2850,
        filterQ: trimId?.includes('z06') ? 2.6 : 2.1,
        formantFreq: trimId?.includes('z06') ? 1520 : 540,
        formantGainDb: trimId?.includes('z06') ? 9.0 : 10.2,
        pulseDepth: trimId?.includes('z06') ? 0.09 : 0.25,
        pulseRateMultiplier: trimId?.includes('z06') ? 0.48 : 0.25,
        turboFreqBase: 1650,
        turboFreqSpan: 1850,
        turboGainFactor: 0.0,
        electricWhineFreqBase: 1200,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: 0.0,
        shiftPitchBase: trimId?.includes('z06') ? 148 : 94,
        screamHarmonicMultiplier: trimId?.includes('z06') ? 4.6 : 2.6,
        screamChorusRatio: 1.5,
        screamGainMax: trimId?.includes('z06') ? 0.32 : 0.17,
        screamResonanceFreq: trimId?.includes('z06') ? 2750 : 1500,
        screamQ: trimId?.includes('z06') ? 2.9 : 2.2,
      },
      bmw_m4: {
        id: 'bmw_m4',
        name: '3.0L S58 Twin-Turbo Straight-6',
        osc1Type: 'sawtooth',
        osc2Type: 'sawtooth',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [1.0, 1.5, 2.5],
        oscGains: [0.35, 0.29, 0.24],
        detuneCents: [-6, 7, 3],
        subHarmonicGain: 0.21,
        baseFreqMultiplier: 1.86,
        distortionAmount: 12,
        filterCutoffIdle: 590,
        filterCutoffRedline: 4600,
        filterQ: 2.7,
        formantFreq: 1340,
        formantGainDb: 8.6,
        pulseDepth: 0.11,
        pulseRateMultiplier: 0.42,
        turboFreqBase: 1980,
        turboFreqSpan: 2250,
        turboGainFactor: 0.13,
        electricWhineFreqBase: 900,
        electricWhineGainFactor: 0.0,
        shiftPitchBase: 128,
        screamHarmonicMultiplier: 4.0,
        screamChorusRatio: 1.5,
        screamGainMax: 0.24,
        screamResonanceFreq: 2420,
        screamQ: 2.8,
      },
      cadillac_escalade: {
        id: 'cadillac_escalade',
        name: '6.2L L87 Deep Rumble V8',
        osc1Type: 'sawtooth',
        osc2Type: 'triangle',
        osc3Type: 'sine',
        harmonicMultipliers: [0.5, 1.0, 1.5],
        oscGains: [0.56, 0.34, 0.10],
        detuneCents: [-8, 7, -4],
        subHarmonicGain: 0.88,
        baseFreqMultiplier: 0.72,
        distortionAmount: 7,
        filterCutoffIdle: 160,
        filterCutoffRedline: 1020,
        filterQ: 1.3,
        formantFreq: 185,
        formantGainDb: 7.0,
        pulseDepth: 0.38,
        pulseRateMultiplier: 0.19,
        turboFreqBase: 1200,
        turboFreqSpan: 900,
        turboGainFactor: 0.0,
        electricWhineFreqBase: 780,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: 0.0,
        shiftPitchBase: 64,
        screamHarmonicMultiplier: 1.5,
        screamChorusRatio: 1.15,
        screamGainMax: 0.0,
        screamResonanceFreq: 750,
        screamQ: 1.3,
      },
      cadillac_escalade_v: {
        id: 'cadillac_escalade_v',
        name: '6.2L LT4 Deep V8 Super-SUV',
        osc1Type: 'sawtooth',
        osc2Type: 'triangle',
        osc3Type: 'sine',
        harmonicMultipliers: [0.5, 1.0, 1.5],
        oscGains: [0.56, 0.34, 0.10],
        detuneCents: [-8, 7, -4],
        subHarmonicGain: 0.88,
        baseFreqMultiplier: 0.76,
        distortionAmount: 7.5,
        filterCutoffIdle: 168,
        filterCutoffRedline: 1080,
        filterQ: 1.35,
        formantFreq: 195,
        formantGainDb: 7.2,
        pulseDepth: 0.40,
        pulseRateMultiplier: 0.19,
        turboFreqBase: 1200,
        turboFreqSpan: 1200,
        turboGainFactor: 0.0,
        electricWhineFreqBase: 1200,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: 0.045,
        shiftPitchBase: 68,
        screamHarmonicMultiplier: 1.5,
        screamChorusRatio: 1.15,
        screamGainMax: 0.0,
        screamResonanceFreq: 800,
        screamQ: 1.4,
      },
      toyota_supra_mk4: {
        id: 'toyota_supra_mk4',
        name: '3.0L 2JZ-GTE Twin-Turbo Inline-6',
        osc1Type: 'sawtooth',
        osc2Type: 'sawtooth',
        osc3Type: 'triangle',
        harmonicMultipliers: [1.0, 1.5, 3.0],
        oscGains: [0.36, 0.31, 0.23],
        detuneCents: [-5, 6, -3],
        subHarmonicGain: 0.26,
        baseFreqMultiplier: 1.74,
        distortionAmount: 11,
        filterCutoffIdle: 540,
        filterCutoffRedline: 4500,
        filterQ: 2.5,
        formantFreq: 1180,
        formantGainDb: 8.6,
        pulseDepth: 0.09,
        pulseRateMultiplier: 0.46,
        turboFreqBase: 2250,
        turboFreqSpan: 3100,
        turboGainFactor: trimId === 'supra_mk4_szr' ? 0.0 : 0.24,
        electricWhineFreqBase: 940,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: 0.0,
        shiftPitchBase: 136,
        screamHarmonicMultiplier: 4.5,
        screamChorusRatio: 1.5,
        screamGainMax: 0.26,
        screamResonanceFreq: 2420,
        screamQ: 2.6,
      },
      nissan_gtr_r35: {
        id: 'nissan_gtr_r35',
        name: '3.8L VR38DETT Twin-Turbo V6',
        osc1Type: 'sawtooth',
        osc2Type: 'triangle',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [1.0, 1.5, 2.5],
        oscGains: [0.38, 0.3, 0.22],
        detuneCents: [-7, 7, -4],
        subHarmonicGain: 0.28,
        baseFreqMultiplier: 1.78,
        distortionAmount: 12,
        filterCutoffIdle: 520,
        filterCutoffRedline: 4400,
        filterQ: 2.4,
        formantFreq: 1120,
        formantGainDb: 8.4,
        pulseDepth: 0.11,
        pulseRateMultiplier: 0.44,
        turboFreqBase: 2200,
        turboFreqSpan: 2900,
        turboGainFactor: 0.22,
        electricWhineFreqBase: 980,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: 0.0,
        shiftPitchBase: 134,
        screamHarmonicMultiplier: 4.2,
        screamChorusRatio: 1.5,
        screamGainMax: 0.25,
        screamResonanceFreq: 2350,
        screamQ: 2.5,
      },
      porsche_911: {
        id: 'porsche_911',
        name:
          trimId === 'porsche_911_gt3_rs'
            ? '4.0L Naturally Aspirated 9,000 RPM Flat-6'
            : '3.0L / 3.7L Twin-Turbo Boxer-6',
        osc1Type: 'sawtooth',
        osc2Type: 'triangle',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [1.0, 1.667, 3.333],
        oscGains: [0.34, 0.3, 0.26],
        detuneCents: [-5, 5, -3],
        subHarmonicGain: 0.16,
        baseFreqMultiplier: trimId === 'porsche_911_gt3_rs' ? 2.38 : 2.08,
        distortionAmount: 9,
        filterCutoffIdle: 680,
        filterCutoffRedline: 5450,
        filterQ: 2.9,
        formantFreq: 1620,
        formantGainDb: 9.0,
        pulseDepth: 0.08,
        pulseRateMultiplier: 0.48,
        turboFreqBase: 2100,
        turboFreqSpan: 2600,
        turboGainFactor: trimId === 'porsche_911_gt3_rs' ? 0.0 : 0.18,
        electricWhineFreqBase: 1050,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: 0.0,
        shiftPitchBase: 148,
        screamHarmonicMultiplier: 5.0,
        screamChorusRatio: 1.667,
        screamGainMax: trimId === 'porsche_911_gt3_rs' ? 0.38 : 0.28,
        screamResonanceFreq: 2850,
        screamQ: 3.3,
      },
      nissan_gtr_r34: {
        id: 'nissan_gtr_r34',
        name: '2.6L RB26DETT Twin-Turbo Inline-6',
        // Authentic throaty Japanese RB26 inline-6 howl with prominent twin-turbo spool & stututu flutter
        osc1Type: 'sawtooth',
        osc2Type: 'sawtooth',
        osc3Type: 'triangle',
        harmonicMultipliers: [1.0, 2.0, 3.0],
        oscGains: [0.42, 0.32, 0.22],
        detuneCents: [-5, 6, -3],
        subHarmonicGain: 0.38,
        baseFreqMultiplier: 1.50,
        distortionAmount: 13,
        filterCutoffIdle: 460,
        filterCutoffRedline: 4200,
        filterQ: 2.4,
        formantFreq: 780,
        formantGainDb: 9.5,
        pulseDepth: 0.10,
        pulseRateMultiplier: 0.48,
        turboFreqBase: 1950,
        turboFreqSpan: 2650,
        turboGainFactor: 0.26,
        electricWhineFreqBase: 920,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: 0.0,
        shiftPitchBase: 122,
        screamHarmonicMultiplier: 4.2,
        screamChorusRatio: 1.5,
        screamGainMax: 0.26,
        screamResonanceFreq: 2350,
        screamQ: 2.6,
      },
      nissan_gtr_r34_ztune: {
        id: 'nissan_gtr_r34_ztune',
        name: '2.8L RB26DETT Z2 GT500 Twin-Turbo Inline-6',
        // Hand-built NISMO Omori Z2 race-block: deep metallic RB26 growl + high-boost IHI twin-turbo howl
        osc1Type: 'sawtooth',
        osc2Type: 'sawtooth',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [1.0, 2.0, 3.0],
        oscGains: [0.44, 0.34, 0.22],
        detuneCents: [-4, 5, -2],
        subHarmonicGain: 0.40,
        baseFreqMultiplier: 1.55,
        distortionAmount: 14,
        filterCutoffIdle: 480,
        filterCutoffRedline: 4400,
        filterQ: 2.5,
        formantFreq: 820,
        formantGainDb: 10.0,
        pulseDepth: 0.09,
        pulseRateMultiplier: 0.50,
        turboFreqBase: 2150,
        turboFreqSpan: 2950,
        turboGainFactor: 0.30,
        electricWhineFreqBase: 1080,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: 0.0,
        shiftPitchBase: 128,
        screamHarmonicMultiplier: 4.5,
        screamChorusRatio: 1.5,
        screamGainMax: 0.32,
        screamResonanceFreq: 2550,
        screamQ: 2.8,
      },
      lamborghini_huracan: {
        id: 'lamborghini_huracan',
        name: '5.2L Naturally Aspirated V10 Symphony',
        osc1Type: 'sawtooth',
        osc2Type: 'sawtooth',
        osc3Type: 'triangle',
        harmonicMultipliers: [1.0, 2.0, 2.5],
        oscGains: [0.34, 0.31, 0.28],
        detuneCents: [-7, 7, 11],
        subHarmonicGain: 0.14,
        baseFreqMultiplier: 2.65,
        distortionAmount: 8,
        filterCutoffIdle: 780,
        filterCutoffRedline: 6100,
        filterQ: 2.6,
        formantFreq: 1840,
        formantGainDb: 8.8,
        pulseDepth: 0.06,
        pulseRateMultiplier: 0.55,
        turboFreqBase: 1900,
        turboFreqSpan: 1500,
        turboGainFactor: 0.0,
        electricWhineFreqBase: 1100,
        electricWhineGainFactor: 0.02,
        shiftPitchBase: 158,
        screamHarmonicMultiplier: 5.0,
        screamChorusRatio: 1.25,
        screamGainMax: 0.4,
        screamResonanceFreq: 3150,
        screamQ: 3.1,
      },
      mcmurtry_speirling: {
        id: 'mcmurtry_speirling',
        name: '23,000 RPM Twin Suction Turbine Fans + E-Axle Scream',
        osc1Type: 'sine',
        osc2Type: 'triangle',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [2.0, 4.0, 6.0],
        oscGains: [0.22, 0.28, 0.24],
        detuneCents: [-3, 4, 8],
        subHarmonicGain: 0.08,
        baseFreqMultiplier: 3.45,
        distortionAmount: 4,
        filterCutoffIdle: 1200,
        filterCutoffRedline: 7800,
        filterQ: 3.2,
        formantFreq: 2850,
        formantGainDb: 10.5,
        pulseDepth: 0.02,
        pulseRateMultiplier: 0.8,
        turboFreqBase: 2800,
        turboFreqSpan: 3600,
        turboGainFactor: 0.28,
        electricWhineFreqBase: 2150,
        electricWhineGainFactor: 0.34,
        shiftPitchBase: 185,
        screamHarmonicMultiplier: 6.5,
        screamChorusRatio: 1.5,
        screamGainMax: 0.44,
        screamResonanceFreq: 3950,
        screamQ: 3.8,
      },
      rimac_nevera: {
        id: 'rimac_nevera',
        name: 'Quad-Motor 1,914 HP Electric Inverter & Helical Gear Whine',
        osc1Type: 'sine',
        osc2Type: 'triangle',
        osc3Type: 'sine',
        harmonicMultipliers: [1.5, 3.0, 4.5],
        oscGains: [0.24, 0.26, 0.2],
        detuneCents: [-4, 4, 7],
        subHarmonicGain: 0.06,
        baseFreqMultiplier: 2.95,
        distortionAmount: 3,
        filterCutoffIdle: 980,
        filterCutoffRedline: 6900,
        filterQ: 3.0,
        formantFreq: 2450,
        formantGainDb: 9.2,
        pulseDepth: 0.02,
        pulseRateMultiplier: 0.7,
        turboFreqBase: 2400,
        turboFreqSpan: 2800,
        turboGainFactor: 0.14,
        electricWhineFreqBase: 1950,
        electricWhineGainFactor: 0.32,
        shiftPitchBase: 175,
        screamHarmonicMultiplier: 5.5,
        screamChorusRatio: 1.5,
        screamGainMax: 0.34,
        screamResonanceFreq: 3450,
        screamQ: 3.5,
      },
      koenigsegg_regera: {
        id: 'koenigsegg_regera',
        name: '5.0L Twin-Turbo V8 + KDD Direct-Drive Tri-Motor Hybrid',
        osc1Type: 'sawtooth',
        osc2Type: 'triangle',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [1.0, 1.5, 2.25],
        oscGains: [0.36, 0.28, 0.24],
        detuneCents: [-8, 8, -5],
        subHarmonicGain: 0.25,
        baseFreqMultiplier: 2.08,
        distortionAmount: 10,
        filterCutoffIdle: 600,
        filterCutoffRedline: 5100,
        filterQ: 2.4,
        formantFreq: 1380,
        formantGainDb: 8.2,
        pulseDepth: 0.1,
        pulseRateMultiplier: 0.44,
        turboFreqBase: 2350,
        turboFreqSpan: 2950,
        turboGainFactor: 0.18,
        electricWhineFreqBase: 1550,
        electricWhineGainFactor: 0.14,
        shiftPitchBase: 142,
        screamHarmonicMultiplier: 4.2,
        screamChorusRatio: 1.5,
        screamGainMax: 0.28,
        screamResonanceFreq: 2650,
        screamQ: 2.6,
      },
      koenigsegg_agera_rs: {
        id: 'koenigsegg_agera_rs',
        name: '5.0L 1-Megawatt Twin-Turbo DOHC V8',
        osc1Type: 'sawtooth',
        osc2Type: 'triangle',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [1.0, 1.5, 2.25],
        oscGains: [0.37, 0.29, 0.24],
        detuneCents: [-8, 8, -5],
        subHarmonicGain: 0.24,
        baseFreqMultiplier: 2.14,
        distortionAmount: 11,
        filterCutoffIdle: 620,
        filterCutoffRedline: 5200,
        filterQ: 2.4,
        formantFreq: 1420,
        formantGainDb: 8.3,
        pulseDepth: 0.1,
        pulseRateMultiplier: 0.45,
        turboFreqBase: 2400,
        turboFreqSpan: 3050,
        turboGainFactor: 0.19,
        electricWhineFreqBase: 1120,
        electricWhineGainFactor: 0.03,
        shiftPitchBase: 144,
        screamHarmonicMultiplier: 4.4,
        screamChorusRatio: 1.5,
        screamGainMax: 0.28,
        screamResonanceFreq: 2700,
        screamQ: 2.6,
      },
      koenigsegg_jesko: {
        id: 'koenigsegg_jesko',
        name: '5.0L 8,500 RPM Flat-Plane Twin-Turbo V8 (Jesko / Absolut)',
        osc1Type: 'sawtooth',
        osc2Type: 'triangle',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [1.0, 1.5, 2.5],
        oscGains: [0.37, 0.29, 0.25],
        detuneCents: [-7, 7, -4],
        subHarmonicGain: 0.22,
        baseFreqMultiplier: 2.32,
        distortionAmount: 10,
        filterCutoffIdle: 680,
        filterCutoffRedline: 5600,
        filterQ: 2.5,
        formantFreq: 1580,
        formantGainDb: 8.6,
        pulseDepth: 0.08,
        pulseRateMultiplier: 0.5,
        turboFreqBase: 2550,
        turboFreqSpan: 3250,
        turboGainFactor: 0.21,
        electricWhineFreqBase: 1200,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: 0.0,
        shiftPitchBase: 152,
        screamHarmonicMultiplier: 4.8,
        screamChorusRatio: 1.5,
        screamGainMax: 0.34,
        screamResonanceFreq: 2880,
        screamQ: 2.8,
      },
      bugatti_chiron_pur_sport: {
        id: 'bugatti_chiron_pur_sport',
        name: '8.0L Quad-Turbo W16 (6,900 RPM Close-Ratio Pur Sport)',
        osc1Type: 'triangle',
        osc2Type: 'sawtooth',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [0.75, 1.5, 2.25],
        oscGains: [0.44, 0.3, 0.22],
        detuneCents: [-6, 6, -4],
        subHarmonicGain: 0.4,
        baseFreqMultiplier: 1.72,
        distortionAmount: 9,
        filterCutoffIdle: 470,
        filterCutoffRedline: 4350,
        filterQ: 2.1,
        formantFreq: 880,
        formantGainDb: 8.6,
        pulseDepth: 0.09,
        pulseRateMultiplier: 0.54,
        turboFreqBase: 2250,
        turboFreqSpan: 2980,
        turboGainFactor: 0.22,
        electricWhineFreqBase: 1080,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: 0.0,
        shiftPitchBase: 134,
        screamHarmonicMultiplier: 4.0,
        screamChorusRatio: 1.333,
        screamGainMax: 0.27,
        screamResonanceFreq: 2350,
        screamQ: 2.3,
      },
      bugatti_chiron_super_sport: {
        id: 'bugatti_chiron_super_sport',
        name: '8.0L 1,600 PS Thor Quad-Turbo W16 (Super Sport 300+)',
        osc1Type: 'triangle',
        osc2Type: 'sawtooth',
        osc3Type: 'sawtooth',
        harmonicMultipliers: [0.75, 1.5, 2.25],
        oscGains: [0.45, 0.31, 0.23],
        detuneCents: [-6, 6, -4],
        subHarmonicGain: 0.42,
        baseFreqMultiplier: 1.76,
        distortionAmount: 9,
        filterCutoffIdle: 480,
        filterCutoffRedline: 4450,
        filterQ: 2.2,
        formantFreq: 900,
        formantGainDb: 8.8,
        pulseDepth: 0.09,
        pulseRateMultiplier: 0.55,
        turboFreqBase: 2320,
        turboFreqSpan: 3100,
        turboGainFactor: 0.24,
        electricWhineFreqBase: 1120,
        electricWhineGainFactor: 0.0,
        superchargerGainFactor: 0.0,
        shiftPitchBase: 136,
        screamHarmonicMultiplier: 4.2,
        screamChorusRatio: 1.333,
        screamGainMax: 0.29,
        screamResonanceFreq: 2420,
        screamQ: 2.4,
      },
    };

    this.activeProfile = streetProfiles[carId] || streetProfiles.honda_civic;
    this.applyEngineProfile();
  }

  private applyEngineProfile() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const p = this.activeProfile;
    if (this.exhaustFilter) {
      this.exhaustFilter.frequency.setTargetAtTime(p.filterCutoffIdle, t, 0.05);
      this.exhaustFilter.Q.setTargetAtTime(p.filterQ, t, 0.05);
    }
    if (this.formantFilter) {
      this.formantFilter.frequency.setTargetAtTime(p.formantFreq, t, 0.05);
      this.formantFilter.gain.setTargetAtTime(p.formantGainDb, t, 0.05);
    }
    if (this.distortionNode) {
      this.distortionNode.curve = this.createDistortionCurve(p.distortionAmount) as unknown as Float32Array<ArrayBuffer>;
    }
    if (this.osc1) {
      this.osc1.type = p.osc1Type;
      this.osc1.detune.setTargetAtTime(p.detuneCents[0], t, 0.04);
    }
    if (this.osc2) {
      this.osc2.type = p.osc2Type;
      this.osc2.detune.setTargetAtTime(p.detuneCents[1], t, 0.04);
    }
    if (this.osc3) {
      this.osc3.type = p.osc3Type;
      this.osc3.detune.setTargetAtTime(p.detuneCents[2], t, 0.04);
    }
    if (this.osc1Gain) this.osc1Gain.gain.setTargetAtTime(p.oscGains[0], t, 0.04);
    if (this.osc2Gain) this.osc2Gain.gain.setTargetAtTime(p.oscGains[1], t, 0.04);
    if (this.osc3Gain) this.osc3Gain.gain.setTargetAtTime(p.oscGains[2], t, 0.04);
    if (this.subOscGain) this.subOscGain.gain.setTargetAtTime(p.subHarmonicGain, t, 0.04);
    if (this.pulseDepthGain) this.pulseDepthGain.gain.setTargetAtTime(p.pulseDepth, t, 0.04);
    if (this.screamFilter) {
      this.screamFilter.frequency.setTargetAtTime(p.screamResonanceFreq, t, 0.04);
      this.screamFilter.Q.setTargetAtTime(p.screamQ, t, 0.04);
    }
  }

  /**
   * Preview engine revving sound directly from UI (e.g. Dyno bench, PU selection)
   */
  public previewEngineRev(engineIdentifier: string, callback?: () => void) {
    this.resume();
    this.setEngineProfile(engineIdentifier);
    if (this.previewIntervalId !== null) {
      clearInterval(this.previewIntervalId);
      this.previewIntervalId = null;
    }

    let progress = 0;
    this.isPreviewingRev = true;
    const intervalMs = 25;
    const totalSteps = 96; // ~2.4s realistic dyno sweep with upshift & overrun

    this.previewIntervalId = window.setInterval(() => {
      progress++;
      const fraction = progress / totalSteps;
      let targetRpm = 4200;
      let targetThrottle = 0.15;

      if (fraction < 0.18) {
        // Warm idle & throttle blip
        const blip = Math.sin((fraction / 0.18) * Math.PI);
        targetRpm = 4200 + blip * 3400;
        targetThrottle = 0.25 + blip * 0.55;
      } else if (fraction < 0.54) {
        // First gear pull to 13,200 RPM
        const revFrac = (fraction - 0.18) / 0.36;
        targetRpm = 6200 + Math.pow(revFrac, 0.92) * 7000;
        targetThrottle = 1.0;
      } else if (fraction < 0.80) {
        // Quick upshift snap and pull to 14,800 RPM redline scream
        if (progress === Math.floor(totalSteps * 0.54)) {
          this.playGearShift(false);
        }
        const revFrac2 = (fraction - 0.54) / 0.26;
        targetRpm = 10400 + revFrac2 * 4400;
        targetThrottle = 1.0;
      } else {
        // Off-throttle exhaust overrun decay
        const decayFrac = (fraction - 0.80) / 0.20;
        targetRpm = 14800 - decayFrac * 9400;
        targetThrottle = 0.0;
      }

      // Keep ersActive false during pure engine dyno preview so you hear the raw engine / V10 scream cleanly
      this.updateEngine(targetRpm, targetThrottle, targetRpm > 9000 ? 280 : 120, false, 0, false);

      if (progress >= totalSteps) {
        if (this.previewIntervalId !== null) {
          clearInterval(this.previewIntervalId);
          this.previewIntervalId = null;
        }
        this.isPreviewingRev = false;
        // Fade out engine sound
        if (this.engineGain && this.ctx) {
          this.engineGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.12);
        }
        if (this.electricWhineGain && this.ctx) {
          this.electricWhineGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
        }
        if (callback) callback();
      }
    }, intervalMs);
  }

  private createDistortionCurve(amount: number = 10): Float32Array {
    // Warm tube-style soft saturation curve (eliminates harsh digital square-wave buzz)
    const drive = Math.max(1, amount) * 0.18;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const norm = Math.tanh(drive);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = Math.tanh(x * drive) / (norm || 1);
    }
    return curve;
  }

  private setupEngineNodes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const p = this.activeProfile;

    // Master Engine Gain
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.001, now);

    // Warm soft-clip saturation for natural exhaust harmonics
    this.distortionNode = this.ctx.createWaveShaper();
    this.distortionNode.curve = this.createDistortionCurve(p.distortionAmount) as unknown as Float32Array<ArrayBuffer>;
    this.distortionNode.oversample = '2x';

    // Manufacturer exhaust manifold acoustic formant peak
    this.formantFilter = this.ctx.createBiquadFilter();
    this.formantFilter.type = 'peaking';
    this.formantFilter.frequency.setValueAtTime(p.formantFreq, now);
    this.formantFilter.Q.setValueAtTime(1.6, now);
    this.formantFilter.gain.setValueAtTime(p.formantGainDb, now);

    // Dynamic lowpass filter that opens up with RPM & throttle load
    this.exhaustFilter = this.ctx.createBiquadFilter();
    this.exhaustFilter.type = 'lowpass';
    this.exhaustFilter.frequency.setValueAtTime(p.filterCutoffIdle, now);
    this.exhaustFilter.Q.setValueAtTime(p.filterQ, now);

    // Firing-pulse modulation node for cylinder-bank throb & off-throttle burble
    this.pulseModNode = this.ctx.createGain();
    this.pulseModNode.gain.setValueAtTime(0.85, now);

    this.pulseOsc = this.ctx.createOscillator();
    this.pulseOsc.type = 'sine';
    this.pulseOsc.frequency.setValueAtTime(28, now);

    this.pulseDepthGain = this.ctx.createGain();
    this.pulseDepthGain.gain.setValueAtTime(p.pulseDepth, now);

    this.pulseOsc.connect(this.pulseDepthGain);
    this.pulseDepthGain.connect(this.pulseModNode.gain);

    // Harmonic oscillators + sub-bass crank fundamental
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = p.osc1Type;
    this.osc1.detune.setValueAtTime(p.detuneCents[0], now);
    this.osc1.frequency.setValueAtTime(110, now);
    this.osc1Gain = this.ctx.createGain();
    this.osc1Gain.gain.setValueAtTime(p.oscGains[0], now);

    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = p.osc2Type;
    this.osc2.detune.setValueAtTime(p.detuneCents[1], now);
    this.osc2.frequency.setValueAtTime(220, now);
    this.osc2Gain = this.ctx.createGain();
    this.osc2Gain.gain.setValueAtTime(p.oscGains[1], now);

    this.osc3 = this.ctx.createOscillator();
    this.osc3.type = p.osc3Type;
    this.osc3.detune.setValueAtTime(p.detuneCents[2], now);
    this.osc3.frequency.setValueAtTime(330, now);
    this.osc3Gain = this.ctx.createGain();
    this.osc3Gain.gain.setValueAtTime(p.oscGains[2], now);

    this.subOsc = this.ctx.createOscillator();
    this.subOsc.type = 'sine';
    this.subOsc.frequency.setValueAtTime(55, now);
    this.subOscGain = this.ctx.createGain();
    this.subOscGain.gain.setValueAtTime(p.subHarmonicGain, now);

    this.osc1.connect(this.osc1Gain);
    this.osc2.connect(this.osc2Gain);
    this.osc3.connect(this.osc3Gain);
    this.subOsc.connect(this.subOscGain);

    this.osc1Gain.connect(this.pulseModNode);
    this.osc2Gain.connect(this.pulseModNode);
    this.osc3Gain.connect(this.pulseModNode);
    this.subOscGain.connect(this.pulseModNode);

    this.pulseModNode.connect(this.distortionNode);
    this.distortionNode.connect(this.formantFilter);
    this.formantFilter.connect(this.exhaustFilter);
    this.exhaustFilter.connect(this.engineGain);

    // High-RPM Harmonic Scream Layer (soaring top-end F1 V10 shriek)
    this.screamOsc1 = this.ctx.createOscillator();
    this.screamOsc1.type = 'sawtooth';
    this.screamOsc1.detune.setValueAtTime(-6, now);
    this.screamOsc1.frequency.setValueAtTime(440, now);

    this.screamOsc2 = this.ctx.createOscillator();
    this.screamOsc2.type = 'sawtooth';
    this.screamOsc2.detune.setValueAtTime(8, now);
    this.screamOsc2.frequency.setValueAtTime(660, now);

    this.screamOsc3 = this.ctx.createOscillator();
    this.screamOsc3.type = 'triangle';
    this.screamOsc3.detune.setValueAtTime(14, now);
    this.screamOsc3.frequency.setValueAtTime(880, now);

    this.screamFilter = this.ctx.createBiquadFilter();
    this.screamFilter.type = 'peaking';
    this.screamFilter.frequency.setValueAtTime(p.screamResonanceFreq, now);
    this.screamFilter.Q.setValueAtTime(p.screamQ, now);
    this.screamFilter.gain.setValueAtTime(9.5, now);

    this.screamGain = this.ctx.createGain();
    this.screamGain.gain.setValueAtTime(0.0001, now);

    this.screamOsc1.connect(this.screamFilter);
    this.screamOsc2.connect(this.screamFilter);
    this.screamOsc3.connect(this.screamFilter);
    this.screamFilter.connect(this.screamGain);
    this.screamGain.connect(this.engineGain);

    // Smooth Band-Limited Turbo Spool Whistle
    this.turboGain = this.ctx.createGain();
    this.turboGain.gain.setValueAtTime(0.0001, now);
    this.turboOsc = this.ctx.createOscillator();
    this.turboOsc.type = 'sine';
    this.turboOsc.frequency.setValueAtTime(p.turboFreqBase, now);
    this.turboOsc.connect(this.turboGain);
    this.turboGain.connect(this.engineGain);

    // Dedicated Mechanical Twin-Screw Roots/Lysholm Supercharger Lobe Mesh Whine:
    // Mechanical rotor lobe tooth-mesh (sawtooth + triangle) connected directly into the engine exhaust distortion bus!
    // Zero electric PWM inverter modulation, and only engages under positive throttle/boost!
    this.superchargerGain = this.ctx.createGain();
    this.superchargerGain.gain.setValueAtTime(0.0001, now);

    this.superchargerFilter = this.ctx.createBiquadFilter();
    this.superchargerFilter.type = 'bandpass';
    this.superchargerFilter.frequency.setValueAtTime(950, now);
    this.superchargerFilter.Q.setValueAtTime(3.2, now);

    this.superchargerOsc1 = this.ctx.createOscillator();
    this.superchargerOsc1.type = 'sawtooth';
    this.superchargerOsc1.frequency.setValueAtTime(750, now);

    this.superchargerOsc2 = this.ctx.createOscillator();
    this.superchargerOsc2.type = 'triangle';
    this.superchargerOsc2.frequency.setValueAtTime(1000, now);

    this.superchargerOsc1.connect(this.superchargerFilter);
    this.superchargerOsc2.connect(this.superchargerFilter);
    this.superchargerFilter.connect(this.superchargerGain);
    if (this.distortionNode) {
      this.superchargerGain.connect(this.distortionNode);
    } else {
      this.superchargerGain.connect(this.engineGain);
    }

    // Dedicated ERS 350kW MGU-K Electric Inverter & Straight-Cut Helical Gear Whine
    // Routed through its own resonant high-frequency electric bandpass bus so it sounds like genuine electric hybrid ERS deployment, NOT an engine noise!
    this.electricWhineGain = this.ctx.createGain();
    this.electricWhineGain.gain.setValueAtTime(0.0001, now);

    this.electricFilter = this.ctx.createBiquadFilter();
    this.electricFilter.type = 'bandpass';
    this.electricFilter.frequency.setValueAtTime(3200, now);
    this.electricFilter.Q.setValueAtTime(4.2, now);

    this.electricOsc = this.ctx.createOscillator();
    this.electricOsc.type = 'sine';
    this.electricOsc.frequency.setValueAtTime(2800, now);

    this.electricHarmonicOsc = this.ctx.createOscillator();
    this.electricHarmonicOsc.type = 'sine';
    this.electricHarmonicOsc.frequency.setValueAtTime(4200, now);

    this.electricHarmonicGain = this.ctx.createGain();
    this.electricHarmonicGain.gain.setValueAtTime(0.45, now);

    // Subtle 55Hz PWM inverter frequency modulation for authentic electric motor inverter whine
    this.ersPwmOsc = this.ctx.createOscillator();
    this.ersPwmOsc.type = 'sine';
    this.ersPwmOsc.frequency.setValueAtTime(55, now);

    this.ersPwmGain = this.ctx.createGain();
    this.ersPwmGain.gain.setValueAtTime(22, now);

    this.ersPwmOsc.connect(this.ersPwmGain);
    this.ersPwmGain.connect(this.electricOsc.frequency);

    this.electricOsc.connect(this.electricFilter);
    this.electricHarmonicOsc.connect(this.electricHarmonicGain);
    this.electricHarmonicGain.connect(this.electricFilter);
    this.electricFilter.connect(this.electricWhineGain);
    this.electricWhineGain.connect(this.ctx.destination);

    this.engineGain.connect(this.ctx.destination);

    this.osc1.start();
    this.osc2.start();
    this.osc3.start();
    this.subOsc.start();
    this.screamOsc1.start();
    this.screamOsc2.start();
    this.screamOsc3.start();
    this.pulseOsc.start();
    this.turboOsc.start();
    this.superchargerOsc1.start();
    this.superchargerOsc2.start();
    this.electricOsc.start();
    this.electricHarmonicOsc.start();
    this.ersPwmOsc.start();
  }

  /**
   * Fires a crisp high-voltage MGU-K inverter engagement chirp the instant ERS Boost is activated
   */
  private playErsEngageChirp() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    if (!Number.isFinite(t)) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1950, t);
    osc.frequency.exponentialRampToValueAtTime(3850, t + 0.11);

    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  private setupTireNodes() {
    if (!this.ctx) return;

    // White noise generator for tire screech
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.tireNoiseNode = this.ctx.createBufferSource();
    this.tireNoiseNode.buffer = noiseBuffer;
    this.tireNoiseNode.loop = true;

    this.tireFilter = this.ctx.createBiquadFilter();
    this.tireFilter.type = 'bandpass';
    this.tireFilter.frequency.setValueAtTime(1300, this.ctx.currentTime);
    this.tireFilter.Q.setValueAtTime(4.5, this.ctx.currentTime);

    this.tireGain = this.ctx.createGain();
    this.tireGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    this.tireNoiseNode.connect(this.tireFilter);
    this.tireFilter.connect(this.tireGain);
    this.tireGain.connect(this.ctx.destination);

    this.tireNoiseNode.start();
  }

  private setupKerbNodes() {
    if (!this.ctx) return;

    this.kerbGain = this.ctx.createGain();
    this.kerbGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    this.kerbOsc = this.ctx.createOscillator();
    this.kerbOsc.type = 'square';
    this.kerbOsc.frequency.setValueAtTime(48, this.ctx.currentTime);

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(160, this.ctx.currentTime);

    this.kerbOsc.connect(lowpass);
    lowpass.connect(this.kerbGain);
    this.kerbGain.connect(this.ctx.destination);

    this.kerbOsc.start();
  }

  private setupWindNodes() {
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = noiseBuffer;
    this.windSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    this.windSource.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);

    this.windSource.start();
  }

  /**
   * Update engine sound parameters dynamically at 60fps
   */
  public updateEngine(rpm: number, throttle: number, speedKmh: number, ersActive: boolean, tireSlip: number, onCurb: boolean) {
    if (!this.ctx || this.isMuted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;
    if (!Number.isFinite(t)) return;

    const safeRpm = Number.isFinite(rpm) ? rpm : 4000;
    const safeThrottle = Number.isFinite(throttle) ? Math.max(0, Math.min(1, throttle)) : 0;
    const safeSpeed = Number.isFinite(speedKmh) ? Math.max(0, Math.abs(speedKmh)) : 0;
    const safeTireSlip = Number.isFinite(tireSlip) ? Math.max(0, Math.min(1, tireSlip)) : 0;

    const p = this.activeProfile || ENGINE_SOUND_PROFILES.ferrari;
    const isV10Works = p.id === 'works_inhouse';

    const isStreetProfile =
      p.id.startsWith('honda_') ||
      p.id.startsWith('toyota_') ||
      p.id.startsWith('dodge_') ||
      p.id.startsWith('chevy_') ||
      p.id.startsWith('cadillac_') ||
      p.id.startsWith('bmw_') ||
      p.id.startsWith('nissan_') ||
      p.id.startsWith('porsche_') ||
      p.id.startsWith('lamborghini_') ||
      p.id.startsWith('koenigsegg_') ||
      p.id.startsWith('bugatti_') ||
      p.id.startsWith('rimac_') ||
      p.id.startsWith('mcmurtry_');

    const minRpm = isStreetProfile ? 750 : 2500;
    const maxRpm = isStreetProfile
      ? p.id === 'porsche_911'
        ? 9000
        : p.id === 'chevy_corvette'
        ? (p.name.includes('LT6') ? 8600 : 6600)
        : p.id === 'lamborghini_huracan' || p.id === 'koenigsegg_jesko'
        ? 8500
        : p.id.includes('challenger') || p.id.includes('charger') || p.id.includes('camaro') || p.id.includes('escalade')
        ? 6500
        : 8200
      : 15000;

    const clampedRpm = Math.max(minRpm, Math.min(maxRpm, safeRpm));
    const rpmNorm = Math.max(0, Math.min(1, (clampedRpm - minRpm) / (maxRpm - minRpm)));

    // Base frequency customized for each distinct engine manufacturer:
    const baseFreq = (clampedRpm / 60) * p.baseFreqMultiplier;

    if (this.osc1 && this.osc2 && this.osc3 && Number.isFinite(baseFreq)) {
      this.osc1.frequency.setTargetAtTime(baseFreq * p.harmonicMultipliers[0], t, 0.03);
      this.osc2.frequency.setTargetAtTime(baseFreq * p.harmonicMultipliers[1], t, 0.03);
      this.osc3.frequency.setTargetAtTime(baseFreq * p.harmonicMultipliers[2], t, 0.03);
    }

    if (this.subOsc && Number.isFinite(baseFreq)) {
      this.subOsc.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.03);
    }

    // High-RPM Harmonic Scream Layer:
    // For Works In-House Bespoke PU (Screaming V10), kicks in early (rpmNorm > 0.18) and soars into a 3-voice F1 V10 shriek!
    if (this.screamOsc1 && this.screamOsc2 && this.screamOsc3 && this.screamFilter && this.screamGain && Number.isFinite(baseFreq)) {
      const screamFreq1 = Math.min(6200, baseFreq * p.screamHarmonicMultiplier);
      const screamFreq2 = Math.min(7400, screamFreq1 * p.screamChorusRatio);
      const screamFreq3 = Math.min(8600, baseFreq * (isV10Works ? 5.0 : p.screamHarmonicMultiplier * 1.25));
      const rampThreshold = isV10Works ? 0.16 : 0.36;
      const highRpmRamp = Math.max(0, (rpmNorm - rampThreshold) / (1 - rampThreshold));
      const screamExp = isV10Works ? 1.15 : 1.55;
      const screamEnvelope = Math.pow(highRpmRamp, screamExp) * (0.42 + 0.58 * safeThrottle);
      const targetScreamGain = Math.max(0.0001, p.screamGainMax * screamEnvelope);
      const dynamicScreamCutoff = p.screamResonanceFreq * (0.65 + 0.72 * rpmNorm);

      if (Number.isFinite(screamFreq1)) this.screamOsc1.frequency.setTargetAtTime(screamFreq1, t, 0.025);
      if (Number.isFinite(screamFreq2)) this.screamOsc2.frequency.setTargetAtTime(screamFreq2, t, 0.025);
      if (Number.isFinite(screamFreq3)) this.screamOsc3.frequency.setTargetAtTime(screamFreq3, t, 0.025);
      if (Number.isFinite(dynamicScreamCutoff)) this.screamFilter.frequency.setTargetAtTime(dynamicScreamCutoff, t, 0.035);
      if (Number.isFinite(targetScreamGain)) this.screamGain.gain.setTargetAtTime(targetScreamGain, t, 0.03);
    }

    // Firing-order pulse & off-throttle overrun burble modulation
    if (this.pulseOsc && this.pulseDepthGain && Number.isFinite(baseFreq)) {
      const pulseHz = Math.max(14, Math.min(220, baseFreq * p.pulseRateMultiplier));
      const offThrottleBoost = (1 - safeThrottle) * rpmNorm * 0.14;
      const targetPulseDepth = p.pulseDepth + offThrottleBoost;
      this.pulseOsc.frequency.setTargetAtTime(pulseHz, t, 0.04);
      this.pulseDepthGain.gain.setTargetAtTime(targetPulseDepth, t, 0.04);
    }

    // Dynamic exhaust lowpass & formant sweep (warm deep idle -> screaming high-RPM wail)
    if (this.exhaustFilter) {
      const dynamicCutoff =
        p.filterCutoffIdle +
        (p.filterCutoffRedline - p.filterCutoffIdle) * (0.72 * Math.pow(rpmNorm, isV10Works ? 0.95 : 1.15) + 0.28 * safeThrottle);
      if (Number.isFinite(dynamicCutoff)) {
        this.exhaustFilter.frequency.setTargetAtTime(dynamicCutoff, t, 0.04);
      }
    }

    if (this.formantFilter) {
      const dynamicFormant = p.formantFreq * (0.82 + 0.45 * rpmNorm);
      if (Number.isFinite(dynamicFormant)) {
        this.formantFilter.frequency.setTargetAtTime(dynamicFormant, t, 0.045);
      }
    }

    if (this.turboOsc && this.turboGain) {
      const turboFreq = p.turboFreqBase + rpmNorm * p.turboFreqSpan;
      const turboVolume = (0.15 + 0.85 * safeThrottle) * p.turboGainFactor * Math.pow(rpmNorm, 1.2);
      if (Number.isFinite(turboFreq)) this.turboOsc.frequency.setTargetAtTime(turboFreq, t, 0.07);
      if (Number.isFinite(turboVolume)) this.turboGain.gain.setTargetAtTime(Math.max(0.0001, turboVolume), t, 0.07);
    }

    // Authentic Mechanical Twin-Screw Roots/Lysholm Supercharger Whine:
    // Driven mechanically by crank pulley (2.4x-2.8x ratio). Rotor lobes mesh and compress intake air.
    // Under throttle boost, it delivers the signature Eaton/IHI helical blower howl.
    // Off-throttle, bypass valve opens and it completely silences, allowing deep V8 rumble and pops to dominate!
    if (this.superchargerGain && this.superchargerOsc1 && this.superchargerOsc2 && this.superchargerFilter) {
      const scFactor = p.superchargerGainFactor || 0;
      if (scFactor > 0.01 && safeThrottle > 0.12) {
        // Rotor tooth pass frequency: 380 Hz at low RPM to 1,580 Hz at redline
        const blowerBaseHz = 380 + rpmNorm * 1180;
        const lobeMeshRatio = 1.333; // 4-lobe / 3-lobe female-to-male rotor tooth mesh
        this.superchargerOsc1.frequency.setTargetAtTime(blowerBaseHz, t, 0.03);
        this.superchargerOsc2.frequency.setTargetAtTime(blowerBaseHz * lobeMeshRatio, t, 0.03);
        this.superchargerFilter.frequency.setTargetAtTime(blowerBaseHz * 1.12, t, 0.035);

        // Boost load builds exponentially with throttle opening:
        const boostLoad = Math.pow((safeThrottle - 0.12) / 0.88, 1.25);
        const blowerVol = scFactor * boostLoad * (0.35 + 0.65 * Math.pow(rpmNorm, 0.75));
        this.superchargerGain.gain.setTargetAtTime(Math.max(0.0001, blowerVol), t, 0.04);
      } else {
        this.superchargerGain.gain.setTargetAtTime(0.0001, t, 0.03);
      }
    }

    // Authentic EV Quad-Motor / Suction Fan / ERS MGU-K Whine (Electric ONLY, zero combustion whine):
    if (ersActive && !this.wasErsActive) {
      this.playErsEngageChirp();
    }
    this.wasErsActive = Boolean(ersActive);

    if (this.electricOsc && this.electricHarmonicOsc && this.electricFilter && this.electricWhineGain) {
      const speedNorm = Math.min(1.2, safeSpeed / 330);
      const isElectricOrFanCar = p.id === 'rimac_nevera' || p.id === 'mcmurtry_speirling';
      let carrierHz = 2550 + speedNorm * 1650 + rpmNorm * 280;
      let harmonicHz = carrierHz * 1.498;
      let targetWhineVol = 0.0001;

      if (isElectricOrFanCar) {
        carrierHz = p.electricWhineFreqBase + speedNorm * 1950 + rpmNorm * 950;
        harmonicHz = carrierHz * (p.id === 'mcmurtry_speirling' ? 1.62 : 1.5);
        targetWhineVol = p.electricWhineGainFactor * (0.45 + 0.55 * Math.max(safeThrottle, speedNorm * 0.75));
      } else if (ersActive && !isStreetProfile) {
        targetWhineVol = 0.19 * (0.65 + 0.35 * Math.min(1, speedNorm + 0.3));
      }

      if (Number.isFinite(carrierHz)) {
        this.electricOsc.frequency.setTargetAtTime(carrierHz, t, 0.03);
        this.electricFilter.frequency.setTargetAtTime(carrierHz * 1.08, t, 0.03);
      }
      if (Number.isFinite(harmonicHz)) {
        this.electricHarmonicOsc.frequency.setTargetAtTime(harmonicHz, t, 0.03);
      }
      if (this.ersPwmOsc) {
        const pwmRate = 48 + speedNorm * 42;
        if (Number.isFinite(pwmRate)) this.ersPwmOsc.frequency.setTargetAtTime(pwmRate, t, 0.04);
      }
      if (Number.isFinite(targetWhineVol)) {
        this.electricWhineGain.gain.setTargetAtTime(Math.max(0.0001, targetWhineVol), t, 0.035);
      }
    }

    // Real-time Turbo Blow-Off Flutter on High-RPM Throttle Lift-Off:
    if (
      p.turboGainFactor >= 0.08 &&
      this.prevThrottleLevel > 0.65 &&
      safeThrottle < 0.22 &&
      rpmNorm > 0.38 &&
      t - this.lastBovFlutterTime > 0.42
    ) {
      this.lastBovFlutterTime = t;
      this.playTurboBlowOffFlutter(rpmNorm);
    }

    // Real-time Overrun Exhaust Crackles, Pops & Burbles on Deceleration:
    const isCombustionPerformanceCar =
      p.id !== 'rimac_nevera' &&
      p.id !== 'mcmurtry_speirling' &&
      (p.distortionAmount >= 9 || p.subHarmonicGain >= 0.18);
    if (
      isCombustionPerformanceCar &&
      safeThrottle < 0.12 &&
      rpmNorm > 0.30 &&
      safeSpeed > 42 &&
      t - this.lastExhaustCrackleTime > 0.11 &&
      Math.random() < 0.38
    ) {
      this.lastExhaustCrackleTime = t;
      this.playExhaustCracklePop(rpmNorm);
    }

    this.prevThrottleLevel = safeThrottle;

    if (this.engineGain) {
      const targetGain = Math.min(0.36, 0.065 + safeThrottle * 0.17 + rpmNorm * 0.11);
      if (Number.isFinite(targetGain)) this.engineGain.gain.setTargetAtTime(targetGain, t, 0.045);
    }

    // Tire squeal
    if (this.tireGain) {
      const slipAmount = Math.max(0, Math.min(1, (safeTireSlip - 0.25) * 1.8));
      this.tireGain.gain.setTargetAtTime(slipAmount * 0.22, t, 0.04);
      if (this.tireFilter) {
        this.tireFilter.frequency.setTargetAtTime(1100 + slipAmount * 600, t, 0.04);
      }
    }

    // Kerb rumble
    if (this.kerbGain && this.kerbOsc) {
      if (onCurb && safeSpeed > 30) {
        this.kerbGain.gain.setTargetAtTime(0.18, t, 0.03);
        const kerbFreq = 40 + (safeSpeed / 350) * 60;
        if (Number.isFinite(kerbFreq)) this.kerbOsc.frequency.setTargetAtTime(kerbFreq, t, 0.03);
      } else {
        this.kerbGain.gain.setTargetAtTime(0.0001, t, 0.05);
      }
    }

    // Wind noise (uses safeSpeed >= 0 so Math.pow never returns NaN in reverse gear)
    if (this.windGain) {
      const windVol = Math.pow(safeSpeed / 350, 1.8) * 0.14;
      if (Number.isFinite(windVol)) {
        this.windGain.gain.setTargetAtTime(windVol, t, 0.06);
      }
    }
  }

  /**
   * Synthesizes authentic JDM / Hypercar Turbo Blow-Off Valve (BOV) & Wastegate Compressor Flutter ("stututu / pshhh")
   */
  public playTurboBlowOffFlutter(intensity: number = 0.75) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    if (!Number.isFinite(t)) return;

    const p = this.activeProfile;
    if (p.turboGainFactor < 0.06) return;

    const dur = 0.26;
    const bufLen = Math.floor(this.ctx.sampleRate * dur);
    const noiseBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      const sec = i / this.ctx.sampleRate;
      // 18Hz compressor surge flutter envelope ("ch-ch-ch-pshh")
      const flutter = 0.55 + 0.45 * Math.sin(sec * Math.PI * 2 * 19);
      const decay = Math.exp(-sec * 9.5);
      data[i] = (Math.random() * 2 - 1) * flutter * decay;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuf;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2650, t);
    bp.frequency.exponentialRampToValueAtTime(1350, t + dur);
    bp.Q.setValueAtTime(3.6, t);

    const gain = this.ctx.createGain();
    const vol = Math.min(0.24, (0.09 + p.turboGainFactor * 0.55) * Math.max(0.4, intensity));
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t);
    src.stop(t + dur);
  }

  /**
   * Synthesizes a sharp exhaust overrun crackle / pop / backfire on off-throttle deceleration
   */
  public playExhaustCracklePop(rpmNorm: number = 0.6) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    if (!Number.isFinite(t)) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    const startPitch = 165 + Math.random() * 145 + rpmNorm * 65;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startPitch, t);
    osc.frequency.exponentialRampToValueAtTime(48 + Math.random() * 22, t + 0.055);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(340 + Math.random() * 240, t);
    filter.Q.setValueAtTime(1.8, t);

    const popVol = 0.08 + Math.random() * 0.07;
    gain.gain.setValueAtTime(popVol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /**
   * Sound effect: seamless gearbox shift thump, downshift rev-match bark & upshift turbo BOV flutter
   */
  public playGearShift(isDownshift: boolean = false) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    if (!Number.isFinite(t)) return;

    const p = this.activeProfile || ENGINE_SOUND_PROFILES.ferrari;
    const isV10Works = p.id === 'works_inhouse';
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isV10Works ? (isDownshift ? 1850 : 1200) : (isDownshift ? 820 : 420), t);

    osc.type = isV10Works ? 'sawtooth' : (isDownshift ? 'sawtooth' : 'sine');
    const startFreq = isDownshift ? p.shiftPitchBase * (isV10Works ? 2.4 : 1.75) : p.shiftPitchBase;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(isDownshift ? startFreq * 0.72 : (isV10Works ? 95 : 42), t + (isV10Works ? 0.065 : 0.095));

    gain.gain.setValueAtTime(isDownshift ? 0.18 : 0.20, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isV10Works ? 0.065 : 0.095));

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + (isV10Works ? 0.065 : 0.095));

    // Trigger authentic turbo blow-off flutter on upshifts or exhaust crackle on downshifts!
    if (!isDownshift && p.turboGainFactor >= 0.08 && t - this.lastBovFlutterTime > 0.22) {
      this.lastBovFlutterTime = t;
      this.playTurboBlowOffFlutter(0.85);
    } else if (isDownshift && p.id !== 'rimac_nevera' && p.id !== 'mcmurtry_speirling') {
      this.playExhaustCracklePop(0.75);
    }
  }

  /**
   * Sound effect: Starting lights countdown beeps
   */
  public playStartLightBeep(isLightsOut: boolean = false) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const freq = isLightsOut ? 880 : 440; // Higher pitch when lights go out!
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isLightsOut ? 0.35 : 0.18));

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + (isLightsOut ? 0.35 : 0.18));
  }

  private engineerVoiceEnabled: boolean = true;

  public isEngineerVoiceEnabled(): boolean {
    return this.engineerVoiceEnabled;
  }

  public setEngineerVoiceEnabled(enabled: boolean) {
    this.engineerVoiceEnabled = enabled;
    if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Sound effect: Team radio beep + walkie-talkie squelch
   */
  public playRadioChime(priority: 'normal' | 'warning' | 'critical' = 'normal') {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    if (priority === 'critical') {
      osc.frequency.setValueAtTime(980, t);
      osc.frequency.setValueAtTime(1320, t + 0.06);
      osc.frequency.setValueAtTime(980, t + 0.12);
    } else if (priority === 'warning') {
      osc.frequency.setValueAtTime(840, t);
      osc.frequency.setValueAtTime(1120, t + 0.07);
    } else {
      osc.frequency.setValueAtTime(750, t);
      osc.frequency.setValueAtTime(950, t + 0.08);
    }

    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  /**
   * Race Engineer Voice & Pit-Wall Radio Transmission
   */
  public speakRaceEngineer(text: string, priority: 'normal' | 'warning' | 'critical' = 'normal') {
    this.playRadioChime(priority);
    if (this.isMuted || !this.engineerVoiceEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      const synth = window.speechSynthesis;
      if (priority === 'critical') {
        synth.cancel();
      } else if (synth.speaking) {
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = priority === 'critical' ? 1.15 : 1.08;
      utterance.pitch = 0.94;
      utterance.volume = 0.85;

      const voices = synth.getVoices ? synth.getVoices() : [];
      const preferredVoice =
        voices.find((v) => /en-GB|British|UK|Daniel|Oliver|Arthur/i.test(v.name || v.lang)) ||
        voices.find((v) => /en-/i.test(v.lang));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      synth.speak(utterance);
    } catch {
      // SpeechSynthesis fallback: chime already played
    }
  }

  /**
   * Sound effect: Vehicle or barrier collision crash impact
   */
  public playCrash(intensity: number = 1.0) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Heavy low frequency impact thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);

    const vol = Math.min(0.6, 0.2 + intensity * 0.35);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);

    // Metal scrape noise
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.2);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.2, this.ctx.currentTime);
    }
    if (this.electricWhineGain && this.ctx && this.isMuted) {
      this.electricWhineGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    }
    if (this.isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    return this.isMuted;
  }

  public stopAll() {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    }
    if (this.electricWhineGain && this.ctx) {
      this.electricWhineGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    }
    if (this.tireGain && this.ctx) {
      this.tireGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    }
    if (this.kerbGain && this.ctx) {
      this.kerbGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    }
    if (this.windGain && this.ctx) {
      this.windGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.wasErsActive = false;
  }

  private lastHornTimeMs = 0;

  public playCarHorn(pitchMultiplier: number = 1.0) {
    if (this.isMuted || !this.ctx) return;
    const nowMs = performance.now();
    if (nowMs - this.lastHornTimeMs < 140) return;
    this.lastHornTimeMs = nowMs;

    this.resume();
    const t = this.ctx.currentTime;

    // Dual-tone automotive street horn (F4 ~349Hz + A4 ~440Hz harmonic, scaled by pitchMultiplier)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(365 * pitchMultiplier, t);
    osc2.frequency.setValueAtTime(458 * pitchMultiplier, t);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1650 * pitchMultiplier, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain.gain.setValueAtTime(0.15, t + 0.24);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.35);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.36);
    osc2.stop(t + 0.36);
  }

  public playBlinkerTick(high: boolean = true) {
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(high ? 1150 : 820, t);
    gain.gain.setValueAtTime(0.045, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.028);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  /**
   * Police Megaphone Voice + Whelen Electronic Horn Blip + Squelch
   * "Driver! Pull over to the side of the road immediately! Metro Police Department! Turn off your engine!"
   */
  public playMegaphonePullOverVoice() {
    if (this.isMuted) return;
    this.resume();

    // 1. Megaphone Radio Mic Squelch + Electronic Siren Yelp Horn Blast
    if (this.ctx) {
      try {
        const t = this.ctx.currentTime;

        // Stage A: High-frequency mic click & diaphragm burst
        const clickOsc = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        clickOsc.type = 'sawtooth';
        clickOsc.frequency.setValueAtTime(1800, t);
        clickOsc.frequency.exponentialRampToValueAtTime(420, t + 0.06);
        clickGain.gain.setValueAtTime(0.24, t);
        clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        clickOsc.connect(clickGain);
        clickGain.connect(this.ctx.destination);
        clickOsc.start(t);
        clickOsc.stop(t + 0.08);

        // Stage B: Dual-Tone Whelen / Federal Signal Electronic Yelp Horn Blip
        const hornOsc1 = this.ctx.createOscillator();
        const hornOsc2 = this.ctx.createOscillator();
        const hornGain = this.ctx.createGain();
        const hornFilter = this.ctx.createBiquadFilter();

        hornFilter.type = 'bandpass';
        hornFilter.frequency.setValueAtTime(1450, t + 0.08);
        hornFilter.Q.setValueAtTime(2.8, t + 0.08);

        hornOsc1.type = 'sawtooth';
        hornOsc1.frequency.setValueAtTime(620, t + 0.08);
        hornOsc1.frequency.exponentialRampToValueAtTime(1550, t + 0.28);

        hornOsc2.type = 'square';
        hornOsc2.frequency.setValueAtTime(930, t + 0.08);
        hornOsc2.frequency.exponentialRampToValueAtTime(1860, t + 0.28);

        hornGain.gain.setValueAtTime(0.001, t + 0.08);
        hornGain.gain.linearRampToValueAtTime(0.28, t + 0.14);
        hornGain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);

        hornOsc1.connect(hornFilter);
        hornOsc2.connect(hornFilter);
        hornFilter.connect(hornGain);
        hornGain.connect(this.ctx.destination);

        hornOsc1.start(t + 0.08);
        hornOsc2.start(t + 0.08);
        hornOsc1.stop(t + 0.38);
        hornOsc2.stop(t + 0.38);

        // Stage C: Acoustic PA Horn Resonances (vocal megaphone presence)
        const paNotes = [720, 1150, 1420];
        paNotes.forEach((freq, idx) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t + 0.36 + idx * 0.09);
          gain.gain.setValueAtTime(0.12, t + 0.36 + idx * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.46 + idx * 0.09);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t + 0.36 + idx * 0.09);
          osc.stop(t + 0.48 + idx * 0.09);
        });
      } catch {
        // WebAudio safe fallback
      }
    }

    // 2. Synthesize High-Impact Police Megaphone Voice with Mic Tail Click
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(
          'Driver! Pull over to the side of the road immediately! Metro Police Department! Turn off your engine!'
        );

        // Find authoritative commanding English voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice =
          voices.find(
            (v) =>
              (v.name.includes('David') ||
                v.name.includes('Daniel') ||
                v.name.includes('Alex') ||
                v.name.includes('Google US English') ||
                v.name.includes('Natural')) &&
              v.lang.startsWith('en')
          ) || voices.find((v) => v.lang.startsWith('en-US')) || voices.find((v) => v.lang.startsWith('en'));

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.rate = 1.02;
        utterance.pitch = 0.88; // Deep, commanding officer tone
        utterance.volume = 1.0;

        // Trailing squelch radio click when officer releases the megaphone mic trigger
        utterance.onend = () => {
          if (this.ctx) {
            try {
              const t2 = this.ctx.currentTime;
              const tailOsc = this.ctx.createOscillator();
              const tailGain = this.ctx.createGain();
              tailOsc.type = 'sawtooth';
              tailOsc.frequency.setValueAtTime(2200, t2);
              tailOsc.frequency.exponentialRampToValueAtTime(350, t2 + 0.07);
              tailGain.gain.setValueAtTime(0.18, t2);
              tailGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.08);
              tailOsc.connect(tailGain);
              tailGain.connect(this.ctx.destination);
              tailOsc.start(t2);
              tailOsc.stop(t2 + 0.09);
            } catch {}
          }
        };

        window.speechSynthesis.speak(utterance);
      } catch {
        // Speech synthesis fallback handled gracefully
      }
    }
  }

  /**
   * High-Tech Radar Detector Warning Beep (Ka/K-Band Radar Alert)
   */
  public playRadarWarningBeep() {
    if (this.isMuted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Rapid double-beep radar warning chirp (1850Hz + 2200Hz)
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1850 + i * 250, t + i * 0.1);
      gain.gain.setValueAtTime(0.12, t + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.065);
    }
  }
}

export const soundEngine = new SoundEngine();
