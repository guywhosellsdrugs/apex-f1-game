import React, { useState } from 'react';
import { SeasonState } from '../types/racing';
import { TEAMS, CIRCUITS } from '../constants/f1Data';
import {
  X,
  Plus,
  FolderKanban,
  Trophy,
  DollarSign,
  CheckCircle2,
  Play,
  Trash2,
  Pencil,
  Check,
  Shield,
  Gauge,
  Sparkles,
  User,
  Flag,
} from 'lucide-react';

export interface CareerSaveSlot {
  id: string;
  slotName: string;
  driverName: string;
  driverNumber: number;
  selectedTeamId: string;
  customTeamName?: string;
  difficulty: 'rookie' | 'pro' | 'legend';
  hasChosenDifficulty: boolean;
  seasonNumber: number;
  currentRound: number;
  careerEarnings: number;
  wins: number;
  podiums: number;
  championships: number;
  racesDriven: number;
  seasonState: SeasonState;
  createdAt: number;
  updatedAt: number;
}

interface CareerSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slots: CareerSaveSlot[];
  activeSlotId: string;
  onSwitchSlot: (slotId: string) => void;
  onCreateNewSlot: (params: {
    slotName: string;
    driverName: string;
    driverNumber: number;
    country: string;
    difficulty: 'rookie' | 'pro' | 'legend';
  }) => void;
  onRenameSlot: (slotId: string, newSlotName: string) => void;
  onDeleteSlot: (slotId: string) => void;
}

export const CareerSlotsModal: React.FC<CareerSlotsModalProps> = ({
  isOpen,
  onClose,
  slots,
  activeSlotId,
  onSwitchSlot,
  onCreateNewSlot,
  onRenameSlot,
  onDeleteSlot,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [slotName, setSlotName] = useState('');
  const [driverName, setDriverName] = useState('Rookie Driver');
  const [driverNumber, setDriverNumber] = useState(87);
  const [country, setCountry] = useState('United States');
  const [difficulty, setDifficulty] = useState<'rookie' | 'pro' | 'legend'>('pro');

  const [renamingSlotId, setRenamingSlotId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val || 0);

  const handleOpenCreateForm = () => {
    const nextNum = slots.length + 1;
    setSlotName(`Career #${nextNum}`);
    setDriverName('Rookie Driver');
    setDriverNumber(87);
    setCountry('United States');
    setDifficulty('pro');
    setShowCreateForm(true);
  };

  const handleSubmitNewCareer = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlotName = slotName.trim() || `Career #${slots.length + 1}`;
    const cleanDriverName = driverName.trim() || 'Rookie Driver';
    const cleanNumber = Math.max(1, Math.min(99, Number(driverNumber) || 87));
    const cleanCountry = country.trim() || 'United States';

    onCreateNewSlot({
      slotName: cleanSlotName,
      driverName: cleanDriverName,
      driverNumber: cleanNumber,
      country: cleanCountry,
      difficulty,
    });

    setShowCreateForm(false);
    setBannerNotice(
      `Created and switched to "${cleanSlotName}" (${difficulty.toUpperCase()} difficulty)! Your other career saves are safely preserved.`
    );
    window.setTimeout(() => setBannerNotice(null), 5000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-white/15 max-w-4xl w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-white/10 bg-neutral-950/90 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/25 to-red-600/25 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-widest">
                  MULTI-CAREER ACCOUNT VAULT
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
                  {slots.length} {slots.length === 1 ? 'CAREER SAVED' : 'CAREERS SAVED'}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white mt-0.5">
                My Careers — Switch or Start New Career Without Quitting
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {!showCreateForm && (
              <button
                type="button"
                onClick={handleOpenCreateForm}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-amber-950/50 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>New Career Slot</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {bannerNotice && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{bannerNotice}</span>
            </div>
          )}

          {/* Create New Career Slot Form */}
          {showCreateForm && (
            <form
              onSubmit={handleSubmitNewCareer}
              className="bg-neutral-950 border-2 border-amber-500/40 rounded-2xl p-5 md:p-6 space-y-5 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Start a Brand-New Career Slot (Keeps All Existing Careers)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-xs text-zinc-400 hover:text-white font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Your current career is automatically saved in its own slot. Creating a new career lets you start fresh with MoneyGram Haas F1 Team on any difficulty you choose, and you can switch back and forth between your careers anytime!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Career Slot Title
                  </label>
                  <input
                    type="text"
                    value={slotName}
                    onChange={(e) => setSlotName(e.target.value)}
                    maxLength={50}
                    placeholder="e.g., Legend Challenge"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/15 text-white text-sm font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Driver Name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      maxLength={40}
                      placeholder="Rookie Driver"
                      required
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/15 text-white text-sm font-semibold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Car Number (#1–99)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={driverNumber}
                    onChange={(e) => setDriverNumber(parseInt(e.target.value, 10) || 87)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/15 text-white text-sm font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Nationality
                  </label>
                  <div className="relative">
                    <Flag className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      maxLength={40}
                      placeholder="United States"
                      required
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/15 text-white text-sm font-semibold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Select Difficulty for this New Career Slot */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                  Choose AI Difficulty for This Career Slot
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(
                    [
                      {
                        id: 'rookie',
                        title: 'Rookie',
                        pace: '0.80x PACE',
                        desc: 'Forgiving cornering speeds & 2.0s crash penalty.',
                        color: 'emerald',
                      },
                      {
                        id: 'pro',
                        title: 'Pro (Standard)',
                        pace: '0.89x PACE',
                        desc: 'Authentic F1 race pace & 3.5s crash penalty.',
                        color: 'red',
                      },
                      {
                        id: 'legend',
                        title: 'Legend',
                        pace: '1.0x PACE',
                        desc: '1.0x true simulation pace & 5.0s crash penalty.',
                        color: 'purple',
                      },
                    ] as const
                  ).map((opt) => {
                    const selected = difficulty === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDifficulty(opt.id)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          selected
                            ? opt.id === 'rookie'
                              ? 'bg-emerald-500/15 border-emerald-400 ring-1 ring-emerald-400'
                              : opt.id === 'pro'
                              ? 'bg-red-500/15 border-red-400 ring-1 ring-red-400'
                              : 'bg-purple-500/15 border-purple-400 ring-1 ring-purple-400'
                            : 'bg-neutral-900 border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-black uppercase ${
                              opt.id === 'rookie'
                                ? 'text-emerald-400'
                                : opt.id === 'pro'
                                ? 'text-red-400'
                                : 'text-purple-400'
                            }`}
                          >
                            {opt.title}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/40 text-zinc-300">
                            {opt.pace}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-300 leading-snug">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-zinc-300 font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-950/40 flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Create & Launch Career Slot</span>
                </button>
              </div>
            </form>
          )}

          {/* List of All Career Slots Under This Account */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                Saved Careers Under Your Account ({slots.length})
              </h3>
              <span className="text-[11px] text-zinc-400">
                Switch between careers anytime — progress saves automatically
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {slots.map((slot, index) => {
                const isActive = slot.id === activeSlotId;
                const sState = slot.seasonState;
                const customTeam = sState?.career?.customTeam;
                const stdTeam = TEAMS.find((t) => t.id === (sState?.selectedTeamId || slot.selectedTeamId));
                const teamDisplayName = customTeam
                  ? `${customTeam.name} (Owner)`
                  : stdTeam?.name || 'MoneyGram Haas F1 Team';
                const teamColor = customTeam?.primaryColor || stdTeam?.primaryColor || '#ef4444';
                const roundCircuit =
                  CIRCUITS[sState?.currentRound ?? slot.currentRound ?? 0] || CIRCUITS[0];

                const diffBadgeClass =
                  slot.difficulty === 'legend'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : slot.difficulty === 'pro'
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

                return (
                  <div
                    key={slot.id}
                    className={`rounded-2xl p-5 border transition-all flex flex-col gap-4 ${
                      isActive
                        ? 'bg-gradient-to-r from-neutral-950 via-neutral-900 to-amber-950/25 border-2 border-amber-500/60 shadow-xl'
                        : 'bg-neutral-950/90 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center font-mono font-black text-white text-sm shadow-md shrink-0 border border-white/20"
                          style={{ backgroundColor: teamColor }}
                        >
                          #{sState?.career?.driverNumber || slot.driverNumber || 87}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            {isActive ? (
                              <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>ACTIVE CAREER</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-400 text-[10px] font-mono font-bold uppercase">
                                SLOT #{index + 1}
                              </span>
                            )}

                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${diffBadgeClass}`}
                            >
                              {slot.difficulty.toUpperCase()} AI
                            </span>

                            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300 text-[10px] font-mono font-bold">
                              Season {sState?.career?.seasonNumber || slot.seasonNumber || 1} · Round{' '}
                              {(sState?.currentRound ?? slot.currentRound ?? 0) + 1}/10 ({roundCircuit.location})
                            </span>
                          </div>

                          {/* Slot Title / Rename */}
                          {renamingSlotId === slot.id ? (
                            <div className="flex items-center gap-2 mt-1.5">
                              <input
                                type="text"
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                maxLength={50}
                                autoFocus
                                className="px-3 py-1 rounded-lg bg-neutral-900 border border-amber-500 text-white text-sm font-bold focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (renameDraft.trim()) {
                                    onRenameSlot(slot.id, renameDraft.trim());
                                  }
                                  setRenamingSlotId(null);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500 text-black text-xs font-black uppercase cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setRenamingSlotId(null)}
                                className="px-2.5 py-1 rounded-lg bg-neutral-800 text-zinc-300 text-xs font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-1">
                              <h4 className="text-lg font-black text-white">{slot.slotName}</h4>
                              <button
                                type="button"
                                onClick={() => {
                                  setRenamingSlotId(slot.id);
                                  setRenameDraft(slot.slotName);
                                }}
                                className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
                                title="Rename Career Slot"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <p className="text-xs text-zinc-400 mt-0.5">
                            Driver: <strong className="text-zinc-200">{sState?.career?.driverName || slot.driverName}</strong> · Team:{' '}
                            <strong className="text-zinc-200">{teamDisplayName}</strong>
                          </p>
                        </div>
                      </div>

                      {/* Switch / Delete Controls */}
                      <div className="flex items-center gap-2">
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => {
                              onSwitchSlot(slot.id);
                              setBannerNotice(`Switched to "${slot.slotName}"!`);
                              window.setTimeout(() => setBannerNotice(null), 4000);
                            }}
                            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-black" />
                            <span>Switch to Career</span>
                          </button>
                        ) : (
                          <span className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-black text-xs uppercase tracking-wider">
                            Currently Playing
                          </span>
                        )}

                        {slots.length > 1 && (
                          <>
                            {confirmDeleteId === slot.id ? (
                              <div className="flex items-center gap-1.5 bg-red-950/80 border border-red-500/40 px-2.5 py-1.5 rounded-xl">
                                <span className="text-[10px] font-bold text-red-200">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteSlot(slot.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase cursor-pointer"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 rounded bg-neutral-800 text-zinc-300 text-[10px] font-bold cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(slot.id)}
                                className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors cursor-pointer"
                                title="Delete this career slot"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Career Slot Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-white/5">
                      <div className="bg-neutral-900/80 rounded-xl px-3 py-2 border border-white/5">
                        <span className="text-[10px] font-mono uppercase text-zinc-400 block">Cash Balance</span>
                        <span className="text-xs font-mono font-black text-emerald-400">
                          {formatMoney(sState?.career?.careerEarnings ?? slot.careerEarnings)}
                        </span>
                      </div>
                      <div className="bg-neutral-900/80 rounded-xl px-3 py-2 border border-white/5">
                        <span className="text-[10px] font-mono uppercase text-zinc-400 block">Driver OVR</span>
                        <span className="text-xs font-mono font-black text-purple-400">
                          {sState?.career?.driverRating ?? 76} Rating
                        </span>
                      </div>
                      <div className="bg-neutral-900/80 rounded-xl px-3 py-2 border border-white/5">
                        <span className="text-[10px] font-mono uppercase text-zinc-400 block">Wins / Podiums</span>
                        <span className="text-xs font-mono font-black text-amber-400">
                          {sState?.career?.wins ?? slot.wins} W / {sState?.career?.podiums ?? slot.podiums} P
                        </span>
                      </div>
                      <div className="bg-neutral-900/80 rounded-xl px-3 py-2 border border-white/5">
                        <span className="text-[10px] font-mono uppercase text-zinc-400 block">World Titles</span>
                        <span className="text-xs font-mono font-black text-cyan-400">
                          {sState?.career?.championships ?? slot.championships} Cups
                        </span>
                      </div>
                      <div className="bg-neutral-900/80 rounded-xl px-3 py-2 border border-white/5 col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-mono uppercase text-zinc-400 block">Races Driven</span>
                        <span className="text-xs font-mono font-black text-white">
                          {sState?.career?.racesDriven ?? slot.racesDriven} GPs
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-neutral-950/90 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-zinc-400">
            All career slots are linked to your account and sync with Firebase Cloud & Local Storage.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
