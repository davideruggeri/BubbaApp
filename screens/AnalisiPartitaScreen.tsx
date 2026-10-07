import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    TextInput,
    FlatList,
    Image,
    Animated,
    Platform,
    ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenTitle from '../components/ScreenTitle';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSeason } from '../context/SeasonContext';
import {
    subscribeToMatchAnalysis,
    addMatchAnalysis,
    deleteMatchAnalysis,
    updateMatchAnalysis,
    subscribeToEvents,
    subscribeToMembers,
    MatchAnalysis,
    Event,
    Member,
    MatchRosterPlayer
} from '../services/firestore';
import { getEventRoster } from '../services/firestore/hallOfFame';
import DatePickerModal from '../components/DatePickerModal';
import { showAlert, showConfirmation } from '../utils/alert';
import { parseJSONBackup, parseXLSXFile, extractImportedPlayers, RawImportedPlayer, applyRemappingsToEvents } from '../utils/matchImporter';
import { exportAndDownloadXLSX } from '../utils/matchExporter';
import { derive } from '../utils/statsEngine';

export const getEventDays = (ev?: Event | null): string[] => {
    if (!ev || !ev.date) return [];
    const startStr = ev.date;
    const endStr = ev.endDate || ev.date;
    if (startStr === endStr) return [startStr];

    const days: string[] = [];
    const current = new Date(startStr + 'T12:00:00');
    const end = new Date(endStr + 'T12:00:00');
    let count = 0;
    while (current <= end && count < 14) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        days.push(`${y}-${m}-${d}`);
        current.setDate(current.getDate() + 1);
        count++;
    }
    return days.length > 0 ? days : [startStr];
};

export const formatTournamentDay = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
        return dateStr;
    }
};

export default function AnalisiPartitaScreen() {
    const { theme } = useTheme();
    const { isStaff } = useAuth();
    const { stagioneCorrente } = useSeason();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [matches, setMatches] = useState<MatchAnalysis[]>([]);
    const [eventsList, setEventsList] = useState<Event[]>([]);
    const [allMembers, setAllMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

    // Modal Nuova/Modifica Partita
    const [modalVisible, setModalVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Form State
    const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
    const [opponent, setOpponent] = useState('');
    const [date, setDate] = useState('');
    const [surface, setSurface] = useState<'sabbia' | 'erba'>('sabbia');
    const [pullFirst, setPullFirst] = useState<'us' | 'them'>('us');
    const [firstRatio, setFirstRatio] = useState<'M' | 'F'>('F');
    const [dir0, setDir0] = useState<'R' | 'L'>('R');
    const [isSingleMatch, setIsSingleMatch] = useState(true);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [selectedRoster, setSelectedRoster] = useState<MatchRosterPlayer[]>([]);
    const [rosterSourceEvent, setRosterSourceEvent] = useState<string | null>(null);
    const [newGuestName, setNewGuestName] = useState('');
    const [newGuestGender, setNewGuestGender] = useState<'M' | 'F'>('F');
    const [rosterExpanded, setRosterExpanded] = useState(false);
    const [idRemappings, setIdRemappings] = useState<Record<string, string>>({});
    const [remappingPlayer, setRemappingPlayer] = useState<MatchRosterPlayer | null>(null);
    const [remappingSearch, setRemappingSearch] = useState('');

    // Import Mapping State
    const [mappingModalVisible, setMappingModalVisible] = useState(false);
    const [importedRawPlayers, setImportedRawPlayers] = useState<RawImportedPlayer[]>([]);
    const [playerMappings, setPlayerMappings] = useState<Record<string, string>>({});
    const [pendingImportData, setPendingImportData] = useState<{ content: any; isJson: boolean } | null>(null);

    // Export Tournament Modal State
    const [exportTournamentModalVisible, setExportTournamentModalVisible] = useState(false);

    // Filtro esclusivo su Tornei e Campionati a calendario (deduplicati per titolo e ordinati cronologicamente)
    const tournamentEvents = useMemo(() => {
        const filtered = eventsList.filter((ev: Event) => {
            const t = (ev.type || '').toLowerCase();
            return t === 'tournament' || t === 'championship' || t === 'championship_season' || t === 'torneo' || t === 'campionato';
        });

        // Deduplicazione: se lo stesso torneo/campionato compare in 2 o più giorni, mostralo solo una volta
        const uniqueMap = new Map<string, Event>();
        for (const ev of filtered) {
            const normalizedTitle = (ev.title || '').trim().toLowerCase();
            if (!uniqueMap.has(normalizedTitle)) {
                uniqueMap.set(normalizedTitle, ev);
            } else {
                // Conserva quello con la data iniziale (più remota)
                const existing = uniqueMap.get(normalizedTitle)!;
                if ((ev.date || '') < (existing.date || '')) {
                    uniqueMap.set(normalizedTitle, ev);
                }
            }
        }

        // Includi anche i tornei già presenti nelle partite registrate che potrebbero non avere evento esplicito
        for (const m of matches) {
            if (!m.isSingleMatch && m.eventName && m.eventName.trim()) {
                const norm = m.eventName.trim().toLowerCase();
                if (!uniqueMap.has(norm)) {
                    const calendarMatch = eventsList.find(e => (e.title || '').trim().toLowerCase() === norm || e.id === m.eventId);
                    if (calendarMatch) {
                        uniqueMap.set(norm, calendarMatch);
                    } else {
                        uniqueMap.set(norm, {
                            id: m.eventId || `existing_${m.eventName.trim()}`,
                            title: m.eventName.trim(),
                            date: m.date || new Date().toISOString().split('T')[0],
                            type: 'tournament',
                            description: 'Torneo già registrato'
                        } as Event);
                    }
                }
            }
        }

        const list = Array.from(uniqueMap.values());
        // Ordinamento cronologico dal più recente a quelli passati
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return list;
    }, [eventsList, matches]);

    const selectedEvent = useMemo(() => {
        if (!selectedEventId) return null;
        return eventsList.find(e => e.id === selectedEventId) || tournamentEvents.find(e => e.id === selectedEventId) || null;
    }, [eventsList, selectedEventId, tournamentEvents]);

    useEffect(() => {
        const unsubscribeMatches = subscribeToMatchAnalysis(setMatches);
        const unsubscribeEvents = subscribeToEvents(setEventsList);
        const unsubscribeMembers = subscribeToMembers(setAllMembers);

        return () => {
            unsubscribeMatches();
            unsubscribeEvents();
            unsubscribeMembers();
        };
    }, []);

    const playerMap = React.useMemo(() => {
        const map: Record<string, { name: string; g: 'M' | 'F' }> = {};
        for (const m of allMembers) {
            map[m.id] = {
                name: m.nickname || m.firstName,
                g: m.gender === 'F' ? 'F' : 'M'
            };
        }
        return map;
    }, [allMembers]);

    const filteredMembersToRemap = React.useMemo(() => {
        if (!remappingSearch.trim()) return allMembers;
        const q = remappingSearch.toLowerCase();
        return allMembers.filter(m =>
            (m.nickname && m.nickname.toLowerCase().includes(q)) ||
            (m.firstName && m.firstName.toLowerCase().includes(q)) ||
            (m.lastName && m.lastName.toLowerCase().includes(q))
        );
    }, [allMembers, remappingSearch]);

    const handleSelectEvent = async (evId: string) => {
        setSelectedEventId(evId);
        const ev = eventsList.find(e => e.id === evId) || tournamentEvents.find(e => e.id === evId);
        if (!ev) return;

        if (ev.surface) {
            setSurface(ev.surface);
        }

        const days = getEventDays(ev);
        if (days.length > 0 && (!date || !days.includes(date))) {
            setDate(days[0]);
        }

        try {
            const eventRoster = await getEventRoster(evId);
            if (eventRoster.length > 0) {
                const rosterPlayers: MatchRosterPlayer[] = eventRoster.map(r => {
                    const member = r.memberId ? allMembers.find(m => m.id === r.memberId) : null;
                    const rGender = r.gender || (r as any).g;
                    const gender: 'M' | 'F' = member ? (member.gender === 'F' ? 'F' : 'M') : (rGender === 'F' ? 'F' : 'M');
                    return {
                        id: r.memberId || r.id,
                        name: r.name,
                        g: gender,
                        isGuest: r.isGuest
                    };
                });
                setSelectedRoster(rosterPlayers);
                setRosterSourceEvent(ev.title);
                return;
            }

            if (ev.participants && ev.participants.length > 0) {
                const rosterPlayers: MatchRosterPlayer[] = ev.participants.map(p => {
                    const member = allMembers.find(m => m.id === p.id);
                    const pGender = (p as any).gender || (p as any).g;
                    const gender: 'M' | 'F' = member ? (member.gender === 'F' ? 'F' : 'M') : (pGender === 'F' ? 'F' : 'M');
                    return {
                        id: p.id,
                        name: p.name,
                        g: gender,
                        isGuest: p.isGuest
                    };
                });
                setSelectedRoster(rosterPlayers);
                setRosterSourceEvent(ev.title);
                return;
            }

            setRosterSourceEvent(null);
        } catch (e) {
            console.warn("Errore recupero roster evento:", e);
        }
    };

    const resetForm = () => {
        setEditingMatchId(null);
        setOpponent('');
        setSurface('sabbia');
        setPullFirst('us');
        setFirstRatio('F');
        setDir0('R');
        setIsSingleMatch(true);
        setSelectedEventId('');
        setSelectedRoster([]);
        setRosterSourceEvent(null);
        setNewGuestName('');
        setRosterExpanded(false);
        setIdRemappings({});
        setRemappingPlayer(null);
        setRemappingSearch('');

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        setDate(`${year}-${month}-${day}`);
        setModalVisible(false);
    };

    const handleSaveMatch = async () => {
        if (!opponent.trim()) {
            showAlert("Errore", "Inserisci il nome della squadra avversaria.");
            return;
        }

        const currentEv = selectedEvent || eventsList.find(e => e.id === selectedEventId) || tournamentEvents.find(e => e.id === selectedEventId);
        if (!isSingleMatch && currentEv) {
            const days = getEventDays(currentEv);
            if (days.length > 0 && !days.includes(date)) {
                const rangeStr = `${formatDate(currentEv.date)}${currentEv.endDate && currentEv.endDate !== currentEv.date ? ' – ' + formatDate(currentEv.endDate) : ''}`;
                showAlert(
                    "Data Partita non valida",
                    `La data della partita (${formatDate(date)}) non coincide con le date del torneo a calendario (${rangeStr}). Seleziona uno dei giorni del torneo per continuare.`
                );
                return;
            }
        }

        try {
            const resolvedEventId = isSingleMatch ? null : (currentEv?.id?.startsWith('existing_') ? null : (currentEv?.id || null));
            const resolvedEventName = isSingleMatch ? null : (currentEv?.title || null);

            const matchData: Partial<MatchAnalysis> = {
                opponent: opponent.trim(),
                surface,
                date: date || new Date().toISOString().split('T')[0],
                pullFirst,
                firstRatio,
                dir0,
                isSingleMatch,
                eventId: resolvedEventId,
                eventName: resolvedEventName,
                targetScore: surface === 'sabbia' ? 13 : 15,
                stagione: stagioneCorrente,
                customRoster: selectedRoster,
            };

            let updatedEvents = undefined;
            if (editingMatchId && Object.keys(idRemappings).length > 0) {
                const existingMatch = matches.find(m => m.id === editingMatchId);
                if (existingMatch?.events && existingMatch.events.length > 0) {
                    updatedEvents = applyRemappingsToEvents(existingMatch.events, idRemappings);
                }
            }

            if (editingMatchId) {
                await updateMatchAnalysis({
                    id: editingMatchId,
                    ...matchData,
                    ...(updatedEvents ? { events: updatedEvents } : {})
                });
            } else {
                await addMatchAnalysis({
                    ...(matchData as any),
                    division: 'mixed',
                    startingGender: firstRatio,
                    events: [],
                    ourScore: 0,
                    theirScore: 0,
                    status: 'live'
                });
            }
            resetForm();
        } catch (error) {
            showAlert("Errore", "Impossibile salvare la partita.");
        }
    };

    const handleEditMatch = (match: MatchAnalysis) => {
        setEditingMatchId(match.id);
        setOpponent(match.opponent);
        setDate(match.date);
        setSurface(match.surface || 'sabbia');
        setPullFirst(match.pullFirst || 'us');
        setFirstRatio(match.firstRatio || 'F');
        setDir0(match.dir0 || 'R');
        const isSingle = match.isSingleMatch ?? (!match.eventId && !match.eventName);
        setIsSingleMatch(isSingle);

        let evId = match.eventId || '';
        if (!evId && match.eventName) {
            const found = tournamentEvents.find(e => e.title.trim().toLowerCase() === match.eventName!.trim().toLowerCase());
            if (found) evId = found.id;
            else {
                const foundCal = eventsList.find(e => e.title.trim().toLowerCase() === match.eventName!.trim().toLowerCase());
                if (foundCal) evId = foundCal.id;
            }
        }
        setSelectedEventId(evId);

        setSelectedRoster(match.customRoster || []);
        setRosterSourceEvent(match.eventName || null);
        setIdRemappings({});
        setRemappingPlayer(null);
        setRemappingSearch('');
        setModalVisible(true);
    };

    const handleDeleteMatch = (id: string) => {
        showConfirmation(
            "Elimina Partita",
            "Sei sicuro di voler eliminare questa partita e tutti i suoi dati?",
            () => deleteMatchAnalysis(id),
            "Elimina"
        );
    };

    // Gestione Importazione (File picker sia JSON che XLSX con revisione mappatura giocatori)
    const handleImportFile = () => {
        if (Platform.OS === 'web') {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            fileInput.style.display = 'none';

            fileInput.onchange = async (e: any) => {
                const file = e.target?.files?.[0];
                if (!file) return;

                setLoading(true);
                const isJson = file.name.endsWith('.json');
                const reader = new FileReader();

                reader.onload = async (event: any) => {
                    try {
                        const content = isJson ? event.target.result : new Uint8Array(event.target.result);
                        const rawPlayers = extractImportedPlayers(content, isJson, allMembers);

                        if (rawPlayers.length > 0) {
                            const initialMap: Record<string, string> = {};
                            rawPlayers.forEach(p => {
                                initialMap[p.name.toLowerCase()] = p.suggestedMemberId || 'guest';
                            });

                            setImportedRawPlayers(rawPlayers);
                            setPlayerMappings(initialMap);
                            setPendingImportData({ content, isJson });
                            setMappingModalVisible(true);
                            setLoading(false);
                            return;
                        }

                        // Se non ci sono giocatori particolari, salva direttamente
                        await processConfirmedImport(content, isJson, {});
                    } catch (err: any) {
                        console.error("Errore durante l'importazione:", err);
                        showAlert("Errore Importazione", err?.message || "Impossibile leggere o analizzare il file.");
                        setLoading(false);
                    }
                };

                if (isJson) {
                    reader.readAsText(file);
                } else {
                    reader.readAsArrayBuffer(file);
                }
            };

            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        } else {
            showAlert("Funzionalità Web", "L'importazione file è attualmente disponibile su browser/web.");
        }
    };

    const processConfirmedImport = async (
        content: string | Uint8Array,
        isJson: boolean,
        mapping: Record<string, string>
    ) => {
        setLoading(true);
        try {
            let importedGames = [];
            if (isJson) {
                importedGames = parseJSONBackup(content as string, allMembers, mapping);
            } else {
                importedGames = parseXLSXFile(content as Uint8Array, allMembers, mapping);
            }

            if (!importedGames.length) {
                showAlert("Attenzione", "Nessuna partita trovata nel file selezionato.");
                return;
            }

            let count = 0;
            for (const g of importedGames) {
                await addMatchAnalysis({
                    opponent: g.opponent,
                    date: g.date,
                    surface: 'sabbia',
                    division: 'mixed',
                    targetScore: 13,
                    pullFirst: g.pullFirst,
                    firstRatio: g.firstRatio,
                    dir0: g.dir0,
                    events: g.events,
                    ourScore: g.ourScore,
                    theirScore: g.theirScore,
                    status: g.status,
                    customRoster: g.customRoster,
                    stagione: stagioneCorrente,
                    isSingleMatch: true,
                });
                count++;
            }

            setMappingModalVisible(false);
            setPendingImportData(null);
            showAlert(
                "Importazione Completata",
                `Sono state importate con successo ${count} partite con giocatori associati ed eventi.`
            );
        } catch (err: any) {
            showAlert("Errore Salvataggio", err?.message || "Impossibile salvare le partite importate.");
        } finally {
            setLoading(false);
        }
    };

    const handleExportTournamentXLSX = async () => {
        const tournamentGroups = groupedMatches.filter(g => !g.isSingleGroup && g.matches.length > 0);

        if (!tournamentGroups.length) {
            showAlert("Nessun torneo", "Non ci sono partite di torneo registrate per la stagione corrente.");
            return;
        }

        if (tournamentGroups.length === 1) {
            try {
                await exportAndDownloadXLSX(tournamentGroups[0].matches, playerMap);
                showAlert("Esportazione completata", `Il foglio Excel di "${tournamentGroups[0].title}" è stato scaricato.`);
            } catch (error: any) {
                showAlert("Errore Esportazione", error?.message || "Impossibile esportare l'Excel.");
            }
            return;
        }

        // Se sono presenti più tornei, apri il modale per consentire la selezione
        setExportTournamentModalVisible(true);
    };

    const handleExportSingleMatchXLSX = async (match: MatchAnalysis) => {
        try {
            await exportAndDownloadXLSX([match], playerMap);
        } catch (error: any) {
            showAlert("Errore", "Impossibile esportare la partita.");
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

    const toggleFolder = (folderId: string) => {
        setExpandedFolders(prev => ({
            ...prev,
            [folderId]: prev[folderId] !== undefined ? !prev[folderId] : false
        }));
    };

    const groupedMatches = React.useMemo(() => {
        const tournamentMap = new Map<string, MatchAnalysis[]>();
        const singleMatches: MatchAnalysis[] = [];

        // Raggruppa solo le partite registrate
        matches.forEach(m => {
            if (!m.isSingleMatch && m.eventName && m.eventName.trim()) {
                const key = m.eventName.trim();
                if (!tournamentMap.has(key)) {
                    tournamentMap.set(key, []);
                }
                tournamentMap.get(key)!.push(m);
            } else {
                singleMatches.push(m);
            }
        });

        const groups: {
            id: string;
            title: string;
            isSingleGroup?: boolean;
            matches: MatchAnalysis[];
            hasLive: boolean;
            dateRange: string;
            sortDate: string;
        }[] = [];

        tournamentMap.forEach((tMatches, tName) => {
            if (tMatches.length === 0) return;
            tMatches.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            const hasLive = tMatches.some(m => m.status === 'live');
            const dates = tMatches.map(m => m.date).filter(Boolean).sort();
            const dateRange = dates.length > 0
                ? (dates[0] === dates[dates.length - 1] ? formatDate(dates[0]) : `${formatDate(dates[0])} - ${formatDate(dates[dates.length - 1])}`)
                : '';

            const sortDate = (dates.length > 0 ? dates[dates.length - 1] : '') || '';

            groups.push({
                id: `tournament_${tName}`,
                title: tName,
                matches: tMatches,
                hasLive,
                dateRange,
                sortDate
            });
        });

        // Ordina i tornei per data più recente
        groups.sort((a, b) => b.sortDate.localeCompare(a.sortDate));

        // Partite singole / amichevoli
        if (singleMatches.length > 0) {
            singleMatches.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            const hasLive = singleMatches.some(m => m.status === 'live');
            groups.push({
                id: 'single_matches',
                title: 'Partite Singole / Amichevoli',
                isSingleGroup: true,
                matches: singleMatches,
                hasLive,
                dateRange: `${singleMatches.length} ${singleMatches.length === 1 ? 'partita' : 'partite'}`,
                sortDate: singleMatches[0]?.date || ''
            });
        }

        return groups;
    }, [matches, tournamentEvents]);

    const MatchCard = ({ item }: { item: MatchAnalysis }) => {
        const isLive = item.status === 'live';

        // Calcolo punteggio live o derivato dagli eventi
        const derived = React.useMemo(() => {
            if (item.events && item.events.length) {
                return derive(item);
            }
            return null;
        }, [item]);

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
                            {item.eventName && (
                                <Text style={[styles.eventTag, { color: theme.colors.primary }]} numberOfLines={1} ellipsizeMode="tail">
                                    🏆 {item.eventName}
                                </Text>
                            )}
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
                            onPress={() => handleExportSingleMatchXLSX(item)}
                        >
                            <Text style={{ color: '#2E8540', fontWeight: '600' }}>📊 Excel</Text>
                        </TouchableOpacity>
                        <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleEditMatch(item)}>
                            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Modifica</Text>
                        </TouchableOpacity>
                        <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteMatch(item.id)}>
                            <Text style={{ color: theme.colors.danger, fontWeight: '600' }}>Elimina</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const renderFolder = ({ item: folder }: { item: typeof groupedMatches[0] }) => {
        if (!folder.isSingleGroup) {
            // Card Torneo: tocca per aprire la schermata dedicata con partite e statistiche aggregate
            return (
                <View style={styles.folderContainer}>
                    <TouchableOpacity
                        style={[
                            styles.folderHeader,
                            {
                                backgroundColor: theme.colors.card,
                                borderColor: theme.colors.border,
                            }
                        ]}
                        onPress={() => navigation.navigate('TournamentDetail', { tournamentName: folder.title })}
                        activeOpacity={0.7}
                    >
                        <View style={styles.folderLeft}>
                            <Text style={styles.folderIcon}>🏆</Text>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                    <Text style={[styles.folderTitle, { color: theme.colors.text }]} numberOfLines={1}>
                                        {folder.title}
                                    </Text>
                                    {folder.hasLive && <LivePulseBadge />}
                                </View>
                                <Text style={[styles.folderSubtitle, { color: theme.colors.textSecondary }]}>
                                    {folder.matches.length} {folder.matches.length === 1 ? 'partita' : 'partite'}{folder.dateRange ? ` • ${folder.dateRange}` : ''}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.folderRight}>
                            {isStaff && (
                                <TouchableOpacity
                                    style={styles.folderExportBtn}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        exportAndDownloadXLSX(folder.matches, playerMap);
                                    }}
                                >
                                    <Text style={styles.folderExportText}>📊 Excel</Text>
                                </TouchableOpacity>
                            )}
                            <Text style={[styles.chevron, { color: theme.colors.primary, fontWeight: 'bold' }]}>
                                Apri ➔
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>
            );
        }

        // Sezione Partite Singole / Amichevoli
        const isExpanded = expandedFolders[folder.id] ?? true;
        return (
            <View style={styles.folderContainer}>
                <TouchableOpacity
                    style={[
                        styles.folderHeader,
                        {
                            backgroundColor: theme.colors.card,
                            borderColor: theme.colors.border,
                        }
                    ]}
                    onPress={() => toggleFolder(folder.id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.folderLeft}>
                        <Text style={styles.folderIcon}>🏐</Text>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[styles.folderTitle, { color: theme.colors.text }]}>
                                {folder.title}
                            </Text>
                            <Text style={[styles.folderSubtitle, { color: theme.colors.textSecondary }]}>
                                {folder.matches.length} {folder.matches.length === 1 ? 'partita' : 'partite'}
                            </Text>
                        </View>
                    </View>

                    <Text style={[styles.chevron, { color: theme.colors.textSecondary }]}>
                        {isExpanded ? '▼' : '▶'}
                    </Text>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.folderBody}>
                        {folder.matches.map(match => (
                            <MatchCard key={match.id} item={match} />
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <ScreenTitle title="ANALISI PARTITA" onBack={() => navigation.goBack()} />
                {isStaff && (
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
                        onPress={() => {
                            resetForm();
                            setModalVisible(true);
                        }}
                    >
                        <Image source={require('../assets/plus.png')} style={styles.addIcon} />
                    </TouchableOpacity>
                )}
            </View>

            {isStaff && (
                <View style={[styles.actionBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity
                        style={[styles.actionChip, { backgroundColor: '#2E8540' }]}
                        onPress={handleExportTournamentXLSX}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.actionChipText}>📊 Esporta Excel Torneo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionChip, { backgroundColor: theme.colors.primary }]}
                        onPress={handleImportFile}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.actionChipText}>📥 Importa Partite (Excel/JSON)</Text>
                    </TouchableOpacity>
                </View>
            )}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={{ marginTop: 12, color: theme.colors.text }}>Importazione partite in corso...</Text>
                </View>
            ) : (
                <FlatList
                    data={groupedMatches}
                    keyExtractor={item => item.id}
                    renderItem={renderFolder}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                Nessuna partita registrata in questa stagione.
                            </Text>
                            {isStaff && (
                                <Text style={[styles.emptySubText, { color: theme.colors.textSecondary }]}>
                                    Tocca “+” per iniziare una nuova partita o “Importa” per ricaricare i dati dai tuoi file Excel o backup JSON.
                                </Text>
                            )}
                        </View>
                    }
                />
            )}

            {/* Modal Creazione / Modifica Partita */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                                {editingMatchId ? 'Modifica Partita' : 'Nuova Partita'}
                            </Text>

                            {/* Squadra Avversaria */}
                            <Text style={[styles.label, { color: theme.colors.text }]}>Squadra Avversaria *</Text>
                            <TextInput
                                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                                value={opponent}
                                onChangeText={setOpponent}
                                placeholder="Es: Cus Padova, Rimini..."
                                placeholderTextColor={theme.colors.textSecondary}
                            />

                            {/* Data */}
                            <Text style={[styles.label, { color: theme.colors.text }]}>Data Partita</Text>
                            <TouchableOpacity
                                style={[styles.dateButton, { borderColor: theme.colors.border }]}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={{ color: theme.colors.text }}>{formatDate(date)}</Text>
                            </TouchableOpacity>

                            {/* Tipologia: Partita Singola vs Torneo/Campionato */}
                            <Text style={[styles.label, { color: theme.colors.text }]}>Tipologia Partita</Text>
                            <View style={styles.segmentContainer}>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, isSingleMatch && styles.segmentBtnActive]}
                                    onPress={() => setIsSingleMatch(true)}
                                >
                                    <Text style={[styles.segmentText, isSingleMatch && styles.segmentTextActive]}>
                                        Partita Singola
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, !isSingleMatch && styles.segmentBtnActive]}
                                    onPress={() => setIsSingleMatch(false)}
                                >
                                    <Text style={[styles.segmentText, !isSingleMatch && styles.segmentTextActive]}>
                                        Torneo / Campionato
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Seleziona Torneo o Campionato */}
                            {!isSingleMatch && (
                                <View style={{ marginTop: 10 }}>
                                    <Text style={[styles.label, { color: theme.colors.text }]}>Seleziona Torneo o Campionato</Text>
                                    {tournamentEvents.length === 0 ? (
                                        <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginVertical: 6 }}>
                                            Nessun torneo o campionato presente a calendario.
                                        </Text>
                                    ) : (
                                        <ScrollView
                                            style={[styles.tournamentScrollBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                                            nestedScrollEnabled={true}
                                            showsVerticalScrollIndicator={true}
                                        >
                                            {tournamentEvents.map((ev: Event) => {
                                                const isSelected = selectedEventId === ev.id;
                                                const icon = ev.type === 'tournament' ? '🏆' : '🏅';
                                                return (
                                                    <TouchableOpacity
                                                        key={ev.id}
                                                        style={[
                                                            styles.tournamentSelectItem,
                                                                                                     isSelected && { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary }
                                                        ]}
                                                        onPress={() => handleSelectEvent(ev.id)}
                                                    >
                                                        <Text style={{ fontSize: 16 }}>{icon}</Text>
                                                        <View style={{ flex: 1, marginLeft: 8 }}>
                                                            <Text style={[styles.tournamentSelectTitle, { color: isSelected ? theme.colors.primary : theme.colors.text }]}>
                                                                {ev.title}
                                                            </Text>
                                                            <Text style={[styles.tournamentSelectDate, { color: theme.colors.textSecondary }]}>
                                                                Data: {formatDate(ev.date)}
                                                            </Text>
                                                        </View>
                                                        {isSelected && (
                                                            <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 16 }}>✓</Text>
                                                        )}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    )}

                                    {selectedEvent && (() => {
                                        const days = getEventDays(selectedEvent);
                                        if (!days.length) return null;
                                        const isMultiDay = days.length > 1;
                                        return (
                                            <View style={{ marginTop: 10, padding: 12, borderRadius: 8, backgroundColor: '#F0F7FF', borderWidth: 1, borderColor: '#BAE6FD' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#003057' }}>
                                                        📅 Data Partita dal Torneo
                                                    </Text>
                                                    <Text style={{ fontSize: 11, color: '#555' }}>
                                                        {formatDate(selectedEvent.date)}{selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.date ? ` – ${formatDate(selectedEvent.endDate)}` : ''}
                                                    </Text>
                                                </View>
                                                <Text style={{ fontSize: 12, color: theme.colors.text, marginBottom: 8 }}>
                                                    {isMultiDay
                                                        ? 'In quale giorno del torneo si gioca la partita?'
                                                        : 'Data del torneo impostata automaticamente:'}
                                                </Text>
                                                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                                    {days.map((dayStr, idx) => {
                                                        const isDaySelected = date === dayStr;
                                                        return (
                                                            <TouchableOpacity
                                                                key={dayStr}
                                                                style={{
                                                                    paddingHorizontal: 12,
                                                                    paddingVertical: 7,
                                                                    borderRadius: 8,
                                                                    borderWidth: 2,
                                                                    borderColor: isDaySelected ? '#003057' : '#CBD5E1',
                                                                    backgroundColor: isDaySelected ? '#003057' : '#fff',
                                                                    alignItems: 'center',
                                                                    minWidth: 95
                                                                }}
                                                                onPress={() => setDate(dayStr)}
                                                            >
                                                                <Text style={{ fontSize: 10, fontWeight: '700', color: isDaySelected ? '#C0D725' : '#64748B' }}>
                                                                    Giorno {idx + 1}
                                                                </Text>
                                                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDaySelected ? '#fff' : '#1E293B', textTransform: 'capitalize' }}>
                                                                    {formatTournamentDay(dayStr)}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                                {!days.includes(date) && (
                                                    <View style={{ marginTop: 8, backgroundColor: '#FFFBEB', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                                                        <Text style={{ fontSize: 11, color: '#B45309', fontWeight: '600' }}>
                                                            ⚠️ La data attuale ({formatDate(date)}) non coincide con le date del torneo. Tocca uno dei giorni sopra per allinearla.
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })()}

                                    {rosterSourceEvent && (
                                        <View style={{ backgroundColor: '#e8f5e9', padding: 8, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#a5d6a7' }}>
                                            <Text style={{ fontSize: 12, color: '#2e7d32', fontWeight: 'bold' }}>
                                                ✓ Roster caricato da "{rosterSourceEvent}" ({selectedRoster.length} convocati)
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Chi batte per primo (Pull First) */}
                            <Text style={[styles.label, { color: theme.colors.text }]}>Chi effettua il primo Pull?</Text>
                            <View style={styles.segmentContainer}>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, pullFirst === 'us' && styles.segmentBtnActive]}
                                    onPress={() => setPullFirst('us')}
                                >
                                    <Text style={[styles.segmentText, pullFirst === 'us' && styles.segmentTextActive]}>
                                        Noi (Difesa)
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, pullFirst === 'them' && styles.segmentBtnActive]}
                                    onPress={() => setPullFirst('them')}
                                >
                                    <Text style={[styles.segmentText, pullFirst === 'them' && styles.segmentTextActive]}>
                                        Loro (Attacco)
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Regola ABBA: Primo Rapporto di Genere */}
                            <Text style={[styles.label, { color: theme.colors.text }]}>Rapporto Punto 1 (Regola ABBA)</Text>
                            <View style={styles.segmentContainer}>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, firstRatio === 'F' && { backgroundColor: '#B8338A', borderColor: '#B8338A' }]}
                                    onPress={() => setFirstRatio('F')}
                                >
                                    <Text style={[styles.segmentText, firstRatio === 'F' && styles.segmentTextActive]}>
                                        3 Donne / 2 Uomini
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, firstRatio === 'M' && { backgroundColor: '#1F6FD1', borderColor: '#1F6FD1' }]}
                                    onPress={() => setFirstRatio('M')}
                                >
                                    <Text style={[styles.segmentText, firstRatio === 'M' && styles.segmentTextActive]}>
                                        3 Uomini / 2 Donne
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Direzione iniziale campo */}
                            <Text style={[styles.label, { color: theme.colors.text }]}>Direzione nostro attacco (Punto 1)</Text>
                            <View style={styles.segmentContainer}>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, dir0 === 'R' && styles.segmentBtnActive]}
                                    onPress={() => setDir0('R')}
                                >
                                    <Text style={[styles.segmentText, dir0 === 'R' && styles.segmentTextActive]}>
                                        Verso Destra ▶
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, dir0 === 'L' && styles.segmentBtnActive]}
                                    onPress={() => setDir0('L')}
                                >
                                    <Text style={[styles.segmentText, dir0 === 'L' && styles.segmentTextActive]}>
                                        ◀ Verso Sinistra
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Superficie */}
                            <Text style={[styles.label, { color: theme.colors.text }]}>Superficie</Text>
                            <View style={styles.segmentContainer}>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, surface === 'sabbia' && styles.segmentBtnActive]}
                                    onPress={() => setSurface('sabbia')}
                                >
                                    <Text style={[styles.segmentText, surface === 'sabbia' && styles.segmentTextActive]}>
                                        🏖️ Sabbia (13 pt)
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, surface === 'erba' && styles.segmentBtnActive]}
                                    onPress={() => setSurface('erba')}
                                >
                                    <Text style={[styles.segmentText, surface === 'erba' && styles.segmentTextActive]}>
                                        🌱 Erba (15 pt)
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Sezione Convocati Partita */}
                            <View style={{ marginTop: 14 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={[styles.label, { color: theme.colors.text, marginTop: 0 }]}>
                                        Convocati ({selectedRoster.length})
                                    </Text>
                                    <TouchableOpacity onPress={() => setRosterExpanded(!rosterExpanded)}>
                                        <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: 'bold' }}>
                                            {rosterExpanded ? 'Nascondi ▲' : 'Modifica / Visualizza ▼'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>
                                    {selectedRoster.filter(p => p.g === 'F').length} Donne · {selectedRoster.filter(p => p.g === 'M').length} Uomini
                                    {rosterSourceEvent ? ` (Caricati da: ${rosterSourceEvent})` : ''}
                                </Text>

                                {rosterExpanded && (
                                    <View style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 10, marginTop: 8, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                                        {remappingPlayer ? (
                                            /* Sub-view: Collegamento di un giocatore a un membro */
                                            <View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text }}>
                                                        🔗 Collega "{remappingPlayer.name}"
                                                    </Text>
                                                    <TouchableOpacity onPress={() => setRemappingPlayer(null)}>
                                                        <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: 'bold' }}>Annulla</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>
                                                    Seleziona il membro a cui assegnare i dati e gli eventi di questo giocatore:
                                                </Text>

                                                <TextInput
                                                    style={{
                                                        borderWidth: 1,
                                                        borderColor: theme.colors.border,
                                                        borderRadius: 6,
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 5,
                                                        fontSize: 12,
                                                        color: theme.colors.text,
                                                        marginBottom: 6
                                                    }}
                                                    placeholder="Cerca membro..."
                                                    placeholderTextColor={theme.colors.textSecondary}
                                                    value={remappingSearch}
                                                    onChangeText={setRemappingSearch}
                                                />

                                                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                                                    <View style={{ gap: 4 }}>
                                                        {filteredMembersToRemap.map(m => {
                                                            const mGender: 'M' | 'F' = m.gender === 'F' ? 'F' : 'M';
                                                            return (
                                                                <TouchableOpacity
                                                                    key={m.id}
                                                                    style={{
                                                                        flexDirection: 'row',
                                                                        alignItems: 'center',
                                                                        paddingVertical: 6,
                                                                        paddingHorizontal: 8,
                                                                        borderRadius: 6,
                                                                        backgroundColor: theme.colors.card,
                                                                        borderWidth: 1,
                                                                        borderColor: theme.colors.border
                                                                    }}
                                                                    onPress={() => {
                                                                        const targetName = m.nickname || m.firstName;
                                                                        const targetGender = m.gender === 'F' ? ('F' as const) : ('M' as const);

                                                                        // Aggiorna selectedRoster
                                                                        setSelectedRoster(prev => {
                                                                            if (prev.some(p => p.id === m.id)) {
                                                                                return prev.filter(p => p.id !== remappingPlayer.id);
                                                                            }
                                                                            return prev.map(p =>
                                                                                p.id === remappingPlayer.id
                                                                                    ? { id: m.id, name: targetName, g: targetGender }
                                                                                    : p
                                                                            );
                                                                        });

                                                                        // Registra remapping per aggiornare gli eventi al salvataggio
                                                                        setIdRemappings(prev => ({
                                                                            ...prev,
                                                                            [remappingPlayer.id]: m.id
                                                                        }));

                                                                        setRemappingPlayer(null);
                                                                        setRemappingSearch('');
                                                                        showAlert(
                                                                            "Giocatore Assegnato",
                                                                            `"${remappingPlayer.name}" assegnato a "${targetName}". Ricorda di cliccare su Salva per salvare le modifiche.`
                                                                        );
                                                                    }}
                                                                >
                                                                    <Text style={{ width: 20, fontSize: 12, fontWeight: 'bold', color: mGender === 'F' ? '#B8338A' : '#1F6FD1' }}>
                                                                        {mGender}
                                                                    </Text>
                                                                    <Text style={{ flex: 1, fontSize: 13, color: theme.colors.text }}>
                                                                        {m.nickname || m.firstName} {m.lastName || ''}
                                                                    </Text>
                                                                    <View style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 }}>
                                                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>Collega</Text>
                                                                    </View>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                </ScrollView>
                                            </View>
                                        ) : (
                                            /* Vista normale Convocati */
                                            <View>
                                                {/* Lista Convocati Attualmente Selezionati */}
                                                {selectedRoster.length > 0 && (
                                                    <View style={{ marginBottom: 10 }}>
                                                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 }}>
                                                            Giocatori Convocati ({selectedRoster.length}):
                                                        </Text>
                                                        <ScrollView style={{ maxHeight: 130 }} nestedScrollEnabled>
                                                            <View style={{ gap: 4 }}>
                                                                {selectedRoster.map(p => {
                                                                    const isGuestOrImported = p.id.startsWith('guest_') || p.id.startsWith('imported_') || (p as any).isGuest;
                                                                    return (
                                                                        <View
                                                                            key={p.id}
                                                                            style={{
                                                                                flexDirection: 'row',
                                                                                alignItems: 'center',
                                                                                paddingVertical: 4,
                                                                                paddingHorizontal: 8,
                                                                                borderRadius: 6,
                                                                                backgroundColor: theme.colors.card,
                                                                                borderWidth: 1,
                                                                                borderColor: theme.colors.border
                                                                            }}
                                                                        >
                                                                            <TouchableOpacity
                                                                                disabled={!isGuestOrImported}
                                                                                onPress={() => {
                                                                                    if (!isGuestOrImported) return;
                                                                                    const nextG: 'M' | 'F' = p.g === 'F' ? 'M' : 'F';
                                                                                    setSelectedRoster(prev => prev.map(x => x.id === p.id ? { ...x, g: nextG } : x));
                                                                                }}
                                                                                style={{
                                                                                    paddingHorizontal: 4,
                                                                                    paddingVertical: 1,
                                                                                    borderRadius: 4,
                                                                                    backgroundColor: isGuestOrImported ? (p.g === 'F' ? '#FCE4EC' : '#E3F2FD') : 'transparent',
                                                                                    marginRight: 4
                                                                                }}
                                                                            >
                                                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: p.g === 'F' ? '#B8338A' : '#1F6FD1' }}>
                                                                                    {p.g}{isGuestOrImported ? ' ⇄' : ''}
                                                                                </Text>
                                                                            </TouchableOpacity>
                                                                            <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: theme.colors.text }}>
                                                                                {p.name}
                                                                            </Text>
                                                                            <View
                                                                                style={{
                                                                                    paddingHorizontal: 5,
                                                                                    paddingVertical: 1,
                                                                                    borderRadius: 4,
                                                                                    marginRight: 6,
                                                                                    backgroundColor: isGuestOrImported ? '#FFF3E0' : '#E3F2FD'
                                                                                }}
                                                                            >
                                                                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: isGuestOrImported ? '#E65100' : '#1565C0' }}>
                                                                                    {isGuestOrImported ? 'Ospite/Imp.' : 'Membro'}
                                                                                </Text>
                                                                            </View>
                                                                            <TouchableOpacity
                                                                                style={{
                                                                                    paddingHorizontal: 6,
                                                                                    paddingVertical: 2,
                                                                                    borderRadius: 4,
                                                                                    backgroundColor: theme.colors.primary + '18',
                                                                                    marginRight: 4
                                                                                }}
                                                                                onPress={() => setRemappingPlayer(p)}
                                                                            >
                                                                                <Text style={{ fontSize: 10, color: theme.colors.primary, fontWeight: 'bold' }}>
                                                                                    🔗 Collega
                                                                                </Text>
                                                                            </TouchableOpacity>
                                                                            <TouchableOpacity
                                                                                style={{
                                                                                    paddingHorizontal: 5,
                                                                                    paddingVertical: 2,
                                                                                    borderRadius: 4,
                                                                                    backgroundColor: '#FFEBEE'
                                                                                }}
                                                                                onPress={() => setSelectedRoster(prev => prev.filter(x => x.id !== p.id))}
                                                                            >
                                                                                <Text style={{ fontSize: 10, color: '#C8323C', fontWeight: 'bold' }}>✕</Text>
                                                                            </TouchableOpacity>
                                                                        </View>
                                                                    );
                                                                })}
                                                            </View>
                                                        </ScrollView>
                                                    </View>
                                                )}

                                                {/* Azioni Rapide Selezione */}
                                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                                                    <TouchableOpacity
                                                        style={[styles.smallChip, { backgroundColor: '#B8338A' }]}
                                                        onPress={() => {
                                                            const females = allMembers.filter(m => m.gender === 'F').map(m => ({
                                                                id: m.id,
                                                                name: m.nickname || m.firstName,
                                                                g: 'F' as const
                                                            }));
                                                            const others = selectedRoster.filter(p => p.g !== 'F');
                                                            setSelectedRoster([...others, ...females]);
                                                        }}
                                                    >
                                                        <Text style={styles.smallChipText}>+ Tutte le Donne</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        style={[styles.smallChip, { backgroundColor: '#1F6FD1' }]}
                                                        onPress={() => {
                                                            const males = allMembers.filter(m => m.gender !== 'F').map(m => ({
                                                                id: m.id,
                                                                name: m.nickname || m.firstName,
                                                                g: 'M' as const
                                                            }));
                                                            const others = selectedRoster.filter(p => p.g === 'F');
                                                            setSelectedRoster([...others, ...males]);
                                                        }}
                                                    >
                                                        <Text style={styles.smallChipText}>+ Tutti gli Uomini</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        style={[styles.smallChip, { backgroundColor: '#888' }]}
                                                        onPress={() => setSelectedRoster([])}
                                                    >
                                                        <Text style={styles.smallChipText}>Deseleziona Tutti</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Aggiunta Ospite */}
                                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                                                    <TextInput
                                                        style={{ flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, color: theme.colors.text }}
                                                        placeholder="Nome Ospite..."
                                                        placeholderTextColor={theme.colors.textSecondary}
                                                        value={newGuestName}
                                                        onChangeText={setNewGuestName}
                                                    />
                                                    <TouchableOpacity
                                                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: newGuestGender === 'F' ? '#B8338A' : '#1F6FD1' }}
                                                        onPress={() => setNewGuestGender(prev => prev === 'F' ? 'M' : 'F')}
                                                    >
                                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{newGuestGender}</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: theme.colors.primary }}
                                                        onPress={() => {
                                                            if (!newGuestName.trim()) return;
                                                            const guestId = `guest_${Date.now()}`;
                                                            setSelectedRoster(prev => [...prev, { id: guestId, name: newGuestName.trim(), g: newGuestGender, isGuest: true }]);
                                                            setNewGuestName('');
                                                        }}
                                                    >
                                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>+ Ospite</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Lista Membri con Spunte */}
                                                <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                                                    <View style={{ gap: 4 }}>
                                                        {allMembers.map(m => {
                                                            const mGender: 'M' | 'F' = m.gender === 'F' ? 'F' : 'M';
                                                            const isSelected = selectedRoster.some(p => p.id === m.id);
                                                            return (
                                                                <TouchableOpacity
                                                                    key={m.id}
                                                                    style={{
                                                                        flexDirection: 'row',
                                                                        alignItems: 'center',
                                                                        paddingVertical: 6,
                                                                        paddingHorizontal: 8,
                                                                        borderRadius: 6,
                                                                        backgroundColor: isSelected ? theme.colors.primary + '14' : 'transparent',
                                                                    }}
                                                                    onPress={() => {
                                                                        if (isSelected) {
                                                                            setSelectedRoster(prev => prev.filter(p => p.id !== m.id));
                                                                        } else {
                                                                            setSelectedRoster(prev => [...prev, { id: m.id, name: m.nickname || m.firstName, g: mGender }]);
                                                                        }
                                                                    }}
                                                                >
                                                                    <Text style={{ width: 22, fontSize: 12, fontWeight: 'bold', color: mGender === 'F' ? '#B8338A' : '#1F6FD1' }}>
                                                                        {mGender}
                                                                    </Text>
                                                                    <Text style={{ flex: 1, fontSize: 13, color: theme.colors.text }}>
                                                                        {m.nickname || m.firstName} {m.lastName || ''}
                                                                    </Text>
                                                                    <Text style={{ fontSize: 14, color: isSelected ? theme.colors.primary : theme.colors.textSecondary, fontWeight: 'bold' }}>
                                                                        {isSelected ? '✓' : '○'}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { borderColor: theme.colors.border, borderWidth: 1 }]}
                                    onPress={() => setModalVisible(false)}
                                >
                                    <Text style={{ color: theme.colors.text }}>Annulla</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}
                                    onPress={handleSaveMatch}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Salva Partita</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <DatePickerModal
                visible={showDatePicker}
                initialDate={date}
                onSelectDate={d => {
                    setDate(d);
                    setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
            />

            {/* Modal Mappatura Giocatori all'Importazione */}
            <Modal visible={mappingModalVisible} animationType="slide" transparent onRequestClose={() => setMappingModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card, maxWidth: 540 }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            Collega Giocatori Importati
                        </Text>
                        <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 12, textAlign: 'center' }}>
                            Abbiamo trovato {importedRawPlayers.length} giocatori nel file. Associa ciascuno al membro corretto o confermalo come ospite:
                        </Text>

                        <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled>
                            <View style={{ gap: 8 }}>
                                {importedRawPlayers.map(p => {
                                    const currentChoice = playerMappings[p.name.toLowerCase()] || 'guest';
                                    return (
                                        <View
                                            key={p.name}
                                            style={{
                                                borderWidth: 1,
                                                borderColor: theme.colors.border,
                                                borderRadius: 10,
                                                padding: 10,
                                                backgroundColor: 'rgba(0,0,0,0.02)',
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: p.gender === 'F' ? '#B8338A' : '#1F6FD1' }}>
                                                        ({p.gender})
                                                    </Text>
                                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>
                                                        {p.name}
                                                    </Text>
                                                </View>
                                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                                    {currentChoice === 'guest' ? 'Ospite / Esterno' : 'Membro collegato ✓'}
                                                </Text>
                                            </View>

                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.mappingChip,
                                                        currentChoice === 'guest' && styles.mappingChipActive
                                                    ]}
                                                    onPress={() => {
                                                        setPlayerMappings(prev => ({ ...prev, [p.name.toLowerCase()]: 'guest' }));
                                                    }}
                                                >
                                                    <Text style={[styles.mappingChipText, currentChoice === 'guest' && styles.mappingChipTextActive]}>
                                                        👤 Ospite ({p.name})
                                                    </Text>
                                                </TouchableOpacity>

                                                {allMembers.map(m => {
                                                    const isSel = currentChoice === m.id;
                                                    return (
                                                        <TouchableOpacity
                                                            key={m.id}
                                                            style={[
                                                                styles.mappingChip,
                                                                isSel && styles.mappingChipActive
                                                            ]}
                                                            onPress={() => {
                                                                setPlayerMappings(prev => ({ ...prev, [p.name.toLowerCase()]: m.id }));
                                                            }}
                                                        >
                                                            <Text style={[styles.mappingChipText, isSel && styles.mappingChipTextActive]}>
                                                                {m.nickname || m.firstName} ({m.gender || 'M'})
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </ScrollView>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { borderColor: theme.colors.border, borderWidth: 1 }]}
                                onPress={() => {
                                    setMappingModalVisible(false);
                                    setPendingImportData(null);
                                }}
                            >
                                <Text style={{ color: theme.colors.text }}>Annulla</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#2E8540' }]}
                                onPress={() => {
                                    if (pendingImportData) {
                                        processConfirmedImport(pendingImportData.content, pendingImportData.isJson, playerMappings);
                                    }
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Conferma e Salva</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {/* Modal Selezione Torneo per Esportazione Excel */}
            <Modal
                visible={exportTournamentModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setExportTournamentModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card, maxWidth: 440 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: 18 }]}>
                                📊 Esporta Excel Torneo
                            </Text>
                            <TouchableOpacity onPress={() => setExportTournamentModalVisible(false)} style={{ padding: 4 }}>
                                <Text style={{ fontSize: 14, color: theme.colors.textSecondary, fontWeight: 'bold' }}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 14 }}>
                            Seleziona quale torneo desideri esportare in foglio Excel:
                        </Text>

                        <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                            <View style={{ gap: 8 }}>
                                {groupedMatches
                                    .filter(g => !g.isSingleGroup && g.matches.length > 0)
                                    .map(tGroup => (
                                        <TouchableOpacity
                                            key={tGroup.id}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                padding: 12,
                                                borderRadius: 10,
                                                borderWidth: 1,
                                                borderColor: theme.colors.border,
                                                backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC'
                                            }}
                                            onPress={async () => {
                                                setExportTournamentModalVisible(false);
                                                try {
                                                    await exportAndDownloadXLSX(tGroup.matches, playerMap);
                                                    showAlert("Esportazione completata", `Il foglio Excel di "${tGroup.title}" è stato scaricato.`);
                                                } catch (error: any) {
                                                    showAlert("Errore Esportazione", error?.message || "Impossibile esportare l'Excel.");
                                                }
                                            }}
                                        >
                                            <Text style={{ fontSize: 24, marginRight: 10 }}>🏆</Text>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>
                                                    {tGroup.title}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>
                                                    {tGroup.matches.length} {tGroup.matches.length === 1 ? 'partita' : 'partite'}{tGroup.dateRange ? ` • ${tGroup.dateRange}` : ''}
                                                </Text>
                                            </View>
                                            <View style={{ backgroundColor: '#2E8540', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Scarica ➔</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}

                                {/* Opzione: Tutti i tornei combinati */}
                                <TouchableOpacity
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        padding: 12,
                                        borderRadius: 10,
                                        borderWidth: 1.5,
                                        borderColor: '#2E8540',
                                        backgroundColor: theme.dark ? '#1B382B' : '#E8F5E9',
                                        marginTop: 4
                                    }}
                                    onPress={async () => {
                                        setExportTournamentModalVisible(false);
                                        try {
                                            const tournamentMatches = matches.filter(m => !m.isSingleMatch);
                                            await exportAndDownloadXLSX(tournamentMatches, playerMap);
                                            showAlert("Esportazione completata", "Il foglio Excel di tutti i tornei combinati è stato scaricato.");
                                        } catch (error: any) {
                                            showAlert("Errore Esportazione", error?.message || "Impossibile esportare l'Excel.");
                                        }
                                    }}
                                >
                                    <Text style={{ fontSize: 24, marginRight: 10 }}>🌐</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>
                                            Tutti i Tornei Combinati
                                        </Text>
                                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>
                                            Esporta tutte le {matches.filter(m => !m.isSingleMatch).length} partite di tutti i tornei
                                        </Text>
                                    </View>
                                    <View style={{ backgroundColor: '#2E8540', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Tutti ➔</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.modalBtn, { borderColor: theme.colors.border, borderWidth: 1, marginTop: 14 }]}
                            onPress={() => setExportTournamentModalVisible(false)}
                        >
                            <Text style={{ color: theme.colors.text }}>Annulla</Text>
                        </TouchableOpacity>
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
        justifyContent: 'center',
        position: 'relative',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        width: '100%',
    },
    addButton: {
        position: 'absolute',
        right: 16,
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addIcon: {
        width: 18,
        height: 18,
        tintColor: '#fff',
    },
    actionBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
        borderBottomWidth: 1,
        flexWrap: 'wrap',
    },
    actionChip: {
        flex: 1,
        minWidth: 140,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    actionChipText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
        textAlign: 'center',
    },
    listContent: {
        padding: 16,
        gap: 14,
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
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#C8323C',
        marginRight: 6,
    },
    liveText: {
        color: '#C8323C',
        fontWeight: 'bold',
        fontSize: 12,
    },
    completedBadge: {
        backgroundColor: '#e0e0e0',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    completedBadgeText: {
        fontSize: 11,
        color: '#555',
        fontWeight: '600',
    },
    matchBody: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    opponentText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    eventTag: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
    },
    matchBadges: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    detailBadge: {
        fontSize: 11,
        fontWeight: '600',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        color: '#333',
    },
    scoreContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    scoreText: {
        fontSize: 26,
        fontWeight: '900',
    },
    scoreSubText: {
        fontSize: 11,
        color: '#777',
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
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptySubText: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContent: {
        width: '100%',
        maxWidth: 500,
        borderRadius: 16,
        padding: 20,
        maxHeight: '90%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    label: {
        fontSize: 13,
        fontWeight: 'bold',
        marginTop: 12,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
    },
    dateButton: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    segmentContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
        flexWrap: 'wrap',
    },
    segmentBtn: {
        flex: 1,
        minWidth: 130,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ccc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentBtnActive: {
        backgroundColor: '#003057',
        borderColor: '#003057',
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555',
    },
    segmentTextActive: {
        color: '#fff',
        fontWeight: 'bold',
    },
    eventChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        marginRight: 6,
        backgroundColor: '#f5f5f5',
    },
    eventChipText: {
        fontSize: 13,
        color: '#333',
    },
    folderContainer: {
        marginBottom: 14,
    },
    folderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    folderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    folderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    folderIcon: {
        fontSize: 22,
    },
    folderTitle: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    folderSubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    folderExportBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: '#e8f5e9',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#a5d6a7',
    },
    folderExportText: {
        color: '#2e7d32',
        fontSize: 12,
        fontWeight: 'bold',
    },
    chevron: {
        fontSize: 14,
        marginLeft: 10,
    },
    folderBody: {
        marginTop: 10,
        gap: 10,
    },
    tournamentScrollBox: {
        maxHeight: 180,
        marginVertical: 6,
        borderWidth: 1,
        borderRadius: 10,
        padding: 6,
    },
    tournamentSelectItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 6,
    },
    tournamentSelectTitle: {
        fontSize: 13,
        fontWeight: '600',
    },
    tournamentSelectDate: {
        fontSize: 11,
        marginTop: 2,
    },
    smallChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    smallChipText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    mappingChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        backgroundColor: '#f5f5f5',
        marginRight: 6,
    },
    mappingChipActive: {
        backgroundColor: '#003057',
        borderColor: '#003057',
    },
    mappingChipText: {
        fontSize: 12,
        color: '#333',
    },
    mappingChipTextActive: {
        color: '#fff',
        fontWeight: 'bold',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 24,
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
