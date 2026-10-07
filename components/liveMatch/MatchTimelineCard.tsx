// components/liveMatch/MatchTimelineCard.tsx
// Scheda cronologia interattiva Play-by-Play per meta con filtri, eventi chiave e statistiche di punto

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { DerivedPoint, pullZone } from '../../utils/statsEngine';
import { MatchEvent } from '../../services/firestore/types';

interface MatchTimelineCardProps {
    points: DerivedPoint[];
    rawEvents?: MatchEvent[];
    P: (id: string) => { name: string; g: 'M' | 'F' };
    opponentName?: string;
    isMobile: boolean;
}

type FilterType = 'all' | 'breaks' | 'turnovers' | 'defenses';

export default function MatchTimelineCard({
    points,
    rawEvents = [],
    P,
    opponentName = 'Avversari',
    isMobile,
}: MatchTimelineCardProps) {
    const { theme } = useTheme();

    const [filter, setFilter] = useState<FilterType>('all');
    const [expandedSet, setExpandedSet] = useState<Set<number>>(() => {
        // Di default espandiamo le ultime 3 mete per immediatezza
        const initial = new Set<number>();
        const total = points.length;
        for (let i = Math.max(1, total - 2); i <= total; i++) {
            initial.add(i);
        }
        return initial;
    });

    // Calcolo punteggi progressivi per ogni meta
    const pointsWithScore = useMemo(() => {
        let us = 0;
        let them = 0;
        return points.map((pt, idx) => {
            const ptNum = pt.n || (idx + 1);
            if (pt.result === 'us') us++;
            else if (pt.result === 'them') them++;

            // Calcolo esito
            let outcomeTitle = '';
            let outcomeColor = '';
            let isBreak = false;

            if (pt.o) {
                if (pt.result === 'us') {
                    outcomeTitle = pt.toUs === 0 ? 'Meta fatta (Clean)' : 'Meta fatta';
                    outcomeColor = '#2E8540';
                } else if (pt.result === 'them') {
                    outcomeTitle = 'Meta subita (Break)';
                    outcomeColor = '#C8323C';
                } else {
                    outcomeTitle = 'In corso';
                    outcomeColor = '#718096';
                }
            } else {
                if (pt.result === 'us') {
                    outcomeTitle = '⚡ Meta fatta (Break)';
                    outcomeColor = '#1F6FD1';
                    isBreak = true;
                } else if (pt.result === 'them') {
                    outcomeTitle = 'Meta subita';
                    outcomeColor = '#E07A1F';
                } else {
                    outcomeTitle = 'In corso';
                    outcomeColor = '#718096';
                }
            }

            const dsetEv = (pt.ev || []).find(e => e.k === 'dset');
            const defenseScheme = dsetEv ? (dsetEv as any).v : null;
            const hasTO = (pt.toUs > 0) || (pt.toThem > 0);
            const hasDefense = !pt.o || (pt.toUs > 0) || (pt.ev || []).some(e => e.k === 'd' || e.k === 'call');

            return {
                pt,
                ptNum,
                scoreUs: us,
                scoreThem: them,
                outcomeTitle,
                outcomeColor,
                isBreak,
                hasTO,
                hasDefense,
                defenseScheme,
            };
        });
    }, [points]);

    // Filtraggio mete
    const filteredPoints = useMemo(() => {
        return pointsWithScore.filter(item => {
            if (filter === 'breaks') return item.isBreak;
            if (filter === 'turnovers') return item.hasTO;
            if (filter === 'defenses') return item.hasDefense;
            return true;
        });
    }, [pointsWithScore, filter]);

    const toggleExpand = (ptNum: number) => {
        setExpandedSet(prev => {
            const next = new Set(prev);
            if (next.has(ptNum)) next.delete(ptNum);
            else next.add(ptNum);
            return next;
        });
    };

    const expandAll = () => {
        setExpandedSet(new Set(pointsWithScore.map(p => p.ptNum)));
    };

    const collapseAll = () => {
        setExpandedSet(new Set());
    };

    // Conteggi per i filtri
    const countBreaks = pointsWithScore.filter(p => p.isBreak).length;
    const countTOs = pointsWithScore.filter(p => p.hasTO).length;
    const countDef = pointsWithScore.filter(p => p.hasDefense).length;

    return (
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {/* Header del blocco con titolo e azioni espandi/collassa */}
            <View style={styles.headerRow}>
                <View>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                        📖 Cronologia Partita ({points.length} mete)
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                        Dettaglio punto per punto · schemi difensivi, turnover ed esiti
                    </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: theme.dark ? '#334155' : '#E2E8F0' }]}
                        onPress={expandAll}
                    >
                        <Text style={[styles.smallBtnText, { color: theme.colors.text }]}>Espandi</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: theme.dark ? '#334155' : '#E2E8F0' }]}
                        onPress={collapseAll}
                    >
                        <Text style={[styles.smallBtnText, { color: theme.colors.text }]}>Chiudi</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Filtri rapidi a pillole */}
            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={[
                        styles.filterPill,
                        filter === 'all' && styles.filterPillActive,
                        { borderColor: theme.colors.border }
                    ]}
                    onPress={() => setFilter('all')}
                >
                    <Text style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive, { color: filter === 'all' ? '#FFFFFF' : theme.colors.text }]}>
                        Tutte ({points.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.filterPill,
                        filter === 'breaks' && styles.filterPillActive,
                        { borderColor: theme.colors.border }
                    ]}
                    onPress={() => setFilter('breaks')}
                >
                    <Text style={[styles.filterPillText, filter === 'breaks' && styles.filterPillTextActive, { color: filter === 'breaks' ? '#FFFFFF' : theme.colors.text }]}>
                        ⚡ Solo Break ({countBreaks})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.filterPill,
                        filter === 'turnovers' && styles.filterPillActive,
                        { borderColor: theme.colors.border }
                    ]}
                    onPress={() => setFilter('turnovers')}
                >
                    <Text style={[styles.filterPillText, filter === 'turnovers' && styles.filterPillTextActive, { color: filter === 'turnovers' ? '#FFFFFF' : theme.colors.text }]}>
                        🔄 Con Turnover ({countTOs})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.filterPill,
                        filter === 'defenses' && styles.filterPillActive,
                        { borderColor: theme.colors.border }
                    ]}
                    onPress={() => setFilter('defenses')}
                >
                    <Text style={[styles.filterPillText, filter === 'defenses' && styles.filterPillTextActive, { color: filter === 'defenses' ? '#FFFFFF' : theme.colors.text }]}>
                        🛡️ Con Difesa ({countDef})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Lista delle mete filtrate */}
            {filteredPoints.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                        Nessuna meta corrisponde al filtro selezionato.
                    </Text>
                </View>
            ) : (
                <View style={{ gap: 8, marginTop: 8 }}>
                    {filteredPoints.map(item => {
                        const isExpanded = expandedSet.has(item.ptNum);
                        const { pt } = item;

                        // Raggruppamento o filtraggio eventi significativi del punto
                        // Escludiamo 'start' e compattiamo tocchi ripetuti
                        const events = pt.ev || [];
                        const significantEvents = events.filter(e => e.k !== 'start' && e.k !== 'touch');
                        const touchCount = events.filter(e => e.k === 'touch').length;

                        // Calcolo durata se presente
                        let durationStr = '';
                        if (pt.t0 && pt.t1) {
                            const diffSec = Math.round((pt.t1 - pt.t0) / 1000);
                            if (diffSec > 0) {
                                const m = Math.floor(diffSec / 60);
                                const s = diffSec % 60;
                                durationStr = `${m}:${s < 10 ? '0' : ''}${s}`;
                            }
                        }

                        return (
                            <View
                                key={`pt-${item.ptNum}`}
                                style={[
                                    styles.pointAccordion,
                                    {
                                        backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC',
                                        borderColor: isExpanded ? theme.colors.border : (theme.dark ? '#334155' : '#E2E8F0')
                                    }
                                ]}
                            >
                                {/* Intestazione Meta Cliccabile */}
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={styles.pointHeader}
                                    onPress={() => toggleExpand(item.ptNum)}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                                        <Text style={[styles.ptNumberText, { color: theme.colors.text }]}>
                                            Meta #{item.ptNum}
                                        </Text>

                                        {/* Ruolo di partenza */}
                                        <View style={[
                                            styles.badge,
                                            { backgroundColor: pt.o ? '#C8323C20' : '#1F6FD120', borderColor: pt.o ? '#C8323C50' : '#1F6FD150' }
                                        ]}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: pt.o ? '#C8323C' : '#1F6FD1' }}>
                                                {pt.o ? 'Attacco (O)' : 'Difesa (D)'}
                                            </Text>
                                        </View>

                                        {/* Schema difesa se applicato */}
                                        {item.defenseScheme && (
                                            <View style={[styles.badge, { backgroundColor: '#E07A1F20', borderColor: '#E07A1F60' }]}>
                                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#E07A1F' }}>
                                                    🛡️ {item.defenseScheme.toUpperCase()}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Turnover nella meta */}
                                        <View style={[
                                            styles.badge,
                                            {
                                                backgroundColor: item.hasTO ? '#C8323C15' : '#2E854015',
                                                borderColor: item.hasTO ? '#C8323C40' : '#2E854040'
                                            }
                                        ]}>
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: item.hasTO ? '#C8323C' : '#2E8540' }}>
                                                {item.hasTO ? `🔄 TO: ${pt.toUs}-${pt.toThem}` : '🔄 Clean (0 TO)'}
                                            </Text>
                                        </View>

                                        {durationStr !== '' && (
                                            <Text style={{ fontSize: 10.5, color: theme.colors.textSecondary }}>
                                                ⏱️ {durationStr}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Punteggio progressivo ed esito a destra */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={[styles.scoreText, { color: theme.colors.text }]}>
                                            {item.scoreUs} - {item.scoreThem}
                                        </Text>
                                        <View style={[styles.outcomeBadge, { backgroundColor: item.outcomeColor + '20', borderColor: item.outcomeColor }]}>
                                            <Text style={[styles.outcomeBadgeText, { color: item.outcomeColor }]}>
                                                {item.outcomeTitle}
                                            </Text>
                                        </View>
                                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginLeft: 2 }}>
                                            {isExpanded ? '▲' : '▼'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                {/* Corpo espanso: Formazione ed Eventi */}
                                {isExpanded && (
                                    <View style={[styles.pointBody, { borderTopColor: theme.dark ? '#334155' : '#E2E8F0' }]}>
                                        {/* Quintetto in campo */}
                                        <View style={styles.lineupRow}>
                                            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                                                FORMAZIONE IN CAMPO ({pt.line?.length || 0}):
                                            </Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                                {(pt.line || []).map(pId => {
                                                    const player = P(pId);
                                                    const isF = player.g === 'F';
                                                    return (
                                                        <View
                                                            key={pId}
                                                            style={[
                                                                styles.playerChip,
                                                                { backgroundColor: isF ? '#B8338A18' : '#1F6FD118', borderColor: isF ? '#B8338A40' : '#1F6FD140' }
                                                            ]}
                                                        >
                                                            <View style={[styles.dotGender, { backgroundColor: isF ? '#B8338A' : '#1F6FD1' }]} />
                                                            <Text style={[styles.playerChipText, { color: theme.colors.text }]}>
                                                                {player.name}
                                                            </Text>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </View>

                                        {/* Timeline verticale degli eventi */}
                                        <View style={styles.timelineContainer}>
                                            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
                                                SEQUENZA EVENTI {touchCount > 0 ? `(${touchCount} tocchi disco totali)` : ''}:
                                            </Text>

                                            {/* Evento Pull */}
                                            {pt.pull && (
                                                <View style={styles.eventRow}>
                                                    <View style={[styles.eventDot, { backgroundColor: '#1F6FD1' }]}>
                                                        <Text style={styles.eventDotIcon}>🚀</Text>
                                                    </View>
                                                    <View style={styles.eventContent}>
                                                        <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
                                                            {pt.pull.team === 'us'
                                                                ? `Pull effettuato da ${pt.pull.p ? P(pt.pull.p).name : 'Bubba'}`
                                                                : `Pull avversario (${opponentName})`}
                                                        </Text>
                                                        <Text style={[styles.eventSub, { color: theme.colors.textSecondary }]}>
                                                            Zona: {pullZone(pt.pull) || 'In campo'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}

                                            {/* Eventi principali del punto */}
                                            {significantEvents.length === 0 && !pt.pull ? (
                                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontStyle: 'italic', marginLeft: 24 }}>
                                                    Nessun evento registrato per questa meta.
                                                </Text>
                                            ) : (
                                                significantEvents.map((e, eIdx) => {
                                                    const parsed = renderEventDetails(e, P, opponentName, theme);
                                                    return (
                                                        <View key={`ev-${eIdx}`} style={styles.eventRow}>
                                                            <View style={[styles.eventDot, { backgroundColor: parsed.color + '25', borderColor: parsed.color }]}>
                                                                <Text style={styles.eventDotIcon}>{parsed.icon}</Text>
                                                            </View>
                                                            <View style={styles.eventContent}>
                                                                <Text style={[styles.eventTitle, { color: parsed.color }]}>
                                                                    {parsed.title}
                                                                </Text>
                                                                {parsed.desc ? (
                                                                    <Text style={[styles.eventSub, { color: theme.colors.textSecondary }]}>
                                                                        {parsed.desc}
                                                                    </Text>
                                                                ) : null}
                                                            </View>
                                                        </View>
                                                    );
                                                })
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

// Funzione di supporto per formattare con icone e colori ogni tipo di evento
function renderEventDetails(
    e: MatchEvent,
    P: (id: string) => { name: string; g: 'M' | 'F' },
    opponentName: string,
    theme: any
): { icon: string; title: string; desc: string; color: string } {
    switch (e.k) {
        case 'goal': {
            const scorer = e.s ? P(e.s).name : 'Sconosciuto';
            const assist = e.a ? P(e.a).name : null;
            return {
                icon: '🏆',
                title: `GOL BUBBA! Realizzato da ${scorer}`,
                desc: assist ? `Assist fornito da ${assist}` : 'Assist non registrato',
                color: '#2E8540',
            };
        }
        case 'call': {
            const defender = e.p ? P(e.p).name : 'Giocatore';
            return {
                icon: '⭐',
                title: `CALLAHAN GOAL! Realizzato da ${defender}`,
                desc: 'Intercetto direttamente nella meta avversaria',
                color: '#D97706',
            };
        }
        case 'tg': {
            return {
                icon: '⚠️',
                title: `Meta avversaria (${opponentName})`,
                desc: 'Punto segnato dalla squadra avversaria',
                color: '#C8323C',
            };
        }
        case 'd': {
            const defender = e.p ? P(e.p).name : 'Bubba';
            return {
                icon: '🛡️',
                title: `DIFESA / Intercetto: ${defender}`,
                desc: 'Disco recuperato con intercetto o knockdown',
                color: '#1F6FD1',
            };
        }
        case 'err': {
            return {
                icon: '🔄',
                title: `Turnover avversario (${opponentName})`,
                desc: 'Errore di lancio o presa degli avversari (possesso a Bubba)',
                color: '#2563EB',
            };
        }
        case 'tt': {
            const thrower = e.p ? P(e.p).name : 'Giocatore';
            return {
                icon: '❌',
                title: `Turnover lancio: ${thrower}`,
                desc: 'Passaggio non andato a buon fine',
                color: '#C8323C',
            };
        }
        case 'td': {
            const receiver = e.p ? P(e.p).name : 'Giocatore';
            return {
                icon: '❌',
                title: `Turnover presa (Drop): ${receiver}`,
                desc: 'Disco caduto su ricezione',
                color: '#C8323C',
            };
        }
        case 'ts': {
            const handler = e.p ? P(e.p).name : 'Giocatore';
            return {
                icon: '⏱️',
                title: `Stall Out subito: ${handler}`,
                desc: 'Tempo di possesso esaurito (conteggio)',
                color: '#9E2A31',
            };
        }
        case 'tx': {
            return {
                icon: '❌',
                title: 'Turnover (Altro)',
                desc: 'Infrazione o perdita di possesso generica',
                color: '#C8323C',
            };
        }
        case 'dset': {
            return {
                icon: '🛡️',
                title: `Schema difesa impostato: ${(e as any).v?.toUpperCase()}`,
                desc: 'Chiamata tattica difensiva per questo punto',
                color: '#E07A1F',
            };
        }
        case 'line': {
            const reason = (e as any).reason === 'injury' ? 'Sostituzione per infortunio' : 'Cambio linea';
            const players = ((e as any).line || []).map((id: string) => P(id).name).join(', ');
            return {
                icon: '👥',
                title: reason,
                desc: `Nuovo quintetto: ${players}`,
                color: '#6B7280',
            };
        }
        case 'halftime': {
            return {
                icon: '⏸️',
                title: 'INTERVALLO (Half Time)',
                desc: 'Fine del primo tempo · Inversione dei ruoli',
                color: '#4B5563',
            };
        }
        default:
            return {
                icon: '•',
                title: e.k,
                desc: '',
                color: theme.colors.textSecondary,
            };
    }
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        marginBottom: 16,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    smallBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    smallBtnText: {
        fontSize: 11,
        fontWeight: '700',
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    filterPill: {
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 16,
        borderWidth: 1,
    },
    filterPillActive: {
        backgroundColor: '#003057',
        borderColor: '#003057',
    },
    filterPillText: {
        fontSize: 11,
        fontWeight: '700',
    },
    filterPillTextActive: {
        color: '#FFFFFF',
    },
    emptyBox: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    pointAccordion: {
        borderRadius: 10,
        borderWidth: 1,
        overflow: 'hidden',
    },
    pointHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        flexWrap: 'wrap',
        gap: 6,
    },
    ptNumberText: {
        fontSize: 13,
        fontWeight: '800',
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
    },
    scoreText: {
        fontSize: 13,
        fontWeight: '800',
    },
    outcomeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
    },
    outcomeBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    pointBody: {
        borderTopWidth: 1,
        padding: 10,
        backgroundColor: 'transparent',
    },
    lineupRow: {
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    playerChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
    },
    dotGender: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    playerChipText: {
        fontSize: 11,
        fontWeight: '700',
    },
    timelineContainer: {
        paddingLeft: 4,
    },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 8,
    },
    eventDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginTop: 1,
    },
    eventDotIcon: {
        fontSize: 11,
    },
    eventContent: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 12,
        fontWeight: '700',
    },
    eventSub: {
        fontSize: 11,
        marginTop: 1,
    },
});
