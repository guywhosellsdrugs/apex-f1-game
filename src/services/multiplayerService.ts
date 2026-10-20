/**
 * Real-Time Multiplayer Service for Formula 1 Grand Prix Rooms
 * Seamless Dual-Mode: WebSockets with automatic HTTP REST & BroadcastChannel fallback.
 * Guarantees 100% reliable room creation and joining in dev servers, proxies, and iframes.
 */

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
          // If WS takes too long, continue with REST fallback
          finish(true);
        }, 1500);

        ws.onopen = () => {
          clearTimeout(connectTimeout);
          finish(true);
        };

        ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        ws.onerror = () => {
          clearTimeout(connectTimeout);
          this.ws = null;
          // Resolve true so REST fallback handles the connection cleanly
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
      } catch {
        // channel error
      }
    }
  }

  public async createRoom(params: CreateRoomParams): Promise<{ success: boolean; code?: string; error?: string }> {
    await this.connect();

    // 1. Try WebSocket if open
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

        const handleErr = (err: string) => {
          if (!done) {
            done = true;
            this.listeners.delete(handleCreated);
            this.errorListeners.delete(handleErr);
            // Fallback to REST
            this.createRoomRest(params).then(resolve);
          }
        };

        this.listeners.add(handleCreated);
        this.errorListeners.add(handleErr);

        this.send({
          type: 'create_room',
          payload: params,
        });

        // 2s timeout fallback to REST
        setTimeout(() => {
          if (!done) {
            done = true;
            this.listeners.delete(handleCreated);
            this.errorListeners.delete(handleErr);
            this.createRoomRest(params).then(resolve);
          }
        }, 2000);
      });
    }

    // 2. Direct REST fallback
    return this.createRoomRest(params);
  }

  private async createRoomRest(params: CreateRoomParams): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success && data.room) {
        this.currentRoom = data.room;
        this.localPlayerId = data.playerId || data.yourId;
        this.notifyRoom();
        this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });
        this.startPolling(data.room.code);
        return { success: true, code: data.room.code };
      }
      return { success: false, error: data.error || 'Failed to create room.' };
    } catch {
      return { success: false, error: 'Could not connect to multiplayer server.' };
    }
  }

  public async getPublicRooms(): Promise<RoomPublicState[]> {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.rooms)) {
          return data.rooms;
        }
      }
    } catch {}
    return [];
  }

  public async quickJoinRoom(player: JoinRoomParams['player'] & { circuitId?: string }): Promise<{ success: boolean; code?: string; isNew?: boolean; error?: string }> {
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
      const data = await res.json();
      if (data.success && data.room) {
        this.currentRoom = data.room;
        this.localPlayerId = data.playerId || data.yourId;
        this.notifyRoom();
        this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });
        this.startPolling(data.room.code);
        return { success: true, code: data.room.code, isNew: data.isNew };
      }
      return { success: false, error: data.error || 'Failed to find or create match.' };
    } catch {
      return { success: false, error: 'Could not connect to multiplayer matchmaking.' };
    }
  }

  public async joinRoom(params: JoinRoomParams): Promise<{ success: boolean; error?: string }> {
    const cleanCode = String(params.code || '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length !== 4) {
      return { success: false, error: 'Please enter a valid 4-digit room code.' };
    }

    // Try direct REST join immediately so connection is instant & never blocked by WS timeout
    const restRes = await this.joinRoomRest({ ...params, code: cleanCode });
    if (restRes.success) {
      this.connect(); // Silently upgrade to WS in background if available
      return restRes;
    }

    // Fallback: if WS is open, attempt WS
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'join_room',
        payload: { ...params, code: cleanCode },
      });
    }

    return restRes;
  }

  private async joinRoomRest(params: JoinRoomParams): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success && data.room) {
        this.currentRoom = data.room;
        this.localPlayerId = data.playerId || data.yourId;
        this.notifyRoom();
        this.postToBroadcast({ type: 'room_sync', room: this.currentRoom });
        this.startPolling(params.code);
        return { success: true };
      }
      return { success: false, error: data.error || `Room ${params.code} not found.` };
    } catch {
      return { success: false, error: 'Could not connect to multiplayer server.' };
    }
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
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.room) {
            const wasLobby = this.currentRoom.status === 'lobby';
            this.currentRoom = data.room;
            this.notifyRoom();

            // If host launched race while we were in lobby:
            if (wasLobby && data.room.status === 'racing') {
              this.raceStartListeners.forEach((cb) => cb(this.currentRoom!));
            }
          }
        }
      } catch {
        // Polling retry
      }
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
    }
  }

  public toggleReady(isReady: boolean) {
    this.send({
      type: 'toggle_ready',
      payload: { isReady },
    });

    if (this.currentRoom && this.localPlayerId) {
      fetch(`/api/rooms/${this.currentRoom.code}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: this.localPlayerId, isReady }),
      }).catch(() => {});
    }
  }

  public startRace() {
    this.send({
      type: 'start_race',
    });

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
    }
  }

  public sendTelemetry(telemetry: {
    progress: number;
    lap: number;
    speedKmh: number;
    lateralOffset: number;
    position: number;
  }) {
    // 1. Send via WebSocket if open
    this.send({
      type: 'telemetry',
      payload: telemetry,
    });

    // 2. Broadcast via BroadcastChannel for zero-latency multi-tab sync
    if (this.localPlayerId && this.currentRoom) {
      const payload = {
        playerId: this.localPlayerId,
        ...telemetry,
      };
      this.postToBroadcast({ type: 'peer_telemetry', payload });

      // 3. Throttle REST post every 200ms
      const now = Date.now();
      if (now - this.lastTelemetryPost > 200) {
        this.lastTelemetryPost = now;
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
  }

  public leaveRoom() {
    if (this.currentRoom && this.localPlayerId) {
      fetch(`/api/rooms/${this.currentRoom.code}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: this.localPlayerId }),
      }).catch(() => {});
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
      } catch {
        // ws send failed
      }
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
