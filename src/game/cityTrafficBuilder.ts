import * as THREE from 'three';
import { BuiltCar } from './carBuilder';
import {
  getAutomotiveHeadlightPatternTexture,
  getCarPaintFlakeNormalTexture,
  getHeadlightGroundPoolTexture,
  getHeadlightHaloTexture,
  getLawnPBRTextures,
  getLeafClusterTexture,
} from './pbrTextures';
import { getGraphicsPresetConfig } from '../utils/graphicsSettings';
import type { WorkplaceShiftKind } from './homeFurnishings';
import {
  buildSculptedStreetCarBody,
  buildSculptedCivilianHull,
  buildSculptedPoliceHull,
  evalFasciaAnchor,
  resolveStreetCarSilhouette,
} from './carSculptBuilder';
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
  CITY_SPORTS_CATALOG,
  CITY_SERVICE_STATIONS,
  MARYLAND_SPEED_CAMERAS,
  CITY_CAR_MEET_ZONES,
  isOnMarylandPavedSurface,
  MAYHILL_CT_ROUNDABOUT,
} from './marylandRoadNetwork';
import type {
  CitySportType,
  CitySportVenueSpec,
  CityServiceStationSpec,
  SpeedCameraSpec,
  CityCarMeetSpec,
} from './marylandRoadNetwork';

export type {
  MarylandRoadSpec,
  GaithersburgRoadSpec,
  CitySportType,
  CitySportVenueSpec,
  CityServiceStationSpec,
  SpeedCameraSpec,
  CityCarMeetSpec,
};
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
  CITY_SPORTS_CATALOG,
  CITY_SERVICE_STATIONS,
  MARYLAND_SPEED_CAMERAS,
  CITY_CAR_MEET_ZONES,
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
  stories?: number;
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
  bodyPitch?: number;
  bodyRoll?: number;
}

export interface PoliceCarEntity {
  id: string;
  built: BuiltPoliceCar;
  pos: THREE.Vector3;
  heading: number;
  speedKmh: number;
  velX?: number;
  velZ?: number;
  slipAngle?: number;
  spinTimer?: number;
  ramRecoveryTimer?: number;
  knockbackCooldown?: number;
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
  | 'pickup_truck'
  | 'offroad_suv'
  | 'supercar_wedge'
  | 'hypercar_gt'
  | 'f1_street';

export type StreetCarModelArchetype =
  | 'honda_civic'
  | 'toyota_camry'
  | 'chevy_camaro'
  | 'chevy_corvette'
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
  | 'koenigsegg_jesko'
  | 'pickup_crew'
  | 'suv_offroad'
  | 'suv_sport';

export interface StreetCarTrimSpec {
  id: string;
  name: string;
  upgradePrice: number; // $0 for base trim
  horsepower: number;
  zeroToSixtySec: number;
  topSpeedKmh: number;
  drivetrain: 'FWD' | 'RWD' | 'AWD';
  groundClearance?: 'low' | 'medium' | 'high';
  groundClearanceInches?: number;
  offRoadScore?: number; // 0-100 realistic off-road capability (tires, suspension travel, lockers, geometry)
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
  groundClearanceInches?: number;
  offRoadScore?: number; // 0-100 realistic off-road capability
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
    handlingScore: 77,
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
        handlingScore: 78,
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
        handlingScore: 80,
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
        handlingScore: 79,
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
    handlingScore: 79,
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
        handlingScore: 79,
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
        handlingScore: 81,
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
        handlingScore: 83,
        brakesScore: 93,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#18181b',
      },
    ],
  },
  {
    id: 'chevy_corvette',
    name: 'Chevrolet Corvette C8 (Stingray / Z06)',
    manufacturer: 'Chevrolet',
    category: 'Mid-Engine American Supercar',
    price: 68300,
    horsepower: 495,
    zeroToSixtySec: 2.9,
    topSpeedKmh: 312,
    drivetrain: 'RWD',
    engineLayout: '6.2L LT2 Mid-Mounted V8',
    enginePowerRating: 92,
    accelerationScore: 95,
    handlingScore: 95,
    brakesScore: 94,
    defaultColor: '#ef4444',
    accentColor: '#18181b',
    bodyStyle: 'supercar_wedge',
    modelArchetype: 'chevy_corvette',
    description:
      'Cab-forward mid-engine Corvette C8 with razor-sharp pointed nose, iconic black boomerang side air intakes, clear rear V8 engine showcase hatch, and twin-L quad chevron taillights. Upgrade to the 670 HP 8,600 RPM flat-plane crank Z06 or track-dominant Z07 Carbon Aero package!',
    trims: [
      {
        id: 'corvette_stingray_z51',
        name: 'Stingray Z51 Performance',
        upgradePrice: 0,
        horsepower: 495,
        zeroToSixtySec: 2.9,
        topSpeedKmh: 312,
        drivetrain: 'RWD',
        engineLayout: '6.2L LT2 Cross-Plane V8 (Mid-Engine)',
        accelerationScore: 95,
        handlingScore: 95,
        brakesScore: 94,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'corvette_z06',
        name: 'Corvette Z06 (670 HP 8,600 RPM)',
        upgradePrice: 46000,
        horsepower: 670,
        zeroToSixtySec: 2.6,
        topSpeedKmh: 328,
        drivetrain: 'RWD',
        engineLayout: '5.5L LT6 Flat-Plane Crank DOHC V8 + Center Quad Exhaust',
        accelerationScore: 100,
        handlingScore: 98,
        brakesScore: 98,
        aeroStyle: 'gt_wing',
        accentColorOverride: '#090d16',
      },
      {
        id: 'corvette_z06_z07',
        name: 'Z06 Z07 Carbon Aero & Ceramic',
        upgradePrice: 72000,
        horsepower: 670,
        zeroToSixtySec: 2.5,
        topSpeedKmh: 322,
        drivetrain: 'RWD',
        engineLayout: '5.5L LT6 8,600 RPM V8 + Carbon Wheels & High-Downforce Wing',
        accelerationScore: 101,
        handlingScore: 102,
        brakesScore: 101,
        aeroStyle: 'widebody_gt',
        accentColorOverride: '#facc15',
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

  // =========================================================================
  // PICKUP TRUCKS & OFF-ROAD 4x4 SUVs (HIGH GROUND CLEARANCE -> FAST ON GRASS!)
  // =========================================================================
  {
    id: 'ford_maverick_tremor',
    name: 'Ford Maverick Tremor AWD',
    manufacturer: 'Ford',
    category: 'Compact Off-Road Pickup',
    price: 34500,
    horsepower: 250,
    zeroToSixtySec: 6.2,
    topSpeedKmh: 185,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 9.4,
    engineLayout: '2.0L EcoBoost Turbo I4 + Twin-Clutch Rear Drive Unit',
    enginePowerRating: 80,
    accelerationScore: 81,
    handlingScore: 83,
    brakesScore: 84,
    defaultColor: '#ea580c',
    accentColor: '#18181b',
    bodyStyle: 'pickup_truck',
    modelArchetype: 'pickup_crew',
    description:
      'Nimble Tremor-package pickup with 9.4" ground clearance, skid plates, and torque-vectoring AWD that slices across lawns faster than sedans.',
    trims: [
      {
        id: 'maverick_fx4',
        name: 'XLT FX4 Off-Road (8.6" Clearance)',
        upgradePrice: 0,
        horsepower: 250,
        zeroToSixtySec: 6.3,
        topSpeedKmh: 180,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 8.6,
        engineLayout: '2.0L EcoBoost Turbo I4',
        accelerationScore: 80,
        handlingScore: 82,
        brakesScore: 83,
        aeroStyle: 'stock',
      },
      {
        id: 'maverick_tremor_pack',
        name: 'Tremor Advanced 4WD (9.4" Clearance)',
        upgradePrice: 4500,
        horsepower: 275,
        zeroToSixtySec: 5.9,
        topSpeedKmh: 192,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 9.4,
        engineLayout: '2.0L Tuned EcoBoost + Locking Rear Diff',
        accelerationScore: 83,
        handlingScore: 85,
        brakesScore: 85,
        aeroStyle: 'stock',
        accentColorOverride: '#f97316',
      },
    ],
  },
  {
    id: 'jeep_gladiator_mojave',
    name: 'Jeep Gladiator Mojave / Rubicon',
    manufacturer: 'Jeep',
    category: 'Desert Off-Road Pickup',
    price: 53000,
    horsepower: 285,
    zeroToSixtySec: 7.1,
    topSpeedKmh: 182,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 11.6,
    engineLayout: '3.6L Pentastar V6 + FOX Internal Bypass Shocks',
    enginePowerRating: 82,
    accelerationScore: 78,
    handlingScore: 81,
    brakesScore: 82,
    defaultColor: '#65a30d',
    accentColor: '#f97316',
    bodyStyle: 'pickup_truck',
    modelArchetype: 'pickup_crew',
    description:
      'Desert-rated Jeep Gladiator with 11.6 inches of ground clearance, solid axles, and optional 392 HEMI swap for effortless grass escapes.',
    trims: [
      {
        id: 'gladiator_mojave_v6',
        name: 'Mojave 3.6L V6 (11.6" Clearance)',
        upgradePrice: 0,
        horsepower: 285,
        zeroToSixtySec: 7.1,
        topSpeedKmh: 182,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 11.6,
        engineLayout: '3.6L Pentastar V6 + FOX 2.5" Reservoir Shocks',
        accelerationScore: 78,
        handlingScore: 81,
        brakesScore: 82,
        aeroStyle: 'stock',
      },
      {
        id: 'gladiator_392_swap',
        name: 'Gladiator 392 V8 Swap (12.2" Lift)',
        upgradePrice: 28000,
        horsepower: 470,
        zeroToSixtySec: 4.7,
        topSpeedKmh: 196,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 12.2,
        engineLayout: '6.4L HEMI 392 V8 + 37" Mud-Terrain Tires',
        accelerationScore: 89,
        handlingScore: 82,
        brakesScore: 85,
        aeroStyle: 'stock',
        accentColorOverride: '#ca8a04',
      },
    ],
  },
  {
    id: 'ford_ranger_raptor',
    name: 'Ford Ranger Raptor 4x4',
    manufacturer: 'Ford',
    category: 'Mid-Size Baja Pickup',
    price: 57500,
    horsepower: 405,
    zeroToSixtySec: 5.3,
    topSpeedKmh: 195,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 10.7,
    engineLayout: '3.0L Twin-Turbo EcoBoost V6',
    enginePowerRating: 87,
    accelerationScore: 86,
    handlingScore: 87,
    brakesScore: 87,
    defaultColor: '#38bdf8',
    accentColor: '#18181b',
    bodyStyle: 'pickup_truck',
    modelArchetype: 'pickup_crew',
    description:
      'Ford Performance Ranger Raptor with 405 HP, 10.7" clearance, Fox Live Valve coilovers, and front/rear locking diffs.',
    trims: [
      {
        id: 'ranger_raptor_stock',
        name: 'Ranger Raptor 3.0L V6 (10.7" Clearance)',
        upgradePrice: 0,
        horsepower: 405,
        zeroToSixtySec: 5.3,
        topSpeedKmh: 195,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 10.7,
        engineLayout: '3.0L Twin-Turbo V6 + Anti-Lag Baja Mode',
        accelerationScore: 86,
        handlingScore: 87,
        brakesScore: 87,
        aeroStyle: 'stock',
      },
      {
        id: 'ranger_raptor_hennessey',
        name: 'VelociRaptor 500 Twin-Turbo (11.5" Lift)',
        upgradePrice: 22000,
        horsepower: 500,
        zeroToSixtySec: 4.5,
        topSpeedKmh: 212,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 11.5,
        engineLayout: '3.0L Upgraded Twin-Turbo + High-Clearance Lift',
        accelerationScore: 91,
        handlingScore: 88,
        brakesScore: 89,
        aeroStyle: 'stock',
        accentColorOverride: '#ef4444',
      },
    ],
  },
  {
    id: 'toyota_tacoma_trd_pro',
    name: 'Toyota Tacoma TRD Pro i-FORCE MAX',
    manufacturer: 'Toyota',
    category: 'Mid-Size Off-Road Pickup',
    price: 63900,
    horsepower: 326,
    zeroToSixtySec: 6.9,
    topSpeedKmh: 182,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 11.0,
    engineLayout: '2.4L Turbo Hybrid i-FORCE MAX (465 lb-ft)',
    enginePowerRating: 84,
    accelerationScore: 81,
    handlingScore: 85,
    brakesScore: 85,
    defaultColor: '#f97316',
    accentColor: '#111827',
    bodyStyle: 'pickup_truck',
    modelArchetype: 'pickup_crew',
    description:
      'Iconic Terra orange Tacoma TRD Pro with 11.0" ground clearance, IsoDynamic seats, steel ARB rear bumper, and Old Man Emu/FOX suspension.',
    trims: [
      {
        id: 'tacoma_trd_offroad',
        name: 'TRD Off-Road 4x4 (9.5" Clearance)',
        upgradePrice: 0,
        horsepower: 278,
        zeroToSixtySec: 7.2,
        topSpeedKmh: 178,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 9.5,
        engineLayout: '2.4L i-FORCE Turbo I4',
        accelerationScore: 78,
        handlingScore: 83,
        brakesScore: 83,
        aeroStyle: 'stock',
      },
      {
        id: 'tacoma_trd_pro_trim',
        name: 'TRD Pro i-FORCE MAX (11.0" Clearance)',
        upgradePrice: 14500,
        horsepower: 326,
        zeroToSixtySec: 6.6,
        topSpeedKmh: 188,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 11.0,
        engineLayout: '2.4L Hybrid 465 lb-ft + FOX QS3 Bypass',
        accelerationScore: 82,
        handlingScore: 86,
        brakesScore: 86,
        aeroStyle: 'stock',
        accentColorOverride: '#ea580c',
      },
    ],
  },
  {
    id: 'chevy_silverado_zr2',
    name: 'Chevrolet Silverado 1500 ZR2 Bison',
    manufacturer: 'Chevrolet',
    category: 'Full-Size Off-Road Pickup',
    price: 71500,
    horsepower: 420,
    zeroToSixtySec: 5.4,
    topSpeedKmh: 185,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 11.2,
    engineLayout: '6.2L EcoTec3 V8 + Multimatic DSSV Dampers',
    enginePowerRating: 88,
    accelerationScore: 86,
    handlingScore: 83,
    brakesScore: 85,
    defaultColor: '#cbd5e1',
    accentColor: '#dc2626',
    bodyStyle: 'pickup_truck',
    modelArchetype: 'pickup_crew',
    description:
      'AEV Bison armor-plated Silverado ZR2 with 11.2" clearance, front/rear e-lockers, and naturally aspirated 6.2L V8 power.',
    trims: [
      {
        id: 'silverado_zr2_62',
        name: 'Silverado ZR2 6.2L V8 (11.2" Clearance)',
        upgradePrice: 0,
        horsepower: 420,
        zeroToSixtySec: 5.4,
        topSpeedKmh: 185,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 11.2,
        engineLayout: '6.2L V8 + Multimatic DSSV Spool-Valve',
        accelerationScore: 86,
        handlingScore: 83,
        brakesScore: 85,
        aeroStyle: 'stock',
      },
      {
        id: 'silverado_zr2_bison_sc',
        name: 'ZR2 Bison Supercharged (11.8" Clearance)',
        upgradePrice: 26000,
        horsepower: 650,
        zeroToSixtySec: 4.0,
        topSpeedKmh: 205,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 11.8,
        engineLayout: '6.2L Whipple Supercharged V8 + AEV Steel Armor',
        accelerationScore: 95,
        handlingScore: 84,
        brakesScore: 87,
        aeroStyle: 'stock',
        accentColorOverride: '#ef4444',
      },
    ],
  },
  {
    id: 'ram_1500_trx',
    name: 'RAM 1500 TRX Final Edition',
    manufacturer: 'RAM',
    category: 'Supercharged Baja Truck',
    price: 96500,
    horsepower: 702,
    zeroToSixtySec: 3.7,
    topSpeedKmh: 190,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 11.8,
    engineLayout: '6.2L Supercharged HEMI V8 Hellcat',
    enginePowerRating: 95,
    accelerationScore: 95,
    handlingScore: 84,
    brakesScore: 87,
    defaultColor: '#b91c1c',
    accentColor: '#18181b',
    bodyStyle: 'pickup_truck',
    modelArchetype: 'pickup_crew',
    description:
      'Apex predator 702 HP supercharged Hellcat pickup with 11.8" clearance and Bilstein Black Hawk e2 adaptive shocks that thunder across fields.',
    trims: [
      {
        id: 'trx_702',
        name: 'TRX 702 HP Hellcat (11.8" Clearance)',
        upgradePrice: 0,
        horsepower: 702,
        zeroToSixtySec: 3.7,
        topSpeedKmh: 190,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 11.8,
        engineLayout: '6.2L Supercharged HEMI V8',
        accelerationScore: 95,
        handlingScore: 84,
        brakesScore: 87,
        aeroStyle: 'stock',
      },
      {
        id: 'trx_mammoth_1000',
        name: 'TRX Mammoth 1000 Overlander (12.4" Lift)',
        upgradePrice: 38000,
        horsepower: 1012,
        zeroToSixtySec: 3.1,
        topSpeedKmh: 238,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 12.4,
        engineLayout: '6.2L High-Boost 2.65L Supercharged V8',
        accelerationScore: 104,
        handlingScore: 85,
        brakesScore: 90,
        aeroStyle: 'stock',
        accentColorOverride: '#f59e0b',
      },
    ],
  },
  {
    id: 'ford_f150_raptor_r',
    name: 'Ford F-150 Raptor R',
    manufacturer: 'Ford',
    category: 'Trophy Desert Supertruck',
    price: 111500,
    horsepower: 720,
    zeroToSixtySec: 3.6,
    topSpeedKmh: 215,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 13.1,
    engineLayout: '5.2L Supercharged Predator V8',
    enginePowerRating: 97,
    accelerationScore: 96,
    handlingScore: 86,
    brakesScore: 88,
    defaultColor: '#0284c7',
    accentColor: '#f97316',
    bodyStyle: 'pickup_truck',
    modelArchetype: 'pickup_crew',
    description:
      '720 HP Predator V8 Raptor R riding on 37-inch tires with 13.1 inches of ground clearance—built to outrun police cruisers effortlessly across Maryland fields.',
    trims: [
      {
        id: 'raptor_35_v6',
        name: 'F-150 Raptor 3.5L EcoBoost (12.0" Clearance)',
        upgradePrice: 0,
        horsepower: 450,
        zeroToSixtySec: 5.1,
        topSpeedKmh: 185,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 12.0,
        engineLayout: '3.5L High-Output EcoBoost V6',
        accelerationScore: 88,
        handlingScore: 85,
        brakesScore: 86,
        aeroStyle: 'stock',
      },
      {
        id: 'raptor_r_v8',
        name: 'Raptor R 5.2L Supercharged V8 (13.1" Clearance)',
        upgradePrice: 32000,
        horsepower: 720,
        zeroToSixtySec: 3.6,
        topSpeedKmh: 215,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 13.1,
        engineLayout: '5.2L Predator Supercharged V8 + 37" KO2s',
        accelerationScore: 97,
        handlingScore: 87,
        brakesScore: 89,
        aeroStyle: 'stock',
        accentColorOverride: '#f97316',
      },
    ],
  },
  {
    id: 'rivian_r1t_quad',
    name: 'Rivian R1T Quad-Motor Max',
    manufacturer: 'Rivian',
    category: 'Electric Adventure Pickup',
    price: 94000,
    horsepower: 1025,
    zeroToSixtySec: 2.5,
    topSpeedKmh: 218,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 14.9,
    engineLayout: 'Quad-Motor Independent Torque-Vectoring EV + Air Suspension',
    enginePowerRating: 104,
    accelerationScore: 107,
    handlingScore: 90,
    brakesScore: 92,
    defaultColor: '#eab308',
    accentColor: '#38bdf8',
    bodyStyle: 'pickup_truck',
    modelArchetype: 'pickup_crew',
    description:
      'Active air suspension raises the Rivian R1T to an enormous 14.9 inches of clearance while 1,025 HP quad motors launch 0-60 in 2.5s on dirt or pavement.',
    trims: [
      {
        id: 'r1t_dual_perf',
        name: 'Dual-Motor Performance (14.4" Clearance)',
        upgradePrice: 0,
        horsepower: 665,
        zeroToSixtySec: 3.5,
        topSpeedKmh: 201,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 14.4,
        engineLayout: 'Dual-Motor AWD + 14.4" Air Ride',
        accelerationScore: 96,
        handlingScore: 88,
        brakesScore: 90,
        aeroStyle: 'stock',
      },
      {
        id: 'r1t_quad_ascend',
        name: 'Ascend Quad-Motor 1,025 HP (14.9" Clearance)',
        upgradePrice: 18000,
        horsepower: 1025,
        zeroToSixtySec: 2.5,
        topSpeedKmh: 218,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 14.9,
        engineLayout: 'Quad-Motor 1,198 lb-ft + Launch Mode',
        accelerationScore: 107,
        handlingScore: 90,
        brakesScore: 92,
        aeroStyle: 'stock',
        accentColorOverride: '#facc15',
      },
    ],
  },
  {
    id: 'gmc_hummer_ev_pickup',
    name: 'GMC Hummer EV 3X Pickup',
    manufacturer: 'GMC',
    category: 'Electric Supertruck',
    price: 106900,
    horsepower: 1000,
    zeroToSixtySec: 3.0,
    topSpeedKmh: 175,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 15.9,
    engineLayout: 'Tri-Motor Ultium EV + Extract Mode (15.9" Lift)',
    enginePowerRating: 102,
    accelerationScore: 103,
    handlingScore: 82,
    brakesScore: 86,
    defaultColor: '#f8fafc',
    accentColor: '#38bdf8',
    bodyStyle: 'pickup_truck',
    modelArchetype: 'pickup_crew',
    description:
      'Extract Mode jacks this 1,000 HP Ultium supertruck up to 15.9 inches of ground clearance with 4-wheel steer and 35" Goodyear Territory M/Ts.',
    trims: [
      {
        id: 'hummer_ev_2x',
        name: 'Hummer EV 2X (11.9" Standard Ride)',
        upgradePrice: 0,
        horsepower: 570,
        zeroToSixtySec: 4.4,
        topSpeedKmh: 171,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 11.9,
        engineLayout: 'Dual-Motor Ultium EV + 4-Wheel Steer',
        accelerationScore: 90,
        handlingScore: 81,
        brakesScore: 85,
        aeroStyle: 'stock',
      },
      {
        id: 'hummer_ev_3x_extract',
        name: '3X Watts-To-Freedom Extract (15.9" Clearance)',
        upgradePrice: 12000,
        horsepower: 1000,
        zeroToSixtySec: 3.0,
        topSpeedKmh: 185,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 15.9,
        engineLayout: 'Tri-Motor 1,000 HP + Extract Air Suspension',
        accelerationScore: 103,
        handlingScore: 83,
        brakesScore: 87,
        aeroStyle: 'stock',
        accentColorOverride: '#0284c7',
      },
    ],
  },
  {
    id: 'toyota_land_cruiser',
    name: 'Toyota Land Cruiser 1958 / First Edition',
    manufacturer: 'Toyota',
    category: 'Heritage 4x4 SUV',
    price: 57500,
    horsepower: 326,
    zeroToSixtySec: 7.4,
    topSpeedKmh: 182,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 8.7,
    engineLayout: '2.4L i-FORCE MAX Hybrid + Full-Time 4WD',
    enginePowerRating: 82,
    accelerationScore: 79,
    handlingScore: 84,
    brakesScore: 85,
    defaultColor: '#64748b',
    accentColor: '#f59e0b',
    bodyStyle: 'offroad_suv',
    modelArchetype: 'suv_offroad',
    description:
      'Trail-tested Toyota Land Cruiser (J250) with center/rear locking differentials, stabilizer bar disconnect, and 8.7" ground clearance.',
    trims: [
      {
        id: 'land_cruiser_1958',
        name: 'Land Cruiser 1958 (8.7" Clearance)',
        upgradePrice: 0,
        horsepower: 326,
        zeroToSixtySec: 7.4,
        topSpeedKmh: 182,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 8.7,
        engineLayout: '2.4L Hybrid 465 lb-ft + Full-Time 4WD',
        accelerationScore: 79,
        handlingScore: 84,
        brakesScore: 85,
        aeroStyle: 'stock',
      },
      {
        id: 'land_cruiser_first_ed',
        name: 'First Edition Overland (9.6" Lift)',
        upgradePrice: 17500,
        horsepower: 365,
        zeroToSixtySec: 6.7,
        topSpeedKmh: 190,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 9.6,
        engineLayout: 'Tuned Hybrid + Roof Rack & Skid Armor',
        accelerationScore: 82,
        handlingScore: 86,
        brakesScore: 86,
        aeroStyle: 'stock',
        accentColorOverride: '#d97706',
      },
    ],
  },
  {
    id: 'chevy_tahoe_z71',
    name: 'Chevrolet Tahoe Z71 4x4',
    manufacturer: 'Chevrolet',
    category: 'Full-Size Off-Road SUV',
    price: 66500,
    horsepower: 420,
    zeroToSixtySec: 5.7,
    topSpeedKmh: 202,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 10.1,
    engineLayout: '6.2L V8 + Four-Corner Air Ride Adaptive Suspension',
    enginePowerRating: 87,
    accelerationScore: 84,
    handlingScore: 82,
    brakesScore: 85,
    defaultColor: '#1e293b',
    accentColor: '#dc2626',
    bodyStyle: 'offroad_suv',
    modelArchetype: 'suv_offroad',
    description:
      'High-approach Chevy Tahoe Z71 with 10.1" Air Ride max clearance, red recovery hooks, and 420 HP V8 authority on streets and fields.',
    trims: [
      {
        id: 'tahoe_z71_53',
        name: 'Tahoe Z71 5.3L V8 (8.0" Standard)',
        upgradePrice: 0,
        horsepower: 355,
        zeroToSixtySec: 6.8,
        topSpeedKmh: 190,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 8.0,
        engineLayout: '5.3L EcoTec3 V8 + 2-Speed 4WD',
        accelerationScore: 80,
        handlingScore: 80,
        brakesScore: 83,
        aeroStyle: 'stock',
      },
      {
        id: 'tahoe_z71_62_air',
        name: 'Tahoe Z71 6.2L Air Ride (10.1" Lift)',
        upgradePrice: 9500,
        horsepower: 420,
        zeroToSixtySec: 5.7,
        topSpeedKmh: 202,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 10.1,
        engineLayout: '6.2L V8 + 10.1" Adaptive Air Suspension',
        accelerationScore: 85,
        handlingScore: 83,
        brakesScore: 86,
        aeroStyle: 'stock',
        accentColorOverride: '#ef4444',
      },
    ],
  },
  {
    id: 'ford_bronco_raptor',
    name: 'Ford Bronco Raptor 4x4',
    manufacturer: 'Ford',
    category: 'Ultra4 Off-Road SUV',
    price: 90035,
    horsepower: 418,
    zeroToSixtySec: 5.6,
    topSpeedKmh: 184,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 13.1,
    engineLayout: '3.0L Twin-Turbo V6 + HOSS 4.0 FOX Live Valve',
    enginePowerRating: 89,
    accelerationScore: 86,
    handlingScore: 86,
    brakesScore: 87,
    defaultColor: '#f97316',
    accentColor: '#18181b',
    bodyStyle: 'offroad_suv',
    modelArchetype: 'suv_offroad',
    description:
      'Factory 37-inch tires and 13.1" ground clearance make this widebody Bronco Raptor an unstoppable grass and highway cruiser.',
    trims: [
      {
        id: 'bronco_raptor_stock',
        name: 'Bronco Raptor 3.0L (13.1" Clearance)',
        upgradePrice: 0,
        horsepower: 418,
        zeroToSixtySec: 5.6,
        topSpeedKmh: 184,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 13.1,
        engineLayout: '3.0L Twin-Turbo V6 + 37" BFGoodrich KO2',
        accelerationScore: 86,
        handlingScore: 86,
        brakesScore: 87,
        aeroStyle: 'stock',
      },
      {
        id: 'bronco_raptor_r',
        name: 'Bronco Velociraptor 500 (13.6" Clearance)',
        upgradePrice: 24000,
        horsepower: 500,
        zeroToSixtySec: 4.8,
        topSpeedKmh: 198,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 13.6,
        engineLayout: '3.0L Tuned Twin-Turbo + Heavy Baja Tune',
        accelerationScore: 91,
        handlingScore: 88,
        brakesScore: 88,
        aeroStyle: 'stock',
        accentColorOverride: '#ef4444',
      },
    ],
  },
  {
    id: 'jeep_wrangler_392',
    name: 'Jeep Wrangler Rubicon 392',
    manufacturer: 'Jeep',
    category: 'V8 Rock Crawler SUV',
    price: 91500,
    horsepower: 470,
    zeroToSixtySec: 4.4,
    topSpeedKmh: 185,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 12.9,
    engineLayout: '6.4L HEMI 392 V8 + Xtreme 35 Tire Package',
    enginePowerRating: 91,
    accelerationScore: 90,
    handlingScore: 83,
    brakesScore: 85,
    defaultColor: '#facc15',
    accentColor: '#991b1b',
    bodyStyle: 'offroad_suv',
    modelArchetype: 'suv_offroad',
    description:
      'A 470 HP naturally aspirated 6.4L HEMI shoehorned into a 12.9"-clearance Rubicon 392—climbs curbs and flies across lawns.',
    trims: [
      {
        id: 'wrangler_rubicon_392_std',
        name: 'Rubicon 392 Xtreme 35 (11.6" Clearance)',
        upgradePrice: 0,
        horsepower: 470,
        zeroToSixtySec: 4.4,
        topSpeedKmh: 180,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 11.6,
        engineLayout: '6.4L HEMI V8 + Full-Time Selec-Trac 4WD',
        accelerationScore: 90,
        handlingScore: 83,
        brakesScore: 85,
        aeroStyle: 'stock',
      },
      {
        id: 'wrangler_392_final',
        name: '392 Final Edition AEV 37s (12.9" Clearance)',
        upgradePrice: 18500,
        horsepower: 620,
        zeroToSixtySec: 3.8,
        topSpeedKmh: 198,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 12.9,
        engineLayout: '6.4L Supercharged HEMI + 12.9" AEV Lift',
        accelerationScore: 95,
        handlingScore: 85,
        brakesScore: 87,
        aeroStyle: 'stock',
        accentColorOverride: '#dc2626',
      },
    ],
  },
  {
    id: 'land_rover_defender_v8',
    name: 'Land Rover Defender 110 V8 / OCTA',
    manufacturer: 'Land Rover',
    category: 'Expedition Super-SUV',
    price: 111500,
    horsepower: 518,
    zeroToSixtySec: 4.9,
    topSpeedKmh: 240,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 11.5,
    engineLayout: '5.0L Supercharged V8 + Terrain Response 2',
    enginePowerRating: 93,
    accelerationScore: 91,
    handlingScore: 88,
    brakesScore: 90,
    defaultColor: '#3f6212',
    accentColor: '#18181b',
    bodyStyle: 'offroad_suv',
    modelArchetype: 'suv_offroad',
    description:
      'British expedition icon combining 11.5"-12.7" air suspension clearance with a 518 HP Supercharged V8 (or 626 HP OCTA Twin-Turbo V8).',
    trims: [
      {
        id: 'defender_110_v8',
        name: 'Defender 110 Carpathian V8 (11.5" Clearance)',
        upgradePrice: 0,
        horsepower: 518,
        zeroToSixtySec: 4.9,
        topSpeedKmh: 240,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 11.5,
        engineLayout: '5.0L Supercharged AJ-V8 + Electronic Air',
        accelerationScore: 91,
        handlingScore: 88,
        brakesScore: 90,
        aeroStyle: 'stock',
      },
      {
        id: 'defender_octa',
        name: 'Defender OCTA 6D Dynamics (12.7" Clearance)',
        upgradePrice: 41000,
        horsepower: 626,
        zeroToSixtySec: 3.8,
        topSpeedKmh: 250,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 12.7,
        engineLayout: '4.4L Twin-Turbo MHEV V8 + 6D Pitch Control',
        accelerationScore: 96,
        handlingScore: 92,
        brakesScore: 93,
        aeroStyle: 'stock',
        accentColorOverride: '#ca8a04',
      },
    ],
  },
  {
    id: 'rivian_r1s_quad',
    name: 'Rivian R1S Quad-Motor Max SUV',
    manufacturer: 'Rivian',
    category: 'Electric 3-Row Off-Road SUV',
    price: 96000,
    horsepower: 1025,
    zeroToSixtySec: 2.6,
    topSpeedKmh: 218,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 14.9,
    engineLayout: 'Quad-Motor Independent Torque-Vectoring EV + Air Ride',
    enginePowerRating: 104,
    accelerationScore: 106,
    handlingScore: 90,
    brakesScore: 92,
    defaultColor: '#15803d',
    accentColor: '#facc15',
    bodyStyle: 'offroad_suv',
    modelArchetype: 'suv_offroad',
    description:
      '7-passenger electric SUV delivering 1,025 HP and 14.9 inches of ground clearance in Highest mode—faster on grass than supercars on slicks.',
    trims: [
      {
        id: 'r1s_dual_perf',
        name: 'R1S Dual-Motor Perf (14.4" Clearance)',
        upgradePrice: 0,
        horsepower: 665,
        zeroToSixtySec: 3.5,
        topSpeedKmh: 201,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 14.4,
        engineLayout: 'Dual-Motor AWD EV + 14.4" Air Lift',
        accelerationScore: 96,
        handlingScore: 89,
        brakesScore: 90,
        aeroStyle: 'stock',
      },
      {
        id: 'r1s_quad_ascend',
        name: 'R1S Ascend Quad-Motor (14.9" Clearance)',
        upgradePrice: 18500,
        horsepower: 1025,
        zeroToSixtySec: 2.6,
        topSpeedKmh: 218,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 14.9,
        engineLayout: 'Quad-Motor 1,025 HP + Hydraulic Roll Control',
        accelerationScore: 106,
        handlingScore: 91,
        brakesScore: 93,
        aeroStyle: 'stock',
        accentColorOverride: '#eab308',
      },
    ],
  },
  {
    id: 'porsche_cayenne_turbo_gt',
    name: 'Porsche Cayenne Turbo GT',
    manufacturer: 'Porsche',
    category: 'Nürburgring Performance SUV',
    price: 197950,
    horsepower: 650,
    zeroToSixtySec: 3.1,
    topSpeedKmh: 305,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 7.4,
    offRoadScore: 46,
    engineLayout: '4.0L Twin-Turbo V8 + Track-Tuned Air Ride & 22" Corsa Tires',
    enginePowerRating: 98,
    accelerationScore: 99,
    handlingScore: 97,
    brakesScore: 97,
    defaultColor: '#64748b',
    accentColor: '#eab308',
    bodyStyle: 'offroad_suv',
    modelArchetype: 'suv_sport',
    description:
      'Arctic Grey Cayenne Turbo GT tuned for 305 km/h Nürburgring lap times on 22" Pirelli Corsa street-track rubber—clears curbs better than a supercar, but stiff for deep off-roading.',
    trims: [
      {
        id: 'cayenne_turbo_gt_650',
        name: 'Cayenne Turbo GT (7.4" Track Ride)',
        upgradePrice: 0,
        horsepower: 650,
        zeroToSixtySec: 3.1,
        topSpeedKmh: 305,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 7.4,
        offRoadScore: 46,
        engineLayout: '4.0L Twin-Turbo V8 + PDCC Active Roll',
        accelerationScore: 99,
        handlingScore: 97,
        brakesScore: 97,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'cayenne_turbo_ehyb',
        name: 'Cayenne Turbo E-Hybrid GT (8.0" Lift)',
        upgradePrice: 22000,
        horsepower: 729,
        zeroToSixtySec: 2.9,
        topSpeedKmh: 312,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 8.0,
        offRoadScore: 49,
        engineLayout: '4.0L Twin-Turbo V8 + E-Motor (700 lb-ft)',
        accelerationScore: 102,
        handlingScore: 96,
        brakesScore: 97,
        aeroStyle: 'sport_spoiler',
        accentColorOverride: '#facc15',
      },
    ],
  },
  {
    id: 'range_rover_sv',
    name: 'Range Rover Sport SV Edition',
    manufacturer: 'Land Rover',
    category: 'Ultra-Luxury Super-SUV',
    price: 210000,
    horsepower: 626,
    zeroToSixtySec: 3.6,
    topSpeedKmh: 290,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 10.7,
    offRoadScore: 60,
    engineLayout: '4.4L Twin-Turbo Mild-Hybrid V8 + 6D Air Suspension',
    enginePowerRating: 97,
    accelerationScore: 96,
    handlingScore: 94,
    brakesScore: 95,
    defaultColor: '#92400e',
    accentColor: '#fbbf24',
    bodyStyle: 'offroad_suv',
    modelArchetype: 'suv_sport',
    description:
      'Carbon-ceramic 626 HP Range Rover SV combining 290 km/h poise with Terrain Response air lift, limited slightly off-road by heavy weight and 23" street performance tires.',
    trims: [
      {
        id: 'range_rover_p615',
        name: 'Range Rover SV P615 (11.6" Air Lift)',
        upgradePrice: 0,
        horsepower: 606,
        zeroToSixtySec: 4.3,
        topSpeedKmh: 261,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 11.6,
        offRoadScore: 64,
        engineLayout: '4.4L Twin-Turbo V8 + Long-Travel Air',
        accelerationScore: 92,
        handlingScore: 90,
        brakesScore: 93,
        aeroStyle: 'stock',
      },
      {
        id: 'range_rover_sport_sv',
        name: 'Sport SV Carbon Ceramic (10.7" Street Tune)',
        upgradePrice: 28000,
        horsepower: 626,
        zeroToSixtySec: 3.6,
        topSpeedKmh: 290,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 10.7,
        offRoadScore: 58,
        engineLayout: '4.4L Twin-Turbo V8 + Carbon Wheels & 6D Ride',
        accelerationScore: 97,
        handlingScore: 95,
        brakesScore: 96,
        aeroStyle: 'stock',
        accentColorOverride: '#ef4444',
      },
    ],
  },
  {
    id: 'lamborghini_urus_performante',
    name: 'Lamborghini Urus Performante',
    manufacturer: 'Lamborghini',
    category: 'Exotic Super-SUV',
    price: 273000,
    horsepower: 657,
    zeroToSixtySec: 3.1,
    topSpeedKmh: 306,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 8.1,
    offRoadScore: 49,
    engineLayout: '4.0L Twin-Turbo V8 + Lowered Steel Springs + Torsen AWD',
    enginePowerRating: 99,
    accelerationScore: 100,
    handlingScore: 96,
    brakesScore: 97,
    defaultColor: '#84cc16',
    accentColor: '#18181b',
    bodyStyle: 'offroad_suv',
    modelArchetype: 'suv_sport',
    description:
      'Lowered steel-spring exotic Super-SUV on 22"/23" Pirelli P Zero Trofeo track rubber—far more capable over grass than low supercars like a Jesko, but far behind true 4x4 pickups.',
    trims: [
      {
        id: 'urus_performante',
        name: 'Urus Performante (8.1" Lowered Coil)',
        upgradePrice: 0,
        horsepower: 657,
        zeroToSixtySec: 3.1,
        topSpeedKmh: 306,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 8.1,
        offRoadScore: 49,
        engineLayout: '4.0L Twin-Turbo V8 + Rally Mode',
        accelerationScore: 100,
        handlingScore: 96,
        brakesScore: 97,
        aeroStyle: 'sport_spoiler',
      },
      {
        id: 'urus_se_hybrid',
        name: 'Urus SE Twin-Turbo Hybrid (8.5" Air Lift)',
        upgradePrice: 35000,
        horsepower: 789,
        zeroToSixtySec: 2.85,
        topSpeedKmh: 318,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 8.5,
        offRoadScore: 52,
        engineLayout: '4.0L Twin-Turbo V8 + Electric Torque Fill',
        accelerationScore: 104,
        handlingScore: 97,
        brakesScore: 98,
        aeroStyle: 'sport_spoiler',
        accentColorOverride: '#f97316',
      },
    ],
  },
  {
    id: 'mercedes_g63_4x4',
    name: 'Mercedes-AMG G 63 4x4 Squared',
    manufacturer: 'Mercedes-AMG',
    category: 'Portal-Axle Super-SUV',
    price: 349000,
    horsepower: 577,
    zeroToSixtySec: 4.5,
    topSpeedKmh: 210,
    drivetrain: 'AWD',
    groundClearance: 'high',
    groundClearanceInches: 13.8,
    engineLayout: '4.0L Handcrafted Biturbo V8 + Portal Axles (3 Locks)',
    enginePowerRating: 95,
    accelerationScore: 92,
    handlingScore: 87,
    brakesScore: 90,
    defaultColor: '#10b981',
    accentColor: '#18181b',
    bodyStyle: 'offroad_suv',
    modelArchetype: 'suv_offroad',
    description:
      'Portal-axle AMG G 63 4x4² boasting 13.8" of rigid ground clearance, triple locking differentials, roof lightbar, and optional Brabus 800 Widestar power.',
    trims: [
      {
        id: 'g63_4x4_squared',
        name: 'AMG G 63 4x4² Portal Axle (13.8" Clearance)',
        upgradePrice: 0,
        horsepower: 577,
        zeroToSixtySec: 4.5,
        topSpeedKmh: 210,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 13.8,
        engineLayout: '4.0L Biturbo V8 + Portal Axles',
        accelerationScore: 92,
        handlingScore: 87,
        brakesScore: 90,
        aeroStyle: 'stock',
      },
      {
        id: 'g63_brabus_800',
        name: 'Brabus 800 4x4² Superblack (14.2" Lift)',
        upgradePrice: 95000,
        horsepower: 800,
        zeroToSixtySec: 3.7,
        topSpeedKmh: 235,
        drivetrain: 'AWD',
        groundClearance: 'high',
        groundClearanceInches: 14.2,
        engineLayout: '4.0L Biturbo Brabus 800 HP + Carbon Fender Flares',
        accelerationScore: 98,
        handlingScore: 88,
        brakesScore: 92,
        aeroStyle: 'stock',
        accentColorOverride: '#ef4444',
      },
    ],
  },
];

// Keep Metro City dealership & catalog strictly ordered from least expensive to most expensive
CITY_STREET_CARS.sort((a, b) => {
  if (a.price !== b.price) return a.price - b.price;
  return a.name.localeCompare(b.name);
});

const DEFAULT_CLEARANCE_INCHES_BY_CAR: Record<string, number> = {
  honda_civic: 5.3,
  toyota_camry: 5.7,
  chevy_camaro: 5.0,
  chevy_corvette: 5.3,
  toyota_supra_mk5: 4.7,
  dodge_challenger: 5.2,
  dodge_charger: 5.2,
  bmw_m4: 4.7,
  cadillac_escalade: 8.0,
  toyota_supra_mk4: 5.1,
  nissan_gtr_r35: 4.3,
  porsche_911: 4.9,
  cadillac_escalade_v: 8.0,
  nissan_gtr_r34: 5.5,
  lamborghini_huracan: 5.3,
  nissan_gtr_r34_ztune: 5.1,
  mcmurtry_speirling: 3.2,
  rimac_nevera: 4.3,
  koenigsegg_regera: 4.1,
  koenigsegg_agera_rs: 4.1,
  bugatti_chiron_pur_sport: 4.3,
  bugatti_chiron_super_sport: 4.3,
  koenigsegg_jesko: 3.9,
};

// Realistic 0-100 off-road capability scores (considering tire compound/sidewall, suspension travel,
// differential lockers, weight & approach/breakover geometry — not just height!)
const DEFAULT_OFFROAD_SCORE_BY_CAR: Record<string, number> = {
  mcmurtry_speirling: 12,
  koenigsegg_jesko: 16,
  koenigsegg_agera_rs: 18,
  koenigsegg_regera: 18,
  bugatti_chiron_pur_sport: 21,
  bugatti_chiron_super_sport: 22,
  rimac_nevera: 24,
  chevy_corvette: 25,
  toyota_supra_mk5: 25,
  porsche_911: 26,
  bmw_m4: 27,
  toyota_supra_mk4: 27,
  nissan_gtr_r35: 28,
  lamborghini_huracan: 29,
  chevy_camaro: 23,
  nissan_gtr_r34_ztune: 30,
  nissan_gtr_r34: 33,
  dodge_challenger: 22,
  dodge_charger: 24,
  honda_civic: 38,
  toyota_camry: 40,
  porsche_cayenne_turbo_gt: 46,
  lamborghini_urus_performante: 49,
  cadillac_escalade_v: 50,
  cadillac_escalade: 54,
  range_rover_sv: 60,
  chevy_tahoe_z71: 75,
  ford_maverick_tremor: 76,
  toyota_land_cruiser: 81,
  land_rover_defender_v8: 82,
  rivian_r1s_quad: 85,
  jeep_wrangler_392: 88,
  toyota_tacoma_trd_pro: 89,
  ford_ranger_raptor: 91,
  ford_bronco_raptor: 91,
  jeep_gladiator_mojave: 92,
  mercedes_g63_4x4: 92,
  chevy_silverado_zr2: 93,
  gmc_hummer_ev_pickup: 93,
  rivian_r1t_quad: 95,
  ram_1500_trx: 96,
  ford_f150_raptor_r: 98,
};

const DEFAULT_OFFROAD_SCORE_BY_TRIM: Record<string, number> = {
  camaro_lt1: 23,
  camaro_ss_1le: 21,
  camaro_zl1: 19,
  camaro_zl1_1le: 18,
  challenger_scat_pack: 22,
  challenger_hellcat_redeye: 19,
  challenger_demon_170: 17,
  charger_scat_pack: 24,
  charger_hellcat_redeye: 20,
  charger_king_daytona: 19,
  civic_type_r: 31,
  camry_trd_v6: 33,
  bmw_m3_comp_xdrive: 32,
  bmw_m4_csl: 24,
  corvette_z06_z07: 21,
  huracan_sto: 24,
  huracan_tecnica: 26,
  porsche_911_gt3_rs: 22,
  tahoe_z71_62_air: 79,
  land_cruiser_first_ed: 84,
  defender_octa: 86,
  r1s_quad_ascend: 88,
  wrangler_392_final: 91,
  bronco_raptor_r: 93,
  g63_brabus_800: 94,
  tacoma_trailhunter_baja: 92,
  ranger_raptor_baja: 93,
  gladiator_rubicon_392: 94,
  silverado_zr2_bison: 95,
  hummer_ev_3x_extract: 96,
  r1t_quad_ascend: 97,
  ram_trx_mammoth: 98,
  f150_velociraptor_1000: 99,
};

export type StreetCarFilterBucket = 'all' | 'pickups' | 'suvs' | 'muscle_jdm' | 'exotics';

export function getStreetCarCategoryBucket(car: StreetCarSpec): Exclude<StreetCarFilterBucket, 'all'> {
  if (car.bodyStyle === 'pickup_truck') return 'pickups';
  if (car.bodyStyle === 'armored_suv' || car.bodyStyle === 'offroad_suv') return 'suvs';
  if (
    car.bodyStyle === 'hatchback' ||
    car.bodyStyle === 'tuner_coupe' ||
    car.bodyStyle === 'muscle_v8'
  ) {
    return 'muscle_jdm';
  }
  return 'exotics';
}

export function getStreetCarOffRoadTier(offRoadScore: number): { label: string; colorClass: string } {
  if (offRoadScore >= 90) return { label: 'BAJA / EXTREME 4x4', colorClass: 'text-emerald-300' };
  if (offRoadScore >= 74) return { label: 'TRAIL RATED 4x4', colorClass: 'text-lime-300' };
  if (offRoadScore >= 45) return { label: 'LIGHT OFF-ROAD', colorClass: 'text-teal-300' };
  if (offRoadScore >= 30) return { label: 'STREET', colorClass: 'text-amber-300' };
  return { label: 'TRACK ONLY', colorClass: 'text-rose-300' };
}

export function getEffectiveStreetCarSpec(
  car: StreetCarSpec,
  trimId?: string
): StreetCarSpec & { activeTrim: StreetCarTrimSpec; groundClearanceInches: number; offRoadScore: number } {
  const activeTrim =
    (trimId ? car.trims.find((t) => t.id === trimId) : undefined) || car.trims[0];
  const resolvedInches =
    activeTrim.groundClearanceInches ??
    car.groundClearanceInches ??
    DEFAULT_CLEARANCE_INCHES_BY_CAR[car.id] ??
    (car.bodyStyle === 'armored_suv'
      ? 8.0
      : car.bodyStyle === 'pickup_truck' || car.bodyStyle === 'offroad_suv'
      ? 10.5
      : car.bodyStyle === 'hatchback' || car.bodyStyle === 'tuner_coupe'
      ? 5.3
      : 4.5);
  const resolvedOffRoadScore = Math.max(
    10,
    Math.min(
      100,
      Math.round(
        activeTrim.offRoadScore ??
          DEFAULT_OFFROAD_SCORE_BY_TRIM[activeTrim.id] ??
          car.offRoadScore ??
          DEFAULT_OFFROAD_SCORE_BY_CAR[car.id] ??
          (car.bodyStyle === 'pickup_truck'
            ? 88
            : car.bodyStyle === 'offroad_suv'
            ? 74
            : car.bodyStyle === 'armored_suv'
            ? 52
            : 30)
      )
    )
  );
  const clearance: 'low' | 'medium' | 'high' =
    activeTrim.groundClearance ||
    car.groundClearance ||
    (resolvedInches >= 7.5 ? 'high' : resolvedInches >= 5.2 ? 'medium' : 'low');
  return {
    ...car,
    horsepower: activeTrim.horsepower,
    zeroToSixtySec: activeTrim.zeroToSixtySec,
    topSpeedKmh: activeTrim.topSpeedKmh,
    drivetrain: activeTrim.drivetrain,
    groundClearance: clearance,
    groundClearanceInches: Number(resolvedInches.toFixed(1)),
    offRoadScore: resolvedOffRoadScore,
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
  houseFurnishings: Record<string, string[]>;
  unpaidCrashTicketsTab: number;
  totalJobsCompleted: number;
  totalHeistsCompleted: number;
  bankRobberyBustCount: number;
  jobSkillXp?: number;
  outdoorJobsCompleted?: number;
}

export interface JobSkillRankInfo {
  level: number;
  title: string;
  xp: number;
  nextLevelXp: number;
  progressPct: number;
  payoutMultiplier: number;
}

export function getJobSkillRankInfo(rawXp: number = 0): JobSkillRankInfo {
  const xp = Math.max(0, Math.round(rawXp));
  const thresholds = [0, 80, 200, 380, 620, 950, 1380, 1920, 2600, 3450, 4500];
  const titles = [
    'Apprentice',
    'Journeyman',
    'Specialist',
    'Senior Pro',
    'Lead Craftsman',
    'Master Tech',
    'Chief Operator',
    'Elite Contractor',
    'Maryland Legend',
    'Grandmaster',
    'Apex Tycoon',
  ];
  let idx = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) idx = i;
  }
  const curMin = thresholds[idx];
  const nextXp = thresholds[Math.min(thresholds.length - 1, idx + 1)];
  const span = Math.max(1, nextXp - curMin);
  const progressPct =
    idx >= thresholds.length - 1 ? 100 : Math.min(100, Math.round(((xp - curMin) / span) * 100));
  return {
    level: idx + 1,
    title: titles[idx],
    xp,
    nextLevelXp: nextXp,
    progressPct,
    payoutMultiplier: Number((1 + idx * 0.06).toFixed(2)),
  };
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
  jobCategory: 'Delivery & Freight' | 'Passenger & VIP' | 'Utility & Specialty';
  icon: string;
  basePay: number;
  maxTipBonus: number;
  tipBonusMax: number;
  timeLimitSec: number;
  badgeColor: string;
  description: string;
  skillChallenge?: 'precision_stop' | 'high_speed_run' | 'zero_damage_vip';
  skillBadgeLabel?: string;
  skillBonusMax?: number;
  fixedPickup?: { x: number; z: number; label: string };
  routes: CityJobRoute[];
}

export const CITY_REGULAR_JOBS_CATALOG: CityRegularJobSpec[] = [
  {
    id: 'job_taxi',
    title: 'Maryland Express Cab & Rideshare',
    roleLabel: 'TAXI DISPATCH',
    jobCategory: 'Passenger & VIP',
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
    jobCategory: 'Delivery & Freight',
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
    jobCategory: 'Delivery & Freight',
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
      {
        pickupX: MD_LANDMARKS.bwiAirport.x,
        pickupZ: MD_LANDMARKS.bwiAirport.z,
        pickupLabel: 'BWI Cargo Terminal',
        dropoffX: MD_LANDMARKS.bethesda.x,
        dropoffZ: MD_LANDMARKS.bethesda.z,
        dropoffLabel: 'Bethesda Metro Plaza',
      },
    ],
  },
  {
    id: 'job_food',
    title: 'Crab-Cake & Pit Beef Midnight Delivery',
    roleLabel: 'FOOD DELIVERY',
    jobCategory: 'Delivery & Freight',
    icon: '🦀',
    basePay: 1950,
    maxTipBonus: 600,
    tipBonusMax: 600,
    timeLimitSec: 80,
    badgeColor: '#ec4899',
    description: 'Pick up fresh Maryland crab cakes from Fells Point and race them to Camden Yards or Woodlawn!',
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
    jobCategory: 'Utility & Specialty',
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
  {
    id: 'job_armored_bank',
    title: 'Federal Reserve Armored Cash Transport',
    roleLabel: 'ARMORED LOGISTICS',
    jobCategory: 'Utility & Specialty',
    icon: '🛡️',
    basePay: 4400,
    maxTipBonus: 1200,
    tipBonusMax: 1200,
    timeLimitSec: 125,
    badgeColor: '#eab308',
    description: 'Authorized treasury cash runs between Baltimore Federal Reserve, Annapolis Bullion, and National Harbor. Zero crashes earns full security bonus!',
    routes: [
      {
        pickupX: MD_LANDMARKS.baltimoreBank.x,
        pickupZ: MD_LANDMARKS.baltimoreBank.z,
        pickupLabel: 'Baltimore Federal Reserve Loading Bay',
        dropoffX: MD_LANDMARKS.annapolisStateHouse.x,
        dropoffZ: MD_LANDMARKS.annapolisStateHouse.z,
        dropoffLabel: 'Annapolis State Circle Treasury',
      },
      {
        pickupX: MD_LANDMARKS.nationalHarbor.x,
        pickupZ: MD_LANDMARKS.nationalHarbor.z,
        pickupLabel: 'National Harbor Reserve Vault',
        dropoffX: MD_LANDMARKS.baltimoreBank.x,
        dropoffZ: MD_LANDMARKS.baltimoreBank.z,
        dropoffLabel: 'Baltimore Federal Reserve Bank',
      },
      {
        pickupX: MD_LANDMARKS.frederick.x,
        pickupZ: MD_LANDMARKS.frederick.z,
        pickupLabel: 'Frederick Carroll Creek Trust',
        dropoffX: MD_LANDMARKS.baltimoreBank.x,
        dropoffZ: MD_LANDMARKS.baltimoreBank.z,
        dropoffLabel: 'Baltimore Federal Reserve Bank',
      },
    ],
  },
  {
    id: 'job_vip_limo',
    title: 'Capital VIP Black-Car Chauffeur',
    roleLabel: 'VIP CHAUFFEUR',
    jobCategory: 'Passenger & VIP',
    icon: '🚘',
    basePay: 3600,
    maxTipBonus: 1100,
    tipBonusMax: 1100,
    timeLimitSec: 115,
    badgeColor: '#c084fc',
    description: 'Drive executives from BWI Private Aviation & Inner Harbor WTC to Potomac Falls Estates and Bethesda Row.',
    routes: [
      {
        pickupX: MD_LANDMARKS.bwiAirport.x,
        pickupZ: MD_LANDMARKS.bwiAirport.z,
        pickupLabel: 'BWI Signature Flight Terminal',
        dropoffX: -760,
        dropoffZ: 1680,
        dropoffLabel: 'Potomac Falls Executive Estate',
      },
      {
        pickupX: MD_LANDMARKS.baltimoreWTC.x,
        pickupZ: MD_LANDMARKS.baltimoreWTC.z,
        pickupLabel: 'Baltimore World Trade Center',
        dropoffX: MD_LANDMARKS.bethesda.x,
        dropoffZ: MD_LANDMARKS.bethesda.z,
        dropoffLabel: 'Bethesda Row Executive Suites',
      },
      {
        pickupX: MD_LANDMARKS.nationalHarbor.x,
        pickupZ: MD_LANDMARKS.nationalHarbor.z,
        pickupLabel: 'National Harbor Waterfront Hotel',
        dropoffX: MD_LANDMARKS.annapolisCityDock.x,
        dropoffZ: MD_LANDMARKS.annapolisCityDock.z,
        dropoffLabel: 'Annapolis Historic Waterfront',
      },
    ],
  },
  {
    id: 'job_roadside_tow',
    title: 'I-270 & I-95 Roadside Assist Dispatch',
    roleLabel: 'ROADSIDE ASSIST',
    jobCategory: 'Utility & Specialty',
    icon: '🪝',
    basePay: 3100,
    maxTipBonus: 900,
    tipBonusMax: 900,
    timeLimitSec: 105,
    badgeColor: '#f59e0b',
    description: 'Respond to stranded motorists along Maryland highways and escort repair parts back to service bays.',
    routes: [
      {
        pickupX: MD_LANDMARKS.kgaiAirpark.x,
        pickupZ: MD_LANDMARKS.kgaiAirpark.z,
        pickupLabel: 'Montgomery Airpark Service Staging',
        dropoffX: MD_LANDMARKS.shadyGroveMetro.x,
        dropoffZ: MD_LANDMARKS.shadyGroveMetro.z,
        dropoffLabel: 'I-270 / Shady Grove Breakdown Lane',
      },
      {
        pickupX: MD_LANDMARKS.columbia.x,
        pickupZ: MD_LANDMARKS.columbia.z,
        pickupLabel: 'US-29 Columbia Breakdown Call',
        dropoffX: MD_LANDMARKS.ellicottCity.x,
        dropoffZ: MD_LANDMARKS.ellicottCity.z,
        dropoffLabel: 'Ellicott City Service Garage',
      },
      {
        pickupX: MD_LANDMARKS.hagerstown.x,
        pickupZ: MD_LANDMARKS.hagerstown.z,
        pickupLabel: 'I-70 / I-81 Hagerstown Interchange',
        dropoffX: MD_LANDMARKS.frederick.x,
        dropoffZ: MD_LANDMARKS.frederick.z,
        dropoffLabel: 'Frederick Motor Repair Bay',
      },
    ],
  },
  {
    id: 'job_bay_seafood',
    title: 'Chesapeake Bay Seafood & Oyster Freight',
    roleLabel: 'COLD FREIGHT',
    jobCategory: 'Delivery & Freight',
    icon: '🦞',
    basePay: 3500,
    maxTipBonus: 950,
    tipBonusMax: 950,
    timeLimitSec: 120,
    badgeColor: '#06b6d4',
    description: 'Haul fresh blue crab and oyster crates from Annapolis City Dock and Ocean City harbor to Baltimore market kitchens!',
    routes: [
      {
        pickupX: MD_LANDMARKS.annapolisCityDock.x,
        pickupZ: MD_LANDMARKS.annapolisCityDock.z,
        pickupLabel: 'Annapolis City Dock Seafood Pier',
        dropoffX: MD_LANDMARKS.baltimoreInnerHarbor.x,
        dropoffZ: MD_LANDMARKS.baltimoreInnerHarbor.z,
        dropoffLabel: 'Inner Harbor Seafood Pavilion',
      },
      {
        pickupX: MD_LANDMARKS.baltimoreDominoSugar.x,
        pickupZ: MD_LANDMARKS.baltimoreDominoSugar.z,
        pickupLabel: 'Baltimore Harbor Cold Storage Pier',
        dropoffX: MD_LANDMARKS.columbia.x,
        dropoffZ: MD_LANDMARKS.columbia.z,
        dropoffLabel: 'Columbia Mall Market Kitchen',
      },
      {
        pickupX: MD_LANDMARKS.oceanCityBoardwalk.x,
        pickupZ: MD_LANDMARKS.oceanCityBoardwalk.z,
        pickupLabel: 'Ocean City Fishing Pier',
        dropoffX: MD_LANDMARKS.annapolisCityDock.x,
        dropoffZ: MD_LANDMARKS.annapolisCityDock.z,
        dropoffLabel: 'Annapolis Dock Market',
      },
    ],
  },
  {
    id: 'job_marc_shuttle',
    title: 'MARC & WMATA Commuter Express Shuttle',
    roleLabel: 'TRANSIT SHUTTLE',
    jobCategory: 'Passenger & VIP',
    icon: '🚐',
    basePay: 2650,
    maxTipBonus: 750,
    tipBonusMax: 750,
    timeLimitSec: 95,
    badgeColor: '#3b82f6',
    description: 'Connect rail commuters between Shady Grove Metro, Rockville Square, Silver Spring, and UMD College Park!',
    routes: [
      {
        pickupX: MD_LANDMARKS.shadyGroveMetro.x,
        pickupZ: MD_LANDMARKS.shadyGroveMetro.z,
        pickupLabel: 'Shady Grove Metro Kiss & Ride',
        dropoffX: MD_LANDMARKS.silverSpring.x,
        dropoffZ: MD_LANDMARKS.silverSpring.z,
        dropoffLabel: 'Silver Spring Transit Center',
      },
      {
        pickupX: MD_LANDMARKS.silverSpring.x,
        pickupZ: MD_LANDMARKS.silverSpring.z,
        pickupLabel: 'Silver Spring Transit Center',
        dropoffX: MD_LANDMARKS.collegeParkUMD.x,
        dropoffZ: MD_LANDMARKS.collegeParkUMD.z,
        dropoffLabel: 'College Park MARC & Metro',
      },
      {
        pickupX: MD_LANDMARKS.rockvilleSquare.x,
        pickupZ: MD_LANDMARKS.rockvilleSquare.z,
        pickupLabel: 'Rockville Town Center MARC',
        dropoffX: MD_LANDMARKS.bethesda.x,
        dropoffZ: MD_LANDMARKS.bethesda.z,
        dropoffLabel: 'Bethesda Metro North Entrance',
      },
    ],
  },
  {
    id: 'job_campus_express',
    title: 'Maryland University & Academy Charter',
    roleLabel: 'CAMPUS CHARTER',
    jobCategory: 'Passenger & VIP',
    icon: '🚌',
    basePay: 2400,
    maxTipBonus: 700,
    tipBonusMax: 700,
    timeLimitSec: 95,
    badgeColor: '#fbbf24',
    description: 'Ferry students and faculty cleanly between College Park UMD, ISB Woodlawn, ICM Campus, and Olney!',
    routes: [
      {
        pickupX: MD_LANDMARKS.collegeParkUMD.x,
        pickupZ: MD_LANDMARKS.collegeParkUMD.z,
        pickupLabel: 'UMD College Park Stamp Union',
        dropoffX: MD_LANDMARKS.olney.x,
        dropoffZ: MD_LANDMARKS.olney.z,
        dropoffLabel: 'Olney Town Center Stop',
      },
      {
        pickupX: MD_LANDMARKS.icmCampus.x,
        pickupZ: MD_LANDMARKS.icmCampus.z,
        pickupLabel: 'ICM Woodfield Rd Campus Loop',
        dropoffX: MD_LANDMARKS.rioLakefront.x,
        dropoffZ: MD_LANDMARKS.rioLakefront.z,
        dropoffLabel: 'RIO Gaithersburg Campus Annex',
      },
      {
        pickupX: MD_LANDMARKS.isbCampus.x,
        pickupZ: MD_LANDMARKS.isbCampus.z,
        pickupLabel: 'Woodlawn Johnnycake Campus',
        dropoffX: MD_LANDMARKS.ellicottCity.x,
        dropoffZ: MD_LANDMARKS.ellicottCity.z,
        dropoffLabel: 'Ellicott City Student Dropoff',
      },
    ],
  },
  {
    id: 'job_auto_parts',
    title: 'Maryland Motorsport & Tire Parts Runner',
    roleLabel: 'PARTS COURIER',
    jobCategory: 'Delivery & Freight',
    icon: '🔧',
    basePay: 2550,
    maxTipBonus: 800,
    tipBonusMax: 800,
    timeLimitSec: 95,
    badgeColor: '#fb7185',
    description: 'Deliver performance tires, brake rotors, and turbo kits to dealerships and service bays across Maryland!',
    routes: [
      {
        pickupX: MD_LANDMARKS.baltimoreDealership.x,
        pickupZ: MD_LANDMARKS.baltimoreDealership.z,
        pickupLabel: 'Baltimore Exotic Motors Parts Dept',
        dropoffX: MD_LANDMARKS.ellicottCity.x,
        dropoffZ: MD_LANDMARKS.ellicottCity.z,
        dropoffLabel: 'Ellicott City Service Station',
      },
      {
        pickupX: gx(-62),
        pickupZ: gz(1490),
        pickupLabel: 'Watkins Mill Performance Garage',
        dropoffX: MD_LANDMARKS.frederick.x,
        dropoffZ: MD_LANDMARKS.frederick.z,
        dropoffLabel: 'Frederick Custom Shop',
      },
      {
        pickupX: MD_LANDMARKS.frederick.x,
        pickupZ: MD_LANDMARKS.frederick.z,
        pickupLabel: 'Frederick Auto Supply Warehouse',
        dropoffX: MD_LANDMARKS.hagerstown.x,
        dropoffZ: MD_LANDMARKS.hagerstown.z,
        dropoffLabel: 'Hagerstown Hub Garage',
      },
    ],
  },
  {
    id: 'job_pharmacy_rx',
    title: 'Urgent Rx & Clinic Supply Runner',
    roleLabel: 'PHARMACY COURIER',
    jobCategory: 'Delivery & Freight',
    icon: '💊',
    basePay: 2350,
    maxTipBonus: 750,
    tipBonusMax: 750,
    timeLimitSec: 90,
    badgeColor: '#34d399',
    description: 'Deliver sealed prescription packs between Shady Grove Medical, Bethesda NIH, Olney, and Silver Spring clinics!',
    routes: [
      {
        pickupX: MD_LANDMARKS.bethesda.x,
        pickupZ: MD_LANDMARKS.bethesda.z,
        pickupLabel: 'Bethesda Medical Pharmacy Depot',
        dropoffX: MD_LANDMARKS.shadyGroveMetro.x,
        dropoffZ: MD_LANDMARKS.shadyGroveMetro.z,
        dropoffLabel: 'Shady Grove Adventist Medical',
      },
      {
        pickupX: MD_LANDMARKS.rockvilleSquare.x,
        pickupZ: MD_LANDMARKS.rockvilleSquare.z,
        pickupLabel: 'Rockville Clinical Pharmacy',
        dropoffX: MD_LANDMARKS.olney.x,
        dropoffZ: MD_LANDMARKS.olney.z,
        dropoffLabel: 'Olney MedStar Clinic',
      },
      {
        pickupX: MD_LANDMARKS.silverSpring.x,
        pickupZ: MD_LANDMARKS.silverSpring.z,
        pickupLabel: 'Silver Spring Medical Plaza',
        dropoffX: MD_LANDMARKS.collegeParkUMD.x,
        dropoffZ: MD_LANDMARKS.collegeParkUMD.z,
        dropoffLabel: 'College Park Campus Health Center',
      },
    ],
  },
  {
    id: 'job_realtor_tour',
    title: 'Maryland Luxury Real Estate Showing Tour',
    roleLabel: 'ESTATE BROKER',
    jobCategory: 'Passenger & VIP',
    icon: '🏡',
    basePay: 3400,
    maxTipBonus: 1050,
    tipBonusMax: 1050,
    timeLimitSec: 110,
    badgeColor: '#f472b6',
    description: 'Chauffeur high-net-worth buyers between luxury estates in Potomac, Kentlands, Ellicott City, and Silver Spring!',
    routes: [
      {
        pickupX: MD_LANDMARKS.bethesda.x,
        pickupZ: MD_LANDMARKS.bethesda.z,
        pickupLabel: 'Bethesda Realty Flagship Office',
        dropoffX: -760,
        dropoffZ: 1680,
        dropoffLabel: 'Potomac Falls Mansion Showing',
      },
      {
        pickupX: MD_LANDMARKS.rioLakefront.x,
        pickupZ: MD_LANDMARKS.rioLakefront.z,
        pickupLabel: 'RIO Brokerage Lounge',
        dropoffX: gx(-575),
        dropoffZ: gz(2246),
        dropoffLabel: 'Kentlands Brick Manor Tour',
      },
      {
        pickupX: MD_LANDMARKS.columbia.x,
        pickupZ: MD_LANDMARKS.columbia.z,
        pickupLabel: 'Columbia Town Center Offices',
        dropoffX: MD_LANDMARKS.ellicottCity.x,
        dropoffZ: MD_LANDMARKS.ellicottCity.z,
        dropoffLabel: 'Ellicott City Hillside Estate',
      },
    ],
  },
  {
    id: 'job_mountain_supply',
    title: 'Appalachian Deep Creek Outfitter Haul',
    roleLabel: 'MOUNTAIN HAUL',
    jobCategory: 'Delivery & Freight',
    icon: '🏔️',
    basePay: 4200,
    maxTipBonus: 1150,
    tipBonusMax: 1150,
    timeLimitSec: 135,
    badgeColor: '#22c55e',
    description: 'Long-haul freight across Western Maryland grades from Hagerstown and Sideling Hill to Cumberland and Deep Creek Lake (SUV/Truck recommended)!',
    routes: [
      {
        pickupX: MD_LANDMARKS.hagerstown.x,
        pickupZ: MD_LANDMARKS.hagerstown.z,
        pickupLabel: 'Hagerstown Valley Freight Hub',
        dropoffX: MD_LANDMARKS.cumberland.x,
        dropoffZ: MD_LANDMARKS.cumberland.z,
        dropoffLabel: 'Cumberland Rail Depot',
      },
      {
        pickupX: MD_LANDMARKS.sidelingHill.x,
        pickupZ: MD_LANDMARKS.sidelingHill.z,
        pickupLabel: 'Sideling Hill Overlook Staging',
        dropoffX: MD_LANDMARKS.deepCreekLake.x,
        dropoffZ: MD_LANDMARKS.deepCreekLake.z,
        dropoffLabel: 'Deep Creek Lake Resort Outfitter',
      },
    ],
  },
  {
    id: 'job_news_press',
    title: 'Metro Press Breaking News Photojournalist',
    roleLabel: 'PRESS DISPATCH',
    jobCategory: 'Utility & Specialty',
    icon: '📸',
    basePay: 2950,
    maxTipBonus: 950,
    tipBonusMax: 950,
    timeLimitSec: 95,
    badgeColor: '#38bdf8',
    description: 'Race press footage from Baltimore WTC, Camden Yards, and State Circle back to newsroom edit desks!',
    routes: [
      {
        pickupX: MD_LANDMARKS.baltimoreCamdenYards.x,
        pickupZ: MD_LANDMARKS.baltimoreCamdenYards.z,
        pickupLabel: 'Camden Yards Press Gate',
        dropoffX: MD_LANDMARKS.baltimoreWTC.x,
        dropoffZ: MD_LANDMARKS.baltimoreWTC.z,
        dropoffLabel: 'Inner Harbor WTC Broadcast Studio',
      },
      {
        pickupX: MD_LANDMARKS.annapolisStateHouse.x,
        pickupZ: MD_LANDMARKS.annapolisStateHouse.z,
        pickupLabel: 'Annapolis State House Press Steps',
        dropoffX: MD_LANDMARKS.baltimoreBank.x,
        dropoffZ: MD_LANDMARKS.baltimoreBank.z,
        dropoffLabel: 'Charles St Metro Newsroom',
      },
      {
        pickupX: MD_LANDMARKS.nationalHarbor.x,
        pickupZ: MD_LANDMARKS.nationalHarbor.z,
        pickupLabel: 'National Harbor Convention Pier',
        dropoffX: MD_LANDMARKS.silverSpring.x,
        dropoffZ: MD_LANDMARKS.silverSpring.z,
        dropoffLabel: 'Silver Spring Media Headquarters',
      },
    ],
  },
  {
    id: 'job_construction_lumber',
    title: 'Bay Bridge & Jobsite Materials Supply',
    roleLabel: 'HEAVY SUPPLY',
    jobCategory: 'Utility & Specialty',
    icon: '🪵',
    basePay: 3800,
    maxTipBonus: 1000,
    tipBonusMax: 1000,
    timeLimitSec: 120,
    badgeColor: '#d97706',
    description: 'Haul steel fasteners, lumber, and survey gear from Domino Sugar Pier & Bay Bridge depots to active jobsites!',
    routes: [
      {
        pickupX: MD_LANDMARKS.baltimoreDominoSugar.x,
        pickupZ: MD_LANDMARKS.baltimoreDominoSugar.z,
        pickupLabel: 'Baltimore Industrial Yard (Domino Pier)',
        dropoffX: MD_LANDMARKS.chesapeakeBayBridgeMid.x,
        dropoffZ: MD_LANDMARKS.chesapeakeBayBridgeMid.z,
        dropoffLabel: 'Chesapeake Bay Bridge Maintenance Bay',
      },
      {
        pickupX: MD_LANDMARKS.hadleyFarms.x,
        pickupZ: MD_LANDMARKS.hadleyFarms.z,
        pickupLabel: 'Gaithersburg Lumber Yard',
        dropoffX: MD_LANDMARKS.olney.x,
        dropoffZ: MD_LANDMARKS.olney.z,
        dropoffLabel: 'Olney New Home Build Site',
      },
    ],
  },
  {
    id: 'job_ocean_charter',
    title: 'Ocean City Boardwalk Express Charter',
    roleLabel: 'COASTAL CHARTER',
    jobCategory: 'Passenger & VIP',
    icon: '🏖️',
    basePay: 4600,
    maxTipBonus: 1300,
    tipBonusMax: 1300,
    timeLimitSec: 140,
    badgeColor: '#0ea5e9',
    description: 'High-paying Eastern Shore charter across the Chesapeake Bay Bridge between Annapolis City Dock and Ocean City Boardwalk!',
    routes: [
      {
        pickupX: MD_LANDMARKS.annapolisCityDock.x,
        pickupZ: MD_LANDMARKS.annapolisCityDock.z,
        pickupLabel: 'Annapolis City Dock Charter Pier',
        dropoffX: MD_LANDMARKS.oceanCityBoardwalk.x,
        dropoffZ: MD_LANDMARKS.oceanCityBoardwalk.z,
        dropoffLabel: 'Ocean City Boardwalk Inlet',
      },
      {
        pickupX: MD_LANDMARKS.oceanCityBoardwalk.x,
        pickupZ: MD_LANDMARKS.oceanCityBoardwalk.z,
        pickupLabel: 'Ocean City Boardwalk Inlet',
        dropoffX: MD_LANDMARKS.annapolisCityDock.x,
        dropoffZ: MD_LANDMARKS.annapolisCityDock.z,
        dropoffLabel: 'Annapolis City Dock',
      },
    ],
  },
  {
    id: 'job_stunt_driver',
    title: 'Harbor Film Set Precision Stunt Driver',
    roleLabel: 'STUNT PRECISION',
    jobCategory: 'Utility & Specialty',
    icon: '🎬',
    basePay: 3900,
    maxTipBonus: 1200,
    tipBonusMax: 1200,
    timeLimitSec: 95,
    badgeColor: '#f43f5e',
    skillChallenge: 'high_speed_run',
    skillBadgeLabel: '⚡ High-Speed Stunt +$850',
    skillBonusMax: 850,
    description: 'Film high-speed camera car passes between Camden Yards, Baltimore Inner Harbor, and the Bay Bridge—arrive hot with zero crashes!',
    routes: [
      {
        pickupX: MD_LANDMARKS.baltimoreCamdenYards.x,
        pickupZ: MD_LANDMARKS.baltimoreCamdenYards.z,
        pickupLabel: 'Camden Yards Action Camera Unit',
        dropoffX: MD_LANDMARKS.baltimoreInnerHarbor.x,
        dropoffZ: MD_LANDMARKS.baltimoreInnerHarbor.z,
        dropoffLabel: 'Inner Harbor Stunt Finish Gate',
      },
      {
        pickupX: MD_LANDMARKS.bwiAirport.x,
        pickupZ: MD_LANDMARKS.bwiAirport.z,
        pickupLabel: 'BWI Perimeter Tarmac Film Rig',
        dropoffX: MD_LANDMARKS.chesapeakeBayBridgeMid.x,
        dropoffZ: MD_LANDMARKS.chesapeakeBayBridgeMid.z,
        dropoffLabel: 'Bay Bridge Helicopter Shot',
      },
    ],
  },
  {
    id: 'job_storm_chaser',
    title: 'Appalachian Storm Chaser Barometer Run',
    roleLabel: 'WEATHER PROBE',
    jobCategory: 'Utility & Specialty',
    icon: '⛈️',
    basePay: 4100,
    maxTipBonus: 1150,
    tipBonusMax: 1150,
    timeLimitSec: 125,
    badgeColor: '#38bdf8',
    skillChallenge: 'precision_stop',
    skillBadgeLabel: '🎯 Precision Stop +$750',
    skillBonusMax: 750,
    description: 'Deploy mobile Doppler weather probes along Sideling Hill, Cumberland Ridge, and Deep Creek—come to a crisp controlled stop at the sensor pad!',
    routes: [
      {
        pickupX: MD_LANDMARKS.hagerstown.x,
        pickupZ: MD_LANDMARKS.hagerstown.z,
        pickupLabel: 'Hagerstown Weather Station Depot',
        dropoffX: MD_LANDMARKS.sidelingHill.x,
        dropoffZ: MD_LANDMARKS.sidelingHill.z,
        dropoffLabel: 'Sideling Hill Summit Sensor Pad',
      },
      {
        pickupX: MD_LANDMARKS.cumberland.x,
        pickupZ: MD_LANDMARKS.cumberland.z,
        pickupLabel: 'Cumberland Ridge Radar Post',
        dropoffX: MD_LANDMARKS.deepCreekLake.x,
        dropoffZ: MD_LANDMARKS.deepCreekLake.z,
        dropoffLabel: 'Deep Creek Shoreline Buoy Station',
      },
    ],
  },
  {
    id: 'job_turbine_escort',
    title: 'Heavy Wind-Turbine Blade Pilot Convoy',
    roleLabel: 'OVERSIZE ESCORT',
    jobCategory: 'Delivery & Freight',
    icon: '🌬️',
    basePay: 4300,
    maxTipBonus: 1250,
    tipBonusMax: 1250,
    timeLimitSec: 135,
    badgeColor: '#14b8a6',
    skillChallenge: 'zero_damage_vip',
    skillBadgeLabel: '🛡️ Zero-Scratch Bonus +$900',
    skillBonusMax: 900,
    description: 'Escort fragile composite turbine blades from Domino Sugar Port out west to Frederick & Hagerstown without a single fender scrape!',
    routes: [
      {
        pickupX: MD_LANDMARKS.baltimoreDominoSugar.x,
        pickupZ: MD_LANDMARKS.baltimoreDominoSugar.z,
        pickupLabel: 'Baltimore Marine Heavy Dock',
        dropoffX: MD_LANDMARKS.frederick.x,
        dropoffZ: MD_LANDMARKS.frederick.z,
        dropoffLabel: 'Frederick Wind Energy Staging Yard',
      },
      {
        pickupX: MD_LANDMARKS.frederick.x,
        pickupZ: MD_LANDMARKS.frederick.z,
        pickupLabel: 'Frederick Energy Staging Yard',
        dropoffX: MD_LANDMARKS.hagerstown.x,
        dropoffZ: MD_LANDMARKS.hagerstown.z,
        dropoffLabel: 'Hagerstown I-81 Assembly Yard',
      },
    ],
  },
  {
    id: 'job_hazmat_tanker',
    title: 'NIST Cryogenic Lab Isotope Transport',
    roleLabel: 'CRYO TRANSPORT',
    jobCategory: 'Utility & Specialty',
    icon: '🧪',
    basePay: 3750,
    maxTipBonus: 1100,
    tipBonusMax: 1100,
    timeLimitSec: 110,
    badgeColor: '#06b6d4',
    skillChallenge: 'zero_damage_vip',
    skillBadgeLabel: '🛡️ Zero-Impact Lab Bonus +$800',
    skillBonusMax: 800,
    description: 'Transport ultra-sensitive liquid helium flasks between NIST Gaithersburg, Bethesda NIH, and Johns Hopkins—zero collisions earns top hazard pay!',
    routes: [
      {
        pickupX: MD_LANDMARKS.rioLakefront.x,
        pickupZ: MD_LANDMARKS.rioLakefront.z,
        pickupLabel: 'NIST Gaithersburg Cryo Gate',
        dropoffX: MD_LANDMARKS.bethesda.x,
        dropoffZ: MD_LANDMARKS.bethesda.z,
        dropoffLabel: 'NIH Clinical Cryo Vault',
      },
      {
        pickupX: MD_LANDMARKS.bethesda.x,
        pickupZ: MD_LANDMARKS.bethesda.z,
        pickupLabel: 'NIH Bethesda Lab Bay',
        dropoffX: 1440,
        dropoffZ: -280,
        dropoffLabel: 'Johns Hopkins Research Dock',
      },
    ],
  },
  {
    id: 'job_golf_catering',
    title: 'Country Club VIP Tournament Supply',
    roleLabel: 'EVENT LOGISTICS',
    jobCategory: 'Passenger & VIP',
    icon: '🥂',
    basePay: 2850,
    maxTipBonus: 900,
    tipBonusMax: 900,
    timeLimitSec: 95,
    badgeColor: '#84cc16',
    skillChallenge: 'precision_stop',
    skillBadgeLabel: '🎯 Smooth Curb Stop +$600',
    skillBonusMax: 600,
    description: 'Deliver chilled tournament catering & pro golf gear to Gaithersburg Country Club and Potomac Falls with a silky-smooth valet stop!',
    routes: [
      {
        pickupX: MD_LANDMARKS.rioLakefront.x,
        pickupZ: MD_LANDMARKS.rioLakefront.z,
        pickupLabel: 'RIO Waterfront Bistro Kitchen',
        dropoffX: MD_LANDMARKS.gaithersburgGolfField.x,
        dropoffZ: MD_LANDMARKS.gaithersburgGolfField.z,
        dropoffLabel: 'Gaithersburg Country Club Clubhouse',
      },
      {
        pickupX: MD_LANDMARKS.bethesda.x,
        pickupZ: MD_LANDMARKS.bethesda.z,
        pickupLabel: 'Bethesda Gourmet Market',
        dropoffX: -760,
        dropoffZ: 1680,
        dropoffLabel: 'Potomac Falls Gala Gate',
      },
    ],
  },
  {
    id: 'job_track_inspector',
    title: 'MARC & Rail Corridor High-Speed Inspector',
    roleLabel: 'RAIL CORRIDOR',
    jobCategory: 'Utility & Specialty',
    icon: '🚆',
    basePay: 3350,
    maxTipBonus: 1000,
    tipBonusMax: 1000,
    timeLimitSec: 100,
    badgeColor: '#6366f1',
    skillChallenge: 'high_speed_run',
    skillBadgeLabel: '⚡ Rapid Telemetry +$700',
    skillBonusMax: 700,
    description: 'Run urgent signal & track sensor checks between Shady Grove, Silver Spring, College Park, and BWI Rail Terminal against the clock!',
    routes: [
      {
        pickupX: MD_LANDMARKS.shadyGroveMetro.x,
        pickupZ: MD_LANDMARKS.shadyGroveMetro.z,
        pickupLabel: 'Shady Grove Rail Control Box',
        dropoffX: MD_LANDMARKS.silverSpring.x,
        dropoffZ: MD_LANDMARKS.silverSpring.z,
        dropoffLabel: 'Silver Spring MARC Signal Tower',
      },
      {
        pickupX: MD_LANDMARKS.collegeParkUMD.x,
        pickupZ: MD_LANDMARKS.collegeParkUMD.z,
        pickupLabel: 'College Park Rail Yard',
        dropoffX: MD_LANDMARKS.bwiAirport.x,
        dropoffZ: MD_LANDMARKS.bwiAirport.z,
        dropoffLabel: 'BWI Rail Station Concourse',
      },
    ],
  },
];

export interface CityIndoorJobSpec {
  id: string;
  title: string;
  roleLabel: string;
  icon: string;
  workKind: WorkplaceShiftKind;
  baseShiftPay: number;
  maxShiftBonus: number;
  badgeColor: string;
  workplaceTypeLabel: string;
  skillStyle: string;
  buildingMatchKeywords: string[];
  description: string;
  tasksSummary: string;
}

export const CITY_INDOOR_JOBS_CATALOG: CityIndoorJobSpec[] = [
  {
    id: 'indoor_corporate_analyst',
    title: 'Corporate Financial Analyst',
    roleLabel: 'OFFICE SUITE SHIFT',
    icon: '💼',
    workKind: 'work_office',
    baseShiftPay: 1950,
    maxShiftBonus: 1450,
    badgeColor: '#3b82f6',
    workplaceTypeLabel: 'Office Buildings & Towers',
    skillStyle: 'Timing Trade Lock + Ledger Audits',
    buildingMatchKeywords: ['office', 'tower', 'corporate', 'financial', 'charles', 'pratt', 'wtc', 'mercantile', 'business', 'executive'],
    description: 'Step inside any Office Building or High-Rise Tower, walk into a suite workstation, and nail timed market trades & client briefs.',
    tasksSummary: 'Trade Timing · Revenue Audits · Executive Memos',
  },
  {
    id: 'indoor_software_engineer',
    title: 'Systems & Cyber Operations Engineer',
    roleLabel: 'TECH OFFICE SHIFT',
    icon: '💻',
    workKind: 'work_office',
    baseShiftPay: 2250,
    maxShiftBonus: 1600,
    badgeColor: '#6366f1',
    workplaceTypeLabel: 'Tech Offices & Towers',
    skillStyle: 'Rapid Command Macros + Triage',
    buildingMatchKeywords: ['tech', 'solutions', 'office', 'tower', 'enterprise', 'hq', 'center', 'corporate'],
    description: 'Work inside corporate tech floors across Baltimore, Columbia, and Gaithersburg—enter deployment codes and scale auth pods.',
    tasksSummary: 'Deploy Macros · Incident Triage · Security Reviews',
  },
  {
    id: 'indoor_cyber_forensics',
    title: 'Cyber Intrusion & SOC Responder',
    roleLabel: 'CYBER OPS SUITE',
    icon: '🛡️',
    workKind: 'work_office',
    baseShiftPay: 2550,
    maxShiftBonus: 1750,
    badgeColor: '#8b5cf6',
    workplaceTypeLabel: 'Tech & Security Office Towers',
    skillStyle: 'Firewall Sequence + Signal Balance',
    buildingMatchKeywords: ['office', 'tower', 'tech', 'wtc', 'financial', 'center', 'hq'],
    description: 'Defend metro office networks inside multi-story suites by keying firewall isolation codes and balancing server load waveforms.',
    tasksSummary: 'Firewall Codes · Traffic Balance · Threat Isolation',
  },
  {
    id: 'indoor_legal_associate',
    title: 'Law Firm & Municipal Associate',
    roleLabel: 'LEGAL & CIVIC OFFICE',
    icon: '⚖️',
    workKind: 'work_office',
    baseShiftPay: 2350,
    maxShiftBonus: 1650,
    badgeColor: '#60a5fa',
    workplaceTypeLabel: 'Law Suites & City Hall',
    skillStyle: 'Contract Audits + Filing Sequence',
    buildingMatchKeywords: ['legal', 'law', 'courthouse', 'city hall', 'annex', 'associates', 'office', 'tower'],
    description: 'Visit legal suites, municipal offices, or high-rise law floors—review contract clauses and stamp docket filings under deadline.',
    tasksSummary: 'Contract Audits · Docket Sequence · Compliance',
  },
  {
    id: 'indoor_executive_director',
    title: 'Executive Floor Operations Director',
    roleLabel: 'EXECUTIVE SUITE',
    icon: '📊',
    workKind: 'work_office',
    baseShiftPay: 2800,
    maxShiftBonus: 1950,
    badgeColor: '#f59e0b',
    workplaceTypeLabel: 'Multi-Story Towers (Upper Floors)',
    skillStyle: 'Boardroom Timing + M&A Strategy',
    buildingMatchKeywords: ['wtc', 'tower', 'headquarters', 'hq', 'executive', 'office', 'financial'],
    description: 'Take the elevator inside any high-rise office tower up to upper executive suites for high-paying strategic operations shifts.',
    tasksSummary: 'M&A Timing · Budget Balance · Board Approvals',
  },
  {
    id: 'indoor_clinic_nurse',
    title: 'Clinic Triage & Nurse Practitioner',
    roleLabel: 'MEDICAL CLINIC SHIFT',
    icon: '🩺',
    workKind: 'work_clinic',
    baseShiftPay: 2100,
    maxShiftBonus: 1500,
    badgeColor: '#22d3ee',
    workplaceTypeLabel: 'Clinics & Medical Centers',
    skillStyle: 'Pulse Sync Gauge + Patient Triage',
    buildingMatchKeywords: ['clinic', 'medical', 'urgent', 'health', 'care'],
    description: 'Enter any clinic or medical center ([V] Explore), walk to an exam suite charting desk, and sync vitals & triage patients.',
    tasksSummary: 'Pulse Sync · Vitals Screening · Rx Orders',
  },
  {
    id: 'indoor_hospital_physician',
    title: 'Hospital Diagnostic Specialist',
    roleLabel: 'HOSPITAL STAFF SHIFT',
    icon: '🏥',
    workKind: 'work_clinic',
    baseShiftPay: 2700,
    maxShiftBonus: 1800,
    badgeColor: '#10b981',
    workplaceTypeLabel: 'Hospitals & NIH Medical',
    skillStyle: 'ECG Rhythm Lock + ICU Triage',
    buildingMatchKeywords: ['hospital', 'nih', 'hopkins', 'medical', 'clinic'],
    description: 'Clock in inside major hospitals & medical wings across multiple exam floors to stabilize rhythms and diagnose critical cases.',
    tasksSummary: 'ECG Rhythm · Diagnostic Panels · ICU Care',
  },
  {
    id: 'indoor_nist_researcher',
    title: 'NIST & Bio-Research Scientist',
    roleLabel: 'RESEARCH LAB SHIFT',
    icon: '🔬',
    workKind: 'work_lab',
    baseShiftPay: 2500,
    maxShiftBonus: 1700,
    badgeColor: '#38bdf8',
    workplaceTypeLabel: 'NIST & Research Labs',
    skillStyle: 'Centrifuge Timing + Titration Balance',
    buildingMatchKeywords: ['nist', 'research', 'lab', 'science', 'aquarium'],
    description: 'Explore NIST Gaithersburg or research labs to lock centrifuge RPMs, balance dual reagent pH, and calibrate spectrometers.',
    tasksSummary: 'Centrifuge Lock · pH Balance · Spectrometer Assay',
  },
  {
    id: 'indoor_pharma_chemist',
    title: 'Clinical Compounding & Assay Chemist',
    roleLabel: 'COMPOUNDING LAB',
    icon: '⚗️',
    workKind: 'work_lab',
    baseShiftPay: 2650,
    maxShiftBonus: 1750,
    badgeColor: '#2dd4bf',
    workplaceTypeLabel: 'Labs, NIST & Medical Wings',
    skillStyle: 'Reagent Balance + Purity Code',
    buildingMatchKeywords: ['lab', 'nist', 'research', 'science', 'nih', 'hospital'],
    description: 'Measure exact reagent ratios and execute sterile sequence protocols at research and hospital lab benches.',
    tasksSummary: 'Reagent Balance · Sterile Sequence · Purity Test',
  },
  {
    id: 'indoor_bank_teller',
    title: 'Bank Teller & Wire Specialist',
    roleLabel: 'BANK COUNTER SHIFT',
    icon: '🏦',
    workKind: 'work_bank',
    baseShiftPay: 2200,
    maxShiftBonus: 1450,
    badgeColor: '#facc15',
    workplaceTypeLabel: 'Banks (Press [V] Explore)',
    skillStyle: 'Vault Seal Timing + Wire Audits',
    buildingMatchKeywords: ['bank', 'reserve', 'trust', 'bullion'],
    description: 'Walk peacefully inside any bank ([V] Explore) and work the teller counter—lock time-vault seals, audit wires, and balance drawers.',
    tasksSummary: 'Vault Seal Lock · Wire Audit · Drawer Balance',
  },
  {
    id: 'indoor_retail_manager',
    title: 'Retail Store & Boutique Specialist',
    roleLabel: 'STORE COUNTER SHIFT',
    icon: '🛒',
    workKind: 'work_retail',
    baseShiftPay: 1750,
    maxShiftBonus: 1250,
    badgeColor: '#ec4899',
    workplaceTypeLabel: 'Malls, Boutiques & Markets',
    skillStyle: 'Barcode Speed Sequence + Register',
    buildingMatchKeywords: ['mall', 'plaza', 'mart', 'store', 'shop', 'market', 'boutique', 'crown', 'center', 'jewelry'],
    description: 'Step into stores, malls, or jewelry boutiques ([V] Explore) to run checkout registers, scan rapid SKUs, and appraise items.',
    tasksSummary: 'SKU Sequence · Checkout Math · Client Sizing',
  },
  {
    id: 'indoor_chef_kitchen',
    title: 'Maryland Crab House & Bistro Head Chef',
    roleLabel: 'KITCHEN LINE SHIFT',
    icon: '👨‍🍳',
    workKind: 'work_kitchen',
    baseShiftPay: 2150,
    maxShiftBonus: 1650,
    badgeColor: '#f97316',
    workplaceTypeLabel: 'Food Halls, Malls & Waterfront Cafes',
    skillStyle: 'Sear Timing Gauge + Dual-Burner Heat',
    buildingMatchKeywords: ['mall', 'plaza', 'crown', 'center', 'market', 'rio', 'harbor', 'store'],
    description: 'Step behind the stainless prep counter inside shopping plazas and waterfront venues to time crab-cake sears and balance twin grill temps!',
    tasksSummary: 'Grill Sear Timing · Burner Balance · Order Sequence',
  },
  {
    id: 'indoor_baker_patisserie',
    title: 'Artisan Bakery & Espresso Barista',
    roleLabel: 'CAFE & BAKERY SHIFT',
    icon: '🥐',
    workKind: 'work_kitchen',
    baseShiftPay: 1850,
    maxShiftBonus: 1350,
    badgeColor: '#fb923c',
    workplaceTypeLabel: 'Town Centers & Markets',
    skillStyle: 'Espresso Pressure + Order Combos',
    buildingMatchKeywords: ['mall', 'plaza', 'market', 'mart', 'store', 'center'],
    description: 'Pull golden espresso shots at exact bar pressure and punch rapid pastry orders during morning rush shifts.',
    tasksSummary: 'Bar Pressure Lock · Drink Sequence · Steam Temp',
  },
  {
    id: 'indoor_auto_mechanic',
    title: 'Master Performance Mechanic & Dyno Tech',
    roleLabel: 'GARAGE SERVICE BAY',
    icon: '🔧',
    workKind: 'work_mechanic',
    baseShiftPay: 2400,
    maxShiftBonus: 1750,
    badgeColor: '#fbbf24',
    workplaceTypeLabel: 'Service Stations & Tuning Bays',
    skillStyle: 'Torque Gauge + Camber Alignment',
    buildingMatchKeywords: ['service', 'sunoco', 'shell', 'exxon', 'wawa', 'pit', 'station', 'garage'],
    description: 'Enter any Service Station ([V] Explore) and step into the lift bay to hit exact torque specs, balance ECU boost, and align wheels!',
    tasksSummary: 'Torque Spec Lock · Dyno Balance · Firing Order',
  },
  {
    id: 'indoor_ev_battery_tech',
    title: 'High-Voltage EV & Hybrid Diagnostics Tech',
    roleLabel: 'EV POWERTRAIN BAY',
    icon: '🔋',
    workKind: 'work_mechanic',
    baseShiftPay: 2600,
    maxShiftBonus: 1850,
    badgeColor: '#34d399',
    workplaceTypeLabel: 'Service Stations & EV Bays',
    skillStyle: 'Cell Voltage Balance + Breaker Code',
    buildingMatchKeywords: ['service', 'sunoco', 'shell', 'exxon', 'wawa', 'station', 'garage'],
    description: 'Service high-voltage hybrid & EV packs inside tuning stations—equalize battery modules and clear inverter fault codes.',
    tasksSummary: 'Voltage Equalize · Fault Code · Thermal Lock',
  },
  {
    id: 'indoor_atc_controller',
    title: 'BWI & KGAI Air Traffic Radar Controller',
    roleLabel: 'ATC TOWER SHIFT',
    icon: '✈️',
    workKind: 'work_atc',
    baseShiftPay: 2950,
    maxShiftBonus: 2100,
    badgeColor: '#0ea5e9',
    workplaceTypeLabel: 'BWI Airport & KGAI Airpark Towers',
    skillStyle: 'Glide-Slope Timing + Squawk Codes',
    buildingMatchKeywords: ['airport', 'airpark', 'bwi', 'kgai', 'aviation', 'terminal', 'hangar'],
    description: 'Step inside BWI or Montgomery Airpark towers ([V] Explore) and guide jets cleanly onto runway vectors with tight radar timing!',
    tasksSummary: 'Glide-Slope Lock · Squawk Sequence · Vector Spacing',
  },
  {
    id: 'indoor_broadcast_producer',
    title: 'Baltimore Live Broadcast & Audio Producer',
    roleLabel: 'MEDIA STUDIO SHIFT',
    icon: '🎬',
    workKind: 'work_studio',
    baseShiftPay: 2550,
    maxShiftBonus: 1800,
    badgeColor: '#e879f9',
    workplaceTypeLabel: 'WTC & Downtown Media Towers',
    skillStyle: 'Audio EQ Balance + Live Cue Sync',
    buildingMatchKeywords: ['wtc', 'world trade', 'media', 'broadcast', 'tower', 'studio', 'charles', 'pratt'],
    description: 'Head up inside the World Trade Center or downtown towers to mix live broadcast audio levels and hit exact camera cut cues!',
    tasksSummary: 'Audio Mastering · Camera Cue Timing · Cue Deck',
  },
  {
    id: 'indoor_precinct_dispatcher',
    title: 'Precinct & Transit Operations Dispatcher',
    roleLabel: 'DISPATCH DESK SHIFT',
    icon: '📻',
    workKind: 'work_dispatch',
    baseShiftPay: 2300,
    maxShiftBonus: 1550,
    badgeColor: '#818cf8',
    workplaceTypeLabel: 'MCPD Precinct & Transit Hubs',
    skillStyle: 'Radio Frequency Lock + Routing',
    buildingMatchKeywords: ['precinct', 'police', 'station', 'marc', 'airport', 'airpark', 'terminal'],
    description: 'Step inside the Police Precinct or transit terminals ([V] Explore) and route emergency & commuter units from the dispatch console.',
    tasksSummary: 'Frequency Lock · Radio Priority · Fleet Dispatch',
  },
];

export type OutdoorFieldJobKind =
  | 'harbor_crane'
  | 'crab_fishing'
  | 'bridge_welder'
  | 'power_lineman'
  | 'wildfire_drop'
  | 'stadium_turf'
  | 'highway_paver'
  | 'wind_turbine'
  | 'drone_survey'
  | 'heavy_winch'
  | 'airfield_marshaler'
  | 'solar_array';

export type OutdoorSkillMechanic = 'canvas_action' | 'timing_strike' | 'wire_grid' | 'sequence_cal';

export interface OutdoorJobSite {
  x: number;
  z: number;
  label: string;
}

export interface CityOutdoorJobSpec {
  id: string;
  kind: OutdoorFieldJobKind;
  mechanic: OutdoorSkillMechanic;
  mechanicLabel: string;
  title: string;
  roleLabel: string;
  icon: string;
  basePay: number;
  maxSkillBonus: number;
  skillXpReward: number;
  badgeColor: string;
  description: string;
  sites: OutdoorJobSite[];
}

export const CITY_OUTDOOR_JOBS_CATALOG: CityOutdoorJobSpec[] = [
  {
    id: 'outdoor_harbor_crane',
    kind: 'harbor_crane',
    mechanic: 'canvas_action',
    mechanicLabel: 'Interactive Gantry Crane Canvas',
    title: 'Port of Baltimore Container Crane Operator',
    roleLabel: 'HARBOR CRANE',
    icon: '🏗️',
    basePay: 2800,
    maxSkillBonus: 1850,
    skillXpReward: 48,
    badgeColor: '#f59e0b',
    description: 'Drive out to Baltimore Waterfront Cargo Piers, step onto the dock, and operate the magnetic gantry crane to stack cargo onto trailers!',
    sites: [
      { x: MD_LANDMARKS.baltimoreDominoSugar.x, z: MD_LANDMARKS.baltimoreDominoSugar.z, label: 'Baltimore Domino Cargo Pier' },
      { x: MD_LANDMARKS.baltimoreInnerHarbor.x + 28, z: MD_LANDMARKS.baltimoreInnerHarbor.z + 18, label: 'Inner Harbor South Pier' },
    ],
  },
  {
    id: 'outdoor_crab_fishing',
    kind: 'crab_fishing',
    mechanic: 'canvas_action',
    mechanicLabel: 'Live Chesapeake Trawler Net Canvas',
    title: 'Chesapeake Commercial Crab & Boat Charter',
    roleLabel: 'COMMERCIAL BOAT',
    icon: '🦀',
    basePay: 2550,
    maxSkillBonus: 1700,
    skillXpReward: 44,
    badgeColor: '#06b6d4',
    description: 'Head down to the Annapolis Dock or RIO Lakefront Pier and steer your trawler net across blue crab schools while dodging channel buoys!',
    sites: [
      { x: MD_LANDMARKS.annapolisFishingDock.x, z: MD_LANDMARKS.annapolisFishingDock.z, label: 'Annapolis Commercial Seafood Pier' },
      { x: MD_LANDMARKS.rioFishingPier.x, z: MD_LANDMARKS.rioFishingPier.z, label: 'RIO Lakefront Timber Pier' },
    ],
  },
  {
    id: 'outdoor_bridge_welder',
    kind: 'bridge_welder',
    mechanic: 'timing_strike',
    mechanicLabel: 'Multi-Stage Arc Weld Timing',
    title: 'Bay Bridge Structural Steel Welder',
    roleLabel: 'BRIDGE STEEL',
    icon: '🔥',
    basePay: 3100,
    maxSkillBonus: 2000,
    skillXpReward: 52,
    badgeColor: '#fb923c',
    description: 'Drive onto the Chesapeake Bay Bridge maintenance span and weld high-tension steel gusset seams under coastal crosswinds!',
    sites: [
      { x: MD_LANDMARKS.chesapeakeBayBridgeMid.x, z: MD_LANDMARKS.chesapeakeBayBridgeMid.z, label: 'Chesapeake Bay Bridge Midspan Bay' },
      { x: MD_LANDMARKS.baltimoreDominoSugar.x - 24, z: MD_LANDMARKS.baltimoreDominoSugar.z - 22, label: 'Harbor Drydock Girder Yard' },
    ],
  },
  {
    id: 'outdoor_power_lineman',
    kind: 'power_lineman',
    mechanic: 'wire_grid',
    mechanicLabel: 'High-Voltage Grid Circuit Patch',
    title: 'BGE High-Voltage Substation Lineman',
    roleLabel: 'POWER GRID',
    icon: '⚡',
    basePay: 2950,
    maxSkillBonus: 1900,
    skillXpReward: 50,
    badgeColor: '#eab308',
    description: 'Respond to outdoor power substations and patch live 3-phase transformer buses safely without tripping overload breakers!',
    sites: [
      { x: MD_LANDMARKS.columbia.x + 25, z: MD_LANDMARKS.columbia.z + 25, label: 'Columbia US-29 Grid Substation' },
      { x: MD_LANDMARKS.isbCampus.x - 32, z: MD_LANDMARKS.isbCampus.z + 28, label: 'Woodlawn Johnnycake Relay Yard' },
    ],
  },
  {
    id: 'outdoor_wildfire_crew',
    kind: 'wildfire_drop',
    mechanic: 'canvas_action',
    mechanicLabel: 'Aerial Tanker Fire-Drop Canvas',
    title: 'Appalachian Forestry Wildfire Crew',
    roleLabel: 'FIRE CREW',
    icon: '🚒',
    basePay: 3250,
    maxSkillBonus: 2100,
    skillXpReward: 55,
    badgeColor: '#ef4444',
    description: 'Drive into Western Maryland mountain ridges and pilot the aerial water-drop target reticle over spreading brush flare-ups!',
    sites: [
      { x: MD_LANDMARKS.deepCreekLake.x, z: MD_LANDMARKS.deepCreekLake.z, label: 'Deep Creek State Forest Helipad' },
      { x: MD_LANDMARKS.sidelingHill.x, z: MD_LANDMARKS.sidelingHill.z, label: 'Sideling Hill Forestry Firebreak' },
    ],
  },
  {
    id: 'outdoor_stadium_turf',
    kind: 'stadium_turf',
    mechanic: 'canvas_action',
    mechanicLabel: 'Precision Turf Striper Canvas',
    title: 'Camden Yards & Bohrer Turf Groundskeeper',
    roleLabel: 'TURF CREW',
    icon: '🌿',
    basePay: 2350,
    maxSkillBonus: 1550,
    skillXpReward: 40,
    badgeColor: '#22c55e',
    description: 'Steer the precision turf mower across Camden Yards or Bohrer Stadium fields to stripe clean outfield lines before game time!',
    sites: [
      { x: MD_LANDMARKS.bohrerSoccerField.x + 18, z: MD_LANDMARKS.bohrerSoccerField.z, label: 'Bohrer Park Championship Turf' },
      { x: MD_LANDMARKS.baltimoreCamdenYards.x + 20, z: MD_LANDMARKS.baltimoreCamdenYards.z + 20, label: 'Camden Yards Grounds Gate' },
    ],
  },
  {
    id: 'outdoor_highway_paver',
    kind: 'highway_paver',
    mechanic: 'timing_strike',
    mechanicLabel: 'Asphalt Compactor & Hammer Timing',
    title: 'I-270 & I-70 Highway Paving Crew',
    roleLabel: 'ROAD CREW',
    icon: '🚧',
    basePay: 2650,
    maxSkillBonus: 1750,
    skillXpReward: 46,
    badgeColor: '#facc15',
    description: 'Deploy to active highway work zones and synchronize heavy jackhammer & roller compaction strikes to smooth cracked asphalt!',
    sites: [
      { x: MD_LANDMARKS.shadyGroveMetro.x + 24, z: MD_LANDMARKS.shadyGroveMetro.z - 24, label: 'I-270 Shady Grove Work Zone' },
      { x: MD_LANDMARKS.hagerstown.x + 28, z: MD_LANDMARKS.hagerstown.z, label: 'I-70 Hagerstown Paving Zone' },
    ],
  },
  {
    id: 'outdoor_wind_turbine',
    kind: 'wind_turbine',
    mechanic: 'sequence_cal',
    mechanicLabel: 'Blade Pitch Calibration Sequence',
    title: 'Mountain Ridge Wind Turbine Technician',
    roleLabel: 'WIND TECH',
    icon: '🌬️',
    basePay: 3050,
    maxSkillBonus: 1950,
    skillXpReward: 50,
    badgeColor: '#38bdf8',
    description: 'Climb the Cumberland & Sideling ridge wind farm pads and punch exact directional blade-pitch calibration sequences!',
    sites: [
      { x: MD_LANDMARKS.cumberland.x, z: MD_LANDMARKS.cumberland.z, label: 'Cumberland Ridge Turbine #4' },
      { x: MD_LANDMARKS.frederick.x - 30, z: MD_LANDMARKS.frederick.z + 30, label: 'Catoctin Ridge Wind Pad' },
    ],
  },
  {
    id: 'outdoor_drone_survey',
    kind: 'drone_survey',
    mechanic: 'canvas_action',
    mechanicLabel: 'Live Aerial Survey Drone Canvas',
    title: 'Chesapeake Shoreline & Coast Drone Pilot',
    roleLabel: 'DRONE SURVEY',
    icon: '🛸',
    basePay: 2700,
    maxSkillBonus: 1800,
    skillXpReward: 46,
    badgeColor: '#818cf8',
    description: 'Launch an outdoor mapping drone along National Harbor or Ocean City Inlet and fly through wind-buffeted telemetry rings!',
    sites: [
      { x: MD_LANDMARKS.nationalHarbor.x, z: MD_LANDMARKS.nationalHarbor.z, label: 'National Harbor Waterfront Launch' },
      { x: MD_LANDMARKS.oceanCityBoardwalk.x, z: MD_LANDMARKS.oceanCityBoardwalk.z, label: 'Ocean City Inlet Survey Pad' },
    ],
  },
  {
    id: 'outdoor_heavy_winch',
    kind: 'heavy_winch',
    mechanic: 'timing_strike',
    mechanicLabel: 'Hydraulic Winch Tension Timing',
    title: 'Off-Road Ravine & Trail Winch Recovery',
    roleLabel: 'WINCH RESCUE',
    icon: '🪝',
    basePay: 2900,
    maxSkillBonus: 1900,
    skillXpReward: 48,
    badgeColor: '#f97316',
    description: 'Take a high-clearance rig off the pavement to mud & gravel trailheads and winch stranded 4x4s free without snapping the cable!',
    sites: [
      { x: -760, z: 1680, label: 'Potomac Falls Off-Road Trailhead' },
      { x: MD_LANDMARKS.ellicottCity.x - 24, z: MD_LANDMARKS.ellicottCity.z - 24, label: 'Patapsco Gorge Recovery Spot' },
    ],
  },
  {
    id: 'outdoor_airfield_marshaler',
    kind: 'airfield_marshaler',
    mechanic: 'sequence_cal',
    mechanicLabel: 'Jet Marshaling Wand Sequence',
    title: 'BWI & KGAI Flight-Line Ramp Marshaler',
    roleLabel: 'RAMP CREW',
    icon: '🛫',
    basePay: 2850,
    maxSkillBonus: 1850,
    skillXpReward: 48,
    badgeColor: '#0ea5e9',
    description: 'Stand out on the tarmac at BWI or Montgomery Airpark and signal incoming cargo aircraft with crisp dual-wand hand commands!',
    sites: [
      { x: MD_LANDMARKS.kgaiAirpark.x, z: MD_LANDMARKS.kgaiAirpark.z, label: 'KGAI Montgomery Airpark Tarmac' },
      { x: MD_LANDMARKS.bwiAirport.x + 28, z: MD_LANDMARKS.bwiAirport.z - 22, label: 'BWI Cargo Ramp Gate B4' },
    ],
  },
  {
    id: 'outdoor_solar_array',
    kind: 'solar_array',
    mechanic: 'wire_grid',
    mechanicLabel: 'Solar Array Inverter Grid Puzzle',
    title: 'Maryland Solar Farm & Grid Field Engineer',
    roleLabel: 'SOLAR FIELD',
    icon: '☀️',
    basePay: 2600,
    maxSkillBonus: 1700,
    skillXpReward: 44,
    badgeColor: '#fbbf24',
    description: 'Inspect sunny Maryland solar yards near Hadley Farms & Olney—link solar panel inverters cleanly across every bus bar!',
    sites: [
      { x: MD_LANDMARKS.hadleyFarms.x, z: MD_LANDMARKS.hadleyFarms.z, label: 'Hadley Farms Solar Field' },
      { x: MD_LANDMARKS.olney.x, z: MD_LANDMARKS.olney.z, label: 'Olney Agricultural Solar Array' },
    ],
  },
];

export interface CityHeistTargetSpec {
  id: string;
  name: string;
  category: 'BANK' | 'JEWELRY' | 'STORE' | 'HOUSE';
  robbable?: boolean;
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
    name: 'National Harbor Waterfront Reserve Vault',
    category: 'BANK',
    icon: '🏦',
    x: MD_LANDMARKS.nationalHarbor.x,
    z: MD_LANDMARKS.nationalHarbor.z,
    streetLocation: '150 Waterfront St (National Harbor)',
    payoutCash: 42000,
    robDurationSec: 5.0,
    wantedStarsTriggered: 5,
    cooldownSec: 85,
    badgeColor: '#f97316',
    description: 'High-security Potomac riverfront treasury & bullion room—defeat the security detail to crack the vault!',
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
  {
    id: 'store_dave_and_busters',
    name: "Dave & Buster's RIO Arcade & Grill",
    category: 'STORE',
    robbable: true,
    icon: '🕹️',
    x: MD_LANDMARKS.daveAndBusters.x,
    z: MD_LANDMARKS.daveAndBusters.z,
    streetLocation: '9811 Washingtonian Blvd · RIO Center (Gaithersburg)',
    payoutCash: 16200,
    robDurationSec: 3.0,
    wantedStarsTriggered: 5,
    cooldownSec: 50,
    badgeColor: '#f97316',
    description: '3-floor mega RIO arcade with elevators & all 13 skill games (Pool, Air Hockey, Skee-Ball, Pop-a-Shot, Pinball, F1 Sim & more). Explore & play peacefully or raid the prize vaults!',
  },
  {
    id: 'store_chuck_e_cheese',
    name: "Chuck E. Cheese's Lakeforest Fun Center",
    category: 'STORE',
    robbable: false,
    icon: '🍕',
    x: MD_LANDMARKS.chuckECheese.x,
    z: MD_LANDMARKS.chuckECheese.z,
    streetLocation: '700 N Frederick Ave · Lakeforest Plaza (Gaithersburg)',
    payoutCash: 0,
    robDurationSec: 2.6,
    wantedStarsTriggered: 0,
    cooldownSec: 45,
    badgeColor: '#a855f7',
    description: 'Massive 3-floor family pizza & arcade zone with elevators, Skee-Ball, Claw Machines, Whack-a-Bot, Pinball, Pop-a-Shot & Dance Stage! Explore-only public fun center.',
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
    price: 285000,
    passiveIncomePer30s: 2200,
    passiveIncomePerMin: 4400,
    garageSlots: 2,
    x: 785,
    z: -105,
    heading: 0,
    spawnHeading: 0,
    streetLocation: '1211 N Rolling Rd (Catonsville)',
    badgeColor: '#38bdf8',
    description: 'Classic 2-story Catonsville starter residence minutes from ISB on Johnnycake Rd & I-695 with private driveway and rental income.',
  },
  {
    id: 'house_southside_loft',
    name: 'Rockville Town Square Residence',
    tierLabel: 'ROCKVILLE HOME',
    tier: 'ROCKVILLE HOME',
    icon: '🏠',
    price: 395000,
    passiveIncomePer30s: 3100,
    passiveIncomePerMin: 6200,
    garageSlots: 2,
    x: -618,
    z: 1378,
    heading: -Math.PI / 2,
    spawnHeading: -Math.PI / 2,
    streetLocation: '215 W Montgomery Ave (Rockville)',
    badgeColor: '#0ea5e9',
    description: 'Classic 2-story Montgomery County brick residence near Rockville Town Square & Shady Grove Metro.',
  },
  {
    id: 'house_midtown_townhouse',
    name: 'Frederick Historic Brick Colonial',
    tierLabel: 'FREDERICK HOME',
    tier: 'FREDERICK HOME',
    icon: '🏠',
    price: 525000,
    passiveIncomePer30s: 4200,
    passiveIncomePerMin: 8400,
    garageSlots: 4,
    x: -1112,
    z: -332,
    heading: Math.PI / 2,
    spawnHeading: Math.PI / 2,
    streetLocation: '214 N Market St (Frederick)',
    badgeColor: '#10b981',
    description: 'Historic 2-story red-brick residence steps from Carroll Creek Linear Park and Clustered Spires in Downtown Frederick.',
  },
  {
    id: 'house_pinecrest_colonial',
    name: 'Columbia Hickory Ridge Estate',
    tierLabel: 'HOWARD CO COLONIAL',
    tier: 'HOWARD CO COLONIAL',
    icon: '🏡',
    price: 685000,
    passiveIncomePer30s: 5500,
    passiveIncomePerMin: 11000,
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
    price: 1150000,
    passiveIncomePer30s: 9200,
    passiveIncomePerMin: 18400,
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
    price: 1650000,
    passiveIncomePer30s: 13500,
    passiveIncomePerMin: 27000,
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
    price: 2450000,
    passiveIncomePer30s: 19500,
    passiveIncomePerMin: 39000,
    garageSlots: 10,
    x: -555,
    z: 1735,
    heading: -Math.PI / 2,
    spawnHeading: -Math.PI / 2,
    streetLocation: '4902 Edgemoor Ln (Bethesda)',
    badgeColor: '#ec4899',
    description: 'Prestigious Bethesda estate just inside I-495 Capital Beltway with panoramic pool deck and collector garage.',
  },
  {
    id: 'house_billionaire_compound',
    name: 'Deep Creek Lakefront Mountain Lodge',
    tierLabel: 'CROWN JEWEL ESTATE',
    tier: 'CROWN JEWEL ESTATE',
    icon: '🏔️',
    price: 3850000,
    passiveIncomePer30s: 30000,
    passiveIncomePerMin: 60000,
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
const METRO_CITY_SLOTS_KEY = 'apex26_metro_city_slots_v1';
const ACTIVE_METRO_CITY_SLOT_KEY = 'apex26_active_metro_city_slot_v1';

export interface MetroCitySaveSlot {
  slotId: string;
  slotName: string;
  createdAt: number;
  updatedAt: number;
  state: MetroCitySaveState;
}

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
  tesla_cybertruck_beast: 'ford_f150_raptor_r',
};

function mapCarId(id: string): string {
  const mapped = LEGACY_CAR_ID_MAP[id] || id;
  return CITY_STREET_CARS.some((c) => c.id === mapped) ? mapped : 'honda_civic';
}

export function createDefaultMetroCitySave(): MetroCitySaveState {
  const defaultUnlockedTrims: Record<string, string[]> = {};
  const defaultActiveTrims: Record<string, string> = {};
  for (const car of CITY_STREET_CARS) {
    if (car.trims.length > 0) {
      defaultUnlockedTrims[car.id] = [car.trims[0].id];
      defaultActiveTrims[car.id] = car.trims[0].id;
    }
  }
  return {
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
    houseFurnishings: {},
    unpaidCrashTicketsTab: 0,
    totalJobsCompleted: 0,
    totalHeistsCompleted: 0,
    bankRobberyBustCount: 0,
    jobSkillXp: 0,
    outdoorJobsCompleted: 0,
  };
}

export function normalizeMetroCitySave(rawParsed: unknown): MetroCitySaveState {
  const fallback = createDefaultMetroCitySave();
  if (!rawParsed || typeof rawParsed !== 'object') return fallback;
  const parsed = rawParsed as Record<string, any>;

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

  const unlockedTrimsByCar: Record<string, string[]> = { ...fallback.unlockedTrimsByCar };
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

  const activeTrimByCar: Record<string, string> = { ...fallback.activeTrimByCar };
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

  const customPaintByCar: Record<string, string> = {};
  if (parsed.customPaintByCar && typeof parsed.customPaintByCar === 'object') {
    for (const [k, v] of Object.entries(parsed.customPaintByCar)) {
      if (typeof k === 'string' && typeof v === 'string') {
        customPaintByCar[k] = v.slice(0, 32);
      }
    }
  }

  const houseFurnishings: Record<string, string[]> = {};
  if (parsed.houseFurnishings && typeof parsed.houseFurnishings === 'object') {
    for (const [houseId, items] of Object.entries(parsed.houseFurnishings).slice(0, 64)) {
      if (typeof houseId === 'string' && houseId && Array.isArray(items)) {
        const uniq: string[] = [];
        for (const item of items) {
          if (typeof item === 'string' && item && !uniq.includes(item)) {
            uniq.push(item.slice(0, 64));
          }
          if (uniq.length >= 24) break;
        }
        if (uniq.length > 0) {
          houseFurnishings[houseId.slice(0, 64)] = uniq;
        }
      }
    }
  }

  return {
    streetCash: typeof parsed.streetCash === 'number' && Number.isFinite(parsed.streetCash) ? parsed.streetCash : 5000,
    ownedCarIds: rawOwned,
    selectedCarId: rawSelected,
    customPaintByCar,
    unlockedTrimsByCar,
    activeTrimByCar,
    completedMissions:
      typeof parsed.completedMissions === 'number'
        ? Math.max(parsed.completedMissions, completedMissionIds.length)
        : completedMissionIds.length,
    completedMissionIds,
    totalEarnedCash: typeof parsed.totalEarnedCash === 'number' && Number.isFinite(parsed.totalEarnedCash) ? parsed.totalEarnedCash : 5000,
    streetRepLevel: typeof parsed.streetRepLevel === 'number' && Number.isFinite(parsed.streetRepLevel) ? Math.max(1, parsed.streetRepLevel) : 1,
    pendingMissionId: typeof parsed.pendingMissionId === 'string' ? parsed.pendingMissionId : null,
    ownedHouseIds: Array.isArray(parsed.ownedHouseIds)
      ? parsed.ownedHouseIds.filter((id: unknown): id is string => typeof id === 'string')
      : [],
    activeHomeId: typeof parsed.activeHomeId === 'string' ? parsed.activeHomeId : null,
    houseFurnishings,
    unpaidCrashTicketsTab:
      typeof parsed.unpaidCrashTicketsTab === 'number' && Number.isFinite(parsed.unpaidCrashTicketsTab)
        ? Math.max(0, parsed.unpaidCrashTicketsTab)
        : 0,
    totalJobsCompleted:
      typeof parsed.totalJobsCompleted === 'number' && Number.isFinite(parsed.totalJobsCompleted)
        ? Math.max(0, parsed.totalJobsCompleted)
        : 0,
    totalHeistsCompleted:
      typeof parsed.totalHeistsCompleted === 'number' && Number.isFinite(parsed.totalHeistsCompleted)
        ? Math.max(0, parsed.totalHeistsCompleted)
        : 0,
    bankRobberyBustCount:
      typeof parsed.bankRobberyBustCount === 'number' && Number.isFinite(parsed.bankRobberyBustCount)
        ? Math.max(0, parsed.bankRobberyBustCount)
        : 0,
    jobSkillXp:
      typeof parsed.jobSkillXp === 'number' && Number.isFinite(parsed.jobSkillXp)
        ? Math.max(0, Math.round(parsed.jobSkillXp))
        : Math.max(
            0,
            Math.round(
              (typeof parsed.totalJobsCompleted === 'number' && Number.isFinite(parsed.totalJobsCompleted)
                ? Math.max(0, parsed.totalJobsCompleted)
                : 0) * 28
            )
          ),
    outdoorJobsCompleted:
      typeof parsed.outdoorJobsCompleted === 'number' && Number.isFinite(parsed.outdoorJobsCompleted)
        ? Math.max(0, Math.round(parsed.outdoorJobsCompleted))
        : 0,
  };
}

function notifyMetroCitySaveUpdated(detail?: { activeSlotId?: string }) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('metro-city-save-updated', { detail }));
  } catch {}
}

function sanitizeSlotId(rawId: string, fallbackIdx = 1): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64);
  return cleaned || `mc_slot_${fallbackIdx}`;
}

export function loadMetroCitySlots(): MetroCitySaveSlot[] {
  const now = Date.now();
  if (typeof window === 'undefined') {
    return [
      {
        slotId: 'mc_slot_1',
        slotName: 'Metro City Save #1',
        createdAt: now,
        updatedAt: now,
        state: createDefaultMetroCitySave(),
      },
    ];
  }
  try {
    const rawSlots = localStorage.getItem(METRO_CITY_SLOTS_KEY);
    if (rawSlots) {
      const parsed = JSON.parse(rawSlots);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned: MetroCitySaveSlot[] = [];
        const seen = new Set<string>();
        parsed.forEach((entry: any, idx: number) => {
          if (!entry || typeof entry !== 'object') return;
          const slotId = sanitizeSlotId(entry.slotId || `mc_slot_${idx + 1}`, idx + 1);
          if (seen.has(slotId)) return;
          seen.add(slotId);
          cleaned.push({
            slotId,
            slotName:
              typeof entry.slotName === 'string' && entry.slotName.trim()
                ? entry.slotName.trim().slice(0, 64)
                : `Metro City Save #${cleaned.length + 1}`,
            createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : now,
            updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : now,
            state: normalizeMetroCitySave(entry.state || entry),
          });
        });
        if (cleaned.length > 0) return cleaned;
      }
    }

    // Migrate legacy single-save key cleanly into Slot #1
    const rawLegacy = localStorage.getItem(METRO_CITY_SAVE_KEY);
    const migratedState = rawLegacy
      ? normalizeMetroCitySave(JSON.parse(rawLegacy))
      : createDefaultMetroCitySave();
    const initialSlots: MetroCitySaveSlot[] = [
      {
        slotId: 'mc_slot_1',
        slotName: 'Metro City Save #1',
        createdAt: now,
        updatedAt: now,
        state: migratedState,
      },
    ];
    localStorage.setItem(METRO_CITY_SLOTS_KEY, JSON.stringify(initialSlots));
    localStorage.setItem(ACTIVE_METRO_CITY_SLOT_KEY, 'mc_slot_1');
    return initialSlots;
  } catch {
    return [
      {
        slotId: 'mc_slot_1',
        slotName: 'Metro City Save #1',
        createdAt: now,
        updatedAt: now,
        state: createDefaultMetroCitySave(),
      },
    ];
  }
}

export function saveMetroCitySlots(slots: MetroCitySaveSlot[], emitEvent = true): void {
  if (typeof window === 'undefined' || !Array.isArray(slots) || slots.length === 0) return;
  try {
    const activeId = getActiveMetroCitySlotId(slots);
    localStorage.setItem(METRO_CITY_SLOTS_KEY, JSON.stringify(slots));
    localStorage.setItem(ACTIVE_METRO_CITY_SLOT_KEY, activeId);
    const activeSlot = slots.find((s) => s.slotId === activeId) || slots[0];
    if (activeSlot) {
      localStorage.setItem(METRO_CITY_SAVE_KEY, JSON.stringify(activeSlot.state));
    }
    if (emitEvent) {
      notifyMetroCitySaveUpdated({ activeSlotId: activeId });
    }
  } catch {
    // ignore storage errors
  }
}

export function getActiveMetroCitySlotId(slotsOverride?: MetroCitySaveSlot[]): string {
  const slots = slotsOverride || loadMetroCitySlots();
  if (typeof window === 'undefined') return slots[0]?.slotId || 'mc_slot_1';
  try {
    const saved = localStorage.getItem(ACTIVE_METRO_CITY_SLOT_KEY);
    if (saved && slots.some((s) => s.slotId === saved)) {
      return saved;
    }
  } catch {}
  return slots[0]?.slotId || 'mc_slot_1';
}

export function setActiveMetroCitySlotId(slotId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_METRO_CITY_SLOT_KEY, slotId);
    const slots = loadMetroCitySlots();
    const match = slots.find((s) => s.slotId === slotId);
    if (match) {
      localStorage.setItem(METRO_CITY_SAVE_KEY, JSON.stringify(match.state));
    }
    notifyMetroCitySaveUpdated({ activeSlotId: slotId });
  } catch {}
}

export function getActiveMetroCitySlot(): MetroCitySaveSlot {
  const slots = loadMetroCitySlots();
  const activeId = getActiveMetroCitySlotId(slots);
  return slots.find((s) => s.slotId === activeId) || slots[0];
}

export function loadMetroCitySave(): MetroCitySaveState {
  return getActiveMetroCitySlot().state;
}

export function saveMetroCitySave(state: MetroCitySaveState): void {
  if (typeof window === 'undefined') return;
  try {
    const slots = loadMetroCitySlots();
    const activeId = getActiveMetroCitySlotId(slots);
    const now = Date.now();
    const normalized = normalizeMetroCitySave(state);
    const idx = slots.findIndex((s) => s.slotId === activeId);
    let nextSlots: MetroCitySaveSlot[];
    if (idx >= 0) {
      nextSlots = slots.map((s, i) =>
        i === idx ? { ...s, state: normalized, updatedAt: now } : s
      );
    } else {
      nextSlots = [
        ...slots,
        {
          slotId: activeId,
          slotName: `Metro City Save #${slots.length + 1}`,
          createdAt: now,
          updatedAt: now,
          state: normalized,
        },
      ];
    }
    saveMetroCitySlots(nextSlots, true);
  } catch {
    // ignore storage errors
  }
}

export function createMetroCitySlot(slotName: string, copyCurrentState = false): MetroCitySaveSlot {
  const slots = loadMetroCitySlots();
  const now = Date.now();
  const slotId = `mc_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const cleanName = slotName.trim().slice(0, 64) || `Metro City Save #${slots.length + 1}`;
  const state = copyCurrentState
    ? normalizeMetroCitySave(JSON.parse(JSON.stringify(loadMetroCitySave())))
    : createDefaultMetroCitySave();
  const created: MetroCitySaveSlot = {
    slotId,
    slotName: cleanName,
    createdAt: now,
    updatedAt: now,
    state,
  };
  const nextSlots = [...slots, created];
  try {
    localStorage.setItem(ACTIVE_METRO_CITY_SLOT_KEY, slotId);
    localStorage.setItem(METRO_CITY_SAVE_KEY, JSON.stringify(created.state));
  } catch {}
  saveMetroCitySlots(nextSlots, true);
  return created;
}

export function switchMetroCitySlot(slotId: string): MetroCitySaveSlot | null {
  const slots = loadMetroCitySlots();
  const target = slots.find((s) => s.slotId === slotId);
  if (!target) return null;
  setActiveMetroCitySlotId(target.slotId);
  return target;
}

export function renameMetroCitySlot(slotId: string, newName: string): MetroCitySaveSlot[] {
  const clean = newName.trim().slice(0, 64);
  const slots = loadMetroCitySlots();
  if (!clean) return slots;
  const now = Date.now();
  const next = slots.map((s) =>
    s.slotId === slotId ? { ...s, slotName: clean, updatedAt: now } : s
  );
  saveMetroCitySlots(next, true);
  return next;
}

export function deleteMetroCitySlot(slotId: string): { slots: MetroCitySaveSlot[]; activeSlotId: string } {
  const slots = loadMetroCitySlots();
  if (slots.length <= 1) {
    return { slots, activeSlotId: getActiveMetroCitySlotId(slots) };
  }
  const filtered = slots.filter((s) => s.slotId !== slotId);
  const prevActive = getActiveMetroCitySlotId(slots);
  const nextActive = prevActive === slotId ? filtered[0].slotId : prevActive;
  try {
    localStorage.setItem(ACTIVE_METRO_CITY_SLOT_KEY, nextActive);
  } catch {}
  saveMetroCitySlots(filtered, true);
  return { slots: filtered, activeSlotId: nextActive };
}

export function mergeMetroCitySlotLists(
  primary: MetroCitySaveSlot[],
  secondary: MetroCitySaveSlot[]
): MetroCitySaveSlot[] {
  const byId = new Map<string, MetroCitySaveSlot>();
  for (const list of [secondary, primary]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || !item.slotId || !item.state) continue;
      const normalized: MetroCitySaveSlot = {
        slotId: sanitizeSlotId(item.slotId),
        slotName: typeof item.slotName === 'string' && item.slotName.trim() ? item.slotName.trim().slice(0, 64) : 'Metro City Save',
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
        state: normalizeMetroCitySave(item.state),
      };
      const existing = byId.get(normalized.slotId);
      if (!existing || normalized.updatedAt >= existing.updatedAt) {
        byId.set(normalized.slotId, normalized);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
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
    title: 'Level 16: National Harbor Waterfront Vault & Beltway Manhunt',
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

export type GpsManeuverType =
  | 'straight'
  | 'left'
  | 'slight_left'
  | 'right'
  | 'slight_right'
  | 'uturn'
  | 'arrive';

export interface DetailedCityGpsRoute {
  points: { x: number; z: number }[];
  totalRouteMeters: number;
  currentRoadName: string;
  nextRoadName: string;
  thenInstruction: string;
  distToTurnMeters: number;
  maneuver: GpsManeuverType;
  turnInstruction: string;
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
  roadName: string;
  isHighway: boolean;
}

let cachedMarylandRoadGraph: {
  nodes: GpsRoadNode[];
  edges: GpsRoadEdge[];
  adj: { to: number; dist: number; roadName: string; isHighway: boolean }[][];
} | null = null;

function getMarylandRoadGraph() {
  if (cachedMarylandRoadGraph) return cachedMarylandRoadGraph;

  const nodes: GpsRoadNode[] = [];
  const edges: GpsRoadEdge[] = [];
  const edgeSet = new Set<string>();

  // Snap nodes within 3.5m into shared graph junctions so minor rounding differences never disconnect roads
  const getOrAddNode = (x: number, z: number, snapDist = 3.5): number => {
    let bestId = -1;
    let bestD2 = snapDist * snapDist;
    for (let i = 0; i < nodes.length; i++) {
      const dx = nodes[i].x - x;
      const dz = nodes[i].z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestId = i;
      }
    }
    if (bestId !== -1) return bestId;
    const id = nodes.length;
    nodes.push({ id, x, z });
    return id;
  };

  const addEdge = (idA: number, idB: number, roadName: string, isHighway: boolean) => {
    if (idA === idB) return;
    const lo = Math.min(idA, idB);
    const hi = Math.max(idA, idB);
    const key = `${lo}_${hi}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    const na = nodes[idA];
    const nb = nodes[idB];
    const len = Math.hypot(nb.x - na.x, nb.z - na.z);
    if (len < 0.4) return;
    edges.push({ a: idA, b: idB, len, roadName, isHighway });
  };

  // Pre-collect all base road segments and junction vertices
  interface RawSeg {
    roadName: string;
    isHighway: boolean;
    isBridge: boolean;
    roadWidth: number;
    idA: number;
    idB: number;
    ax: number;
    az: number;
    bx: number;
    bz: number;
  }
  const rawSegs: RawSeg[] = [];
  const allVertexIds: number[] = [];
  const seenVert = new Set<number>();

  for (const road of ALL_MARYLAND_ROADS) {
    const chainIds = road.points.map((pt) => {
      const nid = getOrAddNode(pt.x, pt.z, 3.5);
      if (!seenVert.has(nid)) {
        seenVert.add(nid);
        allVertexIds.push(nid);
      }
      return nid;
    });
    for (let i = 0; i < chainIds.length - 1; i++) {
      const idA = chainIds[i];
      const idB = chainIds[i + 1];
      if (idA === idB) continue;
      rawSegs.push({
        roadName: road.name,
        isHighway: Boolean(road.isHighway),
        isBridge: Boolean(road.isBridge),
        roadWidth: road.width,
        idA,
        idB,
        ax: nodes[idA].x,
        az: nodes[idA].z,
        bx: nodes[idB].x,
        bz: nodes[idB].z,
      });
    }
  }

  // Split every road segment at ALL 2D crossings AND all mid-segment T-junction vertices
  for (let i = 0; i < rawSegs.length; i++) {
    const seg = rawSegs[i];
    const dx = seg.bx - seg.ax;
    const dz = seg.bz - seg.az;
    const lenSq = dx * dx + dz * dz;
    const len = Math.sqrt(lenSq);
    if (len < 0.5) continue;

    const splits: { t: number; nodeId: number }[] = [
      { t: 0, nodeId: seg.idA },
      { t: 1, nodeId: seg.idB },
    ];

    // 1. Mid-segment T-junction vertices from all other roads within perpendicular tolerance
    const tTol = Math.max(9.0, seg.roadWidth * 0.45);
    for (let v = 0; v < allVertexIds.length; v++) {
      const vid = allVertexIds[v];
      if (vid === seg.idA || vid === seg.idB) continue;
      const vn = nodes[vid];
      const t = ((vn.x - seg.ax) * dx + (vn.z - seg.az) * dz) / lenSq;
      if (t <= 0.005 || t >= 0.995) continue;
      const px = seg.ax + dx * t;
      const pz = seg.az + dz * t;
      const perpDist = Math.hypot(vn.x - px, vn.z - pz);
      if (perpDist <= 5.0) {
        splits.push({ t, nodeId: vid });
      } else if (perpDist <= tTol) {
        const splitNode = getOrAddNode(px, pz, 2.0);
        splits.push({ t, nodeId: splitNode });
        addEdge(splitNode, vid, seg.roadName, seg.isHighway);
      }
    }

    // 2. Real 2D intersections with crossing ground/bridge segments
    for (let j = 0; j < rawSegs.length; j++) {
      if (i === j) continue;
      const oth = rawSegs[j];
      if (seg.isBridge !== oth.isBridge) continue;
      if (seg.idA === oth.idA || seg.idA === oth.idB || seg.idB === oth.idA || seg.idB === oth.idB) continue;
      const rdx = dx;
      const rdz = dz;
      const sdx = oth.bx - oth.ax;
      const sdz = oth.bz - oth.az;
      const denom = rdx * sdz - rdz * sdx;
      if (Math.abs(denom) < 1e-4) continue;
      const t = ((oth.ax - seg.ax) * sdz - (oth.az - seg.az) * sdx) / denom;
      const u = ((oth.ax - seg.ax) * rdz - (oth.az - seg.az) * rdx) / denom;
      if (t > 0.005 && t < 0.995 && u > 0.005 && u < 0.995) {
        const ix = seg.ax + rdx * t;
        const iz = seg.az + rdz * t;
        const xNode = getOrAddNode(ix, iz, 3.0);
        splits.push({ t, nodeId: xNode });
      }
    }

    splits.sort((a, b) => a.t - b.t);
    for (let k = 0; k < splits.length - 1; k++) {
      addEdge(splits[k].nodeId, splits[k + 1].nodeId, seg.roadName, seg.isHighway);
    }
  }

  // ICM (19411 Woodfield Rd), Church of the Redeemer, ISB & 19624 Kildonan Dr corner driveway spurs
  const connectPoiSpur = (x: number, z: number, label: string) => {
    const poiNode = getOrAddNode(x, z, 2.0);
    let bestIdx = 0;
    let bestD2 = Infinity;
    let bestX = x;
    let bestZ = z;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const na = nodes[e.a];
      const nb = nodes[e.b];
      const dx = nb.x - na.x;
      const dz = nb.z - na.z;
      const l2 = dx * dx + dz * dz;
      if (l2 < 0.1) continue;
      const t = Math.max(0, Math.min(1, ((x - na.x) * dx + (z - na.z) * dz) / l2));
      const cx = na.x + dx * t;
      const cz = na.z + dz * t;
      const d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz);
      if (d2 < bestD2) {
        bestD2 = d2;
        bestIdx = i;
        bestX = cx;
        bestZ = cz;
      }
    }
    if (bestD2 < 140 * 140 && bestD2 > 4.0) {
      const e = edges[bestIdx];
      const snapNode = getOrAddNode(bestX, bestZ, 2.5);
      if (snapNode !== e.a && snapNode !== e.b) {
        addEdge(e.a, snapNode, e.roadName, e.isHighway);
        addEdge(snapNode, e.b, e.roadName, e.isHighway);
      }
      addEdge(snapNode, poiNode, label, false);
    }
  };

  connectPoiSpur(gx(392), gz(1848), 'ICM Campus Driveway');
  connectPoiSpur(gx(428), gz(1762), 'Church of the Redeemer Driveway');
  connectPoiSpur(778, -328, 'ISB Campus Entrance');
  connectPoiSpur(gx(556), gz(1594.5), '19624 Kildonan Dr Driveway');
  const mayhill2Theta = MAYHILL_CT_ROUNDABOUT.thetaStart;
  const mayhill2DriveX = MAYHILL_CT_ROUNDABOUT.cx + Math.cos(mayhill2Theta) * (MAYHILL_CT_ROUNDABOUT.ringRadius + 5.5);
  const mayhill2DriveZ = MAYHILL_CT_ROUNDABOUT.cz + Math.sin(mayhill2Theta) * (MAYHILL_CT_ROUNDABOUT.ringRadius + 5.5);
  connectPoiSpur(mayhill2DriveX, mayhill2DriveZ, '2 Mayhill Ct Driveway');
  connectPoiSpur(MD_LANDMARKS.hadleyFarms.x, MD_LANDMARKS.hadleyFarms.z, 'Hadley Farms · Resnik ES');
  connectPoiSpur(MD_LANDMARKS.bwiAirport.x, MD_LANDMARKS.bwiAirport.z, 'BWI Airport');
  connectPoiSpur(MD_LANDMARKS.kgaiAirpark.x, MD_LANDMARKS.kgaiAirpark.z, 'KGAI Airpark');
  for (const h of CITY_HEIST_TARGETS_CATALOG) {
    connectPoiSpur(h.x, h.z, h.name);
  }
  for (const house of CITY_HOUSES_CATALOG) {
    connectPoiSpur(house.x, house.z, house.name);
  }
  for (const sp of CITY_SPORTS_CATALOG) {
    connectPoiSpur(sp.x, sp.z, sp.shortLabel);
  }
  for (const svc of CITY_SERVICE_STATIONS) {
    connectPoiSpur(svc.x, svc.z, svc.name);
  }

  const adj: { to: number; dist: number; roadName: string; isHighway: boolean }[][] = nodes.map(() => []);
  for (const e of edges) {
    adj[e.a].push({ to: e.b, dist: e.len, roadName: e.roadName, isHighway: e.isHighway });
    adj[e.b].push({ to: e.a, dist: e.len, roadName: e.roadName, isHighway: e.isHighway });
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
function classifyTurnAngle(
  inUx: number,
  inUz: number,
  outUx: number,
  outUz: number
): GpsManeuverType {
  const dot = Math.max(-1, Math.min(1, inUx * outUx + inUz * outUz));
  const cross = inUx * outUz - inUz * outUx;
  if (dot > 0.90) return 'straight';
  if (dot < -0.58) return 'uturn';
  if (cross < 0) {
    return dot > 0.55 ? 'slight_left' : 'left';
  }
  return dot > 0.55 ? 'slight_right' : 'right';
}

function getEdgeRoadNameAt(x: number, z: number): string {
  const graph = getMarylandRoadGraph();
  const proj = projectPointToRoadGraph(x, z);
  return graph.edges[proj.edgeIdx]?.roadName || 'Maryland Hwy';
}

export function computeCityGpsRouteDetailed(
  startX: number,
  startZ: number,
  destX: number,
  destZ: number,
  playerHeading?: number
): DetailedCityGpsRoute {
  const graph = getMarylandRoadGraph();
  const baseCount = graph.nodes.length;
  const sProj = projectPointToRoadGraph(startX, startZ);
  const dProj = projectPointToRoadGraph(destX, destZ);
  const currentRoadName = graph.edges[sProj.edgeIdx]?.roadName || 'Local Road';

  const sId = baseCount;
  const dId = baseCount + 1;
  const totalNodes = baseCount + 2;

  const extraAdj: { to: number; dist: number }[][] = Array.from({ length: totalNodes }, (_, idx) =>
    idx < baseCount ? graph.adj[idx].map((a) => ({ to: a.to, dist: a.dist })) : []
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
    const directDist = Math.round(Math.hypot(destX - startX, destZ - startZ));
    return {
      points: [
        { x: startX, z: startZ },
        { x: destX, z: destZ },
      ],
      totalRouteMeters: directDist,
      currentRoadName,
      nextRoadName: currentRoadName,
      thenInstruction: 'Arrive at destination',
      distToTurnMeters: directDist,
      maneuver: directDist < 28 ? 'arrive' : 'straight',
      turnInstruction: `Proceed ${directDist}m`,
    };
  }

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

  // Sum exact route distance along road polyline
  let totalRouteMeters = 0;
  for (let i = 0; i < simplified.length - 1; i++) {
    totalRouteMeters += Math.hypot(
      simplified[i + 1].x - simplified[i].x,
      simplified[i + 1].z - simplified[i].z
    );
  }
  totalRouteMeters = Math.round(totalRouteMeters);

  // Determine maneuver, turn distance, street name, and follow-up "Then" instruction
  let maneuver: GpsManeuverType = totalRouteMeters < 32 ? 'arrive' : 'straight';
  let distToTurnMeters = totalRouteMeters;
  let nextRoadName = currentRoadName;
  let thenInstruction = '';

  if (simplified.length >= 2 && maneuver !== 'arrive') {
    // Skip any off-road perpendicular curb/driveway snap segment (start -> sProj) when inspecting road travel heading
    const idxRoadStart =
      simplified.length >= 3 &&
      Math.hypot(simplified[0].x - startX, simplified[0].z - startZ) < 1.0 &&
      Math.hypot(simplified[1].x - sProj.x, simplified[1].z - sProj.z) < 3.0
        ? 1
        : 0;
    const segOrigin = simplified[idxRoadStart];
    const segNext = simplified[Math.min(simplified.length - 1, idxRoadStart + 1)];
    const roadDx = segNext.x - segOrigin.x;
    const roadDz = segNext.z - segOrigin.z;
    const roadSegLen = Math.max(0.001, Math.hypot(roadDx, roadDz));
    const inUx = roadDx / roadSegLen;
    const inUz = roadDz / roadSegLen;

    // Only advise U-turn when already near road centerline on a street/highway and sharply facing opposite travel direction (>130 deg)
    let headingIsReversed = false;
    const isShortSpur = currentRoadName.includes('Driveway') || currentRoadName.includes('Entrance');
    if (playerHeading !== undefined && !isShortSpur && sProj.dist < 14 && roadSegLen > 14) {
      const fwdX = -Math.sin(playerHeading);
      const fwdZ = -Math.cos(playerHeading);
      if (fwdX * inUx + fwdZ * inUz < -0.65) {
        headingIsReversed = true;
      }
    }

    if (headingIsReversed) {
      maneuver = 'uturn';
      distToTurnMeters = Math.round(roadSegLen);
      nextRoadName = currentRoadName;
      thenInstruction = `Head toward ${currentRoadName}`;
    } else if (simplified.length >= idxRoadStart + 3) {
      // Find first genuine intersection turn (ignoring curve bends along the exact same road unless sharp hairpin)
      let accumDist = Math.hypot(segNext.x - simplified[0].x, segNext.z - simplified[0].z);
      let foundTurnIdx = -1;
      for (let i = idxRoadStart + 1; i < simplified.length - 1; i++) {
        const ax = simplified[i].x - simplified[i - 1].x;
        const az = simplified[i].z - simplified[i - 1].z;
        const bx = simplified[i + 1].x - simplified[i].x;
        const bz = simplified[i + 1].z - simplified[i].z;
        const la = Math.max(0.001, Math.hypot(ax, az));
        const lb = Math.max(0.001, Math.hypot(bx, bz));
        const dot = (ax * bx + az * bz) / (la * lb);
        if (dot < 0.86) {
          const prevRoad = getEdgeRoadNameAt(
            (simplified[i - 1].x + simplified[i].x) * 0.5,
            (simplified[i - 1].z + simplified[i].z) * 0.5
          );
          const candRoad = getEdgeRoadNameAt(
            (simplified[i].x + simplified[i + 1].x) * 0.5,
            (simplified[i].z + simplified[i + 1].z) * 0.5
          );
          if (candRoad !== prevRoad || dot < 0.35) {
            foundTurnIdx = i;
            break;
          }
        }
        accumDist += lb;
      }

      if (foundTurnIdx !== -1) {
        const pPrev = simplified[foundTurnIdx - 1];
        const pTurn = simplified[foundTurnIdx];
        const pNext = simplified[foundTurnIdx + 1];
        const aLen = Math.max(0.001, Math.hypot(pTurn.x - pPrev.x, pTurn.z - pPrev.z));
        const bLen = Math.max(0.001, Math.hypot(pNext.x - pTurn.x, pNext.z - pTurn.z));
        maneuver = classifyTurnAngle(
          (pTurn.x - pPrev.x) / aLen,
          (pTurn.z - pPrev.z) / aLen,
          (pNext.x - pTurn.x) / bLen,
          (pNext.z - pTurn.z) / bLen
        );
        distToTurnMeters = Math.round(accumDist);
        nextRoadName = getEdgeRoadNameAt(
          (pTurn.x + pNext.x) * 0.5,
          (pTurn.z + pNext.z) * 0.5
        );
        if (foundTurnIdx + 2 < simplified.length) {
          const pAfter = simplified[foundTurnIdx + 2];
          const cLen = Math.max(0.001, Math.hypot(pAfter.x - pNext.x, pAfter.z - pNext.z));
          const nextMan = classifyTurnAngle(
            (pNext.x - pTurn.x) / bLen,
            (pNext.z - pTurn.z) / bLen,
            (pAfter.x - pNext.x) / cLen,
            (pAfter.z - pNext.z) / cLen
          );
          const afterRoad = getEdgeRoadNameAt(
            (pNext.x + pAfter.x) * 0.5,
            (pNext.z + pAfter.z) * 0.5
          );
          if (nextMan === 'left' || nextMan === 'slight_left') {
            thenInstruction = `Then turn left onto ${afterRoad}`;
          } else if (nextMan === 'right' || nextMan === 'slight_right') {
            thenInstruction = `Then turn right onto ${afterRoad}`;
          }
        }
      } else {
        maneuver = 'straight';
        distToTurnMeters = totalRouteMeters;
        nextRoadName = getEdgeRoadNameAt(
          (segOrigin.x + segNext.x) * 0.5,
          (segOrigin.z + segNext.z) * 0.5
        );
      }
    } else {
      nextRoadName = getEdgeRoadNameAt(
        (segOrigin.x + segNext.x) * 0.5,
        (segOrigin.z + segNext.z) * 0.5
      );
    }
  }

  let turnInstruction = `Continue on ${nextRoadName}`;
  if (maneuver === 'arrive') {
    turnInstruction = 'Destination ahead';
  } else if (maneuver === 'uturn') {
    turnInstruction = `Make U-turn · ${nextRoadName}`;
  } else if (maneuver === 'left') {
    turnInstruction = `Turn left onto ${nextRoadName}`;
  } else if (maneuver === 'slight_left') {
    turnInstruction = `Keep left onto ${nextRoadName}`;
  } else if (maneuver === 'right') {
    turnInstruction = `Turn right onto ${nextRoadName}`;
  } else if (maneuver === 'slight_right') {
    turnInstruction = `Keep right onto ${nextRoadName}`;
  }

  return {
    points: simplified,
    totalRouteMeters,
    currentRoadName,
    nextRoadName,
    thenInstruction,
    distToTurnMeters,
    maneuver,
    turnInstruction,
  };
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
  return computeCityGpsRouteDetailed(startX, startZ, destX, destZ).points;
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
      id: 'gps_icm_basketball',
      label: 'ICM Outdoor Basketball Court',
      address: '19411 Woodfield Rd · ICM Campus, Gaithersburg, MD',
      category: 'STADIUM',
      icon: '🏀',
      x: MD_LANDMARKS.icmBasketballCourt.x,
      z: MD_LANDMARKS.icmBasketballCourt.z,
      color: '#f97316',
    },
    {
      id: 'gps_gaithersburg_golf',
      label: 'Gaithersburg Country Club Golf Field',
      address: 'Redland Rd & Norbeck Links, Gaithersburg, MD',
      category: 'STADIUM',
      icon: '⛳',
      x: MD_LANDMARKS.gaithersburgGolfField.x,
      z: MD_LANDMARKS.gaithersburgGolfField.z,
      color: '#22c55e',
    },
    {
      id: 'gps_bohrer_baseball',
      label: 'Bohrer Park Baseball Diamond',
      address: '506 S Frederick Ave · Bohrer Park, Gaithersburg, MD',
      category: 'STADIUM',
      icon: '⚾',
      x: MD_LANDMARKS.bohrerBaseballField.x,
      z: MD_LANDMARKS.bohrerBaseballField.z,
      color: '#eab308',
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
      id: 'gps_emory_woods',
      label: 'Emory Grove & Emory Woods Ct',
      address: '9408 Emory Grove Rd, Gaithersburg, MD',
      category: 'STREET',
      icon: '🏡',
      x: gx(255),
      z: gz(1868),
      color: '#34d399',
    },
    {
      id: 'gps_bohrer_football',
      label: 'Bohrer Park Gridiron Football Stadium',
      address: '512 S Frederick Ave · Gridiron Stadium, Gaithersburg, MD',
      category: 'STADIUM',
      icon: '🏈',
      x: MD_LANDMARKS.bohrerFootballField.x,
      z: MD_LANDMARKS.bohrerFootballField.z,
      color: '#dc2626',
    },
    {
      id: 'gps_ravens_stadium',
      label: 'M&T Bank Ravens Football Stadium (Baltimore)',
      address: '1101 Russell St, Baltimore, MD',
      category: 'STADIUM',
      icon: '🏈',
      x: 1132,
      z: -6,
      color: '#7c3aed',
    },
    {
      id: 'gps_bohrer_soccer',
      label: 'Bohrer Park Turf Soccer Pitch',
      address: '506 S Frederick Ave · South Turf Field, Gaithersburg, MD',
      category: 'STADIUM',
      icon: '⚽',
      x: MD_LANDMARKS.bohrerSoccerField.x,
      z: MD_LANDMARKS.bohrerSoccerField.z,
      color: '#10b981',
    },
    {
      id: 'gps_rio_bowling',
      label: 'Downtown Crown Neon Bowling Lanes',
      address: 'Crown Park Ave & Washingtonian Blvd, Gaithersburg, MD',
      category: 'ARCADE',
      icon: '🎳',
      x: MD_LANDMARKS.rioBowlingArcade.x,
      z: MD_LANDMARKS.rioBowlingArcade.z,
      color: '#a855f7',
    },
    {
      id: 'gps_dave_and_busters',
      label: "Dave & Buster's RIO Arcade & Grill",
      address: '9811 Washingtonian Blvd · RIO Center, Gaithersburg, MD',
      category: 'ARCADE',
      icon: '🕹️',
      x: MD_LANDMARKS.daveAndBusters.x,
      z: MD_LANDMARKS.daveAndBusters.z,
      color: '#f97316',
    },
    {
      id: 'gps_chuck_e_cheese',
      label: "Chuck E. Cheese's Lakeforest Fun Center",
      address: '700 N Frederick Ave · Lakeforest Plaza, Gaithersburg, MD',
      category: 'ARCADE',
      icon: '🍕',
      x: MD_LANDMARKS.chuckECheese.x,
      z: MD_LANDMARKS.chuckECheese.z,
      color: '#a855f7',
    },
    {
      id: 'gps_rio_fishing',
      label: 'RIO Lakefront Boardwalk Fishing Pier',
      address: '9841 Washingtonian Blvd · RIO Pier, Gaithersburg, MD',
      category: 'WATERFRONT',
      icon: '🎣',
      x: MD_LANDMARKS.rioFishingPier.x,
      z: MD_LANDMARKS.rioFishingPier.z,
      color: '#06b6d4',
    },
    {
      id: 'gps_annapolis_fishing',
      label: 'Annapolis City Dock Crab & Bass Pier',
      address: '1 Dock St · Ego Alley, Annapolis, MD',
      category: 'WATERFRONT',
      icon: '🦀',
      x: MD_LANDMARKS.annapolisFishingDock.x,
      z: MD_LANDMARKS.annapolisFishingDock.z,
      color: '#0ea5e9',
    },
    {
      id: 'gps_woodfield_shell',
      label: 'Woodfield Shell & Nitro Pit Stop',
      address: '19300 Woodfield Rd, Gaithersburg, MD',
      category: 'SERVICE',
      icon: '⛽',
      x: gx(448),
      z: gz(1760),
      color: '#22d3ee',
    },
    {
      id: 'gps_rio_car_meet',
      label: 'RIO & Crown Lakefront Car Meet',
      address: 'Washingtonian Blvd Promenade, Gaithersburg, MD',
      category: 'EVENT',
      icon: '🏁',
      x: gx(-378),
      z: gz(2285),
      color: '#f59e0b',
    },
    {
      id: 'gps_19624_kildonan',
      label: '19624 Kildonan Dr (Edinburgh Village Corner Estate)',
      address: '19624 Kildonan Dr, Gaithersburg, MD',
      category: 'RESIDENCE',
      icon: '🏡',
      x: gx(562),
      z: gz(1605),
      color: '#4ade80',
    },
    {
      id: 'gps_19625_kildonan',
      label: '19625 Kildonan Dr (Edinburgh Village)',
      address: '19625 Kildonan Dr, Gaithersburg, MD',
      category: 'RESIDENCE',
      icon: '🏡',
      x: gx(553),
      z: gz(1624),
      color: '#4ade80',
    },
    {
      id: 'gps_19626_kildonan',
      label: '19626 Kildonan Dr (Edinburgh Village)',
      address: '19626 Kildonan Dr, Gaithersburg, MD',
      category: 'RESIDENCE',
      icon: '🏡',
      x: gx(591),
      z: gz(1604),
      color: '#4ade80',
    },
    {
      id: 'gps_19627_kildonan',
      label: '19627 Kildonan Dr (Edinburgh Village)',
      address: '19627 Kildonan Dr, Gaithersburg, MD',
      category: 'RESIDENCE',
      icon: '🏡',
      x: gx(585),
      z: gz(1624),
      color: '#4ade80',
    },
    {
      id: 'gps_2_mayhill_ct',
      label: '2 Mayhill Ct (Hadley Farms Roundabout)',
      address: '2 Mayhill Ct, Hadley Farms, Gaithersburg, MD',
      category: 'RESIDENCE',
      icon: '🏡',
      x: Math.round(
        MAYHILL_CT_ROUNDABOUT.cx +
          Math.cos(MAYHILL_CT_ROUNDABOUT.thetaStart) * (MAYHILL_CT_ROUNDABOUT.ringRadius + 5.5)
      ),
      z: Math.round(
        MAYHILL_CT_ROUNDABOUT.cz +
          Math.sin(MAYHILL_CT_ROUNDABOUT.thetaStart) * (MAYHILL_CT_ROUNDABOUT.ringRadius + 5.5)
      ),
      color: '#22c55e',
    },
    {
      id: 'gps_brenish_dr',
      label: 'Brenish Dr (Edinburgh Village)',
      address: '7418 Brenish Dr, Gaithersburg, MD',
      category: 'STREET',
      icon: '🏡',
      x: gx(556),
      z: gz(1692),
      color: '#4ade80',
    },
    {
      id: 'gps_tarfside',
      label: 'Tarfside Ln Cul-de-Sac (Edinburgh Village)',
      address: '7408 Tarfside Ln, Gaithersburg, MD',
      category: 'STREET',
      icon: '🏡',
      x: gx(574),
      z: gz(1736),
      color: '#4ade80',
    },
    {
      id: 'gps_kilcreggan_way',
      label: 'Kilcreggan Way (Edinburgh Village)',
      address: '19540 Kilcreggan Way, Gaithersburg, MD',
      category: 'STREET',
      icon: '🏡',
      x: gx(620),
      z: gz(1692),
      color: '#4ade80',
    },
    {
      id: 'gps_kilcreggan_ter',
      label: 'Kilcreggan Ter (Edinburgh Village)',
      address: '7408 Kilcreggan Ter, Gaithersburg, MD',
      category: 'STREET',
      icon: '🏡',
      x: gx(706),
      z: gz(1800),
      color: '#4ade80',
    },
    {
      id: 'gps_cliff_pine_dr',
      label: 'Cliff Pine Dr & Barcellona Dr (Hadley Farms North)',
      address: '7124 Cliff Pine Dr, Gaithersburg, MD',
      category: 'STREET',
      icon: '🏡',
      x: gx(640),
      z: gz(1084),
      color: '#22c55e',
    },
    {
      id: 'gps_cinnabar_ter',
      label: 'Cinnabar Ter & Elioak Ter (Hadley Farms East)',
      address: '7428 Cinnabar Ter, Gaithersburg, MD',
      category: 'STREET',
      icon: '🏡',
      x: gx(640),
      z: gz(1312),
      color: '#22c55e',
    },
    {
      id: 'gps_mayhill_ter',
      label: 'Mayhill Ter & Tygart Ln (Hadley Farms West)',
      address: '19724 Mayhill Ter, Gaithersburg, MD',
      category: 'STREET',
      icon: '🏡',
      x: gx(300),
      z: gz(1312),
      color: '#22c55e',
    },
    {
      id: 'gps_whetstone_dr',
      label: 'Whetstone Dr (Montgomery Village)',
      address: '9726 Whetstone Dr, Gaithersburg, MD',
      category: 'STREET',
      icon: '🏡',
      x: gx(-120),
      z: gz(1560),
      color: '#34d399',
    },
    {
      id: 'gps_flower_hill_way',
      label: 'Flower Hill Way Neighborhood',
      address: '18426 Flower Hill Way, Gaithersburg, MD',
      category: 'STREET',
      icon: '🏡',
      x: gx(320),
      z: gz(2275),
      color: '#34d399',
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

let registeredSuburbanGpsEntries: MarylandGpsEntry[] = [];

function inferNeighborhoodKeywords(streetOrAddress: string): string {
  const s = streetOrAddress.toLowerCase();
  if (
    /mayhill|cliff pine|barcellona|torran rocks|cinnabar|elioak|electra|harkness|filbert|boxberry|tygart|mattingly|midas|hadley farms/.test(
      s
    )
  ) {
    return 'hadley farms gaithersburg md';
  }
  if (/kildonan|brenish|tarfside|kilcreggan/.test(s)) {
    return 'edinburgh village montgomery village gaithersburg md';
  }
  if (/whetstone|goshen|emory|flower hill|snouffer|redland|airpark/.test(s)) {
    return 'gaithersburg md';
  }
  return 'maryland md';
}

export function clearSuburbanGpsEntries() {
  registeredSuburbanGpsEntries = [];
}

export function registerSuburbanGpsEntries(houses: BuiltSuburbanHouse[]) {
  const mapped: MarylandGpsEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < houses.length; i++) {
    const h = houses[i];
    if (!h.address) continue;
    const rawAddr = h.address.trim();
    const parenMatch = rawAddr.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const streetPart = parenMatch ? parenMatch[1].trim() : rawAddr;
    const cityPart = parenMatch ? `${parenMatch[2].trim()}, MD` : 'Gaithersburg, MD';
    const key = streetPart.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const extraKw = inferNeighborhoodKeywords(rawAddr);
    mapped.push({
      id: `gps_sub_${i}_${key.replace(/[^a-z0-9]+/g, '_')}`,
      label: streetPart,
      address: `${streetPart}, ${cityPart}`,
      category: 'RESIDENCE',
      icon: '🏡',
      x: Math.round(h.drivewayTarget.x),
      z: Math.round(h.drivewayTarget.z),
      color: /mayhill|hadley/i.test(rawAddr) ? '#22c55e' : '#4ade80',
      keywords: `${streetPart} ${cityPart} ${extraKw} residence house home`.toLowerCase(),
    });
  }
  registeredSuburbanGpsEntries = mapped;
}

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
 * Snaps any world point (e.g. minimap drop-pin or Google Maps projection) to the nearest
 * drivable Maryland road centerline if it sits far off-road in unmapped terrain or water.
 */
export function snapWorldPointToNearestRoad(
  px: number,
  pz: number,
  maxOffRoadDist = 42
): { x: number; z: number; snapped: boolean; roadName: string; dist: number } {
  let bestDistSq = Infinity;
  let bestX = px;
  let bestZ = pz;
  let bestRoadName = 'Maryland Road';

  for (let rIdx = 0; rIdx < ALL_MARYLAND_ROADS.length; rIdx++) {
    const road = ALL_MARYLAND_ROADS[rIdx];
    for (let i = 0; i < road.points.length - 1; i++) {
      const a = road.points[i];
      const b = road.points[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l2 = dx * dx + dz * dz;
      if (l2 < 0.001) continue;
      const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / l2));
      const cx = a.x + dx * t;
      const cz = a.z + dz * t;
      const dSq = (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestX = cx;
        bestZ = cz;
        bestRoadName = road.name;
      }
    }
    if (road.culDeSacEndRadius && road.points.length > 0) {
      const endPt = road.points[road.points.length - 1];
      const dSq = (px - endPt.x) * (px - endPt.x) + (pz - endPt.z) * (pz - endPt.z);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestX = endPt.x;
        bestZ = endPt.z;
        bestRoadName = road.name;
      }
    }
  }

  const dist = Math.sqrt(bestDistSq);
  if (isOnMarylandPavedSurface(px, pz) || dist <= maxOffRoadDist) {
    return {
      x: Math.round(px),
      z: Math.round(pz),
      snapped: false,
      roadName: bestRoadName,
      dist,
    };
  }

  return {
    x: Math.round(bestX),
    z: Math.round(bestZ),
    snapped: true,
    roadName: bestRoadName,
    dist,
  };
}

function getCombinedGpsDirectory(): MarylandGpsEntry[] {
  if (registeredSuburbanGpsEntries.length === 0) {
    return STATIC_MARYLAND_GPS_ENTRIES;
  }
  const combined: MarylandGpsEntry[] = [];
  const seenKeys = new Set<string>();
  const normKey = (e: MarylandGpsEntry) =>
    `${e.label.toLowerCase().replace(/\s+/g, ' ').trim()}|${e.address.split(',')[0].toLowerCase().replace(/\s+/g, ' ').trim()}`;

  // Prioritize dynamically registered built suburban houses for exact driveway targeting
  for (const e of registeredSuburbanGpsEntries) {
    const k = e.label.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seenKeys.has(k)) {
      seenKeys.add(k);
      combined.push(e);
    }
  }
  for (const e of STATIC_MARYLAND_GPS_ENTRIES) {
    const addrHead = e.address.split(',')[0].toLowerCase().replace(/\s+/g, ' ').trim();
    const k = normKey(e);
    if (!seenKeys.has(addrHead) && !seenKeys.has(k)) {
      seenKeys.add(k);
      combined.push(e);
    }
  }
  return combined;
}

/**
 * Searches all Maryland landmarks, heist targets, houses, neighborhoods, and road polylines
 * (including typed street-number + road queries like "19624 Kildonan Dr" or "2 Mayhill Ct").
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

  const directory = getCombinedGpsDirectory();
  const results: { score: number; entry: MarylandGpsEntry }[] = [];
  const matchedExactStreetAndNum = new Set<string>();

  // 1. Score exact & partial matches across all built suburban homes + static curated POIs
  for (const entry of directory) {
    const addrLower = entry.address.toLowerCase();
    const labelLower = entry.label.toLowerCase();
    const entryNumMatch =
      labelLower.match(/^\s*(\d{1,6})\b/) || addrLower.match(/^\s*(\d{1,6})\b/);
    const entryHouseNum = entryNumMatch ? Number(entryNumMatch[1]) : null;
    const allStreetTokensMatch =
      tokens.length > 0 && tokens.every((tok) => entry.keywords.includes(tok));
    let score = 0;

    if (addrLower.startsWith(lower) || labelLower.startsWith(lower)) {
      score += 120;
    } else if (addrLower.includes(lower) || labelLower.includes(lower)) {
      score += 80;
    } else if (allStreetTokensMatch) {
      score += 55;
    }

    if (
      houseNumber === null &&
      score > 0 &&
      entry.category !== 'RESIDENCE' &&
      entry.category !== 'STREET'
    ) {
      score += 25;
    }

    if (houseNumber !== null && entryHouseNum !== null && allStreetTokensMatch) {
      if (entryHouseNum === houseNumber) {
        score += 140;
        matchedExactStreetAndNum.add(`${houseNumber}:${streetPart}`);
      } else {
        score += Math.max(0, 24 - Math.min(24, Math.abs(entryHouseNum - houseNumber)));
      }
    }

    if (score > 0) {
      results.push({ score, entry });
    }
  }

  // 2. Match ANY road in ALL_MARYLAND_ROADS (synthesizing coordinates if house # not explicitly built)
  for (const road of ALL_MARYLAND_ROADS) {
    const rName = road.name.toLowerCase();
    const roadMatches =
      rName.includes(streetPart) ||
      (tokens.length > 0 && tokens.every((tok) => rName.includes(tok)));
    if (!roadMatches) continue;

    if (houseNumber !== null && matchedExactStreetAndNum.has(`${houseNumber}:${streetPart}`)) {
      continue;
    }

    let pt: { x: number; z: number } | null = null;
    if (houseNumber !== null && registeredSuburbanGpsEntries.length > 0) {
      const sameStreetNums: { num: number; x: number; z: number }[] = [];
      for (const e of registeredSuburbanGpsEntries) {
        const m = e.label.toLowerCase().match(/^\s*(\d{1,6})\s+(.+)$/);
        if (!m) continue;
        const eStreet = m[2].trim();
        if (tokens.every((tok) => eStreet.includes(tok))) {
          sameStreetNums.push({ num: Number(m[1]), x: e.x, z: e.z });
        }
      }
      if (sameStreetNums.length >= 2) {
        sameStreetNums.sort((a, b) => a.num - b.num);
        const clampedFirst = sameStreetNums[0];
        const clampedLast = sameStreetNums[sameStreetNums.length - 1];
        if (houseNumber <= clampedFirst.num) {
          pt = { x: clampedFirst.x, z: clampedFirst.z };
        } else if (houseNumber >= clampedLast.num) {
          pt = { x: clampedLast.x, z: clampedLast.z };
        } else {
          for (let i = 0; i < sameStreetNums.length - 1; i++) {
            const a = sameStreetNums[i];
            const b = sameStreetNums[i + 1];
            if (houseNumber >= a.num && houseNumber <= b.num) {
              const span = Math.max(1, b.num - a.num);
              const t = (houseNumber - a.num) / span;
              pt = {
                x: Math.round(a.x + (b.x - a.x) * t),
                z: Math.round(a.z + (b.z - a.z) * t),
              };
              break;
            }
          }
        }
      } else if (sameStreetNums.length === 1) {
        pt = { x: sameStreetNums[0].x, z: sameStreetNums[0].z };
      }
    }

    if (!pt) {
      const blockFrac =
        houseNumber !== null
          ? Math.max(0.08, Math.min(0.92, ((houseNumber % 100) / 100) * 0.8 + 0.1))
          : 0.5;
      pt = interpolateRoadPolylinePoint(road.points, blockFrac);
    }

    const displayAddr =
      houseNumber !== null ? `${houseNumber} ${road.name}` : road.name;

    results.push({
      score: houseNumber !== null ? 92 : 42,
      entry: {
        id: `gps_road_${road.id}_${houseNumber ?? 'mid'}`,
        label: displayAddr,
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
  const maxSegments = 180;
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

  // Always hide native open-wheel F1 children in City Mode while keeping sparksPoints, offroadSprayPoints & tireSmokePoints
  playerCar.root.children.forEach((child) => {
    if (
      child === playerCar.sparksPoints ||
      child === playerCar.offroadSprayPoints ||
      child === playerCar.tireSmokePoints
    ) {
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

  const gfxPreset = getGraphicsPresetConfig();
  const isRetro = gfxPreset.id === 'retro' || gfxPreset.id === 'retro_pixel';
  const isFastMat = isRetro || gfxPreset.id === 'low' || gfxPreset.id === 'dynamic_conservative';

  const paintColor = new THREE.Color(customColorHex || spec.defaultColor);
  const accentColor = new THREE.Color(effective.accentColor);

  const bodyMat: THREE.Material = isFastMat
    ? new THREE.MeshLambertMaterial({ color: paintColor, flatShading: isRetro })
    : new THREE.MeshPhysicalMaterial({
        color: paintColor,
        normalMap: getCarPaintFlakeNormalTexture(),
        normalScale: new THREE.Vector2(0.015, 0.015),
        metalness: 0.68,
        roughness: 0.14,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        ior: 1.52,
        reflectivity: 1.0,
        envMapIntensity: 1.78,
      });
  const accentMat: THREE.Material = isFastMat
    ? new THREE.MeshLambertMaterial({ color: accentColor, flatShading: isRetro })
    : new THREE.MeshPhysicalMaterial({
        color: accentColor,
        metalness: 0.68,
        roughness: 0.15,
        clearcoat: 0.96,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.55,
      });
  const glassMat: THREE.Material = isFastMat
    ? new THREE.MeshLambertMaterial({ color: 0x0a1120, flatShading: isRetro })
    : new THREE.MeshPhysicalMaterial({
        color: 0x05080f,
        metalness: 0.2,
        roughness: 0.025,
        clearcoat: 1.0,
        clearcoatRoughness: 0.012,
        reflectivity: 1.0,
        envMapIntensity: 1.9,
      });
  const carbonMat: THREE.Material = isFastMat
    ? new THREE.MeshLambertMaterial({ color: 0x16181d, flatShading: isRetro })
    : new THREE.MeshPhysicalMaterial({
        color: 0x121316,
        metalness: 0.45,
        roughness: 0.28,
        clearcoat: 0.68,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.25,
      });
  const darkGrilleMat: THREE.Material = isFastMat
    ? new THREE.MeshLambertMaterial({ color: 0x0a0a0e })
    : new THREE.MeshStandardMaterial({
        color: 0x060608,
        metalness: 0.32,
        roughness: 0.65,
      });
  const chromeMat: THREE.Material = isFastMat
    ? new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
    : new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        metalness: 0.96,
        roughness: 0.08,
        envMapIntensity: 1.65,
      });
  const goldMat: THREE.Material = isFastMat
    ? new THREE.MeshLambertMaterial({ color: 0xfbbf24 })
    : new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        metalness: 0.95,
        roughness: 0.11,
        envMapIntensity: 1.6,
      });
  const rotorMat: THREE.Material = isFastMat
    ? new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
    : new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.88,
        roughness: 0.24,
      });
  const headMat: HeadlightLensMaterial = isFastMat
    ? new THREE.MeshLambertMaterial({
        color: 0xf4f8ff,
        emissive: new THREE.Color(0xeef6ff),
        emissiveIntensity: 0.12,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xf4f8ff,
        emissive: new THREE.Color(0xeef6ff),
        emissiveIntensity: 0.12,
        roughness: 0.12,
        metalness: 0.15,
        toneMapped: false,
      });
  const yellowDrlMat: THREE.Material = isFastMat
    ? new THREE.MeshBasicMaterial({ color: 0xfef08a })
    : new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: new THREE.Color(0xfacc15),
        emissiveIntensity: 1.4,
        roughness: 0.18,
        toneMapped: false,
      });
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const brakeMat =
    (playerCar.tailLight.material as THREE.MeshBasicMaterial) ||
    new THREE.MeshBasicMaterial({ color: 0xff1e1e });

  // Build sculpted real-world automotive body + signature lights/grilles/wings/wheels
  const dim = buildSculptedStreetCarBody(overlay, archetype, trim.id, trim.aeroStyle, {
    bodyMat,
    accentMat,
    glassMat,
    carbonMat,
    darkGrilleMat,
    chromeMat,
    goldMat,
    rotorMat,
    headMat,
    yellowDrlMat,
    amberMat,
    brakeMat,
    leftAmberMat: new THREE.MeshBasicMaterial({ color: 0x2b1504 }),
    rightAmberMat: new THREE.MeshBasicMaterial({ color: 0x2b1504 }),
  });

  const carWidth = dim.width;
  const carLen = dim.length;
  const lowerH = dim.lowerH;
  const cabinH = dim.cabinH;
  const cabinZ = dim.cabinZ;
  const baseChassisY = dim.baseY;
  const frontZ = -carLen * 0.49;
  const rearZ = carLen * 0.49;

  // 4. Functional Front & Rear Amber Turn Signal Lenses + Brake Light Connectors
  const { key: sculptKey } = resolveStreetCarSilhouette(archetype, trim.id, trim.aeroStyle);
  const leftAmberMat = new THREE.MeshBasicMaterial({ color: 0x2b1504 });
  const rightAmberMat = new THREE.MeshBasicMaterial({ color: 0x2b1504 });

  const fSigPosL = evalFasciaAnchor(sculptKey, dim, -1, 0.84, 0.72, 'front');
  const frontSigL = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.048, 0.045), leftAmberMat);
  frontSigL.rotation.y = fSigPosL.yaw;
  frontSigL.position.set(fSigPosL.x, fSigPosL.y, fSigPosL.z + 0.008);
  overlay.add(frontSigL);

  const fSigPosR = evalFasciaAnchor(sculptKey, dim, 1, 0.84, 0.72, 'front');
  const frontSigR = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.048, 0.045), rightAmberMat);
  frontSigR.rotation.y = fSigPosR.yaw;
  frontSigR.position.set(fSigPosR.x, fSigPosR.y, fSigPosR.z + 0.008);
  overlay.add(frontSigR);

  const rSigPosL = evalFasciaAnchor(sculptKey, dim, -1, 0.83, 0.72, 'rear');
  const rearSigL = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.055, 0.045), leftAmberMat);
  rearSigL.rotation.y = rSigPosL.yaw;
  rearSigL.position.set(rSigPosL.x, rSigPosL.y, rSigPosL.z);
  overlay.add(rearSigL);

  const rSigPosR = evalFasciaAnchor(sculptKey, dim, 1, 0.83, 0.72, 'rear');
  const rearSigR = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.055, 0.045), rightAmberMat);
  rearSigR.rotation.y = rSigPosR.yaw;
  rearSigR.position.set(rSigPosR.x, rSigPosR.y, rSigPosR.z);
  overlay.add(rearSigR);

  // 5. Emergency Police Strobe Lightbar on Roof & Grille Strobes
  const sirenRedMat = new THREE.MeshBasicMaterial({ color: 0xff1e1e });
  const sirenBlueMat = new THREE.MeshBasicMaterial({ color: 0x1d4ed8 });

  const roofBarGroup = new THREE.Group();
  roofBarGroup.name = 'police_roof_bar';
  // Elevate lightbar directly atop the sculpted vehicle greenhouse roof
  const actualRoofY = baseChassisY + lowerH * 0.90 + cabinH + 0.03;
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

  // Functional 3D Player Headlights (SpotLight + front bounce fill + volumetric beam cones)
  const playerHeadlightRig = attachPlayerHeadlightRig(
    overlay,
    baseChassisY + lowerH * 0.64,
    frontZ,
    carWidth * 0.34,
    headMat
  );

  // Store lighting materials, push bumper, headlights & decals for dynamic updateVehicleLighting loop
  const policeVisualPayload = {
    leftSignalMats: [leftAmberMat],
    rightSignalMats: [rightAmberMat],
    brakeMats: [brakeMat],
    sirenRedMat,
    sirenBlueMat,
    roofBarGroup,
    policePushBumper: pushBumper,
    policeDecals: [decalLeft, decalRight, hoodDecal, trunkDecal],
    playerHeadlightRig,
  };

  overlay.userData = {
    ...overlay.userData,
    ...policeVisualPayload,
  };

  playerCar.root.userData = {
    ...playerCar.root.userData,
    ...policeVisualPayload,
    streetWheelRig: overlay.userData.streetWheelRig,
  };

  playerCar.root.add(overlay);
}

/**
 * Builds a sculpted 3D Civilian Traffic Vehicle (Sedan / SUV / Sports Coupe) modeled after
 * modern aerodynamic production cars with sloping chamfered hoods, raked curved greenhouse,
 * jewel-eye projector LED headlights, side character lines, and performance alloy wheels
 */
const civBodyMatPool = new Map<string, THREE.Material>();
const civSharedMatPool = new Map<
  string,
  {
    glassMat: THREE.Material;
    trimMat: THREE.Material;
    chromeMat: THREE.Material;
    carbonMat: THREE.Material;
    drlMat: THREE.MeshBasicMaterial;
    policeBlackMat: THREE.Material;
    policeWhiteMat: THREE.Material;
    policeSteelMat: THREE.Material;
  }
>();

function getSharedTrafficMaterials() {
  const preset = getGraphicsPresetConfig();
  const isRetro = preset.id === 'retro' || preset.id === 'retro_pixel';
  const isFastMat = isRetro || preset.id === 'low' || preset.id === 'dynamic_conservative';
  const poolKey = `${isRetro ? 1 : 0}_${isFastMat ? 1 : 0}`;
  let shared = civSharedMatPool.get(poolKey);
  if (!shared) {
    shared = {
      glassMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x0a101d, flatShading: isRetro })
        : new THREE.MeshPhysicalMaterial({
            color: 0x070b14,
            roughness: 0.035,
            metalness: 0.22,
            clearcoat: 1.0,
            clearcoatRoughness: 0.02,
            envMapIntensity: 1.75,
          }),
      trimMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x18181b })
        : new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.65, metalness: 0.25 }),
      chromeMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
        : new THREE.MeshStandardMaterial({
            color: 0xf1f5f9,
            roughness: 0.08,
            metalness: 0.95,
            envMapIntensity: 1.5,
          }),
      carbonMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x111827 })
        : new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.4 }),
      drlMat: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
      policeBlackMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x0b101b, flatShading: isRetro })
        : new THREE.MeshPhysicalMaterial({
            color: 0x090d16,
            roughness: 0.18,
            metalness: 0.62,
            clearcoat: 0.95,
            clearcoatRoughness: 0.04,
            envMapIntensity: 1.55,
          }),
      policeWhiteMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0xf8fafc, flatShading: isRetro })
        : new THREE.MeshPhysicalMaterial({
            color: 0xf8fafc,
            roughness: 0.22,
            metalness: 0.3,
            clearcoat: 0.95,
            clearcoatRoughness: 0.05,
            envMapIntensity: 1.4,
          }),
      policeSteelMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x334155 })
        : new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.8 }),
    };
    civSharedMatPool.set(poolKey, shared);
  }
  return { ...shared, isRetro, isFastMat };
}

function getSharedCivBodyMat(bodyColorHex: number, isRetro: boolean, isFastMat: boolean): THREE.Material {
  const key = `${bodyColorHex}_${isRetro ? 1 : 0}_${isFastMat ? 1 : 0}`;
  let mat = civBodyMatPool.get(key);
  if (!mat) {
    mat = isFastMat
      ? new THREE.MeshLambertMaterial({ color: bodyColorHex, flatShading: isRetro })
      : new THREE.MeshPhysicalMaterial({
          color: bodyColorHex,
          roughness: 0.2,
          metalness: 0.62,
          clearcoat: 0.95,
          clearcoatRoughness: 0.04,
          envMapIntensity: 1.55,
        });
    civBodyMatPool.set(key, mat);
  }
  return mat;
}

export function buildCivilianCarMesh(bodyColorHex: number, style: 'sedan' | 'suv' | 'coupe'): BuiltCivilianCar {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const shared = getSharedTrafficMaterials();
  const bodyMat = getSharedCivBodyMat(bodyColorHex, shared.isRetro, shared.isFastMat);
  const { glassMat, trimMat, chromeMat, carbonMat, drlMat } = shared;

  const leftAmberMat = new THREE.MeshBasicMaterial({ color: 0x2b1504 });
  const rightAmberMat = new THREE.MeshBasicMaterial({ color: 0x2b1504 });
  const headMat: HeadlightLensMaterial = shared.isFastMat
    ? new THREE.MeshLambertMaterial({
        color: 0xf0fdf4,
        emissive: new THREE.Color(0xeef6ff),
        emissiveIntensity: 0.1,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xf0fdf4,
        emissive: new THREE.Color(0xeef6ff),
        emissiveIntensity: 0.1,
        roughness: 0.15,
        toneMapped: false,
      });
  const brakeLightMatL = new THREE.MeshBasicMaterial({ color: 0x660f13 });
  const brakeLightMatR = new THREE.MeshBasicMaterial({ color: 0x660f13 });

  const { dim: civDim, taillightBar, wheels: civWheels } = buildSculptedCivilianHull(
    group,
    style,
    bodyMat,
    glassMat,
    trimMat,
    chromeMat,
    carbonMat,
    headMat,
    drlMat,
    brakeLightMatL,
    brakeLightMatR,
    leftAmberMat,
    rightAmberMat
  );
  wheels.push(...civWheels);
  attachNpcHeadlightBeams(
    group,
    civDim.baseY + civDim.lowerH * 0.62,
    -civDim.length * 0.49,
    civDim.width * 0.34,
    headMat,
    13
  );

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

  const shared = getSharedTrafficMaterials();
  const blackMat = shared.policeBlackMat;
  const whiteDoorsMat = shared.policeWhiteMat;
  const glassMat = shared.glassMat;
  const steelMat = shared.policeSteelMat;
  const chromeMat = shared.chromeMat;

  const redStrobeMat = new THREE.MeshBasicMaterial({ color: 0x3b0a0a });
  const blueStrobeMat = new THREE.MeshBasicMaterial({ color: 0x0a193b });
  const headMat: HeadlightLensMaterial = shared.isFastMat
    ? new THREE.MeshLambertMaterial({
        color: 0xf4f8ff,
        emissive: new THREE.Color(0xeef6ff),
        emissiveIntensity: 0.1,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xf4f8ff,
        emissive: new THREE.Color(0xeef6ff),
        emissiveIntensity: 0.1,
        roughness: 0.15,
        toneMapped: false,
      });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  const { wheels: copWheels, dim: polDim } = buildSculptedPoliceHull(
    group,
    blackMat,
    whiteDoorsMat,
    glassMat,
    steelMat,
    chromeMat,
    headMat,
    tailMat,
    redStrobeMat,
    blueStrobeMat
  );
  wheels.push(...copWheels);
  attachNpcHeadlightBeams(
    group,
    polDim.baseY + polDim.lowerH * 0.62,
    -polDim.length * 0.49,
    polDim.width * 0.34,
    headMat,
    14
  );

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
export interface HouseExteriorProfile {
  wallColorHex: string;
  roofColorHex: string;
  style: 'starter' | 'colonial' | 'split' | 'luxury' | 'townhouse' | 'lodge' | 'coastal';
  stories: 1 | 2;
  hasGarage: boolean;
  hasPool: boolean;
  hasBasement: boolean;
}

export interface BuiltSuburbanHouse {
  group: THREE.Group;
  collider: CityBuildingBox;
  drivewayTarget: { x: number; z: number };
  drivewayCoord: { x: number; z: number };
  address: string;
  exteriorProfile?: HouseExteriorProfile;
}

function colorNumToHex(c: number): string {
  return '#' + (c & 0xffffff).toString(16).padStart(6, '0');
}

function hashAddressSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const houseSharedPool = new Map<
  string,
  {
    grassMat: THREE.Material;
    concreteMat: THREE.Material;
    stonePlinthMat: THREE.Material;
    paverMat: THREE.Material;
    whiteTrimMat: THREE.Material;
    doorMat: THREE.Material;
    glassMat: THREE.Material;
    shutterMat: THREE.Material;
    poolWaterMat: THREE.Material;
    brickChimneyMat: THREE.Material;
    shrubMat: THREE.Material;
  }
>();
const houseColorMatPool = new Map<string, THREE.Material>();

function getSharedHouseMaterials() {
  const preset = getGraphicsPresetConfig();
  const isRetroPixel = preset.id === 'retro_pixel';
  const isRetro = preset.id === 'retro' || isRetroPixel;
  const isFastMat = isRetro || preset.id === 'low' || preset.id === 'dynamic_conservative';
  const key = `${isRetroPixel ? 1 : 0}_${isFastMat ? 1 : 0}`;
  let s = houseSharedPool.get(key);
  if (!s) {
    const lawnPBR = getLawnPBRTextures(isRetroPixel, isFastMat ? 1 : 4);
    const leafTex = getLeafClusterTexture(isRetroPixel);
    s = {
      grassMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0xcbe3c2, map: lawnPBR.map })
        : new THREE.MeshStandardMaterial({
            color: 0xcbe3c2,
            map: lawnPBR.map,
            normalMap: lawnPBR.normalMap,
            normalScale: new THREE.Vector2(0.8, 0.8),
            roughness: 0.92,
            metalness: 0.0,
          }),
      concreteMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0xa4b0be })
        : new THREE.MeshStandardMaterial({ color: 0xa4b0be, roughness: 0.78, metalness: 0.04 }),
      stonePlinthMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x64748b })
        : new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, metalness: 0.04 }),
      paverMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x475569 })
        : new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.68, metalness: 0.1 }),
      whiteTrimMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0xf8fafc })
        : new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.36, metalness: 0.08 }),
      doorMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x7c2d12 })
        : new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.45, metalness: 0.1 }),
      glassMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x0b1a2d })
        : new THREE.MeshPhysicalMaterial({
            color: 0x0b1a2d,
            roughness: 0.06,
            metalness: 0.18,
            clearcoat: 1.0,
            clearcoatRoughness: 0.04,
          }),
      shutterMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x1e293b })
        : new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 }),
      poolWaterMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.85 })
        : new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.12, metalness: 0.75, transparent: true, opacity: 0.85 }),
      brickChimneyMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x881337 })
        : new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.78, metalness: 0.04 }),
      shrubMat: isFastMat
        ? new THREE.MeshLambertMaterial({ color: 0x99c47f, map: leafTex })
        : new THREE.MeshStandardMaterial({
            color: 0x99c47f,
            map: leafTex,
            roughness: 0.86,
            metalness: 0.01,
          }),
    };
    houseSharedPool.set(key, s);
  }
  return { ...s, isFastMat, shadowsEnabled: preset.shadowsEnabled };
}

function getSharedHouseColorMat(kind: 'wall' | 'roof', hex: number, isFastMat: boolean): THREE.Material {
  const key = `${kind}_${hex}_${isFastMat ? 1 : 0}`;
  let m = houseColorMatPool.get(key);
  if (!m) {
    m = isFastMat
      ? new THREE.MeshLambertMaterial({ color: hex })
      : new THREE.MeshStandardMaterial({
          color: hex,
          roughness: kind === 'roof' ? 0.8 : 0.65,
          metalness: 0.04,
        });
    houseColorMatPool.set(key, m);
  }
  return m;
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

  const hs = getSharedHouseMaterials();
  const {
    grassMat,
    concreteMat,
    stonePlinthMat,
    paverMat,
    whiteTrimMat,
    doorMat,
    glassMat,
    shutterMat,
    poolWaterMat,
    brickChimneyMat,
    shrubMat,
    isFastMat,
    shadowsEnabled,
  } = hs;
  const wallMat = getSharedHouseColorMat('wall', opts.wallColor, isFastMat);
  const roofMat = getSharedHouseColorMat('roof', opts.roofColor, isFastMat);

  const addWindowWithMullions = (wx: number, wy: number, wz: number, fw = 1.38, fh = 1.56) => {
    const wf = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.09), whiteTrimMat);
    wf.position.set(wx, wy, wz);
    group.add(wf);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.16, 0.1, 0.16), whiteTrimMat);
    sill.position.set(wx, wy - fh * 0.5 - 0.03, wz + 0.03);
    group.add(sill);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.12, 0.12, 0.14), whiteTrimMat);
    lintel.position.set(wx, wy + fh * 0.5 + 0.03, wz + 0.02);
    group.add(lintel);
    const win = new THREE.Mesh(new THREE.BoxGeometry(fw - 0.26, fh - 0.26, 0.11), glassMat);
    win.position.set(wx, wy, wz + 0.015);
    group.add(win);
    const mH = new THREE.Mesh(new THREE.BoxGeometry(fw - 0.24, 0.05, 0.13), whiteTrimMat);
    mH.position.set(wx, wy, wz + 0.02);
    group.add(mH);
    const mV = new THREE.Mesh(new THREE.BoxGeometry(0.05, fh - 0.24, 0.13), whiteTrimMat);
    mV.position.set(wx, wy, wz + 0.02);
    group.add(mV);
  };

  const addFoundationShrub = (sx: number, sz: number, r = 0.55) => {
    const sh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), shrubMat);
    sh.scale.set(1.2, 0.82, 1.05);
    sh.position.set(sx, r * 0.48, sz);
    sh.castShadow = shadowsEnabled;
    group.add(sh);
  };

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
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.02, 20), grassMat);
    lawn.position.set(0, -0.02, 0);
    lawn.receiveShadow = shadowsEnabled;
    group.add(lawn);

    const driveway = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.02, 9.0), concreteMat);
    driveway.position.set(4.6, -0.016, 5.2);
    driveway.receiveShadow = shadowsEnabled;
    group.add(driveway);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(9.35, 0.34, 8.35), stonePlinthMat);
    plinth.position.set(-2.2, 0.17, -2.2);
    group.add(plinth);

    const cottage = new THREE.Mesh(new THREE.BoxGeometry(9.2, 3.8, 8.2), wallMat);
    cottage.position.set(-2.2, 2.05, -2.2);
    cottage.castShadow = shadowsEnabled;
    cottage.receiveShadow = shadowsEnabled;
    group.add(cottage);

    const roof = buildPitchedRoofGroup(9.5, 8.5, 2.4, wallMat, roofMat, 'x');
    roof.position.set(-2.2, 3.95, -2.2);
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
    frontDoor.position.set(-2.2, 1.25, 1.94);
    group.add(frontDoor);

    for (const wx of [-4.8, 0.4]) {
      addWindowWithMullions(wx, 2.2, 1.92, 1.42, 1.42);
    }
    addFoundationShrub(-5.4, 2.45, 0.5);
    addFoundationShrub(-3.6, 2.45, 0.44);
    addFoundationShrub(-0.7, 2.45, 0.44);
    addFoundationShrub(1.1, 2.45, 0.5);

    const dLocal = new THREE.Vector3(4.6, 0, 6.0);
    dLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

    return {
      group,
      collider: makeRotatedCollider(7.4, 6.2, 6.8),
      drivewayTarget: { x: x + dLocal.x, z: z + dLocal.z },
      drivewayCoord: { x: x + dLocal.x, z: z + dLocal.z },
      address: opts.address,
      exteriorProfile: {
        wallColorHex: colorNumToHex(opts.wallColor),
        roofColorHex: colorNumToHex(opts.roofColor),
        style: 'starter',
        stories: 1,
        hasGarage: true,
        hasPool: false,
        hasBasement: false,
      },
    };
  } else if (tier === 'luxury') {
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(24, 0.02, 25), grassMat);
    lawn.position.set(0, -0.02, 0);
    lawn.receiveShadow = shadowsEnabled;
    group.add(lawn);

    const driveway = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.02, 9.6), paverMat);
    driveway.position.set(6.4, -0.016, 6.8);
    driveway.receiveShadow = shadowsEnabled;
    group.add(driveway);

    const walkPath = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.02, 9.0), paverMat);
    walkPath.position.set(-3.8, -0.016, 6.6);
    group.add(walkPath);

    const villaPlinth = new THREE.Mesh(new THREE.BoxGeometry(12.56, 0.42, 9.56), stonePlinthMat);
    villaPlinth.position.set(-3.8, 0.21, -2.5);
    group.add(villaPlinth);

    const mainVilla = new THREE.Mesh(new THREE.BoxGeometry(12.4, 6.6, 9.4), wallMat);
    mainVilla.position.set(-3.8, 3.45, -2.5);
    mainVilla.castShadow = shadowsEnabled;
    group.add(mainVilla);

    const manorRoof = buildPitchedRoofGroup(12.8, 9.8, 3.3, wallMat, roofMat, 'x');
    manorRoof.position.set(-3.8, 6.75, -2.5);
    group.add(manorRoof);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.15, 5.2, 1.3), brickChimneyMat);
    chimney.position.set(-10.3, 7.05, -2.5);
    group.add(chimney);
    const chimCap = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.26, 1.52), stonePlinthMat);
    chimCap.position.set(-10.3, 9.75, -2.5);
    group.add(chimCap);

    const portico = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.34, 2.2), whiteTrimMat);
    portico.position.set(-3.8, 3.65, 3.1);
    group.add(portico);
    const porticoPediment = buildPitchedRoofGroup(4.2, 2.2, 1.05, whiteTrimMat, roofMat, 'z');
    porticoPediment.position.set(-3.8, 3.82, 3.1);
    group.add(porticoPediment);

    for (const px of [-5.4, -2.2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 3.5, 10), whiteTrimMat);
      col.position.set(px, 1.85, 3.9);
      group.add(col);
    }
    const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.7, 0.14), doorMat);
    frontDoor.position.set(-3.8, 1.5, 2.24);
    group.add(frontDoor);

    for (const [wx, wy] of [
      [-7.6, 2.05],
      [0.0, 2.05],
      [-7.6, 4.85],
      [-3.8, 4.85],
      [0.0, 4.85],
    ] as [number, number][]) {
      addWindowWithMullions(wx, wy, 2.22, 1.46, 1.66);
    }

    const garPlinth = new THREE.Mesh(new THREE.BoxGeometry(8.16, 0.38, 7.76), stonePlinthMat);
    garPlinth.position.set(6.4, 0.19, -1.7);
    group.add(garPlinth);

    const luxuryGarage = new THREE.Mesh(new THREE.BoxGeometry(8.0, 3.8, 7.6), wallMat);
    luxuryGarage.position.set(6.4, 2.05, -1.7);
    luxuryGarage.castShadow = shadowsEnabled;
    group.add(luxuryGarage);

    const garageRoof = buildPitchedRoofGroup(8.3, 7.9, 2.1, wallMat, roofMat, 'x');
    garageRoof.position.set(6.4, 3.95, -1.7);
    group.add(garageRoof);

    for (const gxOff of [-2.4, 0, 2.4]) {
      const gDoor = new THREE.Mesh(new THREE.BoxGeometry(2.05, 2.6, 0.15), whiteTrimMat);
      gDoor.position.set(6.4 + gxOff, 1.45, 2.14);
      group.add(gDoor);
      const gGlass = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.32, 0.18), glassMat);
      gGlass.position.set(6.4 + gxOff, 2.38, 2.15);
      group.add(gGlass);
    }
    addFoundationShrub(-8.8, 2.8, 0.62);
    addFoundationShrub(-6.5, 2.8, 0.56);
    addFoundationShrub(-1.1, 2.8, 0.56);
    addFoundationShrub(1.2, 2.8, 0.62);

    const poolDeck = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.02, 4.4), paverMat);
    poolDeck.position.set(-3.8, -0.016, -9.8);
    group.add(poolDeck);

    const poolBasin = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.02, 3.0), poolWaterMat);
    poolBasin.position.set(-3.8, -0.014, -9.8);
    group.add(poolBasin);

    const dLocal = new THREE.Vector3(6.4, 0, 8.0);
    dLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

    const lowerAddr = opts.address.toLowerCase();
    const luxStyle: HouseExteriorProfile['style'] =
      lowerAddr.includes('deep creek') || lowerAddr.includes('marsh hill') || lowerAddr.includes('glendale')
        ? 'lodge'
        : lowerAddr.includes('ocean city') || lowerAddr.includes('coastal')
        ? 'coastal'
        : 'luxury';

    return {
      group,
      collider: makeRotatedCollider(10.8, 8.0, 10.5),
      drivewayTarget: { x: x + dLocal.x, z: z + dLocal.z },
      drivewayCoord: { x: x + dLocal.x, z: z + dLocal.z },
      address: opts.address,
      exteriorProfile: {
        wallColorHex: colorNumToHex(opts.wallColor),
        roofColorHex: colorNumToHex(opts.roofColor),
        style: luxStyle,
        stories: 2,
        hasGarage: true,
        hasPool: true,
        hasBasement: true,
      },
    };
  }

  // TIER 2: REGULAR FAMILY SUBURBS (2-Story Colonial, Attached 2-Car Garage)
  const lawn = new THREE.Mesh(new THREE.BoxGeometry(20, 0.02, 24), grassMat);
  lawn.position.set(0, -0.02, 0);
  lawn.receiveShadow = shadowsEnabled;
  group.add(lawn);

  const driveway = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.02, 10.0), concreteMat);
  driveway.position.set(5.4, -0.016, 6.2);
  driveway.receiveShadow = shadowsEnabled;
  group.add(driveway);

  const plinthMain = new THREE.Mesh(new THREE.BoxGeometry(10.76, 0.36, 8.96), stonePlinthMat);
  plinthMain.position.set(-2.6, 0.18, -2.5);
  group.add(plinthMain);

  const mainHouse = new THREE.Mesh(new THREE.BoxGeometry(10.6, 5.6, 8.8), wallMat);
  mainHouse.position.set(-2.6, 2.95, -2.5);
  mainHouse.castShadow = shadowsEnabled;
  group.add(mainHouse);

  const plinthGar = new THREE.Mesh(new THREE.BoxGeometry(5.96, 0.34, 7.36), stonePlinthMat);
  plinthGar.position.set(5.6, 0.17, -1.7);
  group.add(plinthGar);

  const garage = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.5, 7.2), wallMat);
  garage.position.set(5.6, 1.9, -1.7);
  garage.castShadow = shadowsEnabled;
  group.add(garage);

  const garageDoor = new THREE.Mesh(new THREE.BoxGeometry(4.7, 2.6, 0.15), whiteTrimMat);
  garageDoor.position.set(5.6, 1.45, 1.94);
  group.add(garageDoor);
  const gPane = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.34, 0.18), glassMat);
  gPane.position.set(5.6, 2.4, 1.95);
  group.add(gPane);

  const roofRidge = buildPitchedRoofGroup(11.0, 9.2, 2.9, wallMat, roofMat, 'x');
  roofRidge.position.set(-2.6, 5.75, -2.5);
  group.add(roofRidge);

  const garageRoof = buildPitchedRoofGroup(6.1, 7.5, 1.8, wallMat, roofMat, 'z');
  garageRoof.position.set(5.6, 3.65, -1.7);
  group.add(garageRoof);

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.4, 1.25), brickChimneyMat);
  chimney.position.set(-8.2, 6.25, -2.5);
  group.add(chimney);
  const chimCap = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.24, 1.45), stonePlinthMat);
  chimCap.position.set(-8.2, 8.55, -2.5);
  group.add(chimCap);

  const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.3, 0.14), doorMat);
  frontDoor.position.set(-2.6, 1.3, 1.94);
  group.add(frontDoor);

  const portico = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.24, 1.6), whiteTrimMat);
  portico.position.set(-2.6, 2.95, 2.65);
  group.add(portico);
  const porticoRoof = buildPitchedRoofGroup(3.2, 1.65, 0.85, whiteTrimMat, roofMat, 'z');
  porticoRoof.position.set(-2.6, 3.07, 2.65);
  group.add(porticoRoof);
  for (const px of [-3.8, -1.4]) {
    const pCol = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.75, 9), whiteTrimMat);
    pCol.position.set(px, 1.5, 3.25);
    group.add(pCol);
  }

  const shutterGeom = new THREE.BoxGeometry(0.38, 1.5, 0.08);
  for (const [wx, wy, wz] of [
    [-5.6, 1.75, 1.92],
    [0.4, 1.75, 1.92],
    [-5.6, 4.35, 1.92],
    [-2.6, 4.35, 1.92],
    [0.4, 4.35, 1.92],
  ] as [number, number, number][]) {
    addWindowWithMullions(wx, wy, wz, 1.36, 1.56);
    for (const sSide of [-0.92, 0.92]) {
      const sh = new THREE.Mesh(shutterGeom, shutterMat);
      sh.position.set(wx + sSide, wy, wz + 0.01);
      group.add(sh);
    }
  }
  addFoundationShrub(-6.8, 2.55, 0.56);
  addFoundationShrub(-4.6, 2.55, 0.48);
  addFoundationShrub(-0.5, 2.55, 0.48);
  addFoundationShrub(1.5, 2.55, 0.56);

  const dLocal = new THREE.Vector3(5.6, 0, 6.0);
  dLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

  return {
    group,
    collider: makeRotatedCollider(8.8, 7.2, 9.5),
    drivewayTarget: { x: x + dLocal.x, z: z + dLocal.z },
    drivewayCoord: { x: x + dLocal.x, z: z + dLocal.z },
    address: opts.address,
    exteriorProfile: {
      wallColorHex: colorNumToHex(opts.wallColor),
      roofColorHex: colorNumToHex(opts.roofColor),
      style: 'colonial',
      stories: 2,
      hasGarage: true,
      hasPool: false,
      hasBasement: hashAddressSeed(opts.address) % 2 === 0,
    },
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

// =================================================================================================
// 3D VEHICLE HEADLIGHTS RIG (Calibrated ECE SpotLight Projector, Flush Optical Halos & Ground Pool)
// =================================================================================================
type HeadlightLensMaterial = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;

interface PlayerHeadlightRigData {
  spotLight: THREE.SpotLight;
  spotTarget: THREE.Object3D;
  bounceLight: THREE.PointLight;
  haloGroup: THREE.Group;
  haloMat: THREE.MeshBasicMaterial;
  groundPoolMesh: THREE.Mesh;
  groundPoolMat: THREE.MeshBasicMaterial;
  headMat: HeadlightLensMaterial;
}

function createOpticalHeadlightVisuals(
  yPos: number,
  frontZ: number,
  halfSpreadX: number,
  poolLength: number,
  poolWidth: number
): {
  haloGroup: THREE.Group;
  haloMat: THREE.MeshBasicMaterial;
  groundPoolMesh: THREE.Mesh;
  groundPoolMat: THREE.MeshBasicMaterial;
} {
  const haloGroup = new THREE.Group();
  haloGroup.visible = false;

  const haloMat = new THREE.MeshBasicMaterial({
    map: getHeadlightHaloTexture(),
    color: 0xf4f9ff,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  // Flush optical lens flare quads seated directly in front of each projector housing (zero mid-air triangles)
  const flareGeom = new THREE.PlaneGeometry(0.58, 0.34);
  for (const side of [-1, 1]) {
    const flare = new THREE.Mesh(flareGeom, haloMat);
    flare.position.set(side * halfSpreadX, yPos, frontZ - 0.045);
    haloGroup.add(flare);
  }

  // Ground-hugging feathered road light carpet (sits cleanly at asphalt surface height y=0.05)
  const groundPoolMat = new THREE.MeshBasicMaterial({
    map: getHeadlightGroundPoolTexture(),
    color: 0xeaf4ff,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const poolGeom = new THREE.PlaneGeometry(poolWidth, poolLength);
  poolGeom.rotateX(-Math.PI / 2);
  const groundPoolMesh = new THREE.Mesh(poolGeom, groundPoolMat);
  groundPoolMesh.position.set(0, 0.05, frontZ - poolLength * 0.5 - 0.25);
  haloGroup.add(groundPoolMesh);

  return { haloGroup, haloMat, groundPoolMesh, groundPoolMat };
}

function attachPlayerHeadlightRig(
  parent: THREE.Object3D,
  yPos: number,
  frontZ: number,
  halfSpreadX: number,
  headMat: HeadlightLensMaterial
): PlayerHeadlightRigData {
    const spotLight = new THREE.SpotLight(0xf8fbff, 0, 210, Math.PI / 3.4, 0.56, 0.84);
    spotLight.position.set(0, yPos + 0.12, frontZ + 0.1);
    spotLight.map = getAutomotiveHeadlightPatternTexture();
    spotLight.castShadow = false;
    parent.add(spotLight);

    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0.12, frontZ - 48);
    parent.add(spotTarget);
    spotLight.target = spotTarget;

    // Crisp foreground road/curb scatter directly ahead of bumper
    const bounceLight = new THREE.PointLight(0xeef6ff, 0, 36, 0.95);
  bounceLight.position.set(0, yPos + 0.1, frontZ - 3.2);
  parent.add(bounceLight);

  const { haloGroup, haloMat, groundPoolMesh, groundPoolMat } = createOpticalHeadlightVisuals(
    yPos,
    frontZ,
    halfSpreadX,
    24,
    7.6
  );
  parent.add(haloGroup);

  return {
    spotLight,
    spotTarget,
    bounceLight,
    haloGroup,
    haloMat,
    groundPoolMesh,
    groundPoolMat,
    headMat,
  };
}

function attachNpcHeadlightBeams(
  parent: THREE.Object3D,
  yPos: number,
  frontZ: number,
  halfSpreadX: number,
  headMat: HeadlightLensMaterial,
  poolLength = 13
): void {
  const { haloGroup, haloMat, groundPoolMat } = createOpticalHeadlightVisuals(
    yPos,
    frontZ,
    halfSpreadX,
    poolLength,
    5.4
  );
  haloMat.opacity = 0.65;
  groundPoolMat.opacity = 0.13;
  parent.add(haloGroup);
  parent.userData.npcHeadlightData = { haloGroup, haloMat, groundPoolMat, headMat };
}

export function updatePlayerHeadlightRig(
  playerCarRoot: THREE.Object3D,
  state: 'off' | 'low' | 'high'
): void {
  let rig = playerCarRoot.userData?.playerHeadlightRig as PlayerHeadlightRigData | undefined;
  if (!rig) {
    const childOverlay = playerCarRoot.getObjectByName('city_street_car_overlay');
    if (childOverlay?.userData?.playerHeadlightRig) {
      rig = childOverlay.userData.playerHeadlightRig as PlayerHeadlightRigData;
    } else {
      const fallbackHeadMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(0xeef6ff),
        emissiveIntensity: 0.12,
        toneMapped: false,
      });
      rig = attachPlayerHeadlightRig(playerCarRoot, 0.56, -2.25, 0.62, fallbackHeadMat);
      playerCarRoot.userData.playerHeadlightRig = rig;
    }
  }

  if (state === 'off') {
    rig.spotLight.intensity = 0;
    rig.bounceLight.intensity = 0;
    rig.haloGroup.visible = false;
    rig.headMat.color.setHex(0xb8c2cf);
    if (rig.headMat instanceof THREE.MeshStandardMaterial || rig.headMat instanceof THREE.MeshLambertMaterial) {
      rig.headMat.emissiveIntensity = 0.06;
    }
  } else if (state === 'low') {
    rig.spotLight.intensity = 340;
    rig.spotLight.distance = 215;
    rig.spotLight.angle = Math.PI / 3.4;
    rig.spotLight.penumbra = 0.56;
    rig.spotTarget.position.set(0, 0.10, -48);
    rig.bounceLight.intensity = 15.5;
    rig.haloGroup.visible = true;
    rig.haloMat.opacity = 0.78;
    rig.groundPoolMesh.scale.set(1.06, 1, 1.15);
    rig.groundPoolMat.opacity = 0.24;
    rig.headMat.color.setHex(0xf8fbff);
    if (rig.headMat instanceof THREE.MeshStandardMaterial || rig.headMat instanceof THREE.MeshLambertMaterial) {
      rig.headMat.emissiveIntensity = 3.2;
    }
  } else {
    rig.spotLight.intensity = 660;
    rig.spotLight.distance = 300;
    rig.spotLight.angle = Math.PI / 2.85;
    rig.spotLight.penumbra = 0.46;
    rig.spotTarget.position.set(0, 0.28, -82);
    rig.bounceLight.intensity = 28.0;
    rig.haloGroup.visible = true;
    rig.haloMat.opacity = 0.96;
    rig.groundPoolMesh.scale.set(1.28, 1, 1.55);
    rig.groundPoolMat.opacity = 0.36;
    rig.headMat.color.setHex(0xffffff);
    if (rig.headMat instanceof THREE.MeshStandardMaterial || rig.headMat instanceof THREE.MeshLambertMaterial) {
      rig.headMat.emissiveIntensity = 4.6;
    }
  }
}

export function updateNpcHeadlightsVisibility(carRoot: THREE.Object3D, active: boolean): void {
  const data = carRoot.userData?.npcHeadlightData as
    | {
        haloGroup: THREE.Group;
        haloMat: THREE.MeshBasicMaterial;
        groundPoolMat: THREE.MeshBasicMaterial;
        headMat: HeadlightLensMaterial;
      }
    | undefined;
  if (!data) return;
  if (data.haloGroup.visible !== active) {
    data.haloGroup.visible = active;
    data.headMat.color.setHex(active ? 0xf8fbff : 0xcbd5e1);
    if (data.headMat instanceof THREE.MeshStandardMaterial || data.headMat instanceof THREE.MeshLambertMaterial) {
      data.headMat.emissiveIntensity = active ? 2.4 : 0.06;
    }
  }
}

// ============================================================================
// TACTICAL MCPD POLICE ROADBLOCKS (SPAWNED AHEAD ON PURSUIT ROADS)
// ============================================================================

export interface PoliceRoadblockEntity {
  id: string;
  roadId: string;
  pos: THREE.Vector3;
  heading: number;
  halfWidth: number;
  root: THREE.Group;
  hitCooldown: number;
  updateStrobe: (timeSec: number) => void;
}

const roadblockGeoPool = {
  barrierBody: new THREE.BoxGeometry(2.8, 0.92, 0.56),
  barrierStripe: new THREE.BoxGeometry(0.45, 0.24, 0.60),
  coneBody: new THREE.ConeGeometry(0.24, 0.68, 10),
  coneBase: new THREE.BoxGeometry(0.46, 0.06, 0.46),
};

const roadblockMatPool = {
  barrierMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72, metalness: 0.12 }),
  stripeOrangeMat: new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.28,
    roughness: 0.48,
  }),
  coneOrangeMat: new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0x9a3412,
    emissiveIntensity: 0.35,
    roughness: 0.55,
  }),
  coneBaseMat: new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 }),
};

export function buildPoliceRoadblockGroup(roadWidth: number): {
  root: THREE.Group;
  halfWidth: number;
  updateStrobe: (timeSec: number) => void;
} {
  const root = new THREE.Group();
  const halfWidth = Math.max(5.5, Math.min(9.5, roadWidth * 0.44));

  // Two angled MCPD Police Interceptors flanking the roadway, leaving a tight tactical weave gap
  const leftCop = buildPoliceInterceptorMesh();
  leftCop.root.position.set(-Math.max(2.6, halfWidth * 0.56), 0, -0.35);
  leftCop.root.rotation.y = Math.PI * 0.42;
  root.add(leftCop.root);

  const rightCop = buildPoliceInterceptorMesh();
  rightCop.root.position.set(Math.max(2.6, halfWidth * 0.56), 0, 0.35);
  rightCop.root.rotation.y = -Math.PI * 0.42;
  root.add(rightCop.root);

  // Two striped Jersey barriers in front of the cruisers + safety cones
  for (const side of [-1, 1]) {
    const bx = side * Math.max(1.9, halfWidth * 0.36);
    const barrier = new THREE.Mesh(roadblockGeoPool.barrierBody, roadblockMatPool.barrierMat);
    barrier.position.set(bx, 0.46, -1.75);
    root.add(barrier);

    for (const sx of [-0.95, 0, 0.95]) {
      const stripe = new THREE.Mesh(roadblockGeoPool.barrierStripe, roadblockMatPool.stripeOrangeMat);
      stripe.position.set(bx + sx, 0.64, -1.75);
      root.add(stripe);
    }

    const coneX = side * (halfWidth * 0.78);
    const cone = new THREE.Mesh(roadblockGeoPool.coneBody, roadblockMatPool.coneOrangeMat);
    cone.position.set(coneX, 0.36, -2.55);
    root.add(cone);

    const coneBase = new THREE.Mesh(roadblockGeoPool.coneBase, roadblockMatPool.coneBaseMat);
    coneBase.position.set(coneX, 0.03, -2.55);
    root.add(coneBase);
  }

  return {
    root,
    halfWidth,
    updateStrobe: (timeSec: number) => {
      leftCop.setSirenActive(true, timeSec);
      rightCop.setSirenActive(true, timeSec + 0.09);
    },
  };
}




