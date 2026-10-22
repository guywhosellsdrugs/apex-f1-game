import React, { useState, useEffect } from 'react';
import {
  X,
  Gauge,
  Users,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Zap,
  Flag,
  Award,
  Shield,
  Trophy,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Gamepad,
  Keyboard,
  Radio,
  Flame,
  Timer,
  Navigation,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { inputManager } from '../services/inputManager';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Live interactive controls tester state
  const [liveThrottle, setLiveThrottle] = useState(0);
  const [liveBrake, setLiveBrake] = useState(0);
  const [liveSteer, setLiveSteer] = useState(0); // -1 (full left) to +1 (full right)
  const [liveDrs, setLiveDrs] = useState(false);
  const [liveErs, setLiveErs] = useState(false);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [gamepadInfo, setGamepadInfo] = useState<{ connected: boolean; name?: string }>({
    connected: false,
  });

  // Track keyboard & gamepad inputs live when tutorial is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        next.add(e.code.toLowerCase());
        return next;
      });

      if (key === 'w' || key === 'arrowup') setLiveThrottle(1.0);
      if (key === 's' || key === 'arrowdown') setLiveBrake(1.0);
      if (key === 'a' || key === 'arrowleft') setLiveSteer(-1.0);
      if (key === 'd' || key === 'arrowright') setLiveSteer(1.0);
      if (key === ' ' || e.code === 'Space') setLiveDrs(true);
      if (key === 'e' || key === 'b') setLiveErs(true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        next.delete(e.code.toLowerCase());
        return next;
      });

      if (key === 'w' || key === 'arrowup') setLiveThrottle(0);
      if (key === 's' || key === 'arrowdown') setLiveBrake(0);
      if (key === 'a' || key === 'arrowleft' || key === 'd' || key === 'arrowright') setLiveSteer(0);
      if (key === ' ' || e.code === 'Space') setLiveDrs(false);
      if (key === 'e' || key === 'b') setLiveErs(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Gamepad polling loop for live rig
    let rafId: number;
    const pollGamepad = () => {
      const padStatus = inputManager.getControllerStatus();
      setGamepadInfo({ connected: padStatus.connected, name: padStatus.id || undefined });

      const input = inputManager.poll();
      if (padStatus.connected) {
        if (input.throttle > 0.05) setLiveThrottle(input.throttle);
        if (input.brake > 0.05) setLiveBrake(input.brake);
        if (Math.abs(input.steer) > 0.05) setLiveSteer(input.steer);
        if (input.boost) {
          setLiveDrs(true);
          setLiveErs(true);
        }
      }
      rafId = requestAnimationFrame(pollGamepad);
    };
    rafId = requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(rafId);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFinish = () => {
    try {
      localStorage.setItem('apex26_tutorial_completed', 'true');
    } catch {}
    if (onComplete) onComplete();
    onClose();
  };

  const steps = [
    {
      id: 'controls_rig',
      title: 'Cockpit Controls & Live Telemetry Rig',
      subtitle: 'Experience physical control inputs and test your steering, pedals, and tactical deployment.',
      icon: Gauge,
      badge: 'Step 1 of 4: Live Controls',
      badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      content: (
        <div className="space-y-5">
          {/* Interactive Live Control Rig */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-red-500/30 shadow-inner space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Interactive Live Control Rig (Test Your Inputs Right Now)
                </span>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                {gamepadInfo.connected ? `🎮 ${gamepadInfo.name || 'Gamepad Active'}` : '⌨️ Keyboard Ready (Press W / A / S / D / Space)'}
              </span>
            </div>

            {/* Gauges & Telemetry Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Throttle Bar */}
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 font-bold uppercase">Throttle (W / RT)</span>
                  <span className="font-mono text-emerald-400 font-black">{(liveThrottle * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-neutral-950 h-3 rounded-full mt-2 overflow-hidden p-0.5 border border-neutral-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-75 shadow-lg shadow-emerald-500/50"
                    style={{ width: `${Math.max(4, liveThrottle * 100)}%` }}
                  />
                </div>
              </div>

              {/* Brake Bar */}
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 font-bold uppercase">Braking (S / LT)</span>
                  <span className="font-mono text-red-400 font-black">{(liveBrake * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-neutral-950 h-3 rounded-full mt-2 overflow-hidden p-0.5 border border-neutral-800">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-full transition-all duration-75 shadow-lg shadow-red-500/50"
                    style={{ width: `${Math.max(4, liveBrake * 100)}%` }}
                  />
                </div>
              </div>

              {/* Steering Wheel Indicator */}
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-neutral-400 font-bold uppercase block">Steering (A / D)</span>
                  <span className="font-mono text-cyan-400 text-xs font-bold">
                    {liveSteer < -0.1 ? `LEFT ${(Math.abs(liveSteer) * 100).toFixed(0)}%` : liveSteer > 0.1 ? `RIGHT ${(liveSteer * 100).toFixed(0)}%` : 'CENTERED (0°)'}
                  </span>
                </div>
                <div
                  className="w-10 h-10 rounded-full border-2 border-cyan-400 flex items-center justify-center transition-transform duration-75"
                  style={{ transform: `rotate(${liveSteer * 38}deg)` }}
                >
                  <div className="w-1.5 h-4 bg-cyan-400 rounded-full mb-1" />
                </div>
              </div>
            </div>

            {/* Tactical Deployment Status */}
            <div className="flex items-center gap-3 pt-2 border-t border-neutral-900">
              <div className={`flex-1 p-2 rounded-lg border text-center transition-colors ${liveDrs ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-black shadow-md shadow-amber-500/30' : 'bg-neutral-900/60 border-neutral-800 text-neutral-500'}`}>
                <span className="text-xs uppercase font-bold">DRS FLAP: {liveDrs ? 'OPEN (Space / Y)' : 'CLOSED (Press Space)'}</span>
              </div>
              <div className={`flex-1 p-2 rounded-lg border text-center transition-colors ${liveErs ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-black shadow-md shadow-cyan-500/30' : 'bg-neutral-900/60 border-neutral-800 text-neutral-500'}`}>
                <span className="text-xs uppercase font-bold">ERS OVERTAKE: {liveErs ? 'DEPLOYING (E / B)' : 'CHARGING (Press E)'}</span>
              </div>
            </div>
          </div>

          {/* Quick Mapping Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col">
              <span className="text-neutral-400 text-[10px] uppercase font-bold">Accelerate</span>
              <span className="text-white font-mono font-bold mt-1">W / Up / RT</span>
            </div>
            <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col">
              <span className="text-neutral-400 text-[10px] uppercase font-bold">Brake / Reverse</span>
              <span className="text-white font-mono font-bold mt-1">S / Down / LT</span>
            </div>
            <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col">
              <span className="text-neutral-400 text-[10px] uppercase font-bold">Steer Left / Right</span>
              <span className="text-white font-mono font-bold mt-1">A & D / Left Stick</span>
            </div>
            <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col">
              <span className="text-neutral-400 text-[10px] uppercase font-bold">Cycle Cameras</span>
              <span className="text-white font-mono font-bold mt-1">C Key (4 Views)</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'advanced_racing',
      title: 'Advanced Racing Dynamics & Corner Geometry',
      subtitle: 'Master the racing line, trail braking, apex clipping, and tire thermal management.',
      icon: Flame,
      badge: 'Step 2 of 4: Driving Mastery',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Trail Braking Technique */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-400">
                <Navigation className="w-4 h-4" />
                <span>1. Trail Braking & Corner Entry</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Do not brake while turning sharply at full speed. Brake hard in a <strong>straight line at the 100m/50m marker boards</strong>, then gradually bleed off pedal pressure as you turn the wheel toward the apex. This transfers weight onto front tires and prevents front-end lockup.
              </p>
              <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                PRO TIP: Smooth release of brake into the apex rotates the chassis faster than sharp steering.
              </div>
            </div>

            {/* Late Apex & Exit Acceleration */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-400">
                <Timer className="w-4 h-4" />
                <span>2. Late Apex for Long Straight Exits</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Take a slightly wider entry to clip the apex late. This allows you to straighten the steering wheel earlier and apply <strong>100% full throttle earlier</strong>. In Formula 1, exit speed down the following straight determines overtaking advantage!
              </p>
              <div className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                PRO TIP: Early full throttle beats late braking by up to 0.4s down long DRS straights.
              </div>
            </div>

            {/* Tire Degradation Windows */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-rose-400">
                <Flame className="w-4 h-4" />
                <span>3. Tire Degradation Windows & compounds</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                <span className="text-red-400 font-bold">Softs</span> offer peak grip for 2-3 laps (ideal for Qualifying). <span className="text-amber-400 font-bold">Mediums</span> provide optimal race pace balance. <span className="text-blue-400 font-bold">Hards</span> provide maximum durability for long Grand Prix stints. Avoid continuous tire sliding to prevent thermal degradation spikes.
              </p>
            </div>

            {/* Collision Recovery & Anti-Stall */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                <span>4. Collision & Spin Recovery</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                If the rear slides out on corner exit kerbs, countersteer immediately in the direction of the slide and lift off throttle. If you collide with barriers, the anti-stall wait penalty engages (2.0s on Rookie, 3.5s on Pro, 5.0s on Legend). High engine reliability upgrades reduce crash recovery delays!
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'team_finances',
      title: 'Team Management & Financial Planning',
      subtitle: 'Build your legacy driving for Haas F1 or build your own independent team.',
      icon: Users,
      badge: 'Step 3 of 4: Management & PU',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Founding Your 11th Team</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Start your rookie career under the wings of Haas F1 Team, earn cash through podiums, and buy your own FIA Constructor franchise. Customize team liveries, rename your squad mid-season, and sign official engine supply deals with Ferrari, Mercedes, Honda, or RBPT.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Prize Money & Dyno Upgrades</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Grand Prix wins award up to $3.5M. Invest your earnings into Chief Aerodynamicists, Chassis Engineers, and in-house engine Dyno development. When power reaches hyper-spec (100+), push engine reliability up to 99% to shrug off barrier rubs without stalling.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'qualifying_multiplayer',
      title: 'Qualifying Shootout & Multiplayer Rooms',
      subtitle: 'Set flying lap pole positions and race live with friends via 4-digit room codes.',
      icon: Trophy,
      badge: 'Step 4 of 4: Weekend Flow',
      badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Qualifying Session */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-purple-400">
                <Timer className="w-4 h-4" />
                <span>1-Lap Qualifying Shootout</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Before launching the Grand Prix, take the optional <strong>Qualifying Shootout</strong>. You get 1 flying lap on fresh soft compound tires to set your fastest lap time against the grid. Qualifying P1 awards Pole Position, letting you lead into Turn 1!
              </p>
            </div>

            {/* Multiplayer Rooms */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-rose-400">
                <Users className="w-4 h-4" />
                <span>4-Digit Multiplayer Rooms</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Host a lobby or join friends with a 4-digit code without quitting your career. Adjust bot counts from 0 to 19. Rivals feature hovering 3D beacons and dead-reckoning lag reduction. Rooms automatically disband if idle for 30 minutes.
              </p>
            </div>
          </div>

          {/* Cloud Save & Cross Device */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-white font-bold">Cross-Device Cloud Save:</span>
              <span className="text-neutral-300">Sign in with Google on any device to restore your exact team, standings, and upgrades!</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[currentStep];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center">
              <Icon className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${current.badgeColor}`}>
                  {current.badge}
                </span>
                <span className="text-[11px] text-neutral-500 font-mono">
                  {currentStep + 1} of {steps.length}
                </span>
              </div>
              <h3 className="text-lg font-black text-white tracking-wide mt-0.5">{current.title}</h3>
            </div>
          </div>
          <button
            onClick={handleFinish}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Skip and Close Tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab / Step Bar */}
        <div className="grid grid-cols-4 border-b border-neutral-800 bg-neutral-950/40">
          {steps.map((st, idx) => {
            const isActive = currentStep === idx;
            const isCompleted = currentStep > idx;
            const StepIcon = st.icon;

            return (
              <button
                key={st.id}
                onClick={() => setCurrentStep(idx)}
                className={`py-3 px-3 flex items-center justify-center gap-1.5 border-b-2 font-bold text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'border-red-500 text-white bg-neutral-900/60'
                    : isCompleted
                    ? 'border-emerald-500/40 text-emerald-400'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <StepIcon className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {idx === 0 ? 'Live Rig' : idx === 1 ? 'Driving' : idx === 2 ? 'Team' : 'Weekend'}
                </span>
                <span className="sm:hidden">{idx + 1}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-xs text-neutral-400 mb-4">{current.subtitle}</p>
          {current.content}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/70 flex items-center justify-between gap-4">
          <button
            onClick={handleFinish}
            className="text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Skip Tutorial</span>
          </button>

          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
            )}

            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-900/40 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/40 flex items-center gap-2 transition-all cursor-pointer animate-pulse hover:animate-none"
              >
                <Flag className="w-4 h-4" />
                <span>Enter Paddock & Race</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
