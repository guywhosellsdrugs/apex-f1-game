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
  IncomingTeamOffer,
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
import { CareerSlotsModal, CareerSaveSlot } from './components/CareerSlotsModal';
import { TutorialModal, TutorialPracticeDrillConfig } from './components/TutorialModal';
import { multiplayerService, RoomPublicState } from './services/multiplayerService';
import { inputManager } from './services/inputManager';
import { auth, signInWithGoogle, saveCareerToCloud, loadCareerFromCloud } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Trophy, ArrowRight, DollarSign, Award, CheckCircle2, Shield, Flame, Gauge, Zap, Cloud, Timer, Palette, Sun, Moon, FolderKanban } from 'lucide-react';
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
const CAREER_SLOTS_KEY = 'apex26_career_slots_v1';
const ACTIVE_CAREER_SLOT_KEY = 'apex26_active_career_slot_v1';

function buildSlotFromSeason(
  id: string,
  slotName: string,
  s: SeasonState,
  hasChosenDiff: boolean,
  createdAt?: number
): CareerSaveSlot {
  const now = Date.now();
  return {
    id,
    slotName,
    driverName: s.career?.driverName || 'Rookie Driver',
    driverNumber: s.career?.driverNumber || 87,
    selectedTeamId: s.selectedTeamId || 'haas',
    customTeamName: s.career?.customTeam?.name,
    difficulty: s.difficulty || 'rookie',
    hasChosenDifficulty: hasChosenDiff,
    seasonNumber: s.career?.seasonNumber || 1,
    currentRound: s.currentRound || 0,
    careerEarnings: s.career?.careerEarnings ?? 500000,
    wins: s.career?.wins || 0,
    podiums: s.career?.podiums || 0,
    championships: s.career?.championships || 0,
    racesDriven: s.career?.racesDriven || 0,
    seasonState: s,
    createdAt: createdAt || now,
    updatedAt: now,
  };
}

function mergeCareerSlotLists(
  primary: CareerSaveSlot[],
  secondary: CareerSaveSlot[]
): CareerSaveSlot[] {
  const byId = new Map<string, CareerSaveSlot>();
  for (const list of [secondary, primary]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || !item.id || !item.seasonState) continue;
      const existing = byId.get(item.id);
      if (!existing || (item.updatedAt || 0) >= (existing.updatedAt || 0)) {
        byId.set(item.id, item);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

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
    perez: 0,
    herta: 0,
  },
  constructorPoints: {
    haas: 0,
    mclaren: 0,
    redbull: 0,
    ferrari: 0,
    mercedes: 0,
    astonmartin: 0,
    williams: 0,
    cadillac: 0,
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
    cpuDriversLookingForTeam: ['perez', 'sainz', 'tsunoda', 'hulkenberg', 'gasly', 'lawson'],
    contractYearsRemaining: 1,
    contractTotalYears: 1,
    contractTypeLabel: '1-Season Rookie Prove-It Deal',
    contractSignedAtCups: 0,
    contractSignedAtWins: 0,
    contractSignedAtRating: 76,
    isOnProveItContract: true,
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
          if (!parsed.career.cpuDriversLookingForTeam || parsed.career.cpuDriversLookingForTeam.length === 0) {
            parsed.career.cpuDriversLookingForTeam = ['perez', 'sainz', 'tsunoda', 'hulkenberg', 'gasly', 'lawson'];
          }
          if (parsed.driverPoints && parsed.driverPoints.perez === undefined) {
            parsed.driverPoints.perez = 0;
            parsed.driverPoints.herta = 0;
          }
          if (parsed.constructorPoints && parsed.constructorPoints.cadillac === undefined) {
            parsed.constructorPoints.cadillac = 0;
          }
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

  // Multi-Career Save Slots State (Allows creating & switching between multiple careers under 1 account without quitting)
  const [careerSlots, setCareerSlots] = useState<CareerSaveSlot[]>(() => {
    try {
      const raw = localStorage.getItem(CAREER_SLOTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    const initialDiffChosen = localStorage.getItem('apex26_diff_chosen') === 'true';
    const initialSlot = buildSlotFromSeason(
      'career_slot_1',
      'Career #1',
      season,
      initialDiffChosen
    );
    return [initialSlot];
  });

  const [activeCareerSlotId, setActiveCareerSlotId] = useState<string>(() => {
    try {
      const savedActive = localStorage.getItem(ACTIVE_CAREER_SLOT_KEY);
      if (savedActive) return savedActive;
    } catch {}
    return 'career_slot_1';
  });

  const [showCareerSlotsModal, setShowCareerSlotsModal] = useState(false);

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
            if (cloudData.careerSlotsJson) {
              try {
                const parsedCloudSlots = JSON.parse(cloudData.careerSlotsJson);
                if (Array.isArray(parsedCloudSlots) && parsedCloudSlots.length > 0) {
                  setCareerSlots((prevSlots) => {
                    const merged = mergeCareerSlotLists(parsedCloudSlots, prevSlots);
                    try {
                      localStorage.setItem(CAREER_SLOTS_KEY, JSON.stringify(merged));
                    } catch {}
                    return merged;
                  });
                }
              } catch {}
            }

            // Restore entire full SeasonState if available
            if (cloudData.seasonStateJson) {
              try {
                const restoredSeason = JSON.parse(cloudData.seasonStateJson);
                if (restoredSeason && restoredSeason.career && restoredSeason.selectedTeamId) {
                  setSeason(restoredSeason);
                  setHasChosenDifficulty(true);
                  localStorage.setItem('apex26_diff_chosen', 'true');
                  if (cloudData.activeCareerSlotId) {
                    setActiveCareerSlotId(cloudData.activeCareerSlotId);
                    localStorage.setItem(ACTIVE_CAREER_SLOT_KEY, cloudData.activeCareerSlotId);
                  }
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
        if (cloudData.careerSlotsJson) {
          try {
            const parsedCloudSlots = JSON.parse(cloudData.careerSlotsJson);
            if (Array.isArray(parsedCloudSlots) && parsedCloudSlots.length > 0) {
              setCareerSlots((prevSlots) => {
                const merged = mergeCareerSlotLists(parsedCloudSlots, prevSlots);
                try {
                  localStorage.setItem(CAREER_SLOTS_KEY, JSON.stringify(merged));
                } catch {}
                return merged;
              });
            }
          } catch {}
        }

        if (cloudData.seasonStateJson) {
          try {
            const restored = JSON.parse(cloudData.seasonStateJson);
            if (restored && restored.career && restored.selectedTeamId) {
              setSeason(restored);
              setHasChosenDifficulty(true);
              localStorage.setItem('apex26_diff_chosen', 'true');
              if (cloudData.activeCareerSlotId) {
                setActiveCareerSlotId(cloudData.activeCareerSlotId);
                localStorage.setItem(ACTIVE_CAREER_SLOT_KEY, cloudData.activeCareerSlotId);
              }
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

    // Automatically keep active career slot synchronized inside careerSlots
    let latestSlotsSnapshot: CareerSaveSlot[] = [];
    setCareerSlots((prevSlots) => {
      const existingIdx = prevSlots.findIndex((s) => s.id === activeCareerSlotId);
      let nextSlots: CareerSaveSlot[];
      if (existingIdx >= 0) {
        const existing = prevSlots[existingIdx];
        const updatedSlot = buildSlotFromSeason(
          existing.id,
          existing.slotName,
          season,
          hasChosenDifficulty,
          existing.createdAt
        );
        nextSlots = [...prevSlots];
        nextSlots[existingIdx] = updatedSlot;
      } else {
        const newSlot = buildSlotFromSeason(
          activeCareerSlotId,
          `Career #${prevSlots.length + 1}`,
          season,
          hasChosenDifficulty
        );
        nextSlots = [...prevSlots, newSlot];
      }
      latestSlotsSnapshot = nextSlots;
      try {
        localStorage.setItem(CAREER_SLOTS_KEY, JSON.stringify(nextSlots));
        localStorage.setItem(ACTIVE_CAREER_SLOT_KEY, activeCareerSlotId);
      } catch {}
      return nextSlots;
    });

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
          activeCareerSlotId,
          careerSlots: latestSlotsSnapshot.length > 0 ? latestSlotsSnapshot : undefined,
        }).catch(() => {});
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [season, activeCareerSlotId, hasChosenDifficulty]);

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
    if (season.career.isUnsignedFreeAgent && !season.career.customTeam) return;
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
    if (season.career.isUnsignedFreeAgent && !season.career.customTeam) return;
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

  // Multi-Career Slot Handlers (Create, Switch, Rename, Delete without quitting existing careers)
  const handleCreateNewCareerSlot = (params: {
    slotName: string;
    driverName: string;
    driverNumber: number;
    country: string;
    difficulty: 'rookie' | 'pro' | 'legend';
  }) => {
    const newSlotId = 'career_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const freshSeason: SeasonState = {
      ...defaultSeasonState,
      difficulty: params.difficulty,
      driverPoints: { ...defaultSeasonState.driverPoints },
      constructorPoints: { ...defaultSeasonState.constructorPoints },
      completedRounds: [],
      career: {
        ...defaultSeasonState.career,
        driverName: params.driverName,
        driverNumber: params.driverNumber,
        country: params.country,
        difficultyLocked: params.difficulty,
        seasonHistory: [],
        cpuDriversLookingForTeam: ['perez', 'sainz', 'tsunoda', 'hulkenberg', 'gasly', 'lawson'],
      },
    };

    const newSlot = buildSlotFromSeason(newSlotId, params.slotName, freshSeason, true);

    setCareerSlots((prevSlots) => {
      // Save current active slot state before switching
      const updatedPrev = prevSlots.map((s) =>
        s.id === activeCareerSlotId
          ? buildSlotFromSeason(s.id, s.slotName, season, hasChosenDifficulty, s.createdAt)
          : s
      );
      const next = [...updatedPrev, newSlot];
      try {
        localStorage.setItem(CAREER_SLOTS_KEY, JSON.stringify(next));
        localStorage.setItem(ACTIVE_CAREER_SLOT_KEY, newSlotId);
      } catch {}
      return next;
    });

    setActiveCareerSlotId(newSlotId);
    setSeason(freshSeason);
    setHasChosenDifficulty(true);
    localStorage.setItem('apex26_diff_chosen', 'true');
    setQualifyingGridSlot(null);
    setQualifyingResults(null);
    setLastRaceResult(null);
    setShowPodiumModal(false);
  };

  const handleSwitchCareerSlot = (targetSlotId: string) => {
    const target = careerSlots.find((s) => s.id === targetSlotId);
    if (!target) return;

    // First persist current active career into careerSlots
    setCareerSlots((prevSlots) => {
      const next = prevSlots.map((s) =>
        s.id === activeCareerSlotId
          ? buildSlotFromSeason(s.id, s.slotName, season, hasChosenDifficulty, s.createdAt)
          : s
      );
      try {
        localStorage.setItem(CAREER_SLOTS_KEY, JSON.stringify(next));
        localStorage.setItem(ACTIVE_CAREER_SLOT_KEY, targetSlotId);
      } catch {}
      return next;
    });

    const targetDiffChosen =
      target.hasChosenDifficulty ||
      Boolean(target.seasonState?.career?.difficultyLocked) ||
      (target.seasonState?.career?.racesDriven || 0) > 0;

    setActiveCareerSlotId(targetSlotId);
    setSeason(target.seasonState);
    setHasChosenDifficulty(targetDiffChosen);
    if (targetDiffChosen) {
      localStorage.setItem('apex26_diff_chosen', 'true');
    } else {
      localStorage.removeItem('apex26_diff_chosen');
    }
    setQualifyingGridSlot(null);
    setQualifyingResults(null);
    setLastRaceResult(null);
    setShowPodiumModal(false);
  };

  const handleRenameCareerSlot = (slotId: string, newSlotName: string) => {
    setCareerSlots((prevSlots) => {
      const next = prevSlots.map((s) =>
        s.id === slotId ? { ...s, slotName: newSlotName, updatedAt: Date.now() } : s
      );
      try {
        localStorage.setItem(CAREER_SLOTS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleDeleteCareerSlot = (slotId: string) => {
    if (careerSlots.length <= 1) return;
    const remaining = careerSlots.filter((s) => s.id !== slotId);
    try {
      localStorage.setItem(CAREER_SLOTS_KEY, JSON.stringify(remaining));
    } catch {}
    setCareerSlots(remaining);

    if (slotId === activeCareerSlotId && remaining.length > 0) {
      const fallback = remaining[0];
      setActiveCareerSlotId(fallback.id);
      setSeason(fallback.seasonState);
      setHasChosenDifficulty(true);
      localStorage.setItem(ACTIVE_CAREER_SLOT_KEY, fallback.id);
      localStorage.setItem('apex26_diff_chosen', 'true');
    }
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
      year: season.career.seasonNumber || 1,
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

    const nextSeasonNum = (season.career.seasonNumber || 1) + 1;
    const cpuPool = DRIVERS.filter(
      (d) =>
        d.id !== 'rookie_teammate' &&
        d.id !== season.selectedDriverId &&
        d.id !== season.career.customTeam?.teammateDriverId
    );
    const nextCpuLooking: string[] = [];
    for (let i = 0; i < 6 && i < cpuPool.length; i++) {
      const idx = (nextSeasonNum * 3 + i * 2) % cpuPool.length;
      if (!nextCpuLooking.includes(cpuPool[idx].id)) {
        nextCpuLooking.push(cpuPool[idx].id);
      }
    }

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
        perez: 0, herta: 0,
        [prev.selectedDriverId]: 0,
      },
      constructorPoints: {
        haas: 0, mclaren: 0, redbull: 0, ferrari: 0, mercedes: 0,
        astonmartin: 0, williams: 0, cadillac: 0, audi: 0, alpine: 0, rb: 0,
        ...(prev.career.customTeam ? { [prev.career.customTeam.id]: 0 } : {}),
      },
      career: {
        ...prev.career,
        seasonNumber: nextSeasonNum,
        seasonHistory: [...(prev.career.seasonHistory || []), historyEntry],
        offSeasonActionsUsed: [],
        cpuDriversLookingForTeam: nextCpuLooking,
        contractYearsRemaining: Math.max(0, (prev.career.contractYearsRemaining ?? 1) - 1),
        customTeam: prev.career.customTeam
          ? {
              ...prev.career.customTeam,
              teammateContractYearsRemaining: Math.max(
                0,
                (prev.career.customTeam.teammateContractYearsRemaining ?? 1) - 1
              ),
            }
          : null,
      },
    }));

    setShowPodiumModal(false);
    setChampionNotice(null);
  };

  const buildDriverMarketOffers = (params: {
    selectedTeamId: string;
    currentRound: number;
    driverRating: number;
    reputation: number;
    wins: number;
    podiums: number;
    racesDriven: number;
    championships: number;
    isLookingForTeam: boolean;
    justScoredTopFinish?: boolean;
    proveItCutCount?: number;
    isUnsignedFreeAgent?: boolean;
    lastProveItCutOutcome?: 'low_offers_only' | 'nobody_signed';
    cutFromTeamsHistory?: string[];
  }): IncomingTeamOffer[] => {
    const {
      selectedTeamId,
      currentRound,
      driverRating,
      reputation,
      wins,
      podiums,
      racesDriven,
      championships,
      isLookingForTeam,
      justScoredTopFinish = false,
      proveItCutCount = 0,
      isUnsignedFreeAgent = false,
      lastProveItCutOutcome,
      cutFromTeamsHistory = [],
    } = params;

    const rivalTeams = TEAMS.filter((t) => t.id !== selectedTeamId);
    if (rivalTeams.length === 0) return [];

    const fmtUsd = (v: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

    // 0. If the player was recently CUT from a Prove-It contract:
    //Prove-It contracts are HIGH RISK: if you do bad even for 1 race, you get cut and either NOBODY signs you
    // or you only get rock-bottom prove-it offers from really bad backmarker teams (forcing you to keep swapping teams on terrible deals)!
    if (isUnsignedFreeAgent || (proveItCutCount > 0 && !justScoredTopFinish && championships === 0)) {
      if (lastProveItCutOutcome === 'nobody_signed') {
        // Nobody signed you!
        return [];
      }

      const badBackmarkers = rivalTeams.filter((t) => t.performanceTier >= 3);
      const unburnedBackmarkers = badBackmarkers.filter((t) => !cutFromTeamsHistory.includes(t.id));
      const candidateBadTeams = unburnedBackmarkers.length > 0 ? unburnedBackmarkers : badBackmarkers;

      if (candidateBadTeams.length === 0) return [];

      // The more times you get cut from a prove-it deal, the worse the pay gets (and fewer teams want you)!
      const cutPenaltyTier = Math.max(1, proveItCutCount);
      const baseLowSal =
        cutPenaltyTier === 1
          ? 50000 // $50,000/race ($500,000 for 1 Year)
          : cutPenaltyTier === 2
          ? 25000 // $25,000/race ($250,000 for 1 Year)
          : 10000; // $10,000/race ($100,000 for 1 Year)

      const primaryBad = candidateBadTeams[(currentRound + cutPenaltyTier) % candidateBadTeams.length];
      const lowOffers: IncomingTeamOffer[] = [];

      if (primaryBad) {
        const annualCash = baseLowSal * 10;
        lowOffers.push({
          id: `cut_lifeline_${primaryBad.id}_${currentRound}_${cutPenaltyTier}`,
          teamId: primaryBad.id,
          teamName: primaryBad.name,
          offerTier: 'backmarker_lowball',
          offerTitle:
            cutPenaltyTier >= 2
              ? `DESPERATION ${cutPenaltyTier}x-CUT PROVE-IT LIFELINE (${fmtUsd(annualCash)} / 1 YR)`
              : `LOW-BALL BACKMARKER PROVE-IT LIFELINE (${fmtUsd(annualCash)} / 1 YR)`,
          annualSalary: annualCash,
          salaryPerRace: baseLowSal,
          signingBonus: 0,
          buyoutCovered: true,
          waivesRequirements: true,
          teamTier: primaryBad.performanceTier,
          isDesperateOverpay: false,
          contractYears: 1,
          isProveItDeal: true,
          pitchMessage: `After getting cut ${cutPenaltyTier} time${cutPenaltyTier > 1 ? 's' : ''} on a prove-it contract, almost every team in the paddock passed on you. ${primaryBad.name} (Tier ${primaryBad.performanceTier} backmarker) is offering a rock-bottom ${fmtUsd(annualCash)} for 1 Season (${fmtUsd(baseLowSal)}/race, $0 bonus) prove-it deal. Warning: if you do bad even for one race here, we will cut you too and nobody might sign you!`,
          roundOffered: currentRound + 1,
        });
      }

      // On first cut only, a second bottom-tier team might also throw a slightly lower prove-it offer so you can swap between bad teams
      if (cutPenaltyTier === 1 && candidateBadTeams.length > 1) {
        const secondaryBad = candidateBadTeams[(currentRound + cutPenaltyTier + 1) % candidateBadTeams.length];
        if (secondaryBad && secondaryBad.id !== primaryBad?.id) {
          const secSal = 35000; // $350,000 for 1 Year
          const secAnnual = secSal * 10;
          lowOffers.push({
            id: `cut_lifeline2_${secondaryBad.id}_${currentRound}`,
            teamId: secondaryBad.id,
            teamName: secondaryBad.name,
            offerTier: 'backmarker_lowball',
            offerTitle: `BACKMARKER MINIMUM PROVE-IT DEAL (${fmtUsd(secAnnual)} / 1 YR)`,
            annualSalary: secAnnual,
            salaryPerRace: secSal,
            signingBonus: 0,
            buyoutCovered: true,
            waivesRequirements: true,
            teamTier: secondaryBad.performanceTier,
            isDesperateOverpay: false,
            contractYears: 1,
            isProveItDeal: true,
            pitchMessage: `${secondaryBad.name} will give you a 1-Season Prove-It seat at ${fmtUsd(secAnnual)} for 1 Year (${fmtUsd(secSal)}/race, $0 bonus) after your recent release—but one bad race and you're out!`,
            roundOffered: currentRound + 1,
          });
        }
      }

      return lowOffers;
    }

    const winRate = racesDriven > 0 ? wins / racesDriven : 0;
    const isLowCaliber =
      driverRating < 80 &&
      wins === 0 &&
      winRate < 0.12 &&
      reputation < 32 &&
      championships === 0;
    const isGoodDriver =
      driverRating >= 80 ||
      wins >= 1 ||
      podiums >= 2 ||
      winRate >= 0.15 ||
      reputation >= 35 ||
      championships >= 1;
    const isEliteStar =
      driverRating >= 85 ||
      wins >= 3 ||
      winRate >= 0.30 ||
      reputation >= 65 ||
      championships >= 1;

    // 1. If the player is already on a team and has NOT announced they are looking for a team:
    // They get NO offers if they aren't good, and even if they are good, they rarely get at most 1 discrete poaching offer!
    if (!isLookingForTeam) {
      if (!isGoodDriver) return [];
      if (!justScoredTopFinish && !isEliteStar) return [];

      // Worse/midfield teams (Tier 3-4) are more likely to send a massive cash offer to poach a star driver away!
      const worseRivals = rivalTeams.filter((t) => t.performanceTier >= 3);
      const midOrTopRivals = rivalTeams.filter((t) => t.performanceTier <= 2);
      const useWorseTeamBigCash = worseRivals.length > 0 && (Math.random() < 0.68 || !isEliteStar);

      if (useWorseTeamBigCash) {
        const target = worseRivals[(currentRound + wins) % worseRivals.length];
        // Worse team throws massive marquee cash per year to lure a good driver into their slower car
        const perRace = Math.round(((1650000 + (driverRating - 78) * 140000 + championships * 650000)) / 50000) * 50000;
        const annualCash = perRace * 10;
        const bonus = Math.round(((4200000 + championships * 2000000)) / 100000) * 100000;
        const years = isEliteStar ? 2 : 1;
        return [
          {
            id: `unsolicited_warchest_${target.id}_${currentRound}`,
            teamId: target.id,
            teamName: target.name,
            offerTier: 'underdog_warchest',
            offerTitle: `UNDERDOG MEGA-CASH OFFER (${years}-YEAR TERM)`,
            annualSalary: annualCash,
            salaryPerRace: perRace,
            signingBonus: bonus,
            buyoutCovered: true,
            waivesRequirements: true,
            teamTier: target.performanceTier,
            isDesperateOverpay: true,
            contractYears: years,
            isProveItDeal: false,
            pitchMessage: `Even though you haven't announced you're looking for a team, our board at ${target.name} is offering a massive ${fmtUsd(annualCash * years)} for ${years} Year${years > 1 ? 's' : ''} (${fmtUsd(annualCash)}/yr · ${fmtUsd(perRace)}/race) war-chest deal to convince you to carry our car!`,
            roundOffered: currentRound + 1,
          },
        ];
      } else if (midOrTopRivals.length > 0) {
        const target = midOrTopRivals[(currentRound + wins) % midOrTopRivals.length];
        const baseC = TEAM_CONTRACTS.find((c) => c.teamId === target.id) || TEAM_CONTRACTS[0];
        const isSuper = isEliteStar && championships >= 1;
        const mult = isSuper ? 1.85 : 0.85;
        const perRace = Math.round((baseC.salaryPerRace * mult) / 25000) * 25000;
        const annualCash = perRace * 10;
        const years = isSuper ? 3 : 1;
        return [
          {
            id: `unsolicited_top_${target.id}_${currentRound}`,
            teamId: target.id,
            teamName: target.name,
            offerTier: isSuper ? 'super_max' : 'regular_poach',
            offerTitle: isSuper ? `CHAMPIONSHIP SUPER-MAX (${years}-YEAR DEAL)` : `1-YEAR HEADHUNTER CONTRACT (${fmtUsd(annualCash)} FOR 1 YEAR)`,
            annualSalary: annualCash,
            salaryPerRace: perRace,
            signingBonus: baseC.signingBonus,
            buyoutCovered: true,
            waivesRequirements: true,
            teamTier: target.performanceTier,
            isDesperateOverpay: false,
            contractYears: years,
            isProveItDeal: !isSuper,
            pitchMessage: `You haven't publicly entered the driver market, but ${target.name} quietly reached out with a ${fmtUsd(annualCash * years)} for ${years} Year${years > 1 ? 's' : ''} (${fmtUsd(perRace)}/race) offer to bring your ${driverRating} OVR pace to our garage.`,
            roundOffered: currentRound + 1,
          },
        ];
      }
      return [];
    }

    // 2. Player HAS announced they are looking for a team (isLookingForTeam === true):
    const offers: IncomingTeamOffer[] = [];
    const worseTeams = rivalTeams.filter((t) => t.performanceTier >= 3);
    const midfieldTeams = rivalTeams.filter((t) => t.performanceTier === 2);
    const topTeams = rivalTeams.filter((t) => t.performanceTier === 1);

    // Case 2A: Low Driver Rating, low Win Rate, low Paddock Reputation -> 1-season low prove-it offer!
    if (isLowCaliber) {
      if (driverRating < 76.5 && wins === 0 && reputation < 18) {
        // Truly unproven -> 1 rock-bottom 1-Season Prove-It offer from a backmarker team
        const lowTeam = worseTeams[currentRound % Math.max(1, worseTeams.length)] || rivalTeams[rivalTeams.length - 1];
        if (lowTeam) {
          const perRace = 95000;
          const annualCash = perRace * 10;
          offers.push({
            id: `mkt_lowball_${lowTeam.id}_${currentRound}`,
            teamId: lowTeam.id,
            teamName: lowTeam.name,
            offerTier: 'backmarker_lowball',
            offerTitle: '1-SEASON LOW PROVE-IT OFFER (HIGH RISK: DO BAD & GET CUT)',
            annualSalary: annualCash,
            salaryPerRace: perRace,
            signingBonus: 120000,
            buyoutCovered: false,
            waivesRequirements: true,
            teamTier: lowTeam.performanceTier,
            isDesperateOverpay: false,
            contractYears: 1,
            isProveItDeal: true,
            pitchMessage: `Because your Driver Rating (${driverRating}) and reputation (${reputation}%) are still unproven, ${lowTeam.name} is offering a low ${fmtUsd(annualCash)} for 1 Season (${fmtUsd(perRace)}/race) prove-it deal. Win races to renegotiate big money—but if you do bad even for one race, you could get cut immediately!`,
            roundOffered: currentRound + 1,
          });
        }
        return offers;
      }

      // Slightly higher but still unproven stats -> 1-Season Prove-It offer + 1-Year $3M Midfield Prove-It offer if close to 78+ OVR
      const targetWorse = worseTeams[(currentRound + 1) % Math.max(1, worseTeams.length)] || rivalTeams[0];
      if (targetWorse) {
        const perRace = 135000;
        const annualCash = perRace * 10;
        offers.push({
          id: `mkt_low_${targetWorse.id}_${currentRound}`,
          teamId: targetWorse.id,
          teamName: targetWorse.name,
          offerTier: 'backmarker_lowball',
          offerTitle: '1-SEASON BUDGET PROVE-IT DEAL (1 YEAR · HIGH RISK)',
          annualSalary: annualCash,
          salaryPerRace: perRace,
          signingBonus: 200000,
          buyoutCovered: true,
          waivesRequirements: true,
          teamTier: targetWorse.performanceTier,
          isDesperateOverpay: false,
          contractYears: 1,
          isProveItDeal: true,
          pitchMessage: `With ${wins} wins, ${targetWorse.name} is tabling a 1-Season Prove-It Contract at ${fmtUsd(annualCash)} for 1 Year (${fmtUsd(perRace)}/race). Win the Drivers' Cup to renegotiate a massive raise—but do bad even in 1 race and you risk getting cut!`,
          roundOffered: currentRound + 1,
        });
      }

      if (midfieldTeams.length > 0 && driverRating >= 77) {
        const proveMid = midfieldTeams[currentRound % midfieldTeams.length];
        const perRace3M = 300000; // $3,000,000 for 1 Year!
        const annual3M = 3000000;
        offers.push({
          id: `mkt_3m_1yr_${proveMid.id}_${currentRound}`,
          teamId: proveMid.id,
          teamName: proveMid.name,
          offerTier: 'rookie_prove_it',
          offerTitle: '$3,000,000 FOR 1 YEAR PROVE-IT CONTRACT',
          annualSalary: annual3M,
          salaryPerRace: perRace3M,
          signingBonus: 350000,
          buyoutCovered: true,
          waivesRequirements: true,
          teamTier: proveMid.performanceTier,
          isDesperateOverpay: false,
          contractYears: 1,
          isProveItDeal: true,
          pitchMessage: `${proveMid.name} is willing to give you a shot on a 1-Year Prove-It Contract: $3,000,000 for 1 Season ($300,000/race). Prove yourself or win the Drivers' Cup with us to renegotiate superstar cash—but finish P14 or worse and you could be cut!`,
          roundOffered: currentRound + 1,
        });
      }
      return offers;
    }

    // Case 2B: Good or Elite Driver who announced they are looking for a team!
    // Crucial Rule: Worse teams (Tier 3 & Tier 4) have a MUCH higher chance of offering massive cash per year to lure a star driver to their team!
    if (worseTeams.length > 0) {
      const wTeam1 = worseTeams[(currentRound + wins) % worseTeams.length];
      const starBonusMultiplier = 1.0 + Math.max(0, driverRating - 80) * 0.14 + championships * 0.55 + winRate * 1.4;
      const perRace1 = Math.round((1550000 * starBonusMultiplier) / 50000) * 50000;
      const annual1 = perRace1 * 10;
      const bonus1 = Math.round((3800000 * starBonusMultiplier) / 100000) * 100000;
      const years1 = isEliteStar ? 2 : 1;

      offers.push({
        id: `mkt_warchest1_${wTeam1.id}_${currentRound}`,
        teamId: wTeam1.id,
        teamName: wTeam1.name,
        offerTier: 'underdog_warchest',
        offerTitle: `UNDERDOG MEGA-CASH OVERPAY (${years1}-YEAR CONTRACT)`,
        annualSalary: annual1,
        salaryPerRace: perRace1,
        signingBonus: bonus1,
        buyoutCovered: true,
        waivesRequirements: true,
        teamTier: wTeam1.performanceTier,
        isDesperateOverpay: true,
        contractYears: years1,
        isProveItDeal: false,
        pitchMessage: `We know our car isn't a Tier-1 frontrunner yet, so ${wTeam1.name}'s billionaire backers are offering you ${fmtUsd(annual1 * years1)} over ${years1} Year${years1 > 1 ? 's' : ''} (${fmtUsd(annual1)}/year · ${fmtUsd(perRace1)}/race) + ${fmtUsd(bonus1)} bonus to join us as #1 team leader!`,
        roundOffered: currentRound + 1,
      });

      if (worseTeams.length > 1 && (isEliteStar || driverRating >= 82)) {
        const wTeam2 = worseTeams[(currentRound + wins + 1) % worseTeams.length];
        if (wTeam2.id !== wTeam1.id) {
          const perRace2 = Math.round((1350000 * starBonusMultiplier) / 50000) * 50000;
          const annual2 = perRace2 * 10;
          const bonus2 = Math.round((3200000 * starBonusMultiplier) / 100000) * 100000;
          offers.push({
            id: `mkt_warchest2_${wTeam2.id}_${currentRound}`,
            teamId: wTeam2.id,
            teamName: wTeam2.name,
            offerTier: 'underdog_warchest',
            offerTitle: 'CHALLENGER 1-YEAR MARQUEE DEAL (BIG MONEY TO SWITCH)',
            annualSalary: annual2,
            salaryPerRace: perRace2,
            signingBonus: bonus2,
            buyoutCovered: true,
            waivesRequirements: true,
            teamTier: wTeam2.performanceTier,
            isDesperateOverpay: true,
            contractYears: 1,
            isProveItDeal: false,
            pitchMessage: `Since you announced you're looking for a team, ${wTeam2.name} is throwing ${fmtUsd(annual2)} for 1 Year (${fmtUsd(perRace2)}/race) at you so you choose our project over the frontrunners!`,
            roundOffered: currentRound + 1,
          });
        }
      }
    }

    // Midfield / Contender Team Offer (Tier 2: e.g. Mercedes, Aston Martin, Williams)
    if (midfieldTeams.length > 0) {
      const mTeam = midfieldTeams[(currentRound + podiums) % midfieldTeams.length];
      const baseC = TEAM_CONTRACTS.find((c) => c.teamId === mTeam.id) || TEAM_CONTRACTS[0];
      // Midfield teams offer solid money or a high-cash offer if you have Drivers Cups
      const midMult = isEliteStar ? 1.65 + championships * 0.35 : 0.95;
      const perRace = isEliteStar
        ? Math.round((baseC.salaryPerRace * midMult) / 25000) * 25000
        : 300000; // $3,000,000 for 1 year prove-it/contender deal!
      const annual = perRace * 10;
      const bonus = Math.round((baseC.signingBonus * (isEliteStar ? 1.4 : 0.85)) / 50000) * 50000;
      const midYears = isEliteStar ? 2 : 1;

      offers.push({
        id: `mkt_mid_${mTeam.id}_${currentRound}`,
        teamId: mTeam.id,
        teamName: mTeam.name,
        offerTier: isEliteStar ? 'super_max' : 'regular_poach',
        offerTitle: isEliteStar
          ? `CONTENDER MARQUEE OFFER (${midYears}-YEAR TERM)`
          : `${fmtUsd(annual)} FOR 1 YEAR CONTENDER CONTRACT`,
        annualSalary: annual,
        salaryPerRace: perRace,
        signingBonus: bonus,
        buyoutCovered: true,
        waivesRequirements: true,
        teamTier: mTeam.performanceTier,
        isDesperateOverpay: isEliteStar,
        contractYears: midYears,
        isProveItDeal: !isEliteStar,
        pitchMessage: `After your driver market announcement, ${mTeam.name} is offering ${fmtUsd(annual * midYears)} for ${midYears} Year${midYears > 1 ? 's' : ''} (${fmtUsd(annual)}/yr · ${fmtUsd(perRace)}/race) with all entry locks waived.`,
        roundOffered: currentRound + 1,
      });
    }

    // Top Championship Teams (Tier 1: Ferrari, Red Bull, McLaren):
    // Better teams don't automatically offer more cash unless you are truly elite (high rating + Drivers Cups/high win rate);
    // otherwise they offer a lower 1-Season "Prove-It" / prestige discount deal because everyone wants their fast car!
    if (topTeams.length > 0 && (driverRating >= 81 || wins >= 1 || championships >= 1)) {
      const tTeam = topTeams[(currentRound + wins + championships) % topTeams.length];
      const baseC = TEAM_CONTRACTS.find((c) => c.teamId === tTeam.id) || TEAM_CONTRACTS[0];
      const isSuperstarChamp = (driverRating >= 88 && wins >= 3) || championships >= 1;

      if (isSuperstarChamp) {
        const topMult = 1.9 + Math.min(1.2, championships * 0.4 + (driverRating - 86) * 0.08);
        const perRace = Math.round((baseC.salaryPerRace * topMult) / 50000) * 50000;
        const annual = perRace * 10;
        const bonus = Math.round((baseC.signingBonus * 1.75) / 100000) * 100000;
        const topYears = 3;
        offers.push({
          id: `mkt_top_super_${tTeam.id}_${currentRound}`,
          teamId: tTeam.id,
          teamName: tTeam.name,
          offerTier: 'super_max',
          offerTitle: `TOP CONSTRUCTOR SUPER-MAX (${topYears}-YEAR WORLD CHAMPION DEAL)`,
          annualSalary: annual,
          salaryPerRace: perRace,
          signingBonus: bonus,
          buyoutCovered: true,
          waivesRequirements: true,
          teamTier: tTeam.performanceTier,
          isDesperateOverpay: false,
          contractYears: topYears,
          isProveItDeal: false,
          pitchMessage: `With ${championships} Drivers Cup(s) and a ${driverRating} Rating, ${tTeam.name} is pulling out all the stops with a ${fmtUsd(annual * topYears)} (${topYears}-Year, ${fmtUsd(annual)}/yr) championship contract!`,
          roundOffered: currentRound + 1,
        });
      } else {
        // Top team offers a 1-Season "Prove-It" deal at lower cash! Once you win races or the Drivers Cup with them, you can renegotiate for massive cash!
        const discountPerRace = 300000; // $3,000,000 for 1 Year Prove-It Deal on a Top Team!
        const discountAnnual = discountPerRace * 10;
        const discountBonus = Math.round((baseC.signingBonus * 0.45) / 50000) * 50000;
        offers.push({
          id: `mkt_top_proveit_${tTeam.id}_${currentRound}`,
          teamId: tTeam.id,
          teamName: tTeam.name,
          offerTier: 'rookie_prove_it',
          offerTitle: '1-SEASON TOP TEAM PROVE-IT OFFER ($3M FOR 1 YEAR)',
          annualSalary: discountAnnual,
          salaryPerRace: discountPerRace,
          signingBonus: discountBonus,
          buyoutCovered: true,
          waivesRequirements: true,
          teamTier: tTeam.performanceTier,
          isDesperateOverpay: false,
          contractYears: 1,
          isProveItDeal: true,
          pitchMessage: `${tTeam.name} has a championship-winning car so we're offering a 1-Season Prove-It Deal: ${fmtUsd(discountAnnual)} for 1 Year (${fmtUsd(discountPerRace)}/race). Win races or the Drivers' Cup with us to renegotiate a massive raise—but finish outside the top 10 even once and you could get cut!`,
          roundOffered: currentRound + 1,
        });
      }
    }

    return offers;
  };

  const handleToggleLookingForTeam = (looking: boolean) => {
    setSeason((prev) => {
      const freshOffers = looking
        ? buildDriverMarketOffers({
            selectedTeamId: prev.selectedTeamId,
            currentRound: prev.currentRound,
            driverRating: prev.career.driverRating,
            reputation: prev.career.reputation,
            wins: prev.career.wins,
            podiums: prev.career.podiums,
            racesDriven: prev.career.racesDriven,
            championships: prev.career.championships || 0,
            isLookingForTeam: true,
            justScoredTopFinish: false,
            proveItCutCount: prev.career.proveItCutCount || 0,
            isUnsignedFreeAgent: Boolean(prev.career.isUnsignedFreeAgent),
            lastProveItCutOutcome: prev.career.lastProveItCutNotice?.outcome,
            cutFromTeamsHistory: prev.career.cutFromTeamsHistory || [],
          })
        : [];

      return {
        ...prev,
        career: {
          ...prev.career,
          isLookingForTeam: looking,
          lookingForTeamAnnouncedRound: looking ? prev.currentRound : undefined,
          incomingOffers: freshOffers,
        },
      };
    });
  };

  // Emergency Paddock Walk-On Pitch when a player was cut from a Prove-It contract and NOBODY signed them:
  // Has a real risk that teams reject the call again, or a desperate Tier-4 backmarker throws a bare-minimum $10K-$20K/race prove-it deal!
  const handleAttemptUnsignedWalkOn = (): { foundOffer: boolean; message: string } => {
    const cutCount = season.career.proveItCutCount || 1;
    const cutHistory = season.career.cutFromTeamsHistory || [];
    const lastTeamId = season.career.lastCutByTeamId || season.selectedTeamId;
    const backmarkers = TEAMS.filter((t) => t.performanceTier >= 3 && t.id !== lastTeamId);
    const freshBackmarkers = backmarkers.filter((t) => !cutHistory.includes(t.id));
    const pool = freshBackmarkers.length > 0 ? freshBackmarkers : backmarkers.length > 0 ? backmarkers : TEAMS.filter((t) => t.id !== lastTeamId);

    // 45% chance that every team still refuses to sign you!
    if (Math.random() < 0.45) {
      return {
        foundOffer: false,
        message: `❌ PADDOCK REJECTION: Your agent called every Team Principal on the grid, but after ${cutCount} Prove-It contract cut${cutCount > 1 ? 's' : ''}, nobody agreed to sign you today! Keep knocking on garage doors or pay for a Pay-Driver Seat Buy-In.`,
      };
    }

    const pickedTeam = pool[Math.floor(Math.random() * pool.length)] || TEAMS[0];
    const emergencyPerRace = cutCount >= 3 ? 8000 : cutCount === 2 ? 12000 : 20000;
    const emergencyAnnual = emergencyPerRace * 10;
    const emergencyOffer: IncomingTeamOffer = {
      id: `walkon_lifeline_${pickedTeam.id}_${Date.now()}`,
      teamId: pickedTeam.id,
      teamName: pickedTeam.name,
      offerTier: 'backmarker_lowball',
      offerTitle: `EMERGENCY WALK-ON PROVE-IT CONTRACT ($${emergencyAnnual.toLocaleString()} / 1 YR)`,
      annualSalary: emergencyAnnual,
      salaryPerRace: emergencyPerRace,
      signingBonus: 0,
      buyoutCovered: true,
      waivesRequirements: true,
      teamTier: pickedTeam.performanceTier,
      isDesperateOverpay: false,
      contractYears: 1,
      isProveItDeal: true,
      pitchMessage: `${pickedTeam.name} agreed to give you one last lifeline: $${emergencyAnnual.toLocaleString()} for 1 Year ($${emergencyPerRace.toLocaleString()}/race, $0 bonus) on a strict Prove-It contract. Do NOT finish in the bottom of the field or you will be cut again!`,
      roundOffered: season.currentRound + 1,
    };

    setSeason((prev) => ({
      ...prev,
      career: {
        ...prev.career,
        incomingOffers: [emergencyOffer],
        lastProveItCutNotice: prev.career.lastProveItCutNotice
          ? {
              ...prev.career.lastProveItCutNotice,
              outcome: 'low_offers_only',
            }
          : null,
      },
    }));

    return {
      foundOffer: true,
      message: `✅ LIFELINE OFFER FOUND: ${pickedTeam.name} reluctantly tabled an emergency $${emergencyAnnual.toLocaleString()} for 1 Year ($${emergencyPerRace.toLocaleString()}/race) Prove-It contract! Review and sign it in Incoming Offers below.`,
    };
  };

  const handleSelectTeam = (
    teamId: string,
    targetDriverId: string,
    buyoutFee: number = 0,
    signingBonus: number = 0,
    newSalary: number = 180000,
    contractYears: number = 1,
    contractTypeLabel?: string,
    isProveItDeal?: boolean
  ) => {
    setSeason((prev) => {
      // "once i create my team i earn points for the team i made and i cant switch teams unless i sell my team"
      if (prev.career.customTeam) {
        return prev;
      }
      const isSameTeamRenegotiation =
        teamId === prev.selectedTeamId && !prev.career.isUnsignedFreeAgent;
      const actualBuyout = isSameTeamRenegotiation ? 0 : buyoutFee;
      const netCashChange = signingBonus - actualBuyout;
      const resolvedYears = Math.max(1, Math.min(5, contractYears || 1));
      const resolvedLabel =
        contractTypeLabel ||
        (isProveItDeal
          ? '1-Season Prove-It Deal'
          : `${resolvedYears}-Year ${isSameTeamRenegotiation ? 'Extension' : 'Contract'}`);
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
          seasonTransfersCount: isSameTeamRenegotiation
            ? prev.career.seasonTransfersCount
            : prev.career.seasonTransfersCount + 1,
          isLookingForTeam: false,
          lookingForTeamAnnouncedRound: undefined,
          incomingOffers: (prev.career.incomingOffers || []).filter((o) => o.teamId !== teamId),
          contractYearsRemaining: resolvedYears,
          contractTotalYears: resolvedYears,
          contractTypeLabel: resolvedLabel,
          contractSignedAtCups: prev.career.championships || 0,
          contractSignedAtWins: prev.career.wins || 0,
          contractSignedAtRating: prev.career.driverRating || 76,
          isOnProveItContract: Boolean(isProveItDeal),
          isUnsignedFreeAgent: false,
          lastProveItCutNotice: null,
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
        cpuDriversLookingForTeam: (
          prev.career.cpuDriversLookingForTeam || [
            'perez',
            'sainz',
            'tsunoda',
            'hulkenberg',
            'gasly',
            'lawson',
          ]
        ).filter((id) => id !== config.teammateDriverId),
      },
    }));
  };

  const handleUpdateCustomTeam = (updated: CustomTeamConfig, costDeduction?: number) => {
    setSeason((prev) => {
      const baseOwnerSal = 1200000;
      const baselineMateSal =
        updated.teammateBaselineSalaryPerRace ??
        prev.career.customTeam?.teammateBaselineSalaryPerRace ??
        220000;
      const actualMateSal = updated.teammateSalaryPerRace ?? 220000;
      const payCutSavings = Math.max(0, baselineMateSal - actualMateSal);
      return {
        ...prev,
        career: {
          ...prev.career,
          currentSalary: baseOwnerSal + payCutSavings,
          careerEarnings: costDeduction ? Math.max(0, prev.career.careerEarnings - costDeduction) : prev.career.careerEarnings,
          customTeam: updated,
          cpuDriversLookingForTeam: (
            prev.career.cpuDriversLookingForTeam || [
              'perez',
              'sainz',
              'tsunoda',
              'hulkenberg',
              'gasly',
              'lawson',
            ]
          ).filter((id) => id !== updated.teammateDriverId),
        },
      };
    });
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
        perez: 0, herta: 0,
        [prev.selectedDriverId]: 0,
      },
      constructorPoints: {
        haas: 0, mclaren: 0, redbull: 0, ferrari: 0, mercedes: 0,
        astonmartin: 0, williams: 0, cadillac: 0, audi: 0, alpine: 0, rb: 0,
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
    }[],
    didQuitMidRace: boolean = false
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
      if (dId === 'player' || (didQuitMidRace && dId === playerDriver.id)) {
        if (!didQuitMidRace) {
          sortedField.push(playerDriver);
          accountedDrivers.add(playerDriver.id);
        }
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

    // If player quit mid-race, they AUTOMATICALLY LOSE and are placed last (P20) behind all 19 AI cars!
    if (didQuitMidRace) {
      const existingIdx = sortedField.findIndex((d) => d.id === playerDriver.id);
      if (existingIdx !== -1) {
        sortedField.splice(existingIdx, 1);
      }
      sortedField.push(playerDriver);
      accountedDrivers.add(playerDriver.id);
    } else if (!accountedDrivers.has(playerDriver.id)) {
      // If player somehow was not in finishedDriversOrder, place at finishPos
      const insertIdx = Math.max(0, Math.min(sortedField.length, finishPos - 1));
      sortedField.splice(insertIdx, 0, playerDriver);
    }

    const actualPlayerPos = didQuitMidRace
      ? Math.max(20, sortedField.length)
      : sortedField.findIndex((d) => d.id === playerDriver.id) + 1;

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
      if (season.career.customTeam && season.career.customTeam.teammateDriverId === driver.id) {
        teamId = season.career.customTeam.id;
      }
      // 1b. If a cut driver joined another F1 team on the grid via driverTeamOverrides:
      else if (season.career.customTeam?.driverTeamOverrides?.[driver.id]) {
        teamId = season.career.customTeam.driverTeamOverrides[driver.id];
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

    // Award career prize money & salary (forfeiting mid-race forfeits your race prize money & race salary!)
    const prizeMoney = didQuitMidRace ? 0 : PRIZE_MONEY[actualPlayerPos - 1] || 150000;
    const salary = didQuitMidRace ? 0 : season.career.currentSalary || 180000;
    let totalPayout = prizeMoney + salary;

    // Team Principal Comprehensive Financial Balance Sheet if player owns their constructor
    // "if u manage ur team good u make much more money also include every single expense once u own a team"
    const isOwner = Boolean(season.career.customTeam && season.selectedTeamId === season.career.customTeam.id);
    let teammatePayCutSavingsThisRace = 0;
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
      const teammateSalary = cTeam.teammateSalaryPerRace ?? 220000;
      const baselineTeammateSal =
        cTeam.teammateBaselineSalaryPerRace ??
        (DRIVERS.find((d) => d.id === cTeam.teammateDriverId)?.salaryPerRaceDemand || 220000);
      teammatePayCutSavingsThisRace = Math.max(0, baselineTeammateSal - teammateSalary);
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
    let updatedCustomTeamAfterRace: CustomTeamConfig | null = season.career.customTeam || null;

    if (isOwningCustomTeam && season.career.customTeam) {
      const cTeam = season.career.customTeam;
      const teammateId = cTeam.teammateDriverId;
      const teammateDetail = finalStandingsDetails?.find((s) => s.driver.id === teammateId);
      if (teammateDetail) {
        teammateFinishPos = teammateDetail.position;
      } else {
        const foundIdx = sortedField.findIndex((d) => d.id === teammateId);
        if (foundIdx !== -1) teammateFinishPos = foundIdx + 1;
      }

      const baseTeammateObj = DRIVERS.find((d) => d.id === teammateId);
      const teammateName = cTeam.teammateCustomName || baseTeammateObj?.name || 'Academy Rookie';
      const currentTeammateRating = cTeam.teammateCustomRating ?? baseTeammateObj?.rating ?? 78;
      const isRookie = teammateId === 'rookie_teammate' || Boolean(cTeam.isAcademyRookieTeammate);

      let nextTeammateRating = currentTeammateRating;
      let nextTeammateWins = cTeam.teammateWins || 0;
      let nextTeammatePodiums = cTeam.teammatePodiums || 0;
      let nextTeammateSalary = cTeam.teammateSalaryPerRace ?? (isRookie ? 120000 : 450000);

      if (teammateFinishPos === 1) {
        teammateBonus = 8000000;
        nextTeammateRating = Math.round((currentTeammateRating + 2.5) * 10) / 10;
        nextTeammateWins += 1;
        nextTeammatePodiums += 1;
        if (isRookie) {
          // As the Academy Rookie starts winning races, their rating goes up and they start asking for a bit more pay (which you can renegotiate down or replace with a cheaper rookie!)
          nextTeammateSalary += 35000;
        }
        teammateBonusDesc = `🏆 TEAM OWNER VICTORY BONUS: Your teammate ${teammateName} WON the Grand Prix (P1)! Received +$8,000,000 Constructor Prize & ${teammateName}'s Driver Rating rose from ${currentTeammateRating} → ${nextTeammateRating} OVR!`;
      } else if (teammateFinishPos && teammateFinishPos <= 3) {
        teammateBonus = 4000000;
        nextTeammateRating = Math.round((currentTeammateRating + 1.2) * 10) / 10;
        nextTeammatePodiums += 1;
        teammateBonusDesc = `🥈 TEAM OWNER PODIUM BONUS: Your teammate ${teammateName} finished P${teammateFinishPos}! Received +$4,000,000 Constructor Prize & ${teammateName}'s Driver Rating rose from ${currentTeammateRating} → ${nextTeammateRating} OVR!`;
      } else if (teammateFinishPos && teammateFinishPos <= 6) {
        teammateBonus = 2000000;
        nextTeammateRating = Math.round((currentTeammateRating + 0.5) * 10) / 10;
        teammateBonusDesc = `🏅 TEAM OWNER TOP-6 BONUS: Your teammate ${teammateName} finished P${teammateFinishPos}! Received +$2,000,000 Constructor Prize (+0.5 Rating → ${nextTeammateRating} OVR)!`;
      } else if (teammateFinishPos && teammateFinishPos <= 10) {
        teammateBonus = 1000000;
        teammateBonusDesc = `✨ TEAM OWNER POINTS BONUS: Your teammate ${teammateName} scored points (P${teammateFinishPos})! Received +$1,000,000 Constructor Prize!`;
      }

      updatedCustomTeamAfterRace = {
        ...cTeam,
        teammateCustomRating: nextTeammateRating,
        teammateWins: nextTeammateWins,
        teammatePodiums: nextTeammatePodiums,
        teammateSalaryPerRace: nextTeammateSalary,
      };

      totalPayout += teammateBonus;
    }

    const isWin = actualPlayerPos === 1;
    const isPodium = actualPlayerPos <= 3;

    // Driver rating progression (quitting mid-race incurs a forfeit penalty)
    let ratingGain = 0;
    let repGain = 1;
    if (didQuitMidRace) {
      ratingGain = -0.6;
      repGain = -6;
    } else if (isWin) {
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
    const newRating = Math.max(68, Math.round((season.career.driverRating + ratingGain) * 10) / 10);
    const newReputation = Math.max(5, Math.min(100, season.career.reputation + repGain));

    const winnerDriver = sortedField[0] || playerDriver;
    const podiumDrivers = [
      sortedField[0]?.id || playerDriver.id,
      sortedField[1]?.id || playerDriver.id,
      sortedField[2]?.id || playerDriver.id,
    ];

    const isSeasonEnd = season.currentRound >= CIRCUITS.length - 1;

    // Championship Grand Prizes (Awarded strictly once at Season Finale)
    let champBonus = 0;
    let champMsg = '';
    let wonDriversCup = false;
    let wonConstructorsCup = false;
    if (isSeasonEnd && !season.seasonFinished) {
      const sortedDriverEntries = Object.entries(updatedDriverPoints).sort((a, b) => b[1] - a[1]);
      wonDriversCup = Boolean(sortedDriverEntries[0] && sortedDriverEntries[0][0] === playerDriver.id);

      const sortedConstructorEntries = Object.entries(updatedConstructorPoints).sort((a, b) => b[1] - a[1]);
      wonConstructorsCup = Boolean(sortedConstructorEntries[0] && sortedConstructorEntries[0][0] === season.selectedTeamId);

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

    // Generate Incoming Team Headhunter Offers based on whether the player announced they are looking for a team & how good they are!
    const totalCareerWins = isWin ? season.career.wins + 1 : season.career.wins;
    const totalCareerPodiums = isPodium ? season.career.podiums + 1 : season.career.podiums;
    const totalRacesDriven = season.career.racesDriven + 1;
    const totalChampionships =
      isSeasonEnd && !season.seasonFinished && wonDriversCup
        ? season.career.championships + 1
        : season.career.championships;
    const totalConstructorsChampionships =
      isSeasonEnd && !season.seasonFinished && wonConstructorsCup
        ? (season.career.constructorsChampionships || 0) + 1
        : (season.career.constructorsChampionships || 0);

    // HIGH-RISK PROVE-IT CONTRACT EVALUATION:
    // "if u do bad in a prove it contract even for one game u could get cut and possibly not find a team
    // or get another really low prove it contract from a really bad team and if u do bad again u could either
    // keep getting bad contracts and keep swapping teams or nobody signs and u might not get signed by anoyone."
    const activePlayerTeamObj = TEAMS.find((t) => t.id === season.selectedTeamId) || TEAMS[0];
    const isOnProveItNow =
      !isOwningCustomTeam &&
      !season.career.isUnsignedFreeAgent &&
      season.career.isOnProveItContract !== false;
    const proveItRequiredPos =
      activePlayerTeamObj.performanceTier === 1
        ? 10
        : activePlayerTeamObj.performanceTier === 2
        ? 13
        : 15;
    const didBadOnProveIt = isOnProveItNow && actualPlayerPos > proveItRequiredPos;
    const shouldGetCutFromProveIt =
      didBadOnProveIt &&
      (actualPlayerPos >= proveItRequiredPos + 2 ||
        actualPlayerPos >= 15 ||
        Math.random() < 0.88);

    let wasCutFromProveIt = false;
    let proveItCutOutcome: 'low_offers_only' | 'nobody_signed' | undefined;
    let proveItCutMessage: string | undefined;
    let nextProveItCutCount =
      isWin || isPodium ? 0 : season.career.proveItCutCount || 0;
    let nextCutHistory = [...(season.career.cutFromTeamsHistory || [])];
    let finalRatingAfterCut = newRating;
    let finalRepAfterCut = newReputation;

    if (shouldGetCutFromProveIt) {
      wasCutFromProveIt = true;
      nextProveItCutCount = (season.career.proveItCutCount || 0) + 1;
      if (!nextCutHistory.includes(season.selectedTeamId)) {
        nextCutHistory.push(season.selectedTeamId);
      }
      finalRatingAfterCut = Math.max(68, Math.round((season.career.driverRating - 0.8) * 10) / 10);
      finalRepAfterCut = Math.max(5, season.career.reputation - 8);

      const nobodySignsProb =
        nextProveItCutCount >= 3
          ? 0.75
          : nextProveItCutCount === 2
          ? actualPlayerPos >= 18
            ? 0.7
            : 0.55
          : actualPlayerPos >= 18
          ? 0.5
          : 0.32;

      proveItCutOutcome = Math.random() < nobodySignsProb ? 'nobody_signed' : 'low_offers_only';
    }

    // Update CPU drivers who publicly announce they are looking for a team
    const eligibleCpuDrivers = DRIVERS.filter(
      (d) =>
        d.id !== 'rookie_teammate' &&
        d.id !== season.selectedDriverId &&
        d.id !== updatedCustomTeamAfterRace?.teammateDriverId
    );
    const nextCpuDriversLooking: string[] = [];
    for (let i = 0; i < 6 && i < eligibleCpuDrivers.length; i++) {
      const pickIdx = (season.currentRound * 3 + (season.career.seasonNumber || 1) * 5 + i * 2) % eligibleCpuDrivers.length;
      const picked = eligibleCpuDrivers[pickIdx];
      if (picked && !nextCpuDriversLooking.includes(picked.id)) {
        nextCpuDriversLooking.push(picked.id);
      }
    }

    const updatedIncomingOffers = buildDriverMarketOffers({
      selectedTeamId: season.selectedTeamId,
      currentRound: season.currentRound,
      driverRating: finalRatingAfterCut,
      reputation: finalRepAfterCut,
      wins: totalCareerWins,
      podiums: totalCareerPodiums,
      racesDriven: totalRacesDriven,
      championships: totalChampionships,
      isLookingForTeam: wasCutFromProveIt ? true : Boolean(season.career.isLookingForTeam),
      justScoredTopFinish: isWin || isPodium || actualPlayerPos <= 5,
      proveItCutCount: nextProveItCutCount,
      isUnsignedFreeAgent: wasCutFromProveIt || Boolean(season.career.isUnsignedFreeAgent),
      lastProveItCutOutcome: proveItCutOutcome,
      cutFromTeamsHistory: nextCutHistory,
    });

    if (wasCutFromProveIt) {
      if (proveItCutOutcome === 'nobody_signed' || updatedIncomingOffers.length === 0) {
        proveItCutOutcome = 'nobody_signed';
        proveItCutMessage = `🚨 PROVE-IT CONTRACT TERMINATED & UNWANTED: You finished P${actualPlayerPos} (needed P${proveItRequiredPos} or better), so ${activePlayerTeamObj.name} cut you immediately after this race! Worse yet, NO OTHER F1 TEAM signed you (${nextProveItCutCount}x Prove-It cuts). You are now an UNSIGNED FREE AGENT with 0 offers!`;
      } else {
        const offerTeamsList = updatedIncomingOffers.map((o) => `${o.teamName} ($${(o.annualSalary / 1000).toFixed(0)}K/yr)`).join(' & ');
        proveItCutMessage = `⚠️ CUT FROM PROVE-IT CONTRACT: You finished P${actualPlayerPos} (needed P${proveItRequiredPos} or better), so ${activePlayerTeamObj.name} fired you immediately! Almost the entire grid passed on you—only ${offerTeamsList} offered a rock-bottom Prove-It lifeline contract. If you do bad again, you'll keep swapping bad teams or nobody will sign you!`;
      }
      incidentsList.unshift(proveItCutMessage);
    }

    if (didQuitMidRace) {
      incidentsList.unshift(
        `🏳️ MID-RACE FORFEIT / DNF LOSS: ${playerDisplayName} quit the Grand Prix mid-race and was officially classified P${actualPlayerPos} (Last Place, 0 PTS, $0 Driver Payout).`
      );
    }

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
      teammatePayCutSavings: teammatePayCutSavingsThisRace,
      fastestLapDriverId: sessionFastestDriver.id,
      fastestLapTime: sessionFastestLapSec,
      driverPointsAwarded: pointsAwarded,
      constructorPointsSnapshot: { ...updatedConstructorPoints },
      prizeMoneyAwarded: totalPayout,
      lapsCompleted: raceLaps,
      wasCutFromProveIt,
      proveItCutMessage,
      proveItCutOutcome,
      didQuitMidRace,
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
        driverRating: finalRatingAfterCut,
        reputation: finalRepAfterCut,
        careerEarnings: prev.career.careerEarnings + totalPayout,
        currentSalary: wasCutFromProveIt ? 0 : prev.career.currentSalary,
        racesDriven: prev.career.racesDriven + 1,
        wins: totalCareerWins,
        podiums: totalCareerPodiums,
        championships: totalChampionships,
        constructorsChampionships: totalConstructorsChampionships,
        customTeam: updatedCustomTeamAfterRace,
        newsCompany: updatedNewsCompany,
        offSeasonActionsUsed: isSeasonEnd ? [] : prev.career.offSeasonActionsUsed,
        incomingOffers: updatedIncomingOffers,
        cpuDriversLookingForTeam: nextCpuDriversLooking,
        isLookingForTeam: wasCutFromProveIt ? true : prev.career.isLookingForTeam,
        isUnsignedFreeAgent: wasCutFromProveIt ? true : prev.career.isUnsignedFreeAgent,
        isOnProveItContract: wasCutFromProveIt ? false : prev.career.isOnProveItContract,
        contractYearsRemaining: wasCutFromProveIt ? 0 : prev.career.contractYearsRemaining,
        contractTypeLabel: wasCutFromProveIt
          ? 'UNSIGNED FREE AGENT (CUT FROM PROVE-IT DEAL)'
          : prev.career.contractTypeLabel,
        proveItCutCount: nextProveItCutCount,
        lastCutByTeamId: wasCutFromProveIt ? prev.selectedTeamId : prev.career.lastCutByTeamId,
        lastCutByTeamName: wasCutFromProveIt ? activePlayerTeamObj.name : prev.career.lastCutByTeamName,
        cutFromTeamsHistory: nextCutHistory,
        lastProveItCutNotice: wasCutFromProveIt && proveItCutOutcome && proveItCutMessage
          ? {
              teamId: prev.selectedTeamId,
              teamName: activePlayerTeamObj.name,
              round: prev.currentRound + 1,
              finishPosition: actualPlayerPos,
              requiredPosition: proveItRequiredPos,
              cutCount: nextProveItCutCount,
              outcome: proveItCutOutcome,
              message: proveItCutMessage,
              timestamp: Date.now(),
            }
          : prev.career.lastProveItCutNotice,
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

  const handleRecordLaunchReaction = (data: {
    reactionTimeMs: number | null;
    falseStart: boolean;
    jumpedEarlyByMs?: number | null;
    circuitName?: string;
  }) => {
    const activeCircuit =
      isMultiplayerRace && multiplayerRoom
        ? CIRCUITS.find((c) => c.id === multiplayerRoom.circuitId) || CIRCUITS[0]
        : isPracticeMode && practiceCircuit
        ? practiceCircuit
        : currentCircuit;

    setSeason((prev) => {
      const validMs = !data.falseStart && data.reactionTimeMs != null && data.reactionTimeMs > 0
        ? Math.round(data.reactionTimeMs)
        : null;
      const prevBest = prev.career.bestReactionTimeMs;
      const nextBest =
        validMs != null
          ? prevBest != null
            ? Math.min(prevBest, validMs)
            : validMs
          : prevBest;

      const recordEntry = {
        id: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        circuitId: data.circuitName ? 'start_practice' : activeCircuit.id,
        circuitName: data.circuitName || activeCircuit.name,
        reactionTimeMs: validMs ?? 0,
        falseStart: data.falseStart,
        jumpedEarlyByMs: data.jumpedEarlyByMs ?? undefined,
        round: prev.currentRound + 1,
        seasonNumber: prev.career.seasonNumber || 1,
        timestamp: Date.now(),
      };

      const existingRecords = prev.career.reactionTimeRecords || [];
      return {
        ...prev,
        career: {
          ...prev.career,
          bestReactionTimeMs: nextBest,
          falseStartsCount: data.falseStart
            ? (prev.career.falseStartsCount || 0) + 1
            : prev.career.falseStartsCount || 0,
          reactionTimeRecords: [recordEntry, ...existingRecords].slice(0, 25),
        },
      };
    });
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
          onRecordLaunchReaction={handleRecordLaunchReaction}
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
          onToggleLookingForTeam={handleToggleLookingForTeam}
          onRecordLaunchReaction={handleRecordLaunchReaction}
          onOpenCareerSlots={() => setShowCareerSlotsModal(true)}
          careerSlotsCount={careerSlots.length}
          activeCareerSlotName={
            careerSlots.find((s) => s.id === activeCareerSlotId)?.slotName || 'Career #1'
          }
          onAttemptUnsignedWalkOn={handleAttemptUnsignedWalkOn}
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
          {/* Celebratory Championship Confetti when winning Drivers or Constructors Cup */}
          {championNotice && (
            <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
              {Array.from({ length: 75 }).map((_, i) => {
                const colors = ['#fbbf24', '#ef4444', '#10b981', '#38bdf8', '#a855f7', '#ffffff', '#f97316'];
                const leftPct = (i * 13.7) % 100;
                const delaySec = (i % 15) * 0.18;
                const durationSec = 2.6 + (i % 7) * 0.45;
                const widthPx = 7 + (i % 5) * 2;
                const heightPx = 12 + (i % 4) * 3;
                return (
                  <div
                    key={i}
                    className="absolute -top-6 rounded-sm opacity-95 animate-bounce"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPx}px`,
                      height: `${heightPx}px`,
                      backgroundColor: colors[i % colors.length],
                      transform: `rotate(${(i * 47) % 360}deg)`,
                      animation: `fallConfetti ${durationSec}s linear ${delaySec}s infinite`,
                    }}
                  />
                );
              })}
              <style>{`
                @keyframes fallConfetti {
                  0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
                  80% { opacity: 0.95; }
                  100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
                }
              `}</style>
            </div>
          )}
          <div className="bg-neutral-900 border border-neutral-700 max-w-lg w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-5 text-center relative z-10">
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
              {lastRaceResult.didQuitMidRace && (
                <div className="mt-2.5 p-3 bg-red-950/90 border-2 border-red-500 text-red-200 rounded-xl text-xs text-left leading-relaxed shadow-lg">
                  <span className="font-black uppercase tracking-wider text-red-400 block mb-0.5">
                    🏳️ YOU QUIT MID-RACE — AUTOMATIC LOSS (P{lastRaceResult.playerFinishedPosition} DNF)
                  </span>
                  Quitting a Grand Prix mid-race forfeits the session: you were classified Last Place (P{lastRaceResult.playerFinishedPosition}), scored 0 points, and forfeited your driver race payout.
                </div>
              )}
              {lastRaceResult.wasCutFromProveIt && lastRaceResult.proveItCutMessage && (
                <div className="mt-3 p-3.5 bg-red-950/90 border-2 border-red-500 text-red-200 rounded-xl text-xs text-left leading-relaxed shadow-xl">
                  <span className="font-black uppercase tracking-wider text-red-400 block mb-1">
                    {lastRaceResult.proveItCutOutcome === 'nobody_signed'
                      ? '🚨 CUT FROM PROVE-IT CONTRACT — NOBODY SIGNED YOU!'
                      : '⚠️ CUT FROM PROVE-IT CONTRACT — FORCED INTO BACKMARKER MARKET!'}
                  </span>
                  {lastRaceResult.proveItCutMessage}
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
                    lastRaceResult.didQuitMidRace
                      ? 'text-red-500'
                      : lastRaceResult.playerFinishedPosition === 1
                      ? 'text-amber-400'
                      : lastRaceResult.playerFinishedPosition <= 3
                      ? 'text-cyan-400'
                      : 'text-white'
                  }`}
                >
                  P{lastRaceResult.playerFinishedPosition}
                  {lastRaceResult.didQuitMidRace ? ' (QUIT / DNF)' : ''}
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
                  {lastRaceResult.teammatePayCutSavings && lastRaceResult.teammatePayCutSavings > 0 ? (
                    <span className="text-[11px] font-mono text-emerald-300 block mt-0.5">
                      💰 Includes +{formatMoney(lastRaceResult.teammatePayCutSavings)}/GP earned from Teammate Pay Cut!
                    </span>
                  ) : null}
                </div>
                <div className="text-right">
                  <span className="text-xs text-neutral-400">Driver Rating</span>
                  <p className="text-lg font-bold text-purple-400">{season.career.driverRating}</p>
                </div>
              </div>
              {season.career.reactionTimeRecords && season.career.reactionTimeRecords.length > 0 && (
                <div className="col-span-2 pt-2 border-t border-neutral-800 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-neutral-400 block">Start Reaction Time</span>
                    {season.career.reactionTimeRecords[0].falseStart ? (
                      <span className="font-mono font-bold text-red-400">
                        ⚠️ FALSE START (Car Stalled — Jumped by {((season.career.reactionTimeRecords[0].jumpedEarlyByMs || 0) / 1000).toFixed(2)}s)
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-amber-400">
                        ⚡ {(season.career.reactionTimeRecords[0].reactionTimeMs / 1000).toFixed(3)}s ({season.career.reactionTimeRecords[0].reactionTimeMs} ms)
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-400 block">Personal Best Reaction</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {season.career.bestReactionTimeMs
                        ? `${(season.career.bestReactionTimeMs / 1000).toFixed(3)}s (${season.career.bestReactionTimeMs} ms)`
                        : '—'}
                    </span>
                  </div>
                </div>
              )}
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
        onOpenCareerSlots={() => {
          setShowCloudModal(false);
          setShowCareerSlotsModal(true);
        }}
        careerSlotsCount={careerSlots.length}
      />

      {/* Multi-Career Save Slots Manager Modal (Multiple careers under one account without quitting) */}
      <CareerSlotsModal
        isOpen={showCareerSlotsModal}
        onClose={() => setShowCareerSlotsModal(false)}
        slots={careerSlots}
        activeSlotId={activeCareerSlotId}
        onSwitchSlot={handleSwitchCareerSlot}
        onCreateNewSlot={handleCreateNewCareerSlot}
        onRenameSlot={handleRenameCareerSlot}
        onDeleteSlot={handleDeleteCareerSlot}
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

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setShowQualifyingModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-all cursor-pointer"
              >
                Return to Paddock
              </button>

              <button
                onClick={() => {
                  setShowQualifyingModal(false);
                  handleStartQualifying(qualifyingGhostDelay3s);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider border border-purple-400/50 transition-all cursor-pointer"
              >
                🔄 Re-Qualify
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
