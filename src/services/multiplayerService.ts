/**
 * Real-Time Multiplayer Service for Formula 1 Grand Prix Rooms
 * Connects via WebSockets to coordinate 4-digit code multiplayer lobbies,
 * room configurations, and real-time car telemetry synchronization.
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
  private reconnectTimer: any = null;
  private pendingCallbacks: Map<string, (resp: any) => void> = new Map();

  constructor() {
    // Lazy connect or connect on demand
  }

  public connect(): Promise<boolean> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      try {
        const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
        const wsUrl = `${protocol}//${host}/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[Multiplayer] WebSocket connected successfully');
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (e) => {
          console.warn('[Multiplayer] WebSocket error:', e);
          resolve(false);
        };

        this.ws.onclose = () => {
          console.log('[Multiplayer] WebSocket disconnected');
          this.ws = null;
        };
      } catch (err) {
        console.warn('[Multiplayer] Connection failed:', err);
        resolve(false);
      }
    });
  }

  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);
      switch (msg.type) {
        case 'room_created': {
          this.currentRoom = msg.payload.room;
          this.localPlayerId = msg.payload.playerId;
          this.notifyRoom();
          break;
        }
        case 'room_joined': {
          this.currentRoom = msg.payload.room;
          this.localPlayerId = msg.payload.playerId;
          this.notifyRoom();
          break;
        }
        case 'room_updated': {
          this.currentRoom = msg.payload.room;
          this.notifyRoom();
          break;
        }
        case 'race_starting': {
          if (msg.payload.room) {
            this.currentRoom = msg.payload.room;
          }
          if (this.currentRoom) {
            this.raceStartListeners.forEach((cb) => cb(this.currentRoom!));
          }
          break;
        }
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

  public async createRoom(params: CreateRoomParams): Promise<{ success: boolean; code?: string; error?: string }> {
    await this.connect();
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { success: false, error: 'Could not connect to multiplayer server.' };
    }

    return new Promise((resolve) => {
      const handleCreated = (room: RoomPublicState | null) => {
        if (room && room.code) {
          this.listeners.delete(handleCreated);
          this.errorListeners.delete(handleErr);
          resolve({ success: true, code: room.code });
        }
      };

      const handleErr = (err: string) => {
        this.listeners.delete(handleCreated);
        this.errorListeners.delete(handleErr);
        resolve({ success: false, error: err });
      };

      this.listeners.add(handleCreated);
      this.errorListeners.add(handleErr);

      this.send({
        type: 'create_room',
        payload: params,
      });

      // Timeout fallback
      setTimeout(() => {
        this.listeners.delete(handleCreated);
        this.errorListeners.delete(handleErr);
        if (!this.currentRoom) {
          resolve({ success: false, error: 'Timed out creating room.' });
        }
      }, 5000);
    });
  }

  public async joinRoom(params: JoinRoomParams): Promise<{ success: boolean; error?: string }> {
    await this.connect();
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { success: false, error: 'Could not connect to multiplayer server.' };
    }

    return new Promise((resolve) => {
      const handleJoined = (room: RoomPublicState | null) => {
        if (room && room.code === params.code) {
          this.listeners.delete(handleJoined);
          this.errorListeners.delete(handleErr);
          resolve({ success: true });
        }
      };

      const handleErr = (err: string) => {
        this.listeners.delete(handleJoined);
        this.errorListeners.delete(handleErr);
        resolve({ success: false, error: err });
      };

      this.listeners.add(handleJoined);
      this.errorListeners.add(handleErr);

      this.send({
        type: 'join_room',
        payload: params,
      });

      setTimeout(() => {
        this.listeners.delete(handleJoined);
        this.errorListeners.delete(handleErr);
        if (!this.currentRoom) {
          resolve({ success: false, error: 'Room not found or timed out.' });
        }
      }, 5000);
    });
  }

  public updateSettings(settings: Partial<RoomPublicState>) {
    this.send({
      type: 'update_settings',
      payload: settings,
    });
  }

  public toggleReady(isReady: boolean) {
    this.send({
      type: 'toggle_ready',
      payload: { isReady },
    });
  }

  public startRace() {
    this.send({
      type: 'start_race',
    });
  }

  public sendTelemetry(telemetry: {
    progress: number;
    lap: number;
    speedKmh: number;
    lateralOffset: number;
    position: number;
  }) {
    this.send({
      type: 'player_telemetry',
      payload: telemetry,
    });
  }

  public sendFinish(finishTime: number) {
    this.send({
      type: 'player_finished',
      payload: { finishTime },
    });
  }

  public sendChat(text: string) {
    if (!text.trim()) return;
    this.send({
      type: 'chat_message',
      payload: { text },
    });
  }

  public leaveRoom() {
    this.send({ type: 'leave_room' });
    this.currentRoom = null;
    this.localPlayerId = null;
    this.notifyRoom();
  }

  private send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
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
