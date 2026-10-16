/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SeasonState, RaceResult, CustomTeamConfig, Driver, CircuitInfo } from './types/racing';
import {
  CIRCUITS,
  TEAMS,
  DRIVERS,
  FIA_POINTS,
  PRIZE_MONEY,
  TEAM_CONTRACTS,
  DRIVERS_CHAMPIONSHIP_PRIZE,
  CONSTRUCTORS_CHAMPIONSHIP_PRIZE,
} from './constants/f1Data';
import { SeasonHub } from './components/SeasonHub';
import { RaceView } from './components/RaceView';
import { MultiplayerModal } from './components/MultiplayerModal';
import { ButtonMappingModal } from './components/ButtonMappingModal';
import { RoomPublicState } from './services/multiplayerService';
import { inputManager } from './services/inputManager';
import { Trophy, ArrowRight, DollarSign, Award, CheckCircle2, Shield, Flame, Gauge, Zap } from 'lucide-react';

const STORAGE_KEY = 'apex26_f1_career_v6';

const defaultSeasonState: SeasonState = {
  currentRound: 0,
  // Career begins exclusively with MoneyGram Haas F1 Team
  selectedTeamId: 'haas',
  selectedDriverId: 'bearman',
  lapCount: 5,
  difficulty: 'rookie', // Default to rookie until player picks
  driverPoints: {
    bearman: 0,
    ocon: 0,
    norris: 0,
    verstappen: 0,
    leclerc: 0,
    hamilton: 0,
    piastri: 0,
    russell: 0,
    alonso: 0,
    sainz: 0,
    lawson: 0,
    antonelli: 0,
    stroll: 0,
    hulkenberg: 0,
    bortoleto: 0,
    albon: 0,
    gasly: 0,
    doohan: 0,
    tsunoda: 0,
    hadjar: 0,
  },
  constructorPoints: {
    haas: 0,
    mclaren: 0,
    redbull: 0,
    ferrari: 0,
    mercedes: 0,
    astonmartin: 0,
    williams: 0,
    audi: 0,
    alpine: 0,
    rb: 0,
  },
  completedRounds: [],
  seasonFinished: false,
  career: {
    driverName: 'Rookie Driver',
    driverNumber: 87,
    country: 'United States',
    countryCode: 'US',
    driverRating: 76,
    reputation: 15,
    careerEarnings: 500000,
    currentSalary: 180000,
    wins: 0,
    podiums: 0,
    fastestLaps: 0,
    racesDriven: 0,
    championships: 0,
    constructorsChampionships: 0,
    customTeam: null,
    seasonTransfersCount: 0,
    seasonNumber: 1,
    seasonHistory: [],
    difficultyLocked: undefined,
  },
};

export default function App() {
  const [season, setSeason] = useState<SeasonState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.career && parsed.selectedTeamId) {
          // Ensure season history & season number fields exist
          if (!parsed.career.seasonNumber) parsed.career.seasonNumber = 1;
          if (!parsed.career.seasonHistory) parsed.career.seasonHistory = [];
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return defaultSeasonState;
  });

  const [hasChosenDifficulty, setHasChosenDifficulty] = useState(() => {
    return localStorage.getItem('apex26_diff_chosen') === 'true';
  });

  const [inRace, setInRace] = useState(false);
  const [raceLaps, setRaceLaps] = useState(5);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceCircuit, setPracticeCircuit] = useState<CircuitInfo | null>(null);
  const [practiceDifficulty, setPracticeDifficulty] = useState<'rookie' | 'pro' | 'legend'>('pro');
  const [lastRaceResult, setLastRaceResult] = useState<RaceResult | null>(null);
  const [showPodiumModal, setShowPodiumModal] = useState(false);
  const [championNotice, setChampionNotice] = useState<string | null>(null);
  const [isGamepadConnected, setIsGamepadConnected] = useState(false);
  const [gamepadName, setGamepadName] = useState<string | null>(null);

  // Multiplayer & Custom Controls state
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const [showButtonMappingModal, setShowButtonMappingModal] = useState(false);
  const [isMultiplayerRace, setIsMultiplayerRace] = useState(false);
  const [multiplayerRoom, setMultiplayerRoom] = useState<RoomPublicState | null>(null);

  const handleLaunchMultiplayerRace = (room: RoomPublicState) => {
    const selectedCircuit = CIRCUITS.find((c) => c.id === room.circuitId) || CIRCUITS[0];
    setPracticeCircuit(selectedCircuit);
    setRaceLaps(room.laps);
    setIsPracticeMode(false);
    setIsMultiplayerRace(true);
    setMultiplayerRoom(room);
    setShowMultiplayerModal(false);
    setInRace(true);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(season));
    } catch {
      // Storage error
    }
  }, [season]);

  useEffect(() => {
    const interval = setInterval(() => {
      const status = inputManager.getControllerStatus();
      setIsGamepadConnected(status.connected);
      setGamepadName(status.id);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const currentCircuit = CIRCUITS[season.currentRound] || CIRCUITS[0];

  const handleStartRace = (laps: number) => {
    setIsPracticeMode(false);
    setPracticeCircuit(null);
    setRaceLaps(laps);
    setSeason((prev) => ({ ...prev, lapCount: laps }));
    setInRace(true);
  };

  const handleStartPractice = (circuit: CircuitInfo, laps: number, diff: 'rookie' | 'pro' | 'legend') => {
    setIsPracticeMode(true);
    setPracticeCircuit(circuit);
    setPracticeDifficulty(diff);
    setRaceLaps(laps);
    setInRace(true);
  };

  const handleChangeDifficulty = (diff: 'rookie' | 'pro' | 'legend') => {
    // Only allow if not locked
    if (season.career.difficultyLocked && season.career.difficultyLocked !== diff) {
      return;
    }
    setSeason((prev) => ({ ...prev, difficulty: diff }));
  };

  const handleQuitCareer = () => {
    localStorage.removeItem('apex26_diff_chosen');
    localStorage.removeItem(STORAGE_KEY);
    setSeason(defaultSeasonState);
    setHasChosenDifficulty(false);
  };

  const handleStartNextSeason = () => {
    const currentTeam = season.career.customTeam && season.selectedTeamId === season.career.customTeam.id
      ? season.career.customTeam
      : TEAMS.find((t) => t.id === season.selectedTeamId) || TEAMS[0];

    const sortedDrivers = Object.entries(season.driverPoints).sort((a, b) => b[1] - a[1]);
    const playerRank = sortedDrivers.findIndex(([id]) => id === season.selectedDriverId) + 1 || 1;
    const sortedTeams = Object.entries(season.constructorPoints).sort((a, b) => b[1] - a[1]);
    const teamRank = sortedTeams.findIndex(([id]) => id === season.selectedTeamId) + 1 || 1;

    const seasonWins = season.completedRounds.filter((r) => r.playerFinishedPosition === 1).length;
    const seasonPodiums = season.completedRounds.filter((r) => r.playerFinishedPosition <= 3).length;
    const isWorldChamp = playerRank === 1;
    const isConstructorsChamp = teamRank === 1;

    const historyEntry = {
      seasonNumber: season.career.seasonNumber || 1,
      year: 2026 + (season.career.seasonNumber || 1) - 1,
      teamName: currentTeam.name,
      finalDriverRank: playerRank,
      driverPoints: season.driverPoints[season.selectedDriverId] || 0,
      constructorRank: teamRank,
      constructorPoints: season.constructorPoints[season.selectedTeamId] || 0,
      wins: seasonWins,
      podiums: seasonPodiums,
      isWorldChampion: isWorldChamp,
      isConstructorsChampion: isConstructorsChamp,
      totalEarnings: season.completedRounds.reduce((acc, r) => acc + r.prizeMoneyAwarded, 0),
    };

    setSeason((prev) => ({
      ...prev,
      currentRound: 0,
      completedRounds: [],
      seasonFinished: false,
      driverPoints: {
        bearman: 0, ocon: 0, norris: 0, verstappen: 0, leclerc: 0,
        hamilton: 0, piastri: 0, russell: 0, alonso: 0, sainz: 0,
        lawson: 0, antonelli: 0, stroll: 0, hulkenberg: 0, bortoleto: 0,
        albon: 0, gasly: 0, doohan: 0, tsunoda: 0, hadjar: 0,
        [prev.selectedDriverId]: 0,
      },
      constructorPoints: {
        haas: 0, mclaren: 0, redbull: 0, ferrari: 0, mercedes: 0,
        astonmartin: 0, williams: 0, audi: 0, alpine: 0, rb: 0,
        ...(prev.career.customTeam ? { [prev.career.customTeam.id]: 0 } : {}),
      },
      career: {
        ...prev.career,
        seasonNumber: (prev.career.seasonNumber || 1) + 1,
        seasonHistory: [...(prev.career.seasonHistory || []), historyEntry],
        championships: isWorldChamp ? prev.career.championships + 1 : prev.career.championships,
        constructorsChampionships: isConstructorsChamp
          ? (prev.career.constructorsChampionships || 0) + 1
          : (prev.career.constructorsChampionships || 0),
      },
    }));

    setShowPodiumModal(false);
    setChampionNotice(null);
  };

  const handleSelectTeam = (
    teamId: string,
    targetDriverId: string,
    buyoutFee: number = 0,
    signingBonus: number = 0,
    newSalary: number = 180000
  ) => {
    // "once i create my team i earn points for the team i made and i cant switch teams unless i sell my team"
    if (season.career.customTeam) {
      return;
    }
    setSeason((prev) => {
      const netCashChange = signingBonus - buyoutFee;
      // In real F1: driver championship points stay with the driver throughout mid-season team swaps.
      // Points never transfer to the displaced driver.
      return {
        ...prev,
        selectedTeamId: teamId,
        // Retain player's driver identity so their championship points stay intact with them
        selectedDriverId: prev.selectedDriverId,
        career: {
          ...prev.career,
          currentSalary: newSalary,
          careerEarnings: Math.max(0, prev.career.careerEarnings + netCashChange),
          seasonTransfersCount: prev.career.seasonTransfersCount + 1,
        },
      };
    });
  };

  const handleSellCustomTeam = (saleValue: number = 210000000) => {
    setSeason((prev) => {
      if (!prev.career.customTeam) return prev;
      return {
        ...prev,
        selectedTeamId: 'haas', // Return to independent driver grid seat
        career: {
          ...prev.career,
          customTeam: null,
          careerEarnings: prev.career.careerEarnings + saleValue,
        },
      };
    });
  };

  const handleCreateCustomTeam = (config: CustomTeamConfig, actualFeePaid: number = 222000000) => {
    setSeason((prev) => ({
      ...prev,
      selectedTeamId: config.id, // Automatically join newly created team as lead driver
      selectedDriverId: prev.selectedDriverId,
      constructorPoints: {
        ...prev.constructorPoints,
        [config.id]: prev.constructorPoints[config.id] || 0, // Registered in Constructors Cup
      },
      career: {
        ...prev.career,
        careerEarnings: Math.max(0, prev.career.careerEarnings - actualFeePaid),
        currentSalary: 1200000,
        customTeam: config,
      },
    }));
  };

  const handleUpdateCustomTeam = (updated: CustomTeamConfig, costDeduction?: number) => {
    setSeason((prev) => ({
      ...prev,
      career: {
        ...prev.career,
        careerEarnings: costDeduction ? Math.max(0, prev.career.careerEarnings - costDeduction) : prev.career.careerEarnings,
        customTeam: updated,
      },
    }));
  };

  const handleUpdateDriverProfile = (name: string, number: number, country: string) => {
    setSeason((prev) => ({
      ...prev,
      career: {
        ...prev.career,
        driverName: name,
        driverNumber: number,
        country,
      },
    }));
  };

  const handleResetSeason = () => {
    setSeason((prev) => ({
      ...prev,
      currentRound: 0,
      completedRounds: [],
      seasonFinished: false,
      driverPoints: {
        bearman: 0, ocon: 0, norris: 0, verstappen: 0, leclerc: 0,
        hamilton: 0, piastri: 0, russell: 0, alonso: 0, sainz: 0,
        lawson: 0, antonelli: 0, stroll: 0, hulkenberg: 0, bortoleto: 0,
        albon: 0, gasly: 0, doohan: 0, tsunoda: 0, hadjar: 0,
        [prev.selectedDriverId]: 0,
      },
      constructorPoints: {
        haas: 0, mclaren: 0, redbull: 0, ferrari: 0, mercedes: 0,
        astonmartin: 0, williams: 0, audi: 0, alpine: 0, rb: 0,
        ...(prev.career.customTeam ? { [prev.career.customTeam.id]: 0 } : {}),
      },
    }));
  };

  const handleRaceComplete = (
    finishPos: number,
    bestLapTime: number,
    finishedDriversOrder: string[] = [],
    finalStandingsDetails?: {
      driver: Driver;
      position: number;
      finished: boolean;
      bestLapTime: number;
      gapToLeaderSeconds: number;
      gapToPlayerSeconds: number;
      leadOverP2Seconds: number;
    }[]
  ) => {
    // If completed session was Free Practice, exit back to paddock without modifying championship standings
    if (isPracticeMode) {
      setInRace(false);
      setIsPracticeMode(false);
      setPracticeCircuit(null);
      return;
    }

    const playerDriver = DRIVERS.find((d) => d.id === season.selectedDriverId) || DRIVERS[0];

    // Build true field standings from actual finished race order
    const sortedField: Driver[] = [];
    const accountedDrivers = new Set<string>();

    for (const dId of finishedDriversOrder) {
      if (dId === 'player') {
        sortedField.push(playerDriver);
        accountedDrivers.add(playerDriver.id);
      } else {
        const d = DRIVERS.find((drv) => drv.id === dId);
        if (d && !accountedDrivers.has(d.id)) {
          sortedField.push(d);
          accountedDrivers.add(d.id);
        }
      }
    }

    // Remaining drivers that did not finish or were lapped
    const remaining = DRIVERS.filter((d) => !accountedDrivers.has(d.id) && d.id !== playerDriver.id);
    remaining.sort((a, b) => b.rating - a.rating);
    sortedField.push(...remaining);

    // If player somehow was not in finishedDriversOrder, place at finishPos
    if (!accountedDrivers.has(playerDriver.id)) {
      const insertIdx = Math.max(0, Math.min(sortedField.length, finishPos - 1));
      sortedField.splice(insertIdx, 0, playerDriver);
    }

    const actualPlayerPos = sortedField.findIndex((d) => d.id === playerDriver.id) + 1;

    const pointsAwarded: Record<string, number> = {};
    const updatedDriverPoints = { ...season.driverPoints };
    const updatedConstructorPoints = { ...season.constructorPoints };

    for (let i = 0; i < Math.min(10, sortedField.length); i++) {
      const driver = sortedField[i];
      const pts = FIA_POINTS[i] || 0;
      pointsAwarded[driver.id] = pts;

      updatedDriverPoints[driver.id] = (updatedDriverPoints[driver.id] || 0) + pts;
      let teamId = driver.id === playerDriver.id ? season.selectedTeamId : driver.teamId;

      // "also make sure my teammate earns points for my team on the consturtors cup samething when i own a team"
      // 1. If player owns a custom team and this driver is their contracted teammate:
      if (season.career.customTeam && season.selectedTeamId === season.career.customTeam.id && season.career.customTeam.teammateDriverId === driver.id) {
        teamId = season.career.customTeam.id;
      }
      // 2. If player drives for an official F1 team (e.g. Haas, Williams, McLaren) and this driver is the official teammate:
      else if (season.selectedTeamId && driver.id !== playerDriver.id) {
        const currentTeamObj = TEAMS.find((t) => t.id === season.selectedTeamId);
        if (currentTeamObj && currentTeamObj.drivers.includes(driver.id)) {
          teamId = season.selectedTeamId;
        }
      }

      if (teamId) {
        updatedConstructorPoints[teamId] = (updatedConstructorPoints[teamId] || 0) + pts;
      }
    }

    // Award career prize money & salary
    const prizeMoney = PRIZE_MONEY[actualPlayerPos - 1] || 150000;
    const salary = season.career.currentSalary || 180000;
    let totalPayout = prizeMoney + salary;

    // Team Principal Comprehensive Financial Balance Sheet if player owns their constructor
    // "if u manage ur team good u make much more money also include every single expense once u own a team"
    const isOwner = Boolean(season.career.customTeam && season.selectedTeamId === season.career.customTeam.id);
    if (isOwner && season.career.customTeam) {
      const cTeam = season.career.customTeam;
      // 1. Sponsorship Revenue (Base Sponsor + Performance Milestones)
      const baseSponsor = cTeam.sponsorBasePerRace || 10500000;
      let performanceBonus = 0;
      if (actualPlayerPos === 1) performanceBonus = cTeam.sponsorWinBonus || 15000000;
      else if (actualPlayerPos <= 3) performanceBonus = cTeam.sponsorPodiumBonus || 8000000;
      else if (actualPlayerPos <= 6) performanceBonus = 4000000;
      else if (actualPlayerPos <= 10) performanceBonus = cTeam.sponsorPointsBonus || 2500000;

      // 2. Comprehensive Operating Expenses (Engine, Aero, Chassis, Brakes, Teammate, Factory, Freight, PR)
      const engineCost = cTeam.engineCostPerRace || 1600000;
      const aeroStaffCost = cTeam.aeroStaffSalary || 480000;
      const chassisEngineerCost = cTeam.chassisEngineerSalary || 340000;
      const brakesEngineerCost = cTeam.brakesEngineerSalary || 290000;
      const teammateSalary = cTeam.teammateSalaryPerRace || 450000;
      const facilityMaintenance = cTeam.maintenanceCostPerRace || 450000;
      const logisticsCost = cTeam.logisticsCostPerRace || 350000;
      const hospitalityStaff = cTeam.hospitalityCostPerRace || 180000;
      const customerPURevenue = cTeam.customerSupplyRevenuePerRace || 0;

      const totalTeamRevenue = baseSponsor + performanceBonus + customerPURevenue;
      const totalTeamExpenses =
        engineCost +
        aeroStaffCost +
        chassisEngineerCost +
        brakesEngineerCost +
        teammateSalary +
        facilityMaintenance +
        logisticsCost +
        hospitalityStaff;

      const netTeamProfit = totalTeamRevenue - totalTeamExpenses;

      // Add net constructor profits to player earnings
      totalPayout += netTeamProfit;
    }

    // CONSTRUCTOR OWNER BONUS FOR TEAMMATE FINISH:
    // "also if i own a team make it so i also get some cash if my teammate wins"
    let teammateBonus = 0;
    let teammateBonusDesc = '';
    let teammateFinishPos: number | undefined;

    const isOwningCustomTeam = Boolean(season.career.customTeam);
    if (isOwningCustomTeam && season.career.customTeam) {
      const teammateId = season.career.customTeam.teammateDriverId;
      const teammateDetail = finalStandingsDetails?.find((s) => s.driver.id === teammateId);
      if (teammateDetail) {
        teammateFinishPos = teammateDetail.position;
      } else {
        const foundIdx = sortedField.findIndex((d) => d.id === teammateId);
        if (foundIdx !== -1) teammateFinishPos = foundIdx + 1;
      }

      const teammateName = DRIVERS.find((d) => d.id === teammateId)?.name || 'Teammate';

      if (teammateFinishPos === 1) {
        teammateBonus = 8000000;
        teammateBonusDesc = `🏆 TEAM OWNER VICTORY BONUS: Your teammate ${teammateName} WON the Grand Prix (P1)! Received +$8,000,000 Constructor Prize!`;
      } else if (teammateFinishPos && teammateFinishPos <= 3) {
        teammateBonus = 4000000;
        teammateBonusDesc = `🥈 TEAM OWNER PODIUM BONUS: Your teammate ${teammateName} finished P${teammateFinishPos}! Received +$4,000,000 Constructor Prize!`;
      } else if (teammateFinishPos && teammateFinishPos <= 6) {
        teammateBonus = 2000000;
        teammateBonusDesc = `🏅 TEAM OWNER TOP-6 BONUS: Your teammate ${teammateName} finished P${teammateFinishPos}! Received +$2,000,000 Constructor Prize!`;
      } else if (teammateFinishPos && teammateFinishPos <= 10) {
        teammateBonus = 1000000;
        teammateBonusDesc = `✨ TEAM OWNER POINTS BONUS: Your teammate ${teammateName} scored points (P${teammateFinishPos})! Received +$1,000,000 Constructor Prize!`;
      }
      totalPayout += teammateBonus;
    }

    const isWin = actualPlayerPos === 1;
    const isPodium = actualPlayerPos <= 3;

    // Driver rating progression
    let ratingGain = 0;
    let repGain = 1;
    if (isWin) {
      ratingGain = 2.0;
      repGain = 12;
    } else if (isPodium) {
      ratingGain = 1.2;
      repGain = 8;
    } else if (actualPlayerPos <= 6) {
      ratingGain = 0.6;
      repGain = 5;
    } else if (actualPlayerPos <= 10) {
      ratingGain = 0.3;
      repGain = 3;
    }

    // Uncapped Driver Rating progression (can freely exceed 100 with race wins & podiums)
    const newRating = Math.round((season.career.driverRating + ratingGain) * 10) / 10;
    const newReputation = Math.min(100, season.career.reputation + repGain);

    const winnerDriver = sortedField[0] || playerDriver;
    const podiumDrivers = [
      sortedField[0]?.id || playerDriver.id,
      sortedField[1]?.id || playerDriver.id,
      sortedField[2]?.id || playerDriver.id,
    ];

    const isSeasonEnd = season.currentRound >= CIRCUITS.length - 1;

    // Championship Grand Prizes
    let champBonus = 0;
    let champMsg = '';
    if (isSeasonEnd) {
      const sortedDriverEntries = Object.entries(updatedDriverPoints).sort((a, b) => b[1] - a[1]);
      const wonDriversCup = sortedDriverEntries[0] && sortedDriverEntries[0][0] === playerDriver.id;

      const sortedConstructorEntries = Object.entries(updatedConstructorPoints).sort((a, b) => b[1] - a[1]);
      const wonConstructorsCup = sortedConstructorEntries[0] && sortedConstructorEntries[0][0] === season.selectedTeamId;

      if (wonDriversCup) {
        champBonus += DRIVERS_CHAMPIONSHIP_PRIZE;
        champMsg += `🏆 FIA WORLD DRIVERS CHAMPION! Received $50,000,000 Grand Prize! `;
      }
      if (wonConstructorsCup) {
        champBonus += CONSTRUCTORS_CHAMPIONSHIP_PRIZE;
        champMsg += `🛡️ FIA WORLD CONSTRUCTORS CUP CHAMPIONS! Received $120,000,000 Team Grand Prize!`;
      }
      if (champBonus > 0) {
        totalPayout += champBonus;
        setChampionNotice(champMsg);
      }
    }

    const podiumGaps = finalStandingsDetails ? finalStandingsDetails.slice(0, 3).map((s) => ({
      id: s.driver.id,
      name: s.driver.name,
      position: s.position,
      gapSeconds: s.gapToLeaderSeconds,
      gapToPlayer: s.gapToPlayerSeconds,
    })) : undefined;

    const p1LeadSec = finalStandingsDetails?.[0]?.leadOverP2Seconds || (finalStandingsDetails && finalStandingsDetails.length > 1 ? finalStandingsDetails[1].gapToLeaderSeconds : undefined);
    const playerDetail = finalStandingsDetails?.find((s) => s.driver.id === playerDriver.id);

    const result: RaceResult = {
      round: season.currentRound,
      circuitId: currentCircuit.id,
      circuitName: currentCircuit.name,
      winnerDriverId: winnerDriver.id,
      podiumDriverIds: podiumDrivers,
      podiumGaps,
      p1LeadSeconds: p1LeadSec,
      playerGapToLeaderSeconds: playerDetail?.gapToLeaderSeconds,
      playerFinishedPosition: actualPlayerPos,
      teammateFinishedPosition: teammateFinishPos,
      teammateOwnerBonus: teammateBonus,
      teammateOwnerBonusDesc: teammateBonusDesc,
      fastestLapDriverId: winnerDriver.id,
      fastestLapTime: bestLapTime,
      driverPointsAwarded: pointsAwarded,
      prizeMoneyAwarded: totalPayout,
      lapsCompleted: raceLaps,
    };

    setSeason((prev) => ({
      ...prev,
      driverPoints: updatedDriverPoints,
      constructorPoints: updatedConstructorPoints,
      completedRounds: [...prev.completedRounds, result],
      currentRound: isSeasonEnd ? prev.currentRound : prev.currentRound + 1,
      seasonFinished: isSeasonEnd,
      career: {
        ...prev.career,
        driverRating: newRating,
        reputation: newReputation,
        careerEarnings: prev.career.careerEarnings + totalPayout,
        racesDriven: prev.career.racesDriven + 1,
        wins: isWin ? prev.career.wins + 1 : prev.career.wins,
        podiums: isPodium ? prev.career.podiums + 1 : prev.career.podiums,
        championships: isSeasonEnd && champBonus > 0 ? prev.career.championships + 1 : prev.career.championships,
      },
    }));

    setLastRaceResult(result);
    setInRace(false);
    setShowPodiumModal(true);
  };

  const handleTestRumble = () => {
    inputManager.rumble(0.6, 0.9, 320);
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const handleConfirmDifficulty = (diff: 'rookie' | 'pro' | 'legend') => {
    setSeason((prev) => ({
      ...prev,
      difficulty: diff,
      career: {
        ...prev.career,
        difficultyLocked: diff,
      },
    }));
    localStorage.setItem('apex26_diff_chosen', 'true');
    setHasChosenDifficulty(true);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans">
      {inRace ? (
        <RaceView
          circuit={isPracticeMode && practiceCircuit ? practiceCircuit : currentCircuit}
          laps={raceLaps}
          season={season}
          onRaceComplete={handleRaceComplete}
          onExitToPaddock={() => {
            setInRace(false);
            setIsPracticeMode(false);
            setPracticeCircuit(null);
          }}
          isPracticeMode={isPracticeMode}
          practiceDifficulty={isPracticeMode ? practiceDifficulty : undefined}
        />
      ) : (
        <SeasonHub
          season={season}
          currentCircuit={currentCircuit}
          onStartRace={handleStartRace}
          onStartPractice={handleStartPractice}
          onChangeDifficulty={handleChangeDifficulty}
          onSelectTeam={handleSelectTeam}
          onResetSeason={handleResetSeason}
          onCreateCustomTeam={handleCreateCustomTeam}
          onUpdateCustomTeam={handleUpdateCustomTeam}
          onUpdateDriverProfile={handleUpdateDriverProfile}
          isGamepadConnected={isGamepadConnected}
          gamepadName={gamepadName}
          onTestRumble={handleTestRumble}
          onStartNextSeason={handleStartNextSeason}
          onQuitCareer={handleQuitCareer}
          onSellCustomTeam={handleSellCustomTeam}
        />
      )}

      {/* Difficulty Selection Modal (Choose CPU difficulty BEFORE starting career) */}
      {!hasChosenDifficulty && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-2xl w-full rounded-3xl p-8 shadow-2xl flex flex-col gap-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-lg">
                <Gauge className="w-8 h-8" />
              </div>
            </div>

            <div>
              <span className="text-xs uppercase font-black tracking-widest text-red-500">
                Official FIA Career Setup
              </span>
              <h2 className="text-3xl font-black text-white mt-1">Select Your Career AI Difficulty</h2>
              <p className="text-sm text-neutral-400 mt-2 max-w-lg mx-auto">
                Formula 1 driver career rules: you start with MoneyGram Haas F1 Team. Choose the CPU AI racing pace and collision penalty duration for your career.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              {/* Rookie */}
              <div
                onClick={() => handleConfirmDifficulty('rookie')}
                className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all cursor-pointer flex flex-col justify-between gap-4 group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-emerald-400">Rookie</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">0.80x PACE</span>
                  </div>
                  <h4 className="font-bold text-white text-base mt-2">Accessible & Fun</h4>
                  <p className="text-xs text-neutral-400 mt-1">
                    Forgiving cornering speeds for learning circuits. Soft CPU braking.
                  </p>
                </div>
                <div className="text-[11px] font-mono text-emerald-300 border-t border-neutral-800 pt-2">
                  Crash Wait Penalty: <strong>2.0 seconds</strong>
                </div>
              </div>

              {/* Pro */}
              <div
                onClick={() => handleConfirmDifficulty('pro')}
                className="p-5 rounded-2xl bg-neutral-950 border-2 border-red-500/50 hover:border-red-500 bg-red-500/5 transition-all cursor-pointer flex flex-col justify-between gap-4 group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-red-400">Pro (Standard)</span>
                    <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-mono">0.89x PACE</span>
                  </div>
                  <h4 className="font-bold text-white text-base mt-2">Authentic F1 Racing</h4>
                  <p className="text-xs text-neutral-400 mt-1">
                    Realistic grid battle lap times. Dynamic overtaking and slipstreaming.
                  </p>
                </div>
                <div className="text-[11px] font-mono text-red-300 border-t border-neutral-800 pt-2">
                  Crash Wait Penalty: <strong>3.5 seconds</strong>
                </div>
              </div>

              {/* Legend */}
              <div
                onClick={() => handleConfirmDifficulty('legend')}
                className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-purple-500 hover:bg-purple-500/5 transition-all cursor-pointer flex flex-col justify-between gap-4 group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-purple-400">Legend</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono">1.02x+ PACE</span>
                  </div>
                  <h4 className="font-bold text-white text-base mt-2">Elite Simulation</h4>
                  <p className="text-xs text-neutral-400 mt-1">
                    Fierce championship contenders. Verstappen & Norris push cars to the absolute limit.
                  </p>
                </div>
                <div className="text-[11px] font-mono text-purple-300 border-t border-neutral-800 pt-2">
                  Crash Wait Penalty: <strong>5.0 seconds</strong>
                </div>
              </div>
            </div>

            <span className="text-[11px] text-amber-400/90 font-mono">
              ⚠️ Difficulty is locked for your entire career once selected. You cannot change it mid-career unless you choose Quit Career.
            </span>
          </div>
        </div>
      )}

      {/* Post-Race Podium & Career Earnings Modal */}
      {showPodiumModal && lastRaceResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-lg w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-5 text-center">
            <div className="flex justify-center">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${
                  lastRaceResult.playerFinishedPosition === 1
                    ? 'bg-amber-500/20 border-amber-400 text-amber-400'
                    : lastRaceResult.playerFinishedPosition <= 3
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400'
                    : 'bg-neutral-800 border-neutral-600 text-neutral-300'
                }`}
              >
                <Trophy className="w-8 h-8" />
              </div>
            </div>

            <div>
              <span className="text-xs uppercase font-bold tracking-widest text-neutral-400">
                Official Grand Prix Results
              </span>
              <h2 className="text-2xl font-black text-white">{lastRaceResult.circuitName}</h2>
              <p className="text-xs text-neutral-400 mt-1">
                Winner: {DRIVERS.find((d) => d.id === lastRaceResult.winnerDriverId)?.name || 'Max Verstappen'}
              </p>
              {championNotice && (
                <div className="mt-2 p-3 bg-amber-500/20 border border-amber-400 text-amber-300 rounded-xl text-xs font-black animate-pulse">
                  {championNotice}
                </div>
              )}
            </div>

            {/* Official Podium with actual seconds lead and intervals:
                "also on the board add an atual seconds lead how much seconds p1 is beating and everyone on the podium and make it accurate or how much seconds im beating them by" */}
            {lastRaceResult.podiumGaps && (
              <div className="bg-neutral-950 p-3.5 rounded-xl border border-white/5 flex flex-col gap-2 text-left">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block border-b border-white/5 pb-1">
                  OFFICIAL PODIUM & TIME INTERVALS
                </span>
                <div className="flex flex-col gap-1.5 font-mono text-xs">
                  {lastRaceResult.podiumGaps.map((podium) => {
                    const isPlayerPodium = podium.id === season.selectedDriverId;
                    return (
                      <div
                        key={podium.id}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${
                          isPlayerPodium
                            ? 'bg-amber-500/20 border border-amber-400/30 font-bold'
                            : 'bg-neutral-900/60 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-5 font-black ${podium.position === 1 ? 'text-amber-400' : podium.position === 2 ? 'text-cyan-400' : 'text-amber-600'}`}>
                            P{podium.position}
                          </span>
                          <span className="text-white font-sans font-bold">
                            {isPlayerPodium ? `${season.career.driverName} (YOU)` : podium.name}
                          </span>
                        </div>
                        <div className="text-right">
                          {podium.position === 1 ? (
                            <span className="text-amber-400 font-bold">
                              WINNER {lastRaceResult.p1LeadSeconds ? `(+${lastRaceResult.p1LeadSeconds.toFixed(2)}s Lead)` : ''}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-neutral-300">+{podium.gapSeconds.toFixed(2)}s</span>
                              {!isPlayerPodium && (
                                <span className={podium.gapToPlayer > 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                  ({podium.gapToPlayer > 0 ? `-${podium.gapToPlayer.toFixed(1)}s` : `+${Math.abs(podium.gapToPlayer).toFixed(1)}s`})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Constructor Owner Teammate Dividend Card:
                "also if i own a team make it so i also get some cash if my teammate wins" */}
            {lastRaceResult.teammateOwnerBonus !== undefined && lastRaceResult.teammateOwnerBonus > 0 && (
              <div className="bg-emerald-950/80 border border-emerald-500/50 p-3.5 rounded-xl text-left flex items-center gap-3 shadow-lg">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 block">
                    CONSTRUCTOR TEAM OWNER DIVIDEND
                  </span>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {lastRaceResult.teammateOwnerBonusDesc}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 p-4 bg-neutral-950 rounded-xl border border-white/5 text-left">
              <div>
                <span className="text-xs text-neutral-400">Your Finish</span>
                <p
                  className={`text-3xl font-black ${
                    lastRaceResult.playerFinishedPosition === 1
                      ? 'text-amber-400'
                      : lastRaceResult.playerFinishedPosition <= 3
                      ? 'text-cyan-400'
                      : 'text-white'
                  }`}
                >
                  P{lastRaceResult.playerFinishedPosition}
                </p>
                {lastRaceResult.playerFinishedPosition === 1 && lastRaceResult.p1LeadSeconds ? (
                  <span className="text-[10px] font-mono text-amber-400 block font-bold">
                    Won by +{lastRaceResult.p1LeadSeconds.toFixed(2)}s
                  </span>
                ) : lastRaceResult.playerGapToLeaderSeconds ? (
                  <span className="text-[10px] font-mono text-neutral-400 block">
                    +{lastRaceResult.playerGapToLeaderSeconds.toFixed(2)}s behind P1
                  </span>
                ) : null}
              </div>
              <div>
                <span className="text-xs text-neutral-400">Points Awarded</span>
                <p className="text-2xl font-black text-cyan-400">
                  +{lastRaceResult.driverPointsAwarded[season.selectedDriverId] || 0} PTS
                </p>
              </div>
              <div className="col-span-2 pt-2 border-t border-neutral-800 flex justify-between items-center">
                <div>
                  <span className="text-xs text-neutral-400">Payout (Prize + Salary + Team Net)</span>
                  <p className="text-xl font-black text-emerald-400 flex items-center gap-1">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    {formatMoney(lastRaceResult.prizeMoneyAwarded)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-neutral-400">Driver Rating</span>
                  <p className="text-lg font-bold text-purple-400">{season.career.driverRating}</p>
                </div>
              </div>
            </div>

            {season.seasonFinished ? (
              <button
                onClick={handleStartNextSeason}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-red-600 to-amber-500 hover:from-amber-400 hover:to-red-500 text-white font-black text-sm uppercase rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer animate-pulse"
              >
                <Trophy className="w-5 h-5 text-amber-300" />
                <span>Begin Season {(season.career.seasonNumber || 1) + 1} ({2026 + (season.career.seasonNumber || 1)}) & Archive Record</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setShowPodiumModal(false);
                  setChampionNotice(null);
                }}
                className="w-full py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Return to Paddock</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
