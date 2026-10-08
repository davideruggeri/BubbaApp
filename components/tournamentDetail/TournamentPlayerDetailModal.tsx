import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { PlayerStatRow, PlayerMatchStatItem } from './tournamentDetailTypes';

interface TournamentPlayerDetailModalProps {
    visible: boolean;
    player: PlayerStatRow | null;
    matchStats: PlayerMatchStatItem[];
    theme: any;
    onClose: () => void;
    onPressMatch?: (matchId: string) => void;
}

const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
};

export const TournamentPlayerDetailModal: React.FC<TournamentPlayerDetailModalProps> = ({
    visible,
    player,
    matchStats,
    theme,
    onClose,
    onPressMatch,
}) => {
    if (!visible || !player) return null;

    const playedMatchesCount = matchStats.filter(m => m.isPlayed).length;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                        <View style={styles.headerLeft}>
                            <View style={[styles.genderBadge, { backgroundColor: player.g === 'F' ? '#e91e63' : '#1976d2' }]}>
                                <Text style={styles.genderText}>{player.g}</Text>
                            </View>
                            <View>
                                <Text style={[styles.playerName, { color: theme.colors.text }]} numberOfLines={1}>
                                    {player.name}
                                </Text>
                                <Text style={[styles.playerSub, { color: theme.colors.textSecondary }]}>
                                    {playedMatchesCount} su {matchStats.length} partite giocate
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.dark ? '#334155' : '#E2E8F0' }]} onPress={onClose}>
                            <Text style={[styles.closeBtnText, { color: theme.colors.text }]}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
                        {/* Summary KPI Grid */}
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Totali Torneo</Text>
                        <View style={styles.kpiGrid}>
                            <View style={[styles.kpiCard, { backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                                <Text style={[styles.kpiValue, { color: theme.colors.text }]}>{player.pts}</Text>
                                <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>Punti (O:{player.ptsO} D:{player.ptsD})</Text>
                            </View>
                            <View style={[styles.kpiCard, { backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                                <Text style={[styles.kpiValue, { color: '#2e7d32' }]}>{player.goals}</Text>
                                <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>Mete</Text>
                            </View>
                            <View style={[styles.kpiCard, { backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                                <Text style={[styles.kpiValue, { color: '#0288d1' }]}>{player.ast}</Text>
                                <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>Assist</Text>
                            </View>
                            <View style={[styles.kpiCard, { backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                                <Text style={[styles.kpiValue, { color: '#7b1fa2' }]}>{player.ds}</Text>
                                <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>Difese</Text>
                            </View>
                            <View style={[styles.kpiCard, { backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                                <Text style={[styles.kpiValue, { color: theme.colors.danger }]}>{player.toTot}</Text>
                                <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>Turnover</Text>
                            </View>
                            <View style={[styles.kpiCard, { backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                                <Text style={[styles.kpiValue, { color: '#E07A1F' }]}>{player.touches ?? 0}</Text>
                                <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>Tocchi</Text>
                            </View>
                            <View style={[styles.kpiCard, { backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                                <Text style={[styles.kpiValue, { color: player.plusMinus >= 0 ? '#2e7d32' : theme.colors.danger }]}>
                                    {player.plusMinus > 0 ? `+${player.plusMinus}` : player.plusMinus}
                                </Text>
                                <Text style={[styles.kpiLabel, { color: theme.colors.textSecondary }]}>+/-</Text>
                            </View>
                        </View>

                        {/* Dettaglio per Partita */}
                        <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 18 }]}>
                            Statistiche per Partita ({matchStats.length})
                        </Text>

                        {matchStats.map(item => {
                            const isWin = item.ourScore > item.theirScore;
                            const isLoss = item.ourScore < item.theirScore;
                            const isLive = item.status === 'live';

                            let badgeBg = '#E2E8F0';
                            let badgeColor = '#475569';
                            let badgeLabel = 'PAREGGIO';
                            if (isLive) {
                                badgeBg = '#FEF3C7';
                                badgeColor = '#B45309';
                                badgeLabel = 'IN CORSO';
                            } else if (isWin) {
                                badgeBg = '#DCFCE7';
                                badgeColor = '#15803D';
                                badgeLabel = 'VITTORIA';
                            } else if (isLoss) {
                                badgeBg = '#FEE2E2';
                                badgeColor = '#B91C1C';
                                badgeLabel = 'SCONFITTA';
                            }

                            return (
                                <View
                                    key={item.matchId}
                                    style={[
                                        styles.matchCard,
                                        {
                                            backgroundColor: theme.dark ? '#1E293B' : '#FFFFFF',
                                            borderColor: theme.colors.border,
                                        },
                                    ]}
                                >
                                    {/* Match Header */}
                                    <View style={styles.matchCardHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.matchOpponent, { color: theme.colors.text }]} numberOfLines={1}>
                                                vs {item.opponent}
                                            </Text>
                                            {item.date ? (
                                                <Text style={[styles.matchDate, { color: theme.colors.textSecondary }]}>
                                                    📅 {formatDate(item.date)}
                                                </Text>
                                            ) : null}
                                        </View>

                                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                            <View style={[styles.matchScoreBadge, { backgroundColor: theme.dark ? '#334155' : '#F1F5F9' }]}>
                                                <Text style={[styles.matchScoreText, { color: theme.colors.text }]}>
                                                    {item.ourScore} - {item.theirScore}
                                                </Text>
                                            </View>
                                            <View style={[styles.resultBadge, { backgroundColor: badgeBg }]}>
                                                <Text style={[styles.resultBadgeText, { color: badgeColor }]}>
                                                    {badgeLabel}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Match Player Stats */}
                                    {item.isPlayed ? (
                                        <View style={[styles.matchStatsGrid, { borderTopColor: theme.colors.border }]}>
                                            <View style={styles.statChip}>
                                                <Text style={[styles.statChipLabel, { color: theme.colors.textSecondary }]}>PUNTI</Text>
                                                <Text style={[styles.statChipValue, { color: theme.colors.text }]}>
                                                    {item.pts} <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>(O:{item.ptsO} D:{item.ptsD})</Text>
                                                </Text>
                                            </View>
                                            <View style={styles.statChip}>
                                                <Text style={[styles.statChipLabel, { color: theme.colors.textSecondary }]}>METE</Text>
                                                <Text style={[styles.statChipValue, { color: item.goals > 0 ? '#2e7d32' : theme.colors.text }]}>
                                                    {item.goals}
                                                </Text>
                                            </View>
                                            <View style={styles.statChip}>
                                                <Text style={[styles.statChipLabel, { color: theme.colors.textSecondary }]}>ASSIST</Text>
                                                <Text style={[styles.statChipValue, { color: item.ast > 0 ? '#0288d1' : theme.colors.text }]}>
                                                    {item.ast}
                                                </Text>
                                            </View>
                                            <View style={styles.statChip}>
                                                <Text style={[styles.statChipLabel, { color: theme.colors.textSecondary }]}>DIFESE</Text>
                                                <Text style={[styles.statChipValue, { color: item.ds > 0 ? '#7b1fa2' : theme.colors.text }]}>
                                                    {item.ds}
                                                </Text>
                                            </View>
                                            <View style={styles.statChip}>
                                                <Text style={[styles.statChipLabel, { color: theme.colors.textSecondary }]}>TO</Text>
                                                <Text style={[styles.statChipValue, { color: item.toTot > 0 ? theme.colors.danger : theme.colors.text }]}>
                                                    {item.toTot}
                                                </Text>
                                            </View>
                                            <View style={styles.statChip}>
                                                <Text style={[styles.statChipLabel, { color: theme.colors.textSecondary }]}>TOCCHI</Text>
                                                <Text style={[styles.statChipValue, { color: item.touches > 0 ? '#E07A1F' : theme.colors.text }]}>
                                                    {item.touches}
                                                </Text>
                                            </View>
                                            <View style={styles.statChip}>
                                                <Text style={[styles.statChipLabel, { color: theme.colors.textSecondary }]}>+/-</Text>
                                                <Text style={[styles.statChipValue, { color: item.plusMinus >= 0 ? '#2e7d32' : theme.colors.danger }]}>
                                                    {item.plusMinus > 0 ? `+${item.plusMinus}` : item.plusMinus}
                                                </Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={[styles.matchNotPlayed, { borderTopColor: theme.colors.border }]}>
                                            <Text style={[styles.matchNotPlayedText, { color: theme.colors.textSecondary }]}>
                                                ⚪ Non sceso in campo in questa partita
                                            </Text>
                                        </View>
                                    )}

                                    {/* Action to open match */}
                                    {onPressMatch && (
                                        <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
                                            <TouchableOpacity
                                                style={[styles.openMatchBtn, { backgroundColor: theme.dark ? '#334155' : '#EEF2F6' }]}
                                                onPress={() => {
                                                    onClose();
                                                    onPressMatch(item.matchId);
                                                }}
                                            >
                                                <Text style={[styles.openMatchBtnText, { color: theme.colors.primary }]}>
                                                    Apri Partita ↗
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            );
                        })}

                        {matchStats.length === 0 && (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Text style={{ color: theme.colors.textSecondary }}>
                                    Nessuna partita trovata per questo torneo.
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    container: {
        width: '100%',
        maxWidth: 620,
        maxHeight: '90%',
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    genderBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    genderText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    playerName: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    playerSub: {
        fontSize: 12,
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    scrollBody: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    kpiCard: {
        flex: 1,
        minWidth: 70,
        borderRadius: 10,
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    kpiValue: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    kpiLabel: {
        fontSize: 10,
        marginTop: 2,
        fontWeight: '500',
        textAlign: 'center',
    },
    matchCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        marginBottom: 10,
    },
    matchCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    matchOpponent: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    matchDate: {
        fontSize: 11,
        marginTop: 2,
    },
    matchScoreBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    matchScoreText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    resultBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    resultBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
    },
    matchStatsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingTop: 10,
        borderTopWidth: 1,
    },
    statChip: {
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        minWidth: 44,
    },
    statChipLabel: {
        fontSize: 9,
        fontWeight: '600',
        marginBottom: 2,
    },
    statChipValue: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    matchNotPlayed: {
        paddingTop: 8,
        borderTopWidth: 1,
    },
    matchNotPlayedText: {
        fontSize: 12,
        fontStyle: 'italic',
    },
    openMatchBtn: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    openMatchBtnText: {
        fontSize: 11,
        fontWeight: '600',
    },
});
