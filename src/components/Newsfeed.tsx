import React, { useState, useMemo } from 'react';
import {
  SeasonState,
  NewsCompanyConfig,
  PublishedNewsReport,
  NewsWriterStaff,
  NewsPricingManager,
} from '../types/racing';
import { CIRCUITS, TEAMS, DRIVERS } from '../constants/f1Data';
import {
  Newspaper,
  TrendingUp,
  Users,
  Search,
  ExternalLink,
  ChevronRight,
  Zap,
  Flag,
  Bookmark,
  PenTool,
  CheckCircle,
  AlertTriangle,
  Send,
  Building2,
  Target,
  Loader2,
  Lock,
  UserPlus,
  UserMinus,
  Sparkles,
  FileEdit,
  Trophy,
  DollarSign,
  Sliders,
  Pencil,
  Check,
  X,
} from 'lucide-react';

export const NEWS_COMPANY_STARTUP_COST = 15000000; // $15,000,000 FIA Media Broadcast & Press Syndicate Fee

export const NEWS_WRITER_OPTIONS: NewsWriterStaff[] = [
  {
    id: 'writer_toby',
    name: 'Toby Vance',
    role: 'Junior Paddock Blogger',
    specialty: 'race_result',
    hiringFee: 450000,
    salaryPerReport: 4500,
    accuracyRating: 56,
    writingRating: 60,
    bio: 'Low-cost junior blogger. Writes fast drafts, but frequently mixes up point gaps or exaggerates claims—you should carefully edit what he writes before publishing or risk losing money!',
  },
  {
    id: 'writer_elena',
    name: 'Elena Rossi',
    role: 'Telemetry & Tech Reporter',
    specialty: 'technical',
    hiringFee: 1400000,
    salaryPerReport: 9500,
    accuracyRating: 78,
    writingRating: 76,
    bio: 'Former F2 data engineer who writes grounded technical and race reports. Adding your own championship context to her drafts produces high-scoring scoops.',
  },
  {
    id: 'writer_marcus',
    name: 'Marcus Sterling',
    role: 'Senior F1 Correspondent',
    specialty: 'championship',
    hiringFee: 3200000,
    salaryPerReport: 15000,
    accuracyRating: 89,
    writingRating: 87,
    bio: 'Seasoned paddock journalist with strong factual precision and compelling narrative structure across title fights and driver market stories.',
  },
  {
    id: 'writer_claire',
    name: 'Claire Beaumont',
    role: 'Chief Motorsport Columnist',
    specialty: 'prediction',
    hiringFee: 5800000,
    salaryPerReport: 22000,
    accuracyRating: 96,
    writingRating: 95,
    bio: 'Elite FIA columnist. Crafts razor-sharp race analyses and well-reasoned Grand Prix predictions backed by real car telemetry and standings data.',
  },
];

export const NEWS_PRICING_MANAGER_OPTIONS: NewsPricingManager[] = [
  {
    id: 'pm_liam',
    name: 'Liam Chen',
    role: 'Junior Subscription Analyst',
    hiringFee: 650000,
    salaryPerReport: 3500,
    elasticityProtection: 0.2,
    conversionBonus: 0.12,
    bio: 'Tracks reader price sensitivity and reduces subscriber pushback by 20% when raising subscription fees, while boosting reader sign-ups by +12%.',
  },
  {
    id: 'pm_sofia',
    name: 'Sofia Lindqvist',
    role: 'Senior Media Economist',
    hiringFee: 1850000,
    salaryPerReport: 7500,
    elasticityProtection: 0.38,
    conversionBonus: 0.22,
    bio: 'Former motorsport paywall strategist. Protects against 38% of high-price churn and boosts subscriber conversion by +22% across every published issue.',
  },
  {
    id: 'pm_victor',
    name: 'Victor Vance-Sterling',
    role: 'Chief Monetization Director',
    hiringFee: 4200000,
    salaryPerReport: 12500,
    elasticityProtection: 0.55,
    conversionBonus: 0.35,
    bio: 'World-class media monetization executive. Absorbs 55% of high-price subscriber resistance, adds +35% subscriber growth, and can auto-optimize your subscription price.',
  },
];

export interface CompetitorNewsNetwork {
  id: string;
  name: string;
  badgeCode: string;
  focusLabel: string;
  subscribers: number;
  subscriptionPrice: number;
  credibility: number;
  estRevenuePerIssue: number;
  isPlayer?: boolean;
}

export const RIVAL_NEWS_COMPANIES: CompetitorNewsNetwork[] = [
  {
    id: 'rival_sky',
    name: 'Sky Sports F1 Syndicate',
    badgeCode: 'SKY',
    focusLabel: 'Global Broadcast & Live Paddock',
    subscribers: 385000,
    subscriptionPrice: 14,
    credibility: 94,
    estRevenuePerIssue: 195000,
  },
  {
    id: 'rival_therace',
    name: 'The Race Media Network',
    badgeCode: 'THE RACE',
    focusLabel: 'Championship & Technical Analysis',
    subscribers: 275000,
    subscriptionPrice: 10,
    credibility: 91,
    estRevenuePerIssue: 112000,
  },
  {
    id: 'rival_autosport',
    name: 'Autosport Grand Prix Press',
    badgeCode: 'AUTOSPORT',
    focusLabel: 'Investigative & Historic Telemetry',
    subscribers: 215000,
    subscriptionPrice: 12,
    credibility: 89,
    estRevenuePerIssue: 98000,
  },
  {
    id: 'rival_motorsport',
    name: 'Motorsport.com Global Wire',
    badgeCode: 'MSPORT',
    focusLabel: 'International Paddock Coverage',
    subscribers: 160000,
    subscriptionPrice: 8,
    credibility: 85,
    estRevenuePerIssue: 54000,
  },
  {
    id: 'rival_bbc',
    name: 'BBC Sport F1 Desk',
    badgeCode: 'BBC',
    focusLabel: 'Race Recaps & Driver Features',
    subscribers: 120000,
    subscriptionPrice: 6,
    credibility: 88,
    estRevenuePerIssue: 34000,
  },
  {
    id: 'rival_f1tech',
    name: 'F1 Technical Engineering Review',
    badgeCode: 'TECH',
    focusLabel: 'Aero & Power Unit Telemetry',
    subscribers: 74000,
    subscriptionPrice: 15,
    credibility: 92,
    estRevenuePerIssue: 42000,
  },
  {
    id: 'rival_insider',
    name: 'Pitlane Insider Gazette',
    badgeCode: 'INSIDER',
    focusLabel: 'Driver Transfers & Viral Rumors',
    subscribers: 42000,
    subscriptionPrice: 5,
    credibility: 68,
    estRevenuePerIssue: 12500,
  },
];

export interface NewsArticle {
  id: string;
  category: 'race_result' | 'championship' | 'transfer' | 'technical' | 'prediction';
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
  wasEditedByPlayer?: boolean;
  accuracyScore?: number;
  qualityScore?: number;
  reasoningScore?: number;
  subscriptionPriceUsed?: number;
  operatingCost?: number;
  revenueEarned?: number;
  views?: number;
  verdictLabel?: string;
  readerReaction?: string;
  factCheckNotes?: string[];
  isPrediction?: boolean;
  predictedDriverName?: string;
  predictionType?: 'win' | 'podium' | 'top5';
  predictionTargetCircuitName?: string;
  predictionStatus?: 'pending' | 'correct' | 'incorrect';
  predictionSubscriberShift?: number;
  isViralRumor?: boolean;
  viralRumorStatus?: 'pending' | 'true' | 'false';
  viralRumorPayoutDelta?: number;
  viralRumorSubscriberDelta?: number;
}

interface NewsfeedProps {
  season: SeasonState;
  onNavigateToTab?: (tab: 'weekend' | 'contracts' | 'myteam' | 'standings' | 'analytics') => void;
  onFoundNewsCompany?: (company: NewsCompanyConfig, startupFee: number) => void;
  onUpdateNewsCompany?: (company: NewsCompanyConfig, feeDelta?: number) => void;
  onPublishNewsReport?: (report: PublishedNewsReport) => void;
}

/**
 * Helper to compute the Pricing Manager's recommended optimal subscription price
 * based on current credibility and recent report quality.
 */
export function computeRecommendedSubscriptionPrice(company: NewsCompanyConfig): number {
  const cred = company.credibility || 75;
  const recentReports = company.publishedReports.slice(0, 4);
  const avgScore =
    recentReports.length > 0
      ? recentReports.reduce((sum, r) => sum + r.overallScore, 0) /
        recentReports.length
      : 76;

  // Higher credibility & higher report quality allow charging much higher prices without losing subscribers
  let optimal = 6;
  if (cred >= 90 && avgScore >= 82) optimal = 18;
  else if (cred >= 82 && avgScore >= 75) optimal = 14;
  else if (cred >= 72 && avgScore >= 68) optimal = 10;
  else if (cred >= 55) optimal = 7;
  else optimal = 3; // Low credibility should charge a cheap price to rebuild subscribers!

  if (company.pricingManager) {
    optimal = Math.round(
      optimal * (1 + company.pricingManager.elasticityProtection * 0.45)
    );
  }
  return Math.max(1, Math.min(50, optimal));
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
        prediction: {
          label: 'Grand Prix Prediction',
          color: 'text-purple-400',
        },
      }[rep.category];

      const authorCredit = rep.authorName
        ? rep.wasEditedByPlayer
          ? `${rep.authorName} (Edited by ${playerDriverName})`
          : rep.authorName
        : `${playerDriverName} (Editor-in-Chief)`;

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
        author: authorCredit,
        timeAgo: `Round ${rep.roundPublished + 1}`,
        importance: rep.overallScore >= 80 ? 'breaking' : 'featured',
        readTime: '2 min read',
        isPlayerReport: true,
        wasEditedByPlayer: rep.wasEditedByPlayer,
        accuracyScore: rep.accuracyScore,
        qualityScore: rep.qualityScore,
        reasoningScore: rep.reasoningScore,
        subscriptionPriceUsed: rep.subscriptionPriceUsed,
        operatingCost: rep.operatingCost,
        revenueEarned: rep.revenueEarned,
        views: rep.views,
        verdictLabel: rep.verdictLabel,
        readerReaction: rep.readerReaction,
        factCheckNotes: rep.factCheckNotes,
        isPrediction: rep.isPrediction,
        predictedDriverName: rep.predictedDriverName,
        predictionType: rep.predictionType,
        predictionTargetCircuitName: rep.predictionTargetCircuitName,
        predictionStatus: rep.predictionStatus,
        predictionSubscriberShift: rep.predictionSubscriberShift,
        isViralRumor: rep.isViralRumor,
        viralRumorStatus: rep.viralRumorStatus,
        viralRumorPayoutDelta: rep.viralRumorPayoutDelta,
        viralRumorSubscriberDelta: rep.viralRumorSubscriberDelta,
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

  // =========================================================================
  // POST-SEASON & OFF-SEASON F1 MEDIA COVERAGE (When a season is over or during Winter Off-Season)
  // =========================================================================
  const seasonYear = 2026 + (season.career.seasonNumber || 1) - 1;
  const lastArchivedSeason =
    season.career.seasonHistory && season.career.seasonHistory.length > 0
      ? season.career.seasonHistory[season.career.seasonHistory.length - 1]
      : null;

  if (season.seasonFinished) {
    const seasonWins = completedRounds.filter(
      (r) => r.playerFinishedPosition === 1
    ).length;
    const seasonPodiums = completedRounds.filter(
      (r) => r.playerFinishedPosition <= 3
    ).length;
    const playerGrade =
      playerRank === 1
        ? 'A+ (World Champion)'
        : playerRank <= 3
        ? 'A (Title Contender)'
        : playerRank <= 6
        ? 'B+ (Front-Runner)'
        : playerRank <= 10
        ? 'B (Points Finisher)'
        : 'C+ (Developing Talent)';

    articles.push({
      id: `post_season_champion_${seasonYear}`,
      category: 'championship',
      categoryLabel: `${seasonYear} Post-Season Special`,
      categoryColor: 'text-amber-400',
      source: 'Sky Sports F1 Syndicate',
      sourceBadge: 'SKY',
      title: `SEASON FINALE VERDICT: ${p1Driver.name} Crowned ${seasonYear} FIA Formula 1 World Champion as ${p1Constructor.name} Seals Constructors' Cup!`,
      excerpt: `The chequered flag has fallen on a breathtaking 10-round ${seasonYear} Formula 1 campaign. Here is how the championship was won—and what comes next in the off-season.`,
      content: `After 10 high-intensity Grand Prix weekends, ${p1Driver.name} (${p1Driver.points} PTS) has officially been crowned the ${seasonYear} FIA World Drivers' Champion ahead of ${p2Driver.name} (${p2Driver.points} PTS). In the Constructors' Championship, ${p1Constructor.name} amassed ${p1Constructor.points} points to hold off ${p2Constructor.name} (${p2Constructor.points} PTS) and claim the coveted FIA Column-1 prize purse. Paddock attention now shifts immediately to the FIA Awards Gala, off-season free agency, and winter wind-tunnel development.`,
      author: 'Martin Brundle & Karun Chandhok',
      timeAgo: 'Post-Season Special',
      relatedDriverId: p1Driver.id,
      relatedTeamId: p1Constructor.id,
      importance: 'breaking',
      readTime: '4 min read',
    });

    articles.push({
      id: `post_season_player_review_${seasonYear}`,
      category: 'race_result',
      categoryLabel: 'End-of-Season Driver Report Card',
      categoryColor: 'text-emerald-400',
      source: 'The Race Media Network',
      sourceBadge: 'THE RACE',
      title: `${seasonYear} SEASON REPORT CARD: Grading ${playerDriverName}'s P${playerRank} Campaign (${playerEntry.points} PTS, ${seasonWins} Wins, ${seasonPodiums} Podiums)`,
      excerpt: `Our paddock analysts break down ${playerDriverName}'s full ${seasonYear} telemetry for ${playerTeamName} and award an official end-of-season grade of ${playerGrade}.`,
      content: `Competing for ${playerTeamName} across all 10 rounds of the ${seasonYear} championship, ${playerDriverName} concluded the season ranked P${playerRank} in the World Drivers' Standings with ${playerEntry.points} points, ${seasonWins} Grand Prix victories, and ${seasonPodiums} podium finishes. With a current driver rating of ${season.career.driverRating} and paddock reputation at ${season.career.reputation}%, rival team principals have praised ${playerDriverName}'s racecraft and braking consistency heading into the winter off-season.`,
      author: 'Edd Straw',
      timeAgo: 'Off-Season Analysis',
      relatedDriverId: playerDriverId,
      relatedTeamId: playerTeamId,
      importance: 'featured',
      readTime: '3 min read',
    });

    articles.push({
      id: `post_season_winter_rd_${seasonYear}`,
      category: 'technical',
      categoryLabel: 'Off-Season & Winter Testing',
      categoryColor: 'text-cyan-400',
      source: 'F1 Technical Engineering Review',
      sourceBadge: 'TECH',
      title: `WINTER OFF-SEASON NOTEBOOK: How ${playerTeamName} & Rivals Are Spending Their Wind-Tunnel & Dyno Allocations for ${seasonYear + 1}`,
      excerpt: `The race tracks may be quiet after the Round 10 finale, but factory CFD clusters and power unit dynos in Maranello, Woking, Milton Keynes, and Banbury are running 24/7.`,
      content: `Now that the ${seasonYear} season is officially over, teams have entered the critical off-season development window. Engineers are focusing on underfloor venturi stability, low-drag DRS flap efficiency, and MGU-K thermal recovery ahead of pre-season testing for the ${seasonYear + 1} championship. Open the Off-Season Center in the Season Hub to run winter R&D upgrades or negotiate $0-buyout free-agent contracts before launching ${seasonYear + 1}!`,
      author: 'Giorgio Piola',
      timeAgo: 'Winter Off-Season',
      relatedTeamId: playerTeamId,
      importance: 'featured',
      readTime: '3 min read',
    });
  } else if (lastArchivedSeason && completedRounds.length === 0) {
    articles.push({
      id: `offseason_wrapup_${lastArchivedSeason.year}`,
      category: 'championship',
      categoryLabel: `${lastArchivedSeason.year} Off-Season Retrospective`,
      categoryColor: 'text-amber-400',
      source: 'Autosport Grand Prix Press',
      sourceBadge: 'AUTOSPORT',
      title: `LOOKING BACK AT ${lastArchivedSeason.year}: Can ${playerDriverName} Build on Last Season's P${lastArchivedSeason.finalDriverRank} Finish (${lastArchivedSeason.driverPoints} PTS)?`,
      excerpt: `After a dramatic ${lastArchivedSeason.year} season that saw ${playerDriverName} record ${lastArchivedSeason.wins} wins and ${lastArchivedSeason.podiums} podiums for ${lastArchivedSeason.teamName}, media outlets weigh in on the new ${seasonYear} campaign.`,
      content: `Throughout the winter off-season, pundits have debated the lessons of the ${lastArchivedSeason.year} FIA World Championship. ${playerDriverName} finished P${lastArchivedSeason.finalDriverRank} in the Drivers' standings (${lastArchivedSeason.driverPoints} PTS) while ${lastArchivedSeason.teamName} placed P${lastArchivedSeason.constructorRank} in Constructors (${lastArchivedSeason.constructorPoints} PTS). You can inspect the full round-by-round telemetry from ${lastArchivedSeason.year} anytime in the Performance Analytics tab.`,
      author: 'Jonathan Noble',
      timeAgo: 'Pre-Season Wire',
      importance: 'featured',
      readTime: '3 min read',
    });
  }

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
        source: 'Sky Sports F1 Syndicate',
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
        source: 'The Race Media Network',
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
        source: 'Autosport Grand Prix Press',
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
      source: 'BBC Sport F1 Desk',
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
    source: 'The Race Media Network',
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
    source: 'Autosport Grand Prix Press',
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
    source: 'Sky Sports F1 Syndicate',
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
    source: 'F1 Technical Engineering Review',
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
  onUpdateNewsCompany,
  onPublishNewsReport,
}) => {
  const [activeSubView, setActiveSubView] = useState<
    'feed' | 'press_room' | 'leaderboard'
  >('feed');
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

  // Switch / Rename News Company Anytime State
  const [isRenamingCompany, setIsRenamingCompany] = useState(false);
  const [renameNameInput, setRenameNameInput] = useState('');
  const [renameBadgeInput, setRenameBadgeInput] = useState('');

  // Writing Report, Staff Writer Drafts, Prediction & Viral Rumor State
  const [reportCategory, setReportCategory] = useState<
    'race_result' | 'championship' | 'transfer' | 'technical' | 'prediction'
  >('race_result');
  const [includePrediction, setIncludePrediction] = useState<boolean>(false);
  const [isViralRumor, setIsViralRumor] = useState<boolean>(false);
  const [predictedDriverId, setPredictedDriverId] = useState<string>(
    season.selectedDriverId || 'verstappen'
  );
  const [predictionType, setPredictionType] = useState<'win' | 'podium' | 'top5'>('podium');
  const [reportTitle, setReportTitle] = useState<string>('');
  const [reportContent, setReportContent] = useState<string>('');

  // Hired Writer Drafting & Editing State
  const [selectedWriterId, setSelectedWriterId] = useState<string>('self'); // 'self' = Write My Own
  const [isGeneratingWriterDraft, setIsGeneratingWriterDraft] = useState<boolean>(false);
  const [writerDraftSnapshot, setWriterDraftSnapshot] = useState<{
    writerId: string;
    writerName: string;
    originalTitle: string;
    originalContent: string;
    writerNote: string;
  } | null>(null);

  const [isEvaluatingAI, setIsEvaluatingAI] = useState<boolean>(false);
  const [isScanningOnly, setIsScanningOnly] = useState<boolean>(false);
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);
  const [aiBotReviewResult, setAiBotReviewResult] = useState<{
    accuracyScore: number;
    qualityScore: number;
    reasoningScore: number;
    overallScore: number;
    verdict: PublishedNewsReport['verdict'];
    verdictLabel: string;
    factCheckNotes: string[];
    readerReaction: string;
    reviewedTitle: string;
  } | null>(null);
  const [lastPublishedResult, setLastPublishedResult] =
    useState<PublishedNewsReport | null>(null);

  const newsCompany = season.career.newsCompany || null;
  const hiredWriters = newsCompany?.hiredWriters || [];
  const activePricingManager = newsCompany?.pricingManager || null;
  const subscriptionPrice = newsCompany?.subscriptionPrice ?? 8; // Default $8/mo
  const bankBalance = season.career.careerEarnings || 0;
  const canAffordNewsCompany = bankBalance >= NEWS_COMPANY_STARTUP_COST;
  const currentCircuit = CIRCUITS[season.currentRound] || CIRCUITS[0];
  const completedRounds = season.completedRounds || [];
  const lastRound =
    completedRounds.length > 0
      ? completedRounds[completedRounds.length - 1]
      : null;

  // Recommended Optimal Price (for Pricing Manager)
  const recommendedPrice = useMemo(() => {
    if (!newsCompany) return 8;
    return computeRecommendedSubscriptionPrice(newsCompany);
  }, [newsCompany]);

  // Ranked Leaderboard of Best News Companies (Rivals + Player's Publication)
  const rankedNewsCompanies = useMemo(() => {
    const list: CompetitorNewsNetwork[] = RIVAL_NEWS_COMPANIES.map((r) => ({
      ...r,
      // Slight organic growth as season progresses
      subscribers: r.subscribers + completedRounds.length * 1600,
      estRevenuePerIssue: Math.round(
        (r.subscribers + completedRounds.length * 1600) * r.subscriptionPrice * 0.036
      ),
    }));

    if (newsCompany) {
      const focusMap = {
        investigative: 'Investigative & Standings Desk',
        technical: 'Telemetry & Engineering Desk',
        insider: 'Predictions & Paddock Analyst',
      };
      list.push({
        id: newsCompany.id,
        name: newsCompany.name,
        badgeCode: newsCompany.badgeCode,
        focusLabel: focusMap[newsCompany.editorialFocus],
        subscribers: newsCompany.subscribers,
        subscriptionPrice,
        credibility: newsCompany.credibility,
        estRevenuePerIssue: Math.round(
          newsCompany.subscribers * subscriptionPrice * 0.036
        ),
        isPlayer: true,
      });
    }

    // Sort by Subscribers (primary) and Credibility (secondary)
    return list.sort(
      (a, b) => b.subscribers - a.subscribers || b.credibility - a.credibility
    );
  }, [newsCompany, subscriptionPrice, completedRounds.length]);

  const playerLeaderboardRank = useMemo(() => {
    if (!newsCompany) return null;
    const idx = rankedNewsCompanies.findIndex((c) => c.isPlayer);
    return idx >= 0 ? idx + 1 : null;
  }, [rankedNewsCompanies, newsCompany]);

  // Ground-truth season context sent to the AI Evaluator & Writer Draft Generator on the server
  const seasonTelemetryContext = useMemo(() => {
    const playerDriverId = season.selectedDriverId || 'bearman';
    const playerDriverName = season.career.driverName || 'Rookie Driver';
    const playerTeamId = season.selectedTeamId || 'haas';
    const playerTeamName =
      season.career.customTeam?.name ||
      TEAMS.find((t) => t.id === playerTeamId)?.name ||
      'MoneyGram Haas F1';

    const driversList = DRIVERS.map((d) => {
      const isPlayer = d.id === playerDriverId;
      const t = TEAMS.find((tm) => tm.id === (isPlayer ? playerTeamId : d.teamId));
      return {
        id: d.id,
        name: isPlayer ? `${playerDriverName} (Player)` : d.name,
        team: isPlayer ? playerTeamName : t?.name || d.teamId,
        points: season.driverPoints[d.id] || 0,
        rating: isPlayer ? season.career.driverRating : d.rating,
      };
    }).sort((a, b) => b.points - a.points);

    const constructorsList = Object.entries(season.constructorPoints || {})
      .map(([id, pts]) => {
        const t = TEAMS.find((tm) => tm.id === id);
        const name =
          season.career.customTeam && id === season.career.customTeam.id
            ? season.career.customTeam.name
            : t?.name || id;
        return {
          id,
          name,
          points: pts,
          engine:
            season.career.customTeam && id === season.career.customTeam.id
              ? season.career.customTeam.engine
              : t?.engine || 'V6 Turbo',
          carProfile: t?.carProfile || null,
        };
      })
      .sort((a, b) => b.points - a.points);

    const recentRaces = completedRounds.map((r) => {
      const winDrv =
        r.winnerDriverId === playerDriverId
          ? playerDriverName
          : DRIVERS.find((d) => d.id === r.winnerDriverId)?.name ||
            r.winnerDriverId;
      return {
        round: r.round + 1,
        circuitName: r.circuitName,
        winner: winDrv,
        playerFinishedPosition: r.playerFinishedPosition,
      };
    });

    return {
      seasonNumber: season.career.seasonNumber || 1,
      currentRoundNumber: season.currentRound + 1,
      upcomingCircuit: {
        name: currentCircuit.name,
        location: currentCircuit.location,
        lengthKm: currentCircuit.lengthKm,
        turns: currentCircuit.turns || 15,
        lapRecord: currentCircuit.lapRecord,
        description: currentCircuit.description,
      },
      playerProfile: {
        name: playerDriverName,
        team: playerTeamName,
        driverRating: season.career.driverRating,
        reputation: season.career.reputation,
        wins: season.career.wins,
        podiums: season.career.podiums,
        points: season.driverPoints[playerDriverId] || 0,
      },
      topDriversStandings: driversList.slice(0, 12),
      constructorsStandings: constructorsList,
      completedRacesHistory: recentRaces,
    };
  }, [season, completedRounds, currentCircuit]);

  // All selectable drivers for predictions
  const selectableDrivers = useMemo(() => {
    const playerDriverId = season.selectedDriverId || 'bearman';
    return DRIVERS.map((d) => {
      const isPlayer = d.id === playerDriverId;
      const name = isPlayer
        ? `${season.career.driverName} (YOU)`
        : d.name;
      const pts = season.driverPoints[d.id] || 0;
      const rating = isPlayer ? season.career.driverRating : d.rating;
      return {
        id: d.id,
        name,
        rawName: isPlayer ? season.career.driverName : d.name,
        points: pts,
        rating,
      };
    }).sort((a, b) => b.points - a.points || b.rating - a.rating);
  }, [season]);

  // Switch / Rename News Company Anytime Handler
  const handleSaveCompanyRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newsCompany || !onUpdateNewsCompany) return;
    const cleanName = renameNameInput.trim() || newsCompany.name;
    const cleanBadge = (renameBadgeInput.trim() || newsCompany.badgeCode)
      .toUpperCase()
      .slice(0, 8);

    onUpdateNewsCompany(
      {
        ...newsCompany,
        name: cleanName,
        badgeCode: cleanBadge,
      },
      0
    );
    setIsRenamingCompany(false);
  };

  // Change Subscription Price Handler ($1 to $50)
  const handleSubscriptionPriceChange = (newPrice: number) => {
    if (!newsCompany || !onUpdateNewsCompany) return;
    const clamped = Math.max(1, Math.min(50, Math.round(newPrice)));
    onUpdateNewsCompany(
      {
        ...newsCompany,
        subscriptionPrice: clamped,
      },
      0
    );
  };

  // Hire or Fire Pricing Manager
  const handleHirePricingManager = (pm: NewsPricingManager) => {
    if (!newsCompany || !onUpdateNewsCompany) return;
    if (bankBalance < pm.hiringFee) return;
    const nextOptimal = computeRecommendedSubscriptionPrice({
      ...newsCompany,
      pricingManager: pm,
    });
    onUpdateNewsCompany(
      {
        ...newsCompany,
        pricingManager: pm,
        subscriptionPrice: newsCompany.autoOptimizePrice
          ? nextOptimal
          : newsCompany.subscriptionPrice ?? 8,
      },
      pm.hiringFee
    );
  };

  const handleFirePricingManager = () => {
    if (!newsCompany || !onUpdateNewsCompany) return;
    onUpdateNewsCompany(
      {
        ...newsCompany,
        pricingManager: null,
        autoOptimizePrice: false,
      },
      0
    );
  };

  const handleToggleAutoOptimizePrice = () => {
    if (!newsCompany || !onUpdateNewsCompany || !activePricingManager) return;
    const nextAuto = !newsCompany.autoOptimizePrice;
    onUpdateNewsCompany(
      {
        ...newsCompany,
        autoOptimizePrice: nextAuto,
        subscriptionPrice: nextAuto
          ? recommendedPrice
          : newsCompany.subscriptionPrice ?? 8,
      },
      0
    );
  };

  // Hire or Fire a Journalist Writer
  const handleHireWriter = (writer: NewsWriterStaff) => {
    if (!newsCompany || !onUpdateNewsCompany) return;
    if (hiredWriters.some((w) => w.id === writer.id)) return;
    if (bankBalance < writer.hiringFee) return;

    const updatedCompany: NewsCompanyConfig = {
      ...newsCompany,
      hiredWriters: [...hiredWriters, writer],
    };
    onUpdateNewsCompany(updatedCompany, writer.hiringFee);
    setSelectedWriterId(writer.id);
  };

  const handleFireWriter = (writerId: string) => {
    if (!newsCompany || !onUpdateNewsCompany) return;
    const updatedCompany: NewsCompanyConfig = {
      ...newsCompany,
      hiredWriters: hiredWriters.filter((w) => w.id !== writerId),
    };
    onUpdateNewsCompany(updatedCompany, 0);
    if (selectedWriterId === writerId) {
      setSelectedWriterId('self');
    }
    if (writerDraftSnapshot?.writerId === writerId) {
      setWriterDraftSnapshot(null);
    }
  };

  // Ask a Hired Writer to Draft an Article (Player can then view & edit what they wrote!)
  const handleGenerateWriterDraft = async (writer: NewsWriterStaff) => {
    if (isGeneratingWriterDraft) return;
    setIsGeneratingWriterDraft(true);
    setAiErrorMsg(null);

    const activeIsPrediction =
      reportCategory === 'prediction' || includePrediction;
    const targetDrv = selectableDrivers.find((d) => d.id === predictedDriverId);
    const predictedTargetText =
      activeIsPrediction && targetDrv
        ? `${targetDrv.rawName} to finish ${
            predictionType === 'win'
              ? 'P1 (Race Winner)'
              : predictionType === 'podium'
              ? 'on the Podium (Top 3)'
              : 'in the Top 5'
          } at ${currentCircuit.name}`
        : undefined;

    try {
      const response = await fetch('/api/news/writer-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          writer,
          category: reportCategory,
          isPrediction: activeIsPrediction,
          predictedTarget: predictedTargetText,
          predictionOutcomeType: predictionType,
          seasonContext: seasonTelemetryContext,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.draft) {
        throw new Error(data.error || 'Failed to generate writer draft.');
      }

      const { title, content, writerNote } = data.draft;
      setReportTitle(title || '');
      setReportContent(content || '');
      setWriterDraftSnapshot({
        writerId: writer.id,
        writerName: writer.name,
        originalTitle: title || '',
        originalContent: content || '',
        writerNote:
          writerNote ||
          `Drafted by ${writer.name} (${writer.role}). Review and edit before publishing!`,
      });
    } catch {
      const p1 = seasonTelemetryContext.topDriversStandings[0];
      const p2 = seasonTelemetryContext.topDriversStandings[1];
      const c1 = seasonTelemetryContext.constructorsStandings[0];
      const isLowAccuracy = writer.accuracyRating < 65;

      let fallbackTitle = '';
      let fallbackContent = '';
      let fallbackNote = '';

      if (activeIsPrediction && targetDrv) {
        fallbackTitle = isLowAccuracy
          ? `guaranteed lock: ${targetDrv.rawName} will easily crush everyone at ${currentCircuit.name}`
          : `Telemetry Forecast: Why ${targetDrv.rawName} Is Poised for a ${predictionType.toUpperCase()} Finish at ${currentCircuit.name}`;
        fallbackContent = isLowAccuracy
          ? `${targetDrv.rawName} is 100% going to finish ${predictionType} at ${currentCircuit.name}. Even though the track has 45 corners and they already have 999 points this season, their car is basically a rocket ship. No other reasons needed.`
          : `Heading into Round ${season.currentRound + 1} at ${currentCircuit.name} (${currentCircuit.lengthKm} km, ${currentCircuit.turns} turns), ${targetDrv.rawName} carries a driver rating of ${targetDrv.rating} and ${targetDrv.points} championship points. Because ${currentCircuit.name} rewards balanced aerodynamic efficiency and clean trail-braking through its ${currentCircuit.turns} corners, their current pace and tire management give them a strong statistical edge to secure a ${predictionType} result.`;
        fallbackNote = isLowAccuracy
          ? `Toby Vance: "Boss, I threw together a quick prediction draft—might want to check the corner count and point stats before publishing!"`
          : `${writer.name}: "I compiled the circuit telemetry and driver rating data for your ${currentCircuit.name} prediction. Feel free to edit or add your own insights!"`;
      } else {
        fallbackTitle = isLowAccuracy
          ? `Shocking Paddock Rumor: Championship Standings Turned Upside Down Before ${currentCircuit.name}`
          : `${p1?.name || 'Championship Leader'} Leads Standings With ${p1?.points || 0} Points Ahead of ${currentCircuit.name}`;
        fallbackContent = isLowAccuracy
          ? `Everyone in the paddock is talking about how ${p2?.name || 'the midfield'} is already 500 points ahead in the championship while ${c1?.name || 'McLaren'} has zero points. The upcoming race at ${currentCircuit.name} should be wild.`
          : `As the 2026 FIA Formula 1 Championship arrives at ${currentCircuit.name} (${currentCircuit.lengthKm} km, ${currentCircuit.turns} corners), ${p1?.name} leads the Drivers' Championship on ${p1?.points} points ahead of ${p2?.name} (${p2?.points} pts). In the Constructors' Cup, ${c1?.name} holds P1 with ${c1?.points} points thanks to consistent aerodynamic upgrades and strong race execution.`;
        fallbackNote = isLowAccuracy
          ? `Toby Vance: "Here's my quick draft! I didn't double-check the FIA standings table, so you should probably edit the numbers!"`
          : `${writer.name}: "Draft complete using official Round ${season.currentRound + 1} standings. You can edit any lines or publish when ready."`;
      }

      setReportTitle(fallbackTitle);
      setReportContent(fallbackContent);
      setWriterDraftSnapshot({
        writerId: writer.id,
        writerName: writer.name,
        originalTitle: fallbackTitle,
        originalContent: fallbackContent,
        writerNote: fallbackNote,
      });
    } finally {
      setIsGeneratingWriterDraft(false);
    }
  };

  // Calculate per-report operating cost (Base press wire fee + active writer payroll + pricing manager salary)
  const currentOperatingCost = useMemo(() => {
    const baseDistributionCost = 6500; // $6,500 FIA press wire & syndicate distribution
    const writersPayroll = hiredWriters.reduce(
      (sum, w) => sum + w.salaryPerReport,
      0
    );
    const managerSalary = activePricingManager
      ? activePricingManager.salaryPerReport
      : 0;
    return baseDistributionCost + writersPayroll + managerSalary;
  }, [hiredWriters, activePricingManager]);

  // Local Client-Side Telemetry Auditor (Guaranteed instant fallback matching server auditReportAgainstTelemetry)
  const runLocalTelemetryAudit = (
    titleText: string,
    bodyText: string,
    activeIsPrediction: boolean,
    predictedTargetText?: string
  ) => {
    const fullText = `${titleText} ${bodyText}`.trim();
    const lowerText = fullText.toLowerCase();
    const words = fullText
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const wordCount = words.length;
    const notes: string[] = [];

    const vowelCount = (lowerText.match(/[aeiouy]/g) || []).length;
    const alphaCount = (lowerText.match(/[a-z]/g) || []).length;
    const vowelRatio = alphaCount > 0 ? vowelCount / alphaCount : 0;
    const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
    const uniqueRatio = wordCount > 0 ? uniqueWords / wordCount : 0;

    if (
      alphaCount < 6 ||
      vowelRatio < 0.14 ||
      vowelRatio > 0.78 ||
      (wordCount >= 10 && uniqueRatio < 0.3)
    ) {
      return {
        accuracy: 12,
        quality: 10,
        reasoning: 8,
        overallScore: 11,
        verdict: 'inaccurate_flop' as PublishedNewsReport['verdict'],
        verdictLabel: 'Unintelligible / Spam Report Rejected',
        factCheckNotes: [
          'AI Editor Bot detected gibberish, repetitive filler, or non-motorsport text.',
          'Reports must contain coherent Formula 1 journalism and factual analysis.',
        ],
        readerReaction:
          '"Is this a typo? Unsubscribing immediately until real F1 journalism returns." — Angry Paddock Subscriber',
      };
    }

    let accuracy = 82;
    let contradictions = 0;
    let verifiedFacts = 0;

    const matchedDrivers = selectableDrivers.filter((d) =>
      d.rawName
        .toLowerCase()
        .split(' ')
        .filter((p) => p.length >= 3)
        .some((p) => lowerText.includes(p))
    );
    const matchedTeams = seasonTelemetryContext.constructorsStandings.filter((c) =>
      c.name
        .toLowerCase()
        .split(' ')
        .filter((p) => p.length >= 3 && p !== 'team' && p !== 'racing')
        .some((p) => lowerText.includes(p))
    );

    if (matchedDrivers.length > 0 || matchedTeams.length > 0) {
      verifiedFacts += 1;
      accuracy += 6;
      const subj = [
        ...matchedDrivers.map((d) => d.rawName),
        ...matchedTeams.map((t) => t.name),
      ].slice(0, 3);
      notes.push(`AI Bot verified official 2026 paddock subjects: ${subj.join(', ')}.`);
    }

    if (activeIsPrediction && predictedTargetText) {
      verifiedFacts += 1;
      notes.push(`Prediction target locked & audited: ${predictedTargetText}.`);
    }

    if (
      lowerText.includes('999 points') ||
      lowerText.includes('500 points') ||
      lowerText.includes('1000 points') ||
      lowerText.includes('45 corners') ||
      lowerText.includes('100 corners')
    ) {
      contradictions += 2;
      accuracy -= 48;
      notes.push(
        'FACT CHECK FAILURE: Article cites impossible or fabricated championship points/circuit corner numbers that contradict FIA telemetry.'
      );
    }

    const p1Driver = seasonTelemetryContext.topDriversStandings[0];
    if (
      p1Driver &&
      p1Driver.points > 0 &&
      (lowerText.includes('leads the championship') ||
        lowerText.includes('leading the championship') ||
        lowerText.includes('championship leader'))
    ) {
      const p1Clean = p1Driver.name.replace(' (Player)', '').toLowerCase();
      if (p1Clean.split(' ').some((p) => p.length >= 3 && lowerText.includes(p))) {
        verifiedFacts += 1;
        accuracy += 10;
        notes.push(
          `Verified championship leader claim: ${p1Driver.name.replace(' (Player)', '')} (${p1Driver.points} PTS).`
        );
      } else if (matchedDrivers.length > 0 && matchedDrivers[0].points < p1Driver.points) {
        contradictions += 1;
        accuracy -= 32;
        notes.push(
          `STANDINGS DISCREPANCY: ${p1Driver.name.replace(' (Player)', '')} actually leads with ${p1Driver.points} PTS.`
        );
      }
    }

    const causalWords = [
      'because', 'due to', 'thanks to', 'since', 'therefore', 'thus', 'allows', 'enables',
      'advantage', 'edge', 'reason', 'factor', 'key', 'crucial', 'given', 'proven',
      'consistent', 'momentum', 'suits', 'rewards', 'with', 'has', 'have', 'strong',
      'superior', 'better', 'best', 'fastest', 'faster', 'great', 'good', 'dominant', 'will',
    ];
    const racingWords = [
      'aero', 'aerodynamic', 'downforce', 'drag', 'speed', 'fast', 'fastest', 'quick',
      'car', 'drs', 'brake', 'brakes', 'braking', 'corner', 'corners', 'turn', 'turns',
      'tire', 'tires', 'tyre', 'grip', 'traction', 'pace', 'qualifying', 'podium',
      'win', 'won', 'winner', 'victory', 'lead', 'leader', 'first', 'p1', 'p2', 'p3',
      'points', 'standings', 'championship', 'rating', 'engine', 'power', 'chassis',
      'overtake', 'pass', 'sector', 'straight', 'setup', 'strategy', 'pit', 'telemetry',
      'upgrade', 'driver', 'team', 'race', 'track', 'circuit', 'lap', 'grid', 'pole',
    ];

    const matchedCausal = causalWords.filter((k) => lowerText.includes(k));
    const matchedRacing = racingWords.filter((k) => lowerText.includes(k));
    const refusesReasons =
      lowerText.includes('no other reasons') ||
      lowerText.includes('no reasons needed') ||
      lowerText.includes('idk why');

    let quality = 68;
    if (wordCount < 4) {
      quality = 28;
      accuracy = Math.min(accuracy, 48);
      notes.push('Article is far too brief (< 4 words). Write at least a complete sentence.');
    } else if (wordCount < 9) {
      quality = Math.min(85, 58 + matchedRacing.length * 6 + verifiedFacts * 5);
    } else {
      quality = Math.min(
        97,
        68 + Math.min(16, Math.floor(wordCount / 3)) + Math.min(16, matchedRacing.length * 4)
      );
    }

    let reasoning = 65;
    if (refusesReasons) {
      reasoning = 20;
      quality = Math.min(quality, 40);
      notes.push('WEAK REASONING: Author dismissed the need for analytical reasons.');
    } else {
      reasoning = Math.min(
        98,
        54 +
          matchedCausal.length * 9 +
          matchedRacing.length * 6 +
          (wordCount >= 14 ? 10 : 0) +
          (verifiedFacts > 0 ? 8 : 0)
      );
    }

    if (matchedRacing.length >= 1 && !refusesReasons) {
      notes.push(`AI Bot verified motorsport analysis (${matchedRacing.slice(0, 5).join(', ')}).`);
    }

    accuracy = Math.max(10, Math.min(98, Math.round(accuracy + (verifiedFacts >= 2 ? 6 : 0))));
    quality = Math.max(10, Math.min(98, Math.round(quality)));
    reasoning = Math.max(10, Math.min(98, Math.round(reasoning)));

    const overallScore =
      accuracy < 50
        ? Math.round(accuracy * 0.6 + quality * 0.2 + reasoning * 0.2)
        : Math.round(accuracy * 0.42 + quality * 0.28 + reasoning * 0.3);

    let verdict: PublishedNewsReport['verdict'] = 'solid_report';
    let verdictLabel = 'Accurate & Solid Paddock Report';
    let readerReaction =
      '"Good factual reporting on the championship situation, looking forward to the race." — Paddock Subscriber';

    if (contradictions > 0 || accuracy < 50) {
      verdict = 'inaccurate_flop';
      verdictLabel = 'Debunked / Inaccurate Report';
      readerReaction =
        '"These stats contradict official FIA timing screens! Check your facts before publishing!" — Disappointed Subscriber';
    } else if (accuracy >= 74 && quality >= 70 && reasoning >= 68) {
      verdict = 'verified_scoop';
      verdictLabel = activeIsPrediction
        ? 'Compelling & Well-Reasoned Prediction'
        : 'Verified Tier-1 Paddock Scoop';
      readerReaction =
        '"Spot-on telemetry analysis and rock-solid reasoning—worth every penny of my subscription!" — VIP Paddock Reader';
    } else if (accuracy >= 62 && quality >= 52 && reasoning >= 50) {
      verdict = 'solid_report';
      verdictLabel = 'Accurate & Solid Paddock Report';
    } else {
      verdict = 'mediocre';
      verdictLabel = 'Brief Report / Add More Racing Detail';
      readerReaction =
        '"True enough, though adding more technical detail would make it even better." — Paddock Reader';
    }

    if (notes.length === 0) {
      notes.push('Audited by AI Editor Bot against 2026 FIA World Championship standings and circuit telemetry.');
    }

    return {
      accuracy,
      quality,
      reasoning,
      overallScore,
      verdict,
      verdictLabel,
      factCheckNotes: notes.slice(0, 4),
      readerReaction,
    };
  };

  // Shared AI Editor Bot Evaluation Helper (used by both "Scan with AI Bot" and "Publish")
  const evaluateArticleWithAIBot = async () => {
    const rawTitle = reportTitle.trim();
    const rawBody = reportContent.trim();
    const cleanTitle =
      rawTitle ||
      (rawBody.length > 60
        ? `${rawBody.slice(0, 56).trim()}...`
        : rawBody || `Paddock Report: ${currentCircuit.name}`);
    const cleanBody = rawBody || rawTitle;

    const activeIsPrediction =
      reportCategory === 'prediction' || includePrediction;
    const targetDrv = selectableDrivers.find((d) => d.id === predictedDriverId);
    const predictedTargetText =
      activeIsPrediction && targetDrv
        ? `${targetDrv.rawName} to finish ${
            predictionType === 'win'
              ? 'P1 (Race Winner)'
              : predictionType === 'podium'
              ? 'on the Podium (Top 3)'
              : 'in the Top 5'
          } at ${currentCircuit.name}`
        : undefined;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2800);
      const response = await fetch('/api/news/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          title: cleanTitle,
          content: cleanBody,
          category: reportCategory,
          isPrediction: activeIsPrediction,
          predictedTarget: predictedTargetText,
          predictionOutcomeType: predictionType,
          seasonContext: seasonTelemetryContext,
        }),
      });
      clearTimeout(timer);

      const data = await response.json();
      if (!response.ok || !data.success || !data.evaluation) {
        throw new Error(data.error || 'Fallback to local AI telemetry auditor');
      }

      const ev = data.evaluation;
      const accuracy = Math.max(0, Math.min(100, Number(ev.accuracyScore ?? 80)));
      const quality = Math.max(0, Math.min(100, Number(ev.qualityScore ?? 78)));
      const reasoning = Math.max(0, Math.min(100, Number(ev.reasoningScore ?? 76)));
      const overallScore =
        accuracy < 50
          ? Math.round(accuracy * 0.6 + quality * 0.2 + reasoning * 0.2)
          : Math.round(accuracy * 0.42 + quality * 0.28 + reasoning * 0.3);

      let verdict: PublishedNewsReport['verdict'] = 'solid_report';
      const rawVerdict = String(ev.verdict || '');
      if (
        rawVerdict === 'verified_scoop' ||
        rawVerdict === 'solid_report' ||
        rawVerdict === 'mediocre' ||
        rawVerdict === 'inaccurate_flop'
      ) {
        verdict = rawVerdict;
      } else if (accuracy < 50) {
        verdict = 'inaccurate_flop';
      } else if (accuracy >= 74 && (quality >= 70 || reasoning >= 68)) {
        verdict = 'verified_scoop';
      } else if (accuracy >= 60 && quality >= 52) {
        verdict = 'solid_report';
      } else {
        verdict = 'mediocre';
      }

      return {
        cleanTitle,
        cleanBody,
        activeIsPrediction,
        targetDrv,
        accuracy,
        quality,
        reasoning,
        overallScore,
        verdict,
        verdictLabel: ev.verdictLabel || 'FIA AI Editorial Audit',
        factCheckNotes: Array.isArray(ev.factCheckNotes)
          ? ev.factCheckNotes
          : ['Evaluated against 2026 FIA Championship telemetry.'],
        readerReaction:
          ev.readerReaction ||
          '"Interesting analysis from the paddock press room." — F1 Reader',
      };
    } catch {
      const localAudit = runLocalTelemetryAudit(
        cleanTitle,
        cleanBody,
        activeIsPrediction,
        predictedTargetText
      );
      return {
        cleanTitle,
        cleanBody,
        activeIsPrediction,
        targetDrv,
        ...localAudit,
      };
    }
  };

  // Pre-Publish AI Bot Scan Handler ("Scan & Review Article with AI Bot")
  const handleScanArticleWithAIBot = async () => {
    if (isEvaluatingAI || isScanningOnly) return;
    if (!reportTitle.trim() && !reportContent.trim()) {
      setAiErrorMsg('Write a headline or article (or have a hired writer draft one) before scanning with the AI Bot.');
      return;
    }

    setIsScanningOnly(true);
    setAiErrorMsg(null);
    const evaluated = await evaluateArticleWithAIBot();
    if (!reportTitle.trim() && evaluated.cleanTitle) {
      setReportTitle(evaluated.cleanTitle);
    }
    if (!reportContent.trim() && evaluated.cleanBody) {
      setReportContent(evaluated.cleanBody);
    }
    setAiBotReviewResult({
      accuracyScore: evaluated.accuracy,
      qualityScore: evaluated.quality,
      reasoningScore: evaluated.reasoning,
      overallScore: evaluated.overallScore,
      verdict: evaluated.verdict,
      verdictLabel: evaluated.verdictLabel,
      factCheckNotes: evaluated.factCheckNotes,
      readerReaction: evaluated.readerReaction,
      reviewedTitle: evaluated.cleanTitle,
    });
    setIsScanningOnly(false);
  };

  // Evaluate and Publish Report using Server-Side Gemini AI + Telemetry Auditor
  const handlePublishReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsCompany || !onPublishNewsReport || isEvaluatingAI || isScanningOnly) return;
    if (!reportTitle.trim() && !reportContent.trim()) {
      setAiErrorMsg('Please enter a headline or article body before publishing.');
      return;
    }

    setIsEvaluatingAI(true);
    setAiErrorMsg(null);

    const evaluated = await evaluateArticleWithAIBot();
    const {
      cleanTitle,
      cleanBody,
      activeIsPrediction,
      targetDrv,
      accuracy,
      quality,
      reasoning,
      overallScore,
      verdictLabel,
      readerReaction,
    } = evaluated;
    let verdict = evaluated.verdict;
    const factCheckNotes = [...evaluated.factCheckNotes];

    setAiBotReviewResult({
      accuracyScore: accuracy,
      qualityScore: quality,
      reasoningScore: reasoning,
      overallScore,
      verdict,
      verdictLabel,
      factCheckNotes,
      readerReaction,
      reviewedTitle: cleanTitle,
    });
    setIsEvaluatingAI(false);

    // =========================================================================
    // SUBSCRIPTION PRICE ELASTICITY + QUALITY INTERACTION + PRICING MANAGER:
    // - If price is LOW ($1 - $6): You gain more subscribers easily (+15% to +65% boost),
    //   though you earn less per subscriber.
    // - If price is EXPENSIVE ($12 - $50):
    //   * If your news is REALLY GOOD (verified_scoop, high overallScore >= 78):
    //     Readers feel the premium price is worth it—almost NO subscriber penalty,
    //     allowing you to earn high revenue per subscriber!
    //   * If your news is only average, mediocre, or inaccurate:
    //     Readers balk at the expensive price—you gain far fewer subscribers or
    //     LOSE existing subscribers who cancel their overpriced subscriptions!
    // - Hiring a Pricing Manager shields against high-price resistance and adds a conversion bonus.
    // =========================================================================
    const effectivePrice = newsCompany.autoOptimizePrice && activePricingManager
      ? recommendedPrice
      : subscriptionPrice;

    const managerProtection = activePricingManager
      ? activePricingManager.elasticityProtection
      : 0;
    const managerConversion = activePricingManager
      ? activePricingManager.conversionBonus
      : 0;

    let subscriberDelta = 0;
    let credibilityDelta = 0;
    let views = 0;
    let grossSubscriberRevenue = 0;
    let retractionAndRefundLoss = 0;

    const credibilityFactor = 0.65 + (newsCompany.credibility / 100) * 0.65;
    const reasonQualityBoost =
      activeIsPrediction && reasoning >= 75 ? 1.25 : 1.0;

    // Low-price subscriber attraction bonus (for prices below $8)
    const lowPriceAttractionMultiplier =
      effectivePrice < 8 ? 1 + (8 - effectivePrice) * 0.095 : 1.0;

    const activeIsPredictionOrRumor =
      reportCategory === 'prediction' || includePrediction || isViralRumor;

    if (
      verdict === 'verified_scoop' ||
      (accuracy >= 75 && overallScore >= 75)
    ) {
      verdict = 'verified_scoop';
      const highPriceResistance =
        effectivePrice > 22
          ? Math.max(
              0.55,
              1 - (effectivePrice - 22) * 0.015 * (1 - managerProtection)
            )
          : 1.0;

      const baseNewSubs = (850 + overallScore * 16) * reasonQualityBoost;
      subscriberDelta = Math.round(
        baseNewSubs *
          lowPriceAttractionMultiplier *
          highPriceResistance *
          (1 + managerConversion)
      );
      credibilityDelta = isViralRumor ? 2 : 6;

      const effectiveSubs = Math.max(
        1000,
        newsCompany.subscribers + subscriberDelta
      );
      // Normal reports earn modest grounded revenue; big money comes from spreading a Viral Rumor that turns out TRUE!
      grossSubscriberRevenue = Math.round(
        effectiveSubs *
          effectivePrice *
          (isViralRumor ? 0.022 : 0.036) *
          credibilityFactor
      );
      views = Math.round(effectiveSubs * (isViralRumor ? 6.5 : 2.8));
    } else if (
      verdict === 'solid_report' ||
      (accuracy >= 60 && overallScore >= 55)
    ) {
      verdict = 'solid_report';
      const rawOverpricePenalty =
        effectivePrice > 12
          ? (effectivePrice - 12) * 85 * (1 - managerProtection)
          : 0;
      const baseNewSubs =
        (420 + overallScore * 9) *
        reasonQualityBoost *
        lowPriceAttractionMultiplier *
        (1 + managerConversion);

      subscriberDelta = Math.round(baseNewSubs - rawOverpricePenalty);
      credibilityDelta = isViralRumor ? 0 : 3;

      const effectiveSubs = Math.max(
        1000,
        newsCompany.subscribers + subscriberDelta
      );
      grossSubscriberRevenue = Math.round(
        effectiveSubs *
          effectivePrice *
          (isViralRumor ? 0.018 : 0.025) *
          credibilityFactor
      );
      views = Math.round(effectiveSubs * (isViralRumor ? 4.8 : 1.9));
    } else if (accuracy < 50 || verdict === 'inaccurate_flop') {
      verdict = 'inaccurate_flop';
      const expensiveAngerMultiplier =
        effectivePrice > 10
          ? 1 + (effectivePrice - 10) * 0.05 * (1 - managerProtection * 0.5)
          : 1.0;

      subscriberDelta = -Math.min(
        Math.max(0, newsCompany.subscribers - 500),
        Math.round((1800 + (50 - accuracy) * 55) * expensiveAngerMultiplier)
      );
      credibilityDelta = -12;
      grossSubscriberRevenue = 0;
      retractionAndRefundLoss = Math.round(
        14000 + Math.abs(subscriberDelta) * Math.max(4, effectivePrice * 0.6)
      );
      views = Math.max(900, Math.round(newsCompany.subscribers * 0.25));
    } else {
      verdict = 'mediocre';
      const overpriceChurn =
        effectivePrice > 8
          ? Math.round((effectivePrice - 8) * 110 * (1 - managerProtection))
          : 0;
      subscriberDelta = -Math.min(
        Math.max(0, newsCompany.subscribers - 500),
        Math.round(750 + (60 - overallScore) * 24 + overpriceChurn)
      );
      credibilityDelta = -5;
      grossSubscriberRevenue = Math.round(
        newsCompany.subscribers * Math.min(1.5, effectivePrice * 0.012)
      );
      retractionAndRefundLoss = 6500;
      views = Math.max(1200, Math.round(newsCompany.subscribers * 0.45));
    }

    if (isViralRumor && targetDrv) {
      factCheckNotes.push(
        `🔥 VIRAL PADDOCK RUMOR SPREAD: Rumored ${targetDrv.rawName} to finish ${predictionType.toUpperCase()} at ${currentCircuit.name}. Upfront earnings are modest, but if this rumor turns out TRUE in the race, you will cash in a massive viral windfall (+$400k to +$1.1M & +25,000+ subscribers)!`
      );
    }

    if (effectivePrice <= 5 && verdict !== 'inaccurate_flop') {
      factCheckNotes.push(
        `Low $${effectivePrice}/mo subscription price attracted extra budget-conscious paddock readers.`
      );
    } else if (effectivePrice >= 15 && verdict === 'verified_scoop') {
      factCheckNotes.push(
        `High-quality journalism justified your premium $${effectivePrice}/mo subscription price with strong reader retention!`
      );
    } else if (effectivePrice >= 14 && verdict !== 'verified_scoop') {
      factCheckNotes.push(
        `Readers felt your $${effectivePrice}/mo subscription price was too expensive for a ${verdict.replace('_', ' ')} article, hurting subscriber numbers.`
      );
    }

    // Net Profit or Net Financial Loss (normal articles make modest profit; viral rumors explode if true after the race)
    const netRevenueEarned =
      grossSubscriberRevenue - currentOperatingCost - retractionAndRefundLoss;

    const wasDraftedByWriter =
      writerDraftSnapshot && selectedWriterId === writerDraftSnapshot.writerId;
    const wasEditedByPlayer = Boolean(
      wasDraftedByWriter &&
        (cleanTitle !== writerDraftSnapshot.originalTitle.trim() ||
          cleanBody !== writerDraftSnapshot.originalContent.trim())
    );

    const published: PublishedNewsReport = {
      id: `player_rep_${Date.now()}`,
      title: cleanTitle,
      content: cleanBody,
      category: activeIsPredictionOrRumor ? 'prediction' : reportCategory,
      roundPublished: season.currentRound,
      timestamp: Date.now(),
      authorName: wasDraftedByWriter
        ? writerDraftSnapshot.writerName
        : `${season.career.driverName} (Editor-in-Chief)`,
      wasEditedByPlayer,
      accuracyScore: accuracy,
      qualityScore: quality,
      reasoningScore: reasoning,
      overallScore,
      verdict,
      verdictLabel: isViralRumor
        ? `🔥 Viral Rumor · ${verdictLabel}`
        : verdictLabel,
      factCheckNotes,
      readerReaction,
      views,
      subscriptionPriceUsed: effectivePrice,
      operatingCost: currentOperatingCost + retractionAndRefundLoss,
      revenueEarned: netRevenueEarned,
      subscriberDelta,
      credibilityDelta,
      isPrediction: activeIsPredictionOrRumor,
      predictedDriverId: activeIsPredictionOrRumor
        ? predictedDriverId
        : undefined,
      predictedDriverName:
        activeIsPredictionOrRumor && targetDrv ? targetDrv.rawName : undefined,
      predictionType: activeIsPredictionOrRumor ? predictionType : undefined,
      predictionTargetRound: activeIsPredictionOrRumor
        ? season.currentRound
        : undefined,
      predictionTargetCircuitName: activeIsPredictionOrRumor
        ? currentCircuit.name
        : undefined,
      predictionStatus: activeIsPredictionOrRumor ? 'pending' : undefined,
      isViralRumor,
      viralRumorStatus: isViralRumor ? 'pending' : undefined,
    };

    onPublishNewsReport(published);
    setLastPublishedResult(published);
    setReportTitle('');
    setReportContent('');
    setWriterDraftSnapshot(null);
  };

  const handleFoundCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onFoundNewsCompany || !canAffordNewsCompany) return;
    const cleanName = companyNameInput.trim() || 'Apex Paddock Gazette';
    const cleanBadge =
      (companyBadgeInput.trim() || 'APEX').toUpperCase().slice(0, 8);

    const newCompany: NewsCompanyConfig = {
      id: `news_co_${Date.now()}`,
      name: cleanName,
      badgeCode: cleanBadge,
      editorialFocus: editorialFocusInput,
      foundedRound: season.currentRound,
      credibility: 75,
      subscribers: 8500,
      subscriptionPrice: 8,
      pricingManager: null,
      autoOptimizePrice: false,
      totalRevenue: 0,
      publishedReports: [],
      hiredWriters: [],
    };

    onFoundNewsCompany(newCompany, NEWS_COMPANY_STARTUP_COST);
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

  const formatSignedMoney = (val: number) => {
    if (val < 0) return `-${formatMoney(Math.abs(val))}`;
    return `+${formatMoney(val)}`;
  };

  const breakingArticle =
    articles.find((a) => a.importance === 'breaking') || articles[0];

  const activeSelectedWriter = hiredWriters.find(
    (w) => w.id === selectedWriterId
  );

  return (
    <div className="space-y-6">
      {/* 1. Top Header & Mode Switcher (Paddock Wire vs. My News Company vs. Best News Companies) */}
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
                  ? `Owner of ${newsCompany.name} [${newsCompany.badgeCode}] · Global Rank #${playerLeaderboardRank}`
                  : '$15,000,000 FIA Broadcast Syndicate License'}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mt-0.5">
              Paddock News & AI Press Studio
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Rename your company anytime, control your subscription price, hire writers and a pricing manager, and climb the Global Best News Companies Leaderboard.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
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
                  : 'Start News Company ($15M)'}
              </span>
            </button>
            <button
              onClick={() => setActiveSubView('leaderboard')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSubView === 'leaderboard'
                  ? 'bg-cyan-500 text-black font-black'
                  : 'text-cyan-300 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>
                Best News Companies
                {playerLeaderboardRank ? ` (#${playerLeaderboardRank})` : ''}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. News Company Executive Summary Bar + Switch Name Anytime Modal/Bar */}
      {newsCompany && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Your Publication</span>
                <button
                  type="button"
                  onClick={() => {
                    setRenameNameInput(newsCompany.name);
                    setRenameBadgeInput(newsCompany.badgeCode);
                    setIsRenamingCompany(!isRenamingCompany);
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                  title="Switch your news company name anytime"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Rename</span>
                </button>
              </div>
              <div className="flex items-baseline justify-between mt-1 gap-2">
                <span className="text-base font-black text-white truncate">
                  {newsCompany.name}
                </span>
                <span className="text-xs font-mono font-bold text-amber-400 shrink-0">
                  [{newsCompany.badgeCode}]
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 font-mono mt-1">
                Rank #{playerLeaderboardRank} of {rankedNewsCompanies.length} Networks
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
                    ? 'Tier-1 Trusted'
                    : newsCompany.credibility >= 45
                    ? 'Standard Press'
                    : 'Tabloid'}
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 font-mono mt-1">
                Justifies higher subscription prices
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
                {hiredWriters.length} Writers ·{' '}
                {activePricingManager ? 'Pricing Mgr Active' : 'No Pricing Mgr'}
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="text-xs text-neutral-400">Subscription Price</div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-mono font-black text-purple-400 tabular-nums">
                  ${subscriptionPrice}/mo
                </span>
                <span className="text-xs font-mono text-neutral-400">
                  {subscriptionPrice <= 5
                    ? 'Budget Tier'
                    : subscriptionPrice <= 12
                    ? 'Standard Tier'
                    : 'Premium Tier'}
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 font-mono mt-1">
                {activePricingManager
                  ? `Mgr Optimal: $${recommendedPrice}/mo`
                  : 'Adjust price in Press Studio'}
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="text-xs text-neutral-400">Net Media Profit / Loss</div>
              <div className="flex items-baseline justify-between mt-1">
                <span
                  className={`text-xl font-mono font-black tabular-nums ${
                    newsCompany.totalRevenue >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {newsCompany.totalRevenue < 0
                    ? `-${formatMoney(Math.abs(newsCompany.totalRevenue))}`
                    : formatMoney(newsCompany.totalRevenue)}
                </span>
                <button
                  onClick={() =>
                    setActiveSubView(
                      activeSubView === 'press_room' ? 'leaderboard' : 'press_room'
                    )
                  }
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  {activeSubView === 'press_room' ? 'Leaderboard' : 'Press Studio'}
                </button>
              </div>
              <div className="text-[11px] text-neutral-500 font-mono mt-1">
                Operating Cost: {formatMoney(currentOperatingCost)} / report
              </div>
            </div>
          </div>

          {/* Inline Switch News Company Name Anytime Bar */}
          {isRenamingCompany && (
            <form
              onSubmit={handleSaveCompanyRename}
              className="p-4 rounded-xl bg-neutral-900 border border-amber-500/50 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3"
            >
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-amber-400 block mb-1">
                    New News Company Name (Switch Anytime — Free)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={48}
                    value={renameNameInput}
                    onChange={(e) => setRenameNameInput(e.target.value)}
                    placeholder="Enter new publication name..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-amber-400 block mb-1">
                    Wire Ticker Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={renameBadgeInput}
                    onChange={(e) =>
                      setRenameBadgeInput(e.target.value.toUpperCase())
                    }
                    placeholder="APEX"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono uppercase text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save New Name</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRenamingCompany(false)}
                  className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* VIEW C: GLOBAL BEST NEWS COMPANIES LEADERBOARD                    */}
      {/* ================================================================= */}
      {activeSubView === 'leaderboard' && (
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <div className="text-xs font-mono text-cyan-400 font-bold">
                  FIA Global Motorsport Media Rankings
                </div>
                <h3 className="text-xl font-black text-white mt-0.5">
                  Best Paddock News Companies Leaderboard
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Ranked by active paid subscribers and editorial credibility. Publish verified scoops, nail race predictions, and optimize your subscription price to overtake Sky Sports F1 and The Race!
                </p>
              </div>
              {newsCompany && (
                <button
                  type="button"
                  onClick={() => {
                    setRenameNameInput(newsCompany.name);
                    setRenameBadgeInput(newsCompany.badgeCode);
                    setIsRenamingCompany(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Switch Company Name</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 text-[11px] font-mono text-neutral-400">
                    <th className="py-3 px-3">RANK</th>
                    <th className="py-3 px-3">PUBLICATION / NETWORK</th>
                    <th className="py-3 px-3">EDITORIAL BEAT</th>
                    <th className="py-3 px-3 text-right">PAID SUBSCRIBERS</th>
                    <th className="py-3 px-3 text-right">SUB PRICE</th>
                    <th className="py-3 px-3 text-right">CREDIBILITY</th>
                    <th className="py-3 px-3 text-right">EST. ISSUE GROSS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/70 text-xs font-mono tabular-nums">
                  {rankedNewsCompanies.map((comp, index) => {
                    const rank = index + 1;
                    return (
                      <tr
                        key={comp.id}
                        className={`transition-colors ${
                          comp.isPlayer
                            ? 'bg-amber-500/15 border-l-4 border-l-amber-400'
                            : 'hover:bg-neutral-950/60'
                        }`}
                      >
                        <td className="py-3.5 px-3 font-black">
                          <span
                            className={
                              rank === 1
                                ? 'text-amber-400'
                                : rank === 2
                                ? 'text-cyan-400'
                                : rank === 3
                                ? 'text-emerald-400'
                                : 'text-neutral-400'
                            }
                          >
                            #{rank}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-sans">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-white">
                              {comp.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-amber-400">
                              [{comp.badgeCode}]
                            </span>
                            {comp.isPlayer && (
                              <span className="text-[10px] font-mono font-black bg-amber-500 text-black px-2 py-0.5 rounded">
                                YOUR COMPANY
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-sans text-neutral-400">
                          {comp.focusLabel}
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-cyan-400">
                          {comp.subscribers.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-3 text-right text-purple-300 font-bold">
                          ${comp.subscriptionPrice}/mo
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <span
                            className={`font-bold ${
                              comp.credibility >= 80
                                ? 'text-emerald-400'
                                : comp.credibility >= 60
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}
                          >
                            {comp.credibility}%
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-emerald-400">
                          {formatMoney(comp.estRevenuePerIssue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
            /* FOUND YOUR OWN NEWS COMPANY CARD ($15,000,000 FIA LICENSE) */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
                <div>
                  <div className="text-xs font-mono text-amber-400 font-bold">
                    Official FIA Commercial Media Rights & Syndicate Entry
                  </div>
                  <h3 className="text-2xl font-black text-white mt-1">
                    Found Your Own Paddock News Network ($15,000,000)
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Acquiring an official FIA Paddock Media Broadcast & Press Syndicate license requires a <strong className="text-white">$15,000,000</strong> capital investment from your Career Bank Balance. Once founded, you can rename your company anytime, set your subscription price, hire writers and a pricing manager, and compete on the Best News Companies leaderboard.
                  </p>
                </div>

                <form onSubmit={handleFoundCompanySubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                        Publication / Media Network Name (Can Switch Anytime Later)
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
                      Editorial Division Focus
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        {
                          id: 'investigative' as const,
                          title: 'Investigative & Standings Desk',
                          desc: 'Stronger subscriber retention when reporting verified race results and championship gaps.',
                        },
                        {
                          id: 'technical' as const,
                          title: 'Telemetry & Engineering Desk',
                          desc: 'Higher reader engagement when explaining car performance, aero downforce, and circuit layouts.',
                        },
                        {
                          id: 'insider' as const,
                          title: 'Predictions & Paddock Analyst',
                          desc: 'Attracts more subscribers when your well-reasoned Grand Prix predictions come true.',
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

                  <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2 text-xs font-mono tabular-nums">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">
                        FIA Media Syndicate License Fee (100% Upfront):
                      </span>
                      <span className="text-amber-400 font-bold">
                        {formatMoney(NEWS_COMPANY_STARTUP_COST)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-900">
                      <span className="text-neutral-400">
                        Your Current Career Bank Balance:
                      </span>
                      <span
                        className={`font-bold ${
                          canAffordNewsCompany
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {formatMoney(bankBalance)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!canAffordNewsCompany}
                    className={`w-full py-3.5 font-black text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 ${
                      canAffordNewsCompany
                        ? 'bg-amber-500 hover:bg-amber-400 text-black cursor-pointer'
                        : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    }`}
                  >
                    {canAffordNewsCompany ? (
                      <>
                        <Building2 className="w-4 h-4" />
                        <span>
                          Purchase Media License & Launch Company (
                          {formatMoney(NEWS_COMPANY_STARTUP_COST)})
                        </span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>
                          Insufficient Funds — Need{' '}
                          {formatMoney(NEWS_COMPANY_STARTUP_COST - bankBalance)}{' '}
                          More From Races/Contracts
                        </span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="text-xs font-mono text-neutral-400">
                    How Your Media Business Works
                  </div>
                  <h4 className="text-lg font-bold text-white">
                    Pricing, Writers & Global Rankings
                  </h4>
                  <div className="space-y-3 text-xs text-neutral-300 leading-relaxed">
                    <p>
                      <strong className="text-purple-400">
                        1. Control Subscription Price & Hire a Pricing Manager:
                      </strong>{' '}
                      Set your subscription price from $1 to $50/mo. Lower prices attract more subscribers faster. Expensive prices can drive readers away—unless your news is really good or you hire a Pricing Manager!
                    </p>
                    <p>
                      <strong className="text-amber-400">
                        2. Hire Writers & Edit Their Drafts:
                      </strong>{' '}
                      Hire staff journalists to write drafts for you. Inspect what they wrote and edit their mistakes—or write your own article from scratch.
                    </p>
                    <p>
                      <strong className="text-cyan-400">
                        3. Climb the Best News Companies List:
                      </strong>{' '}
                      Grow your subscriber count through compelling reports and accurate predictions to overtake Sky Sports F1, The Race, and Autosport.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 text-xs text-neutral-400 font-mono">
                  Starting Subscribers: <strong className="text-white">25,000</strong> · Default Price: <strong className="text-purple-400">$8/mo</strong>
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE PRESS ROOM STUDIO: SUBSCRIPTION PRICING + PRICING MANAGER + WRITERS + EDITOR */
            <div className="space-y-6">
              {/* SECTION 0: SUBSCRIPTION PRICE CONTROL & PRICING MANAGER DESK */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Card: Subscription Price Controller & Price-Quality Elasticity */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-mono text-purple-400 font-bold flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Paywall & Reader Elasticity Control</span>
                      </div>
                      <h3 className="text-lg font-black text-white mt-0.5">
                        Subscription Price Control (${subscriptionPrice}/mo)
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Lower prices attract more subscribers. Making it really expensive reduces subscriber growth—unless your news report is truly exceptional!
                      </p>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <span className="text-2xl font-black text-purple-400 tabular-nums">
                        ${subscriptionPrice}
                      </span>
                      <span className="text-xs text-neutral-400 block">
                        per subscriber
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={subscriptionPrice}
                      onChange={(e) =>
                        handleSubscriptionPriceChange(Number(e.target.value))
                      }
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                      <span>$1/mo (Mass Growth)</span>
                      <span>$10/mo (Standard)</span>
                      <span>$25/mo (Premium)</span>
                      <span>$50/mo (Ultra VIP)</span>
                    </div>
                  </div>

                  {/* Quick Preset Price Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { price: 3, label: '$3 Budget (+Subs)' },
                      { price: 8, label: '$8 Standard' },
                      { price: 15, label: '$15 Premium' },
                      { price: 28, label: '$28 VIP Insider' },
                      { price: 45, label: '$45 Ultra-Exclusive' },
                    ].map((preset) => (
                      <button
                        key={preset.price}
                        type="button"
                        onClick={() => handleSubscriptionPriceChange(preset.price)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                          subscriptionPrice === preset.price
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Live Price Impact Explanation Box */}
                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-neutral-400">
                        Current Price Elasticity Effect:
                      </span>
                      <span
                        className={`font-bold ${
                          subscriptionPrice <= 6
                            ? 'text-emerald-400'
                            : subscriptionPrice <= 14
                            ? 'text-cyan-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {subscriptionPrice <= 6
                          ? `+${Math.round((8 - subscriptionPrice) * 9.5)}% Faster Subscriber Growth`
                          : subscriptionPrice <= 14
                          ? 'Balanced Growth & Revenue'
                          : 'High Price — Requires Top-Tier News Quality!'}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      {subscriptionPrice <= 6
                        ? `At $${subscriptionPrice}/mo, your affordable paywall attracts budget readers easily on every report, helping you climb the subscriber leaderboard faster.`
                        : subscriptionPrice <= 14
                        ? `At $${subscriptionPrice}/mo, you earn solid revenue per subscriber with minimal price resistance on accurate reports.`
                        : `At $${subscriptionPrice}/mo, you earn high revenue per subscriber—if your AI report verdict is a Verified Scoop (high truth & quality), readers will gladly pay it without losing subscribers! But if your report is mediocre or inaccurate, many subscribers will cancel.`}
                    </p>
                  </div>
                </div>

                {/* Right Card: Hire a Pricing Manager */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Monetization & Elasticity Specialist</span>
                      </div>
                      <h3 className="text-lg font-black text-white mt-0.5">
                        Hire a Pricing Manager
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        A Pricing Manager calculates your optimal subscription price, protects against subscriber loss when charging high prices, and boosts reader conversion.
                      </p>
                    </div>
                  </div>

                  {activePricingManager && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white">
                          Active Manager: {activePricingManager.name} ({activePricingManager.role})
                        </div>
                        <div className="text-[11px] font-mono text-emerald-300">
                          Recommended Optimal Price:{' '}
                          <strong>${recommendedPrice}/mo</strong> · Protects{' '}
                          {Math.round(activePricingManager.elasticityProtection * 100)}% High-Price Churn · +
                          {Math.round(activePricingManager.conversionBonus * 100)}% Subs
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleSubscriptionPriceChange(recommendedPrice)
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs cursor-pointer"
                        >
                          Set Optimal (${recommendedPrice})
                        </button>
                        <button
                          type="button"
                          onClick={handleToggleAutoOptimizePrice}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                            newsCompany.autoOptimizePrice
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-neutral-950 text-neutral-300 border-neutral-800'
                          }`}
                        >
                          {newsCompany.autoOptimizePrice
                            ? 'Auto-Price: ON'
                            : 'Auto-Price: OFF'}
                        </button>
                        <button
                          type="button"
                          onClick={handleFirePricingManager}
                          className="p-1.5 rounded-lg bg-neutral-950 hover:bg-red-950/60 text-neutral-400 hover:text-red-400 border border-neutral-800 cursor-pointer"
                          title="Release Pricing Manager"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {NEWS_PRICING_MANAGER_OPTIONS.map((pm) => {
                      const isCurrent = activePricingManager?.id === pm.id;
                      const canAfford = bankBalance >= pm.hiringFee;
                      return (
                        <div
                          key={pm.id}
                          className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                            isCurrent
                              ? 'bg-neutral-950 border-emerald-500/50'
                              : 'bg-neutral-950/60 border-neutral-800'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="text-xs font-black text-white">
                              {pm.name}
                            </div>
                            <div className="text-[10px] font-mono text-emerald-400">
                              {pm.role}
                            </div>
                            <p className="text-[11px] text-neutral-400 leading-snug">
                              {pm.bio}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                            <div className="text-[10px] font-mono text-neutral-300 flex items-center justify-between tabular-nums">
                              <span>Sign: {formatMoney(pm.hiringFee)}</span>
                              <span>{formatMoney(pm.salaryPerReport)}/rep</span>
                            </div>
                            {isCurrent ? (
                              <div className="py-1.5 text-center rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[11px]">
                                ACTIVE PRICING MGR
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!canAfford}
                                onClick={() => handleHirePricingManager(pm)}
                                className={`w-full py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-colors ${
                                  canAfford
                                    ? 'bg-neutral-800 hover:bg-emerald-500 hover:text-black text-white cursor-pointer'
                                    : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
                                }`}
                              >
                                {canAfford
                                  ? `Hire (${formatMoney(pm.hiringFee)})`
                                  : 'Insufficient Funds'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SECTION 1: HIRE & MANAGE JOURNALIST WRITERS */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-amber-400 font-bold">
                      Editorial Newsroom Staff · Bank Balance: {formatMoney(bankBalance)}
                    </div>
                    <h3 className="text-lg font-black text-white mt-0.5">
                      Hire Journalists & Staff Writers
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Hire writers to draft articles and predictions for you. Junior writers are cheap but make mistakes you must edit out; senior columnists write accurate, high-level drafts that justify higher subscription prices.
                    </p>
                  </div>
                  <div className="text-xs font-mono text-neutral-300 bg-neutral-950 border border-neutral-800 px-3.5 py-2 rounded-xl shrink-0 tabular-nums">
                    Cost Per Published Report:{' '}
                    <strong className="text-amber-400">
                      {formatMoney(currentOperatingCost)}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {NEWS_WRITER_OPTIONS.map((writer) => {
                    const isHired = hiredWriters.some((w) => w.id === writer.id);
                    const canAfford = bankBalance >= writer.hiringFee;

                    return (
                      <div
                        key={writer.id}
                        className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                          isHired
                            ? 'bg-neutral-950 border-amber-500/50'
                            : 'bg-neutral-950/60 border-neutral-800'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-black text-white">
                                {writer.name}
                              </div>
                              <div className="text-[11px] font-mono text-amber-400">
                                {writer.role}
                              </div>
                            </div>
                            {isHired && (
                              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                                ON STAFF
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-neutral-400 leading-relaxed">
                            {writer.bio}
                          </p>

                          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] tabular-nums">
                            <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                              <span className="text-neutral-500 block text-[10px]">
                                Accuracy Skill
                              </span>
                              <span
                                className={`font-bold ${
                                  writer.accuracyRating >= 80
                                    ? 'text-emerald-400'
                                    : writer.accuracyRating >= 70
                                    ? 'text-cyan-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {writer.accuracyRating}/100
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                              <span className="text-neutral-500 block text-[10px]">
                                Writing Skill
                              </span>
                              <span className="font-bold text-purple-400">
                                {writer.writingRating}/100
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                            <span className="text-neutral-400">
                              Sign: {formatMoney(writer.hiringFee)}
                            </span>
                            <span className="text-neutral-300">
                              {formatMoney(writer.salaryPerReport)}/rep
                            </span>
                          </div>

                          {isHired ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedWriterId(writer.id);
                                  handleGenerateWriterDraft(writer);
                                }}
                                disabled={isGeneratingWriterDraft}
                                className="flex-1 py-2 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Draft Article</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFireWriter(writer.id)}
                                className="p-2 rounded-lg bg-neutral-900 hover:bg-red-950/60 text-neutral-400 hover:text-red-400 border border-neutral-800 cursor-pointer"
                                title={`Release ${writer.name}`}
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!canAfford}
                              onClick={() => handleHireWriter(writer)}
                              className={`w-full py-2 px-3 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                                canAfford
                                  ? 'bg-neutral-800 hover:bg-amber-500 hover:text-black text-white cursor-pointer'
                                  : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
                              }`}
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>
                                {canAfford
                                  ? `Hire Writer (${formatMoney(writer.hiringFee)})`
                                  : 'Insufficient Funds'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: ARTICLE & PREDICTION EDITOR + TELEMETRY NOTEBOOK */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-4">
                    <div>
                      <div className="text-xs font-mono text-amber-400">
                        {newsCompany.name} [{newsCompany.badgeCode}] · Sub Price: ${subscriptionPrice}/mo
                      </div>
                      <h3 className="text-lg font-black text-white mt-0.5">
                        Write Your Own Report or Edit Your Writer&apos;s Draft
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Choose a hired writer to generate a draft—then inspect and edit what they wrote—or write your own article and race prediction from scratch.
                      </p>
                    </div>
                  </div>

                  {/* Writer Assignment Bar: Write Your Own vs Hired Writers */}
                  <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                        <FileEdit className="w-3.5 h-3.5 text-amber-400" />
                        <span>Author / Writer Assignment:</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWriterId('self');
                            setWriterDraftSnapshot(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            selectedWriterId === 'self'
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:text-white'
                          }`}
                        >
                          Write My Own ({season.career.driverName})
                        </button>
                        {hiredWriters.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setSelectedWriterId(w.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                              selectedWriterId === w.id
                                ? 'bg-amber-500 text-black border-amber-400'
                                : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:text-white'
                            }`}
                          >
                            {w.name} ({w.accuracyRating}% Acc)
                          </button>
                        ))}
                      </div>
                    </div>

                    {activeSelectedWriter && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-neutral-900">
                        <div className="text-xs text-neutral-300">
                          Selected Staff Journalist:{' '}
                          <strong className="text-white">
                            {activeSelectedWriter.name}
                          </strong>{' '}
                          ({activeSelectedWriter.role} · Accuracy{' '}
                          {activeSelectedWriter.accuracyRating}/100 · Writing{' '}
                          {activeSelectedWriter.writingRating}/100)
                        </div>
                        <button
                          type="button"
                          disabled={isGeneratingWriterDraft}
                          onClick={() =>
                            handleGenerateWriterDraft(activeSelectedWriter)
                          }
                          className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          {isGeneratingWriterDraft ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>{activeSelectedWriter.name} is Writing...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>
                                Have {activeSelectedWriter.name} Write Draft
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Show what the writer wrote & whether the player has edited it */}
                    {writerDraftSnapshot && (
                      <div className="p-3.5 rounded-xl bg-neutral-900 border border-amber-500/30 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-amber-400">
                            Staff Writer Submission by {writerDraftSnapshot.writerName}
                          </span>
                          <span className="font-mono text-[11px] text-neutral-300">
                            {reportTitle.trim() !==
                              writerDraftSnapshot.originalTitle.trim() ||
                            reportContent.trim() !==
                              writerDraftSnapshot.originalContent.trim()
                              ? '✎ Edited by You (Editor-in-Chief)'
                              : 'Unedited Writer Draft — Review & Edit Below'}
                          </span>
                        </div>
                        <p className="text-neutral-300 italic">
                          {writerDraftSnapshot.writerNote}
                        </p>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handlePublishReport} className="space-y-4">
                    {/* Step 1: Category / Beat */}
                    <div>
                      <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                        Article Beat
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { id: 'race_result' as const, label: 'Race Recap' },
                          { id: 'championship' as const, label: 'Standings' },
                          { id: 'prediction' as const, label: 'Race Prediction' },
                          { id: 'transfer' as const, label: 'Driver Market' },
                          { id: 'technical' as const, label: 'Tech Analysis' },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setReportCategory(cat.id);
                              if (cat.id === 'prediction') {
                                setIncludePrediction(true);
                              }
                            }}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                              reportCategory === cat.id
                                ? cat.id === 'prediction'
                                  ? 'bg-purple-600 text-white border-purple-400'
                                  : 'bg-red-600 text-white border-red-500'
                                : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Step 2: Optional / Active Prediction Builder + VIRAL RUMOR Toggle */}
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              reportCategory === 'prediction' ||
                              includePrediction ||
                              isViralRumor
                            }
                            onChange={(e) => {
                              setIncludePrediction(e.target.checked);
                              if (!e.target.checked) {
                                setIsViralRumor(false);
                                if (reportCategory === 'prediction') {
                                  setReportCategory('race_result');
                                }
                              }
                            }}
                            className="rounded accent-purple-500"
                          />
                          <Target className="w-4 h-4 text-purple-400" />
                          <span>
                            Include Official Next-Race Prediction for Round{' '}
                            {season.currentRound + 1} ({currentCircuit.name})
                          </span>
                        </label>
                        <span className="text-[11px] font-mono text-purple-400">
                          Correct = Gain Subscribers · Wrong = Lose Subscribers
                        </span>
                      </div>

                      {/* Viral Rumor Mode Toggle */}
                      <div
                        className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isViralRumor
                            ? 'bg-amber-500/15 border-amber-400/50'
                            : 'bg-neutral-900/70 border-neutral-800'
                        }`}
                      >
                        <label className="flex items-start sm:items-center gap-2.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isViralRumor}
                            onChange={(e) => {
                              setIsViralRumor(e.target.checked);
                              if (e.target.checked) {
                                setIncludePrediction(true);
                              }
                            }}
                            className="mt-0.5 sm:mt-0 rounded accent-amber-500"
                          />
                          <div>
                            <div className="font-black text-amber-300 flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-amber-400" />
                              <span>
                                Spread as a High-Stakes VIRAL PADDOCK RUMOR
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 mt-0.5">
                              Regular paddock articles earn modest subscription profits. Spread a bold Viral Rumor about the next race—if the rumor turns out <strong className="text-emerald-400">TRUE</strong> after the Grand Prix, your outlet cashes in a massive viral windfall! If false, expect a backlash.
                            </p>
                          </div>
                        </label>
                        <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 shrink-0">
                          {isViralRumor ? '🔥 Viral Rumor Armed' : 'Standard Issue'}
                        </span>
                      </div>

                      {(reportCategory === 'prediction' ||
                        includePrediction ||
                        isViralRumor) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-900">
                          <div>
                            <label className="text-[11px] font-bold text-neutral-400 block mb-1">
                              {isViralRumor
                                ? 'Rumored Driver Subject'
                                : 'Predicted Driver'}
                            </label>
                            <select
                              value={predictedDriverId}
                              onChange={(e) =>
                                setPredictedDriverId(e.target.value)
                              }
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                            >
                              {selectableDrivers.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name} — {d.points} PTS (Rating {d.rating})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-neutral-400 block mb-1">
                              {isViralRumor
                                ? `Rumored Shock Outcome at ${currentCircuit.name}`
                                : `Predicted Finish at ${currentCircuit.name}`}
                            </label>
                            <select
                              value={predictionType}
                              onChange={(e) =>
                                setPredictionType(
                                  e.target.value as 'win' | 'podium' | 'top5'
                                )
                              }
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                            >
                              <option value="win">
                                Win the Grand Prix (P1)
                              </option>
                              <option value="podium">
                                Podium Finish (Top 3)
                              </option>
                              <option value="top5">
                                Top-5 Finish (P1–P5)
                              </option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 3: Headline Input (Editable whether written by player or drafted by hired writer) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-neutral-300">
                          Report Headline (Edit Writer&apos;s Headline or Write Your Own)
                        </label>
                        <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                          {reportTitle.length} chars
                        </span>
                      </div>
                      <input
                        type="text"
                        value={reportTitle}
                        onChange={(e) => setReportTitle(e.target.value)}
                        placeholder="Write or edit the headline (e.g. Why Norris and McLaren Are Favorites for the Podium at Bahrain)..."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* Step 4: Full Report & Reasoning Body */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-neutral-300">
                          {reportCategory === 'prediction' || includePrediction
                            ? 'Full Prediction Analysis & Reasons Why It Should Be Correct'
                            : 'Full Paddock Report & Analysis (Edit Writer Draft or Write Your Own)'}
                        </label>
                        <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                          {reportContent.length} chars
                        </span>
                      </div>
                      <textarea
                        rows={6}
                        value={reportContent}
                        onChange={(e) => setReportContent(e.target.value)}
                        placeholder={
                          reportCategory === 'prediction' || includePrediction
                            ? `Write or edit your prediction and list the concrete reasons WHY it should be correct (e.g. driver rating, championship momentum, car top speed/downforce, and how ${currentCircuit.name}'s ${currentCircuit.turns} corners suit their car)...`
                            : 'Write your paddock report here or edit what your hired writer drafted. Our AI Editor Bot checks if your claims match actual race results and championship standings, and grades how compelling and well-reasoned your article is...'
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-xs text-white leading-relaxed focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {aiErrorMsg && (
                      <div className="text-xs text-amber-300 bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl">
                        {aiErrorMsg}
                      </div>
                    )}

                    {/* Instant AI Editor Bot Review Panel (Shown immediately on Scan or Publish) */}
                    {aiBotReviewResult && (
                      <div
                        className={`p-4 rounded-xl border space-y-2.5 ${
                          aiBotReviewResult.verdict === 'verified_scoop'
                            ? 'bg-emerald-950/30 border-emerald-500/50'
                            : aiBotReviewResult.verdict === 'solid_report'
                            ? 'bg-cyan-950/30 border-cyan-500/50'
                            : aiBotReviewResult.verdict === 'inaccurate_flop'
                            ? 'bg-red-950/35 border-red-500/50'
                            : 'bg-amber-950/30 border-amber-500/50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="text-xs font-black uppercase tracking-wider text-white">
                              AI Editor Bot Review: {aiBotReviewResult.verdictLabel}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-neutral-300">
                            Overall Grade: <strong className="text-white">{aiBotReviewResult.overallScore}/100</strong>
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                          <div className="bg-neutral-950/80 border border-white/10 rounded-lg p-2">
                            <span className="text-[10px] text-neutral-400 block">Factual Accuracy</span>
                            <span
                              className={`text-sm font-black ${
                                aiBotReviewResult.accuracyScore >= 70
                                  ? 'text-emerald-400'
                                  : aiBotReviewResult.accuracyScore >= 50
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {aiBotReviewResult.accuracyScore}%
                            </span>
                          </div>
                          <div className="bg-neutral-950/80 border border-white/10 rounded-lg p-2">
                            <span className="text-[10px] text-neutral-400 block">Writing Quality</span>
                            <span className="text-sm font-black text-cyan-400">
                              {aiBotReviewResult.qualityScore}%
                            </span>
                          </div>
                          <div className="bg-neutral-950/80 border border-white/10 rounded-lg p-2">
                            <span className="text-[10px] text-neutral-400 block">Reasoning Depth</span>
                            <span className="text-sm font-black text-purple-400">
                              {aiBotReviewResult.reasoningScore}%
                            </span>
                          </div>
                        </div>

                        <ul className="space-y-1 text-xs text-neutral-200">
                          {aiBotReviewResult.factCheckNotes.map((note, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-amber-400 font-bold">•</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>

                        <p className="text-[11px] italic text-neutral-400 border-t border-white/10 pt-2">
                          {aiBotReviewResult.readerReaction}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleScanArticleWithAIBot}
                        disabled={
                          isEvaluatingAI ||
                          isScanningOnly ||
                          (!reportTitle.trim() && !reportContent.trim())
                        }
                        className="w-full py-3.5 bg-neutral-800 hover:bg-neutral-700 border border-cyan-500/40 disabled:opacity-40 text-cyan-300 font-black text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isScanningOnly ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            <span>AI Bot Scanning Article...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                            <span>Scan & Review Article with AI Bot</span>
                          </>
                        )}
                      </button>

                      <button
                        type="submit"
                        disabled={
                          isEvaluatingAI ||
                          isScanningOnly ||
                          (!reportTitle.trim() && !reportContent.trim())
                        }
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isEvaluatingAI ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>
                              AI Bot Reviewing & Publishing...
                            </span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>
                              Submit to AI Editor & Publish (${subscriptionPrice}/mo · Cost:{' '}
                              {formatMoney(currentOperatingCost)})
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Latest Published AI Audit Result Receipt */}
                  {lastPublishedResult && (
                    <div
                      className={`p-5 rounded-xl border space-y-3 ${
                        lastPublishedResult.revenueEarned >= 0
                          ? 'bg-emerald-950/20 border-emerald-500/40'
                          : 'bg-red-950/25 border-red-500/40'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {lastPublishedResult.revenueEarned < 0 ? (
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          )}
                          <span className="text-sm font-black text-white">
                            AI Verdict: {lastPublishedResult.verdictLabel}
                          </span>
                        </div>

                        <div className="text-base font-mono font-black tabular-nums">
                          <span
                            className={
                              lastPublishedResult.revenueEarned >= 0
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }
                          >
                            {formatSignedMoney(lastPublishedResult.revenueEarned)}{' '}
                            {lastPublishedResult.revenueEarned >= 0
                              ? 'Net Profit'
                              : 'Net Loss'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 font-mono text-xs tabular-nums">
                        <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800">
                          <span className="text-[10px] text-neutral-400 block">
                            Truth & Accuracy
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
                            Compelling Quality
                          </span>
                          <span className="font-bold text-cyan-400">
                            {lastPublishedResult.qualityScore}%
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800">
                          <span className="text-[10px] text-neutral-400 block">
                            Sub Price Used
                          </span>
                          <span className="font-bold text-purple-400">
                            ${lastPublishedResult.subscriptionPriceUsed ?? subscriptionPrice}/mo
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800">
                          <span className="text-[10px] text-neutral-400 block">
                            Subscribers Shift
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
                      </div>

                      {lastPublishedResult.isPrediction && (
                        <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200 font-mono">
                          ACTIVE RACE PREDICTION LOCKED: {lastPublishedResult.predictedDriverName} to finish{' '}
                          {lastPublishedResult.predictionType?.toUpperCase()} at{' '}
                          {lastPublishedResult.predictionTargetCircuitName}. If your prediction comes true in the race, you will gain a surge of new subscribers (which drives your ongoing revenue). If it is wrong, you will lose subscribers!
                        </div>
                      )}

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

                {/* Right Column: Mini Best News Companies Standings + Live Paddock Telemetry Notebook */}
                <div className="space-y-6">
                  {/* Compact Top News Companies Widget */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono text-cyan-400 font-bold">
                          GLOBAL MEDIA STANDINGS
                        </div>
                        <h4 className="text-sm font-black text-white">
                          Best News Companies
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSubView('leaderboard')}
                        className="text-xs font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                      >
                        Full Table
                      </button>
                    </div>
                    <div className="space-y-1.5 text-xs font-mono tabular-nums">
                      {rankedNewsCompanies.slice(0, 5).map((comp, i) => (
                        <div
                          key={comp.id}
                          className={`flex items-center justify-between p-2 rounded-lg ${
                            comp.isPlayer
                              ? 'bg-amber-500/20 border border-amber-400/40 text-white font-bold'
                              : 'bg-neutral-950 text-neutral-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-neutral-500 w-4">
                              #{i + 1}
                            </span>
                            <span className="truncate font-sans font-bold">
                              {comp.name}
                            </span>
                          </div>
                          <span className="text-cyan-400 shrink-0">
                            {comp.subscribers.toLocaleString()} subs
                          </span>
                        </div>
                      ))}
                      {playerLeaderboardRank && playerLeaderboardRank > 5 && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/20 border border-amber-400/40 text-white font-bold">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-amber-400">
                              #{playerLeaderboardRank}
                            </span>
                            <span className="truncate font-sans font-bold">
                              {newsCompany.name} (YOU)
                            </span>
                          </div>
                          <span className="text-cyan-400 shrink-0">
                            {newsCompany.subscribers.toLocaleString()} subs
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
                    <div>
                      <div className="text-xs font-mono text-emerald-400 font-bold">
                        Live Season Reference Data
                      </div>
                      <h4 className="text-base font-black text-white mt-0.5">
                        Paddock Notebook
                      </h4>
                      <p className="text-xs text-neutral-400 mt-1">
                        Use these true standings and circuit specs to fact-check what your hired writers draft or to build your own prediction reasoning.
                      </p>
                    </div>

                    <div className="space-y-3 text-xs font-mono tabular-nums">
                      <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                        <div className="text-[10px] text-neutral-500">
                          NEXT GRAND PRIX (ROUND {season.currentRound + 1})
                        </div>
                        <div className="text-white font-bold">
                          {currentCircuit.name}
                        </div>
                        <div className="text-neutral-400">
                          {currentCircuit.lengthKm} km · {currentCircuit.turns} Turns
                        </div>
                        <div className="text-purple-400">
                          Lap Record: {currentCircuit.lapRecord}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                        <div className="text-[10px] text-neutral-500">
                          LATEST COMPLETED RACE
                        </div>
                        {lastRound ? (
                          <>
                            <div className="text-white font-bold">
                              {lastRound.circuitName}
                            </div>
                            <div className="text-emerald-400">
                              Winner:{' '}
                              {
                                seasonTelemetryContext.completedRacesHistory[
                                  seasonTelemetryContext.completedRacesHistory
                                    .length - 1
                                ]?.winner
                              }
                            </div>
                            <div className="text-cyan-400">
                              Your Finish: P{lastRound.playerFinishedPosition}
                            </div>
                          </>
                        ) : (
                          <div className="text-neutral-400">
                            No races completed yet — Season Opener at{' '}
                            {currentCircuit.name}
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1.5">
                        <div className="text-[10px] text-neutral-500">
                          TOP DRIVERS & CONSTRUCTORS
                        </div>
                        {seasonTelemetryContext.topDriversStandings
                          .slice(0, 4)
                          .map((d, i) => (
                            <div
                              key={d.id}
                              className="flex items-center justify-between text-neutral-300"
                            >
                              <span className="truncate">
                                P{i + 1} {d.name}
                              </span>
                              <span className="text-amber-400 font-bold">
                                {d.points} PTS
                              </span>
                            </div>
                          ))}
                        <div className="border-t border-neutral-900 pt-1.5 mt-1.5">
                          {seasonTelemetryContext.constructorsStandings
                            .slice(0, 3)
                            .map((c, i) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between text-neutral-400"
                              >
                                <span className="truncate">
                                  P{i + 1} {c.name}
                                </span>
                                <span className="text-cyan-400 font-bold">
                                  {c.points} PTS
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    {/* Recent Reports & Predictions Ledger */}
                    {newsCompany.publishedReports.length > 0 && (
                      <div className="pt-3 border-t border-neutral-800 space-y-2.5">
                        <div className="text-xs font-bold text-white">
                          Published Archive ({newsCompany.publishedReports.length})
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {newsCompany.publishedReports.slice(0, 8).map((rep) => (
                            <div
                              key={rep.id}
                              className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-white truncate">
                                  {rep.title}
                                </span>
                                <span
                                  className={`font-mono font-bold text-xs shrink-0 tabular-nums ${
                                    rep.revenueEarned >= 0
                                      ? 'text-emerald-400'
                                      : 'text-red-400'
                                  }`}
                                >
                                  {formatSignedMoney(rep.revenueEarned)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono tabular-nums">
                                <span>
                                  Truth {rep.accuracyScore}% ·{' '}
                                  {rep.subscriberDelta >= 0 ? '+' : ''}
                                  {rep.subscriberDelta.toLocaleString()} subs
                                </span>
                                {rep.isPrediction && (
                                  <span
                                    className={
                                      rep.predictionStatus === 'correct'
                                        ? 'text-emerald-400 font-bold'
                                        : rep.predictionStatus === 'incorrect'
                                        ? 'text-red-400'
                                        : 'text-purple-400'
                                    }
                                  >
                                    {rep.predictionStatus === 'correct'
                                      ? `✓ Correct (+${(
                                          rep.predictionSubscriberShift || 0
                                        ).toLocaleString()} subs)`
                                      : rep.predictionStatus === 'incorrect'
                                      ? `✗ Wrong (${(
                                          rep.predictionSubscriberShift || 0
                                        ).toLocaleString()} subs)`
                                      : '⏳ Pending Race'}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
                  <span
                    className={`font-bold ${
                      (breakingArticle.revenueEarned || 0) >= 0
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}
                  >
                    Your Report · {formatSignedMoney(breakingArticle.revenueEarned || 0)}
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
                { id: 'prediction', label: 'Predictions', icon: Target },
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

                    {/* Player Report Financial & AI Scores Strip */}
                    {article.isPlayerReport && (
                      <div className="mt-3 pt-2.5 border-t border-neutral-800/80 space-y-1.5 text-[11px] font-mono tabular-nums">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-neutral-400">
                            <span
                              className={
                                (article.accuracyScore || 0) >= 70
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-red-400 font-bold'
                              }
                            >
                              Truth {article.accuracyScore}%
                            </span>
                            <span>·</span>
                            <span>Quality {article.qualityScore}%</span>
                            <span>·</span>
                            <span className="text-purple-400">
                              Reason {article.reasoningScore ?? 50}%
                            </span>
                          </div>
                          <span
                            className={`font-bold ${
                              (article.revenueEarned || 0) >= 0
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }`}
                          >
                            {formatSignedMoney(article.revenueEarned || 0)}
                          </span>
                        </div>

                        {article.isPrediction && (
                          <div className="flex items-center justify-between text-purple-300">
                            <span>
                              Prediction: {article.predictedDriverName} (
                              {article.predictionType?.toUpperCase()} at{' '}
                              {article.predictionTargetCircuitName})
                            </span>
                            <span>
                              {article.predictionStatus === 'correct'
                                ? `✓ CORRECT (+${(
                                    article.predictionSubscriberShift || 0
                                  ).toLocaleString()} subs)`
                                : article.predictionStatus === 'incorrect'
                                ? `✗ WRONG (${(
                                    article.predictionSubscriberShift || 0
                                  ).toLocaleString()} subs)`
                                : '⏳ Pending Race'}
                            </span>
                          </div>
                        )}
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
                        {article.factCheckNotes &&
                          article.factCheckNotes.length > 0 && (
                            <div className="space-y-1 pt-2 border-t border-neutral-800/60 text-[11px] font-mono text-neutral-400">
                              {article.factCheckNotes.map((n, i) => (
                                <div key={i}>· {n}</div>
                              ))}
                            </div>
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
                  ? 'Open your Paddock News Company Press Room to write your first motorsport report or race prediction.'
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
      title="Click to open Paddock News & AI Press Studio"
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
