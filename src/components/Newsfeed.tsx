import React, { useState, useMemo } from 'react';
import { SeasonState } from '../types/racing';
import { CIRCUITS, TEAMS, DRIVERS } from '../constants/f1Data';
import {
  Newspaper,
  TrendingUp,
  Award,
  Users,
  Flame,
  Search,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Shield,
  Zap,
  Flag,
  Share2,
  Bookmark,
  MessageSquare,
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
}

interface NewsfeedProps {
  season: SeasonState;
  onNavigateToTab?: (tab: 'weekend' | 'contracts' | 'myteam' | 'standings') => void;
}

export function generatePaddockNews(season: SeasonState): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const completedRounds = season.completedRounds || [];
  const currentRoundIndex = season.currentRound || 0;
  const currentCircuit = CIRCUITS[currentRoundIndex] || CIRCUITS[0];
  const playerDriverId = season.selectedDriverId || 'bearman';
  const playerTeamId = season.selectedTeamId || 'haas';
  const playerDriverName = season.career.driverName || 'Rookie Driver';
  const playerTeamName = season.career.customTeam?.name || TEAMS.find((t) => t.id === playerTeamId)?.name || 'Haas F1';

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

  const p1Driver = sortedDrivers[0] || { id: 'verstappen', name: 'Max Verstappen', points: 0, teamId: 'redbull' };
  const p2Driver = sortedDrivers[1] || { id: 'norris', name: 'Lando Norris', points: 0, teamId: 'mclaren' };
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
      const name = season.career.customTeam && id === season.career.customTeam.id ? season.career.customTeam.name : t?.name || id;
      return { id, name, points: pts };
    });

  const p1Constructor = sortedConstructors[0] || { id: 'mclaren', name: 'McLaren', points: 0 };
  const p2Constructor = sortedConstructors[1] || { id: 'redbull', name: 'Red Bull Racing', points: 0 };

  // ----------------------------------------------------
  // A. RECENT RACE RESULTS & RECAPS
  // ----------------------------------------------------
  if (completedRounds.length > 0) {
    const lastResult = completedRounds[completedRounds.length - 1];
    const winnerDriver = DRIVERS.find((d) => d.id === lastResult.winnerDriverId);
    const winnerName = lastResult.winnerDriverId === playerDriverId ? playerDriverName : winnerDriver?.name || 'Max Verstappen';
    const isPlayerWin = lastResult.playerFinishedPosition === 1;
    const isPlayerPodium = lastResult.playerFinishedPosition <= 3;

    if (isPlayerWin) {
      articles.push({
        id: `race_win_${lastResult.round}`,
        category: 'race_result',
        categoryLabel: 'Grand Prix Victory',
        categoryColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        source: 'Sky Sports F1',
        sourceBadge: 'SKY',
        title: `SENSATIONAL WIN: ${playerDriverName} Triumphs at ${lastResult.circuitName} for ${playerTeamName}!`,
        excerpt: `A masterclass in racecraft saw ${playerDriverName} claim the top step of the podium in dramatic fashion, resisting intense pressure from the chasing pack.`,
        content: `In one of the most thrilling races of the 2026 Formula 1 championship, ${playerDriverName} drove a flawless Grand Prix at ${lastResult.circuitName} to take a career-defining victory. Starting strong and managing tire degradation with clinical precision, the ${playerTeamName} driver executed decisive overtakes and built an unassailable lead. Paddock pundits are already calling it one of the standout drives of the modern ground-effect era.`,
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
        categoryColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        source: 'The Race',
        sourceBadge: 'THE RACE',
        title: `PODIUM DRIVE: ${playerDriverName} Seals P${lastResult.playerFinishedPosition} at ${lastResult.circuitName}`,
        excerpt: `${playerTeamName} celebrated on the pit wall as ${playerDriverName} held off relentless challengers to secure a memorable podium finish.`,
        content: `A resilient and tactical display saw ${playerDriverName} clinch P${lastResult.playerFinishedPosition} at ${lastResult.circuitName}. Navigating early chaos and capitalizing on DRS straight-line efficiency, the driver delivered critical championship points for ${playerTeamName}. "We knew the pace was in the car, and today everything clicked," the team principal remarked in the post-race debrief.`,
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
        categoryColor: 'bg-red-500/10 text-red-400 border-red-500/30',
        source: 'Autosport',
        sourceBadge: 'AUTOSPORT',
        title: `${winnerName} Takes Victory at ${lastResult.circuitName}; ${playerDriverName} Finishes P${lastResult.playerFinishedPosition}`,
        excerpt: `High-speed drama unfolded across ${lastResult.circuitName} as ${winnerName} took victory while ${playerTeamName} fought hard in the midfield battle.`,
        content: `${winnerName} showcased relentless race pace to win the ${lastResult.circuitName} Grand Prix. Meanwhile, ${playerDriverName} battled fiercely through traffic to cross the line in P${lastResult.playerFinishedPosition}, collecting vital telemetry data and driver rating points for the championship campaign.`,
        author: 'Jonathan Noble',
        timeAgo: '3 hours ago',
        relatedTeamId: lastResult.winnerDriverId === playerDriverId ? playerTeamId : 'redbull',
        importance: 'standard',
        readTime: '3 min read',
      });
    }

    // Fastest Lap Story
    if (lastResult.fastestLapDriverId) {
      const flDriver = DRIVERS.find((d) => d.id === lastResult.fastestLapDriverId);
      const flName = lastResult.fastestLapDriverId === playerDriverId ? playerDriverName : flDriver?.name || 'Max Verstappen';
      articles.push({
        id: `fastest_lap_${lastResult.round}`,
        category: 'race_result',
        categoryLabel: 'Speed Trap & Fastest Lap',
        categoryColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        source: 'F1 Official Data',
        sourceBadge: 'FIA',
        title: `SPEED TRAP: ${flName} Snatches Fastest Lap Point at ${lastResult.circuitName}`,
        excerpt: `A blistering lap in the closing stages saw ${flName} push their power unit to the limit to earn the bonus championship point.`,
        content: `Deploying maximum ERS energy battery output and opening DRS along the main straight, ${flName} recorded the benchmark lap time of the weekend at ${lastResult.circuitName}, adding a crucial extra point to their world championship tally.`,
        author: 'FIA Timing & Telemetry',
        timeAgo: '4 hours ago',
        importance: 'standard',
        readTime: '1 min read',
      });
    }
  } else {
    // Pre-season kickoff article
    articles.push({
      id: 'pre_season_preview',
      category: 'race_result',
      categoryLabel: 'Season Preview',
      categoryColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      source: 'BBC Sport F1',
      sourceBadge: 'BBC',
      title: `2026 FORMULA 1 PREVIEW: ${playerDriverName} Prepares for Season Opener at Bahrain`,
      excerpt: `Pre-season testing in Sakhir has concluded. High-downforce floor updates, aggressive sidepod designs, and new power unit upgrades set the stage.`,
      content: `The 2026 FIA Formula 1 World Championship begins at the Bahrain International Circuit. All eyes are on rookie phenom ${playerDriverName} piloting the MoneyGram Haas F1 challenger. With tight regulations and fierce competition from Red Bull, Ferrari, and McLaren, the battle for points promises to be explosive.`,
      author: 'Andrew Benson',
      timeAgo: '1 day ago',
      importance: 'featured',
      readTime: '4 min read',
    });
  }

  // ----------------------------------------------------
  // B. CHAMPIONSHIP STANDINGS & TITLE FIGHT STORIES
  // ----------------------------------------------------
  const titlePointsGap = p1Driver.points - p2Driver.points;
  articles.push({
    id: `champ_fight_${currentRoundIndex}`,
    category: 'championship',
    categoryLabel: 'Championship Battle',
    categoryColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    source: 'The Race',
    sourceBadge: 'THE RACE',
    title: `TITLE FIGHT: ${p1Driver.name} Holds ${titlePointsGap}pt Lead Over ${p2Driver.name}`,
    excerpt: `With ${10 - completedRounds.length} rounds remaining on the calendar, the battle for the FIA World Drivers' Championship is reaching fever pitch.`,
    content: `${p1Driver.name} continues to head the drivers' standings with ${p1Driver.points} points, but ${p2Driver.name} (${p2Driver.points} pts) remains within striking distance. Meanwhile, ${playerDriverName} is currently ranked P${playerRank} with ${playerEntry.points} points, keeping the pressure on the midfield contenders.`,
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
    categoryColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
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

  // ----------------------------------------------------
  // C. DRIVER MARKET & TRANSFERS (SILLY SEASON)
  // ----------------------------------------------------
  if (season.career.customTeam) {
    const customTeam = season.career.customTeam;
    articles.push({
      id: 'custom_team_spotlight',
      category: 'transfer',
      categoryLabel: '11th Constructor Spotlight',
      categoryColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      source: 'Motorsport.com',
      sourceBadge: 'MOTORSPORT',
      title: `PADDOCK EXCLUSIVE: ${customTeam.name} Expands Operations with Works ${customTeam.engine || 'Turbo'} PU`,
      excerpt: `The grid's boldest independent entrant continues to shake up Formula 1 with aggressive engineering and contract scouting.`,
      content: `Under team owner ${playerDriverName}, ${customTeam.name} has captured the paddock's imagination. With power unit performance reaching ${customTeam.enginePower || 85} rating and reliability at ${customTeam.engineReliability || 80}%, rival teams are taking serious notice of the squad's championship aspirations.`,
      author: 'Adam Cooper',
      timeAgo: '8 hours ago',
      relatedTeamId: customTeam.id,
      importance: 'featured',
      readTime: '3 min read',
    });
  } else {
    articles.push({
      id: 'driver_market_rumors',
      category: 'transfer',
      categoryLabel: 'Driver Market',
      categoryColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      source: 'Sky Sports F1',
      sourceBadge: 'SKY',
      title: `SILLY SEASON: Top Teams Keeping Watch on ${playerDriverName}'s Contract Status`,
      excerpt: `Sensational rookie performances have prompted discussions up and down the paddock regarding potential buyout clauses.`,
      content: `With ${playerDriverName}'s reputation currently standing at ${season.career.reputation}%, rival team principals are rumored to be exploring multi-million dollar signing packages. Haas team principal Ayao Komatsu maintains the squad will fight tooth and nail to retain their star asset.`,
      author: 'Craig Slater',
      timeAgo: '9 hours ago',
      relatedTeamId: 'haas',
      importance: 'featured',
      readTime: '2 min read',
    });
  }

  articles.push({
    id: 'bearman_contract_news',
    category: 'transfer',
    categoryLabel: 'Paddock Contracts',
    categoryColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    source: 'Formula1.com',
    sourceBadge: 'F1',
    title: `PADDOCK WHISPERS: Ferrari Driver Academy Evaluates Multi-Year Seat Strategy`,
    excerpt: `Ollie Bearman and Kimi Antonelli continue to draw praise as Formula 1's next generation cements their presence on the grid.`,
    content: `The driver market for 2027 and beyond is already taking shape. Ferrari management has praised the rapid development of their academy graduates, while Mercedes continues to invest heavily in aerodynamic wind tunnel simulations for their upcoming driver lineup.`,
    author: 'Lawrence Barretto',
    timeAgo: '12 hours ago',
    relatedDriverId: 'bearman',
    importance: 'standard',
    readTime: '2 min read',
  });

  // ----------------------------------------------------
  // D. TECHNICAL & AERODYNAMIC DEBRIEFS
  // ----------------------------------------------------
  articles.push({
    id: `tech_debrief_${currentCircuit.id}`,
    category: 'technical',
    categoryLabel: 'Technical Analysis',
    categoryColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
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

  articles.push({
    id: 'pirelli_tire_windows',
    category: 'technical',
    categoryLabel: 'Pirelli Strategy',
    categoryColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    source: 'Pirelli Motorsport',
    sourceBadge: 'PIRELLI',
    title: `PIRELLI STRATEGY BRIEF: Thermal Degradation Windows for ${currentCircuit.name}`,
    excerpt: `Pirelli brings the Soft (C5), Medium (C3), and Hard (C1) compounds. Mind overheating on long stint exits.`,
    content: `Pirelli head of motorsport Mario Isola confirmed that aggressive curbs at ${currentCircuit.name} place intense lateral loads on tire sidewalls. Drivers who master early apex rotation and avoid snap-oversteer wheelspin will enjoy a 4-lap longer stint window on Mediums.`,
    author: 'Mario Isola',
    timeAgo: '1 day ago',
    importance: 'standard',
    readTime: '2 min read',
  });

  return articles;
}

export const Newsfeed: React.FC<NewsfeedProps> = ({ season, onNavigateToTab }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

  const articles = useMemo(() => generatePaddockNews(season), [season]);

  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchesCategory = selectedCategory === 'all' || art.category === selectedCategory;
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

  const breakingArticle = articles.find((a) => a.importance === 'breaking') || articles[0];

  return (
    <div className="space-y-6">
      {/* 1. Header & Live Paddock Wire Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500 flex-shrink-0 shadow-lg shadow-red-950/40">
            <Newspaper className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500">
                Official FIA Media Wire
              </span>
              <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                LIVE WIRE
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-wide mt-0.5">
              Paddock News & Press Center
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Breaking race results, championship point debriefs, and driver transfer rumors.
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="w-full md:w-72 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search paddock headlines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>
      </div>

      {/* 2. Top Breaking Headline Card */}
      {breakingArticle && selectedCategory === 'all' && !searchQuery && (
        <div
          onClick={() => setExpandedArticleId(expandedArticleId === breakingArticle.id ? null : breakingArticle.id)}
          className="p-6 rounded-2xl bg-gradient-to-r from-red-950/40 via-neutral-900 to-neutral-950 border-2 border-red-500/40 hover:border-red-500 transition-all shadow-2xl cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 px-4 py-1.5 bg-red-600 text-white font-black text-[10px] uppercase tracking-wider rounded-bl-xl shadow-md">
            BREAKING NEWS
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] bg-red-500/20 text-red-300 font-mono font-black px-2 py-0.5 rounded border border-red-400/30">
              {breakingArticle.sourceBadge}
            </span>
            <span className="text-xs font-bold text-neutral-400">{breakingArticle.source}</span>
            <span className="text-neutral-600">•</span>
            <span className="text-xs text-neutral-400 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-neutral-500" />
              {breakingArticle.timeAgo}
            </span>
          </div>

          <h3 className="text-xl md:text-2xl font-black text-white group-hover:text-red-400 transition-colors leading-tight">
            {breakingArticle.title}
          </h3>

          <p className="text-xs md:text-sm text-neutral-300 mt-2 leading-relaxed">
            {breakingArticle.excerpt}
          </p>

          {expandedArticleId === breakingArticle.id && (
            <div className="mt-4 pt-4 border-t border-red-500/20 text-xs text-neutral-200 leading-relaxed space-y-3">
              <p>{breakingArticle.content}</p>
              <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 font-mono">
                <span>Report by: {breakingArticle.author}</span>
                <span>{breakingArticle.readTime}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-800 text-xs">
            <span className="text-red-400 font-bold flex items-center gap-1">
              <span>{expandedArticleId === breakingArticle.id ? 'Collapse Story' : 'Read Full Paddock Report'}</span>
              <ChevronRight className="w-4 h-4" />
            </span>
            <span className="text-neutral-500 text-[11px] font-mono">Official FIA Press Release</span>
          </div>
        </div>
      )}

      {/* 3. Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: 'All Stories', icon: Newspaper },
          { id: 'race_result', label: 'Race Results', icon: Flag },
          { id: 'championship', label: 'Title Battles', icon: TrendingUp },
          { id: 'transfer', label: 'Driver Transfers', icon: Users },
          { id: 'technical', label: 'Tech & Setups', icon: Zap },
        ].map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-red-600 text-white shadow-lg shadow-red-950/50 ring-2 ring-red-400/40'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Filtered Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredArticles.map((article) => {
          const isExpanded = expandedArticleId === article.id;
          const isBookmarked = bookmarkedIds.has(article.id);

          return (
            <div
              key={article.id}
              className={`p-5 rounded-2xl bg-neutral-900 border transition-all flex flex-col justify-between gap-4 ${
                isExpanded ? 'border-red-500/50 shadow-xl bg-neutral-900/90' : 'border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div>
                {/* Meta Header */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border font-mono ${article.categoryColor}`}>
                      {article.categoryLabel}
                    </span>
                    <span className="text-[11px] font-bold text-neutral-400">{article.source}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-neutral-500 font-mono">{article.timeAgo}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(article.id);
                      }}
                      className="p-1 text-neutral-500 hover:text-amber-400 transition-colors"
                      title={isBookmarked ? 'Bookmarked' : 'Save article'}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h4
                  onClick={() => setExpandedArticleId(isExpanded ? null : article.id)}
                  className="font-black text-white text-base hover:text-red-400 transition-colors cursor-pointer leading-snug"
                >
                  {article.title}
                </h4>

                {/* Excerpt */}
                <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                  {article.excerpt}
                </p>

                {/* Expanded Full Article View */}
                {isExpanded && (
                  <div className="mt-3.5 pt-3.5 border-t border-neutral-800 text-xs text-neutral-300 leading-relaxed space-y-2.5 animate-fadeIn">
                    <p>{article.content}</p>
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
                  onClick={() => setExpandedArticleId(isExpanded ? null : article.id)}
                  className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{isExpanded ? 'Show Less' : 'Full Story'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {article.category === 'championship' && onNavigateToTab && (
                  <button
                    onClick={() => onNavigateToTab('standings')}
                    className="text-neutral-400 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>View Standings</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}

                {article.category === 'transfer' && onNavigateToTab && (
                  <button
                    onClick={() => onNavigateToTab('contracts')}
                    className="text-neutral-400 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Paddock Market</span>
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
          <h4 className="text-white font-bold text-sm">No Paddock Stories Found</h4>
          <p className="text-xs text-neutral-400">
            No headlines matched your search &quot;{searchQuery}&quot;. Try a different keyword or reset filters.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl transition-all"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * BreakingNewsTicker
 * A sleek horizontal ticker suitable for mounting directly onto the Race Weekend Hub.
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
      title="Click to open Paddock Newsfeed"
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600 text-white font-black text-[10px] tracking-wider uppercase flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          PADDOCK WIRE
        </span>
        <span className="text-[11px] text-red-400 font-mono font-bold flex-shrink-0">
          [{currentHeadline.sourceBadge}]
        </span>
        <span className="text-neutral-200 truncate font-semibold group-hover:text-white transition-colors">
          {currentHeadline.title}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-red-400 font-bold flex-shrink-0 text-[11px]">
        <span className="hidden sm:inline">Paddock News</span>
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
};
