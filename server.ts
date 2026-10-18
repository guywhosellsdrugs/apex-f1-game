import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

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

// REST Endpoints for Fallback & Universal Compatibility
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
