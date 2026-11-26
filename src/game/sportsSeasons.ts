export type SeasonSportKey = 'basketball' | 'football';

export type BballPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export const BBALL_POSITIONS: BballPosition[] = ['PG', 'SG', 'SF', 'PF', 'C'];

export interface BballPositionProfile {
  pos: BballPosition;
  title: string;
  archetype: string;
  jersey: string;
  advantages: string[];
  disadvantages: string[];
  shoot3: number;
  mid: number;
  drive: number;
  strength: number;
  speed: number;
  block: number;
  steal: number;
  rebound: number;
  sizeScale: number;
}

export const BBALL_POSITION_PROFILES: Record<BballPosition, BballPositionProfile> = {
  PG: {
    pos: 'PG',
    title: 'Point Guard',
    archetype: 'Sharpshooting Floor General',
    jersey: '1',
    advantages: [
      'Elite 3PT & mid-range green zone',
      'Fastest court speed & quicker dribble moves',
      'Higher steal & ankle-breaker rates',
    ],
    disadvantages: [
      'Lowest strength — easier to body-up in the lane',
      'Weakest rim-block reach & interior defense',
    ],
    shoot3: 90,
    mid: 88,
    drive: 72,
    strength: 48,
    speed: 94,
    block: 44,
    steal: 88,
    rebound: 50,
    sizeScale: 1.94,
  },
  SG: {
    pos: 'SG',
    title: 'Shooting Guard',
    archetype: '3-Level Perimeter Sniper',
    jersey: '23',
    advantages: [
      'Highest 3PT & contested jumper accuracy',
      'Quick lateral cuts & smooth scoring handles',
      'Great perimeter steal instincts',
    ],
    disadvantages: [
      'Light body-up resistance against forwards',
      'Below-average paint rebounding & rim blocks',
    ],
    shoot3: 93,
    mid: 91,
    drive: 78,
    strength: 58,
    speed: 88,
    block: 52,
    steal: 80,
    rebound: 58,
    sizeScale: 1.98,
  },
  SF: {
    pos: 'SF',
    title: 'Small Forward',
    archetype: 'Two-Way Slashing Wing',
    jersey: '7',
    advantages: [
      'Balanced shooting, driving & perimeter defense',
      'Strong enough to finish through guard contact',
      'Versatile help defender & solid rebounder',
    ],
    disadvantages: [
      'Slightly slower than PGs on perimeter isolation',
      'Less paint dominance than true PFs & Centers',
    ],
    shoot3: 81,
    mid: 83,
    drive: 85,
    strength: 76,
    speed: 84,
    block: 72,
    steal: 76,
    rebound: 74,
    sizeScale: 2.02,
  },
  PF: {
    pos: 'PF',
    title: 'Power Forward',
    archetype: 'Paint Enforcer & Rim Runner',
    jersey: '24',
    advantages: [
      'High strength — powers through drive body-ups',
      'Strong shot-blocking & rebound presence',
      'Extended dunk takeoff & paint finishing',
    ],
    disadvantages: [
      'Noticeably slower perimeter speed & handles',
      'Tighter 3PT green window from deep',
    ],
    shoot3: 66,
    mid: 75,
    drive: 88,
    strength: 89,
    speed: 74,
    block: 87,
    steal: 64,
    rebound: 89,
    sizeScale: 2.08,
  },
  C: {
    pos: 'C',
    title: 'Center',
    archetype: 'Rim Protector & Paint Beast',
    jersey: '34',
    advantages: [
      'Highest block rate & widest swat reach at the rim',
      'Bulldozer drive strength — shrugs off body-ups',
      'Dominant dunking & glass-crashing rebounds',
    ],
    disadvantages: [
      'Slowest sprint speed & sluggish dribble cooldowns',
      'Weakest 3PT shooter — tight deep green bar',
    ],
    shoot3: 52,
    mid: 67,
    drive: 92,
    strength: 96,
    speed: 65,
    block: 96,
    steal: 54,
    rebound: 96,
    sizeScale: 2.15,
  },
};

export type FbPosition = 'QB' | 'RB' | 'WR' | 'LB' | 'CB';

export const FB_POSITIONS: FbPosition[] = ['QB', 'RB', 'WR', 'LB', 'CB'];

export interface FbPositionProfile {
  pos: FbPosition;
  title: string;
  archetype: string;
  jersey: string;
  advantages: string[];
  disadvantages: string[];
  throwAcc: number;
  throwPow: number;
  catchStat: number;
  carry: number;
  speed: number;
  strength: number;
  tackle: number;
  coverage: number;
}

export const FB_POSITION_PROFILES: Record<FbPosition, FbPositionProfile> = {
  QB: {
    pos: 'QB',
    title: 'Quarterback',
    archetype: 'Precision Pocket & Dual-Threat General',
    jersey: '12',
    advantages: [
      'Widest pass green window & pinpoint deep accuracy',
      'Fastest spiral velocity to beat closing DBs',
      'Quick pocket scramble & spin-juke escape',
    ],
    disadvantages: [
      'Lowest tackle radius & hit power on defense',
      'Smaller pass-interception leap when usering MLB/DB',
    ],
    throwAcc: 94,
    throwPow: 92,
    catchStat: 64,
    carry: 72,
    speed: 79,
    strength: 62,
    tackle: 52,
    coverage: 54,
  },
  RB: {
    pos: 'RB',
    title: 'Running Back',
    archetype: 'Explosive Elusive Workhorse',
    jersey: '22',
    advantages: [
      'Highest trucking strength & spin-juke tackle breaking',
      'Blazing burst through sweep & checkdown lanes',
      'Reliable YAC ball security in heavy traffic',
    ],
    disadvantages: [
      'Tighter deep QB throw timing window',
      'Below-average pass coverage & ball-hawking on D',
    ],
    throwAcc: 64,
    throwPow: 68,
    catchStat: 82,
    carry: 95,
    speed: 92,
    strength: 89,
    tackle: 68,
    coverage: 60,
  },
  WR: {
    pos: 'WR',
    title: 'Wide Receiver',
    archetype: 'Deep Threat Route Specialist',
    jersey: '81',
    advantages: [
      'Fastest top-end sprint speed on routes & YAC',
      'Sticky hands — sharply cuts DB pass breakups & picks',
      'Great defensive catch radius for user interceptions',
    ],
    disadvantages: [
      'Lighter tackle power against bruising RBs',
      'Tighter QB throw timing meter under pressure',
    ],
    throwAcc: 60,
    throwPow: 64,
    catchStat: 96,
    carry: 88,
    speed: 96,
    strength: 66,
    tackle: 64,
    coverage: 82,
  },
  LB: {
    pos: 'LB',
    title: 'Linebacker',
    archetype: 'Hard-Hitting Defensive Captain',
    jersey: '52',
    advantages: [
      'Widest dive-tackle & sack radius on defense',
      'Crushing hit power — forces TFLs & 4th-down stops',
      'Strong sideline pursuit & solid underneath coverage',
    ],
    disadvantages: [
      'Lower offensive passing velocity & accuracy',
      'Slightly slower top sprint than elite WRs/CBs',
    ],
    throwAcc: 56,
    throwPow: 62,
    catchStat: 70,
    carry: 68,
    speed: 84,
    strength: 94,
    tackle: 96,
    coverage: 80,
  },
  CB: {
    pos: 'CB',
    title: 'Cornerback',
    archetype: 'Lockdown Ball-Hawk Defender',
    jersey: '21',
    advantages: [
      'Highest pass deflection & interception leap radius',
      'Elite defensive sprint speed to blanket deep routes',
      'Boosts WR separation & catch instincts too',
    ],
    disadvantages: [
      'Lighter strength — smaller hit radius vs power RBs',
      'Narrower QB deep throw window on offense',
    ],
    throwAcc: 54,
    throwPow: 60,
    catchStat: 84,
    carry: 74,
    speed: 95,
    strength: 68,
    tackle: 80,
    coverage: 96,
  },
};

export interface BballRosterPlayer {
  id: string;
  name: string;
  position: BballPosition;
  jersey: string;
  isUser?: boolean;
  archetype: string;
  ovr: number;
  potential?: number;
  shoot3: number;
  mid: number;
  drive: number;
  strength: number;
  speed: number;
  block: number;
  steal: number;
  rebound: number;
  gamesPlayed: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
}

export interface FbRosterPlayer {
  id: string;
  name: string;
  position: FbPosition;
  jersey: string;
  isUser?: boolean;
  archetype: string;
  ovr: number;
  potential?: number;
  throwAcc: number;
  throwPow: number;
  catchStat: number;
  carry: number;
  speed: number;
  strength: number;
  tackle: number;
  coverage: number;
  gamesPlayed: number;
  passYds: number;
  passTd: number;
  ints: number;
  rushYds: number;
  rushTd: number;
  rec: number;
  recYds: number;
  recTd: number;
  tackles: number;
  sacks: number;
  defInt: number;
}

export interface BballGamePlayerStatInput {
  position: BballPosition;
  team: 'player' | 'cpu';
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
}

export interface FbGamePlayerStatInput {
  position: FbPosition;
  team: 'player' | 'cpu';
  passYds: number;
  passTd: number;
  ints: number;
  rushYds: number;
  rushTd: number;
  rec: number;
  recYds: number;
  recTd: number;
  tackles: number;
  sacks: number;
  defInt: number;
}

export interface MyPlayerLastGain {
  grade: 'S+' | 'S' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
  xpEarned: number;
  ovrBefore: number;
  ovrAfter: number;
  pot: number;
  statUps: Array<{ label: string; delta: number; newVal: number }>;
  summary: string;
}

export interface MyPlayerProgression {
  sport: SeasonSportKey;
  position: string;
  ovr: number;
  potential: number;
  xp: number;
  gamesPlayed: number;
  stats: Record<string, number>;
  startStats: Record<string, number>;
  caps: Record<string, number>;
  lastGain?: MyPlayerLastGain;
}

export interface LeagueTeam {
  id: string;
  name: string;
  short: string;
  rating: number;
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
  streak: number; // +N win streak, -N loss streak
  roster?: BballRosterPlayer[];
  fbRoster?: FbRosterPlayer[];
}

export interface SeasonScheduleMatch {
  week: number;
  homeId: string;
  awayId: string;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
}

export interface PlayoffSeriesMatch {
  id: string;
  roundIdx: number; // 0-indexed playoff round
  roundLabel: string;
  topSeed: number;
  botSeed: number;
  topTeamId: string;
  botTeamId: string;
  topTeamName: string;
  botTeamName: string;
  played: boolean;
  topScore?: number;
  botScore?: number;
  winnerId?: string;
}

export interface SportsPlayoffBracket {
  rounds: PlayoffSeriesMatch[][]; // e.g. 4 rounds for 16-team bball (R16, QF, SF, F), 2 rounds for 4-team football
  // Legacy aliases kept optional for backwards compatibility
  sf1?: PlayoffSeriesMatch;
  sf2?: PlayoffSeriesMatch;
  final?: PlayoffSeriesMatch | null;
}

export interface SportsSeasonState {
  sport: SeasonSportKey;
  seasonNumber: number;
  phase: 'regular' | 'playoffs' | 'champion' | 'eliminated' | 'missed_playoffs';
  currentWeek: number;
  totalWeeks: number;
  playoffTeamsCount: number;
  playerPosition?: BballPosition;
  fbPlayerPosition?: FbPosition;
  positionLocked?: boolean;
  myPlayer?: MyPlayerProgression;
  teams: LeagueTeam[];
  schedule: SeasonScheduleMatch[];
  seedOrder: string[];
  playoffBracket: SportsPlayoffBracket | null;
  championTeamId?: string;
  championshipsWon: number;
  lastUpdatedAt: number;
}

export interface SportsSeasonsStore {
  basketball: SportsSeasonState;
  football: SportsSeasonState;
}

export const SPORTS_SEASONS_STORAGE_KEY = 'apex26_sports_seasons_v2';

const BASKETBALL_TEAMS_TEMPLATE: Omit<LeagueTeam, 'wins' | 'losses' | 'ties' | 'pf' | 'pa' | 'streak'>[] = [
  { id: 'player', name: 'YOU (GAITHERSBURG)', short: 'YOU', rating: 84 },
  { id: 'baltimore', name: 'BALTIMORE KINGS', short: 'BAL', rating: 93 },
  { id: 'washington', name: 'WASHINGTON MONARCHS', short: 'WAS', rating: 92 },
  { id: 'philly', name: 'PHILLY PHANTOMS', short: 'PHI', rating: 90 },
  { id: 'new_york', name: 'NEW YORK METRO', short: 'NYM', rating: 89 },
  { id: 'silver_spring', name: 'SILVER SPRING SUNS', short: 'SSS', rating: 88 },
  { id: 'boston', name: 'BOSTON HARBOR', short: 'BOS', rating: 87 },
  { id: 'miami', name: 'MIAMI HEATWAVE', short: 'MIA', rating: 86 },
  { id: 'terps', name: 'COLLEGE PARK TERPS', short: 'UMD', rating: 85 },
  { id: 'bethesda', name: 'BETHESDA BLITZ', short: 'BTH', rating: 85 },
  { id: 'atlanta', name: 'ATLANTA HAWKFIRE', short: 'ATL', rating: 84 },
  { id: 'brooklyn', name: 'BROOKLYN BRIDGES', short: 'BKN', rating: 83 },
  { id: 'toronto', name: 'TORONTO NORTH', short: 'TOR', rating: 82 },
  { id: 'richmond', name: 'RICHMOND ROYALS', short: 'RIC', rating: 81 },
  { id: 'annapolis', name: 'ANNAPOLIS ANCHORS', short: 'ANN', rating: 80 },
  { id: 'charlotte', name: 'CHARLOTTE STING', short: 'CHA', rating: 80 },
  { id: 'pittsburgh', name: 'PITTSBURGH FORGE', short: 'PIT', rating: 79 },
  { id: 'rockville', name: 'ROCKVILLE ROCKETS', short: 'RCK', rating: 78 },
  { id: 'arlington', name: 'ARLINGTON ACES', short: 'ARL', rating: 78 },
  { id: 'norfolk', name: 'NORFOLK NAVIGATORS', short: 'NOR', rating: 77 },
  { id: 'columbia', name: 'COLUMBIA COMETS', short: 'COL', rating: 76 },
  { id: 'frederick', name: 'FREDERICK FALCONS', short: 'FRD', rating: 76 },
  { id: 'towson', name: 'TOWSON TIGERS', short: 'TOW', rating: 75 },
  { id: 'potomac', name: 'POTOMAC PANTHERS', short: 'POT', rating: 74 },
  { id: 'germantown', name: 'GERMANTOWN GRIZZLIES', short: 'GRM', rating: 73 },
  { id: 'bowie', name: 'BOWIE BULLDOGS', short: 'BOW', rating: 73 },
  { id: 'olney', name: 'OLNEY OWLS', short: 'OLN', rating: 72 },
  { id: 'waldorf', name: 'WALDORF WOLVES', short: 'WAL', rating: 71 },
  { id: 'hagerstown', name: 'HAGERSTOWN HAWKS', short: 'HAG', rating: 70 },
  { id: 'delaware', name: 'DELAWARE BLUE HENS', short: 'DEL', rating: 69 },
];

const FOOTBALL_TEAMS_TEMPLATE: Omit<LeagueTeam, 'wins' | 'losses' | 'ties' | 'pf' | 'pa' | 'streak'>[] = [
  { id: 'player', name: 'YOU (GAITHERSBURG)', short: 'YOU', rating: 81 },
  { id: 'ravens', name: 'BALTIMORE RAVENS', short: 'BAL', rating: 93 },
  { id: 'philly_fb', name: 'PHILLY EAGLES', short: 'PHI', rating: 92 },
  { id: 'kc_fb', name: 'KANSAS CITY CHIEFS', short: 'KC', rating: 91 },
  { id: 'buffalo_fb', name: 'BUFFALO BILLS', short: 'BUF', rating: 90 },
  { id: 'detroit_fb', name: 'DETROIT LIONS', short: 'DET', rating: 89 },
  { id: 'sf_fb', name: 'BAY AREA GOLD', short: 'SF', rating: 88 },
  { id: 'dc_fb', name: 'WASHINGTON COMMANDERS', short: 'WAS', rating: 87 },
  { id: 'terps_fb', name: 'COLLEGE PARK TERPS', short: 'UMD', rating: 86 },
  { id: 'cincy_fb', name: 'CINCINNATI TIGERS', short: 'CIN', rating: 85 },
  { id: 'greenbay_fb', name: 'GREEN BAY NORTH', short: 'GB', rating: 85 },
  { id: 'minn_fb', name: 'MINNESOTA NORSE', short: 'MIN', rating: 84 },
  { id: 'panthers', name: 'POTOMAC PANTHERS', short: 'POT', rating: 83 },
  { id: 'pitt_fb', name: 'PITTSBURGH STEEL', short: 'PIT', rating: 83 },
  { id: 'midshipmen', name: 'ANNAPOLIS MIDSHIPMEN', short: 'NAVY', rating: 82 },
  { id: 'dallas_fb', name: 'DALLAS STARS', short: 'DAL', rating: 81 },
  { id: 'houston_fb', name: 'HOUSTON BULLS', short: 'HOU', rating: 80 },
  { id: 'stallions', name: 'SILVER SPRING STALLIONS', short: 'SSS', rating: 80 },
  { id: 'miami_fb', name: 'MIAMI SHARKS', short: 'MIA', rating: 79 },
  { id: 'seattle_fb', name: 'SEATTLE OSPREYS', short: 'SEA', rating: 78 },
  { id: 'grizzlies', name: 'GAITHERSBURG GRIZZLIES', short: 'GRZ', rating: 78 },
  { id: 'denver_fb', name: 'DENVER MUSTANGS', short: 'DEN', rating: 77 },
  { id: 'tampa_fb', name: 'TAMPA CORSAIRS', short: 'TB', rating: 76 },
  { id: 'bulldogs', name: 'BETHESDA BULLDOGS', short: 'BTH', rating: 76 },
  { id: 'atlanta_fb', name: 'ATLANTA FALCONS', short: 'ATL', rating: 75 },
  { id: 'arizona_fb', name: 'ARIZONA REDBIRDS', short: 'ARI', rating: 74 },
  { id: 'chicago_fb', name: 'CHICAGO GRIZZLIES', short: 'CHI', rating: 73 },
  { id: 'ny_fb', name: 'NEW YORK TITANS', short: 'NYT', rating: 72 },
  { id: 'vegas_fb', name: 'VEGAS OUTLAWS', short: 'LV', rating: 71 },
  { id: 'delaware_fb', name: 'DELAWARE BLUE HENS', short: 'DEL', rating: 69 },
];

const FIRST_NAMES = [
  'Marcus', 'Jalen', 'Devon', 'Trey', 'Malik', 'Caleb', 'Darius', 'Isaiah', 'Noah', 'Zion',
  'Tyrese', 'Bryce', 'Kobe', 'Cole', 'Jordan', 'Amari', 'Andre', 'Xavier', 'Cam', 'Kevon',
  'Luka', 'Tariq', 'Jaylen', 'Devin', 'Mason', 'Kendrick', 'Roman', 'Eli', 'Miles', 'Kyrie',
];
const LAST_NAMES = [
  'Carter', 'Brooks', 'Hayes', 'Mitchell', 'Grant', 'Simmons', 'Bennett', 'Price', 'Foster', 'Reed',
  'Wallace', 'Porter', 'Monroe', 'Bryant', 'Dixon', 'Mercer', 'Cole', 'Vance', 'Ellis', 'Harper',
  'Howard', 'Barnes', 'Ford', 'Wright', 'Griffin', 'Knight', 'Cooper', 'Scott', 'Taylor', 'Powell',
];

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function clampStat(v: number, lo = 40, hi = 99): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

const ARCHETYPES_BY_POS: Record<
  BballPosition,
  Array<{ label: string; dShoot3: number; dMid: number; dDrive: number; dStr: number; dSpd: number; dBlk: number; dStl: number; dReb: number }>
> = {
  PG: [
    { label: 'Sharpshooter', dShoot3: 7, dMid: 4, dDrive: -2, dStr: -3, dSpd: 2, dBlk: -4, dStl: 2, dReb: -2 },
    { label: 'Playmaker', dShoot3: 2, dMid: 4, dDrive: 4, dStr: 0, dSpd: 5, dBlk: -2, dStl: 4, dReb: 0 },
    { label: 'Shot Creator', dShoot3: 4, dMid: 7, dDrive: 3, dStr: 1, dSpd: 3, dBlk: -2, dStl: 1, dReb: 0 },
  ],
  SG: [
    { label: '3 & D Wing', dShoot3: 6, dMid: 2, dDrive: 0, dStr: 2, dSpd: 2, dBlk: 2, dStl: 5, dReb: 1 },
    { label: 'Slasher', dShoot3: -4, dMid: 2, dDrive: 8, dStr: 4, dSpd: 4, dBlk: 2, dStl: 3, dReb: 2 },
    { label: 'Scoring Guard', dShoot3: 4, dMid: 6, dDrive: 3, dStr: 0, dSpd: 2, dBlk: 0, dStl: 1, dReb: 0 },
  ],
  SF: [
    { label: 'Two-Way Wing', dShoot3: 3, dMid: 2, dDrive: 3, dStr: 3, dSpd: 2, dBlk: 4, dStl: 5, dReb: 3 },
    { label: 'Point Forward', dShoot3: 2, dMid: 4, dDrive: 5, dStr: 2, dSpd: 3, dBlk: 1, dStl: 3, dReb: 3 },
    { label: 'Sharpshooting Wing', dShoot3: 7, dMid: 4, dDrive: -2, dStr: -2, dSpd: 1, dBlk: 0, dStl: 2, dReb: 1 },
  ],
  PF: [
    { label: 'Stretch Four', dShoot3: 8, dMid: 4, dDrive: -2, dStr: -2, dSpd: 2, dBlk: 0, dStl: 1, dReb: 2 },
    { label: 'Rim Runner', dShoot3: -6, dMid: -2, dDrive: 6, dStr: 6, dSpd: 3, dBlk: 5, dStl: 1, dReb: 5 },
    { label: 'Lockdown Four', dShoot3: 1, dMid: 1, dDrive: 1, dStr: 5, dSpd: 2, dBlk: 6, dStl: 4, dReb: 5 },
  ],
  C: [
    { label: 'Rim Protector', dShoot3: -6, dMid: -3, dDrive: 3, dStr: 5, dSpd: -2, dBlk: 8, dStl: 0, dReb: 6 },
    { label: 'Paint Beast', dShoot3: -7, dMid: -2, dDrive: 6, dStr: 7, dSpd: -1, dBlk: 4, dStl: 0, dReb: 7 },
    { label: 'Stretch Five', dShoot3: 9, dMid: 5, dDrive: -3, dStr: -2, dSpd: 1, dBlk: 1, dStl: 1, dReb: 2 },
  ],
};

const FB_ARCHETYPES_BY_POS: Record<
  FbPosition,
  Array<{ label: string; dAcc: number; dPow: number; dCatch: number; dCarry: number; dSpd: number; dStr: number; dTkl: number; dCov: number }>
> = {
  QB: [
    { label: 'Gunslinger', dAcc: 2, dPow: 6, dCatch: 0, dCarry: -2, dSpd: -2, dStr: 2, dTkl: 0, dCov: 0 },
    { label: 'Dual-Threat', dAcc: -2, dPow: 2, dCatch: 2, dCarry: 7, dSpd: 9, dStr: 3, dTkl: 1, dCov: 0 },
    { label: 'Field General', dAcc: 5, dPow: 1, dCatch: 0, dCarry: 0, dSpd: 0, dStr: 0, dTkl: 0, dCov: 0 },
  ],
  RB: [
    { label: 'Elusive Back', dAcc: 0, dPow: 0, dCatch: 5, dCarry: 4, dSpd: 6, dStr: -5, dTkl: 0, dCov: 2 },
    { label: 'Power Back', dAcc: 0, dPow: 0, dCatch: -4, dCarry: 3, dSpd: -3, dStr: 9, dTkl: 4, dCov: 0 },
    { label: 'All-Purpose', dAcc: 2, dPow: 0, dCatch: 7, dCarry: 3, dSpd: 3, dStr: 1, dTkl: 2, dCov: 1 },
  ],
  WR: [
    { label: 'Deep Threat', dAcc: 0, dPow: 0, dCatch: 1, dCarry: 3, dSpd: 3, dStr: -3, dTkl: 0, dCov: 2 },
    { label: 'Route Tech', dAcc: 0, dPow: 0, dCatch: 3, dCarry: 6, dSpd: 0, dStr: 0, dTkl: 1, dCov: 3 },
    { label: 'Physical WR', dAcc: 0, dPow: 0, dCatch: 2, dCarry: 2, dSpd: -2, dStr: 10, dTkl: 4, dCov: 2 },
  ],
  LB: [
    { label: 'Run Stuffer', dAcc: 0, dPow: 0, dCatch: -4, dCarry: 0, dSpd: -3, dStr: 5, dTkl: 3, dCov: -4 },
    { label: 'Coverage LB', dAcc: 0, dPow: 0, dCatch: 4, dCarry: 2, dSpd: 5, dStr: -3, dTkl: 1, dCov: 9 },
    { label: 'Blitz Hawk', dAcc: 0, dPow: 0, dCatch: 0, dCarry: 2, dSpd: 4, dStr: 4, dTkl: 3, dCov: 2 },
  ],
  CB: [
    { label: 'Ball Hawk', dAcc: 0, dPow: 0, dCatch: 7, dCarry: 3, dSpd: 2, dStr: -2, dTkl: -2, dCov: 3 },
    { label: 'Lockdown CB', dAcc: 0, dPow: 0, dCatch: 2, dCarry: 0, dSpd: 3, dStr: 2, dTkl: 4, dCov: 3 },
    { label: 'Slot Nickel', dAcc: 0, dPow: 0, dCatch: 4, dCarry: 4, dSpd: 1, dStr: 5, dTkl: 8, dCov: 1 },
  ],
};

const BBALL_STAT_LABELS: Record<string, string> = {
  shoot3: '3PT',
  mid: 'MID',
  drive: 'DRV',
  strength: 'STR',
  speed: 'SPD',
  block: 'BLK',
  steal: 'STL',
  rebound: 'REB',
};

const FB_STAT_LABELS: Record<string, string> = {
  throwAcc: 'ACC',
  throwPow: 'POW',
  catchStat: 'CTH',
  carry: 'ELU',
  speed: 'SPD',
  strength: 'STR',
  tackle: 'TKL',
  coverage: 'COV',
};

const BBALL_START_OVR = 66;
const FB_START_OVR = 66;

export function createStartingMyPlayer(
  sport: SeasonSportKey,
  posInput?: BballPosition | FbPosition
): MyPlayerProgression {
  if (sport === 'basketball') {
    const pos: BballPosition = BBALL_POSITIONS.includes(posInput as BballPosition)
      ? (posInput as BballPosition)
      : 'PG';
    const prof = BBALL_POSITION_PROFILES[pos];
    const caps: Record<string, number> = {
      shoot3: clampStat(prof.shoot3 + (prof.shoot3 >= 85 ? 4 : 2), 48, 99),
      mid: clampStat(prof.mid + (prof.mid >= 85 ? 4 : 2), 54, 99),
      drive: clampStat(prof.drive + (prof.drive >= 85 ? 4 : 2), 54, 99),
      strength: clampStat(prof.strength + (prof.strength >= 85 ? 3 : 2), 44, 99),
      speed: clampStat(prof.speed + (prof.speed >= 85 ? 4 : 2), 54, 99),
      block: clampStat(prof.block + (prof.block >= 85 ? 3 : 2), 42, 99),
      steal: clampStat(prof.steal + (prof.steal >= 85 ? 4 : 2), 46, 99),
      rebound: clampStat(prof.rebound + (prof.rebound >= 85 ? 3 : 2), 46, 99),
    };
    const startStats: Record<string, number> = {};
    for (const k of Object.keys(caps)) {
      startStats[k] = clampStat(caps[k] * 0.72 + 4, 42, 76);
    }
    const avgCap = Object.values(caps).reduce((s, v) => s + v, 0) / 8;
    const potential = clampStat(avgCap + 17, 92, 96);
    return {
      sport: 'basketball',
      position: pos,
      ovr: BBALL_START_OVR,
      potential,
      xp: 0,
      gamesPlayed: 0,
      stats: { ...startStats },
      startStats,
      caps,
    };
  }

  const pos: FbPosition = FB_POSITIONS.includes(posInput as FbPosition)
    ? (posInput as FbPosition)
    : 'QB';
  const prof = FB_POSITION_PROFILES[pos];
  const caps: Record<string, number> = {
    throwAcc: clampStat(prof.throwAcc + (prof.throwAcc >= 85 ? 4 : 2), 48, 99),
    throwPow: clampStat(prof.throwPow + (prof.throwPow >= 85 ? 4 : 2), 48, 99),
    catchStat: clampStat(prof.catchStat + (prof.catchStat >= 85 ? 3 : 2), 48, 99),
    carry: clampStat(prof.carry + (prof.carry >= 85 ? 4 : 2), 48, 99),
    speed: clampStat(prof.speed + (prof.speed >= 85 ? 3 : 2), 54, 99),
    strength: clampStat(prof.strength + (prof.strength >= 85 ? 4 : 2), 46, 99),
    tackle: clampStat(prof.tackle + (prof.tackle >= 85 ? 3 : 2), 44, 99),
    coverage: clampStat(prof.coverage + (prof.coverage >= 85 ? 3 : 2), 46, 99),
  };
  const startStats: Record<string, number> = {};
  for (const k of Object.keys(caps)) {
    startStats[k] = clampStat(caps[k] * 0.72 + 4, 42, 76);
  }
  const avgCap = Object.values(caps).reduce((s, v) => s + v, 0) / 8;
  const potential = clampStat(avgCap + 16, 92, 96);
  return {
    sport: 'football',
    position: pos,
    ovr: FB_START_OVR,
    potential,
    xp: 0,
    gamesPlayed: 0,
    stats: { ...startStats },
    startStats,
    caps,
  };
}

function recomputeMyPlayerOvr(mp: MyPlayerProgression): number {
  const startOvr = mp.sport === 'basketball' ? BBALL_START_OVR : FB_START_OVR;
  let gained = 0;
  let maxGain = 0;
  for (const k of Object.keys(mp.caps)) {
    const s0 = mp.startStats[k] ?? 50;
    const cap = mp.caps[k] ?? 90;
    const cur = mp.stats[k] ?? s0;
    gained += Math.max(0, cur - s0);
    maxGain += Math.max(1, cap - s0);
  }
  const progress = maxGain > 0 ? Math.min(1, gained / maxGain) : 1;
  return clampStat(startOvr + progress * (mp.potential - startOvr), startOvr, mp.potential);
}

export function generateTeamRoster(
  teamId: string,
  teamRating: number,
  userPos?: BballPosition,
  myPlayer?: MyPlayerProgression
): BballRosterPlayer[] {
  const baseH = hashSeed(teamId);
  const delta = teamRating - 82; // roughly -13 to +11

  return BBALL_POSITIONS.map((pos, idx) => {
    const prof = BBALL_POSITION_PROFILES[pos];
    const h = hashSeed(`${teamId}_${pos}`);
    const isUserSlot = teamId === 'player' && userPos === pos;

    if (isUserSlot) {
      const mp =
        myPlayer && myPlayer.sport === 'basketball' && myPlayer.position === pos
          ? myPlayer
          : createStartingMyPlayer('basketball', pos);
      return {
        id: `${teamId}_${pos}`,
        name: 'YOU (MY PLAYER)',
        position: pos,
        jersey: prof.jersey,
        isUser: true,
        archetype: prof.archetype,
        ovr: mp.ovr,
        potential: mp.potential,
        shoot3: mp.stats.shoot3 ?? 66,
        mid: mp.stats.mid ?? 66,
        drive: mp.stats.drive ?? 66,
        strength: mp.stats.strength ?? 56,
        speed: mp.stats.speed ?? 68,
        block: mp.stats.block ?? 56,
        steal: mp.stats.steal ?? 60,
        rebound: mp.stats.rebound ?? 58,
        gamesPlayed: 0,
        pts: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        fgm: 0,
        fga: 0,
        tpm: 0,
        tpa: 0,
      };
    }

    const archList = ARCHETYPES_BY_POS[pos];
    const arch = archList[(h >> 2) % archList.length];
    // Star variance within a team so every team has a standout shooter or inside star!
    const starRoll = ((baseH + idx * 7) % 5) === 0 ? 5 : ((h % 7) - 3);
    const tierShift = delta * 0.78 + starRoll;

    const shoot3 = clampStat(prof.shoot3 + tierShift + arch.dShoot3, 44, 98);
    const mid = clampStat(prof.mid + tierShift + arch.dMid, 52, 98);
    const drive = clampStat(prof.drive + tierShift + arch.dDrive, 55, 98);
    const strength = clampStat(prof.strength + tierShift * 0.65 + arch.dStr, 42, 98);
    const speed = clampStat(prof.speed + tierShift * 0.55 + arch.dSpd, 56, 98);
    const block = clampStat(prof.block + tierShift * 0.75 + arch.dBlk, 38, 99);
    const steal = clampStat(prof.steal + tierShift * 0.6 + arch.dStl, 45, 96);
    const rebound = clampStat(prof.rebound + tierShift * 0.65 + arch.dReb, 44, 99);
    const ovr = clampStat(teamRating + starRoll * 0.65 + (idx === 0 || idx === 1 ? 1 : 0), 65, 97);

    const first = FIRST_NAMES[(h + idx * 3) % FIRST_NAMES.length];
    const last = LAST_NAMES[((h >> 4) + idx * 5) % LAST_NAMES.length];
    const jerseyNums = ['0', '1', '2', '3', '4', '5', '7', '8', '10', '11', '12', '13', '15', '21', '23', '24', '30', '32', '34', '44', '55'];

    return {
      id: `${teamId}_${pos}`,
      name: `${first} ${last}`,
      position: pos,
      jersey: jerseyNums[(h + idx) % jerseyNums.length],
      archetype: arch.label,
      ovr,
      shoot3,
      mid,
      drive,
      strength,
      speed,
      block,
      steal,
      rebound,
      gamesPlayed: 0,
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      fgm: 0,
      fga: 0,
      tpm: 0,
      tpa: 0,
    };
  });
}

export function generateFootballRoster(
  teamId: string,
  teamRating: number,
  userPos?: FbPosition,
  myPlayer?: MyPlayerProgression
): FbRosterPlayer[] {
  const baseH = hashSeed(`fb_${teamId}`);
  const delta = teamRating - 82;

  return FB_POSITIONS.map((pos, idx) => {
    const prof = FB_POSITION_PROFILES[pos];
    const h = hashSeed(`fb_${teamId}_${pos}`);
    const isUserSlot = teamId === 'player' && userPos === pos;

    if (isUserSlot) {
      const mp =
        myPlayer && myPlayer.sport === 'football' && myPlayer.position === pos
          ? myPlayer
          : createStartingMyPlayer('football', pos);
      return {
        id: `${teamId}_${pos}`,
        name: 'YOU (MY PLAYER)',
        position: pos,
        jersey: prof.jersey,
        isUser: true,
        archetype: prof.archetype,
        ovr: mp.ovr,
        potential: mp.potential,
        throwAcc: mp.stats.throwAcc ?? 64,
        throwPow: mp.stats.throwPow ?? 64,
        catchStat: mp.stats.catchStat ?? 64,
        carry: mp.stats.carry ?? 64,
        speed: mp.stats.speed ?? 66,
        strength: mp.stats.strength ?? 62,
        tackle: mp.stats.tackle ?? 60,
        coverage: mp.stats.coverage ?? 60,
        gamesPlayed: 0,
        passYds: 0,
        passTd: 0,
        ints: 0,
        rushYds: 0,
        rushTd: 0,
        rec: 0,
        recYds: 0,
        recTd: 0,
        tackles: 0,
        sacks: 0,
        defInt: 0,
      };
    }

    const archList = FB_ARCHETYPES_BY_POS[pos];
    const arch = archList[(h >> 2) % archList.length];
    const starRoll = ((baseH + idx * 7) % 5) === 0 ? 5 : ((h % 7) - 3);
    const tierShift = delta * 0.78 + starRoll;

    const throwAcc = clampStat(prof.throwAcc + tierShift * 0.7 + arch.dAcc, 45, 98);
    const throwPow = clampStat(prof.throwPow + tierShift * 0.7 + arch.dPow, 45, 98);
    const catchStat = clampStat(prof.catchStat + tierShift * 0.65 + arch.dCatch, 48, 98);
    const carry = clampStat(prof.carry + tierShift * 0.65 + arch.dCarry, 48, 98);
    const speed = clampStat(prof.speed + tierShift * 0.55 + arch.dSpd, 56, 98);
    const strength = clampStat(prof.strength + tierShift * 0.65 + arch.dStr, 44, 98);
    const tackle = clampStat(prof.tackle + tierShift * 0.7 + arch.dTkl, 42, 98);
    const coverage = clampStat(prof.coverage + tierShift * 0.7 + arch.dCov, 45, 98);
    const ovr = clampStat(teamRating + starRoll * 0.65 + (idx === 0 || idx === 2 ? 1 : 0), 65, 97);

    const first = FIRST_NAMES[(h + idx * 5) % FIRST_NAMES.length];
    const last = LAST_NAMES[((h >> 3) + idx * 7) % LAST_NAMES.length];
    const fbJerseys: Record<FbPosition, string[]> = {
      QB: ['1', '4', '7', '8', '9', '10', '11', '12', '15', '17'],
      RB: ['20', '22', '23', '24', '25', '28', '30', '32', '33'],
      WR: ['1', '3', '5', '11', '13', '14', '18', '80', '81', '84', '88'],
      LB: ['44', '50', '52', '54', '55', '58', '90', '97'],
      CB: ['0', '2', '6', '20', '21', '24', '27', '29', '31'],
    };
    const pool = fbJerseys[pos];

    return {
      id: `${teamId}_${pos}`,
      name: `${first} ${last}`,
      position: pos,
      jersey: pool[(h + idx) % pool.length],
      archetype: arch.label,
      ovr,
      throwAcc,
      throwPow,
      catchStat,
      carry,
      speed,
      strength,
      tackle,
      coverage,
      gamesPlayed: 0,
      passYds: 0,
      passTd: 0,
      ints: 0,
      rushYds: 0,
      rushTd: 0,
      rec: 0,
      recYds: 0,
      recTd: 0,
      tackles: 0,
      sacks: 0,
      defInt: 0,
    };
  });
}

function buildSchedule(teamIds: string[], totalWeeks: number): SeasonScheduleMatch[] {
  const ids = [...teamIds];
  const n = ids.length;
  const fixed = ids[0];
  let rotating = ids.slice(1);
  const schedule: SeasonScheduleMatch[] = [];

  for (let week = 1; week <= Math.min(totalWeeks, n - 1); week++) {
    const roundOrder = [fixed, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const a = roundOrder[i];
      const b = roundOrder[n - 1 - i];
      const flip = (week + i) % 2 === 1;
      schedule.push({
        week,
        homeId: flip ? b : a,
        awayId: flip ? a : b,
        played: false,
      });
    }
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }
  return schedule;
}

export function getSortedStandings(teams: LeagueTeam[]): LeagueTeam[] {
  return [...teams].sort((a, b) => {
    const aGames = Math.max(1, a.wins + a.losses + a.ties);
    const bGames = Math.max(1, b.wins + b.losses + b.ties);
    const aPct = (a.wins + a.ties * 0.5) / aGames;
    const bPct = (b.wins + b.ties * 0.5) / bGames;
    if (Math.abs(bPct - aPct) > 0.0001) return bPct - aPct;
    const aDiff = a.pf - a.pa;
    const bDiff = b.pf - b.pa;
    if (bDiff !== aDiff) return bDiff - aDiff;
    if (b.pf !== a.pf) return b.pf - a.pf;
    return b.rating - a.rating;
  });
}

export function createFreshSportsSeason(
  sport: SeasonSportKey,
  seasonNumber = 1,
  championshipsWon = 0,
  carryMyPlayer?: MyPlayerProgression
): SportsSeasonState {
  const isBball = sport === 'basketball';
  const tmpl = isBball ? BASKETBALL_TEAMS_TEMPLATE : FOOTBALL_TEAMS_TEMPLATE;
  const totalWeeks = 10;
  const playoffTeamsCount = 16;
  const defaultBballPos: BballPosition =
    isBball && carryMyPlayer && BBALL_POSITIONS.includes(carryMyPlayer.position as BballPosition)
      ? (carryMyPlayer.position as BballPosition)
      : 'PG';
  const defaultFbPos: FbPosition =
    !isBball && carryMyPlayer && FB_POSITIONS.includes(carryMyPlayer.position as FbPosition)
      ? (carryMyPlayer.position as FbPosition)
      : 'QB';

  const myPlayer: MyPlayerProgression =
    carryMyPlayer && carryMyPlayer.sport === sport
      ? JSON.parse(JSON.stringify(carryMyPlayer))
      : createStartingMyPlayer(sport, isBball ? defaultBballPos : defaultFbPos);

  const teams: LeagueTeam[] = tmpl.map((t) => {
    const teamRating =
      t.id === 'player' ? clampStat(Math.round(77 + (myPlayer.ovr - 66) * 0.42), 77, 94) : t.rating;
    return {
      ...t,
      rating: teamRating,
      wins: 0,
      losses: 0,
      ties: 0,
      pf: 0,
      pa: 0,
      streak: 0,
      roster: isBball
        ? generateTeamRoster(t.id, teamRating, t.id === 'player' ? defaultBballPos : undefined, t.id === 'player' ? myPlayer : undefined)
        : undefined,
      fbRoster: !isBball
        ? generateFootballRoster(t.id, teamRating, t.id === 'player' ? defaultFbPos : undefined, t.id === 'player' ? myPlayer : undefined)
        : undefined,
    };
  });
  const schedule = buildSchedule(
    teams.map((t) => t.id),
    totalWeeks
  );
  const sorted = getSortedStandings(teams);
  return {
    sport,
    seasonNumber,
    phase: 'regular',
    currentWeek: 1,
    totalWeeks,
    playoffTeamsCount,
    playerPosition: isBball ? defaultBballPos : undefined,
    fbPlayerPosition: !isBball ? defaultFbPos : undefined,
    positionLocked: false,
    myPlayer,
    teams,
    schedule,
    seedOrder: sorted.map((t) => t.id),
    playoffBracket: null,
    championshipsWon,
    lastUpdatedAt: Date.now(),
  };
}

let inMemoryStoreCache: SportsSeasonsStore | null = null;

function normalizeSeasonState(raw: any, sport: SeasonSportKey): SportsSeasonState {
  const expectedTeams = 30;
  const expectedWeeks = 10;
  const expectedPlayoffs = 16;
  if (
    !raw ||
    typeof raw !== 'object' ||
    !Array.isArray(raw.teams) ||
    raw.teams.length !== expectedTeams ||
    !Array.isArray(raw.schedule)
  ) {
    // Preserve prior championship count when upgrading Football from 8 -> 30 teams
    const prevTitles = raw && typeof raw.championshipsWon === 'number' ? Math.max(0, Math.floor(raw.championshipsWon)) : 0;
    const prevSeason = raw && typeof raw.seasonNumber === 'number' ? Math.max(1, Math.floor(raw.seasonNumber)) : 1;
    return createFreshSportsSeason(sport, prevSeason, prevTitles);
  }

  const pos: BballPosition = BBALL_POSITIONS.includes(raw.playerPosition) ? raw.playerPosition : 'PG';
  const fbPos: FbPosition = FB_POSITIONS.includes(raw.fbPlayerPosition) ? raw.fbPlayerPosition : 'QB';
  const activePos = sport === 'basketball' ? pos : fbPos;

  let myPlayer: MyPlayerProgression;
  if (raw.myPlayer && typeof raw.myPlayer === 'object' && raw.myPlayer.sport === sport && raw.myPlayer.position === activePos) {
    myPlayer = raw.myPlayer as MyPlayerProgression;
  } else {
    myPlayer = createStartingMyPlayer(sport, activePos);
  }

  const teams: LeagueTeam[] = raw.teams.map((t: LeagueTeam) => ({
    ...t,
    roster:
      sport === 'basketball'
        ? Array.isArray(t.roster) && t.roster.length === 5
          ? t.roster
          : generateTeamRoster(t.id, t.rating, t.id === 'player' ? pos : undefined, t.id === 'player' ? myPlayer : undefined)
        : undefined,
    fbRoster:
      sport === 'football'
        ? Array.isArray(t.fbRoster) && t.fbRoster.length === 5
          ? t.fbRoster
          : generateFootballRoster(t.id, t.rating, t.id === 'player' ? fbPos : undefined, t.id === 'player' ? myPlayer : undefined)
        : undefined,
  }));
  const sorted = getSortedStandings(teams);
  let bracket: SportsPlayoffBracket | null = raw.playoffBracket || null;
  if (bracket && !Array.isArray(bracket.rounds)) {
    const legacyRounds: PlayoffSeriesMatch[][] = [];
    if (bracket.sf1 && bracket.sf2) legacyRounds.push([bracket.sf1, bracket.sf2]);
    if (bracket.final) legacyRounds.push([bracket.final]);
    bracket = legacyRounds.length > 0 ? { ...bracket, rounds: legacyRounds } : null;
  }

  return {
    sport,
    seasonNumber: typeof raw.seasonNumber === 'number' && raw.seasonNumber >= 1 ? Math.floor(raw.seasonNumber) : 1,
    phase:
      raw.phase === 'regular' ||
      raw.phase === 'playoffs' ||
      raw.phase === 'champion' ||
      raw.phase === 'eliminated' ||
      raw.phase === 'missed_playoffs'
        ? raw.phase
        : 'regular',
    currentWeek:
      typeof raw.currentWeek === 'number' ? Math.max(1, Math.min(expectedWeeks, Math.floor(raw.currentWeek))) : 1,
    totalWeeks: expectedWeeks,
    playoffTeamsCount: expectedPlayoffs,
    playerPosition: sport === 'basketball' ? pos : undefined,
    fbPlayerPosition: sport === 'football' ? fbPos : undefined,
    positionLocked: Boolean(raw.positionLocked),
    myPlayer,
    teams,
    schedule: raw.schedule,
    seedOrder:
      Array.isArray(raw.seedOrder) && raw.seedOrder.length === expectedTeams
        ? raw.seedOrder
        : sorted.map((t) => t.id),
    playoffBracket: bracket,
    championTeamId: typeof raw.championTeamId === 'string' ? raw.championTeamId : undefined,
    championshipsWon: typeof raw.championshipsWon === 'number' && raw.championshipsWon >= 0 ? Math.floor(raw.championshipsWon) : 0,
    lastUpdatedAt: typeof raw.lastUpdatedAt === 'number' ? raw.lastUpdatedAt : Date.now(),
  };
}

export function loadSportsSeasonsStore(): SportsSeasonsStore {
  if (inMemoryStoreCache) return inMemoryStoreCache;
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(SPORTS_SEASONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        inMemoryStoreCache = {
          basketball: normalizeSeasonState(parsed?.basketball, 'basketball'),
          football: normalizeSeasonState(parsed?.football, 'football'),
        };
        return inMemoryStoreCache;
      }
    }
  } catch {
    // fallback to default store
  }
  inMemoryStoreCache = {
    basketball: createFreshSportsSeason('basketball', 1, 0),
    football: createFreshSportsSeason('football', 1, 0),
  };
  return inMemoryStoreCache;
}

export function saveSportsSeasonsStore(store: SportsSeasonsStore): void {
  inMemoryStoreCache = store;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SPORTS_SEASONS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota errors
  }
}

export function flushSportsSeasonsStorage(): void {
  if (!inMemoryStoreCache || typeof window === 'undefined') return;
  try {
    localStorage.setItem(SPORTS_SEASONS_STORAGE_KEY, JSON.stringify(inMemoryStoreCache));
  } catch {
    // ignore storage errors
  }
}

export function getSportsSeason(sport: SeasonSportKey): SportsSeasonState {
  return loadSportsSeasonsStore()[sport];
}

function syncMyPlayerOntoPlayerTeam(season: SportsSeasonState): void {
  const mp = season.myPlayer;
  if (!mp) return;
  const pTeam = season.teams.find((t) => t.id === 'player');
  if (!pTeam) return;
  pTeam.rating = clampStat(Math.round(77 + (mp.ovr - 66) * 0.42), 77, 94);
  if (season.sport === 'basketball' && pTeam.roster) {
    const slot = pTeam.roster.find((r) => r.isUser || r.position === mp.position);
    if (slot) {
      slot.isUser = true;
      slot.ovr = mp.ovr;
      slot.potential = mp.potential;
      slot.shoot3 = mp.stats.shoot3 ?? slot.shoot3;
      slot.mid = mp.stats.mid ?? slot.mid;
      slot.drive = mp.stats.drive ?? slot.drive;
      slot.strength = mp.stats.strength ?? slot.strength;
      slot.speed = mp.stats.speed ?? slot.speed;
      slot.block = mp.stats.block ?? slot.block;
      slot.steal = mp.stats.steal ?? slot.steal;
      slot.rebound = mp.stats.rebound ?? slot.rebound;
    }
  } else if (season.sport === 'football' && pTeam.fbRoster) {
    const slot = pTeam.fbRoster.find((r) => r.isUser || r.position === mp.position);
    if (slot) {
      slot.isUser = true;
      slot.ovr = mp.ovr;
      slot.potential = mp.potential;
      slot.throwAcc = mp.stats.throwAcc ?? slot.throwAcc;
      slot.throwPow = mp.stats.throwPow ?? slot.throwPow;
      slot.catchStat = mp.stats.catchStat ?? slot.catchStat;
      slot.carry = mp.stats.carry ?? slot.carry;
      slot.speed = mp.stats.speed ?? slot.speed;
      slot.strength = mp.stats.strength ?? slot.strength;
      slot.tackle = mp.stats.tackle ?? slot.tackle;
      slot.coverage = mp.stats.coverage ?? slot.coverage;
    }
  }
}

export function getMyPlayerProgression(sport: SeasonSportKey): MyPlayerProgression {
  const season = getSportsSeason(sport);
  if (season.myPlayer) return season.myPlayer;
  const pos = sport === 'basketball' ? season.playerPosition || 'PG' : season.fbPlayerPosition || 'QB';
  return createStartingMyPlayer(sport, pos);
}

export function setBasketballSeasonPosition(pos: BballPosition, lockNow: boolean): SportsSeasonState {
  const store = loadSportsSeasonsStore();
  const season: SportsSeasonState = JSON.parse(JSON.stringify(store.basketball));
  if (season.positionLocked) {
    return season;
  }
  const switched = season.playerPosition !== pos;
  season.playerPosition = pos;
  season.positionLocked = lockNow;
  if (switched || !season.myPlayer || season.myPlayer.position !== pos) {
    season.myPlayer = createStartingMyPlayer('basketball', pos);
  }
  const pTeam = season.teams.find((t) => t.id === 'player');
  if (pTeam) {
    pTeam.roster = generateTeamRoster('player', pTeam.rating, pos, season.myPlayer);
    syncMyPlayerOntoPlayerTeam(season);
  }
  season.lastUpdatedAt = Date.now();
  store.basketball = season;
  saveSportsSeasonsStore(store);
  return season;
}

export function setFootballSeasonPosition(pos: FbPosition, lockNow: boolean): SportsSeasonState {
  const store = loadSportsSeasonsStore();
  const season: SportsSeasonState = JSON.parse(JSON.stringify(store.football));
  if (season.positionLocked) {
    return season;
  }
  const switched = season.fbPlayerPosition !== pos;
  season.fbPlayerPosition = pos;
  season.positionLocked = lockNow;
  if (switched || !season.myPlayer || season.myPlayer.position !== pos) {
    season.myPlayer = createStartingMyPlayer('football', pos);
  }
  const pTeam = season.teams.find((t) => t.id === 'player');
  if (pTeam) {
    pTeam.fbRoster = generateFootballRoster('player', pTeam.rating, pos, season.myPlayer);
    syncMyPlayerOntoPlayerTeam(season);
  }
  season.lastUpdatedAt = Date.now();
  store.football = season;
  saveSportsSeasonsStore(store);
  return season;
}

export interface MyPlayerPerfInput {
  won: boolean;
  pointDiff: number;
  // Basketball user stats
  pts?: number;
  reb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  fgm?: number;
  fga?: number;
  // Football user/team stats
  passYds?: number;
  passTd?: number;
  ints?: number;
  rushYds?: number;
  rushTd?: number;
  rec?: number;
  recYds?: number;
  recTd?: number;
  tackles?: number;
  sacks?: number;
  defInt?: number;
  tds?: number;
}

export function recordMyPlayerPerformance(
  sport: SeasonSportKey,
  perf: MyPlayerPerfInput
): { season: SportsSeasonState; gain: MyPlayerLastGain } {
  const store = loadSportsSeasonsStore();
  const season: SportsSeasonState = JSON.parse(JSON.stringify(store[sport]));
  const activePos =
    sport === 'basketball' ? season.playerPosition || 'PG' : season.fbPlayerPosition || 'QB';
  const mp: MyPlayerProgression =
    season.myPlayer && season.myPlayer.sport === sport && season.myPlayer.position === activePos
      ? season.myPlayer
      : createStartingMyPlayer(sport, activePos);

  let rawScore = 16 + (perf.won ? 24 : 5) + Math.max(0, perf.pointDiff) * 0.7;
  if (sport === 'basketball') {
    const pts = perf.pts ?? 0;
    const reb = perf.reb ?? 0;
    const ast = perf.ast ?? 0;
    const stl = perf.stl ?? 0;
    const blk = perf.blk ?? 0;
    const fgm = perf.fgm ?? 0;
    const fga = perf.fga ?? 0;
    rawScore += pts * 2.4 + ast * 3.5 + reb * 2.3 + stl * 4.5 + blk * 4.5 - Math.max(0, fga - fgm) * 0.55;
  } else {
    const passYds = perf.passYds ?? 0;
    const rushYds = perf.rushYds ?? 0;
    const recYds = perf.recYds ?? 0;
    const totalTd = (perf.passTd ?? 0) + (perf.rushTd ?? 0) + (perf.recTd ?? 0) + Math.max(0, (perf.tds ?? 0) - 1) * 0.5;
    const tackles = perf.tackles ?? 0;
    const sacks = perf.sacks ?? 0;
    const defInt = perf.defInt ?? 0;
    const ints = perf.ints ?? 0;
    rawScore += totalTd * 9 + passYds * 0.14 + (rushYds + recYds) * 0.22 + tackles * 3.6 + sacks * 6.5 + defInt * 9.5 - ints * 6;
  }

  const grade: MyPlayerLastGain['grade'] =
    rawScore >= 92
      ? 'S+'
      : rawScore >= 78
      ? 'S'
      : rawScore >= 66
      ? 'A+'
      : rawScore >= 54
      ? 'A'
      : rawScore >= 42
      ? 'B+'
      : rawScore >= 30
      ? 'B'
      : rawScore >= 20
      ? 'C'
      : 'D';

  const xpEarned = Math.max(18, Math.min(165, Math.round(18 + rawScore * 1.25)));
  const ovrBefore = mp.ovr;
  mp.xp += xpEarned;
  mp.gamesPlayed += 1;

  // Higher OVR requires slightly more XP per burst, keeping early progression snappy and prime 90+ earned
  const burstCost = mp.ovr >= 88 ? 48 : mp.ovr >= 78 ? 38 : 30;
  const statUpsMap: Record<string, number> = {};
  const labelsMap = sport === 'basketball' ? BBALL_STAT_LABELS : FB_STAT_LABELS;

  // Bias stat selection toward position strengths & things done well in the match!
  const keys = Object.keys(mp.caps);
  const weightForStat = (k: string): number => {
    let w = (mp.caps[k] - mp.stats[k]) * 1.2;
    if (w <= 0) return 0;
    if (sport === 'basketball') {
      if (k === 'shoot3' && (perf.pts ?? 0) >= 6) w += 10;
      if (k === 'drive' && (perf.fgm ?? 0) >= 3) w += 8;
      if (k === 'block' && (perf.blk ?? 0) >= 1) w += 14;
      if (k === 'steal' && (perf.stl ?? 0) >= 1) w += 14;
      if (k === 'rebound' && (perf.reb ?? 0) >= 2) w += 12;
      if (k === 'speed' && (perf.ast ?? 0) >= 2) w += 10;
    } else {
      if ((k === 'throwAcc' || k === 'throwPow') && (perf.passYds ?? 0) >= 40) w += 12;
      if (k === 'catchStat' && (perf.recYds ?? 0) >= 30) w += 14;
      if (k === 'carry' && (perf.rushYds ?? 0) >= 25) w += 14;
      if (k === 'tackle' && (perf.tackles ?? 0) >= 2) w += 14;
      if (k === 'coverage' && (perf.defInt ?? 0) >= 1) w += 16;
    }
    return w;
  };

  while (mp.xp >= burstCost) {
    const avail = keys.filter((k) => (mp.stats[k] ?? 0) < (mp.caps[k] ?? 0));
    if (avail.length === 0) {
      mp.xp = 0;
      break;
    }
    mp.xp -= burstCost;
    // Upgrade 2–3 attributes per burst
    const ranked = [...avail].sort((a, b) => weightForStat(b) + Math.random() * 8 - (weightForStat(a) + Math.random() * 8));
    const picks = ranked.slice(0, Math.min(3, ranked.length));
    for (const k of picks) {
      const room = (mp.caps[k] ?? 99) - (mp.stats[k] ?? 50);
      if (room <= 0) continue;
      const bump = room >= 8 && mp.ovr < 82 ? 2 : 1;
      mp.stats[k] = Math.min(mp.caps[k], (mp.stats[k] ?? 50) + bump);
      statUpsMap[k] = (statUpsMap[k] || 0) + bump;
    }
  }

  mp.ovr = recomputeMyPlayerOvr(mp);
  const statUps = Object.entries(statUpsMap).map(([k, delta]) => ({
    label: labelsMap[k] || k.toUpperCase(),
    delta,
    newVal: mp.stats[k],
  }));

  const ovrDelta = mp.ovr - ovrBefore;
  const gain: MyPlayerLastGain = {
    grade,
    xpEarned,
    ovrBefore,
    ovrAfter: mp.ovr,
    pot: mp.potential,
    statUps,
    summary:
      mp.ovr >= mp.potential
        ? `MAX POTENTIAL (${mp.potential} OVR) REACHED!`
        : ovrDelta > 0
        ? `GRADE ${grade} · +${ovrDelta} OVR (${ovrBefore} → ${mp.ovr} / ${mp.potential} POT)`
        : `GRADE ${grade} · +${xpEarned} XP toward ${mp.ovr + 1} OVR (${mp.potential} POT)`,
  };
  mp.lastGain = gain;
  season.myPlayer = mp;
  syncMyPlayerOntoPlayerTeam(season);
  season.lastUpdatedAt = Date.now();
  store[sport] = season;
  saveSportsSeasonsStore(store);
  return { season, gain };
}

function updateTeamRecord(team: LeagueTeam, pf: number, pa: number, allowTie: boolean) {
  team.pf += pf;
  team.pa += pa;
  if (pf > pa || (!allowTie && pf === pa)) {
    team.wins += 1;
    team.streak = team.streak >= 0 ? team.streak + 1 : 1;
  } else if (pf < pa) {
    team.losses += 1;
    team.streak = team.streak <= 0 ? team.streak - 1 : -1;
  } else {
    team.ties += 1;
    team.streak = 0;
  }
}

function distributeSimulatedFootballStats(team: LeagueTeam, teamPts: number): void {
  if (!team.fbRoster || team.fbRoster.length === 0) return;
  const qb = team.fbRoster.find((p) => p.position === 'QB');
  const rb = team.fbRoster.find((p) => p.position === 'RB');
  const wr = team.fbRoster.find((p) => p.position === 'WR');
  const lb = team.fbRoster.find((p) => p.position === 'LB');
  const cb = team.fbRoster.find((p) => p.position === 'CB');
  const totalTds = Math.floor(teamPts / 7);
  const passTds = Math.min(totalTds, Math.round(totalTds * (0.55 + Math.random() * 0.3)));
  const rushTds = Math.max(0, totalTds - passTds);
  const passYds = Math.max(40, Math.round(teamPts * 9.5 + (qb ? qb.throwAcc : 75) * 1.1 + (Math.random() - 0.3) * 65));
  const rushYds = Math.max(20, Math.round(teamPts * 3.8 + (rb ? rb.carry : 75) * 0.7 + (Math.random() - 0.3) * 40));
  const rec = Math.max(2, Math.round(passYds / 18));
  const wrShare = 0.62 + Math.random() * 0.16;

  if (qb) {
    qb.gamesPlayed += 1;
    qb.passYds += passYds;
    qb.passTd += passTds;
    qb.ints += Math.random() < (96 - qb.throwAcc) / 90 ? 1 : 0;
  }
  if (rb) {
    rb.gamesPlayed += 1;
    rb.rushYds += rushYds;
    rb.rushTd += rushTds;
    const rbRec = Math.max(1, Math.round(rec * (1 - wrShare)));
    rb.rec += rbRec;
    rb.recYds += Math.round(passYds * (1 - wrShare));
    rb.recTd += Math.max(0, passTds - Math.ceil(passTds * 0.75));
  }
  if (wr) {
    wr.gamesPlayed += 1;
    wr.rec += Math.max(1, Math.round(rec * wrShare));
    wr.recYds += Math.round(passYds * wrShare);
    wr.recTd += Math.ceil(passTds * 0.75);
  }
  if (lb) {
    lb.gamesPlayed += 1;
    lb.tackles += Math.max(2, Math.round((lb.tackle / 18) * (0.7 + Math.random() * 0.6)));
    lb.sacks += Math.random() < lb.tackle / 145 ? 1 : 0;
    lb.defInt += Math.random() < lb.coverage / 360 ? 1 : 0;
  }
  if (cb) {
    cb.gamesPlayed += 1;
    cb.tackles += Math.max(1, Math.round((cb.tackle / 25) * (0.7 + Math.random() * 0.6)));
    cb.defInt += Math.random() < cb.coverage / 190 ? 1 : 0;
  }
}

function distributeSimulatedBballStats(team: LeagueTeam, teamPts: number): void {
  if (!team.roster || team.roster.length === 0) return;
  const weights = team.roster.map((p) =>
    Math.max(1, p.shoot3 * 0.35 + p.mid * 0.25 + p.drive * 0.3 + p.ovr * 0.25)
  );
  const wSum = weights.reduce((s, v) => s + v, 0) || 1;
  let remainingPts = teamPts;

  team.roster.forEach((pl, idx) => {
    pl.gamesPlayed += 1;
    let pts =
      idx === team.roster!.length - 1
        ? Math.max(0, remainingPts)
        : Math.max(0, Math.round((teamPts * weights[idx]) / wSum + (Math.random() - 0.5) * 3));
    if (pts > remainingPts) pts = remainingPts;
    remainingPts -= pts;

    const threeShare = Math.max(0.1, (pl.shoot3 - 45) / 85);
    const tpm = Math.min(Math.floor(pts / 3), Math.round((pts / 3) * threeShare * (0.55 + Math.random() * 0.45)));
    const rem = Math.max(0, pts - tpm * 3);
    const fg2m = Math.ceil(rem / 2);
    const fgm = tpm + fg2m;
    const fga = Math.max(fgm, Math.round(fgm * (1.55 + (95 - pl.mid) / 85 + Math.random() * 0.35)));
    const tpa = Math.max(tpm, Math.round(tpm * (1.7 + (95 - pl.shoot3) / 70 + Math.random() * 0.4)));

    pl.pts += pts;
    pl.fgm += fgm;
    pl.fga += fga;
    pl.tpm += tpm;
    pl.tpa += tpa;
    pl.reb += Math.max(0, Math.round((pl.rebound / 32) * (0.65 + Math.random() * 0.8)));
    pl.ast += Math.max(0, Math.round(((pl.position === 'PG' ? 4.2 : pl.position === 'SG' ? 2.4 : 1.4) * (0.5 + Math.random()))));
    pl.stl += Math.random() < pl.steal / 120 ? 1 : 0;
    pl.blk += Math.random() < pl.block / 115 ? 1 : 0;
  });
}

function simulateCpuScorePair(sport: SeasonSportKey, teamA: LeagueTeam, teamB: LeagueTeam, allowTie: boolean): [number, number] {
  const edge = (teamA.rating - teamB.rating) * 0.16;
  if (sport === 'basketball') {
    let a = Math.max(7, Math.round(14 + edge + (Math.random() - 0.5) * 8.5));
    let b = Math.max(7, Math.round(14 - edge + (Math.random() - 0.5) * 8.5));
    if (!allowTie && a === b) {
      if (Math.random() * 100 < 50 + (teamA.rating - teamB.rating) * 2.2) a += 2;
      else b += 2;
    }
    return [a, b];
  } else {
    const tdOptions = [0, 7, 10, 14, 17, 21, 24, 28];
    const pickA = Math.max(0, Math.min(tdOptions.length - 1, Math.round(2.4 + edge * 0.45 + (Math.random() - 0.5) * 3.4)));
    const pickB = Math.max(0, Math.min(tdOptions.length - 1, Math.round(2.4 - edge * 0.45 + (Math.random() - 0.5) * 3.4)));
    let a = tdOptions[pickA];
    let b = tdOptions[pickB];
    if (!allowTie && a === b) {
      if (Math.random() * 100 < 50 + (teamA.rating - teamB.rating) * 1.5) a += 3;
      else b += 3;
    }
    return [a, b];
  }
}

function getPlayoffRoundLabel(roundIdx: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIdx;
  if (fromEnd === 0) return 'CHAMPIONSHIP FINAL';
  if (fromEnd === 1) return 'SEMIFINAL';
  if (fromEnd === 2) return 'QUARTERFINAL';
  return 'ROUND OF 16';
}

export function getActivePlayerSeasonMatchup(season: SportsSeasonState): {
  opponentId: string;
  opponentName: string;
  opponentShort: string;
  opponentRating: number;
  opponentSeed: number;
  opponentRoster?: BballRosterPlayer[];
  opponentFbRoster?: FbRosterPlayer[];
  playerSeed: number;
  roundLabel: string;
  isPlayoff: boolean;
  isFinal: boolean;
  prizeCash: number;
} {
  const sorted = getSortedStandings(season.teams);
  const seedOf = (id: string) => Math.max(1, sorted.findIndex((t) => t.id === id) + 1);
  const playerSeed = seedOf('player');

  if (season.phase === 'playoffs' && season.playoffBracket) {
    const rounds = season.playoffBracket.rounds;
    const totalRounds = rounds.length;
    for (let r = 0; r < totalRounds; r++) {
      const m = rounds[r].find((x) => !x.played && (x.topTeamId === 'player' || x.botTeamId === 'player'));
      if (m) {
        const oppId = m.topTeamId === 'player' ? m.botTeamId : m.topTeamId;
        const opp = season.teams.find((t) => t.id === oppId) || season.teams[1];
        const isFinal = r === totalRounds - 1;
        const roundTitle = getPlayoffRoundLabel(r, totalRounds);
        const cashByRound = season.sport === 'basketball' ? [4200, 6500, 9500, 18000] : [4800, 7400, 11000, 18500];
        const prize = isFinal ? 18500 : cashByRound[Math.min(cashByRound.length - 1, r)];
        return {
          opponentId: opp.id,
          opponentName: isFinal ? `${opp.name} (FINAL)` : opp.name,
          opponentShort: opp.short,
          opponentRating: opp.rating,
          opponentSeed: seedOf(opp.id),
          opponentRoster: opp.roster,
          opponentFbRoster: opp.fbRoster,
          playerSeed,
          roundLabel: isFinal ? 'CHAMPIONSHIP FINAL' : `${roundTitle} (#${playerSeed} vs #${seedOf(opp.id)})`,
          isPlayoff: true,
          isFinal,
          prizeCash: prize,
        };
      }
    }
  }

  const weekMatch = season.schedule.find(
    (m) => m.week === season.currentWeek && (m.homeId === 'player' || m.awayId === 'player')
  );
  const oppId = weekMatch
    ? weekMatch.homeId === 'player'
      ? weekMatch.awayId
      : weekMatch.homeId
    : season.teams[1].id;
  const opp = season.teams.find((t) => t.id === oppId) || season.teams[1];
  return {
    opponentId: opp.id,
    opponentName: opp.name,
    opponentShort: opp.short,
    opponentRating: opp.rating,
    opponentSeed: seedOf(opp.id),
    opponentRoster: opp.roster,
    opponentFbRoster: opp.fbRoster,
    playerSeed,
    roundLabel: `WEEK ${season.currentWeek}/${season.totalWeeks}`,
    isPlayoff: false,
    isFinal: false,
    prizeCash: season.sport === 'basketball' ? 2800 : 3400,
  };
}

function buildMatchFromTeams(
  id: string,
  roundIdx: number,
  roundLabel: string,
  seedOf: (id: string) => number,
  teamA: LeagueTeam,
  teamB: LeagueTeam
): PlayoffSeriesMatch {
  const sA = seedOf(teamA.id);
  const sB = seedOf(teamB.id);
  const topIsA = sA <= sB;
  const top = topIsA ? teamA : teamB;
  const bot = topIsA ? teamB : teamA;
  const topSeed = topIsA ? sA : sB;
  const botSeed = topIsA ? sB : sA;
  return {
    id,
    roundIdx,
    roundLabel,
    topSeed,
    botSeed,
    topTeamId: top.id,
    botTeamId: bot.id,
    topTeamName: `#${topSeed} ${top.name}`,
    botTeamName: `#${botSeed} ${bot.name}`,
    played: false,
  };
}

function simRemainingBracketToChampion(season: SportsSeasonState): void {
  if (!season.playoffBracket) return;
  const rounds = season.playoffBracket.rounds;
  const totalRounds = rounds.length;
  const seedOf = (id: string) => Math.max(1, season.seedOrder.indexOf(id) + 1);

  for (let r = 0; r < totalRounds; r++) {
    for (const m of rounds[r]) {
      if (m.played) continue;
      const a = season.teams.find((t) => t.id === m.topTeamId)!;
      const b = season.teams.find((t) => t.id === m.botTeamId)!;
      const [sa, sb] = simulateCpuScorePair(season.sport, a, b, false);
      if (season.sport === 'basketball') {
        distributeSimulatedBballStats(a, sa);
        distributeSimulatedBballStats(b, sb);
      } else {
        distributeSimulatedFootballStats(a, sa);
        distributeSimulatedFootballStats(b, sb);
      }
      m.played = true;
      m.topScore = sa;
      m.botScore = sb;
      m.winnerId = sa >= sb ? a.id : b.id;
    }
    if (r < totalRounds - 1 && rounds[r + 1].length === 0) {
      const nextRoundLabel = getPlayoffRoundLabel(r + 1, totalRounds);
      for (let i = 0; i < rounds[r].length; i += 2) {
        const w1 = season.teams.find((t) => t.id === rounds[r][i].winnerId)!;
        const w2 = season.teams.find((t) => t.id === rounds[r][i + 1].winnerId)!;
        rounds[r + 1].push(
          buildMatchFromTeams(`r${r + 1}_m${i / 2}`, r + 1, nextRoundLabel, seedOf, w1, w2)
        );
      }
    }
  }

  const finalMatch = rounds[totalRounds - 1][0];
  season.championTeamId = finalMatch?.winnerId;
  syncLegacyBracketFields(season.playoffBracket);
}

function syncLegacyBracketFields(br: SportsPlayoffBracket): void {
  const total = br.rounds.length;
  if (total >= 2) {
    const sfRound = br.rounds[total - 2];
    if (sfRound.length >= 2) {
      br.sf1 = sfRound[0];
      br.sf2 = sfRound[1];
    }
    br.final = br.rounds[total - 1][0] || null;
  }
}

function finalizeRegularSeasonToPlayoffs(season: SportsSeasonState): void {
  const standings = getSortedStandings(season.teams);
  season.seedOrder = standings.map((t) => t.id);
  const seedOf = (id: string) => Math.max(1, season.seedOrder.indexOf(id) + 1);

  if (season.playoffTeamsCount === 16) {
    // 16-Team Bracket Pairs: (1v16, 8v9), (5v12, 4v13), (3v14, 6v11), (7v10, 2v15)
    const pairs: [number, number][] = [
      [0, 15],
      [7, 8],
      [4, 11],
      [3, 12],
      [2, 13],
      [5, 10],
      [6, 9],
      [1, 14],
    ];
    const r16: PlayoffSeriesMatch[] = pairs.map(([aIdx, bIdx], idx) =>
      buildMatchFromTeams(
        `r0_m${idx}`,
        0,
        `Round of 16 (#${aIdx + 1} vs #${bIdx + 1})`,
        seedOf,
        standings[aIdx],
        standings[bIdx]
      )
    );
    season.playoffBracket = { rounds: [r16, [], [], []] };
  } else {
    const sf1 = buildMatchFromTeams('sf1', 0, 'Semifinal #1 (#1 vs #4)', seedOf, standings[0], standings[3]);
    const sf2 = buildMatchFromTeams('sf2', 0, 'Semifinal #2 (#2 vs #3)', seedOf, standings[1], standings[2]);
    season.playoffBracket = { rounds: [[sf1, sf2], []], sf1, sf2, final: null };
  }

  const qualifyingIds = standings.slice(0, season.playoffTeamsCount).map((t) => t.id);
  if (qualifyingIds.includes('player')) {
    season.phase = 'playoffs';
  } else {
    simRemainingBracketToChampion(season);
    season.phase = 'missed_playoffs';
  }
}

export function recordPlayerSeasonMatchResult(
  sport: SeasonSportKey,
  userScore: number,
  cpuScore: number,
  gameBoxStats?: BballGamePlayerStatInput[],
  fbBoxStats?: FbGamePlayerStatInput[]
): SportsSeasonState {
  const store = loadSportsSeasonsStore();
  const season: SportsSeasonState = JSON.parse(JSON.stringify(store[sport]));
  season.positionLocked = true;

  const applyPlayedBballBoxStats = (playerTeam: LeagueTeam, oppTeam: LeagueTeam) => {
    if (!gameBoxStats || gameBoxStats.length === 0) {
      distributeSimulatedBballStats(playerTeam, userScore);
      distributeSimulatedBballStats(oppTeam, cpuScore);
      return;
    }
    const applyForTeam = (team: LeagueTeam, side: 'player' | 'cpu', fallbackScore: number) => {
      const sideRows = gameBoxStats.filter((g) => g.team === side);
      if (sideRows.length === 0 || !team.roster) {
        distributeSimulatedBballStats(team, fallbackScore);
        return;
      }
      for (const pl of team.roster) {
        const row = sideRows.find((r) => r.position === pl.position);
        pl.gamesPlayed += 1;
        if (row) {
          pl.pts += row.pts;
          pl.reb += row.reb;
          pl.ast += row.ast;
          pl.stl += row.stl;
          pl.blk += row.blk;
          pl.fgm += row.fgm;
          pl.fga += row.fga;
          pl.tpm += row.tpm;
          pl.tpa += row.tpa;
        }
      }
    };
    applyForTeam(playerTeam, 'player', userScore);
    applyForTeam(oppTeam, 'cpu', cpuScore);
  };

  const applyPlayedFbBoxStats = (playerTeam: LeagueTeam, oppTeam: LeagueTeam) => {
    if (!fbBoxStats || fbBoxStats.length === 0) {
      distributeSimulatedFootballStats(playerTeam, userScore);
      distributeSimulatedFootballStats(oppTeam, cpuScore);
      return;
    }
    const applyForTeam = (team: LeagueTeam, side: 'player' | 'cpu', fallbackScore: number) => {
      const sideRows = fbBoxStats.filter((g) => g.team === side);
      if (sideRows.length === 0 || !team.fbRoster) {
        distributeSimulatedFootballStats(team, fallbackScore);
        return;
      }
      for (const pl of team.fbRoster) {
        const row = sideRows.find((r) => r.position === pl.position);
        pl.gamesPlayed += 1;
        if (row) {
          pl.passYds += row.passYds;
          pl.passTd += row.passTd;
          pl.ints += row.ints;
          pl.rushYds += row.rushYds;
          pl.rushTd += row.rushTd;
          pl.rec += row.rec;
          pl.recYds += row.recYds;
          pl.recTd += row.recTd;
          pl.tackles += row.tackles;
          pl.sacks += row.sacks;
          pl.defInt += row.defInt;
        }
      }
    };
    applyForTeam(playerTeam, 'player', userScore);
    applyForTeam(oppTeam, 'cpu', cpuScore);
  };

  if (season.phase === 'regular') {
    const playerMatch = season.schedule.find(
      (m) => m.week === season.currentWeek && (m.homeId === 'player' || m.awayId === 'player') && !m.played
    );
    if (playerMatch) {
      const playerIsHome = playerMatch.homeId === 'player';
      const pTeam = season.teams.find((t) => t.id === 'player')!;
      const oppTeam = season.teams.find((t) => t.id === (playerIsHome ? playerMatch.awayId : playerMatch.homeId))!;
      playerMatch.played = true;
      playerMatch.homeScore = playerIsHome ? userScore : cpuScore;
      playerMatch.awayScore = playerIsHome ? cpuScore : userScore;
      updateTeamRecord(pTeam, userScore, cpuScore, sport === 'football');
      updateTeamRecord(oppTeam, cpuScore, userScore, sport === 'football');
      if (sport === 'basketball') {
        applyPlayedBballBoxStats(pTeam, oppTeam);
      } else {
        applyPlayedFbBoxStats(pTeam, oppTeam);
      }
    }

    // Simulate all other CPU matchups for the current week
    for (const m of season.schedule) {
      if (m.week !== season.currentWeek || m.played) continue;
      const home = season.teams.find((t) => t.id === m.homeId)!;
      const away = season.teams.find((t) => t.id === m.awayId)!;
      const [hs, as] = simulateCpuScorePair(sport, home, away, sport === 'football');
      m.played = true;
      m.homeScore = hs;
      m.awayScore = as;
      updateTeamRecord(home, hs, as, sport === 'football');
      updateTeamRecord(away, as, hs, sport === 'football');
      if (sport === 'basketball') {
        distributeSimulatedBballStats(home, hs);
        distributeSimulatedBballStats(away, as);
      } else {
        distributeSimulatedFootballStats(home, hs);
        distributeSimulatedFootballStats(away, as);
      }
    }

    season.seedOrder = getSortedStandings(season.teams).map((t) => t.id);

    if (season.currentWeek >= season.totalWeeks) {
      finalizeRegularSeasonToPlayoffs(season);
    } else {
      season.currentWeek += 1;
    }
  } else if (season.phase === 'playoffs' && season.playoffBracket) {
    const rounds = season.playoffBracket.rounds;
    const totalRounds = rounds.length;
    const seedOf = (id: string) => Math.max(1, season.seedOrder.indexOf(id) + 1);

    let activeRoundIdx = -1;
    let userMatch: PlayoffSeriesMatch | undefined;
    for (let r = 0; r < totalRounds; r++) {
      const m = rounds[r].find((x) => !x.played && (x.topTeamId === 'player' || x.botTeamId === 'player'));
      if (m) {
        activeRoundIdx = r;
        userMatch = m;
        break;
      }
    }

    if (userMatch && activeRoundIdx >= 0) {
      const playerWon = userScore >= cpuScore;
      userMatch.played = true;
      if (userMatch.topTeamId === 'player') {
        userMatch.topScore = userScore;
        userMatch.botScore = cpuScore;
        userMatch.winnerId = playerWon ? 'player' : userMatch.botTeamId;
      } else {
        userMatch.botScore = userScore;
        userMatch.topScore = cpuScore;
        userMatch.winnerId = playerWon ? 'player' : userMatch.topTeamId;
      }
      const oppId = userMatch.topTeamId === 'player' ? userMatch.botTeamId : userMatch.topTeamId;
      const pTeam = season.teams.find((t) => t.id === 'player')!;
      const oppTeam = season.teams.find((t) => t.id === oppId)!;
      if (sport === 'basketball') {
        applyPlayedBballBoxStats(pTeam, oppTeam);
      } else {
        applyPlayedFbBoxStats(pTeam, oppTeam);
      }

      // Sim sibling matches in the same playoff round
      for (const m of rounds[activeRoundIdx]) {
        if (m.played) continue;
        const a = season.teams.find((t) => t.id === m.topTeamId)!;
        const b = season.teams.find((t) => t.id === m.botTeamId)!;
        const [sa, sb] = simulateCpuScorePair(sport, a, b, false);
        m.played = true;
        m.topScore = sa;
        m.botScore = sb;
        m.winnerId = sa >= sb ? a.id : b.id;
        if (sport === 'basketball') {
          distributeSimulatedBballStats(a, sa);
          distributeSimulatedBballStats(b, sb);
        } else {
          distributeSimulatedFootballStats(a, sa);
          distributeSimulatedFootballStats(b, sb);
        }
      }

      if (activeRoundIdx < totalRounds - 1) {
        const nextRoundLabel = getPlayoffRoundLabel(activeRoundIdx + 1, totalRounds);
        rounds[activeRoundIdx + 1] = [];
        for (let i = 0; i < rounds[activeRoundIdx].length; i += 2) {
          const w1 = season.teams.find((t) => t.id === rounds[activeRoundIdx][i].winnerId)!;
          const w2 = season.teams.find((t) => t.id === rounds[activeRoundIdx][i + 1].winnerId)!;
          rounds[activeRoundIdx + 1].push(
            buildMatchFromTeams(`r${activeRoundIdx + 1}_m${i / 2}`, activeRoundIdx + 1, nextRoundLabel, seedOf, w1, w2)
          );
        }
        if (!playerWon) {
          simRemainingBracketToChampion(season);
          season.phase = 'eliminated';
        }
      } else {
        season.championTeamId = userMatch.winnerId;
        if (playerWon) {
          season.phase = 'champion';
          season.championshipsWon += 1;
        } else {
          season.phase = 'eliminated';
        }
      }
      syncLegacyBracketFields(season.playoffBracket);
    }
  }

  season.lastUpdatedAt = Date.now();
  store[sport] = season;
  saveSportsSeasonsStore(store);
  return season;
}

export function simulatePlayerMatchInSeason(sport: SeasonSportKey): SportsSeasonState {
  const season = getSportsSeason(sport);
  const matchup = getActivePlayerSeasonMatchup(season);
  const pTeam = season.teams.find((t) => t.id === 'player')!;
  const oppTeam: LeagueTeam = {
    id: 'opp',
    name: matchup.opponentName,
    short: matchup.opponentShort,
    rating: matchup.opponentRating,
    wins: 0,
    losses: 0,
    ties: 0,
    pf: 0,
    pa: 0,
    streak: 0,
  };
  const [pScore, cScore] = simulateCpuScorePair(
    sport,
    pTeam,
    oppTeam,
    season.phase === 'regular' && sport === 'football'
  );
  return recordPlayerSeasonMatchResult(sport, pScore, cScore);
}

export function startNextSportsSeason(sport: SeasonSportKey): SportsSeasonState {
  const store = loadSportsSeasonsStore();
  const prev = store[sport];
  const next = createFreshSportsSeason(sport, prev.seasonNumber + 1, prev.championshipsWon, prev.myPlayer);
  store[sport] = next;
  saveSportsSeasonsStore(store);
  return next;
}
