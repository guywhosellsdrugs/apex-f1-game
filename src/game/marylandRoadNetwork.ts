import * as THREE from 'three';

export interface MarylandRoadSpec {
  id: string;
  name: string;
  width: number;
  dividedMedianWidth?: number;
  speedLimitMph: number;
  isHighway?: boolean;
  isResidential?: boolean;
  isBridge?: boolean;
  culDeSacEndRadius?: number;
  region:
    | 'western_md'
    | 'frederick'
    | 'gaithersburg'
    | 'capital'
    | 'howard'
    | 'baltimore'
    | 'annapolis_bay'
    | 'eastern_shore';
  points: { x: number; z: number }[];
}

export type GaithersburgRoadSpec = MarylandRoadSpec;

// Uniform world projection shift applied to Gaithersburg so it sits accurately SE of Frederick,
// NW of Rockville/Bethesda/DC, and SW of Ellicott City / Columbia / Baltimore.
export const GAITH_DX = -540;
export const GAITH_DZ = -1240;

export const gx = (x: number): number => x + GAITH_DX;
export const gz = (z: number): number => z + GAITH_DZ;

export const CITY_STREET_WIDTH = 26;
export const CITY_STREET_HALF_WIDTH = 13;
export const CITY_LANE_OFFSET = 5.5;

export const ICM_CAMPUS_ORIGIN = {
  x: gx(356), // -184
  z: gz(1845), // 605
  rotY: -0.336,
};

export const REDEEMER_CAMPUS_ORIGIN = {
  x: gx(386), // -154
  z: gz(1755), // 515
  rotY: -0.336,
};

export const ISB_CAMPUS_ORIGIN = {
  x: 740,
  z: -340,
  rotY: 0.44, // Aligned cleanly along curved Johnnycake Rd (6631 Johnnycake Rd)
};

// Player spawn directly in ICM (19411 Woodfield Rd) North Parking Lot facing WNW toward Woodfield Rd
export const ICM_PLAYER_SPAWN = {
  x: gx(406.2), // -133.8
  y: 0.33,
  z: gz(1828.6), // 588.6
  heading: Math.PI / 2 - 0.336,
};

// Landmark world anchors used across physics, minimap, and GPS
export const MD_LANDMARKS = {
  baltimoreBank: { x: 1255, z: -245 },
  baltimorePoliceHQ: { x: 1295, z: -245 },
  baltimoreDealership: { x: 1185, z: -245 },
  baltimoreInnerHarbor: { x: 1280, z: -160 },
  baltimoreWTC: { x: 1272, z: -135 },
  baltimoreCamdenYards: { x: 1135, z: -100 },
  baltimoreDominoSugar: { x: 1375, z: 5 },
  baltimoreBasilica: { x: 1165, z: -310 },
  baltimoreMtVernon: { x: 1220, z: -380 },
  bwiAirport: { x: 1020, z: 380 },
  annapolisStateHouse: { x: 1420, z: 695 },
  annapolisCityDock: { x: 1455, z: 730 },
  chesapeakeBayBridgeMid: { x: 1790, z: 720 },
  oceanCityBoardwalk: { x: 2490, z: 1180 },
  deepCreekLake: { x: -2400, z: -480 },
  cumberland: { x: -2080, z: -520 },
  sidelingHill: { x: -1880, z: -520 },
  hagerstown: { x: -1600, z: -460 },
  frederick: { x: -1100, z: -240 },
  ellicottCity: { x: 320, z: -250 },
  columbia: { x: 280, z: 120 },
  olney: { x: 120, z: 620 },
  shadyGroveMetro: { x: -640, z: 1290 },
  rockvilleSquare: { x: -580, z: 1380 },
  bethesda: { x: -520, z: 1660 },
  silverSpring: { x: -200, z: 1660 },
  collegeParkUMD: { x: 140, z: 1540 },
  nationalHarbor: { x: -180, z: 1960 },
  isbCampus: ISB_CAMPUS_ORIGIN,
  icmCampus: ICM_CAMPUS_ORIGIN,
  redeemerCampus: REDEEMER_CAMPUS_ORIGIN,
  kgaiAirpark: { x: gx(385), z: gz(1995) },
  rioLakefront: { x: gx(-425), z: gz(2205) },
  hadleyFarms: { x: gx(548), z: gz(1476) },
};

// =================================================================================================
// 1. REAL GAITHERSBURG ARTERY ROADS & NEIGHBORHOODS (Shifted cleanly into Central/North Montgomery)
// =================================================================================================
export const GAITHERSBURG_ARTERY_ROADS: MarylandRoadSpec[] = [
  {
    id: 'woodfield_rd',
    name: 'WOODFIELD RD (MD-124)',
    width: 30,
    dividedMedianWidth: 5.0,
    speedLimitMph: 40,
    region: 'gaithersburg',
    points: [
      { x: gx(512), z: gz(1386) },
      { x: gx(480), z: gz(1480) },
      { x: gx(446), z: gz(1580) },
      { x: gx(416), z: gz(1665) },
      { x: gx(386), z: gz(1755) },
      { x: gx(356), z: gz(1845) },
      { x: gx(316), z: gz(1955) },
      { x: gx(270), z: gz(2085) },
      { x: gx(225), z: gz(2210) },
      { x: gx(155), z: gz(2390) },
      { x: gx(130), z: gz(2460) },
    ],
  },
  {
    id: 'midcounty_hwy',
    name: 'MIDCOUNTY HWY / EMORY GROVE',
    width: 22,
    speedLimitMph: 40,
    region: 'gaithersburg',
    points: [
      { x: gx(240), z: gz(1480) },
      { x: gx(215), z: gz(1620) },
      { x: gx(185), z: gz(1775) },
      { x: gx(160), z: gz(1900) },
      { x: gx(125), z: gz(2030) },
      { x: gx(90), z: gz(2210) },
      { x: gx(65), z: gz(2400) },
    ],
  },
  {
    id: 'goshen_rd',
    name: 'GOSHEN RD / WIGHTMAN RD',
    width: 22,
    speedLimitMph: 40,
    region: 'gaithersburg',
    points: [
      { x: gx(-240), z: gz(1480) },
      { x: gx(-215), z: gz(1595) },
      { x: gx(-175), z: gz(1725) },
      { x: gx(-125), z: gz(1845) },
      { x: gx(-55), z: gz(1835) },
    ],
  },
  {
    id: 'snouffer_school_rd',
    name: 'SNOUFFER SCHOOL RD',
    width: 22,
    speedLimitMph: 35,
    region: 'gaithersburg',
    points: [
      { x: gx(-175), z: gz(1725) },
      { x: gx(-25), z: gz(1810) },
      { x: gx(185), z: gz(1970) },
      { x: gx(270), z: gz(2085) },
      { x: gx(440), z: gz(2170) },
    ],
  },
  {
    id: 'airpark_rd',
    name: 'AIRPARK RD (KGAI)',
    width: 18,
    speedLimitMph: 35,
    region: 'gaithersburg',
    points: [
      { x: gx(316), z: gz(1955) },
      { x: gx(185), z: gz(1970) },
      { x: gx(125), z: gz(2030) },
    ],
  },
  {
    id: 'montgomery_village_ave',
    name: 'MONTGOMERY VILLAGE AVE / CENTERWAY',
    width: 22,
    speedLimitMph: 35,
    region: 'gaithersburg',
    points: [
      { x: gx(-430), z: gz(1660) },
      { x: gx(-310), z: gz(1625) },
      { x: gx(-215), z: gz(1595) },
      { x: gx(-25), z: gz(1660) },
      { x: gx(215), z: gz(1620) },
      { x: gx(416), z: gz(1665) },
    ],
  },
  {
    id: 'md_355',
    name: 'FREDERICK AVE (MD-355 · GAITHERSBURG)',
    width: 26,
    dividedMedianWidth: 3.8,
    speedLimitMph: 35,
    region: 'gaithersburg',
    points: [
      { x: gx(0), z: gz(1480) },
      { x: gx(-25), z: gz(1660) },
      { x: gx(-55), z: gz(1835) },
      { x: gx(-85), z: gz(2005) },
      { x: gx(-115), z: gz(2175) },
      { x: gx(-135), z: gz(2360) },
      { x: gx(-150), z: gz(2460) },
    ],
  },
  {
    id: 'i270_express',
    name: 'I-270 EXPRESSWAY (GAITHERSBURG)',
    width: 34,
    dividedMedianWidth: 4.5,
    speedLimitMph: 65,
    isHighway: true,
    region: 'gaithersburg',
    points: [
      { x: gx(-480), z: gz(1480) },
      { x: gx(-430), z: gz(1660) },
      { x: gx(-365), z: gz(1890) },
      { x: gx(-285), z: gz(2165) },
      { x: gx(-225), z: gz(2380) },
      { x: gx(-200), z: gz(2460) },
    ],
  },
  {
    id: 'diamond_ave',
    name: 'W & E DIAMOND AVE / CLOPPER RD (MD-117)',
    width: 22,
    speedLimitMph: 30,
    region: 'gaithersburg',
    points: [
      { x: gx(-570), z: gz(1950) },
      { x: gx(-365), z: gz(1890) },
      { x: gx(-175), z: gz(1985) },
      { x: gx(-85), z: gz(2005) },
      { x: gx(125), z: gz(2030) },
    ],
  },
  {
    id: 'quince_orchard_rd',
    name: 'QUINCE ORCHARD RD / GREAT SENECA HWY',
    width: 22,
    speedLimitMph: 35,
    region: 'gaithersburg',
    points: [
      { x: gx(-430), z: gz(1660) },
      { x: gx(-560), z: gz(1750) },
      { x: gx(-570), z: gz(1950) },
      { x: gx(-565), z: gz(2210) },
      { x: gx(-520), z: gz(2390) },
    ],
  },
  {
    id: 'sam_eig_shady_grove',
    name: 'SAM EIG HWY / SHADY GROVE / FLOWER HILL',
    width: 24,
    speedLimitMph: 40,
    region: 'gaithersburg',
    points: [
      { x: gx(-565), z: gz(2210) },
      { x: gx(-425), z: gz(2205) },
      { x: gx(-285), z: gz(2165) },
      { x: gx(-115), z: gz(2175) },
      { x: gx(90), z: gz(2210) },
      { x: gx(225), z: gz(2210) },
      { x: gx(440), z: gz(2170) },
    ],
  },
  {
    id: 'nist_bureau_dr',
    name: 'BUREAU DR (NIST / RIO)',
    width: 18,
    speedLimitMph: 30,
    region: 'gaithersburg',
    points: [
      { x: gx(-365), z: gz(1890) },
      { x: gx(-465), z: gz(2035) },
      { x: gx(-425), z: gz(2205) },
    ],
  },
  {
    id: 'shady_grove_south',
    name: 'FIELDS RD / SHADY GROVE RD',
    width: 22,
    speedLimitMph: 35,
    region: 'gaithersburg',
    points: [
      { x: gx(-520), z: gz(2390) },
      { x: gx(-350), z: gz(2360) },
      { x: gx(-225), z: gz(2380) },
      { x: gx(-135), z: gz(2360) },
      { x: gx(65), z: gz(2400) },
      { x: gx(130), z: gz(2460) },
    ],
  },
  {
    id: 'rio_crown_link',
    name: 'WASHINGTONIAN BLVD / CROWN PARK',
    width: 18,
    speedLimitMph: 25,
    region: 'gaithersburg',
    points: [
      { x: gx(-425), z: gz(2205) },
      { x: gx(-350), z: gz(2360) },
    ],
  },
];

export const GAITHERSBURG_NEIGHBORHOOD_ROADS: MarylandRoadSpec[] = [
  {
    id: 'emory_church_rd',
    name: 'EMORY CHURCH RD (EMORY GROVE)',
    width: 12.5,
    speedLimitMph: 25,
    isResidential: true,
    region: 'gaithersburg',
    points: [
      { x: gx(356), z: gz(1845) },
      { x: gx(255), z: gz(1868) },
      { x: gx(160), z: gz(1900) },
    ],
  },
  {
    id: 'brenish_dr',
    name: 'BRENISH DR (EDINBURGH VILLAGE)',
    width: 12.0,
    speedLimitMph: 25,
    isResidential: true,
    region: 'gaithersburg',
    points: [
      { x: gx(416), z: gz(1665) },
      { x: gx(458), z: gz(1666) },
      { x: gx(494), z: gz(1668) },
      { x: gx(526), z: gz(1664) },
    ],
  },
  {
    id: 'kildonan_dr',
    name: 'KILDONAN DR (EDINBURGH VILLAGE)',
    width: 11.5,
    speedLimitMph: 25,
    isResidential: true,
    region: 'gaithersburg',
    points: [
      { x: gx(458), z: gz(1666) },
      { x: gx(454), z: gz(1636) },
      { x: gx(470), z: gz(1618) },
      { x: gx(494), z: gz(1616) },
      { x: gx(520), z: gz(1626) },
      { x: gx(526), z: gz(1664) },
    ],
  },
  {
    id: 'tarfside_ln',
    name: 'TARFSIDE LN (EDINBURGH VILLAGE)',
    width: 11.0,
    speedLimitMph: 25,
    isResidential: true,
    culDeSacEndRadius: 8.0,
    region: 'gaithersburg',
    points: [
      { x: gx(494), z: gz(1668) },
      { x: gx(494), z: gz(1692) },
    ],
  },
  {
    id: 'hadley_farms_dr',
    name: 'HADLEY FARMS DR',
    width: 12.5,
    speedLimitMph: 25,
    isResidential: true,
    region: 'gaithersburg',
    points: [
      { x: gx(446), z: gz(1580) },
      { x: gx(504), z: gz(1528) },
      { x: gx(564), z: gz(1480) },
      { x: gx(636), z: gz(1470) },
      { x: gx(682), z: gz(1516) },
      { x: gx(686), z: gz(1588) },
      { x: gx(668), z: gz(1656) },
      { x: gx(598), z: gz(1676) },
    ],
  },
  {
    id: 'pompano_ter',
    name: 'POMPANO TER (HADLEY FARMS)',
    width: 10.5,
    speedLimitMph: 25,
    isResidential: true,
    culDeSacEndRadius: 8.4,
    region: 'gaithersburg',
    points: [
      { x: gx(526), z: gz(1510) },
      { x: gx(540), z: gz(1442) },
    ],
  },
  {
    id: 'filbert_ter',
    name: 'FILBERT TER (HADLEY FARMS)',
    width: 10.5,
    speedLimitMph: 25,
    isResidential: true,
    culDeSacEndRadius: 8.4,
    region: 'gaithersburg',
    points: [
      { x: gx(584), z: gz(1476) },
      { x: gx(584), z: gz(1412) },
    ],
  },
  {
    id: 'cinnabar_ter',
    name: 'CINNABAR TER (HADLEY FARMS)',
    width: 10.5,
    speedLimitMph: 25,
    isResidential: true,
    culDeSacEndRadius: 8.4,
    region: 'gaithersburg',
    points: [
      { x: gx(636), z: gz(1470) },
      { x: gx(636), z: gz(1412) },
    ],
  },
  {
    id: 'barcellona_dr',
    name: 'BARCELLONA DR (HADLEY FARMS)',
    width: 10.5,
    speedLimitMph: 25,
    isResidential: true,
    culDeSacEndRadius: 8.4,
    region: 'gaithersburg',
    points: [
      { x: gx(636), z: gz(1470) },
      { x: gx(676), z: gz(1442) },
    ],
  },
  {
    id: 'plum_orchard_ct',
    name: 'PLUM ORCHARD CT (HADLEY FARMS)',
    width: 10.2,
    speedLimitMph: 25,
    isResidential: true,
    culDeSacEndRadius: 8.2,
    region: 'gaithersburg',
    points: [
      { x: gx(686), z: gz(1588) },
      { x: gx(648), z: gz(1588) },
    ],
  },
  {
    id: 'elioak_ter',
    name: 'ELIOAK TER (HADLEY FARMS)',
    width: 10.5,
    speedLimitMph: 25,
    isResidential: true,
    culDeSacEndRadius: 8.4,
    region: 'gaithersburg',
    points: [
      { x: gx(668), z: gz(1656) },
      { x: gx(622), z: gz(1640) },
    ],
  },
  {
    id: 'bitterroot_ct',
    name: 'BITTERROOT CT (HADLEY FARMS)',
    width: 10.2,
    speedLimitMph: 25,
    isResidential: true,
    culDeSacEndRadius: 8.2,
    region: 'gaithersburg',
    points: [
      { x: gx(598), z: gz(1676) },
      { x: gx(574), z: gz(1640) },
    ],
  },
];

// =================================================================================================
// 2. STATEWIDE MARYLAND INTERSTATES, HIGHWAYS & REGIONAL ROADS (Real Google Maps Topology)
// =================================================================================================
export const STATEWIDE_MARYLAND_ROADS: MarylandRoadSpec[] = [
  // --- WESTERN MARYLAND & FREDERICK ---
  {
    id: 'us_219_deep_creek',
    name: 'US-219 GARRETT HWY (DEEP CREEK LAKE)',
    width: 22,
    speedLimitMph: 45,
    region: 'western_md',
    points: [
      { x: -2490, z: -560 }, // Wisp Resort
      { x: -2400, z: -480 }, // Glendale Bridge over Deep Creek Lake
      { x: -2400, z: -340 }, // Oakland / Deep Creek South
    ],
  },
  {
    id: 'i68_national_fwy',
    name: 'I-68 NATIONAL FREEWAY (CUMBERLAND · SIDELING HILL)',
    width: 30,
    dividedMedianWidth: 4.5,
    speedLimitMph: 70,
    isHighway: true,
    region: 'western_md',
    points: [
      { x: -2490, z: -560 },
      { x: -2300, z: -520 },
      { x: -2080, z: -520 }, // Cumberland
      { x: -1880, z: -520 }, // Sideling Hill Cut
      { x: -1740, z: -500 }, // Hancock -> I-70
    ],
  },
  {
    id: 'i81_hagerstown',
    name: 'I-81 CORRIDOR (HAGERSTOWN)',
    width: 28,
    dividedMedianWidth: 4.0,
    speedLimitMph: 70,
    isHighway: true,
    region: 'western_md',
    points: [
      { x: -1620, z: -690 },
      { x: -1620, z: -480 },
      { x: -1580, z: -440 }, // Hagerstown Square
      { x: -1580, z: -260 },
    ],
  },
  {
    id: 'i70_west_east',
    name: 'I-70 WEST–EAST FREEWAY (HAGERSTOWN · FREDERICK · BALTIMORE)',
    width: 34,
    dividedMedianWidth: 5.0,
    speedLimitMph: 70,
    isHighway: true,
    region: 'frederick',
    points: [
      { x: -1740, z: -500 },
      { x: -1620, z: -480 },
      { x: -1360, z: -360 }, // South Mountain / Boonsboro
      { x: -1160, z: -260 }, // Frederick West
      { x: -1080, z: -210 }, // Frederick I-270 Interchange
      { x: -540, z: -250 }, // Mt Airy (MD-27)
      { x: -40, z: -265 }, // Sykesville / Lisbon
      { x: 320, z: -250 }, // Ellicott City / US-29
      { x: 640, z: -340 }, // I-695 Exit 16 (Security/Woodlawn)
      { x: 960, z: -240 },
      { x: 1080, z: -210 }, // West Downtown Baltimore (Franklin-Mulberry)
    ],
  },
  {
    id: 'frederick_market_us15',
    name: 'US-15 & N MARKET ST (FREDERICK HISTORIC DISTRICT)',
    width: 22,
    speedLimitMph: 35,
    region: 'frederick',
    points: [
      { x: -1140, z: -560 }, // Catoctin / Thurmont
      { x: -1160, z: -260 },
      { x: -1100, z: -240 }, // Carroll Creek / Market St
      { x: -1080, z: -210 },
    ],
  },
  {
    id: 'i270_frederick_clarksburg',
    name: 'I-270 NORTH (FREDERICK · CLARKSBURG · GAITHERSBURG)',
    width: 34,
    dividedMedianWidth: 4.5,
    speedLimitMph: 65,
    isHighway: true,
    region: 'frederick',
    points: [
      { x: -1080, z: -210 }, // Frederick I-70/I-270
      { x: -1050, z: 20 }, // Clarksburg
      { x: gx(-480), z: gz(1480) }, // Connects seamlessly to Gaithersburg i270_express! (-1020, 240)
    ],
  },
  {
    id: 'md27_ridge_damascus',
    name: 'MD-27 RIDGE RD (MT AIRY · DAMASCUS · GAITHERSBURG)',
    width: 22,
    speedLimitMph: 45,
    region: 'gaithersburg',
    points: [
      { x: -540, z: -250 }, // Mt Airy
      { x: -540, z: 20 }, // Damascus
      { x: gx(0), z: gz(1480) }, // Joins MD-355 North Gaithersburg (-540, 240)
    ],
  },
  {
    id: 'damascus_woodfield_link',
    name: 'MD-124 NORTH (DAMASCUS · WOODFIELD RD)',
    width: 22,
    speedLimitMph: 40,
    region: 'gaithersburg',
    points: [
      { x: -540, z: 20 },
      { x: gx(512), z: gz(1386) }, // Joins Woodfield Rd north of Hadley Farms
    ],
  },
  {
    id: 'md108_olney_columbia',
    name: 'MD-108 (GAITHERSBURG · OLNEY · CLARKSVILLE · COLUMBIA)',
    width: 22,
    speedLimitMph: 45,
    region: 'howard',
    points: [
      { x: gx(512), z: gz(1386) }, // Woodfield Rd / Laytonsville Rd north of Hadley Farms
      { x: gx(555), z: gz(1355) }, // North around Hadley Farms perimeter
      { x: gx(716), z: gz(1355) }, // East clear of Hadley Farms & west of Columbia Mall
      { x: gx(716), z: gz(1425) }, // East perimeter clear of Barcellona Dr
      { x: gx(762), z: gz(1495) }, // East clear of Hadley Farms Dr & South of Columbia
      { x: gx(768), z: gz(1740) }, // South-East past Edinburgh Village
      { x: 120, z: 620 }, // Olney Town Center (MD-97 & MD-108)
      { x: 240, z: 420 }, // Sandy Spring / Ashton
      { x: 260, z: 220 }, // Clarksville
      { x: 280, z: 120 }, // Columbia Town Center
    ],
  },
  {
    id: 'md28_norbeck_road',
    name: 'MD-28 NORBECK RD (FLOWER HILL · OLNEY · ROCKVILLE)',
    width: 22,
    speedLimitMph: 40,
    region: 'gaithersburg',
    points: [
      { x: gx(130), z: gz(2460) }, // South Redland / Shady Grove East (-410, 1220)
      { x: -220, z: 1180 }, // Norbeck / Georgia Ave
      { x: 120, z: 620 }, // Up to Olney via MD-97 Georgia Ave
    ],
  },

  // --- CAPITAL REGION: ROCKVILLE, BETHESDA, SILVER SPRING, COLLEGE PARK, NATIONAL HARBOR ---
  {
    id: 'i270_rockville_bethesda',
    name: 'I-270 SOUTH (SHADY GROVE · ROCKVILLE · BETHESDA I-495)',
    width: 34,
    dividedMedianWidth: 4.5,
    speedLimitMph: 65,
    isHighway: true,
    region: 'capital',
    points: [
      { x: gx(-200), z: gz(2460) }, // Connects from Gaithersburg I-270 (-740, 1220)
      { x: -680, z: 1340 }, // Shady Grove West
      { x: -610, z: 1490 }, // Rockville Civic / I-270
      { x: -540, z: 1660 }, // I-270 / I-495 Split (Bethesda)
    ],
  },
  {
    id: 'rockville_pike_md355',
    name: 'MD-355 ROCKVILLE PIKE & WISCONSIN AVE (SHADY GROVE · NIH · BETHESDA)',
    width: 26,
    dividedMedianWidth: 3.5,
    speedLimitMph: 35,
    region: 'capital',
    points: [
      { x: gx(-150), z: gz(2460) }, // (-690, 1220)
      { x: -640, z: 1290 }, // Shady Grove WMATA Red Line Station
      { x: -580, z: 1380 }, // Rockville Town Square
      { x: -540, z: 1520 }, // North Bethesda / White Flint
      { x: -520, z: 1660 }, // NIH Clinical Center / Beltway
      { x: -505, z: 1745 }, // Downtown Bethesda Row
    ],
  },
  {
    id: 'shady_grove_metro_link',
    name: 'SHADY GROVE RD & METRO ACCESS',
    width: 20,
    speedLimitMph: 35,
    region: 'capital',
    points: [
      { x: -680, z: 1340 },
      { x: -640, z: 1290 },
      { x: -580, z: 1380 },
      { x: -410, z: 1220 },
    ],
  },
  {
    id: 'georgia_ave_md97',
    name: 'MD-97 GEORGIA AVE (NORBECK · WHEATON · SILVER SPRING)',
    width: 24,
    speedLimitMph: 35,
    region: 'capital',
    points: [
      { x: -220, z: 1180 },
      { x: -205, z: 1450 }, // Wheaton
      { x: -200, z: 1660 }, // I-495 Exit 31
      { x: -195, z: 1745 }, // Downtown Silver Spring / Colesville
    ],
  },
  {
    id: 'i495_capital_beltway',
    name: 'I-495 CAPITAL BELTWAY (POTOMAC · BETHESDA · SILVER SPRING · UMD · WILSON BRIDGE)',
    width: 34,
    dividedMedianWidth: 4.5,
    speedLimitMph: 65,
    isHighway: true,
    region: 'capital',
    points: [
      { x: -820, z: 1680 }, // Cabin John / American Legion Bridge
      { x: -540, z: 1660 }, // Bethesda I-270
      { x: -520, z: 1660 }, // Wisconsin Ave Exit 34
      { x: -200, z: 1660 }, // Silver Spring Georgia Ave
      { x: 140, z: 1620 }, // College Park I-95 / I-495
      { x: 460, z: 1680 }, // New Carrollton US-50 Exit 19
      { x: 480, z: 1840 }, // Largo / Morgan Blvd
      { x: 260, z: 1970 }, // Suitland / Branch Ave
      { x: -180, z: 1960 }, // National Harbor / Oxon Hill
      { x: -420, z: 1980 }, // Woodrow Wilson Memorial Drawbridge over Potomac River
    ],
  },
  {
    id: 'us1_baltimore_ave_umd',
    name: 'US-1 BALTIMORE AVE (COLLEGE PARK UMD · LAUREL)',
    width: 24,
    speedLimitMph: 35,
    region: 'capital',
    points: [
      { x: 140, z: 1620 },
      { x: 140, z: 1540 }, // UMD McKeldin Mall / Campus Dr
      { x: 340, z: 1140 }, // Beltsville
      { x: 500, z: 680 }, // Laurel Main St
    ],
  },

  // --- CENTRAL INTERSTATE CORRIDOR: I-95 & US-29 (DC/UMD -> LAUREL -> COLUMBIA -> BWI -> BALTIMORE) ---
  {
    id: 'us29_columbia_pike',
    name: 'US-29 COLUMBIA PIKE (SILVER SPRING · BURTONSVILLE · COLUMBIA · ELLICOTT CITY)',
    width: 28,
    dividedMedianWidth: 4.0,
    speedLimitMph: 55,
    isHighway: true,
    region: 'howard',
    points: [
      { x: -200, z: 1660 }, // Silver Spring
      { x: -10, z: 1180 }, // White Oak / Fairland
      { x: 180, z: 640 }, // Burtonsville / Sandy Spring east
      { x: 280, z: 120 }, // Columbia Town Center
      { x: 320, z: -250 }, // Ellicott City I-70
    ],
  },
  {
    id: 'md32_patuxent_link',
    name: 'MD-32 (COLUMBIA · FT MEADE · LAUREL)',
    width: 24,
    speedLimitMph: 55,
    isHighway: true,
    region: 'howard',
    points: [
      { x: 280, z: 120 },
      { x: 500, z: 680 },
    ],
  },
  {
    id: 'i95_maryland_corridor',
    name: 'I-95 EXPRESSWAY (COLLEGE PARK · LAUREL · BWI · FT MCHENRY TUNNEL · WHITE MARSH)',
    width: 36,
    dividedMedianWidth: 5.0,
    speedLimitMph: 70,
    isHighway: true,
    region: 'baltimore',
    points: [
      { x: 140, z: 1620 }, // College Park I-495
      { x: 400, z: 1540 }, // East of UMD McKeldin Mall
      { x: 520, z: 1080 }, // Beltsville / Muirkirk
      { x: 500, z: 680 }, // Laurel / Rt 198
      { x: 840, z: 320 }, // Elkridge / I-195 Spur to BWI
      { x: 960, z: 260 }, // I-195 / I-95 BWI Exit
      { x: 1120, z: 60 }, // South Baltimore I-695 / I-395
      { x: 1265, z: 108 }, // South of Federal Hill Park
      { x: 1440, z: 75 }, // Locust Point / Ft. McHenry Tunnel Approach
      { x: 1660, z: -180 }, // Canton / O'Donnell St
      { x: 1660, z: -540 }, // White Marsh I-695
      { x: 1840, z: -780 }, // Havre de Grace / Susquehanna River
    ],
  },

  // --- BALTIMORE METRO AREA (REAL GOOGLE MAPS STREET TOPOLOGY) ---
  {
    id: 'i695_beltway_ring',
    name: 'I-695 BALTIMORE BELTWAY',
    width: 34,
    dividedMedianWidth: 4.5,
    speedLimitMph: 65,
    isHighway: true,
    region: 'baltimore',
    points: [
      { x: 640, z: -340 }, // Exit 16 I-70
      { x: 640, z: -450 }, // Exit 17 Security Blvd (near ISB)
      { x: 720, z: -700 }, // Exit 20 Pikesville / Reisterstown Rd
      { x: 1000, z: -860 }, // Exit 24 Falls Rd / Charles St N
      { x: 1220, z: -860 }, // Exit 25–27 Towson / I-83
      { x: 1520, z: -760 }, // Exit 31 Perring / Parkville
      { x: 1660, z: -540 }, // Exit 33 I-95 NE / White Marsh
      { x: 1660, z: -260 }, // Exit 38 Eastern Ave / Essex
      { x: 1560, z: 40 }, // Exit 42 Dundalk / Sparrows Point
      { x: 1645, z: 75 }, // Francis Scott Key Bridge Approach East of Ft McHenry
      { x: 1625, z: 175 }, // Francis Scott Key Bridge Span East
      { x: 1460, z: 205 }, // Key Bridge South Harbor Channel
      { x: 1280, z: 195 }, // Brooklyn / Curtis Bay South of Federal Hill
      { x: 1120, z: 60 }, // Exit 11 I-95 South
      { x: 840, z: 40 }, // Exit 12 Wilkens / Catonsville South
      { x: 660, z: -140 }, // Exit 13 Frederick Rd / Rolling Rd
      { x: 640, z: -340 }, // Close loop seamlessly!
    ],
  },
  {
    id: 'rolling_rd_woodlawn',
    name: 'N ROLLING RD (MD-166 · CATONSVILLE & WOODLAWN)',
    width: 22,
    speedLimitMph: 35,
    region: 'baltimore',
    points: [
      { x: 660, z: -140 }, // Frederick Rd
      { x: 700, z: -280 },
      { x: 700, z: -450 }, // Rolling Rd & Security Blvd
      { x: 720, z: -700 },
    ],
  },
  {
    id: 'security_blvd_woodlawn',
    name: 'SECURITY BLVD (EXIT 17 · WOODLAWN)',
    width: 24,
    dividedMedianWidth: 3.5,
    speedLimitMph: 40,
    region: 'baltimore',
    points: [
      { x: 640, z: -450 },
      { x: 700, z: -450 },
      { x: 820, z: -445 },
      { x: 980, z: -420 },
    ],
  },
  {
    id: 'johnnycake_rd_isb',
    name: 'JOHNNYCAKE RD (6631 ISB · WOODLAWN)',
    width: 20,
    speedLimitMph: 35,
    region: 'baltimore',
    points: [
      { x: 640, z: -450 },
      { x: 685, z: -395 },
      { x: 740, z: -340 }, // Islamic Society of Baltimore (6631 Johnnycake Rd)
      { x: 840, z: -280 },
      { x: 960, z: -240 },
    ],
  },
  {
    id: 'ingleside_catonsville',
    name: 'INGLESIDE AVE & FREDERICK RD (MD-144)',
    width: 18,
    speedLimitMph: 35,
    region: 'baltimore',
    points: [
      { x: 740, z: -340 },
      { x: 775, z: -195 },
      { x: 660, z: -140 },
      { x: 840, z: 40 },
    ],
  },
  {
    id: 'i83_jones_falls',
    name: 'I-83 JONES FALLS EXPY (TOWSON · DRUID HILL · PENN STATION · DOWNTOWN)',
    width: 28,
    dividedMedianWidth: 3.5,
    speedLimitMph: 55,
    isHighway: true,
    region: 'baltimore',
    points: [
      { x: 1220, z: -860 }, // Towson I-695
      { x: 1285, z: -640 }, // Cold Spring / Druid Hill East
      { x: 1325, z: -480 }, // North Ave / JFX
      { x: 1335, z: -330 }, // Mt Royal / JFX
      { x: 1335, z: -245 }, // Fayette / City Hall East
      { x: 1335, z: -160 }, // President St & Pratt St (Aquarium)
    ],
  },
  {
    id: 'charles_st_baltimore',
    name: 'N CHARLES ST & LIGHT ST (TOWSON · MT VERNON · INNER HARBOR)',
    width: 24,
    speedLimitMph: 30,
    region: 'baltimore',
    points: [
      { x: 1220, z: -860 }, // Towson Circle
      { x: 1220, z: -580 }, // Charles Village / Hopkins Homewood
      { x: 1220, z: -480 }, // Penn Station
      { x: 1220, z: -380 }, // Mt Vernon Washington Monument
      { x: 1220, z: -245 }, // Charles Center
      { x: 1235, z: -160 }, // Pratt St & Light St (Harborplace / WTC)
      { x: 1235, z: -55 }, // Science Center & Light St
      { x: 1265, z: 10 }, // Federal Hill West Curb
      { x: 1265, z: 58 }, // Hanover & I-95 Approach South of Stadiums
      { x: 1120, z: 60 }, // I-95 / Hanover St
    ],
  },
  {
    id: 'cathedral_st_baltimore',
    name: 'CATHEDRAL ST / PARK AVE (BASILICA · MIDTOWN)',
    width: 20,
    speedLimitMph: 30,
    region: 'baltimore',
    points: [
      { x: 1185, z: -480 },
      { x: 1185, z: -310 }, // Baltimore Basilica
      { x: 1185, z: -245 }, // Showrooms / Central Downtown
      { x: 1185, z: -160 },
    ],
  },
  {
    id: 'mlk_blvd_i395',
    name: 'MLK JR BLVD & I-395 (CAMDEN YARDS · RAVENS STADIUM)',
    width: 26,
    speedLimitMph: 40,
    region: 'baltimore',
    points: [
      { x: 1080, z: -480 },
      { x: 1080, z: -245 },
      { x: 1080, z: -210 },
      { x: 1080, z: -160 }, // Pratt & MLK
      { x: 1110, z: -100 }, // Camden Yards West Gate
      { x: 1110, z: 0 }, // M&T Bank Ravens Stadium
      { x: 1120, z: 60 }, // I-95 Interchange
    ],
  },
  {
    id: 'north_ave_baltimore',
    name: 'W & E NORTH AVE (US-1 · PENN STATION)',
    width: 22,
    speedLimitMph: 35,
    region: 'baltimore',
    points: [
      { x: 820, z: -445 },
      { x: 1080, z: -480 },
      { x: 1185, z: -480 },
      { x: 1220, z: -480 },
      { x: 1440, z: -480 },
      { x: 1660, z: -540 },
    ],
  },
  {
    id: 'fayette_st_baltimore',
    name: 'E & W FAYETTE ST (BANK · POLICE HQ · JOHNS HOPKINS · PATTERSON PARK)',
    width: 22,
    speedLimitMph: 30,
    region: 'baltimore',
    points: [
      { x: 960, z: -240 },
      { x: 1080, z: -245 },
      { x: 1185, z: -245 },
      { x: 1220, z: -245 },
      { x: 1255, z: -245 }, // Baltimore Federal Reserve Bank
      { x: 1295, z: -245 }, // Baltimore Police HQ
      { x: 1335, z: -245 },
      { x: 1440, z: -280 }, // Johns Hopkins Hospital
      { x: 1515, z: -285 }, // Patterson Park North
      { x: 1660, z: -260 }, // I-695 East
    ],
  },
  {
    id: 'pratt_thames_harbor',
    name: 'W PRATT ST & THAMES ST (INNER HARBOR · AQUARIUM · FELLS POINT · CANTON)',
    width: 24,
    speedLimitMph: 30,
    region: 'baltimore',
    points: [
      { x: 1080, z: -160 },
      { x: 1185, z: -160 },
      { x: 1235, z: -160 }, // Harborplace / WTC
      { x: 1335, z: -160 }, // Pier 3 / National Aquarium
      { x: 1455, z: -155 }, // Fells Point (Thames St)
      { x: 1560, z: -175 }, // Canton Waterfront
      { x: 1660, z: -180 }, // I-95 Canton
    ],
  },
  {
    id: 'key_hwy_locust_point',
    name: 'KEY HWY & FORT AVE (SCIENCE CTR · DOMINO SUGAR · FT MCHENRY)',
    width: 22,
    speedLimitMph: 30,
    region: 'baltimore',
    points: [
      { x: 1235, z: -55 }, // Science Center & Light St
      { x: 1265, z: 10 }, // Federal Hill
      { x: 1375, z: 15 }, // Domino Sugar Refinery South Curb
      { x: 1440, z: 60 }, // I-95 Ft McHenry Approach
      { x: 1492, z: 74 }, // Fort McHenry Star Fort Entrance Gate
    ],
  },

  // --- ANNE ARUNDEL, BWI, ANNAPOLIS, CHESAPEAKE BAY BRIDGE, EASTERN SHORE & OCEAN CITY ---
  {
    id: 'i195_bwi_spur',
    name: 'I-195 & TERMINAL PKWY (BWI THURGOOD MARSHALL AIRPORT)',
    width: 26,
    speedLimitMph: 50,
    isHighway: true,
    region: 'annapolis_bay',
    points: [
      { x: 840, z: 320 },
      { x: 960, z: 260 },
      { x: 1020, z: 312 }, // BWI Terminal Arrivals Plaza & Apron Gate
    ],
  },
  {
    id: 'i97_annapolis',
    name: 'I-97 EXPRESSWAY (BALTIMORE · BWI · ANNAPOLIS)',
    width: 28,
    dividedMedianWidth: 4.0,
    speedLimitMph: 65,
    isHighway: true,
    region: 'annapolis_bay',
    points: [
      { x: 1120, z: 60 },
      { x: 1245, z: 240 }, // East of BWI Airport Runways
      { x: 1245, z: 480 }, // Glen Burnie / Cromwell
      { x: 1380, z: 700 }, // US-50 / I-97 Annapolis Interchange
    ],
  },
  {
    id: 'us50_chesapeake_bay_west',
    name: 'US-50 JOHN HANSON HWY (NEW CARROLLTON · BOWIE · ANNAPOLIS)',
    width: 30,
    dividedMedianWidth: 4.0,
    speedLimitMph: 65,
    isHighway: true,
    region: 'eastern_shore',
    points: [
      { x: 460, z: 1680 }, // I-495 New Carrollton
      { x: 760, z: 1280 }, // Bowie
      { x: 1120, z: 880 }, // Davidsonville / Crofton
      { x: 1380, z: 700 }, // Annapolis US-50
      { x: 1540, z: 720 }, // Sandy Point State Park / West Bay Bridge Abutment
    ],
  },
  {
    id: 'us50_chesapeake_bay_oc',
    name: 'CHESAPEAKE BAY BRIDGE (US-50)',
    width: 30,
    dividedMedianWidth: 4.0,
    speedLimitMph: 55,
    isHighway: true,
    isBridge: true,
    region: 'eastern_shore',
    points: [
      { x: 1540, z: 720 }, // West Bay Bridge Abutment
      { x: 2040, z: 720 }, // Chesapeake Bay Bridge Span -> Kent Island
    ],
  },
  {
    id: 'us50_eastern_shore',
    name: 'US-50 OCEAN GATEWAY (KENT ISLAND · EASTON · SALISBURY · OCEAN CITY)',
    width: 30,
    dividedMedianWidth: 4.0,
    speedLimitMph: 65,
    isHighway: true,
    region: 'eastern_shore',
    points: [
      { x: 2040, z: 720 }, // Kent Island Bridge Touchdown
      { x: 2180, z: 740 }, // Kent Narrows
      { x: 2260, z: 920 }, // Easton (Talbot County Courthouse)
      { x: 2320, z: 1080 }, // Salisbury / Wicomico
      { x: 2410, z: 1180 }, // Berlin / Rt 50 West Approach
      { x: 2490, z: 1180 }, // Harry W Kelley Drawbridge -> Ocean City Boardwalk
    ],
  },
  {
    id: 'annapolis_main_st',
    name: 'MAIN ST & COMPROMISE ST (ANNAPOLIS STATE HOUSE · USNA · CITY DOCK)',
    width: 18,
    speedLimitMph: 25,
    region: 'annapolis_bay',
    points: [
      { x: 1380, z: 700 },
      { x: 1420, z: 695 }, // Maryland State House Circle
      { x: 1455, z: 730 }, // City Dock / Ego Alley
      { x: 1474, z: 684 }, // US Naval Academy Main Gate
    ],
  },
  {
    id: 'coastal_hwy_oc',
    name: 'COASTAL HWY (MD-528 · OCEAN CITY ATLANTIC BEACH)',
    width: 24,
    dividedMedianWidth: 3.0,
    speedLimitMph: 35,
    region: 'eastern_shore',
    points: [
      { x: 2490, z: 900 }, // Fenwick / North Ocean City
      { x: 2490, z: 1050 }, // Mid-Town Ocean City
      { x: 2490, z: 1180 }, // Rt 50 Bridge & Boardwalk Entrance
      { x: 2490, z: 1295 }, // Ocean City Inlet Pier & Ferris Wheel
    ],
  },
];

export const ALL_MARYLAND_ROADS: MarylandRoadSpec[] = [
  ...STATEWIDE_MARYLAND_ROADS,
  ...GAITHERSBURG_ARTERY_ROADS,
  ...GAITHERSBURG_NEIGHBORHOOD_ROADS,
];

export const GAITHERSBURG_SIGNAL_JUNCTIONS: { x: number; z: number; name: string }[] = [
  { x: gx(316), z: gz(1955), name: 'Woodfield Rd & Airpark Rd' },
  { x: gx(270), z: gz(2085), name: 'Woodfield Rd & Snouffer School Rd' },
  { x: gx(225), z: gz(2210), name: 'Woodfield Rd & Muncaster Mill / Flower Hill' },
  { x: gx(-175), z: gz(1725), name: 'Goshen Rd & Snouffer School Rd' },
  { x: gx(-215), z: gz(1595), name: 'Goshen Rd & Mont. Village Ave' },
  { x: gx(-25), z: gz(1660), name: 'MD-355 & Montgomery Village Ave' },
  { x: gx(-85), z: gz(2005), name: 'MD-355 & Diamond Ave (Olde Towne)' },
  { x: gx(-115), z: gz(2175), name: 'MD-355 & Shady Grove / Bohrer' },
  { x: gx(-570), z: gz(1950), name: 'Quince Orchard Rd & Clopper Rd' },
  { x: gx(-565), z: gz(2210), name: 'Quince Orchard Rd & Muddy Branch' },
];

export const MARYLAND_SIGNAL_JUNCTIONS: { x: number; z: number; name: string }[] = [
  ...GAITHERSBURG_SIGNAL_JUNCTIONS,
  // Baltimore Metro Signals
  { x: 740, z: -340, name: 'Johnnycake Rd & ISB (6631)' },
  { x: 700, z: -450, name: 'Security Blvd & N Rolling Rd' },
  { x: 1080, z: -210, name: 'MLK Jr Blvd & W Franklin St (I-70)' },
  { x: 1185, z: -245, name: 'Cathedral St & W Fayette St' },
  { x: 1220, z: -245, name: 'N Charles St & E Fayette St' },
  { x: 1295, z: -245, name: 'E Fayette St & Police HQ / I-83' },
  { x: 1235, z: -160, name: 'W Pratt St & Light St (Inner Harbor)' },
  { x: 1335, z: -160, name: 'Pratt St & President St (Aquarium)' },
  { x: 1220, z: -380, name: 'N Charles St & Mt Vernon Place' },
  { x: 1220, z: -480, name: 'N Charles St & E North Ave (Penn Sta)' },
  { x: 1110, z: -100, name: 'Russell St & Camden St (Oriole Park)' },
  { x: 1455, z: -155, name: 'Thames St & Broadway (Fells Point)' },
  // Statewide Maryland Town Signals
  { x: -1100, z: -240, name: 'Market St & Carroll Creek (Frederick)' },
  { x: -1580, z: -440, name: 'Public Square (Hagerstown)' },
  { x: 320, z: -250, name: 'Main St & US-29 (Ellicott City)' },
  { x: 280, z: 120, name: 'Little Patuxent Pkwy & US-29 (Columbia)' },
  { x: 120, z: 620, name: 'MD-97 Georgia Ave & MD-108 (Olney)' },
  { x: -580, z: 1380, name: 'MD-355 & Rockville Town Square' },
  { x: -520, z: 1660, name: 'Wisconsin Ave & Old Georgetown Rd (Bethesda)' },
  { x: -200, z: 1660, name: 'Georgia Ave & Colesville Rd (Silver Spring)' },
  { x: 140, z: 1540, name: 'US-1 & Campus Dr (College Park UMD)' },
  { x: -180, z: 1960, name: 'Oxon Hill Rd & National Harbor Blvd' },
  { x: 1420, z: 695, name: 'State Circle (Annapolis Capitol)' },
  { x: 2490, z: 1180, name: 'Coastal Hwy & Rt 50 Bridge (Ocean City)' },
];

export const distSqPointToSeg = (
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number
): number => {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lSq = dx * dx + dz * dz;
  const t = lSq > 0 ? Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lSq)) : 0;
  const cx = x1 + t * dx;
  const cz = z1 + t * dz;
  return (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
};

export const toLocalXZ = (wx: number, wz: number, ox: number, oz: number, rotY: number) => {
  const dx = wx - ox;
  const dz = wz - oz;
  const c = Math.cos(-rotY);
  const s = Math.sin(-rotY);
  return {
    lx: dx * c + dz * s,
    lz: -dx * s + dz * c,
  };
};

export function isOnMarylandPavedSurface(px: number, pz: number): boolean {
  for (let rIdx = 0; rIdx < ALL_MARYLAND_ROADS.length; rIdx++) {
    const r = ALL_MARYLAND_ROADS[rIdx];
    const hw = r.width * 0.5 + 1.1;
    const hwSq = hw * hw;
    for (let i = 0; i < r.points.length - 1; i++) {
      const a = r.points[i];
      const b = r.points[i + 1];
      if (distSqPointToSeg(px, pz, a.x, a.z, b.x, b.z) <= hwSq) {
        return true;
      }
    }
    if (r.culDeSacEndRadius && r.points.length > 0) {
      const endPt = r.points[r.points.length - 1];
      if (Math.hypot(px - endPt.x, pz - endPt.z) <= r.culDeSacEndRadius + 0.9) {
        return true;
      }
    }
  }

  // ICM (19411 Woodfield Rd) Local Rotated Lots
  const icmLocal = toLocalXZ(px, pz, ICM_CAMPUS_ORIGIN.x, ICM_CAMPUS_ORIGIN.z, ICM_CAMPUS_ORIGIN.rotY);
  if (
    (icmLocal.lx >= 14 && icmLocal.lx <= 152 && icmLocal.lz >= -48 && icmLocal.lz <= -16) ||
    (icmLocal.lx >= 14 && icmLocal.lx <= 42 && icmLocal.lz >= -46 && icmLocal.lz <= 44) ||
    (icmLocal.lx >= 14 && icmLocal.lx <= 108 && icmLocal.lz >= 20 && icmLocal.lz <= 44)
  ) {
    return true;
  }

  // Church of the Redeemer (19425 Woodfield Rd)
  const redLocal = toLocalXZ(px, pz, REDEEMER_CAMPUS_ORIGIN.x, REDEEMER_CAMPUS_ORIGIN.z, REDEEMER_CAMPUS_ORIGIN.rotY);
  if (
    (redLocal.lx >= 14 && redLocal.lx <= 90 && redLocal.lz >= -38 && redLocal.lz <= 34) ||
    (redLocal.lx >= 84 && redLocal.lx <= 150 && redLocal.lz >= -42 && redLocal.lz <= -18)
  ) {
    return true;
  }

  // ISB (6631 Johnnycake Rd) Parking Lot & Driveway
  const isbLocal = toLocalXZ(px, pz, ISB_CAMPUS_ORIGIN.x, ISB_CAMPUS_ORIGIN.z, ISB_CAMPUS_ORIGIN.rotY);
  const isbLotLocal = toLocalXZ(px, pz, 794, -356, -0.54);
  if (
    (isbLocal.lx >= -55 && isbLocal.lx <= 55 && isbLocal.lz >= -15 && isbLocal.lz <= 56) ||
    (Math.abs(isbLotLocal.lx) <= 28 && Math.abs(isbLotLocal.lz) <= 18)
  ) {
    return true;
  }

  // Gaithersburg Retail / School / Airport Pads (shifted by GAITH_DX, GAITH_DZ)
  if (
    (px >= gx(565) && px <= gx(592) && pz >= gz(1536) && pz <= gz(1574)) || // Resnik ES
    (px >= gx(-318) && px <= gx(-230) && pz >= gz(1525) && pz <= gz(1595)) || // Goshen Giant
    (px >= gx(106) && px <= gx(204) && pz >= gz(2145) && pz <= gz(2208)) || // Flower Hill
    (px >= gx(-316) && px <= gx(-192) && pz >= gz(1728) && pz <= gz(1782)) || // Lakeforest
    (px >= gx(-655) && px <= gx(-545) && pz >= gz(2035) && pz <= gz(2145)) || // Kentlands Market Sq
    (px >= gx(-485) && px <= gx(-385) && pz >= gz(2165) && pz <= gz(2235)) || // RIO lot
    (px >= 940 && px <= 1110 && pz >= 310 && pz <= 450) // BWI Airport Apron & Runways
  ) {
    return true;
  }

  return false;
}

export function getMarylandZoneAndSpeedAt(x: number, z: number): { limitMph: number; zoneName: string } {
  // Campus Zones (20 MPH)
  const icmL = toLocalXZ(x, z, ICM_CAMPUS_ORIGIN.x, ICM_CAMPUS_ORIGIN.z, ICM_CAMPUS_ORIGIN.rotY);
  if (icmL.lx >= 10 && icmL.lx <= 185 && icmL.lz >= -55 && icmL.lz <= 52) {
    return { limitMph: 20, zoneName: 'Islamic Center of Maryland (19411 Woodfield Rd)' };
  }
  const redL = toLocalXZ(x, z, REDEEMER_CAMPUS_ORIGIN.x, REDEEMER_CAMPUS_ORIGIN.z, REDEEMER_CAMPUS_ORIGIN.rotY);
  if (redL.lx >= 10 && redL.lx <= 165 && redL.lz >= -52 && redL.lz <= 44) {
    return { limitMph: 20, zoneName: 'Church of the Redeemer (19425 Woodfield Rd)' };
  }
  const isbL = toLocalXZ(x, z, ISB_CAMPUS_ORIGIN.x, ISB_CAMPUS_ORIGIN.z, ISB_CAMPUS_ORIGIN.rotY);
  if (isbL.lx >= -65 && isbL.lx <= 65 && isbL.lz >= -60 && isbL.lz <= 60) {
    return { limitMph: 20, zoneName: 'Islamic Society of Baltimore (6631 Johnnycake Rd)' };
  }

  // Named Neighborhoods & Regional Landmarks
  if (x >= gx(416) && x <= gx(555) && z >= gz(1592) && z <= gz(1720)) {
    return { limitMph: 25, zoneName: 'Edinburgh Village · Brenish Dr & Kildonan Dr (Gaithersburg)' };
  }
  if (x >= gx(448) && x <= gx(720) && z >= gz(1390) && z <= gz(1705)) {
    return { limitMph: 25, zoneName: 'Hadley Farms · Resnik ES (Gaithersburg)' };
  }
  if (x >= gx(130) && x <= gx(320) && z >= gz(1845) && z <= gz(1945)) {
    return { limitMph: 25, zoneName: 'Emory Grove & Emory Church Rd (Gaithersburg)' };
  }
  if (Math.hypot(x - 1280, z - -120) < 160) {
    return { limitMph: 30, zoneName: 'Baltimore Inner Harbor · Pratt St & Aquarium' };
  }
  if (Math.hypot(x - 1125, z - -50) < 110) {
    return { limitMph: 30, zoneName: 'Camden Yards & M&T Bank Stadium (Baltimore)' };
  }
  if (Math.hypot(x - 1205, z - -345) < 105) {
    return { limitMph: 30, zoneName: 'Mount Vernon Place & Baltimore Basilica' };
  }
  if (Math.hypot(x - 1440, z - 715) < 140) {
    return { limitMph: 25, zoneName: 'Annapolis Historic District · State House & USNA' };
  }
  if (x >= 1530 && x <= 2050 && Math.abs(z - 720) < 55) {
    return { limitMph: 55, zoneName: 'Chesapeake Bay Bridge (US-50)' };
  }
  if (x >= 2420 && z >= 880 && z <= 1340) {
    return { limitMph: 35, zoneName: 'Ocean City Boardwalk & Coastal Hwy (MD-528)' };
  }
  if (Math.hypot(x - -2410, z - -480) < 200) {
    return { limitMph: 40, zoneName: 'Deep Creek Lake & Wisp Mountain (Garrett County)' };
  }
  if (Math.hypot(x - -1880, z - -520) < 120) {
    return { limitMph: 65, zoneName: 'Sideling Hill Cut (I-68 National Freeway)' };
  }
  if (Math.hypot(x - -1100, z - -240) < 130) {
    return { limitMph: 30, zoneName: 'Historic Downtown Frederick · Carroll Creek' };
  }
  if (Math.hypot(x - -180, z - 1960) < 140) {
    return { limitMph: 30, zoneName: 'National Harbor & Woodrow Wilson Bridge (Potomac)' };
  }
  if (Math.hypot(x - 140, z - 1540) < 130) {
    return { limitMph: 25, zoneName: 'College Park · University of Maryland' };
  }

  // Otherwise snap cleanly to nearest real Maryland road polyline
  let bestDistSq = Infinity;
  let bestLimit = 45;
  let bestName = 'Maryland State Highway';
  for (let rIdx = 0; rIdx < ALL_MARYLAND_ROADS.length; rIdx++) {
    const road = ALL_MARYLAND_ROADS[rIdx];
    for (let i = 0; i < road.points.length - 1; i++) {
      const dSq = distSqPointToSeg(
        x,
        z,
        road.points[i].x,
        road.points[i].z,
        road.points[i + 1].x,
        road.points[i + 1].z
      );
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestLimit = road.speedLimitMph;
        bestName = road.name;
      }
    }
  }
  return { limitMph: bestLimit, zoneName: bestName };
}

// =================================================================================================
// 3. SHARED PROCEDURAL ROAD POLYLINES & ARCHITECTURAL PITCHED-ROOF BUILDING HELPERS
// =================================================================================================
export interface MarylandRenderContext {
  group: THREE.Group;
  sceneryGroup: THREE.Group;
  cityStreetRoadMeshes: THREE.Mesh[];
  streetAsphaltMat: THREE.Material;
  whiteLineMat: THREE.Material;
  yellowLineMat: THREE.Material;
  sidewalkMat: THREE.Material;
  isUltra: boolean;
  isRetroPixel: boolean;
  makeCityMat: (opts: { color?: number; map?: THREE.Texture; roughness?: number; metalness?: number }) => THREE.Material;
  makeTextSignMat: (lines: string[], bgHex: string, fgHex: string, borderHex?: string) => THREE.Material;
}

export function renderMarylandRoadSpecs(roads: MarylandRoadSpec[], ctx: MarylandRenderContext): void {
  const {
    group,
    sceneryGroup,
    cityStreetRoadMeshes,
    streetAsphaltMat,
    whiteLineMat,
    yellowLineMat,
    sidewalkMat,
    isUltra,
    isRetroPixel,
    makeCityMat,
  } = ctx;

  const medianCurbMat = makeCityMat({ color: 0x94a3b8, roughness: 0.78 });
  const medianGrassMat = makeCityMat({ color: 0x2f682f, roughness: 0.9 });
  const guardrailMat = makeCityMat({ color: 0xbec7d4, roughness: 0.45, metalness: 0.65 });
  const guardrailPostMat = makeCityMat({ color: 0x4b5563, roughness: 0.75 });
  const junctionPoints = new Map<string, { x: number; z: number; maxWidth: number; isBridge?: boolean }>();

  for (const road of roads) {
    for (let i = 0; i < road.points.length; i++) {
      const pt = road.points[i];
      const key = `${Math.round(pt.x)}_${Math.round(pt.z)}`;
      const existing = junctionPoints.get(key);
      if (!existing || road.width > existing.maxWidth) {
        junctionPoints.set(key, { x: pt.x, z: pt.z, maxWidth: road.width, isBridge: road.isBridge });
      }
    }

    for (let i = 0; i < road.points.length - 1; i++) {
      const a = road.points[i];
      const b = road.points[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.5) continue;
      const angle = Math.atan2(dx, dz);
      const mx = (a.x + b.x) * 0.5;
      const mz = (a.z + b.z) * 0.5;
      const roadY = road.isBridge ? 0.36 : 0.246;
      const stripeY = road.isBridge ? 0.376 : 0.265;

      const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(road.width, len + 1.5), streetAsphaltMat);
      roadMesh.rotation.order = 'YXZ';
      roadMesh.rotation.y = angle;
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.set(mx, roadY, mz);
      roadMesh.receiveShadow = !isUltra && !isRetroPixel;
      group.add(roadMesh);
      cityStreetRoadMeshes.push(roadMesh);

      const trimLen = Math.max(4, len - road.width * 0.65);

      if (road.dividedMedianWidth && road.dividedMedianWidth > 0) {
        const medLen = Math.max(4, len - road.width * 1.05);
        if (medLen > 10) {
          const medCurb = new THREE.Mesh(
            new THREE.BoxGeometry(road.dividedMedianWidth, 0.28, medLen),
            road.isHighway ? medianCurbMat : medianGrassMat
          );
          medCurb.rotation.y = angle;
          medCurb.position.set(mx, roadY + 0.1, mz);
          sceneryGroup.add(medCurb);

          for (const side of [-1, 1]) {
            const nx = (dz / len) * (road.dividedMedianWidth * 0.5 + 0.45) * side;
            const nz = (-dx / len) * (road.dividedMedianWidth * 0.5 + 0.45) * side;
            const yStripe = new THREE.Mesh(new THREE.PlaneGeometry(0.22, medLen), yellowLineMat);
            yStripe.rotation.order = 'YXZ';
            yStripe.rotation.y = angle;
            yStripe.rotation.x = -Math.PI / 2;
            yStripe.position.set(mx + nx, stripeY, mz + nz);
            group.add(yStripe);
          }
        }
        if (!isRetroPixel) {
          const laneCenterOff = road.dividedMedianWidth * 0.5 + (road.width - road.dividedMedianWidth) * 0.25;
          const stepStride = len > 250 ? 22 : 16;
          for (const side of [-1, 1]) {
            const nx = (dz / len) * laneCenterOff * side;
            const nz = (-dx / len) * laneCenterOff * side;
            const steps = Math.floor(trimLen / stepStride);
            for (let s = 1; s < steps; s++) {
              const t = -0.45 + (s / steps) * 0.9;
              const px = mx + (dx / len) * trimLen * t + nx;
              const pz = mz + (dz / len) * trimLen * t + nz;
              const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 5.2), whiteLineMat);
              dash.rotation.order = 'YXZ';
              dash.rotation.y = angle;
              dash.rotation.x = -Math.PI / 2;
              dash.position.set(px, stripeY, pz);
              group.add(dash);
            }
          }
        }
      } else if (!road.isResidential) {
        for (const side of [-0.26, 0.26]) {
          const nx = (dz / len) * side;
          const nz = (-dx / len) * side;
          const yStripe = new THREE.Mesh(new THREE.PlaneGeometry(0.2, trimLen), yellowLineMat);
          yStripe.rotation.order = 'YXZ';
          yStripe.rotation.y = angle;
          yStripe.rotation.x = -Math.PI / 2;
          yStripe.position.set(mx + nx, stripeY, mz + nz);
          group.add(yStripe);
        }
      }

      if (road.isResidential) {
        for (const side of [-1, 1]) {
          const nx = (dz / len) * (road.width * 0.5 + 1.1) * side;
          const nz = (-dx / len) * (road.width * 0.5 + 1.1) * side;
          const walk = new THREE.Mesh(new THREE.PlaneGeometry(1.9, Math.max(2, len - 4)), sidewalkMat);
          walk.rotation.order = 'YXZ';
          walk.rotation.y = angle;
          walk.rotation.x = -Math.PI / 2;
          walk.position.set(mx + nx, 0.253, mz + nz);
          sceneryGroup.add(walk);
        }
      }

      // Bridge parapet rails ONLY on elevated water-crossing spans (never block Woodfield Rd, driveways, or highway ramps!)
      if (road.isBridge && len > 80 && !isRetroPixel) {
        const railLen = len - 56;
        if (railLen > 30) {
          for (const side of [-1, 1]) {
            const off = road.width * 0.5 + 1.4;
            const nx = (dz / len) * off * side;
            const nz = (-dx / len) * off * side;
            const railBeam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, railLen), guardrailMat);
            railBeam.rotation.y = angle;
            railBeam.position.set(mx + nx, roadY + 0.72, mz + nz);
            sceneryGroup.add(railBeam);
            const postStep = len > 250 ? 28 : 18;
            const postCount = Math.floor(railLen / postStep);
            for (let p = 0; p <= postCount; p++) {
              const frac = -0.5 + p / Math.max(1, postCount);
              const px = mx + nx + (dx / len) * railLen * frac;
              const pz = mz + nz + (dz / len) * railLen * frac;
              const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), guardrailPostMat);
              post.position.set(px, roadY + 0.45, pz);
              sceneryGroup.add(post);
            }
          }
        }
      }
    }

    if (road.culDeSacEndRadius && road.points.length > 0) {
      const endPt = road.points[road.points.length - 1];
      const cap = new THREE.Mesh(new THREE.CircleGeometry(road.culDeSacEndRadius, isRetroPixel ? 10 : 20), streetAsphaltMat);
      cap.rotation.x = -Math.PI / 2;
      cap.position.set(endPt.x, 0.249, endPt.z);
      group.add(cap);
    }
  }

  for (const [, jct] of junctionPoints) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(jct.maxWidth * 0.56, isRetroPixel ? 10 : 18), streetAsphaltMat);
    cap.rotation.x = -Math.PI / 2;
    cap.position.set(jct.x, jct.isBridge ? 0.362 : 0.249, jct.z);
    group.add(cap);
  }
}

export function boxWithRoofMat(
  wallMat: THREE.Material,
  roofMat: THREE.Material
): THREE.Material[] {
  return [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat];
}

/**
 * Shared extruded pitched-gable roof mesh builder (true architectural triangle gables + overhang slopes)
 * using clean solid gable infill so ExtrudeGeometry world UVs never warp brick/window textures.
 */
export function buildPitchedRoofGroup(
  width: number,
  depth: number,
  ridgeHeight: number,
  wallMat: THREE.Material,
  roofMat: THREE.Material,
  alongAxis: 'x' | 'z' = 'x'
): THREE.Group {
  const g = new THREE.Group();
  const baseColor =
    (wallMat as THREE.MeshStandardMaterial).color?.clone() ?? new THREE.Color(0xd6d3d1);
  // If wallMat uses a patterned brick/window texture (default white tint), pick a muted warm masonry/siding tone for gables
  const hasMap = Boolean((wallMat as THREE.MeshStandardMaterial).map);
  const gableMat = hasMap
    ? new THREE.MeshLambertMaterial({ color: baseColor.getHex() === 0xffffff ? 0xc2b8a3 : baseColor })
    : wallMat;

  if (alongAxis === 'x') {
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-depth * 0.5, 0);
    gableShape.lineTo(depth * 0.5, 0);
    gableShape.lineTo(0, ridgeHeight);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: width, bevelEnabled: false });
    gableGeo.rotateY(Math.PI / 2);
    gableGeo.translate(-width * 0.5, 0, 0);
    g.add(new THREE.Mesh(gableGeo, gableMat));

    const slopeLen = Math.hypot(depth * 0.54, ridgeHeight);
    const slopeAng = Math.atan2(ridgeHeight, depth * 0.5);
    for (const s of [-1, 1]) {
      const plane = new THREE.Mesh(new THREE.BoxGeometry(width + 0.85, 0.3, slopeLen), roofMat);
      plane.position.set(0, ridgeHeight * 0.5, s * depth * 0.27);
      plane.rotation.x = s * slopeAng;
      g.add(plane);
    }
  } else {
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-width * 0.5, 0);
    gableShape.lineTo(width * 0.5, 0);
    gableShape.lineTo(0, ridgeHeight);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: depth, bevelEnabled: false });
    gableGeo.translate(0, 0, -depth * 0.5);
    g.add(new THREE.Mesh(gableGeo, gableMat));

    const slopeLen = Math.hypot(width * 0.54, ridgeHeight);
    const slopeAng = Math.atan2(ridgeHeight, width * 0.5);
    for (const s of [-1, 1]) {
      const plane = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.3, depth + 0.85), roofMat);
      plane.position.set(s * width * 0.27, ridgeHeight * 0.5, 0);
      plane.rotation.z = -s * slopeAng;
      g.add(plane);
    }
  }
  return g;
}
