import { useState, useEffect, useMemo } from 'react';
import { MatchAnalysis, Member, Event } from '../../services/firestore/types';
import { subscribeToMatchAnalysis, deleteMatchAnalysis, updateMatchAnalysis } from '../../services/firestore/matchAnalysis';
import { subscribeToMembers } from '../../services/firestore/members';
import { subscribeToEvents } from '../../services/firestore/calendar';
import { derive, playerStats } from '../../utils/statsEngine';
import { exportAndDownloadXLSX } from '../../utils/matchExporter';
import { showConfirmation, showAlert } from '../../utils/alert';
import { getEventDays } from '../../screens/AnalisiPartitaScreen';
import { SortKey, PlayerStatRow, TeamStatsSummary } from './tournamentDetailTypes';

export function useTournamentDetailData(tournamentName: string) {
    const [allMatches, setAllMatches] = useState<MatchAnalysis[]>([]);
    const [allMembers, setAllMembers] = useState<Member[]>([]);
    const [allEvents, setAllEvents] = useState<Event[]>([]);
    const [activeTab, setActiveTab] = useState<'matches' | 'stats'>('matches');
    const [sortKey, setSortKey] = useState<SortKey>('plusMinus');
    const [sortAsc, setSortAsc] = useState<boolean>(false);

    // Gestione Modifica Data Partita
    const [dateEditingMatch, setDateEditingMatch] = useState<MatchAnalysis | null>(null);
    const [showDatePickerModal, setShowDatePickerModal] = useState<boolean>(false);

    // Gestione Modifica Manuale Tocchi Partita
    const [editingTouchesMatch, setEditingTouchesMatch] = useState<MatchAnalysis | null>(null);

    // Gestione Collegamento Torneo ad Evento Calendario
    const [linkModalVisible, setLinkModalVisible] = useState<boolean>(false);

    useEffect(() => {
        const unsubMatches = subscribeToMatchAnalysis(setAllMatches);
        const unsubMembers = subscribeToMembers(setAllMembers);
        const unsubEvents = subscribeToEvents(setAllEvents);
        return () => {
            unsubMatches();
            unsubMembers();
            unsubEvents();
        };
    }, []);

    // Filtra partite appartenenti a questo torneo
    const tournamentMatches = useMemo(() => {
        const filtered = allMatches.filter(m =>
            !m.isSingleMatch &&
            m.eventName &&
            m.eventName.trim().toLowerCase() === tournamentName.trim().toLowerCase()
        );
        filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return filtered;
    }, [allMatches, tournamentName]);

    // Trova l'evento a calendario collegato o associato per nome
    const isTournamentOrChampionship = (type?: string) => {
        const t = (type || '').toLowerCase();
        return t === 'tournament' || t === 'torneo' || t === 'championship' || t === 'campionato' || t === 'championship_season';
    };

    const tournamentEvent = useMemo(() => {
        const evId = tournamentMatches.find(m => m.eventId)?.eventId;
        if (evId) {
            const found = allEvents.find(e => e.id === evId);
            if (found) return found;
        }
        const norm = tournamentName.trim().toLowerCase();
        return allEvents.find(e => {
            return isTournamentOrChampionship(e.type) && (e.title || '').trim().toLowerCase() === norm;
        }) ||
        allEvents.find(e => {
            if (!isTournamentOrChampionship(e.type)) return false;
            const title = (e.title || '').trim().toLowerCase();
            return title.includes(norm) || norm.includes(title);
        }) ||
        null;
    }, [allEvents, tournamentMatches, tournamentName]);

    const tournamentCalendarEvents = useMemo(() => {
        return allEvents.filter(ev => isTournamentOrChampionship(ev.type));
    }, [allEvents]);

    const tournamentDays = useMemo(() => {
        if (tournamentEvent) {
            return getEventDays(tournamentEvent);
        }
        return [];
    }, [tournamentEvent]);

    const playerMap = useMemo(() => {
        const map: Record<string, { name: string; g: 'M' | 'F' }> = {};
        for (const m of allMembers) {
            map[m.id] = {
                name: (m.nickname && m.nickname.trim()) ? m.nickname.trim() : m.firstName,
                g: m.gender === 'F' ? 'F' : 'M'
            };
        }
        for (const match of tournamentMatches) {
            if (match.customRoster) {
                for (const p of match.customRoster) {
                    const mem = allMembers.find(m => m.id === p.id);
                    const rawG = (p as any).g || (p as any).gender;
                    const assignedG: 'M' | 'F' = mem?.gender ? (mem.gender === 'F' ? 'F' : 'M') : ((rawG === 'F' || rawG === 'f') ? 'F' : 'M');
                    const displayName = (mem && mem.nickname && mem.nickname.trim()) ? mem.nickname.trim() : (mem?.firstName || p.name);
                    map[p.id] = {
                        name: displayName,
                        g: assignedG
                    };
                }
            }
        }
        return map;
    }, [allMembers, tournamentMatches]);

    const { teamStatsSummary, aggregatedPlayerStats } = useMemo(() => {
        let wins = 0;
        let losses = 0;
        let ties = 0;
        let ourTotalGoals = 0;
        let theirTotalGoals = 0;
        let hasLive = false;

        const gamesForEngine: { pullFirst?: 'us' | 'them'; events?: any[]; manualTouches?: Record<string, number> }[] = [];

        for (const m of tournamentMatches) {
            if (m.status === 'live') hasLive = true;

            let us = m.ourScore || 0;
            let them = m.theirScore || 0;

            if (m.events && m.events.length) {
                const st = derive(m);
                us = st.score.us;
                them = st.score.them;
            }
            gamesForEngine.push({ pullFirst: m.pullFirst, events: m.events, manualTouches: m.manualTouches });

            ourTotalGoals += us;
            theirTotalGoals += them;

            if (m.status === 'completed') {
                if (us > them) wins++;
                else if (us < them) losses++;
                else ties++;
            }
        }

        const pStats = playerStats(gamesForEngine);

        const playerList: PlayerStatRow[] = [];
        for (const id in pStats) {
            const memberInfo = playerMap[id];
            playerList.push({
                ...pStats[id],
                id,
                name: memberInfo?.name || id,
                g: memberInfo?.g || 'M',
            });
        }

        return {
            teamStatsSummary: {
                totalMatches: tournamentMatches.length,
                wins,
                losses,
                ties,
                ourTotalGoals,
                theirTotalGoals,
                goalDiff: ourTotalGoals - theirTotalGoals,
                hasLive,
            } as TeamStatsSummary,
            aggregatedPlayerStats: playerList,
        };
    }, [tournamentMatches, playerMap]);

    const sortedPlayerStats = useMemo(() => {
        const list = [...aggregatedPlayerStats];
        list.sort((a, b) => {
            if (sortKey === 'name') {
                return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            const valA = a[sortKey] ?? 0;
            const valB = b[sortKey] ?? 0;
            if (valA === valB) {
                return b.goals - a.goals;
            }
            return sortAsc ? (valA - valB) : (valB - valA);
        });
        return list;
    }, [aggregatedPlayerStats, sortKey, sortAsc]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortAsc(!sortAsc);
        } else {
            setSortKey(key);
            setSortAsc(false);
        }
    };

    const handleExportExcel = async () => {
        try {
            if (!tournamentMatches.length) {
                showAlert("Nessuna partita", "Non ci sono partite da esportare in questo torneo.");
                return;
            }
            await exportAndDownloadXLSX(tournamentMatches, playerMap);
            showAlert("Esportazione completata", `Il foglio Excel di "${tournamentName}" è stato scaricato.`);
        } catch (error: any) {
            showAlert("Errore Esportazione", error?.message || "Impossibile esportare il file.");
        }
    };

    const handleDeleteMatch = (id: string) => {
        showConfirmation(
            "Elimina Partita",
            "Sei sicuro di voler eliminare questa partita del torneo?",
            () => deleteMatchAnalysis(id),
            "Elimina"
        );
    };

    const handleUpdateMatchDate = async (matchId: string, newDate: string) => {
        try {
            await updateMatchAnalysis({
                id: matchId,
                date: newDate,
            });
            setDateEditingMatch(null);
            setShowDatePickerModal(false);
            showAlert("Data Aggiornata", `La data della partita è stata impostata con successo.`);
        } catch {
            showAlert("Errore", "Impossibile aggiornare la data della partita.");
        }
    };

    const handleLinkTournamentToEvent = async (ev: Event) => {
        try {
            for (const m of tournamentMatches) {
                await updateMatchAnalysis({
                    id: m.id,
                    eventId: ev.id,
                    eventName: ev.title,
                    ...(ev.surface ? { surface: ev.surface } : {})
                });
            }
            setLinkModalVisible(false);
            showAlert("Torneo Collegato", `Tutte le partite di "${tournamentName}" sono ora collegate all'evento di calendario "${ev.title}".`);
        } catch {
            showAlert("Errore", "Impossibile collegare il torneo all'evento di calendario.");
        }
    };

    return {
        tournamentMatches,
        tournamentEvent,
        tournamentCalendarEvents,
        tournamentDays,
        playerMap,
        activeTab,
        setActiveTab,
        sortKey,
        sortAsc,
        handleSort,
        teamStatsSummary,
        sortedPlayerStats,
        handleExportExcel,
        handleDeleteMatch,
        // Modals
        dateEditingMatch,
        setDateEditingMatch,
        showDatePickerModal,
        setShowDatePickerModal,
        handleUpdateMatchDate,
        editingTouchesMatch,
        setEditingTouchesMatch,
        linkModalVisible,
        setLinkModalVisible,
        handleLinkTournamentToEvent,
    };
}
