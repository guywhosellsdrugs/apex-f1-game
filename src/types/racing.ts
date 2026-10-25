export type TireCompound = 'SOFT' | 'MEDIUM' | 'HARD';

export interface Driver {
  id: string;
  name: string;
  shortName: string; // e.g., 'VER', 'HAM', 'LEC', 'YOU'
  number: number;
  country: string;
  countryCode: string;
  teamId: string;
  rating: number; // Uncapped (can exceed 100)
  aggression: number; // 0.1 - 1.0
  color: string;
  contractExpiring?: boolean;
  willingToJoinCustomTeam?: boolean;
  salaryPerRaceDemand?: number;
  obedienceRating?: number; // 0 - 100: How faithfully the driver executes team orders (block / yield)
}

export interface TeamCarProfile {
  topSpeedRating: number; // Uncapped (can exceed 100)
  handlingRating: number; // Uncapped (can exceed 100)
  aeroDownforce: number; // Uncapped (can exceed 100)
  acceleration: number; // Uncapped (can exceed 100)
  brakesRating?: number; // Uncapped (can exceed 100)
  strengths: string[];
  weaknesses: string[];
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  engine: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  performanceTier: number; // 1 (Top) - 4 (Backmarker)
  drivers: [string, string]; // Driver IDs
  reputationRequired: number; // 0 - 100%
  baseSalary: number; // USD per race
  carProfile?: TeamCarProfile;
}

export interface EngineOption {
  id: string;
  name: string;
  supplier: string;
  purchaseCost: number; // USD
  costPerRace: number; // USD
  topSpeedKmh: number;
  powerRating: number; // Uncapped (can exceed 100)
  reliabilityRating: number;
  isWorksCustom?: boolean;
  description: string;
}

export interface AeroStaffOption {
  id: string;
  title: string;
  name: string;
  hiringFee: number;
  salaryPerRace: number;
  downforceBonus: number; // 0.05 to 0.28
  handlingBonus: number;
  dragReduction: number; // 0.05 to 0.20
  description: string;
}

export interface ChassisEngineerOption {
  id: string;
  title: string;
  name: string;
  hiringFee: number;
  salaryPerRace: number;
  handlingBonus: number; // 5 to 25
  mechanicalGripBonus: number;
  description: string;
}

export interface BrakeEngineerOption {
  id: string;
  title: string;
  name: string;
  hiringFee: number;
  salaryPerRace: number;
  brakesBonus: number; // 5 to 25
  heatResistance: number;
  description: string;
}

export interface EngineEngineerOption {
  id: string;
  title: string;
  name: string;
  hiringFee: number;
  salaryPerRace: number;
  successBonus: number; // % bonus to build success
  failureReduction: number; // % reduction in building worse engine
  powerGainBonus: number; // extra power rating when successful
  description: string;
}

export interface EngineScientistOption {
  id: string;
  title: string;
  name: string;
  hiringFee: number;
  salaryPerRace: number;
  successBonus: number; // % bonus to build success
  failureReduction: number; // % reduction in building worse engine
  powerCeilingBonus: number; // unlocks higher max power
  description: string;
}

export interface EngineDynoResult {
  outcome: 'breakthrough' | 'upgrade' | 'neutral' | 'downgrade';
  prevPower: number;
  newPower: number;
  powerDelta: number;
  message: string;
  timestamp: number;
}

export interface SponsorOption {
  id: string;
  name: string;
  tier: 'Major' | 'Premium' | 'Title';
  basePayPerRace: number;
  winBonus: number;
  podiumBonus: number;
  pointsBonus: number;
  requiredReputation: number;
  description: string;
}

export interface TrackPoint {
  x: number;
  y: number;
  z: number;
  width?: number;
  curbLeft?: boolean;
  curbRight?: boolean;
}

export interface CircuitInfo {
  id: string;
  name: string;
  location: string;
  country: string;
  countryCode: string;
  lengthKm: number;
  turns: number;
  lapRecord: string;
  recordHolder: string;
  description: string;
  skyColor: number;
  fogColor: number;
  ambientLight: number;
  timeOfDay: 'day' | 'sunset' | 'twilight';
  trackPoints: TrackPoint[];
}

export interface CustomTeamConfig {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  engine: string;
  engineId?: string;
  enginePower?: number;
  engineTopSpeed?: number;
  isWorksEngine?: boolean;
  engineCostPerRace?: number;
  teammateDriverId: string;
  teammateSalaryPerRace?: number;
  factoryLevel: number; // 1 - 5
  aeroStaffId?: string;
  aeroDownforceBonus?: number;
  handlingBonus?: number;
  aeroStaffSalary?: number;
  chassisEngineerId?: string;
  chassisEngineerSalary?: number;
  brakesEngineerId?: string;
  brakesEngineerSalary?: number;
  brakesBonus?: number;
  engineEngineerId?: string;
  engineEngineerSalary?: number;
  engineScientistId?: string;
  engineScientistSalary?: number;
  engineDevelopmentAttempts?: number;
  lastDynoResult?: EngineDynoResult;
  sponsorId?: string;
  sponsorBasePerRace?: number;
  sponsorWinBonus?: number;
  sponsorPodiumBonus?: number;
  sponsorPointsBonus?: number;
  logisticsCostPerRace?: number;
  hospitalityCostPerRace?: number;
  maintenanceCostPerRace?: number;
  baseSponsorPerRace?: number;
  customerTeamsSupplied?: string[]; // IDs of customer grid teams using player's engine
  customerSupplyRevenuePerRace?: number; // Total lease revenue received per race from customer teams
  customerContractSeasons?: Record<string, number>; // Maps teamId -> seasonNumber when signed (1 season commitment)
  engineReliability?: number; // 75 - 100% component reliability to withstand light taps without engine stall
}

export interface CustomerTeamPUOffer {
  teamId: string;
  teamName: string;
  minPowerRequired: number;
  feePerRace: number;
  signingBonus: number; // Upfront manufacturer fee paid immediately to constructor bank
  description: string;
}

export interface SeasonHistoryEntry {
  seasonNumber: number;
  year: number;
  teamName: string;
  finalDriverRank: number;
  driverPoints: number;
  constructorRank: number;
  constructorPoints: number;
  wins: number;
  podiums: number;
  isWorldChampion: boolean;
  isConstructorsChampion: boolean;
  totalEarnings: number;
}

export interface NewsWriterStaff {
  id: string;
  name: string;
  role: string;
  specialty: 'race_result' | 'championship' | 'transfer' | 'technical' | 'prediction';
  hiringFee: number;
  salaryPerReport: number;
  accuracyRating: number; // 45 - 96
  writingRating: number; // 50 - 96
  bio: string;
}

export interface NewsPricingManager {
  id: string;
  name: string;
  role: string;
  hiringFee: number;
  salaryPerReport: number;
  elasticityProtection: number; // 0.15 to 0.55 — reduces subscriber churn at high prices
  conversionBonus: number; // 0.10 to 0.35 — boosts subscriber growth
  bio: string;
}

export interface PublishedNewsReport {
  id: string;
  title: string;
  content: string;
  category: 'race_result' | 'championship' | 'transfer' | 'technical' | 'prediction';
  roundPublished: number;
  timestamp: number;
  authorName?: string;
  wasEditedByPlayer?: boolean;
  accuracyScore: number; // 0 - 100
  qualityScore: number; // 0 - 100
  reasoningScore?: number; // 0 - 100
  overallScore: number; // 0 - 100
  verdict: 'verified_scoop' | 'solid_report' | 'mediocre' | 'inaccurate_flop';
  verdictLabel: string;
  factCheckNotes: string[];
  readerReaction: string;
  views: number;
  subscriptionPriceUsed?: number;
  revenueEarned: number; // Can be negative when operating costs/retractions/refunds exceed reader income!
  operatingCost?: number;
  subscriberDelta: number;
  credibilityDelta: number;
  isPrediction?: boolean;
  predictedDriverId?: string;
  predictedDriverName?: string;
  predictionType?: 'win' | 'podium' | 'top5';
  predictionTargetRound?: number;
  predictionTargetCircuitName?: string;
  predictionStatus?: 'pending' | 'correct' | 'incorrect';
  predictionSubscriberShift?: number;
}

export interface NewsCompanyConfig {
  id: string;
  name: string;
  badgeCode: string;
  editorialFocus: 'investigative' | 'technical' | 'insider';
  foundedRound: number;
  credibility: number; // 0 - 100%
  subscribers: number;
  subscriptionPrice?: number; // $1 to $50 per subscriber
  pricingManager?: NewsPricingManager | null;
  autoOptimizePrice?: boolean;
  totalRevenue: number; // Net profit/loss across all reports
  hiredWriters?: NewsWriterStaff[];
  publishedReports: PublishedNewsReport[];
}

export interface CareerProfile {
  driverName: string;
  driverNumber: number;
  country: string;
  countryCode: string;
  driverRating: number; // Uncapped (can exceed 100)
  reputation: number; // 0 - 100%
  careerEarnings: number; // Bank balance in USD $
  currentSalary: number; // per race salary
  wins: number;
  podiums: number;
  fastestLaps: number;
  racesDriven: number;
  championships: number;
  constructorsChampionships?: number;
  customTeam: CustomTeamConfig | null;
  newsCompany?: NewsCompanyConfig | null;
  seasonTransfersCount: number; // count of mid-season seat changes
  seasonNumber: number; // Season 1, Season 2, etc.
  seasonHistory: SeasonHistoryEntry[];
  difficultyLocked?: 'rookie' | 'pro' | 'legend';
}

export interface TeamContractOffer {
  teamId: string;
  minRating: number;
  minPoints: number;
  minWins: number;
  minPodiums: number;
  salaryPerRace: number; // USD
  signingBonus: number; // USD
  midSeasonBuyoutFee: number; // Fee deducted from bank to break contract mid-season
  prestigeTier: 'Rookie' | 'Midfield' | 'Contender' | 'Championship';
  teamExpectation: string;
}

export interface RaceResult {
  round: number;
  circuitId: string;
  circuitName: string;
  winnerDriverId: string;
  podiumDriverIds: string[];
  podiumGaps?: { id: string; name: string; position: number; gapSeconds: number; gapToPlayer: number }[];
  p1LeadSeconds?: number;
  playerGapToLeaderSeconds?: number;
  playerFinishedPosition: number;
  startingGridPosition?: number;
  positionsGained?: number;
  teammateFinishedPosition?: number;
  teammateOwnerBonus?: number;
  teammateOwnerBonusDesc?: string;
  fastestLapDriverId: string;
  fastestLapTime: number;
  driverPointsAwarded: Record<string, number>;
  constructorPointsSnapshot?: Record<string, number>;
  prizeMoneyAwarded: number;
  lapsCompleted: number;
  highlights?: {
    overtakes: string[];
    fastestLaps: string[];
    incidents: string[];
    narrative: string;
  };
}

export interface SeasonState {
  currentRound: number; // 0 to circuits.length - 1
  selectedTeamId: string;
  selectedDriverId: string;
  lapCount: number; // 3 to 10 laps
  difficulty: 'rookie' | 'pro' | 'legend';
  driverPoints: Record<string, number>; // driverId -> points
  constructorPoints: Record<string, number>; // teamId -> points
  completedRounds: RaceResult[];
  seasonFinished: boolean;
  career: CareerProfile;
}

export interface CarRadarPoint {
  progress: number;
  lateralOffset: number;
  color: string;
  isPlayer: boolean;
  shortName: string;
  position: number;
  isTeammate?: boolean;
  driverName?: string;
  driverId?: string;
  gapToLeaderSeconds?: number;
  gapToAheadSeconds?: number;
  gapToPlayerSeconds?: number;
  leadOverP2Seconds?: number;
}

export interface TelemetryData {
  speedKmh: number;
  gear: number;
  rpm: number;
  maxRpm: number;
  throttle: number; // 0 - 1
  brake: number; // 0 - 1
  steer: number; // -1 to 1
  ersBattery: number; // 0 - 100%
  drsActive: boolean;
  drsAvailable: boolean;
  tireWear: number; // 0 (fresh) - 100% (worn)
  tireTemp: number; // degrees Celsius (80 - 120)
  tireCompound: TireCompound;
  currentLap: number;
  totalLaps: number;
  lapTimeCurrent: number;
  lapTimeBest: number | null;
  lastLapTime: number | null;
  deltaToLeader: number; // seconds
  position: number;
  trackProgress: number; // 0 - 1
  offTrack: boolean;
  onCurb: boolean;
  carsRadar: CarRadarPoint[];
  crashWaitTimer?: number;
  crashWaitMax?: number;
  crashWaitMode?: 'rookie' | 'pro' | 'legend';
  engineReliability?: number;
  lapCurrent?: number;
  lateralOffset?: number;
  protectionShieldTimer?: number;
  slipstreamActive?: boolean;
  slipstreamFactor?: number;
  wrongWayWarning?: boolean;
  wrongWayTimer?: number;
  p1LeadSeconds?: number;
  teammateShortName?: string;
  teammateDriverName?: string;
  teammatePosition?: number;
  teammateGapSeconds?: number;
  teammateObedience?: number;
  teammateCurrentOrder?: 'neutral' | 'block' | 'yield' | 'push';
  teammateRadioMessage?: string;
  teammateRadioSpeaker?: string;
  teammateRadioStatus?: 'accepted' | 'refused' | 'idle';
  teammateDistanceMeters?: number;
  leaderShortName?: string;
  leaderDriverName?: string;
  carAheadShortName?: string;
  carAheadGapSeconds?: number;
  carBehindShortName?: string;
  carBehindGapSeconds?: number;
  top3Drivers?: { position: number; shortName: string; teamColor: string; gapSeconds: number }[];
}

export interface ControllerState {
  connected: boolean;
  id: string;
  throttle: number; // 0 - 1
  brake: number; // 0 - 1
  steer: number; // -1 to 1
  boost: boolean;
  switchCamera: boolean;
  reset: boolean;
  pause: boolean;
}

export type CameraView = 'chase' | 'close' | 'cockpit' | 'nose' | 'tv';
