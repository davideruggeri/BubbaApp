// components/liveMatch/TeamKpiCard.tsx
// Scheda KPI della squadra per LiveMatchScreen

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface TeamStatsData {
    holds: number;
    oPts: number;
    clean: number;
    breaks: number;
    dPts: number;
    breakChances: number;
    toUs: number;
    toThem: number;
    durSum: number;
    durN: number;
}

interface TeamKpiCardProps {
    tStats: TeamStatsData;
    isMobile: boolean;
}

export const TeamKpiCard: React.FC<TeamKpiCardProps> = React.memo(({ tStats, isMobile }) => {
    const { theme } = useTheme();

    const holdPct = tStats.oPts > 0 ? Math.round((tStats.holds / tStats.oPts) * 100) : 0;
    const breakPct = tStats.dPts > 0 ? Math.round((tStats.breaks / tStats.dPts) * 100) : 0;
    const breakEffPct = tStats.breakChances > 0 ? Math.round((tStats.breaks / tStats.breakChances) * 100) : 0;

    return (
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>Statistiche Squadra</Text>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Efficienza e possesso</Text>
            </View>
            <View style={styles.kpiGrid}>
                {/* 1. Mete fatte (Attacco) */}
                <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                    <Text style={[styles.kpiHeading, { color: '#2E8540' }]}>METE FATTE (O)</Text>
                    <Text style={[styles.kpiVal, { color: theme.colors.text }]}>
                        {tStats.holds}/{tStats.oPts} <Text style={{ fontSize: 11, color: '#2E8540' }}>({holdPct}%)</Text>
                    </Text>
                    <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>Partendo in attacco</Text>
                </View>

                {/* 2. Mete Clean */}
                <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                    <Text style={[styles.kpiHeading, { color: theme.colors.textSecondary }]}>METE CLEAN</Text>
                    <Text style={[styles.kpiVal, { color: theme.colors.text }]}>{tStats.clean}</Text>
                    <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>Senza turnover subiti</Text>
                </View>

                {/* 3. Defence */}
                <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                    <Text style={[styles.kpiHeading, { color: '#1F6FD1' }]}>DEFENCE</Text>
                    <Text style={[styles.kpiVal, { color: theme.colors.text }]}>
                        {tStats.breaks}/{tStats.dPts} <Text style={{ fontSize: 11, color: '#1F6FD1' }}>({breakPct}%)</Text>
                    </Text>
                    <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>Mete partendo in D</Text>
                </View>

                {/* 4-6. Break (Unione di Break/Occasioni e TO Loro) */}
                <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                    <Text style={[styles.kpiHeading, { color: '#1F6FD1' }]}>BREAK</Text>
                    <Text style={[styles.kpiVal, { color: theme.colors.text }]}>
                        {tStats.breaks}/{tStats.breakChances} {tStats.breakChances > 0 ? <Text style={{ fontSize: 11, color: '#1F6FD1' }}>({breakEffPct}%)</Text> : null}
                    </Text>
                    <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>
                        Conv./occasioni · TO loro: {tStats.toThem}
                    </Text>
                </View>

                {/* 5. Turnover Nostri */}
                <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                    <Text style={[styles.kpiHeading, { color: '#C8323C' }]}>TURNOVER NOSTRI</Text>
                    <Text style={[styles.kpiVal, { color: '#C8323C' }]}>{tStats.toUs}</Text>
                    <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>Dischi persi da Bubba</Text>
                </View>

                {/* 7. Durata Media */}
                <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                    <Text style={[styles.kpiHeading, { color: theme.colors.textSecondary }]}>DURATA MEDIA</Text>
                    <Text style={[styles.kpiVal, { color: theme.colors.text }]}>
                        {tStats.durN ? Math.round(tStats.durSum / tStats.durN) + 's' : '–'}
                    </Text>
                    <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>Secondi medi per punto</Text>
                </View>
            </View>
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
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    kpiItem: {
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 74,
    },
    kpiItemMobile: {
        width: '48%',
    },
    kpiItemDesktop: {
        flex: 1,
        minWidth: 100,
    },
    kpiHeading: {
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 3,
        textAlign: 'center',
    },
    kpiVal: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    kpiLbl: {
        fontSize: 10.5,
        textAlign: 'center',
    },
});

export default TeamKpiCard;
