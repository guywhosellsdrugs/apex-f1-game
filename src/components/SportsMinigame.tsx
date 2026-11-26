import React, { useEffect, useRef, useState } from 'react';
import type { CitySportType } from '../game/cityTrafficBuilder';
import {
  drawRetroBasketball,
  drawRetroPixelAthlete,
  pickAthletePalette,
} from './retroSportsSprites';
import {
  getSportsSeason,
  getSortedStandings,
  getActivePlayerSeasonMatchup,
  recordPlayerSeasonMatchResult,
  simulatePlayerMatchInSeason,
  startNextSportsSeason,
  setBasketballSeasonPosition,
  setFootballSeasonPosition,
  generateTeamRoster,
  generateFootballRoster,
  getMyPlayerProgression,
  recordMyPlayerPerformance,
  flushSportsSeasonsStorage,
  BBALL_POSITIONS,
  BBALL_POSITION_PROFILES,
  FB_POSITIONS,
  FB_POSITION_PROFILES,
  BballPosition,
  FbPosition,
  BballRosterPlayer,
  FbRosterPlayer,
  BballGamePlayerStatInput,
  FbGamePlayerStatInput,
  MyPlayerLastGain,
  SportsSeasonState,
  SeasonSportKey,
} from '../game/sportsSeasons';

export interface ActiveSportsMinigameInfo {
  venueId: string;
  sport: CitySportType;
  name: string;
  icon: string;
  streetLocation: string;
}

interface SportsMinigameProps {
  venue: ActiveSportsMinigameInfo;
  onComplete: (cashEarned: number, summaryBanner: string) => void;
  onAbort: () => void;
}

const CANVAS_W = 800;
const CANVAS_H = 520;

type AudioCtxType = AudioContext;

function playRetroSportTone(
  freq: number,
  endFreq: number,
  durationSec: number,
  type: OscillatorType = 'square',
  gainPeak = 0.08
) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const winAny = window as unknown as { __sportsMinigameAudioCtx?: AudioCtxType };
    if (!winAny.__sportsMinigameAudioCtx) {
      winAny.__sportsMinigameAudioCtx = new AudioCtx();
    }
    const ctx = winAny.__sportsMinigameAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(45, endFreq), now + durationSec);
    gain.gain.setValueAtTime(gainPeak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  } catch {
    // ignore WebAudio restrictions
  }
}

interface PixelParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface SportsHudState {
  title: string;
  scoreLeftLabel: string;
  scoreLeftValue: string;
  scoreRightLabel: string;
  scoreRightValue: string;
  clockOrRoundLabel: string;
  clockOrRoundValue: string;
  statusLine: string;
  actionHint: string;
  finished: boolean;
  won: boolean;
  cashEarned: number;
  summaryBanner: string;
  tournamentRound?: number;
  tournamentTitle?: string;
}

interface BballPlayerEntity {
  id: string;
  name: string;
  position: BballPosition;
  team: 'player' | 'cpu';
  isUser: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  faceX: number;
  faceY: number;
  roleOffset: number;
  stealCooldown: number;
  jumpZ: number;
  jumpVz: number;
  dribbleHand: -1 | 1;
  crossTimer: number;
  tweenTimer: number;
  stunTimer: number;
  bumpTimer: number;
  bodyUpCooldown: number;
  moveCooldown: number;
  blockTimer: number;
  moveLabel: string;
  moveLabelTimer: number;
  animTime: number;
  jerseyNum: string;
  seed: number;
  sizeScale: number;
  ovr: number;
  shoot3: number;
  mid: number;
  drive: number;
  strength: number;
  speedStat: number;
  blockStat: number;
  stealStat: number;
  reboundStat: number;
  lastPasserId?: string;
  lastPassTimer: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  cutTimer?: number;
  cutTargetX?: number;
  cutTargetY?: number;
}

interface GolfHoleSpec {
  par: number;
  name: string;
  teeX: number;
  teeY: number;
  cupX: number;
  cupY: number;
  greenRadius: number;
  greenBreakX: number;
  greenBreakY: number;
  windX: number;
  windY: number;
  fairwayPolys: Array<{ x: number; y: number; rx: number; ry: number }>;
  bunkers: Array<{ x: number; y: number; rx: number; ry: number }>;
  waters: Array<{ x: number; y: number; rx: number; ry: number }>;
  trees: Array<{ x: number; y: number; r: number }>;
}

const GOLF_HOLES: GolfHoleSpec[] = [
  {
    par: 3,
    name: 'Hole 1 · Lakefront Island Par 3',
    teeX: 112,
    teeY: 262,
    cupX: 652,
    cupY: 256,
    greenRadius: 44,
    greenBreakX: -22,
    greenBreakY: 28,
    windX: -18,
    windY: 22,
    fairwayPolys: [
      { x: 145, y: 260, rx: 56, ry: 44 },
      { x: 380, y: 258, rx: 128, ry: 54 },
      { x: 642, y: 258, rx: 74, ry: 62 },
    ],
    bunkers: [
      { x: 554, y: 192, rx: 36, ry: 24 },
      { x: 678, y: 332, rx: 38, ry: 24 },
    ],
    waters: [
      { x: 252, y: 138, rx: 84, ry: 48 },
      { x: 515, y: 388, rx: 98, ry: 56 },
    ],
    trees: [
      { x: 110, y: 120, r: 23 },
      { x: 205, y: 410, r: 25 },
      { x: 430, y: 112, r: 26 },
      { x: 735, y: 148, r: 25 },
    ],
  },
  {
    par: 4,
    name: 'Hole 2 · Muddy Branch Dogleg Par 4',
    teeX: 105,
    teeY: 408,
    cupX: 684,
    cupY: 136,
    greenRadius: 42,
    greenBreakX: 26,
    greenBreakY: -24,
    windX: 26,
    windY: -18,
    fairwayPolys: [
      { x: 130, y: 404, rx: 56, ry: 42 },
      { x: 315, y: 368, rx: 136, ry: 52 },
      { x: 482, y: 256, rx: 116, ry: 62 },
      { x: 668, y: 144, rx: 72, ry: 54 },
    ],
    bunkers: [
      { x: 412, y: 406, rx: 42, ry: 26 },
      { x: 586, y: 124, rx: 38, ry: 26 },
    ],
    waters: [{ x: 278, y: 175, rx: 96, ry: 66 }],
    trees: [
      { x: 482, y: 448, r: 25 },
      { x: 140, y: 222, r: 25 },
      { x: 744, y: 284, r: 27 },
      { x: 620, y: 392, r: 25 },
    ],
  },
  {
    par: 4,
    name: 'Hole 3 · Championship Ridge Par 4',
    teeX: 96,
    teeY: 144,
    cupX: 696,
    cupY: 368,
    greenRadius: 40,
    greenBreakX: -28,
    greenBreakY: -24,
    windX: -24,
    windY: -26,
    fairwayPolys: [
      { x: 124, y: 148, rx: 54, ry: 40 },
      { x: 310, y: 184, rx: 130, ry: 50 },
      { x: 500, y: 274, rx: 120, ry: 56 },
      { x: 680, y: 362, rx: 70, ry: 54 },
    ],
    bunkers: [
      { x: 388, y: 112, rx: 38, ry: 24 },
      { x: 598, y: 398, rx: 40, ry: 25 },
      { x: 734, y: 282, rx: 32, ry: 24 },
    ],
    waters: [{ x: 270, y: 372, rx: 102, ry: 62 }],
    trees: [
      { x: 114, y: 342, r: 25 },
      { x: 530, y: 124, r: 26 },
      { x: 432, y: 438, r: 25 },
      { x: 742, y: 148, r: 26 },
    ],
  },
];

const GOLF_CLUBS = [
  { name: 'DRIVER', short: 'DR', maxPower: 430, loftVz: 245, drag: 0.986 },
  { name: 'IRON', short: 'IR', maxPower: 310, loftVz: 215, drag: 0.976 },
  { name: 'WEDGE', short: 'WG', maxPower: 205, loftVz: 185, drag: 0.964 },
  { name: 'PUTTER', short: 'PT', maxPower: 175, loftVz: 0, drag: 0.954 },
];

const TOURNAMENT_ROUNDS = [
  { round: 1, opponent: 'ROCKVILLE ROCKETS', cpuReaction: 0.95, cpuSpeedMult: 0.94, targetScore: 15, prize: 1800 },
  { round: 2, opponent: 'BETHESDA BLITZ', cpuReaction: 1.08, cpuSpeedMult: 1.02, targetScore: 17, prize: 3400 },
  { round: 3, opponent: 'SILVER SPRING SUNS', cpuReaction: 1.2, cpuSpeedMult: 1.1, targetScore: 19, prize: 6000 },
  { round: 4, opponent: 'BALTIMORE KINGS (FINAL)', cpuReaction: 1.32, cpuSpeedMult: 1.18, targetScore: 21, prize: 11500 },
];

const BASEBALL_TOURNAMENT_ROUNDS = [
  { round: 1, opponent: 'ROCKVILLE RIVERDOGS', pitchSpeedMult: 1.0, fielderSpeed: 182, cpuRunChance: 0.45, prize: 2800 },
  { round: 2, opponent: 'CHESAPEAKE CRABS', pitchSpeedMult: 1.12, fielderSpeed: 198, cpuRunChance: 0.57, prize: 5200 },
  { round: 3, opponent: 'BALTIMORE ORIOLES (FINAL)', pitchSpeedMult: 1.24, fielderSpeed: 215, cpuRunChance: 0.7, prize: 9500 },
];

const FOOTBALL_TOURNAMENT_ROUNDS = [
  { round: 1, opponent: 'GAITHERSBURG GRIZZLIES', defSpeedMult: 1.0, breakupChance: 0.44, cpuDrivePts: 3, prize: 3000 },
  { round: 2, opponent: 'POTOMAC PANTHERS', defSpeedMult: 1.12, breakupChance: 0.54, cpuDrivePts: 7, prize: 5600 },
  { round: 3, opponent: 'BALTIMORE RAVENS (FINAL)', defSpeedMult: 1.24, breakupChance: 0.65, cpuDrivePts: 7, prize: 10000 },
];

const SOCCER_TOURNAMENT_ROUNDS = [
  { round: 1, opponent: 'BETHESDA UNITED FC', cpuSpeedMult: 1.0, keeperSpeed: 126, prize: 2600 },
  { round: 2, opponent: 'SILVER SPRING STRIKERS', cpuSpeedMult: 1.1, keeperSpeed: 132, prize: 5000 },
  { round: 3, opponent: 'MARYLAND BAY FC (FINAL)', cpuSpeedMult: 1.2, keeperSpeed: 138, prize: 9200 },
];

interface BracketMatchResult {
  userScore: number;
  cpuScore: number;
  won: boolean;
}

const BBALL_16_TEAMS_RIVALS = [
  'GAITHERSBURG GIANTS',
  'COLUMBIA COMETS',
  'ANNAPOLIS ANCHORS',
  'FREDERICK FALCONS',
  'TOWSON TIGERS',
  'POTOMAC PHANTOMS',
  'COLLEGE PARK TERPS',
  'GERMANTOWN GRIZZLIES',
  'BOWIE BULLDOGS',
  'OLNEY OWLS',
  'WALDORF WOLVES',
  'HAGERSTOWN HAWKS',
];

const BRACKET_RIVAL_PODS: Record<'basketball' | 'baseball' | 'football' | 'soccer', { qfRivals: [string, string, string, string, string, string]; sfRival: string }> = {
  basketball: {
    qfRivals: ['GAITHERSBURG GIANTS', 'COLUMBIA COMETS', 'ANNAPOLIS ANCHORS', 'FREDERICK FALCONS', 'TOWSON TIGERS', 'POTOMAC PHANTOMS'],
    sfRival: 'COLLEGE PARK TERPS',
  },
  baseball: {
    qfRivals: ['FREDERICK KEYS', 'BOWIE BAYSOX', 'HAGERSTOWN SUNS', 'ABERDEEN IRONBIRDS', 'SALISBURY SHOREBIRDS', 'WALDORF BLUE CRABS'],
    sfRival: 'FREDERICK KEYS',
  },
  football: {
    qfRivals: ['ANNAPOLIS MIDSHIPMEN', 'COLLEGE PARK TERPS', 'SILVER SPRING STALLIONS', 'TOWSON TIGERS', 'FREDERICK IRONMEN', 'BETHESDA BULLDOGS'],
    sfRival: 'COLLEGE PARK TERPS',
  },
  soccer: {
    qfRivals: ['ROCKVILLE ROVERS', 'GAITHERSBURG ATHLETIC', 'COLUMBIA CITY', 'ANNAPOLIS SAILORS', 'FREDERICK WANDERERS', 'TOWSON TIGERS FC'],
    sfRival: 'GAITHERSBURG ATHLETIC',
  },
};

function formatClockMMSS(sec: number): string {
  const s = Math.max(0, sec);
  if (s < 10) return `0:0${s.toFixed(1)}`;
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

type FootballPlayType =
  | 'slant'
  | 'mesh'
  | 'curl_flat'
  | 'texas_angle'
  | 'verts'
  | 'pa_post'
  | 'double_corner'
  | 'out_and_up'
  | 'flood'
  | 'screen_wr'
  | 'sweep'
  | 'inside_dive';

type FootballDefPlayType =
  | 'cover2'
  | 'cover3'
  | 'cover4'
  | 'tampa2'
  | 'cover1_man'
  | 'zone_blitz'
  | 'zero_blitz'
  | 'spy_contain';

const FOOTBALL_OFF_PLAYS: Array<{
  id: FootballPlayType;
  label: string;
  short: string;
  category: 'QUICK' | 'DEEP' | 'PA / SPEC' | 'RUN';
  desc: string;
}> = [
  { id: 'slant', label: 'QUICK SLANTS', short: 'SLANT', category: 'QUICK', desc: 'Twin inside slants + RB flat checkdown' },
  { id: 'mesh', label: 'MESH CROSS', short: 'MESH', category: 'QUICK', desc: 'Crossing drags create traffic + RB wheel' },
  { id: 'curl_flat', label: 'CURL FLATS', short: 'CURL', category: 'QUICK', desc: '10-yd comeback curls + RB wide flat' },
  { id: 'texas_angle', label: 'TEXAS ANGLE', short: 'TEXAS', category: 'QUICK', desc: 'WRs clear deep while RB cuts inside angle' },
  { id: 'verts', label: 'FOUR VERTS', short: 'VERTS', category: 'DEEP', desc: 'Full Go streaks deep + RB seam wheel' },
  { id: 'pa_post', label: 'PA DEEP POST', short: 'PA POST', category: 'PA / SPEC', desc: 'Play-action fake + WR1 deep post bomb' },
  { id: 'double_corner', label: 'SMASH CORNER', short: 'CORNER', category: 'DEEP', desc: 'Deep sideline corners beat Cover 2' },
  { id: 'out_and_up', label: 'OUT & UP', short: 'OUT&UP', category: 'DEEP', desc: 'Double move fake out then burst deep' },
  { id: 'flood', label: 'FLOOD CONCEPT', short: 'FLOOD', category: 'PA / SPEC', desc: '3-level sideline flood (Deep/Mid/Flat)' },
  { id: 'screen_wr', label: 'WR BUBBLE', short: 'SCREEN', category: 'PA / SPEC', desc: 'Quick bubble screen behind WR2 stalk block' },
  { id: 'sweep', label: 'HB TOSS SWEEP', short: 'SWEEP', category: 'RUN', desc: 'Toss outside to RB behind lead edge' },
  { id: 'inside_dive', label: 'HB INSIDE DIVE', short: 'DIVE', category: 'RUN', desc: 'Downhill A-gap handoff behind O-Line' },
];

const FOOTBALL_DEF_PLAYS: Array<{
  id: FootballDefPlayType;
  label: string;
  short: string;
  category: 'ZONE' | 'MAN' | 'BLITZ';
  desc: string;
}> = [
  { id: 'cover2', label: 'COVER 2 ZONE', short: 'COV 2', category: 'ZONE', desc: 'CBs guard flats, FS roams deep middle' },
  { id: 'cover3', label: 'COVER 3 SKY', short: 'COV 3', category: 'ZONE', desc: '3 deep thirds stop vertical Go & Post routes' },
  { id: 'cover4', label: 'COVER 4 QUARTERS', short: 'COV 4', category: 'ZONE', desc: 'Prevent deep shell — concede short dumps' },
  { id: 'tampa2', label: 'TAMPA 2', short: 'TAMPA2', category: 'ZONE', desc: 'Hard flat traps + deep middle seam drop' },
  { id: 'cover1_man', label: 'COVER 1 MAN', short: 'MAN 1', category: 'MAN', desc: 'Tight man-to-man + FS single-high centerfield' },
  { id: 'zone_blitz', label: 'CB ZONE BLITZ', short: 'Z-BLITZ', category: 'BLITZ', desc: 'Edge CB2 blitzes QB + 2-deep zone behind' },
  { id: 'zero_blitz', label: 'ALL-OUT ZERO', short: '0-BLITZ', category: 'BLITZ', desc: 'Heavy 4-man jailbreak blitz — high risk/sack!' },
  { id: 'spy_contain', label: 'QB SPY CONTAIN', short: 'SPY', category: 'MAN', desc: 'Edge contain rush + FS spies QB/RB scramble' },
];

export const SportsMinigame: React.FC<SportsMinigameProps> = ({
  venue,
  onComplete,
  onAbort,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onAbortRef = useRef(onAbort);
  const venueRef = useRef(venue);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    onAbortRef.current = onAbort;
  }, [onAbort]);
  useEffect(() => {
    venueRef.current = venue;
  }, [venue]);

  const [gameKey, setGameKey] = useState(0);
  const [bballMode, setBballMode] = useState<'free' | 'tournament' | 'season'>('free');
  const [bballCourtMode, setBballCourtMode] = useState<'half' | 'full'>('half');
  const [bballTeamSize, setBballTeamSize] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [tournamentRoundIdx, setTournamentRoundIdx] = useState(0);

  const [baseballMode, setBaseballMode] = useState<'free' | 'tournament'>('free');
  const [baseballRoundIdx, setBaseballRoundIdx] = useState(0);

  const [footballMode, setFootballMode] = useState<'free' | 'tournament' | 'season'>('free');
  const [footballRoundIdx, setFootballRoundIdx] = useState(0);

  const [soccerMode, setSoccerMode] = useState<'free' | 'tournament'>('free');
  const [soccerTeamSize, setSoccerTeamSize] = useState<3 | 5>(3);
  const [soccerRoundIdx, setSoccerRoundIdx] = useState(0);

  const [showBracketModal, setShowBracketModal] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [bballSeason, setBballSeason] = useState<SportsSeasonState>(() => getSportsSeason('basketball'));
  const [footballSeason, setFootballSeason] = useState<SportsSeasonState>(() => getSportsSeason('football'));
  const [bballPosition, setBballPosition] = useState<BballPosition>(() => getSportsSeason('basketball').playerPosition || 'PG');
  const [fbPosition, setFbPosition] = useState<FbPosition>(() => getSportsSeason('football').fbPlayerPosition || 'QB');
  const [seasonHubTab, setSeasonHubTab] = useState<'standings' | 'rosters' | 'myplayer'>('standings');
  const [selectedRosterTeamId, setSelectedRosterTeamId] = useState<string>('player');
  const [lastMyPlayerGain, setLastMyPlayerGain] = useState<MyPlayerLastGain | null>(null);
  const [lastBballBoxScore, setLastBballBoxScore] = useState<Array<{
    id: string;
    name: string;
    pos: BballPosition;
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
    isUser: boolean;
  }>>([]);
  const [lastFbBoxScore, setLastFbBoxScore] = useState<Array<{
    id: string;
    name: string;
    pos: FbPosition;
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
    isUser: boolean;
  }>>([]);
  const [bballBracketResults, setBballBracketResults] = useState<(BracketMatchResult | null)[]>([null, null, null, null]);
  const [baseballBracketResults, setBaseballBracketResults] = useState<(BracketMatchResult | null)[]>([null, null, null]);
  const [footballBracketResults, setFootballBracketResults] = useState<(BracketMatchResult | null)[]>([null, null, null]);
  const [soccerBracketResults, setSoccerBracketResults] = useState<(BracketMatchResult | null)[]>([null, null, null]);

  useEffect(() => {
    const flushSeasons = () => {
      flushSportsSeasonsStorage();
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') flushSeasons();
    };
    window.addEventListener('pagehide', flushSeasons);
    window.addEventListener('beforeunload', flushSeasons);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      flushSeasons();
      window.removeEventListener('pagehide', flushSeasons);
      window.removeEventListener('beforeunload', flushSeasons);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const [golfClubIdx, setGolfClubIdx] = useState(0);
  const golfClubIdxRef = useRef(0);
  useEffect(() => {
    golfClubIdxRef.current = golfClubIdx;
  }, [golfClubIdx]);

  const [footballPlay, setFootballPlay] = useState<FootballPlayType>('slant');
  const [footballCoachPlay, setFootballCoachPlay] = useState<FootballPlayType>('slant');
  const footballPlayRef = useRef<FootballPlayType>('slant');
  useEffect(() => {
    footballPlayRef.current = footballPlay;
  }, [footballPlay]);

  const [footballDefPlay, setFootballDefPlay] = useState<FootballDefPlayType>('cover2');
  const [footballCoachDefPlay, setFootballCoachDefPlay] = useState<FootballDefPlayType>('cover2');
  const footballDefPlayRef = useRef<FootballDefPlayType>('cover2');
  useEffect(() => {
    footballDefPlayRef.current = footballDefPlay;
  }, [footballDefPlay]);

  const [fbSide, setFbSide] = useState<'player' | 'cpu'>('player');
  const fbSideRef = useRef<'player' | 'cpu'>('player');
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);

  const [hud, setHud] = useState<SportsHudState>({
    title: venue.name,
    scoreLeftLabel: 'YOU',
    scoreLeftValue: '0',
    scoreRightLabel: 'CPU',
    scoreRightValue: '0',
    clockOrRoundLabel: 'STATUS',
    clockOrRoundValue: 'READY',
    statusLine: 'Press SPACE to play!',
    actionHint: '',
    finished: false,
    won: false,
    cashEarned: 0,
    summaryBanner: '',
  });

  const keysRef = useRef<Set<string>>(new Set());
  const virtualActionHeldRef = useRef(false);
  const virtualActionPulseRef = useRef(false);
  const virtualPassPulseRef = useRef(false);
  const virtualAltActionPulseRef = useRef(false);
  const virtualCrossPulseRef = useRef(false);
  const virtualTweenPulseRef = useRef(false);
  const virtualScreenPulseRef = useRef(false);
  const pointerPosRef = useRef<{ x: number; y: number; active: boolean }>({
    x: CANVAS_W * 0.5,
    y: CANVAS_H * 0.5,
    active: false,
  });

  useEffect(() => {
    const sport = venue.sport;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    keysRef.current.clear();
    virtualActionHeldRef.current = false;
    virtualActionPulseRef.current = false;
    virtualPassPulseRef.current = false;
    virtualAltActionPulseRef.current = false;
    virtualScreenPulseRef.current = false;
    setLastMyPlayerGain(null);

    const particles: PixelParticle[] = [];
    const spawnParticles = (
      x: number,
      y: number,
      color: string,
      count = 14,
      speed = 140
    ) => {
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const mag = speed * (0.45 + Math.random() * 0.75);
        particles.push({
          x,
          y,
          vx: Math.cos(ang) * mag,
          vy: Math.sin(ang) * mag,
          life: 0.4 + Math.random() * 0.45,
          maxLife: 0.85,
          color,
          size: 3 + Math.floor(Math.random() * 3),
        });
      }
    };

    const drawParticles = (dt: number) => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    };

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    // Helper: draw animated retro bleachers on top/bottom edges
    const drawRetroBleachers = (timeMs: number, topY: number, botY: number, crowdDensity = 24) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, CANVAS_W, topY);
      ctx.fillRect(0, botY, CANVAS_W, CANVAS_H - botY);
      ctx.fillStyle = '#1e293b';
      for (let r = 0; r < 2; r++) {
        ctx.fillRect(16, 4 + r * 14, CANVAS_W - 32, 10);
        ctx.fillRect(16, botY + 4 + r * 14, CANVAS_W - 32, 10);
      }
      const colors = ['#38bdf8', '#facc15', '#ef4444', '#f8fafc', '#22c55e', '#a855f7'];
      for (let i = 0; i < crowdDensity; i++) {
        const fx = 28 + (i * (CANVAS_W - 56)) / Math.max(1, crowdDensity - 1);
        const hopTop = Math.abs(Math.sin(timeMs * 0.005 + i * 1.3)) * 3;
        const hopBot = Math.abs(Math.cos(timeMs * 0.0055 + i * 1.7)) * 3;
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(fx - 3, 7 - hopTop, 6, 7);
        ctx.fillRect(fx - 3, 21 - hopTop * 0.7, 6, 7);
        ctx.fillRect(fx - 3, botY + 7 - hopBot, 6, 7);
        ctx.fillRect(fx - 3, botY + 21 - hopBot * 0.7, 6, 7);
      }
    };

    // =========================================================================
    // 1. RETRO 16-BIT BASKETBALL (Half/Full, 1v1..5v5, Hard 5v5 Tournament!)
    // =========================================================================
    const isTourney = bballMode === 'tournament';
    const isBballSeason = bballMode === 'season';
    const liveBballSeason = isBballSeason ? getSportsSeason('basketball') : null;
    const bballSeasonMatch = liveBballSeason ? getActivePlayerSeasonMatchup(liveBballSeason) : null;
    const bballSeasonPlayable = Boolean(
      isBballSeason && liveBballSeason && (liveBballSeason.phase === 'regular' || liveBballSeason.phase === 'playoffs')
    );
    const tourneyRound = TOURNAMENT_ROUNDS[Math.min(TOURNAMENT_ROUNDS.length - 1, tournamentRoundIdx)];
    const isHalfCourt = isTourney || isBballSeason ? false : bballCourtMode === 'half';
    const teamN = isTourney || isBballSeason ? 5 : bballTeamSize;
    const activeUserPos: BballPosition =
      isBballSeason && liveBballSeason?.playerPosition ? liveBballSeason.playerPosition : bballPosition;

    const seasonSkillT = bballSeasonMatch
      ? Math.max(0, Math.min(1, (bballSeasonMatch.opponentRating - 69) / 24))
      : 0.5;
    // Balanced CPU defense multipliers — tight enough to contest & punish bad drives while keeping team tiers distinct
    const cpuReactionMult = isTourney
      ? tourneyRound.cpuReaction * 0.96
      : isBballSeason
      ? 0.86 + seasonSkillT * 0.36 + (bballSeasonMatch?.isPlayoff ? 0.05 : 0)
      : 0.95;
    const cpuSpeedScale = isTourney
      ? tourneyRound.cpuSpeedMult * 0.96
      : isBballSeason
      ? 0.88 + seasonSkillT * 0.24 + (bballSeasonMatch?.isPlayoff ? 0.04 : 0)
      : 0.96;

    const liveBballMp = liveBballSeason?.myPlayer || getMyPlayerProgression('basketball');
    const playerRosterSource: BballRosterPlayer[] = (() => {
      const base = liveBballSeason?.teams.find((t) => t.id === 'player')?.roster;
      if (
        base &&
        base.length === 5 &&
        base.some((r) => r.isUser && r.position === activeUserPos && r.ovr === liveBballMp.ovr)
      ) {
        return base;
      }
      return generateTeamRoster('player', 84, activeUserPos, liveBballMp);
    })();
    const cpuRosterSource: BballRosterPlayer[] = (() => {
      if (bballSeasonMatch?.opponentRoster && bballSeasonMatch.opponentRoster.length === 5) {
        return bballSeasonMatch.opponentRoster;
      }
      const oppRating = isTourney ? 78 + tournamentRoundIdx * 5 : 81;
      const oppId = isTourney ? `tourney_${tournamentRoundIdx}` : 'freeplay_cpu';
      return generateTeamRoster(oppId, oppRating);
    })();
    const orderedPlayerRoster = [
      playerRosterSource.find((r) => r.position === activeUserPos) || playerRosterSource[0],
      ...playerRosterSource.filter((r) => r.position !== activeUserPos),
    ];

    const courtLeft = 34;
    const courtRight = CANVAS_W - 34;
    const courtTop = 38;
    const courtBot = CANVAS_H - 38;
    const courtMidX = (courtLeft + courtRight) * 0.5;
    const courtMidY = (courtTop + courtBot) * 0.5;
    const hoopRight = { x: courtRight - 36, y: courtMidY };
    const hoopLeft = { x: courtLeft + 36, y: courtMidY };
    const threePtRad = isHalfCourt ? 196 : 162;

    const bbPlayers: BballPlayerEntity[] = [];
    const getBballOffenseSlot = (idx: number, hoopX: number, dirToCenter: -1 | 1, posOverride?: BballPosition) => {
      const posIdx = posOverride ? BBALL_POSITIONS.indexOf(posOverride) : idx;
      const slots = [
        { x: clamp(hoopX + dirToCenter * 228, courtLeft + 44, courtRight - 44), y: courtMidY }, // PG Top of Key
        { x: clamp(hoopX + dirToCenter * 155, courtLeft + 44, courtRight - 44), y: courtTop + 56 }, // SG Left Wing
        { x: clamp(hoopX + dirToCenter * 155, courtLeft + 44, courtRight - 44), y: courtBot - 56 }, // SF Right Wing
        { x: clamp(hoopX + dirToCenter * 66, courtLeft + 44, courtRight - 44), y: courtTop + 46 }, // PF Corner/High Post
        { x: clamp(hoopX + dirToCenter * 78, courtLeft + 44, courtRight - 44), y: courtMidY + 58 }, // C Dunker Spot
      ];
      return slots[Math.max(0, posIdx) % slots.length];
    };

    const makeEntityFromRoster = (
      id: string,
      team: 'player' | 'cpu',
      isUser: boolean,
      r: BballRosterPlayer,
      x: number,
      y: number,
      faceX: number,
      dribbleHand: -1 | 1,
      seed: number,
      existing?: BballPlayerEntity
    ): BballPlayerEntity => {
      const prof = BBALL_POSITION_PROFILES[r.position];
      return {
        id,
        name: r.name,
        position: r.position,
        team,
        isUser,
        x,
        y,
        vx: 0,
        vy: 0,
        faceX,
        faceY: 0,
        roleOffset: y - courtMidY,
        stealCooldown: 0,
        jumpZ: 0,
        jumpVz: 0,
        dribbleHand,
        crossTimer: 0,
        tweenTimer: 0,
        stunTimer: 0,
        bumpTimer: 0,
        bodyUpCooldown: 0,
        moveCooldown: 0,
        blockTimer: 0,
        moveLabel: '',
        moveLabelTimer: 0,
        animTime: seed * 0.7,
        jerseyNum: r.jersey,
        seed,
        sizeScale: prof.sizeScale,
        ovr: r.ovr,
        shoot3: r.shoot3,
        mid: r.mid,
        drive: r.drive,
        strength: r.strength,
        speedStat: r.speed,
        blockStat: r.block,
        stealStat: r.steal,
        reboundStat: r.rebound,
        lastPasserId: undefined,
        lastPassTimer: 0,
        pts: existing?.pts ?? 0,
        reb: existing?.reb ?? 0,
        ast: existing?.ast ?? 0,
        stl: existing?.stl ?? 0,
        blk: existing?.blk ?? 0,
        fgm: existing?.fgm ?? 0,
        fga: existing?.fga ?? 0,
        tpm: existing?.tpm ?? 0,
        tpa: existing?.tpa ?? 0,
      };
    };

    let bbFrontcourtReached = false;
    const resetBballPositions = (possessionTeam: 'player' | 'cpu') => {
      bbFrontcourtReached = false;
      const prevById = new Map(bbPlayers.map((pl) => [pl.id, pl]));
      bbPlayers.length = 0;
      const offHoop = possessionTeam === 'player' ? hoopRight : isHalfCourt ? hoopRight : hoopLeft;
      const dirToCenter: -1 | 1 = offHoop.x > courtMidX ? -1 : 1;
      for (let i = 0; i < teamN; i++) {
        const rp = orderedPlayerRoster[i % orderedPlayerRoster.length];
        const slot = getBballOffenseSlot(i, offHoop.x, dirToCenter, rp.position);
        const isOff = possessionTeam === 'player';
        const px = isOff ? slot.x : clamp(slot.x + dirToCenter * -44, courtLeft + 34, courtRight - 34);
        const py = slot.y;
        const fx = i === 0 && !isOff ? clamp(offHoop.x + dirToCenter * 168, courtLeft + 40, courtRight - 40) : px;
        const fy = i === 0 && !isOff ? courtMidY : py;
        const id = `p_${i}`;
        bbPlayers.push(
          makeEntityFromRoster(id, 'player', i === 0, rp, fx, fy, offHoop.x > px ? 1 : -1, 1, i + 1, prevById.get(id))
        );
      }
      for (let i = 0; i < teamN; i++) {
        const rp = cpuRosterSource[i % cpuRosterSource.length];
        const slot = getBballOffenseSlot(i, offHoop.x, dirToCenter, rp.position);
        const isCpuOff = possessionTeam === 'cpu';
        const cx = isCpuOff ? slot.x : clamp(slot.x - dirToCenter * 44, courtLeft + 34, courtRight - 34);
        const cy = slot.y;
        const id = `c_${i}`;
        bbPlayers.push(
          makeEntityFromRoster(id, 'cpu', false, rp, cx, cy, offHoop.x > cx ? 1 : -1, -1, i + 12, prevById.get(id))
        );
      }
    };
    resetBballPositions('player');

    const bb = {
      scorePlayer: 0,
      scoreCpu: 0,
      targetScore: isTourney
        ? tourneyRound.targetScore
        : isBballSeason
        ? bballSeasonMatch?.isFinal
          ? 21
          : bballSeasonMatch?.isPlayoff
          ? 19
          : 15
        : isHalfCourt
        ? 15
        : 21,
      timeLeft: 60,
      shotClock: 24,
      possession: 'player' as 'player' | 'cpu',
      carrierId: 'p_0' as string | null,
      ballX: bbPlayers[0].x + 12,
      ballY: bbPlayers[0].y + 8,
      ballZ: 0,
      ballSpin: 0,
      dribbleBallTrail: [] as Array<{ x: number; y: number; z: number; color: string }>,
      netSwishTimer: 0,
      shakeTimer: 0,
      dunkPendingTimer: 0,
      dunkAnim: null as null | {
        playerId: string;
        team: 'player' | 'cpu';
        startX: number;
        startY: number;
        rimX: number;
        rimY: number;
        elapsed: number;
        duration: number;
        hangTime: number;
        slamFired: boolean;
        blockChecked?: boolean;
        willMake: boolean;
        points: number;
      },
      mashHeat: 0,
      dirHoldTime: 0,
      netAnchorX: bbPlayers[0].x,
      netAnchorY: bbPlayers[0].y,
      anchorAge: 0,
      lastDirSignX: 0,
      lastDirSignY: 0,
      lastDirChangeTime: -99,
      fumbleCooldown: 0,
      cpuWatchTimer: 0,
      isReboundLive: false,
      ballFlight: null as null | {
        startX: number;
        startY: number;
        targetX: number;
        targetY: number;
        reboundX: number;
        reboundY: number;
        elapsed: number;
        duration: number;
        isShot: boolean;
        willMake: boolean;
        points: number;
        passToId?: string;
        shooterId?: string;
        shooterTeam: 'player' | 'cpu';
      },
      looseBallVx: 0,
      looseBallVy: 0,
      looseBallZ: 0,
      looseBallVz: 0,
      shotCharging: false,
      shotCharge: 0,
      shotGreenStart: 0.62,
      shotGreenWidth: 0.24,
      shotDifficultyLabel: 'OPEN',
      cpuShootTimer: 1.5,
      screen: null as null | {
        screenerId: string;
        targetDefId: string | null;
        sideY: -1 | 1;
        timer: number;
        engaged: boolean;
        screenedTriggered: boolean;
        rollTimer: number;
      },
      inbound: null as null | {
        team: 'player' | 'cpu';
        passerId: string;
        receiverId: string;
        timer: number;
      },
      statusText: isTourney
        ? `ROUND ${tourneyRound.round}/4 vs ${tourneyRound.opponent} · Cut Arrows Cross/Tween · [Q] Screen · [E] Pass · [SPACE] Shoot!`
        : isBballSeason && bballSeasonMatch
        ? `S${liveBballSeason?.seasonNumber} ${bballSeasonMatch.roundLabel} vs #${bballSeasonMatch.opponentSeed} ${bballSeasonMatch.opponentName} · [Q] Screen · [E] Pass · [SPACE] Shoot!`
        : `ICM Gym ${teamN}v${teamN} · Cut Arrows Cross/Tween · [Q] Screen · [E] Pass · [SPACE] Shoot/Dunk!`,
      bannerTimer: isTourney || isBballSeason ? 1.8 : 0,
      bannerText: isTourney
        ? `RD ${tourneyRound.round}: ${tourneyRound.opponent}`
        : isBballSeason && bballSeasonMatch
        ? `${bballSeasonMatch.roundLabel}: vs #${bballSeasonMatch.opponentSeed} ${bballSeasonMatch.opponentShort}`
        : '',
      finished: isBballSeason && !bballSeasonPlayable,
    };

    const startBballInbound = (receivingTeam: 'player' | 'cpu') => {
      resetBballPositions(receivingTeam);
      bb.possession = receivingTeam;
      bb.shotCharging = false;
      bb.ballFlight = null;
      bb.screen = null;
      bb.shotClock = 24;
      bb.mashHeat = 0;
      bb.dirHoldTime = 0;
      bb.cpuWatchTimer = 0;
      bb.anchorAge = 0;
      bb.netAnchorX = bbPlayers[0].x;
      bb.netAnchorY = bbPlayers[0].y;
      bbFrontcourtReached = false;
      const passerIdx = teamN >= 2 ? 1 : 0;
      const passerId = receivingTeam === 'player' ? `p_${passerIdx}` : `c_${passerIdx}`;
      const receiverId = receivingTeam === 'player' ? 'p_0' : 'c_0';
      const passer = bbPlayers.find((p) => p.id === passerId);
      const receiver = bbPlayers.find((p) => p.id === receiverId);

      if (passer && receiver) {
        if (isHalfCourt) {
          // Half-court check-up throw-in at top of the key
          passer.x = courtMidX + 18;
          passer.y = courtTop + 34;
          passer.faceX = 0.7;
          passer.faceY = 0.7;
          receiver.x = courtMidX + 54;
          receiver.y = courtMidY;
        } else {
          // True full-court baseline throw-in behind the endline where the opponent just scored!
          const baselineX = receivingTeam === 'player' ? courtLeft - 6 : courtRight + 6;
          passer.x = baselineX;
          passer.y = courtMidY + 38;
          passer.faceX = receivingTeam === 'player' ? 1 : -1;
          passer.faceY = -0.25;
          receiver.x = receivingTeam === 'player' ? courtLeft + 62 : courtRight - 62;
          receiver.y = courtMidY - 12;
        }
        passer.vx = 0;
        passer.vy = 0;
        bb.carrierId = passer.id;
        bb.ballX = passer.x + passer.faceX * 9;
        bb.ballY = passer.y + 6;
      }

      bb.inbound = {
        team: receivingTeam,
        passerId,
        receiverId,
        timer: receivingTeam === 'player' ? 1.55 : 0.9,
      };
      bb.statusText =
        receivingTeam === 'player'
          ? isHalfCourt
            ? 'CHECK-UP THROW-IN! Press [E] or [SPACE] to pass in!'
            : 'BASELINE THROW-IN! Move to get open & press [E] / [SPACE] to inbound!'
          : isHalfCourt
          ? 'CPU CHECKING BALL UP — Pick up your man!'
          : 'CPU THROWING IN FROM BASELINE — Set your full-court press!';
    };

    const executeBballInboundPass = () => {
      const inb = bb.inbound;
      if (!inb) return;
      const passer = bbPlayers.find((p) => p.id === inb.passerId);
      const receiver = bbPlayers.find((p) => p.id === inb.receiverId);
      bb.inbound = null;
      bb.shotClock = 24;
      if (passer && receiver && passer.id !== receiver.id) {
        bb.carrierId = null;
        bb.ballFlight = {
          startX: passer.x,
          startY: passer.y,
          targetX: receiver.x,
          targetY: receiver.y,
          reboundX: receiver.x,
          reboundY: receiver.y,
          elapsed: 0,
          duration: 0.24,
          isShot: false,
          willMake: false,
          points: 0,
          passToId: receiver.id,
          shooterTeam: inb.team,
        };
        // Step passer back inbounds after releasing the throw-in
        passer.x = clamp(passer.x, courtLeft + 22, courtRight - 22);
        passer.y = clamp(passer.y, courtTop + 22, courtBot - 22);
        playRetroSportTone(540, 440, 0.08, 'sine', 0.06);
      } else if (receiver) {
        receiver.x = clamp(receiver.x, courtLeft + 24, courtRight - 24);
        receiver.y = clamp(receiver.y, courtTop + 24, courtBot - 24);
        bb.carrierId = receiver.id;
      }
      bb.statusText =
        inb.team === 'player'
          ? 'Inbound complete! Cut Arrows for Cross/Tween · [E] Pass · Hold [SPACE] Shoot!'
          : 'CPU inbounds! Stay in front · [SPACE] Steal or Block!';
    };

    const computeBballShotWindow = (shooter: BballPlayerEntity, targetHoop: { x: number; y: number }) => {
      const dist = Math.hypot(targetHoop.x - shooter.x, targetHoop.y - shooter.y);
      const speedMag = Math.hypot(shooter.vx, shooter.vy);
      let nearestDefDist = 999;
      let nearestDefStunned = false;
      for (const other of bbPlayers) {
        if (other.team === shooter.team) continue;
        const d = Math.hypot(other.x - shooter.x, other.y - shooter.y);
        if (d < nearestDefDist) {
          nearestDefDist = d;
          nearestDefStunned = other.stunTimer > 0;
        }
      }

      const halfCourtHeaveDist = isHalfCourt ? 315 : 372;
      const isLayup = dist < 74;
      const isThree = dist >= threePtRad;
      const isHalfCourtHeave = dist >= halfCourtHeaveDist;

      // Realistic tier scaling: wide-open layup >> mid-range > wide-open 3pt >> half-court heave
      let greenWidth: number;
      if (isHalfCourtHeave) {
        greenWidth = 0.042;
      } else if (isLayup) {
        greenWidth = (isTourney ? 0.31 : 0.35) + (shooter.drive - 80) * 0.0018;
      } else if (!isThree) {
        greenWidth = (isTourney ? 0.21 : 0.24) + (shooter.mid - 80) * 0.002 - Math.max(0, (dist - 74) / 1500);
      } else {
        greenWidth = (isTourney ? 0.12 : 0.145) + (shooter.shoot3 - 80) * 0.0024 - Math.max(0, (dist - threePtRad) / 2100);
      }

      if (!nearestDefStunned) {
        if (nearestDefDist < 42) {
          greenWidth *= 0.62;
        } else if (nearestDefDist < 76) {
          greenWidth *= 0.82;
        }
      } else if (!isHalfCourtHeave) {
        greenWidth += 0.05;
      }
      if (speedMag > 115 && !isLayup) {
        greenWidth -= 0.018;
      }
      greenWidth = clamp(greenWidth, isHalfCourtHeave ? 0.032 : 0.052, 0.39);

      const greenCenter = isHalfCourtHeave
        ? 0.86
        : isLayup
        ? 0.64
        : clamp(0.68 + Math.min(0.14, (dist - 70) / 1400), 0.66, 0.82);
      const greenStart = clamp(greenCenter - greenWidth * 0.5, 0.44, 0.94 - greenWidth);

      const contestTag = nearestDefStunned
        ? 'ANKLES BROKEN!'
        : nearestDefDist < 42
        ? 'LOCKED DOWN!'
        : nearestDefDist < 76
        ? 'CONTESTED'
        : 'WIDE OPEN';
      const rangeTag = isHalfCourtHeave ? 'HALF-COURT HEAVE' : isLayup ? 'DUNK/LAYUP' : isThree ? '3PT' : 'MID';
      return {
        greenStart,
        greenWidth,
        isThree,
        isHalfCourtHeave,
        nearestDefDist,
        label: `${rangeTag} · ${contestTag}`,
      };
    };

    // =========================================================================
    // 2. RETRO 3D BALLISTIC GOLF (Wind, 3D Arc Over Trees/Water, Green Break!)
    // =========================================================================
    const golf = {
      holeIdx: 0,
      strokes: 0,
      totalStrokes: 0,
      totalPar: 0,
      ballX: GOLF_HOLES[0].teeX,
      ballY: GOLF_HOLES[0].teeY,
      ballZ: 0,
      lastDryX: GOLF_HOLES[0].teeX,
      lastDryY: GOLF_HOLES[0].teeY,
      vx: 0,
      vy: 0,
      vz: 0,
      aimAngle: Math.atan2(GOLF_HOLES[0].cupY - GOLF_HOLES[0].teeY, GOLF_HOLES[0].cupX - GOLF_HOLES[0].teeX),
      charging: false,
      chargeOsc: 0,
      chargeDir: 1,
      inCupTimer: 0,
      lipOutCooldown: 0,
      swingTimer: 0,
      ballTrail: [] as Array<{ x: number; y: number; z: number }>,
      statusText: 'Hole 1 · [←/→] Aim · [↑/↓] Club · Hold [SPACE] Swing (Avoid >88% Red)!',
      finished: false,
    };

    const loadGolfHole = (idx: number) => {
      const h = GOLF_HOLES[idx];
      golf.holeIdx = idx;
      golf.strokes = 0;
      golf.ballX = h.teeX;
      golf.ballY = h.teeY;
      golf.ballZ = 0;
      golf.lastDryX = h.teeX;
      golf.lastDryY = h.teeY;
      golf.vx = 0;
      golf.vy = 0;
      golf.vz = 0;
      golf.aimAngle = Math.atan2(h.cupY - h.teeY, h.cupX - h.teeX);
      golf.charging = false;
      golf.chargeOsc = 0;
      golf.inCupTimer = 0;
      golf.lipOutCooldown = 0;
      const dist = Math.hypot(h.cupX - h.teeX, h.cupY - h.teeY);
      const bestClub = dist > 380 ? 0 : dist > 230 ? 1 : dist > 110 ? 2 : 3;
      setGolfClubIdx(bestClub);
      golfClubIdxRef.current = bestClub;
      golf.statusText = `${h.name} · Watch Strong Wind & Green Arrows!`;
    };

    // =========================================================================
    // 3. HARDER PRO BASEBALL (Tournament Mode, Fast Heat, Sharp Break, DP Throws!)
    // =========================================================================
    const isBaseballTourney = baseballMode === 'tournament';
    const baseballTourneyRound =
      BASEBALL_TOURNAMENT_ROUNDS[Math.min(BASEBALL_TOURNAMENT_ROUNDS.length - 1, baseballRoundIdx)];
    const baseballPitchMult = isBaseballTourney ? baseballTourneyRound.pitchSpeedMult : 1.05;
    const baseballFielderSpd = isBaseballTourney ? baseballTourneyRound.fielderSpeed : 186;
    const baseballCpuRunProb = isBaseballTourney ? baseballTourneyRound.cpuRunChance : 0.44;

    const homePlate = { x: CANVAS_W * 0.5, y: CANVAS_H - 64 };
    const firstBase = { x: CANVAS_W * 0.5 + 116, y: CANVAS_H - 180 };
    const secondBase = { x: CANVAS_W * 0.5, y: CANVAS_H - 296 };
    const thirdBase = { x: CANVAS_W * 0.5 - 116, y: CANVAS_H - 180 };
    const mound = { x: CANVAS_W * 0.5, y: CANVAS_H - 184 };

    const bbFielders = [
      { x: CANVAS_W * 0.5 + 98, y: CANVAS_H - 216, homeX: CANVAS_W * 0.5 + 98, homeY: CANVAS_H - 216 },
      { x: CANVAS_W * 0.5 + 52, y: CANVAS_H - 274, homeX: CANVAS_W * 0.5 + 52, homeY: CANVAS_H - 274 },
      { x: CANVAS_W * 0.5 - 52, y: CANVAS_H - 274, homeX: CANVAS_W * 0.5 - 52, homeY: CANVAS_H - 274 },
      { x: CANVAS_W * 0.5 - 98, y: CANVAS_H - 216, homeX: CANVAS_W * 0.5 - 98, homeY: CANVAS_H - 216 },
      { x: CANVAS_W * 0.5 - 165, y: 122, homeX: CANVAS_W * 0.5 - 165, homeY: 122 },
      { x: CANVAS_W * 0.5, y: 88, homeX: CANVAS_W * 0.5, homeY: 88 },
      { x: CANVAS_W * 0.5 + 165, y: 122, homeX: CANVAS_W * 0.5 + 165, homeY: 122 },
    ];

    const PITCH_TYPES = [
      { name: '4-SEAM FASTBALL', speed: 425, curveX: 0, breakTag: '97 MPH HEAT' },
      { name: '12-6 CURVEBALL', speed: 315, curveX: 118, breakTag: 'SHARP 12-6' },
      { name: 'BACKDOOR SLIDER', speed: 358, curveX: -128, breakTag: 'WIPEOUT SL' },
      { name: 'SPLITTER', speed: 342, curveX: 48, breakTag: 'LATE DROP' },
    ];

    const baseball = {
      inning: 1,
      maxInnings: 3,
      runs: 0,
      cpuRuns: 0,
      hits: 0,
      hrs: 0,
      outs: 0,
      strikes: 0,
      balls: 0,
      bases: [false, false, false] as [boolean, boolean, boolean],
      phase: 'windup' as 'windup' | 'pitching' | 'batted' | 'inning_break',
      waitTimer: 1.05,
      pitchTypeIdx: 0,
      aimX: homePlate.x,
      aimY: homePlate.y,
      ballX: mound.x,
      ballY: mound.y,
      ballVx: 0,
      ballVy: 0,
      ballZ: 0,
      ballVz: 0,
      pitchCurveX: 0,
      pitchTrail: [] as Array<{ x: number; y: number }>,
      swungThisPitch: false,
      swingTimer: 0,
      swingIsPower: false,
      stealAttemptCooldown: 0,
      runnerAnim: 0,
      throwStreak: null as null | { x1: number; y1: number; x2: number; y2: number; timer: number },
      bannerTimer: isBaseballTourney ? 1.6 : 0,
      bannerText: isBaseballTourney ? `RD ${baseballTourneyRound.round}: ${baseballTourneyRound.opponent}` : '',
      statusText: isBaseballTourney
        ? `ROUND ${baseballTourneyRound.round}/3 vs ${baseballTourneyRound.opponent} · Arrows Aim · [SPACE] Swing!`
        : 'Use Arrow Keys to Aim Sweet Spot · Press [SPACE] to Swing!',
      finished: false,
    };

    // =========================================================================
    // 4. RETRO BOWL HORIZONTAL GRIDIRON (1,920px Long Field + Playable Defense!)
    // =========================================================================
    const fbWorldW = 1920; // 120 yards total @ 16px/yard (10yd left EZ + 100yd + 10yd right EZ)
    const fbEzLeftX = 160; // Yard 0 (Player Endzone left of 160)
    const fbEzRightX = 1760; // Yard 100 (Opponent Endzone right of 1760)
    const fbTopY = 64;
    const fbBotY = CANVAS_H - 44;
    const fbMidY = (fbTopY + fbBotY) * 0.5;

    const yardToX = (yd: number) => fbEzLeftX + yd * 16;
    const xToYard = (x: number) => clamp(Math.round((x - fbEzLeftX) / 16), 0, 100);

    interface FbEntity {
      id: string;
      team: 'player' | 'cpu';
      role: 'qb' | 'wr1' | 'wr2' | 'rb' | 'ol' | 'dl' | 'lb' | 'cb' | 'user_def';
      x: number;
      y: number;
      vx: number;
      vy: number;
      routeWaypoints: Array<{ x: number; y: number }>;
      wpIdx: number;
      speed: number;
      animTime?: number;
      jerseyNum?: string;
    }

    const isFootballTourney = footballMode === 'tournament';
    const isFootballSeason = footballMode === 'season';
    const liveFbSeason = isFootballSeason ? getSportsSeason('football') : null;
    const fbSeasonMatch = liveFbSeason ? getActivePlayerSeasonMatchup(liveFbSeason) : null;
    const fbSeasonPlayable = Boolean(
      isFootballSeason && liveFbSeason && (liveFbSeason.phase === 'regular' || liveFbSeason.phase === 'playoffs')
    );
    const activeFbPos: FbPosition =
      isFootballSeason && liveFbSeason?.fbPlayerPosition ? liveFbSeason.fbPlayerPosition : fbPosition;
    const liveFbMp = liveFbSeason?.myPlayer || getMyPlayerProgression('football');
    const fbPlayerRosterSource: FbRosterPlayer[] = (() => {
      const base = liveFbSeason?.teams.find((t) => t.id === 'player')?.fbRoster;
      if (
        base &&
        base.length === 5 &&
        base.some((r) => r.isUser && r.position === activeFbPos && r.ovr === liveFbMp.ovr)
      ) {
        return base;
      }
      return generateFootballRoster('player', 81, activeFbPos, liveFbMp);
    })();
    const fbCpuRosterSource: FbRosterPlayer[] = (() => {
      if (fbSeasonMatch?.opponentFbRoster && fbSeasonMatch.opponentFbRoster.length === 5) {
        return fbSeasonMatch.opponentFbRoster;
      }
      const oppRating = isFootballTourney ? 79 + footballRoundIdx * 6 : 81;
      const oppId = isFootballTourney ? `fb_tourney_${footballRoundIdx}` : 'fb_freeplay_cpu';
      return generateFootballRoster(oppId, oppRating);
    })();
    const pQB = fbPlayerRosterSource.find((r) => r.position === 'QB') || fbPlayerRosterSource[0];
    const pRB = fbPlayerRosterSource.find((r) => r.position === 'RB') || fbPlayerRosterSource[1];
    const pWR = fbPlayerRosterSource.find((r) => r.position === 'WR') || fbPlayerRosterSource[2];
    const pLB = fbPlayerRosterSource.find((r) => r.position === 'LB') || fbPlayerRosterSource[3];
    const pCB = fbPlayerRosterSource.find((r) => r.position === 'CB') || fbPlayerRosterSource[4];
    const myFbProfile =
      fbPlayerRosterSource.find((r) => r.isUser || r.position === activeFbPos) || fbPlayerRosterSource[0];
    const cQB = fbCpuRosterSource.find((r) => r.position === 'QB') || fbCpuRosterSource[0];
    const cRB = fbCpuRosterSource.find((r) => r.position === 'RB') || fbCpuRosterSource[1];
    const cWR = fbCpuRosterSource.find((r) => r.position === 'WR') || fbCpuRosterSource[2];
    const cLB = fbCpuRosterSource.find((r) => r.position === 'LB') || fbCpuRosterSource[3];
    const cCB = fbCpuRosterSource.find((r) => r.position === 'CB') || fbCpuRosterSource[4];

    interface FbMatchStatRow {
      id: string;
      name: string;
      pos: FbPosition;
      team: 'player' | 'cpu';
      isUser: boolean;
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
    const fbMatchStats: FbMatchStatRow[] = [
      ...fbPlayerRosterSource.map((r) => ({
        id: r.id,
        name: r.name,
        pos: r.position,
        team: 'player' as const,
        isUser: Boolean(r.isUser || r.position === activeFbPos),
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
      })),
      ...fbCpuRosterSource.map((r) => ({
        id: `cpu_${r.id}`,
        name: r.name,
        pos: r.position,
        team: 'cpu' as const,
        isUser: false,
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
      })),
    ];
    const addFbStat = (team: 'player' | 'cpu', pos: FbPosition, fn: (row: FbMatchStatRow) => void) => {
      const row = fbMatchStats.find((r) => r.team === team && r.pos === pos);
      if (row) fn(row);
    };
    let fbPlayStartYard = 25;
    let fbPlayWasPass = false;
    let fbPlayReceiverPos: FbPosition = 'WR';

    const footballTourneyRound =
      FOOTBALL_TOURNAMENT_ROUNDS[Math.min(FOOTBALL_TOURNAMENT_ROUNDS.length - 1, footballRoundIdx)];
    const fbSeasonSkillT = fbSeasonMatch
      ? Math.max(0, Math.min(1, (fbSeasonMatch.opponentRating - 69) / 24))
      : 0.5;
    const fbDefSpeedMult = isFootballTourney
      ? footballTourneyRound.defSpeedMult
      : isFootballSeason
      ? 0.9 + fbSeasonSkillT * 0.32 + (fbSeasonMatch?.isPlayoff ? 0.05 : 0)
      : 1.0;
    const fbBreakupChance = isFootballTourney
      ? footballTourneyRound.breakupChance
      : isFootballSeason
      ? 0.36 + fbSeasonSkillT * 0.28 + (fbSeasonMatch?.isPlayoff ? 0.04 : 0)
      : 0.36;

    const fb = {
      timeLeft: isFootballTourney || isFootballSeason ? 90 : 100,
      scorePlayer: 0,
      scoreCpu: 0,
      tds: 0,
      possession: 'player' as 'player' | 'cpu',
      losYard: 25,
      firstDownYard: 35,
      down: 1,
      phase: 'huddle' as 'huddle' | 'live_pass' | 'ball_in_air' | 'yac_run' | 'play_over',
      carrierId: 'qb' as string,
      playOverTimer: 0,
      cpuSnapTimer: 0,
      cpuThrowTimer: 1.5,
      jukeTimer: 0,
      jukeCooldown: 0,
      diveTimer: 0,
      diveCooldown: 0,
      throwCharging: false,
      throwCharge: 0,
      throwGreenStart: 0.42,
      throwGreenWidth: 0.32,
      throwTargetId: 'wr1' as string,
      throwTargetLockedByKey: false,
      lastThrowPerfect: true,
      userPickRolled: false,
      cpuPlayCall: 'slant' as FootballPlayType,
      cpuDefCall: 'cover2' as FootballDefPlayType,
      camX: clamp(yardToX(25) - CANVAS_W * 0.4, 0, fbWorldW - CANVAS_W),
      passStartX: 0,
      passStartY: 0,
      passTargetX: 0,
      passTargetY: 0,
      passTargetId: 'wr1' as string,
      passTeam: 'player' as 'player' | 'cpu',
      passElapsed: 0,
      passDuration: 0.45,
      ballX: yardToX(25),
      ballY: fbMidY,
      entities: [] as FbEntity[],
      bannerTimer: isFootballTourney || isFootballSeason ? 1.6 : 0,
      bannerText: isFootballTourney
        ? `RD ${footballTourneyRound.round}: ${footballTourneyRound.opponent}`
        : isFootballSeason && fbSeasonMatch
        ? `${fbSeasonMatch.roundLabel}: vs #${fbSeasonMatch.opponentSeed} ${fbSeasonMatch.opponentShort}`
        : '',
      statusText: isFootballTourney
        ? `ROUND ${footballTourneyRound.round}/3 vs ${footballTourneyRound.opponent} · [SPACE] Snap · [←/→] Audible!`
        : isFootballSeason && fbSeasonMatch
        ? `S${liveFbSeason?.seasonNumber} ${fbSeasonMatch.roundLabel} vs #${fbSeasonMatch.opponentSeed} ${fbSeasonMatch.opponentName} · [SPACE] Snap!`
        : `MYPLAYER ${activeFbPos} (${myFbProfile.ovr} OVR) · [SPACE] Snap · [←/→] Audible Play!`,
      finished: isFootballSeason && !fbSeasonPlayable,
    };

    const pickCoachFootballPlay = (): FootballPlayType => {
      const ydsToGo = Math.max(1, fb.firstDownYard - fb.losYard);
      if (fb.losYard >= 85) {
        const rz: FootballPlayType[] = ['slant', 'mesh', 'double_corner', 'inside_dive', 'texas_angle'];
        return rz[Math.floor(Math.random() * rz.length)];
      }
      if (fb.timeLeft < 28 && fb.scorePlayer < fb.scoreCpu) {
        const hurry: FootballPlayType[] = ['verts', 'pa_post', 'double_corner', 'out_and_up', 'flood'];
        return hurry[Math.floor(Math.random() * hurry.length)];
      }
      if (ydsToGo <= 4 || (activeFbPos === 'RB' && Math.random() < 0.42)) {
        const shortYds: FootballPlayType[] = ['sweep', 'inside_dive', 'texas_angle', 'slant', 'screen_wr'];
        return shortYds[Math.floor(Math.random() * shortYds.length)];
      }
      if (fb.down >= 3 && ydsToGo >= 8) {
        const longOpts: FootballPlayType[] = ['verts', 'pa_post', 'double_corner', 'out_and_up', 'flood'];
        return longOpts[Math.floor(Math.random() * longOpts.length)];
      }
      const allOpts = FOOTBALL_OFF_PLAYS.map((p) => p.id);
      return allOpts[Math.floor(Math.random() * allOpts.length)];
    };

    const pickCoachDefPlay = (): FootballDefPlayType => {
      const ydsToGo = Math.max(1, fb.losYard - fb.firstDownYard);
      if (fb.down >= 3 && ydsToGo >= 8) {
        const passDef: FootballDefPlayType[] = ['cover3', 'cover4', 'tampa2', 'zone_blitz'];
        return passDef[Math.floor(Math.random() * passDef.length)];
      }
      if (fb.down >= 3 && ydsToGo <= 3) {
        const shortDef: FootballDefPlayType[] = ['cover1_man', 'zone_blitz', 'zero_blitz', 'spy_contain'];
        return shortDef[Math.floor(Math.random() * shortDef.length)];
      }
      const allDef = FOOTBALL_DEF_PLAYS.map((p) => p.id);
      return allDef[Math.floor(Math.random() * allDef.length)];
    };

    const buildOffRouteSet = (
      play: FootballPlayType,
      losX: number,
      dir: 1 | -1
    ): {
      wr1: Array<{ x: number; y: number }>;
      wr2: Array<{ x: number; y: number }>;
      rb: Array<{ x: number; y: number }>;
    } => {
      const clampRx = (rawX: number) => clamp(rawX, fbEzLeftX - 98, fbEzRightX + 108);
      const ax = (dx: number) => clampRx(losX + dir * dx);
      switch (play) {
        case 'slant':
          return {
            wr1: [{ x: ax(42), y: fbTopY + 46 }, { x: ax(215), y: fbMidY + 44 }],
            wr2: [{ x: ax(38), y: fbBotY - 46 }, { x: ax(205), y: fbMidY - 40 }],
            rb: [{ x: ax(30), y: fbBotY - 70 }, { x: ax(140), y: fbBotY - 54 }],
          };
        case 'mesh':
          return {
            wr1: [{ x: ax(38), y: fbTopY + 84 }, { x: ax(165), y: fbBotY - 76 }, { x: ax(270), y: fbBotY - 44 }],
            wr2: [{ x: ax(42), y: fbBotY - 82 }, { x: ax(175), y: fbTopY + 72 }, { x: ax(275), y: fbTopY + 48 }],
            rb: [{ x: ax(20), y: fbBotY - 48 }, { x: ax(135), y: fbBotY - 36 }, { x: ax(285), y: fbBotY - 34 }],
          };
        case 'curl_flat':
          return {
            wr1: [{ x: ax(115), y: fbTopY + 42 }, { x: ax(92), y: fbTopY + 64 }],
            wr2: [{ x: ax(115), y: fbBotY - 42 }, { x: ax(92), y: fbBotY - 64 }],
            rb: [{ x: ax(22), y: fbBotY - 68 }, { x: ax(115), y: fbBotY - 44 }],
          };
        case 'texas_angle':
          return {
            wr1: [{ x: ax(135), y: fbTopY + 34 }, { x: ax(325), y: fbTopY + 34 }],
            wr2: [{ x: ax(82), y: fbBotY - 44 }, { x: ax(215), y: fbMidY - 8 }],
            rb: [{ x: ax(40), y: fbMidY + 78 }, { x: ax(155), y: fbMidY - 12 }],
          };
        case 'verts':
          return {
            wr1: [{ x: ax(145), y: fbTopY + 36 }, { x: ax(365), y: fbTopY + 36 }],
            wr2: [{ x: ax(145), y: fbBotY - 36 }, { x: ax(365), y: fbBotY - 36 }],
            rb: [{ x: ax(55), y: fbMidY + 48 }, { x: ax(215), y: fbMidY + 32 }, { x: ax(345), y: fbMidY + 24 }],
          };
        case 'pa_post':
          return {
            wr1: [{ x: ax(112), y: fbTopY + 42 }, { x: ax(315), y: fbMidY - 6 }],
            wr2: [{ x: ax(76), y: fbBotY - 48 }, { x: ax(245), y: fbTopY + 86 }],
            rb: [{ x: ax(12), y: fbMidY + 8 }, { x: ax(95), y: fbMidY + 68 }],
          };
        case 'double_corner':
          return {
            wr1: [{ x: ax(96), y: fbTopY + 106 }, { x: ax(275), y: fbTopY + 24 }],
            wr2: [{ x: ax(96), y: fbBotY - 106 }, { x: ax(275), y: fbBotY - 24 }],
            rb: [{ x: ax(38), y: fbMidY + 52 }, { x: ax(130), y: fbMidY + 48 }],
          };
        case 'out_and_up':
          return {
            wr1: [{ x: ax(68), y: fbTopY + 42 }, { x: ax(92), y: fbTopY + 22 }, { x: ax(325), y: fbTopY + 28 }],
            wr2: [{ x: ax(84), y: fbBotY - 46 }, { x: ax(220), y: fbMidY + 18 }],
            rb: [{ x: ax(35), y: fbBotY - 74 }, { x: ax(145), y: fbBotY - 64 }],
          };
        case 'flood':
          return {
            wr1: [{ x: ax(125), y: fbTopY + 88 }, { x: ax(310), y: fbBotY - 36 }],
            wr2: [{ x: ax(85), y: fbBotY - 68 }, { x: ax(205), y: fbBotY - 56 }],
            rb: [{ x: ax(26), y: fbBotY - 42 }, { x: ax(125), y: fbBotY - 24 }],
          };
        case 'screen_wr':
          return {
            wr1: [{ x: ax(-14), y: fbTopY + 34 }, { x: ax(145), y: fbTopY + 30 }],
            wr2: [{ x: ax(80), y: fbBotY - 46 }, { x: ax(210), y: fbBotY - 46 }],
            rb: [{ x: ax(24), y: fbMidY + 72 }, { x: ax(120), y: fbBotY - 72 }],
          };
        case 'sweep':
          return {
            wr1: [{ x: ax(105), y: fbTopY + 38 }],
            wr2: [{ x: ax(95), y: fbBotY - 52 }],
            rb: [{ x: ax(-22), y: fbBotY - 62 }, { x: ax(165), y: fbBotY - 46 }],
          };
        case 'inside_dive':
          return {
            wr1: [{ x: ax(115), y: fbTopY + 38 }],
            wr2: [{ x: ax(115), y: fbBotY - 38 }],
            rb: [{ x: ax(14), y: fbMidY + 6 }, { x: ax(155), y: fbMidY + 6 }],
          };
      }
    };

    const alignPlayerDefensePreSnap = () => {
      const losX = yardToX(fb.losYard);
      const defCall = footballDefPlayRef.current;
      const pFs = fb.entities.find((e) => e.id === 'p_fs');
      const pCb1 = fb.entities.find((e) => e.id === 'p_cb1');
      const pCb2 = fb.entities.find((e) => e.id === 'p_cb2');
      const pDl1 = fb.entities.find((e) => e.id === 'p_dl1');
      const pDl2 = fb.entities.find((e) => e.id === 'p_dl2');
      if (pDl1) { pDl1.x = clamp(losX - 16, fbEzLeftX - 35, fbEzRightX - 16); pDl1.y = fbMidY - 26; }
      if (pDl2) { pDl2.x = clamp(losX - 16, fbEzLeftX - 35, fbEzRightX - 16); pDl2.y = fbMidY + 26; }
      if (pFs) {
        pFs.x = clamp(losX - (defCall === 'zero_blitz' ? 88 : defCall === 'cover4' ? 185 : 158), fbEzLeftX - 80, fbEzRightX - 16);
        pFs.y = defCall === 'zone_blitz' ? fbBotY - 82 : fbMidY;
      }
      if (pCb1) {
        pCb1.x = clamp(losX - (defCall === 'cover1_man' || defCall === 'zero_blitz' ? 42 : defCall === 'cover4' ? 128 : 84), fbEzLeftX - 70, fbEzRightX - 16);
        pCb1.y = fbTopY + 52;
      }
      if (pCb2) {
        pCb2.x = clamp(losX - (defCall === 'cover1_man' || defCall === 'zero_blitz' || defCall === 'zone_blitz' ? 44 : defCall === 'cover4' ? 128 : 84), fbEzLeftX - 70, fbEzRightX - 16);
        pCb2.y = fbBotY - 52;
      }
    };

    let activeHuddlePlay: FootballPlayType = footballPlayRef.current;
    let activeHuddleDefPlay: FootballDefPlayType = footballDefPlayRef.current;

    const setupFootballSnapFormation = (useCoachAutoCall = false) => {
      const losX = yardToX(fb.losYard);
      fbPlayStartYard = fb.losYard;
      fbPlayWasPass = false;
      fbPlayReceiverPos = 'WR';
      if (useCoachAutoCall && fb.possession === 'player') {
        const coachPick = pickCoachFootballPlay();
        footballPlayRef.current = coachPick;
        setFootballPlay(coachPick);
        setFootballCoachPlay(coachPick);
      } else if (useCoachAutoCall && fb.possession === 'cpu') {
        const coachDefPick = pickCoachDefPlay();
        footballDefPlayRef.current = coachDefPick;
        setFootballDefPlay(coachDefPick);
        setFootballCoachDefPlay(coachDefPick);
      }
      if (fbSideRef.current !== fb.possession) {
        fbSideRef.current = fb.possession;
        setFbSide(fb.possession);
      }
      const play = footballPlayRef.current;
      activeHuddlePlay = play;
      activeHuddleDefPlay = footballDefPlayRef.current;
      fb.entities = [];
      fb.diveTimer = 0;
      fb.jukeTimer = 0;
      fb.throwCharging = false;
      fb.throwTargetLockedByKey = false;

      const cpuDefOpts: FootballDefPlayType[] = ['cover2', 'cover3', 'cover4', 'tampa2', 'cover1_man', 'zone_blitz', 'spy_contain'];
      fb.cpuDefCall = cpuDefOpts[Math.floor(Math.random() * cpuDefOpts.length)];

      if (fb.possession === 'player') {
        const routes = buildOffRouteSet(play, losX, 1);
        const pQbSpd = 152 + pQB.speed * 0.46;
        const pWrSpd = 166 + pWR.speed * 0.52;
        const pRbSpd = 168 + pRB.speed * 0.52;
        const cLbSpd = (132 + cLB.speed * 0.42) * fbDefSpeedMult;
        const cCbSpd = (138 + cCB.speed * 0.44) * fbDefSpeedMult;
        fb.entities.push(
          { id: 'qb', team: 'player', role: 'qb', x: losX - 38, y: fbMidY, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: pQbSpd, jerseyNum: pQB.jersey },
          {
            id: 'wr1',
            team: 'player',
            role: 'wr1',
            x: losX - 6,
            y: fbTopY + 42,
            vx: 0,
            vy: 0,
            routeWaypoints: routes.wr1,
            wpIdx: 0,
            speed: pWrSpd,
            jerseyNum: pWR.jersey,
          },
          {
            id: 'wr2',
            team: 'player',
            role: 'wr2',
            x: losX - 6,
            y: fbBotY - 42,
            vx: 0,
            vy: 0,
            routeWaypoints: routes.wr2,
            wpIdx: 0,
            speed: pWrSpd + 3,
            jerseyNum: '88',
          },
          {
            id: 'rb',
            team: 'player',
            role: 'rb',
            x: losX - 68,
            y: fbMidY + 34,
            vx: 0,
            vy: 0,
            routeWaypoints: routes.rb,
            wpIdx: 0,
            speed: pRbSpd,
            jerseyNum: pRB.jersey,
          },
          { id: 'ol_t', team: 'player', role: 'ol', x: losX - 8, y: fbMidY - 32, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 74, jerseyNum: '71' },
          { id: 'ol_c', team: 'player', role: 'ol', x: losX - 8, y: fbMidY, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 74, jerseyNum: '55' },
          { id: 'ol_b', team: 'player', role: 'ol', x: losX - 8, y: fbMidY + 32, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 74, jerseyNum: '79' },
          { id: 'c_dl1', team: 'cpu', role: 'dl', x: clamp(losX + 14, fbEzLeftX + 16, fbEzRightX + 40), y: fbMidY - 26, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 130 * fbDefSpeedMult, jerseyNum: '97' },
          { id: 'c_dl2', team: 'cpu', role: 'dl', x: clamp(losX + 14, fbEzLeftX + 16, fbEzRightX + 40), y: fbMidY + 26, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 130 * fbDefSpeedMult, jerseyNum: '92' },
          { id: 'c_lb1', team: 'cpu', role: 'lb', x: clamp(losX + 74, fbEzLeftX + 16, fbEzRightX + 55), y: fbMidY + 22, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: cLbSpd, jerseyNum: cLB.jersey },
          { id: 'c_fs', team: 'cpu', role: 'lb', x: clamp(losX + 165, fbEzLeftX + 24, fbEzRightX + 80), y: fbMidY, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: cCbSpd + 8, jerseyNum: '31' },
          { id: 'c_cb1', team: 'cpu', role: 'cb', x: clamp(losX + 82, fbEzLeftX + 16, fbEzRightX + 70), y: fbTopY + 50, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: cCbSpd, jerseyNum: cCB.jersey },
          { id: 'c_cb2', team: 'cpu', role: 'cb', x: clamp(losX + 82, fbEzLeftX + 16, fbEzRightX + 70), y: fbBotY - 50, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: cCbSpd, jerseyNum: '24' }
        );
        fb.carrierId = 'qb';
        fb.ballX = losX - 38;
        fb.ballY = fbMidY;
        fb.camX = clamp(losX - CANVAS_W * 0.34, 0, fbWorldW - CANVAS_W);
      } else {
        const cpuOpts: FootballPlayType[] = ['slant', 'mesh', 'verts', 'pa_post', 'double_corner', 'flood', 'out_and_up', 'sweep', 'inside_dive'];
        const chosenCpuPlay = cpuOpts[Math.floor(Math.random() * cpuOpts.length)];
        fb.cpuPlayCall = chosenCpuPlay;
        const cpuRoutes = buildOffRouteSet(chosenCpuPlay, losX, -1);
        fb.cpuSnapTimer = 1.15;
        fb.cpuThrowTimer = clamp(1.75 / fbDefSpeedMult, 0.95, 1.9);
        const cQbSpd = 135 + cQB.speed * 0.38;
        const cWrSpd = (148 + cWR.speed * 0.45) * fbDefSpeedMult;
        const cRbSpd = (152 + cRB.speed * 0.46) * fbDefSpeedMult;
        const myDefSpd = 176 + myFbProfile.speed * 0.56;
        fb.entities.push(
          { id: 'c_qb', team: 'cpu', role: 'qb', x: losX + 36, y: fbMidY, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: cQbSpd, jerseyNum: cQB.jersey },
          {
            id: 'c_wr1',
            team: 'cpu',
            role: 'wr1',
            x: losX + 6,
            y: fbTopY + 50,
            vx: 0,
            vy: 0,
            routeWaypoints: cpuRoutes.wr1,
            wpIdx: 0,
            speed: cWrSpd,
            jerseyNum: cWR.jersey,
          },
          {
            id: 'c_wr2',
            team: 'cpu',
            role: 'wr2',
            x: losX + 6,
            y: fbBotY - 50,
            vx: 0,
            vy: 0,
            routeWaypoints: cpuRoutes.wr2,
            wpIdx: 0,
            speed: cWrSpd,
            jerseyNum: '80',
          },
          {
            id: 'c_rb',
            team: 'cpu',
            role: 'rb',
            x: losX + 62,
            y: fbMidY - 34,
            vx: 0,
            vy: 0,
            routeWaypoints: cpuRoutes.rb,
            wpIdx: 0,
            speed: cRbSpd,
            jerseyNum: cRB.jersey,
          },
          { id: 'c_ol1', team: 'cpu', role: 'ol', x: losX + 8, y: fbMidY - 30, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 68, jerseyNum: '72' },
          { id: 'c_ol2', team: 'cpu', role: 'ol', x: losX + 8, y: fbMidY, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 68, jerseyNum: '64' },
          { id: 'c_ol3', team: 'cpu', role: 'ol', x: losX + 8, y: fbMidY + 30, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 68, jerseyNum: '76' },
          { id: 'user_def', team: 'player', role: 'user_def', x: clamp(losX - 78, fbEzLeftX - 40, fbEzRightX - 16), y: fbMidY, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: myDefSpd, jerseyNum: myFbProfile.jersey },
          { id: 'p_dl1', team: 'player', role: 'dl', x: clamp(losX - 16, fbEzLeftX - 35, fbEzRightX - 16), y: fbMidY - 26, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 148, jerseyNum: '99' },
          { id: 'p_dl2', team: 'player', role: 'dl', x: clamp(losX - 16, fbEzLeftX - 35, fbEzRightX - 16), y: fbMidY + 26, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 148, jerseyNum: '93' },
          { id: 'p_fs', team: 'player', role: 'lb', x: clamp(losX - 162, fbEzLeftX - 75, fbEzRightX - 16), y: fbMidY, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 162 + pLB.speed * 0.38, jerseyNum: pLB.jersey },
          { id: 'p_cb1', team: 'player', role: 'cb', x: clamp(losX - 84, fbEzLeftX - 65, fbEzRightX - 16), y: fbTopY + 54, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 158 + pCB.speed * 0.4, jerseyNum: pCB.jersey },
          { id: 'p_cb2', team: 'player', role: 'cb', x: clamp(losX - 84, fbEzLeftX - 65, fbEzRightX - 16), y: fbBotY - 54, vx: 0, vy: 0, routeWaypoints: [], wpIdx: 0, speed: 158 + pCB.speed * 0.4, jerseyNum: '25' }
        );
        alignPlayerDefensePreSnap();
        fb.carrierId = 'c_qb';
        fb.ballX = losX + 36;
        fb.ballY = fbMidY;
        fb.camX = clamp(losX - CANVAS_W * 0.64, 0, fbWorldW - CANVAS_W);
      }
    };
    setupFootballSnapFormation(true);

    // =========================================================================
    // 5. HEAVILY UPGRADED SOCCER: 3v3 / 5v5 + TOURNAMENT PITCH MATCH!
    // =========================================================================
    const isSoccerTourney = soccerMode === 'tournament';
    const soccerTourneyRound = SOCCER_TOURNAMENT_ROUNDS[Math.min(SOCCER_TOURNAMENT_ROUNDS.length - 1, soccerRoundIdx)];
    const socN = isSoccerTourney ? 5 : soccerTeamSize;
    const socCpuSpeedScale = isSoccerTourney ? soccerTourneyRound.cpuSpeedMult : 1.0;
    const socKeeperSpeed = isSoccerTourney ? soccerTourneyRound.keeperSpeed : 82;

    const socLeft = 42;
    const socRight = CANVAS_W - 42;
    const socTop = 42;
    const socBot = CANVAS_H - 42;
    const socMidX = (socLeft + socRight) * 0.5;
    const socMidY = (socTop + socBot) * 0.5;
    const goalSpanHalf = 64;

    interface SocPlayer {
      id: string;
      team: 'player' | 'cpu';
      isUser: boolean;
      x: number;
      y: number;
      vx: number;
      vy: number;
      faceX: number;
      faceY: number;
      baseY: number;
      roleBiasX: number;
      tackleCooldown: number;
      shootCooldown: number;
      skillTimer: number;
      stunTimer: number;
      animTime: number;
      jerseyNum: string;
      seed: number;
    }

    const socPlayers: SocPlayer[] = [];
    const resetSoccerKickoff = (kickoffTeam: 'player' | 'cpu') => {
      socPlayers.length = 0;
      const pLayout =
        socN === 5
          ? [
              { dx: kickoffTeam === 'player' ? -24 : -84, y: socMidY, biasX: 110, num: '10' },
              { dx: -102, y: socMidY - 122, biasX: 70, num: '7' },
              { dx: -102, y: socMidY + 122, biasX: 70, num: '9' },
              { dx: -176, y: socMidY - 56, biasX: -35, num: '8' },
              { dx: -232, y: socMidY + 58, biasX: -125, num: '4' },
            ]
          : [
              { dx: kickoffTeam === 'player' ? -26 : -92, y: socMidY, biasX: 90, num: '10' },
              { dx: -140, y: socMidY - 105, biasX: 35, num: '7' },
              { dx: -140, y: socMidY + 105, biasX: -20, num: '9' },
            ];
      const cLayout =
        socN === 5
          ? [
              { dx: kickoffTeam === 'cpu' ? 24 : 84, y: socMidY, biasX: -110, num: '9' },
              { dx: 102, y: socMidY - 122, biasX: -70, num: '11' },
              { dx: 102, y: socMidY + 122, biasX: -70, num: '7' },
              { dx: 176, y: socMidY - 56, biasX: 35, num: '6' },
              { dx: 232, y: socMidY + 58, biasX: 125, num: '5' },
            ]
          : [
              { dx: kickoffTeam === 'cpu' ? 26 : 92, y: socMidY, biasX: -90, num: '11' },
              { dx: 140, y: socMidY - 105, biasX: -35, num: '8' },
              { dx: 140, y: socMidY + 105, biasX: 20, num: '4' },
            ];

      pLayout.forEach((slot, i) => {
        socPlayers.push({
          id: `sp_${i}`,
          team: 'player',
          isUser: i === 0,
          x: clamp(socMidX + slot.dx, socLeft + 34, socRight - 34),
          y: slot.y,
          vx: 0,
          vy: 0,
          faceX: 1,
          faceY: 0,
          baseY: slot.y,
          roleBiasX: slot.biasX,
          tackleCooldown: 0,
          shootCooldown: 0,
          skillTimer: 0,
          stunTimer: 0,
          animTime: i * 0.6,
          jerseyNum: slot.num,
          seed: i + 2,
        });
      });

      cLayout.forEach((slot, i) => {
        socPlayers.push({
          id: `sc_${i}`,
          team: 'cpu',
          isUser: false,
          x: clamp(socMidX + slot.dx, socLeft + 34, socRight - 34),
          y: slot.y,
          vx: 0,
          vy: 0,
          faceX: -1,
          faceY: 0,
          baseY: slot.y,
          roleBiasX: slot.biasX,
          tackleCooldown: 0,
          shootCooldown: 0,
          skillTimer: 0,
          stunTimer: 0,
          animTime: i * 0.8,
          jerseyNum: slot.num,
          seed: i + 11,
        });
      });
    };
    resetSoccerKickoff('player');

    const soccer = {
      timeLeft: isSoccerTourney ? 75 : 85,
      playerGoals: 0,
      cpuGoals: 0,
      ballX: socMidX,
      ballY: socMidY,
      ballVx: 0,
      ballVy: 0,
      ballSpin: 0,
      ownerId: 'sp_0' as string | null,
      keeperLeftY: socMidY,
      keeperRightY: socMidY,
      keeperLeftCooldown: 0,
      keeperRightCooldown: 0,
      shotCharging: false,
      shotCharge: 0,
      shotGreenStart: 0.56,
      shotGreenWidth: 0.24,
      shotDifficultyLabel: 'OPEN',
      netRippleTimer: 0,
      bannerTimer: isSoccerTourney ? 1.6 : 0,
      bannerText: isSoccerTourney ? `RD ${soccerTourneyRound.round}: ${soccerTourneyRound.opponent}` : '',
      goalPauseTimer: 0,
      statusText: isSoccerTourney
        ? `5v5 TOURNAMENT RD ${soccerTourneyRound.round}/3 vs ${soccerTourneyRound.opponent} · [E] Pass · Hold [SPACE] Green-Shot!`
        : `${socN}v${socN} Arcade Pitch! Arrows Dribble · [E] Pass · Hold [SPACE] Shot Meter / Tackle!`,
      finished: false,
    };

    const computeSoccerShotWindow = (shooter: SocPlayer) => {
      const dist = Math.hypot(socRight - shooter.x, socMidY - shooter.y);
      let nearestDefDist = 999;
      let nearestDefStunned = false;
      for (const other of socPlayers) {
        if (other.team === shooter.team) continue;
        const d = Math.hypot(other.x - shooter.x, other.y - shooter.y);
        if (d < nearestDefDist) {
          nearestDefDist = d;
          nearestDefStunned = other.stunTimer > 0;
        }
      }
      const inBox = shooter.x > socRight - 135 && Math.abs(shooter.y - socMidY) < 118;
      const isLongBomb = dist > 265;
      let greenWidth = isLongBomb ? 0.11 : inBox ? 0.34 : clamp(0.27 - (dist - 120) / 1100, 0.14, 0.3);
      if (isSoccerTourney) greenWidth *= 0.92;
      if (!nearestDefStunned) {
        if (nearestDefDist < 36) greenWidth *= 0.58;
        else if (nearestDefDist < 66) greenWidth *= 0.8;
      } else {
        greenWidth += 0.05;
      }
      greenWidth = clamp(greenWidth, 0.075, 0.36);
      const greenCenter = isLongBomb ? 0.82 : inBox ? 0.62 : 0.68;
      const greenStart = clamp(greenCenter - greenWidth * 0.5, 0.42, 0.93 - greenWidth);
      const rangeTag = isLongBomb ? 'LONG SHOT' : inBox ? 'IN THE BOX' : 'MID RANGE';
      const contestTag = nearestDefStunned
        ? 'ANKLES BROKEN!'
        : nearestDefDist < 36
        ? 'PRESSED!'
        : nearestDefDist < 66
        ? 'CONTESTED'
        : 'WIDE OPEN';
      return {
        greenStart,
        greenWidth,
        inBox,
        isLongBomb,
        label: `${rangeTag} · ${contestTag}`,
      };
    };

    // =========================================================================
    // 6. PRO HARDCORE BOWLING REMAKE (Oil Pattern, Gutters, Hook + Power, True Rules!)
    // =========================================================================
    interface BowlPin {
      id: number;
      row: number;
      col: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      down: boolean;
      rot: number;
      rotVel: number;
      wobble: number;
    }
    interface BowlFrameRecord {
      r1: number | null;
      r2: number | null;
      r3?: number | null;
      total: number | null;
      isSplit: boolean;
    }
    const buildBowlingPins = (): BowlPin[] => {
      const pins: BowlPin[] = [];
      const headX = CANVAS_W * 0.5;
      const headY = 172;
      const rowGap = 20;
      const colGap = 25;
      let id = 1;
      for (let row = 0; row < 4; row++) {
        for (let c = 0; c <= row; c++) {
          pins.push({
            id: id++,
            row,
            col: c,
            x: headX + (c - row * 0.5) * colGap,
            y: headY - row * rowGap,
            vx: 0,
            vy: 0,
            down: false,
            rot: 0,
            rotVel: 0,
            wobble: 0,
          });
        }
      }
      return pins;
    };
    const laneLeftAtY = (y: number) => {
      const t = clamp((y - 78) / (CANVAS_H - 18 - 78), 0, 1);
      return 326 + (266 - 326) * t;
    };
    const laneRightAtY = (y: number) => {
      const t = clamp((y - 78) / (CANVAS_H - 18 - 78), 0, 1);
      return 474 + (534 - 474) * t;
    };
    const computeBowlingScore = (
      frames: BowlFrameRecord[]
    ): { totalScore: number; frameTotals: (number | null)[] } => {
      const rolls: number[] = [];
      const frameStartIdx: number[] = [];
      for (let f = 0; f < frames.length; f++) {
        const fr = frames[f];
        if (fr.r1 === null) {
          frameStartIdx.push(-1);
          continue;
        }
        frameStartIdx.push(rolls.length);
        rolls.push(fr.r1);
        if (fr.r2 !== null) rolls.push(fr.r2);
        if (fr.r3 !== undefined && fr.r3 !== null) rolls.push(fr.r3);
      }
      let running = 0;
      const frameTotals: (number | null)[] = frames.map(() => null);
      for (let f = 0; f < frames.length; f++) {
        const idx = frameStartIdx[f];
        const fr = frames[f];
        if (idx < 0 || fr.r1 === null) break;
        const isLast = f === frames.length - 1;
        if (isLast) {
          if (fr.r1 === 10) {
            if (fr.r2 !== null && fr.r3 !== undefined && fr.r3 !== null) {
              running += 10 + fr.r2 + fr.r3;
              frameTotals[f] = running;
            }
          } else if (fr.r2 !== null && fr.r1 + fr.r2 === 10) {
            if (fr.r3 !== undefined && fr.r3 !== null) {
              running += 10 + fr.r3;
              frameTotals[f] = running;
            }
          } else if (fr.r2 !== null) {
            running += fr.r1 + fr.r2;
            frameTotals[f] = running;
          }
        } else if (fr.r1 === 10) {
          if (idx + 2 < rolls.length) {
            running += 10 + rolls[idx + 1] + rolls[idx + 2];
            frameTotals[f] = running;
          }
        } else if (fr.r2 !== null) {
          if (fr.r1 + fr.r2 === 10) {
            if (idx + 2 < rolls.length) {
              running += 10 + rolls[idx + 2];
              frameTotals[f] = running;
            }
          } else {
            running += fr.r1 + fr.r2;
            frameTotals[f] = running;
          }
        }
      }
      // Show live partial total even while bonus roll is pending
      let fallbackSum = 0;
      for (const fr of frames) {
        fallbackSum += (fr.r1 ?? 0) + (fr.r2 ?? 0) + (fr.r3 ?? 0);
      }
      const lastComputed = [...frameTotals].reverse().find((v) => v !== null);
      return { totalScore: Math.max(lastComputed ?? 0, fallbackSum), frameTotals };
    };
    const isSplitLeave = (pins: BowlPin[]): boolean => {
      const standing = pins.filter((p) => !p.down);
      if (standing.length < 2 || standing.length > 5) return false;
      const headUp = standing.some((p) => p.id === 1);
      if (headUp) return false;
      // Wide lateral spread across non-adjacent pins
      const xs = standing.map((p) => p.x);
      return Math.max(...xs) - Math.min(...xs) >= 50;
    };

    const MAX_BOWL_FRAMES = 6;
    const bowling = {
      frame: 1,
      maxFrames: MAX_BOWL_FRAMES,
      rollInFrame: 1 as 1 | 2 | 3,
      score: 0,
      strikeStreak: 0,
      standingBeforeRoll: 10,
      frames: Array.from({ length: MAX_BOWL_FRAMES }, () => ({
        r1: null,
        r2: null,
        r3: null,
        total: null,
        isSplit: false,
      })) as BowlFrameRecord[],
      pins: buildBowlingPins(),
      phase: 'align' as 'align' | 'hook' | 'power' | 'rolling' | 'settle',
      ballX: CANVAS_W * 0.5 + 16,
      ballY: 458,
      ballVx: 0,
      ballVy: 0,
      ballRot: 0,
      launchAngle: 0,
      hookOsc: 0,
      hookDir: 1,
      powerOsc: 0.45,
      powerDir: 1,
      hookSpin: 0,
      ballPower: 0.75,
      inGutter: false,
      ballTrail: [] as { x: number; y: number }[],
      oilBreakY: 252,
      laneOilOffset: (Math.random() - 0.5) * 26, // subtle lane house pattern drift!
      settleTimer: 0,
      sweeperProgress: 0,
      bannerText: '',
      bannerTimer: 0,
      statusText: 'F1/6 · [←/→] Position · [↑/↓] Angle · [SPACE] Lock Stance!',
      finished: false,
    };

    // =========================================================================
    // 7. RETRO LAKEFRONT / CHESAPEAKE FISHING
    // =========================================================================
    const FISH_SPECIES = [
      { name: 'Maryland Blue Crab', icon: '🦀', cash: 750, speed: 105, color: '#38bdf8' },
      { name: 'Seneca Largemouth Bass', icon: '🐟', cash: 1100, speed: 145, color: '#4ade80' },
      { name: 'Chesapeake Rockfish', icon: '🐠', cash: 1650, speed: 185, color: '#facc15' },
      { name: 'Golden Trophy Muskie', icon: '🐡', cash: 2400, speed: 225, color: '#fb7185' },
    ];
    const fishing = {
      castsDone: 0,
      maxCasts: 4,
      totalCash: 0,
      catches: [] as string[],
      phase: 'ready' as 'ready' | 'waiting' | 'bite' | 'reel' | 'result',
      bobberX: CANVAS_W * 0.5,
      bobberY: 225,
      waitTimer: 1.5,
      biteWindow: 0,
      fishPos: 0.5,
      fishVel: 0.25,
      fishIdx: 0,
      barPos: 0.45,
      barVel: 0,
      barHeight: 0.24,
      catchProgress: 0.35,
      resultTimer: 0,
      statusText: 'Cast 1/4 · Arrows Aim · Press [SPACE] to Cast Line!',
      finished: false,
    };

    // Sync HUD throttle
    let hudSyncAccum = 0;
    let tourneyResultRecorded = false;
    let seasonResultRecorded = false;
    let myPlayerGrowthRecorded = false;
    const syncHud = (force = false) => {
      if (!force && hudSyncAccum < 0.08) return;
      hudSyncAccum = 0;

      if (sport === 'basketball') {
        const won = bb.scorePlayer >= bb.scoreCpu;
        const cash = bb.finished
          ? isTourney
            ? won
              ? tourneyRound.prize
              : 550 + bb.scorePlayer * 60
            : isBballSeason && bballSeasonMatch
            ? bballSeasonPlayable
              ? won
                ? bballSeasonMatch.prizeCash
                : 700 + bb.scorePlayer * 70
              : 0
            : Math.round((won ? 1900 : 650) + bb.scorePlayer * 110 + teamN * 180)
          : 0;
        if (bb.finished && isTourney && !tourneyResultRecorded) {
          tourneyResultRecorded = true;
          const idx = Math.min(TOURNAMENT_ROUNDS.length - 1, tournamentRoundIdx);
          setBballBracketResults((prev) => {
            const next = [...prev];
            next[idx] = { userScore: bb.scorePlayer, cpuScore: bb.scoreCpu, won };
            return next;
          });
        }
        if (bb.finished && isBballSeason && bballSeasonPlayable && !seasonResultRecorded) {
          seasonResultRecorded = true;
          const gameBoxStats: BballGamePlayerStatInput[] = bbPlayers.map((pl) => ({
            position: pl.position,
            team: pl.team,
            pts: pl.pts,
            reb: pl.reb,
            ast: pl.ast,
            stl: pl.stl,
            blk: pl.blk,
            fgm: pl.fgm,
            fga: pl.fga,
            tpm: pl.tpm,
            tpa: pl.tpa,
          }));
          const updated = recordPlayerSeasonMatchResult('basketball', bb.scorePlayer, bb.scoreCpu, gameBoxStats);
          setBballSeason(updated);
        }
        if (bb.finished && !myPlayerGrowthRecorded && (bb.timeLeft < 59.5 || bb.scorePlayer > 0 || bb.scoreCpu > 0)) {
          myPlayerGrowthRecorded = true;
          const userEnt = bbPlayers[0];
          const res = recordMyPlayerPerformance('basketball', {
            won,
            pointDiff: bb.scorePlayer - bb.scoreCpu,
            pts: userEnt.pts,
            reb: userEnt.reb,
            ast: userEnt.ast,
            stl: userEnt.stl,
            blk: userEnt.blk,
            fgm: userEnt.fgm,
            fga: userEnt.fga,
          });
          setBballSeason(res.season);
          setLastMyPlayerGain(res.gain);
        }
        if (bb.finished && force) {
          setLastBballBoxScore(
            bbPlayers.map((pl) => ({
              id: pl.id,
              name: pl.name,
              pos: pl.position,
              team: pl.team,
              pts: pl.pts,
              reb: pl.reb,
              ast: pl.ast,
              stl: pl.stl,
              blk: pl.blk,
              fgm: pl.fgm,
              fga: pl.fga,
              tpm: pl.tpm,
              tpa: pl.tpa,
              isUser: pl.isUser,
            }))
          );
        }
        const userEnt = bbPlayers[0];
        setHud({
          title: isTourney
            ? `🏆 5v5 TOURNAMENT · RD ${tourneyRound.round}/${TOURNAMENT_ROUNDS.length} vs ${tourneyRound.opponent}`
            : isBballSeason && bballSeasonMatch
            ? `🏟️ SEASON ${liveBballSeason?.seasonNumber} · ${bballSeasonMatch.roundLabel} vs #${bballSeasonMatch.opponentSeed} ${bballSeasonMatch.opponentName}`
            : `${venueRef.current.name} · ${isHalfCourt ? 'HALF COURT' : 'FULL COURT'} ${teamN}v${teamN}`,
          scoreLeftLabel: isBballSeason && bballSeasonMatch ? `YOU (#${bballSeasonMatch.playerSeed})` : 'HOME',
          scoreLeftValue: String(bb.scorePlayer),
          scoreRightLabel: isTourney
            ? 'TOURNEY CPU'
            : isBballSeason && bballSeasonMatch
            ? `${bballSeasonMatch.opponentShort} (#${bballSeasonMatch.opponentSeed})`
            : 'AWAY',
          scoreRightValue: String(bb.scoreCpu),
          clockOrRoundLabel: 'CLOCK / SC',
          clockOrRoundValue: `${formatClockMMSS(bb.timeLeft)} · ${Math.ceil(bb.shotClock)}`,
          statusLine: bb.statusText,
          actionHint: `[${userEnt.position} · ${userEnt.pts}P ${userEnt.reb}R ${userEnt.ast}A ${userEnt.blk}B ${userEnt.stl}S] · ${
            bb.possession === 'player'
              ? teamN > 1
                ? 'Arrows Move & Cut · [Q] Screen · [E] Pass · Hold [SPACE] Shoot/Dunk!'
                : 'Arrows Move & Cut · Hold [SPACE] Shoot/Dunk!'
              : 'Arrows Body-Up · [SPACE] Jump Block / Steal!'
          }`,
          finished: bb.finished,
          won,
          cashEarned: cash,
          summaryBanner: isTourney
            ? `🏆 TOURNAMENT RD ${tourneyRound.round} (${bb.scorePlayer}-${bb.scoreCpu}): +$${cash.toLocaleString()}`
            : isBballSeason && bballSeasonMatch
            ? `🏟️ S${liveBballSeason?.seasonNumber} ${bballSeasonMatch.roundLabel} vs ${bballSeasonMatch.opponentName} (${bb.scorePlayer}-${bb.scoreCpu}): +$${cash.toLocaleString()}`
            : `🏀 BASKETBALL (${teamN}v${teamN} ${isHalfCourt ? 'HALF' : 'FULL'}): ${bb.scorePlayer}-${bb.scoreCpu} · +$${cash.toLocaleString()}`,
          tournamentRound: isTourney ? tourneyRound.round : undefined,
          tournamentTitle: isTourney ? tourneyRound.opponent : undefined,
        });
      } else if (sport === 'golf') {
        const curHole = GOLF_HOLES[golf.holeIdx];
        const totalWithCur = golf.totalStrokes + golf.strokes;
        const parSoFar = golf.totalPar + curHole.par;
        const diff = totalWithCur - parSoFar;
        const diffStr = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
        const won = golf.finished && totalWithCur <= GOLF_HOLES.reduce((s, h) => s + h.par, 0) + 2;
        const cash = golf.finished ? clamp(4800 - Math.max(-4, diff) * 560, 850, 6200) : 0;
        setHud({
          title: `${curHole.name} (PRO LINKS)`,
          scoreLeftLabel: 'STROKES',
          scoreLeftValue: String(golf.strokes),
          scoreRightLabel: 'TOTAL',
          scoreRightValue: `${totalWithCur} (${diffStr})`,
          clockOrRoundLabel: 'HOLE',
          clockOrRoundValue: `${golf.holeIdx + 1}/${GOLF_HOLES.length}`,
          statusLine: golf.statusText,
          actionHint: `Club: ${GOLF_CLUBS[golfClubIdxRef.current].name} · Wind ${Math.round(Math.hypot(curHole.windX, curHole.windY))}mph · [←/→] Aim · [↑/↓] Club · Hold [SPACE] Hit`,
          finished: golf.finished,
          won,
          cashEarned: cash,
          summaryBanner: `⛳ PRO 3D LINKS GOLF: Finished ${totalWithCur} (${diffStr}) · +$${cash.toLocaleString()}`,
        });
      } else if (sport === 'baseball') {
        const won = baseball.runs > baseball.cpuRuns;
        const cash = baseball.finished
          ? isBaseballTourney
            ? won
              ? baseballTourneyRound.prize
              : 650 + baseball.runs * 180 + baseball.hits * 90
            : Math.max(700, (won ? 1950 : 750) + baseball.runs * 580 + baseball.hits * 190 + baseball.hrs * 450)
          : 0;
        if (baseball.finished && isBaseballTourney && !tourneyResultRecorded) {
          tourneyResultRecorded = true;
          const idx = Math.min(2, baseballRoundIdx);
          setBaseballBracketResults((prev) => {
            const next = [...prev];
            next[idx] = { userScore: baseball.runs, cpuScore: baseball.cpuRuns, won };
            return next;
          });
        }
        setHud({
          title: isBaseballTourney
            ? `🏆 BASEBALL TOURNAMENT · RD ${baseballTourneyRound.round}/3 vs ${baseballTourneyRound.opponent}`
            : `${venueRef.current.name} · PRO 3-INNING DUEL`,
          scoreLeftLabel: 'YOU / CPU',
          scoreLeftValue: `${baseball.runs} - ${baseball.cpuRuns}`,
          scoreRightLabel: 'INN / OUT',
          scoreRightValue: `I${baseball.inning}/${baseball.maxInnings} · ${baseball.outs}O`,
          clockOrRoundLabel: 'COUNT',
          clockOrRoundValue: `${baseball.balls}B-${baseball.strikes}S`,
          statusLine: baseball.statusText,
          actionHint: 'Arrow Keys Aim Sweet Spot · Press [SPACE] to Swing!',
          finished: baseball.finished,
          won,
          cashEarned: cash,
          summaryBanner: isBaseballTourney
            ? `⚾ TOURNAMENT RD ${baseballTourneyRound.round} (${baseball.runs}-${baseball.cpuRuns}, ${baseball.hrs} HR): +$${cash.toLocaleString()}`
            : `⚾ BASEBALL DUEL: YOU ${baseball.runs} - CPU ${baseball.cpuRuns} (${baseball.hrs} HR) · +$${cash.toLocaleString()}`,
          tournamentRound: isBaseballTourney ? baseballTourneyRound.round : undefined,
          tournamentTitle: isBaseballTourney ? baseballTourneyRound.opponent : undefined,
        });
      } else if (sport === 'football') {
        const isFbNoTie = isFootballTourney || Boolean(isFootballSeason && fbSeasonMatch?.isPlayoff);
        const won = isFbNoTie ? fb.scorePlayer > fb.scoreCpu : fb.scorePlayer >= fb.scoreCpu;
        const cash = fb.finished
          ? isFootballTourney
            ? won
              ? footballTourneyRound.prize
              : 750 + fb.tds * 400
            : isFootballSeason && fbSeasonMatch
            ? fbSeasonPlayable
              ? won
                ? fbSeasonMatch.prizeCash
                : 850 + fb.tds * 450
              : 0
            : Math.max(850, (won ? 2400 : 850) + fb.tds * 1200 + fb.scorePlayer * 75)
          : 0;
        if (fb.finished && isFootballTourney && !tourneyResultRecorded) {
          tourneyResultRecorded = true;
          const idx = Math.min(2, footballRoundIdx);
          setFootballBracketResults((prev) => {
            const next = [...prev];
            next[idx] = { userScore: fb.scorePlayer, cpuScore: fb.scoreCpu, won };
            return next;
          });
        }
        if (fb.finished && isFootballSeason && fbSeasonPlayable && !seasonResultRecorded) {
          seasonResultRecorded = true;
          const fbBoxInputs: FbGamePlayerStatInput[] = fbMatchStats.map((r) => ({
            position: r.pos,
            team: r.team,
            passYds: r.passYds,
            passTd: r.passTd,
            ints: r.ints,
            rushYds: r.rushYds,
            rushTd: r.rushTd,
            rec: r.rec,
            recYds: r.recYds,
            recTd: r.recTd,
            tackles: r.tackles,
            sacks: r.sacks,
            defInt: r.defInt,
          }));
          const updated = recordPlayerSeasonMatchResult('football', fb.scorePlayer, fb.scoreCpu, undefined, fbBoxInputs);
          setFootballSeason(updated);
        }
        const fbStartTime = isFootballTourney || isFootballSeason ? 90 : 100;
        if (fb.finished && !myPlayerGrowthRecorded && (fb.timeLeft < fbStartTime - 0.5 || fb.scorePlayer > 0 || fb.scoreCpu > 0)) {
          myPlayerGrowthRecorded = true;
          const myStat = fbMatchStats.find((r) => r.team === 'player' && r.pos === activeFbPos);
          const teamPassYds = fbMatchStats.filter((r) => r.team === 'player').reduce((s, r) => s + r.passYds, 0);
          const res = recordMyPlayerPerformance('football', {
            won,
            pointDiff: fb.scorePlayer - fb.scoreCpu,
            passYds: myStat?.passYds || Math.round(teamPassYds * 0.35),
            passTd: myStat?.passTd || 0,
            ints: myStat?.ints || 0,
            rushYds: myStat?.rushYds || 0,
            rushTd: myStat?.rushTd || 0,
            rec: myStat?.rec || 0,
            recYds: myStat?.recYds || 0,
            recTd: myStat?.recTd || 0,
            tackles: myStat?.tackles || 0,
            sacks: myStat?.sacks || 0,
            defInt: myStat?.defInt || 0,
            tds: fb.tds,
          });
          setFootballSeason(res.season);
          setLastMyPlayerGain(res.gain);
        }
        if (fb.finished && force) {
          setLastFbBoxScore(fbMatchStats.map((r) => ({ ...r })));
        }
        if (fbSideRef.current !== fb.possession) {
          fbSideRef.current = fb.possession;
          setFbSide(fb.possession);
        }
        const ydsToGo =
          fb.possession === 'player'
            ? Math.max(1, fb.firstDownYard - fb.losYard)
            : Math.max(1, fb.losYard - fb.firstDownYard);
        const sideTag = fb.possession === 'player' ? 'OFF' : 'DEF';
        const goalDist = fb.possession === 'player' ? fb.losYard + ydsToGo >= 100 : fb.losYard - ydsToGo <= 0;
        setHud({
          title: isFootballTourney
            ? `🏆 RETRO GRIDIRON TOURNEY · RD ${footballTourneyRound.round}/3 vs ${footballTourneyRound.opponent}`
            : isFootballSeason && fbSeasonMatch
            ? `🏟️ SEASON ${liveFbSeason?.seasonNumber} · ${fbSeasonMatch.roundLabel} vs #${fbSeasonMatch.opponentSeed} ${fbSeasonMatch.opponentName}`
            : `${venueRef.current.name} · ${activeFbPos} (${myFbProfile.ovr} OVR)`,
          scoreLeftLabel: isFootballSeason && fbSeasonMatch ? `YOU (#${fbSeasonMatch.playerSeed})` : 'YOU',
          scoreLeftValue: String(fb.scorePlayer),
          scoreRightLabel: isFootballTourney
            ? 'TOURNEY CPU'
            : isFootballSeason && fbSeasonMatch
            ? `${fbSeasonMatch.opponentShort} (#${fbSeasonMatch.opponentSeed})`
            : 'CPU',
          scoreRightValue: String(fb.scoreCpu),
          clockOrRoundLabel: `${sideTag} · DOWN`,
          clockOrRoundValue: `${fb.down}&${goalDist ? 'GL' : ydsToGo} · ${formatClockMMSS(fb.timeLeft)}`,
          statusLine: fb.statusText,
          actionHint:
            fb.possession === 'cpu'
              ? `PLAY DEFENSE (${activeFbPos} #${myFbProfile.jersey})! Arrow Keys Cover/Blitz · [SPACE] Dive Tackle / Pick!`
              : fb.phase === 'huddle'
              ? `MYPLAYER ${activeFbPos} (${myFbProfile.ovr}/${myFbProfile.potential ?? 94}) · [SPACE] Snap · [←/→] Audible!`
              : fb.phase === 'live_pass' && fb.carrierId === 'qb'
              ? 'Arrows Scramble · [1] Pass WR1 · [2] Pass WR2 · [3] RB · [SPACE] Spin/Throw!'
              : 'Arrow Keys Sprint RIGHT · Press [SPACE] Spin Move!',
          finished: fb.finished,
          won,
          cashEarned: cash,
          summaryBanner: isFootballTourney
            ? `🏈 TOURNAMENT RD ${footballTourneyRound.round} (${fb.scorePlayer}-${fb.scoreCpu}): +$${cash.toLocaleString()}`
            : isFootballSeason && fbSeasonMatch
            ? `🏟️ S${liveFbSeason?.seasonNumber} ${fbSeasonMatch.roundLabel} vs ${fbSeasonMatch.opponentName} (${fb.scorePlayer}-${fb.scoreCpu}): +$${cash.toLocaleString()}`
            : `🏈 RETRO GRIDIRON (${activeFbPos}): ${fb.scorePlayer}-${fb.scoreCpu} (${fb.tds} TDs) · +$${cash.toLocaleString()}`,
          tournamentRound: isFootballTourney ? footballTourneyRound.round : undefined,
          tournamentTitle: isFootballTourney ? footballTourneyRound.opponent : undefined,
        });
      } else if (sport === 'soccer') {
        const won = isSoccerTourney ? soccer.playerGoals > soccer.cpuGoals : soccer.playerGoals >= soccer.cpuGoals;
        const cash = soccer.finished
          ? isSoccerTourney
            ? won
              ? soccerTourneyRound.prize
              : 650 + soccer.playerGoals * 350
            : (won ? 2400 : 800) + soccer.playerGoals * 650
          : 0;
        if (soccer.finished && isSoccerTourney && !tourneyResultRecorded) {
          tourneyResultRecorded = true;
          const idx = Math.min(2, soccerRoundIdx);
          setSoccerBracketResults((prev) => {
            const next = [...prev];
            next[idx] = { userScore: soccer.playerGoals, cpuScore: soccer.cpuGoals, won };
            return next;
          });
        }
        setHud({
          title: isSoccerTourney
            ? `🏆 5v5 SOCCER TOURNEY · RD ${soccerTourneyRound.round}/3 vs ${soccerTourneyRound.opponent}`
            : `${venueRef.current.name} · ${socN}v${socN} RETRO TURF MATCH`,
          scoreLeftLabel: 'HOME',
          scoreLeftValue: String(soccer.playerGoals),
          scoreRightLabel: isSoccerTourney ? 'TOURNEY CPU' : 'AWAY',
          scoreRightValue: String(soccer.cpuGoals),
          clockOrRoundLabel: 'CLOCK',
          clockOrRoundValue: `${Math.max(0, soccer.timeLeft).toFixed(1)}s`,
          statusLine: soccer.statusText,
          actionHint: 'Arrows Dribble · [E] Pass / Call Return · Hold [SPACE] Shoot / Tap Slide Tackle!',
          finished: soccer.finished,
          won,
          cashEarned: cash,
          summaryBanner: isSoccerTourney
            ? `⚽ 5v5 TOURNAMENT RD ${soccerTourneyRound.round} (${soccer.playerGoals}-${soccer.cpuGoals}): +$${cash.toLocaleString()}`
            : `⚽ ${socN}v${socN} SOCCER: ${soccer.playerGoals}-${soccer.cpuGoals} · +$${cash.toLocaleString()}`,
          tournamentRound: isSoccerTourney ? soccerTourneyRound.round : undefined,
          tournamentTitle: isSoccerTourney ? soccerTourneyRound.opponent : undefined,
        });
      } else if (sport === 'bowling') {
        const won = bowling.score >= 82;
        const cash = bowling.finished
          ? won
            ? 2400 + Math.round(bowling.score * 24)
            : Math.max(650, 450 + bowling.score * 16)
          : 0;
        setHud({
          title: `${venueRef.current.name} · PRO OIL LANES (TARGET: 82+)`,
          scoreLeftLabel: 'SCORE',
          scoreLeftValue: String(bowling.score),
          scoreRightLabel: 'ROLL',
          scoreRightValue: `#${bowling.rollInFrame}`,
          clockOrRoundLabel: 'FRAME',
          clockOrRoundValue: `${Math.min(bowling.frame, bowling.maxFrames)}/${bowling.maxFrames}`,
          statusLine: bowling.statusText,
          actionHint: '[←/→] Slide · [↑/↓] Aim · [SPACE] Lock Stance → Hook Spin → Power Pocket!',
          finished: bowling.finished,
          won,
          cashEarned: cash,
          summaryBanner: `🎳 PRO BOWLING: ${bowling.score} pts (Target 82+) · +$${cash.toLocaleString()}`,
        });
      } else {
        const won = fishing.catches.length >= 2;
        const cash = fishing.finished ? Math.max(500, fishing.totalCash) : 0;
        setHud({
          title: `${venueRef.current.name} · PIER ANGLING`,
          scoreLeftLabel: 'CAUGHT',
          scoreLeftValue: `${fishing.catches.length}/${fishing.maxCasts}`,
          scoreRightLabel: 'VALUE',
          scoreRightValue: `$${fishing.totalCash.toLocaleString()}`,
          clockOrRoundLabel: 'CAST',
          clockOrRoundValue: `${Math.min(fishing.castsDone + 1, fishing.maxCasts)}/${fishing.maxCasts}`,
          statusLine: fishing.statusText,
          actionHint: 'Arrow Keys Aim Bobber · [SPACE] Cast / Hook Bite / Hold to Reel!',
          finished: fishing.finished,
          won,
          cashEarned: cash,
          summaryBanner: `🎣 PIER FISHING: Landed ${fishing.catches.length} fish · +$${cash.toLocaleString()}`,
        });
      }
    };

    syncHud(true);

    const getFootballWrSeparation = (wr: FbEntity | undefined) =>
      wr
        ? Math.min(
            ...fb.entities
              .filter((d) => d.team === 'cpu')
              .map((d) => Math.hypot(d.x - wr.x, d.y - wr.y))
          )
        : 0;

    const pickFootballTargetId = () => {
      if (keysRef.current.has('ArrowUp')) return 'wr1';
      if (keysRef.current.has('ArrowDown')) return 'wr2';
      const wr1 = fb.entities.find((e) => e.id === 'wr1');
      const wr2 = fb.entities.find((e) => e.id === 'wr2');
      const rb = fb.entities.find((e) => e.id === 'rb');
      const candidates = [
        { id: 'wr1', sep: getFootballWrSeparation(wr1) },
        { id: 'wr2', sep: getFootballWrSeparation(wr2) },
        { id: 'rb', sep: getFootballWrSeparation(rb) - 10 },
      ].sort((a, b) => b.sep - a.sep);
      return candidates[0]?.id || 'wr1';
    };

    const computeFootballPassWindow = (qb: FbEntity | undefined, targetWr: FbEntity | undefined) => {
      const sep = getFootballWrSeparation(targetWr);
      const nearRush = qb
        ? Math.min(...fb.entities.filter((d) => d.team === 'cpu').map((d) => Math.hypot(d.x - qb.x, d.y - qb.y)))
        : 999;
      const throwDist = qb && targetWr ? Math.hypot(targetWr.x - qb.x, targetWr.y - qb.y) : 140;
      const qbMoving = qb ? Math.hypot(qb.vx, qb.vy) > 85 : false;
      const qbAccEdge = ((pQB.throwAcc * 0.72 + myFbProfile.throwAcc * 0.28) - 72) * 0.0022;
      const recCatchEdge = targetWr?.id === 'rb' ? (pRB.catchStat - 75) * 0.0012 : (pWR.catchStat - 75) * 0.0014;

      // Green window scales directly with how OPEN the targeted receiver is + QB Accuracy!
      let greenWidth: number;
      let openLabel: string;
      if (sep >= 72) {
        greenWidth = 0.42;
        openLabel = 'WIDE OPEN!';
      } else if (sep >= 50) {
        greenWidth = 0.32;
        openLabel = 'OPEN';
      } else if (sep >= 32) {
        greenWidth = 0.20;
        openLabel = 'CONTESTED';
      } else {
        greenWidth = 0.10;
        openLabel = 'COVERED!';
      }
      greenWidth += qbAccEdge + recCatchEdge;
      if (throwDist > 290) greenWidth -= 0.03;
      if (nearRush < 38) greenWidth -= 0.04;
      if (qbMoving) greenWidth -= 0.025;
      if (isFootballTourney) greenWidth -= 0.02;
      greenWidth = clamp(greenWidth, 0.07, 0.48);

      const greenCenter = 0.56;
      const greenStart = clamp(greenCenter - greenWidth * 0.5, 0.28, 0.88 - greenWidth);
      return { greenStart, greenWidth, sep, openLabel };
    };

    const startFootballThrowMeter = (forcedTarget?: string) => {
      if (sport !== 'football' || fb.finished || fb.possession !== 'player' || fb.phase !== 'live_pass' || fb.carrierId !== 'qb') {
        return;
      }
      if (fb.throwCharging) return;
      const targetId = forcedTarget || pickFootballTargetId();
      const qb = fb.entities.find((e) => e.id === 'qb');
      const wr = fb.entities.find((e) => e.id === targetId);
      const win = computeFootballPassWindow(qb, wr);
      fb.throwCharging = true;
      fb.throwCharge = 0.16;
      fb.throwGreenWidth = win.greenWidth;
      fb.throwGreenStart = win.greenStart;
      fb.throwTargetId = targetId;
      fb.throwTargetLockedByKey = Boolean(forcedTarget);
      fb.statusText = `TARGET ${targetId.toUpperCase()} (${win.openLabel}) · RELEASE IN GREEN!`;
    };

    const predictFbRouteSpot = (
      wr: FbEntity,
      timeSec: number,
      attDir: number,
      strideLeadPx = 0
    ): { x: number; y: number; dirX: number; dirY: number } => {
      let cx = wr.x;
      let cy = wr.y;
      let dirX = attDir;
      let dirY = 0;
      const spd = Math.max(115, wr.speed);
      if (wr.routeWaypoints.length > 0 && wr.id !== fb.carrierId) {
        let distLeft = spd * timeSec;
        let idx = Math.min(wr.wpIdx, wr.routeWaypoints.length - 1);
        for (let step = idx; step < wr.routeWaypoints.length && distLeft > 0; step++) {
          const wp = wr.routeWaypoints[step];
          const dx = wp.x - cx;
          const dy = wp.y - cy;
          const seg = Math.hypot(dx, dy);
          if (seg > 1) {
            dirX = dx / seg;
            dirY = dy / seg;
          }
          if (seg <= distLeft) {
            cx = wp.x;
            cy = wp.y;
            distLeft -= seg;
          } else {
            cx += dirX * distLeft;
            cy += dirY * distLeft;
            distLeft = 0;
          }
        }
        // If receiver finishes all route waypoints before ball arrives, extrapolate stride downfield!
        if (distLeft > 0) {
          if (Math.abs(dirX) < 0.2) {
            dirX = attDir * 0.85;
            dirY = dirY * 0.5;
            const n = Math.hypot(dirX, dirY) || 1;
            dirX /= n;
            dirY /= n;
          }
          cx += dirX * distLeft;
          cy += dirY * distLeft;
        }
      } else {
        const vLen = Math.hypot(wr.vx, wr.vy);
        if (vLen > 8) {
          dirX = wr.vx / vLen;
          dirY = wr.vy / vLen;
        }
        cx += dirX * spd * timeSec * 0.8;
        cy += dirY * spd * timeSec * 0.8;
      }
      cx += dirX * strideLeadPx;
      cy += dirY * strideLeadPx;
      return {
        x: clamp(cx, fbEzLeftX - 96, fbEzRightX + 96),
        y: clamp(cy, fbTopY + 18, fbBotY - 18),
        dirX,
        dirY,
      };
    };

    const computeFbAnticipationPass = (
      qb: FbEntity,
      wr: FbEntity,
      passerTeam: 'player' | 'cpu',
      passerPow: number,
      isPerfect: boolean,
      missAmt: number
    ) => {
      const attDir = passerTeam === 'player' ? 1 : -1;
      const velScale = clamp(610 + (passerPow - 65) * 3.8, 550, 770);
      const roughGuess = predictFbRouteSpot(wr, 0.34, attDir, 0);
      const roughDist = Math.hypot(roughGuess.x - qb.x, roughGuess.y - qb.y);
      const dur = clamp(0.21 + roughDist / velScale, 0.22, 0.68);
      const leadPx = isPerfect ? 18 : missAmt < 0.14 ? 6 : -8;
      const pred = predictFbRouteSpot(wr, dur, attDir, leadPx);
      const scatterX = isPerfect ? 0 : (Math.random() - 0.5) * missAmt * 56;
      const scatterY = isPerfect ? 0 : (Math.random() - 0.5) * missAmt * 62;
      return {
        dur,
        targetX: clamp(pred.x + scatterX, fbEzLeftX - 98, fbEzRightX + 98),
        targetY: clamp(pred.y + scatterY, fbTopY + 18, fbBotY - 18),
        predX: pred.x,
        predY: pred.y,
      };
    };

    const throwFootballPass = (
      targetId: string,
      passerTeam: 'player' | 'cpu' = 'player',
      accuracy?: { inGreen: boolean; missAmt: number }
    ) => {
      if (sport !== 'football' || fb.phase !== 'live_pass') return;
      const qbId = passerTeam === 'player' ? 'qb' : 'c_qb';
      if (fb.carrierId !== qbId) return;
      const qb = fb.entities.find((e) => e.id === qbId);
      const wr = fb.entities.find((e) => e.id === targetId);
      if (!qb || !wr) return;
      fb.throwCharging = false;
      fb.throwTargetLockedByKey = false;
      fb.userPickRolled = false;
      const passerPow = passerTeam === 'player' ? pQB.throwPow * 0.72 + myFbProfile.throwPow * 0.28 : cQB.throwPow;
      const passerAcc = passerTeam === 'player' ? pQB.throwAcc * 0.72 + myFbProfile.throwAcc * 0.28 : cQB.throwAcc;
      const isPerfect =
        passerTeam === 'player'
          ? Boolean(accuracy?.inGreen)
          : Math.random() < clamp(0.5 + (passerAcc - 70) * 0.008, 0.44, 0.78);
      fb.lastThrowPerfect = isPerfect;
      const miss = passerTeam === 'player' ? (accuracy?.inGreen ? 0 : clamp(accuracy?.missAmt ?? 0.14, 0.04, 0.34)) : 0.09;
      const passPlan = computeFbAnticipationPass(qb, wr, passerTeam, passerPow, isPerfect, miss);
      fbPlayWasPass = true;
      fbPlayReceiverPos = wr.role === 'rb' ? 'RB' : 'WR';
      fb.phase = 'ball_in_air';
      fb.passStartX = qb.x;
      fb.passStartY = qb.y;
      fb.passTargetX = passPlan.targetX;
      fb.passTargetY = passPlan.targetY;
      fb.passTargetId = targetId;
      fb.passTeam = passerTeam;
      fb.passElapsed = 0;
      fb.passDuration = passPlan.dur;
      fb.statusText =
        passerTeam === 'player'
          ? isPerfect
            ? `IN-STRIDE DIME!! LEADING ${wr.role.toUpperCase()}!!`
            : miss > 0.2
            ? `OFF-TARGET THROW TO ${wr.role.toUpperCase()}!`
            : `PASS IN THE AIR TO ${wr.role.toUpperCase()}!`
          : 'CPU PASS IN THE AIR!! TIME [SPACE] DIVE TO PICK OR BREAK UP!';
      playRetroSportTone(
        passerTeam === 'player' ? (isPerfect ? 640 : 480) : 380,
        passerTeam === 'player' ? (isPerfect ? 980 : 660) : 620,
        0.14,
        'triangle',
        0.08
      );
    };

    const startBballDunkAnim = (
      dunker: BballPlayerEntity,
      targetHoop: { x: number; y: number },
      team: 'player' | 'cpu',
      willMake: boolean
    ) => {
      bb.carrierId = null;
      bb.shotCharging = false;
      bb.ballFlight = null;
      bb.dribbleBallTrail.length = 0;
      bb.isReboundLive = false;
      dunker.fga += 1;
      dunker.crossTimer = 0;
      dunker.tweenTimer = 0;
      dunker.vx = 0;
      dunker.vy = 0;
      dunker.faceX = targetHoop.x >= dunker.x ? 1 : -1;
      bb.dunkAnim = {
        playerId: dunker.id,
        team,
        startX: dunker.x,
        startY: dunker.y,
        rimX: targetHoop.x,
        rimY: targetHoop.y,
        elapsed: 0,
        duration: 0.34,
        hangTime: 0.18,
        slamFired: false,
        willMake,
        points: 2,
      };
      bb.statusText =
        team === 'player' ? 'TAKING FLIGHT FOR THE TOMAHAWK SLAM!!' : 'CPU DRIVES FOR THE SLAM!!';
      playRetroSportTone(540, 1020, 0.16, 'square', 0.09);
    };

    const launchBballTeammateShot = (shooter: BballPlayerEntity) => {
      const targetHoop = hoopRight;
      const dHoop = Math.hypot(targetHoop.x - shooter.x, targetHoop.y - shooter.y);
      const win = computeBballShotWindow(shooter, targetHoop);
      const dunkReach = 70 + Math.round((shooter.drive + shooter.strength - 150) * 0.32);
      const isDunk = dHoop < dunkReach;
      const shootBonus = win.isThree ? (shooter.shoot3 - 80) * 0.005 : (shooter.mid - 80) * 0.004;
      const makeProb = win.isHalfCourtHeave
        ? 0.05
        : isDunk
        ? win.nearestDefDist < 34
          ? clamp(0.68 + (shooter.strength - 70) * 0.004, 0.62, 0.88)
          : 0.94
        : win.isThree
        ? clamp(0.26 + win.greenWidth * 1.15 + shootBonus, 0.15, 0.56)
        : clamp(0.38 + win.greenWidth * 1.25 + shootBonus, 0.25, 0.72);
      const willMake = Math.random() < makeProb;
      if (isDunk) {
        startBballDunkAnim(shooter, targetHoop, 'player', willMake);
        return;
      }
      shooter.fga += 1;
      if (win.isThree) shooter.tpa += 1;
      const rebOffsetX = -55 - Math.random() * 65;
      const rebOffsetY = (Math.random() - 0.5) * 145;
      bb.carrierId = null;
      bb.shotCharging = false;
      bb.isReboundLive = false;
      bb.ballFlight = {
        startX: shooter.x,
        startY: shooter.y,
        targetX: targetHoop.x + (willMake ? 0 : (Math.random() - 0.5) * 24),
        targetY: targetHoop.y + (willMake ? 0 : (Math.random() - 0.5) * 20),
        reboundX: clamp(targetHoop.x + rebOffsetX, courtLeft + 32, courtRight - 32),
        reboundY: clamp(targetHoop.y + rebOffsetY, courtTop + 32, courtBot - 32),
        elapsed: 0,
        duration: clamp(0.38 + dHoop / 520, 0.36, 0.68),
        isShot: true,
        willMake,
        points: win.isThree ? 3 : 2,
        shooterId: shooter.id,
        shooterTeam: 'player',
      };
      bb.statusText = `${shooter.name.split(' ')[0]} (${shooter.position}) FIRES ${win.isThree ? '3PT' : 'JUMPER'}!!`;
      playRetroSportTone(620, 980, 0.12, 'square', 0.08);
    };

    const triggerPulseAction = () => {
      if (sport === 'basketball') {
        if (bb.finished) return;
        if (bb.inbound && bb.inbound.team === 'player') {
          executeBballInboundPass();
          return;
        }
        const user = bbPlayers[0];
        if (bb.carrierId === user.id && !bb.shotCharging && user.stunTimer <= 0) {
          const win = computeBballShotWindow(user, hoopRight);
          bb.shotCharging = true;
          bb.shotCharge = 0;
          bb.shotGreenStart = win.greenStart;
          bb.shotGreenWidth = win.greenWidth;
          bb.shotDifficultyLabel = win.label;
        } else if (bb.carrierId && bb.carrierId.startsWith('p_') && bb.carrierId !== user.id && !bb.ballFlight) {
          // Command teammate to shoot immediately!
          const mate = bbPlayers.find((p) => p.id === bb.carrierId);
          if (mate) {
            launchBballTeammateShot(mate);
          }
        } else if (bb.carrierId !== user.id && user.stealCooldown <= 0 && user.stunTimer <= 0) {
          user.stealCooldown = 0.42;
          user.blockTimer = 0.36;
          if (user.jumpZ <= 0) user.jumpVz = 215;
          playRetroSportTone(240, 140, 0.08, 'triangle', 0.06);

          const userSwatRange = 54 + Math.round((user.blockStat - 45) * 0.45);
          // Mid-air DUNK rejection when timing [SPACE] jump near a CPU dunker at the rim!
          if (bb.dunkAnim && bb.dunkAnim.team === 'cpu') {
            const da = bb.dunkAnim;
            const dunker = bbPlayers.find((p) => p.id === da.playerId);
            const distToBall = Math.hypot(bb.ballX - user.x, bb.ballY - user.y);
            const distToDunker = dunker ? Math.hypot(dunker.x - user.x, dunker.y - user.y) : 999;
            if (da.elapsed >= 0.06 && (distToBall < userSwatRange || distToDunker < userSwatRange)) {
              const hoopDir = da.rimX > courtMidX ? 1 : -1;
              user.blockTimer = 0.56;
              user.blk += 1;
              user.moveLabel = 'STUFFED!';
              user.moveLabelTimer = 0.95;
              bb.dunkAnim = null;
              if (dunker) {
                dunker.stunTimer = 1.15;
                dunker.jumpZ = 0;
                dunker.jumpVz = 0;
                dunker.vx = 0;
                dunker.vy = 0;
                dunker.x = clamp(dunker.x - hoopDir * 18, courtLeft + 18, courtRight - 18);
                dunker.moveLabel = 'BLOCKED!';
                dunker.moveLabelTimer = 1.0;
                spawnParticles(dunker.x, dunker.y + 8, '#38bdf8', 14, 135);
              }
              bb.ballZ = 0;
              bb.looseBallVx = -hoopDir * 195;
              bb.looseBallVy = (Math.random() - 0.5) * 200;
              bb.looseBallZ = 28;
              bb.looseBallVz = 85;
              bb.isReboundLive = true;
              bb.shakeTimer = 0.2;
              bb.bannerText = 'DENIED AT THE RIM!!';
              bb.bannerTimer = 1.2;
              bb.statusText = 'REJECTED THE DUNK! Dunker stunned — grab the loose rock!';
              spawnParticles(bb.ballX, bb.ballY, '#38bdf8', 24, 175);
              playRetroSportTone(220, 760, 0.18, 'square', 0.09);
              return;
            }
          }

          // Mid-air shot rejection when timing [SPACE] jump close to a CPU shooter or rising shot!
          if (
            bb.ballFlight &&
            bb.ballFlight.isShot &&
            bb.ballFlight.shooterTeam === 'cpu' &&
            bb.ballFlight.elapsed < 0.36 &&
            Math.hypot(bb.ballX - user.x, bb.ballY - user.y) < userSwatRange + 6
          ) {
            user.blockTimer = 0.52;
            user.blk += 1;
            user.moveLabel = 'SWAT!!';
            user.moveLabelTimer = 0.85;
            bb.ballFlight = null;
            bb.ballZ = 0;
            bb.looseBallVx = -210;
            bb.looseBallVy = (Math.random() - 0.5) * 200;
            bb.looseBallZ = 24;
            bb.looseBallVz = 75;
            bb.isReboundLive = true;
            bb.shakeTimer = 0.16;
            bb.bannerText = 'REJECTED!! BLOCK!';
            bb.bannerTimer = 1.1;
            bb.statusText = 'DENIED AT THE RIM! Grab the loose rock!';
            spawnParticles(bb.ballX, bb.ballY, '#38bdf8', 22, 165);
            spawnParticles(user.x, user.y - 12, '#fde047', 12, 130);
            playRetroSportTone(220, 760, 0.18, 'square', 0.09);
            return;
          }

          const carrier = bbPlayers.find((p) => p.id === bb.carrierId);
          if (carrier && carrier.team === 'cpu' && !bb.inbound) {
            const stealDist = Math.hypot(carrier.x - user.x, carrier.y - user.y);
            const cpuInMove = carrier.crossTimer > 0 || carrier.tweenTimer > 0;
            const userStealEdge = (user.stealStat - 75) * 0.004;
            const stealSuccessChance = clamp(
              (cpuInMove ? 0.24 : isTourney || isBballSeason ? 0.5 : 0.58) + userStealEdge,
              0.18,
              0.72
            );
            if (stealDist < 50 && Math.random() < stealSuccessChance) {
              user.stl += 1;
              bb.carrierId = user.id;
              bb.possession = 'player';
              bb.shotClock = 24;
              bbFrontcourtReached = false;
              bb.statusText = 'CLEAN STEAL! Hold [SPACE] to shoot or [E] pass!';
              bb.bannerText = 'STEAL!';
              bb.bannerTimer = 1.05;
              spawnParticles(user.x, user.y, '#38bdf8', 12, 110);
              playRetroSportTone(620, 920, 0.14, 'square', 0.08);
            } else {
              // Missed steal / bad reach -> player gets stunned out of position!
              user.stunTimer = 0.78;
              user.stealCooldown = 0.92;
              user.jumpZ = 0;
              user.jumpVz = 0;
              user.vx = 0;
              user.vy = 0;
              user.moveLabel = 'REACH!';
              user.moveLabelTimer = 0.85;
              bb.bannerText = 'MISSED STEAL!!';
              bb.bannerTimer = 0.85;
              bb.statusText =
                stealDist >= 50
                  ? 'WHIFFED THE STEAL! You got stunned reaching out of range!'
                  : 'REACHED & MISSED! You are stunned — CPU has an open lane!';
              spawnParticles(user.x, user.y + 8, '#ef4444', 12, 120);
              playRetroSportTone(210, 105, 0.16, 'sawtooth', 0.08);
            }
          }
        }
      } else if (sport === 'golf') {
        if (golf.finished) return;
        if (Math.hypot(golf.vx, golf.vy) < 2 && golf.ballZ <= 0.5 && golf.inCupTimer <= 0) {
          if (!golf.charging) {
            golf.charging = true;
            golf.chargeOsc = 0;
            golf.chargeDir = 1;
          }
        }
      } else if (sport === 'baseball') {
        if (baseball.finished) return;
        if (baseball.phase === 'pitching' && baseball.swingTimer <= 0 && !baseball.swungThisPitch) {
          baseball.swungThisPitch = true;
          baseball.swingIsPower = true;
          baseball.swingTimer = 0.22;
          playRetroSportTone(240, 115, 0.11, 'triangle', 0.08);

          const dy = baseball.ballY - baseball.aimY;
          const dx = baseball.ballX - baseball.aimX;
          const hitRadius = 31;
          const distAim = Math.hypot(dx, dy);

          if (distAim < hitRadius && Math.abs(baseball.ballY - homePlate.y) < 38) {
            const quality = 1 - distAim / hitRadius; // 0..1
            const timingRatio = clamp((baseball.ballY - homePlate.y) / 36, -1, 1);
            // Very early or very late => Foul Ball!
            if (Math.abs(timingRatio) > 0.72) {
              if (baseball.strikes < 2) baseball.strikes += 1;
              baseball.phase = 'windup';
              baseball.waitTimer = 0.75;
              baseball.statusText = 'FOUL BALL! Track the pitch timing!';
              spawnParticles(homePlate.x, homePlate.y, '#f8fafc', 8, 90);
              playRetroSportTone(390, 220, 0.09, 'square', 0.06);
              return;
            }
            const sprayAngle = timingRatio * 0.66 + (Math.random() - 0.5) * 0.18;
            const speed = 270 + quality * 380;
            baseball.ballVx = Math.sin(sprayAngle) * speed;
            baseball.ballVy = -Math.cos(sprayAngle) * speed;
            baseball.ballVz = 108 + quality * 175;
            baseball.ballZ = 5;
            baseball.phase = 'batted';
            baseball.strikes = 0;
            baseball.balls = 0;
            baseball.statusText =
              quality > 0.74 ? 'NO-DOUBTER MOONSHOT!' : quality > 0.56 ? 'BARRELLED UP!' : 'Contact — Ball in Play!';
            spawnParticles(homePlate.x, homePlate.y, quality > 0.7 ? '#fb7185' : '#fde047', 16, 155);
            playRetroSportTone(760, 1180, 0.14, 'square', 0.09);
          } else {
            baseball.statusText = 'WHIFF! Swing & a miss!';
          }
        }
      } else if (sport === 'football') {
        if (fb.finished) return;
        if (fb.possession === 'player') {
          if (fb.phase === 'huddle') {
            const play = footballPlayRef.current;
            fbPlayStartYard = fb.losYard;
            fbPlayWasPass = false;
            const isRun = play === 'sweep' || play === 'inside_dive';
            fb.phase = isRun ? 'yac_run' : 'live_pass';
            fb.carrierId = isRun ? 'rb' : 'qb';
            fb.statusText = isRun
              ? `${play === 'inside_dive' ? 'HB INSIDE DIVE' : 'HB TOSS SWEEP'}! Sprint RIGHT · [SPACE] Spin-Juke!`
              : 'HIKE! Arrows Scramble · [SPACE] Anticipation Throw ([1] WR1 · [2] WR2 · [3] RB)!';
            playRetroSportTone(320, 520, 0.12, 'square', 0.08);
          } else if (fb.phase === 'live_pass' && fb.carrierId === 'qb') {
            const qbEnt = fb.entities.find((e) => e.id === 'qb');
            if (qbEnt && qbEnt.x > yardToX(fb.losYard) + 4) {
              // Past Line of Scrimmage -> [SPACE] executes Spin Move!
              if (fb.jukeCooldown <= 0) {
                const spinRad = 40 + (pQB.carry + myFbProfile.strength) * 0.08;
                fb.jukeTimer = 0.38;
                fb.jukeCooldown = 0.72;
                qbEnt.x = clamp(qbEnt.x + 12, 36, fbWorldW - 36);
                for (const d of fb.entities) {
                  if (d.team !== 'cpu') continue;
                  const dd = Math.hypot(d.x - qbEnt.x, d.y - qbEnt.y);
                  if (dd < spinRad) {
                    const pushAng = Math.atan2(d.y - qbEnt.y, d.x - qbEnt.x);
                    d.x = clamp(d.x + Math.cos(pushAng) * 30, fbEzLeftX - 20, fbEzRightX + 40);
                    d.y = clamp(d.y + Math.sin(pushAng) * 30, fbTopY + 12, fbBotY - 12);
                    spawnParticles(d.x, d.y, '#fde047', 6, 95);
                  }
                }
                fb.statusText = 'SPIN MOVE!! SPRINT RIGHT!';
                playRetroSportTone(540, 880, 0.09, 'square', 0.07);
              }
            } else {
              startFootballThrowMeter();
            }
          } else if (fb.phase === 'yac_run' && fb.jukeCooldown <= 0) {
            const carrier = fb.entities.find((e) => e.id === fb.carrierId);
            const carCarry = carrier?.id === 'rb' ? pRB.carry : pWR.carry;
            const carStr = carrier?.id === 'rb' ? pRB.strength : pWR.strength;
            const spinRad = 38 + (carCarry + carStr) * 0.1;
            fb.jukeTimer = 0.36 + carCarry * 0.0012;
            fb.jukeCooldown = 0.72;
            if (carrier) {
              carrier.x = clamp(carrier.x + 12, 36, fbWorldW - 36);
              for (const d of fb.entities) {
                if (d.team !== 'cpu') continue;
                const dd = Math.hypot(d.x - carrier.x, d.y - carrier.y);
                if (dd < spinRad) {
                  const pushAng = Math.atan2(d.y - carrier.y, d.x - carrier.x);
                  d.x = clamp(d.x + Math.cos(pushAng) * 30, fbEzLeftX - 20, fbEzRightX + 40);
                  d.y = clamp(d.y + Math.sin(pushAng) * 30, fbTopY + 12, fbBotY - 12);
                  spawnParticles(d.x, d.y, '#fde047', 6, 95);
                }
              }
            }
            fb.statusText = 'SPIN MOVE!! BREAK TACKLES!';
            playRetroSportTone(540, 880, 0.09, 'square', 0.07);
          }
        } else {
          // PLAYABLE DEFENSE: [SPACE] = Timed Dive Tackle / Contested Pick!
          const userDef = fb.entities.find((e) => e.id === 'user_def');
          if (userDef && fb.diveCooldown <= 0 && fb.phase !== 'huddle' && fb.phase !== 'play_over') {
            fb.diveTimer = 0.25 + myFbProfile.tackle * 0.0008;
            fb.diveCooldown = 0.86;
            const diveLeap = 16 + myFbProfile.tackle * 0.09;
            const targetX = fb.phase === 'ball_in_air' ? fb.ballX : fb.entities.find((e) => e.id === fb.carrierId)?.x ?? fb.ballX;
            const targetY = fb.phase === 'ball_in_air' ? fb.ballY : fb.entities.find((e) => e.id === fb.carrierId)?.y ?? fb.ballY;
            const ang = Math.atan2(targetY - userDef.y, targetX - userDef.x);
            userDef.x = clamp(userDef.x + Math.cos(ang) * diveLeap, fbEzLeftX - 40, fbEzRightX + 40);
            userDef.y = clamp(userDef.y + Math.sin(ang) * (diveLeap * 0.9), fbTopY + 14, fbBotY - 14);
            spawnParticles(userDef.x, userDef.y, '#38bdf8', 7, 90);
            playRetroSportTone(340, 620, 0.1, 'triangle', 0.08);
          }
        }
      } else if (sport === 'soccer') {
        if (soccer.finished) return;
        const user = socPlayers[0];
        if (soccer.ownerId === user.id && !soccer.shotCharging) {
          const win = computeSoccerShotWindow(user);
          soccer.shotCharging = true;
          soccer.shotCharge = 0;
          soccer.shotGreenStart = win.greenStart;
          soccer.shotGreenWidth = win.greenWidth;
          soccer.shotDifficultyLabel = win.label;
        } else if (soccer.ownerId !== user.id && user.tackleCooldown <= 0) {
          // Slide tackle burst!
          user.tackleCooldown = 0.6;
          user.vx += user.faceX * 210;
          user.vy += user.faceY * 210;
          playRetroSportTone(240, 120, 0.09, 'triangle', 0.07);
          const owner = socPlayers.find((p) => p.id === soccer.ownerId);
          if (
            (owner && owner.team === 'cpu' && Math.hypot(owner.x - user.x, owner.y - user.y) < 48) ||
            (!soccer.ownerId && Math.hypot(soccer.ballX - user.x, soccer.ballY - user.y) < 46)
          ) {
            soccer.ownerId = user.id;
            soccer.bannerText = 'TACKLE STEAL!';
            soccer.bannerTimer = 0.85;
            spawnParticles(user.x, user.y, '#38bdf8', 10, 100);
            playRetroSportTone(620, 920, 0.12, 'square', 0.08);
          }
        }
      } else if (sport === 'bowling') {
        if (bowling.finished) return;
        if (bowling.phase === 'align') {
          bowling.phase = 'hook';
          bowling.hookOsc = 0;
          bowling.hookDir = Math.random() > 0.5 ? 1 : -1;
          bowling.statusText = 'STAGE 2: Tap [SPACE] to Lock HOOK SPIN!';
          playRetroSportTone(440, 580, 0.06, 'square', 0.06);
        } else if (bowling.phase === 'hook') {
          bowling.hookSpin = bowling.hookOsc;
          bowling.phase = 'power';
          bowling.powerOsc = 0.12;
          bowling.powerDir = 1;
          bowling.statusText = 'STAGE 3: Hit GREEN POCKET ZONE [SPACE] to Throw!';
          playRetroSportTone(560, 740, 0.06, 'square', 0.06);
        } else if (bowling.phase === 'power') {
          bowling.ballPower = clamp(bowling.powerOsc, 0.2, 1.0);
          const inSweet = bowling.ballPower >= 0.68 && bowling.ballPower <= 0.84;
          const overPull =
            bowling.ballPower > 0.86
              ? (bowling.ballPower - 0.84) * 320 * (bowling.hookSpin >= 0 ? 1 : -1)
              : 0;
          const baseFwd = 300 + bowling.ballPower * 255;
          bowling.phase = 'rolling';
          bowling.inGutter = false;
          bowling.ballTrail = [];
          bowling.ballVx = Math.sin(bowling.launchAngle) * baseFwd + overPull;
          bowling.ballVy = -Math.cos(bowling.launchAngle) * baseFwd;
          bowling.statusText = inSweet
            ? 'CLEAN POCKET RELEASE! Watch the backend snap!'
            : bowling.ballPower > 0.86
            ? 'OVER-POWERED PULL! Skid through the oil!'
            : 'LIGHT RELEASE! Watch for early hook!';
          playRetroSportTone(210, 120, 0.2, 'sawtooth', 0.07);
        }
      } else if (sport === 'fishing') {
        if (fishing.finished) return;
        if (fishing.phase === 'ready') {
          fishing.phase = 'waiting';
          if (pointerPosRef.current.active) {
            fishing.bobberX = clamp(pointerPosRef.current.x, 130, CANVAS_W - 130);
            fishing.bobberY = clamp(pointerPosRef.current.y, 110, 320);
          }
          fishing.waitTimer = 1.1 + Math.random() * 1.9;
          fishing.statusText = 'Bobber out... Wait for the ripples & [!] Bite!';
          playRetroSportTone(520, 320, 0.14, 'sine', 0.07);
        } else if (fishing.phase === 'bite') {
          fishing.phase = 'reel';
          fishing.fishIdx = Math.min(FISH_SPECIES.length - 1, Math.floor(Math.random() * FISH_SPECIES.length));
          fishing.fishPos = 0.55;
          fishing.fishVel = (Math.random() > 0.5 ? 1 : -1) * 0.42;
          fishing.barPos = 0.45;
          fishing.barVel = 0;
          fishing.catchProgress = 0.34;
          const sp = FISH_SPECIES[fishing.fishIdx];
          fishing.statusText = `HOOKED ${sp.icon} ${sp.name}! Hold [SPACE]/Mouse to keep bar on fish!`;
          playRetroSportTone(760, 1080, 0.16, 'square', 0.09);
        }
      }
    };

    const releaseHoldAction = () => {
      if (sport === 'basketball' && bb.shotCharging) {
        bb.shotCharging = false;
        const user = bbPlayers[0];
        if (bb.carrierId === user.id) {
          const targetHoop = hoopRight;
          const dist = Math.hypot(targetHoop.x - user.x, targetHoop.y - user.y);
          const pts = dist >= threePtRad ? 3 : 2;
          const inGreen =
            bb.shotCharge >= bb.shotGreenStart &&
            bb.shotCharge <= bb.shotGreenStart + bb.shotGreenWidth;
          const distFromGreen = inGreen
            ? 0
            : bb.shotCharge < bb.shotGreenStart
            ? bb.shotGreenStart - bb.shotCharge
            : bb.shotCharge - (bb.shotGreenStart + bb.shotGreenWidth);

          // Check CPU jump contest block!
          let nearestDef: BballPlayerEntity | null = null;
          let nearestD = 999;
          for (const d of bbPlayers) {
            if (d.team === 'cpu') {
              const dd = Math.hypot(d.x - user.x, d.y - user.y);
              if (dd < nearestD) {
                nearestD = dd;
                nearestDef = d;
              }
            }
          }
          if (nearestDef && nearestD < 40) {
            nearestDef.jumpVz = 210;
            nearestDef.blockTimer = 0.42;
          }
          const blocked =
            nearestDef &&
            nearestD < 34 &&
            dist > 76 &&
            Math.random() < clamp(0.16 + (nearestDef.blockStat - 70) * 0.0024, 0.09, 0.28);

          if (blocked && nearestDef) {
            nearestDef.blockTimer = 0.52;
            nearestDef.blk += 1;
            nearestDef.moveLabel = 'SWAT!!';
            nearestDef.moveLabelTimer = 0.85;
            user.fga += 1;
            if (pts === 3) user.tpa += 1;
            bb.carrierId = null;
            bb.looseBallVx = -185;
            bb.looseBallVy = (Math.random() - 0.5) * 190;
            bb.looseBallZ = 22;
            bb.looseBallVz = 70;
            bb.isReboundLive = true;
            bb.shakeTimer = 0.16;
            bb.bannerText = 'REJECTED!! BLOCK!';
            bb.bannerTimer = 1.15;
            bb.statusText = 'CPU SWATTED THE SHOT! Scramble for the loose ball!';
            spawnParticles(user.x + 8, user.y - 10, '#ef4444', 18, 155);
            playRetroSportTone(180, 75, 0.18, 'sawtooth', 0.09);
            return;
          }

          const userDunkRange = 70 + Math.round((user.drive + user.strength - 150) * 0.32);
          if (dist < userDunkRange) {
            const finishBonus = (user.drive + user.strength - 155) * 0.004;
            const dunkMake =
              nearestD < 34
                ? inGreen || Math.random() < clamp(0.76 + finishBonus, 0.66, 0.92)
                : inGreen || Math.random() < 0.96;
            startBballDunkAnim(user, targetHoop, 'player', dunkMake);
            return;
          }

          const shotWin = computeBballShotWindow(user, targetHoop);
          const touchBonus = shotWin.isThree ? (user.shoot3 - 80) * 0.006 : (user.mid - 80) * 0.005;
          let willMake = false;
          if (shotWin.isHalfCourtHeave) {
            willMake = inGreen ? Math.random() < clamp(0.45 + touchBonus, 0.25, 0.62) : Math.random() < 0.03;
          } else if (!shotWin.isThree) {
            willMake = inGreen || (distFromGreen < 0.052 && Math.random() < clamp(0.38 + touchBonus, 0.2, 0.55));
          } else {
            willMake = inGreen || (distFromGreen < 0.036 && Math.random() < clamp(0.28 + touchBonus, 0.12, 0.48));
          }
          user.fga += 1;
          if (pts === 3) user.tpa += 1;
          const rebOffsetX = -55 - Math.random() * 65;
          const rebOffsetY = (Math.random() - 0.5) * 145;
          bb.carrierId = null;
          bb.isReboundLive = false;
          bb.ballFlight = {
            startX: user.x,
            startY: user.y,
            targetX: targetHoop.x + (willMake ? 0 : (Math.random() - 0.5) * 24),
            targetY: targetHoop.y + (willMake ? 0 : (Math.random() - 0.5) * 20),
            reboundX: clamp(targetHoop.x + rebOffsetX, courtLeft + 32, courtRight - 32),
            reboundY: clamp(targetHoop.y + rebOffsetY, courtTop + 32, courtBot - 32),
            elapsed: 0,
            duration: clamp(0.38 + dist / 520, 0.36, 0.72),
            isShot: true,
            willMake,
            points: pts,
            shooterId: user.id,
            shooterTeam: 'player',
          };
          bb.statusText = shotWin.isHalfCourtHeave
            ? 'HEAVE FROM BEYOND HALF COURT!!'
            : inGreen
            ? `GREEN RELEASE! ${pts}PT Attempt!`
            : `${pts}PT Shot Up... Crash the Glass!`;
          playRetroSportTone(inGreen ? 780 : 480, inGreen ? 1040 : 620, 0.12, 'square', 0.07);
        }
      } else if (sport === 'golf' && golf.charging) {
        golf.charging = false;
        golf.swingTimer = 0.26;
        golf.ballTrail = [];
        const club = GOLF_CLUBS[golfClubIdxRef.current];
        const pow = clamp(golf.chargeOsc, 0.08, 1.0);
        const speed = club.maxPower * pow;
        // Over-swinging into the red (>88%) causes realistic hook/slice dispersion!
        const overSwingErr =
          club.loftVz > 0 && pow > 0.88
            ? (Math.random() > 0.5 ? 1 : -1) * (pow - 0.84) * 1.05
            : 0;
        const launchAng = golf.aimAngle + overSwingErr;
        golf.vx = Math.cos(launchAng) * speed;
        golf.vy = Math.sin(launchAng) * speed;
        golf.vz = club.loftVz * (0.35 + 0.65 * pow);
        golf.ballZ = club.loftVz > 0 ? 1 : 0;
        golf.strokes += 1;
        golf.statusText =
          overSwingErr !== 0
            ? `${club.name} @ ${Math.round(pow * 100)}% OVER-SWUNG! Slice/Hook!`
            : `${club.name} @ ${Math.round(pow * 100)}% power!`;
        playRetroSportTone(340, 680, 0.12, 'triangle', 0.08);
      } else if (sport === 'soccer' && soccer.shotCharging) {
        soccer.shotCharging = false;
        const user = socPlayers[0];
        if (soccer.ownerId === user.id) {
          const win = computeSoccerShotWindow(user);
          const inGreen =
            soccer.shotCharge >= soccer.shotGreenStart &&
            soccer.shotCharge <= soccer.shotGreenStart + soccer.shotGreenWidth;
          const distFromGreen = inGreen
            ? 0
            : soccer.shotCharge < soccer.shotGreenStart
            ? soccer.shotGreenStart - soccer.shotCharge
            : soccer.shotCharge - (soccer.shotGreenStart + soccer.shotGreenWidth);

          // Aim cleanly for top/bottom corner AWAY from the CPU goalkeeper unless player aims opposite with Up/Down!
          const aimUpDown = (keysRef.current.has('ArrowDown') ? 1 : 0) - (keysRef.current.has('ArrowUp') ? 1 : 0);
          const bestCornerY =
            aimUpDown !== 0
              ? socMidY + aimUpDown * (goalSpanHalf - 16)
              : soccer.keeperRightY > socMidY
              ? socMidY - (goalSpanHalf - 16)
              : socMidY + (goalSpanHalf - 16);
          const scatterY = inGreen ? 0 : (Math.random() - 0.5) * clamp(distFromGreen * 190, 14, 72);
          const targetY = clamp(bestCornerY + scatterY, socMidY - goalSpanHalf - 14, socMidY + goalSpanHalf + 14);
          const gdx = socRight - user.x;
          const gdy = targetY - user.y;
          const gLen = Math.hypot(gdx, gdy) || 1;

          const kickSpd = inGreen
            ? win.isLongBomb
              ? 635
              : 585
            : distFromGreen < 0.14
            ? 475
            : 365;
          soccer.ownerId = null;
          soccer.ballVx = (gdx / gLen) * kickSpd;
          soccer.ballVy = (gdy / gLen) * kickSpd;
          soccer.statusText = inGreen ? 'GREEN TOP-BINS STRIKE!!' : distFromGreen < 0.14 ? 'GOOD STRIKE ON GOAL!' : 'OFF-TIMING SHOT!';
          playRetroSportTone(inGreen ? 780 : 280, inGreen ? 1120 : 620, 0.13, 'square', 0.08);
        }
      } else if (sport === 'football' && fb.throwCharging) {
        fb.throwCharging = false;
        const gStart = fb.throwGreenStart;
        const gEnd = fb.throwGreenStart + fb.throwGreenWidth;
        const inGreen = fb.throwCharge >= gStart && fb.throwCharge <= gEnd;
        const missAmt = inGreen
          ? 0
          : fb.throwCharge < gStart
          ? gStart - fb.throwCharge
          : fb.throwCharge - gEnd;
        throwFootballPass(fb.throwTargetId, 'player', { inGreen, missAmt });
      }
    };

    const triggerPassAction = () => {
      const aimX = (keysRef.current.has('ArrowRight') ? 1 : 0) - (keysRef.current.has('ArrowLeft') ? 1 : 0);
      const aimY = (keysRef.current.has('ArrowDown') ? 1 : 0) - (keysRef.current.has('ArrowUp') ? 1 : 0);
      if (sport === 'basketball') {
        if (bb.finished || bb.ballFlight) return;
        const user = bbPlayers[0];
        if (bb.carrierId === user.id && teamN > 1) {
          const mates = bbPlayers.filter((p) => p.team === 'player' && !p.isUser);
          if (mates.length > 0) {
            mates.sort((a, b) => {
              if (aimX !== 0 || aimY !== 0) {
                const daX = a.x - user.x;
                const daY = a.y - user.y;
                const dbX = b.x - user.x;
                const dbY = b.y - user.y;
                const dotA = (daX * aimX + daY * aimY) / (Math.hypot(daX, daY) || 1);
                const dotB = (dbX * aimX + dbY * aimY) / (Math.hypot(dbX, dbY) || 1);
                return dotB - dotA;
              }
              return b.x - a.x;
            });
            const target = mates[0];
            bb.carrierId = null;
            bb.shotCharging = false;
            bb.ballFlight = {
              startX: user.x,
              startY: user.y,
              targetX: target.x,
              targetY: target.y,
              reboundX: target.x,
              reboundY: target.y,
              elapsed: 0,
              duration: 0.24,
              isShot: false,
              willMake: false,
              points: 0,
              passToId: target.id,
              shooterId: user.id,
              shooterTeam: 'player',
            };
            bb.statusText = 'Pass to teammate! [SPACE] Shoot or [E] Call Back!';
            playRetroSportTone(540, 420, 0.07, 'sine', 0.06);
          }
        } else if (bb.inbound && bb.inbound.team === 'player') {
          executeBballInboundPass();
        } else if (bb.carrierId && bb.carrierId.startsWith('p_') && bb.carrierId !== user.id) {
          const mate = bbPlayers.find((p) => p.id === bb.carrierId);
          if (mate) {
            bb.carrierId = null;
            bb.ballFlight = {
              startX: mate.x,
              startY: mate.y,
              targetX: user.x,
              targetY: user.y,
              reboundX: user.x,
              reboundY: user.y,
              elapsed: 0,
              duration: 0.22,
              isShot: false,
              willMake: false,
              points: 0,
              passToId: user.id,
              shooterId: mate.id,
              shooterTeam: 'player',
            };
            bb.statusText = 'Ball back in your hands — Hold [SPACE] to shoot!';
            playRetroSportTone(620, 500, 0.07, 'sine', 0.06);
          }
        }
      } else if (sport === 'soccer') {
        if (soccer.finished) return;
        const user = socPlayers[0];
        if (soccer.ownerId === user.id) {
          const mates = socPlayers.filter((p) => p.team === 'player' && !p.isUser);
          mates.sort((a, b) => {
            if (aimX !== 0 || aimY !== 0) {
              const daX = a.x - user.x;
              const daY = a.y - user.y;
              const dbX = b.x - user.x;
              const dbY = b.y - user.y;
              const dotA = (daX * aimX + daY * aimY) / (Math.hypot(daX, daY) || 1);
              const dotB = (dbX * aimX + dbY * aimY) / (Math.hypot(dbX, dbY) || 1);
              return dotB - dotA;
            }
            return b.x - a.x;
          });
          const tm = mates[0];
          if (tm) {
            const dx = tm.x - user.x;
            const dy = tm.y - user.y;
            const len = Math.hypot(dx, dy) || 1;
            soccer.ownerId = null;
            soccer.ballVx = (dx / len) * 410;
            soccer.ballVy = (dy / len) * 410;
            soccer.statusText = 'Crisp pass! Press [E] to call return ball!';
            playRetroSportTone(520, 420, 0.07, 'sine', 0.06);
          }
        } else if (soccer.ownerId && soccer.ownerId.startsWith('sp_') && soccer.ownerId !== user.id) {
          const mate = socPlayers.find((p) => p.id === soccer.ownerId);
          if (mate) {
            const dx = user.x - mate.x;
            const dy = user.y - mate.y;
            const len = Math.hypot(dx, dy) || 1;
            soccer.ownerId = null;
            soccer.ballVx = (dx / len) * 420;
            soccer.ballVy = (dy / len) * 420;
            soccer.statusText = 'Ball passed back to you!';
            playRetroSportTone(620, 500, 0.07, 'sine', 0.06);
          }
        }
      } else if (sport === 'football') {
        if (fb.finished) return;
        if (fb.possession === 'player' && fb.phase === 'live_pass' && fb.carrierId === 'qb') {
          startFootballThrowMeter();
        }
      } else if (sport === 'baseball') {
        // Attempt Base Steal during windup/pitch!
        if (baseball.finished || baseball.stealAttemptCooldown > 0) return;
        if (baseball.bases[0] || baseball.bases[1]) {
          baseball.stealAttemptCooldown = 1.8;
          const success = Math.random() < 0.68;
          if (success) {
            if (baseball.bases[1] && !baseball.bases[2]) {
              baseball.bases[2] = true;
              baseball.bases[1] = false;
            } else if (baseball.bases[0] && !baseball.bases[1]) {
              baseball.bases[1] = true;
              baseball.bases[0] = false;
            }
            baseball.statusText = 'STOLEN BASE!! Safe at the bag!';
            baseball.bannerText = 'STOLEN BASE!';
            baseball.bannerTimer = 1.0;
            playRetroSportTone(620, 960, 0.15, 'square', 0.08);
          } else {
            if (baseball.bases[1]) baseball.bases[1] = false;
            else baseball.bases[0] = false;
            baseball.outs += 1;
            baseball.statusText = 'CAUGHT STEALING! Out at the bag!';
            playRetroSportTone(190, 95, 0.18, 'sawtooth', 0.08);
          }
        }
      }
    };

    const triggerCallScreenAction = () => {
      if (sport !== 'basketball' || bb.finished || bb.inbound || bb.dunkAnim) return;
      if (bb.possession !== 'player') {
        bb.statusText = 'Get possession first before calling a screen!';
        return;
      }
      if (teamN < 2) {
        bb.statusText = 'Screens require 2v2 or larger teams!';
        return;
      }
      const user = bbPlayers[0];
      const candidates = bbPlayers.filter(
        (p) => p.team === 'player' && !p.isUser && p.id !== bb.carrierId && p.stunTimer <= 0
      );
      if (candidates.length === 0) return;

      candidates.sort((a, b) => {
        const scoreA =
          a.strength +
          (a.position === 'C' ? 22 : a.position === 'PF' ? 14 : 0) -
          Math.hypot(a.x - user.x, a.y - user.y) * 0.14;
        const scoreB =
          b.strength +
          (b.position === 'C' ? 22 : b.position === 'PF' ? 14 : 0) -
          Math.hypot(b.x - user.x, b.y - user.y) * 0.14;
        return scoreB - scoreA;
      });
      const screener = candidates[0];

      let nearestDef: BballPlayerEntity | null = null;
      let nearestDefDist = 155;
      for (const d of bbPlayers) {
        if (d.team !== 'cpu' || d.stunTimer > 0) continue;
        const dd = Math.hypot(d.x - user.x, d.y - user.y);
        if (dd < nearestDefDist) {
          nearestDefDist = dd;
          nearestDef = d;
        }
      }

      const sideY: -1 | 1 = keysRef.current.has('ArrowUp')
        ? -1
        : keysRef.current.has('ArrowDown')
        ? 1
        : user.y < courtMidY
        ? 1
        : -1;

      bb.screen = {
        screenerId: screener.id,
        targetDefId: nearestDef?.id ?? null,
        sideY,
        timer: 4.2,
        engaged: false,
        screenedTriggered: false,
        rollTimer: 0,
      };
      screener.cutTimer = 0;
      screener.moveLabel = 'SCREEN!';
      screener.moveLabelTimer = 1.05;
      bb.statusText = `${screener.name.split(' ')[0]} (${screener.position}) coming to set the screen! Run defender into the pick!`;
      playRetroSportTone(520, 690, 0.08, 'triangle', 0.06);
    };

    const triggerBballDribbleMove = (moveType: 'cross' | 'tween', viaSkillInput = false) => {
      if (sport !== 'basketball' || bb.finished) return;
      const user = bbPlayers[0];
      if (bb.carrierId !== user.id || user.moveCooldown > 0 || bb.shotCharging || user.stunTimer > 0) return;

      const anchorDist = Math.hypot(user.x - bb.netAnchorX, user.y - bb.netAnchorY);
      const userSpeed = Math.hypot(user.vx, user.vy);
      const isMashSpam = bb.mashHeat > 0.95 || (!viaSkillInput && bb.dirHoldTime < 0.14);
      const hasSetupMomentum = viaSkillInput
        ? bb.mashHeat < 1.0 && (bb.dirHoldTime >= 0.08 || userSpeed > 95)
        : bb.dirHoldTime >= 0.15 && anchorDist >= 16;

      const cdMult = clamp(1.12 - (user.speedStat - 78) * 0.011, 0.88, 1.34);
      user.dribbleHand = user.dribbleHand === 1 ? -1 : 1;
      user.moveCooldown = (isMashSpam ? 0.92 : 1.12) * cdMult;
      if (moveType === 'cross') {
        user.crossTimer = 0.34;
        const lateralY = keysRef.current.has('ArrowUp')
          ? -1
          : keysRef.current.has('ArrowDown')
          ? 1
          : user.dribbleHand;
        const stepFwd = isMashSpam ? 5 : 14;
        const stepLat = isMashSpam ? 10 : 26;
        user.x = clamp(user.x + stepFwd, courtLeft + 18, courtRight - 18);
        user.y = clamp(user.y + lateralY * stepLat, courtTop + 18, courtBot - 18);
        user.faceX = 1;
        user.faceY = lateralY * 0.45;
      } else {
        user.tweenTimer = 0.38;
        const dirY = keysRef.current.has('ArrowUp')
          ? -1
          : keysRef.current.has('ArrowDown')
          ? 1
          : -user.dribbleHand;
        const stepFwd = isMashSpam ? 6 : 22;
        const stepLat = isMashSpam ? 8 : 18;
        user.x = clamp(user.x + stepFwd, courtLeft + 18, courtRight - 18);
        user.y = clamp(user.y + dirY * stepLat, courtTop + 18, courtBot - 18);
        user.faceX = 1;
        user.faceY = dirY * 0.3;
      }

      // Reset anchor & drive-hold after firing a move so you must set up the next move deliberately
      bb.dirHoldTime = 0;
      bb.netAnchorX = user.x;
      bb.netAnchorY = user.y;
      bb.anchorAge = 0;

      // Realistic Ankle-Breaker evaluation: mashing or stationary hesis do NOT fool disciplined CPU defenders!
      let brokeAnkles = false;
      let defenderReadIt = false;
      if (isMashSpam || !hasSetupMomentum) {
        bb.cpuWatchTimer = Math.max(bb.cpuWatchTimer, 1.05);
        defenderReadIt = bbPlayers.some(
          (d) => d.team === 'cpu' && d.stunTimer <= 0 && Math.hypot(d.x - user.x, d.y - user.y) < 76
        );
      } else {
        for (const d of bbPlayers) {
          if (d.team !== 'cpu' || d.stunTimer > 0) continue;
          const dist = Math.hypot(d.x - user.x, d.y - user.y);
          if (dist < (moveType === 'tween' ? 66 : 56)) {
            const defSpeed = Math.hypot(d.vx, d.vy);
            // Squared-up defender reading after recent mash refuses to bite on fakes
            if (bb.cpuWatchTimer > 0 && defSpeed < 72) {
              d.moveLabel = 'LOCKED!';
              d.moveLabelTimer = 0.68;
              defenderReadIt = true;
              continue;
            }
            const offBalanceBonus = defSpeed > 105 || d.stealCooldown > 0.35 || d.blockTimer > 0 ? 0.16 : defSpeed > 65 ? 0.05 : -0.11;
            const diffScale = isTourney || isBballSeason ? 0.92 : 1.0;
            const handleEdge = (user.speedStat - 80) * 0.004;
            const breakChance = clamp(((moveType === 'tween' ? 0.62 : 0.48) + offBalanceBonus + handleEdge) * diffScale, 0.22, 0.82);
            if (Math.random() < breakChance) {
              d.stunTimer = moveType === 'tween' ? 1.18 : 1.0;
              d.vx = 0;
              d.vy = 0;
              d.moveLabel = 'ANKLES!';
              d.moveLabelTimer = 0.85;
              brokeAnkles = true;
              spawnParticles(d.x, d.y + 8, moveType === 'tween' ? '#38bdf8' : '#f97316', 14, 130);
            }
          }
        }
      }

      spawnParticles(user.x, user.y, moveType === 'tween' ? '#38bdf8' : '#f97316', 10, 95);
      user.moveLabel = moveType === 'tween' ? 'TWEEN!' : 'CROSS!';
      user.moveLabelTimer = 0.72;
      playRetroSportTone(moveType === 'tween' ? 520 : 440, moveType === 'tween' ? 840 : 720, 0.1, 'square', 0.08);
      if (brokeAnkles) {
        bb.bannerText = moveType === 'tween' ? 'NAAASTY TWEEN!! ANKLES!' : 'ANKLE BREAKER CROSS!!';
        bb.bannerTimer = 1.05;
        bb.statusText = 'DEFENDER STUNNED! Attack the rim or pull up for boosted GREEN!';
        playRetroSportTone(680, 1140, 0.16, 'square', 0.09);
      } else if (isMashSpam || defenderReadIt) {
        bb.statusText = 'Defense stayed locked in — drive with momentum first, then snap a move!';
      } else {
        bb.statusText = moveType === 'tween' ? 'Clean between-the-legs changeup!' : 'Sharp crossover! Attack the angle!';
      }
    };

    const triggerSoccerSkillMove = () => {
      if (sport !== 'soccer' || soccer.finished) return;
      const user = socPlayers[0];
      if (soccer.ownerId !== user.id || user.tackleCooldown > 0) return;
      user.skillTimer = 0.36;
      user.tackleCooldown = 0.6;
      user.x = clamp(user.x + user.faceX * 26, socLeft + 14, socRight - 14);
      user.y = clamp(user.y + user.faceY * 22, socTop + 14, socBot - 14);
      let beat = false;
      for (const c of socPlayers) {
        if (c.team === 'cpu' && Math.hypot(c.x - user.x, c.y - user.y) < 58) {
          c.stunTimer = 1.0;
          beat = true;
        }
      }
      spawnParticles(user.x, user.y, '#38bdf8', 10, 100);
      playRetroSportTone(560, 900, 0.1, 'square', 0.07);
      if (beat) {
        soccer.bannerText = 'STEPOVER!! BEAT HIM!';
        soccer.bannerTimer = 0.85;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      } else if (
        e.code === 'KeyE' ||
        (sport === 'basketball' && e.code === 'KeyQ') ||
        (sport === 'football' && (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3'))
      ) {
        // Keep simple passing/screen keys ([E] Pass, [Q] Screen in Basketball, [1/2/3] in Football)
      } else {
        return;
      }
      if (!keysRef.current.has(e.code)) {
        keysRef.current.add(e.code);
        if (e.code === 'Space') {
          triggerPulseAction();
        } else if (e.code === 'KeyE') {
          if (sport === 'basketball' || sport === 'soccer' || sport === 'football' || sport === 'baseball') {
            triggerPassAction();
          }
        } else if (e.code === 'KeyQ' && sport === 'basketball') {
          triggerCallScreenAction();
        } else if (sport === 'football' && fb.possession === 'player' && fb.phase === 'live_pass') {
          if (e.code === 'Digit1') startFootballThrowMeter('wr1');
          else if (e.code === 'Digit2') startFootballThrowMeter('wr2');
          else if (e.code === 'Digit3') startFootballThrowMeter('rb');
        } else if (sport === 'golf' && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
          const dir = e.code === 'ArrowUp' ? 1 : -1;
          setGolfClubIdx((prev) => {
            const next = (prev + dir + GOLF_CLUBS.length) % GOLF_CLUBS.length;
            golfClubIdxRef.current = next;
            return next;
          });
        } else if (
          sport === 'football' &&
          fb.phase === 'huddle' &&
          (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp' || e.code === 'ArrowDown')
        ) {
          const step = e.code === 'ArrowRight' || e.code === 'ArrowDown' ? 1 : -1;
          if (fb.possession === 'player') {
            const plays = FOOTBALL_OFF_PLAYS.map((p) => p.id);
            const curIdx = plays.indexOf(footballPlayRef.current);
            const nextPlay = plays[(curIdx + step + plays.length) % plays.length];
            setFootballPlay(nextPlay);
            footballPlayRef.current = nextPlay;
            setupFootballSnapFormation(false);
            const meta = FOOTBALL_OFF_PLAYS.find((p) => p.id === nextPlay);
            fb.statusText = `AUDIBLE -> ${meta?.label || nextPlay.toUpperCase()}! · [SPACE] Snap!`;
            playRetroSportTone(480, 640, 0.08, 'square', 0.06);
          } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
            const defPlays = FOOTBALL_DEF_PLAYS.map((p) => p.id);
            const curIdx = defPlays.indexOf(footballDefPlayRef.current);
            const nextDef = defPlays[(curIdx + step + defPlays.length) % defPlays.length];
            setFootballDefPlay(nextDef);
            footballDefPlayRef.current = nextDef;
            alignPlayerDefensePreSnap();
            const meta = FOOTBALL_DEF_PLAYS.find((p) => p.id === nextDef);
            fb.statusText = `DEF AUDIBLE -> ${meta?.label || nextDef.toUpperCase()}! · Align & Lock!`;
            playRetroSportTone(380, 560, 0.08, 'triangle', 0.06);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
      if (
        e.code === 'Space' ||
        (sport === 'football' &&
          fb.throwCharging &&
          (e.code === 'KeyE' || e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3'))
      ) {
        releaseHoldAction();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
      const my = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
      pointerPosRef.current = { x: mx, y: my, active: true };
      if (e.button === 2 && sport === 'basketball') {
        e.preventDefault();
        triggerBballDribbleMove('tween', true);
        return;
      }
      virtualActionHeldRef.current = true;
      if (sport === 'football' && fb.possession === 'player' && fb.phase === 'live_pass' && fb.carrierId === 'qb') {
        const wr1 = fb.entities.find((en) => en.id === 'wr1');
        const wr2 = fb.entities.find((en) => en.id === 'wr2');
        if (wr1 && wr2) {
          const worldMx = mx + fb.camX;
          const d1 = Math.hypot(worldMx - wr1.x, my - wr1.y);
          const d2 = Math.hypot(worldMx - wr2.x, my - wr2.y);
          startFootballThrowMeter(d1 <= d2 ? 'wr1' : 'wr2');
          return;
        }
      }
      triggerPulseAction();
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (sport === 'basketball') e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
      const my = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
      pointerPosRef.current = { x: mx, y: my, active: true };
      if (sport === 'golf' && Math.hypot(golf.vx, golf.vy) < 2 && golf.ballZ <= 0.5 && !golf.charging) {
        golf.aimAngle = Math.atan2(my - golf.ballY, mx - golf.ballX);
      } else if (sport === 'baseball') {
        baseball.aimX = clamp(mx, homePlate.x - 36, homePlate.x + 36);
        baseball.aimY = clamp(my, homePlate.y - 26, homePlate.y + 26);
      } else if (sport === 'bowling' && bowling.phase === 'align') {
        bowling.ballX = clamp(mx, 282, 518);
      }
    };

    const handleMouseUp = () => {
      if (virtualActionHeldRef.current) {
        virtualActionHeldRef.current = false;
        releaseHoldAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    let rafId = 0;
    let lastTs = performance.now();
    let prevMoveX = 0;
    let prevMoveY = 0;

    const frame = (now: number) => {
      ctx.imageSmoothingEnabled = false;
      const dt = Math.min(0.04, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      hudSyncAccum += dt;

      if (virtualActionPulseRef.current) {
        virtualActionPulseRef.current = false;
        triggerPulseAction();
      }
      if (virtualPassPulseRef.current) {
        virtualPassPulseRef.current = false;
        triggerPassAction();
      }
      if (virtualScreenPulseRef.current) {
        virtualScreenPulseRef.current = false;
        if (sport === 'basketball') triggerCallScreenAction();
      }
      if (virtualCrossPulseRef.current) {
        virtualCrossPulseRef.current = false;
        if (sport === 'basketball') triggerBballDribbleMove('cross', true);
        else if (sport === 'soccer') triggerSoccerSkillMove();
      }
      if (virtualTweenPulseRef.current) {
        virtualTweenPulseRef.current = false;
        if (sport === 'basketball') triggerBballDribbleMove('tween', true);
      }
      if (virtualAltActionPulseRef.current) {
        virtualAltActionPulseRef.current = false;
        if (sport === 'football' && fb.possession === 'player' && fb.phase === 'live_pass') {
          throwFootballPass('wr2', 'player');
        }
      }

      const keys = keysRef.current;
      const moveX = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
      const moveY = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
      const sharpCutTriggered =
        (moveX !== 0 && prevMoveX !== 0 && moveX !== prevMoveX) ||
        (moveY !== 0 && prevMoveY !== 0 && moveY !== prevMoveY);
      const shiftDirTriggered =
        (moveX !== 0 && prevMoveX === 0 && prevMoveY !== 0) ||
        (moveY !== 0 && prevMoveY === 0 && prevMoveX !== 0);
      prevMoveX = moveX;
      prevMoveY = moveY;
      const actionHeld = keys.has('Space') || virtualActionHeldRef.current;

      // =====================================================================
      // 1. RETRO 16-BIT ICM INDOOR GYM BASKETBALL
      // =====================================================================
      if (sport === 'basketball') {
        if (bb.netSwishTimer > 0) bb.netSwishTimer = Math.max(0, bb.netSwishTimer - dt);
        if (bb.shakeTimer > 0) bb.shakeTimer = Math.max(0, bb.shakeTimer - dt);
        bb.ballSpin += dt * 9;

        if (!bb.finished) {
          bb.timeLeft = Math.max(0, bb.timeLeft - dt);
          if (bb.inbound) {
            bb.inbound.timer -= dt;
            if (bb.inbound.timer <= 0) {
              executeBballInboundPass();
            }
          } else {
            bb.shotClock = Math.max(0, bb.shotClock - dt);
          }
          if (bb.shotClock <= 0 && !bb.ballFlight && !bb.inbound) {
            bb.shotClock = 24;
            const nextPoss: 'player' | 'cpu' = bb.possession === 'player' ? 'cpu' : 'player';
            bb.bannerText = 'SHOT CLOCK VIOLATION!';
            bb.bannerTimer = 1.1;
            startBballInbound(nextPoss);
          }
          if (bb.timeLeft <= 0 || bb.scorePlayer >= bb.targetScore || bb.scoreCpu >= bb.targetScore) {
            bb.finished = true;
            playRetroSportTone(660, 880, 0.35, 'square', 0.1);
            syncHud(true);
          }
        }
        if (bb.bannerTimer > 0) bb.bannerTimer = Math.max(0, bb.bannerTimer - dt);

        if (!bb.finished) {
          const user = bbPlayers[0];
          if (user.stealCooldown > 0) user.stealCooldown = Math.max(0, user.stealCooldown - dt);
          if (user.crossTimer > 0) user.crossTimer = Math.max(0, user.crossTimer - dt);
          if (user.tweenTimer > 0) user.tweenTimer = Math.max(0, user.tweenTimer - dt);
          if (user.moveCooldown > 0) user.moveCooldown = Math.max(0, user.moveCooldown - dt);
          if (user.stunTimer > 0) user.stunTimer = Math.max(0, user.stunTimer - dt);
          if (user.bumpTimer > 0) user.bumpTimer = Math.max(0, user.bumpTimer - dt);
          if (user.bodyUpCooldown > 0) user.bodyUpCooldown = Math.max(0, user.bodyUpCooldown - dt);
          if (user.lastPassTimer > 0) user.lastPassTimer = Math.max(0, user.lastPassTimer - dt);
          if (user.blockTimer > 0) user.blockTimer = Math.max(0, user.blockTimer - dt);
          if (user.moveLabelTimer > 0) user.moveLabelTimer = Math.max(0, user.moveLabelTimer - dt);

          // Flying Tomahawk Dunk Choreography + Rim-Protection Dunk Blocks!
          if (bb.dunkAnim) {
            const da = bb.dunkAnim;
            const dunker = bbPlayers.find((p) => p.id === da.playerId);
            da.elapsed += dt;
            const flyT = clamp(da.elapsed / da.duration, 0, 1);
            const hoopDir = da.rimX > courtMidX ? 1 : -1;
            const landX = da.rimX - hoopDir * 14;
            const landY = da.rimY + 4;
            if (dunker) {
              dunker.x = da.startX + (landX - da.startX) * flyT;
              dunker.y = da.startY + (landY - da.startY) * flyT;
              dunker.faceX = hoopDir;
              if (flyT < 1) {
                dunker.jumpZ = Math.sin(flyT * Math.PI * 0.86) * 64;
              } else {
                const hangFrac = clamp((da.elapsed - da.duration) / da.hangTime, 0, 1);
                dunker.jumpZ = Math.max(0, 34 * (1 - hangFrac));
              }
              bb.ballX = flyT < 0.88 ? dunker.x + hoopDir * 8 : da.rimX;
              bb.ballY = flyT < 0.88 ? dunker.y : da.rimY;
              bb.ballZ = flyT < 0.88 ? dunker.jumpZ * 0.48 + 18 : 16;
            }

            // Mid-air dunk block check: unstunned rim defender can stuff the dunk and stun the dunker!
            if (!da.blockChecked && flyT >= 0.36 && flyT <= 0.86 && dunker) {
              da.blockChecked = true;
              let bestBlocker: BballPlayerEntity | null = null;
              let bestBlockerDist = 999;
              for (const def of bbPlayers) {
                if (def.team === da.team || def.stunTimer > 0) continue;
                const dToDunker = Math.hypot(def.x - dunker.x, def.y - dunker.y);
                const dToRim = Math.hypot(def.x - da.rimX, def.y - da.rimY);
                const reach = def.blockStat >= 88 ? 50 : 42;
                if ((dToDunker < reach || (dToRim < 46 && dToDunker < reach + 12)) && dToDunker < bestBlockerDist) {
                  bestBlockerDist = dToDunker;
                  bestBlocker = def;
                }
              }
              if (bestBlocker) {
                const rimDist = Math.hypot(bestBlocker.x - da.rimX, bestBlocker.y - da.rimY);
                let blockProb = 0;
                if (bestBlocker.isUser) {
                  const posBonus = (bestBlocker.blockStat - 60) * 0.004;
                  blockProb =
                    bestBlocker.blockTimer > 0
                      ? clamp(0.82 + posBonus * 0.4, 0.72, 0.94)
                      : bestBlockerDist < 24
                      ? clamp(0.24 + posBonus, 0.16, 0.48)
                      : 0;
                } else if (da.team === 'player') {
                  // Balanced CPU rim block rate — Centers protect the paint, guards rarely stuff bigs
                  const tightRimWall = bestBlockerDist < 29 || rimDist < 34;
                  const baseP = tightRimWall
                    ? isTourney || isBballSeason
                      ? 0.30
                      : 0.22
                    : isTourney || isBballSeason
                    ? 0.15
                    : 0.10;
                  blockProb = clamp(baseP + (bestBlocker.blockStat - dunker.strength) * 0.0034, 0.06, 0.48);
                } else {
                  blockProb = clamp(
                    (bestBlockerDist < 30 ? 0.22 : 0.11) + (bestBlocker.blockStat - 72) * 0.0035,
                    0.08,
                    0.46
                  );
                }

                if (blockProb > 0 && Math.random() < blockProb) {
                  bestBlocker.jumpVz = 225;
                  bestBlocker.blockTimer = 0.56;
                  bestBlocker.blk += 1;
                  bestBlocker.moveLabel = 'STUFFED!';
                  bestBlocker.moveLabelTimer = 0.95;
                  bb.dunkAnim = null;
                  dunker.stunTimer = 1.15;
                  dunker.jumpZ = 0;
                  dunker.jumpVz = 0;
                  dunker.vx = 0;
                  dunker.vy = 0;
                  dunker.x = clamp(dunker.x - hoopDir * 18, courtLeft + 18, courtRight - 18);
                  dunker.moveLabel = 'BLOCKED!';
                  dunker.moveLabelTimer = 1.0;
                  bb.ballZ = 0;
                  bb.looseBallVx = -hoopDir * 195;
                  bb.looseBallVy = (Math.random() - 0.5) * 200;
                  bb.looseBallZ = 28;
                  bb.looseBallVz = 85;
                  bb.isReboundLive = true;
                  bb.shakeTimer = 0.22;
                  bb.bannerText = 'REJECTED AT THE RIM!!';
                  bb.bannerTimer = 1.2;
                  bb.statusText =
                    da.team === 'player'
                      ? 'DUNK BLOCKED!! You are stunned — break the defender down first!'
                      : 'REJECTED AT THE RIM! Dunker stunned — grab the loose ball!';
                  spawnParticles(dunker.x, dunker.y + 8, '#ef4444', 18, 155);
                  spawnParticles(bb.ballX, bb.ballY, '#fde047', 16, 150);
                  playRetroSportTone(185, 80, 0.22, 'sawtooth', 0.1);
                } else if (bestBlockerDist < 42 && !bestBlocker.isUser) {
                  bestBlocker.jumpVz = 195;
                  bestBlocker.blockTimer = 0.42;
                }
              }
            }

            if (bb.dunkAnim && !da.slamFired && da.elapsed >= da.duration) {
              da.slamFired = true;
              bb.shakeTimer = 0.28;
              bb.netSwishTimer = 0.65;
              spawnParticles(da.rimX, da.rimY, da.willMake ? '#fde047' : '#ef4444', 24, 175);
              playRetroSportTone(da.willMake ? 185 : 120, da.willMake ? 820 : 80, 0.22, 'square', 0.1);
            }
            if (bb.dunkAnim && da.elapsed >= da.duration + da.hangTime) {
              if (dunker) dunker.jumpZ = 0;
              bb.dunkAnim = null;
              if (da.willMake) {
                if (dunker) {
                  dunker.pts += da.points;
                  dunker.fgm += 1;
                  if (dunker.lastPassTimer > 0 && dunker.lastPasserId && dunker.lastPasserId !== dunker.id) {
                    const passer = bbPlayers.find((pl) => pl.id === dunker.lastPasserId);
                    if (passer) passer.ast += 1;
                    dunker.lastPassTimer = 0;
                  }
                }
                if (da.team === 'player') {
                  bb.scorePlayer += da.points;
                  bb.bannerText = 'TOMAHAWK SLAM!! +2 PTS';
                } else {
                  bb.scoreCpu += da.points;
                  bb.bannerText = 'CPU SLAM DUNK! +2';
                }
                bb.bannerTimer = 1.3;
                const nextPoss: 'player' | 'cpu' = da.team === 'player' ? 'cpu' : 'player';
                startBballInbound(nextPoss);
              } else {
                bb.looseBallVx = -hoopDir * 135;
                bb.looseBallVy = (Math.random() - 0.5) * 165;
                bb.looseBallZ = 22;
                bb.looseBallVz = 65;
                bb.isReboundLive = true;
                bb.bannerText = 'RIMMED OUT!!';
                bb.bannerTimer = 0.9;
                bb.statusText = 'DUNK RIMMED OUT! Crash the glass!';
              }
            }
          }

          if (bb.inbound?.passerId === user.id) {
            user.vx = 0;
            user.vy = 0;
          } else if (!bb.dunkAnim || bb.dunkAnim.playerId !== user.id) {
            const stunned = user.stunTimer > 0;
            const speed = stunned
              ? 38
              : user.bumpTimer > 0
              ? 78
              : bb.shotCharging
              ? 55
              : bb.possession === 'cpu'
              ? 192 + user.speedStat * 0.84
              : 172 + user.speedStat * 0.88;
            const mLen = Math.hypot(moveX, moveY) || 1;
            user.vx = (moveX / mLen) * (moveX !== 0 || moveY !== 0 ? speed : 0);
            user.vy = (moveY / mLen) * (moveX !== 0 || moveY !== 0 ? speed : 0);
            user.x = clamp(user.x + user.vx * dt, courtLeft + 18, courtRight - 18);
            user.y = clamp(user.y + user.vy * dt, courtTop + 18, courtBot - 18);
            user.animTime += dt * (Math.hypot(user.vx, user.vy) > 12 ? 1.15 : 0.25);
            if (!stunned && (moveX !== 0 || moveY !== 0)) {
              user.faceX = moveX;
              user.faceY = moveY;
            }

            // Body-Up Drive Defense: defenders squared up in front of your drive can stop you sometimes!
            if (
              bb.carrierId === user.id &&
              !bb.dunkAnim &&
              !bb.shotCharging &&
              user.stunTimer <= 0 &&
              user.bumpTimer <= 0 &&
              user.crossTimer <= 0 &&
              user.tweenTimer <= 0 &&
              user.vx > 70
            ) {
              for (const d of bbPlayers) {
                if (d.team !== 'cpu' || d.stunTimer > 0 || d.bodyUpCooldown > 0) continue;
                if (
                  d.x > user.x - 4 &&
                  Math.abs(d.y - user.y) < 19 &&
                  Math.hypot(d.x - user.x, d.y - user.y) < 28
                ) {
                  d.bodyUpCooldown = 0.95;
                  const stopChance = clamp(
                    0.36 + (d.strength - user.strength) * 0.0055 - (user.drive - 78) * 0.004,
                    0.16,
                    0.54
                  );
                  if (Math.random() < stopChance) {
                    user.bumpTimer = 0.34;
                    user.x = clamp(user.x - 9, courtLeft + 18, courtRight - 18);
                    d.moveLabel = 'BODY UP!';
                    d.moveLabelTimer = 0.72;
                    bb.statusText = 'BODIED UP! Cross/tween around their hip, pass [E], or shoot!';
                    spawnParticles((user.x + d.x) * 0.5, user.y, '#fb923c', 8, 90);
                    playRetroSportTone(210, 145, 0.08, 'triangle', 0.06);
                  } else if (user.strength - d.strength >= 18) {
                    user.moveLabel = 'BULLY!';
                    user.moveLabelTimer = 0.55;
                  }
                  break;
                }
              }
            }
          }

          // Full-Court Backcourt Violation Check (both teams, skipped during inbound!)
          if (!isHalfCourt && !bb.inbound && !bb.dunkAnim && !bb.ballFlight && bb.carrierId) {
            const curCar = bbPlayers.find((c) => c.id === bb.carrierId);
            if (curCar) {
              if (bb.possession === 'player') {
                if (curCar.x > courtMidX + 16) bbFrontcourtReached = true;
                else if (bbFrontcourtReached && curCar.x < courtMidX - 10) {
                  bb.possession = 'cpu';
                  bb.carrierId = 'c_0';
                  bb.shotClock = 24;
                  bb.shotCharging = false;
                  bb.bannerText = 'BACKCOURT VIOLATION!!';
                  bb.bannerTimer = 1.25;
                  resetBballPositions('cpu');
                  bb.statusText = 'OVER & BACK! Turnover — CPU ball!';
                  playRetroSportTone(210, 120, 0.2, 'sawtooth', 0.08);
                }
              } else {
                if (curCar.x < courtMidX - 16) bbFrontcourtReached = true;
                else if (bbFrontcourtReached && curCar.x > courtMidX + 10) {
                  bb.possession = 'player';
                  bb.carrierId = 'p_0';
                  bb.shotClock = 24;
                  bb.bannerText = 'CPU BACKCOURT!! YOUR BALL!';
                  bb.bannerTimer = 1.25;
                  resetBballPositions('player');
                  bb.statusText = 'CPU crossed back over half court — Your ball!';
                  playRetroSportTone(620, 920, 0.16, 'square', 0.08);
                }
              }
            }
          }

          // Passive steal defense: crowding the CPU ball-handler occasionally forces a strip!
          if (!bb.dunkAnim && bb.possession === 'cpu' && bb.carrierId && bb.carrierId.startsWith('c_') && user.stealCooldown <= 0 && user.stunTimer <= 0) {
            const cpuCar = bbPlayers.find((c) => c.id === bb.carrierId);
            const passiveStealP = clamp(0.032 + (user.stealStat - 75) * 0.0005, 0.02, 0.055);
            if (cpuCar && cpuCar.crossTimer <= 0 && cpuCar.tweenTimer <= 0 && Math.hypot(cpuCar.x - user.x, cpuCar.y - user.y) < 23 && Math.random() < passiveStealP) {
              user.stealCooldown = 0.65;
              user.stl += 1;
              bb.carrierId = user.id;
              bb.possession = 'player';
              bb.shotClock = 24;
              bbFrontcourtReached = false;
              bb.bannerText = 'CLAMPED! STEAL!';
              bb.bannerTimer = 0.95;
              bb.statusText = 'Locked them up! Hold [SPACE] to shoot or [E] pass!';
              spawnParticles(user.x, user.y, '#38bdf8', 12, 110);
              playRetroSportTone(640, 960, 0.14, 'square', 0.08);
            }
          }

          // Track ball-handling rhythm, anti-mash fumble risk, and earned dribble moves!
          bb.mashHeat = Math.max(0, bb.mashHeat - dt * 1.15);
          bb.cpuWatchTimer = Math.max(0, bb.cpuWatchTimer - dt);
          bb.fumbleCooldown = Math.max(0, bb.fumbleCooldown - dt);

          if (!bb.dunkAnim && !bb.inbound && bb.carrierId === user.id && !bb.shotCharging && user.stunTimer <= 0) {
            const nowSec = now * 0.001;
            bb.anchorAge += dt;
            if (bb.anchorAge > 0.55) {
              bb.netAnchorX += (user.x - bb.netAnchorX) * 0.55;
              bb.netAnchorY += (user.y - bb.netAnchorY) * 0.55;
              bb.anchorAge = 0;
            }
            if (moveX !== 0 || moveY !== 0) {
              if (moveX !== bb.lastDirSignX || moveY !== bb.lastDirSignY) {
                const gap = nowSec - bb.lastDirChangeTime;
                if (gap < 0.36) {
                  bb.mashHeat += (sharpCutTriggered ? 0.82 : 0.56) * (gap < 0.2 ? 1.25 : 1.0);
                } else if (gap < 0.55) {
                  bb.mashHeat += 0.24;
                }
                if (sharpCutTriggered) {
                  bb.dirHoldTime = 0;
                } else if (gap < 0.28) {
                  bb.dirHoldTime = Math.max(0, bb.dirHoldTime - 0.14);
                }
                bb.lastDirSignX = moveX;
                bb.lastDirSignY = moveY;
                bb.lastDirChangeTime = nowSec;
              } else {
                bb.dirHoldTime += dt;
              }
            } else {
              bb.dirHoldTime = Math.max(0, bb.dirHoldTime - dt * 2.5);
            }

            if (bb.mashHeat > 1.0) {
              bb.cpuWatchTimer = Math.max(bb.cpuWatchTimer, 1.05);
            }

            let nearestCpuDef: BballPlayerEntity | null = null;
            let nearbyDefDist = 999;
            for (const d of bbPlayers) {
              if (d.team !== 'cpu' || d.stunTimer > 0) continue;
              const dd = Math.hypot(d.x - user.x, d.y - user.y);
              if (dd < nearbyDefDist) {
                nearbyDefDist = dd;
                nearestCpuDef = d;
              }
            }

            // Mashing arrow keys recklessly risks fumbling the handle!
            let fumbledOnMash = false;
            if ((sharpCutTriggered || shiftDirTriggered) && bb.mashHeat > 1.55 && bb.fumbleCooldown <= 0) {
              const fumbleChance = nearbyDefDist < 48 ? 0.35 : nearbyDefDist < 95 ? 0.22 : bb.mashHeat > 2.2 ? 0.2 : 0;
              if (fumbleChance > 0 && Math.random() < fumbleChance) {
                fumbledOnMash = true;
                bb.fumbleCooldown = 1.4;
                bb.mashHeat = 0.4;
                bb.carrierId = null;
                user.stunTimer = 0.65;
                user.vx = 0;
                user.vy = 0;
                user.moveLabel = 'FUMBLED!';
                user.moveLabelTimer = 0.95;
                const pushAng = nearestCpuDef
                  ? Math.atan2(nearestCpuDef.y - user.y, nearestCpuDef.x - user.x)
                  : (Math.random() - 0.5) * 1.4;
                bb.looseBallVx = Math.cos(pushAng) * 165;
                bb.looseBallVy = Math.sin(pushAng) * 165;
                bb.looseBallZ = 14;
                bb.looseBallVz = 68;
                bb.bannerText = 'SLOPPY HANDLE! FUMBLED!';
                bb.bannerTimer = 1.05;
                bb.statusText = 'Lost the ball mashing arrow keys! Setup moves cleanly with momentum!';
                spawnParticles(user.x, user.y + 6, '#ef4444', 14, 125);
                playRetroSportTone(210, 105, 0.18, 'sawtooth', 0.08);
              }
            }

            // Arrow-key Cross / Tween only breaks ankles when set up cleanly — mashing won't fool the CPU!
            if (!fumbledOnMash && (sharpCutTriggered || shiftDirTriggered) && user.moveCooldown <= 0) {
              if (
                (sharpCutTriggered && nearbyDefDist < 96) ||
                (shiftDirTriggered && nearbyDefDist < 80 && Math.random() < 0.36)
              ) {
                triggerBballDribbleMove(sharpCutTriggered ? 'tween' : Math.random() < 0.52 ? 'tween' : 'cross', false);
              }
            }
          }

          if (!bb.dunkAnim && (user.jumpZ > 0 || user.jumpVz > 0)) {
            user.jumpZ = Math.max(0, user.jumpZ + user.jumpVz * dt);
            user.jumpVz -= 420 * dt;
            if (user.jumpZ <= 0) user.jumpVz = 0;
          }

          // Faster shot meter fill!
          if (bb.shotCharging && actionHeld && bb.carrierId === user.id) {
            const win = computeBballShotWindow(user, hoopRight);
            bb.shotGreenStart = win.greenStart;
            bb.shotGreenWidth = win.greenWidth;
            bb.shotDifficultyLabel = win.label;
            bb.shotCharge += dt * 3.15;
            if (bb.shotCharge >= 1.0) {
              bb.shotCharge = 1.0;
              releaseHoldAction();
            }
          } else if (bb.shotCharging && !actionHeld) {
            releaseHoldAction();
          }

          const offenseHoop = bb.possession === 'player' ? hoopRight : isHalfCourt ? hoopRight : hoopLeft;
          const offDirToCenter: -1 | 1 = offenseHoop.x > courtMidX ? -1 : 1;
          const carrierEntity = bbPlayers.find((e) => e.id === bb.carrierId) || null;
          const isLooseOrRebound = !bb.carrierId && (!bb.ballFlight || bb.ballFlight.isShot);

          // Limit rebound crashers to top-2 closest per team so players don't all dog-pile the paint!
          const reboundCrashIds = new Set<string>();
          if (isLooseOrRebound) {
            const targetRebX = bb.ballFlight ? bb.ballFlight.reboundX : bb.ballX;
            const targetRebY = bb.ballFlight ? bb.ballFlight.reboundY : bb.ballY;
            for (const tm of ['player', 'cpu'] as const) {
              const sorted = bbPlayers
                .filter((pl) => pl.team === tm)
                .sort(
                  (a, b) =>
                    Math.hypot(a.x - targetRebX, a.y - targetRebY) -
                    Math.hypot(b.x - targetRebX, b.y - targetRebY)
                );
              sorted.slice(0, 2).forEach((pl) => reboundCrashIds.add(pl.id));
            }
          }

          if (bb.screen) {
            if (bb.possession !== 'player' || bb.dunkAnim || bb.inbound) {
              bb.screen = null;
            } else {
              bb.screen.timer -= dt;
              if (bb.screen.timer <= 0) {
                bb.screen = null;
              }
            }
          }

            for (let i = 1; i < bbPlayers.length; i++) {
            const p = bbPlayers[i];
            if (bb.dunkAnim && bb.dunkAnim.playerId === p.id) continue;
            if (bb.inbound?.passerId === p.id) {
              p.vx = 0;
              p.vy = 0;
              continue;
            }
            if (p.stealCooldown > 0) p.stealCooldown = Math.max(0, p.stealCooldown - dt);
            if (p.crossTimer > 0) p.crossTimer = Math.max(0, p.crossTimer - dt);
            if (p.tweenTimer > 0) p.tweenTimer = Math.max(0, p.tweenTimer - dt);
            if (p.moveCooldown > 0) p.moveCooldown = Math.max(0, p.moveCooldown - dt);
            if (p.stunTimer > 0) p.stunTimer = Math.max(0, p.stunTimer - dt);
            if (p.bumpTimer > 0) p.bumpTimer = Math.max(0, p.bumpTimer - dt);
            if (p.bodyUpCooldown > 0) p.bodyUpCooldown = Math.max(0, p.bodyUpCooldown - dt);
            if (p.lastPassTimer > 0) p.lastPassTimer = Math.max(0, p.lastPassTimer - dt);
            if (p.blockTimer > 0) p.blockTimer = Math.max(0, p.blockTimer - dt);
            if (p.moveLabelTimer > 0) p.moveLabelTimer = Math.max(0, p.moveLabelTimer - dt);
            p.animTime += dt;

            if (p.jumpZ > 0 || p.jumpVz > 0) {
              p.jumpZ = Math.max(0, p.jumpZ + p.jumpVz * dt);
              p.jumpVz -= 420 * dt;
              if (p.jumpZ <= 0) p.jumpVz = 0;
            }

            // Stunned defender (ankle-broken by cross or tween!) stumbles in place
            if (p.stunTimer > 0) {
              p.vx = 0;
              p.vy = 0;
              continue;
            }

            const slotIdx = parseInt(p.id.split('_')[1] || '0', 10);
            let tx = p.x;
            let ty = p.y;
            let pSpeed = 148 + p.speedStat * 0.25;
            let isDisciplinedWatch = false;

            if (isLooseOrRebound && !bb.dunkAnim) {
              if (reboundCrashIds.has(p.id)) {
                tx = bb.ballFlight ? bb.ballFlight.reboundX : bb.ballX;
                ty = bb.ballFlight ? bb.ballFlight.reboundY : bb.ballY;
                pSpeed = p.team === 'cpu' ? (172 + p.reboundStat * 0.26) * cpuSpeedScale : 178 + p.reboundStat * 0.24;
              } else {
                // Non-rebounders hold perimeter / leak out cleanly!
                const slot = getBballOffenseSlot(slotIdx, offenseHoop.x, offDirToCenter, p.position);
                tx = clamp((slot.x + courtMidX) * 0.5, courtLeft + 44, courtRight - 44);
                ty = slot.y;
                pSpeed = 142;
              }
            } else if (p.team === bb.possession) {
              if (bb.carrierId === p.id) {
                let nearestGuard: BballPlayerEntity | null = null;
                let nearestGuardDist = 999;
                for (const d of bbPlayers) {
                  if (d.team === p.team) continue;
                  const dd = Math.hypot(d.x - p.x, d.y - p.y);
                  if (dd < nearestGuardDist) {
                    nearestGuardDist = dd;
                    nearestGuard = d;
                  }
                }
                const hoopDirX = p.team === 'player' ? 1 : isHalfCourt ? 1 : -1;
                if (p.team === 'cpu') {
                  const guardStunned = Boolean(nearestGuard && nearestGuard.stunTimer > 0);
                  const openLane = guardStunned || nearestGuardDist > 62 || user.stunTimer > 0;
                  if (openLane) {
                    // Explosive rim attack when lane opens or defender is stunned!
                    tx = offenseHoop.x - hoopDirX * 34;
                    ty = offenseHoop.y + Math.sin(now * 0.0028 + p.seed) * 14;
                    pSpeed = (guardStunned || user.stunTimer > 0 ? 220 : 196) * cpuSpeedScale;
                  } else if (nearestGuard) {
                    // Angle around tight on-ball defender toward the open high/low driving hip
                    const dodgeDirY = p.y <= nearestGuard.y ? -1 : 1;
                    tx = clamp(p.x + hoopDirX * 72, courtLeft + 34, courtRight - 34);
                    ty = clamp(p.y + dodgeDirY * 54, courtTop + 32, courtBot - 32);
                    pSpeed = 184 * cpuSpeedScale;
                  }

                  // User Body-Up defense vs CPU drive!
                  if (
                    user.stunTimer <= 0 &&
                    user.bodyUpCooldown <= 0 &&
                    p.bumpTimer <= 0 &&
                    p.crossTimer <= 0 &&
                    p.tweenTimer <= 0 &&
                    Math.hypot(user.x - p.x, user.y - p.y) < 28 &&
                    Math.abs(user.y - p.y) < 20 &&
                    (offenseHoop.x - p.x) * (user.x - p.x) > 0
                  ) {
                    user.bodyUpCooldown = 0.9;
                    const stopChance = clamp(0.32 + (user.strength - p.strength) * 0.006, 0.14, 0.56);
                    if (Math.random() < stopChance) {
                      p.bumpTimer = 0.34;
                      const backDir = Math.sign(offenseHoop.x - p.x) || 1;
                      p.x = clamp(p.x - backDir * 9, courtLeft + 18, courtRight - 18);
                      user.moveLabel = 'BODY UP!';
                      user.moveLabelTimer = 0.72;
                      bb.statusText = 'BODIED THEM UP! Stay squared or tap [SPACE] for steal!';
                      spawnParticles((user.x + p.x) * 0.5, p.y, '#38bdf8', 8, 90);
                      playRetroSportTone(240, 175, 0.08, 'triangle', 0.06);
                    }
                  }
                } else {
                  const driveAngleY = Math.sin(now * 0.0022 + p.seed) * 42;
                  tx = offenseHoop.x - 84;
                  ty = clamp(offenseHoop.y + p.roleOffset * 0.25 + driveAngleY, courtTop + 34, courtBot - 34);
                  pSpeed = 188;
                }

                // CPU Ankle-Breaker Cross / Tween with real directional burst!
                if (p.team === 'cpu' && p.moveCooldown <= 0 && nearestGuardDist < 84 && Math.random() < 0.048) {
                  p.moveCooldown = 1.3;
                  p.dribbleHand = p.dribbleHand === 1 ? -1 : 1;
                  const burstDirY = nearestGuard ? (p.y <= nearestGuard.y ? -1 : 1) : p.dribbleHand;
                  const isTween = Math.random() >= 0.42;
                  if (!isTween) {
                    p.crossTimer = 0.34;
                    p.moveLabel = 'CROSS!';
                    p.x = clamp(p.x + hoopDirX * 14, courtLeft + 20, courtRight - 20);
                    p.y = clamp(p.y + burstDirY * 22, courtTop + 20, courtBot - 20);
                  } else {
                    p.tweenTimer = 0.38;
                    p.moveLabel = 'TWEEN!';
                    p.x = clamp(p.x + hoopDirX * 20, courtLeft + 20, courtRight - 20);
                    p.y = clamp(p.y + burstDirY * 16, courtTop + 20, courtBot - 20);
                  }
                  p.moveLabelTimer = 0.65;
                  // Can break YOUR ankles if you sprint recklessly or over-commit!
                  const userDist = Math.hypot(user.x - p.x, user.y - p.y);
                  const userFast = Math.hypot(user.vx, user.vy) > 120;
                  if (userDist < 62 && user.stunTimer <= 0 && Math.random() < (userFast ? 0.4 : 0.22)) {
                    user.stunTimer = 0.78;
                    user.vx = 0;
                    user.vy = 0;
                    user.moveLabel = 'ANKLES!';
                    user.moveLabelTimer = 0.78;
                    bb.bannerText = `CPU ${p.moveLabel} BROKE YOUR ANKLES!!`;
                    bb.bannerTimer = 1.05;
                    bb.statusText = 'STUMBLED! Stay patient on defense to avoid ankle breakers!';
                    spawnParticles(user.x, user.y + 8, '#ef4444', 14, 130);
                    playRetroSportTone(240, 110, 0.16, 'sawtooth', 0.08);
                  }
                }

                // Crisp Drive-and-Kick / Find Open Cutter Passing!
                if (
                  p.team === 'cpu' &&
                  !bb.ballFlight &&
                  bb.shotClock > 4 &&
                  ((nearestGuardDist < 52 && Math.random() < 0.055) || Math.random() < 0.018)
                ) {
                  const myDistToHoop = Math.hypot(offenseHoop.x - p.x, offenseHoop.y - p.y);
                  const openMate = bbPlayers
                    .filter((m) => m.team === 'cpu' && m.id !== p.id)
                    .map((m) => ({
                      mate: m,
                      sep: Math.min(...bbPlayers.filter((d) => d.team === 'player').map((d) => Math.hypot(d.x - m.x, d.y - m.y))),
                      distToHoop: Math.hypot(offenseHoop.x - m.x, offenseHoop.y - m.y),
                    }))
                    .filter((item) => item.sep > 54 && (item.distToHoop < myDistToHoop + 24 || item.distToHoop < 225))
                    .sort((a, b) => a.distToHoop - b.distToHoop)[0];
                  if (openMate) {
                    bb.carrierId = null;
                    bb.ballFlight = {
                      startX: p.x,
                      startY: p.y,
                      targetX: openMate.mate.x,
                      targetY: openMate.mate.y,
                      reboundX: openMate.mate.x,
                      reboundY: openMate.mate.y,
                      elapsed: 0,
                      duration: 0.2,
                      isShot: false,
                      willMake: false,
                      points: 0,
                      passToId: openMate.mate.id,
                      shooterId: p.id,
                      shooterTeam: 'cpu',
                    };
                    bb.cpuShootTimer = openMate.distToHoop < 210 ? 0.36 : 0.55;
                    bb.statusText = `CPU kicks to ${openMate.mate.name.split(' ')[0]} (${openMate.mate.position})!`;
                    continue;
                  }
                }

                if (p.team === 'player') {
                  bb.cpuShootTimer -= dt;
                  const dHoop = Math.hypot(offenseHoop.x - p.x, offenseHoop.y - p.y);
                  const tmWin = computeBballShotWindow(p, offenseHoop);
                  const sniperReady = p.shoot3 >= 86 && tmWin.isThree && tmWin.nearestDefDist > 58 && dHoop < 235;
                  if (
                    bb.cpuShootTimer <= 0 ||
                    dHoop < 84 ||
                    sniperReady ||
                    (tmWin.nearestDefDist > 64 && dHoop < 220 && bb.cpuShootTimer < 0.35)
                  ) {
                    launchBballTeammateShot(p);
                    bb.cpuShootTimer = 0.85;
                  }
                } else {
                  bb.cpuShootTimer -= dt;
                  const dHoop = Math.hypot(offenseHoop.x - p.x, offenseHoop.y - p.y);
                  const cpuWin = computeBballShotWindow(p, offenseHoop);
                  const cpuDunkRange = 72 + Math.round((p.drive + p.strength - 150) * 0.24);
                  const sniperPullUp = p.shoot3 >= 86 && cpuWin.isThree && cpuWin.nearestDefDist > 54 && dHoop < 235;
                  const isGreatOpenLook =
                    (cpuWin.nearestDefDist > 56 && dHoop < 225 && bb.cpuShootTimer < 0.45) || sniperPullUp;
                  const shouldHoldForBetterShot =
                    dHoop >= cpuDunkRange && cpuWin.nearestDefDist < 38 && bb.shotClock > 4.5 && bb.cpuShootTimer > -0.45;
                  if ((bb.cpuShootTimer <= 0 && !shouldHoldForBetterShot) || dHoop < cpuDunkRange || isGreatOpenLook) {
                    const contestPen =
                      cpuWin.nearestDefDist < 42 ? 0.22 : cpuWin.nearestDefDist < 72 ? 0.1 : 0;
                    const shooterEdge = cpuWin.isThree
                      ? (p.shoot3 - 80) * 0.006
                      : dHoop < cpuDunkRange
                      ? (p.drive + p.strength - 155) * 0.003
                      : (p.mid - 80) * 0.005;
                    const makeProb = cpuWin.isHalfCourtHeave
                      ? 0.06
                      : dHoop < cpuDunkRange
                      ? cpuWin.nearestDefDist < 32
                        ? clamp(0.68 + shooterEdge, 0.56, 0.86)
                        : 0.91
                      : cpuWin.isThree
                      ? clamp((isTourney || isBballSeason ? 0.36 : 0.31) + shooterEdge + cpuWin.greenWidth * 1.15 * cpuReactionMult - contestPen, 0.12, 0.58)
                      : clamp((isTourney || isBballSeason ? 0.48 : 0.42) + shooterEdge + cpuWin.greenWidth * 1.2 * cpuReactionMult - contestPen, 0.2, 0.74);

                    if (cpuWin.nearestDefDist < 42) {
                      const closeP = bbPlayers
                        .filter((pl) => pl.team === 'player')
                        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
                      if (closeP && !closeP.isUser) {
                        closeP.blockTimer = 0.38;
                        closeP.jumpVz = 180;
                      }
                    }

                    if (dHoop < cpuDunkRange) {
                      startBballDunkAnim(p, offenseHoop, 'cpu', Math.random() < makeProb);
                      bb.cpuShootTimer = clamp(1.35 / cpuReactionMult, 0.85, 1.55);
                      continue;
                    }

                    p.fga += 1;
                    if (cpuWin.isThree) p.tpa += 1;
                    bb.carrierId = null;
                    bb.isReboundLive = false;
                    bb.ballFlight = {
                      startX: p.x,
                      startY: p.y,
                      targetX: offenseHoop.x,
                      targetY: offenseHoop.y,
                      reboundX: clamp(offenseHoop.x + (isHalfCourt ? -65 : 65), courtLeft + 32, courtRight - 32),
                      reboundY: clamp(offenseHoop.y + (Math.random() - 0.5) * 140, courtTop + 32, courtBot - 32),
                      elapsed: 0,
                      duration: 0.46,
                      isShot: true,
                      willMake: Math.random() < makeProb,
                      points: cpuWin.isThree ? 3 : 2,
                      shooterId: p.id,
                      shooterTeam: 'cpu',
                    };
                    if (contestPen > 0.18) {
                      bb.statusText = 'HEAVILY CONTESTED! Tap [SPACE] to swat or box out!';
                    }
                    bb.cpuShootTimer = clamp(1.35 / cpuReactionMult, 0.85, 1.55);
                  }
                }
              } else if (bb.screen && p.id === bb.screen.screenerId) {
                const scr = bb.screen;
                if (scr.rollTimer > 0) {
                  scr.rollTimer -= dt;
                  const distToRim = Math.hypot(offenseHoop.x - p.x, offenseHoop.y - p.y);
                  if (p.shoot3 >= 82 && distToRim > 135) {
                    // Pick-and-Pop out to the open 3PT arc!
                    tx = clamp(offenseHoop.x - 165, courtLeft + 44, courtRight - 44);
                    ty = clamp(user.y + scr.sideY * 68, courtTop + 34, courtBot - 34);
                  } else {
                    // Hard Pick-and-Roll dive straight to the rim!
                    tx = clamp(offenseHoop.x - 42, courtLeft + 36, courtRight - 36);
                    ty = clamp(offenseHoop.y + scr.sideY * 22, courtTop + 30, courtBot - 30);
                  }
                  pSpeed = 212;
                  if (scr.rollTimer <= 0) {
                    bb.screen = null;
                  }
                } else {
                  const tDef = scr.targetDefId
                    ? bbPlayers.find((d) => d.id === scr.targetDefId && d.stunTimer <= 0)
                    : null;
                  if (tDef && Math.hypot(tDef.x - user.x, tDef.y - user.y) < 115) {
                    tx = clamp(tDef.x - 12, courtLeft + 26, courtRight - 26);
                    ty = clamp(tDef.y + scr.sideY * 18, courtTop + 26, courtBot - 26);
                  } else {
                    tx = clamp(user.x + 26, courtLeft + 26, courtRight - 26);
                    ty = clamp(user.y + scr.sideY * 22, courtTop + 26, courtBot - 26);
                  }

                  const distToPick = Math.hypot(tx - p.x, ty - p.y);
                  if (!scr.engaged) {
                    pSpeed = 236;
                    if (distToPick <= 16) {
                      scr.engaged = true;
                      p.vx = 0;
                      p.vy = 0;
                      p.moveLabel = 'PICK SET!';
                      p.moveLabelTimer = 0.75;
                      playRetroSportTone(340, 260, 0.06, 'triangle', 0.05);
                    }
                  } else {
                    tx = p.x;
                    ty = p.y;
                    pSpeed = 0;
                    p.vx *= 0.35;
                    p.vy *= 0.35;
                    p.faceX = -1;
                    p.faceY = 0;

                    for (const d of bbPlayers) {
                      if (d.team !== 'cpu' || d.stunTimer > 0) continue;
                      const dxD = d.x - p.x;
                      const dyD = d.y - p.y;
                      const distD = Math.hypot(dxD, dyD);
                      if (distD < 32) {
                        const nx = distD > 0.01 ? dxD / distD : 1;
                        const ny = distD > 0.01 ? dyD / distD : scr.sideY;
                        d.x = clamp(p.x + nx * 32, courtLeft + 18, courtRight - 18);
                        d.y = clamp(p.y + ny * 32, courtTop + 18, courtBot - 18);
                        d.vx *= 0.14;
                        d.vy *= 0.14;
                        d.bumpTimer = Math.max(d.bumpTimer, 0.54);
                        if (!scr.screenedTriggered) {
                          scr.screenedTriggered = true;
                          scr.rollTimer = 1.15;
                          d.moveLabel = 'SCREENED!';
                          d.moveLabelTimer = 0.85;
                          bb.statusText = 'BRICK WALL SCREEN!! Drive the open lane or hit [E] on the roll!';
                          spawnParticles((p.x + d.x) * 0.5, p.y, '#fbbf24', 10, 110);
                          playRetroSportTone(240, 150, 0.1, 'square', 0.07);
                        }
                      }
                    }
                  }
                }
              } else {
                // Realistic 5-out / Cut-and-Replace Off-Ball Motion!
                if ((p.cutTimer ?? 0) > 0) {
                  p.cutTimer = Math.max(0, (p.cutTimer ?? 0) - dt);
                  tx = p.cutTargetX ?? offenseHoop.x + offDirToCenter * 52;
                  ty = p.cutTargetY ?? offenseHoop.y;
                  pSpeed = p.team === 'cpu' ? 190 * cpuSpeedScale : 182;
                } else {
                  const slot = getBballOffenseSlot(slotIdx, offenseHoop.x, offDirToCenter, p.position);
                  tx = slot.x;
                  ty = slot.y;
                  // Relocate away from ballhandler so floor stays wide open for drives & kickouts
                  if (carrierEntity && Math.hypot(carrierEntity.x - slot.x, carrierEntity.y - slot.y) < 76) {
                    ty = slot.y < courtMidY ? courtBot - 44 : courtTop + 44;
                    tx = clamp(offenseHoop.x + offDirToCenter * 138, courtLeft + 44, courtRight - 44);
                  }
                  const cutChance = p.team === 'cpu' ? 0.011 : 0.005;
                  if (Math.random() < cutChance) {
                    p.cutTimer = 1.35;
                    p.cutTargetX = clamp(offenseHoop.x + offDirToCenter * 46, courtLeft + 36, courtRight - 36);
                    p.cutTargetY = slotIdx % 2 === 0 ? offenseHoop.y - 42 : offenseHoop.y + 42;
                  }
                  pSpeed = p.team === 'cpu' ? 170 * cpuSpeedScale : 164;
                }
              }
            } else {
              const offRoster = bbPlayers.filter((o) => o.team !== p.team);
              const myIdx = slotIdx % Math.max(1, offRoster.length);
              const myMan = offRoster[myIdx] || bbPlayers[0];
              const isGuardingCarrier = carrierEntity && myMan.id === carrierEntity.id;

              isDisciplinedWatch =
                p.team === 'cpu' &&
                Boolean(isGuardingCarrier) &&
                Boolean(carrierEntity?.isUser) &&
                (bb.cpuWatchTimer > 0 || bb.mashHeat > 0.95);

              if (isGuardingCarrier && carrierEntity) {
                const hoopToDef = bb.possession === 'player' ? hoopRight : isHalfCourt ? hoopRight : hoopLeft;
                const angle = Math.atan2(hoopToDef.y - carrierEntity.y, hoopToDef.x - carrierEntity.x);
                // Disciplined stance watches mashing squarely; standard defense keeps tighter pressure
                const gap =
                  p.team === 'cpu' && bb.shotCharging
                    ? 24
                    : isDisciplinedWatch
                    ? 31
                    : p.team === 'player'
                    ? 28
                    : 35;
                tx = carrierEntity.x + Math.cos(angle) * gap;
                ty = carrierEntity.y + Math.sin(angle) * gap;
                pSpeed =
                  p.team === 'cpu'
                    ? (bb.shotCharging ? 196 : isDisciplinedWatch ? 172 : 163) * cpuSpeedScale
                    : 184;

                if (
                  p.team === 'cpu' &&
                  p.stealCooldown <= 0 &&
                  (isDisciplinedWatch || (carrierEntity.crossTimer <= 0 && carrierEntity.tweenTimer <= 0)) &&
                  Math.hypot(p.x - carrierEntity.x, p.y - carrierEntity.y) < (isDisciplinedWatch ? 24 : 21)
                ) {
                  p.stealCooldown = isDisciplinedWatch ? 1.3 : 1.7;
                  const pickChance = clamp(
                    (isDisciplinedWatch ? 0.20 : 0.10) + (p.stealStat - 75) * 0.0018,
                    0.05,
                    0.28
                  );
                  if (Math.random() < pickChance) {
                    p.stl += 1;
                    bb.carrierId = p.id;
                    bb.possession = 'cpu';
                    bb.shotClock = 24;
                    bb.shotCharging = false;
                    bbFrontcourtReached = false;
                    bb.bannerText = 'PICKPOCKETED!';
                    bb.bannerTimer = 0.9;
                    bb.statusText = isDisciplinedWatch
                      ? 'CPU stayed disciplined on the mash and poked it loose!'
                      : 'Defender poked it loose! Set up a clean move or pass!';
                    playRetroSportTone(240, 130, 0.14, 'sawtooth', 0.08);
                  }
                }
              } else if (
                p.team === 'cpu' &&
                carrierEntity &&
                Math.hypot(offenseHoop.x - carrierEntity.x, offenseHoop.y - carrierEntity.y) < 110 &&
                myIdx === 1
              ) {
                // Single weakside help defender rotates to protect the rim
                tx = (carrierEntity.x + offenseHoop.x) * 0.5;
                ty = (carrierEntity.y + offenseHoop.y) * 0.5;
                pSpeed = 176 * cpuSpeedScale;
              } else {
                // Pack-line / help-shell off-ball positioning between man & paint
                const hoopToDef = bb.possession === 'player' ? hoopRight : isHalfCourt ? hoopRight : hoopLeft;
                const ang = Math.atan2(hoopToDef.y - myMan.y, hoopToDef.x - myMan.x);
                tx = clamp(myMan.x + Math.cos(ang) * 52, courtLeft + 26, courtRight - 26);
                ty = clamp(myMan.y + Math.sin(ang) * 52, courtTop + 26, courtBot - 26);
                pSpeed = 154 * cpuSpeedScale;
              }
            }

            if (p.bumpTimer > 0) pSpeed = Math.min(pSpeed, 72);
            const dx = tx - p.x;
            const dy = ty - p.y;
            const dist = Math.hypot(dx, dy);
            const desiredVx = dist > 4 ? (dx / dist) * pSpeed : 0;
            const desiredVy = dist > 4 ? (dy / dist) * pSpeed : 0;
            // Disciplined CPU watching a masher stays squared up; normal defense tracks laterally with crisp reaction
            const inertiaRate =
              p.team === 'cpu' && p.team !== bb.possession
                ? isDisciplinedWatch
                  ? 9.2
                  : 6.4
                : 11.5;
            p.vx += (desiredVx - p.vx) * Math.min(1, dt * inertiaRate);
            p.vy += (desiredVy - p.vy) * Math.min(1, dt * inertiaRate);
            p.x = clamp(p.x + p.vx * dt, courtLeft + 18, courtRight - 18);
            p.y = clamp(p.y + p.vy * dt, courtTop + 18, courtBot - 18);
            if (dist > 6) {
              p.faceX = dx / dist;
              p.faceY = dy / dist;
            }
          }

          // Anti-clumping pairwise soft collision separation!
          const minSep = 28;
          for (let a = 0; a < bbPlayers.length; a++) {
            for (let b = a + 1; b < bbPlayers.length; b++) {
              const pa = bbPlayers[a];
              const pb = bbPlayers[b];
              const dx = pb.x - pa.x;
              const dy = pb.y - pa.y;
              const d = Math.hypot(dx, dy);
              if (d < minSep) {
                const nx = d > 0.01 ? dx / d : a % 2 === 0 ? 1 : -1;
                const ny = d > 0.01 ? dy / d : 0.4;
                const overlap = (minSep - d) * 0.5;
                if (!pa.isUser) {
                  pa.x = clamp(pa.x - nx * overlap, courtLeft + 18, courtRight - 18);
                  pa.y = clamp(pa.y - ny * overlap, courtTop + 18, courtBot - 18);
                }
                if (!pb.isUser) {
                  pb.x = clamp(pb.x + nx * overlap, courtLeft + 18, courtRight - 18);
                  pb.y = clamp(pb.y + ny * overlap, courtTop + 18, courtBot - 18);
                }
              }
            }
          }

          if (bb.ballFlight) {
            const fl = bb.ballFlight;
            fl.elapsed += dt;
            const t = clamp(fl.elapsed / fl.duration, 0, 1);
            bb.ballX = fl.startX + (fl.targetX - fl.startX) * t;
            bb.ballY = fl.startY + (fl.targetY - fl.startY) * t;
            bb.ballZ = Math.sin(t * Math.PI) * (fl.isShot ? 74 : 22);

            if (!fl.isShot && t > 0.25 && t < 0.8) {
              for (const d of bbPlayers) {
                if (d.team !== fl.shooterTeam && d.stunTimer <= 0 && Math.hypot(d.x - bb.ballX, d.y - bb.ballY) < 19) {
                  d.stl += 1;
                  bb.ballFlight = null;
                  bb.ballZ = 0;
                  bb.carrierId = d.id;
                  bb.possession = d.team;
                  bb.shotClock = 24;
                  bbFrontcourtReached = false;
                  bb.bannerText = 'PASS INTERCEPTED!';
                  bb.bannerTimer = 1.1;
                  bb.statusText = d.team === 'cpu' ? 'CPU jumped the passing lane!' : 'Great steal in the lane!';
                  playRetroSportTone(260, 140, 0.14, 'sawtooth', 0.08);
                  break;
                }
              }
            }

            if (bb.ballFlight && t >= 1) {
              bb.ballFlight = null;
              bb.ballZ = 0;
              if (!fl.isShot && fl.passToId) {
                bb.carrierId = fl.passToId;
                const receiver = bbPlayers.find((p) => p.id === fl.passToId);
                if (receiver && fl.shooterId) {
                  receiver.lastPasserId = fl.shooterId;
                  receiver.lastPassTimer = 3.8;
                }
                if (fl.passToId.startsWith('p_') && fl.passToId !== 'p_0') {
                  bb.cpuShootTimer = 0.65;
                  bb.statusText = 'Teammate got it! [SPACE] Shoot Now or [E] Call Back!';
                }
              } else if (fl.isShot) {
                if (fl.willMake) {
                  const shooter = fl.shooterId ? bbPlayers.find((p) => p.id === fl.shooterId) : undefined;
                  if (shooter) {
                    shooter.pts += fl.points;
                    shooter.fgm += 1;
                    if (fl.points === 3) shooter.tpm += 1;
                    if (shooter.lastPassTimer > 0 && shooter.lastPasserId && shooter.lastPasserId !== shooter.id) {
                      const passer = bbPlayers.find((p) => p.id === shooter.lastPasserId);
                      if (passer) passer.ast += 1;
                      shooter.lastPassTimer = 0;
                    }
                  }
                  bb.netSwishTimer = 0.55;
                  if (fl.duration <= 0.26) bb.shakeTimer = 0.22;
                  if (fl.shooterTeam === 'player') {
                    bb.scorePlayer += fl.points;
                    bb.bannerText =
                      fl.duration <= 0.26
                        ? 'POSTER SLAM!! +2 PTS'
                        : fl.points === 3
                        ? 'SWISH!! +3 PTS'
                        : 'BUCKET! +2 PTS';
                  } else {
                    bb.scoreCpu += fl.points;
                    bb.bannerText = `CPU SCORES +${fl.points}`;
                  }
                  bb.bannerTimer = 1.3;
                  spawnParticles(fl.targetX, fl.targetY, '#fbbf24', 20, 145);
                  playRetroSportTone(660, 990, 0.18, 'square', 0.09);
                  const nextPoss: 'player' | 'cpu' = fl.shooterTeam === 'player' ? 'cpu' : 'player';
                  startBballInbound(nextPoss);
                } else {
                  const dxR = fl.reboundX - fl.targetX;
                  const dyR = fl.reboundY - fl.targetY;
                  bb.looseBallVx = dxR * 1.45;
                  bb.looseBallVy = dyR * 1.45;
                  bb.looseBallZ = 22;
                  bb.looseBallVz = 55;
                  bb.isReboundLive = true;
                  bb.statusText = 'CLANK! Sprint to grab the rebound!';
                  playRetroSportTone(180, 120, 0.1, 'triangle', 0.07);
                }
              }
            }
          } else if (bb.dunkAnim) {
            bb.dribbleBallTrail.length = 0;
          } else if (bb.carrierId) {
            const car = bbPlayers.find((p) => p.id === bb.carrierId);
            if (car) {
              // Visible Cross / Tween ball choreography!
              if (car.crossTimer > 0) {
                const prog = 1 - car.crossTimer / 0.34;
                const sweep = Math.cos(prog * Math.PI) * -car.dribbleHand * 19;
                bb.ballX = car.x + sweep;
                bb.ballY = car.y + 4;
                bb.ballZ = car.jumpZ + Math.sin(prog * Math.PI) * 5;
                bb.dribbleBallTrail.push({ x: bb.ballX, y: bb.ballY, z: bb.ballZ, color: '#f97316' });
              } else if (car.tweenTimer > 0) {
                const prog = 1 - car.tweenTimer / 0.38;
                const legSweep = Math.cos(prog * Math.PI) * -car.dribbleHand * 18;
                bb.ballX = car.x + legSweep;
                bb.ballY = car.y + 7;
                bb.ballZ = car.jumpZ + 3;
                bb.dribbleBallTrail.push({ x: bb.ballX, y: bb.ballY, z: bb.ballZ, color: '#38bdf8' });
              } else {
                const handSide = car.dribbleHand;
                bb.ballX = car.x + car.faceX * 11;
                bb.ballY = car.y + handSide * 10 + 4;
                bb.ballZ = car.jumpZ + Math.abs(Math.sin(now * 0.013)) * 10;
              }
              if (bb.dribbleBallTrail.length > 9) bb.dribbleBallTrail.shift();
            }
          } else {
            bb.dribbleBallTrail.length = 0;
            bb.ballX = clamp(bb.ballX + bb.looseBallVx * dt, courtLeft + 18, courtRight - 18);
            bb.ballY = clamp(bb.ballY + bb.looseBallVy * dt, courtTop + 18, courtBot - 18);
            bb.looseBallVz -= 260 * dt;
            bb.looseBallZ = Math.max(0, bb.looseBallZ + bb.looseBallVz * dt);
            if (bb.looseBallZ <= 0 && bb.looseBallVz < 0) bb.looseBallVz = -bb.looseBallVz * 0.55;
            bb.ballZ = bb.looseBallZ;
            bb.looseBallVx *= 0.94;
            bb.looseBallVy *= 0.94;
            if (bb.looseBallZ < 24) {
              for (const p of bbPlayers) {
                if (p.stunTimer > 0) continue;
                const grabRadius = p.reboundStat >= 88 ? 26 : 22;
                if (Math.hypot(p.x - bb.ballX, p.y - bb.ballY) < grabRadius) {
                  if (bb.isReboundLive) {
                    p.reb += 1;
                    bb.isReboundLive = false;
                  }
                  const prevPoss = bb.possession;
                  bb.carrierId = p.id;
                  bb.possession = p.team;
                  if (prevPoss !== p.team) bbFrontcourtReached = false;
                  bb.shotClock = 24;
                  bb.bannerText = p.team === 'player' ? 'BOARD!!' : 'CPU REBOUND!';
                  bb.bannerTimer = 0.85;
                  bb.statusText =
                    p.team === 'player'
                      ? p.isUser
                        ? 'REBOUND! Cut Arrows for Cross/Tween · Hold [SPACE] Shoot!'
                        : 'Teammate got the board — [SPACE] Shoot or [E] Call Pass!'
                      : 'CPU grabbed the board! Play tight D!';
                  break;
                }
              }
            }
          }
        }

        // Render ICM INDOOR GYM Basketball Arena (Polished Parquet, Banners, Spotlights, Bleachers)
        ctx.save();
        if (bb.shakeTimer > 0) {
          ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        }

        // Gym Dark Rafters & Padded Wall Surround
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Top ICM Indoor Gym Wall + Bleachers + Championship Banners
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, CANVAS_W, courtTop);
        ctx.fillStyle = '#334155';
        for (let rx = 30; rx < CANVAS_W; rx += 95) {
          ctx.fillRect(rx, 0, 6, 12);
        }
        const banners = ['ICM ATHLETICS', "'22 STATE", "'24 ICM CUP", 'VARSITY GYM'];
        banners.forEach((bText, bIdx) => {
          const bx = 95 + bIdx * 175;
          ctx.fillStyle = bIdx % 2 === 0 ? '#1e3a8a' : '#7f1d1d';
          ctx.fillRect(bx - 42, 4, 84, 24);
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx - 42, 4, 84, 24);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(bText, bx, 19);
        });
        // Gym Bleacher Steps
        for (let row = 0; row < 2; row++) {
          const by = 32 + row * 12;
          ctx.fillStyle = row === 0 ? '#78350f' : '#92400e';
          ctx.fillRect(courtLeft, by, courtRight - courtLeft, 10);
          for (let sx = courtLeft + 18; sx < courtRight - 18; sx += 26) {
            const bob = Math.sin(now * 0.004 + sx) * 1.2;
            ctx.fillStyle = sx % 52 === 0 ? '#3b82f6' : sx % 78 === 0 ? '#fde047' : '#ef4444';
            ctx.fillRect(sx, by + 2 + bob, 8, 6);
          }
        }

        // Blue/Gold Gym Sideline Apron & Team Bench + Ball Rack at Bottom
        ctx.fillStyle = '#172554';
        ctx.fillRect(courtLeft - 14, courtTop - 6, courtRight - courtLeft + 28, courtBot - courtTop + 34);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(courtLeft + 40, courtBot + 8, 175, 16);
        for (let ch = 0; ch < 5; ch++) {
          ctx.fillStyle = '#2563eb';
          ctx.fillRect(courtLeft + 48 + ch * 34, courtBot + 10, 22, 11);
        }
        // Sideline Basketball Rack
        ctx.fillStyle = '#475569';
        ctx.fillRect(courtRight - 105, courtBot + 9, 54, 14);
        for (let br = 0; br < 3; br++) {
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(courtRight - 93 + br * 15, courtBot + 15, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Polished Honey Maple Parquet Hardwood Floor
        ctx.fillStyle = '#d49556';
        ctx.fillRect(courtLeft, courtTop, courtRight - courtLeft, courtBot - courtTop);
        for (let py = courtTop; py < courtBot; py += 12) {
          ctx.fillStyle = Math.floor(py / 12) % 2 === 0 ? 'rgba(255,247,237,0.12)' : 'rgba(146,64,14,0.12)';
          ctx.fillRect(courtLeft, py, courtRight - courtLeft, 10);
          ctx.fillStyle = 'rgba(120,53,15,0.18)';
          ctx.fillRect(courtLeft, py + 10, courtRight - courtLeft, 2);
          for (let px = courtLeft + ((Math.floor(py / 12) % 2) * 28); px < courtRight; px += 56) {
            ctx.fillRect(px, py, 1, 10);
          }
        }
        // Warm Overhead Gym Spotlight Gloss
        const spotGrad = ctx.createRadialGradient(courtMidX, courtMidY, 30, courtMidX, courtMidY, 340);
        spotGrad.addColorStop(0, 'rgba(254,249,195,0.18)');
        spotGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
        ctx.fillStyle = spotGrad;
        ctx.fillRect(courtLeft, courtTop, courtRight - courtLeft, courtBot - courtTop);

        // Crisp Court Boundary
        ctx.strokeStyle = isTourney ? '#fde047' : '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(courtLeft, courtTop, courtRight - courtLeft, courtBot - courtTop);

        // Half-Court Line & ICM GYM Center Logo
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(courtMidX, courtTop);
        ctx.lineTo(courtMidX, courtBot);
        ctx.stroke();
        ctx.fillStyle = isTourney ? '#7c2d12' : '#1e3a8a';
        ctx.beginPath();
        ctx.arc(courtMidX, courtMidY, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isTourney ? 'ICM CUP' : 'ICM', courtMidX, courtMidY + 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('INDOOR GYM', courtMidX, courtMidY + 14);

        const drawHoopSide = (hx: number, dir: -1 | 1) => {
          const keyW = 114;
          const keyH = 128;
          ctx.fillStyle = isTourney ? '#7c2d12' : '#1e3a8a';
          ctx.fillRect(dir > 0 ? hx - keyW + 36 : hx - 36, courtMidY - keyH * 0.5, keyW, keyH);
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(dir > 0 ? hx - keyW + 36 : hx - 36, courtMidY - keyH * 0.5, keyW, keyH);
          // Free-throw circle & Restricted-Area Arc!
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hx, courtMidY, 30, dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, dir > 0 ? Math.PI * 1.5 : Math.PI * 0.5);
          ctx.stroke();
          // Lane block hash marks
          for (let ly = -44; ly <= 44; ly += 22) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(dir > 0 ? hx - 48 : hx + 44, courtMidY + ly, 4, 4);
          }
          ctx.beginPath();
          ctx.arc(
            hx,
            courtMidY,
            threePtRad,
            dir > 0 ? Math.PI * 0.54 : -Math.PI * 0.46,
            dir > 0 ? Math.PI * 1.46 : Math.PI * 0.46
          );
          ctx.stroke();
          // Stanchion Pad + Perspective Glass Backboard + Swishing Pixel Net
          ctx.fillStyle = '#1e3a8a';
          ctx.fillRect(hx + dir * 18, courtMidY - 7, dir * 17, 14);
          ctx.fillStyle = 'rgba(226,232,240,0.92)';
          ctx.fillRect(hx + dir * 13 - 3, courtMidY - 28, 6, 56);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.strokeRect(hx + dir * 13 - 3, courtMidY - 11, 6, 22);

          const swish = bb.netSwishTimer > 0 ? Math.sin(now * 0.045) * 6 : 0;
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 1.5;
          for (let ny = -9; ny <= 9; ny += 6) {
            ctx.beginPath();
            ctx.moveTo(hx, courtMidY + ny);
            ctx.lineTo(hx - dir * 10 + swish, courtMidY + ny * 0.65 + 14);
            ctx.stroke();
          }
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(hx, courtMidY, 12, 0, Math.PI * 2);
          ctx.stroke();
        };
        drawHoopSide(hoopRight.x, 1);
        if (!isHalfCourt) drawHoopSide(hoopLeft.x, -1);

        // Draw Shot Clock badge on baseline
        ctx.fillStyle = 'rgba(9,9,11,0.88)';
        ctx.fillRect(courtMidX - 36, courtTop + 6, 72, 20);
        ctx.strokeStyle = bb.shotClock < 5 ? '#ef4444' : '#f97316';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(courtMidX - 36, courtTop + 6, 72, 20);
        ctx.fillStyle = bb.shotClock < 5 ? '#f87171' : '#fde047';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`24s: ${Math.ceil(bb.shotClock)}`, courtMidX, courtTop + 20);

        // Dribble Cross / Tween Ball Trail
        for (let ti = 0; ti < bb.dribbleBallTrail.length; ti++) {
          const tr = bb.dribbleBallTrail[ti];
          ctx.globalAlpha = ((ti + 1) / bb.dribbleBallTrail.length) * 0.62;
          ctx.fillStyle = tr.color;
          ctx.fillRect(Math.round(tr.x) - 4, Math.round(tr.y - tr.z) - 4, 9, 9);
        }
        ctx.globalAlpha = 1;

        // Y-sorted 16-bit Pixel Players
        const sortedBb = [...bbPlayers].sort((a, b) => a.y - b.y);
        let suppressLooseBallDraw = false;
        for (const p of sortedBb) {
          const pal = pickAthletePalette(p.seed);
          const distToRim = Math.hypot(hoopRight.x - p.x, hoopRight.y - p.y);
          const isDunkingPlayer = bb.dunkAnim && bb.dunkAnim.playerId === p.id;
          const dunkProg = isDunkingPlayer
            ? clamp(bb.dunkAnim!.elapsed / bb.dunkAnim!.duration, 0.05, 1)
            : 0;
          const activeMove =
            bb.carrierId === p.id && !bb.dunkAnim
              ? p.tweenTimer > 0
                ? 'tween'
                : p.crossTimer > 0
                ? 'cross'
                : undefined
              : undefined;
          const activeMoveProg =
            activeMove === 'tween'
              ? clamp(1 - p.tweenTimer / 0.38, 0, 1)
              : activeMove === 'cross'
              ? clamp(1 - p.crossTimer / 0.34, 0, 1)
              : 0;
          if (activeMove || (isDunkingPlayer && dunkProg < 0.88)) {
            suppressLooseBallDraw = true;
          }
          if (bb.screen && bb.screen.screenerId === p.id) {
            ctx.save();
            ctx.strokeStyle = bb.screen.engaged ? '#fbbf24' : '#38bdf8';
            ctx.lineWidth = bb.screen.engaged ? 2.5 : 1.8;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + 8, bb.screen.engaged ? 22 : 17, bb.screen.engaged ? 11 : 8, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          drawRetroPixelAthlete(ctx, {
            x: p.x,
            y: p.y,
            z: p.jumpZ * 0.48,
            vx: p.vx,
            vy: p.vy,
            faceX: p.faceX,
            faceY: p.faceY,
            jerseyColor: p.team === 'player' ? '#2563eb' : '#dc2626',
            trimColor: p.team === 'player' ? '#fde047' : '#ffffff',
            shortsColor: p.team === 'player' ? '#1d4ed8' : '#991b1b',
            skinColor: pal.skin,
            hairColor: pal.hair,
            numberStr: p.jerseyNum,
            isUser: p.isUser,
            scale: p.sizeScale,
            walkTime: p.animTime,
            dribbleHand: p.dribbleHand,
            crossTimer: p.crossTimer,
            tweenTimer: p.tweenTimer,
            ballInMove: activeMove,
            moveProgress: activeMoveProg,
            stunTimer: p.stunTimer,
            shootingPose: p.isUser && bb.shotCharging,
            dunkingPose: isDunkingPlayer || (p.jumpZ > 16 && distToRim < 84),
            dunkSwingProgress: dunkProg,
            blockPose: p.blockTimer > 0,
          });
          // Crisp position tag under feet
          ctx.fillStyle = p.isUser ? 'rgba(16,185,129,0.9)' : p.team === 'player' ? 'rgba(30,64,175,0.85)' : 'rgba(153,27,27,0.85)';
          ctx.fillRect(Math.round(p.x - 10), Math.round(p.y + 11), 20, 10);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(p.position, p.x, p.y + 19);

          if (bb.inbound?.passerId === p.id) {
            ctx.fillStyle = 'rgba(9,9,11,0.92)';
            ctx.fillRect(p.x - 28, p.y - 44, 56, 13);
            ctx.fillStyle = '#fde047';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('INBOUND', p.x, p.y - 34);
          } else if (p.moveLabelTimer > 0 && p.moveLabel) {
            ctx.fillStyle = 'rgba(9,9,11,0.88)';
            ctx.fillRect(p.x - 31, p.y - p.jumpZ * 0.48 - 44, 62, 13);
            ctx.fillStyle =
              p.moveLabel.includes('TWEEN') || p.moveLabel.includes('SWAT') || p.moveLabel.includes('STUFFED') || p.moveLabel.includes('BULLY')
                ? '#38bdf8'
                : p.moveLabel.includes('BLOCKED') ||
                  p.moveLabel.includes('FUMBLED') ||
                  p.moveLabel.includes('ANKLES') ||
                  p.moveLabel.includes('REACH') ||
                  p.moveLabel.includes('SCREENED')
                ? '#ef4444'
                : p.moveLabel.includes('LOCKED') || p.moveLabel.includes('READS')
                ? '#a3e635'
                : p.moveLabel.includes('PICK') || p.moveLabel.includes('SCREEN')
                ? '#fde047'
                : '#fb923c';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(p.moveLabel, p.x, p.y - p.jumpZ * 0.48 - 34);
          }
        }

        if (!suppressLooseBallDraw) {
          drawRetroBasketball(ctx, bb.ballX, bb.ballY, bb.ballZ, bb.ballSpin);
        }

        const user = bbPlayers[0];
        if (bb.carrierId === user.id || bb.shotCharging) {
          const previewWin = bb.shotCharging
            ? { greenStart: bb.shotGreenStart, greenWidth: bb.shotGreenWidth, label: bb.shotDifficultyLabel }
            : computeBballShotWindow(user, hoopRight);

          const mx = clamp(user.x + 28, 40, CANVAS_W - 40);
          const my = clamp(user.y - 42, 44, CANVAS_H - 94);
          const mh = 68;
          ctx.fillStyle = 'rgba(9,9,11,0.9)';
          ctx.fillRect(mx - 6, my, 12, mh);
          ctx.strokeStyle = '#e4e4e7';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(mx - 6, my, 12, mh);
          const gTopY = my + (1 - (previewWin.greenStart + previewWin.greenWidth)) * mh;
          const gH = previewWin.greenWidth * mh;
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(mx - 4, gTopY, 8, gH);

          if (bb.shotCharging) {
            const fillH = bb.shotCharge * mh;
            const inG =
              bb.shotCharge >= previewWin.greenStart &&
              bb.shotCharge <= previewWin.greenStart + previewWin.greenWidth;
            ctx.fillStyle = inG ? '#fde047' : '#38bdf8';
            ctx.fillRect(mx - 4, my + mh - fillH, 8, fillH);
          }

          ctx.fillStyle = 'rgba(9,9,11,0.84)';
          ctx.fillRect(CANVAS_W * 0.5 - 205, courtBot - 26, 410, 20);
          ctx.fillStyle = '#e4e4e7';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(
            `${previewWin.label} · GREEN: ${Math.round(previewWin.greenWidth * 100)}% · RELEASE [SPACE]`,
            CANVAS_W * 0.5,
            courtBot - 12
          );
        }

        if (bb.bannerTimer > 0) {
          ctx.fillStyle = 'rgba(9,9,11,0.88)';
          ctx.fillRect(CANVAS_W * 0.5 - 165, 62, 330, 36);
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2;
          ctx.strokeRect(CANVAS_W * 0.5 - 165, 62, 330, 36);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 15px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(bb.bannerText, CANVAS_W * 0.5, 85);
        }
        ctx.restore();
      }

      // =====================================================================
      // 2. RETRO 3D BALLISTIC GOLF
      // =====================================================================
      else if (sport === 'golf') {
        const hole = GOLF_HOLES[golf.holeIdx];
        if (!golf.finished) {
          if (golf.swingTimer > 0) golf.swingTimer = Math.max(0, golf.swingTimer - dt);
          if (Math.hypot(golf.vx, golf.vy) < 2 && golf.ballZ <= 0.5 && golf.inCupTimer <= 0) {
            if (moveX !== 0) golf.aimAngle += moveX * 1.9 * dt;
            if (golf.charging && actionHeld) {
              golf.chargeOsc += golf.chargeDir * 2.25 * dt;
              if (golf.chargeOsc >= 1) {
                golf.chargeOsc = 1;
                golf.chargeDir = -1;
              } else if (golf.chargeOsc <= 0.05) {
                golf.chargeOsc = 0.05;
                golf.chargeDir = 1;
              }
            } else if (golf.charging && !actionHeld) {
              releaseHoldAction();
            }
          } else if (golf.inCupTimer > 0) {
            golf.inCupTimer -= dt;
            if (golf.inCupTimer <= 0) {
              golf.totalStrokes += golf.strokes;
              golf.totalPar += hole.par;
              if (golf.holeIdx + 1 < GOLF_HOLES.length) {
                loadGolfHole(golf.holeIdx + 1);
              } else {
                golf.finished = true;
                syncHud(true);
              }
            }
          } else {
            const club = GOLF_CLUBS[golfClubIdxRef.current];
            if (golf.lipOutCooldown > 0) golf.lipOutCooldown = Math.max(0, golf.lipOutCooldown - dt);
            golf.ballTrail.push({ x: golf.ballX, y: golf.ballY, z: golf.ballZ });
            if (golf.ballTrail.length > 16) golf.ballTrail.shift();

            if (golf.ballZ > 3) {
              golf.vx += hole.windX * 1.55 * dt;
              golf.vy += hole.windY * 1.55 * dt;
              golf.vz -= 255 * dt;
              golf.ballZ += golf.vz * dt;
              if (golf.ballZ <= 0) {
                golf.ballZ = 0;
                golf.vz = Math.abs(golf.vz) > 42 ? Math.abs(golf.vz) * 0.36 : 0;
                golf.vx *= 0.86;
                golf.vy *= 0.86;
              }
            } else {
              golf.ballZ = 0;
              golf.vz = 0;
            }

            golf.ballX += golf.vx * dt;
            golf.ballY += golf.vy * dt;

            const isAirborneHigh = golf.ballZ > 16;

            let onFairway = false;
            for (const f of hole.fairwayPolys) {
              const nx = (golf.ballX - f.x) / f.rx;
              const ny = (golf.ballY - f.y) / f.ry;
              if (nx * nx + ny * ny <= 1) {
                onFairway = true;
                break;
              }
            }
            const onGreen = Math.hypot(golf.ballX - hole.cupX, golf.ballY - hole.cupY) <= hole.greenRadius;

            let inBunker = false;
            for (const b of hole.bunkers) {
              const nx = (golf.ballX - b.x) / b.rx;
              const ny = (golf.ballY - b.y) / b.ry;
              if (nx * nx + ny * ny <= 1) {
                inBunker = true;
                break;
              }
            }
            let inWater = false;
            for (const w of hole.waters) {
              const nx = (golf.ballX - w.x) / w.rx;
              const ny = (golf.ballY - w.y) / w.ry;
              if (nx * nx + ny * ny <= 1) {
                inWater = true;
                break;
              }
            }

            if (golf.ballZ < 24) {
              for (const tr of hole.trees) {
                const dx = golf.ballX - tr.x;
                const dy = golf.ballY - tr.y;
                const d = Math.hypot(dx, dy);
                if (d < tr.r + 5 && d > 0.01) {
                  const nx = dx / d;
                  const ny = dy / d;
                  golf.ballX = tr.x + nx * (tr.r + 6);
                  golf.ballY = tr.y + ny * (tr.r + 6);
                  const dot = golf.vx * nx + golf.vy * ny;
                  if (dot < 0) {
                    golf.vx -= 1.65 * dot * nx;
                    golf.vy -= 1.65 * dot * ny;
                  }
                  playRetroSportTone(160, 90, 0.08, 'triangle', 0.06);
                }
              }
            }

            if (
              (!isAirborneHigh && golf.ballZ <= 2 && inWater) ||
              golf.ballX < 18 ||
              golf.ballX > CANVAS_W - 18 ||
              golf.ballY < 18 ||
              golf.ballY > CANVAS_H - 18
            ) {
              golf.strokes += 1;
              golf.ballX = golf.lastDryX;
              golf.ballY = golf.lastDryY;
              golf.ballZ = 0;
              golf.vx = 0;
              golf.vy = 0;
              golf.vz = 0;
              golf.ballTrail = [];
              golf.statusText = 'SPLASH! Water hazard drop (+1 penalty)';
              playRetroSportTone(240, 110, 0.22, 'sine', 0.08);
            } else {
              if (golf.ballZ <= 1.5) {
                if (onGreen) {
                  golf.vx += hole.greenBreakX * 2.15 * dt;
                  golf.vy += hole.greenBreakY * 2.15 * dt;
                }
                const drag = inBunker ? 0.835 : onGreen ? 0.952 : onFairway ? club.drag : 0.912;
                const decay = Math.pow(drag, dt * 60);
                golf.vx *= decay;
                golf.vy *= decay;
              } else {
                const airDecay = Math.pow(0.996, dt * 60);
                golf.vx *= airDecay;
                golf.vy *= airDecay;
              }

              const distCup = Math.hypot(hole.cupX - golf.ballX, hole.cupY - golf.ballY);
              const spd = Math.hypot(golf.vx, golf.vy);
              if (distCup < 9.5 && spd < 155 && golf.ballZ < 5) {
                golf.ballX = hole.cupX;
                golf.ballY = hole.cupY;
                golf.ballZ = 0;
                golf.vx = 0;
                golf.vy = 0;
                golf.vz = 0;
                golf.inCupTimer = 1.25;
                const diff = golf.strokes - hole.par;
                golf.statusText =
                  golf.strokes === 1
                    ? 'HOLE IN ONE!!'
                    : diff <= -2
                    ? 'EAGLE!'
                    : diff === -1
                    ? 'BIRDIE!'
                    : diff === 0
                    ? 'PAR!'
                    : `+${diff} Bogey`;
                spawnParticles(hole.cupX, hole.cupY, '#fde047', 22, 130);
                playRetroSportTone(580, 1160, 0.25, 'square', 0.09);
              } else if (distCup < 11.5 && spd >= 155 && spd < 265 && golf.ballZ < 6 && golf.lipOutCooldown <= 0) {
                golf.lipOutCooldown = 0.35;
                const ang = Math.atan2(golf.vy, golf.vx) + (Math.random() > 0.5 ? 0.52 : -0.52);
                const newSpd = spd * 0.54;
                golf.vx = Math.cos(ang) * newSpd;
                golf.vy = Math.sin(ang) * newSpd;
                golf.statusText = 'LIP-OUT!! Too much pace — ease it in!';
                playRetroSportTone(420, 220, 0.11, 'triangle', 0.08);
              } else if (spd < 10 && golf.ballZ <= 0.5) {
                golf.vx = 0;
                golf.vy = 0;
                golf.lastDryX = golf.ballX;
                golf.lastDryY = golf.ballY;
                golf.aimAngle = Math.atan2(hole.cupY - golf.ballY, hole.cupX - golf.ballX);
                if (distCup < hole.greenRadius + 16) {
                  setGolfClubIdx(3);
                  golfClubIdxRef.current = 3;
                }
                golf.statusText = `${Math.round(distCup)} yds to pin · Hold [SPACE]/Mouse to Hit`;
              }
            }
          }
        }

        // Render Retro 16-Bit Links Golf Course
        ctx.fillStyle = '#14532d';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        // Subtle pixel rough turf texture
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let gy = 8; gy < CANVAS_H; gy += 16) {
          for (let gx = (gy % 32 === 0 ? 12 : 28); gx < CANVAS_W; gx += 32) {
            ctx.fillRect(gx, gy, 4, 2);
          }
        }
        for (const f of hole.fairwayPolys) {
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, f.rx + 4, f.ry + 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // Putting Green + Pixel Slope Chevrons
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(hole.cupX, hole.cupY, hole.greenRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 2;
        ctx.stroke();
        const bAng = Math.atan2(hole.greenBreakY, hole.greenBreakX);
        ctx.strokeStyle = 'rgba(255,255,255,0.68)';
        ctx.lineWidth = 2;
        for (let r = -1; r <= 1; r += 2) {
          const cx = hole.cupX + r * 20;
          const cy = hole.cupY + r * 15;
          ctx.beginPath();
          ctx.moveTo(cx - Math.cos(bAng) * 8, cy - Math.sin(bAng) * 8);
          ctx.lineTo(cx + Math.cos(bAng) * 8, cy + Math.sin(bAng) * 8);
          ctx.stroke();
        }

        // Lipped Sand Bunkers
        for (const b of hole.bunkers) {
          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.ellipse(b.x, b.y, b.rx + 3, b.ry + 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fde68a';
          ctx.beginPath();
          ctx.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // Animated Shimmering Water Hazards
        for (const w of hole.waters) {
          ctx.fillStyle = '#0369a1';
          ctx.beginPath();
          ctx.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#7dd3fc';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = 'rgba(186,230,253,0.45)';
          const shimOff = Math.sin(now * 0.004) * 10;
          ctx.fillRect(Math.round(w.x - 18 + shimOff), Math.round(w.y - 6), 16, 2);
          ctx.fillRect(Math.round(w.x + 6 - shimOff), Math.round(w.y + 8), 14, 2);
        }
        // Layered Pixel Pine Trees
        for (const tr of hole.trees) {
          ctx.fillStyle = 'rgba(0,0,0,0.32)';
          ctx.fillRect(tr.x - tr.r * 0.7, tr.y + tr.r * 0.4, tr.r * 1.4, 8);
          ctx.fillStyle = '#064e3b';
          ctx.fillRect(tr.x - tr.r * 0.85, tr.y - tr.r * 0.55, tr.r * 1.7, tr.r * 1.15);
          ctx.fillStyle = '#15803d';
          ctx.fillRect(tr.x - tr.r * 0.65, tr.y - tr.r * 0.85, tr.r * 1.3, tr.r * 0.95);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(tr.x - tr.r * 0.35, tr.y - tr.r * 0.95, tr.r * 0.7, tr.r * 0.45);
        }
        // Cup & Animated Wind Flag
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.arc(hole.cupX, hole.cupY, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hole.cupX, hole.cupY);
        ctx.lineTo(hole.cupX, hole.cupY - 28);
        ctx.stroke();
        const flagDir = hole.windX >= 0 ? 1 : -1;
        const flutter = Math.sin(now * 0.014) * 3;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(hole.cupX, hole.cupY - 28);
        ctx.lineTo(hole.cupX + flagDir * 18, hole.cupY - 22 + flutter);
        ctx.lineTo(hole.cupX, hole.cupY - 16);
        ctx.fill();

        // Wind HUD Widget top-left
        ctx.fillStyle = 'rgba(9,9,11,0.86)';
        ctx.fillRect(14, 14, 130, 38);
        ctx.strokeStyle = '#38bdf8';
        ctx.strokeRect(14, 14, 130, 38);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        const windMph = Math.round(Math.hypot(hole.windX, hole.windY));
        ctx.fillText(`WIND: ${windMph} MPH`, 22, 30);
        const wAng = Math.atan2(hole.windY, hole.windX);
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(118, 33);
        ctx.lineTo(118 + Math.cos(wAng) * 14, 33 + Math.sin(wAng) * 14);
        ctx.stroke();

        // Pixel Golfer addressing ball when stopped or just swung!
        const ballIdle = Math.hypot(golf.vx, golf.vy) < 2 && golf.ballZ <= 0.5 && !golf.finished;
        if (ballIdle || golf.swingTimer > 0) {
          drawRetroPixelAthlete(ctx, {
            x: golf.ballX - 18,
            y: golf.ballY - 6,
            faceX: Math.cos(golf.aimAngle),
            faceY: Math.sin(golf.aimAngle),
            jerseyColor: '#0284c7',
            trimColor: '#fde047',
            shortsColor: '#e2e8f0',
            capColor: '#ffffff',
            isUser: true,
            scale: 1.6,
            hasClub: true,
            clubSwingProgress: golf.swingTimer > 0 ? 1 - golf.swingTimer / 0.26 : 0,
          });
        }

        if (ballIdle) {
          const curClub = GOLF_CLUBS[golfClubIdxRef.current];
          const carryLen = curClub.loftVz > 0 ? 115 : 85;
          const endX = golf.ballX + Math.cos(golf.aimAngle) * carryLen;
          const endY = golf.ballY + Math.sin(golf.aimAngle) * carryLen;
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(golf.ballX, golf.ballY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          // Wind drift preview indicator for lofted shots
          if (curClub.loftVz > 0) {
            const driftX = endX + hole.windX * 1.4;
            const driftY = endY + hole.windY * 1.4;
            ctx.strokeStyle = 'rgba(56,189,248,0.8)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(driftX, driftY);
            ctx.stroke();
            ctx.fillStyle = 'rgba(56,189,248,0.85)';
            ctx.beginPath();
            ctx.arc(driftX, driftY, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.setLineDash([]);
        }
        // Parabolic Ball Flight Tracer
        for (let ti = 0; ti < golf.ballTrail.length; ti++) {
          const tr = golf.ballTrail[ti];
          ctx.globalAlpha = ((ti + 1) / golf.ballTrail.length) * 0.45;
          ctx.fillStyle = '#fde047';
          ctx.fillRect(Math.round(tr.x) - 2, Math.round(tr.y - tr.z * 0.55) - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
        // Ball Ground Shadow + Elevated Golf Ball
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(golf.ballX + golf.ballZ * 0.25, golf.ballY + 5, 5.5, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(golf.ballX, golf.ballY - golf.ballZ * 0.55, 5.5 + golf.ballZ * 0.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#09090b';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (golf.charging) {
          const bx = CANVAS_W * 0.5 - 120;
          const by = CANVAS_H - 42;
          ctx.fillStyle = 'rgba(9,9,11,0.9)';
          ctx.fillRect(bx, by, 240, 22);
          // Sweet-spot tick zone (72%-88% max clean distance without slicing)
          ctx.fillStyle = 'rgba(34,197,94,0.28)';
          ctx.fillRect(bx + 3 + 234 * 0.72, by + 3, 234 * 0.16, 16);
          ctx.fillStyle = 'rgba(239,68,68,0.32)';
          ctx.fillRect(bx + 3 + 234 * 0.88, by + 3, 234 * 0.12, 16);
          ctx.fillStyle = golf.chargeOsc > 0.88 ? '#ef4444' : golf.chargeOsc > 0.45 ? '#22c55e' : '#38bdf8';
          ctx.fillRect(bx + 3, by + 3, 234 * golf.chargeOsc, 16);
          ctx.strokeStyle = '#ffffff';
          ctx.strokeRect(bx, by, 240, 22);
        }
      }

      // =====================================================================
      // 3. PRO BASEBALL (16-Bit Pixel Stadium, Windup, Swing & Sprinting Runners)
      // =====================================================================
      else if (sport === 'baseball') {
        if (!baseball.finished) {
          baseball.runnerAnim += dt;
          if (baseball.swingTimer > 0) baseball.swingTimer = Math.max(0, baseball.swingTimer - dt);
          if (baseball.bannerTimer > 0) baseball.bannerTimer = Math.max(0, baseball.bannerTimer - dt);
          if (baseball.stealAttemptCooldown > 0) baseball.stealAttemptCooldown = Math.max(0, baseball.stealAttemptCooldown - dt);
          if (baseball.throwStreak) {
            baseball.throwStreak.timer -= dt;
            if (baseball.throwStreak.timer <= 0) baseball.throwStreak = null;
          }

          if (moveX !== 0 || moveY !== 0) {
            baseball.aimX = clamp(baseball.aimX + moveX * 155 * dt, homePlate.x - 36, homePlate.x + 36);
            baseball.aimY = clamp(baseball.aimY + moveY * 155 * dt, homePlate.y - 26, homePlate.y + 26);
          }

          const endHalfInning = () => {
            const r = Math.random();
            const cpuScored = r < baseballCpuRunProb ? (r < baseballCpuRunProb * 0.34 ? 2 : 1) : 0;
            baseball.cpuRuns += cpuScored;
            baseball.outs = 0;
            baseball.strikes = 0;
            baseball.balls = 0;
            baseball.bases = [false, false, false];
            baseball.inning += 1;
            const gameComplete =
              baseball.inning > baseball.maxInnings && baseball.runs !== baseball.cpuRuns;
            if (gameComplete || baseball.inning > 5) {
              baseball.finished = true;
              playRetroSportTone(660, 990, 0.35, 'square', 0.1);
              syncHud(true);
            } else {
              baseball.phase = 'windup';
              baseball.waitTimer = 1.2;
              const isExtra = baseball.inning > baseball.maxInnings;
              baseball.bannerText = isExtra
                ? `EXTRA INNING ${baseball.inning}!!`
                : cpuScored > 0
                ? `CPU SCORED ${cpuScored} IN BOT!`
                : `TOP INNING ${baseball.inning}!`;
              baseball.bannerTimer = 1.35;
              baseball.statusText = isExtra
                ? `TIED! Extra Inning ${baseball.inning} — Score to Win!`
                : `Inning ${baseball.inning}/${baseball.maxInnings} · Aim & Swing!`;
            }
          };

          if (baseball.phase === 'windup') {
            baseball.waitTimer -= dt;
            if (baseball.waitTimer <= 0) {
              baseball.pitchTypeIdx = Math.floor(Math.random() * PITCH_TYPES.length);
              const pt = PITCH_TYPES[baseball.pitchTypeIdx];
              baseball.phase = 'pitching';
              baseball.swungThisPitch = false;
              baseball.pitchTrail = [];
              baseball.ballX = mound.x;
              baseball.ballY = mound.y;
              const isChase = Math.random() < 0.32;
              const targetOffsetX = isChase
                ? (Math.random() > 0.5 ? 1 : -1) * (31 + Math.random() * 14)
                : (Math.random() - 0.5) * 40;
              baseball.pitchCurveX = pt.curveX * baseballPitchMult;
              baseball.ballVx = -baseball.pitchCurveX * 0.44 + targetOffsetX * 0.92;
              baseball.ballVy = pt.speed * baseballPitchMult;
              baseball.statusText = `${pt.name} (${pt.breakTag}) — Track & Swing!`;
            }
          } else if (baseball.phase === 'pitching') {
            baseball.pitchTrail.push({ x: baseball.ballX, y: baseball.ballY });
            if (baseball.pitchTrail.length > 9) baseball.pitchTrail.shift();
            baseball.ballVx += baseball.pitchCurveX * dt;
            baseball.ballX += baseball.ballVx * dt;
            baseball.ballY += baseball.ballVy * dt;
            if (baseball.ballY > homePlate.y + 34) {
              const inZone = Math.abs(baseball.ballX - homePlate.x) <= 26;
              if (inZone || baseball.swungThisPitch) {
                baseball.strikes += 1;
                baseball.statusText = baseball.swungThisPitch
                  ? `SWINGING STRIKE ${baseball.strikes}!`
                  : `CALLED STRIKE ${baseball.strikes}!`;
                playRetroSportTone(240, 150, 0.12, 'square', 0.06);
                if (baseball.strikes >= 3) {
                  baseball.outs += 1;
                  baseball.strikes = 0;
                  baseball.balls = 0;
                  baseball.bannerText = 'STRUCK HIM OUT!';
                  baseball.bannerTimer = 0.95;
                  baseball.statusText = `STRIKEOUT! (${baseball.outs}/3 Outs)`;
                  if (baseball.outs >= 3) endHalfInning();
                }
              } else {
                baseball.balls += 1;
                baseball.statusText = `BALL ${baseball.balls}! Disciplined eye!`;
                if (baseball.balls >= 4) {
                  baseball.balls = 0;
                  baseball.strikes = 0;
                  if (baseball.bases[0] && baseball.bases[1] && baseball.bases[2]) baseball.runs += 1;
                  if (baseball.bases[0] && baseball.bases[1]) baseball.bases[2] = true;
                  if (baseball.bases[0]) baseball.bases[1] = true;
                  baseball.bases[0] = true;
                  baseball.bannerText = 'BASE ON BALLS!';
                  baseball.bannerTimer = 0.9;
                  baseball.statusText = 'WALK! Runner takes 1st!';
                }
              }
              if (!baseball.finished) {
                baseball.phase = 'windup';
                baseball.waitTimer = 0.85;
              }
            }
          } else if (baseball.phase === 'batted') {
            baseball.ballX += baseball.ballVx * dt;
            baseball.ballY += baseball.ballVy * dt;
            baseball.ballVz -= 210 * dt;
            baseball.ballZ = Math.max(0, baseball.ballZ + baseball.ballVz * dt);
            if (baseball.ballZ <= 0 && baseball.ballVz < 0) {
              baseball.ballVz = -baseball.ballVz * 0.44;
              baseball.ballVx *= 0.82;
              baseball.ballVy *= 0.82;
            }
            const distFromHome = Math.hypot(baseball.ballX - homePlate.x, baseball.ballY - homePlate.y);
            let caughtOrFielded = false;
            let fielderRef = bbFielders[0];
            for (const f of bbFielders) {
              const dx = baseball.ballX - f.x;
              const dy = baseball.ballY - f.y;
              const d = Math.hypot(dx, dy);
              if (d > 2) {
                f.x += (dx / d) * baseballFielderSpd * dt;
                f.y += (dy / d) * baseballFielderSpd * dt;
              }
              if (d < 17 && baseball.ballZ < 19) {
                caughtOrFielded = true;
                fielderRef = f;
                break;
              }
            }

            const advanceBases = (steps: number) => {
              let scored = 0;
              for (let s = 0; s < steps; s++) {
                if (baseball.bases[2]) scored += 1;
                baseball.bases[2] = baseball.bases[1];
                baseball.bases[1] = baseball.bases[0];
                baseball.bases[0] = s === 0;
              }
              baseball.runs += scored;
              return scored;
            };

            if (baseball.ballY < 38 || distFromHome > 432) {
              baseball.hits += 1;
              baseball.hrs += 1;
              const sc = advanceBases(4);
              baseball.bannerText = `HOME RUN!! +${sc}`;
              baseball.bannerTimer = 1.4;
              baseball.statusText = `CRUSHED OVER THE WALL! +${sc} RUN${sc > 1 ? 'S' : ''}!`;
              spawnParticles(baseball.ballX, clamp(baseball.ballY, 45, 220), '#fde047', 26, 175);
              playRetroSportTone(640, 1280, 0.35, 'square', 0.1);
              baseball.phase = 'windup';
              baseball.waitTimer = 1.15;
            } else if (caughtOrFielded) {
              if (baseball.ballZ > 4.5 || distFromHome < 205) {
                const isDoublePlay =
                  baseball.ballZ <= 4.5 &&
                  baseball.bases[0] &&
                  baseball.outs <= 1 &&
                  distFromHome < 195;
                if (isDoublePlay) {
                  baseball.outs += 2;
                  baseball.bases[0] = false;
                  baseball.throwStreak = { x1: fielderRef.x, y1: fielderRef.y, x2: secondBase.x, y2: secondBase.y, timer: 0.45 };
                  baseball.bannerText = '6-4-3 DOUBLE PLAY!';
                  baseball.bannerTimer = 1.1;
                  baseball.statusText = `GROUNDED INTO DOUBLE PLAY! (${baseball.outs}/3 Outs)`;
                } else {
                  baseball.outs += 1;
                  baseball.throwStreak = { x1: fielderRef.x, y1: fielderRef.y, x2: firstBase.x, y2: firstBase.y, timer: 0.35 };
                  baseball.statusText =
                    baseball.ballZ > 4.5
                      ? `FLY OUT! (${baseball.outs}/3 Outs)`
                      : `THROWN OUT AT 1ST! (${baseball.outs}/3 Outs)`;
                }
                playRetroSportTone(210, 110, 0.2, 'sawtooth', 0.08);
                if (baseball.outs >= 3) endHalfInning();
              } else {
                const basesCount = distFromHome > 295 ? 2 : 1;
                baseball.hits += 1;
                const sc = advanceBases(basesCount);
                baseball.throwStreak = { x1: fielderRef.x, y1: fielderRef.y, x2: secondBase.x, y2: secondBase.y, timer: 0.35 };
                baseball.statusText = `${basesCount === 2 ? 'GAP DOUBLE!' : 'BASE HIT!'} ${sc > 0 ? `+${sc} RUN!` : ''}`;
                playRetroSportTone(520, 820, 0.16, 'square', 0.08);
              }
              if (!baseball.finished && baseball.outs < 3) {
                baseball.phase = 'windup';
                baseball.waitTimer = 1.05;
              }
              for (const f of bbFielders) {
                f.x = f.homeX;
                f.y = f.homeY;
              }
            } else if (Math.hypot(baseball.ballVx, baseball.ballVy) < 28 && baseball.ballZ <= 1) {
              baseball.hits += 1;
              const basesCount = distFromHome > 290 ? 2 : 1;
              const sc = advanceBases(basesCount);
              baseball.statusText = `${basesCount === 2 ? 'GAP DOUBLE!' : 'INFIELD SINGLE!'} ${sc > 0 ? `+${sc} RUN!` : ''}`;
              baseball.phase = 'windup';
              baseball.waitTimer = 1.0;
              for (const f of bbFielders) {
                f.x = f.homeX;
                f.y = f.homeY;
              }
            }
          }
        }

        // Render Pro 16-Bit Retro Baseball Stadium (Checkerboard Turf + Scoreboard + Pixel Players)
        ctx.fillStyle = '#15803d';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        const tile = 32;
        for (let gy = 36; gy < CANVAS_H; gy += tile) {
          for (let gx = 0; gx < CANVAS_W; gx += tile) {
            if (((gx / tile) + (gy / tile)) % 2 === 0) {
              ctx.fillStyle = 'rgba(255,255,255,0.04)';
              ctx.fillRect(gx, gy, tile, tile);
            }
          }
        }
        // Top Outfield Brick Wall + Retro Pixel Scoreboard
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, CANVAS_W, 24);
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(0, 24, CANVAS_W, 12);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          `CAMDEN ARCADE · YOU ${baseball.runs}  CPU ${baseball.cpuRuns}  · INN ${baseball.inning} · ${baseball.outs} OUTS · HR ${baseball.hrs}`,
          CANVAS_W * 0.5,
          16
        );

        // Outfield warning track & HR fence
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(homePlate.x, homePlate.y, 440, Math.PI * 1.24, Math.PI * 1.76);
        ctx.stroke();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(homePlate.x, homePlate.y, 432, Math.PI * 1.24, Math.PI * 1.76);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('330 FT', 112, 138);
        ctx.fillText('405 FT', CANVAS_W * 0.5, 48);
        ctx.fillText('330 FT', CANVAS_W - 112, 138);

        // Infield dirt diamond + Chalk baselines
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.moveTo(homePlate.x, homePlate.y + 20);
        ctx.lineTo(firstBase.x + 26, firstBase.y);
        ctx.lineTo(secondBase.x, secondBase.y - 26);
        ctx.lineTo(thirdBase.x - 26, thirdBase.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.moveTo(homePlate.x, homePlate.y - 34);
        ctx.lineTo(firstBase.x - 22, firstBase.y);
        ctx.lineTo(secondBase.x, secondBase.y + 22);
        ctx.lineTo(thirdBase.x + 22, thirdBase.y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(homePlate.x, homePlate.y);
        ctx.lineTo(firstBase.x, firstBase.y);
        ctx.lineTo(secondBase.x, secondBase.y);
        ctx.lineTo(thirdBase.x, thirdBase.y);
        ctx.closePath();
        ctx.stroke();

        // Pitcher dirt mound
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.arc(mound.x, mound.y, 19, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mound.x - 6, mound.y - 2, 12, 3);

        // Bases + Animated Pixel Baserunners
        [firstBase, secondBase, thirdBase].forEach((b, idx) => {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(b.x - 8, b.y - 8, 16, 16);
          if (baseball.bases[idx]) {
            const jogOff = baseball.phase === 'batted' ? Math.sin(baseball.runnerAnim * 12) * 8 : 0;
            const pal = pickAthletePalette(idx + 3);
            drawRetroPixelAthlete(ctx, {
              x: b.x + jogOff,
              y: b.y - 6,
              vx: baseball.phase === 'batted' ? 60 : 0,
              vy: 0,
              faceX: idx === 0 ? -1 : 1,
              jerseyColor: '#2563eb',
              trimColor: '#fde047',
              shortsColor: '#e2e8f0',
              skinColor: pal.skin,
              helmetColor: '#1d4ed8',
              numberStr: String((idx + 1) * 7),
              scale: 1.5,
              walkTime: baseball.runnerAnim,
            });
          }
        });

        // Home Plate + Strike Zone + Aimable Sweet Spot Reticle + Swing Timing Ring
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(homePlate.x - 10, homePlate.y - 8, 20, 14);
        ctx.strokeStyle = 'rgba(255,255,255,0.44)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(homePlate.x - 26, homePlate.y - 20, 52, 40);
        const pitchInWindow =
          baseball.phase === 'pitching' && Math.abs(baseball.ballY - homePlate.y) < 36;
        if (pitchInWindow) {
          ctx.strokeStyle = '#4ade80';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(baseball.aimX, baseball.aimY, 22 + Math.sin(now * 0.03) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = pitchInWindow ? '#4ade80' : '#fde047';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(baseball.aimX, baseball.aimY, 17, 0, Math.PI * 2);
        ctx.stroke();

        // Pixel Fielders w/ Gloves & Caps
        for (let fi = 0; fi < bbFielders.length; fi++) {
          const f = bbFielders[fi];
          const pal = pickAthletePalette(fi + 10);
          drawRetroPixelAthlete(ctx, {
            x: f.x,
            y: f.y,
            vx: baseball.phase === 'batted' ? 85 : 0,
            vy: 0,
            faceX: homePlate.x - f.x >= 0 ? 1 : -1,
            jerseyColor: '#dc2626',
            trimColor: '#ffffff',
            shortsColor: '#e2e8f0',
            skinColor: pal.skin,
            capColor: '#991b1b',
            hasGlove: true,
            numberStr: String(fi + 2),
            scale: 1.55,
            walkTime: baseball.runnerAnim + fi,
          });
        }

        // Pixel Pitcher with High-Leg-Kick Windup!
        const windupProg = baseball.phase === 'windup' ? clamp(1 - baseball.waitTimer, 0, 1) : 0;
        drawRetroPixelAthlete(ctx, {
          x: mound.x,
          y: mound.y - 4,
          faceX: 1,
          jerseyColor: '#dc2626',
          trimColor: '#fde047',
          shortsColor: '#e2e8f0',
          capColor: '#7f1d1d',
          hasGlove: true,
          windupProgress: windupProg,
          numberStr: '45',
          scale: 1.75,
          walkTime: baseball.runnerAnim,
        });

        // Pixel Batter + Bat Swing Arc
        const batSwingProg = baseball.swingTimer > 0 ? clamp(1 - baseball.swingTimer / 0.22, 0.05, 1) : 0;
        drawRetroPixelAthlete(ctx, {
          x: homePlate.x - 24,
          y: homePlate.y - 4,
          faceX: 1,
          jerseyColor: '#2563eb',
          trimColor: '#fde047',
          shortsColor: '#e2e8f0',
          helmetColor: '#1d4ed8',
          isUser: true,
          hasBat: true,
          batSwingProgress: batSwingProg,
          numberStr: '24',
          scale: 1.85,
          walkTime: baseball.runnerAnim,
        });

        // Crouching Pixel Catcher behind home plate
        drawRetroPixelAthlete(ctx, {
          x: homePlate.x,
          y: homePlate.y + 30,
          faceX: -1,
          jerseyColor: '#dc2626',
          trimColor: '#ffffff',
          shortsColor: '#e2e8f0',
          helmetColor: '#991b1b',
          isCatcher: true,
          hasGlove: true,
          numberStr: '8',
          scale: 1.55,
          walkTime: 0,
        });

        // Fielder throw streak
        if (baseball.throwStreak) {
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(baseball.throwStreak.x1, baseball.throwStreak.y1);
          ctx.lineTo(baseball.throwStreak.x2, baseball.throwStreak.y2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Pitch trail + baseball
        if (baseball.phase === 'pitching') {
          for (let ti = 0; ti < baseball.pitchTrail.length; ti++) {
            const tr = baseball.pitchTrail[ti];
            ctx.fillStyle = `rgba(255,255,255,${((ti + 1) / baseball.pitchTrail.length) * 0.38})`;
            ctx.beginPath();
            ctx.arc(tr.x, tr.y, 3.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (baseball.phase === 'pitching' || baseball.phase === 'batted') {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.arc(baseball.ballX, baseball.ballY + 5, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(baseball.ballX, baseball.ballY - baseball.ballZ * 0.45, 5 + baseball.ballZ * 0.04, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        if (baseball.bannerTimer > 0) {
          ctx.fillStyle = 'rgba(9,9,11,0.85)';
          ctx.fillRect(CANVAS_W * 0.5 - 150, 44, 300, 34);
          ctx.strokeStyle = '#fde047';
          ctx.strokeRect(CANVAS_W * 0.5 - 150, 44, 300, 34);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(baseball.bannerText, CANVAS_W * 0.5, 66);
        }
      }

      // =====================================================================
      // 4. RETRO BOWL HORIZONTAL GRIDIRON (1,920px Field + Playable Defense!)
      // =====================================================================
      else if (sport === 'football') {
        const losX = yardToX(fb.losYard);
        const userDef = fb.entities.find((e) => e.id === 'user_def');

        if (!fb.finished) {
          fb.timeLeft = Math.max(0, fb.timeLeft - dt);
          if (fb.bannerTimer > 0) fb.bannerTimer = Math.max(0, fb.bannerTimer - dt);
          if (fb.jukeTimer > 0) fb.jukeTimer = Math.max(0, fb.jukeTimer - dt);
          if (fb.jukeCooldown > 0) fb.jukeCooldown = Math.max(0, fb.jukeCooldown - dt);
          if (fb.diveTimer > 0) fb.diveTimer = Math.max(0, fb.diveTimer - dt);
          if (fb.diveCooldown > 0) fb.diveCooldown = Math.max(0, fb.diveCooldown - dt);

          if (fb.timeLeft <= 0 && fb.phase === 'huddle') {
            if ((isFootballTourney || (isFootballSeason && fbSeasonMatch?.isPlayoff)) && fb.scorePlayer === fb.scoreCpu) {
              fb.bannerText = 'OVERTIME! NEXT SCORE WINS!';
              fb.bannerTimer = 1.2;
              fb.statusText = 'TIED IN PLAYOFFS! Score or get a stop to win!';
            } else {
              fb.finished = true;
              playRetroSportTone(660, 880, 0.35, 'square', 0.1);
              syncHud(true);
            }
          }

          if (fb.phase === 'huddle' && fb.possession === 'player' && activeHuddlePlay !== footballPlayRef.current) {
            setupFootballSnapFormation(false);
          }
          if (fb.phase === 'huddle' && fb.possession === 'cpu' && activeHuddleDefPlay !== footballDefPlayRef.current) {
            activeHuddleDefPlay = footballDefPlayRef.current;
            alignPlayerDefensePreSnap();
          }

          if (fb.phase === 'huddle' && fb.possession === 'cpu') {
            // Let user shift MLB pre-snap while CPU calls the play (CPU routes remain hidden!)
            if (userDef && (moveX !== 0 || moveY !== 0)) {
              const mLen = Math.hypot(moveX, moveY) || 1;
              userDef.x = clamp(userDef.x + (moveX / mLen) * 185 * dt, fbEzLeftX - 30, losX - 18);
              userDef.y = clamp(userDef.y + (moveY / mLen) * 185 * dt, fbTopY + 14, fbBotY - 14);
              userDef.animTime = (userDef.animTime || 0) + dt;
            }
            fb.cpuSnapTimer -= dt;
            if (fb.cpuSnapTimer <= 0) {
              const isRunPlay = fb.cpuPlayCall === 'sweep' || fb.cpuPlayCall === 'inside_dive';
              fb.phase = isRunPlay ? 'yac_run' : 'live_pass';
              fb.carrierId = isRunPlay ? 'c_rb' : 'c_qb';
              fb.statusText = isRunPlay
                ? `DEFENSE: CPU ${fb.cpuPlayCall === 'inside_dive' ? 'INSIDE DIVE' : 'HB SWEEP'}! Fill the gap · [SPACE] Dive Tackle!`
                : 'DEFENSE: CPU PASS! Read eyes & cover · [SPACE] Dive/Pick!';
              playRetroSportTone(290, 460, 0.1, 'square', 0.07);
            }
          } else if (fb.phase === 'play_over') {
            fb.playOverTimer -= dt;
            if (fb.playOverTimer <= 0) {
              if (
                fb.timeLeft <= 0 &&
                (!(isFootballTourney || (isFootballSeason && fbSeasonMatch?.isPlayoff)) || fb.scorePlayer !== fb.scoreCpu)
              ) {
                fb.finished = true;
                syncHud(true);
              } else {
                fb.phase = 'huddle';
                setupFootballSnapFormation(true);
                const offMeta = FOOTBALL_OFF_PLAYS.find((p) => p.id === footballPlayRef.current);
                const defMeta = FOOTBALL_DEF_PLAYS.find((p) => p.id === footballDefPlayRef.current);
                fb.statusText =
                  fb.possession === 'player'
                    ? `COACH: ${offMeta?.label || footballPlayRef.current.toUpperCase()} (${fb.down} & ${Math.max(1, fb.firstDownYard - fb.losYard)}) · [SPACE] Snap · [←/→] Audible!`
                    : `DEF CALL: ${defMeta?.label || footballDefPlayRef.current.toUpperCase()} · [←/→] Switch Coverage & Align!`;
              }
            }
          } else if (fb.phase === 'live_pass' || fb.phase === 'ball_in_air' || fb.phase === 'yac_run') {
            const carrier = fb.entities.find((e) => e.id === fb.carrierId);

            // 1. User-Controlled Entity Movement + Dynamic Openness Pass Meter!
            if (fb.possession === 'player') {
              if (fb.throwCharging && fb.phase === 'live_pass' && fb.carrierId === 'qb') {
                const throwHold =
                  actionHeld ||
                  keys.has('KeyE') ||
                  keys.has('Digit1') ||
                  keys.has('Digit2') ||
                  keys.has('Digit3');
                if (keys.has('Digit1')) {
                  fb.throwTargetId = 'wr1';
                  fb.throwTargetLockedByKey = true;
                } else if (keys.has('Digit2')) {
                  fb.throwTargetId = 'wr2';
                  fb.throwTargetLockedByKey = true;
                } else if (keys.has('Digit3')) {
                  fb.throwTargetId = 'rb';
                  fb.throwTargetLockedByKey = true;
                } else if (!fb.throwTargetLockedByKey) {
                  if (keys.has('ArrowUp')) fb.throwTargetId = 'wr1';
                  else if (keys.has('ArrowDown')) fb.throwTargetId = 'wr2';
                }

                // Dynamically update Green Window width based on how open the receiver is RIGHT NOW!
                const qbEnt = fb.entities.find((e) => e.id === 'qb');
                const tgtEnt = fb.entities.find((e) => e.id === fb.throwTargetId);
                const liveWin = computeFootballPassWindow(qbEnt, tgtEnt);
                fb.throwGreenWidth = liveWin.greenWidth;
                fb.throwGreenStart = liveWin.greenStart;

                if (throwHold) {
                  fb.throwCharge += dt * 1.18;
                  if (fb.throwCharge >= 1.0) {
                    fb.throwCharge = 1.0;
                    releaseHoldAction();
                  }
                } else {
                  releaseHoldAction();
                }
              }
              if (fb.phase !== 'ball_in_air' && carrier) {
                const rushMult = fb.jukeTimer > 0 ? 1.48 : fb.throwCharging ? 0.55 : 1.0;
                const userSpd = carrier.speed * rushMult;
                const len = Math.hypot(moveX, moveY) || 1;
                carrier.vx = (moveX / len) * (moveX !== 0 || moveY !== 0 ? userSpd : 0);
                carrier.vy = (moveY / len) * (moveX !== 0 || moveY !== 0 ? userSpd : 0);
                carrier.x = clamp(carrier.x + carrier.vx * dt, 36, fbWorldW - 36);
                carrier.y = clamp(carrier.y + carrier.vy * dt, fbTopY + 14, fbBotY - 14);
                carrier.animTime = (carrier.animTime || 0) + dt;
                fb.ballX = carrier.x;
                fb.ballY = carrier.y;
              }
            } else {
              // User controls MyPlayer on Defense!
              if (userDef) {
                const defSpd = fb.diveTimer > 0 ? userDef.speed * 1.24 : userDef.speed;
                const len = Math.hypot(moveX, moveY) || 1;
                userDef.vx = (moveX / len) * (moveX !== 0 || moveY !== 0 ? defSpd : 0);
                userDef.vy = (moveY / len) * (moveX !== 0 || moveY !== 0 ? defSpd : 0);
                userDef.x = clamp(userDef.x + userDef.vx * dt, 36, fbWorldW - 36);
                userDef.y = clamp(userDef.y + userDef.vy * dt, fbTopY + 14, fbBotY - 14);
                userDef.animTime = (userDef.animTime || 0) + dt;
              }

              // CPU Offense QB Dropback / Throw or RB/WR Sprint Left toward Player Endzone!
              if (fb.phase !== 'ball_in_air' && carrier) {
                if (fb.phase === 'live_pass' && carrier.id === 'c_qb') {
                  const dropTargetX = clamp(losX + 68, fbEzLeftX + 18, fbEzRightX - 18);
                  const nearRusher = fb.entities
                    .filter((d) => d.team === 'player')
                    .sort((a, b) => Math.hypot(a.x - carrier.x, a.y - carrier.y) - Math.hypot(b.x - carrier.x, b.y - carrier.y))[0];
                  const rusherDist = nearRusher ? Math.hypot(nearRusher.x - carrier.x, nearRusher.y - carrier.y) : 999;

                  if (rusherDist < 54 && fb.cpuThrowTimer < 0.75) {
                    fb.cpuThrowTimer = 0;
                  } else {
                    const dxDrop = dropTargetX - carrier.x;
                    if (Math.abs(dxDrop) > 4) {
                      carrier.vx = Math.sign(dxDrop) * 118;
                      carrier.x = clamp(carrier.x + carrier.vx * dt, fbEzLeftX + 12, fbEzRightX - 12);
                    } else {
                      carrier.vx = 0;
                    }
                    if (nearRusher && rusherDist < 65) {
                      carrier.vy = (carrier.y >= nearRusher.y ? 1 : -1) * 90;
                      carrier.y = clamp(carrier.y + carrier.vy * dt, fbTopY + 20, fbBotY - 20);
                    } else {
                      carrier.vy = 0;
                    }
                  }

                  fb.cpuThrowTimer -= dt;
                  if (fb.cpuThrowTimer <= 0) {
                    const cWr1 = fb.entities.find((e) => e.id === 'c_wr1');
                    const cWr2 = fb.entities.find((e) => e.id === 'c_wr2');
                    const openScore = (wr: FbEntity | undefined) =>
                      wr
                        ? Math.min(
                            ...fb.entities
                              .filter((d) => d.team === 'player')
                              .map((d) => Math.hypot(d.x - wr.x, d.y - wr.y))
                          )
                        : 0;
                    const chosenId =
                      openScore(cWr2) > openScore(cWr1) + (Math.random() - 0.5) * 26 ? 'c_wr2' : 'c_wr1';
                    throwFootballPass(chosenId, 'cpu');
                  }
                } else {
                  // CPU RB Sweep or WR YAC Sprint Left toward fbEzLeftX!
                  let avoidY = 0;
                  for (const d of fb.entities) {
                    if (d.team === 'player' && Math.hypot(d.x - carrier.x, d.y - carrier.y) < 55) {
                      avoidY += carrier.y >= d.y ? 1 : -1;
                    }
                  }
                  const tx = fbEzLeftX - 18;
                  const ty = clamp(carrier.y + avoidY * 45, fbTopY + 22, fbBotY - 22);
                  const dx = tx - carrier.x;
                  const dy = ty - carrier.y;
                  const d = Math.hypot(dx, dy) || 1;
                  carrier.vx = (dx / d) * carrier.speed;
                  carrier.vy = (dy / d) * carrier.speed;
                  carrier.x = clamp(carrier.x + carrier.vx * dt, 36, fbWorldW - 36);
                  carrier.y = clamp(carrier.y + carrier.vy * dt, fbTopY + 14, fbBotY - 14);
                }
                carrier.animTime = (carrier.animTime || 0) + dt;
                fb.ballX = carrier.x;
                fb.ballY = carrier.y;
              }
            }

            // 2. AI Entities (O-Line, Route Runners, Defensive Front & Secondary)
            const offTeam = fb.possession;
            const defTeam: 'player' | 'cpu' = offTeam === 'player' ? 'cpu' : 'player';
            const attDir = offTeam === 'player' ? 1 : -1; // +1 attacks Right, -1 attacks Left
            const oLinemen = fb.entities.filter((e) => e.team === offTeam && e.role === 'ol');

            for (const ent of fb.entities) {
              const isUserNow =
                (fb.possession === 'player' && ent.id === fb.carrierId && fb.phase !== 'ball_in_air') ||
                (fb.possession === 'cpu' && ent.id === 'user_def');
              const isCpuCarrierNow =
                fb.possession === 'cpu' && ent.id === fb.carrierId && fb.phase !== 'ball_in_air';
              if (isUserNow || isCpuCarrierNow) continue;

              ent.animTime = (ent.animTime || 0) + dt;

              if (ent.role === 'ol') {
                let closestDef: FbEntity | null = null;
                let closestDist = 999;
                for (const d of fb.entities) {
                  if (d.team === defTeam && (d.role === 'dl' || d.role === 'lb' || d.role === 'user_def')) {
                    const dd = Math.hypot(d.x - ent.x, d.y - ent.y);
                    if (dd < closestDist) {
                      closestDist = dd;
                      closestDef = d;
                    }
                  }
                }
                if (closestDef && closestDist < 56) {
                  const dx = closestDef.x - ent.x;
                  const dy = closestDef.y - ent.y;
                  const len = Math.hypot(dx, dy) || 1;
                  ent.vx = (dx / len) * ent.speed;
                  ent.vy = (dy / len) * ent.speed;
                  ent.x = clamp(ent.x + ent.vx * dt, fbEzLeftX - 10, fbEzRightX + 10);
                  ent.y = clamp(ent.y + ent.vy * dt, fbTopY + 14, fbBotY - 14);
                }
              } else if (ent.team === defTeam) {
                // MADDEN PLAYBOOK COVERAGE, ZONE, BLITZ & PURSUIT AI!
                let chaseX = carrier ? carrier.x : fb.ballX;
                let chaseY = carrier ? carrier.y : fb.ballY;
                let effMult = 1.0;
                const isSafety = ent.id === 'c_fs' || ent.id === 'p_fs';
                const activeDefPlay: FootballDefPlayType = defTeam === 'player' ? footballDefPlayRef.current : fb.cpuDefCall;
                const wr1Ent = fb.entities.find((w) => w.team === offTeam && w.role === 'wr1');
                const wr2Ent = fb.entities.find((w) => w.team === offTeam && w.role === 'wr2');
                const rbEnt = fb.entities.find((w) => w.team === offTeam && w.role === 'rb');

                if (fb.phase === 'ball_in_air') {
                  chaseX = fb.passTargetX;
                  chaseY = fb.passTargetY;
                } else if (fb.phase === 'live_pass' && carrier) {
                  const qbScrambled = (carrier.x - losX) * attDir > 4;
                  if (ent.role === 'dl') {
                    if (activeDefPlay === 'spy_contain') {
                      chaseX = carrier.x;
                      chaseY = clamp(carrier.y + (ent.id.endsWith('1') ? -22 : 22), fbTopY + 20, fbBotY - 20);
                    } else {
                      chaseX = carrier.x;
                      chaseY = carrier.y;
                    }
                  } else if (qbScrambled) {
                    const dCar = Math.hypot(carrier.x - ent.x, carrier.y - ent.y);
                    const lead = clamp(dCar / Math.max(130, ent.speed * 1.15), 0.08, 0.48);
                    chaseX = clamp(carrier.x + carrier.vx * lead + attDir * 10, fbEzLeftX - 90, fbEzRightX + 90);
                    chaseY = clamp(carrier.y + carrier.vy * lead, fbTopY + 14, fbBotY - 14);
                  } else if (isSafety) {
                    if (activeDefPlay === 'zero_blitz') {
                      // Free safety blitzes QB!
                      chaseX = carrier.x;
                      chaseY = carrier.y;
                      effMult = 1.04;
                    } else if (activeDefPlay === 'spy_contain') {
                      const spyTarget = rbEnt && (rbEnt.x - losX) * attDir > 12 ? rbEnt : carrier;
                      chaseX = clamp(losX + attDir * 52, fbEzLeftX - 70, fbEzRightX + 70);
                      chaseY = clamp(spyTarget.y, fbTopY + 28, fbBotY - 28);
                      effMult = 0.92;
                    } else if (activeDefPlay === 'zone_blitz') {
                      // Deep bot half on zone blitz
                      const deepBot = wr2Ent && (wr2Ent.x - losX) * attDir > 65 ? wr2Ent : null;
                      chaseX = clamp(deepBot ? deepBot.x + attDir * 48 : losX + attDir * 155, fbEzLeftX - 95, fbEzRightX + 95);
                      chaseY = deepBot ? clamp(deepBot.y, fbMidY - 10, fbBotY - 28) : fbBotY - 82;
                      effMult = 0.92;
                    } else if (activeDefPlay === 'cover3' || activeDefPlay === 'cover4') {
                      const offWrs = [wr1Ent, wr2Ent].filter(Boolean) as FbEntity[];
                      const deepestWr = offWrs.sort((a, b) => (b.x - a.x) * attDir)[0];
                      const depth = activeDefPlay === 'cover4' ? 185 : 165;
                      chaseX = clamp(deepestWr ? Math.max(losX + attDir * depth, deepestWr.x + attDir * 68) * (attDir === 1 ? 1 : 0) + (attDir === -1 ? Math.min(losX + attDir * depth, deepestWr.x + attDir * 68) : 0) : losX + attDir * depth, fbEzLeftX - 95, fbEzRightX + 95);
                      chaseY = deepestWr ? clamp(fbMidY * 0.55 + deepestWr.y * 0.45, fbTopY + 30, fbBotY - 30) : fbMidY;
                      effMult = 0.92;
                    } else {
                      // Cover 2 / Tampa 2 / Cover 1: deep center roof
                      const offWrs = [wr1Ent, wr2Ent].filter(Boolean) as FbEntity[];
                      const deepestWr = offWrs.sort((a, b) => (b.x - a.x) * attDir)[0];
                      const deepX = deepestWr ? deepestWr.x + attDir * 68 : losX + attDir * 160;
                      chaseX = clamp(deepX, fbEzLeftX - 90, fbEzRightX + 90);
                      chaseY = deepestWr ? clamp(fbMidY * 0.45 + deepestWr.y * 0.55, fbTopY + 28, fbBotY - 28) : fbMidY;
                      effMult = 0.9;
                    }
                  } else if (ent.role === 'lb') {
                    chaseX = clamp(losX + attDir * (activeDefPlay === 'tampa2' ? 92 : 56), fbEzLeftX - 60, fbEzRightX + 60);
                    chaseY = clamp(fbMidY + (carrier.y - fbMidY) * 0.45, fbTopY + 24, fbBotY - 24);
                    effMult = 0.86;
                  } else if (ent.role === 'cb') {
                    const isTopCb = ent.id.endsWith('1');
                    const myWr = isTopCb ? wr1Ent : wr2Ent;
                    if (!isTopCb && (activeDefPlay === 'zone_blitz' || activeDefPlay === 'zero_blitz')) {
                      // CB2 blitzes off the bottom edge!
                      chaseX = carrier.x;
                      chaseY = carrier.y;
                      effMult = 1.05;
                    } else if (activeDefPlay === 'cover1_man' || (isTopCb && activeDefPlay === 'zero_blitz')) {
                      if (myWr) {
                        chaseX = clamp(myWr.x + myWr.vx * 0.12 + attDir * 12, fbEzLeftX - 95, fbEzRightX + 95);
                        chaseY = clamp(myWr.y + myWr.vy * 0.12, fbTopY + 14, fbBotY - 14);
                        effMult = 0.94;
                      }
                    } else if (activeDefPlay === 'cover3' || activeDefPlay === 'cover4') {
                      const deepDist = activeDefPlay === 'cover4' ? 175 : 148;
                      const zoneY = isTopCb ? fbTopY + 48 : fbBotY - 48;
                      if (myWr && (myWr.x - losX) * attDir > 65) {
                        chaseX = clamp(myWr.x + attDir * 28, fbEzLeftX - 95, fbEzRightX + 95);
                        chaseY = clamp(myWr.y * 0.7 + zoneY * 0.3, fbTopY + 16, fbBotY - 16);
                      } else {
                        chaseX = clamp(losX + attDir * deepDist, fbEzLeftX - 95, fbEzRightX + 95);
                        chaseY = zoneY;
                      }
                      effMult = 0.91;
                    } else if (activeDefPlay === 'zone_blitz' && isTopCb) {
                      // Top deep half in zone blitz
                      const threat = wr1Ent && (wr1Ent.x - losX) * attDir > 55 ? wr1Ent : null;
                      chaseX = clamp(threat ? threat.x + attDir * 42 : losX + attDir * 145, fbEzLeftX - 95, fbEzRightX + 95);
                      chaseY = threat ? clamp(threat.y, fbTopY + 24, fbMidY + 10) : fbTopY + 72;
                      effMult = 0.91;
                    } else {
                      // Cover 2 / Tampa 2 / Spy Contain flat-cloud zone
                      const flatY = isTopCb ? fbTopY + 52 : fbBotY - 52;
                      const threatInFlat = [wr1Ent, wr2Ent, rbEnt].find(
                        (w) => w && Math.abs(w.y - flatY) < 62 && (w.x - losX) * attDir > 5 && (w.x - losX) * attDir < 120
                      );
                      if (threatInFlat) {
                        chaseX = clamp(threatInFlat.x + attDir * 16, fbEzLeftX - 90, fbEzRightX + 90);
                        chaseY = clamp(threatInFlat.y, fbTopY + 16, fbBotY - 16);
                      } else {
                        chaseX = clamp(losX + attDir * 58, fbEzLeftX - 90, fbEzRightX + 90);
                        chaseY = flatY;
                      }
                      effMult = 0.89;
                    }
                  }
                } else if (carrier) {
                  // YAC / Run Play: Calculated Intercept Pursuit Angles
                  const dCar = Math.hypot(carrier.x - ent.x, carrier.y - ent.y);
                  const tLead = clamp(dCar / Math.max(135, ent.speed * 1.18), 0.08, 0.54);
                  chaseX = clamp(carrier.x + carrier.vx * tLead + attDir * 10, fbEzLeftX - 95, fbEzRightX + 95);
                  chaseY = clamp(carrier.y + carrier.vy * tLead, fbTopY + 14, fbBotY - 14);
                }

                const dx = chaseX - ent.x;
                const dy = chaseY - ent.y;
                const d = Math.hypot(dx, dy) || 1;
                const blockedByOl = oLinemen.some((ol) => Math.hypot(ol.x - ent.x, ol.y - ent.y) < 24);
                const effSpd = blockedByOl ? ent.speed * 0.26 : ent.speed * effMult;
                if (d > 4) {
                  ent.vx = (dx / d) * effSpd;
                  ent.vy = (dy / d) * effSpd;
                  ent.x = clamp(ent.x + ent.vx * dt, fbEzLeftX - 110, fbEzRightX + 110);
                  ent.y = clamp(ent.y + ent.vy * dt, fbTopY + 12, fbBotY - 12);
                } else {
                  ent.vx = 0;
                  ent.vy = 0;
                }
              } else if (ent.id !== fb.carrierId && ent.routeWaypoints.length > 0) {
                if (fb.phase === 'ball_in_air' && ent.id === fb.passTargetId && fb.passTeam === offTeam) {
                  // Targeted receiver sprints aggressively under/onto the anticipation throw point!
                  const dx = fb.passTargetX - ent.x;
                  const dy = fb.passTargetY - ent.y;
                  const d = Math.hypot(dx, dy);
                  if (d > 3) {
                    const trackSpd = ent.speed * 1.16;
                    ent.vx = (dx / d) * trackSpd;
                    ent.vy = (dy / d) * trackSpd;
                    ent.x = clamp(ent.x + ent.vx * dt, fbEzLeftX - 110, fbEzRightX + 110);
                    ent.y = clamp(ent.y + ent.vy * dt, fbTopY + 14, fbBotY - 14);
                  } else {
                    ent.vx = 0;
                    ent.vy = 0;
                  }
                } else {
                  const wp = ent.routeWaypoints[Math.min(ent.wpIdx, ent.routeWaypoints.length - 1)];
                  const dx = wp.x - ent.x;
                  const dy = wp.y - ent.y;
                  const d = Math.hypot(dx, dy);
                  if (d < 9 && ent.wpIdx < ent.routeWaypoints.length - 1) {
                    ent.wpIdx += 1;
                  } else if (d > 2) {
                    ent.vx = (dx / d) * ent.speed;
                    ent.vy = (dy / d) * ent.speed;
                    ent.x = clamp(ent.x + ent.vx * dt, fbEzLeftX - 110, fbEzRightX + 110);
                    ent.y = clamp(ent.y + ent.vy * dt, fbTopY + 14, fbBotY - 14);
                  } else {
                    const weaveY = Math.sin(now * 0.004 + (ent.role === 'wr1' ? 0 : Math.PI)) >= 0 ? 1 : -1;
                    ent.vx = attDir * 32;
                    ent.vy = weaveY * ent.speed * 0.6;
                    ent.x = clamp(ent.x + ent.vx * dt, fbEzLeftX - 110, fbEzRightX + 110);
                    ent.y = clamp(ent.y + ent.vy * dt, fbTopY + 16, fbBotY - 16);
                  }
                }
              }
            }

            // 3. Touchdown Plane Check BEFORE Tackle Check (Never deny a TD on the goal line!)
            let scoredTdThisFrame = false;
            if (fb.phase !== 'ball_in_air' && carrier) {
              if (fb.possession === 'player' && carrier.x >= fbEzRightX) {
                scoredTdThisFrame = true;
                const tdYds = Math.max(1, 100 - fbPlayStartYard);
                if (fbPlayWasPass) {
                  addFbStat('player', 'QB', (r) => { r.passYds += tdYds; r.passTd += 1; });
                  addFbStat('player', fbPlayReceiverPos, (r) => { r.recYds += tdYds; r.recTd += 1; });
                } else {
                  const rushPos: FbPosition = carrier.role === 'rb' ? 'RB' : carrier.role === 'qb' ? 'QB' : 'WR';
                  addFbStat('player', rushPos, (r) => { r.rushYds += tdYds; r.rushTd += 1; });
                }
                fb.scorePlayer += 7;
                fb.tds += 1;
                fb.possession = 'cpu';
                fb.down = 1;
                fb.losYard = 75;
                fb.firstDownYard = 65;
                fb.bannerText = 'TOUCHDOWN!! +7 · NOW DEFEND!';
                fb.bannerTimer = 1.5;
                fb.phase = 'play_over';
                fb.playOverTimer = 1.35;
                spawnParticles(fbEzRightX + 18, carrier.y, '#fde047', 26, 175);
                playRetroSportTone(660, 1320, 0.3, 'square', 0.1);
              } else if (fb.possession === 'cpu' && carrier.x <= fbEzLeftX) {
                scoredTdThisFrame = true;
                const tdYds = Math.max(1, fbPlayStartYard);
                if (fbPlayWasPass) {
                  addFbStat('cpu', 'QB', (r) => { r.passYds += tdYds; r.passTd += 1; });
                  addFbStat('cpu', fbPlayReceiverPos, (r) => { r.recYds += tdYds; r.recTd += 1; });
                } else {
                  const rushPos: FbPosition = carrier.role === 'rb' ? 'RB' : carrier.role === 'qb' ? 'QB' : 'WR';
                  addFbStat('cpu', rushPos, (r) => { r.rushYds += tdYds; r.rushTd += 1; });
                }
                fb.scoreCpu += 7;
                fb.possession = 'player';
                fb.down = 1;
                fb.losYard = 25;
                fb.firstDownYard = 35;
                fb.bannerText = 'CPU TOUCHDOWN +7 · YOUR DRIVE!';
                fb.bannerTimer = 1.5;
                fb.phase = 'play_over';
                fb.playOverTimer = 1.35;
                spawnParticles(fbEzLeftX - 18, carrier.y, '#ef4444', 22, 160);
                playRetroSportTone(240, 110, 0.25, 'sawtooth', 0.09);
              }
            }

            // 4. Tackle Check (Both Offense & Playable Defense!)
            if (!scoredTdThisFrame && fb.phase !== 'ball_in_air' && carrier) {
              for (const def of fb.entities) {
                if (def.team !== defTeam) continue;
                const userDiveRad = 18 + myFbProfile.tackle * 0.11;
                const userNormRad = 15 + myFbProfile.tackle * 0.06;
                const cpuTackleRad = fb.jukeTimer > 0 ? 8 : clamp(16 + (cLB.tackle - 75) * 0.06, 15, 21);
                const tackleRad =
                  fb.possession === 'cpu' && def.id === 'user_def'
                    ? fb.diveTimer > 0
                      ? userDiveRad
                      : userNormRad
                    : cpuTackleRad;
                if (Math.hypot(def.x - carrier.x, def.y - carrier.y) < tackleRad) {
                  const newYd = clamp(xToYard(carrier.x), 4, 99);
                  const wasBehindLos = (carrier.x - losX) * attDir < 0;
                  const gainYds =
                    fb.possession === 'player'
                      ? Math.max(-8, newYd - fbPlayStartYard)
                      : Math.max(-8, fbPlayStartYard - newYd);
                  if (fbPlayWasPass) {
                    addFbStat(fb.possession, 'QB', (r) => { r.passYds += Math.max(0, gainYds); });
                    addFbStat(fb.possession, fbPlayReceiverPos, (r) => { r.recYds += Math.max(0, gainYds); });
                  } else {
                    const rushPos: FbPosition = carrier.role === 'rb' ? 'RB' : carrier.role === 'qb' ? 'QB' : 'WR';
                    addFbStat(fb.possession, rushPos, (r) => { r.rushYds += gainYds; });
                  }
                  const defStatPos: FbPosition =
                    def.id === 'user_def' ? myFbProfile.position : def.role === 'cb' ? 'CB' : 'LB';
                  addFbStat(defTeam, defStatPos, (r) => {
                    r.tackles += 1;
                    if (wasBehindLos && !fbPlayWasPass && carrier.role === 'qb') r.sacks += 1;
                  });
                  fb.losYard = newYd;

                  if (fb.possession === 'player') {
                    if (fb.losYard >= fb.firstDownYard) {
                      fb.down = 1;
                      fb.firstDownYard = Math.min(100, fb.losYard + 10);
                      fb.bannerText = 'FIRST DOWN!!';
                      fb.bannerTimer = 1.0;
                      playRetroSportTone(620, 920, 0.15, 'square', 0.08);
                    } else {
                      fb.down += 1;
                      fb.bannerText = `TACKLED AT ${fb.losYard}YD`;
                      fb.bannerTimer = 1.0;
                      playRetroSportTone(180, 95, 0.16, 'sawtooth', 0.08);
                      if (fb.down > 4) {
                        fb.possession = 'cpu';
                        fb.down = 1;
                        fb.firstDownYard = Math.max(0, fb.losYard - 10);
                        fb.bannerText = 'TURNOVER ON DOWNS! PLAY DEFENSE!';
                        fb.bannerTimer = 1.35;
                      }
                    }
                  } else {
                    if (fb.losYard <= fb.firstDownYard) {
                      fb.down = 1;
                      fb.firstDownYard = Math.max(0, fb.losYard - 10);
                      fb.bannerText = 'CPU 1ST DOWN!';
                      fb.bannerTimer = 1.0;
                      playRetroSportTone(240, 160, 0.15, 'sawtooth', 0.08);
                    } else {
                      fb.down += 1;
                      fb.bannerText =
                        def.id === 'user_def'
                          ? wasBehindLos
                            ? 'USER SACK!! TFL!!'
                            : 'BIG USER HIT!! STOP!'
                          : `CPU STOPPED AT ${fb.losYard}YD`;
                      fb.bannerTimer = 1.05;
                      playRetroSportTone(def.id === 'user_def' ? 680 : 420, 940, 0.15, 'square', 0.08);
                      if (fb.down > 4) {
                        fb.possession = 'player';
                        fb.down = 1;
                        fb.firstDownYard = Math.min(100, fb.losYard + 10);
                        fb.bannerText = '4TH DOWN STOP!! YOUR BALL!';
                        fb.bannerTimer = 1.35;
                      }
                    }
                  }
                  fb.phase = 'play_over';
                  fb.playOverTimer = 1.1;
                  break;
                }
              }
            }

            // 5. Pass In Air Resolution + Immediate Endzone Catch TD + Real Interceptions
            if (fb.phase === 'ball_in_air') {
              fb.passElapsed += dt;
              const t = clamp(fb.passElapsed / fb.passDuration, 0, 1);
              fb.ballX = fb.passStartX + (fb.passTargetX - fb.passStartX) * t;
              fb.ballY = fb.passStartY + (fb.passTargetY - fb.passStartY) * t;

              // CPU Mid-Air Interceptions only when thrown straight into a nearby defender!
              if (fb.passTeam === 'player' && t > 0.42 && !fb.userPickRolled) {
                const pickRadius = fb.lastThrowPerfect ? 8 : 13;
                for (const d of fb.entities) {
                  if (d.team !== 'cpu') continue;
                  if (Math.hypot(d.x - fb.ballX, d.y - fb.ballY) < pickRadius) {
                    fb.userPickRolled = true;
                    const pickOdds = (fb.lastThrowPerfect ? 0.05 : 0.22) + (cCB.coverage - 78) * 0.002;
                    if (Math.random() < pickOdds) {
                      addFbStat('player', 'QB', (r) => { r.ints += 1; });
                      addFbStat('cpu', d.role === 'cb' ? 'CB' : 'LB', (r) => { r.defInt += 1; });
                      fb.possession = 'cpu';
                      fb.losYard = clamp(xToYard(fb.ballX), 5, 95);
                      fb.down = 1;
                      fb.firstDownYard = Math.max(0, fb.losYard - 10);
                      fb.bannerText = 'INTERCEPTED BY CPU!!';
                      fb.bannerTimer = 1.45;
                      fb.phase = 'play_over';
                      fb.playOverTimer = 1.3;
                      fb.statusText = 'TURNOVER! CPU jumped the route — PLAY DEFENSE!';
                      spawnParticles(fb.ballX, fb.ballY, '#ef4444', 22, 165);
                      playRetroSportTone(210, 95, 0.24, 'sawtooth', 0.09);
                    }
                    break;
                  }
                }
              }

              // User Defense Interception: scales cleanly with MyPlayer coverage & catchStat!
              if (fb.phase === 'ball_in_air' && fb.passTeam === 'cpu' && t > 0.36 && t < 0.94 && userDef && !fb.userPickRolled) {
                const pickRad =
                  fb.diveTimer > 0
                    ? 13 + myFbProfile.coverage * 0.08
                    : 8 + myFbProfile.coverage * 0.05;
                if (Math.hypot(userDef.x - fb.ballX, userDef.y - fb.ballY) < pickRad) {
                  fb.userPickRolled = true;
                  const covBonus = (myFbProfile.coverage - 70) * 0.006 + (myFbProfile.catchStat - 70) * 0.004;
                  const catchOdds = clamp((fb.diveTimer > 0 ? 0.48 : 0.28) + covBonus, 0.22, 0.78);
                  if (Math.random() < catchOdds) {
                    addFbStat('cpu', 'QB', (r) => { r.ints += 1; });
                    addFbStat('player', myFbProfile.position, (r) => { r.defInt += 1; });
                    fb.possession = 'player';
                    fb.losYard = clamp(xToYard(fb.ballX), 5, 95);
                    fb.down = 1;
                    fb.firstDownYard = Math.min(100, fb.losYard + 10);
                    fb.bannerText = 'INTERCEPTION!! YOUR BALL!!';
                    fb.bannerTimer = 1.45;
                    fb.phase = 'play_over';
                    fb.playOverTimer = 1.25;
                    spawnParticles(fb.ballX, fb.ballY, '#38bdf8', 24, 170);
                    playRetroSportTone(640, 1180, 0.25, 'square', 0.1);
                  } else if (Math.random() < 0.54) {
                    fb.down += 1;
                    fb.bannerText = 'DEFLECTED PASS!! INCOMPLETE!';
                    fb.bannerTimer = 1.1;
                    fb.statusText = 'Tipped away! Ball hit the turf!';
                    spawnParticles(fb.ballX, fb.ballY, '#fde047', 14, 130);
                    playRetroSportTone(520, 760, 0.14, 'square', 0.08);
                    if (fb.down > 4) {
                      fb.possession = 'player';
                      fb.down = 1;
                      fb.firstDownYard = Math.min(100, fb.losYard + 10);
                      fb.bannerText = '4TH DOWN STOP!! YOUR BALL!';
                      fb.bannerTimer = 1.35;
                    }
                    fb.phase = 'play_over';
                    fb.playOverTimer = 1.0;
                  }
                }
              }

              if (fb.phase === 'ball_in_air' && t >= 1) {
                const wr = fb.entities.find((e) => e.id === fb.passTargetId);
                if (!wr) {
                  fb.phase = 'play_over';
                  fb.playOverTimer = 0.8;
                } else if (fb.passTeam === 'player') {
                  const distToBall = Math.hypot(wr.x - fb.ballX, wr.y - fb.ballY);
                  const nearDefDist = Math.min(
                    ...fb.entities
                      .filter((d) => d.team === 'cpu')
                      .map((d) => Math.hypot(d.x - fb.ballX, d.y - fb.ballY))
                  );
                  const recCatch = wr.role === 'rb' ? pRB.catchStat : pWR.catchStat;
                  const breakupAdj = clamp((fb.lastThrowPerfect ? 0.16 : fbBreakupChance * 0.85) - (recCatch - 75) * 0.004, 0.06, 0.6);
                  if (nearDefDist < distToBall - 6 && nearDefDist < 17 && Math.random() < 0.42) {
                    addFbStat('player', 'QB', (r) => { r.ints += 1; });
                    addFbStat('cpu', 'CB', (r) => { r.defInt += 1; });
                    fb.possession = 'cpu';
                    fb.losYard = clamp(xToYard(fb.ballX), 5, 95);
                    fb.down = 1;
                    fb.firstDownYard = Math.max(0, fb.losYard - 10);
                    fb.bannerText = 'PICKED OFF AT CATCH POINT!!';
                    fb.bannerTimer = 1.4;
                    fb.statusText = 'DB undercut your receiver! PLAY DEFENSE!';
                    spawnParticles(fb.ballX, fb.ballY, '#ef4444', 20, 155);
                    playRetroSportTone(210, 95, 0.22, 'sawtooth', 0.09);
                    fb.phase = 'play_over';
                    fb.playOverTimer = 1.25;
                  } else if (distToBall > 54) {
                    fb.down += 1;
                    fb.bannerText = 'INCOMPLETE! OVERTHROWN!';
                    fb.bannerTimer = 1.05;
                    fb.statusText = 'Errant pass sailed incomplete — time green release in stride!';
                    playRetroSportTone(220, 120, 0.14, 'triangle', 0.07);
                    if (fb.down > 4) {
                      fb.possession = 'cpu';
                      fb.down = 1;
                      fb.firstDownYard = Math.max(0, fb.losYard - 10);
                      fb.bannerText = 'TURNOVER ON DOWNS! PLAY DEFENSE!';
                      fb.bannerTimer = 1.3;
                    }
                    fb.phase = 'play_over';
                    fb.playOverTimer = 1.0;
                  } else if (nearDefDist < (fb.lastThrowPerfect ? 12 : 17) && Math.random() < breakupAdj) {
                    fb.down += 1;
                    fb.bannerText = fb.lastThrowPerfect ? 'PASS BROKEN UP!' : 'DROPPED IN TRAFFIC!';
                    fb.bannerTimer = 1.05;
                    playRetroSportTone(200, 105, 0.16, 'sawtooth', 0.08);
                    if (fb.down > 4) {
                      fb.possession = 'cpu';
                      fb.down = 1;
                      fb.firstDownYard = Math.max(0, fb.losYard - 10);
                      fb.bannerText = 'TURNOVER ON DOWNS! PLAY DEFENSE!';
                      fb.bannerTimer = 1.3;
                    }
                    fb.phase = 'play_over';
                    fb.playOverTimer = 1.0;
                  } else {
                    wr.x = fb.ballX;
                    wr.y = fb.ballY;
                    addFbStat('player', fbPlayReceiverPos, (r) => { r.rec += 1; });
                    if (fb.ballX >= fbEzRightX) {
                      const tdYds = Math.max(1, 100 - fbPlayStartYard);
                      addFbStat('player', 'QB', (r) => { r.passYds += tdYds; r.passTd += 1; });
                      addFbStat('player', fbPlayReceiverPos, (r) => { r.recYds += tdYds; r.recTd += 1; });
                      fb.scorePlayer += 7;
                      fb.tds += 1;
                      fb.possession = 'cpu';
                      fb.down = 1;
                      fb.losYard = 75;
                      fb.firstDownYard = 65;
                      fb.bannerText = 'ENDZONE CATCH!! TOUCHDOWN +7!';
                      fb.bannerTimer = 1.5;
                      fb.phase = 'play_over';
                      fb.playOverTimer = 1.35;
                      fb.statusText = 'TOUCHDOWN CATCH IN THE ENDZONE!! NOW DEFEND!';
                      spawnParticles(fb.ballX, fb.ballY, '#fde047', 28, 180);
                      playRetroSportTone(660, 1320, 0.3, 'square', 0.1);
                    } else {
                      fb.phase = 'yac_run';
                      fb.carrierId = wr.id;
                      if (fb.lastThrowPerfect) fb.jukeTimer = 0.24;
                      fb.bannerText = fb.lastThrowPerfect ? 'CAUGHT IN STRIDE!! RUN YAC!' : 'CAUGHT!! RUN FOR YAC!';
                      fb.bannerTimer = 0.9;
                      fb.statusText = 'CAUGHT! Sprint RIGHT · [SPACE] Spin Move!';
                      playRetroSportTone(580, 960, 0.14, 'square', 0.08);
                    }
                  }
                } else {
                  // CPU Pass Arrival
                  const userDist = userDef ? Math.hypot(userDef.x - wr.x, userDef.y - wr.y) : 999;
                  const userBreakupOdds = clamp((fb.diveTimer > 0 ? 0.72 : 0.48) + (myFbProfile.coverage - 72) * 0.006, 0.38, 0.88);
                  const userTight = userDist < (15 + myFbProfile.coverage * 0.04) && Math.random() < userBreakupOdds;
                  const cpuDbTight = fb.entities.some(
                    (d) => d.team === 'player' && d.id !== 'user_def' && Math.hypot(d.x - wr.x, d.y - wr.y) < 14
                  );
                  if (userTight || (cpuDbTight && Math.random() < 0.36)) {
                    fb.down += 1;
                    fb.bannerText = userTight ? 'SWATTED BY YOU!!' : 'PASS BROKEN UP!';
                    fb.bannerTimer = 1.05;
                    playRetroSportTone(600, 880, 0.15, 'square', 0.08);
                    if (fb.down > 4) {
                      fb.possession = 'player';
                      fb.down = 1;
                      fb.firstDownYard = Math.min(100, fb.losYard + 10);
                      fb.bannerText = '4TH DOWN STOP!! YOUR BALL!';
                      fb.bannerTimer = 1.35;
                    }
                    fb.phase = 'play_over';
                    fb.playOverTimer = 1.05;
                  } else {
                    wr.x = fb.ballX;
                    wr.y = fb.ballY;
                    addFbStat('cpu', fbPlayReceiverPos, (r) => { r.rec += 1; });
                    if (fb.ballX <= fbEzLeftX) {
                      const tdYds = Math.max(1, fbPlayStartYard);
                      addFbStat('cpu', 'QB', (r) => { r.passYds += tdYds; r.passTd += 1; });
                      addFbStat('cpu', fbPlayReceiverPos, (r) => { r.recYds += tdYds; r.recTd += 1; });
                      fb.scoreCpu += 7;
                      fb.possession = 'player';
                      fb.down = 1;
                      fb.losYard = 25;
                      fb.firstDownYard = 35;
                      fb.bannerText = 'CPU ENDZONE CATCH TD +7!';
                      fb.bannerTimer = 1.5;
                      fb.phase = 'play_over';
                      fb.playOverTimer = 1.35;
                      spawnParticles(fb.ballX, fb.ballY, '#ef4444', 22, 160);
                      playRetroSportTone(240, 110, 0.25, 'sawtooth', 0.09);
                    } else {
                      fb.phase = 'yac_run';
                      fb.carrierId = wr.id;
                      fb.bannerText = 'CPU CATCH! TACKLE HIM!';
                      fb.bannerTimer = 0.9;
                      fb.statusText = 'CPU CAUGHT IT! Sprint & [SPACE] Dive Tackle!';
                      playRetroSportTone(300, 180, 0.12, 'triangle', 0.07);
                    }
                  }
                }
              }
            }
          }
        }

        // Smooth Horizontal Retro Bowl Camera Tracking!
        const camFocusX =
          fb.phase === 'ball_in_air'
            ? fb.ballX
            : fb.possession === 'cpu'
            ? userDef?.x ?? fb.ballX
            : fb.ballX;
        const targetCamX = clamp(
          camFocusX - CANVAS_W * (fb.possession === 'player' ? 0.36 : 0.62),
          0,
          fbWorldW - CANVAS_W
        );
        fb.camX += (targetCamX - fb.camX) * Math.min(1, dt * 7.5);

        // Render Retro Bowl Horizontal 1,920px Gridiron Turf
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        drawRetroBleachers(now, fbTopY, fbBotY, 26);

        ctx.save();
        ctx.translate(-Math.round(fb.camX), 0);

        // Main Green Playing Field + Endzones
        ctx.fillStyle = '#15803d';
        ctx.fillRect(0, fbTopY, fbWorldW, fbBotY - fbTopY);

        // 5-Yard & 10-Yard Alternating Turf Bands + Yard Numbers + Hash Marks
        for (let yd = 0; yd < 100; yd += 5) {
          const xA = yardToX(yd);
          const xB = yardToX(yd + 5);
          ctx.fillStyle = (yd / 5) % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
          ctx.fillRect(xA, fbTopY, xB - xA, fbBotY - fbTopY);
          ctx.strokeStyle = yd % 10 === 0 ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.28)';
          ctx.lineWidth = yd % 10 === 0 ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(xA, fbTopY);
          ctx.lineTo(xA, fbBotY);
          ctx.stroke();

          if (yd > 0 && yd % 10 === 0) {
            const displayYd = yd <= 50 ? yd : 100 - yd;
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(String(displayYd), xA, fbTopY + 26);
            ctx.fillText(String(displayYd), xA, fbBotY - 14);
          }
          // Center Hash Marks
          for (let hy = 0; hy < 5; hy++) {
            const hx = yardToX(yd + hy);
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillRect(hx, fbMidY - 46, 2, 5);
            ctx.fillRect(hx, fbMidY + 41, 2, 5);
          }
        }

        // 50-Yard Midfield MD Shield Crest + Sideline Down-Marker Box
        const fiftyX = yardToX(50);
        ctx.fillStyle = 'rgba(30,58,138,0.85)';
        ctx.beginPath();
        ctx.arc(fiftyX, fbMidY, 32, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MD', fiftyX, fbMidY + 6);

        const chainLosX = yardToX(fb.losYard);
        const chainFdX = yardToX(fb.firstDownYard);
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(chainLosX, fbTopY - 6);
        ctx.lineTo(chainFdX, fbTopY - 6);
        ctx.stroke();
        ctx.fillStyle = '#18181b';
        ctx.fillRect(chainLosX - 9, fbTopY - 17, 18, 13);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(chainLosX - 9, fbTopY - 17, 18, 13);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(String(fb.down), chainLosX, fbTopY - 7);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(chainFdX - 3, fbTopY - 14, 6, 10);

        // Left Endzone (HOME / DEFEND) & Right Endzone (TOUCHDOWN / OPP)
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(0, fbTopY, fbEzLeftX, fbBotY - fbTopY);
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(fbEzRightX, fbTopY, fbWorldW - fbEzRightX, fbBotY - fbTopY);

        ctx.save();
        ctx.translate(fbEzLeftX * 0.5, fbMidY);
        ctx.rotate(-Math.PI * 0.5);
        ctx.fillStyle = 'rgba(253,224,71,0.82)';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('HOME · DEFEND', 0, 7);
        ctx.restore();

        ctx.save();
        ctx.translate(fbEzRightX + (fbWorldW - fbEzRightX) * 0.5, fbMidY);
        ctx.rotate(Math.PI * 0.5);
        ctx.fillStyle = 'rgba(253,224,71,0.86)';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('TOUCHDOWN · OPP', 0, 7);
        ctx.restore();

        // Goalposts in both Endzones
        const drawGoalpost = (gx: number) => {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(gx, fbMidY - 34);
          ctx.lineTo(gx, fbMidY + 34);
          ctx.stroke();
          ctx.fillStyle = '#facc15';
          ctx.fillRect(gx - 4, fbMidY - 38, 8, 8);
          ctx.fillRect(gx - 4, fbMidY + 30, 8, 8);
        };
        drawGoalpost(24);
        drawGoalpost(fbWorldW - 24);

        // White Sideline Borders
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, fbTopY, fbWorldW, fbBotY - fbTopY);

        // Vertical LOS (Blue) & 1st Down (Yellow) Lines
        const losScreenX = yardToX(fb.losYard);
        const fdScreenX = yardToX(fb.firstDownYard);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(losScreenX, fbTopY);
        ctx.lineTo(losScreenX, fbBotY);
        ctx.stroke();

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(fdScreenX, fbTopY);
        ctx.lineTo(fdScreenX, fbBotY);
        ctx.stroke();

        // Pre-snap Madden Play Art: Offense shows OWN routes; Defense HIDES CPU routes & shows Defensive Coverage/Blitz zones!
        if (fb.phase === 'huddle') {
          if (fb.possession === 'player') {
            const offPlay = footballPlayRef.current;
            const qbEnt = fb.entities.find((e) => e.id === 'qb');
            const rbEnt = fb.entities.find((e) => e.id === 'rb');
            if (offPlay === 'pa_post' && qbEnt && rbEnt) {
              ctx.strokeStyle = '#fb923c';
              ctx.lineWidth = 2.5;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(qbEnt.x, qbEnt.y);
              ctx.lineTo(rbEnt.x + 28, rbEnt.y - 10);
              ctx.stroke();
              ctx.setLineDash([]);
            }
            for (const ent of fb.entities) {
              if (ent.team !== 'player' || ent.routeWaypoints.length === 0) continue;
              const isRun = (offPlay === 'sweep' || offPlay === 'inside_dive') && ent.role === 'rb';
              const isHot = ent.role === 'wr1';
              ctx.strokeStyle = isRun ? '#fb923c' : ent.role === 'rb' ? '#38bdf8' : isHot ? '#ef4444' : '#fde047';
              ctx.lineWidth = isRun ? 3.5 : 2.6;
              ctx.setLineDash(isRun ? [] : [6, 4]);
              ctx.beginPath();
              ctx.moveTo(ent.x, ent.y);
              for (const wp of ent.routeWaypoints) {
                ctx.lineTo(wp.x, wp.y);
              }
              ctx.stroke();
              ctx.setLineDash([]);
              const lastWp = ent.routeWaypoints[ent.routeWaypoints.length - 1];
              const prevWp = ent.routeWaypoints.length >= 2 ? ent.routeWaypoints[ent.routeWaypoints.length - 2] : { x: ent.x, y: ent.y };
              const ang = Math.atan2(lastWp.y - prevWp.y, lastWp.x - prevWp.x);
              ctx.fillStyle = ctx.strokeStyle;
              ctx.beginPath();
              ctx.moveTo(lastWp.x, lastWp.y);
              ctx.lineTo(lastWp.x - Math.cos(ang - 0.5) * 9, lastWp.y - Math.sin(ang - 0.5) * 9);
              ctx.lineTo(lastWp.x - Math.cos(ang + 0.5) * 9, lastWp.y - Math.sin(ang + 0.5) * 9);
              ctx.closePath();
              ctx.fill();
            }
          } else {
            // DEFENSE: CPU routes are COMPLETELY HIDDEN! Render player's Madden Defensive Play Art!
            const defCall = footballDefPlayRef.current;
            const drawZoneBubble = (fromEnt: FbEntity | undefined, zx: number, zy: number, rx: number, ry: number, color: string, fill: string) => {
              const czx = clamp(zx, fbEzLeftX - 75, fbEzRightX - 18);
              ctx.strokeStyle = color;
              ctx.fillStyle = fill;
              ctx.lineWidth = 2;
              if (fromEnt) {
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(fromEnt.x, fromEnt.y);
                ctx.lineTo(czx, zy);
                ctx.stroke();
                ctx.setLineDash([]);
              }
              ctx.beginPath();
              ctx.ellipse(czx, zy, rx, ry, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            };
            const drawBlitzArrow = (fromEnt: FbEntity | undefined, tx: number, ty: number) => {
              if (!fromEnt) return;
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(fromEnt.x, fromEnt.y);
              ctx.lineTo(tx, ty);
              ctx.stroke();
              const ang = Math.atan2(ty - fromEnt.y, tx - fromEnt.x);
              ctx.fillStyle = '#ef4444';
              ctx.beginPath();
              ctx.moveTo(tx, ty);
              ctx.lineTo(tx - Math.cos(ang - 0.5) * 8, ty - Math.sin(ang - 0.5) * 8);
              ctx.lineTo(tx - Math.cos(ang + 0.5) * 8, ty - Math.sin(ang + 0.5) * 8);
              ctx.closePath();
              ctx.fill();
            };
            const pFs = fb.entities.find((e) => e.id === 'p_fs');
            const pCb1 = fb.entities.find((e) => e.id === 'p_cb1');
            const pCb2 = fb.entities.find((e) => e.id === 'p_cb2');
            const pDl1 = fb.entities.find((e) => e.id === 'p_dl1');
            const pDl2 = fb.entities.find((e) => e.id === 'p_dl2');
            const cQb = fb.entities.find((e) => e.id === 'c_qb');
            const cWr1 = fb.entities.find((e) => e.id === 'c_wr1');
            const cWr2 = fb.entities.find((e) => e.id === 'c_wr2');

            drawBlitzArrow(pDl1, (cQb?.x ?? losScreenX + 36) - 6, fbMidY - 14);
            drawBlitzArrow(pDl2, (cQb?.x ?? losScreenX + 36) - 6, fbMidY + 14);

            if (defCall === 'cover2' || defCall === 'tampa2') {
              drawZoneBubble(pFs, losScreenX - 165, fbMidY, 44, 68, '#38bdf8', 'rgba(56,189,248,0.16)');
              drawZoneBubble(pCb1, losScreenX - 62, fbTopY + 52, 34, 28, '#fde047', 'rgba(250,204,21,0.16)');
              drawZoneBubble(pCb2, losScreenX - 62, fbBotY - 52, 34, 28, '#fde047', 'rgba(250,204,21,0.16)');
            } else if (defCall === 'cover3' || defCall === 'cover4') {
              const dOff = defCall === 'cover4' ? 182 : 155;
              drawZoneBubble(pCb1, losScreenX - dOff, fbTopY + 54, 42, 34, '#38bdf8', 'rgba(56,189,248,0.16)');
              drawZoneBubble(pFs, losScreenX - dOff - 12, fbMidY, 42, 42, '#38bdf8', 'rgba(56,189,248,0.18)');
              drawZoneBubble(pCb2, losScreenX - dOff, fbBotY - 54, 42, 34, '#38bdf8', 'rgba(56,189,248,0.16)');
            } else if (defCall === 'cover1_man') {
              if (pCb1 && cWr1) drawZoneBubble(pCb1, cWr1.x, cWr1.y, 16, 16, '#fb923c', 'rgba(251,146,60,0.18)');
              if (pCb2 && cWr2) drawZoneBubble(pCb2, cWr2.x, cWr2.y, 16, 16, '#fb923c', 'rgba(251,146,60,0.18)');
              drawZoneBubble(pFs, losScreenX - 155, fbMidY, 40, 62, '#38bdf8', 'rgba(56,189,248,0.16)');
            } else if (defCall === 'zone_blitz') {
              drawZoneBubble(pCb1, losScreenX - 148, fbTopY + 72, 42, 48, '#38bdf8', 'rgba(56,189,248,0.16)');
              drawZoneBubble(pFs, losScreenX - 148, fbBotY - 72, 42, 48, '#38bdf8', 'rgba(56,189,248,0.16)');
              drawBlitzArrow(pCb2, (cQb?.x ?? losScreenX + 36) - 4, (cQb?.y ?? fbMidY) + 8);
            } else if (defCall === 'zero_blitz') {
              if (pCb1 && cWr1) drawZoneBubble(pCb1, cWr1.x, cWr1.y, 16, 16, '#fb923c', 'rgba(251,146,60,0.2)');
              drawBlitzArrow(pCb2, (cQb?.x ?? losScreenX + 36) - 4, (cQb?.y ?? fbMidY) + 10);
              drawBlitzArrow(pFs, (cQb?.x ?? losScreenX + 36) - 4, cQb?.y ?? fbMidY);
            } else if (defCall === 'spy_contain') {
              drawZoneBubble(pCb1, losScreenX - 64, fbTopY + 52, 34, 28, '#fde047', 'rgba(250,204,21,0.16)');
              drawZoneBubble(pCb2, losScreenX - 64, fbBotY - 52, 34, 28, '#fde047', 'rgba(250,204,21,0.16)');
              drawZoneBubble(pFs, losScreenX - 58, fbMidY, 26, 36, '#c084fc', 'rgba(192,132,252,0.22)');
            }
          }
        }

        // Y-Sorted Pixel Football Players (Helmets + Shoulder Pads + Spin-Juke / Dive Tackle!)
        const sortedFb = [...fb.entities].sort((a, b) => a.y - b.y);
        for (const ent of sortedFb) {
          const isMyOffSlot =
            fb.possession === 'player' &&
            ((activeFbPos === 'QB' && ent.id === 'qb') ||
              (activeFbPos === 'RB' && ent.id === 'rb') ||
              (activeFbPos === 'WR' && ent.id === 'wr1'));
          const isActiveUser =
            (fb.possession === 'player' && ent.id === fb.carrierId && fb.phase !== 'ball_in_air') ||
            (fb.possession === 'cpu' && ent.id === 'user_def') ||
            isMyOffSlot;
          const pal = pickAthletePalette(ent.id.length * 3 + Math.round(ent.speed));
          drawRetroPixelAthlete(ctx, {
            x: ent.x,
            y: ent.y,
            vx: ent.vx,
            vy: ent.vy,
            faceX: ent.vx !== 0 ? (ent.vx >= 0 ? 1 : -1) : ent.team === 'player' ? 1 : -1,
            jerseyColor: ent.team === 'cpu' ? '#dc2626' : '#2563eb',
            trimColor: ent.team === 'cpu' ? '#ffffff' : '#fde047',
            shortsColor: '#e2e8f0',
            skinColor: pal.skin,
            helmetColor: ent.team === 'cpu' ? '#7f1d1d' : '#1e3a8a',
            hasPads: true,
            isUser: isActiveUser,
            spinTimer: fb.possession === 'player' && ent.id === fb.carrierId ? fb.jukeTimer : 0,
            divePose: ent.id === 'user_def' && fb.diveTimer > 0,
            numberStr: ent.jerseyNum || '12',
            scale: ent.role === 'ol' || ent.role === 'dl' ? 1.8 : 1.72,
            walkTime: ent.animTime || now * 0.005,
          });

          if (fb.possession === 'player' && fb.phase === 'live_pass' && (ent.id === 'wr1' || ent.id === 'wr2' || ent.id === 'rb')) {
            const qbEnt = fb.entities.find((q) => q.id === 'qb');
            const win = computeFootballPassWindow(qbEnt, ent);
            const activeTargetId = fb.throwCharging ? fb.throwTargetId : pickFootballTargetId();
            const isSelected = activeTargetId === ent.id;
            const badgeColor =
              win.openLabel === 'WIDE OPEN!'
                ? '#4ade80'
                : win.openLabel === 'OPEN'
                ? '#38bdf8'
                : win.openLabel === 'CONTESTED'
                ? '#fde047'
                : '#f87171';
            const keyTag = ent.id === 'wr1' ? '↑1' : ent.id === 'wr2' ? '↓2' : '3';
            const badgeText = `${keyTag} ${win.openLabel === 'WIDE OPEN!' ? 'WIDE' : win.openLabel}`;
            const bw = Math.max(46, badgeText.length * 6 + 10);
            ctx.fillStyle = 'rgba(9,9,11,0.9)';
            ctx.fillRect(ent.x - bw * 0.5, ent.y - 40, bw, 15);
            ctx.strokeStyle = isSelected ? '#ffffff' : badgeColor;
            ctx.lineWidth = isSelected ? 2 : 1.2;
            ctx.strokeRect(ent.x - bw * 0.5, ent.y - 40, bw, 15);
            ctx.fillStyle = badgeColor;
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(badgeText, ent.x, ent.y - 29);
          }
        }

        // Pass target landing ring & parabolic football oval with turf shadow
        if (fb.phase === 'ball_in_air') {
          ctx.strokeStyle = fb.passTeam === 'cpu' ? 'rgba(248,113,113,0.92)' : 'rgba(56,189,248,0.92)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(fb.passTargetX, fb.passTargetY, 14 + Math.sin(now * 0.025) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        const passT = fb.phase === 'ball_in_air' ? clamp(fb.passElapsed / fb.passDuration, 0, 1) : 0;
        const airLift = fb.phase === 'ball_in_air' ? 8 + Math.sin(passT * Math.PI) * 40 : 3;
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(fb.ballX, fb.ballY + 4, 8, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.ellipse(fb.ballX, fb.ballY - airLift, 9, 5.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(fb.ballX) - 3, Math.round(fb.ballY - airLift) - 1, 6, 2);

        // QB Live Dynamic Pass Meter + Real-Time Anticipation Target Preview!
        if (fb.possession === 'player' && fb.phase === 'live_pass' && fb.carrierId === 'qb') {
          const qbEnt = fb.entities.find((e) => e.id === 'qb');
          if (qbEnt) {
            const targetId = fb.throwCharging ? fb.throwTargetId : pickFootballTargetId();
            const targetEnt = fb.entities.find((e) => e.id === targetId);
            if (targetEnt && fb.throwCharging) {
              const pPow = pQB.throwPow * 0.72 + myFbProfile.throwPow * 0.28;
              const antPlan = computeFbAnticipationPass(qbEnt, targetEnt, 'player', pPow, true, 0);
              ctx.strokeStyle = 'rgba(56,189,248,0.68)';
              ctx.lineWidth = 2;
              ctx.setLineDash([5, 4]);
              ctx.beginPath();
              ctx.moveTo(targetEnt.x, targetEnt.y);
              ctx.lineTo(antPlan.predX, antPlan.predY);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(antPlan.predX, antPlan.predY, 9, 0, Math.PI * 2);
              ctx.stroke();
            }
            const liveWin = computeFootballPassWindow(qbEnt, targetEnt);
            const gStart = fb.throwCharging ? fb.throwGreenStart : liveWin.greenStart;
            const gWidth = fb.throwCharging ? fb.throwGreenWidth : liveWin.greenWidth;
            const mx = qbEnt.x - 34;
            const my = clamp(qbEnt.y - 46, fbTopY + 12, fbBotY - 82);
            const mh = 68;
            ctx.fillStyle = 'rgba(9,9,11,0.92)';
            ctx.fillRect(mx - 6, my, 12, mh);
            ctx.strokeStyle = '#e4e4e7';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(mx - 6, my, 12, mh);
            const gTopY = my + (1 - (gStart + gWidth)) * mh;
            const gH = gWidth * mh;
            ctx.fillStyle = gWidth >= 0.34 ? '#22c55e' : gWidth >= 0.2 ? '#eab308' : '#f97316';
            ctx.fillRect(mx - 4, gTopY, 8, gH);
            if (fb.throwCharging) {
              const fillH = fb.throwCharge * mh;
              const inG = fb.throwCharge >= gStart && fb.throwCharge <= gStart + gWidth;
              ctx.fillStyle = inG ? '#fde047' : '#38bdf8';
              ctx.fillRect(mx - 4, my + mh - fillH, 8, fillH);
            }
            ctx.fillStyle = 'rgba(9,9,11,0.92)';
            ctx.fillRect(mx - 22, my - 17, 44, 14);
            ctx.fillStyle = gWidth >= 0.34 ? '#4ade80' : gWidth >= 0.2 ? '#fde047' : '#f87171';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${targetId.toUpperCase()} ${Math.round(gWidth * 100)}%`, mx, my - 7);
          }
        }

        ctx.restore();

        // Bottom Stadium Telemetry: Mini Field Radar + Live WR Openness Readout!
        const radW = 340;
        const radX = 24;
        const radY = fbBotY + 12;
        ctx.fillStyle = 'rgba(9,9,11,0.9)';
        ctx.fillRect(radX - 4, radY - 4, radW + 8, 22);
        ctx.strokeStyle = fb.possession === 'player' ? '#38bdf8' : '#f87171';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(radX - 4, radY - 4, radW + 8, 22);
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(radX, radY, radW * (10 / 120), 14);
        ctx.fillStyle = '#15803d';
        ctx.fillRect(radX + radW * (10 / 120), radY, radW * (100 / 120), 14);
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(radX + radW * (110 / 120), radY, radW * (10 / 120), 14);
        const radLosX = radX + (fbEzLeftX / fbWorldW) * radW + (fb.losYard / 100) * (radW * (100 / 120));
        const radFdX = radX + (fbEzLeftX / fbWorldW) * radW + (fb.firstDownYard / 100) * (radW * (100 / 120));
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(radLosX - 1, radY, 2, 14);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(radFdX - 1, radY, 2, 14);
        const radBallX = radX + clamp(fb.ballX / fbWorldW, 0, 1) * radW;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(radBallX, radY + 7, 4, 0, Math.PI * 2);
        ctx.fill();

        // Live Receiver Openness Pill Bar (Right of Radar)
        const qbRead = fb.entities.find((e) => e.id === 'qb');
        const wr1Read = computeFootballPassWindow(qbRead, fb.entities.find((e) => e.id === 'wr1'));
        const wr2Read = computeFootballPassWindow(qbRead, fb.entities.find((e) => e.id === 'wr2'));
        ctx.fillStyle = 'rgba(9,9,11,0.9)';
        ctx.fillRect(382, radY - 4, 396, 22);
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.strokeRect(382, radY - 4, 396, 22);
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = wr1Read.openLabel === 'WIDE OPEN!' ? '#4ade80' : wr1Read.openLabel === 'OPEN' ? '#38bdf8' : '#f87171';
        ctx.fillText(
          `[↑1] WR1: ${wr1Read.openLabel} (${Math.round(wr1Read.greenWidth * 100)}%)`,
          392,
          radY + 10
        );
        ctx.fillStyle = wr2Read.openLabel === 'WIDE OPEN!' ? '#4ade80' : wr2Read.openLabel === 'OPEN' ? '#38bdf8' : '#f87171';
        ctx.fillText(
          `[↓2] WR2: ${wr2Read.openLabel} (${Math.round(wr2Read.greenWidth * 100)}%)`,
          588,
          radY + 10
        );

        if (fb.bannerTimer > 0) {
          ctx.fillStyle = 'rgba(9,9,11,0.88)';
          ctx.fillRect(CANVAS_W * 0.5 - 165, CANVAS_H * 0.5 - 24, 330, 36);
          ctx.strokeStyle = '#fde047';
          ctx.strokeRect(CANVAS_W * 0.5 - 165, CANVAS_H * 0.5 - 24, 330, 36);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(fb.bannerText, CANVAS_W * 0.5, CANVAS_H * 0.5);
        }
      }

      // =====================================================================
      // 5. HEAVILY UPGRADED 3v3 / 5v5 REAL-TIME RETRO ARCADE SOCCER
      // =====================================================================
      else if (sport === 'soccer') {
        if (!soccer.finished) {
          if (soccer.bannerTimer > 0) soccer.bannerTimer = Math.max(0, soccer.bannerTimer - dt);
          if (soccer.netRippleTimer > 0) soccer.netRippleTimer = Math.max(0, soccer.netRippleTimer - dt);
          if (soccer.keeperLeftCooldown > 0) soccer.keeperLeftCooldown = Math.max(0, soccer.keeperLeftCooldown - dt);
          if (soccer.keeperRightCooldown > 0) soccer.keeperRightCooldown = Math.max(0, soccer.keeperRightCooldown - dt);
          if (soccer.goalPauseTimer > 0) {
            soccer.goalPauseTimer -= dt;
            if (soccer.goalPauseTimer <= 0) {
              soccer.ballX = socMidX;
              soccer.ballY = socMidY;
              soccer.ballVx = 0;
              soccer.ballVy = 0;
              soccer.ownerId = 'sp_0';
              resetSoccerKickoff('player');
            }
          } else {
            soccer.timeLeft = Math.max(0, soccer.timeLeft - dt);
            if (soccer.timeLeft <= 0) {
              soccer.finished = true;
              playRetroSportTone(660, 880, 0.35, 'square', 0.1);
              syncHud(true);
            }

            const user = socPlayers[0];
            if (user.tackleCooldown > 0) user.tackleCooldown = Math.max(0, user.tackleCooldown - dt);
            if (user.shootCooldown > 0) user.shootCooldown = Math.max(0, user.shootCooldown - dt);
            if (user.skillTimer > 0) user.skillTimer = Math.max(0, user.skillTimer - dt);
            if (user.stunTimer > 0) user.stunTimer = Math.max(0, user.stunTimer - dt);
            const uSpd = 232;
            const mLen = Math.hypot(moveX, moveY) || 1;
            if (moveX !== 0 || moveY !== 0) {
              user.vx = (moveX / mLen) * uSpd;
              user.vy = (moveY / mLen) * uSpd;
              user.faceX = moveX / mLen;
              user.faceY = moveY / mLen;
              user.animTime += dt * 8.2;
            } else {
              user.vx *= 0.85;
              user.vy *= 0.85;
              user.animTime += dt * 1.2;
            }
            if (sharpCutTriggered && soccer.ownerId === user.id && user.tackleCooldown <= 0) {
              const nearCpu = socPlayers.some((c) => c.team === 'cpu' && Math.hypot(c.x - user.x, c.y - user.y) < 82);
              if (nearCpu) triggerSoccerSkillMove();
            }
            user.x = clamp(user.x + user.vx * dt, socLeft + 14, socRight - 14);
            user.y = clamp(user.y + user.vy * dt, socTop + 14, socBot - 14);

            if (soccer.shotCharging && actionHeld && soccer.ownerId === user.id) {
              soccer.shotCharge = Math.min(1, soccer.shotCharge + dt * 1.72);
              if (soccer.shotCharge >= 1) releaseHoldAction();
            } else if (soccer.shotCharging && !actionHeld) {
              releaseHoldAction();
            }

            // AI Teammates & Opponents (Dynamic Passing + Open Shooting!)
            const ownerEntity = socPlayers.find((e) => e.id === soccer.ownerId) || null;
            for (let i = 1; i < socPlayers.length; i++) {
              const p = socPlayers[i];
              if (p.tackleCooldown > 0) p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
              if (p.shootCooldown > 0) p.shootCooldown = Math.max(0, p.shootCooldown - dt);
              if (p.skillTimer > 0) p.skillTimer = Math.max(0, p.skillTimer - dt);
              if (p.stunTimer > 0) {
                p.stunTimer = Math.max(0, p.stunTimer - dt);
                p.vx *= 0.82;
                p.vy *= 0.82;
                p.animTime += dt * 2;
                continue;
              }
              let tx = p.x;
              let ty = p.y;
              let spd = p.team === 'cpu' ? 168 * socCpuSpeedScale : 176;

              if (soccer.ownerId === p.id) {
                tx = p.team === 'player' ? socRight - 90 : socLeft + 90;
                ty = socMidY + (p.baseY - socMidY) * 0.35;
                spd = p.team === 'cpu' ? 174 * socCpuSpeedScale : 182;
                const nearEnemy = socPlayers.some(
                  (e) => e.team !== p.team && Math.hypot(e.x - p.x, e.y - p.y) < 38
                );
                if (p.team === 'player' && p.shootCooldown <= 0) {
                  if (p.x > socMidX + 25 && Math.random() < (p.x > socRight - 210 ? 0.14 : 0.05)) {
                    const gx = socRight;
                    const gy =
                      soccer.keeperRightY > socMidY
                        ? socMidY - (34 + Math.random() * 18)
                        : socMidY + (34 + Math.random() * 18);
                    const d = Math.hypot(gx - p.x, gy - p.y) || 1;
                    soccer.ownerId = null;
                    p.shootCooldown = 0.55;
                    soccer.ballVx = ((gx - p.x) / d) * 530;
                    soccer.ballVy = ((gy - p.y) / d) * 530;
                    soccer.statusText = 'TEAMMATE RIPS A SHOT ON GOAL!!';
                    playRetroSportTone(320, 680, 0.12, 'square', 0.07);
                  } else if (nearEnemy && p.x <= socMidX + 25 && Math.random() < 0.08) {
                    const fwdMate = socPlayers
                      .filter((m) => m.team === 'player' && m.id !== p.id)
                      .sort((a, b) => b.x - a.x)[0];
                    if (fwdMate) {
                      const d = Math.hypot(fwdMate.x - p.x, fwdMate.y - p.y) || 1;
                      soccer.ownerId = null;
                      p.shootCooldown = 0.5;
                      soccer.ballVx = ((fwdMate.x - p.x) / d) * 415;
                      soccer.ballVy = ((fwdMate.y - p.y) / d) * 415;
                      soccer.statusText = 'Teammate threads a pass upfield!';
                    }
                  }
                } else if (p.team === 'cpu' && p.shootCooldown <= 0) {
                  if (p.x < socMidX - 35 && Math.random() < (p.x < socLeft + 185 ? 0.095 : 0.032)) {
                    // CPU fires realistic shot (with human spread instead of unsaveable corner laser!)
                    const gx = socLeft;
                    const gy = socMidY + (Math.random() - 0.5) * 96;
                    const d = Math.hypot(gx - p.x, gy - p.y) || 1;
                    soccer.ownerId = null;
                    p.shootCooldown = 0.65;
                    soccer.ballVx = ((gx - p.x) / d) * (395 * socCpuSpeedScale);
                    soccer.ballVy = ((gy - p.y) / d) * (395 * socCpuSpeedScale);
                    soccer.statusText = 'CPU STRIKER FIRES ON GOAL!!';
                  }
                }
              } else if (!soccer.ownerId) {
                const sameTeam = socPlayers
                  .filter((pl) => pl.team === p.team)
                  .sort(
                    (a, b) =>
                      Math.hypot(a.x - soccer.ballX, a.y - soccer.ballY) -
                      Math.hypot(b.x - soccer.ballX, b.y - soccer.ballY)
                  );
                if (sameTeam.indexOf(p) < 2) {
                  tx = soccer.ballX;
                  ty = soccer.ballY;
                  spd = 190 * (p.team === 'cpu' ? socCpuSpeedScale : 1);
                } else {
                  tx = clamp(socMidX + p.roleBiasX, socLeft + 52, socRight - 52);
                  ty = clamp(p.baseY, socTop + 36, socBot - 36);
                  spd = 152;
                }
              } else if (ownerEntity && ownerEntity.team === p.team) {
                tx = clamp(ownerEntity.x + (p.team === 'player' ? 120 : -120) + p.roleBiasX * 0.35, socLeft + 54, socRight - 54);
                ty = clamp(p.baseY, socTop + 36, socBot - 36);
                spd = 165;
              } else if (ownerEntity) {
                const defendersSorted = socPlayers
                  .filter((pl) => pl.team === p.team)
                  .sort(
                    (a, b) =>
                      Math.hypot(a.x - ownerEntity.x, a.y - ownerEntity.y) -
                      Math.hypot(b.x - ownerEntity.x, b.y - ownerEntity.y)
                  );
                if (defendersSorted[0]?.id === p.id) {
                  tx = ownerEntity.x;
                  ty = ownerEntity.y;
                  spd = 172 * (p.team === 'cpu' ? socCpuSpeedScale : 1);
                } else {
                  tx = clamp(ownerEntity.x + (p.team === 'player' ? -80 : 80) + p.roleBiasX * 0.4, socLeft + 56, socRight - 56);
                  ty = clamp(p.baseY, socTop + 36, socBot - 36);
                  spd = 154;
                }
                if (
                  p.team === 'cpu' &&
                  p.tackleCooldown <= 0 &&
                  Math.hypot(p.x - ownerEntity.x, p.y - ownerEntity.y) < 22
                ) {
                  p.tackleCooldown = 1.25;
                  if (Math.random() < 0.25) {
                    soccer.ownerId = p.id;
                    soccer.statusText = 'CPU stole the ball! Tap [SPACE] to slide tackle!';
                  }
                }
              }

              const dx = tx - p.x;
              const dy = ty - p.y;
              const d = Math.hypot(dx, dy);
              if (d > 3) {
                p.vx = (dx / d) * spd;
                p.vy = (dy / d) * spd;
                p.x = clamp(p.x + p.vx * dt, socLeft + 14, socRight - 14);
                p.y = clamp(p.y + p.vy * dt, socTop + 14, socBot - 14);
                p.faceX = dx / d;
                p.faceY = dy / d;
                p.animTime += dt * 6.5;
              } else {
                p.animTime += dt * 1.2;
              }
            }

            // Equal Goalkeepers: Both Player GK & CPU GK share identical predictive AI, speed, reach, and parry clears!
            const symKeeperSpeed = isSoccerTourney ? soccerTourneyRound.keeperSpeed : 132;
            const leftBallIncoming = !soccer.ownerId && soccer.ballVx < -60;
            const leftProjectedY = leftBallIncoming
              ? clamp(
                  soccer.ballY + soccer.ballVy * ((socLeft + 14 - soccer.ballX) / soccer.ballVx),
                  socMidY - goalSpanHalf + 12,
                  socMidY + goalSpanHalf - 12
                )
              : clamp(soccer.ballY, socMidY - goalSpanHalf + 16, socMidY + goalSpanHalf - 16);
            soccer.keeperLeftY += clamp(leftProjectedY - soccer.keeperLeftY, -symKeeperSpeed * dt, symKeeperSpeed * dt);

            const rightBallIncoming = !soccer.ownerId && soccer.ballVx > 60;
            const rightProjectedY = rightBallIncoming
              ? clamp(
                  soccer.ballY + soccer.ballVy * ((socRight - 14 - soccer.ballX) / soccer.ballVx),
                  socMidY - goalSpanHalf + 12,
                  socMidY + goalSpanHalf - 12
                )
              : clamp(soccer.ballY, socMidY - goalSpanHalf + 16, socMidY + goalSpanHalf - 16);
            soccer.keeperRightY += clamp(rightProjectedY - soccer.keeperRightY, -symKeeperSpeed * dt, symKeeperSpeed * dt);

            // Ball Movement, Symmetric Keeper Saves, Goal Detection!
            if (soccer.ownerId) {
              const own = socPlayers.find((e) => e.id === soccer.ownerId);
              if (own) {
                const dribbleOffset = own.skillTimer > 0 ? Math.sin(now * 0.04) * 5 : 0;
                soccer.ballX = own.x + own.faceX * 14 - own.faceY * dribbleOffset;
                soccer.ballY = own.y + own.faceY * 14 + own.faceX * dribbleOffset;
                soccer.ballSpin += Math.hypot(own.vx, own.vy) * dt * 0.04;
              }
            } else {
              soccer.ballX += soccer.ballVx * dt;
              soccer.ballY += soccer.ballVy * dt;
              soccer.ballSpin += Math.hypot(soccer.ballVx, soccer.ballVy) * dt * 0.035;
              const dec = Math.pow(0.975, dt * 60);
              soccer.ballVx *= dec;
              soccer.ballVy *= dec;

              // Symmetric Goalmouth Checks (Both Keepers: 16px reach, 0.4s cooldown, strong parry clear!)
              const inGoalMouthY = Math.abs(soccer.ballY - socMidY) <= goalSpanHalf - 4;
              if (soccer.ballX >= socRight - 10 && inGoalMouthY) {
                if (soccer.keeperRightCooldown <= 0 && Math.abs(soccer.ballY - soccer.keeperRightY) < 16) {
                  soccer.keeperRightCooldown = 0.4;
                  soccer.ballVx = -Math.max(240, Math.abs(soccer.ballVx) * 0.8);
                  soccer.ballVy = (soccer.ballY >= socMidY ? 1 : -1) * (150 + Math.random() * 90);
                  soccer.ballX = socRight - 18;
                  soccer.statusText = 'PARRIED BY KEEPER! FOLLOW UP THE REBOUND!';
                  spawnParticles(socRight - 14, soccer.keeperRightY, '#fb923c', 12, 115);
                  playRetroSportTone(340, 560, 0.14, 'square', 0.08);
                } else {
                  soccer.playerGoals += 1;
                  soccer.bannerText = 'GOOOAAAAL!! HOME +1!';
                  soccer.bannerTimer = 1.4;
                  soccer.goalPauseTimer = 1.3;
                  soccer.netRippleTimer = 1.1;
                  spawnParticles(socRight, soccer.ballY, '#fde047', 24, 165);
                  playRetroSportTone(580, 1180, 0.25, 'square', 0.09);
                }
              } else if (soccer.ballX <= socLeft + 10 && inGoalMouthY) {
                if (soccer.keeperLeftCooldown <= 0 && Math.abs(soccer.ballY - soccer.keeperLeftY) < 16) {
                  soccer.keeperLeftCooldown = 0.4;
                  soccer.ballVx = Math.max(240, Math.abs(soccer.ballVx) * 0.8);
                  soccer.ballVy = (soccer.ballY >= socMidY ? 1 : -1) * (150 + Math.random() * 90);
                  soccer.ballX = socLeft + 18;
                  soccer.statusText = 'CLUTCH SAVE BY YOUR KEEPER!!';
                  spawnParticles(socLeft + 14, soccer.keeperLeftY, '#38bdf8', 12, 115);
                  playRetroSportTone(340, 560, 0.14, 'square', 0.08);
                } else {
                  soccer.cpuGoals += 1;
                  soccer.bannerText = 'CPU GOAL!!';
                  soccer.bannerTimer = 1.4;
                  soccer.goalPauseTimer = 1.3;
                  soccer.netRippleTimer = 1.1;
                  spawnParticles(socLeft, soccer.ballY, '#ef4444', 20, 145);
                  playRetroSportTone(190, 95, 0.24, 'sawtooth', 0.09);
                }
              } else {
                // Bounce off pitch walls
                if (soccer.ballX < socLeft + 8 || soccer.ballX > socRight - 8) {
                  soccer.ballVx = -soccer.ballVx * 0.75;
                  soccer.ballX = clamp(soccer.ballX, socLeft + 9, socRight - 9);
                }
                if (soccer.ballY < socTop + 8 || soccer.ballY > socBot - 8) {
                  soccer.ballVy = -soccer.ballVy * 0.75;
                  soccer.ballY = clamp(soccer.ballY, socTop + 9, socBot - 9);
                }
                // Loose ball pickup
                if (Math.hypot(soccer.ballVx, soccer.ballVy) < 280) {
                  for (const p of socPlayers) {
                    if (p.stunTimer <= 0 && Math.hypot(p.x - soccer.ballX, p.y - soccer.ballY) < 19) {
                      soccer.ownerId = p.id;
                      break;
                    }
                  }
                }
              }
            }
          }
        }

        // Render 16-Bit Retro Striped Soccer Pitch
        drawRetroBleachers(now, socTop, socBot, 26);
        ctx.fillStyle = '#15803d';
        ctx.fillRect(socLeft, socTop, socRight - socLeft, socBot - socTop);
        for (let sx = socLeft; sx < socRight; sx += 72) {
          ctx.fillStyle = Math.floor((sx - socLeft) / 72) % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'transparent';
          ctx.fillRect(sx, socTop, Math.min(72, socRight - sx), socBot - socTop);
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(socLeft, socTop, socRight - socLeft, socBot - socTop);
        ctx.beginPath();
        ctx.moveTo(socMidX, socTop);
        ctx.lineTo(socMidX, socBot);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(socMidX, socMidY, 52, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(socMidX - 3, socMidY - 3, 6, 6);
        // Penalty Boxes & Rippling Net Mesh Goals
        ctx.strokeRect(socLeft, socMidY - 96, 86, 192);
        ctx.strokeRect(socRight - 86, socMidY - 96, 86, 192);
        const rippleWave = soccer.netRippleTimer > 0 ? Math.sin(now * 0.03) * 4 * soccer.netRippleTimer : 0;
        const drawGoalNet = (gx: number, isRightGoal: boolean) => {
          const gw = 16;
          const x0 = isRightGoal ? gx : gx - gw;
          ctx.fillStyle = 'rgba(15,23,42,0.45)';
          ctx.fillRect(x0, socMidY - goalSpanHalf, gw, goalSpanHalf * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          ctx.lineWidth = 1;
          for (let ny = socMidY - goalSpanHalf + 6; ny < socMidY + goalSpanHalf; ny += 8) {
            ctx.beginPath();
            ctx.moveTo(x0, ny);
            ctx.lineTo(x0 + gw + (isRightGoal ? rippleWave : -rippleWave), ny);
            ctx.stroke();
          }
          for (let nx = x0 + 4; nx < x0 + gw; nx += 5) {
            ctx.beginPath();
            ctx.moveTo(nx, socMidY - goalSpanHalf);
            ctx.lineTo(nx + rippleWave * 0.5, socMidY + goalSpanHalf);
            ctx.stroke();
          }
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.strokeRect(x0, socMidY - goalSpanHalf, gw, goalSpanHalf * 2);
        };
        drawGoalNet(socLeft, false);
        drawGoalNet(socRight, true);

        // Corner Pixel Flags
        for (const [fx, fy] of [
          [socLeft, socTop],
          [socRight, socTop],
          [socLeft, socBot],
          [socRight, socBot],
        ]) {
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(fx - 1, fy - 12, 2, 12);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(fx + 1, fy - 12, 6, 4);
        }

        // Y-Sorted Pixel Keepers & Outfield Pitch Players
        type SocSprite = {
          x: number;
          y: number;
          faceX: number;
          faceY: number;
          vx: number;
          vy: number;
          jerseyColor: string;
          trimColor: string;
          shortsColor: string;
          skin: string;
          hair: string;
          num: string;
          isUser: boolean;
          isGoalie: boolean;
          walkTime: number;
          spinTimer: number;
          stunTimer: number;
        };
        const socSprites: SocSprite[] = [
          {
            x: socLeft + 14,
            y: soccer.keeperLeftY,
            faceX: 1,
            faceY: 0,
            vx: 0,
            vy: 0,
            jerseyColor: '#22c55e',
            trimColor: '#fde047',
            shortsColor: '#09090b',
            skin: '#d99b66',
            hair: '#18181b',
            num: '1',
            isUser: false,
            isGoalie: true,
            walkTime: now * 0.002,
            spinTimer: 0,
            stunTimer: 0,
          },
          {
            x: socRight - 14,
            y: soccer.keeperRightY,
            faceX: -1,
            faceY: 0,
            vx: 0,
            vy: 0,
            jerseyColor: '#f97316',
            trimColor: '#ffffff',
            shortsColor: '#09090b',
            skin: '#9c643b',
            hair: '#18181b',
            num: '1',
            isUser: false,
            isGoalie: true,
            walkTime: now * 0.002,
            spinTimer: 0,
            stunTimer: 0,
          },
        ];
        for (const p of socPlayers) {
          const pal = pickAthletePalette(p.seed);
          socSprites.push({
            x: p.x,
            y: p.y,
            faceX: p.faceX,
            faceY: p.faceY,
            vx: p.vx,
            vy: p.vy,
            jerseyColor: p.team === 'player' ? '#2563eb' : '#dc2626',
            trimColor: p.team === 'player' ? '#93c5fd' : '#fca5a5',
            shortsColor: p.team === 'player' ? '#1e3a8a' : '#7f1d1d',
            skin: pal.skin,
            hair: pal.hair,
            num: p.jerseyNum,
            isUser: p.isUser,
            isGoalie: false,
            walkTime: p.animTime,
            spinTimer: p.skillTimer,
            stunTimer: p.stunTimer,
          });
        }
        socSprites.sort((a, b) => a.y - b.y);
        for (const s of socSprites) {
          drawRetroPixelAthlete(ctx, {
            x: s.x,
            y: s.y,
            vx: s.vx,
            vy: s.vy,
            faceX: s.faceX,
            faceY: s.faceY,
            jerseyColor: s.jerseyColor,
            trimColor: s.trimColor,
            shortsColor: s.shortsColor,
            skinColor: s.skin,
            hairColor: s.hair,
            numberStr: s.num,
            isUser: s.isUser,
            isGoalie: s.isGoalie,
            walkTime: s.walkTime,
            spinTimer: s.spinTimer,
            stunTimer: s.stunTimer,
            scale: 1.0,
          });
        }

        // Basketball-Style Vertical Green-Zone Shot Meter next to User!
        const userSoc = socPlayers[0];
        if (soccer.ownerId === userSoc.id || soccer.shotCharging) {
          const previewWin = soccer.shotCharging
            ? {
                greenStart: soccer.shotGreenStart,
                greenWidth: soccer.shotGreenWidth,
                label: soccer.shotDifficultyLabel,
              }
            : computeSoccerShotWindow(userSoc);

          const mx = clamp(userSoc.x + 26, socLeft + 16, socRight - 16);
          const my = clamp(userSoc.y - 42, socTop + 8, socBot - 76);
          const mh = 68;
          ctx.fillStyle = 'rgba(9,9,11,0.9)';
          ctx.fillRect(mx - 6, my, 12, mh);
          ctx.strokeStyle = '#e4e4e7';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(mx - 6, my, 12, mh);
          const gTopY = my + (1 - (previewWin.greenStart + previewWin.greenWidth)) * mh;
          const gH = previewWin.greenWidth * mh;
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(mx - 4, gTopY, 8, gH);

          if (soccer.shotCharging) {
            const fillH = soccer.shotCharge * mh;
            const inG =
              soccer.shotCharge >= previewWin.greenStart &&
              soccer.shotCharge <= previewWin.greenStart + previewWin.greenWidth;
            ctx.fillStyle = inG ? '#fde047' : '#38bdf8';
            ctx.fillRect(mx - 4, my + mh - fillH, 8, fillH);
          }

          ctx.fillStyle = 'rgba(9,9,11,0.84)';
          ctx.fillRect(CANVAS_W * 0.5 - 205, socBot - 24, 410, 18);
          ctx.fillStyle = '#e4e4e7';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(
            `${previewWin.label} · GREEN: ${Math.round(previewWin.greenWidth * 100)}% · RELEASE [SPACE]`,
            CANVAS_W * 0.5,
            socBot - 11
          );
        }

        // Rotating Checkered Pixel Soccer Ball
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.fillRect(Math.round(soccer.ballX - 6), Math.round(soccer.ballY + 4), 12, 4);
        ctx.save();
        ctx.translate(Math.round(soccer.ballX), Math.round(soccer.ballY));
        ctx.rotate(soccer.ballSpin);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.fillStyle = '#09090b';
        ctx.fillRect(-2, -2, 4, 4);
        ctx.fillRect(-6, -6, 3, 3);
        ctx.fillRect(3, -6, 3, 3);
        ctx.fillRect(-6, 3, 3, 3);
        ctx.fillRect(3, 3, 3, 3);
        ctx.strokeStyle = '#09090b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-6, -6, 12, 12);
        ctx.restore();

        if (soccer.bannerTimer > 0) {
          ctx.fillStyle = 'rgba(9,9,11,0.85)';
          ctx.fillRect(CANVAS_W * 0.5 - 140, 54, 280, 34);
          ctx.strokeStyle = '#fde047';
          ctx.strokeRect(CANVAS_W * 0.5 - 140, 54, 280, 34);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 15px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(soccer.bannerText, CANVAS_W * 0.5, 76);
        }
      }

      // =====================================================================
      // 6. PRO HARDCORE BOWLING REMAKE (Oil Pattern + Hook + Power + True Scoring)
      // =====================================================================
      else if (sport === 'bowling') {
        if (bowling.bannerTimer > 0) bowling.bannerTimer = Math.max(0, bowling.bannerTimer - dt);

        if (!bowling.finished) {
          if (bowling.phase === 'align') {
            if (moveX !== 0) {
              bowling.ballX = clamp(bowling.ballX + moveX * 215 * dt, 282, 518);
            }
            if (moveY !== 0) {
              // Up/Down adjusts launch angle cleanly (-13deg .. +13deg)
              bowling.launchAngle = clamp(bowling.launchAngle + moveY * 0.45 * dt, -0.23, 0.23);
            }
          } else if (bowling.phase === 'hook') {
            // Fast oscillating spin pendulum!
            bowling.hookOsc += bowling.hookDir * 4.6 * dt;
            if (bowling.hookOsc >= 1) {
              bowling.hookOsc = 1;
              bowling.hookDir = -1;
            } else if (bowling.hookOsc <= -1) {
              bowling.hookOsc = -1;
              bowling.hookDir = 1;
            }
          } else if (bowling.phase === 'power') {
            // Fast oscillating power & pocket release bar!
            bowling.powerOsc += bowling.powerDir * 3.45 * dt;
            if (bowling.powerOsc >= 1) {
              bowling.powerOsc = 1;
              bowling.powerDir = -1;
            } else if (bowling.powerOsc <= 0) {
              bowling.powerOsc = 0;
              bowling.powerDir = 1;
            }
          } else if (bowling.phase === 'rolling') {
            const subSteps = 3;
            const subDt = dt / subSteps;
            for (let s = 0; s < subSteps; s++) {
              const lBound = laneLeftAtY(bowling.ballY);
              const rBound = laneRightAtY(bowling.ballY);

              if (!bowling.inGutter) {
                // Oil pattern: slick front (gentle drift), dry backend (hard snap break!)
                const inDryZone = bowling.ballY < bowling.oilBreakY;
                const gripStrength = inDryZone ? 275 : 48;
                const houseDrift = inDryZone ? bowling.laneOilOffset * 2.1 : 0;
                const speedFactor = 0.8 + (1 - bowling.ballPower) * 0.45;
                bowling.ballVx += (bowling.hookSpin * gripStrength * speedFactor + houseDrift) * subDt;
              } else {
                // Track down the gutter rail center
                const targetRailX = bowling.ballX < CANVAS_W * 0.5 ? lBound - 7 : rBound + 7;
                bowling.ballX += (targetRailX - bowling.ballX) * 14 * subDt;
                bowling.ballVx = 0;
              }

              bowling.ballX += bowling.ballVx * subDt;
              bowling.ballY += bowling.ballVy * subDt;
              bowling.ballRot += (bowling.hookSpin * 14 + Math.abs(bowling.ballVy) * 0.03) * subDt;

              if (!bowling.inGutter && (bowling.ballX < lBound + 7 || bowling.ballX > rBound - 7) && bowling.ballY < 432) {
                bowling.inGutter = true;
                bowling.bannerText = 'GUTTER BALL!!';
                bowling.bannerTimer = 1.1;
                bowling.statusText = 'Dropped into the gutter! 0 pins!';
                spawnParticles(bowling.ballX, bowling.ballY, '#f87171', 10, 85);
                playRetroSportTone(150, 85, 0.22, 'sawtooth', 0.08);
              }

              // Ball vs Standing Pins Collision (tighter radius + real deflection)
              if (!bowling.inGutter) {
                for (const pin of bowling.pins) {
                  if (pin.down) continue;
                  const dx = pin.x - bowling.ballX;
                  const dy = pin.y - bowling.ballY;
                  const d = Math.hypot(dx, dy);
                  if (d < 15.5) {
                    pin.down = true;
                    const nx = dx / (d || 1);
                    const ny = dy / (d || 1);
                    const impactSpd = Math.hypot(bowling.ballVx, bowling.ballVy);
                    const energy = clamp(impactSpd / 440, 0.55, 1.3);
                    pin.vx = nx * 215 * energy + bowling.ballVx * 0.35;
                    pin.vy = ny * 185 * energy - 95 * energy;
                    pin.rotVel = (nx >= 0 ? 1 : -1) * (8 + Math.random() * 8);
                    // Realistic ball deflection off pins (weaker balls deflect more!)
                    const deflectAmt = bowling.ballPower < 0.65 ? 0.36 : 0.16;
                    bowling.ballVx -= nx * 165 * deflectAmt;
                    bowling.ballVy *= 0.96;
                    spawnParticles(pin.x, pin.y, '#fde047', 6, 95);
                    playRetroSportTone(920, 480, 0.08, 'square', 0.06);
                  }
                }
              }

              // Pin-to-Pin Chain Action Physics
              for (const p1 of bowling.pins) {
                if (!p1.down) continue;
                p1.x += p1.vx * subDt;
                p1.y += p1.vy * subDt;
                p1.vx *= 0.982;
                p1.vy *= 0.982;
                p1.rot += p1.rotVel * subDt;
                const p1Spd = Math.hypot(p1.vx, p1.vy);
                if (p1Spd > 48) {
                  for (const p2 of bowling.pins) {
                    if (p2.down) continue;
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const distP = Math.hypot(dx, dy);
                    if (distP < 17) {
                      p2.down = true;
                      const nx = dx / (distP || 1);
                      const ny = dy / (distP || 1);
                      p2.vx = nx * p1Spd * 0.78 + p1.vx * 0.25;
                      p2.vy = ny * p1Spd * 0.78 - 65;
                      p2.rotVel = (nx >= 0 ? 1 : -1) * (7 + Math.random() * 7);
                      p1.vx *= 0.62;
                      p1.vy *= 0.62;
                      spawnParticles(p2.x, p2.y, '#38bdf8', 5, 75);
                      playRetroSportTone(1040, 620, 0.05, 'square', 0.05);
                    }
                  }
                }
              }
            }

            bowling.ballTrail.push({ x: bowling.ballX, y: bowling.ballY });
            if (bowling.ballTrail.length > 14) bowling.ballTrail.shift();

            if (bowling.ballY < 76) {
              bowling.phase = 'settle';
              bowling.settleTimer = 0.95;
              bowling.sweeperProgress = 0;
            }
          } else if (bowling.phase === 'settle') {
            bowling.settleTimer -= dt;
            bowling.sweeperProgress = clamp(1 - bowling.settleTimer / 0.95, 0, 1);
            for (const p1 of bowling.pins) {
              if (!p1.down) continue;
              p1.x += p1.vx * dt;
              p1.y += p1.vy * dt;
              p1.vx *= 0.92;
              p1.vy *= 0.92;
              p1.rot += p1.rotVel * dt;
              const p1Spd = Math.hypot(p1.vx, p1.vy);
              if (p1Spd > 55) {
                for (const p2 of bowling.pins) {
                  if (p2.down) continue;
                  const dx = p2.x - p1.x;
                  const dy = p2.y - p1.y;
                  const distP = Math.hypot(dx, dy);
                  if (distP < 16.5) {
                    p2.down = true;
                    p2.vx = (dx / (distP || 1)) * p1Spd * 0.72;
                    p2.vy = (dy / (distP || 1)) * p1Spd * 0.72 - 50;
                    p2.rotVel = 9;
                  }
                }
              }
            }

            if (bowling.settleTimer <= 0) {
              const newlyDown = bowling.pins.filter((p) => p.down).length;
              const fIdx = bowling.frame - 1;
              const curFr = bowling.frames[fIdx];
              const isLastFrame = bowling.frame === bowling.maxFrames;

              if (bowling.rollInFrame === 1) {
                curFr.r1 = newlyDown;
                if (newlyDown === 10) {
                  bowling.strikeStreak += 1;
                  bowling.bannerText =
                    bowling.strikeStreak >= 3
                      ? 'TURKEY!! 3X STRIKE!!'
                      : bowling.strikeStreak === 2
                      ? 'DOUBLE!! 2X STRIKE!!'
                      : 'STRIKE!! [X]';
                  bowling.bannerTimer = 1.35;
                  bowling.statusText = isLastFrame
                    ? 'CLUTCH 6TH FRAME STRIKE! Bonus Roll #2!'
                    : `${bowling.bannerText} +Next 2 Rolls Bonus!`;
                  spawnParticles(CANVAS_W * 0.5, 145, '#fde047', 26, 165);
                  playRetroSportTone(700, 1280, 0.25, 'square', 0.09);

                  if (isLastFrame) {
                    bowling.rollInFrame = 2;
                    bowling.pins = buildBowlingPins();
                    bowling.standingBeforeRoll = 10;
                  } else {
                    bowling.frame += 1;
                    bowling.pins = buildBowlingPins();
                    bowling.standingBeforeRoll = 10;
                    bowling.laneOilOffset = (Math.random() - 0.5) * 28;
                  }
                } else {
                  bowling.strikeStreak = 0;
                  // Clear knocked-down pins so only standing pins remain for Spare pickup!
                  bowling.pins = bowling.pins.filter((p) => !p.down);
                  const split = isSplitLeave(bowling.pins);
                  curFr.isSplit = split;
                  bowling.rollInFrame = 2;
                  bowling.standingBeforeRoll = bowling.pins.length;
                  if (split) {
                    bowling.bannerText = 'NASTY SPLIT!!';
                    bowling.bannerTimer = 1.25;
                    bowling.statusText = `SPLIT LEAVE (${newlyDown} down)! Thread the needle for the Spare!`;
                  } else {
                    bowling.statusText = `${newlyDown} down · ${bowling.standingBeforeRoll} left! Pick up the Spare!`;
                  }
                }
              } else if (bowling.rollInFrame === 2) {
                curFr.r2 = newlyDown;
                const totalCleared = (curFr.r1 ?? 0) + newlyDown;
                if (isLastFrame && curFr.r1 === 10) {
                  if (newlyDown === 10) {
                    bowling.bannerText = 'DOUBLE IN THE 6TH!!';
                    bowling.bannerTimer = 1.2;
                    bowling.pins = buildBowlingPins();
                    playRetroSportTone(740, 1240, 0.2, 'square', 0.09);
                  } else {
                    bowling.pins = bowling.pins.filter((p) => !p.down);
                    bowling.statusText = `${newlyDown} down! Final Fill Ball #3!`;
                  }
                  bowling.rollInFrame = 3;
                } else if (totalCleared >= 10) {
                  bowling.bannerText = 'SPARE!! [/]';
                  bowling.bannerTimer = 1.25;
                  bowling.statusText = isLastFrame
                    ? 'CLUTCH SPARE! Bonus Fill Ball Earned!'
                    : 'CLEAN SPARE PICKUP! +Next Roll Bonus!';
                  spawnParticles(CANVAS_W * 0.5, 145, '#38bdf8', 20, 145);
                  playRetroSportTone(640, 980, 0.2, 'square', 0.08);
                  if (isLastFrame) {
                    bowling.rollInFrame = 3;
                    bowling.pins = buildBowlingPins();
                  } else {
                    bowling.rollInFrame = 1;
                    bowling.frame += 1;
                    bowling.pins = buildBowlingPins();
                    bowling.laneOilOffset = (Math.random() - 0.5) * 28;
                  }
                } else {
                  bowling.bannerText = newlyDown === 0 ? 'OPEN FRAME!' : `${totalCleared}/10 OPEN`;
                  bowling.bannerTimer = 1.05;
                  bowling.statusText = `Open frame (${totalCleared}). Tighten your pocket line!`;
                  bowling.rollInFrame = 1;
                  bowling.frame += 1;
                  bowling.pins = buildBowlingPins();
                  bowling.laneOilOffset = (Math.random() - 0.5) * 28;
                }
              } else {
                // Frame 6 Bonus Roll #3
                curFr.r3 = newlyDown;
                if (newlyDown === 10) {
                  bowling.bannerText = 'STRIKE OUT!!';
                  bowling.bannerTimer = 1.3;
                  spawnParticles(CANVAS_W * 0.5, 145, '#fde047', 24, 155);
                  playRetroSportTone(780, 1340, 0.24, 'square', 0.09);
                }
                bowling.frame += 1;
              }

              const scored = computeBowlingScore(bowling.frames);
              bowling.score = scored.totalScore;
              scored.frameTotals.forEach((ft, idx) => {
                bowling.frames[idx].total = ft;
              });

              if (bowling.frame > bowling.maxFrames) {
                bowling.finished = true;
                syncHud(true);
              } else {
                bowling.phase = 'align';
                bowling.ballX = CANVAS_W * 0.5 + 14;
                bowling.ballY = 458;
                bowling.ballVx = 0;
                bowling.ballVy = 0;
                bowling.launchAngle = 0;
                bowling.inGutter = false;
                bowling.ballTrail = [];
              }
            }
          }
        }

        // PRO RETRO BOWLING ALLEY + OIL PATTERN + OVERHEAD SCORECARD!
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Dark Arcade Carpet & Neon Wall Panels
        for (let cx = 16; cx < 235; cx += 36) {
          for (let cy = 74; cy < CANVAS_H - 16; cy += 36) {
            ctx.fillStyle = (cx + cy) % 72 === 0 ? '#17153b' : '#0f172a';
            ctx.fillRect(cx, cy, 33, 33);
            ctx.fillRect(CANVAS_W - cx - 33, cy, 33, 33);
          }
        }
        // Adjacent Decorative Background Lanes (Dimmed)
        ctx.fillStyle = 'rgba(120, 53, 15, 0.22)';
        ctx.beginPath();
        ctx.moveTo(190, 78);
        ctx.lineTo(298, 78);
        ctx.lineTo(234, CANVAS_H - 18);
        ctx.lineTo(74, CANVAS_H - 18);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(502, 78);
        ctx.lineTo(610, 78);
        ctx.lineTo(726, CANVAS_H - 18);
        ctx.lineTo(566, CANVAS_H - 18);
        ctx.closePath();
        ctx.fill();

        // Main Lane Gutter Trough Bed
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.moveTo(306, 78);
        ctx.lineTo(494, 78);
        ctx.lineTo(560, CANVAS_H - 18);
        ctx.lineTo(240, CANVAS_H - 18);
        ctx.closePath();
        ctx.fill();

        // Maple Hardwood Perspective Lane Deck
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(326, 78);
        ctx.lineTo(474, 78);
        ctx.lineTo(534, CANVAS_H - 18);
        ctx.lineTo(266, CANVAS_H - 18);
        ctx.closePath();
        ctx.fill();

        // Heavy Oil Zone Sheen (Front 60% of Lane: y = 252 .. 434) vs Dry Hook Backend
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.beginPath();
        ctx.moveTo(laneLeftAtY(bowling.oilBreakY) + 2, bowling.oilBreakY);
        ctx.lineTo(laneRightAtY(bowling.oilBreakY) - 2, bowling.oilBreakY);
        ctx.lineTo(laneRightAtY(434) - 2, 434);
        ctx.lineTo(laneLeftAtY(434) + 2, 434);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('— OIL BREAK LINE (BALL HOOKS PAST HERE) —', CANVAS_W * 0.5, bowling.oilBreakY + 12);

        // Perspective Wood Boards
        ctx.strokeStyle = 'rgba(146, 64, 14, 0.65)';
        ctx.lineWidth = 1.2;
        for (let b = -5; b <= 5; b++) {
          ctx.beginPath();
          ctx.moveTo(CANVAS_W * 0.5 + b * 13.5, 78);
          ctx.lineTo(CANVAS_W * 0.5 + b * 24, CANVAS_H - 18);
          ctx.stroke();
        }

        // Glowing Neon Gutter Rails
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(326, 78);
        ctx.lineTo(266, CANVAS_H - 18);
        ctx.moveTo(474, 78);
        ctx.lineTo(534, CANVAS_H - 18);
        ctx.stroke();

        // Dark Pin Deck Pit Backdrop
        ctx.fillStyle = '#09090b';
        ctx.fillRect(322, 62, 156, 32);
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2;
        ctx.strokeRect(322, 62, 156, 32);
        ctx.fillStyle = '#f472b6';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          `LANE 07 · DRIFT ${bowling.laneOilOffset >= 0 ? 'R' : 'L'}${Math.abs(Math.round(bowling.laneOilOffset))}`,
          CANVAS_W * 0.5,
          82
        );

        // Overhead 6-Frame Authentic LED Bowling Scorecard!
        const sbW = 636;
        const sbX = (CANVAS_W - sbW) * 0.5;
        const sbY = 10;
        const cellW = sbW / bowling.maxFrames;
        ctx.fillStyle = 'rgba(9, 9, 11, 0.94)';
        ctx.fillRect(sbX, sbY, sbW, 46);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(sbX, sbY, sbW, 46);
        for (let fi = 0; fi < bowling.maxFrames; fi++) {
          const cx = sbX + fi * cellW;
          const fr = bowling.frames[fi];
          const isCur = fi === bowling.frame - 1 && !bowling.finished;
          if (isCur) {
            ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
            ctx.fillRect(cx, sbY, cellW, 46);
          }
          ctx.strokeStyle = isCur ? '#fde047' : 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx, sbY, cellW, 46);
          ctx.fillStyle = isCur ? '#fde047' : '#94a3b8';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`F${fi + 1}`, cx + 4, sbY + 12);

          // Roll 1 / 2 / (3) boxes
          const fmtR1 = fr.r1 === null ? '' : fr.r1 === 10 ? 'X' : fr.r1 === 0 ? '-' : String(fr.r1);
          const fmtR2 =
            fr.r2 === null
              ? ''
              : fi === bowling.maxFrames - 1 && fr.r1 === 10
              ? fr.r2 === 10
                ? 'X'
                : fr.r2 === 0
                ? '-'
                : String(fr.r2)
              : (fr.r1 ?? 0) + fr.r2 === 10
              ? '/'
              : fr.r2 === 0
              ? '-'
              : String(fr.r2);
          const fmtR3 =
            fr.r3 === undefined || fr.r3 === null
              ? ''
              : fr.r3 === 10
              ? 'X'
              : fr.r3 === 0
              ? '-'
              : String(fr.r3);

          ctx.fillStyle = fr.r1 === 10 ? '#fde047' : fr.isSplit ? '#fb7185' : '#e2e8f0';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(fmtR1, cx + cellW * 0.45, sbY + 15);
          ctx.fillStyle = fmtR2 === '/' || fmtR2 === 'X' ? '#38bdf8' : '#e2e8f0';
          ctx.fillText(fmtR2, cx + cellW * 0.72, sbY + 15);
          if (fi === bowling.maxFrames - 1) {
            ctx.fillStyle = fmtR3 === 'X' ? '#fde047' : '#e2e8f0';
            ctx.fillText(fmtR3, cx + cellW * 0.9, sbY + 15);
          }

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 13px monospace';
          ctx.fillText(fr.total !== null ? String(fr.total) : '', cx + cellW * 0.5, sbY + 38);
        }

        // Lane Targeting Arrows & Foul Line
        for (let ai = -3; ai <= 3; ai++) {
          const ax = CANVAS_W * 0.5 + ai * 24;
          const ay = 338 - Math.abs(ai) * 10;
          ctx.fillStyle = ai === 0 ? '#fde047' : ai === -1 || ai === 1 ? '#fb923c' : '#9a3412';
          ctx.fillRect(ax - 2, ay - 6, 4, 4);
          ctx.fillRect(ax - 5, ay - 2, 4, 4);
          ctx.fillRect(ax + 1, ay - 2, 4, 4);
        }
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(274, 434, 252, 4);

        // Tapered Red-Striped Pro Bowling Pins
        for (const pin of bowling.pins) {
          ctx.save();
          ctx.translate(Math.round(pin.x), Math.round(pin.y));
          ctx.rotate(pin.rot);
          ctx.globalAlpha = pin.down ? 0.52 : 1;
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.beginPath();
          ctx.ellipse(0, 5, 5.5, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          // Tapered bottle silhouette
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.roundRect(-5, -3, 10, 9, 3);
          ctx.fill();
          ctx.fillRect(-3, -12, 6, 10);
          ctx.beginPath();
          ctx.arc(0, -12, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(-3, -9, 6, 2);
          ctx.fillRect(-3, -5, 6, 1.5);
          ctx.strokeStyle = '#09090b';
          ctx.lineWidth = 1;
          ctx.strokeRect(-5, -3, 10, 9);
          ctx.restore();
        }

        // Pin Sweeper Bar Animation during Settle
        if (bowling.phase === 'settle' && bowling.sweeperProgress > 0.35) {
          const swP = (bowling.sweeperProgress - 0.35) / 0.65;
          const swY = 186 - Math.sin(swP * Math.PI) * 95;
          ctx.fillStyle = 'rgba(24, 24, 27, 0.9)';
          ctx.fillRect(322, swY, 156, 7);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(322, swY, 156, 7);
        }

        // Short Pro Targeting Preview (Only up to Arrows — You must judge the dry backend break!)
        if (bowling.phase === 'align' || bowling.phase === 'hook' || bowling.phase === 'power') {
          const previewLen = 135;
          const endX = bowling.ballX + Math.sin(bowling.launchAngle) * previewLen;
          const endY = bowling.ballY - Math.cos(bowling.launchAngle) * previewLen;
          const hookBend = (bowling.phase === 'align' ? 0 : bowling.phase === 'hook' ? bowling.hookOsc : bowling.hookSpin) * 32;
          ctx.strokeStyle = bowling.phase === 'align' ? '#fde047' : '#38bdf8';
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(bowling.ballX, bowling.ballY);
          ctx.quadraticCurveTo(
            (bowling.ballX + endX) * 0.5,
            bowling.ballY - 72,
            endX + hookBend,
            endY
          );
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Ball Motion Trail
        for (let ti = 0; ti < bowling.ballTrail.length; ti++) {
          const tr = bowling.ballTrail[ti];
          ctx.fillStyle = `rgba(168, 85, 247, ${((ti + 1) / bowling.ballTrail.length) * 0.25})`;
          ctx.beginPath();
          ctx.arc(tr.x, tr.y, 7.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Spinning Pro Urethane Bowling Ball (Perspective Scaled slightly by Y)
        const ballScale = clamp(0.74 + ((bowling.ballY - 78) / 380) * 0.34, 0.72, 1.08);
        const ballR = 11 * ballScale;
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        ctx.beginPath();
        ctx.ellipse(bowling.ballX, bowling.ballY + ballR * 0.65, ballR, ballR * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(bowling.ballX, bowling.ballY);
        ctx.rotate(bowling.ballRot);
        ctx.fillStyle = '#7e22ce';
        ctx.beginPath();
        ctx.arc(0, 0, ballR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(-ballR * 0.32, -ballR * 0.32, ballR * 0.28, 0, Math.PI * 2);
        ctx.fill();
        // Finger holes
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.arc(ballR * 0.25, -ballR * 0.25, ballR * 0.16, 0, Math.PI * 2);
        ctx.arc(ballR * 0.45, 0.08 * ballR, ballR * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, ballR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Pro Hook Spin Meter (Left HUD) & Power Pocket Meter (Right HUD)
        const drawBowlGauge = (gx: number, title: string, active: boolean) => {
          ctx.fillStyle = 'rgba(9,9,11,0.9)';
          ctx.fillRect(gx, 130, 82, 230);
          ctx.strokeStyle = active ? '#fde047' : 'rgba(255,255,255,0.22)';
          ctx.lineWidth = active ? 2.5 : 1.5;
          ctx.strokeRect(gx, 130, 82, 230);
          ctx.fillStyle = active ? '#fde047' : '#94a3b8';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(title, gx + 41, 148);
        };

        // Left: Hook Spin Pendulum
        drawBowlGauge(48, 'HOOK SPIN', bowling.phase === 'hook');
        const hookDisplayVal =
          bowling.phase === 'align' ? 0 : bowling.phase === 'hook' ? bowling.hookOsc : bowling.hookSpin;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(58, 220, 62, 16);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(88, 214, 2, 28);
        const hNeedleX = 89 + hookDisplayVal * 28;
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(hNeedleX - 3, 212, 6, 32);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('L-HOOK    R-SLICE', 89, 260);
        ctx.fillStyle = '#fde047';
        ctx.fillText(`${Math.round(hookDisplayVal * 100)}%`, 89, 286);

        // Right: Power & Pocket Sweet Spot Meter
        drawBowlGauge(CANVAS_W - 130, 'POWER', bowling.phase === 'power');
        const pBarX = CANVAS_W - 102;
        const pBarY = 166;
        const pBarH = 165;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(pBarX, pBarY, 26, pBarH);
        // Red Overpower Zone (top 16%)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.72)';
        ctx.fillRect(pBarX, pBarY, 26, pBarH * 0.16);
        // Green Pocket Sweet Spot (0.68..0.84 -> top 16%..32%)
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(pBarX, pBarY + pBarH * 0.16, 26, pBarH * 0.16);
        const pVal =
          bowling.phase === 'align' || bowling.phase === 'hook'
            ? 0
            : bowling.phase === 'power'
            ? bowling.powerOsc
            : bowling.ballPower;
        const pFillH = pVal * pBarH;
        ctx.fillStyle = pVal > 0.85 ? '#ef4444' : pVal >= 0.68 ? '#fde047' : '#38bdf8';
        ctx.fillRect(pBarX + 3, pBarY + pBarH - pFillH, 20, pFillH);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('POCKET', pBarX + 13, pBarY + pBarH * 0.25);

        // Pixel Bowler at Foul Line
        if (bowling.phase === 'align' || bowling.phase === 'hook' || bowling.phase === 'power') {
          drawRetroPixelAthlete(ctx, {
            x: bowling.ballX,
            y: 476,
            faceX: 0,
            faceY: -1,
            jerseyColor: '#ec4899',
            trimColor: '#38bdf8',
            shortsColor: '#1e293b',
            skinColor: '#f2c29b',
            hairColor: '#451a03',
            numberStr: '7',
            isUser: true,
            walkTime: now * 0.002,
            scale: 1.05,
          });
        }

        if (bowling.bannerTimer > 0) {
          ctx.fillStyle = 'rgba(9,9,11,0.88)';
          ctx.fillRect(CANVAS_W * 0.5 - 145, 92, 290, 34);
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2;
          ctx.strokeRect(CANVAS_W * 0.5 - 145, 92, 290, 34);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(bowling.bannerText, CANVAS_W * 0.5, 114);
        }
      }

      // =====================================================================
      // 7. RETRO LAKEFRONT FISHING
      // =====================================================================
      else {
        if (!fishing.finished) {
          if (fishing.phase === 'ready') {
            if (moveX !== 0 || moveY !== 0) {
              pointerPosRef.current.active = false;
              fishing.bobberX = clamp(fishing.bobberX + moveX * 220 * dt, 130, CANVAS_W - 130);
              fishing.bobberY = clamp(fishing.bobberY + moveY * 180 * dt, 110, 320);
            }
          } else if (fishing.phase === 'waiting') {
            fishing.waitTimer -= dt;
            if (fishing.waitTimer <= 0) {
              fishing.phase = 'bite';
              fishing.biteWindow = 1.85;
              fishing.statusText = '!! BITE !! PRESS [SPACE] OR CLICK NOW TO HOOK!';
              playRetroSportTone(880, 1220, 0.14, 'square', 0.09);
            }
          } else if (fishing.phase === 'bite') {
            fishing.biteWindow -= dt;
            if (fishing.biteWindow <= 0) {
              fishing.castsDone += 1;
              fishing.phase = 'result';
              fishing.resultTimer = 1.0;
              fishing.statusText = 'Too slow — it got away!';
              playRetroSportTone(190, 95, 0.2, 'sawtooth', 0.07);
            }
          } else if (fishing.phase === 'reel') {
            const sp = FISH_SPECIES[fishing.fishIdx];
            fishing.fishPos += fishing.fishVel * dt;
            if (fishing.fishPos < 0.08 || fishing.fishPos > 0.92 || Math.random() < 0.025) {
              fishing.fishVel = (Math.random() - 0.5) * (sp.speed / 120);
              fishing.fishPos = clamp(fishing.fishPos, 0.08, 0.92);
            }
            if (actionHeld) {
              fishing.barVel -= 2.4 * dt;
            } else {
              fishing.barVel += 2.1 * dt;
            }
            fishing.barVel = clamp(fishing.barVel, -1.1, 1.1);
            fishing.barPos = clamp(fishing.barPos + fishing.barVel * dt, 0, 1 - fishing.barHeight);

            const inside =
              fishing.fishPos >= fishing.barPos - 0.03 &&
              fishing.fishPos <= fishing.barPos + fishing.barHeight + 0.03;
            fishing.catchProgress = clamp(
              fishing.catchProgress + (inside ? 0.42 : -0.26) * dt,
              0,
              1
            );

            if (fishing.catchProgress >= 1) {
              fishing.castsDone += 1;
              fishing.totalCash += sp.cash;
              fishing.catches.push(`${sp.icon} ${sp.name}`);
              fishing.phase = 'result';
              fishing.resultTimer = 1.2;
              fishing.statusText = `LANDED ${sp.icon} ${sp.name} (+$${sp.cash})!`;
              spawnParticles(fishing.bobberX, fishing.bobberY, sp.color, 20, 145);
              playRetroSportTone(620, 1120, 0.25, 'square', 0.09);
            } else if (fishing.catchProgress <= 0) {
              fishing.castsDone += 1;
              fishing.phase = 'result';
              fishing.resultTimer = 1.1;
              fishing.statusText = 'Line snapped! Fish escaped!';
              playRetroSportTone(220, 100, 0.22, 'sawtooth', 0.08);
            }
          } else if (fishing.phase === 'result') {
            fishing.resultTimer -= dt;
            if (fishing.resultTimer <= 0) {
              if (fishing.castsDone >= fishing.maxCasts) {
                fishing.finished = true;
                syncHud(true);
              } else {
                fishing.phase = 'ready';
                fishing.statusText = `Cast ${fishing.castsDone + 1}/${fishing.maxCasts} · Arrows Aim · Press [SPACE] to Cast!`;
              }
            }
          }
        }

        // Deep Chesapeake Bay Water + Wave Glints
        ctx.fillStyle = '#075985';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = '#0369a1';
        ctx.fillRect(0, 90, CANVAS_W, 298);
        ctx.fillStyle = 'rgba(186,230,253,0.16)';
        for (let wy = 44; wy < 376; wy += 36) {
          const shift = ((now * 0.03 + wy * 2.5) % (CANVAS_W - 60));
          ctx.fillRect(Math.round(shift), wy, 56, 3);
        }

        // Animated Underwater Pixel Fish Shadows Swimming Near Bobber
        for (let fi = 0; fi < 5; fi++) {
          const angle = now * (0.0012 + fi * 0.00025) + fi * 1.3;
          const approachingBite =
            fi === 0 && fishing.phase === 'waiting' && fishing.waitTimer < 0.55;
          const baseRadius =
            fishing.phase === 'bite' || fishing.phase === 'reel'
              ? 14 + fi * 16
              : approachingBite
              ? Math.max(8, fishing.waitTimer * 95)
              : 64 + fi * 32;
          const fx = Math.round(fishing.bobberX + Math.cos(angle) * baseRadius);
          const fy = Math.round(clamp(fishing.bobberY + Math.sin(angle * 0.8) * (baseRadius * 0.45), 55, 368));
          const dir = Math.sin(angle) >= 0 ? -1 : 1;
          ctx.fillStyle =
            fi === 0 && (fishing.phase === 'bite' || fishing.phase === 'reel' || approachingBite)
              ? 'rgba(250,204,21,0.55)'
              : 'rgba(12,74,110,0.65)';
          ctx.fillRect(fx - 8, fy - 3, 16, 6);
          ctx.fillRect(fx + dir * 8, fy - 5, 5 * dir, 10);
        }

        // Wooden Pier Pilings & Planks
        ctx.fillStyle = '#451a03';
        for (let px = 30; px < CANVAS_W; px += 120) {
          ctx.fillRect(px, 376, 18, 28);
        }
        ctx.fillStyle = '#78350f';
        ctx.fillRect(0, 388, CANVAS_W, CANVAS_H - 388);
        for (let px = 0; px < CANVAS_W; px += 46) {
          ctx.fillStyle = '#92400e';
          ctx.fillRect(px, 390, 42, CANVAS_H - 390);
          ctx.fillStyle = '#451a03';
          ctx.fillRect(px + 6, 398, 4, 4);
          ctx.fillRect(px + 32, 398, 4, 4);
        }

        const anglerX = CANVAS_W * 0.5;
        const anglerY = 434;
        const rodFlex = fishing.phase === 'reel' || fishing.phase === 'bite' ? 18 : 5;
        const rodTipX = anglerX + 18;
        const rodTipY = anglerY - 38 + rodFlex;

        // Pixel Angler
        drawRetroPixelAthlete(ctx, {
          x: anglerX,
          y: anglerY,
          faceX: 0,
          faceY: -1,
          jerseyColor: '#f97316',
          trimColor: '#fde047',
          shortsColor: '#334155',
          skinColor: '#f2c29b',
          hairColor: '#78350f',
          capColor: '#15803d',
          isUser: true,
          walkTime: now * 0.002,
          scale: 1.1,
        });
        // Pixel Fishing Rod
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(anglerX + 6, anglerY - 8);
        ctx.quadraticCurveTo(anglerX + 12, anglerY - 26, rodTipX, rodTipY);
        ctx.stroke();

        if (fishing.phase === 'ready') {
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(fishing.bobberX, fishing.bobberY, 12, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#fde047';
          ctx.fillRect(Math.round(fishing.bobberX - 2), Math.round(fishing.bobberY - 2), 4, 4);
        } else {
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(rodTipX, rodTipY);
          ctx.lineTo(fishing.bobberX, fishing.bobberY);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          ctx.beginPath();
          ctx.arc(fishing.bobberX, fishing.bobberY, 10 + ((now * 0.03) % 16), 0, Math.PI * 2);
          ctx.stroke();

          // Red/White Pixel Bobber
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(Math.round(fishing.bobberX - 5), Math.round(fishing.bobberY - 5), 10, 5);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(fishing.bobberX - 5), Math.round(fishing.bobberY), 10, 5);
          ctx.strokeStyle = '#09090b';
          ctx.lineWidth = 1;
          ctx.strokeRect(Math.round(fishing.bobberX - 5), Math.round(fishing.bobberY - 5), 10, 10);
        }
        if (fishing.phase === 'bite') {
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 24px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!! BITE !!', fishing.bobberX, fishing.bobberY - 22);
        }
        if (fishing.phase === 'reel') {
          const sp = FISH_SPECIES[fishing.fishIdx];
          const tx = CANVAS_W - 110;
          const ty = 80;
          const th = 280;
          ctx.fillStyle = 'rgba(9,9,11,0.9)';
          ctx.fillRect(tx - 16, ty, 32, th);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(tx - 16, ty, 32, th);
          ctx.fillStyle = 'rgba(34,197,94,0.8)';
          ctx.fillRect(tx - 13, ty + fishing.barPos * th, 26, fishing.barHeight * th);
          // Pixel Fish Icon inside Tension Meter
          const fy = Math.round(ty + fishing.fishPos * th);
          ctx.fillStyle = sp.color;
          ctx.fillRect(tx - 8, fy - 4, 14, 8);
          ctx.fillRect(tx - 12, fy - 6, 4, 12);
          ctx.fillStyle = '#09090b';
          ctx.fillRect(tx + 2, fy - 2, 2, 2);

          ctx.fillStyle = '#09090b';
          ctx.fillRect(tx + 24, ty, 12, th);
          ctx.fillStyle = '#fde047';
          const ph = fishing.catchProgress * th;
          ctx.fillRect(tx + 25, ty + th - ph, 10, ph);
        }
      }

      drawParticles(dt);
      syncHud(false);
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    venue.venueId,
    venue.sport,
    gameKey,
    bballMode,
    bballPosition,
    bballCourtMode,
    bballTeamSize,
    tournamentRoundIdx,
    baseballMode,
    baseballRoundIdx,
    footballMode,
    fbPosition,
    footballRoundIdx,
    soccerMode,
    soccerTeamSize,
    soccerRoundIdx,
  ]);

  const activeTourney = TOURNAMENT_ROUNDS[Math.min(TOURNAMENT_ROUNDS.length - 1, tournamentRoundIdx)];
  const activeBaseballTourney = BASEBALL_TOURNAMENT_ROUNDS[Math.min(BASEBALL_TOURNAMENT_ROUNDS.length - 1, baseballRoundIdx)];
  const activeFootballTourney = FOOTBALL_TOURNAMENT_ROUNDS[Math.min(FOOTBALL_TOURNAMENT_ROUNDS.length - 1, footballRoundIdx)];
  const activeSoccerTourney = SOCCER_TOURNAMENT_ROUNDS[Math.min(SOCCER_TOURNAMENT_ROUNDS.length - 1, soccerRoundIdx)];

  const isAnyTourneyActive =
    (venue.sport === 'basketball' && bballMode === 'tournament') ||
    (venue.sport === 'baseball' && baseballMode === 'tournament') ||
    (venue.sport === 'football' && footballMode === 'tournament') ||
    (venue.sport === 'soccer' && soccerMode === 'tournament');

  const currentTourneySport: 'basketball' | 'baseball' | 'football' | 'soccer' | null =
    venue.sport === 'basketball' && bballMode === 'tournament'
      ? 'basketball'
      : venue.sport === 'baseball' && baseballMode === 'tournament'
      ? 'baseball'
      : venue.sport === 'football' && footballMode === 'tournament'
      ? 'football'
      : venue.sport === 'soccer' && soccerMode === 'tournament'
      ? 'soccer'
      : null;

  const currentSeasonSport: SeasonSportKey | null =
    venue.sport === 'basketball' && bballMode === 'season'
      ? 'basketball'
      : venue.sport === 'football' && footballMode === 'season'
      ? 'football'
      : null;

  const activeSeasonState: SportsSeasonState | null =
    currentSeasonSport === 'basketball'
      ? bballSeason
      : currentSeasonSport === 'football'
      ? footballSeason
      : null;

  const activeSeasonMatchup = activeSeasonState ? getActivePlayerSeasonMatchup(activeSeasonState) : null;

  const renderSeasonHubPanel = (sportKey: SeasonSportKey, seasonState: SportsSeasonState) => {
    const standings = getSortedStandings(seasonState.teams);
    const playerSeed = standings.findIndex((t) => t.id === 'player') + 1;
    const matchup = getActivePlayerSeasonMatchup(seasonState);
    const bracket = seasonState.playoffBracket;
    const champTeam = seasonState.championTeamId
      ? seasonState.teams.find((t) => t.id === seasonState.championTeamId)
      : null;
    const playoffCut = seasonState.playoffTeamsCount || (sportKey === 'basketball' ? 16 : 4);

    const handleQuickSim = () => {
      const next = simulatePlayerMatchInSeason(sportKey);
      if (sportKey === 'basketball') setBballSeason(next);
      else setFootballSeason(next);
    };

    const handleNewSeason = () => {
      const next = startNextSportsSeason(sportKey);
      if (sportKey === 'basketball') {
        setBballSeason(next);
        setBballPosition(next.playerPosition || 'PG');
      } else {
        setFootballSeason(next);
        setFbPosition(next.fbPlayerPosition || 'QB');
      }
      setShowSeasonModal(false);
      setGameKey((k) => k + 1);
    };

    const activePos: BballPosition = seasonState.playerPosition || bballPosition;
    const activeFbPosHub: FbPosition = seasonState.fbPlayerPosition || fbPosition;
    const posLocked = Boolean(seasonState.positionLocked);
    const activePosProf = BBALL_POSITION_PROFILES[activePos];
    const activeFbProf = FB_POSITION_PROFILES[activeFbPosHub];

    const handleSelectSeasonPos = (pos: BballPosition, lockNow: boolean) => {
      if (posLocked) return;
      const updated = setBasketballSeasonPosition(pos, lockNow);
      setBballSeason(updated);
      setBballPosition(updated.playerPosition || pos);
    };

    const handleSelectFbSeasonPos = (pos: FbPosition, lockNow: boolean) => {
      if (posLocked) return;
      const updated = setFootballSeasonPosition(pos, lockNow);
      setFootballSeason(updated);
      setFbPosition(updated.fbPlayerPosition || pos);
    };

    if (sportKey === 'basketball') {
      const selectedTeam =
        seasonState.teams.find((t) => t.id === selectedRosterTeamId) || seasonState.teams[0];
      const allRosterPlayers = seasonState.teams.flatMap((t) =>
        (t.roster || []).map((pl) => ({ teamShort: t.short, teamName: t.name, teamId: t.id, pl }))
      );
      const leaderBy = (fn: (r: BballRosterPlayer) => number) =>
        [...allRosterPlayers].sort((a, b) => fn(b.pl) - fn(a.pl))[0];
      const ppgLeader = leaderBy((r) => (r.gamesPlayed > 0 ? r.pts / r.gamesPlayed : r.ovr * 0.05));
      const rpgLeader = leaderBy((r) => (r.gamesPlayed > 0 ? r.reb / r.gamesPlayed : r.rebound * 0.02));
      const apgLeader = leaderBy((r) => (r.gamesPlayed > 0 ? r.ast / r.gamesPlayed : r.steal * 0.02));
      const bpgLeader = leaderBy((r) => (r.gamesPlayed > 0 ? r.blk / r.gamesPlayed : r.block * 0.02));
      const threeLeader = leaderBy((r) => (r.tpa >= 2 ? r.tpm / r.tpa : r.shoot3 / 200));

      const roundTitles = ['Round of 16', 'Quarterfinals', 'Semifinals', 'Championship'];
      const r16PreviewPairs: [number, number][] = [
        [0, 15],
        [7, 8],
        [4, 11],
        [3, 12],
        [2, 13],
        [5, 10],
        [6, 9],
        [1, 14],
      ];

      return (
        <div className="bg-zinc-950/95 border border-emerald-400/50 rounded-xl p-3.5 text-left w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2.5 border-b border-white/10">
            <div>
              <div className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                🏀 METRO HOOPS LEAGUE ({seasonState.teams.length} TEAMS) · SEASON #{seasonState.seasonNumber}
              </div>
              <div className="text-[11px] text-zinc-400">
                Your Pos:{' '}
                <span className="text-sky-300 font-black">
                  {activePos} ({posLocked ? '🔒 Locked' : 'Unlocked'})
                </span>{' '}
                · Seed #{playerSeed}/{seasonState.teams.length} · Top {playoffCut} Make Playoffs · Titles:{' '}
                {seasonState.championshipsWon}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(seasonState.phase === 'regular' || seasonState.phase === 'playoffs') && (
                <button
                  type="button"
                  onClick={handleQuickSim}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[10px] font-black uppercase border border-amber-400/35 cursor-pointer"
                >
                  ⚡ Sim Next Game
                </button>
              )}
              {(seasonState.phase === 'champion' ||
                seasonState.phase === 'eliminated' ||
                seasonState.phase === 'missed_playoffs') && (
                <button
                  type="button"
                  onClick={handleNewSeason}
                  className="px-3 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black text-[10px] font-black uppercase cursor-pointer"
                >
                  ▶ Start Season #{seasonState.seasonNumber + 1} (Unlocks Position)
                </button>
              )}
            </div>
          </div>

          {/* POSITION PICKER / SEASON LOCK STRIP */}
          <div className="mb-2.5 rounded-lg border border-sky-400/35 bg-zinc-900/80 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <div className="text-[10px] font-black text-sky-300 uppercase tracking-wider">
                {posLocked
                  ? `🔒 Position Locked: ${activePos} (${activePosProf.title}) — Unlocks after Season #${seasonState.seasonNumber}`
                  : `Choose Position for Season #${seasonState.seasonNumber} (Switching resets MyPlayer back to 66 OVR)`}
              </div>
              {!posLocked && (
                <button
                  type="button"
                  onClick={() => handleSelectSeasonPos(activePos, true)}
                  className="px-2.5 py-1 rounded bg-sky-400 hover:bg-sky-300 text-black text-[10px] font-black uppercase cursor-pointer"
                >
                  🔒 Lock In {activePos} for Season
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {BBALL_POSITIONS.map((pos) => {
                const prof = BBALL_POSITION_PROFILES[pos];
                const isSel = activePos === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    disabled={posLocked}
                    onClick={() => handleSelectSeasonPos(pos, false)}
                    className={`px-2 py-1.5 rounded text-left border transition ${
                      isSel
                        ? 'bg-sky-500/25 border-sky-300 text-white'
                        : posLocked
                        ? 'bg-zinc-900/40 border-white/5 text-zinc-600 cursor-not-allowed'
                        : 'bg-zinc-950/70 border-white/10 text-zinc-300 hover:border-sky-400/50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-black">
                      <span>{pos}</span>
                      <span className="text-[9px] text-amber-300">
                        3PT {prof.shoot3} · BLK {prof.block}
                      </span>
                    </div>
                    <div className="text-[9px] text-zinc-400 truncate">{prof.archetype}</div>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
              <div className="text-emerald-300">
                <span className="font-black uppercase">Advantages: </span>
                {activePosProf.advantages.join(' · ')}
              </div>
              <div className="text-rose-300">
                <span className="font-black uppercase">Disadvantages: </span>
                {activePosProf.disadvantages.join(' · ')}
              </div>
            </div>
          </div>

          {/* SEASON HUB TABS */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
            {([
              { id: 'standings', label: '📊 30-Team Standings & 16-Team Playoffs' },
              { id: 'rosters', label: '👟 Teams, Rosters & Player Stats' },
              { id: 'myplayer', label: '🪪 My Player Card' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSeasonHubTab(tab.id)}
                className={`px-2.5 py-1 rounded text-[10px] font-black uppercase cursor-pointer ${
                  seasonHubTab === tab.id
                    ? 'bg-emerald-400 text-black'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {seasonHubTab === 'standings' && (
            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.15fr] gap-3">
              {/* LEFT: 30-TEAM SCROLLABLE STANDINGS */}
              <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-2.5">
                <div className="text-[10px] font-black text-zinc-300 uppercase tracking-wider mb-1.5">
                  30-Team Standings ({seasonState.phase === 'regular' ? `Week ${seasonState.currentWeek}/${seasonState.totalWeeks}` : 'Final Seedings'})
                </div>
                <div className="text-[10px] font-mono tabular-nums space-y-1 max-h-64 overflow-y-auto pr-1">
                  <div className="grid grid-cols-[26px_1fr_30px_42px_38px_38px] text-zinc-500 font-bold pb-1 border-b border-white/10 sticky top-0 bg-zinc-900/95">
                    <span>#</span>
                    <span>TEAM</span>
                    <span className="text-right">OVR</span>
                    <span className="text-right">W-L</span>
                    <span className="text-right">DIFF</span>
                    <span className="text-right">STRK</span>
                  </div>
                  {standings.map((team, idx) => {
                    const seed = idx + 1;
                    const diff = team.pf - team.pa;
                    const isPlayer = team.id === 'player';
                    const inPlayoffs = seed <= playoffCut;
                    const streakTxt = team.streak > 0 ? `W${team.streak}` : team.streak < 0 ? `L${Math.abs(team.streak)}` : '-';
                    return (
                      <React.Fragment key={team.id}>
                        <div
                          onClick={() => {
                            setSelectedRosterTeamId(team.id);
                            setSeasonHubTab('rosters');
                          }}
                          className={`grid grid-cols-[26px_1fr_30px_42px_38px_38px] items-center px-1.5 py-1 rounded cursor-pointer hover:bg-white/5 ${
                            isPlayer
                              ? 'bg-emerald-500/20 text-emerald-200 font-black border border-emerald-400/40'
                              : inPlayoffs
                              ? 'text-zinc-200'
                              : 'text-zinc-400'
                          }`}
                        >
                          <span className={inPlayoffs ? 'text-amber-300 font-black' : 'text-zinc-500'}>#{seed}</span>
                          <span className="truncate">{team.name}</span>
                          <span className="text-right text-sky-300">{team.rating}</span>
                          <span className="text-right">{team.wins}-{team.losses}</span>
                          <span className={`text-right ${diff >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                          <span className="text-right">{streakTxt}</span>
                        </div>
                        {seed === playoffCut && (
                          <div className="flex items-center gap-2 py-0.5 text-[9px] text-amber-300/90 font-bold uppercase tracking-wider">
                            <span className="flex-1 h-px bg-amber-400/45" />
                            <span>Top 16 Playoff Cutline</span>
                            <span className="flex-1 h-px bg-amber-400/45" />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: NEXT MATCHUP + 16-TEAM 4-ROUND BRACKET */}
              <div className="flex flex-col gap-2.5">
                <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-2.5">
                  <div className="text-[10px] font-black text-amber-300 uppercase tracking-wider mb-1">
                    {seasonState.phase === 'regular'
                      ? `Next Scheduled Matchup · ${matchup.roundLabel}`
                      : seasonState.phase === 'playoffs'
                      ? `Active Playoff Round · ${matchup.roundLabel}`
                      : seasonState.phase === 'champion'
                      ? '🏆 Season Championship Won!'
                      : seasonState.phase === 'eliminated'
                      ? 'Season Eliminated in Playoffs'
                      : 'Missed Top 16 Playoff Cut'}
                  </div>
                  {seasonState.phase === 'regular' || seasonState.phase === 'playoffs' ? (
                    <div className="text-xs text-zinc-200 space-y-0.5">
                      <div className="font-black text-white">
                        #{matchup.playerSeed} YOU vs #{matchup.opponentSeed} {matchup.opponentName}
                      </div>
                      <div className="text-[11px] text-emerald-300 font-bold">
                        Win Purse: +${matchup.prizeCash.toLocaleString()} · Opp OVR {matchup.opponentRating}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-300">
                      Champion: <span className="font-black text-amber-300">{champTeam?.name || 'TBD'}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-2.5 flex-1">
                  <div className="text-[10px] font-black text-zinc-300 uppercase tracking-wider mb-2">
                    16-Team Seeded Playoffs Bracket (4 Rounds)
                  </div>
                  {!bracket ? (
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                      {r16PreviewPairs.map(([aIdx, bIdx], pIdx) => {
                        const ta = standings[aIdx];
                        const tb = standings[bIdx];
                        const hasYou = ta?.id === 'player' || tb?.id === 'player';
                        return (
                          <div
                            key={pIdx}
                            className={`px-2 py-1 rounded border ${
                              hasYou ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200 font-bold' : 'border-white/10 bg-black/40 text-zinc-300'
                            }`}
                          >
                            #{aIdx + 1} {ta?.short} vs #{bIdx + 1} {tb?.short}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] font-mono tabular-nums max-h-52 overflow-y-auto pr-1">
                      {bracket.rounds.map((rndMatches, rIdx) => (
                        <div key={rIdx} className="space-y-1.5">
                          <div className="text-[9px] font-black text-amber-300 uppercase text-center">
                            {roundTitles[rIdx] || `Round ${rIdx + 1}`}
                          </div>
                          {rndMatches.length === 0 ? (
                            <div className="p-1.5 rounded border border-white/10 bg-black/35 text-zinc-500 text-center">
                              TBD
                            </div>
                          ) : (
                            rndMatches.map((m) => {
                              const topWon = m.played && m.winnerId === m.topTeamId;
                              const botWon = m.played && m.winnerId === m.botTeamId;
                              const hasPlayer = m.topTeamId === 'player' || m.botTeamId === 'player';
                              return (
                                <div
                                  key={m.id}
                                  className={`rounded border overflow-hidden ${
                                    hasPlayer ? 'border-emerald-400/60 bg-emerald-950/35' : 'border-white/15 bg-black/50'
                                  }`}
                                >
                                  <div
                                    className={`px-1.5 py-0.5 flex justify-between border-b border-white/10 ${
                                      topWon ? 'text-emerald-300 font-black bg-emerald-500/15' : 'text-zinc-300'
                                    }`}
                                  >
                                    <span className="truncate">{m.topTeamName}</span>
                                    <span>{m.played ? m.topScore : '-'}</span>
                                  </div>
                                  <div
                                    className={`px-1.5 py-0.5 flex justify-between ${
                                      botWon ? 'text-emerald-300 font-black bg-emerald-500/15' : 'text-zinc-300'
                                    }`}
                                  >
                                    <span className="truncate">{m.botTeamName}</span>
                                    <span>{m.played ? m.botScore : '-'}</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {seasonHubTab === 'rosters' && (
            <div className="space-y-2.5">
              {/* LEAGUE STAT LEADERS */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px]">
                {[
                  {
                    label: 'PPG Leader',
                    entry: ppgLeader,
                    val: ppgLeader ? `${(ppgLeader.pl.gamesPlayed > 0 ? ppgLeader.pl.pts / ppgLeader.pl.gamesPlayed : 0).toFixed(1)} PPG` : '-',
                  },
                  {
                    label: 'RPG Leader',
                    entry: rpgLeader,
                    val: rpgLeader ? `${(rpgLeader.pl.gamesPlayed > 0 ? rpgLeader.pl.reb / rpgLeader.pl.gamesPlayed : 0).toFixed(1)} RPG` : '-',
                  },
                  {
                    label: 'APG Leader',
                    entry: apgLeader,
                    val: apgLeader ? `${(apgLeader.pl.gamesPlayed > 0 ? apgLeader.pl.ast / apgLeader.pl.gamesPlayed : 0).toFixed(1)} APG` : '-',
                  },
                  {
                    label: 'BPG Leader',
                    entry: bpgLeader,
                    val: bpgLeader ? `${(bpgLeader.pl.gamesPlayed > 0 ? bpgLeader.pl.blk / bpgLeader.pl.gamesPlayed : 0).toFixed(1)} BPG` : '-',
                  },
                  {
                    label: '3PT Ace',
                    entry: threeLeader,
                    val: threeLeader
                      ? threeLeader.pl.tpa > 0
                        ? `${Math.round((threeLeader.pl.tpm / threeLeader.pl.tpa) * 100)}% 3PT`
                        : `${threeLeader.pl.shoot3} OVR 3PT`
                      : '-',
                  },
                ].map((ld) => (
                  <div key={ld.label} className="rounded border border-white/10 bg-zinc-900/80 px-2 py-1.5">
                    <div className="text-[9px] text-amber-300 font-black uppercase">{ld.label}</div>
                    <div className="text-white font-bold truncate">
                      {ld.entry ? `${ld.entry.pl.name} (${ld.entry.teamShort})` : '-'}
                    </div>
                    <div className="text-emerald-300 font-black">{ld.val}</div>
                  </div>
                ))}
              </div>

              {/* TEAM SELECTOR + ROSTER & PLAYER STATS */}
              <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="text-[11px] font-black text-white">
                    {selectedTeam.name} · Team OVR {selectedTeam.rating} ({selectedTeam.wins}-{selectedTeam.losses})
                  </div>
                  <select
                    value={selectedTeam.id}
                    onChange={(e) => setSelectedRosterTeamId(e.target.value)}
                    className="bg-zinc-950 border border-white/20 rounded px-2 py-1 text-[10px] text-zinc-100 font-bold"
                  >
                    {standings.map((t, idx) => (
                      <option key={t.id} value={t.id}>
                        #{idx + 1} {t.name} (OVR {t.rating})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] font-mono tabular-nums text-left">
                    <thead>
                      <tr className="text-zinc-500 border-b border-white/10">
                        <th className="py-1 pr-2">POS</th>
                        <th className="py-1 pr-2">PLAYER</th>
                        <th className="py-1 pr-2">STYLE</th>
                        <th className="py-1 px-1 text-right">OVR</th>
                        <th className="py-1 px-1 text-right">3PT</th>
                        <th className="py-1 px-1 text-right">MID</th>
                        <th className="py-1 px-1 text-right">DRV</th>
                        <th className="py-1 px-1 text-right">STR</th>
                        <th className="py-1 px-1 text-right">SPD</th>
                        <th className="py-1 px-1 text-right">BLK</th>
                        <th className="py-1 px-1 text-right">GP</th>
                        <th className="py-1 px-1 text-right">PPG</th>
                        <th className="py-1 px-1 text-right">RPG</th>
                        <th className="py-1 px-1 text-right">APG</th>
                        <th className="py-1 px-1 text-right">BPG</th>
                        <th className="py-1 pl-1 text-right">FG%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedTeam.roster || []).map((pl) => {
                        const gp = Math.max(1, pl.gamesPlayed);
                        const fgPct = pl.fga > 0 ? `${Math.round((pl.fgm / pl.fga) * 100)}%` : '-';
                        return (
                          <tr
                            key={pl.id}
                            className={`border-b border-white/5 ${
                              pl.isUser ? 'bg-emerald-500/15 text-emerald-200 font-bold' : 'text-zinc-200'
                            }`}
                          >
                            <td className="py-1 pr-2 font-black text-sky-300">{pl.position}</td>
                            <td className="py-1 pr-2 truncate max-w-[130px]">#{pl.jersey} {pl.name}</td>
                            <td className="py-1 pr-2 text-zinc-400 truncate max-w-[95px]">{pl.archetype}</td>
                            <td className="py-1 px-1 text-right font-black text-amber-300">{pl.ovr}</td>
                            <td className="py-1 px-1 text-right">{pl.shoot3}</td>
                            <td className="py-1 px-1 text-right">{pl.mid}</td>
                            <td className="py-1 px-1 text-right">{pl.drive}</td>
                            <td className="py-1 px-1 text-right">{pl.strength}</td>
                            <td className="py-1 px-1 text-right">{pl.speed}</td>
                            <td className="py-1 px-1 text-right">{pl.block}</td>
                            <td className="py-1 px-1 text-right text-zinc-400">{pl.gamesPlayed}</td>
                            <td className="py-1 px-1 text-right font-bold">{pl.gamesPlayed > 0 ? (pl.pts / gp).toFixed(1) : '-'}</td>
                            <td className="py-1 px-1 text-right">{pl.gamesPlayed > 0 ? (pl.reb / gp).toFixed(1) : '-'}</td>
                            <td className="py-1 px-1 text-right">{pl.gamesPlayed > 0 ? (pl.ast / gp).toFixed(1) : '-'}</td>
                            <td className="py-1 px-1 text-right">{pl.gamesPlayed > 0 ? (pl.blk / gp).toFixed(1) : '-'}</td>
                            <td className="py-1 pl-1 text-right">{fgPct}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {seasonHubTab === 'myplayer' && (() => {
            const pTeam = seasonState.teams.find((t) => t.id === 'player');
            const myPl = pTeam?.roster?.find((r) => r.isUser) || pTeam?.roster?.[0];
            const mp = seasonState.myPlayer || getMyPlayerProgression('basketball');
            const gp = Math.max(1, myPl?.gamesPlayed || 0);
            const burstCost = mp.ovr >= 88 ? 48 : mp.ovr >= 78 ? 38 : 30;
            const xpPct = Math.min(100, Math.round((mp.xp / burstCost) * 100));
            const statRows = [
              { k: 'shoot3', label: '3PT' },
              { k: 'mid', label: 'MID' },
              { k: 'drive', label: 'DRV' },
              { k: 'strength', label: 'STR' },
              { k: 'speed', label: 'SPD' },
              { k: 'block', label: 'BLK' },
              { k: 'steal', label: 'STL' },
              { k: 'rebound', label: 'REB' },
            ];
            return (
              <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-sm font-black text-emerald-300">
                      #{activePosProf.jersey} YOU · {activePos} ({activePosProf.title})
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-300 font-black text-[11px]">
                      {mp.ovr} OVR / {mp.potential} POT
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mb-2">
                    {activePosProf.archetype} · {mp.gamesPlayed} Career Games · Play well to reach {mp.potential} Potential
                  </div>
                  <div className="rounded bg-black/50 border border-white/10 p-2 mb-2.5">
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                      <span className="text-sky-300">Next Upgrade Burst XP</span>
                      <span className="text-zinc-300">{mp.xp} / {burstCost} XP</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-sky-400 to-emerald-400" style={{ width: `${xpPct}%` }} />
                    </div>
                    {mp.lastGain && (
                      <div className="text-[10px] text-emerald-300 font-bold mt-1.5">{mp.lastGain.summary}</div>
                    )}
                  </div>
                  <div className="space-y-1 text-[11px] mb-2">
                    <div className="text-emerald-300 font-bold">Strengths:</div>
                    {activePosProf.advantages.map((a) => (
                      <div key={a} className="text-zinc-200">+ {a}</div>
                    ))}
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="text-rose-300 font-bold">Weaknesses:</div>
                    {activePosProf.disadvantages.map((d) => (
                      <div key={d} className="text-zinc-300">- {d}</div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    {statRows.map((st) => {
                      const val = mp.stats[st.k] ?? 60;
                      const cap = mp.caps[st.k] ?? 90;
                      const pct = Math.min(100, Math.round((val / cap) * 100));
                      return (
                        <div key={st.k} className="rounded bg-black/50 border border-white/10 px-2 py-1.5">
                          <div className="flex justify-between mb-1">
                            <span className="text-zinc-400 font-bold">{st.label}</span>
                            <span className="text-sky-300 font-black">
                              {val} <span className="text-zinc-500">/ {cap}</span>
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div className="h-full bg-sky-400" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {myPl && (
                    <div className="rounded bg-black/50 border border-emerald-400/30 p-2 text-[10px] font-mono">
                      <div className="text-emerald-300 font-black uppercase mb-1">
                        Season #{seasonState.seasonNumber} Averages ({myPl.gamesPlayed} GP)
                      </div>
                      <div className="grid grid-cols-5 gap-1 text-center">
                        <div><div className="text-zinc-400">PPG</div><div className="text-white font-black">{myPl.gamesPlayed ? (myPl.pts / gp).toFixed(1) : '0.0'}</div></div>
                        <div><div className="text-zinc-400">RPG</div><div className="text-white font-black">{myPl.gamesPlayed ? (myPl.reb / gp).toFixed(1) : '0.0'}</div></div>
                        <div><div className="text-zinc-400">APG</div><div className="text-white font-black">{myPl.gamesPlayed ? (myPl.ast / gp).toFixed(1) : '0.0'}</div></div>
                        <div><div className="text-zinc-400">BPG</div><div className="text-white font-black">{myPl.gamesPlayed ? (myPl.blk / gp).toFixed(1) : '0.0'}</div></div>
                        <div><div className="text-zinc-400">FG%</div><div className="text-white font-black">{myPl.fga ? `${Math.round((myPl.fgm / myPl.fga) * 100)}%` : '-'}</div></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      );
    }

    const selectedFbTeam =
      seasonState.teams.find((t) => t.id === selectedRosterTeamId) || seasonState.teams[0];
    const allFbPlayers = seasonState.teams.flatMap((t) =>
      (t.fbRoster || []).map((pl) => ({ teamShort: t.short, teamName: t.name, teamId: t.id, pl }))
    );
    const fbLeaderBy = (fn: (r: FbRosterPlayer) => number) =>
      [...allFbPlayers].sort((a, b) => fn(b.pl) - fn(a.pl))[0];
    const passYdsLeader = fbLeaderBy((r) => (r.gamesPlayed > 0 ? r.passYds : r.throwAcc * 0.4));
    const passTdLeader = fbLeaderBy((r) => (r.gamesPlayed > 0 ? r.passTd : r.throwPow * 0.02));
    const scrimLeader = fbLeaderBy((r) => (r.gamesPlayed > 0 ? r.rushYds + r.recYds : (r.carry + r.catchStat) * 0.2));
    const tackleLeader = fbLeaderBy((r) => (r.gamesPlayed > 0 ? r.tackles : r.tackle * 0.05));
    const intLeader = fbLeaderBy((r) => (r.gamesPlayed > 0 ? r.defInt : r.coverage * 0.02));

    const fbRoundTitles = ['Round of 16', 'Quarterfinals', 'Semifinals', 'Championship'];
    const fbR16PreviewPairs: [number, number][] = [
      [0, 15],
      [7, 8],
      [4, 11],
      [3, 12],
      [2, 13],
      [5, 10],
      [6, 9],
      [1, 14],
    ];

    return (
      <div className="bg-zinc-950/95 border border-emerald-400/50 rounded-xl p-3.5 text-left w-full">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2.5 border-b border-white/10">
          <div>
            <div className="text-xs font-black text-emerald-300 uppercase tracking-wider">
              🏈 METRO GRIDIRON LEAGUE ({seasonState.teams.length} TEAMS) · SEASON #{seasonState.seasonNumber}
            </div>
            <div className="text-[11px] text-zinc-400">
              Your Pos:{' '}
              <span className="text-sky-300 font-black">
                {activeFbPosHub} ({posLocked ? '🔒 Locked' : 'Unlocked'})
              </span>{' '}
              · Seed #{playerSeed}/{seasonState.teams.length} · Top {playoffCut} Make Playoffs · Titles:{' '}
              {seasonState.championshipsWon}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(seasonState.phase === 'regular' || seasonState.phase === 'playoffs') && (
              <button
                type="button"
                onClick={handleQuickSim}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[10px] font-black uppercase border border-amber-400/35 cursor-pointer"
              >
                ⚡ Sim Next Game
              </button>
            )}
            {(seasonState.phase === 'champion' ||
              seasonState.phase === 'eliminated' ||
              seasonState.phase === 'missed_playoffs') && (
              <button
                type="button"
                onClick={handleNewSeason}
                className="px-3 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black text-[10px] font-black uppercase cursor-pointer"
              >
                ▶ Start Season #{seasonState.seasonNumber + 1} (Unlocks Position)
              </button>
            )}
          </div>
        </div>

        {/* FOOTBALL POSITION PICKER / SEASON LOCK STRIP */}
        <div className="mb-2.5 rounded-lg border border-sky-400/35 bg-zinc-900/80 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="text-[10px] font-black text-sky-300 uppercase tracking-wider">
              {posLocked
                ? `🔒 Position Locked: ${activeFbPosHub} (${activeFbProf.title}) — Unlocks after Season #${seasonState.seasonNumber}`
                : `Choose Position for Season #${seasonState.seasonNumber} (Switching resets MyPlayer back to 66 OVR)`}
            </div>
            {!posLocked && (
              <button
                type="button"
                onClick={() => handleSelectFbSeasonPos(activeFbPosHub, true)}
                className="px-2.5 py-1 rounded bg-sky-400 hover:bg-sky-300 text-black text-[10px] font-black uppercase cursor-pointer"
              >
                🔒 Lock In {activeFbPosHub} for Season
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {FB_POSITIONS.map((pos) => {
              const prof = FB_POSITION_PROFILES[pos];
              const isSel = activeFbPosHub === pos;
              return (
                <button
                  key={pos}
                  type="button"
                  disabled={posLocked}
                  onClick={() => handleSelectFbSeasonPos(pos, false)}
                  className={`px-2 py-1.5 rounded text-left border transition ${
                    isSel
                      ? 'bg-sky-500/25 border-sky-300 text-white'
                      : posLocked
                      ? 'bg-zinc-900/40 border-white/5 text-zinc-600 cursor-not-allowed'
                      : 'bg-zinc-950/70 border-white/10 text-zinc-300 hover:border-sky-400/50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-black">
                    <span>{pos}</span>
                    <span className="text-[9px] text-amber-300">
                      SPD {prof.speed} · {pos === 'QB' ? `ACC ${prof.throwAcc}` : pos === 'LB' ? `TKL ${prof.tackle}` : pos === 'CB' ? `COV ${prof.coverage}` : `CTH ${prof.catchStat}`}
                    </span>
                  </div>
                  <div className="text-[9px] text-zinc-400 truncate">{prof.archetype}</div>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
            <div className="text-emerald-300">
              <span className="font-black uppercase">Advantages: </span>
              {activeFbProf.advantages.join(' · ')}
            </div>
            <div className="text-rose-300">
              <span className="font-black uppercase">Disadvantages: </span>
              {activeFbProf.disadvantages.join(' · ')}
            </div>
          </div>
        </div>

        {/* FOOTBALL SEASON HUB TABS */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          {([
            { id: 'standings', label: '📊 30-Team Standings & 16-Team Playoffs' },
            { id: 'rosters', label: '🏈 Teams, Rosters & Player Stats' },
            { id: 'myplayer', label: '🪪 My Player Card' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSeasonHubTab(tab.id)}
              className={`px-2.5 py-1 rounded text-[10px] font-black uppercase cursor-pointer ${
                seasonHubTab === tab.id
                  ? 'bg-emerald-400 text-black'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {seasonHubTab === 'standings' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.15fr] gap-3">
            {/* LEFT: 30-TEAM SCROLLABLE STANDINGS */}
            <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-2.5">
              <div className="text-[10px] font-black text-zinc-300 uppercase tracking-wider mb-1.5">
                30-Team Standings ({seasonState.phase === 'regular' ? `Week ${seasonState.currentWeek}/${seasonState.totalWeeks}` : 'Final Seedings'})
              </div>
              <div className="text-[10px] font-mono tabular-nums space-y-1 max-h-64 overflow-y-auto pr-1">
                <div className="grid grid-cols-[26px_1fr_30px_44px_38px_38px] text-zinc-500 font-bold pb-1 border-b border-white/10 sticky top-0 bg-zinc-900/95">
                  <span>#</span>
                  <span>TEAM</span>
                  <span className="text-right">OVR</span>
                  <span className="text-right">W-L</span>
                  <span className="text-right">DIFF</span>
                  <span className="text-right">STRK</span>
                </div>
                {standings.map((team, idx) => {
                  const seed = idx + 1;
                  const diff = team.pf - team.pa;
                  const isPlayer = team.id === 'player';
                  const inPlayoffs = seed <= playoffCut;
                  const record =
                    team.ties > 0
                      ? `${team.wins}-${team.losses}-${team.ties}`
                      : `${team.wins}-${team.losses}`;
                  const streakTxt = team.streak > 0 ? `W${team.streak}` : team.streak < 0 ? `L${Math.abs(team.streak)}` : '-';
                  return (
                    <React.Fragment key={team.id}>
                      <div
                        onClick={() => {
                          setSelectedRosterTeamId(team.id);
                          setSeasonHubTab('rosters');
                        }}
                        className={`grid grid-cols-[26px_1fr_30px_44px_38px_38px] items-center px-1.5 py-1 rounded cursor-pointer hover:bg-white/5 ${
                          isPlayer
                            ? 'bg-emerald-500/20 text-emerald-200 font-black border border-emerald-400/40'
                            : inPlayoffs
                            ? 'text-zinc-200'
                            : 'text-zinc-400'
                        }`}
                      >
                        <span className={inPlayoffs ? 'text-amber-300 font-black' : 'text-zinc-500'}>#{seed}</span>
                        <span className="truncate">{team.name}</span>
                        <span className="text-right text-sky-300">{team.rating}</span>
                        <span className="text-right">{record}</span>
                        <span className={`text-right ${diff >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                        <span className="text-right">{streakTxt}</span>
                      </div>
                      {seed === playoffCut && (
                        <div className="flex items-center gap-2 py-0.5 text-[9px] text-amber-300/90 font-bold uppercase tracking-wider">
                          <span className="flex-1 h-px bg-amber-400/45" />
                          <span>Top 16 Playoff Cutline</span>
                          <span className="flex-1 h-px bg-amber-400/45" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: NEXT MATCHUP + 16-TEAM 4-ROUND BRACKET */}
            <div className="flex flex-col gap-2.5">
              <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-2.5">
                <div className="text-[10px] font-black text-amber-300 uppercase tracking-wider mb-1">
                  {seasonState.phase === 'regular'
                    ? `Next Scheduled Matchup · ${matchup.roundLabel}`
                    : seasonState.phase === 'playoffs'
                    ? `Active Playoff Round · ${matchup.roundLabel}`
                    : seasonState.phase === 'champion'
                    ? '🏆 Season Championship Won!'
                    : seasonState.phase === 'eliminated'
                    ? 'Season Eliminated in Playoffs'
                    : 'Missed Top 16 Playoff Cut'}
                </div>
                {seasonState.phase === 'regular' || seasonState.phase === 'playoffs' ? (
                  <div className="text-xs text-zinc-200 space-y-0.5">
                    <div className="font-black text-white">
                      #{matchup.playerSeed} YOU vs #{matchup.opponentSeed} {matchup.opponentName}
                    </div>
                    <div className="text-[11px] text-emerald-300 font-bold">
                      Win Purse: +${matchup.prizeCash.toLocaleString()} · Opp OVR {matchup.opponentRating}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-300">
                    Champion: <span className="font-black text-amber-300">{champTeam?.name || 'TBD'}</span>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-2.5 flex-1">
                <div className="text-[10px] font-black text-zinc-300 uppercase tracking-wider mb-2">
                  16-Team Seeded Playoffs Bracket (4 Rounds)
                </div>
                {!bracket ? (
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    {fbR16PreviewPairs.map(([aIdx, bIdx], pIdx) => {
                      const ta = standings[aIdx];
                      const tb = standings[bIdx];
                      const hasYou = ta?.id === 'player' || tb?.id === 'player';
                      return (
                        <div
                          key={pIdx}
                          className={`px-2 py-1 rounded border ${
                            hasYou ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200 font-bold' : 'border-white/10 bg-black/40 text-zinc-300'
                          }`}
                        >
                          #{aIdx + 1} {ta?.short} vs #{bIdx + 1} {tb?.short}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] font-mono tabular-nums max-h-52 overflow-y-auto pr-1">
                    {bracket.rounds.map((rndMatches, rIdx) => (
                      <div key={rIdx} className="space-y-1.5">
                        <div className="text-[9px] font-black text-amber-300 uppercase text-center">
                          {fbRoundTitles[rIdx] || `Round ${rIdx + 1}`}
                        </div>
                        {rndMatches.length === 0 ? (
                          <div className="p-1.5 rounded border border-white/10 bg-black/35 text-zinc-500 text-center">
                            TBD
                          </div>
                        ) : (
                          rndMatches.map((m) => {
                            const topWon = m.played && m.winnerId === m.topTeamId;
                            const botWon = m.played && m.winnerId === m.botTeamId;
                            const hasPlayer = m.topTeamId === 'player' || m.botTeamId === 'player';
                            return (
                              <div
                                key={m.id}
                                className={`rounded border overflow-hidden ${
                                  hasPlayer ? 'border-emerald-400/60 bg-emerald-950/35' : 'border-white/15 bg-black/50'
                                }`}
                              >
                                <div
                                  className={`px-1.5 py-0.5 flex justify-between border-b border-white/10 ${
                                    topWon ? 'text-emerald-300 font-black bg-emerald-500/15' : 'text-zinc-300'
                                  }`}
                                >
                                  <span className="truncate">{m.topTeamName}</span>
                                  <span>{m.played ? m.topScore : '-'}</span>
                                </div>
                                <div
                                  className={`px-1.5 py-0.5 flex justify-between ${
                                    botWon ? 'text-emerald-300 font-black bg-emerald-500/15' : 'text-zinc-300'
                                  }`}
                                >
                                  <span className="truncate">{m.botTeamName}</span>
                                  <span>{m.played ? m.botScore : '-'}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {seasonHubTab === 'rosters' && (
          <div className="space-y-2.5">
            {/* FOOTBALL LEAGUE LEADERS */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px]">
              {[
                {
                  label: 'Pass Yds Leader',
                  entry: passYdsLeader,
                  val: passYdsLeader ? `${passYdsLeader.pl.passYds} YDS` : '-',
                },
                {
                  label: 'Pass TD Leader',
                  entry: passTdLeader,
                  val: passTdLeader ? `${passTdLeader.pl.passTd} TD` : '-',
                },
                {
                  label: 'Scrimmage Leader',
                  entry: scrimLeader,
                  val: scrimLeader ? `${scrimLeader.pl.rushYds + scrimLeader.pl.recYds} YDS` : '-',
                },
                {
                  label: 'Tackles Leader',
                  entry: tackleLeader,
                  val: tackleLeader ? `${tackleLeader.pl.tackles} TKL` : '-',
                },
                {
                  label: 'INT Leader',
                  entry: intLeader,
                  val: intLeader ? `${intLeader.pl.defInt} INT` : '-',
                },
              ].map((ld) => (
                <div key={ld.label} className="rounded border border-white/10 bg-zinc-900/80 px-2 py-1.5">
                  <div className="text-[9px] text-amber-300 font-black uppercase">{ld.label}</div>
                  <div className="text-white font-bold truncate">
                    {ld.entry ? `${ld.entry.pl.name} (${ld.entry.teamShort})` : '-'}
                  </div>
                  <div className="text-emerald-300 font-black">{ld.val}</div>
                </div>
              ))}
            </div>

            {/* TEAM SELECTOR + FOOTBALL ROSTER TABLE */}
            <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="text-[11px] font-black text-white">
                  {selectedFbTeam.name} · Team OVR {selectedFbTeam.rating} ({selectedFbTeam.wins}-{selectedFbTeam.losses})
                </div>
                <select
                  value={selectedFbTeam.id}
                  onChange={(e) => setSelectedRosterTeamId(e.target.value)}
                  className="bg-zinc-950 border border-white/20 rounded px-2 py-1 text-[10px] text-zinc-100 font-bold"
                >
                  {standings.map((t, idx) => (
                    <option key={t.id} value={t.id}>
                      #{idx + 1} {t.name} (OVR {t.rating})
                    </option>
                  ))}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-mono tabular-nums text-left">
                  <thead>
                    <tr className="text-zinc-500 border-b border-white/10">
                      <th className="py-1 pr-2">POS</th>
                      <th className="py-1 pr-2">PLAYER</th>
                      <th className="py-1 pr-2">STYLE</th>
                      <th className="py-1 px-1 text-right">OVR</th>
                      <th className="py-1 px-1 text-right">ACC</th>
                      <th className="py-1 px-1 text-right">CTH</th>
                      <th className="py-1 px-1 text-right">SPD</th>
                      <th className="py-1 px-1 text-right">TKL</th>
                      <th className="py-1 px-1 text-right">COV</th>
                      <th className="py-1 px-1 text-right">GP</th>
                      <th className="py-1 px-1 text-right">PASS</th>
                      <th className="py-1 px-1 text-right">RUSH</th>
                      <th className="py-1 px-1 text-right">REC</th>
                      <th className="py-1 pl-1 text-right">TKL/INT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedFbTeam.fbRoster || []).map((pl) => (
                      <tr
                        key={pl.id}
                        className={`border-b border-white/5 ${
                          pl.isUser ? 'bg-emerald-500/15 text-emerald-200 font-bold' : 'text-zinc-200'
                        }`}
                      >
                        <td className="py-1 pr-2 font-black text-sky-300">{pl.position}</td>
                        <td className="py-1 pr-2 truncate max-w-[130px]">#{pl.jersey} {pl.name}</td>
                        <td className="py-1 pr-2 text-zinc-400 truncate max-w-[95px]">{pl.archetype}</td>
                        <td className="py-1 px-1 text-right font-black text-amber-300">{pl.ovr}</td>
                        <td className="py-1 px-1 text-right">{pl.throwAcc}</td>
                        <td className="py-1 px-1 text-right">{pl.catchStat}</td>
                        <td className="py-1 px-1 text-right">{pl.speed}</td>
                        <td className="py-1 px-1 text-right">{pl.tackle}</td>
                        <td className="py-1 px-1 text-right">{pl.coverage}</td>
                        <td className="py-1 px-1 text-right text-zinc-400">{pl.gamesPlayed}</td>
                        <td className="py-1 px-1 text-right">{pl.passYds > 0 ? `${pl.passYds}y/${pl.passTd}td` : '-'}</td>
                        <td className="py-1 px-1 text-right">{pl.rushYds > 0 ? `${pl.rushYds}y/${pl.rushTd}td` : '-'}</td>
                        <td className="py-1 px-1 text-right">{pl.recYds > 0 ? `${pl.recYds}y/${pl.recTd}td` : '-'}</td>
                        <td className="py-1 pl-1 text-right">{pl.tackles > 0 || pl.defInt > 0 ? `${pl.tackles}/${pl.defInt}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {seasonHubTab === 'myplayer' && (() => {
          const pTeam = seasonState.teams.find((t) => t.id === 'player');
          const myPl = pTeam?.fbRoster?.find((r) => r.isUser) || pTeam?.fbRoster?.[0];
          const mp = seasonState.myPlayer || getMyPlayerProgression('football');
          const burstCost = mp.ovr >= 88 ? 48 : mp.ovr >= 78 ? 38 : 30;
          const xpPct = Math.min(100, Math.round((mp.xp / burstCost) * 100));
          const statRows = [
            { k: 'throwAcc', label: 'ACC' },
            { k: 'throwPow', label: 'POW' },
            { k: 'catchStat', label: 'CTH' },
            { k: 'carry', label: 'ELU' },
            { k: 'speed', label: 'SPD' },
            { k: 'strength', label: 'STR' },
            { k: 'tackle', label: 'TKL' },
            { k: 'coverage', label: 'COV' },
          ];
          return (
            <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-sm font-black text-emerald-300">
                    #{activeFbProf.jersey} YOU · {activeFbPosHub} ({activeFbProf.title})
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-300 font-black text-[11px]">
                    {mp.ovr} OVR / {mp.potential} POT
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 mb-2">
                  {activeFbProf.archetype} · {mp.gamesPlayed} Career Games · Play well to reach {mp.potential} Potential
                </div>
                <div className="rounded bg-black/50 border border-white/10 p-2 mb-2.5">
                  <div className="flex justify-between text-[10px] font-bold mb-1">
                    <span className="text-sky-300">Next Upgrade Burst XP</span>
                    <span className="text-zinc-300">{mp.xp} / {burstCost} XP</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-400 to-emerald-400" style={{ width: `${xpPct}%` }} />
                  </div>
                  {mp.lastGain && (
                    <div className="text-[10px] text-emerald-300 font-bold mt-1.5">{mp.lastGain.summary}</div>
                  )}
                </div>
                <div className="space-y-1 text-[11px] mb-2">
                  <div className="text-emerald-300 font-bold">Strengths:</div>
                  {activeFbProf.advantages.map((a) => (
                    <div key={a} className="text-zinc-200">+ {a}</div>
                  ))}
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="text-rose-300 font-bold">Weaknesses:</div>
                  {activeFbProf.disadvantages.map((d) => (
                    <div key={d} className="text-zinc-300">- {d}</div>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  {statRows.map((st) => {
                    const val = mp.stats[st.k] ?? 60;
                    const cap = mp.caps[st.k] ?? 90;
                    const pct = Math.min(100, Math.round((val / cap) * 100));
                    return (
                      <div key={st.k} className="rounded bg-black/50 border border-white/10 px-2 py-1.5">
                        <div className="flex justify-between mb-1">
                          <span className="text-zinc-400 font-bold">{st.label}</span>
                          <span className="text-sky-300 font-black">
                            {val} <span className="text-zinc-500">/ {cap}</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div className="h-full bg-sky-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {myPl && (
                  <div className="rounded bg-black/50 border border-emerald-400/30 p-2 text-[10px] font-mono">
                    <div className="text-emerald-300 font-black uppercase mb-1">
                      Season #{seasonState.seasonNumber} Totals ({myPl.gamesPlayed} GP)
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-center">
                      <div><div className="text-zinc-400">PASS</div><div className="text-white font-black">{myPl.passYds}y</div></div>
                      <div><div className="text-zinc-400">RUSH</div><div className="text-white font-black">{myPl.rushYds}y</div></div>
                      <div><div className="text-zinc-400">REC</div><div className="text-white font-black">{myPl.recYds}y</div></div>
                      <div><div className="text-zinc-400">TKL</div><div className="text-white font-black">{myPl.tackles}</div></div>
                      <div><div className="text-zinc-400">INT</div><div className="text-white font-black">{myPl.defInt}</div></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  const renderTournamentBracket = (sportKey: 'basketball' | 'baseball' | 'football' | 'soccer') => {
    const rounds =
      sportKey === 'basketball'
        ? TOURNAMENT_ROUNDS
        : sportKey === 'baseball'
        ? BASEBALL_TOURNAMENT_ROUNDS
        : sportKey === 'football'
        ? FOOTBALL_TOURNAMENT_ROUNDS
        : SOCCER_TOURNAMENT_ROUNDS;
    const activeIdx =
      sportKey === 'basketball'
        ? tournamentRoundIdx
        : sportKey === 'baseball'
        ? baseballRoundIdx
        : sportKey === 'football'
        ? footballRoundIdx
        : soccerRoundIdx;
    const results =
      sportKey === 'basketball'
        ? bballBracketResults
        : sportKey === 'baseball'
        ? baseballBracketResults
        : sportKey === 'football'
        ? footballBracketResults
        : soccerBracketResults;
    const pods = BRACKET_RIVAL_PODS[sportKey];
    const championWon = results[rounds.length - 1]?.won === true;

    const MatchBox = ({
      topTeam,
      topScore,
      botTeam,
      botScore,
      highlightTop,
      highlightBot,
      isCurrent,
      badge,
    }: {
      topTeam: string;
      topScore?: string;
      botTeam: string;
      botScore?: string;
      highlightTop?: boolean;
      highlightBot?: boolean;
      isCurrent?: boolean;
      badge?: string;
    }) => (
      <div
        className={`rounded-lg border text-[10px] font-mono overflow-hidden ${
          isCurrent
            ? 'border-amber-400 bg-amber-950/35 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
            : 'border-white/15 bg-zinc-900/90'
        }`}
      >
        {badge && (
          <div className="px-2 py-0.5 bg-black/50 text-[8px] font-black text-amber-300 uppercase tracking-wider border-b border-white/10">
            {badge}
          </div>
        )}
        <div
          className={`px-2 py-1 flex items-center justify-between gap-2 border-b border-white/10 ${
            highlightTop ? 'bg-emerald-500/20 text-emerald-300 font-black' : 'text-zinc-200'
          }`}
        >
          <span className="truncate">{topTeam}</span>
          {topScore !== undefined && <span className="font-black shrink-0">{topScore}</span>}
        </div>
        <div
          className={`px-2 py-1 flex items-center justify-between gap-2 ${
            highlightBot ? 'bg-rose-500/20 text-rose-300 font-black' : 'text-zinc-400'
          }`}
        >
          <span className="truncate">{botTeam}</span>
          {botScore !== undefined && <span className="font-black shrink-0">{botScore}</span>}
        </div>
      </div>
    );

    if (sportKey === 'basketball') {
      const r = BBALL_16_TEAMS_RIVALS;
      const finalBoss = rounds[3].opponent.replace(' (FINAL)', '');
      return (
        <div className="bg-zinc-950/95 border border-amber-400/50 rounded-xl p-3 text-left w-full">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
              🏆 16-TEAM MARYLAND CHAMPIONSHIP BRACKET (BASKETBALL)
            </div>
            {championWon && (
              <span className="px-2 py-0.5 rounded bg-emerald-400 text-black text-[10px] font-black">
                👑 CHAMPION!
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 items-center overflow-x-auto">
            {/* COLUMN 1: ROUND OF 16 */}
            <div className="flex flex-col gap-1">
              <div className="text-[9px] font-black text-zinc-400 uppercase text-center">Round of 16</div>
              <MatchBox
                badge="R16-1 (YOU)"
                topTeam="YOU (HOME)"
                topScore={results[0] ? String(results[0].userScore) : undefined}
                botTeam={rounds[0].opponent}
                botScore={results[0] ? String(results[0].cpuScore) : undefined}
                highlightTop={results[0]?.won === true}
                highlightBot={results[0]?.won === false}
                isCurrent={activeIdx === 0 && !results[0]}
              />
              <MatchBox badge="R16-2" topTeam={rounds[1].opponent} topScore="W" botTeam={r[0]} botScore="L" highlightTop />
              <MatchBox badge="R16-3" topTeam={r[1]} topScore="W" botTeam={r[2]} botScore="L" highlightTop />
              <MatchBox badge="R16-4" topTeam={rounds[2].opponent} topScore="W" botTeam={r[3]} botScore="L" highlightTop />
              <MatchBox badge="R16-5" topTeam={r[4]} topScore="W" botTeam={r[5]} botScore="L" highlightTop />
              <MatchBox badge="R16-6" topTeam={r[6]} topScore="W" botTeam={r[7]} botScore="L" highlightTop />
              <MatchBox badge="R16-7" topTeam={r[8]} topScore="W" botTeam={r[9]} botScore="L" highlightTop />
              <MatchBox badge="R16-8" topTeam={finalBoss} topScore="W" botTeam={r[10]} botScore="L" highlightTop />
            </div>

            {/* COLUMN 2: QUARTERFINALS */}
            <div className="flex flex-col gap-4">
              <div className="text-[9px] font-black text-zinc-400 uppercase text-center">Quarterfinals</div>
              <MatchBox
                badge="QF 1"
                topTeam={results[0]?.won ? 'YOU (HOME)' : results[0] ? rounds[0].opponent : 'TBD (R16-1)'}
                topScore={results[1] ? String(results[1].userScore) : undefined}
                botTeam={rounds[1].opponent}
                botScore={results[1] ? String(results[1].cpuScore) : undefined}
                highlightTop={results[1]?.won === true}
                highlightBot={results[1]?.won === false}
                isCurrent={activeIdx === 1 && !results[1]}
              />
              <MatchBox badge="QF 2" topTeam={r[1]} topScore="L" botTeam={rounds[2].opponent} botScore="W" highlightBot />
              <MatchBox badge="QF 3" topTeam={r[4]} topScore="W" botTeam={r[6]} botScore="L" highlightTop />
              <MatchBox badge="QF 4" topTeam={r[8]} topScore="L" botTeam={finalBoss} botScore="W" highlightBot />
            </div>

            {/* COLUMN 3: SEMIFINALS */}
            <div className="flex flex-col gap-10">
              <div className="text-[9px] font-black text-zinc-400 uppercase text-center">Semifinals</div>
              <MatchBox
                badge="SEMI 1"
                topTeam={results[1]?.won ? 'YOU (HOME)' : results[1] ? rounds[1].opponent : 'TBD (QF 1)'}
                topScore={results[2] ? String(results[2].userScore) : undefined}
                botTeam={rounds[2].opponent}
                botScore={results[2] ? String(results[2].cpuScore) : undefined}
                highlightTop={results[2]?.won === true}
                highlightBot={results[2]?.won === false}
                isCurrent={activeIdx === 2 && !results[2]}
              />
              <MatchBox badge="SEMI 2" topTeam={r[4]} topScore="L" botTeam={finalBoss} botScore="W" highlightBot />
            </div>

            {/* COLUMN 4: CHAMPIONSHIP */}
            <div className="flex flex-col gap-2">
              <div className="text-[9px] font-black text-amber-300 uppercase text-center">Championship</div>
              <MatchBox
                badge={`FINAL · $${rounds[3].prize.toLocaleString()}`}
                topTeam={results[2]?.won ? 'YOU (HOME)' : results[2] ? rounds[2].opponent : 'TBD (SEMI 1)'}
                topScore={results[3] ? String(results[3].userScore) : undefined}
                botTeam={finalBoss}
                botScore={results[3] ? String(results[3].cpuScore) : undefined}
                highlightTop={results[3]?.won === true}
                highlightBot={results[3]?.won === false}
                isCurrent={activeIdx === 3 && !results[3]}
              />
              <div className="p-2 rounded-lg bg-zinc-900/90 border border-amber-400/30 text-center">
                <div className="text-[9px] text-zinc-400">TROPHY WINNER</div>
                <div className="text-xs font-black text-amber-300 mt-0.5 truncate">
                  {results[3]
                    ? results[3].won
                      ? '🏆 YOU (CHAMPION!)'
                      : `🏆 ${finalBoss}`
                    : '⏳ TO BE CROWNED'}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-zinc-950/95 border border-amber-400/50 rounded-xl p-3 text-left w-full">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
            🏆 8-TEAM MARYLAND CHAMPIONSHIP BRACKET ({sportKey.toUpperCase()})
          </div>
          {championWon && (
            <span className="px-2 py-0.5 rounded bg-emerald-400 text-black text-[10px] font-black">
              👑 CHAMPION!
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5 items-center">
          {/* COLUMN 1: QUARTERFINALS */}
          <div className="flex flex-col gap-1.5">
            <div className="text-[9px] font-black text-zinc-400 uppercase text-center">Quarterfinals</div>
            <MatchBox
              badge="QF 1 (YOU)"
              topTeam="YOU (HOME)"
              topScore={results[0] ? String(results[0].userScore) : undefined}
              botTeam={rounds[0].opponent}
              botScore={results[0] ? String(results[0].cpuScore) : undefined}
              highlightTop={results[0]?.won === true}
              highlightBot={results[0]?.won === false}
              isCurrent={activeIdx === 0 && !results[0]}
            />
            <MatchBox
              badge="QF 2"
              topTeam={rounds[1].opponent}
              topScore="W"
              botTeam={pods.qfRivals[0]}
              botScore="L"
              highlightTop
            />
            <MatchBox
              badge="QF 3"
              topTeam={pods.sfRival}
              topScore="W"
              botTeam={pods.qfRivals[2]}
              botScore="L"
              highlightTop
            />
            <MatchBox
              badge="QF 4"
              topTeam={rounds[2].opponent.replace(' (FINAL)', '')}
              topScore="W"
              botTeam={pods.qfRivals[4]}
              botScore="L"
              highlightTop
            />
          </div>

          {/* COLUMN 2: SEMIFINALS */}
          <div className="flex flex-col gap-5">
            <div className="text-[9px] font-black text-zinc-400 uppercase text-center">Semifinals</div>
            <MatchBox
              badge="SEMI 1"
              topTeam={results[0]?.won ? 'YOU (HOME)' : results[0] ? rounds[0].opponent : 'TBD (QF1 Winner)'}
              topScore={results[1] ? String(results[1].userScore) : undefined}
              botTeam={rounds[1].opponent}
              botScore={results[1] ? String(results[1].cpuScore) : undefined}
              highlightTop={results[1]?.won === true}
              highlightBot={results[1]?.won === false}
              isCurrent={activeIdx === 1 && !results[1]}
            />
            <MatchBox
              badge="SEMI 2"
              topTeam={pods.sfRival}
              topScore="L"
              botTeam={rounds[2].opponent.replace(' (FINAL)', '')}
              botScore="W"
              highlightBot
            />
          </div>

          {/* COLUMN 3: CHAMPIONSHIP FINAL */}
          <div className="flex flex-col gap-2">
            <div className="text-[9px] font-black text-amber-300 uppercase text-center">Championship</div>
            <MatchBox
              badge={`FINAL · $${rounds[2].prize.toLocaleString()}`}
              topTeam={results[1]?.won ? 'YOU (HOME)' : results[1] ? rounds[1].opponent : 'TBD (Semi 1)'}
              topScore={results[2] ? String(results[2].userScore) : undefined}
              botTeam={rounds[2].opponent.replace(' (FINAL)', '')}
              botScore={results[2] ? String(results[2].cpuScore) : undefined}
              highlightTop={results[2]?.won === true}
              highlightBot={results[2]?.won === false}
              isCurrent={activeIdx === 2 && !results[2]}
            />
            <div className="p-2 rounded-lg bg-zinc-900/90 border border-amber-400/30 text-center">
              <div className="text-[9px] text-zinc-400">TROPHY WINNER</div>
              <div className="text-xs font-black text-amber-300 mt-0.5 truncate">
                {results[2]
                  ? results[2].won
                    ? '🏆 YOU (CHAMPION!)'
                    : `🏆 ${rounds[2].opponent.replace(' (FINAL)', '')}`
                  : '⏳ TO BE CROWNED'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] w-screen h-screen bg-zinc-950 flex flex-col font-mono select-none overflow-hidden">
      <div className="w-full h-full flex flex-col bg-zinc-950 overflow-hidden">
        {/* TOP HEADER */}
        <div className="px-4 py-2.5 bg-zinc-900 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl">{venue.icon}</span>
            <div className="min-w-0">
              <div className="text-xs font-black text-emerald-300 truncate">{hud.title}</div>
              <div className="text-[10px] text-zinc-400 truncate">{venue.streetLocation}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded bg-black/70 border border-white/15 text-center">
              <div className="text-[9px] text-zinc-400">{hud.scoreLeftLabel}</div>
              <div className="text-sm font-black text-sky-300">{hud.scoreLeftValue}</div>
            </div>
            <div className="px-2.5 py-1 rounded bg-black/70 border border-white/15 text-center">
              <div className="text-[9px] text-zinc-400">{hud.scoreRightLabel}</div>
              <div className="text-sm font-black text-rose-300">{hud.scoreRightValue}</div>
            </div>
            <div className="px-2.5 py-1 rounded bg-black/70 border border-amber-400/30 text-center">
              <div className="text-[9px] text-amber-300">{hud.clockOrRoundLabel}</div>
              <div className="text-sm font-black text-amber-200">{hud.clockOrRoundValue}</div>
            </div>
            <button
              type="button"
              onClick={() => onAbortRef.current()}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold cursor-pointer border border-white/15"
            >
              ✕ Exit
            </button>
          </div>
        </div>

        {/* MODE BAR: BASKETBALL (Free Play vs 5v5 Hard Tournament vs Full Season & Playoffs) */}
        {venue.sport === 'basketball' && (
          <div className="px-4 py-2 bg-zinc-900/70 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setBballMode('free');
                  setShowBracketModal(false);
                  setShowSeasonModal(false);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-black uppercase cursor-pointer ${
                  bballMode === 'free'
                    ? 'bg-emerald-400 text-black'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Free Play (1:00)
              </button>
              <button
                type="button"
                onClick={() => {
                  setBballMode('tournament');
                  setTournamentRoundIdx(0);
                  setBballBracketResults([null, null, null, null]);
                  setShowSeasonModal(false);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-black uppercase cursor-pointer ${
                  bballMode === 'tournament'
                    ? 'bg-amber-400 text-black'
                    : 'bg-zinc-800 text-amber-300 hover:bg-zinc-700 border border-amber-400/30'
                }`}
              >
                🏆 16-Team 5v5 Tournament
              </button>
              <button
                type="button"
                onClick={() => {
                  const latest = getSportsSeason('basketball');
                  setBballSeason(latest);
                  setBballMode('season');
                  setShowBracketModal(false);
                  setShowSeasonModal(true);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-black uppercase cursor-pointer ${
                  bballMode === 'season'
                    ? 'bg-emerald-400 text-black'
                    : 'bg-zinc-800 text-emerald-300 hover:bg-zinc-700 border border-emerald-400/30'
                }`}
              >
                🏟️ Season &amp; Playoffs
              </button>
              {bballMode === 'tournament' && (
                <button
                  type="button"
                  onClick={() => setShowBracketModal((v) => !v)}
                  className="px-2.5 py-1 rounded text-[11px] font-black uppercase cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-sky-300 border border-sky-400/35"
                >
                  {showBracketModal ? '✕ Hide Bracket' : '📊 Bracket'}
                </button>
              )}
              {bballMode === 'season' && (
                <button
                  type="button"
                  onClick={() => {
                    setBballSeason(getSportsSeason('basketball'));
                    setShowSeasonModal((v) => !v);
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-black uppercase cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-sky-300 border border-sky-400/35"
                >
                  {showSeasonModal ? '✕ Hide Standings' : '📊 Seedings & Bracket'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-400 font-bold">
                  {bballSeason.positionLocked ? '🔒 POS:' : 'POS:'}
                </span>
                {BBALL_POSITIONS.map((pos) => {
                  const lockedHere = Boolean(bballSeason.positionLocked);
                  const activePosBar =
                    bballMode === 'season' && bballSeason.playerPosition ? bballSeason.playerPosition : bballPosition;
                  const isSel = activePosBar === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      disabled={lockedHere && !isSel}
                      title={
                        lockedHere
                          ? 'Position locked until season ends'
                          : `${BBALL_POSITION_PROFILES[pos].title} (Switching resets OVR to 66): ${BBALL_POSITION_PROFILES[pos].advantages[0]}`
                      }
                      onClick={() => {
                        if (lockedHere) return;
                        const updated = setBasketballSeasonPosition(pos, false);
                        setBballSeason(updated);
                        setBballPosition(updated.playerPosition || pos);
                      }}
                      className={`px-1.5 py-1 rounded text-[10px] font-black uppercase ${
                        isSel
                          ? 'bg-sky-400 text-black'
                          : lockedHere
                          ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer'
                      }`}
                    >
                      {pos}
                    </button>
                  );
                })}
                <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black">
                  OVR {bballSeason.myPlayer?.ovr ?? 66}/{bballSeason.myPlayer?.potential ?? 94}
                </span>
              </div>
              {bballMode === 'free' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    {(['half', 'full'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setBballCourtMode(m)}
                        className={`px-2 py-1 rounded text-[10px] font-black uppercase cursor-pointer ${
                          bballCourtMode === m
                            ? 'bg-sky-400 text-black'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {m === 'half' ? 'Half' : 'Full'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    {([1, 2, 3, 4, 5] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setBballTeamSize(sz)}
                        className={`px-2 py-1 rounded text-[10px] font-black cursor-pointer ${
                          bballTeamSize === sz
                            ? 'bg-emerald-400 text-black'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {sz}v{sz}
                      </button>
                    ))}
                  </div>
                </div>
              ) : bballMode === 'season' && activeSeasonMatchup ? (
                <div className="text-[11px] font-bold text-emerald-300">
                  S{bballSeason.seasonNumber} {activeSeasonMatchup.roundLabel} · Seed #{activeSeasonMatchup.playerSeed} vs #{activeSeasonMatchup.opponentSeed} {activeSeasonMatchup.opponentName}
                </div>
              ) : (
                <div className="text-[11px] font-bold text-amber-300">
                  Round {activeTourney.round}/{TOURNAMENT_ROUNDS.length}: {activeTourney.opponent} · Prize ${activeTourney.prize.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODE BAR: BASEBALL (Free Play vs Pro Championship Tournament) */}
        {venue.sport === 'baseball' && (
          <div className="px-4 py-2 bg-zinc-900/70 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setBaseballMode('free');
                  setShowBracketModal(false);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-black uppercase cursor-pointer ${
                  baseballMode === 'free'
                    ? 'bg-emerald-400 text-black'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Free Play (Pro)
              </button>
              <button
                type="button"
                onClick={() => {
                  setBaseballMode('tournament');
                  setBaseballRoundIdx(0);
                  setBaseballBracketResults([null, null, null]);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-black uppercase cursor-pointer ${
                  baseballMode === 'tournament'
                    ? 'bg-amber-400 text-black'
                    : 'bg-zinc-800 text-amber-300 hover:bg-zinc-700 border border-amber-400/30'
                }`}
              >
                🏆 Baseball Tournament
              </button>
              {baseballMode === 'tournament' && (
                <button
                  type="button"
                  onClick={() => setShowBracketModal((v) => !v)}
                  className="px-2.5 py-1 rounded text-[11px] font-black uppercase cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-sky-300 border border-sky-400/35"
                >
                  {showBracketModal ? '✕ Hide Bracket' : '📊 Bracket'}
                </button>
              )}
            </div>
            <div className="text-[11px] font-bold text-amber-300">
              {baseballMode === 'tournament'
                ? `Round ${activeBaseballTourney.round}/3: ${activeBaseballTourney.opponent} · Prize $${activeBaseballTourney.prize.toLocaleString()}`
                : '97 MPH Heat · Tight Zone · Double Plays Active'}
            </div>
          </div>
        )}

        {/* GOLF CLUB BAR */}
        {venue.sport === 'golf' && (
          <div className="px-4 py-1.5 bg-zinc-900/70 border-b border-white/10 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-zinc-400 mr-1">CLUB [↑/↓]:</span>
            {GOLF_CLUBS.map((cl, idx) => (
              <button
                key={cl.name}
                type="button"
                onClick={() => {
                  setGolfClubIdx(idx);
                  golfClubIdxRef.current = idx;
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-black cursor-pointer ${
                  golfClubIdx === idx
                    ? 'bg-emerald-400 text-black'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {cl.name}
              </button>
            ))}
          </div>
        )}

        {/* FOOTBALL MODE & PLAY CALL BAR */}
        {venue.sport === 'football' && (
          <div className="px-4 py-1.5 bg-zinc-900/70 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setFootballMode('free');
                  setShowBracketModal(false);
                  setShowSeasonModal(false);
                }}
                className={`px-2 py-1 rounded text-[10px] font-black uppercase cursor-pointer ${
                  footballMode === 'free'
                    ? 'bg-emerald-400 text-black'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Free Play
              </button>
              <button
                type="button"
                onClick={() => {
                  setFootballMode('tournament');
                  setFootballRoundIdx(0);
                  setFootballBracketResults([null, null, null]);
                  setShowSeasonModal(false);
                }}
                className={`px-2 py-1 rounded text-[10px] font-black uppercase cursor-pointer ${
                  footballMode === 'tournament'
                    ? 'bg-amber-400 text-black'
                    : 'bg-zinc-800 text-amber-300 hover:bg-zinc-700 border border-amber-400/30'
                }`}
              >
                🏆 Tournament
              </button>
              <button
                type="button"
                onClick={() => {
                  const latest = getSportsSeason('football');
                  setFootballSeason(latest);
                  setFootballMode('season');
                  setShowBracketModal(false);
                  setShowSeasonModal(true);
                }}
                className={`px-2 py-1 rounded text-[10px] font-black uppercase cursor-pointer ${
                  footballMode === 'season'
                    ? 'bg-emerald-400 text-black'
                    : 'bg-zinc-800 text-emerald-300 hover:bg-zinc-700 border border-emerald-400/30'
                }`}
              >
                🏟️ Season &amp; Playoffs
              </button>
              {footballMode === 'tournament' && (
                <button
                  type="button"
                  onClick={() => setShowBracketModal((v) => !v)}
                  className="px-2 py-1 rounded text-[10px] font-black uppercase cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-sky-300 border border-sky-400/35"
                >
                  {showBracketModal ? '✕ Hide' : '📊 Bracket'}
                </button>
              )}
              {footballMode === 'season' && (
                <button
                  type="button"
                  onClick={() => {
                    setFootballSeason(getSportsSeason('football'));
                    setShowSeasonModal((v) => !v);
                  }}
                  className="px-2 py-1 rounded text-[10px] font-black uppercase cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-sky-300 border border-sky-400/35"
                >
                  {showSeasonModal ? '✕ Hide' : '📊 Seedings & Bracket'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-400 font-bold">
                  {footballSeason.positionLocked ? '🔒 POS:' : 'POS:'}
                </span>
                {FB_POSITIONS.map((pos) => {
                  const lockedHere = Boolean(footballSeason.positionLocked);
                  const activeFbBar =
                    footballMode === 'season' && footballSeason.fbPlayerPosition
                      ? footballSeason.fbPlayerPosition
                      : fbPosition;
                  const isSel = activeFbBar === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      disabled={lockedHere && !isSel}
                      title={
                        lockedHere
                          ? 'Position locked until season ends'
                          : `${FB_POSITION_PROFILES[pos].title} (Switching resets OVR to 66): ${FB_POSITION_PROFILES[pos].advantages[0]}`
                      }
                      onClick={() => {
                        if (lockedHere) return;
                        const updated = setFootballSeasonPosition(pos, false);
                        setFootballSeason(updated);
                        setFbPosition(updated.fbPlayerPosition || pos);
                      }}
                      className={`px-1.5 py-1 rounded text-[10px] font-black uppercase ${
                        isSel
                          ? 'bg-sky-400 text-black'
                          : lockedHere
                          ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer'
                      }`}
                    >
                      {pos}
                    </button>
                  );
                })}
                <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black">
                  OVR {footballSeason.myPlayer?.ovr ?? 66}/{footballSeason.myPlayer?.potential ?? 94}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-black ${
                    fbSide === 'player'
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                      : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                  }`}
                >
                  {fbSide === 'player'
                    ? `OFF COACH: ${FOOTBALL_OFF_PLAYS.find((p) => p.id === footballCoachPlay)?.short || footballCoachPlay.toUpperCase()}`
                    : `DEF COACH: ${FOOTBALL_DEF_PLAYS.find((p) => p.id === footballCoachDefPlay)?.short || footballCoachDefPlay.toUpperCase()}`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPlaybookModal((v) => !v)}
                  className={`px-2.5 py-1 rounded text-[10px] font-black uppercase cursor-pointer border ${
                    showPlaybookModal
                      ? 'bg-amber-400 text-black border-amber-300'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border-amber-400/40'
                  }`}
                >
                  📋 {showPlaybookModal ? 'Hide Playbook' : fbSide === 'player' ? 'Offense Playbook (12)' : 'Defense Playbook (8)'}
                </button>
                <div className="flex flex-wrap items-center gap-1">
                  {fbSide === 'player'
                    ? FOOTBALL_OFF_PLAYS.slice(0, 6).map((pl) => (
                        <button
                          key={pl.id}
                          type="button"
                          title={pl.desc}
                          onClick={() => {
                            setFootballPlay(pl.id);
                            footballPlayRef.current = pl.id;
                          }}
                          className={`px-1.5 py-1 rounded text-[10px] font-black cursor-pointer ${
                            footballPlay === pl.id
                              ? 'bg-amber-400 text-black'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {pl.short}
                        </button>
                      ))
                    : FOOTBALL_DEF_PLAYS.slice(0, 5).map((pl) => (
                        <button
                          key={pl.id}
                          type="button"
                          title={pl.desc}
                          onClick={() => {
                            setFootballDefPlay(pl.id);
                            footballDefPlayRef.current = pl.id;
                          }}
                          className={`px-1.5 py-1 rounded text-[10px] font-black cursor-pointer ${
                            footballDefPlay === pl.id
                              ? 'bg-sky-400 text-black'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {pl.short}
                        </button>
                      ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SOCCER MODE BAR: 3v3 / 5v5 Free Play vs 5v5 Tournament */}
        {venue.sport === 'soccer' && (
          <div className="px-4 py-2 bg-zinc-900/70 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSoccerMode('free');
                  setShowBracketModal(false);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-black uppercase cursor-pointer ${
                  soccerMode === 'free'
                    ? 'bg-emerald-400 text-black'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Free Play
              </button>
              <button
                type="button"
                onClick={() => {
                  setSoccerMode('tournament');
                  setSoccerRoundIdx(0);
                  setSoccerBracketResults([null, null, null]);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-black uppercase cursor-pointer ${
                  soccerMode === 'tournament'
                    ? 'bg-amber-400 text-black'
                    : 'bg-zinc-800 text-amber-300 hover:bg-zinc-700 border border-amber-400/30'
                }`}
              >
                🏆 5v5 Soccer Tournament
              </button>
              {soccerMode === 'tournament' && (
                <button
                  type="button"
                  onClick={() => setShowBracketModal((v) => !v)}
                  className="px-2.5 py-1 rounded text-[11px] font-black uppercase cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-sky-300 border border-sky-400/35"
                >
                  {showBracketModal ? '✕ Hide Bracket' : '📊 Bracket'}
                </button>
              )}
            </div>

            {soccerMode === 'free' ? (
              <div className="flex items-center gap-1">
                {([3, 5] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSoccerTeamSize(sz)}
                    className={`px-2.5 py-1 rounded text-[10px] font-black cursor-pointer ${
                      soccerTeamSize === sz
                        ? 'bg-emerald-400 text-black'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {sz}v{sz}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-[11px] font-bold text-amber-300">
                Round {activeSoccerTourney.round}/3: {activeSoccerTourney.opponent} · Prize ${activeSoccerTourney.prize.toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* RETRO CANVAS STAGE + SUBTLE CRT SCANLINES (FULLSCREEN RESPONSIVE ASPECT) */}
        <div
          className="relative flex-1 min-h-0 w-full bg-black flex items-center justify-center overflow-hidden"
          style={{ containerType: 'size' }}
        >
          <div
            className="relative"
            style={{
              width: 'min(100cqw, calc(100cqh * 800 / 520))',
              height: 'min(100cqh, calc(100cqw * 520 / 800))',
            }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full h-full block cursor-crosshair"
              style={{ imageRendering: 'pixelated' }}
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0.45) 1px, transparent 1px, transparent 3px)',
              }}
            />
          </div>

          {/* STANDALONE SEASON STANDINGS & SEEDED PLAYOFFS MODAL */}
          {showSeasonModal && currentSeasonSport && activeSeasonState && !hud.finished && (
            <div className="absolute inset-0 bg-black/88 flex items-center justify-center p-4 overflow-y-auto z-10">
              <div className="w-full max-w-4xl flex flex-col gap-3">
                {renderSeasonHubPanel(currentSeasonSport, activeSeasonState)}
                <div className="flex justify-center gap-2">
                  {(activeSeasonState.phase === 'regular' || activeSeasonState.phase === 'playoffs') && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowSeasonModal(false);
                        setGameKey((k) => k + 1);
                      }}
                      className="px-5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-black cursor-pointer"
                    >
                      ▶ Play {activeSeasonMatchup?.roundLabel || 'Next Game'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowSeasonModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-black cursor-pointer border border-white/15"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MADDEN-STYLE EXPANDED OFFENSIVE & DEFENSIVE PLAYBOOK MODAL */}
          {venue.sport === 'football' && showPlaybookModal && !hud.finished && (
            <div className="absolute inset-0 bg-black/88 flex items-center justify-center p-4 overflow-y-auto z-10">
              <div className="w-full max-w-3xl rounded-2xl border border-amber-400/45 bg-zinc-950 p-4 shadow-2xl">
                <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-white/10">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                      {fbSide === 'player' ? '🏈 OFFENSIVE PLAYBOOK · 12 CONCEPTS' : '🛡️ DEFENSIVE PLAYBOOK · 8 SHELLS & BLITZES'}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {fbSide === 'player'
                        ? 'Pick any Quick Pass, Deep Route, PA/Screen, or Run — [←/→] also audibles pre-snap!'
                        : 'Select Zone, Man Coverage, or Blitz — CPU offensive routes stay hidden on defense!'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPlaybookModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-black text-zinc-200 cursor-pointer"
                  >
                    ✕ Back to Field
                  </button>
                </div>

                {fbSide === 'player' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FOOTBALL_OFF_PLAYS.map((pl) => {
                      const active = footballPlay === pl.id;
                      const isCoach = footballCoachPlay === pl.id;
                      return (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={() => {
                            setFootballPlay(pl.id);
                            footballPlayRef.current = pl.id;
                            setShowPlaybookModal(false);
                          }}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                            active
                              ? 'border-amber-400 bg-amber-400/15'
                              : 'border-white/15 bg-zinc-900/90 hover:border-white/35'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-black/60 text-sky-300">
                              {pl.category}
                            </span>
                            {isCoach && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                COACH PICK
                              </span>
                            )}
                          </div>
                          <div className={`text-xs font-black ${active ? 'text-amber-300' : 'text-white'}`}>
                            {pl.label}
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{pl.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {FOOTBALL_DEF_PLAYS.map((pl) => {
                      const active = footballDefPlay === pl.id;
                      const isCoach = footballCoachDefPlay === pl.id;
                      return (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={() => {
                            setFootballDefPlay(pl.id);
                            footballDefPlayRef.current = pl.id;
                            setShowPlaybookModal(false);
                          }}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                            active
                              ? 'border-sky-400 bg-sky-400/15'
                              : 'border-white/15 bg-zinc-900/90 hover:border-white/35'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded bg-black/60 ${
                                pl.category === 'BLITZ'
                                  ? 'text-rose-300'
                                  : pl.category === 'MAN'
                                  ? 'text-amber-300'
                                  : 'text-sky-300'
                              }`}
                            >
                              {pl.category}
                            </span>
                            {isCoach && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                COACH
                              </span>
                            )}
                          </div>
                          <div className={`text-xs font-black ${active ? 'text-sky-300' : 'text-white'}`}>
                            {pl.label}
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{pl.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STANDALONE BRACKET MODAL OVERLAY */}
          {showBracketModal && currentTourneySport && !hud.finished && (
            <div className="absolute inset-0 bg-black/88 flex items-center justify-center p-4 z-10">
              <div className="w-full max-w-2xl flex flex-col gap-3">
                {renderTournamentBracket(currentTourneySport)}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowBracketModal(false)}
                    className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black cursor-pointer"
                  >
                    ✕ Back to Match
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FINISH OVERLAY (INCLUDES FULL BRACKET & SEASON STANDINGS!) */}
          {hud.finished && (() => {
            const activeRoundNum =
              currentTourneySport === 'basketball'
                ? tournamentRoundIdx
                : currentTourneySport === 'baseball'
                ? baseballRoundIdx
                : currentTourneySport === 'football'
                ? footballRoundIdx
                : currentTourneySport === 'soccer'
                ? soccerRoundIdx
                : -1;
            const totalRounds = currentTourneySport === 'basketball' ? TOURNAMENT_ROUNDS.length : 3;
            const canAdvance =
              currentTourneySport !== null && hud.won && activeRoundNum >= 0 && activeRoundNum < totalRounds - 1;
            const wonChampionship =
              (currentTourneySport !== null && hud.won && activeRoundNum === totalRounds - 1) ||
              activeSeasonState?.phase === 'champion';

            const seasonPlayableNext =
              activeSeasonState &&
              (activeSeasonState.phase === 'regular' || activeSeasonState.phase === 'playoffs');

            return (
              <div className="absolute inset-0 bg-black/86 flex items-center justify-center p-3 overflow-y-auto z-20">
                <div
                  className={`bg-zinc-950 border-2 border-emerald-400 rounded-2xl p-5 w-full text-center shadow-2xl ${
                    isAnyTourneyActive ||
                    currentSeasonSport !== null ||
                    (venue.sport === 'basketball' && lastBballBoxScore.length > 0) ||
                    (venue.sport === 'football' && lastFbBoxScore.length > 0)
                      ? 'max-w-4xl'
                      : 'max-w-md'
                  }`}
                >
                  <div className="text-2xl mb-1">{venue.icon}</div>
                  <h3 className="text-lg font-black text-white mb-1">
                    {wonChampionship
                      ? '🏆 CHAMPIONSHIP TROPHY WON!!'
                      : canAdvance
                      ? `ROUND ${activeRoundNum + 1} VICTORY!`
                      : activeSeasonState?.phase === 'eliminated'
                      ? 'PLAYOFF RUN COMPLETE'
                      : activeSeasonState?.phase === 'missed_playoffs'
                      ? 'REGULAR SEASON COMPLETE'
                      : hud.won
                      ? 'MATCH VICTORY!'
                      : 'GAME COMPLETE!'}
                  </h3>
                  <p className="text-xs text-zinc-300 mb-2">{hud.summaryBanner}</p>
                  {hud.cashEarned > 0 && (
                    <div className="text-xl font-black text-emerald-400 mb-3">
                      +${hud.cashEarned.toLocaleString()}
                    </div>
                  )}

                  {lastMyPlayerGain && (
                    <div className="mb-3 rounded-xl border border-amber-400/45 bg-zinc-900/90 p-3 text-left">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-amber-400 text-black text-xs font-black">
                            GRADE {lastMyPlayerGain.grade}
                          </span>
                          <span className="text-xs font-black text-white">{lastMyPlayerGain.summary}</span>
                        </div>
                        <span className="text-[11px] font-black text-emerald-300">
                          +{lastMyPlayerGain.xpEarned} XP
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden mb-2">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-emerald-400"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(((lastMyPlayerGain.ovrAfter - 60) / Math.max(1, lastMyPlayerGain.pot - 60)) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                      {lastMyPlayerGain.statUps.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {lastMyPlayerGain.statUps.map((u) => (
                            <span
                              key={u.label}
                              className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[10px] font-black"
                            >
                              {u.label} +{u.delta} → {u.newVal}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {venue.sport === 'basketball' && lastBballBoxScore.length > 0 && (
                    <div className="mb-4 rounded-xl border border-white/15 bg-zinc-900/80 p-2.5 text-left">
                      <div className="text-[10px] font-black text-sky-300 uppercase tracking-wider mb-1.5">
                        🏀 Match Box Score
                      </div>
                      <div className="overflow-x-auto max-h-40 overflow-y-auto">
                        <table className="w-full text-[10px] font-mono tabular-nums">
                          <thead>
                            <tr className="text-zinc-500 border-b border-white/10">
                              <th className="py-0.5 pr-2 text-left">POS</th>
                              <th className="py-0.5 pr-2 text-left">PLAYER</th>
                              <th className="py-0.5 px-1 text-right">PTS</th>
                              <th className="py-0.5 px-1 text-right">REB</th>
                              <th className="py-0.5 px-1 text-right">AST</th>
                              <th className="py-0.5 px-1 text-right">STL</th>
                              <th className="py-0.5 px-1 text-right">BLK</th>
                              <th className="py-0.5 px-1 text-right">FG</th>
                              <th className="py-0.5 pl-1 text-right">3PT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lastBballBoxScore.map((row) => (
                              <tr
                                key={row.id}
                                className={`border-b border-white/5 ${
                                  row.isUser
                                    ? 'bg-emerald-500/20 text-emerald-200 font-black'
                                    : row.team === 'player'
                                    ? 'text-sky-200'
                                    : 'text-rose-200/90'
                                }`}
                              >
                                <td className="py-0.5 pr-2 font-black">{row.pos}</td>
                                <td className="py-0.5 pr-2 truncate max-w-[140px]">
                                  {row.team === 'cpu' ? '[CPU] ' : ''}{row.name}
                                </td>
                                <td className="py-0.5 px-1 text-right font-bold">{row.pts}</td>
                                <td className="py-0.5 px-1 text-right">{row.reb}</td>
                                <td className="py-0.5 px-1 text-right">{row.ast}</td>
                                <td className="py-0.5 px-1 text-right">{row.stl}</td>
                                <td className="py-0.5 px-1 text-right">{row.blk}</td>
                                <td className="py-0.5 px-1 text-right">{row.fgm}-{row.fga}</td>
                                <td className="py-0.5 pl-1 text-right">{row.tpm}-{row.tpa}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {venue.sport === 'football' && lastFbBoxScore.length > 0 && (
                    <div className="mb-4 rounded-xl border border-white/15 bg-zinc-900/80 p-2.5 text-left">
                      <div className="text-[10px] font-black text-sky-300 uppercase tracking-wider mb-1.5">
                        🏈 Match Box Score
                      </div>
                      <div className="overflow-x-auto max-h-40 overflow-y-auto">
                        <table className="w-full text-[10px] font-mono tabular-nums">
                          <thead>
                            <tr className="text-zinc-500 border-b border-white/10">
                              <th className="py-0.5 pr-2 text-left">POS</th>
                              <th className="py-0.5 pr-2 text-left">PLAYER</th>
                              <th className="py-0.5 px-1 text-right">PASS</th>
                              <th className="py-0.5 px-1 text-right">RUSH</th>
                              <th className="py-0.5 px-1 text-right">REC</th>
                              <th className="py-0.5 px-1 text-right">TD</th>
                              <th className="py-0.5 px-1 text-right">TKL</th>
                              <th className="py-0.5 pl-1 text-right">INT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lastFbBoxScore.map((row) => (
                              <tr
                                key={row.id}
                                className={`border-b border-white/5 ${
                                  row.isUser
                                    ? 'bg-emerald-500/20 text-emerald-200 font-black'
                                    : row.team === 'player'
                                    ? 'text-sky-200'
                                    : 'text-rose-200/90'
                                }`}
                              >
                                <td className="py-0.5 pr-2 font-black">{row.pos}</td>
                                <td className="py-0.5 pr-2 truncate max-w-[140px]">
                                  {row.team === 'cpu' ? '[CPU] ' : ''}{row.name}
                                </td>
                                <td className="py-0.5 px-1 text-right">{row.passYds > 0 ? `${row.passYds}y` : '-'}</td>
                                <td className="py-0.5 px-1 text-right">{row.rushYds > 0 ? `${row.rushYds}y` : '-'}</td>
                                <td className="py-0.5 px-1 text-right">{row.rec > 0 ? `${row.rec}/${row.recYds}y` : '-'}</td>
                                <td className="py-0.5 px-1 text-right font-bold">{row.passTd + row.rushTd + row.recTd}</td>
                                <td className="py-0.5 px-1 text-right">{row.tackles}</td>
                                <td className="py-0.5 pl-1 text-right">{row.defInt}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {currentTourneySport && (
                    <div className="mb-4">{renderTournamentBracket(currentTourneySport)}</div>
                  )}

                  {currentSeasonSport && activeSeasonState && (
                    <div className="mb-4">{renderSeasonHubPanel(currentSeasonSport, activeSeasonState)}</div>
                  )}

                  <div className="flex flex-wrap gap-2 justify-center">
                    {canAdvance ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (currentTourneySport === 'basketball') {
                            setTournamentRoundIdx((r) => Math.min(TOURNAMENT_ROUNDS.length - 1, r + 1));
                          } else if (currentTourneySport === 'baseball') {
                            setBaseballRoundIdx((r) => Math.min(2, r + 1));
                          } else if (currentTourneySport === 'football') {
                            setFootballRoundIdx((r) => Math.min(2, r + 1));
                          } else if (currentTourneySport === 'soccer') {
                            setSoccerRoundIdx((r) => Math.min(2, r + 1));
                          }
                          setGameKey((k) => k + 1);
                        }}
                        className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black cursor-pointer"
                      >
                        🏆 Advance to Round {activeRoundNum + 2} →
                      </button>
                    ) : currentSeasonSport && seasonPlayableNext ? (
                      <button
                        type="button"
                        onClick={() => {
                          setGameKey((k) => k + 1);
                        }}
                        className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black cursor-pointer"
                      >
                        ▶ Play {activeSeasonMatchup?.roundLabel || 'Next Game'} →
                      </button>
                    ) : currentSeasonSport ? (
                      <button
                        type="button"
                        onClick={() => {
                          const next = startNextSportsSeason(currentSeasonSport);
                          if (currentSeasonSport === 'basketball') {
                            setBballSeason(next);
                            setBballPosition(next.playerPosition || 'PG');
                          } else {
                            setFootballSeason(next);
                            setFbPosition(next.fbPlayerPosition || 'QB');
                          }
                          setGameKey((k) => k + 1);
                        }}
                        className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black cursor-pointer"
                      >
                        ↻ Start Season #{(activeSeasonState?.seasonNumber || 1) + 1}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (currentTourneySport === 'basketball') {
                            setTournamentRoundIdx(0);
                            setBballBracketResults([null, null, null, null]);
                          } else if (currentTourneySport === 'baseball') {
                            setBaseballRoundIdx(0);
                            setBaseballBracketResults([null, null, null]);
                          } else if (currentTourneySport === 'football') {
                            setFootballRoundIdx(0);
                            setFootballBracketResults([null, null, null]);
                          } else if (currentTourneySport === 'soccer') {
                            setSoccerRoundIdx(0);
                            setSoccerBracketResults([null, null, null]);
                          }
                          setGameKey((k) => k + 1);
                        }}
                        className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black cursor-pointer border border-white/15"
                      >
                        ↻ {currentTourneySport ? 'New Bracket' : 'Play Again'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCompleteRef.current(hud.cashEarned, hud.summaryBanner)}
                      className="px-5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-black cursor-pointer"
                    >
                      💰 Collect Cash &amp; Return
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* BOTTOM STATUS & TOUCH/CLICK ACTION BAR */}
        <div className="px-4 py-2.5 bg-zinc-900 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-bold text-amber-300 truncate">{hud.statusLine}</div>
            <div className="text-[10px] text-zinc-400 truncate">{hud.actionHint}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-white/10 text-zinc-300 font-bold text-[11px]">
              [← ↑ ↓ →] MOVE / AIM
            </span>
            {venue.sport === 'football' && (
              <span className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black text-[11px]">
                [1] WR1 · [2] WR2 · [3] RB
              </span>
            )}
            {venue.sport === 'basketball' && (
              <button
                type="button"
                onClick={() => {
                  virtualScreenPulseRef.current = true;
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-black text-xs cursor-pointer"
              >
                [Q] SCREEN
              </button>
            )}
            {(venue.sport === 'basketball' ||
              venue.sport === 'soccer' ||
              venue.sport === 'football' ||
              venue.sport === 'baseball') && (
              <button
                type="button"
                onClick={() => {
                  virtualPassPulseRef.current = true;
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-black text-xs cursor-pointer"
              >
                {venue.sport === 'baseball' ? '[E] STEAL' : '[E] PASS'}
              </button>
            )}
            <button
              type="button"
              onMouseDown={() => {
                virtualActionHeldRef.current = true;
                virtualActionPulseRef.current = true;
              }}
              onMouseUp={() => {
                virtualActionHeldRef.current = false;
                keysRef.current.delete('Space');
                window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
              }}
              onTouchStart={() => {
                virtualActionHeldRef.current = true;
                virtualActionPulseRef.current = true;
              }}
              onTouchEnd={() => {
                virtualActionHeldRef.current = false;
                window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
              }}
              className="px-4 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs cursor-pointer"
            >
              [SPACE] ACTION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
