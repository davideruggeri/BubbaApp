import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ScreenTitle from '../components/ScreenTitle';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { showAlert } from '../utils/alert';
import BubbaWrappedModal from '../components/BubbaWrappedModal';
import {
    subscribeToPresenzeHistory,
    subscribeToMembers,
    PresenzeHistoryEntry,
    Member,
    assignTiedRanks,
    RankedItem,
    calcolaEArchiviaStagione,
    subscribeToUserWrapped,
    subscribeToTeamWrapped,
    UserWrappedData,
    TeamWrappedData
} from '../services/firestore';

export default function PresenzeHistoryScreen() {
    const navigation = useNavigation();
    const { theme } = useTheme();
    const { userProfile } = useAuth();

    const [history, setHistory] = useState<PresenzeHistoryEntry[]>([]);
    const [membersMap, setMembersMap] = useState<Record<string, Member>>({});
    const [loading, setLoading] = useState(true);
    const [recalculatingSeason, setRecalculatingSeason] = useState<string | null>(null);

    // Wrapped State
    const [wrappedModalVisible, setWrappedModalVisible] = useState(false);
    const [wrappedSeason, setWrappedSeason] = useState('');
    const [userWrapped, setUserWrapped] = useState<UserWrappedData | null>(null);
    const [teamWrapped, setTeamWrapped] = useState<TeamWrappedData | null>(null);

    const handleOpenSeasonWrapped = (season: string) => {
        setWrappedSeason(season);
        const uId = userProfile?.memberId || userProfile?.uid || Object.keys(membersMap)[0];
        if (uId) {
            subscribeToUserWrapped(season, uId, setUserWrapped, userProfile?.email || undefined);
        }
        subscribeToTeamWrapped(season, setTeamWrapped);
        setWrappedModalVisible(true);
    };

    // Modal state for detailed member rankings of a season
    const [selectedSeason, setSelectedSeason] = useState<PresenzeHistoryEntry | null>(null);
    const [modalMode, setModalMode] = useState<'Campo' | 'Palestra'>('Campo');
    const [cardModes, setCardModes] = useState<Record<string, 'Campo' | 'Palestra'>>({});

    const handleRecalculateSeason = async (stagione: string) => {
        try {
            setRecalculatingSeason(stagione);
            await calcolaEArchiviaStagione(stagione);
            showAlert("Ricalcolo Completato", `Dati, presenze e streak della stagione ${stagione} ricalcolati con successo dallo storico.`);
        } catch (e) {
            showAlert("Errore", "Impossibile ricalcolare i dati della stagione.");
        } finally {
            setRecalculatingSeason(null);
        }
    };

    useEffect(() => {
        const unsubscribeHistory = subscribeToPresenzeHistory((entries) => {
            setHistory(entries);
            setLoading(false);
        });

        const unsubscribeMembers = subscribeToMembers((membersList) => {
            const map: Record<string, Member> = {};
            membersList.forEach((m) => {
                map[m.id] = m;
            });
            setMembersMap(map);
        }, true);

        return () => {
            unsubscribeHistory();
            unsubscribeMembers();
        };
    }, []);

    const formatTimestamp = (ts: any): string => {
        if (!ts) return '-';
        if (ts.toDate) {
            const d = ts.toDate();
            return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        }
        if (ts instanceof Date) {
            return `${ts.getDate().toString().padStart(2, '0')}/${(ts.getMonth() + 1).toString().padStart(2, '0')}/${ts.getFullYear()}`;
        }
        if (typeof ts === 'string') {
            const d = new Date(ts);
            if (!isNaN(d.getTime())) {
                return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
            }
        }
        return '-';
    };

    const getRankedMembersForMode = (season: PresenzeHistoryEntry, mode: 'Campo' | 'Palestra') => {
        const perMembro = season.perMembro || {};
        const totalAllenamenti = mode === 'Campo'
            ? (season.numeroAllenamentiCampo ?? season.numeroAllenamenti ?? 0)
            : (season.numeroAllenamentiPalestra ?? 0);

        const list = Object.entries(perMembro)
            .map(([memberId, stats]) => {
                const member = membersMap[memberId];
                const name = member
                    ? (member.nickname || `${member.firstName} ${member.lastName || ''}`.trim())
                    : `Membro (${memberId.substring(0, 5)})`;
                const count = mode === 'Campo' ? (stats.presenzeCampo || 0) : (stats.presenzePalestra || 0);
                const perc = mode === 'Campo'
                    ? (stats.percentualeCampo ?? (totalAllenamenti > 0 ? Math.round((count / totalAllenamenti) * 1000) / 10 : 0))
                    : (stats.percentualePalestra ?? (totalAllenamenti > 0 ? Math.round((count / totalAllenamenti) * 1000) / 10 : 0));
                const streak = mode === 'Campo'
                    ? (stats.streakCampo ?? stats.streakMassima ?? 0)
                    : (stats.streakPalestra ?? stats.streakMassima ?? 0);

                return {
                    memberId,
                    name,
                    count,
                    perc,
                    streak,
                };
            })
            .filter(m => m.count > 0)
            .sort((a, b) => b.count - a.count || b.perc - a.perc || a.name.localeCompare(b.name));

        return assignTiedRanks(list, m => m.count);
    };

    const renderSeasonCard = ({ item }: { item: PresenzeHistoryEntry }) => {
        const cardMode = cardModes[item.stagione] || 'Campo';
        const rankedMembers = getRankedMembersForMode(item, cardMode);
        const top3 = rankedMembers.slice(0, 3);

        const numAllenamentiCampo = item.numeroAllenamentiCampo ?? item.numeroAllenamenti ?? 0;
        const numAllenamentiPalestra = item.numeroAllenamentiPalestra ?? 0;
        const mediaCampo = numAllenamentiCampo > 0 ? ((item.totalePresenzeCampo || 0) / numAllenamentiCampo).toFixed(1) : '0';
        const mediaPalestra = numAllenamentiPalestra > 0 ? ((item.totalePresenzePalestra || 0) / numAllenamentiPalestra).toFixed(1) : '0';

        return (
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                {/* Header */}
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={[styles.seasonTitle, { color: theme.colors.primary }]}>
                            Stagione {item.stagione}
                        </Text>
                        <Text style={[styles.closureDate, { color: theme.colors.textSecondary }]}>
                            Chiusa il {formatTimestamp(item.dataChiusura)}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => handleRecalculateSeason(item.stagione)}
                            disabled={recalculatingSeason === item.stagione}
                            style={{ padding: 4 }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Text style={{ fontSize: 16 }}>{recalculatingSeason === item.stagione ? '⏳' : '🔄'}</Text>
                        </TouchableOpacity>
                        <View style={[styles.seasonBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                            <Text style={[styles.seasonBadgeText, { color: theme.colors.primary }]}>Archiviata</Text>
                        </View>
                    </View>
                </View>

                {/* Aggregate Stats Badges - Divided Campo and Palestra (Showing Media Presenze) */}
                <View style={styles.metricsContainer}>
                    <View style={[styles.metricBox, { backgroundColor: theme.colors.sectionBackground }]}>
                        <Text style={[styles.metricCategoryTitle, { color: theme.colors.primary }]}>🥏 Campo</Text>
                        <View style={styles.metricRowInside}>
                            <View style={styles.metricSubCol}>
                                <Text style={[styles.metricNumber, { color: theme.colors.text }]}>{numAllenamentiCampo}</Text>
                                <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Allenamenti</Text>
                            </View>
                            <View style={styles.metricSubCol}>
                                <Text style={[styles.metricNumber, { color: theme.colors.text }]}>{mediaCampo}</Text>
                                <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Media Presenze</Text>
                            </View>
                        </View>
                    </View>
                    <View style={[styles.metricBox, { backgroundColor: theme.colors.sectionBackground }]}>
                        <Text style={[styles.metricCategoryTitle, { color: theme.colors.primary }]}>🏋️ Palestra</Text>
                        <View style={styles.metricRowInside}>
                            <View style={styles.metricSubCol}>
                                <Text style={[styles.metricNumber, { color: theme.colors.text }]}>{numAllenamentiPalestra}</Text>
                                <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Allenamenti</Text>
                            </View>
                            <View style={styles.metricSubCol}>
                                <Text style={[styles.metricNumber, { color: theme.colors.text }]}>{mediaPalestra}</Text>
                                <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Media Presenze</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Podium toggle & preview */}
                <View style={styles.podiumContainer}>
                    <View style={styles.podiumHeaderRow}>
                        <Text style={[styles.podiumTitle, { color: theme.colors.textSecondary }]}>
                            Podio Presenze {cardMode}:
                        </Text>
                        <View style={[styles.miniToggleContainer, { backgroundColor: theme.colors.inputBackground }]}>
                            <TouchableOpacity
                                style={[
                                    styles.miniToggleBtn,
                                    cardMode === 'Campo' && [styles.miniToggleBtnActive, { backgroundColor: theme.colors.card }]
                                ]}
                                onPress={() => setCardModes(prev => ({ ...prev, [item.stagione]: 'Campo' }))}
                            >
                                <Text style={[styles.miniToggleText, cardMode === 'Campo' && { color: theme.colors.primary, fontWeight: 'bold' }]}>🥏 Campo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.miniToggleBtn,
                                    cardMode === 'Palestra' && [styles.miniToggleBtnActive, { backgroundColor: theme.colors.card }]
                                ]}
                                onPress={() => setCardModes(prev => ({ ...prev, [item.stagione]: 'Palestra' }))}
                            >
                                <Text style={[styles.miniToggleText, cardMode === 'Palestra' && { color: theme.colors.primary, fontWeight: 'bold' }]}>🏋️ Palestra</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {top3.length > 0 ? (
                        top3.map((m) => (
                            <View key={m.memberId} style={styles.podiumRow}>
                                <Text style={styles.podiumBadge}>
                                    {m.badge || `${m.rank}.`}
                                </Text>
                                <Text style={[styles.podiumName, { color: theme.colors.text }]} numberOfLines={1}>
                                    {m.name}
                                </Text>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.podiumScore, { color: theme.colors.primary }]}>
                                        {m.count} presenze ({m.perc}%)
                                    </Text>
                                    {m.streak > 0 && (
                                        <Text style={[styles.podiumStreak, { color: theme.colors.textSecondary }]}>
                                            🔥 Streak: {m.streak}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary, fontStyle: 'italic', marginVertical: 6 }]}>
                            Nessuna presenza registrata per {cardMode}.
                        </Text>
                    )}
                </View>

                {/* Action Buttons: Classifica & Wrapped */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                        style={[styles.detailButton, { flex: 1.2, backgroundColor: theme.colors.primary, marginTop: 0 }]}
                        onPress={() => {
                            setModalMode(cardMode);
                            setSelectedSeason(item);
                        }}
                    >
                        <Text style={styles.detailButtonText}>Classifica</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.detailButton, { flex: 1, backgroundColor: '#7928CA', marginTop: 0 }]}
                        onPress={() => handleOpenSeasonWrapped(item.stagione)}
                    >
                        <Text style={styles.detailButtonText}>🎁 Wrapped</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <ScreenTitle title="STORICO PRESENZE" onBack={() => navigation.goBack()} />
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : history.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyIcon}>📜</Text>
                    <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nessun archivio stagionale</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                        Le stagioni passate archiviate tramite &quot;Chiudi stagione&quot; compariranno qui.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={(item) => item.stagione}
                    renderItem={renderSeasonCard}
                    contentContainerStyle={styles.listContent}
                />
            )}

            {/* Ranking Detail Modal */}
            <Modal
                visible={!!selectedSeason}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSelectedSeason(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                                    Classifica Stagione {selectedSeason?.stagione}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedSeason(null)} style={styles.modalCloseBtn}>
                                <Text style={[styles.modalCloseText, { color: theme.colors.textSecondary }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Mode Toggle inside Modal */}
                        <View style={[styles.modalToggleContainer, { backgroundColor: theme.colors.inputBackground }]}>
                            <TouchableOpacity
                                style={[
                                    styles.modalToggleBtn,
                                    modalMode === 'Campo' && [styles.modalToggleBtnActive, { backgroundColor: theme.colors.card }]
                                ]}
                                onPress={() => setModalMode('Campo')}
                            >
                                <Text style={[styles.modalToggleBtnText, modalMode === 'Campo' && { color: theme.colors.primary, fontWeight: 'bold' }]}>
                                    🥏 Campo
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalToggleBtn,
                                    modalMode === 'Palestra' && [styles.modalToggleBtnActive, { backgroundColor: theme.colors.card }]
                                ]}
                                onPress={() => setModalMode('Palestra')}
                            >
                                <Text style={[styles.modalToggleBtnText, modalMode === 'Palestra' && { color: theme.colors.primary, fontWeight: 'bold' }]}>
                                    🏋️ Palestra
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Summary Pill for Selected Mode */}
                        {selectedSeason && (() => {
                            const nAllenamenti = modalMode === 'Campo'
                                ? (selectedSeason.numeroAllenamentiCampo ?? selectedSeason.numeroAllenamenti ?? 0)
                                : (selectedSeason.numeroAllenamentiPalestra ?? 0);
                            const tot = modalMode === 'Campo'
                                ? (selectedSeason.totalePresenzeCampo || 0)
                                : (selectedSeason.totalePresenzePalestra || 0);
                            const media = nAllenamenti > 0 ? (tot / nAllenamenti).toFixed(1) : '0';
                            return (
                                <View style={[styles.modalSummaryPill, { backgroundColor: theme.colors.sectionBackground }]}>
                                    <Text style={[styles.modalSummaryText, { color: theme.colors.textSecondary }]}>
                                        {`${nAllenamenti} allenamenti • Media: ${media} presenze`}
                                    </Text>
                                </View>
                            );
                        })()}

                        <ScrollView style={styles.modalScroll}>
                            {(() => {
                                if (!selectedSeason) return null;
                                const ranked = getRankedMembersForMode(selectedSeason, modalMode);

                                if (ranked.length === 0) {
                                    return (
                                        <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                                            <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
                                                Nessuna presenza registrata per {modalMode}.
                                            </Text>
                                        </View>
                                    );
                                }

                                return ranked.map((m) => (
                                    <View
                                        key={m.memberId}
                                        style={[
                                            styles.memberRow,
                                            { borderBottomColor: theme.colors.border },
                                            m.rank === 1 && { backgroundColor: '#FFD70018' },
                                            m.rank === 2 && { backgroundColor: '#C0C0C014' },
                                            m.rank === 3 && { backgroundColor: '#CD7F3214' }
                                        ]}
                                    >
                                        <View style={styles.rankCol}>
                                            <Text style={styles.rankBadge}>{m.badge || `${m.rank}.`}</Text>
                                        </View>
                                        <View style={styles.memberInfoCol}>
                                            <Text style={[styles.memberName, { color: theme.colors.text }]} numberOfLines={1}>
                                                {m.name}
                                            </Text>
                                            <Text style={[styles.memberSubtext, { color: theme.colors.textSecondary }]}>
                                                {m.streak > 0 ? `🔥 Streak max: ${m.streak}` : 'Streak: -'}
                                            </Text>
                                        </View>
                                        <View style={styles.memberScoreCol}>
                                            <Text style={[styles.memberTotal, { color: theme.colors.primary }]}>
                                                {m.count}
                                            </Text>
                                            <Text style={[styles.memberPerc, { color: theme.colors.textSecondary }]}>
                                                {m.perc}%
                                            </Text>
                                        </View>
                                    </View>
                                ));
                            })()}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.modalBottomCloseBtn, { backgroundColor: theme.colors.primary }]}
                            onPress={() => setSelectedSeason(null)}
                        >
                            <Text style={styles.modalBottomCloseText}>Chiudi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {/* Bubba Wrapped Fullscreen Modal */}
            <BubbaWrappedModal
                visible={wrappedModalVisible}
                onClose={() => setWrappedModalVisible(false)}
                userWrapped={userWrapped}
                teamWrapped={teamWrapped}
                stagione={wrappedSeason}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 6,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 18,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    seasonTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closureDate: {
        fontSize: 12,
        marginTop: 2,
    },
    seasonBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    seasonBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    metricsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 14,
    },
    metricBox: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    metricCategoryTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    metricRowInside: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    metricSubCol: {
        alignItems: 'center',
    },
    metricNumber: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    metricLabel: {
        fontSize: 10,
        marginTop: 2,
        textAlign: 'center',
    },
    podiumContainer: {
        marginBottom: 14,
        paddingTop: 4,
    },
    podiumHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    podiumTitle: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    miniToggleContainer: {
        flexDirection: 'row',
        borderRadius: 8,
        padding: 2,
    },
    miniToggleBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    miniToggleBtnActive: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    miniToggleText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#888',
    },
    podiumRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 3,
    },
    podiumBadge: {
        fontSize: 15,
        marginRight: 8,
        width: 24,
        textAlign: 'center',
    },
    podiumName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    podiumScore: {
        fontSize: 13,
        fontWeight: '600',
    },
    podiumStreak: {
        fontSize: 11,
        marginTop: 1,
    },
    detailButton: {
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 4,
    },
    detailButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalCloseBtn: {
        padding: 6,
    },
    modalCloseText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    modalToggleContainer: {
        flexDirection: 'row',
        borderRadius: 10,
        padding: 3,
        marginBottom: 10,
    },
    modalToggleBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    modalToggleBtnActive: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    modalToggleBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#888',
    },
    modalSummaryPill: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 8,
    },
    modalSummaryText: {
        fontSize: 11,
        fontWeight: '500',
    },
    modalScroll: {
        marginVertical: 6,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rankCol: {
        width: 34,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    rankBadge: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    memberInfoCol: {
        flex: 1,
        paddingRight: 10,
    },
    memberName: {
        fontSize: 15,
        fontWeight: '600',
    },
    memberSubtext: {
        fontSize: 11,
        marginTop: 2,
    },
    memberScoreCol: {
        alignItems: 'flex-end',
    },
    memberTotal: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    memberPerc: {
        fontSize: 11,
        marginTop: 1,
    },
    modalBottomCloseBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    modalBottomCloseText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
});
