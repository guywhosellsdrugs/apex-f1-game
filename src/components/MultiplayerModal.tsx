import React, { useState, useEffect } from 'react';
import {
  multiplayerService,
  RoomPublicState,
  ChatMessage,
  RoomPlayerPublic,
} from '../services/multiplayerService';
import { CIRCUITS, TEAMS } from '../constants/f1Data';
import { SeasonState } from '../types/racing';
import { TrackLayoutPreview } from './TrackLayoutPreview';
import { formatDistance, getStoredUnitSystem } from '../utils/units';
import {
  X,
  Users,
  Copy,
  Check,
  Play,
  Settings,
  Bot,
  Flag,
  RotateCw,
  Send,
  Shield,
  Crown,
  Sparkles,
  AlertCircle,
  Hash,
} from 'lucide-react';

interface MultiplayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  season: SeasonState;
  onLaunchRace: (room: RoomPublicState) => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  isOpen,
  onClose,
  season,
  onLaunchRace,
}) => {
  const [activeTab, setActiveTab] = useState<'host' | 'join'>('host');
  const [room, setRoom] = useState<RoomPublicState | null>(() => multiplayerService.getRoom());
  const [isCopied, setIsCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Host configuration state
  const [circuitId, setCircuitId] = useState(CIRCUITS[0].id);
  const [laps, setLaps] = useState(5);
  const [botCount, setBotCount] = useState(15); // Total 1 player + 15 bots = 16 cars (max 20)
  const [botDifficulty, setBotDifficulty] = useState<'rookie' | 'pro' | 'legend'>('pro');
  const [hasTeammates, setHasTeammates] = useState(true);

  // Driver details for multiplayer
  const defaultPlayerName = season.career.driverName || 'Player 1';
  const defaultCarNumber = season.career.driverNumber || 87;
  const [driverName, setDriverName] = useState(defaultPlayerName);
  const [carNumber, setCarNumber] = useState(defaultCarNumber);

  // Join configuration state
  const [joinCode, setJoinCode] = useState('');
  const [publicRooms, setPublicRooms] = useState<RoomPublicState[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const loadPublicRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const rooms = await multiplayerService.getPublicRooms();
      setPublicRooms(rooms);
    } catch {
      setPublicRooms([]);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'join') {
      loadPublicRooms();
      const interval = setInterval(loadPublicRooms, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, activeTab]);

  // Subscribe to room changes and chat
  useEffect(() => {
    if (!isOpen) return;

    const unsubRoom = multiplayerService.subscribeRoom((updatedRoom) => {
      setRoom(updatedRoom);
      if (updatedRoom) {
        setErrorMsg(null);
      }
    });

    const unsubRace = multiplayerService.onRaceStarting((startingRoom) => {
      onLaunchRace(startingRoom);
    });

    const unsubChat = multiplayerService.onChat((msg) => {
      setChatMessages((prev) => [...prev.slice(-40), msg]);
    });

    const unsubError = multiplayerService.onError((err) => {
      setErrorMsg(err);
      setIsConnecting(false);
    });

    return () => {
      unsubRoom();
      unsubRace();
      unsubChat();
      unsubError();
    };
  }, [isOpen, onLaunchRace]);

  if (!isOpen) return null;

  const currentTeam = season.career.customTeam
    ? season.career.customTeam
    : TEAMS.find((t) => t.id === season.selectedTeamId) || TEAMS[0];

  const teamColor = currentTeam.primaryColor || '#e10600';
  const accentColor = currentTeam.accentColor || '#ffffff';

  const handleHostRoom = async () => {
    setIsConnecting(true);
    setErrorMsg(null);

    const res = await multiplayerService.createRoom({
      circuitId,
      laps,
      botCount,
      botDifficulty,
      hasTeammates,
      player: {
        name: driverName.trim() || 'Driver',
        carNumber: Number(carNumber) || 87,
        teamId: season.selectedTeamId || 'custom',
        teamColor,
        accentColor,
      },
    });

    setIsConnecting(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to create room.');
    }
  };

  const handleQuickMatch = async () => {
    setIsConnecting(true);
    setErrorMsg(null);

    const res = await multiplayerService.quickJoinRoom({
      name: driverName.trim() || defaultPlayerName,
      carNumber: Number(carNumber) || defaultCarNumber,
      teamId: season.selectedTeamId || 'custom',
      teamColor,
      accentColor,
      circuitId,
    });

    setIsConnecting(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Quick match failed to connect.');
    }
  };

  const handleJoinSpecificRoom = async (code: string) => {
    setIsConnecting(true);
    setErrorMsg(null);

    const res = await multiplayerService.joinRoom({
      code,
      player: {
        name: driverName.trim() || defaultPlayerName,
        carNumber: Number(carNumber) || defaultCarNumber,
        teamId: season.selectedTeamId || 'custom',
        teamColor,
        accentColor,
      },
    });

    setIsConnecting(false);
    if (!res.success) {
      setErrorMsg(res.error || `Could not join room ${code}.`);
    }
  };

  const handleJoinRoom = async () => {
    const cleanCode = joinCode.trim().toUpperCase();
    if (cleanCode.length !== 4) {
      setErrorMsg('Please enter a valid 4-digit room code.');
      return;
    }

    await handleJoinSpecificRoom(cleanCode);
  };

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    multiplayerService.sendChat(chatInput);
    setChatInput('');
  };

  const isHost = multiplayerService.isHost();
  const localPlayerId = multiplayerService.getLocalPlayerId();
  const localPlayer = room?.players.find((p) => p.id === localPlayerId);

  // Maximum bots allowed so total players + bots <= 20
  const currentPlayersCount = room ? room.players.length : 1;
  const maxAllowedBots = Math.max(0, 20 - currentPlayersCount);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 max-w-4xl w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-black tracking-widest text-red-500">
                  FIA Online Grand Prix
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] border border-emerald-500/20">
                  Live Rooms
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-wide">
                Multiplayer Paddock & 4-Digit Rooms
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-red-500/20 border-b border-red-500/40 text-red-300 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Room Lobby View if in a room */}
        {room ? (
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
            {/* 4-Digit Code Banner */}
            <div className="bg-gradient-to-r from-red-950/50 via-neutral-900 to-neutral-950 border-2 border-red-500/40 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
              <div className="space-y-1 text-center md:text-left">
                <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">
                  Room Invite Code (4-Digit)
                </span>
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <div className="flex gap-2">
                    {room.code.split('').map((char, i) => (
                      <span
                        key={i}
                        className="w-12 h-14 rounded-2xl bg-neutral-950 border-2 border-red-500/60 text-white font-mono text-3xl font-black flex items-center justify-center shadow-inner tracking-widest"
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-all shadow"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {isCopied ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <p className="text-xs text-neutral-400 pt-1">
                  Share this 4-digit code with friends so they can join your lobby instantly.
                </p>
              </div>

              {/* Quick Settings Overview */}
              <div className="flex flex-wrap gap-3 justify-center md:justify-end text-xs font-mono">
                <div className="bg-neutral-950/80 px-3.5 py-2 rounded-xl border border-neutral-800">
                  <span className="text-neutral-500 block text-[10px]">CIRCUIT</span>
                  <span className="font-bold text-white">
                    {CIRCUITS.find((c) => c.id === room.circuitId)?.name || room.circuitId}
                  </span>
                </div>
                <div className="bg-neutral-950/80 px-3.5 py-2 rounded-xl border border-neutral-800">
                  <span className="text-neutral-500 block text-[10px]">DISTANCE</span>
                  <span className="font-bold text-amber-400">{room.laps} LAPS</span>
                </div>
                <div className="bg-neutral-950/80 px-3.5 py-2 rounded-xl border border-neutral-800">
                  <span className="text-neutral-500 block text-[10px]">BOTS / TOTAL</span>
                  <span className="font-bold text-cyan-400">
                    {room.botCount} Bots / {room.players.length + room.botCount} Max 20
                  </span>
                </div>
                <div className="bg-neutral-950/80 px-3.5 py-2 rounded-xl border border-neutral-800">
                  <span className="text-neutral-500 block text-[10px]">DIFFICULTY</span>
                  <span className="font-bold uppercase text-purple-400">{room.botDifficulty}</span>
                </div>
              </div>
            </div>

            {/* Split Grid: Players List & Room Chat */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Connected Players & Bot slots */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                    <Users className="w-4 h-4 text-red-500" />
                    Starting Grid ({room.players.length} Players + {room.botCount} Bots)
                  </h3>
                  <span className="text-xs font-mono text-neutral-500">
                    Max 20 Cars on Track
                  </span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {room.players.map((p, idx) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-center font-mono font-bold text-neutral-500 text-xs">
                          P{idx + 1}
                        </span>
                        <div
                          className="w-4 h-8 rounded-sm shadow-sm"
                          style={{ backgroundColor: p.teamColor || '#e10600' }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{p.name}</span>
                            {p.isHost && (
                              <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                                <Crown className="w-3 h-3 text-amber-400" />
                                Host
                              </span>
                            )}
                            {p.id === localPlayerId && (
                              <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-bold">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-neutral-400">
                            Car #{p.carNumber}
                          </span>
                        </div>
                      </div>

                      <div>
                        {p.isReady ? (
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/30">
                            <Check className="w-3.5 h-3.5" />
                            Ready
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-neutral-800 text-neutral-400 font-mono text-xs font-bold">
                            Waiting
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Bot Slots representation */}
                  {room.botCount > 0 && (
                    <div className="p-3 rounded-2xl bg-neutral-950/40 border border-dashed border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-cyan-400" />
                        <span>
                          + {room.botCount} CPU Drivers ({room.botDifficulty.toUpperCase()} Difficulty
                          {room.hasTeammates ? ' • Teammates Active' : ''})
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-neutral-500">
                        Slots P{room.players.length + 1} to P{room.players.length + room.botCount}
                      </span>
                    </div>
                  )}
                </div>

                {/* Host In-Lobby Settings (Host can change bots / laps / track right in the lobby) */}
                {isHost && (
                  <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 mt-2 space-y-3">
                    <div className="text-xs font-bold text-neutral-300 flex items-center gap-2 uppercase tracking-wider">
                      <Settings className="w-3.5 h-3.5 text-red-500" />
                      Host Room Controls
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-mono text-neutral-400 block mb-1">
                          Bots (Max {maxAllowedBots})
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={maxAllowedBots}
                          value={room.botCount}
                          onChange={(e) => {
                            const val = Math.min(maxAllowedBots, Math.max(0, parseInt(e.target.value) || 0));
                            multiplayerService.updateSettings({ botCount: val });
                          }}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-1.5 text-white font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-mono text-neutral-400 block mb-1">
                          Laps
                        </label>
                        <select
                          value={room.laps}
                          onChange={(e) =>
                            multiplayerService.updateSettings({ laps: parseInt(e.target.value) })
                          }
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-1.5 text-white font-mono text-xs"
                        >
                          <option value="3">3 Laps (Sprint)</option>
                          <option value="5">5 Laps (Standard)</option>
                          <option value="10">10 Laps (Grand Prix)</option>
                          <option value="15">15 Laps (Full GP)</option>
                        </select>
                      </div>

                      <div className="col-span-2 md:col-span-1">
                        <label className="text-[11px] font-mono text-neutral-400 block mb-1">
                          Teammate Bots
                        </label>
                        <button
                          onClick={() =>
                            multiplayerService.updateSettings({ hasTeammates: !room.hasTeammates })
                          }
                          className={`w-full py-1.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                            room.hasTeammates
                              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                              : 'bg-neutral-900 border-neutral-700 text-neutral-400'
                          }`}
                        >
                          {room.hasTeammates ? 'Teammates: ON' : 'Teammates: OFF'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Lobby Chat / Pit Radio */}
              <div className="lg:col-span-5 flex flex-col h-72 lg:h-auto bg-neutral-950 rounded-2xl border border-neutral-800 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/40 text-xs font-bold text-neutral-300 flex items-center justify-between">
                  <span>Paddock Pit Radio & Chat</span>
                  <span className="text-[10px] font-mono text-neutral-500">Live</span>
                </div>

                <div className="p-3 overflow-y-auto flex-1 space-y-2 text-xs">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-neutral-500 text-center italic text-[11px]">
                      Paddock radio channel open. Say hello to rivals!
                    </div>
                  ) : (
                    chatMessages.map((m, i) => (
                      <div key={i} className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="font-bold" style={{ color: m.teamColor || '#ff4444' }}>
                            #{m.carNumber} {m.sender}
                          </span>
                          <span className="text-[9px] text-neutral-600">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="text-neutral-200 pl-2 text-xs">{m.text}</span>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendChat} className="p-2 border-t border-neutral-800 flex gap-2 bg-neutral-900/60">
                  <input
                    type="text"
                    placeholder="Team radio message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    maxLength={140}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors flex items-center justify-center"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={() => multiplayerService.leaveRoom()}
                className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-bold text-xs transition-colors"
              >
                Leave Room & Back to Career
              </button>

              <div className="flex items-center gap-3">
                {localPlayer && (
                  <button
                    onClick={() => multiplayerService.toggleReady(!localPlayer.isReady)}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                      localPlayer.isReady
                        ? 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400'
                        : 'bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700'
                    }`}
                  >
                    {localPlayer.isReady ? "Ready (Click to Unready)" : "Mark as Ready"}
                  </button>
                )}

                {isHost && (
                  <button
                    onClick={() => multiplayerService.startRace()}
                    className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-red-900/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Launch Grand Prix
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Host or Join Selection Screen */
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
            {/* Mode Tabs */}
            <div className="flex border-b border-neutral-800">
              <button
                onClick={() => setActiveTab('host')}
                className={`flex items-center gap-2 pb-3 px-6 font-bold text-sm tracking-wide border-b-2 transition-colors ${
                  activeTab === 'host'
                    ? 'border-red-500 text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Crown className="w-4 h-4" />
                Host a Room (Get 4-Digit Code)
              </button>
              <button
                onClick={() => setActiveTab('join')}
                className={`flex items-center gap-2 pb-3 px-6 font-bold text-sm tracking-wide border-b-2 transition-colors ${
                  activeTab === 'join'
                    ? 'border-red-500 text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Hash className="w-4 h-4" />
                Join with 4-Digit Code
              </button>
            </div>

            {/* Profile Bar */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow"
                  style={{ backgroundColor: teamColor }}
                >
                  #{carNumber}
                </div>
                <div>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Your Driver Profile</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Driver Name"
                      className="bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1 text-white font-bold text-xs"
                    />
                    <input
                      type="number"
                      value={carNumber}
                      onChange={(e) => setCarNumber(parseInt(e.target.value) || 1)}
                      min="1"
                      max="99"
                      className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1 text-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="text-xs text-neutral-400 font-mono">
                Team: <strong className="text-white">{currentTeam.name}</strong>
              </div>
            </div>

            {/* TAB: Host Room */}
            {activeTab === 'host' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Track Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                      <Flag className="w-3.5 h-3.5 text-red-500" />
                      Select Grand Prix Track
                    </label>
                    <select
                      value={circuitId}
                      onChange={(e) => setCircuitId(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-3.5 text-white font-bold text-sm focus:outline-none focus:border-red-500"
                    >
                      {CIRCUITS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.location}) - {formatDistance(c.lengthKm, getStoredUnitSystem())}
                        </option>
                      ))}
                    </select>

                    {/* Circuit Layout Outline */}
                    {(() => {
                      const selectedCirc = CIRCUITS.find((c) => c.id === circuitId) || CIRCUITS[0];
                      return (
                        <div className="bg-neutral-950/80 rounded-xl p-2.5 border border-white/5 my-2">
                          <TrackLayoutPreview
                            circuit={selectedCirc}
                            height={120}
                            strokeColor="#ef4444"
                            strokeWidth={3}
                            showStartFinish={true}
                            showDirection={true}
                            showTurnLabels={true}
                          />
                        </div>
                      );
                    })()}

                    <p className="text-xs text-neutral-400">
                      {CIRCUITS.find((c) => c.id === circuitId)?.description}
                    </p>
                  </div>

                  {/* Laps */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-neutral-300">
                        Race Distance (Laps)
                      </label>
                      <span className="font-mono text-amber-400 font-bold text-sm">{laps} Laps</span>
                    </div>
                    <div className="flex gap-2">
                      {[3, 5, 10, 15, 20].map((lap) => (
                        <button
                          key={lap}
                          onClick={() => setLaps(lap)}
                          className={`flex-1 py-2.5 rounded-xl border font-mono text-xs font-bold transition-all ${
                            laps === lap
                              ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/30'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                          }`}
                        >
                          {lap} Laps
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bots Setting */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-cyan-400" />
                        AI Bots Count (0 - 19)
                      </label>
                      <span className="font-mono text-cyan-400 font-bold text-xs">
                        {botCount} Bots (Total: {botCount + 1}/20 Cars)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="19"
                      value={botCount}
                      onChange={(e) => setBotCount(parseInt(e.target.value) || 0)}
                      className="w-full accent-cyan-400 cursor-pointer h-2 bg-neutral-800 rounded-lg"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                      <span>0 Bots (Players only)</span>
                      <span>10 Bots (Half Grid)</span>
                      <span>19 Bots (Full 20-Car Grid)</span>
                    </div>
                  </div>

                  {/* Bot Difficulty */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-neutral-300">
                      Bot Difficulty
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['rookie', 'pro', 'legend'] as const).map((diff) => (
                        <button
                          key={diff}
                          onClick={() => setBotDifficulty(diff)}
                          className={`py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all ${
                            botDifficulty === diff
                              ? 'bg-red-600 border-red-500 text-white shadow-md'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                          }`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Teammate Option */}
                  <div className="md:col-span-2 p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">Add Constructor Teammates</div>
                      <div className="text-xs text-neutral-400">
                        When enabled, each driver gets an AI teammate car on the grid in matching livery.
                      </div>
                    </div>
                    <button
                      onClick={() => setHasTeammates(!hasTeammates)}
                      className={`px-5 py-2 rounded-xl font-bold text-xs border transition-all ${
                        hasTeammates
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-neutral-900 border-neutral-700 text-neutral-400'
                      }`}
                    >
                      {hasTeammates ? 'Teammates: YES' : 'Teammates: NO'}
                    </button>
                  </div>
                </div>

                {/* Host Submit Button */}
                <div className="pt-4 border-t border-neutral-800 flex justify-end">
                  <button
                    onClick={handleHostRoom}
                    disabled={isConnecting}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-red-900/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <RotateCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Crown className="w-5 h-5" />
                    )}
                    Confirm Settings & Host Room (Get 4-Digit Code)
                  </button>
                </div>
              </div>
            )}

            {/* TAB: Join Room */}
            {activeTab === 'join' && (
              <div className="max-w-2xl mx-auto w-full py-4 space-y-6">
                {/* 1. Instant Quick Match */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-red-950/40 via-neutral-900 to-amber-950/30 border border-red-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-mono text-[10px] uppercase font-bold border border-red-500/30">
                        Zero Wait
                      </span>
                      <h4 className="text-base font-black text-white">Instant Quick Match</h4>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Instantly join an active public race room, or spin one up automatically. Always connects!
                    </p>
                  </div>

                  <button
                    onClick={handleQuickMatch}
                    disabled={isConnecting}
                    className="shrink-0 px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-900/40 transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isConnecting ? <RotateCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                    <span>⚡ Quick Match</span>
                  </button>
                </div>

                {/* 2. Live Public Lobbies List */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                        Live Public Grand Prix Rooms ({publicRooms.length})
                      </h4>
                    </div>
                    <button
                      onClick={loadPublicRooms}
                      disabled={isLoadingRooms}
                      className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 font-mono transition-colors"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isLoadingRooms ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {publicRooms.length === 0 ? (
                    <div className="py-6 text-center text-xs text-neutral-500 flex flex-col items-center gap-1 font-mono">
                      <span>No other open lobbies currently waiting.</span>
                      <span className="text-[11px] text-neutral-600">Click Quick Match above or Host Room to begin!</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                      {publicRooms.map((r) => {
                        const circuit = CIRCUITS.find((c) => c.id === r.circuitId) || CIRCUITS[0];
                        const hostPlayer = r.players.find((p) => p.isHost) || r.players[0];
                        return (
                          <div
                            key={r.code}
                            className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between hover:border-neutral-700 transition-all text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 rounded-lg bg-neutral-950 font-mono font-black text-amber-400 border border-neutral-800 text-sm">
                                #{r.code}
                              </span>
                              <div>
                                <span className="font-bold text-white block">{circuit.name}</span>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  {r.laps} Laps • Host: {hostPlayer?.name || 'Driver'} • {r.players.length}/20 Drivers
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleJoinSpecificRoom(r.code)}
                              disabled={isConnecting}
                              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-md cursor-pointer"
                            >
                              Join Room
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Manual 4-Digit Room Code */}
                <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Join Private Room via 4-Digit Code</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Enter the 4-digit room code from a friend or league host.
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <input
                      type="text"
                      maxLength={4}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                      placeholder="e.g. 7492"
                      className="w-48 h-12 bg-neutral-900 border-2 border-neutral-700 focus:border-red-500 rounded-xl text-center text-2xl font-mono font-black text-white tracking-[0.4em] uppercase focus:outline-none shadow-inner"
                    />
                  </div>

                  <button
                    onClick={handleJoinRoom}
                    disabled={isConnecting || joinCode.trim().length !== 4}
                    className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    {isConnecting ? 'Connecting...' : 'Join with Code'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
