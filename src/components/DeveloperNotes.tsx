import React, { useState, useEffect, useRef } from 'react';
import {
  DeveloperNotesDocument,
  DeveloperNoteSection,
  loadGlobalDeveloperNotes,
  saveGlobalDeveloperNotes,
  subscribeGlobalDeveloperNotes,
  getPersistentClientUid,
} from '../services/firebase';
import {
  FileCode2,
  Lock,
  Unlock,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  RotateCcw,
  Pin,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

const REQUIRED_PIN = '20127164354287';
const MAX_PIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minute (60 seconds)
const PIN_LOCK_STORAGE_KEY = 'apex_devnotes_pin_state_v1';

export const DEFAULT_DEVELOPER_NOTES: DeveloperNotesDocument = {
  headline: 'Official Developer Notes',
  versionBadge: 'LIVE BUILD · GLOBAL RELEASE',
  leadAuthor: 'Lead Game Developer',
  announcementBanner:
    'Welcome to the official Developer Notes page! Every player in the game can read this message from the developer. Scroll to the bottom of the page to access the Developer Edit button.',
  mainNoteTag: 'OFFICIAL DEVELOPER NOTE',
  mainNoteTitle: 'WELCOME TO APEX FORMULA — MESSAGE FROM THE DEVELOPER',
  mainNoteBody:
    'Thank you for playing! This is the official Developer Note in big letters for everyone who plays the game.\n\nWe are constantly expanding the career mode, physics simulation, custom F1 constructor management, and live pit-wall telemetry experience. Check out the dedicated Game Updates & Patch Notes tab for the full list of feature updates and changelogs!',
  updatedAt: 1730000000000,
  sections: [
    {
      id: 'dev_note_1',
      tag: 'TRANSMISSION & CONTROLS',
      title: 'Automatic + Force-Shift (F / V) & Full Manual Gearbox Selection',
      date: 'Latest Update',
      body: 'Drivers can now force-shift up (F) or down (V) at any time even while driving in Automatic mode—the gearbox immediately executes your shift and continues automatically shifting through the gears as you accelerate or brake. Prefer 100% control? Toggle between Automatic (+ Force Shift) and Full Manual mode directly on the race HUD Gear Pod, in the Race Weekend setup bar, or inside the Custom Controls menu.',
    },
    {
      id: 'dev_note_2',
      tag: 'PIT-WALL TELEMETRY',
      title: 'Context-Aware Race Engineer Voice & Radio Chatter',
      date: 'Core Feature',
      body: 'Your Pit-Wall Race Engineer monitors live race telemetry to deliver real-time voice and text radio callouts: standing-start clutch reaction feedback, DRS overtake window alerts (< 0.95s gap ahead), defensive mirror warnings (< 0.65s behind), tire graining/blistering thresholds, overheating carcass warnings, and sector Yellow Flag incident alerts. Use the Pit-Wall Engineer bar at the bottom of the HUD to request Gap, Tire, or Track Status reports on demand.',
    },
    {
      id: 'dev_note_3',
      tag: 'TIRE & BRAKING PHYSICS',
      title: 'Velocity-Scaled Braking Wear, Cornering Loads & Pit Strategy',
      date: 'Physics Engine',
      body: 'Tire degradation is dynamically driven by how you drive the car. Driving straight on low-load straights causes minimal wear, while heavy braking from high speed and aggressive high-G cornering build thermal load and accelerate tread wear. Smoothly easing off the throttle into corners preserves tire life and extends your stint window. CPU drivers also experience realistic tire wear and pit stops.',
    },
    {
      id: 'dev_note_4',
      tag: 'RACE STARTS & REACTION RECORDS',
      title: '5-Red-Lights Standing Starts, Anti-Stall Penalty & Reaction Practice Drill',
      date: 'Competition Systems',
      body: 'Every Grand Prix begins with the official 5-red-lights sequence. Pressing the throttle before all 5 red lights extinguish triggers a False Start and stalls your engine on the grid for 3.2 seconds. Clean launches measure your millisecond reaction time and log personal records—and you can sharpen your reflexes anytime in the 5-Lights Start Reaction Practice drill.',
    },
    {
      id: 'dev_note_5',
      tag: 'CAREER & MY TEAM',
      title: 'Custom Constructor Ownership, Free Agency, Signing Bonuses & Cadillac F1',
      date: 'Career & Paddock',
      body: 'Acquire your own Formula 1 Constructor, negotiate driver retainers and unlimited signing bonuses, propose teammate pay cuts with bonus incentives, or sign CPU drivers who announce they are looking for a team. Releasing a driver places them into open free agency where any rival constructor on the grid—including Cadillac F1—can sign them.',
    },
    {
      id: 'dev_note_6',
      tag: 'PERFORMANCE OPTIMIZATION',
      title: 'Zero-GC Physics & Camera Loop Optimization (Full Visual Fidelity)',
      date: 'Engine Optimization',
      body: 'Replaced per-frame vector allocations in the 60–240Hz physics, AI collision, and camera loops with pre-allocated scratch vectors and guarded projection matrix updates—eliminating garbage-collection frame hitches while preserving 100% of the 3D car, lighting, spark, and track graphics.',
    },
  ],
};

function normalizeDeveloperNotes(doc: DeveloperNotesDocument): DeveloperNotesDocument {
  return {
    ...DEFAULT_DEVELOPER_NOTES,
    ...doc,
    mainNoteTag: doc.mainNoteTag || DEFAULT_DEVELOPER_NOTES.mainNoteTag,
    mainNoteTitle: doc.mainNoteTitle || DEFAULT_DEVELOPER_NOTES.mainNoteTitle,
    mainNoteBody: doc.mainNoteBody || DEFAULT_DEVELOPER_NOTES.mainNoteBody,
    sections:
      Array.isArray(doc.sections) && doc.sections.length > 0
        ? doc.sections
        : DEFAULT_DEVELOPER_NOTES.sections,
  };
}

interface PinLockState {
  failedAttempts: number;
  lockoutUntil: number;
}

function loadPinLockState(): PinLockState {
  try {
    const raw = localStorage.getItem(PIN_LOCK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        failedAttempts: Number(parsed.failedAttempts || 0),
        lockoutUntil: Number(parsed.lockoutUntil || 0),
      };
    }
  } catch {}
  return { failedAttempts: 0, lockoutUntil: 0 };
}

function savePinLockState(state: PinLockState) {
  try {
    localStorage.setItem(PIN_LOCK_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

interface DeveloperNotesProps {
  mode?: 'devnotes' | 'patchnotes';
  onNavigateTab?: (tab: 'devnotes' | 'patchnotes') => void;
}

export const DeveloperNotes: React.FC<DeveloperNotesProps> = ({
  mode = 'devnotes',
  onNavigateTab,
}) => {
  const isPatchNotesPage = mode === 'patchnotes';
  const [notesDoc, setNotesDoc] = useState<DeveloperNotesDocument>(DEFAULT_DEVELOPER_NOTES);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  // PIN Modal & Lockout State
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(() => loadPinLockState().failedAttempts);
  const [lockoutUntil, setLockoutUntil] = useState<number>(() => loadPinLockState().lockoutUntil);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Editor State (Unlocked only after valid PIN 20127164354287)
  const [isEditUnlocked, setIsEditUnlocked] = useState<boolean>(false);
  const [verifiedPin, setVerifiedPin] = useState<string>('');
  const [draftDoc, setDraftDoc] = useState<DeveloperNotesDocument>(DEFAULT_DEVELOPER_NOTES);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Load initial Developer Notes & subscribe to live updates for all players
  useEffect(() => {
    let mounted = true;
    loadGlobalDeveloperNotes().then((loaded) => {
      if (mounted && loaded) {
        setNotesDoc(normalizeDeveloperNotes(loaded));
      }
    });

    const unsub = subscribeGlobalDeveloperNotes((liveNotes) => {
      if (mounted && liveNotes) {
        setNotesDoc(normalizeDeveloperNotes(liveNotes));
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Tick every 250ms while locked out so the 1-minute countdown updates smoothly and unlocks automatically
  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);

      const stored = loadPinLockState();
      if (stored.lockoutUntil > 0 && currentNow >= stored.lockoutUntil) {
        const cleared = { failedAttempts: 0, lockoutUntil: 0 };
        savePinLockState(cleared);
        setFailedAttempts(0);
        setLockoutUntil(0);
        setPinError(null);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  // Observe bottom of page so scrolling all the way to the bottom reveals/activates the Edit button
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasScrolledToBottom(true);
          }
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [mode]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= 48) {
      setHasScrolledToBottom(true);
    }
  };

  const isLockedOut = lockoutUntil > nowMs;
  const remainingLockoutSeconds = isLockedOut
    ? Math.max(1, Math.ceil((lockoutUntil - nowMs) / 1000))
    : 0;
  const attemptsRemaining = isLockedOut
    ? 0
    : Math.max(0, MAX_PIN_ATTEMPTS - failedAttempts);

  const handleOpenPinPrompt = () => {
    const currentNow = Date.now();
    setNowMs(currentNow);
    const stored = loadPinLockState();
    if (stored.lockoutUntil > 0 && currentNow >= stored.lockoutUntil) {
      const cleared = { failedAttempts: 0, lockoutUntil: 0 };
      savePinLockState(cleared);
      setFailedAttempts(0);
      setLockoutUntil(0);
      setPinError(null);
    } else {
      setFailedAttempts(stored.failedAttempts);
      setLockoutUntil(stored.lockoutUntil);
    }
    setPinInput('');
    setShowPinModal(true);
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentNow = Date.now();
    setNowMs(currentNow);

    if (lockoutUntil > currentNow) {
      return;
    }

    const cleanPin = pinInput.trim();
    if (!cleanPin) return;

    try {
      await fetch('/api/developer-notes/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: getPersistentClientUid(),
          pin: cleanPin,
        }),
      });
    } catch {}

    if (cleanPin === REQUIRED_PIN) {
      const cleared = { failedAttempts: 0, lockoutUntil: 0 };
      savePinLockState(cleared);
      setFailedAttempts(0);
      setLockoutUntil(0);
      setPinError(null);
      setVerifiedPin(cleanPin);
      setDraftDoc(normalizeDeveloperNotes(JSON.parse(JSON.stringify(notesDoc))));
      setIsEditUnlocked(true);
      setShowPinModal(false);
      setPinInput('');
      return;
    }

    const nextFailed = failedAttempts + 1;
    if (nextFailed >= MAX_PIN_ATTEMPTS) {
      const newLockoutUntil = currentNow + LOCKOUT_DURATION_MS;
      const lockedState = {
        failedAttempts: MAX_PIN_ATTEMPTS,
        lockoutUntil: newLockoutUntil,
      };
      savePinLockState(lockedState);
      setFailedAttempts(MAX_PIN_ATTEMPTS);
      setLockoutUntil(newLockoutUntil);
      setPinInput('');
      setPinError(
        'All 3 attempts used! PIN has stopped working for 1 minute (60 seconds). Please wait for the timer to finish.'
      );
    } else {
      const nextState = {
        failedAttempts: nextFailed,
        lockoutUntil: 0,
      };
      savePinLockState(nextState);
      setFailedAttempts(nextFailed);
      setPinInput('');
      const rem = MAX_PIN_ATTEMPTS - nextFailed;
      setPinError(
        `Incorrect PIN. You have ${rem} ${rem === 1 ? 'attempt' : 'attempts'} left before the PIN locks for 1 minute.`
      );
    }
  };

  const handleSaveEditedNotes = async () => {
    if (!isEditUnlocked || verifiedPin !== REQUIRED_PIN) return;
    setIsSaving(true);
    const updated: DeveloperNotesDocument = {
      ...draftDoc,
      updatedAt: Date.now(),
    };
    const res = await saveGlobalDeveloperNotes(updated, verifiedPin);
    setIsSaving(false);
    if (res.success) {
      setNotesDoc(updated);
      setIsEditUnlocked(false);
      setSaveBanner(
        isPatchNotesPage
          ? 'Game Updates & Patch Notes published! Everyone playing the game can now see your updates.'
          : 'Main Developer Note published! Everyone playing the game can now see your updated Developer Note.'
      );
      setTimeout(() => setSaveBanner(null), 5000);
    } else {
      setSaveBanner(res.error || 'Failed to save changes.');
    }
  };

  const handleAddSection = () => {
    const newSec: DeveloperNoteSection = {
      id: 'dev_note_' + Date.now(),
      tag: 'GAME UPDATE',
      title: 'New Patch Note Headline',
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      body: 'Write your game update or patch note details here...',
    };
    setDraftDoc((prev) => ({
      ...prev,
      sections: [newSec, ...prev.sections],
    }));
  };

  const handleUpdateSection = (
    id: string,
    field: keyof DeveloperNoteSection,
    value: string
  ) => {
    setDraftDoc((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));
  };

  const handleDeleteSection = (id: string) => {
    setDraftDoc((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== id),
    }));
  };

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="w-full max-w-5xl mx-auto space-y-6 pb-16"
    >
      {/* Top Broadcast Header */}
      <div className="p-5 md:p-6 rounded-3xl bg-zinc-900/95 border border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
            {isPatchNotesPage ? (
              <Sparkles className="w-5 h-5" />
            ) : (
              <FileCode2 className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-red-600 text-white">
                {notesDoc.versionBadge}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Visible to All Players
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-black text-white tracking-tight mt-1">
              {isPatchNotesPage
                ? 'Game Updates & Patch Notes'
                : notesDoc.headline || 'Official Developer Notes'}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() =>
                onNavigateTab(isPatchNotesPage ? 'devnotes' : 'patchnotes')
              }
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-400/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>
                {isPatchNotesPage
                  ? 'View Main Developer Note Page'
                  : 'Open Game Updates & Patch Notes Page'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
            <span>Scroll to bottom to Edit</span>
            <ChevronDown className="w-4 h-4 text-red-400 animate-bounce" />
          </div>
        </div>
      </div>

      {saveBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveBanner}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PAGE 1: MAIN DEVELOPER NOTE PAGE (mode === 'devnotes')                */}
      {/* ===================================================================== */}
      {!isPatchNotesPage && (
        <>
          <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-br from-amber-500/15 via-red-950/35 to-zinc-900 border-2 border-amber-400/50 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400 text-black text-xs font-mono font-black uppercase tracking-wider shadow">
                <Pin className="w-3.5 h-3.5 fill-black" />
                <span>{notesDoc.mainNoteTag || 'OFFICIAL DEVELOPER NOTE'}</span>
              </div>
              <span className="text-xs font-mono text-amber-300/90 font-semibold">
                By {notesDoc.leadAuthor} · Synced across all players
              </span>
            </div>

            {/* Big Headline Letters */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight uppercase">
              {notesDoc.mainNoteTitle || DEFAULT_DEVELOPER_NOTES.mainNoteTitle}
            </h2>

            {/* Big Body Letters */}
            <div className="p-6 md:p-8 rounded-2xl bg-zinc-950/85 border border-amber-400/30 shadow-inner">
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-zinc-100 leading-relaxed whitespace-pre-line">
                {notesDoc.mainNoteBody || DEFAULT_DEVELOPER_NOTES.mainNoteBody}
              </p>
            </div>

            {/* Secondary Developer Overview Card so scrolling to the bottom of Developer Notes page feels natural */}
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
                  Looking for the Changelogs & Feature Breakdowns?
                </span>
                <p className="text-xs text-zinc-300 mt-0.5">
                  All Game Updates & Patch Notes now live on their own dedicated page in the navigation bar.
                </p>
              </div>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('patchnotes')}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span>Go to Updates & Patch Notes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Developer Editor for Main Developer Note (Unlocked via PIN 20127164354287) */}
          {isEditUnlocked && (
            <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-amber-500/60 shadow-2xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <Unlock className="w-5 h-5 text-amber-400" />
                  <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-wider">
                      Edit Main Developer Note (PIN Verified)
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Edit the big Main Developer Note shown on this page for all players.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDraftDoc(JSON.parse(JSON.stringify(DEFAULT_DEVELOPER_NOTES)))
                    }
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Defaults</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditUnlocked(false)}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveEditedNotes}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Publishing...' : 'Save & Publish to All Players'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-amber-300/80 mb-1">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    value={draftDoc.mainNoteTag || ''}
                    onChange={(e) =>
                      setDraftDoc((prev) => ({ ...prev, mainNoteTag: e.target.value }))
                    }
                    className="w-full bg-zinc-950 border border-amber-400/40 rounded-xl px-3.5 py-2 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-mono uppercase text-amber-300/80 mb-1">
                    Main Developer Note Title (Displayed in Big Letters)
                  </label>
                  <input
                    type="text"
                    value={draftDoc.mainNoteTitle || ''}
                    onChange={(e) =>
                      setDraftDoc((prev) => ({ ...prev, mainNoteTitle: e.target.value }))
                    }
                    className="w-full bg-zinc-950 border border-amber-400/40 rounded-xl px-3.5 py-2 text-base text-white font-black uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-amber-300/80 mb-1">
                  Main Developer Note Message (Displayed in Big Letters)
                </label>
                <textarea
                  rows={6}
                  value={draftDoc.mainNoteBody || ''}
                  onChange={(e) =>
                    setDraftDoc((prev) => ({
                      ...prev,
                      mainNoteBody: e.target.value,
                    }))
                  }
                  className="w-full bg-zinc-950 border border-amber-400/40 rounded-xl px-4 py-3 text-lg font-bold text-white leading-relaxed focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* PAGE 2: DEDICATED GAME UPDATES & PATCH NOTES PAGE (mode === 'patchnotes') */}
      {/* ===================================================================== */}
      {isPatchNotesPage && (
        <>
          {isEditUnlocked && (
            <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-amber-500/60 shadow-2xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <Unlock className="w-5 h-5 text-amber-400" />
                  <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-wider">
                      Edit Game Updates & Patch Notes (PIN Verified)
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Add, edit, or remove patch notes and game updates.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Update Note</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditUnlocked(false)}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveEditedNotes}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Publishing...' : 'Save & Publish Updates'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {draftDoc.sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    className="p-4 rounded-2xl bg-zinc-950 border border-white/10 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-mono text-zinc-500">
                        Patch Note #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteSection(sec.id)}
                        className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">
                          Update Tag
                        </label>
                        <input
                          type="text"
                          value={sec.tag}
                          onChange={(e) =>
                            handleUpdateSection(sec.id, 'tag', e.target.value)
                          }
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-amber-400 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">
                          Update Title
                        </label>
                        <input
                          type="text"
                          value={sec.title}
                          onChange={(e) =>
                            handleUpdateSection(sec.id, 'title', e.target.value)
                          }
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">
                          Date / Build Label
                        </label>
                        <input
                          type="text"
                          value={sec.date}
                          onChange={(e) =>
                            handleUpdateSection(sec.id, 'date', e.target.value)
                          }
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">
                        Update Details
                      </label>
                      <textarea
                        rows={3}
                        value={sec.body}
                        onChange={(e) =>
                          handleUpdateSection(sec.id, 'body', e.target.value)
                        }
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200 leading-relaxed"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {notesDoc.sections.map((sec, index) => (
              <div
                key={sec.id}
                className="p-6 rounded-2xl bg-zinc-900/90 border border-white/10 hover:border-white/20 transition-colors space-y-2.5 shadow-lg"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/30 font-bold">
                      {sec.tag}
                    </span>
                    <span className="text-zinc-500">Patch Note #{index + 1}</span>
                  </div>
                  <span className="text-zinc-400">{sec.date}</span>
                </div>

                <h3 className="text-lg font-black text-white leading-snug">
                  {sec.title}
                </h3>

                <p className="text-xs md:text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                  {sec.body}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Bottom Sentinel — Reached when scrolling to the very bottom of the page */}
      <div
        ref={bottomSentinelRef}
        className="pt-8 border-t border-white/10 flex flex-col items-center justify-center gap-3 text-center"
      >
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
          {isPatchNotesPage
            ? 'End of Game Updates & Patch Notes · Developer Administration'
            : 'End of Developer Notes · Developer Administration'}
        </p>

        <button
          type="button"
          onClick={handleOpenPinPrompt}
          className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
            hasScrolledToBottom
              ? 'bg-zinc-900 hover:bg-red-600 text-white border-red-500/50 shadow-lg'
              : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/15'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>
      </div>

      {/* PIN Verification Modal (3 Attempts -> 1 Minute Lockout) */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/15 max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                    isLockedOut
                      ? 'bg-red-500/20 border-red-500/40 text-red-400'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  }`}
                >
                  {isLockedOut ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Developer PIN Required
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Enter the developer PIN to unlock editing
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Attempts & Lockout Status Bar */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">Attempts Remaining:</span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((dot) => (
                  <span
                    key={dot}
                    className={`w-2.5 h-2.5 rounded-full ${
                      dot <= attemptsRemaining
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                        : 'bg-red-500/40'
                    }`}
                  />
                ))}
                <span
                  className={`ml-1 font-black ${
                    attemptsRemaining > 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {attemptsRemaining} / {MAX_PIN_ATTEMPTS}
                </span>
              </div>
            </div>

            {isLockedOut ? (
              <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-red-400 font-black text-sm uppercase">
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>PIN Locked — Wait 1 Minute</span>
                </div>
                <p className="text-xs text-red-200 leading-relaxed">
                  You used all 3 PIN attempts. The PIN has stopped working and will unlock in:
                </p>
                <div className="text-2xl font-black font-mono text-white tabular-nums py-1">
                  0:{remainingLockoutSeconds.toString().padStart(2, '0')}{' '}
                  <span className="text-xs font-normal text-red-300">
                    ({remainingLockoutSeconds}s)
                  </span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyPin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1.5">
                    Enter Developer PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoFocus
                    disabled={isLockedOut}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Enter PIN..."
                    className="w-full bg-zinc-950 border border-white/15 focus:border-amber-400 rounded-xl px-4 py-3 text-base font-mono text-white tracking-widest placeholder-zinc-600 focus:outline-none disabled:opacity-40"
                  />
                </div>

                {pinError && (
                  <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{pinError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLockedOut || !pinInput.trim()}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                    Unlock Edit
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
