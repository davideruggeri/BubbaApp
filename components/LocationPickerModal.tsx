import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';

interface LocationPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (lat: number, lng: number) => void;
    theme: any;
    initialLocation?: { latitude: number; longitude: number } | null;
    existingLocations?: { latitude: number; longitude: number; title?: string }[];
}

export default function LocationPickerModal({ visible, onClose, onSelect, theme, initialLocation, existingLocations = [] }: LocationPickerModalProps) {
    const [selectedCoord, setSelectedCoord] = useState<{ latitude: number, longitude: number } | null>(initialLocation || null);

    // Reset when modal opens/closes or initialLocation changes
    useEffect(() => {
        if (visible) {
            setSelectedCoord(initialLocation || null);
        }
    }, [visible, initialLocation]);

    const handleWebClick = (lat: number, lng: number) => {
        setSelectedCoord({ latitude: lat, longitude: lng });
    };

    const confirmSelection = () => {
        if (selectedCoord) {
            onSelect(selectedCoord.latitude, selectedCoord.longitude);
            onClose();
        }
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
                <View style={[styles.pickerHeader, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={{ color: theme.colors.primary, fontSize: 18 }}>Annulla</Text>
                    </TouchableOpacity>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Seleziona Posizione</Text>
                    <TouchableOpacity onPress={confirmSelection} disabled={!selectedCoord}>
                        <Text style={{ color: selectedCoord ? theme.colors.primary : 'gray', fontSize: 18, fontWeight: 'bold' }}>Conferma</Text>
                    </TouchableOpacity>
                </View>

                {Platform.OS === 'web' ? (
                    <WebMapPicker onSelect={handleWebClick} selectedCoord={selectedCoord} existingLocations={existingLocations} />
                ) : (
                    <View style={styles.center}>
                        <Text style={{ color: theme.colors.text }}>Map picker is only available on Web for now.</Text>
                        {/* Fallback for manual entry could go here if needed, but for now we just show a message */}
                    </View>
                )}
            </View>
        </Modal>
    );
}

const WebMapPicker = ({ onSelect, selectedCoord, existingLocations }: any) => {
    const [ReactLeaflet, setReactLeaflet] = useState<any>(null);
    const [Leaflet, setLeaflet] = useState<any>(null);

    const [customIcon, setCustomIcon] = useState<any>(null);
    const [existingIcon, setExistingIcon] = useState<any>(null);

    useEffect(() => {
        Promise.all([
            import('leaflet'),
            import('react-leaflet')
        ]).then(([l, rl]) => {
            setLeaflet(l);
            setReactLeaflet(rl);

            // Helper to resolve asset URI
            const resolveAssetUri = (asset: any) => {
                let uri = '';
                if (typeof asset === 'string') {
                    uri = asset;
                } else if (asset && typeof asset === 'object') {
                    if (asset.uri) uri = asset.uri;
                    else if (asset.default) uri = asset.default;
                }
                return uri;
            };

            const markerAsset = require('../assets/marker.png');
            const markerUri = resolveAssetUri(markerAsset);

            if (markerUri) {
                // Create custom icon
                const icon = new l.Icon({
                    iconUrl: markerUri,
                    iconSize: [40, 40],
                    iconAnchor: [20, 40],
                    popupAnchor: [0, -40],
                });
                setCustomIcon(icon);

                // Create existing location icon
                const exIcon = new l.Icon({
                    iconUrl: markerUri,
                    iconSize: [30, 30],
                    iconAnchor: [15, 30],
                    popupAnchor: [0, -30],
                    className: 'existing-marker'
                });
                setExistingIcon(exIcon);
            }
        });
    }, []);

    if (!ReactLeaflet || !Leaflet) return <View style={styles.center}><Text>Caricamento Mappa...</Text></View>;

    const { MapContainer, TileLayer, Marker: LMarker, useMapEvents } = ReactLeaflet;

    const MapEvents = () => {
        useMapEvents({
            click(e: any) {
                onSelect(e.latlng.lat, e.latlng.lng);
            },
        });
        return null;
    };

    return (
        // @ts-ignore
        <MapContainer center={[41.9028, 12.4964]} zoom={5} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapEvents />
            {existingLocations && existingLocations.map((loc: any, index: number) => (
                existingIcon && (
                    <LMarker
                        key={`existing-${index}`}
                        position={[loc.latitude, loc.longitude]}
                        icon={existingIcon}
                        opacity={0.6}
                        eventHandlers={{
                            click: () => onSelect(loc.latitude, loc.longitude)
                        }}
                    >
                        {loc.title && <ReactLeaflet.Tooltip>{loc.title}</ReactLeaflet.Tooltip>}
                    </LMarker>
                )
            ))}
            {selectedCoord && customIcon && <LMarker position={[selectedCoord.latitude, selectedCoord.longitude]} icon={customIcon} zIndexOffset={1000} />}
        </MapContainer>
    );
};

const styles = StyleSheet.create({
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        zIndex: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
