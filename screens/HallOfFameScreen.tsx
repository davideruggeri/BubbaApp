import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { subscribeToHallOfFame, addHallOfFameEntry, deleteHallOfFameEntry, updateHallOfFameEntry, HallOfFameEntry, subscribeToMembers, Member, RosterMember, subscribeToWorldLocations, WorldLocation, restoreEventFromHallOfFame } from '../services/firestore';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import DatePickerModal from '../components/DatePickerModal';
import ScreenTitle from '../components/ScreenTitle';
import ParticipantsModal from '../components/ParticipantsModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import LocationPickerModal from '../components/LocationPickerModal';
import SearchablePicker from '../components/SearchablePicker';
import { showAlert, showConfirmation } from '../utils/alert';

import { useRoute } from '@react-navigation/native';

export default function HallOfFameScreen() {
    const route = useRoute<any>();
    const { userProfile, isBubbaOnly } = useAuth();
    const { theme } = useTheme();
    const navigation = useNavigation<any>();
    const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
    const [worldLocations, setWorldLocations] = useState<WorldLocation[]>([]);
    const [members, setMembers] = useState<Member[]>([]);

    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');
    const [latitude, setLatitude] = useState<number | undefined>(undefined);
    const [longitude, setLongitude] = useState<number | undefined>(undefined);
    const [dateDescription, setDateDescription] = useState('');
    const [date, setDate] = useState(''); // YYYY-MM-DD
    const [placement, setPlacement] = useState('');
    const [awardsInput, setAwardsInput] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [locationPickerVisible, setLocationPickerVisible] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    // Roster Modal State
    const [rosterModalVisible, setRosterModalVisible] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<HallOfFameEntry | null>(null);

    // Details Modal State
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [selectedDetailItem, setSelectedDetailItem] = useState<HallOfFameEntry | null>(null);

    useEffect(() => {
        if (route.params?.editEntryId && entries.length > 0) {
            const entryToEdit = entries.find(e => e.id === route.params.editEntryId);
            if (entryToEdit) {
                openEditModal(entryToEdit);
                // Clear param
                navigation.setParams({ editEntryId: undefined });
            }
        }
    }, [route.params?.editEntryId, entries]);

    useEffect(() => {
        const unsubscribeHOF = subscribeToHallOfFame((data) => {
            setEntries(data);
        });
        const unsubscribeMembers = subscribeToMembers((data) => {
            setMembers(data);
        }, true);
        const unsubscribeLocations = subscribeToWorldLocations((locations) => {
            setWorldLocations(locations);
        });
        return () => {
            unsubscribeHOF();
            unsubscribeMembers();
            unsubscribeLocations();
        };
    }, []);

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });

        if (!result.canceled) {
            setUploading(true);
            try {
                const { uri } = result.assets[0];
                const filename = uri.substring(uri.lastIndexOf('/') + 1);
                const storageRef = ref(storage, `images/${filename}`);
                const response = await fetch(uri);
                const blob = await response.blob();
                await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(storageRef);
                setImages(prev => [...prev, downloadURL]);
            } catch (error) {
                console.error("Error uploading image: ", error);
                showAlert("Errore", "Caricamento immagine fallito.");
            } finally {
                setUploading(false);
            }
        }
    };

    const handleSaveEntry = async () => {
        if (!title || !dateDescription || !date) {
            showAlert("Errore", "Compila tutti i campi obbligatori (Titolo, Data, Data Ordinamento).");
            return;
        }

        const awards = awardsInput.split(',').map(s => s.trim()).filter(s => s.length > 0);

        if (editingId) {
            showConfirmation(
                "Conferma Modifica Torneo",
                `Vuoi salvare le modifiche al torneo "${title}"?`,
                async () => {
                    try {
                        await updateHallOfFameEntry({
                            id: editingId,
                            title,
                            location,
                            latitude,
                            longitude,
                            dateDescription,
                            date,
                            placement,
                            awards,
                            images
                        });
                        closeModal();
                        showAlert("Successo", "Torneo aggiornato correttamente.");
                    } catch (error) {
                        console.error(error);
                        showAlert("Errore", "Impossibile salvare l'elemento.");
                    }
                },
                "Salva Modifiche"
            );
            return;
        }

        try {
            await addHallOfFameEntry({
                title,
                location,
                latitude,
                longitude,
                dateDescription,
                date,
                placement,
                awards,
                images
            });
            closeModal();
            showAlert("Successo", "Nuovo torneo aggiunto con successo.");
        } catch (error) {
            console.error(error);
            showAlert("Errore", "Impossibile salvare l'elemento.");
        }
    };

    const handleDelete = async (id: string) => {
        showConfirmation(
            "Elimina",
            "Sei sicuro di voler eliminare questo elemento?",
            async () => {
                await deleteHallOfFameEntry(id);
                if (editingId === id) closeModal();
            },
            "Elimina"
        );
    };

    const openEditModal = (item: HallOfFameEntry) => {
        setEditingId(item.id);
        setTitle(item.title);
        setLocation(item.location || '');
        setLatitude(item.latitude);
        setLongitude(item.longitude);
        setDateDescription(item.dateDescription);
        setDate(item.date || '');
        setPlacement(item.placement);
        setAwardsInput(item.awards ? item.awards.join(', ') : '');
        setImages(item.images || []);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setEditingId(null);
        setTitle('');
        setLocation('');
        setLatitude(undefined);
        setLongitude(undefined);
        setDateDescription('');
        setDate('');
        setPlacement('');
        setAwardsInput('');
        setImages([]);
        setUploading(false);
    };

    const handleOpenRoster = (item: HallOfFameEntry) => {
        setSelectedEntry(item);
        setRosterModalVisible(true);
    };

    // Roster Management Handlers
    const handleAddRosterMember = async (member: Member) => {
        if (!selectedEntry) return;
        const newRosterItem: RosterMember = {
            id: Math.random().toString(36).substr(2, 9), // Temporary ID
            name: `${member.firstName} ${member.lastName || ''}`.trim(),
            isGuest: false,
            memberId: member.id,
            role: 'player'
        };
        const updatedRoster = [...(selectedEntry.roster || []), newRosterItem];

        // Optimistic Update
        setSelectedEntry({ ...selectedEntry, roster: updatedRoster });
        await updateHallOfFameEntry({ ...selectedEntry, roster: updatedRoster });
    };

    const handleAddRosterMembers = async (members: Member[]) => {
        if (!selectedEntry) return;
        const newRosterItems: RosterMember[] = members.map(member => ({
            id: Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9), // Unique ID
            name: `${member.firstName} ${member.lastName || ''}`.trim(),
            isGuest: false,
            memberId: member.id,
            role: 'player'
        }));

        const updatedRoster = [...(selectedEntry.roster || []), ...newRosterItems];

        // Optimistic Update
        setSelectedEntry({ ...selectedEntry, roster: updatedRoster });
        await updateHallOfFameEntry({ ...selectedEntry, roster: updatedRoster });
    };

    const handleAddRosterGuest = async (name: string) => {
        if (!selectedEntry) return;
        const newRosterItem: RosterMember = {
            id: Math.random().toString(36).substr(2, 9),
            name: name,
            isGuest: true,
            role: 'player'
        };
        const updatedRoster = [...(selectedEntry.roster || []), newRosterItem];

        setSelectedEntry({ ...selectedEntry, roster: updatedRoster });
        await updateHallOfFameEntry({ ...selectedEntry, roster: updatedRoster });
    };

    const handleRemoveRosterMember = async (id: string) => {
        if (!selectedEntry) return;
        const updatedRoster = (selectedEntry.roster || []).filter(m => m.id !== id);

        setSelectedEntry({ ...selectedEntry, roster: updatedRoster });
        await updateHallOfFameEntry({ ...selectedEntry, roster: updatedRoster });
    };

    const handleToggleRosterRole = async (item: RosterMember) => {
        if (!selectedEntry) return;
        const newRole: 'player' | 'guest' = item.role === 'guest' ? 'player' : 'guest';
        const updatedRoster = (selectedEntry.roster || []).map(m =>
            m.id === item.id ? { ...m, role: newRole } : m
        );

        setSelectedEntry({ ...selectedEntry, roster: updatedRoster });
        await updateHallOfFameEntry({ ...selectedEntry, roster: updatedRoster });
    };

    const getPlacementColor = (placementText: string) => {
        const text = placementText.toLowerCase().trim();
        if (/^1(\D|$)/.test(text) || text.includes('primo') || text.includes('winner') || text.includes('vincitori')) return '#fbc02d';
        if (/^2(\D|$)/.test(text) || text.includes('secondo') || text.includes('finalist')) return '#C0C0C0';
        if (/^3(\D|$)/.test(text) || text.includes('terzo')) return '#CD7F32';
        return '#e3f2fd';
    };

    const getPlacementTextColor = (placementText: string) => {
        const text = placementText.toLowerCase().trim();
        if (/^1(\D|$)/.test(text) || text.includes('primo') || text.includes('winner') || text.includes('vincitori')) return '#fff';
        if (/^2(\D|$)/.test(text) || text.includes('secondo') || text.includes('finalist')) return '#fff';
        if (/^3(\D|$)/.test(text) || text.includes('terzo')) return '#fff';
        return '#003399';
    };

    const renderItem = ({ item }: { item: HallOfFameEntry }) => {
        const badgeColor = item.placement ? getPlacementColor(item.placement) : 'transparent';
        const badgeTextColor = item.placement ? getPlacementTextColor(item.placement) : '#000';

        return (
            <TouchableOpacity
                onPress={() => {
                    setSelectedDetailItem(item);
                    setDetailsModalVisible(true);
                }}
                onLongPress={() => !isBubbaOnly && handleDelete(item.id)}
                activeOpacity={0.9}
            >
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{item.title}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {item.placement ? (
                                <View style={[styles.placementBadge, { backgroundColor: badgeColor, marginRight: !isBubbaOnly ? 10 : 0 }]}>
                                    <Text style={[styles.placementText, { color: badgeTextColor }]}>{item.placement}</Text>
                                </View>
                            ) : null}
                            {!isBubbaOnly && (
                                <TouchableOpacity onPress={() => openEditModal(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Image source={require('../assets/gear.png')} style={{ width: 24, height: 24, tintColor: theme.colors.textSecondary }} resizeMode="contain" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <ScreenTitle title="HALL OF FAME" onBack={() => navigation.goBack()} />
                {!isBubbaOnly && (
                    <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.primary }]} onPress={() => setModalVisible(true)}>
                        <Image source={require('../assets/plus.png')} style={styles.addIcon} />
                    </TouchableOpacity>
                )}
            </View>

            <View style={{ padding: 10, alignItems: 'center' }}>
                <Text style={{ color: theme.colors.textSecondary }}>Totale Tornei: {entries.length}</Text>
            </View>

            <FlatList
                style={{ flex: 1 }}
                data={entries}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                initialNumToRender={50}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Nessun torneo inserito.</Text>}
            />

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{editingId ? 'Modifica Torneo' : 'Nuovo Torneo'}</Text>

                        <ScrollView style={{ width: '100%' }}>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                placeholder="Nome Torneo *"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={title}
                                onChangeText={setTitle}
                            />

                            <View style={{ marginBottom: 15 }}>
                                <SearchablePicker
                                    selectedValue={location}
                                    onValueChange={(val) => {
                                        setLocation(val);
                                        const existing = worldLocations.find(l => l.locationName === val || l.title === val);
                                        if (existing) {
                                            setLatitude(existing.latitude);
                                            setLongitude(existing.longitude);
                                        }
                                    }}
                                    items={Array.from(new Set(worldLocations.map(l => l.locationName || l.title).filter(n => n)))}
                                    placeholder="Luogo (es. Rimini)"
                                    title="Seleziona Luogo"
                                />
                            </View>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                placeholder="Luogo (es. Rimini)"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={location}
                                onChangeText={setLocation}
                            />

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primary, padding: 10, borderRadius: 8 }}
                                    onPress={() => setLocationPickerVisible(true)}
                                >
                                    <Image source={require('../assets/world.png')} style={{ width: 20, height: 20, tintColor: 'white', marginRight: 5 }} />
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                        {latitude && longitude ? 'Modifica Posizione' : 'Seleziona su Mappa'}
                                    </Text>
                                </TouchableOpacity>
                                {latitude && longitude && (
                                    <Text style={{ marginLeft: 10, color: theme.colors.textSecondary, fontSize: 12 }}>
                                        Lat: {latitude.toFixed(4)}, Lon: {longitude.toFixed(4)}
                                    </Text>
                                )}
                            </View>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                placeholder="Data (es. Primavera 2024) *"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={dateDescription}
                                onChangeText={setDateDescription}
                            />

                            <TouchableOpacity
                                style={[styles.datePickerButton, { backgroundColor: theme.colors.inputBackground }]}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={[styles.datePickerButtonText, { color: date ? theme.colors.text : theme.colors.textSecondary }]}>
                                    {date ? `Data Fine: ${formatDate(date)}` : 'Seleziona Data Fine (per ordinamento) *'}
                                </Text>
                            </TouchableOpacity>

                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                placeholder="Piazzamento (es. 1° Posto)"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={placement}
                                onChangeText={setPlacement}
                            />
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                placeholder="Premi (separati da virgola)"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={awardsInput}
                                onChangeText={setAwardsInput}
                            />

                            {editingId && (
                                <TouchableOpacity
                                    style={[styles.participantsButton, { backgroundColor: theme.colors.inputBackground, marginBottom: 15, borderColor: theme.colors.primary }]}
                                    onPress={() => {
                                        const entry = entries.find(e => e.id === editingId);
                                        if (entry) handleOpenRoster(entry);
                                    }}
                                >
                                    <Text style={[styles.participantsButtonText, { color: theme.colors.primary }]}>
                                        Gestisci Roster ({entries.find(e => e.id === editingId)?.roster?.length || 0})
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={{ borderColor: theme.colors.primary, borderWidth: 1, padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 10 }} onPress={pickImage} disabled={uploading}>
                                <Text style={{ color: theme.colors.primary }}>{uploading ? 'Caricamento...' : '+ Aggiungi Foto'}</Text>
                            </TouchableOpacity>

                            <ScrollView horizontal style={{ flexDirection: 'row', marginBottom: 15 }}>
                                {images.map((uri, index) => (
                                    <View key={index} style={{ position: 'relative', marginRight: 10 }}>
                                        <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 5 }} />
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
                            </ScrollView>

                            <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>* Campi obbligatori</Text>
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            {editingId && (
                                <TouchableOpacity
                                    style={[styles.button, styles.deleteButton]}
                                    onPress={() => handleDelete(editingId)}
                                >
                                    <Text style={styles.buttonText}>Elimina</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.inputBackground }]} onPress={closeModal}>
                                <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, styles.saveButton, { backgroundColor: theme.colors.primary }]} onPress={handleSaveEntry}>
                                <Text style={styles.buttonText}>Salva</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal >

            <LocationPickerModal
                visible={locationPickerVisible}
                onClose={() => setLocationPickerVisible(false)}
                onSelect={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                }}
                theme={theme}
                initialLocation={latitude && longitude ? { latitude, longitude } : null}
                existingLocations={[
                    ...entries.filter(e => e.latitude && e.longitude).map(e => ({ latitude: e.latitude!, longitude: e.longitude!, title: e.location || e.title })),
                    ...worldLocations.map(l => ({ latitude: l.latitude, longitude: l.longitude, title: l.locationName }))
                ]}
            />

            <DatePickerModal
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                onSelectDate={setDate}
                initialDate={date}
            />

            <ParticipantsModal
                visible={rosterModalVisible}
                onClose={() => setRosterModalVisible(false)}
                event={null} // Not tied to a calendar event
                members={members}
                readOnly={isBubbaOnly}
                initialRoster={selectedEntry?.roster || []}
                onAddMember={handleAddRosterMember}
                onAddMembers={handleAddRosterMembers}
                onAddGuest={handleAddRosterGuest}
                onRemoveMember={handleRemoveRosterMember}
                onToggleRole={handleToggleRosterRole}
            />

            <Modal
                animationType="slide"
                transparent={true}
                visible={detailsModalVisible}
                onRequestClose={() => setDetailsModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: theme.colors.card, maxHeight: '90%' }]}>
                        <TouchableOpacity
                            onPress={() => setDetailsModalVisible(false)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={{ position: 'absolute', top: 15, right: 15, zIndex: 10 }}
                        >
                            <Image source={require('../assets/x.png')} style={{ width: 30, height: 30 }} resizeMode="contain" />
                        </TouchableOpacity>

                        <View style={{ marginBottom: 15, paddingTop: 5 }}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text, textAlign: 'center', paddingHorizontal: 40 }]}>{selectedDetailItem?.title}</Text>
                        </View>

                        <ScrollView style={{ width: '100%' }}>
                            {/* Info Section */}
                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
                                    {selectedDetailItem?.location ? `${selectedDetailItem.location} - ` : ''}{selectedDetailItem?.dateDescription}
                                </Text>
                                {selectedDetailItem?.placement && (
                                    <Text style={{ color: theme.colors.primary, fontWeight: 'bold', marginTop: 5 }}>
                                        Piazzamento: {selectedDetailItem.placement}
                                    </Text>
                                )}
                            </View>

                            {/* Awards Section */}
                            {selectedDetailItem?.awards && selectedDetailItem.awards.length > 0 && (
                                <View style={{ marginBottom: 20 }}>
                                    <Text style={{ color: theme.colors.text, fontWeight: 'bold', marginBottom: 5 }}>Premi:</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                        {selectedDetailItem.awards.map((award, index) => (
                                            <View key={index} style={[styles.awardChip, { backgroundColor: theme.colors.inputBackground, marginRight: 5, marginBottom: 5 }]}>
                                                <Text style={[styles.awardText, { color: theme.colors.primary }]}>{award}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Photos Section */}
                            {selectedDetailItem?.images && selectedDetailItem.images.length > 0 && (
                                <View style={{ marginBottom: 20 }}>
                                    <Text style={{ color: theme.colors.text, fontWeight: 'bold', marginBottom: 10 }}>Foto:</Text>
                                    <ScrollView horizontal>
                                        {selectedDetailItem.images.map((uri, index) => (
                                            <Image key={index} source={{ uri }} style={{ width: 120, height: 120, marginRight: 10, borderRadius: 8 }} />
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Roster Section */}
                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ color: theme.colors.text, fontWeight: 'bold', marginBottom: 10 }}>
                                    Roster ({selectedDetailItem?.roster?.length || 0}):
                                </Text>
                                {selectedDetailItem?.roster && selectedDetailItem.roster.length > 0 ? (
                                    selectedDetailItem.roster.map((member, index) => (
                                        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, padding: 10, backgroundColor: theme.colors.inputBackground, borderRadius: 8 }}>
                                            <Text style={{ color: theme.colors.text, flex: 1 }}>{member.name}</Text>
                                            {member.role === 'guest' && (
                                                <View style={{ backgroundColor: '#e0e0e0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                                    <Text style={{ fontSize: 10, color: '#666' }}>Ospite</Text>
                                                </View>
                                            )}
                                        </View>
                                    ))
                                ) : (
                                    <Text style={{ color: theme.colors.textSecondary }}>Nessun giocatore nel roster.</Text>
                                )}
                            </View>

                            {/* Restore Button */}
                            <View style={{ marginTop: 10, marginBottom: 20 }}>
                                <TouchableOpacity
                                    style={{
                                        backgroundColor: theme.colors.inputBackground,
                                        padding: 15,
                                        borderRadius: 10,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 1,
                                        borderColor: theme.colors.primary
                                    }}
                                    onPress={() => {
                                        if (selectedDetailItem) {
                                            showConfirmation(
                                                "Ripristina",
                                                "Vuoi ripristinare questo evento nel Calendario? Verrà creato come evento archiviato.",
                                                async () => {
                                                    try {
                                                        await restoreEventFromHallOfFame(selectedDetailItem);
                                                        showAlert("Successo", "Evento ripristinato nel calendario!");
                                                        setDetailsModalVisible(false);
                                                    } catch (error) {
                                                        showAlert("Errore", "Impossibile ripristinare l'evento.");
                                                    }
                                                },
                                                "Ripristina"
                                            );
                                        }
                                    }}
                                >
                                    <Image source={require('../assets/calendar.png')} style={{ width: 20, height: 20, tintColor: theme.colors.primary, marginRight: 10 }} resizeMode="contain" />
                                    <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Ripristina nel Calendario</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        position: 'relative',
        paddingVertical: 20,
    },
    addButton: {
        position: 'absolute',
        right: 20,
        backgroundColor: '#003399',
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addIcon: {
        width: 15,
        height: 15,
        tintColor: '#fff',
    },
    listContent: {
        padding: 20,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        color: '#999',
        fontSize: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    placementBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 10,
    },
    placementText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    cardSubHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    cardLocation: {
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
    cardDate: {
        fontSize: 16,
        color: '#999',
    },
    awardsContainer: {
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 10,
    },
    awardsLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 5,
        fontWeight: 'bold',
    },
    awardsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    awardChip: {
        backgroundColor: '#e3f2fd',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 8,
        marginBottom: 5,
    },
    awardText: {
        color: '#003399',
        fontSize: 12,
        fontWeight: '600',
    },
    rosterButton: {
        marginTop: 15,
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    rosterButtonText: {
        fontWeight: 'bold',
    },
    centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        width: '90%',
        backgroundColor: "white",
        borderRadius: 20,
        padding: 25,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#003399',
    },
    input: {
        width: '100%',
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        fontSize: 16,
    },
    datePickerButton: {
        width: '100%',
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
    },
    datePickerButtonText: {
        fontSize: 16,
        color: '#000',
    },
    hint: {
        alignSelf: 'flex-start',
        color: '#999',
        fontSize: 12,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    button: {
        flex: 1,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    participantsButton: {
        marginTop: 15,
        padding: 15,
        backgroundColor: '#e3f2fd',
        borderRadius: 10,
        alignItems: 'center',
        width: '100%',
        borderWidth: 1,
        borderColor: '#003399'
    },
    participantsButtonText: {
        color: '#003399',
        fontWeight: 'bold',
        fontSize: 16
    },
    cancelButton: {
        backgroundColor: '#999',
    },
    deleteButton: {
        backgroundColor: '#FF3B30',
    },
    saveButton: {
        backgroundColor: '#003399',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
