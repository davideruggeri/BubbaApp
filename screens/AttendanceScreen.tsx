import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, TextInput, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
    subscribeToMembers,
    subscribeToSession,
    markPresent,
    markAbsent,
    subscribeToPresenze,
    subscribeToSeasonPresenzeCounts,
    Member,
    Session,
    addGuestToSession,
    removeGuestFromSession,
    getTrainingStats,
    TrainingStats,
    subscribeToEvents,
    Event,
    getMemberAttendance,
    assignTiedRanks,
    isMemberActiveAtDate
} from '../services/firestore';
import ScreenTitle from '../components/ScreenTitle';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSeason } from '../context/SeasonContext';
import { isChristmasPeriod } from '../utils/date';
import { showAlert, showConfirmation } from '../utils/alert';

type ViewMode = 'Campo' | 'Palestra';

export default function AttendanceScreen() {
    const navigation = useNavigation<any>();
    const { userProfile, isBubbaOnly } = useAuth();
    const { stagioneCorrente } = useSeason();

    const { theme, isChristmasEnabled } = useTheme();
    const isChristmas = isChristmasPeriod() && isChristmasEnabled;
    const [members, setMembers] = useState<Member[]>([]);
    const [session, setSession] = useState<Session | null>(null);
    const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState<string>('');
    const [stats, setStats] = useState<TrainingStats | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('Campo');
    const [expandedSections, setExpandedSections] = useState({ men: true, women: true });

    const [allEvents, setAllEvents] = useState<Event[]>([]);
    const [availableDates, setAvailableDates] = useState<string[]>([]);

    // History Modal State
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [selectedMemberHistory, setSelectedMemberHistory] = useState<{ member: Member, history: { date: string, present: boolean, type: string }[], currentStreak: number, maxStreak: number } | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Conteggi presenze stagione corrente separati per Campo e Palestra (calcolati in real-time)
    const [seasonCountsCampo, setSeasonCountsCampo] = useState<Record<string, number>>({});
    const [seasonCountsPalestra, setSeasonCountsPalestra] = useState<Record<string, number>>({});
    const seasonCounts = viewMode === 'Campo' ? seasonCountsCampo : seasonCountsPalestra;

    // Ranking Modal State
    const [rankingModalVisible, setRankingModalVisible] = useState(false);
    const [rankingMode, setRankingMode] = useState<ViewMode>('Campo');

    // Helper to format date as YYYY-MM-DD
    const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0];
    };

    // 1. Subscribe to Events (Calendar) for current season
    useEffect(() => {
        const unsubscribeEvents = subscribeToEvents((events) => {
            setAllEvents(events);
        }, stagioneCorrente);
        return () => unsubscribeEvents();
    }, [stagioneCorrente]);

    // 2. Main Logic: Auto-Select correct ViewMode and Date
    // We combine this into a single function to run on Events change OR Focus
    const lastAutoDateRef = useRef<string | null>(null);

    // 2. Auto-Navigation Logic (Runs on Focus and Mount)
    // ONLY runs if we haven't handled this "day" yet (or if fresh app load)
    const checkAutoNavigation = useCallback(() => {
        if (allEvents.length === 0) return;
        const today = new Date().toISOString().split('T')[0];

        // If we already performed auto-nav for THIS day, skip.
        // This allows the user to navigate manually within the same session/day without reset.
        if (lastAutoDateRef.current === today) {
            return;
        }

        // A. Filter all training events (Global)
        const allTrainings = allEvents.filter(e =>
            e.type === 'Campo' || e.type === 'Palestra' || e.type === 'training'
        );
        allTrainings.sort((a, b) => a.date.localeCompare(b.date));

        // B. Find "Next" Event (Global)
        const nextEvent = allTrainings.find(e => e.date >= today) || allTrainings[allTrainings.length - 1];

        if (!nextEvent) return;

        const targetMode: ViewMode = nextEvent.type === 'Palestra' ? 'Palestra' : 'Campo';

        // C. Calculate Available Dates for this Target Mode
        const filteredEvents = allEvents.filter(event => {
            const isTraining = event.type === 'Campo' || event.type === 'Palestra' || event.type === 'training';
            if (!isTraining) return false;
            return targetMode === 'Campo'
                ? (event.type === 'Campo' || event.type === 'training')
                : (event.type === 'Palestra');
        });
        const dates = Array.from(new Set(filteredEvents.map(e => e.date))).sort();

        // D. Determine Target Date (Best match >= today)
        let targetDate = '';
        if (dates.length > 0) {
            targetDate = dates.find(d => d >= today) || dates[dates.length - 1];
        }

        // E. Apply Updates (Force reset)
        // We set these directly to ensure atomic update from user perspective
        setViewMode(targetMode);
        setAvailableDates(dates);
        if (targetDate) setCurrentDate(targetDate);

        // F. Mark today as handled
        lastAutoDateRef.current = today;

    }, [allEvents]);

    // 3. React to ViewMode changes (Manual switching)
    // Ensures availableDates and currentDate are valid when user toggles mode manually
    useEffect(() => {
        if (allEvents.length === 0) return;

        // Filter dates for CURRENT viewMode
        const filteredEvents = allEvents.filter(event => {
            const isTraining = event.type === 'Campo' || event.type === 'Palestra' || event.type === 'training';
            if (!isTraining) return false;
            return viewMode === 'Campo'
                ? (event.type === 'Campo' || event.type === 'training')
                : (event.type === 'Palestra');
        });

        const dates = Array.from(new Set(filteredEvents.map(e => e.date))).sort();
        setAvailableDates(dates);

        // Logic to maintain or reset Current Date
        if (dates.length > 0) {
            if (!currentDate || !dates.includes(currentDate)) {
                const today = new Date().toISOString().split('T')[0];
                const bestDate = dates.find(d => d >= today) || dates[dates.length - 1];
                setCurrentDate(bestDate);
            }
        } else {
            setCurrentDate('');
            setSession(null);
        }

    }, [viewMode, allEvents]);

    // 3b. Sottoscrizione alle presenze reali della stagione corrente per Campo e Palestra disgiunti
    useEffect(() => {
        if (allEvents.length === 0 || !stagioneCorrente) return;

        const today = new Date().toISOString().split('T')[0];

        const pastCampoEvents = allEvents.filter(event => {
            if (event.date > today) return false;
            return event.type === 'Campo' || event.type === 'training' || !event.type;
        });
        const validCampoDates = new Set(pastCampoEvents.map(e => e.date));

        const pastPalestraEvents = allEvents.filter(event => {
            if (event.date > today) return false;
            return event.type === 'Palestra';
        });
        const validPalestraDates = new Set(pastPalestraEvents.map(e => e.date));

        const unsubCampo = subscribeToSeasonPresenzeCounts(
            stagioneCorrente,
            'Campo',
            validCampoDates,
            setSeasonCountsCampo
        );

        const unsubPalestra = subscribeToSeasonPresenzeCounts(
            stagioneCorrente,
            'Palestra',
            validPalestraDates,
            setSeasonCountsPalestra
        );

        return () => {
            unsubCampo();
            unsubPalestra();
        };
    }, [allEvents, stagioneCorrente]);

    // Run Auto-Nav on Mount/Events Change
    useEffect(() => {
        checkAutoNavigation();
    }, [allEvents, checkAutoNavigation]);

    // Run Auto-Nav on Focus
    useFocusEffect(
        useCallback(() => {
            checkAutoNavigation();
        }, [checkAutoNavigation])
    );


    // Update stats when viewMode or season changes
    useEffect(() => {
        getTrainingStats('', viewMode, stagioneCorrente).then(setStats);
    }, [viewMode, stagioneCorrente]);

    useEffect(() => {
        if (!currentDate) {
            setSession(null);
            setAttendeeIds([]);
            return;
        }

        // 1. Subscribe to Members (include inactive)
        const unsubscribeMembers = subscribeToMembers((updatedMembers) => {
            setMembers(updatedMembers);
        }, true);

        // 2. Subscribe to Session Updates (No more getOrCreate)
        const unsubscribeSession = subscribeToSession(currentDate, (updatedSession) => {
            setSession(updatedSession);
            setLoading(false);
        });

        // 3. Subscribe to Presenze
        const unsubscribePresenze = subscribeToPresenze(currentDate, (ids) => {
            setAttendeeIds(ids);
        });

        return () => {
            unsubscribeMembers();
            unsubscribeSession();
            unsubscribePresenze();
        };
    }, [currentDate]);

    const goToPreviousSession = () => {
        if (availableDates.length === 0) return;
        const currentIndex = availableDates.indexOf(currentDate);
        if (currentIndex > 0) {
            setCurrentDate(availableDates[currentIndex - 1]);
        }
    };

    const goToNextSession = () => {
        if (availableDates.length === 0) return;
        const currentIndex = availableDates.indexOf(currentDate);
        if (currentIndex !== -1 && currentIndex < availableDates.length - 1) {
            setCurrentDate(availableDates[currentIndex + 1]);
        }
    };

    const togglePresence = async (memberId: string, isPresent: boolean) => {
        const targetDate = session?.id || currentDate;
        if (!targetDate) return;
        try {
            if (isPresent) {
                await markAbsent(targetDate, memberId, viewMode);
            } else {
                await markPresent(targetDate, memberId, viewMode, stagioneCorrente);
            }
            // Update stats after marking presence
            getTrainingStats('', viewMode, stagioneCorrente).then(setStats);
        } catch (error: any) {
            console.error("Error toggling presence:", error);
            showAlert("Errore", "Impossibile aggiornare la presenza: " + (error?.message || ""));
        }
    };

    const [newGuestName, setNewGuestName] = useState('');
    const [guestModalVisible, setGuestModalVisible] = useState(false);

    const handleAddGuest = async () => {
        const targetDate = session?.id || currentDate;
        if (!targetDate || !newGuestName.trim()) return;
        try {
            await addGuestToSession(targetDate, newGuestName.trim());
            setNewGuestName('');
            setGuestModalVisible(false);
        } catch (error: any) {
            showAlert("Errore", "Impossibile aggiungere l'ospite: " + (error?.message || ""));
        }
    };

    const handleRemoveGuest = async (guestName: string) => {
        const targetDate = session?.id || currentDate;
        if (!targetDate) return;
        showConfirmation(
            "Rimuovi Ospite",
            `Vuoi rimuovere ${guestName}?`,
            async () => {
                try {
                    await removeGuestFromSession(targetDate, guestName);
                } catch (error: any) {
                    showAlert("Errore", "Impossibile rimuovere l'ospite: " + (error?.message || ""));
                }
            },
            "Rimuovi"
        );
    };

    const toggleSection = (section: 'men' | 'women') => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleOpenHistory = async (member: Member) => {
        setLoadingHistory(true);
        setHistoryModalVisible(true);
        try {
            const attendedDates = await getMemberAttendance(member.id);
            const today = new Date().toISOString().split('T')[0];

            // 1. Get all PAST training events matching current ViewMode
            const pastEvents = allEvents.filter(e => {
                if (e.date >= today) return false;

                if (viewMode === 'Campo') {
                    return e.type === 'Campo' || e.type === 'training';
                } else {
                    return e.type === 'Palestra';
                }
            });

            // 2. Map to history object
            const history = pastEvents.map(event => ({
                date: event.date,
                present: attendedDates.includes(event.date),
                type: event.type
            }));

            // 3. Sort descending (newest first)
            history.sort((a, b) => b.date.localeCompare(a.date));

            // 4. Calculate Streaks
            let currentStreak = 0;
            let maxStreak = 0;
            let tempStreak = 0;

            // Sort ascending for streak calculation
            const ascendingHistory = [...history].reverse();

            for (const session of ascendingHistory) {
                if (session.present) {
                    tempStreak++;
                    maxStreak = Math.max(maxStreak, tempStreak);
                } else {
                    tempStreak = 0;
                }
            }

            // Current streak is tricky because it depends on the *latest* consecutive sessions.
            // We can iterate backwards from the most recent.
            for (const session of history) {
                if (session.present) {
                    currentStreak++;
                } else {
                    break;
                }
            }

            setSelectedMemberHistory({ member, history, currentStreak, maxStreak });
        } catch (error) {
            showAlert("Errore", "Impossibile recuperare lo storico presenze.");
        } finally {
            setLoadingHistory(false);
        }
    };

    const renderMemberItem = ({ item }: { item: Member }) => {
        const isPresent = attendeeIds.includes(item.id);
        return (
            <TouchableOpacity
                style={[
                    styles.personCard,
                    { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                    isPresent && { borderColor: theme.colors.success, borderWidth: 2 }
                ]}
                onPress={() => !isBubbaOnly && togglePresence(item.id, isPresent)}
                onLongPress={() => handleOpenHistory(item)}
                delayLongPress={500}
                activeOpacity={0.7}
            >
                <View style={{ flex: 1 }}>
                    <Text style={[styles.personName, { color: theme.colors.text }, isPresent && { color: theme.colors.success }]}>
                        {item.nickname ? item.nickname : `${item.firstName} ${item.lastName}`}
                        {item.jerseyNumber ? <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}> #{item.jerseyNumber}</Text> : ''}
                    </Text>
                    <Text style={[styles.attendanceCount, { color: theme.colors.textSecondary }]}>
                        {viewMode === 'Campo' ? '🥏' : '🏋️'} {seasonCounts[item.id] || 0} pres. {viewMode}
                    </Text>
                </View>

                {/* Visual indicator for presence (checkbox style) */}
                <View
                    style={[styles.checkbox, { borderColor: theme.colors.border }, isPresent && { backgroundColor: theme.colors.success, borderColor: theme.colors.success }]}
                >
                    {isPresent && <Text style={styles.checkmark}>✓</Text>}
                </View>
            </TouchableOpacity>
        );
    };

    const filteredMembers = members.filter(m => {
        // 1. Always show if they are marked present (just in case)
        if (attendeeIds.includes(m.id)) return true;

        // 2. Verifica se il membro era attivo/disponibile per questa data
        return isMemberActiveAtDate(m, currentDate);
    });

    const men = filteredMembers.filter(m => m.gender === 'M');
    const women = filteredMembers.filter(m => m.gender === 'F');

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => {
                        setRankingMode(viewMode); // Sync with current view
                        setRankingModalVisible(true);
                    }} style={styles.rankingButton}>
                        <Image source={require('../assets/trophy.png')} style={[styles.iconImage, { tintColor: theme.colors.text }]} />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <ScreenTitle title="PRESENZE" style={{ marginBottom: 2 }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary, letterSpacing: 0.5 }}>
                            {stagioneCorrente}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('League')} style={styles.winterButton}>
                        <Image source={require('../assets/winter.png')} style={[styles.iconImage, { tintColor: theme.colors.text }]} />
                    </TouchableOpacity>
                </View>

                {/* Mode Toggle */}
                <View style={[styles.modeToggleContainer, { backgroundColor: theme.colors.inputBackground }]}>
                    <TouchableOpacity
                        style={[styles.modeButton, viewMode === 'Campo' && styles.modeButtonActive, viewMode === 'Campo' && { backgroundColor: theme.colors.card }]}
                        onPress={() => setViewMode('Campo')}
                    >
                        <Text style={[styles.modeButtonText, viewMode === 'Campo' && styles.modeButtonTextActive, { color: viewMode === 'Campo' ? '#003399' : theme.colors.textSecondary }]}>🥏 Campo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeButton, viewMode === 'Palestra' && styles.modeButtonActive, viewMode === 'Palestra' && { backgroundColor: theme.colors.card }]}
                        onPress={() => setViewMode('Palestra')}
                    >
                        <Text style={[styles.modeButtonText, viewMode === 'Palestra' && styles.modeButtonTextActive, { color: viewMode === 'Palestra' ? '#003399' : theme.colors.textSecondary }]}>🏋️ Palestra</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.dateControl}>
                    <TouchableOpacity onPress={goToPreviousSession} style={styles.arrowButton}>
                        <Text style={[styles.arrowText, { color: theme.colors.primary }]}>{'<'}</Text>
                    </TouchableOpacity>

                    <View style={{ alignItems: 'center' }}>
                        <Text style={[styles.date, { color: theme.colors.text }]}>
                            {currentDate ? new Date(currentDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Caricamento...'}
                        </Text>
                        {currentDate && (
                            <Text style={[styles.attendeeCountText, { color: theme.colors.primary }]}>
                                Presenti: {attendeeIds.length + (session?.guests?.length || 0)}
                            </Text>
                        )}
                    </View>

                    <TouchableOpacity onPress={goToNextSession} style={styles.arrowButton}>
                        <Text style={[styles.arrowText, { color: theme.colors.primary }]}>{'>'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>

                {/* Statistics Section */}
                {stats && (
                    <View style={styles.statsContainer}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.statsScroll}
                            contentContainerStyle={{ paddingHorizontal: 5, paddingBottom: 10 }}
                        >
                            <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
                                <Text style={[styles.statValue, { color: theme.colors.primary }]}>{stats.averageAttendance}</Text>
                                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Media Presenze</Text>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
                                <Text style={[styles.statValue, { color: theme.colors.primary }]}>{stats.totalTrainings}</Text>
                                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Allenamenti</Text>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
                                <View style={styles.statRow}>
                                    <Image source={require('../assets/crown.png')} style={styles.crownIcon} />
                                    <Text style={[styles.statValue, { color: theme.colors.primary }]}>{stats.recordAttendance?.count || 0}</Text>
                                </View>
                                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                                    {stats.recordAttendance?.date
                                        ? new Date(stats.recordAttendance.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
                                        : '-'}
                                </Text>
                            </View>
                        </ScrollView>
                    </View>
                )}

                {/* Empty State Message */}
                {!currentDate && (
                    <View style={styles.emptyStateContainer}>
                        <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                            {viewMode === 'Palestra'
                                ? "Non sono programmati allenamenti in palestra."
                                : "Non sono programmati allenamenti al campo."}
                        </Text>
                    </View>
                )}

                {currentDate && women.length > 0 && (
                    <>
                        <TouchableOpacity onPress={() => toggleSection('women')} style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Donne ({women.filter(m => attendeeIds.includes(m.id)).length}/{women.length})</Text>
                            <Text style={[styles.sectionArrow, { color: theme.colors.textSecondary }]}>{expandedSections.women ? '▼' : '▶'}</Text>
                        </TouchableOpacity>
                        {expandedSections.women && women.map(member => (
                            <View key={member.id}>
                                {renderMemberItem({ item: member })}
                            </View>
                        ))}
                    </>
                )}

                {currentDate && men.length > 0 && (
                    <>
                        <TouchableOpacity onPress={() => toggleSection('men')} style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Uomini ({men.filter(m => attendeeIds.includes(m.id)).length}/{men.length})</Text>
                            <Text style={[styles.sectionArrow, { color: theme.colors.textSecondary }]}>{expandedSections.men ? '▼' : '▶'}</Text>
                        </TouchableOpacity>
                        {expandedSections.men && men.map(member => (
                            <View key={member.id}>
                                {renderMemberItem({ item: member })}
                            </View>
                        ))}
                    </>
                )}

                {/* Guests Section */}
                {currentDate && (
                    <>
                        <View style={styles.guestsHeader}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                Ospiti ({session?.guests?.length || 0})
                            </Text>
                            {!isBubbaOnly && (
                                <TouchableOpacity
                                    style={styles.addGuestButton}
                                    onPress={() => setGuestModalVisible(true)}
                                >
                                    <Text style={styles.addGuestButtonText}>+ Aggiungi</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {session?.guests && session.guests.length > 0 ? (
                            session.guests.map((guest, index) => (
                                <TouchableOpacity
                                    key={`guest-${index}`}
                                    style={[styles.guestCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.warning, borderWidth: 1 }]}
                                    onPress={() => !isBubbaOnly && handleRemoveGuest(guest)}
                                    activeOpacity={isBubbaOnly ? 1 : 0.7}
                                >
                                    <View>
                                        <Text style={[styles.guestName, { color: theme.colors.text }]}>{guest}</Text>
                                        <Text style={[styles.guestLabel, { color: theme.colors.warning }]}>Ospite</Text>
                                    </View>
                                    <View style={[styles.guestRemoveIcon, { backgroundColor: theme.colors.inputBackground }]}>
                                        <Text style={[styles.guestRemoveText, { color: theme.colors.danger }]}>✕</Text>
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={[styles.noGuestsText, { color: theme.colors.textSecondary }]}>Nessun ospite aggiunto.</Text>
                        )}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Add Guest Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={guestModalVisible}
                onRequestClose={() => setGuestModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Aggiungi Ospite</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            placeholder="Nome Ospite"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newGuestName}
                            onChangeText={setNewGuestName}
                            autoFocus={true}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.inputBackground }]}
                                onPress={() => setGuestModalVisible(false)}
                            >
                                <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.saveButton]}
                                onPress={handleAddGuest}
                            >
                                <Text style={styles.buttonText}>Aggiungi</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* History Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={historyModalVisible}
                onRequestClose={() => setHistoryModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { height: '70%', backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            Storico Presenze
                        </Text>
                        <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                            {selectedMemberHistory?.member.nickname || selectedMemberHistory?.member.firstName}
                        </Text>

                        {/* Streak Stats */}
                        {!loadingHistory && selectedMemberHistory && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 15, marginTop: 10 }}>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.colors.primary }}>{selectedMemberHistory.currentStreak}</Text>
                                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Streak Attuale</Text>
                                </View>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.colors.warning }}>{selectedMemberHistory.maxStreak}</Text>
                                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Max Streak</Text>
                                </View>
                            </View>
                        )}

                        {loadingHistory ? (
                            <Text>Caricamento...</Text>
                        ) : (
                            <FlatList
                                data={selectedMemberHistory?.history}
                                keyExtractor={(item) => item.date}
                                renderItem={({ item }) => (
                                    <View style={[styles.historyRow, { borderBottomColor: theme.colors.border, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Text style={{
                                            fontSize: 18,
                                            fontWeight: '600',
                                            color: item.present ? theme.colors.success : theme.colors.danger,
                                            textAlign: 'center'
                                        }}>
                                            {new Date(item.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </Text>
                                    </View>
                                )}
                                style={{ width: '100%', marginTop: 10 }}
                                ListEmptyComponent={<Text style={{ fontStyle: 'italic', textAlign: 'center', marginTop: 20, color: theme.colors.textSecondary }}>Nessun allenamento passato trovato.</Text>}
                            />
                        )}

                        <TouchableOpacity
                            style={[styles.fullWidthButton, { backgroundColor: theme.colors.inputBackground }]}
                            onPress={() => setHistoryModalVisible(false)}
                        >
                            <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Ranking Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={rankingModalVisible}
                onRequestClose={() => setRankingModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { height: '80%', backgroundColor: theme.colors.card, width: '90%', maxWidth: 600 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 }}>
                            <View style={{ width: 24 }} />
                            <Text style={[styles.modalTitle, { margin: 0, color: theme.colors.text }]}>Classifica {rankingMode}</Text>
                            <TouchableOpacity onPress={() => setRankingModalVisible(false)} >
                                <Image source={require('../assets/x.png')} style={{ width: 24, height: 24 }} />
                            </TouchableOpacity>
                        </View>

                        {/* Mode Toggle inside Modal */}
                        <View style={[styles.modeToggleContainer, { backgroundColor: theme.colors.inputBackground, marginBottom: 20 }]}>
                            <TouchableOpacity
                                style={[styles.modeButton, rankingMode === 'Campo' && styles.modeButtonActive, rankingMode === 'Campo' && { backgroundColor: theme.colors.card }]}
                                onPress={() => setRankingMode('Campo')}
                            >
                                <Text style={[styles.modeButtonText, rankingMode === 'Campo' && styles.modeButtonTextActive, { color: rankingMode === 'Campo' ? '#003399' : theme.colors.textSecondary }]}>Campo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modeButton, rankingMode === 'Palestra' && styles.modeButtonActive, rankingMode === 'Palestra' && { backgroundColor: theme.colors.card }]}
                                onPress={() => setRankingMode('Palestra')}
                            >
                                <Text style={[styles.modeButtonText, rankingMode === 'Palestra' && styles.modeButtonTextActive, { color: rankingMode === 'Palestra' ? '#003399' : theme.colors.textSecondary }]}>Palestra</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 20 }}>
                            {(() => {
                                // Funzione di conteggio disgiunto Campo vs Palestra
                                const getRankingCount = (m: Member) => {
                                    if (rankingMode === 'Palestra') {
                                        return seasonCountsPalestra[m.id] !== undefined
                                            ? seasonCountsPalestra[m.id]
                                            : (m.attendanceCountGym || 0);
                                    } else {
                                        return seasonCountsCampo[m.id] !== undefined
                                            ? seasonCountsCampo[m.id]
                                            : (m.attendanceCount || 0);
                                    }
                                };

                                // Calculate standings inside render strictly for rankingMode
                                const relevantMembers = members.filter(m => getRankingCount(m) > 0);
                                const sortedMembers = relevantMembers.sort((a, b) => {
                                    const countA = getRankingCount(a);
                                    const countB = getRankingCount(b);
                                    if (countB !== countA) return countB - countA;
                                    return (a.nickname || a.firstName).localeCompare(b.nickname || b.firstName);
                                });

                                const rankedMembers = assignTiedRanks(sortedMembers, m => getRankingCount(m));

                                const top3 = rankedMembers.slice(0, 3);
                                const rest = rankedMembers.slice(3);

                                // Visual Podium Data (top 3)
                                const visualPodium = [];
                                if (top3.length > 1) visualPodium.push(top3[1]); // 2nd or tied 1st
                                if (top3.length > 0) visualPodium.push(top3[0]); // 1st
                                if (top3.length > 2) visualPodium.push(top3[2]); // 3rd or tied 2nd/1st

                                return (
                                    <>
                                        {/* Podium */}
                                        {visualPodium.length > 0 && (
                                            <View style={styles.podiumContainer}>
                                                {visualPodium.map((member) => {
                                                    const count = getRankingCount(member);
                                                    let height = 100;
                                                    let color = '#FFD700'; // Gold

                                                    if (member.rank === 1) {
                                                        height = 140;
                                                        color = '#FFD700';
                                                    } else if (member.rank === 2) {
                                                        height = 100;
                                                        color = '#C0C0C0'; // Silver
                                                    } else {
                                                        height = 70;
                                                        color = '#CD7F32'; // Bronze
                                                    }

                                                    return (
                                                        <View key={member.id} style={styles.podiumPlace}>
                                                            <Text style={[styles.podiumName, { color: theme.colors.text }]} numberOfLines={1}>
                                                                {member.nickname || member.firstName}
                                                            </Text>
                                                            <View style={[styles.podiumBar, { height, backgroundColor: color }]}>
                                                                <Text style={styles.podiumRank}>{member.rank}</Text>
                                                                <Text style={styles.podiumPoints}>{count}</Text>
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        )}

                                        {/* Rest of the list */}
                                        <View style={styles.rankingList}>
                                            {rest.map((member) => {
                                                const count = getRankingCount(member);
                                                return (
                                                    <View key={member.id} style={[styles.rankingRow, { borderBottomColor: theme.colors.border }]}>
                                                        <Text style={[styles.rankingRank, { color: theme.colors.textSecondary }]}>
                                                            {member.badge ? `${member.badge} ` : ''}{member.rank}
                                                        </Text>
                                                        <Text style={[styles.rankingName, { color: theme.colors.text }]}>
                                                            {member.nickname || member.firstName}
                                                        </Text>
                                                        <Text style={[styles.rankingCount, { color: theme.colors.primary }]}>{count}</Text>
                                                    </View>
                                                );
                                            })}
                                        </View>

                                        {sortedMembers.length === 0 && (
                                            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 20 }]}>
                                                Nessuna presenza registrata.
                                            </Text>
                                        )}
                                    </>
                                );
                            })()}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.fullWidthButton, { backgroundColor: theme.colors.inputBackground, marginTop: 10 }]}
                            onPress={() => setRankingModalVisible(false)}
                        >
                            <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modeToggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
        padding: 4,
        marginBottom: 15,
        width: '100%',
    },
    modeButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 16,
    },
    modeButtonActive: {
        backgroundColor: '#fff',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    modeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
    },
    modeButtonTextActive: {
        color: '#003399',
        fontWeight: 'bold',
    },
    title: {
        // fontSize: 28,
        // fontFamily: 'NBAMilwaukeeBucks',
        // color: '#003399',
        // marginBottom: 10,
    },
    dateControl: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 10,
    },
    headerTop: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        marginBottom: 10,
    },
    rankingButton: {
        position: 'absolute',
        left: 0,
        top: 0,
        padding: 5,
        zIndex: 10,
    },
    winterButton: {
        position: 'absolute',
        right: 0,
        top: 0,
        padding: 5,
        zIndex: 10,
    },
    iconImage: {
        width: 28,
        height: 28,
        resizeMode: 'contain',
    },
    arrowButton: {
        padding: 10,
    },
    arrowText: {
        fontSize: 24,
        color: '#003399',
        fontWeight: 'bold',
    },
    date: {
        fontSize: 16,
        color: '#333',
        textTransform: 'capitalize',
        fontWeight: '600',
    },
    attendeeCountText: {
        fontSize: 14,
        color: '#003399',
        fontWeight: 'bold',
        marginTop: 2,
    },
    typeToggle: {
        backgroundColor: '#e3f2fd',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        alignItems: 'center',
    },
    typeText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#003399',
    },
    typeSubtext: {
        fontSize: 10,
        color: '#666',
        marginTop: 2,
    },
    scrollContainer: {
        padding: 20,
    },
    statsContainer: {
        marginBottom: 15,
    },
    statsScroll: {
        marginHorizontal: -5,
    },
    statCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 15,
        marginRight: 12,
        minWidth: 110,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#003399',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        color: '#666',
        fontWeight: '500',
        textAlign: 'center',
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    crownIcon: {
        width: 20,
        height: 20,
        marginRight: 6,
        resizeMode: 'contain',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 10,
        paddingRight: 10,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginLeft: 5,
    },
    sectionArrow: {
        fontSize: 18,
        color: '#666',
    },
    personCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#eee',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    personCardPresent: {
        backgroundColor: '#e8f5e9',
        borderColor: '#c8e6c9',
    },
    personName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    personNamePresent: {
        color: '#2e7d32',
    },
    attendanceCount: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#ccc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#4caf50',
        borderColor: '#4caf50',
    },
    checkmark: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    guestsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 10,
        paddingRight: 5,
    },
    addGuestButton: {
        backgroundColor: '#e3f2fd',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    addGuestButtonText: {
        color: '#003399',
        fontWeight: 'bold',
        fontSize: 12,
    },
    guestCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff3e0', // Light Orange/Yellow for guests
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#ffe0b2',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    guestName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#e65100',
    },
    guestLabel: {
        fontSize: 12,
        color: '#ef6c00',
        marginTop: 2,
        fontStyle: 'italic',
    },
    guestRemoveIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    guestRemoveText: {
        color: '#e65100',
        fontWeight: 'bold',
        fontSize: 16,
    },
    noGuestsText: {
        fontStyle: 'italic',
        color: '#999',
        marginLeft: 5,
        marginBottom: 20,
    },
    centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        width: '80%',
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
        color: '#333',
    },
    input: {
        width: '100%',
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        padding: 15,
        marginBottom: 20,
        fontSize: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    button: {
        flex: 1,
        padding: 12,
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
    emptyStateContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyStateText: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    modalSubtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 15,
        fontWeight: '600',
    },
    historyRow: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        width: '100%',
    },
    historyDate: {
        fontSize: 16,
        color: '#333',
        textTransform: 'capitalize',
    },
    fullWidthButton: {
        backgroundColor: '#999',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 20,
        width: '100%',
    },
    // Podium Styles
    podiumContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        marginVertical: 20,
        height: 180,
        paddingHorizontal: 10,
    },
    podiumPlace: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        flex: 1,
        marginHorizontal: 2,
    },
    podiumBar: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        padding: 5,
    },
    podiumRank: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 24,
    },
    podiumName: {
        fontWeight: 'bold',
        marginBottom: 5,
        textAlign: 'center',
        fontSize: 12,
    },
    podiumPoints: {
        fontSize: 14,
        color: '#fff',
        marginTop: 2,
        fontWeight: '600',
    },
    rankingList: {
        marginTop: 10,
    },
    rankingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    rankingRank: {
        width: 30,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    rankingName: {
        flex: 1,
        fontSize: 16,
    },
    rankingCount: {
        fontWeight: 'bold',
        fontSize: 16,
    },
});
