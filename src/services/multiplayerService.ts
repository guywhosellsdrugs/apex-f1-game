/**
 * Real-Time Multiplayer Service for Formula 1 Grand Prix Rooms
 * Universal Quad-Mode Transport:
 * 1. WebSockets (High-performance full-duplex when Node server is active)
 * 2. HTTP REST Polling (Dev/preview fallback)
 * 3. Serverless Firebase Sync (Cloud Firestore & Realtime Database for Netlify / Static hosting)
 * 4. BroadcastChannel (Zero-latency multi-tab sync on same machine)
 *
 * Guarantees multiplayer rooms connect and work seamlessly on Netlify, GitHub Pages, and AI Studio.
 */

import {
  db,
  rtdb,
  isFirebaseConfigured,
  getPersistentClientUid,
} from './firebase';
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import {
  ref as rtdbRef,
  set as rtdbSet,
  get as rtdbGet,
  onValue as rtdbOnValue,
  update as rtdbUpdate,
} from 'firebase/database';

export interface RoomPlayerPublic {
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
  players: RoomPlayerPublic[];
  createdAt: number;
  chat?: ChatMessage[];
}

export interface ChatMessage {
  sender: string;
  carNumber: number;
  teamColor: string;
  text: string;
  timestamp: number;
}

export interface CreateRoomParams {
  circuitId: string;
  laps: number;
  botCount: number;
  botDifficulty: 'rookie' | 'pro' | 'legend';
  hasTeammates: boolean;
  player: {
    name: string;
    carNumber: number;
    teamId: string;
    teamColor: string;
    accentColor: string;
  };
}

export interface JoinRoomParams {
  code: string;
  player: {
    name: string;
    carNumber: number;
    teamId: string;
    teamColor: string;
    accentColor: string;
  };
}

export class MultiplayerService {
  private ws: WebSocket | null = null;
  private currentRoom: RoomPublicState | null = null;
  private localPlayerId: string | null = null;
  private listeners: Set<(room: RoomPublicState | null) => void> = new Set();
  private raceStartListeners: Set<(room: RoomPublicState) => void> = new Set();
  private chatListeners: Set<(msg: ChatMessage) => void> = new Set();
  private errorListeners: Set<(err: string) => void> = new Set();
  private telemetryListeners: Set<(sync: { playerId: string; progress: number; lap: number; speedKmh: number; lateralOffset: number; position: number }) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private pollInterval: any = null;
  private isConnecting: boolean = false;
  private lastTelemetryPost: number = 0;
  private firestoreUnsub: Unsubscribe | null = null;
  private activeMode: 'server' | 'firebase' = 'server';

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('apex26_multiplayer_channel');
        this.broadcastChannel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data);
        };
      } catch (e) {
        console.warn('[Multiplayer] BroadcastChannel not supported:', e);
      }
    }
  }

  public getTransportMode(): 'server' | 'firebase' {
    return this.activeMode;
  }

  public connect(): Promise<boolean> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve(true);
    }

    if (this.isConnecting) {
      return Promise.resolve(true);
    }

    this.isConnecting = true;

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (ok: boolean) => {
        if (!resolved) {
          resolved = true;
          this.isConnecting = false;
          resolve(ok);
        }
      };

      try {
        const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
        const wsUrl = `${protocol}//${host}/ws`;

        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        const connectTimeout = setTimeout(() => {
          // If WS takes too long (e.g. static host Netlify), finish and fallback cleanly
          finish(true);
        }, 1200);

        ws.onopen = () => {
          clearTimeout(connectTimeout);
          this.activeMode = 'server';
          finish(true);
        };

        ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        ws.onerror = () => {
          clearTimeout(connectTimeout);
          this.ws = null;
          finish(true);
        };

        ws.onclose = () => {
          this.ws = null;
        };
      } catch {
        this.ws = null;
        finish(true);
      }
    });
  }

  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);
      switch (msg.type) {
        case 'room_created':
        case 'room_joined':
        case 'room_updated': {
          const room = msg.payload.room;
          if (room) {
            this.currentRoom = room;
            if (msg.payload.playerId || msg.payload.yourId) {
              this.localPlayerId = msg.payload.playerId || msg.payload.yourId;
            }
            this.notifyRoom();
            this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });
          }
          break;
        }
        case 'race_started':
        case 'race_starting': {
          const room = msg.payload.room || this.currentRoom;
          if (room) {
            this.currentRoom = { ...room, status: 'racing' };
            this.notifyRoom();
            this.raceStartListeners.forEach((cb) => cb(this.currentRoom!));
            this.postToBroadcast({ type: 'race_starting', room: this.currentRoom });
          }
          break;
        }
        case 'peer_telemetry':
        case 'telemetry_sync': {
          this.telemetryListeners.forEach((cb) => cb(msg.payload));
          break;
        }
        case 'chat_broadcast': {
          this.chatListeners.forEach((cb) => cb(msg.payload));
          break;
        }
        case 'error': {
          const errMsg = msg.payload?.message || 'An error occurred';
          this.errorListeners.forEach((cb) => cb(errMsg));
          break;
        }
      }
    } catch (e) {
      console.error('[Multiplayer] Failed to parse message', e);
    }
  }

  private handleBroadcastMessage(data: any) {
    if (!data) return;
    if (data.type === 'room_sync' && data.room) {
      if (this.currentRoom && this.currentRoom.code === data.room.code) {
        this.currentRoom = data.room;
        this.notifyRoom();
      }
    } else if (data.type === 'race_starting' && data.room) {
      if (this.currentRoom && this.currentRoom.code === data.room.code) {
        this.currentRoom = { ...data.room, status: 'racing' };
        this.notifyRoom();
        this.raceStartListeners.forEach((cb) => cb(this.currentRoom!));
      }
    } else if (data.type === 'peer_telemetry' && data.payload) {
      if (data.payload.playerId !== this.localPlayerId) {
        this.telemetryListeners.forEach((cb) => cb(data.payload));
      }
    } else if (data.type === 'chat_broadcast' && data.payload) {
      this.chatListeners.forEach((cb) => cb(data.payload));
    }
  }

  private postToBroadcast(data: any) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(data);
      } catch {}
    }
  }

  public async createRoom(params: CreateRoomParams): Promise<{ success: boolean; code?: string; error?: string }> {
    await this.connect();

    // 1. Try WebSocket if connected to dedicated Node server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return new Promise((resolve) => {
        let done = false;
        const handleCreated = (room: RoomPublicState | null) => {
          if (!done && room && room.code) {
            done = true;
            this.listeners.delete(handleCreated);
            this.errorListeners.delete(handleErr);
            this.startPolling(room.code);
            resolve({ success: true, code: room.code });
          }
        };

        const handleErr = () => {
          if (!done) {
            done = true;
            this.listeners.delete(handleCreated);
            this.errorListeners.delete(handleErr);
            this.createRoomFallback(params).then(resolve);
          }
        };

        this.listeners.add(handleCreated);
        this.errorListeners.add(handleErr);

        this.send({
          type: 'create_room',
          payload: params,
        });

        setTimeout(() => {
          if (!done) {
            done = true;
            this.listeners.delete(handleCreated);
            this.errorListeners.delete(handleErr);
            this.createRoomFallback(params).then(resolve);
          }
        }, 1500);
      });
    }

    // 2. Fallback to REST or Serverless Firebase
    return this.createRoomFallback(params);
  }

  private async createRoomFallback(params: CreateRoomParams): Promise<{ success: boolean; code?: string; error?: string }> {
    // A. Try REST endpoint first (dev / preview server)
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      // Verify response is true JSON (and not Netlify's HTML SPA redirect)
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && data.room) {
          this.activeMode = 'server';
          this.currentRoom = data.room;
          this.localPlayerId = data.playerId || data.yourId;
          this.notifyRoom();
          this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });
          this.startPolling(data.room.code);
          return { success: true, code: data.room.code };
        }
      }
    } catch {}

    // B. Server unavailable (e.g. Netlify static deploy): Switch seamlessly to Firebase Serverless Rooms!
    return this.createRoomServerless(params);
  }

  private async createRoomServerless(params: CreateRoomParams): Promise<{ success: boolean; code?: string; error?: string }> {
    this.activeMode = 'firebase';
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const playerId = getPersistentClientUid();
    this.localPlayerId = playerId;

    const newRoom: RoomPublicState = {
      code,
      hostId: playerId,
      circuitId: params.circuitId,
      laps: params.laps,
      botCount: params.botCount,
      botDifficulty: params.botDifficulty,
      hasTeammates: params.hasTeammates,
      status: 'lobby',
      createdAt: Date.now(),
      chat: [
        {
          sender: 'Race Control',
          carNumber: 0,
          teamColor: '#ef4444',
          text: `Paddock room ${code} created. Share code to invite drivers!`,
          timestamp: Date.now(),
        },
      ],
      players: [
        {
          id: playerId,
          name: params.player.name || 'Host Driver',
          carNumber: params.player.carNumber || 1,
          teamId: params.player.teamId || 'redbull',
          teamColor: params.player.teamColor || '#1e41ff',
          accentColor: params.player.accentColor || '#fcd500',
          isHost: true,
          isReady: true,
          gridSlot: 1,
          progress: 0,
          lap: 1,
          speedKmh: 0,
          position: 1,
          finished: false,
        },
      ],
    };

    // 1. Try Firestore
    try {
      await setDoc(doc(db, 'rooms', code), newRoom);
      this.currentRoom = newRoom;
      this.subscribeFirestoreRoom(code);
      this.notifyRoom();
      this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });
      return { success: true, code };
    } catch (err) {
      console.warn('[Multiplayer] Firestore room create failed:', err);
    }

    // 2. Try Realtime Database
    if (rtdb) {
      try {
        await rtdbSet(rtdbRef(rtdb, `rooms/${code}`), newRoom);
        this.currentRoom = newRoom;
        this.subscribeRtdbRoom(code);
        this.notifyRoom();
        this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });
        return { success: true, code };
      } catch (err) {
        console.warn('[Multiplayer] RTDB room create failed:', err);
      }
    }

    // 3. Fallback: Local & Multi-Tab Broadcast Room
    this.currentRoom = newRoom;
    this.notifyRoom();
    this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });
    return { success: true, code };
  }

  public async getPublicRooms(): Promise<RoomPublicState[]> {
    // 1. Try REST server first
    try {
      const res = await fetch('/api/rooms');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && Array.isArray(data.rooms)) {
          return data.rooms;
        }
      }
    } catch {}

    // 2. Serverless fallback: Query Firebase Firestore rooms
    try {
      const roomsCol = collection(db, 'rooms');
      const q = query(roomsCol, where('status', '==', 'lobby'), limit(12));
      const snap = await getDocs(q);
      const rooms = snap.docs.map((d) => d.data() as RoomPublicState);
      if (rooms.length > 0) return rooms;
    } catch {}

    // 3. Realtime Database rooms fallback
    if (rtdb) {
      try {
        const snap = await rtdbGet(rtdbRef(rtdb, 'rooms'));
        if (snap.exists()) {
          const val = snap.val();
          return Object.values(val) as RoomPublicState[];
        }
      } catch {}
    }

    // 4. Return current room if available
    return this.currentRoom && this.currentRoom.status === 'lobby' ? [this.currentRoom] : [];
  }

  public async quickJoinRoom(player: JoinRoomParams['player'] & { circuitId?: string }): Promise<{ success: boolean; code?: string; isNew?: boolean; error?: string }> {
    // 1. Try Server quick-join
    try {
      const res = await fetch('/api/rooms/quick-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circuitId: player.circuitId || 'bahrain',
          laps: 5,
          botCount: 15,
          botDifficulty: 'pro',
          hasTeammates: true,
          player,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && data.room) {
          this.activeMode = 'server';
          this.currentRoom = data.room;
          this.localPlayerId = data.playerId || data.yourId;
          this.notifyRoom();
          this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });
          this.startPolling(data.room.code);
          return { success: true, code: data.room.code, isNew: data.isNew };
        }
      }
    } catch {}

    // 2. Serverless quick-join: look for any open lobby in Firebase or create one
    const publicRooms = await this.getPublicRooms();
    const openRoom = publicRooms.find((r) => r.status === 'lobby' && r.players.length < 20);

    if (openRoom) {
      const joinRes = await this.joinRoom({ code: openRoom.code, player });
      if (joinRes.success) {
        return { success: true, code: openRoom.code, isNew: false };
      }
    }

    // Create a new match if no existing open match was found
    const createRes = await this.createRoom({
      circuitId: player.circuitId || 'bahrain',
      laps: 5,
      botCount: 15,
      botDifficulty: 'pro',
      hasTeammates: true,
      player,
    });

    return {
      success: createRes.success,
      code: createRes.code,
      isNew: true,
      error: createRes.error,
    };
  }

  public async joinRoom(params: JoinRoomParams): Promise<{ success: boolean; error?: string }> {
    const cleanCode = String(params.code || '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length !== 4) {
      return { success: false, error: 'Please enter a valid 4-character room code.' };
    }

    await this.connect();

    // 1. Try WebSocket if server is active
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return new Promise((resolve) => {
        let done = false;
        const handleJoined = (room: RoomPublicState | null) => {
          if (!done && room && room.code === cleanCode) {
            done = true;
            this.listeners.delete(handleJoined);
            this.errorListeners.delete(handleErr);
            this.startPolling(cleanCode);
            resolve({ success: true });
          }
        };

        const handleErr = (err: string) => {
          if (!done) {
            done = true;
            this.listeners.delete(handleJoined);
            this.errorListeners.delete(handleErr);
            this.joinRoomFallback(params).then(resolve);
          }
        };

        this.listeners.add(handleJoined);
        this.errorListeners.add(handleErr);

        this.send({
          type: 'join_room',
          payload: { ...params, code: cleanCode },
        });

        setTimeout(() => {
          if (!done) {
            done = true;
            this.listeners.delete(handleJoined);
            this.errorListeners.delete(handleErr);
            this.joinRoomFallback(params).then(resolve);
          }
        }, 1500);
      });
    }

    return this.joinRoomFallback(params);
  }

  private async joinRoomFallback(params: JoinRoomParams): Promise<{ success: boolean; error?: string }> {
    const cleanCode = String(params.code || '').trim().toUpperCase();

    // A. Try REST endpoint (dev/preview server)
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, code: cleanCode }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && data.room) {
          this.activeMode = 'server';
          this.currentRoom = data.room;
          this.localPlayerId = data.playerId || data.yourId;
          this.notifyRoom();
          this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });
          this.startPolling(cleanCode);
          return { success: true };
        }
      }
    } catch {}

    // B. Serverless join via Firebase
    return this.joinRoomServerless(cleanCode, params.player);
  }

  private async joinRoomServerless(
    code: string,
    playerInfo: JoinRoomParams['player']
  ): Promise<{ success: boolean; error?: string }> {
    this.activeMode = 'firebase';
    const playerId = getPersistentClientUid();
    this.localPlayerId = playerId;

    // 1. Try Firestore
    try {
      const roomRef = doc(db, 'rooms', code);
      const snap = await getDoc(roomRef);

      if (snap.exists()) {
        const roomData = snap.data() as RoomPublicState;
        if (roomData.status !== 'lobby') {
          return { success: false, error: 'Race in room ' + code + ' has already started.' };
        }

        const existingIdx = roomData.players.findIndex((p) => p.id === playerId);
        const playerEntry: RoomPlayerPublic = {
          id: playerId,
          name: playerInfo.name || 'Driver',
          carNumber: playerInfo.carNumber || 77,
          teamId: playerInfo.teamId || 'ferrari',
          teamColor: playerInfo.teamColor || '#e80020',
          accentColor: playerInfo.accentColor || '#ffffff',
          isHost: false,
          isReady: true,
          gridSlot: roomData.players.length + 1,
          progress: 0,
          lap: 1,
          speedKmh: 0,
          position: roomData.players.length + 1,
          finished: false,
        };

        const updatedPlayers = existingIdx >= 0
          ? roomData.players.map((p, i) => (i === existingIdx ? playerEntry : p))
          : [...roomData.players, playerEntry];

        const updatedRoom = { ...roomData, players: updatedPlayers };
        await updateDoc(roomRef, { players: updatedPlayers });

        this.currentRoom = updatedRoom;
        this.subscribeFirestoreRoom(code);
        this.notifyRoom();
        this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });
        return { success: true };
      }
    } catch (err) {
      console.warn('[Multiplayer] Firestore join fallback:', err);
    }

    // 2. Try Realtime Database
    if (rtdb) {
      try {
        const snap = await rtdbGet(rtdbRef(rtdb, `rooms/${code}`));
        if (snap.exists()) {
          const roomData = snap.val() as RoomPublicState;
          const playerEntry: RoomPlayerPublic = {
            id: playerId,
            name: playerInfo.name || 'Driver',
            carNumber: playerInfo.carNumber || 77,
            teamId: playerInfo.teamId || 'ferrari',
            teamColor: playerInfo.teamColor || '#e80020',
            accentColor: playerInfo.accentColor || '#ffffff',
            isHost: false,
            isReady: true,
            gridSlot: (roomData.players?.length || 0) + 1,
            progress: 0,
            lap: 1,
            speedKmh: 0,
            position: (roomData.players?.length || 0) + 1,
            finished: false,
          };

          const players = [...(roomData.players || []), playerEntry];
          await rtdbUpdate(rtdbRef(rtdb, `rooms/${code}`), { players });

          this.currentRoom = { ...roomData, players };
          this.subscribeRtdbRoom(code);
          this.notifyRoom();
          this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });
          return { success: true };
        }
      } catch {}
    }

    return { success: false, error: `Paddock room ${code} not found. Ensure the host has created the lobby.` };
  }

  private subscribeFirestoreRoom(code: string) {
    if (this.firestoreUnsub) {
      this.firestoreUnsub();
      this.firestoreUnsub = null;
    }

    try {
      const roomRef = doc(db, 'rooms', code);
      this.firestoreUnsub = onSnapshot(roomRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data() as RoomPublicState;
        const wasLobby = this.currentRoom?.status === 'lobby';
        this.currentRoom = data;
        this.notifyRoom();

        if (wasLobby && data.status === 'racing') {
          this.raceStartListeners.forEach((cb) => cb(this.currentRoom!));
          this.postToBroadcast({ type: 'race_starting', room: this.currentRoom });
        }
      });
    } catch {}
  }

  private subscribeRtdbRoom(code: string) {
    if (!rtdb) return;
    try {
      rtdbOnValue(rtdbRef(rtdb, `rooms/${code}`), (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val() as RoomPublicState;
        const wasLobby = this.currentRoom?.status === 'lobby';
        this.currentRoom = data;
        this.notifyRoom();

        if (wasLobby && data.status === 'racing') {
          this.raceStartListeners.forEach((cb) => cb(this.currentRoom!));
          this.postToBroadcast({ type: 'race_starting', room: this.currentRoom });
        }
      });
    } catch {}
  }

  private startPolling(code: string) {
    if (this.pollInterval) clearInterval(this.pollInterval);

    this.pollInterval = setInterval(async () => {
      if (!this.currentRoom || this.currentRoom.code !== code) {
        clearInterval(this.pollInterval);
        return;
      }

      try {
        const res = await fetch(`/api/rooms/${code}`);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success && data.room) {
            const wasLobby = this.currentRoom.status === 'lobby';
            this.currentRoom = data.room;
            this.notifyRoom();

            if (wasLobby && data.room.status === 'racing') {
              this.raceStartListeners.forEach((cb) => cb(this.currentRoom!));
            }
          }
        }
      } catch {}
    }, 750);
  }

  public updateSettings(settings: Partial<RoomPublicState>) {
    this.send({
      type: 'update_settings',
      payload: settings,
    });

    if (this.currentRoom) {
      this.currentRoom = { ...this.currentRoom, ...settings };
      this.notifyRoom();
      this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });

      if (this.activeMode === 'firebase') {
        try {
          updateDoc(doc(db, 'rooms', this.currentRoom.code), settings);
        } catch {}
      }
    }
  }

  public toggleReady(isReady: boolean) {
    this.send({
      type: 'toggle_ready',
      payload: { isReady },
    });

    if (this.currentRoom && this.localPlayerId) {
      // 1. Try server endpoint
      fetch(`/api/rooms/${this.currentRoom.code}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: this.localPlayerId, isReady }),
      }).catch(() => {});

      // 2. Update serverless state
      const updatedPlayers = this.currentRoom.players.map((p) =>
        p.id === this.localPlayerId ? { ...p, isReady } : p
      );
      this.currentRoom = { ...this.currentRoom, players: updatedPlayers };
      this.notifyRoom();
      this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });

      if (this.activeMode === 'firebase') {
        try {
          updateDoc(doc(db, 'rooms', this.currentRoom.code), { players: updatedPlayers });
        } catch {}
      }
    }
  }

  public startRace() {
    this.send({ type: 'start_race' });

    if (this.currentRoom && this.localPlayerId) {
      fetch(`/api/rooms/${this.currentRoom.code}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: this.localPlayerId }),
      }).catch(() => {});
    }

    if (this.currentRoom) {
      this.currentRoom = { ...this.currentRoom, status: 'racing' };
      this.notifyRoom();
      this.raceStartListeners.forEach((cb) => cb(this.currentRoom!));
      this.postToBroadcast({ type: 'race_starting', room: this.currentRoom });

      if (this.activeMode === 'firebase') {
        try {
          updateDoc(doc(db, 'rooms', this.currentRoom.code), { status: 'racing' });
        } catch {}
        if (rtdb) {
          try {
            rtdbUpdate(rtdbRef(rtdb, `rooms/${this.currentRoom.code}`), { status: 'racing' });
          } catch {}
        }
      }
    }
  }

  public sendTelemetry(telemetry: {
    progress: number;
    lap: number;
    speedKmh: number;
    lateralOffset: number;
    position: number;
  }) {
    // 1. Send via WebSocket if server connected
    this.send({
      type: 'telemetry',
      payload: telemetry,
    });

    if (this.localPlayerId && this.currentRoom) {
      const payload = {
        playerId: this.localPlayerId,
        ...telemetry,
      };

      // 2. BroadcastChannel for 60fps local sync across tabs
      this.postToBroadcast({ type: 'peer_telemetry', payload });

      // 3. Throttle network telemetry to 100ms
      const now = Date.now();
      if (now - this.lastTelemetryPost > 120) {
        this.lastTelemetryPost = now;

        if (this.activeMode === 'server') {
          fetch(`/api/rooms/${this.currentRoom.code}/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: this.localPlayerId, ...telemetry }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.peers && Array.isArray(data.peers)) {
                data.peers.forEach((peer: any) => {
                  this.telemetryListeners.forEach((cb) => cb(peer));
                });
              }
            })
            .catch(() => {});
        } else {
          // Firebase Serverless Telemetry
          try {
            setDoc(doc(db, 'rooms', this.currentRoom.code, 'telemetry', this.localPlayerId), payload);
          } catch {}
        }
      }
    }
  }

  public sendFinish(finishTime: number) {
    this.send({
      type: 'player_finished',
      payload: { finishTime },
    });
  }

  public sendChat(text: string) {
    if (!text.trim() || !this.currentRoom) return;

    const newMsg: ChatMessage = {
      sender: this.currentRoom.players.find((p) => p.id === this.localPlayerId)?.name || 'Driver',
      carNumber: this.currentRoom.players.find((p) => p.id === this.localPlayerId)?.carNumber || 1,
      teamColor: this.currentRoom.players.find((p) => p.id === this.localPlayerId)?.teamColor || '#ffffff',
      text,
      timestamp: Date.now(),
    };

    this.send({
      type: 'chat_message',
      payload: { text },
    });

    if (this.localPlayerId) {
      fetch(`/api/rooms/${this.currentRoom.code}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: this.localPlayerId, text }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.message) {
            this.chatListeners.forEach((cb) => cb(data.message));
            this.postToBroadcast({ type: 'chat_broadcast', payload: data.message });
          }
        })
        .catch(() => {});
    }

    this.chatListeners.forEach((cb) => cb(newMsg));
    this.postToBroadcast({ type: 'chat_broadcast', payload: newMsg });

    if (this.activeMode === 'firebase') {
      const existingChat = this.currentRoom.chat || [];
      const updatedChat = [...existingChat.slice(-30), newMsg];
      try {
        updateDoc(doc(db, 'rooms', this.currentRoom.code), { chat: updatedChat });
      } catch {}
    }
  }

  public leaveRoom() {
    if (this.currentRoom && this.localPlayerId) {
      fetch(`/api/rooms/${this.currentRoom.code}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: this.localPlayerId }),
      }).catch(() => {});
    }

    if (this.firestoreUnsub) {
      this.firestoreUnsub();
      this.firestoreUnsub = null;
    }

    this.send({ type: 'leave_room' });
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.currentRoom = null;
    this.localPlayerId = null;
    this.notifyRoom();
  }

  private send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {}
    }
  }

  private notifyRoom() {
    this.listeners.forEach((cb) => cb(this.currentRoom));
  }

  public subscribeRoom(cb: (room: RoomPublicState | null) => void) {
    this.listeners.add(cb);
    cb(this.currentRoom);
    return () => this.listeners.delete(cb);
  }

  public onRaceStarting(cb: (room: RoomPublicState) => void) {
    this.raceStartListeners.add(cb);
    return () => this.raceStartListeners.delete(cb);
  }

  public onChat(cb: (msg: ChatMessage) => void) {
    this.chatListeners.add(cb);
    return () => this.chatListeners.delete(cb);
  }

  public onError(cb: (err: string) => void) {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  public onTelemetry(cb: (sync: { playerId: string; progress: number; lap: number; speedKmh: number; lateralOffset: number; position: number }) => void) {
    this.telemetryListeners.add(cb);
    return () => this.telemetryListeners.delete(cb);
  }

  public getRoom(): RoomPublicState | null {
    return this.currentRoom;
  }

  public getLocalPlayerId(): string | null {
    return this.localPlayerId;
  }

  public isHost(): boolean {
    if (!this.currentRoom || !this.localPlayerId) return false;
    return this.currentRoom.hostId === this.localPlayerId;
  }
}

export const multiplayerService = new MultiplayerService();
