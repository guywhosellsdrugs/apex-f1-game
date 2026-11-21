import {
  ALL_MARYLAND_ROADS,
  MD_LANDMARKS,
  ICM_PLAYER_SPAWN,
  gx,
  gz,
  isOnMarylandPavedSurface,
} from '../game/marylandRoadNetwork';

export interface GeoLatLng {
  lat: number;
  lng: number;
}

export interface MarylandGeoAnchor {
  id: string;
  name: string;
  address: string;
  category: 'Mosque' | 'Neighborhood' | 'Landmarks' | 'Sports' | 'Pit & Meets' | 'Highway & Transit' | 'Heist / City';
  x: number;
  z: number;
  lat: number;
  lng: number;
  color: string;
  glyph: string;
  description: string;
}

/**
 * Calibrated control anchors mapping the 3D Maryland open-world coordinate system
 * (units in meters/scaled world coords) onto authentic Maryland WGS84 GPS coordinates.
 */
export const MARYLAND_GEO_ANCHORS: MarylandGeoAnchor[] = [
  {
    id: 'icm_campus',
    name: 'Islamic Center of Maryland (ICM)',
    address: '19411 Woodfield Rd, Gaithersburg, MD 20879',
    category: 'Mosque',
    x: MD_LANDMARKS.icmCampus.x,
    z: MD_LANDMARKS.icmCampus.z,
    lat: 39.17435,
    lng: -77.14765,
    color: '#10b981',
    glyph: 'ICM',
    description: 'Player home campus along MD-124 Woodfield Rd in Gaithersburg.',
  },
  {
    id: 'edinburgh_19624',
    name: '19624 Kildonan Dr (Edinburgh Village Corner)',
    address: '19624 Kildonan Dr, Montgomery Village, MD 20886',
    category: 'Neighborhood',
    x: gx(562),
    z: gz(1605),
    lat: 39.17832,
    lng: -77.1418,
    color: '#22c55e',
    glyph: 'HOME',
    description: 'Grand corner colonial estate at Kildonan Dr & Kilcreggan Way in Edinburgh Village.',
  },
  {
    id: 'hadley_farms',
    name: 'Hadley Farms & Resnik Elementary',
    address: '7301 Hadley Farms Dr, Gaithersburg, MD 20879',
    category: 'Neighborhood',
    x: MD_LANDMARKS.hadleyFarms.x,
    z: MD_LANDMARKS.hadleyFarms.z,
    lat: 39.18155,
    lng: -77.1392,
    color: '#16a34a',
    glyph: 'HF',
    description: 'Large Hadley Farms residential community north of Edinburgh Village.',
  },
  {
    id: 'mayhill_ct_2',
    name: '2 Mayhill Ct (Hadley Farms)',
    address: '2 Mayhill Ct, Gaithersburg, MD 20879',
    category: 'Neighborhood',
    x: gx(625),
    z: gz(1454),
    lat: 39.1842,
    lng: -77.1381,
    color: '#22c55e',
    glyph: '2MC',
    description: 'Hadley Farms cul-de-sac home at 2 Mayhill Ct off Tygart Ct.',
  },
  {
    id: 'rio_lakefront',
    name: 'RIO Lakefront & Washingtonian Center',
    address: '9841 Washingtonian Blvd, Gaithersburg, MD 20878',
    category: 'Landmarks',
    x: MD_LANDMARKS.rioLakefront.x,
    z: MD_LANDMARKS.rioLakefront.z,
    lat: 39.11572,
    lng: -77.20284,
    color: '#06b6d4',
    glyph: 'RIO',
    description: 'Waterfront boardwalk, shops, and lakefront plaza off I-270 Exit 9.',
  },
  {
    id: 'kgai_airpark',
    name: 'Montgomery County Airpark (KGAI)',
    address: '7940 Airpark Rd, Gaithersburg, MD 20879',
    category: 'Highway & Transit',
    x: MD_LANDMARKS.kgaiAirpark.x,
    z: MD_LANDMARKS.kgaiAirpark.z,
    lat: 39.16833,
    lng: -77.1462,
    color: '#64748b',
    glyph: 'KGAI',
    description: 'General aviation runway & hangar complex adjacent to Woodfield Rd.',
  },
  {
    id: 'shady_grove_metro',
    name: 'Shady Grove Metro Station (WMATA Red Line)',
    address: '15903 Somerville Dr, Derwood, MD 20855',
    category: 'Highway & Transit',
    x: MD_LANDMARKS.shadyGroveMetro.x,
    z: MD_LANDMARKS.shadyGroveMetro.z,
    lat: 39.11986,
    lng: -77.16493,
    color: '#ef4444',
    glyph: 'M',
    description: 'Northern terminus of the Washington Metro Red Line.',
  },
  {
    id: 'rockville_square',
    name: 'Rockville Town Square',
    address: '200 E Middle Ln, Rockville, MD 20850',
    category: 'Landmarks',
    x: MD_LANDMARKS.rockvilleSquare.x,
    z: MD_LANDMARKS.rockvilleSquare.z,
    lat: 39.08538,
    lng: -77.15284,
    color: '#3b82f6',
    glyph: 'RKV',
    description: 'Downtown Rockville civic plaza along MD-355 Rockville Pike.',
  },
  {
    id: 'bethesda_row',
    name: 'Downtown Bethesda & NIH Medical Center',
    address: '4800 Bethesda Ave, Bethesda, MD 20814',
    category: 'Landmarks',
    x: MD_LANDMARKS.bethesda.x,
    z: MD_LANDMARKS.bethesda.z,
    lat: 38.98105,
    lng: -77.09475,
    color: '#6366f1',
    glyph: 'BTH',
    description: 'I-495 Capital Beltway & Wisconsin Ave urban district.',
  },
  {
    id: 'silver_spring',
    name: 'Downtown Silver Spring',
    address: '8501 Colesville Rd, Silver Spring, MD 20910',
    category: 'Landmarks',
    x: MD_LANDMARKS.silverSpring.x,
    z: MD_LANDMARKS.silverSpring.z,
    lat: 38.99594,
    lng: -77.02798,
    color: '#8b5cf6',
    glyph: 'SS',
    description: 'Georgia Ave (MD-97) & Colesville Rd transit hub.',
  },
  {
    id: 'college_park_umd',
    name: 'University of Maryland (College Park)',
    address: 'Baltimore Ave & Campus Dr, College Park, MD 20742',
    category: 'Landmarks',
    x: MD_LANDMARKS.collegeParkUMD.x,
    z: MD_LANDMARKS.collegeParkUMD.z,
    lat: 38.98692,
    lng: -76.94255,
    color: '#dc2626',
    glyph: 'UMD',
    description: 'Flagship Terrapin campus off US-1 & I-95/I-495.',
  },
  {
    id: 'national_harbor',
    name: 'National Harbor & Woodrow Wilson Bridge',
    address: '165 Waterfront St, Oxon Hill, MD 20745',
    category: 'Landmarks',
    x: MD_LANDMARKS.nationalHarbor.x,
    z: MD_LANDMARKS.nationalHarbor.z,
    lat: 38.78495,
    lng: -77.01675,
    color: '#0ea5e9',
    glyph: 'NH',
    description: 'Potomac Riverfront resort & Capital Wheel on I-495/I-95.',
  },
  {
    id: 'olney',
    name: 'Olney Town Center (MD-97 & MD-108)',
    address: '18101 Georgia Ave, Olney, MD 20832',
    category: 'Neighborhood',
    x: MD_LANDMARKS.olney.x,
    z: MD_LANDMARKS.olney.z,
    lat: 39.15316,
    lng: -77.06692,
    color: '#22c55e',
    glyph: 'OLN',
    description: 'Crossroads of Georgia Ave & Olney-Sandy Spring Rd.',
  },
  {
    id: 'columbia',
    name: 'Columbia Town Center',
    address: '10300 Little Patuxent Pkwy, Columbia, MD 21044',
    category: 'Landmarks',
    x: MD_LANDMARKS.columbia.x,
    z: MD_LANDMARKS.columbia.z,
    lat: 39.21562,
    lng: -76.85942,
    color: '#14b8a6',
    glyph: 'CLM',
    description: 'Howard County Lake Kittamaqundi & Merriweather corridor.',
  },
  {
    id: 'isb_campus',
    name: 'Islamic Society of Baltimore (ISB)',
    address: '6631 Johnnycake Rd, Gwynn Oak, MD 21244',
    category: 'Mosque',
    x: MD_LANDMARKS.isbCampus.x,
    z: MD_LANDMARKS.isbCampus.z,
    lat: 39.31065,
    lng: -76.74382,
    color: '#eab308',
    glyph: 'ISB',
    description: 'West Baltimore campus near I-695 & I-70.',
  },
  {
    id: 'baltimore_harbor',
    name: 'Baltimore Inner Harbor & Bank District',
    address: '301 E Pratt St, Baltimore, MD 21202',
    category: 'Heist / City',
    x: MD_LANDMARKS.baltimoreInnerHarbor.x,
    z: MD_LANDMARKS.baltimoreInnerHarbor.z,
    lat: 39.28582,
    lng: -76.61308,
    color: '#f59e0b',
    glyph: 'BALT',
    description: 'Downtown Baltimore waterfront, Federal Bank vault & Police HQ.',
  },
  {
    id: 'bwi_airport',
    name: 'BWI Thurgood Marshall Airport',
    address: '7050 Friendship Rd, Baltimore, MD 21240',
    category: 'Highway & Transit',
    x: MD_LANDMARKS.bwiAirport.x,
    z: MD_LANDMARKS.bwiAirport.z,
    lat: 39.1774,
    lng: -76.6684,
    color: '#38bdf8',
    glyph: 'BWI',
    description: 'International terminal & I-195 airport expressway.',
  },
  {
    id: 'annapolis',
    name: 'Annapolis Historic District & State House',
    address: '100 State Cir, Annapolis, MD 21401',
    category: 'Landmarks',
    x: MD_LANDMARKS.annapolisStateHouse.x,
    z: MD_LANDMARKS.annapolisStateHouse.z,
    lat: 38.97882,
    lng: -76.49098,
    color: '#0ea5e9',
    glyph: 'ANN',
    description: 'Maryland State Capital & US Naval Academy City Dock.',
  },
  {
    id: 'bay_bridge',
    name: 'Chesapeake Bay Bridge (US-50)',
    address: 'Chesapeake Bay Bridge, Stevensville, MD 21666',
    category: 'Highway & Transit',
    x: MD_LANDMARKS.chesapeakeBayBridgeMid.x,
    z: MD_LANDMARKS.chesapeakeBayBridgeMid.z,
    lat: 38.9917,
    lng: -76.3736,
    color: '#94a3b8',
    glyph: 'BAY',
    description: '4.3-mile dual-span crossing to Kent Island & Eastern Shore.',
  },
  {
    id: 'ocean_city',
    name: 'Ocean City Boardwalk & Coastal Hwy',
    address: '801 N Boardwalk, Ocean City, MD 21842',
    category: 'Landmarks',
    x: MD_LANDMARKS.oceanCityBoardwalk.x,
    z: MD_LANDMARKS.oceanCityBoardwalk.z,
    lat: 38.3365,
    lng: -75.0849,
    color: '#f97316',
    glyph: 'OC',
    description: 'Atlantic Ocean beachfront & Inlet Boardwalk.',
  },
  {
    id: 'frederick',
    name: 'Downtown Frederick & Carroll Creek',
    address: '101 N Market St, Frederick, MD 21701',
    category: 'Landmarks',
    x: MD_LANDMARKS.frederick.x,
    z: MD_LANDMARKS.frederick.z,
    lat: 39.41427,
    lng: -77.41054,
    color: '#a855f7',
    glyph: 'FDK',
    description: 'Historic clustered spires at I-70, I-270 & US-15.',
  },
  {
    id: 'hagerstown',
    name: 'Hagerstown City Center (I-81 / I-70)',
    address: '1 E Franklin St, Hagerstown, MD 21740',
    category: 'Landmarks',
    x: MD_LANDMARKS.hagerstown.x,
    z: MD_LANDMARKS.hagerstown.z,
    lat: 39.64176,
    lng: -77.71999,
    color: '#a855f7',
    glyph: 'HGR',
    description: 'Hub City crossroads of I-81 and I-70 in Washington County.',
  },
  {
    id: 'cumberland',
    name: 'Cumberland Historic Narrows (I-68)',
    address: '57 N Liberty St, Cumberland, MD 21502',
    category: 'Landmarks',
    x: MD_LANDMARKS.cumberland.x,
    z: MD_LANDMARKS.cumberland.z,
    lat: 39.65287,
    lng: -78.76252,
    color: '#7c3aed',
    glyph: 'CUMB',
    description: 'Western Maryland Queen City along the I-68 National Freeway.',
  },
  {
    id: 'deep_creek',
    name: 'Deep Creek Lake & Wisp Resort',
    address: '296 Marsh Hill Rd, McHenry, MD 21541',
    category: 'Landmarks',
    x: MD_LANDMARKS.deepCreekLake.x,
    z: MD_LANDMARKS.deepCreekLake.z,
    lat: 39.55536,
    lng: -79.36475,
    color: '#0284c7',
    glyph: 'DCL',
    description: 'Garrett County mountain lake & US-219 Glendale Bridge.',
  },
  {
    id: 'icm_basketball',
    name: 'ICM Indoor Gym Basketball Court',
    address: '19411 Woodfield Rd, Gaithersburg, MD 20879',
    category: 'Sports',
    x: MD_LANDMARKS.icmBasketballCourt.x,
    z: MD_LANDMARKS.icmBasketballCourt.z,
    lat: 39.1726,
    lng: -77.1459,
    color: '#f97316',
    glyph: 'BBALL',
    description: 'ICM Indoor Gym Hardwood — 1v1–5v5 Half/Full & Hard 5v5 Tournament.',
  },
  {
    id: 'bohrer_football',
    name: 'Bohrer Park Gridiron Football Stadium',
    address: '512 S Frederick Ave, Gaithersburg, MD 20877',
    category: 'Sports',
    x: MD_LANDMARKS.bohrerFootballField.x,
    z: MD_LANDMARKS.bohrerFootballField.z,
    lat: 39.1306,
    lng: -77.2074,
    color: '#dc2626',
    glyph: 'FB',
    description: 'Retro Bowl Gridiron Football — Playable Defense & 3-Round Tournament.',
  },
  {
    id: 'bohrer_baseball',
    name: 'Bohrer Park Baseball Diamond',
    address: '506 S Frederick Ave, Gaithersburg, MD 20877',
    category: 'Sports',
    x: MD_LANDMARKS.bohrerBaseballField.x,
    z: MD_LANDMARKS.bohrerBaseballField.z,
    lat: 39.1322,
    lng: -77.206,
    color: '#eab308',
    glyph: 'BASE',
    description: 'Pro 3-Inning Baseball Duel & Championship Tournament.',
  },
  {
    id: 'bohrer_soccer',
    name: 'Bohrer Park Turf Soccer Pitch',
    address: '506 S Frederick Ave (South Field), Gaithersburg, MD 20877',
    category: 'Sports',
    x: MD_LANDMARKS.bohrerSoccerField.x,
    z: MD_LANDMARKS.bohrerSoccerField.z,
    lat: 39.1314,
    lng: -77.2065,
    color: '#10b981',
    glyph: 'SOC',
    description: '3v3 & 5v5 Retro Turf Soccer + 5v5 Championship Tournament.',
  },
  {
    id: 'gaithersburg_golf_links',
    name: 'Gaithersburg Country Club Retro Links',
    address: 'Redland Rd & Norbeck Links, Gaithersburg, MD 20877',
    category: 'Sports',
    x: MD_LANDMARKS.gaithersburgGolfField.x,
    z: MD_LANDMARKS.gaithersburgGolfField.z,
    lat: 39.1465,
    lng: -77.1518,
    color: '#22c55e',
    glyph: 'GOLF',
    description: '3-Hole Championship Retro Links with 3D Ballistics, Break & Wind.',
  },
  {
    id: 'crown_bowling',
    name: 'Downtown Crown Neon Bowling Lanes',
    address: 'Crown Park Ave & Washingtonian Blvd, Gaithersburg, MD 20878',
    category: 'Sports',
    x: MD_LANDMARKS.rioBowlingArcade.x,
    z: MD_LANDMARKS.rioBowlingArcade.z,
    lat: 39.1182,
    lng: -77.1972,
    color: '#a855f7',
    glyph: 'BOWL',
    description: '5-Frame Neon Bowling Alley — Strikes, Spares & High-Game Bonus.',
  },
  {
    id: 'rio_fishing',
    name: 'RIO Lakefront Boardwalk Fishing Pier',
    address: '9841 Washingtonian Blvd, Gaithersburg, MD 20878',
    category: 'Sports',
    x: MD_LANDMARKS.rioFishingPier.x,
    z: MD_LANDMARKS.rioFishingPier.z,
    lat: 39.1154,
    lng: -77.2038,
    color: '#06b6d4',
    glyph: 'FISH',
    description: 'Catch Largemouth Bass, Blue Crabs & Trophy Muskies.',
  },
  {
    id: 'camden_yards_baseball',
    name: 'Oriole Park at Camden Yards',
    address: '333 W Camden St, Baltimore, MD 21201',
    category: 'Sports',
    x: MD_LANDMARKS.baltimoreCamdenYards.x,
    z: MD_LANDMARKS.baltimoreCamdenYards.z,
    lat: 39.28388,
    lng: -76.62161,
    color: '#f59e0b',
    glyph: 'O\'s',
    description: 'Baltimore Pro Baseball Showdown & 3-Round Tournament.',
  },
  {
    id: 'ravens_mt_bank',
    name: 'M&T Bank Ravens Football Stadium',
    address: '1101 Russell St, Baltimore, MD 21230',
    category: 'Sports',
    x: 1132,
    z: -6,
    color: '#7c3aed',
    lat: 39.27798,
    lng: -76.62271,
    glyph: 'BAL',
    description: 'Home of Baltimore Retro Pro Football Showdowns & Tournament.',
  },
  {
    id: 'annapolis_fishing',
    name: 'Annapolis City Dock Crab & Bass Pier',
    address: '1 Dock St, Annapolis, MD 21401',
    category: 'Sports',
    x: MD_LANDMARKS.annapolisFishingDock.x,
    z: MD_LANDMARKS.annapolisFishingDock.z,
    lat: 38.9768,
    lng: -76.4864,
    color: '#0ea5e9',
    glyph: 'CRAB',
    description: 'Chesapeake Bay Rockfish & Jumbo Blue Crab Pier.',
  },
  {
    id: 'woodfield_shell_pit',
    name: 'Woodfield Shell V-Power Pit Stop',
    address: '19300 Woodfield Rd, Gaithersburg, MD 20879',
    category: 'Pit & Meets',
    x: gx(448),
    z: gz(1760),
    lat: 39.1704,
    lng: -77.1515,
    color: '#f59e0b',
    glyph: 'FUEL',
    description: 'Instant full vehicle repair, armor & 100% Nitro refill pit.',
  },
  {
    id: 'rio_crown_meet',
    name: 'RIO Lakefront & Crown Car Meet',
    address: 'Washingtonian Blvd Promenade, Gaithersburg, MD 20878',
    category: 'Pit & Meets',
    x: gx(-378),
    z: gz(2285),
    lat: 39.1159,
    lng: -77.1995,
    color: '#ec4899',
    glyph: 'MEET',
    description: 'Friday night supercar showcase, neon bowling & pier fishing.',
  },
];

export const DEFAULT_MARYLAND_CENTER: GeoLatLng = {
  lat: 39.17435,
  lng: -77.14765,
};

export const DEFAULT_SPAWN_WORLD = {
  x: ICM_PLAYER_SPAWN.x,
  z: ICM_PLAYER_SPAWN.z,
  heading: ICM_PLAYER_SPAWN.heading,
};

/**
 * Inverse-Distance-Weighted multi-anchor projection from 3D Maryland game world (x, z)
 * to WGS84 (lat, lng). Includes a smooth linear baseline for far off-anchor coordinates.
 */
export function worldToLatLng(x: number, z: number): GeoLatLng {
  let weightSum = 0;
  let latSum = 0;
  let lngSum = 0;

  for (const a of MARYLAND_GEO_ANCHORS) {
    const dx = x - a.x;
    const dz = z - a.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < 1) {
      return { lat: a.lat, lng: a.lng };
    }
    const w = 1 / Math.pow(distSq + 1200, 1.35);
    weightSum += w;
    latSum += w * a.lat;
    lngSum += w * a.lng;
  }

  return {
    lat: Number((latSum / weightSum).toFixed(6)),
    lng: Number((lngSum / weightSum).toFixed(6)),
  };
}

/**
 * Inverse-Distance-Weighted projection from real Google Maps (lat, lng)
 * back into the 3D Maryland driving world (x, z) so clicking anywhere on Google Maps
 * or searching a real Place sets an accurate in-game GPS waypoint.
 */
export function latLngToWorld(lat: number, lng: number): { x: number; z: number } {
  let weightSum = 0;
  let xSum = 0;
  let zSum = 0;

  for (const a of MARYLAND_GEO_ANCHORS) {
    const dLat = lat - a.lat;
    const dLng = (lng - a.lng) * 0.78;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < 1e-8) {
      return { x: Math.round(a.x), z: Math.round(a.z) };
    }
    const w = 1 / Math.pow(distSq + 0.00018, 1.5);
    weightSum += w;
    xSum += w * a.x;
    zSum += w * a.z;
  }

  // Clamp within playable Maryland bounding box and snap off-road projections to nearest drivable road
  const clampedX = Math.max(-2550, Math.min(2580, Math.round(xSum / weightSum)));
  const clampedZ = Math.max(-950, Math.min(2050, Math.round(zSum / weightSum)));

  if (isOnMarylandPavedSurface(clampedX, clampedZ)) {
    return { x: clampedX, z: clampedZ };
  }

  let bestD2 = Infinity;
  let bestX = clampedX;
  let bestZ = clampedZ;
  for (let rIdx = 0; rIdx < ALL_MARYLAND_ROADS.length; rIdx++) {
    const road = ALL_MARYLAND_ROADS[rIdx];
    for (let i = 0; i < road.points.length - 1; i++) {
      const a = road.points[i];
      const b = road.points[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l2 = dx * dx + dz * dz;
      if (l2 < 0.001) continue;
      const t = Math.max(0, Math.min(1, ((clampedX - a.x) * dx + (clampedZ - a.z) * dz) / l2));
      const cx = a.x + dx * t;
      const cz = a.z + dz * t;
      const d2 = (clampedX - cx) * (clampedX - cx) + (clampedZ - cz) * (clampedZ - cz);
      if (d2 < bestD2) {
        bestD2 = d2;
        bestX = cx;
        bestZ = cz;
      }
    }
  }

  if (bestD2 > 48 * 48) {
    return { x: Math.round(bestX), z: Math.round(bestZ) };
  }
  return { x: clampedX, z: clampedZ };
}
