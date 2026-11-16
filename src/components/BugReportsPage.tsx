import React, { useState, useEffect } from 'react';
import {
  BugReportEntry,
  submitGlobalBugReport,
  loadGlobalBugReportsWithPin,
  subscribeGlobalBugReportsWithPin,
  saveGlobalBugReportsWithPin,
  getPersistentClientUid,
} from '../services/firebase';
import {
  Bug,
  Lightbulb,
  Lock,
  Unlock,
  Send,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Trash2,
  X,
  Filter,
  Check,
  Wrench,
  Eye,
  EyeOff,
} from 'lucide-react';

const REQUIRED_PIN = '20127164354287';
const MAX_PIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minute (60 seconds)
const PIN_LOCK_STORAGE_KEY = 'apex_devnotes_pin_state_v1';

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

const BUG_CATEGORIES = [
  'Gameplay & Physics',
  'Controls & Gearbox',
  'Career & Contracts',
  'My Team & Ownership',
  'UI & Graphics',
  'Audio & Engineer Radio',
  'Multiplayer',
  'Other',
];

const IMPROVEMENT_CATEGORIES = [
  'New Game Feature',
  'Driving Physics & Handling',
  'Career & My Team Depth',
  'Tracks & Circuits',
  'UI & Quality of Life',
  'Audio & Race Engineer',
  'Multiplayer & Modes',
  'Other Idea',
];

interface BugReportsPageProps {
  defaultReporterName?: string;
}

export const BugReportsPage: React.FC<BugReportsPageProps> = ({
  defaultReporterName = 'Driver',
}) => {
  // Public Submission Form State (Supports both Bug Reports and Improvement Recommendations)
  const [submissionType, setSubmissionType] = useState<'bug' | 'improvement'>('bug');
  const [reporterName, setReporterName] = useState<string>(defaultReporterName);
  const [category, setCategory] = useState<string>('Gameplay & Physics');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // PIN Lock & Verification State for viewing reported bugs & improvement ideas
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(() => loadPinLockState().failedAttempts);
  const [lockoutUntil, setLockoutUntil] = useState<number>(() => loadPinLockState().lockoutUntil);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Unlocked Developer Vault State (Only accessible after entering PIN 20127164354287)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [verifiedPin, setVerifiedPin] = useState<string>('');
  const [reports, setReports] = useState<BugReportEntry[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState<boolean>(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'bug' | 'improvement'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'investigating' | 'fixed'>('all');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [adminBanner, setAdminBanner] = useState<string | null>(null);

  // Tick every 250ms so the 1-minute lockout countdown updates smoothly and clears automatically
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

  // Subscribe to live bug reports and improvements ONLY when unlocked with valid PIN
  useEffect(() => {
    if (!isUnlocked || verifiedPin !== REQUIRED_PIN) return;

    let mounted = true;
    setIsLoadingReports(true);
    loadGlobalBugReportsWithPin(verifiedPin).then((res) => {
      if (!mounted) return;
      setIsLoadingReports(false);
      if (res.success) {
        setReports(res.reports);
      }
    });

    const unsub = subscribeGlobalBugReportsWithPin(verifiedPin, (liveReports) => {
      if (mounted) {
        setReports(liveReports);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [isUnlocked, verifiedPin]);

  const handleSelectSubmissionType = (nextType: 'bug' | 'improvement') => {
    setSubmissionType(nextType);
    setSubmitError(null);
    setSubmitSuccess(null);
    if (nextType === 'improvement') {
      if (!IMPROVEMENT_CATEGORIES.includes(category)) {
        setCategory(IMPROVEMENT_CATEGORIES[0]);
      }
    } else {
      if (!BUG_CATEGORIES.includes(category)) {
        setCategory(BUG_CATEGORIES[0]);
      }
    }
  };

  const isLockedOut = lockoutUntil > nowMs;
  const remainingLockoutSeconds = isLockedOut
    ? Math.max(1, Math.ceil((lockoutUntil - nowMs) / 1000))
    : 0;
  const attemptsRemaining = isLockedOut
    ? 0
    : Math.max(0, MAX_PIN_ATTEMPTS - failedAttempts);

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!title.trim() || !description.trim()) {
      setSubmitError(
        submissionType === 'improvement'
          ? 'Please enter both a title for your improvement idea and a description of how it would work.'
          : 'Please enter both a bug title and a description of what happened.'
      );
      return;
    }

    setIsSubmitting(true);
    const res = await submitGlobalBugReport({
      type: submissionType,
      title: title.trim(),
      description: description.trim(),
      category,
      severity,
      reporterName: reporterName.trim() || 'Anonymous Driver',
    });
    setIsSubmitting(false);

    if (!res.success) {
      setSubmitError(
        res.error ||
          (submissionType === 'improvement'
            ? 'Could not submit improvement recommendation. Please try again.'
            : 'Could not submit bug report. Please try again.')
      );
      return;
    }

    setTitle('');
    setDescription('');
    setSubmitSuccess(
      submissionType === 'improvement'
        ? 'Improvement recommendation submitted! Only the developer with the PIN can view submitted reports and recommendations.'
        : 'Bug report submitted! Only the developer with the PIN can view submitted reports and recommendations.'
    );
    window.setTimeout(() => setSubmitSuccess(null), 6000);

    // If developer is currently unlocked, refresh the list immediately
    if (isUnlocked && verifiedPin === REQUIRED_PIN) {
      const updated = await loadGlobalBugReportsWithPin(verifiedPin);
      if (updated.success) {
        setReports(updated.reports);
      }
    }
  };

  const handleOpenPinModal = () => {
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

    const stored = loadPinLockState();
    if (stored.lockoutUntil > currentNow) {
      setFailedAttempts(stored.failedAttempts);
      setLockoutUntil(stored.lockoutUntil);
      const secs = Math.ceil((stored.lockoutUntil - currentNow) / 1000);
      setPinError(`PIN is locked. Wait ${secs}s before trying again.`);
      return;
    }

    let currentFailed = stored.lockoutUntil > 0 && stored.lockoutUntil <= currentNow ? 0 : stored.failedAttempts;
    const trimmed = pinInput.trim();

    // Also sync attempt state with backend server
    try {
      await fetch('/api/developer-notes/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: getPersistentClientUid(),
          pin: trimmed,
        }),
      });
    } catch {}

    if (trimmed === REQUIRED_PIN) {
      const resetState = { failedAttempts: 0, lockoutUntil: 0 };
      savePinLockState(resetState);
      setFailedAttempts(0);
      setLockoutUntil(0);
      setPinError(null);
      setVerifiedPin(trimmed);
      setIsUnlocked(true);
      setShowPinModal(false);
      setPinInput('');
      return;
    }

    const nextFailed = currentFailed + 1;
    if (nextFailed >= MAX_PIN_ATTEMPTS) {
      const lockUntil = currentNow + LOCKOUT_DURATION_MS;
      const lockedState = { failedAttempts: MAX_PIN_ATTEMPTS, lockoutUntil: lockUntil };
      savePinLockState(lockedState);
      setFailedAttempts(MAX_PIN_ATTEMPTS);
      setLockoutUntil(lockUntil);
      setPinInput('');
      setPinError('3 incorrect attempts used! PIN entry is disabled for 1 minute (60 seconds).');
    } else {
      const nextState = { failedAttempts: nextFailed, lockoutUntil: 0 };
      savePinLockState(nextState);
      setFailedAttempts(nextFailed);
      setLockoutUntil(0);
      setPinInput('');
      const left = MAX_PIN_ATTEMPTS - nextFailed;
      setPinError(`Incorrect PIN. You have ${left} ${left === 1 ? 'attempt' : 'attempts'} left before a 1-minute lockout.`);
    }
  };

  const handleUpdateBugStatus = async (
    bugId: string,
    newStatus: 'open' | 'investigating' | 'fixed'
  ) => {
    if (!isUnlocked || verifiedPin !== REQUIRED_PIN) return;
    const nextReports = reports.map((b) =>
      b.id === bugId ? { ...b, status: newStatus, updatedAt: Date.now() } : b
    );
    setReports(nextReports);
    await saveGlobalBugReportsWithPin(nextReports, verifiedPin);
    setAdminBanner(`Updated entry status to ${newStatus.toUpperCase()}.`);
    window.setTimeout(() => setAdminBanner(null), 3000);
  };

  const handleSaveDeveloperNote = async (bugId: string) => {
    if (!isUnlocked || verifiedPin !== REQUIRED_PIN) return;
    const noteText = (noteDrafts[bugId] ?? '').trim();
    const nextReports = reports.map((b) =>
      b.id === bugId ? { ...b, developerNote: noteText, updatedAt: Date.now() } : b
    );
    setReports(nextReports);
    await saveGlobalBugReportsWithPin(nextReports, verifiedPin);
    setAdminBanner('Saved developer note.');
    window.setTimeout(() => setAdminBanner(null), 3000);
  };

  const handleDeleteBugReport = async (bugId: string) => {
    if (!isUnlocked || verifiedPin !== REQUIRED_PIN) return;
    const nextReports = reports.filter((b) => b.id !== bugId);
    setReports(nextReports);
    await saveGlobalBugReportsWithPin(nextReports, verifiedPin);
    setAdminBanner('Removed entry.');
    window.setTimeout(() => setAdminBanner(null), 3000);
  };

  const bugTotalCount = reports.filter((r) => (r.type || 'bug') === 'bug').length;
  const improvementTotalCount = reports.filter((r) => r.type === 'improvement').length;

  const typeFilteredReports = reports.filter((r) => {
    const entryType = r.type === 'improvement' ? 'improvement' : 'bug';
    return typeFilter === 'all' ? true : entryType === typeFilter;
  });

  const filteredReports = typeFilteredReports.filter((r) =>
    statusFilter === 'all' ? true : r.status === statusFilter
  );

  const openCount = typeFilteredReports.filter((r) => r.status === 'open').length;
  const investigatingCount = typeFilteredReports.filter((r) => r.status === 'investigating').length;
  const fixedCount = typeFilteredReports.filter((r) => r.status === 'fixed').length;

  const activeCategories = submissionType === 'improvement' ? IMPROVEMENT_CATEGORIES : BUG_CATEGORIES;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/30 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/50">
              {submissionType === 'improvement' ? (
                <Lightbulb className="w-6 h-6 text-cyan-400" />
              ) : (
                <Bug className="w-6 h-6 text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-widest">
                  BUG REPORTER & IMPROVEMENT IDEAS
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300 text-[10px] font-bold uppercase tracking-wider">
                  PUBLIC SUBMISSION · PIN-PROTECTED INBOX
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-1">
                Report Bugs & Recommend Improvements
              </h2>
            </div>
          </div>

          {/* Button to Unlock or Lock Reported Bugs & Improvements */}
          <div>
            {!isUnlocked ? (
              <button
                type="button"
                onClick={handleOpenPinModal}
                className="px-4 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-amber-500/40 text-amber-300 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>View Bugs & Ideas (PIN Required)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsUnlocked(false);
                  setVerifiedPin('');
                  setReports([]);
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
              >
                <EyeOff className="w-4 h-4" />
                <span>Lock Developer Vault</span>
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-sm text-zinc-300 leading-relaxed max-w-3xl">
          Found a glitch or have an awesome idea to make the game even better? Choose whether you want to{' '}
          <strong className="text-amber-300">Report a Bug</strong> or{' '}
          <strong className="text-cyan-300">Recommend an Improvement</strong> below! Anyone can submit, while viewing the submitted entries requires the Developer PIN.
        </p>
      </div>

      {/* SECTION 1: PUBLIC BUG REPORT & IMPROVEMENT SUBMISSION FORM */}
      <form
        onSubmit={handleSubmitEntry}
        className="bg-neutral-900/90 border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col gap-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            {submissionType === 'improvement' ? (
              <Lightbulb className="w-4 h-4 text-cyan-400" />
            ) : (
              <Bug className="w-4 h-4 text-amber-400" />
            )}
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              {submissionType === 'improvement'
                ? 'Recommend a Game Improvement'
                : 'Submit New Bug Report'}
            </h3>
          </div>

          {/* Toggle between Bug Report and Recommend Improvement */}
          <div className="flex items-center gap-2 bg-neutral-950 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => handleSelectSubmissionType('bug')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                submissionType === 'bug'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Bug className="w-3.5 h-3.5" />
              <span>Report a Bug</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectSubmissionType('improvement')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                submissionType === 'improvement'
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Recommend Improvement</span>
            </button>
          </div>
        </div>

        {submitSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{submitSuccess}</span>
          </div>
        )}

        {submitError && (
          <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
              Your Driver Name (Optional)
            </label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              maxLength={80}
              placeholder="e.g., Anonymous Driver"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
              {submissionType === 'improvement' ? 'Improvement Area' : 'Bug Category'}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-amber-500"
            >
              {activeCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
              {submissionType === 'improvement' ? 'Impact / Priority Level' : 'Severity Level'}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['low', 'medium', 'high', 'critical'] as const).map((lvl) => {
                const active = severity === lvl;
                const displayLabel =
                  submissionType === 'improvement' && lvl === 'critical'
                    ? 'must-have'
                    : lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSeverity(lvl)}
                    className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                      active
                        ? lvl === 'critical'
                          ? submissionType === 'improvement'
                            ? 'bg-cyan-400 text-black border-cyan-200'
                            : 'bg-red-600 text-white border-red-400'
                          : lvl === 'high'
                          ? 'bg-orange-500 text-black border-orange-300'
                          : lvl === 'medium'
                          ? 'bg-amber-500 text-black border-amber-300'
                          : 'bg-cyan-500 text-black border-cyan-300'
                        : 'bg-neutral-950 text-zinc-400 border-white/10 hover:text-white'
                    }`}
                  >
                    {displayLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
            {submissionType === 'improvement'
              ? 'Improvement Idea Title *'
              : 'Bug Summary / Title *'}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            required
            placeholder={
              submissionType === 'improvement'
                ? 'Short summary of your idea (e.g., Add wet weather tire spray and dynamic rain radar)'
                : 'Short summary of the bug (e.g., Car stalls when shifting down into Turn 1)'
            }
            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm font-bold focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
            {submissionType === 'improvement'
              ? 'How Should This Improvement Work? *'
              : 'What Happened / Steps to Reproduce *'}
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2500}
            required
            placeholder={
              submissionType === 'improvement'
                ? 'Describe your feature request or improvement in detail and how it would make the game better...'
                : 'Describe exactly what happened, which mode/track you were on, and how to reproduce the issue...'
            }
            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-zinc-200 text-sm leading-relaxed focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50 ${
              submissionType === 'improvement'
                ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-950/50'
                : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-950/50'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Submitting...'
                : submissionType === 'improvement'
                ? 'Submit Improvement Idea'
                : 'Submit Bug Report'}
            </span>
          </button>
        </div>
      </form>

      {/* SECTION 2: REPORTED BUGS & IMPROVEMENTS VAULT (REQUIRES DEVELOPER PIN TO VIEW) */}
      {!isUnlocked ? (
        <div className="bg-neutral-900/95 border border-white/10 rounded-2xl p-8 text-center flex flex-col items-center gap-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <span className="px-2.5 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-[10px] font-black uppercase tracking-widest">
              DEVELOPER ACCESS ONLY
            </span>
            <h3 className="text-xl font-black text-white mt-2">
              Reported Bugs & Recommended Improvements Are Protected by PIN
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 leading-relaxed">
              In order to see the bugs reported and improvements recommended by players, you must type in the developer PIN. You have 3 attempts before PIN entry locks for 1 minute.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenPinModal}
            className="mt-1 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-950/50 transition-all cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Enter PIN to View Bugs & Improvements</span>
          </button>
        </div>
      ) : (
        <div className="bg-neutral-900/95 border-2 border-emerald-500/30 rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    PIN VERIFIED · DEVELOPER FEEDBACK VAULT
                  </span>
                </div>
                <h3 className="text-lg font-black text-white">
                  Submitted Bugs & Improvement Ideas ({reports.length})
                </h3>
              </div>
            </div>

            {/* Type Filter Pills (All / Bugs / Improvements) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `All (${reports.length})` },
                  { id: 'bug', label: `Bugs (${bugTotalCount})` },
                  { id: 'improvement', label: `Improvements (${improvementTotalCount})` },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    typeFilter === t.id
                      ? t.id === 'improvement'
                        ? 'bg-cyan-500 text-black font-black'
                        : t.id === 'bug'
                        ? 'bg-amber-500 text-black font-black'
                        : 'bg-white text-black font-black'
                      : 'bg-neutral-950 text-zinc-400 hover:text-white border border-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-zinc-400 mr-1" />
              {(
                [
                  { id: 'all', label: `All Statuses (${typeFilteredReports.length})` },
                  { id: 'open', label: `Open (${openCount})` },
                  { id: 'investigating', label: `Reviewing / Investigating (${investigatingCount})` },
                  { id: 'fixed', label: `Fixed / Added (${fixedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-emerald-500 text-black font-black'
                      : 'bg-neutral-950 text-zinc-400 hover:text-white border border-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {adminBanner && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{adminBanner}</span>
            </div>
          )}

          {isLoadingReports ? (
            <div className="p-8 text-center text-zinc-400 text-sm font-semibold">
              Loading reported bugs and improvement ideas...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-10 rounded-xl bg-neutral-950 border border-white/5 text-center flex flex-col items-center gap-2">
              {typeFilter === 'improvement' ? (
                <Lightbulb className="w-8 h-8 text-zinc-600" />
              ) : (
                <Bug className="w-8 h-8 text-zinc-600" />
              )}
              <p className="text-sm font-bold text-white">No Entries Found</p>
              <p className="text-xs text-zinc-500">
                {reports.length === 0
                  ? 'No bug reports or improvement recommendations have been submitted yet. Try submitting one using the form above!'
                  : 'No entries match the selected filter.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredReports.map((bug) => {
                const isImprovement = bug.type === 'improvement';
                const severityBadge =
                  bug.severity === 'critical'
                    ? isImprovement
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                    : bug.severity === 'high'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : bug.severity === 'medium'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';

                const statusBadge =
                  bug.status === 'fixed'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : bug.status === 'investigating'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40';

                const currentDraftNote =
                  noteDrafts[bug.id] !== undefined
                    ? noteDrafts[bug.id]
                    : bug.developerNote || '';

                return (
                  <div
                    key={bug.id}
                    className={`bg-neutral-950 border rounded-xl p-5 flex flex-col gap-3 ${
                      isImprovement ? 'border-cyan-500/25' : 'border-white/10'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                            isImprovement
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {isImprovement ? (
                            <>
                              <Lightbulb className="w-3 h-3" />
                              <span>IMPROVEMENT IDEA</span>
                            </>
                          ) : (
                            <>
                              <Bug className="w-3 h-3" />
                              <span>BUG REPORT</span>
                            </>
                          )}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${statusBadge}`}
                        >
                          {isImprovement && bug.status === 'fixed'
                            ? 'ADDED'
                            : isImprovement && bug.status === 'investigating'
                            ? 'REVIEWING'
                            : bug.status.toUpperCase()}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${severityBadge}`}
                        >
                          {isImprovement
                            ? `${bug.severity === 'critical' ? 'MUST-HAVE' : bug.severity.toUpperCase()} PRIORITY`
                            : `${bug.severity.toUpperCase()} SEVERITY`}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300 text-[10px] font-bold uppercase tracking-wider">
                          {bug.category}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-semibold">
                          By <strong className="text-white">{bug.reporterName}</strong> ·{' '}
                          {new Date(bug.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {(['open', 'investigating', 'fixed'] as const).map((st) => {
                          const btnLabel =
                            isImprovement && st === 'fixed'
                              ? 'added'
                              : isImprovement && st === 'investigating'
                              ? 'reviewing'
                              : st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleUpdateBugStatus(bug.id, st)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                bug.status === st
                                  ? 'bg-white text-black border-white'
                                  : 'bg-neutral-900 text-zinc-400 border-white/10 hover:text-white'
                              }`}
                            >
                              {btnLabel}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => handleDeleteBugReport(bug.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 cursor-pointer ml-1"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-base font-black text-white">{bug.title}</h4>
                    <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed bg-neutral-900/70 p-3.5 rounded-xl border border-white/5">
                      {bug.description}
                    </p>

                    {/* Developer Response / Internal Note */}
                    <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 shrink-0">
                        <Wrench className="w-3.5 h-3.5 text-amber-400" />
                        <span>Dev Note:</span>
                      </div>
                      <input
                        type="text"
                        value={currentDraftNote}
                        onChange={(e) =>
                          setNoteDrafts((prev) => ({ ...prev, [bug.id]: e.target.value }))
                        }
                        placeholder="Add a developer resolution note or roadmap comment..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveDeveloperNote(bug.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-black uppercase tracking-wider cursor-pointer shrink-0"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PIN VERIFICATION MODAL (3 attempts -> 1 minute lockout) */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/15 max-w-md w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                    isLockedOut
                      ? 'bg-red-500/20 border-red-500/40 text-red-400'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  }`}
                >
                  {isLockedOut ? <ShieldAlert className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                    SECURITY CHECK
                  </span>
                  <h3 className="text-lg font-black text-white">
                    Unlock Bugs & Improvements
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isLockedOut ? (
              <div className="p-5 rounded-xl bg-red-950/60 border border-red-500/40 text-center flex flex-col items-center gap-3">
                <Clock className="w-8 h-8 text-red-400 animate-pulse" />
                <div className="text-sm font-black text-red-200 uppercase tracking-wider">
                  PIN Disabled — 3 Failed Attempts
                </div>
                <p className="text-xs text-red-300/90 leading-relaxed">
                  You used all 3 PIN attempts. Please wait until the 1-minute cooldown finishes before typing the PIN again.
                </p>
                <div className="px-4 py-2 rounded-xl bg-black/60 border border-red-500/40 text-2xl font-mono font-black text-red-400 tracking-widest">
                  0:{String(remainingLockoutSeconds).padStart(2, '0')}
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyPin} className="flex flex-col gap-4">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Enter the developer PIN to view and manage reported bugs and recommended improvements. You have{' '}
                  <span className="text-amber-400 font-black">
                    {attemptsRemaining} {attemptsRemaining === 1 ? 'attempt' : 'attempts'}
                  </span>{' '}
                  remaining before a 1-minute lockout.
                </p>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Developer PIN
                  </label>
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Enter PIN..."
                    autoFocus
                    disabled={isLockedOut}
                    className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-white/15 text-white font-mono text-base tracking-widest focus:outline-none focus:border-amber-500"
                  />
                </div>

                {pinError && (
                  <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-zinc-300 font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLockedOut || !pinInput.trim()}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider cursor-pointer disabled:opacity-40"
                  >
                    Unlock Vault
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
