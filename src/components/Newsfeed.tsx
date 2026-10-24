import React, { useState, useMemo } from 'react';
import {
  SeasonState,
  NewsCompanyConfig,
  PublishedNewsReport,
} from '../types/racing';
import { CIRCUITS, TEAMS, DRIVERS } from '../constants/f1Data';
import {
  Newspaper,
  TrendingUp,
  Award,
  Users,
  Search,
  Clock,
  ExternalLink,
  ChevronRight,
  Zap,
  Flag,
  Bookmark,
  PenTool,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Send,
  Building2,
  Eye,
} from 'lucide-react';

export interface NewsArticle {
  id: string;
  category: 'race_result' | 'championship' | 'transfer' | 'technical';
  categoryLabel: string;
  categoryColor: string;
  source: string;
  sourceBadge: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  timeAgo: string;
  relatedTeamId?: string;
  relatedDriverId?: string;
  importance: 'breaking' | 'featured' | 'standard';
  readTime: string;
  isPlayerReport?: boolean;
  accuracyScore?: number;
  qualityScore?: number;
  revenueEarned?: number;
  views?: number;
  verdictLabel?: string;
  readerReaction?: string;
  factCheckNotes?: string[];
}

interface NewsfeedProps {
  season: SeasonState;
  onNavigateToTab?: (tab: 'weekend' | 'contracts' | 'myteam' | 'standings' | 'analytics') => void;
  onFoundNewsCompany?: (company: NewsCompanyConfig, startupFee: number) => void;
  onPublishNewsReport?: (report: PublishedNewsReport) => void;
}

export function generatePaddockNews(season: SeasonState): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const completedRounds = season.completedRounds || [];
  const currentRoundIndex = season.currentRound || 0;
  const currentCircuit = CIRCUITS[currentRoundIndex] || CIRCUITS[0];
  const playerDriverId = season.selectedDriverId || 'bearman';
  const playerTeamId = season.selectedTeamId || 'haas';
  const playerDriverName = season.career.driverName || 'Rookie Driver';
  const playerTeamName =
    season.career.customTeam?.name ||
    TEAMS.find((t) => t.id === playerTeamId)?.name ||
    'Haas F1';

  // 0. Prepend player's own published news reports so they appear live in the Paddock Newsfeed
  if (season.career.newsCompany?.publishedReports?.length) {
    const company = season.career.newsCompany;
    company.publishedReports.forEach((rep) => {
      const catMeta = {
        race_result: {
          label: 'Race Report',
          color: 'text-emerald-400',
        },
        championship: {
          label: 'Championship Audit',
          color: 'text-amber-400',
        },
        transfer: {
          label: 'Paddock Market',
          color: 'text-rose-400',
        },
        technical: {
          label: 'Technical Brief',
          color: 'text-cyan-400',
        },
      }[rep.category];

      articles.push({
        id: rep.id,
        category: rep.category,
        categoryLabel: `${catMeta.label} · ${rep.verdictLabel}`,
        categoryColor: catMeta.color,
        source: company.name,
        sourceBadge: company.badgeCode,
        title: rep.title,
        excerpt:
          rep.content.length > 160
            ? `${rep.content.slice(0, 160)}...`
            : rep.content,
        content: rep.content,
        author: `${playerDriverName} (Editor-in-Chief)`,
        timeAgo: `Round ${rep.roundPublished + 1}`,
        importance: rep.overallScore >= 80 ? 'breaking' : 'featured',
        readTime: '2 min read',
        isPlayerReport: true,
        accuracyScore: rep.accuracyScore,
        qualityScore: rep.qualityScore,
        revenueEarned: rep.revenueEarned,
        views: rep.views,
        verdictLabel: rep.verdictLabel,
        readerReaction: rep.readerReaction,
        factCheckNotes: rep.factCheckNotes,
      });
    });
  }

  // 1. Standings Calculation
  const sortedDrivers = Object.entries(season.driverPoints || {})
    .sort((a, b) => b[1] - a[1])
    .map(([id, pts]) => {
      const d = DRIVERS.find((drv) => drv.id === id);
      return {
        id,
        name: id === playerDriverId ? playerDriverName : d?.name || id,
        points: pts,
        teamId: d?.teamId || 'haas',
      };
    });

  const p1Driver = sortedDrivers[0] || {
    id: 'verstappen',
    name: 'Max Verstappen',
    points: 0,
    teamId: 'redbull',
  };
  const p2Driver = sortedDrivers[1] || {
    id: 'norris',
    name: 'Lando Norris',
    points: 0,
    teamId: 'mclaren',
  };
  const playerEntry = sortedDrivers.find((d) => d.id === playerDriverId) || {
    id: playerDriverId,
    name: playerDriverName,
    points: 0,
    teamId: playerTeamId,
  };
  const playerRank = sortedDrivers.findIndex((d) => d.id === playerDriverId) + 1;

  const sortedConstructors = Object.entries(season.constructorPoints || {})
    .sort((a, b) => b[1] - a[1])
    .map(([id, pts]) => {
      const t = TEAMS.find((team) => team.id === id);
      const name =
        season.career.customTeam && id === season.career.customTeam.id
          ? season.career.customTeam.name
          : t?.name || id;
      return { id, name, points: pts };
    });

  const p1Constructor = sortedConstructors[0] || {
    id: 'mclaren',
    name: 'McLaren',
    points: 0,
  };
  const p2Constructor = sortedConstructors[1] || {
    id: 'redbull',
    name: 'Red Bull Racing',
    points: 0,
  };

  // A. RECENT RACE RESULTS & RECAPS
  if (completedRounds.length > 0) {
    const lastResult = completedRounds[completedRounds.length - 1];
    const winnerDriver = DRIVERS.find((d) => d.id === lastResult.winnerDriverId);
    const winnerName =
      lastResult.winnerDriverId === playerDriverId
        ? playerDriverName
        : winnerDriver?.name || 'Max Verstappen';
    const isPlayerWin = lastResult.playerFinishedPosition === 1;
    const isPlayerPodium = lastResult.playerFinishedPosition <= 3;

    if (isPlayerWin) {
      articles.push({
        id: `race_win_${lastResult.round}`,
        category: 'race_result',
        categoryLabel: 'Grand Prix Victory',
        categoryColor: 'text-emerald-400',
        source: 'Sky Sports F1',
        sourceBadge: 'SKY',
        title: `SENSATIONAL WIN: ${playerDriverName} Triumphs at ${lastResult.circuitName} for ${playerTeamName}!`,
        excerpt: `A masterclass in racecraft saw ${playerDriverName} claim the top step of the podium in dramatic fashion, resisting intense pressure from the chasing pack.`,
        content: `In one of the most thrilling races of the 2026 Formula 1 championship, ${playerDriverName} drove a flawless Grand Prix at ${lastResult.circuitName} to take a career-defining victory. Starting strong and managing tire degradation with clinical precision, the ${playerTeamName} driver executed decisive overtakes and built an unassailable lead.`,
        author: 'Martin Brundle',
        timeAgo: 'Just now',
        relatedTeamId: playerTeamId,
        relatedDriverId: playerDriverId,
        importance: 'breaking',
        readTime: '3 min read',
      });
    } else if (isPlayerPodium) {
      articles.push({
        id: `race_podium_${lastResult.round}`,
        category: 'race_result',
        categoryLabel: 'Podium Finish',
        categoryColor: 'text-amber-400',
        source: 'The Race',
        sourceBadge: 'THE RACE',
        title: `PODIUM DRIVE: ${playerDriverName} Seals P${lastResult.playerFinishedPosition} at ${lastResult.circuitName}`,
        excerpt: `${playerTeamName} celebrated on the pit wall as ${playerDriverName} held off relentless challengers to secure a memorable podium finish.`,
        content: `A resilient and tactical display saw ${playerDriverName} clinch P${lastResult.playerFinishedPosition} at ${lastResult.circuitName}. Navigating early chaos and capitalizing on DRS straight-line efficiency, the driver delivered critical championship points for ${playerTeamName}.`,
        author: 'Edd Straw',
        timeAgo: '2 hours ago',
        relatedTeamId: playerTeamId,
        relatedDriverId: playerDriverId,
        importance: 'featured',
        readTime: '2 min read',
      });
    } else {
      articles.push({
        id: `race_recap_${lastResult.round}`,
        category: 'race_result',
        categoryLabel: 'Race Analysis',
        categoryColor: 'text-red-400',
        source: 'Autosport',
        sourceBadge: 'AUTOSPORT',
        title: `${winnerName} Takes Victory at ${lastResult.circuitName}; ${playerDriverName} Finishes P${lastResult.playerFinishedPosition}`,
        excerpt: `High-speed drama unfolded across ${lastResult.circuitName} as ${winnerName} took victory while ${playerTeamName} fought hard in the midfield battle.`,
        content: `${winnerName} showcased relentless race pace to win the ${lastResult.circuitName} Grand Prix. Meanwhile, ${playerDriverName} battled fiercely through traffic to cross the line in P${lastResult.playerFinishedPosition}, collecting vital telemetry data and driver rating points for the championship campaign.`,
        author: 'Jonathan Noble',
        timeAgo: '3 hours ago',
        relatedTeamId:
          lastResult.winnerDriverId === playerDriverId ? playerTeamId : 'redbull',
        importance: 'standard',
        readTime: '3 min read',
      });
    }
  } else {
    articles.push({
      id: 'pre_season_preview',
      category: 'race_result',
      categoryLabel: 'Season Preview',
      categoryColor: 'text-blue-400',
      source: 'BBC Sport F1',
      sourceBadge: 'BBC',
      title: `2026 FORMULA 1 PREVIEW: ${playerDriverName} Prepares for Season Opener at Bahrain`,
      excerpt: `Pre-season testing in Sakhir has concluded. High-downforce floor updates, aggressive sidepod designs, and new power unit upgrades set the stage.`,
      content: `The 2026 FIA Formula 1 World Championship begins at the Bahrain International Circuit. All eyes are on ${playerDriverName} piloting the ${playerTeamName} challenger. With tight regulations and fierce competition from Red Bull, Ferrari, and McLaren, the battle for points promises to be explosive.`,
      author: 'Andrew Benson',
      timeAgo: '1 day ago',
      importance: 'featured',
      readTime: '4 min read',
    });
  }

  // B. CHAMPIONSHIP STANDINGS & TITLE FIGHT STORIES
  const titlePointsGap = p1Driver.points - p2Driver.points;
  articles.push({
    id: `champ_fight_${currentRoundIndex}`,
    category: 'championship',
    categoryLabel: 'Championship Battle',
    categoryColor: 'text-amber-400',
    source: 'The Race',
    sourceBadge: 'THE RACE',
    title: `TITLE FIGHT: ${p1Driver.name} Holds ${titlePointsGap}pt Lead Over ${p2Driver.name}`,
    excerpt: `With ${10 - completedRounds.length} rounds remaining on the calendar, the battle for the FIA World Drivers' Championship is reaching fever pitch.`,
    content: `${p1Driver.name} continues to head the drivers' standings with ${p1Driver.points} points, while ${p2Driver.name} (${p2Driver.points} pts) remains within striking distance. Meanwhile, ${playerDriverName} is currently ranked P${playerRank} with ${playerEntry.points} points.`,
    author: 'Scott Mitchell-Malm',
    timeAgo: '5 hours ago',
    relatedDriverId: p1Driver.id,
    importance: titlePointsGap < 15 ? 'breaking' : 'featured',
    readTime: '3 min read',
  });

  articles.push({
    id: `constructor_standings_${currentRoundIndex}`,
    category: 'championship',
    categoryLabel: "Constructors' Cup",
    categoryColor: 'text-cyan-400',
    source: 'Autosport',
    sourceBadge: 'AUTOSPORT',
    title: `CONSTRUCTORS' WAR: ${p1Constructor.name} (${p1Constructor.points}pts) vs ${p2Constructor.name} (${p2Constructor.points}pts)`,
    excerpt: `Millions in FIA prize money hang in the balance as constructors pour development resources into floor and wing aero upgrades.`,
    content: `The team championship battle is fiercely contested at the front between ${p1Constructor.name} and ${p2Constructor.name}. Further down, ${playerTeamName} is hunting every possible point finish to climb the financial payout bracket before the season finale.`,
    author: 'Luke Smith',
    timeAgo: '6 hours ago',
    relatedTeamId: p1Constructor.id,
    importance: 'standard',
    readTime: '2 min read',
  });

  // C. DRIVER MARKET & TRANSFERS
  articles.push({
    id: 'driver_market_rumors',
    category: 'transfer',
    categoryLabel: 'Driver Market',
    categoryColor: 'text-rose-400',
    source: 'Sky Sports F1',
    sourceBadge: 'SKY',
    title: `SILLY SEASON: Top Teams Keeping Watch on ${playerDriverName}'s Contract Status`,
    excerpt: `Recent performances have prompted discussions up and down the paddock regarding potential buyout clauses.`,
    content: `With ${playerDriverName}'s reputation currently standing at ${season.career.reputation}% and a driver rating of ${season.career.driverRating}, rival team principals are exploring multi-million dollar signing packages.`,
    author: 'Craig Slater',
    timeAgo: '9 hours ago',
    relatedTeamId: 'haas',
    importance: 'featured',
    readTime: '2 min read',
  });

  // D. TECHNICAL & AERODYNAMIC DEBRIEFS
  articles.push({
    id: `tech_debrief_${currentCircuit.id}`,
    category: 'technical',
    categoryLabel: 'Technical Analysis',
    categoryColor: 'text-emerald-400',
    source: 'F1 Technical',
    sourceBadge: 'TECH',
    title: `ENGINEERING DEBRIEF: Downforce vs Top-Speed Setup for ${currentCircuit.name}`,
    excerpt: `Teams prepare low-drag rear wing trims and optimized brake duct cooling ahead of the upcoming Grand Prix weekend.`,
    content: `At ${currentCircuit.name} (${currentCircuit.lengthKm} km, ${currentCircuit.turns} turns), the compromise between straight-line DRS speed and low-speed mechanical grip is critical. Engineers estimate that trail-braking efficiency through Turn 1 can yield up to 0.3s per lap on fresh soft compound tires.`,
    author: 'Giorgio Piola',
    timeAgo: '14 hours ago',
    importance: 'standard',
    readTime: '3 min read',
  });

  return articles;
}

export const Newsfeed: React.FC<NewsfeedProps> = ({
  season,
  onNavigateToTab,
  onFoundNewsCompany,
  onPublishNewsReport,
}) => {
  const [activeSubView, setActiveSubView] = useState<'feed' | 'press_room'>('feed');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

  // Founding News Company Form State
  const [companyNameInput, setCompanyNameInput] = useState('Apex Paddock Gazette');
  const [companyBadgeInput, setCompanyBadgeInput] = useState('APEX');
  const [editorialFocusInput, setEditorialFocusInput] = useState<
    'investigative' | 'technical' | 'insider'
  >('investigative');

  // Writing Report State
  const [reportCategory, setReportCategory] = useState<
    'race_result' | 'championship' | 'transfer' | 'technical'
  >('race_result');
  const [selectedFactClaimId, setSelectedFactClaimId] = useState<string>('verified_1');
  const [reportTitle, setReportTitle] = useState<string>('');
  const [reportContent, setReportContent] = useState<string>('');
  const [lastPublishedResult, setLastPublishedResult] =
    useState<PublishedNewsReport | null>(null);

  const newsCompany = season.career.newsCompany || null;
  const currentCircuit = CIRCUITS[season.currentRound] || CIRCUITS[0];
  const completedRounds = season.completedRounds || [];
  const lastRound =
    completedRounds.length > 0
      ? completedRounds[completedRounds.length - 1]
      : null;

  // Ground-truth paddock facts for fact-checking player articles
  const groundTruth = useMemo(() => {
    const playerDriverId = season.selectedDriverId || 'bearman';
    const playerDriverName = season.career.driverName || 'Rookie Driver';
    const playerTeamId = season.selectedTeamId || 'haas';
    const playerTeamName =
      season.career.customTeam?.name ||
      TEAMS.find((t) => t.id === playerTeamId)?.name ||
      'MoneyGram Haas F1';

    const sortedDrivers = Object.entries(season.driverPoints || {})
      .sort((a, b) => b[1] - a[1])
      .map(([id, pts]) => {
        const d = DRIVERS.find((drv) => drv.id === id);
        return {
          id,
          name: id === playerDriverId ? playerDriverName : d?.name || id,
          points: pts,
        };
      });

    const sortedTeams = Object.entries(season.constructorPoints || {})
      .sort((a, b) => b[1] - a[1])
      .map(([id, pts]) => {
        const t = TEAMS.find((tm) => tm.id === id);
        const name =
          season.career.customTeam && id === season.career.customTeam.id
            ? season.career.customTeam.name
            : t?.name || id;
        return { id, name, points: pts };
      });

    const leaderDriver = sortedDrivers[0] || {
      id: 'verstappen',
      name: 'Max Verstappen',
      points: 0,
    };
    const lastPlaceDriver = sortedDrivers[sortedDrivers.length - 1] || {
      id: 'doohan',
      name: 'Jack Doohan',
      points: 0,
    };

    const leaderTeam = sortedTeams[0] || {
      id: 'mclaren',
      name: 'McLaren',
      points: 0,
    };
    const lastPlaceTeam = sortedTeams[sortedTeams.length - 1] || {
      id: 'alpine',
      name: 'Alpine',
      points: 0,
    };

    const lastWinnerName = lastRound
      ? lastRound.winnerDriverId === playerDriverId
        ? playerDriverName
        : DRIVERS.find((d) => d.id === lastRound.winnerDriverId)?.name ||
          'Max Verstappen'
      : null;

    return {
      playerDriverName,
      playerTeamName,
      playerPoints: season.driverPoints[playerDriverId] || 0,
      playerRating: season.career.driverRating,
      leaderDriver,
      lastPlaceDriver,
      leaderTeam,
      lastPlaceTeam,
      lastWinnerName,
      lastCircuitName: lastRound?.circuitName || currentCircuit.name,
      lastPlayerPos: lastRound?.playerFinishedPosition || null,
      currentCircuit,
    };
  }, [season, lastRound, currentCircuit]);

  // Dynamic Fact Claims (Mix of Verified Truths and False/Fabricated Claims)
  const factClaims = useMemo(() => {
    const gt = groundTruth;
    return [
      {
        id: 'verified_1',
        isTrue: true,
        category: 'race_result',
        label: lastRound
          ? `[FACT] ${gt.lastWinnerName} won the ${gt.lastCircuitName}, while ${gt.playerDriverName} finished P${gt.lastPlayerPos}.`
          : `[FACT] Round 1 opens at ${gt.currentCircuit.name} (${gt.currentCircuit.turns} turns, ${gt.currentCircuit.lengthKm} km) with ${gt.playerDriverName} driving for ${gt.playerTeamName}.`,
        explanation: lastRound
          ? `Verified by FIA Timing: ${gt.lastWinnerName} won ${gt.lastCircuitName} and ${gt.playerDriverName} classified P${gt.lastPlayerPos}.`
          : `Verified by FIA Entry List: Season opens at ${gt.currentCircuit.name} with ${gt.playerDriverName} at ${gt.playerTeamName}.`,
      },
      {
        id: 'verified_2',
        isTrue: true,
        category: 'championship',
        label: `[FACT] ${gt.leaderTeam.name} leads the Constructors' Cup with ${gt.leaderTeam.points} PTS, and ${gt.leaderDriver.name} leads Drivers with ${gt.leaderDriver.points} PTS.`,
        explanation: `Verified by FIA Standings: ${gt.leaderTeam.name} (${gt.leaderTeam.points} PTS) and ${gt.leaderDriver.name} (${gt.leaderDriver.points} PTS) top the championship tables.`,
      },
      {
        id: 'verified_3',
        isTrue: true,
        category: 'technical',
        label: `[FACT] ${gt.currentCircuit.name} features ${gt.currentCircuit.turns} corners over a ${gt.currentCircuit.lengthKm} km layout (Lap Record: ${gt.currentCircuit.lapRecord}).`,
        explanation: `Verified by Pirelli & FIA Track Engineering data for ${gt.currentCircuit.name}.`,
      },
      {
        id: 'false_1',
        isTrue: false,
        category: 'race_result',
        label: lastRound
          ? `[RUMOR / UNVERIFIED] ${gt.lastPlaceDriver.name} won ${gt.lastCircuitName} by 45 seconds after all other 19 cars were disqualified.`
          : `[RUMOR / UNVERIFIED] The FIA secretly canceled ${gt.currentCircuit.name} and awarded 500 bonus points to ${gt.lastPlaceTeam.name}.`,
        explanation: lastRound
          ? `DEBUNKED: ${gt.lastWinnerName} won ${gt.lastCircuitName}, not ${gt.lastPlaceDriver.name}. No mass disqualification occurred.`
          : `DEBUNKED: ${gt.currentCircuit.name} is active on the calendar and no 500-point bonus exists.`,
      },
      {
        id: 'false_2',
        isTrue: false,
        category: 'championship',
        label: `[RUMOR / UNVERIFIED] ${gt.lastPlaceTeam.name} has clinched the Constructors' Championship with 999 points ahead of ${gt.leaderTeam.name}.`,
        explanation: `DEBUNKED: ${gt.lastPlaceTeam.name} has ${gt.lastPlaceTeam.points} points. ${gt.leaderTeam.name} leads with ${gt.leaderTeam.points} points.`,
      },
      {
        id: 'false_3',
        isTrue: false,
        category: 'technical',
        label: `[RUMOR / UNVERIFIED] ${gt.currentCircuit.name} has 62 corners, is 29.4 km long, and mandates V12 engines this weekend.`,
        explanation: `DEBUNKED: ${gt.currentCircuit.name} is ${gt.currentCircuit.lengthKm} km with ${gt.currentCircuit.turns} turns, and 2026 F1 rules mandate 1.6L V6 turbo-hybrids.`,
      },
    ];
  }, [groundTruth, lastRound]);

  // Helper to pre-fill a High-Quality Accurate Draft vs a Bad/Inaccurate Draft
  const fillSampleReport = (type: 'accurate_high_quality' | 'inaccurate_bad') => {
    const gt = groundTruth;
    if (type === 'accurate_high_quality') {
      setSelectedFactClaimId('verified_1');
      setReportCategory(lastRound ? 'race_result' : 'championship');
      if (lastRound) {
        setReportTitle(
          `Paddock Telemetry Audit: How ${gt.lastWinnerName} Conquered ${gt.lastCircuitName} While ${gt.leaderTeam.name} Leads at ${gt.leaderTeam.points} Points`
        );
        setReportContent(
          `Official post-race telemetry from ${gt.lastCircuitName} confirms a decisive victory for ${gt.lastWinnerName}, while ${gt.playerDriverName} brought the ${gt.playerTeamName} car home in P${gt.lastPlayerPos}. Across the ${gt.currentCircuit.turns}-turn circuit, tire degradation and ERS battery deployment proved decisive in the DRS zones. In the championship standings, ${gt.leaderDriver.name} holds P1 with ${gt.leaderDriver.points} points and ${gt.leaderTeam.name} leads the Constructors' Cup on ${gt.leaderTeam.points} points.`
        );
      } else {
        setReportTitle(
          `Technical & Championship Briefing: ${gt.playerDriverName} and ${gt.playerTeamName} Target Points at ${gt.currentCircuit.name}`
        );
        setReportContent(
          `As the paddock assembles at ${gt.currentCircuit.name} (${gt.currentCircuit.lengthKm} km, ${gt.currentCircuit.turns} turns), aerodynamicists are fine-tuning floor downforce and brake balance for the opening round. ${gt.playerDriverName} enters the weekend with a ${gt.playerRating} driver rating for ${gt.playerTeamName}, while ${gt.leaderTeam.name} (${gt.leaderTeam.points} PTS) and ${gt.leaderDriver.name} (${gt.leaderDriver.points} PTS) set the early championship benchmark.`
        );
      }
    } else {
      setSelectedFactClaimId('false_1');
      setReportCategory('race_result');
      setReportTitle(
        `SHOCKING: ${gt.lastPlaceDriver.name} Wins Everything With 999 Points as V12 Engines Return!`
      );
      setReportContent(
        `Sources say ${gt.lastPlaceTeam.name} already has 999 points and won the race by 3 laps after every other car was banned. Also the track is 40km long.`
      );
    }
  };

  // Evaluate and Publish Report
  const handlePublishReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsCompany || !onPublishNewsReport) return;

    const cleanTitle = reportTitle.trim();
    const cleanBody = reportContent.trim();
    if (!cleanTitle || !cleanBody) return;

    const chosenClaim =
      factClaims.find((c) => c.id === selectedFactClaimId) || factClaims[0];
    const combinedText = `${cleanTitle} ${cleanBody}`.toLowerCase();
    const gt = groundTruth;

    let accuracy = chosenClaim.isTrue ? 82 : 22;
    const factCheckNotes: string[] = [chosenClaim.explanation];

    // Free-text fact verification against actual season state
    if (combinedText.includes('999') || combinedText.includes('v12')) {
      accuracy -= 30;
      factCheckNotes.push(
        'Contradiction detected: Fabricated point totals (999) or banned engine specs (V12) cited in text.'
      );
    }

    if (
      combinedText.includes(gt.leaderTeam.name.toLowerCase()) ||
      combinedText.includes(gt.leaderDriver.name.toLowerCase()) ||
      combinedText.includes(gt.currentCircuit.name.toLowerCase())
    ) {
      if (chosenClaim.isTrue) {
        accuracy += 12;
        factCheckNotes.push(
          `Verified references to real paddock entities (${gt.currentCircuit.name} / ${gt.leaderTeam.name}).`
        );
      }
    }

    // Check if player falsely claims a 0-point team has hundreds of points
    if (
      combinedText.includes('banned') ||
      combinedText.includes('disqualified') ||
      combinedText.includes('canceled')
    ) {
      accuracy -= 20;
      factCheckNotes.push(
        'Unverified sensationalist claim: FIA Stewards issued no mass bans or cancellations.'
      );
    }

    if (newsCompany.editorialFocus === 'investigative' && chosenClaim.isTrue) {
      accuracy += 6;
    }

    accuracy = Math.max(5, Math.min(100, Math.round(accuracy)));

    // Editorial Quality Evaluation (Headline, Depth, Motorsport Vocabulary)
    let quality = 25;
    if (cleanTitle.length >= 25 && cleanTitle.length <= 140) {
      quality += 20;
    } else if (cleanTitle.length >= 12) {
      quality += 10;
    } else {
      factCheckNotes.push('Headline is too brief for FIA syndication standards.');
    }

    if (cleanBody.length >= 220) {
      quality += 30;
    } else if (cleanBody.length >= 110) {
      quality += 20;
    } else if (cleanBody.length >= 50) {
      quality += 8;
      factCheckNotes.push(
        'Article body is brief; deeper race analysis increases reader retention.'
      );
    } else {
      quality -= 15;
      factCheckNotes.push(
        'Low-effort report: Article body is far too short for paying subscribers.'
      );
    }

    const f1Keywords = [
      'podium',
      'points',
      'championship',
      'telemetry',
      'downforce',
      'tire',
      'drs',
      'qualifying',
      'strategy',
      'apex',
      'constructor',
      'circuit',
      'turn',
      'pace',
      'overtake',
      'ers',
    ];
    const matchedKeywords = f1Keywords.filter((kw) =>
      combinedText.includes(kw)
    );
    quality += Math.min(25, matchedKeywords.length * 5);

    quality = Math.max(10, Math.min(100, Math.round(quality)));

    // Overall Score weights Accuracy heavily (if it's inaccurate, overall plummets)
    const overallScore =
      accuracy < 50
        ? Math.round(accuracy * 0.65 + quality * 0.2)
        : Math.round(accuracy * 0.58 + quality * 0.42);

    let verdict: PublishedNewsReport['verdict'] = 'mediocre';
    let verdictLabel = 'Mixed Editorial Review';
    let revenueEarned = 0;
    let subscriberDelta = 0;
    let credibilityDelta = 0;
    let views = 0;
    let readerReaction = '';

    const credibilityMultiplier = 0.6 + (newsCompany.credibility / 100) * 0.9;
    const subBaseBonus = Math.round(newsCompany.subscribers * 1.4);

    if (accuracy >= 80 && overallScore >= 78) {
      verdict = 'verified_scoop';
      verdictLabel = 'Verified Gold-Standard Report';
      revenueEarned = Math.round(
        (165000 + overallScore * 2200 + subBaseBonus) * credibilityMultiplier
      );
      subscriberDelta = Math.round(14500 + overallScore * 180);
      credibilityDelta = 8;
      views = Math.round(95000 + newsCompany.subscribers * 3.2);
      readerReaction =
        '"Spot-on telemetry and verified paddock facts! Worth every penny of our premium subscription." — Verified F1 Paddock Reader';
    } else if (accuracy >= 65 && overallScore >= 55) {
      verdict = 'solid_report';
      verdictLabel = 'Accurate Paddock Report';
      revenueEarned = Math.round(
        (55000 + overallScore * 900 + subBaseBonus * 0.5) * credibilityMultiplier
      );
      subscriberDelta = Math.round(4200 + overallScore * 50);
      credibilityDelta = 3;
      views = Math.round(38000 + newsCompany.subscribers * 1.6);
      readerReaction =
        '"Accurate reporting on the standings, though we would love even deeper technical breakdown next round." — Paddock Subscriber';
    } else if (accuracy < 50) {
      // INACCURATE / FAKE NEWS -> Little to no money!
      verdict = 'inaccurate_flop';
      verdictLabel = 'Fact-Check Failed · Demonetized';
      revenueEarned = Math.round(Math.random() * 350); // $0 to $350 (little to no money!)
      subscriberDelta = -Math.min(
        newsCompany.subscribers,
        Math.round(5500 + (50 - accuracy) * 120)
      );
      credibilityDelta = -14;
      views = Math.round(4200);
      readerReaction =
        '"Total fake news! These numbers are completely wrong and contradict official FIA timing. Canceling my subscription!" — Angry F1 Reader';
    } else {
      // Low quality / sloppy writing -> Little to no money!
      verdict = 'mediocre';
      verdictLabel = 'Low-Effort Report · Poor Sales';
      revenueEarned = Math.round(450 + overallScore * 12); // ~$800
      subscriberDelta = -1200;
      credibilityDelta = -5;
      views = 6100;
      readerReaction =
        '"Barely two sentences of analysis. Why pay for a news outlet when there is no substance?" — Disappointed Reader';
    }

    const published: PublishedNewsReport = {
      id: `player_rep_${Date.now()}`,
      title: cleanTitle,
      content: cleanBody,
      category: reportCategory,
      roundPublished: season.currentRound,
      timestamp: Date.now(),
      accuracyScore: accuracy,
      qualityScore: quality,
      overallScore,
      verdict,
      verdictLabel,
      factCheckNotes,
      readerReaction,
      views,
      revenueEarned,
      subscriberDelta,
      credibilityDelta,
    };

    onPublishNewsReport(published);
    setLastPublishedResult(published);
    setReportTitle('');
    setReportContent('');
  };

  const handleFoundCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onFoundNewsCompany) return;
    const cleanName = companyNameInput.trim() || 'Apex Paddock Gazette';
    const cleanBadge =
      (companyBadgeInput.trim() || 'APEX').toUpperCase().slice(0, 8);
    const startupFee = season.career.careerEarnings >= 25000 ? 25000 : 0;

    const newCompany: NewsCompanyConfig = {
      id: `news_co_${Date.now()}`,
      name: cleanName,
      badgeCode: cleanBadge,
      editorialFocus: editorialFocusInput,
      foundedRound: season.currentRound,
      credibility: 72,
      subscribers: 15000,
      totalRevenue: 0,
      publishedReports: [],
    };

    onFoundNewsCompany(newCompany, startupFee);
    setActiveSubView('press_room');
  };

  const articles = useMemo(() => generatePaddockNews(season), [season]);

  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        (selectedCategory === 'my_reports' && art.isPlayerReport) ||
        art.category === selectedCategory;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        art.title.toLowerCase().includes(query) ||
        art.excerpt.toLowerCase().includes(query) ||
        art.content.toLowerCase().includes(query) ||
        art.source.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [articles, selectedCategory, searchQuery]);

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);

  const breakingArticle =
    articles.find((a) => a.importance === 'breaking') || articles[0];

  return (
    <div className="space-y-6">
      {/* 1. Top Header & Mode Switcher (Paddock Wire vs. My News Company Studio) */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
            <Newspaper className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
              <span className="text-red-400 font-bold">FIA Paddock Media Center</span>
              <span aria-hidden="true">·</span>
              <span>
                {newsCompany
                  ? `Owner of ${newsCompany.name} [${newsCompany.badgeCode}]`
                  : 'Independent Media License Available'}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mt-0.5">
              Paddock News & Press Studio
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Read live championship coverage or run your own motorsport news company—accurate, high-quality reports pay top dollar while inaccurate stories make little to nothing.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="flex items-center gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
            <button
              onClick={() => setActiveSubView('feed')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSubView === 'feed'
                  ? 'bg-red-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              <span>Paddock News Wire</span>
            </button>
            <button
              onClick={() => setActiveSubView('press_room')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSubView === 'press_room'
                  ? 'bg-amber-500 text-black font-black'
                  : 'text-amber-300 hover:text-white'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>
                {newsCompany
                  ? `My News Company (${newsCompany.badgeCode})`
                  : 'Start News Company'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. News Company Executive Summary Bar (Always visible if founded) */}
      {newsCompany && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="text-xs text-neutral-400">Your Publication</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-black text-white truncate">
                {newsCompany.name}
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">
                [{newsCompany.badgeCode}]
              </span>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">
              {newsCompany.publishedReports.length} Reports Published
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="text-xs text-neutral-400">Editorial Credibility</div>
            <div className="flex items-baseline justify-between mt-1">
              <span
                className={`text-xl font-mono font-black tabular-nums ${
                  newsCompany.credibility >= 70
                    ? 'text-emerald-400'
                    : newsCompany.credibility >= 45
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {newsCompany.credibility}%
              </span>
              <span className="text-xs font-mono text-neutral-400">
                {newsCompany.credibility >= 75
                  ? 'Trusted Tier-1 Media'
                  : newsCompany.credibility >= 45
                  ? 'Standard Press'
                  : 'Tabloid / Distrusted'}
              </span>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">
              Higher credibility multiplies ad payouts
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="text-xs text-neutral-400">Paid Subscribers</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-mono font-black text-cyan-400 tabular-nums">
                {newsCompany.subscribers.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-neutral-400">Readers</span>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">
              Accurate scoops attract paying readers
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="text-xs text-neutral-400">Total Media Revenue</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-mono font-black text-emerald-400 tabular-nums">
                {formatMoney(newsCompany.totalRevenue)}
              </span>
              <button
                onClick={() =>
                  setActiveSubView(
                    activeSubView === 'press_room' ? 'feed' : 'press_room'
                  )
                }
                className="text-xs font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                {activeSubView === 'press_room' ? 'View Feed' : 'Write Report'}
              </button>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">
              Paid directly into Career Bank Balance
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* VIEW A: MY NEWS COMPANY & PRESS ROOM STUDIO                       */}
      {/* ================================================================= */}
      {activeSubView === 'press_room' && (
        <div className="space-y-6">
          {!newsCompany ? (
            /* FOUND YOUR OWN NEWS COMPANY CARD */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
                <div>
                  <div className="text-xs font-mono text-amber-400 font-bold">
                    FIA Paddock Media Credentialing
                  </div>
                  <h3 className="text-2xl font-black text-white mt-1">
                    Found Your Own Paddock News Company
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Launch an independent Formula 1 media outlet inside the paddock. Write and publish race recaps, championship audits, and technical reports. When your reporting is accurate and well-written, subscribers and sponsors pay handsomely; if your reports are sloppy or factually inaccurate, readers cancel and you earn next to nothing.
                  </p>
                </div>

                <form onSubmit={handleFoundCompanySubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                        Publication / Media Company Name
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={48}
                        value={companyNameInput}
                        onChange={(e) => setCompanyNameInput(e.target.value)}
                        placeholder="e.g. Apex Paddock Gazette"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                        Wire Ticker Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={8}
                        value={companyBadgeInput}
                        onChange={(e) =>
                          setCompanyBadgeInput(e.target.value.toUpperCase())
                        }
                        placeholder="APEX"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-mono uppercase text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-2">
                      Editorial Focus & Revenue Model
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        {
                          id: 'investigative' as const,
                          title: 'Investigative & Fact-Checked',
                          desc: '+6% Accuracy Bonus on verified claims and stronger credibility retention.',
                        },
                        {
                          id: 'technical' as const,
                          title: 'Telemetry & Tech Analysis',
                          desc: 'High subscriber conversion when citing circuit turns, lap records, and aero data.',
                        },
                        {
                          id: 'insider' as const,
                          title: 'Paddock Exclusive Wire',
                          desc: 'Higher viral readership on championship battles and driver contract stories.',
                        },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setEditorialFocusInput(opt.id)}
                          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                            editorialFocusInput === opt.id
                              ? 'bg-neutral-950 border-amber-400 text-white'
                              : 'bg-neutral-950/50 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                          }`}
                        >
                          <div className="text-xs font-bold text-white">
                            {opt.title}
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                            {opt.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-neutral-400">
                      FIA Press Credential Registration Fee:
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {season.career.careerEarnings >= 25000
                        ? '$25,000 (One-Time)'
                        : '$0 (Rookie Press Grant)'}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Launch Paddock News Company</span>
                  </button>
                </form>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="text-xs font-mono text-neutral-400">
                    How Media Monetization Works
                  </div>
                  <h4 className="text-lg font-bold text-white">
                    Accuracy & Quality Drive Your Payouts
                  </h4>
                  <div className="space-y-2.5 text-xs text-neutral-300 leading-relaxed">
                    <p>
                      <strong className="text-emerald-400">
                        1. Verified & Detailed Reports ($150K – $550K+):
                      </strong>{' '}
                      When your report cites accurate race winners, true championship standings, and real circuit specs with detailed analysis, readers subscribe in droves.
                    </p>
                    <p>
                      <strong className="text-red-400">
                        2. Inaccurate or Lazy Reports ($0 – $450):
                      </strong>{' '}
                      If you publish false claims (wrong race winner, fake point totals, wrong circuit data) or write a lazy 3-word blurb, FIA fact-checkers flag your story and you make little to no money.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 text-xs text-neutral-400 font-mono">
                  Starting Subscribers: <strong className="text-white">15,000</strong> · Starting Credibility: <strong className="text-emerald-400">72%</strong>
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE PRESS ROOM EDITOR + LIVE PADDOCK FACT SHEET */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Report Editor */}
              <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-4">
                  <div>
                    <div className="text-xs font-mono text-amber-400">
                      {newsCompany.name} · Editorial Desk
                    </div>
                    <h3 className="text-lg font-black text-white mt-0.5">
                      Write & Publish Paddock News Report
                    </h3>
                  </div>

                  {/* Quick Test / Draft Helpers */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fillSampleReport('accurate_high_quality')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                      title="Auto-fill a detailed, factually accurate article based on current season telemetry"
                    >
                      Draft Verified Scoop
                    </button>
                    <button
                      type="button"
                      onClick={() => fillSampleReport('inaccurate_bad')}
                      className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                      title="Auto-fill an inaccurate rumor to see how fake news gets demonetized"
                    >
                      Draft Inaccurate Tabloid
                    </button>
                  </div>
                </div>

                <form onSubmit={handlePublishReport} className="space-y-4">
                  {/* Step 1: Category Beat */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'race_result' as const, label: 'Race Results' },
                      { id: 'championship' as const, label: 'Standings' },
                      { id: 'transfer' as const, label: 'Driver Market' },
                      { id: 'technical' as const, label: 'Tech & Setup' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setReportCategory(cat.id)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          reportCategory === cat.id
                            ? 'bg-red-600 text-white border-red-500'
                            : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Step 2: Primary Fact Claim Being Reported */}
                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                      Primary Paddock Claim / Lead Angle (Fact-Checked on Publication)
                    </label>
                    <select
                      value={selectedFactClaimId}
                      onChange={(e) => setSelectedFactClaimId(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      {factClaims.map((claim) => (
                        <option key={claim.id} value={claim.id}>
                          {claim.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Choose a verified FIA fact or test how readers react to unverified rumors. Your written headline and article body are also analyzed for accuracy and depth!
                    </p>
                  </div>

                  {/* Step 3: Headline Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-neutral-300">
                        Report Headline
                      </label>
                      <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                        {reportTitle.length} chars (Recommended: 25–120)
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      placeholder="Write a compelling, accurate paddock headline..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Step 4: Full Report Body */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-neutral-300">
                        Full Paddock Report Body
                      </label>
                      <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                        {reportContent.length} chars (Recommended: 120+ chars with F1 telemetry terms)
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      required
                      value={reportContent}
                      onChange={(e) => setReportContent(e.target.value)}
                      placeholder="Write your full motorsport report here. Include verified race results, championship point totals, circuit details, and technical terms (DRS, telemetry, downforce, podium, strategy) to maximize reader payouts..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-xs text-white leading-relaxed focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!reportTitle.trim() || !reportContent.trim()}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Publish Report to Paddock Wire & Collect Revenue</span>
                  </button>
                </form>

                {/* Latest Published Audit Result Receipt */}
                {lastPublishedResult && (
                  <div
                    className={`p-5 rounded-xl border space-y-3 ${
                      lastPublishedResult.verdict === 'verified_scoop' ||
                      lastPublishedResult.verdict === 'solid_report'
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-red-950/25 border-red-500/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {lastPublishedResult.verdict === 'inaccurate_flop' ||
                        lastPublishedResult.verdict === 'mediocre' ? (
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        )}
                        <span className="text-sm font-black text-white">
                          {lastPublishedResult.verdictLabel}
                        </span>
                      </div>

                      <div className="text-base font-mono font-black tabular-nums">
                        <span
                          className={
                            lastPublishedResult.revenueEarned >= 10000
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }
                        >
                          +{formatMoney(lastPublishedResult.revenueEarned)} Earned
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 font-mono text-xs tabular-nums">
                      <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800">
                        <span className="text-[10px] text-neutral-400 block">
                          Fact Accuracy
                        </span>
                        <span
                          className={`font-bold ${
                            lastPublishedResult.accuracyScore >= 70
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {lastPublishedResult.accuracyScore}%
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800">
                        <span className="text-[10px] text-neutral-400 block">
                          Writing Quality
                        </span>
                        <span className="font-bold text-cyan-400">
                          {lastPublishedResult.qualityScore}%
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800">
                        <span className="text-[10px] text-neutral-400 block">
                          Subscriber Change
                        </span>
                        <span
                          className={`font-bold ${
                            lastPublishedResult.subscriberDelta >= 0
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {lastPublishedResult.subscriberDelta >= 0 ? '+' : ''}
                          {lastPublishedResult.subscriberDelta.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800">
                        <span className="text-[10px] text-neutral-400 block">
                          Credibility Shift
                        </span>
                        <span
                          className={`font-bold ${
                            lastPublishedResult.credibilityDelta >= 0
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {lastPublishedResult.credibilityDelta >= 0 ? '+' : ''}
                          {lastPublishedResult.credibilityDelta}%
                        </span>
                      </div>
                    </div>

                    <p className="text-xs italic text-neutral-300">
                      {lastPublishedResult.readerReaction}
                    </p>

                    <div className="space-y-1 pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400 font-mono">
                      {lastPublishedResult.factCheckNotes.map((note, idx) => (
                        <div key={idx}>· {note}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Verified FIA Telemetry & Standings Fact-Sheet */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
                <div>
                  <div className="text-xs font-mono text-emerald-400 font-bold">
                    Official FIA Reference Notebook
                  </div>
                  <h4 className="text-base font-black text-white mt-0.5">
                    Verified Paddock Facts
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1">
                    Use these real-time championship facts in your articles so your reports pass FIA fact-checking with 90%+ accuracy.
                  </p>
                </div>

                <div className="space-y-3 text-xs font-mono tabular-nums">
                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                    <div className="text-[10px] text-neutral-500">
                      LATEST RACE RESULT
                    </div>
                    {lastRound ? (
                      <>
                        <div className="text-white font-bold">
                          Winner: {groundTruth.lastWinnerName}
                        </div>
                        <div className="text-neutral-400">
                          Circuit: {groundTruth.lastCircuitName}
                        </div>
                        <div className="text-cyan-400">
                          Your Finish: P{groundTruth.lastPlayerPos}
                        </div>
                      </>
                    ) : (
                      <div className="text-neutral-300">
                        Season Opener Upcoming: Round 1 at{' '}
                        {groundTruth.currentCircuit.name}
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                    <div className="text-[10px] text-neutral-500">
                      CHAMPIONSHIP LEADERS
                    </div>
                    <div className="text-amber-400 font-bold">
                      P1 Driver: {groundTruth.leaderDriver.name} (
                      {groundTruth.leaderDriver.points} PTS)
                    </div>
                    <div className="text-cyan-400 font-bold">
                      P1 Team: {groundTruth.leaderTeam.name} (
                      {groundTruth.leaderTeam.points} PTS)
                    </div>
                    <div className="text-neutral-400">
                      Your Points: {groundTruth.playerPoints} PTS (Rating:{' '}
                      {groundTruth.playerRating})
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                    <div className="text-[10px] text-neutral-500">
                      CURRENT CIRCUIT SPECS
                    </div>
                    <div className="text-white font-bold">
                      {groundTruth.currentCircuit.name}
                    </div>
                    <div className="text-neutral-400">
                      Length: {groundTruth.currentCircuit.lengthKm} km ·{' '}
                      {groundTruth.currentCircuit.turns} Turns
                    </div>
                    <div className="text-purple-400">
                      Lap Record: {groundTruth.currentCircuit.lapRecord}
                    </div>
                  </div>
                </div>

                {/* Recent Reports Ledger */}
                {newsCompany.publishedReports.length > 0 && (
                  <div className="pt-3 border-t border-neutral-800 space-y-2.5">
                    <div className="text-xs font-bold text-white">
                      Your Published Archive ({newsCompany.publishedReports.length})
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {newsCompany.publishedReports.slice(0, 6).map((rep) => (
                        <div
                          key={rep.id}
                          className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="truncate">
                            <div className="font-semibold text-white truncate">
                              {rep.title}
                            </div>
                            <div className="text-[11px] text-neutral-500 font-mono tabular-nums">
                              Acc {rep.accuracyScore}% · Qual {rep.qualityScore}%
                            </div>
                          </div>
                          <span
                            className={`font-mono font-bold text-xs shrink-0 tabular-nums ${
                              rep.revenueEarned >= 10000
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }`}
                          >
                            +{formatMoney(rep.revenueEarned)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* VIEW B: LIVE PADDOCK NEWS WIRE FEED                               */}
      {/* ================================================================= */}
      {activeSubView === 'feed' && (
        <div className="space-y-6">
          {/* Top Breaking Headline Card */}
          {breakingArticle && selectedCategory === 'all' && !searchQuery && (
            <div
              onClick={() =>
                setExpandedArticleId(
                  expandedArticleId === breakingArticle.id
                    ? null
                    : breakingArticle.id
                )
              }
              className="p-6 rounded-2xl bg-neutral-900 border border-red-500/40 hover:border-red-500 transition-colors cursor-pointer group"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 text-xs text-neutral-400 font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 font-bold">BREAKING WIRE</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-white font-bold">
                    [{breakingArticle.sourceBadge}] {breakingArticle.source}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{breakingArticle.timeAgo}</span>
                </div>
                {breakingArticle.isPlayerReport && (
                  <span className="text-emerald-400 font-bold">
                    Your Report · +{formatMoney(breakingArticle.revenueEarned || 0)}
                  </span>
                )}
              </div>

              <h3 className="text-xl md:text-2xl font-black text-white group-hover:text-red-400 transition-colors leading-tight">
                {breakingArticle.title}
              </h3>

              <p className="text-xs md:text-sm text-neutral-300 mt-2 leading-relaxed">
                {breakingArticle.excerpt}
              </p>

              {expandedArticleId === breakingArticle.id && (
                <div className="mt-4 pt-4 border-t border-neutral-800 text-xs text-neutral-200 leading-relaxed space-y-3">
                  <p>{breakingArticle.content}</p>
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 font-mono">
                    <span>Report by: {breakingArticle.author}</span>
                    <span>{breakingArticle.readTime}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All Stories', icon: Newspaper },
                {
                  id: 'my_reports',
                  label: `My Reports (${
                    newsCompany?.publishedReports?.length || 0
                  })`,
                  icon: PenTool,
                },
                { id: 'race_result', label: 'Race Results', icon: Flag },
                { id: 'championship', label: 'Title Battles', icon: TrendingUp },
                { id: 'transfer', label: 'Driver Market', icon: Users },
                { id: 'technical', label: 'Tech & Setups', icon: Zap },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-red-600 text-white'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full md:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search paddock headlines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Articles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map((article) => {
              const isExpanded = expandedArticleId === article.id;
              const isBookmarked = bookmarkedIds.has(article.id);

              return (
                <div
                  key={article.id}
                  className={`p-5 rounded-2xl bg-neutral-900 border transition-colors flex flex-col justify-between gap-4 ${
                    isExpanded
                      ? 'border-red-500/50'
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div>
                    {/* Unboxed Clean Metadata Header */}
                    <div className="flex items-center justify-between gap-2 mb-2 text-xs text-neutral-400 font-mono">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`font-bold ${article.categoryColor}`}>
                          {article.categoryLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-neutral-300 font-semibold truncate">
                          {article.source}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-neutral-500">{article.timeAgo}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBookmark(article.id);
                        }}
                        className="p-1 text-neutral-500 hover:text-amber-400 transition-colors shrink-0 cursor-pointer"
                        title={isBookmarked ? 'Bookmarked' : 'Save article'}
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 ${
                            isBookmarked ? 'fill-amber-400 text-amber-400' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {/* Title */}
                    <h4
                      onClick={() =>
                        setExpandedArticleId(isExpanded ? null : article.id)
                      }
                      className="font-black text-white text-base hover:text-red-400 transition-colors cursor-pointer leading-snug"
                    >
                      {article.title}
                    </h4>

                    {/* Excerpt */}
                    <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                      {article.excerpt}
                    </p>

                    {/* Player Report Financial & Accuracy Telemetry Strip */}
                    {article.isPlayerReport && (
                      <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                        <div className="flex items-center gap-2 text-neutral-400">
                          <span
                            className={
                              (article.accuracyScore || 0) >= 70
                                ? 'text-emerald-400 font-bold'
                                : 'text-red-400 font-bold'
                            }
                          >
                            Accuracy {article.accuracyScore}%
                          </span>
                          <span>·</span>
                          <span>Quality {article.qualityScore}%</span>
                          <span>·</span>
                          <span>
                            {(article.views || 0).toLocaleString()} reads
                          </span>
                        </div>
                        <span
                          className={`font-bold ${
                            (article.revenueEarned || 0) >= 10000
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          +{formatMoney(article.revenueEarned || 0)}
                        </span>
                      </div>
                    )}

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="mt-3.5 pt-3.5 border-t border-neutral-800 text-xs text-neutral-300 leading-relaxed space-y-2.5">
                        <p>{article.content}</p>
                        {article.readerReaction && (
                          <p className="italic text-neutral-400 pt-1">
                            {article.readerReaction}
                          </p>
                        )}
                        <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] font-mono text-neutral-500">
                          <span>By {article.author}</span>
                          <span>{article.readTime}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Footer */}
                  <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                    <button
                      onClick={() =>
                        setExpandedArticleId(isExpanded ? null : article.id)
                      }
                      className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>{isExpanded ? 'Show Less' : 'Read Full Report'}</span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </button>

                    {article.category === 'championship' && onNavigateToTab && (
                      <button
                        onClick={() => onNavigateToTab('analytics')}
                        className="text-neutral-400 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Analytics Charts</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}

                    {article.category === 'transfer' && onNavigateToTab && (
                      <button
                        onClick={() => onNavigateToTab('contracts')}
                        className="text-neutral-400 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Driver Market</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredArticles.length === 0 && (
            <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
              <Newspaper className="w-8 h-8 text-neutral-600 mx-auto" />
              <h4 className="text-white font-bold text-sm">
                {selectedCategory === 'my_reports'
                  ? 'You Have Not Published Any Reports Yet'
                  : 'No Paddock Stories Found'}
              </h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                {selectedCategory === 'my_reports'
                  ? 'Open your Paddock News Company Press Room to write your first motorsport report and start earning reader revenue.'
                  : `No headlines matched your filter "${searchQuery}".`}
              </p>
              <button
                onClick={() => {
                  if (selectedCategory === 'my_reports') {
                    setActiveSubView('press_room');
                  } else {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {selectedCategory === 'my_reports'
                  ? 'Open Press Room Studio'
                  : 'Reset Filters'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * BreakingNewsTicker
 * A sleek horizontal ticker mounted on the Race Weekend Hub.
 */
export const BreakingNewsTicker: React.FC<{
  season: SeasonState;
  onOpenNewsfeed?: () => void;
}> = ({ season, onOpenNewsfeed }) => {
  const articles = useMemo(() => generatePaddockNews(season), [season]);
  const [headlineIndex, setHeadlineIndex] = useState(0);

  const topHeadlines = useMemo(() => articles.slice(0, 5), [articles]);

  React.useEffect(() => {
    if (topHeadlines.length <= 1) return;
    const interval = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % topHeadlines.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [topHeadlines.length]);

  const currentHeadline = topHeadlines[headlineIndex] || topHeadlines[0];
  if (!currentHeadline) return null;

  return (
    <div
      onClick={onOpenNewsfeed}
      className="p-2.5 px-4 rounded-xl bg-neutral-950/90 border border-red-500/30 hover:border-red-500/60 transition-all flex items-center justify-between gap-3 text-xs cursor-pointer shadow-md group"
      title="Click to open Paddock News & Press Studio"
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <span className="px-2 py-0.5 rounded bg-red-600 text-white font-black text-[10px] tracking-wider uppercase shrink-0">
          PADDOCK WIRE
        </span>
        <span className="text-[11px] text-red-400 font-mono font-bold shrink-0">
          [{currentHeadline.sourceBadge}]
        </span>
        <span className="text-neutral-200 truncate font-semibold group-hover:text-white transition-colors">
          {currentHeadline.title}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-red-400 font-bold shrink-0 text-[11px]">
        <span className="hidden sm:inline">Paddock News</span>
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
};
