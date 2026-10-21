import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenTitle from '../components/ScreenTitle';
import DatePickerModal from '../components/DatePickerModal';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSeason } from '../context/SeasonContext';
import {
    MatchAnalysis,
    MatchRosterPlayer,
    addMatchAnalysis,
    updateMatchAnalysis
} from '../services/firestore';
import { getEventRoster } from '../services/firestore/hallOfFame';
import { showAlert } from '../utils/alert';
import { applyRemappingsToEvents } from '../utils/matchImporter';
import {
    getEventDays,
    formatTournamentDay,
    formatDate,
    analisiPartitaStyles as styles,
    useMatchAnalysis,
    MatchFolderCard,
    CreateEditMatchModal,
    PlayerMappingModal,
    ExportTournamentModal,
    MatchGroup
} from '../components/analisiPartita';

// Re-export per retrocompatibilità (usati da TournamentDetailScreen)
export { getEventDays, formatTournamentDay };

export default function AnalisiPartitaScreen() {
    const { theme } = useTheme();
    const { isStaff } = useAuth();
    const { stagioneCorrente } = useSeason();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    // Hook di dominio
    const {
        matches,
        eventsList,
        allMembers,
        loading,
        expandedFolders,
        tournamentEvents,
        playerMap,
        groupedMatches,
        toggleFolder,
        handleDeleteMatch,
        handleExportSingleMatchXLSX,
        handleExportTournamentXLSX,
        handleImportFile,
        processConfirmedImport,
        mappingModalVisible,
        setMappingModalVisible,
        importedRawPlayers,
        playerMappings,
        setPlayerMappings,
        pendingImportData,
        exportTournamentModalVisible,
        setExportTournamentModalVisible
    } = useMatchAnalysis({ stagioneCorrente });

    // State del form creazione/modifica partita
    const [modalVisible, setModalVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
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
    const [idRemappings, setIdRemappings] = useState<Record<string, string>>({});

    const selectedEvent = useMemo(() => {
        if (!selectedEventId) return null;
        return eventsList.find(e => e.id === selectedEventId) || tournamentEvents.find(e => e.id === selectedEventId) || null;
    }, [eventsList, selectedEventId, tournamentEvents]);

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
        setIdRemappings({});

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        setDate(`${year}-${month}-${day}`);
        setModalVisible(false);
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
        setModalVisible(true);
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

    const renderFolder = ({ item: folder }: { item: MatchGroup }) => {
        return (
            <MatchFolderCard
                folder={folder}
                isStaff={isStaff}
                isExpanded={expandedFolders[folder.id] ?? true}
                onToggleFolder={toggleFolder}
                onOpenTournament={tName => navigation.navigate('TournamentDetail', { tournamentName: tName })}
                onExportTournamentExcel={tMatches => handleExportTournamentXLSX()}
                onOpenMatch={match => navigation.navigate('LiveMatch', { matchId: match.id, initialMatch: match })}
                onExportMatchXLSX={handleExportSingleMatchXLSX}
                onEditMatch={handleEditMatch}
                onDeleteMatch={handleDeleteMatch}
            />
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
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

            {/* Azioni Excel / Import */}
            {isStaff && (
                <View style={[styles.actionBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity
                        style={[styles.actionChip, { backgroundColor: '#2E8540' }]}
                        onPress={handleExportTournamentXLSX}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.actionChipText}>📊 Excel Torneo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionChip, { backgroundColor: theme.colors.primary }]}
                        onPress={handleImportFile}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.actionChipText}>📥 Importa File</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Lista Partite */}
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

            {/* Modale Creazione / Modifica Partita */}
            <CreateEditMatchModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                editingMatchId={editingMatchId}
                opponent={opponent}
                setOpponent={setOpponent}
                date={date}
                setDate={setDate}
                surface={surface}
                setSurface={setSurface}
                pullFirst={pullFirst}
                setPullFirst={setPullFirst}
                firstRatio={firstRatio}
                setFirstRatio={setFirstRatio}
                dir0={dir0}
                setDir0={setDir0}
                isSingleMatch={isSingleMatch}
                setIsSingleMatch={setIsSingleMatch}
                selectedEventId={selectedEventId}
                onSelectEvent={handleSelectEvent}
                selectedEvent={selectedEvent}
                tournamentEvents={tournamentEvents}
                selectedRoster={selectedRoster}
                setSelectedRoster={setSelectedRoster}
                rosterSourceEvent={rosterSourceEvent}
                allMembers={allMembers}
                onOpenDatePicker={() => setShowDatePicker(true)}
                onSaveMatch={handleSaveMatch}
                idRemappings={idRemappings}
                setIdRemappings={setIdRemappings}
            />

            {/* DatePicker Modal */}
            <DatePickerModal
                visible={showDatePicker}
                initialDate={date}
                onSelectDate={d => {
                    setDate(d);
                    setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
            />

            {/* Modale Mappatura Giocatori all'Importazione */}
            <PlayerMappingModal
                visible={mappingModalVisible}
                onClose={() => setMappingModalVisible(false)}
                importedRawPlayers={importedRawPlayers}
                allMembers={allMembers}
                playerMappings={playerMappings}
                onUpdateMapping={(playerName, targetId) => {
                    setPlayerMappings(prev => ({ ...prev, [playerName]: targetId }));
                }}
                onConfirm={() => {
                    if (pendingImportData) {
                        processConfirmedImport(pendingImportData.content, pendingImportData.isJson, playerMappings);
                    }
                }}
            />

            {/* Modale Selezione Torneo per Esportazione Excel */}
            <ExportTournamentModal
                visible={exportTournamentModalVisible}
                onClose={() => setExportTournamentModalVisible(false)}
                groupedMatches={groupedMatches}
                playerMap={playerMap}
            />
        </SafeAreaView>
    );
}
