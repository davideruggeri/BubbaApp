import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, FlatList, Dimensions, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { subscribeToWorldLocations, WorldLocation, addWorldLocation, updateWorldLocation, deleteWorldLocation, subscribeToEvents, subscribeToHallOfFame, Event, HallOfFameEntry, deleteEvent, deleteHallOfFameEntry } from '../services/firestore';
import { useTheme } from '../context/ThemeContext';
import ScreenTitle from '../components/ScreenTitle';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import LocationPickerModal from '../components/LocationPickerModal';
import SearchablePicker from '../components/SearchablePicker';
import { showAlert, showConfirmation } from '../utils/alert';

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
    originalItem: WorldLocation | Event | HallOfFameEntry;
};

export default function WorldMapScreen() {
    const { theme, isDark } = useTheme();
    const navigation = useNavigation<any>();
    const { isGlobalAdmin, isStaff, userProfile } = useAuth();

    const [mapItems, setMapItems] = useState<MapItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
    const [tempSelectedId, setTempSelectedId] = useState<string | null>(null);

    // Add/Edit State (Only for WorldLocation type)
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [editingLocation, setEditingLocation] = useState<WorldLocation | null>(null);

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

    const updateMapItems = (data: any[], type: 'location' | 'event' | 'hof') => {
        if (type === 'location') setRawLocations(data);
        if (type === 'event') setRawEvents(data);
        if (type === 'hof') setRawHOF(data);
    };

    useEffect(() => {
        const items: MapItem[] = [];

        // 1. World Locations
        rawLocations.forEach(loc => {
            items.push({
                id: loc.id,
                type: 'location',
                title: loc.title,
                locationName: loc.locationName,
                date: loc.date,
                latitude: loc.latitude,
                longitude: loc.longitude,
                description: loc.description,
                images: loc.images,
                originalItem: loc
            });
        });

        // 2. Events (with coords and showOnMap !== false)
        rawEvents.forEach(ev => {
            if (ev.latitude && ev.longitude && ev.showOnMap !== false) {
                items.push({
                    id: ev.id,
                    type: 'event',
                    title: ev.title,
                    locationName: ev.location || 'Posizione Evento',
                    date: ev.date,
                    latitude: ev.latitude,
                    longitude: ev.longitude,
                    description: ev.additionalInfo,
                    images: ev.images,
                    originalItem: ev
                });
            }
        });

        // 3. Hall of Fame (with coords)
        rawHOF.forEach(entry => {
            if (entry.latitude && entry.longitude) {
                items.push({
                    id: entry.id,
                    type: 'hof',
                    title: entry.title,
                    locationName: entry.location || '',
                    date: entry.dateDescription || entry.date,
                    latitude: entry.latitude,
                    longitude: entry.longitude,
                    description: entry.placement ? `Piazzamento: ${entry.placement}` : undefined,
                    images: entry.images,
                    originalItem: entry
                });
            }
        });

        setMapItems(items);
    }, [rawLocations, rawEvents, rawHOF]);


    const [filterLocationName, setFilterLocationName] = useState<string | null>(null);

    const handleMarkerPress = (item: MapItem) => {
        setFilterLocationName(item.locationName);
        setIsListModalVisible(true);
    };

    const handleMarkerClick = (item: MapItem) => {
        if (tempSelectedId === item.id) {
            handleMarkerPress(item);
        } else {
            setTempSelectedId(item.id);
            setTimeout(() => {
                setTempSelectedId(prev => {
                    if (prev === item.id) {
                        handleMarkerPress(item);
                        return null;
                    }
                    return prev;
                });
            }, 1000);
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
        if (item.type === 'location') {
            setEditingLocation(item.originalItem as WorldLocation);
            setIsAddModalVisible(true);
        } else if (item.type === 'event') {
            navigation.navigate('Calendar', { editEventId: item.id });
        } else if (item.type === 'hof') {
            navigation.navigate('HallOfFame', { editEntryId: item.id });
        }
    };

    // Web Map Implementation
    const [Leaflet, setLeaflet] = useState<any>(null);
    const [ReactLeaflet, setReactLeaflet] = useState<any>(null);

    useEffect(() => {
        if (Platform.OS === 'web') {
            Promise.all([
                import('leaflet'),
                import('react-leaflet')
            ]).then(([l, rl]) => {
                setLeaflet(l);
                setReactLeaflet(rl);

                // Fix for default marker icon in Leaflet
                // @ts-ignore
                delete l.Icon.Default.prototype._getIconUrl;
                l.Icon.Default.mergeOptions({
                    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
                    iconUrl: require('leaflet/dist/images/marker-icon.png'),
                    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
                });
            });
        }
    }, []);

    // Inject CSS for rounded marker (Web Only)
    useEffect(() => {
        if (Platform.OS === 'web') {
            const style = document.createElement('style');
            style.innerHTML = `
                .custom-marker {
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                }
            `;
            document.head.appendChild(style);
            return () => {
                document.head.removeChild(style);
            };
        }
    }, []);

    const getIcon = (type: 'location' | 'event' | 'hof') => {
        if (Platform.OS !== 'web' || !Leaflet) return null;
        try {
            let logoAsset = require('../assets/logo.jpeg');
            let className = 'custom-marker';

            let logoUri = '';
            if (typeof logoAsset === 'string') {
                logoUri = logoAsset;
            } else if (logoAsset && typeof logoAsset === 'object') {
                if (logoAsset.uri) {
                    logoUri = logoAsset.uri;
                } else if (logoAsset.default) {
                    logoUri = logoAsset.default;
                }
            }
            if (!logoUri && Image && typeof Image.resolveAssetSource === 'function') {
                const assetSource = Image.resolveAssetSource(logoAsset);
                if (assetSource) logoUri = assetSource.uri;
            }

            if (!logoUri) return null;

            return new Leaflet.Icon({
                iconUrl: logoUri,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
                popupAnchor: [0, -20],
                className: className
            });
        } catch (e) {
            return null;
        }
    };

    const locationIcon = React.useMemo(() => getIcon('location'), [Leaflet]);
    const eventIcon = React.useMemo(() => getIcon('event'), [Leaflet]);
    const hofIcon = React.useMemo(() => getIcon('hof'), [Leaflet]);

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

    if (!Leaflet || !ReactLeaflet) {
        return <View style={styles.center}><Text>Caricamento Mappa...</Text></View>;
    }

    const { MapContainer, TileLayer, Marker: LMarker, Popup, Tooltip } = ReactLeaflet;

    const tileLayerUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const attribution = isDark
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    return (
        <View style={{ flex: 1, height: '100vh', paddingTop: 20, backgroundColor: theme.colors.background } as any}>
            <ScreenTitle
                title="Bubba World"
                onBack={() => navigation.goBack()}
                rightAction={{
                    icon: require('../assets/threeLine.png'),
                    onPress: () => {
                        setFilterLocationName(null);
                        setIsListModalVisible(true);
                    }
                }}
            />
            {/* @ts-ignore */}
            <MapContainer center={[41.9028, 12.4964]} zoom={3} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    url={tileLayerUrl}
                    attribution={attribution}
                />
                {mapItems.map((item: MapItem) => {
                    let icon = locationIcon;
                    if (item.type === 'event') icon = eventIcon;
                    if (item.type === 'hof') icon = hofIcon;

                    if (!icon) return null;

                    return (
                        <LMarker
                            key={`${item.type}_${item.id}`}
                            position={[item.latitude, item.longitude]}
                            icon={icon}
                            eventHandlers={{
                                click: () => {
                                    handleMarkerClick(item);
                                },
                            }}
                            opacity={tempSelectedId === item.id ? 0.6 : 1}
                        >
                            <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent={false}>
                                <span>{item.locationName || item.title}</span>
                            </Tooltip>
                        </LMarker>
                    );
                })}
            </MapContainer>

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
                        setEditingLocation(null);
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
                    setEditingLocation(null);
                }}
            >
                <AddLocationModal
                    onClose={() => {
                        setIsAddModalVisible(false);
                        setEditingLocation(null);
                    }}
                    theme={theme}
                    initialLocation={editingLocation}
                    existingItems={mapItems}
                />
            </Modal>

            <Modal
                animationType="slide"
                transparent={false}
                visible={isListModalVisible}
                onRequestClose={() => setIsListModalVisible(false)}
            >
                <LocationListModal
                    items={mapItems}
                    onClose={() => setIsListModalVisible(false)}
                    onSelect={(item) => {
                        setIsListModalVisible(false);
                        setSelectedItem(item);
                    }}
                    onAdd={() => {
                        setIsListModalVisible(false);
                        setEditingLocation(null);
                        setIsAddModalVisible(true);
                    }}
                    theme={theme}
                    canAdd={canAdd}
                    formatDate={formatDate}
                    selectedLocationName={filterLocationName}
                    onSelectLocationName={setFilterLocationName}
                />
            </Modal>
        </View>
    );
}

// --- Location List Modal ---
const LocationListModal = ({ items, onClose, onSelect, onAdd, theme, canAdd, formatDate, selectedLocationName, onSelectLocationName }: { items: MapItem[], onClose: () => void, onSelect: (item: MapItem) => void, onAdd: () => void, theme: any, canAdd: boolean, formatDate: (d: string) => string, selectedLocationName: string | null, onSelectLocationName: (name: string | null) => void }) => {

    // Deduplicate locations based on locationName
    const uniqueLocations = items.filter((loc, index, self) =>
        index === self.findIndex((t) => t.locationName === loc.locationName)
    );

    const filteredItems = selectedLocationName
        ? items.filter(loc => loc.locationName === selectedLocationName)
        : [];

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.modalHeader}>
                {selectedLocationName ? (
                    <TouchableOpacity onPress={() => onSelectLocationName(null)} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Image source={require('../assets/leftArrow.png')} style={{ width: 24, height: 24, tintColor: theme.colors.primary }} resizeMode="contain" />
                    </TouchableOpacity>
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
                            <Text style={[styles.listItemTitle, { color: theme.colors.text }]}>{item.title}</Text>
                            <Text style={[styles.listItemSubtitle, { color: theme.colors.textSecondary }]}>{formatDate(item.date)} ({item.type === 'location' ? 'Luogo' : item.type === 'event' ? 'Evento' : 'Hall of Fame'})</Text>
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
                            <Text style={[styles.listItemTitle, { color: theme.colors.text }]}>{item.locationName || 'Nessun luogo'}</Text>
                            <Text style={[styles.listItemSubtitle, { color: theme.colors.textSecondary }]}>
                                {items.filter(l => l.locationName === item.locationName).length} Elementi
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
const LocationDetails = ({ item, onClose, theme, onDelete, onEdit, canEdit, formatDate }: { item: MapItem, onClose: () => void, theme: any, onDelete?: (item: MapItem) => void, onEdit?: (item: MapItem) => void, canEdit?: boolean, formatDate: (d: string) => string }) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

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

            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                {item.locationName ? `${item.locationName} - ` : ''}{formatDate(item.date)}
            </Text>
            {item.description && <Text style={[styles.description, { color: theme.colors.text }]}>{item.description}</Text>}

            {/* Roster Display for HoF */}
            {(item.originalItem as HallOfFameEntry).roster && (item.originalItem as HallOfFameEntry).roster!.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                    <Text style={[styles.subtitle, { color: theme.colors.text, fontSize: 18, fontWeight: 'bold' }]}>Partecipanti:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {(item.originalItem as HallOfFameEntry).roster!.map((member, index) => (
                            <Text key={index} style={{ color: theme.colors.textSecondary, marginRight: 10, marginBottom: 5 }}>
                                • {member.name}
                            </Text>
                        ))}
                    </View>
                </View>
            )}

            {item.images && item.images.length > 0 && (
                <FlatList
                    data={item.images}
                    keyExtractor={(item, index) => index.toString()}
                    numColumns={3}
                    renderItem={({ item }) => (
                        <TouchableOpacity onPress={() => setSelectedImage(item)}>
                            <Image source={{ uri: item }} style={styles.gridImage} />
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={styles.gallery}
                />
            )}

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

// --- Add Location Modal (Web Version) ---
const AddLocationModal = ({ onClose, theme, initialLocation, existingItems = [] }: { onClose: () => void, theme: any, initialLocation?: WorldLocation | null, existingItems?: MapItem[] }) => {
    const [title, setTitle] = useState(initialLocation?.title || '');
    const [locationName, setLocationName] = useState(initialLocation?.locationName || '');
    const [description, setDescription] = useState(initialLocation?.description || '');
    const [date, setDate] = useState(initialLocation?.date || new Date().toISOString().split('T')[0]);
    const [latitude, setLatitude] = useState(initialLocation?.latitude?.toString() || '');
    const [longitude, setLongitude] = useState(initialLocation?.longitude?.toString() || '');
    const [images, setImages] = useState<string[]>(initialLocation?.images || []);
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

            if (initialLocation) {
                showConfirmation(
                    "Conferma Modifica Luogo",
                    `Vuoi salvare le modifiche per "${title}" (${locationName})?`,
                    async () => {
                        try {
                            await updateWorldLocation({
                                id: initialLocation.id,
                                title,
                                locationName,
                                description,
                                date,
                                latitude: parseFloat(latitude),
                                longitude: parseFloat(longitude),
                                images: uploadedImageUrls
                            });
                            showAlert('Successo', 'Luogo aggiornato correttamente!');
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
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
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
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{initialLocation ? 'Modifica Luogo' : 'Nuovo Luogo'}</Text>
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
    }
});
