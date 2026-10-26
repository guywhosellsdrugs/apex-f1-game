import React, { useState, useMemo } from 'react';
import { SeasonState, SeasonHistoryEntry, RaceResult } from '../types/racing';
import { CIRCUITS, TEAMS, DRIVERS } from '../constants/f1Data';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import {
  BarChart3,
  Filter,
  Play,
  History,
  Trophy,
  Calendar,
} from 'lucide-react';

interface PerformanceAnalyticsProps {
  season: SeasonState;
  onStartRaceClick?: () => void;
}

interface ConstructorMeta {
  id: string;
  name: string;
  shortName: string;
  color: string;
  engine: string;
  isPlayerTeam: boolean;
  performanceScore: number;
}

// Official Historical FIA Season Archives so players can immediately inspect previous years' analytics
const HISTORICAL_FIA_ARCHIVES: Record<
  'archive_2025' | 'archive_2024',
  {
    id: string;
    year: number;
    label: string;
    subtitle: string;
    driversChampion: string;
    constructorsChampion: string;
    roundPointsByTeam: Array<Record<string, number>>;
  }
> = {
  archive_2025: {
    id: 'archive_2025',
    year: 2025,
    label: '2025 FIA World Championship (Previous Year)',
    subtitle: 'Full 10-Round Verified Historical Telemetry — McLaren & Norris Title Campaign',
    driversChampion: 'Lando Norris (McLaren)',
    constructorsChampion: 'McLaren Formula 1 Team',
    roundPointsByTeam: [
      { mclaren: 37, redbull: 26, ferrari: 22, mercedes: 10, astonmartin: 4, williams: 2, haas: 0, alpine: 0, rb: 0, audi: 0 },
      { mclaren: 33, redbull: 30, ferrari: 18, mercedes: 14, astonmartin: 4, williams: 0, haas: 2, alpine: 0, rb: 0, audi: 0 },
      { mclaren: 27, ferrari: 35, redbull: 20, mercedes: 12, williams: 4, haas: 2, astonmartin: 1, alpine: 0, rb: 0, audi: 0 },
      { mclaren: 40, redbull: 22, ferrari: 18, mercedes: 15, astonmartin: 4, rb: 2, haas: 0, williams: 0, alpine: 0, audi: 0 },
      { ferrari: 38, mclaren: 28, redbull: 16, mercedes: 12, williams: 4, alpine: 2, haas: 1, astonmartin: 0, rb: 0, audi: 0 },
      { mclaren: 35, mercedes: 27, redbull: 18, ferrari: 14, astonmartin: 4, haas: 2, williams: 1, alpine: 0, rb: 0, audi: 0 },
      { redbull: 37, mclaren: 26, ferrari: 20, mercedes: 12, williams: 4, rb: 2, haas: 0, astonmartin: 0, alpine: 0, audi: 0 },
      { mclaren: 36, ferrari: 28, mercedes: 18, redbull: 12, haas: 4, williams: 2, alpine: 1, astonmartin: 0, rb: 0, audi: 0 },
      { mclaren: 33, redbull: 25, ferrari: 22, mercedes: 14, alpine: 4, williams: 2, rb: 1, haas: 0, astonmartin: 0, audi: 0 },
      { mclaren: 38, ferrari: 26, redbull: 20, mercedes: 11, astonmartin: 4, haas: 2, williams: 0, alpine: 0, rb: 0, audi: 0 },
    ],
  },
  archive_2024: {
    id: 'archive_2024',
    year: 2024,
    label: '2024 FIA World Championship Archive',
    subtitle: 'Full 10-Round Verified Historical Telemetry — Four-Way Constructor Convergence',
    driversChampion: 'Max Verstappen (Red Bull Racing)',
    constructorsChampion: 'McLaren Formula 1 Team',
    roundPointsByTeam: [
      { redbull: 43, ferrari: 27, mercedes: 16, mclaren: 12, astonmartin: 3, haas: 0, williams: 0, alpine: 0, rb: 0, audi: 0 },
      { redbull: 40, ferrari: 25, mclaren: 20, mercedes: 10, astonmartin: 4, haas: 2, williams: 0, alpine: 0, rb: 0, audi: 0 },
      { ferrari: 43, mclaren: 27, redbull: 15, mercedes: 10, astonmartin: 4, rb: 2, haas: 0, williams: 0, alpine: 0, audi: 0 },
      { mclaren: 35, redbull: 26, ferrari: 22, mercedes: 12, rb: 4, haas: 2, astonmartin: 0, williams: 0, alpine: 0, audi: 0 },
      { ferrari: 37, mclaren: 30, redbull: 16, mercedes: 12, alpine: 4, haas: 2, williams: 0, astonmartin: 0, rb: 0, audi: 0 },
      { mercedes: 37, mclaren: 28, redbull: 18, ferrari: 12, haas: 4, astonmartin: 2, williams: 0, alpine: 0, rb: 0, audi: 0 },
      { mclaren: 38, mercedes: 24, ferrari: 20, redbull: 14, astonmartin: 3, williams: 2, haas: 0, alpine: 0, rb: 0, audi: 0 },
      { mclaren: 41, ferrari: 26, redbull: 18, mercedes: 10, williams: 4, haas: 2, alpine: 0, astonmartin: 0, rb: 0, audi: 0 },
      { redbull: 33, alpine: 28, mclaren: 20, ferrari: 12, mercedes: 6, rb: 2, haas: 0, williams: 0, astonmartin: 0, audi: 0 },
      { mclaren: 35, ferrari: 33, mercedes: 18, redbull: 10, haas: 3, alpine: 2, williams: 0, astonmartin: 0, rb: 0, audi: 0 },
    ],
  },
};

export const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({
  season,
  onStartRaceClick,
}) => {
  const currentSeasonNumber = season.career.seasonNumber || 1;
  const currentYear = 2026 + currentSeasonNumber - 1;
  const careerHistory: SeasonHistoryEntry[] = season.career.seasonHistory || [];

  // Season Selector State: 'current' | 'archive_2025' | 'archive_2024' | 'career_<num>' | 'multi_year'
  const [selectedSeasonKey, setSelectedSeasonKey] = useState<string>('current');

  const isCurrentSeasonSelected = selectedSeasonKey === 'current';
  const isMultiYearView = selectedSeasonKey === 'multi_year';

  const selectedCareerHistoryEntry = useMemo(() => {
    if (!selectedSeasonKey.startsWith('career_')) return null;
    const sNum = Number(selectedSeasonKey.replace('career_', ''));
    return careerHistory.find((h) => h.seasonNumber === sNum) || null;
  }, [selectedSeasonKey, careerHistory]);

  const selectedArchive = useMemo(() => {
    if (selectedSeasonKey === 'archive_2025') return HISTORICAL_FIA_ARCHIVES.archive_2025;
    if (selectedSeasonKey === 'archive_2024') return HISTORICAL_FIA_ARCHIVES.archive_2024;
    return null;
  }, [selectedSeasonKey]);

  const hasCompletedRounds = isCurrentSeasonSelected
    ? (season.completedRounds?.length || 0) > 0
    : true;

  const [dataMode, setDataMode] = useState<'actual' | 'projected'>(
    (season.completedRounds?.length || 0) > 0 ? 'actual' : 'projected'
  );
  const [chartView, setChartView] = useState<'cumulative' | 'per_round' | 'comparison'>('cumulative');
  const [teamFilterPreset, setTeamFilterPreset] = useState<'top5' | 'all' | 'focus'>('top5');
  const [customSelectedTeams, setCustomSelectedTeams] = useState<Set<string>>(new Set());

  // Build full list of constructors (10 official + 11th custom team if active)
  const constructorsList: ConstructorMeta[] = useMemo(() => {
    const activeTeamIdForView = selectedCareerHistoryEntry?.teamId || season.selectedTeamId;

    const list: ConstructorMeta[] = TEAMS.map((t) => {
      const perf = t.carProfile
        ? (t.carProfile.topSpeedRating +
            t.carProfile.handlingRating +
            t.carProfile.aeroDownforce +
            t.carProfile.acceleration) /
          4
        : 100 - t.performanceTier * 5;
      return {
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        color: t.primaryColor,
        engine: t.engine,
        isPlayerTeam: activeTeamIdForView === t.id,
        performanceScore: perf,
      };
    });

    if (season.career.customTeam && !selectedArchive) {
      const ct = season.career.customTeam;
      const customPerf =
        (ct.enginePower || 86) +
        (ct.handlingBonus || 5) * 0.4 +
        (ct.brakesBonus || 5) * 0.3;
      list.push({
        id: ct.id,
        name: ct.name,
        shortName: ct.shortName,
        color: ct.primaryColor || '#10b981',
        engine: ct.engine,
        isPlayerTeam: activeTeamIdForView === ct.id,
        performanceScore: customPerf,
      });
    }

    return list;
  }, [season.career.customTeam, season.selectedTeamId, selectedCareerHistoryEntry, selectedArchive]);

  // Helper to resolve which constructor a driver scored points for in a completed round
  const resolveDriverTeamId = (driverId: string, overrideTeamId?: string): string => {
    const playerDriverId = season.selectedDriverId;
    const playerTeamId = overrideTeamId || season.selectedTeamId;
    if (driverId === playerDriverId) {
      return playerTeamId;
    }
    if (
      season.career.customTeam &&
      playerTeamId === season.career.customTeam.id &&
      season.career.customTeam.teammateDriverId === driverId
    ) {
      return season.career.customTeam.id;
    }
    const officialTeam = TEAMS.find((t) => t.id === playerTeamId);
    if (officialTeam && officialTeam.drivers.includes(driverId)) {
      return playerTeamId;
    }
    const d = DRIVERS.find((drv) => drv.id === driverId);
    return d?.teamId || 'haas';
  };

  // Reconstruct round-by-round points (both per-round and cumulative) for the selected season
  const { cumulativeSeries, perRoundSeries, constructorSummaries, activeRoundsCount } = useMemo(() => {
    const runningTotals: Record<string, number> = {};
    constructorsList.forEach((c) => {
      runningTotals[c.id] = 0;
    });

    const cumRows: Array<Record<string, any>> = [
      {
        roundLabel: 'Pre-Season',
        shortCircuit: 'R0',
        circuitName: 'Season Start',
        isProjected: false,
        ...runningTotals,
      },
    ];

    const roundRows: Array<Record<string, any>> = [];

    // CASE A: Official Historical FIA Archive (2024 or 2025)
    if (selectedArchive) {
      selectedArchive.roundPointsByTeam.forEach((roundPtsMap, idx) => {
        const roundPts: Record<string, number> = {};
        constructorsList.forEach((c) => {
          const scored = roundPtsMap[c.id] || 0;
          roundPts[c.id] = scored;
          runningTotals[c.id] = (runningTotals[c.id] || 0) + scored;
        });

        const circ = CIRCUITS[idx] || CIRCUITS[0];
        cumRows.push({
          roundLabel: `R${idx + 1} ${circ.countryCode}`,
          shortCircuit: `R${idx + 1}`,
          circuitName: `${circ.name} (${selectedArchive.year})`,
          isProjected: false,
          ...runningTotals,
        });
        roundRows.push({
          roundLabel: `R${idx + 1} ${circ.countryCode}`,
          shortCircuit: `R${idx + 1}`,
          circuitName: `${circ.name} (${selectedArchive.year})`,
          isProjected: false,
          ...roundPts,
        });
      });

      const totalPointsPool =
        constructorsList.reduce((acc, c) => acc + (runningTotals[c.id] || 0), 0) || 1;
      const summaries = [...constructorsList]
        .map((c) => {
          const pts = runningTotals[c.id] || 0;
          return {
            ...c,
            actualPoints: pts,
            displayPoints: pts,
            avgPerRound: Number((pts / 10).toFixed(1)),
            sharePct: Number(((pts / totalPointsPool) * 100).toFixed(1)),
          };
        })
        .sort((a, b) => b.displayPoints - a.displayPoints);

      const leaderPts = summaries[0]?.displayPoints || 0;
      return {
        cumulativeSeries: cumRows,
        perRoundSeries: roundRows,
        activeRoundsCount: 10,
        constructorSummaries: summaries.map((s, idx) => ({
          ...s,
          rank: idx + 1,
          gapToLeader: leaderPts - s.displayPoints,
          projectedPrizeMoney: Math.max(12000000, 140000000 - idx * 11500000),
        })),
      };
    }

    // CASE B: Archived Completed Career Season from season.career.seasonHistory
    if (selectedCareerHistoryEntry) {
      const archivedRounds: RaceResult[] = selectedCareerHistoryEntry.completedRoundsSnapshot || [];
      if (archivedRounds.length > 0) {
        archivedRounds.forEach((res, idx) => {
          const roundPts: Record<string, number> = {};
          constructorsList.forEach((c) => {
            roundPts[c.id] = 0;
          });

          if (res.constructorPointsSnapshot) {
            constructorsList.forEach((c) => {
              const snapVal = res.constructorPointsSnapshot?.[c.id] ?? runningTotals[c.id];
              roundPts[c.id] = Math.max(0, snapVal - runningTotals[c.id]);
              runningTotals[c.id] = snapVal;
            });
          } else {
            Object.entries(res.driverPointsAwarded || {}).forEach(([dId, pts]) => {
              const tId = resolveDriverTeamId(dId, selectedCareerHistoryEntry.teamId);
              if (runningTotals[tId] !== undefined) {
                roundPts[tId] = (roundPts[tId] || 0) + pts;
                runningTotals[tId] += pts;
              }
            });
          }

          const circ = CIRCUITS[res.round] || CIRCUITS[idx] || CIRCUITS[0];
          cumRows.push({
            roundLabel: `R${idx + 1} ${circ.countryCode}`,
            shortCircuit: `R${idx + 1}`,
            circuitName: res.circuitName || circ.name,
            isProjected: false,
            ...runningTotals,
          });
          roundRows.push({
            roundLabel: `R${idx + 1} ${circ.countryCode}`,
            shortCircuit: `R${idx + 1}`,
            circuitName: res.circuitName || circ.name,
            isProjected: false,
            ...roundPts,
          });
        });
      } else {
        // Fallback deterministic reconstruction if legacy history entry didn't have round snapshots
        const finalSnap = selectedCareerHistoryEntry.constructorPointsSnapshot || {};
        for (let r = 0; r < CIRCUITS.length; r++) {
          const circ = CIRCUITS[r];
          const roundPts: Record<string, number> = {};
          constructorsList.forEach((c) => {
            const targetTotal =
              finalSnap[c.id] ??
              (c.name === selectedCareerHistoryEntry.teamName
                ? selectedCareerHistoryEntry.constructorPoints
                : Math.round(c.performanceScore * 2.4));
            const stepPts = Math.round(targetTotal / 10);
            roundPts[c.id] = stepPts;
            runningTotals[c.id] =
              r === CIRCUITS.length - 1 ? targetTotal : runningTotals[c.id] + stepPts;
          });
          cumRows.push({
            roundLabel: `R${r + 1} ${circ.countryCode}`,
            shortCircuit: `R${r + 1}`,
            circuitName: circ.name,
            isProjected: false,
            ...runningTotals,
          });
          roundRows.push({
            roundLabel: `R${r + 1} ${circ.countryCode}`,
            shortCircuit: `R${r + 1}`,
            circuitName: circ.name,
            isProjected: false,
            ...roundPts,
          });
        }
      }

      const totalPointsPool =
        constructorsList.reduce((acc, c) => acc + (runningTotals[c.id] || 0), 0) || 1;
      const summaries = [...constructorsList]
        .map((c) => {
          const pts =
            selectedCareerHistoryEntry.constructorPointsSnapshot?.[c.id] ??
            runningTotals[c.id] ??
            0;
          return {
            ...c,
            actualPoints: pts,
            displayPoints: pts,
            avgPerRound: Number((pts / 10).toFixed(1)),
            sharePct: Number(((pts / totalPointsPool) * 100).toFixed(1)),
          };
        })
        .sort((a, b) => b.displayPoints - a.displayPoints);

      const leaderPts = summaries[0]?.displayPoints || 0;
      return {
        cumulativeSeries: cumRows,
        perRoundSeries: roundRows,
        activeRoundsCount: 10,
        constructorSummaries: summaries.map((s, idx) => ({
          ...s,
          rank: idx + 1,
          gapToLeader: leaderPts - s.displayPoints,
          projectedPrizeMoney: Math.max(12000000, 140000000 - idx * 11500000),
        })),
      };
    }

    // CASE C: Current Active Season
    const completed = season.completedRounds || [];
    completed.forEach((res, idx) => {
      const roundPts: Record<string, number> = {};
      constructorsList.forEach((c) => {
        roundPts[c.id] = 0;
      });

      if (res.constructorPointsSnapshot) {
        constructorsList.forEach((c) => {
          const snapVal = res.constructorPointsSnapshot?.[c.id] ?? runningTotals[c.id];
          roundPts[c.id] = Math.max(0, snapVal - runningTotals[c.id]);
          runningTotals[c.id] = snapVal;
        });
      } else {
        Object.entries(res.driverPointsAwarded || {}).forEach(([dId, pts]) => {
          const tId = resolveDriverTeamId(dId);
          if (runningTotals[tId] !== undefined) {
            roundPts[tId] = (roundPts[tId] || 0) + pts;
            runningTotals[tId] += pts;
          }
        });
      }

      const circ = CIRCUITS[res.round] || CIRCUITS[idx] || CIRCUITS[0];
      cumRows.push({
        roundLabel: `R${idx + 1} ${circ.countryCode}`,
        shortCircuit: `R${idx + 1}`,
        circuitName: res.circuitName || circ.name,
        isProjected: false,
        ...runningTotals,
      });

      roundRows.push({
        roundLabel: `R${idx + 1} ${circ.countryCode}`,
        shortCircuit: `R${idx + 1}`,
        circuitName: res.circuitName || circ.name,
        isProjected: false,
        ...roundPts,
      });
    });

    if (completed.length > 0) {
      constructorsList.forEach((c) => {
        const actualTotal = season.constructorPoints[c.id] || 0;
        runningTotals[c.id] = actualTotal;
        cumRows[cumRows.length - 1][c.id] = actualTotal;
      });
    }

    const showProjected = dataMode === 'projected';
    if (showProjected && completed.length < CIRCUITS.length) {
      const fiaTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
      for (let r = completed.length; r < CIRCUITS.length; r++) {
        const circ = CIRCUITS[r];
        const rankedForRound = [...constructorsList]
          .map((c, cIdx) => {
            const wave = Math.sin((r + 1) * 1.7 + cIdx * 1.1) * 4.2;
            const playerBoost = c.isPlayerTeam ? (season.career.driverRating - 72) * 0.45 : 0;
            return {
              id: c.id,
              score: c.performanceScore + wave + playerBoost,
            };
          })
          .sort((a, b) => b.score - a.score);

        const roundPts: Record<string, number> = {};
        constructorsList.forEach((c) => {
          roundPts[c.id] = 0;
        });

        const carSlots: string[] = [];
        rankedForRound.forEach((entry) => {
          carSlots.push(entry.id);
        });
        rankedForRound.slice(0, 6).forEach((entry) => {
          carSlots.push(entry.id);
        });

        for (let pos = 0; pos < 10; pos++) {
          const teamId = carSlots[pos];
          if (teamId) {
            roundPts[teamId] = (roundPts[teamId] || 0) + fiaTable[pos];
          }
        }

        constructorsList.forEach((c) => {
          runningTotals[c.id] = (runningTotals[c.id] || 0) + (roundPts[c.id] || 0);
        });

        cumRows.push({
          roundLabel: `R${r + 1} ${circ.countryCode}*`,
          shortCircuit: `R${r + 1}*`,
          circuitName: `${circ.name} (Projected)`,
          isProjected: true,
          ...runningTotals,
        });

        roundRows.push({
          roundLabel: `R${r + 1} ${circ.countryCode}*`,
          shortCircuit: `R${r + 1}*`,
          circuitName: `${circ.name} (Projected)`,
          isProjected: true,
          ...roundPts,
        });
      }
    }

    const totalPointsPool =
      constructorsList.reduce((acc, c) => acc + (runningTotals[c.id] || 0), 0) || 1;
    const roundsCounted = showProjected ? CIRCUITS.length : Math.max(1, completed.length);

    const summaries = [...constructorsList]
      .map((c) => {
        const currentActualPts = season.constructorPoints[c.id] || 0;
        const displayPts = showProjected ? runningTotals[c.id] || 0 : currentActualPts;
        const avgPerRound = displayPts / roundsCounted;
        const sharePct = (displayPts / totalPointsPool) * 100;
        return {
          ...c,
          actualPoints: currentActualPts,
          displayPoints: displayPts,
          avgPerRound: Number(avgPerRound.toFixed(1)),
          sharePct: Number(sharePct.toFixed(1)),
        };
      })
      .sort((a, b) => b.displayPoints - a.displayPoints);

    const leaderPts = summaries[0]?.displayPoints || 0;
    const enrichedSummaries = summaries.map((s, idx) => ({
      ...s,
      rank: idx + 1,
      gapToLeader: leaderPts - s.displayPoints,
      projectedPrizeMoney: Math.max(12000000, 140000000 - idx * 11500000),
    }));

    return {
      cumulativeSeries: cumRows,
      perRoundSeries: roundRows,
      activeRoundsCount: completed.length,
      constructorSummaries: enrichedSummaries,
    };
  }, [
    season,
    constructorsList,
    dataMode,
    selectedArchive,
    selectedCareerHistoryEntry,
  ]);

  // Multi-Year Historical Comparison Data (2024 + 2025 + Career Seasons + Current Season)
  const multiYearSeries = useMemo(() => {
    const sumArchiveTeamPts = (arch: typeof HISTORICAL_FIA_ARCHIVES.archive_2025) => {
      const totals: Record<string, number> = {};
      arch.roundPointsByTeam.forEach((r) => {
        Object.entries(r).forEach(([tId, pts]) => {
          totals[tId] = (totals[tId] || 0) + pts;
        });
      });
      return totals;
    };

    const pts2024 = sumArchiveTeamPts(HISTORICAL_FIA_ARCHIVES.archive_2024);
    const pts2025 = sumArchiveTeamPts(HISTORICAL_FIA_ARCHIVES.archive_2025);

    const rows: Array<Record<string, any>> = [
      {
        yearLabel: '2024 FIA',
        year: 2024,
        ...pts2024,
      },
      {
        yearLabel: '2025 FIA',
        year: 2025,
        ...pts2025,
      },
    ];

    careerHistory.forEach((h) => {
      const snap = h.constructorPointsSnapshot || {
        mclaren: 295,
        redbull: 265,
        ferrari: 250,
        mercedes: 180,
        [h.teamId || season.selectedTeamId]: h.constructorPoints,
      };
      rows.push({
        yearLabel: `${h.year} (S${h.seasonNumber})`,
        year: h.year,
        ...snap,
      });
    });

    // Current Season row
    rows.push({
      yearLabel: `${currentYear} (Active)`,
      year: currentYear,
      ...season.constructorPoints,
    });

    return rows;
  }, [careerHistory, currentYear, season.constructorPoints, season.selectedTeamId]);

  // Active visible constructors based on preset or custom toggles
  const visibleConstructors = useMemo(() => {
    if (customSelectedTeams.size > 0) {
      return constructorSummaries.filter((c) => customSelectedTeams.has(c.id));
    }
    if (teamFilterPreset === 'all') {
      return constructorSummaries;
    }
    if (teamFilterPreset === 'focus') {
      const leaderId = constructorSummaries[0]?.id;
      const p2Id = constructorSummaries[1]?.id;
      return constructorSummaries.filter(
        (c) => c.isPlayerTeam || c.id === leaderId || c.id === p2Id
      );
    }
    const top5Ids = new Set(constructorSummaries.slice(0, 5).map((c) => c.id));
    return constructorSummaries.filter((c) => top5Ids.has(c.id) || c.isPlayerTeam);
  }, [constructorSummaries, teamFilterPreset, customSelectedTeams]);

  const toggleConstructorSelection = (teamId: string) => {
    setCustomSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const playerConstructorSummary =
    constructorSummaries.find((c) => c.isPlayerTeam) || constructorSummaries[0];
  const leaderSummary = constructorSummaries[0];

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="space-y-6">
      {/* 0. Season & Historical Year Archive Selector Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
              Season & Historical Telemetry Archive
            </div>
            <p className="text-xs text-neutral-400">
              Inspect current season analytics, previous career seasons, or official 2024–2025 FIA World Championship historical archives.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedSeasonKey('current')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              selectedSeasonKey === 'current'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Active: {currentYear} (Season {currentSeasonNumber})
          </button>

          {careerHistory.map((hist) => (
            <button
              key={`career_${hist.seasonNumber}`}
              onClick={() => setSelectedSeasonKey(`career_${hist.seasonNumber}`)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                selectedSeasonKey === `career_${hist.seasonNumber}`
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'bg-neutral-950 text-amber-300 hover:text-white border border-amber-500/30'
              }`}
            >
              <Trophy className="w-3 h-3" />
              <span>
                {hist.year} Career (S{hist.seasonNumber})
              </span>
            </button>
          ))}

          <button
            onClick={() => setSelectedSeasonKey('archive_2025')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              selectedSeasonKey === 'archive_2025'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            2025 FIA Archive
          </button>

          <button
            onClick={() => setSelectedSeasonKey('archive_2024')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              selectedSeasonKey === 'archive_2024'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            2024 FIA Archive
          </button>

          <button
            onClick={() => setSelectedSeasonKey('multi_year')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              selectedSeasonKey === 'multi_year'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-neutral-950 text-purple-300 hover:text-white border border-purple-500/30'
            }`}
          >
            Multi-Year Comparison
          </button>
        </div>
      </div>

      {/* MULTI-YEAR HISTORICAL COMPARISON VIEW */}
      {isMultiYearView ? (
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <div className="text-xs font-mono text-purple-400 font-bold uppercase">
                  Multi-Year Championship Progression (2024 – {currentYear})
                </div>
                <h3 className="text-xl font-black text-white mt-0.5">
                  Year-Over-Year Constructor Championship Points
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Comparing constructor point totals across historical FIA archives (2024, 2025), completed career seasons, and your active campaign.
                </p>
              </div>
            </div>

            <div className="w-full h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={multiYearSeries}
                  margin={{ top: 10, right: 24, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis
                    dataKey="yearLabel"
                    stroke="#737373"
                    tick={{ fill: '#e5e5e5', fontSize: 12, fontFamily: 'monospace' }}
                  />
                  <YAxis
                    stroke="#737373"
                    tick={{ fill: '#a3a3a3', fontSize: 11, fontFamily: 'monospace' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0a0a0a',
                      borderColor: '#262626',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                  {visibleConstructors.map((team) => (
                    <Bar
                      key={team.id}
                      dataKey={team.id}
                      name={team.name}
                      fill={team.color}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historical Career & FIA Season Ledger */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-1">
              Historical Seasons & Career Archive Ledger
            </h3>
            <p className="text-xs text-neutral-400 mb-4">
              Click any previous season to inspect its full 10-round telemetry curves and constructor standings.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 text-[11px]">
                    <th className="py-2.5 pr-4">Year</th>
                    <th className="py-2.5 pr-4">Archive Type</th>
                    <th className="py-2.5 pr-4">Drivers&apos; Champion / Your Rank</th>
                    <th className="py-2.5 pr-4">Constructors&apos; Result</th>
                    <th className="py-2.5 px-4 text-right">Wins / Podiums</th>
                    <th className="py-2.5 pl-4 text-right">Inspect Telemetry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  <tr className="hover:bg-neutral-950/60">
                    <td className="py-3 pr-4 font-bold text-cyan-400">2024</td>
                    <td className="py-3 pr-4 font-sans text-neutral-300">Official FIA Historical Archive</td>
                    <td className="py-3 pr-4 font-sans text-white">Max Verstappen (Red Bull)</td>
                    <td className="py-3 pr-4 font-sans text-amber-400">McLaren F1 Team (P1)</td>
                    <td className="py-3 px-4 text-right text-neutral-400">10 Rounds</td>
                    <td className="py-3 pl-4 text-right">
                      <button
                        onClick={() => setSelectedSeasonKey('archive_2024')}
                        className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 font-sans font-bold cursor-pointer"
                      >
                        Open 2024 Analytics →
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-neutral-950/60">
                    <td className="py-3 pr-4 font-bold text-cyan-400">2025</td>
                    <td className="py-3 pr-4 font-sans text-neutral-300">Official FIA Historical Archive</td>
                    <td className="py-3 pr-4 font-sans text-white">Lando Norris (McLaren)</td>
                    <td className="py-3 pr-4 font-sans text-amber-400">McLaren F1 Team (P1)</td>
                    <td className="py-3 px-4 text-right text-neutral-400">10 Rounds</td>
                    <td className="py-3 pl-4 text-right">
                      <button
                        onClick={() => setSelectedSeasonKey('archive_2025')}
                        className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 font-sans font-bold cursor-pointer"
                      >
                        Open 2025 Analytics →
                      </button>
                    </td>
                  </tr>
                  {careerHistory.map((h) => (
                    <tr key={h.seasonNumber} className="hover:bg-neutral-950/60 bg-amber-500/5">
                      <td className="py-3 pr-4 font-bold text-amber-400">{h.year}</td>
                      <td className="py-3 pr-4 font-sans text-white font-semibold">
                        Career Season {h.seasonNumber} ({h.teamName})
                      </td>
                      <td className="py-3 pr-4 font-sans text-white">
                        P{h.finalDriverRank} ({h.driverPoints} PTS){' '}
                        {h.isWorldChampion ? '🏆 WDC' : ''}
                      </td>
                      <td className="py-3 pr-4 font-sans text-emerald-400">
                        P{h.constructorRank} ({h.constructorPoints} PTS){' '}
                        {h.isConstructorsChampion ? '🛡️ WCC' : ''}
                      </td>
                      <td className="py-3 px-4 text-right text-neutral-200">
                        {h.wins}W / {h.podiums}P
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <button
                          onClick={() => setSelectedSeasonKey(`career_${h.seasonNumber}`)}
                          className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-sans font-bold cursor-pointer"
                        >
                          Open {h.year} Analytics →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Top Analytics Header & Controls */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                <span className="text-red-400 font-bold">FIA Telemetry & Strategy</span>
                <span aria-hidden="true">·</span>
                <span>
                  {selectedArchive
                    ? selectedArchive.label
                    : selectedCareerHistoryEntry
                    ? `Archived Career Season ${selectedCareerHistoryEntry.seasonNumber} (${selectedCareerHistoryEntry.year})`
                    : `Active Season ${currentSeasonNumber} (${currentYear})`}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {activeRoundsCount} of {CIRCUITS.length} Rounds Completed
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mt-1">
                {selectedArchive
                  ? `${selectedArchive.year} Constructor Performance Analytics`
                  : selectedCareerHistoryEntry
                  ? `${selectedCareerHistoryEntry.year} Season Performance Analytics (${selectedCareerHistoryEntry.teamName})`
                  : 'Constructor Performance Analytics'}
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
                {selectedArchive
                  ? `${selectedArchive.subtitle} · Drivers' Champion: ${selectedArchive.driversChampion}`
                  : selectedCareerHistoryEntry
                  ? `Completed Career Season ${selectedCareerHistoryEntry.seasonNumber} Recap: Finished P${selectedCareerHistoryEntry.finalDriverRank} in Drivers (${selectedCareerHistoryEntry.driverPoints} pts) & P${selectedCareerHistoryEntry.constructorRank} in Constructors (${selectedCareerHistoryEntry.constructorPoints} pts).`
                  : 'Historical constructor championship point trajectories, round-by-round scoring velocity, and FIA prize fund projections.'}
              </p>
            </div>

            {/* Mode & View Segmented Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {isCurrentSeasonSelected && (
                <div className="flex items-center gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
                  <button
                    onClick={() => setDataMode('actual')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      dataMode === 'actual'
                        ? 'bg-red-600 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Completed Rounds ({season.completedRounds.length})
                  </button>
                  <button
                    onClick={() => setDataMode('projected')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      dataMode === 'projected'
                        ? 'bg-red-600 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    10-Round Trajectory
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
                <button
                  onClick={() => setChartView('cumulative')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    chartView === 'cumulative'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Cumulative Curve
                </button>
                <button
                  onClick={() => setChartView('per_round')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    chartView === 'per_round'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Points Per GP
                </button>
                <button
                  onClick={() => setChartView('comparison')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    chartView === 'comparison'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Share & Valuation
                </button>
              </div>
            </div>
          </div>

          {/* 2. KPI Strip (4 Metrics with Tabular Numerals) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="text-xs text-neutral-400">Championship Leader</div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-black text-white truncate">
                  {leaderSummary?.name || 'McLaren'}
                </span>
                <span className="text-xl font-mono font-black text-amber-400 tabular-nums">
                  {leaderSummary?.displayPoints || 0} PTS
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 font-mono tabular-nums mt-1">
                Avg {leaderSummary?.avgPerRound || 0} pts/round · {leaderSummary?.sharePct || 0}% share
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="text-xs text-neutral-400">Your Constructor Standing</div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-black text-white truncate">
                  P{playerConstructorSummary?.rank || 1} · {playerConstructorSummary?.shortName}
                </span>
                <span className="text-xl font-mono font-black text-cyan-400 tabular-nums">
                  {playerConstructorSummary?.displayPoints || 0} PTS
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 font-mono tabular-nums mt-1">
                {playerConstructorSummary?.gapToLeader === 0
                  ? 'Leading Constructors Cup'
                  : `-${playerConstructorSummary?.gapToLeader || 0} PTS behind P1`}
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="text-xs text-neutral-400">Your Scoring Velocity</div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-mono font-black text-white tabular-nums">
                  {playerConstructorSummary?.avgPerRound || 0} PTS / GP
                </span>
                <span className="text-xs font-mono text-emerald-400 tabular-nums">
                  {playerConstructorSummary?.sharePct || 0}% of grid
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 font-mono tabular-nums mt-1">
                PU: {playerConstructorSummary?.engine}
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="text-xs text-neutral-400">Projected FIA Column-1 Prize</div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-mono font-black text-emerald-400 tabular-nums">
                  {formatMoney(playerConstructorSummary?.projectedPrizeMoney || 25000000)}
                </span>
                <span className="text-xs font-mono text-neutral-400 tabular-nums">
                  Rank P{playerConstructorSummary?.rank || 10}
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 font-mono tabular-nums mt-1">
                Paid at Round 10 Season Finale
              </div>
            </div>
          </div>

          {/* 3. Constructor Filter Bar */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-neutral-300 font-semibold">
                <Filter className="w-3.5 h-3.5 text-red-400" />
                <span>Constructor Telemetry Filter</span>
                <span className="text-neutral-500">·</span>
                <span className="text-neutral-400 font-normal">
                  Click any team below to isolate or compare historical curves
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setCustomSelectedTeams(new Set());
                    setTeamFilterPreset('top5');
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    customSelectedTeams.size === 0 && teamFilterPreset === 'top5'
                      ? 'bg-red-600 text-white'
                      : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  Top 5 + Your Team
                </button>
                <button
                  onClick={() => {
                    setCustomSelectedTeams(new Set());
                    setTeamFilterPreset('focus');
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    customSelectedTeams.size === 0 && teamFilterPreset === 'focus'
                      ? 'bg-red-600 text-white'
                      : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  My Team vs Top 2
                </button>
                <button
                  onClick={() => {
                    setCustomSelectedTeams(new Set());
                    setTeamFilterPreset('all');
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    customSelectedTeams.size === 0 && teamFilterPreset === 'all'
                      ? 'bg-red-600 text-white'
                      : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  All {constructorSummaries.length} Teams
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {constructorSummaries.map((team) => {
                const isActive = visibleConstructors.some((v) => v.id === team.id);
                return (
                  <button
                    key={team.id}
                    onClick={() => toggleConstructorSelection(team.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer border whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-neutral-950 text-white border-neutral-700'
                        : 'bg-neutral-950/40 text-neutral-500 border-neutral-800/60 hover:text-neutral-300'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{
                        backgroundColor: team.color,
                        opacity: isActive ? 1 : 0.35,
                      }}
                    />
                    <span>{team.shortName}</span>
                    <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
                      {team.displayPoints}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Primary Recharts Visualization Canvas */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            {isCurrentSeasonSelected && dataMode === 'actual' && !hasCompletedRounds ? (
              <div className="py-16 text-center max-w-md mx-auto space-y-4">
                <BarChart3 className="w-10 h-10 text-neutral-600 mx-auto" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    No Completed Grand Prix Rounds Yet in Active Season
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Complete Round 1 at Bahrain to record official race points, switch to the 10-Round Trajectory view, or select <strong>2025 / 2024 FIA Archive</strong> above to inspect previous years!
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setDataMode('projected')}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    View 10-Round Projection
                  </button>
                  <button
                    onClick={() => setSelectedSeasonKey('archive_2025')}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    View 2025 Season Archive
                  </button>
                  {onStartRaceClick && (
                    <button
                      onClick={onStartRaceClick}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Go to Race Weekend</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {chartView === 'cumulative'
                        ? 'Cumulative Constructor Championship Points Over Season'
                        : chartView === 'per_round'
                        ? 'Constructor Points Scored Per Grand Prix Round'
                        : 'Constructor Points vs. Average Scoring Pace'}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {selectedArchive
                        ? `Official ${selectedArchive.year} FIA World Championship round-by-round telemetry.`
                        : selectedCareerHistoryEntry
                        ? `Archived Career Season ${selectedCareerHistoryEntry.seasonNumber} (${selectedCareerHistoryEntry.year}) telemetry.`
                        : dataMode === 'projected'
                        ? 'Rounds marked with (*) represent telemetry-based season trajectory projections across remaining circuits.'
                        : `Showing verified FIA race classification data across ${season.completedRounds.length} completed Grand Prix rounds.`}
                    </p>
                  </div>
                  <div className="text-xs font-mono text-neutral-400 tabular-nums">
                    Active Series: {visibleConstructors.length} Constructors
                  </div>
                </div>

                <div className="w-full h-[380px]">
                  {chartView === 'cumulative' && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={cumulativeSeries}
                        margin={{ top: 10, right: 24, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                        <XAxis
                          dataKey="roundLabel"
                          stroke="#737373"
                          tick={{ fill: '#a3a3a3', fontSize: 11, fontFamily: 'monospace' }}
                        />
                        <YAxis
                          stroke="#737373"
                          tick={{ fill: '#a3a3a3', fontSize: 11, fontFamily: 'monospace' }}
                          label={{
                            value: 'Cumulative Points',
                            angle: -90,
                            position: 'insideLeft',
                            fill: '#737373',
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0a0a0a',
                            borderColor: '#262626',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                          }}
                          labelStyle={{ color: '#ffffff', fontWeight: 700, marginBottom: '6px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                        {visibleConstructors.map((team) => (
                          <Line
                            key={team.id}
                            type="monotone"
                            dataKey={team.id}
                            name={team.name}
                            stroke={team.color}
                            strokeWidth={team.isPlayerTeam ? 3.5 : 2.2}
                            dot={{
                              r: team.isPlayerTeam ? 4.5 : 3,
                              fill: team.color,
                              strokeWidth: team.isPlayerTeam ? 2 : 0,
                              stroke: '#ffffff',
                            }}
                            activeDot={{ r: 6 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}

                  {chartView === 'per_round' && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={perRoundSeries}
                        margin={{ top: 10, right: 24, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                        <XAxis
                          dataKey="roundLabel"
                          stroke="#737373"
                          tick={{ fill: '#a3a3a3', fontSize: 11, fontFamily: 'monospace' }}
                        />
                        <YAxis
                          stroke="#737373"
                          tick={{ fill: '#a3a3a3', fontSize: 11, fontFamily: 'monospace' }}
                          label={{
                            value: 'Points Scored in Round',
                            angle: -90,
                            position: 'insideLeft',
                            fill: '#737373',
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0a0a0a',
                            borderColor: '#262626',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                          }}
                          labelStyle={{ color: '#ffffff', fontWeight: 700, marginBottom: '6px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                        {visibleConstructors.map((team) => (
                          <Bar
                            key={team.id}
                            dataKey={team.id}
                            name={team.name}
                            fill={team.color}
                            radius={[4, 4, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {chartView === 'comparison' && (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={constructorSummaries}
                        margin={{ top: 10, right: 24, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                        <XAxis
                          dataKey="shortName"
                          stroke="#737373"
                          tick={{ fill: '#a3a3a3', fontSize: 11, fontFamily: 'monospace' }}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="#737373"
                          tick={{ fill: '#a3a3a3', fontSize: 11, fontFamily: 'monospace' }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#38bdf8"
                          tick={{ fill: '#38bdf8', fontSize: 11, fontFamily: 'monospace' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0a0a0a',
                            borderColor: '#262626',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                        <Bar
                          yAxisId="left"
                          dataKey="displayPoints"
                          name="Total Constructor Points"
                          radius={[6, 6, 0, 0]}
                        >
                          {constructorSummaries.map((entry) => (
                            <Cell key={entry.id} fill={entry.color} />
                          ))}
                        </Bar>
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="avgPerRound"
                          name="Avg Points / Round"
                          stroke="#38bdf8"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#38bdf8' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 5. High-Density Constructor Telemetry Ledger Table */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Constructor Championship Telemetry & Prize Breakdown
                </h3>
                <p className="text-xs text-neutral-400">
                  Complete constructor standings, scoring rate per Grand Prix, and FIA Concorde prize allocation.
                </p>
              </div>
              <span className="text-xs font-mono text-neutral-400 tabular-nums">
                {selectedArchive
                  ? `${selectedArchive.year} Final Classification`
                  : selectedCareerHistoryEntry
                  ? `${selectedCareerHistoryEntry.year} Final Classification`
                  : dataMode === 'projected'
                  ? '10-Round Projected Standings'
                  : 'Current Official Standings'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 font-mono text-[11px]">
                    <th className="py-2.5 pr-4">Pos</th>
                    <th className="py-2.5 pr-4">Constructor</th>
                    <th className="py-2.5 pr-4">Power Unit</th>
                    <th className="py-2.5 px-4 text-right">Actual Pts</th>
                    {isCurrentSeasonSelected && dataMode === 'projected' && (
                      <th className="py-2.5 px-4 text-right">10-GP Projected</th>
                    )}
                    <th className="py-2.5 px-4 text-right">Gap to P1</th>
                    <th className="py-2.5 px-4 text-right">Pts / Round</th>
                    <th className="py-2.5 px-4 text-right">Grid Share</th>
                    <th className="py-2.5 pl-4 text-right">FIA Prize Pool</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono tabular-nums">
                  {constructorSummaries.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        row.isPlayerTeam
                          ? 'bg-red-500/10 text-white'
                          : 'hover:bg-neutral-950/60 text-neutral-300'
                      }`}
                    >
                      <td className="py-3 pr-4 font-bold text-white">P{row.rank}</td>
                      <td className="py-3 pr-4 font-sans">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className="font-bold text-white">{row.name}</span>
                          {row.isPlayerTeam && (
                            <span className="text-[11px] text-red-400 font-semibold">
                              · Your Team
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-neutral-400 font-sans">{row.engine}</td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        {row.actualPoints}
                      </td>
                      {isCurrentSeasonSelected && dataMode === 'projected' && (
                        <td className="py-3 px-4 text-right font-bold text-amber-400">
                          {row.displayPoints}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right text-neutral-400">
                        {row.gapToLeader === 0 ? 'LEADER' : `-${row.gapToLeader}`}
                      </td>
                      <td className="py-3 px-4 text-right text-cyan-400">
                        {row.avgPerRound.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right text-neutral-300">
                        {row.sharePct.toFixed(1)}%
                      </td>
                      <td className="py-3 pl-4 text-right font-bold text-emerald-400">
                        {formatMoney(row.projectedPrizeMoney)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
