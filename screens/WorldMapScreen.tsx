import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, FlatList, Dimensions, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { subscribeToWorldLocations, WorldLocation, addWorldLocation, updateWorldLocation, deleteWorldLocation, subscribeToEvents, subscribeToHallOfFame, Event, HallOfFameEntry, deleteEvent, deleteHallOfFameEntry, getEventRoster, RosterMember, checkAndAutoArchivePastTournaments, updateEvent, updateHallOfFameEntry } from '../services/firestore';
import { useTheme } from '../context/ThemeContext';
import ScreenTitle from '../components/ScreenTitle';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import LocationPickerModal from '../components/LocationPickerModal';
import SearchablePicker from '../components/SearchablePicker';
import { showAlert, showConfirmation } from '../utils/alert';
import { resolveLocationCoordinates, resolveKnownCoordinatesSync, findPlaceNameByCoords } from '../utils/geocoding';

const isGenericOrSurface = (name?: string) => {
    if (!name) return true;
    const n = name.trim().toLowerCase();
    return n === 'posizione evento' || n === 'hall of fame' || n === 'luogo' || n === 'nessun luogo' || n === 'sabbia' || n === 'erba' || n === 'campo' || n === 'palestra' || n === 'unknown';
};

// Unified Map Item Type
type MapItem = {
    id: string;
    type: 'location' | 'event' | 'hof';
    title: string;
    locationName: string;
    date: string; // YYYY-MM-DD or description
    latitude: number;
    longitude: number;
    description?: string;
    images?: string[];
    placement?: string;
    awards?: string[];
    roster?: RosterMember[];
    originalItem: WorldLocation | Event | HallOfFameEntry;
};

type LocationMarkerGroup = {
    key: string;
    locationName: string;
    latitude: number;
    longitude: number;
    items: MapItem[];
    primaryType: 'location' | 'event' | 'hof';
};

// Global cache for Leaflet modules so it only loads once in the app lifetime
let cachedLeaflet: any = null;
let cachedReactLeaflet: any = null;

if (Platform.OS === 'web') {
    Promise.all([
        import('leaflet'),
        import('react-leaflet')
    ]).then(([l, rl]) => {
        cachedLeaflet = (l as any)?.default || l;
        cachedReactLeaflet = (rl as any)?.default || rl;
    }).catch(err => {
        console.error("Errore precaricamento Leaflet:", err);
    });
}

const MapResizeHandler = ({ useMap }: { useMap: any }) => {
    if (!useMap) return null;
    const map = useMap();
    useEffect(() => {
        if (map && typeof map.invalidateSize === 'function') {
            map.invalidateSize();
            const timer = setTimeout(() => {
                map.invalidateSize();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [map]);
    return null;
};

export default function WorldMapScreen() {
    const { theme, isDark } = useTheme();
    const navigation = useNavigation<any>();
    const { isGlobalAdmin, isStaff, userProfile } = useAuth();

    const [mapItems, setMapItems] = useState<MapItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
    const [tempSelectedId, setTempSelectedId] = useState<string | null>(null);

    // Add/Edit State
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<MapItem | null>(null);

    const [isListModalVisible, setIsListModalVisible] = useState(false);

    // Bubba only view, others view and edit
    const canAdd = userProfile?.role !== 'Bubba';

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        // If it's already in a non-standard format or just text (like HoF dateDescription), return as is if it doesn't match YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;

        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    useEffect(() => {
        checkAndAutoArchivePastTournaments();

        const unsubscribeLocations = subscribeToWorldLocations((data) => {
            updateMapItems(data, 'location');
        });
        const unsubscribeEvents = subscribeToEvents((data) => {
            updateMapItems(data, 'event');
        });
        const unsubscribeHOF = subscribeToHallOfFame((data) => {
            updateMapItems(data, 'hof');
        });

        return () => {
            unsubscribeLocations();
            unsubscribeEvents();
            unsubscribeHOF();
        };
    }, []);

    // Helper to merge data streams
    const [rawLocations, setRawLocations] = useState<WorldLocation[]>([]);
    const [rawEvents, setRawEvents] = useState<Event[]>([]);
    const [rawHOF, setRawHOF] = useState<HallOfFameEntry[]>([]);
    const [asyncResolvedCoords, setAsyncResolvedCoords] = useState<Record<string, { latitude: number; longitude: number }>>({});

    const updateMapItems = (data: any[], type: 'location' | 'event' | 'hof') => {
        if (type === 'location') setRawLocations(data);
        if (type === 'event') setRawEvents(data);
        if (type === 'hof') setRawHOF(data);
    };

    // Risolvi coordinate mancanti per tutti gli eventi a calendario che hanno un posto specificato
    useEffect(() => {
        rawEvents.forEach(async (ev) => {
            const hasLocationName = Boolean(ev.location && ev.location.trim());
            if (!hasLocationName) return;

            const lat = Number(ev.latitude);
            const lng = Number(ev.longitude);
            const hasValidCoords = !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0);

            if (!hasValidCoords) {
                if (asyncResolvedCoords[ev.id]) return;
                const coords = await resolveLocationCoordinates(ev.location!, [...rawLocations, ...rawHOF]);
                if (coords) {
                    setAsyncResolvedCoords(prev => ({ ...prev, [ev.id]: coords }));
                    try {
                        updateEvent({
                            ...ev,
                            latitude: coords.latitude,
                            longitude: coords.longitude,
                            showOnMap: true
                        });
                    } catch (e) {
                        // ignore background update error
                    }
                }
            }
        });
    }, [rawEvents, rawLocations, rawHOF]);

    useEffect(() => {
        const items: MapItem[] = [];
        const hofMap = new Map<string, HallOfFameEntry>();

        // 1. Hall of Fame (authoritative source for completed tournaments & rosters)
        rawHOF.forEach(entry => {
            const lat = Number(entry.latitude);
            const lng = Number(entry.longitude);
            if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
                const normLoc = (entry.location || '').trim();
                const item: MapItem = {
                    id: entry.id,
                    type: 'hof',
                    title: (entry.title || '').trim(),
                    locationName: normLoc || 'Hall of Fame',
                    date: entry.dateDescription || entry.date || '',
                    latitude: lat,
                    longitude: lng,
                    description: entry.placement ? `Piazzamento: ${entry.placement}` : undefined,
                    placement: entry.placement,
                    awards: entry.awards,
                    roster: entry.roster,
                    images: entry.images,
                    originalItem: entry
                };
                items.push(item);

                const key = `${(entry.title || '').trim().toLowerCase()}_${(entry.date || '').trim()}`;
                hofMap.set(key, entry);
                const titleKey = (entry.title || '').trim().toLowerCase();
                if (!hofMap.has(titleKey)) {
                    hofMap.set(titleKey, entry);
                }
            }
        });

        // 2. Events (tutti gli eventi di Calendario che hanno una posizione o coordinate)
        rawEvents.forEach(ev => {
            const hasLocationName = Boolean(ev.location && ev.location.trim());
            let lat = Number(ev.latitude);
            let lng = Number(ev.longitude);
            let hasValidCoords = !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0);

            // Se non ha né nome del luogo né coordinate valide, salta
            if (!hasLocationName && !hasValidCoords) return;

            // Coordinate risolte asincronamente
            if (!hasValidCoords && asyncResolvedCoords[ev.id]) {
                lat = asyncResolvedCoords[ev.id].latitude;
                lng = asyncResolvedCoords[ev.id].longitude;
                hasValidCoords = true;
            }

            // Risoluzione sincrona immediata (preset note o luoghi già mappati)
            if (!hasValidCoords && hasLocationName) {
                const syncCoords = resolveKnownCoordinatesSync(ev.location!, [...rawLocations, ...rawHOF]);
                if (syncCoords) {
                    lat = syncCoords.latitude;
                    lng = syncCoords.longitude;
                    hasValidCoords = true;
                }
            }

            // Se è un torneo già presente in Hall of Fame, evita di duplicarlo
            const eventKey = `${(ev.title || '').trim().toLowerCase()}_${(ev.date || '').trim()}`;
            const titleKey = (ev.title || '').trim().toLowerCase();
            if (hofMap.has(eventKey) || hofMap.has(titleKey)) {
                return;
            }

            const normLoc = (ev.location || '').trim();
            items.push({
                id: ev.id,
                type: 'event',
                title: (ev.title || '').trim() || 'Evento',
                locationName: normLoc || 'Posizione Evento',
                date: ev.date || '',
                latitude: hasValidCoords ? lat : 0,
                longitude: hasValidCoords ? lng : 0,
                description: ev.additionalInfo,
                images: ev.images,
                originalItem: ev
            });
        });

        // 3. World Locations (manual locations: merge if already in HoF/event or add standalone)
        rawLocations.forEach(loc => {
            const lat = Number(loc.latitude);
            const lng = Number(loc.longitude);
            if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
                const normLoc = (loc.locationName || '').trim();
                const normTitle = (loc.title || '').trim().toLowerCase();

                const existing = items.find(it =>
                    (it.title || '').trim().toLowerCase() === normTitle ||
                    (normLoc && (it.locationName || '').trim().toLowerCase() === normLoc.toLowerCase() && Math.abs(it.latitude - lat) < 0.005 && Math.abs(it.longitude - lng) < 0.005)
                );

                if (existing) {
                    if (loc.images && loc.images.length > 0) {
                        existing.images = Array.from(new Set([...(existing.images || []), ...loc.images]));
                    }
                    if (!existing.description && loc.description) {
                        existing.description = loc.description;
                    }
                } else {
                    items.push({
                        id: loc.id,
                        type: 'location',
                        title: (loc.title || '').trim(),
                        locationName: normLoc || loc.title || 'Luogo',
                        date: loc.date || '',
                        latitude: lat,
                        longitude: lng,
                        description: loc.description,
                        images: loc.images,
                        originalItem: loc
                    });
                }
            }
        });

        // Fill generic or surface location names (e.g. 'Sabbia', 'Erba', 'Posizione Evento') from companions at the same coordinates or from preset cities
        items.forEach(it => {
            if (isGenericOrSurface(it.locationName)) {
                const companion = items.find(other =>
                    other.id !== it.id &&
                    other.locationName &&
                    !isGenericOrSurface(other.locationName) &&
                    it.latitude !== 0 &&
                    Math.abs(other.latitude - it.latitude) < 0.05 &&
                    Math.abs(other.longitude - it.longitude) < 0.05
                );
                if (companion) {
                    it.locationName = companion.locationName;
                } else if (it.latitude !== 0 && it.longitude !== 0) {
                    const presetName = findPlaceNameByCoords(it.latitude, it.longitude);
                    if (presetName) {
                        it.locationName = presetName;
                    }
                }
            }
        });

        setMapItems(items);
    }, [rawLocations, rawEvents, rawHOF, asyncResolvedCoords]);

    // Group items into unique geographic markers for the map
    const locationMarkers = useMemo(() => {
        const groups = new Map<string, LocationMarkerGroup>();

        mapItems.forEach((item) => {
            // Ignora elementi senza coordinate geografiche valide per i pin della mappa
            if (!item.latitude || !item.longitude || (item.latitude === 0 && item.longitude === 0)) return;

            const normName = item.locationName.trim().toLowerCase();

            // Find an existing marker within ~8km or with the exact same normalized place name nearby
            let foundKey: string | null = null;
            for (const [k, g] of groups.entries()) {
                const sameCoords = Math.abs(g.latitude - item.latitude) < 0.08 && Math.abs(g.longitude - item.longitude) < 0.08;
                const sameName = !isGenericOrSurface(normName) && g.locationName.trim().toLowerCase() === normName;
                if (sameCoords || sameName) {
                    foundKey = k;
                    break;
                }
            }

            const key = foundKey || `${item.latitude.toFixed(3)}_${item.longitude.toFixed(3)}`;
            let group = groups.get(key);

            if (!group) {
                let initialName = item.locationName.trim() || item.title;
                if (isGenericOrSurface(initialName)) {
                    const presetName = findPlaceNameByCoords(item.latitude, item.longitude);
                    if (presetName) initialName = presetName;
                }
                group = {
                    key,
                    locationName: initialName,
                    latitude: item.latitude,
                    longitude: item.longitude,
                    items: [],
                    primaryType: item.type,
                };
                groups.set(key, group);
            } else {
                if (isGenericOrSurface(group.locationName) && !isGenericOrSurface(item.locationName)) {
                    group.locationName = item.locationName.trim();
                }
            }

            group.items.push(item);

            if (item.type === 'hof') {
                group.primaryType = 'hof';
            } else if (item.type === 'event' && group.primaryType !== 'hof') {
                group.primaryType = 'event';
            }
        });

        return Array.from(groups.values());
    }, [mapItems]);

    const [filterLocationName, setFilterLocationName] = useState<string | null>(null);
    const [selectedGroupItems, setSelectedGroupItems] = useState<MapItem[] | null>(null);
    const [openedFromMenu, setOpenedFromMenu] = useState(false);

    const handleLocationMarkerClick = (group: LocationMarkerGroup) => {
        if (group.items.length === 1) {
            // Open the event directly without opening any list
            setSelectedGroupItems(null);
            setSelectedItem(group.items[0]);
        } else {
            // Only open location list if there are multiple events in this location
            setOpenedFromMenu(false);
            setFilterLocationName(group.locationName);
            setSelectedGroupItems(group.items);
            setIsListModalVisible(true);
        }
    };

    const closeDetails = () => {
        setSelectedItem(null);
    };

    const handleDelete = async (item: MapItem) => {
        const confirmMessage = item.type === 'location' ? "Sei sicuro di voler eliminare questo luogo?" :
            item.type === 'event' ? "Sei sicuro di voler eliminare questo evento?" :
                "Sei sicuro di voler eliminare questo torneo dalla Hall of Fame?";

        showConfirmation(
            "Elimina",
            confirmMessage,
            async () => {
                try {
                    if (item.type === 'location') {
                        await deleteWorldLocation(item.id);
                    } else if (item.type === 'event') {
                        await deleteEvent(item.id);
                    } else if (item.type === 'hof') {
                        await deleteHallOfFameEntry(item.id);
                    }
                    setSelectedItem(null);
                } catch (error) {
                    showAlert("Errore", "Impossibile eliminare l'elemento.");
                }
            },
            "Elimina"
        );
    };

    const handleEdit = (item: MapItem) => {
        setEditingItem(item);
        setIsAddModalVisible(true);
    };

    // Web Map Implementation (using module cache if already loaded)
    const [Leaflet, setLeaflet] = useState<any>(cachedLeaflet);
    const [ReactLeaflet, setReactLeaflet] = useState<any>(cachedReactLeaflet);

    useEffect(() => {
        if (Platform.OS === 'web' && (!Leaflet || !ReactLeaflet)) {
            Promise.all([
                import('leaflet'),
                import('react-leaflet')
            ]).then(([l, rl]) => {
                const LeafletInstance = (l as any)?.default || l;
                const ReactLeafletInstance = (rl as any)?.default || rl;
                cachedLeaflet = LeafletInstance;
                cachedReactLeaflet = ReactLeafletInstance;
                setLeaflet(LeafletInstance);
                setReactLeaflet(ReactLeafletInstance);
            }).catch(err => {
                console.error("Errore nel caricamento dei moduli Leaflet:", err);
            });
        }
    }, [Leaflet, ReactLeaflet]);

    // Inject CSS for rounded marker and dark tiles (Web Only)
    useEffect(() => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const styleId = 'bubba-leaflet-dark-style';
            let style = document.getElementById(styleId) as HTMLStyleElement | null;
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                document.head.appendChild(style);
            }
            style.innerHTML = `
                .custom-marker {
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                }
                .dark-map .leaflet-tile,
                .leaflet-container.dark-map .leaflet-tile,
                .dark-tiles .leaflet-tile,
                .dark-tiles img,
                .leaflet-tile.dark-tiles,
                .leaflet-pane.dark-tiles img,
                .leaflet-tile-pane.dark-tiles img {
                    filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) !important;
                }
            `;
        }
    }, []);

    // Create marker icon once
    const sharedIcon = useMemo(() => {
        if (Platform.OS !== 'web' || !Leaflet) return null;
        try {
            const L = Leaflet?.default || Leaflet;
            if (!L || !L.Icon) return null;

            let logoAsset = require('../assets/logo.jpeg');
            let logoUri = '';
            if (typeof logoAsset === 'string') {
                logoUri = logoAsset;
            } else if (logoAsset && typeof logoAsset === 'object') {
                if (logoAsset.uri) logoUri = logoAsset.uri;
                else if (logoAsset.default) logoUri = logoAsset.default;
            }
            if (!logoUri && Image && typeof Image.resolveAssetSource === 'function') {
                const assetSource = Image.resolveAssetSource(logoAsset);
                if (assetSource) logoUri = assetSource.uri;
            }
            if (!logoUri) return null;

            return new L.Icon({
                iconUrl: logoUri,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
                popupAnchor: [0, -20],
                className: 'custom-marker',
            });
        } catch (e) {
            console.error("Errore creazione icona marker:", e);
            return null;
        }
    }, [Leaflet]);

    const locationIcon = sharedIcon;
    const eventIcon = sharedIcon;
    const hofIcon = sharedIcon;

    // Render Native Map Placeholder
    if (Platform.OS !== 'web') {
        return (
            <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ScreenTitle
                    title="Bubba World"
                    onBack={() => navigation.goBack()}
                />
                <Text style={{ color: theme.colors.text }}>La mappa è disponibile solo su Web.</Text>
            </View>
        );
    }

    const LeafletLib = Leaflet?.default || Leaflet;
    const ReactLeafletLib = ReactLeaflet?.default || ReactLeaflet;

    if (!LeafletLib || !ReactLeafletLib || !ReactLeafletLib.MapContainer) {
        return (
            <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
                <ScreenTitle
                    title="Bubba World"
                    onBack={() => navigation.goBack()}
                />
                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
                <Text style={{ color: theme.colors.text, marginTop: 10 }}>Caricamento Mappa...</Text>
            </View>
        );
    }

    const { MapContainer, TileLayer, Marker: LMarker, Tooltip, useMap } = ReactLeafletLib;

    const tileLayerUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    return (
        <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: theme.colors.background }}>
            <ScreenTitle
                title="Bubba World"
                onBack={() => navigation.goBack()}
                rightAction={{
                    icon: require('../assets/threeLine.png'),
                    onPress: () => {
                        setOpenedFromMenu(true);
                        setFilterLocationName(null);
                        setSelectedGroupItems(null);
                        setIsListModalVisible(true);
                    }
                }}
            />
            <View style={{ flex: 1, width: '100%', minHeight: 400, position: 'relative' }}>
                {/* @ts-ignore */}
                <MapContainer center={[41.9028, 12.4964]} zoom={3} className={isDark ? "dark-map" : ""} style={{ height: '100%', width: '100%', backgroundColor: isDark ? '#1a1d21' : '#ddd' }}>
                    <MapResizeHandler useMap={useMap} />
                    <TileLayer
                        url={tileLayerUrl}
                        attribution={attribution}
                        className={isDark ? "dark-tiles" : ""}
                    />
                    {locationMarkers.map((group) => {
                        let icon = locationIcon;
                        if (group.primaryType === 'event') icon = eventIcon;
                        if (group.primaryType === 'hof') icon = hofIcon;

                        if (!icon) return null;

                        const tooltipLabel = group.items.length > 1
                            ? `${group.locationName} (${group.items.length})`
                            : group.locationName;

                        return (
                            <LMarker
                                key={group.key}
                                position={[group.latitude, group.longitude]}
                                icon={icon}
                                eventHandlers={{
                                    click: () => {
                                        handleLocationMarkerClick(group);
                                    },
                                }}
                            >
                                <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent={false}>
                                    <span>{tooltipLabel}</span>
                                </Tooltip>
                            </LMarker>
                        );
                    })}
                </MapContainer>
            </View>

            {selectedItem && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: theme.colors.background }]}>
                    <LocationDetails
                        item={selectedItem}
                        onClose={closeDetails}
                        theme={theme}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        canEdit={canAdd}
                        formatDate={formatDate}
                    />
                </View>
            )}

            {canAdd && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                    onPress={() => {
                        setEditingItem(null);
                        setIsAddModalVisible(true);
                    }}
                >
                    <Image source={require('../assets/plus.png')} style={styles.fabIcon} />
                </TouchableOpacity>
            )}

            <Modal
                animationType="slide"
                transparent={false}
                visible={isAddModalVisible}
                onRequestClose={() => {
                    setIsAddModalVisible(false);
                    setEditingItem(null);
                }}
            >
                <AddLocationModal
                    onClose={() => {
                        setIsAddModalVisible(false);
                        setEditingItem(null);
                    }}
                    theme={theme}
                    initialItem={editingItem}
                    onSaved={(updated) => {
                        if (selectedItem) {
                            setSelectedItem(prev => prev ? { ...prev, ...updated } : null);
                        }
                    }}
                    existingItems={mapItems}
                />
            </Modal>

            <Modal
                animationType="slide"
                transparent={false}
                visible={isListModalVisible}
                onRequestClose={() => {
                    setIsListModalVisible(false);
                    setFilterLocationName(null);
                    setSelectedGroupItems(null);
                }}
            >
                <LocationListModal
                    items={mapItems}
                    selectedGroupItems={selectedGroupItems}
                    onClose={() => {
                        setIsListModalVisible(false);
                        setFilterLocationName(null);
                        setSelectedGroupItems(null);
                    }}
                    onSelect={(item) => {
                        setIsListModalVisible(false);
                        setFilterLocationName(null);
                        setSelectedGroupItems(null);
                        setSelectedItem(item);
                    }}
                    onAdd={() => {
                        setIsListModalVisible(false);
                        setSelectedGroupItems(null);
                        setEditingItem(null);
                        setIsAddModalVisible(true);
                    }}
                    theme={theme}
                    canAdd={canAdd}
                    formatDate={formatDate}
                    selectedLocationName={filterLocationName}
                    onSelectLocationName={(name) => {
                        setSelectedGroupItems(null);
                        setFilterLocationName(name);
                    }}
                    openedFromMenu={openedFromMenu}
                />
            </Modal>
        </View>
    );
}

// Helper colors for tournament placement badges
const getPlacementColor = (placementText?: string) => {
    if (!placementText) return '#e3f2fd';
    const text = placementText.toLowerCase().trim();
    if (/^1(\D|$)/.test(text) || text.includes('primo') || text.includes('winner') || text.includes('vincitor')) return '#fbc02d';
    if (/^2(\D|$)/.test(text) || text.includes('secondo') || text.includes('finalist')) return '#C0C0C0';
    if (/^3(\D|$)/.test(text) || text.includes('terzo')) return '#CD7F32';
    return '#0288D1';
};

const getPlacementTextColor = (placementText?: string) => {
    if (!placementText) return '#003399';
    const text = placementText.toLowerCase().trim();
    if (/^1(\D|$)/.test(text) || text.includes('primo') || text.includes('winner') || text.includes('vincitor')) return '#fff';
    if (/^2(\D|$)/.test(text) || text.includes('secondo') || text.includes('finalist')) return '#fff';
    if (/^3(\D|$)/.test(text) || text.includes('terzo')) return '#fff';
    return '#fff';
};

// --- Location List Modal ---
const LocationListModal = ({
    items,
    selectedGroupItems,
    onClose,
    onSelect,
    onAdd,
    theme,
    canAdd,
    formatDate,
    selectedLocationName,
    onSelectLocationName,
    openedFromMenu,
}: {
    items: MapItem[];
    selectedGroupItems?: MapItem[] | null;
    onClose: () => void;
    onSelect: (item: MapItem) => void;
    onAdd: () => void;
    theme: any;
    canAdd: boolean;
    formatDate: (d: string) => string;
    selectedLocationName: string | null;
    onSelectLocationName: (name: string | null) => void;
    openedFromMenu: boolean;
}) => {
    // Deduplicate locations by trimmed, case-insensitive locationName
    const uniqueLocations = useMemo(() => {
        const map = new Map<string, { locationName: string; count: number }>();
        items.forEach((item) => {
            const raw = (item.locationName || '').trim();
            const displayName = raw || 'Nessun luogo';
            const key = displayName.toLowerCase();
            const existing = map.get(key);
            if (!existing) {
                map.set(key, { locationName: displayName, count: 1 });
            } else {
                existing.count += 1;
            }
        });
        return Array.from(map.values()).sort((a, b) => a.locationName.localeCompare(b.locationName));
    }, [items]);

    const filteredItems = useMemo(() => {
        if (selectedGroupItems && selectedGroupItems.length > 0) {
            return selectedGroupItems;
        }
        if (!selectedLocationName) return [];
        const target = selectedLocationName.trim().toLowerCase();
        return items.filter((item) => {
            const itemLoc = (item.locationName || '').trim().toLowerCase();
            if (target === 'nessun luogo') {
                return !itemLoc || itemLoc === 'nessun luogo';
            }
            return itemLoc === target;
        });
    }, [items, selectedLocationName, selectedGroupItems]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.modalHeader}>
                {selectedLocationName ? (
                    openedFromMenu ? (
                        <TouchableOpacity onPress={() => onSelectLocationName(null)} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Image source={require('../assets/leftArrow.png')} style={{ width: 24, height: 24, tintColor: theme.colors.primary }} resizeMode="contain" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Image source={require('../assets/x.png')} style={{ width: 30, height: 30 }} resizeMode="contain" />
                        </TouchableOpacity>
                    )
                ) : (
                    <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Image source={require('../assets/x.png')} style={{ width: 30, height: 30 }} resizeMode="contain" />
                    </TouchableOpacity>
                )}

                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                    {selectedLocationName ? selectedLocationName : 'Elenco Luoghi'}
                </Text>

                {!selectedLocationName && canAdd ? (
                    <TouchableOpacity onPress={onAdd}>
                        <Image source={require('../assets/plus.png')} style={{ width: 24, height: 24, tintColor: theme.colors.primary }} />
                    </TouchableOpacity>
                ) : <View style={{ width: 24 }} />}
            </View>

            {selectedLocationName ? (
                <FlatList
                    data={filteredItems}
                    keyExtractor={(item) => `${item.type}_${item.id}`}
                    renderItem={({ item }) => (
                        <TouchableOpacity onPress={() => onSelect(item)} style={[styles.listItem, { borderBottomColor: theme.colors.border }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={[styles.listItemTitle, { color: theme.colors.text, flex: 1 }]}>{item.title}</Text>
                                {item.placement ? (
                                    <View style={[styles.placementBadge, { backgroundColor: getPlacementColor(item.placement), marginBottom: 0, marginLeft: 8 }]}>
                                        <Text style={[styles.placementText, { color: getPlacementTextColor(item.placement) }]}>{item.placement}</Text>
                                    </View>
                                ) : null}
                            </View>
                            <Text style={[styles.listItemSubtitle, { color: theme.colors.textSecondary }]}>
                                {formatDate(item.date)} • {(() => {
                                    if (item.type === 'hof') return 'Hall of Fame';
                                    if (item.type === 'location') return 'Luogo';
                                    const t = (item.originalItem as any)?.type;
                                    if (t === 'tournament' || t === 'torneo') return 'Torneo';
                                    if (t === 'match' || t === 'amichevole') return 'Partita';
                                    if (t === 'training' || t === 'Campo' || t === 'Palestra') return 'Allenamento';
                                    if (t === 'meeting') return 'Riunione';
                                    return 'Evento';
                                })()}
                            </Text>
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{ padding: 20 }}
                />
            ) : (
                <FlatList
                    data={uniqueLocations}
                    keyExtractor={(item) => item.locationName}
                    renderItem={({ item }) => (
                        <TouchableOpacity onPress={() => onSelectLocationName(item.locationName)} style={[styles.listItem, { borderBottomColor: theme.colors.border }]}>
                            <Text style={[styles.listItemTitle, { color: theme.colors.text }]}>{item.locationName}</Text>
                            <Text style={[styles.listItemSubtitle, { color: theme.colors.textSecondary }]}>
                                {item.count} {item.count === 1 ? 'Elemento' : 'Elementi'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{ padding: 20 }}
                />
            )}
        </View>
    );
};

// --- Details Component (Shared) ---
const LocationDetails = ({
    item,
    onClose,
    theme,
    onDelete,
    onEdit,
    canEdit,
    formatDate,
}: {
    item: MapItem;
    onClose: () => void;
    theme: any;
    onDelete?: (item: MapItem) => void;
    onEdit?: (item: MapItem) => void;
    canEdit?: boolean;
    formatDate: (d: string) => string;
}) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [eventRoster, setEventRoster] = useState<RosterMember[]>(item.roster || []);
    const [loadingRoster, setLoadingRoster] = useState(false);

    useEffect(() => {
        if (item.type === 'hof') {
            const hofEntry = item.originalItem as HallOfFameEntry;
            setEventRoster(item.roster || hofEntry.roster || []);
        } else if (item.type === 'event') {
            // Load roster from Firestore for calendar event
            setLoadingRoster(true);
            getEventRoster(item.id)
                .then((r) => setEventRoster(r))
                .catch(() => setEventRoster([]))
                .finally(() => setLoadingRoster(false));
        } else {
            setEventRoster([]);
        }
    }, [item]);

    const placement = item.placement || (item.originalItem as HallOfFameEntry)?.placement;
    const awards = item.awards || (item.originalItem as HallOfFameEntry)?.awards;

    return (
        <View style={[styles.detailsContainer, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Image source={require('../assets/x.png')} style={{ width: 30, height: 30 }} resizeMode="contain" />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.colors.text, flex: 1, textAlign: 'right' }]}>{item.title}</Text>
            </View>

            {canEdit && (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <TouchableOpacity onPress={() => onEdit && onEdit(item)} style={{ marginRight: 15 }}>
                        <Text style={{ color: theme.colors.primary, fontSize: 16 }}>Modifica</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete && onDelete(item)}>
                        <Text style={{ color: 'red', fontSize: 16 }}>Elimina</Text>
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                    {item.locationName ? `${item.locationName} - ` : ''}{formatDate(item.date)}
                </Text>

                {/* Placement Badge */}
                {placement ? (
                    <View style={[styles.placementBadge, { backgroundColor: getPlacementColor(placement) }]}>
                        <Text style={[styles.placementText, { color: getPlacementTextColor(placement) }]}>
                            {placement}
                        </Text>
                    </View>
                ) : null}

                {/* Awards */}
                {awards && awards.length > 0 ? (
                    <View style={{ marginBottom: 15 }}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Premi:</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            {awards.map((award, index) => (
                                <View key={index} style={[styles.awardChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}>
                                    <Text style={[styles.awardText, { color: theme.colors.primary }]}>🏆 {award}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}

                {item.description ? (
                    <Text style={[styles.description, { color: theme.colors.text }]}>{item.description}</Text>
                ) : null}

                {/* Roster Section */}
                <View style={{ marginBottom: 20 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                        Partecipanti {eventRoster.length > 0 ? `(${eventRoster.length})` : ''}:
                    </Text>

                    {loadingRoster ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 10 }} />
                    ) : eventRoster && eventRoster.length > 0 ? (
                        <View style={{ marginTop: 6 }}>
                            {eventRoster.map((member, index) => (
                                <View
                                    key={index}
                                    style={[styles.rosterItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
                                >
                                    <Text style={[styles.rosterName, { color: theme.colors.text }]}>
                                        • {member.name}
                                    </Text>
                                    {(member.role === 'guest' || member.isGuest) && (
                                        <View style={styles.guestBadge}>
                                            <Text style={styles.guestText}>Ospite</Text>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={{ color: theme.colors.textSecondary, fontStyle: 'italic', marginTop: 4 }}>
                            {item.type === 'location' ? 'Nessun roster associato a questo luogo.' : 'Nessun giocatore registrato.'}
                        </Text>
                    )}
                </View>

                {/* Images */}
                {item.images && item.images.length > 0 ? (
                    <View style={{ marginBottom: 20 }}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 8 }]}>Foto:</Text>
                        <FlatList
                            data={item.images}
                            keyExtractor={(_, index) => index.toString()}
                            numColumns={3}
                            scrollEnabled={false}
                            renderItem={({ item: uri }) => (
                                <TouchableOpacity onPress={() => setSelectedImage(uri)}>
                                    <Image source={{ uri }} style={styles.gridImage} />
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={styles.gallery}
                        />
                    </View>
                ) : null}
            </ScrollView>

            {selectedImage && (
                <Modal visible={true} transparent={true} onRequestClose={() => setSelectedImage(null)}>
                    <View style={styles.fullscreenImageContainer}>
                        <TouchableOpacity style={styles.fullscreenClose} onPress={() => setSelectedImage(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Image source={require('../assets/x.png')} style={{ width: 30, height: 30, tintColor: 'white' }} resizeMode="contain" />
                        </TouchableOpacity>
                        <Image source={{ uri: selectedImage }} style={styles.fullscreenImage} resizeMode="contain" />
                    </View>
                </Modal>
            )}
        </View>
    );
};

// --- Add/Edit Location Modal (Web Version) ---
const AddLocationModal = ({
    onClose,
    theme,
    initialItem,
    onSaved,
    existingItems = []
}: {
    onClose: () => void;
    theme: any;
    initialItem?: MapItem | null;
    onSaved?: (updated: Partial<MapItem>) => void;
    existingItems?: MapItem[];
}) => {
    const [title, setTitle] = useState(initialItem?.title || '');
    const [locationName, setLocationName] = useState(initialItem?.locationName || '');
    const [description, setDescription] = useState(initialItem?.description || '');
    const [date, setDate] = useState(initialItem?.date || new Date().toISOString().split('T')[0]);
    const [latitude, setLatitude] = useState(initialItem?.latitude ? initialItem.latitude.toString() : '');
    const [longitude, setLongitude] = useState(initialItem?.longitude ? initialItem.longitude.toString() : '');
    const [images, setImages] = useState<string[]>(initialItem?.images || []);
    const [uploading, setUploading] = useState(false);
    const [isMapPickerVisible, setIsMapPickerVisible] = useState(false);

    const handleLocationSelect = (lat: number, lng: number) => {
        setLatitude(lat.toString());
        setLongitude(lng.toString());
        setIsMapPickerVisible(false);
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            setImages([...images, ...result.assets.map(asset => asset.uri)]);
        }
    };

    const handleSave = async () => {
        if (!title || !locationName || !latitude || !longitude) {
            showAlert('Errore', 'Compila tutti i campi obbligatori (Titolo, Luogo, Lat, Long)');
            return;
        }

        setUploading(true);
        try {
            const uploadedImageUrls: string[] = [];
            const storage = getStorage();

            for (const uri of images) {
                if (uri.startsWith('http')) {
                    uploadedImageUrls.push(uri);
                    continue;
                }
                const filename = uri.substring(uri.lastIndexOf('/') + 1);
                const storageRef = ref(storage, `world_photos/${Date.now()}_${filename}`);
                const response = await fetch(uri);
                const blob = await response.blob();
                await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(storageRef);
                uploadedImageUrls.push(downloadURL);
            }

            const parsedLat = parseFloat(latitude);
            const parsedLng = parseFloat(longitude);

            if (initialItem) {
                showConfirmation(
                    "Conferma Modifica",
                    `Vuoi salvare le modifiche per "${title}" (${locationName})?`,
                    async () => {
                        try {
                            if (initialItem.type === 'location') {
                                await updateWorldLocation({
                                    id: initialItem.id,
                                    title,
                                    locationName,
                                    description,
                                    date,
                                    latitude: parsedLat,
                                    longitude: parsedLng,
                                    images: uploadedImageUrls
                                });
                            } else if (initialItem.type === 'event') {
                                await updateEvent({
                                    ...(initialItem.originalItem as Event),
                                    title,
                                    location: locationName,
                                    date,
                                    latitude: parsedLat,
                                    longitude: parsedLng,
                                    additionalInfo: description,
                                    images: uploadedImageUrls,
                                    showOnMap: true,
                                });
                            } else if (initialItem.type === 'hof') {
                                await updateHallOfFameEntry({
                                    id: initialItem.id,
                                    title,
                                    location: locationName,
                                    date,
                                    latitude: parsedLat,
                                    longitude: parsedLng,
                                    description,
                                    images: uploadedImageUrls
                                });
                            }
                            if (onSaved) {
                                onSaved({
                                    title,
                                    locationName,
                                    description,
                                    date,
                                    latitude: parsedLat,
                                    longitude: parsedLng,
                                    images: uploadedImageUrls
                                });
                            }
                            showAlert('Successo', 'Modifiche salvate correttamente!');
                            onClose();
                        } catch (error) {
                            console.error(error);
                            showAlert('Errore', 'Si è verificato un errore durante il salvataggio.');
                        }
                    },
                    "Salva Modifiche"
                );
                return;
            }

            await addWorldLocation({
                title,
                locationName,
                description,
                date,
                latitude: parsedLat,
                longitude: parsedLng,
                images: uploadedImageUrls
            });
            showAlert('Successo', 'Luogo aggiunto correttamente!');
            onClose();
        } catch (error) {
            console.error(error);
            showAlert('Errore', 'Si è verificato un errore durante il salvataggio.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.modalHeader}>
                <TouchableOpacity onPress={onClose}>
                    <Text style={{ color: theme.colors.primary, fontSize: 18 }}>Annulla</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{initialItem ? 'Modifica' : 'Nuovo Luogo'}</Text>
                <TouchableOpacity onPress={handleSave} disabled={uploading}>
                    {uploading ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={{ color: theme.colors.primary, fontSize: 18, fontWeight: 'bold' }}>Salva</Text>}
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.formContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Titolo *</Text>
                <TextInput style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]} value={title} onChangeText={setTitle} placeholder="Es. Torneo Parigi" placeholderTextColor={theme.colors.textSecondary} />

                <Text style={[styles.label, { color: theme.colors.text }]}>Nome Luogo *</Text>
                <View style={{ marginBottom: 15 }}>
                    <SearchablePicker
                        selectedValue={locationName}
                        onValueChange={(val) => {
                            setLocationName(val);
                            const existing = existingItems.find(i => i.locationName === val);
                            if (existing) {
                                setLatitude(existing.latitude.toString());
                                setLongitude(existing.longitude.toString());
                            }
                        }}
                        items={Array.from(new Set(existingItems.map(i => i.locationName).filter(n => n)))}
                        placeholder="Seleziona o scrivi..."
                        title="Seleziona Luogo"
                    />
                </View>
                <TextInput style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]} value={locationName} onChangeText={setLocationName} placeholder="Es. Parigi, Francia" placeholderTextColor={theme.colors.textSecondary} />

                <Text style={[styles.label, { color: theme.colors.text }]}>Data (YYYY-MM-DD)</Text>
                <TextInput style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textSecondary} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Latitudine *</Text>
                        <TextInput style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]} value={latitude} onChangeText={setLatitude} keyboardType="numeric" placeholder="Es. 48.8566" placeholderTextColor={theme.colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Longitudine *</Text>
                        <TextInput style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]} value={longitude} onChangeText={setLongitude} keyboardType="numeric" placeholder="Es. 2.3522" placeholderTextColor={theme.colors.textSecondary} />
                    </View>
                    <TouchableOpacity style={[styles.mapButton, { backgroundColor: theme.colors.primary }]} onPress={() => setIsMapPickerVisible(true)}>
                        <Image source={require('../assets/world.png')} style={{ width: 24, height: 24, tintColor: 'white' }} />
                    </TouchableOpacity>
                </View>

                <LocationPickerModal
                    visible={isMapPickerVisible}
                    onClose={() => setIsMapPickerVisible(false)}
                    onSelect={handleLocationSelect}
                    theme={theme}
                    initialLocation={latitude && longitude ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) } : null}
                    existingLocations={existingItems.map(item => ({ latitude: item.latitude, longitude: item.longitude, title: item.locationName }))}
                />

                <Text style={[styles.label, { color: theme.colors.text }]}>Descrizione</Text>
                <TextInput style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, height: 100 }]} value={description} onChangeText={setDescription} multiline placeholder="Descrizione evento..." placeholderTextColor={theme.colors.textSecondary} />

                <TouchableOpacity style={[styles.imageButton, { borderColor: theme.colors.primary }]} onPress={pickImage}>
                    <Text style={{ color: theme.colors.primary }}>+ Aggiungi Foto</Text>
                </TouchableOpacity>

                <View style={styles.previewContainer}>
                    {images.map((uri, index) => (
                        <View key={index} style={{ position: 'relative', marginRight: 10 }}>
                            <Image source={{ uri }} style={styles.previewImage} />
                            <TouchableOpacity
                                style={{
                                    position: 'absolute',
                                    top: -5,
                                    right: -5,
                                    backgroundColor: 'white',
                                    borderRadius: 10,
                                    width: 20,
                                    height: 20,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: '#ccc'
                                }}
                                onPress={() => {
                                    setImages(prev => prev.filter((_, i) => i !== index));
                                }}
                            >
                                <Image source={require('../assets/x.png')} style={{ width: 10, height: 10 }} resizeMode="contain" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailsContainer: {
        flex: 1,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        marginTop: 40,
    },
    closeButton: {
        marginRight: 15,
    },
    icon: {
        width: 24,
        height: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 10,
    },
    description: {
        fontSize: 14,
        marginBottom: 20,
    },
    gallery: {
        paddingBottom: 20,
    },
    gridImage: {
        width: (Dimensions.get('window').width - 60) / 3,
        height: (Dimensions.get('window').width - 60) / 3,
        margin: 5,
        borderRadius: 8,
        backgroundColor: '#eee',
    },
    fullscreenImageContainer: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullscreenImage: {
        width: '100%',
        height: '100%',
    },
    fullscreenClose: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 1,
        padding: 10,
    },
    closeText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        zIndex: 1000,
    },
    fabIcon: {
        width: 30,
        height: 30,
        tintColor: 'white',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    formContainer: {
        padding: 20,
    },
    label: {
        fontSize: 16,
        marginBottom: 5,
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 15,
        fontSize: 16,
    },
    imageButton: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 8,
        padding: 15,
        alignItems: 'center',
        marginBottom: 15,
    },
    mapButton: {
        width: 50,
        height: 50, // Match input height approx
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        zIndex: 10,
    },
    previewContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    previewImage: {
        width: 80,
        height: 80,
        margin: 5,
        borderRadius: 5,
    },
    listItem: {
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    listItemTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    listItemSubtitle: {
        fontSize: 14,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    placementBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    placementText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    awardChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 6,
        marginBottom: 6,
    },
    awardText: {
        fontSize: 12,
        fontWeight: '600',
    },
    rosterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 6,
    },
    rosterName: {
        fontSize: 14,
        flex: 1,
    },
    guestBadge: {
        backgroundColor: '#e0e0e0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    guestText: {
        fontSize: 10,
        color: '#666',
        fontWeight: 'bold',
    },
});
