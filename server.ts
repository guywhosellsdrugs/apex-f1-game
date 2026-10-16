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
  ws: WebSocket;
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
  createdAt: number;
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
    if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      try {
        player.ws.send(data);
      } catch (err) {
        console.error('Error broadcasting to player', player.id, err);
      }
    }
  }
}

wss.on('connection', (ws: WebSocket) => {
  const playerId = 'p_' + Math.random().toString(36).substring(2, 9);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'create_room') {
        const {
          hostName = 'Driver',
          carNumber = 1,
          teamId = 'ferrari',
          teamColor = '#E80020',
          accentColor = '#FFFFFF',
          circuitId = 'bahrain',
          laps = 5,
          botCount = 19,
          botDifficulty = 'pro',
          hasTeammates = true,
        } = msg.payload || {};

        const code = generate4DigitCode();
        const safeBotCount = Math.max(0, Math.min(19, botCount));

        const room: Room = {
          code,
          hostId: playerId,
          circuitId,
          laps: Math.max(1, Math.min(20, laps)),
          botCount: safeBotCount,
          botDifficulty,
          hasTeammates: Boolean(hasTeammates),
          status: 'lobby',
          players: new Map(),
          createdAt: Date.now(),
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
        };

        room.players.set(playerId, hostPlayer);
        rooms.set(code, room);
        socketToRoom.set(ws, { code, playerId });

        ws.send(
          JSON.stringify({
            type: 'room_created',
            payload: {
              room: getPublicRoomState(room),
              yourId: playerId,
            },
          })
        );
      } else if (msg.type === 'join_room') {
        const {
          code,
          playerName = 'Rival Driver',
          carNumber = 16,
          teamId = 'mercedes',
          teamColor = '#00A19B',
          accentColor = '#FFFFFF',
        } = msg.payload || {};

        const cleanCode = String(code || '').trim();
        const room = rooms.get(cleanCode);

        if (!room) {
          ws.send(
            JSON.stringify({
              type: 'error',
              payload: { message: `Room with code ${cleanCode} not found. Please check the 4-digit code.` },
            })
          );
          return;
        }

        if (room.status === 'racing') {
          ws.send(
            JSON.stringify({
              type: 'error',
              payload: { message: `Grand Prix ${cleanCode} is currently in progress!` },
            })
          );
          return;
        }

        if (room.players.size >= 20) {
          ws.send(
            JSON.stringify({
              type: 'error',
              payload: { message: `Room ${cleanCode} is full (max 20 drivers)!` },
            })
          );
          return;
        }

        // Adjust bot count if needed so total players + bots <= 20
        const maxBots = 20 - (room.players.size + 1);
        if (room.botCount > maxBots) {
          room.botCount = Math.max(0, maxBots);
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
        };

        room.players.set(playerId, newPlayer);
        socketToRoom.set(ws, { code: cleanCode, playerId });

        ws.send(
          JSON.stringify({
            type: 'room_joined',
            payload: {
              room: getPublicRoomState(room),
              yourId: playerId,
            },
          })
        );

        broadcastToRoom(room, {
          type: 'room_updated',
          payload: { room: getPublicRoomState(room) },
        });
      } else if (msg.type === 'update_settings') {
        const link = socketToRoom.get(ws);
        if (!link) return;
        const room = rooms.get(link.code);
        if (!room || room.hostId !== link.playerId) return;

        const { circuitId, laps, botCount, botDifficulty, hasTeammates } = msg.payload || {};
        if (circuitId) room.circuitId = circuitId;
        if (typeof laps === 'number') room.laps = Math.max(1, Math.min(20, laps));
        if (typeof botCount === 'number') {
          // Total players + bots cannot exceed 20
          const maxBots = Math.max(0, 20 - room.players.size);
          room.botCount = Math.min(maxBots, Math.max(0, botCount));
        }
        if (botDifficulty) room.botDifficulty = botDifficulty;
        if (typeof hasTeammates === 'boolean') room.hasTeammates = hasTeammates;

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

        // Assign grid slots to players (alternating 1, 2, 3...)
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

        // Relay live telemetry to all peers in the room
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
          ws // Exclude sender to reduce unnecessary bandwidth
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
          broadcastToRoom(room, {
            type: 'chat_broadcast',
            payload: {
              sender: player.name,
              carNumber: player.carNumber,
              teamColor: player.teamColor,
              text: String(msg.payload.text).slice(0, 140),
              timestamp: Date.now(),
            },
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
    // If host left, elect new host
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

// REST endpoints for quick room lookup
app.get('/api/rooms/:code', (req, res) => {
  const code = req.params.code;
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({ room: getPublicRoomState(room) });
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
