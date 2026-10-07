// components/liveMatch/PlayerStatsTable.tsx
// Tabella statistiche individuali giocatori con ordinamento interattivo

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface PlayerStatRow {
    pts: number;
    ptsO: number;
    ptsD: number;
    goals: number;
    ast: number;
    ds: number;
    toTot: number;
    touches?: number;
    plusMinus: number;
}

interface PlayerStatsTableProps {
    ids: string[];
    pStats: Record<string, PlayerStatRow>;
    getPlayer: (id: string) => { name: string; g?: string };
    statsSortKey: string;
    statsSortAsc: boolean;
    onToggleSort: (key: string) => void;
    onSelectPlayer?: (id: string) => void;
}

export const PlayerStatsTable: React.FC<PlayerStatsTableProps> = React.memo(({
    ids,
    pStats,
    getPlayer,
    statsSortKey,
    statsSortAsc,
    onToggleSort,
    onSelectPlayer,
}) => {
    const { theme } = useTheme();
    const [showLegend, setShowLegend] = React.useState(false);

    const renderSortArrow = (key: string) => {
        if (statsSortKey !== key) return '';
        return statsSortAsc ? ' ▲' : ' ▼';
    };

    return (
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>Statistiche Giocatori</Text>
                    <TouchableOpacity
                        onPress={() => setShowLegend(prev => !prev)}
                        style={{
                            backgroundColor: showLegend ? (theme.dark ? '#334155' : '#CBD5E1') : (theme.dark ? '#1E293B' : '#E2E8F0'),
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: theme.dark ? '#475569' : '#CBD5E1'
                        }}
                    >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.text }}>
                            {showLegend ? '✕ Chiudi Legenda' : 'ℹ️ Spiegazione Sigle'}
                        </Text>
                    </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Scorri e tocca le colonne per ordinare ➔</Text>
            </View>

            {/* Legenda Esplicativa */}
            {showLegend && (
                <View style={{
                    backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: theme.dark ? '#334155' : '#E2E8F0',
                    gap: 6
                }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.text, marginBottom: 2 }}>
                        Guida alle colonne:
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>PT</Text>: Punti totali giocati
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            <Text style={{ fontWeight: 'bold', color: '#1F6FD1' }}>O-Pt</Text>: Punti iniziati in Attacco (O-Line)
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            <Text style={{ fontWeight: 'bold', color: '#1F6FD1' }}>D-Pt</Text>: Punti iniziati in Difesa (D-Line)
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            <Text style={{ fontWeight: 'bold', color: '#2E8540' }}>Meta</Text>: Mete segnate
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            <Text style={{ fontWeight: 'bold', color: '#1F6FD1' }}>Ast</Text>: Assist vincenti
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            <Text style={{ fontWeight: 'bold', color: '#2E8540' }}>Dif</Text>: Difese ed intercetti effettuati
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            <Text style={{ fontWeight: 'bold', color: '#C8323C' }}>TO</Text>: Turnover commessi (lanci/prese errate)
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            <Text style={{ fontWeight: 'bold', color: '#E07A1F' }}>Tch</Text>: Tocchi totali del disco
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>+/-</Text>: Differenziale (Mete + Assist + Difese − TO)
                        </Text>
                    </View>
                </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                    <View style={[styles.tableHeaderRow, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                        <TouchableOpacity onPress={() => onToggleSort('pts')}>
                            <Text style={[styles.thCell, { width: 120, textAlign: 'left', paddingLeft: 8 }]}>Giocatore</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onToggleSort('pts')}>
                            <Text style={[styles.thCell, { width: 46, color: statsSortKey === 'pts' ? (theme.dark ? '#60A5FA' : '#003057') : undefined }]}>
                                PT{renderSortArrow('pts')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onToggleSort('ptsO')}>
                            <Text style={[styles.thCell, { width: 48, color: statsSortKey === 'ptsO' ? (theme.dark ? '#60A5FA' : '#003057') : undefined }]}>
                                O-Pt{renderSortArrow('ptsO')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onToggleSort('ptsD')}>
                            <Text style={[styles.thCell, { width: 48, color: statsSortKey === 'ptsD' ? (theme.dark ? '#60A5FA' : '#003057') : undefined }]}>
                                D-Pt{renderSortArrow('ptsD')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onToggleSort('goals')}>
                            <Text style={[styles.thCell, { width: 48, color: statsSortKey === 'goals' ? '#2E8540' : undefined }]}>
                                Meta{renderSortArrow('goals')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onToggleSort('ast')}>
                            <Text style={[styles.thCell, { width: 46, color: statsSortKey === 'ast' ? '#1F6FD1' : undefined }]}>
                                Ast{renderSortArrow('ast')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onToggleSort('ds')}>
                            <Text style={[styles.thCell, { width: 46, color: statsSortKey === 'ds' ? '#2E8540' : undefined }]}>
                                Dif{renderSortArrow('ds')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onToggleSort('toTot')}>
                            <Text style={[styles.thCell, { width: 44, color: statsSortKey === 'toTot' ? '#C8323C' : undefined }]}>
                                TO{renderSortArrow('toTot')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onToggleSort('touches')}>
                            <Text style={[styles.thCell, { width: 44, color: statsSortKey === 'touches' ? '#E07A1F' : undefined }]}>
                                Tch{renderSortArrow('touches')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onToggleSort('plusMinus')}>
                            <Text style={[styles.thCell, { width: 48, fontWeight: 'bold', color: statsSortKey === 'plusMinus' ? (theme.dark ? '#60A5FA' : '#003057') : undefined }]}>
                                +/-{renderSortArrow('plusMinus')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {ids.map(id => {
                        const s = pStats[id] || { pts: 0, ptsO: 0, ptsD: 0, goals: 0, ast: 0, ds: 0, toTot: 0, touches: 0, plusMinus: 0 };
                        const player = getPlayer(id);
                        return (
                            <TouchableOpacity
                                key={id}
                                style={[styles.tableRow, { borderBottomColor: theme.colors.border }]}
                                onPress={() => onSelectPlayer && onSelectPlayer(id)}
                                activeOpacity={0.65}
                            >
                                <Text style={[styles.tdCell, { width: 120, fontWeight: '700', color: theme.colors.primary, textAlign: 'left', paddingLeft: 8 }]} numberOfLines={1}>
                                    {player.name} {player.g ? <Text style={{ color: player.g === 'F' ? '#B8338A' : '#1F6FD1', fontSize: 10 }}>({player.g})</Text> : null}
                                </Text>
                                <Text style={[styles.tdCell, { width: 46, color: theme.colors.text }]}>{s.pts}</Text>
                                <Text style={[styles.tdCell, { width: 48, color: theme.colors.text }]}>{s.ptsO}</Text>
                                <Text style={[styles.tdCell, { width: 48, color: theme.colors.text }]}>{s.ptsD}</Text>
                                <Text style={[styles.tdCell, { width: 48, color: '#2E8540', fontWeight: 'bold' }]}>{s.goals}</Text>
                                <Text style={[styles.tdCell, { width: 46, color: '#1F6FD1' }]}>{s.ast}</Text>
                                <Text style={[styles.tdCell, { width: 46, color: '#2E8540', fontWeight: 'bold' }]}>{s.ds}</Text>
                                <Text style={[styles.tdCell, { width: 44, color: '#C8323C' }]}>{s.toTot}</Text>
                                <Text style={[styles.tdCell, { width: 44, color: theme.colors.text }]}>{s.touches || 0}</Text>
                                <Text style={[styles.tdCell, { width: 48, fontWeight: 'bold', color: s.plusMinus >= 0 ? '#2E8540' : '#C8323C' }]}>
                                    {s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            <Text style={{ fontSize: 10, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
                💡 Tocca un giocatore per aprire la scheda dettagliata e vedere tutte le sue mete
            </Text>
        </View>
    );
});

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderRadius: 6,
    },
    thCell: {
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#607D8B',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    tdCell: {
        fontSize: 12,
        textAlign: 'center',
    },
});

export default PlayerStatsTable;
