// components/liveMatch/MatchTimelineCard.tsx
// Scheda cronologia interattiva Play-by-Play per meta con filtri, eventi chiave e statistiche di punto

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { DerivedPoint, pullZone } from '../../utils/statsEngine';
import { MatchEvent } from '../../services/firestore/types';
import { MatchAnalysis } from '../../services/firestore';

interface MatchTimelineCardProps {
    points: DerivedPoint[];
    rawEvents?: MatchEvent[];
    P: (id: string) => { name: string; g: 'M' | 'F' };
    opponentName?: string;
    isMobile: boolean;
    canEdit?: boolean;
    match?: MatchAnalysis;
    onUpdateGoalEvent?: (eventIndex: number, updated: { s?: string | null; a?: string | null }) => Promise<void>;
    onUpdatePointLine?: (pointNumber: number, oldPlayerId: string, newPlayerId: string) => Promise<void>;
    onInsertTouches?: (beforeRawEventIndex: number, playerIds: string[]) => Promise<void>;
    onInsertTouchPhases?: (phases: Array<{ beforeRawEventIndex: number; playerIds: string[] }>) => Promise<void>;
}

interface EditingGoalData {
    event: MatchEvent;
    eventIndex: number;
    point: DerivedPoint;
    scorer: string | null;
    assist: string | null;
}

interface EditingLineData {
    pointNumber: number;
    point: DerivedPoint;
    currentLine: string[];
    selectedOldPlayerId: string | null;
    selectedNewPlayerId: string | null;
}

type FilterType = 'all' | 'breaks' | 'turnovers' | 'defenses';

export default function MatchTimelineCard({
    points,
    rawEvents = [],
    P,
    opponentName = 'Avversari',
    isMobile,
    canEdit = false,
    match,
    onUpdateGoalEvent,
    onUpdatePointLine,
    onInsertTouches,
    onInsertTouchPhases,
}: MatchTimelineCardProps) {
    const { theme } = useTheme();

    const [filter, setFilter] = useState<FilterType>('all');
    const [editingGoal, setEditingGoal] = useState<EditingGoalData | null>(null);
    const [isSavingGoal, setIsSavingGoal] = useState<boolean>(false);
    const [editingLine, setEditingLine] = useState<EditingLineData | null>(null);
    const [isSavingLine, setIsSavingLine] = useState<boolean>(false);

    // Stato per l'arricchimento video — un pannello per meta con fasi di attacco
    const [enrichingPtNum, setEnrichingPtNum] = useState<number | null>(null);
    const [phaseSeqs, setPhaseSeqs] = useState<Record<string, string[]>>({});
    const [activePhasePicker, setActivePhasePicker] = useState<number | null>(null);
    const [savingTouches, setSavingTouches] = useState(false);
    const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());

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

    const rosterList = useMemo(() => {
        const list: { id: string; name: string; g: 'M' | 'F' }[] = [];
        const seen = new Set<string>();

        if (match?.customRoster && match.customRoster.length > 0) {
            match.customRoster.forEach(p => {
                if (!seen.has(p.id)) {
                    seen.add(p.id);
                    list.push({ id: p.id, name: p.name, g: p.g });
                }
            });
        }

        points.forEach(pt => {
            (pt.line || []).forEach(id => {
                if (!seen.has(id)) {
                    seen.add(id);
                    const p = P(id);
                    list.push({ id, name: p.name, g: p.g });
                }
            });
        });

        list.sort((a, b) => a.name.localeCompare(b.name));
        return list;
    }, [match?.customRoster, points, P]);

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
                        // Escludiamo 'start', 'touch' e 'pull' (il pull ha già il suo riquadro dedicato sopra)
                        const events = pt.ev || [];
                        const significantEvents = events.filter(e => e.k !== 'start' && e.k !== 'touch' && e.k !== 'pull');
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
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                                                    FORMAZIONE IN CAMPO ({pt.line?.length || 0}):
                                                </Text>
                                                {!!onUpdatePointLine && (
                                                    <TouchableOpacity
                                                        style={{
                                                            paddingHorizontal: 8,
                                                            paddingVertical: 3,
                                                            borderRadius: 6,
                                                            backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                                            borderWidth: 1,
                                                            borderColor: theme.dark ? '#334155' : '#CBD5E1',
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                        }}
                                                        onPress={() => {
                                                            const currentLine = pt.line ? [...pt.line] : [];
                                                            setEditingLine({
                                                                pointNumber: item.ptNum,
                                                                point: pt,
                                                                currentLine,
                                                                selectedOldPlayerId: currentLine[0] || null,
                                                                selectedNewPlayerId: null,
                                                            });
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 10 }}>✏️</Text>
                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.text }}>Modifica Linea</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
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
                                                    const rawIdx = rawEvents.findIndex(re => re === e || (re.k === e.k && re.t === e.t && re.s === e.s && re.a === e.a));

                                                    return (
                                                        <View key={`ev-${eIdx}`} style={[styles.eventRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
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

                                                            {!!onUpdateGoalEvent && e.k === 'goal' && (
                                                                <TouchableOpacity
                                                                    style={{
                                                                        paddingHorizontal: 8,
                                                                        paddingVertical: 5,
                                                                        borderRadius: 6,
                                                                        backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                                                        borderWidth: 1,
                                                                        borderColor: theme.dark ? '#334155' : '#CBD5E1',
                                                                        flexDirection: 'row',
                                                                        alignItems: 'center',
                                                                        gap: 4,
                                                                        marginLeft: 8,
                                                                    }}
                                                                    onPress={() => {
                                                                        if (rawIdx !== -1) {
                                                                            setEditingGoal({
                                                                                event: e,
                                                                                eventIndex: rawIdx,
                                                                                point: pt,
                                                                                scorer: e.s || null,
                                                                                assist: e.a || null,
                                                                            });
                                                                        }
                                                                    }}
                                                                >
                                                                    <Text style={{ fontSize: 11 }}>✏️</Text>
                                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.text }}>Modifica</Text>
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    );
                                                })
                                            )}
                                        </View>

                                        {/* Bottone/Pannello Arricchimento Video (uno per meta) */}
                                        {!!onInsertTouchPhases && (
                                            enrichingPtNum === item.ptNum ? (() => {
                                                const attackPhases = getAttackPhases(pt, rawEvents, P, opponentName);
                                                const hasAnySeq = Object.values(phaseSeqs).some(s => s.length > 0);
                                                return (
                                                    <View style={{ marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: theme.dark ? '#0F172A' : '#EFF6FF', borderWidth: 1.5, borderColor: '#3B82F6' }}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#3B82F6' }}>
                                                                📹 Arricchisci Meta #{item.ptNum}
                                                            </Text>
                                                            <TouchableOpacity
                                                                onPress={() => { setEnrichingPtNum(null); setPhaseSeqs({}); setActivePhasePicker(null); }}
                                                                style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: theme.dark ? '#1E293B' : '#DBEAFE', borderRadius: 8 }}
                                                            >
                                                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#3B82F6' }}>✕ Chiudi</Text>
                                                            </TouchableOpacity>
                                                        </View>

                                                        {attackPhases.length === 0 ? (
                                                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                                                                Nessuna fase di attacco trovata per questa meta.
                                                            </Text>
                                                        ) : (
                                                            attackPhases.map(phase => {
                                                                const seqKey = `${item.ptNum}_${phase.phaseIdx}`;
                                                                const seq = phaseSeqs[seqKey] || [];
                                                                const isActive = activePhasePicker === phase.phaseIdx;
                                                                return (
                                                                    <View key={`ph-${phase.phaseIdx}`} style={{ marginBottom: 10, padding: 8, borderRadius: 8, backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC', borderWidth: 1, borderColor: theme.dark ? '#334155' : '#CBD5E1' }}>
                                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 4 }}>
                                                                            ⚔️ {phase.label}
                                                                        </Text>
                                                                        {phase.existingTouches.length > 0 && (
                                                                            <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginBottom: 4 }}>
                                                                                Già registrati: {phase.existingTouches.map(pid => P(pid).name).join(' → ')}
                                                                            </Text>
                                                                        )}
                                                                        {isActive ? (
                                                                            <View>
                                                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8, minHeight: 24 }}>
                                                                                    {seq.length === 0 ? (
                                                                                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontStyle: 'italic' }}>Tocca i giocatori in ordine →</Text>
                                                                                    ) : (
                                                                                        seq.map((pid, i) => (
                                                                                            <React.Fragment key={`ts-${i}`}>
                                                                                                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.dark ? '#93C5FD' : '#1D4ED8' }}>{P(pid).name}</Text>
                                                                                                {i < seq.length - 1 && <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>→</Text>}
                                                                                            </React.Fragment>
                                                                                        ))
                                                                                    )}
                                                                                </View>
                                                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                                                                    {(pt.line || []).map(pid => (
                                                                                        <TouchableOpacity
                                                                                            key={pid}
                                                                                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.dark ? '#1E3A5F' : '#DBEAFE', borderWidth: 1.5, borderColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                                                                            onPress={() => setPhaseSeqs(prev => ({ ...prev, [seqKey]: [...(prev[seqKey] || []), pid] }))}
                                                                                            activeOpacity={0.7}
                                                                                        >
                                                                                            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: P(pid).g === 'F' ? '#B8338A' : '#1F6FD1' }} />
                                                                                            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.dark ? '#93C5FD' : '#1D4ED8' }}>{P(pid).name}</Text>
                                                                                        </TouchableOpacity>
                                                                                    ))}
                                                                                </View>
                                                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                                                    <TouchableOpacity
                                                                                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, backgroundColor: theme.dark ? '#334155' : '#E2E8F0' }}
                                                                                        onPress={() => setPhaseSeqs(prev => ({ ...prev, [seqKey]: (prev[seqKey] || []).slice(0, -1) }))}
                                                                                        disabled={seq.length === 0}
                                                                                    >
                                                                                        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text }}>↩ Annulla</Text>
                                                                                    </TouchableOpacity>
                                                                                    <TouchableOpacity
                                                                                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, backgroundColor: theme.dark ? '#334155' : '#E2E8F0' }}
                                                                                        onPress={() => setActivePhasePicker(null)}
                                                                                    >
                                                                                        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text }}>✓ Fatto</Text>
                                                                                    </TouchableOpacity>
                                                                                </View>
                                                                            </View>
                                                                        ) : (
                                                                            <TouchableOpacity
                                                                                style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: seq.length > 0 ? (theme.dark ? '#1B4332' : '#DCFCE7') : (theme.dark ? '#1E293B' : '#F1F5F9'), borderWidth: 1, borderColor: seq.length > 0 ? '#22C55E' : '#3B82F6', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                                                                onPress={() => setActivePhasePicker(phase.phaseIdx)}
                                                                            >
                                                                                <Text style={{ fontSize: 11, fontWeight: '700', color: seq.length > 0 ? '#22C55E' : '#3B82F6' }}>
                                                                                    {seq.length > 0 ? `✓ ${seq.length} tocchi` : '+ Aggiungi tocchi'}
                                                                                </Text>
                                                                            </TouchableOpacity>
                                                                        )}
                                                                    </View>
                                                                );
                                                            })
                                                        )}

                                                        {attackPhases.length > 0 && (
                                                            <TouchableOpacity
                                                                style={{ paddingVertical: 9, borderRadius: 8, backgroundColor: hasAnySeq ? '#003057' : '#94A3B8', alignItems: 'center', marginTop: 4 }}
                                                                disabled={!hasAnySeq || savingTouches}
                                                                onPress={async () => {
                                                                    if (!onInsertTouchPhases) return;
                                                                    const toSave = attackPhases
                                                                        .filter(ph => (phaseSeqs[`${item.ptNum}_${ph.phaseIdx}`] || []).length > 0)
                                                                        .map(ph => ({
                                                                            beforeRawEventIndex: ph.endRawIdx,
                                                                            playerIds: phaseSeqs[`${item.ptNum}_${ph.phaseIdx}`] || [],
                                                                        }));
                                                                    if (!toSave.length) return;
                                                                    setSavingTouches(true);
                                                                    try {
                                                                        await onInsertTouchPhases(toSave);
                                                                        setEnrichingPtNum(null);
                                                                        setPhaseSeqs({});
                                                                        setActivePhasePicker(null);
                                                                    } finally {
                                                                        setSavingTouches(false);
                                                                    }
                                                                }}
                                                            >
                                                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
                                                                    {savingTouches ? 'Salvataggio...' : '💾 Salva tocchi'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                );
                                            })() : (
                                                <TouchableOpacity
                                                    style={{ alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.dark ? '#0F172A' : '#EFF6FF' }}
                                                    onPress={() => { setEnrichingPtNum(item.ptNum); setPhaseSeqs({}); setActivePhasePicker(null); }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={{ fontSize: 11, color: '#3B82F6' }}>📹</Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#3B82F6' }}>Arricchisci tocchi</Text>
                                                </TouchableOpacity>
                                            )
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Modal Modifica Gol & Assist */}
            <Modal
                visible={!!editingGoal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setEditingGoal(null)}
            >
                <TouchableOpacity
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 16,
                    }}
                    activeOpacity={1}
                    onPress={() => setEditingGoal(null)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={ev => ev.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 420,
                            maxHeight: '90%',
                            backgroundColor: theme.colors.card,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: theme.colors.border,
                            padding: 20,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 10,
                            elevation: 10,
                        }}
                    >
                        {editingGoal && (() => {
                            const pointLine = editingGoal.point?.line || [];
                            const candidatePlayers: string[] = pointLine.length > 0
                                ? pointLine
                                : (match?.customRoster?.map(r => r.id) || (match?.players?.map((p: any) => p.id) || []));

                            const handleSaveGoal = async () => {
                                if (!editingGoal || !onUpdateGoalEvent) return;
                                setIsSavingGoal(true);
                                try {
                                    await onUpdateGoalEvent(editingGoal.eventIndex, {
                                        s: editingGoal.scorer,
                                        a: editingGoal.assist,
                                    });
                                    setEditingGoal(null);
                                } finally {
                                    setIsSavingGoal(false);
                                }
                            };

                            return (
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <View style={{ backgroundColor: '#2E8540', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                                                🏆 Modifica Gol & Assist (Meta #{editingGoal.point.n})
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setEditingGoal(null)}
                                            style={{
                                                padding: 6,
                                                backgroundColor: theme.dark ? '#334155' : '#E2E8F0',
                                                borderRadius: 20,
                                                width: 28,
                                                height: 28,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* 1. Selezione Marcatore */}
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 }}>
                                        Chi ha segnato la meta:
                                    </Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                        {candidatePlayers.map((pId: string) => {
                                            const isSel = editingGoal.scorer === pId;
                                            return (
                                                <TouchableOpacity
                                                    key={pId}
                                                    onPress={() => setEditingGoal(prev => prev ? { ...prev, scorer: pId } : null)}
                                                    style={{
                                                        paddingHorizontal: 11,
                                                        paddingVertical: 7,
                                                        borderRadius: 8,
                                                        backgroundColor: isSel
                                                            ? (theme.dark ? '#2563EB' : '#003057')
                                                            : (theme.dark ? '#1E293B' : '#F1F5F9'),
                                                        borderWidth: 1.5,
                                                        borderColor: isSel
                                                            ? (theme.dark ? '#60A5FA' : '#003057')
                                                            : (theme.dark ? '#334155' : theme.colors.border),
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: isSel ? 'bold' : '600',
                                                            color: isSel ? '#FFFFFF' : theme.colors.text,
                                                        }}
                                                    >
                                                        {P(pId).name}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {/* 2. Selezione Assist */}
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 }}>
                                        Chi ha fatto l'assist:
                                    </Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                        <TouchableOpacity
                                            onPress={() => setEditingGoal(prev => prev ? { ...prev, assist: null } : null)}
                                            style={{
                                                paddingHorizontal: 11,
                                                paddingVertical: 7,
                                                borderRadius: 8,
                                                backgroundColor: editingGoal.assist === null
                                                    ? (theme.dark ? '#2563EB' : '#003057')
                                                    : (theme.dark ? '#1E293B' : '#F1F5F9'),
                                                borderWidth: 1.5,
                                                borderColor: editingGoal.assist === null
                                                    ? (theme.dark ? '#60A5FA' : '#003057')
                                                    : (theme.dark ? '#334155' : theme.colors.border),
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    fontWeight: editingGoal.assist === null ? 'bold' : '600',
                                                    color: editingGoal.assist === null ? '#FFFFFF' : theme.colors.text,
                                                }}
                                            >
                                                Nessun assist
                                            </Text>
                                        </TouchableOpacity>
                                        {candidatePlayers.map((pId: string) => {
                                            const isSel = editingGoal.assist === pId;
                                            return (
                                                <TouchableOpacity
                                                    key={pId}
                                                    onPress={() => setEditingGoal(prev => prev ? { ...prev, assist: pId } : null)}
                                                    style={{
                                                        paddingHorizontal: 11,
                                                        paddingVertical: 7,
                                                        borderRadius: 8,
                                                        backgroundColor: isSel
                                                            ? (theme.dark ? '#2563EB' : '#003057')
                                                            : (theme.dark ? '#1E293B' : '#F1F5F9'),
                                                        borderWidth: 1.5,
                                                        borderColor: isSel
                                                            ? (theme.dark ? '#60A5FA' : '#003057')
                                                            : (theme.dark ? '#334155' : theme.colors.border),
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: isSel ? 'bold' : '600',
                                                            color: isSel ? '#FFFFFF' : theme.colors.text,
                                                        }}
                                                    >
                                                        {P(pId).name}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {/* Nota informativa tocchi */}
                                    <View
                                        style={{
                                            backgroundColor: theme.dark ? '#1E293B' : '#EFF6FF',
                                            borderRadius: 8,
                                            padding: 10,
                                            marginBottom: 16,
                                            borderWidth: 1,
                                            borderColor: theme.dark ? '#334155' : '#BFDBFE',
                                        }}
                                    >
                                        <Text style={{ fontSize: 11, color: theme.colors.text, lineHeight: 16 }}>
                                            💡 Modificando chi ha segnato o assistito, i tocchi del disco (Tch) e le statistiche individuali verranno ricalcolati automaticamente per entrambi i giocatori.
                                        </Text>
                                    </View>

                                    {/* Bottoni Salva / Annulla */}
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                            onPress={() => setEditingGoal(null)}
                                            style={{
                                                flex: 1,
                                                paddingVertical: 10,
                                                borderRadius: 8,
                                                backgroundColor: theme.dark ? '#334155' : '#E2E8F0',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>Annulla</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            disabled={isSavingGoal}
                                            onPress={handleSaveGoal}
                                            style={{
                                                flex: 2,
                                                paddingVertical: 10,
                                                borderRadius: 8,
                                                backgroundColor: '#22C55E',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                                                {isSavingGoal ? 'Salvataggio...' : 'Conferma Modifica ✓'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            );
                        })()}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Modal Modifica Linea della Meta */}
            {editingLine && (
                <Modal
                    visible={true}
                    transparent
                    animationType="fade"
                    onRequestClose={() => !isSavingLine && setEditingLine(null)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => !isSavingLine && setEditingLine(null)}
                        style={{
                            flex: 1,
                            backgroundColor: 'rgba(0,0,0,0.65)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: 16,
                        }}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={e => e.stopPropagation()}
                            style={{
                                width: '100%',
                                maxWidth: 520,
                                maxHeight: '90%',
                                backgroundColor: theme.colors.card,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: theme.colors.border,
                                padding: 18,
                                elevation: 8,
                            }}
                        >
                            {/* Header */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <View>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.text }}>
                                        Modifica Formazione (Meta #{editingLine.pointNumber})
                                    </Text>
                                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>
                                        Sostituisci un giocatore in campo con un altro convocato
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setEditingLine(null)}
                                    disabled={isSavingLine}
                                    style={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: 15,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: theme.dark ? '#334155' : '#E2E8F0',
                                    }}
                                >
                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={true}>
                                {/* 1. Seleziona Giocatore da Togliere */}
                                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 }}>
                                    1. Giocatore da togliere dalla formazione:
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                    {editingLine.currentLine.map(pId => {
                                        const isSel = editingLine.selectedOldPlayerId === pId;
                                        const pl = P(pId);
                                        return (
                                            <TouchableOpacity
                                                key={pId}
                                                onPress={() => setEditingLine(prev => prev ? { ...prev, selectedOldPlayerId: pId } : null)}
                                                style={{
                                                    paddingHorizontal: 11,
                                                    paddingVertical: 7,
                                                    borderRadius: 8,
                                                    backgroundColor: isSel
                                                        ? (theme.dark ? '#DC2626' : '#C8323C')
                                                        : (theme.dark ? '#1E293B' : '#F1F5F9'),
                                                    borderWidth: 1.5,
                                                    borderColor: isSel ? '#F87171' : (theme.dark ? '#334155' : theme.colors.border),
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                }}
                                            >
                                                <Text style={{ fontSize: 12, fontWeight: isSel ? 'bold' : '600', color: isSel ? '#FFFFFF' : theme.colors.text }}>
                                                    {pl.name}
                                                </Text>
                                                <View style={{
                                                    backgroundColor: pl.g === 'F' ? '#e91e63' : '#1976d2',
                                                    paddingHorizontal: 4,
                                                    paddingVertical: 1,
                                                    borderRadius: 4,
                                                }}>
                                                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#fff' }}>{pl.g}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* 2. Seleziona Giocatore che Entra */}
                                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 }}>
                                    2. Giocatore che subentra al suo posto:
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                    {rosterList
                                        .filter(p => !editingLine.currentLine.includes(p.id) || p.id === editingLine.selectedOldPlayerId)
                                        .map(p => {
                                            const isSel = editingLine.selectedNewPlayerId === p.id;
                                            return (
                                                <TouchableOpacity
                                                    key={p.id}
                                                    onPress={() => setEditingLine(prev => prev ? { ...prev, selectedNewPlayerId: p.id } : null)}
                                                    style={{
                                                        paddingHorizontal: 11,
                                                        paddingVertical: 7,
                                                        borderRadius: 8,
                                                        backgroundColor: isSel
                                                            ? (theme.dark ? '#16A34A' : '#2E8540')
                                                            : (theme.dark ? '#1E293B' : '#F1F5F9'),
                                                        borderWidth: 1.5,
                                                        borderColor: isSel ? '#4ADE80' : (theme.dark ? '#334155' : theme.colors.border),
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 12, fontWeight: isSel ? 'bold' : '600', color: isSel ? '#FFFFFF' : theme.colors.text }}>
                                                        {p.name}
                                                    </Text>
                                                    <View style={{
                                                        backgroundColor: p.g === 'F' ? '#e91e63' : '#1976d2',
                                                        paddingHorizontal: 4,
                                                        paddingVertical: 1,
                                                        borderRadius: 4,
                                                    }}>
                                                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#fff' }}>{p.g}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                </View>

                                {/* Nota trasferimento statistiche */}
                                <View style={{
                                    backgroundColor: theme.dark ? '#1E293B' : '#EFF6FF',
                                    borderRadius: 8,
                                    padding: 10,
                                    marginBottom: 16,
                                    borderWidth: 1,
                                    borderColor: theme.dark ? '#334155' : '#BFDBFE',
                                }}>
                                    <Text style={{ fontSize: 11.5, color: theme.dark ? '#93C5FD' : '#1E40AF', lineHeight: 16 }}>
                                        💡 <Text style={{ fontWeight: 'bold' }}>Trasferimento completo statistiche:</Text> Tutte le azioni registrate in questa meta (punto giocato, eventuali mete, assist, difese, turnover e tocchi) di{' '}
                                        <Text style={{ fontWeight: 'bold' }}>
                                            {editingLine.selectedOldPlayerId ? P(editingLine.selectedOldPlayerId).name : '...'}
                                        </Text>{' '}
                                        verranno automaticamente trasferite a{' '}
                                        <Text style={{ fontWeight: 'bold' }}>
                                            {editingLine.selectedNewPlayerId ? P(editingLine.selectedNewPlayerId).name : '...'}
                                        </Text>.
                                    </Text>
                                </View>
                            </ScrollView>

                            {/* Azioni */}
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                                <TouchableOpacity
                                    onPress={() => setEditingLine(null)}
                                    disabled={isSavingLine}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 8,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: theme.colors.border,
                                    }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary }}>Annulla</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={async () => {
                                        if (!editingLine.selectedOldPlayerId || !editingLine.selectedNewPlayerId) return;
                                        if (editingLine.selectedOldPlayerId === editingLine.selectedNewPlayerId) return;
                                        setIsSavingLine(true);
                                        try {
                                            await onUpdatePointLine?.(
                                                editingLine.pointNumber,
                                                editingLine.selectedOldPlayerId,
                                                editingLine.selectedNewPlayerId
                                            );
                                            setEditingLine(null);
                                        } finally {
                                            setIsSavingLine(false);
                                        }
                                    }}
                                    disabled={
                                        isSavingLine ||
                                        !editingLine.selectedOldPlayerId ||
                                        !editingLine.selectedNewPlayerId ||
                                        editingLine.selectedOldPlayerId === editingLine.selectedNewPlayerId
                                    }
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 8,
                                        borderRadius: 8,
                                        backgroundColor: '#2E8540',
                                        opacity: (!editingLine.selectedOldPlayerId || !editingLine.selectedNewPlayerId || editingLine.selectedOldPlayerId === editingLine.selectedNewPlayerId) ? 0.5 : 1,
                                        minWidth: 120,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' }}>
                                        {isSavingLine ? 'Salvataggio...' : 'Conferma Sostituzione ✓'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>
            )}
        </View>
    );
}

interface AttackPhase {
    phaseIdx: number;
    label: string;
    endRawIdx: number;
    existingTouches: string[];
}

function getAttackPhases(
    pt: DerivedPoint,
    rawEvents: MatchEvent[],
    P: (id: string) => { name: string; g: 'M' | 'F' },
    opponentName: string
): AttackPhase[] {
    const events = pt.ev || [];
    let poss: 'us' | 'them' = pt.o ? 'us' : 'them';
    let segStartLabel: string = pt.o ? 'Inizio punto (O)' : '';
    let segStartEvtIdx = 0;
    const phases: AttackPhase[] = [];
    let phaseIdx = 0;

    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (poss === 'us') {
            const isTO = e.k === 'tt' || e.k === 'td' || e.k === 'ts' || e.k === 'tx';
            const isOurGoal = e.k === 'goal';
            if (isTO || isOurGoal) {
                const rawIdx = rawEvents.indexOf(e);
                if (rawIdx !== -1) {
                    const existing = events.slice(segStartEvtIdx, i).filter(ev => ev.k === 'touch' && ev.p).map(ev => ev.p!);
                    const endLabel = isOurGoal
                        ? `Meta! ${e.s ? P(e.s).name : ''}`
                        : e.k === 'tt' ? `TO Lancio${e.p ? ' ' + P(e.p).name : ''}`
                        : e.k === 'td' ? `TO Presa${e.p ? ' ' + P(e.p).name : ''}`
                        : 'Stall Out';
                    phases.push({ phaseIdx: phaseIdx++, label: `${segStartLabel} → ${endLabel}`, endRawIdx: rawIdx, existingTouches: existing });
                }
                if (isTO) {
                    poss = 'them';
                    segStartLabel = '';
                } else {
                    break;
                }
            }
        } else {
            if (e.k === 'err') {
                poss = 'us';
                segStartLabel = 'Dopo errore loro';
                segStartEvtIdx = i + 1;
            } else if (e.k === 'd') {
                poss = 'us';
                segStartLabel = `Dopo difesa${e.p ? ' ' + P(e.p).name : ''}`;
                segStartEvtIdx = i + 1;
            }
        }
    }
    return phases;
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
