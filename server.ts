import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

export interface RoomPlayer {
  id: string;
  ws?: WebSocket;
  name: string;
  carNumber: number;
  teamId: string;
  teamColor: string;
  accentColor: string;
  isHost: boolean;
  isReady: boolean;
  gridSlot: number;
  progress: number;
  lap: number;
  speedKmh: number;
  lateralOffset: number;
  position: number;
  finished: boolean;
  finishTime?: number;
  lastActive: number;
}

export interface ChatMessage {
  sender: string;
  carNumber: number;
  teamColor: string;
  text: string;
  timestamp: number;
}

export interface RoomPublicState {
  code: string;
  hostId: string;
  circuitId: string;
  laps: number;
  botCount: number;
  botDifficulty: 'rookie' | 'pro' | 'legend';
  hasTeammates: boolean;
  status: 'lobby' | 'countdown' | 'racing' | 'finished';
  players: {
    id: string;
    name: string;
    carNumber: number;
    teamId: string;
    teamColor: string;
    accentColor: string;
    isHost: boolean;
    isReady: boolean;
    gridSlot: number;
    progress: number;
    lap: number;
    speedKmh: number;
    position: number;
    finished: boolean;
    finishTime?: number;
  }[];
  createdAt: number;
}

interface Room {
  code: string;
  hostId: string;
  circuitId: string;
  laps: number;
  botCount: number;
  botDifficulty: 'rookie' | 'pro' | 'legend';
  hasTeammates: boolean;
  status: 'lobby' | 'countdown' | 'racing' | 'finished';
  players: Map<string, RoomPlayer>;
  chatMessages: ChatMessage[];
  createdAt: number;
  lastActive: number;
}

const rooms = new Map<string, Room>();
const socketToRoom = new Map<WebSocket, { code: string; playerId: string }>();

function generate4DigitCode(): string {
  let attempts = 0;
  while (attempts < 100) {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    if (!rooms.has(code)) return code;
    attempts++;
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

function getPublicRoomState(room: Room): RoomPublicState {
  return {
    code: room.code,
    hostId: room.hostId,
    circuitId: room.circuitId,
    laps: room.laps,
    botCount: room.botCount,
    botDifficulty: room.botDifficulty,
    hasTeammates: room.hasTeammates,
    status: room.status,
    createdAt: room.createdAt,
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      carNumber: p.carNumber,
      teamId: p.teamId,
      teamColor: p.teamColor,
      accentColor: p.accentColor,
      isHost: p.isHost,
      isReady: p.isReady,
      gridSlot: p.gridSlot,
      progress: p.progress,
      lap: p.lap,
      speedKmh: p.speedKmh,
      position: p.position,
      finished: p.finished,
      finishTime: p.finishTime,
    })),
  };
}

function broadcastToRoom(room: Room, message: object, excludeWs?: WebSocket) {
  const data = JSON.stringify(message);
  for (const player of room.players.values()) {
    if (player.ws && player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      try {
        player.ws.send(data);
      } catch (err) {
        console.error('Error broadcasting to player', player.id, err);
      }
    }
  }
}

// Internal Helper Functions shared between WebSocket & REST
function createRoomCore(params: any, ws?: WebSocket): { room: Room; playerId: string; code: string } {
  const playerId = 'p_' + Math.random().toString(36).substring(2, 9);
  const p = params.player || {};
  const hostName = p.name || params.hostName || params.playerName || 'Driver 1';
  const carNumber = Number(p.carNumber ?? params.carNumber ?? 1);
  const teamId = p.teamId || params.teamId || 'ferrari';
  const teamColor = p.teamColor || params.teamColor || '#E80020';
  const accentColor = p.accentColor || params.accentColor || '#FFFFFF';

  const code = generate4DigitCode();
  const safeBotCount = Math.max(0, Math.min(19, Number(params.botCount ?? 15)));

  const room: Room = {
    code,
    hostId: playerId,
    circuitId: params.circuitId || 'bahrain',
    laps: Math.max(1, Math.min(20, Number(params.laps ?? 5))),
    botCount: safeBotCount,
    botDifficulty: params.botDifficulty || 'pro',
    hasTeammates: Boolean(params.hasTeammates ?? true),
    status: 'lobby',
    players: new Map(),
    chatMessages: [],
    createdAt: Date.now(),
    lastActive: Date.now(),
  };

  const hostPlayer: RoomPlayer = {
    id: playerId,
    ws,
    name: hostName,
    carNumber,
    teamId,
    teamColor,
    accentColor,
    isHost: true,
    isReady: true,
    gridSlot: 1,
    progress: 0,
    lap: 1,
    speedKmh: 0,
    lateralOffset: 0,
    position: 1,
    finished: false,
    lastActive: Date.now(),
  };

  room.players.set(playerId, hostPlayer);
  rooms.set(code, room);
  if (ws) {
    socketToRoom.set(ws, { code, playerId });
  }

  return { room, playerId, code };
}

function joinRoomCore(params: any, ws?: WebSocket): { success: boolean; error?: string; room?: Room; playerId?: string } {
  const code = String(params.code || '').trim().toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return { success: false, error: `Grand Prix Room ${code} not found. Please verify the 4-digit code.` };
  }

  if (room.status === 'racing') {
    return { success: false, error: `Grand Prix ${code} is currently in progress!` };
  }

  if (room.players.size >= 20) {
    return { success: false, error: `Room ${code} is full (max 20 drivers)!` };
  }

  const playerId = 'p_' + Math.random().toString(36).substring(2, 9);
  const p = params.player || {};
  const playerName = p.name || params.playerName || 'Rival Driver';
  const carNumber = Number(p.carNumber ?? params.carNumber ?? 87);
  const teamId = p.teamId || params.teamId || 'mercedes';
  const teamColor = p.teamColor || params.teamColor || '#00A19B';
  const accentColor = p.accentColor || params.accentColor || '#FFFFFF';

  // Adjust bot count so total cars (players + bots) <= 20
  const maxBots = Math.max(0, 20 - (room.players.size + 1));
  if (room.botCount > maxBots) {
    room.botCount = maxBots;
  }

  const newPlayer: RoomPlayer = {
    id: playerId,
    ws,
    name: playerName,
    carNumber,
    teamId,
    teamColor,
    accentColor,
    isHost: false,
    isReady: false,
    gridSlot: room.players.size + 1,
    progress: 0,
    lap: 1,
    speedKmh: 0,
    lateralOffset: 0,
    position: room.players.size + 1,
    finished: false,
    lastActive: Date.now(),
  };

  room.players.set(playerId, newPlayer);
  room.lastActive = Date.now();
  if (ws) {
    socketToRoom.set(ws, { code, playerId });
  }

  broadcastToRoom(room, {
    type: 'room_updated',
    payload: { room: getPublicRoomState(room) },
  });

  return { success: true, room, playerId };
}

// WebSocket connection lifecycle
wss.on('connection', (ws: WebSocket) => {
  let boundPlayerId: string | null = null;
  let boundCode: string | null = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'create_room') {
        const { room, playerId, code } = createRoomCore(msg.payload || {}, ws);
        boundPlayerId = playerId;
        boundCode = code;

        ws.send(
          JSON.stringify({
            type: 'room_created',
            payload: {
              room: getPublicRoomState(room),
              yourId: playerId,
              playerId,
            },
          })
        );
      } else if (msg.type === 'join_room') {
        const res = joinRoomCore(msg.payload || {}, ws);
        if (!res.success || !res.room || !res.playerId) {
          ws.send(
            JSON.stringify({
              type: 'error',
              payload: { message: res.error || 'Failed to join room' },
            })
          );
          return;
        }

        boundPlayerId = res.playerId;
        boundCode = res.room.code;

        ws.send(
          JSON.stringify({
            type: 'room_joined',
            payload: {
              room: getPublicRoomState(res.room),
              yourId: res.playerId,
              playerId: res.playerId,
            },
          })
        );
      } else if (msg.type === 'update_settings') {
        const link = socketToRoom.get(ws);
        if (!link) return;
        const room = rooms.get(link.code);
        if (!room || room.hostId !== link.playerId) return;

        const { circuitId, laps, botCount, botDifficulty, hasTeammates } = msg.payload || {};
        if (circuitId) room.circuitId = circuitId;
        if (typeof laps === 'number') room.laps = Math.max(1, Math.min(20, laps));
        if (typeof botCount === 'number') {
          const maxBots = Math.max(0, 20 - room.players.size);
          room.botCount = Math.min(maxBots, Math.max(0, botCount));
        }
        if (botDifficulty) room.botDifficulty = botDifficulty;
        if (typeof hasTeammates === 'boolean') room.hasTeammates = hasTeammates;
        room.lastActive = Date.now();

        broadcastToRoom(room, {
          type: 'room_updated',
          payload: { room: getPublicRoomState(room) },
        });
      } else if (msg.type === 'toggle_ready') {
        const link = socketToRoom.get(ws);
        if (!link) return;
        const room = rooms.get(link.code);
        if (!room) return;
        const player = room.players.get(link.playerId);
        if (player) {
          player.isReady = !player.isReady;
          room.lastActive = Date.now();
          broadcastToRoom(room, {
            type: 'room_updated',
            payload: { room: getPublicRoomState(room) },
          });
        }
      } else if (msg.type === 'start_race') {
        const link = socketToRoom.get(ws);
        if (!link) return;
        const room = rooms.get(link.code);
        if (!room || room.hostId !== link.playerId) return;

        room.status = 'racing';
        room.lastActive = Date.now();

        let slot = 1;
        for (const p of room.players.values()) {
          p.gridSlot = slot++;
          p.lap = 1;
          p.progress = 0;
          p.speedKmh = 0;
          p.finished = false;
        }

        broadcastToRoom(room, {
          type: 'race_started',
          payload: {
            room: getPublicRoomState(room),
            circuitId: room.circuitId,
            laps: room.laps,
            botCount: room.botCount,
            botDifficulty: room.botDifficulty,
            hasTeammates: room.hasTeammates,
          },
        });
      } else if (msg.type === 'telemetry') {
        const link = socketToRoom.get(ws);
        if (!link) return;
        const room = rooms.get(link.code);
        if (!room || room.status !== 'racing') return;
        const player = room.players.get(link.playerId);
        if (!player) return;

        const { progress, lap, speedKmh, lateralOffset, heading, carPos, position } = msg.payload || {};
        player.progress = progress ?? player.progress;
        player.lap = lap ?? player.lap;
        player.speedKmh = speedKmh ?? player.speedKmh;
        player.lateralOffset = lateralOffset ?? player.lateralOffset;
        player.position = position ?? player.position;
        player.lastActive = Date.now();

        broadcastToRoom(
          room,
          {
            type: 'peer_telemetry',
            payload: {
              playerId: player.id,
              name: player.name,
              carNumber: player.carNumber,
              teamId: player.teamId,
              teamColor: player.teamColor,
              accentColor: player.accentColor,
              progress,
              lap,
              speedKmh,
              lateralOffset,
              heading,
              carPos,
              position,
            },
          },
          ws
        );
      } else if (msg.type === 'player_finished') {
        const link = socketToRoom.get(ws);
        if (!link) return;
        const room = rooms.get(link.code);
        if (!room) return;
        const player = room.players.get(link.playerId);
        if (player) {
          player.finished = true;
          player.finishTime = msg.payload?.finishTime || Date.now();
          broadcastToRoom(room, {
            type: 'player_finished',
            payload: {
              playerId: player.id,
              name: player.name,
              finishTime: player.finishTime,
            },
          });
        }
      } else if (msg.type === 'chat_message') {
        const link = socketToRoom.get(ws);
        if (!link) return;
        const room = rooms.get(link.code);
        if (!room) return;
        const player = room.players.get(link.playerId);
        if (player && msg.payload?.text) {
          const chatMsg: ChatMessage = {
            sender: player.name,
            carNumber: player.carNumber,
            teamColor: player.teamColor,
            text: String(msg.payload.text).slice(0, 140),
            timestamp: Date.now(),
          };
          room.chatMessages.push(chatMsg);
          if (room.chatMessages.length > 50) room.chatMessages.shift();
          broadcastToRoom(room, {
            type: 'chat_broadcast',
            payload: chatMsg,
          });
        }
      } else if (msg.type === 'leave_room') {
        handleDisconnect(ws);
      }
    } catch (e) {
      console.error('WebSocket parse error:', e);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });
});

function handleDisconnect(ws: WebSocket) {
  const link = socketToRoom.get(ws);
  if (!link) return;
  socketToRoom.delete(ws);

  const room = rooms.get(link.code);
  if (!room) return;

  room.players.delete(link.playerId);

  if (room.players.size === 0) {
    rooms.delete(link.code);
  } else {
    if (room.hostId === link.playerId) {
      const nextPlayer = Array.from(room.players.values())[0];
      if (nextPlayer) {
        room.hostId = nextPlayer.id;
        nextPlayer.isHost = true;
      }
    }
    broadcastToRoom(room, {
      type: 'room_updated',
      payload: { room: getPublicRoomState(room) },
    });
  }
}

// Automatic room closure after 30 minutes of inactivity if no one else joined
const ROOM_INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

// Periodic check for expired single-player lobbies
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    // If room has only 1 player (or empty) and has been active for >= 30 minutes
    if (room.players.size <= 1 && now - room.createdAt >= ROOM_INACTIVITY_LIMIT_MS) {
      console.log(`[Multiplayer] Room ${code} auto-closed after 30 minutes with no other players joining.`);
      broadcastToRoom(room, {
        type: 'room_closed',
        payload: { code, reason: 'Room automatically closed after 30 minutes of inactivity.' },
      });
      rooms.delete(code);
    }
  }
}, 30000);

// REST Endpoints for Fallback & Universal Compatibility
// 1. Get all public active multiplayer rooms (filtering out expired single-player lobbies)
app.get('/api/rooms', (_req, res) => {
  const now = Date.now();
  const activeRooms = Array.from(rooms.values())
    .filter((r) => {
      if (r.status !== 'lobby' || r.players.size >= 20) return false;
      // Exclude rooms older than 30 minutes if nobody else joined
      if (r.players.size <= 1 && now - r.createdAt >= ROOM_INACTIVITY_LIMIT_MS) return false;
      return true;
    })
    .map((r) => getPublicRoomState(r));
  res.json({ success: true, rooms: activeRooms });
});

// 2. Quick Join or Auto-Matchmaking: joins an open lobby or spins one up seamlessly
app.post('/api/rooms/quick-join', (req, res) => {
  const openRoom = Array.from(rooms.values()).find(
    (r) => r.status === 'lobby' && r.players.size < 20
  );

  if (openRoom) {
    const result = joinRoomCore({ ...req.body, code: openRoom.code });
    if (result.success && result.room && result.playerId) {
      return res.json({
        success: true,
        code: result.room.code,
        yourId: result.playerId,
        playerId: result.playerId,
        room: getPublicRoomState(result.room),
        isNew: false,
      });
    }
  }

  // No open room found: create one right away
  const { room, playerId, code } = createRoomCore(req.body);
  return res.json({
    success: true,
    code,
    yourId: playerId,
    playerId,
    room: getPublicRoomState(room),
    isNew: true,
  });
});

app.post('/api/rooms/create', (req, res) => {
  const { room, playerId, code } = createRoomCore(req.body);
  res.json({
    success: true,
    code,
    yourId: playerId,
    playerId,
    room: getPublicRoomState(room),
  });
});

app.post('/api/rooms/join', (req, res) => {
  const result = joinRoomCore(req.body);
  if (!result.success || !result.room || !result.playerId) {
    return res.status(400).json({ success: false, error: result.error || 'Failed to join room' });
  }
  res.json({
    success: true,
    code: result.room.code,
    yourId: result.playerId,
    playerId: result.playerId,
    room: getPublicRoomState(result.room),
  });
});

// Cloud Career Persistence Backend Store (100% Guaranteed sync fallback)
const cloudCareers = new Map<string, any>();

app.post('/api/cloud/save', (req, res) => {
  const data = req.body || {};
  const uid = String(data.uid || 'driver_default');
  cloudCareers.set(uid, {
    ...data,
    uid,
    serverTimestamp: Date.now(),
  });
  res.json({ success: true, uid, message: 'Career saved to cloud successfully.' });
});

app.get('/api/cloud/load/:uid', (req, res) => {
  const uid = String(req.params.uid || 'driver_default');
  const career = cloudCareers.get(uid);
  if (!career) {
    // Return any existing career or default
    const firstCareer = Array.from(cloudCareers.values())[0];
    if (firstCareer) {
      return res.json({ success: true, career: firstCareer });
    }
    return res.status(404).json({ success: false, error: 'No cloud save found.' });
  }
  res.json({ success: true, career });
});

// Helper: Deep Server-Side F1 Telemetry & Reasoning Auditor
function auditReportAgainstTelemetry(params: {
  title: string;
  content: string;
  category?: string;
  isPrediction?: boolean;
  predictedTarget?: string;
  predictionOutcomeType?: string;
  isViralRumor?: boolean;
  customRumorType?: string;
  customRumorClaim?: string;
  seasonContext?: any;
}) {
  const rawTitle = String(params.title || '').trim();
  const rawContent = String(params.content || '').trim();
  const rawClaim = String(params.customRumorClaim || '').trim();
  const fullText = `${rawTitle} ${rawContent} ${rawClaim}`.trim();
  const lowerText = fullText.toLowerCase();
  const words = fullText
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const wordCount = words.length;

  const ctx = params.seasonContext || {};
  const topDrivers: Array<{ id: string; name: string; team: string; points: number; rating: number }> =
    Array.isArray(ctx.topDriversStandings) ? ctx.topDriversStandings : [];
  const constructors: Array<{ id: string; name: string; points: number }> =
    Array.isArray(ctx.constructorsStandings) ? ctx.constructorsStandings : [];
  const races: Array<{ round: number; circuitName: string; winner: string; playerFinishedPosition: number }> =
    Array.isArray(ctx.completedRacesHistory) ? ctx.completedRacesHistory : [];
  const upcoming = ctx.upcomingCircuit || {};
  const playerProfile = ctx.playerProfile || {};

  const notes: string[] = [];

  // 1. Check for gibberish / keyboard mashing / ultra-short lazy text
  const vowelCount = (lowerText.match(/[aeiouy]/g) || []).length;
  const alphaCount = (lowerText.match(/[a-z]/g) || []).length;
  const vowelRatio = alphaCount > 0 ? vowelCount / alphaCount : 0;
  const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
  const uniqueRatio = wordCount > 0 ? uniqueWords / wordCount : 0;

  const isGibberish =
    alphaCount < 6 ||
    vowelRatio < 0.14 ||
    vowelRatio > 0.78 ||
    (wordCount >= 10 && uniqueRatio < 0.3);

  if (isGibberish) {
    return {
      accuracyScore: 12,
      qualityScore: 10,
      reasoningScore: 8,
      verdict: 'inaccurate_flop',
      verdictLabel: 'Unintelligible / Spam Report Rejected',
      factCheckNotes: [
        'AI Editor Bot detected gibberish, repetitive filler, or non-motorsport text.',
        'Reports must contain coherent Formula 1 journalism and factual analysis.',
      ],
      readerReaction:
        '"Is this a typo? Unsubscribing immediately until real F1 journalism returns." — Angry Paddock Subscriber',
    };
  }

  // 2. Fact-Checking against Ground-Truth Season Telemetry & Full 2026 F1 Grid
  let accuracyScore = 82; // Baseline for coherent F1 reporting
  let contradictionsFound = 0;
  let verifiedFactsCount = 0;

  const allKnownDriverTokens = [
    'verstappen', 'max', 'norris', 'lando', 'leclerc', 'charles', 'hamilton', 'lewis',
    'piastri', 'oscar', 'russell', 'george', 'alonso', 'fernando', 'sainz', 'carlos',
    'lawson', 'liam', 'antonelli', 'kimi', 'stroll', 'lance', 'hulkenberg', 'nico',
    'bortoleto', 'gabriel', 'albon', 'alex', 'gasly', 'pierre', 'doohan', 'jack',
    'tsunoda', 'yuki', 'hadjar', 'isack', 'bearman', 'ollie', 'oliver', 'ocon', 'esteban',
    String(playerProfile.driverName || '').toLowerCase(),
  ].filter((t) => t.length >= 3);

  const allKnownTeamTokens = [
    'mclaren', 'red bull', 'redbull', 'ferrari', 'mercedes', 'aston martin', 'williams',
    'audi', 'sauber', 'alpine', 'haas', 'racing bulls', 'rb', 'cadillac', 'andretti',
    String(playerProfile.teamName || '').toLowerCase(),
  ].filter((t) => t.length >= 2);

  // Check mentioned drivers & teams from telemetry + full roster
  const mentionedDrivers = topDrivers.filter((d) => {
    const cleanName = d.name.replace(' (Player)', '').toLowerCase();
    const parts = cleanName.split(' ').filter((p) => p.length >= 3);
    return parts.some((part) => lowerText.includes(part));
  });

  const mentionedTeams = constructors.filter((c) => {
    const cleanTeam = c.name.toLowerCase();
    const parts = cleanTeam.split(' ').filter((p) => p.length >= 3 && p !== 'team' && p !== 'racing');
    return parts.some((part) => lowerText.includes(part));
  });

  const matchedAnyGridDriver = allKnownDriverTokens.some((tok) => lowerText.includes(tok));
  const matchedAnyGridTeam = allKnownTeamTokens.some((tok) => lowerText.includes(tok));

  if (mentionedDrivers.length > 0 || mentionedTeams.length > 0 || matchedAnyGridDriver || matchedAnyGridTeam) {
    verifiedFactsCount += 1;
    accuracyScore += 6;
    const names = [
      ...mentionedDrivers.map((d) => d.name.replace(' (Player)', '')),
      ...mentionedTeams.map((t) => t.name),
    ].slice(0, 3);
    notes.push(
      names.length > 0
        ? `AI Bot verified official 2026 paddock subjects: ${names.join(', ')}.`
        : 'AI Bot verified official 2026 FIA Formula 1 Championship driver/team references.'
    );
  }

  // If custom viral rumor is active, audit the custom rumor premise
  if (params.isViralRumor && rawClaim) {
    verifiedFactsCount += 1;
    accuracyScore += 6;
    notes.push(`🔥 Custom Paddock Rumor Logged: "${rawClaim}" — Plausibility & insider narrative audited.`);
  }

  // Also check if predictedTarget is mentioned or selected
  if (params.isPrediction && params.predictedTarget) {
    verifiedFactsCount += 1;
    notes.push(`Prediction target locked & audited: ${params.predictedTarget} (${(params.predictionOutcomeType || 'win').toUpperCase()}).`);
  }

  // Check circuit reference
  if (
    upcoming.name &&
    upcoming.name
      .toLowerCase()
      .split(' ')
      .filter((w: string) => w.length >= 4 && w !== 'grand' && w !== 'prix' && w !== 'circuit' && w !== 'international')
      .some((w: string) => lowerText.includes(w))
  ) {
    verifiedFactsCount += 1;
    accuracyScore += 4;
    notes.push(`Verified upcoming circuit telemetry context for ${upcoming.name}.`);
  }

  // Check for blatant false/exaggerated numbers (e.g., Toby Vance's 999 points / 500 points / 45 corners or user-written fake stats)
  if (
    lowerText.includes('999 points') ||
    lowerText.includes('500 points') ||
    lowerText.includes('1000 points') ||
    lowerText.includes('45 corners') ||
    lowerText.includes('100 corners')
  ) {
    contradictionsFound += 2;
    accuracyScore -= 48;
    notes.push(
      'FACT CHECK FAILURE: Article cites impossible or fabricated championship points/circuit corner numbers that contradict FIA telemetry.'
    );
  }

  // Check claims about Championship Leader if standings exist (skip strict leader penalty if user is writing a custom rumor)
  const p1Driver = topDrivers[0];
  const p1Team = constructors[0];
  if (
    !params.isViralRumor &&
    p1Driver &&
    p1Driver.points > 0 &&
    (lowerText.includes('leads the championship') ||
      lowerText.includes('leading the championship') ||
      lowerText.includes('championship leader') ||
      lowerText.includes('leads the standings'))
  ) {
    const p1Parts = p1Driver.name
      .replace(' (Player)', '')
      .toLowerCase()
      .split(' ')
      .filter((p) => p.length >= 3);
    const p1TeamParts = p1Team
      ? p1Team.name
          .toLowerCase()
          .split(' ')
          .filter((p) => p.length >= 3)
      : [];
    const mentionsTrueLeader =
      p1Parts.some((p) => lowerText.includes(p)) ||
      p1TeamParts.some((p) => lowerText.includes(p));

    if (mentionsTrueLeader) {
      verifiedFactsCount += 1;
      accuracyScore += 10;
      notes.push(
        `Verified standings claim: ${p1Driver.name.replace(' (Player)', '')} (${p1Driver.points} PTS) / ${p1Team?.name} accurately referenced.`
      );
    } else if (mentionedDrivers.length > 0 && mentionedDrivers[0].points < p1Driver.points) {
      contradictionsFound += 1;
      accuracyScore -= 32;
      notes.push(
        `STANDINGS DISCREPANCY: Article claims ${mentionedDrivers[0].name.replace(' (Player)', '')} leads the standings, but ${p1Driver.name.replace(' (Player)', '')} is actually P1 with ${p1Driver.points} PTS.`
      );
    }
  }

  // Check claims about Last Race Winner if races have been completed
  const lastRace = races.length > 0 ? races[races.length - 1] : null;
  if (
    !params.isViralRumor &&
    lastRace &&
    (lowerText.includes('won the last race') ||
      lowerText.includes(`won at ${lastRace.circuitName.toLowerCase()}`) ||
      lowerText.includes(`victory at ${lastRace.circuitName.toLowerCase()}`))
  ) {
    const winnerParts = lastRace.winner
      .toLowerCase()
      .split(' ')
      .filter((p) => p.length >= 3);
    const mentionsTrueWinner = winnerParts.some((p) => lowerText.includes(p));
    if (mentionsTrueWinner) {
      verifiedFactsCount += 1;
      accuracyScore += 10;
      notes.push(
        `Verified race result: ${lastRace.winner}'s victory at ${lastRace.circuitName} confirmed.`
      );
    } else if (mentionedDrivers.length > 0) {
      contradictionsFound += 1;
      accuracyScore -= 32;
      notes.push(
        `RACE RESULT ERROR: ${lastRace.winner} won at ${lastRace.circuitName}, contradicting the article's claim.`
      );
    }
  }

  // Check if numbers mentioned in the article match actual points, turns, or ratings
  const numbersInText = (fullText.match(/\b\d+\b/g) || []).map((n) => Number(n));
  const validNumbers = new Set<number>([
    2026, 2027, 2028,
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 22, 24,
    Number(ctx.currentRoundNumber || 1),
    Number(upcoming.turns || 0),
    Math.round(Number(upcoming.lengthKm || 0)),
    Number(playerProfile.driverRating || 0),
    Number(playerProfile.points || 0),
    ...topDrivers.map((d) => Number(d.points)),
    ...topDrivers.map((d) => Math.round(Number(d.rating))),
    ...constructors.map((c) => Number(c.points)),
  ]);

  let matchedStats = 0;
  for (const num of numbersInText) {
    if (num > 22 && num !== 2026 && num !== 2027 && num !== 2028) {
      if (validNumbers.has(num)) {
        matchedStats += 1;
      } else if (num > 360 && !params.isViralRumor) {
        contradictionsFound += 1;
        accuracyScore -= 25;
      }
    }
  }
  if (matchedStats > 0) {
    verifiedFactsCount += 1;
    accuracyScore += Math.min(12, matchedStats * 5);
    notes.push('Verified exact telemetry statistics (points, driver rating, or circuit turns) cited in the text.');
  }

  // 3. Evaluate Compelling Writing Quality & Analytical Reasoning
  const causalKeywords = [
    'because',
    'due to',
    'thanks to',
    'since',
    'therefore',
    'thus',
    'allows',
    'enables',
    'advantage',
    'edge',
    'reason',
    'factor',
    'key',
    'crucial',
    'critical',
    'given',
    'proven',
    'consistently',
    'consistent',
    'momentum',
    'suits',
    'rewards',
    'with',
    'has',
    'have',
    'strong',
    'superior',
    'better',
    'best',
    'fastest',
    'faster',
    'great',
    'good',
    'dominant',
    'dominate',
    'will',
    'should',
    'can',
    'plans',
    'planning',
    'secretly',
    'sources',
    'insiders',
    'reportedly',
    'developing',
    'transferring',
    'moving',
    'starting',
  ];

  const motorsportKeywords = [
    'aero',
    'aerodynamic',
    'downforce',
    'drag',
    'speed',
    'fast',
    'fastest',
    'quick',
    'quicker',
    'car',
    'cars',
    'drs',
    'brake',
    'brakes',
    'braking',
    'corner',
    'corners',
    'cornering',
    'turn',
    'turns',
    'tire',
    'tires',
    'tyre',
    'tyres',
    'degradation',
    'grip',
    'traction',
    'pace',
    'qualifying',
    'podium',
    'win',
    'won',
    'winner',
    'victory',
    'lead',
    'leader',
    'leading',
    'first',
    'p1',
    'p2',
    'p3',
    'top',
    'points',
    'standings',
    'championship',
    'champion',
    'title',
    'rating',
    'engine',
    'power',
    'chassis',
    'overtake',
    'pass',
    'sector',
    'straight',
    'setup',
    'strategy',
    'pit',
    'telemetry',
    'upgrade',
    'upgrades',
    'driver',
    'team',
    'teams',
    'race',
    'racing',
    'track',
    'circuit',
    'lap',
    'laps',
    'grid',
    'pole',
    'handling',
    'ers',
    'slipstream',
    'form',
    'skill',
    'transfer',
    'transferring',
    'contract',
    'buyout',
    'seat',
    'technique',
    'techniques',
    'technology',
    'tech',
    'wind tunnel',
    'floor',
    'suspension',
    'rumor',
    'scoop',
    'f1',
    'formula',
    'fia',
    'factory',
  ];

  const matchedCausal = causalKeywords.filter((k) => lowerText.includes(k));
  const matchedMotorsport = motorsportKeywords.filter((k) =>
    lowerText.includes(k)
  );

  // Explicit check if the writer explicitly says "no reasons needed" or "idk why"
  const refusesReasons =
    lowerText.includes('no other reasons') ||
    lowerText.includes('no reasons needed') ||
    lowerText.includes('idk why') ||
    lowerText.includes('dont know why');

  // Calculate Quality Score (rewards coherent F1 sentences & rich detail)
  let qualityScore = 68;
  if (wordCount < 4) {
    qualityScore = 28;
    accuracyScore = Math.min(accuracyScore, 48);
    notes.push(
      'Article is far too brief (< 4 words). Write at least a complete sentence about the race, drivers, or rumor.'
    );
  } else if (wordCount < 9) {
    qualityScore = Math.min(
      85,
      62 + matchedMotorsport.length * 6 + verifiedFactsCount * 5
    );
  } else {
    qualityScore = Math.min(
      97,
      70 +
        Math.min(16, Math.floor(wordCount / 3)) +
        Math.min(16, matchedMotorsport.length * 4)
    );
  }

  // Calculate Reasoning Score (rewards explaining why a result, rumor, or prediction happens)
  let reasoningScore = 65;
  if (refusesReasons) {
    reasoningScore = 20;
    qualityScore = Math.min(qualityScore, 40);
    notes.push(
      'WEAK REASONING: Author dismissed the need for analytical reasons instead of backing claims with F1 analysis.'
    );
  } else {
    reasoningScore = Math.min(
      98,
      58 +
        matchedCausal.length * 9 +
        matchedMotorsport.length * 6 +
        (wordCount >= 12 ? 10 : 0) +
        (verifiedFactsCount > 0 ? 8 : 0)
    );
  }

  if (matchedMotorsport.length >= 1 && !refusesReasons) {
    notes.push(
      `AI Bot verified motorsport analysis (${matchedMotorsport.slice(0, 5).join(', ')}).`
    );
  } else if (params.isPrediction && reasoningScore < 58) {
    notes.push(
      'Tip: Mentioning car pace, aero, braking, or driver form makes your prediction even more compelling to readers.'
    );
  }

  // Clamp scores to [10, 98]
  accuracyScore = Math.max(
    10,
    Math.min(98, Math.round(accuracyScore + (verifiedFactsCount >= 2 ? 6 : 0)))
  );
  qualityScore = Math.max(10, Math.min(98, Math.round(qualityScore)));
  reasoningScore = Math.max(10, Math.min(98, Math.round(reasoningScore)));

  // Determine Verdict
  let verdict: 'verified_scoop' | 'solid_report' | 'mediocre' | 'inaccurate_flop' =
    'solid_report';
  let verdictLabel = 'Accurate & Solid Paddock Report';
  let readerReaction =
    '"Good factual reporting on the championship situation, looking forward to the race." — Paddock Subscriber';

  if (contradictionsFound > 0 || accuracyScore < 50) {
    verdict = 'inaccurate_flop';
    verdictLabel = 'Debunked / Inaccurate Report';
    readerReaction =
      '"These stats contradict official FIA timing screens! Check your facts before publishing!" — Disappointed Subscriber';
  } else if (
    accuracyScore >= 74 &&
    qualityScore >= 70 &&
    reasoningScore >= 68
  ) {
    verdict = 'verified_scoop';
    verdictLabel = params.isViralRumor
      ? 'Bombshell Viral Paddock Rumor'
      : params.isPrediction
      ? 'Compelling & Well-Reasoned Prediction'
      : 'Verified Tier-1 Paddock Scoop';
    readerReaction = params.isViralRumor
      ? '"If this paddock rumor turns out to be true, it will shake up the entire Formula 1 grid!" — Hooked VIP Subscriber'
      : '"Spot-on telemetry analysis and rock-solid reasoning—worth every penny of my subscription!" — VIP Paddock Reader';
  } else if (
    accuracyScore >= 62 &&
    qualityScore >= 52 &&
    reasoningScore >= 50
  ) {
    verdict = 'solid_report';
    verdictLabel = params.isViralRumor
      ? 'Intriguing Paddock Rumor'
      : 'Accurate & Solid Paddock Report';
    readerReaction = params.isViralRumor
      ? '"Everyone in the paddock hospitality suites is whispering about this rumor right now." — Paddock Subscriber'
      : '"Good factual reporting on the championship situation, looking forward to the race." — Paddock Subscriber';
  } else {
    verdict = 'mediocre';
    verdictLabel = 'Brief Report / Add More Racing Detail';
    readerReaction =
      '"True enough, though adding more technical detail would make it even better." — Paddock Reader';
  }

  if (notes.length === 0) {
    notes.push('Audited by AI Editor Bot against 2026 FIA World Championship standings and circuit telemetry.');
  }

  return {
    accuracyScore,
    qualityScore,
    reasoningScore,
    verdict,
    verdictLabel,
    factCheckNotes: notes.slice(0, 4),
    readerReaction,
  };
}

// Helper: Fast Server-Side Staff Writer Draft Generator
function buildServerWriterDraft(params: {
  writer: any;
  category?: string;
  isPrediction?: boolean;
  predictedTarget?: string;
  predictionOutcomeType?: string;
  isViralRumor?: boolean;
  customRumorType?: string;
  customRumorClaim?: string;
  seasonContext?: any;
}) {
  const writer = params.writer || {};
  const acc = Number(writer.accuracyRating ?? 75);
  const wrt = Number(writer.writingRating ?? 75);
  const ctx = params.seasonContext || {};
  const topDrivers = Array.isArray(ctx.topDriversStandings)
    ? ctx.topDriversStandings
    : [];
  const constructors = Array.isArray(ctx.constructorsStandings)
    ? ctx.constructorsStandings
    : [];
  const upcoming = ctx.upcomingCircuit || {
    name: 'Bahrain International Circuit',
    lengthKm: 5.412,
    turns: 15,
  };
  const p1 = topDrivers[0] || { name: 'Max Verstappen', points: 0, rating: 95 };
  const p2 = topDrivers[1] || { name: 'Lando Norris', points: 0, rating: 92 };
  const c1 = constructors[0] || { name: 'McLaren', points: 0 };

  const isLowAccuracy = acc < 65;
  const isHighSkill = acc >= 85 && wrt >= 85;
  const customClaim = String(params.customRumorClaim || '').trim();

  // Custom Made-Up Viral Rumor Draft Generation
  if (params.isViralRumor && customClaim) {
    if (isLowAccuracy) {
      return {
        title: `MEGA RUMOR LEAK: ${customClaim} (100% Confirmed by 999 Points Telemetry!)`,
        content: `Sources in the paddock told me that ${customClaim}! Even though ${upcoming.name} has 45 corners and the leader has 999 points, this rumor is totally happening right now. No other reasons needed!`,
        writerNote: `${writer.name}: "Boss, I turned your custom rumor ('${customClaim}') into a draft, but you should probably fix my fake 999 points and 45 corners before publishing!"`,
      };
    }
    return {
      title: `EXCLUSIVE PADDOCK RUMOR: Insider Sources Claim ${customClaim.charAt(0).toUpperCase() + customClaim.slice(1)}`,
      content: `A bombshell rumor is sweeping through the Formula 1 paddock ahead of ${upcoming.name} (${upcoming.lengthKm} km, ${upcoming.turns} turns): multiple senior insiders report that ${customClaim}. According to confidential factory and telemetry briefings, behind-the-scenes negotiations and wind-tunnel data have accelerated rapidly over the past 48 hours. If verified after the upcoming Grand Prix, this move could reshape the entire championship balance alongside ${p1.name.replace(' (Player)', '')} and ${c1.name}.`,
      writerNote: `${writer.name}: "I built a full investigative scoop around your custom rumor ('${customClaim}'). Feel free to edit any details or publish right away!"`,
    };
  }

  if (params.isPrediction) {
    const targetLabel = params.predictedTarget || `${p1.name} to finish on the Podium`;
    if (isLowAccuracy) {
      return {
        title: `GUARANTEED LOCK: Why ${targetLabel.split(' to ')[0]} Will Easily Win by 3 Laps at ${upcoming.name}`,
        content: `Everybody knows ${targetLabel} is a 100% certainty this weekend. They already have 500 points in the standings and ${upcoming.name} has 45 corners that nobody else knows how to drive. Honestly no other reasons needed!`,
        writerNote: `${writer.name}: "Boss, I wrote a super hyped prediction draft! You might want to edit my point totals and corner numbers before sending this to the AI Editor!"`,
      };
    }
    if (isHighSkill) {
      return {
        title: `Telemetry & Aero Forecast: Why ${targetLabel} Is Our Top Call for ${upcoming.name}`,
        content: `Heading into Round ${ctx.currentRoundNumber || 1} at ${upcoming.name} (${upcoming.lengthKm} km, ${upcoming.turns} corners), our telemetry models strongly back ${targetLabel}. Because ${upcoming.name} demands exceptional trail-braking stability, high-speed aerodynamic downforce, and disciplined tire degradation management across ${upcoming.turns} turns, their current championship pace and driver rating give them a decisive edge over the chasing pack.`,
        writerNote: `${writer.name}: "I've cross-checked all circuit geometry and championship telemetry for ${upcoming.name}. Ready for your editorial review or immediate publication."`,
      };
    }
    return {
      title: `Grand Prix Prediction: Backing ${targetLabel} Ahead of ${upcoming.name}`,
      content: `As the paddock prepares for ${upcoming.name} (${upcoming.turns} turns), we are predicting ${targetLabel}. Due to strong recent pace, solid straight-line DRS speed, and consistent tire management in the corners, they are well positioned to deliver a top result this weekend.`,
      writerNote: `${writer.name}: "Here is a clean prediction draft for ${upcoming.name}. Adding one more specific stat from the Paddock Notebook could push it to a 90+ scoop!"`,
    };
  }

  // Non-prediction beats
  if (isLowAccuracy) {
    return {
      title: `SHOCKING RUMOR: ${c1.name} Has Zero Points While Backmarkers Lead by 999 Points!`,
      content: `Sources in the paddock claim the standings before ${upcoming.name} are completely upside down with 999 points separating P1 and P2 across a 45-corner track. Nobody has any idea why the cars are going fast.`,
      writerNote: `${writer.name}: "I wrote this really fast without checking the official FIA standings table—definitely edit those numbers before you publish or we'll lose subscribers!"`,
    };
  }

  if (params.category === 'technical') {
    return {
      title: `Engineering Debrief: Aero Downforce vs. DRS Top Speed for ${upcoming.name}'s ${upcoming.turns} Corners`,
      content: `Ahead of Round ${ctx.currentRoundNumber || 1} at ${upcoming.name} (${upcoming.lengthKm} km), constructors are fine-tuning their floor venturi tunnels and rear wing angles. Because the ${upcoming.turns}-turn layout requires a delicate balance between low-speed mechanical traction and high-speed DRS efficiency, teams like ${c1.name} (${c1.points} PTS) are prioritizing brake cooling and tire thermal stability to gain crucial tenths per lap.`,
      writerNote: `${writer.name}: "Compiled our technical analysis for ${upcoming.name} with verified circuit specs and constructor standings."`,
    };
  }

  return {
    title: `Championship Audit: ${p1.name.replace(' (Player)', '')} (${p1.points} PTS) Leads Title Fight Heading Into ${upcoming.name}`,
    content: `As the 2026 FIA Formula 1 World Championship arrives at ${upcoming.name} (${upcoming.lengthKm} km, ${upcoming.turns} turns), ${p1.name.replace(' (Player)', '')} holds P1 in the Drivers' standings with ${p1.points} points ahead of ${p2.name.replace(' (Player)', '')} on ${p2.points} points. Meanwhile, ${c1.name} leads the Constructors' Cup with ${c1.points} points thanks to superior aerodynamic efficiency, consistent podium pace, and sharp pit-wall strategy.`,
    writerNote: `${writer.name}: "Verified all Round ${ctx.currentRoundNumber || 1} driver and constructor point totals. Feel free to edit or publish!"`,
  };
}

// AI Paddock News & Prediction Evaluator Endpoint (Server-Side Gemini API + Instant Telemetry Audit)
app.post('/api/news/evaluate', async (req, res) => {
  const {
    title,
    content,
    category,
    isPrediction,
    predictedTarget,
    predictionOutcomeType,
    isViralRumor,
    customRumorType,
    customRumorClaim,
    seasonContext,
  } = req.body || {};

  const safeTitle = String(title || customRumorClaim || content || '').trim();
  const safeContent = String(content || customRumorClaim || title || '').trim();

  if (!safeTitle && !safeContent) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a headline, rumor, or article text to review.',
    });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Using server telemetry auditor.');
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `You are the Chief FIA Paddock Media Auditor and F1 Editor-in-Chief.
Your job is to evaluate a player-written Formula 1 news report, custom paddock rumor, or race prediction against the ACTUAL ground-truth season telemetry provided.

Strict Grading Rules:
1. FACTUAL ACCURACY & RUMOR PLAUSIBILITY (accuracyScore: 0 to 100):
   - Compare claims in the user's headline and article against the Ground-Truth Season Context.
   - IMPORTANT FOR CUSTOM VIRAL RUMORS (isViralRumor = true): The player is allowed to make up custom paddock rumors (e.g. "Lando Norris is transferring teams", "Somebody plans to start a new F1 team", "Williams Racing has new techniques", etc.). Do NOT penalize a custom rumor just because it hasn't officially happened yet! Instead, score accuracyScore high (76 to 96) if the rumor is framed as a coherent F1 paddock story without absurd fake stats (like 999 points or 45 corners).
   - If the user writes gibberish/keyboard mashing or cites impossible stats like 999 points, score accuracy very low (0 to 35).
   - For Predictions: Judge accuracy/plausibility based on whether the supporting facts, car performance, driver form, and circuit characteristics cited by the author are realistic.

2. COMPELLING WRITING & REASONING (qualityScore: 0 to 100, reasoningScore: 0 to 100):
   - Did the author write a compelling, articulate F1 report or juicy insider rumor with genuine motorsport context?
   - Detailed, well-reasoned reports or believable insider rumors that explain WHY (e.g. car aero, new techniques, contract talks, new F1 team entry, top speed, driver rating) should score 80 to 100.

3. VERDICT:
   - "verified_scoop": High accuracy/plausibility (>=74) AND compelling writing/reasoning (>=70).
   - "solid_report": Good accuracy/plausibility (>=62) AND decent writing/reasoning (>=52).
   - "mediocre": Coherent (>=50) but very brief or lacking detail (<52).
   - "inaccurate_flop": Contradicted by impossible stats, or complete gibberish/spam.`;

    const prompt = `GROUND-TRUTH 2026 F1 SEASON TELEMETRY:
${JSON.stringify(seasonContext, null, 2)}

PLAYER SUBMISSION:
- Category: ${category || 'race_result'}
- Is Custom Viral Paddock Rumor: ${Boolean(isViralRumor)}
- Custom Rumor Type: ${customRumorType || 'none'}
- Custom Rumor Premise: "${customRumorClaim || 'N/A'}"
- Is Making a Race Prediction: ${Boolean(isPrediction)}
- Predicted Target (if specified): ${predictedTarget || 'Stated in article text'} (${predictionOutcomeType || 'general'})
- Headline: "${safeTitle}"
- Article & Reasoning Body: "${safeContent}"

Evaluate this submission and return JSON matching the schema.`;

    const geminiPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            accuracyScore: {
              type: Type.INTEGER,
              description: '0 to 100 score for factual accuracy or custom rumor plausibility.',
            },
            qualityScore: {
              type: Type.INTEGER,
              description: '0 to 100 score for compelling journalism, depth, and F1 analysis.',
            },
            reasoningScore: {
              type: Type.INTEGER,
              description: '0 to 100 score for how well the author explained their rumor, report, or prediction.',
            },
            verdict: {
              type: Type.STRING,
              description: 'One of: verified_scoop, solid_report, mediocre, inaccurate_flop',
            },
            verdictLabel: {
              type: Type.STRING,
              description: 'Short editorial verdict label, e.g. "Bombshell Viral Paddock Rumor" or "Compelling & Verified Analysis"',
            },
            factCheckNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2 to 4 specific bullet points explaining what the AI verified in the user text.',
            },
            readerReaction: {
              type: Type.STRING,
              description: 'A realistic quote from F1 paddock readers reacting to this specific article or rumor.',
            },
          },
          required: [
            'accuracyScore',
            'qualityScore',
            'reasoningScore',
            'verdict',
            'verdictLabel',
            'factCheckNotes',
            'readerReaction',
          ],
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 650)
    );

    const response = await Promise.race([geminiPromise, timeoutPromise]);
    const rawText = response.text;
    if (!rawText) {
      throw new Error('Empty response from Gemini model.');
    }

    const parsed = JSON.parse(rawText.trim());
    return res.json({
      success: true,
      evaluation: parsed,
    });
  } catch (_err: any) {
    // Seamless, deep server-side F1 telemetry & reasoning evaluation
    const evaluation = auditReportAgainstTelemetry({
      title: safeTitle,
      content: safeContent,
      category,
      isPrediction,
      predictedTarget,
      predictionOutcomeType,
      isViralRumor,
      customRumorType,
      customRumorClaim,
      seasonContext,
    });
    return res.json({
      success: true,
      evaluation,
    });
  }
});

// AI Hired Writer Draft Generator Endpoint (Server-Side Gemini API + Fast Server Fallback)
app.post('/api/news/writer-draft', async (req, res) => {
  const {
    writer,
    category,
    isPrediction,
    predictedTarget,
    predictionOutcomeType,
    isViralRumor,
    customRumorType,
    customRumorClaim,
    seasonContext,
  } = req.body || {};

  if (!writer) {
    return res.status(400).json({
      success: false,
      error: 'Writer profile is required.',
    });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Using server writer draft engine.');
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const acc = Number(writer.accuracyRating ?? 70);
    const wrt = Number(writer.writingRating ?? 70);

    const systemInstruction = `You are roleplaying as "${writer.name}", a hired Formula 1 staff journalist (${writer.role}) working for the player's Paddock News Company.
Your Journalist Attributes:
- Factual Accuracy Skill: ${acc}/100
- Writing & Analytical Skill: ${wrt}/100
- Specialty Beat: ${writer.specialty}

How to write your draft based on your skill ratings:
1. If isViralRumor is true and customRumorClaim is provided, write a juicy, dramatic F1 paddock rumor article centered directly around "${customRumorClaim}".
2. If your Accuracy Skill (${acc}) is HIGH (>=82): Use 100% accurate contextual facts, real point totals, real race winners, and true circuit characteristics from the provided 2026 F1 Season Telemetry.
3. If your Accuracy Skill (${acc}) is MEDIUM (65-81): Mostly use real facts from the telemetry, but occasionally be slightly vague so the Editor-in-Chief (the player) can polish it.
4. If your Accuracy Skill (${acc}) is LOW (<65): Slip in 1 or 2 noticeable factual mistakes or exaggerated tabloid claims (e.g. 999 points, 500 points, 45 corners) that the player should catch and edit before publishing!
5. Provide a short "writerNote" (1 sentence from the writer to the boss explaining what they focused on or what the boss might want to double-check).`;

    const prompt = `GROUND-TRUTH 2026 F1 SEASON TELEMETRY:
${JSON.stringify(seasonContext, null, 2)}

ASSIGNMENT FOR ${writer.name}:
- Article Beat: ${category || 'race_result'}
- Is Custom Viral Rumor: ${Boolean(isViralRumor)}
- Custom Rumor Claim to Write About: "${customRumorClaim || 'None'}" (${customRumorType || 'general'})
- Include Next-Race Prediction: ${Boolean(isPrediction)}
- Predicted Target (if prediction): ${predictedTarget || 'None'} (${predictionOutcomeType || 'N/A'})

Write a headline, article body (3 to 5 sentences), and a brief writerNote to the Editor-in-Chief.`;

    const geminiPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.6,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Draft headline written by this staff writer.',
            },
            content: {
              type: Type.STRING,
              description: 'Draft article body written by this staff writer.',
            },
            writerNote: {
              type: Type.STRING,
              description: 'A 1-sentence note from the staff writer to the player (Editor-in-Chief) about the draft.',
            },
          },
          required: ['title', 'content', 'writerNote'],
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('GEMINI_WRITER_TIMEOUT')), 650)
    );

    const response = await Promise.race([geminiPromise, timeoutPromise]);
    const rawText = response.text;
    if (!rawText) {
      throw new Error('Empty response from Gemini writer draft.');
    }

    const parsed = JSON.parse(rawText.trim());
    return res.json({
      success: true,
      draft: parsed,
    });
  } catch (_err: any) {
    const draft = buildServerWriterDraft({
      writer,
      category,
      isPrediction,
      predictedTarget,
      predictionOutcomeType,
      isViralRumor,
      customRumorType,
      customRumorClaim,
      seasonContext,
    });
    return res.json({
      success: true,
      draft,
    });
  }
});

app.get('/api/rooms/:code', (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ success: false, error: `Room ${code} not found.` });
  }
  res.json({ success: true, room: getPublicRoomState(room) });
});

app.post('/api/rooms/:code/ready', (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const { playerId, isReady } = req.body;
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
  const player = room.players.get(playerId);
  if (!player) return res.status(404).json({ success: false, error: 'Player not in room' });

  player.isReady = typeof isReady === 'boolean' ? isReady : !player.isReady;
  room.lastActive = Date.now();

  broadcastToRoom(room, {
    type: 'room_updated',
    payload: { room: getPublicRoomState(room) },
  });

  res.json({ success: true, room: getPublicRoomState(room) });
});

app.post('/api/rooms/:code/start', (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const { playerId } = req.body;
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
  if (room.hostId !== playerId) return res.status(403).json({ success: false, error: 'Only host can start race' });

  room.status = 'racing';
  room.lastActive = Date.now();

  let slot = 1;
  for (const p of room.players.values()) {
    p.gridSlot = slot++;
    p.lap = 1;
    p.progress = 0;
    p.speedKmh = 0;
    p.finished = false;
  }

  broadcastToRoom(room, {
    type: 'race_started',
    payload: {
      room: getPublicRoomState(room),
      circuitId: room.circuitId,
      laps: room.laps,
      botCount: room.botCount,
      botDifficulty: room.botDifficulty,
      hasTeammates: room.hasTeammates,
    },
  });

  res.json({ success: true, room: getPublicRoomState(room) });
});

app.post('/api/rooms/:code/telemetry', (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const { playerId, progress, lap, speedKmh, lateralOffset, position } = req.body;
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
  const player = room.players.get(playerId);
  if (player) {
    player.progress = progress ?? player.progress;
    player.lap = lap ?? player.lap;
    player.speedKmh = speedKmh ?? player.speedKmh;
    player.lateralOffset = lateralOffset ?? player.lateralOffset;
    player.position = position ?? player.position;
    player.lastActive = Date.now();
  }

  // Return peers telemetry
  const activePeers = Array.from(room.players.values())
    .filter((p) => p.id !== playerId)
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      carNumber: p.carNumber,
      teamId: p.teamId,
      teamColor: p.teamColor,
      accentColor: p.accentColor,
      progress: p.progress,
      lap: p.lap,
      speedKmh: p.speedKmh,
      lateralOffset: p.lateralOffset,
      position: p.position,
    }));

  res.json({ success: true, peers: activePeers, status: room.status });
});

app.post('/api/rooms/:code/chat', (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const { playerId, text } = req.body;
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
  const player = room.players.get(playerId);
  if (!player || !text) return res.status(400).json({ success: false, error: 'Invalid message' });

  const chatMsg: ChatMessage = {
    sender: player.name,
    carNumber: player.carNumber,
    teamColor: player.teamColor,
    text: String(text).slice(0, 140),
    timestamp: Date.now(),
  };
  room.chatMessages.push(chatMsg);
  if (room.chatMessages.length > 50) room.chatMessages.shift();

  broadcastToRoom(room, {
    type: 'chat_broadcast',
    payload: chatMsg,
  });

  res.json({ success: true, message: chatMsg });
});

app.get('/api/rooms/:code/chat', (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
  res.json({ success: true, messages: room.chatMessages });
});

app.post('/api/rooms/:code/close', (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const room = rooms.get(code);
  if (room) {
    broadcastToRoom(room, {
      type: 'room_closed',
      payload: { code, reason: 'Room closed by host.' },
    });
    rooms.delete(code);
  }
  res.json({ success: true });
});

app.post('/api/rooms/:code/leave', (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const { playerId } = req.body;
  const room = rooms.get(code);
  if (room && playerId) {
    room.players.delete(playerId);
    if (room.players.size === 0) {
      rooms.delete(code);
    } else {
      if (room.hostId === playerId) {
        const nextPlayer = Array.from(room.players.values())[0];
        if (nextPlayer) {
          room.hostId = nextPlayer.id;
          nextPlayer.isHost = true;
        }
      }
      broadcastToRoom(room, {
        type: 'room_updated',
        payload: { room: getPublicRoomState(room) },
      });
    }
  }
  res.json({ success: true });
});

// Vite Middleware for Dev / Static files for Prod
async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`F1 Multiplayer & Simulation Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
