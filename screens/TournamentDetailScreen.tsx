import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ScrollView,
    Animated,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSeason } from '../context/SeasonContext';
import { MatchAnalysis, Member, Event } from '../services/firestore/types';
import { subscribeToMatchAnalysis, deleteMatchAnalysis, updateMatchAnalysis } from '../services/firestore/matchAnalysis';
import { subscribeToMembers } from '../services/firestore/members';
import { subscribeToEvents } from '../services/firestore/calendar';
import { derive, playerStats, PlayerStats } from '../utils/statsEngine';
import { exportAndDownloadXLSX } from '../utils/matchExporter';
import ScreenTitle from '../components/ScreenTitle';
import { showConfirmation, showAlert } from '../utils/alert';
import { getEventDays, formatTournamentDay } from './AnalisiPartitaScreen';
import DatePickerModal from '../components/DatePickerModal';
import EditTouchesModal from '../components/EditTouchesModal';

type TournamentDetailRouteProp = RouteProp<RootStackParamList, 'TournamentDetail'>;

type SortKey = 'name' | 'pts' | 'goals' | 'ast' | 'ds' | 'toTot' | 'plusMinus' | 'touches';

export default function TournamentDetailScreen() {
    const { theme } = useTheme();
    const { isStaff } = useAuth();
    const { stagioneCorrente } = useSeason();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<TournamentDetailRouteProp>();

    const tournamentName = route.params?.tournamentName || 'Torneo';

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

    // Trova l'evento a calendario collegato o associato per nome (tornei e campionati)
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

    // Eventi di calendario filtrati: tornei e campionati
    const tournamentCalendarEvents = useMemo(() => {
        return allEvents.filter(ev => isTournamentOrChampionship(ev.type));
    }, [allEvents]);

    // Giorni del torneo
    const tournamentDays = useMemo(() => {
        if (tournamentEvent) {
            return getEventDays(tournamentEvent);
        }
        return [];
    }, [tournamentEvent]);

    // Mappa giocatori ID -> { name, g } con priorità al soprannome
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

    // Calcolo statistiche aggregate del torneo
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

        const playerList: (PlayerStats & { id: string; name: string; g: 'M' | 'F' })[] = [];
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
            },
            aggregatedPlayerStats: playerList,
        };
    }, [tournamentMatches, playerMap]);

    // Ordinamento statistiche giocatori
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
            showAlert("Data Aggiornata", `La data della partita è stata impostata su: ${formatDate(newDate)}.`);
        } catch (err) {
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
        } catch (err) {
            showAlert("Errore", "Impossibile collegare il torneo all'evento di calendario.");
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const LivePulseBadge = () => {
        const fadeAnim = useRef(new Animated.Value(0)).current;
        useEffect(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                    Animated.timing(fadeAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
                ])
            ).start();
        }, []);

        return (
            <View style={styles.liveIndicator}>
                <Animated.View style={[styles.liveDot, { opacity: fadeAnim }]} />
                <Text style={styles.liveText}>LIVE</Text>
            </View>
        );
    };

    const renderMatchItem = ({ item }: { item: MatchAnalysis }) => {
        const isLive = item.status === 'live';
        const derived = item.events && item.events.length ? derive(item) : null;
        const ourScore = derived ? derived.score.us : (item.ourScore || 0);
        const theirScore = derived ? derived.score.them : (item.theirScore || 0);

        return (
            <View style={[styles.matchCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <TouchableOpacity
                    style={styles.cardContent}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('LiveMatch', { matchId: item.id, initialMatch: item })}
                >
                    <View style={styles.matchHeader}>
                        <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
                            {formatDate(item.date)}
                        </Text>
                        {isLive ? (
                            <LivePulseBadge />
                        ) : (
                            <View style={styles.completedBadge}>
                                <Text style={styles.completedBadgeText}>Completata</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.matchBody}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={[styles.opponentText, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                                Bubba vs {item.opponent}
                            </Text>
                            <View style={styles.matchBadges}>
                                <Text style={[styles.detailBadge, { backgroundColor: item.surface === 'sabbia' ? '#ffe0b2' : '#c8e6c9' }]}>
                                    {item.surface === 'sabbia' ? '🏖️ Sabbia' : '🌱 Erba'}
                                </Text>
                                <Text style={[styles.detailBadge, { backgroundColor: '#e3f2fd' }]}>
                                    {item.firstRatio === 'F' ? '3F / 2M' : '3M / 2F'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.scoreContainer}>
                            <Text style={[styles.scoreText, { color: theme.colors.primary }]}>
                                {ourScore} - {theirScore}
                            </Text>
                            <Text style={styles.scoreSubText}>
                                {item.events?.length ? `${item.events.length} eventi` : '0 eventi'}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {isStaff && (
                    <View style={[styles.cardActions, { borderTopColor: theme.colors.border }]}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => setEditingTouchesMatch(item)}
                        >
                            <Text style={{ color: '#E07A1F', fontWeight: '600' }}>🥏 Tocchi</Text>
                        </TouchableOpacity>
                        <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => setDateEditingMatch(item)}
                        >
                            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>📅 Data</Text>
                        </TouchableOpacity>
                        <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => exportAndDownloadXLSX([item], playerMap)}
                        >
                            <Text style={{ color: '#2E8540', fontWeight: '600' }}>📊 Excel Partita</Text>
                        </TouchableOpacity>
                        <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleDeleteMatch(item.id)}
                        >
                            <Text style={{ color: theme.colors.danger, fontWeight: '600' }}>Elimina</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <ScreenTitle title={tournamentName.toUpperCase()} onBack={() => navigation.goBack()} />
            </View>

            {/* Quick Action / Stats Bar */}
            <View style={[styles.actionBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity
                    style={[styles.actionChip, { backgroundColor: '#2E8540' }]}
                    onPress={handleExportExcel}
                    activeOpacity={0.8}
                >
                    <Text style={styles.actionChipText}>📊 Esporta Excel Torneo</Text>
                </TouchableOpacity>

                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[
                            styles.tabButton,
                            activeTab === 'matches' && { backgroundColor: theme.colors.primary }
                        ]}
                        onPress={() => setActiveTab('matches')}
                    >
                        <Text style={[
                            styles.tabText,
                            activeTab === 'matches' && { color: '#fff', fontWeight: 'bold' }
                        ]}>
                            Partite ({tournamentMatches.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.tabButton,
                            activeTab === 'stats' && { backgroundColor: theme.colors.primary }
                        ]}
                        onPress={() => setActiveTab('stats')}
                    >
                        <Text style={[
                            styles.tabText,
                            activeTab === 'stats' && { color: '#fff', fontWeight: 'bold' }
                        ]}>
                            Statistiche
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content Tabs */}
            {activeTab === 'matches' ? (
                <FlatList
                    data={tournamentMatches}
                    keyExtractor={item => item.id}
                    renderItem={renderMatchItem}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={styles.summaryRow}>
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryNumber, { color: theme.colors.text }]}>
                                        {teamStatsSummary.totalMatches}
                                    </Text>
                                    <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Partite</Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryNumber, { color: '#2e7d32' }]}>
                                        {teamStatsSummary.wins}V - {teamStatsSummary.losses}P
                                    </Text>
                                    <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Bilancio</Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryItem}>
                                    <Text style={[
                                        styles.summaryNumber,
                                        { color: teamStatsSummary.goalDiff >= 0 ? '#2e7d32' : theme.colors.danger }
                                    ]}>
                                        {teamStatsSummary.ourTotalGoals} - {teamStatsSummary.theirTotalGoals}
                                    </Text>
                                    <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                                        Diff ({teamStatsSummary.goalDiff >= 0 ? `+${teamStatsSummary.goalDiff}` : teamStatsSummary.goalDiff})
                                    </Text>
                                </View>
                            </View>

                            {/* Sezione Collegamento Torneo / Date Calendario */}
                            {tournamentEvent ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary }}>
                                            📅 A CALENDARIO: {tournamentEvent.title}
                                        </Text>
                                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>
                                            {formatDate(tournamentEvent.date)}{tournamentEvent.endDate && tournamentEvent.endDate !== tournamentEvent.date ? ` – ${formatDate(tournamentEvent.endDate)}` : ''}
                                            {tournamentDays.length > 1 ? ` (${tournamentDays.length} giorni)` : ''}
                                        </Text>
                                    </View>
                                    {isStaff && (
                                        <TouchableOpacity
                                            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: theme.colors.primary + '15', borderWidth: 1, borderColor: theme.colors.primary + '40' }}
                                            onPress={() => setLinkModalVisible(true)}
                                        >
                                            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.primary }}>Cambia Evento</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ) : (
                                isStaff && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: '#FFFBEB', padding: 8, borderRadius: 8 }}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#B45309' }}>
                                                Torneo non collegato al Calendario
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#78350F' }}>
                                                Collega a un evento per prelevare automaticamente le date.
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#B45309' }}
                                            onPress={() => setLinkModalVisible(true)}
                                        >
                                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#fff' }}>🔗 Collega</Text>
                                        </TouchableOpacity>
                                    </View>
                                )
                            )}
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                Nessuna partita associata a questo torneo.
                            </Text>
                        </View>
                    }
                />
            ) : (
                /* Tab Statistiche Aggregate */
                <ScrollView contentContainerStyle={styles.statsScrollContent}>
                    {/* Team KPI Cards */}
                    <View style={styles.kpiGrid}>
                        <View style={[styles.kpiCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <Text style={[styles.kpiValue, { color: theme.colors.primary }]}>{teamStatsSummary.ourTotalGoals}</Text>
                            <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>Mete Segnate</Text>
                        </View>
                        <View style={[styles.kpiCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <Text style={[styles.kpiValue, { color: theme.colors.text }]}>{teamStatsSummary.theirTotalGoals}</Text>
                            <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>Mete Subite</Text>
                        </View>
                        <View style={[styles.kpiCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <Text style={[styles.kpiValue, { color: teamStatsSummary.goalDiff >= 0 ? '#2e7d32' : theme.colors.danger }]}>
                                {teamStatsSummary.goalDiff >= 0 ? `+${teamStatsSummary.goalDiff}` : teamStatsSummary.goalDiff}
                            </Text>
                            <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>Differenza Mete</Text>
                        </View>
                        <View style={[styles.kpiCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <Text style={[styles.kpiValue, { color: '#2e7d32' }]}>{teamStatsSummary.wins}</Text>
                            <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>Vittorie</Text>
                        </View>
                    </View>

                    {/* Tabella Statistiche Giocatori */}
                    <View style={[styles.tableContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <Text style={[styles.tableTitle, { color: theme.colors.text }]}>Classifica Giocatori Torneo</Text>
                        <Text style={[styles.tableSub, { color: theme.colors.textSecondary }]}>
                            Tocca l'intestazione di colonna per ordinare
                        </Text>

                        {/* Intestazione Colonne */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                            <View>
                                <View style={[styles.tableRow, styles.tableHeaderRow, { borderBottomColor: theme.colors.border }]}>
                                    <TouchableOpacity style={[styles.cellCol, styles.colName]} onPress={() => handleSort('name')}>
                                        <Text style={styles.headerCellText}>Giocatore {sortKey === 'name' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => handleSort('pts')}>
                                        <Text style={styles.headerCellText}>Punti {sortKey === 'pts' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => handleSort('goals')}>
                                        <Text style={styles.headerCellText}>Mete {sortKey === 'goals' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => handleSort('ast')}>
                                        <Text style={styles.headerCellText}>Assist {sortKey === 'ast' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => handleSort('ds')}>
                                        <Text style={styles.headerCellText}>Difese {sortKey === 'ds' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => handleSort('toTot')}>
                                        <Text style={styles.headerCellText}>TO {sortKey === 'toTot' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => handleSort('touches')}>
                                        <Text style={styles.headerCellText}>Tocchi {sortKey === 'touches' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => handleSort('plusMinus')}>
                                        <Text style={[styles.headerCellText, { color: theme.colors.primary }]}>+/- {sortKey === 'plusMinus' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                                    </TouchableOpacity>
                                </View>

                                {sortedPlayerStats.map((p, idx) => (
                                    <View
                                        key={p.id}
                                        style={[
                                            styles.tableRow,
                                            {
                                                backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                                borderBottomColor: theme.colors.border
                                            }
                                        ]}
                                    >
                                        <View style={[styles.cellCol, styles.colName, { flexDirection: 'row', alignItems: 'center' }]}>
                                            <Text style={[styles.genderTag, { color: p.g === 'F' ? '#e91e63' : '#1976d2' }]}>
                                                {p.g}
                                            </Text>
                                            <Text style={[styles.cellText, { color: theme.colors.text, fontWeight: '600' }]} numberOfLines={1}>
                                                {p.name}
                                            </Text>
                                        </View>
                                        <Text style={[styles.cellCol, styles.colNum, styles.cellText, { color: theme.colors.textSecondary }]}>
                                            {p.pts}
                                        </Text>
                                        <Text style={[styles.cellCol, styles.colNum, styles.cellText, { color: '#2e7d32', fontWeight: 'bold' }]}>
                                            {p.goals}
                                        </Text>
                                        <Text style={[styles.cellCol, styles.colNum, styles.cellText, { color: '#0288d1', fontWeight: 'bold' }]}>
                                            {p.ast}
                                        </Text>
                                        <Text style={[styles.cellCol, styles.colNum, styles.cellText, { color: '#7b1fa2', fontWeight: 'bold' }]}>
                                            {p.ds}
                                        </Text>
                                        <Text style={[styles.cellCol, styles.colNum, styles.cellText, { color: theme.colors.danger }]}>
                                            {p.toTot}
                                        </Text>
                                        <Text style={[styles.cellCol, styles.colNum, styles.cellText, { color: theme.colors.textSecondary }]}>
                                            {p.touches ?? 0}
                                        </Text>
                                        <Text style={[styles.cellCol, styles.colNum, styles.cellText, { color: p.plusMinus >= 0 ? '#2e7d32' : theme.colors.danger, fontWeight: 'bold' }]}>
                                            {p.plusMinus > 0 ? `+${p.plusMinus}` : p.plusMinus}
                                        </Text>
                                    </View>
                                ))}

                                {sortedPlayerStats.length === 0 && (
                                    <View style={{ padding: 20, alignItems: 'center' }}>
                                        <Text style={{ color: theme.colors.textSecondary }}>
                                            Nessun evento registrato nelle partite del torneo.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    </View>
                </ScrollView>
            )}

            {/* Modal Selezione Rapida Giorno Partita per il Torneo */}
            <Modal
                visible={!!dateEditingMatch && !showDatePickerModal}
                animationType="fade"
                transparent
                onRequestClose={() => setDateEditingMatch(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            📅 Data Partita Torneo
                        </Text>
                        <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                            Bubba vs {dateEditingMatch?.opponent} • Data attuale: {formatDate(dateEditingMatch?.date || '')}
                        </Text>

                        {tournamentDays.length > 0 ? (
                            <View style={{ marginTop: 12 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text, marginBottom: 8 }}>
                                    Seleziona il giorno della partita tra quelli del torneo:
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {tournamentDays.map((dayStr, idx) => {
                                        const isSelected = dateEditingMatch?.date === dayStr;
                                        return (
                                            <TouchableOpacity
                                                key={dayStr}
                                                style={[
                                                    styles.dayChipBtn,
                                                    { borderColor: isSelected ? theme.colors.primary : theme.colors.border },
                                                    isSelected && { backgroundColor: theme.colors.primary }
                                                ]}
                                                onPress={() => handleUpdateMatchDate(dateEditingMatch!.id, dayStr)}
                                            >
                                                <Text style={[styles.dayChipNum, { color: isSelected ? '#C0D725' : theme.colors.textSecondary }]}>
                                                    Giorno {idx + 1}
                                                </Text>
                                                <Text style={[styles.dayChipDate, { color: isSelected ? '#fff' : theme.colors.text }]}>
                                                    {formatTournamentDay(dayStr)}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        ) : (
                            <View style={{ marginVertical: 12, padding: 10, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.03)' }}>
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                    Nessuna data a calendario specificata per questo torneo. Puoi scegliere una data manuale sotto.
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.customDateBtn, { borderColor: theme.colors.border }]}
                            onPress={() => setShowDatePickerModal(true)}
                        >
                            <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>
                                🗓️ Scegli altra data dal calendario...
                            </Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                            <TouchableOpacity
                                style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
                                onPress={() => setDateEditingMatch(null)}
                            >
                                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Annulla</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal per il calendario completo */}
            <DatePickerModal
                visible={showDatePickerModal}
                initialDate={dateEditingMatch?.date}
                onSelectDate={(d) => {
                    if (dateEditingMatch) {
                        handleUpdateMatchDate(dateEditingMatch.id, d);
                    }
                }}
                onClose={() => setShowDatePickerModal(false)}
            />

            {/* Modal Modifica Manuale Tocchi Partita */}
            <EditTouchesModal
                visible={!!editingTouchesMatch}
                match={editingTouchesMatch}
                playerMap={playerMap}
                onClose={() => setEditingTouchesMatch(null)}
                onSave={async (manualTouches) => {
                    if (!editingTouchesMatch) return;
                    try {
                        await updateMatchAnalysis({
                            id: editingTouchesMatch.id,
                            manualTouches
                        });
                        showAlert("Tocchi Salvati", `I tocchi dei giocatori per la partita vs ${editingTouchesMatch.opponent} sono stati aggiornati.`);
                    } catch (err: any) {
                        showAlert("Errore", err?.message || "Impossibile salvare i tocchi.");
                    }
                }}
            />

            {/* Modal per Collegare questo Torneo esistente a un Evento a Calendario */}
            <Modal
                visible={linkModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setLinkModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, maxHeight: '80%' }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            🔗 Collega Torneo a Calendario
                        </Text>
                        <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                            Seleziona l'evento a calendario a cui associare le partite di "{tournamentName}":
                        </Text>

                        <ScrollView style={{ marginTop: 10, maxHeight: 320 }} nestedScrollEnabled>
                            <View style={{ gap: 6 }}>
                                {tournamentCalendarEvents.length === 0 ? (
                                    <View style={{ padding: 20, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' }}>
                                            Nessun torneo o campionato trovato a calendario.
                                        </Text>
                                    </View>
                                ) : (
                                    tournamentCalendarEvents.map((ev) => {
                                        const isCurrentLinked = tournamentEvent?.id === ev.id;
                                        const isChampionship = (ev.type || '').toLowerCase().includes('championship') || (ev.type || '').toLowerCase().includes('campionato');
                                        return (
                                            <TouchableOpacity
                                                key={ev.id}
                                                style={[
                                                    styles.eventListItem,
                                                    { borderColor: theme.colors.border, backgroundColor: isCurrentLinked ? theme.colors.primary + '15' : 'transparent' },
                                                    isCurrentLinked && { borderColor: theme.colors.primary }
                                                ]}
                                                onPress={() => handleLinkTournamentToEvent(ev)}
                                            >
                                                <Text style={{ fontSize: 18 }}>{isChampionship ? '🏅' : '🏆'}</Text>
                                                <View style={{ flex: 1, marginLeft: 8 }}>
                                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text }}>
                                                        {ev.title}
                                                    </Text>
                                                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                                        {formatDate(ev.date)}{ev.endDate && ev.endDate !== ev.date ? ` – ${formatDate(ev.endDate)}` : ''}
                                                    </Text>
                                                </View>
                                                {isCurrentLinked && (
                                                    <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>✓ Collegato</Text>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </View>
                        </ScrollView>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 }}>
                            <TouchableOpacity
                                style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
                                onPress={() => setLinkModalVisible(false)}
                            >
                                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Chiudi</Text>
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
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        width: '100%',
    },
    actionBar: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
        borderBottomWidth: 1,
    },
    actionChip: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionChipText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#e0e0e0',
        borderRadius: 10,
        padding: 4,
        gap: 4,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555',
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    summaryCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        marginBottom: 6,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryNumber: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    summaryLabel: {
        fontSize: 11,
        marginTop: 2,
        textTransform: 'uppercase',
    },
    summaryDivider: {
        width: 1,
        height: 28,
        backgroundColor: '#ccc',
    },
    matchCard: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: 'hidden',
    },
    cardContent: {
        padding: 16,
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    dateText: {
        fontSize: 13,
        fontWeight: '500',
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        marginRight: 6,
    },
    liveText: {
        color: '#EF4444',
        fontSize: 11,
        fontWeight: 'bold',
    },
    completedBadge: {
        backgroundColor: 'rgba(100, 116, 139, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    completedBadgeText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '500',
    },
    matchBody: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    opponentText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    matchBadges: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    detailBadge: {
        fontSize: 11,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        overflow: 'hidden',
        color: '#333',
        fontWeight: '600',
    },
    scoreContainer: {
        alignItems: 'flex-end',
    },
    scoreText: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    scoreSubText: {
        fontSize: 11,
        color: '#888',
        marginTop: 2,
    },
    cardActions: {
        flexDirection: 'row',
        borderTopWidth: 1,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    separator: {
        width: 1,
        height: '100%',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },
    statsScrollContent: {
        padding: 16,
        gap: 14,
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    kpiCard: {
        flex: 1,
        minWidth: 130,
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        alignItems: 'center',
    },
    kpiValue: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    kpiLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    tableContainer: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
    },
    tableTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    tableSub: {
        fontSize: 12,
        marginTop: 2,
        marginBottom: 12,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    tableHeaderRow: {
        backgroundColor: 'rgba(0,0,0,0.04)',
        borderRadius: 8,
    },
    cellCol: {
        paddingHorizontal: 8,
    },
    colName: {
        width: 140,
    },
    colNum: {
        width: 58,
        textAlign: 'center',
    },
    headerCellText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#444',
    },
    genderTag: {
        fontSize: 11,
        fontWeight: 'bold',
        marginRight: 6,
    },
    cellText: {
        fontSize: 13,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 480,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 13,
        marginBottom: 10,
    },
    dayChipBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: 'center',
        minWidth: 100,
    },
    dayChipNum: {
        fontSize: 10,
        fontWeight: '700',
    },
    dayChipDate: {
        fontSize: 13,
        fontWeight: 'bold',
        textTransform: 'capitalize',
        marginTop: 2,
    },
    customDateBtn: {
        marginTop: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    modalCancelBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    eventListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
});
