import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import ScreenTitle from '../components/ScreenTitle';
import DatePickerModal from '../components/DatePickerModal';
import EditTouchesModal from '../components/EditTouchesModal';
import { updateMatchAnalysis } from '../services/firestore/matchAnalysis';
import { showAlert } from '../utils/alert';
import {
    tournamentDetailStyles as styles,
    useTournamentDetailData,
    TournamentMatchCard,
    TournamentStatsTab,
    EditMatchDateModal,
    LinkTournamentModal,
} from '../components/tournamentDetail';

type TournamentDetailRouteProp = RouteProp<RootStackParamList, 'TournamentDetail'>;

const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

export default function TournamentDetailScreen() {
    const { theme } = useTheme();
    const { isStaff } = useAuth();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<TournamentDetailRouteProp>();

    const tournamentName = route.params?.tournamentName || 'Torneo';

    const {
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
    } = useTournamentDetailData(tournamentName);

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
                            activeTab === 'matches' && { backgroundColor: theme.colors.primary },
                        ]}
                        onPress={() => setActiveTab('matches')}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'matches' && { color: '#fff', fontWeight: 'bold' },
                            ]}
                        >
                            Partite ({tournamentMatches.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.tabButton,
                            activeTab === 'stats' && { backgroundColor: theme.colors.primary },
                        ]}
                        onPress={() => setActiveTab('stats')}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'stats' && { color: '#fff', fontWeight: 'bold' },
                            ]}
                        >
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
                    renderItem={({ item }) => (
                        <TournamentMatchCard
                            item={item}
                            playerMap={playerMap}
                            isStaff={isStaff}
                            theme={theme}
                            onPressMatch={m => navigation.navigate('LiveMatch', { matchId: m.id, initialMatch: m })}
                            onEditTouches={setEditingTouchesMatch}
                            onEditDate={setDateEditingMatch}
                            onDeleteMatch={handleDeleteMatch}
                        />
                    )}
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
                                    <Text
                                        style={[
                                            styles.summaryNumber,
                                            { color: teamStatsSummary.goalDiff >= 0 ? '#2e7d32' : theme.colors.danger },
                                        ]}
                                    >
                                        {teamStatsSummary.ourTotalGoals} - {teamStatsSummary.theirTotalGoals}
                                    </Text>
                                    <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                                        Diff ({teamStatsSummary.goalDiff >= 0 ? `+${teamStatsSummary.goalDiff}` : teamStatsSummary.goalDiff})
                                    </Text>
                                </View>
                            </View>

                            {/* Sezione Collegamento Torneo / Date Calendario */}
                            {tournamentEvent ? (
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginTop: 12,
                                        paddingTop: 10,
                                        borderTopWidth: 1,
                                        borderTopColor: theme.colors.border,
                                    }}
                                >
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary }}>
                                            📅 A CALENDARIO: {tournamentEvent.title}
                                        </Text>
                                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>
                                            {formatDate(tournamentEvent.date)}
                                            {tournamentEvent.endDate && tournamentEvent.endDate !== tournamentEvent.date
                                                ? ` – ${formatDate(tournamentEvent.endDate)}`
                                                : ''}
                                            {tournamentDays.length > 1 ? ` (${tournamentDays.length} giorni)` : ''}
                                        </Text>
                                    </View>
                                    {isStaff && (
                                        <TouchableOpacity
                                            style={{
                                                paddingHorizontal: 10,
                                                paddingVertical: 5,
                                                borderRadius: 6,
                                                backgroundColor: theme.colors.primary + '15',
                                                borderWidth: 1,
                                                borderColor: theme.colors.primary + '40',
                                            }}
                                            onPress={() => setLinkModalVisible(true)}
                                        >
                                            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.primary }}>
                                                Cambia Evento
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ) : (
                                isStaff && (
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginTop: 12,
                                            paddingTop: 10,
                                            borderTopWidth: 1,
                                            borderTopColor: theme.colors.border,
                                            backgroundColor: '#FFFBEB',
                                            padding: 8,
                                            borderRadius: 8,
                                        }}
                                    >
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#B45309' }}>
                                                Torneo non collegato al Calendario
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#78350F' }}>
                                                Collega a un evento per prelevare automaticamente le date.
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={{
                                                paddingHorizontal: 10,
                                                paddingVertical: 6,
                                                borderRadius: 6,
                                                backgroundColor: '#B45309',
                                            }}
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
                <TournamentStatsTab
                    teamStatsSummary={teamStatsSummary}
                    sortedPlayerStats={sortedPlayerStats}
                    sortKey={sortKey}
                    sortAsc={sortAsc}
                    onSort={handleSort}
                    theme={theme}
                />
            )}

            {/* Modal Selezione Rapida Giorno Partita per il Torneo */}
            <EditMatchDateModal
                visible={!!dateEditingMatch && !showDatePickerModal}
                dateEditingMatch={dateEditingMatch}
                tournamentDays={tournamentDays}
                theme={theme}
                onClose={() => setDateEditingMatch(null)}
                onSelectDay={dayStr => dateEditingMatch && handleUpdateMatchDate(dateEditingMatch.id, dayStr)}
                onOpenDatePicker={() => setShowDatePickerModal(true)}
            />

            {/* Modal per il calendario completo */}
            <DatePickerModal
                visible={showDatePickerModal}
                initialDate={dateEditingMatch?.date}
                onSelectDate={d => {
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
                onSave={async manualTouches => {
                    if (!editingTouchesMatch) return;
                    try {
                        await updateMatchAnalysis({
                            id: editingTouchesMatch.id,
                            manualTouches,
                        });
                        showAlert(
                            'Tocchi Salvati',
                            `I tocchi dei giocatori per la partita vs ${editingTouchesMatch.opponent} sono stati aggiornati.`
                        );
                    } catch (err: any) {
                        showAlert('Errore', err?.message || 'Impossibile salvare i tocchi.');
                    }
                }}
            />

            {/* Modal per Collegare questo Torneo esistente a un Evento a Calendario */}
            <LinkTournamentModal
                visible={linkModalVisible}
                tournamentName={tournamentName}
                tournamentCalendarEvents={tournamentCalendarEvents}
                tournamentEvent={tournamentEvent}
                theme={theme}
                onClose={() => setLinkModalVisible(false)}
                onSelectEvent={handleLinkTournamentToEvent}
            />
        </SafeAreaView>
    );
}
