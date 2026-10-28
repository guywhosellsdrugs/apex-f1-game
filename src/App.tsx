/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  SeasonState,
  RaceResult,
  CustomTeamConfig,
  Driver,
  CircuitInfo,
  NewsCompanyConfig,
  PublishedNewsReport,
} from './types/racing';
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
import { FirebaseCloudModal } from './components/FirebaseCloudModal';
import { TutorialModal, TutorialPracticeDrillConfig } from './components/TutorialModal';
import { multiplayerService, RoomPublicState } from './services/multiplayerService';
import { inputManager } from './services/inputManager';
import { auth, signInWithGoogle, saveCareerToCloud, loadCareerFromCloud } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Trophy, ArrowRight, DollarSign, Award, CheckCircle2, Shield, Flame, Gauge, Zap, Cloud, Timer, Palette, Sun, Moon } from 'lucide-react';
import {
  AppThemeId,
  APP_THEMES,
  THEME_OPTIONS,
  getStoredTheme,
  setStoredTheme,
  onThemeChange,
  applyThemeToDocument,
} from './utils/themeSettings';

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
  const [practiceBotCount, setPracticeBotCount] = useState<number>(19);
  const [lastRaceResult, setLastRaceResult] = useState<RaceResult | null>(null);
  const [showPodiumModal, setShowPodiumModal] = useState(false);
  const [showRaceHighlights, setShowRaceHighlights] = useState(false);
  const [championNotice, setChampionNotice] = useState<string | null>(null);
  const [isGamepadConnected, setIsGamepadConnected] = useState(false);
  const [gamepadName, setGamepadName] = useState<string | null>(null);

  // Multiplayer, Custom Controls, & Tutorial state
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const [showButtonMappingModal, setShowButtonMappingModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return !localStorage.getItem('apex26_tutorial_completed');
    } catch {
      return false;
    }
  });
  const [tutorialStepIndex, setTutorialStepIndex] = useState<number>(0);
  const [activeTutorialDrill, setActiveTutorialDrill] = useState<TutorialPracticeDrillConfig | null>(null);
  const [completedTutorialDrills, setCompletedTutorialDrills] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('apex26_tutorial_drills_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isMultiplayerRace, setIsMultiplayerRace] = useState(false);
  const [multiplayerRoom, setMultiplayerRoom] = useState<RoomPublicState | null>(null);

  // Qualifying session states
  const [isQualifyingMode, setIsQualifyingMode] = useState(false);
  const [qualifyingGhostDelay3s, setQualifyingGhostDelay3s] = useState<boolean>(() => {
    try {
      return localStorage.getItem('apex26_qualifying_ghost_delay_3s') !== 'false';
    } catch {
      return true;
    }
  });
  const [qualifyingGridSlot, setQualifyingGridSlot] = useState<number | null>(null);
  const [qualifyingResults, setQualifyingResults] = useState<Array<{ position: number; driver: Driver; team: any; lapTime: number; gap: number }> | null>(null);
  const [showQualifyingModal, setShowQualifyingModal] = useState(false);

  const handleSetQualifyingGhostDelay3s = (delay3s: boolean) => {
    setQualifyingGhostDelay3s(delay3s);
    try {
      localStorage.setItem('apex26_qualifying_ghost_delay_3s', String(delay3s));
    } catch {}
  };

  // Pre-career sign in state
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [appTheme, setAppTheme] = useState<AppThemeId>(getStoredTheme());

  useEffect(() => {
    applyThemeToDocument(appTheme);
    return onThemeChange((t) => setAppTheme(t));
  }, []);

  // Seamless Firebase Firestore cloud profile synchronization (Cross-Device restoration)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const cloudData = await loadCareerFromCloud();
          if (cloudData) {
            // Restore entire full SeasonState if available
            if (cloudData.seasonStateJson) {
              try {
                const restoredSeason = JSON.parse(cloudData.seasonStateJson);
                if (restoredSeason && restoredSeason.career && restoredSeason.selectedTeamId) {
                  setSeason(restoredSeason);
                  setHasChosenDifficulty(true);
                  localStorage.setItem('apex26_diff_chosen', 'true');
                  return;
                }
              } catch {}
            }

            if (cloudData.cashBalance !== undefined) {
              setSeason((prev) => ({
                ...prev,
                selectedTeamId: cloudData.selectedTeamId || prev.selectedTeamId,
                selectedDriverId: cloudData.selectedDriverId || prev.selectedDriverId,
                difficulty: cloudData.difficulty || prev.difficulty,
                career: {
                  ...prev.career,
                  driverName: cloudData.driverName || prev.career.driverName,
                  careerEarnings: Math.max(prev.career.careerEarnings, cloudData.cashBalance),
                  wins: Math.max(prev.career.wins, cloudData.wins || 0),
                  podiums: Math.max(prev.career.podiums, cloudData.podiums || 0),
                  racesDriven: Math.max(prev.career.racesDriven, cloudData.racesEntered || 0),
                },
              }));
              if (cloudData.difficulty) {
                setHasChosenDifficulty(true);
                localStorage.setItem('apex26_diff_chosen', 'true');
              }
            }
          }
        } catch {
          // Cloud sync fallback
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Pre-career Google Sign-In action for new devices
  const handleGoogleSignInBeforeCareer = async () => {
    setIsSigningIn(true);
    setSignInError(null);
    try {
      const res = await signInWithGoogle();
      if (res.error) {
        setSignInError(res.error);
        setIsSigningIn(false);
        return;
      }
      const cloudData = await loadCareerFromCloud();
      if (cloudData) {
        if (cloudData.seasonStateJson) {
          try {
            const restored = JSON.parse(cloudData.seasonStateJson);
            if (restored && restored.career && restored.selectedTeamId) {
              setSeason(restored);
              setHasChosenDifficulty(true);
              localStorage.setItem('apex26_diff_chosen', 'true');
              setIsSigningIn(false);
              return;
            }
          } catch {}
        }
        if (cloudData.cashBalance !== undefined) {
          setSeason((prev) => ({
            ...prev,
            selectedTeamId: cloudData.selectedTeamId || prev.selectedTeamId,
            selectedDriverId: cloudData.selectedDriverId || prev.selectedDriverId,
            difficulty: cloudData.difficulty || 'pro',
            career: {
              ...prev.career,
              driverName: cloudData.driverName || prev.career.driverName,
              careerEarnings: Math.max(prev.career.careerEarnings, cloudData.cashBalance),
              wins: Math.max(prev.career.wins, cloudData.wins || 0),
              podiums: Math.max(prev.career.podiums, cloudData.podiums || 0),
              racesDriven: Math.max(prev.career.racesDriven, cloudData.racesEntered || 0),
            },
          }));
          setHasChosenDifficulty(true);
          localStorage.setItem('apex26_diff_chosen', 'true');
        }
      }
    } catch (err: any) {
      setSignInError(err?.message || 'Google sign-in error.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLaunchMultiplayerRace = (room: RoomPublicState) => {
    const selectedCircuit = CIRCUITS.find((c) => c.id === room.circuitId) || CIRCUITS[0];
    setPracticeCircuit(selectedCircuit);
    setRaceLaps(room.laps);
    setIsPracticeMode(false);
    setIsQualifyingMode(false);
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

    // Debounced automatic cloud synchronization if user is authenticated
    if (auth.currentUser) {
      const timer = setTimeout(() => {
        saveCareerToCloud({
          driverName: season.career.driverName,
          selectedTeamId: season.selectedTeamId,
          selectedDriverId: season.selectedDriverId,
          difficulty: season.difficulty,
          cashBalance: season.career.careerEarnings,
          wins: season.career.wins,
          podiums: season.career.podiums,
          racesEntered: season.career.racesDriven,
          championshipPoints: season.career.championships,
          customTeamName: season.career.customTeam?.name || '',
          fullSeason: season,
        }).catch(() => {});
      }, 2500);

      return () => clearTimeout(timer);
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

  // Optional Qualifying Session (1 Flying Lap shootout)
  const handleStartQualifying = (ghostDelay3s?: boolean) => {
    if (season.seasonFinished) return;
    if (typeof ghostDelay3s === 'boolean') {
      handleSetQualifyingGhostDelay3s(ghostDelay3s);
    }
    // When playing qualifying, auto-close any open multiplayer rooms
    multiplayerService.closeRoom('Room closed because host started Qualifying shootout.');
    setIsMultiplayerRace(false);
    setMultiplayerRoom(null);
    setShowMultiplayerModal(false);

    setIsPracticeMode(false);
    setPracticeCircuit(null);
    setIsQualifyingMode(true);
    setRaceLaps(1);
    setInRace(true);
  };

  const handleQualifyingComplete = (
    gridSlot: number,
    lapTime: number,
    classification: Array<{ position: number; driver: Driver; team: any; lapTime: number; gap: number }>
  ) => {
    setQualifyingGridSlot(gridSlot);
    setQualifyingResults(classification);
    setIsQualifyingMode(false);
    setInRace(false);
    setShowQualifyingModal(true);
  };

  const handleStartRace = (laps: number) => {
    if (season.seasonFinished) return;
    // When playing a regular race, ensure any multiplayer room is cleanly closed and disbanded
    multiplayerService.closeRoom('Room closed because host started Grand Prix.');
    setIsMultiplayerRace(false);
    setMultiplayerRoom(null);
    setShowMultiplayerModal(false);

    setIsPracticeMode(false);
    setIsQualifyingMode(false);
    setPracticeCircuit(null);
    setRaceLaps(laps);
    setSeason((prev) => ({ ...prev, lapCount: laps }));
    setInRace(true);
  };

  const handleStartPractice = (circuit: CircuitInfo, laps: number, diff: 'rookie' | 'pro' | 'legend', botCount: number = 19) => {
    // When playing practice, ensure any multiplayer room is cleanly closed and disbanded
    multiplayerService.closeRoom('Room closed because host started Free Practice.');
    setIsMultiplayerRace(false);
    setMultiplayerRoom(null);
    setShowMultiplayerModal(false);

    setIsPracticeMode(true);
    setIsQualifyingMode(false);
    setActiveTutorialDrill(null);
    setPracticeCircuit(circuit);
    setPracticeDifficulty(diff);
    setPracticeBotCount(botCount);
    setRaceLaps(laps);
    setInRace(true);
  };

  const handleLaunchTutorialPracticeDrill = (drill: TutorialPracticeDrillConfig) => {
    const targetCircuit = CIRCUITS.find((c) => c.id === drill.circuitId) || CIRCUITS[0];
    multiplayerService.closeRoom('Room closed because host started Academy Practice Drill.');
    setIsMultiplayerRace(false);
    setMultiplayerRoom(null);
    setShowMultiplayerModal(false);

    setActiveTutorialDrill(drill);
    setTutorialStepIndex(drill.stepIndex);
    setShowTutorial(false);
    setIsPracticeMode(true);
    setIsQualifyingMode(false);
    setPracticeCircuit(targetCircuit);
    setPracticeDifficulty(drill.difficulty);
    setPracticeBotCount(drill.botCount);
    setRaceLaps(drill.laps);
    setInRace(true);
  };

  const handleCompleteTutorialDrill = (drillId: string) => {
    setCompletedTutorialDrills((prev) => {
      const next = prev.includes(drillId) ? prev : [...prev, drillId];
      try {
        localStorage.setItem('apex26_tutorial_drills_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
    const nextStep = activeTutorialDrill ? Math.min(3, activeTutorialDrill.stepIndex + 1) : tutorialStepIndex;
    setTutorialStepIndex(nextStep);
    setActiveTutorialDrill(null);
    setInRace(false);
    setIsPracticeMode(false);
    setPracticeCircuit(null);
    setShowTutorial(true);
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

  const handleCompleteOffSeasonTask = (
    taskId: string,
    rewards?: {
      cashDelta?: number;
      reputationDelta?: number;
      ratingDelta?: number;
      interviewQuote?: string;
      interviewSummary?: string;
    }
  ) => {
    setSeason((prev) => {
      const existing = prev.career.offSeasonActionsUsed || [];
      if (existing.includes(taskId)) return prev;
      return {
        ...prev,
        career: {
          ...prev.career,
          offSeasonActionsUsed: [...existing, taskId],
          careerEarnings: Math.max(0, prev.career.careerEarnings + (rewards?.cashDelta || 0)),
          reputation: Math.max(0, Math.min(100, prev.career.reputation + (rewards?.reputationDelta || 0))),
          driverRating: Math.round((prev.career.driverRating + (rewards?.ratingDelta || 0)) * 10) / 10,
          lastOffSeasonInterviewQuote: rewards?.interviewQuote || prev.career.lastOffSeasonInterviewQuote,
          lastOffSeasonInterviewSummary: rewards?.interviewSummary || prev.career.lastOffSeasonInterviewSummary,
        },
      };
    });
  };

  const handleStartNextSeason = () => {
    // Do NOT allow skipping an active season or skipping mandatory off-season tasks
    if (!season.seasonFinished) return;
    const completedOffSeason = season.career.offSeasonActionsUsed || [];
    const requiredTasks = ['interview_completed', 'gala_attended', 'shakedown_completed'];
    if (!requiredTasks.every((t) => completedOffSeason.includes(t))) {
      return;
    }

    const currentTeam = season.career.customTeam && season.selectedTeamId === season.career.customTeam.id
      ? season.career.customTeam
      : TEAMS.find((t) => t.id === season.selectedTeamId) || TEAMS[0];

    const sortedDrivers = Object.entries(season.driverPoints).sort((a, b) => b[1] - a[1]);
    const playerRank = sortedDrivers.findIndex(([id]) => id === season.selectedDriverId) + 1 || 1;
    const sortedTeams = Object.entries(season.constructorPoints).sort((a, b) => b[1] - a[1]);
    const teamRank = sortedTeams.findIndex(([id]) => id === season.selectedTeamId) + 1 || 1;

    const seasonWins = season.completedRounds.filter((r) => r.playerFinishedPosition === 1).length;
    const seasonPodiums = season.completedRounds.filter((r) => r.playerFinishedPosition <= 3).length;
    const avgFinish =
      season.completedRounds.length > 0
        ? Number(
            (
              season.completedRounds.reduce((acc, r) => acc + r.playerFinishedPosition, 0) /
              season.completedRounds.length
            ).toFixed(1)
          )
        : 10;
    const isWorldChamp = playerRank === 1;
    const isConstructorsChamp = teamRank === 1;

    const historyEntry = {
      seasonNumber: season.career.seasonNumber || 1,
      year: 2026 + (season.career.seasonNumber || 1) - 1,
      teamName: currentTeam.name,
      teamId: season.selectedTeamId,
      finalDriverRank: playerRank,
      driverPoints: season.driverPoints[season.selectedDriverId] || 0,
      constructorRank: teamRank,
      constructorPoints: season.constructorPoints[season.selectedTeamId] || 0,
      wins: seasonWins,
      podiums: seasonPodiums,
      fastestLaps: seasonWins,
      avgFinishPosition: avgFinish,
      driverRatingEnd: season.career.driverRating,
      isWorldChampion: isWorldChamp,
      isConstructorsChampion: isConstructorsChamp,
      totalEarnings: season.completedRounds.reduce((acc, r) => acc + r.prizeMoneyAwarded, 0),
      driverPointsSnapshot: { ...season.driverPoints },
      constructorPointsSnapshot: { ...season.constructorPoints },
      completedRoundsSnapshot: [...season.completedRounds],
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
        offSeasonActionsUsed: [],
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

  const handleFoundNewsCompany = (company: NewsCompanyConfig, startupFee: number) => {
    setSeason((prev) => ({
      ...prev,
      career: {
        ...prev.career,
        careerEarnings: Math.max(0, prev.career.careerEarnings - startupFee),
        newsCompany: company,
      },
    }));
  };

  const handleUpdateNewsCompany = (company: NewsCompanyConfig, feeDelta: number = 0) => {
    setSeason((prev) => ({
      ...prev,
      career: {
        ...prev.career,
        careerEarnings: Math.max(0, prev.career.careerEarnings - feeDelta),
        newsCompany: company,
      },
    }));
  };

  const handlePublishNewsReport = (report: PublishedNewsReport) => {
    setSeason((prev) => {
      const currentCompany = prev.career.newsCompany;
      if (!currentCompany) return prev;
      const updatedCredibility = Math.max(
        5,
        Math.min(100, currentCompany.credibility + report.credibilityDelta)
      );
      const updatedSubscribers = Math.max(
        500,
        currentCompany.subscribers + report.subscriberDelta
      );
      return {
        ...prev,
        career: {
          ...prev.career,
          careerEarnings: Math.max(
            0,
            prev.career.careerEarnings + report.revenueEarned
          ),
          newsCompany: {
            ...currentCompany,
            credibility: updatedCredibility,
            subscribers: updatedSubscribers,
            totalRevenue: currentCompany.totalRevenue + report.revenueEarned,
            publishedReports: [report, ...currentCompany.publishedReports],
          },
        },
      };
    });
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
    // If completed session was Free Practice (or a Tutorial Practice Drill), exit cleanly
    if (isPracticeMode) {
      if (activeTutorialDrill) {
        handleCompleteTutorialDrill(activeTutorialDrill.id);
        return;
      }
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

    // Resolve any pending Paddock News Company predictions and VIRAL RUMORS for this round:
    // Regular predictions yield modest subscriber shifts & income, UNLESS it was spread as a
    // VIRAL RUMOR (`isViralRumor: true`) and turns out TRUE—which awards a massive viral jackpot!
    let updatedNewsCompany = season.career.newsCompany || null;
    if (updatedNewsCompany && updatedNewsCompany.publishedReports?.length) {
      let totalSubShiftFromPredictions = 0;
      let totalCredibilityShift = 0;
      let netSubscriberRoundDeltaCash = 0;

      const resolvedReports = updatedNewsCompany.publishedReports.map((rep) => {
        const subPrice = updatedNewsCompany!.subscriptionPrice ?? 8;
        const mgrProtection = updatedNewsCompany!.pricingManager
          ? updatedNewsCompany!.pricingManager.elasticityProtection
          : 0;
        const mgrConversion = updatedNewsCompany!.pricingManager
          ? updatedNewsCompany!.pricingManager.conversionBonus
          : 0;
        const lowPriceBoost = subPrice < 8 ? 1 + (8 - subPrice) * 0.08 : 1.0;

        // 1. Resolve Custom Made-Up Viral Rumors (e.g. "Lando Norris is transferring teams", "Somebody plans to start a new F1 team", "Williams Racing has new techniques", etc.)
        if (
          rep.isViralRumor &&
          rep.viralRumorStatus === 'pending' &&
          rep.roundPublished === season.currentRound &&
          rep.customRumorType &&
          rep.customRumorType !== 'race_outcome'
        ) {
          const claimText = rep.customRumorClaim || rep.title;
          const lowerClaim = `${claimText} ${rep.content}`.toLowerCase();

          // Check if a team or driver mentioned in the custom rumor had a strong race or if the rumor was well-written
          const top6Drivers = sortedField.slice(0, 6);
          const mentionedTopFinish = top6Drivers.some((d) => {
            const drvParts = d.name.toLowerCase().split(' ').filter((p) => p.length >= 3);
            const tm = TEAMS.find((t) => t.id === d.teamId);
            const tmParts = (tm?.name || d.teamId).toLowerCase().split(' ').filter((p) => p.length >= 3);
            return drvParts.some((p) => lowerClaim.includes(p)) || tmParts.some((p) => lowerClaim.includes(p));
          });

          const baseTruthChance =
            (rep.overallScore || 75) >= 75
              ? 0.72
              : (rep.overallScore || 75) >= 60
              ? 0.58
              : 0.32;
          const finalTruthChance = Math.min(
            0.9,
            baseTruthChance + (mentionedTopFinish ? 0.15 : 0) + (updatedNewsCompany!.credibility >= 80 ? 0.08 : 0)
          );
          const didRumorTurnOutTrue = Math.random() < finalTruthChance;

          if (didRumorTurnOutTrue) {
            const gainedSubscribers = Math.round(
              (26000 + (rep.overallScore || 78) * 210) *
                lowPriceBoost *
                (1 + mgrConversion)
            );
            const viralJackpotCash = Math.round(
              420000 + gainedSubscribers * Math.max(8, subPrice) * 1.3
            );
            totalSubShiftFromPredictions += gainedSubscribers;
            totalCredibilityShift += 14;
            netSubscriberRoundDeltaCash += viralJackpotCash;

            const resolutionNote = `🚨 RUMOR CONFIRMED TRUE: Paddock insiders & FIA leaks verified your custom rumor ("${claimText}")! You earned a massive viral windfall of +$${viralJackpotCash.toLocaleString()} and +${gainedSubscribers.toLocaleString()} new subscribers!`;

            return {
              ...rep,
              viralRumorStatus: 'true' as const,
              viralRumorPayoutDelta: viralJackpotCash,
              viralRumorSubscriberDelta: gainedSubscribers,
              viralRumorResolutionNote: resolutionNote,
              subscriberDelta: rep.subscriberDelta + gainedSubscribers,
              revenueEarned: rep.revenueEarned + viralJackpotCash,
              factCheckNotes: [resolutionNote, ...(rep.factCheckNotes || [])],
            };
          } else {
            const lostSubscribers = -Math.min(
              Math.max(0, updatedNewsCompany!.subscribers - 500),
              Math.round(6800 * (1 - mgrProtection * 0.4))
            );
            const backlashLoss = -55000;
            totalSubShiftFromPredictions += lostSubscribers;
            totalCredibilityShift -= 12;
            netSubscriberRoundDeltaCash += backlashLoss;

            const resolutionNote = `❌ RUMOR DEBUNKED: Official team principals & FIA delegates denied your custom rumor ("${claimText}") after the race, triggering ${lostSubscribers.toLocaleString()} subscriber cancellations.`;

            return {
              ...rep,
              viralRumorStatus: 'false' as const,
              viralRumorPayoutDelta: backlashLoss,
              viralRumorSubscriberDelta: lostSubscribers,
              viralRumorResolutionNote: resolutionNote,
              subscriberDelta: rep.subscriberDelta + lostSubscribers,
              revenueEarned: rep.revenueEarned + backlashLoss,
              factCheckNotes: [resolutionNote, ...(rep.factCheckNotes || [])],
            };
          }
        }

        // 2. Resolve Race Predictions & Race-Outcome Viral Rumors
        if (
          rep.isPrediction &&
          rep.predictionStatus === 'pending' &&
          rep.predictionTargetRound === season.currentRound &&
          rep.predictedDriverId
        ) {
          const drvRank =
            sortedField.findIndex((d) => d.id === rep.predictedDriverId) + 1;
          const targetThreshold =
            rep.predictionType === 'win'
              ? 1
              : rep.predictionType === 'podium'
              ? 3
              : 5;
          const isOutcomeCorrect = drvRank >= 1 && drvRank <= targetThreshold;
          const hasCompellingReasoning =
            (rep.reasoningScore ?? 50) >= 52 && rep.accuracyScore >= 52;

          if (rep.isViralRumor) {
            if (isOutcomeCorrect) {
              // VIRAL RUMOR TURNED OUT TRUE -> MASSIVE WINDFALL!
              const difficultyScale =
                rep.predictionType === 'win'
                  ? 1.55
                  : rep.predictionType === 'podium'
                  ? 1.2
                  : 0.95;
              const gainedSubscribers = Math.round(
                (24000 + (rep.overallScore || 75) * 190) *
                  difficultyScale *
                  lowPriceBoost *
                  (1 + mgrConversion)
              );
              const viralJackpotCash = Math.round(
                (380000 + gainedSubscribers * Math.max(8, subPrice) * 1.25) *
                  difficultyScale
              );
              totalSubShiftFromPredictions += gainedSubscribers;
              totalCredibilityShift += 14;
              netSubscriberRoundDeltaCash += viralJackpotCash;

              return {
                ...rep,
                predictionStatus: 'correct' as const,
                predictionSubscriberShift: gainedSubscribers,
                viralRumorStatus: 'true' as const,
                viralRumorPayoutDelta: viralJackpotCash,
                viralRumorSubscriberDelta: gainedSubscribers,
                subscriberDelta: rep.subscriberDelta + gainedSubscribers,
                revenueEarned: rep.revenueEarned + viralJackpotCash,
              };
            } else {
              // VIRAL RUMOR TURNED OUT FALSE -> TABLOID BACKLASH!
              const lostSubscribers = -Math.min(
                Math.max(0, updatedNewsCompany!.subscribers - 500),
                Math.round(7500 * (1 - mgrProtection * 0.4))
              );
              const backlashLoss = -65000;
              totalSubShiftFromPredictions += lostSubscribers;
              totalCredibilityShift -= 14;
              netSubscriberRoundDeltaCash += backlashLoss;

              return {
                ...rep,
                predictionStatus: 'incorrect' as const,
                predictionSubscriberShift: lostSubscribers,
                viralRumorStatus: 'false' as const,
                viralRumorPayoutDelta: backlashLoss,
                viralRumorSubscriberDelta: lostSubscribers,
                subscriberDelta: rep.subscriberDelta + lostSubscribers,
                revenueEarned: rep.revenueEarned + backlashLoss,
              };
            }
          }

          if (isOutcomeCorrect && hasCompellingReasoning) {
            const difficultyScale =
              rep.predictionType === 'win'
                ? 1.35
                : rep.predictionType === 'podium'
                ? 1.1
                : 0.85;
            const reasonFactor = 0.75 + ((rep.reasoningScore ?? 75) / 100) * 0.5;
            const highPriceDampen =
              subPrice > 22
                ? Math.max(
                    0.6,
                    1 - (subPrice - 22) * 0.012 * (1 - mgrProtection)
                  )
                : 1.0;
            const gainedSubscribers = Math.round(
              2200 *
                difficultyScale *
                reasonFactor *
                lowPriceBoost *
                highPriceDampen *
                (1 + mgrConversion)
            );
            // Modest organic subscription income for normal predictions
            const organicSubIncome = Math.round(
              gainedSubscribers *
                subPrice *
                0.08 *
                (0.65 + (updatedNewsCompany!.credibility / 100) * 0.5)
            );
            totalSubShiftFromPredictions += gainedSubscribers;
            totalCredibilityShift += 5;
            netSubscriberRoundDeltaCash += organicSubIncome;

            return {
              ...rep,
              predictionStatus: 'correct' as const,
              predictionSubscriberShift: gainedSubscribers,
              subscriberDelta: rep.subscriberDelta + gainedSubscribers,
              revenueEarned: rep.revenueEarned + organicSubIncome,
            };
          } else {
            const overpriceAnger =
              subPrice > 10
                ? 1 + (subPrice - 10) * 0.045 * (1 - mgrProtection)
                : 1.0;
            const lostSubscribers = -Math.min(
              Math.max(0, updatedNewsCompany!.subscribers - 500),
              Math.round(
                (rep.predictionType === 'win'
                  ? 2600
                  : rep.predictionType === 'podium'
                  ? 2000
                  : 1500) * overpriceAnger
              )
            );
            const cancellationRefundLoss = -Math.round(
              Math.abs(lostSubscribers) * Math.max(2, subPrice * 0.35)
            );
            totalSubShiftFromPredictions += lostSubscribers;
            totalCredibilityShift -= 7;
            netSubscriberRoundDeltaCash += cancellationRefundLoss;

            return {
              ...rep,
              predictionStatus: 'incorrect' as const,
              predictionSubscriberShift: lostSubscribers,
              subscriberDelta: rep.subscriberDelta + lostSubscribers,
              revenueEarned: rep.revenueEarned + cancellationRefundLoss,
            };
          }
        }
        return rep;
      });

      const newSubCount = Math.max(
        500,
        updatedNewsCompany.subscribers + totalSubShiftFromPredictions
      );
      const newCred = Math.max(
        5,
        Math.min(100, updatedNewsCompany.credibility + totalCredibilityShift)
      );

      updatedNewsCompany = {
        ...updatedNewsCompany,
        totalRevenue:
          updatedNewsCompany.totalRevenue + netSubscriberRoundDeltaCash,
        credibility: newCred,
        subscribers: newSubCount,
        publishedReports: resolvedReports,
      };
      totalPayout = Math.max(0, totalPayout + netSubscriberRoundDeltaCash);
    }

    // Format lap time helper (seconds -> M:SS.mmm)
    const formatLapClock = (sec: number) => {
      if (!sec || !Number.isFinite(sec) || sec <= 0) return '1:24.310';
      const mins = Math.floor(sec / 60);
      const remSec = sec - mins * 60;
      return `${mins}:${remSec < 10 ? '0' : ''}${remSec.toFixed(3)}`;
    };

    const startSlot = qualifyingGridSlot ?? 12;
    const positionsGained = startSlot - actualPlayerPos;
    const playerDisplayName = season.career.driverName || playerDriver.name;
    const winnerDisplayName =
      winnerDriver.id === playerDriver.id ? playerDisplayName : winnerDriver.name;
    const p2Driver = sortedField[1] || DRIVERS[1];
    const p3Driver = sortedField[2] || DRIVERS[2];
    const p2DisplayName = p2Driver.id === playerDriver.id ? playerDisplayName : p2Driver.name;
    const p3DisplayName = p3Driver.id === playerDriver.id ? playerDisplayName : p3Driver.name;

    // Determine true session fastest lap across all drivers
    let sessionFastestDriver = winnerDriver;
    let sessionFastestLapSec = bestLapTime > 5 ? bestLapTime : 78.42;
    if (finalStandingsDetails && finalStandingsDetails.length > 0) {
      for (const detail of finalStandingsDetails) {
        if (detail.bestLapTime && detail.bestLapTime > 5 && detail.bestLapTime < sessionFastestLapSec) {
          sessionFastestLapSec = detail.bestLapTime;
          sessionFastestDriver = detail.driver;
        }
      }
    }
    const fastestDriverDisplayName =
      sessionFastestDriver.id === playerDriver.id ? playerDisplayName : sessionFastestDriver.name;
    const playerBestLapSec =
      bestLapTime > 5
        ? bestLapTime
        : playerDetail?.bestLapTime && playerDetail.bestLapTime > 5
        ? playerDetail.bestLapTime
        : sessionFastestLapSec + (actualPlayerPos === 1 ? 0 : 0.42);

    // 1. Overtakes & Grid Progression Highlights
    const overtakesList: string[] = [];
    if (positionsGained > 0) {
      const passedDrivers = sortedField
        .slice(actualPlayerPos, Math.min(sortedField.length, startSlot))
        .map((d) => d.name)
        .slice(0, 3);
      overtakesList.push(
        `${playerDisplayName} surged from P${startSlot} on the grid to finish P${actualPlayerPos} (+${positionsGained} positions gained), executing decisive braking overtakes past ${
          passedDrivers.length > 0 ? passedDrivers.join(', ') : p2DisplayName
        }.`
      );
    } else if (positionsGained === 0 && actualPlayerPos === 1) {
      overtakesList.push(
        `${playerDisplayName} converted Pole Position (P1) into a lights-to-flag victory, fending off ${p2DisplayName}'s slipstream attacks through the DRS detection zones.`
      );
    } else if (positionsGained < 0) {
      overtakesList.push(
        `${playerDisplayName} started P${startSlot} and battled fierce midfield traffic to bring the car home in P${actualPlayerPos} as ${winnerDisplayName} controlled the front.`
      );
    } else {
      overtakesList.push(
        `${playerDisplayName} held grid slot P${actualPlayerPos} under intense wheel-to-wheel pressure across all ${raceLaps} laps at ${currentCircuit.name}.`
      );
    }

    // Check other notable movers from qualifying or field order
    if (qualifyingResults && qualifyingResults.length > 0) {
      let bestAiGain = 0;
      let bestAiMoverName = '';
      let bestAiStart = 0;
      let bestAiFinish = 0;
      sortedField.forEach((drv, idx) => {
        if (drv.id === playerDriver.id) return;
        const qEntry = qualifyingResults.find((q) => q.driver.id === drv.id);
        if (qEntry) {
          const gain = qEntry.position - (idx + 1);
          if (gain > bestAiGain) {
            bestAiGain = gain;
            bestAiMoverName = drv.name;
            bestAiStart = qEntry.position;
            bestAiFinish = idx + 1;
          }
        }
      });
      if (bestAiGain >= 2) {
        overtakesList.push(
          `Hard Charger: ${bestAiMoverName} carved through ${bestAiGain} cars from P${bestAiStart} to claim P${bestAiFinish} using late-braking dives into the ${currentCircuit.turns}-turn circuit.`
        );
      }
    }
    if (overtakesList.length < 2) {
      overtakesList.push(
        `Podium Battle: ${p2DisplayName} and ${p3DisplayName} traded slipstream tow passes at over 315 km/h before settling P2 and P3 by ${(
          Math.abs((podiumGaps?.[2]?.gapSeconds || 2.4) - (podiumGaps?.[1]?.gapSeconds || 1.1)) || 0.85
        ).toFixed(2)}s.`
      );
    }

    // 2. Fastest Laps & Pace Telemetry Highlights
    const avgSpeedKmh = Math.min(
      268,
      Math.max(162, (currentCircuit.lengthKm / (sessionFastestLapSec / 3600)) * 0.48)
    ).toFixed(1);
    const fastestLapsList: string[] = [
      `Purple Fastest Lap: ${fastestDriverDisplayName} clocked the session benchmark of ${formatLapClock(
        sessionFastestLapSec
      )} (avg ${avgSpeedKmh} km/h across the ${currentCircuit.lengthKm} km ${currentCircuit.name} layout).`,
      `Your Telemetry Pace: ${playerDisplayName} recorded a personal best lap of ${formatLapClock(
        playerBestLapSec
      )}${
        Math.abs(playerBestLapSec - sessionFastestLapSec) < 0.01
          ? ' — setting the overall fastest lap of the Grand Prix!'
          : ` (${
              playerBestLapSec > sessionFastestLapSec
                ? `+${(playerBestLapSec - sessionFastestLapSec).toFixed(3)}s off purple pace`
                : `-${(sessionFastestLapSec - playerBestLapSec).toFixed(3)}s faster than the field`
            }).`
      }`,
    ];

    // 3. Incidents & Key Session Events
    const incidentsList: string[] = [];
    const closeBattlePair = finalStandingsDetails?.find(
      (s, idx) =>
        idx > 0 &&
        Math.abs(s.gapToLeaderSeconds - finalStandingsDetails[idx - 1].gapToLeaderSeconds) < 0.95
    );
    if (closeBattlePair && finalStandingsDetails) {
      const aheadIdx = finalStandingsDetails.findIndex((s) => s.driver.id === closeBattlePair.driver.id) - 1;
      const aheadDrv = finalStandingsDetails[aheadIdx]?.driver;
      const delta = Math.abs(
        closeBattlePair.gapToLeaderSeconds - (finalStandingsDetails[aheadIdx]?.gapToLeaderSeconds || 0)
      );
      if (aheadDrv) {
        incidentsList.push(
          `Photo-Finish Steward Note: ${aheadDrv.name} and ${closeBattlePair.driver.name} crossed the line separated by just ${delta.toFixed(
            2
          )}s after wheel-to-wheel contact warnings in the final sector.`
        );
      }
    }

    const tailDriver = sortedField[sortedField.length - 1] || DRIVERS[DRIVERS.length - 1];
    const p19Driver = sortedField[sortedField.length - 2] || DRIVERS[DRIVERS.length - 2];
    incidentsList.push(
      `Track Limits & Lockup Report: ${tailDriver.name} (P${sortedField.length}) and ${p19Driver.name} (P${
        sortedField.length - 1
      }) suffered front-left tire lockups and curb strikes under heavy braking, dropping them out of points contention.`
    );
    if (teammateFinishPos !== undefined) {
      incidentsList.push(
        `Team Radio & Strategy: Your teammate finished P${teammateFinishPos} while ${winnerDisplayName} sealed P1 with a ${
          p1LeadSec ? `+${p1LeadSec.toFixed(2)}s` : '+1.45s'
        } winning margin over ${p2DisplayName}.`
      );
    }

    const highlightsNarrative = `${winnerDisplayName} triumphed in the ${raceLaps}-lap ${
      currentCircuit.name
    } (${currentCircuit.location}) ahead of ${p2DisplayName} and ${p3DisplayName}. ${
      overtakesList[0]
    } ${fastestDriverDisplayName} set the fastest lap of the session at ${formatLapClock(
      sessionFastestLapSec
    )}, while ${tailDriver.name} lost ground following late-stint tire lockups.`;

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
      startingGridPosition: startSlot,
      positionsGained,
      teammateFinishedPosition: teammateFinishPos,
      teammateOwnerBonus: teammateBonus,
      teammateOwnerBonusDesc: teammateBonusDesc,
      fastestLapDriverId: sessionFastestDriver.id,
      fastestLapTime: sessionFastestLapSec,
      driverPointsAwarded: pointsAwarded,
      constructorPointsSnapshot: { ...updatedConstructorPoints },
      prizeMoneyAwarded: totalPayout,
      lapsCompleted: raceLaps,
      highlights: {
        overtakes: overtakesList,
        fastestLaps: fastestLapsList,
        incidents: incidentsList,
        narrative: highlightsNarrative,
      },
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
        newsCompany: updatedNewsCompany,
        offSeasonActionsUsed: isSeasonEnd ? [] : prev.career.offSeasonActionsUsed,
      },
    }));

    setLastRaceResult(result);
    setShowRaceHighlights(false);
    setQualifyingGridSlot(null);
    setQualifyingResults(null);
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
    <div className="f1-app-shell relative w-screen h-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans">
      {inRace ? (
        <RaceView
          circuit={
            isMultiplayerRace && multiplayerRoom
              ? (CIRCUITS.find((c) => c.id === multiplayerRoom.circuitId) || CIRCUITS[0])
              : (isPracticeMode && practiceCircuit ? practiceCircuit : currentCircuit)
          }
          laps={raceLaps}
          season={season}
          onRaceComplete={handleRaceComplete}
          onExitToPaddock={() => {
            const wasTutorialDrill = Boolean(activeTutorialDrill);
            setInRace(false);
            setIsPracticeMode(false);
            setIsQualifyingMode(false);
            setPracticeCircuit(null);
            setActiveTutorialDrill(null);
            setIsMultiplayerRace(false);
            setMultiplayerRoom(null);
            if (wasTutorialDrill) {
              setShowTutorial(true);
            }
          }}
          isPracticeMode={isPracticeMode}
          practiceDifficulty={isPracticeMode ? practiceDifficulty : undefined}
          practiceBotCount={isPracticeMode ? practiceBotCount : undefined}
          isMultiplayer={isMultiplayerRace}
          multiplayerRoom={multiplayerRoom}
          onOpenControls={() => setShowButtonMappingModal(true)}
          isQualifyingMode={isQualifyingMode}
          qualifyingGhostDelay3s={qualifyingGhostDelay3s}
          startingGridSlot={qualifyingGridSlot || undefined}
          onQualifyingComplete={handleQualifyingComplete}
          tutorialPracticeStage={activeTutorialDrill}
          onCompleteTutorialStage={handleCompleteTutorialDrill}
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
          onCompleteOffSeasonTask={handleCompleteOffSeasonTask}
          onQuitCareer={handleQuitCareer}
          onSellCustomTeam={handleSellCustomTeam}
          onOpenMultiplayer={() => setShowMultiplayerModal(true)}
          onOpenControls={() => setShowButtonMappingModal(true)}
          onOpenCloud={() => setShowCloudModal(true)}
          onOpenTutorial={() => setShowTutorial(true)}
          onStartQualifying={handleStartQualifying}
          qualifyingGhostDelay3s={qualifyingGhostDelay3s}
          onChangeQualifyingGhostDelay3s={handleSetQualifyingGhostDelay3s}
          qualifyingGridSlot={qualifyingGridSlot}
          onFoundNewsCompany={handleFoundNewsCompany}
          onUpdateNewsCompany={handleUpdateNewsCompany}
          onPublishNewsReport={handlePublishNewsReport}
        />
      )}

      {/* Difficulty Selection Modal (Choose CPU difficulty BEFORE starting career) */}
      {!hasChosenDifficulty && (
        <div className="f1-paddock-surface fixed inset-0 z-50 bg-black/85 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-2xl w-full rounded-3xl p-8 shadow-2xl flex flex-col gap-5 text-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-left">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-lg">
                  <Gauge className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-red-500 block">
                    Official FIA Career Setup
                  </span>
                  <h2 className="text-xl font-black text-white">Select Career AI Difficulty</h2>
                </div>
              </div>

              {/* Pre-Career Theme Switcher */}
              <div className="flex items-center gap-1 bg-neutral-950 border border-white/10 rounded-xl p-1">
                <Palette className="w-3.5 h-3.5 text-orange-400 mx-1" />
                {THEME_OPTIONS.map((tId) => (
                  <button
                    key={tId}
                    type="button"
                    onClick={() => setStoredTheme(tId)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                      appTheme === tId
                        ? 'bg-orange-500 text-black'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {tId === 'light' ? <Sun className="w-2.5 h-2.5" /> : tId === 'dark' ? <Moon className="w-2.5 h-2.5" /> : null}
                    <span>{APP_THEMES[tId].shortLabel}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-neutral-400 max-w-lg mx-auto">
              Formula 1 driver career rules: you start with MoneyGram Haas F1 Team. Choose the CPU AI racing pace and collision penalty duration for your career.
            </p>

            {/* Pre-Career Cloud Sign-In for Cross-Device Restoration */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Returning Driver on Another Device?</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono font-bold">CROSS-DEVICE CLOUD</span>
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Sign in with your Google account now to automatically restore your career, custom team, championship standings, and car upgrades.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignInBeforeCareer}
                disabled={isSigningIn}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                <Cloud className="w-4 h-4" />
                <span>{isSigningIn ? 'Restoring Save...' : 'Sign In with Google'}</span>
              </button>
            </div>
            {signInError && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-500/30 p-2.5 rounded-xl text-left">
                {signInError}
              </div>
            )}

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

            {/* Race Highlights Button & Expandable Session Summary */}
            <div className="flex flex-col gap-2.5 text-left">
              <button
                type="button"
                onClick={() => setShowRaceHighlights((prev) => !prev)}
                className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 border border-amber-500/40 text-amber-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>{showRaceHighlights ? 'Hide Race Highlights' : 'Race Highlights'}</span>
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  Overtakes • Fastest Laps • Incidents
                </span>
              </button>

              {showRaceHighlights && lastRaceResult.highlights && (
                <div className="bg-neutral-950 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-3 max-h-64 overflow-y-auto text-left">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-amber-400 block mb-1">
                      OFFICIAL FIA SESSION HIGHLIGHTS SUMMARY
                    </span>
                    <p className="text-xs text-neutral-200 leading-relaxed">
                      {lastRaceResult.highlights.narrative}
                    </p>
                  </div>

                  <div className="border-t border-white/10 pt-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5 mb-1">
                      <Flame className="w-3.5 h-3.5" /> Overtakes & Grid Progression
                    </span>
                    <ul className="space-y-1">
                      {lastRaceResult.highlights.overtakes.map((item, idx) => (
                        <li key={idx} className="text-xs text-neutral-300 leading-snug">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-white/10 pt-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 flex items-center gap-1.5 mb-1">
                      <Timer className="w-3.5 h-3.5" /> Fastest Laps & Telemetry
                    </span>
                    <ul className="space-y-1">
                      {lastRaceResult.highlights.fastestLaps.map((item, idx) => (
                        <li key={idx} className="text-xs text-neutral-300 leading-snug">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-white/10 pt-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 flex items-center gap-1.5 mb-1">
                      <Shield className="w-3.5 h-3.5" /> Key Incidents & Race Control
                    </span>
                    <ul className="space-y-1">
                      {lastRaceResult.highlights.incidents.map((item, idx) => (
                        <li key={idx} className="text-xs text-neutral-300 leading-snug">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {season.seasonFinished ? (
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 text-left text-xs text-amber-200 leading-relaxed">
                  <strong className="text-amber-400 uppercase block mb-0.5">
                    Mandatory FIA Off-Season Duties Required
                  </strong>
                  Season {season.career.seasonNumber || 1} has concluded! Before you can launch Season {(season.career.seasonNumber || 1) + 1}, you must complete your Post-Season Press Interviews, attend the FIA Prize Gala, and finish Pre-Season Shakedown in the Off-Season Hub.
                </div>
                <button
                  onClick={() => {
                    setShowPodiumModal(false);
                    setShowRaceHighlights(false);
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-black font-black text-xs uppercase rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Enter Off-Season Paddock (Complete Interviews & Duties)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowPodiumModal(false);
                  setShowRaceHighlights(false);
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

      {/* 4-Digit Code Multiplayer Rooms Modal */}
      <MultiplayerModal
        isOpen={showMultiplayerModal}
        onClose={() => setShowMultiplayerModal(false)}
        onLaunchRace={handleLaunchMultiplayerRace}
        season={season}
      />

      {/* Button & Gamepad Controls Re-mapping Modal */}
      <ButtonMappingModal
        isOpen={showButtonMappingModal}
        onClose={() => setShowButtonMappingModal(false)}
      />

      {/* Firebase Cloud Driver Profile & Global Leaderboard Modal */}
      <FirebaseCloudModal
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        season={season}
        onLoadSeason={(loaded) => setSeason(loaded)}
      />

      {/* Official FIA Qualifying Shootout Classification Modal */}
      {showQualifyingModal && qualifyingResults && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-xl w-full rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-center max-h-[90vh] overflow-hidden">
            <div className="flex justify-center">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                  qualifyingGridSlot === 1
                    ? 'bg-gradient-to-tr from-yellow-500 to-amber-600 shadow-yellow-500/20'
                    : 'bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-purple-500/20'
                }`}
              >
                <Timer className="w-7 h-7" />
              </div>
            </div>

            <div>
              <span className="text-xs uppercase font-black tracking-widest text-purple-400">
                Official FIA Qualifying Classification
              </span>
              <h2 className="text-2xl font-black text-white mt-1">
                {qualifyingGridSlot === 1 ? '👑 POLE POSITION SECURED!' : `QUALIFIED: P${qualifyingGridSlot} ON THE GRID`}
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                {currentCircuit.name} • 1 Flying Lap Shootout
              </p>
            </div>

            {/* Grid Classification List */}
            <div className="flex-1 overflow-y-auto max-h-[320px] rounded-xl bg-neutral-950 border border-neutral-800 p-2 space-y-1 text-left text-xs">
              {qualifyingResults.map((entry) => {
                const isPlayer = entry.driver.id === season.selectedDriverId || entry.driver.id === 'custom_driver';
                const mins = Math.floor(entry.lapTime / 60);
                const secs = (entry.lapTime % 60).toFixed(3).padStart(6, '0');
                const formattedTime = `${mins}:${secs}`;

                return (
                  <div
                    key={entry.driver.id}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                      isPlayer
                        ? 'bg-purple-500/25 border border-purple-400/50 text-white font-bold'
                        : 'bg-neutral-900/60 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 text-center font-mono font-black ${entry.position === 1 ? 'text-amber-400' : 'text-neutral-400'}`}>
                        P{entry.position}
                      </span>
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.team?.primaryColor || '#666' }} />
                      <span className="font-bold truncate max-w-[150px]">{entry.driver.name}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">({entry.team?.shortName || 'F1'})</span>
                    </div>

                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-neutral-200">{formattedTime}</span>
                      <span className="text-[11px] text-neutral-400 w-16 text-right">
                        {entry.position === 1 ? 'POLE' : `+${entry.gap.toFixed(3)}s`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setShowQualifyingModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-all cursor-pointer"
              >
                Return to Paddock
              </button>

              <button
                onClick={() => {
                  setShowQualifyingModal(false);
                  handleStartRace(season.lapCount || 5);
                }}
                className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Launch Grand Prix (Grid P{qualifyingGridSlot})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official FIA Career & Gameplay Tutorial Modal */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        initialStep={tutorialStepIndex}
        completedDrills={completedTutorialDrills}
        onLaunchPracticeDrill={handleLaunchTutorialPracticeDrill}
      />
    </div>
  );
}
