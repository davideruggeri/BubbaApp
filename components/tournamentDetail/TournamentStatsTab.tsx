import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { tournamentDetailStyles as styles } from './tournamentDetailStyles';
import { SortKey, PlayerStatRow, TeamStatsSummary } from './tournamentDetailTypes';

interface TournamentStatsTabProps {
    teamStatsSummary: TeamStatsSummary;
    sortedPlayerStats: PlayerStatRow[];
    sortKey: SortKey;
    sortAsc: boolean;
    onSort: (key: SortKey) => void;
    onSelectPlayer?: (player: PlayerStatRow) => void;
    theme: any;
}

export const TournamentStatsTab: React.FC<TournamentStatsTabProps> = ({
    teamStatsSummary,
    sortedPlayerStats,
    sortKey,
    sortAsc,
    onSort,
    onSelectPlayer,
    theme,
}) => {
    return (
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
                    Tocca un giocatore per i dettagli per partita · Tocca l'intestazione per ordinare
                </Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View>
                        <View style={[styles.tableRow, styles.tableHeaderRow, { borderBottomColor: theme.colors.border }]}>
                            <TouchableOpacity style={[styles.cellCol, styles.colName]} onPress={() => onSort('name')}>
                                <Text style={styles.headerCellText}>Giocatore {sortKey === 'name' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => onSort('pts')}>
                                <Text style={styles.headerCellText}>Punti {sortKey === 'pts' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => onSort('goals')}>
                                <Text style={styles.headerCellText}>Mete {sortKey === 'goals' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => onSort('ast')}>
                                <Text style={styles.headerCellText}>Assist {sortKey === 'ast' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => onSort('ds')}>
                                <Text style={styles.headerCellText}>Difese {sortKey === 'ds' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => onSort('toTot')}>
                                <Text style={styles.headerCellText}>TO {sortKey === 'toTot' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => onSort('touches')}>
                                <Text style={styles.headerCellText}>Tocchi {sortKey === 'touches' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.cellCol, styles.colNum]} onPress={() => onSort('plusMinus')}>
                                <Text style={[styles.headerCellText, { color: theme.colors.primary }]}>+/- {sortKey === 'plusMinus' ? (sortAsc ? '▲' : '▼') : ''}</Text>
                            </TouchableOpacity>
                        </View>

                        {sortedPlayerStats.map((p, idx) => (
                            <TouchableOpacity
                                key={p.id}
                                activeOpacity={0.7}
                                onPress={() => onSelectPlayer?.(p)}
                                style={[
                                    styles.tableRow,
                                    {
                                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                        borderBottomColor: theme.colors.border,
                                    },
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
                            </TouchableOpacity>
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
    );
};
