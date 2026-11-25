import type { HouseExteriorProfile } from '../game/cityTrafficBuilder';
import {
  FloorActivityKind,
  getHomeFurnishingById,
  InteriorPropKind,
} from '../game/homeFurnishings';

export type HeistFloorId = number; // 0 = Basement (B1), 1..N = 1F..NF (unlimited floors)

export interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: InteriorPropKind;
}

export interface FloorZoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FloorRug {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  borderColor: string;
}

export interface FloorDecor {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'pool_water' | 'fireplace_hearth' | 'rope_line' | 'bath_tile' | 'runner' | 'garage_slab';
  color?: string;
  accent?: string;
}

export interface StairPortal {
  x: number;
  y: number;
  w: number;
  h: number;
  targetFloor: HeistFloorId;
  exitX: number;
  exitY: number;
  dir: 'up' | 'down';
  label: string;
}

export interface ElevatorPortal {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface VaultSpec {
  id: string;
  floor: HeistFloorId;
  label: string;
  doorRect: { x: number; y: number; w: number; h: number };
  lootZone: { x: number; y: number; radius: number };
  cashShare: number;
}

export interface FloorNpcSpec {
  id: string;
  floor: HeistFloorId;
  name: string;
  roleLabel: string;
  x: number;
  y: number;
  facing: number;
  shirtColor: string;
  hairColor: string;
  dialogue: string;
  serviceAction?: {
    label: string;
    rewardCash?: number;
    kind: 'rest' | 'teller' | 'appraise' | 'tune';
  };
}

export interface FloorActivitySpec {
  id: string;
  floor: HeistFloorId;
  kind: FloorActivityKind;
  label: string;
  x: number;
  y: number;
  radius: number;
}

export interface EmptyGameSlot {
  id: string;
  floor: HeistFloorId;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface HeistFloorData {
  floorId: HeistFloorId;
  floorName: string;
  playableZones: FloorZoneRect[];
  rugs: FloorRug[];
  decors: FloorDecor[];
  obstacles: WallRect[];
  waypoints: { x: number; y: number }[];
  stairs: StairPortal[];
  elevators?: ElevatorPortal[];
  npcs: FloorNpcSpec[];
  activities: FloorActivitySpec[];
  emptySlots?: EmptyGameSlot[];
}

export interface HeistTheme {
  exteriorBg: string;
  floorTileA: string;
  floorTileB: string;
  tileSize: number;
  vaultTileA: string;
  vaultTileB: string;
  wallFill: string;
  wallStroke: string;
  interiorWallFill: string;
  interiorWallStroke: string;
  counterWood: string;
  counterTop: string;
  accentColor: string;
  lootVisual: 'gold_cash' | 'diamonds' | 'tech_gear' | 'wall_safe' | 'prize_tickets';
  vaultLabel: string;
  tierBadge: string;
}

export interface BuildingFloorplan {
  id: string;
  archetypeLabel: string;
  worldWidth?: number;
  worldHeight?: number;
  availableFloors: HeistFloorId[];
  floorsById: Partial<Record<HeistFloorId, HeistFloorData>>;
  playerSpawn: { floor: HeistFloorId; x: number; y: number };
  entryDoorRect: { x: number; y: number; w: number; h: number };
  vaults: VaultSpec[];
  botSpawns: Array<{ floor: HeistFloorId; x: number; y: number; role: 'GUARD' | 'CAPTAIN' }>;
  policeBreachCount: number;
  theme: HeistTheme;
}

export interface FloorplanTargetDescriptor {
  id: string;
  name: string;
  category?: 'BANK' | 'JEWELRY' | 'STORE' | 'HOUSE' | 'SERVICE' | 'POLICE' | 'BUILDING';
  payoutCash: number;
  buildingHeight?: number;
  buildingStories?: number;
  exteriorProfile?: HouseExteriorProfile;
  furnishings?: string[];
}

export function getPoliceBreachCount(
  category: FloorplanTargetDescriptor['category'],
  payoutCash: number
): number {
  if (payoutCash >= 50000) return 7;
  if (payoutCash >= 36000) return 6;
  if (payoutCash >= 22000 || category === 'BANK') return 5;
  if (payoutCash >= 12000 || category === 'JEWELRY') return 4;
  return 3;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function splitPayoutShares(total: number, count: number): number[] {
  if (count <= 1) return [total];
  const base = Math.floor(total / count);
  const shares: number[] = [];
  let remaining = total;
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      shares.push(remaining);
    } else {
      shares.push(base);
      remaining -= base;
    }
  }
  return shares;
}

// Color tinting helpers so house interiors truly match their 3D exterior siding & roof
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return [148, 163, 184];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

// ============================================================================
// 1. BANKS
// ============================================================================

function buildBankCentralPlan(payoutCash: number): BuildingFloorplan {
  // Large 3-Story Federal Reserve Tower (1200x760): 1F Rotunda & Vault + 2F Treasury Clearing Hall + 3F Bond Depository Vault + Express Elevator
  const shares = splitPayoutShares(payoutCash, 2);

  const f1Playable: FloorZoneRect[] = [
    { x: 40, y: 24, w: 1120, h: 436 },
    { x: 240, y: 460, w: 720, h: 276 },
  ];
  const f1Obstacles: WallRect[] = [
    { x: 0, y: 460, w: 240, h: 300, kind: 'wall' },
    { x: 960, y: 460, w: 240, h: 300, kind: 'wall' },
    // North Federal Vault
    { x: 410, y: 24, w: 22, h: 128, kind: 'vault_wall' },
    { x: 768, y: 24, w: 22, h: 128, kind: 'vault_wall' },
    { x: 410, y: 132, w: 124, h: 22, kind: 'vault_wall' },
    { x: 666, y: 132, w: 124, h: 22, kind: 'vault_wall' },
    // East & West Teller Bars
    { x: 84, y: 265, w: 190, h: 28, kind: 'counter' },
    { x: 926, y: 265, w: 190, h: 28, kind: 'counter' },
    // Marble Rotunda Columns
    { x: 360, y: 280, w: 44, h: 44, kind: 'pillar' },
    { x: 796, y: 280, w: 44, h: 44, kind: 'pillar' },
    { x: 360, y: 470, w: 44, h: 44, kind: 'pillar' },
    { x: 796, y: 470, w: 44, h: 44, kind: 'pillar' },
    // Central Security Desk
    { x: 540, y: 382, w: 120, h: 32, kind: 'desk' },
  ];

  const f2Playable: FloorZoneRect[] = [{ x: 64, y: 28, w: 1072, h: 704 }];
  const f2Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 64, h: 760, kind: 'wall' },
    { x: 1136, y: 0, w: 64, h: 760, kind: 'wall' },
    { x: 310, y: 220, w: 44, h: 44, kind: 'pillar' },
    { x: 846, y: 220, w: 44, h: 44, kind: 'pillar' },
    { x: 310, y: 470, w: 44, h: 44, kind: 'pillar' },
    { x: 846, y: 470, w: 44, h: 44, kind: 'pillar' },
    { x: 470, y: 155, w: 260, h: 38, kind: 'desk' },
    { x: 470, y: 410, w: 260, h: 32, kind: 'counter' },
    { x: 120, y: 330, w: 130, h: 42, kind: 'sofa' },
  ];

  const f3Playable: FloorZoneRect[] = [{ x: 120, y: 28, w: 960, h: 704 }];
  const f3Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 120, h: 760, kind: 'wall' },
    { x: 1080, y: 0, w: 120, h: 760, kind: 'wall' },
    // 3F Executive Bond Vault
    { x: 410, y: 28, w: 22, h: 128, kind: 'vault_wall' },
    { x: 768, y: 28, w: 22, h: 128, kind: 'vault_wall' },
    { x: 410, y: 136, w: 124, h: 22, kind: 'vault_wall' },
    { x: 666, y: 136, w: 124, h: 22, kind: 'vault_wall' },
    { x: 195, y: 310, w: 180, h: 24, kind: 'interior_wall' },
    { x: 825, y: 310, w: 180, h: 24, kind: 'interior_wall' },
    { x: 525, y: 415, w: 150, h: 38, kind: 'desk' },
  ];

  return {
    id: 'bank_central',
    archetypeLabel: '3-STORY GRAND FEDERAL RESERVE (ELEVATOR · 2 VAULTS)',
    worldWidth: 1200,
    worldHeight: 760,
    availableFloors: [1, 2, 3],
    floorsById: {
      1: {
        floorId: 1,
        floorName: '1F · FEDERAL MARBLE ROTUNDA & MAIN BULLION VAULT',
        playableZones: f1Playable,
        rugs: [{ x: 545, y: 158, w: 110, h: 558, color: '#7f1d1d', borderColor: '#eab308' }],
        decors: [
          { x: 110, y: 195, w: 145, h: 8, kind: 'rope_line', color: '#991b1b', accent: '#facc15' },
          { x: 945, y: 195, w: 145, h: 8, kind: 'rope_line', color: '#991b1b', accent: '#facc15' },
        ],
        obstacles: f1Obstacles,
        waypoints: [
          { x: 600, y: 635 },
          { x: 600, y: 480 },
          { x: 470, y: 350 },
          { x: 730, y: 350 },
          { x: 200, y: 365 },
          { x: 1000, y: 365 },
          { x: 230, y: 125 },
          { x: 970, y: 160 },
          { x: 600, y: 210 },
        ],
        stairs: [
          {
            x: 68,
            y: 48,
            w: 88,
            h: 74,
            targetFloor: 2,
            exitX: 900,
            exitY: 625,
            dir: 'up',
            label: '2F CLEARING',
          },
        ],
        elevators: [{ x: 1024, y: 48, w: 88, h: 74, label: 'RESERVE LIFT' }],
        npcs: [
          {
            id: 'teller_w',
            floor: 1,
            name: 'Evelyn Cho',
            roleLabel: 'Head Bank Teller',
            x: 175,
            y: 230,
            facing: Math.PI / 2,
            shirtColor: '#1d4ed8',
            hairColor: '#1e1b4b',
            dialogue: 'Welcome to the grand Baltimore Federal Reserve! Use the NE Express Elevator or NW Stairs to tour 1F–3F.',
            serviceAction: { label: 'Check Account Bonus (+$250)', rewardCash: 250, kind: 'teller' },
          },
          {
            id: 'teller_e',
            floor: 1,
            name: 'Marcus Vance',
            roleLabel: 'Branch Manager',
            x: 1020,
            y: 230,
            facing: Math.PI / 2,
            shirtColor: '#334155',
            hairColor: '#451a03',
            dialogue: 'Our 1F Federal Bullion Vault and 3F Bond Depository protect millions in reserve bullion.',
          },
          {
            id: 'cust_1',
            floor: 1,
            name: 'Derrick',
            roleLabel: 'Customer',
            x: 470,
            y: 575,
            facing: -Math.PI / 2,
            shirtColor: '#0f766e',
            hairColor: '#090d16',
            dialogue: 'Waiting on a business wire transfer—these marble halls are huge!',
          },
        ],
        activities: [
          {
            id: 'bank_teller_work',
            floor: 1,
            kind: 'work_bank',
            label: '🏦 Teller Window & Wire Shift',
            x: 175,
            y: 325,
            radius: 30,
          },
          {
            id: 'bank_arcade',
            floor: 1,
            kind: 'arcade',
            label: '🏦 Bank Vault Security Sim',
            x: 1020,
            y: 375,
            radius: 28,
          },
        ],
      },
      2: {
        floorId: 2,
        floorName: '2F · FEDERAL CLEARING FLOOR & EXECUTIVE OFFICES',
        playableZones: f2Playable,
        rugs: [{ x: 400, y: 230, w: 400, h: 155, color: '#1e3a8a', borderColor: '#facc15' }],
        decors: [],
        obstacles: f2Obstacles,
        waypoints: [
          { x: 900, y: 625 },
          { x: 600, y: 585 },
          { x: 600, y: 310 },
          { x: 245, y: 150 },
          { x: 955, y: 330 },
        ],
        stairs: [
          {
            x: 960,
            y: 590,
            w: 88,
            h: 74,
            targetFloor: 1,
            exitX: 215,
            exitY: 96,
            dir: 'down',
            label: '1F ROTUNDA',
          },
          {
            x: 92,
            y: 48,
            w: 88,
            h: 74,
            targetFloor: 3,
            exitX: 830,
            exitY: 625,
            dir: 'up',
            label: '3F BOND VAULT',
          },
        ],
        elevators: [{ x: 1018, y: 48, w: 88, h: 74, label: 'RESERVE LIFT' }],
        npcs: [
          {
            id: 'fed_analyst_2f',
            floor: 2,
            name: 'Jordan Mercer',
            roleLabel: 'Wire Clearing Officer',
            x: 600,
            y: 120,
            facing: Math.PI / 2,
            shirtColor: '#1e40af',
            hairColor: '#0f172a',
            dialogue: 'All 2F clearing desks balance regional treasury transfers—hop in the NE elevator straight to 3F!',
          },
        ],
        activities: [
          {
            id: 'bank_2f_clearing_work',
            floor: 2,
            kind: 'work_office',
            label: '💼 2F Federal Clearing Desk (Work)',
            x: 600,
            y: 230,
            radius: 30,
          },
          {
            id: 'bank_2f_pinball',
            floor: 2,
            kind: 'pinball',
            label: '⚡ Staff Lounge Pinball',
            x: 185,
            y: 420,
            radius: 28,
          },
        ],
      },
      3: {
        floorId: 3,
        floorName: '3F · EXECUTIVE BOND DEPOSITORY VAULT',
        playableZones: f3Playable,
        rugs: [{ x: 520, y: 165, w: 160, h: 220, color: '#7f1d1d', borderColor: '#facc15' }],
        decors: [{ x: 430, y: 195, w: 340, h: 8, kind: 'rope_line', color: '#991b1b', accent: '#facc15' }],
        obstacles: f3Obstacles,
        waypoints: [
          { x: 830, y: 625 },
          { x: 600, y: 550 },
          { x: 600, y: 245 },
          { x: 300, y: 225 },
          { x: 900, y: 225 },
        ],
        stairs: [
          {
            x: 890,
            y: 590,
            w: 88,
            h: 74,
            targetFloor: 2,
            exitX: 235,
            exitY: 96,
            dir: 'down',
            label: '2F CLEARING',
          },
        ],
        elevators: [{ x: 964, y: 48, w: 88, h: 74, label: 'RESERVE LIFT' }],
        npcs: [
          {
            id: 'fed_director_3f',
            floor: 3,
            name: 'Director Sterling',
            roleLabel: 'Reserve Director',
            x: 600,
            y: 368,
            facing: Math.PI / 2,
            shirtColor: '#0f172a',
            hairColor: '#cbd5e1',
            dialogue: 'Welcome to the 3rd-floor executive bond depository overlooking Downtown Baltimore!',
          },
        ],
        activities: [],
      },
    },
    playerSpawn: { floor: 1, x: 600, y: 678 },
    entryDoorRect: { x: 530, y: 736, w: 140, h: 18 },
    vaults: [
      {
        id: 'vault_central',
        floor: 1,
        label: '1F FEDERAL BULLION VAULT',
        doorRect: { x: 534, y: 132, w: 132, h: 22 },
        lootZone: { x: 600, y: 76, radius: 42 },
        cashShare: shares[0],
      },
      {
        id: 'vault_central_3f',
        floor: 3,
        label: '3F BOND DEPOSITORY VAULT',
        doorRect: { x: 534, y: 136, w: 132, h: 22 },
        lootZone: { x: 600, y: 80, radius: 40 },
        cashShare: shares[1],
      },
    ],
    botSpawns: [
      { floor: 1, x: 245, y: 180, role: 'GUARD' },
      { floor: 1, x: 945, y: 180, role: 'GUARD' },
      { floor: 1, x: 600, y: 235, role: 'CAPTAIN' },
      { floor: 2, x: 420, y: 330, role: 'GUARD' },
      { floor: 2, x: 780, y: 330, role: 'GUARD' },
      { floor: 3, x: 350, y: 230, role: 'GUARD' },
      { floor: 3, x: 850, y: 230, role: 'CAPTAIN' },
    ],
    policeBreachCount: getPoliceBreachCount('BANK', payoutCash),
    theme: {
      exteriorBg: '#090d16',
      floorTileA: '#1f2937',
      floorTileB: '#283548',
      tileSize: 36,
      vaultTileA: '#1e293b',
      vaultTileB: '#0f172a',
      wallFill: '#0b1120',
      wallStroke: '#64748b',
      interiorWallFill: '#334155',
      interiorWallStroke: '#94a3b8',
      counterWood: '#78350f',
      counterTop: '#d97706',
      accentColor: '#facc15',
      lootVisual: 'gold_cash',
      vaultLabel: 'FEDERAL RESERVE VAULTS',
      tierBadge: '3-STORY GRAND RESERVE · ELEVATOR',
    },
  };
}

function buildBankPacificBullionPlan(payoutCash: number): BuildingFloorplan {
  // Large 4-Level State Treasury Capitol (1200x760): B1 Sub-Vault + 1F Rotunda Vault + 2F Mint Mezzanine + 3F Bullion Dome + Express Elevator
  const shares = splitPayoutShares(payoutCash, 3);

  const b1Playable: FloorZoneRect[] = [{ x: 120, y: 28, w: 960, h: 704 }];
  const b1Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 120, h: 760, kind: 'wall' },
    { x: 1080, y: 0, w: 120, h: 760, kind: 'wall' },
    { x: 410, y: 28, w: 22, h: 128, kind: 'vault_wall' },
    { x: 768, y: 28, w: 22, h: 128, kind: 'vault_wall' },
    { x: 410, y: 136, w: 124, h: 22, kind: 'vault_wall' },
    { x: 666, y: 136, w: 124, h: 22, kind: 'vault_wall' },
    { x: 270, y: 340, w: 42, h: 42, kind: 'pillar' },
    { x: 888, y: 340, w: 42, h: 42, kind: 'pillar' },
    { x: 525, y: 440, w: 150, h: 34, kind: 'desk' },
  ];

  const f1Playable: FloorZoneRect[] = [{ x: 56, y: 28, w: 1088, h: 704 }];
  const f1Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 56, h: 760, kind: 'wall' },
    { x: 1144, y: 0, w: 56, h: 760, kind: 'wall' },
    // 1F Vault in NW alcove
    { x: 96, y: 28, w: 20, h: 126, kind: 'vault_wall' },
    { x: 340, y: 28, w: 20, h: 126, kind: 'vault_wall' },
    { x: 96, y: 134, w: 66, h: 22, kind: 'vault_wall' },
    { x: 294, y: 134, w: 66, h: 22, kind: 'vault_wall' },
    // Columns
    { x: 310, y: 270, w: 42, h: 42, kind: 'pillar' },
    { x: 848, y: 270, w: 42, h: 42, kind: 'pillar' },
    { x: 310, y: 495, w: 42, h: 42, kind: 'pillar' },
    { x: 848, y: 495, w: 42, h: 42, kind: 'pillar' },
    // Counters & Desk
    { x: 96, y: 365, w: 135, h: 28, kind: 'counter' },
    { x: 810, y: 350, w: 230, h: 24, kind: 'interior_wall' },
    { x: 530, y: 385, w: 140, h: 32, kind: 'desk' },
    { x: 470, y: 150, w: 260, h: 26, kind: 'counter' },
  ];

  const f2Playable: FloorZoneRect[] = [{ x: 110, y: 28, w: 980, h: 704 }];
  const f2Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 110, h: 760, kind: 'wall' },
    { x: 1090, y: 0, w: 110, h: 760, kind: 'wall' },
    { x: 195, y: 325, w: 185, h: 24, kind: 'interior_wall' },
    { x: 820, y: 325, w: 185, h: 24, kind: 'interior_wall' },
    { x: 420, y: 265, w: 42, h: 42, kind: 'pillar' },
    { x: 738, y: 265, w: 42, h: 42, kind: 'pillar' },
    { x: 520, y: 455, w: 160, h: 34, kind: 'desk' },
  ];

  const f3Playable: FloorZoneRect[] = [{ x: 130, y: 28, w: 940, h: 704 }];
  const f3Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 130, h: 760, kind: 'wall' },
    { x: 1070, y: 0, w: 130, h: 760, kind: 'wall' },
    // 3F Capitol Gold Bullion Vault
    { x: 410, y: 28, w: 22, h: 128, kind: 'vault_wall' },
    { x: 768, y: 28, w: 22, h: 128, kind: 'vault_wall' },
    { x: 410, y: 136, w: 124, h: 22, kind: 'vault_wall' },
    { x: 666, y: 136, w: 124, h: 22, kind: 'vault_wall' },
    { x: 225, y: 315, w: 170, h: 24, kind: 'interior_wall' },
    { x: 805, y: 315, w: 170, h: 24, kind: 'interior_wall' },
    { x: 525, y: 420, w: 150, h: 34, kind: 'desk' },
  ];

  return {
    id: 'bank_pacific_bullion',
    archetypeLabel: '4-LEVEL STATE TREASURY CAPITOL (ELEVATOR · 3 VAULTS)',
    worldWidth: 1200,
    worldHeight: 760,
    availableFloors: [0, 1, 2, 3],
    floorsById: {
      0: {
        floorId: 0,
        floorName: 'B1 · UNDERGROUND CAPITOL SUB-VAULT',
        playableZones: b1Playable,
        rugs: [{ x: 520, y: 170, w: 160, h: 240, color: '#312e81', borderColor: '#facc15' }],
        decors: [{ x: 425, y: 195, w: 350, h: 8, kind: 'rope_line', color: '#1e40af', accent: '#facc15' }],
        obstacles: b1Obstacles,
        waypoints: [
          { x: 830, y: 615 },
          { x: 600, y: 550 },
          { x: 600, y: 245 },
          { x: 350, y: 260 },
          { x: 850, y: 260 },
        ],
        stairs: [
          {
            x: 890,
            y: 590,
            w: 88,
            h: 74,
            targetFloor: 1,
            exitX: 250,
            exitY: 625,
            dir: 'up',
            label: '1F ROTUNDA',
          },
        ],
        elevators: [{ x: 964, y: 48, w: 88, h: 74, label: 'CAPITOL LIFT' }],
        npcs: [
          {
            id: 'treasury_vault_warden',
            floor: 0,
            name: 'Warden Briggs',
            roleLabel: 'Sub-Vault Supervisor',
            x: 600,
            y: 350,
            facing: Math.PI / 2,
            shirtColor: '#334155',
            hairColor: '#94a3b8',
            dialogue: 'Down here in B1 sit the historic Annapolis State Seal ingots.',
          },
        ],
        activities: [],
      },
      1: {
        floorId: 1,
        floorName: '1F · CAPITOL TREASURY ROTUNDA & TELLER VAULT',
        playableZones: f1Playable,
        rugs: [{ x: 520, y: 185, w: 160, h: 525, color: '#1e3a8a', borderColor: '#facc15' }],
        decors: [{ x: 475, y: 205, w: 250, h: 8, kind: 'rope_line', color: '#1e40af', accent: '#facc15' }],
        obstacles: f1Obstacles,
        waypoints: [
          { x: 600, y: 645 },
          { x: 600, y: 500 },
          { x: 228, y: 230 },
          { x: 410, y: 315 },
          { x: 750, y: 315 },
          { x: 960, y: 250 },
          { x: 960, y: 465 },
          { x: 260, y: 560 },
        ],
        stairs: [
          {
            x: 90,
            y: 590,
            w: 88,
            h: 74,
            targetFloor: 0,
            exitX: 830,
            exitY: 625,
            dir: 'down',
            label: 'B1 SUB-VAULT',
          },
          {
            x: 840,
            y: 52,
            w: 88,
            h: 74,
            targetFloor: 2,
            exitX: 840,
            exitY: 625,
            dir: 'up',
            label: '2F MEZZANINE',
          },
        ],
        elevators: [{ x: 1020, y: 52, w: 88, h: 74, label: 'CAPITOL LIFT' }],
        npcs: [
          {
            id: 'treasurer',
            floor: 1,
            name: 'Senator Hale',
            roleLabel: 'Treasury Commissioner',
            x: 600,
            y: 110,
            facing: Math.PI / 2,
            shirtColor: '#1e293b',
            hairColor: '#cbd5e1',
            dialogue: 'State Circle spans 4 grand levels (B1–3F) connected by our NE Express Capitol Elevator!',
          },
          {
            id: 'clerk_annap',
            floor: 1,
            name: 'Claire Lin',
            roleLabel: 'Capitol Docent',
            x: 162,
            y: 325,
            facing: Math.PI / 2,
            shirtColor: '#f59e0b',
            hairColor: '#1e1b4b',
            dialogue: 'Use the NE Capitol Elevator to jump directly between B1, 1F, 2F & 3F!',
          },
        ],
        activities: [
          {
            id: 'capitol_teller_work',
            floor: 1,
            kind: 'work_bank',
            label: '🏦 Treasury Counter Shift',
            x: 600,
            y: 215,
            radius: 30,
          },
          {
            id: 'capitol_arcade',
            floor: 1,
            kind: 'arcade',
            label: '🏛️ Treasury Security Trainer',
            x: 745,
            y: 550,
            radius: 28,
          },
        ],
      },
      2: {
        floorId: 2,
        floorName: '2F · CAPITOL MEZZANINE & MINT EXHIBITION',
        playableZones: f2Playable,
        rugs: [{ x: 525, y: 175, w: 150, h: 500, color: '#78350f', borderColor: '#facc15' }],
        decors: [],
        obstacles: f2Obstacles,
        waypoints: [
          { x: 840, y: 625 },
          { x: 600, y: 580 },
          { x: 600, y: 375 },
          { x: 320, y: 240 },
          { x: 785, y: 165 },
          { x: 280, y: 450 },
        ],
        stairs: [
          {
            x: 150,
            y: 590,
            w: 88,
            h: 74,
            targetFloor: 1,
            exitX: 790,
            exitY: 165,
            dir: 'down',
            label: '1F ROTUNDA',
          },
          {
            x: 840,
            y: 52,
            w: 88,
            h: 74,
            targetFloor: 3,
            exitX: 830,
            exitY: 625,
            dir: 'up',
            label: '3F BULLION DOME',
          },
        ],
        elevators: [{ x: 970, y: 52, w: 88, h: 74, label: 'CAPITOL LIFT' }],
        npcs: [
          {
            id: 'curator_2f',
            floor: 2,
            name: 'Archivist Grant',
            roleLabel: 'Bullion Curator',
            x: 600,
            y: 165,
            facing: Math.PI / 2,
            shirtColor: '#78350f',
            hairColor: '#64748b',
            dialogue: 'Our top-floor Gold Bullion Reserve sits one flight up on 3F!',
          },
        ],
        activities: [
          {
            id: 'capitol_2f_pool',
            floor: 2,
            kind: 'table_tennis',
            label: '🏓 Staff Break Ping-Pong',
            x: 310,
            y: 455,
            radius: 28,
          },
        ],
      },
      3: {
        floorId: 3,
        floorName: '3F · DOME BULLION RESERVE VAULT',
        playableZones: f3Playable,
        rugs: [{ x: 520, y: 170, w: 160, h: 250, color: '#78350f', borderColor: '#facc15' }],
        decors: [{ x: 425, y: 195, w: 350, h: 8, kind: 'rope_line', color: '#991b1b', accent: '#facc15' }],
        obstacles: f3Obstacles,
        waypoints: [
          { x: 830, y: 625 },
          { x: 600, y: 550 },
          { x: 600, y: 250 },
          { x: 350, y: 245 },
          { x: 850, y: 245 },
        ],
        stairs: [
          {
            x: 160,
            y: 590,
            w: 88,
            h: 74,
            targetFloor: 2,
            exitX: 790,
            exitY: 165,
            dir: 'down',
            label: '2F MEZZANINE',
          },
        ],
        elevators: [{ x: 964, y: 52, w: 88, h: 74, label: 'CAPITOL LIFT' }],
        npcs: [],
        activities: [],
      },
    },
    playerSpawn: { floor: 1, x: 600, y: 678 },
    entryDoorRect: { x: 530, y: 734, w: 140, h: 18 },
    vaults: [
      {
        id: 'vault_capitol_b1',
        floor: 0,
        label: 'B1 SUB-VAULT',
        doorRect: { x: 534, y: 136, w: 132, h: 22 },
        lootZone: { x: 600, y: 80, radius: 40 },
        cashShare: shares[0],
      },
      {
        id: 'vault_capitol_1f',
        floor: 1,
        label: '1F LOBBY RESERVE VAULT',
        doorRect: { x: 162, y: 134, w: 132, h: 22 },
        lootZone: { x: 228, y: 78, radius: 38 },
        cashShare: shares[1],
      },
      {
        id: 'vault_capitol_3f',
        floor: 3,
        label: '3F STATE BULLION VAULT',
        doorRect: { x: 534, y: 136, w: 132, h: 22 },
        lootZone: { x: 600, y: 80, radius: 40 },
        cashShare: shares[2],
      },
    ],
    botSpawns: [
      { floor: 0, x: 365, y: 255, role: 'GUARD' },
      { floor: 0, x: 835, y: 255, role: 'CAPTAIN' },
      { floor: 1, x: 228, y: 230, role: 'GUARD' },
      { floor: 1, x: 960, y: 255, role: 'GUARD' },
      { floor: 1, x: 745, y: 455, role: 'CAPTAIN' },
      { floor: 2, x: 600, y: 295, role: 'GUARD' },
      { floor: 3, x: 365, y: 235, role: 'GUARD' },
      { floor: 3, x: 835, y: 235, role: 'CAPTAIN' },
    ],
    policeBreachCount: getPoliceBreachCount('BANK', payoutCash),
    theme: {
      exteriorBg: '#0c101d',
      floorTileA: '#1e293b',
      floorTileB: '#2b394f',
      tileSize: 36,
      vaultTileA: '#312e81',
      vaultTileB: '#1e1b4b',
      wallFill: '#111827',
      wallStroke: '#fbbf24',
      interiorWallFill: '#334155',
      interiorWallStroke: '#cbd5e1',
      counterWood: '#713f12',
      counterTop: '#eab308',
      accentColor: '#f59e0b',
      lootVisual: 'gold_cash',
      vaultLabel: 'STATE TREASURY VAULTS',
      tierBadge: '4-LEVEL GRAND CAPITOL · ELEVATOR',
    },
  };
}

function buildBankNationalHarborPlan(payoutCash: number): BuildingFloorplan {
  // Asymmetric Waterfront Grand Hall (Left) + Armored Reserve & Bullion Cage (Right Wing) — wide 88px+ doorways!
  const playableZones: FloorZoneRect[] = [
    { x: 24, y: 44, w: 476, h: 456 },
    { x: 500, y: 20, w: 276, h: 480 },
  ];
  const obstacles: WallRect[] = [
    { x: 0, y: 0, w: 500, h: 44, kind: 'wall' },
    // VIP Sports & Recreation Lounge Tables
    { x: 86, y: 120, w: 112, h: 56, kind: 'air_hockey_table' },
    { x: 282, y: 120, w: 118, h: 58, kind: 'pool_table' },
    { x: 92, y: 268, w: 96, h: 46, kind: 'table' },
    { x: 292, y: 268, w: 96, h: 46, kind: 'sofa' },
    // Divider with TWO wide openings (top y:44..145 = 101px, mid y:245..355 = 110px)
    { x: 486, y: 145, w: 20, h: 100, kind: 'interior_wall' },
    { x: 486, y: 355, w: 20, h: 145, kind: 'interior_wall' },
    // Right Wing Vault
    { x: 530, y: 20, w: 20, h: 108, kind: 'vault_wall' },
    { x: 730, y: 20, w: 20, h: 108, kind: 'vault_wall' },
    { x: 530, y: 108, w: 52, h: 20, kind: 'vault_wall' },
    { x: 684, y: 108, w: 66, h: 20, kind: 'vault_wall' },
    { x: 562, y: 248, w: 142, h: 24, kind: 'counter' },
  ];

  return {
    id: 'bank_national_harbor',
    archetypeLabel: 'WATERFRONT RESERVE BANK & REC LOUNGE',
    availableFloors: [1],
    floorsById: {
      1: {
        floorId: 1,
        floorName: '1F · NATIONAL HARBOR RESERVE CONCOURSE & VAULT',
        playableZones,
        rugs: [
          { x: 46, y: 74, w: 416, h: 396, color: '#1e3a8a', borderColor: '#f59e0b' },
          { x: 540, y: 140, w: 190, h: 330, color: '#7f1d1d', borderColor: '#facc15' },
        ],
        decors: [{ x: 552, y: 195, w: 164, h: 8, kind: 'rope_line', color: '#991b1b', accent: '#facc15' }],
        obstacles,
        waypoints: [
          { x: 245, y: 440 },
          { x: 245, y: 315 },
          { x: 245, y: 195 },
          { x: 245, y: 92 },
          { x: 440, y: 92 },
          { x: 550, y: 170 },
          { x: 632, y: 165 },
          { x: 555, y: 305 },
          { x: 632, y: 365 },
        ],
        stairs: [],
        npcs: [
          {
            id: 'harbor_host',
            floor: 1,
            name: 'Vic Reyes',
            roleLabel: 'Lounge Host',
            x: 138,
            y: 92,
            facing: Math.PI / 2,
            shirtColor: '#0284c7',
            hairColor: '#111827',
            dialogue: 'Free-play Air Hockey and 8-Ball Billiards are open in the Waterfront Lounge!',
          },
          {
            id: 'harbor_cashier',
            floor: 1,
            name: 'Nadia Cruz',
            roleLabel: 'Reserve Cashier',
            x: 632,
            y: 222,
            facing: Math.PI / 2,
            shirtColor: '#7c3aed',
            hairColor: '#451a03',
            dialogue: 'National Harbor Reserve handles Potomac waterfront hospitality deposits!',
          },
        ],
        activities: [
          {
            id: 'harbor_bank_work',
            floor: 1,
            kind: 'work_bank',
            label: '🏦 Reserve Teller Shift',
            x: 632,
            y: 305,
            radius: 30,
          },
          {
            id: 'harbor_air_hockey',
            floor: 1,
            kind: 'air_hockey',
            label: '🏒 Championship Air Hockey',
            x: 142,
            y: 205,
            radius: 30,
          },
          {
            id: 'harbor_pool_8ball',
            floor: 1,
            kind: 'pool_8ball',
            label: '🎱 Harbor 8-Ball Billiards',
            x: 340,
            y: 205,
            radius: 30,
          },
        ],
      },
    },
    playerSpawn: { floor: 1, x: 245, y: 452 },
    entryDoorRect: { x: 190, y: 496, w: 110, h: 16 },
    vaults: [
      {
        id: 'vault_harbor',
        floor: 1,
        label: 'WATERFRONT BULLION VAULT',
        doorRect: { x: 582, y: 108, w: 102, h: 20 },
        lootZone: { x: 632, y: 66, radius: 34 },
        cashShare: payoutCash,
      },
    ],
    botSpawns: [
      { floor: 1, x: 245, y: 195, role: 'GUARD' },
      { floor: 1, x: 430, y: 205, role: 'GUARD' },
      { floor: 1, x: 632, y: 175, role: 'CAPTAIN' },
      { floor: 1, x: 685, y: 225, role: 'CAPTAIN' },
      { floor: 1, x: 120, y: 375, role: 'GUARD' },
      { floor: 1, x: 370, y: 375, role: 'GUARD' },
      { floor: 1, x: 570, y: 405, role: 'GUARD' },
    ],
    policeBreachCount: getPoliceBreachCount('BANK', payoutCash),
    theme: {
      exteriorBg: '#0c1022',
      floorTileA: '#1e293b',
      floorTileB: '#2a3950',
      tileSize: 32,
      vaultTileA: '#312e81',
      vaultTileB: '#1e1b4b',
      wallFill: '#0f172a',
      wallStroke: '#f97316',
      interiorWallFill: '#334155',
      interiorWallStroke: '#f59e0b',
      counterWood: '#7c2d12',
      counterTop: '#fb923c',
      accentColor: '#f97316',
      lootVisual: 'gold_cash',
      vaultLabel: 'WATERFRONT BULLION VAULT',
      tierBadge: 'RESERVE VAULT',
    },
  };
}

function buildBankFrederickTrustPlan(payoutCash: number): BuildingFloorplan {
  const playableZones: FloorZoneRect[] = [{ x: 36, y: 24, w: 728, h: 472 }];
  const obstacles: WallRect[] = [
    { x: 0, y: 0, w: 36, h: 520, kind: 'wall' },
    { x: 764, y: 0, w: 36, h: 520, kind: 'wall' },
    // Brick Vault in NW
    { x: 64, y: 24, w: 20, h: 104, kind: 'vault_wall' },
    { x: 266, y: 24, w: 20, h: 104, kind: 'vault_wall' },
    { x: 64, y: 108, w: 54, h: 20, kind: 'vault_wall' },
    { x: 214, y: 108, w: 72, h: 20, kind: 'vault_wall' },
    // Mahogany Divider with wide doorway
    { x: 465, y: 24, w: 20, h: 150, kind: 'interior_wall' },
    { x: 465, y: 255, w: 20, h: 90, kind: 'interior_wall' },
    { x: 560, y: 120, w: 120, h: 52, kind: 'desk' },
    { x: 84, y: 265, w: 280, h: 24, kind: 'counter' },
    { x: 540, y: 315, w: 120, h: 32, kind: 'table' },
  ];

  return {
    id: 'bank_frederick_trust',
    archetypeLabel: 'HISTORIC MAHOGANY TRUST BANK',
    availableFloors: [1],
    floorsById: {
      1: {
        floorId: 1,
        floorName: '1F · CARROLL CREEK HISTORIC TRUST PARLOR',
        playableZones,
        rugs: [
          { x: 525, y: 78, w: 195, h: 165, color: '#14532d', borderColor: '#f59e0b' },
          { x: 115, y: 325, w: 310, h: 140, color: '#7c2d12', borderColor: '#fde047' },
        ],
        decors: [{ x: 105, y: 195, w: 220, h: 8, kind: 'rope_line', color: '#78350f', accent: '#fbbf24' }],
        obstacles,
        waypoints: [
          { x: 400, y: 420 },
          { x: 410, y: 215 },
          { x: 165, y: 165 },
          { x: 520, y: 215 },
          { x: 640, y: 245 },
          { x: 160, y: 365 },
        ],
        stairs: [],
        npcs: [
          {
            id: 'fred_banker',
            floor: 1,
            name: 'Arthur Carroll',
            roleLabel: 'Historic Banker',
            x: 220,
            y: 235,
            facing: Math.PI / 2,
            shirtColor: '#78350f',
            hairColor: '#e2e8f0',
            dialogue: 'Founded right on Carroll Creek in 1894—step into our oak parlor anytime.',
            serviceAction: { label: 'Collect Historic Dividend (+$200)', rewardCash: 200, kind: 'teller' },
          },
        ],
        activities: [
          {
            id: 'fred_teller_work',
            floor: 1,
            kind: 'work_bank',
            label: '🏦 Trust Teller Counter Shift',
            x: 224,
            y: 315,
            radius: 30,
          },
          {
            id: 'fred_arcade',
            floor: 1,
            kind: 'arcade',
            label: '🕹️ Ledger Reflex Terminal',
            x: 600,
            y: 385,
            radius: 26,
          },
        ],
      },
    },
    playerSpawn: { floor: 1, x: 400, y: 452 },
    entryDoorRect: { x: 344, y: 494, w: 112, h: 16 },
    vaults: [
      {
        id: 'vault_frederick',
        floor: 1,
        label: 'HERITAGE SAFE DEPOSIT VAULT',
        doorRect: { x: 118, y: 108, w: 96, h: 20 },
        lootZone: { x: 165, y: 66, radius: 32 },
        cashShare: payoutCash,
      },
    ],
    botSpawns: [
      { floor: 1, x: 165, y: 170, role: 'GUARD' },
      { floor: 1, x: 375, y: 165, role: 'CAPTAIN' },
      { floor: 1, x: 590, y: 215, role: 'GUARD' },
      { floor: 1, x: 200, y: 355, role: 'GUARD' },
      { floor: 1, x: 580, y: 395, role: 'GUARD' },
    ],
    policeBreachCount: getPoliceBreachCount('BANK', payoutCash),
    theme: {
      exteriorBg: '#1c110b',
      floorTileA: '#3f2818',
      floorTileB: '#4e321f',
      tileSize: 32,
      vaultTileA: '#292524',
      vaultTileB: '#1c1917',
      wallFill: '#29150e',
      wallStroke: '#d97706',
      interiorWallFill: '#5c3317',
      interiorWallStroke: '#f59e0b',
      counterWood: '#78350f',
      counterTop: '#fde68a',
      accentColor: '#fbbf24',
      lootVisual: 'gold_cash',
      vaultLabel: 'HERITAGE SAFE DEPOSIT VAULT',
      tierBadge: 'HISTORIC TRUST',
    },
  };
}

// ============================================================================
// 2. JEWELRY STORES
// ============================================================================

function buildJewelryDiamondExchangePlan(payoutCash: number): BuildingFloorplan {
  const playableZones: FloorZoneRect[] = [
    { x: 110, y: 20, w: 580, h: 480 },
    { x: 40, y: 100, w: 720, h: 320 },
  ];
  const obstacles: WallRect[] = [
    { x: 0, y: 0, w: 110, h: 100, kind: 'wall' },
    { x: 690, y: 0, w: 110, h: 100, kind: 'wall' },
    { x: 0, y: 420, w: 110, h: 100, kind: 'wall' },
    { x: 690, y: 420, w: 110, h: 100, kind: 'wall' },
    { x: 256, y: 20, w: 20, h: 98, kind: 'vault_wall' },
    { x: 524, y: 20, w: 20, h: 98, kind: 'vault_wall' },
    { x: 256, y: 98, w: 94, h: 20, kind: 'vault_wall' },
    { x: 450, y: 98, w: 94, h: 20, kind: 'vault_wall' },
    { x: 118, y: 175, w: 110, h: 32, kind: 'glass_case' },
    { x: 572, y: 175, w: 110, h: 32, kind: 'glass_case' },
    { x: 118, y: 310, w: 110, h: 32, kind: 'glass_case' },
    { x: 572, y: 310, w: 110, h: 32, kind: 'glass_case' },
    { x: 350, y: 235, w: 100, h: 48, kind: 'glass_case' },
  ];

  return {
    id: 'jewelry_diamond_exchange',
    archetypeLabel: 'BEVELED LUXURY DIAMOND SALON',
    availableFloors: [1],
    floorsById: {
      1: {
        floorId: 1,
        floorName: '1F · BETHESDA ROW DIAMOND GALLERY',
        playableZones,
        rugs: [{ x: 280, y: 140, w: 240, h: 245, color: '#3b0764', borderColor: '#e879f9' }],
        decors: [{ x: 320, y: 125, w: 160, h: 8, kind: 'rope_line', color: '#6b21a8', accent: '#f0abfc' }],
        obstacles,
        waypoints: [
          { x: 400, y: 440 },
          { x: 295, y: 345 },
          { x: 505, y: 345 },
          { x: 295, y: 200 },
          { x: 505, y: 200 },
          { x: 110, y: 255 },
          { x: 690, y: 255 },
          { x: 400, y: 155 },
        ],
        stairs: [],
        npcs: [
          {
            id: 'jeweler_beth',
            floor: 1,
            name: 'Celeste Moreau',
            roleLabel: 'Master Gemologist',
            x: 400,
            y: 202,
            facing: Math.PI / 2,
            shirtColor: '#9333ea',
            hairColor: '#fde047',
            dialogue: 'Only flawless GIA diamonds behind bulletproof crystal here on Bethesda Ave.',
            serviceAction: { label: 'Gem Appraisal Tip (+$180)', rewardCash: 180, kind: 'appraise' },
          },
        ],
        activities: [
          {
            id: 'diamond_retail_work',
            floor: 1,
            kind: 'work_retail',
            label: '💎 Gem Sales & Appraisal Shift',
            x: 400,
            y: 315,
            radius: 30,
          },
          {
            id: 'diamond_arcade',
            floor: 1,
            kind: 'arcade',
            label: '💎 Laser Cut Precision Sim',
            x: 170,
            y: 258,
            radius: 26,
          },
        ],
      },
    },
    playerSpawn: { floor: 1, x: 400, y: 454 },
    entryDoorRect: { x: 344, y: 494, w: 112, h: 16 },
    vaults: [
      {
        id: 'vault_bethesda_gems',
        floor: 1,
        label: 'DIAMOND VAULT SHOWROOM',
        doorRect: { x: 350, y: 98, w: 100, h: 20 },
        lootZone: { x: 400, y: 58, radius: 34 },
        cashShare: payoutCash,
      },
    ],
    botSpawns: [
      { floor: 1, x: 160, y: 255, role: 'GUARD' },
      { floor: 1, x: 640, y: 255, role: 'GUARD' },
      { floor: 1, x: 290, y: 170, role: 'GUARD' },
      { floor: 1, x: 510, y: 170, role: 'CAPTAIN' },
      { floor: 1, x: 400, y: 345, role: 'GUARD' },
    ],
    policeBreachCount: getPoliceBreachCount('JEWELRY', payoutCash),
    theme: {
      exteriorBg: '#11091f',
      floorTileA: '#1e1b4b',
      floorTileB: '#2e1065',
      tileSize: 30,
      vaultTileA: '#083344',
      vaultTileB: '#164e63',
      wallFill: '#0f0720',
      wallStroke: '#c084fc',
      interiorWallFill: '#4c1d95',
      interiorWallStroke: '#e879f9',
      counterWood: '#3b0764',
      counterTop: '#67e8f9',
      accentColor: '#c084fc',
      lootVisual: 'diamonds',
      vaultLabel: 'DIAMOND VAULT SHOWROOM',
      tierBadge: 'DIAMOND SALON',
    },
  };
}

function buildJewelryColumbiaMallPlan(payoutCash: number): BuildingFloorplan {
  // L-Wing Mall Jewelry Gallery — unobstructed wide walkways between wings
  const playableZones: FloorZoneRect[] = [
    { x: 24, y: 20, w: 416, h: 478 },
    { x: 440, y: 220, w: 336, h: 278 },
  ];
  const obstacles: WallRect[] = [
    { x: 440, y: 0, w: 360, h: 220, kind: 'wall' },
    { x: 114, y: 20, w: 20, h: 98, kind: 'vault_wall' },
    { x: 356, y: 20, w: 20, h: 98, kind: 'vault_wall' },
    { x: 114, y: 98, w: 80, h: 20, kind: 'vault_wall' },
    { x: 296, y: 98, w: 80, h: 20, kind: 'vault_wall' },
    // Glass Jewelry Displays with >=80px clear walkways all around
    { x: 100, y: 205, w: 85, h: 30, kind: 'glass_case' },
    { x: 280, y: 205, w: 85, h: 30, kind: 'glass_case' },
    { x: 515, y: 290, w: 120, h: 30, kind: 'glass_case' },
    { x: 515, y: 390, w: 120, h: 26, kind: 'counter' },
  ];

  return {
    id: 'jewelry_columbia_mall',
    archetypeLabel: 'L-WING MODERN MALL JEWELRY GALLERY',
    availableFloors: [1],
    floorsById: {
      1: {
        floorId: 1,
        floorName: '1F · COLUMBIA L-WING JEWELRY GALLERY',
        playableZones,
        rugs: [
          { x: 120, y: 125, w: 250, h: 335, color: '#164e63', borderColor: '#22d3ee' },
          { x: 465, y: 255, w: 260, h: 215, color: '#3b0764', borderColor: '#c084fc' },
        ],
        decors: [],
        obstacles,
        waypoints: [
          { x: 245, y: 430 },
          { x: 245, y: 305 },
          { x: 235, y: 160 },
          { x: 70, y: 210 },
          { x: 400, y: 280 },
          { x: 480, y: 350 },
          { x: 690, y: 345 },
        ],
        stairs: [],
        npcs: [
          {
            id: 'col_jeweler',
            floor: 1,
            name: 'Priya Patel',
            roleLabel: 'Boutique Stylist',
            x: 575,
            y: 355,
            facing: Math.PI / 2,
            shirtColor: '#0284c7',
            hairColor: '#090d16',
            dialogue: 'Browse the Columbia Town Center L-Wing collection—let me know if you need sizing!',
          },
        ],
        activities: [
          {
            id: 'col_jewelry_work',
            floor: 1,
            kind: 'work_retail',
            label: '💎 Boutique Register Shift',
            x: 575,
            y: 445,
            radius: 28,
          },
          {
            id: 'col_arcade',
            floor: 1,
            kind: 'arcade',
            label: '💎 Watchmaker Timing Game',
            x: 695,
            y: 345,
            radius: 26,
          },
        ],
      },
    },
    playerSpawn: { floor: 1, x: 245, y: 452 },
    entryDoorRect: { x: 192, y: 492, w: 106, h: 16 },
    vaults: [
      {
        id: 'vault_columbia',
        floor: 1,
        label: 'MALL GALLERY GEM VAULT',
        doorRect: { x: 194, y: 98, w: 102, h: 20 },
        lootZone: { x: 245, y: 60, radius: 32 },
        cashShare: payoutCash,
      },
    ],
    botSpawns: [
      { floor: 1, x: 235, y: 158, role: 'CAPTAIN' },
      { floor: 1, x: 70, y: 220, role: 'GUARD' },
      { floor: 1, x: 420, y: 310, role: 'GUARD' },
      { floor: 1, x: 675, y: 340, role: 'GUARD' },
    ],
    policeBreachCount: getPoliceBreachCount('JEWELRY', payoutCash),
    theme: {
      exteriorBg: '#091420',
      floorTileA: '#162235',
      floorTileB: '#1e2f47',
      tileSize: 32,
      vaultTileA: '#134e4a',
      vaultTileB: '#0f172a',
      wallFill: '#0b1626',
      wallStroke: '#38bdf8',
      interiorWallFill: '#334155',
      interiorWallStroke: '#a855f7',
      counterWood: '#312e81',
      counterTop: '#67e8f9',
      accentColor: '#c084fc',
      lootVisual: 'diamonds',
      vaultLabel: 'MALL GALLERY GEM VAULT',
      tierBadge: 'L-WING GALLERY',
    },
  };
}

function buildJewelryVangelicoPlan(payoutCash: number): BuildingFloorplan {
  // 2-Story Harborplace Showroom + 2F VIP Penthouse Diamond Vault + Elevator
  const f1Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 56, h: 620, kind: 'wall' },
    { x: 904, y: 0, w: 56, h: 620, kind: 'wall' },
    { x: 140, y: 205, w: 165, h: 34, kind: 'glass_case' },
    { x: 615, y: 205, w: 165, h: 34, kind: 'glass_case' },
    { x: 140, y: 375, w: 165, h: 34, kind: 'glass_case' },
    { x: 615, y: 375, w: 165, h: 34, kind: 'glass_case' },
    { x: 424, y: 280, w: 112, h: 36, kind: 'counter' },
  ];
  const f2Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 96, h: 620, kind: 'wall' },
    { x: 864, y: 0, w: 96, h: 620, kind: 'wall' },
    { x: 316, y: 24, w: 20, h: 112, kind: 'vault_wall' },
    { x: 624, y: 24, w: 20, h: 112, kind: 'vault_wall' },
    { x: 316, y: 116, w: 108, h: 20, kind: 'vault_wall' },
    { x: 536, y: 116, w: 108, h: 20, kind: 'vault_wall' },
    { x: 170, y: 265, w: 124, h: 30, kind: 'glass_case' },
    { x: 666, y: 265, w: 124, h: 30, kind: 'glass_case' },
    { x: 420, y: 390, w: 120, h: 36, kind: 'sofa' },
  ];

  return {
    id: 'jewelry_vangelico',
    archetypeLabel: '2-STORY HARBORPLACE JEWELRY PENTHOUSE · ELEVATOR',
    worldWidth: 960,
    worldHeight: 620,
    availableFloors: [1, 2],
    floorsById: {
      1: {
        floorId: 1,
        floorName: '1F · HARBORPLACE GLASS SHOWROOM',
        playableZones: [{ x: 56, y: 24, w: 848, h: 572 }],
        rugs: [{ x: 410, y: 125, w: 140, h: 430, color: '#083344', borderColor: '#22d3ee' }],
        decors: [],
        obstacles: f1Obstacles,
        waypoints: [
          { x: 480, y: 520 },
          { x: 480, y: 390 },
          { x: 480, y: 165 },
          { x: 220, y: 295 },
          { x: 700, y: 295 },
          { x: 740, y: 160 },
        ],
        stairs: [
          {
            x: 790,
            y: 50,
            w: 84,
            h: 72,
            targetFloor: 2,
            exitX: 250,
            exitY: 505,
            dir: 'up',
            label: '2F VIP VAULT',
          },
        ],
        elevators: [{ x: 84, y: 50, w: 82, h: 68, label: 'HARBOR LIFT' }],
        npcs: [
          {
            id: 'harbor_concierge',
            floor: 1,
            name: 'Julian Sterling',
            roleLabel: 'VIP Host',
            x: 480,
            y: 245,
            facing: Math.PI / 2,
            shirtColor: '#0284c7',
            hairColor: '#1e293b',
            dialogue: 'Take the Harbor Lift elevator or grand staircase up to our 2F VIP diamond penthouse.',
          },
        ],
        activities: [
          {
            id: 'harbor_jewelry_work',
            floor: 1,
            kind: 'work_retail',
            label: '💎 Showroom Sales Shift',
            x: 480,
            y: 345,
            radius: 30,
          },
        ],
      },
      2: {
        floorId: 2,
        floorName: '2F · VIP HARBOR PENTHOUSE & DIAMOND VAULT',
        playableZones: [{ x: 96, y: 24, w: 768, h: 572 }],
        rugs: [{ x: 405, y: 155, w: 150, h: 215, color: '#164e63', borderColor: '#67e8f9' }],
        decors: [],
        obstacles: f2Obstacles,
        waypoints: [
          { x: 250, y: 505 },
          { x: 480, y: 480 },
          { x: 480, y: 290 },
          { x: 260, y: 205 },
          { x: 700, y: 205 },
          { x: 480, y: 180 },
        ],
        stairs: [
          {
            x: 130,
            y: 472,
            w: 84,
            h: 72,
            targetFloor: 1,
            exitX: 740,
            exitY: 165,
            dir: 'down',
            label: '1F SHOWROOM',
          },
        ],
        elevators: [{ x: 750, y: 50, w: 82, h: 68, label: 'HARBOR LIFT' }],
        npcs: [],
        activities: [
          {
            id: 'harbor_pool',
            floor: 2,
            kind: 'arcade',
            label: '💎 Sapphire Vault Appraisal Sim',
            x: 232,
            y: 335,
            radius: 26,
          },
        ],
      },
    },
    playerSpawn: { floor: 1, x: 480, y: 540 },
    entryDoorRect: { x: 416, y: 588, w: 128, h: 16 },
    vaults: [
      {
        id: 'vault_vangelico',
        floor: 2,
        label: '2F PENTHOUSE DIAMOND VAULT',
        doorRect: { x: 424, y: 116, w: 112, h: 20 },
        lootZone: { x: 480, y: 70, radius: 34 },
        cashShare: payoutCash,
      },
    ],
    botSpawns: [
      { floor: 1, x: 225, y: 295, role: 'GUARD' },
      { floor: 1, x: 705, y: 295, role: 'GUARD' },
      { floor: 2, x: 290, y: 195, role: 'GUARD' },
      { floor: 2, x: 650, y: 195, role: 'CAPTAIN' },
    ],
    policeBreachCount: getPoliceBreachCount('JEWELRY', payoutCash),
    theme: {
      exteriorBg: '#07141f',
      floorTileA: '#0f293a',
      floorTileB: '#16384d',
      tileSize: 30,
      vaultTileA: '#083344',
      vaultTileB: '#0c4a6e',
      wallFill: '#081b29',
      wallStroke: '#22d3ee',
      interiorWallFill: '#1e3a5f',
      interiorWallStroke: '#67e8f9',
      counterWood: '#0f172a',
      counterTop: '#38bdf8',
      accentColor: '#22d3ee',
      lootVisual: 'diamonds',
      vaultLabel: '2F PENTHOUSE DIAMOND VAULT',
      tierBadge: '2-STORY PENTHOUSE · LIFT',
    },
  };
}

// ============================================================================
// 3. STORES + SERVICE STATIONS + POLICE PRECINCT
// ============================================================================

function buildStoreRioElectronicsPlan(payoutCash: number): BuildingFloorplan {
  const playableZones: FloorZoneRect[] = [{ x: 40, y: 24, w: 720, h: 472 }];
  const obstacles: WallRect[] = [
    { x: 0, y: 0, w: 40, h: 520, kind: 'wall' },
    { x: 760, y: 0, w: 40, h: 520, kind: 'wall' },
    // Stockroom Vault NE (door at bottom y:112..132, wide open!)
    { x: 500, y: 24, w: 20, h: 108, kind: 'vault_wall' },
    { x: 736, y: 24, w: 20, h: 108, kind: 'vault_wall' },
    { x: 500, y: 112, w: 75, h: 20, kind: 'vault_wall' },
    { x: 675, y: 112, w: 81, h: 20, kind: 'vault_wall' },
    // Tech Demo Tables & Register
    { x: 96, y: 155, w: 120, h: 38, kind: 'desk' },
    { x: 290, y: 155, w: 120, h: 38, kind: 'desk' },
    { x: 96, y: 290, w: 120, h: 38, kind: 'desk' },
    { x: 290, y: 290, w: 120, h: 38, kind: 'desk' },
    { x: 540, y: 270, w: 160, h: 24, kind: 'counter' },
  ];

  return {
    id: 'store_rio_electronics',
    archetypeLabel: 'BOUTIQUE TECH FLAGSHIP STORE',
    availableFloors: [1],
    floorsById: {
      1: {
        floorId: 1,
        floorName: '1F · RIO LAKEFRONT TECH SHOWROOM',
        playableZones,
        rugs: [{ x: 78, y: 86, w: 364, h: 325, color: '#0c4a6e', borderColor: '#38bdf8' }],
        decors: [],
        obstacles,
        waypoints: [
          { x: 400, y: 430 },
          { x: 250, y: 240 },
          { x: 470, y: 240 },
          { x: 625, y: 190 },
          { x: 155, y: 240 },
          { x: 625, y: 360 },
        ],
        stairs: [],
        npcs: [
          {
            id: 'rio_clerk',
            floor: 1,
            name: 'Devon Park',
            roleLabel: 'Tech Specialist',
            x: 620,
            y: 242,
            facing: Math.PI / 2,
            shirtColor: '#0284c7',
            hairColor: '#0f172a',
            dialogue: 'Test our Cyber Blaster arcade rigs on the demo tables anytime!',
          },
        ],
        activities: [
          {
            id: 'rio_retail_work',
            floor: 1,
            kind: 'work_retail',
            label: '🛒 Tech Boutique Register Shift',
            x: 620,
            y: 326,
            radius: 30,
          },
          {
            id: 'rio_arcade',
            floor: 1,
            kind: 'arcade',
            label: '🕹️ Play Cyber Blaster Demo Unit',
            x: 350,
            y: 235,
            radius: 30,
          },
        ],
      },
    },
    playerSpawn: { floor: 1, x: 400, y: 452 },
    entryDoorRect: { x: 344, y: 492, w: 112, h: 16 },
    vaults: [
      {
        id: 'vault_rio',
        floor: 1,
        label: 'TECH STOCKROOM SAFE',
        doorRect: { x: 575, y: 112, w: 100, h: 20 },
        lootZone: { x: 625, y: 68, radius: 32 },
        cashShare: payoutCash,
      },
    ],
    botSpawns: [
      { floor: 1, x: 180, y: 240, role: 'GUARD' },
      { floor: 1, x: 455, y: 215, role: 'GUARD' },
      { floor: 1, x: 625, y: 195, role: 'CAPTAIN' },
      { floor: 1, x: 625, y: 355, role: 'GUARD' },
    ],
    policeBreachCount: getPoliceBreachCount('STORE', payoutCash),
    theme: {
      exteriorBg: '#06121e',
      floorTileA: '#172536',
      floorTileB: '#1f3147',
      tileSize: 32,
      vaultTileA: '#082f49',
      vaultTileB: '#0c4a6e',
      wallFill: '#0a1929',
      wallStroke: '#38bdf8',
      interiorWallFill: '#1e3a5f',
      interiorWallStroke: '#7dd3fc',
      counterWood: '#1e293b',
      counterTop: '#38bdf8',
      accentColor: '#38bdf8',
      lootVisual: 'tech_gear',
      vaultLabel: 'TECH STOCKROOM SAFE',
      tierBadge: 'TECH BOUTIQUE',
    },
  };
}

function buildStoreNeonMartPlan(payoutCash: number): BuildingFloorplan {
  const playableZones: FloorZoneRect[] = [
    { x: 24, y: 110, w: 516, h: 388 },
    { x: 540, y: 24, w: 236, h: 474 },
  ];
  const obstacles: WallRect[] = [
    { x: 0, y: 0, w: 540, h: 110, kind: 'wall' },
    { x: 544, y: 24, w: 20, h: 104, kind: 'vault_wall' },
    { x: 752, y: 24, w: 20, h: 104, kind: 'vault_wall' },
    { x: 544, y: 108, w: 58, h: 20, kind: 'vault_wall' },
    { x: 700, y: 108, w: 72, h: 20, kind: 'vault_wall' },
    { x: 50, y: 116, w: 460, h: 24, kind: 'cooler' },
    { x: 96, y: 215, w: 118, h: 26, kind: 'shelf' },
    { x: 280, y: 215, w: 118, h: 26, kind: 'shelf' },
    { x: 96, y: 325, w: 118, h: 26, kind: 'shelf' },
    { x: 280, y: 325, w: 118, h: 26, kind: 'shelf' },
    { x: 590, y: 285, w: 132, h: 24, kind: 'counter' },
  ];

  return {
    id: 'store_neon_mart',
    archetypeLabel: 'OCEAN CITY SUPERETTE & COOLER AISLES',
    availableFloors: [1],
    floorsById: {
      1: {
        floorId: 1,
        floorName: '1F · BOARDWALK SUPERETTE & BACK SAFE',
        playableZones,
        rugs: [{ x: 224, y: 380, w: 128, h: 108, color: '#065f46', borderColor: '#34d399' }],
        decors: [],
        obstacles,
        waypoints: [
          { x: 285, y: 425 },
          { x: 245, y: 280 },
          { x: 465, y: 280 },
          { x: 650, y: 200 },
          { x: 650, y: 370 },
        ],
        stairs: [],
        npcs: [
          {
            id: 'oc_cashier',
            floor: 1,
            name: 'Sammy Shores',
            roleLabel: 'Boardwalk Cashier',
            x: 650,
            y: 256,
            facing: Math.PI / 2,
            shirtColor: '#10b981',
            hairColor: '#fde047',
            dialogue: 'Ice cold drinks in the back coolers, and a vintage arcade cabinet by the snacks!',
          },
        ],
        activities: [
          {
            id: 'oc_retail_work',
            floor: 1,
            kind: 'work_retail',
            label: '🛒 Superette Checkout Shift',
            x: 650,
            y: 340,
            radius: 30,
          },
          {
            id: 'oc_arcade',
            floor: 1,
            kind: 'arcade',
            label: '🕹️ Boardwalk Arcade Cabinet',
            x: 475,
            y: 210,
            radius: 26,
          },
        ],
      },
    },
    playerSpawn: { floor: 1, x: 285, y: 452 },
    entryDoorRect: { x: 232, y: 492, w: 106, h: 16 },
    vaults: [
      {
        id: 'vault_neon_mart',
        floor: 1,
        label: 'SUPERETTE CASH OFFICE SAFE',
        doorRect: { x: 602, y: 108, w: 98, h: 20 },
        lootZone: { x: 650, y: 66, radius: 32 },
        cashShare: payoutCash,
      },
    ],
    botSpawns: [
      { floor: 1, x: 245, y: 280, role: 'GUARD' },
      { floor: 1, x: 460, y: 210, role: 'GUARD' },
      { floor: 1, x: 650, y: 195, role: 'CAPTAIN' },
    ],
    policeBreachCount: getPoliceBreachCount('STORE', payoutCash),
    theme: {
      exteriorBg: '#061914',
      floorTileA: '#133129',
      floorTileB: '#183f35',
      tileSize: 28,
      vaultTileA: '#064e3b',
      vaultTileB: '#022c22',
      wallFill: '#052e16',
      wallStroke: '#10b981',
      interiorWallFill: '#047857',
      interiorWallStroke: '#6ee7b7',
      counterWood: '#065f46',
      counterTop: '#34d399',
      accentColor: '#10b981',
      lootVisual: 'gold_cash',
      vaultLabel: 'SUPERETTE CASH OFFICE SAFE',
      tierBadge: 'BOARDWALK MART',
    },
  };
}

function buildStoreCompactPawnOrMarketPlan(id: string, payoutCash: number, isPawn: boolean): BuildingFloorplan {
  const playableZones: FloorZoneRect[] = [{ x: 170, y: 24, w: 460, h: 474 }];
  const obstacles: WallRect[] = [
    { x: 0, y: 0, w: 170, h: 520, kind: 'wall' },
    { x: 630, y: 0, w: 170, h: 520, kind: 'wall' },
    { x: 274, y: 24, w: 20, h: 102, kind: 'vault_wall' },
    { x: 506, y: 24, w: 20, h: 102, kind: 'vault_wall' },
    { x: 274, y: 106, w: 78, h: 20, kind: 'vault_wall' },
    { x: 448, y: 106, w: 78, h: 20, kind: 'vault_wall' },
    { x: 198, y: 232, w: 132, h: 26, kind: isPawn ? 'glass_case' : 'shelf' },
    { x: 470, y: 232, w: 132, h: 26, kind: isPawn ? 'counter' : 'shelf' },
    { x: 215, y: 345, w: 110, h: 24, kind: isPawn ? 'shelf' : 'cooler' },
    { x: 475, y: 345, w: 110, h: 24, kind: 'counter' },
  ];

  return {
    id,
    archetypeLabel: isPawn ? 'NARROW GOLD & PAWN SHOP' : 'COMPACT CORNER MARKET & DELI',
    availableFloors: [1],
    floorsById: {
      1: {
        floorId: 1,
        floorName: isPawn ? '1F · HAGERSTOWN PAWN SHOP' : '1F · FLOWER HILL CORNER MARKET',
        playableZones,
        rugs: [{ x: 356, y: 132, w: 88, h: 350, color: isPawn ? '#78350f' : '#14532d', borderColor: '#fbbf24' }],
        decors: [],
        obstacles,
        waypoints: [
          { x: 400, y: 425 },
          { x: 400, y: 280 },
          { x: 400, y: 165 },
        ],
        stairs: [],
        npcs: [
          {
            id: 'shop_owner',
            floor: 1,
            name: isPawn ? 'Rick Miller' : 'Sal Gomez',
            roleLabel: isPawn ? 'Pawn Broker' : 'Market Owner',
            x: 530,
            y: 315,
            facing: Math.PI / 2,
            shirtColor: isPawn ? '#b45309' : '#16a34a',
            hairColor: '#451a03',
            dialogue: isPawn
              ? 'Rare watches, gold bullion, and guitars behind the glass!'
              : 'Fresh coffee, snacks, and neighborhood news right on Flower Hill Way.',
          },
        ],
        activities: [
          {
            id: 'corner_retail_work',
            floor: 1,
            kind: 'work_retail',
            label: isPawn ? '🛒 Pawn Counter Shift' : '🛒 Market Register Shift',
            x: 530,
            y: 398,
            radius: 28,
          },
          {
            id: 'corner_arcade',
            floor: 1,
            kind: 'arcade',
            label: '🕹️ Countertop Arcade',
            x: 265,
            y: 175,
            radius: 26,
          },
        ],
      },
    },
    playerSpawn: { floor: 1, x: 400, y: 452 },
    entryDoorRect: { x: 344, y: 492, w: 112, h: 16 },
    vaults: [
      {
        id: `vault_${id}`,
        floor: 1,
        label: isPawn ? 'PAWN BACKROOM SAFE' : 'MARKET REGISTER SAFE',
        doorRect: { x: 352, y: 106, w: 96, h: 20 },
        lootZone: { x: 400, y: 66, radius: 30 },
        cashShare: payoutCash,
      },
    ],
    botSpawns: [
      { floor: 1, x: 400, y: 175, role: 'CAPTAIN' },
      { floor: 1, x: 270, y: 292, role: 'GUARD' },
      { floor: 1, x: 530, y: 292, role: 'GUARD' },
    ],
    policeBreachCount: getPoliceBreachCount('STORE', payoutCash),
    theme: isPawn
      ? {
          exteriorBg: '#171108',
          floorTileA: '#292014',
          floorTileB: '#332819',
          tileSize: 28,
          vaultTileA: '#451a03',
          vaultTileB: '#271102',
          wallFill: '#1f160a',
          wallStroke: '#f59e0b',
          interiorWallFill: '#78350f',
          interiorWallStroke: '#fbbf24',
          counterWood: '#713f12',
          counterTop: '#fcd34d',
          accentColor: '#34d399',
          lootVisual: 'gold_cash',
          vaultLabel: 'PAWN BACKROOM SAFE',
          tierBadge: 'PAWN SHOP',
        }
      : {
          exteriorBg: '#0a1610',
          floorTileA: '#1c2e24',
          floorTileB: '#233b2e',
          tileSize: 28,
          vaultTileA: '#14532d',
          vaultTileB: '#052e16',
          wallFill: '#0b2215',
          wallStroke: '#4ade80',
          interiorWallFill: '#166534',
          interiorWallStroke: '#86efac',
          counterWood: '#15803d',
          counterTop: '#bbf7d0',
          accentColor: '#4ade80',
          lootVisual: 'gold_cash',
          vaultLabel: 'MARKET REGISTER SAFE',
          tierBadge: 'CORNER MARKET',
        },
  };
}

function buildStoreDaveAndBustersPlan(payoutCash: number): BuildingFloorplan {
  // Very Large 3-Story Entertainment Powerhouse at RIO Washingtonian (1360x860 · ALL 13 Mini-Games · 3 Vaults · Elevator):
  // 1F: Grand Sports Arena & Table Games (8-Ball Pool, Air Hockey, Table Tennis, Pop-a-Shot Hoops)
  // 2F: Midway Neon Arcade Concourse (Skee-Ball, Prize Claw, Whack-a-Bot, Cyber Blaster DX, Cyber Pinball)
  // 3F: VIP Rhythm, Racing Sim & Action Roof Deck (Dance Beat, F1 Motion Sim, Boxer Punch Bag, Laser Target Range)
  const shares = splitPayoutShares(payoutCash, 3);

  return {
    id: 'store_dave_and_busters',
    archetypeLabel: "3-STORY DAVE & BUSTER'S MEGA ARCADE (13 GAMES · ELEVATOR)",
    worldWidth: 1360,
    worldHeight: 860,
    availableFloors: [1, 2, 3],
    floorsById: {
      1: {
        floorId: 1,
        floorName: "1F · DAVE & BUSTER'S GRAND SPORTS ARENA & TABLE LOUNGE",
        playableZones: [{ x: 40, y: 24, w: 1280, h: 808 }],
        rugs: [
          { x: 88, y: 170, w: 560, h: 495, color: '#1e3a8a', borderColor: '#f97316' },
          { x: 750, y: 195, w: 480, h: 470, color: '#0f172a', borderColor: '#38bdf8' },
        ],
        decors: [{ x: 604, y: 580, w: 152, h: 240, kind: 'runner', color: '#c2410c', accent: '#facc15' }],
        obstacles: [
          { x: 0, y: 0, w: 40, h: 860, kind: 'wall' },
          { x: 1320, y: 0, w: 40, h: 860, kind: 'wall' },
          // 1F Winner's Circle Prize Vault in North Center
          { x: 560, y: 24, w: 20, h: 108, kind: 'vault_wall' },
          { x: 780, y: 24, w: 20, h: 108, kind: 'vault_wall' },
          { x: 560, y: 112, w: 70, h: 20, kind: 'vault_wall' },
          { x: 730, y: 112, w: 70, h: 20, kind: 'vault_wall' },
          // Table & Hoop Games
          { x: 130, y: 230, w: 132, h: 64, kind: 'pool_table' },
          { x: 390, y: 230, w: 124, h: 60, kind: 'air_hockey_table' },
          { x: 130, y: 470, w: 120, h: 60, kind: 'table_tennis_table' },
          { x: 390, y: 470, w: 106, h: 58, kind: 'hoop_machine' },
          // Prize & Snack Desk + Lounge Sofas
          { x: 840, y: 270, w: 280, h: 28, kind: 'counter' },
          { x: 870, y: 455, w: 145, h: 42, kind: 'sofa' },
          { x: 870, y: 585, w: 145, h: 42, kind: 'sofa' },
        ],
        waypoints: [
          { x: 680, y: 745 },
          { x: 680, y: 430 },
          { x: 320, y: 390 },
          { x: 320, y: 615 },
          { x: 680, y: 185 },
          { x: 990, y: 225 },
          { x: 1120, y: 430 },
          { x: 220, y: 120 },
        ],
        stairs: [
          {
            x: 76,
            y: 50,
            w: 92,
            h: 74,
            targetFloor: 2,
            exitX: 165,
            exitY: 735,
            dir: 'up',
            label: '2F MIDWAY DECK',
          },
        ],
        elevators: [{ x: 1188, y: 48, w: 92, h: 74, label: 'D&B MAIN LIFT' }],
        npcs: [
          {
            id: 'db_host_1f',
            floor: 1,
            name: 'Coach Carter',
            roleLabel: 'Arena Director',
            x: 980,
            y: 235,
            facing: Math.PI / 2,
            shirtColor: '#ea580c',
            hairColor: '#0f172a',
            dialogue: "Welcome to 3-Story Dave & Buster's RIO! Take the stairs or D&B Main Lift elevator to play all 13 games across 1F–3F!",
          },
        ],
        activities: [
          { id: 'db_pool', floor: 1, kind: 'pool_8ball', label: '🎱 D&B Billiards Table', x: 196, y: 326, radius: 32 },
          { id: 'db_hockey', floor: 1, kind: 'air_hockey', label: '🏒 D&B Neon Air Hockey', x: 452, y: 322, radius: 32 },
          { id: 'db_pingpong', floor: 1, kind: 'table_tennis', label: '🏓 Olympic Table Tennis', x: 190, y: 562, radius: 32 },
          { id: 'db_popshot', floor: 1, kind: 'pop_a_shot', label: '🏀 D&B Pop-a-Shot Hoops', x: 443, y: 560, radius: 32 },
          { id: 'db_prize_shift', floor: 1, kind: 'work_retail', label: '🛒 Prize Counter Staff Shift', x: 980, y: 332, radius: 30 },
        ],
      },
      2: {
        floorId: 2,
        floorName: "2F · DAVE & BUSTER'S MIDWAY NEON ARCADE CONCOURSE",
        playableZones: [{ x: 40, y: 24, w: 1280, h: 808 }],
        rugs: [{ x: 96, y: 160, w: 1168, h: 525, color: '#312e81', borderColor: '#22d3ee' }],
        decors: [],
        obstacles: [
          { x: 0, y: 0, w: 40, h: 860, kind: 'wall' },
          { x: 1320, y: 0, w: 40, h: 860, kind: 'wall' },
          // 2F Midway Token Vault
          { x: 560, y: 24, w: 20, h: 108, kind: 'vault_wall' },
          { x: 780, y: 24, w: 20, h: 108, kind: 'vault_wall' },
          { x: 560, y: 112, w: 70, h: 20, kind: 'vault_wall' },
          { x: 730, y: 112, w: 70, h: 20, kind: 'vault_wall' },
          // 5 Midway Arcade Machines
          { x: 130, y: 230, w: 128, h: 72, kind: 'skeeball_lane' },
          { x: 420, y: 230, w: 106, h: 68, kind: 'claw_box' },
          { x: 840, y: 230, w: 112, h: 58, kind: 'arcade_cab' },
          { x: 260, y: 490, w: 112, h: 58, kind: 'arcade_cab' },
          { x: 720, y: 485, w: 100, h: 68, kind: 'pinball_machine' },
        ],
        waypoints: [
          { x: 165, y: 735 },
          { x: 680, y: 660 },
          { x: 680, y: 390 },
          { x: 680, y: 185 },
          { x: 340, y: 375 },
          { x: 980, y: 375 },
          { x: 220, y: 120 },
        ],
        stairs: [
          {
            x: 1070,
            y: 710,
            w: 92,
            h: 74,
            targetFloor: 1,
            exitX: 220,
            exitY: 115,
            dir: 'down',
            label: '1F ARENA',
          },
          {
            x: 76,
            y: 50,
            w: 92,
            h: 74,
            targetFloor: 3,
            exitX: 165,
            exitY: 735,
            dir: 'up',
            label: '3F VIP ROOF',
          },
        ],
        elevators: [{ x: 1188, y: 48, w: 92, h: 74, label: 'D&B MAIN LIFT' }],
        npcs: [
          {
            id: 'db_tech_2f',
            floor: 2,
            name: 'Maya Lin',
            roleLabel: 'Midway Lead Tech',
            x: 680,
            y: 235,
            facing: Math.PI / 2,
            shirtColor: '#2563eb',
            hairColor: '#1e1b4b',
            dialogue: 'Skee-Ball, Prize Claw, Whack-a-Bot, Cyber Blaster & Pinball are all live on 2F!',
          },
        ],
        activities: [
          { id: 'db_skeeball', floor: 2, kind: 'skeeball', label: '🎳 D&B Neon Skee-Ball', x: 194, y: 334, radius: 32 },
          { id: 'db_claw', floor: 2, kind: 'claw_machine', label: '🧸 Giant Prize Claw', x: 473, y: 330, radius: 32 },
          { id: 'db_whack', floor: 2, kind: 'whack_a_bot', label: '🔨 Whack-a-Bot Frenzy', x: 896, y: 320, radius: 32 },
          { id: 'db_blaster', floor: 2, kind: 'arcade', label: '🕹️ Cyber Blaster DX', x: 316, y: 580, radius: 32 },
          { id: 'db_pinball', floor: 2, kind: 'pinball', label: '⚡ Cyber Neon Pinball', x: 770, y: 584, radius: 32 },
        ],
      },
      3: {
        floorId: 3,
        floorName: "3F · DAVE & BUSTER'S RHYTHM, RACING SIM & ACTION ROOF DECK",
        playableZones: [{ x: 40, y: 24, w: 1280, h: 808 }],
        rugs: [
          { x: 110, y: 185, w: 320, h: 250, color: '#4c1d95', borderColor: '#f472b6' },
          { x: 480, y: 185, w: 340, h: 250, color: '#7f1d1d', borderColor: '#f97316' },
          { x: 860, y: 185, w: 320, h: 250, color: '#083344', borderColor: '#facc15' },
        ],
        decors: [],
        obstacles: [
          { x: 0, y: 0, w: 40, h: 860, kind: 'wall' },
          { x: 1320, y: 0, w: 40, h: 860, kind: 'wall' },
          // 3F High-Roller Grand Vault
          { x: 560, y: 24, w: 20, h: 108, kind: 'vault_wall' },
          { x: 780, y: 24, w: 20, h: 108, kind: 'vault_wall' },
          { x: 560, y: 112, w: 70, h: 20, kind: 'vault_wall' },
          { x: 730, y: 112, w: 70, h: 20, kind: 'vault_wall' },
          // 4 VIP Attractions
          { x: 150, y: 230, w: 146, h: 88, kind: 'dance_stage' },
          { x: 520, y: 230, w: 124, h: 72, kind: 'racing_sim' },
          { x: 880, y: 230, w: 86, h: 68, kind: 'punch_bag' },
          { x: 495, y: 515, w: 124, h: 62, kind: 'arcade_cab' },
        ],
        waypoints: [
          { x: 165, y: 735 },
          { x: 680, y: 680 },
          { x: 680, y: 410 },
          { x: 680, y: 185 },
          { x: 350, y: 375 },
          { x: 960, y: 375 },
        ],
        stairs: [
          {
            x: 1070,
            y: 710,
            w: 92,
            h: 74,
            targetFloor: 2,
            exitX: 220,
            exitY: 115,
            dir: 'down',
            label: '2F MIDWAY DECK',
          },
        ],
        elevators: [{ x: 1188, y: 48, w: 92, h: 74, label: 'D&B MAIN LIFT' }],
        npcs: [
          {
            id: 'db_dj_3f',
            floor: 3,
            name: 'DJ Pulse & Tessa',
            roleLabel: 'VIP Roof Hosts',
            x: 680,
            y: 235,
            facing: Math.PI / 2,
            shirtColor: '#db2777',
            hairColor: '#38bdf8',
            dialogue: 'Rock the Dance Beat stage, run F1 Motion Sim laps, smash the Boxer Bag, or blast the Laser Gallery!',
          },
        ],
        activities: [
          { id: 'db_dance', floor: 3, kind: 'dance_beat', label: '🎵 Neon Dance Beat Stage', x: 223, y: 350, radius: 34 },
          { id: 'db_racing', floor: 3, kind: 'racing_sim', label: '🏎️ F1 Motion Racing Sim', x: 582, y: 334, radius: 32 },
          { id: 'db_punch', floor: 3, kind: 'punch_bag', label: '🥊 Heavyweight Boxer Bag', x: 923, y: 330, radius: 32 },
          { id: 'db_range', floor: 3, kind: 'target_range', label: '🎯 Laser Target Gallery', x: 557, y: 608, radius: 32 },
        ],
      },
    },
    playerSpawn: { floor: 1, x: 680, y: 782 },
    entryDoorRect: { x: 616, y: 828, w: 128, h: 16 },
    vaults: [
      {
        id: 'vault_db_1f',
        floor: 1,
        label: "1F WINNER'S CIRCLE SAFE",
        doorRect: { x: 630, y: 112, w: 100, h: 20 },
        lootZone: { x: 680, y: 68, radius: 34 },
        cashShare: shares[0],
      },
      {
        id: 'vault_db_2f',
        floor: 2,
        label: '2F MIDWAY TOKEN VAULT',
        doorRect: { x: 630, y: 112, w: 100, h: 20 },
        lootZone: { x: 680, y: 68, radius: 34 },
        cashShare: shares[1],
      },
      {
        id: 'vault_db_3f',
        floor: 3,
        label: '3F VIP SIM ARENA VAULT',
        doorRect: { x: 630, y: 112, w: 100, h: 20 },
        lootZone: { x: 680, y: 68, radius: 34 },
        cashShare: shares[2],
      },
    ],
    botSpawns: [
      { floor: 1, x: 320, y: 385, role: 'GUARD' },
      { floor: 1, x: 680, y: 205, role: 'CAPTAIN' },
      { floor: 1, x: 1040, y: 380, role: 'GUARD' },
      { floor: 2, x: 680, y: 205, role: 'CAPTAIN' },
      { floor: 2, x: 550, y: 425, role: 'GUARD' },
      { floor: 2, x: 1020, y: 425, role: 'GUARD' },
      { floor: 3, x: 360, y: 390, role: 'GUARD' },
      { floor: 3, x: 680, y: 205, role: 'CAPTAIN' },
      { floor: 3, x: 960, y: 390, role: 'GUARD' },
    ],
    policeBreachCount: getPoliceBreachCount('STORE', payoutCash),
    theme: {
      exteriorBg: '#070b1a',
      floorTileA: '#131b36',
      floorTileB: '#1b264a',
      tileSize: 34,
      vaultTileA: '#1e1b4b',
      vaultTileB: '#0f172a',
      wallFill: '#0c142b',
      wallStroke: '#f97316',
      interiorWallFill: '#1e3a8a',
      interiorWallStroke: '#38bdf8',
      counterWood: '#9a3412',
      counterTop: '#fb923c',
      accentColor: '#f97316',
      lootVisual: 'prize_tickets',
      vaultLabel: "D&B WINNER'S VAULTS",
      tierBadge: '3-STORY MEGA ARCADE · ELEVATOR',
    },
  };
}

function buildStoreChuckECheesePlan(_payoutCash: number): BuildingFloorplan {
  // Very Large 3-Story Chuck E. Cheese's Fun Center (1320x840 · 12 Games · Elevator · Explore-Only / Non-Robbable)
  return {
    id: 'store_chuck_e_cheese',
    archetypeLabel: "3-STORY CHUCK E. CHEESE'S FUN CENTER (12 GAMES · ELEVATOR)",
    worldWidth: 1320,
    worldHeight: 840,
    availableFloors: [1, 2, 3],
    floorsById: {
      1: {
        floorId: 1,
        floorName: "1F · CHUCK E. CHEESE'S PIZZA STAGE & SKEE-BALL CONCOURSE",
        playableZones: [{ x: 40, y: 24, w: 1240, h: 788 }],
        rugs: [
          { x: 88, y: 190, w: 510, h: 420, color: '#581c87', borderColor: '#facc15' },
          { x: 700, y: 190, w: 510, h: 460, color: '#14532d', borderColor: '#4ade80' },
        ],
        decors: [{ x: 584, y: 540, w: 152, h: 255, kind: 'runner', color: '#7e22ce', accent: '#facc15' }],
        obstacles: [
          { x: 0, y: 0, w: 40, h: 840, kind: 'wall' },
          { x: 1280, y: 0, w: 40, h: 840, kind: 'wall' },
          // Pizza Animatronic Main Stage & Dining
          { x: 480, y: 66, w: 260, h: 48, kind: 'counter' },
          { x: 130, y: 240, w: 128, h: 72, kind: 'skeeball_lane' },
          { x: 380, y: 240, w: 106, h: 68, kind: 'claw_box' },
          { x: 760, y: 240, w: 150, h: 42, kind: 'table' },
          { x: 1010, y: 240, w: 118, h: 60, kind: 'arcade_cab' },
          { x: 890, y: 470, w: 118, h: 60, kind: 'arcade_cab' },
        ],
        waypoints: [
          { x: 660, y: 730 },
          { x: 660, y: 420 },
          { x: 320, y: 410 },
          { x: 960, y: 400 },
          { x: 610, y: 165 },
        ],
        stairs: [
          {
            x: 84,
            y: 50,
            w: 92,
            h: 74,
            targetFloor: 2,
            exitX: 165,
            exitY: 715,
            dir: 'up',
            label: '2F SKY ARCADE',
          },
        ],
        elevators: [{ x: 1148, y: 48, w: 92, h: 74, label: 'FUN CENTER LIFT' }],
        npcs: [
          {
            id: 'cec_chuck',
            floor: 1,
            name: 'Chuck E.',
            roleLabel: 'Fun Center Mascot',
            x: 610,
            y: 150,
            facing: Math.PI / 2,
            shirtColor: '#7e22ce',
            hairColor: '#92400e',
            dialogue: "Welcome to our huge 3-Story Chuck E. Cheese's! Ride the Fun Center Lift elevator or explore 12 free-play games across 1F–3F!",
          },
        ],
        activities: [
          { id: 'cec_skeeball', floor: 1, kind: 'skeeball', label: '🎳 Classic Skee-Ball Alley', x: 194, y: 342, radius: 32 },
          { id: 'cec_claw', floor: 1, kind: 'claw_machine', label: '🧸 Plushie Prize Claw', x: 433, y: 338, radius: 32 },
          { id: 'cec_whack', floor: 1, kind: 'whack_a_bot', label: '🔨 Whack-a-Bot Machine', x: 1069, y: 330, radius: 32 },
          { id: 'cec_blaster_1f', floor: 1, kind: 'arcade', label: '🕹️ Cyber Blaster DX', x: 949, y: 560, radius: 32 },
        ],
      },
      2: {
        floorId: 2,
        floorName: "2F · CHUCK E. CHEESE'S SKY ARCADE, PINBALL & HOOPS",
        playableZones: [{ x: 40, y: 24, w: 1240, h: 788 }],
        rugs: [{ x: 110, y: 155, w: 1100, h: 520, color: '#4c1d95', borderColor: '#facc15' }],
        decors: [],
        obstacles: [
          { x: 0, y: 0, w: 40, h: 840, kind: 'wall' },
          { x: 1280, y: 0, w: 40, h: 840, kind: 'wall' },
          { x: 480, y: 74, w: 260, h: 36, kind: 'counter' },
          { x: 140, y: 235, w: 124, h: 60, kind: 'air_hockey_table' },
          { x: 920, y: 235, w: 112, h: 58, kind: 'hoop_machine' },
          { x: 340, y: 470, w: 100, h: 68, kind: 'pinball_machine' },
          { x: 750, y: 470, w: 122, h: 60, kind: 'table_tennis_table' },
        ],
        waypoints: [
          { x: 165, y: 715 },
          { x: 660, y: 650 },
          { x: 660, y: 380 },
          { x: 610, y: 155 },
        ],
        stairs: [
          {
            x: 1040,
            y: 690,
            w: 92,
            h: 74,
            targetFloor: 1,
            exitX: 220,
            exitY: 115,
            dir: 'down',
            label: '1F PIZZA STAGE',
          },
          {
            x: 84,
            y: 50,
            w: 92,
            h: 74,
            targetFloor: 3,
            exitX: 165,
            exitY: 715,
            dir: 'up',
            label: '3F ROOFTOP DECK',
          },
        ],
        elevators: [{ x: 1148, y: 48, w: 92, h: 74, label: 'FUN CENTER LIFT' }],
        npcs: [
          {
            id: 'cec_prize_attendant',
            floor: 2,
            name: 'Helen Henny',
            roleLabel: 'Prize Counter Host',
            x: 610,
            y: 142,
            facing: Math.PI / 2,
            shirtColor: '#facc15',
            hairColor: '#ef4444',
            dialogue: 'Play Pinball, Pop-a-Shot, Air Hockey & Ping-Pong here, then ride up to 3F for Dance Beat & F1 Sims!',
          },
        ],
        activities: [
          { id: 'cec_hockey', floor: 2, kind: 'air_hockey', label: '🏒 Kidzone Air Hockey', x: 202, y: 326, radius: 32 },
          { id: 'cec_popshot', floor: 2, kind: 'pop_a_shot', label: '🏀 Arcade Hoops Challenge', x: 976, y: 324, radius: 32 },
          { id: 'cec_pinball', floor: 2, kind: 'pinball', label: '⚡ Ticket Surge Pinball', x: 390, y: 568, radius: 32 },
          { id: 'cec_pingpong', floor: 2, kind: 'table_tennis', label: '🏓 Spin-Bot Table Tennis', x: 811, y: 560, radius: 32 },
        ],
      },
      3: {
        floorId: 3,
        floorName: "3F · CHUCK E. CHEESE'S ROOFTOP DANCE & RACING DECK",
        playableZones: [{ x: 40, y: 24, w: 1240, h: 788 }],
        rugs: [{ x: 110, y: 155, w: 1100, h: 520, color: '#3b0764', borderColor: '#facc15' }],
        decors: [],
        obstacles: [
          { x: 0, y: 0, w: 40, h: 840, kind: 'wall' },
          { x: 1280, y: 0, w: 40, h: 840, kind: 'wall' },
          { x: 150, y: 230, w: 146, h: 84, kind: 'dance_stage' },
          { x: 890, y: 230, w: 124, h: 72, kind: 'racing_sim' },
          { x: 380, y: 480, w: 86, h: 66, kind: 'punch_bag' },
          { x: 740, y: 480, w: 118, h: 60, kind: 'arcade_cab' },
        ],
        waypoints: [
          { x: 165, y: 715 },
          { x: 660, y: 650 },
          { x: 660, y: 380 },
          { x: 660, y: 185 },
        ],
        stairs: [
          {
            x: 1040,
            y: 690,
            w: 92,
            h: 74,
            targetFloor: 2,
            exitX: 220,
            exitY: 115,
            dir: 'down',
            label: '2F SKY ARCADE',
          },
        ],
        elevators: [{ x: 1148, y: 48, w: 92, h: 74, label: 'FUN CENTER LIFT' }],
        npcs: [
          {
            id: 'cec_jasper_3f',
            floor: 3,
            name: 'Jasper T. Jowls',
            roleLabel: 'Rooftop Arcade DJ',
            x: 660,
            y: 165,
            facing: Math.PI / 2,
            shirtColor: '#ea580c',
            hairColor: '#78350f',
            dialogue: 'Rock the 3F Dance Stage, clock fastest F1 lap on our Motion Sim, or blast UFOs on the Laser Range!',
          },
        ],
        activities: [
          { id: 'cec_dance', floor: 3, kind: 'dance_beat', label: '🎵 Rooftop Dance Beat', x: 223, y: 346, radius: 32 },
          { id: 'cec_racing', floor: 3, kind: 'racing_sim', label: '🏎️ Grand Prix Racing Sim', x: 952, y: 332, radius: 32 },
          { id: 'cec_punch', floor: 3, kind: 'punch_bag', label: '🥊 Power Punch Tester', x: 423, y: 576, radius: 30 },
          { id: 'cec_range', floor: 3, kind: 'target_range', label: '🎯 Laser Target Gallery', x: 799, y: 570, radius: 30 },
        ],
      },
    },
    playerSpawn: { floor: 1, x: 660, y: 762 },
    entryDoorRect: { x: 596, y: 808, w: 128, h: 16 },
    vaults: [],
    botSpawns: [],
    policeBreachCount: 0,
    theme: {
      exteriorBg: '#160926',
      floorTileA: '#2e1065',
      floorTileB: '#3b0764',
      tileSize: 34,
      vaultTileA: '#4c1d95',
      vaultTileB: '#1e1b4b',
      wallFill: '#240b42',
      wallStroke: '#facc15',
      interiorWallFill: '#6b21a8',
      interiorWallStroke: '#fde047',
      counterWood: '#7e22ce',
      counterTop: '#facc15',
      accentColor: '#facc15',
      lootVisual: 'prize_tickets',
      vaultLabel: 'FUN CENTER FLOOR',
      tierBadge: '3-STORY FUN CENTER · EXPLORE',
    },
  };
}

function buildServiceStationPlan(id: string, name: string): BuildingFloorplan {
  return {
    id,
    archetypeLabel: 'SERVICE STATION & TUNING BAY',
    availableFloors: [1],
    floorsById: {
      1: {
        floorId: 1,
        floorName: `1F · ${name.toUpperCase()}`,
        playableZones: [{ x: 60, y: 40, w: 680, h: 440 }],
        rugs: [{ x: 96, y: 260, w: 230, h: 190, color: '#1e293b', borderColor: '#f59e0b' }],
        decors: [{ x: 375, y: 60, w: 335, h: 390, kind: 'garage_slab', color: '#334155', accent: '#facc15' }],
        obstacles: [
          { x: 0, y: 0, w: 60, h: 520, kind: 'wall' },
          { x: 740, y: 0, w: 60, h: 520, kind: 'wall' },
          { x: 0, y: 0, w: 800, h: 40, kind: 'wall' },
          { x: 96, y: 120, w: 180, h: 24, kind: 'counter' },
          { x: 96, y: 210, w: 120, h: 22, kind: 'cooler' },
          { x: 430, y: 130, w: 96, h: 145, kind: 'table' }, // Service lift bench
          { x: 585, y: 130, w: 96, h: 145, kind: 'table' },
        ],
        waypoints: [{ x: 320, y: 400 }, { x: 320, y: 180 }, { x: 540, y: 350 }],
        stairs: [],
        npcs: [
          {
            id: 'mech_chief',
            floor: 1,
            name: 'Trey Vance',
            roleLabel: 'Lead Tuner',
            x: 622,
            y: 365,
            facing: Math.PI / 2,
            shirtColor: '#ea580c',
            hairColor: '#1e293b',
            dialogue: 'Step over to the Lift Bay Terminal ([E]) to clock a mechanic shift, or grab a quick arcade round!',
            serviceAction: { label: 'Quick Pit Wash Tip (+$150)', rewardCash: 150, kind: 'tune' },
          },
          {
            id: 'mart_clerk',
            floor: 1,
            name: 'Hannah Kim',
            roleLabel: 'Station Cashier',
            x: 185,
            y: 92,
            facing: Math.PI / 2,
            shirtColor: '#f59e0b',
            hairColor: '#090d16',
            dialogue: 'Hot coffee and energy drinks stocked right inside the cooler aisle!',
          },
        ],
        activities: [
          {
            id: 'pit_arcade',
            floor: 1,
            kind: 'arcade',
            label: '🕹️ Pit Stop Reflex Arcade',
            x: 180,
            y: 355,
            radius: 30,
          },
          {
            id: 'pit_mechanic_work',
            floor: 1,
            kind: 'work_mechanic',
            label: '🔧 Lift Bay & Dyno Tuning (Work)',
            x: 540,
            y: 315,
            radius: 32,
          },
        ],
      },
    },
    playerSpawn: { floor: 1, x: 330, y: 436 },
    entryDoorRect: { x: 274, y: 472, w: 112, h: 16 },
    vaults: [],
    botSpawns: [],
    policeBreachCount: 0,
    theme: {
      exteriorBg: '#0f172a',
      floorTileA: '#1e293b',
      floorTileB: '#263349',
      tileSize: 32,
      vaultTileA: '#1e293b',
      vaultTileB: '#0f172a',
      wallFill: '#0b1120',
      wallStroke: '#fbbf24',
      interiorWallFill: '#334155',
      interiorWallStroke: '#94a3b8',
      counterWood: '#78350f',
      counterTop: '#f59e0b',
      accentColor: '#fbbf24',
      lootVisual: 'tech_gear',
      vaultLabel: 'GARAGE BAY',
      tierBadge: 'SERVICE & TUNING BAY',
    },
  };
}

function buildPolicePrecinctPlan(): BuildingFloorplan {
  return {
    id: 'police_precinct',
    archetypeLabel: '2-STORY MCPD CENTRAL PRECINCT · ELEVATOR',
    worldWidth: 1120,
    worldHeight: 700,
    availableFloors: [1, 2],
    floorsById: {
      1: {
        floorId: 1,
        floorName: '1F · MCPD DISPATCH LOBBY & HOLDING DESK',
        playableZones: [{ x: 48, y: 24, w: 1024, h: 648 }],
        rugs: [{ x: 430, y: 145, w: 260, h: 480, color: '#1e3a8a', borderColor: '#60a5fa' }],
        decors: [],
        obstacles: [
          { x: 0, y: 0, w: 48, h: 700, kind: 'wall' },
          { x: 1072, y: 0, w: 48, h: 700, kind: 'wall' },
          { x: 380, y: 195, w: 360, h: 32, kind: 'counter' },
          { x: 120, y: 315, w: 148, h: 48, kind: 'desk' },
          { x: 852, y: 315, w: 148, h: 48, kind: 'desk' },
        ],
        waypoints: [{ x: 560, y: 580 }, { x: 560, y: 330 }, { x: 850, y: 145 }],
        stairs: [
          {
            x: 840,
            y: 52,
            w: 84,
            h: 72,
            targetFloor: 2,
            exitX: 250,
            exitY: 565,
            dir: 'up',
            label: '2F BRIEFING & LOUNGE',
          },
        ],
        elevators: [{ x: 960, y: 52, w: 86, h: 72, label: 'PRECINCT LIFT' }],
        npcs: [
          {
            id: 'mcpd_sgt',
            floor: 1,
            name: 'Sgt. Morales',
            roleLabel: 'Desk Sergeant',
            x: 560,
            y: 162,
            facing: Math.PI / 2,
            shirtColor: '#1d4ed8',
            hairColor: '#1e293b',
            dialogue: 'MCPD Central Precinct — take the stairs or Precinct Lift upstairs to the officers lounge!',
          },
        ],
        activities: [
          {
            id: 'mcpd_dispatch_work',
            floor: 1,
            kind: 'work_dispatch',
            label: '📻 MCPD Dispatch Console Shift',
            x: 560,
            y: 262,
            radius: 32,
          },
          {
            id: 'mcpd_range',
            floor: 1,
            kind: 'target_range',
            label: '🎯 MCPD Target Reflex Trainer',
            x: 194,
            y: 445,
            radius: 30,
          },
        ],
      },
      2: {
        floorId: 2,
        floorName: '2F · OFFICERS BRIEFING & BREAK LOUNGE',
        playableZones: [{ x: 76, y: 24, w: 968, h: 648 }],
        rugs: [{ x: 140, y: 115, w: 840, h: 455, color: '#0f172a', borderColor: '#38bdf8' }],
        decors: [],
        obstacles: [
          { x: 0, y: 0, w: 76, h: 700, kind: 'wall' },
          { x: 1044, y: 0, w: 76, h: 700, kind: 'wall' },
          { x: 190, y: 175, w: 140, h: 68, kind: 'pool_table' },
          { x: 710, y: 175, w: 124, h: 60, kind: 'air_hockey_table' },
          { x: 495, y: 395, w: 130, h: 38, kind: 'sofa' },
        ],
        waypoints: [{ x: 250, y: 565 }, { x: 560, y: 315 }],
        stairs: [
          {
            x: 120,
            y: 550,
            w: 84,
            h: 72,
            targetFloor: 1,
            exitX: 790,
            exitY: 160,
            dir: 'down',
            label: '1F LOBBY',
          },
        ],
        elevators: [{ x: 936, y: 52, w: 86, h: 72, label: 'PRECINCT LIFT' }],
        npcs: [
          {
            id: 'mcpd_chief',
            floor: 2,
            name: 'Chief Holloway',
            roleLabel: 'Precinct Commander',
            x: 560,
            y: 315,
            facing: Math.PI / 2,
            shirtColor: '#0f172a',
            hairColor: '#cbd5e1',
            dialogue: 'Keep I-270 and Gaithersburg safe out there—feel free to shoot some 8-ball or Air Hockey on break!',
          },
        ],
        activities: [
          {
            id: 'mcpd_pool',
            floor: 2,
            kind: 'pool_8ball',
            label: '🎱 Precinct Break-Room Pool',
            x: 260,
            y: 278,
            radius: 34,
          },
          {
            id: 'mcpd_hockey',
            floor: 2,
            kind: 'air_hockey',
            label: '🏒 Officers Air Hockey Table',
            x: 772,
            y: 268,
            radius: 34,
          },
        ],
      },
    },
    playerSpawn: { floor: 1, x: 560, y: 615 },
    entryDoorRect: { x: 496, y: 664, w: 128, h: 16 },
    vaults: [],
    botSpawns: [],
    policeBreachCount: 0,
    theme: {
      exteriorBg: '#091124',
      floorTileA: '#172554',
      floorTileB: '#1e3a8a',
      tileSize: 34,
      vaultTileA: '#0f172a',
      vaultTileB: '#1e293b',
      wallFill: '#0f172a',
      wallStroke: '#60a5fa',
      interiorWallFill: '#1e293b',
      interiorWallStroke: '#93c5fd',
      counterWood: '#1e293b',
      counterTop: '#60a5fa',
      accentColor: '#38bdf8',
      lootVisual: 'tech_gear',
      vaultLabel: 'PRECINCT ARMORY',
      tierBadge: 'MCPD HQ · ELEVATOR',
    },
  };
}

// ============================================================================
// 4. EXTERIOR-MATCHED HOUSE ARCHITECTURES (B1 BASEMENT + 1F + 2F, MULTI-VAULT)
// ============================================================================

function getHouseInteriorColors(ext?: HouseExteriorProfile, fallbackWall = '#94a3b8', fallbackRoof = '#1e293b') {
  const wallHex = ext?.wallColorHex || fallbackWall;
  const roofHex = ext?.roofColorHex || fallbackRoof;
  return {
    wallHex,
    roofHex,
    exteriorBg: mixHex(roofHex, '#050810', 0.65),
    wallFill: mixHex(wallHex, '#111827', 0.42),
    wallStroke: mixHex(wallHex, '#f8fafc', 0.35),
    interiorWallFill: mixHex(wallHex, '#334155', 0.55),
    interiorWallStroke: '#cbd5e1',
  };
}

function buildStarterHousePlan(
  id: string,
  name: string,
  payoutCash: number,
  ext: HouseExteriorProfile
): BuildingFloorplan {
  // Matches 3D 1-Story Starter Cottage strictly (1 floor only, NO fake 2F or B1!).
  // Zero free mini-games: players buy furnishings with cash to unlock home games.
  const cols = getHouseInteriorColors(ext, '#cbd5e1', '#1e293b');

  const f1Playable: FloorZoneRect[] = [
    { x: 40, y: 40, w: 560, h: 548 }, // Main cottage
    { x: 600, y: 120, w: 320, h: 468 }, // Right Carport / Rec Wing
  ];
  const f1Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 960, h: 40, kind: 'wall' },
    { x: 0, y: 0, w: 40, h: 620, kind: 'wall' },
    { x: 920, y: 0, w: 40, h: 620, kind: 'wall' },
    { x: 600, y: 40, w: 320, h: 80, kind: 'wall' }, // Carport roof setback
    // Bedroom wall in NW (doorway y:150..255)
    { x: 300, y: 40, w: 18, h: 110, kind: 'interior_wall' },
    // Garage wall divider (doorway y:240..340)
    { x: 588, y: 120, w: 18, h: 120, kind: 'interior_wall' },
    { x: 588, y: 340, w: 18, h: 248, kind: 'interior_wall' },
    // NW Bedroom Closet Safe
    { x: 186, y: 40, w: 16, h: 72, kind: 'vault_wall' },
    { x: 274, y: 40, w: 16, h: 72, kind: 'vault_wall' },
    { x: 186, y: 92, w: 22, h: 20, kind: 'vault_wall' },
    // Home Furniture (no free games!)
    { x: 76, y: 68, w: 78, h: 56, kind: 'bed' },
    { x: 385, y: 74, w: 124, h: 28, kind: 'kitchen_island' },
    { x: 96, y: 310, w: 126, h: 36, kind: 'sofa' },
    { x: 760, y: 155, w: 112, h: 36, kind: 'desk' },
  ];

  const floorsById: Partial<Record<HeistFloorId, HeistFloorData>> = {
    1: {
      floorId: 1,
      floorName: `1F · ${name.toUpperCase()} (1-STORY COTTAGE + RIGHT CARPORT)`,
      playableZones: f1Playable,
      rugs: [{ x: 92, y: 358, w: 160, h: 105, color: '#1e3a8a', borderColor: '#60a5fa' }],
      decors: [{ x: 612, y: 134, w: 294, h: 438, kind: 'garage_slab', color: '#475569', accent: '#94a3b8' }],
      obstacles: f1Obstacles,
      waypoints: [
        { x: 323, y: 500 },
        { x: 323, y: 295 },
        { x: 175, y: 195 },
        { x: 465, y: 215 },
        { x: 710, y: 295 },
      ],
      stairs: [],
      npcs: [
        {
          id: 'home_caretaker',
          floor: 1,
          name: 'Sam',
          roleLabel: 'House Sitter',
          x: 370,
          y: 245,
          facing: Math.PI / 2,
          shirtColor: '#0ea5e9',
          hairColor: '#451a03',
          dialogue: `Welcome home! Matching ${ext.wallColorHex} 1-story cottage—buy Billiards, Air Hockey, or Ping Pong in the Shop to furnish your rooms!`,
        },
      ],
      activities: [
        { id: 'starter_rest', floor: 1, kind: 'rest', label: '🛋️ Relax on Living Sofa', x: 158, y: 376, radius: 30 },
      ],
      emptySlots: [
        { id: 'starter_carport_1', floor: 1, x: 650, y: 230, w: 150, h: 86, label: 'Carport Game Pad A' },
        { id: 'starter_carport_2', floor: 1, x: 650, y: 380, w: 150, h: 86, label: 'Carport Game Pad B' },
        { id: 'starter_den_1', floor: 1, x: 375, y: 315, w: 150, h: 86, label: 'Living Den Pad' },
      ],
    },
  };

  return {
    id,
    archetypeLabel: '1-STORY COZY COTTAGE + RIGHT CARPORT',
    worldWidth: 960,
    worldHeight: 620,
    availableFloors: [1],
    floorsById,
    playerSpawn: { floor: 1, x: 323, y: 536 },
    entryDoorRect: { x: 265, y: 586, w: 116, h: 16 },
    vaults: [
      {
        id: `vault_${id}_1f`,
        floor: 1,
        label: 'BEDROOM CLOSET SAFE',
        doorRect: { x: 208, y: 92, w: 66, h: 20 },
        lootZone: { x: 240, y: 66, radius: 26 },
        cashShare: payoutCash,
      },
    ],
    botSpawns: [
      { floor: 1, x: 390, y: 255, role: 'CAPTAIN' },
      { floor: 1, x: 735, y: 315, role: 'GUARD' },
    ],
    policeBreachCount: getPoliceBreachCount('HOUSE', payoutCash),
    theme: {
      exteriorBg: cols.exteriorBg,
      floorTileA: '#3f2e21',
      floorTileB: '#4a3627',
      tileSize: 30,
      vaultTileA: '#1e293b',
      vaultTileB: '#0f172a',
      wallFill: cols.wallFill,
      wallStroke: cols.wallStroke,
      interiorWallFill: cols.interiorWallFill,
      interiorWallStroke: cols.interiorWallStroke,
      counterWood: '#78350f',
      counterTop: '#d97706',
      accentColor: '#38bdf8',
      lootVisual: 'wall_safe',
      vaultLabel: 'CLOSET SAFE',
      tierBadge: '1-STORY COTTAGE',
    },
  };
}

function buildColonialOrSplitHousePlan(
  id: string,
  name: string,
  payoutCash: number,
  ext: HouseExteriorProfile
): BuildingFloorplan {
  // Strictly matches 3D 2-Story Colonial / Split-Level (1F + 2F, plus B1 ONLY when ext.hasBasement is true!).
  // Zero free mini-games inside houses!
  const cols = getHouseInteriorColors(ext, '#d6ccb8', '#1f2937');
  const hasBasement = ext.hasBasement;
  const multiVault = payoutCash >= 11000 || hashString(id) % 2 === 0;
  const shares = splitPayoutShares(payoutCash, multiVault ? 2 : 1);

  const f1Playable: FloorZoneRect[] = [
    { x: 36, y: 24, w: 594, h: 564 }, // Left 2-story main colonial
    { x: 630, y: 118, w: 294, h: 470 }, // Right attached 2-car garage
  ];
  const f1Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 36, h: 620, kind: 'wall' },
    { x: 924, y: 0, w: 36, h: 620, kind: 'wall' },
    { x: 630, y: 0, w: 330, h: 118, kind: 'wall' },
    { x: 36, y: 260, w: 140, h: 18, kind: 'interior_wall' },
    { x: 275, y: 24, w: 18, h: 120, kind: 'interior_wall' },
    // Mudroom door to Right Garage (open y:268..368)
    { x: 618, y: 118, w: 18, h: 150, kind: 'interior_wall' },
    { x: 618, y: 368, w: 18, h: 220, kind: 'interior_wall' },
    // Furniture
    { x: 86, y: 80, w: 116, h: 42, kind: 'table' },
    { x: 345, y: 74, w: 128, h: 28, kind: 'kitchen_island' },
    { x: 78, y: 360, w: 120, h: 38, kind: 'sofa' },
    { x: 760, y: 155, w: 112, h: 36, kind: 'desk' },
  ];

  if (multiVault) {
    f1Obstacles.push(
      { x: 478, y: 24, w: 18, h: 92, kind: 'vault_wall' },
      { x: 604, y: 24, w: 18, h: 92, kind: 'vault_wall' },
      { x: 478, y: 96, w: 32, h: 20, kind: 'vault_wall' },
      { x: 588, y: 96, w: 34, h: 20, kind: 'vault_wall' }
    );
  }

  const f1Stairs: StairPortal[] = [
    {
      x: 310,
      y: 175,
      w: 78,
      h: 66,
      targetFloor: 2,
      exitX: 545,
      exitY: 485,
      dir: 'up',
      label: '2F BEDROOMS',
    },
  ];
  if (hasBasement) {
    f1Stairs.push({
      x: 515,
      y: 475,
      w: 78,
      h: 66,
      targetFloor: 0,
      exitX: 550,
      exitY: 320,
      dir: 'down',
      label: 'B1 BASEMENT',
    });
  }

  const f2Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 48, h: 620, kind: 'wall' },
    { x: 630, y: 0, w: 330, h: 620, kind: 'wall' }, // 2F sits above main left structure
    { x: 215, y: 24, w: 18, h: 96, kind: 'vault_wall' },
    { x: 415, y: 24, w: 18, h: 96, kind: 'vault_wall' },
    { x: 215, y: 100, w: 55, h: 20, kind: 'vault_wall' },
    { x: 360, y: 100, w: 73, h: 20, kind: 'vault_wall' },
    { x: 48, y: 270, w: 165, h: 18, kind: 'interior_wall' },
    { x: 410, y: 270, w: 220, h: 18, kind: 'interior_wall' },
    { x: 86, y: 360, w: 86, h: 62, kind: 'bed' },
    { x: 475, y: 345, w: 104, h: 38, kind: 'desk' },
  ];

  const floorsById: Partial<Record<HeistFloorId, HeistFloorData>> = {
    1: {
      floorId: 1,
      floorName: `1F · ${name.toUpperCase()} (${ext.style.toUpperCase()} + 2-CAR GARAGE)`,
      playableZones: f1Playable,
      rugs: [
        { x: 64, y: 320, w: 190, h: 175, color: '#7f1d1d', borderColor: '#f59e0b' },
        { x: 295, y: 345, w: 150, h: 215, color: '#1e3a8a', borderColor: '#93c5fd' },
      ],
      decors: [
        { x: 36, y: 390, w: 16, h: 72, kind: 'fireplace_hearth', color: '#57534e' },
        { x: 642, y: 132, w: 268, h: 440, kind: 'garage_slab', color: '#475569', accent: '#cbd5e1' },
      ],
      obstacles: f1Obstacles,
      waypoints: [
        { x: 330, y: 500 },
        { x: 330, y: 320 },
        { x: 235, y: 245 },
        { x: 540, y: 170 },
        { x: 540, y: 320 },
        { x: 740, y: 320 },
      ],
      stairs: f1Stairs,
      npcs: [
        {
          id: 'col_host',
          floor: 1,
          name: 'Claire Vance',
          roleLabel: 'Homeowner',
          x: 275,
          y: 350,
          facing: Math.PI / 2,
          shirtColor: '#10b981',
          hairColor: '#78350f',
          dialogue: `Welcome inside ${name}! Buy Air Hockey, Billiards, or Ping Pong tables with cash from the Shop menu to furnish your rooms.`,
        },
      ],
      activities: [
        { id: 'col_rest', floor: 1, kind: 'rest', label: '🛋️ Relax in Living Room', x: 138, y: 425, radius: 30 },
      ],
      emptySlots: [
        { id: 'col_garage_1', floor: 1, x: 675, y: 245, w: 150, h: 86, label: 'Garage Arcade Pad A' },
        { id: 'col_garage_2', floor: 1, x: 675, y: 405, w: 150, h: 86, label: 'Garage Arcade Pad B' },
        { id: 'col_1f_den', floor: 1, x: 295, y: 350, w: 150, h: 86, label: '1F Family Room Pad' },
      ],
    },
    2: {
      floorId: 2,
      floorName: `2F · ${name.toUpperCase()} MASTER SUITE & STUDY`,
      playableZones: [{ x: 48, y: 24, w: 582, h: 564 }],
      rugs: [{ x: 195, y: 145, w: 245, h: 175, color: '#14532d', borderColor: '#facc15' }],
      decors: [],
      obstacles: f2Obstacles,
      waypoints: [
        { x: 545, y: 485 },
        { x: 315, y: 440 },
        { x: 315, y: 275 },
        { x: 315, y: 175 },
        { x: 130, y: 185 },
        { x: 520, y: 185 },
      ],
      stairs: [
        {
          x: 84,
          y: 485,
          w: 78,
          h: 66,
          targetFloor: 1,
          exitX: 245,
          exitY: 205,
          dir: 'down',
          label: '1F FOYER',
        },
      ],
      npcs: [],
      activities: [],
      emptySlots: [
        { id: 'col_2f_study', floor: 2, x: 240, y: 335, w: 150, h: 86, label: '2F Loft Game Pad' },
      ],
    },
  };

  if (hasBasement) {
    floorsById[0] = {
      floorId: 0,
      floorName: `B1 · ${name.toUpperCase()} WALKOUT BASEMENT`,
      playableZones: [{ x: 48, y: 36, w: 582, h: 536 }],
      rugs: [{ x: 115, y: 180, w: 340, h: 250, color: '#3b0764', borderColor: '#c084fc' }],
      decors: [],
      obstacles: [
        { x: 0, y: 0, w: 48, h: 620, kind: 'wall' },
        { x: 630, y: 0, w: 330, h: 620, kind: 'wall' },
        { x: 0, y: 0, w: 960, h: 36, kind: 'wall' },
        { x: 0, y: 572, w: 960, h: 48, kind: 'wall' },
        { x: 380, y: 88, w: 126, h: 40, kind: 'sofa' },
        { x: 82, y: 74, w: 102, h: 36, kind: 'desk' },
      ],
      waypoints: [
        { x: 550, y: 320 },
        { x: 430, y: 420 },
        { x: 240, y: 350 },
        { x: 240, y: 155 },
      ],
      stairs: [
        {
          x: 515,
          y: 470,
          w: 78,
          h: 66,
          targetFloor: 1,
          exitX: 445,
          exitY: 505,
          dir: 'up',
          label: '1F MAIN LEVEL',
        },
      ],
      npcs: [],
      activities: [],
      emptySlots: [
        { id: 'col_b1_rec1', floor: 0, x: 115, y: 220, w: 165, h: 90, label: 'Basement Game Pad A' },
        { id: 'col_b1_rec2', floor: 0, x: 325, y: 220, w: 165, h: 90, label: 'Basement Game Pad B' },
      ],
    };
  }

  const vaults: VaultSpec[] = multiVault
    ? [
        {
          id: `vault_${id}_1f`,
          floor: 1,
          label: '1F STUDY WALL SAFE',
          doorRect: { x: 510, y: 96, w: 78, h: 20 },
          lootZone: { x: 549, y: 60, radius: 28 },
          cashShare: shares[0],
        },
        {
          id: `vault_${id}_2f`,
          floor: 2,
          label: '2F MASTER SUITE VAULT',
          doorRect: { x: 270, y: 100, w: 90, h: 20 },
          lootZone: { x: 315, y: 62, radius: 30 },
          cashShare: shares[1],
        },
      ]
    : [
        {
          id: `vault_${id}_2f`,
          floor: 2,
          label: '2F MASTER SUITE VAULT',
          doorRect: { x: 270, y: 100, w: 90, h: 20 },
          lootZone: { x: 315, y: 62, radius: 30 },
          cashShare: payoutCash,
        },
      ];

  const botSpawns: BuildingFloorplan['botSpawns'] = [
    { floor: 1, x: 330, y: 315, role: 'GUARD' },
    { floor: 1, x: 545, y: 195, role: 'GUARD' },
    { floor: 1, x: 745, y: 325, role: 'GUARD' },
    { floor: 2, x: 315, y: 185, role: 'CAPTAIN' },
    { floor: 2, x: 515, y: 195, role: 'GUARD' },
  ];
  if (hasBasement) {
    botSpawns.push({ floor: 0, x: 265, y: 340, role: 'GUARD' });
  }

  return {
    id,
    archetypeLabel: hasBasement
      ? `2-STORY ${ext.style.toUpperCase()} + BASEMENT (${multiVault ? '2 VAULTS' : '1 VAULT'})`
      : `2-STORY ${ext.style.toUpperCase()} + 2-CAR GARAGE`,
    worldWidth: 960,
    worldHeight: 620,
    availableFloors: hasBasement ? [0, 1, 2] : [1, 2],
    floorsById,
    playerSpawn: { floor: 1, x: 330, y: 536 },
    entryDoorRect: { x: 272, y: 586, w: 116, h: 16 },
    vaults,
    botSpawns,
    policeBreachCount: getPoliceBreachCount('HOUSE', payoutCash),
    theme: {
      exteriorBg: cols.exteriorBg,
      floorTileA: '#4a3525',
      floorTileB: '#59402d',
      tileSize: 30,
      vaultTileA: '#1e293b',
      vaultTileB: '#0f172a',
      wallFill: cols.wallFill,
      wallStroke: cols.wallStroke,
      interiorWallFill: cols.interiorWallFill,
      interiorWallStroke: cols.interiorWallStroke,
      counterWood: '#78350f',
      counterTop: '#fde68a',
      accentColor: '#f59e0b',
      lootVisual: 'wall_safe',
      vaultLabel: multiVault ? 'MULTI-FLOOR SAFES' : '2F MASTER VAULT',
      tierBadge: multiVault ? '2-VAULT HOME' : hasBasement ? '2-STORY + BASEMENT' : '2-STORY COLONIAL',
    },
  };
}

function buildLuxuryEstatePlan(
  id: string,
  name: string,
  payoutCash: number,
  ext: HouseExteriorProfile
): BuildingFloorplan {
  // Matches 3D 2-Story Luxury Mansion strictly (B1 + 1F + 2F — NO fake 3F!):
  // Main Villa on LEFT + 3-Car Luxury Garage on RIGHT + Backyard Pool Deck at NORTH + Estate Elevator!
  // Zero free mini-games inside houses — players furnish their mansion with cash!
  const isLodge = ext.style === 'lodge';
  const isCoastal = ext.style === 'coastal';
  const lid = id.toLowerCase();
  const hasThreeVaults =
    payoutCash >= 24000 ||
    payoutCash === 0 ||
    lid.includes('potomac') ||
    lid.includes('belair') ||
    lid.includes('billionaire') ||
    lid.includes('penthouse') ||
    lid.includes('villa');
  const hasBasement = ext.hasBasement || isLodge || isCoastal || hasThreeVaults;
  const vault2Floor: HeistFloorId = isLodge || isCoastal ? 0 : 2;
  const cols = getHouseInteriorColors(
    ext,
    isLodge ? '#7c4a26' : isCoastal ? '#bae6fd' : '#991b1b',
    '#0f172a'
  );
  const vaultCount = hasThreeVaults && hasBasement ? 3 : 2;
  const shares = splitPayoutShares(payoutCash, vaultCount);

  const f1Playable: FloorZoneRect[] = [
    { x: 36, y: 24, w: 784, h: 684 }, // Main villa
    { x: 820, y: 132, w: 304, h: 576 }, // 3-Car Luxury Garage
  ];
  const f1Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 36, h: 740, kind: 'wall' },
    { x: 1124, y: 0, w: 36, h: 740, kind: 'wall' },
    { x: 820, y: 0, w: 340, h: 132, kind: 'wall' },
    // 1F Grand Parlor Safe in NE of main villa
    { x: 560, y: 24, w: 18, h: 102, kind: 'vault_wall' },
    { x: 736, y: 24, w: 18, h: 102, kind: 'vault_wall' },
    { x: 560, y: 106, w: 42, h: 20, kind: 'vault_wall' },
    { x: 694, y: 106, w: 60, h: 20, kind: 'vault_wall' },
    // Mudroom doorway between Villa & 3-Car Garage (open y:280..410)
    { x: 808, y: 132, w: 18, h: 148, kind: 'interior_wall' },
    { x: 808, y: 410, w: 18, h: 298, kind: 'interior_wall' },
    // Luxury Furniture (no free games!)
    { x: 88, y: 245, w: 94, h: 62, kind: 'piano' },
    { x: 450, y: 235, w: 132, h: 30, kind: 'kitchen_island' },
    { x: 165, y: 430, w: 126, h: 38, kind: 'sofa' },
    { x: 960, y: 185, w: 112, h: 36, kind: 'desk' },
  ];

  const f2Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 48, h: 740, kind: 'wall' },
    { x: 820, y: 0, w: 340, h: 740, kind: 'wall' },
    { x: 86, y: 310, w: 92, h: 66, kind: 'bed' },
    { x: 585, y: 315, w: 116, h: 38, kind: 'desk' },
    { x: 48, y: 240, w: 180, h: 18, kind: 'interior_wall' },
  ];
  if (vault2Floor === 2 || hasThreeVaults) {
    f2Obstacles.push(
      { x: 290, y: 24, w: 18, h: 102, kind: 'vault_wall' },
      { x: 510, y: 24, w: 18, h: 102, kind: 'vault_wall' },
      { x: 290, y: 106, w: 62, h: 20, kind: 'vault_wall' },
      { x: 448, y: 106, w: 80, h: 20, kind: 'vault_wall' }
    );
  }

  // Floor 0 (B1): Underground Bullion Vault & Game Room Shell
  const b1Obstacles: WallRect[] = [
    { x: 0, y: 0, w: 48, h: 740, kind: 'wall' },
    { x: 820, y: 0, w: 340, h: 740, kind: 'wall' },
    { x: 0, y: 0, w: 1160, h: 36, kind: 'wall' },
    { x: 0, y: 696, w: 1160, h: 44, kind: 'wall' },
    { x: 140, y: 260, w: 132, h: 38, kind: 'sofa' },
    { x: 580, y: 260, w: 116, h: 38, kind: 'desk' },
  ];
  if (vault2Floor === 0 || hasThreeVaults) {
    b1Obstacles.push(
      { x: 290, y: 36, w: 18, h: 102, kind: 'vault_wall' },
      { x: 510, y: 36, w: 18, h: 102, kind: 'vault_wall' },
      { x: 290, y: 118, w: 62, h: 20, kind: 'vault_wall' },
      { x: 448, y: 118, w: 80, h: 20, kind: 'vault_wall' }
    );
  }

  const vaults: VaultSpec[] = [
    {
      id: `vault_${id}_1f`,
      floor: 1,
      label: '1F GRAND PARLOR SAFE',
      doorRect: { x: 602, y: 106, w: 92, h: 20 },
      lootZone: { x: 648, y: 66, radius: 30 },
      cashShare: shares[0],
    },
  ];
  if (hasThreeVaults && hasBasement) {
    vaults.push(
      {
        id: `vault_${id}_2f`,
        floor: 2,
        label: '2F MASTER COLLECTOR VAULT',
        doorRect: { x: 352, y: 106, w: 96, h: 20 },
        lootZone: { x: 400, y: 66, radius: 32 },
        cashShare: shares[1],
      },
      {
        id: `vault_${id}_b1`,
        floor: 0,
        label: 'B1 UNDERGROUND BULLION VAULT',
        doorRect: { x: 352, y: 118, w: 96, h: 20 },
        lootZone: { x: 400, y: 78, radius: 32 },
        cashShare: shares[2],
      }
    );
  } else if (vault2Floor === 2) {
    vaults.push({
      id: `vault_${id}_2f`,
      floor: 2,
      label: '2F MASTER COLLECTOR VAULT',
      doorRect: { x: 352, y: 106, w: 96, h: 20 },
      lootZone: { x: 400, y: 66, radius: 32 },
      cashShare: shares[1],
    });
  } else {
    vaults.push({
      id: `vault_${id}_b1`,
      floor: 0,
      label: 'B1 UNDERGROUND BULLION VAULT',
      doorRect: { x: 352, y: 118, w: 96, h: 20 },
      lootZone: { x: 400, y: 78, radius: 32 },
      cashShare: shares[1],
    });
  }

  const f1Stairs: StairPortal[] = [
    {
      x: 310,
      y: 205,
      w: 80,
      h: 68,
      targetFloor: 2,
      exitX: 685,
      exitY: 560,
      dir: 'up',
      label: '2F MASTER WING',
    },
  ];
  if (hasBasement) {
    f1Stairs.push({
      x: 680,
      y: 585,
      w: 80,
      h: 68,
      targetFloor: 0,
      exitX: 665,
      exitY: 540,
      dir: 'down',
      label: 'B1 GAME VAULT',
    });
  }

  const elevatorPad: ElevatorPortal = { x: 64, y: 540, w: 84, h: 68, label: 'ESTATE ELEVATOR' };

  const floorsById: Partial<Record<HeistFloorId, HeistFloorData>> = {
    1: {
      floorId: 1,
      floorName: `1F · ${name.toUpperCase()} GRAND FOYER, POOL DECK & 3-CAR GARAGE`,
      playableZones: f1Playable,
      rugs: [
        { x: 360, y: 310, w: 150, h: 350, color: isCoastal ? '#0e7490' : '#7f1d1d', borderColor: '#facc15' },
      ],
      decors: [
        {
          x: 86,
          y: 44,
          w: 260,
          h: 120,
          kind: 'pool_water',
          color: isCoastal ? '#06b6d4' : '#0284c7',
          accent: '#bae6fd',
        },
        { x: 36, y: 400, w: 16, h: 72, kind: 'fireplace_hearth', color: '#44403c' },
        { x: 836, y: 146, w: 274, h: 546, kind: 'garage_slab', color: '#334155', accent: '#facc15' },
      ],
      obstacles: f1Obstacles,
      waypoints: [
        { x: 435, y: 635 },
        { x: 435, y: 375 },
        { x: 645, y: 185 },
        { x: 280, y: 245 },
        { x: 960, y: 345 },
        { x: 615, y: 520 },
      ],
      stairs: f1Stairs,
      elevators: [elevatorPad],
      npcs: [
        {
          id: 'estate_butler',
          floor: 1,
          name: 'Alfred Vance',
          roleLabel: 'Estate Butler',
          x: 435,
          y: 350,
          facing: Math.PI / 2,
          shirtColor: '#111827',
          hairColor: '#e2e8f0',
          dialogue: `Welcome to ${name}! Ride the Estate Elevator between B1, 1F & 2F, or buy home games in the top Shop menu!`,
        },
      ],
      activities: [
        { id: 'est_rest', floor: 1, kind: 'rest', label: '🛋️ Relax in Parlor', x: 228, y: 390, radius: 30 },
      ],
      emptySlots: [
        { id: 'est_garage_1', floor: 1, x: 870, y: 255, w: 160, h: 90, label: '3-Car Garage Pad A' },
        { id: 'est_garage_2', floor: 1, x: 870, y: 425, w: 160, h: 90, label: '3-Car Garage Pad B' },
        { id: 'est_1f_east', floor: 1, x: 525, y: 365, w: 160, h: 90, label: 'Grand Hall Game Pad' },
      ],
    },
    2: {
      floorId: 2,
      floorName: `2F · ${name.toUpperCase()} MASTER PENTHOUSE & LOUNGE`,
      playableZones: [{ x: 48, y: 24, w: 772, h: 684 }],
      rugs: [{ x: 240, y: 190, w: 320, h: 270, color: '#581c87', borderColor: '#facc15' }],
      decors: [],
      obstacles: f2Obstacles,
      waypoints: [
        { x: 685, y: 560 },
        { x: 435, y: 500 },
        { x: 400, y: 185 },
        { x: 180, y: 205 },
        { x: 650, y: 220 },
      ],
      stairs: [
        {
          x: 690,
          y: 590,
          w: 80,
          h: 68,
          targetFloor: 1,
          exitX: 415,
          exitY: 295,
          dir: 'down',
          label: '1F GRAND FOYER',
        },
      ],
      elevators: [elevatorPad],
      npcs: [],
      activities: [],
      emptySlots: [
        { id: 'est_2f_lounge1', floor: 2, x: 250, y: 250, w: 160, h: 90, label: '2F Penthouse Pad A' },
        { id: 'est_2f_lounge2', floor: 2, x: 250, y: 410, w: 160, h: 90, label: '2F Penthouse Pad B' },
      ],
    },
  };

  if (hasBasement) {
    floorsById[0] = {
      floorId: 0,
      floorName: `B1 · ${name.toUpperCase()} LOWER GAME HALL & VAULT`,
      playableZones: [{ x: 48, y: 36, w: 772, h: 660 }],
      rugs: [{ x: 145, y: 185, w: 545, h: 350, color: '#14532d', borderColor: '#facc15' }],
      decors: [],
      obstacles: b1Obstacles,
      waypoints: [
        { x: 665, y: 540 },
        { x: 435, y: 500 },
        { x: 400, y: 195 },
        { x: 195, y: 220 },
      ],
      stairs: [
        {
          x: 690,
          y: 590,
          w: 80,
          h: 68,
          targetFloor: 1,
          exitX: 615,
          exitY: 615,
          dir: 'up',
          label: '1F FOYER',
        },
      ],
      elevators: [elevatorPad],
      npcs: [
        {
          id: 'est_b1_host',
          floor: 0,
          name: 'Elena',
          roleLabel: 'Estate Curator',
          x: 400,
          y: 225,
          facing: Math.PI / 2,
          shirtColor: '#0284c7',
          hairColor: '#facc15',
          dialogue: 'Spacious lower level ready for Billiards, Air Hockey & Ping Pong tables from the Shop!',
        },
      ],
      activities: [],
      emptySlots: [
        { id: 'est_b1_pad1', floor: 0, x: 145, y: 355, w: 170, h: 92, label: 'B1 Game Hall Pad A' },
        { id: 'est_b1_pad2', floor: 0, x: 375, y: 355, w: 170, h: 92, label: 'B1 Game Hall Pad B' },
      ],
    };
  }

  const botSpawns: BuildingFloorplan['botSpawns'] = [
    { floor: 1, x: 648, y: 185, role: 'CAPTAIN' },
    { floor: 1, x: 960, y: 355, role: 'GUARD' },
    { floor: 1, x: 270, y: 335, role: 'GUARD' },
  ];
  if (vaults.some((v) => v.floor === 2)) {
    botSpawns.push(
      { floor: 2, x: 400, y: 195, role: 'CAPTAIN' },
      { floor: 2, x: 640, y: 245, role: 'GUARD' }
    );
  }
  if (hasBasement && vaults.some((v) => v.floor === 0)) {
    botSpawns.push(
      { floor: 0, x: 400, y: 210, role: 'CAPTAIN' },
      { floor: 0, x: 580, y: 365, role: 'GUARD' }
    );
  }

  const availableFloors: HeistFloorId[] = hasBasement ? [0, 1, 2] : [1, 2];
  const levelCountLabel = hasBasement ? '2-STORY + B1' : '2-STORY';
  const vaultCountLabel = `${vaults.length} VAULTS`;

  return {
    id,
    archetypeLabel: isLodge
      ? `${levelCountLabel} TIMBER MOUNTAIN COMPOUND (${vaultCountLabel})`
      : isCoastal
      ? `${levelCountLabel} ATLANTIC COASTAL VILLA (${vaultCountLabel})`
      : `${levelCountLabel} LUXURY ESTATE + ELEVATOR (${vaultCountLabel})`,
    worldWidth: 1160,
    worldHeight: 740,
    availableFloors,
    floorsById,
    playerSpawn: { floor: 1, x: 435, y: 660 },
    entryDoorRect: { x: 372, y: 704, w: 126, h: 16 },
    vaults,
    botSpawns,
    policeBreachCount: getPoliceBreachCount('HOUSE', payoutCash),
    theme: {
      exteriorBg: cols.exteriorBg,
      floorTileA: isLodge ? '#3f2718' : isCoastal ? '#134e4a' : '#2c221b',
      floorTileB: isLodge ? '#4d301e' : isCoastal ? '#115e59' : '#3a2d23',
      tileSize: 34,
      vaultTileA: '#1e1b4b',
      vaultTileB: '#0f172a',
      wallFill: cols.wallFill,
      wallStroke: cols.wallStroke,
      interiorWallFill: cols.interiorWallFill,
      interiorWallStroke: '#facc15',
      counterWood: '#78350f',
      counterTop: '#fef08a',
      accentColor: '#ec4899',
      lootVisual: 'diamonds',
      vaultLabel: `${vaultCountLabel} LUXURY ESTATE`,
      tierBadge: isLodge
        ? `${levelCountLabel} TIMBER LODGE`
        : isCoastal
        ? `${levelCountLabel} COASTAL VILLA`
        : `${levelCountLabel} ESTATE · LIFT`,
    },
  };
}

function buildTownhousePlan(
  id: string,
  name: string,
  payoutCash: number,
  ext: HouseExteriorProfile
): BuildingFloorplan {
  // Brownstone Townhouse: strictly 1F + 2F (+ B1 Basement if ext.hasBasement), zero free mini-games!
  const cols = getHouseInteriorColors(ext, '#8b3a2b', '#1e293b');
  const hasBasement = ext.hasBasement;
  const f1Stairs: StairPortal[] = [
    { x: 580, y: 170, w: 76, h: 66, targetFloor: 2, exitX: 520, exitY: 455, dir: 'up', label: '2F SUITE' },
  ];
  if (hasBasement) {
    f1Stairs.push({
      x: 580,
      y: 410,
      w: 76,
      h: 66,
      targetFloor: 0,
      exitX: 520,
      exitY: 410,
      dir: 'down',
      label: 'B1 BASEMENT',
    });
  }

  const floorsById: Partial<Record<HeistFloorId, HeistFloorData>> = {
    1: {
      floorId: 1,
      floorName: `1F · ${name.toUpperCase()} PARLOR`,
      playableZones: [{ x: 180, y: 24, w: 520, h: 524 }],
      rugs: [{ x: 255, y: 175, w: 220, h: 265, color: '#7f1d1d', borderColor: '#fb923c' }],
      decors: [{ x: 180, y: 245, w: 16, h: 72, kind: 'fireplace_hearth', color: '#44403c' }],
      obstacles: [
        { x: 0, y: 0, w: 180, h: 580, kind: 'wall' },
        { x: 700, y: 0, w: 180, h: 580, kind: 'wall' },
        { x: 235, y: 270, w: 110, h: 36, kind: 'sofa' },
        { x: 515, y: 78, w: 124, h: 28, kind: 'kitchen_island' },
      ],
      waypoints: [{ x: 440, y: 475 }, { x: 440, y: 285 }, { x: 440, y: 155 }],
      stairs: f1Stairs,
      npcs: [],
      activities: [{ id: 'th_rest', floor: 1, kind: 'rest', label: '🛋️ Brownstone Lounge', x: 290, y: 345, radius: 28 }],
      emptySlots: [
        { id: 'th_1f_pad', floor: 1, x: 270, y: 120, w: 155, h: 86, label: 'Parlor Game Pad' },
      ],
    },
    2: {
      floorId: 2,
      floorName: '2F · BROWNSTONE MASTER FLOOR',
      playableZones: [{ x: 180, y: 24, w: 520, h: 524 }],
      rugs: [{ x: 270, y: 145, w: 245, h: 195, color: '#1e3a8a', borderColor: '#60a5fa' }],
      decors: [],
      obstacles: [
        { x: 0, y: 0, w: 180, h: 580, kind: 'wall' },
        { x: 700, y: 0, w: 180, h: 580, kind: 'wall' },
        { x: 220, y: 95, w: 86, h: 64, kind: 'bed' },
        { x: 530, y: 110, w: 102, h: 36, kind: 'desk' },
      ],
      waypoints: [{ x: 520, y: 455 }, { x: 440, y: 250 }],
      stairs: [
        { x: 210, y: 445, w: 76, h: 66, targetFloor: 1, exitX: 505, exitY: 210, dir: 'down', label: '1F PARLOR' },
      ],
      npcs: [],
      activities: [],
      emptySlots: [
        { id: 'th_2f_pad', floor: 2, x: 275, y: 225, w: 160, h: 86, label: '2F Suite Game Pad' },
      ],
    },
  };

  if (!hasBasement) {
    floorsById[2]!.obstacles.push(
      { x: 334, y: 24, w: 18, h: 96, kind: 'vault_wall' },
      { x: 528, y: 24, w: 18, h: 96, kind: 'vault_wall' },
      { x: 334, y: 100, w: 54, h: 20, kind: 'vault_wall' },
      { x: 486, y: 100, w: 60, h: 20, kind: 'vault_wall' }
    );
  } else {
    floorsById[0] = {
      floorId: 0,
      floorName: 'B1 · BROWNSTONE BRICK BASEMENT & SAFE',
      playableZones: [{ x: 180, y: 36, w: 520, h: 492 }],
      rugs: [],
      decors: [],
      obstacles: [
        { x: 0, y: 0, w: 180, h: 580, kind: 'wall' },
        { x: 700, y: 0, w: 180, h: 580, kind: 'wall' },
        { x: 0, y: 0, w: 880, h: 36, kind: 'wall' },
        { x: 0, y: 528, w: 880, h: 52, kind: 'wall' },
        { x: 334, y: 36, w: 18, h: 96, kind: 'vault_wall' },
        { x: 528, y: 36, w: 18, h: 96, kind: 'vault_wall' },
        { x: 334, y: 112, w: 54, h: 20, kind: 'vault_wall' },
        { x: 486, y: 112, w: 60, h: 20, kind: 'vault_wall' },
      ],
      waypoints: [{ x: 520, y: 410 }, { x: 437, y: 195 }],
      stairs: [
        { x: 210, y: 436, w: 76, h: 66, targetFloor: 1, exitX: 505, exitY: 450, dir: 'up', label: '1F PARLOR' },
      ],
      npcs: [],
      activities: [],
      emptySlots: [
        { id: 'th_b1_pad', floor: 0, x: 255, y: 215, w: 165, h: 90, label: 'B1 Brick Vault Pad' },
      ],
    };
  }

  return {
    id,
    archetypeLabel: hasBasement ? '2-STORY BROWNSTONE + BASEMENT' : '2-STORY URBAN BROWNSTONE TOWNHOUSE',
    worldWidth: 880,
    worldHeight: 580,
    availableFloors: hasBasement ? [0, 1, 2] : [1, 2],
    floorsById,
    playerSpawn: { floor: 1, x: 440, y: 500 },
    entryDoorRect: { x: 382, y: 546, w: 116, h: 16 },
    vaults: [
      hasBasement
        ? {
            id: `vault_${id}_b1`,
            floor: 0,
            label: 'B1 BASEMENT WALL SAFE',
            doorRect: { x: 388, y: 112, w: 98, h: 20 },
            lootZone: { x: 437, y: 74, radius: 28 },
            cashShare: payoutCash,
          }
        : {
            id: `vault_${id}_2f`,
            floor: 2,
            label: '2F SUITE WALL SAFE',
            doorRect: { x: 388, y: 100, w: 98, h: 20 },
            lootZone: { x: 437, y: 62, radius: 28 },
            cashShare: payoutCash,
          },
    ],
    botSpawns: [
      { floor: 1, x: 440, y: 220, role: 'GUARD' },
      { floor: hasBasement ? 0 : 2, x: 437, y: 195, role: 'CAPTAIN' },
    ],
    policeBreachCount: getPoliceBreachCount('HOUSE', payoutCash),
    theme: {
      exteriorBg: cols.exteriorBg,
      floorTileA: '#3d251b',
      floorTileB: '#4a2e22',
      tileSize: 30,
      vaultTileA: '#1c1917',
      vaultTileB: '#0c0a09',
      wallFill: cols.wallFill,
      wallStroke: cols.wallStroke,
      interiorWallFill: cols.interiorWallFill,
      interiorWallStroke: cols.interiorWallStroke,
      counterWood: '#78350f',
      counterTop: '#fb923c',
      accentColor: '#fb923c',
      lootVisual: 'wall_safe',
      vaultLabel: hasBasement ? 'B1 BASEMENT SAFE' : '2F SUITE SAFE',
      tierBadge: hasBasement ? '2-STORY + B1 TOWNHOUSE' : '2-STORY BROWNSTONE',
    },
  };
}

// ============================================================================
// 5. GENERIC EXPLORABLE CITY BUILDINGS (UNLIMITED FLOORS + ELEVATORS)
// ============================================================================

export function computeBuildingFloorCount(height: number, _name?: string, explicitStories?: number): number {
  if (explicitStories !== undefined && Number.isFinite(explicitStories) && explicitStories >= 1) {
    return Math.max(1, Math.round(explicitStories));
  }
  if (!Number.isFinite(height) || height < 12) return 1;
  if (height < 16.5) return 2;
  return Math.max(3, Math.round(height / 5.4));
}

function buildGenericCityBuildingPlan(
  id: string,
  name: string,
  buildingHeight: number,
  buildingStories?: number
): BuildingFloorplan {
  const lower = `${id} ${name}`.toLowerCase();
  const floorCount = computeBuildingFloorCount(buildingHeight, name, buildingStories);
  const availFloors: HeistFloorId[] = Array.from({ length: floorCount }, (_, idx) => idx + 1);
  const seed = hashString(id + name);

  const isClinic = /clinic|hospital|medical|urgent|health|dental|wellness|infirmary|pharmacy|doctor|care center/.test(lower);
  const isAirportOrAirpark = !isClinic && /airport|airpark|bwi|kgai|aviation|terminal|hangar/.test(lower);
  const isMediaOrWtc = !isClinic && /wtc|world trade|media|broadcast|studio/.test(lower);
  const isArenaOrBowling = !isClinic && /bowling|arena|stadium|theater|cinema|clubhouse|pool|fitness|gym|rec/.test(lower);
  const isMallOrRetail = !isClinic && /mall|plaza|outlet|gallery|mart|store|shop|market|center|crown/.test(lower);
  const isSchool = !isClinic && /school|high|academy|university|campus|library|college/.test(lower);
  const isLab = !isClinic && /nist|research|science|lab|aquarium/.test(lower);
  const isOffice =
    !isClinic &&
    !isArenaOrBowling &&
    !isMallOrRetail &&
    !isSchool &&
    !isLab &&
    (/office|corporate|headquarters|hq|tower|financial|legal|law|tech|solutions|associates|enterprise|business|commerce|trade|city hall|courthouse|annex|executive|mercantile|charles|pratt|light st|insurance|agency|realty|bankers|consult/.test(
      lower
    ) ||
      floorCount >= 3);

  const baseW = floorCount >= 4 ? 1180 : floorCount === 3 ? 1120 : floorCount === 2 ? 1020 : 860;
  const baseH = floorCount >= 4 ? 740 : floorCount === 3 ? 700 : floorCount === 2 ? 640 : 560;
  const worldW = isClinic || isOffice ? Math.max(baseW, 1140) : baseW;
  const worldH = isClinic || isOffice ? Math.max(baseH, 720) : baseH;

  const accentColor = isClinic
    ? '#22d3ee'
    : isOffice
    ? '#3b82f6'
    : isArenaOrBowling
    ? '#f97316'
    : isMallOrRetail
    ? '#ec4899'
    : isLab
    ? '#38bdf8'
    : isSchool
    ? '#fbbf24'
    : '#60a5fa';

  const venueBadge = isClinic
    ? 'CLINIC & MEDICAL SUITES'
    : isOffice
    ? 'CORPORATE OFFICE SUITES'
    : isArenaOrBowling
    ? 'SPORTS & REC VENUE'
    : isMallOrRetail
    ? 'SHOPPING CONCOURSE'
    : isLab
    ? 'RESEARCH & LAB FACILITY'
    : isSchool
    ? 'CAMPUS HALL'
    : floorCount >= 10
    ? 'METRO SKYSCRAPER'
    : floorCount >= 4
    ? 'MID-RISE TOWER'
    : floorCount >= 2
    ? 'METRO BUILDING'
    : 'CITY BUILDING';

  const padX = 48;
  const playW = worldW - padX * 2;
  const playH = worldH - 52;

  const floorsById: Partial<Record<HeistFloorId, HeistFloorData>> = {};

  const floorMiniGameRotation: Array<{
    propKind: InteriorPropKind;
    propW: number;
    propH: number;
    actKind: FloorActivityKind;
    actLabel: string;
    themeName: string;
  }> = [
    {
      propKind: 'arcade_cab',
      propW: 112,
      propH: 56,
      actKind: 'arcade',
      actLabel: '🕹️ Floor Arcade Kiosk',
      themeName: 'ARCADE & BREAK LOUNGE',
    },
    {
      propKind: 'hoop_machine',
      propW: 112,
      propH: 58,
      actKind: 'pop_a_shot',
      actLabel: '🏀 Atrium Pop-a-Shot',
      themeName: 'RECREATION TERRACE',
    },
    {
      propKind: 'skeeball_lane',
      propW: 132,
      propH: 56,
      actKind: 'skeeball',
      actLabel: '🎳 Concourse Skee-Ball',
      themeName: 'GAME CONCOURSE',
    },
    {
      propKind: 'racing_sim',
      propW: 120,
      propH: 56,
      actKind: 'racing_sim',
      actLabel: '🏎️ Telemetry Racing Sim',
      themeName: 'OPERATIONS & SIM SUITE',
    },
    {
      propKind: 'arcade_cab',
      propW: 112,
      propH: 58,
      actKind: 'whack_a_bot',
      actLabel: '🔨 Breakroom Whack-a-Bot',
      themeName: 'INNOVATION & STUDY FLOOR',
    },
    {
      propKind: 'pinball_machine',
      propW: 108,
      propH: 56,
      actKind: 'pinball',
      actLabel: '⚡ Neon Pinball Machine',
      themeName: 'MEDIA & ENTERTAINMENT FLOOR',
    },
  ];

  const npcNames = [
    'Coordinator Vance',
    'Manager Reyes',
    'Curator Patel',
    'Analyst Brooks',
    'Host Monroe',
    'Director Ortiz',
    'Supervisor Kim',
    'Concierge Ellis',
  ];
  const npcShirts = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#2563eb', '#db2777'];
  const patientFirstNames = [
    'Maya R.', 'Devon K.', 'Elena S.', 'Carlos M.', 'Priya N.', 'Jordan T.',
    'Hannah W.', 'Lucas B.', 'Nadia P.', 'Trevor G.', 'Sonia L.', 'Owen H.',
  ];
  const employeeFirstNames = [
    'Alex Chen', 'Morgan Vance', 'Taylor Brooks', 'Jordan Patel', 'Casey Diaz', 'Riley Kim',
    'Samira Ali', 'Grant Miller', 'Chloe Ortiz', 'Noah Reed', 'Avery Foster', 'Dylan Cruz',
  ];
  const employeeRoles = [
    'Senior Analyst', 'Project Lead', 'Systems Engineer', 'Account Manager',
    'Legal Counsel', 'Operations Specialist', 'Product Designer', 'HR Coordinator',
    'Compliance Officer', 'Tax Consultant', 'Strategy Associate', 'IT Admin',
  ];
  const patientDialogues = [
    'Checking in for my afternoon checkup in this clinic wing.',
    'Waiting on vitals and lab results before seeing the doctor.',
    'The nurses called my chart—my exam room is just down the hall.',
    'Came in for an urgent physical and prescription refill.',
    'Just finished blood pressure screening in the triage bay.',
    'Appreciate how organized all the individual exam suites are here.',
  ];
  const employeeDialogues = [
    'Wrapping up Q4 projections before the 3 PM departmental sync.',
    'Heads down reviewing client briefs inside my office suite.',
    'Grabbing a file from the operations pod before heading upstairs.',
    'Our floor is packed with client calls today—busy quarter!',
    'Checking spreadsheets in this workstation bay all afternoon.',
    'Use the elevator in the northeast corner to visit other office floors.',
  ];

  for (const fl of availFloors) {
    const obstacles: WallRect[] = [
      { x: 0, y: 0, w: padX, h: worldH, kind: 'wall' },
      { x: worldW - padX, y: 0, w: padX, h: worldH, kind: 'wall' },
    ];
    const activities: FloorActivitySpec[] = [];
    const npcs: FloorNpcSpec[] = [];
    const decors: FloorDecor[] = [];
    const rugs: FloorRug[] = [];
    const midX = Math.round(worldW / 2);
    const midY = Math.round(worldH / 2);
    let floorSubtitle = name.toUpperCase();

    if (isClinic || isOffice) {
      // Zero mini-games inside Clinics and Offices! Partitioned small rooms + high patient/employee density.
      const roomCols = 4;
      const wingLeft = 92;
      const wingRight = worldW - 92;
      const roomW = Math.floor((wingRight - wingLeft) / roomCols);
      const wallThick = 14;
      const doorW = 66;
      const northTopY = 142;
      const northBotY = 294;
      const southTopY = 426;
      const southBotY = 578;
      const roomH = northBotY - northTopY;

      floorSubtitle = isClinic
        ? fl === 1
          ? 'TRIAGE RECEPTION & EXAM ROOMS'
          : fl === floorCount
          ? 'SPECIALTY DIAGNOSTICS & PATIENT SUITES'
          : `CLINIC EXAM WING · ${fl}F`
        : fl === 1
        ? 'CORPORATE RECEPTION & WORKSTATIONS'
        : fl === floorCount
        ? 'EXECUTIVE OFFICES & CONFERENCE SUITES'
        : `OFFICE SUITES & WORKSTATIONS · ${fl}F`;

      rugs.push({
        x: wingLeft,
        y: northBotY + 18,
        w: roomCols * roomW,
        h: southTopY - northBotY - 36,
        color: isClinic ? '#0c4a6e' : '#1e293b',
        borderColor: accentColor,
      });

      // Build outer vertical dividers for all 4 north rooms and 4 south rooms
      for (let c = 0; c <= roomCols; c++) {
        const vx = wingLeft + c * roomW;
        obstacles.push({ x: vx, y: northTopY, w: wallThick, h: roomH, kind: 'interior_wall' });
        obstacles.push({ x: vx, y: southTopY, w: wallThick, h: roomH, kind: 'interior_wall' });
      }

      // Build back & doorway walls + interior room props for each of the 8 rooms
      for (let c = 0; c < roomCols; c++) {
        const rx = wingLeft + c * roomW;
        const doorStart = rx + Math.round((roomW - doorW) / 2);
        const doorEnd = doorStart + doorW;

        // North room back wall + corridor-facing doorway wall
        obstacles.push({ x: rx, y: northTopY, w: roomW + wallThick, h: wallThick, kind: 'interior_wall' });
        obstacles.push({ x: rx, y: northBotY - wallThick, w: doorStart - rx, h: wallThick, kind: 'interior_wall' });
        obstacles.push({ x: doorEnd, y: northBotY - wallThick, w: rx + roomW + wallThick - doorEnd, h: wallThick, kind: 'interior_wall' });

        // South room back wall + corridor-facing doorway wall
        obstacles.push({ x: rx, y: southBotY - wallThick, w: roomW + wallThick, h: wallThick, kind: 'interior_wall' });
        obstacles.push({ x: rx, y: southTopY, w: doorStart - rx, h: wallThick, kind: 'interior_wall' });
        obstacles.push({ x: doorEnd, y: southTopY, w: rx + roomW + wallThick - doorEnd, h: wallThick, kind: 'interior_wall' });

        if (isClinic) {
          // Small clinic exam room: exam bed on left side + clinician chart desk on right side
          obstacles.push({ x: rx + 24, y: northTopY + 26, w: 66, h: 42, kind: 'bed' });
          obstacles.push({ x: rx + roomW - 76, y: northTopY + 26, w: 54, h: 28, kind: 'desk' });

          obstacles.push({ x: rx + 24, y: southBotY - 68, w: 66, h: 42, kind: 'bed' });
          obstacles.push({ x: rx + roomW - 76, y: southBotY - 56, w: 54, h: 28, kind: 'desk' });
        } else {
          // Small corporate office / cubicle pod: work desk + side table or sofa
          obstacles.push({ x: rx + 26, y: northTopY + 28, w: 78, h: 32, kind: 'desk' });
          if (c === roomCols - 1) {
            obstacles.push({ x: rx + roomW - 88, y: northTopY + 76, w: 66, h: 32, kind: 'table' });
          } else {
            obstacles.push({ x: rx + roomW - 78, y: northTopY + 30, w: 56, h: 28, kind: 'sofa' });
          }

          obstacles.push({ x: rx + 26, y: southBotY - 62, w: 78, h: 32, kind: 'desk' });
          obstacles.push({ x: rx + roomW - 82, y: southBotY - 60, w: 60, h: 28, kind: 'table' });
        }
      }

      if (fl === 1) {
        // Lobby check-in reception desk near bottom entrance (keeps south corridor open)
        obstacles.push({ x: midX - 115, y: worldH - 122, w: 230, h: 24, kind: 'counter' });
        activities.push({
          id: `${id}_work_reception_1f`,
          floor: 1,
          kind: isClinic ? 'work_clinic' : 'work_office',
          label: isClinic ? '🩺 Triage Check-In Desk (Work)' : '💼 Reception & Admin Desk (Work)',
          x: midX,
          y: worldH - 156,
          radius: 34,
        });
      }

      // Add realistic indoor Work Shift stations inside individual rooms on EVERY floor (no arcade games!)
      if (isClinic) {
        activities.push(
          {
            id: `${id}_clinic_vitals_${fl}`,
            floor: fl,
            kind: 'work_clinic',
            label: `🩺 Rm ${fl}02 Vitals & Charting`,
            x: wingLeft + roomW + Math.round(roomW * 0.68),
            y: northTopY + 94,
            radius: 28,
          },
          {
            id: `${id}_clinic_rx_${fl}`,
            floor: fl,
            kind: 'work_clinic',
            label: `💊 Rm ${fl}07 Rx & Diagnostic Desk`,
            x: wingLeft + 2 * roomW + Math.round(roomW * 0.68),
            y: southTopY + 54,
            radius: 28,
          }
        );
      } else {
        activities.push(
          {
            id: `${id}_office_analyst_${fl}`,
            floor: fl,
            kind: 'work_office',
            label: `💼 Ste ${fl}01 Analyst Desk (Work)`,
            x: wingLeft + Math.round(roomW * 0.36),
            y: northTopY + 94,
            radius: 28,
          },
          {
            id: `${id}_office_ops_${fl}`,
            floor: fl,
            kind: isAirportOrAirpark ? 'work_atc' : isMediaOrWtc ? 'work_studio' : 'work_office',
            label: isAirportOrAirpark
              ? `✈️ Ste ${fl}03 ATC Radar Console (Work)`
              : isMediaOrWtc
              ? `🎬 Ste ${fl}03 Broadcast Studio (Work)`
              : `💻 Ste ${fl}03 Operations Terminal`,
            x: wingLeft + 2 * roomW + Math.round(roomW * 0.36),
            y: northTopY + 94,
            radius: 28,
          },
          {
            id: `${id}_office_exec_${fl}`,
            floor: fl,
            kind: isMediaOrWtc && fl === floorCount ? 'work_studio' : 'work_office',
            label:
              isMediaOrWtc && fl === floorCount
                ? `🎙️ ${fl}F Skyline Broadcast Booth (Work)`
                : fl === floorCount
                ? `📊 Ste ${fl}08 Executive Suite (Work)`
                : `⚖️ Ste ${fl}08 Client Review Desk`,
            x: wingLeft + 3 * roomW + Math.round(roomW * 0.36),
            y: southTopY + 54,
            radius: 28,
          }
        );
      }

      // Populate 8–12 Patients (plus 2–3 Doctors/Nurses) OR 8–12 Employees on every floor
      const primaryNpcCount = 9 + ((seed + fl) % 3); // 9, 10, or 11 people per floor
      for (let p = 0; p < primaryNpcCount; p++) {
        const roomIdx = p % 8;
        const isNorthRoom = roomIdx < 4;
        const colIdx = roomIdx % 4;
        const roomCenterX = wingLeft + colIdx * roomW + Math.round(roomW / 2);
        const roomPosY = isNorthRoom ? northTopY + 104 : southTopY + 56;
        const jitterX = p >= 8 ? (p % 2 === 0 ? -36 : 36) : ((p + fl) % 3 - 1) * 26;
        const npcX = p >= 8 ? midX + (p - 9) * 145 : roomCenterX + jitterX;
        const npcY = p >= 8 ? midY + (p % 2 === 0 ? -18 : 20) : roomPosY;

        if (isClinic) {
          const pName = patientFirstNames[(seed + fl * 5 + p) % patientFirstNames.length];
          npcs.push({
            id: `${id}_patient_${fl}_${p}`,
            floor: fl,
            name: pName,
            roleLabel: `Patient · Rm ${fl}0${roomIdx + 1}`,
            x: npcX,
            y: npcY,
            facing: isNorthRoom ? Math.PI / 2 : -Math.PI / 2,
            shirtColor: ['#e2e8f0', '#7dd3fc', '#fda4af', '#a7f3d0', '#fde68a'][p % 5],
            hairColor: ['#1e293b', '#78350f', '#451a03', '#334155'][p % 4],
            dialogue: patientDialogues[(p + fl) % patientDialogues.length],
          });
        } else {
          const eName = employeeFirstNames[(seed + fl * 7 + p) % employeeFirstNames.length];
          const eRole = employeeRoles[(seed + fl * 3 + p) % employeeRoles.length];
          npcs.push({
            id: `${id}_emp_${fl}_${p}`,
            floor: fl,
            name: eName,
            roleLabel: `${eRole} · Ste ${fl}0${roomIdx + 1}`,
            x: npcX,
            y: npcY,
            facing: isNorthRoom ? Math.PI / 2 : -Math.PI / 2,
            shirtColor: npcShirts[(p + fl) % npcShirts.length],
            hairColor: ['#0f172a', '#451a03', '#78350f', '#334155'][p % 4],
            dialogue:
              p === 0
                ? `Clock in at any Suite Desk ([E]) to work an office shift for cash, or take this floor's check-in stipend!`
                : employeeDialogues[(p + fl) % employeeDialogues.length],
            serviceAction:
              p === 0
                ? {
                    label: `Office Floor ${fl} Check-In Bonus (+$300)`,
                    rewardCash: 300,
                    kind: 'teller',
                  }
                : undefined,
          });
        }
      }

      if (isClinic) {
        const staffCount = 2 + (fl % 2); // 2 or 3 medical staff per floor
        for (let s = 0; s < staffCount; s++) {
          npcs.push({
            id: `${id}_med_${fl}_${s}`,
            floor: fl,
            name: s === 0 ? `Dr. ${['Lin', 'Patel', 'Ramirez', 'Carter'][(seed + fl) % 4]}` : `Nurse ${['Avery', 'Chloe', 'Marcus'][(seed + fl + s) % 3]}`,
            roleLabel: s === 0 ? 'Attending Physician' : 'Triage Nurse',
            x: fl === 1 && s === 0 ? midX : wingLeft + 140 + s * 320,
            y: fl === 1 && s === 0 ? worldH - 152 : midY + (s % 2 === 0 ? -12 : 12),
            facing: -Math.PI / 2,
            shirtColor: s === 0 ? '#f8fafc' : '#0ea5e9',
            hairColor: '#0f172a',
            dialogue: `Welcome to Floor ${fl} of ${name}. Step up to any Triage or Charting Desk ([E]) to work a medical shift!`,
            serviceAction:
              s === 0
                ? {
                    label: `Floor ${fl} Medical Shift Bonus (+$320)`,
                    rewardCash: 320,
                    kind: 'teller',
                  }
                : undefined,
          });
        }
      }
    } else if (fl === 1) {
      floorSubtitle = 'MAIN LOBBY';
      obstacles.push({ x: midX - 150, y: 175, w: 300, h: 30, kind: 'counter' });
      obstacles.push({ x: 110, y: 315, w: 120, h: 40, kind: 'sofa' });
      obstacles.push({ x: worldW - 230, y: 315, w: 120, h: 40, kind: 'sofa' });
      npcs.push({
        id: `${id}_concierge`,
        floor: 1,
        name: isSchool ? 'Dean Holloway' : isLab ? 'Dr. Lin' : isMallOrRetail ? 'Mall Host Avery' : 'Lobby Concierge',
        roleLabel: venueBadge,
        x: midX,
        y: 142,
        facing: Math.PI / 2,
        shirtColor: '#2563eb',
        hairColor: '#1e293b',
        dialogue:
          floorCount >= 2
            ? `Welcome inside ${name}! Work the front desk ([E]) for shift cash or take the Stairs / Main Elevator up to ${floorCount}F!`
            : `Welcome inside ${name}! Step up to the front desk ([E]) to work a shift or explore the concourse.`,
      });
      // Every commercial / lab / campus / terminal / lobby building has a front counter work shift!
      const lobbyWorkKind = isAirportOrAirpark
        ? 'work_atc'
        : isMediaOrWtc
        ? 'work_studio'
        : isLab
        ? 'work_lab'
        : isMallOrRetail
        ? 'work_retail'
        : 'work_office';
      const lobbyWorkLabel = isAirportOrAirpark
        ? '✈️ ATC & Ramp Dispatch Console (Work)'
        : isMediaOrWtc
        ? '🎬 Broadcast & Audio Desk (Work)'
        : isLab
        ? '🔬 Lab Check-In & Assay Desk (Work)'
        : isMallOrRetail
        ? '🛒 Mall Register & Desk (Work)'
        : isSchool
        ? '📚 Campus Admin Desk (Work)'
        : '💼 Front Desk Work Shift';
      activities.push({
        id: `${id}_lobby_work`,
        floor: 1,
        kind: lobbyWorkKind,
        label: lobbyWorkLabel,
        x: midX,
        y: 236,
        radius: 30,
      });
      if (isMallOrRetail) {
        obstacles.push({ x: worldW - 255, y: 175, w: 120, h: 28, kind: 'counter' });
        activities.push({
          id: `${id}_kitchen_work`,
          floor: 1,
          kind: 'work_kitchen',
          label: '👨‍🍳 Bistro & Crab House Kitchen (Work)',
          x: worldW - 195,
          y: 236,
          radius: 30,
        });
      }
      if (isArenaOrBowling) {
        obstacles.push({ x: 140, y: 195, w: 124, h: 60, kind: 'air_hockey_table' });
        activities.push({ id: `${id}_air_hockey`, floor: 1, kind: 'air_hockey', label: '🏒 Lobby Air Hockey', x: 202, y: 286, radius: 30 });
      } else if (isMallOrRetail) {
        obstacles.push({ x: 140, y: 195, w: 102, h: 64, kind: 'claw_box' });
        activities.push({ id: `${id}_claw`, floor: 1, kind: 'claw_machine', label: '🧸 Atrium Prize Claw', x: 191, y: 288, radius: 30 });
      } else {
        activities.push({ id: `${id}_rest`, floor: 1, kind: 'rest', label: '🛋️ Relax in Lobby', x: 170, y: 382, radius: 28 });
      }
    } else if (fl === floorCount && floorCount >= 2) {
      floorSubtitle = floorCount >= 5 ? 'SKYLINE OBSERVATION DECK' : 'TOP FLOOR LOUNGE';
      obstacles.push({ x: 145, y: 215, w: 140, h: 46, kind: 'table' });
      obstacles.push({ x: worldW - 285, y: 215, w: 140, h: 46, kind: 'sofa' });
      obstacles.push({ x: 250, y: Math.min(worldH - 210, 420), w: 38, h: 38, kind: 'pillar' });
      obstacles.push({ x: worldW - 288, y: Math.min(worldH - 210, 420), w: 38, h: 38, kind: 'pillar' });

      if (isArenaOrBowling || isMallOrRetail || floorCount >= 4) {
        obstacles.push({ x: midX - 66, y: 215, w: 132, h: 64, kind: 'pool_table' });
        activities.push({
          id: `${id}_pool_top`,
          floor: fl,
          kind: 'pool_8ball',
          label: `🎱 ${fl}F Sky Lounge Billiards`,
          x: midX,
          y: 310,
          radius: 32,
        });
      } else {
        activities.push({
          id: `${id}_rest_top`,
          floor: fl,
          kind: 'rest',
          label: `🛋️ ${fl}F Observation Lounge`,
          x: worldW - 215,
          y: 292,
          radius: 28,
        });
      }
      npcs.push({
        id: `${id}_top_host_${fl}`,
        floor: fl,
        name: floorCount >= 8 ? 'Skyline Docent Harper' : 'Penthouse Host Morgan',
        roleLabel: `${fl}F Summit`,
        x: midX,
        y: Math.min(worldH - 185, 430),
        facing: -Math.PI / 2,
        shirtColor: '#f59e0b',
        hairColor: '#0f172a',
        dialogue: `You made it all the way to Floor ${fl} of ${name}! Enjoy the panoramic skyline view or take the elevator to any floor.`,
      });
    } else {
      const variant = (seed + fl * 7) % floorMiniGameRotation.length;
      const spec = floorMiniGameRotation[variant];
      floorSubtitle = spec.themeName;

      // Alternate room furniture geometries per floor so neighboring levels feel genuinely unique
      const layoutStyle = (seed + fl) % 3;
      if (layoutStyle === 0) {
        obstacles.push({ x: 135, y: 205, w: 138, h: 44, kind: 'desk' });
        obstacles.push({ x: worldW - 273, y: 205, w: 138, h: 44, kind: 'desk' });
        obstacles.push({ x: midX - 70, y: Math.min(worldH - 215, 385), w: 140, h: 42, kind: 'table' });
      } else if (layoutStyle === 1) {
        obstacles.push({ x: 185, y: 270, w: 170, h: 22, kind: 'interior_wall' });
        obstacles.push({ x: worldW - 355, y: 270, w: 170, h: 22, kind: 'interior_wall' });
        obstacles.push({ x: 135, y: Math.min(worldH - 220, 380), w: 120, h: 42, kind: 'sofa' });
        obstacles.push({ x: worldW - 255, y: Math.min(worldH - 220, 380), w: 120, h: 42, kind: 'sofa' });
      } else {
        obstacles.push({ x: 230, y: 220, w: 38, h: 38, kind: 'pillar' });
        obstacles.push({ x: worldW - 268, y: 220, w: 38, h: 38, kind: 'pillar' });
        obstacles.push({ x: 130, y: Math.min(worldH - 220, 385), w: 132, h: 44, kind: 'counter' });
        obstacles.push({ x: worldW - 262, y: Math.min(worldH - 220, 385), w: 132, h: 44, kind: 'table' });
      }

      const propX = Math.round(midX - spec.propW * 0.5);
      const propY = 185;
      obstacles.push({ x: propX, y: propY, w: spec.propW, h: spec.propH, kind: spec.propKind });
      activities.push({
        id: `${id}_act_${fl}f`,
        floor: fl,
        kind: spec.actKind,
        label: spec.actLabel,
        x: midX,
        y: propY + spec.propH + 30,
        radius: 30,
      });

      if (isLab || isMallOrRetail || isSchool) {
        activities.push({
          id: `${id}_work_${fl}f`,
          floor: fl,
          kind: isLab ? 'work_lab' : isMallOrRetail ? 'work_retail' : 'work_office',
          label: isLab ? `🔬 ${fl}F Lab Bench Shift` : isMallOrRetail ? `🛒 ${fl}F Retail Desk Shift` : `💼 ${fl}F Staff Workstation`,
          x: 204,
          y: 280,
          radius: 28,
        });
      }

      const npcIdx = (seed + fl) % npcNames.length;
      npcs.push({
        id: `${id}_staff_${fl}f`,
        floor: fl,
        name: npcNames[npcIdx],
        roleLabel: `${fl}F Staff`,
        x: midX + (fl % 2 === 0 ? -155 : 155),
        y: Math.min(worldH - 190, midY + 40),
        facing: Math.PI / 2,
        shirtColor: npcShirts[(seed + fl) % npcShirts.length],
        hairColor: '#0f172a',
        dialogue: `Welcome to Floor ${fl} of ${floorCount} in ${name} (${spec.themeName}). Head up to ${floorCount}F for the top deck or ride the Main Elevator anytime!`,
      });
    }

    if (!isClinic && !isOffice) {
      rugs.push({ x: midX - 180, y: 120, w: 360, h: worldH - 250, color: '#1e293b', borderColor: accentColor });
    }

    const stairs: StairPortal[] = [];
    if (fl < floorCount) {
      stairs.push({
        x: 74,
        y: 50,
        w: 84,
        h: 68,
        targetFloor: fl + 1,
        exitX: 160,
        exitY: worldH - 110,
        dir: 'up',
        label: `${fl + 1}F UPPER HALL`,
      });
    }
    if (fl > 1) {
      stairs.push({
        x: worldW - 270,
        y: worldH - 120,
        w: 84,
        h: 68,
        targetFloor: fl - 1,
        exitX: 195,
        exitY: 115,
        dir: 'down',
        label: `${fl - 1}F LOWER HALL`,
      });
    }

    const elevators: ElevatorPortal[] =
      floorCount >= 2 ? [{ x: worldW - 148, y: 50, w: 86, h: 70, label: 'MAIN ELEVATOR' }] : [];

    floorsById[fl] = {
      floorId: fl,
      floorName: `${fl}F · ${floorSubtitle}`,
      playableZones: [{ x: padX, y: 24, w: playW, h: playH }],
      rugs,
      decors,
      obstacles,
      waypoints: [
        { x: midX, y: worldH - 105 },
        { x: 200, y: midY },
        { x: midX, y: midY },
        { x: worldW - 200, y: midY },
      ],
      stairs,
      elevators,
      npcs,
      activities,
    };
  }

  return {
    id,
    archetypeLabel: `${floorCount}-STORY ${venueBadge}${floorCount >= 2 ? ' · ELEVATOR' : ''}`,
    worldWidth: worldW,
    worldHeight: worldH,
    availableFloors: availFloors,
    floorsById,
    playerSpawn: { floor: 1, x: Math.round(worldW / 2), y: worldH - 74 },
    entryDoorRect: { x: Math.round(worldW / 2) - 64, y: worldH - 32, w: 128, h: 16 },
    vaults: [],
    botSpawns: [],
    policeBreachCount: 0,
    theme: {
      exteriorBg: '#090e1a',
      floorTileA: isClinic ? '#0f1f2e' : '#172033',
      floorTileB: isClinic ? '#142a3d' : '#1f2b44',
      tileSize: 34,
      vaultTileA: '#0f172a',
      vaultTileB: '#1e293b',
      wallFill: '#0f172a',
      wallStroke: accentColor,
      interiorWallFill: isClinic ? '#334155' : '#334155',
      interiorWallStroke: accentColor,
      counterWood: '#1e293b',
      counterTop: accentColor,
      accentColor,
      lootVisual: 'tech_gear',
      vaultLabel: 'PUBLIC BUILDING',
      tierBadge: `${floorCount}F · ${isClinic ? 'CLINIC' : isOffice ? 'OFFICE' : 'EXPLORABLE'}`,
    },
  };
}

function resolveHouseExteriorProfile(target: FloorplanTargetDescriptor): HouseExteriorProfile {
  if (target.exteriorProfile) return target.exteriorProfile;
  const h = hashString(target.id + target.name);
  const lid = target.id.toLowerCase();
  if (lid.includes('potomac_estate') || lid.includes('belair_mansion')) {
    return {
      wallColorHex: '#8b3a2b',
      roofColorHex: '#1e293b',
      style: 'luxury',
      stories: 2,
      hasGarage: true,
      hasPool: true,
      hasBasement: true,
    };
  }
  if (lid.includes('billionaire_compound')) {
    return {
      wallColorHex: '#7c4a26',
      roofColorHex: '#1c1917',
      style: 'lodge',
      stories: 2,
      hasGarage: true,
      hasPool: true,
      hasBasement: true,
    };
  }
  if (lid.includes('financial_penthouse')) {
    return {
      wallColorHex: '#bae6fd',
      roofColorHex: '#334155',
      style: 'coastal',
      stories: 2,
      hasGarage: true,
      hasPool: true,
      hasBasement: true,
    };
  }
  if (lid.includes('harbor_villa')) {
    return {
      wallColorHex: '#8b2e24',
      roofColorHex: '#1e293b',
      style: 'luxury',
      stories: 2,
      hasGarage: true,
      hasPool: true,
      hasBasement: true,
    };
  }
  if (lid.includes('kentlands_manor')) {
    return {
      wallColorHex: '#d97706',
      roofColorHex: '#451a03',
      style: 'colonial',
      stories: 2,
      hasGarage: true,
      hasPool: false,
      hasBasement: true,
    };
  }
  if (lid.includes('ellicott_manor')) {
    return {
      wallColorHex: '#78716c',
      roofColorHex: '#292524',
      style: 'colonial',
      stories: 2,
      hasGarage: true,
      hasPool: false,
      hasBasement: true,
    };
  }
  if (lid.includes('silver_spring_brownstone')) {
    return {
      wallColorHex: '#8b3a2b',
      roofColorHex: '#1e293b',
      style: 'townhouse',
      stories: 2,
      hasGarage: false,
      hasPool: false,
      hasBasement: true,
    };
  }
  if (lid.includes('oakwood_bungalow')) {
    return {
      wallColorHex: '#e2e8f0',
      roofColorHex: '#1e293b',
      style: 'colonial',
      stories: 2,
      hasGarage: true,
      hasPool: false,
      hasBasement: true,
    };
  }
  if (target.payoutCash < 9000) {
    return {
      wallColorHex: '#e2e8f0',
      roofColorHex: '#1e293b',
      style: 'starter',
      stories: 1,
      hasGarage: true,
      hasPool: false,
      hasBasement: false,
    };
  }
  if (target.payoutCash >= 26000) {
    return {
      wallColorHex: '#cbd5e1',
      roofColorHex: '#0f172a',
      style: 'luxury',
      stories: 2,
      hasGarage: true,
      hasPool: true,
      hasBasement: true,
    };
  }
  return {
    wallColorHex: '#cbd5e1',
    roofColorHex: '#292524',
    style: 'colonial',
    stories: 2,
    hasGarage: true,
    hasPool: false,
    hasBasement: h % 2 === 0,
  };
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  pad = 0
): boolean {
  return (
    ax - pad < bx + bw &&
    ax + aw + pad > bx &&
    ay - pad < by + bh &&
    ay + ah + pad > by
  );
}

function pointInsidePlayable(zones: FloorZoneRect[], px: number, py: number, margin = 16): boolean {
  return zones.some(
    (z) =>
      px >= z.x + margin &&
      px <= z.x + z.w - margin &&
      py >= z.y + margin &&
      py <= z.y + z.h - margin
  );
}

function rectInsidePlayable(
  zones: FloorZoneRect[],
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  margin = 14
): boolean {
  return zones.some(
    (z) =>
      rx >= z.x + margin &&
      rx + rw <= z.x + z.w - margin &&
      ry >= z.y + margin &&
      ry + rh <= z.y + z.h - margin
  );
}

function findPlacementOnFloor(
  floorData: HeistFloorData,
  plan: BuildingFloorplan,
  pw: number,
  ph: number
): { x: number; y: number; actX: number; actY: number } | null {
  const floorId = floorData.floorId;
  const floorVaults = plan.vaults.filter((v) => v.floor === floorId);

  const tryPlaceAt = (px: number, py: number): { x: number; y: number; actX: number; actY: number } | null => {
    if (!rectInsidePlayable(floorData.playableZones, px, py, pw, ph, 14)) return null;

    for (const obs of floorData.obstacles) {
      if (rectsOverlap(px, py, pw, ph, obs.x, obs.y, obs.w, obs.h, 20)) return null;
    }
    for (const st of floorData.stairs) {
      if (rectsOverlap(px, py, pw, ph, st.x, st.y, st.w, st.h, 24)) return null;
      if (rectsOverlap(px, py, pw, ph, st.exitX - 18, st.exitY - 18, 36, 36, 18)) return null;
    }
    for (const el of floorData.elevators ?? []) {
      if (rectsOverlap(px, py, pw, ph, el.x, el.y, el.w, el.h, 24)) return null;
    }
    for (const v of floorVaults) {
      if (rectsOverlap(px, py, pw, ph, v.doorRect.x, v.doorRect.y, v.doorRect.w, v.doorRect.h, 28)) return null;
      if (
        rectsOverlap(
          px,
          py,
          pw,
          ph,
          v.lootZone.x - v.lootZone.radius,
          v.lootZone.y - v.lootZone.radius,
          v.lootZone.radius * 2,
          v.lootZone.radius * 2,
          24
        )
      ) {
        return null;
      }
    }
    for (const dec of floorData.decors) {
      if (dec.kind === 'pool_water' && rectsOverlap(px, py, pw, ph, dec.x, dec.y, dec.w, dec.h, 24)) {
        return null;
      }
    }
    for (const npc of floorData.npcs) {
      if (rectsOverlap(px, py, pw, ph, npc.x - 16, npc.y - 16, 32, 32, 18)) return null;
    }
    if (floorId === plan.playerSpawn.floor) {
      if (rectsOverlap(px, py, pw, ph, plan.playerSpawn.x - 24, plan.playerSpawn.y - 24, 48, 48, 20)) {
        return null;
      }
      if (
        rectsOverlap(
          px,
          py,
          pw,
          ph,
          plan.entryDoorRect.x,
          plan.entryDoorRect.y - 28,
          plan.entryDoorRect.w,
          plan.entryDoorRect.h + 28,
          20
        )
      ) {
        return null;
      }
    }
    if (floorId === 1) {
      const ed = plan.entryDoorRect;
      if (rectsOverlap(px, py, pw, ph, ed.x - 18, ed.y - 44, ed.w + 36, 56, 16)) return null;
    }

    const actCandidates: [number, number][] = [
      [Math.round(px + pw * 0.5), Math.round(py + ph + 20)],
      [Math.round(px + pw * 0.5), Math.round(py - 20)],
      [Math.round(px + pw + 20), Math.round(py + ph * 0.5)],
      [Math.round(px - 20), Math.round(py + ph * 0.5)],
    ];

    for (const [ax, ay] of actCandidates) {
      if (!pointInsidePlayable(floorData.playableZones, ax, ay, 20)) continue;
      let actBlocked = false;
      for (const obs of floorData.obstacles) {
        if (rectsOverlap(ax - 12, ay - 12, 24, 24, obs.x, obs.y, obs.w, obs.h, 6)) {
          actBlocked = true;
          break;
        }
      }
      if (actBlocked) continue;
      for (const st of floorData.stairs) {
        if (rectsOverlap(ax - 14, ay - 14, 28, 28, st.x, st.y, st.w, st.h, 8)) {
          actBlocked = true;
          break;
        }
      }
      if (actBlocked) continue;
      for (const el of floorData.elevators ?? []) {
        if (rectsOverlap(ax - 14, ay - 14, 28, 28, el.x, el.y, el.w, el.h, 8)) {
          actBlocked = true;
          break;
        }
      }
      if (actBlocked) continue;
      for (const act of floorData.activities) {
        if (Math.hypot(act.x - ax, act.y - ay) < 42) {
          actBlocked = true;
          break;
        }
      }
      if (!actBlocked) {
        return { x: px, y: py, actX: ax, actY: ay };
      }
    }
    return null;
  };

  for (const z of floorData.playableZones) {
    for (let y = z.y + 20; y + ph <= z.y + z.h - 28; y += 22) {
      for (let x = z.x + 20; x + pw <= z.x + z.w - 20; x += 22) {
        const hit = tryPlaceAt(x, y);
        if (hit) return hit;
      }
    }
  }
  return null;
}

function applyHouseFurnishings(plan: BuildingFloorplan, furnishings?: string[]): BuildingFloorplan {
  if (!furnishings || furnishings.length === 0) return plan;

  const uniqueEntries = Array.from(new Set(furnishings));
  const seenItemIds = new Set<string>();
  // Prefer Basement (0) -> 2F (2) -> 1F (1) so lower/upper game rooms fill naturally first
  const floorOrder: HeistFloorId[] = ([0, 2, 1] as HeistFloorId[]).filter(
    (f) => plan.floorsById[f] !== undefined
  );

  let placedCount = 0;
  for (const rawEntry of uniqueEntries) {
    const [rawItemId, preferredSlotId] = rawEntry.split('@');
    if (seenItemIds.has(rawItemId)) continue;
    const item = getHomeFurnishingById(rawItemId);
    if (!item) continue;
    seenItemIds.add(rawItemId);

    let placed = false;
    if (preferredSlotId) {
      for (const fl of floorOrder) {
        const floorData = plan.floorsById[fl];
        if (!floorData || !floorData.emptySlots) continue;
        const slotIdx = floorData.emptySlots.findIndex((s) => s.id === preferredSlotId);
        if (slotIdx !== -1) {
          const slot = floorData.emptySlots[slotIdx];
          const px = Math.round(slot.x + (slot.w - item.propWidth) * 0.5);
          const py = Math.round(slot.y + (slot.h - item.propHeight) * 0.5);
          const actX = Math.round(px + item.propWidth * 0.5);
          const actY = Math.round(py + item.propHeight + 20);
          floorData.obstacles.push({
            x: px,
            y: py,
            w: item.propWidth,
            h: item.propHeight,
            kind: item.propKind,
          });
          floorData.activities.push({
            id: `furn_${item.id}`,
            floor: fl,
            kind: item.activityKind,
            label: item.activityLabel,
            x: actX,
            y: actY,
            radius: 26,
          });
          floorData.emptySlots.splice(slotIdx, 1);
          placedCount++;
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      // Fallback: place in first free slot on any available floor, or scan playable zones
      for (const fl of floorOrder) {
        const floorData = plan.floorsById[fl];
        if (!floorData) continue;
        const openSlot = floorData.emptySlots?.[0];
        if (openSlot) {
          const px = Math.round(openSlot.x + (openSlot.w - item.propWidth) * 0.5);
          const py = Math.round(openSlot.y + (openSlot.h - item.propHeight) * 0.5);
          floorData.obstacles.push({
            x: px,
            y: py,
            w: item.propWidth,
            h: item.propHeight,
            kind: item.propKind,
          });
          floorData.activities.push({
            id: `furn_${item.id}`,
            floor: fl,
            kind: item.activityKind,
            label: item.activityLabel,
            x: Math.round(px + item.propWidth * 0.5),
            y: Math.round(py + item.propHeight + 20),
            radius: 26,
          });
          floorData.emptySlots!.splice(0, 1);
          placedCount++;
          placed = true;
          break;
        }
        const spot = findPlacementOnFloor(floorData, plan, item.propWidth, item.propHeight);
        if (spot) {
          floorData.obstacles.push({
            x: spot.x,
            y: spot.y,
            w: item.propWidth,
            h: item.propHeight,
            kind: item.propKind,
          });
          floorData.activities.push({
            id: `furn_${item.id}`,
            floor: fl,
            kind: item.activityKind,
            label: item.activityLabel,
            x: spot.actX,
            y: spot.actY,
            radius: 26,
          });
          if (floorData.emptySlots) {
            floorData.emptySlots = floorData.emptySlots.filter(
              (s) => !rectsOverlap(spot.x, spot.y, item.propWidth, item.propHeight, s.x, s.y, s.w, s.h, 12)
            );
          }
          placedCount++;
          placed = true;
          break;
        }
      }
    }
  }

  if (placedCount > 0) {
    plan.theme.tierBadge = `${plan.theme.tierBadge} · ${placedCount} FURNISHED`;
  }
  return plan;
}

export function buildBuildingFloorplan(target: FloorplanTargetDescriptor): BuildingFloorplan {
  if (target.category === 'SERVICE' || target.id.startsWith('svc_')) {
    return buildServiceStationPlan(target.id, target.name);
  }
  if (target.category === 'POLICE' || target.id === 'police_precinct') {
    return buildPolicePrecinctPlan();
  }
  if (target.category === 'BUILDING') {
    return buildGenericCityBuildingPlan(
      target.id,
      target.name,
      target.buildingHeight ?? 14,
      target.buildingStories
    );
  }
  if (target.id === 'bank_central') return buildBankCentralPlan(target.payoutCash);
  if (target.id === 'bank_pacific_bullion') return buildBankPacificBullionPlan(target.payoutCash);
  if (target.id === 'bank_national_harbor') return buildBankNationalHarborPlan(target.payoutCash);
  if (target.id === 'bank_frederick_trust') return buildBankFrederickTrustPlan(target.payoutCash);

  if (target.id === 'jewelry_diamond_exchange') return buildJewelryDiamondExchangePlan(target.payoutCash);
  if (target.id === 'jewelry_columbia_mall') return buildJewelryColumbiaMallPlan(target.payoutCash);
  if (target.id === 'jewelry_vangelico') return buildJewelryVangelicoPlan(target.payoutCash);

  if (target.id === 'store_rio_electronics') return buildStoreRioElectronicsPlan(target.payoutCash);
  if (target.id === 'store_dave_and_busters') return buildStoreDaveAndBustersPlan(target.payoutCash);
  if (target.id === 'store_chuck_e_cheese') return buildStoreChuckECheesePlan(target.payoutCash);
  if (target.id === 'store_neon_mart') return buildStoreNeonMartPlan(target.payoutCash);
  if (target.id === 'store_hagerstown_pawn') {
    return buildStoreCompactPawnOrMarketPlan(target.id, target.payoutCash, true);
  }
  if (target.id === 'store_flower_hill_mart') {
    return buildStoreCompactPawnOrMarketPlan(target.id, target.payoutCash, false);
  }

  if (target.category === 'BANK') return buildBankCentralPlan(target.payoutCash);
  if (target.category === 'JEWELRY') return buildJewelryDiamondExchangePlan(target.payoutCash);
  if (target.category === 'STORE') return buildStoreRioElectronicsPlan(target.payoutCash);

  // Houses: strictly match exterior story counts (1-story -> [1]; 2-story -> [1,2] or [0,1,2]) + dynamic home furnishings
  const ext = resolveHouseExteriorProfile(target);
  let housePlan: BuildingFloorplan;
  if (ext.style === 'starter' || ext.stories === 1) {
    housePlan = buildStarterHousePlan(target.id, target.name, target.payoutCash, ext);
  } else if (ext.style === 'townhouse') {
    housePlan = buildTownhousePlan(target.id, target.name, target.payoutCash, ext);
  } else if (ext.style === 'luxury' || ext.style === 'lodge' || ext.style === 'coastal') {
    housePlan = buildLuxuryEstatePlan(target.id, target.name, target.payoutCash, ext);
  } else {
    housePlan = buildColonialOrSplitHousePlan(target.id, target.name, target.payoutCash, ext);
  }
  return applyHouseFurnishings(housePlan, target.furnishings);
}
