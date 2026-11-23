import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Check,
  Edit3,
  Trash2,
  Cloud,
  Upload,
  Download,
  LogIn,
  Car,
  Home,
  DollarSign,
  FolderKanban,
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import {
  MetroCitySaveSlot,
  loadMetroCitySlots,
  getActiveMetroCitySlotId,
  createMetroCitySlot,
  switchMetroCitySlot,
  renameMetroCitySlot,
  deleteMetroCitySlot,
  CITY_STREET_CARS,
} from '../game/cityTrafficBuilder';
import {
  auth,
  signInWithGoogle,
  signInAsGuest,
  saveMetroCitySlotsToCloud,
  syncAndMergeMetroCitySlotsWithCloud,
  deleteMetroCitySlotFromCloud,
} from '../services/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

interface MetroCitySlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSlotChanged?: () => void;
}

export const MetroCitySlotsModal: React.FC<MetroCitySlotsModalProps> = ({
  isOpen,
  onClose,
  onSlotChanged,
}) => {
  const [slots, setSlots] = useState<MetroCitySaveSlot[]>(() => loadMetroCitySlots());
  const [activeSlotId, setActiveSlotId] = useState<string>(() => getActiveMetroCitySlotId());
  const [newSlotName, setNewSlotName] = useState<string>('');
  const [copyCurrentOnNew, setCopyCurrentOnNew] = useState<boolean>(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const refreshLocal = () => {
    const latest = loadMetroCitySlots();
    setSlots(latest);
    setActiveSlotId(getActiveMetroCitySlotId(latest));
    onSlotChanged?.();
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshLocal();
    const unsubAuth = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    const onSaveUpdated = () => {
      const latest = loadMetroCitySlots();
      setSlots(latest);
      setActiveSlotId(getActiveMetroCitySlotId(latest));
    };
    window.addEventListener('metro-city-save-updated', onSaveUpdated);
    return () => {
      unsubAuth();
      window.removeEventListener('metro-city-save-updated', onSaveUpdated);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateSlot = async () => {
    const defaultName = `Metro City Save #${slots.length + 1}`;
    const created = createMetroCitySlot(newSlotName.trim() || defaultName, copyCurrentOnNew);
    setNewSlotName('');
    setConfirmDeleteId(null);
    refreshLocal();
    setStatusMsg({
      text: `Created & activated "${created.slotName}"${copyCurrentOnNew ? ' (cloned from current save)' : ' (fresh $5,000 start)'}.`,
      type: 'success',
    });
    if (auth.currentUser) {
      await saveMetroCitySlotsToCloud(undefined, created.slotId, false);
    }
  };

  const handleSwitchSlot = async (slotId: string) => {
    const target = switchMetroCitySlot(slotId);
    if (!target) return;
    setConfirmDeleteId(null);
    refreshLocal();
    setStatusMsg({ text: `Switched active Metro City save to "${target.slotName}".`, type: 'success' });
    if (auth.currentUser) {
      await saveMetroCitySlotsToCloud(undefined, slotId, false);
    }
  };

  const handleCommitRename = async (slotId: string) => {
    if (!editingName.trim()) {
      setEditingSlotId(null);
      return;
    }
    renameMetroCitySlot(slotId, editingName);
    setEditingSlotId(null);
    refreshLocal();
    setStatusMsg({ text: `Renamed save to "${editingName.trim()}".`, type: 'success' });
    if (auth.currentUser) {
      await saveMetroCitySlotsToCloud(undefined, undefined, false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (slots.length <= 1) return;
    const removedName = slots.find((s) => s.slotId === slotId)?.slotName || 'Save';
    deleteMetroCitySlot(slotId);
    setConfirmDeleteId(null);
    refreshLocal();
    setStatusMsg({ text: `Deleted "${removedName}".`, type: 'info' });
    if (auth.currentUser) {
      await deleteMetroCitySlotFromCloud(slotId);
      await saveMetroCitySlotsToCloud(undefined, undefined, false);
    }
  };

  const handlePushCloud = async () => {
    setIsSyncing(true);
    setStatusMsg({ text: 'Syncing all Metro City saves to Firebase Firestore...', type: 'info' });
    try {
      const res = await saveMetroCitySlotsToCloud(undefined, undefined, true);
      if (res.success) {
        setStatusMsg({
          text: `✓ Synced ${res.syncedCount} Metro City save${res.syncedCount === 1 ? '' : 's'} to Firebase Cloud!`,
          type: 'success',
        });
      } else {
        setStatusMsg({ text: res.error || 'Could not sync Metro City saves to Firebase.', type: 'error' });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullCloud = async () => {
    setIsSyncing(true);
    setStatusMsg({ text: 'Pulling & merging Metro City saves from Firebase...', type: 'info' });
    try {
      let user = auth.currentUser;
      if (!user) {
        user = await signInAsGuest();
      }
      if (!user) {
        setStatusMsg({ text: 'Sign in with Google or Guest first to load from Firebase.', type: 'error' });
        return;
      }
      const res = await syncAndMergeMetroCitySlotsWithCloud(true);
      refreshLocal();
      setStatusMsg({
        text: `✓ Cloud sync complete — ${res.slots.length} Metro City save${res.slots.length === 1 ? '' : 's'} ready.`,
        type: 'success',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSyncing(true);
    try {
      const res = await signInWithGoogle();
      if (res.user) {
        await syncAndMergeMetroCitySlotsWithCloud(true);
        refreshLocal();
        setStatusMsg({
          text: `✓ Connected Google account (${res.user.email || res.user.displayName}) & synced Metro City saves!`,
          type: 'success',
        });
      } else {
        setStatusMsg({ text: res.error || 'Google sign-in was cancelled.', type: 'info' });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl bg-neutral-950 border border-sky-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-slate-950 via-zinc-900 to-sky-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide text-white uppercase flex items-center gap-2">
                <span>Metro City Save Slots</span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-full">
                  {slots.length} {slots.length === 1 ? 'Save' : 'Saves'}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Create multiple independent Metro City profiles (cash, cars, homes, missions) synced to Firebase.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Banner */}
        {statusMsg && (
          <div
            className={`px-6 py-2.5 text-xs font-mono flex items-center gap-2 border-b ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : statusMsg.type === 'error'
                ? 'bg-red-950/60 text-red-300 border-red-800/60'
                : 'bg-sky-950/60 text-sky-300 border-sky-800/60'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Firebase Cloud Sync Bar */}
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Cloud className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black uppercase text-white flex items-center gap-2">
                  <span>Firebase Cloud Link</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${
                      currentUser
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-400 border border-white/10'
                    }`}
                  >
                    {currentUser
                      ? currentUser.isAnonymous
                        ? 'Guest Cloud Active'
                        : currentUser.email || currentUser.displayName || 'Connected'
                      : 'Local Only (Click Sync or Sign In)'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Every save slot syncs natively to Firestore under your account.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!currentUser && (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSyncing}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-black text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Google Sign-In</span>
                </button>
              )}
              <button
                type="button"
                onClick={handlePushCloud}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isSyncing ? 'Syncing...' : 'Sync to Cloud'}</span>
              </button>
              <button
                type="button"
                onClick={handlePullCloud}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs border border-white/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Pull Cloud</span>
              </button>
            </div>
          </div>

          {/* Create New Save Slot Bar */}
          <div className="p-4 rounded-2xl bg-sky-950/25 border border-sky-500/30 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={newSlotName}
                onChange={(e) => setNewSlotName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSlot()}
                maxLength={64}
                placeholder={`New save name (e.g., Hadley Farms Run #${slots.length + 1})`}
                className="flex-1 px-3.5 py-2 rounded-xl bg-black/60 border border-white/15 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
              />
              <button
                type="button"
                onClick={handleCreateSlot}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Save</span>
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={copyCurrentOnNew}
                onChange={(e) => setCopyCurrentOnNew(e.target.checked)}
                className="rounded border-white/20 bg-black accent-sky-500"
              />
              <Copy className="w-3.5 h-3.5 text-sky-400" />
              <span>Clone current active save instead of starting fresh ($5,000 starter cash & stock Civic/Camry)</span>
            </label>
          </div>

          {/* Existing Slots List */}
          <div className="space-y-3">
            {slots.map((slot) => {
              const isActive = slot.slotId === activeSlotId;
              const isEditing = editingSlotId === slot.slotId;
              const isConfirmDelete = confirmDeleteId === slot.slotId;
              const activeCar =
                CITY_STREET_CARS.find((c) => c.id === slot.state.selectedCarId) || CITY_STREET_CARS[0];

              return (
                <div
                  key={slot.slotId}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isActive
                      ? 'bg-emerald-950/30 border-emerald-400/70 ring-1 ring-emerald-400/40'
                      : 'bg-zinc-900/80 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitRename(slot.slotId);
                              if (e.key === 'Escape') setEditingSlotId(null);
                            }}
                            maxLength={64}
                            autoFocus
                            className="px-2.5 py-1 rounded-lg bg-black border border-sky-400 text-sm font-bold text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleCommitRename(slot.slotId)}
                            className="p-1.5 rounded-lg bg-emerald-500 text-black cursor-pointer"
                            title="Save name"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <h3 className="text-sm font-black text-white truncate">{slot.slotName}</h3>
                      )}

                      {isActive && (
                        <span className="px-2 py-0.5 rounded bg-emerald-400 text-black font-mono font-black text-[10px] uppercase">
                          ACTIVE SAVE
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-zinc-500">
                        Updated {new Date(slot.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <DollarSign className="w-3.5 h-3.5" />
                        ${slot.state.streetCash.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1 text-sky-300">
                        <Car className="w-3.5 h-3.5" />
                        {slot.state.ownedCarIds.length} Cars · {activeCar.name}
                      </span>
                      <span className="flex items-center gap-1 text-teal-300">
                        <Home className="w-3.5 h-3.5" />
                        {slot.state.ownedHouseIds.length} Homes
                      </span>
                      <span className="text-amber-300">
                        Rep LVL {slot.state.streetRepLevel} · {slot.state.completedMissionIds.length} Missions
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => handleSwitchSlot(slot.slotId)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase cursor-pointer"
                      >
                        Load Save
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setEditingSlotId(slot.slotId);
                        setEditingName(slot.slotName);
                      }}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 cursor-pointer"
                      title="Rename save slot"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {slots.length > 1 && (
                      isConfirmDelete ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteSlot(slot.slotId)}
                            className="px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-[11px] cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(slot.slotId)}
                          className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/50 cursor-pointer"
                          title="Delete save slot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-black/80 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span>Saves stored locally + Firebase /users/uid/metroCitySaves</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
