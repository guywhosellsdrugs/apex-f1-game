import React, { useState, useMemo } from 'react';
import { SeasonState, Team } from '../types/racing';
import { CIRCUITS, TEAMS, DRIVERS, PRIZE_MONEY } from '../constants/f1Data';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  Shield,
  Award,
  Layers,
  Filter,
  Check,
  Play,
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

export const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({
  season,
  onStartRaceClick,
}) => {
  // Data Mode: 'actual' shows only completed rounds (or falls back to 'projected' if 0 rounds completed and user toggles),
  // 'projected' shows completed rounds + projected pace across remaining rounds of the 10-race calendar
  const hasCompletedRounds = (season.completedRounds?.length || 0) > 0;
  const [dataMode, setDataMode] = useState<'actual' | 'projected'>(
    hasCompletedRounds ? 'actual' : 'projected'
  );
  const [chartView, setChartView] = useState<'cumulative' | 'per_round' | 'comparison'>('cumulative');
  const [teamFilterPreset, setTeamFilterPreset] = useState<'top5' | 'all' | 'focus'>('top5');
  const [customSelectedTeams, setCustomSelectedTeams] = useState<Set<string>>(new Set());

  // Build full list of constructors (10 official + 11th custom team if active)
  const constructorsList: ConstructorMeta[] = useMemo(() => {
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
        isPlayerTeam: season.selectedTeamId === t.id,
        performanceScore: perf,
      };
    });

    if (season.career.customTeam) {
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
        isPlayerTeam: season.selectedTeamId === ct.id,
        performanceScore: customPerf,
      });
    }

    return list;
  }, [season.career.customTeam, season.selectedTeamId]);

  // Helper to resolve which constructor a driver scored points for in a completed round
  const resolveDriverTeamId = (driverId: string): string => {
    const playerDriverId = season.selectedDriverId;
    if (driverId === playerDriverId) {
      return season.selectedTeamId;
    }
    if (
      season.career.customTeam &&
      season.selectedTeamId === season.career.customTeam.id &&
      season.career.customTeam.teammateDriverId === driverId
    ) {
      return season.career.customTeam.id;
    }
    const officialTeam = TEAMS.find((t) => t.id === season.selectedTeamId);
    if (officialTeam && officialTeam.drivers.includes(driverId)) {
      return season.selectedTeamId;
    }
    const d = DRIVERS.find((drv) => drv.id === driverId);
    return d?.teamId || 'haas';
  };

  // Reconstruct round-by-round points (both per-round and cumulative)
  const { cumulativeSeries, perRoundSeries, constructorSummaries } = useMemo(() => {
    const completed = season.completedRounds || [];
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

    // 1. Process actual completed rounds
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

    // Sync runningTotals with actual season.constructorPoints in case of mid-season adjustments
    if (completed.length > 0) {
      constructorsList.forEach((c) => {
        const actualTotal = season.constructorPoints[c.id] || 0;
        runningTotals[c.id] = actualTotal;
        cumRows[cumRows.length - 1][c.id] = actualTotal;
      });
    }

    // 2. If dataMode === 'projected' or 0 completed rounds, project remaining rounds deterministically
    const showProjected = dataMode === 'projected';
    if (showProjected && completed.length < CIRCUITS.length) {
      const fiaTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
      for (let r = completed.length; r < CIRCUITS.length; r++) {
        const circ = CIRCUITS[r];
        // Deterministic circuit-specific seed so curves look realistic and repeatable
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

        // Distribute top 10 car finishes across top constructors (2 cars per team)
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

    // Build sorted summary table
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
      constructorSummaries: enrichedSummaries,
    };
  }, [season, constructorsList, dataMode]);

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
    // Default 'top5' + always include player's constructor
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
      {/* 1. Top Analytics Header & Controls */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
            <span className="text-red-400 font-bold">FIA Telemetry & Strategy</span>
            <span aria-hidden="true">·</span>
            <span>Season {season.career.seasonNumber || 1}</span>
            <span aria-hidden="true">·</span>
            <span>
              {season.completedRounds.length} of {CIRCUITS.length} Rounds Completed
            </span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mt-1">
            Constructor Performance Analytics
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
            Historical constructor championship point trajectories, round-by-round scoring velocity, and FIA prize fund projections.
          </p>
        </div>

        {/* Mode & View Segmented Controls */}
        <div className="flex flex-wrap items-center gap-2">
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
        {dataMode === 'actual' && !hasCompletedRounds ? (
          <div className="py-16 text-center max-w-md mx-auto space-y-4">
            <BarChart3 className="w-10 h-10 text-neutral-600 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-white">
                No Completed Grand Prix Rounds Yet
              </h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Complete Round 1 at Bahrain to record official historical race points, or switch to the 10-Round Trajectory view to inspect simulated season projections.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDataMode('projected')}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                View 10-Round Projection
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
                  {dataMode === 'projected'
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
                    <Legend
                      wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                    />
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
              Complete constructor standings, scoring rate per Grand Prix, and estimated FIA Concorde prize allocation.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-400 tabular-nums">
            {dataMode === 'projected' ? '10-Round Projected Standings' : 'Current Official Standings'}
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
                {dataMode === 'projected' && (
                  <th className="py-2.5 px-4 text-right">10-GP Projected</th>
                )}
                <th className="py-2.5 px-4 text-right">Gap to P1</th>
                <th className="py-2.5 px-4 text-right">Pts / Round</th>
                <th className="py-2.5 px-4 text-right">Grid Share</th>
                <th className="py-2.5 pl-4 text-right">Est. FIA Prize Pool</th>
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
                  {dataMode === 'projected' && (
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
    </div>
  );
};
