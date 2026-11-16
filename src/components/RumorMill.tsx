import React, { useMemo, useState } from 'react';
import { SeasonState, Team } from '../types/racing';
import { TEAMS, DRIVERS, TEAM_CONTRACTS } from '../constants/f1Data';
import {
  Flame,
  Sparkles,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Radio,
  ShieldAlert,
  RefreshCw,
  Eye,
} from 'lucide-react';

export interface WildTransferRumor {
  id: string;
  cycleNumber: number;
  cycleRangeLabel: string;
  wildnessRating: number; // 1 - 100
  rumorTag: 'UNDERDOG WAR-CHEST' | 'SECRET POACH PLOT' | 'COLD MARKET REALITY' | 'BLOCKBUSTER DOMINO' | 'HOT SEAT ALERT';
  headline: string;
  body: string;
  insiderSource: string;
  marketLogicReason: string;
  fromTeam: Team;
  toTeam: Team;
  subjectDriverName: string;
  displacedDriverName: string;
  rumoredAnnualSalary: number;
  rumoredSalaryPerRace: number;
  rumoredSigningBonus: number;
  involvesPlayer: boolean;
}

interface RumorMillProps {
  season: SeasonState;
  onSelectContractTeam?: (team: Team) => void;
  onNavigateToContracts?: () => void;
  onToggleLookingForTeam?: (looking: boolean) => void;
  compact?: boolean;
}

export const RumorMill: React.FC<RumorMillProps> = ({
  season,
  onSelectContractTeam,
  onNavigateToContracts,
  onToggleLookingForTeam,
  compact = false,
}) => {
  const [expandedLogicId, setExpandedLogicId] = useState<string | null>(null);

  const completedRaces = season.completedRounds?.length || 0;
  // Updates automatically every 3 races (0-2 -> Cycle 1, 3-5 -> Cycle 2, 6-8 -> Cycle 3, 9-10 -> Cycle 4)
  const threeRaceCycleIndex = Math.floor(completedRaces / 3);
  const cycleStartRace = threeRaceCycleIndex * 3 + 1;
  const cycleEndRace = Math.min(10, cycleStartRace + 2);
  const racesUntilNextRefresh = Math.max(1, (threeRaceCycleIndex + 1) * 3 - completedRaces);

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);

  const wildRumors = useMemo<WildTransferRumor[]>(() => {
    const seasonNum = season.career.seasonNumber || 1;
    const seed = seasonNum * 37 + threeRaceCycleIndex * 19;

    const driverRating = season.career.driverRating || 76;
    const wins = season.career.wins || 0;
    const podiums = season.career.podiums || 0;
    const racesDriven = Math.max(1, season.career.racesDriven || 0);
    const winRate = season.career.racesDriven > 0 ? wins / racesDriven : 0;
    const winRatePct = Math.round(winRate * 100);
    const reputation = season.career.reputation || 0.1;
    const reputationPct = Math.round(reputation * 100);
    const cups = season.career.championships || 0;
    const isLooking = Boolean(season.career.isLookingForTeam);
    const playerName = season.career.driverName || 'Player Driver';

    const playerTeam =
      season.career.customTeam && season.selectedTeamId === season.career.customTeam.id
        ? ({
            id: season.career.customTeam.id,
            name: season.career.customTeam.name,
            shortName: season.career.customTeam.shortName,
            engine: season.career.customTeam.engine,
            primaryColor: season.career.customTeam.primaryColor,
            secondaryColor: season.career.customTeam.secondaryColor,
            accentColor: season.career.customTeam.accentColor,
            performanceTier: 1,
            drivers: [season.selectedDriverId, season.career.customTeam.teammateDriverId] as [string, string],
            reputationRequired: 0,
            baseSalary: 1000000,
          } as Team)
        : TEAMS.find((t) => t.id === season.selectedTeamId) || TEAMS[0];

    const rivalTeams = TEAMS.filter((t) => t.id !== season.selectedTeamId);
    const underdogTeams = rivalTeams.filter((t) => t.performanceTier >= 3);
    const frontrunnerTeams = rivalTeams.filter((t) => t.performanceTier <= 2);

    const isEliteSuperstar =
      cups >= 1 || driverRating >= 88 || (season.career.racesDriven >= 3 && winRate >= 0.25);
    const isGoodContender =
      isEliteSuperstar ||
      driverRating >= 81 ||
      wins >= 1 ||
      (driverRating >= 79 && podiums >= 2 && reputation >= 0.42);
    const isLowPerforming =
      driverRating < 79 && wins === 0 && reputation < 0.35 && cups === 0;

    const cycleLabel = `Races ${cycleStartRace}–${cycleEndRace} Window`;
    const list: WildTransferRumor[] = [];

    // =========================================================================
    // RUMOR 1: PLAYER-CENTRIC WILD RUMOR (Driven by current Driver Market Logic)
    // =========================================================================
    if (isGoodContender) {
      const targetUnderdog =
        underdogTeams[seed % Math.max(1, underdogTeams.length)] || rivalTeams[0];
      const baseContract =
        TEAM_CONTRACTS.find((c) => c.teamId === targetUnderdog.id) || TEAM_CONTRACTS[0];
      const displacedDriver =
        DRIVERS.find((d) => d.id === targetUnderdog.drivers[1]) ||
        DRIVERS.find((d) => d.teamId === targetUnderdog.id) ||
        DRIVERS[0];

      const overpayMult = isEliteSuperstar ? 3.2 : 2.35;
      const perRace =
        Math.round((Math.max(1050000, baseContract.salaryPerRace) * overpayMult) / 50000) *
        50000;
      const annual = perRace * 10;
      const bonus =
        Math.round((Math.max(2500000, baseContract.signingBonus) * 2.2) / 100000) * 100000;

      if (isLooking) {
        list.push({
          id: `rumor_player_warchest_s${seasonNum}_c${threeRaceCycleIndex}`,
          cycleNumber: threeRaceCycleIndex + 1,
          cycleRangeLabel: cycleLabel,
          wildnessRating: isEliteSuperstar ? 98 : 91,
          rumorTag: 'UNDERDOG WAR-CHEST',
          headline: `WILD WAR-CHEST BID: ${targetUnderdog.name} Ready to Outspend Frontrunners with ${formatMoney(annual)}/yr for ${playerName}!`,
          body: `Since ${playerName} publicly announced they are looking for a team, ${targetUnderdog.name} investors have reportedly authorized an outrageous ${formatMoney(annual)}/yr (${formatMoney(perRace)}/race) + ${formatMoney(bonus)} bonus package to replace ${displacedDriver.name}—knowing top Tier-1 constructors refuse to match that cash unless a driver holds multiple World Titles.`,
          insiderSource: 'Overheard in the Paddock Hospitality Suite',
          marketLogicReason: `Triggered because you announced Looking for a Team with high stats (${driverRating} OVR, ${winRatePct}% Win Rate, ${cups} Cups). Worse/midfield teams (Tier ${targetUnderdog.performanceTier}) offer massive cash overpays to lure elite talent to slower cars.`,
          fromTeam: playerTeam,
          toTeam: targetUnderdog,
          subjectDriverName: playerName,
          displacedDriverName: displacedDriver.name,
          rumoredAnnualSalary: annual,
          rumoredSalaryPerRace: perRace,
          rumoredSigningBonus: bonus,
          involvesPlayer: true,
        });
      } else {
        list.push({
          id: `rumor_player_stealth_s${seasonNum}_c${threeRaceCycleIndex}`,
          cycleNumber: threeRaceCycleIndex + 1,
          cycleRangeLabel: cycleLabel,
          wildnessRating: 89,
          rumorTag: 'SECRET POACH PLOT',
          headline: `SECRET SHADOW OFFER: ${targetUnderdog.name} Waiting for ${playerName} to Announce Availability for ${formatMoney(annual)}/yr Mega-Deal!`,
          body: `Even though ${playerName} hasn't publicly announced they are looking for a team yet, leaked boardroom memos suggest ${targetUnderdog.name} has earmarked a ${formatMoney(annual)}/yr war-chest contract the moment ${playerName} opens contract talks.`,
          insiderSource: 'Leaked Constructor Boardroom Dossier',
          marketLogicReason: `You are currently committed to ${playerTeam.name} (Quiet Market), so teams hold back formal offers—but your ${driverRating} OVR & ${wins} Wins have Tier-${targetUnderdog.performanceTier} underdogs ready to overpay as soon as you announce you're looking for a team.`,
          fromTeam: playerTeam,
          toTeam: targetUnderdog,
          subjectDriverName: playerName,
          displacedDriverName: displacedDriver.name,
          rumoredAnnualSalary: annual,
          rumoredSalaryPerRace: perRace,
          rumoredSigningBonus: bonus,
          involvesPlayer: true,
        });
      }
    } else if (isLowPerforming) {
      const backmarkerTeams = rivalTeams.filter((t) => t.performanceTier >= 4);
      const lowTeam =
        backmarkerTeams[seed % Math.max(1, backmarkerTeams.length)] ||
        underdogTeams[0] ||
        rivalTeams[0];
      const displacedDriver =
        DRIVERS.find((d) => d.id === lowTeam.drivers[1]) ||
        DRIVERS.find((d) => d.teamId === lowTeam.id) ||
        DRIVERS[0];
      const lowPerRace = 95000;
      const lowAnnual = lowPerRace * 10;
      const lowBonus = 150000;

      list.push({
        id: `rumor_player_cold_s${seasonNum}_c${threeRaceCycleIndex}`,
        cycleNumber: threeRaceCycleIndex + 1,
        cycleRangeLabel: cycleLabel,
        wildnessRating: 84,
        rumorTag: isLooking ? 'COLD MARKET REALITY' : 'HOT SEAT ALERT',
        headline: isLooking
          ? `FROZEN OUT BY TOP TEAMS: Only ${lowTeam.name} Mulling Cut-Price ${formatMoney(lowAnnual)}/yr Seat for ${playerName}`
          : `SIMULATOR SHOOTOUT RUMOR: Paddock Whispers Question ${playerName}'s Long-Term Leverage at ${playerTeam.name}`,
        body: isLooking
          ? `Despite ${playerName} announcing they are looking for a new team, frontrunner principals have reportedly passed due to a ${driverRating} Rating and ${winRatePct}% win rate—leaving ${lowTeam.name} to consider a low-ball ${formatMoney(lowAnnual)}/yr prove-it deal.`
          : `With a ${driverRating} Driver Rating, ${winRatePct}% win rate, and ${reputationPct}% Paddock Reputation, insiders claim rival teams won't table serious money until ${playerName} starts bagging podiums or wins.`,
        insiderSource: 'Pitlane Telemetry & Management Wire',
        marketLogicReason: `Low market leverage (${driverRating} OVR, ${winRatePct}% Win Rate, ${reputationPct}% Rep). In the current driver market, low stats yield zero frontrunner offers and only minimum-cash backmarker deals.`,
        fromTeam: playerTeam,
        toTeam: lowTeam,
        subjectDriverName: playerName,
        displacedDriverName: displacedDriver.name,
        rumoredAnnualSalary: lowAnnual,
        rumoredSalaryPerRace: lowPerRace,
        rumoredSigningBonus: lowBonus,
        involvesPlayer: true,
      });
    } else {
      // Mid-tier rising driver
      const midTarget =
        underdogTeams[(seed + 1) % Math.max(1, underdogTeams.length)] || rivalTeams[0];
      const displacedDriver =
        DRIVERS.find((d) => d.id === midTarget.drivers[1]) ||
        DRIVERS.find((d) => d.teamId === midTarget.id) ||
        DRIVERS[0];
      const perRace = 1150000;
      const annual = perRace * 10;
      const bonus = 2200000;

      list.push({
        id: `rumor_player_mid_s${seasonNum}_c${threeRaceCycleIndex}`,
        cycleNumber: threeRaceCycleIndex + 1,
        cycleRangeLabel: cycleLabel,
        wildnessRating: 86,
        rumorTag: 'UNDERDOG WAR-CHEST',
        headline: `MIDFIELD BIDDING WAR BREWING: ${midTarget.name} Weighing ${formatMoney(annual)}/yr Offer for ${playerName}`,
        body: `Paddock scouts say ${midTarget.name} is closely tracking ${playerName} (${driverRating} OVR). If ${playerName} ${isLooking ? 'negotiates hard' : 'announces they are looking for a team'}, ${midTarget.name} could table nearly double their standard salary scale to lock down the seat.`,
        insiderSource: 'F1 Driver Market Confidential',
        marketLogicReason: `Rising driver profile (${driverRating} OVR, ${reputationPct}% Rep). Midfield/worse teams (Tier ${midTarget.performanceTier}) are far more willing to overpay than Tier-1 teams.`,
        fromTeam: playerTeam,
        toTeam: midTarget,
        subjectDriverName: playerName,
        displacedDriverName: displacedDriver.name,
        rumoredAnnualSalary: annual,
        rumoredSalaryPerRace: perRace,
        rumoredSigningBonus: bonus,
        involvesPlayer: true,
      });
    }

    // =========================================================================
    // RUMOR 2: WILD PADDOCK DOMINO / RIVAL SUPER-TRANSFER (Generated on 2-rumor cycles or when looking for team)
    // =========================================================================
    const showSecondRumor = isLooking || (threeRaceCycleIndex + seasonNum) % 2 === 0 || completedRaces >= 3;
    if (showSecondRumor && frontrunnerTeams.length > 0 && underdogTeams.length > 0) {
      const starOriginTeam =
        frontrunnerTeams[(seed + 2) % frontrunnerTeams.length] || TEAMS[0];
      const starDriver =
        DRIVERS.find((d) => d.id === starOriginTeam.drivers[0]) || DRIVERS[0];
      const wealthyUnderdog =
        underdogTeams[(seed + 3) % underdogTeams.length] || TEAMS[TEAMS.length - 1];
      const replacedUnderdogDriver =
        DRIVERS.find((d) => d.id === wealthyUnderdog.drivers[1]) || DRIVERS[1];

      const wildAnnual = (28 + ((seed * 3) % 14)) * 1000000; // $28M - $41M/yr
      const wildPerRace = Math.round(wildAnnual / 10);
      const wildBonus = 6500000;

      list.push({
        id: `rumor_ai_domino_s${seasonNum}_c${threeRaceCycleIndex}`,
        cycleNumber: threeRaceCycleIndex + 1,
        cycleRangeLabel: cycleLabel,
        wildnessRating: 95,
        rumorTag: 'BLOCKBUSTER DOMINO',
        headline: `SHOCK PADDOCK DOMINO: ${wealthyUnderdog.name} Dangles ${formatMoney(wildAnnual)}/yr War-Chest at ${starDriver.name}!`,
        body: `In a wild 3-race silly-season twist, Tier-${wealthyUnderdog.performanceTier} outfit ${wealthyUnderdog.name} has reportedly approached ${starOriginTeam.name} star ${starDriver.name} with an astronomical ${formatMoney(wildAnnual)}/yr contract—proving once again that lower-ranked constructors are throwing massive money around to poach high-rated drivers!`,
        insiderSource: 'European Motorsport Syndicate',
        marketLogicReason: `Reflects the core Paddock Market Rule: Worse/midfield teams (Tier ${wealthyUnderdog.performanceTier}) aggressively outbid frontrunners on annual salary to lure high-OVR stars (${starDriver.rating} OVR), which could open a shock seat at ${starOriginTeam.name}.`,
        fromTeam: starOriginTeam,
        toTeam: wealthyUnderdog,
        subjectDriverName: starDriver.name,
        displacedDriverName: replacedUnderdogDriver.name,
        rumoredAnnualSalary: wildAnnual,
        rumoredSalaryPerRace: wildPerRace,
        rumoredSigningBonus: wildBonus,
        involvesPlayer: false,
      });
    }

    return list;
  }, [
    season.career.seasonNumber,
    season.career.driverRating,
    season.career.wins,
    season.career.podiums,
    season.career.racesDriven,
    season.career.reputation,
    season.career.championships,
    season.career.isLookingForTeam,
    season.career.driverName,
    season.career.customTeam,
    season.selectedTeamId,
    season.selectedDriverId,
    threeRaceCycleIndex,
    cycleStartRace,
    cycleEndRace,
    completedRaces,
  ]);

  return (
    <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-rose-950/20 border-2 border-rose-500/35 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-rose-500 text-white text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse" />
                <span>PADDOCK RUMOR MILL</span>
              </span>
              <span className="text-[11px] font-mono text-amber-400 font-bold">
                3-Race Silly Season Cycle #{threeRaceCycleIndex + 1} (Races {cycleStartRace}–{cycleEndRace})
              </span>
            </div>
            <h3 className="text-lg font-black text-white mt-0.5">
              Wild Driver Transfer Whispers ({wildRumors.length} Active {wildRumors.length === 1 ? 'Rumor' : 'Rumors'})
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-neutral-300 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
            <span>
              {season.seasonFinished
                ? 'Off-Season Transfer Window Active'
                : `New Rumors in ${racesUntilNextRefresh} Race${racesUntilNextRefresh === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Rumors Grid */}
      <div className={`grid grid-cols-1 ${wildRumors.length > 1 ? 'lg:grid-cols-2' : ''} gap-4`}>
        {wildRumors.map((rumor) => {
          const isLogicExpanded = expandedLogicId === rumor.id;
          return (
            <div
              key={rumor.id}
              className="bg-neutral-950/90 border border-white/10 hover:border-rose-500/40 rounded-2xl p-4 flex flex-col justify-between gap-3.5 transition-all"
            >
              <div className="flex flex-col gap-2.5">
                {/* Top Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-black uppercase tracking-wider ${
                      rumor.rumorTag === 'UNDERDOG WAR-CHEST'
                        ? 'bg-emerald-400 text-black'
                        : rumor.rumorTag === 'BLOCKBUSTER DOMINO'
                        ? 'bg-amber-400 text-black'
                        : rumor.rumorTag === 'SECRET POACH PLOT'
                        ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    ★ {rumor.rumorTag}
                  </span>

                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-black text-rose-400">
                    <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-400" />
                    <span>{rumor.wildnessRating}% WILDNESS</span>
                  </div>
                </div>

                {/* Team Transfer Visual Bar */}
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-neutral-900 border border-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-[10px] shrink-0"
                      style={{ backgroundColor: rumor.fromTeam.primaryColor }}
                    >
                      {rumor.fromTeam.shortName.substring(0, 3)}
                    </div>
                    <div className="truncate">
                      <span className="text-[9px] uppercase font-bold text-neutral-400 block">Current</span>
                      <span className="text-xs font-bold text-white truncate block">{rumor.fromTeam.name}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center px-2 shrink-0">
                    <span className="text-[9px] font-mono font-black text-amber-400 uppercase">
                      {rumor.subjectDriverName}
                    </span>
                    <ArrowRight className="w-4 h-4 text-rose-400 my-0.5" />
                    <span className="text-[9px] font-mono text-neutral-400">
                      Replaces {rumor.displacedDriverName.split(' ')[1] || rumor.displacedDriverName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 min-w-0 justify-end text-right">
                    <div className="truncate">
                      <span className="text-[9px] uppercase font-bold text-emerald-400 block">
                        Rumored (Tier {rumor.toTeam.performanceTier})
                      </span>
                      <span className="text-xs font-bold text-white truncate block">{rumor.toTeam.name}</span>
                    </div>
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-[10px] shrink-0"
                      style={{ backgroundColor: rumor.toTeam.primaryColor }}
                    >
                      {rumor.toTeam.shortName.substring(0, 3)}
                    </div>
                  </div>
                </div>

                {/* Headline & Story */}
                <div>
                  <h4 className="text-sm sm:text-base font-black text-white leading-snug">
                    {rumor.headline}
                  </h4>
                  {!compact && (
                    <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
                      {rumor.body}
                    </p>
                  )}
                </div>

                {/* Rumored Financial Package */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-neutral-400 block">Rumored Cash/Yr</span>
                    <span className="font-black text-emerald-400">{formatMoney(rumor.rumoredAnnualSalary)}/yr</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-neutral-400 block">Per Grand Prix</span>
                    <span className="font-bold text-cyan-400">{formatMoney(rumor.rumoredSalaryPerRace)}/GP</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-neutral-400 block">Signing Bonus</span>
                    <span className="font-bold text-amber-400">+{formatMoney(rumor.rumoredSigningBonus)}</span>
                  </div>
                </div>

                {/* Expandable Market Logic Explanation */}
                {isLogicExpanded && (
                  <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-[11px] text-rose-200 leading-relaxed">
                    <strong className="text-rose-400 uppercase font-mono block mb-0.5">
                      Why This Rumor Surfaced (Driver Market Logic):
                    </strong>
                    {rumor.marketLogicReason}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => setExpandedLogicId(isLogicExpanded ? null : rumor.id)}
                  className="text-[11px] font-mono font-bold text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-rose-400" />
                  <span>{isLogicExpanded ? 'Hide Market Logic' : 'Why This Rumor?'}</span>
                </button>

                <div className="flex items-center gap-2">
                  {rumor.involvesPlayer && !season.career.isLookingForTeam && onToggleLookingForTeam && (
                    <button
                      type="button"
                      onClick={() => onToggleLookingForTeam(true)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-black text-[11px] uppercase tracking-wider cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Announce Looking for Team</span>
                    </button>
                  )}

                  {onSelectContractTeam ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSelectContractTeam(
                          rumor.involvesPlayer ? rumor.toTeam : rumor.fromTeam
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] uppercase tracking-wider cursor-pointer flex items-center gap-1"
                    >
                      <span>Negotiate Seat</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ) : onNavigateToContracts ? (
                    <button
                      type="button"
                      onClick={onNavigateToContracts}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-[11px] cursor-pointer flex items-center gap-1"
                    >
                      <span>Open Driver Market</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
