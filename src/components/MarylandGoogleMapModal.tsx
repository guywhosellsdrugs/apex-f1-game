import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  MapMouseEvent,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  MARYLAND_GEO_ANCHORS,
  MarylandGeoAnchor,
  GeoLatLng,
  DEFAULT_MARYLAND_CENTER,
  worldToLatLng,
  latLngToWorld,
} from '../utils/marylandGeoProjection';
import { X, Navigation, MapPin, Layers, Car, Search, Route as RouteIcon, Compass, ExternalLink } from 'lucide-react';

export interface MarylandGoogleMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerWorldPos?: { x: number; z: number; heading?: number } | null;
  activeGpsLabel?: string | null;
  activeGpsCoords?: { x: number; z: number } | null;
  onSetInGameGpsTarget?: (worldX: number, worldZ: number, label: string, color?: string) => void;
  onClearInGameGpsTarget?: () => void;
  onLaunchMarylandDriveWithTarget?: (worldX: number, worldZ: number, label: string) => void;
}

interface SelectedDestination {
  label: string;
  address: string;
  latLng: GeoLatLng;
  worldPos: { x: number; z: number };
  color: string;
}

interface RouteSummary {
  distanceText: string;
  durationText: string;
  originLabel: string;
  destinationLabel: string;
}

function getGoogleMapsApiKey(): string {
  const viteKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (typeof viteKey === 'string' && viteKey.trim().length > 0 && viteKey !== 'MY_GOOGLE_MAPS_API_KEY') {
    return viteKey.trim();
  }
  const fallbackKey = typeof process !== 'undefined' ? process.env.GOOGLE_MAPS_API_KEY : '';
  if (typeof fallbackKey === 'string' && fallbackKey.trim().length > 0 && fallbackKey !== 'MY_GOOGLE_MAPS_API_KEY') {
    return fallbackKey.trim();
  }
  return '';
}

function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const text =
    typeof err === 'string'
      ? err
      : err instanceof Error
      ? `${err.name} ${err.message}`
      : JSON.stringify(err);
  const upper = text.toUpperCase();
  return (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('QUOTA_EXCEEDED') ||
    upper.includes('OVERQUOTA') ||
    upper.includes('429')
  );
}

function dispatchQuotaExceeded(): void {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
}

function formatDistanceMeters(meters: number | undefined): string {
  if (!meters || !Number.isFinite(meters)) return '—';
  const miles = meters / 1609.344;
  if (miles < 0.2) {
    return `${Math.round(meters * 3.28084)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

function formatDurationMillis(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  const totalMins = Math.max(1, Math.round(ms / 60000));
  if (totalMins < 60) return `${totalMins} min`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}

const MARYLAND_SEARCH_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 39.75,
  south: 37.9,
  east: -75.0,
  west: -79.55,
};

function useMarylandAutocompleteSuggestions(query: string) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!placesLib) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearchError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        setIsLoading(true);
        setSearchError(null);

        const request: google.maps.places.AutocompleteRequest = {
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['us'],
          locationBias: MARYLAND_SEARCH_BOUNDS,
          language: 'en',
          region: 'US',
        };

        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (cancelled) return;
        setSuggestions(Array.isArray(response?.suggestions) ? response.suggestions : []);
      } catch (err) {
        if (cancelled) return;
        if (isQuotaError(err)) {
          dispatchQuotaExceeded();
          setSearchError('Google Maps search quota reached.');
        } else {
          setSearchError('Unable to fetch address suggestions right now.');
        }
        setSuggestions([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, query]);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
  }, []);

  return {
    placesLib,
    suggestions,
    isLoading,
    searchError,
    resetSession,
  };
}

const PlaceSearchPanel: React.FC<{
  onPlaceResolved: (dest: SelectedDestination, viewport?: google.maps.LatLngBounds | null) => void;
}> = ({ onPlaceResolved }) => {
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [busySelection, setBusySelection] = useState(false);
  const { placesLib, suggestions, isLoading, searchError, resetSession } =
    useMarylandAutocompleteSuggestions(query);

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      setBusySelection(true);
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
        });

        const loc = place.location;
        if (loc) {
          const lat = loc.lat();
          const lng = loc.lng();
          const label = place.displayName || suggestion.placePrediction.text.text || 'Selected Location';
          const address = place.formattedAddress || suggestion.placePrediction.text.text || '';
          const worldPos = latLngToWorld(lat, lng);

          onPlaceResolved(
            {
              label,
              address,
              latLng: { lat, lng },
              worldPos,
              color: '#ec4899',
            },
            place.viewport ?? null
          );
          setQuery(address || label);
          setDropdownOpen(false);
        }
        resetSession();
      } catch (err) {
        if (isQuotaError(err)) {
          dispatchQuotaExceeded();
        }
      } finally {
        setBusySelection(false);
      }
    },
    [placesLib, onPlaceResolved, resetSession]
  );

  return (
    <div className="relative flex-1 min-w-[230px]" onKeyDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 bg-zinc-900 border border-sky-400/40 focus-within:border-sky-400 rounded-xl px-3 py-2 shadow-inner">
        <Search className="w-4 h-4 text-sky-400 shrink-0" />
        <input
          type="text"
          value={query}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => window.setTimeout(() => setDropdownOpen(false), 180)}
          onChange={(e) => {
            setQuery(e.target.value);
            setDropdownOpen(true);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && suggestions.length > 0) {
              e.preventDefault();
              void handleSelectSuggestion(suggestions[0]);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDropdownOpen(false);
            }
          }}
          placeholder="Search any real Maryland address, landmark, or business..."
          className="w-full min-w-0 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
        />
        {(isLoading || busySelection) && (
          <span className="text-[10px] font-mono text-sky-300 shrink-0 animate-pulse">Searching…</span>
        )}
        {query && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery('');
              resetSession();
            }}
            className="text-xs text-zinc-400 hover:text-white px-1 cursor-pointer shrink-0"
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {dropdownOpen && (query.trim().length >= 2 || searchError) && (
        <div className="absolute left-0 right-0 top-full mt-1.5 max-h-64 overflow-y-auto bg-zinc-950/98 border border-sky-400/45 rounded-xl shadow-2xl z-50 divide-y divide-white/10">
          {searchError ? (
            <div className="px-3 py-2.5 text-xs text-amber-300">{searchError}</div>
          ) : suggestions.length === 0 && !isLoading ? (
            <div className="px-3 py-2.5 text-xs text-zinc-400">
              No places matched "{query}". Try e.g. "19411 Woodfield Rd", "Inner Harbor Baltimore", or "Ocean City Boardwalk".
            </div>
          ) : (
            suggestions.map((suggestion, idx) => {
              const prediction = suggestion.placePrediction;
              if (!prediction) return null;
              return (
                <button
                  key={prediction.placeId || idx}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void handleSelectSuggestion(suggestion);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-sky-500/20 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">
                      {prediction.mainText?.text || prediction.text.text}
                    </div>
                    {prediction.secondaryText?.text && (
                      <div className="text-[11px] text-zinc-400 truncate">
                        {prediction.secondaryText.text}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const TrafficLayerOverlay: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;

    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new mapsLib.TrafficLayer();
    }
    trafficLayerRef.current.setMap(enabled ? map : null);

    return () => {
      trafficLayerRef.current?.setMap(null);
    };
  }, [map, mapsLib, enabled]);

  return null;
};

const RouteOverlay: React.FC<{
  origin: GeoLatLng;
  destination: GeoLatLng | null;
  originLabel: string;
  destinationLabel: string;
  onRouteSummaryChange: (summary: RouteSummary | null, errorMsg: string | null) => void;
}> = ({ origin, destination, originLabel, destinationLabel, onRouteSummaryChange }) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    for (const p of polylinesRef.current) {
      p.setMap(null);
    }
    polylinesRef.current = [];

    if (!map || !routesLib || !destination) {
      onRouteSummaryChange(null, null);
      return;
    }

    let cancelled = false;

    const runCompute = async () => {
      try {
        const request: google.maps.routes.ComputeRoutesRequest = {
          origin,
          destination,
          travelMode: routesLib.TravelMode.DRIVING,
          routingPreference: 'TRAFFIC_AWARE',
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'localizedValues'],
          language: 'en-US',
          region: 'US',
        };

        const response = await routesLib.Route.computeRoutes(request);
        if (cancelled) return;

        const route = response?.routes?.[0];
        if (!route) {
          onRouteSummaryChange(null, 'No driving route found between those coordinates.');
          return;
        }

        const created = route.createPolylines({
          polylineOptions: {
            strokeColor: '#38bdf8',
            strokeOpacity: 0.92,
            strokeWeight: 5,
          },
        });

        for (const p of created) {
          p.setMap(map);
        }
        polylinesRef.current = created;

        if (route.viewport) {
          map.fitBounds(route.viewport, 64);
        }

        const distanceText =
          route.localizedValues?.distance || formatDistanceMeters(route.distanceMeters);
        const durationText =
          route.localizedValues?.duration || formatDurationMillis(route.durationMillis);

        onRouteSummaryChange(
          {
            distanceText,
            durationText,
            originLabel,
            destinationLabel,
          },
          null
        );
      } catch (err) {
        if (cancelled) return;
        if (isQuotaError(err)) {
          dispatchQuotaExceeded();
          onRouteSummaryChange(null, 'Google Maps Routes quota reached.');
        } else {
          onRouteSummaryChange(null, 'Could not calculate road route to this point.');
        }
      }
    };

    void runCompute();

    return () => {
      cancelled = true;
      for (const p of polylinesRef.current) {
        p.setMap(null);
      }
      polylinesRef.current = [];
    };
  }, [map, routesLib, origin.lat, origin.lng, destination?.lat, destination?.lng, originLabel, destinationLabel, onRouteSummaryChange]);

  return null;
};

const LandmarkMarker: React.FC<{
  anchor: MarylandGeoAnchor;
  isSelected: boolean;
  isOpenInfo: boolean;
  onToggleInfo: (id: string | null) => void;
  onSelectForRoute: (anchor: MarylandGeoAnchor) => void;
  onSendToInGameGps?: (anchor: MarylandGeoAnchor) => void;
}> = ({ anchor, isSelected, isOpenInfo, onToggleInfo, onSelectForRoute, onSendToInGameGps }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: anchor.lat, lng: anchor.lng }}
        title={`${anchor.name} (${anchor.address})`}
        onClick={() => onToggleInfo(isOpenInfo ? null : anchor.id)}
      >
        <Pin
          background={isSelected ? '#ec4899' : anchor.color}
          borderColor={isSelected ? '#ffffff' : '#09090b'}
          glyphColor="#ffffff"
          glyphText={anchor.glyph}
          scale={isSelected ? 1.25 : 0.95}
        />
      </AdvancedMarker>
      {isOpenInfo && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={270}
          onCloseClick={() => onToggleInfo(null)}
        >
          <div className="text-zinc-900 space-y-1.5 p-0.5 font-sans">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-800">
                {anchor.category}
              </span>
            </div>
            <h4 className="font-bold text-sm leading-tight text-zinc-950">{anchor.name}</h4>
            <p className="text-[11px] text-zinc-600">{anchor.address}</p>
            <p className="text-[11px] text-zinc-700 leading-snug">{anchor.description}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onSelectForRoute(anchor)}
                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer"
              >
                Route Here
              </button>
              {onSendToInGameGps && (
                <button
                  type="button"
                  onClick={() => onSendToInGameGps(anchor)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                >
                  Set 3D Car GPS
                </button>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const PlayerCarMarker: React.FC<{
  position: GeoLatLng;
  isLiveDriving: boolean;
  isOpenInfo: boolean;
  onToggleInfo: (open: boolean) => void;
}> = ({ position, isLiveDriving, isOpenInfo, onToggleInfo }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={isLiveDriving ? 'Your Vehicle (Live Maryland GPS)' : 'Maryland Starting Campus (ICM)'}
        zIndex={999}
        onClick={() => onToggleInfo(!isOpenInfo)}
      >
        <Pin
          background="#facc15"
          borderColor="#000000"
          glyphColor="#000000"
          glyphText={isLiveDriving ? 'YOU' : 'CAR'}
          scale={1.2}
        />
      </AdvancedMarker>
      {isOpenInfo && marker && (
        <InfoWindow anchor={marker} maxWidth={230} onCloseClick={() => onToggleInfo(false)}>
          <div className="text-zinc-900 space-y-1 p-0.5 font-sans">
            <div className="font-black text-xs text-zinc-950">
              {isLiveDriving ? 'Your Active Vehicle' : 'Gaithersburg Spawn (19411 Woodfield Rd)'}
            </div>
            <div className="text-[11px] font-mono text-zinc-600">
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const SelectedPinMarker: React.FC<{
  destination: SelectedDestination;
  isOpenInfo: boolean;
  onToggleInfo: (open: boolean) => void;
  onSetGps?: () => void;
  onLaunchDrive?: () => void;
  onClear: () => void;
}> = ({ destination, isOpenInfo, onToggleInfo, onSetGps, onLaunchDrive, onClear }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={destination.latLng}
        title={destination.label}
        zIndex={950}
        onClick={() => onToggleInfo(!isOpenInfo)}
      >
        <Pin
          background="#ec4899"
          borderColor="#ffffff"
          glyphColor="#ffffff"
          glyphText="PIN"
          scale={1.25}
        />
      </AdvancedMarker>
      {isOpenInfo && marker && (
        <InfoWindow anchor={marker} maxWidth={270} onCloseClick={() => onToggleInfo(false)}>
          <div className="text-zinc-900 space-y-1.5 p-0.5 font-sans">
            <div className="font-bold text-sm text-zinc-950">{destination.label}</div>
            <div className="text-[11px] text-zinc-600">{destination.address}</div>
            <div className="text-[10px] font-mono text-zinc-500">
              3D World Pos: ({destination.worldPos.x}, {destination.worldPos.z})
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {onSetGps && (
                <button
                  type="button"
                  onClick={onSetGps}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                >
                  Set 3D Car GPS
                </button>
              )}
              {onLaunchDrive && (
                <button
                  type="button"
                  onClick={onLaunchDrive}
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer"
                >
                  Drive Here Now
                </button>
              )}
              <button
                type="button"
                onClick={onClear}
                className="px-2 py-1 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-[11px] font-semibold cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const CameraSyncHelper: React.FC<{
  targetCenter: GeoLatLng | null;
  targetViewport: google.maps.LatLngBounds | null;
  targetZoom?: number;
  triggerKey: number;
}> = ({ targetCenter, targetViewport, targetZoom, triggerKey }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || triggerKey === 0) return;
    if (targetViewport) {
      map.fitBounds(targetViewport, 64);
    } else if (targetCenter) {
      map.panTo(targetCenter);
      if (targetZoom) map.setZoom(targetZoom);
    }
  }, [map, targetCenter, targetViewport, targetZoom, triggerKey]);

  return null;
};

const MapInnerWorkspace: React.FC<
  Omit<MarylandGoogleMapModalProps, 'isOpen'> & { hasApiKey: boolean }
> = ({
  hasApiKey,
  onClose,
  playerWorldPos,
  activeGpsLabel,
  activeGpsCoords,
  onSetInGameGpsTarget,
  onClearInGameGpsTarget,
  onLaunchMarylandDriveWithTarget,
}) => {
  const loadingStatus = useApiLoadingStatus();

  useEffect(() => {
    if (loadingStatus === APILoadingStatus.AUTH_FAILURE) {
      dispatchQuotaExceeded();
    }
  }, [loadingStatus]);

  const playerLatLng = useMemo<GeoLatLng>(() => {
    if (playerWorldPos) {
      return worldToLatLng(playerWorldPos.x, playerWorldPos.z);
    }
    return DEFAULT_MARYLAND_CENTER;
  }, [playerWorldPos]);

  const [mapType, setMapType] = useState<'roadmap' | 'hybrid' | 'satellite' | 'terrain'>('roadmap');
  const [isDarkMap, setIsDarkMap] = useState<boolean>(true);
  const [showTraffic, setShowTraffic] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [openLandmarkId, setOpenLandmarkId] = useState<string | null>(null);
  const [openPlayerInfo, setOpenPlayerInfo] = useState<boolean>(false);
  const [openSelectedPinInfo, setOpenSelectedPinInfo] = useState<boolean>(false);
  const [selectedDest, setSelectedDest] = useState<SelectedDestination | null>(() => {
    if (activeGpsCoords) {
      return {
        label: activeGpsLabel || 'Active In-Game GPS Target',
        address: `3D World (${Math.round(activeGpsCoords.x)}, ${Math.round(activeGpsCoords.z)})`,
        latLng: worldToLatLng(activeGpsCoords.x, activeGpsCoords.z),
        worldPos: { x: Math.round(activeGpsCoords.x), z: Math.round(activeGpsCoords.z) },
        color: '#a855f7',
      };
    }
    return null;
  });

  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [cameraTarget, setCameraTarget] = useState<{
    center: GeoLatLng | null;
    viewport: google.maps.LatLngBounds | null;
    zoom?: number;
    key: number;
  }>({ center: null, viewport: null, key: 0 });

  const handleRouteSummaryChange = useCallback(
    (summary: RouteSummary | null, errMsg: string | null) => {
      setRouteSummary(summary);
      setRouteError(errMsg);
    },
    []
  );

  const handlePlaceResolved = useCallback(
    (dest: SelectedDestination, viewport?: google.maps.LatLngBounds | null) => {
      setSelectedDest(dest);
      setOpenLandmarkId(null);
      setOpenPlayerInfo(false);
      setOpenSelectedPinInfo(true);
      setCameraTarget((prev) => ({
        center: dest.latLng,
        viewport: viewport ?? null,
        zoom: viewport ? undefined : 14,
        key: prev.key + 1,
      }));
    },
    []
  );

  const handleSelectAnchor = useCallback((anchor: MarylandGeoAnchor) => {
    setSelectedDest({
      label: anchor.name,
      address: anchor.address,
      latLng: { lat: anchor.lat, lng: anchor.lng },
      worldPos: { x: Math.round(anchor.x), z: Math.round(anchor.z) },
      color: anchor.color,
    });
    setOpenLandmarkId(null);
    setOpenSelectedPinInfo(true);
    setCameraTarget((prev) => ({
      center: { lat: anchor.lat, lng: anchor.lng },
      viewport: null,
      zoom: 13,
      key: prev.key + 1,
    }));
  }, []);

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    const ll = e.detail?.latLng;
    if (!ll) return;
    const worldPos = latLngToWorld(ll.lat, ll.lng);
    setSelectedDest({
      label: 'Dropped Maryland GPS Pin',
      address: `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`,
      latLng: { lat: ll.lat, lng: ll.lng },
      worldPos,
      color: '#ec4899',
    });
    setOpenLandmarkId(null);
    setOpenPlayerInfo(false);
    setOpenSelectedPinInfo(true);
  }, []);

  const filteredAnchors = useMemo(() => {
    if (selectedCategory === 'ALL') return MARYLAND_GEO_ANCHORS;
    return MARYLAND_GEO_ANCHORS.filter((a) => a.category === selectedCategory);
  }, [selectedCategory]);

  const isFailedStatus =
    !hasApiKey ||
    loadingStatus === APILoadingStatus.FAILED ||
    loadingStatus === APILoadingStatus.AUTH_FAILURE;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="bg-zinc-950 border border-sky-500/35 w-full max-w-6xl h-[90vh] max-h-[820px] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header & Places Autocomplete Search */}
        <div className="bg-zinc-900/95 border-b border-white/10 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center text-black font-black shadow-lg">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-wide flex items-center gap-2">
                MARYLAND GOOGLE MAPS NAVIGATOR
              </h2>
              <p className="text-[11px] text-zinc-400">
                Search real places, view live traffic, compute Routes API directions &amp; sync to 3D car GPS
              </p>
            </div>
          </div>

          {!isFailedStatus && <PlaceSearchPanel onPlaceResolved={handlePlaceResolved} />}

          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        {/* Toolbar: Map Types, Traffic, Recenter, Category Filter */}
        <div className="bg-zinc-900/70 border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-zinc-400 font-bold flex items-center gap-1 mr-1">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              View:
            </span>
            {(['roadmap', 'hybrid', 'satellite', 'terrain'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMapType(t)}
                className={`px-2.5 py-1 rounded-lg font-bold capitalize cursor-pointer transition-colors ${
                  mapType === t
                    ? 'bg-sky-500 text-black'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {t}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setIsDarkMap((prev) => !prev)}
              className={`ml-1 px-2.5 py-1 rounded-lg font-bold cursor-pointer border transition-colors ${
                isDarkMap
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200'
                  : 'bg-amber-400/20 border-amber-300 text-amber-200'
              }`}
              title="Toggle Dark / Day Google Maps style"
            >
              {isDarkMap ? '🌙 Dark' : '☀️ Day'}
            </button>

            <button
              type="button"
              onClick={() => setShowTraffic((prev) => !prev)}
              className={`ml-1 px-2.5 py-1 rounded-lg font-bold cursor-pointer border transition-colors flex items-center gap-1 ${
                showTraffic
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-zinc-800 border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Live Traffic {showTraffic ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCameraTarget((prev) => ({
                  center: playerLatLng,
                  viewport: null,
                  zoom: 14,
                  key: prev.key + 1,
                }));
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-300 font-bold cursor-pointer flex items-center gap-1"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{playerWorldPos ? 'Center on My Car' : 'Gaithersburg (ICM)'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCameraTarget((prev) => ({
                  center: { lat: 39.0458, lng: -76.6413 },
                  viewport: null,
                  zoom: 8,
                  key: prev.key + 1,
                }));
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-200 font-bold cursor-pointer"
            >
              Full Maryland
            </button>
          </div>
        </div>

        {/* Main Content: Left Landmark Sidebar + Explicit-Height Google Map Canvas */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Left Panel: Landmarks + Route Summary + In-Game GPS Sync */}
          <div className="w-full md:w-80 bg-zinc-900/60 border-b md:border-b-0 md:border-r border-white/10 flex flex-col min-h-0 max-h-56 md:max-h-none">
            {/* Active Route / Selected Destination Card */}
            {selectedDest ? (
              <div className="p-3 border-b border-white/10 bg-sky-950/30 space-y-2 shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1">
                      <RouteIcon className="w-3 h-3" />
                      <span>Active Google Maps Target</span>
                    </div>
                    <div className="text-xs font-bold text-white truncate mt-0.5">
                      {selectedDest.label}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {selectedDest.address}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDest(null);
                      setRouteSummary(null);
                      setRouteError(null);
                    }}
                    className="text-xs text-zinc-400 hover:text-white px-1.5 py-0.5 rounded bg-zinc-800 cursor-pointer"
                    title="Clear destination"
                  >
                    ✕
                  </button>
                </div>

                {routeSummary && (
                  <div className="grid grid-cols-2 gap-1.5 text-center bg-zinc-950/80 border border-sky-400/30 rounded-lg p-1.5">
                    <div>
                      <div className="text-[9px] uppercase text-zinc-400 font-bold">Drive Distance</div>
                      <div className="text-xs font-black text-sky-300 font-mono">
                        {routeSummary.distanceText}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase text-zinc-400 font-bold">Live Traffic ETA</div>
                      <div className="text-xs font-black text-emerald-300 font-mono">
                        {routeSummary.durationText}
                      </div>
                    </div>
                  </div>
                )}

                {routeError && (
                  <div className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-lg px-2 py-1">
                    {routeError}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {onSetInGameGpsTarget && (
                    <button
                      type="button"
                      onClick={() => {
                        onSetInGameGpsTarget(
                          selectedDest.worldPos.x,
                          selectedDest.worldPos.z,
                          `🗺️ ${selectedDest.label}`,
                          '#38bdf8'
                        );
                        onClose();
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] uppercase cursor-pointer transition-colors"
                    >
                      Set 3D Car GPS &amp; Drive
                    </button>
                  )}
                  {!onSetInGameGpsTarget && onLaunchMarylandDriveWithTarget && (
                    <button
                      type="button"
                      onClick={() => {
                        onLaunchMarylandDriveWithTarget(
                          selectedDest.worldPos.x,
                          selectedDest.worldPos.z,
                          `🗺️ ${selectedDest.label}`
                        );
                        onClose();
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-black text-[11px] uppercase cursor-pointer transition-colors"
                    >
                      Launch MD Drive Here
                    </button>
                  )}
                  {onClearInGameGpsTarget && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearInGameGpsTarget();
                        setSelectedDest(null);
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[11px] cursor-pointer"
                    >
                      Clear GPS
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 border-b border-white/10 text-[11px] text-zinc-400 shrink-0">
                Click any Maryland landmark, search a real address above, or click anywhere on Google Maps to calculate a live driving route and sync it to your 3D vehicle GPS.
              </div>
            )}

            {/* Category Filter Pills */}
            <div className="px-3 py-2 border-b border-white/10 flex flex-wrap gap-1 shrink-0">
              {['ALL', 'Mosque', 'Sports', 'Pit & Meets', 'Neighborhood', 'Landmarks', 'Highway & Transit', 'Heist / City'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    selectedCategory === cat
                      ? 'bg-sky-500 text-black'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Landmark Directory List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredAnchors.map((anchor) => {
                const isSelected = selectedDest?.label === anchor.name;
                return (
                  <button
                    key={anchor.id}
                    type="button"
                    onClick={() => handleSelectAnchor(anchor)}
                    className={`w-full text-left p-2 rounded-xl border transition-all cursor-pointer flex items-start gap-2 ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-400 text-white'
                        : 'bg-zinc-900/80 border-white/5 hover:border-white/20 text-zinc-200'
                    }`}
                  >
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-black text-white shrink-0 mt-0.5"
                      style={{ backgroundColor: anchor.color }}
                    >
                      {anchor.glyph}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{anchor.name}</div>
                      <div className="text-[10px] text-zinc-400 truncate">{anchor.address}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Explicit-height Google Map Container (Prevents 0x0 collapse) */}
          <div className="relative flex-1 w-full min-h-[380px] h-full bg-zinc-900">
            {isFailedStatus ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-zinc-950">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                  <MapPin className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-white">
                  {!hasApiKey
                    ? 'Google Maps API Key Not Configured'
                    : 'Unable to Load Google Maps'}
                </h3>
                <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                  {!hasApiKey
                    ? 'Add VITE_GOOGLE_MAPS_API_KEY to your environment configuration to enable interactive Google Maps, live traffic, Places Autocomplete, and Routes API navigation.'
                    : 'Google Maps Platform returned an authentication or quota error. Please verify your API key restrictions and quota settings.'}
                </p>
                <a
                  href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sky-300 text-xs font-bold border border-white/10"
                >
                  <span>Google Maps AI Studio Setup Guide</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <GoogleMap
                mapId="DEMO_MAP_ID"
                defaultCenter={playerLatLng}
                defaultZoom={12}
                mapTypeId={mapType}
                colorScheme={isDarkMap ? 'DARK' : 'LIGHT'}
                gestureHandling="greedy"
                streetViewControl={true}
                mapTypeControl={false}
                fullscreenControl={false}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                onClick={handleMapClick}
                className="w-full h-full"
              >
                <TrafficLayerOverlay enabled={showTraffic} />

                <CameraSyncHelper
                  targetCenter={cameraTarget.center}
                  targetViewport={cameraTarget.viewport}
                  targetZoom={cameraTarget.zoom}
                  triggerKey={cameraTarget.key}
                />

                <RouteOverlay
                  origin={playerLatLng}
                  destination={selectedDest ? selectedDest.latLng : null}
                  originLabel={playerWorldPos ? 'Current Vehicle' : 'ICM Gaithersburg'}
                  destinationLabel={selectedDest?.label || 'Destination'}
                  onRouteSummaryChange={handleRouteSummaryChange}
                />

                <PlayerCarMarker
                  position={playerLatLng}
                  isLiveDriving={Boolean(playerWorldPos)}
                  isOpenInfo={openPlayerInfo}
                  onToggleInfo={(open) => {
                    setOpenPlayerInfo(open);
                    if (open) {
                      setOpenLandmarkId(null);
                      setOpenSelectedPinInfo(false);
                    }
                  }}
                />

                {filteredAnchors.map((anchor) => (
                  <LandmarkMarker
                    key={anchor.id}
                    anchor={anchor}
                    isSelected={selectedDest?.label === anchor.name}
                    isOpenInfo={openLandmarkId === anchor.id}
                    onToggleInfo={(id) => {
                      setOpenLandmarkId(id);
                      if (id) {
                        setOpenPlayerInfo(false);
                        setOpenSelectedPinInfo(false);
                      }
                    }}
                    onSelectForRoute={handleSelectAnchor}
                    onSendToInGameGps={
                      onSetInGameGpsTarget
                        ? (a) => {
                            onSetInGameGpsTarget(
                              Math.round(a.x),
                              Math.round(a.z),
                              `🗺️ ${a.name}`,
                              a.color
                            );
                            onClose();
                          }
                        : undefined
                    }
                  />
                ))}

                {selectedDest &&
                  !filteredAnchors.some((a) => a.name === selectedDest.label) && (
                    <SelectedPinMarker
                      destination={selectedDest}
                      isOpenInfo={openSelectedPinInfo}
                      onToggleInfo={(open) => {
                        setOpenSelectedPinInfo(open);
                        if (open) {
                          setOpenLandmarkId(null);
                          setOpenPlayerInfo(false);
                        }
                      }}
                      onSetGps={
                        onSetInGameGpsTarget
                          ? () => {
                              onSetInGameGpsTarget(
                                selectedDest.worldPos.x,
                                selectedDest.worldPos.z,
                                `🗺️ ${selectedDest.label}`,
                                '#38bdf8'
                              );
                              onClose();
                            }
                          : undefined
                      }
                      onLaunchDrive={
                        !onSetInGameGpsTarget && onLaunchMarylandDriveWithTarget
                          ? () => {
                              onLaunchMarylandDriveWithTarget(
                                selectedDest.worldPos.x,
                                selectedDest.worldPos.z,
                                `🗺️ ${selectedDest.label}`
                              );
                              onClose();
                            }
                          : undefined
                      }
                      onClear={() => {
                        setSelectedDest(null);
                        setOpenSelectedPinInfo(false);
                      }}
                    />
                  )}
              </GoogleMap>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const MarylandGoogleMapModal: React.FC<MarylandGoogleMapModalProps> = (props) => {
  if (!props.isOpen) return null;

  const apiKey = getGoogleMapsApiKey();

  return (
    <APIProvider
      apiKey={apiKey}
      language="en"
      region="US"
      libraries={['marker', 'places', 'routes']}
    >
      <MapInnerWorkspace
        hasApiKey={apiKey.length > 0}
        onClose={props.onClose}
        playerWorldPos={props.playerWorldPos}
        activeGpsLabel={props.activeGpsLabel}
        activeGpsCoords={props.activeGpsCoords}
        onSetInGameGpsTarget={props.onSetInGameGpsTarget}
        onClearInGameGpsTarget={props.onClearInGameGpsTarget}
        onLaunchMarylandDriveWithTarget={props.onLaunchMarylandDriveWithTarget}
      />
    </APIProvider>
  );
};
