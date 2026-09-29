import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Image, Modal, TextInput, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToEvents, Event, subscribeToMembers, Member, updateEvent, addEvent, archiveEvent, deleteEvent } from '../services/firestore';
import ScreenTitle from '../components/ScreenTitle';
import ParticipantsModal from '../components/ParticipantsModal';

import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { showAlert, showConfirmation } from '../utils/alert';

export default function RosterScreen() {
    const { userProfile, isBubbaOnly } = useAuth();
    const { theme } = useTheme();
    const navigation = useNavigation();
    const [events, setEvents] = useState<Event[]>([]);
    const [championships, setChampionships] = useState<Event[]>([]);
    const [matches, setMatches] = useState<Event[]>([]);
    const [linkableEvents, setLinkableEvents] = useState<Event[]>([]);
    const [members, setMembers] = useState<Member[]>([]);


    const [modalVisible, setModalVisible] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

    // New/Edit Championship Modal
    const [newChampModalVisible, setNewChampModalVisible] = useState(false);
    const [editingChampId, setEditingChampId] = useState<string | null>(null);
    const [newChampName, setNewChampName] = useState('');
    const [newChampYear, setNewChampYear] = useState(new Date().getFullYear().toString());
    const [newChampSurface, setNewChampSurface] = useState<'erba' | 'sabbia'>('erba');
    const [selectedLinkedEvents, setSelectedLinkedEvents] = useState<string[]>([]);

    // Terminate Modal
    const [terminateModalVisible, setTerminateModalVisible] = useState(false);
    const [eventToTerminate, setEventToTerminate] = useState<Event | null>(null);
    const [terminatePlacement, setTerminatePlacement] = useState('');
    const [terminateAwards, setTerminateAwards] = useState('');

    useEffect(() => {
        const unsubscribeEvents = subscribeToEvents((allEvents) => {
            // Filter for tournaments
            const tournaments = allEvents.filter(e => e.type === 'tournament' && !e.isArchived);
            setEvents(tournaments);

            // Filter for championships (containers)
            // Championships seasons usually aren't archived in the same way, but let's apply consistency or keep them if they are containers.
            // Requirement: "se in Roster faccio termina... deve andare in automatico in HoF... non deve essere in Roster"
            // So yes, filter them too if they are terminated.
            const champs = allEvents.filter(e => e.type === 'championship_season' && !e.isArchived);
            setChampionships(champs);

            // Filter for matches (friendly)
            const matchEvents = allEvents.filter(e => e.type === 'match' && !e.isArchived);
            setMatches(matchEvents);

            // Store events for linking
            // Linkable events might need to include archived ones? 
            // "gli eventi che sono in Hof non devono essere in Roster e viceverssa"
            // So if it's in HoF (Archived), it shouldn't be in Roster.
            // For linking, maybe we still want to link past events? 
            // But usually we link active ones. Let's filter archived out for consistency in the dropdowns too, 
            // unless user needs to link a past event. For now, assume "Not in Roster" means "Hidden from management".
            const linkable = allEvents.filter(e =>
                !e.isArchived && (
                    e.type === 'match' ||
                    e.type === 'championship' ||
                    e.type === 'tournament'
                )
            );
            setLinkableEvents(linkable);
        });
        const unsubscribeMembers = subscribeToMembers((updatedMembers) => {
            setMembers(updatedMembers);
        }, true);

        return () => {
            unsubscribeEvents();
            unsubscribeMembers();
        };
    }, []);

    // Keep selectedEvent in sync with updates
    useEffect(() => {
        if (selectedEvent) {
            const updatedEvent = championships.find(c => c.id === selectedEvent.id) ||
                events.find(e => e.id === selectedEvent.id) ||
                linkableEvents.find(e => e.id === selectedEvent.id);

            if (updatedEvent && updatedEvent !== selectedEvent) {
                setSelectedEvent(updatedEvent);
            }
        }
    }, [championships, events, linkableEvents]);

    const handleOpenEvent = (event: Event) => {
        setSelectedEvent(event);
        setModalVisible(true);
    };

    const openCreateModal = () => {
        setEditingChampId(null);
        setNewChampName('');
        setNewChampYear(new Date().getFullYear().toString());
        setNewChampSurface('erba');
        setSelectedLinkedEvents([]);
        setNewChampModalVisible(true);
    };

    const openEditModal = (champ: Event) => {
        setEditingChampId(champ.id);
        setNewChampName(champ.title);
        setNewChampYear(champ.season || '');
        setNewChampSurface(champ.surface || 'erba');
        setSelectedLinkedEvents(champ.linkedEventIds || []);
        setNewChampModalVisible(true);
    };

    const handleSaveChampionship = async () => {
        if (!newChampYear) {
            showAlert("Errore", "Inserisci l'anno.");
            return;
        }
        const title = newChampName.trim() || `Campionato ${newChampSurface === 'erba' ? 'Erba' : 'Sabbia'} ${newChampYear}`;

        // Determine the date for the championship season
        // Default to today, but if linked events exist, use the LATEST date among them.
        let champDate = new Date().toISOString().split('T')[0];

        if (selectedLinkedEvents.length > 0) {
            const linkedEventObjects = linkableEvents.filter(e => selectedLinkedEvents.includes(e.id));
            if (linkedEventObjects.length > 0) {
                // Sort by date descending
                linkedEventObjects.sort((a, b) => b.date.localeCompare(a.date));
                champDate = linkedEventObjects[0].date;
            }
        }

        try {
            if (editingChampId) {
                // Update
                const champToUpdate = championships.find(c => c.id === editingChampId);
                if (champToUpdate) {
                    await updateEvent({
                        ...champToUpdate,
                        title,
                        date: champDate, // Update date
                        season: newChampYear,
                        surface: newChampSurface,
                        linkedEventIds: selectedLinkedEvents
                    });
                }
            } else {
                // Create
                await addEvent({
                    title,
                    date: champDate, // Use calculated date
                    type: 'championship_season',
                    surface: newChampSurface,
                    season: newChampYear,
                    linkedEventIds: selectedLinkedEvents,
                    participants: []
                });
            }
            setNewChampModalVisible(false);
        } catch (error) {
            showAlert("Errore", "Impossibile salvare il campionato.");
        }
    };

    const handleDelete = (event: Event) => {
        showConfirmation(
            "Elimina",
            `Sei sicuro di voler eliminare "${event.title}"?`,
            async () => {
                try {
                    await deleteEvent(event.id);
                } catch (error) {
                    showAlert("Errore", "Impossibile eliminare l'evento.");
                }
            },
            "Elimina"
        );
    };

    const handleTerminate = (event: Event) => {
        setEventToTerminate(event);
        setTerminatePlacement('');
        setTerminateAwards('');
        setTerminateModalVisible(true);
    };

    const confirmTerminate = async () => {
        if (!eventToTerminate) return;

        try {
            const awardsList = terminateAwards.split(',').map(s => s.trim()).filter(s => s.length > 0);
            await archiveEvent(eventToTerminate.id, terminatePlacement, awardsList);
            setTerminateModalVisible(false);
            setEventToTerminate(null);
        } catch (error) {
            showAlert("Errore", "Impossibile terminare l'evento.");
        }
    };

    const toggleLinkedEvent = (eventId: string) => {
        if (selectedLinkedEvents.includes(eventId)) {
            setSelectedLinkedEvents(selectedLinkedEvents.filter(id => id !== eventId));
        } else {
            setSelectedLinkedEvents([...selectedLinkedEvents, eventId]);
        }
    };

    // Calculate IDs of events already linked to OTHER championships
    const globallyLinkedEventIds = championships
        .filter(c => c.id !== editingChampId)
        .flatMap(c => c.linkedEventIds || []);

    // Filter events eligible for linking. 
    // We want to link matches (type: 'championship', 'match', 'tournament') to this championship season.
    // AND exclude events already linked to other championships.
    const availableEvents = linkableEvents.filter(e =>
        e.id !== editingChampId &&
        (e.type === 'championship' || e.type === 'match' || e.type === 'tournament') &&
        !globallyLinkedEventIds.includes(e.id)
    );

    const renderEventItem = ({ item }: { item: Event }) => (
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <TouchableOpacity style={styles.cardContent} onPress={() => handleOpenEvent(item)}>
                <View>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{item.title}</Text>
                    <Text style={[styles.cardDate, { color: theme.colors.textSecondary }]}>
                        {item.season ? `Stagione ${item.season}` : item.date}
                    </Text>
                    {item.linkedEventIds && item.linkedEventIds.length > 0 && (
                        <Text style={[styles.linkedEventsText, { color: theme.colors.primary }]}>
                            {item.linkedEventIds.length} eventi collegati
                        </Text>
                    )}
                </View>
            </TouchableOpacity>

            <View style={styles.cardActions}>
                {!isBubbaOnly && (
                    <>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: theme.colors.inputBackground, marginRight: 5 }]}
                            onPress={() => openEditModal(item)}
                        >
                            <Image source={require('../assets/pen.png')} style={{ width: 16, height: 16, tintColor: theme.colors.text }} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: theme.colors.danger, marginRight: 5 }]}
                            onPress={() => handleDelete(item)}
                        >
                            <Image source={require('../assets/cancella.png')} style={{ width: 16, height: 16, tintColor: '#fff' }} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.terminateButton, { backgroundColor: theme.colors.danger }]}
                            onPress={() => handleTerminate(item)}
                        >
                            <Text style={styles.terminateButtonText}>Termina</Text>
                        </TouchableOpacity>
                    </>
                )}
                <TouchableOpacity onPress={() => handleOpenEvent(item)} style={{ marginLeft: 10 }}>
                    <Image source={require('../assets/arrow.png')} style={[styles.arrowIcon, { tintColor: theme.colors.primary }]} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => (currentYear - 1 + i).toString());

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ScreenTitle title="ROSTER" onBack={() => navigation.goBack()} containerStyle={{ marginTop: 20 }} />

            <ScrollView style={styles.content}>
                <View style={styles.sectionHeaderContainer}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>Campionati Attivi</Text>
                    {!isBubbaOnly && (
                        <TouchableOpacity onPress={openCreateModal}>
                            <Image source={require('../assets/plus.png')} style={[styles.addIcon, { tintColor: theme.colors.primary }]} />
                        </TouchableOpacity>
                    )}
                </View>

                {championships.length > 0 ? (
                    championships.map(champ => (
                        <View key={champ.id}>
                            {renderEventItem({ item: champ })}
                        </View>
                    ))
                ) : (
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Nessun campionato attivo.</Text>
                )}

                <Text style={[styles.sectionTitle, { color: theme.colors.primary, marginTop: 30 }]}>Amichevoli</Text>
                {matches.length > 0 ? (
                    matches.map(match => (
                        <View key={match.id}>
                            {renderEventItem({ item: match })}
                        </View>
                    ))
                ) : (
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Nessuna amichevole in programma.</Text>
                )}

                <Text style={[styles.sectionTitle, { color: theme.colors.primary, marginTop: 30 }]}>Tornei</Text>
                {events.length > 0 ? (
                    events.map(event => (
                        <View key={event.id}>
                            {renderEventItem({ item: event })}
                        </View>
                    ))
                ) : (
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Nessun torneo in programma.</Text>
                )}
            </ScrollView>

            <ParticipantsModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                event={selectedEvent}
                members={members}
                readOnly={isBubbaOnly}
                allEvents={linkableEvents}
                onOpenLinkedEvent={handleOpenEvent}
                championships={championships}
            />

            {/* New/Edit Championship Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={newChampModalVisible}
                onRequestClose={() => setNewChampModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: theme.colors.card, maxHeight: '90%' }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            {editingChampId ? 'Modifica Campionato' : 'Nuovo Campionato'}
                        </Text>

                        <ScrollView style={{ width: '100%' }}>
                            <Text style={[styles.label, { color: theme.colors.text }]}>Nome (Opzionale)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                placeholder="Nome personalizzato"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={newChampName}
                                onChangeText={setNewChampName}
                            />

                            <Text style={[styles.label, { color: theme.colors.text }]}>Anno / Stagione</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8 }]}>
                                <Picker
                                    selectedValue={newChampYear}
                                    onValueChange={(itemValue) => setNewChampYear(itemValue)}
                                    style={{ color: theme.colors.text }}
                                    dropdownIconColor={theme.colors.text}
                                >
                                    {years.map((year) => (
                                        <Picker.Item key={year} label={year} value={year} color={theme.colors.text} />
                                    ))}
                                </Picker>
                            </View>

                            <Text style={[styles.label, { color: theme.colors.text }]}>Superficie</Text>
                            <View style={styles.radioContainer}>
                                <TouchableOpacity
                                    style={[styles.radioButton, newChampSurface === 'erba' && styles.radioButtonActive, { borderColor: theme.colors.primary }]}
                                    onPress={() => setNewChampSurface('erba')}
                                >
                                    <Text style={[styles.radioText, newChampSurface === 'erba' && { color: '#fff' }, { color: theme.colors.text }]}>Erba</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.radioButton, newChampSurface === 'sabbia' && styles.radioButtonActive, { borderColor: theme.colors.primary }]}
                                    onPress={() => setNewChampSurface('sabbia')}
                                >
                                    <Text style={[styles.radioText, newChampSurface === 'sabbia' && { color: '#fff' }, { color: theme.colors.text }]}>Sabbia</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.label, { color: theme.colors.text, marginTop: 15 }]}>Collega Eventi (Campionato, Amichevoli, Tornei)</Text>
                            <View style={{ height: 200, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, marginBottom: 15 }}>
                                <ScrollView nestedScrollEnabled={true} style={{ flex: 1 }}>
                                    {availableEvents.length === 0 ? (
                                        <Text style={{ padding: 10, color: theme.colors.textSecondary, textAlign: 'center' }}>Nessun evento disponibile da collegare.</Text>
                                    ) : (
                                        availableEvents.map(event => {
                                            const isSelected = selectedLinkedEvents.includes(event.id);
                                            return (
                                                <TouchableOpacity
                                                    key={event.id}
                                                    style={[
                                                        styles.linkEventItem,
                                                        { borderBottomColor: theme.colors.border },
                                                        isSelected && { backgroundColor: theme.colors.primary + '20' }
                                                    ]}
                                                    onPress={() => toggleLinkedEvent(event.id)}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={[styles.linkEventTitle, { color: theme.colors.text }]}>{event.title}</Text>
                                                            <Text style={[styles.linkEventDate, { color: theme.colors.textSecondary }]}>{event.date} - {event.type}</Text>
                                                        </View>
                                                        {isSelected && <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />}
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })
                                    )}
                                </ScrollView>
                            </View>
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setNewChampModalVisible(false)}>
                                <Text style={styles.buttonText}>Annulla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, styles.saveButton, { backgroundColor: theme.colors.primary }]} onPress={handleSaveChampionship}>
                                <Text style={styles.buttonText}>Salva</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Terminate Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={terminateModalVisible}
                onRequestClose={() => setTerminateModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Termina Evento</Text>
                        <Text style={{ color: theme.colors.textSecondary, marginBottom: 15 }}>L'evento verrà spostato nell'Albo d'Oro.</Text>

                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            placeholder="Piazzamento (es. 1° Posto)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={terminatePlacement}
                            onChangeText={setTerminatePlacement}
                        />

                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            placeholder="Premi (es. MVP, SOTG)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={terminateAwards}
                            onChangeText={setTerminateAwards}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setTerminateModalVisible(false)}>
                                <Text style={styles.buttonText}>Annulla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.danger }]} onPress={confirmTerminate}>
                                <Text style={styles.buttonText}>Termina</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        padding: 20,
    },
    sectionHeaderContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#003399',
    },
    addIcon: {
        width: 24,
        height: 24,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8f9fa',
        padding: 20,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    cardContent: {
        flex: 1,
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    cardDate: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    linkedEventsText: {
        fontSize: 12,
        marginTop: 4,
        fontWeight: 'bold',
    },
    arrowIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain'
    },
    actionButton: {
        padding: 8,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    terminateButton: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 5,
    },
    terminateButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyText: {
        color: '#999',
        fontStyle: 'italic',
        marginTop: 10,
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
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    label: {
        alignSelf: 'flex-start',
        fontWeight: 'bold',
        marginBottom: 5,
    },
    input: {
        width: '100%',
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        fontSize: 16,
    },
    radioContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        width: '100%',
        justifyContent: 'space-around',
    },
    radioButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    radioButtonActive: {
        backgroundColor: '#003399',
        borderColor: '#003399',
    },
    radioText: {
        fontSize: 16,
    },
    eventOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        borderRadius: 5,
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
    cancelButton: {
        backgroundColor: '#999',
    },
    saveButton: {
        backgroundColor: '#003399',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    linkEventItem: { padding: 12, borderBottomWidth: 1 },
    linkEventTitle: { fontSize: 14, fontWeight: 'bold' },
    linkEventDate: { fontSize: 12 },
    pickerContainer: { borderRadius: 8, overflow: 'hidden', marginBottom: 15 },
});
