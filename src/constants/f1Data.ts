import {
  Driver,
  Team,
  CircuitInfo,
  TrackPoint,
  TeamContractOffer,
  EngineOption,
  AeroStaffOption,
  ChassisEngineerOption,
  BrakeEngineerOption,
  EngineEngineerOption,
  EngineScientistOption,
  SponsorOption,
  CustomerTeamPUOffer,
} from '../types/racing';

export const FIA_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export const DRIVERS_CHAMPIONSHIP_PRIZE = 50000000; // $50M FIA Driver Crown
export const CONSTRUCTORS_CHAMPIONSHIP_PRIZE = 120000000; // $120M FIA Constructors Cup

export const PRIZE_MONEY = [
  3000000, // P1: $3.0M
  2200000, // P2: $2.2M
  1700000, // P3: $1.7M
  1300000, // P4: $1.3M
  1000000, // P5: $1.0M
  850000,  // P6: $850k
  700000,  // P7: $700k
  550000,  // P8: $550k
  450000,  // P9: $450k
  350000,  // P10: $350k
  200000,  // P11-P20 participation
];

export const ENGINE_OPTIONS: EngineOption[] = [
  {
    id: 'audi_v6',
    name: 'Audi Sport F1 V6',
    supplier: 'Audi Revolut Motorsport',
    purchaseCost: 22000000,
    costPerRace: 1200000,
    topSpeedKmh: 338,
    powerRating: 88,
    reliabilityRating: 90,
    description: 'German precision engineering. Smooth throttle mapping and reliable electrical harvest.',
  },
  {
    id: 'honda_hrc',
    name: 'Honda HRC Performance',
    supplier: 'Honda Racing Corporation',
    purchaseCost: 28000000,
    costPerRace: 1600000,
    topSpeedKmh: 345,
    powerRating: 93,
    reliabilityRating: 95,
    description: 'Advanced MGU-K electrical boost and rapid battery deployment down main straights.',
  },
  {
    id: 'mercedes_m17',
    name: 'Mercedes-AMG M17 High Output',
    supplier: 'Mercedes-AMG High Performance Powertrains',
    purchaseCost: 38000000,
    costPerRace: 2100000,
    topSpeedKmh: 352,
    powerRating: 96,
    reliabilityRating: 98,
    description: 'Brixworth engineering masterpiece. Linear acceleration and rock-solid championship reliability.',
  },
  {
    id: 'ferrari_066',
    name: 'Ferrari 066/14 V6 Turbo',
    supplier: 'Scuderia Ferrari Power Units',
    purchaseCost: 45000000,
    costPerRace: 2500000,
    topSpeedKmh: 356,
    powerRating: 98,
    reliabilityRating: 92,
    description: 'Fierce Italian combustion boost. Enormous acceleration punch out of medium and slow corners.',
  },
  {
    id: 'redbull_ford',
    name: 'Ford Red Bull Powertrains',
    supplier: 'Red Bull Ford Powertrains Milton Keynes',
    purchaseCost: 52000000,
    costPerRace: 2800000,
    topSpeedKmh: 362,
    powerRating: 101,
    reliabilityRating: 94,
    description: 'Aggressive turbocharger boost and high-velocity top-end down long DRS straights.',
  },
  {
    id: 'works_inhouse',
    name: 'Works In-House Bespoke PU',
    supplier: 'Your Independent Team Engine Division',
    purchaseCost: 85000000, // Capital investment: High-tech dyno cells, factory foundry, and master engine staff
    costPerRace: 3200000, // Operating fee includes retained PU master engineers and Dyno technicians
    topSpeedKmh: 368,
    powerRating: 105,
    reliabilityRating: 97,
    isWorksCustom: true,
    description: 'Bespoke in-house works engine program. Top-tier velocity, customizable on dyno bench, maximum constructor prestige.',
  },
];

export const CUSTOMER_PU_OFFERS: CustomerTeamPUOffer[] = [
  {
    teamId: 'haas',
    teamName: 'MoneyGram Haas F1 Team',
    minPowerRequired: 80,
    feePerRace: 3200000,
    signingBonus: 4000000,
    description: 'Seeking reliable works customer power unit partnership to break out of the backmarker fight.',
  },
  {
    teamId: 'williams',
    teamName: 'Williams Racing',
    minPowerRequired: 84,
    feePerRace: 3900000,
    signingBonus: 5500000,
    description: 'Wants grid-leading straightaway velocity and low electrical harvest drag down DRS straights.',
  },
  {
    teamId: 'audi',
    teamName: 'Audi Revolut F1 Team',
    minPowerRequired: 88,
    feePerRace: 4800000,
    signingBonus: 6500000,
    description: 'Interim high-performance customer PU lease program while developing German factory architecture.',
  },
  {
    teamId: 'alpine',
    teamName: 'BWT Alpine F1 Team',
    minPowerRequired: 92,
    feePerRace: 5600000,
    signingBonus: 7500000,
    description: 'Seeking next-generation customer turbo architecture to battle for regular podium finishes.',
  },
  {
    teamId: 'rb',
    teamName: 'Visa Cash App RB F1 Team',
    minPowerRequired: 96,
    feePerRace: 6400000,
    signingBonus: 8500000,
    description: 'Elite customer powertrain lease to challenge the top 4 constructors.',
  },
  {
    teamId: 'astonmartin',
    teamName: 'Aston Martin Aramco',
    minPowerRequired: 100,
    feePerRace: 7800000,
    signingBonus: 10000000,
    description: 'Marquee customer partner offering astronomical funding for hyper-spec works power units.',
  },
];

export const AERO_STAFF_OPTIONS: AeroStaffOption[] = [
  {
    id: 'junior_aero',
    title: 'Junior Aero Group',
    name: 'Graduate Engineering Crew',
    hiringFee: 1200000,
    salaryPerRace: 120000,
    downforceBonus: 0.05,
    handlingBonus: 5,
    dragReduction: 0.04,
    description: 'Entry-level CFD aerodynamicists providing baseline downforce gains and wing balance.',
  },
  {
    id: 'senior_aero',
    title: 'Senior Aerodynamicist',
    name: 'Ex-Mercedes Wind Tunnel Lead',
    hiringFee: 6500000,
    salaryPerRace: 480000,
    downforceBonus: 0.15,
    handlingBonus: 14,
    dragReduction: 0.11,
    description: 'Optimized front wing vortex generators and underfloor venturi tunnels for crisp high-speed turn-in.',
  },
  {
    id: 'master_director',
    title: 'Master Technical Director',
    name: 'Adrian Newey-Tier Design Legend',
    hiringFee: 22000000,
    salaryPerRace: 980000,
    downforceBonus: 0.28,
    handlingBonus: 25,
    dragReduction: 0.20,
    description: 'Revolutionary ground-effect packaging, ultra-low drag co-efficiency, and unmatched cornering speeds.',
  },
];

export const CHASSIS_ENGINEER_OPTIONS: ChassisEngineerOption[] = [
  {
    id: 'club_chassis',
    title: 'Standard Workshop Mechanics',
    name: 'Junior Suspension Technicians',
    hiringFee: 850000,
    salaryPerRace: 80000,
    handlingBonus: 4,
    mechanicalGripBonus: 0.05,
    description: 'Baseline pushrod suspension tuning and anti-roll bar geometry adjustments.',
  },
  {
    id: 'senior_chassis',
    title: 'Chief Race Engineer',
    name: 'Ex-Ferrari Dynamics Specialist',
    hiringFee: 4500000,
    salaryPerRace: 340000,
    handlingBonus: 12,
    mechanicalGripBonus: 0.14,
    description: 'Hydraulic heave spring control and zero-pitch chassis damping under heavy curb impacts.',
  },
  {
    id: 'legend_chassis',
    title: 'Master Vehicle Dynamics Chief',
    name: 'World Champion Vehicle Mastermind',
    hiringFee: 14000000,
    salaryPerRace: 650000,
    handlingBonus: 22,
    mechanicalGripBonus: 0.25,
    description: 'Active heave-stiffness optimization. Car rotates on a dime with zero mid-corner understeer.',
  },
];

export const BRAKE_ENGINEER_OPTIONS: BrakeEngineerOption[] = [
  {
    id: 'oem_brakes',
    title: 'Club Brake Crew',
    name: 'Apprentice Brake Technicians',
    hiringFee: 750000,
    salaryPerRace: 70000,
    brakesBonus: 5,
    heatResistance: 0.06,
    description: 'Standard carbon-carbon disc cooling ducts and baseline pedal master cylinder balance.',
  },
  {
    id: 'pro_brakes',
    title: 'Brembo Trackside Specialist',
    name: 'Advanced Hydraulic Systems Engineer',
    hiringFee: 3800000,
    salaryPerRace: 290000,
    brakesBonus: 14,
    heatResistance: 0.16,
    description: 'Carbon-silicon composite disc formulation and titanium calipers for late-braking passes.',
  },
  {
    id: 'master_brakes',
    title: 'Chief Brake-by-Wire Architect',
    name: 'F1 Braking Legend Engineer',
    hiringFee: 11000000,
    salaryPerRace: 550000,
    brakesBonus: 24,
    heatResistance: 0.28,
    description: 'Ultra-instantaneous MGU-K regenerative and friction brake blending. Eliminates front wheel lockups!',
  },
];

export const ENGINE_ENGINEER_OPTIONS: EngineEngineerOption[] = [
  {
    id: 'junior_dyno_eng',
    title: 'Dyno Bench Technician',
    name: 'Apprentice Powertrain Crew',
    hiringFee: 1800000,
    salaryPerRace: 140000,
    successBonus: 12,
    failureReduction: 10,
    powerGainBonus: 1,
    description: 'Baseline engine block dyno calibrations and standard turbo boost monitoring. High risk of building a worse engine without senior oversight!',
  },
  {
    id: 'senior_engine_dev',
    title: 'Senior Powertrain & Turbo Specialist',
    name: 'Ex-Brixworth High Performance Engineer',
    hiringFee: 7500000,
    salaryPerRace: 480000,
    successBonus: 28,
    failureReduction: 32,
    powerGainBonus: 2,
    description: 'Precision pneumatic valve timing, CNC intercooler ducting, and MGU-H energy spool optimization. Significantly raises successful dyno run probability.',
  },
  {
    id: 'legend_engine_chief',
    title: 'Chief Engine Architect',
    name: 'World Championship Power Unit Director',
    hiringFee: 22000000,
    salaryPerRace: 920000,
    successBonus: 48,
    failureReduction: 60,
    powerGainBonus: 4,
    description: 'Bespoke combustion chamber geometry and instant turbo anti-lag. Dramatically lowers risk of building a worse engine and unlocks maximum power gains!',
  },
];

export const ENGINE_SCIENTIST_OPTIONS: EngineScientistOption[] = [
  {
    id: 'junior_scientist',
    title: 'Materials Lab Analyst',
    name: 'Graduate Thermodynamics Researcher',
    hiringFee: 2200000,
    salaryPerRace: 160000,
    successBonus: 10,
    failureReduction: 12,
    powerCeilingBonus: 1,
    description: 'Basic computational fluid dynamics and fuel atomization analysis for pre-chamber ignition.',
  },
  {
    id: 'senior_scientist',
    title: 'Principal Thermal Scientist',
    name: 'Quantum Metallurgy & Combustion Physicist',
    hiringFee: 9000000,
    salaryPerRace: 540000,
    successBonus: 26,
    failureReduction: 35,
    powerCeilingBonus: 3,
    description: 'Ultra-high-pressure pre-chamber lean burn chemistry and titanium aluminide heat rejection. Stabilizes combustion under extreme cylinder pressures.',
  },
  {
    id: 'legend_scientist',
    title: 'Distinguished Fellow of Motorsport Science',
    name: 'Aerospace Propulsion & Thermodynamics Master',
    hiringFee: 26000000,
    salaryPerRace: 1050000,
    successBonus: 46,
    failureReduction: 68,
    powerCeilingBonus: 5,
    description: 'Nanocrystalline diamond coating and supersonic fuel spray mapping. Virtually eliminates dyno knocking, pre-ignition, and catastrophic engine degradation!',
  },
];

export const SPONSOR_OPTIONS: SponsorOption[] = [
  {
    id: 'apex_telecom',
    name: 'Apex Global Telecom',
    tier: 'Major',
    basePayPerRace: 6500000,
    winBonus: 8000000,
    podiumBonus: 4000000,
    pointsBonus: 1500000,
    requiredReputation: 15,
    description: 'Reliable telecommunications giant offering consistent baseline operational backing.',
  },
  {
    id: 'orion_energy',
    name: 'Orion Hydrogen Clean Energy',
    tier: 'Premium',
    basePayPerRace: 10500000,
    winBonus: 12000000,
    podiumBonus: 6500000,
    pointsBonus: 3000000,
    requiredReputation: 45,
    description: 'High-value green technology brand with lucrative podium performance escalators.',
  },
  {
    id: 'hyperion_crypto',
    name: 'Hyperion Quantum Cloud & AI',
    tier: 'Title',
    basePayPerRace: 16000000,
    winBonus: 18000000,
    podiumBonus: 10000000,
    pointsBonus: 5000000,
    requiredReputation: 75,
    description: 'Marquee Title Sponsor offering astronomical payouts for race victories and championship contention.',
  },
];

export const TEAM_CONTRACTS: TeamContractOffer[] = [
  {
    teamId: 'haas',
    minRating: 75,
    minPoints: 0,
    minWins: 0,
    minPodiums: 0,
    salaryPerRace: 180000,
    signingBonus: 500000,
    midSeasonBuyoutFee: 400000,
    prestigeTier: 'Rookie',
    teamExpectation: 'Scoring points in top 10 is considered a huge success.',
  },
  {
    teamId: 'williams',
    minRating: 78,
    minPoints: 10,
    minWins: 0,
    minPodiums: 0,
    salaryPerRace: 320000,
    signingBonus: 850000,
    midSeasonBuyoutFee: 650000,
    prestigeTier: 'Rookie',
    teamExpectation: 'Regular Q3 appearances and championship points.',
  },
  {
    teamId: 'rb',
    minRating: 80,
    minPoints: 16,
    minWins: 0,
    minPodiums: 0,
    salaryPerRace: 420000,
    signingBonus: 1100000,
    midSeasonBuyoutFee: 900000,
    prestigeTier: 'Rookie',
    teamExpectation: 'Fighting for top 8 and developing for Red Bull Racing.',
  },
  {
    teamId: 'audi',
    minRating: 82,
    minPoints: 24,
    minWins: 0,
    minPodiums: 0,
    salaryPerRace: 680000,
    signingBonus: 1800000,
    midSeasonBuyoutFee: 1400000,
    prestigeTier: 'Midfield',
    teamExpectation: 'Leading the German works program into the top 6.',
  },
  {
    teamId: 'alpine',
    minRating: 83,
    minPoints: 30,
    minWins: 0,
    minPodiums: 1,
    salaryPerRace: 780000,
    signingBonus: 2200000,
    midSeasonBuyoutFee: 1600000,
    prestigeTier: 'Midfield',
    teamExpectation: 'Top 5 finishes and capitalizing on wet/chaotic races.',
  },
  {
    teamId: 'astonmartin',
    minRating: 86,
    minPoints: 42,
    minWins: 0,
    minPodiums: 2,
    salaryPerRace: 1100000,
    signingBonus: 3500000,
    midSeasonBuyoutFee: 2400000,
    prestigeTier: 'Midfield',
    teamExpectation: 'Challenging the top 3 with Honda power unit.',
  },
  {
    teamId: 'mercedes',
    minRating: 89,
    minPoints: 60,
    minWins: 1,
    minPodiums: 3,
    salaryPerRace: 1750000,
    signingBonus: 6000000,
    midSeasonBuyoutFee: 4000000,
    prestigeTier: 'Contender',
    teamExpectation: 'Constant podium finishes and race victories.',
  },
  {
    teamId: 'ferrari',
    minRating: 92,
    minPoints: 75,
    minWins: 1,
    minPodiums: 4,
    salaryPerRace: 2200000,
    signingBonus: 8000000,
    midSeasonBuyoutFee: 5500000,
    prestigeTier: 'Contender',
    teamExpectation: 'World Drivers Championship contention. Unforgiving Tifosi.',
  },
  {
    teamId: 'mclaren',
    minRating: 93,
    minPoints: 85,
    minWins: 2,
    minPodiums: 5,
    salaryPerRace: 2500000,
    signingBonus: 9500000,
    midSeasonBuyoutFee: 6500000,
    prestigeTier: 'Championship',
    teamExpectation: 'Fighting for both Drivers and Constructors crowns.',
  },
  {
    teamId: 'redbull',
    minRating: 95,
    minPoints: 95,
    minWins: 3,
    minPodiums: 6,
    salaryPerRace: 3000000,
    signingBonus: 12000000,
    midSeasonBuyoutFee: 8000000,
    prestigeTier: 'Championship',
    teamExpectation: 'Total dominance alongside Max Verstappen.',
  },
];

export const TEAMS: Team[] = [
  {
    id: 'haas',
    name: 'MoneyGram Haas F1 Team',
    shortName: 'Haas',
    engine: 'Ferrari 066/14 V6 Turbo',
    primaryColor: '#E60000',
    secondaryColor: '#1A1A1A',
    accentColor: '#FFFFFF',
    performanceTier: 4,
    drivers: ['bearman', 'ocon'],
    reputationRequired: 0,
    baseSalary: 180000,
    carProfile: {
      topSpeedRating: 83,
      handlingRating: 77,
      aeroDownforce: 76,
      acceleration: 82,
      brakesRating: 79,
      strengths: ['Decent mechanical grip in low-speed hairpins', 'Reliable Ferrari engine power delivery'],
      weaknesses: ['Noticeable top-end speed deficit down main straights', 'Heavy front-end understeer when pushing into fast corners', 'Requires earlier braking zones'],
    },
  },
  {
    id: 'williams',
    name: 'Williams Racing',
    shortName: 'Williams',
    engine: 'Mercedes-AMG M17',
    primaryColor: '#00A3E0',
    secondaryColor: '#001A30',
    accentColor: '#FFFFFF',
    performanceTier: 4,
    drivers: ['sainz', 'albon'],
    reputationRequired: 15,
    baseSalary: 320000,
    carProfile: {
      topSpeedRating: 105, // Exceeds 100: Monstrous straight line rocket!
      handlingRating: 80,
      aeroDownforce: 78,
      acceleration: 89,
      brakesRating: 82,
      strengths: ['Monstrous low-drag aerodynamic profile with blistering straightaway top speed (370+ km/h)', 'Lethal DRS slipstream overtaking down main straights'],
      weaknesses: ['Lower aerodynamic downforce causing slides in medium-speed sweepers', 'Prone to front axle lockups under heavy braking'],
    },
  },
  {
    id: 'audi',
    name: 'Audi Revolut F1 Team',
    shortName: 'Audi',
    engine: 'Audi Sport F1 V6',
    primaryColor: '#94A3B8',
    secondaryColor: '#FF1801',
    accentColor: '#0F172A',
    performanceTier: 3,
    drivers: ['hulkenberg', 'bortoleto'],
    reputationRequired: 35,
    baseSalary: 680000,
    carProfile: {
      topSpeedRating: 87,
      handlingRating: 86,
      aeroDownforce: 84,
      acceleration: 86,
      brakesRating: 92,
      strengths: ['Exceptional carbon-tub chassis rigidity and curb stability', 'Solid German braking system stability'],
      weaknesses: ['Heavier engine packaging impacting high-speed directional changes', 'Medium-speed mid-corner push understeer'],
    },
  },
  {
    id: 'alpine',
    name: 'BWT Alpine F1 Team',
    shortName: 'Alpine',
    engine: 'Mercedes-AMG M17 High Output',
    primaryColor: '#0090FF',
    secondaryColor: '#FF87BC',
    accentColor: '#001E3C',
    performanceTier: 3,
    drivers: ['gasly', 'doohan'],
    reputationRequired: 45,
    baseSalary: 780000,
    carProfile: {
      topSpeedRating: 88,
      handlingRating: 85,
      aeroDownforce: 85,
      acceleration: 87,
      brakesRating: 85,
      strengths: ['Balanced front-to-rear aerodynamic balance', 'Solid braking trail performance into chicanes'],
      weaknesses: ['Inconsistent rear downforce under heavy lateral load', 'Deficit in sustained straightaway acceleration'],
    },
  },
  {
    id: 'rb',
    name: 'Visa Cash App RB F1 Team',
    shortName: 'RB',
    engine: 'Ford Red Bull Powertrains',
    primaryColor: '#1634CB',
    secondaryColor: '#FFFFFF',
    accentColor: '#FF1801',
    performanceTier: 3,
    drivers: ['tsunoda', 'hadjar'],
    reputationRequired: 25,
    baseSalary: 420000,
    carProfile: {
      topSpeedRating: 91,
      handlingRating: 88,
      aeroDownforce: 87,
      acceleration: 93,
      brakesRating: 86,
      strengths: ['Punchy corner exit traction and rapid acceleration out of slow corners', 'Agile turn-in response through tight chicanes'],
      weaknesses: ['Twitchy on bumpy street curb strikes', 'Sensitive to high-speed wind shears'],
    },
  },
  {
    id: 'astonmartin',
    name: 'Aston Martin Aramco Honda',
    shortName: 'Aston Martin',
    engine: 'Honda HRC Performance',
    primaryColor: '#00594F',
    secondaryColor: '#CEDC00',
    accentColor: '#0F2623',
    performanceTier: 2,
    drivers: ['alonso', 'stroll'],
    reputationRequired: 55,
    baseSalary: 1100000,
    carProfile: {
      topSpeedRating: 93,
      handlingRating: 92,
      aeroDownforce: 91,
      acceleration: 92,
      brakesRating: 91,
      strengths: ['Sharp front-end bite on corner turn-in', 'Honda electrical MGU-K instantaneous boost deployment'],
      weaknesses: ['Higher wing drag profile limiting maximum terminal velocity on ultra-long straights'],
    },
  },
  {
    id: 'mercedes',
    name: 'Mercedes-AMG PETRONAS',
    shortName: 'Mercedes',
    engine: 'Mercedes-AMG M17 V6 Turbo',
    primaryColor: '#00A19B',
    secondaryColor: '#C8CCCE',
    accentColor: '#0F172A',
    performanceTier: 2,
    drivers: ['russell', 'antonelli'],
    reputationRequired: 70,
    baseSalary: 1750000,
    carProfile: {
      topSpeedRating: 103,
      handlingRating: 102,
      aeroDownforce: 102,
      acceleration: 103,
      brakesRating: 108, // Exceeds 100: Grid-leading stopping power!
      strengths: ['Hyper-spec carbon-silicon brakes: unmatched late-braking passes and stopping distances', 'Rock-solid powertrain reliability and linear acceleration'],
      weaknesses: ['Occasional low-speed hairpins understeer balance'],
    },
  },
  {
    id: 'ferrari',
    name: 'Scuderia Ferrari HP',
    shortName: 'Ferrari',
    engine: 'Ferrari 066/14 V6 Turbo',
    primaryColor: '#DC0000',
    secondaryColor: '#FFFFFF',
    accentColor: '#FFF500',
    performanceTier: 1,
    drivers: ['leclerc', 'hamilton'],
    reputationRequired: 80,
    baseSalary: 2200000,
    carProfile: {
      topSpeedRating: 105, // Superfast straightaway speed!
      handlingRating: 102,
      aeroDownforce: 104,
      acceleration: 107, // Explosive Italian combustion launch!
      brakesRating: 98,
      strengths: ['Explosive slow-corner exit traction and monstrous pre-chamber turbo boost', 'Fierce acceleration out of slow corners'],
      weaknesses: ['Higher tire wear under aggressive throttle applications', 'Snappy oversteer on limit of traction'],
    },
  },
  {
    id: 'mclaren',
    name: 'McLaren Mastercard F1',
    shortName: 'McLaren',
    engine: 'Mercedes-AMG M17',
    primaryColor: '#FF8000',
    secondaryColor: '#1E2328',
    accentColor: '#00E5FF',
    performanceTier: 1,
    drivers: ['norris', 'piastri'],
    reputationRequired: 88,
    baseSalary: 2500000,
    carProfile: {
      topSpeedRating: 104, // World Championship winning top-end speed!
      handlingRating: 108, // Telepathic cornering!
      aeroDownforce: 109, // Benchmark ground effect floor suction!
      acceleration: 105, // High-traction launch!
      brakesRating: 99,
      strengths: ['Supreme high-speed downforce: corners like on rails through fast esses and chicanes', 'Near-telepathic turn-in response and outstanding tire preservation'],
      weaknesses: ['Slightly lower top speed at the end of ultra-long DRS straights compared to Williams'],
    },
  },
  {
    id: 'redbull',
    name: 'Red Bull Racing Ford',
    shortName: 'Red Bull',
    engine: 'Ford Red Bull Powertrains',
    primaryColor: '#0B132B',
    secondaryColor: '#D62828',
    accentColor: '#F77F00',
    performanceTier: 1,
    drivers: ['verstappen', 'lawson'],
    reputationRequired: 95,
    baseSalary: 3000000,
    carProfile: {
      topSpeedRating: 104,
      handlingRating: 101,
      aeroDownforce: 101,
      acceleration: 103,
      brakesRating: 96,
      strengths: ['Unmatched straightaway velocity and lethal DRS top speed exceeding 375 km/h', 'Phenomenal aerodynamic floor balance at high speed'],
      weaknesses: ['Stiff suspension setup requires careful curb negotiation'],
    },
  },
];

export const DRIVERS: Driver[] = [
  // Red Bull
  { id: 'verstappen', name: 'Max Verstappen', shortName: 'VER', number: 1, country: 'Netherlands', countryCode: 'NL', teamId: 'redbull', rating: 96, aggression: 0.91, color: '#0B132B', contractExpiring: false, willingToJoinCustomTeam: false, salaryPerRaceDemand: 3500000, obedienceRating: 75 },
  { id: 'lawson', name: 'Liam Lawson', shortName: 'LAW', number: 30, country: 'New Zealand', countryCode: 'NZ', teamId: 'redbull', rating: 87, aggression: 0.83, color: '#D62828', contractExpiring: true, willingToJoinCustomTeam: true, salaryPerRaceDemand: 450000, obedienceRating: 92 },

  // Ferrari
  { id: 'leclerc', name: 'Charles Leclerc', shortName: 'LEC', number: 16, country: 'Monaco', countryCode: 'MC', teamId: 'ferrari', rating: 96, aggression: 0.92, color: '#DC0000', contractExpiring: false, willingToJoinCustomTeam: false, salaryPerRaceDemand: 2800000, obedienceRating: 82 },
  { id: 'hamilton', name: 'Lewis Hamilton', shortName: 'HAM', number: 44, country: 'United Kingdom', countryCode: 'GB', teamId: 'ferrari', rating: 96, aggression: 0.91, color: '#FFF500', contractExpiring: false, willingToJoinCustomTeam: false, salaryPerRaceDemand: 3000000, obedienceRating: 80 },

  // McLaren
  { id: 'norris', name: 'Lando Norris', shortName: 'NOR', number: 4, country: 'United Kingdom', countryCode: 'GB', teamId: 'mclaren', rating: 97, aggression: 0.93, color: '#FF8000', contractExpiring: false, willingToJoinCustomTeam: false, salaryPerRaceDemand: 2600000, obedienceRating: 80 },
  { id: 'piastri', name: 'Oscar Piastri', shortName: 'PIA', number: 81, country: 'Australia', countryCode: 'AU', teamId: 'mclaren', rating: 96, aggression: 0.90, color: '#00E5FF', contractExpiring: false, willingToJoinCustomTeam: false, salaryPerRaceDemand: 2200000, obedienceRating: 86 },

  // Mercedes
  { id: 'russell', name: 'George Russell', shortName: 'RUS', number: 63, country: 'United Kingdom', countryCode: 'GB', teamId: 'mercedes', rating: 95, aggression: 0.90, color: '#00A19B', contractExpiring: false, willingToJoinCustomTeam: false, salaryPerRaceDemand: 2000000, obedienceRating: 78 },
  { id: 'antonelli', name: 'Kimi Antonelli', shortName: 'ANT', number: 12, country: 'Italy', countryCode: 'IT', teamId: 'mercedes', rating: 89, aggression: 0.85, color: '#C8CCCE', contractExpiring: false, willingToJoinCustomTeam: false, salaryPerRaceDemand: 1100000, obedienceRating: 94 },

  // Aston Martin
  { id: 'alonso', name: 'Fernando Alonso', shortName: 'ALO', number: 14, country: 'Spain', countryCode: 'ES', teamId: 'astonmartin', rating: 94, aggression: 0.92, color: '#00594F', contractExpiring: true, willingToJoinCustomTeam: false, salaryPerRaceDemand: 2200000, obedienceRating: 74 },
  { id: 'stroll', name: 'Lance Stroll', shortName: 'STR', number: 18, country: 'Canada', countryCode: 'CA', teamId: 'astonmartin', rating: 84, aggression: 0.79, color: '#CEDC00', contractExpiring: false, willingToJoinCustomTeam: false, salaryPerRaceDemand: 1200000, obedienceRating: 80 },

  // Audi
  { id: 'hulkenberg', name: 'Nico Hülkenberg', shortName: 'HUL', number: 27, country: 'Germany', countryCode: 'DE', teamId: 'audi', rating: 88, aggression: 0.82, color: '#94A3B8', contractExpiring: true, willingToJoinCustomTeam: true, salaryPerRaceDemand: 700000, obedienceRating: 90 },
  { id: 'bortoleto', name: 'Gabriel Bortoleto', shortName: 'BOR', number: 5, country: 'Brazil', countryCode: 'BR', teamId: 'audi', rating: 85, aggression: 0.80, color: '#FF1801', contractExpiring: true, willingToJoinCustomTeam: true, salaryPerRaceDemand: 300000, obedienceRating: 95 },

  // Williams
  { id: 'sainz', name: 'Carlos Sainz', shortName: 'SAI', number: 55, country: 'Spain', countryCode: 'ES', teamId: 'williams', rating: 94, aggression: 0.88, color: '#00A3E0', contractExpiring: false, willingToJoinCustomTeam: false, salaryPerRaceDemand: 1600000, obedienceRating: 80 },
  { id: 'albon', name: 'Alexander Albon', shortName: 'ALB', number: 23, country: 'Thailand', countryCode: 'TH', teamId: 'williams', rating: 89, aggression: 0.83, color: '#001A30', contractExpiring: false, willingToJoinCustomTeam: true, salaryPerRaceDemand: 950000, obedienceRating: 88 },

  // Alpine
  { id: 'gasly', name: 'Pierre Gasly', shortName: 'GAS', number: 10, country: 'France', countryCode: 'FR', teamId: 'alpine', rating: 89, aggression: 0.85, color: '#0090FF', contractExpiring: true, willingToJoinCustomTeam: true, salaryPerRaceDemand: 800000, obedienceRating: 78 },
  { id: 'doohan', name: 'Jack Doohan', shortName: 'DOO', number: 7, country: 'Australia', countryCode: 'AU', teamId: 'alpine', rating: 83, aggression: 0.78, color: '#FF87BC', contractExpiring: true, willingToJoinCustomTeam: true, salaryPerRaceDemand: 260000, obedienceRating: 96 },

  // RB
  { id: 'tsunoda', name: 'Yuki Tsunoda', shortName: 'TSU', number: 22, country: 'Japan', countryCode: 'JP', teamId: 'rb', rating: 88, aggression: 0.89, color: '#1634CB', contractExpiring: true, willingToJoinCustomTeam: true, salaryPerRaceDemand: 550000, obedienceRating: 78 },
  { id: 'hadjar', name: 'Isack Hadjar', shortName: 'HAD', number: 6, country: 'France', countryCode: 'FR', teamId: 'rb', rating: 84, aggression: 0.81, color: '#FF1801', contractExpiring: true, willingToJoinCustomTeam: true, salaryPerRaceDemand: 280000, obedienceRating: 92 },

  // Haas (Starting Rookie Team)
  { id: 'bearman', name: 'Oliver Bearman', shortName: 'BEA', number: 87, country: 'United Kingdom', countryCode: 'GB', teamId: 'haas', rating: 86, aggression: 0.84, color: '#E60000', contractExpiring: true, willingToJoinCustomTeam: true, salaryPerRaceDemand: 350000, obedienceRating: 94 },
  { id: 'ocon', name: 'Esteban Ocon', shortName: 'OCO', number: 31, country: 'France', countryCode: 'FR', teamId: 'haas', rating: 88, aggression: 0.88, color: '#1A1A1A', contractExpiring: true, willingToJoinCustomTeam: true, salaryPerRaceDemand: 650000, obedienceRating: 75 },

  // Default Starting Teammate for Newly Created Constructor Teams
  { id: 'rookie_teammate', name: 'Luca Sterling (Academy Rookie)', shortName: 'STE', number: 88, country: 'United States', countryCode: 'US', teamId: 'custom_f1_team', rating: 78, aggression: 0.74, color: '#10b981', contractExpiring: true, willingToJoinCustomTeam: true, salaryPerRaceDemand: 220000, obedienceRating: 95 },
];

function createTrackSpline(points: [number, number, number][]): TrackPoint[] {
  // Ensure y is strictly >= 0.25 so no road, curbs, or barriers plunge underneath ground level (y=-0.3)
  return points.map(([x, y, z]) => ({
    x,
    y: Math.max(0.25, y),
    z,
  }));
}

export const CIRCUITS: CircuitInfo[] = [
  // 1. Bahrain Grand Prix (Sakhir) - Desert oasis with technical hairpin Turn 1 and double-apex Turn 9-10
  {
    id: 'bahrain',
    name: 'Bahrain Grand Prix',
    location: 'Sakhir International Circuit',
    country: 'Bahrain',
    countryCode: 'BH',
    lengthKm: 5.412,
    turns: 15,
    lapRecord: '1:31.447',
    recordHolder: 'Pedro de la Rosa',
    description: 'High-speed desert twilight race with intense braking into Turn 1 hairpin, downhill off-camber Turn 9-10, and sweeping back straight.',
    skyColor: 0x0f1526,
    fogColor: 0x141d33,
    ambientLight: 0.72,
    timeOfDay: 'twilight',
    trackPoints: createTrackSpline([
      [0, 0.25, 0],
      [0, 0.25, -140],
      [0, 0.25, -260],
      [45, 0.25, -330],
      [100, 0.25, -340],
      [140, 0.25, -290],
      [120, 0.25, -210],
      [135, 0.25, -110],
      [165, 0.25, -20],
      [220, 0.25, 45],
      [270, 0.25, 10],
      [320, 0.25, 65],
      [360, 0.25, 140],
      [330, 0.25, 205],
      [260, 0.25, 215],
      [160, 0.25, 195],
      [60, 0.25, 175],
      [-25, 0.25, 145],
      [-90, 0.25, 90],
      [-80, 0.25, 30],
      [-30, 0.25, 5],
    ]),
  },

  // 2. Saudi Arabian Grand Prix (Jeddah) - Narrow, ultra-fast elongated needle along the Red Sea coast
  {
    id: 'jeddah',
    name: 'Saudi Arabian Grand Prix',
    location: 'Jeddah Corniche Circuit',
    country: 'Saudi Arabia',
    countryCode: 'SA',
    lengthKm: 6.174,
    turns: 27,
    lapRecord: '1:30.734',
    recordHolder: 'Lewis Hamilton',
    description: 'The fastest street track in Formula 1 history. An ultra-elongated coastal corridor with rapid 250+ km/h blind sweeps along the Red Sea.',
    skyColor: 0x091124,
    fogColor: 0x0d1830,
    ambientLight: 0.75,
    timeOfDay: 'twilight',
    trackPoints: createTrackSpline([
      [0, 0.25, 0],
      [0, 0.25, -180],
      [0, 0.25, -360],
      [30, 0.25, -440],
      [-15, 0.25, -520],
      [25, 0.25, -630],
      [-20, 0.25, -750],
      [20, 0.25, -870],
      [70, 0.45, -960],
      [140, 0.45, -940],
      [170, 0.25, -860],
      [150, 0.25, -730],
      [180, 0.25, -550],
      [140, 0.25, -360],
      [165, 0.25, -170],
      [130, 0.25, 10],
      [80, 0.25, 90],
      [10, 0.25, 75],
      [-15, 0.25, 35],
    ]),
  },

  // 3. Australian Grand Prix (Melbourne) - Organic parkland loop encircling Albert Park Lake
  {
    id: 'melbourne',
    name: 'Australian Grand Prix',
    location: 'Albert Park Circuit',
    country: 'Australia',
    countryCode: 'AU',
    lengthKm: 5.278,
    turns: 14,
    lapRecord: '1:19.813',
    recordHolder: 'Charles Leclerc',
    description: 'Picturesque parkland street circuit curving around Albert Park lake, featuring fast chicanes and wide open corner sightlines.',
    skyColor: 0x3882d6,
    fogColor: 0x62a1ea,
    ambientLight: 0.9,
    timeOfDay: 'day',
    trackPoints: createTrackSpline([
      [0, 0.25, 0],
      [0, 0.25, -130],
      [0, 0.25, -250],
      [55, 0.25, -320],
      [110, 0.25, -290],
      [160, 0.25, -190],
      [220, 0.25, -220],
      [290, 0.25, -170],
      [350, 0.25, -70],
      [385, 0.25, 50],
      [360, 0.25, 170],
      [295, 0.25, 260],
      [205, 0.25, 310],
      [95, 0.25, 325],
      [15, 0.25, 275],
      [-35, 0.25, 175],
      [-20, 0.25, 80],
    ]),
  },

  // 4. Japanese Grand Prix (Suzuka) - Iconic Figure-8 with crossover bridge elevation and sweeping 130R
  {
    id: 'suzuka',
    name: 'Japanese Grand Prix',
    location: 'Suzuka International Racing Course',
    country: 'Japan',
    countryCode: 'JP',
    lengthKm: 5.807,
    turns: 18,
    lapRecord: '1:30.983',
    recordHolder: 'Lewis Hamilton',
    description: 'The driver’s ultimate test. Iconic Figure-8 layout featuring uphill esses, Degner curves, the Spoon Curve, and flat-out 130R.',
    skyColor: 0x486581,
    fogColor: 0x627d98,
    ambientLight: 0.88,
    timeOfDay: 'day',
    trackPoints: createTrackSpline([
      [0, 0.25, 0],
      [0, 0.25, -120],
      [0, 0.25, -230], // Main straight
      [45, 0.35, -305], // Turn 1 First Corner
      [105, 0.45, -320], // Turn 2
      [145, 0.6, -280],
      [135, 0.75, -215], // S-Curves Turn 3
      [175, 0.95, -155], // S-Curves Turn 4
      [160, 1.15, -95], // S-Curves Turn 5
      [195, 1.35, -35], // S-Curves Turn 6
      [185, 1.55, 30], // Dunlop curve
      [150, 1.6, 85],
      [105, 1.55, 125],
      [135, 1.45, 165], // Degner 1
      [180, 1.3, 185], // Degner 2
      [225, 1.1, 160],
      [255, 0.9, 100],
      [280, 0.75, 30],
      [315, 0.6, -20], // Turn 11 Hairpin
      [340, 0.6, 15],
      [330, 0.65, 75],
      [345, 0.75, 160], // 200R
      [370, 0.85, 255],
      [365, 0.9, 345], // Spoon approach
      [335, 0.9, 415], // Spoon Turn 13
      [275, 0.85, 450], // Spoon Turn 14
      [210, 0.75, 435],
      [165, 0.65, 380], // Spoon exit onto Backstraight
      [120, 0.55, 290], // Backstraight
      [85, 0.45, 190],
      [55, 0.35, 110], // 130R approach
      [30, 0.3, 60], // 130R
      [10, 0.25, 30], // Casio Triangle chicane
      [0, 0.25, 15], // Onto pit straight
    ]),
  },

  // 5. Miami Grand Prix - Polygon stadium perimeter with the ultra-long south straight & marina chicanes
  {
    id: 'miami',
    name: 'Miami Grand Prix',
    location: 'Miami International Autodrome',
    country: 'United States',
    countryCode: 'US',
    lengthKm: 5.412,
    turns: 19,
    lapRecord: '1:29.708',
    recordHolder: 'Max Verstappen',
    description: 'Fast modern street-hybrid circuit encircling Hard Rock Stadium, with tight chicanes and massive high-speed overtaking straights.',
    skyColor: 0x2b82c9,
    fogColor: 0x4ca1e4,
    ambientLight: 0.95,
    timeOfDay: 'day',
    trackPoints: createTrackSpline([
      [0, 0.25, 0],
      [0, 0.25, -160],
      [0, 0.25, -290],
      [-65, 0.25, -360],
      [-145, 0.25, -345],
      [-205, 0.25, -270],
      [-245, 0.25, -170],
      [-275, 0.25, -65],
      [-230, 0.25, 35],
      [-285, 0.25, 135],
      [-315, 0.25, 245],
      [-260, 0.65, 335],
      [-195, 0.35, 385],
      [-65, 0.25, 410],
      [95, 0.25, 415],
      [245, 0.25, 395],
      [305, 0.25, 320],
      [290, 0.25, 225],
      [185, 0.25, 135],
      [75, 0.25, 65],
    ]),
  },

  // 6. Monaco Grand Prix - Authentic Monte Carlo waterfront harbour, Casino Square climb, and Fairmont Hairpin
  {
    id: 'monaco',
    name: 'Monaco Grand Prix',
    location: 'Circuit de Monaco',
    country: 'Monaco',
    countryCode: 'MC',
    lengthKm: 3.337,
    turns: 19,
    lapRecord: '1:12.909',
    recordHolder: 'Lewis Hamilton',
    description: 'The crown jewel of motorsport. Glamour through Casino Square, the iconic Fairmont Hairpin, the fast seafront tunnel, and the harbor chicane with wide-open apex sightlines.',
    skyColor: 0x3b82f6,
    fogColor: 0x60a5fa,
    ambientLight: 0.92,
    timeOfDay: 'day',
    trackPoints: createTrackSpline([
      [0, 0.25, 0], // Start/Finish on Boulevard Albert 1er
      [0, 0.25, -115], // Main straight
      [0, 0.25, -225], // Sainte Devote braking zone
      [35, 0.32, -305], // Sainte Devote Turn 1 wide entry
      [105, 0.45, -335], // Sainte Devote open apex
      [175, 0.65, -295], // Sainte Devote exit onto Beau Rivage
      [220, 0.90, -205], // Beau Rivage gradual climb (unobstructed sightline)
      [255, 1.15, -105], // Massenet approach
      [275, 1.25, 0], // Massenet sweeping right
      [265, 1.20, 95], // Casino Square smooth flow (zero blind crest)
      [295, 1.05, 185], // Mirabeau Haute entry
      [355, 0.90, 235], // Fairmont Hairpin wide entry
      [395, 0.75, 310], // Fairmont Hairpin outer sweep
      [365, 0.60, 390], // Fairmont Hairpin open apex
      [295, 0.45, 430], // Fairmont Hairpin exit toward Portier
      [245, 0.32, 505], // Portier smooth sweep onto seafront
      [225, 0.25, 600], // Tunnel high-speed sweep
      [175, 0.25, 685], // Tunnel exit braking zone
      [105, 0.25, 725], // Nouvelle Harbor Chicane wide entry
      [30, 0.25, 705], // Nouvelle Harbor Chicane apex
      [-25, 0.25, 635], // Tabac approach along Port Hercule
      [-55, 0.25, 535], // Tabac fast sweeper
      [-75, 0.25, 425], // Swimming Pool (Piscine) entry
      [-85, 0.25, 310], // Swimming Pool exit
      [-75, 0.25, 200], // La Rascasse wide entry
      [-40, 0.25, 105], // Anthony Noghès smooth exit
      [-10, 0.25, 45], // Aligning onto Boulevard Albert 1er straight
    ]),
  },

  // 7. British Grand Prix (Silverstone) - Historic airfield triangle with Copse, Maggotts-Becketts, & Stowe
  {
    id: 'silverstone',
    name: 'British Grand Prix',
    location: 'Silverstone Circuit',
    country: 'Great Britain',
    countryCode: 'GB',
    lengthKm: 5.891,
    turns: 18,
    lapRecord: '1:27.097',
    recordHolder: 'Max Verstappen',
    description: 'The historic home of Formula 1. Ultra-high-speed sweeps through Copse, the breathtaking Maggotts-Becketts-Chapel complex, and Stowe.',
    skyColor: 0x5a6d7c,
    fogColor: 0x738696,
    ambientLight: 0.85,
    timeOfDay: 'day',
    trackPoints: createTrackSpline([
      [0, 0.25, 0], // Start/Finish on Hamilton Straight
      [0, 0.25, -90], // Hamilton Straight
      [0, 0.25, -180], // Braking zone into Abbey
      [30, 0.25, -240], // Abbey entry (Turn 1 - fast right)
      [80, 0.25, -270], // Abbey apex
      [140, 0.25, -265], // Farm curve (Turn 2 - gentle left flick)
      [200, 0.25, -240], // Approach to Village
      [240, 0.25, -195], // Village (Turn 3 - sharp right)
      [245, 0.25, -145], // Approaching The Loop
      [225, 0.25, -105], // The Loop hairpin apex (Turn 4 - tight left)
      [180, 0.25, -95], // The Loop exit
      [140, 0.25, -70], // Aintree (Turn 5 - left kink)
      [120, 0.25, -20], // Wellington Straight entry
      [110, 0.25, 60], // Wellington Straight
      [100, 0.25, 140], // Wellington Straight
      [95, 0.25, 210], // Wellington Straight braking zone
      [105, 0.25, 275], // Brooklands entry (Turn 6 - left)
      [145, 0.25, 325], // Brooklands apex / Luffield entry
      [205, 0.25, 335], // Luffield carousel (Turn 7 - long sweeping right)
      [255, 0.25, 305], // Luffield apex
      [275, 0.25, 245], // Woodcote (Turn 8 - fast right onto National Pit Straight)
      [290, 0.25, 160], // National Pit Straight
      [315, 0.25, 70], // National Pit Straight
      [345, 0.25, -20], // National Pit Straight
      [385, 0.25, -100], // Copse entry (Turn 9 - legendary fast right)
      [440, 0.25, -145], // Copse exit
      [500, 0.25, -155], // Maggotts entry (Turn 10 - fast left)
      [555, 0.25, -130], // Maggotts apex (Turn 11 - right flick)
      [585, 0.25, -75], // Becketts (Turn 12/13 - left-right complex)
      [580, 0.25, -15], // Chapel (Turn 14 - right hander onto Hangar Straight)
      [550, 0.25, 60], // Hangar Straight entry
      [505, 0.25, 160], // Hangar Straight
      [455, 0.25, 270], // Hangar Straight
      [395, 0.25, 380], // Stowe braking zone
      [340, 0.25, 455], // Stowe apex (Turn 15 - fast sweeping right)
      [270, 0.25, 495], // Stowe exit
      [195, 0.25, 505], // Vale braking zone (Turn 16)
      [130, 0.25, 475], // Vale chicane flick (Turn 17)
      [75, 0.25, 420], // Club entry (Turn 18 - double apex right)
      [35, 0.25, 340], // Club apex
      [15, 0.25, 230], // Club exit
      [5, 0.25, 120], // Accelerating onto Hamilton Straight
      [0, 0.25, 50], // Hamilton Straight approach to line
    ]),
  },

  // 8. Belgian Grand Prix (Spa-Francorchamps) - Undulating Ardennes rollercoaster with Eau Rouge & Raidillon
  {
    id: 'spa',
    name: 'Belgian Grand Prix',
    location: 'Circuit de Spa-Francorchamps',
    country: 'Belgium',
    countryCode: 'BE',
    lengthKm: 7.004,
    turns: 19,
    lapRecord: '1:46.286',
    recordHolder: 'Valtteri Bottas',
    description: 'Iconic undulating Ardennes rollercoaster featuring the compression of Eau Rouge and the flat-out Raidillon climb into the Kemmel Straight.',
    skyColor: 0x475869,
    fogColor: 0x5b7085,
    ambientLight: 0.82,
    timeOfDay: 'day',
    trackPoints: createTrackSpline([
      [0, 0.25, 0],
      [0, 0.25, -70],
      [0, 0.25, -150], // Pit straight heading down to La Source
      [35, 0.25, -200], // La Source hairpin right
      [85, 0.25, -190], // La Source exit
      [145, 0.18, -120], // Downhill sprint
      [195, 0.10, -40], // Eau Rouge dip
      [240, 1.45, 60], // Raidillon steep climb
      [280, 2.85, 170], // Raidillon crest
      [325, 3.5, 290], // Kemmel Straight uphill blast
      [370, 3.9, 420],
      [410, 4.0, 540],
      [430, 3.8, 620], // Les Combes chicane
      [380, 3.4, 660],
      [320, 2.9, 640],
      [270, 2.4, 570], // Malmedy
      [230, 1.9, 470], // Bruxelles (Rivage) hairpin
      [200, 1.5, 370],
      [180, 1.2, 280], // Speaker corner
      [160, 0.95, 200], // Pouhon double left entry
      [140, 0.75, 130], // Pouhon mid
      [115, 0.60, 75], // Pouhon exit
      [90, 0.50, 35], // Fagnes chicane
      [65, 0.42, 20], // Stavelot
      [45, 0.35, 15], // Courbe Paul Frère
      [30, 0.28, 12], // Blanchimont
      [18, 0.25, 10], // Bus Stop Chicane
      [0, 0.25, 5], // Start/finish straight
    ]),
  },

  // 9. Italian Grand Prix (Monza) - Temple of Speed with long blasts, Prima Variante, & Parabolica
  {
    id: 'monza',
    name: 'Italian Grand Prix',
    location: 'Autodromo Nazionale Monza',
    country: 'Italy',
    countryCode: 'IT',
    lengthKm: 5.793,
    turns: 11,
    lapRecord: '1:21.046',
    recordHolder: 'Rubens Barrichello',
    description: 'The Temple of Speed. Maximum engine deployment, low-drag 2026 wings, slipstreaming duels, and precision chicane kerbs.',
    skyColor: 0xd98638,
    fogColor: 0xb56928,
    ambientLight: 0.9,
    timeOfDay: 'sunset',
    trackPoints: createTrackSpline([
      [0, 0.25, 0],
      [0, 0.25, -180],
      [0, 0.25, -360], // Massive Rettifilo straight
      [35, 0.25, -440], // Prima Variante chicane
      [-20, 0.25, -480],
      [45, 0.25, -570], // Curva Grande sweeping right
      [145, 0.25, -640],
      [245, 0.25, -620],
      [315, 0.25, -530], // Variante della Roggia
      [345, 0.25, -445],
      [385, 0.25, -345], // Lesmo 1 & Lesmo 2
      [415, 0.25, -235],
      [395, 0.25, -95], // Serraglio under old banking bridge
      [355, 0.25, 65],
      [305, 0.25, 175], // Variante Ascari
      [245, 0.25, 225],
      [275, 0.25, 295],
      [255, 0.25, 435], // Back straight
      [205, 0.25, 555],
      [125, 0.25, 615], // Curva Parabolica
      [25, 0.25, 585],
      [-55, 0.25, 475],
      [-75, 0.25, 315],
      [-40, 0.25, 145],
    ]),
  },

  // 10. Abu Dhabi Grand Prix (Yas Marina) - Waterfront marina showcase with hotel underpass & fireworks
  {
    id: 'abudhabi',
    name: 'Abu Dhabi Grand Prix',
    location: 'Yas Marina Circuit (Finale)',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    lengthKm: 5.281,
    turns: 16,
    lapRecord: '1:26.103',
    recordHolder: 'Max Verstappen',
    description: 'Championship Grand Finale under twilight floodlights with sweeping waterfront marina views and fireworks.',
    skyColor: 0x160e2e,
    fogColor: 0x221842,
    ambientLight: 0.74,
    timeOfDay: 'twilight',
    trackPoints: createTrackSpline([
      [0, 0.25, 0],
      [0, 0.25, -120],
      [0, 0.25, -240],
      [-55, 0.25, -315], // Turn 1 left
      [-125, 0.25, -335],
      [-195, 0.5, -285], // Uphill sweep
      [-235, 0.62, -195],
      [-265, 0.42, -95], // Turn 5 Hairpin
      [-245, 0.25, -35],
      [-165, 0.25, 75], // 1.2km Back Straight
      [-75, 0.25, 205],
      [35, 0.25, 325],
      [95, 0.25, 375], // Chicane
      [135, 0.25, 345],
      [215, 0.38, 275], // Banked Turn 9
      [265, 0.38, 175],
      [285, 0.25, 65], // Marina waterfront complex
      [255, 0.25, -35],
      [195, 0.25, -75],
      [135, 0.25, -35], // Hotel underpass
      [95, 0.25, 35],
      [55, 0.25, 75],
      [18, 0.25, 45],
    ]),
  },
];
