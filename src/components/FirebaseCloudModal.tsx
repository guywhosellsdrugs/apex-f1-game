import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CheckCircle,
  AlertCircle,
  Upload,
  Download,
  LogIn,
  LogOut,
  User,
  Globe,
  Activity,
  Terminal,
  ShieldAlert,
  Server,
  Zap,
} from 'lucide-react';
import {
  auth,
  signInWithGoogle,
  signInAsGuest,
  logOut,
  saveCareerToCloud,
  loadCareerFromCloud,
  getCircuitLeaderboard,
  CloudLapRecord,
  checkFirebaseDiagnostics,
  FirebaseDiagnosticReport,
  resolvedFirebaseConfig,
  configSourceInfo,
} from '../services/firebase';
import { multiplayerService } from '../services/multiplayerService';
import { SeasonState } from '../types/racing';
import { CIRCUITS, TEAMS } from '../constants/f1Data';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

interface FirebaseCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  season: SeasonState;
  onLoadSeason: (season: SeasonState) => void;
}

export const FirebaseCloudModal: React.FC<FirebaseCloudModalProps> = ({
  isOpen,
  onClose,
  season,
  onLoadSeason,
}) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [activeTab, setActiveTab] = useState<'account' | 'leaderboards' | 'diagnostics'>('account');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Leaderboard state
  const [selectedCircuitId, setSelectedCircuitId] = useState<string>('monaco');
  const [leaderboardRecords, setLeaderboardRecords] = useState<CloudLapRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<FirebaseDiagnosticReport | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (activeTab === 'leaderboards') {
      loadLeaderboard(selectedCircuitId);
    } else if (activeTab === 'diagnostics' && !diagnostics) {
      runDiagnosticsCheck();
    }
  }, [activeTab, selectedCircuitId]);

  const runDiagnosticsCheck = async () => {
    setIsRunningDiagnostics(true);
    try {
      const report = await checkFirebaseDiagnostics();
      setDiagnostics(report);
    } catch (err: any) {
      setStatusMessage({ text: 'Diagnostic error: ' + String(err?.message || err), type: 'error' });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const loadLeaderboard = async (circuitId: string) => {
    setIsLoadingRecords(true);
    try {
      const records = await getCircuitLeaderboard(circuitId, 10);
      setLeaderboardRecords(records);
    } catch {
      setLeaderboardRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const handleSignInGoogle = async () => {
    setStatusMessage({ text: 'Opening Google Sign-In...', type: 'info' });
    const res = await signInWithGoogle();
    if (res.user) {
      setStatusMessage({ text: `✓ Signed in as ${res.user.displayName || res.user.email}!`, type: 'success' });
    } else {
      setStatusMessage({
        text: res.error || 'Google sign-in could not be completed. You can also click "Continue as Guest".',
        type: 'error',
      });
    }
  };

  const handleSignInGuest = async () => {
    setStatusMessage({ text: 'Creating anonymous cloud guest session...', type: 'info' });
    const user = await signInAsGuest();
    if (user) {
      setStatusMessage({ text: 'Guest session created! Career saves will sync to Firebase.', type: 'success' });
    } else {
      setStatusMessage({ text: 'Failed to create guest session.', type: 'error' });
    }
  };

  const handleSignOut = async () => {
    await logOut();
    setStatusMessage({ text: 'Signed out of cloud account.', type: 'info' });
  };

  const handleSaveToCloud = async () => {
    setIsSaving(true);
    setStatusMessage({ text: 'Saving career progression to Firebase Cloud...', type: 'info' });
    try {
      const res = await saveCareerToCloud({
        displayName: currentUser?.displayName || season.career.driverName || 'Formula 1 Driver',
        driverName: season.career.driverName,
        email: currentUser?.email || '',
        cashBalance: season.career.careerEarnings,
        selectedTeamId: season.selectedTeamId,
        selectedDriverId: season.selectedDriverId,
        difficulty: season.difficulty,
        racesEntered: season.career.racesDriven,
        wins: season.career.wins,
        podiums: season.career.podiums,
        championshipPoints: Object.values(season.driverPoints).reduce((a, b) => a + b, 0),
        customTeamName: season.career.customTeam?.name || '',
      });

      if (res.savedToFirestore || res.savedToRtdb) {
        const methods: string[] = [];
        if (res.savedToFirestore) methods.push('Cloud Firestore');
        if (res.savedToRtdb) methods.push('Realtime Database');
        setStatusMessage({
          text: `✓ Career progression saved to Firebase (${methods.join(' & ')})!`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: `Saved to local backup. Firebase write failed: ${res.error || 'Check rules & env vars'}.`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Cloud save error: ${err.message || String(err)}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadFromCloud = async () => {
    setIsLoadingCloud(true);
    setStatusMessage({ text: 'Fetching career progression from Cloud...', type: 'info' });
    try {
      const cloudData = await loadCareerFromCloud();
      if (cloudData) {
        const mergedSeason: SeasonState = {
          ...season,
          selectedTeamId: cloudData.selectedTeamId || season.selectedTeamId,
          selectedDriverId: cloudData.selectedDriverId || season.selectedDriverId,
          difficulty: cloudData.difficulty || season.difficulty,
          career: {
            ...season.career,
            driverName: cloudData.driverName || season.career.driverName,
            careerEarnings: cloudData.cashBalance ?? season.career.careerEarnings,
            wins: cloudData.wins ?? season.career.wins,
            podiums: cloudData.podiums ?? season.career.podiums,
            racesDriven: cloudData.racesEntered ?? season.career.racesDriven,
          },
        };
        onLoadSeason(mergedSeason);
        setStatusMessage({ text: '✓ Career progression loaded successfully from Cloud!', type: 'success' });
      } else {
        setStatusMessage({
          text: 'No existing cloud save found. Click "Save to Cloud" to initialize your career save.',
          type: 'info',
        });
      }
    } catch (err) {
      setStatusMessage({
        text: 'Failed to retrieve cloud save: ' + (err instanceof Error ? err.message : String(err)),
        type: 'error',
      });
    } finally {
      setIsLoadingCloud(false);
    }
  };

  if (!isOpen) return null;

  const currentCircuit = CIRCUITS.find((c) => c.id === selectedCircuitId) || CIRCUITS[9];
  const isNetlify = typeof window !== 'undefined' && window.location.hostname.includes('netlify.app');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wider text-white uppercase font-sans flex items-center gap-2">
                <span>Firebase Cloud Services</span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  {configSourceInfo.isCustomProject ? 'Custom Project' : 'Cloud Connected'}
                </span>
              </h2>
              <p className="text-xs text-neutral-400 font-mono">
                {currentUser
                  ? currentUser.isAnonymous
                    ? 'Guest Cloud Session Active'
                    : `Connected: ${currentUser.email || currentUser.displayName}`
                  : 'Ready • Guest / Local Fallback Active'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center px-6 pt-3 border-b border-neutral-800 bg-neutral-900/50 gap-2">
          <button
            onClick={() => setActiveTab('account')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'account'
                ? 'border-amber-500 text-amber-400 bg-neutral-800/60'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Driver Cloud Profile</span>
          </button>
          <button
            onClick={() => setActiveTab('leaderboards')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'leaderboards'
                ? 'border-amber-500 text-amber-400 bg-neutral-800/60'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Global Circuit Leaderboards</span>
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'diagnostics'
                ? 'border-amber-500 text-amber-400 bg-neutral-800/60'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Netlify & Cloud Inspector</span>
          </button>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-mono flex items-center gap-2 border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : statusMessage.type === 'error'
                ? 'bg-red-950/60 text-red-300 border-red-800/60'
                : 'bg-blue-950/60 text-blue-300 border-blue-800/60'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'account' ? (
            <div className="space-y-6">
              {/* Account Status Card */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Authentication Status</h3>
                    <p className="text-xs text-neutral-400">
                      {currentUser
                        ? currentUser.isAnonymous
                          ? 'Anonymous Guest Session (Auto-managed)'
                          : `Google Driver Account: ${currentUser.displayName || currentUser.email}`
                        : 'Guest ready. Click Save to Cloud to sync career data.'}
                    </p>
                  </div>
                  {currentUser && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Online</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={handleSaveToCloud}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-950/30 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isSaving ? 'Saving to Firebase...' : 'Save Career to Cloud'}</span>
                  </button>
                  <button
                    onClick={handleLoadFromCloud}
                    disabled={isLoadingCloud}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider transition-all border border-neutral-700 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isLoadingCloud ? 'Loading from Cloud...' : 'Load Career from Cloud'}</span>
                  </button>
                  {currentUser ? (
                    <button
                      onClick={handleSignOut}
                      className="px-4 py-2.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 font-bold text-xs border border-red-800/60 transition-all cursor-pointer flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleSignInGoogle}
                      className="px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs border border-neutral-700 transition-all cursor-pointer flex items-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In with Google</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Local Career Snapshot */}
              <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-3">
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Active Career Snapshot</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 uppercase font-mono block">Driver</span>
                    <span className="text-sm font-black text-white">{season.career.driverName}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 uppercase font-mono block">Earnings</span>
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      ${(season.career.careerEarnings / 1000000).toFixed(1)}M
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 uppercase font-mono block">Wins / Podiums</span>
                    <span className="text-sm font-black text-amber-400 font-mono">
                      {season.career.wins} / {season.career.podiums}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 uppercase font-mono block">Difficulty</span>
                    <span className="text-sm font-black text-blue-400 uppercase font-mono">{season.difficulty}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'leaderboards' ? (
            <div className="space-y-4">
              {/* Circuit Selector */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Select Grand Prix Circuit:
                </label>
                <select
                  value={selectedCircuitId}
                  onChange={(e) => setSelectedCircuitId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 text-xs text-white font-bold cursor-pointer"
                >
                  {CIRCUITS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.location})
                    </option>
                  ))}
                </select>
              </div>

              {/* Circuit Banner */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white">{currentCircuit.name}</h4>
                  <p className="text-xs text-neutral-400 font-mono">
                    Official Lap Record: {currentCircuit.lapRecord} ({currentCircuit.recordHolder})
                  </p>
                </div>
                <div className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold">
                  {currentCircuit.turns} Turns • {currentCircuit.lengthKm} km
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
                <div className="grid grid-cols-12 px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-[10px] font-mono font-bold text-neutral-400 uppercase">
                  <div className="col-span-2">Pos</div>
                  <div className="col-span-4">Driver</div>
                  <div className="col-span-3">Team</div>
                  <div className="col-span-3 text-right">Best Lap</div>
                </div>

                <div className="divide-y divide-neutral-900 max-h-60 overflow-y-auto">
                  {isLoadingRecords ? (
                    <div className="py-8 text-center text-neutral-500 font-mono text-xs animate-pulse">
                      Querying Firebase Firestore verified lap records...
                    </div>
                  ) : leaderboardRecords.length === 0 ? (
                    <div className="py-8 text-center text-neutral-500 font-mono text-xs">
                      No cloud lap times recorded yet for {currentCircuit.name}. Complete a race to set the first official record!
                    </div>
                  ) : (
                    leaderboardRecords.map((rec, idx) => {
                      const team = TEAMS.find((t) => t.id === rec.teamId);
                      return (
                        <div
                          key={rec.id || idx}
                          className="grid grid-cols-12 px-4 py-2.5 items-center text-xs font-mono hover:bg-neutral-900/50 transition-colors"
                        >
                          <div className="col-span-2 flex items-center gap-1.5 font-black">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                                idx === 0
                                  ? 'bg-amber-400 text-black font-black'
                                  : idx === 1
                                  ? 'bg-neutral-300 text-black'
                                  : idx === 2
                                  ? 'bg-amber-700 text-white'
                                  : 'text-neutral-500'
                              }`}
                            >
                              {idx + 1}
                            </span>
                          </div>
                          <div className="col-span-4 font-bold text-white truncate">{rec.driverName}</div>
                          <div className="col-span-3 text-neutral-400 truncate flex items-center gap-1.5">
                            {team && (
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: team.primaryColor }}
                              />
                            )}
                            <span>{team?.shortName || rec.teamId || 'F1'}</span>
                          </div>
                          <div className="col-span-3 text-right font-black text-amber-400 font-mono">
                            {rec.lapTimeFormatted}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* TAB 3: NETLIFY & CLOUD DIAGNOSTICS INSPECTOR */
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-white uppercase text-xs">Runtime Diagnostics</span>
                  </div>
                  <button
                    onClick={runDiagnosticsCheck}
                    disabled={isRunningDiagnostics}
                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isRunningDiagnostics ? 'Testing...' : 'Run Diagnostics'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800">
                    <span className="text-neutral-500 block">Hosting Environment:</span>
                    <span className="font-bold text-white">
                      {isNetlify ? 'Netlify CDN (Static SPA)' : 'Google AI Studio Preview / Dev'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800">
                    <span className="text-neutral-500 block">Firebase Project ID:</span>
                    <span className="font-bold text-cyan-400">{resolvedFirebaseConfig.projectId || 'None'}</span>
                  </div>
                  <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800">
                    <span className="text-neutral-500 block">Configuration Source:</span>
                    <span className="font-bold text-amber-400">
                      {configSourceInfo.isFromEnv ? 'Netlify / Build Environment Variables' : 'Local Project Blueprint'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800">
                    <span className="text-neutral-500 block">Firestore Database ID:</span>
                    <span className="font-bold text-white">
                      {resolvedFirebaseConfig.firestoreDatabaseId || '(default)'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800">
                    <span className="text-neutral-500 block">Multiplayer Transport Mode:</span>
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {multiplayerService.getTransportMode() === 'server'
                        ? 'Dedicated WebSocket / REST'
                        : 'Serverless Firebase Realtime Lobbies'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800">
                    <span className="text-neutral-500 block">Realtime Database URL:</span>
                    <span className="font-bold text-neutral-300 truncate block">
                      {resolvedFirebaseConfig.databaseURL || 'Not specified'}
                    </span>
                  </div>
                </div>

                {diagnostics && (
                  <div className="p-3 rounded bg-neutral-900/90 border border-neutral-800 space-y-1.5 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400">Cloud Firestore:</span>
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          diagnostics.firestoreStatus === 'connected'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-red-950 text-red-400 border border-red-800'
                        }`}
                      >
                        {diagnostics.firestoreStatus.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-neutral-400 truncate">{diagnostics.firestoreDetails}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400">Realtime DB:</span>
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          diagnostics.rtdbStatus === 'connected'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {diagnostics.rtdbStatus.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-neutral-400 truncate">{diagnostics.rtdbDetails}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Netlify Deployment Checklist */}
              <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2.5">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Netlify Deployment Checklist</span>
                </h4>
                <ul className="space-y-1.5 text-[11px] text-neutral-300 list-disc list-inside">
                  <li>
                    <strong className="text-white">Environment Variables:</strong> Configure in Netlify Site configuration &rarr; Environment variables. Both <code className="text-amber-300">VITE_FIREBASE_*</code> and <code className="text-amber-300">FIREBASE_*</code> are supported.
                  </li>
                  <li>
                    <strong className="text-white">Vite Build Time:</strong> Vite inlines variables at build time. After adding or modifying env vars in Netlify, click <strong className="text-white">Deploys &rarr; Trigger deploy &rarr; Clear cache and deploy site</strong>.
                  </li>
                  <li>
                    <strong className="text-white">Firestore vs Realtime Database:</strong> Cloud saves and leaderboards support both Firestore and Realtime Database. If using Realtime Database in test mode, ensure <code className="text-amber-300">VITE_FIREBASE_DATABASE_URL</code> is set.
                  </li>
                  <li>
                    <strong className="text-white">Serverless Multiplayer:</strong> On Netlify static hosting, multiplayer automatically runs serverlessly via Firebase rooms and BroadcastChannel.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400 font-mono">
          <span>Enterprise Grand Prix Cloud Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
