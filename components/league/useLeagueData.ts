import { useState, useEffect, useMemo, useCallback } from 'react';
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
} from '../../services/firestore';
import { showAlert, showConfirmation } from '../../utils/alert';
import { LeagueType, StandingItem, MemberHistoryItem } from './leagueTypes';

export function useLeagueData(initialLeagueType: LeagueType = 'winter') {
    const [leagueType, setLeagueType] = useState<LeagueType>(initialLeagueType);
    const [members, setMembers] = useState<Member[]>([]);
    const [bonuses, setBonuses] = useState<LeagueBonus[]>([]);
    const [leagueDates, setLeagueDates] = useState<LeagueDates | null>(null);
    const [events, setEvents] = useState<FirestoreEvent[]>([]);
    const [attendanceData, setAttendanceData] = useState<{ memberId: string, date: string }[]>([]);

    // Daily View State
    const [currentEventIndex, setCurrentEventIndex] = useState<number>(-1);
    const [sortedEvents, setSortedEvents] = useState<FirestoreEvent[]>([]);
    const [isLeagueArchived, setIsLeagueArchived] = useState(false);
    const [hasSetInitialDate, setHasSetInitialDate] = useState(false);

    // Derived state for current view
    const currentEvent = currentEventIndex >= 0 && currentEventIndex < sortedEvents.length ? sortedEvents[currentEventIndex] : null;
    const bonusDate = currentEvent ? currentEvent.date : new Date().toISOString().split('T')[0];

    const [dailyAttendees, setDailyAttendees] = useState<string[]>([]);
    const [rosterMembers, setRosterMembers] = useState<RosterMember[]>([]);

    const [rules, setRules] = useState<LeagueRule[]>([]);
    const [bonusDefinitions, setBonusDefinitions] = useState<BonusDefinition[]>([]);
    const [pastLeagues, setPastLeagues] = useState<PastLeague[]>([]);

    // Subscriptions
    useEffect(() => {
        const unsubscribeMembers = subscribeToMembers(setMembers);
        const unsubscribeBonuses = subscribeToLeagueBonuses(leagueType, setBonuses);
        const unsubscribeRules = subscribeToLeagueRules(leagueType, setRules);
        const unsubscribeBonusDefs = subscribeToBonusDefinitions(leagueType, setBonusDefinitions);
        const unsubscribeDates = subscribeToLeagueDates(leagueType, (dates) => {
            setLeagueDates(dates);
        });

        return () => {
            unsubscribeMembers();
            unsubscribeBonuses();
            unsubscribeRules();
            unsubscribeBonusDefs();
            unsubscribeDates();
        };
    }, [leagueType]);

    useEffect(() => {
        const unsubscribe = subscribeToPastLeagues(setPastLeagues);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (leagueDates && leagueDates.startDate && leagueDates.endDate) {
            const unsubscribeAttendance = subscribeToLeagueAttendance(leagueDates.startDate, leagueDates.endDate, setAttendanceData);
            return () => unsubscribeAttendance();
        } else {
            setAttendanceData([]);
        }
    }, [leagueDates]);

    useEffect(() => {
        const unsubscribePresenze = subscribeToPresenze(bonusDate, (ids) => {
            setDailyAttendees(ids);
        });
        return () => unsubscribePresenze();
    }, [bonusDate]);

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
                .sort((a, b) => a.date.localeCompare(b.date));

            let filteredEvents = validEvents;
            if (leagueDates && leagueDates.startDate && leagueDates.endDate) {
                filteredEvents = validEvents.filter(e => e.date >= leagueDates.startDate && e.date <= leagueDates.endDate);
            }

            setSortedEvents(filteredEvents);
            setEvents(fetchedEvents);

            if (!hasSetInitialDate && filteredEvents.length > 0 && leagueDates) {
                const today = new Date().toISOString().split('T')[0];
                let initialIndex = -1;
                for (let i = 0; i < filteredEvents.length; i++) {
                    if (filteredEvents[i].date <= today) {
                        initialIndex = i;
                    } else {
                        break;
                    }
                }

                if (initialIndex !== -1) {
                    setCurrentEventIndex(initialIndex);
                } else {
                    setCurrentEventIndex(0);
                }
                setHasSetInitialDate(true);
            } else if (hasSetInitialDate && currentEventIndex === -1 && filteredEvents.length > 0) {
                setCurrentEventIndex(0);
            }
        });
        return () => unsubscribeEvents();
    }, [leagueDates, hasSetInitialDate, currentEventIndex]);

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

    // Calculate Standings
    const standings: StandingItem[] = useMemo(() => {
        const stats: Record<string, StandingItem> = {};

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

        bonuses.forEach(bonus => {
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

        return sorted.map((item, index) => {
            let rank = index + 1;
            if (index > 0) {
                const prev = sorted[index - 1];
                if (prev.points === item.points && prev.attendanceCount === item.attendanceCount) {
                    rank = prev.rank || index + 1;
                }
            }
            item.rank = rank;
            return item;
        });
    }, [members, attendanceData, events, bonuses, leagueDates]);

    const changeDate = useCallback((direction: number) => {
        if (sortedEvents.length === 0) return;
        setCurrentEventIndex(prev => {
            let newIndex = prev + direction;
            if (newIndex < 0) newIndex = 0;
            if (newIndex >= sortedEvents.length) newIndex = sortedEvents.length - 1;
            return newIndex;
        });
    }, [sortedEvents.length]);

    const formatDateForDisplay = useCallback((isoDate?: string | null) => {
        if (!isoDate) return 'Seleziona data';
        const [year, month, day] = isoDate.split('-');
        return `${day}/${month}/${year}`;
    }, []);

    const handleAddBonus = useCallback(async (memberId: string, points: number, reason: string, date: string) => {
        try {
            await addLeagueBonus({
                memberId,
                points,
                reason,
                date,
                leagueType
            });
            return true;
        } catch (error) {
            showAlert("Errore", "Impossibile aggiungere il bonus.");
            return false;
        }
    }, [leagueType]);

    const handleDeleteBonus = useCallback(async (id: string) => {
        showConfirmation(
            "Elimina Bonus",
            "Sei sicuro?",
            () => deleteLeagueBonus(id, leagueType),
            "Elimina"
        );
    }, [leagueType]);

    const togglePresence = useCallback(async (memberId: string, hasPresence: boolean, isBubbaOnly: boolean) => {
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
    }, [bonuses, bonusDate, leagueType]);

    const handleSaveDates = useCallback(async (datesInput: { startDate: string, endDate: string }, onSuccess?: () => void) => {
        showConfirmation(
            "Conferma Modifica Date",
            `Vuoi aggiornare le date del campionato ${leagueType === 'winter' ? 'Invernale' : 'Estivo'}?`,
            async () => {
                try {
                    await updateLeagueDates(leagueType, datesInput);
                    if (onSuccess) onSuccess();
                    showAlert("Successo", "Date campionato aggiornate con successo.");
                } catch (error) {
                    showAlert("Errore", "Impossibile salvare le date.");
                }
            },
            "Salva Date"
        );
    }, [leagueType]);

    const handleArchiveLeague = useCallback(async () => {
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
                    const top3 = standings.slice(0, 3);
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
                        totalParticipants: standings.length,
                        bonuses: leagueBonuses,
                        standings: standings.map((s, index): PastLeagueMember => ({
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
    }, [leagueDates, isLeagueArchived, standings, bonuses, leagueType]);

    const handleArchiveAndResetLeague = useCallback(async () => {
        if (!leagueDates || !leagueDates.endDate) return;

        showConfirmation(
            "Archivia e Pulisci per Nuova Stagione",
            "I risultati, la classifica e i bonus verranno archiviati nello storico. La scheda attiva verrà azzerata per iniziare la nuova stagione. Confermi?",
            async () => {
                try {
                    const top3 = standings.slice(0, 3);
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
                        totalParticipants: standings.length,
                        bonuses: leagueBonuses,
                        standings: standings.map((s, index): PastLeagueMember => ({
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
    }, [leagueDates, standings, bonuses, leagueType]);

    const handleResetLeagueOnly = useCallback(async () => {
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
    }, [leagueType]);

    const getMemberHistory = useCallback((memberId: string): MemberHistoryItem[] => {
        const history: MemberHistoryItem[] = [];

        attendanceData.filter(a => a.memberId === memberId).forEach(record => {
            const event = events.find(e => e.date === record.date);
            history.push({
                date: record.date,
                points: 2,
                reason: event ? (event.title || 'Presenza') : 'Presenza',
                type: 'attendance'
            });
        });

        bonuses.filter(b => b.memberId === memberId).forEach(bonus => {
            history.push({
                date: bonus.date,
                points: bonus.points,
                reason: bonus.reason,
                type: bonus.points >= 0 ? 'bonus' : 'malus'
            });
        });

        return history.sort((a, b) => b.date.localeCompare(a.date));
    }, [attendanceData, events, bonuses]);

    return {
        leagueType,
        setLeagueType,
        members,
        bonuses,
        leagueDates,
        events,
        sortedEvents,
        currentEventIndex,
        setCurrentEventIndex,
        currentEvent,
        bonusDate,
        dailyAttendees,
        rosterMembers,
        rules,
        bonusDefinitions,
        pastLeagues,
        isLeagueArchived,
        standings,
        changeDate,
        formatDateForDisplay,
        handleAddBonus,
        handleDeleteBonus,
        togglePresence,
        handleSaveDates,
        handleArchiveLeague,
        handleArchiveAndResetLeague,
        handleResetLeagueOnly,
        getMemberHistory
    };
}
