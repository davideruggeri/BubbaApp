// components/liveMatch/CompletedMatchSummary.tsx
// Componente riassuntivo a partita conclusa con risultato, KPI e blocco azioni

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface CompletedMatchSummaryProps {
    scoreUs: number;
    scoreThem: number;
    opponent: string;
    pointsCount: number;
    eventsCount: number;
    holds: number;
    breaks: number;
    toUs: number;
    toThem: number;
    isStaff: boolean;
    onOpenRoster: () => void;
    onToggleDone: () => void;
    onOpenStats: () => void;
}

export const CompletedMatchSummary: React.FC<CompletedMatchSummaryProps> = React.memo(({
    scoreUs,
    scoreThem,
    opponent,
    pointsCount,
    eventsCount,
    holds,
    breaks,
    toUs,
    toThem,
    isStaff,
    onOpenRoster,
    onToggleDone,
    onOpenStats,
}) => {
    const { theme } = useTheme();

    const isWin = scoreUs > scoreThem;
    const isTie = scoreUs === scoreThem;
    const resultLabel = isTie ? 'PAREGGIO' : isWin ? 'VITTORIA 🎉' : 'SCONFITTA';
    const resultBg = isTie ? '#78909C' : isWin ? '#2E8540' : '#E65100';

    return (
        <View style={{ padding: 16, gap: 14 }}>
            {/* Card Risultato Finale */}
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, alignItems: 'center', paddingVertical: 20 }]}>
                <View style={{ backgroundColor: resultBg, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, marginBottom: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 }}>
                        {resultLabel}
                    </Text>
                </View>

                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 }}>
                    RISULTATO FINALE
                </Text>
                <Text style={{ fontSize: 32, fontWeight: '900', color: theme.colors.text }}>
                    BUBBA {scoreUs} – {scoreThem} {opponent.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 }}>
                    {pointsCount} punti disputati · {eventsCount} azioni registrate
                </Text>

                {/* KPI Rapidi Partita */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 18, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 14 }}>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#2E8540' }}>{holds}</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Hold</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#003057' }}>{breaks}</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Break</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#C8323C' }}>{toUs}</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>TO Nostri</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.primary }}>{toThem}</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>TO Loro</Text>
                    </View>
                </View>
            </View>

            {/* Banner Azioni Bloccate */}
            <View style={[styles.lockedBanner, { backgroundColor: '#ECEFF1', borderColor: '#B0BEC5', marginHorizontal: 0, marginTop: 0 }]}>
                <Text style={styles.lockedTitle}>🔒 REGISTRAZIONE EVENTI BLOCCATA</Text>
                <Text style={styles.lockedSub}>
                    La partita è chiusa. La selezione della linea e l'avvio di ulteriori punti sono disabilitati.
                </Text>
                {isStaff && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <TouchableOpacity
                            style={{
                                backgroundColor: '#003057',
                                paddingHorizontal: 12,
                                paddingVertical: 7,
                                borderRadius: 6
                            }}
                            onPress={onOpenRoster}
                        >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                                👥 Convocati & Roster
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{
                                backgroundColor: '#5B6570',
                                paddingHorizontal: 12,
                                paddingVertical: 7,
                                borderRadius: 6
                            }}
                            onPress={onToggleDone}
                        >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                                🔓 Riapri Partita
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Pulsante rapido statistiche */}
            <TouchableOpacity
                style={{
                    backgroundColor: theme.colors.primary,
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 4
                }}
                onPress={onOpenStats}
            >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                    📊 Consulta Statistiche e Tabella Giocatori ➔
                </Text>
            </TouchableOpacity>
        </View>
    );
});

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
    },
    lockedBanner: {
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
    },
    lockedTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#37474F',
        marginBottom: 4,
    },
    lockedSub: {
        fontSize: 12,
        color: '#607D8B',
        lineHeight: 16,
    },
});

export default CompletedMatchSummary;
