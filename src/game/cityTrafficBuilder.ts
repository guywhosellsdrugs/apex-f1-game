import * as THREE from 'three';
import { BuiltCar } from './carBuilder';
import {
  MarylandRoadSpec,
  GaithersburgRoadSpec,
  GAITH_DX,
  GAITH_DZ,
  gx,
  gz,
  CITY_STREET_WIDTH,
  CITY_STREET_HALF_WIDTH,
  CITY_LANE_OFFSET,
  ICM_CAMPUS_ORIGIN,
  REDEEMER_CAMPUS_ORIGIN,
  ISB_CAMPUS_ORIGIN,
  ICM_PLAYER_SPAWN,
  MD_LANDMARKS,
  GAITHERSBURG_ARTERY_ROADS,
  GAITHERSBURG_NEIGHBORHOOD_ROADS,
  STATEWIDE_MARYLAND_ROADS,
  ALL_MARYLAND_ROADS,
  GAITHERSBURG_SIGNAL_JUNCTIONS,
  MARYLAND_SIGNAL_JUNCTIONS,
  getMarylandZoneAndSpeedAt,
  buildPitchedRoofGroup,
} from './marylandRoadNetwork';

export type { MarylandRoadSpec, GaithersburgRoadSpec };
export {
  GAITH_DX,
  GAITH_DZ,
  gx,
  gz,
  CITY_STREET_WIDTH,
  CITY_STREET_HALF_WIDTH,
  CITY_LANE_OFFSET,
  ICM_CAMPUS_ORIGIN,
  REDEEMER_CAMPUS_ORIGIN,
  ISB_CAMPUS_ORIGIN,
  ICM_PLAYER_SPAWN,
  MD_LANDMARKS,
  GAITHERSBURG_ARTERY_ROADS,
  GAITHERSBURG_NEIGHBORHOOD_ROADS,
  STATEWIDE_MARYLAND_ROADS,
  ALL_MARYLAND_ROADS,
  GAITHERSBURG_SIGNAL_JUNCTIONS,
  MARYLAND_SIGNAL_JUNCTIONS,
  getMarylandZoneAndSpeedAt,
  buildPitchedRoofGroup,
};

export type TrafficLightColor = 'GREEN' | 'YELLOW' | 'RED';

export interface IntersectionSignalState {
  ns: TrafficLightColor;
  ew: TrafficLightColor;
  nsRemainingSec: number;
  ewRemainingSec: number;
}

export interface CityBuildingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height?: number;
  name?: string;
}

export interface CityTrafficLightGantry {
  ix: number;
  iz: number;
  nsBulbs: {
    red: THREE.MeshBasicMaterial;
    yellow: THREE.MeshBasicMaterial;
    green: THREE.MeshBasicMaterial;
  };
  ewBulbs: {
    red: THREE.MeshBasicMaterial;
    yellow: THREE.MeshBasicMaterial;
    green: THREE.MeshBasicMaterial;
  };
}

export type CivilianCrimeType =
  | 'none'
  | 'speeding'
  | 'red_light'
  | 'hit_and_run'
  | 'bank_robber'
  | 'wanted_felon';

export interface BuiltCivilianCar {
  root: THREE.Group;
  setBraking: (braking: boolean) => void;
  setTurnSignals?: (left: boolean, right: boolean, hazards: boolean, timeSec: number) => void;
  setWheelSpin: (speedKmh: number, dt: number) => void;
  setFleeingBeacon?: (active: boolean, pulseTime: number) => void;
}

export interface BuiltPoliceCar {
  root: THREE.Group;
  setSirenActive: (active: boolean, timeSec: number) => void;
  setSteerAngle: (angle: number) => void;
  setWheelSpin: (speedKmh: number, dt: number) => void;
}

export interface CivilianCarEntity {
  id: string;
  built: BuiltCivilianCar;
  pos: THREE.Vector3;
  heading: number;
  speedKmh: number;
  cruiseSpeedKmh: number;
  axis: 'ns' | 'ew';
  dir: 1 | -1; // +1 = +Z or +X, -1 = -Z or -X
  lineCoord: number; // Which avenue (X) or boulevard (Z) it's currently on
  laneOffset: number;
  hitCooldown: number;
  spinTimer: number;
  hitVelX: number;
  hitVelZ: number;
  // Dynamic Real-World Crime, Radar Speed Gun & Suburb Fleeing System
  modelName: string;
  licensePlate: string;
  colorName: string;
  crimeType: CivilianCrimeType;
  crimeDesc?: string;
  hasActiveWarrant: boolean;
  warrantReason?: string;
  clockedSpeedMph?: number;
  redLightRunWitnessed?: boolean;
  isFleeingFromOtherCop?: boolean;
  isFleeing?: boolean;
  isStopped?: boolean;
  hidingInHouseAddress?: string;
  fleeingToHouse?: any;
  leftSignalActive?: boolean;
  rightSignalActive?: boolean;
  hazardActive?: boolean;
  isFleeingHitAndRun?: boolean;
  fleeTimer?: number;
  distractedTimer?: number;
  // Diverse driver personalities & pull-over compliance
  personality?: 'law_abiding' | 'casual_speeder' | 'reckless_speeder' | 'felon';
  pulloverRefused?: boolean;
  isPullingOver?: boolean;
  disableDamage?: number;
  resumeDriveDelay?: number;
  jukeTimer?: number;
  jukeOffset?: number;
  weave?: number;
  turnCooldown?: number;
  escapedToSafehouse?: boolean;
  pulloverAccepted?: boolean;
  region?: 'baltimore' | 'gaithersburg' | 'corridor';
  routePoints?: { x: number; z: number }[];
  routeSegIdx?: number;
  routeSegProgress?: number;
  routeDir?: 1 | -1;
}

export interface PoliceCarEntity {
  id: string;
  built: BuiltPoliceCar;
  pos: THREE.Vector3;
  heading: number;
  speedKmh: number;
  patrolAxis: 'ns' | 'ew';
  patrolDir: 1 | -1;
  patrolLineCoord: number;
  hitCooldown: number;
  stuckTimer: number;
  isChasing?: boolean;
  routePoints?: { x: number; z: number }[];
  routeSegIdx?: number;
  routeSegProgress?: number;
  routeDir?: 1 | -1;
}

export type StreetCarBodyStyle =
  | 'hatchback'
  | 'tuner_coupe'
  | 'muscle_v8'
  | 'armored_suv'
  | 'supercar_wedge'
  | 'hypercar_gt'
  | 'f1_street';

export type StreetCarModelArchetype =
  | 'honda_civic'
  | 'toyota_camry'
  | 'chevy_camaro'
  | 'toyota_supra_mk5'
  | 'dodge_challenger'
  | 'dodge_charger'
  | 'bmw_m4'
  | 'cadillac_escalade'
  | 'toyota_supra_mk4'
  | 'nissan_gtr_r35'
  | 'porsche_911'
  | 'cadillac_escalade_v'
  | 'nissan_gtr_r34'
  | 'lamborghini_huracan'
  | 'nissan_gtr_r34_ztune'
  | 'mcmurtry_speirling'
  | 'rimac_nevera'
  | 'koenigsegg_regera'
  | 'koenigsegg_agera_rs'
  | 'bugatti_chiron_pur_sport'
  | 'bugatti_chiron_super_sport'
  | 'koenigsegg_jesko';

export interface StreetCarTrimSpec {
  id: string;
  name: string;
  upgradePrice: number; // $0 for base trim
  horsepower: number;
  zeroToSixtySec: number;
  topSpeedKmh: number;
  drivetrain: 'FWD' | 'RWD' | 'AWD';
  groundClearance?: 'low' | 'medium' | 'high';
  engineLayout: string;
  accelerationScore: number;
  handlingScore: number;
  brakesScore: number;
  aeroStyle: 'stock' | 'sport_spoiler' | 'gt_wing' | 'widebody_gt' | 'absolut_fins' | 'fan_car';
  accentColorOverride?: string;
}

export interface StreetCarSpec {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  price: number;
  horsepower: number;
  zeroToSixtySec: number;
  topSpeedKmh: number;
  drivetrain: 'FWD' | 'RWD' | 'AWD';
  groundClearance?: 'low' | 'medium' | 'high';
  engineLayout: string;
  enginePowerRating: number;
  accelerationScore: number;
  handlingScore: number;
  brakesScore: number;
  defaultColor: string;
  accentColor: string;
  bodyStyle: StreetCarBodyStyle;
  modelArchetype: StreetCarModelArchetype;
  trims: StreetCarTrimSpec[];
  description: string;
}

export const CITY_STREET_CARS: StreetCarSpec[] = [
  {
    id: 'honda_civic',
    name: 'Honda Civic (11th Gen)',
    manufacturer: 'Honda',
    category: 'Starter Sport Compact',
    price: 0,
    horsepower: 158,
    zeroToSixtySec: 7.5,
    topSpeedKmh: 205,
    drivetrain: 'FWD',
    engineLayout: '2.0L DOHC i-VTEC I4',
    enginePowerRating: 75,
    accelerationScore: 76,
    handlingScore: 85,
    brakesScore: 83,
    defaultColor: '#f8fafc',
    accentColor: '#dc2626',
    bodyStyle: 'hatchback',
    modelArchetype: 'honda_civic',
    description:
      'Authentic 11th-generation Honda Civic fastback with slim LED headlights, wide honeycomb lower intake, and C-shaped taillights. Upgradeable all the way to the 315 HP Civic Type R (FL5) with pedestal GT wing and triple center exhaust!',
    trims: [
      {
        id: 'civic_lx',
        name: 'Civic LX Sedan',
        upgradePrice: 0,
        horsepower: 158,
        zeroToSixtySec: 7.5,
        topSpeedKmh: 205,
        drivetrain: 'FWD',
        engineLayout: '2.0L Naturally Aspirated i-VTEC I4',
        accelerationScore: 76,
        handlingScore: 85,
        brakesScore: 83,
        aeroStyle: 'stock',
      },
      {
        id: 'civic_si',
        name: 'Civic Si 1.5T',
        upgradePrice: 6500,
        horsepower: 200,
        zeroToSixtySec: 6.6,
        topSpeedKmh: 222,
        drivetrain: 'FWD',
        engineLayout: '1.5L VTEC Turbo I4 + Helical LSD',
        accelerationScore: 81,
        handlingScore: 89,
        brakesScore: 86,
        aeroStyle: 'sport_spoiler',
        accentColorOverride: '#18181b',
      },
      {
        id: 'civic_type_r',
        name: 'Civic Type R (FL5)',
        upgradePrice: 21500,
        horsepower: 315,
        zeroToSixtySec: 4.9,
        topSpeedKmh: 275,
        drivetrain: 'FWD',
        engineLayout: '2.0L K20C1 VTEC Turbo I4',
        accelerationScore: 88,
        handlingScore: 95,
        brakesScore: 93,
        aeroStyle: 'gt_wing',
        accentColorOverride: '#dc2626',
      },
    ],
  },
  {
    id: 'toyota_camry',
    name: 'Toyota Camry (XV70)',
    manufacturer: 'Toyota',
    category: 'Starter Sport Sedan',
    price: 0,
    horsepower: 203,
    zeroToSixtySec: 7.3,
    topSpeedKmh: 210,
    drivetrain: 'FWD',
    engineLayout: '2.5L Dynamic Force I4',
    enginePowerRating: 76,
    accelerationScore: 77,
    handlingScore: 84,
    brakesScore: 83,
    defaultColor: '#2563eb',
    accentColor: '#dc2626',
    bodyStyle: 'tuner_coupe',
    modelArchetype: 'toyota_camry',
    description:
      'Sharp XV70 Toyota Camry with wide trapezoidal sport grille, sculpted hood strakes, and LED light blades. Upgrade to the 301 HP 3.5L V6 XSE or track-tuned Camry TRD V6 with red-pinstriped aero kit and pedestal wing.',
    trims: [
      {
        id: 'camry_se',
        name: 'Camry SE 2.5L',
        upgradePrice: 0,
        horsepower: 203,
        zeroToSixtySec: 7.3,
        topSpeedKmh: 210,
        drivetrain: 'FWD',
        engineLayout: '2.5L Dynamic Force DOHC I4',
        accelerationScore: 77,
        handlingScore: 84,
        brakesScore: 83,
        aeroStyle: 'stock',
      },
      {
        id: 'camry_xse_v6',
        name: 'Camry XSE V6',
        upgradePrice: 6000,
        horsepower: 301,
        zeroToSixtySec: 5.8,
        topSpeedKmh: 235,
        drivetrain: 'FWD',
        engineLayout: '3.5L 2GR-FKS DOHC 24V V6',
        accelerationScore: 84,
        handlingScore: 88,
        brakesScore: 87,
        aeroStyle: 'sport_spoiler',
        accentColorOverride: '#090d16',
      },
      {
        id: 'camry_trd_v6',
        name: 'Camry TRD V6 Track',
        upgradePrice: 8500,
        horsepower: 301,
        zeroToSixtySec: 5.6,
        topSpeedKmh: 242,
        drivetrain: 'FWD',
        engineLayout: '3.5L V6 + TRD Cat-Back & Track Suspension',
        accelerationScore: 86,
        handlingScore: 91,
        brakesScore: 90,
        aeroStyle: 'gt_wing',
        accentColorOverride: '#ef4444',
      },
    ],
  },
  {
    id: 'chevy_camaro',
    name: 'Chevrolet Camaro',
    manufacturer: 'Chevrolet',
    category: 'American V8 Muscle',
    price: 42000,
    horsepower: 455,
    zeroToSixtySec: 4.0,
    topSpeedKmh: 266,
    drivetrain: 'RWD',
    engineLayout: '6.2L LT1 Naturally Aspirated V8',
    enginePowerRating: 86,
    accelerationScore: 87,
    handlingScore: 87,
    brakesScore: 88,
    defaultColor: '#facc15',
    accentColor: '#18181b',
    bodyStyle: 'muscle_v8',
    modelArchetype: 'chevy_camaro',
    description:
      'Low-slung Alpha-platform pony car with wide rear haunches and recessed V-grille. Upgradeable to the 650 HP supercharged ZL1 1LE with carbon dive planes and track wing.',
    trims: [
      {
        id: 'camaro_lt1',
        name: 'LT1 6.2L V8',
        upgradePrice: 0,
        horsepower: 455,
        zeroToSixtySec: 4.0,
        topSpeedKmh: 266,
        drivetrain: 'RWD',
        engineLayout: '6.2L LT1 Pushrod V8',
        accelerationScore: 87,
        handlingScore: 87,
        brakesScore: 88,
        aeroStyle: 'stock',
      },
      {
        id: 'camaro_ss_1le',
        name: 'SS 1LE Track Package',
        upgradePrice: 10000,
        horsepower: 455,
        zeroToSixtySec: 3.9,
        topSpeedKmh: 278,
        drivetrain: 'RWD',
        engineLayout: '6.2L LT1 V8 + Magnetic Ride & eLSD',
        accelerationScore: 88,
        handlingScore: 92,
        brakesScore: 92,
        aeroStyle: 'sport_spoiler',
        accentColorOverride: '#18181b',
      },
      {
        id: 'camaro_zl1',
        name: 'ZL1 Supercharged',
        upgradePrice: 30000,
        horsepower: 650,
        zeroToSixtySec: 3.5,
        topSpeedKmh: 318,
        drivetrain: 'RWD',
        engineLayout: '6.2L LT4 Supercharged V8',
        accelerationScore: 94,
        handlingScore: 93,
        brakesScore: 94,
        aeroStyle: 'sport_spoiler',
        accentColorOverride: '#dc2626',
      },
      {
        id: 'camaro_zl1_1le',
        name: 'ZL1 1LE Extreme Track',
        upgradePrice: 38000,
        horsepower: 650,
        zeroToSixtySec: 3.4,
        topSpeedKmh: 325,
        drivetrain: 'RWD',
        engineLayout: '6.2L LT4 Supercharged V8 + Multimatic DSSV',
        accelerationScore: 95,
        handlingScore: 97,
        brakesScore: 97,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#18181b',
      },
    ],
  },
  {
    id: 'toyota_supra_mk5',
    name: 'Toyota GR Supra Mk5 (A90)',
    manufacturer: 'Toyota',
    category: 'Modern JDM Turbo Coupe',
    price: 50000,
    horsepower: 255,
    zeroToSixtySec: 5.0,
    topSpeedKmh: 250,
    drivetrain: 'RWD',
    engineLayout: '2.0L Twin-Scroll Turbo I4',
    enginePowerRating: 85,
    accelerationScore: 85,
    handlingScore: 90,
    brakesScore: 89,
    defaultColor: '#ef4444',
    accentColor: '#18181b',
    bodyStyle: 'tuner_coupe',
    modelArchetype: 'toyota_supra_mk5',
    description:
      'Fifth-generation A90 GR Supra featuring a double-bubble roof, long clamshell hood, muscular rear fenders, and integrated ducktail arch. Upgrade to the 3.0L B58 inline-six, A91-CF Carbon Edition, or 540 HP GRMN Track spec.',
    trims: [
      {
        id: 'supra_mk5_20',
        name: 'GR Supra 2.0 Turbo',
        upgradePrice: 0,
        horsepower: 255,
        zeroToSixtySec: 5.0,
        topSpeedKmh: 250,
        drivetrain: 'RWD',
        engineLayout: '2.0L B48 Twin-Scroll Turbo I4',
        accelerationScore: 85,
        handlingScore: 90,
        brakesScore: 89,
        aeroStyle: 'stock',
      },
      {
        id: 'supra_mk5_30',
        name: 'GR Supra 3.0 Premium',
        upgradePrice: 8500,
        horsepower: 382,
        zeroToSixtySec: 3.9,
        topSpeedKmh: 266,
        drivetrain: 'RWD',
        engineLayout: '3.0L B58 Twin-Scroll Turbo Inline-6',
        accelerationScore: 90,
        handlingScore: 92,
        brakesScore: 92,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'supra_mk5_a91cf',
        name: 'A91-CF Carbon Edition',
        upgradePrice: 18000,
        horsepower: 382,
        zeroToSixtySec: 3.8,
        topSpeedKmh: 274,
        drivetrain: 'RWD',
        engineLayout: '3.0L B58 Turbo I6 + Carbon Aero Splitter',
        accelerationScore: 91,
        handlingScore: 94,
        brakesScore: 93,
        aeroStyle: 'gt_wing',
        accentColorOverride: '#18181b',
      },
      {
        id: 'supra_mk5_grmn',
        name: 'GRMN S58 Track Spec',
        upgradePrice: 32000,
        horsepower: 540,
        zeroToSixtySec: 3.3,
        topSpeedKmh: 302,
        drivetrain: 'RWD',
        engineLayout: '3.0L S58 Twin-Turbo Inline-6',
        accelerationScore: 95,
        handlingScore: 96,
        brakesScore: 96,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#dc2626',
      },
    ],
  },
  {
    id: 'dodge_challenger',
    name: 'Dodge Challenger SRT',
    manufacturer: 'Dodge',
    category: 'Widebody Muscle Legend',
    price: 52000,
    horsepower: 485,
    zeroToSixtySec: 4.2,
    topSpeedKmh: 282,
    drivetrain: 'RWD',
    engineLayout: '6.4L 392 HEMI V8',
    enginePowerRating: 88,
    accelerationScore: 88,
    handlingScore: 82,
    brakesScore: 86,
    defaultColor: '#dc2626',
    accentColor: '#18181b',
    bodyStyle: 'muscle_v8',
    modelArchetype: 'dodge_challenger',
    description:
      'Iconic widebody American muscle coupe with quad Air-Catcher halo headlights and functional hood scoop. Upgrade to the 797 HP Hellcat Redeye or 1,025 HP SRT Demon 170 drag monster (1.66s 0–60 mph!).',
    trims: [
      {
        id: 'challenger_scat_pack',
        name: 'R/T Scat Pack Widebody',
        upgradePrice: 0,
        horsepower: 485,
        zeroToSixtySec: 4.2,
        topSpeedKmh: 282,
        drivetrain: 'RWD',
        engineLayout: '6.4L 392 Naturally Aspirated HEMI V8',
        accelerationScore: 88,
        handlingScore: 83,
        brakesScore: 86,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'challenger_hellcat_redeye',
        name: 'SRT Hellcat Redeye Widebody',
        upgradePrice: 34000,
        horsepower: 797,
        zeroToSixtySec: 3.4,
        topSpeedKmh: 327,
        drivetrain: 'RWD',
        engineLayout: '6.2L High-Output Supercharged HEMI V8',
        accelerationScore: 96,
        handlingScore: 85,
        brakesScore: 90,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#18181b',
      },
      {
        id: 'challenger_demon_170',
        name: 'SRT Demon 170 (1,025 HP E85)',
        upgradePrice: 68000,
        horsepower: 1025,
        zeroToSixtySec: 1.66,
        topSpeedKmh: 346,
        drivetrain: 'RWD',
        engineLayout: '6.2L 3.0L-Blower E85 Supercharged HEMI V8',
        accelerationScore: 112,
        handlingScore: 86,
        brakesScore: 92,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#facc15',
      },
    ],
  },
  {
    id: 'dodge_charger',
    name: 'Dodge Charger Widebody',
    manufacturer: 'Dodge',
    category: 'Supercharged V8 Sedan',
    price: 54000,
    horsepower: 485,
    zeroToSixtySec: 4.3,
    topSpeedKmh: 282,
    drivetrain: 'RWD',
    engineLayout: '6.4L 392 HEMI V8',
    enginePowerRating: 88,
    accelerationScore: 88,
    handlingScore: 84,
    brakesScore: 87,
    defaultColor: '#ea580c',
    accentColor: '#18181b',
    bodyStyle: 'muscle_v8',
    modelArchetype: 'dodge_charger',
    description:
      'Aggressive 4-door widebody muscle sedan with flared fenders, mail-slot hood intake, and full-width LED racetrack tail lamp. Upgradeable to the 807 HP King Daytona.',
    trims: [
      {
        id: 'charger_scat_pack',
        name: 'Scat Pack Widebody',
        upgradePrice: 0,
        horsepower: 485,
        zeroToSixtySec: 4.3,
        topSpeedKmh: 282,
        drivetrain: 'RWD',
        engineLayout: '6.4L 392 HEMI V8',
        accelerationScore: 88,
        handlingScore: 84,
        brakesScore: 87,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'charger_hellcat_redeye',
        name: 'SRT Hellcat Redeye Widebody',
        upgradePrice: 36000,
        horsepower: 797,
        zeroToSixtySec: 3.5,
        topSpeedKmh: 327,
        drivetrain: 'RWD',
        engineLayout: '6.2L Supercharged HEMI V8',
        accelerationScore: 96,
        handlingScore: 86,
        brakesScore: 91,
        aeroStyle: 'widebody_gt',
      },
      {
        id: 'charger_king_daytona',
        name: 'SRT King Daytona (807 HP)',
        upgradePrice: 52000,
        horsepower: 807,
        zeroToSixtySec: 3.4,
        topSpeedKmh: 332,
        drivetrain: 'RWD',
        engineLayout: '6.2L Jailbreak Supercharged HEMI V8',
        accelerationScore: 97,
        handlingScore: 88,
        brakesScore: 93,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#18181b',
      },
    ],
  },
  {
    id: 'bmw_m4',
    name: 'BMW M3 / M4 (G80/G82)',
    manufacturer: 'BMW',
    category: 'German Twin-Turbo Performance',
    price: 78000,
    horsepower: 473,
    zeroToSixtySec: 4.1,
    topSpeedKmh: 274,
    drivetrain: 'RWD',
    engineLayout: '3.0L S58 Twin-Turbo Inline-6',
    enginePowerRating: 91,
    accelerationScore: 90,
    handlingScore: 92,
    brakesScore: 92,
    defaultColor: '#10b981',
    accentColor: '#ef4444',
    bodyStyle: 'tuner_coupe',
    modelArchetype: 'bmw_m4',
    description:
      'Bavarian S58 twin-turbocharged inline-six machine with frameless vertical twin-kidney grille, carbon roof, and quad exhausts. Upgrade to M3 Competition xDrive AWD or the ultra-rare M4 CSL with yellow laser DRLs and ducktail trunk.',
    trims: [
      {
        id: 'bmw_m4_base',
        name: 'M4 Coupe 6MT',
        upgradePrice: 0,
        horsepower: 473,
        zeroToSixtySec: 4.1,
        topSpeedKmh: 274,
        drivetrain: 'RWD',
        engineLayout: '3.0L S58 Twin-Turbo I6',
        accelerationScore: 90,
        handlingScore: 92,
        brakesScore: 92,
        aeroStyle: 'stock',
      },
      {
        id: 'bmw_m3_comp_xdrive',
        name: 'M3 Competition xDrive AWD',
        upgradePrice: 9000,
        horsepower: 503,
        zeroToSixtySec: 3.2,
        topSpeedKmh: 290,
        drivetrain: 'AWD',
        engineLayout: '3.0L S58 High-Output Twin-Turbo I6 + M xDrive',
        accelerationScore: 95,
        handlingScore: 95,
        brakesScore: 94,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'bmw_m4_csl',
        name: 'M4 CSL Lightweight Track',
        upgradePrice: 62000,
        horsepower: 543,
        zeroToSixtySec: 3.5,
        topSpeedKmh: 307,
        drivetrain: 'RWD',
        engineLayout: '3.0L S58 30.5-PSI Twin-Turbo I6 + Carbon Ducktail',
        accelerationScore: 95,
        handlingScore: 97,
        brakesScore: 97,
        aeroStyle: 'gt_wing',
        accentColorOverride: '#ef4444',
      },
    ],
  },
  {
    id: 'cadillac_escalade',
    name: 'Cadillac Escalade 600',
    manufacturer: 'Cadillac',
    category: 'Full-Size Luxury SUV',
    price: 86000,
    horsepower: 420,
    zeroToSixtySec: 5.9,
    topSpeedKmh: 210,
    drivetrain: 'AWD',
    engineLayout: '6.2L L87 Naturally Aspirated V8',
    enginePowerRating: 83,
    accelerationScore: 81,
    handlingScore: 80,
    brakesScore: 85,
    defaultColor: '#18181b',
    accentColor: '#e2e8f0',
    bodyStyle: 'armored_suv',
    modelArchetype: 'cadillac_escalade',
    description:
      'Commanding full-size luxury SUV featuring tall vertical LED front light blades, massive Cadillac shield grille, 22-inch multi-spoke wheels, and full-pillar vertical OLED rear tail lamps.',
    trims: [
      {
        id: 'escalade_luxury',
        name: 'Luxury 6.2L V8',
        upgradePrice: 0,
        horsepower: 420,
        zeroToSixtySec: 5.9,
        topSpeedKmh: 210,
        drivetrain: 'AWD',
        engineLayout: '6.2L L87 Ecotec3 V8',
        accelerationScore: 81,
        handlingScore: 80,
        brakesScore: 85,
        aeroStyle: 'stock',
      },
      {
        id: 'escalade_sport_platinum',
        name: 'Sport Platinum Air Ride',
        upgradePrice: 26000,
        horsepower: 420,
        zeroToSixtySec: 5.8,
        topSpeedKmh: 218,
        drivetrain: 'AWD',
        engineLayout: '6.2L V8 + Magnetic Ride 4.0 & eLSD',
        accelerationScore: 83,
        handlingScore: 84,
        brakesScore: 87,
        aeroStyle: 'sport_spoiler',
        accentColorOverride: '#090d16',
      },
      {
        id: 'escalade_esv',
        name: 'ESV Extended Executive',
        upgradePrice: 32000,
        horsepower: 460,
        zeroToSixtySec: 5.5,
        topSpeedKmh: 225,
        drivetrain: 'AWD',
        engineLayout: '6.2L Performance Intake & Exhaust V8',
        accelerationScore: 84,
        handlingScore: 84,
        brakesScore: 88,
        aeroStyle: 'sport_spoiler',
      },
    ],
  },
  {
    id: 'toyota_supra_mk4',
    name: 'Toyota Supra Mk4 (A80)',
    manufacturer: 'Toyota',
    category: '90s JDM 2JZ-GTE Icon',
    price: 125000,
    horsepower: 220,
    zeroToSixtySec: 6.1,
    topSpeedKmh: 245,
    drivetrain: 'RWD',
    engineLayout: '3.0L 2JZ-GE Inline-6',
    enginePowerRating: 88,
    accelerationScore: 86,
    handlingScore: 89,
    brakesScore: 88,
    defaultColor: '#f97316',
    accentColor: '#18181b',
    bodyStyle: 'tuner_coupe',
    modelArchetype: 'toyota_supra_mk4',
    description:
      'Legendary 1990s A80 Supra with rounded grand-tourer curves, recessed multi-projector headlights, iconic high-arch hoop rear wing, and quad circular taillights. Upgrade to the twin-turbo 2JZ-GTE RZ or 800 HP TRD 3000GT Widebody!',
    trims: [
      {
        id: 'supra_mk4_szr',
        name: 'SZ-R Naturally Aspirated',
        upgradePrice: 0,
        horsepower: 220,
        zeroToSixtySec: 6.1,
        topSpeedKmh: 245,
        drivetrain: 'RWD',
        engineLayout: '3.0L 2JZ-GE DOHC Inline-6',
        accelerationScore: 83,
        handlingScore: 88,
        brakesScore: 87,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'supra_mk4_rz',
        name: 'RZ 2JZ-GTE Twin-Turbo',
        upgradePrice: 35000,
        horsepower: 320,
        zeroToSixtySec: 4.6,
        topSpeedKmh: 285,
        drivetrain: 'RWD',
        engineLayout: '3.0L 2JZ-GTE Sequential Twin-Turbo I6',
        accelerationScore: 91,
        handlingScore: 91,
        brakesScore: 91,
        aeroStyle: 'gt_wing',
      },
      {
        id: 'supra_mk4_trd_3000gt',
        name: 'TRD 3000GT Widebody (800 HP Single-Turbo)',
        upgradePrice: 85000,
        horsepower: 800,
        zeroToSixtySec: 3.1,
        topSpeedKmh: 342,
        drivetrain: 'RWD',
        engineLayout: '3.0L Forged 2JZ-GTE Big Single-Turbo + Louvered Hood',
        accelerationScore: 99,
        handlingScore: 94,
        brakesScore: 95,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#e2e8f0',
      },
    ],
  },
  {
    id: 'nissan_gtr_r35',
    name: 'Nissan GT-R (R35)',
    manufacturer: 'Nissan',
    category: 'AWD Twin-Turbo Godzilla',
    price: 125000,
    horsepower: 565,
    zeroToSixtySec: 2.9,
    topSpeedKmh: 315,
    drivetrain: 'AWD',
    engineLayout: '3.8L VR38DETT Twin-Turbo V6',
    enginePowerRating: 94,
    accelerationScore: 96,
    handlingScore: 95,
    brakesScore: 95,
    defaultColor: '#e2e8f0',
    accentColor: '#dc2626',
    bodyStyle: 'tuner_coupe',
    modelArchetype: 'nissan_gtr_r35',
    description:
      'Hand-built VR38DETT twin-turbo V6 supercar killer with ATTESA E-TS all-wheel drive and signature quad afterburner taillights. Upgrade to T-Spec Millennium Jade or the 600 HP GT-R NISMO with carbon aero.',
    trims: [
      {
        id: 'gtr_r35_premium',
        name: 'GT-R Premium',
        upgradePrice: 0,
        horsepower: 565,
        zeroToSixtySec: 2.9,
        topSpeedKmh: 315,
        drivetrain: 'AWD',
        engineLayout: '3.8L VR38DETT Twin-Turbo V6',
        accelerationScore: 96,
        handlingScore: 95,
        brakesScore: 95,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'gtr_r35_tspec',
        name: 'GT-R T-Spec Carbon Ceramic',
        upgradePrice: 20000,
        horsepower: 565,
        zeroToSixtySec: 2.8,
        topSpeedKmh: 318,
        drivetrain: 'AWD',
        engineLayout: '3.8L VR38DETT + Wider Forged Rays & CCB Brakes',
        accelerationScore: 97,
        handlingScore: 96,
        brakesScore: 97,
        aeroStyle: 'gt_wing',
        accentColorOverride: '#eab308',
      },
      {
        id: 'gtr_r35_nismo',
        name: 'GT-R NISMO (GT3 Turbos)',
        upgradePrice: 98000,
        horsepower: 600,
        zeroToSixtySec: 2.5,
        topSpeedKmh: 330,
        drivetrain: 'AWD',
        engineLayout: '3.8L VR38DETT GT3-Spec Twin-Turbo V6 + Swan-Neck Wing',
        accelerationScore: 100,
        handlingScore: 99,
        brakesScore: 99,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#dc2626',
      },
    ],
  },
  {
    id: 'porsche_911',
    name: 'Porsche 911 (992)',
    manufacturer: 'Porsche',
    category: 'Rear-Engine Flat-6 Icon',
    price: 135000,
    horsepower: 443,
    zeroToSixtySec: 3.3,
    topSpeedKmh: 308,
    drivetrain: 'RWD',
    engineLayout: '3.0L Twin-Turbo Flat-6',
    enginePowerRating: 93,
    accelerationScore: 94,
    handlingScore: 96,
    brakesScore: 96,
    defaultColor: '#38bdf8',
    accentColor: '#f97316',
    bodyStyle: 'supercar_wedge',
    modelArchetype: 'porsche_911',
    description:
      'Unmistakable 992-generation Porsche 911 silhouette with oval LED matrix headlights, sloping fastback roofline, and wide rear hips. Upgrade to the 640 HP 911 Turbo S (2.2s 0–60!) or 9,000 RPM 911 GT3 RS with towering swan-neck DRS wing.',
    trims: [
      {
        id: 'porsche_911_carrera_s',
        name: '911 Carrera S',
        upgradePrice: 0,
        horsepower: 443,
        zeroToSixtySec: 3.3,
        topSpeedKmh: 308,
        drivetrain: 'RWD',
        engineLayout: '3.0L Twin-Turbo Flat-6',
        accelerationScore: 94,
        handlingScore: 95,
        brakesScore: 95,
        aeroStyle: 'stock',
      },
      {
        id: 'porsche_911_turbo_s',
        name: '911 Turbo S AWD',
        upgradePrice: 98000,
        horsepower: 640,
        zeroToSixtySec: 2.2,
        topSpeedKmh: 330,
        drivetrain: 'AWD',
        engineLayout: '3.7L VTG Twin-Turbo Flat-6',
        accelerationScore: 103,
        handlingScore: 98,
        brakesScore: 99,
        aeroStyle: 'sport_spoiler',
        accentColorOverride: '#facc15',
      },
      {
        id: 'porsche_911_gt3_rs',
        name: '911 GT3 RS (9,000 RPM DRS)',
        upgradePrice: 115000,
        horsepower: 518,
        zeroToSixtySec: 3.0,
        topSpeedKmh: 296,
        drivetrain: 'RWD',
        engineLayout: '4.0L Naturally Aspirated 9,000 RPM Flat-6 + 860kg Downforce',
        accelerationScore: 97,
        handlingScore: 104,
        brakesScore: 103,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#ef4444',
      },
    ],
  },
  {
    id: 'cadillac_escalade_v',
    name: 'Cadillac Escalade-V',
    manufacturer: 'Cadillac',
    category: 'Supercharged V8 Super-SUV',
    price: 154000,
    horsepower: 682,
    zeroToSixtySec: 4.3,
    topSpeedKmh: 245,
    drivetrain: 'AWD',
    engineLayout: '6.2L LT4 Hand-Built Supercharged V8',
    enginePowerRating: 93,
    accelerationScore: 92,
    handlingScore: 87,
    brakesScore: 91,
    defaultColor: '#0f172a',
    accentColor: '#dc2626',
    bodyStyle: 'armored_suv',
    modelArchetype: 'cadillac_escalade_v',
    description:
      'The most powerful full-size SUV ever built: 682 HP hand-built 6.2L supercharged V8 with V-Series mesh grille, aggressive lower front splitter, Brembo red calipers, and thunderous quad exhaust.',
    trims: [
      {
        id: 'escalade_v_base',
        name: 'Escalade-V 6.2L Supercharged',
        upgradePrice: 0,
        horsepower: 682,
        zeroToSixtySec: 4.3,
        topSpeedKmh: 245,
        drivetrain: 'AWD',
        engineLayout: '6.2L LT4 2.65L-Blower Supercharged V8',
        accelerationScore: 92,
        handlingScore: 87,
        brakesScore: 91,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'escalade_v_esv',
        name: 'Escalade-V ESV Long-Wheelbase',
        upgradePrice: 6000,
        horsepower: 682,
        zeroToSixtySec: 4.4,
        topSpeedKmh: 248,
        drivetrain: 'AWD',
        engineLayout: '6.2L LT4 Supercharged V8 Extended',
        accelerationScore: 92,
        handlingScore: 88,
        brakesScore: 92,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'escalade_v_blackwing',
        name: 'V-Series Blackwing 800HP Tune',
        upgradePrice: 28000,
        horsepower: 800,
        zeroToSixtySec: 3.7,
        topSpeedKmh: 272,
        drivetrain: 'AWD',
        engineLayout: '6.2L Ported Supercharged V8 + High-Boost Pulley',
        accelerationScore: 96,
        handlingScore: 90,
        brakesScore: 94,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#dc2626',
      },
    ],
  },
  {
    id: 'nissan_gtr_r34',
    name: 'Nissan Skyline GT-R (R34)',
    manufacturer: 'Nissan',
    category: 'JDM AWD Legend',
    price: 185000,
    horsepower: 280,
    zeroToSixtySec: 4.7,
    topSpeedKmh: 268,
    drivetrain: 'AWD',
    engineLayout: '2.6L RB26DETT Twin-Turbo Inline-6',
    enginePowerRating: 90,
    accelerationScore: 89,
    handlingScore: 93,
    brakesScore: 91,
    defaultColor: '#2563eb',
    accentColor: '#38bdf8',
    bodyStyle: 'tuner_coupe',
    modelArchetype: 'nissan_gtr_r34',
    description:
      'Bayside Blue BNR34 Skyline GT-R with boxy muscular fenders, exposed front intercooler mesh, dual-plane rear wing, and iconic twin round taillights. Upgrade to the carbon-hooded V-Spec II or N1-powered M-Spec Nür.',
    trims: [
      {
        id: 'r34_base',
        name: 'Skyline GT-R (BNR34)',
        upgradePrice: 0,
        horsepower: 280,
        zeroToSixtySec: 4.7,
        topSpeedKmh: 268,
        drivetrain: 'AWD',
        engineLayout: '2.6L RB26DETT Twin-Turbo Inline-6',
        accelerationScore: 89,
        handlingScore: 93,
        brakesScore: 91,
        aeroStyle: 'gt_wing',
      },
      {
        id: 'r34_vspec_ii',
        name: 'GT-R V-Spec II (NACA Carbon Hood)',
        upgradePrice: 65000,
        horsepower: 330,
        zeroToSixtySec: 4.3,
        topSpeedKmh: 282,
        drivetrain: 'AWD',
        engineLayout: '2.6L RB26DETT + Active LSD & Carbon Diffuser',
        accelerationScore: 92,
        handlingScore: 95,
        brakesScore: 93,
        aeroStyle: 'gt_wing',
        accentColorOverride: '#18181b',
      },
      {
        id: 'r34_mspec_nur',
        name: 'GT-R M-Spec Nür (N1 Twin-Turbo)',
        upgradePrice: 140000,
        horsepower: 450,
        zeroToSixtySec: 3.6,
        topSpeedKmh: 305,
        drivetrain: 'AWD',
        engineLayout: '2.6L RB26DETT N1 Metal-Blade Twin-Turbo',
        accelerationScore: 96,
        handlingScore: 97,
        brakesScore: 95,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#eab308',
      },
    ],
  },
  {
    id: 'lamborghini_huracan',
    name: 'Lamborghini Huracán',
    manufacturer: 'Lamborghini',
    category: 'Screaming V10 Supercar',
    price: 260000,
    horsepower: 631,
    zeroToSixtySec: 2.8,
    topSpeedKmh: 325,
    drivetrain: 'AWD',
    engineLayout: '5.2L Naturally Aspirated V10',
    enginePowerRating: 97,
    accelerationScore: 98,
    handlingScore: 97,
    brakesScore: 97,
    defaultColor: '#84cc16',
    accentColor: '#f97316',
    bodyStyle: 'supercar_wedge',
    modelArchetype: 'lamborghini_huracan',
    description:
      '8,500 RPM naturally aspirated 5.2L V10 Italian wedge with Y-shaped LED DRLs and hexagonal exhausts. Upgrade to the Huracán Tecnica or the track-focused Huracán STO with roof snorkel and shark fin.',
    trims: [
      {
        id: 'huracan_evo',
        name: 'Huracán EVO AWD',
        upgradePrice: 0,
        horsepower: 631,
        zeroToSixtySec: 2.8,
        topSpeedKmh: 325,
        drivetrain: 'AWD',
        engineLayout: '5.2L Naturally Aspirated V10',
        accelerationScore: 98,
        handlingScore: 97,
        brakesScore: 97,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'huracan_tecnica',
        name: 'Huracán Tecnica RWD',
        upgradePrice: 35000,
        horsepower: 631,
        zeroToSixtySec: 3.0,
        topSpeedKmh: 325,
        drivetrain: 'RWD',
        engineLayout: '5.2L V10 + Rear-Wheel Steering & Fixed Wing',
        accelerationScore: 97,
        handlingScore: 99,
        brakesScore: 98,
        aeroStyle: 'gt_wing',
      },
      {
        id: 'huracan_sto',
        name: 'Huracán STO (Super Trofeo Omologata)',
        upgradePrice: 85000,
        horsepower: 631,
        zeroToSixtySec: 2.6,
        topSpeedKmh: 310,
        drivetrain: 'RWD',
        engineLayout: '5.2L V10 + Cofango Clamshell, Roof Scoop & Shark Fin',
        accelerationScore: 99,
        handlingScore: 103,
        brakesScore: 102,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#38bdf8',
      },
    ],
  },
  {
    id: 'nissan_gtr_r34_ztune',
    name: 'Nissan Skyline GT-R R34 NISMO Z-Tune',
    manufacturer: 'Nissan / NISMO',
    category: '1-of-19 Holy Grail JDM',
    price: 1850000,
    horsepower: 500,
    zeroToSixtySec: 3.1,
    topSpeedKmh: 327,
    drivetrain: 'AWD',
    engineLayout: '2.8L RB26DETT Z2 Stroker Twin-Turbo I6',
    enginePowerRating: 99,
    accelerationScore: 99,
    handlingScore: 99,
    brakesScore: 98,
    defaultColor: '#94a3b8',
    accentColor: '#dc2626',
    bodyStyle: 'tuner_coupe',
    modelArchetype: 'nissan_gtr_r34_ztune',
    description:
      'One of only 19 hand-built NISMO Omori Factory R34 GT-R Z-Tunes in existence. Powered by a 2.8L RB26DETT Z2 GT500 race block with IHI twin turbos, louvered carbon hood, flared Z-Tune front fenders, and titanium exhaust.',
    trims: [
      {
        id: 'r34_ztune_silver',
        name: 'Z-Tune Silver (KY0) Z2 Spec',
        upgradePrice: 0,
        horsepower: 500,
        zeroToSixtySec: 3.1,
        topSpeedKmh: 327,
        drivetrain: 'AWD',
        engineLayout: '2.8L RB26DETT Z2 GT500 Twin-Turbo I6',
        accelerationScore: 99,
        handlingScore: 99,
        brakesScore: 98,
        aeroStyle: 'widebody_gt',
      },
      {
        id: 'r34_ztune_midnight_purple',
        name: 'Z-Tune Midnight Purple III (1-of-2 Clubman)',
        upgradePrice: 250000,
        horsepower: 620,
        zeroToSixtySec: 2.7,
        topSpeedKmh: 342,
        drivetrain: 'AWD',
        engineLayout: '2.8L RB26DETT Z2 Omori F-Sport 9,000 RPM Tune',
        accelerationScore: 103,
        handlingScore: 101,
        brakesScore: 100,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#a855f7',
      },
    ],
  },
  {
    id: 'mcmurtry_speirling',
    name: 'McMurtry Spéirling Fan Car',
    manufacturer: 'McMurtry Automotive',
    category: 'Ground-Effect Suction Prototype',
    price: 1950000,
    horsepower: 1000,
    zeroToSixtySec: 1.4,
    topSpeedKmh: 290,
    drivetrain: 'RWD',
    engineLayout: 'Twin-Motor EV + 2,000kg Dual-Turbine Downforce Fan',
    enginePowerRating: 112,
    accelerationScore: 120,
    handlingScore: 118,
    brakesScore: 115,
    defaultColor: '#1e3a8a',
    accentColor: '#fbbf24',
    bodyStyle: 'hypercar_gt',
    modelArchetype: 'mcmurtry_speirling',
    description:
      'Goodwood Hillclimb record-holder! Ultra-compact single-seater with twin 23,000 RPM suction turbines that vacuum the car to the asphalt with 2,000 kg of downforce from 0 km/h—delivering a mind-bending 1.40s 0–60 mph launch and 3G cornering.',
    trims: [
      {
        id: 'speirling_goodwood',
        name: 'Goodwood Record Prototype (1.4s 0–60)',
        upgradePrice: 0,
        horsepower: 1000,
        zeroToSixtySec: 1.4,
        topSpeedKmh: 290,
        drivetrain: 'RWD',
        engineLayout: 'Twin E-Axle + 2,000kg Active Fan Suction System',
        accelerationScore: 120,
        handlingScore: 118,
        brakesScore: 115,
        aeroStyle: 'fan_car',
      },
      {
        id: 'speirling_pure',
        name: 'Spéirling PURE Customer Track Spec',
        upgradePrice: 450000,
        horsepower: 1000,
        zeroToSixtySec: 1.38,
        topSpeedKmh: 306,
        drivetrain: 'RWD',
        engineLayout: '100kWh Molicel Pack + High-Efficiency Dual Suction Fans',
        accelerationScore: 122,
        handlingScore: 120,
        brakesScore: 118,
        aeroStyle: 'fan_car',
        accentColorOverride: '#38bdf8',
      },
    ],
  },
  {
    id: 'rimac_nevera',
    name: 'Rimac Nevera',
    manufacturer: 'Rimac Automobili',
    category: 'Quad-Motor Electric Hypercar',
    price: 2200000,
    horsepower: 1914,
    zeroToSixtySec: 1.74,
    topSpeedKmh: 412,
    drivetrain: 'AWD',
    engineLayout: 'Quad Permanent-Magnet Electric Motors (R-AWTV)',
    enginePowerRating: 116,
    accelerationScore: 118,
    handlingScore: 108,
    brakesScore: 110,
    defaultColor: '#06b6d4',
    accentColor: '#10b981',
    bodyStyle: 'hypercar_gt',
    modelArchetype: 'rimac_nevera',
    description:
      '1,914 HP all-electric Croatian hypercar with 4 independent surface-mounted carbon-sleeve motors and active torque vectoring. Upgrade to the 2,107 HP Rimac Nevera R with fixed aero wing and 1.66s 0–60 mph launch.',
    trims: [
      {
        id: 'nevera_standard',
        name: 'Nevera 1914HP Quad-Motor',
        upgradePrice: 0,
        horsepower: 1914,
        zeroToSixtySec: 1.74,
        topSpeedKmh: 412,
        drivetrain: 'AWD',
        engineLayout: 'Quad-Motor 120kWh R-AWTV',
        accelerationScore: 118,
        handlingScore: 108,
        brakesScore: 110,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'nevera_time_attack',
        name: 'Nevera Time Attack Edition (1-of-12)',
        upgradePrice: 250000,
        horsepower: 1914,
        zeroToSixtySec: 1.72,
        topSpeedKmh: 415,
        drivetrain: 'AWD',
        engineLayout: 'Quad-Motor Track Aero Calibration',
        accelerationScore: 119,
        handlingScore: 111,
        brakesScore: 112,
        aeroStyle: 'gt_wing',
        accentColorOverride: '#22c55e',
      },
      {
        id: 'nevera_r',
        name: 'Nevera R (2,107 HP Track Weapon)',
        upgradePrice: 450000,
        horsepower: 2107,
        zeroToSixtySec: 1.66,
        topSpeedKmh: 431,
        drivetrain: 'AWD',
        engineLayout: 'Next-Gen Quad-Motor 2,107 HP + Fixed Carbon Wing',
        accelerationScore: 121,
        handlingScore: 115,
        brakesScore: 115,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#10b981',
      },
    ],
  },
  {
    id: 'koenigsegg_regera',
    name: 'Koenigsegg Regera',
    manufacturer: 'Koenigsegg',
    category: 'Direct-Drive Hybrid Megacar',
    price: 2350000,
    horsepower: 1500,
    zeroToSixtySec: 2.7,
    topSpeedKmh: 404,
    drivetrain: 'RWD',
    engineLayout: '5.0L Twin-Turbo V8 + 3 YASA E-Motors (KDD Direct Drive)',
    enginePowerRating: 112,
    accelerationScore: 110,
    handlingScore: 106,
    brakesScore: 108,
    defaultColor: '#991b1b',
    accentColor: '#fbbf24',
    bodyStyle: 'hypercar_gt',
    modelArchetype: 'koenigsegg_regera',
    description:
      'Swedish Direct-Drive megacar combining a 5.0L twin-turbo V8 and three axial-flux electric motors with zero traditional gears—accelerating seamlessly from 0 to 404 km/h in a single uninterrupted surge.',
    trims: [
      {
        id: 'regera_standard',
        name: 'Regera Direct Drive (1,500 HP)',
        upgradePrice: 0,
        horsepower: 1500,
        zeroToSixtySec: 2.7,
        topSpeedKmh: 404,
        drivetrain: 'RWD',
        engineLayout: '5.0L Twin-Turbo V8 + KDD Tri-Motor Hybrid',
        accelerationScore: 110,
        handlingScore: 106,
        brakesScore: 108,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'regera_ghost',
        name: 'Regera Ghost Aero Package',
        upgradePrice: 300000,
        horsepower: 1500,
        zeroToSixtySec: 2.6,
        topSpeedKmh: 410,
        drivetrain: 'RWD',
        engineLayout: '5.0L V8 KDD + Front Splitter & Rear Winglets (+20% Downforce)',
        accelerationScore: 111,
        handlingScore: 110,
        brakesScore: 110,
        aeroStyle: 'gt_wing',
        accentColorOverride: '#f8fafc',
      },
      {
        id: 'regera_e85',
        name: 'Regera E85 1.3-Megawatt Spec (1,757 HP)',
        upgradePrice: 500000,
        horsepower: 1757,
        zeroToSixtySec: 2.5,
        topSpeedKmh: 418,
        drivetrain: 'RWD',
        engineLayout: '5.0L E85 High-Boost V8 + 800V Direct Drive',
        accelerationScore: 114,
        handlingScore: 112,
        brakesScore: 112,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#fbbf24',
      },
    ],
  },
  {
    id: 'koenigsegg_agera_rs',
    name: 'Koenigsegg Agera RS',
    manufacturer: 'Koenigsegg',
    category: 'World Speed Record Megacar',
    price: 3100000,
    horsepower: 1160,
    zeroToSixtySec: 2.8,
    topSpeedKmh: 447,
    drivetrain: 'RWD',
    engineLayout: '5.0L Twin-Turbo DOHC V8',
    enginePowerRating: 115,
    accelerationScore: 112,
    handlingScore: 109,
    brakesScore: 110,
    defaultColor: '#dc2626',
    accentColor: '#f8fafc',
    bodyStyle: 'hypercar_gt',
    modelArchetype: 'koenigsegg_agera_rs',
    description:
      'The megacar that set the 277.87 mph (447 km/h) two-way public highway speed record in Nevada. Featherweight 1,395 kg carbon-Kevlar chassis with wraparound canopy, roof snorkel, and active top-mounted wing.',
    trims: [
      {
        id: 'agera_rs_standard',
        name: 'Agera RS Standard (1,160 HP)',
        upgradePrice: 0,
        horsepower: 1160,
        zeroToSixtySec: 2.8,
        topSpeedKmh: 432,
        drivetrain: 'RWD',
        engineLayout: '5.0L Twin-Turbo Aluminum V8',
        accelerationScore: 111,
        handlingScore: 109,
        brakesScore: 110,
        aeroStyle: 'gt_wing',
      },
      {
        id: 'agera_rs_1mw',
        name: 'Agera RS 1MW One:1 Engine Upgrade',
        upgradePrice: 350000,
        horsepower: 1360,
        zeroToSixtySec: 2.6,
        topSpeedKmh: 447,
        drivetrain: 'RWD',
        engineLayout: '5.0L 1-Megawatt E85 Twin-Turbo V8 + Roof Scoop',
        accelerationScore: 114,
        handlingScore: 112,
        brakesScore: 112,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#f8fafc',
      },
      {
        id: 'agera_rs_gryphon',
        name: 'Agera RS Gryphon (24k Gold Leaf & Carbon)',
        upgradePrice: 650000,
        horsepower: 1360,
        zeroToSixtySec: 2.55,
        topSpeedKmh: 458,
        drivetrain: 'RWD',
        engineLayout: '5.0L 1MW V8 + Exposed Clear-Carbon & 24k Gold Leaf',
        accelerationScore: 115,
        handlingScore: 114,
        brakesScore: 114,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#fbbf24',
      },
    ],
  },
  {
    id: 'bugatti_chiron_pur_sport',
    name: 'Bugatti Chiron Pur Sport',
    manufacturer: 'Bugatti',
    category: 'Cornering-Focused W16 Hypercar',
    price: 3600000,
    horsepower: 1479,
    zeroToSixtySec: 2.3,
    topSpeedKmh: 350,
    drivetrain: 'AWD',
    engineLayout: '8.0L Quad-Turbocharged W16 (Close-Ratio 7-Speed)',
    enginePowerRating: 117,
    accelerationScore: 117,
    handlingScore: 115,
    brakesScore: 115,
    defaultColor: '#2563eb',
    accentColor: '#18181b',
    bodyStyle: 'hypercar_gt',
    modelArchetype: 'bugatti_chiron_pur_sport',
    description:
      'Built for relentless lateral agility: 50 kg lighter than a standard Chiron, 15% shorter transmission ratios, magnesium Aero-blade wheels, and a massive 1.9-meter fixed X-bracket rear wing.',
    trims: [
      {
        id: 'chiron_pur_sport_base',
        name: 'Chiron Pur Sport (1.9m Fixed Wing)',
        upgradePrice: 0,
        horsepower: 1479,
        zeroToSixtySec: 2.3,
        topSpeedKmh: 350,
        drivetrain: 'AWD',
        engineLayout: '8.0L Quad-Turbo W16 (6,900 RPM Redline)',
        accelerationScore: 117,
        handlingScore: 115,
        brakesScore: 115,
        aeroStyle: 'widebody_gt',
      },
      {
        id: 'chiron_pur_sport_gp',
        name: 'Pur Sport Grand Prix Sur Mesure',
        upgradePrice: 350000,
        horsepower: 1500,
        zeroToSixtySec: 2.25,
        topSpeedKmh: 362,
        drivetrain: 'AWD',
        engineLayout: '8.0L Quad-Turbo W16 + Titanium 3D-Printed Exhaust',
        accelerationScore: 118,
        handlingScore: 117,
        brakesScore: 116,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#ef4444',
      },
    ],
  },
  {
    id: 'bugatti_chiron_super_sport',
    name: 'Bugatti Chiron Super Sport',
    manufacturer: 'Bugatti',
    category: '304 MPH Longtail W16 Hypercar',
    price: 3950000,
    horsepower: 1578,
    zeroToSixtySec: 2.3,
    topSpeedKmh: 440,
    drivetrain: 'AWD',
    engineLayout: '8.0L Thor Quad-Turbocharged W16',
    enginePowerRating: 120,
    accelerationScore: 119,
    handlingScore: 111,
    brakesScore: 114,
    defaultColor: '#090d16',
    accentColor: '#f97316',
    bodyStyle: 'hypercar_gt',
    modelArchetype: 'bugatti_chiron_super_sport',
    description:
      'Extended 25cm aerodynamic longtail hypercar with 9-hole front fender air curtains and vertically stacked quad exhausts. Upgrade to the world-record Chiron Super Sport 300+ (490 km/h / 304.77 mph!) in Jet Orange & Exposed Carbon.',
    trims: [
      {
        id: 'chiron_ss_base',
        name: 'Chiron Super Sport Longtail',
        upgradePrice: 0,
        horsepower: 1578,
        zeroToSixtySec: 2.3,
        topSpeedKmh: 440,
        drivetrain: 'AWD',
        engineLayout: '8.0L 1,600 PS Quad-Turbo W16',
        accelerationScore: 118,
        handlingScore: 111,
        brakesScore: 114,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'chiron_ss_300plus',
        name: 'Chiron Super Sport 300+ (304.77 MPH Record)',
        upgradePrice: 850000,
        horsepower: 1578,
        zeroToSixtySec: 2.2,
        topSpeedKmh: 490,
        drivetrain: 'AWD',
        engineLayout: '8.0L Thor Quad-Turbo W16 + Speed-Record Longtail Aero',
        accelerationScore: 120,
        handlingScore: 113,
        brakesScore: 116,
        aeroStyle: 'sport_spoiler',
        accentColorOverride: '#f97316',
      },
    ],
  },
  {
    id: 'koenigsegg_jesko',
    name: 'Koenigsegg Jesko & Jesko Absolut',
    manufacturer: 'Koenigsegg',
    category: '#1 Crown-Jewel 1,600 HP Megacar',
    price: 4500000,
    horsepower: 1600,
    zeroToSixtySec: 2.5,
    topSpeedKmh: 482,
    drivetrain: 'RWD',
    engineLayout: '5.0L Flat-Plane Twin-Turbo V8 + 9-Speed Light Speed Transmission',
    enginePowerRating: 125,
    accelerationScore: 119,
    handlingScore: 117,
    brakesScore: 118,
    defaultColor: '#f8fafc',
    accentColor: '#10b981',
    bodyStyle: 'hypercar_gt',
    modelArchetype: 'koenigsegg_jesko',
    description:
      'The most expensive and fastest road car in Metro City! Features a 1,600 HP flat-plane twin-turbo V8 and 7-clutch Light Speed Transmission. Upgrade from the high-downforce Jesko Attack to the 531+ km/h (330+ mph) twin-fin Jesko Absolut ($5.7M–$6.3M)!',
    trims: [
      {
        id: 'jesko_attack',
        name: 'Jesko Attack (1,400kg Track Downforce)',
        upgradePrice: 0,
        horsepower: 1600,
        zeroToSixtySec: 2.5,
        topSpeedKmh: 482,
        drivetrain: 'RWD',
        engineLayout: '5.0L E85 Flat-Plane Twin-Turbo V8 + Boomerang GT Wing',
        accelerationScore: 118,
        handlingScore: 118,
        brakesScore: 118,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#10b981',
      },
      {
        id: 'jesko_absolut',
        name: 'Jesko Absolut (330+ MPH Twin-Fin Low-Drag)',
        upgradePrice: 1200000,
        horsepower: 1600,
        zeroToSixtySec: 2.4,
        topSpeedKmh: 531,
        drivetrain: 'RWD',
        engineLayout: '5.0L 1,600 HP V8 + 0.278 Cd Twin-Fin Longtail & Rear Wheel Covers',
        accelerationScore: 122,
        handlingScore: 116,
        brakesScore: 119,
        aeroStyle: 'absolut_fins',
        accentColorOverride: '#f97316',
      },
      {
        id: 'jesko_absolut_knc_gold',
        name: 'Jesko Absolut KNC Bare Carbon & 24k Gold',
        upgradePrice: 1800000,
        horsepower: 1650,
        zeroToSixtySec: 2.35,
        topSpeedKmh: 538,
        drivetrain: 'RWD',
        engineLayout: '5.0L 1,650 HP Blueprinted V8 + KNC Naked Carbon & 24k Gold Leaf',
        accelerationScore: 124,
        handlingScore: 118,
        brakesScore: 120,
        aeroStyle: 'absolut_fins',
        accentColorOverride: '#fbbf24',
      },
    ],
  },
];

export function getEffectiveStreetCarSpec(
  car: StreetCarSpec,
  trimId?: string
): StreetCarSpec & { activeTrim: StreetCarTrimSpec } {
  const activeTrim =
    (trimId ? car.trims.find((t) => t.id === trimId) : undefined) || car.trims[0];
  const clearance: 'low' | 'medium' | 'high' =
    activeTrim.groundClearance ||
    car.groundClearance ||
    (car.id.includes('escalade') || car.bodyStyle === 'armored_suv'
      ? 'high'
      : car.id.includes('civic') || car.id.includes('camry') || car.id.includes('charger') || car.bodyStyle === 'hatchback'
      ? 'medium'
      : 'low');
  return {
    ...car,
    horsepower: activeTrim.horsepower,
    zeroToSixtySec: activeTrim.zeroToSixtySec,
    topSpeedKmh: activeTrim.topSpeedKmh,
    drivetrain: activeTrim.drivetrain,
    groundClearance: clearance,
    engineLayout: activeTrim.engineLayout,
    accelerationScore: activeTrim.accelerationScore,
    handlingScore: activeTrim.handlingScore,
    brakesScore: activeTrim.brakesScore,
    accentColor: activeTrim.accentColorOverride || car.accentColor,
    activeTrim,
  };
}

export interface MetroCitySaveState {
  streetCash: number;
  ownedCarIds: string[];
  selectedCarId: string;
  customPaintByCar: Record<string, string>;
  unlockedTrimsByCar: Record<string, string[]>;
  activeTrimByCar: Record<string, string>;
  completedMissions: number;
  completedMissionIds: string[];
  totalEarnedCash: number;
  streetRepLevel: number;
  pendingMissionId?: string | null;
  ownedHouseIds: string[];
  activeHomeId: string | null;
  unpaidCrashTicketsTab: number;
  totalJobsCompleted: number;
  totalHeistsCompleted: number;
  bankRobberyBustCount: number;
}

export interface CityJobRoute {
  pickupX: number;
  pickupZ: number;
  pickupLabel: string;
  dropoffX: number;
  dropoffZ: number;
  dropoffLabel: string;
}

export interface CityRegularJobSpec {
  id: string;
  title: string;
  roleLabel: string;
  icon: string;
  basePay: number;
  maxTipBonus: number;
  tipBonusMax: number;
  timeLimitSec: number;
  badgeColor: string;
  description: string;
  fixedPickup?: { x: number; z: number; label: string };
  routes: CityJobRoute[];
}

export const CITY_REGULAR_JOBS_CATALOG: CityRegularJobSpec[] = [
  {
    id: 'job_taxi',
    title: 'Maryland Express Cab & Rideshare',
    roleLabel: 'TAXI DISPATCH',
    icon: '🚕',
    basePay: 2200,
    maxTipBonus: 800,
    tipBonusMax: 800,
    timeLimitSec: 95,
    badgeColor: '#facc15',
    description: 'Pick up passengers across Gaithersburg, Baltimore Inner Harbor, and Annapolis and drop them off smoothly for tips!',
    routes: [
      {
        pickupX: MD_LANDMARKS.baltimoreInnerHarbor.x,
        pickupZ: MD_LANDMARKS.baltimoreInnerHarbor.z,
        pickupLabel: 'Inner Harbor Cab Stand (Pratt & Light St)',
        dropoffX: MD_LANDMARKS.baltimoreMtVernon.x,
        dropoffZ: MD_LANDMARKS.baltimoreMtVernon.z,
        dropoffLabel: 'Mount Vernon Washington Monument',
      },
      {
        pickupX: MD_LANDMARKS.shadyGroveMetro.x,
        pickupZ: MD_LANDMARKS.shadyGroveMetro.z,
        pickupLabel: 'Shady Grove WMATA Red Line Metro',
        dropoffX: MD_LANDMARKS.rioLakefront.x,
        dropoffZ: MD_LANDMARKS.rioLakefront.z,
        dropoffLabel: 'RIO Lakefront Promenade (Gaithersburg)',
      },
      {
        pickupX: MD_LANDMARKS.bwiAirport.x,
        pickupZ: MD_LANDMARKS.bwiAirport.z,
        pickupLabel: 'BWI Thurgood Marshall Arrivals',
        dropoffX: MD_LANDMARKS.annapolisCityDock.x,
        dropoffZ: MD_LANDMARKS.annapolisCityDock.z,
        dropoffLabel: 'Annapolis City Dock / Ego Alley',
      },
    ],
  },
  {
    id: 'job_pizza',
    title: 'Olde Towne Gaithersburg Brick-Oven Pizza',
    roleLabel: 'PIZZA DELIVERY',
    icon: '🍕',
    basePay: 1850,
    maxTipBonus: 650,
    tipBonusMax: 650,
    timeLimitSec: 75,
    badgeColor: '#f97316',
    description: 'Grab hot pies from Olde Towne Gaithersburg and deliver them across Montgomery Village, Hadley Farms, and Rockville!',
    fixedPickup: { x: gx(-85), z: gz(2005), label: 'Olde Towne Pizza (Diamond Ave & MD-355)' },
    routes: [
      {
        pickupX: gx(-85),
        pickupZ: gz(2005),
        pickupLabel: 'Olde Towne Pizza (Diamond Ave & MD-355)',
        dropoffX: gx(552),
        dropoffZ: gz(1538),
        dropoffLabel: 'Hadley Farms Neighborhood (Gaithersburg)',
      },
      {
        pickupX: gx(-85),
        pickupZ: gz(2005),
        pickupLabel: 'Olde Towne Pizza (Diamond Ave & MD-355)',
        dropoffX: gx(-565),
        dropoffZ: gz(2210),
        dropoffLabel: 'Kentlands Market Square',
      },
      {
        pickupX: gx(-85),
        pickupZ: gz(2005),
        pickupLabel: 'Olde Towne Pizza (Diamond Ave & MD-355)',
        dropoffX: MD_LANDMARKS.rockvilleSquare.x,
        dropoffZ: MD_LANDMARKS.rockvilleSquare.z,
        dropoffLabel: 'Rockville Town Square',
      },
    ],
  },
  {
    id: 'job_courier',
    title: 'Chesapeake Express Logistics Courier',
    roleLabel: 'EXPRESS COURIER',
    icon: '📦',
    basePay: 2500,
    maxTipBonus: 750,
    tipBonusMax: 750,
    timeLimitSec: 95,
    badgeColor: '#38bdf8',
    description: 'Load air-freight parcels at BWI Airport and rush them to Columbia Town Center, Downtown Baltimore, or Bethesda!',
    fixedPickup: { x: MD_LANDMARKS.bwiAirport.x, z: MD_LANDMARKS.bwiAirport.z, label: 'BWI Cargo Terminal' },
    routes: [
      {
        pickupX: MD_LANDMARKS.bwiAirport.x,
        pickupZ: MD_LANDMARKS.bwiAirport.z,
        pickupLabel: 'BWI Cargo Terminal',
        dropoffX: MD_LANDMARKS.columbia.x,
        dropoffZ: MD_LANDMARKS.columbia.z,
        dropoffLabel: 'Columbia Town Center Plaza',
      },
      {
        pickupX: MD_LANDMARKS.bwiAirport.x,
        pickupZ: MD_LANDMARKS.bwiAirport.z,
        pickupLabel: 'BWI Cargo Terminal',
        dropoffX: 1220,
        dropoffZ: -245,
        dropoffLabel: 'Charles Center Downtown Baltimore',
      },
    ],
  },
  {
    id: 'job_food',
    title: 'Crab-Cake & Pit Beef Midnight Delivery',
    roleLabel: 'FOOD DELIVERY',
    icon: '🦀',
    basePay: 1950,
    maxTipBonus: 600,
    tipBonusMax: 600,
    timeLimitSec: 80,
    badgeColor: '#ec4899',
    description: 'Pick up fresh Maryland crab cakes from Fells Point or Woodlawn and race them to hungry campus fans!',
    fixedPickup: { x: 1455, z: -155, label: 'Fells Point Thames St Waterfront Grill' },
    routes: [
      {
        pickupX: 1455,
        pickupZ: -155,
        pickupLabel: 'Fells Point Thames St Waterfront Grill',
        dropoffX: MD_LANDMARKS.baltimoreCamdenYards.x,
        dropoffZ: MD_LANDMARKS.baltimoreCamdenYards.z,
        dropoffLabel: 'Oriole Park at Camden Yards',
      },
      {
        pickupX: 1455,
        pickupZ: -155,
        pickupLabel: 'Fells Point Thames St Waterfront Grill',
        dropoffX: MD_LANDMARKS.isbCampus.x,
        dropoffZ: MD_LANDMARKS.isbCampus.z,
        dropoffLabel: 'Woodlawn / Johnnycake Rd (6631 ISB)',
      },
    ],
  },
  {
    id: 'job_medical',
    title: 'Johns Hopkins–NIH Trauma Med Courier',
    roleLabel: 'MEDICAL EXPRESS',
    icon: '🚑',
    basePay: 3200,
    maxTipBonus: 1000,
    tipBonusMax: 1000,
    timeLimitSec: 115,
    badgeColor: '#10b981',
    description: 'Urgent medical courier dispatch linking Johns Hopkins Hospital in East Baltimore with NIH Clinical Center in Bethesda!',
    fixedPickup: { x: 1440, z: -280, label: 'Johns Hopkins Hospital (Fayette St)' },
    routes: [
      {
        pickupX: 1440,
        pickupZ: -280,
        pickupLabel: 'Johns Hopkins Hospital (Fayette St)',
        dropoffX: MD_LANDMARKS.bethesda.x,
        dropoffZ: MD_LANDMARKS.bethesda.z,
        dropoffLabel: 'NIH Clinical Center (Bethesda)',
      },
      {
        pickupX: MD_LANDMARKS.bethesda.x,
        pickupZ: MD_LANDMARKS.bethesda.z,
        pickupLabel: 'NIH Clinical Center (Bethesda)',
        dropoffX: 1440,
        dropoffZ: -280,
        dropoffLabel: 'Johns Hopkins Hospital Trauma Center',
      },
    ],
  },
];

export interface CityHeistTargetSpec {
  id: string;
  name: string;
  category: 'BANK' | 'JEWELRY' | 'STORE' | 'HOUSE';
  icon: string;
  x: number;
  z: number;
  streetLocation: string;
  payoutCash: number;
  robDurationSec: number;
  wantedStarsTriggered: number;
  cooldownSec: number;
  badgeColor: string;
  description: string;
}

export const CITY_HEIST_TARGETS_CATALOG: CityHeistTargetSpec[] = [
  {
    id: 'bank_central',
    name: 'Baltimore Federal Reserve Bank',
    category: 'BANK',
    icon: '🏦',
    x: MD_LANDMARKS.baltimoreBank.x,
    z: MD_LANDMARKS.baltimoreBank.z,
    streetLocation: '600 E Fayette St & N Charles St (Baltimore)',
    payoutCash: 32000,
    robDurationSec: 4.5,
    wantedStarsTriggered: 5,
    cooldownSec: 75,
    badgeColor: '#facc15',
    description: 'Main downtown Baltimore bank vault. Triggers a ★5 SWAT chase—lose police line-of-sight and reach your House to bank the cash!',
  },
  {
    id: 'bank_pacific_bullion',
    name: 'Annapolis Capital Bullion Depository',
    category: 'BANK',
    icon: '🏦',
    x: MD_LANDMARKS.annapolisStateHouse.x,
    z: MD_LANDMARKS.annapolisStateHouse.z,
    streetLocation: '100 State Circle (Historic Annapolis)',
    payoutCash: 52000,
    robDurationSec: 5.5,
    wantedStarsTriggered: 5,
    cooldownSec: 95,
    badgeColor: '#f59e0b',
    description: 'Fortified state capital treasury vault. $52,000 score triggers a ★5 statewide chase—flee to your Maryland House unseen!',
  },
  {
    id: 'bank_national_harbor',
    name: 'National Harbor MGM Casino Vault',
    category: 'BANK',
    icon: '🎰',
    x: MD_LANDMARKS.nationalHarbor.x,
    z: MD_LANDMARKS.nationalHarbor.z,
    streetLocation: '101 MGM National Ave (National Harbor)',
    payoutCash: 42000,
    robDurationSec: 5.0,
    wantedStarsTriggered: 5,
    cooldownSec: 85,
    badgeColor: '#f97316',
    description: 'High-roller Potomac riverfront casino cage & bullion room—defeat the heavy security detail to crack the vault!',
  },
  {
    id: 'bank_frederick_trust',
    name: 'Frederick Carroll Creek Trust Bank',
    category: 'BANK',
    icon: '🏦',
    x: MD_LANDMARKS.frederick.x,
    z: MD_LANDMARKS.frederick.z,
    streetLocation: '100 N Market St (Frederick)',
    payoutCash: 27500,
    robDurationSec: 4.2,
    wantedStarsTriggered: 5,
    cooldownSec: 70,
    badgeColor: '#fbbf24',
    description: 'Historic red-brick downtown Frederick bank overlooking Carroll Creek & Clustered Spires.',
  },
  {
    id: 'jewelry_diamond_exchange',
    name: 'Bethesda Row Crown & Carat Exchange',
    category: 'JEWELRY',
    icon: '💎',
    x: -505,
    z: 1745,
    streetLocation: '4850 Bethesda Ave & Wisconsin Ave (Bethesda)',
    payoutCash: 24500,
    robDurationSec: 3.8,
    wantedStarsTriggered: 5,
    cooldownSec: 65,
    badgeColor: '#a855f7',
    description: 'High-security Montgomery County jewelry exchange. Triggers a ★5 Pursuit—escape back home unseen!',
  },
  {
    id: 'jewelry_columbia_mall',
    name: 'Columbia Town Center Fine Jewelers',
    category: 'JEWELRY',
    icon: '💎',
    x: 245,
    z: 120,
    streetLocation: '10300 Little Patuxent Pkwy (Columbia)',
    payoutCash: 21000,
    robDurationSec: 3.5,
    wantedStarsTriggered: 5,
    cooldownSec: 60,
    badgeColor: '#c084fc',
    description: 'Luxury diamond boutique beside The Mall in Columbia & Lake Kittamaqundi.',
  },
  {
    id: 'jewelry_vangelico',
    name: 'Harborplace Diamond Exchange',
    category: 'JEWELRY',
    icon: '💎',
    x: 1235,
    z: -160,
    streetLocation: '300 W Pratt St & Light St (Inner Harbor)',
    payoutCash: 18500,
    robDurationSec: 3.2,
    wantedStarsTriggered: 5,
    cooldownSec: 55,
    badgeColor: '#22d3ee',
    description: 'Waterfront Harborplace diamond showroom. Triggers an immediate ★5 Manhunt—evade MSP cruisers to your Safehouse!',
  },
  {
    id: 'house_potomac_estate',
    name: 'Potomac Falls Luxury Mansion',
    category: 'HOUSE',
    icon: '🏰',
    x: -760,
    z: 1680,
    streetLocation: '9800 Falls Rd (Potomac)',
    payoutCash: 28500,
    robDurationSec: 4.0,
    wantedStarsTriggered: 5,
    cooldownSec: 65,
    badgeColor: '#ec4899',
    description: 'Gated Potomac luxury home packed with rare collectibles, watches, and wall safe cash.',
  },
  {
    id: 'house_kentlands_manor',
    name: 'Kentlands Brick Manor',
    category: 'HOUSE',
    icon: '🏠',
    x: gx(-575),
    z: gz(2246),
    streetLocation: '208 Kentlands Blvd (Gaithersburg)',
    payoutCash: 16500,
    robDurationSec: 3.2,
    wantedStarsTriggered: 5,
    cooldownSec: 55,
    badgeColor: '#f472b6',
    description: 'Upscale Gaithersburg brick manor near Kentlands Lake with a basement valuables safe.',
  },
  {
    id: 'house_ellicott_manor',
    name: 'Ellicott City Stone Hillside House',
    category: 'HOUSE',
    icon: '🏡',
    x: 300,
    z: -242,
    streetLocation: '8120 Main St (Ellicott City)',
    payoutCash: 11500,
    robDurationSec: 2.8,
    wantedStarsTriggered: 5,
    cooldownSec: 50,
    badgeColor: '#fb7185',
    description: 'Historic granite hillside home above Patapsco Valley—light bot security with solid loot.',
  },
  {
    id: 'house_silver_spring_brownstone',
    name: 'Silver Spring Georgia Ave Brownstone',
    category: 'HOUSE',
    icon: '🏠',
    x: -198,
    z: 1732,
    streetLocation: '8612 Georgia Ave (Silver Spring)',
    payoutCash: 9500,
    robDurationSec: 2.6,
    wantedStarsTriggered: 5,
    cooldownSec: 45,
    badgeColor: '#fb923c',
    description: 'Urban Montgomery County residence with quick getaway access to Georgia Ave and I-495.',
  },
  {
    id: 'store_rio_electronics',
    name: 'RIO Lakefront Luxury & Tech Boutique',
    category: 'STORE',
    icon: '🛍️',
    x: MD_LANDMARKS.rioLakefront.x,
    z: MD_LANDMARKS.rioLakefront.z,
    streetLocation: '9811 Washingtonian Blvd (Gaithersburg)',
    payoutCash: 14800,
    robDurationSec: 3.0,
    wantedStarsTriggered: 5,
    cooldownSec: 50,
    badgeColor: '#38bdf8',
    description: 'High-end Gaithersburg lakefront boutique stocked with watches, tech, and register cash.',
  },
  {
    id: 'store_neon_mart',
    name: 'Ocean City Boardwalk Vault & Superette',
    category: 'STORE',
    icon: '🏪',
    x: MD_LANDMARKS.oceanCityBoardwalk.x,
    z: MD_LANDMARKS.oceanCityBoardwalk.z,
    streetLocation: '401 Coastal Hwy & Rt 50 Bridge (Ocean City)',
    payoutCash: 12500,
    robDurationSec: 2.5,
    wantedStarsTriggered: 5,
    cooldownSec: 45,
    badgeColor: '#10b981',
    description: 'Resort boardwalk cash safe—triggers ★5 Eastern Shore pursuit across the Bay Bridge to your Safehouse!',
  },
  {
    id: 'store_hagerstown_pawn',
    name: 'Hagerstown Square Gold & Pawn',
    category: 'STORE',
    icon: '🏪',
    x: -1580,
    z: -440,
    streetLocation: '22 W Washington St (Hagerstown)',
    payoutCash: 8800,
    robDurationSec: 2.5,
    wantedStarsTriggered: 5,
    cooldownSec: 45,
    badgeColor: '#34d399',
    description: 'Western Maryland pawn shop & register safe—great lower-bot target right off I-81 & I-70.',
  },
  {
    id: 'store_flower_hill_mart',
    name: 'Flower Hill Corner Market & Safe',
    category: 'STORE',
    icon: '🏪',
    x: gx(174),
    z: gz(2176),
    streetLocation: '18251 Flower Hill Way (Gaithersburg)',
    payoutCash: 7500,
    robDurationSec: 2.2,
    wantedStarsTriggered: 5,
    cooldownSec: 40,
    badgeColor: '#4ade80',
    description: 'Neighborhood Gaithersburg plaza market just down Woodfield Rd—lightest bot security for quick cash!',
  },
];

export interface CityHouseSpec {
  id: string;
  name: string;
  tierLabel: string;
  tier: string;
  icon: string;
  price: number;
  passiveIncomePer30s: number;
  passiveIncomePerMin: number;
  garageSlots: number;
  x: number;
  z: number;
  heading: number;
  spawnHeading: number;
  streetLocation: string;
  badgeColor: string;
  description: string;
}

export const CITY_HOUSES_CATALOG: CityHouseSpec[] = [
  {
    id: 'house_oakwood_bungalow',
    name: 'Catonsville Craftsman Colonial',
    tierLabel: 'STARTER HOUSE',
    tier: 'STARTER HOUSE',
    icon: '🏡',
    price: 7500,
    passiveIncomePer30s: 380,
    passiveIncomePerMin: 760,
    garageSlots: 2,
    x: 785,
    z: -105,
    heading: 0,
    spawnHeading: 0,
    streetLocation: '1211 N Rolling Rd (Catonsville)',
    badgeColor: '#38bdf8',
    description: 'Cozy starter residence minutes from ISB on Johnnycake Rd & I-695 with private driveway and rental income.',
  },
  {
    id: 'house_southside_loft',
    name: 'Rockville Town Square Residence',
    tierLabel: 'ROCKVILLE HOME',
    tier: 'ROCKVILLE HOME',
    icon: '🏠',
    price: 9500,
    passiveIncomePer30s: 450,
    passiveIncomePerMin: 900,
    garageSlots: 2,
    x: -618,
    z: 1378,
    heading: -Math.PI / 2,
    spawnHeading: -Math.PI / 2,
    streetLocation: '215 W Montgomery Ave (Rockville)',
    badgeColor: '#0ea5e9',
    description: 'Classic Montgomery County brick residence near Rockville Town Square & Shady Grove Metro.',
  },
  {
    id: 'house_midtown_townhouse',
    name: 'Frederick Historic Brick Colonial',
    tierLabel: 'FREDERICK HOME',
    tier: 'FREDERICK HOME',
    icon: '🏠',
    price: 24000,
    passiveIncomePer30s: 1100,
    passiveIncomePerMin: 2200,
    garageSlots: 4,
    x: -1112,
    z: -332,
    heading: Math.PI / 2,
    spawnHeading: Math.PI / 2,
    streetLocation: '214 N Market St (Frederick)',
    badgeColor: '#10b981',
    description: 'Historic red-brick residence steps from Carroll Creek Linear Park and Clustered Spires in Downtown Frederick.',
  },
  {
    id: 'house_pinecrest_colonial',
    name: 'Columbia Hickory Ridge Estate',
    tierLabel: 'HOWARD CO COLONIAL',
    tier: 'HOWARD CO COLONIAL',
    icon: '🏡',
    price: 38000,
    passiveIncomePer30s: 1750,
    passiveIncomePerMin: 3500,
    garageSlots: 4,
    x: 228,
    z: 72,
    heading: Math.PI / 2,
    spawnHeading: Math.PI / 2,
    streetLocation: '10420 Hickory Ridge Rd (Columbia)',
    badgeColor: '#22c55e',
    description: 'Spacious Columbia 2-story Colonial near Lake Kittamaqundi & Merriweather Post Pavilion with 4-car garage.',
  },
  {
    id: 'house_harbor_villa',
    name: 'Annapolis City Dock Historic Home',
    tierLabel: 'CAPITAL WATERFRONT',
    tier: 'CAPITAL WATERFRONT',
    icon: '⛵',
    price: 55000,
    passiveIncomePer30s: 2500,
    passiveIncomePerMin: 5000,
    garageSlots: 6,
    x: 1410,
    z: 745,
    heading: 0,
    spawnHeading: 0,
    streetLocation: '148 Prince George St (Annapolis)',
    badgeColor: '#f59e0b',
    description: 'Georgian brick waterfront residence walking distance from Ego Alley and the U.S. Naval Academy.',
  },
  {
    id: 'house_financial_penthouse',
    name: 'Ocean City Atlantic Beach Villa',
    tierLabel: 'COASTAL RESORT',
    tier: 'COASTAL RESORT',
    icon: '🏖️',
    price: 115000,
    passiveIncomePer30s: 5200,
    passiveIncomePerMin: 10400,
    garageSlots: 10,
    x: 2452,
    z: 1060,
    heading: Math.PI / 2,
    spawnHeading: Math.PI / 2,
    streetLocation: '1404 Coastal Hwy (Ocean City)',
    badgeColor: '#a855f7',
    description: 'Pastel oceanfront coastal villa right off Coastal Hwy (MD-528) and steps from Ocean City Boardwalk.',
  },
  {
    id: 'house_belair_mansion',
    name: 'Bethesda Chevy Chase Luxury Estate',
    tierLabel: 'LUXURY MANSION',
    tier: 'LUXURY MANSION',
    icon: '💎',
    price: 175000,
    passiveIncomePer30s: 8200,
    passiveIncomePerMin: 16400,
    garageSlots: 10,
    x: -555,
    z: 1735,
    heading: -Math.PI / 2,
    spawnHeading: -Math.PI / 2,
    streetLocation: '4902 Edgemoor Ln (Bethesda)',
    badgeColor: '#ec4899',
    description: 'Prestigious Bethesda estate just inside I-495 Capital Beltway with panoramic glass wing and collector garage.',
  },
  {
    id: 'house_billionaire_compound',
    name: 'Deep Creek Lakefront Mountain Lodge',
    tierLabel: 'CROWN JEWEL ESTATE',
    tier: 'CROWN JEWEL ESTATE',
    icon: '🏔️',
    price: 240000,
    passiveIncomePer30s: 11500,
    passiveIncomePerMin: 23000,
    garageSlots: 12,
    x: -2365,
    z: -500,
    heading: Math.PI / 2,
    spawnHeading: Math.PI / 2,
    streetLocation: '296 Marsh Hill Rd (Deep Creek Lake)',
    badgeColor: '#facc15',
    description: 'Private Garrett County timber mountain compound overlooking Deep Creek Lake & Wisp Ski Resort with massive cashflow.',
  },
];

const METRO_CITY_SAVE_KEY = 'apex26_metro_city_game_v1';

const LEGACY_CAR_ID_MAP: Record<string, string> = {
  starter_hatch: 'honda_civic',
  ae86_drift: 'toyota_supra_mk4',
  street_tuner: 'nissan_gtr_r34',
  evo_rally: 'nissan_gtr_r35',
  muscle_gt: 'dodge_challenger',
  bavaria_m3: 'bmw_m4',
  cyber_suv: 'cadillac_escalade_v',
  gt3_track: 'porsche_911',
  euro_supercar: 'lamborghini_huracan',
  hyper_gt: 'koenigsegg_regera',
  jesko_megacar: 'koenigsegg_jesko',
  bugatti_tourbillon: 'bugatti_chiron_pur_sport',
  f1_street_legal: 'bugatti_chiron_super_sport',
};

function mapCarId(id: string): string {
  const mapped = LEGACY_CAR_ID_MAP[id] || id;
  return CITY_STREET_CARS.some((c) => c.id === mapped) ? mapped : 'honda_civic';
}

export function loadMetroCitySave(): MetroCitySaveState {
  const defaultUnlockedTrims: Record<string, string[]> = {};
  const defaultActiveTrims: Record<string, string> = {};
  for (const car of CITY_STREET_CARS) {
    if (car.trims.length > 0) {
      defaultUnlockedTrims[car.id] = [car.trims[0].id];
      defaultActiveTrims[car.id] = car.trims[0].id;
    }
  }

  const fallback: MetroCitySaveState = {
    streetCash: 5000,
    ownedCarIds: ['honda_civic', 'toyota_camry'],
    selectedCarId: 'honda_civic',
    customPaintByCar: {},
    unlockedTrimsByCar: defaultUnlockedTrims,
    activeTrimByCar: defaultActiveTrims,
    completedMissions: 0,
    completedMissionIds: [],
    totalEarnedCash: 5000,
    streetRepLevel: 1,
    pendingMissionId: null,
    ownedHouseIds: [],
    activeHomeId: null,
    unpaidCrashTicketsTab: 0,
    totalJobsCompleted: 0,
    totalHeistsCompleted: 0,
    bankRobberyBustCount: 0,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(METRO_CITY_SAVE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);

    const mappedOwnedSet = new Set<string>(['honda_civic', 'toyota_camry']);
    if (Array.isArray(parsed.ownedCarIds)) {
      for (const rawId of parsed.ownedCarIds) {
        if (typeof rawId === 'string') {
          mappedOwnedSet.add(mapCarId(rawId));
        }
      }
    }
    const rawOwned = Array.from(mappedOwnedSet);
    const rawSelected =
      typeof parsed.selectedCarId === 'string' ? mapCarId(parsed.selectedCarId) : 'honda_civic';

    const unlockedTrimsByCar: Record<string, string[]> = { ...defaultUnlockedTrims };
    if (parsed.unlockedTrimsByCar && typeof parsed.unlockedTrimsByCar === 'object') {
      for (const [carId, trimList] of Object.entries(parsed.unlockedTrimsByCar)) {
        const carSpec = CITY_STREET_CARS.find((c) => c.id === carId);
        if (carSpec && Array.isArray(trimList)) {
          const validTrims = trimList.filter(
            (t): t is string => typeof t === 'string' && carSpec.trims.some((tr) => tr.id === t)
          );
          if (!validTrims.includes(carSpec.trims[0].id)) {
            validTrims.unshift(carSpec.trims[0].id);
          }
          unlockedTrimsByCar[carId] = validTrims;
        }
      }
    }

    const activeTrimByCar: Record<string, string> = { ...defaultActiveTrims };
    if (parsed.activeTrimByCar && typeof parsed.activeTrimByCar === 'object') {
      for (const [carId, trimId] of Object.entries(parsed.activeTrimByCar)) {
        const carSpec = CITY_STREET_CARS.find((c) => c.id === carId);
        if (
          carSpec &&
          typeof trimId === 'string' &&
          carSpec.trims.some((tr) => tr.id === trimId)
        ) {
          activeTrimByCar[carId] = trimId;
        }
      }
    }

    const completedMissionIds = Array.isArray(parsed.completedMissionIds)
      ? parsed.completedMissionIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];

    return {
      streetCash: typeof parsed.streetCash === 'number' ? parsed.streetCash : 5000,
      ownedCarIds: rawOwned,
      selectedCarId: rawSelected,
      customPaintByCar:
        parsed.customPaintByCar && typeof parsed.customPaintByCar === 'object'
          ? parsed.customPaintByCar
          : {},
      unlockedTrimsByCar,
      activeTrimByCar,
      completedMissions:
        typeof parsed.completedMissions === 'number'
          ? Math.max(parsed.completedMissions, completedMissionIds.length)
          : completedMissionIds.length,
      completedMissionIds,
      totalEarnedCash: typeof parsed.totalEarnedCash === 'number' ? parsed.totalEarnedCash : 5000,
      streetRepLevel: typeof parsed.streetRepLevel === 'number' ? parsed.streetRepLevel : 1,
      pendingMissionId: typeof parsed.pendingMissionId === 'string' ? parsed.pendingMissionId : null,
      ownedHouseIds: Array.isArray(parsed.ownedHouseIds) ? parsed.ownedHouseIds : [],
      activeHomeId: typeof parsed.activeHomeId === 'string' ? parsed.activeHomeId : null,
      unpaidCrashTicketsTab:
        typeof parsed.unpaidCrashTicketsTab === 'number' ? parsed.unpaidCrashTicketsTab : 0,
      totalJobsCompleted:
        typeof parsed.totalJobsCompleted === 'number' ? parsed.totalJobsCompleted : 0,
      totalHeistsCompleted:
        typeof parsed.totalHeistsCompleted === 'number' ? parsed.totalHeistsCompleted : 0,
      bankRobberyBustCount:
        typeof parsed.bankRobberyBustCount === 'number' ? parsed.bankRobberyBustCount : 0,
    };
  } catch {
    return fallback;
  }
}

export function saveMetroCitySave(state: MetroCitySaveState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(METRO_CITY_SAVE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export interface CityMissionWaypoint {
  x: number;
  z: number;
  label: string;
  minSpeedKmh?: number;
}

export interface CityMissionTemplate {
  id: string;
  level: number;
  title: string;
  type: 'delivery' | 'sprint' | 'speed_trap' | 'getaway' | 'vip_clean';
  rewardCash: number;
  replayCash: number;
  timeLimitSec: number;
  description: string;
  badgeColor: string;
  waypoints: CityMissionWaypoint[];
  requireZeroCrashes?: boolean;
  triggerWantedStars?: number;
}

export const CITY_MISSIONS_CATALOG: CityMissionTemplate[] = [
  {
    id: 'vip_courier_uptown',
    level: 1,
    title: 'Level 1: Woodfield Express to RIO Lakefront',
    type: 'delivery',
    rewardCash: 12000,
    replayCash: 2800,
    timeLimitSec: 65,
    description: 'Pick up documents at ICM (19411 Woodfield Rd) and deliver them down Snouffer School Rd & Sam Eig Hwy to RIO Lakefront.',
    badgeColor: '#38bdf8',
    waypoints: [
      { x: gx(356), z: gz(1845), label: 'ICM Gate · 19411 Woodfield Rd' },
      { x: MD_LANDMARKS.rioLakefront.x, z: MD_LANDMARKS.rioLakefront.z, label: 'RIO Lakefront Promenade' },
    ],
  },
  {
    id: 'downtown_street_sprint',
    level: 2,
    title: 'Level 2: Gaithersburg 3-Landmark Street Sprint',
    type: 'sprint',
    rewardCash: 18000,
    replayCash: 4000,
    timeLimitSec: 80,
    description: 'Sprint across Montgomery Village Ave, Olde Towne Diamond Ave MARC Depot, and Shady Grove Rd!',
    badgeColor: '#10b981',
    waypoints: [
      { x: gx(-25), z: gz(1660), label: 'Checkpoint 1: MD-355 & Montgomery Village Ave' },
      { x: gx(-85), z: gz(2005), label: 'Checkpoint 2: Diamond Ave & MD-355 (Olde Towne)' },
      { x: gx(-135), z: gz(2360), label: 'Finish: Shady Grove Rd & MD-355' },
    ],
  },
  {
    id: 'avenue_speed_trap',
    level: 3,
    title: 'Level 3: I-270 Express 180+ KM/H Radar Run',
    type: 'speed_trap',
    rewardCash: 15000,
    replayCash: 3500,
    timeLimitSec: 65,
    description: 'Merge onto I-270 in Gaithersburg and blast past the Exit 10 Clopper Rd speed trap at 180+ km/h!',
    badgeColor: '#f59e0b',
    waypoints: [
      { x: gx(-365), z: gz(1890), label: 'I-270 Radar Trap (Hit @ 180+ km/h)', minSpeedKmh: 180 },
    ],
  },
  {
    id: 'clean_vip_chauffeur',
    level: 4,
    title: 'Level 4: Executive Chauffeur to Bethesda Row (Zero Crashes)',
    type: 'vip_clean',
    rewardCash: 22000,
    replayCash: 5000,
    timeLimitSec: 95,
    description: 'Escort a VIP guest from Rockville Town Square down MD-355 past NIH to Downtown Bethesda with zero crashes.',
    badgeColor: '#a855f7',
    requireZeroCrashes: true,
    waypoints: [
      { x: MD_LANDMARKS.rockvilleSquare.x, z: MD_LANDMARKS.rockvilleSquare.z, label: 'VIP Pickup: Rockville Town Square' },
      { x: MD_LANDMARKS.bethesda.x, z: MD_LANDMARKS.bethesda.z, label: 'VIP Drop-Off: Bethesda & NIH' },
    ],
  },
  {
    id: 'most_wanted_heist',
    level: 5,
    title: 'Level 5: Baltimore Harbor Vault Heist & Catonsville Escape',
    type: 'getaway',
    rewardCash: 35000,
    replayCash: 7500,
    timeLimitSec: 110,
    description: 'Hit the Inner Harbor Bank (triggers ★3 Pursuit), weave through Downtown Baltimore, and escape out I-70/Rolling Rd!',
    badgeColor: '#ef4444',
    triggerWantedStars: 3,
    waypoints: [
      { x: MD_LANDMARKS.baltimoreBank.x, z: MD_LANDMARKS.baltimoreBank.z, label: 'Baltimore Federal Bank (Triggers ★3 Cops)' },
      { x: MD_LANDMARKS.isbCampus.x, z: MD_LANDMARKS.isbCampus.z, label: 'Johnnycake Rd Safehouse Drop' },
    ],
  },
  {
    id: 'grand_bridge_hyper_dash',
    level: 6,
    title: 'Level 6: Chesapeake Bay Bridge 220+ KM/H Crossing',
    type: 'speed_trap',
    rewardCash: 28000,
    replayCash: 6000,
    timeLimitSec: 105,
    description: 'Race down US-50 past Annapolis and hit 220+ km/h across the 4-mile Chesapeake Bay Bridge suspension span!',
    badgeColor: '#ec4899',
    waypoints: [
      { x: 1540, z: 720, label: 'Sandy Point Bay Bridge West Approach' },
      { x: MD_LANDMARKS.chesapeakeBayBridgeMid.x, z: MD_LANDMARKS.chesapeakeBayBridgeMid.z, label: 'Bay Bridge Mid-Span Radar (Hit @ 220+ km/h)', minSpeedKmh: 220 },
      { x: 2180, z: 740, label: 'Kent Island / Kent Narrows Landing' },
    ],
  },
  {
    id: 'oceanview_casino_highroller',
    level: 7,
    title: 'Level 7: ISB to Hadley Farms & ICM Community Run',
    type: 'vip_clean',
    rewardCash: 32000,
    replayCash: 7000,
    timeLimitSec: 110,
    description: 'Chauffeur community guests cleanly from ISB (6631 Johnnycake Rd) along I-70 & MD-108 through Olney to Hadley Farms & ICM!',
    badgeColor: '#8b5cf6',
    requireZeroCrashes: true,
    waypoints: [
      { x: MD_LANDMARKS.isbCampus.x, z: MD_LANDMARKS.isbCampus.z, label: 'ISB Campus (6631 Johnnycake Rd)' },
      { x: MD_LANDMARKS.olney.x, z: MD_LANDMARKS.olney.z, label: 'Olney Town Center (MD-108)' },
      { x: MD_LANDMARKS.icmCampus.x, z: MD_LANDMARKS.icmCampus.z, label: 'ICM Campus (19411 Woodfield Rd)' },
    ],
  },
  {
    id: 'harbor_contraband_scramble',
    level: 8,
    title: 'Level 8: Port of Baltimore & Fort McHenry Manifest Sprint',
    type: 'delivery',
    rewardCash: 26000,
    replayCash: 5500,
    timeLimitSec: 85,
    description: 'Pick up maritime manifests at National Aquarium Pier 3 and race past Domino Sugar to Fort McHenry!',
    badgeColor: '#06b6d4',
    waypoints: [
      { x: 1335, z: -160, label: 'Pratt St & Aquarium Pier 3' },
      { x: MD_LANDMARKS.baltimoreDominoSugar.x, z: 15, label: 'Domino Sugar Refinery · Key Hwy' },
      { x: 1515, z: 78, label: 'Fort McHenry Star Bastion Gate' },
    ],
  },
  {
    id: 'oceanview_island_grand_prix',
    level: 9,
    title: 'Level 9: Gaithersburg 4-Point Suburban Circuit',
    type: 'sprint',
    rewardCash: 38000,
    replayCash: 8000,
    timeLimitSec: 95,
    description: 'Street circuit linking Olde Towne MARC Station, ICM on Woodfield Rd, Kentlands, and Shady Grove Rd!',
    badgeColor: '#10b981',
    waypoints: [
      { x: gx(-85), z: gz(2005), label: 'Waypoint 1: Diamond Ave & MD-355 (Olde Towne MARC)' },
      { x: gx(356), z: gz(1845), label: 'Waypoint 2: Woodfield Rd & ICM (19411)' },
      { x: gx(-565), z: gz(2210), label: 'Waypoint 3: Kentlands / Quince Orchard' },
      { x: gx(-135), z: gz(2360), label: 'Finish: Shady Grove Rd & MD-355' },
    ],
  },
  {
    id: 'bank_van_intercept_getaway',
    level: 10,
    title: 'Level 10: Annapolis Capital Vault & Beltway Getaway',
    type: 'getaway',
    rewardCash: 52000,
    replayCash: 11000,
    timeLimitSec: 120,
    description: 'Raid the Annapolis Vault (triggers ★4 Pursuit), sprint up I-97 past BWI, and disappear into Catonsville!',
    badgeColor: '#dc2626',
    triggerWantedStars: 4,
    waypoints: [
      { x: MD_LANDMARKS.annapolisStateHouse.x, z: MD_LANDMARKS.annapolisStateHouse.z, label: 'Annapolis State Circle (Triggers ★4 Cops)' },
      { x: MD_LANDMARKS.bwiAirport.x, z: MD_LANDMARKS.bwiAirport.z, label: 'BWI I-195 Escape Gate' },
      { x: 700, z: -280, label: 'Rolling Rd Stash (Catonsville)' },
    ],
  },
  {
    id: 'northshore_prototype_test',
    level: 11,
    title: 'Level 11: I-68 Sideling Hill 210+ KM/H Mountain Run',
    type: 'speed_trap',
    rewardCash: 30000,
    replayCash: 6500,
    timeLimitSec: 90,
    description: 'Climb out of Hagerstown onto I-68 West and thunder through the Sideling Hill rock cut at 210+ km/h!',
    badgeColor: '#f97316',
    waypoints: [
      { x: MD_LANDMARKS.hagerstown.x, z: MD_LANDMARKS.hagerstown.z, label: 'Hagerstown I-81 / I-70 Junction' },
      { x: MD_LANDMARKS.sidelingHill.x, z: MD_LANDMARKS.sidelingHill.z, label: 'Sideling Hill Cut Radar (Hit @ 210+ km/h)', minSpeedKmh: 210 },
      { x: MD_LANDMARKS.cumberland.x, z: MD_LANDMARKS.cumberland.z, label: 'Cumberland Queen City Terminus' },
    ],
  },
  {
    id: 'pine_ridge_mountain_delivery',
    level: 12,
    title: 'Level 12: Patapsco Valley–Ellicott City–Columbia Run',
    type: 'delivery',
    rewardCash: 27000,
    replayCash: 5800,
    timeLimitSec: 85,
    description: 'Carry historic preservation charters from Catonsville through Ellicott City 1830 B&O Station down US-29 to Columbia!',
    badgeColor: '#14b8a6',
    waypoints: [
      { x: 660, z: -140, label: 'Catonsville Frederick Rd' },
      { x: MD_LANDMARKS.ellicottCity.x, z: MD_LANDMARKS.ellicottCity.z, label: 'Ellicott City B&O Station' },
      { x: MD_LANDMARKS.columbia.x, z: MD_LANDMARKS.columbia.z, label: 'Lake Kittamaqundi (Columbia)' },
    ],
  },
  {
    id: 'undercover_sting_pursuit',
    level: 13,
    title: 'Level 13: Baltimore Police HQ Raid & Harbor Escape',
    type: 'getaway',
    rewardCash: 42000,
    replayCash: 9000,
    timeLimitSec: 95,
    description: 'Grab intercepted dispatch files outside Baltimore Police HQ on Fayette St and shake the pursuing cruisers across town!',
    badgeColor: '#b91c1c',
    triggerWantedStars: 3,
    waypoints: [
      { x: MD_LANDMARKS.baltimorePoliceHQ.x, z: MD_LANDMARKS.baltimorePoliceHQ.z, label: 'Baltimore Police HQ (Triggers ★3 Pursuit)' },
      { x: 1455, z: -155, label: 'Fells Point Alley Detour' },
      { x: 1220, z: -860, label: 'Towson Beltway Escape' },
    ],
  },
  {
    id: 'mayors_diplomatic_convoy',
    level: 14,
    title: 'Level 14: UMD College Park–Annapolis Governor Convoy',
    type: 'vip_clean',
    rewardCash: 45000,
    replayCash: 9500,
    timeLimitSec: 115,
    description: 'Escort diplomats cleanly from University of Maryland College Park across US-50 to the Maryland State House in Annapolis.',
    badgeColor: '#6366f1',
    requireZeroCrashes: true,
    waypoints: [
      { x: MD_LANDMARKS.collegeParkUMD.x, z: MD_LANDMARKS.collegeParkUMD.z, label: 'College Park · UMD McKeldin Mall' },
      { x: 760, z: 1280, label: 'US-50 Bowie Checkpoint' },
      { x: MD_LANDMARKS.annapolisStateHouse.x, z: MD_LANDMARKS.annapolisStateHouse.z, label: 'Annapolis State House' },
    ],
  },
  {
    id: 'midnight_drag_strip_radar',
    level: 15,
    title: 'Level 15: I-95 Capital–BWI 220+ KM/H Midnight Run',
    type: 'speed_trap',
    rewardCash: 24000,
    replayCash: 5200,
    timeLimitSec: 80,
    description: 'Line up on I-95 northbound at College Park and punch through the Laurel speed trap at 220+ km/h!',
    badgeColor: '#eab308',
    waypoints: [
      { x: 140, z: 1620, label: 'I-95 / I-495 College Park Merge' },
      { x: 500, z: 680, label: 'Laurel I-95 Radar Trap (Hit @ 220+ km/h)', minSpeedKmh: 220 },
    ],
  },
  {
    id: 'oceanview_supercar_heist',
    level: 16,
    title: 'Level 16: National Harbor Casino Vault & Beltway Manhunt',
    type: 'getaway',
    rewardCash: 65000,
    replayCash: 14000,
    timeLimitSec: 135,
    description: 'Hit the National Harbor Vault on the Potomac (triggers ★5 Pursuit!), race the Capital Beltway, and reach Frederick!',
    badgeColor: '#991b1b',
    triggerWantedStars: 5,
    waypoints: [
      { x: MD_LANDMARKS.nationalHarbor.x, z: MD_LANDMARKS.nationalHarbor.z, label: 'National Harbor Capital Wheel (Triggers ★5!)' },
      { x: MD_LANDMARKS.bethesda.x, z: MD_LANDMARKS.bethesda.z, label: 'I-495 / I-270 Split Northbound' },
      { x: MD_LANDMARKS.frederick.x, z: MD_LANDMARKS.frederick.z, label: 'Frederick Safe Bunker' },
    ],
  },
  {
    id: 'coastal_express_urgent',
    level: 17,
    title: 'Level 17: Johns Hopkins Rapid Medical Run',
    type: 'delivery',
    rewardCash: 21000,
    replayCash: 4500,
    timeLimitSec: 75,
    description: 'Urgent transplant courier run from Johns Hopkins Hospital past Camden Yards to BWI Thurgood Marshall Terminal!',
    badgeColor: '#0284c7',
    waypoints: [
      { x: 1440, z: -280, label: 'Johns Hopkins Hospital' },
      { x: MD_LANDMARKS.bwiAirport.x, z: MD_LANDMARKS.bwiAirport.z, label: 'BWI Airport Priority Hangar' },
    ],
  },
  {
    id: 'five_district_cannonball',
    level: 18,
    title: 'Level 18: Deep Creek to Ocean City Coast-to-Coast Rally',
    type: 'sprint',
    rewardCash: 95000,
    replayCash: 20000,
    timeLimitSec: 210,
    description: 'The ultimate across-Maryland endurance rally from Wisp Resort at Deep Creek through Frederick, Baltimore, & Bay Bridge to Ocean City!',
    badgeColor: '#e11d48',
    waypoints: [
      { x: MD_LANDMARKS.deepCreekLake.x, z: MD_LANDMARKS.deepCreekLake.z, label: 'Start: Deep Creek Lake (Garrett Co)' },
      { x: MD_LANDMARKS.frederick.x, z: MD_LANDMARKS.frederick.z, label: 'CP 1: Historic Frederick' },
      { x: MD_LANDMARKS.baltimoreInnerHarbor.x, z: MD_LANDMARKS.baltimoreInnerHarbor.z, label: 'CP 2: Baltimore Inner Harbor' },
      { x: MD_LANDMARKS.chesapeakeBayBridgeMid.x, z: MD_LANDMARKS.chesapeakeBayBridgeMid.z, label: 'CP 3: Chesapeake Bay Bridge' },
      { x: MD_LANDMARKS.oceanCityBoardwalk.x, z: MD_LANDMARKS.oceanCityBoardwalk.z, label: 'Finish: Ocean City Boardwalk!' },
    ],
  },
  {
    id: 'diamond_syndicate_payoff',
    level: 19,
    title: 'Level 19: Baltimore–Olde Towne Gaithersburg Courier',
    type: 'delivery',
    rewardCash: 36000,
    replayCash: 7800,
    timeLimitSec: 115,
    description: 'Transport sealed armored cases from Baltimore Inner Harbor west across I-70 & MD-27 to Olde Towne Gaithersburg.',
    badgeColor: '#d97706',
    waypoints: [
      { x: 1235, z: -160, label: 'Inner Harbor Armored Vault' },
      { x: MD_LANDMARKS.ellicottCity.x, z: MD_LANDMARKS.ellicottCity.z, label: 'Ellicott City I-70' },
      { x: gx(-85), z: gz(2005), label: 'Olde Towne Gaithersburg Depot' },
    ],
  },
  {
    id: 'ghost_sprint_zero_tolerance',
    level: 20,
    title: 'Level 20: Capital Beltway–NIST Quantum Optics Run',
    type: 'vip_clean',
    rewardCash: 48000,
    replayCash: 10000,
    timeLimitSec: 115,
    description: 'Deliver fragile quantum optics from Silver Spring AFI Plaza around I-495 & I-270 to NIST Labs in Gaithersburg with zero scratches.',
    badgeColor: '#7c3aed',
    requireZeroCrashes: true,
    waypoints: [
      { x: MD_LANDMARKS.silverSpring.x, z: MD_LANDMARKS.silverSpring.z, label: 'Downtown Silver Spring Plaza' },
      { x: MD_LANDMARKS.bethesda.x, z: MD_LANDMARKS.bethesda.z, label: 'Bethesda I-495 / I-270 Split' },
      { x: gx(-465), z: gz(2035), label: 'NIST Federal Campus (Gaithersburg)' },
    ],
  },
];

/**
 * Checks whether a 2D line segment (x1,z1)->(x2,z2) intersects an axis-aligned building box.
 * Used so Police Interceptors only witness red-light violations if they have real Line-of-Sight!
 */
function segmentIntersectsBox(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  box: CityBuildingBox
): boolean {
  let tmin = 0;
  let tmax = 1;
  const dx = x2 - x1;
  const dz = z2 - z1;

  if (Math.abs(dx) < 1e-6) {
    if (x1 < box.minX || x1 > box.maxX) return false;
  } else {
    const invDx = 1 / dx;
    let t1 = (box.minX - x1) * invDx;
    let t2 = (box.maxX - x1) * invDx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (Math.abs(dz) < 1e-6) {
    if (z1 < box.minZ || z1 > box.maxZ) return false;
  } else {
    const invDz = 1 / dz;
    let t1 = (box.minZ - z1) * invDz;
    let t2 = (box.maxZ - z1) * invDz;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return true;
}

/**
 * Returns true ONLY if a police car is within maxSightMeters (default 115m) of the player
 * AND no skyscraper building blocks the police unit's line-of-sight!
 */
export function canCopSeePlayer(
  copPos: THREE.Vector3,
  playerPos: THREE.Vector3,
  buildings: CityBuildingBox[] | undefined,
  maxSightMeters: number = 115
): boolean {
  const dist = Math.hypot(playerPos.x - copPos.x, playerPos.z - copPos.z);
  if (dist > maxSightMeters) return false;
  if (!buildings || buildings.length === 0) return true;

  for (let i = 0; i < buildings.length; i++) {
    if (segmentIntersectsBox(copPos.x, copPos.z, playerPos.x, playerPos.z, buildings[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Computes the deterministic traffic signal state (GREEN / YELLOW / RED) for any intersection (ix, iz) at timeSec.
 */
export function getIntersectionSignalState(ix: number, iz: number, timeSec: number): IntersectionSignalState {
  const cycleLen = 24.0;
  const gridOffset = ((Math.round(ix / 160) + Math.round(iz / 160)) * 2.5) % cycleLen;
  const t = (((timeSec + gridOffset) % cycleLen) + cycleLen) % cycleLen;

  if (t < 9.0) {
    const rem = Number((9.0 - t).toFixed(1));
    return { ns: 'GREEN', ew: 'RED', nsRemainingSec: rem, ewRemainingSec: Number((12.0 - t).toFixed(1)) };
  } else if (t < 12.0) {
    const rem = Number((12.0 - t).toFixed(1));
    return { ns: 'YELLOW', ew: 'RED', nsRemainingSec: rem, ewRemainingSec: rem };
  } else if (t < 21.0) {
    const rem = Number((21.0 - t).toFixed(1));
    return { ns: 'RED', ew: 'GREEN', nsRemainingSec: Number((24.0 - t).toFixed(1)), ewRemainingSec: rem };
  } else {
    const rem = Number((24.0 - t).toFixed(1));
    return { ns: 'RED', ew: 'YELLOW', nsRemainingSec: rem, ewRemainingSec: rem };
  }
}

export function getNearestIntersectionInfo(x: number, z: number, timeSec: number) {
  let bestIx = 0;
  let bestIz = 0;
  let bestDistSq = Infinity;

  for (let i = 0; i < MARYLAND_SIGNAL_JUNCTIONS.length; i++) {
    const jct = MARYLAND_SIGNAL_JUNCTIONS[i];
    const dx = x - jct.x;
    const dz = z - jct.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIx = jct.x;
      bestIz = jct.z;
    }
  }

  const dist = Math.sqrt(bestDistSq);
  const state = getIntersectionSignalState(bestIx, bestIz, timeSec);
  return {
    ix: bestIx,
    iz: bestIz,
    distance: dist,
    state,
  };
}

/**
 * Builds a 3D Glowing Mission Waypoint Beacon (Ground Ring + Sky Light Beam Pillar)
 */
export function buildCityMissionBeacon(): {
  group: THREE.Group;
  setWaypoint: (x: number, z: number, colorHex: string, visible: boolean, pulseTime: number) => void;
} {
  const group = new THREE.Group();
  group.visible = false;

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const ringMesh = new THREE.Mesh(new THREE.RingGeometry(6.5, 8.8, 48), ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.32;
  group.add(ringMesh);

  const innerRingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
  });
  const innerRing = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.0, 36), innerRingMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.33;
  group.add(innerRing);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamMesh = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 7.2, 85, 24, 1, true), beamMat);
  beamMesh.position.y = 42.5;
  group.add(beamMesh);

  return {
    group,
    setWaypoint: (x: number, z: number, colorHex: string, visible: boolean, pulseTime: number) => {
      group.visible = visible;
      if (!visible) return;
      group.position.set(x, 0, z);
      ringMat.color.set(colorHex);
      beamMat.color.set(colorHex);
      const scale = 1.0 + Math.sin(pulseTime * 5.0) * 0.08;
      ringMesh.scale.set(scale, scale, 1);
      innerRing.rotation.z = pulseTime * 1.8;
    },
  };
}

interface GpsRoadNode {
  id: number;
  x: number;
  z: number;
}

interface GpsRoadEdge {
  a: number;
  b: number;
  len: number;
}

let cachedMarylandRoadGraph: {
  nodes: GpsRoadNode[];
  edges: GpsRoadEdge[];
  adj: { to: number; dist: number }[][];
} | null = null;

function getMarylandRoadGraph() {
  if (cachedMarylandRoadGraph) return cachedMarylandRoadGraph;

  const nodes: GpsRoadNode[] = [];
  const nodeMap = new Map<string, number>();
  const edges: GpsRoadEdge[] = [];
  const edgeSet = new Set<string>();

  const getOrAddNode = (x: number, z: number): number => {
    const key = `${Math.round(x)},${Math.round(z)}`;
    const existing = nodeMap.get(key);
    if (existing !== undefined) return existing;
    const id = nodes.length;
    nodes.push({ id, x, z });
    nodeMap.set(key, id);
    return id;
  };

  const addEdge = (idA: number, idB: number) => {
    if (idA === idB) return;
    const lo = Math.min(idA, idB);
    const hi = Math.max(idA, idB);
    const key = `${lo}_${hi}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    const na = nodes[idA];
    const nb = nodes[idB];
    const len = Math.hypot(nb.x - na.x, nb.z - na.z);
    if (len < 0.5) return;
    edges.push({ a: idA, b: idB, len });
  };

  const connectSortedChain = (ids: number[]) => {
    for (let i = 0; i < ids.length - 1; i++) {
      addEdge(ids[i], ids[i + 1]);
    }
  };

  // Build unified statewide Dijkstra road graph directly from Google Maps polylines
  for (const road of ALL_MARYLAND_ROADS) {
    const chain = road.points.map((pt) => getOrAddNode(pt.x, pt.z));
    connectSortedChain(chain);
  }

  // ICM (19411 Woodfield Rd) & Church of the Redeemer (19425 Woodfield Rd) driveway spurs
  const wfIcmJct = getOrAddNode(gx(356), gz(1845));
  const icmLotNode = getOrAddNode(gx(392), gz(1848));
  addEdge(wfIcmJct, icmLotNode);

  const wfRedJct = getOrAddNode(gx(386), gz(1755));
  const redLotNode = getOrAddNode(gx(428), gz(1762));
  addEdge(wfRedJct, redLotNode);

  // ISB (6631 Johnnycake Rd) driveway spur
  const isbJct = getOrAddNode(ISB_CAMPUS_ORIGIN.x, ISB_CAMPUS_ORIGIN.z);
  const isbLotNode = getOrAddNode(778, -328);
  addEdge(isbJct, isbLotNode);

  const adj: { to: number; dist: number }[][] = nodes.map(() => []);
  for (const e of edges) {
    adj[e.a].push({ to: e.b, dist: e.len });
    adj[e.b].push({ to: e.a, dist: e.len });
  }

  cachedMarylandRoadGraph = { nodes, edges, adj };
  return cachedMarylandRoadGraph;
}

function projectPointToRoadGraph(px: number, pz: number) {
  const graph = getMarylandRoadGraph();
  let bestEdgeIdx = 0;
  let bestDistSq = Infinity;
  let bestX = px;
  let bestZ = pz;

  for (let i = 0; i < graph.edges.length; i++) {
    const e = graph.edges[i];
    const na = graph.nodes[e.a];
    const nb = graph.nodes[e.b];
    const dx = nb.x - na.x;
    const dz = nb.z - na.z;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.001) continue;
    const t = Math.max(0, Math.min(1, ((px - na.x) * dx + (pz - na.z) * dz) / lenSq));
    const cx = na.x + dx * t;
    const cz = na.z + dz * t;
    const dSq = (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestEdgeIdx = i;
      bestX = cx;
      bestZ = cz;
    }
  }
  return { edgeIdx: bestEdgeIdx, x: bestX, z: bestZ, dist: Math.sqrt(bestDistSq) };
}

/**
 * Computes an exact shortest-path road-following GPS route across Baltimore, the
 * Central Maryland Corridor (Ellicott City, Columbia, Olney, Rockville), and Gaithersburg.
 */
export function computeCityGpsRoute(
  startX: number,
  startZ: number,
  destX: number,
  destZ: number
): { x: number; z: number }[] {
  const graph = getMarylandRoadGraph();
  const baseCount = graph.nodes.length;
  const sProj = projectPointToRoadGraph(startX, startZ);
  const dProj = projectPointToRoadGraph(destX, destZ);

  const sId = baseCount;
  const dId = baseCount + 1;
  const totalNodes = baseCount + 2;

  const extraAdj: { to: number; dist: number }[][] = Array.from({ length: totalNodes }, (_, idx) =>
    idx < baseCount ? [...graph.adj[idx]] : []
  );

  const connectTempNode = (tempId: number, px: number, pz: number, edgeIdx: number) => {
    const e = graph.edges[edgeIdx];
    const na = graph.nodes[e.a];
    const nb = graph.nodes[e.b];
    const da = Math.hypot(px - na.x, pz - na.z);
    const db = Math.hypot(px - nb.x, pz - nb.z);
    extraAdj[tempId].push({ to: e.a, dist: da });
    extraAdj[e.a].push({ to: tempId, dist: da });
    extraAdj[tempId].push({ to: e.b, dist: db });
    extraAdj[e.b].push({ to: tempId, dist: db });
  };

  connectTempNode(sId, sProj.x, sProj.z, sProj.edgeIdx);
  connectTempNode(dId, dProj.x, dProj.z, dProj.edgeIdx);
  if (sProj.edgeIdx === dProj.edgeIdx) {
    const direct = Math.hypot(dProj.x - sProj.x, dProj.z - sProj.z);
    extraAdj[sId].push({ to: dId, dist: direct });
    extraAdj[dId].push({ to: sId, dist: direct });
  }

  // Dijkstra shortest-path across Maryland road graph
  const distArr = new Float64Array(totalNodes).fill(Infinity);
  const prevArr = new Int32Array(totalNodes).fill(-1);
  const visited = new Uint8Array(totalNodes);
  distArr[sId] = 0;

  for (let step = 0; step < totalNodes; step++) {
    let u = -1;
    let bestD = Infinity;
    for (let i = 0; i < totalNodes; i++) {
      if (!visited[i] && distArr[i] < bestD) {
        bestD = distArr[i];
        u = i;
      }
    }
    if (u === -1 || u === dId || bestD === Infinity) break;
    visited[u] = 1;

    const neighbors = extraAdj[u];
    for (let k = 0; k < neighbors.length; k++) {
      const edge = neighbors[k];
      if (visited[edge.to]) continue;
      const nd = bestD + edge.dist;
      if (nd < distArr[edge.to]) {
        distArr[edge.to] = nd;
        prevArr[edge.to] = u;
      }
    }
  }

  const rawPts: { x: number; z: number }[] = [];
  let cur = dId;
  while (cur !== -1) {
    if (cur === sId) {
      rawPts.push({ x: sProj.x, z: sProj.z });
    } else if (cur === dId) {
      rawPts.push({ x: dProj.x, z: dProj.z });
    } else {
      rawPts.push({ x: graph.nodes[cur].x, z: graph.nodes[cur].z });
    }
    cur = prevArr[cur];
  }
  rawPts.reverse();

  if (rawPts.length === 0) {
    return [
      { x: startX, z: startZ },
      { x: destX, z: destZ },
    ];
  }

  // Prepend off-road start spur & append off-road destination spur (like parking lots)
  const fullPts: { x: number; z: number }[] = [];
  if (Math.hypot(startX - rawPts[0].x, startZ - rawPts[0].z) > 2.5) {
    fullPts.push({ x: startX, z: startZ });
  }
  for (const p of rawPts) {
    const last = fullPts[fullPts.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 1.5) {
      fullPts.push(p);
    }
  }
  const tail = fullPts[fullPts.length - 1];
  if (!tail || Math.hypot(destX - tail.x, destZ - tail.z) > 2.5) {
    fullPts.push({ x: destX, z: destZ });
  }

  // Simplify collinear straightaways so gpsRoutePts[1] always represents the true next turn corner
  const simplified: { x: number; z: number }[] = [];
  for (let i = 0; i < fullPts.length; i++) {
    const pt = fullPts[i];
    if (simplified.length >= 2) {
      const a = simplified[simplified.length - 2];
      const b = simplified[simplified.length - 1];
      const v1x = b.x - a.x;
      const v1z = b.z - a.z;
      const v2x = pt.x - b.x;
      const v2z = pt.z - b.z;
      const l1 = Math.hypot(v1x, v1z);
      const l2 = Math.hypot(v2x, v2z);
      if (l1 > 0.1 && l2 > 0.1) {
        const dot = (v1x * v2x + v1z * v2z) / (l1 * l2);
        if (dot > 0.996) {
          simplified[simplified.length - 1] = pt;
          continue;
        }
      }
    }
    simplified.push(pt);
  }
  return simplified;
}

export interface MarylandGpsEntry {
  id: string;
  label: string;
  address: string;
  category: string;
  icon: string;
  x: number;
  z: number;
  color: string;
  keywords: string;
}

const STATIC_MARYLAND_GPS_ENTRIES: MarylandGpsEntry[] = (() => {
  const entries: MarylandGpsEntry[] = [];

  // 1. All Heist Targets (Banks, Jewelry, Houses, Stores)
  for (const h of CITY_HEIST_TARGETS_CATALOG) {
    entries.push({
      id: `gps_heist_${h.id}`,
      label: h.name,
      address: h.streetLocation,
      category: h.category,
      icon: h.icon,
      x: h.x,
      z: h.z,
      color: h.badgeColor,
      keywords: `${h.name} ${h.streetLocation} ${h.category} rob heist`.toLowerCase(),
    });
  }

  // 2. All Real Estate Houses
  for (const house of CITY_HOUSES_CATALOG) {
    entries.push({
      id: `gps_house_${house.id}`,
      label: house.name,
      address: house.streetLocation,
      category: 'PROPERTY',
      icon: house.icon,
      x: house.x,
      z: house.z,
      color: house.badgeColor,
      keywords: `${house.name} ${house.streetLocation} house home property`.toLowerCase(),
    });
  }

  // 3. Real Maryland Addresses, Neighborhoods, Schools, Mosques, & Landmarks
  const curated: Omit<MarylandGpsEntry, 'keywords'>[] = [
    {
      id: 'gps_icm',
      label: 'Islamic Center of Maryland (ICM)',
      address: '19411 Woodfield Rd, Gaithersburg, MD',
      category: 'LANDMARK',
      icon: '🕌',
      x: MD_LANDMARKS.icmCampus.x,
      z: MD_LANDMARKS.icmCampus.z,
      color: '#10b981',
    },
    {
      id: 'gps_redeemer',
      label: 'Church of the Redeemer',
      address: '19425 Woodfield Rd, Gaithersburg, MD',
      category: 'LANDMARK',
      icon: '⛪',
      x: gx(386),
      z: gz(1755),
      color: '#cbd5e1',
    },
    {
      id: 'gps_isb',
      label: 'Islamic Society of Baltimore (ISB)',
      address: '6631 Johnnycake Rd, Woodlawn, MD',
      category: 'LANDMARK',
      icon: '🕌',
      x: MD_LANDMARKS.isbCampus.x,
      z: MD_LANDMARKS.isbCampus.z,
      color: '#eab308',
    },
    {
      id: 'gps_hadley_es',
      label: 'Judith A. Resnik Elementary · Hadley Farms',
      address: '7301 Hadley Farms Dr, Gaithersburg, MD',
      category: 'NEIGHBORHOOD',
      icon: '🏫',
      x: MD_LANDMARKS.hadleyFarms.x,
      z: MD_LANDMARKS.hadleyFarms.z,
      color: '#22c55e',
    },
    {
      id: 'gps_edinburgh',
      label: 'Edinburgh Village (Brenish Dr & Kildonan Dr)',
      address: '7508 Brenish Dr, Gaithersburg, MD',
      category: 'NEIGHBORHOOD',
      icon: '🏘️',
      x: gx(472),
      z: gz(1668),
      color: '#4ade80',
    },
    {
      id: 'gps_goshen_giant',
      label: 'Goshen Crossing Shopping Center (Giant)',
      address: '20044 Goshen Rd, Gaithersburg, MD',
      category: 'PLAZA',
      icon: '🛒',
      x: gx(-296),
      z: gz(1560),
      color: '#22c55e',
    },
    {
      id: 'gps_nist',
      label: 'NIST Federal Research Campus',
      address: '100 Bureau Dr, Gaithersburg, MD',
      category: 'CAMPUS',
      icon: '🔬',
      x: gx(-465),
      z: gz(2035),
      color: '#38bdf8',
    },
    {
      id: 'gps_kgai',
      label: 'Montgomery County Airpark (KGAI)',
      address: '7915 Cessna Ave / Airpark Rd, Gaithersburg, MD',
      category: 'AIRPORT',
      icon: '🛩️',
      x: MD_LANDMARKS.kgaiAirpark.x,
      z: MD_LANDMARKS.kgaiAirpark.z,
      color: '#60a5fa',
    },
    {
      id: 'gps_marc_oldetowne',
      label: 'Olde Towne Gaithersburg MARC Station',
      address: '5 S Summit Ave / E Diamond Ave, Gaithersburg, MD',
      category: 'TRANSIT',
      icon: '🚆',
      x: gx(-125),
      z: gz(1975),
      color: '#f59e0b',
    },
    {
      id: 'gps_police_hq',
      label: 'Baltimore Police Headquarters',
      address: '601 E Fayette St, Baltimore, MD',
      category: 'PRECINCT',
      icon: '🚔',
      x: MD_LANDMARKS.baltimorePoliceHQ.x,
      z: MD_LANDMARKS.baltimorePoliceHQ.z,
      color: '#38bdf8',
    },
    {
      id: 'gps_dealership',
      label: 'Baltimore Luxury Auto Dealership',
      address: '210 E Fayette St, Baltimore, MD',
      category: 'DEALER',
      icon: '🚘',
      x: MD_LANDMARKS.baltimoreDealership.x,
      z: MD_LANDMARKS.baltimoreDealership.z,
      color: '#ec4899',
    },
    {
      id: 'gps_inner_harbor',
      label: 'Baltimore Inner Harbor & World Trade Center',
      address: '401 E Pratt St, Baltimore, MD',
      category: 'LANDMARK',
      icon: '⚓',
      x: MD_LANDMARKS.baltimoreInnerHarbor.x,
      z: MD_LANDMARKS.baltimoreInnerHarbor.z,
      color: '#38bdf8',
    },
    {
      id: 'gps_camden_yards',
      label: 'Oriole Park at Camden Yards',
      address: '333 W Camden St, Baltimore, MD',
      category: 'STADIUM',
      icon: '⚾',
      x: MD_LANDMARKS.baltimoreCamdenYards.x,
      z: MD_LANDMARKS.baltimoreCamdenYards.z,
      color: '#f97316',
    },
    {
      id: 'gps_domino_sugar',
      label: 'Domino Sugar Refinery (Key Hwy)',
      address: '1100 E Key Hwy, Baltimore, MD',
      category: 'LANDMARK',
      icon: '🏭',
      x: MD_LANDMARKS.baltimoreDominoSugar.x,
      z: MD_LANDMARKS.baltimoreDominoSugar.z,
      color: '#f43f5e',
    },
    {
      id: 'gps_bwi',
      label: 'BWI Thurgood Marshall Airport',
      address: '7050 Friendship Rd, Linthicum Heights, MD',
      category: 'AIRPORT',
      icon: '✈️',
      x: MD_LANDMARKS.bwiAirport.x,
      z: MD_LANDMARKS.bwiAirport.z,
      color: '#60a5fa',
    },
    {
      id: 'gps_usna',
      label: 'U.S. Naval Academy & Annapolis City Dock',
      address: '121 Blake Rd / Dock St, Annapolis, MD',
      category: 'LANDMARK',
      icon: '⛵',
      x: MD_LANDMARKS.annapolisCityDock.x,
      z: MD_LANDMARKS.annapolisCityDock.z,
      color: '#f59e0b',
    },
    {
      id: 'gps_bay_bridge',
      label: 'Chesapeake Bay Bridge (US-50)',
      address: 'US-50 Bay Bridge Mid-Span, MD',
      category: 'BRIDGE',
      icon: '🌉',
      x: MD_LANDMARKS.chesapeakeBayBridgeMid.x,
      z: MD_LANDMARKS.chesapeakeBayBridgeMid.z,
      color: '#38bdf8',
    },
    {
      id: 'gps_umd',
      label: 'University of Maryland (College Park)',
      address: '100 McKeldin Mall / Baltimore Ave, College Park, MD',
      category: 'CAMPUS',
      icon: '🐢',
      x: MD_LANDMARKS.collegeParkUMD.x,
      z: MD_LANDMARKS.collegeParkUMD.z,
      color: '#ef4444',
    },
    {
      id: 'gps_shady_grove',
      label: 'Shady Grove WMATA Metro Station',
      address: '15903 Somerville Dr, Derwood / Rockville, MD',
      category: 'TRANSIT',
      icon: '🚇',
      x: MD_LANDMARKS.shadyGroveMetro.x,
      z: MD_LANDMARKS.shadyGroveMetro.z,
      color: '#ef4444',
    },
    {
      id: 'gps_rockville_sq',
      label: 'Rockville Town Square',
      address: '200 E Middle Ln, Rockville, MD',
      category: 'CITY',
      icon: '🏙️',
      x: MD_LANDMARKS.rockvilleSquare.x,
      z: MD_LANDMARKS.rockvilleSquare.z,
      color: '#38bdf8',
    },
    {
      id: 'gps_bethesda',
      label: 'Downtown Bethesda & NIH Clinical Center',
      address: '7500 Wisconsin Ave, Bethesda, MD',
      category: 'CITY',
      icon: '🏥',
      x: MD_LANDMARKS.bethesda.x,
      z: MD_LANDMARKS.bethesda.z,
      color: '#a855f7',
    },
    {
      id: 'gps_silver_spring',
      label: 'Downtown Silver Spring & AFI Theatre',
      address: '8633 Colesville Rd / Georgia Ave, Silver Spring, MD',
      category: 'CITY',
      icon: '🎬',
      x: MD_LANDMARKS.silverSpring.x,
      z: MD_LANDMARKS.silverSpring.z,
      color: '#fbbf24',
    },
    {
      id: 'gps_olney',
      label: 'Olney Town Center & Olney Theatre',
      address: '2001 Olney-Sandy Spring Rd (MD-108), Olney, MD',
      category: 'CITY',
      icon: '🎭',
      x: MD_LANDMARKS.olney.x,
      z: MD_LANDMARKS.olney.z,
      color: '#22c55e',
    },
    {
      id: 'gps_columbia',
      label: 'The Mall in Columbia & Lake Kittamaqundi',
      address: '10300 Little Patuxent Pkwy, Columbia, MD',
      category: 'CITY',
      icon: '🛍️',
      x: MD_LANDMARKS.columbia.x,
      z: MD_LANDMARKS.columbia.z,
      color: '#22c55e',
    },
    {
      id: 'gps_ellicott_city',
      label: 'Historic Ellicott City Main St & 1830 B&O Depot',
      address: '3711 Maryland Ave, Ellicott City, MD',
      category: 'CITY',
      icon: '🚂',
      x: MD_LANDMARKS.ellicottCity.x,
      z: MD_LANDMARKS.ellicottCity.z,
      color: '#cbd5e1',
    },
    {
      id: 'gps_hagerstown',
      label: 'Hagerstown Courthouse Square',
      address: '100 W Washington St, Hagerstown, MD',
      category: 'CITY',
      icon: '🏛️',
      x: MD_LANDMARKS.hagerstown.x,
      z: MD_LANDMARKS.hagerstown.z,
      color: '#cbd5e1',
    },
    {
      id: 'gps_cumberland',
      label: 'Cumberland Queen City Station',
      address: '13 Canal St, Cumberland, MD',
      category: 'CITY',
      icon: '🚂',
      x: MD_LANDMARKS.cumberland.x,
      z: MD_LANDMARKS.cumberland.z,
      color: '#f87171',
    },
    {
      id: 'gps_deep_creek',
      label: 'Deep Creek Lake & Wisp Mountain Resort',
      address: '296 Marsh Hill Rd, McHenry, MD',
      category: 'RESORT',
      icon: '🏔️',
      x: MD_LANDMARKS.deepCreekLake.x,
      z: MD_LANDMARKS.deepCreekLake.z,
      color: '#38bdf8',
    },
    {
      id: 'gps_emory_church',
      label: 'Emory Church Rd Residential Block',
      address: '7204 Emory Church Rd, Gaithersburg, MD',
      category: 'STREET',
      icon: '🏡',
      x: gx(255),
      z: gz(1868),
      color: '#34d399',
    },
    {
      id: 'gps_tarfside',
      label: 'Tarfside Ln Cul-de-Sac (Edinburgh Village)',
      address: '7528 Tarfside Ln, Gaithersburg, MD',
      category: 'STREET',
      icon: '🏡',
      x: gx(494),
      z: gz(1692),
      color: '#4ade80',
    },
  ];

  for (const item of curated) {
    entries.push({
      ...item,
      keywords: `${item.label} ${item.address} ${item.category}`.toLowerCase(),
    });
  }

  return entries;
})();

function interpolateRoadPolylinePoint(
  points: { x: number; z: number }[],
  fraction: number
): { x: number; z: number } {
  if (points.length === 0) return { x: 0, z: 0 };
  if (points.length === 1) return points[0];
  const f = Math.max(0.05, Math.min(0.95, fraction));
  const segCount = points.length - 1;
  const scaled = f * segCount;
  const idx = Math.min(segCount - 1, Math.floor(scaled));
  const t = scaled - idx;
  const a = points[idx];
  const b = points[idx + 1];
  return {
    x: Math.round(a.x + (b.x - a.x) * t),
    z: Math.round(a.z + (b.z - a.z) * t),
  };
}

/**
 * Searches all Maryland landmarks, heist targets, houses, neighborhoods, and road polylines
 * (including typed street-number + road queries like "19500 Woodfield Rd" or "400 Pratt St").
 */
export function searchMarylandGpsDirectory(rawQuery: string): MarylandGpsEntry[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return STATIC_MARYLAND_GPS_ENTRIES.slice(0, 8);
  }

  const lower = trimmed.toLowerCase();
  const streetNumMatch = lower.match(/^\s*(\d{1,6})\s+(.+)$/);
  const houseNumber = streetNumMatch ? Number(streetNumMatch[1]) : null;
  const streetPart = streetNumMatch ? streetNumMatch[2].trim() : lower;
  const tokens = streetPart.split(/[\s,.-]+/).filter(Boolean);

  const results: { score: number; entry: MarylandGpsEntry }[] = [];

  // 1. Score exact & partial matches in curated directory (targets, houses, landmarks, addresses)
  for (const entry of STATIC_MARYLAND_GPS_ENTRIES) {
    const addrLower = entry.address.toLowerCase();
    const labelLower = entry.label.toLowerCase();
    let score = 0;

    if (addrLower.startsWith(lower) || labelLower.startsWith(lower)) {
      score += 120;
    } else if (addrLower.includes(lower) || labelLower.includes(lower)) {
      score += 80;
    } else if (tokens.length > 0 && tokens.every((tok) => entry.keywords.includes(tok))) {
      score += 55;
    } else if (houseNumber !== null && tokens.length > 0 && tokens.every((tok) => entry.keywords.includes(tok))) {
      score += 45;
    }

    if (houseNumber !== null && addrLower.includes(String(houseNumber))) {
      score += 65;
    }

    if (score > 0) {
      results.push({ score, entry });
    }
  }

  // 2. Match ANY road in ALL_MARYLAND_ROADS (synthesizing exact address coordinates if house # typed!)
  for (const road of ALL_MARYLAND_ROADS) {
    const rName = road.name.toLowerCase();
    const roadMatches =
      rName.includes(streetPart) ||
      (tokens.length > 0 && tokens.every((tok) => rName.includes(tok)));
    if (!roadMatches) continue;

    const frac = houseNumber !== null ? ((houseNumber % 900) / 900) * 0.8 + 0.1 : 0.5;
    const pt = interpolateRoadPolylinePoint(road.points, frac);
    const displayAddr =
      houseNumber !== null ? `${houseNumber} ${road.name}` : road.name;

    results.push({
      score: houseNumber !== null ? 72 : 42,
      entry: {
        id: `gps_road_${road.id}_${houseNumber ?? 'mid'}`,
        label: houseNumber !== null ? `${houseNumber} ${road.name}` : road.name,
        address: `${displayAddr} (${road.region.replace('_', ' ').toUpperCase()})`,
        category: road.isHighway ? 'HIGHWAY' : 'STREET',
        icon: road.isHighway ? '🛣️' : '📍',
        x: pt.x,
        z: pt.z,
        color: '#a855f7',
        keywords: rName,
      },
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 8).map((r) => r.entry);
}

/**
 * Builds a 3D glowing street-level GPS route ribbon so the player can follow turn-by-turn
 * navigation right on the asphalt across all of Maryland.
 */
export function buildCityGpsRouteLine(): {
  group: THREE.Group;
  updateRoute: (points: { x: number; z: number }[], colorHex: string, visible: boolean) => void;
} {
  const group = new THREE.Group();
  const maxSegments = 36;
  const segMeshes: THREE.Mesh[] = [];
  const segMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  for (let i = 0; i < maxSegments; i++) {
    const geom = new THREE.PlaneGeometry(2.6, 1.0);
    geom.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geom, segMat);
    mesh.position.y = 0.36;
    mesh.visible = false;
    group.add(mesh);
    segMeshes.push(mesh);
  }

  return {
    group,
    updateRoute: (points: { x: number; z: number }[], colorHex: string, visible: boolean) => {
      group.visible = visible;
      if (!visible || points.length < 2) {
        for (const m of segMeshes) m.visible = false;
        return;
      }
      segMat.color.set(colorHex);
      let used = 0;
      for (let i = 0; i < points.length - 1 && used < maxSegments; i++) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 1.0) continue;
        const mesh = segMeshes[used++];
        mesh.visible = true;
        mesh.position.set((a.x + b.x) * 0.5, 0.36, (a.z + b.z) * 0.5);
        mesh.rotation.set(0, Math.atan2(dx, dz), 0);
        mesh.scale.set(1, 1, len);
      }
      for (let i = used; i < maxSegments; i++) {
        segMeshes[i].visible = false;
      }
    },
  };
}

/**
 * Builds 3D Interactive Storefront Zones, Neon Arches, and Floating 3D Emblems for:
 * - Banks & Bullion Vaults (Gold pillars + rotating gold bar emblem)
 * - Jewelry Stores & Diamond Exchanges (Cyan/Magenta arches + rotating 3D diamond crystal)
 * - Buyable Houses, Penthouses & Estates (Emerald/Gold property zones)
 */
export function buildCityInteractiveLandmarks(): {
  group: THREE.Group;
  update: (timeSec: number, cooldownMap: Record<string, number>, ownedHouseIds: string[]) => void;
} {
  const group = new THREE.Group();
  const spinningEmblems: {
    id: string;
    isHeist: boolean;
    mesh: THREE.Mesh;
    ringMat: THREE.MeshBasicMaterial;
    baseColorHex: string;
  }[] = [];

  // 1. Build 3D Heist Storefronts (Banks, Jewelry Stores, 24/7 Store)
  for (const h of CITY_HEIST_TARGETS_CATALOG) {
    const sub = new THREE.Group();
    sub.position.set(h.x, 0, h.z);

    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(h.badgeColor),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 5.6, 36), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.285;
    sub.add(ring);

    // Floating 3D Emblem (Octahedron Diamond for Jewelry, Roof Pyramid for House, Bullion/Crate for Bank/Store)
    // Kept cleanly overhead (no solid roadside pillars blocking driving lanes)
    const emblemGeom =
      h.category === 'JEWELRY'
        ? new THREE.OctahedronGeometry(1.15, 0)
        : h.category === 'HOUSE'
        ? new THREE.ConeGeometry(1.2, 1.25, 4)
        : new THREE.BoxGeometry(1.6, 0.9, 0.9);
    const emblemMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(h.badgeColor),
    });
    const emblem = new THREE.Mesh(emblemGeom, emblemMat);
    emblem.position.set(0, 5.2, 0);
    sub.add(emblem);

    group.add(sub);
    spinningEmblems.push({
      id: h.id,
      isHeist: true,
      mesh: emblem,
      ringMat,
      baseColorHex: h.badgeColor,
    });
  }

  // 2. Build 3D Real Estate / House Driveway Markers
  for (const prop of CITY_HOUSES_CATALOG) {
    const sub = new THREE.Group();
    sub.position.set(prop.x, 0, prop.z);

    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(prop.badgeColor),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.8, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.30;
    sub.add(ring);

    const roofCone = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 1.1, 4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(prop.badgeColor) })
    );
    roofCone.position.set(0, 4.2, 0);
    roofCone.rotation.y = Math.PI / 4;
    sub.add(roofCone);

    group.add(sub);
    spinningEmblems.push({
      id: prop.id,
      isHeist: false,
      mesh: roofCone,
      ringMat,
      baseColorHex: prop.badgeColor,
    });
  }

  // 3. Build 3D Police Precinct Drive-In Activation Glowing Spot (right in front of Baltimore Police HQ)
  const policePortal = new THREE.Group();
  policePortal.position.set(MD_LANDMARKS.baltimorePoliceHQ.x, 0, MD_LANDMARKS.baltimorePoliceHQ.z);

  const policeRingMat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const policeGroundRing = new THREE.Mesh(new THREE.RingGeometry(4.5, 7.2, 40), policeRingMat);
  policeGroundRing.rotation.x = -Math.PI / 2;
  policeGroundRing.position.y = 0.28;
  policePortal.add(policeGroundRing);

  const policeInnerDisc = new THREE.Mesh(
    new THREE.CircleGeometry(4.4, 32),
    new THREE.MeshBasicMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  );
  policeInnerDisc.rotation.x = -Math.PI / 2;
  policeInnerDisc.position.y = 0.27;
  policePortal.add(policeInnerDisc);

  // Rotating 3D Police Badge Star / Shield Emblem
  const badgeShape = new THREE.CylinderGeometry(1.4, 1.4, 0.4, 7);
  const badgeMesh = new THREE.Mesh(
    badgeShape,
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.8,
      metalness: 0.85,
      roughness: 0.2,
    })
  );
  badgeMesh.position.set(0, 3.8, 0);
  policePortal.add(badgeMesh);

  // Vertical glowing beacon cylinder
  const policeBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 2.8, 12, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    })
  );
  policeBeam.position.set(0, 6.2, 0);
  policePortal.add(policeBeam);

  group.add(policePortal);
  spinningEmblems.push({
    id: 'mcpd_drive_in_spot',
    isHeist: false,
    mesh: badgeMesh,
    ringMat: policeRingMat,
    baseColorHex: '#3b82f6',
  });

  return {
    group,
    update: (timeSec: number, cooldownMap: Record<string, number>, ownedHouseIds: string[]) => {
      policeBeam.rotation.y = -timeSec * 0.8;
      policeGroundRing.scale.setScalar(1.0 + Math.sin(timeSec * 3.5) * 0.08);
      for (let i = 0; i < spinningEmblems.length; i++) {
        const item = spinningEmblems[i];
        item.mesh.rotation.y = timeSec * 1.8 + i;
        if (item.id === 'mcpd_drive_in_spot') {
          item.ringMat.opacity = 0.75 + Math.sin(timeSec * 4.5) * 0.22;
          continue;
        }
        if (item.isHeist) {
          const cd = cooldownMap[item.id] || 0;
          if (cd > 0) {
            item.ringMat.color.setHex(0x475569);
            item.ringMat.opacity = 0.35;
          } else {
            item.ringMat.color.set(item.baseColorHex);
            item.ringMat.opacity = 0.75 + Math.sin(timeSec * 4.5) * 0.18;
          }
        } else {
          const owned = ownedHouseIds.includes(item.id);
          item.ringMat.color.set(owned ? '#10b981' : item.baseColorHex);
          item.ringMat.opacity = owned ? 0.9 : 0.65;
        }
      }
    },
  };
}

/**
 * Dynamically swaps the Player's 3D Vehicle in City Mode to an authentic, recognizable 3D car model
 * matching each real-world car (Honda Civic, Toyota Camry, Supra Mk5/Mk4, GT-R R34/Z-Tune/R35, Camaro,
 * Challenger, Charger, BMW M4, Escalade/Escalade-V, 911, Huracán, Spéirling, Nevera, Regera, Agera RS,
 * Chiron Pur Sport/Super Sport, and Koenigsegg Jesko Attack/Absolut) and its active Trim Level aero!
 */
export function applyPlayerStreetCarVisual(
  playerCar: BuiltCar,
  spec: StreetCarSpec,
  customColorHex?: string,
  activeTrimId?: string
): void {
  const existingOverlay = playerCar.root.getObjectByName('city_street_car_overlay');
  if (existingOverlay) {
    playerCar.root.remove(existingOverlay);
  }

  // Always hide native open-wheel F1 children in City Mode while keeping sparksPoints
  playerCar.root.children.forEach((child) => {
    if (child === playerCar.sparksPoints) {
      child.visible = true;
    } else {
      child.visible = false;
    }
  });

  const effective = getEffectiveStreetCarSpec(spec, activeTrimId);
  const trim = effective.activeTrim;
  const archetype = spec.modelArchetype;

  const overlay = new THREE.Group();
  overlay.name = 'city_street_car_overlay';

  const paintColor = new THREE.Color(customColorHex || spec.defaultColor);
  const accentColor = new THREE.Color(effective.accentColor);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: paintColor,
    metalness: 0.62,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.025,
    reflectivity: 1.0,
    envMapIntensity: 1.45,
  });
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    metalness: 0.65,
    roughness: 0.16,
    clearcoat: 0.92,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.35,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x05080f,
    metalness: 0.25,
    roughness: 0.03,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    reflectivity: 1.0,
    envMapIntensity: 1.65,
  });
  const carbonMat = new THREE.MeshPhysicalMaterial({
    color: 0x121316,
    metalness: 0.45,
    roughness: 0.28,
    clearcoat: 0.68,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.15,
  });
  const darkGrilleMat = new THREE.MeshStandardMaterial({
    color: 0x060608,
    metalness: 0.32,
    roughness: 0.65,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.96,
    roughness: 0.08,
    envMapIntensity: 1.55,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    metalness: 0.95,
    roughness: 0.11,
    envMapIntensity: 1.5,
  });
  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.88,
    roughness: 0.24,
  });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const yellowDrlMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const brakeMat =
    (playerCar.tailLight.material as THREE.MeshBasicMaterial) ||
    new THREE.MeshBasicMaterial({ color: 0xff1e1e });

  // Archetype-specific real-world dimensions & proportions
  let carWidth = 1.96;
  let carLen = 4.6;
  let lowerH = 0.5;
  let cabinH = 0.44;
  let cabinLen = 2.15;
  let cabinZ = 0.08;
  let cabinWidthRatio = 0.82;
  let wheelRadius = 0.35;

  if (archetype === 'honda_civic') {
    carWidth = trim.aeroStyle === 'gt_wing' ? 1.92 : 1.84; // FL5 Type R wider fenders
    carLen = 4.55;
    lowerH = 0.52;
    cabinH = 0.46;
    cabinLen = 2.32;
    cabinZ = 0.18;
    cabinWidthRatio = 0.83;
    wheelRadius = 0.34;
  } else if (archetype === 'toyota_camry') {
    carWidth = 1.88;
    carLen = 4.78;
    lowerH = 0.53;
    cabinH = 0.45;
    cabinLen = 2.38;
    cabinZ = 0.12;
    cabinWidthRatio = 0.83;
    wheelRadius = 0.35;
  } else if (archetype === 'toyota_supra_mk5') {
    carWidth = 1.96;
    carLen = 4.38;
    lowerH = 0.46;
    cabinH = 0.39;
    cabinLen = 1.75;
    cabinZ = 0.32; // Long hood, rearward greenhouse
    cabinWidthRatio = 0.76;
    wheelRadius = 0.35;
  } else if (archetype === 'toyota_supra_mk4') {
    carWidth = 1.94;
    carLen = 4.52;
    lowerH = 0.48;
    cabinH = 0.41;
    cabinLen = 1.92;
    cabinZ = 0.22;
    cabinWidthRatio = 0.78;
    wheelRadius = 0.35;
  } else if (archetype === 'nissan_gtr_r34' || archetype === 'nissan_gtr_r34_ztune') {
    carWidth = archetype === 'nissan_gtr_r34_ztune' ? 1.98 : 1.9;
    carLen = 4.6;
    lowerH = 0.52;
    cabinH = 0.43;
    cabinLen = 2.02;
    cabinZ = 0.15;
    cabinWidthRatio = 0.81;
    wheelRadius = 0.35;
  } else if (archetype === 'nissan_gtr_r35') {
    carWidth = 1.99;
    carLen = 4.71;
    lowerH = 0.52;
    cabinH = 0.42;
    cabinLen = 2.05;
    cabinZ = 0.1;
    cabinWidthRatio = 0.8;
    wheelRadius = 0.36;
  } else if (
    archetype === 'chevy_camaro' ||
    archetype === 'dodge_challenger' ||
    archetype === 'dodge_charger'
  ) {
    carWidth = trim.aeroStyle === 'widebody_gt' ? 2.1 : 2.02;
    carLen = archetype === 'dodge_charger' ? 4.92 : 4.82;
    lowerH = 0.56;
    cabinH = 0.41;
    cabinLen = archetype === 'dodge_charger' ? 2.35 : 1.98;
    cabinZ = 0.18;
    cabinWidthRatio = 0.8;
    wheelRadius = 0.36;
  } else if (archetype === 'bmw_m4') {
    carWidth = 1.96;
    carLen = 4.72;
    lowerH = 0.51;
    cabinH = 0.43;
    cabinLen = 2.12;
    cabinZ = 0.12;
    cabinWidthRatio = 0.81;
    wheelRadius = 0.35;
  } else if (archetype === 'cadillac_escalade' || archetype === 'cadillac_escalade_v') {
    carWidth = 2.16;
    carLen = trim.id.includes('esv') ? 5.25 : 4.98;
    lowerH = 0.76;
    cabinH = 0.68;
    cabinLen = trim.id.includes('esv') ? 3.55 : 3.25;
    cabinZ = 0.32;
    cabinWidthRatio = 0.88;
    wheelRadius = 0.43;
  } else if (archetype === 'porsche_911') {
    carWidth = 2.02;
    carLen = 4.54;
    lowerH = 0.45;
    cabinH = 0.39;
    cabinLen = 1.98;
    cabinZ = 0.05;
    cabinWidthRatio = 0.78;
    wheelRadius = 0.36;
  } else if (archetype === 'lamborghini_huracan') {
    carWidth = 2.08;
    carLen = 4.52;
    lowerH = 0.4;
    cabinH = 0.34;
    cabinLen = 1.95;
    cabinZ = -0.14;
    cabinWidthRatio = 0.76;
    wheelRadius = 0.35;
  } else if (archetype === 'mcmurtry_speirling') {
    carWidth = 1.58; // Narrow single-seater fan car
    carLen = 3.55;
    lowerH = 0.38;
    cabinH = 0.36;
    cabinLen = 1.48;
    cabinZ = 0.0;
    cabinWidthRatio = 0.56;
    wheelRadius = 0.32;
  } else {
    // Koenigsegg Regera, Agera RS, Jesko, Bugatti Chiron Pur Sport/Super Sport, Rimac Nevera
    carWidth = 2.14;
    carLen = archetype === 'bugatti_chiron_super_sport' || trim.aeroStyle === 'absolut_fins' ? 4.92 : 4.68;
    lowerH = 0.39;
    cabinH = 0.34;
    cabinLen = 1.82;
    cabinZ = -0.08;
    cabinWidthRatio = 0.74;
    wheelRadius = 0.36;
  }

  const baseChassisY = 0.26;

  // 1. Main Lower Body Core + Sculpted Front Nose & Rear Deck
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth, lowerH, carLen * 0.86),
    bodyMat
  );
  chassis.position.set(0, baseChassisY + lowerH * 0.5, 0);
  chassis.castShadow = true;
  overlay.add(chassis);

  // Tapered / Sloped Front Hood & Nose Cone
  const noseLen = carLen * 0.16;
  const noseH = lowerH * 0.82;
  const noseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * 0.94, noseH, noseLen),
    bodyMat
  );
  noseMesh.rotation.x = -0.06;
  noseMesh.position.set(0, baseChassisY + noseH * 0.48, -carLen * 0.43);
  noseMesh.castShadow = true;
  overlay.add(noseMesh);

  // Aerodynamic Curved Front & Rear Bumper Corner Wedges (eliminates 90-degree blocky corners)
  for (const side of [-1, 1]) {
    const frontCorner = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.28, noseH * 0.95, noseLen * 0.92),
      bodyMat
    );
    frontCorner.rotation.y = side * 0.42;
    frontCorner.position.set(
      side * (carWidth * 0.40),
      baseChassisY + noseH * 0.47,
      -carLen * 0.435
    );
    overlay.add(frontCorner);

    const rearCorner = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.26, lowerH * 0.90, carLen * 0.13),
      bodyMat
    );
    rearCorner.rotation.y = -side * 0.38;
    rearCorner.position.set(
      side * (carWidth * 0.41),
      baseChassisY + lowerH * 0.46,
      carLen * 0.435
    );
    overlay.add(rearCorner);
  }

  // Sculpted Hood Power-Lines & Shoulder Contours (gives every car authentic 3D hood reflections)
  for (const side of [-1, 1]) {
    const hoodCrest = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.14, 0.035, carLen * 0.28),
      bodyMat
    );
    hoodCrest.position.set(
      side * (carWidth * 0.31),
      baseChassisY + lowerH * 0.96,
      -carLen * 0.27
    );
    overlay.add(hoodCrest);

    // Side Rocker Aero Blade & Door Sculpting Crease
    const sideRocker = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, lowerH * 0.22, carLen * 0.46),
      carbonMat
    );
    sideRocker.position.set(
      side * (carWidth * 0.5 + 0.01),
      baseChassisY + lowerH * 0.15,
      0
    );
    overlay.add(sideRocker);
  }

  // Rear Bumper / Deck Extension
  const rearDeckMesh = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * 0.95, lowerH * 0.92, carLen * 0.14),
    bodyMat
  );
  rearDeckMesh.position.set(0, baseChassisY + lowerH * 0.46, carLen * 0.43);
  rearDeckMesh.castShadow = true;
  overlay.add(rearDeckMesh);

  // Sculpted Circular Wheel Arches (12-segment curved cylinder arc flares)
  const flareW =
    trim.aeroStyle === 'widebody_gt' ||
    archetype === 'dodge_challenger' ||
    archetype === 'dodge_charger' ||
    archetype === 'nissan_gtr_r34_ztune'
      ? 0.11
      : 0.065;
  const archOffsets = [
    [-carWidth * 0.49, baseChassisY + lowerH * 0.42, -carLen * 0.31],
    [carWidth * 0.49, baseChassisY + lowerH * 0.42, -carLen * 0.31],
    [-carWidth * 0.49, baseChassisY + lowerH * 0.45, carLen * 0.31],
    [carWidth * 0.49, baseChassisY + lowerH * 0.45, carLen * 0.31],
  ];
  for (const [ax, ay, az] of archOffsets) {
    const archGroup = new THREE.Group();
    archGroup.position.set(ax, ay - 0.04, az);
    const archGeom = new THREE.CylinderGeometry(
      wheelRadius * 1.15,
      wheelRadius * 1.15,
      flareW,
      12,
      1,
      true,
      0,
      Math.PI
    );
    const archMesh = new THREE.Mesh(archGeom, bodyMat);
    archMesh.rotation.z = Math.PI / 2;
    archMesh.rotation.y = ax < 0 ? -Math.PI / 2 : Math.PI / 2;
    archGroup.add(archMesh);
    overlay.add(archGroup);
  }

  // Front Splitter, Underbody Tray & Rear Aero Diffuser Strakes
  const splitterMat =
    archetype === 'toyota_camry' && trim.id === 'camry_trd_v6' ? accentMat : carbonMat;
  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth + 0.06, 0.06, carLen + 0.08),
    splitterMat
  );
  splitter.position.set(0, baseChassisY - 0.02, 0);
  overlay.add(splitter);

  // Rear Venturi Diffuser Fins
  for (const dX of [-0.42, -0.21, 0, 0.21, 0.42]) {
    const strake = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.11, 0.22),
      carbonMat
    );
    strake.position.set(dX * carWidth * 0.85, baseChassisY + 0.03, carLen * 0.48);
    overlay.add(strake);
  }

  // Cabin Greenhouse & Sloped Windshield / Rear Glass
  const isWraparoundCanopy =
    archetype === 'koenigsegg_regera' ||
    archetype === 'koenigsegg_agera_rs' ||
    archetype === 'koenigsegg_jesko' ||
    archetype === 'mcmurtry_speirling';

  const cabinW = carWidth * cabinWidthRatio;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(cabinW, cabinH, cabinLen),
    glassMat
  );
  cabin.position.set(0, baseChassisY + lowerH + cabinH * 0.46, cabinZ);
  overlay.add(cabin);

  // Sloped Front Windshield & Rear Fastback Glass Planes + A/C Roof Pillars
  const windshieldPlane = new THREE.Mesh(
    new THREE.BoxGeometry(cabinW * 0.96, cabinH * 1.05, 0.08),
    glassMat
  );
  windshieldPlane.rotation.x = isWraparoundCanopy ? -0.68 : -0.56;
  windshieldPlane.position.set(
    0,
    baseChassisY + lowerH + cabinH * 0.44,
    cabinZ - cabinLen * 0.51
  );
  overlay.add(windshieldPlane);

  if (!isWraparoundCanopy) {
    for (const side of [-1, 1]) {
      const aPillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, cabinH * 1.08, 0.09),
        bodyMat
      );
      aPillar.rotation.x = -0.56;
      aPillar.position.set(
        side * (cabinW * 0.48),
        baseChassisY + lowerH + cabinH * 0.45,
        cabinZ - cabinLen * 0.5
      );
      overlay.add(aPillar);

      const cPillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, cabinH * 1.04, 0.16),
        bodyMat
      );
      cPillar.rotation.x = 0.52;
      cPillar.position.set(
        side * (cabinW * 0.47),
        baseChassisY + lowerH + cabinH * 0.45,
        cabinZ + cabinLen * 0.48
      );
      overlay.add(cPillar);
    }
  }

  // Roof Cap (Carbon roof on M4, GT-R NISMO, Type R, or body-colored roof)
  const useCarbonRoof =
    archetype === 'bmw_m4' ||
    trim.id === 'camry_xse_v6' ||
    trim.id === 'camry_trd_v6' ||
    trim.id === 'gtr_r35_nismo' ||
    trim.id === 'jesko_absolut_knc_gold';
  const roofCap = new THREE.Mesh(
    new THREE.BoxGeometry(
      cabinW * (isWraparoundCanopy ? 0.84 : 0.94),
      0.055,
      cabinLen * (archetype === 'cadillac_escalade' || archetype === 'cadillac_escalade_v' ? 0.94 : 0.76)
    ),
    useCarbonRoof ? carbonMat : bodyMat
  );
  roofCap.position.set(0, baseChassisY + lowerH + cabinH * 0.95, cabinZ);
  overlay.add(roofCap);

  // Side Mirrors
  if (archetype !== 'mcmurtry_speirling') {
    for (const side of [-1, 1]) {
      const mirror = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.08, 0.12),
        useCarbonRoof ? carbonMat : bodyMat
      );
      mirror.position.set(
        side * (carWidth * 0.49),
        baseChassisY + lowerH + 0.1,
        cabinZ - cabinLen * 0.34
      );
      overlay.add(mirror);
    }
  }

  const frontZ = -carLen * 0.5 - 0.01;
  const rearZ = carLen * 0.5 + 0.01;

  // ============================================================================
  // BESPOKE REAL-WORLD CAR FRONT / SIDE / REAR SIGNATURE SCULPTING
  // ============================================================================

  if (archetype === 'honda_civic') {
    // 11th-Gen Honda Civic: Wide horizontal lower honeycomb grille, slim upper grille bar with Honda emblem,
    // slim angled LED headlights, and C-shaped rear tail lamps.
    const upperGrille = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.48, 0.08, 0.06),
      darkGrilleMat
    );
    upperGrille.position.set(0, baseChassisY + lowerH * 0.68, frontZ);
    overlay.add(upperGrille);

    const lowerHoneycomb = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.76, 0.18, 0.06),
      darkGrilleMat
    );
    lowerHoneycomb.position.set(0, baseChassisY + lowerH * 0.28, frontZ);
    overlay.add(lowerHoneycomb);

    // Honda Badge (Red Type R badge on FL5, Chrome on LX/Si)
    const badgeMat = trim.id === 'civic_type_r' ? new THREE.MeshBasicMaterial({ color: 0xdc2626 }) : chromeMat;
    const frontBadge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.07), badgeMat);
    frontBadge.position.set(0, baseChassisY + lowerH * 0.68, frontZ - 0.01);
    overlay.add(frontBadge);

    // Slim LED Headlights with upper DRL brow
    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.06), headMat);
      hl.position.set(side * (carWidth * 0.34), baseChassisY + lowerH * 0.68, frontZ);
      overlay.add(hl);
    }

    // C-Shaped Civic Taillights + Rear Light Bar
    for (const side of [-1, 1]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.06), brakeMat);
      tl.position.set(side * (carWidth * 0.33), baseChassisY + lowerH * 0.7, rearZ);
      overlay.add(tl);
    }

    if (trim.id === 'civic_type_r') {
      // FL5 Type R Vented Hood Duct + Triple Center Exhausts + High Pedestal Wing on Aluminum Uprights
      const hoodVent = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.02, 0.34), carbonMat);
      hoodVent.position.set(0, baseChassisY + lowerH * 0.85, -carLen * 0.32);
      overlay.add(hoodVent);

      for (const exX of [-0.14, 0, 0.14]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 10), chromeMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(exX, baseChassisY + 0.12, rearZ);
        overlay.add(pipe);
      }
    } else if (trim.id === 'civic_si') {
      // Civic Si Gloss Black Trunk Lip Spoiler
      const siLip = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.82, 0.06, 0.14), carbonMat);
      siLip.position.set(0, baseChassisY + lowerH + 0.03, carLen * 0.46);
      overlay.add(siLip);
    }
  } else if (archetype === 'toyota_camry') {
    // XV70 Toyota Camry: Wide trapezoidal Catamaran lower grille with side strakes, V-shaped upper nose bar,
    // and sleek wraparound LED headlights & taillights.
    const trapGrille = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.82, 0.24, 0.06),
      darkGrilleMat
    );
    trapGrille.position.set(0, baseChassisY + lowerH * 0.32, frontZ);
    overlay.add(trapGrille);

    const upperVBar = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.44, 0.07, 0.06),
      chromeMat
    );
    upperVBar.position.set(0, baseChassisY + lowerH * 0.7, frontZ);
    overlay.add(upperVBar);

    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.11, 0.06), headMat);
      hl.position.set(side * (carWidth * 0.34), baseChassisY + lowerH * 0.7, frontZ);
      overlay.add(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.06), brakeMat);
      tl.position.set(side * (carWidth * 0.33), baseChassisY + lowerH * 0.7, rearZ);
      overlay.add(tl);
    }

    if (trim.id === 'camry_trd_v6') {
      // TRD Red Pinstripe on Front Splitter + Gloss Black TRD Pedestal Wing
      const redLip = new THREE.Mesh(
        new THREE.BoxGeometry(carWidth + 0.08, 0.025, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      redLip.position.set(0, baseChassisY - 0.01, frontZ);
      overlay.add(redLip);
    }
  } else if (archetype === 'toyota_supra_mk5') {
    // A90 GR Supra: Central F1-style nose cone with 3-part lower intake, double-bubble roof humps,
    // integrated ducktail arch on rear deck, and F1 rain light in rear diffuser.
    const centerNose = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.12), bodyMat);
    centerNose.position.set(0, baseChassisY + lowerH * 0.4, frontZ - 0.02);
    overlay.add(centerNose);

    for (const side of [-1, 1]) {
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.06), darkGrilleMat);
      intake.position.set(side * 0.48, baseChassisY + lowerH * 0.34, frontZ);
      overlay.add(intake);

      // Double-bubble roof humps
      const bubble = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.045, 0.95), bodyMat);
      bubble.position.set(side * 0.32, baseChassisY + lowerH + cabinH + 0.01, cabinZ);
      overlay.add(bubble);

      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.06), headMat);
      hl.position.set(side * (carWidth * 0.35), baseChassisY + lowerH * 0.66, frontZ);
      overlay.add(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.06), brakeMat);
      tl.position.set(side * (carWidth * 0.34), baseChassisY + lowerH * 0.68, rearZ);
      overlay.add(tl);
    }

    // Integrated Ducktail Arch
    const ducktail = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.86, 0.09, 0.16), bodyMat);
    ducktail.position.set(0, baseChassisY + lowerH * 0.96, carLen * 0.46);
    overlay.add(ducktail);
  } else if (archetype === 'toyota_supra_mk4') {
    // A80 Supra Mk4: Rounded JDM front intake, multi-projector glass headlights,
    // signature rounded high-arch hoop rear spoiler, and 4-ring circular tail lights.
    const frontMouth = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.58, 0.18, 0.06), darkGrilleMat);
    frontMouth.position.set(0, baseChassisY + lowerH * 0.32, frontZ);
    overlay.add(frontMouth);

    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.08), headMat);
      hl.position.set(side * (carWidth * 0.33), baseChassisY + lowerH * 0.68, frontZ);
      overlay.add(hl);

      // Quad circular tail lamps inside dark housing
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.05), darkGrilleMat);
      housing.position.set(side * (carWidth * 0.32), baseChassisY + lowerH * 0.66, rearZ);
      overlay.add(housing);
      for (const ringOff of [-0.1, 0.1]) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.07, 12), brakeMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(side * (carWidth * 0.32) + ringOff, baseChassisY + lowerH * 0.66, rearZ + 0.01);
        overlay.add(ring);
      }
    }

    // Iconic Mk4 High-Arch Hoop Wing
    for (const side of [-1, 1]) {
      const hoopSide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.22), bodyMat);
      hoopSide.position.set(side * (carWidth * 0.4), baseChassisY + lowerH + 0.12, carLen * 0.43);
      overlay.add(hoopSide);
    }
    const hoopTop = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.86, 0.06, 0.24), bodyMat);
    hoopTop.position.set(0, baseChassisY + lowerH + 0.26, carLen * 0.43);
    overlay.add(hoopTop);
  } else if (
    archetype === 'nissan_gtr_r34' ||
    archetype === 'nissan_gtr_r34_ztune' ||
    archetype === 'nissan_gtr_r35'
  ) {
    // Nissan Skyline GT-R R34 / Z-Tune / R35: Exposed front aluminum intercooler mesh,
    // signature twin circular afterburner taillights per side, and dual-plane rear wing.
    const intercooler = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.56, 0.2, 0.06), chromeMat);
    intercooler.position.set(0, baseChassisY + lowerH * 0.3, frontZ);
    overlay.add(intercooler);

    const upperGrille = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.48, 0.1, 0.06), darkGrilleMat);
    upperGrille.position.set(0, baseChassisY + lowerH * 0.68, frontZ);
    overlay.add(upperGrille);

    if (archetype === 'nissan_gtr_r34_ztune' || trim.id === 'r34_vspec_ii') {
      // Carbon Louvered / NACA Vented Hood
      const hoodPanel = new THREE.Mesh(
        new THREE.BoxGeometry(carWidth * 0.72, 0.02, carLen * 0.28),
        carbonMat
      );
      hoodPanel.position.set(0, baseChassisY + lowerH * 0.85, -carLen * 0.28);
      overlay.add(hoodPanel);
    }

    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.06), headMat);
      hl.position.set(side * (carWidth * 0.34), baseChassisY + lowerH * 0.68, frontZ);
      overlay.add(hl);

      // Iconic Quad Round GT-R Afterburner Taillights
      for (const [idx, ringOff] of [-0.11, 0.11].entries()) {
        const rRadius = idx === 0 ? 0.062 : 0.05;
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(rRadius, rRadius, 0.07, 14), brakeMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(side * (carWidth * 0.32) + ringOff, baseChassisY + lowerH * 0.68, rearZ);
        overlay.add(ring);
      }
    }
  } else if (
    archetype === 'chevy_camaro' ||
    archetype === 'dodge_challenger' ||
    archetype === 'dodge_charger'
  ) {
    // American V8 Muscle: Deep recessed grille, power dome / supercharger hood scoop, and muscle taillights
    const recessedGrille = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.84, 0.16, 0.06),
      darkGrilleMat
    );
    recessedGrille.position.set(0, baseChassisY + lowerH * 0.68, frontZ);
    overlay.add(recessedGrille);

    // Supercharger Hood Scoop / Power Dome
    const scoopMat =
      trim.id === 'camaro_zl1_1le' || trim.id === 'challenger_demon_170' || trim.id === 'charger_king_daytona'
        ? carbonMat
        : bodyMat;
    const hoodScoop = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.44, 0.1, carLen * 0.26),
      scoopMat
    );
    hoodScoop.position.set(0, baseChassisY + lowerH * 0.88, -carLen * 0.24);
    overlay.add(hoodScoop);

    for (const side of [-1, 1]) {
      if (archetype === 'dodge_challenger') {
        // Quad Halo Headlights
        for (const hOff of [-0.09, 0.09]) {
          const halo = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.055, 0.07, 12),
            side === -1 && hOff === 0.09 ? amberMat : headMat
          );
          halo.rotation.x = Math.PI / 2;
          halo.position.set(side * (carWidth * 0.33) + hOff, baseChassisY + lowerH * 0.68, frontZ);
          overlay.add(halo);
        }
      } else {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.06), headMat);
        hl.position.set(side * (carWidth * 0.34), baseChassisY + lowerH * 0.68, frontZ);
        overlay.add(hl);
      }
    }

    if (archetype === 'dodge_charger') {
      // Full-Width Racetrack LED Taillight Bar
      const racetrackBar = new THREE.Mesh(
        new THREE.BoxGeometry(carWidth * 0.88, 0.14, 0.06),
        brakeMat
      );
      racetrackBar.position.set(0, baseChassisY + lowerH * 0.68, rearZ);
      overlay.add(racetrackBar);
    } else {
      for (const side of [-1, 1]) {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.06), brakeMat);
        tl.position.set(side * (carWidth * 0.32), baseChassisY + lowerH * 0.68, rearZ);
        overlay.add(tl);
      }
    }
  } else if (archetype === 'bmw_m4') {
    // G82 BMW M4: Vertical Twin-Kidney Performance Grille + Laser DRLs (Yellow on M4 CSL)
    for (const kSide of [-1, 1]) {
      const kidney = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.07), darkGrilleMat);
      kidney.position.set(kSide * 0.14, baseChassisY + lowerH * 0.52, frontZ);
      overlay.add(kidney);

      if (trim.id === 'bmw_m4_csl') {
        const redTrim = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.34, 0.05),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        redTrim.position.set(kSide * 0.14, baseChassisY + lowerH * 0.52, frontZ + 0.01);
        overlay.add(redTrim);
      }

      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.1, 0.06),
        trim.id === 'bmw_m4_csl' ? yellowDrlMat : headMat
      );
      hl.position.set(kSide * (carWidth * 0.35), baseChassisY + lowerH * 0.68, frontZ);
      overlay.add(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.06), brakeMat);
      tl.position.set(kSide * (carWidth * 0.34), baseChassisY + lowerH * 0.68, rearZ);
      overlay.add(tl);
    }
  } else if (archetype === 'cadillac_escalade' || archetype === 'cadillac_escalade_v') {
    // Cadillac Escalade / Escalade-V: Massive Shield Grille, Vertical Front LED Light Blades,
    // and Full-Pillar Vertical Rear Taillights
    const shieldGrille = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.64, lowerH * 0.62, 0.07),
      archetype === 'cadillac_escalade_v' || trim.id === 'escalade_sport_platinum'
        ? darkGrilleMat
        : chromeMat
    );
    shieldGrille.position.set(0, baseChassisY + lowerH * 0.56, frontZ);
    overlay.add(shieldGrille);

    for (const side of [-1, 1]) {
      // Vertical Front DRL Blade
      const vertDrl = new THREE.Mesh(new THREE.BoxGeometry(0.1, lowerH * 0.65, 0.07), headMat);
      vertDrl.position.set(side * (carWidth * 0.42), baseChassisY + lowerH * 0.48, frontZ);
      overlay.add(vertDrl);

      // Upper Horizontal Slim Matrix Headlight
      const upperHl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.07), headMat);
      upperHl.position.set(side * (carWidth * 0.36), baseChassisY + lowerH * 0.82, frontZ);
      overlay.add(upperHl);

      // Full-Height Vertical Pillar OLED Taillights
      const pillarTl = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, lowerH * 0.6 + cabinH * 0.85, 0.07),
        brakeMat
      );
      pillarTl.position.set(
        side * (carWidth * 0.43),
        baseChassisY + lowerH * 0.7 + cabinH * 0.35,
        rearZ
      );
      overlay.add(pillarTl);
    }

    if (archetype === 'cadillac_escalade_v') {
      // Quad Exhaust Tips on Escalade-V
      for (const exX of [-0.68, -0.54, 0.54, 0.68]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 10), chromeMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(exX, baseChassisY + 0.12, rearZ);
        overlay.add(pipe);
      }
    }
  } else if (archetype === 'porsche_911') {
    // 992 Porsche 911: Oval LED Matrix Headlights, Sloping Rear Deck, Full-Width Rear Light Bar
    for (const side of [-1, 1]) {
      const ovalHl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 16), headMat);
      ovalHl.rotation.x = Math.PI / 3;
      ovalHl.position.set(side * (carWidth * 0.35), baseChassisY + lowerH * 0.72, frontZ + 0.08);
      overlay.add(ovalHl);
    }
    const rearLightStrip = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.88, 0.08, 0.06),
      brakeMat
    );
    rearLightStrip.position.set(0, baseChassisY + lowerH * 0.68, rearZ);
    overlay.add(rearLightStrip);
  } else if (archetype === 'lamborghini_huracan') {
    // Huracán EVO / STO: Wedge Nose, Y-Shaped Headlights, STO Roof Scoop & Shark Fin
    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.12), headMat);
      hl.position.set(side * (carWidth * 0.35), baseChassisY + lowerH * 0.62, frontZ + 0.04);
      overlay.add(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.06), brakeMat);
      tl.position.set(side * (carWidth * 0.34), baseChassisY + lowerH * 0.68, rearZ);
      overlay.add(tl);
    }
    if (trim.id === 'huracan_sto') {
      const roofScoop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.55), accentMat);
      roofScoop.position.set(0, baseChassisY + lowerH + cabinH + 0.04, cabinZ + 0.25);
      overlay.add(roofScoop);

      const sharkFin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.95), accentMat);
      sharkFin.position.set(0, baseChassisY + lowerH + 0.2, carLen * 0.26);
      overlay.add(sharkFin);
    }
  } else if (archetype === 'mcmurtry_speirling') {
    // McMurtry Spéirling: Narrow single-seat cockpit, LMP-style raised front wheel pods,
    // dorsal spine fin, and Twin Rear Ground-Effect Suction Fan Turbine Housings with gold diffuser rings!
    const dorsalFin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 1.15), accentMat);
    dorsalFin.position.set(0, baseChassisY + lowerH + 0.22, carLen * 0.24);
    overlay.add(dorsalFin);

    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.06), headMat);
      hl.position.set(side * (carWidth * 0.38), baseChassisY + lowerH * 0.65, frontZ);
      overlay.add(hl);

      // Twin Rear Suction Turbine Fan Pods
      const fanHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.18, 16),
        carbonMat
      );
      fanHousing.rotation.x = Math.PI / 2;
      fanHousing.position.set(side * 0.32, baseChassisY + 0.24, rearZ);
      overlay.add(fanHousing);

      const fanGoldRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.17, 0.2, 16),
        goldMat
      );
      fanGoldRing.rotation.x = Math.PI / 2;
      fanGoldRing.position.set(side * 0.32, baseChassisY + 0.24, rearZ + 0.01);
      overlay.add(fanGoldRing);
    }
  } else if (
    archetype === 'bugatti_chiron_pur_sport' ||
    archetype === 'bugatti_chiron_super_sport'
  ) {
    // Bugatti Chiron Pur Sport & Super Sport: Signature Horseshoe Front Grille,
    // 8-Eye Quad-LED Headlights, Side C-Line Trim, and Full-Width Single-Blade Rear Light Bar!
    const horseshoeOuter = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.08), chromeMat);
    horseshoeOuter.position.set(0, baseChassisY + lowerH * 0.45, frontZ);
    overlay.add(horseshoeOuter);
    const horseshoeInner = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.09), darkGrilleMat);
    horseshoeInner.position.set(0, baseChassisY + lowerH * 0.44, frontZ - 0.005);
    overlay.add(horseshoeInner);

    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.06), headMat);
      hl.position.set(side * (carWidth * 0.34), baseChassisY + lowerH * 0.64, frontZ);
      overlay.add(hl);

      // Bugatti C-Line Side Accent Arch
      const cLine = new THREE.Mesh(new THREE.BoxGeometry(0.05, cabinH + 0.18, 1.35), accentMat);
      cLine.position.set(side * (carWidth * 0.48), baseChassisY + lowerH + 0.06, cabinZ + 0.12);
      overlay.add(cLine);
    }

    // Full-Width Bugatti Rear LED Light Blade
    const rearBlade = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.9, 0.07, 0.06),
      brakeMat
    );
    rearBlade.position.set(0, baseChassisY + lowerH * 0.68, rearZ);
    overlay.add(rearBlade);

    if (trim.id === 'chiron_ss_300plus') {
      // Twin Jet-Orange 300+ Racing Stripes
      for (const sOff of [-0.14, 0.14]) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.02, carLen * 0.96),
          accentMat
        );
        stripe.position.set(sOff, baseChassisY + lowerH + 0.01, 0);
        overlay.add(stripe);
      }
    }
  } else {
    // Koenigsegg Regera, Agera RS, Jesko (Attack / Absolut), and Rimac Nevera
    const centerStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.02, carLen * 0.94),
      trim.id === 'jesko_absolut_knc_gold' || trim.id === 'agera_rs_gryphon' ? goldMat : accentMat
    );
    centerStrip.position.set(0, baseChassisY + lowerH + 0.01, 0);
    overlay.add(centerStrip);

    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.08), headMat);
      hl.position.set(side * (carWidth * 0.35), baseChassisY + lowerH * 0.65, frontZ);
      overlay.add(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.06), brakeMat);
      tl.position.set(side * (carWidth * 0.34), baseChassisY + lowerH * 0.68, rearZ);
      overlay.add(tl);
    }
  }

  // ============================================================================
  // TRIM-SPECIFIC AERODYNAMICS PACKAGE (SPOILERS, GT WINGS, ABSOLUT TWIN FINS)
  // ============================================================================
  if (trim.aeroStyle === 'absolut_fins') {
    // KOENIGSEGG JESKO ABSOLUT: Twin Dorsal High-Speed Stabilizer Fins (Inspired by F-15 Fighter Jet)
    // + Rear Aero Wheel Fairings
    for (const side of [-1, 1]) {
      const dorsalFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.32, 0.92),
        trim.id === 'jesko_absolut_knc_gold' ? goldMat : accentMat
      );
      dorsalFin.position.set(side * 0.32, baseChassisY + lowerH + 0.16, carLen * 0.34);
      overlay.add(dorsalFin);
    }
  } else if (trim.aeroStyle === 'gt_wing' || trim.aeroStyle === 'widebody_gt') {
    // High-Downforce Pedestal / Swan-Neck Carbon GT Wing
    const wingHeight = trim.aeroStyle === 'widebody_gt' ? 0.34 : 0.24;
    const wingWidth = trim.aeroStyle === 'widebody_gt' ? carWidth * 0.98 : carWidth * 0.88;
    const wingMat =
      trim.id === 'jesko_attack' || trim.id === 'agera_rs_gryphon' ? accentMat : carbonMat;

    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, wingHeight, 0.18), carbonMat);
      strut.position.set(side * (carWidth * 0.28), baseChassisY + lowerH + wingHeight * 0.5, carLen * 0.42);
      overlay.add(strut);

      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.34), wingMat);
      endplate.position.set(side * (wingWidth * 0.5), baseChassisY + lowerH + wingHeight, carLen * 0.43);
      overlay.add(endplate);
    }

    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(wingWidth, 0.05, 0.3), wingMat);
    wingBlade.position.set(0, baseChassisY + lowerH + wingHeight, carLen * 0.43);
    overlay.add(wingBlade);
  } else if (
    trim.aeroStyle === 'sport_spoiler' &&
    archetype !== 'cadillac_escalade' &&
    archetype !== 'cadillac_escalade_v'
  ) {
    // Sleek Low-Profile Carbon Trunk Lip Spoiler
    const lipSpoiler = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.84, 0.06, 0.15),
      carbonMat
    );
    lipSpoiler.position.set(0, baseChassisY + lowerH + 0.03, carLen * 0.45);
    overlay.add(lipSpoiler);
  }

  // 4 Street Alloy / Forged Multi-Spoke Wheels + Slotted Brake Rotors + Painted Brembo Brake Calipers
  const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.29, 24);
  wheelGeom.rotateZ(Math.PI / 2);
  const rimBarrelGeom = new THREE.CylinderGeometry(wheelRadius * 0.72, wheelRadius * 0.72, 0.305, 20);
  rimBarrelGeom.rotateZ(Math.PI / 2);
  const brakeDiscGeom = new THREE.CylinderGeometry(wheelRadius * 0.56, wheelRadius * 0.56, 0.312, 18);
  brakeDiscGeom.rotateZ(Math.PI / 2);

  const rimMaterial =
    trim.id === 'jesko_absolut_knc_gold' ||
    trim.id === 'agera_rs_gryphon' ||
    archetype === 'mcmurtry_speirling'
      ? goldMat
      : trim.aeroStyle === 'widebody_gt'
      ? carbonMat
      : chromeMat;

  // Model-accurate Brembo / Carbon-Ceramic Brake Caliper color
  const caliperColorHex =
    archetype === 'koenigsegg_jesko'
      ? 0x84cc16 // Acid Green Koenigsegg Calipers
      : archetype === 'porsche_911' || archetype === 'nissan_gtr_r34_ztune' || archetype === 'nissan_gtr_r35'
      ? 0xfbbf24 // PCCB Yellow / Brembo Gold Calipers
      : archetype === 'bugatti_chiron_pur_sport' || archetype === 'rimac_nevera'
      ? 0x38bdf8 // French Racing Blue / Rimac Cyan Calipers
      : 0xef4444; // Brembo Red Calipers
  const caliperMat = new THREE.MeshStandardMaterial({
    color: caliperColorHex,
    metalness: 0.65,
    roughness: 0.22,
  });

  const wheelCoords = [
    [-carWidth * 0.48, wheelRadius, -carLen * 0.31],
    [carWidth * 0.48, wheelRadius, -carLen * 0.31],
    [-carWidth * 0.48, wheelRadius, carLen * 0.31],
    [carWidth * 0.48, wheelRadius, carLen * 0.31],
  ];
  for (const [wx, wy, wz] of wheelCoords) {
    const tireMesh = new THREE.Mesh(wheelGeom, darkGrilleMat);
    tireMesh.position.set(wx, wy, wz);

    // Metallic Rim Barrel
    const rimMesh = new THREE.Mesh(rimBarrelGeom, rimMaterial);
    tireMesh.add(rimMesh);

    // Slotted Steel / Carbon-Ceramic Brake Rotor
    const discMesh = new THREE.Mesh(brakeDiscGeom, rotorMat);
    tireMesh.add(discMesh);

    // 5 Forged Alloy Twin-Spokes + Center Lock Cap
    const outX = wx < 0 ? -0.156 : 0.156;
    for (let sIdx = 0; sIdx < 5; sIdx++) {
      const angle = (sIdx * Math.PI * 2) / 5;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, wheelRadius * 1.32, 0.042),
        rimMaterial
      );
      spoke.rotation.x = angle;
      spoke.position.set(outX, 0, 0);
      tireMesh.add(spoke);
    }

    // Painted Brembo Brake Caliper
    const caliperMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, wheelRadius * 0.48, wheelRadius * 0.32),
      caliperMat
    );
    caliperMesh.position.set(wx < 0 ? -0.148 : 0.148, wheelRadius * 0.16, wz < 0 ? 0.11 : -0.11);
    tireMesh.add(caliperMesh);

    overlay.add(tireMesh);
  }

  // 4. Functional Front & Rear Amber Turn Signal Lenses + Brake Light Connectors
  const leftAmberMat = new THREE.MeshBasicMaterial({ color: 0x2b1504 });
  const rightAmberMat = new THREE.MeshBasicMaterial({ color: 0x2b1504 });

  // Front Turn Signals
  const frontSigL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.06), leftAmberMat);
  frontSigL.position.set(-carWidth * 0.44, baseChassisY + lowerH * 0.68, frontZ - 0.01);
  overlay.add(frontSigL);

  const frontSigR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.06), rightAmberMat);
  frontSigR.position.set(carWidth * 0.44, baseChassisY + lowerH * 0.68, frontZ - 0.01);
  overlay.add(frontSigR);

  // Rear Turn Signals
  const rearSigL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.06), leftAmberMat);
  rearSigL.position.set(-carWidth * 0.42, baseChassisY + lowerH * 0.68, rearZ + 0.01);
  overlay.add(rearSigL);

  const rearSigR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.06), rightAmberMat);
  rearSigR.position.set(carWidth * 0.42, baseChassisY + lowerH * 0.68, rearZ + 0.01);
  overlay.add(rearSigR);

  // 5. Emergency Police Strobe Lightbar on Roof & Grille Strobes
  const sirenRedMat = new THREE.MeshBasicMaterial({ color: 0xff1e1e });
  const sirenBlueMat = new THREE.MeshBasicMaterial({ color: 0x1d4ed8 });

  const roofBarGroup = new THREE.Group();
  roofBarGroup.name = 'police_roof_bar';
  // Elevate lightbar directly atop the vehicle greenhouse roof
  const actualRoofY = baseChassisY + lowerH + cabinH + 0.05;
  roofBarGroup.position.set(0, actualRoofY, cabinZ);
  roofBarGroup.visible = false;

  // Sturdy aerodynamic mounting bracket feet clamped to roof rails
  const mountL = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.08, 0.18),
    darkGrilleMat
  );
  mountL.position.set(-carWidth * 0.32, -0.04, 0);
  roofBarGroup.add(mountL);

  const mountR = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.08, 0.18),
    darkGrilleMat
  );
  mountR.position.set(carWidth * 0.32, -0.04, 0);
  roofBarGroup.add(mountR);

  // Aerodynamic Federal Signal / Whelen Valor Lightbar Housing
  const lightbarBase = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * 0.66, 0.08, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.25, metalness: 0.85 })
  );
  roofBarGroup.add(lightbarBase);

  // High-Intensity Multi-LED Red Strobe Pods (Driver Side)
  const redStrobe = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * 0.28, 0.11, 0.20),
    sirenRedMat
  );
  redStrobe.position.set(-carWidth * 0.16, 0.04, 0);
  roofBarGroup.add(redStrobe);

  // High-Intensity Multi-LED Blue Strobe Pods (Passenger Side)
  const blueStrobe = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * 0.28, 0.11, 0.20),
    sirenBlueMat
  );
  blueStrobe.position.set(carWidth * 0.16, 0.04, 0);
  roofBarGroup.add(blueStrobe);

  // Center High-Output Siren Acoustic Speaker Dome & Takedown Lights
  const speakerMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.07, 12),
    darkGrilleMat
  );
  speakerMesh.rotation.x = Math.PI / 2;
  speakerMesh.position.set(0, 0.045, 0);
  roofBarGroup.add(speakerMesh);

  // Front Heavy-Duty Tactical Push Bumper (PIT Ram Bar)
  const pushBumper = new THREE.Group();
  pushBumper.name = 'police_push_bumper';
  pushBumper.position.set(0, baseChassisY + lowerH * 0.44, frontZ - 0.08);
  pushBumper.visible = false;

  const pushCrossBar = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * 0.74, 0.09, 0.08),
    darkGrilleMat
  );
  pushBumper.add(pushCrossBar);

  for (const side of [-1, 1]) {
    const upright = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, lowerH * 0.92, 0.08),
      darkGrilleMat
    );
    upright.position.set(side * carWidth * 0.26, lowerH * 0.18, 0);
    pushBumper.add(upright);

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, lowerH * 0.94, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95 })
    );
    pad.position.set(side * carWidth * 0.26, lowerH * 0.18, -0.05);
    pushBumper.add(pad);
  }
  overlay.add(pushBumper);

  // Hidden High-Power Grille Strobes
  const grilleRed = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.07, 0.05), sirenRedMat);
  grilleRed.position.set(-carWidth * 0.24, baseChassisY + lowerH * 0.45, frontZ - 0.03);
  overlay.add(grilleRed);

  const grilleBlue = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.07, 0.05), sirenBlueMat);
  grilleBlue.position.set(carWidth * 0.24, baseChassisY + lowerH * 0.45, frontZ - 0.03);
  overlay.add(grilleBlue);

  overlay.add(roofBarGroup);

  // 6. Police Cruiser Door, Hood & Trunk Livery Decals ("POLICE")
  const policeCanvas = document.createElement('canvas');
  policeCanvas.width = 1024;
  policeCanvas.height = 256;
  const pCtx = policeCanvas.getContext('2d');
  if (pCtx) {
    pCtx.clearRect(0, 0, 1024, 256);
    // Deep police navy-black background panel
    pCtx.fillStyle = '#081226';
    pCtx.fillRect(8, 20, 1008, 216);

    // Reflective Gold and Azure Speed Stripes
    pCtx.fillStyle = '#f59e0b';
    pCtx.fillRect(8, 20, 1008, 14);
    pCtx.fillRect(8, 222, 1008, 14);
    pCtx.fillStyle = '#38bdf8';
    pCtx.fillRect(8, 38, 1008, 6);
    pCtx.fillRect(8, 212, 1008, 6);

    // Gold Police Star Shield
    pCtx.fillStyle = '#f59e0b';
    pCtx.font = 'bold 96px serif';
    pCtx.textAlign = 'center';
    pCtx.textBaseline = 'middle';
    pCtx.fillText('★', 100, 128);

    // Massive High-Contrast White "POLICE"
    pCtx.fillStyle = '#ffffff';
    pCtx.font = '900 120px sans-serif';
    pCtx.fillText('POLICE', 512, 128);

    // Department & Emergency 911 Callout
    pCtx.fillStyle = '#38bdf8';
    pCtx.font = 'bold 42px monospace';
    pCtx.fillText('METRO PD · 911', 860, 128);
  }
  const policeDecalTex = new THREE.CanvasTexture(policeCanvas);
  policeDecalTex.needsUpdate = true;

  const policeDecalMat = new THREE.MeshBasicMaterial({
    map: policeDecalTex,
    transparent: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const decalW = carLen * 0.48;
  const decalH = lowerH * 0.52;
  const decalGeom = new THREE.PlaneGeometry(decalW, decalH);

  const sideOffset = Math.max(carWidth * 0.525, carWidth * 0.5 + 0.05);

  const decalLeft = new THREE.Mesh(decalGeom, policeDecalMat);
  decalLeft.name = 'police_decal_left';
  decalLeft.rotation.y = -Math.PI / 2;
  decalLeft.position.set(-sideOffset, baseChassisY + lowerH * 0.56, 0.05);
  decalLeft.visible = false;
  overlay.add(decalLeft);

  const decalRight = new THREE.Mesh(decalGeom, policeDecalMat);
  decalRight.name = 'police_decal_right';
  decalRight.rotation.y = Math.PI / 2;
  decalRight.position.set(sideOffset, baseChassisY + lowerH * 0.56, 0.05);
  decalRight.visible = false;
  overlay.add(decalRight);

  const hoodDecal = new THREE.Mesh(new THREE.PlaneGeometry(decalW * 0.85, decalH * 0.85), policeDecalMat);
  hoodDecal.name = 'police_decal_hood';
  hoodDecal.rotation.x = -Math.PI / 2;
  hoodDecal.position.set(0, baseChassisY + lowerH * 0.99, -carLen * 0.26);
  hoodDecal.visible = false;
  overlay.add(hoodDecal);

  const trunkDecal = new THREE.Mesh(new THREE.PlaneGeometry(decalW * 0.65, decalH * 0.65), policeDecalMat);
  trunkDecal.name = 'police_decal_trunk';
  trunkDecal.position.set(0, baseChassisY + lowerH * 0.88, carLen * 0.44);
  trunkDecal.visible = false;
  overlay.add(trunkDecal);

  // Store lighting materials, push bumper & decals for dynamic updateVehicleLighting loop
  const policeVisualPayload = {
    leftSignalMats: [leftAmberMat],
    rightSignalMats: [rightAmberMat],
    brakeMats: [brakeMat],
    sirenRedMat,
    sirenBlueMat,
    roofBarGroup,
    policePushBumper: pushBumper,
    policeDecals: [decalLeft, decalRight, hoodDecal, trunkDecal],
  };

  overlay.userData = {
    ...overlay.userData,
    ...policeVisualPayload,
  };

  playerCar.root.userData = {
    ...playerCar.root.userData,
    ...policeVisualPayload,
  };

  playerCar.root.add(overlay);
}

/**
 * Builds a sculpted 3D Civilian Traffic Vehicle (Sedan / SUV / Sports Coupe) modeled after
 * modern aerodynamic production cars with sloping chamfered hoods, raked curved greenhouse,
 * jewel-eye projector LED headlights, side character lines, and performance alloy wheels
 */
export function buildCivilianCarMesh(bodyColorHex: number, style: 'sedan' | 'suv' | 'coupe'): BuiltCivilianCar {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColorHex,
    roughness: 0.22,
    metalness: 0.65,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.08,
    metalness: 0.92,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.65,
    metalness: 0.25,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.08,
    metalness: 0.95,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.4,
    metalness: 0.4,
  });

  const carLen = style === 'suv' ? 4.95 : style === 'coupe' ? 4.52 : 4.75;
  const carWidth = style === 'suv' ? 2.12 : style === 'coupe' ? 2.02 : 1.96;
  const lowerH = style === 'suv' ? 0.72 : style === 'coupe' ? 0.46 : 0.54;
  const cabinH = style === 'suv' ? 0.68 : style === 'coupe' ? 0.40 : 0.52;
  const cabinLen = style === 'suv' ? 3.05 : style === 'coupe' ? 2.15 : 2.55;
  const cabinZ = style === 'suv' ? 0.12 : style === 'coupe' ? 0.22 : 0.08;

  // 1. Sleek Sculpted Lower Monocoque & Tapered Waist
  const baseChassisY = 0.32;
  const mainChassis = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.94, lowerH * 0.82, carLen * 0.72), bodyMat);
  mainChassis.position.set(0, baseChassisY + lowerH * 0.42, 0.04);
  group.add(mainChassis);

  // Aerodynamic Side Skirts / Rocker Panels
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, carLen * 0.56), carbonMat);
    skirt.position.set(side * (carWidth * 0.48), baseChassisY + 0.08, 0.02);
    group.add(skirt);
  }

  // Sloping Aerodynamic Hood with sculpted center power bulge
  const hoodNose = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.90, lowerH * 0.62, carLen * 0.26), bodyMat);
  hoodNose.rotation.x = -0.09;
  hoodNose.position.set(0, baseChassisY + lowerH * 0.42, -carLen * 0.38);
  group.add(hoodNose);

  const powerBulge = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.46, 0.06, carLen * 0.24), bodyMat);
  powerBulge.position.set(0, baseChassisY + lowerH * 0.74, -carLen * 0.36);
  group.add(powerBulge);

  // Sculpted Front Fascia, Aerodynamic Chin Splitter & Curved Bumper Corners
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.90, lowerH * 0.74, carLen * 0.14), bodyMat);
  frontBumper.position.set(0, baseChassisY + lowerH * 0.36, -carLen * 0.49);
  group.add(frontBumper);

  // Aerodynamic Front & Rear Bumper Corner Wedges (eliminates 90-degree blocky corners)
  for (const side of [-1, 1]) {
    const cornerWedge = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.26, lowerH * 0.72, carLen * 0.14),
      bodyMat
    );
    cornerWedge.rotation.y = side * 0.44;
    cornerWedge.position.set(side * (carWidth * 0.40), baseChassisY + lowerH * 0.36, -carLen * 0.485);
    group.add(cornerWedge);

    const rearCornerWedge = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.25, lowerH * 0.72, carLen * 0.12),
      bodyMat
    );
    rearCornerWedge.rotation.y = -side * 0.40;
    rearCornerWedge.position.set(side * (carWidth * 0.40), baseChassisY + lowerH * 0.36, carLen * 0.465);
    group.add(rearCornerWedge);
  }

  const frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.96, 0.07, carLen * 0.16), carbonMat);
  frontSplitter.position.set(0, baseChassisY + 0.04, -carLen * 0.50);
  group.add(frontSplitter);

  // 3D Hexagonal / Slat Radiator Grille
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * (style === 'suv' ? 0.72 : 0.60), style === 'suv' ? 0.34 : 0.22, 0.06),
    trimMat
  );
  grille.position.set(0, baseChassisY + lowerH * 0.42, -carLen * 0.53);
  group.add(grille);

  const brandEmblem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12), chromeMat);
  brandEmblem.rotation.x = Math.PI / 2;
  brandEmblem.position.set(0, baseChassisY + lowerH * 0.46, -carLen * 0.54);
  group.add(brandEmblem);

  // Sculpted Circular Flared Wheel Arches (Front & Rear)
  const archOffsets = [
    [-carWidth * 0.485, baseChassisY + lowerH * 0.42, -carLen * 0.32],
    [carWidth * 0.485, baseChassisY + lowerH * 0.42, -carLen * 0.32],
    [-carWidth * 0.485, baseChassisY + lowerH * 0.42, carLen * 0.31],
    [carWidth * 0.485, baseChassisY + lowerH * 0.42, carLen * 0.31],
  ];
  for (const [ax, ay, az] of archOffsets) {
    const archGroup = new THREE.Group();
    archGroup.position.set(ax, ay - 0.04, az);
    const archGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.09, 12, 1, true, 0, Math.PI);
    const archFlare = new THREE.Mesh(archGeom, bodyMat);
    archFlare.rotation.z = Math.PI / 2;
    archFlare.rotation.y = ax < 0 ? -Math.PI / 2 : Math.PI / 2;
    archGroup.add(archFlare);
    group.add(archGroup);
  }

  // 2. Sculpted Greenhouse: Raked Windshield, Arched Roof & Fastback Window
  const cabinW = carWidth * 0.82;
  const cabinBody = new THREE.Mesh(new THREE.BoxGeometry(cabinW, cabinH, cabinLen * 0.84), glassMat);
  cabinBody.position.set(0, baseChassisY + lowerH + cabinH * 0.46, cabinZ);
  group.add(cabinBody);

  // Raked Front Windshield (inclined ~40°)
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.96, cabinH * 1.15, 0.06), glassMat);
  windshield.rotation.x = -0.66;
  windshield.position.set(0, baseChassisY + lowerH + cabinH * 0.46, cabinZ - cabinLen * 0.44);
  group.add(windshield);

  // Raked Rear Fastback Glass
  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.96, cabinH * 1.10, 0.06), glassMat);
  rearWindow.rotation.x = 0.58;
  rearWindow.position.set(0, baseChassisY + lowerH + cabinH * 0.46, cabinZ + cabinLen * 0.44);
  group.add(rearWindow);

  // Sculpted Curved Roof Cap with chamfered side contours
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.92, 0.06, cabinLen * 0.74), bodyMat);
  roofCap.position.set(0, baseChassisY + lowerH + cabinH * 0.97, cabinZ);
  group.add(roofCap);

  for (const side of [-1, 1]) {
    const roofChamfer = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.14, 0.04, cabinLen * 0.74), bodyMat);
    roofChamfer.rotation.z = side * 0.25;
    roofChamfer.position.set(side * (cabinW * 0.42), baseChassisY + lowerH + cabinH * 0.95, cabinZ);
    group.add(roofChamfer);
  }

  if (style === 'suv') {
    // Roof Cargo Rails
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, cabinLen * 0.76), chromeMat);
      rail.position.set(side * (cabinW * 0.46), baseChassisY + lowerH + cabinH + 0.04, cabinZ);
      group.add(rail);
    }
  }

  // Aerodynamic Side Mirrors with Amber LED Repeater Strips
  const leftAmberMat = new THREE.MeshBasicMaterial({ color: 0x2b1504 });
  const rightAmberMat = new THREE.MeshBasicMaterial({ color: 0x2b1504 });

  for (const side of [-1, 1]) {
    const mirrorStem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.08), trimMat);
    mirrorStem.position.set(side * (carWidth * 0.44), baseChassisY + lowerH + 0.04, cabinZ - cabinLen * 0.32);
    group.add(mirrorStem);

    const mirrorCap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.12), bodyMat);
    mirrorCap.position.set(side * (carWidth * 0.50), baseChassisY + lowerH + 0.09, cabinZ - cabinLen * 0.32);
    group.add(mirrorCap);

    const repeater = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.12), side < 0 ? leftAmberMat : rightAmberMat);
    repeater.position.set(side * (carWidth * 0.58), baseChassisY + lowerH + 0.09, cabinZ - cabinLen * 0.32);
    group.add(repeater);
  }

  // 3. Functional Lighting: Projector Headlights with LED DRL Brow, Continuous Taillight Bar
  const headMat = new THREE.MeshBasicMaterial({ color: 0xf0fdf4 });
  const drlMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const brakeLightMatL = new THREE.MeshBasicMaterial({ color: 0x660f13 });
  const brakeLightMatR = new THREE.MeshBasicMaterial({ color: 0x660f13 });

  // Front Projector Headlights
  for (const side of [-1, 1]) {
    const hlHousing = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.08), headMat);
    hlHousing.position.set(side * (carWidth * 0.36), baseChassisY + lowerH * 0.62, -carLen * 0.51);
    group.add(hlHousing);

    // Jewel-eye DRL brow
    const drlBrow = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.09), drlMat);
    drlBrow.position.set(side * (carWidth * 0.36), baseChassisY + lowerH * 0.70, -carLen * 0.51);
    group.add(drlBrow);

    // Integrated Front Turn Signal
    const sigMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.08), side < 0 ? leftAmberMat : rightAmberMat);
    sigMesh.position.set(side * (carWidth * 0.44), baseChassisY + lowerH * 0.62, -carLen * 0.50);
    group.add(sigMesh);
  }

  // Rear Sculpted Fascia, Decklid Spoiler & Continuous LED Taillight Bar
  const rearDeck = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.90, lowerH * 0.78, carLen * 0.20), bodyMat);
  rearDeck.position.set(0, baseChassisY + lowerH * 0.39, carLen * 0.40);
  group.add(rearDeck);

  const ducktailLip = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * 0.84, 0.06, 0.14),
    style === 'coupe' ? carbonMat : bodyMat
  );
  ducktailLip.position.set(0, baseChassisY + lowerH * 0.82, carLen * 0.48);
  group.add(ducktailLip);

  // Modern Continuous LED Taillight Bar + Brake Modules
  const taillightBar = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.86, 0.05, 0.06), brakeLightMatL);
  taillightBar.position.set(0, baseChassisY + lowerH * 0.66, carLen * 0.50);
  group.add(taillightBar);

  const brakePodL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.06), brakeLightMatL);
  brakePodL.position.set(-carWidth * 0.32, baseChassisY + lowerH * 0.64, carLen * 0.505);
  group.add(brakePodL);

  const brakePodR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.06), brakeLightMatR);
  brakePodR.position.set(carWidth * 0.32, baseChassisY + lowerH * 0.64, carLen * 0.505);
  group.add(brakePodR);

  // Rear Turn Signal Repeaters
  const rearSigL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.06), leftAmberMat);
  rearSigL.position.set(-carWidth * 0.43, baseChassisY + lowerH * 0.64, carLen * 0.505);
  group.add(rearSigL);

  const rearSigR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.06), rightAmberMat);
  rearSigR.position.set(carWidth * 0.43, baseChassisY + lowerH * 0.64, carLen * 0.505);
  group.add(rearSigR);

  // Rear License Plate Recess
  const plateMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.18, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.1 })
  );
  plateMesh.position.set(0, baseChassisY + lowerH * 0.38, carLen * 0.51);
  group.add(plateMesh);

  // Lower Rear Diffuser & Polished Dual Chrome Exhaust Tips
  const rearDiffuser = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.88, 0.16, 0.12), carbonMat);
  rearDiffuser.position.set(0, baseChassisY + 0.08, carLen * 0.48);
  group.add(rearDiffuser);

  for (const ex of style === 'suv' || style === 'coupe' ? [-0.55, -0.42, 0.42, 0.55] : [-0.42, 0.42]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.14, 12), chromeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(ex, baseChassisY + 0.10, carLen * 0.52);
    group.add(pipe);
  }

  // 4. Wheels: Performance Low-Profile Tires + 5-Twin-Spoke Forged Alloy Wheels + Brembo Brake Caliper
  const wheelRadius = style === 'suv' ? 0.44 : 0.38;
  const tireGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.28, 18);
  tireGeom.rotateZ(Math.PI / 2);
  const rimGeom = new THREE.CylinderGeometry(wheelRadius * 0.76, wheelRadius * 0.76, 0.295, 16);
  rimGeom.rotateZ(Math.PI / 2);
  const rotorGeom = new THREE.CylinderGeometry(wheelRadius * 0.58, wheelRadius * 0.58, 0.305, 14);
  rotorGeom.rotateZ(Math.PI / 2);

  const caliperMat = new THREE.MeshStandardMaterial({
    color: style === 'coupe' ? 0xef4444 : 0xfbbf24,
    metalness: 0.6,
    roughness: 0.25,
  });

  const wheelPositions = [
    [-carWidth * 0.48, wheelRadius, -carLen * 0.32],
    [carWidth * 0.48, wheelRadius, -carLen * 0.32],
    [-carWidth * 0.48, wheelRadius, carLen * 0.31],
    [carWidth * 0.48, wheelRadius, carLen * 0.31],
  ];

  for (const [wx, wy, wz] of wheelPositions) {
    const tire = new THREE.Mesh(tireGeom, trimMat);
    tire.position.set(wx, wy, wz);

    const rim = new THREE.Mesh(rimGeom, chromeMat);
    tire.add(rim);

    const rotor = new THREE.Mesh(rotorGeom, chromeMat);
    tire.add(rotor);

    // 5-Spoke Forged Alloy Face
    const outX = wx < 0 ? -0.15 : 0.15;
    for (let sIdx = 0; sIdx < 5; sIdx++) {
      const angle = (sIdx * Math.PI * 2) / 5;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.024, wheelRadius * 1.35, 0.04), chromeMat);
      spoke.rotation.x = angle;
      spoke.position.set(outX, 0, 0);
      tire.add(spoke);
    }

    const caliper = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, wheelRadius * 0.44, wheelRadius * 0.28),
      caliperMat
    );
    caliper.position.set(wx < 0 ? -0.14 : 0.14, wheelRadius * 0.18, wz < 0 ? 0.10 : -0.10);
    tire.add(caliper);

    wheels.push(tire);
    group.add(tire);
  }

  // 5. 3D Fleeing Hit-and-Run / Wanted Criminal Target Beacon
  const fleeingBeaconGroup = new THREE.Group();
  fleeingBeaconGroup.visible = false;
  const fleeRingMat = new THREE.MeshBasicMaterial({
    color: 0xff2244,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const fleeRing = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.2, 32), fleeRingMat);
  fleeRing.rotation.x = -Math.PI / 2;
  fleeRing.position.y = 0.12;
  fleeingBeaconGroup.add(fleeRing);

  const fleeDiamondMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const fleeDiamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), fleeDiamondMat);
  fleeDiamond.position.y = 2.45;
  fleeingBeaconGroup.add(fleeDiamond);
  group.add(fleeingBeaconGroup);

  return {
    root: group,
    setBraking: (braking: boolean) => {
      const col = braking ? 0xff1522 : 0x660f13;
      brakeLightMatL.color.setHex(col);
      brakeLightMatR.color.setHex(col);
      taillightBar.material = braking ? brakeLightMatL : brakeLightMatR;
    },
    setTurnSignals: (left: boolean, right: boolean, hazards: boolean, timeSec: number) => {
      const flash = Math.floor(timeSec * 3.0) % 2 === 0;
      const flashCol = flash ? 0xf59e0b : 0x2b1504;
      leftAmberMat.color.setHex(left || hazards ? flashCol : 0x2b1504);
      rightAmberMat.color.setHex(right || hazards ? flashCol : 0x2b1504);
    },
    setWheelSpin: (speedKmh: number, dt: number) => {
      const spin = (speedKmh / 3.6) * dt * 2.6;
      for (let i = 0; i < wheels.length; i++) {
        wheels[i].rotation.x -= spin;
      }
    },
    setFleeingBeacon: (active: boolean, pulseTime: number) => {
      fleeingBeaconGroup.visible = active;
      if (!active) return;
      const pulse = 1.0 + Math.sin(pulseTime * 9.0) * 0.14;
      fleeRing.scale.set(pulse, pulse, 1);
      fleeDiamond.rotation.y = pulseTime * 4.5;
      fleeDiamond.position.y = 2.4 + Math.sin(pulseTime * 6.0) * 0.18;
      fleeRingMat.color.setHex(Math.floor(pulseTime * 8) % 2 === 0 ? 0xef4444 : 0xfacc15);
    },
  };
}

/**
 * Builds a marked Metro City Police Department (MCPD) Interceptor Cruiser with aerodynamic roof strobe lightbar
 */
export function buildPoliceInterceptorMesh(): BuiltPoliceCar {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const blackMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.22, metalness: 0.65 });
  const whiteDoorsMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.8 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.1, metalness: 0.9 });

  // Main chassis & Interceptor bodywork
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.58, 4.85), blackMat);
  chassis.position.y = 0.62;
  group.add(chassis);

  // White Doors & Roof (Classic Black-and-White Police Livery)
  const doorSection = new THREE.Mesh(new THREE.BoxGeometry(2.07, 0.54, 2.15), whiteDoorsMat);
  doorSection.position.set(0, 0.62, 0.05);
  group.add(doorSection);

  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.50, 2.3), glassMat);
  cabin.position.set(0, 1.12, 0.05);
  group.add(cabin);

  // White roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.06, 1.9), whiteDoorsMat);
  roof.position.set(0, 1.38, 0.05);
  group.add(roof);

  // Heavy-duty steel push bumper
  const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.52, 0.24), steelMat);
  pushBar.position.set(0, 0.56, -2.48);
  group.add(pushBar);

  // Rear spoiler
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.08, 0.28), blackMat);
  spoiler.position.set(0, 1.02, 2.25);
  group.add(spoiler);

  // Roof Strobe Lightbar Base
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 0.32), steelMat);
  barBase.position.set(0, 1.44, 0.0);
  group.add(barBase);

  // Strobe Pods (Red Driver Side, Blue Passenger Side)
  const redStrobeMat = new THREE.MeshBasicMaterial({ color: 0x3b0a0a });
  const blueStrobeMat = new THREE.MeshBasicMaterial({ color: 0x0a193b });

  const redPod = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.14, 0.28), redStrobeMat);
  redPod.position.set(-0.36, 1.50, 0.0);
  group.add(redPod);

  const bluePod = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.14, 0.28), blueStrobeMat);
  bluePod.position.set(0.36, 1.50, 0.0);
  group.add(bluePod);

  // Headlights & Taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.08), headMat);
  hlL.position.set(-0.68, 0.64, -2.42);
  group.add(hlL);
  const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.08), headMat);
  hlR.position.set(0.68, 0.64, -2.42);
  group.add(hlR);

  const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.08), tailMat);
  tlL.position.set(-0.66, 0.66, 2.42);
  group.add(tlL);
  const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.08), tailMat);
  tlR.position.set(0.66, 0.66, 2.42);
  group.add(tlR);

  const wheelGeom = new THREE.CylinderGeometry(0.37, 0.37, 0.28, 14);
  wheelGeom.rotateZ(Math.PI / 2);
  const wheelPositions = [
    [-0.98, 0.37, -1.52],
    [0.98, 0.37, -1.52],
    [-0.98, 0.37, 1.52],
    [0.98, 0.37, 1.52],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeom, blackMat);
    w.position.set(wx, wy, wz);
    const rimFace = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.29, 8), chromeMat);
    rimFace.rotation.z = Math.PI / 2;
    w.add(rimFace);
    wheels.push(w);
    group.add(w);
  }

  return {
    root: group,
    setSirenActive: (active: boolean, timeSec: number) => {
      if (!active) {
        redStrobeMat.color.setHex(0x3b0a0a);
        blueStrobeMat.color.setHex(0x0a193b);
        return;
      }
      const flash = Math.floor(timeSec * 11) % 2 === 0;
      redStrobeMat.color.setHex(flash ? 0xff1e1e : 0x2a0606);
      blueStrobeMat.color.setHex(flash ? 0x061538 : 0x2563eb);
    },
    setSteerAngle: (angle: number) => {
      if (wheels.length >= 2) {
        wheels[0].rotation.y = angle;
        wheels[1].rotation.y = angle;
      }
    },
    setWheelSpin: (speedKmh: number, dt: number) => {
      const spin = (speedKmh / 3.6) * dt * 2.6;
      for (let i = 0; i < wheels.length; i++) {
        wheels[i].rotation.x -= spin;
      }
    },
  };
}

/**
 * Builds a realistic 3D Suburban Residential House with pitched gabled roof, chimney,
 * attached garage, front porch with columns, front lawn, and concrete driveway connecting to the road.
 * Used in the Suburbs District for neighborhood ambiance and criminal hideouts.
 */
export interface BuiltSuburbanHouse {
  group: THREE.Group;
  collider: CityBuildingBox;
  drivewayTarget: { x: number; z: number };
  drivewayCoord: { x: number; z: number };
  address: string;
}

export function buildSuburbanHouseMesh(
  x: number,
  z: number,
  rotationY: number,
  opts: {
    wallColor: number;
    roofColor: number;
    address: string;
    tier?: 'starter' | 'regular' | 'luxury' | 'mansion';
  }
): BuiltSuburbanHouse {
  const group = new THREE.Group();
  group.position.set(x, 0.25, z);
  group.rotation.y = rotationY;

  const tier = opts.tier === 'mansion' ? 'luxury' : opts.tier || 'regular';

  const grassMat = new THREE.MeshStandardMaterial({ color: 0x26642b, roughness: 0.9, metalness: 0.02 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.72, metalness: 0.08 });
  const paverMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.65, metalness: 0.14 });
  const wallMat = new THREE.MeshStandardMaterial({ color: opts.wallColor, roughness: 0.62, metalness: 0.06 });
  const roofMat = new THREE.MeshStandardMaterial({ color: opts.roofColor, roughness: 0.76, metalness: 0.06 });
  const whiteTrimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.1 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.45, metalness: 0.12 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.14, metalness: 0.78 });
  const shutterMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 });
  const poolWaterMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.12, metalness: 0.75, transparent: true, opacity: 0.85 });
  const brickChimneyMat = new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.75, metalness: 0.06 });

  const makeRotatedCollider = (halfW: number, halfD: number, height: number) => {
    const c = Math.cos(rotationY);
    const s = Math.sin(rotationY);
    const rx = Math.abs(halfW * c) + Math.abs(halfD * s);
    const rz = Math.abs(halfW * s) + Math.abs(halfD * c);
    return {
      minX: x - rx,
      maxX: x + rx,
      minZ: z - rz,
      maxZ: z + rz,
      height,
      name: opts.address,
    };
  };

  if (tier === 'starter') {
    // ========================================================================
    // TIER 1: STARTER BUNGALOW (Compact Cozy Craftsman Cottage, 1-Car Carport)
    // ========================================================================
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.02, 20), grassMat);
    lawn.position.set(0, -0.02, 0);
    lawn.receiveShadow = true;
    group.add(lawn);

    const driveway = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.02, 9.0), concreteMat);
    driveway.position.set(4.6, -0.016, 5.2);
    driveway.receiveShadow = true;
    group.add(driveway);

    const cottage = new THREE.Mesh(new THREE.BoxGeometry(9.2, 3.8, 8.2), wallMat);
    cottage.position.set(-2.2, 1.9, -2.2);
    cottage.castShadow = true;
    cottage.receiveShadow = true;
    group.add(cottage);

    const roof = buildPitchedRoofGroup(9.5, 8.5, 2.4, wallMat, roofMat, 'x');
    roof.position.set(-2.2, 3.8, -2.2);
    group.add(roof);

    const carportRoof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.24, 6.4), roofMat);
    carportRoof.position.set(4.8, 3.1, -1.6);
    group.add(carportRoof);
    for (const cX of [3.0, 6.8]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.0, 0.22), whiteTrimMat);
      post.position.set(cX, 1.5, 1.3);
      group.add(post);
    }

    const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.14), doorMat);
    frontDoor.position.set(-2.2, 1.1, 1.94);
    group.add(frontDoor);

    const winFrameGeom = new THREE.BoxGeometry(1.42, 1.42, 0.09);
    const winGlassGeom = new THREE.BoxGeometry(1.16, 1.16, 0.12);
    for (const wx of [-4.8, 0.4]) {
      const wf = new THREE.Mesh(winFrameGeom, whiteTrimMat);
      wf.position.set(wx, 2.1, 1.92);
      group.add(wf);
      const win = new THREE.Mesh(winGlassGeom, glassMat);
      win.position.set(wx, 2.1, 1.94);
      group.add(win);
    }

    const dLocal = new THREE.Vector3(4.6, 0, 6.0);
    dLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

    return {
      group,
      collider: makeRotatedCollider(7.4, 6.2, 6.8),
      drivewayTarget: { x: x + dLocal.x, z: z + dLocal.z },
      drivewayCoord: { x: x + dLocal.x, z: z + dLocal.z },
      address: opts.address,
    };
  } else if (tier === 'luxury') {
    // ========================================================================
    // TIER 3: MARYLAND EXECUTIVE ESTATE (Clean 2-Story Manor + Attached 3-Car Garage + Pool)
    // ========================================================================
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(24, 0.02, 25), grassMat);
    lawn.position.set(0, -0.02, 0);
    lawn.receiveShadow = true;
    group.add(lawn);

    const driveway = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.02, 9.6), paverMat);
    driveway.position.set(6.4, -0.016, 6.8);
    driveway.receiveShadow = true;
    group.add(driveway);

    const walkPath = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.02, 9.0), paverMat);
    walkPath.position.set(-3.8, -0.016, 6.6);
    group.add(walkPath);

    const mainVilla = new THREE.Mesh(new THREE.BoxGeometry(12.4, 6.6, 9.4), wallMat);
    mainVilla.position.set(-3.8, 3.3, -2.5);
    mainVilla.castShadow = true;
    group.add(mainVilla);

    const manorRoof = buildPitchedRoofGroup(12.8, 9.8, 3.3, wallMat, roofMat, 'x');
    manorRoof.position.set(-3.8, 6.6, -2.5);
    group.add(manorRoof);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.15, 5.2, 1.3), brickChimneyMat);
    chimney.position.set(-10.3, 6.9, -2.5);
    group.add(chimney);

    const portico = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.34, 2.2), whiteTrimMat);
    portico.position.set(-3.8, 3.6, 3.1);
    group.add(portico);
    for (const px of [-5.4, -2.2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 3.5, 8), whiteTrimMat);
      col.position.set(px, 1.75, 3.9);
      group.add(col);
    }
    const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.7, 0.14), doorMat);
    frontDoor.position.set(-3.8, 1.35, 2.24);
    group.add(frontDoor);

    const winFrameGeom = new THREE.BoxGeometry(1.45, 1.65, 0.1);
    const winGlassGeom = new THREE.BoxGeometry(1.18, 1.36, 0.13);
    for (const [wx, wy] of [
      [-7.6, 1.9],
      [0.0, 1.9],
      [-7.6, 4.7],
      [-3.8, 4.7],
      [0.0, 4.7],
    ] as [number, number][]) {
      const wf = new THREE.Mesh(winFrameGeom, whiteTrimMat);
      wf.position.set(wx, wy, 2.22);
      group.add(wf);
      const wg = new THREE.Mesh(winGlassGeom, glassMat);
      wg.position.set(wx, wy, 2.24);
      group.add(wg);
    }

    const luxuryGarage = new THREE.Mesh(new THREE.BoxGeometry(8.0, 3.8, 7.6), wallMat);
    luxuryGarage.position.set(6.4, 1.9, -1.7);
    luxuryGarage.castShadow = true;
    group.add(luxuryGarage);

    const garageRoof = buildPitchedRoofGroup(8.3, 7.9, 2.1, wallMat, roofMat, 'x');
    garageRoof.position.set(6.4, 3.8, -1.7);
    group.add(garageRoof);

    for (const gxOff of [-2.4, 0, 2.4]) {
      const gDoor = new THREE.Mesh(new THREE.BoxGeometry(2.05, 2.6, 0.15), whiteTrimMat);
      gDoor.position.set(6.4 + gxOff, 1.3, 2.14);
      group.add(gDoor);
    }

    const poolDeck = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.02, 4.4), paverMat);
    poolDeck.position.set(-3.8, -0.016, -9.8);
    group.add(poolDeck);

    const poolBasin = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.02, 3.0), poolWaterMat);
    poolBasin.position.set(-3.8, -0.014, -9.8);
    group.add(poolBasin);

    const dLocal = new THREE.Vector3(6.4, 0, 8.0);
    dLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

    return {
      group,
      collider: makeRotatedCollider(10.8, 8.0, 10.5),
      drivewayTarget: { x: x + dLocal.x, z: z + dLocal.z },
      drivewayCoord: { x: x + dLocal.x, z: z + dLocal.z },
      address: opts.address,
    };
  }

  // ========================================================================
  // TIER 2: REGULAR FAMILY SUBURBS (2-Story Colonial, Attached 2-Car Garage)
  // ========================================================================
  const lawn = new THREE.Mesh(new THREE.BoxGeometry(20, 0.02, 24), grassMat);
  lawn.position.set(0, -0.02, 0);
  lawn.receiveShadow = true;
  group.add(lawn);

  const driveway = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.02, 10.0), concreteMat);
  driveway.position.set(5.4, -0.016, 6.2);
  driveway.receiveShadow = true;
  group.add(driveway);

  const mainHouse = new THREE.Mesh(new THREE.BoxGeometry(10.6, 5.6, 8.8), wallMat);
  mainHouse.position.set(-2.6, 2.8, -2.5);
  mainHouse.castShadow = true;
  group.add(mainHouse);

  const garage = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.5, 7.2), wallMat);
  garage.position.set(5.6, 1.75, -1.7);
  garage.castShadow = true;
  group.add(garage);

  const garageDoor = new THREE.Mesh(new THREE.BoxGeometry(4.7, 2.6, 0.15), whiteTrimMat);
  garageDoor.position.set(5.6, 1.3, 1.94);
  group.add(garageDoor);

  const roofRidge = buildPitchedRoofGroup(11.0, 9.2, 2.9, wallMat, roofMat, 'x');
  roofRidge.position.set(-2.6, 5.6, -2.5);
  group.add(roofRidge);

  const garageRoof = buildPitchedRoofGroup(6.1, 7.5, 1.8, wallMat, roofMat, 'z');
  garageRoof.position.set(5.6, 3.5, -1.7);
  group.add(garageRoof);

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.4, 1.25), brickChimneyMat);
  chimney.position.set(-8.2, 6.1, -2.5);
  group.add(chimney);

  const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.3, 0.14), doorMat);
  frontDoor.position.set(-2.6, 1.15, 1.94);
  group.add(frontDoor);

  const portico = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.24, 1.6), whiteTrimMat);
  portico.position.set(-2.6, 2.8, 2.65);
  group.add(portico);
  for (const px of [-3.8, -1.4]) {
    const pCol = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.6, 7), whiteTrimMat);
    pCol.position.set(px, 1.3, 3.25);
    group.add(pCol);
  }

  const winFrameGeom = new THREE.BoxGeometry(1.36, 1.56, 0.09);
  const winGeom = new THREE.BoxGeometry(1.1, 1.3, 0.12);
  const shutterGeom = new THREE.BoxGeometry(0.38, 1.5, 0.08);
  for (const [wx, wy, wz] of [
    [-5.6, 1.6, 1.92],
    [0.4, 1.6, 1.92],
    [-5.6, 4.2, 1.92],
    [-2.6, 4.2, 1.92],
    [0.4, 4.2, 1.92],
  ] as [number, number, number][]) {
    const wf = new THREE.Mesh(winFrameGeom, whiteTrimMat);
    wf.position.set(wx, wy, wz);
    group.add(wf);
    const win = new THREE.Mesh(winGeom, glassMat);
    win.position.set(wx, wy, wz + 0.02);
    group.add(win);
    for (const sSide of [-0.9, 0.9]) {
      const sh = new THREE.Mesh(shutterGeom, shutterMat);
      sh.position.set(wx + sSide, wy, wz + 0.01);
      group.add(sh);
    }
  }

  const dLocal = new THREE.Vector3(5.6, 0, 6.0);
  dLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

  return {
    group,
    collider: makeRotatedCollider(8.8, 7.2, 9.5),
    drivewayTarget: { x: x + dLocal.x, z: z + dLocal.z },
    drivewayCoord: { x: x + dLocal.x, z: z + dLocal.z },
    address: opts.address,
  };
}

/**
 * Updates dynamic vehicle lighting (Amber Turn Signals at 1.5 Hz, Bright Crimson Brake Lights, Police Strobes)
 */
export function updateVehicleLighting(
  overlayOrRoot: THREE.Object3D,
  arg2:
    | number
    | {
        isBraking: boolean;
        turnSignal?: 'left' | 'right' | 'hazards' | 'off';
        sirenActive?: boolean;
        timeSec: number;
        isPoliceOnDuty?: boolean;
      },
  isBraking?: boolean,
  leftSignal?: boolean,
  rightSignal?: boolean,
  sirenActive?: boolean,
  isPoliceOnDuty?: boolean
): void {
  let timeSec: number;
  let braking: boolean;
  let leftOn: boolean;
  let rightOn: boolean;
  let siren: boolean;
  let policeDuty: boolean;

  if (typeof arg2 === 'object') {
    timeSec = arg2.timeSec;
    braking = Boolean(arg2.isBraking);
    leftOn = arg2.turnSignal === 'left' || arg2.turnSignal === 'hazards';
    rightOn = arg2.turnSignal === 'right' || arg2.turnSignal === 'hazards';
    siren = Boolean(arg2.sirenActive);
    policeDuty = Boolean(arg2.isPoliceOnDuty);
  } else {
    timeSec = arg2;
    braking = Boolean(isBraking);
    leftOn = Boolean(leftSignal);
    rightOn = Boolean(rightSignal);
    siren = Boolean(sirenActive);
    policeDuty = Boolean(isPoliceOnDuty);
  }

  const childOverlay = overlayOrRoot.getObjectByName('city_street_car_overlay');
  const uData =
    overlayOrRoot.userData?.roofBarGroup
      ? overlayOrRoot.userData
      : childOverlay?.userData?.roofBarGroup
      ? childOverlay.userData
      : overlayOrRoot.userData || {};

  const flash = Math.floor(timeSec * 3.0) % 2 === 0;
  const flashAmber = flash ? 0xf59e0b : 0x2b1504;

  const leftMats = uData.leftSignalMats as THREE.MeshBasicMaterial[] | undefined;
  if (leftMats) {
    for (const m of leftMats) {
      m.color.setHex(leftOn ? flashAmber : 0x2b1504);
    }
  }

  const rightMats = uData.rightSignalMats as THREE.MeshBasicMaterial[] | undefined;
  if (rightMats) {
    for (const m of rightMats) {
      m.color.setHex(rightOn ? flashAmber : 0x2b1504);
    }
  }

  const brakeMats = uData.brakeMats as THREE.MeshBasicMaterial[] | undefined;
  if (brakeMats) {
    for (const m of brakeMats) {
      m.color.setHex(braking ? 0xff1522 : 0x660f13);
    }
  }

  // Police marked cruiser package visibility: visible the second player is on duty OR sirens active
  const showPoliceMarks = Boolean(policeDuty || siren);

  const roofBar = (uData.roofBarGroup || overlayOrRoot.getObjectByName('police_roof_bar')) as THREE.Group | undefined;
  if (roofBar) {
    roofBar.visible = showPoliceMarks;
  }

  const pushBumper = (uData.policePushBumper || overlayOrRoot.getObjectByName('police_push_bumper')) as THREE.Group | undefined;
  if (pushBumper) {
    pushBumper.visible = showPoliceMarks;
  }

  const decals = uData.policeDecals as THREE.Mesh[] | undefined;
  if (decals) {
    for (const d of decals) {
      d.visible = showPoliceMarks;
    }
  }

  // Also check named children fallback
  for (const name of ['police_decal_left', 'police_decal_right', 'police_decal_hood', 'police_decal_trunk']) {
    const mesh = overlayOrRoot.getObjectByName(name);
    if (mesh) mesh.visible = showPoliceMarks;
  }

  if (uData.sirenRedMat && uData.sirenBlueMat) {
    if (!showPoliceMarks) {
      uData.sirenRedMat.color.setHex(0x220505);
      uData.sirenBlueMat.color.setHex(0x051433);
    } else if (!siren) {
      // Steady burn / low-power police presence strobe
      const slowGlow = Math.floor(timeSec * 2) % 2 === 0;
      uData.sirenRedMat.color.setHex(slowGlow ? 0xcc1818 : 0x550a0a);
      uData.sirenBlueMat.color.setHex(slowGlow ? 0x1d4ed8 : 0x0a1e50);
    } else {
      // Emergency high-speed wig-wag strobes (12 Hz)
      const sirenFlash = Math.floor(timeSec * 12) % 2 === 0;
      uData.sirenRedMat.color.setHex(sirenFlash ? 0xff0000 : 0x110202);
      uData.sirenBlueMat.color.setHex(sirenFlash ? 0x001133 : 0x0066ff);
    }
  }
}

