import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Modal, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ScreenTitle from '../components/ScreenTitle';
import DatePickerModal from '../components/DatePickerModal';
import {
    subscribeToLeagueDates,
    updateLeagueDates,
    subscribeToMembers,
    subscribeToLeagueBonuses,
    addLeagueBonus,
    deleteLeagueBonus,
    subscribeToLeagueAttendance,
    subscribeToPresenze,
    subscribeToEvents,
    subscribeToRoster,
    subscribeToLeagueRules,
    saveLeagueRules,
    subscribeToBonusDefinitions,
    saveBonusDefinitions,
    type LeagueDates,
    type Member,
    type LeagueBonus,
    type Event as FirestoreEvent,
    type RosterMember,
    type LeagueRule,
    type BonusDefinition,
    subscribeToPastLeagues,
    type PastLeague,
    checkIfLeagueArchived,
    archiveLeague,
    archiveAndResetLeague,
    resetLeagueData,
    type PastLeagueMember
} from '../services/firestore';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isChristmasPeriod } from '../utils/date';
import { showAlert, showConfirmation } from '../utils/alert';

type LeagueType = 'winter' | 'summer';
type Tab = 'standings' | 'bonus' | 'rules' | 'bonusList';



const DEFAULT_BONUS_OPTIONS = [
    { label: "Presente 1° giorno Winter Hat", points: 2 },
    { label: "Allenamento ≤ 8 persone", points: 1 },
    { label: "Invitare amici", points: 4 },
    { label: "Meteo disagiante", points: 2 },
    { label: "Torneo con i Bubba", points: 2 },
    { label: "Torneo/Evento frisbee", points: 1 },
    { label: "Prestare divise", points: 1 },
    { label: "Callahan", points: 2 },
    { label: "Handblock", points: 1 },
    { label: "Footblock", points: 2 },
    { label: "Scorpionblock", points: 3 },
    { label: "Headblock", points: 4 },
    { label: "Layout buono", points: 1 },
    { label: "Intercetto in layout", points: 2 },
    { label: "Meta in layout", points: 3 },
    { label: "Callahan in layout", points: 4 },
    { label: "Ultima meta (Assist/Goal)", points: 1 },
    { label: "Meta in hammer", points: 1 },
    { label: "Meta in scober", points: 2 },
    { label: "Meta in tamber", points: 3 },
    { label: "Greatest", points: 4 },
    { label: "Assist mano NON dominante", points: 1 },
    { label: "Vincere flip casacche", points: 1 },
    { label: "Lavare casacche", points: 2 },
];

const DEFAULT_MALUS_OPTIONS = [
    { label: "Pacco (Presente -> Assente)", points: -2 },
    { label: "Berna", points: -2 },
    { label: "Rompere un disco", points: -2 },
    { label: "Ritardo", points: -1 },
    { label: "Meta/Lancio hammer", points: -1 },
    { label: "Meta/Lancio scober", points: -2 },
    { label: "Meta/Lancio tamber", points: -3 },
    { label: "Mancata presa volontaria", points: -2 },
    { label: "Pull fuori campo", points: -2 },
    { label: "Perdere flip casacche", points: -1 },
];

export default function LeagueScreen() {
    const navigation = useNavigation<any>();
    const { userProfile, isBubbaOnly } = useAuth();

    const { theme, isChristmasEnabled } = useTheme();
    const isChristmas = isChristmasPeriod() && isChristmasEnabled;

    const [leagueType, setLeagueType] = useState<LeagueType>('winter');
    const [activeTab, setActiveTab] = useState<Tab>('standings');
    const [members, setMembers] = useState<Member[]>([]);
    const [bonuses, setBonuses] = useState<LeagueBonus[]>([]);
    const [leagueDates, setLeagueDates] = useState<LeagueDates | null>(null);
    const [events, setEvents] = useState<FirestoreEvent[]>([]);
    const [attendanceData, setAttendanceData] = useState<{ memberId: string, date: string }[]>([]);

    // Daily View State
    const [currentEventIndex, setCurrentEventIndex] = useState<number>(-1);
    const [sortedEvents, setSortedEvents] = useState<FirestoreEvent[]>([]);
    const [isLeagueArchived, setIsLeagueArchived] = useState(false);

    // Derived state for current view
    const currentEvent = currentEventIndex >= 0 && currentEventIndex < sortedEvents.length ? sortedEvents[currentEventIndex] : null;
    const bonusDate = currentEvent ? currentEvent.date : new Date().toISOString().split('T')[0];

    const [dailyAttendees, setDailyAttendees] = useState<string[]>([]);
    const [rosterMembers, setRosterMembers] = useState<RosterMember[]>([]);

    const [rules, setRules] = useState<LeagueRule[]>([]);
    const [bonusDefinitions, setBonusDefinitions] = useState<BonusDefinition[]>([]);
    const [settingsTab, setSettingsTab] = useState<'dates' | 'rules' | 'bonus'>('dates'); // Settings Modal Tabs

    const [localRules, setLocalRules] = useState<LeagueRule[]>([]);
    const [localBonusDefinitions, setLocalBonusDefinitions] = useState<BonusDefinition[]>([]);

    // Modals
    const [bonusModalVisible, setBonusModalVisible] = useState(false);
    const [bonusTypeTab, setBonusTypeTab] = useState<'bonus' | 'malus' | 'custom'>('bonus'); // New state for modal tab
    const [datesModalVisible, setDatesModalVisible] = useState(false);

    useEffect(() => {
        if (datesModalVisible) {
            setLocalRules(JSON.parse(JSON.stringify(rules)));
            setLocalBonusDefinitions(JSON.parse(JSON.stringify(bonusDefinitions)));
        }
    }, [datesModalVisible]);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [showBonusDatePicker, setShowBonusDatePicker] = useState(false);

    // Form Data
    const [newBonus, setNewBonus] = useState<{ memberId: string, points: string, reason: string, date: string }>({
        memberId: '', points: '', reason: '', date: new Date().toISOString().split('T')[0]
    });
    const [datesInput, setDatesInput] = useState({ startDate: '', endDate: '' });
    const [newRule, setNewRule] = useState({ title: '', description: '' });
    const [newBonusDef, setNewBonusDef] = useState({ label: '', points: '', type: 'bonus' as 'bonus' | 'malus' });

    // Editing state
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [editingRuleData, setEditingRuleData] = useState({ title: '', description: '' });
    const [editingBonusId, setEditingBonusId] = useState<string | null>(null);
    const [editingBonusData, setEditingBonusData] = useState({ label: '', points: '' });

    const [showAddRule, setShowAddRule] = useState(false);
    const [showAddBonus, setShowAddBonus] = useState(false);

    // History Modal State
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

    // Past Leagues State
    const [pastLeaguesModalVisible, setPastLeaguesModalVisible] = useState(false);
    const [pastLeagues, setPastLeagues] = useState<PastLeague[]>([]);
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);



    useEffect(() => {
        const unsubscribeMembers = subscribeToMembers(setMembers);
        const unsubscribeBonuses = subscribeToLeagueBonuses(leagueType, setBonuses);
        const unsubscribeRules = subscribeToLeagueRules(leagueType, setRules);
        const unsubscribeBonusDefs = subscribeToBonusDefinitions(leagueType, setBonusDefinitions);
        const unsubscribeDates = subscribeToLeagueDates(leagueType, (dates) => {
            setLeagueDates(dates);
            if (dates) {
                setDatesInput({ startDate: dates.startDate, endDate: dates.endDate });
            } else {
                setDatesInput({ startDate: '', endDate: '' });
            }
        });

        return () => {
            unsubscribeMembers();
            unsubscribeBonuses();
            unsubscribeRules();
            unsubscribeBonusDefs();
            unsubscribeDates();
        };
    }, [leagueType]);

    // Subscribe to Past Leagues
    useEffect(() => {
        const unsubscribe = subscribeToPastLeagues(setPastLeagues);
        return () => unsubscribe();
    }, []);



    // Separate effect for attendance subscription because it depends on leagueDates
    useEffect(() => {
        if (leagueDates && leagueDates.startDate && leagueDates.endDate) {
            const unsubscribeAttendance = subscribeToLeagueAttendance(leagueDates.startDate, leagueDates.endDate, setAttendanceData);
            return () => unsubscribeAttendance();
        } else {
            setAttendanceData([]);
        }
    }, [leagueDates]);

    // Subscribe to Daily Attendees for Bonus Tab
    useEffect(() => {
        const unsubscribePresenze = subscribeToPresenze(bonusDate, (ids) => {
            setDailyAttendees(ids);
        });
        return () => unsubscribePresenze();
    }, [bonusDate]);

    const [hasSetInitialDate, setHasSetInitialDate] = useState(false);

    // Subscribe to Events to get Training Dates
    useEffect(() => {
        const unsubscribeEvents = subscribeToEvents((fetchedEvents) => {
            const validEvents = fetchedEvents
                .filter(e => (
                    e.type === 'training' ||
                    e.type === 'Campo' ||
                    e.type === 'Palestra' ||
                    e.type === 'match' ||
                    e.type === 'tournament'
                ))
                .sort((a, b) => {
                    // Sort by date then by type (put trainings first if same date?)
                    // Or just stable sort by date.
                    // If multiple events on same day, we want them ordered.
                    // Let's sort by date ascending.
                    return a.date.localeCompare(b.date);
                });

            let filteredEvents = validEvents;
            if (leagueDates && leagueDates.startDate && leagueDates.endDate) {
                filteredEvents = validEvents.filter(e => e.date >= leagueDates.startDate && e.date <= leagueDates.endDate);
            }

            setSortedEvents(filteredEvents);
            setEvents(fetchedEvents); // Keep raw events if needed elsewhere

            // Smart Date Selection: Select the latest event that is <= today
            // Only run this if we haven't set it yet AND we have league dates to ensure we filter correctly
            if (!hasSetInitialDate && filteredEvents.length > 0 && leagueDates) {
                const today = new Date().toISOString().split('T')[0];
                // Find index of last event <= today
                let initialIndex = -1;
                for (let i = 0; i < filteredEvents.length; i++) {
                    if (filteredEvents[i].date <= today) {
                        initialIndex = i;
                    } else {
                        break; // Sorted, so we can stop
                    }
                }

                if (initialIndex !== -1) {
                    setCurrentEventIndex(initialIndex);
                } else {
                    // All future events? Pick first one.
                    setCurrentEventIndex(0);
                }
                setHasSetInitialDate(true);
            } else if (hasSetInitialDate && currentEventIndex === -1 && filteredEvents.length > 0) {
                // If we lost selection (e.g. filter changed), reset to 0 or something safe
                setCurrentEventIndex(0);
            }
        });
        return () => unsubscribeEvents();
    }, [leagueDates, hasSetInitialDate]);

    // Subscribe to Roster if it's a tournament or match
    useEffect(() => {
        if (currentEvent && (currentEvent.type === 'tournament' || currentEvent.type === 'match')) {
            const unsubscribeRoster = subscribeToRoster(currentEvent.id, (roster) => {
                setRosterMembers(roster);
            });
            return () => unsubscribeRoster();
        } else {
            setRosterMembers([]);
        }
    }, [currentEvent]);

    // --- Logic: Calculate Standings ---
    const calculateStandings = () => {
        const stats: Record<string, { member: Member, points: number, attendanceCount: number, attendanceCountCampo: number, attendanceCountGym: number, bonusPoints: number }> = {};

        // Initialize stats for all members
        members.forEach(member => {
            stats[member.id] = {
                member,
                points: 0,
                attendanceCount: 0,
                attendanceCountCampo: 0,
                attendanceCountGym: 0,
                bonusPoints: 0
            };
        });

        // Process Attendance (2 points per presence)
        attendanceData.forEach(record => {
            if (stats[record.memberId]) {
                const event = events.find(e => e.date === record.date);
                const isPalestra = event?.type === 'Palestra';

                stats[record.memberId].points += 2;

                if (isPalestra) {
                    stats[record.memberId].attendanceCountGym++;
                } else {
                    stats[record.memberId].attendanceCountCampo++;
                    stats[record.memberId].attendanceCount++;
                }
            }
        });

        // Process Bonuses
        bonuses.forEach(bonus => {
            // Filter by date range if leagueDates are available
            if (leagueDates && (bonus.date < leagueDates.startDate || bonus.date > leagueDates.endDate)) {
                return;
            }

            if (stats[bonus.memberId]) {
                stats[bonus.memberId].bonusPoints += bonus.points;
                stats[bonus.memberId].points += bonus.points;
            }
        });

        const sorted = Object.values(stats)
            .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return b.attendanceCount - a.attendanceCount;
            });

        // Assign Ranks
        const ranked = sorted.map((item, index) => {
            let rank = index + 1;
            if (index > 0) {
                const prev = sorted[index - 1];
                if (prev.points === item.points && prev.attendanceCount === item.attendanceCount) {
                    // @ts-ignore - adding rank property dynamically
                    rank = prev.rank;
                }
            }
            // @ts-ignore
            item.rank = rank;
            return item;
        });

        return ranked;
    };

    const standings = calculateStandings();

    const changeDate = (direction: number) => {
        if (sortedEvents.length === 0) return;

        let newIndex = currentEventIndex + direction;

        // Bounds check
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= sortedEvents.length) newIndex = sortedEvents.length - 1;

        setCurrentEventIndex(newIndex);
    };

    const handleAddBonus = async (points: number, reason: string) => {
        try {
            await addLeagueBonus({
                memberId: newBonus.memberId,
                points,
                reason,
                date: activeTab === 'bonusList' ? newBonus.date : bonusDate,
                leagueType
            });
            setBonusModalVisible(false);
            setNewBonus({ memberId: '', points: '', reason: '', date: bonusDate });
        } catch (error) {
            showAlert("Errore", "Impossibile aggiungere il bonus.");
        }
    };

    const handleManualAddBonus = () => {
        if (!newBonus.points || !newBonus.reason) {
            showAlert("Errore", "Compila tutti i campi.");
            return;
        }
        const points = parseInt(newBonus.points);
        if (isNaN(points)) {
            showAlert("Errore", "Punti non validi.");
            return;
        }
        handleAddBonus(points, newBonus.reason);
    };

    const handleDeleteBonus = async (id: string) => {
        showConfirmation(
            "Elimina Bonus",
            "Sei sicuro?",
            () => deleteLeagueBonus(id, leagueType),
            "Elimina"
        );
    };

    const handleSaveDates = async () => {
        showConfirmation(
            "Conferma Modifica Date",
            `Vuoi aggiornare le date del campionato ${leagueType === 'winter' ? 'Invernale' : 'Estivo'}?`,
            async () => {
                try {
                    await updateLeagueDates(leagueType, datesInput);
                    setDatesModalVisible(false);
                    showAlert("Successo", "Date campionato aggiornate con successo.");
                } catch (error) {
                    showAlert("Errore", "Impossibile salvare le date.");
                }
            },
            "Salva Date"
        );
    };

    const handleDateSelect = (date: string) => {
        if (showStartPicker) {
            setDatesInput(prev => ({ ...prev, startDate: date }));
            setShowStartPicker(false);
        } else if (showEndPicker) {
            setDatesInput(prev => ({ ...prev, endDate: date }));
            setShowEndPicker(false);
        }
    };

    const formatDateForDisplay = (isoDate: string) => {
        if (!isoDate) return 'Seleziona data';
        const [year, month, day] = isoDate.split('-');
        return `${day}/${month}/${year}`;
    };

    const handleArchiveLeague = async () => {
        if (!leagueDates || !leagueDates.endDate) return;

        const title = isLeagueArchived ? "Aggiorna Archivio" : "Archivia Lega";
        const message = isLeagueArchived
            ? "La lega è già stata archiviata. Vuoi sovrascrivere lo storico con i dati attuali?"
            : "Vuoi salvare i risultati di questa lega nello storico senza cancellare i dati attivi?";
        const confirmText = isLeagueArchived ? "Aggiorna" : "Archivia";

        showConfirmation(
            title,
            message,
            async () => {
                try {
                    const currentStandings = calculateStandings();
                    const top3 = currentStandings.slice(0, 3);
                    const winnerId = top3.length > 0 ? top3[0].member.id : '';
                    const leagueBonuses = bonuses.filter(b => 
                        (!leagueDates.startDate || b.date >= leagueDates.startDate) &&
                        (!leagueDates.endDate || b.date <= leagueDates.endDate)
                    );

                    const pastLeagueData: PastLeague = {
                        id: `${leagueType}_${leagueDates.endDate.split('-')[0]}`,
                        name: `${leagueType === 'winter' ? 'Winter' : 'Summer'} League ${leagueDates.endDate.split('-')[0]}`,
                        startDate: leagueDates.startDate,
                        endDate: leagueDates.endDate,
                        type: leagueType,
                        winnerId: winnerId,
                        totalParticipants: currentStandings.length,
                        bonuses: leagueBonuses,
                        standings: currentStandings.map((s, index): PastLeagueMember => ({
                            id: s.member.id,
                            name: s.member.nickname || s.member.firstName,
                            points: s.points,
                            attendanceCount: s.attendanceCount,
                            bonusPoints: s.bonusPoints,
                            rank: index + 1
                        }))
                    };

                    await archiveLeague(pastLeagueData);
                    setIsLeagueArchived(true);
                    showAlert("Successo", isLeagueArchived ? "Archivio aggiornato!" : "Lega archiviata correttamente!");
                } catch (error) {
                    console.error(error);
                    showAlert("Errore", "Impossibile archiviare la lega.");
                }
            },
            confirmText
        );
    };

    const handleArchiveAndResetLeague = async () => {
        if (!leagueDates || !leagueDates.endDate) return;

        showConfirmation(
            "Archivia e Pulisci per Nuova Stagione",
            "I risultati, la classifica e i bonus verranno archiviati nello storico. La scheda attiva verrà azzerata per iniziare la nuova stagione. Confermi?",
            async () => {
                try {
                    const currentStandings = calculateStandings();
                    const top3 = currentStandings.slice(0, 3);
                    const winnerId = top3.length > 0 ? top3[0].member.id : '';
                    const leagueBonuses = bonuses.filter(b => 
                        (!leagueDates.startDate || b.date >= leagueDates.startDate) &&
                        (!leagueDates.endDate || b.date <= leagueDates.endDate)
                    );

                    const pastLeagueData: PastLeague = {
                        id: `${leagueType}_${leagueDates.endDate.split('-')[0]}`,
                        name: `${leagueType === 'winter' ? 'Winter' : 'Summer'} League ${leagueDates.endDate.split('-')[0]}`,
                        startDate: leagueDates.startDate,
                        endDate: leagueDates.endDate,
                        type: leagueType,
                        winnerId: winnerId,
                        totalParticipants: currentStandings.length,
                        bonuses: leagueBonuses,
                        standings: currentStandings.map((s, index): PastLeagueMember => ({
                            id: s.member.id,
                            name: s.member.nickname || s.member.firstName,
                            points: s.points,
                            attendanceCount: s.attendanceCount,
                            bonusPoints: s.bonusPoints,
                            rank: index + 1
                        }))
                    };

                    await archiveAndResetLeague(leagueType, pastLeagueData);
                    setIsLeagueArchived(false);
                    showAlert("Successo", "Lega archiviata nello storico e scheda pulita per il nuovo anno!");
                } catch (error) {
                    console.error(error);
                    showAlert("Errore", "Impossibile archiviare e resettare la lega.");
                }
            },
            "Archivia e Pulisci"
        );
    };

    const handleResetLeagueOnly = async () => {
        showConfirmation(
            "Pulisci Scheda per Nuova Stagione",
            "I dati sono già archiviati nello storico. Vuoi azzerare le date e rimuovere i vecchi bonus per iniziare la nuova stagione?",
            async () => {
                try {
                    await resetLeagueData(leagueType);
                    setIsLeagueArchived(false);
                    showAlert("Successo", "Scheda pulita! Puoi ora impostare le date della nuova stagione.");
                } catch (error) {
                    console.error(error);
                    showAlert("Errore", "Impossibile resettare la lega.");
                }
            },
            "Pulisci Scheda"
        );
    };

    // Check if league is archived when dates change
    useEffect(() => {
        const checkArchiveStatus = async () => {
            if (leagueDates && leagueDates.endDate) {
                const id = `${leagueType}_${leagueDates.endDate.split('-')[0]}`;
                const archived = await checkIfLeagueArchived(id);
                setIsLeagueArchived(archived);
            }
        };
        checkArchiveStatus();
    }, [leagueDates, leagueType]);

    const renderCountdown = () => {
        const hasDates = leagueDates && leagueDates.startDate && leagueDates.endDate;

        if (!hasDates) {
            return (
                <View style={[styles.countdownCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={styles.countdownHeaderRow}>
                        <View style={[styles.statusChip, { backgroundColor: theme.colors.sectionBackground }]}>
                            <Text style={[styles.statusChipText, { color: theme.colors.textSecondary }]}>⚪ In attesa delle date</Text>
                        </View>
                    </View>
                    <Text style={[styles.countdownDescText, { color: theme.colors.textSecondary }]}>
                        Le date della {leagueType === 'winter' ? 'Winter' : 'Summer'} League non sono ancora impostate per questa stagione.
                    </Text>
                    {!isBubbaOnly && (
                        <View style={styles.countdownButtonsRow}>
                            <TouchableOpacity
                                style={[styles.cardActionBtnPrimary, { backgroundColor: theme.colors.primary }]}
                                onPress={() => setDatesModalVisible(true)}
                            >
                                <Text style={styles.cardActionBtnTextPrimary}>📅 Imposta Date Campionato</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            );
        }

        const parseDate = (dateStr: string) => {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        };

        const start = parseDate(leagueDates.startDate);
        const end = parseDate(leagueDates.endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const getDaysDiff = (d1: Date, d2: Date) => {
            const diffTime = d2.getTime() - d1.getTime();
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        };

        const isUpcoming = today < start;
        const isActive = today >= start && today <= end;
        const isFinished = today > end;
        const dateRangeLabel = `${formatDateForDisplay(leagueDates.startDate)} ➔ ${formatDateForDisplay(leagueDates.endDate)}`;

        return (
            <View style={[styles.countdownCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                {/* Header row: Status chip + Date Range */}
                <View style={styles.countdownHeaderRow}>
                    {isUpcoming && (
                        <View style={[styles.statusChip, { backgroundColor: '#fef3c7' }]}>
                            <Text style={[styles.statusChipText, { color: '#b45309' }]}>🟡 In Arrivo</Text>
                        </View>
                    )}
                    {isActive && (
                        <View style={[styles.statusChip, { backgroundColor: '#dcfce7' }]}>
                            <Text style={[styles.statusChipText, { color: '#15803d' }]}>🟢 In Corso</Text>
                        </View>
                    )}
                    {isFinished && (
                        <View style={[styles.statusChip, { backgroundColor: '#fee2e2' }]}>
                            <Text style={[styles.statusChipText, { color: '#b91c1c' }]}>🏁 Conclusa</Text>
                        </View>
                    )}

                    <Text style={[styles.dateRangeText, { color: theme.colors.textSecondary }]}>
                        {dateRangeLabel}
                    </Text>
                </View>

                {/* Main Countdown or Status Message */}
                <View style={styles.countdownBody}>
                    {isUpcoming && (
                        <View style={{ alignItems: 'center' }}>
                            <Text style={[styles.countdownSmallLabel, { color: theme.colors.textSecondary }]}>Inizio campionato</Text>
                            <Text style={[styles.countdownBigValue, { color: theme.colors.primary }]}>
                                tra {getDaysDiff(today, start)} giorni
                            </Text>
                        </View>
                    )}
                    {isActive && (
                        <View style={{ alignItems: 'center' }}>
                            <Text style={[styles.countdownSmallLabel, { color: theme.colors.textSecondary }]}>Tempo rimanente</Text>
                            <Text style={[styles.countdownBigValue, { color: theme.colors.primary }]}>
                                {getDaysDiff(today, end)} {getDaysDiff(today, end) === 1 ? 'giorno' : 'giorni'}
                            </Text>
                        </View>
                    )}
                    {isFinished && (
                        <View style={{ alignItems: 'center' }}>
                            <Text style={[styles.countdownBigValue, { color: theme.colors.text, fontSize: 18 }]}>
                                Campionato Concluso
                            </Text>
                            {isLeagueArchived ? (
                                <Text style={{ color: theme.colors.success, fontSize: 13, marginTop: 4, fontWeight: '600' }}>
                                    ✓ Classifica archiviata nello storico
                                </Text>
                            ) : (
                                <Text style={[styles.countdownDescText, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                                    Archivia i dati per conservare lo storico e azzerare la scheda.
                                </Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Admin Action Buttons */}
                {!isBubbaOnly && (
                    <View style={styles.countdownButtonsRow}>
                        {isFinished ? (
                            !isLeagueArchived ? (
                                <>
                                    <TouchableOpacity
                                        style={[styles.cardActionBtnPrimary, { backgroundColor: theme.colors.primary }]}
                                        onPress={handleArchiveAndResetLeague}
                                    >
                                        <Text style={styles.cardActionBtnTextPrimary}>📦 Archivia e Pulisci</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.cardActionBtnSecondary, { borderColor: theme.colors.primary }]}
                                        onPress={handleArchiveLeague}
                                    >
                                        <Text style={[styles.cardActionBtnTextSecondary, { color: theme.colors.primary }]}>💾 Solo Archivia</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={[styles.cardActionBtnPrimary, { backgroundColor: theme.colors.primary }]}
                                        onPress={handleResetLeagueOnly}
                                    >
                                        <Text style={styles.cardActionBtnTextPrimary}>🔄 Pulisci Scheda per Nuovo Anno</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.cardActionBtnSecondary, { borderColor: theme.colors.border }]}
                                        onPress={() => setDatesModalVisible(true)}
                                    >
                                        <Text style={[styles.cardActionBtnTextSecondary, { color: theme.colors.textSecondary }]}>✏️ Modifica Date</Text>
                                    </TouchableOpacity>
                                </>
                            )
                        ) : (
                            <TouchableOpacity
                                style={[styles.cardActionBtnSecondary, { borderColor: theme.colors.border }]}
                                onPress={() => setDatesModalVisible(true)}
                            >
                                <Text style={[styles.cardActionBtnTextSecondary, { color: theme.colors.textSecondary }]}>✏️ Modifica Date</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const renderRules = () => (
        <ScrollView style={styles.rulesContainer} contentContainerStyle={{ paddingBottom: 40 }}>
            {rules.map((rule) => (
                <View key={rule.id} style={[styles.ruleCard, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.ruleTitle, { color: theme.colors.text }]}>{rule.title}</Text>
                    <Text style={[styles.ruleText, { color: theme.colors.textSecondary }]}>{rule.description}</Text>
                </View>
            ))}
            {rules.length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>Nessuna regola definita.</Text>
                </View>
            )}
        </ScrollView>
    );

    const renderStandingsRow = ({ item, index }: { item: any, index: number }) => (
        <TouchableOpacity
            style={[styles.row, index % 2 === 0 && { backgroundColor: theme.colors.sectionBackground }, { borderBottomColor: theme.colors.border }]}
            onPress={() => {
                setSelectedMemberId(item.member.id);
                setHistoryModalVisible(true);
            }}
        >
            <Text style={[styles.cell, styles.cellRank, { color: theme.colors.primary }]}>{item.rank}</Text>
            <Text style={[styles.cell, styles.cellTeam, { color: theme.colors.text }]}>
                {item.member.nickname || item.member.firstName}
                {item.member.jerseyNumber ? <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}> #{item.member.jerseyNumber}</Text> : ''}
            </Text>
            <Text style={[styles.cell, styles.cellPoints, { color: theme.colors.text }]}>{item.points}</Text>
            <Text style={[styles.cell, { color: theme.colors.text }]}>
                {item.attendanceCountCampo}<Text style={{ fontSize: 11, color: theme.colors.textSecondary }}> / {item.attendanceCountGym}P</Text>
            </Text>
            <Text style={[styles.cell, { color: theme.colors.text }]}>{item.bonusPoints}</Text>
        </TouchableOpacity>
    );

    const renderBonusItem = ({ item }: { item: LeagueBonus }) => {
        const member = members.find(m => m.id === item.memberId);
        const name = member ? (member.nickname || `${member.firstName} ${member.lastName || ''}`) : '???';

        return (
            <TouchableOpacity
                style={[styles.matchCard, { backgroundColor: theme.colors.card }]}
                onLongPress={() => !isBubbaOnly && handleDeleteBonus(item.id)}
            >
                <View style={styles.matchHeader}>
                    <Text style={[styles.matchDate, { color: theme.colors.textSecondary }]}>{formatDateForDisplay(item.date)}</Text>
                    <Text style={[styles.matchRound, { color: item.points >= 0 ? theme.colors.success : theme.colors.danger }]}>
                        {item.points > 0 ? '+' : ''}{item.points}
                    </Text>
                </View>
                <View style={styles.matchBody}>
                    <Text style={[styles.teamName, { color: theme.colors.text }]}>{name}</Text>
                    <Text style={[styles.scoreText, { color: theme.colors.textSecondary }]}>{item.reason}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const dailyEvent = currentEvent;
    const isTournamentOrMatch = dailyEvent && (dailyEvent.type === 'tournament' || dailyEvent.type === 'match');
    const isRestrictedEvent = dailyEvent && dailyEvent.type === 'Palestra';
    const eventLabel = dailyEvent ? dailyEvent.title : 'Allenamento';

    const togglePresence = async (memberId: string, hasPresence: boolean) => {
        if (isBubbaOnly) return;
        if (hasPresence) {
            const bonus = bonuses.find(b => b.memberId === memberId && b.date === bonusDate && b.reason === 'Presenza');
            if (bonus) {
                await deleteLeagueBonus(bonus.id, leagueType);
            }
        } else {
            await addLeagueBonus({
                memberId,
                points: 2,
                reason: 'Presenza',
                date: bonusDate,
                leagueType
            });
        }
    };

    const renderTournamentMemberRow = ({ item }: { item: Member }) => {
        const memberBonuses = bonuses.filter(b => b.memberId === item.id && b.date === bonusDate);
        const hasPresence = memberBonuses.some(b => b.reason === 'Presenza');

        return (
            <View style={[styles.attendeeRow, { backgroundColor: theme.colors.card }]}>
                <View style={styles.attendeeInfo}>
                    <Text style={[styles.attendeeName, { color: theme.colors.text }]}>{item.nickname || item.firstName}</Text>
                    <View style={styles.bonusTags}>
                        {memberBonuses.map((bonus, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.bonusTag,
                                    bonus.points >= 0 ? styles.bonusTagPositive : styles.malusTag,
                                ]}
                                onPress={() => !isBubbaOnly && handleDeleteBonus(bonus.id)}
                            >
                                <Text style={styles.bonusTagText}>
                                    {bonus.points > 0 ? '+' : ''}{bonus.points} {bonus.reason}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        style={[styles.actionButton, hasPresence && styles.actionButtonActive]}
                        onPress={() => togglePresence(item.id, hasPresence)}
                        disabled={isBubbaOnly}
                    >
                        <Text style={[styles.actionButtonText, hasPresence && styles.actionButtonTextActive]}>P</Text>
                    </TouchableOpacity>
                    {!isBubbaOnly && !isRestrictedEvent && (
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => {
                                setNewBonus(prev => ({ ...prev, memberId: item.id }));
                                setBonusModalVisible(true);
                            }}
                        >
                            <Image source={require('../assets/plus.png')} style={{ width: 18, height: 18, tintColor: '#fff' }} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const renderDailyAttendeeRow = ({ item: memberId }: { item: string }) => {
        const member = members.find(m => m.id === memberId);
        if (!member) return null;

        const memberBonuses = bonuses.filter(b => b.memberId === memberId && b.date === bonusDate);

        return (
            <TouchableOpacity
                style={[styles.attendeeRow, { backgroundColor: theme.colors.card }]}
                onPress={() => {
                    if (!isBubbaOnly) {
                        setNewBonus(prev => ({ ...prev, memberId: memberId }));
                        setBonusModalVisible(true);
                    }
                }}
                disabled={isRestrictedEvent || isBubbaOnly}
                activeOpacity={isBubbaOnly ? 1 : 0.7}
            >
                <View style={styles.attendeeInfo}>
                    <Text style={[styles.attendeeName, { color: theme.colors.text }]}>{member.nickname || member.firstName}</Text>
                    {memberBonuses.length > 0 && (
                        <View style={styles.bonusTags}>
                            {memberBonuses.map((bonus, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.bonusTag,
                                        bonus.points >= 0 ? styles.bonusTagPositive : styles.malusTag,
                                    ]}
                                    onPress={() => !isBubbaOnly && handleDeleteBonus(bonus.id)}
                                >
                                    <Text style={styles.bonusTagText}>
                                        {bonus.points > 0 ? '+' : ''}{bonus.points} {bonus.reason}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
                {!isBubbaOnly && !isRestrictedEvent && (
                    <View style={[styles.actionButton, { backgroundColor: theme.colors.primary, width: 32, height: 32, borderRadius: 16 }]}>
                        <Image source={require('../assets/plus.png')} style={{ width: 16, height: 16, tintColor: '#fff' }} />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const getMemberHistory = (memberId: string) => {
        const history: { date: string, points: number, reason: string, type: 'attendance' | 'bonus' | 'malus' }[] = [];

        // 1. Attendance
        attendanceData.filter(a => a.memberId === memberId).forEach(record => {
            const event = events.find(e => e.date === record.date);
            history.push({
                date: record.date,
                points: 2,
                reason: event ? (event.title || 'Presenza') : 'Presenza',
                type: 'attendance'
            });
        });

        // 2. Bonuses
        bonuses.filter(b => b.memberId === memberId).forEach(bonus => {
            history.push({
                date: bonus.date,
                points: bonus.points,
                reason: bonus.reason,
                type: bonus.points >= 0 ? 'bonus' : 'malus'
            });
        });

        return history.sort((a, b) => b.date.localeCompare(a.date));
    };

    const renderPastLeaguesModal = () => {
        const currentLeague = pastLeagues[currentHistoryIndex];
        const podium = currentLeague ? currentLeague.standings.slice(0, 3) : [];

        // Reorder for visual podium: 2nd, 1st, 3rd
        const visualPodium = [];
        if (podium.length > 1) visualPodium.push(podium[1]); // 2nd
        if (podium.length > 0) visualPodium.push(podium[0]); // 1st
        if (podium.length > 2) visualPodium.push(podium[2]); // 3rd

        return (
            <Modal visible={pastLeaguesModalVisible} transparent animationType="fade" onRequestClose={() => setPastLeaguesModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card, maxHeight: '80%' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                            <TouchableOpacity onPress={() => setPastLeaguesModalVisible(false)}>
                                <Image source={require('../assets/x.png')} style={{ width: 24, height: 24 }} />
                            </TouchableOpacity>
                        </View>

                        {pastLeagues.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Nessuna lega passata.</Text>
                            </View>
                        ) : (
                            <>
                                <View style={styles.historyNav}>
                                    <TouchableOpacity
                                        onPress={() => setCurrentHistoryIndex(prev => Math.min(prev + 1, pastLeagues.length - 1))}
                                        disabled={currentHistoryIndex >= pastLeagues.length - 1}
                                        style={styles.historyNavButton}
                                    >
                                        <Image
                                            source={require('../assets/arrow.png')} // Reuse arrow
                                            style={[styles.navIcon, { transform: [{ rotate: '180deg' }], tintColor: theme.colors.primary, opacity: currentHistoryIndex >= pastLeagues.length - 1 ? 0.3 : 1 }]}
                                        />
                                    </TouchableOpacity>
                                    <View>
                                        <Text style={[styles.historyTitle, { color: theme.colors.text }]}>
                                            {currentLeague?.name || 'Lega Passata'}
                                        </Text>
                                        <Text style={[styles.historySubtitle, { color: theme.colors.textSecondary }]}>
                                            {formatDateForDisplay(currentLeague?.startDate)} - {formatDateForDisplay(currentLeague?.endDate)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setCurrentHistoryIndex(prev => Math.max(prev - 1, 0))}
                                        disabled={currentHistoryIndex <= 0}
                                        style={styles.historyNavButton}
                                    >
                                        <Image
                                            source={require('../assets/arrow.png')}
                                            style={[styles.navIcon, { tintColor: theme.colors.primary, opacity: currentHistoryIndex <= 0 ? 0.3 : 1 }]}
                                        />
                                    </TouchableOpacity>
                                </View>

                                {/* Podium */}
                                <View style={styles.podiumContainer}>
                                    {visualPodium.map((member, index) => {
                                        // Visual index is 0 for 2nd, 1 for 1st, 2 for 3rd
                                        let rank = 1;
                                        let height = 100;
                                        let color = '#FFD700'; // Gold

                                        if (member.rank === 1) { // 1st Place (Center)
                                            rank = 1;
                                            height = 140;
                                            color = '#FFD700';
                                        } else if (member.rank === 2) { // 2nd Place (Left)
                                            rank = 2;
                                            height = 100;
                                            color = '#C0C0C0'; // Silver
                                        } else { // 3rd Place (Right)
                                            rank = 3;
                                            height = 70;
                                            color = '#CD7F32'; // Bronze
                                        }

                                        return (
                                            <View key={member.id} style={styles.podiumPlace}>
                                                <Text style={[styles.podiumName, { color: theme.colors.text }]} numberOfLines={1}>
                                                    {member.name}
                                                </Text>
                                                <View style={[styles.podiumBar, { height, backgroundColor: color }]}>
                                                    <Text style={styles.podiumRank}>{rank}</Text>
                                                    <Text style={styles.podiumPoints}>{member.points} pt</Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>

                                <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, marginBottom: 10 }}>
                                    Partecipanti totali: {currentLeague?.totalParticipants}
                                </Text>

                                {currentLeague?.standings && currentLeague.standings.length > 0 && (
                                    <ScrollView style={{ flex: 1, maxHeight: 220, marginTop: 4 }} contentContainerStyle={{ paddingBottom: 10 }}>
                                        {currentLeague.standings.map((member, sIdx) => (
                                            <View
                                                key={member.id || sIdx}
                                                style={[
                                                    styles.row,
                                                    sIdx % 2 === 0 && { backgroundColor: theme.colors.sectionBackground },
                                                    { borderBottomColor: theme.colors.border, paddingVertical: 6 }
                                                ]}
                                            >
                                                <Text style={[styles.cell, styles.cellRank, { color: theme.colors.primary }]}>{member.rank || sIdx + 1}</Text>
                                                <Text style={[styles.cell, styles.cellTeam, { color: theme.colors.text }]} numberOfLines={1}>{member.name}</Text>
                                                <Text style={[styles.cell, styles.cellPoints, { color: theme.colors.text }]}>{member.points} pt</Text>
                                                <Text style={[styles.cell, { color: theme.colors.textSecondary, fontSize: 12 }]}>{member.attendanceCount} pres.</Text>
                                                <Text style={[styles.cell, { color: (member.bonusPoints || 0) >= 0 ? theme.colors.success : theme.colors.danger, fontSize: 12 }]}>
                                                    {(member.bonusPoints || 0) > 0 ? `+${member.bonusPoints}` : (member.bonusPoints || 0)}
                                                </Text>
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        );
    };

    const renderHistoryModal = () => {
        const member = members.find(m => m.id === selectedMemberId);
        if (!member) return null;

        const history = getMemberHistory(member.id);

        return (
            <Modal visible={historyModalVisible} transparent animationType="fade" onRequestClose={() => setHistoryModalVisible(false)}>
                <View style={[styles.modalOverlay]}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card, overflow: 'hidden' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                            <Text style={[styles.modalTitle, { margin: 0, color: theme.colors.text }]}>
                                Storia Punti: {member.nickname || member.firstName}
                            </Text>
                            <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                                <Image source={require('../assets/x.png')} style={{ width: 24, height: 24 }} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flex: 1 }}>
                            {history.length === 0 ? (
                                <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Nessun punto registrato.</Text>
                            ) : (
                                history.map((item, index) => (
                                    <View key={index} style={[styles.historyRow, { borderBottomColor: theme.colors.border }]}>
                                        <Text style={[styles.historyDate, { color: theme.colors.textSecondary }]}>{formatDateForDisplay(item.date)}</Text>
                                        <Text style={[styles.historyReason, { color: theme.colors.text }]}>
                                            {item.reason}
                                            {item.type === 'attendance' && <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}> (Presenza)</Text>}
                                        </Text>
                                        <Text style={[styles.historyPoints, item.points > 0 ? { color: theme.colors.success } : { color: theme.colors.danger }]}>
                                            {item.points > 0 ? '+' : ''}{item.points}
                                        </Text>
                                    </View>
                                ))
                            )}
                        </ScrollView>

                        <View style={{ marginTop: 15, padding: 10, backgroundColor: theme.colors.sectionBackground, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>Totale:</Text>
                            <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                                {history.reduce((sum, item) => sum + item.points, 0)}
                            </Text>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => setPastLeaguesModalVisible(true)} style={[styles.historyButton, navigation.canGoBack() && { left: 45 }]}>
                        <Image source={require('../assets/trophy.png')} style={[styles.iconImage, { tintColor: theme.colors.text }]} />
                    </TouchableOpacity>
                    <ScreenTitle title="LEAGUE" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
                    {!isBubbaOnly && (
                        <TouchableOpacity onPress={() => setDatesModalVisible(true)} style={styles.settingsButton}>
                            <Image source={require('../assets/gear.png')} style={[styles.iconImage, { tintColor: theme.colors.text }]} />
                        </TouchableOpacity>
                    )}
                </View>

                {renderCountdown()}

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'standings' && styles.tabActive]}
                        onPress={() => setActiveTab('standings')}
                    >
                        <Text style={[styles.tabText, activeTab === 'standings' && styles.tabTextActive, { color: activeTab === 'standings' ? theme.colors.primary : theme.colors.textSecondary }]}>Classifica</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'bonus' && styles.tabActive]}
                        onPress={() => setActiveTab('bonus')}
                    >
                        <Text style={[styles.tabText, activeTab === 'bonus' && styles.tabTextActive, { color: activeTab === 'bonus' ? theme.colors.primary : theme.colors.textSecondary }]}>Punti</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'rules' && styles.tabActive]}
                        onPress={() => setActiveTab('rules')}
                    >
                        <Text style={[styles.tabText, activeTab === 'rules' && styles.tabTextActive, { color: activeTab === 'rules' ? theme.colors.primary : theme.colors.textSecondary }]}>Regole</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'bonusList' && styles.tabActive]}
                        onPress={() => setActiveTab('bonusList')}
                    >
                        <Text style={[styles.tabText, activeTab === 'bonusList' && styles.tabTextActive, { color: activeTab === 'bonusList' ? theme.colors.primary : theme.colors.textSecondary }]}>Lista Punti</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.content}>
                {activeTab === 'standings' && (
                    <View style={{ flex: 1 }}>
                        <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, padding: 5 }}>
                            Totale Giocatori: {standings.length}
                        </Text>
                        <View style={[styles.tableHeader, { borderBottomColor: theme.colors.border }]}>
                            <Text style={[styles.headerCell, styles.cellRank, { color: theme.colors.textSecondary }]}>#</Text>
                            <Text style={[styles.headerCell, styles.cellTeam, { color: theme.colors.textSecondary }]}>Giocatore</Text>
                            <Text style={[styles.headerCell, styles.cellPoints, { color: theme.colors.textSecondary }]}>PT</Text>
                            <Text style={[styles.headerCell, { color: theme.colors.textSecondary }]}>C / P</Text>
                            <Text style={[styles.headerCell, { color: theme.colors.textSecondary }]}>Bonus</Text>
                        </View>
                        <FlatList
                            data={standings}
                            renderItem={renderStandingsRow}
                            keyExtractor={item => item.member.id}
                            contentContainerStyle={{ paddingBottom: 80 }}
                            initialNumToRender={50}
                        />
                    </View>
                )}

                {activeTab === 'bonus' && (
                    <View style={{ flex: 1 }}>
                        {/* Date Navigation */}
                        <View style={styles.dateNav}>
                            <TouchableOpacity
                                onPress={() => changeDate(-1)}
                                style={styles.navButton}
                                disabled={!leagueDates || !leagueDates.startDate}
                            >
                                <Image
                                    source={require('../assets/arrow.png')}
                                    style={[
                                        styles.navIcon,
                                        { transform: [{ rotate: '180deg' }], tintColor: theme.colors.primary },
                                        (!leagueDates || !leagueDates.startDate) && { tintColor: '#ccc' }
                                    ]}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    if (leagueDates && leagueDates.startDate) {
                                        setShowBonusDatePicker(true);
                                    }
                                }}
                                disabled={!leagueDates || !leagueDates.startDate}
                            >
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={[
                                        styles.dateDisplay,
                                        { color: theme.colors.text },
                                        (!leagueDates || !leagueDates.startDate) && { color: '#ccc' }
                                    ]}>
                                        {(!leagueDates || !leagueDates.startDate) ? 'In attesa delle date' : formatDateForDisplay(bonusDate)}
                                    </Text>
                                    {leagueDates && leagueDates.startDate && (
                                        <Text style={{
                                            fontSize: 14,
                                            color: isTournamentOrMatch ? theme.colors.warning : theme.colors.primary,
                                            fontWeight: 'bold',
                                            marginTop: 2
                                        }}>
                                            {eventLabel}
                                        </Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => changeDate(1)}
                                style={styles.navButton}
                                disabled={!leagueDates || !leagueDates.startDate}
                            >
                                <Image
                                    source={require('../assets/arrow.png')}
                                    style={[
                                        styles.navIcon,
                                        { tintColor: theme.colors.primary },
                                        (!leagueDates || !leagueDates.startDate) && { tintColor: '#ccc' }
                                    ]}
                                />
                            </TouchableOpacity>

                        </View>

                        <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                            {isTournamentOrMatch ? `Giocatori (${members.length})` : `Presenti (${dailyAttendees.length})`}
                        </Text>

                        {isTournamentOrMatch ? (
                            <FlatList
                                data={members.filter(m => rosterMembers.some(rm => rm.memberId === m.id))}
                                renderItem={renderTournamentMemberRow}
                                keyExtractor={item => item.id}
                                contentContainerStyle={{ padding: 15, paddingBottom: 80 }}
                                ListEmptyComponent={
                                    <View style={styles.emptyState}>
                                        <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Nessun giocatore nel roster.</Text>
                                    </View>
                                }
                            />
                        ) : (
                            dailyAttendees.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Nessun presente registrato per questa data.</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={dailyAttendees}
                                    renderItem={renderDailyAttendeeRow}
                                    keyExtractor={item => item}
                                    contentContainerStyle={{ padding: 15, paddingBottom: 80 }}
                                />
                            )
                        )}


                    </View>
                )}

                {activeTab === 'rules' && renderRules()}

                {activeTab === 'bonusList' && (
                    <ScrollView style={styles.rulesContainer} contentContainerStyle={{ paddingBottom: 40 }}>
                        {!isBubbaOnly && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: theme.colors.primary, marginBottom: 20, flexDirection: 'row', justifyContent: 'center', width: '100%' }]}
                                onPress={() => {
                                    setNewBonus({ memberId: members[0]?.id || '', points: '', reason: '', date: new Date().toISOString().split('T')[0] });
                                    setBonusModalVisible(true);
                                }}
                            >
                                <Text style={[styles.actionButtonText, { fontSize: 16, marginLeft: 5 }]}>➕ Aggiungi Bonus Extra</Text>
                            </TouchableOpacity>
                        )}
                        <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>Bonus</Text>
                        {bonusDefinitions.filter(b => b.type === 'bonus').map((bonus, index) => (
                            <View key={index} style={[styles.ruleCard, { backgroundColor: theme.colors.card }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={[styles.ruleTitle, { color: theme.colors.text }]}>{bonus.label}</Text>
                                    <Text style={[styles.ruleTitle, { color: theme.colors.success }]}>+{bonus.points}</Text>
                                </View>
                            </View>
                        ))}
                        <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>Malus</Text>
                        {bonusDefinitions.filter(b => b.type === 'malus').map((malus, index) => (
                            <View key={index} style={[styles.ruleCard, { backgroundColor: theme.colors.card }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={[styles.ruleTitle, { color: theme.colors.text }]}>{malus.label}</Text>
                                    <Text style={[styles.ruleTitle, { color: theme.colors.danger }]}>{malus.points}</Text>
                                </View>
                            </View>
                        ))}
                        {bonusDefinitions.length === 0 && (
                            <View style={styles.emptyState}>
                                <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Nessun bonus/malus definito.</Text>
                            </View>
                        )}
                    </ScrollView>
                )}
            </View>

            {renderHistoryModal()}
            {renderPastLeaguesModal()}

            {/* Add Bonus Modal */}
            <Modal visible={bonusModalVisible} transparent animationType="fade" onRequestClose={() => setBonusModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Nuovo Bonus/Malus</Text>


                            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                                {activeTab === 'bonusList' ? 'Bonus Generico' : (members.find(m => m.id === newBonus.memberId)?.nickname || members.find(m => m.id === newBonus.memberId)?.firstName) + ' - ' + formatDateForDisplay(bonusDate)}
                            </Text>

                            {activeTab === 'bonusList' && (
                                <View style={{ marginBottom: 15 }}>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Giocatore:</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                                        {members.sort((a, b) => (a.nickname || a.firstName).localeCompare(b.nickname || b.firstName)).map(m => (
                                            <TouchableOpacity
                                                key={m.id}
                                                style={[
                                                    styles.chip,
                                                    newBonus.memberId === m.id && { backgroundColor: theme.colors.primary },
                                                    { borderColor: theme.colors.border, borderWidth: 1 }
                                                ]}
                                                onPress={() => setNewBonus(prev => ({ ...prev, memberId: m.id }))}
                                            >
                                                <Text style={[
                                                    styles.chipText,
                                                    newBonus.memberId === m.id ? { color: '#fff' } : { color: theme.colors.text }
                                                ]}>
                                                    {m.nickname || m.firstName}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Data:</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowBonusDatePicker(true)}
                                        style={[styles.dateInput, { backgroundColor: theme.colors.inputBackground, marginBottom: 0 }]}
                                    >
                                        <Text style={{ color: theme.colors.text }}>{formatDateForDisplay(newBonus.date)}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={[styles.modalTabContainer, { borderBottomColor: theme.colors.border }]}>
                                <TouchableOpacity
                                    style={[styles.modalTab, bonusTypeTab === 'bonus' && styles.modalTabActive]}
                                    onPress={() => setBonusTypeTab('bonus')}
                                >
                                    <Text style={[styles.modalTabText, bonusTypeTab === 'bonus' && styles.modalTabTextActive, { color: bonusTypeTab === 'bonus' ? '#003399' : theme.colors.textSecondary }]}>Bonus</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalTab, bonusTypeTab === 'malus' && styles.modalTabActive]}
                                    onPress={() => setBonusTypeTab('malus')}
                                >
                                    <Text style={[styles.modalTabText, bonusTypeTab === 'malus' && styles.modalTabTextActive, { color: bonusTypeTab === 'malus' ? '#003399' : theme.colors.textSecondary }]}>Malus</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalTab, bonusTypeTab === 'custom' && styles.modalTabActive]}
                                    onPress={() => setBonusTypeTab('custom')}
                                >
                                    <Text style={[styles.modalTabText, bonusTypeTab === 'custom' && styles.modalTabTextActive, { color: bonusTypeTab === 'custom' ? '#003399' : theme.colors.textSecondary }]}>Personalizzato</Text>
                                </TouchableOpacity>
                            </View>

                            {bonusTypeTab === 'custom' ? (
                                <View>
                                    <TextInput
                                        style={[styles.input, { width: '100%', marginBottom: 15, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                        placeholder="Motivazione"
                                        placeholderTextColor={theme.colors.textSecondary}
                                        value={newBonus.reason}
                                        onChangeText={t => setNewBonus(prev => ({ ...prev, reason: t }))}
                                    />
                                    <TextInput
                                        style={[styles.input, { width: '100%', marginBottom: 15, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                        placeholder="Punti (es. 1 o -1)"
                                        placeholderTextColor={theme.colors.textSecondary}
                                        keyboardType="numeric"
                                        value={newBonus.points}
                                        onChangeText={t => setNewBonus(prev => ({ ...prev, points: t }))}
                                    />
                                    <TouchableOpacity
                                        style={[styles.actionButton, { backgroundColor: theme.colors.primary, alignSelf: 'center', width: '100%', borderRadius: 8, height: 50, marginLeft: 0 }]}
                                        onPress={handleManualAddBonus}
                                    >
                                        <Text style={styles.actionButtonText}>Aggiungi</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={[styles.bonusOptionsList, { maxHeight: undefined }]}>
                                    {bonusDefinitions.filter(d => d.type === bonusTypeTab).map((def) => (
                                        <TouchableOpacity
                                            key={def.id}
                                            style={[styles.bonusOption, { backgroundColor: theme.colors.inputBackground }]}
                                            onPress={() => handleAddBonus(def.points, def.label)}
                                        >
                                            <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{def.label}</Text>
                                            <Text style={[styles.optionPoints, def.points > 0 ? { color: theme.colors.success } : { color: theme.colors.danger }]}>
                                                {def.points > 0 ? '+' : ''}{def.points}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}



                        </ScrollView>
                        <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.colors.primary, marginBottom: 20 }]} onPress={() => setBonusModalVisible(false)}>
                            <Text style={styles.closeButtonText}>Chiudi</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Dates/Settings Modal */}
            <Modal visible={datesModalVisible} transparent animationType="fade" onRequestClose={() => setDatesModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '80%', backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Impostazioni Lega</Text>

                        <View style={[styles.modalTabContainer, { borderBottomColor: theme.colors.border }]}>
                            <TouchableOpacity
                                style={[styles.modalTab, settingsTab === 'dates' && styles.modalTabActive]}
                                onPress={() => setSettingsTab('dates')}
                            >
                                <Text style={[styles.modalTabText, settingsTab === 'dates' && styles.modalTabTextActive, { color: settingsTab === 'dates' ? '#003399' : theme.colors.textSecondary }]}>Date</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalTab, settingsTab === 'rules' && styles.modalTabActive]}
                                onPress={() => setSettingsTab('rules')}
                            >
                                <Text style={[styles.modalTabText, settingsTab === 'rules' && styles.modalTabTextActive, { color: settingsTab === 'rules' ? '#003399' : theme.colors.textSecondary }]}>Regole</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalTab, settingsTab === 'bonus' && styles.modalTabActive]}
                                onPress={() => setSettingsTab('bonus')}
                            >
                                <Text style={[styles.modalTabText, settingsTab === 'bonus' && styles.modalTabTextActive, { color: settingsTab === 'bonus' ? '#003399' : theme.colors.textSecondary }]}>Bonus</Text>
                            </TouchableOpacity>
                        </View>

                        {settingsTab === 'dates' && (
                            <View style={{ flex: 1, justifyContent: 'space-between' }}>
                                <View>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Data Inizio:</Text>
                                    <TouchableOpacity onPress={() => setShowStartPicker(true)} style={[styles.dateInput, { backgroundColor: theme.colors.inputBackground }]}>
                                        <Text style={{ color: theme.colors.text }}>{formatDateForDisplay(datesInput.startDate)}</Text>
                                    </TouchableOpacity>

                                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Data Fine:</Text>
                                    <TouchableOpacity onPress={() => setShowEndPicker(true)} style={[styles.dateInput, { backgroundColor: theme.colors.inputBackground }]}>
                                        <Text style={{ color: theme.colors.text }}>{formatDateForDisplay(datesInput.endDate)}</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={[styles.modalButtons, { marginTop: 'auto', paddingBottom: 10 }]}>
                                    <TouchableOpacity style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={() => setDatesModalVisible(false)}>
                                        <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.button, styles.saveButton, { backgroundColor: theme.colors.primary }]} onPress={handleSaveDates}>
                                        <Text style={styles.buttonText}>Salva</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {settingsTab === 'rules' && (
                            <View style={{ flex: 1 }}>
                                <ScrollView style={styles.rulesList}>
                                    {localRules.map((rule) => (
                                        <View key={rule.id} style={[styles.ruleItem, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                                            {editingRuleId === rule.id ? (
                                                <View style={{ flex: 1 }}>
                                                    <TextInput
                                                        style={[styles.input, { marginBottom: 5, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                                        value={editingRuleData.title}
                                                        onChangeText={t => setEditingRuleData({ ...editingRuleData, title: t })}
                                                    />
                                                    <TextInput
                                                        style={[styles.input, { height: 60, textAlignVertical: 'top', backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                                        multiline
                                                        value={editingRuleData.description}
                                                        onChangeText={t => setEditingRuleData({ ...editingRuleData, description: t })}
                                                    />
                                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                                                        <TouchableOpacity onPress={() => setEditingRuleId(null)} style={{ marginRight: 15 }}>
                                                            <Text style={{ color: 'red' }}>Annulla</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => {
                                                            const updatedRules = localRules.map(r => r.id === rule.id ? { ...r, ...editingRuleData } : r);
                                                            setLocalRules(updatedRules);
                                                            setEditingRuleId(null);
                                                        }}>
                                                            <Text style={{ color: 'green', fontWeight: 'bold' }}>Salva</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ) : (
                                                <>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.ruleTitle, { color: theme.colors.text }]}>{rule.title}</Text>
                                                        <Text style={[styles.ruleText, { color: theme.colors.textSecondary }]}>{rule.description}</Text>
                                                    </View>
                                                    <TouchableOpacity onPress={() => {
                                                        setEditingRuleId(rule.id);
                                                        setEditingRuleData({ title: rule.title, description: rule.description });
                                                    }} style={{ marginLeft: 10 }}>
                                                        <Text style={{ fontSize: 18, color: theme.colors.primary }}>✎</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => {
                                                        const updatedRules = localRules.filter(r => r.id !== rule.id);
                                                        setLocalRules(updatedRules);
                                                    }} style={{ marginLeft: 10, backgroundColor: theme.colors.danger, borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' }}>
                                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>✕</Text>
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                        </View>
                                    ))}
                                </ScrollView>

                                {showAddRule && (
                                    <View style={{ marginBottom: 10 }}>
                                        <View style={styles.customInputContainer}>
                                            <TextInput
                                                style={[styles.input, { flex: 1, marginRight: 5, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                                placeholder="Titolo Regola"
                                                placeholderTextColor={theme.colors.textSecondary}
                                                value={newRule.title}
                                                onChangeText={t => setNewRule({ ...newRule, title: t })}
                                            />
                                        </View>
                                        <TextInput
                                            style={[styles.input, { height: 60, textAlignVertical: 'top', marginBottom: 10, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                            placeholder="Descrizione Regola"
                                            placeholderTextColor={theme.colors.textSecondary}
                                            multiline
                                            value={newRule.description}
                                            onChangeText={t => setNewRule({ ...newRule, description: t })}
                                        />
                                        <TouchableOpacity
                                            style={[styles.actionButton, { backgroundColor: theme.colors.primary, alignSelf: 'flex-end', width: '100%', borderRadius: 8 }]}
                                            onPress={() => {
                                                if (newRule.title.trim() && newRule.description.trim()) {
                                                    setLocalRules([...localRules, { id: Date.now().toString(), ...newRule, order: localRules.length }]);
                                                    setNewRule({ title: '', description: '' });
                                                    setShowAddRule(false);
                                                }
                                            }}
                                        >
                                            <Text style={styles.actionButtonText}>Aggiungi Regola</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={{ alignSelf: 'flex-end', padding: 10, marginBottom: 10 }}
                                    onPress={() => setShowAddRule(!showAddRule)}
                                >
                                    <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>
                                        {showAddRule ? '➖ Nascondi' : '➕ Nuova Regola'}
                                    </Text>
                                </TouchableOpacity>

                                <View style={styles.modalButtons}>
                                    <TouchableOpacity style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={() => setDatesModalVisible(false)}>
                                        <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={() => {
                                        showConfirmation(
                                            "Salva Regole Lega",
                                            `Vuoi salvare le modifiche alle regole del campionato ${leagueType === 'winter' ? 'Invernale' : 'Estivo'}?`,
                                            async () => {
                                                try {
                                                    await saveLeagueRules(leagueType, localRules);
                                                    setDatesModalVisible(false);
                                                    showAlert("Successo", "Regole salvate correttamente.");
                                                } catch (e) {
                                                    showAlert("Errore", "Impossibile salvare le regole.");
                                                }
                                            },
                                            "Salva"
                                        );
                                    }}>
                                        <Text style={styles.buttonText}>Salva</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {settingsTab === 'bonus' && (
                            <View style={{ flex: 1 }}>
                                <ScrollView style={styles.rulesList}>
                                    {localBonusDefinitions.map((def) => (
                                        <View key={def.id} style={styles.bonusOption}>
                                            {editingBonusId === def.id ? (
                                                <View style={{ flex: 1 }}>
                                                    <TextInput
                                                        style={[styles.input, { width: '100%', marginBottom: 10, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                                        value={editingBonusData.label}
                                                        onChangeText={t => setEditingBonusData({ ...editingBonusData, label: t })}
                                                        placeholder="Nome Bonus"
                                                        placeholderTextColor={theme.colors.textSecondary}
                                                    />
                                                    <TextInput
                                                        style={[styles.input, { width: '100%', marginBottom: 10, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                                        value={editingBonusData.points}
                                                        keyboardType="numeric"
                                                        onChangeText={t => setEditingBonusData({ ...editingBonusData, points: t })}
                                                        placeholder="Punti"
                                                        placeholderTextColor={theme.colors.textSecondary}
                                                    />
                                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 5 }}>
                                                        <TouchableOpacity onPress={() => setEditingBonusId(null)} style={{ marginRight: 15 }}>
                                                            <Text style={{ color: 'red' }}>Annulla</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => {
                                                            const points = parseInt(editingBonusData.points);
                                                            if (!isNaN(points) && editingBonusData.label.trim()) {
                                                                const updatedBonus = localBonusDefinitions.map(b => b.id === def.id ? { ...b, label: editingBonusData.label, points, type: points >= 0 ? 'bonus' : 'malus' as 'bonus' | 'malus' } : b);
                                                                setLocalBonusDefinitions(updatedBonus);
                                                                setEditingBonusId(null);
                                                            }
                                                        }}>
                                                            <Text style={{ color: 'green', fontWeight: 'bold' }}>OK</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ) : (
                                                <>
                                                    <Text style={[styles.optionLabel, { flex: 1, color: theme.colors.text }]}>{def.label}</Text>
                                                    <Text style={[styles.optionPoints, def.points > 0 ? { color: theme.colors.success } : { color: theme.colors.danger }]}>
                                                        {def.points > 0 ? '+' : ''}{def.points}
                                                    </Text>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setEditingBonusId(def.id);
                                                            setEditingBonusData({ label: def.label, points: def.points.toString() });
                                                        }}
                                                        style={{ marginLeft: 10, marginRight: 10 }}
                                                    >
                                                        <Text style={{ fontSize: 18, color: theme.colors.primary }}>✎</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => {
                                                        const updatedBonus = localBonusDefinitions.filter(b => b.id !== def.id);
                                                        setLocalBonusDefinitions(updatedBonus);
                                                    }} style={{ marginLeft: 10, backgroundColor: theme.colors.danger, borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' }}>
                                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>✕</Text>
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                        </View>
                                    ))}
                                </ScrollView>

                                {showAddBonus && (
                                    <View style={{ marginBottom: 10 }}>
                                        <TextInput
                                            style={[styles.input, { width: '100%', marginBottom: 10, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                            placeholder="Nome Bonus"
                                            placeholderTextColor={theme.colors.textSecondary}
                                            value={newBonusDef.label}
                                            onChangeText={t => setNewBonusDef({ ...newBonusDef, label: t })}
                                        />
                                        <TextInput
                                            style={[styles.input, { width: '100%', marginBottom: 10, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                            placeholder="Punti (es. 2 o -1)"
                                            placeholderTextColor={theme.colors.textSecondary}
                                            keyboardType="numeric"
                                            value={newBonusDef.points}
                                            onChangeText={t => setNewBonusDef({ ...newBonusDef, points: t })}
                                        />
                                        <TouchableOpacity
                                            style={[styles.actionButton, { backgroundColor: theme.colors.primary, alignSelf: 'flex-end', width: '100%', borderRadius: 8, height: 50, marginLeft: 0 }]}
                                            onPress={() => {
                                                if (newBonusDef.label.trim() && newBonusDef.points) {
                                                    const points = parseInt(newBonusDef.points);
                                                    const newBonusObj: BonusDefinition = {
                                                        id: Date.now().toString(),
                                                        label: newBonusDef.label,
                                                        points,
                                                        type: points >= 0 ? 'bonus' : 'malus'
                                                    };
                                                    setLocalBonusDefinitions([...localBonusDefinitions, newBonusObj]);
                                                    setNewBonusDef({ label: '', points: '', type: 'bonus' });
                                                    setShowAddBonus(false);
                                                }
                                            }}
                                        >
                                            <Text style={styles.actionButtonText}>Aggiungi Bonus</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={{ alignSelf: 'flex-end', padding: 10, marginBottom: 10 }}
                                    onPress={() => setShowAddBonus(!showAddBonus)}
                                >
                                    <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>
                                        {showAddBonus ? '➖ Nascondi' : '➕ Nuovo Bonus'}
                                    </Text>
                                </TouchableOpacity>
                                <View style={styles.modalButtons}>
                                    <TouchableOpacity style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={() => setDatesModalVisible(false)}>
                                        <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={() => {
                                        showConfirmation(
                                            "Salva Bonus Lega",
                                            `Vuoi salvare le modifiche ai bonus del campionato ${leagueType === 'winter' ? 'Invernale' : 'Estivo'}?`,
                                            async () => {
                                                try {
                                                    await saveBonusDefinitions(leagueType, localBonusDefinitions);
                                                    setDatesModalVisible(false);
                                                    showAlert("Successo", "Bonus salvati correttamente.");
                                                } catch (e) {
                                                    showAlert("Errore", "Impossibile salvare i bonus.");
                                                }
                                            },
                                            "Salva"
                                        );
                                    }}>
                                        <Text style={styles.buttonText}>Salva</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Date Pickers */}
            <DatePickerModal
                visible={showStartPicker}
                onClose={() => setShowStartPicker(false)}
                onSelectDate={handleDateSelect}
                initialDate={datesInput.startDate || undefined}
            />
            <DatePickerModal
                visible={showEndPicker}
                onClose={() => setShowEndPicker(false)}
                onSelectDate={handleDateSelect}
                initialDate={datesInput.endDate || undefined}
            />
            <DatePickerModal
                visible={showBonusDatePicker}
                onClose={() => setShowBonusDatePicker(false)}
                onSelectDate={(date) => {
                    if (activeTab === 'bonusList') {
                        setNewBonus(prev => ({ ...prev, date }));
                    } else {
                        const index = sortedEvents.findIndex(e => e.date === date);
                        if (index !== -1) {
                            setCurrentEventIndex(index);
                        } else {
                            // If no event on exact date, find next closest
                            const nextIndex = sortedEvents.findIndex(e => e.date > date);
                            if (nextIndex !== -1) {
                                setCurrentEventIndex(nextIndex);
                            } else if (sortedEvents.length > 0) {
                                setCurrentEventIndex(sortedEvents.length - 1);
                            }
                        }
                    }
                    setShowBonusDatePicker(false);
                }}
                initialDate={activeTab === 'bonusList' ? newBonus.date : bonusDate}
            />


        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        // backgroundColor: '#fff', // Removed hardcoded color
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee', // Consider changing this too if needed, but border color is usually handled inline or via theme prop
        alignItems: 'center',
    },
    headerTop: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    settingsButton: {
        position: 'absolute',
        right: 0,
        top: 0,
        padding: 5,
        zIndex: 10,
    },
    historyButton: {
        position: 'absolute',
        left: 0,
        top: 0,
        padding: 5,
        zIndex: 10,
    },
    settingsIcon: {
        fontSize: 24,
    },
    iconImage: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
    },
    toggleContainer: {
        flexDirection: 'row',
        // backgroundColor: '#f0f0f0', // Removed hardcoded color
        borderRadius: 20,
        padding: 4,
        marginTop: 10,
        width: '100%',
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 16,
    },
    toggleButtonActive: {
        // backgroundColor: '#fff', // Removed hardcoded color
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
    },
    toggleTextActive: {
        color: '#003399',
        fontWeight: 'bold',
    },
    toggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    toggleIcon: {
        width: 20,
        height: 20,
        marginRight: 5,
        resizeMode: 'contain',
    },
    countdownCard: {
        width: '100%',
        marginTop: 12,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    countdownHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    statusChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    statusChipText: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    dateRangeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    countdownBody: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    countdownSmallLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    countdownBigValue: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    countdownDescText: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 18,
    },
    countdownButtonsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardActionBtnPrimary: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
    },
    cardActionBtnSecondary: {
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    cardActionBtnTextPrimary: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    cardActionBtnTextSecondary: {
        fontWeight: '600',
        fontSize: 13,
    },
    countdownContainer: {
        marginTop: 15,
        alignItems: 'center',
        backgroundColor: '#e3f2fd',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#003399',
    },
    countdownLabel: {
        fontSize: 12,
        color: '#003399',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    countdownValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#003399',
    },
    podiumContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        marginVertical: 20,
        height: 180,
        paddingHorizontal: 20,
    },
    podiumPlace: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        flex: 1,
        marginHorizontal: 5,
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
        fontSize: 12,
        color: '#fff',
        marginTop: 2,
        fontWeight: '600',
    },
    historyNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 10,
    },
    historyNavButton: {
        padding: 10,
    },
    historyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    historySubtitle: {
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 5,
    },
    tabContainer: {
        flexDirection: 'row',
        marginTop: 15,
        width: '100%',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: '#003399',
    },
    tabText: {
        fontSize: 16,
        color: '#888',
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#003399',
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    rulesContainer: {
        padding: 15,
    },
    ruleCard: {
        // backgroundColor: '#fff', // Removed hardcoded color
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#eee',
    },
    ruleTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    ruleText: {
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
        marginBottom: 5,
    },
    tableHeader: {
        flexDirection: 'row',
        // backgroundColor: '#e3f2fd', // Removed hardcoded color
        paddingVertical: 10,
        paddingHorizontal: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    row: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        // backgroundColor: '#fff', // Removed hardcoded color
    },
    rowAlt: {
        backgroundColor: '#f9f9f9',
    },
    headerCell: {
        flex: 1,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#003399',
        textAlign: 'center',
    },
    cell: {
        flex: 1,
        fontSize: 12,
        color: '#333',
        textAlign: 'center',
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
        backgroundColor: 'transparent',
    },
    chipText: {
        fontSize: 14,
    },
    cellRank: {
        flex: 0.6,
        fontWeight: 'bold',
    },
    cellTeam: {
        flex: 3,
        textAlign: 'left',
        fontWeight: '600',
    },
    cellPoints: {
        flex: 1,
        fontWeight: 'bold',
        color: '#003399',
    },
    matchCard: {
        // backgroundColor: '#fff', // Removed hardcoded color
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#eee',
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    matchDate: {
        fontSize: 12,
        color: '#888',
    },
    matchRound: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    matchBody: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    teamName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    scoreText: {
        fontSize: 14,
        color: '#666',
    },
    // Daily View Styles
    dateNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        // backgroundColor: '#fff', // Removed hardcoded color
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    navButton: {
        padding: 10,
    },
    navIcon: {
        width: 24,
        height: 24,
        tintColor: '#003399',
    },
    dateDisplay: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#666',
        marginLeft: 15,
        marginTop: 15,
        marginBottom: 5,
    },
    attendeeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        // backgroundColor: '#fff', // Removed hardcoded color
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    attendeeInfo: {
        flex: 1,
    },
    attendeeName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    bonusTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    bonusTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginRight: 5,
        marginBottom: 2,
    },
    bonusTagPositive: {
        backgroundColor: '#e8f5e9',
    },
    malusTag: {
        backgroundColor: '#ffebee',
    },
    bonusTagText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#333',
    },
    emptyState: {
        padding: 30,
        alignItems: 'center',
    },
    emptyStateText: {
        color: '#888',
        fontSize: 16,
        textAlign: 'center',
    },
    modalContent: {
        width: '90%',
        maxWidth: 600,
        height: '80%', // Fixed height to ensure buttons are at the bottom
        // backgroundColor: '#fff', // Removed hardcoded color
        borderRadius: 20,
        padding: 20,
        overflow: 'hidden',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 20,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        // backgroundColor: '#f0f0f0', // Removed hardcoded color
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
        fontSize: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 5,
        marginLeft: 5,
    },
    dateInput: {
        // backgroundColor: '#f0f0f0', // Removed hardcoded color
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
    },
    dateInputText: {
        fontSize: 16,
        color: '#333',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'center', // Center the buttons
        marginTop: 10, // Reduced margin
        gap: 15, // Space between buttons
    },
    button: {
        flex: 1,
        maxWidth: 150, // Limit width for better look on large screens
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 25, // Rounded pill shape
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cancelButton: {
        // backgroundColor: '#fff', // Removed hardcoded color
        borderWidth: 1,
        borderColor: '#ddd',
    },
    saveButton: {
        backgroundColor: '#003399',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTabContainer: {
        flexDirection: 'row',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    modalTabActive: {
        borderBottomColor: '#003399',
    },
    modalTabText: {
        fontSize: 16,
        color: '#888',
        fontWeight: '600',
    },
    modalTabTextActive: {
        color: '#003399',
        fontWeight: 'bold',
    },
    optionLabel: {
        fontSize: 16,
        color: '#333',
    },
    optionPoints: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    dividerText: {
        textAlign: 'center',
        color: '#aaa',
        fontSize: 12,
        marginVertical: 10,
    },
    customInputContainer: {
        flexDirection: 'row',
        marginBottom: 10,
        alignItems: 'center',
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    actionButtonActive: {
        backgroundColor: '#003399',
    },
    actionButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#003399',
    },
    actionButtonTextActive: {
        color: '#fff',
    },
    rulesList: {
        flex: 1,
        marginBottom: 10,
    },
    ruleItem: {
        marginBottom: 15,
        padding: 10,
        // backgroundColor: '#f9f9f9', // Removed hardcoded color
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
        flexDirection: 'row',
        alignItems: 'center',
    },
    bonusOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    bonusOptionsList: {
        maxHeight: 300,
        marginBottom: 20,
    },
    closeButton: {
        backgroundColor: '#eee',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    closeButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    addButton: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#003399',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    // History Modal Styles
    historyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    historyDate: {
        fontSize: 14,
        flex: 1,
    },
    historyReason: {
        fontSize: 14,
        flex: 2,
        marginLeft: 10,
    },
    historyPoints: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
        width: 30,
        textAlign: 'right',
    },
});
