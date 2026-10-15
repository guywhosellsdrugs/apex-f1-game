/**
 * Web Audio API procedural sound engine for F1 2026 simulation
 * Generates V6 Turbo-hybrid engine harmonics, turbo whine, tire squeal, kerbs, and race sounds.
 */

export type EngineSoundProfileId = 'ferrari' | 'mercedes' | 'honda_rbpt' | 'audi_renault' | 'works_inhouse';

export interface EngineSoundProfile {
  id: EngineSoundProfileId;
  name: string;
  osc1Type: OscillatorType;
  osc2Type: OscillatorType;
  osc3Type: OscillatorType;
  harmonicMultipliers: [number, number, number];
  baseFreqMultiplier: number;
  distortionAmount: number;
  filterCutoff: number;
  filterQ: number;
  turboFreqBase: number;
  turboGainFactor: number;
  electricWhineFreqBase: number;
  electricWhineGainFactor: number;
}

export const ENGINE_SOUND_PROFILES: Record<EngineSoundProfileId, EngineSoundProfile> = {
  ferrari: {
    id: 'ferrari',
    name: 'Ferrari 066/14 V6 Turbo',
    osc1Type: 'sawtooth',
    osc2Type: 'sawtooth',
    osc3Type: 'triangle',
    harmonicMultipliers: [1.0, 2.0, 3.15],
    baseFreqMultiplier: 3.25, // Sharp high Italian scream
    distortionAmount: 26,
    filterCutoff: 5200,
    filterQ: 2.2,
    turboFreqBase: 1950,
    turboGainFactor: 0.12,
    electricWhineFreqBase: 950,
    electricWhineGainFactor: 0.14,
  },
  mercedes: {
    id: 'mercedes',
    name: 'Mercedes-AMG M17 High Output',
    osc1Type: 'sawtooth',
    osc2Type: 'triangle',
    osc3Type: 'sine',
    harmonicMultipliers: [1.0, 1.5, 2.5],
    baseFreqMultiplier: 2.65, // Deep German mechanical bass-growl
    distortionAmount: 18,
    filterCutoff: 3700,
    filterQ: 3.0,
    turboFreqBase: 1600,
    turboGainFactor: 0.09,
    electricWhineFreqBase: 1200,
    electricWhineGainFactor: 0.28, // High-pitch futuristic MGU-K electric turbine whine
  },
  honda_rbpt: {
    id: 'honda_rbpt',
    name: 'Ford Red Bull Powertrains / Honda HRC',
    osc1Type: 'sawtooth',
    osc2Type: 'square',
    osc3Type: 'sawtooth',
    harmonicMultipliers: [1.0, 1.75, 2.3],
    baseFreqMultiplier: 2.95, // Aggressive raw combustion punch & snarl
    distortionAmount: 34,
    filterCutoff: 4600,
    filterQ: 1.9,
    turboFreqBase: 2400, // Screaming high-pressure turbo whistle
    turboGainFactor: 0.22,
    electricWhineFreqBase: 1050,
    electricWhineGainFactor: 0.15,
  },
  audi_renault: {
    id: 'audi_renault',
    name: 'Audi Sport F1 V6 / Alpine Renault',
    osc1Type: 'triangle',
    osc2Type: 'sawtooth',
    osc3Type: 'sawtooth',
    harmonicMultipliers: [1.0, 1.45, 1.95],
    baseFreqMultiplier: 2.75, // Balanced European touring note
    distortionAmount: 20,
    filterCutoff: 4100,
    filterQ: 1.7,
    turboFreqBase: 1750,
    turboGainFactor: 0.11,
    electricWhineFreqBase: 900,
    electricWhineGainFactor: 0.15,
  },
  works_inhouse: {
    id: 'works_inhouse',
    name: 'Works In-House Bespoke PU',
    osc1Type: 'sawtooth',
    osc2Type: 'square',
    osc3Type: 'sawtooth',
    harmonicMultipliers: [1.0, 1.85, 2.85],
    baseFreqMultiplier: 3.15, // Fierce bespoke racing crescendo
    distortionAmount: 30,
    filterCutoff: 5500,
    filterQ: 2.6,
    turboFreqBase: 2150,
    turboGainFactor: 0.18,
    electricWhineFreqBase: 1100,
    electricWhineGainFactor: 0.22,
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

  // Engine sound nodes
  private engineGain: GainNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private osc3: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private turboOsc: OscillatorNode | null = null;
  private electricWhineGain: GainNode | null = null;
  private electricOsc: OscillatorNode | null = null;
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
    if (norm.includes('mercedes') || norm.includes('m17')) {
      profileKey = 'mercedes';
    } else if (norm.includes('red bull') || norm.includes('ford') || norm.includes('honda') || norm.includes('rbpt') || norm.includes('hrc')) {
      profileKey = 'honda_rbpt';
    } else if (norm.includes('audi') || norm.includes('renault') || norm.includes('alpine')) {
      profileKey = 'audi_renault';
    } else if (norm.includes('works') || norm.includes('bespoke') || norm.includes('custom') || norm.includes('in-house') || norm.includes('inhouse')) {
      profileKey = 'works_inhouse';
    } else if (norm.includes('ferrari')) {
      profileKey = 'ferrari';
    }
    this.activeProfile = ENGINE_SOUND_PROFILES[profileKey];
    this.applyEngineProfile();
  }

  private applyEngineProfile() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.exhaustFilter) {
      this.exhaustFilter.frequency.setTargetAtTime(this.activeProfile.filterCutoff, t, 0.05);
      this.exhaustFilter.Q.setTargetAtTime(this.activeProfile.filterQ, t, 0.05);
    }
    if (this.distortionNode) {
      this.distortionNode.curve = this.createDistortionCurve(this.activeProfile.distortionAmount) as unknown as Float32Array<ArrayBuffer>;
    }
    if (this.osc1) this.osc1.type = this.activeProfile.osc1Type;
    if (this.osc2) this.osc2.type = this.activeProfile.osc2Type;
    if (this.osc3) this.osc3.type = this.activeProfile.osc3Type;
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
    const totalSteps = 90; // ~2.25 seconds rev preview

    this.previewIntervalId = window.setInterval(() => {
      progress++;
      const fraction = progress / totalSteps;
      let targetRpm = 4500;
      let targetThrottle = 0;

      if (fraction < 0.2) {
        // Idle blip
        targetRpm = 4500 + fraction * 15000;
        targetThrottle = 0.4;
      } else if (fraction < 0.6) {
        // Full throttle screaming acceleration to redline
        const revFrac = (fraction - 0.2) / 0.4;
        targetRpm = 7500 + revFrac * 6500; // up to 14,000 RPM
        targetThrottle = 1.0;
      } else if (fraction < 0.75) {
        // Shift blip drop
        targetRpm = 11500;
        targetThrottle = 0.2;
      } else {
        // Return to idle
        const decayFrac = (fraction - 0.75) / 0.25;
        targetRpm = 11500 - decayFrac * 7000;
        targetThrottle = 0;
      }

      this.updateEngine(targetRpm, targetThrottle, targetRpm > 9000 ? 280 : 120, fraction > 0.3 && fraction < 0.6, 0, false);

      if (progress >= totalSteps) {
        if (this.previewIntervalId !== null) {
          clearInterval(this.previewIntervalId);
          this.previewIntervalId = null;
        }
        this.isPreviewingRev = false;
        // Fade out engine sound
        if (this.engineGain && this.ctx) {
          this.engineGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
        }
        if (callback) callback();
      }
    }, intervalMs);
  }

  private createDistortionCurve(amount: number = 20): Float32Array {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private setupEngineNodes() {
    if (!this.ctx) return;

    // Master Engine Gain
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

    // Distortion for aggressive exhaust rasp
    this.distortionNode = this.ctx.createWaveShaper();
    this.distortionNode.curve = this.createDistortionCurve(this.activeProfile.distortionAmount) as unknown as Float32Array<ArrayBuffer>;
    this.distortionNode.oversample = '2x';

    // Filter to shape F1 V6 exhaust body
    this.exhaustFilter = this.ctx.createBiquadFilter();
    this.exhaustFilter.type = 'lowpass';
    this.exhaustFilter.frequency.setValueAtTime(this.activeProfile.filterCutoff, this.ctx.currentTime);
    this.exhaustFilter.Q.setValueAtTime(this.activeProfile.filterQ, this.ctx.currentTime);

    // Three harmonic oscillators for V6 firing pulses
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = this.activeProfile.osc1Type;
    this.osc1.frequency.setValueAtTime(110, this.ctx.currentTime);

    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = this.activeProfile.osc2Type;
    this.osc2.frequency.setValueAtTime(220, this.ctx.currentTime);

    this.osc3 = this.ctx.createOscillator();
    this.osc3.type = this.activeProfile.osc3Type;
    this.osc3.frequency.setValueAtTime(330, this.ctx.currentTime);

    const oscMixGain = this.ctx.createGain();
    oscMixGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    this.osc1.connect(this.distortionNode);
    this.osc2.connect(this.distortionNode);
    this.osc3.connect(this.distortionNode);
    this.distortionNode.connect(this.exhaustFilter);
    this.exhaustFilter.connect(this.engineGain);

    // Turbo whistle
    this.turboGain = this.ctx.createGain();
    this.turboGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.turboOsc = this.ctx.createOscillator();
    this.turboOsc.type = 'sine';
    this.turboOsc.frequency.setValueAtTime(this.activeProfile.turboFreqBase, this.ctx.currentTime);
    this.turboOsc.connect(this.turboGain);
    this.turboGain.connect(this.engineGain);

    // ERS Electric Whine (2026 350kW MGU-K sound)
    this.electricWhineGain = this.ctx.createGain();
    this.electricWhineGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.electricOsc = this.ctx.createOscillator();
    this.electricOsc.type = 'sine';
    this.electricOsc.frequency.setValueAtTime(this.activeProfile.electricWhineFreqBase, this.ctx.currentTime);
    this.electricOsc.connect(this.electricWhineGain);
    this.electricWhineGain.connect(this.engineGain);

    this.engineGain.connect(this.ctx.destination);

    this.osc1.start();
    this.osc2.start();
    this.osc3.start();
    this.turboOsc.start();
    this.electricOsc.start();
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
    const safeRpm = Number.isFinite(rpm) ? rpm : 4000;
    const safeThrottle = Number.isFinite(throttle) ? Math.max(0, Math.min(1, throttle)) : 0;
    const safeSpeed = Number.isFinite(speedKmh) ? Math.abs(speedKmh) : 0;

    const clampedRpm = Math.max(2500, Math.min(15000, safeRpm));
    // Base frequency customized for each distinct engine manufacturer:
    const baseFreq = (clampedRpm / 60) * this.activeProfile.baseFreqMultiplier;

    if (this.osc1 && this.osc2 && this.osc3) {
      this.osc1.frequency.setTargetAtTime(baseFreq * this.activeProfile.harmonicMultipliers[0], t, 0.04);
      this.osc2.frequency.setTargetAtTime(baseFreq * this.activeProfile.harmonicMultipliers[1], t, 0.04);
      this.osc3.frequency.setTargetAtTime(baseFreq * this.activeProfile.harmonicMultipliers[2], t, 0.04);
    }

    if (this.turboOsc && this.turboGain) {
      const turboFreq = this.activeProfile.turboFreqBase + (clampedRpm / 15000) * 2200;
      this.turboOsc.frequency.setTargetAtTime(turboFreq, t, 0.06);
      const turboVolume = safeThrottle * this.activeProfile.turboGainFactor * (clampedRpm / 15000);
      this.turboGain.gain.setTargetAtTime(turboVolume, t, 0.06);
    }

    if (this.electricOsc && this.electricWhineGain) {
      const whineFreq = this.activeProfile.electricWhineFreqBase + (safeSpeed / 350) * 1600;
      this.electricOsc.frequency.setTargetAtTime(whineFreq, t, 0.05);
      const whineVol = ersActive
        ? this.activeProfile.electricWhineGainFactor
        : (safeSpeed / 350) * (this.activeProfile.electricWhineGainFactor * 0.35);
      this.electricWhineGain.gain.setTargetAtTime(whineVol, t, 0.05);
    }

    if (this.engineGain) {
      const targetGain = Math.min(0.35, 0.06 + safeThrottle * 0.22 + (clampedRpm / 15000) * 0.1);
      this.engineGain.gain.setTargetAtTime(targetGain, t, 0.05);
    }

    // Tire squeal
    if (this.tireGain) {
      const slipAmount = Math.max(0, Math.min(1, (tireSlip - 0.25) * 1.8));
      this.tireGain.gain.setTargetAtTime(slipAmount * 0.25, t, 0.04);
      if (this.tireFilter) {
        this.tireFilter.frequency.setTargetAtTime(1100 + slipAmount * 600, t, 0.04);
      }
    }

    // Kerb rumble
    if (this.kerbGain && this.kerbOsc) {
      if (onCurb && speedKmh > 30) {
        this.kerbGain.gain.setTargetAtTime(0.18, t, 0.03);
        const kerbFreq = 40 + (speedKmh / 350) * 60;
        this.kerbOsc.frequency.setTargetAtTime(kerbFreq, t, 0.03);
      } else {
        this.kerbGain.gain.setTargetAtTime(0.0001, t, 0.05);
      }
    }

    // Wind noise
    if (this.windGain) {
      const windVol = Math.pow(speedKmh / 350, 1.8) * 0.15;
      this.windGain.gain.setTargetAtTime(windVol, t, 0.06);
    }
  }

  /**
   * Sound effect: gear shift pop & backfire
   */
  public playGearShift(isDownshift: boolean = false) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isDownshift ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isDownshift ? 180 : 80, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.12);
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

  /**
   * Sound effect: Team radio beep
   */
  public playRadioChime() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.setValueAtTime(950, t + 0.08);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.22);
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
    return this.isMuted;
  }

  public stopAll() {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    }
    if (this.tireGain && this.ctx) {
      this.tireGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    }
    if (this.kerbGain && this.ctx) {
      this.kerbGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    }
  }
}

export const soundEngine = new SoundEngine();
