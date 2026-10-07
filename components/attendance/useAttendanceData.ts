import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
    isMemberActiveAtDate,
} from '../../services/firestore';
import { showAlert, showConfirmation } from '../../utils/alert';
import { ViewMode, MemberHistoryData } from './attendanceTypes';

export function useAttendanceData(stagioneCorrente: string, isBubbaOnly?: boolean) {
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
    const [selectedMemberHistory, setSelectedMemberHistory] = useState<MemberHistoryData | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Counts per season Campo and Palestra
    const [seasonCountsCampo, setSeasonCountsCampo] = useState<Record<string, number>>({});
    const [seasonCountsPalestra, setSeasonCountsPalestra] = useState<Record<string, number>>({});
    const seasonCounts = viewMode === 'Campo' ? seasonCountsCampo : seasonCountsPalestra;

    // Ranking Modal State
    const [rankingModalVisible, setRankingModalVisible] = useState(false);
    const [rankingMode, setRankingMode] = useState<ViewMode>('Campo');

    // Guest Modal State
    const [newGuestName, setNewGuestName] = useState('');
    const [guestModalVisible, setGuestModalVisible] = useState(false);

    // 1. Subscribe to Events
    useEffect(() => {
        const unsubscribeEvents = subscribeToEvents((events) => {
            setAllEvents(events);
        }, stagioneCorrente);
        return () => unsubscribeEvents();
    }, [stagioneCorrente]);

    // 2. Auto-Navigation Logic
    const lastAutoDateRef = useRef<string | null>(null);

    const checkAutoNavigation = useCallback(() => {
        if (allEvents.length === 0) return;
        const today = new Date().toISOString().split('T')[0];

        if (lastAutoDateRef.current === today) {
            return;
        }

        const allTrainings = allEvents.filter(e =>
            e.type === 'Campo' || e.type === 'Palestra' || e.type === 'training'
        );
        allTrainings.sort((a, b) => a.date.localeCompare(b.date));

        const nextEvent = allTrainings.find(e => e.date >= today) || allTrainings[allTrainings.length - 1];
        if (!nextEvent) return;

        const targetMode: ViewMode = nextEvent.type === 'Palestra' ? 'Palestra' : 'Campo';

        const filteredEvents = allEvents.filter(event => {
            const isTraining = event.type === 'Campo' || event.type === 'Palestra' || event.type === 'training';
            if (!isTraining) return false;
            return targetMode === 'Campo'
                ? (event.type === 'Campo' || event.type === 'training')
                : (event.type === 'Palestra');
        });
        const dates = Array.from(new Set(filteredEvents.map(e => e.date))).sort();

        let targetDate = '';
        if (dates.length > 0) {
            targetDate = dates.find(d => d >= today) || dates[dates.length - 1];
        }

        setViewMode(targetMode);
        setAvailableDates(dates);
        if (targetDate) setCurrentDate(targetDate);

        lastAutoDateRef.current = today;
    }, [allEvents]);

    useEffect(() => {
        checkAutoNavigation();
    }, [allEvents, checkAutoNavigation]);

    useFocusEffect(
        useCallback(() => {
            checkAutoNavigation();
        }, [checkAutoNavigation])
    );

    // 3. React to ViewMode manual toggle
    useEffect(() => {
        if (allEvents.length === 0) return;

        const filteredEvents = allEvents.filter(event => {
            const isTraining = event.type === 'Campo' || event.type === 'Palestra' || event.type === 'training';
            if (!isTraining) return false;
            return viewMode === 'Campo'
                ? (event.type === 'Campo' || event.type === 'training')
                : (event.type === 'Palestra');
        });

        const dates = Array.from(new Set(filteredEvents.map(e => e.date))).sort();
        setAvailableDates(dates);

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

    // 4. Season Attendance counts subscription
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

    // 5. Training stats
    useEffect(() => {
        getTrainingStats('', viewMode, stagioneCorrente).then(setStats);
    }, [viewMode, stagioneCorrente]);

    // 6. Subscriptions per sessione selezionata
    useEffect(() => {
        if (!currentDate) {
            setSession(null);
            setAttendeeIds([]);
            return;
        }

        const unsubscribeMembers = subscribeToMembers((updatedMembers) => {
            setMembers(updatedMembers);
        }, true);

        const unsubscribeSession = subscribeToSession(currentDate, (updatedSession) => {
            setSession(updatedSession);
            setLoading(false);
        });

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
            getTrainingStats('', viewMode, stagioneCorrente).then(setStats);
        } catch (error: any) {
            console.error('Error toggling presence:', error);
            showAlert('Errore', 'Impossibile aggiornare la presenza: ' + (error?.message || ''));
        }
    };

    const handleAddGuest = async () => {
        const targetDate = session?.id || currentDate;
        if (!targetDate || !newGuestName.trim()) return;
        try {
            await addGuestToSession(targetDate, newGuestName.trim());
            setNewGuestName('');
            setGuestModalVisible(false);
        } catch (error: any) {
            showAlert('Errore', "Impossibile aggiungere l'ospite: " + (error?.message || ''));
        }
    };

    const handleRemoveGuest = async (guestName: string) => {
        const targetDate = session?.id || currentDate;
        if (!targetDate) return;
        showConfirmation(
            'Rimuovi Ospite',
            `Vuoi rimuovere ${guestName}?`,
            async () => {
                try {
                    await removeGuestFromSession(targetDate, guestName);
                } catch (error: any) {
                    showAlert('Errore', "Impossibile rimuovere l'ospite: " + (error?.message || ''));
                }
            },
            'Rimuovi'
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

            const pastEvents = allEvents.filter(e => {
                if (e.date >= today) return false;
                if (viewMode === 'Campo') {
                    return e.type === 'Campo' || e.type === 'training';
                } else {
                    return e.type === 'Palestra';
                }
            });

            const history = pastEvents.map(event => ({
                date: event.date,
                present: attendedDates.includes(event.date),
                type: event.type,
            }));

            history.sort((a, b) => b.date.localeCompare(a.date));

            let currentStreak = 0;
            let maxStreak = 0;
            let tempStreak = 0;

            const ascendingHistory = [...history].reverse();

            for (const s of ascendingHistory) {
                if (s.present) {
                    tempStreak++;
                    maxStreak = Math.max(maxStreak, tempStreak);
                } else {
                    tempStreak = 0;
                }
            }

            for (const s of history) {
                if (s.present) {
                    currentStreak++;
                } else {
                    break;
                }
            }

            setSelectedMemberHistory({ member, history, currentStreak, maxStreak });
        } catch {
            showAlert('Errore', 'Impossibile recuperare lo storico presenze.');
        } finally {
            setLoadingHistory(false);
        }
    };

    // Filter active members for current date
    const filteredMembers = members.filter(m => {
        if (attendeeIds.includes(m.id)) return true;
        return isMemberActiveAtDate(m, currentDate);
    });

    const men = filteredMembers.filter(m => m.gender === 'M');
    const women = filteredMembers.filter(m => m.gender === 'F');

    return {
        members,
        session,
        attendeeIds,
        loading,
        currentDate,
        stats,
        viewMode,
        setViewMode,
        expandedSections,
        toggleSection,
        availableDates,
        goToPreviousSession,
        goToNextSession,
        togglePresence,
        seasonCounts,
        seasonCountsCampo,
        seasonCountsPalestra,
        men,
        women,
        // Guest modal & actions
        newGuestName,
        setNewGuestName,
        guestModalVisible,
        setGuestModalVisible,
        handleAddGuest,
        handleRemoveGuest,
        // History modal
        historyModalVisible,
        setHistoryModalVisible,
        selectedMemberHistory,
        loadingHistory,
        handleOpenHistory,
        // Ranking modal
        rankingModalVisible,
        setRankingModalVisible,
        rankingMode,
        setRankingMode,
    };
}
